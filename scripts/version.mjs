/**
 * Versión de la app, calculada en el build.
 *
 * De dónde sale: `version` del `package.json` + el SHA corto de git. La primera
 * la mueve una persona cuando el cambio lo amerita; el segundo identifica el
 * commit exacto sin que nadie tenga que acordarse de tocar nada. Juntos son
 * reproducibles (mismo commit → misma versión) y legibles: quien reporta un bug
 * dice "0.1.0+a1b2c3d" y del otro lado se hace `git show a1b2c3d`.
 *
 * No se usa un timestamp como identidad del build: el sitio se rebuildea cada
 * vez que cambia una actividad en Firestore (§8) y el JS del panel es idéntico
 * en todos esos builds. Si el timestamp definiera la versión, el panel se
 * recargaría solo varias veces por día sin ningún motivo.
 *
 * Los dos casos donde no hay commit del que colgarse (árbol sucio, clone sin
 * `.git`) sí llevan sello de tiempo: ahí no hay identidad estable posible y es
 * mejor que dos builds distintos se vean distintos.
 *
 * Es un script de build: corre en Node, nunca en el navegador.
 *
 * **El formato lo define `componerVersion` y nadie más** (B-88, D-98). Este
 * módulo no lo puede compartir con su consumidor —la analítica corre en el
 * navegador y acá se importa `node:child_process`—, así que la única forma de
 * que productor y consumidor no se separen es que el test los ate:
 * `versionesPosibles()` recorre el dominio completo de entradas de un build y
 * `tests/version.test.ts` mete cada salida en el sanitizador real de
 * `analytics-eventos.ts`. Una forma nueva de versión tiene que nacer acá
 * adentro, y el test la prueba sola.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = new URL('..', import.meta.url);

/** Comando de git con salida limpia; `null` si no hay repo o el comando falla. */
const correrGit = (argumentos) => {
  try {
    return execSync(`git ${argumentos}`, {
      cwd: fileURLToPath(raiz),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
};

/** `2026-08-21T21:24:…` → `20260821-2124`. Legible y ordenable. */
const sello = (fecha) => fecha.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

/** `version` del `package.json`, que es la parte que mueve una persona. */
export const versionBase = () =>
  JSON.parse(readFileSync(new URL('package.json', raiz), 'utf8')).version;

/**
 * **El único lugar donde se arma una cadena de versión.** Puro: recibe los
 * hechos del build (qué dice git, qué hora es) y devuelve el string. Si hace
 * falta una forma nueva, se agrega acá y en `ENTRADAS_DE_BUILD`; el test que
 * ata este módulo con el sanitizador de la analítica la levanta solo.
 *
 * @param {{ base: string, sha: string | null, sucio: boolean, ahora: Date }} hechos
 * @returns {string}
 */
export const componerVersion = ({ base, sha, sucio, ahora }) => {
  if (!sha) return `${base}+sin-git.${sello(ahora)}`;
  return sucio ? `${base}+${sha}-sucio.${sello(ahora)}` : `${base}+${sha}`;
};

/**
 * El dominio **completo** de entradas que puede tener un build: hay commit o no
 * lo hay, y el árbol está limpio o no. Cuatro combinaciones, tres formas de
 * versión (sin `.git` no hay nada que ensuciar).
 *
 * Está acá y no en el test a propósito: quien agregue una entrada está parado
 * al lado de `componerVersion`, que es donde vive el formato.
 */
export const ENTRADAS_DE_BUILD = [
  { sha: '5e2cb50', sucio: false },
  { sha: '5e2cb50', sucio: true },
  { sha: null, sucio: false },
  { sha: null, sucio: true },
];

/**
 * Todas las versiones que este build puede llegar a estampar. Es lo que el
 * consumidor tiene que aceptar entero: la analítica reemplaza por `'otro'` lo
 * que no reconoce, y una versión que viaja como `'otro'` no sirve para nada
 * (B-88).
 *
 * @param {{ base?: string, ahora?: Date }} [opciones]
 * @returns {string[]}
 */
export const versionesPosibles = ({ base = versionBase(), ahora = new Date() } = {}) => [
  ...new Set(ENTRADAS_DE_BUILD.map((hechos) => componerVersion({ base, ...hechos, ahora }))),
];

/**
 * @param {Date} [ahora]
 * @returns {{ version: string, sha: string | null, generadoEn: string }}
 */
export function infoVersion(ahora = new Date()) {
  const sha = correrGit('rev-parse --short=7 HEAD');
  const pendientes = sha === null ? null : correrGit('status --porcelain');
  const sucio = pendientes !== null && pendientes !== '';

  return {
    version: componerVersion({ base: versionBase(), sha, sucio, ahora }),
    sha,
    generadoEn: ahora.toISOString(),
  };
}
