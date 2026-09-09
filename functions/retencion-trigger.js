/**
 * B-838 / DEC-13 — el barrido que borra las propuestas rechazadas a los 30 días,
 * **documento e imagen**.
 *
 * La decisión de qué caducó es pura y vive en `retencion.js`, incluido el porqué
 * esto no es un trigger sobre el rechazo y el porqué no es la trampa 3 ni la 12.
 * Acá solo se junta lo que hace falta para decidir y se ejecuta lo que la
 * decisión dice — mismo corte que `versiones-limpieza-trigger.js` y que
 * `imagenes-limpieza-trigger.js`.
 *
 * **Por qué es el paso 11 y corre antes que el 8 y el 9:** decisión del dueño
 * (B-843 punto 1). El proyecto ya puede guardar el mail o el WhatsApp de un
 * tercero —el camino de admin existe desde el paso 5— y hasta que esta Function
 * existió la única forma de honrar un «borrame» era un script con el Admin SDK
 * que nadie escribió. La excepción del borrado va antes que el dato.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { CUENTA_DE_SERVICIO, REGION } from './despliegue.js';
import {
  MAX_PROPUESTAS_POR_CORRIDA,
  borrarPropuesta,
  decidirRetencion,
  propuestasVencibles,
} from './retencion.js';

export const borrarPropuestasVencidas = onSchedule(
  {
    // Opciones explícitas y no heredadas del `setGlobalOptions` de `index.js`,
    // por el orden de evaluación de ESM (D-35). El mail de la service account
    // sale de `despliegue.js` y no se escribe literal (B-77). `OPCIONES_BASE`
    // entero no aplica: `maxInstances` no tiene sentido en un schedule, que no
    // concurre consigo mismo.
    region: REGION,
    schedule: 'every 24 hours',
    timeZone: 'America/Argentina/Buenos_Aires',
    /*
     * La misma identidad del resto del deploy. Necesita `datastore.user` —que ya
     * tiene (D-06)— y, para la mitad de Storage, `storage.objects.delete`, que
     * es el mismo permiso que ya usa `limpiarImagenesHuerfanas` y que
     * `roles/storage.objectUser` incluye. **No hay IAM nuevo que otorgar**, y
     * `docs/08-operacion.md` lo dice para que no se busque.
     */
    serviceAccount: CUENTA_DE_SERVICIO,
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();

    const propuestas = await propuestasVencibles(db);
    const { aBorrar, motivos } = decidirRetencion({ propuestas, ahora: Date.now() });

    if (aBorrar.length === 0) {
      // `motivos` lleva ids y el motivo, nunca contenido: el contacto de quien
      // propuso ni siquiera se leyó (`propuestasVencibles` usa `select`).
      logger.debug('retención de propuestas: nada que borrar', {
        rechazadas: propuestas.length,
        motivos,
      });
      return;
    }

    let borradas = 0;
    let objetos = 0;
    for (const caducada of aBorrar) {
      try {
        await borrarPropuesta(db, bucket, caducada);
        borradas += 1;
        if (caducada.objeto) objetos += 1;
        logger.info('propuesta rechazada borrada por retención', {
          propuesta: caducada.id,
          conImagen: Boolean(caducada.objeto),
          // `causa` y no `motivo`: en este dominio «motivo» es el del rechazo,
          // que es una nota interna sobre el trabajo de otra persona y no tiene
          // por qué acercarse a un log (`auditor-privacidad`).
          causa: motivos[caducada.id],
        });
      } catch (e) {
        // Una que falla no puede cortar el barrido de las demás, y el orden de
        // `borrarPropuesta` (objeto primero) hace que un fallo deje las dos
        // mitades en pie para la corrida siguiente.
        logger.error('no se pudo borrar una propuesta vencida', {
          propuesta: caducada.id,
          error: e?.message,
        });
      }
    }

    const pendientesPorTope = Object.values(motivos).filter((m) =>
      m.endsWith('-pendiente-por-tope'),
    ).length;
    if (pendientesPorTope > 0) {
      logger.warn('la retención de propuestas se cortó por el tope de la corrida', {
        borradas,
        objetos,
        pendientesPorTope,
        tope: MAX_PROPUESTAS_POR_CORRIDA,
      });
    } else {
      logger.info('retención de propuestas terminada', {
        borradas,
        objetos,
        rechazadas: propuestas.length,
      });
    }
  },
);
