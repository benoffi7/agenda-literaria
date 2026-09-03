#!/usr/bin/env node
/**
 * Verificación contra el sistema real — B-116.
 *
 * ── Qué problema resuelve ──────────────────────────────────────────────────
 * `docs/05-patrones.md` tiene una regla que ningún test cumple por sí solo:
 * «los tests unitarios prueban la intención; para lo que sale al mundo hay que
 * leer el resultado». Los comandos que la cumplen están escritos en
 * `07-seguridad.md` y `08-operacion.md` —leer el ICS y buscar el link de la
 * reunión, intentar la escritura y la lectura anónimas con `curl`, mirar las
 * cabeceras de cache, ver qué versión quedó publicada— y **se corren a mano**,
 * o sea que se corren cuando alguien se acuerda.
 *
 * No estaba automatizado porque necesita red y una URL privada, y **un agente no
 * debe tener eso en la mano** (§5.4). Esa objeción es correcta y sigue en pie: lo
 * que resuelve es que sea un **script que corre el dueño**, con lo delicado en el
 * entorno y nunca en el repo, en vez de nueve bloques de markdown que hay que
 * copiar y pegar en orden y cuyos resultados hay que interpretar de a uno.
 *
 * ── Lo que NO hace, y es deliberado ────────────────────────────────────────
 * - **No es parte de ningún gate.** Necesita red y producción: meterlo en
 *   `verificar-todo.sh` sería un gate que falla cuando se cae el wifi, que es
 *   exactamente lo que enseña a saltear un gate (B-180).
 * - **No pide, no crea y no imprime ninguna credencial.** La URL privada del ICS
 *   entra por `GOOGLE_CALENDAR_ICS_PRIVADO` y no se imprime nunca, ni siquiera
 *   recortada. La API key de producción sale de `.env.production`, que está
 *   versionado a propósito porque la config del SDK web es pública por diseño.
 * - **Lo que no puede verificar, lo saltea diciéndolo.** Un chequeo saltado se
 *   informa como `— saltado` con el motivo y **no cuenta como verde**: la
 *   diferencia entre «lo verifiqué» y «no pude» es la mitad del valor.
 *
 * ── Qué está derivado y qué no ─────────────────────────────────────────────
 * Las **cabeceras de cache** salen de `firebase.json`, que es donde se declaran:
 * el script recorre las reglas de `hosting.headers` con `source` literal y
 * compara contra lo que el sitio devuelve. Una regla nueva se verifica sola. Es
 * el chequeo que más se presta a envejecer —la lista escrita a mano en la doc ya
 * decía tres rutas de las cinco que hay— y por eso es el que se derivó.
 *
 * Las sondas de Firestore, en cambio, están escritas: cada una es un caso con su
 * expectativa (rechazo o control positivo) y su motivo, y no hay forma honesta de
 * derivar de `firestore.rules` qué respuesta esperar sin reimplementar el
 * evaluador de reglas.
 *
 * Uso:
 *   node scripts/verificar-produccion.mjs
 *   GOOGLE_CALENDAR_ICS_PRIVADO='https://...' node scripts/verificar-produccion.mjs
 *   SITIO=https://agenda-literaria.web.app node scripts/verificar-produccion.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const leer = (r) => readFileSync(fileURLToPath(new URL(r, RAIZ)), 'utf8');

const SITIO = (process.env.SITIO ?? 'https://agendaleh.ar').replace(/\/$/, '');
const PROYECTO = process.env.PROYECTO_FIREBASE ?? 'agenda-literaria';
const BASE_FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;

const resultados = [];
const ok = (que, detalle = '') => resultados.push({ estado: 'ok', que, detalle });
const mal = (que, detalle) => resultados.push({ estado: 'mal', que, detalle });
const saltado = (que, motivo) => resultados.push({ estado: 'saltado', que, detalle: motivo });

/** La API key pública del SDK web, de `.env.production` (§5.4: es pública por diseño). */
const apiKey = () => {
  const m = /^PUBLIC_FIREBASE_API_KEY=(.+)$/m.exec(leer('.env.production'));
  return m?.[1]?.trim() || null;
};

const pedir = async (url, opciones = {}) => {
  const r = await fetch(url, opciones);
  return { status: r.status, cabeceras: r.headers, cuerpo: await r.text() };
};

/** Un rechazo de reglas, nombrado. No alcanza con «no vinieron datos». */
const esRechazo = (cuerpo, status) =>
  status === 403 ||
  /Missing or insufficient permissions|PERMISSION_DENIED/i.test(cuerpo);

// ── 1 · Firestore no le contesta a un anónimo ────────────────────────────
const sondasFirestore = (key) => [
  {
    que: 'escritura anónima a /actividades',
    // El caso original del §5.3: sin el claim `admin` no se escribe.
    pedido: [`${BASE_FIRESTORE}/actividades?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { titulo: { stringValue: 'sonda' }, estado: { stringValue: 'publicado' } },
      }),
    }],
    espera: 'rechazo',
  },
  {
    que: 'escritura anónima a /opciones',
    pedido: [`${BASE_FIRESTORE}/opciones/arancel?key=${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { valores: { arrayValue: { values: [] } } } }),
    }],
    espera: 'rechazo',
  },
  {
    que: 'lectura anónima de /actividades (D-128, B-208)',
    // La que estuvo abierta y entregaba el documento ENTERO — link de la
    // reunión, difusion, uids— salteando `toPublic`. Es la que hay que correr
    // después de deployar reglas.
    pedido: [`${BASE_FIRESTORE}/actividades?key=${key}`, {}],
    espera: 'rechazo',
  },
  {
    que: 'query anónima con el where de estado (D-128, B-208)',
    // La variante que pasaba: la regla vieja la autorizaba y devolvía todo crudo.
    pedido: [
      `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents:runQuery?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'actividades' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'estado' },
                op: 'EQUAL',
                value: { stringValue: 'publicado' },
              },
            },
          },
        }),
      },
    ],
    espera: 'rechazo',
  },
  {
    que: 'lectura anónima de /opciones/arancel (CONTROL POSITIVO)',
    /*
     * Sin este caso el bloque entero pasa con una API key equivocada, con el
     * proyecto mal escrito o sin red: todo daría «rechazo» y se leería como
     * «está todo cerrado». §4.4 — los chips de filtro necesitan esta lectura.
     */
    pedido: [`${BASE_FIRESTORE}/opciones/arancel?key=${key}`, {}],
    espera: 'permitido',
  },
];

const verificarFirestore = async () => {
  const key = apiKey();
  if (!key) {
    saltado('Firestore contra un anónimo', 'no se pudo leer PUBLIC_FIREBASE_API_KEY de .env.production');
    return;
  }
  for (const sonda of sondasFirestore(key)) {
    try {
      const { status, cuerpo } = await pedir(...sonda.pedido);
      const rechazado = esRechazo(cuerpo, status);
      if (sonda.espera === 'rechazo') {
        if (rechazado) ok(sonda.que, 'rechazada, con el error nombrado');
        else
          mal(
            sonda.que,
            `NO fue rechazada (HTTP ${status}). Ojo: un {} vacío tampoco es un rechazo — ` +
              'el error tiene que estar nombrado en la respuesta.',
          );
      } else {
        if (!rechazado && status === 200) ok(sonda.que, 'contesta, como tiene que ser');
        else
          mal(
            sonda.que,
            `el control positivo NO pasó (HTTP ${status}). Mientras esté así, los ` +
              'rechazos de arriba no prueban nada: podrían serlo por la key o por el proyecto.',
          );
      }
    } catch (e) {
      saltado(sonda.que, `no se pudo consultar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};

// ── 2 · Las cabeceras de cache, derivadas de firebase.json ───────────────
const reglasDeCache = () => {
  const cfg = JSON.parse(leer('firebase.json'));
  return (cfg.hosting?.headers ?? [])
    // Solo las de `source` literal: un comodín no dice qué URL pedir, y
    // adivinarla sería inventar el chequeo.
    .filter((h) => !h.source.includes('*'))
    .map((h) => ({
      ruta: h.source,
      esperado: (h.headers ?? []).find((k) => k.key.toLowerCase() === 'cache-control')?.value,
    }))
    .filter((h) => h.esperado);
};

const verificarCache = async () => {
  const reglas = reglasDeCache();
  if (reglas.length === 0) {
    mal('cabeceras de cache', 'firebase.json no declara ninguna regla de `Cache-Control` con source literal');
    return;
  }
  for (const { ruta, esperado } of reglas) {
    try {
      const { cabeceras } = await pedir(`${SITIO}${ruta}`, { method: 'HEAD' });
      const real = cabeceras.get('cache-control');
      // Se compara normalizando espacios: `no-store, max-age=0` y
      // `no-store,max-age=0` son la misma cabecera.
      const norm = (s) => (s ?? '').replace(/\s+/g, '');
      if (norm(real) === norm(esperado)) ok(`cache-control de ${ruta}`, real);
      else mal(`cache-control de ${ruta}`, `firebase.json dice "${esperado}" y el sitio devuelve "${real ?? '(ninguna)'}"`);
    } catch (e) {
      saltado(`cache-control de ${ruta}`, `no se pudo pedir: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};

// ── 3 · Qué versión quedó publicada ──────────────────────────────────────
const verificarVersion = async () => {
  try {
    const { status, cuerpo } = await pedir(`${SITIO}/version.json`);
    if (status !== 200) return mal('versión publicada', `HTTP ${status} en /version.json`);
    const { version } = JSON.parse(cuerpo);
    if (!version) return mal('versión publicada', '/version.json no trae `version`');
    // Un `-sucio` avisa que se buildeó con cambios sin commitear: lo publicado
    // no corresponde exactamente a ningún commit (D-36).
    if (/sucio/.test(version)) mal('versión publicada', `${version} — se buildeó con cambios sin commitear`);
    else ok('versión publicada', version);
  } catch (e) {
    saltado('versión publicada', `no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
  }
};

// ── 4 · El calendario real no filtró el link de la reunión ───────────────
const PLATAFORMAS = ['zoom.us', 'meet.google.com', 'us02web', 'teams.microsoft.com', 'whereby.com'];

/**
 * Desdobla las líneas plegadas del ICS.
 *
 * El formato parte las líneas largas con un salto **más un espacio**, y lo largo
 * de un evento es justamente la URL. Un `grep` sobre el archivo crudo da falsos
 * negativos exactamente en el caso que importa: un link de Zoom partido al medio
 * no matchea `zoom.us` y el chequeo sale en verde con la fuga adentro.
 */
export const desdoblarICS = (crudo) => crudo.replace(/\r\n /g, '').replace(/\n /g, '');

/** Las plataformas de reunión que aparecen en un ICS ya desdoblado. */
export const fugasEnICS = (crudo, plataformas = PLATAFORMAS) => {
  const plano = desdoblarICS(crudo);
  return plataformas.filter((p) => plano.includes(p));
};

const verificarICS = async () => {
  const url = process.env.GOOGLE_CALENDAR_ICS_PRIVADO;
  if (!url) {
    return saltado(
      'el ICS del calendario no lleva el link de la reunión',
      'falta GOOGLE_CALENDAR_ICS_PRIVADO en el entorno. La URL privada NO va al repo (§5.4): ' +
        'sacala de la configuración del calendario y pasala por variable de entorno.',
    );
  }
  try {
    const { status, cuerpo } = await pedir(url);
    if (status !== 200) return mal('el ICS del calendario', `HTTP ${status} al leerlo`);
    const plano = desdoblarICS(cuerpo);
    // Control positivo: si el ICS vino vacío o no es un ICS, no se buscó nada.
    if (!plano.includes('BEGIN:VEVENT')) {
      return mal('el ICS del calendario', 'no tiene ningún VEVENT: o está vacío, o eso no es un ICS');
    }
    const filtrados = fugasEnICS(cuerpo);
    if (filtrados.length > 0) mal('el ICS del calendario', `FUGA: ${filtrados.join(', ')} (trampa 5, §7.4)`);
    else ok('el ICS del calendario', `${(plano.match(/BEGIN:VEVENT/g) ?? []).length} evento(s), sin link de reunión`);
  } catch (e) {
    saltado('el ICS del calendario', `no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
  }
};

// ── 5 · Los issues no llevan la identidad de quien reportó ───────────────
const verificarIssues = () => {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' });
  } catch {
    return saltado('los issues de reporte no llevan identidad', 'no hay `gh` autenticado en esta máquina');
  }
  try {
    const crudo = execFileSync(
      'gh',
      ['issue', 'list', '--label', 'reporte-panel', '--json', 'number,title,body', '--limit', '100'],
      { encoding: 'utf8' },
    );
    const issues = JSON.parse(crudo);
    if (issues.length === 0) return saltado('los issues de reporte no llevan identidad', 'todavía no hay ninguno');
    const sospechosos = issues.filter((i) =>
      /@gmail|@hotmail|@outlook|zoom\.us|meet\.google|wa\.me/i.test(`${i.title}\n${i.body}`),
    );
    if (sospechosos.length > 0)
      mal(
        'los issues de reporte no llevan identidad',
        `FUGA en ${sospechosos.map((i) => `#${i.number}`).join(', ')} (el repo es público)`,
      );
    else ok('los issues de reporte no llevan identidad', `${issues.length} revisado(s)`);
  } catch (e) {
    saltado('los issues de reporte no llevan identidad', `no se pudo listar: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const main = async () => {
  console.log(`Verificando contra el sistema real: ${SITIO} · proyecto ${PROYECTO}\n`);

  await verificarFirestore();
  await verificarCache();
  await verificarVersion();
  await verificarICS();
  verificarIssues();

  const marca = { ok: '  ✓', mal: '  ✗', saltado: '  —' };
  for (const r of resultados) {
    console.log(`${marca[r.estado]} ${r.que}${r.detalle ? `: ${r.detalle}` : ''}`);
  }

  const fallados = resultados.filter((r) => r.estado === 'mal');
  const saltados = resultados.filter((r) => r.estado === 'saltado');
  console.log(
    `\n${resultados.length - fallados.length - saltados.length} verificado(s), ` +
      `${fallados.length} fallado(s), ${saltados.length} saltado(s).`,
  );
  if (saltados.length > 0) {
    console.log('  Un chequeo saltado NO es un chequeo verde: dice que no se pudo mirar.');
  }
  return fallados.length > 0 ? 1 : 0;
};

if (process.argv[1] && process.argv[1].endsWith('verificar-produccion.mjs')) {
  process.exit(await main());
}

export { esRechazo, reglasDeCache, PLATAFORMAS };

