/** Helpers para los tests que necesitan los emuladores corriendo. */

export const HOST_FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

/** ¿Están los emuladores arriba? Si no, los tests de integración se saltean. */
export const emuladorVivo = async (): Promise<boolean> => {
  try {
    const r = await fetch(`http://${HOST_FIRESTORE}/`, {
      signal: AbortSignal.timeout(1500),
    });
    return r.status < 500;
  } catch {
    return false;
  }
};

/** Borra una colección del emulador vía su API REST de limpieza. */
export const limpiarFirestore = async (projectId = 'agenda-literaria'): Promise<void> => {
  await fetch(
    `http://${HOST_FIRESTORE}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
};
