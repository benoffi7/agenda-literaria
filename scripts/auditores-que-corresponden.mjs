#!/usr/bin/env node
/**
 * Decide qué auditores corresponden a partir de la lista de archivos que
 * cambiaron. Lee la lista por stdin (una ruta por línea) y escribe:
 *
 *   privacidad=true|false
 *   trampas=true|false
 *   documentacion=true|false
 *   disparadores_privacidad=<rutas separadas por coma>
 *   disparadores_trampas=<rutas separadas por coma>
 *
 *   git diff --name-only HEAD | node scripts/auditores-que-corresponden.mjs
 *
 * ── Por qué existe (B-124) ────────────────────────────────────────
 * La decisión de B-124 es que el `auditor-privacidad` corra **solo** cuando el
 * diff toca una salida pública, y los otros dos antes del PR. Eso necesita
 * contestar "¿este diff toca una salida?" desde un lugar que se pueda testear,
 * igual que `que-deployar.sh` contesta "¿esto hay que deployarlo?". Un `if`
 * adentro de un hook es igual de imposible de probar que un `if` adentro de un
 * YAML.
 *
 * ── La lista NO se mantiene acá ───────────────────────────────────
 * Los archivos que disparan cada auditor se **derivan del `description` de su
 * propia definición** en `.claude/agents/<name>.md`, que es el lugar donde ya
 * estaban escritos y el que decide si Claude lo invoca solo. Copiarlos acá
 * habría creado un tercer lugar que se queda viejo sin que nada falle — la
 * clase de B-88, y exactamente el modo de falla que B-216 vino a cerrar para la
 * cuenta de salidas públicas.
 *
 * Consecuencia buscada: una salida nueva se suma al `description` (que es lo
 * que ya pide `docs/07-seguridad.md`) y **entra sola** a este disparador.
 * `tests/auditores-que-corresponden.test.ts` ata las dos puntas.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Los tres auditores, con su archivo de definición. */
export const AUDITORES = {
  privacidad: '.claude/agents/auditor-privacidad.md',
  trampas: '.claude/agents/auditor-trampas.md',
  documentacion: '.claude/agents/auditor-documentacion.md',
};

/**
 * `auditor-documentacion` corre SIEMPRE, y eso no se puede derivar de ninguna
 * lista: su `description` no nombra archivos porque su disparador es el cambio,
 * no el archivo ("antes de commitear o de abrir un PR, cuando alguien dice
 * listo"). Queda declarado acá, con el motivo, en vez de fingir que sale de un
 * grep.
 */
export const SIEMPRE = ['documentacion'];

/**
 * El frontmatter de un archivo de agente, plano (`clave: valor` por línea).
 *
 * No se usa una librería de YAML a propósito: es el mismo criterio de
 * `tests/agentes-y-skills.test.ts` — no hay ninguna instalada y estos
 * frontmatter son planos.
 *
 * @param {string} src
 * @returns {Record<string, string>}
 */
export const frontmatter = (src) => {
  /** @type {Record<string, string>} */
  const claves = {};
  if (!src.startsWith('---\n')) return claves;
  const cierre = src.indexOf('\n---\n', 3);
  if (cierre === -1) return claves;
  for (const linea of src.slice(4, cierre + 1).split('\n')) {
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(linea);
    if (m) claves[m[1]] = m[2].trim();
  }
  return claves;
};

/**
 * Las rutas del repo que un `description` nombra, separadas en dos clases:
 *
 * - `archivos`: una ruta concreta (`src/lib/toPublic.ts`,
 *   `src/pages/actividad/[slug].astro`, `firestore.rules`).
 * - `prefijos`: un directorio, o sea que termina en `/` (`src/lib/`,
 *   `src/components/admin/`). El `auditor-trampas` está escrito así.
 *
 * El mismo extractor sirve para los tres agentes: lo que cambia es qué escribió
 * cada uno en su ficha, no cómo se lee.
 *
 * @param {string} descripcion
 * @returns {{ archivos: string[], prefijos: string[] }}
 */
export const rutasQueNombra = (descripcion) => {
  /** @type {Set<string>} */
  const archivos = new Set();
  /** @type {Set<string>} */
  const prefijos = new Set();

  /*
   * Solo `src/` y `functions/` — el código del producto. Las fichas también
   * nombran tests (`tests/clases-de-bug.test.ts` en la del `auditor-trampas`),
   * pero ahí el test es una **referencia** ("los registros que esos chequeos
   * recorren"), no un disparador: no es que tocar ese archivo tenga que
   * despertar al auditor. Incluirlo haría que el disparador dijera algo que la
   * ficha no dice.
   *
   * `[]` va primero en la clase de caracteres (POSIX) y `-` al final, para que
   * `src/pages/actividad/[slug].astro` entre entero.
   */
  for (const bruto of descripcion.match(/(?:src|functions)\/[\]A-Za-z0-9_./[-]*/g) ?? []) {
    // La coma o el punto final de la oración no son parte de la ruta.
    const ruta = bruto.replace(/[.,;]+$/, (cola) => (bruto.endsWith('/') ? cola : ''));
    if (ruta.endsWith('/')) prefijos.add(ruta);
    else if (/\.[a-z]+$/.test(ruta)) archivos.add(ruta);
  }
  // Las reglas no viven bajo ningún directorio, así que no las agarra el regex
  // de arriba. Son dos nombres fijos y se nombran literal.
  for (const suelto of ['firestore.rules', 'storage.rules']) {
    if (descripcion.includes(suelto)) archivos.add(suelto);
  }

  return { archivos: [...archivos].sort(), prefijos: [...prefijos].sort() };
};

/**
 * ¿La ruta cae en lo que ese agente declaró mirar?
 *
 * @param {string} ruta
 * @param {{ archivos: string[], prefijos: string[] }} nombradas
 * @returns {boolean}
 */
const cae = (ruta, { archivos, prefijos }) =>
  archivos.includes(ruta) || prefijos.some((p) => ruta.startsWith(p));

/**
 * La decisión. `fichas` mapea auditor → contenido de su archivo de definición,
 * así que esta función es pura y el test le puede pasar fichas inventadas.
 *
 * @param {string[]} rutas
 * @param {Record<string, string>} fichas
 * @returns {Record<string, { corresponde: boolean, disparadores: string[] }>}
 */
export const auditoresQueCorresponden = (rutas, fichas) => {
  /** @type {Record<string, { corresponde: boolean, disparadores: string[] }>} */
  const salida = {};
  for (const auditor of Object.keys(AUDITORES)) {
    const ficha = fichas[auditor];
    const nombradas = ficha ? rutasQueNombra(frontmatter(ficha).description ?? '') : { archivos: [], prefijos: [] };
    const disparadores = rutas.filter((r) => cae(r, nombradas)).sort();
    salida[auditor] = {
      corresponde: SIEMPRE.includes(auditor) || disparadores.length > 0,
      // Un auditor que corre SIEMPRE no tiene disparadores que nombrar: no
      // hace falta que el diff toque nada.
      disparadores,
    };
  }
  return salida;
};

/**
 * Lee las fichas de los tres auditores del disco, relativas a la raíz del repo.
 *
 * @param {URL} raiz
 * @returns {Record<string, string>}
 */
export const leerFichas = (raiz) => {
  /** @type {Record<string, string>} */
  const fichas = {};
  for (const [auditor, ruta] of Object.entries(AUDITORES)) {
    try {
      fichas[auditor] = readFileSync(new URL(ruta, raiz), 'utf8');
    } catch {
      // Una ficha que no está es un agente que no existe: el auditor no
      // corresponde nunca. No es un error del script.
      fichas[auditor] = '';
    }
  }
  return fichas;
};

// ── CLI ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entrada = readFileSync(0, 'utf8');
  const rutas = entrada.split('\n').map((l) => l.trim()).filter(Boolean);
  const raiz = new URL('../', import.meta.url);
  const decision = auditoresQueCorresponden(rutas, leerFichas(raiz));

  const lineas = [];
  for (const auditor of Object.keys(AUDITORES)) {
    lineas.push(`${auditor}=${decision[auditor].corresponde}`);
  }
  for (const auditor of Object.keys(AUDITORES)) {
    lineas.push(`disparadores_${auditor}=${decision[auditor].disparadores.join(',')}`);
  }
  process.stdout.write(`${lineas.join('\n')}\n`);
}
