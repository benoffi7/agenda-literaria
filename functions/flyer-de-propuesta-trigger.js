/**
 * **La callable que recibe el flyer de una propuesta** — B-896 paso 1.
 *
 * Es el único endpoint de escritura **anónimo** del proyecto que además recibe
 * bytes, y la pieza que lo hace defendible está en una línea:
 * **`enforceAppCheck: true`**.
 *
 * ── Por qué una callable y no abrir `storage.rules` ───────────────────────
 * Porque el enforcement de App Check es **por servicio, no por path**. Exigirlo
 * en `firebasestorage` para proteger `propuestas/` lo exige también para las
 * lecturas públicas de imágenes —que son un GET anónimo del navegador, sin
 * token— y eso **se lleva puestas todas las fotos del sitio** (B-872). El
 * enforcement de `cloudfunctions` es independiente y no toca ninguna lectura.
 *
 * Lo que se gana es más que lo que se pedía: el endpoint queda atestado de
 * verdad **y** `storage.rules` para `propuestas/` se queda con el `create`
 * cerrado a todo cliente, que es más fuerte que abrirlo.
 *
 * ── La regla que este archivo existe para hacer cumplir ───────────────────
 * **Un cliente se puede saltear el saneado del cliente.** El panel y `/proponer`
 * le sacan los metadatos a la foto antes de mandarla (`sinMetadatos`), y eso
 * sigue estando —es lo que evita que el EXIF con las coordenadas de una casa
 * siquiera *viaje*—, pero como capa de garantía no vale nada: alcanza con abrir
 * la consola del navegador para mandar el archivo crudo. Por eso el saneado
 * **vuelve a correr acá**, sobre los bytes que de verdad llegaron, y con el
 * mismo barrido sobre la salida que hace el panel. La decisión entera está en
 * `flyer-de-propuesta.js`, que es puro y se prueba sin emuladores.
 *
 * ── Verificar esto sin el emulador de Functions (D-660) ───────────────────
 * El CI **no** levanta el emulador de Functions, así que este archivo se queda
 * con lo mínimo que no se puede probar de otra forma —parsear el pedido, llamar
 * a la decisión, escribir el objeto, traducir el rechazo— y todo lo demás vive
 * del otro lado. `tests/flyer-por-callable.test.ts` ejercita la decisión de
 * verdad (con imágenes construidas con `sharp`) y verifica **sobre este fuente**
 * lo único que no es ejecutable: que `enforceAppCheck` esté en `true` y que el
 * nombre que el cliente invoca sea el que `index.js` exporta.
 */
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getStorage } from 'firebase-admin/storage';
import { CUENTA_DE_SERVICIO, REGION } from './despliegue.js';
import {
  metadatosDelFlyer,
  nuevoIdDeFlyer,
  rutaDeFlyer,
  sanearFlyer,
  validarPedido,
  FlyerRechazado,
} from './flyer-de-propuesta.js';

export const subirFlyerDePropuesta = onCall(
  {
    /*
     * Opciones explícitas y no heredadas del `setGlobalOptions()` de `index.js`,
     * por el orden de evaluación de ESM (D-35). El mail de la service account
     * sale de `despliegue.js` y no se escribe literal (B-77).
     */
    region: REGION,
    serviceAccount: CUENTA_DE_SERVICIO,
    /*
     * **Lo que hace que este endpoint no sea un endpoint abierto.** Sin esta
     * línea, cualquiera con la URL de la Function puede mandarle 3 MB por
     * llamada — almacenamiento y egreso facturados, en un proyecto Blaze — y las
     * cinco capas de B-836 se quedan sin la única que frena «al script que no
     * pasa por la página».
     *
     * `consumeAppCheckToken` se deja en su default (`false`): la protección
     * contra reenvío del mismo token cuesta un round trip a Firebase por
     * llamada, y el abuso que importa acá es el volumen, que la atestación ya
     * corta.
     */
    enforceAppCheck: true,
    /*
     * `sharp` decodifica la imagen entera en memoria: 3 MB de JPEG son ~50 MB de
     * bitmap más el encodeado, y acá hay dos encodeados (la principal y la
     * miniatura que `optimizar()` produce y se descarta). Mismo escalón que
     * `optimizarImagen`, por el mismo motivo.
     */
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 5,
  },
  async (peticion) => {
    const pedido = peticion.data ?? {};

    const { bytes, rechazo } = validarPedido(pedido);
    // La `causa` viaja en el `details` para que la analítica del navegador no
    // tenga que deducirla del texto del mensaje (ver `FlyerRechazado`).
    if (rechazo) throw new HttpsError(rechazo.codigo, rechazo.message, { causa: rechazo.causa });

    const crudo = Buffer.from(pedido.datos, 'base64');

    let saneado;
    try {
      saneado = await sanearFlyer(crudo);
    } catch (e) {
      if (e instanceof FlyerRechazado) throw new HttpsError(e.codigo, e.message, { causa: e.causa });
      /*
       * Un fallo de `sharp` que no es un rechazo es nuestro, no de quien manda:
       * se loguea entero y se le contesta lo único cierto y accionable. **No se
       * reenvía el mensaje del decodificador**, que no está escrito para nadie.
       */
      logger.error('el saneado del flyer falló', { error: String(e), bytes });
      throw new HttpsError('internal', 'No pudimos procesar esa imagen. Probá con otra.');
    }

    /*
     * El token se acuña acá porque el Admin SDK **no** lo pone solo, al revés
     * del SDK del navegador que subía antes. Sin él la bandeja se queda sin
     * poder mostrarle el flyer al admin (ver `metadatosDelFlyer`).
     */
    const token = crypto.randomUUID();
    const ruta = rutaDeFlyer(nuevoIdDeFlyer(), saneado.formato);

    await getStorage()
      .bucket()
      .file(ruta)
      .save(saneado.datos, {
        resumable: false,
        metadata: {
          contentType: saneado.contentType,
          metadata: metadatosDelFlyer({ token }),
        },
      });

    logger.info('flyer de propuesta recibido', {
      ruta,
      formatoOriginal: saneado.formatoOriginal,
      formatoSalida: saneado.formato,
      bytesAntes: saneado.bytesAntes,
      bytesDespues: saneado.bytesDespues,
    });

    /*
     * De vuelta va **solo el path**: es lo único que el formulario necesita para
     * guardarlo en el documento (`imagenValida()` no acepta nada más). No se
     * devuelve la URL de descarga — sería acuñarle una capability al anónimo
     * sobre un objeto que, por decisión de DEC-11, solo puede ver un admin.
     */
    return { storagePath: ruta };
  },
);
