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
import { cargarLabels, invalidarLabels } from './etiquetas.js';
import { marcarRebuild } from './marca-de-rebuild.js';
import { mapaDeEtiquetas, mismasEtiquetas, replanificarPorEtiquetas } from './sincronizacion.js';

/**
 * Cuántos eventos se reescriben como máximo al renombrar una etiqueta (B-04).
 *
 * Es un tope de seguridad, no una regla de negocio: con 30 actividades
 * publicadas de 8 encuentros ya son 240 round trips a Calendar, y la Function
 * tiene un timeout. Si se alcanza, se loguea `error` con lo que faltó: cada
 * actividad se pone al día sola con su próxima edición, y el sitio (que sí
 * muestra la etiqueta nueva) ya se rebuildeó.
 */
export const MAX_EVENTOS_RESYNC = 150;

export const rebuildPorOpciones = onDocumentWritten(
  {
    // Explícitas, no heredadas del `setGlobalOptions` de `index.js` — D-35, ver
    // el mismo comentario en `calendario-trigger.js`.
    ...OPCIONES_BASE,
    document: 'opciones/{campo}',
    // Renombrar una etiqueta reescribe los eventos de todas las actividades
    // publicadas (B-04): son N round trips a Calendar, no una escritura.
    timeoutSeconds: 300,
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
    let reescritos = 0;
    let pendientes = 0;

    for (const doc of snap.docs) {
      const ops = replanificarPorEtiquetas(doc.data(), labelsAntes, labels);
      for (const op of ops) {
        if (reescritos >= MAX_EVENTOS_RESYNC) {
          pendientes += 1;
          continue;
        }
        try {
          await cal.events.update({
            calendarId: CALENDAR_ID,
            eventId: op.eventId,
            requestBody: op.evento,
          });
          reescritos += 1;
        } catch (e) {
          // Un evento que falla no puede dejar los otros sin actualizar, igual
          // que en el diff.
          logger.error('falló la re-sincronización de un evento', {
            campo,
            actividad: doc.id,
            sesion: op.id,
            error: e?.message,
          });
        }
      }
    }

    if (pendientes > 0) {
      logger.error('la re-sincronización por etiquetas se cortó por el tope', {
        campo,
        reescritos,
        pendientes,
        tope: MAX_EVENTOS_RESYNC,
      });
    } else if (reescritos > 0) {
      logger.info('eventos re-sincronizados por un cambio de etiqueta', { campo, reescritos });
    }
  },
);
