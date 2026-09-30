/**
 * §4.4 — el rebuild también se dispara al cambiar `/opciones/*`, si no se
 * renombra una etiqueta y el sitio sigue mostrando la vieja (trampa 8). Y desde
 * B-04, además, se reescriben los eventos de Calendar que muestran esa etiqueta.
 *
 * La decisión de qué reescribir es pura y vive en `sincronizacion.js`
 * (`mismasEtiquetas`, `replanificarPorEtiquetas`). Acá está el pegamento.
 *
 * Vive en su propio archivo desde B-77, junto con `syncCalendar`: los dos eran
 * parte de las seis responsabilidades de `index.js`.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { CALENDAR_ID, calendario } from './calendario-api.js';
import { OPCIONES_BASE } from './despliegue.js';
import { TAXONOMIAS_FUERA_DEL_EVENTO, cargarLabels, invalidarLabels } from './etiquetas.js';
import { marcarRebuild } from './marca-de-rebuild.js';
import {
  aplicarConPresupuesto,
  mapaDeEtiquetas,
  mismasEtiquetas,
  replanificarPorEtiquetas,
} from './sincronizacion.js';

/** El timeout de la Function: el máximo de un trigger de Firestore v2. */
export const TIMEOUT_RESYNC_S = 540;

/**
 * D-1273 — cuánto tiempo se reescriben eventos al renombrar una etiqueta, y no
 * cuántos. Hasta el 2026-09-30 era un tope de 150 eventos (B-04), calculado con
 * 20 actividades publicadas; con 451, renombrar «Arancelado» son 584 eventos, y
 * más de la mitad quedaba con la etiqueta vieja en el calendario público.
 *
 * Deja 90 s de margen antes del timeout: lo que el tope protegía es que la
 * corrida no venza, porque una que vence se reintenta y reescribe de nuevo. A
 * ~200 ms por evento, entran unos 2.000. Si igual se alcanza, se loguea `error`
 * con lo que faltó: cada actividad se pone al día con su próxima edición, y el
 * sitio (que sí muestra la etiqueta nueva) ya se rebuildeó.
 */
export const PRESUPUESTO_RESYNC_MS = (TIMEOUT_RESYNC_S - 90) * 1000;

export const rebuildPorOpciones = onDocumentWritten(
  {
    // Explícitas, no heredadas del `setGlobalOptions` de `index.js` — D-35, ver
    // el mismo comentario en `calendario-trigger.js`.
    ...OPCIONES_BASE,
    document: 'opciones/{campo}',
    // Renombrar una etiqueta reescribe los eventos de todas las actividades
    // publicadas (B-04): son N round trips a Calendar, no una escritura.
    timeoutSeconds: TIMEOUT_RESYNC_S,
  },
  async (event) => {
    const db = getFirestore();
    const { campo } = event.params;

    // El caché de etiquetas quedó viejo. Se invalida solo en esta instancia; las
    // demás lo recargan al reciclarse.
    invalidarLabels();
    await marcarRebuild(db, `opciones/${campo}`);

    // ── B-04 · los eventos ya creados muestran la etiqueta, no el slug ──
    //
    // La descripción y la ubicación del evento resuelven el slug a su etiqueta
    // (D-11), así que renombrar "A la gorra" dejaba a los eventos existentes
    // diciendo lo anterior hasta la próxima edición de cada actividad. El
    // rebuild del sitio no alcanza: el calendario es la otra salida pública.
    const antes = mapaDeEtiquetas(event.data?.before?.data()?.valores);
    const despues = mapaDeEtiquetas(event.data?.after?.data()?.valores);

    if (mismasEtiquetas(antes, despues)) {
      // El caso frecuente y de lejos: `usos + 1` de `upsertOpcion` en cada
      // guardado del formulario, o una opción nueva (que ninguna actividad usa
      // todavía). Sin esta guarda, cada guardado re-sincronizaría todo.
      logger.debug('sin etiquetas renombradas: no se re-sincroniza el calendario', { campo });
      return;
    }

    /*
     * B-830 — la taxonomía que **no sale al evento** no tiene eventos que
     * re-sincronizar, y hasta la sexta este caso no existía: todas las
     * taxonomías estaban en la descripción, así que el escaneo de abajo siempre
     * podía tener trabajo.
     *
     * Sin esta guarda, renombrar «Merienda» hacía todo el trabajo caro para
     * escribir **cero** eventos: releer las cinco taxonomías, autenticar contra
     * la API de Calendar, leer la colección `actividades` entera y correr
     * `replanificarPorEtiquetas` sobre cada sesión de cada actividad publicada.
     * No rompía nada —es lectura sin escritura— y el desperdicio crece con el
     * catálogo. Lo encontró el `auditor-trampas`.
     *
     * Va **después** de `marcarRebuild`, que sí corresponde: el sitio muestra la
     * etiqueta nueva y hay que rebuildearlo (§4.4, trampa 8). Lo que se saltea
     * es solo la mitad de Calendar.
     */
    if (TAXONOMIAS_FUERA_DEL_EVENTO.includes(campo)) {
      logger.debug('la taxonomía no sale al evento: no hay nada que re-sincronizar', { campo });
      return;
    }

    if (!CALENDAR_ID) {
      logger.error('GOOGLE_CALENDAR_ID sin configurar: no se re-sincroniza nada', { campo });
      return;
    }

    // `cargarLabels` ya releyó las cinco taxonomías (el caché se invalidó
    // arriba), así que `labels` tiene las etiquetas nuevas. El mapa viejo es el
    // mismo con este campo pisado por el `before`.
    const labels = await cargarLabels(db);
    const labelsAntes = { ...labels, [campo]: antes };

    // Solo las publicadas: las demás no tienen eventos (§7.3).
    const snap = await db.collection('actividades').where('estado', '==', 'publicado').get();
    const cal = await calendario();
    const ops = snap.docs.flatMap((doc) =>
      replanificarPorEtiquetas(doc.data(), labelsAntes, labels).map((op) => ({
        ...op,
        actividad: doc.id,
      })),
    );

    const { aplicadas: reescritos, pendientes } = await aplicarConPresupuesto(
      ops,
      (op) =>
        cal.events.update({
          calendarId: CALENDAR_ID,
          eventId: op.eventId,
          requestBody: op.evento,
        }),
      {
        presupuestoMs: PRESUPUESTO_RESYNC_MS,
        // Un evento que falla no puede dejar los otros sin actualizar, igual
        // que en el diff.
        alFallar: (op, e) =>
          logger.error('falló la re-sincronización de un evento', {
            campo,
            actividad: op.actividad,
            sesion: op.id,
            error: e?.message,
          }),
      },
    );

    if (pendientes > 0) {
      logger.error('la re-sincronización por etiquetas se cortó por el tiempo', {
        campo,
        reescritos,
        pendientes,
        presupuestoMs: PRESUPUESTO_RESYNC_MS,
      });
    } else if (reescritos > 0) {
      logger.info('eventos re-sincronizados por un cambio de etiqueta', { campo, reescritos });
    }
  },
);
