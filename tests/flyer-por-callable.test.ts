/**
 * **La subida del flyer de `/proponer` pasa por una callable atestada, y el
 * saneado corre del lado del servidor** — B-896 paso 1.
 *
 * ── Lo que este archivo existe para probar ────────────────────────────────
 * Dos cosas, y las dos son «un chequeo que no puede fallar es peor que no
 * tenerlo»:
 *
 * 1. **El saneado del cliente se puede saltear.** Hasta B-896, la única capa que
 *    le sacaba el EXIF al flyer que manda un tercero corría en el navegador
 *    (`src/lib/subir-imagen.ts`). Alcanzaba con abrir la consola y llamar a
 *    `uploadBytes` con el archivo crudo para que la foto —con las coordenadas de
 *    la casa donde se hace el taller adentro— entrara al bucket tal cual. O sea
 *    que el proyecto prometía una garantía que no podía dar.
 * 2. **El endpoint anónimo tiene que estar atestado**, y no se podía hacer
 *    exigiendo App Check en Storage: el enforcement es **por servicio y no por
 *    path**, así que exigirlo se lleva puestas las lecturas públicas de imágenes
 *    del sitio (B-872).
 *
 * ── Y por qué se prueba así, y no contra el emulador ──────────────────────
 * **El CI no levanta el emulador de Functions** (D-660), así que un test de
 * integración de la callable se saltearía en silencio justo donde importa. El
 * corte que lo hace verificable es el de siempre (`docs/05-patrones.md`): la
 * decisión vive en `functions/flyer-de-propuesta.js` —puro, entra un Buffer y
 * sale un Buffer— y se ejercita de verdad acá, con imágenes construidas con
 * `sharp`. Lo único que queda del otro lado es el pegamento, y de ése se lee el
 * fuente: `enforceAppCheck: true` no es ejecutable desde vitest, pero que esté
 * escrito sí es verificable, y su ausencia es el modo de falla caro.
 *
 * Las mutaciones están anotadas en cada bloque y se corrieron una por una.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  CAUSAS_DEL_FLYER,
  FORMATOS_DE_ENTRADA,
  LIMITE_REQUEST_CALLABLE,
  MAXIMO_BYTES as MAXIMO_DE_LA_CALLABLE,
  NOMBRE_DE_FLYER,
  TIPOS_ACEPTADOS,
  bytesDeBase64,
  bytesEnBase64,
  enBytesLegibles as legibleEnLaCallable,
  metadatosDelFlyer,
  nuevoIdDeFlyer,
  rutaDeFlyer,
  salidaLimpia,
  sanearFlyer,
  validarPedido,
} from '../functions/flyer-de-propuesta.js';
import { MARCA_OPTIMIZADA, decidirOptimizacion } from '../functions/imagenes.js';
import { REGION } from '../functions/despliegue.js';
import { MAXIMO_BYTES } from '@/lib/imagenes';
import { enBytesLegibles, quedanMetadatos } from '@/lib/imagenes-archivo';
import { MOTIVOS_IMAGEN } from '@/lib/analytics-eventos';
// El mismo saneador que usan los demás tests sobre fuente: un docblock que
// nombra lo que el test busca alcanza para que un chequeo de presencia pase con
// el cuerpo vacío, y acá abajo se afirma justamente sobre ausencias.
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const TRIGGER = 'functions/flyer-de-propuesta-trigger.js';
const CLIENTE = 'src/lib/subir-imagen.ts';

/**
 * Una imagen **con metadatos adentro**: el insumo de todos los casos del
 * saneado. `withMetadata({ exif })` es lo más parecido a la foto de un teléfono
 * que se puede construir sin traer un binario al repo — y el bloque que lleva el
 * `Copyright` es el mismo APP1 donde viaja el GPS.
 */
const conMetadatos = async (formato: 'jpeg' | 'png'): Promise<Buffer> => {
  const base = sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).withMetadata({ exif: { IFD0: { Copyright: 'Quien la sacó', Artist: 'Y dónde' } } });
  return formato === 'jpeg' ? base.jpeg({ quality: 90 }).toBuffer() : base.png().toBuffer();
};

// ─────────────────────────────────────────────────────────────────────
// 1 · El contrato: App Check exigido, y el nombre que el cliente invoca
// ─────────────────────────────────────────────────────────────────────

describe('la callable está atestada — B-896', () => {
  it('CONTROL POSITIVO: los dos archivos existen y tienen contenido', () => {
    // Sin esto, un `fuente()` que devolviera vacío haría pasar en verde todos los
    // `toContain` de abajo sin haber mirado nada.
    expect(fuente(TRIGGER).length).toBeGreaterThan(1000);
    expect(fuente(CLIENTE).length).toBeGreaterThan(1000);
  });

  it('`enforceAppCheck: true` está puesto, y es lo único que hace que esto no sea un endpoint abierto', () => {
    /*
     * **La línea que sostiene el frente entero.** Sin ella, cualquiera con la URL
     * de la Function le manda 3 MB por llamada —almacenamiento y egreso
     * facturados, plan Blaze (§2.3)— y las cinco capas de B-836 se quedan sin la
     * única que frena «al script que no pasa por la página».
     *
     * Y el modo de falla es mudo: la Function anda igual, el formulario anda
     * igual, y lo único que cambia es que deja de haber atestación. No hay
     * ningún test de comportamiento que pueda verlo sin el emulador de Functions
     * —que el CI no levanta (D-660)—, así que se lee del fuente.
     *
     * **Va sobre el código y no sobre el archivo**, y eso lo enseñó este mismo
     * caso: el docblock del trigger nombra `enforceAppCheck: true` para explicar
     * por qué está, así que un `toContain` sobre el fuente crudo pasaba **con la
     * línea borrada**. Es literalmente el motivo por el que existe
     * `sinComentarios`: un comentario que dice lo que el test busca alcanza para
     * dar un verde falso.
     *
     * MUTACIÓN PROBADA: borrar la línea `enforceAppCheck: true,` del trigger.
     * Este caso se pone rojo.
     */
    expect(sinComentarios(fuente(TRIGGER))).toContain('enforceAppCheck: true');
  });

  it('CONTROL NEGATIVO: no está apagada por el camino de al lado', () => {
    // `enforceAppCheck: false` con un comentario que diga lo contrario arriba es
    // exactamente la forma en la que esto se deshace sin que nada avise.
    expect(sinComentarios(fuente(TRIGGER))).not.toContain('enforceAppCheck: false');
  });

  it('está exportada en `index.js`: una Function que no se exporta no se despliega', () => {
    // Es la trampa 11 con otra cara: el archivo parsea, el test de arriba pasa, y
    // la Function no existe en producción porque nadie la re-exportó.
    expect(fuente('functions/index.js')).toContain(
      "export { subirFlyerDePropuesta } from './flyer-de-propuesta-trigger.js';",
    );
    expect(sinComentarios(fuente(TRIGGER))).toContain('export const subirFlyerDePropuesta = onCall(');
  });

  it('el nombre que invoca el cliente es el que la Function exporta (clase de B-88)', () => {
    /*
     * El productor y el consumidor del nombre viven en dos runtimes que no se
     * pueden importar entre sí, y el modo de falla es de los caros: el SDK pide
     * una función que no existe y contesta `functions/not-found` **en runtime**,
     * o sea recién cuando alguien intenta mandar una propuesta.
     */
    const enElCliente = /const CALLABLE_FLYER = '([^']+)'/.exec(fuente(CLIENTE))?.[1];
    expect(enElCliente, 'no se encontró el nombre en el cliente').toBeTruthy();
    expect(fuente('functions/index.js')).toContain(`export { ${enElCliente} }`);
  });

  it('y la región también, que si no el SDK le pega a us-central1', () => {
    /*
     * Misma clase que el nombre, con un modo de falla todavía más confuso: con la
     * región equivocada el SDK arma la URL de `us-central1`, donde esta Function
     * no está desplegada, y el error es un 404 que no menciona la región.
     * `REGION` no se puede importar desde el cliente —arrastraría `functions/` al
     * bundle, §5.4— así que se ata leyendo los dos.
     */
    const enElCliente = /const REGION_FUNCTIONS = '([^']+)'/.exec(fuente(CLIENTE))?.[1];
    expect(enElCliente).toBe(REGION);
  });

  it('el camino del cliente ya no sube por el SDK de Storage', () => {
    /*
     * El punto del frente, leído desde el lado del que manda: `/proponer` entra
     * por `subirFlyerPorCallable` y no por `subirImagen`. Si alguien volviera a
     * cablear el camino viejo —que sigue existiendo, y con razón: es el del
     * panel— el saneado del servidor dejaría de correr **y nada más se pondría
     * rojo**, porque `storage.rules` no puede distinguir quién sube.
     */
    const codigo = sinComentarios(fuente('src/lib/enviar-propuesta.ts'));
    expect(codigo).toContain('subirFlyerPorCallable');
    expect(codigo).not.toContain('rutaDeImagenPropuesta');
    expect(codigo).not.toContain('subirImagen(');
  });

  it('el saneado del cliente sigue corriendo antes de mandar, y no es redundante', () => {
    /*
     * No es la garantía —eso es todo el punto de B-896— pero saltearlo tendría un
     * costo concreto y distinto: el EXIF con las coordenadas de una casa
     * **viajaría** por la red antes de que el servidor lo tire, y el rechazo por
     * tipo o tamaño costaría una subida entera de 4 MB en vez de ser instantáneo.
     * Por eso `subirFlyerPorCallable` llama a `prepararImagen` y no manda el
     * archivo crudo.
     */
    const codigo = sinComentarios(fuente(CLIENTE));
    const cuerpo = codigo.slice(codigo.indexOf('subirFlyerPorCallable = async'));
    expect(cuerpo.length, 'no se encontró la función').toBeGreaterThan(100);
    expect(cuerpo).toContain('prepararImagen(archivo)');
    // Y no se arma un segundo pipeline al lado: los bytes salen de la
    // preparación compartida, no de una lectura propia del archivo.
    expect(cuerpo).not.toContain('archivo.arrayBuffer()');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2 · El saneado corre del lado del servidor, y se verifica sobre los bytes
// ─────────────────────────────────────────────────────────────────────

describe('el saneado del servidor — la capa que no se puede saltear (B-896, §5)', () => {
  it('CONTROL NEGATIVO: el barrido reconoce una imagen CON metadatos', async () => {
    /*
     * **Va primero a propósito.** Si `salidaLimpia` devolviera `true` siempre,
     * todos los casos de abajo pasarían en verde sin haber saneado nada — la
     * cobertura falsa que este repo persigue. Esto es también la **mutación** del
     * caso siguiente: hacer que `sanearFlyer` devuelva los bytes crudos en vez de
     * los de `optimizar()` deja al barrido mirando exactamente este archivo, y lo
     * atrapa.
     */
    for (const formato of ['jpeg', 'png'] as const) {
      expect(await salidaLimpia(await conMetadatos(formato)), formato).toBe(false);
    }
  });

  it('una foto con EXIF adentro sale sin nada, y se verifica sobre los bytes de salida', async () => {
    /*
     * El barrido del §5 sobre una salida binaria, del lado del servidor: no se
     * confía en que `sharp` los tiró, **se mira el resultado**. Y se mira con las
     * dos mitades que usa `optimizarImagen` —lo que `sharp` reporta y lo que no
     * sabe reportar— sobre las tablas compartidas de B-323/B-869.
     *
     * MUTACIÓN PROBADA: `return { ...salida, datos: bytes }` en `sanearFlyer`
     * (devolver el crudo). Este caso y el de más abajo se ponen rojos.
     */
    for (const formato of ['jpeg', 'png'] as const) {
      const entrada = await conMetadatos(formato);
      const saneado = await sanearFlyer(entrada);

      expect(await salidaLimpia(saneado.datos), formato).toBe(true);
      const meta = await sharp(saneado.datos).metadata();
      expect(meta.exif, `${formato}: el EXIF tiene que haberse ido`).toBeUndefined();
    }
  });

  it('y lo que sale lo acepta también el barrido del panel, que es el que lo va a promover', async () => {
    /*
     * **La atadura entre los dos runtimes, en la dirección que nadie mira.**
     * `tests/imagenes-function.test.ts` ata que lo que el panel sube, la Function
     * lo entiende; acá hace falta al revés: cuando el admin acepta la propuesta,
     * `promoverImagenDePropuesta` baja este objeto y lo vuelve a pasar por
     * `subirImagen`, que corre `quedanMetadatos`. Si el saneado del servidor
     * dejara algo que el del panel considera metadato, la propuesta se aceptaría
     * y la promoción fallaría con un cartel que le echa la culpa a la foto de
     * alguien que ya no está.
     */
    for (const formato of ['jpeg', 'png'] as const) {
      const { datos } = await sanearFlyer(await conMetadatos(formato));
      expect(quedanMetadatos(new Uint8Array(datos)), formato).toBe(false);
    }
  });

  it('un PNG con transparencia real se queda en PNG, y sale limpio igual', async () => {
    // Control positivo del otro camino de `formatoDeSalida`: si todo saliera JPEG,
    // el caso de arriba no probaría la rama PNG de `estructuraConocida`.
    const entrada = await sharp({
      create: { width: 300, height: 200, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } },
    })
      .png()
      .toBuffer();
    const saneado = await sanearFlyer(entrada);
    expect(saneado.formato).toBe('png');
    expect(saneado.contentType).toBe('image/png');
    expect(await salidaLimpia(saneado.datos)).toBe(true);
  });

  it('un WebP renombrado `image/jpeg` se rechaza: el tipo declarado no se puede creer', async () => {
    /*
     * Es `esDelTipoDeclarado` del panel, hecho del lado bueno del cable. El tipo
     * lo manda quien pide, así que un WebP o un HEIC con nombre de JPG pasa
     * `validarPedido` sin problema — lo que no puede engañar es a `sharp`, que
     * abre los bytes.
     *
     * Importa además porque WebP y AVIF quedaron afuera **a propósito**
     * (`tipoAceptado` en `storage.rules`): su contenedor lleva EXIF/XMP.
     */
    const webp = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .webp()
      .toBuffer();

    expect(validarPedido({ contentType: 'image/jpeg', datos: webp.toString('base64') }).rechazo)
      .toBeUndefined();
    await expect(sanearFlyer(webp)).rejects.toMatchObject({
      name: 'FlyerRechazado',
      causa: 'tipo',
    });
  });

  it('y algo que no es una imagen tampoco revienta: se rechaza con un motivo', async () => {
    await expect(sanearFlyer(Buffer.from('no soy una imagen, soy un PDF con suerte'))).rejects
      .toMatchObject({ name: 'FlyerRechazado', causa: 'tipo' });
  });

  it('las causas que emite la Function están todas en el vocabulario de la analítica', () => {
    /*
     * `MOTIVOS_IMAGEN` vive en `src/lib/analytics-eventos.ts` y no se puede
     * importar desde `functions/`, así que la causa viaja en el `details` del
     * `HttpsError` y el vocabulario se ata acá. Es la lección de B-88 con el modo
     * de falla mudo de siempre: un motivo que el vocabulario no conoce llega a
     * GA4 como `otro` y nadie se entera.
     */
    for (const causa of CAUSAS_DEL_FLYER) {
      expect([...MOTIVOS_IMAGEN], causa).toContain(causa);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3 · El límite de tamaño del request, medido
// ─────────────────────────────────────────────────────────────────────

describe('el tope de 3 MB entra en el request de un callable — B-896', () => {
  it('la cuenta de base64 es la que dice el estándar: +33 %', () => {
    expect(bytesEnBase64(3)).toBe(4);
    expect(bytesEnBase64(MAXIMO_BYTES)).toBe(4 * 1024 * 1024);
    expect(bytesDeBase64(Buffer.alloc(1000).toString('base64'))).toBe(1000);
  });

  it('el cuerpo JSON de una imagen en el tope mide 4,00 MiB, medido y no estimado', () => {
    /*
     * **La medición que B-896 pedía.** Se arma el cuerpo exacto que manda el
     * protocolo de callables —`{"data":{…}}`— con una imagen del tamaño máximo, y
     * se lo mide en bytes. No se estima: el envoltorio JSON también ocupa.
     */
    const cuerpo = JSON.stringify({
      data: { contentType: 'image/jpeg', datos: Buffer.alloc(MAXIMO_BYTES).toString('base64') },
    });
    const medido = Buffer.byteLength(cuerpo, 'utf8');

    expect(medido).toBe(4194352);
    expect(medido / 1024 / 1024).toBeCloseTo(4.0, 2);
  });

  it('y entra en el límite con 2,5× de margen', () => {
    /*
     * `LIMITE_REQUEST_CALLABLE` es **el más chico de los dos límites que documenta
     * Google** —10 MB para una función HTTP de 1ª gen, 32 MiB para una de 2ª, que
     * es lo que este proyecto despliega— a propósito: si entra contra el
     * estricto, entra contra los dos, y la cuenta no depende de que nadie se
     * acuerde de qué generación es esta Function.
     */
    const cuerpo = bytesEnBase64(MAXIMO_BYTES) + 64;
    expect(cuerpo).toBeLessThan(LIMITE_REQUEST_CALLABLE);
    expect(LIMITE_REQUEST_CALLABLE / cuerpo).toBeGreaterThan(2);
  });

  it('el tope es el mismo número en los tres lugares donde está escrito', () => {
    // `src/lib/imagenes.ts`, `functions/flyer-de-propuesta.js` y `storage.rules`.
    // La regla ya no chequea el tamaño de un flyer —su `create` está cerrado—
    // pero sigue chequeándolo para `imagenes/`, y los dos topes tienen que ser el
    // mismo: la imagen promovida es la misma imagen.
    expect(MAXIMO_DE_LA_CALLABLE).toBe(MAXIMO_BYTES);
    expect(fuente('storage.rules')).toContain('request.resource.size <= 3 * 1024 * 1024');
  });

  it('el rechazo por tamaño dice el tamaño real Y el máximo, que es lo que pide DEC-7b', () => {
    /*
     * «Es muy grande» no le dice a nadie cuánto tiene que recortar, y es lo que el
     * camino de hoy ya hace bien (`validarArchivo`). Del lado del servidor tiene
     * que decir lo mismo, porque es el único que habla cuando el cliente se
     * salteó su propia validación.
     */
    const grande = Buffer.alloc(MAXIMO_BYTES + 512 * 1024).toString('base64');
    const { rechazo } = validarPedido({ contentType: 'image/jpeg', datos: grande });

    expect(rechazo?.causa).toBe('tamano');
    expect(rechazo?.message).toContain('3,5 MB');
    expect(rechazo?.message).toContain('3 MB');
  });

  it('CONTROL POSITIVO: una imagen exactamente en el tope pasa', () => {
    // Sin esto, un `validarPedido` que rechazara todo dejaría verde al caso de
    // arriba — y el tope significaría «nada entra».
    const justo = Buffer.alloc(MAXIMO_BYTES).toString('base64');
    expect(validarPedido({ contentType: 'image/jpeg', datos: justo }).rechazo).toBeUndefined();
    expect(validarPedido({ contentType: 'image/jpeg', datos: justo }).bytes).toBe(MAXIMO_BYTES);
  });

  it('y `enBytesLegibles` dice lo mismo de los dos lados del cable', () => {
    /*
     * Es una copia declarada (el original es TypeScript del panel y no se puede
     * compartir por alias), así que lo que se ata es la salida: si se separan, la
     * persona lee «3 MB» en el cliente y «3.0 MB» en el servidor para el mismo
     * número.
     */
    for (const n of [0, 999, 1024, 5000, MAXIMO_BYTES, MAXIMO_BYTES + 512 * 1024, 7654321]) {
      expect(legibleEnLaCallable(n), String(n)).toBe(enBytesLegibles(n));
    }
  });

  it('rechaza lo que no es una imagen antes de decodificar nada', () => {
    expect(validarPedido({ contentType: 'image/jpeg', datos: '' }).rechazo?.causa).toBe('tipo');
    expect(validarPedido({ contentType: 'image/jpeg', datos: 'no es base64!' }).rechazo?.causa).toBe(
      'tipo',
    );
    expect(
      validarPedido({ contentType: 'image/webp', datos: Buffer.alloc(10).toString('base64') })
        .rechazo?.message,
    ).toContain('image/webp');
    expect(TIPOS_ACEPTADOS).toEqual(['image/jpeg', 'image/png']);
    expect(FORMATOS_DE_ENTRADA).toEqual(['jpeg', 'png']);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4 · Trampa 12: el objeto lo escribe ahora el Admin SDK
// ─────────────────────────────────────────────────────────────────────

describe('la callable escribe en el bucket y no despierta nada (trampa 12)', () => {
  it('`optimizarImagen` ignora lo que la callable escribe', () => {
    /*
     * **La pregunta cambió de dueño y hay que volver a hacerla.** Antes el objeto
     * de `propuestas/` lo escribía un cliente; ahora lo escribe el Admin SDK, que
     * pasa por encima de las reglas — y `onObjectFinalized` está suscripto al
     * **bucket entero**, no al prefijo. O sea que esta escritura despierta al
     * trigger de optimización igual que cualquier otra.
     *
     * Lo corta el primer `if` de `decidirOptimizacion`, que ya existía. Se afirma
     * acá también, sobre un path armado por la callable de verdad, porque el
     * cambio de escritor es exactamente el momento en el que una guarda de este
     * tipo deja de valer sin que nada avise.
     */
    const ruta = rutaDeFlyer(nuevoIdDeFlyer(), 'jpeg');
    expect(decidirOptimizacion({ nombre: ruta, contentType: 'image/jpeg' })).toEqual({
      accion: 'ignorar',
      motivo: 'fuera-del-prefijo',
    });
  });

  it('y NO escribe la marca de esa Function, que es la guarda de la otra mitad', () => {
    /*
     * `optimizada` es la guarda anti-recursión de B-220: si el objeto la trae, el
     * trigger corta antes de tocarlo. Ponerla acá no haría falta hoy —este prefijo
     * está fuera de su alcance— y sería un préstamo peligroso: la marca viajaría
     * con el objeto si algún día se lo **copiara** a `imagenes/` en vez de
     * re-subirlo, y ahí sí se saltearía el saneado de la galería. `saneada` dice
     * lo que de verdad pasó y ninguna guarda la mira.
     */
    const meta = metadatosDelFlyer({ token: 'tok' });
    expect(Object.keys(meta)).not.toContain(MARCA_OPTIMIZADA);
    expect(meta.saneada).toBe('1');
  });

  it('pone el token de descarga a mano: el Admin SDK no lo acuña solo', () => {
    /*
     * El camino viejo subía con el SDK del navegador, que acuña el token por su
     * cuenta. Sin esta línea la bandeja se queda sin poder mostrarle el flyer al
     * admin (`urlDeImagenDePropuesta`), y el modo de falla sería «la foto no se
     * ve» sin ninguna pista de por qué — con la decisión de DEC-11 («mirarla es
     * parte de decidir») rota en silencio.
     */
    expect(metadatosDelFlyer({ token: 'abc' }).firebaseStorageDownloadTokens).toBe('abc');
    expect(sinComentarios(fuente(TRIGGER))).toContain('crypto.randomUUID()');
  });

  it('el path que arma es de un solo segmento y con la forma que el resto espera', () => {
    const ruta = rutaDeFlyer(nuevoIdDeFlyer(), 'png');
    expect(ruta.startsWith('propuestas/')).toBe(true);
    expect(ruta.slice('propuestas/'.length)).toMatch(NOMBRE_DE_FLYER);
    expect(ruta.split('/')).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5 · Y `storage.rules` se quedó cerrado, que es la mitad barata de todo esto
// ─────────────────────────────────────────────────────────────────────

describe('`propuestas/` quedó cerrado a todo cliente — B-896', () => {
  it('el `create` está en `false`, y no condicionado a un claim', () => {
    /*
     * La verificación de verdad —subir contra el emulador con las tres sesiones—
     * está en `tests/storage-reglas.integracion.test.ts`. Esto es el testigo
     * barato que corre siempre, incluso sin emuladores: el diff que reabriría la
     * puerta es visible en una línea.
     */
    const bloque = fuente('storage.rules');
    const desde = bloque.indexOf('match /propuestas/{archivo}');
    const hasta = bloque.indexOf('match /{ruta=**}');
    const propuestas = bloque.slice(desde, hasta);

    expect(desde, 'el bloque de propuestas tiene que existir').toBeGreaterThan(0);
    expect(propuestas).toContain('allow create: if false;');
    expect(propuestas).not.toContain('allow create: if esAdmin()');
  });
});
