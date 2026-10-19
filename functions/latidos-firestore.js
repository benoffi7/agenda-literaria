/**
 * El I/O del latido (B-2220), aparte de `latidos.js` para que aquél siga puro —
 * el mismo corte que `derivados.js` / `derivados-firestore.js`.
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DOC_LATIDOS } from './latidos.js';

/** Lo que `conAlertaDeBarrido` llama al terminar bien. */
export const latido = (nombre) => () =>
  getFirestore()
    .doc(DOC_LATIDOS)
    .set({ [nombre]: FieldValue.serverTimestamp() }, { merge: true });
