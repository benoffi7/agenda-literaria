import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ORIENTACION_DERECHA,
  orientacionExif,
  TIPOS_SUBIBLES,
  dimensiones,
  enBytesLegibles,
  esDelTipoDeclarado,
  esTipoSubible,
  motivoDeSubidaFallida,
  quedanMetadatos,
  rutaDeImagen,
  sinMetadatos,
  validarArchivo,
} from '@/lib/imagenes-archivo';
import { MAXIMO_BYTES, TIPOS_ACEPTADOS } from '@/lib/imagenes';
import { FUNCIONES } from '@/lib/analytics-eventos';
import { MOTIVOS_IMAGEN } from '@/lib/analytics-eventos';

/**
 * B-167, segunda tajada — el archivo de una imagen propia antes de la red.
 *
 * Lo que estos tests fijan, en orden de qué duele más si se rompe:
 *
 * 1. **El EXIF se va, verificado sobre los bytes.** Una foto de celular lleva las
 *    coordenadas del lugar donde se sacó, y muchos talleres pasan en la casa de
 *    alguien: publicar eso es un dato personal de un tercero en el `events.json`.
 *    Se verifica buscando el marcador en la salida, no confiando en la función.
 * 2. **Los píxeles no se tocan.** Sacar metadatos recomprimiendo también
 *    funcionaría, y perdería calidad sin que nadie lo pida; el test afirma que el
 *    dato comprimido sale idéntico.
 * 3. **El mensaje de rechazo dice el tamaño real y el máximo** (DEC-7b).
 */

// ── Constructores de archivos mínimos ────────────────────────────
//
// Se arman a mano y no con un `.jpg` binario en el repo: un fixture binario no
// se puede leer en un diff, y acá lo que importa es exactamente qué segmentos
// tiene el archivo.

const seg = (marcador: number, cuerpo: number[]): number[] => {
  const largo = cuerpo.length + 2;
  return [0xff, marcador, (largo >> 8) & 0xff, largo & 0xff, ...cuerpo];
};

/** `Exif\0\0` + un payload cualquiera, que es lo que APP1 lleva adentro. */
const CUERPO_EXIF = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xde, 0xad, 0xbe, 0xef];

/**
 * Los bytes que hacen de "imagen comprimida": lo que va después de SOS, cerrado
 * con su EOI (`FF D9`). El `FF 00` del medio es un `FF` escapado —byte
 * stuffing—, que es una de las tres cosas que `finDelJpeg` tiene que respetar
 * para no cortar la imagen a la mitad.
 */
const DATOS_COMPRIMIDOS = [0x11, 0xff, 0x00, 0x33, 0x44, 0xff, 0xd9];

const jpeg = (opts: { conExif?: boolean; alto?: number; ancho?: number } = {}): Uint8Array => {
  const { conExif = true, alto = 800, ancho = 1200 } = opts;
  return new Uint8Array([
    0xff, 0xd8, // SOI
    // APP0 (JFIF): se conserva. **El cuerpo es el de un JFIF de verdad, de
    // dieciséis bytes**, y no la firma sola: los dos ceros del final son
    // `Xthumbnail`/`Ythumbnail`, y desde B-869 son la condición para
    // conservarlo (un JFIF con thumbnail lleva una miniatura del original de
    // antes del recorte, y se tira como `JFXX`).
    ...seg(0xe0, [
      0x4a, 0x46, 0x49, 0x46, 0x00, // 'JFIF\0'
      0x01, 0x02, // versión
      0x00, // unidades
      0x00, 0x01, 0x00, 0x01, // densidad
      0x00, 0x00, // sin thumbnail
    ]),
    ...(conExif ? seg(0xe1, CUERPO_EXIF) : []), // APP1 (Exif): se tira
    ...seg(0xfe, [0x68, 0x6f, 0x6c, 0x61]), // COM: se tira
    // SOF0: precisión, alto, ancho, componentes
    ...seg(0xc0, [0x08, (alto >> 8) & 0xff, alto & 0xff, (ancho >> 8) & 0xff, ancho & 0xff, 0x03]),
    // SOS **con su largo declarado**, como en un JPEG de verdad: `finDelJpeg` lo
    // saltea por el largo antes de empezar a buscar el EOI en el dato comprimido.
    ...seg(0xda, [0x01, 0x01, 0x00]),
    ...DATOS_COMPRIMIDOS,
  ]);
};

const chunk = (tipo: string, datos: number[]): number[] => {
  const largo = datos.length;
  return [
    (largo >>> 24) & 0xff,
    (largo >>> 16) & 0xff,
    (largo >>> 8) & 0xff,
    largo & 0xff,
    ...[...tipo].map((c) => c.charCodeAt(0)),
    ...datos,
    // El CRC no se recalcula nunca: los chunks se conservan o se tiran enteros.
    0xaa, 0xbb, 0xcc, 0xdd,
  ];
};

const png = (opts: { conExif?: boolean; alto?: number; ancho?: number } = {}): Uint8Array => {
  const { conExif = true, alto = 480, ancho = 640 } = opts;
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [
      (ancho >>> 24) & 0xff, (ancho >>> 16) & 0xff, (ancho >>> 8) & 0xff, ancho & 0xff,
      (alto >>> 24) & 0xff, (alto >>> 16) & 0xff, (alto >>> 8) & 0xff, alto & 0xff,
      0x08, 0x06, 0x00, 0x00, 0x00,
    ]),
    ...(conExif ? chunk('eXIf', CUERPO_EXIF) : []),
    ...chunk('tEXt', [0x41, 0x75, 0x74, 0x68, 0x6f, 0x72]),
    ...chunk('IDAT', [0x01, 0x02, 0x03]),
    ...chunk('IEND', []),
  ]);
};

/** ¿Aparece esta secuencia de bytes adentro del buffer? */
const contiene = (donde: Uint8Array, que: number[]): boolean => {
  for (let i = 0; i + que.length <= donde.length; i++) {
    if (que.every((b, n) => donde[i + n] === b)) return true;
  }
  return false;
};

const CADENA_EXIF = [0x45, 0x78, 0x69, 0x66]; // "Exif"

describe('qué se puede subir', () => {
  it('los subibles son un subconjunto de los que la galería sabe mostrar', () => {
    // Si algún día se acepta subir algo que la galería no muestra, la imagen
    // entra al bucket y no se ve en ningún lado.
    for (const t of TIPOS_SUBIBLES) {
      expect(TIPOS_ACEPTADOS as readonly string[], t).toContain(t);
    }
  });

  it('WebP y AVIF se muestran pero NO se suben', () => {
    // Es la decisión de esta tajada, no un olvido: sus contenedores llevan
    // EXIF/XMP y todavía no hay quien se lo saque. Vuelven con la Function de
    // DEC-7d, que recomprime todo. Si alguien los agrega a `TIPOS_SUBIBLES` sin
    // agregar el limpiador, este test se lo dice.
    expect(esTipoSubible('image/webp')).toBe(false);
    expect(esTipoSubible('image/avif')).toBe(false);
    expect(esTipoSubible('image/svg+xml')).toBe(false);
  });
});

describe('el rechazo dice el tamaño real y el máximo — DEC-7b', () => {
  it('un archivo más grande que el tope se rechaza nombrando los dos números', () => {
    const motivo = validarArchivo({ tipo: 'image/jpeg', bytes: 7_654_321 });
    expect(motivo).toBeTruthy();
    // Los dos números, que es literalmente lo que DEC-7b pidió: "es muy grande"
    // no le dice a nadie cuánto tiene que recortar.
    expect(motivo).toContain('7,3 MB');
    expect(motivo).toContain('3 MB');
  });

  it('justo en el tope pasa, y un byte más no', () => {
    expect(validarArchivo({ tipo: 'image/png', bytes: MAXIMO_BYTES })).toBeNull();
    expect(validarArchivo({ tipo: 'image/png', bytes: MAXIMO_BYTES + 1 })).toBeTruthy();
  });

  it('un tipo que no se puede limpiar se rechaza diciendo cuál era', () => {
    expect(validarArchivo({ tipo: 'image/heic', bytes: 100 })).toContain('image/heic');
    // Sin tipo (el navegador no lo reconoció) el mensaje no puede nombrarlo.
    expect(validarArchivo({ tipo: '', bytes: 100 })).toContain('no parece una imagen');
  });

  it('un archivo vacío se rechaza', () => {
    expect(validarArchivo({ tipo: 'image/jpeg', bytes: 0 })).toBeTruthy();
  });

  it('los tamaños se escriben en castellano', () => {
    expect(enBytesLegibles(0)).toBe('0 bytes');
    expect(enBytesLegibles(2048)).toBe('2 KB');
    expect(enBytesLegibles(3 * 1024 * 1024)).toBe('3 MB');
    // Coma decimal, y sin el `,0` cuando es redondo.
    expect(enBytesLegibles(1_600_000)).toBe('1,5 MB');
  });
});

describe('la ruta en Storage es opaca — B-206 #1', () => {
  it('el nombre es el id de la fila, que es un uuid', () => {
    expect(rutaDeImagen('img_ab12-cd34', 'image/jpeg')).toBe('imagenes/img_ab12-cd34.jpg');
    expect(rutaDeImagen('img_ab12-cd34', 'image/png')).toBe('imagenes/img_ab12-cd34.png');
  });

  it('no lleva ningún dato de la actividad', () => {
    // Es lo que hace inofensivo que el path viaje adentro de la URL de descarga
    // (B-206 #1). Y es también lo que permite subir **antes** de guardar: una
    // actividad nueva no tiene id hasta que se guarda.
    const ruta = rutaDeImagen('img_x', 'image/jpeg');
    expect(ruta.startsWith('imagenes/')).toBe(true);
    expect(ruta.split('/')).toHaveLength(2);
  });

  it('la ruta que produce entra en el patrón que exige storage.rules', () => {
    // Las dos mitades de la misma decisión viven en archivos distintos y en
    // idiomas distintos; si divergen, la subida falla con permission-denied y el
    // motivo no se ve en ningún lado.
    const patron = /^imagenes\/img_[A-Za-z0-9_-]+\.(jpg|png)$/;
    expect(rutaDeImagen('img_0e2a-4b1f-9c', 'image/jpeg')).toMatch(patron);
    expect(rutaDeImagen('img_0e2a-4b1f-9c', 'image/png')).toMatch(patron);
  });
});

describe('los metadatos se van, y los píxeles no se tocan', () => {
  it('JPEG: el bloque Exif no está en la salida', () => {
    const original = jpeg({ conExif: true });
    // Control positivo: si el fixture no tuviera Exif, el chequeo de abajo
    // pasaría sin verificar nada.
    expect(contiene(original, CADENA_EXIF)).toBe(true);
    expect(contiene(sinMetadatos('image/jpeg', original), CADENA_EXIF)).toBe(false);
  });

  it('JPEG: el dato comprimido sale byte por byte igual', () => {
    // La propiedad que distingue "sacar metadatos" de "recomprimir".
    const limpio = sinMetadatos('image/jpeg', jpeg());
    expect(contiene(limpio, DATOS_COMPRIMIDOS)).toBe(true);
    expect([...limpio.slice(-DATOS_COMPRIMIDOS.length)]).toEqual(DATOS_COMPRIMIDOS);
  });

  it('JPEG: el APP0 de JFIF se conserva', () => {
    // Es uno de los tres APPn de la lista **blanca** de B-869
    // (`APPN_JPEG_SEGUROS`): sacarlo cambiaría la densidad declarada. Los otros
    // dos —el perfil ICC y el Adobe— y la propiedad de fondo de la lista viven
    // en el `describe` de B-869, más abajo.
    expect(contiene(sinMetadatos('image/jpeg', jpeg()), [0x4a, 0x46, 0x49, 0x46])).toBe(true);
  });

  it('JPEG: sin Exif, la salida es la misma entrada', () => {
    // Salvo el COM, que también se tira. Lo que importa: no se reescribe nada
    // que no haya que reescribir.
    const sinExif = jpeg({ conExif: false });
    const limpio = sinMetadatos('image/jpeg', sinExif);
    expect(limpio.length).toBeLessThan(sinExif.length); // se fue el COM
    expect(contiene(limpio, CADENA_EXIF)).toBe(false);
  });

  it('PNG: los chunks eXIf y tEXt se van y el IDAT queda', () => {
    const original = png();
    expect(contiene(original, CADENA_EXIF)).toBe(true);
    const limpio = sinMetadatos('image/png', original);
    expect(contiene(limpio, [0x65, 0x58, 0x49, 0x66])).toBe(false); // eXIf
    expect(contiene(limpio, [0x74, 0x45, 0x58, 0x74])).toBe(false); // tEXt
    expect(contiene(limpio, [0x49, 0x44, 0x41, 0x54])).toBe(true); // IDAT
    expect(contiene(limpio, [0x49, 0x45, 0x4e, 0x44])).toBe(true); // IEND
  });

  it('PNG: el chunk caBX de las credenciales C2PA se va, y el barrido lo ve — B-220', () => {
    /*
     * **El caso es real y estaba publicado.** La portada de una actividad de
     * producción trae un chunk `caBX` de **13,6 KB**: es la caja JUMBF donde
     * viven las credenciales de contenido C2PA, y ahí adentro había un
     * manifiesto **firmado por Google LLC** («Google C2PA Media Services») con la
     * herramienta que generó la imagen, un certificado y un `urn:c2pa:` que
     * identifica esa copia.
     *
     * No lo tiraba la lista de chunks a tirar (negra, en ese momento) y no lo
     * veía `quedanMetadatos`, así que pasó las dos capas de este módulo. Lo
     * encontró B-220 al medir por qué esa imagen pesaba 1091 KB, y fue la
     * mejor prueba de que una lista **negra** de chunks no alcanza: el bloque
     * llegó años después de que la lista se hubiera escrito. B-323 invirtió la
     * lista a **blanca** (`CHUNKS_PNG_SEGUROS`, `@png-chunks-seguros`), así
     * que un chunk que el formato agregue mañana no puede repetir este caso.
     *
     * Mutación: agregar `'caBX'` a `CHUNKS_PNG_SEGUROS` — el primer aserto se
     * pone rojo. Sacar `'jumdc2pa'` de `MARCAS_DE_METADATOS` — el segundo
     * también.
     */
    const CA_BX = [0x63, 0x61, 0x42, 0x58]; // 'caBX'
    // `jumdc2pa` es la caja de descripción del manifiesto, y es lo que el
    // centinela busca.
    const MANIFIESTO = [...'jumdc2pa'].map((c) => c.charCodeAt(0));
    const conC2pa = new Uint8Array([
      ...png().slice(0, 8),
      ...[...png().slice(8)].slice(0, 0),
      ...png().slice(8, 33),
      ...chunk('caBX', MANIFIESTO),
      ...png().slice(33),
    ]);
    expect(contiene(conC2pa, CA_BX)).toBe(true);
    expect(contiene(conC2pa, MANIFIESTO)).toBe(true);

    const limpio = sinMetadatos('image/png', conC2pa);
    expect(contiene(limpio, CA_BX), 'el chunk caBX tiene que irse').toBe(false);
    expect(contiene(limpio, MANIFIESTO)).toBe(false);
    // Y el IDAT sigue: no se tiró la imagen con el manifiesto.
    expect(contiene(limpio, [0x49, 0x44, 0x41, 0x54])).toBe(true);

    // La segunda capa, que es la que falla cerrado: si el chunk sobreviviera por
    // cualquier camino, el barrido corta la subida.
    expect(quedanMetadatos(conC2pa), 'el barrido tiene que ver el manifiesto').toBe(true);
    expect(quedanMetadatos(limpio)).toBe(false);
  });

  it('PNG: un chunk que el formato agregue mañana y todavía no está enumerado también se va — B-323', () => {
    /*
     * **La propiedad que `caBX` de arriba no alcanza a probar sola.** Ese test
     * fija un chunk conocido; este fija la propiedad de fondo: con la lista
     * **blanca**, cualquier chunk que `CHUNKS_PNG_SEGUROS` no enumere se tira,
     * lo haya visto alguien antes o no. Con la lista negra que había hasta
     * B-323 este caso pasaba de largo — es exactamente el modo de falla que
     * dejó pasar `caBX` en producción, y `'zzZZ'` no es un chunk real: está
     * elegido para no coincidir con nada de la lista blanca.
     *
     * Mutación: volver a una lista negra que no incluya `'zzZZ'` (cualquiera,
     * la vieja incluida). Este `it` se pone rojo aunque el de `caBX` siga
     * verde, porque ese sí lo tapaba a mano.
     */
    const DESCONOCIDO = [0x7a, 0x7a, 0x5a, 0x5a]; // 'zzZZ'
    const conChunkFuturo = new Uint8Array([
      ...png().slice(0, 33),
      ...chunk('zzZZ', [1, 2, 3, 4]),
      ...png().slice(33),
    ]);
    expect(contiene(conChunkFuturo, DESCONOCIDO)).toBe(true);

    const limpio = sinMetadatos('image/png', conChunkFuturo);
    expect(contiene(limpio, DESCONOCIDO), 'un chunk no enumerado tiene que irse').toBe(false);
    // Y la imagen sigue entera.
    expect(contiene(limpio, [0x49, 0x44, 0x41, 0x54])).toBe(true);
    expect(contiene(limpio, [0x49, 0x45, 0x4e, 0x44])).toBe(true);
  });

  it('JPEG: lo apendado DESPUÉS del EOI no sobrevive', () => {
    // El caso real: la imagen secundaria MPF de un Samsung es **un JPEG entero
    // con su propio APP1 y su propio GPS**, pegado después del EOI del primero.
    // Un recorrido que se corta en SOS y copia "hasta el final" se la lleva
    // puesta, y ahí el módulo entero no sirve para nada.
    const original = jpeg({ conExif: true });
    const conTrailer = new Uint8Array([...original, ...jpeg({ conExif: true })]);
    expect(contiene(conTrailer, CADENA_EXIF)).toBe(true);

    const limpio = sinMetadatos('image/jpeg', conTrailer);
    expect(contiene(limpio, CADENA_EXIF)).toBe(false);
    // Y la imagen principal quedó entera: mismo resultado que sin el trailer.
    expect([...limpio]).toEqual([...sinMetadatos('image/jpeg', original)]);
  });

  it('el barrido sobre la salida es lo que atrapa un camino que nadie previó', () => {
    // Es el §5 aplicado a una salida binaria: se afirma sobre el resultado y no
    // sobre la lista de marcadores. Un contenedor nuevo, un formato que no
    // sabemos parsear, un trailer que todavía no vimos: caen acá igual.
    expect(quedanMetadatos(sinMetadatos('image/jpeg', jpeg()))).toBe(false);
    expect(quedanMetadatos(sinMetadatos('image/png', png()))).toBe(false);
    // Control positivo, con las tres marcas.
    for (const marca of ['Exif\u0000\u0000', 'http://ns.adobe.com/xap/', 'Photoshop 3.0']) {
      const sucio = new Uint8Array([...jpeg({ conExif: false }), ...[...marca].map((c) => c.charCodeAt(0))]);
      expect(quedanMetadatos(sucio), marca).toBe(true);
    }
  });

  it('un archivo que miente sobre su tipo se detecta por los bytes', () => {
    // El agujero que tenían las tres capas juntas: el `type` de un `File` sale
    // de la **extensión**, `sinMetadatos` devuelve tal cual lo que no reconoce, y
    // `storage.rules` compara el `contentType` que manda el mismo cliente. Un
    // WebP renombrado `.jpg` pasaba las tres con su EXIF adentro.
    expect(esDelTipoDeclarado('image/jpeg', jpeg())).toBe(true);
    expect(esDelTipoDeclarado('image/png', png())).toBe(true);
    expect(esDelTipoDeclarado('image/jpeg', png())).toBe(false);
    expect(esDelTipoDeclarado('image/png', jpeg())).toBe(false);
    // RIFF/WEBP con la extensión cambiada.
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(esDelTipoDeclarado('image/jpeg', webp)).toBe(false);
  });

  it('un archivo que no se deja parsear vuelve tal cual', () => {
    // El rechazo es del tipo MIME y de `storage.rules`, no de acá: cortar la
    // subida porque un JPEG raro no se dejó recorrer sería cambiar un problema
    // de privacidad por un "no puedo subir esta foto y no sé por qué".
    const basura = new Uint8Array([1, 2, 3, 4, 5]);
    expect(sinMetadatos('image/jpeg', basura)).toBe(basura);
    expect(sinMetadatos('image/png', basura)).toBe(basura);
  });
});

// ─────────────────────────────────────────────────────────────────
// La lista de segmentos JPEG, invertida a blanca — B-869 / D-620
// ─────────────────────────────────────────────────────────────────

const cadena = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

/** `JFIF\0` + versión y densidad: el APP0 tal como lo escribe una cámara. */
const CUERPO_JFIF = [...cadena('JFIF\u0000'), 0x01, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0, 0];

/** `ICC_PROFILE\0` + número de trozo + payload reconocible. */
const CUERPO_ICC = [...cadena('ICC_PROFILE\u0000'), 0x01, 0x01, 0xc0, 0x1c, 0xed];

/**
 * El índice multi-imagen de un Samsung, que **comparte el `0xE2` del perfil
 * ICC**: es lo que obliga a que la lista blanca sea por firma y no por marcador.
 */
const CUERPO_MPF = [...cadena('MPF\u0000'), 0x49, 0x49, 0x2a, 0x00, 0xbe, 0xef];

/**
 * El APP11 de las credenciales de contenido C2PA: una caja JUMBF. Las dos
 * cadenas son las que `quedanMetadatos` busca desde B-220.
 */
const CUERPO_C2PA = [
  ...cadena('JP'),
  0x00,
  0x00,
  ...cadena('jumdc2pa'),
  ...cadena('urn:c2pa:d3adb33f'),
];

/**
 * Un JPEG con **todos** los segmentos que un decodificador necesita, más los
 * que le pasemos. El fixture de arriba (`jpeg()`) alcanza para el EXIF; este
 * agrega las tablas para poder afirmar que la lista blanca no se las lleva.
 */
const jpegCompleto = (extra: number[] = []): Uint8Array =>
  new Uint8Array([
    0xff, 0xd8, // SOI
    ...seg(0xe0, CUERPO_JFIF), // APP0/JFIF — se conserva
    ...extra,
    ...seg(0xdb, [0x00, 0x10, 0x0b, 0x0c]), // DQT — tabla de cuantización
    ...seg(0xc4, [0x00, 0x01, 0x05, 0x01]), // DHT — tabla de Huffman
    ...seg(0xdd, [0x00, 0x04]), // DRI — intervalo de reinicio
    ...seg(0xc0, [0x08, 0x03, 0x20, 0x04, 0xb0, 0x03]), // SOF0
    ...seg(0xda, [0x01, 0x01, 0x00]), // SOS
    ...DATOS_COMPRIMIDOS,
  ]);

describe('la lista de segmentos JPEG es blanca — B-869 / D-620', () => {
  it('el APP11 con las credenciales C2PA se va, y la subida deja de rechazarse', () => {
    /*
     * **Este es el bug del 2026-09-10, congelado como caso.** El dueño subió
     * una foto normal y el panel se la rechazó diciéndole que su teléfono le
     * guardaba «una segunda copia adentro», que era falso: lo que traía era un
     * manifiesto C2PA —el que exporta Google Photos, firmado por Google— y
     * viaja en **APP11** (`0xEB`).
     *
     * La lista negra que había hasta acá (`APP_A_TIRAR = {0xe1, 0xed, 0xfe}`)
     * no lo tiraba, y `quedanMetadatos` sí lo busca desde B-220: el detector
     * rechazaba un bloque que el saneador no sabía sacar. Los dos asertos de
     * abajo son las dos mitades de eso —que el bloque se va, y que por lo
     * tanto el barrido ya no corta la subida— y con la lista negra los dos
     * fallaban.
     *
     * MUTACIÓN PROBADA: volver a la lista negra (o hacer que `seConserva`
     * devuelva `true` para todo lo que no sea `0xe1`/`0xed`/`0xfe`, que es lo
     * mismo con otra cara) pone los dos en rojo.
     */
    const conC2pa = jpegCompleto(seg(0xeb, CUERPO_C2PA));
    // Controles positivos: el fixture lo trae, y el barrido lo ve.
    expect(contiene(conC2pa, cadena('jumdc2pa'))).toBe(true);
    expect(quedanMetadatos(conC2pa), 'el barrido tiene que ver el manifiesto').toBe(true);

    const limpio = sinMetadatos('image/jpeg', conC2pa);
    expect(contiene(limpio, cadena('jumdc2pa')), 'el APP11 tiene que irse').toBe(false);
    expect(contiene(limpio, cadena('urn:c2pa:'))).toBe(false);
    // Y por lo tanto la subida ya no se corta: es el rechazo que veía el dueño.
    expect(quedanMetadatos(limpio), 'la subida se seguiría rechazando').toBe(false);
    // La imagen sigue entera.
    expect(contiene(limpio, DATOS_COMPRIMIDOS)).toBe(true);
  });

  it('el perfil ICC de APP2 sobrevive: sacarlo sería degradar la foto', () => {
    /*
     * **El cuidado que hace que invertir la lista no sea un `sed`.** APP2 lleva
     * el índice MPF *y* el perfil ICC, y tirar el marcador entero cambiaría los
     * colores de una foto de gama amplia — o sea degradar la imagen sin que
     * nadie lo pida, justo lo que el docblock de `sinMetadatos` promete que no
     * pasa («los píxeles salen byte por byte iguales»).
     *
     * MUTACIÓN PROBADA: sacar la entrada `0xe2` de `APPN_JPEG_SEGUROS` deja
     * este caso en rojo (y ningún otro, que es lo que lo hace valer).
     */
    const conIcc = jpegCompleto(seg(0xe2, CUERPO_ICC));
    const limpio = sinMetadatos('image/jpeg', conIcc);
    expect(contiene(limpio, cadena('ICC_PROFILE')), 'se fue el perfil de color').toBe(true);
    // Y entero, no solo la firma: el payload es el perfil.
    expect(contiene(limpio, [0xc0, 0x1c, 0xed])).toBe(true);
  });

  it('el índice MPF se va aunque comparta el APP2 con el perfil ICC', () => {
    /*
     * La otra mitad del caso de arriba, y la razón por la que la lista blanca
     * es **por firma** y no por marcador: la imagen secundaria MPF de un
     * Samsung es un JPEG entero con su propio APP1 y su propio GPS, y este
     * bloque es su índice. Con los dos APP2 en el mismo archivo, uno se
     * conserva y el otro no.
     *
     * Y `quedanMetadatos` **no** lo ve —no hay centinela de MPF, y una firma de
     * cuatro bytes tendría demasiados falsos positivos para agregarla—, así que
     * acá el modo de falla no era un rechazo: era una fuga silenciosa.
     *
     * MUTACIÓN PROBADA: agregar `'MPF\u0000'` a las firmas del `0xe2` en
     * `APPN_JPEG_SEGUROS` deja este caso en rojo y el resto en verde.
     */
    const conAmbos = jpegCompleto([...seg(0xe2, CUERPO_ICC), ...seg(0xe2, CUERPO_MPF)]);
    expect(contiene(conAmbos, cadena('MPF\u0000'))).toBe(true);
    // Control: hoy el barrido no lo atrapa, así que el saneador es lo único.
    expect(quedanMetadatos(conAmbos)).toBe(false);

    const limpio = sinMetadatos('image/jpeg', conAmbos);
    expect(contiene(limpio, cadena('MPF\u0000')), 'el índice MPF tiene que irse').toBe(false);
    expect(contiene(limpio, cadena('ICC_PROFILE')), 'y el perfil tiene que quedarse').toBe(true);
  });

  it('el thumbnail JFXX se va aunque comparta el APP0 con JFIF', () => {
    // Mismo motivo que el MPF, del otro lado: `JFXX` es una miniatura del
    // original **antes** de cualquier recorte, metida adentro del mismo
    // marcador cuya densidad sí queremos conservar. La firma con NUL es lo que
    // los separa.
    const conJfxx = jpegCompleto(seg(0xe0, [...cadena('JFXX\u0000'), 0x10, 0xaa, 0xbb]));
    // Control positivo, como en los otros tres casos de «esto se va»: sin él,
    // un `jpegCompleto` que descartara el `extra` dejaría este `it` en verde
    // sin haber saneado nada. Lo pidió el `auditor-trampas`.
    expect(contiene(conJfxx, cadena('JFXX')), 'el fixture no quedó armado').toBe(true);
    const limpio = sinMetadatos('image/jpeg', conJfxx);
    expect(contiene(limpio, cadena('JFXX')), 'el thumbnail JFXX tiene que irse').toBe(false);
    expect(contiene(limpio, cadena('JFIF')), 'y el JFIF tiene que quedarse').toBe(true);
  });

  it('un APP0/JFIF con thumbnail embebido NO se conserva — lo pidió el auditor-privacidad', () => {
    /*
     * **La firma sola no alcanzaba, y el docblock decía que sí.** El NUL de
     * `JFIF\0` deja afuera a `JFXX` —el thumbnail de *otro* APP0— pero el JFIF
     * base tiene el suyo: bytes 12 y 13 del cuerpo (`Xthumbnail`,
     * `Ythumbnail`) y hasta 255×255×3 de RGB sin comprimir. Es la misma
     * imagen-adentro-de-la-imagen de **antes** de cualquier recorte, y con la
     * primera versión de la lista blanca pasaba las dos capas: la firma
     * matcheaba y el segmento se copiaba entero.
     *
     * MUTACIÓN PROBADA: sacarle el `ademas: jfifSinThumbnail` a la entrada
     * `0xe0` de `APPN_JPEG_SEGUROS` deja este caso en rojo y el par de control
     * en verde.
     */
    const MINIATURA = [0xca, 0xfe, 0xba, 0xbe, 0x11, 0x22];
    const conThumbnail = jpegCompleto(
      seg(0xe0, [
        ...cadena('JFIF\u0000'),
        0x01, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01,
        0x01, 0x02, // Xthumbnail=1, Ythumbnail=2 → 6 bytes de RGB
        ...MINIATURA,
      ]),
    );
    expect(contiene(conThumbnail, MINIATURA), 'el fixture no quedó armado').toBe(true);

    const limpio = sinMetadatos('image/jpeg', conThumbnail);
    expect(contiene(limpio, MINIATURA), 'la miniatura embebida tiene que irse').toBe(false);
    // Y el par de control, que es lo que hace que el caso no sea «se tira el
    // APP0 y listo»: el JFIF sin thumbnail sigue conservándose.
    expect(contiene(sinMetadatos('image/jpeg', jpegCompleto()), cadena('JFIF'))).toBe(true);
  });

  it('un marcador reservado tampoco se conserva: el corte es por estructura, no por «APPn»', () => {
    /*
     * **La primera versión de la regla decía «se tira lo que es APPn o COM», y
     * eso dejaba conservados los `JPG0`–`JPG13` (`0xF0`–`0xFD`, «reserved for
     * JPEG extensions»: un contenedor sin reglas) y los reservados
     * `0x02`–`0xBF`.** El recorrido los trata como segmentos con largo
     * declarado, así que se copiaban enteros — igual que con la lista negra, y
     * desmintiendo la propiedad que este archivo vende. Lo marcó el
     * `auditor-privacidad`.
     *
     * El corte ahora es al revés: se conserva lo que está en
     * `MARCADORES_ESTRUCTURALES` (la tabla B.1 del spec, que es **cerrada**) y
     * se tira todo lo demás.
     *
     * MUTACIÓN PROBADA: volver a `!((m >= 0xe0 && m <= 0xef) || m === 0xfe)`
     * deja este caso en rojo y el resto del `describe` en verde.
     */
    const CARGA = cadena('reservado');
    const conReservado = jpegCompleto(seg(0xf7, CARGA));
    expect(contiene(conReservado, CARGA), 'el fixture no quedó armado').toBe(true);

    const limpio = sinMetadatos('image/jpeg', conReservado);
    expect(contiene(limpio, CARGA), 'un marcador reservado tiene que irse').toBe(false);
    // Y la imagen sigue entera: lo estructural no pasa por la lista.
    expect(dimensiones('image/jpeg', limpio)).toEqual({ ancho: 1200, alto: 800 });
  });

  it('el marcador JPG (0xC8) no es estructural y también se va — lo pidieron los dos auditores', () => {
    /*
     * **La primera versión del conjunto estructural lo metió adentro porque
     * cae en el rango `0xC*`, y eso es falso**: la tabla B.1 lista `0xC8` como
     * `JPG`, «reserved for JPEG extensions» — el mismo caso que los
     * `JPG0`–`JPG13` de `0xF0`–`0xFD`, que el caso de acá abajo tira. Así que
     * se conservaba entero y sin mirarle el cuerpo mientras su gemelo se
     * tiraba, en las dos capas a la vez (es el costo del punto único de
     * decisión que D-620 declara).
     *
     * El propio repo ya lo sabía: `ES_SOF` lo excluye junto a `0xC4` y `0xCC`,
     * y por eso `dimensiones` nunca lo leyó como SOF.
     *
     * MUTACIÓN PROBADA: devolverle el `0xc8` a `MARCADORES_ESTRUCTURALES` deja
     * este caso en rojo y el resto en verde.
     */
    const CARGA = cadena('extension-reservada');
    const conJpg = jpegCompleto(seg(0xc8, CARGA));
    expect(contiene(conJpg, CARGA), 'el fixture no quedó armado').toBe(true);

    const limpio = sinMetadatos('image/jpeg', conJpg);
    expect(contiene(limpio, CARGA), 'el 0xC8 tiene que irse como el 0xF7').toBe(false);
    expect(dimensiones('image/jpeg', limpio)).toEqual({ ancho: 1200, alto: 800 });
  });

  it('un JFIF sin thumbnail pero con cola pegada tampoco se conserva', () => {
    /*
     * **Reconocer la firma no acota el cuerpo, y el docblock afirmaba que
     * sí.** Lo que se copia sale del **largo declarado**, así que un APP0 que
     * arranque con `JFIF\0`, tenga los dos bytes del thumbnail en cero y
     * declare 500 bytes se conservaba entero: la misma clase que
     * `jfifSinThumbnail` cierra, un nivel más afuera. Lo marcó el
     * `auditor-privacidad` sobre el propio arreglo.
     *
     * Los dos segmentos de forma fija se acotan al byte: JFIF **16**, Adobe
     * **14**. El ICC no, y ése es el residuo declarado de D-620.
     *
     * MUTACIÓN PROBADA: sacar el `deLargoExacto(16)` de `jfifDeVerdad` deja
     * este caso en rojo; sacar el `deLargoExacto(14)` del `0xee` deja en rojo
     * el segundo bloque.
     */
    const COLA = cadena('cola-pegada-al-JFIF');
    const conCola = jpegCompleto(
      seg(0xe0, [...cadena('JFIF\u0000'), 0x01, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, ...COLA]),
    );
    expect(contiene(conCola, COLA), 'el fixture no quedó armado').toBe(true);
    // El APP0 legítimo del fixture está antes, así que la salida conserva un
    // JFIF: lo que no puede sobrevivir es el segundo, el de la cola.
    expect(contiene(sinMetadatos('image/jpeg', conCola), COLA)).toBe(false);

    // Y lo mismo con el Adobe de APP14, que también es de forma fija.
    const COLA_ADOBE = cadena('cola-pegada-al-Adobe');
    const conAdobe = jpegCompleto(
      seg(0xee, [...cadena('Adobe'), 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, ...COLA_ADOBE]),
    );
    expect(contiene(conAdobe, COLA_ADOBE), 'el fixture no quedó armado').toBe(true);
    expect(contiene(sinMetadatos('image/jpeg', conAdobe), COLA_ADOBE)).toBe(false);
    // Control: un APP14 de Adobe legítimo (14 bytes) sí se conserva.
    const adobeOk = jpegCompleto(
      seg(0xee, [...cadena('Adobe'), 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00]),
    );
    expect(contiene(sinMetadatos('image/jpeg', adobeOk), cadena('Adobe'))).toBe(true);
  });

  it('un APPn que nadie enumeró se va, y la imagen sigue entera', () => {
    /*
     * **La propiedad de fondo**, calcada del `'zzZZ'` que B-323 escribió para
     * PNG: con la lista blanca, un APPn que no está enumerado se tira **lo
     * haya visto alguien antes o no**. Es lo que hace que el próximo bloque
     * que invente un fabricante no repita el caso de C2PA.
     *
     * `0xE7` (APP7) no lo usa nadie que nos importe y no está en la lista: está
     * elegido para eso, igual que `'zzZZ'`.
     *
     * MUTACIÓN PROBADA: volver a cualquier lista negra —la vieja incluida—
     * pone este caso en rojo aunque el de C2PA siga verde, porque ese se puede
     * tapar a mano agregando `0xEB`.
     */
    const RAREZA = cadena('FabricanteX');
    const conRareza = jpegCompleto(seg(0xe7, RAREZA));
    expect(contiene(conRareza, RAREZA)).toBe(true);

    const limpio = sinMetadatos('image/jpeg', conRareza);
    expect(contiene(limpio, RAREZA), 'un APPn no enumerado tiene que irse').toBe(false);
    expect(contiene(limpio, DATOS_COMPRIMIDOS)).toBe(true);
  });

  it('lo que hace falta para decodificar NO pasa por la lista: se conserva por clase', () => {
    /*
     * **La respuesta al argumento con el que B-323 dejó el JPEG en negra** —«la
     * lista blanca de APPn sí se queda corta seguido»—. Es cierto, y acá el
     * costo de quedarse corto es perder una extensión de aplicación que el
     * navegador no mira, no romper la imagen: la lista blanca gobierna **solo**
     * los APPn y el COM. Todo lo estructural —DQT, DHT, DRI, SOF, SOS y el dato
     * comprimido— se conserva porque no es de esa clase, sin estar enumerado en
     * ningún lado.
     *
     * MUTACIÓN PROBADA: hacer que `seConserva` consulte la lista para todos
     * los marcadores (sacarle el `esMarcadorEstructural(marcador) ||`) deja
     * este caso en rojo con un JPEG que ya no se puede decodificar.
     */
    const estructurales = [
      [0xdb, 'DQT'],
      [0xc4, 'DHT'],
      [0xcc, 'DAC'],
      [0xdd, 'DRI'],
      [0xdc, 'DNL'],
      [0xde, 'DHP'],
      [0xdf, 'EXP'],
      [0xc0, 'SOF0'],
      [0xda, 'SOS'],
    ] as const;
    // Los que llevan cuerpo van al fixture; los sin cuerpo (RSTn, TEM) tienen
    // su propio caso más abajo, porque `seg()` no sirve para armarlos.
    const conTodos = jpegCompleto(
      estructurales
        .filter(([m]) => m !== 0xc0 && m !== 0xda && m !== 0xc4 && m !== 0xdb && m !== 0xdd)
        .flatMap(([m]) => seg(m, [0x00, 0x01])),
    );
    const limpio = sinMetadatos('image/jpeg', conTodos);
    for (const [marcador, nombre] of estructurales) {
      expect(contiene(limpio, [0xff, marcador]), `se fue el ${nombre}`).toBe(true);
    }
    expect(contiene(limpio, DATOS_COMPRIMIDOS)).toBe(true);
    // Y el alto y el ancho se siguen pudiendo leer, que es la prueba de que el
    // SOF sobrevivió como segmento y no como coincidencia de dos bytes.
    expect(dimensiones('image/jpeg', limpio)).toEqual({ ancho: 1200, alto: 800 });

    /*
     * **Los estructurales SIN cuerpo, que son los que ninguna otra cosa
     * ejercita** — lo pidió el `auditor-trampas`: sacar `0xD0` del conjunto
     * dejaba la suite entera en verde. No se arman con `seg()` porque no
     * llevan largo declarado; el recorrido los pasa como dos bytes pelados.
     */
    const sinCuerpo = [0xd0, 0xd7, 0x01] as const;
    const conSueltos = new Uint8Array([
      ...jpegCompleto().slice(0, 2),
      ...sinCuerpo.flatMap((m) => [0xff, m]),
      ...jpegCompleto().slice(2),
    ]);
    const limpioSueltos = sinMetadatos('image/jpeg', conSueltos);
    for (const m of sinCuerpo) {
      expect(contiene(limpioSueltos, [0xff, m]), `se fue el 0x${m.toString(16)}`).toBe(true);
    }
    expect(dimensiones('image/jpeg', limpioSueltos)).toEqual({ ancho: 1200, alto: 800 });
  });

  it('el cartel del rechazo no le echa la culpa al teléfono — B-869', () => {
    /*
     * El mensaje viejo decía «algunos celulares le guardan una segunda copia
     * adentro» y mandaba a abrir el editor de fotos: para el caso que de verdad
     * lo disparaba —C2PA en APP11— eso era **falso**, y le pedía a la persona
     * que arreglara algo que no estaba roto de su lado.
     *
     * Va sobre el fuente porque `subirImagen` habla con Storage y ningún test
     * lo ejecuta, igual que los casos de B-324.
     *
     * MUTACIÓN PROBADA: restaurar el texto viejo deja este caso en rojo.
     */
    const src = readFileSync(`${process.cwd()}/src/lib/subir-imagen.ts`, 'utf8');
    const desde = src.indexOf('if (quedanMetadatos(limpio))');
    expect(desde, 'no está el barrido en la subida').toBeGreaterThan(-1);
    const mensaje = src.slice(desde, desde + 600);
    expect(mensaje, 'el cartel sigue diagnosticando el teléfono').not.toContain('segunda copia');
    expect(mensaje).not.toContain('editor de fotos del teléfono');
    // Y dice lo único que sabemos: quedó un bloque que no supimos sacar.
    expect(mensaje).toContain('no supimos sacar');
    /*
     * **Y no pide que manden la foto.** Este mismo pipeline lo usa
     * `/proponer`, así que quien lee el cartel puede ser alguien sin cuenta:
     * pedirle el archivo que la oración anterior describió como portador de la
     * ubicación mueve un dato personal de un tercero a una casilla de mail,
     * fuera de la retención de B-838. Lo pidió el `auditor-privacidad`.
     *
     * MUTACIÓN PROBADA: volver a «avisá con esta foto» deja este aserto en
     * rojo.
     */
    expect(mensaje, 'el cartel pide que manden el archivo').not.toMatch(
      /avisá con esta foto|mandanos la foto|adjunt/i,
    );
  });
});


describe('alto y ancho salen del encabezado', () => {
  it('JPEG: los lee del SOF', () => {
    expect(dimensiones('image/jpeg', jpeg({ ancho: 1600, alto: 900 }))).toEqual({
      ancho: 1600,
      alto: 900,
    });
  });

  it('JPEG: se pueden leer también después de limpiar', () => {
    // Es el orden real de `subirImagen`: primero se limpia, después se mide. Si
    // la limpieza rompiera el SOF, la medida saldría `null` y la tarjeta del
    // sitio volvería a saltar al cargar.
    const limpio = sinMetadatos('image/jpeg', jpeg({ ancho: 1200, alto: 800 }));
    expect(dimensiones('image/jpeg', limpio)).toEqual({ ancho: 1200, alto: 800 });
  });

  it('PNG: los lee del IHDR', () => {
    expect(dimensiones('image/png', png({ ancho: 640, alto: 480 }))).toEqual({
      ancho: 640,
      alto: 480,
    });
  });

  it('lo que no se puede medir devuelve null, y no cero', () => {
    // `0` publicado como `ancho` haría que el sitio reserve un hueco de cero
    // píxeles, que es peor que no reservar ninguno.
    expect(dimensiones('image/jpeg', new Uint8Array([1, 2, 3]))).toBeNull();
    expect(dimensiones('image/png', new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('motivoDeSubidaFallida — el motivo real de una subida que falla (B-590)', () => {
  /*
   * El pedido del dueño: «cuando una imagen no se pueda subir, incluí el motivo».
   * Antes el `catch` de `subir-imagen.ts` decía SIEMPRE «fijate la conexión»,
   * falso para el caso más común —permiso o sesión vencida—, que fue el «da
   * error subir imágenes» de los reportes #14/#15/#19.
   */
  it('un problema de permiso o sesión no dice «fijate la conexión»', () => {
    for (const code of ['storage/unauthorized', 'storage/unauthenticated']) {
      const { mensaje, causa } = motivoDeSubidaFallida(code);
      expect(causa, code).toBe('permiso');
      expect(mensaje, code).toMatch(/sesión|permiso/i);
      expect(mensaje, code).not.toMatch(/conexión|más chica/i);
    }
  });

  it('la cuota llena se nombra como espacio, no como red', () => {
    const { mensaje, causa } = motivoDeSubidaFallida('storage/quota-exceeded');
    expect(causa).toBe('servidor');
    expect(mensaje).toMatch(/espacio|lugar/i);
  });

  it('un corte de conexión sí habla de la señal', () => {
    for (const code of ['storage/retry-limit-exceeded', 'storage/canceled']) {
      const { mensaje, causa } = motivoDeSubidaFallida(code);
      expect(causa, code).toBe('red');
      expect(mensaje, code).toMatch(/conexión|señal/i);
    }
  });

  it('un código desconocido lo incluye en el texto, en vez de esconderlo', () => {
    const { mensaje, causa } = motivoDeSubidaFallida('storage/algo-nuevo');
    expect(mensaje).toContain('storage/algo-nuevo');
    expect(causa).toBe('servidor');
  });

  it('sin código cae a un genérico, sin inventar un motivo', () => {
    const { mensaje } = motivoDeSubidaFallida(undefined);
    expect(mensaje).toMatch(/no se pudo subir/i);
    expect(mensaje).not.toMatch(/storage\//);
  });

  it('toda causa que devuelve está en el vocabulario de la analítica (§9, B-88)', () => {
    // La causa viaja a GA4; una que el vocabulario no conoce llega como «otro» en
    // silencio. Se cubren los códigos conocidos más uno desconocido y el vacío.
    for (const code of [
      'storage/unauthorized',
      'storage/unauthenticated',
      'storage/quota-exceeded',
      'storage/retry-limit-exceeded',
      'storage/canceled',
      'storage/lo-que-sea',
      undefined,
    ]) {
      expect(MOTIVOS_IMAGEN as readonly string[], code).toContain(
        motivoDeSubidaFallida(code).causa,
      );
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La orientación EXIF, que `sinMetadatos` se lleva puesta — B-324
// ───────────────────────────────────────────────────────────────────────────

/**
 * Un JPEG mínimo con un APP1 EXIF que declara `Orientation`.
 *
 * Se arma a mano —y en los **dos órdenes de bytes**— porque el parseo real que
 * hay que verificar es justamente ése: el EXIF es un TIFF embebido, y un TIFF
 * puede venir little-endian (`II`, lo normal en cámaras) o big-endian (`MM`, lo
 * que escriben algunos teléfonos). Un fixture en un solo orden dejaría la mitad
 * del código sin ejercitar, y la mitad que quedaría afuera es aritmética de
 * bytes: la que se equivoca en silencio.
 */
const conOrientacion = (valor: number, chico = true): Uint8Array => {
  const u16 = (v: number) => (chico ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    chico
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];

  const tiff = [
    ...(chico ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42), // la verificación del TIFF
    ...u32(8), // el primer directorio arranca en el byte 8
    ...u16(1), // una entrada
    ...u16(0x0112), // tag Orientation
    ...u16(3), // tipo SHORT
    ...u32(1), // cantidad
    ...u16(valor), 0, 0, // el valor, en los primeros dos bytes de los cuatro
    ...u32(0), // no hay directorio siguiente
  ];

  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const largo = exif.length + 2;
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, largo >> 8, largo & 0xff, ...exif, // APP1
    0xff, 0xda, 0x00, 0x02, // SOS
    0xff, 0xd9, // EOI
  ]);
};

describe('orientacionExif — el dato que `sinMetadatos` tira (B-324)', () => {
  it('lee el valor en los dos órdenes de bytes', () => {
    /*
     * Los cuatro valores elegidos son los que produce una cámara de teléfono: 1
     * derecha, 3 al revés, 6 y 8 los dos costados. Los otros cuatro (2, 4, 5, 7)
     * llevan espejado y son los que hacen que rotar en la Function sea más
     * delicado que multiplicar por 90 — están en el caso de abajo.
     */
    for (const v of [1, 3, 6, 8]) {
      expect(orientacionExif('image/jpeg', conOrientacion(v, true)), `II ${v}`).toBe(v);
      expect(orientacionExif('image/jpeg', conOrientacion(v, false)), `MM ${v}`).toBe(v);
    }
  });

  it('acepta los ocho valores del rango y rechaza lo de afuera', () => {
    // El rango es 1 a 8 por spec. Un 0 o un 9 es un archivo roto o algo que no es
    // una orientación, y ahí `null` —«no sé»— es más honesto que un número.
    for (const v of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(orientacionExif('image/jpeg', conOrientacion(v)), `valor ${v}`).toBe(v);
    }
    expect(orientacionExif('image/jpeg', conOrientacion(0))).toBeNull();
    expect(orientacionExif('image/jpeg', conOrientacion(9))).toBeNull();
  });

  it('devuelve null —«no sé»— y no 1, cuando no puede leerlo', () => {
    /*
     * **La distinción que hace usable al aviso.** `null` no significa «está
     * derecha»: significa que no se sabe. El llamador solo avisa cuando hay un
     * número **y** no es 1, así que con `null` no dice nada — y un falso «tu foto
     * está de costado» sobre un flyer derecho es exactamente lo que enseña a
     * ignorar un aviso (B-180).
     */
    expect(orientacionExif('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    expect(orientacionExif('image/jpeg', new Uint8Array([1, 2, 3]))).toBeNull();
    // Un PNG: las cámaras no escriben EXIF ahí, y el parseo es de JPEG.
    expect(orientacionExif('image/png', conOrientacion(6))).toBeNull();
  });

  it('y `sinMetadatos` se lo lleva puesto: por eso hay que leerlo ANTES', () => {
    /*
     * **El caso que explica el orden de las dos líneas en `subirImagen`.** El tag
     * vive en el APP1 y `sinMetadatos` tira ese bloque entero **sin rotar los
     * píxeles**, así que después de limpiar el dato no existe: leerlo del archivo
     * limpio daría `null` siempre y el aviso nunca saldría, sin que nada se
     * pusiera rojo.
     *
     * MUTACIÓN PROBADA: mover el `orientacionExif` abajo del `sinMetadatos` en
     * `subir-imagen.ts` deja este caso **verde** —es de otro módulo, acá se
     * verifica la propiedad y no el orden— y pone en rojo el de más abajo,
     * «la orientación se lee ANTES de sacar los metadatos», que afirma el orden
     * sobre el fuente. Por eso están los dos, y por eso el de abajo no es
     * redundante: es la **única** red del orden, porque `subirImagen` habla con
     * Storage y ningún test lo ejecuta.
     *
     * (El comentario original mandaba a un `tests/subir-imagen.test.ts` que no
     * existe. Lo cobró el `auditor-trampas`, y era justo la clase de error que
     * hace que alguien borre el test de abajo por creerlo duplicado.)
     */
    const crudo = conOrientacion(6);
    expect(orientacionExif('image/jpeg', crudo)).toBe(6);
    expect(orientacionExif('image/jpeg', sinMetadatos('image/jpeg', crudo))).toBeNull();
  });

  it('un IFD que apunta afuera, o que declara más entradas de las que hay, da null', () => {
    /*
     * **El caso que pidió el `auditor-trampas`, y el motivo por el que existe.**
     * Los offsets de este parser vienen del archivo que sube un tercero: el byte
     * que dice «el directorio arranca acá» y el que dice «tiene N entradas» son
     * datos, no estructura. Un JPEG cortado a la mitad por una subida que se
     * interrumpió alcanza para que apunten a cualquier lado.
     *
     * Lo que se exige es `null` y **no** una excepción: `subirImagen` llama a esto
     * antes de subir, así que un `throw` acá no sería «no sé la orientación», sería
     * **la subida entera caída** por una foto con el EXIF raro.
     *
     * ── Y la mutación desmintió el motivo que este caso iba a declarar ──────
     * Iba escrito que sacar las dos guardas del parser (`ifd + 2 > hasta`,
     * `entrada + 12 > hasta`) ponía esto en rojo con un `RangeError`. **Se probó y
     * es falso: sin ninguna de las dos, los dos casos siguen verdes.** El motivo
     * es del lenguaje y no del código: un índice fuera de rango en un
     * `Uint8Array` no tira, devuelve `undefined`, y los operadores de bits lo
     * convierten en 0 — así que el parser lee ceros, no encuentra el tag y se
     * apaga solo.
     *
     * Eso cambia **qué** verifica este caso y para qué sirven las guardas:
     *
     * - **la seguridad ante un archivo roto no viene de las guardas**, viene de
     *   cómo se leen los bytes. Por eso el aserto es `not.toThrow()` sobre un
     *   fixture **efectivamente roto** y no una lectura de las guardas: si algún
     *   día el parser pasa a `DataView` —cuyo `getUint16` **sí** tira
     *   `RangeError`— este caso se pone en rojo, que es exactamente cuando las
     *   guardas dejarían de ser un lujo;
     * - **las guardas acotan el trabajo, no el crash**: cortan el recorrido en vez
     *   de barrer las hasta 65535 entradas que `cuantas` puede declarar. Por eso
     *   se quedan, y por eso no hay un caso que las afirme por separado — sería un
     *   test de rendimiento disfrazado.
     */
    const roto = (retoque: (tiff: number[]) => void): Uint8Array => {
      const base = [...conOrientacion(6)];
      // El TIFF arranca después de SOI (2) + marca APP1 (2) + largo (2) + 'Exif\0\0' (6).
      const tiff = 12;
      const bytes = base.slice(tiff);
      retoque(bytes);
      return new Uint8Array([...base.slice(0, tiff), ...bytes]);
    };

    // a · el offset del primer directorio se va del segmento (`u32(8)` → 9999).
    const afuera = roto((t) => {
      t[4] = 0x0f;
      t[5] = 0x27;
    });
    expect(() => orientacionExif('image/jpeg', afuera)).not.toThrow();
    expect(orientacionExif('image/jpeg', afuera)).toBeNull();

    // b · el directorio dice 50 entradas y hay lugar para una.
    const infladas = roto((t) => {
      t[8] = 50;
    });
    expect(() => orientacionExif('image/jpeg', infladas)).not.toThrow();
    /*
     * Acá el `null` **no** es lo único aceptable y por eso el aserto es el otro:
     * la primera entrada del directorio sí está y sí es la Orientation, así que
     * encontrarla es correcto. Lo que se exige es que las 49 que no existen no
     * revienten nada — o sea, `6` o `null`, nunca una excepción.
     */
    expect([6, null]).toContain(orientacionExif('image/jpeg', infladas));
  });

  it('el 1 no es un caso especial acá: la decisión de no avisar es del llamador', () => {
    /*
     * Esta función devuelve lo que el archivo dice, incluido el 1. Convertir el 1
     * en `null` acá mezclaría dos cosas distintas —«derecha» y «no sé»— y
     * dejaría al llamador sin poder distinguirlas. La conversión pasa en
     * `subirImagen`, con `ORIENTACION_DERECHA`, que es donde vive la decisión de
     * qué se avisa.
     */
    expect(orientacionExif('image/jpeg', conOrientacion(ORIENTACION_DERECHA))).toBe(1);
  });
});

describe('el aviso de rotación está cableado donde tiene que estar — B-324', () => {
  const fuente = (rel: string): string => readFileSync(`${process.cwd()}/${rel}`, 'utf8');

  it('la orientación se lee ANTES de sacar los metadatos', () => {
    /*
     * **El orden de dos líneas, y no se puede verificar corriéndolo:**
     * `subirImagen` habla con Storage, así que no hay test que lo ejecute. Lo que
     * sí se puede afirmar es el orden en el fuente, y es lo único que hace que el
     * aviso exista: el tag vive en el APP1 y `sinMetadatos` tira ese bloque, así
     * que leerlo después daría `null` siempre.
     *
     * Un `null` siempre **no rompe nada visible**: la subida sale bien y el aviso
     * simplemente no aparece nunca. Es el modo de falla que este caso frena, y la
     * razón por la que se afirma el orden y no la existencia de las dos llamadas.
     *
     * MUTACIÓN PROBADA: mover el `orientacionExif` abajo del `sinMetadatos` deja
     * este caso en rojo.
     */
    const src = fuente('src/lib/subir-imagen.ts');
    const lee = src.indexOf('orientacionExif(tipo, crudo)');
    const limpia = src.indexOf('sinMetadatos(tipo, crudo)');

    expect(lee, 'no se lee la orientación en la subida').toBeGreaterThan(-1);
    expect(limpia, 'no se sacan los metadatos en la subida').toBeGreaterThan(-1);
    expect(lee, 'la orientación se lee después de limpiar: siempre va a dar null').toBeLessThan(
      limpia,
    );
    // Y del CRUDO, no del limpio: leerla del limpio es la misma falla con otra
    // forma, y pasaría el orden de arriba.
    expect(src).toContain('orientacionExif(tipo, crudo)');
  });

  it('lo que sube a Storage es el archivo limpio y nunca el crudo', () => {
    /*
     * **Lo pidió el `auditor-privacidad`, y es el hallazgo más caro de los que
     * encontró.** B-324 le dio a `crudo` un **segundo consumidor**
     * (`orientacionExif`) después del punto donde antes quedaba consumido, así que
     * ahora hay dos arrays vivos en la misma función: uno con el EXIF adentro
     * —GPS incluido— y uno limpio. Y lo único que los distingue en la línea del
     * `uploadBytes` es **una palabra**.
     *
     * Un `uploadBytes(destino, crudo, …)` no lo frena nada de lo que ya existe:
     * pasaría `quedanMetadatos` —que barre `limpio`, o sea otra variable— y
     * pasaría `storage.rules`, porque el `contentType` es el mismo. Publicaría las
     * coordenadas de una casa particular, y eso **no se despublica**.
     *
     * Va sobre el fuente por lo mismo que el orden: `subirImagen` habla con
     * Storage y ningún test lo ejecuta. Es el aserto que hace verdadera la frase
     * de `docs/06-decisiones.md` —«el barrido se hace en los bytes que se van a
     * subir»—, que hasta acá era verdad por coincidencia de nombres.
     *
     * MUTACIÓN PROBADA: cambiar `limpio` por `crudo` en el `uploadBytes` deja el
     * resto de la suite en verde y solo este caso en rojo.
     */
    const src = fuente('src/lib/subir-imagen.ts');
    expect(src).toContain('uploadBytes(destino, limpio');
    expect(src, 'sube el crudo, con el EXIF adentro').not.toMatch(
      /uploadBytes\([^)]*\bcrudo\b/,
    );
    // Y que el barrido siga mirando lo mismo que se sube, no la otra variable.
    expect(src).toContain('quedanMetadatos(limpio');
  });

  it('la foto derecha no avisa ni se mide: el 1 se convierte en null', () => {
    /*
     * **La otra que pidió el `auditor-privacidad`.** `orientacionExif` devuelve el
     * `1` a propósito —«derecha» es un dato tan válido como «de costado»— así que
     * la decisión de qué se avisa vive en `subirImagen`, en una sola línea, que es
     * justo la parte que ningún test ejecuta.
     *
     * Esa línea sostiene dos afirmaciones a la vez: la fila «el número de
     * Orientation, 2 a 8» de `docs/09-analitica.md`, y el «no avisa de más» del
     * BACKLOG. Si se cae, **cada foto derecha** dispara el aviso y emite un
     * `imagen-rotada` con `valor: 1`. No es una fuga —el 1 no es contenido— pero
     * deja la fila de la tabla falsa y convierte el aviso en un cartel que se
     * aprende a ignorar, que es la clase de B-180 y el motivo por el que el dueño
     * eligió avisar en vez de rotar.
     *
     * El sanitizador no lo tapa: acota a `[-366, 1000]` y es **uno por parámetro,
     * no por función** (B-797), así que el 1 pasa entero.
     */
    expect(fuente('src/lib/subir-imagen.ts')).toContain(
      'orientacion === ORIENTACION_DERECHA ? null : orientacion',
    );
  });

  it('el panel lo muestra como aviso y no como error', () => {
    /*
     * Las dos diferencias con el error de subida, que son deliberadas y las dos
     * se pueden perder de un copy-paste:
     *
     * - **`role="status"` y no `role="alert"`**: un `alert` interrumpe al lector
     *   de pantalla, y esto no es una urgencia — la subida salió bien.
     * - **la tinta suave y no el acento**: el acento es el color de «algo se
     *   rompió» en este sistema visual (D-146). Pintar un aviso con el color del
     *   error hace que el próximo error de verdad se lea como un aviso.
     */
    const src = fuente('src/components/admin/GaleriaEditor.tsx');
    const bloque = /\{avisoDeRotacion && \([\s\S]*?\)\}/.exec(src)?.[0] ?? '';
    expect(bloque, 'no se encontró el aviso en el markup').not.toBe('');
    expect(bloque).toContain('role="status"');
    expect(bloque, 'el aviso usa el color del error').not.toContain('text-acento');
  });

  it('y el uso se mide, para poder revisar si avisar alcanzó', () => {
    /*
     * El dueño eligió **avisar** en vez de rotar, de tres salidas posibles. Esa
     * elección se puede revisar con números: si de cien fotos ninguna trae la
     * marca, el aviso es un cartel que nadie ve; si trae la mitad, rotar deja de
     * ser opcional. Sin el evento, la revisión sería una impresión.
     *
     * El `valor` es el número de `Orientation`, y eso decide lo otro que B-324
     * dejó abierto: si aparecen solo 3, 6 y 8 —las de una cámara de teléfono—
     * alcanza con cubrir las cuatro simples; si aparecen 2, 4, 5 o 7, hay
     * espejado y el mapeo es más delicado.
     */
    expect(FUNCIONES).toContain('imagen-rotada');
    expect(fuente('src/components/admin/GaleriaEditor.tsx')).toContain(
      "medirFuncion('imagen-rotada', undefined, orientacion)",
    );
  });
});
