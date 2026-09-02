/**
 * La galería de imágenes de una actividad (B-167, DEC-7).
 *
 * El modelo pasó de `imagenUrl: string | null` a una **lista**: una actividad
 * tiene el flyer, fotos del espacio y de ediciones anteriores, y B-107 necesita
 * exactamente una para Open Graph. De ahí `portada`, que es un flag explícito y
 * no "la primera": la que uno quiere que aparezca al compartir el link no siempre
 * es la primera que cargó.
 *
 * Todo lo de acá es **puro** y no toca Storage ni Firestore. La subida vive en su
 * propio módulo cargado lazy, por el corte del bundle (B-09/D-51).
 */
import type { Imagen } from '@/types/actividad';

/**
 * Id de una fila de la galería. **Generado en el cliente al crear la fila, nunca
 * por índice del array** — es la trampa 2, la misma que costó el diff de
 * sesiones: borrar la segunda imagen renumera todo y cualquier cosa que compare
 * por posición cree que cambiaron todas.
 *
 * Mismo patrón y mismo fallback que `nuevaSesionId()`.
 */
export const nuevaImagenId = (): string => {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `img_${uuid}`;
};

/**
 * DEC-7b — cuántas por actividad. **El tope lo valida solo el schema, y ahora eso
 * es una decisión y no una promesa incumplida.**
 *
 * DEC-7b pide las dos defensas, schema y reglas, porque el cliente se puede
 * saltear. Con la subida ya implementada, `storage.rules` existe y valida el
 * **tamaño** y el **tipo** — pero no puede validar la **cantidad**: una regla de
 * Storage evalúa una operación sobre un objeto y no puede contar los objetos de un
 * prefijo ni leer la actividad que los va a referenciar. Así que el tope de 4 vive
 * solo acá, y el daño de saltearlo es una actividad con cinco imágenes que el panel
 * no deja guardar; no un objeto de 80 MB en el bucket, que es lo que las reglas sí
 * frenan.
 */
export const MAXIMO_IMAGENES = 4;

/**
 * DEC-7b — tamaño máximo de un archivo propio, en bytes.
 *
 * **El mismo número está en `storage.rules`**, y los ata
 * `tests/storage-reglas.integracion.test.ts` subiendo de verdad contra el
 * emulador: dos constantes que tienen que coincidir y nadie compara terminan
 * divergiendo.
 */
export const MAXIMO_BYTES = 3 * 1024 * 1024;

/**
 * `Cache-Control` con el que el panel sube una imagen propia — B-220, D-175.
 *
 * **Corto a propósito, y es la contracara de una decisión de la Function.** La
 * Function de DEC-7d escribe la imagen optimizada **encima del original** (es lo
 * que hace que no haga falta write-back al documento), así que el objeto que se
 * acaba de subir va a ser reemplazado en unos segundos. Marcarlo `immutable` en
 * esa ventana sería pedirle al CDN y al navegador que se queden **un año** con
 * los bytes que estamos por reemplazar — y un `immutable` es literal, no
 * optimista.
 *
 * Al terminar, la Function pone `CACHE_OPTIMIZADO` (un año, inmutable). Los dos
 * valores están atados por `tests/imagenes-function.test.ts`, que los lee de
 * este archivo y de `functions/imagenes.js`: dos constantes que tienen que
 * encajar y nadie compara terminan divergiendo (clase de B-88).
 *
 * **Modo de falla si la Function no está desplegada:** las imágenes se cachean
 * cinco minutos en vez de un año. Más egreso de GCS, no una imagen rota.
 */
export const CACHE_AL_SUBIR = 'public, max-age=300';

/**
 * El prefijo de las miniaturas que deriva la Function — B-220, D-175.
 *
 * Hermano de `imagenes/` y no anidado, por la trampa 13: ver el comentario de
 * `match /miniaturas/{archivo}` en `storage.rules`.
 */
export const PREFIJO_MINIATURAS = 'miniaturas/';

/**
 * Ancho de la miniatura que deriva la Function, en píxeles — B-220, B-320.
 *
 * **El mismo número está en `functions/imagenes.js`** (`ANCHO_MINIATURA`, que es
 * el que de verdad usa `sharp` para producir el archivo), y los ata
 * `tests/imagenes-function.test.ts` comparando los dos. Sin esa atadura son dos
 * literales que dicen lo mismo por casualidad: el consumidor (`srcset` de
 * `cartelera.astro`) le informa al navegador un ancho que nadie garantiza que
 * coincida con el del archivo real (clase de B-88, la encontró el
 * `auditor-trampas` auditando B-320).
 */
export const ANCHO_MINIATURA = 480;

/**
 * Lado máximo del original que produce la Function, en píxeles — B-220, B-321.
 *
 * **El mismo número está en `functions/imagenes.js`** (`LADO_MAXIMO`, el que
 * `sharp` usa para el `resize` del original), atado por
 * `tests/imagenes-function.test.ts` por el mismo motivo que `ANCHO_MINIATURA`.
 * Es el candidato **grande** del `srcset` de `srcsetDeMiniatura`: no describe
 * el ancho real de cada imagen —`withoutEnlargement` deja las más chicas sin
 * tocar— pero es el tope que sí es cierto para todas.
 */
export const LADO_MAXIMO = 1600;

/**
 * El `srcset` de dos candidatos —la miniatura de la Function y el original—
 * para un `<img>` que sirve una imagen propia. `undefined` si no hay
 * miniatura: una externa (DEC-7d) o una imagen subida antes de que la Function
 * estuviera desplegada, en cuyo caso el atributo tiene que salir **ausente y
 * no vacío** — B-320, B-321.
 *
 * ── Por qué es una función y no un template armado en cada plantilla ───────
 * Lo encontró el `auditor-privacidad` auditando B-320: `urlOriginal` sale del
 * documento tal cual lo guardó quien organiza —`imagenSchema` solo valida
 * `z.string().url()`, nada descarta una coma o un espacio— y una lista de
 * candidatos de `srcset` los usa como separador. Una URL guardada a mano con
 * una coma en la query partiría la lista, y el navegador leería el resto del
 * string como una URL relativa a **nuestro propio origen**. Componer acá, una
 * sola vez, permite blindarlo con un test por **valor** en vez de una
 * afirmación por regex sobre el markup de cada consumidor (hoy dos:
 * `cartelera.astro` y `[slug].astro`).
 *
 * `urlMiniatura` no necesita el mismo blindaje: es una URL que armamos
 * nosotros con `encodeURIComponent` (`urlDeMiniatura`), no texto libre.
 */
export const srcsetDeMiniatura = (
  urlMiniatura: string | null,
  urlOriginal: string,
): string | undefined => {
  if (!urlMiniatura || /[,\s]/.test(urlOriginal)) return undefined;
  return `${urlMiniatura} ${ANCHO_MINIATURA}w, ${urlOriginal} ${LADO_MAXIMO}w`;
};

/** La forma de un nombre de objeto de la galería: `imagenes/img_<uuid>.{jpg,png}`. */
const NOMBRE_DE_IMAGEN = /^imagenes\/(img_[A-Za-z0-9_-]+)\.(?:jpg|png)$/;

/**
 * La ruta de la miniatura de un original. `null` si el path no tiene la forma que
 * produce `rutaDeImagen`.
 *
 * **Siempre `.jpg`**, sea el original JPG o PNG: la miniatura la produce la
 * Function y el formato lo elige ella.
 *
 * Es la **misma derivación** que `rutaDeMiniatura` de `functions/imagenes.js`, y
 * están atadas por test: son un productor y un consumidor que derivan por
 * separado el mismo formato, que es la clase de B-88. La Function no se puede
 * importar desde acá (arrastraría `sharp` al árbol del panel), así que la
 * duplicación es inevitable y lo que se hace es fijarla.
 */
export const rutaDeMiniatura = (storagePath: string | null | undefined): string | null => {
  const m = NOMBRE_DE_IMAGEN.exec((storagePath ?? '').trim());
  return m ? `${PREFIJO_MINIATURAS}${m[1]}.jpg` : null;
};

/**
 * La URL pública de la miniatura, derivada de la del original. `null` si la URL
 * no es una imagen propia nuestra.
 *
 * ── Por qué se puede derivar, que es lo que hace innecesario el write-back ──
 * La URL de descarga lleva el path del objeto URL-encodeado adentro (B-206 #1),
 * y el path de la miniatura es una función pura del path del original. Así que el
 * sitio puede pedir la miniatura **sin que nadie escriba nada en el documento**,
 * que era la mitad de B-220 que quedaba bloqueada.
 *
 * **El token se descarta a propósito.** La miniatura tiene el suyo y no lo
 * conocemos, pero no hace falta ninguno: lo que autoriza la lectura es
 * `allow get: if true`. Verificado contra producción el 2026-09-02 — el mismo
 * objeto responde 200 con su token, **sin token** y con un token inventado.
 *
 * ── Lo que esta función NO puede saber ─────────────────────────────────────
 * Si la miniatura **existe**. Devuelve la URL que le correspondería; una imagen
 * subida antes de que la Function estuviera desplegada no la tiene, y la
 * respuesta a eso es el barrido de `scripts/optimizar-imagenes.mjs`, no un
 * chequeo acá — el build no baja imágenes (DEC-7d) y desde el navegador
 * significaría un pedido de más por afiche.
 */
export const urlDeMiniatura = (url: string | null | undefined): string | null => {
  if (!url) return null;
  let partes: URL;
  try {
    partes = new URL(url);
  } catch {
    return null;
  }
  if (partes.hostname !== 'firebasestorage.googleapis.com') return null;
  // `/v0/b/<bucket>/o/<path encodeado>`. `pathname` conserva el `%2F`, así que el
  // path del objeto es el último segmento.
  const m = /^(\/v0\/b\/[^/]+\/o\/)(.+)$/.exec(partes.pathname);
  if (!m) return null;
  const ruta = rutaDeMiniatura(decodeURIComponent(m[2]!));
  if (!ruta) return null;
  return `${partes.origin}${m[1]}${encodeURIComponent(ruta)}?alt=media`;
};

/**
 * Los tipos que la galería sabe **mostrar**. **SVG no**: es un documento
 * ejecutable, y si algún día se sirve por un rewrite de Hosting pasa a ser mismo
 * origen que el panel.
 *
 * Ojo: lo que se puede **subir** es un subconjunto más chico —`TIPOS_SUBIBLES` en
 * `imagenes-archivo.ts`, hoy JPG y PNG—, porque subir implica poder sacarle los
 * metadatos y eso todavía no está resuelto para WebP ni AVIF. Una externa en esos
 * formatos se muestra igual: la sirve su origen y nosotros no la tocamos (DEC-7d).
 */
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/** Una fila nueva de la galería, para una URL de afuera. */
export const imagenExterna = (url: string, esPrimera: boolean): Imagen => ({
  id: nuevaImagenId(),
  url: url.trim(),
  epigrafe: '',
  origen: 'externa',
  portada: esPrimera,
});

/**
 * La portada de la lista, o `null` si no hay ninguna.
 *
 * Devuelve la **primera** marcada aunque hubiera dos: el schema garantiza que sea
 * una sola, y esta función se usa también sobre datos que todavía no pasaron por
 * el schema (el default de lectura de un documento viejo, la vista previa).
 */
export const portadaDe = (imagenes: readonly Imagen[] = []): Imagen | null =>
  imagenes.find((i) => i.portada) ?? imagenes[0] ?? null;

/**
 * ¿A esta actividad le falta el flyer? — B-264.
 *
 * **Una sola derivación de la condición, usada por tres lados**: el aviso del
 * formulario, la marca del listado del panel y la pared de `/cartelera`. Si cada
 * uno la escribiera por su cuenta, el panel diría «tiene flyer» y la cartelera
 * no lo mostraría, o al revés — que es la clase de B-88 con nombre y apellido.
 *
 * La condición es «no hay portada con dirección», y no «la lista está vacía»: una
 * fila con la URL en blanco existe en el array y no pinta nada en ninguna parte.
 */
export const faltaElFlyer = (imagenes: readonly Imagen[] = []): boolean =>
  !portadaDe(imagenes)?.url?.trim();

/**
 * Marca una imagen como portada y desmarca las demás.
 *
 * Es una sola operación y no dos porque "exactamente una portada" es un
 * invariante: dejarlo en manos de dos llamadas separadas es cómo aparecen los
 * estados con dos portadas o con ninguna.
 */
export const conPortada = (imagenes: readonly Imagen[], id: string): Imagen[] =>
  imagenes.map((i) => ({ ...i, portada: i.id === id }));

/**
 * Saca una fila y **reasigna la portada si era la que se fue**.
 *
 * Sin esto, borrar la portada deja una lista sin ninguna, y B-107 se queda sin
 * imagen para Open Graph sin que nada falle.
 */
export const sinImagen = (imagenes: readonly Imagen[], id: string): Imagen[] => {
  const quedan = imagenes.filter((i) => i.id !== id);
  if (quedan.length === 0 || quedan.some((i) => i.portada)) return quedan;
  return quedan.map((i, n) => ({ ...i, portada: n === 0 }));
};

/**
 * El default de lectura de los documentos que ya están en producción (D-125).
 *
 * Tienen `imagenUrl` y no tienen `imagenes`. **Se resuelve al leer, para siempre**,
 * y no con un script que escriba en producción: nada se pisa, no hay una ventana
 * en la que el panel y el sitio vean cosas distintas, y no hay que acordarse de
 * correr nada antes de deployar.
 *
 * **El id tiene que ser determinístico**, y esto no es un detalle: un uuid nuevo
 * en cada lectura hace que `huboCambioDeContenido` —el que decide si hay algo que
 * guardar y si se escribe una versión al historial— vea un cambio cada vez que se
 * abre el formulario. El centinela fijo dice además, a quien lo mire, que esa fila
 * viene de un documento anterior a la galería.
 */
export const ID_IMAGEN_MIGRADA = 'img_legacy';

export const imagenesDe = (doc: {
  imagenes?: Imagen[];
  imagenUrl?: string | null;
}): Imagen[] => {
  if (doc.imagenes) return doc.imagenes;
  if (!doc.imagenUrl) return [];
  return [
    {
      id: ID_IMAGEN_MIGRADA,
      url: doc.imagenUrl,
      epigrafe: '',
      origen: 'externa',
      portada: true,
    },
  ];
};
