/**
 * **La transacción del alta de una opción, con el `db` inyectado** — B-893.
 *
 * Es el pegamento entre la decisión pura (`alta-de-opcion.js`) y Firestore, y
 * vive aparte del trigger por el mismo motivo que `etiquetas.js` recibe el `db`:
 * así se prueba **contra el emulador de Firestore con el Admin SDK**
 * (`tests/alta-de-opcion.integracion.test.ts`) sin necesitar el emulador de
 * Functions, que el CI no levanta (D-660).
 *
 * No importa `firebase-admin`: el `db` llega de afuera. Lo único que hace es
 * leer el documento **adentro de la transacción**, pedirle la decisión a
 * `decidirAlta` —que ya trae la verificación de B-893 hecha— y escribir el array
 * resultante, o nada.
 *
 * ── Por qué `update({ valores })` y no `set` ──────────────────────────────
 * Porque toca **un** campo del documento y nada más. `decidirAlta` rechaza el
 * documento inexistente, así que nunca hace falta crearlo; y un `set` pisaría
 * cualquier otro campo que el documento tuviera, que es exactamente la clase de
 * escritura de más que esta Function existe para no hacer.
 *
 * ── Y la trampa 8, que se cumple sola ────────────────────────────────────
 * `rebuildPorOpciones` es un `onDocumentWritten` sobre `opciones/{campo}`: los
 * triggers de Firestore disparan por la escritura, no por quién la hizo, así que
 * una escritura del Admin SDK acá marca el rebuild igual que una del panel. Y no
 * hay loop (trampa 3/12): esta es una callable, no un trigger de `/opciones`.
 */
import { decidirAlta } from './alta-de-opcion.js';
import { huellaCreador } from './huella.js';

/**
 * @param {{ doc: (ruta: string) => any, runTransaction: (fn: (tx: any) => Promise<any>) => Promise<any> }} db
 *   un `Firestore` del Admin SDK (se tipa por forma para no importar el paquete)
 * @param {{ campo: string, label: string, slug: string, uid: string, aprobada: boolean }} pedido
 *   ya validado por `validarPedidoDeOpcion`; `aprobada` la decide el rol
 * @returns {Promise<{ slug: string, creada: boolean, rechazo?: undefined } | { rechazo: import('./alta-de-opcion.js').Rechazo }>}
 */
export const aplicarAltaDeOpcion = async (db, { campo, label, slug, uid, aprobada }) => {
  const ref = db.doc(`opciones/${campo}`);
  const alta = { slug, label, huella: huellaCreador(uid), aprobada };

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const valores = snap.exists ? (snap.data()?.valores ?? []) : null;

    const decision = decidirAlta(valores, alta);
    // Un rechazo **no** tira adentro de la transacción: tirar la haría
    // reintentar (hasta cinco veces) una decisión que va a dar lo mismo.
    if (decision.rechazo) return { rechazo: decision.rechazo };

    tx.update(ref, { valores: decision.valores });
    return { slug, creada: decision.creada };
  });
};
