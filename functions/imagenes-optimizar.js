/**
 * El pipeline de píxeles de B-220 (DEC-7d): sacar los metadatos, recomprimir y
 * derivar la miniatura. **Entra un Buffer y salen Buffers** — no toca Storage ni
 * Firestore, así que se prueba con vitest sin emuladores, que es lo que permite
 * verificar **sobre los bytes de salida** que el EXIF se fue (el mismo criterio
 * de `src/lib/imagenes-archivo.ts`).
 *
 * ── Por qué `sharp` y no otra ─────────────────────────────────────────────
 * Ya está en el árbol: es dependencia opcional de Astro (`sharp@0.34.5` en
 * `package-lock.json`) y por eso pasa por el `npm audit` del proyecto. Pero
 * `functions/` tiene su **propio** `package.json` y su propio `node_modules` en
 * el deploy, así que heredarla del root no alcanza: hay que declararla ahí
 * también, y está declarada. Es la primera dependencia binaria del proyecto y
 * eso cambia el tiempo de deploy de las Functions (está anotado en
 * `docs/08-operacion.md`).
 *
 * ── Qué se saca, y qué se conserva a propósito ────────────────────────────
 * `sharp` **descarta todos los metadatos por defecto**: no hay que pedirle que
 * saque el EXIF, hay que tener cuidado de no pedirle que lo deje (`withMetadata`
 * / `keepExif`, que este archivo no usa). Lo que sí se pide explícito:
 *
 *  - **`.rotate()` sin argumentos** — aplica la orientación del EXIF **antes** de
 *    descartarlo. Sin esto, sacar el EXIF de una foto sacada con el teléfono de
 *    costado la publica girada 90°: el dato que decía cómo mostrarla se fue y el
 *    píxel nunca se movió.
 *  - **`.keepIccProfile()`** — el perfil de color se conserva, misma decisión que
 *    el panel toma con el marcador `0xE2` (`APP_A_TIRAR` no lo incluye):
 *    descartarlo cambia los colores. Un perfil ICC no lleva ubicación, autor ni
 *    fecha; no es de lo que este módulo tiene que proteger.
 */
import sharp from 'sharp';
import {
  ANCHO_MINIATURA,
  CALIDAD_MINIATURA,
  CALIDAD_PRINCIPAL,
  LADO_MAXIMO,
  contentTypeDe,
  formatoDeSalida,
} from './imagenes.js';

/** Fondo con el que se aplana un PNG opaco al pasarlo a JPEG. Ver `formatoDeSalida`. */
const FONDO = { r: 255, g: 255, b: 255 };

/**
 * ¿El original trae bloques de metadatos? Es el `conMetadatos` de
 * `convieneReemplazar`: si trae, se reemplaza aunque no ahorre nada.
 *
 * `comments` entra igual que el EXIF: el comentario libre de un JPEG es texto que
 * escribió el programa que lo exportó y no tiene por qué viajar.
 */
/** @param {{ exif?: unknown, xmp?: unknown, iptc?: unknown, icc?: unknown, comments?: unknown[] }} meta */
export const traeMetadatos = (meta = {}) =>
  Boolean(meta.exif || meta.xmp || meta.iptc || (meta.comments && meta.comments.length));

const codificar = (tubo, formato, calidad) =>
  formato === 'png'
    ? tubo.png({ compressionLevel: 9, effort: 10, palette: true })
    : tubo.flatten({ background: FONDO }).jpeg({ quality: calidad, mozjpeg: true });

/**
 * Lee el original y devuelve todo lo que hace falta para decidir y para escribir.
 *
 * Devuelve las dos salidas **ya codificadas** en vez de un pipeline diferido
 * porque el que decide si vale la pena reemplazar (`convieneReemplazar`) necesita
 * el tamaño del resultado: no hay forma de saber cuánto ahorra una recompresión
 * sin hacerla.
 *
 * `failOn: 'none'` — un JPEG con basura apendada (la imagen secundaria MPF de los
 * Samsung, el trailer de una motion photo: ver `finDelJpeg` en el panel) hace que
 * `sharp` avise, y abortar por eso dejaría sin optimizar justamente a la foto de
 * teléfono, que es la que más lo necesita.
 */
/** @param {Buffer | Uint8Array} bytes */
export const optimizar = async (bytes) => {
  const original = sharp(bytes, { failOn: 'none' });
  const meta = await original.metadata();
  // `stats()` es la única forma de distinguir «declara canal alfa» de «usa el
  // canal alfa». Los tres PNG de producción declaran alfa y son opacos.
  const opaca = meta.hasAlpha ? (await original.stats()).isOpaque : true;
  const formato = formatoDeSalida({ formato: meta.format, opaca });

  const base = () => sharp(bytes, { failOn: 'none' }).rotate();

  const principal = await codificar(
    base().resize({
      width: LADO_MAXIMO,
      height: LADO_MAXIMO,
      fit: 'inside',
      withoutEnlargement: true,
    }),
    formato,
    CALIDAD_PRINCIPAL,
  )
    .keepIccProfile()
    .toBuffer();

  // La miniatura **siempre** sale JPEG: la produce esta Function y su formato lo
  // elige ella (`rutaDeMiniatura` termina en `.jpg`, y de eso depende que el
  // sitio pueda derivar su URL sin write-back). Un PNG con transparencia real
  // aplanado sobre blanco en una miniatura de 480px es un compromiso aceptable
  // que el original no puede hacer.
  const miniatura = await base()
    .resize({ width: ANCHO_MINIATURA, withoutEnlargement: true })
    .flatten({ background: FONDO })
    .jpeg({ quality: CALIDAD_MINIATURA, mozjpeg: true })
    .keepIccProfile()
    .toBuffer();

  return {
    formatoOriginal: meta.format,
    ancho: meta.width ?? null,
    alto: meta.height ?? null,
    opaca,
    conMetadatos: traeMetadatos(meta),
    principal: { datos: principal, contentType: contentTypeDe(formato), formato },
    miniatura: { datos: miniatura, contentType: 'image/jpeg', formato: 'jpeg' },
  };
};
