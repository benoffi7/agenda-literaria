/**
 * B-838 / DEC-13 + B-844 — el barrido que borra las propuestas caducadas,
 * **documento e imagen**: la rechazada a los 30 días del rechazo, y la que nadie
 * tocó a los 30 días de su última señal de vida — el mismo número, otro reloj.
 *
 * La decisión de qué caducó es pura y vive en `retencion-propuestas.js`,
 * `retencion-flyers.js` y `retencion-fichas.js`; la lectura y el borrado, con el
 * `db` inyectado, en sus `-firestore.js`. El porqué del ciclo entero —incluido
 * por qué esto no es un trigger sobre el rechazo y por qué no es la trampa 3 ni
 * la 12— sigue en el docblock de `retencion.js`. Acá solo se junta lo que hace falta para decidir y se ejecuta lo que la
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
import { COLECCIONES_DE_DIRECTORIO } from './directorios.js';
/*
 * Directo de cada módulo y no de la fachada `retencion.js` (B-1960): el
 * detector de `tests/clases-de-bug.test.ts` sigue los `import { … } from` para
 * armar la traza de cada trigger, y un `export * from` no lo sigue.
 */
import { MAX_PROPUESTAS_POR_CORRIDA, decidirRetencion } from './retencion-propuestas.js';
import { borrarPropuesta, propuestasVencibles } from './retencion-propuestas-firestore.js';
import { MAX_FLYERES_POR_CORRIDA } from './retencion-flyers.js';
import { borrarFlyer, relevarFlyeresSinPlazo } from './retencion-flyers-firestore.js';
import { MAX_FICHAS_POR_CORRIDA, decidirRetencionDeFichas } from './retencion-fichas.js';
import { borrarFicha, fichasVencibles } from './retencion-fichas-firestore.js';
import { MAX_ORIGINALES_POR_CORRIDA, borrarOriginalesConCopia } from './propuestas.js';

/**
 * **B-1370 — el original de una aceptada que sobra porque la foto se subió
 * después.**
 *
 * `borrarImagenAlCerrar` decide una sola vez, en la transición a `aceptada`. Si
 * en ese momento la actividad no tenía copia, conserva el original (`sin-copia`),
 * que es lo correcto. Pero cuando después alguien sube la foto desde el panel,
 * nadie volvía a mirar: la aceptada no vence y `limpiarImagenesHuerfanas` no
 * recorre `propuestas/`. Pasó en los dos casos de B-1322.
 *
 * ── Por qué un barrido y no un trigger sobre `/actividades` ───────────────
 * La otra salida era reintentar el borrado cuando la galería de la actividad
 * gana su primera imagen propia: un tercer `onDocumentWritten` sobre
 * `/actividades` —ya lo escuchan el sync de Calendar y el historial— que tendría
 * que decidir sobre un diff de `imagenes[]` y buscar **qué** propuesta originó
 * la actividad, que la actividad no guarda: una query inversa por
 * `revision.actividadId` en cada escritura de cada actividad, para un caso que
 * pasa dos veces. Y es una pieza más a un write-back de distancia de la trampa 3.
 * Acá la corrida diaria ya existe, ya corre con el permiso de borrar en Storage,
 * ya lee `/propuestas` con `select`, y un día de demora sobre una foto que ya
 * estaba duplicada no cambia nada. Es la salida (b) del ítem (D-890).
 *
 * **No es la trampa 3 ni la 12**, por el mismo argumento que la retención: lo
 * único que escribe es un `delete()` de un objeto bajo `propuestas/`, que emite
 * `onObjectDeleted` —nada del proyecto lo escucha— y no toca ningún documento.
 *
 * **Nunca tira.** Va en el `finally` de la retención y un error suyo no puede
 * tapar el de ella.
 */
const barrerOriginalesConCopia = async (db, bucket) => {
  try {
    const { resultados, errores, pendientes, objetos, porTope } = await borrarOriginalesConCopia(
      db,
      bucket,
    );

    let borrados = 0;
    for (const [propuesta, resultado] of Object.entries(resultados)) {
      if (resultado === 'borrado') {
        borrados += 1;
        logger.info('original de una aceptada borrado: la actividad ya tiene su copia', {
          propuesta,
          objeto: objetos[propuesta],
        });
        continue;
      }
      /*
       * **No se borró, y no es un fallo**: entre la clasificación y el borrado
       * la propuesta cambió, o la verificación de B-863 ya no encontró la copia.
       * El original sigue ahí y la corrida de mañana lo vuelve a mirar, así que
       * no lleva `alerta`: eso queda para los caminos que nadie más va a revisar.
       */
      logger.info('original de una aceptada no borrado: cambió en el medio de la corrida', {
        propuesta,
        resultado,
      });
    }
    for (const [propuesta, error] of Object.entries(errores)) {
      // Sin `alerta` por lo mismo: mañana se reintenta sola.
      logger.error('no se pudo borrar el original de una aceptada con copia', { propuesta, error });
    }

    // Ids y vocabulario cerrado (`clasificarAceptadas`), nunca contenido.
    logger.info('originales de aceptadas: barrido terminado', {
      borrados,
      fallidos: Object.keys(errores).length,
      porTope,
      tope: MAX_ORIGINALES_POR_CORRIDA,
      pendientes,
    });
  } catch (e) {
    logger.error('falló el barrido de originales de aceptadas', { error: e?.message });
  }
};

/**
 * **B-871, salida 3 — los flyers de `propuestas/` que no borraba nadie.**
 *
 * Es la tercera mitad de la corrida, y la única que entra por el **bucket**
 * entero del prefijo: lista los objetos vivos, busca los documentos que los
 * nombran y le pregunta a `decidirFlyeresSinPlazo` —**la misma** decisión que
 * imprime `scripts/borrar-propuestas-vencidas.mjs`— qué hacer con cada uno.
 * Borra dos casos, con la decisión del dueño del 2026-09-25:
 *
 *  - **`aceptada-vencida`** — el original que una aceptada conservó (porque no
 *    había copia verificada, o porque falló el borrado de la transición), a los
 *    **30 días de aceptada** (D-1160);
 *  - **`sin-propuesta`** — el objeto que ningún documento nombra, pasadas las
 *    **72 horas** de gracia de `/proponer` (D-1161).
 *
 * El resto no lo toca: el flyer de una `nueva`, `en-revision` o `rechazada` es
 * de la retención de arriba, que se lo lleva con su documento.
 *
 * ── Va después de `barrerOriginalesConCopia`, y el orden no es casual ─────
 * B-1370 borra **hoy** el original de una aceptada cuya actividad ya tiene la
 * copia; esto lo borraría recién al día 30. Como esto relista el bucket, lo que
 * B-1370 ya se llevó no aparece acá — y si apareciera, `ignoreNotFound` lo
 * vuelve inofensivo.
 *
 * ── Lo que necesita a alguien avisa, todos los días ───────────────────────
 * `aRevisar` son flyers que **ningún** barrido va a borrar —el caso que el
 * dueño pidió explícito es la aceptada sin fecha de aceptación legible— y salen
 * con `alerta: 'flyer-de-propuesta-sin-borrar'`, el mismo campo que el trigger de
 * la transición: es el mismo estado del mundo, y la alerta de GCP ya lo toma
 * (`08-operacion.md` § «La alerta de todas las `alerta`»). Se repite cada día
 * hasta que alguien lo arregle, que es la diferencia con el `warn` de la
 * transición: aquél se emite una vez y se pierde.
 *
 * **No es la trampa 3 ni la 12**: lo único que escribe es un `delete()` de un
 * objeto bajo `propuestas/` —`onObjectDeleted`, que nadie escucha— y no toca
 * ningún documento (ver `borrarFlyer`).
 *
 * **Nunca tira**, por lo mismo que `barrerOriginalesConCopia`: va en el
 * `finally` de la retención y un error suyo no puede tapar el de ella.
 */
const barrerFlyeresDePropuestas = async (db, bucket) => {
  try {
    const { aBorrar, aRevisar, motivos, objetos } = await relevarFlyeresSinPlazo(db, bucket);

    for (const f of aRevisar) {
      // El `objeto` sí va: salió del listado del bucket y pasó la guarda del
      // prefijo, así que es un flyer de propuesta y no «un path que no sabemos
      // de quién es» (el caso por el que el trigger no lo loguea).
      logger.warn('flyer de propuesta que no va a borrar nadie', {
        objeto: f.objeto,
        propuesta: f.propuesta,
        motivo: f.motivo,
        alerta: 'flyer-de-propuesta-sin-borrar',
      });
    }

    let borrados = 0;
    let intactos = 0;
    let fallidos = 0;
    for (const flyer of aBorrar) {
      try {
        const final = await borrarFlyer(db, bucket, flyer);
        if (final === 'borrado') {
          borrados += 1;
          logger.info('flyer de propuesta borrado', {
            objeto: flyer.objeto,
            propuesta: flyer.propuesta,
            // `causa` y no `motivo`, como en la retención: en este dominio
            // «motivo» es el del rechazo.
            causa: flyer.motivo,
          });
          continue;
        }
        /*
         * `la-tocaron` (reabrieron o re-aceptaron la propuesta en el medio de la
         * corrida) o `lo-nombran` (llegó el documento del huérfano). No se tocó
         * nada, y mañana se vuelve a decidir con datos frescos.
         */
        intactos += 1;
        logger.info('flyer de propuesta no borrado: cambió en el medio de la corrida', {
          objeto: flyer.objeto,
          propuesta: flyer.propuesta,
          final,
        });
      } catch (e) {
        // Sin `alerta`: el objeto sigue vivo y la corrida de mañana lo reintenta.
        fallidos += 1;
        logger.error('no se pudo borrar un flyer de propuesta', {
          objeto: flyer.objeto,
          propuesta: flyer.propuesta,
          error: e?.message,
        });
      }
    }

    const pendientesPorTope = Object.values(motivos).filter((m) =>
      m.endsWith('-pendiente-por-tope'),
    ).length;
    const resumen = {
      objetos,
      borrados,
      intactos,
      fallidos,
      aRevisar: aRevisar.length,
      pendientesPorTope,
      tope: MAX_FLYERES_POR_CORRIDA,
    };
    if (pendientesPorTope > 0) {
      logger.warn('el barrido de flyers de propuestas se cortó por el tope de la corrida', resumen);
    } else {
      logger.info('flyers de propuestas: barrido terminado', resumen);
    }
  } catch (e) {
    logger.error('falló el barrido de flyers de propuestas', { error: e?.message });
  }
};

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

    /*
     * **Tres barridos en la misma corrida, y los dos últimos van en el
     * `finally`** — B-1370 y B-871. El de arriba es la retención de siempre; el
     * segundo borra el original que una aceptada conservó porque la actividad
     * todavía no tenía copia, cuando la copia **ya existe**
     * (`barrerOriginalesConCopia`); el tercero borra los flyers de `propuestas/`
     * que no tienen quien los borre —el original de una aceptada a los 30 días,
     * el huérfano a las 72 horas— (`barrerFlyeresDePropuestas`). Van en el
     * `finally` para que corran también cuando la retención no tiene nada que
     * borrar (sale por `return`) y cuando falla (el error se sigue propagando,
     * pero las otras mitades no se quedan sin barrer). Ninguno de los dos tira.
     */
    try {
      /*
       * **Un solo reloj para las dos llamadas** (B-865). La lectura ya no trae la
       * bandeja entera: pide páginas hasta que las candidatas llenan el tope de
       * borrados, y para saber cuándo parar le pregunta a esta misma decisión
       * pura. Con dos `Date.now()` distintos podría cortar de leer con un juicio y
       * borrar con otro.
       */
      const ahora = Date.now();
      const propuestas = await propuestasVencibles(db, { ahora });
      const { aBorrar, motivos } = decidirRetencion({ propuestas, ahora });

      if (aBorrar.length === 0) {
        // `motivos` lleva ids y el motivo, nunca contenido: el contacto de quien
        // propuso ni siquiera se leyó (`propuestasVencibles` usa `select`).
        logger.debug('retención de propuestas: nada que borrar', {
          // `candidatas` y no `rechazadas` desde B-844: la query trae los tres
          // estados que caducan, y llamarlas «rechazadas» en el log haría leer
          // mal la única salida que este barrido deja. **En esta rama son la
          // colección entera** (B-865): sin nada que borrar, la lectura no tuvo
          // dónde cortar. En la otra son las leídas hasta llenar el tope.
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

      /*
       * **Es un piso y no un total** (B-865): son las vencidas que esta corrida
       * **vio** y no va a borrar. Desde que la lectura corta apenas junta el tope,
       * lo que queda después del cursor ni siquiera se leyó, así que puede haber
       * más. Sirve igual para lo que este `warn` existe —«hoy no alcanzó»— y
       * decirlo evita leerlo como «faltan exactamente tres».
       */
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
          // **Las leídas, no las que hay** (B-865): con trabajo por delante la
          // lectura corta apenas llena el tope, así que esto es «hasta acá miré» y
          // no el tamaño de la bandeja.
          candidatas: propuestas.length,
        });
      }
    } finally {
      await barrerOriginalesConCopia(db, bucket);
      // B-871 — después de B-1370, que borra antes lo que ya tiene copia.
      await barrerFlyeresDePropuestas(db, bucket);
    }
  },
);

/**
 * **B-904 / B-912 / B-917 — el barrido de las tres guías.**
 *
 * Una sola Function para las tres colecciones, que es lo que B-904 pedía, y la
 * lista sale de `COLECCIONES_DE_DIRECTORIO`: la cuarta guía entra sola. La
 * decisión de qué caducó es pura y vive en `retencion.js`, incluido el porqué
 * este barrido **no toca Storage** —las fotos de una ficha viven en `imagenes/`
 * y las levanta `limpiarImagenesHuerfanas` desde B-922—.
 *
 * ── Por qué es una Function aparte y no un `for` adentro de la de arriba ──
 * Porque son dos vocabularios de estado, dos tablas de plazos y dos formas de
 * borrar (allá el objeto de Storage va primero y sin precondición; acá no hay
 * objeto). Meterlas en la misma corrida las ataría a compartir tope, log y
 * destino del fallo: una colección que falla no puede dejar sin barrer a las
 * otras tres, y menos a las propuestas, que son el dato personal más antiguo del
 * proyecto. Lo que **sí** se comparte es la decisión pura, que es donde están
 * las propiedades que costaron cuatro ítems cada una.
 *
 * El tope es **por colección** y por eso el bucle no lleva un acumulado global:
 * cada directorio tiene su propia bandeja y su propio ritmo.
 *
 * ── ⚠️ Y acá SÍ hay un trigger del otro lado, al revés que en `/propuestas` ─
 * Lo encontró el `auditor-trampas`. El docblock de `retencion.js` dice, para el
 * barrido de propuestas, que no es la trampa 3 ni la 12 porque `/propuestas` es
 * «una colección que **ningún trigger escucha**». **Eso no vale acá**:
 * `/librerias`, `/suscripciones` y `/lugares` tienen cada una su
 * `onDocumentWritten` de rebuild (`directorios-trigger.js`), y
 * `onDocumentWritten` se dispara también en un `delete`.
 *
 * **No es un loop** —la trampa 3 pide que el trigger escriba donde lo
 * dispararon, y `marcarRebuild` escribe en `sistema/rebuild`, no en la ficha
 * borrada— así que no hay con qué encadenarse. Lo que sí hay es un **build de
 * más**: `cambioAmeritaRebuild` devuelve `true` ante cualquier alta o baja sin
 * mirar el estado, así que borrar una ficha `rechazado` que **nunca estuvo
 * publicada** marca el sitio para rehacer aunque no haya nada público que
 * cambiar.
 *
 * Se acepta, y con el argumento que ese módulo ya tiene escrito: «un falso
 * positivo cuesta un build, que es el lado barato». Queda dicho acá porque sin
 * esta línea, quien investigue «¿por qué se rebuildeó el sitio a las 3 de la
 * mañana sin que nadie publicara nada?» no tiene dónde encontrarlo — y porque
 * la respuesta más obvia («ningún trigger escucha esas colecciones») es falsa.
 */
export const borrarFichasVencidas = onSchedule(
  {
    region: REGION,
    schedule: 'every 24 hours',
    timeZone: 'America/Argentina/Buenos_Aires',
    /*
     * La misma identidad del resto del deploy. Necesita `datastore.user` y nada
     * más: a diferencia de `borrarPropuestasVencidas`, este barrido no borra
     * objetos, así que ni siquiera usa el permiso de Storage. **No hay IAM nuevo
     * que otorgar.**
     */
    serviceAccount: CUENTA_DE_SERVICIO,
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();
    // Un solo reloj para las cuatro llamadas de cada colección, por lo mismo que
    // arriba: la lectura corta consultando la misma decisión que después borra.
    const ahora = Date.now();

    for (const coleccion of COLECCIONES_DE_DIRECTORIO) {
      try {
        const fichas = await fichasVencibles(db, coleccion, { ahora });
        const { aBorrar, motivos } = decidirRetencionDeFichas({ fichas, ahora });

        if (aBorrar.length === 0) {
          // `motivos` lleva ids y el motivo, nunca contenido: el contacto de
          // quien cargó la ficha ni siquiera se leyó (`fichasVencibles` usa
          // `select`).
          logger.debug('retención de la guía: nada que borrar', {
            coleccion,
            candidatas: fichas.length,
            motivos,
          });
          continue;
        }

        let borradas = 0;
        let rescatadas = 0;
        for (const caducada of aBorrar) {
          try {
            const final = await borrarFicha(db, coleccion, caducada);

            if (final === 'la-tocaron') {
              /*
               * La ficha se salvó y el log lo dice sin drama: un admin la tocó
               * entre la query y el borrado, así que el plazo se le renovó y no
               * se tocó nada. Es el resultado correcto, no un fallo — y acá, a
               * diferencia de una propuesta, se salvó **entera**: no hay ninguna
               * foto que se haya ido por delante.
               */
              rescatadas += 1;
              logger.info('ficha no borrada: la tocaron durante la corrida', {
                coleccion,
                ficha: caducada.id,
                causa: motivos[caducada.id],
              });
              continue;
            }

            borradas += 1;
            logger.info('ficha borrada por retención', {
              coleccion,
              ficha: caducada.id,
              // `causa` y no `motivo`: en este dominio «motivo» es el del
              // rechazo, que es una nota interna sobre el trabajo de otra
              // persona y no tiene por qué acercarse a un log.
              causa: motivos[caducada.id],
              // `ya-no-esta` es un documento que otra corrida ya se llevó; se
              // cuenta como borrada porque el estado final es el que se quería.
              final,
            });
          } catch (e) {
            // Una que falla no puede cortar el barrido de las demás.
            logger.error('no se pudo borrar una ficha vencida', {
              coleccion,
              ficha: caducada.id,
              error: e?.message,
            });
          }
        }

        /*
         * Es un piso y no un total, como en las propuestas: son las vencidas que
         * esta corrida **vio** y no va a borrar. Lo que queda después del cursor
         * ni siquiera se leyó.
         */
        const pendientesPorTope = Object.values(motivos).filter((m) =>
          m.endsWith('-pendiente-por-tope'),
        ).length;
        if (pendientesPorTope > 0) {
          logger.warn('la retención de la guía se cortó por el tope de la corrida', {
            coleccion,
            borradas,
            rescatadas,
            pendientesPorTope,
            tope: MAX_FICHAS_POR_CORRIDA,
          });
        } else {
          logger.info('retención de la guía terminada', {
            coleccion,
            borradas,
            rescatadas,
            // Las leídas, no las que hay: con trabajo por delante la lectura
            // corta apenas llena el tope.
            candidatas: fichas.length,
          });
        }
      } catch (e) {
        /*
         * **Y el `try` abarca la colección entera, no solo el borrado.** Si la
         * query de `/librerias` falla, `/suscripciones` y `/lugares` se tienen
         * que barrer igual: son tres bandejas independientes y un plazo que se
         * deja de cumplir es un dato personal que se queda de más.
         */
        logger.error('falló la retención de una colección de la guía', {
          coleccion,
          error: e?.message,
        });
      }
    }
  },
);
