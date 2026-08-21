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

/** Borra una colección del emulador vía su API REST de limpieza. */
export const limpiarFirestore = async (projectId = 'agenda-literaria'): Promise<void> => {
  await fetch(
    `http://${HOST_FIRESTORE}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
};
