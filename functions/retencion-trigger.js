/**
 * B-838 / DEC-13 + B-844 — el barrido que borra las propuestas caducadas,
 * **documento e imagen**: la rechazada a los 30 días del rechazo, y la que nadie
 * tocó a los 30 días de su última señal de vida — el mismo número, otro reloj.
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
        // `candidatas` y no `rechazadas` desde B-844: la query trae los tres
        // estados que caducan, y llamarlas «rechazadas» en el log haría leer
        // mal la única salida que este barrido deja.
        candidatas: propuestas.length,
        motivos,
      });
      return;
    }

    let borradas = 0;
    let objetos = 0;
    let rescatadas = 0;
    /*
     * **Aparte de `rescatadas`, y no es prolijidad** (`auditor-privacidad`).
     * `la-tocaron-tarde` no es una propuesta intacta: el documento se salvó y su
     * foto **ya se borró**. Sumarla a `rescatadas` diría que se salvó entera, y
     * no sumarla a nada —que es lo que hacía— dejaba a la corrida sin contar la
     * única foto de un tercero que destruyó de forma sorprendente. Es el mismo
     * corte que hace el informe del script, a propósito: son dos
     * implementaciones del mismo resumen y no pueden divergir.
     */
    let sinImagen = 0;
    for (const caducada of aBorrar) {
      try {
        const final = await borrarPropuesta(db, bucket, caducada);

        if (final === 'la-tocaron') {
          /*
           * **La propuesta se salvó, y el log lo dice sin drama** (B-864): un
           * admin la tocó entre la query y el borrado, así que el plazo se le
           * renovó y no se tocó nada —ni el documento ni la foto—. Es el
           * resultado correcto, no un fallo, y por eso va `info`: si algún día
           * aparece seguido en los logs, lo que dice es que la bandeja se está
           * mirando justo cuando corre el barrido.
           */
          rescatadas += 1;
          logger.info('propuesta no borrada: la tocaron durante la corrida', {
            propuesta: caducada.id,
            causa: motivos[caducada.id],
          });
          continue;
        }

        if (final === 'la-tocaron-tarde') {
          /*
           * **`warn` y no `info`, y la diferencia importa.** Acá la tocaron en
           * la ventana que queda entre la relectura y el borrado del documento:
           * la precondición salvó el documento, pero el objeto ya se había ido.
           * O sea que una propuesta que un admin acaba de rescatar se queda con
           * el flyer roto — es la cuarta forma de perder la mitad del borrado y
           * la única que este cambio agrega. Cae del lado tolerado por B-838
           * (se ve en la bandeja, no es una foto que nadie puede encontrar) y no
           * se puede arreglar sola, así que se avisa.
           */
          sinImagen += 1;
          // La foto **sí** se fue: entra al conteo de objetos como cualquier
          // otra, que es el único registro de cuánto borró esta corrida.
          if (caducada.objeto) objetos += 1;
          logger.warn('propuesta rescatada en el último segundo: quedó sin su imagen', {
            propuesta: caducada.id,
            conImagen: Boolean(caducada.objeto),
            causa: motivos[caducada.id],
          });
          continue;
        }

        borradas += 1;
        if (caducada.objeto) objetos += 1;
        logger.info('propuesta borrada por retención', {
          propuesta: caducada.id,
          conImagen: Boolean(caducada.objeto),
          // `causa` y no `motivo`: en este dominio «motivo» es el del rechazo,
          // que es una nota interna sobre el trabajo de otra persona y no tiene
          // por qué acercarse a un log (`auditor-privacidad`).
          causa: motivos[caducada.id],
          // `ya-no-esta` es un documento que otra corrida ya se llevó; se cuenta
          // como borrada porque el estado final es el que se quería.
          final,
        });
      } catch (e) {
        // Una que falla no puede cortar el barrido de las demás, y el orden de
        // `borrarPropuesta` (relectura, objeto, documento) hace que un fallo deje
        // las dos mitades en pie para la corrida siguiente.
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
        rescatadas,
        sinImagen,
        pendientesPorTope,
        tope: MAX_PROPUESTAS_POR_CORRIDA,
      });
    } else {
      logger.info('retención de propuestas terminada', {
        borradas,
        objetos,
        /*
         * B-864 — las que se salvaron porque las tocaron mientras el barrido
         * corría (`rescatadas`) y las que se salvaron **sin su imagen**
         * (`sinImagen`, el cuarto final). `borradas + rescatadas + sinImagen`
         * no tiene por qué dar `aBorrar.length`: lo que falta son las que
         * fallaron, y ésas tienen su `error`. La primera versión de este
         * comentario decía eso mismo sin nombrar a `sinImagen`, que también
         * falta de la suma y **no** tiene `error` sino `warn`
         * (`auditor-privacidad`).
         */
        rescatadas,
        sinImagen,
        candidatas: propuestas.length,
      });
    }
  },
);
