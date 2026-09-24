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
 * **El alcance de eso es exactamente esas tres operaciones, y no el emulador
 * entero — D-730.** Donde el endpoint REST no lleva proyecto, este `projectId`
 * no aísla y tampoco avisa: las reglas de Storage son globales (B-366) y el
 * emulador de Auth es de un solo proyecto, el de su `--project` de arranque
 * (B-1112). No invalida la elección; es su precio, y está escrito porque no
 * estarlo costó cerrar B-1021 y B-1030 con la causa equivocada. **Desde B-1201
 * el de Auth no sale de acá**: lo lee `proyectoDelEmuladorDeAuth()`, más abajo,
 * del emulador vivo (D-1020).
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

/**
 * El payload de un JWT, sin verificar la firma: son tokens del emulador.
 *
 * Degrada a `{}` con cualquier entrada rara. Es la única decodificación de este
 * caso en el repo: `tests/emulador.ts` la re-exporta como `cargaDelToken` en vez
 * de tener la suya (la clase de B-88).
 *
 * @param {string} jwt
 * @returns {Record<string, unknown>}
 */
export const cargaDelJwt = (jwt) => {
  const payload = String(jwt ?? '').split('.')[1];
  if (!payload) return {};
  try {
    const carga = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return carga !== null && typeof carga === 'object' && !Array.isArray(carga) ? carga : {};
  } catch {
    return {};
  }
};

/**
 * El proyecto que sirve **el emulador de Auth vivo** en `hostAuth` — B-1201, D-1020.
 *
 * ── Por qué Auth no usa `PROJECT_ID_EMULADOR` ──────────────────────────────
 * El emulador de Auth es de **un solo proyecto**: el de su `--project` de
 * arranque (D-730, B-1112). La huella de la ruta sirve para Firestore, que es
 * multi-proyecto y es donde está el borrado que hay que aislar (B-219); para
 * Auth solo coincide si el emulador se levantó desde el mismo checkout donde
 * corre la suite. Desde cualquier otro, el Admin SDK escribía los claims en un
 * namespace, el cliente entraba en otro, y la corrida no se podía hacer.
 *
 * Así que el `projectId` tiene **dos** dueños, uno por emulador: el de
 * Firestore lo manda el checkout y el de Auth lo manda el emulador vivo. Se lee
 * **solo al loguear** —que por definición necesita el emulador arriba—, así que
 * no queda ninguna «corrida sin emulador» que resolver: la objeción que B-1201
 * le hacía a esta salida desaparece cuando la lectura es perezosa y acotada a
 * Auth.
 *
 * ── Cómo se lee ────────────────────────────────────────────────────────────
 * El emulador no lo dice por ninguna vía consultable (medido para B-1112:
 * `/emulator/v1/projects/{p}/config` contesta 200 para cualquier `p`, y el
 * `projects` de identitytoolkit devuelve un número de proyecto, no el id). Lo
 * que sí lo dice es el `aud` de un ID token, que lo emite el emulador: se abre
 * una cuenta **anónima** por la API REST, se lee el `aud` y se la borra con su
 * propio token. No toca Firestore ni ninguna cuenta con nombre.
 *
 * Devuelve `null` ante cualquier cosa rara —emulador caído, anónimas apagadas,
 * token ilegible— y quien llama cae a `PROJECT_ID_EMULADOR`: es el
 * comportamiento de antes, con la guarda de B-1112 detrás para nombrarlo.
 *
 * @param {string} hostAuth `host:puerto` del emulador de Auth.
 * @param {typeof fetch} [pedir] inyectable para los tests, que no levantan nada.
 * @returns {Promise<string | null>}
 */
export const proyectoDelEmuladorDeAuth = async (hostAuth, pedir = fetch) => {
  const base = `http://${hostAuth}/identitytoolkit.googleapis.com/v1`;
  /** @param {string} ruta @param {unknown} cuerpo */
  const post = (ruta, cuerpo) =>
    // El emulador no valida la API key, pero la exige presente.
    pedir(`${base}/${ruta}?key=clave-del-emulador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(2000),
    });
  try {
    const r = await post('accounts:signUp', { returnSecureToken: true });
    if (!r.ok) return null;
    const { idToken } = await r.json();
    if (typeof idToken !== 'string') return null;
    // La sonda no se queda: el store de Auth no se limpia entre corridas.
    await post('accounts:delete', { idToken }).catch(() => undefined);
    const aud = cargaDelJwt(idToken).aud;
    return typeof aud === 'string' && aud !== '' ? aud : null;
  } catch {
    return null;
  }
};

// CLI: `node scripts/project-id-emulador.mjs` lo escribe y nada más. Lo usa
// `scripts/verificar-todo.sh`, que es bash y no puede importar un módulo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${PROJECT_ID_EMULADOR}\n`);
}
