/** Helpers para los tests que necesitan los emuladores corriendo. */

export const HOST_FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

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
  projectId = 'agenda-literaria',
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

/** Borra una colección del emulador vía su API REST de limpieza. */
export const limpiarFirestore = async (projectId = 'agenda-literaria'): Promise<void> => {
  await fetch(
    `http://${HOST_FIRESTORE}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
};
