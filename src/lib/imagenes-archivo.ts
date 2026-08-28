/**
 * El archivo de una imagen propia, antes de que toque la red (B-167, DEC-7).
 *
 * Todo lo de acá es **puro**: entra un `Uint8Array` y sale otro. No importa
 * `firebase/storage`, no toca el DOM y no usa `canvas`, así que se testea con
 * vitest sin emuladores y sin jsdom — que es lo que permite verificar por bytes
 * que el EXIF efectivamente se fue, en vez de confiar en que el navegador lo
 * haya hecho.
 *
 * La subida en sí (el SDK de Storage) vive en `subir-imagen.ts`, que se carga
 * con `import()` por el corte del bundle (B-09/D-51).
 *
 * ── Por qué el panel limpia metadatos si DEC-7d dice que eso lo hace la Function
 * DEC-7d sigue en pie y la Function sigue haciendo falta: es la que recomprime,
 * deriva la miniatura y —lo importante— es la que **no se puede saltear**, igual
 * que `storage.rules` frente al schema. Pero esa Function es la tajada que
 * todavía no está, y entre una tajada y la otra hay imágenes propias públicas.
 * Una foto sacada con un celular lleva las coordenadas GPS del lugar donde se
 * sacó, y muchos talleres pasan en la casa de alguien: publicar eso no es una
 * optimización pendiente, es un dato personal de un tercero en el `events.json`.
 * Así que el panel lo saca ahora, y la Function lo va a sacar otra vez después.
 * Defensa en profundidad, no duplicación.
 */
import { MAXIMO_BYTES } from '@/lib/imagenes';

/**
 * Los tipos que se aceptan **al subir**.
 *
 * Es un subconjunto de `TIPOS_ACEPTADOS`: son los dos para los que `sinMetadatos`
 * sabe sacar los bloques de metadatos sin recomprimir. WebP y AVIF quedan afuera
 * hasta que exista la Function de DEC-7d — sus contenedores también llevan
 * EXIF/XMP y aceptarlos sin poder limpiarlos sería justamente lo que este módulo
 * viene a evitar. Ningún celular saca fotos en esos formatos, así que la contra
 * es chica y la alternativa era publicar coordenadas.
 */
export const TIPOS_SUBIBLES = ['image/jpeg', 'image/png'] as const;
export type TipoSubible = (typeof TIPOS_SUBIBLES)[number];

export const esTipoSubible = (tipo: string): tipo is TipoSubible =>
  (TIPOS_SUBIBLES as readonly string[]).includes(tipo);

const EXTENSION: Record<TipoSubible, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/**
 * `7654321` → `7,3 MB`. Coma decimal, que es como se escribe en español.
 *
 * Existe para el mensaje de rechazo de DEC-7b, que **tiene que decir el tamaño
 * real y el máximo**: "es muy grande" no le dice a nadie cuánto tiene que
 * recortar.
 */
export const enBytesLegibles = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} bytes`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  // Un decimal, y sin el `,0` cuando es redondo: "3 MB" y no "3,0 MB".
  const redondeado = Math.round(mb * 10) / 10;
  return `${String(redondeado).replace('.', ',')} MB`;
};

/**
 * DEC-7b — ¿se puede subir este archivo? Devuelve el motivo del rechazo, o
 * `null` si está bien.
 *
 * Se valida sobre el archivo **tal como lo eligió la persona**, antes de sacarle
 * los metadatos: si se midiera después, una foto de 5 MB pasaría por poco y el
 * tope de 3 MB dejaría de significar lo que DEC-7b decidió que significara —
 * "menos que una foto de celular sin recortar", o sea un empujón explícito a
 * recortar antes de subir.
 */
export const validarArchivo = (archivo: { tipo: string; bytes: number }): string | null => {
  if (!esTipoSubible(archivo.tipo)) {
    return (
      'Por ahora solo se pueden subir imágenes JPG o PNG. ' +
      (archivo.tipo
        ? `Ese archivo es ${archivo.tipo}.`
        : 'Ese archivo no parece una imagen.')
    );
  }
  if (archivo.bytes > MAXIMO_BYTES) {
    return (
      `La imagen pesa ${enBytesLegibles(archivo.bytes)} y el máximo es ` +
      `${enBytesLegibles(MAXIMO_BYTES)}. Una foto de celular sin recortar casi siempre lo ` +
      'pasa: recortala o bajale la calidad y volvé a intentar.'
    );
  }
  if (archivo.bytes === 0) return 'El archivo está vacío.';
  return null;
};

/**
 * Dónde vive el objeto en Storage.
 *
 * **El nombre es el id de la fila de la galería**, que ya es un uuid generado en
 * el cliente (`nuevaImagenId()`). Dos consecuencias buscadas:
 *
 *  - **El path no dice nada.** La URL de descarga lo lleva URL-encodeado adentro
 *    (B-206 #1), así que el path es público de hecho; que sea un uuid es lo que
 *    hace que eso no importe. Es el "nombre opaco" que `07-seguridad.md` ya
 *    prometía.
 *  - **No se agrupa por actividad**, y no es un descuido: al subir **todavía no
 *    hay actividad**. Una actividad nueva no tiene id hasta que se guarda, así
 *    que un path `actividades/{id}/…` obligaría a guardar antes de poder subir
 *    una imagen — justo al revés de cómo se carga una actividad.
 */
export const rutaDeImagen = (imagenId: string, tipo: TipoSubible): string =>
  `imagenes/${imagenId}.${EXTENSION[tipo]}`;

// ─────────────────────────────────────────────────────────────────────
// Sacar los metadatos, sin recomprimir
// ─────────────────────────────────────────────────────────────────────

const leer16 = (b: Uint8Array, i: number): number => (b[i]! << 8) | b[i + 1]!;
const leer32 = (b: Uint8Array, i: number): number =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;

const unir = (partes: Uint8Array[]): Uint8Array => {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
};

/**
 * Los marcadores JPEG que se tiran. **Lista negra y no blanca, a propósito**:
 * quedarse corto tira un bloque de más (una imagen que se ve igual), y una lista
 * blanca que se queda corta deja pasar el EXIF, que es lo que este módulo existe
 * para evitar.
 *
 *  - `0xE1` APP1 — Exif y XMP. **Es el que lleva el GPS.**
 *  - `0xED` APP13 — IPTC / Photoshop, que lleva autor y créditos.
 *  - `0xFE` COM — comentario libre.
 *
 * Se conservan a propósito `0xE0` (JFIF: densidad), `0xE2` (perfil ICC: sacarlo
 * cambia los colores) y `0xEE` (Adobe: sin él, un JPEG CMYK se ve invertido).
 */
const APP_A_TIRAR = new Set([0xe1, 0xed, 0xfe]);

/** SOF — el marcador que trae alto y ancho. No son todos los `0xC*`. */
const ES_SOF = (m: number): boolean =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

const esJpeg = (b: Uint8Array): boolean => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const esPng = (b: Uint8Array): boolean =>
  b.length > 8 && FIRMA_PNG.every((v, i) => b[i] === v);

/**
 * Los chunks PNG que se tiran: los que llevan texto o EXIF. `tIME` también, que
 * es la fecha de la última modificación.
 */
const CHUNKS_A_TIRAR = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

/**
 * Dónde termina **de verdad** el JPEG: el índice justo después de su `FF D9`.
 *
 * Existe porque «desde SOS hasta el final son los datos comprimidos» es falso, y
 * la diferencia es una fuga. Muchos celulares apendan cosas **después del EOI**:
 * la imagen secundaria MPF de los Samsung y varios Android —que es un JPEG
 * completo, **con su propio APP1 y su propio GPS**—, el MP4 de una motion photo
 * (con su atom de ubicación), el trailer `SEFH`. Nada de eso lo ve un recorrido
 * de marcadores que se corta en SOS, así que copiar «hasta el final» copiaba
 * justamente lo que este módulo existe para sacar.
 *
 * El recorrido respeta las tres cosas que hacen que `FF D9` no se pueda buscar a
 * lo bruto: el **byte stuffing** (`FF 00` adentro del dato comprimido), los
 * marcadores de **reinicio** (`FF D0`–`FF D7`), y los segmentos que un JPEG
 * **progresivo** intercala entre scans (DHT y más SOS), que se saltean por su
 * largo declarado.
 *
 * Si no encuentra el EOI —un archivo truncado— devuelve el final: cortar más de
 * la cuenta rompería la imagen, y de los dos errores ese es el caro.
 */
const finDelJpeg = (b: Uint8Array, desdeSos: number): number => {
  let i = desdeSos;
  // `desdeSos` apunta al marcador SOS, que tiene largo declarado como cualquier
  // otro segmento; recién después empieza el dato comprimido.
  if (b[i] === 0xff && b[i + 1] === 0xda) i += 2 + leer16(b, i + 2);

  while (i + 1 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marcador = b[i + 1]!;
    // `FF 00` es un `FF` escapado del dato comprimido; `FF FF` es relleno.
    if (marcador === 0x00 || marcador === 0xff) {
      i += 2;
      continue;
    }
    if (marcador >= 0xd0 && marcador <= 0xd7) {
      i += 2;
      continue;
    }
    if (marcador === 0xd9) return i + 2;
    // Cualquier otro marcador acá es un segmento de un JPEG progresivo.
    const largo = leer16(b, i + 2);
    if (largo < 2) return b.length;
    i += 2 + largo;
  }
  return b.length;
};

/**
 * Las cadenas que **no pueden quedar** en los bytes que se suben.
 *
 * Es el barrido de centinelas del §5 aplicado a una salida binaria: en vez de
 * confiar en que el recorrido de arriba sacó todo, se mira el resultado. Un
 * camino nuevo por el que entren metadatos —un formato que no sabemos parsear,
 * un contenedor apendado que todavía no vimos— cae acá aunque nadie lo haya
 * previsto, que es la propiedad que una lista de marcadores no tiene.
 *
 * Falsos positivos: `Exif\0\0` son seis bytes con dos NUL, y las otras dos son
 * de trece y veinticuatro. La probabilidad de que aparezcan por casualidad en el
 * dato comprimido de un archivo de 3 MB es del orden de 1 en 10⁸.
 */
const MARCAS_DE_METADATOS: readonly string[] = [
  'Exif\u0000\u0000',
  'http://ns.adobe.com/xap/',
  'Photoshop 3.0',
];

const contieneCadena = (b: Uint8Array, cadena: string): boolean => {
  const aguja = [...cadena].map((c) => c.charCodeAt(0));
  for (let i = 0; i + aguja.length <= b.length; i++) {
    let coincide = true;
    for (let n = 0; n < aguja.length; n++) {
      if (b[i + n] !== aguja[n]) {
        coincide = false;
        break;
      }
    }
    if (coincide) return true;
  }
  return false;
};

/**
 * ¿Quedó algún bloque de metadatos en lo que se iba a subir?
 *
 * Se corre **sobre la salida** de `sinMetadatos`, justo antes de `uploadBytes`, y
 * corta la subida si da `true`. Falla cerrado a propósito: una foto que no se
 * puede subir es un problema de una persona esa tarde; una foto con las
 * coordenadas de una casa particular publicada en el `events.json` no se
 * despublica.
 */
export const quedanMetadatos = (datos: Uint8Array): boolean =>
  MARCAS_DE_METADATOS.some((m) => contieneCadena(datos, m));

/**
 * ¿Los bytes son de verdad del tipo que el archivo dice ser?
 *
 * **El tipo declarado no se puede creer, y de eso dependían las tres capas.** El
 * `type` de un `File` lo deriva el navegador de la **extensión**; `sinMetadatos`
 * devuelve el archivo tal cual si no reconoce la firma; y `storage.rules` compara
 * el `contentType` que manda el mismo cliente. Entonces un WebP (o un HEIC, o un
 * PNG) renombrado `.jpg` pasaba las tres y subía **con su EXIF intacto** — y el
 * navegador lo iba a renderizar igual, porque para mostrar una imagen se mira la
 * firma y no el nombre.
 *
 * Un JPEG legítimo empieza siempre con `FF D8` y un PNG con su firma de ocho
 * bytes, así que este chequeo no puede rechazar un archivo bueno.
 */
export const esDelTipoDeclarado = (tipo: TipoSubible, datos: Uint8Array): boolean =>
  tipo === 'image/jpeg' ? esJpeg(datos) : esPng(datos);

/**
 * Recorre un JPEG marcador por marcador. `alSegmento` decide qué hacer con cada
 * uno; se usa para las dos cosas que hay que hacer con un JPEG (limpiarlo y
 * medirlo) sin escribir el recorrido dos veces.
 *
 * Se corta en SOS (`0xDA`), que es donde empieza el dato comprimido: a partir de
 * ahí ya no hay marcadores que parsear, hay bytes de imagen que pueden contener
 * cualquier cosa que se parezca a un marcador.
 */
const recorrerJpeg = (
  b: Uint8Array,
  alSegmento: (marcador: number, desde: number, hasta: number) => void,
): number => {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) break; // Desalineado: no es un JPEG que sepamos leer.
    const marcador = b[i + 1]!;
    // Relleno (`FF FF`) y marcadores sin payload.
    if (marcador === 0xff) {
      i += 1;
      continue;
    }
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      alSegmento(marcador, i, i + 2);
      i += 2;
      continue;
    }
    if (marcador === 0xda || marcador === 0xd9) return i;
    const largo = leer16(b, i + 2);
    if (largo < 2) break;
    const hasta = Math.min(i + 2 + largo, b.length);
    alSegmento(marcador, i, hasta);
    i = hasta;
  }
  return i;
};

/**
 * El archivo sin sus bloques de metadatos, **sin recomprimir**: los píxeles
 * salen byte por byte iguales a como entraron.
 *
 * Recomprimir sería la otra forma de sacar el EXIF (dibujar en un `canvas` y
 * volver a exportar) y se descartó por tres motivos: pierde calidad sin que nadie
 * lo pida, hace que el tope de 3 MB de DEC-7b deje de significar lo que decidió
 * significar —una foto de 8 MB entraría recomprimida, y el mensaje que empuja a
 * recortar no aparecería nunca—, y no se puede testear sin un navegador.
 *
 * Un archivo que no se pueda parsear vuelve **tal cual**: el rechazo es de
 * `storage.rules` y del tipo MIME, no de acá. Cortar la subida porque un JPEG
 * raro no se dejó recorrer sería cambiar un problema de privacidad por uno de
 * "no puedo subir esta foto y no sé por qué".
 */
export const sinMetadatos = (tipo: TipoSubible, datos: Uint8Array): Uint8Array => {
  if (tipo === 'image/jpeg') {
    if (!esJpeg(datos)) return datos;
    const partes: Uint8Array[] = [datos.subarray(0, 2)];
    const fin = recorrerJpeg(datos, (marcador, desde, hasta) => {
      if (APP_A_TIRAR.has(marcador)) return;
      partes.push(datos.subarray(desde, hasta));
    });
    // Desde SOS hasta el EOI **real** va tal cual: son los datos comprimidos.
    // Lo que haya después del EOI se descarta — ver `finDelJpeg`.
    partes.push(datos.subarray(fin, finDelJpeg(datos, fin)));
    return unir(partes);
  }

  if (!esPng(datos)) return datos;
  const partes: Uint8Array[] = [datos.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= datos.length) {
    const largo = leer32(datos, i);
    const tipoChunk = String.fromCharCode(...datos.subarray(i + 4, i + 8));
    const hasta = i + 12 + largo;
    if (hasta > datos.length) break;
    if (!CHUNKS_A_TIRAR.has(tipoChunk)) partes.push(datos.subarray(i, hasta));
    i = hasta;
    if (tipoChunk === 'IEND') break;
  }
  return unir(partes);
};

/**
 * Alto y ancho, leídos del encabezado. `null` si el archivo no se deja leer.
 *
 * Se parsean en vez de pedírselos a un `Image` del navegador por la misma razón
 * que arriba: así son verificables sin DOM, y así el módulo entero sirve igual
 * desde un test.
 *
 * Van al documento porque `toPublic` los publica: con alto y ancho, la tarjeta
 * del sitio reserva el hueco y no salta cuando la imagen carga.
 */
export const dimensiones = (
  tipo: TipoSubible,
  datos: Uint8Array,
): { ancho: number; alto: number } | null => {
  if (tipo === 'image/png') {
    if (!esPng(datos) || datos.length < 24) return null;
    const ancho = leer32(datos, 16);
    const alto = leer32(datos, 20);
    return ancho > 0 && alto > 0 ? { ancho, alto } : null;
  }

  if (!esJpeg(datos)) return null;
  let medida: { ancho: number; alto: number } | null = null;
  recorrerJpeg(datos, (marcador, desde) => {
    if (medida || !ES_SOF(marcador)) return;
    // SOF: largo(2) precisión(1) alto(2) ancho(2), contados desde el marcador.
    medida = { alto: leer16(datos, desde + 5), ancho: leer16(datos, desde + 7) };
  });
  return medida;
};
