/** Helpers para los tests que necesitan los emuladores corriendo. */

export const HOST_FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

/**
 * El `projectId` contra el que corre TODO test de integración — B-219.
 *
 * No es `'agenda-literaria'`: es una base propia de este working-tree, para que
 * el `limpiarFirestore()` de un checkout no vacíe la base del vecino. El valor
 * lo calcula `scripts/project-id-emulador.mjs` a partir de la ruta del
 * checkout, y lo inyecta `vitest.config.ts` como `PUBLIC_FIREBASE_PROJECT_ID`
 * —la misma variable que leen `firebase-client.ts` y `firebase-admin.ts`, así
 * que el panel y el build apuntan solos a la base correcta.
 *
 * **Se lee de acá, nunca se escribe el literal.** Un `projectId:
 * 'agenda-literaria'` suelto en un test de integración vuelve a hablarle a la
 * base compartida, y el síntoma es el de siempre: verde catorce veces y rojo la
 * quince. `tests/emulador-aislado.test.ts` lo frena por grep.
 *
 * Consecuencia que hay que tener presente: **una base nueva arranca sin
 * reglas**, así que todo archivo que lea o escriba con el SDK de cliente tiene
 * que llamar a `cargarReglas()` en su `beforeAll`. Eso ya era lo correcto por
 * B-174; ahora además es obligatorio.
 */
export const PROJECT_ID = process.env.PUBLIC_FIREBASE_PROJECT_ID || 'agenda-literaria';

/**
 * ¿Están los emuladores arriba? Si no, los tests de integración se saltean —
 * salvo que `EXIGIR_EMULADOR=1`, y entonces **falla**.
 *
 * Ese flag existe para el CI. Sin él, `npm test` en un runner sin emuladores da
 * verde salteando los 33 tests de integración en silencio: un cambio a
 * `firestore.rules` se deployaría sin que nadie las haya probado. "Verde" tiene
 * que distinguir entre "las reglas pasaron" y "las reglas no se probaron".
 */
export const emuladorVivo = async (): Promise<boolean> => {
  let vivo = false;
  try {
    const r = await fetch(`http://${HOST_FIRESTORE}/`, {
      signal: AbortSignal.timeout(1500),
    });
    vivo = r.status < 500;
  } catch {
    vivo = false;
  }

  if (!vivo && process.env.EXIGIR_EMULADOR === '1') {
    throw new Error(
      `EXIGIR_EMULADOR=1 pero el emulador de Firestore no responde en ${HOST_FIRESTORE}. ` +
        'Los tests de integración se habrían salteado en silencio.',
    );
  }
  return vivo;
};

export const HOST_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

/**
 * ¿Está el emulador de **Auth** arriba? — B-365.
 *
 * Va aparte de `emuladorVivo()` por el mismo motivo que
 * `emuladorStorageVivo()`: son emuladores distintos y el modo de falla que
 * importa es el **asimétrico**. Y acá no es una hipótesis, es lo que pasó el
 * 2026-09-02 mientras se probaba B-219:
 *
 * Otro worktree levantó su propia tanda de emuladores, y el proceso padre de la
 * primera murió. Su hijo de Firestore quedó **huérfano y escuchando** en el 8080;
 * el hub y Auth se fueron con el padre. O sea: media tanda viva. `emuladorVivo()`
 * le pregunta solo a Firestore, así que dijo «está arriba», los cuatro archivos
 * que hacen login corrieron, y lo que se vio fue un
 * `Error while making request: connect ECONNREFUSED 127.0.0.1:9099` desde el
 * fondo del SDK, en un `beforeAll`, sin una palabra sobre qué emulador faltaba.
 *
 * Con esto, el mismo caso dice qué pasa y qué hacer. **No lo arregla B-219**: el
 * `projectId` por checkout separa las bases, no los puertos, así que "media
 * tanda viva" sigue siendo posible — lo que cambia es que se nombra en vez de
 * salir por abajo. Es la quinta observación de B-219 (el emulador como estado
 * compartido que aparece y desaparece) con una cara más: **que aparezca a
 * medias**.
 */
export const emuladorAuthVivo = async (): Promise<boolean> => {
  let vivo = false;
  try {
    // El emulador de Auth contesta su página de configuración en la raíz. Se
    // pregunta por el endpoint de config del proyecto, que devuelve 200 con el
    // emulador arriba y no depende de que exista ningún usuario.
    const r = await fetch(`http://${HOST_AUTH}/emulator/v1/projects/${PROJECT_ID}/config`, {
      signal: AbortSignal.timeout(1500),
    });
    vivo = r.status < 500;
  } catch {
    vivo = false;
  }

  if (!vivo && process.env.EXIGIR_EMULADOR === '1') {
    throw new Error(
      `EXIGIR_EMULADOR=1 pero el emulador de Auth no responde en ${HOST_AUTH}. ` +
        'Los tests que hacen login se habrían salteado en silencio. ' +
        '¿Arrancaste los emuladores con `auth` en el `--only`? ' +
        'Ojo con la tanda a medias: si Firestore contesta y Auth no, puede haber ' +
        'un hijo huérfano de una tanda cuyo padre murió (B-365).',
    );
  }
  return vivo;
};

/**
 * Carga en el emulador **las reglas de este checkout**.
 *
 * El emulador sirve el `firestore.rules` del directorio desde el que se lo
 * arrancó, no el del checkout donde corren los tests. Con un solo repo no se
 * nota; con worktrees en paralelo —que es cómo se está trabajando este backlog—
 * significa que un test de reglas puede estar verificando el archivo de **otra**
 * rama y dar verde sin haber probado nada del cambio. Es el modo de falla más
 * caro que tiene un test de reglas: dice "las reglas pasaron" cuando quiere decir
 * "unas reglas pasaron".
 *
 * Empujarlas por la API del emulador saca la duda: lo que se prueba es el archivo
 * que está al lado del test. Es la misma idea de `docs/05-patrones.md` §
 * "Verificar contra el sistema real, no contra lo que se cree que se mandó".
 */
export const cargarReglas = async (
  ruta: string,
  projectId = PROJECT_ID,
): Promise<void> => {
  const { readFile } = await import('node:fs/promises');
  const contenido = await readFile(ruta, 'utf8');
  const r = await fetch(
    `http://${HOST_FIRESTORE}/emulator/v1/projects/${projectId}:securityRules`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: contenido }] } }),
    },
  );
  if (!r.ok) {
    throw new Error(`El emulador rechazó las reglas de ${ruta}: ${r.status} ${await r.text()}`);
  }
};

/**
 * Un proyecto auxiliar del emulador, colgado del de este working-tree.
 *
 * Algunos tests necesitan una **segunda** base: la del `trampa 7` carga un
 * ruleset condicionado que no puede tocar el nuestro (reabriría la fuga de
 * B-208 para los tests que corran después), y la de `emulador-aislado` hace de
 * "el otro worktree" para verificar que el borrado no se propaga.
 *
 * **Tiene que derivar de `PROJECT_ID`, y esto es lo que lo obliga.** Un nombre
 * fijo —`'trampa-7-mecanismo'`, digamos— es exactamente el bug de B-219 con
 * otra ropa: dos checkouts corriendo a la vez comparten ese proyecto auxiliar y
 * se pisan ahí, aunque sus bases principales estén separadas. Se descubrió
 * probando el arreglo con dos corridas concurrentes, que dieron rojo en los dos
 * tests que usaban un literal (`trampa 7` incluido, que ya estaba en el repo).
 * `tests/emulador-aislado.test.ts` lo frena por grep desde ahora.
 */
export const proyectoAparte = (sufijo: string): string => `${PROJECT_ID}-${sufijo}`;

/** Borra una colección del emulador vía su API REST de limpieza. */
export const limpiarFirestore = async (projectId = PROJECT_ID): Promise<void> => {
  await fetch(
    `http://${HOST_FIRESTORE}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
};


// ─────────────────────────────────────────────────────────────────
// Storage (B-167, segunda tajada)
// ─────────────────────────────────────────────────────────────────

export const HOST_STORAGE = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';

/** El bucket del proyecto, igual que en `.env.*` (`PUBLIC_FIREBASE_STORAGE_BUCKET`). */
export const BUCKET_EMULADOR = 'agenda-literaria.firebasestorage.app';

/**
 * ¿Está el emulador de Storage arriba? Mismo contrato que `emuladorVivo`: se
 * saltea, salvo con `EXIGIR_EMULADOR=1`.
 *
 * Va aparte y no dentro de `emuladorVivo` porque son dos emuladores distintos y
 * el modo de falla que importa es el asimétrico: Firestore arriba y Storage no
 * —el `--only auth,firestore` de siempre, sin actualizar— daría verde salteando
 * justamente los tests de las reglas nuevas.
 */
export const emuladorStorageVivo = async (): Promise<boolean> => {
  let vivo = false;
  try {
    // La raíz del emulador de Storage contesta 501, así que sirve de poco: se
    // pregunta por el listado del bucket, que devuelve 403 («No LIST
    // permission», que es lo correcto con estas reglas) cuando está arriba.
    const r = await fetch(`http://${HOST_STORAGE}/v0/b/${BUCKET_EMULADOR}/o`, {
      signal: AbortSignal.timeout(1500),
    });
    vivo = r.status < 500;
  } catch {
    vivo = false;
  }

  if (!vivo && process.env.EXIGIR_EMULADOR === '1') {
    throw new Error(
      `EXIGIR_EMULADOR=1 pero el emulador de Storage no responde en ${HOST_STORAGE}. ` +
        'Los tests de las reglas de Storage se habrían salteado en silencio. ' +
        '¿Arrancaste los emuladores con `storage` en el `--only`?',
    );
  }
  return vivo;
};

/**
 * Carga en el emulador de Storage **las reglas de este checkout**.
 *
 * Mismo motivo que `cargarReglas` para Firestore, y con más razón: con varios
 * worktrees en paralelo, el emulador sirve el `storage.rules` del directorio
 * desde el que se lo arrancó, y un test podría dar verde habiendo probado las
 * reglas de otra rama.
 *
 * **Residual conocido (B-366).** A diferencia de Firestore, el emulador de
 * Storage no tiene endpoint de reglas por proyecto: `/internal/setRules` es
 * global y la última carga gana para todos. Así que el aislamiento por
 * `projectId` de B-219 **no llega hasta acá**. Hoy no muerde —los objetos van
 * con nombre único por caso, nadie barre el bucket, y dos checkouts empujando
 * el mismo `storage.rules` cargan lo mismo— y muerde el día que dos worktrees
 * corran a la vez con `storage.rules` distinto. No hay arreglo dentro del
 * emulador: sería un puerto de Storage por checkout.
 */
export const cargarReglasStorage = async (ruta: string): Promise<void> => {
  const { readFile } = await import('node:fs/promises');
  const contenido = await readFile(ruta, 'utf8');
  const r = await fetch(`http://${HOST_STORAGE}/internal/setRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'storage.rules', content: contenido }] } }),
  });
  if (!r.ok) {
    throw new Error(`El emulador rechazó ${ruta}: ${r.status} ${await r.text()}`);
  }
};
