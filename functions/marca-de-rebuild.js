/**
 * B-77 — marcar que hay que rebuildear el sitio (§8), en su propio módulo.
 *
 * Lo llaman los **dos** triggers que pueden cambiar lo que el sitio muestra: el
 * de actividades y el de `/opciones/*` (§4.4, trampa 8). El debounce no está
 * acá: lo hace el schedule (`dispararRebuild`), que es el que decide cuándo se
 * dispara el build de verdad.
 *
 * Recibe el `db`, así que no importa `firebase-admin` para la instancia — solo
 * `FieldValue`, que es un sentinel y no una conexión.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { CAMPOS_REARME } from './rebuild.js';

/**
 * `CAMPOS_REARME` resetea el contador de fallos: un cambio nuevo merece sus
 * propios intentos. Es lo que hace que el rebuild se recupere solo después de un
 * problema persistente (D-23, ver `rebuild.js`).
 *
 * `actualizado` va con `serverTimestamp()` y no con un `Date` del módulo puro
 * porque **nadie lo lee para decidir**: es la marca contra la que
 * `registrarExito` compara para no bajar `pendiente` sobre un cambio que llegó
 * durante el dispatch (B-85). Los que sí entran a un cálculo —`ultimoIntento`,
 * `disparado`— los escribe `rebuild.js` como `Date`, para no mezclar dos relojes.
 */
export const marcarRebuild = (db, motivo) =>
  db.doc('sistema/rebuild').set(
    {
      pendiente: true,
      motivo,
      actualizado: FieldValue.serverTimestamp(),
      ...CAMPOS_REARME,
    },
    { merge: true },
  );
