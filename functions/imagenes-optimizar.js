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
 * ¿El original trae bloques de metadatos, según `sharp`? Es la mitad fácil del
 * `conMetadatos` de `convieneReemplazar`.
 *
 * `comments` entra igual que el EXIF: el comentario libre de un JPEG es texto que
 * escribió el programa que lo exportó y no tiene por qué viajar. El **perfil
 * ICC** no entra: descartarlo cambia los colores y no lleva ubicación, autor ni
 * fecha (misma decisión que el panel toma con el marcador `0xE2`).
 */
/** @param {{ exif?: unknown, xmp?: unknown, iptc?: unknown, icc?: unknown, comments?: unknown[] }} meta */
export const traeMetadatos = (meta = {}) =>
  Boolean(meta.exif || meta.xmp || meta.iptc || (meta.comments && meta.comments.length));

// ─────────────────────────────────────────────────────────────────────
// «Si no lo entendemos, se recomprime» — la otra mitad de `conMetadatos`
// ─────────────────────────────────────────────────────────────────────

/**
 * Los bloques que `sharp` **no reporta** y que este pipeline tiene que tratar
 * como metadatos igual. Lo encontró el `auditor-privacidad`, y el agujero era
 * concreto y permanente.
 *
 * `sharp.metadata()` informa `exif`, `xmp`, `iptc` y `comments`, y con eso
 * `traeMetadatos` alcanza para lo que sabe mirar. **No informa** lo que el
 * docblock de `finDelJpeg` (`src/lib/imagenes-archivo.ts`) documenta como el
 * motivo de existir de ese módulo:
 *
 *  - **lo que viene después del EOI real** — la imagen secundaria MPF de los
 *    Samsung y varios Android, que es un JPEG completo **con su propio APP1 y su
 *    propio GPS**; el MP4 de una motion photo, con su atom de ubicación; el
 *    trailer `SEFH`;
 *  - **los APPn que no conocemos** — APP2 con índice MPF, APP4–APP12, o el
 *    thumbnail `JFXX` de APP0, que es una miniatura del original **antes de
 *    cualquier recorte**.
 *
 * **Por qué era permanente y no un caso perdido.** Si el bloque no lo ve
 * `metadata()`, `convieneReemplazar` cae al criterio de ahorro; un JPEG que ya
 * está por debajo de 1600 px y bien comprimido no ahorra el 5 %, se toma la rama
 * que **no toca los bytes**… y se le escribe la marca igual. Como la guarda
 * anti-recursión es por presencia de la marca, ese objeto quedaba **exento para
 * siempre** del trigger y del barrido de `scripts/optimizar-imagenes.mjs`: un
 * archivo que nunca se saneó, marcado como saneado.
 *
 * En muchos casos el trailer infla `bytesAntes` y el ahorro dispara el reemplazo
 * por casualidad. Es el mismo freno accidental que este frente ya se negó a dar
 * por bueno para la recursión, y por el mismo motivo no se da por bueno acá.
 *
 * **Costo real, medido:** de los 29 JPEG de producción, 28 traen solo APP0
 * (JFIF) y uno trae además APP2 con el perfil ICC. Ninguno tiene cola después
 * del EOI ni ningún APPn desconocido, así que esta regla **no recomprime ni una
 * imagen más** de las que ya están — y cierra el caso de la primera foto de
 * teléfono que se suba.
 */
const BLOQUES_CONOCIDOS = {
  // Densidad. La firma lleva el NUL a propósito: así `JFXX` —el thumbnail de
  // APP0, que es una imagen adentro de la imagen y de **antes** de cualquier
  // recorte— no matchea, y es justo el que no hay que dejar pasar.
  0xe0: ['JFIF\u0000'],
  // Perfil de color. `MPF\u0000` **no**: es el índice multi-imagen.
  0xe2: ['ICC_PROFILE\u0000'],
  // Sin él, un JPEG CMYK se ve invertido.
  0xee: ['Adobe'],
};

const arranca = (b, desde, firma) => {
  for (let i = 0; i < firma.length; i++) {
    if (b[desde + i] !== firma.charCodeAt(i)) return false;
  }
  return true;
};

/**
 * ¿Se puede dar cuenta de **todos** los bytes del archivo?
 *
 * `false` significa «acá hay algo que no sabemos leer», y el llamador lo trata
 * como metadatos: recomprime. Falla cerrado a propósito, la misma elección que
 * hizo `quedanMetadatos` en el panel — una foto recomprimida de más es un
 * problema de nadie; una foto con las coordenadas de una casa particular
 * publicada no se despublica.
 *
 * El recorrido respeta las tres cosas que hacen que `FF D9` no se pueda buscar a
 * lo bruto, igual que `finDelJpeg`: el **byte stuffing** (`FF 00`), los
 * marcadores de **reinicio** (`FF D0`–`FF D7`) y los segmentos que un JPEG
 * **progresivo** intercala entre scans, que se saltean por su largo declarado.
 *
 * @param {Buffer | Uint8Array} b
 * @param {string | undefined} formato
 * @returns {boolean}
 */
export const estructuraConocida = (b, formato) => {
  if (formato === 'png') {
    // Los chunks que no llevan texto ni fechas. Cualquier otro —`eXIf`, `tEXt`,
    // `iTXt`, `zTXt`, `tIME`, o uno que no conozcamos— cuenta como metadato.
    const CONOCIDOS = new Set([
      'IHDR',
      'PLTE',
      'IDAT',
      'IEND',
      'tRNS',
      'gAMA',
      'cHRM',
      'sRGB',
      'iCCP',
      'sBIT',
      'bKGD',
      'pHYs',
      'hIST',
      'sPLT',
    ]);
    let i = 8;
    while (i + 12 <= b.length) {
      const largo = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
      const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      const hasta = i + 12 + largo;
      if (hasta > b.length || !CONOCIDOS.has(tipo)) return false;
      i = hasta;
      // `IEND` tiene que ser el último byte del archivo: lo que venga después es
      // una cola apendada.
      if (tipo === 'IEND') return i === b.length;
    }
    return false;
  }

  if (b[0] !== 0xff || b[1] !== 0xd8) return false;

  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return false;
    const m = b[i + 1];
    if (m === 0xff) {
      i += 1;
      continue;
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2;
      continue;
    }
    if (m === 0xd9) return i + 2 === b.length;
    const largo = (b[i + 2] << 8) | b[i + 3];
    if (largo < 2 || i + 2 + largo > b.length) return false;

    if ((m >= 0xe0 && m <= 0xef) || m === 0xfe) {
      const firmas = BLOQUES_CONOCIDOS[m];
      if (!firmas || !firmas.some((f) => arranca(b, i + 4, f))) return false;
    }

    if (m === 0xda) {
      // A partir de acá empieza el dato comprimido: se busca el EOI **real**.
      i += 2 + largo;
      while (i + 1 < b.length) {
        if (b[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marca = b[i + 1];
        if (marca === 0x00 || marca === 0xff || (marca >= 0xd0 && marca <= 0xd7)) {
          i += 2;
          continue;
        }
        if (marca === 0xd9) return i + 2 === b.length;
        // Un segmento intercalado de un JPEG progresivo (otro SOS, un DHT).
        const largoScan = (b[i + 2] << 8) | b[i + 3];
        if (largoScan < 2) return false;
        i += 2 + largoScan;
      }
      return false;
    }

    i += 2 + largo;
  }
  return false;
};

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
    // Las dos mitades: lo que `sharp` reporta, y lo que no sabemos leer. La
    // segunda es la que cierra el agujero de la rama que NO recomprime.
    conMetadatos: traeMetadatos(meta) || !estructuraConocida(bytes, meta.format),
    principal: { datos: principal, contentType: contentTypeDe(formato), formato },
    miniatura: { datos: miniatura, contentType: 'image/jpeg', formato: 'jpeg' },
  };
};
