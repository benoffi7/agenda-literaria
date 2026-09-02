/**
 * La Function que optimiza las imágenes propias — B-220, DEC-7d, D-175.
 *
 * ── Lo que este archivo existe para probar ────────────────────────────────
 * **La guarda anti-recursión, y probarla ejecutándola.** Es la trampa 12 del
 * §13 (la 3 con otra cara): el trigger es `onObjectFinalized` sobre el bucket y
 * escribe en ese mismo bucket, así que sin guarda se dispara a sí mismo y cada
 * imagen genera objetos hasta que la plataforma corta.
 *
 * Un test que afirmara «`decidirOptimizacion` devuelve ignorar» probaría la
 * función, no la propiedad. Lo que se prueba acá es la propiedad:
 * `describe('la recursión termina')` **corre el lazo** —el trigger, sus dos
 * escrituras, y los disparos que esas escrituras producen— y afirma que
 * converge. Sacá cualquiera de las dos guardas y el lazo llega al tope.
 *
 * Las dos mutaciones están anotadas en cada `it` y se corrieron una por una.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  AHORRO_MINIMO,
  ANCHO_MINIATURA,
  CACHE_OPTIMIZADO,
  LADO_MAXIMO,
  MARCA_OPTIMIZADA,
  PREFIJO_MINIATURAS,
  PREFIJO_ORIGINALES,
  VERSION_PIPELINE,
  contentTypeDe,
  convieneReemplazar,
  decidirOptimizacion,
  formatoDeSalida,
  idDeObjeto,
  metadatosDeSalida,
  rutaDeMiniatura,
} from '../functions/imagenes.js';
import { optimizar, traeMetadatos } from '../functions/imagenes-optimizar.js';
import {
  CACHE_AL_SUBIR,
  rutaDeMiniatura as rutaDeMiniaturaDelSitio,
  urlDeMiniatura,
} from '@/lib/imagenes';
import { rutaDeImagen } from '@/lib/imagenes-archivo';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

// ─────────────────────────────────────────────────────────────────────
// La guarda anti-recursión — trampa 12 (y trampa 3 con otra cara)
// ─────────────────────────────────────────────────────────────────────

/** Un objeto del bucket, con lo único que el trigger mira de él. */
type Objeto = {
  nombre: string;
  contentType: string;
  metadatos: Record<string, string>;
  bytes: number;
};

const subido = (nombre = 'imagenes/img_abc-123.jpg'): Objeto => ({
  nombre,
  contentType: nombre.endsWith('.png') ? 'image/png' : 'image/jpeg',
  // Una subida del panel **no** trae la marca: es lo que la distingue de lo que
  // escribe la Function.
  metadatos: { firebaseStorageDownloadTokens: 'tok-1' },
  bytes: 1_000_000,
});

/**
 * El bucket y el trigger, simulados. **Las escrituras son las mismas dos que
 * hace `imagenes-trigger.js`** —la salida principal encima del original y la
 * miniatura en su prefijo— y hay un `it` que verifica contra el fuente que
 * sigan siendo esas y que la guarda las domine, así que la simulación no puede
 * quedarse vieja en silencio.
 *
 * `optimizar()` de verdad no entra acá: lo que se prueba es el lazo, no los
 * píxeles. Los bytes bajan en cada pasada para que una guarda del estilo «no
 * cambió nada» no pueda pasar por casualidad — en Storage cada recompresión
 * produce bytes distintos, que es justo por qué esa guarda no alcanzaría.
 */
const bucketSimulado = () => {
  const objetos = new Map<string, Objeto>();
  const pendientes: string[] = [];
  const invocaciones: { nombre: string; accion: string; motivo: string | null }[] = [];

  const escribir = (o: Objeto) => {
    objetos.set(o.nombre, o);
    // Toda escritura de un objeto dispara `onObjectFinalized`. Es la plataforma,
    // no una decisión nuestra: por eso la guarda tiene que estar en el handler.
    pendientes.push(o.nombre);
  };

  const correrTrigger = (nombre: string) => {
    const o = objetos.get(nombre)!;
    const decision = decidirOptimizacion(o);
    invocaciones.push({ nombre, ...decision });
    if (decision.accion === 'ignorar') return;

    const marca = metadatosDeSalida({ token: o.metadatos.firebaseStorageDownloadTokens ?? null });
    // 1 · la salida principal, **encima del original**.
    escribir({ ...o, bytes: Math.max(1, Math.floor(o.bytes / 2)), metadatos: marca });
    // 2 · la miniatura, en el prefijo que el trigger ignora.
    const mini = rutaDeMiniatura(nombre);
    escribir({
      nombre: mini ?? `${PREFIJO_MINIATURAS}sin-id`,
      contentType: 'image/jpeg',
      metadatos: marca,
      bytes: 20_000,
    });
  };

  return {
    objetos,
    invocaciones,
    subir: (o: Objeto) => escribir(o),
    /** Vacía la cola de disparos. Devuelve cuántas vueltas dio, con tope. */
    drenar: (tope = 200) => {
      let vueltas = 0;
      while (pendientes.length > 0 && vueltas < tope) {
        correrTrigger(pendientes.shift()!);
        vueltas += 1;
      }
      return vueltas;
    },
  };
};

describe('la recursión termina — trampa 12, B-220', () => {
  it('subir una imagen dispara el trigger tres veces y para', () => {
    // **EL test de este frente.** Tres disparos: la subida (que optimiza), la
    // reescritura del original (que corta la marca) y la miniatura (que corta el
    // prefijo). Sin guarda esto no termina.
    //
    // Mutación 1 — sacar el corte por `MARCA_OPTIMIZADA` de
    // `decidirOptimizacion`: la reescritura del original vuelve a optimizar, y
    // esa reescritura vuelve a disparar. Llega al tope de 200.
    // Mutación 2 — sacar el corte por prefijo: la miniatura entra al handler y
    // produce otra miniatura, que produce otra. Llega al tope.
    // Las dos mueren, y por caminos distintos.
    const b = bucketSimulado();
    b.subir(subido());
    const vueltas = b.drenar();

    expect(vueltas).toBe(3);
    expect(b.invocaciones.map((i) => i.motivo)).toEqual([
      null,
      'ya-optimizada',
      'fuera-del-prefijo',
    ]);
    // Y el bucket queda con dos objetos: el original optimizado y su miniatura.
    expect([...b.objetos.keys()].sort()).toEqual([
      'imagenes/img_abc-123.jpg',
      'miniaturas/img_abc-123.jpg',
    ]);
  });

  it('las dos guardas cortan por separado, y ninguna tapa a la otra', () => {
    // El control que hace honesto al de arriba: si una sola guarda cortara las
    // dos escrituras, sacar la otra no rompería nada y el test de arriba pasaría
    // con media guarda puesta.
    //
    // La salida principal la corta **solo** la marca: cae en el prefijo de
    // originales, porque se escribe encima del original.
    expect(
      decidirOptimizacion({
        nombre: 'imagenes/img_abc-123.jpg',
        contentType: 'image/jpeg',
        metadatos: { [MARCA_OPTIMIZADA]: VERSION_PIPELINE },
      }).motivo,
    ).toBe('ya-optimizada');

    // La miniatura la corta **solo** el prefijo si algún día se escribiera sin
    // marca — y se prueba sin marca justamente por eso.
    expect(
      decidirOptimizacion({
        nombre: 'miniaturas/img_abc-123.jpg',
        contentType: 'image/jpeg',
        metadatos: {},
      }).motivo,
    ).toBe('fuera-del-prefijo');
  });

  it('la marca se detecta por presencia y no por valor', () => {
    // Comparar contra `VERSION_PIPELINE` haría que subir la versión reprocese el
    // bucket... y que cada reproceso se reprocese: el loop, disfrazado de
    // migración. Un valor viejo, o vacío, sigue cortando.
    for (const valor of ['1', '99', '']) {
      expect(
        decidirOptimizacion({
          nombre: 'imagenes/img_x.jpg',
          contentType: 'image/jpeg',
          metadatos: { [MARCA_OPTIMIZADA]: valor },
        }).accion,
      ).toBe('ignorar');
    }
  });

  it('un prefijo inventado mañana también se ignora', () => {
    // Un trigger de Storage v2 **no se puede filtrar por prefijo en la
    // declaración**: se suscribe al bucket entero. Así que el corte por prefijo
    // no es solo para `miniaturas/` — es para cualquier objeto del bucket.
    for (const nombre of ['otra-cosa/img_x.jpg', 'img_x.jpg', 'imagenes/sub/img_x.jpg', '']) {
      expect(
        decidirOptimizacion({ nombre, contentType: 'image/jpeg', metadatos: {} }).motivo,
        nombre,
      ).toBe('fuera-del-prefijo');
    }
  });

  it('la guarda domina las escrituras en el fuente del trigger', () => {
    // Lo que ata la simulación de arriba al código real, y es la clase de B-83:
    // una guarda que decide bien pero está **debajo** del efecto no guarda nada.
    const src = fuente('functions/imagenes-trigger.js');
    const guarda = src.indexOf('decidirOptimizacion(');
    const corte = src.indexOf('return;');
    const primeraEscritura = src.search(/\.(save|setMetadata)\(/);

    expect(guarda, 'el trigger ya no llama a decidirOptimizacion').toBeGreaterThan(-1);
    expect(primeraEscritura, 'el trigger ya no escribe nada').toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(corte);
    expect(corte, 'hay una escritura antes del return de la guarda').toBeLessThan(primeraEscritura);
  });

  it('el trigger escribe exactamente las direcciones que la simulación imita', () => {
    // Si mañana escribe una tercera, la simulación de arriba dejaría de cubrir
    // el lazo completo y este test es el que avisa.
    const src = fuente('functions/imagenes-trigger.js');
    expect([...src.matchAll(/\.(?:save|setMetadata)\(/g)].length).toBe(3);
    expect(src).toContain('original.save(');
    expect(src).toContain('original.setMetadata(');
    expect(src).toContain('rutaDeMiniatura(nombre)');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Las constantes que viven en dos archivos y nadie compara — clase de B-88
// ─────────────────────────────────────────────────────────────────────

describe('lo que está escrito dos veces, atado', () => {
  it('el prefijo de originales es el mismo en la Function, en el panel y en las reglas', () => {
    expect(rutaDeImagen('img_x', 'image/jpeg').startsWith(PREFIJO_ORIGINALES)).toBe(true);
    expect(fuente('storage.rules')).toContain(`match /${PREFIJO_ORIGINALES}{archivo}`);
  });

  it('el prefijo de miniaturas es el mismo en la Function, en el sitio y en las reglas', () => {
    // Y **hermano** de `imagenes/`, no anidado: anidarlo obliga a `{ruta=**}` en
    // las reglas y ahí se reabre la trampa 13.
    expect(PREFIJO_MINIATURAS).toBe('miniaturas/');
    expect(fuente('src/lib/imagenes.ts')).toContain(`'${PREFIJO_MINIATURAS}'`);
    expect(fuente('storage.rules')).toContain(`match /${PREFIJO_MINIATURAS}{archivo}`);
    expect(fuente('storage.rules')).not.toContain('match /imagenes/{ruta=**}');
  });

  it('el sitio y la Function derivan la misma ruta de miniatura', () => {
    // Un productor y un consumidor que derivan por separado el mismo formato.
    // La Function no se puede importar desde `src/` (arrastraría `sharp` al
    // árbol del panel), así que la duplicación es inevitable y lo que se hace es
    // fijarla.
    for (const path of ['imagenes/img_abc-123.jpg', 'imagenes/img_811f3831-030c.png']) {
      expect(rutaDeMiniaturaDelSitio(path)).toBe(rutaDeMiniatura(path));
      expect(rutaDeMiniaturaDelSitio(path)).toMatch(/^miniaturas\/img_[\w-]+\.jpg$/);
    }
    // Y los rechazos también tienen que coincidir: si uno acepta lo que el otro
    // rechaza, el sitio pide una dirección que la Function nunca escribió.
    for (const path of ['miniaturas/img_x.jpg', 'imagenes/tapa.jpg', 'imagenes/img_x.webp', '']) {
      expect(rutaDeMiniaturaDelSitio(path)).toBe(rutaDeMiniatura(path));
      expect(rutaDeMiniaturaDelSitio(path)).toBeNull();
    }
  });

  it('el cache corto de la subida y el largo de la Function encajan', () => {
    // La subida NO puede ser inmutable: la Function reemplaza esos bytes unos
    // segundos después. Y la Function SÍ tiene que serlo, o se paga egreso de
    // GCS para siempre.
    expect(CACHE_AL_SUBIR).not.toContain('immutable');
    expect(CACHE_OPTIMIZADO).toContain('immutable');
    expect(fuente('src/lib/subir-imagen.ts')).toContain('CACHE_AL_SUBIR');
    // El de la subida tiene que ser corto de verdad, no un año sin la palabra.
    const segundos = Number(/max-age=(\d+)/.exec(CACHE_AL_SUBIR)![1]);
    expect(segundos).toBeLessThanOrEqual(3600);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Qué se reemplaza y a qué formato — las decisiones medidas
// ─────────────────────────────────────────────────────────────────────

describe('cuándo conviene reemplazar los bytes del original', () => {
  it('un JPEG que ya está bien comprimido no se toca', () => {
    // Medido el 2026-09-02 sobre las 30 imágenes de producción: 29 son JPEG y
    // recomprimirlas ahorra entre 0 y 5 %, y en dos casos el resultado pesa
    // **más** (92,6 KB -> 92,7 KB y 100,9 KB -> 101,1 KB). Recomprimir eso es
    // perder calidad a cambio de nada.
    //
    // Mutación: devolver siempre `true`. Estos dos casos se ponen rojos.
    expect(convieneReemplazar({ bytesAntes: 94_822, bytesDespues: 94_925 })).toBe(false);
    expect(convieneReemplazar({ bytesAntes: 103_322, bytesDespues: 101_580 })).toBe(false);
  });

  it('el PNG de 1091 KB sí', () => {
    // El peor caso del sitio, 11,8 veces la mediana: 1091,5 KB -> 34,0 KB en JPEG.
    expect(convieneReemplazar({ bytesAntes: 1_117_696, bytesDespues: 34_816 })).toBe(true);
  });

  it('con metadatos se reemplaza aunque no ahorre un byte', () => {
    // **Esta Function es la capa que no se puede saltear.** El panel también
    // saca el EXIF (`sinMetadatos`), pero el panel se puede saltear abriendo la
    // consola del navegador; las reglas de Storage no pueden mirar adentro del
    // archivo. Una foto de un taller que pasa en una casa particular lleva las
    // coordenadas de esa casa, y eso no se despublica.
    //
    // Mutación: sacar el `if (conMetadatos) return true`. Este caso se pone
    // rojo, y la privacidad pasaría a depender del ahorro de bytes.
    expect(convieneReemplazar({ bytesAntes: 1000, bytesDespues: 1000, conMetadatos: true })).toBe(
      true,
    );
    expect(convieneReemplazar({ bytesAntes: 1000, bytesDespues: 5000, conMetadatos: true })).toBe(
      true,
    );
  });

  it('el umbral es el declarado y no un número suelto', () => {
    const antes = 100_000;
    expect(
      convieneReemplazar({ bytesAntes: antes, bytesDespues: antes * (1 - AHORRO_MINIMO) }),
    ).toBe(false);
    expect(
      convieneReemplazar({ bytesAntes: antes, bytesDespues: antes * (1 - AHORRO_MINIMO) - 1 }),
    ).toBe(true);
  });

  it('un tamaño que no es un número no reemplaza nada', () => {
    // Falla cerrado: ante un dato que no entendemos, se deja el original.
    expect(convieneReemplazar({ bytesAntes: NaN, bytesDespues: 1 })).toBe(false);
    expect(convieneReemplazar({})).toBe(false);
  });
});

describe('a qué formato sale la imagen principal', () => {
  it('un PNG opaco sale JPEG: es el 94 % del ahorro de este frente', () => {
    // Los tres PNG de la página más pesada del sitio (3226,7 KB entre los tres)
    // declaran canal alfa y los tres son **completamente opacos**, así que
    // aplanarlos sobre blanco no cambia un píxel: 3226,7 KB -> 184,3 KB.
    expect(formatoDeSalida({ formato: 'png', opaca: true })).toBe('jpeg');
    expect(contentTypeDe('jpeg')).toBe('image/jpeg');
  });

  it('un PNG con transparencia real se queda en PNG', () => {
    // `isOpaque` y no `hasAlpha`. Aplanado sobre blanco, un logo con
    // transparencia de verdad aparecería con un recuadro blanco sobre el fondo
    // de la página — y el sitio tiene tema claro y oscuro, así que no hay color
    // de fondo correcto que elegir.
    //
    // Mutación: devolver siempre `'jpeg'`. Este caso se pone rojo.
    expect(formatoDeSalida({ formato: 'png', opaca: false })).toBe('png');
    expect(contentTypeDe('png')).toBe('image/png');
  });

  it('un JPEG sale JPEG, opaco o no', () => {
    expect(formatoDeSalida({ formato: 'jpeg', opaca: true })).toBe('jpeg');
    expect(formatoDeSalida({ formato: 'jpeg', opaca: false })).toBe('jpeg');
  });
});

describe('el nombre del objeto', () => {
  it('saca el id de la fila de galería, y rechaza lo que no lo es', () => {
    expect(idDeObjeto('imagenes/img_abc-123.jpg')).toBe('img_abc-123');
    expect(idDeObjeto('imagenes/img_abc-123.png')).toBe('img_abc-123');
    // El nombre **es** el id de la fila (B-206 #1) y de eso depende que el path
    // sea opaco: un nombre libre volvería a meter contenido en el path.
    expect(idDeObjeto('imagenes/club-de-lectura.jpg')).toBeNull();
    expect(idDeObjeto('imagenes/img_x.webp')).toBeNull();
    expect(idDeObjeto('miniaturas/img_x.jpg')).toBeNull();
  });

  it('la marca de salida conserva el token de descarga del original', () => {
    // No hace falta para leer la imagen —lo que autoriza es `allow get: if true`,
    // verificado contra producción el 2026-09-02: el mismo objeto responde 200
    // con el token, sin token y con un token inventado— pero la URL guardada en
    // el documento lo lleva adentro, y tirarlo sería cambiar el estado del que
    // esa URL depende sin necesidad.
    expect(metadatosDeSalida({ token: 'tok-1' })).toEqual({
      [MARCA_OPTIMIZADA]: VERSION_PIPELINE,
      firebaseStorageDownloadTokens: 'tok-1',
    });
    // Sin token no se inventa uno vacío: una clave vacía en `customMetadata`
    // sería otra cosa que la ausencia.
    expect(metadatosDeSalida({})).toEqual({ [MARCA_OPTIMIZADA]: VERSION_PIPELINE });
  });
});

// ─────────────────────────────────────────────────────────────────────
// La URL de la miniatura, derivada — lo que hace innecesario el write-back
// ─────────────────────────────────────────────────────────────────────

const URL_PROPIA =
  'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/' +
  'imagenes%2Fimg_c1e504dd-470a-4de1-acf6-e34ad2df6f00.jpg?alt=media&token=b1b5e4cd-052a';

describe('la URL de la miniatura se deriva de la del original', () => {
  it('cambia el prefijo, fuerza .jpg y tira el token', () => {
    // Una URL real de producción. El token se descarta a propósito: la miniatura
    // tiene el suyo y no lo conocemos, y no hace falta ninguno.
    expect(urlDeMiniatura(URL_PROPIA)).toBe(
      'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/' +
        'miniaturas%2Fimg_c1e504dd-470a-4de1-acf6-e34ad2df6f00.jpg?alt=media',
    );
  });

  it('un PNG también deriva a .jpg', () => {
    // La miniatura la produce la Function y el formato lo elige ella.
    const png = URL_PROPIA.replace('.jpg', '.png');
    expect(urlDeMiniatura(png)).toContain('.jpg?alt=media');
    expect(urlDeMiniatura(png)).not.toContain('.png');
  });

  it('una imagen externa da null: DEC-7d no las toca', () => {
    // Mutación: devolver la URL tal cual cuando no matchea. La cartelera pediría
    // una miniatura a instagram.com y el `srcset` quedaría roto.
    expect(urlDeMiniatura('https://ejemplo.com/flyer.jpg')).toBeNull();
    expect(urlDeMiniatura('https://firebasestorage.googleapis.com/otra/cosa.jpg')).toBeNull();
    expect(urlDeMiniatura(null)).toBeNull();
    expect(urlDeMiniatura('no es una url')).toBeNull();
  });

  it('no deriva la miniatura de una miniatura', () => {
    // Sin esto, un consumidor que se equivoque de campo produce
    // `miniaturas/miniaturas/...`, una dirección que nadie escribe nunca.
    expect(urlDeMiniatura(urlDeMiniatura(URL_PROPIA))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// El pipeline de píxeles — sobre los bytes de salida, no sobre la promesa
// ─────────────────────────────────────────────────────────────────────

/** ¿Están estos bytes en el buffer? El barrido de centinelas del §5, en binario. */
const contiene = (datos: Buffer, cadena: string): boolean =>
  datos.includes(Buffer.from(cadena, 'latin1'));

const jpegConExif = async (): Promise<Buffer> => {
  const base = await sharp({
    create: { width: 900, height: 1200, channels: 3, background: { r: 200, g: 60, b: 40 } },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
  // `withExif` mete un APP1 de verdad, con una etiqueta GPS: es el bloque que
  // este frente existe para que no llegue nunca al bucket.
  return sharp(base)
    .withExif({ IFD0: { Copyright: 'agenda-literaria' }, IFD3: { GPSLatitudeRef: 'S' } })
    .jpeg({ quality: 92 })
    .toBuffer();
};

describe('el pipeline saca los metadatos y comprime — DEC-7d', () => {
  it('el EXIF no está en los bytes de salida', async () => {
    // Se verifica **sobre la salida**, y no confiando en que `sharp` los
    // descarte: el modo de falla es que alguien agregue un `.withMetadata()` o
    // un `.keepExif()` creyendo que conserva el perfil de color, y eso no lo
    // atrapa ningún tipo.
    const entrada = await jpegConExif();
    expect(contiene(entrada, 'Exif'), 'la entrada tenía que traer EXIF').toBe(true);
    expect(contiene(entrada, 'agenda-literaria')).toBe(true);

    const salida = await optimizar(entrada);
    expect(salida.conMetadatos).toBe(true);
    expect(contiene(salida.principal.datos, 'Exif')).toBe(false);
    expect(contiene(salida.miniatura.datos, 'Exif')).toBe(false);
    expect(contiene(salida.principal.datos, 'agenda-literaria')).toBe(false);
  });

  it('un PNG opaco sale JPEG, y su miniatura también', async () => {
    const png = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 10, g: 90, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const salida = await optimizar(png);
    expect(salida.formatoOriginal).toBe('png');
    expect(salida.opaca).toBe(true);
    expect(salida.principal.contentType).toBe('image/jpeg');
    expect(salida.miniatura.contentType).toBe('image/jpeg');
  });

  it('un PNG con transparencia real se queda en PNG', async () => {
    const png = await sharp({
      create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.2 } },
    })
      .png()
      .toBuffer();
    const salida = await optimizar(png);
    expect(salida.opaca).toBe(false);
    expect(salida.principal.contentType).toBe('image/png');
    // La miniatura igual sale JPEG: su ruta termina en `.jpg` y de eso depende
    // que el sitio pueda derivarla sin write-back.
    expect(salida.miniatura.contentType).toBe('image/jpeg');
  });

  it('la miniatura mide el ancho declarado y conserva la proporción', async () => {
    const alto = await sharp({
      create: { width: 1440, height: 1800, channels: 3, background: { r: 30, g: 30, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    const salida = await optimizar(alto);
    const mini = await sharp(salida.miniatura.datos).metadata();
    expect(mini.width).toBe(ANCHO_MINIATURA);
    expect(mini.height).toBe(Math.round((ANCHO_MINIATURA * 1800) / 1440));
  });

  it('no agranda una imagen más chica que la miniatura', async () => {
    // `withoutEnlargement`: una imagen de 200px de ancho no puede salir de 480,
    // que sería pesar más para no mostrar un píxel más.
    const chica = await sharp({
      create: { width: 200, height: 250, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    const salida = await optimizar(chica);
    expect((await sharp(salida.miniatura.datos).metadata()).width).toBe(200);
  });

  it('el reescalado del original conserva la proporción, y de eso depende que no haya write-back', async () => {
    // `ancho`/`alto` quedan en el documento sin actualizarse, y se usan como
    // **razón** (`proporcionDeAfiche`): `4032 / 3024` y `1600 / 1200` reservan
    // la misma caja. Si el reescalado no conservara la proporción, el hueco que
    // el sitio reserva dejaría de coincidir con la imagen.
    const grande = await sharp({
      create: { width: 4032, height: 3024, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .jpeg()
      .toBuffer();
    const salida = await optimizar(grande);
    const meta = await sharp(salida.principal.datos).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(LADO_MAXIMO);
    expect(meta.width! / meta.height!).toBeCloseTo(4032 / 3024, 2);
  });

  it('aplica la orientación del EXIF antes de descartarlo', async () => {
    // Sin `.rotate()`, sacar el EXIF de una foto sacada con el teléfono de
    // costado la publica girada 90 grados: el dato que decía cómo mostrarla se
    // fue y el píxel nunca se movió.
    //
    // Mutación: sacar el `.rotate()` de `imagenes-optimizar.js`. Este caso se
    // pone rojo (sale 900 x 1200 en vez de 1200 x 900).
    // `withMetadata({ orientation })` y no `withExif({ IFD0: { Orientation } })`:
    // lo segundo no sirve para armar el caso, porque `sharp` **normaliza** la
    // orientación al escribir y el archivo sale con `Orientation: 1`. Se
    // descubrió acá, escribiendo este test.
    const acostada = await sharp({
      create: { width: 900, height: 1200, channels: 3, background: { r: 7, g: 7, b: 7 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(acostada).metadata()).orientation, 'el caso no quedó armado').toBe(6);
    const salida = await optimizar(acostada);
    const meta = await sharp(salida.principal.datos).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 900]);
  });

  it('traeMetadatos mira los cuatro bloques y no solo el EXIF', () => {
    expect(traeMetadatos({})).toBe(false);
    // El perfil ICC **no** es un metadato a sacar: descartarlo cambia los
    // colores, y es la misma decisión que el panel toma con el marcador `0xE2`.
    expect(traeMetadatos({ icc: Buffer.alloc(4) })).toBe(false);
    for (const bloque of ['exif', 'xmp', 'iptc']) {
      expect(traeMetadatos({ [bloque]: Buffer.alloc(4) }), bloque).toBe(true);
    }
    expect(traeMetadatos({ comments: [{ keyword: 'Comment', text: 'algo' }] })).toBe(true);
  });
});
