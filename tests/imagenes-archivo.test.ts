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
    ...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]), // APP0 (JFIF): se conserva
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
    // Lista negra y no blanca: se tira lo que se sabe que sobra, no se conserva
    // solo lo que se sabe que sirve. Sacar JFIF cambiaría la densidad declarada.
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
