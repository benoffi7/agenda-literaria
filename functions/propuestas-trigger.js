/**
 * B-830 paso 8 / DEC-11 — rechazar una propuesta borra su imagen en el acto.
 *
 * La decisión es pura y vive en `propuestas.js`, incluido el porqué esto no es
 * la trampa 3 ni la 12 y el porqué el borrado del documento **no** entra acá.
 * Este archivo junta lo que hace falta y ejecuta lo que la decisión dice.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getStorage } from 'firebase-admin/storage';
import { OPCIONES_BASE } from './despliegue.js';
import { decidirBorradoDeImagen } from './propuestas.js';

export const borrarImagenAlRechazar = onDocumentWritten(
  {
    // Explícitas y no heredadas del `setGlobalOptions` de `index.js` — D-35,
    // mismo comentario que el resto de los triggers.
    ...OPCIONES_BASE,
    document: 'propuestas/{id}',
  },
  async (event) => {
    const { id } = event.params;
    const { accion, objeto, motivo } = decidirBorradoDeImagen({
      before: event.data?.before?.data() ?? null,
      after: event.data?.after?.data() ?? null,
    });

    if (accion === 'ignorar') {
      // Ni el título ni el contacto: el log lleva el id y el motivo, que es
      // vocabulario cerrado (§9 y la fila de `07-seguridad.md`).
      logger.debug('propuesta escrita: no hay imagen que borrar', { propuesta: id, motivo });
      return;
    }

    try {
      /*
       * `ignoreNotFound` por el mismo motivo que en la retención: la entrega de
       * eventos de Firestore es **al menos una vez**, así que este handler puede
       * correr dos veces sobre la misma transición. Borrar lo que ya no está no
       * es un error, es el estado que se quería.
       */
      await getStorage().bucket().file(objeto).delete({ ignoreNotFound: true });
      logger.info('imagen de una propuesta rechazada borrada', { propuesta: id, objeto });
    } catch (e) {
      /*
       * No se re-lanza: reintentar no arregla un permiso ni un path mal escrito,
       * y lo que quedaría es un objeto vivo — que **sí** tiene red, la retención
       * de los 30 días lo borra junto con el documento. Que el peor caso sea «se
       * borra un mes más tarde» es lo que hace que este fallo no tenga que
       * bloquear nada.
       */
      logger.error('no se pudo borrar la imagen de una propuesta rechazada', {
        propuesta: id,
        objeto,
        error: e?.message,
      });
    }
  },
);
