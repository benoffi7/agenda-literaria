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

/**
 * Volver a pedir el build porque **el sitio quedó atrasado**, no porque una
 * actividad haya cambiado — B-884, y es lo que cierra ese ítem.
 *
 * **Escribe exactamente lo mismo que `marcarRebuild` y existe con nombre propio
 * por una razón que no es estética.** Aquélla está declarada en
 * `EFECTOS_INCONDICIONALES` (`tests/clases-de-bug.test.ts`): corresponde
 * **siempre** que el documento cambió, así que el chequeo de la clase de B-83
 * exige que no quede debajo de ningún `return`. Acá el uso es el contrario —un
 * reintento **condicionado** a que el chequeo de frescura haya confirmado una
 * divergencia—, y llamarla directo convertiría un uso legítimo en una violación
 * de la invariante del otro. Lo intentó el frente de B-882 y el chequeo lo
 * rechazó, con razón.
 *
 * El `motivo` viaja al `client_payload` del dispatch y queda en
 * `despacho.motivo` (B-884), así que un build disparado por esta vía se
 * distingue de uno disparado por una edición: es lo que permite leer después
 * cuántas veces el sitio se reparó solo.
 *
 * **Está acotado por quien lo llama**, no por acá: cuelga de la misma decisión
 * que abre el issue, o sea de la firma de la divergencia y del reaviso a las 24
 * horas. A lo sumo un build extra por día y por divergencia distinta.
 */
export const remarcarPorFrescura = (db) => marcarRebuild(db, 'frescura');
