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

/**
 * @param {Date} [ahora]
 * @returns {{ version: string, sha: string | null, generadoEn: string }}
 */
export function infoVersion(ahora = new Date()) {
  const pkg = JSON.parse(readFileSync(new URL('package.json', raiz), 'utf8'));
  const sha = correrGit('rev-parse --short=7 HEAD');
  const pendientes = sha === null ? null : correrGit('status --porcelain');
  const sucio = pendientes !== null && pendientes !== '';

  const version = sha
    ? sucio
      ? `${pkg.version}+${sha}-sucio.${sello(ahora)}`
      : `${pkg.version}+${sha}`
    : `${pkg.version}+sin-git.${sello(ahora)}`;

  return { version, sha, generadoEn: ahora.toISOString() };
}
