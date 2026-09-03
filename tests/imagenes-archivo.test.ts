import { describe, expect, it } from 'vitest';
import {
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
