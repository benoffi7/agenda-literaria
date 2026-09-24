#!/usr/bin/env node
/**
 * **B-1420 — qué fichas de la Guía estuvieron publicadas, hoy no lo están y no
 * tienen la marca `publicadaAlgunaVez`.** Solo lectura.
 *
 *   node scripts/relevar-marca-de-la-guia.mjs
 *   node scripts/relevar-marca-de-la-guia.mjs --sin-historial   # sin Hosting
 *
 * ── El hueco que mide ─────────────────────────────────────────────────────
 * La marca de B-905 la prenden los cuatro `rebuildPor*` cuando una escritura deja
 * la ficha en `publicado` (D-910). Vale hacia adelante: una ficha que se publicó
 * y se despublicó **antes** del deploy no la va a recibir nunca, y como los
 * directorios no tienen historial (a diferencia de las actividades, D-159), su
 * slug vuelve a ser editable — la trampa 10.
 *
 * ── Cómo sabe que una ficha estuvo publicada ──────────────────────────────
 * Firestore no lo sabe: es justo lo que falta. Así que el script cruza cada
 * ficha contra lo que el sitio **publicó**, que es la huella que existe:
 *
 *  1. el `sitemap.xml` en vivo;
 *  2. los `<coleccion>.json` en vivo de la Guía (`librerias.json`, …);
 *  3. **el historial de Hosting**: cada release que Firebase conserva, con la
 *     lista de archivos de su versión. Es la huella que de verdad contesta la
 *     pregunta, porque los dos primeros son una foto de hoy y una ficha
 *     despublicada ya no está en ninguno. Una ficha estuvo publicada si alguna
 *     versión desplegada tuvo su `/guia/<coleccion>/<slug>/index.html`.
 *
 * El repo no tiene otra huella: no guarda volcados de datos ni builds, y los
 * directorios no escriben `versiones` (§12 es solo de actividades).
 *
 * ── Qué NO hace, y el test lo ata ─────────────────────────────────────────
 * **No escribe nada.** No acepta `--aplicar` —así que
 * `tests/guardas-de-los-scripts.test.ts` no lo cuenta entre los que escriben—,
 * no llama a ningún verbo de escritura de Firestore, y a Hosting solo le hace
 * `GET`. La marca la escribe solo el trigger (B-285): si el relevamiento
 * encuentra fichas en el hueco, marcarlas es una decisión del dueño y un script
 * aparte.
 *
 * ── Qué lee ───────────────────────────────────────────────────────────────
 * De cada ficha, con `select`, **solo** `nombre`, `slug`, `estado` y la marca: ni
 * el contacto de quien la cargó ni la revisión. Lo que se imprime es el nombre
 * público de la ficha, su slug y su id.
 *
 * La clasificación es pura y está testeada sin red en
 * `tests/relevar-marca-de-la-guia.test.ts`.
 */
import { execFileSync } from 'node:child_process';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { COLECCIONES_DE_DIRECTORIO } from '../functions/directorios.js';
import { MARCA_DE_PUBLICADA, marcadaComoPublicada } from '../functions/historial.js';

/**
 * Las rutas de cada directorio que no son una ficha. Hoy es una sola; el test
 * la ata contra los archivos de `src/pages/guia/*`, así que una página nueva al
 * lado de `[slug].astro` pone el test en rojo en vez de pasar por una ficha.
 */
export const RUTAS_QUE_NO_SON_FICHA = ['sumar'];

const PATRON_DE_FICHA = new RegExp(
  `^/guia/(${COLECCIONES_DE_DIRECTORIO.join('|')})/([^/]+)/(?:index\\.html)?$`,
);

/**
 * `{ coleccion, slug }` si la ruta (o la URL) es la de una ficha de la Guía, y
 * `null` si no: el listado, `sumar`, una actividad, un asset.
 */
export const fichaDeRuta = (rutaOUrl) => {
  let ruta = String(rutaOUrl ?? '');
  try {
    if (/^https?:\/\//.test(ruta)) ruta = new URL(ruta).pathname;
  } catch {
    return null;
  }
  const m = PATRON_DE_FICHA.exec(ruta);
  if (!m) return null;
  const [, coleccion, slug] = m;
  if (RUTAS_QUE_NO_SON_FICHA.includes(slug)) return null;
  return { coleccion, slug };
};

export const claveDeFicha = (coleccion, slug) => `${coleccion}/${slug}`;

/**
 * Junta las huellas: `{ [coleccion/slug]: string[] }`, con el nombre de cada
 * fuente donde apareció. `fuentes` es `{ [nombre]: rutas[] }`.
 *
 * Objetos y no `Map`/`Set` con `.set()`/`.add()`: el test que ata que el script
 * no escribe busca esos verbos en el fuente, y así no hay excepción que
 * explicarle (mismo criterio que `flyeres-de-propuestas-aceptadas.mjs`).
 */
export const juntarHuellas = (fuentes) => {
  const huellas = {};
  for (const [fuente, rutas] of Object.entries(fuentes)) {
    for (const ruta of rutas) {
      const f = fichaDeRuta(ruta);
      if (!f) continue;
      const k = claveDeFicha(f.coleccion, f.slug);
      const previas = huellas[k] ?? [];
      if (!previas.includes(fuente)) huellas[k] = [...previas, fuente];
    }
  }
  return huellas;
};

/** Los casos, en el orden de la impresión: primero lo que B-1420 vino a buscar. */
export const CASOS = {
  hueco: {
    titulo: 'Estuvo publicada, hoy no lo está, y no tiene la marca (el hueco de B-1420)',
    accion:
      'El slug se puede renombrar y la URL indexada queda en 404 (trampa 10). Es la lista ' +
      'para decidir el backfill: marcar estas fichas, y solo estas.',
  },
  'publicada-sin-marca': {
    titulo: 'Publicada hoy, sin la marca',
    accion:
      'Hoy la cubre el `|| estado` de la regla. La marca le llega con la próxima escritura ' +
      'que la deje publicada — pero si esa escritura es la que la despublica, el trigger no ' +
      'la marca (`faltaMarcarPublicada` mira el después) y cae en el hueco.',
  },
  marcada: {
    titulo: 'Tiene la marca',
    accion: 'Nada: el slug está congelado para siempre.',
  },
  'nunca-publicada': {
    titulo: 'No publicada y sin huella de haberlo estado',
    accion: 'Nada: su slug puede cambiar, y es correcto.',
  },
};

/**
 * Una fila por ficha, con su caso. `fichas` es `{ coleccion, id, nombre, slug,
 * estado, publicadaAlgunaVez? }[]`; `huellas` sale de `juntarHuellas`.
 */
export const clasificarFichas = ({ fichas, huellas }) =>
  fichas.map((f) => {
    const fuentes = huellas[claveDeFicha(f.coleccion, f.slug)] ?? [];
    const caso = marcadaComoPublicada(f)
      ? 'marcada'
      : f.estado === 'publicado'
        ? 'publicada-sin-marca'
        : fuentes.length > 0
          ? 'hueco'
          : 'nunca-publicada';
    return { ...f, caso, fuentes };
  });

/**
 * Las huellas que no son de ninguna ficha de hoy: una ficha borrada, o una
 * renombrada. No son el hueco —no hay documento que marcar— pero son URLs que
 * alguna vez se publicaron y hoy dan 404, así que se listan aparte.
 */
export const huellasHuerfanas = ({ fichas, huellas }) => {
  const vivas = fichas.map((f) => claveDeFicha(f.coleccion, f.slug));
  return Object.keys(huellas)
    .filter((k) => !vivas.includes(k))
    .sort()
    .map((clave) => ({ clave, fuentes: huellas[clave] }));
};

/** Las filas agrupadas por caso, en el orden de `CASOS`, sin los vacíos. */
export const agruparPorCaso = (filas) =>
  Object.keys(CASOS)
    .map((caso) => ({ caso, filas: filas.filter((f) => f.caso === caso) }))
    .filter((g) => g.filas.length > 0);

// ── La red: todo GET ──────────────────────────────────────────────────────

const SITIO = process.env.SITIO_PUBLICO ?? 'https://agendaleh.ar';
const HOSTING = 'https://firebasehosting.googleapis.com/v1beta1';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un GET, con reintento ante un 429: la API de Hosting tiene cuota por minuto y
 * el historial son cientos de versiones. Cualquier otro error corta — un
 * relevamiento que se saltea una versión en silencio podría dar cero de más.
 */
const traer = async (url, headers = {}, intento = 0) => {
  const r = await fetch(url, { method: 'GET', headers });
  if (r.status === 429 && intento < 8) {
    await esperar(2000 * 2 ** intento);
    return traer(url, headers, intento + 1);
  }
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r;
};

const rutasDelSitemap = async () => {
  const xml = await (await traer(`${SITIO}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
};

const rutasDeLosJson = async () => {
  const rutas = [];
  for (const coleccion of COLECCIONES_DE_DIRECTORIO) {
    const json = await (await traer(`${SITIO}/${coleccion}.json`)).json();
    for (const ficha of json[coleccion] ?? []) rutas.push(`/guia/${coleccion}/${ficha.slug}/`);
  }
  return rutas;
};

/** Cada versión que Hosting desplegó alguna vez, y sus rutas de fichas. */
const rutasDelHistorialDeHosting = async (projectId) => {
  const token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'])
    .toString()
    .trim();
  const headers = { Authorization: `Bearer ${token}`, 'x-goog-user-project': projectId };
  const sitio = `${HOSTING}/sites/${projectId}`;

  const versiones = [];
  let pagina = '';
  do {
    const r = await (
      await traer(`${sitio}/releases?pageSize=100${pagina ? `&pageToken=${pagina}` : ''}`, headers)
    ).json();
    for (const rel of r.releases ?? []) {
      const v = rel.version?.name;
      if (v && !versiones.includes(v)) versiones.push(v);
    }
    pagina = r.nextPageToken ?? '';
  } while (pagina);

  const rutasDe = async (version) => {
    const rutas = [];
    let p = '';
    do {
      const r = await (
        await traer(`${HOSTING}/${version}/files?pageSize=10000${p ? `&pageToken=${p}` : ''}`, headers)
      ).json();
      for (const f of r.files ?? []) if (f.path?.startsWith('/guia/')) rutas.push(f.path);
      p = r.nextPageToken ?? '';
    } while (p);
    return rutas;
  };

  // De a cuatro: son cientos de versiones y la API tiene cuota por minuto.
  const rutas = [];
  for (let i = 0; i < versiones.length; i += 4) {
    const lote = await Promise.all(versiones.slice(i, i + 4).map(rutasDe));
    for (const r of lote) rutas.push(...r);
  }
  return { versiones: versiones.length, rutas };
};

const main = async () => {
  const sinHistorial = process.argv.includes('--sin-historial');
  const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

  if (enEmulador && !sinHistorial) {
    // Cruzar las fichas del emulador contra el historial de producción diría
    // cualquier cosa: todo slug sembrado que coincida con uno real saldría
    // como «estuvo publicada».
    console.error(
      'Firestore apunta al EMULADOR y el historial de Hosting es el de PRODUCCIÓN.\n' +
        'Corré con --sin-historial, o sacá FIRESTORE_EMULATOR_HOST. Abortando.',
    );
    process.exit(1);
  }

  initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });
  console.log(
    enEmulador
      ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})`
      : `Objetivo: PRODUCCIÓN (${projectId})`,
  );
  console.log(`Sitio:    ${SITIO}`);
  console.log('Modo:     solo lectura\n');

  const db = getFirestore();
  const fichas = [];
  for (const coleccion of COLECCIONES_DE_DIRECTORIO) {
    const snap = await db
      .collection(coleccion)
      .select('nombre', 'slug', 'estado', MARCA_DE_PUBLICADA)
      .get();
    for (const d of snap.docs) fichas.push({ coleccion, id: d.id, ...d.data() });
  }

  const fuentes = {
    sitemap: await rutasDelSitemap(),
    json: await rutasDeLosJson(),
  };
  let versiones = 0;
  if (!sinHistorial) {
    const h = await rutasDelHistorialDeHosting(projectId);
    versiones = h.versiones;
    fuentes.hosting = h.rutas;
  }
  const huellas = juntarHuellas(fuentes);

  console.log(
    `${fichas.length} ficha(s) en ${COLECCIONES_DE_DIRECTORIO.join(', ')} · ` +
      `${Object.keys(huellas).length} slug(s) de ficha publicados alguna vez` +
      (sinHistorial ? ' (sin el historial de Hosting)' : ` · ${versiones} versión(es) de Hosting`),
  );

  const filas = clasificarFichas({ fichas, huellas });
  const enElHueco = filas.filter((f) => f.caso === 'hueco').length;
  console.log(`\n${enElHueco} ficha(s) en el hueco de B-1420\n`);

  for (const { caso, filas: delCaso } of agruparPorCaso(filas)) {
    console.log(`── ${CASOS[caso].titulo} (${delCaso.length})`);
    console.log(`   Qué hacer: ${CASOS[caso].accion}`);
    for (const f of delCaso) {
      const donde = f.fuentes.length > 0 ? ` · visto en ${f.fuentes.join(', ')}` : '';
      console.log(`   - ${f.nombre ?? '(sin nombre)'} · ${f.coleccion}/${f.slug} · ${f.estado} · ${f.id}${donde}`);
    }
    console.log('');
  }

  const huerfanas = huellasHuerfanas({ fichas, huellas });
  console.log(`── URLs de ficha que se publicaron y hoy no son de ninguna ficha (${huerfanas.length})`);
  console.log('   Qué hacer: una ficha borrada o renombrada; su URL da 404. No hay documento que marcar.');
  for (const h of huerfanas) console.log(`   - /guia/${h.clave}/ · visto en ${h.fuentes.join(', ')}`);
};

// Importable desde el test sin disparar `main` (mismo patrón que
// `flyeres-de-propuestas-aceptadas.mjs`).
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Falló el relevamiento:', e);
      process.exit(1);
    });
}
