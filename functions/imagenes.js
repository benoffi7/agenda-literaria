/**
 * Las decisiones de la Function que optimiza las imágenes propias — B-220,
 * DEC-7d, D-175.
 *
 * **Todo lo de acá es puro**: entran datos, sale una decisión. No importa
 * `sharp`, no importa `firebase-functions` y no toca el bucket. El pegamento con
 * Storage vive en `imagenes-trigger.js` y el pipeline de píxeles en
 * `imagenes-optimizar.js`, por el mismo criterio con el que `calendario.js` es
 * puro y `index.js` es el que habla con la red: **lo que decide se puede
 * probar**.
 *
 * ── LA TRAMPA, que es la razón por la que este archivo existe ──────────────
 * Es la **trampa 12** del §13 (y la 3 con otra cara): el trigger es
 * `onObjectFinalized` sobre el bucket, y lo que produce lo escribe **en ese
 * mismo bucket**. Sin guarda se dispara a sí mismo y cada imagen genera objetos
 * hasta que la plataforma corta — con la agravante de que en Storage no hay un
 * `sesiones` que quede igual: cada pasada produce bytes distintos, así que una
 * guarda "no cambió nada" tampoco alcanzaría.
 *
 * DEC-7d nombraba las dos formas conocidas y pedía elegir una. **Se eligieron
 * las dos, y no por prolijidad: cada una tapa un agujero que la otra no puede.**
 *
 *  1. **`customMetadata` en el objeto derivado** (`MARCA_OPTIMIZADA`) — es la
 *     obligatoria, porque la salida principal de esta Function **se escribe
 *     encima del original**. Y se escribe encima a propósito: es lo que hace que
 *     no haga falta el write-back al documento que B-220 daba por bloqueante
 *     (ver `imagenes-trigger.js` § «Por qué se sobreescribe el original»). Con la
 *     derivada en la misma dirección que el disparador, **una guarda por prefijo
 *     es estructuralmente imposible**: no hay prefijo que distinguirlas.
 *
 *  2. **Prefijo separado que el trigger ignora** (`PREFIJO_MINIATURAS`). Hace
 *     falta porque un trigger de Storage v2 **no se puede filtrar por prefijo en
 *     la declaración**: se suscribe al bucket entero, así que cualquier objeto
 *     que aparezca ahí entra al handler y el corte lo tiene que hacer él.
 *
 *     **Pero no es la que corta la miniatura de hoy**, y la primera versión de
 *     este comentario lo decía mal — lo corrigió el `auditor-trampas`. El trigger
 *     escribe la miniatura **marcada**, igual que la salida principal, así que la
 *     corta la marca. Lo que esta guarda cubre es el objeto que aparezca en otro
 *     prefijo **sin** marca: el prefijo que alguien invente mañana, o esta misma
 *     miniatura el día que alguien escriba una derivada y se olvide de marcarla.
 *     Es la guarda que no depende de que nos acordemos de marcar lo que
 *     escribimos, y tiene su propio caso afirmado en el test.
 *
 * Las dos viven en `decidirOptimizacion`, en ese orden, y las dos están probadas
 * en `tests/imagenes-function.test.ts` — incluido el test que **simula la
 * reentrega en un loop** y muere si se saca cualquiera de las dos.
 *
 * ── Medido contra el emulador, y con un hallazgo que hay que tener escrito ──
 * Se corrió el lazo de verdad (emuladores Storage + Functions, una subida real),
 * con la guarda puesta y sacada:
 *
 *  - **con la guarda:** 3 ejecuciones y para — optimiza, se ignora la
 *    reescritura por la marca, se ignora la miniatura por el prefijo.
 *  - **sin la guarda, tal como está el resto del código:** 4 ejecuciones y
 *    **también para**. No por la guarda: para porque la segunda pasada recomprime
 *    un JPEG que ya está en su punto fijo, `convieneReemplazar` dice que no
 *    conviene, y entonces se escribe con `setMetadata` — que dispara
 *    `onObjectMetadataUpdated` y no `onObjectFinalized`.
 *  - **sin la guarda y con `convieneReemplazar` devolviendo `true`:** **5077
 *    ejecuciones en 40 segundos y subiendo**, a razón de ~120 por segundo, a
 *    partir de una sola subida de 2,6 KB.
 *
 * O sea que hoy existe un **segundo freno accidental**, y es exactamente la clase
 * de cosa que este repo no deja implícita: no es una guarda, es la casualidad de
 * que recomprimir sea una contracción y que el umbral de ahorro sea > 0. Un día
 * que `AHORRO_MINIMO` baje a cero, o que el formato de salida deje de converger,
 * el freno desaparece **sin que nada avise**. La única guarda de la que hay que
 * depender es la marca.
 *
 * Por eso la simulación del test halva los bytes en cada pasada y reemplaza
 * siempre: modela el peor caso —«cada pasada produce bytes distintos»— y no el
 * comportamiento amable de hoy.
 */

/**
 * Dónde viven las imágenes que sube el panel. **Tiene que coincidir con
 * `rutaDeImagen` de `src/lib/imagenes-archivo.ts` y con `storage.rules`**, y los
 * ata `tests/imagenes-function.test.ts` leyendo los tres fuentes: es el mismo
 * patrón con el que `MAXIMO_BYTES` está atado a las reglas.
 */
export const PREFIJO_ORIGINALES = 'imagenes/';

/**
 * Dónde va la miniatura. **Hermano de `imagenes/`, no `imagenes/miniaturas/`**,
 * y la diferencia no es estética: `storage.rules` matchea
 * `match /imagenes/{archivo}` —un solo segmento—, así que un `list` del prefijo
 * cae en el `deny` del catch-all. Anidar la miniatura ahí abajo obligaría a
 * escribir `{ruta=**}`, y `tests/storage-reglas.integracion.test.ts` ya tiene
 * anotado, desde antes de que esta Function existiera, que ese es el día en que
 * la trampa 13 se reabre sin que nada avise.
 */
export const PREFIJO_MINIATURAS = 'miniaturas/';

/**
 * La clave de `customMetadata` que marca un objeto ya procesado. **Es la guarda
 * anti-recursión**: si está, el handler corta antes de tocar nada.
 *
 * El valor es la versión del pipeline y no `'true'`, para que se pueda leer en la
 * consola de Storage qué versión produjo cada objeto. **La guarda mira la
 * presencia de la clave, no su valor**: comparar contra la versión de hoy haría
 * que subir `VERSION_PIPELINE` reprocese todo el bucket… una vez por objeto y
 * otra vez por la escritura de ese reproceso, que es exactamente el loop.
 */
export const MARCA_OPTIMIZADA = 'optimizada';

/** Versión del pipeline que produjo el objeto. Informativa; ver arriba. */
export const VERSION_PIPELINE = '1';

/**
 * Lado máximo, en píxeles. Ninguna de las 30 imágenes que hay en producción lo
 * alcanza (la más grande mide 1408 × 768, medido el 2026-09-02), así que hoy
 * **no reescala ninguna**: está para que una foto de 4032 × 3024 recién sacada
 * no entre a 4032 el día que alguien la suba.
 *
 * 1600 y no 1080 porque la portada del detalle se sirve a ancho de columna con
 * tope de alto (`claseAfiche`, D-147) y un flyer **es texto metido adentro de un
 * JPEG**: bajarle la resolución es bajarle la legibilidad, no el peso de una
 * foto.
 *
 * **El reescalado conserva la proporción, y de eso depende que no haga falta
 * write-back.** `ancho`/`alto` del documento se usan para reservar la caja
 * (`proporcionDeAfiche`), o sea como **razón**: `4032 / 3024` y `1600 / 1200`
 * reservan la misma caja. Los números absolutos quedan viejos —está anotado en
 * `docs/03-modelo-de-datos.md`— y no hay ninguna salida que dependa de ellos.
 */
export const LADO_MAXIMO = 1600;

/**
 * Ancho de la miniatura. **Medido, no elegido de memoria** (D-175 § números):
 * con las 30 imágenes de producción, recorrer `/cartelera` entera pasa de
 * **3518,5 KB a 1032,4 KB (−71 %)**.
 *
 * 480 y no 320 (que daba −84 %) por lo mismo que arriba: la pared es de flyers y
 * un flyer es texto. En el teléfono la columna mide ~343 px CSS, así que 480 le
 * deja algo de densidad; en el escritorio a tres columnas, ~380 px.
 */
export const ANCHO_MINIATURA = 480;

/** Calidad JPEG de la salida principal y de la miniatura. */
export const CALIDAD_PRINCIPAL = 82;
export const CALIDAD_MINIATURA = 72;

/**
 * Cuánto tiene que ahorrar la recompresión para justificar reemplazar los bytes
 * originales.
 *
 * **Existe porque se midió y el resultado fue incómodo:** de las 30 imágenes de
 * producción, 29 son JPEG exportados de Instagram y recomprimirlos ahorra entre
 * **0 y 5 %** — y en dos casos el resultado pesa **más** que el original
 * (92,6 → 92,7 KB y 100,9 → 101,1 KB). Recomprimir eso es perder calidad a
 * cambio de nada.
 *
 * La ganancia real está en otro lado y también está medida: el peor caso del
 * sitio (**1091,5 KB**, 11,8× la mediana) es un **PNG**, y reencodearlo a JPEG
 * lo deja en **34,0 KB**. Ver `convieneReemplazar`.
 */
export const AHORRO_MINIMO = 0.05;

/**
 * `Cache-Control` de un objeto **ya optimizado**: un año, inmutable.
 *
 * Y el de la subida es corto a propósito — `CACHE_AL_SUBIR` en
 * `src/lib/imagenes.ts`, atado a este valor por `tests/imagenes-function.test.ts`.
 * El original vive unos segundos antes de que esta Function lo reemplace, y
 * marcarlo `immutable` en esa ventana sería pedirle al CDN y al navegador que se
 * queden **un año** con los bytes que estamos por reemplazar.
 */
export const CACHE_OPTIMIZADO = 'public, max-age=31536000, immutable';

/** Los tipos que esta Function sabe abrir. Los mismos que `TIPOS_SUBIBLES`. */
export const TIPOS_QUE_SE_OPTIMIZAN = ['image/jpeg', 'image/png'];

/** El id de la fila de galería a partir del nombre del objeto. `null` si no tiene forma de id. */
/** @param {string} nombre @returns {string | null} */
export const idDeObjeto = (nombre = '') => {
  if (!nombre.startsWith(PREFIJO_ORIGINALES)) return null;
  const archivo = nombre.slice(PREFIJO_ORIGINALES.length);
  const m = /^(img_[A-Za-z0-9_-]+)\.(?:jpg|png)$/.exec(archivo);
  return m ? m[1] : null;
};

/**
 * Dónde va la miniatura de un original. **Siempre `.jpg`**, sea el original JPG
 * o PNG: la miniatura la produce esta Function y su formato lo elige ella.
 *
 * Es pura y determinística **a propósito**: es lo que permite que el sitio derive
 * la URL de la miniatura de la del original sin que nadie escriba nada en el
 * documento (`urlDeMiniatura` en `src/lib/imagenes.ts`, que la reimplementa sobre
 * la URL pública; las dos derivaciones están atadas por test — clase de B-88).
 */
/** @param {string} nombre @returns {string | null} */
export const rutaDeMiniatura = (nombre = '') => {
  const id = idDeObjeto(nombre);
  return id ? `${PREFIJO_MINIATURAS}${id}.jpg` : null;
};

/**
 * ¿Qué hay que hacer con el objeto que acaba de aparecer en el bucket?
 *
 * **Este es el corte anti-recursión.** El orden de los cortes es el orden en el
 * que hay que leerlos, y los dos primeros son los que impiden el loop:
 *
 *  1. **fuera del prefijo de originales** → la miniatura que acabamos de escribir
 *     en `miniaturas/`, y cualquier prefijo que alguien invente mañana. Un
 *     trigger de Storage v2 no se filtra por prefijo en la declaración: este
 *     `if` **es** el filtro.
 *  2. **ya marcada** → la salida principal, que se escribe **encima del
 *     original** y por lo tanto vuelve a caer en el prefijo de originales. Es el
 *     único corte posible para ese caso.
 *  3. tipo que no sabemos abrir → nada que hacer, y decirlo con un motivo en vez
 *     de tirar.
 *  4. nombre que no tiene forma de id de galería → las reglas no lo dejarían
 *     entrar, pero el Admin SDK sí, y sin id no hay dónde poner la miniatura.
 */
/** @param {{ nombre?: string, contentType?: string, metadatos?: Record<string, string> }} objeto */
export const decidirOptimizacion = (objeto = {}) => {
  const nombre = objeto.nombre ?? '';
  const metadatos = objeto.metadatos ?? {};

  // **Un solo segmento**, igual que `match /imagenes/{archivo}` en
  // `storage.rules`: `imagenes/sub/x.jpg` está "dentro del prefijo" para un
  // `startsWith` y **afuera** para las reglas, que no lo dejarían entrar. Que el
  // corte sea el mismo en los dos lados es lo que hace que "el prefijo"
  // signifique una sola cosa.
  if (!nombre.startsWith(PREFIJO_ORIGINALES) || nombre.includes('/', PREFIJO_ORIGINALES.length)) {
    return { accion: 'ignorar', motivo: 'fuera-del-prefijo' };
  }
  if (metadatos[MARCA_OPTIMIZADA] !== undefined) {
    return { accion: 'ignorar', motivo: 'ya-optimizada' };
  }
  if (!TIPOS_QUE_SE_OPTIMIZAN.includes(objeto.contentType)) {
    return { accion: 'ignorar', motivo: 'tipo-que-no-abrimos' };
  }
  if (!idDeObjeto(nombre)) {
    return { accion: 'ignorar', motivo: 'nombre-sin-forma-de-id' };
  }
  return { accion: 'optimizar', motivo: null };
};

/**
 * ¿Se reemplazan los bytes del original por los recomprimidos?
 *
 * Dos motivos, y el primero manda sobre el segundo:
 *
 *  - **`conMetadatos`** — el original trae EXIF, XMP o IPTC. Se reemplaza
 *    **siempre**, ahorre o no: esta Function es la capa que no se puede saltear
 *    (el panel también los saca, `sinMetadatos`, pero el panel se puede saltear
 *    abriendo la consola del navegador). Una foto de un taller que pasa en una
 *    casa particular lleva las coordenadas de esa casa, y eso no se despublica.
 *  - **ahorro** — solo si baja de `AHORRO_MINIMO`. Recomprimir un JPEG que ya
 *    está bien comprimido pierde calidad para no ahorrar nada, y en producción
 *    eso es el caso de 29 de 30 (ver `AHORRO_MINIMO`).
 *
 * `cambioDeFormato` **no** es un motivo por sí solo: si un PNG con
 * transparencia real se deja en PNG y el PNG optimizado no ahorra, no se toca.
 */
/** @param {{ bytesAntes?: number, bytesDespues?: number, conMetadatos?: boolean }} _ */
export const convieneReemplazar = ({ bytesAntes, bytesDespues, conMetadatos = false } = {}) => {
  if (conMetadatos) return true;
  if (!Number.isFinite(bytesAntes) || !Number.isFinite(bytesDespues)) return false;
  return bytesDespues < bytesAntes * (1 - AHORRO_MINIMO);
};

/**
 * ¿A qué formato sale la imagen principal?
 *
 * **Un PNG opaco sale JPEG, y eso es el 94 % del ahorro de este frente.** Los
 * tres PNG de la página más pesada del sitio (3226,7 KB entre los tres) son
 * ilustraciones de 1024 × 1024 y 1408 × 768 guardadas como PNG: pasan a
 * **184,3 KB** en JPEG y a 403,5 KB si se dejan en PNG optimizado.
 *
 * **Un PNG con transparencia real se queda en PNG.** `isOpaque` y no `hasAlpha`:
 * los tres de producción declaran canal alfa y los tres son **completamente
 * opacos**, así que aplanarlos sobre blanco no cambia un píxel. Uno con
 * transparencia de verdad, aplanado, aparecería con un recuadro blanco sobre el
 * fondo de la página — y el sitio tiene tema claro y oscuro, así que no hay color
 * de fondo correcto que elegir.
 */
/** @param {{ formato?: string, opaca?: boolean }} _ @returns {'jpeg' | 'png'} */
export const formatoDeSalida = ({ formato, opaca } = {}) =>
  formato === 'png' && opaca === false ? 'png' : 'jpeg';

/** `image/jpeg` para el formato de salida. */
/** @param {string} formato */
export const contentTypeDe = (formato) => (formato === 'png' ? 'image/png' : 'image/jpeg');

/**
 * Los `customMetadata` con los que se escribe una derivada.
 *
 * `firebaseStorageDownloadTokens` se **conserva** del original. No hace falta
 * para que la imagen se lea —`allow get: if true` es lo que autoriza, y está
 * verificado contra producción el 2026-09-02: el mismo objeto responde 200 con el
 * token, sin token y con un token inventado— pero la URL que quedó guardada en el
 * documento lo lleva adentro, y volver a escribir el objeto sin él sería cambiar
 * el estado del que esa URL depende sin necesidad. Cuesta una línea.
 */
/**
 * @param {{ token?: string | null, version?: string }} _
 * @returns {Record<string, string>}
 */
export const metadatosDeSalida = ({ token = null, version = VERSION_PIPELINE } = {}) => ({
  [MARCA_OPTIMIZADA]: version,
  ...(token ? { firebaseStorageDownloadTokens: token } : {}),
});
