/**
 * B-830 paso 8 / DEC-11 y **B-863** — cerrar una propuesta se lleva la foto que
 * mandó el tercero: al **rechazarla**, en el acto; al **aceptarla**, cuando ya
 * hay una copia promovida que la reemplaza.
 *
 * La decisión es pura y vive en `propuestas.js`, incluido el porqué esto no es
 * la trampa 3 ni la 12, el porqué el borrado del documento **no** entra acá, y
 * el porqué la verificación de la copia va **antes** del borrado del original.
 * Este archivo junta lo que hace falta y ejecuta lo que la decisión dice.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { OPCIONES_BASE } from './despliegue.js';
import { borrarOriginalAlAceptar, decidirBorradoDeImagen } from './propuestas.js';

/**
 * **Se llamaba `borrarImagenAlRechazar` hasta B-863**, y el nombre pasó a mentir
 * el día que el cierre dejó de ser uno solo. Es un solo trigger y no dos a
 * propósito: dos `onDocumentWritten` sobre `propuestas/{id}` serían dos handlers
 * del mismo evento peleándose el mismo objeto, que es el error que B-89
 * documenta.
 *
 * **Al renombrar, la anterior queda desplegada si CI llegó a subirla**: hay que
 * borrarla a mano (`firebase functions:delete borrarImagenAlRechazar`). Mientras
 * tanto conviven sin romper nada —las dos hacen el mismo borrado idempotente en
 * el rechazo, y solo la nueva actúa en la aceptación—, pero es una Function
 * fantasma cobrando invocaciones. Está en `08-operacion.md`.
 */
export const borrarImagenAlCerrar = onDocumentWritten(
  {
    // Explícitas y no heredadas del `setGlobalOptions` de `index.js` — D-35,
    // mismo comentario que el resto de los triggers.
    ...OPCIONES_BASE,
    document: 'propuestas/{id}',
  },
  async (event) => {
    const { id } = event.params;
    const { accion, objeto, motivo, actividadId, dejaLaFoto } = decidirBorradoDeImagen({
      before: event.data?.before?.data() ?? null,
      after: event.data?.after?.data() ?? null,
    });

    if (accion === 'ignorar') {
      /*
       * **Dos niveles y no uno, y lo pidió el `auditor-privacidad`.** Casi todos
       * los «ignorar» son estados sanos —todavía no cerró, no hay imagen
       * propia— y van a `debug`, que Cloud Logging no muestra por defecto. Pero
       * `dejaLaFoto` marca los que ocurren sobre una **aceptada** con un objeto
       * vivo en `propuestas/`: ahí el estado del mundo es el mismo que el del
       * `warn` de más abajo —la aceptada no vence, ningún barrido recorre ese
       * prefijo— y salir por `debug` los volvía invisibles. Mismo `alerta`, que
       * es lo que hace que **el filtro los junte a los tres** (B-871).
       *
       * Ni el título ni el contacto: el log lleva el id y el motivo, que es
       * vocabulario cerrado (§9 y la fila de `07-seguridad.md`).
       */
      if (dejaLaFoto) {
        logger.warn('una propuesta aceptada se queda con su foto original y nadie la va a borrar', {
          propuesta: id,
          motivo,
          alerta: 'flyer-de-propuesta-sin-borrar',
        });
        return;
      }
      logger.debug('propuesta escrita: no hay imagen que borrar', { propuesta: id, motivo });
      return;
    }

    /*
     * **`if/else` y no dos `if` con `return`, y es una guarda estructural.**
     * El `else` de abajo borra el original **sin verificar nada**, que es lo
     * correcto para el rechazo (ahí no hay copia que verificar: la foto se
     * descarta) y sería el peor bug posible en la aceptación. Con dos `if` y un
     * `return`, borrar ese `return` en un refactor haría que una aceptada cayera
     * también en el borrado crudo, con toda la suite en verde. Escrito como
     * bifurcación, eso no se puede.
     */
    if (motivo === 'aceptada') {
      try {
        const resultado = await borrarOriginalAlAceptar(getFirestore(), getStorage().bucket(), {
          objeto,
          actividadId,
        });
        if (resultado === 'borrado') {
          logger.info('imagen original de una propuesta aceptada borrada', {
            propuesta: id,
            objeto,
            actividad: actividadId,
          });
          return;
        }
        /*
         * **No se borró, y eso es lo correcto**: sin copia verificada, borrar el
         * original pierde la foto para siempre (ver `borrarOriginalAlAceptar`).
         * Pero tampoco es un no-evento: la `aceptada` no vence, así que ese
         * original **no lo borra nadie más nunca** —la retención no llega y
         * `limpiarImagenesHuerfanas` no recorre este prefijo—. Sale como `warn`
         * con `alerta` para que se pueda filtrar, igual que `rebuild-agotado`
         * (B-21). Es el agujero de **B-871**, medido en vez de supuesto.
         */
        logger.warn('la aceptada se queda con la foto original: no hay copia que la reemplace', {
          propuesta: id,
          objeto,
          actividad: actividadId,
          resultado,
          alerta: 'flyer-de-propuesta-sin-borrar',
        });
      } catch (e) {
        /*
         * **No se re-lanza, y acá el precio es más caro que en el rechazo, así
         * que va dicho.** Allá el peor caso es «se borra un mes más tarde»,
         * porque la retención de los 30 días es la red. Acá **no hay red**: la
         * `aceptada` no vence (B-844), así que un fallo de Storage o de la
         * lectura deja la foto de un tercero en el bucket **para siempre**, y
         * ningún barrido va a pasar por ahí.
         *
         * Se re-lanza igual el día que este trigger lleve `retry: true`; hoy
         * ninguna Function del proyecto lo usa y encenderlo solo para esta rama
         * reintentaría también cualquier bug del handler durante siete días. La
         * salida elegida es la misma que arriba —`alerta` filtrable— y el ítem
         * que la cierra de verdad es **B-871**.
         */
        logger.error('no se pudo borrar la imagen original de una propuesta aceptada', {
          propuesta: id,
          objeto,
          actividad: actividadId,
          error: e?.message,
          alerta: 'flyer-de-propuesta-sin-borrar',
        });
      }
    } else {
      try {
        /*
         * `ignoreNotFound` por el mismo motivo que en la retención: la entrega
         * de eventos de Firestore es **al menos una vez**, así que este handler
         * puede correr dos veces sobre la misma transición. Borrar lo que ya no
         * está no es un error, es el estado que se quería.
         */
        await getStorage().bucket().file(objeto).delete({ ignoreNotFound: true });
        logger.info('imagen de una propuesta rechazada borrada', { propuesta: id, objeto });
      } catch (e) {
        /*
         * No se re-lanza: reintentar no arregla un permiso ni un path mal
         * escrito, y lo que quedaría es un objeto vivo — que **sí** tiene red, la
         * retención de los 30 días lo borra junto con el documento. Que el peor
         * caso sea «se borra un mes más tarde» es lo que hace que este fallo no
         * tenga que bloquear nada. **Con la aceptada no vale el argumento**, y
         * por eso su rama loguea distinto: ver arriba.
         */
        logger.error('no se pudo borrar la imagen de una propuesta rechazada', {
          propuesta: id,
          objeto,
          error: e?.message,
        });
      }
    }
  },
);
