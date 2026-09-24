#!/usr/bin/env node
/**
 * **¿Tiene el bucket de imágenes el CORS de `cors.json`?** — B-1321.
 *
 *   node scripts/cors-del-bucket.mjs
 *   npm run cors:verificar
 *   SITIO=https://agenda-literaria.web.app node scripts/cors-del-bucket.mjs
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 * El CORS del bucket es un **paso de consola** (`gcloud storage buckets update
 * … --cors-file=cors.json`, B-1235a) y no viaja con ningún deploy. Sin él, el
 * `fetch` de `promoverImagenDePropuesta` falla en el navegador con «Failed to
 * fetch» y la propuesta se convierte sin su flyer (B-1235). Tres cosas lo hacen
 * invisible:
 *
 * - en el **emulador** anda igual, porque el emulador no aplica el CORS del
 *   bucket, así que ni la suite ni el gate pueden verlo;
 * - en la bandeja la foto **se ve**, porque un `<img>` no necesita CORS;
 * - el test de `cors.json` mira **el archivo**, no el bucket. Si alguien lo borra
 *   de la consola, cambia el dominio o se crea un bucket nuevo, el archivo sigue
 *   bien y el bucket no.
 *
 * Lo único que puede decirlo es preguntarle al bucket de verdad. Eso hace este
 * script, y es lo mismo que el `curl -H Origin` con el que se verificó B-1235a.
 *
 * ── Qué hace ───────────────────────────────────────────────────────────────
 * 1. Baja `events.json` del sitio publicado y toma la primera imagen que viva en
 *    `firebasestorage.googleapis.com` — es pública, así que no hace falta
 *    ninguna credencial para pedirla.
 * 2. Por **cada origen de `cors.json`** hace un `GET` con `Origin:` y exige que
 *    vuelva `Access-Control-Allow-Origin` con ese origen. Los orígenes se derivan
 *    del archivo: uno nuevo se verifica solo.
 * 3. **Control negativo:** el mismo `GET` desde un origen que `cors.json` no
 *    declara **no** tiene que recibir la cabecera. Si la recibe, el bucket tiene
 *    aplicada otra configuración —un `*`, o una que alguien escribió a mano— y
 *    el archivo del repo dejó de describirlo.
 *
 * ── Lo que NO hace, y es deliberado ────────────────────────────────────────
 * - **No escribe nada.** No aplica el CORS: eso es del dueño, en la consola
 *   (`08-operacion.md` § «El CORS del bucket»). Un chequeo que arregla solo en
 *   producción es otra decisión.
 * - **No entra a ningún gate ni a ningún workflow.** Pega contra producción y
 *   contra el CDN de Storage: un gate que falla cuando se cae la red es el que
 *   enseña a saltear los gates (B-180). Es la misma decisión que
 *   `verificar-produccion.mjs`, y el porqué largo está en `08-operacion.md`.
 * - **Lo que no puede verificar, lo saltea diciéndolo.** Sin red o sin ninguna
 *   imagen del bucket en `events.json`, el resultado es `— saltado` y no cuenta
 *   como verde.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const leer = (r) => readFileSync(fileURLToPath(new URL(r, RAIZ)), 'utf8');

const SITIO = (process.env.SITIO ?? 'https://agendaleh.ar').replace(/\/$/, '');

/** El host de las URLs de descarga de `getDownloadURL()`. */
const HOST_STORAGE = 'https://firebasestorage.googleapis.com/v0/b/';

/**
 * Un origen que `cors.json` no declara, para el control negativo. `.invalid` es
 * un TLD reservado (RFC 2606): no puede ser nunca un dominio real del sitio.
 */
export const ORIGEN_NO_DECLARADO = 'https://origen-no-declarado.invalid';

/**
 * Los orígenes que `cors.json` habilita para `GET`, sin repetir y en orden.
 *
 * Solo cuentan las entradas que permiten `GET`: es el método del `fetch` que
 * promueve la imagen, y una entrada que solo diga `HEAD` no lo arregla. Un `*`
 * se rechaza: no hay un origen concreto que mandar, y además contradice lo que
 * B-1235 decidió (solo los cuatro orígenes del sitio).
 *
 * @param {unknown} cors el contenido de `cors.json` ya parseado
 * @returns {string[]}
 */
export const origenesDeCors = (cors) => {
  if (!Array.isArray(cors)) throw new Error('cors.json no es una lista de entradas');
  const origenes = [];
  for (const entrada of cors) {
    const metodos = (entrada?.method ?? []).map((m) => String(m).toUpperCase());
    if (!metodos.includes('GET')) continue;
    for (const o of entrada?.origin ?? []) {
      if (o === '*') throw new Error('cors.json declara el origen "*": no hay un origen concreto que verificar');
      if (!origenes.includes(o)) origenes.push(o);
    }
  }
  if (origenes.length === 0) throw new Error('cors.json no habilita ningún origen para GET');
  return origenes;
};

/** El bucket de una URL de descarga de Storage, o `null` si no es una. */
export const bucketDeUrl = (url) => {
  if (typeof url !== 'string' || !url.startsWith(HOST_STORAGE)) return null;
  const resto = url.slice(HOST_STORAGE.length);
  const fin = resto.indexOf('/');
  return fin > 0 ? resto.slice(0, fin) : null;
};

/**
 * La primera imagen de `events.json` que sirve el bucket `bucket`.
 *
 * Lee `imagenUrl` —la portada, que es lo que el JSON público lleva hoy— y, por
 * si la proyección vuelve a tener la galería entera, también `imagenes[].url`.
 * Una imagen externa (un link de otro sitio, D-125) no sirve: su CORS no es el
 * nuestro.
 *
 * @param {unknown} eventos `events.json` ya parseado
 * @param {string} bucket el bucket esperado
 * @returns {string|null}
 */
export const imagenDelBucket = (eventos, bucket) => {
  const actividades = eventos && Array.isArray(eventos.actividades) ? eventos.actividades : [];
  for (const a of actividades) {
    const candidatas = [a?.imagenUrl, ...(Array.isArray(a?.imagenes) ? a.imagenes.map((i) => i?.url) : [])];
    const buena = candidatas.find((u) => bucketDeUrl(u) === bucket);
    if (buena) return buena;
  }
  return null;
};

/**
 * Qué decir de una respuesta. **Puro, para que tenga test.**
 *
 * `declarado` dice si el origen está en `cors.json`: si lo está, la cabecera
 * tiene que venir con ese origen (o `*`, que igual deja leer); si no lo está, es
 * el control negativo y la cabecera **no** tiene que venir.
 *
 * @param {{ origen: string, declarado: boolean, status: number, allowOrigin: string|null }} r
 * @returns {{ estado: 'ok'|'mal', detalle: string }}
 */
export const veredicto = ({ origen, declarado, status, allowOrigin }) => {
  if (status < 200 || status >= 300) {
    return {
      estado: 'mal',
      detalle: `la imagen respondió HTTP ${status}: sin un 2xx no se puede leer el CORS (¿se borró el objeto?)`,
    };
  }
  if (declarado) {
    if (allowOrigin === origen || allowOrigin === '*') return { estado: 'ok', detalle: `Access-Control-Allow-Origin: ${allowOrigin}` };
    if (!allowOrigin) {
      return {
        estado: 'mal',
        detalle:
          'NO vuelve Access-Control-Allow-Origin. El bucket no tiene aplicado cors.json: ' +
          'la promoción de la foto de una propuesta falla (B-1235). Ver 08-operacion.md § «El CORS del bucket»',
      };
    }
    return { estado: 'mal', detalle: `vuelve Access-Control-Allow-Origin: ${allowOrigin}, que no es este origen` };
  }
  if (!allowOrigin) return { estado: 'ok', detalle: 'no recibe la cabecera, como tiene que ser' };
  return {
    estado: 'mal',
    detalle:
      `recibe Access-Control-Allow-Origin: ${allowOrigin} sin estar en cors.json. ` +
      'El bucket tiene aplicada otra configuración y el archivo del repo dejó de describirla',
  };
};

/** El bucket de producción, de `.env.production` (la config del SDK web es pública, §5.4). */
const bucketDeProduccion = () => {
  const m = /^PUBLIC_FIREBASE_STORAGE_BUCKET=(.+)$/m.exec(leer('.env.production'));
  return m?.[1]?.trim() || null;
};

/** Sin el `?token=`: no protege nada (02-infraestructura.md), pero no hace falta imprimirlo. */
const sinQuery = (url) => url.split('?')[0];

const main = async () => {
  const resultados = [];
  const anotar = (que, { estado, detalle }) => resultados.push({ estado, que, detalle });

  const bucket = bucketDeProduccion();
  const origenes = origenesDeCors(JSON.parse(leer('cors.json')));
  console.log(`CORS del bucket ${bucket ?? '(sin bucket)'} · imagen tomada de ${SITIO}/events.json\n`);

  let imagen = null;
  if (!bucket) {
    anotar('el bucket', { estado: 'saltado', detalle: 'no se pudo leer PUBLIC_FIREBASE_STORAGE_BUCKET de .env.production' });
  } else {
    try {
      const r = await fetch(`${SITIO}/events.json`);
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      imagen = imagenDelBucket(await r.json(), bucket);
      if (!imagen) {
        anotar('una imagen del bucket', {
          estado: 'saltado',
          detalle: `events.json no tiene ninguna imagen servida por ${bucket}: no hay qué pedirle`,
        });
      } else {
        console.log(`Imagen: ${sinQuery(imagen)}\n`);
      }
    } catch (e) {
      anotar('events.json', { estado: 'saltado', detalle: `no se pudo bajar: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  if (imagen) {
    const casos = [
      ...origenes.map((origen) => ({ origen, declarado: true })),
      { origen: ORIGEN_NO_DECLARADO, declarado: false },
    ];
    for (const { origen, declarado } of casos) {
      const que = declarado ? `GET desde ${origen}` : `GET desde ${origen} (CONTROL NEGATIVO)`;
      try {
        const r = await fetch(imagen, { headers: { Origin: origen } });
        // Los bytes no interesan: solo las cabeceras.
        await r.body?.cancel();
        anotar(que, veredicto({ origen, declarado, status: r.status, allowOrigin: r.headers.get('access-control-allow-origin') }));
      } catch (e) {
        anotar(que, { estado: 'saltado', detalle: `no se pudo pedir: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
  }

  const marca = { ok: '  ✓', mal: '  ✗', saltado: '  —' };
  for (const r of resultados) console.log(`${marca[r.estado]} ${r.que}: ${r.detalle}`);

  const fallados = resultados.filter((r) => r.estado === 'mal').length;
  const saltados = resultados.filter((r) => r.estado === 'saltado').length;
  console.log(`\n${resultados.length - fallados - saltados} verificado(s), ${fallados} fallado(s), ${saltados} saltado(s).`);
  if (saltados > 0) console.log('  Un chequeo saltado NO es un chequeo verde: dice que no se pudo mirar.');
  return fallados > 0 ? 1 : 0;
};

if (process.argv[1] && process.argv[1].endsWith('cors-del-bucket.mjs')) {
  process.exit(await main());
}
