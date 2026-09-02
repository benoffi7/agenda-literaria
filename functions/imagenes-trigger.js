/**
 * §7 y DEC-7d — la Function que optimiza las imágenes propias (B-220, D-175).
 *
 * ── LA TRAMPA (§13 punto 12, que es la 3 con otra cara) ───────────────────
 * Este trigger escribe en el mismo bucket que lo dispara, así que **sin guarda
 * se dispara a sí mismo** y cada imagen genera objetos hasta que la plataforma
 * corta. Las dos guardas viven en `decidirOptimizacion` (`imagenes.js`) y están
 * explicadas ahí; acá abajo solo se las respeta.
 *
 * La red que lo pide no es este comentario: `tests/clases-de-bug.test.ts`
 * descubre las clases `onObject*` desde antes de que existiera este archivo
 * (D-131 §4) y exige la guarda a todo trigger de Storage que escriba. Y
 * `tests/imagenes-function.test.ts` **simula la reentrega en un loop**: si se
 * saca cualquiera de las dos guardas, el loop no termina y el test se pone rojo.
 *
 * ── Por qué se sobreescribe el original, que es la decisión de fondo ──────
 * B-220 daba por bloqueante el **write-back al documento**: la Function tendría
 * que escribir `storagePath`/`ancho`/`alto` en la fila de la galería, y no puede
 * **encontrar** la actividad porque el path del objeto no lleva su id (y no lo
 * lleva por una razón dura: al subir todavía no hay actividad, D-131 §1).
 *
 * **Sobreescribir el original disuelve el problema en vez de resolverlo.** Si la
 * imagen optimizada queda en la misma dirección:
 *
 *  - la `url` guardada en el documento sigue siendo válida y sigue apuntando a
 *    los bytes buenos, así que no hay nada que escribir;
 *  - **todas las salidas del sitio se benefician sin tocar una plantilla** — la
 *    página de detalle, la cartelera y `og:image` piden la misma URL de siempre
 *    y reciben 184 KB donde antes recibían 3226 KB (los números en D-175);
 *  - `ancho`/`alto` siguen siendo verdad **como razón**, que es lo único para lo
 *    que se usan (`proporcionDeAfiche`), porque el reescalado conserva la
 *    proporción. Los absolutos pueden quedar viejos; está anotado en
 *    `docs/03-modelo-de-datos.md` y no hay salida que dependa de ellos.
 *
 * El precio es que la guarda por prefijo deja de ser posible para la salida
 * principal, y por eso la de `customMetadata` es obligatoria y no opcional.
 *
 * ── El otro precio, y cómo se paga ───────────────────────────────────────
 * El original vive unos segundos antes de ser reemplazado. Si en esa ventana
 * alguien lo pide con `Cache-Control: immutable`, el CDN y ese navegador se
 * quedan **un año** con los bytes viejos. Así que el panel sube con
 * `CACHE_AL_SUBIR` (corto) y esta Function pone `CACHE_OPTIMIZADO` (un año) al
 * terminar. Modo de falla si esta Function no está desplegada: las imágenes se
 * cachean 5 minutos en vez de un año — más egreso, no una imagen rota — y queda
 * en los logs.
 */
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { logger } from 'firebase-functions/v2';
import { getStorage } from 'firebase-admin/storage';
import {
  CACHE_OPTIMIZADO,
  MARCA_OPTIMIZADA,
  decidirOptimizacion,
  convieneReemplazar,
  metadatosDeSalida,
  rutaDeMiniatura,
} from './imagenes.js';
import { optimizar } from './imagenes-optimizar.js';

/**
 * Las opciones van **en el propio trigger** y no heredadas del
 * `setGlobalOptions()` de `index.js`, por lo mismo que `guardarVersion` (D-35):
 * en ESM los imports se evalúan antes del cuerpo del importador, así que cuando
 * este trigger se define, `setGlobalOptions` todavía no corrió — heredarlas lo
 * dejaría en `us-central1` con la service account por defecto.
 *
 * `memory` y `timeoutSeconds` no son heredables igual: `sharp` decodifica la
 * imagen entera en memoria, y 3 MB de JPEG son ~50 MB de bitmap más el
 * encodeado. 512 MiB es holgado y es el escalón más barato que alcanza.
 *
 * `serviceAccount` reusa `calendar-sync@` a propósito, misma razón que las otras
 * cinco: es la única identidad del proyecto que ya tiene los tres roles que un
 * trigger v2 necesita y que hay que otorgar a mano (D-06). **Lo que sí le falta
 * son los permisos sobre el bucket** — están escritos en `docs/08-operacion.md`
 * § «Permisos que necesita `optimizarImagen`»; los otorga el dueño.
 */
export const optimizarImagen = onObjectFinalized(
  {
    region: 'southamerica-east1',
    maxInstances: 5,
    serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (event) => {
    const nombre = event.data.name;
    const decision = decidirOptimizacion({
      nombre,
      contentType: event.data.contentType,
      metadatos: event.data.metadata ?? {},
    });

    if (decision.accion === 'ignorar') {
      // **Esto es la guarda, y el log es su rastro.** `debug` y no `info`: en el
      // caso normal se emite dos veces por imagen subida (la reescritura del
      // original y la miniatura), y son las dos veces en las que la recursión se
      // cortó.
      logger.debug('objeto ignorado', { nombre, motivo: decision.motivo });
      return;
    }

    const bucket = getStorage().bucket(event.data.bucket);
    const original = bucket.file(nombre);
    const [bytes] = await original.download();
    const antes = bytes.length;

    const salida = await optimizar(bytes);
    const token = (event.data.metadata ?? {}).firebaseStorageDownloadTokens ?? null;
    const metadatos = metadatosDeSalida({ token });

    const reemplazar = convieneReemplazar({
      bytesAntes: antes,
      bytesDespues: salida.principal.datos.length,
      conMetadatos: salida.conMetadatos,
    });

    if (reemplazar) {
      // Se escribe **encima**, y eso vuelve a disparar este trigger: la pasada
      // siguiente encuentra `MARCA_OPTIMIZADA` y corta arriba.
      await original.save(salida.principal.datos, {
        resumable: false,
        metadata: {
          contentType: salida.principal.contentType,
          cacheControl: CACHE_OPTIMIZADO,
          metadata: metadatos,
        },
      });
    } else {
      // No conviene tocar los píxeles, pero el objeto igual necesita su
      // `Cache-Control` largo y su marca. `setMetadata` **no** dispara
      // `onObjectFinalized` (dispara `onObjectMetadataUpdated`, al que nadie
      // está suscrito), así que acá no hay recursión que cortar — y aun así la
      // marca queda puesta, que es lo que hace idempotente a una reentrega del
      // mismo evento.
      await original.setMetadata({ cacheControl: CACHE_OPTIMIZADO, metadata: metadatos });
    }

    // La miniatura va a `miniaturas/`, que este mismo trigger ignora por el
    // primer corte de `decidirOptimizacion`.
    const rutaMini = rutaDeMiniatura(nombre);
    await bucket.file(rutaMini).save(salida.miniatura.datos, {
      resumable: false,
      metadata: {
        contentType: salida.miniatura.contentType,
        cacheControl: CACHE_OPTIMIZADO,
        metadata: metadatos,
      },
    });

    logger.info('imagen optimizada', {
      nombre,
      miniatura: rutaMini,
      formatoOriginal: salida.formatoOriginal,
      formatoSalida: salida.principal.formato,
      conMetadatos: salida.conMetadatos,
      reemplazada: reemplazar,
      bytesAntes: antes,
      bytesDespues: reemplazar ? salida.principal.datos.length : antes,
      bytesMiniatura: salida.miniatura.datos.length,
      marca: MARCA_OPTIMIZADA,
    });
  },
);
