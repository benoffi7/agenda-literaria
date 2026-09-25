/**
 * B-1920 — corregir `ciudades` en el documento, en su propio módulo.
 *
 * La decisión es pura y vive en `ciudades.js` (`ciudadesDesalineadas`); acá queda
 * solo el efecto, con el `db` inyectado y sin `firebase-admin` ni
 * `firebase-functions`, para que el test de integración lo importe sin cargar un
 * trigger (B-561, D-1210). Lo llama `syncCalendar`, que es el único
 * `onDocumentWritten` sobre `actividades/{id}`: `guardarVersion` es un
 * `onDocumentUpdated` y se perdería el documento que **nace** mentido, que es
 * justo el que la regla de `create` deja pasar.
 *
 * ── La guarda anti-loop (trampa 3) ─────────────────────────────────────────
 * Esta escritura vuelve a disparar `syncCalendar` y `guardarVersion`. Se corta en
 * la segunda pasada por dos cosas, y las dos hacen falta:
 *
 *  1. **La guarda del llamador**: `ciudadesDesalineadas(despues)`. Después de
 *     esta escritura el documento coincide consigo mismo, así que la segunda
 *     pasada no entra.
 *  2. **`ciudades` está en `CAMPOS_DE_MAQUINA`** (`historial.js`): el write-back
 *     no cuenta como cambio de contenido, así que no deja una versión en el
 *     historial ni pide un rebuild. No se pierde nada: `ciudades` es un derivado de
 *     `modalidades` y no sale al `events.json`; cuando cambia de verdad, cambian
 *     las filas en la misma escritura.
 *
 * ── Por qué en una transacción ─────────────────────────────────────────────
 * Entre el evento y este punto el panel pudo haber guardado otra vez —filas
 * nuevas y su `ciudades` nuevo, juntos—. Escribir la derivación del **evento**
 * pisaría la buena con una vieja. Se relee y se deriva de lo que hay **ahora**; si
 * ya coincide, no se escribe nada. Es el criterio de `reponerIds` en el sync.
 *
 * ── Qué NO hace ────────────────────────────────────────────────────────────
 * **No toca `estado`.** Una actividad de un publicador que, corregida, queda fuera
 * de su ciudad sigue publicada: despublicarla sería una decisión editorial tomada
 * por un trigger, sobre contenido que es de una cuenta que ya publica sin revisión.
 * Lo que decide es una persona, con el aviso (`alerta: 'ciudades-no-coinciden'`,
 * docs/08-operacion.md). Y tampoco toca `sede` ni los otros derivados: la regla
 * mira la primera `sede`, pero corregirla cambia lo que sale al sitio y al
 * calendario, y eso es otra decisión (B-2050).
 *
 * `update` y no `set`: si el documento se borró en el medio, no se resucita.
 */
import { ciudadesDesalineadas } from './ciudades.js';

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} id
 * @returns {Promise<{ guardadas: unknown, derivadas: string[], estado: unknown } | null>} lo que se
 *   corrigió, o `null` si al releer ya no había nada que corregir
 */
export const corregirCiudades = (db, id) => {
  const ref = db.doc(`actividades/${id}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const datos = snap.data();
    const desalineadas = ciudadesDesalineadas(datos);
    if (!desalineadas) return null;
    tx.update(ref, { ciudades: desalineadas.derivadas });
    // El `estado` de la relectura y no el del evento: es el que va al mail.
    return { ...desalineadas, estado: datos?.estado ?? null };
  });
};
