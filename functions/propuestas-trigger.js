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
       * `warn` de más abajo —el original queda vivo hasta que el barrido de
       * B-871 se lo lleve, a los 30 días de aceptada— y salir por `debug` los
       * volvía invisibles. Mismo `alerta`, que es lo que hace que **el filtro
       * los junte a los tres** (B-871).
       *
       * Ni el título ni el contacto: el log lleva el id y el motivo, que es
       * vocabulario cerrado (§9 y la fila de `07-seguridad.md`).
       */
      if (dejaLaFoto) {
        logger.warn('una propuesta aceptada se queda con su foto original hasta el barrido de los 30 días', {
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
     * Las ramas de abajo borran el original **sin verificar nada**, que es lo
     * correcto para el rechazo y para el descarte (en los dos la foto se tira a
     * propósito y no hay copia que verificar) y sería el peor bug posible en la
     * aceptación. Con `if`s sueltos y `return`, borrar uno en un refactor haría
     * que una aceptada cayera también en el borrado crudo, con toda la suite en
     * verde. Escrito como bifurcación, eso no se puede.
     *
     * **Son tres ramas desde B-926 y no dos**, y el descarte no se pudo meter en
     * el `else` del rechazo aunque el borrado sea idéntico: lo que cambia es qué
     * pasa **si falla**. El rechazo tiene red —la retención de los 30 días borra
     * el objeto con el documento— y el descarte no: la propuesta queda
     * `aceptada`, que no vence (B-844). Un fallo ahí deja la foto de un tercero
     * para siempre, igual que en la aceptación, así que loguea con `alerta` y no
     * con un `error` pelado. Juntarlas habría hecho que el caso sin red heredara
     * el log del caso con red.
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
         * Pero tampoco es un no-evento: hay **30 días** para decidir si la foto
         * se usa. Si alguien la sube desde el panel, el barrido diario borra el
         * original al día siguiente (B-1370); si no, lo borra igual a los 30
         * días de aceptada (B-871, D-1160) — o sea que pasado ese plazo la foto
         * se pierde. Sale como `warn` con `alerta` para que se pueda filtrar,
         * igual que `rebuild-agotado` (B-21), y es lo que le avisa al dueño que
         * el reloj empezó a correr. El barrido entra por el bucket, así que no
         * depende de que este log se haya visto.
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
         * **No se re-lanza, y desde B-871 el precio es el mismo que en el
         * rechazo.** Hasta ese ítem acá no había red —la `aceptada` no vence
         * (B-844)— y un fallo de Storage o de la lectura dejaba la foto de un
         * tercero en el bucket **para siempre**. Ahora el peor caso es «se borra
         * a los 30 días de aceptada»: el barrido de flyers de B-871 la alcanza
         * entrando por el bucket.
         *
         * Se re-lanza igual el día que este trigger lleve `retry: true`; hoy
         * ninguna Function del proyecto lo usa y encenderlo solo para esta rama
         * reintentaría también cualquier bug del handler durante siete días. La
         * salida elegida es la misma que arriba —`alerta` filtrable— y la red
         * de abajo es la de **B-871**.
         */
        logger.error('no se pudo borrar la imagen original de una propuesta aceptada', {
          propuesta: id,
          objeto,
          actividad: actividadId,
          error: e?.message,
          alerta: 'flyer-de-propuesta-sin-borrar',
        });
      }
    } else if (motivo === 'descartada') {
      try {
        /*
         * **B-926 — la foto que quien revisó decidió no usar.**
         *
         * Borrado crudo y sin verificar ninguna copia, por lo que dice
         * `decidirBorradoDeImagen`: la pregunta que la verificación de B-863
         * hace —«¿quedó una copia?»— acá ya la contestó una persona mirando la
         * foto. `ignoreNotFound` por lo de siempre: la entrega de eventos es al
         * menos una vez.
         */
        await getStorage().bucket().file(objeto).delete({ ignoreNotFound: true });
        logger.info('imagen de una propuesta descartada al convertirla borrada', {
          propuesta: id,
          objeto,
        });
      } catch (e) {
        /*
         * **Con `alerta`, al revés que el rechazo y por el mismo motivo que la
         * aceptación.** La propuesta queda `aceptada`, que no vence (B-844), así
         * que la retención no va a pasar por este documento nunca. Hasta B-871
         * un fallo dejaba la foto de un tercero en el bucket para siempre; desde
         * ese ítem la borra el barrido de flyers a los 30 días de aceptada, que
         * son 30 días de más sobre una foto que una persona ya descartó.
         *
         * Es el mismo estado del mundo que el `warn` de arriba, así que lleva el
         * mismo campo `alerta` — que es lo que hace que el filtro de
         * `08-operacion.md` los junte en vez de tener que buscarlos por separado.
         */
        logger.error('no se pudo borrar la imagen descartada de una propuesta', {
          propuesta: id,
          objeto,
          error: e?.message,
          alerta: 'flyer-de-propuesta-sin-borrar',
        });
      }
    } else if (motivo === 'rechazada') {
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
    } else {
      /*
       * **El `else` final NO borra, y eso cambió con el pase de B-926.**
       *
       * Hasta acá era un catch-all cuyo default era el **borrado crudo**: con
       * tres motivos posibles eso funcionaba, pero el vocabulario de `motivo` es
       * un literal escrito en dos archivos y no una constante compartida, así
       * que un quinto motivo —o un typo al renombrar uno— caía en el borrado
       * irreversible **por default**.
       *
       * Invertido, el default es no hacer nada y avisar. Es la misma dirección
       * que el resto del archivo elige siempre: cuando no se sabe, se conserva la
       * foto. Lleva `alerta` porque el estado del mundo es el de los otros tres —
       * un objeto vivo que solo va a borrar, a los 30 días, el barrido de B-871.
       */
      logger.error('motivo de borrado desconocido: no se toca la imagen', {
        propuesta: id,
        objeto,
        motivo,
        alerta: 'flyer-de-propuesta-sin-borrar',
      });
    }
  },
);
