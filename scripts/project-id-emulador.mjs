/**
 * El `projectId` del emulador para ESTE working-tree — B-219, B-276, B-169.
 *
 * ── El problema ────────────────────────────────────────────────────────────
 * El emulador es **estado compartido de la máquina, no del checkout**. Escucha
 * en `127.0.0.1:8080` y ahí le pega cualquier worktree: `firestore-client.ts`
 * hace `connectFirestoreEmulator(_db, '127.0.0.1', 8080)` con el host escrito
 * en el código, y `vitest.config.ts` cae al `?? '127.0.0.1:8080'` cuando la
 * variable no viene exportada. O sea que dos checkouts corriendo `npm test` a
 * la vez le hablan **a la misma base**, y los tests de integración empiezan por
 * `limpiarFirestore()`, que borra la base **entera**: el vecino se queda sin
 * fixture en el medio de un `it`.
 *
 * Cinco observaciones independientes de eso están anotadas en B-219, de tres
 * worktrees y dos días. `fileParallelism: false` serializa los archivos **de
 * una corrida** y no las corridas **de dos worktrees**, así que taponaba la
 * mitad.
 *
 * ── El arreglo, y por qué éste y no el otro ────────────────────────────────
 * Las dos candidatas eran **un puerto de emulador por worktree** o **un
 * `projectId` por worktree sobre el mismo emulador**. Se eligió la segunda:
 *
 *  - El puerto por worktree obliga a que el host del emulador sea configurable
 *    en **código de producción** (`firestore-client.ts` y `firebase-client.ts`
 *    lo tienen escrito: `'127.0.0.1', 8080` y `'http://127.0.0.1:9099'`), y a
 *    coordinar cuatro puertos por checkout (auth, firestore, storage, hub) más
 *    el `firebase.json`. Es cambiar el panel para arreglar los tests.
 *  - El `projectId` por worktree no toca nada de producción: el emulador de
 *    Firestore es multi-proyecto y las tres operaciones que importan ya están
 *    parametrizadas por proyecto en su API REST — el borrado
 *    (`/emulator/v1/projects/{p}/databases/(default)/documents`), la carga de
 *    reglas (`:securityRules`) y los documentos (`/v1/projects/{p}/…`).
 *
 * **Verificado contra el emulador el 2026-09-02**, porque B-219 anotaba como
 * objeción que «choca con `singleProjectMode: true` de `firebase.json`»: no
 * choca. Con el emulador levantado por el checkout principal (o sea con
 * `--single_project_mode true` en su línea de comandos) se cargaron reglas para
 * dos projectIds inventados, se escribió un documento en cada uno, se borró
 * **uno** entero y el documento del otro siguió ahí (200 contra 404). El modo
 * de proyecto único avisa; no aísla ni impide. El test que fija esa propiedad
 * está en `tests/emulador-aislado.test.ts` y no es un comentario: escribe en un
 * segundo proyecto, corre `limpiarFirestore()` del nuestro y verifica que el
 * otro sobrevivió.
 *
 * ── Por qué la huella sale de la ruta y no de un azar ──────────────────────
 * Tiene que ser **estable entre corridas del mismo checkout**: el emulador
 * persiste (`--export-on-exit`), y un projectId nuevo por corrida dejaría una
 * base huérfana por vez. Y tiene que ser **distinta entre checkouts** sin que
 * nadie configure nada, porque el modo de falla que esto arregla apareció
 * justamente en worktrees creados al vuelo. La ruta absoluta del working-tree
 * cumple las dos: es lo único que distingue a dos checkouts del mismo repo.
 *
 * ── Interfaz ───────────────────────────────────────────────────────────────
 * Módulo puro más un CLI de una línea, para que lo puedan usar los tres tipos
 * de consumidor sin que ninguno derive el valor por su cuenta (que es la clase
 * de bug de B-88):
 *
 *   import { PROJECT_ID_EMULADOR } from './scripts/project-id-emulador.mjs';
 *   node scripts/project-id-emulador.mjs      # → agenda-literaria-a1b2c3d4
 */
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** El proyecto de verdad. Nunca se usa como base de tests: es el de producción. */
export const PROYECTO_REAL = 'agenda-literaria';

/**
 * Los ocho hex que identifican al working-tree.
 *
 * Se normalizan las barras finales porque las dos fuentes de la ruta no
 * coinciden: `new URL('..', import.meta.url)` termina en `/` y
 * `git rev-parse --show-toplevel` no. Sin esto, el CLI y el import darían dos
 * projectIds distintos para el mismo checkout — que es exactamente el bug que
 * este módulo existe para no tener.
 */
export const huellaDeRaiz = (raiz) =>
  createHash('sha256').update(String(raiz).replace(/\/+$/, '')).digest('hex').slice(0, 8);

/**
 * `projectId` del emulador para el working-tree en `raiz`.
 *
 * Respeta el formato de un project id de Firebase (6-30 caracteres, minúsculas,
 * dígitos y guiones, arranca con letra): 16 del nombre + 1 + 8 = 25.
 */
export const projectIdDeEmulador = (raiz) => `${PROYECTO_REAL}-${huellaDeRaiz(raiz)}`;

/** La raíz de ESTE checkout, derivada de la ubicación de este archivo. */
export const RAIZ_DEL_CHECKOUT = fileURLToPath(new URL('..', import.meta.url));

/**
 * El valor que usan los tests, el gate y los scripts.
 *
 * Se respeta `PUBLIC_FIREBASE_PROJECT_ID` si viene del entorno: es la salida de
 * emergencia (apuntar una corrida a la base que uno tiene cargada a mano) y es
 * cómo el gate se lo pasa a los subprocesos.
 */
export const PROJECT_ID_EMULADOR =
  process.env.PUBLIC_FIREBASE_PROJECT_ID || projectIdDeEmulador(RAIZ_DEL_CHECKOUT);

// CLI: `node scripts/project-id-emulador.mjs` lo escribe y nada más. Lo usa
// `scripts/verificar-todo.sh`, que es bash y no puede importar un módulo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${PROJECT_ID_EMULADOR}\n`);
}
