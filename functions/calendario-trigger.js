/**
 * §7 — el sync a Google Calendar: el trigger.
 *
 * La parte frágil —el diff, la guarda anti-loop, la construcción del evento— es
 * pura y vive en `calendario.js` y `sincronizacion.js`, así que se testea sin
 * emuladores y sin tocar un calendario real (§10). Acá solo queda el pegamento:
 * leer las etiquetas, ejecutar las operaciones que el diff decidió, y escribir
 * los ids de vuelta.
 *
 * Vive en su propio archivo desde B-77. Antes estaba en `index.js`, que era el
 * único archivo de `functions/` sin este corte — y el único de 327 LOC sin
 * ningún test.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { planificar } from './calendario.js';
import { CALENDAR_ID, calendario, crearEvento } from './calendario-api.js';
import { OPCIONES_BASE } from './despliegue.js';
import { cargarLabels } from './etiquetas.js';
import { huboCambioDeContenido } from './historial.js';
import { marcarRebuild } from './marca-de-rebuild.js';
import { decidirAnteFallo, reponerIds } from './sincronizacion.js';

/**
 * Las opciones van **explícitas** y no heredadas del `setGlobalOptions` de
 * `index.js`: en ESM los imports se evalúan antes que el cuerpo del importador,
 * así que cuando este módulo se carga `setGlobalOptions` todavía no corrió
 * (D-35). Heredarlas dejaría la Function en `us-central1` y con la SA por
 * defecto de Compute, a la que Calendar le contesta 404 en todo.
 */
export const syncCalendar = onDocumentWritten(
  { ...OPCIONES_BASE, document: 'actividades/{id}' },
  async (event) => {
    const db = getFirestore();
    const antes = event.data?.before?.data() ?? null;
    const despues = event.data?.after?.data() ?? null;
    const { id } = event.params;

    // B-83 — el rebuild del sitio se marca ACÁ, antes de los dos cortes de
    // abajo, porque corresponde por que la actividad cambió y no por que el
    // calendario haya recibido operaciones. `destacado`, `imagenUrl`,
    // `searchText` y el `slug` salen al `events.json` (§5.2) y **no** entran al
    // evento de Calendar: colgando el rebuild del sync, tildar "Destacar en la
    // portada" de una actividad publicada no llegaba nunca al sitio. Y sin
    // `GOOGLE_CALENDAR_ID` configurado no se publicaba nada, nunca.
    //
    // La guarda no puede faltar: esta misma Function escribe `calendarEventId`
    // de vuelta, y marcar el rebuild ahí sería pedir un build por cada sync —
    // que además rearma el contador de reintentos (`CAMPOS_REARME`, D-23) y
    // vuelve a subir `pendiente` justo después de que un build arrancó.
    //
    // La pregunta "¿cambió algo que le importe a quien lo lee?" ya está resuelta
    // en `historial.js`: `huboCambioDeContenido` compara el **contenido
    // editable**, o sea el documento menos lo que escribe la máquina (D-41). El
    // write-back produce, por construcción, el mismo contenido editable. Es la
    // misma propiedad de D-07, y no un acuerdo entre dos listas de campos.
    if (huboCambioDeContenido(antes, despues)) {
      await marcarRebuild(db, `actividad ${id}`);
    }

    const labels = await cargarLabels(db);
    const ops = planificar(antes, despues, labels);

    if (ops.length === 0) {
      // §7.1 — la guarda anti-loop vive acá: la escritura de `calendarEventId`
      // vuelve a disparar esta Function, pero no produce ninguna operación, así
      // que la recursión se corta en la segunda pasada.
      logger.debug('sin cambios relevantes para Calendar', { id });
      return;
    }

    if (!CALENDAR_ID) {
      logger.error('GOOGLE_CALENDAR_ID sin configurar: no se sincroniza nada', { id });
      return;
    }

    const cal = await calendario();
    // Qué `calendarEventId` queda en cada sesión (`null` = se borró). Se juntan
    // y se escriben de una sola vez al final: un update por sesión serían N
    // disparos más de esta misma Function.
    const ids = new Map();

    for (const op of ops) {
      try {
        if (op.tipo === 'crear') {
          const eventId = await crearEvento(cal, op);
          ids.set(op.id, eventId);
          logger.info('evento creado', { id, sesion: op.id, eventId });
        } else if (op.tipo === 'actualizar') {
          await cal.events.update({
            calendarId: CALENDAR_ID,
            eventId: op.eventId,
            requestBody: op.evento,
          });
          // B-80 — el id se repone también acá, no solo al crear y al borrar: si
          // el panel guardó desde un snapshot previo al write-back, el documento
          // quedó con `calendarEventId: null` y la edición siguiente crearía un
          // segundo evento. Ver `reponerIds`. Desde B-150 el panel además relee
          // el documento antes de escribir, así que esto pasó a ser la red de
          // abajo y no el arreglo.
          ids.set(op.id, op.eventId);
          logger.info('evento actualizado', { id, sesion: op.id });
        } else if (op.tipo === 'borrar') {
          await cal.events.delete({ calendarId: CALENDAR_ID, eventId: op.eventId });
          ids.set(op.id, null);
          logger.info('evento borrado', { id, sesion: op.id });
        }
      } catch (e) {
        // Qué significa el fallo lo decide `decidirAnteFallo` (B-125), que es
        // pura y tiene su tabla testeada; acá solo se ejecuta el efecto.
        const code = e?.code ?? e?.response?.status;
        const { accion, motivo } = decidirAnteFallo(op, code);

        if (accion === 'limpiar-id') {
          ids.set(op.id, null);
          logger.warn('el evento ya no existía en Calendar', { id, sesion: op.id, motivo });
        } else if (accion === 'recrear') {
          // B-125 — alguien borró el evento a mano y el encuentro sigue
          // publicado: se repone. Sin esto el id colgado hacía que cada edición
          // volviera a emitir `actualizar` contra un evento inexistente, así que
          // el encuentro se perdía del calendario público para siempre.
          try {
            const eventId = await crearEvento(cal, op);
            ids.set(op.id, eventId);
            logger.warn('el evento no estaba en Calendar: se recreó', {
              id,
              sesion: op.id,
              eventId,
              motivo,
            });
          } catch (e2) {
            logger.error('falló recrear un evento borrado a mano', {
              id,
              sesion: op.id,
              error: e2?.message,
            });
          }
        } else {
          // No se corta el loop: un encuentro que falla no debe dejar los otros
          // siete sin sincronizar.
          logger.error('falló una operación de Calendar', {
            id,
            sesion: op.id,
            tipo: op.tipo,
            error: e?.message,
          });
        }
      }
    }

    if (ids.size > 0) {
      // Se relee el documento: entre el diff y este punto pudo haber otra
      // edición, y escribir el array que teníamos en memoria la perdería.
      const ref = db.doc(`actividades/${id}`);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const sesiones = reponerIds(snap.data().sesiones ?? [], ids);
        // `null` = el documento ya tiene los ids que corresponden, que es el caso
        // normal de un `actualizar`. Escribirlo igual dispararía esta misma
        // Function otra vez para no cambiar nada.
        if (sesiones) tx.update(ref, { sesiones });
      });
    }
  },
);
