/**
 * B-89 — barrido periódico que borra las subcolecciones `versiones` que quedaron
 * huérfanas: la actividad se borró, Firestore no borra subcolecciones, y las
 * hasta 20 copias completas del documento —con `online.url` y `difusion`
 * adentro— quedaban para siempre y sin forma de llegar a ellas desde el panel.
 *
 * La decisión de qué purgar es pura y vive en `limpieza-versiones.js`, incluido
 * el porqué esto **no** puede ser un `onDocumentDeleted` (borraría, en carrera,
 * la versión del borrado que B-41 escribe) y el porqué no es la trampa 3 ni la
 * 12. Acá solo se junta lo que hace falta para decidir y se ejecuta lo que la
 * decisión dice — mismo corte que `imagenes-limpieza-trigger.js`.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import {
  decidirPurga,
  MAX_ACTIVIDADES_POR_CORRIDA,
  subcoleccionesHuerfanas,
} from './limpieza-versiones.js';

/** La subcolección del §12. Es la única que cuelga de una actividad. */
const SUB = 'versiones';

/**
 * Un `batch` de Firestore admite 500 operaciones y la retención tope es
 * `MAX_VERSIONES = 20` por actividad (D-42), así que una subcolección entra
 * siempre en un batch. El `slice` es por si alguna quedó de antes de la
 * retención: lo que sobre se purga en la corrida siguiente, igual que en
 * `historial-trigger.js`.
 */
const MAX_BORRADOS_POR_BATCH = 400;

export const limpiarVersionesHuerfanas = onSchedule(
  {
    // Opciones explícitas y no heredadas del `setGlobalOptions` de `index.js`,
    // por el orden de evaluación de ESM (D-35): cuando este módulo se carga,
    // `setGlobalOptions` todavía no corrió.
    region: 'southamerica-east1',
    schedule: 'every 24 hours',
    timeZone: 'America/Argentina/Buenos_Aires',
    // La misma identidad del resto del deploy: solo necesita `datastore.user`,
    // que `calendar-sync@` ya tiene (D-06). No hay IAM nuevo que otorgar.
    serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();
    const referencias = await subcoleccionesHuerfanas(db);

    // Se leen solo los ids y el `guardadoEn`, que es lo único que la decisión
    // mira. Traer el `documento` entero de cada versión sería bajar copias
    // completas de actividades borradas para decidir si se borran.
    const huerfanas = [];
    for (const ref of referencias) {
      const snap = await ref
        .collection(SUB)
        .orderBy(FieldPath.documentId())
        .select('guardadoEn')
        .get();
      huerfanas.push({
        actividadId: ref.id,
        versiones: snap.docs.map((d) => ({ id: d.id, guardadoEn: d.get('guardadoEn') })),
      });
    }

    const { aPurgar, motivos } = decidirPurga({ huerfanas, ahora: Date.now() });

    if (aPurgar.length === 0) {
      logger.debug('barrido de versiones huérfanas: nada para purgar', {
        huerfanas: huerfanas.length,
        motivos,
      });
      return;
    }

    let purgadas = 0;
    let documentos = 0;
    for (const { actividadId, versiones } of aPurgar) {
      try {
        const coleccion = db.collection(`actividades/${actividadId}/${SUB}`);
        const batch = db.batch();
        for (const version of versiones.slice(0, MAX_BORRADOS_POR_BATCH)) {
          batch.delete(coleccion.doc(version));
        }
        await batch.commit();
        purgadas += 1;
        documentos += Math.min(versiones.length, MAX_BORRADOS_POR_BATCH);
        logger.info('subcolección de versiones huérfana purgada', {
          actividad: actividadId,
          versiones: versiones.length,
          motivo: motivos[actividadId],
        });
      } catch (e) {
        // Una que falla no puede cortar el barrido de las demás — mismo criterio
        // que el resto de las Functions con un loop de operaciones.
        logger.error('no se pudo purgar una subcolección de versiones', {
          actividad: actividadId,
          error: e?.message,
        });
      }
    }

    const pendientesPorTope = Object.values(motivos).filter((m) =>
      m.endsWith('-pendiente-por-tope'),
    ).length;
    if (pendientesPorTope > 0) {
      logger.warn('el barrido de versiones se cortó por el tope de la corrida', {
        purgadas,
        documentos,
        pendientesPorTope,
        tope: MAX_ACTIVIDADES_POR_CORRIDA,
      });
    } else {
      logger.info('barrido de versiones huérfanas terminado', {
        purgadas,
        documentos,
        huerfanas: huerfanas.length,
      });
    }
  },
);
