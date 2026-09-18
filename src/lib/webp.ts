/**
 * Lo que un archivo WebP dice de sí mismo, leído del header — B-962.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * Dos reglas del proyecto se afirmaban en prosa y no las verificaba nadie, las
 * dos sobre las imágenes que se commitean a `public/banners/`:
 *
 *  1. **Lo declarado tiene que ser lo que el archivo mide.** `ancho`/`alto` están
 *     en el marcado para reservar el espacio (§CLS), así que declarar 2400×600
 *     sobre un archivo de 1600×400 hace que el navegador reserve un alto que la
 *     imagen no tiene — y el chequeo que había comparaba **la relación**, que en
 *     ese caso da igual (4:1 = 4:1) y pasa en verde.
 *  2. **Una imagen de un tercero no puede llegar a una salida pública con sus
 *     metadatos.** Toda otra imagen de afuera pasa por un saneo obligatorio —la
 *     foto de una propuesta pierde el EXIF con las coordenadas de la casa en
 *     `functions/flyer-de-propuesta.js` (B-896)—, pero **un archivo commiteado a
 *     `public/` no pasa por nada**: ni por el barrido del build (mira `.html`,
 *     `.json`, `.xml` y `.txt`, no binarios) ni por el test del banner, que solo
 *     preguntaba si el archivo existía. Hoy la garantía es que quien lo commitea
 *     se acordó de convertirlo, y «se acordaron de sanear» no es una propiedad
 *     del código.
 *
 * Las dos las marcó el `auditor-privacidad` sobre el mismo cambio que las
 * estrenó.
 *
 * ── Por qué en `src/lib/` y no adentro del test ───────────────────────────
 * Porque es lógica pura sobre bytes y se testea sin disco, que es el corte de
 * siempre (§05-patrones). Y porque el día que haya una segunda imagen propia en
 * `public/` —un OG por defecto, un ícono— la pregunta es la misma.
 *
 * ── El formato, lo justo para contestar esas dos preguntas ────────────────
 * Un WebP es un contenedor RIFF: `RIFF` + tamaño + `WEBP`, y después una lista
 * de chunks de `fourCC` + tamaño + datos (con un byte de relleno si el tamaño es
 * impar). Las medidas salen de dos de ellos:
 *
 *  - **`VP8 `** (lossy, el que produce `cwebp` sin alfa): después del sync code
 *    `9d 01 2a` vienen ancho y alto, 14 bits cada uno.
 *  - **`VP8X`** (el extendido, el único que puede llevar `EXIF`, `XMP ` o
 *    `ICCP`): ancho−1 y alto−1, 24 bits cada uno.
 *  - **`VP8L`** (lossless) empaqueta las medidas en bits y **no se implementa**:
 *    `medidasDeWebp` devuelve `null`, que quien llama tiene que tratar como «no
 *    pude verificar» y **no** como «está bien». Es el modo de falla seguro.
 */

/** Los chunks que llevan metadatos, y que por eso no pueden estar. */
export const CHUNKS_CON_METADATOS = ['EXIF', 'XMP ', 'ICCP'] as const;

const texto = (bytes: Uint8Array, desde: number, largo: number): string =>
  String.fromCharCode(...bytes.slice(desde, desde + largo));

const leerU32 = (bytes: Uint8Array, desde: number): number =>
  bytes[desde]! | (bytes[desde + 1]! << 8) | (bytes[desde + 2]! << 16) | (bytes[desde + 3]! * 2 ** 24);

/** ¿Es un contenedor WebP bien formado, con el tamaño declarado que corresponde? */
export const esWebp = (bytes: Uint8Array): boolean =>
  bytes.length >= 12 &&
  texto(bytes, 0, 4) === 'RIFF' &&
  texto(bytes, 8, 4) === 'WEBP' &&
  leerU32(bytes, 4) + 8 === bytes.length;

/**
 * Los `fourCC` de los chunks, en orden; `null` si el contenedor está roto.
 *
 * Recorre de verdad la lista en vez de buscar el texto `EXIF` en el archivo: un
 * `includes('EXIF')` sobre bytes comprimidos da positivo por casualidad, y el
 * falso rojo de una red es lo que hace que alguien la apague.
 */
export const chunksDeWebp = (bytes: Uint8Array): string[] | null => {
  if (!esWebp(bytes)) return null;
  const chunks: string[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const fourCC = texto(bytes, i, 4);
    const largo = leerU32(bytes, i + 4);
    if (largo < 0 || i + 8 + largo > bytes.length) return null;
    chunks.push(fourCC);
    // Los chunks RIFF se alinean a dos bytes: un tamaño impar lleva relleno.
    i += 8 + largo + (largo % 2);
  }
  return chunks;
};

/**
 * Las medidas reales del archivo, o `null` si no se pudieron leer.
 *
 * `null` es «no pude verificar» y nunca «está bien»: quien llama tiene que
 * tratarlo como un problema. Ver el docblock sobre `VP8L`.
 */
export const medidasDeWebp = (bytes: Uint8Array): { ancho: number; alto: number } | null => {
  if (!esWebp(bytes)) return null;

  let i = 12;
  while (i + 8 <= bytes.length) {
    const fourCC = texto(bytes, i, 4);
    const largo = leerU32(bytes, i + 4);
    const datos = i + 8;
    if (largo < 0 || datos + largo > bytes.length) return null;

    if (fourCC === 'VP8X' && largo >= 10) {
      const ancho = (bytes[datos + 4]! | (bytes[datos + 5]! << 8) | (bytes[datos + 6]! << 16)) + 1;
      const alto = (bytes[datos + 7]! | (bytes[datos + 8]! << 8) | (bytes[datos + 9]! << 16)) + 1;
      return { ancho, alto };
    }
    if (fourCC === 'VP8 ' && largo >= 10) {
      // 3 bytes de frame tag, después el sync code que confirma que estamos parados
      // donde creemos: sin esta comprobación, un archivo raro daría medidas inventadas.
      if (bytes[datos + 3] !== 0x9d || bytes[datos + 4] !== 0x01 || bytes[datos + 5] !== 0x2a) {
        return null;
      }
      const ancho = (bytes[datos + 6]! | (bytes[datos + 7]! << 8)) & 0x3fff;
      const alto = (bytes[datos + 8]! | (bytes[datos + 9]! << 8)) & 0x3fff;
      return { ancho, alto };
    }
    i = datos + largo + (largo % 2);
  }
  return null;
};
