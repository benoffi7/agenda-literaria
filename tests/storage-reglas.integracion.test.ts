import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import {
  connectStorageEmulator,
  deleteObject,
  getDownloadURL,
  getStorage,
  listAll,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { app, auth } from '@/lib/firebase-client';
import { adminBucket } from '@/lib/firebase-admin';
import { MAXIMO_BYTES } from '@/lib/imagenes';
import { rutaDeImagen, rutaDeImagenPropuesta } from '@/lib/imagenes-archivo';
import { MARCA_OPTIMIZADA } from '../functions/imagenes.js';
import { PROJECT_ID, cargarReglasStorage, emuladorStorageVivo } from './emulador';

/**
 * `storage.rules` — la mitad de DEC-7b que el schema no puede dar.
 *
 * **Por qué estos tests son de integración y no de unidad.** El schema de zod se
 * puede testear sin nada; las reglas, no: son un lenguaje que evalúa un motor que
 * no es el nuestro, con `request.auth`, `request.resource.size` y un patrón sobre
 * el nombre del objeto. La única forma honesta de saber que rechazan lo que tienen
 * que rechazar es **subir de verdad** contra el emulador. Es exactamente lo que
 * pide el §10 del `CLAUDE.md`, y para algo que sube archivos no es opcional.
 *
 * Las reglas se empujan desde este checkout (`cargarReglasStorage`) y no se
 * confía en las que el emulador cargó al arrancar: con worktrees en paralelo, el
 * emulador puede estar sirviendo el `storage.rules` de **otra** rama, y el test
 * daría verde habiendo probado el archivo equivocado.
 */
const vivo = await emuladorStorageVivo();

const UID = 'uid_test_storage';
const BUCKET = 'agenda-literaria.firebasestorage.app';

/**
 * `esAdmin: boolean` y no un objeto de claims, **a propósito**: este archivo
 * prueba `storage.rules`, donde el único rol que existe es `admin`. El
 * `publicador` de B-888 tiene su propio helper abajo, separado, para que la
 * diferencia se vea en el nombre y no haya que leer el argumento.
 */
const tokenPara = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `s-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  const token = await a.createCustomToken(uid, esAdmin ? { admin: true } : {});
  await deleteAdminApp(app);
  return token;
};

/** Un token con el claim `publicador` de B-888, y **sin** `admin`. */
const tokenPublicador = async (uid: string) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `sp-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  const token = await a.createCustomToken(uid, { publicador: true });
  await deleteAdminApp(app);
  return token;
};

let _almacen: ReturnType<typeof getStorage> | null = null;
const almacen = () => {
  if (_almacen) return _almacen;
  _almacen = getStorage(app(), `gs://${BUCKET}`);
  connectStorageEmulator(_almacen, '127.0.0.1', 9199);
  return _almacen;
};

/** Un objeto de N bytes. El contenido no importa: lo que se mide es el tamaño. */
const bytes = (n: number): Uint8Array => new Uint8Array(n);

const subir = (ruta: string, datos: Uint8Array, contentType: string) =>
  uploadBytes(ref(almacen(), ruta), datos, { contentType });

/** ¿La operación fue rechazada por las reglas? */
const rechaza = async (op: Promise<unknown>): Promise<boolean> => {
  try {
    await op;
    return false;
  } catch {
    return true;
  }
};

let n = 0;
/** Un id de fila nuevo por caso: los objetos quedan en el emulador entre tests. */
const idNuevo = () => `img_test-${Date.now().toString(36)}-${n++}`;

describe.skipIf(!vivo)('las reglas de Storage — DEC-7b, B-167', () => {
  beforeAll(async () => {
    await cargarReglasStorage('storage.rules');
  });

  describe('con la sesión de un admin', () => {
    beforeAll(async () => {
      await signInWithCustomToken(auth(), await tokenPara(UID, true));
    });

    it('sube un JPG chico, y queda leíble sin sesión', async () => {
      // El caso feliz, y las dos mitades de B-206 #1: la imagen entra, y su URL
      // pública la puede pedir cualquiera — que es el punto de una imagen que va
      // al sitio y a `og:image`.
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');
      await subir(ruta, bytes(1024), 'image/jpeg');
      const url = await getDownloadURL(ref(almacen(), ruta));
      expect(url).toContain(encodeURIComponent(ruta));

      const r = await fetch(url);
      expect(r.ok, 'la imagen propia tiene que ser pública').toBe(true);
    });

    it('rechaza un archivo más grande que el tope, aunque el panel lo haya dejado pasar', async () => {
      // **Es el motivo por el que este archivo existe** (DEC-7b): abajo de esta
      // pantalla hay una consola de navegador con el SDK cargado, y el schema no
      // la ve. Un archivo de 3 MB + 1 byte tiene que rebotar acá.
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');
      expect(await rechaza(subir(ruta, bytes(MAXIMO_BYTES + 1), 'image/jpeg'))).toBe(true);
    });

    it('acepta justo el tope', async () => {
      // El control positivo del anterior: sin esto, unas reglas que rechacen
      // TODO también pasarían el test de arriba.
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');
      expect(await rechaza(subir(ruta, bytes(MAXIMO_BYTES), 'image/jpeg'))).toBe(false);
    });

    it('rechaza un tipo que no sabemos limpiar de metadatos', async () => {
      // WebP y AVIF no están en `TIPOS_SUBIBLES` porque su contenedor lleva
      // EXIF/XMP y no hay quien se lo saque todavía. Las reglas dicen lo mismo,
      // que es lo que hace que la decisión no dependa del cliente.
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');
      expect(await rechaza(subir(ruta, bytes(512), 'image/webp'))).toBe(true);
      expect(await rechaza(subir(ruta, bytes(512), 'image/svg+xml'))).toBe(true);
      expect(await rechaza(subir(ruta, bytes(512), 'application/pdf'))).toBe(true);
    });

    it('rechaza un nombre que no tiene la forma de un id de galería', async () => {
      // El nombre del objeto **es** el id de la fila (`nuevaImagenId`), y de eso
      // depende que el path sea opaco (B-206 #1). Un nombre libre volvería a
      // meter contenido en el path.
      expect(await rechaza(subir('imagenes/tapa.jpg', bytes(512), 'image/jpeg'))).toBe(true);
      expect(
        await rechaza(subir('imagenes/club-de-lectura.jpg', bytes(512), 'image/jpeg')),
      ).toBe(true);
    });

    it('rechaza cualquier prefijo que no sea imagenes/', async () => {
      // La regla `match /{ruta=**}` con `deny` es lo que hace que un prefijo
      // inventado mañana no herede permisos por accidente.
      expect(await rechaza(subir('otra-cosa/img_x.jpg', bytes(512), 'image/jpeg'))).toBe(true);
      expect(
        await rechaza(subir('imagenes/sub/img_x.jpg', bytes(512), 'image/jpeg')),
      ).toBe(true);
    });

    it('ni un admin puede subir con la marca de la Function puesta — B-220, trampa 12', async () => {
      // **Lo encontró el `auditor-privacidad`, y era un P0.** La guarda
      // anti-recursión de `optimizarImagen` corta cuando el objeto trae
      // `optimizada` en su `customMetadata`… y ese mapa lo elige quien sube. Sin
      // esta regla alcanzaba un `uploadBytes` con `customMetadata` desde la
      // consola del navegador para saltear el trigger entero y dejar el JPEG
      // público **con su APP1 y su GPS adentro** — o sea para saltear justamente
      // la capa que existe porque el panel se puede saltear.
      //
      // Es la tercera defensa del mismo párrafo de DEC-7b, al lado del tamaño y
      // del tipo.
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');
      expect(
        await rechaza(
          uploadBytes(ref(almacen(), ruta), bytes(512), {
            contentType: 'image/jpeg',
            customMetadata: { [MARCA_OPTIMIZADA]: '1' },
          }),
        ),
      ).toBe(true);

      // El control positivo: **con cualquier otro** `customMetadata` la subida
      // pasa. Sin esto, una regla que rechazara toda subida con metadatos
      // —o toda subida— también pasaría el aserto de arriba.
      const otra = rutaDeImagen(idNuevo(), 'image/jpeg');
      expect(
        await rechaza(
          uploadBytes(ref(almacen(), otra), bytes(512), {
            contentType: 'image/jpeg',
            customMetadata: { firebaseStorageDownloadTokens: 'tok' },
          }),
        ),
      ).toBe(false);
    });

    it('ni un admin puede escribir en miniaturas/: ahí escribe solo la Function', async () => {
      // B-220, D-175. El prefijo lo escribe `optimizarImagen` con el Admin SDK,
      // que pasa por encima de estas reglas. Cerrarlo también para el admin no es
      // simetría: la dirección de una miniatura la **calcula** el sitio
      // (`rutaDeMiniatura`), así que dejar escribir ahí sería dejar elegir qué se
      // muestra en la cartelera sin pasar por ninguna validación de tipo ni de
      // tamaño — y sin pasar por el pipeline que le saca los metadatos.
      expect(
        await rechaza(subir('miniaturas/img_x.jpg', bytes(512), 'image/jpeg')),
      ).toBe(true);
    });
  });

  /**
   * **El prefijo de las propuestas** — B-830 paso 8, DEC-11.
   *
   * Es el otro lado de todo lo de arriba: `imagenes/` es público por objeto y lo
   * escribe un admin; `propuestas/` **no es público** y lo va a escribir alguien
   * sin login. Las dos mitades se prueban acá porque las dos son de las reglas y
   * ninguna se puede razonar sin el emulador.
   */
  describe('el prefijo de las propuestas (DEC-11, y el cierre de B-896)', () => {
    const idPropuesta = () => `prop_test-${Date.now().toString(36)}-${n++}`;

    /**
     * **Sembrar un flyer como lo hace la callable: con el Admin SDK.**
     *
     * Hasta B-896 estos casos subían el objeto con el SDK del navegador y una
     * sesión de admin, porque la regla lo permitía. Ya no: el `create` de
     * `propuestas/` está en `false` para **todo** cliente, así que el único
     * camino por el que un objeto entra a este prefijo es
     * `subirFlyerDePropuesta`, que escribe con el Admin SDK y pasa por encima de
     * estas reglas. Sembrar así no es un atajo del test: es exactamente lo que
     * pasa en producción.
     *
     * El `firebaseStorageDownloadTokens` va explícito por el mismo motivo que en
     * `metadatosDelFlyer`: el Admin SDK no lo acuña solo, y sin él
     * `getDownloadURL()` —lo que la bandeja usa para mostrarle el flyer al
     * admin— se queda sin URL.
     */
    const sembrarFlyer = async (ruta: string) => {
      await adminBucket()
        .file(ruta)
        .save(Buffer.from(bytes(1024)), {
          resumable: false,
          metadata: {
            contentType: 'image/jpeg',
            metadata: { saneada: '1', firebaseStorageDownloadTokens: crypto.randomUUID() },
          },
        });
    };

    it('un admin ve el flyer que escribió la callable: es lo que le deja decidir', async () => {
      /*
       * El desvío del PRD, con la decisión del dueño del 2026-09-09: pedía «`get`
       * y `list` en `false`», y con `get` cerrado para todos el admin no puede
       * mirar la foto que le mandaron. La trampa 13 está escrita contra el
       * `read: if true` anónimo, no contra la sesión que ya lee la propuesta
       * entera en Firestore.
       */
      await signInWithCustomToken(auth(), await tokenPara(UID, true));
      const ruta = rutaDeImagenPropuesta(idPropuesta(), 'image/jpeg');
      await sembrarFlyer(ruta);

      const url = await getDownloadURL(ref(almacen(), ruta));
      const r = await fetch(url);
      expect(r.ok, 'el admin tiene que poder ver el flyer de la propuesta').toBe(true);
    });

    it('pero NO puede enumerar el prefijo, ni él: sería «dame todas las fotos que mandaron»', async () => {
      /*
       * Acá `list` está en `false` **para todos** y no en `esAdmin()` como en
       * `imagenes/`, y la diferencia es deliberada: la bandeja llega a cada
       * objeto por el `storagePath` de su documento y no necesita enumerar nunca.
       * Una lista de todas las fotos que mandaron personas distintas no le sirve
       * a nadie y es exactamente lo que la trampa 13 dice que no hay que ofrecer.
       */
      await signInWithCustomToken(auth(), await tokenPara(UID, true));
      await expect(listAll(ref(almacen(), 'propuestas'))).rejects.toThrow();
    });

    /**
     * **EL TESTIGO DE B-896, y reemplaza al que decía «todavía no».**
     *
     * Hasta acá este bloque tenía dos casos: uno que verificaba que un admin
     * pudiera subir respetando tipo/tamaño/nombre, y otro —«un anónimo TODAVÍA no
     * puede subir: falta que App Check exija»— escrito para ponerse **rojo** el
     * día que se borrara el `esAdmin() &&` y se abriera la subida anónima.
     *
     * **Ese día no va a llegar, y por eso el testigo cambia de signo.** Abrir
     * este `create` obligaba a exigir App Check en Storage, y el enforcement es
     * **por servicio y no por path**: exigirlo se lleva puestas las lecturas
     * públicas de imágenes del sitio (B-872). La salida fue romper el
     * acoplamiento — la subida va a una callable con `enforceAppCheck: true`, que
     * sanea del lado del servidor y escribe con el Admin SDK— y con eso este
     * prefijo se queda **cerrado para todo cliente**, que es más fuerte que
     * abrirlo.
     *
     * Así que lo que se afirma ahora es la propiedad nueva, con los **tres**
     * actores para que no quede colgada del que hoy importa: el anónimo de
     * `/proponer`, el rol `publicador` de B-888 y el admin. Se pone rojo el día
     * que alguien afloje el `if false`.
     *
     * MUTACIÓN PROBADA: `allow create: if esAdmin() && tipoAceptado()` (la línea
     * de antes de B-896) → la tercera mitad se pone roja.
     */
    it('nadie sube desde un cliente: ni un anónimo, ni un publicador, ni un admin — B-896', async () => {
      const conNombre = () => rutaDeImagenPropuesta(idPropuesta(), 'image/jpeg');

      await signOut(auth());
      expect(
        await rechaza(subir(conNombre(), bytes(512), 'image/jpeg')),
        'el anónimo de /proponer: ahora sube por la callable',
      ).toBe(true);

      await signInWithCustomToken(auth(), await tokenPublicador('uid_test_pub_propuestas'));
      expect(
        await rechaza(subir(conNombre(), bytes(512), 'image/jpeg')),
        'el rol publicador de B-888 no tiene nada que hacer en este prefijo',
      ).toBe(true);

      await signInWithCustomToken(auth(), await tokenPara(UID, true));
      expect(
        await rechaza(subir(conNombre(), bytes(512), 'image/jpeg')),
        'y el admin tampoco: el único que escribe acá es el Admin SDK de la callable',
      ).toBe(true);
    });

    it('nadie borra desde un cliente, ni siquiera un admin', async () => {
      /*
       * Los dos borrados que existen son de Functions con el Admin SDK: el del
       * rechazo (en el acto) y el de la retención (30 días). Que el panel no
       * pueda es lo que hace que el borrado sea **consecuencia del estado** y no
       * de que alguien se acuerde de tocar un botón.
       */
      await signInWithCustomToken(auth(), await tokenPara(UID, true));
      const ruta = rutaDeImagenPropuesta(idPropuesta(), 'image/jpeg');
      await sembrarFlyer(ruta);
      await expect(deleteObject(ref(almacen(), ruta))).rejects.toThrow();
    });

    /**
     * **Y acá hay una propiedad que hay que tener escrita, porque no es la que
     * uno supone.** La descubrió este mismo test, fallando.
     *
     * `allow get: if esAdmin()` cierra el acceso **por ruta**: sin sesión, pedir
     * la URL de descarga de un objeto de `propuestas/` es un permission-denied,
     * aunque se sepa el path exacto. Eso es lo que este caso fija.
     *
     * Lo que **no** cierra es la URL **ya emitida**. `getDownloadURL()` acuña un
     * token y esa URL sirve el objeto **sin volver a evaluar las reglas**: es una
     * capability, igual que en `imagenes/` (donde es deliberado, B-206 #1). O sea
     * que el flyer de una propuesta es privado mientras su URL no salga del
     * panel, y quien tenga esa URL lo lee sin sesión.
     *
     * Es aceptable —la URL solo se acuña adentro del panel, con una sesión de
     * admin, y el objeto se borra al rechazar o a los 30 días— pero **no es lo
     * mismo que «nadie puede leerlo»**, y `07-seguridad.md` lo dice con estas
     * palabras. Cerrar también esa puerta pediría no acuñar tokens nunca (bajar
     * los bytes con `getBlob`, que necesita CORS configurado en el bucket) y es
     * un frente aparte: **B-846**.
     */
    it('sin sesión no se llega al flyer por su ruta, ni sabiéndola', async () => {
      await signInWithCustomToken(auth(), await tokenPara(UID, true));
      const ruta = rutaDeImagenPropuesta(idPropuesta(), 'image/jpeg');
      await sembrarFlyer(ruta);
      const url = await getDownloadURL(ref(almacen(), ruta));

      await signOut(auth());
      await expect(
        getDownloadURL(ref(almacen(), ruta)),
        'la puerta por ruta tiene que estar cerrada sin sesión',
      ).rejects.toThrow();

      // Y el otro lado de la misma moneda, afirmado a propósito y no omitido: la
      // URL que el panel ya acuñó **sigue sirviendo**. Si algún día deja de ser
      // cierto —porque se dejen de acuñar tokens, B-846— este caso se pone rojo y
      // hay que venir a decidirlo, en vez de descubrirlo con una imagen rota.
      const r = await fetch(url);
      expect(
        r.ok,
        'la URL de descarga es una capability: quien la tiene lee el objeto (ver B-846)',
      ).toBe(true);
    });
  });

  describe('sin el claim de admin', () => {
    it('nadie puede LISTAR el prefijo: es lo que sostiene todo B-206 #1 (trampa 13)', async () => {
      // El argumento de que publicar el path es inofensivo se apoya en que el
      // path sea **opaco** — un uuid que nadie puede adivinar. Eso solo vale
      // mientras nadie pueda **enumerar** `imagenes/`: con un `listAll()`
      // anónimo, la opacidad no compra nada y el bucket entero —incluidas las
      // fotos de actividades en borrador— se cosecha de una.
      //
      // Hoy se cumple por la **forma** de la regla: `match /imagenes/{archivo}`
      // no matchea el prefijo, así que el `list` cae en el `deny` del catch-all.
      // Eso es frágil: el día que alguien escriba `{ruta=**}` —el patrón más
      // natural, y el que va a hacer falta si mañana hay `imagenes/miniaturas/`—
      // la lectura sigue andando, todo lo demás sigue verde, y esto se abre sin
      // que nada avise. Por eso se afirma acá y no se deja implícito.
      //
      // **Y ese día llegó, con la respuesta puesta** (B-220, D-175): la
      // miniatura de la Function no vive en `imagenes/miniaturas/` sino en
      // `miniaturas/`, hermana. Este comentario es la razón por la que el
      // prefijo es hermano y no hijo — la advertencia estaba escrita antes de que
      // hubiera Function, y se le hizo caso.
      await signOut(auth());
      await expect(listAll(ref(almacen(), 'imagenes'))).rejects.toThrow();
    });

    it('tampoco se puede LISTAR miniaturas/, y ahí importa más (trampa 13)', async () => {
      // El nombre de una miniatura se **deriva** del del original
      // (`rutaDeMiniatura`), así que enumerar `miniaturas/` es enumerar
      // `imagenes/` con otro nombre: la opacidad del path de B-206 #1 se
      // perdería por la puerta de al lado, y adentro están también los flyers de
      // las actividades en borrador.
      //
      // Verificado con `allow get: if true` puesto en la misma regla, que es el
      // caso en el que la trampa 13 muerde: `read` incluye las dos.
      await signOut(auth());
      await expect(listAll(ref(almacen(), 'miniaturas'))).rejects.toThrow();
    });

    it('una sesión sin el claim no puede subir', async () => {
      await signInWithCustomToken(auth(), await tokenPara('uid_test_storage_pelado', false));
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');
      expect(await rechaza(subir(ruta, bytes(512), 'image/jpeg'))).toBe(true);
    });

    it('sin sesión tampoco', async () => {
      await signOut(auth());
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');
      expect(await rechaza(subir(ruta, bytes(512), 'image/jpeg'))).toBe(true);
    });

    /**
     * **El rol `publicador` (B-888, tajada 2): sube, y no hace nada más.**
     *
     * Hasta la tajada 1 este caso afirmaba lo contrario —que el rol **no** podía
     * subir— y estaba puesto como red de un comentario: `storage.rules` decía que
     * el rol no existía en el archivo y que no se cerrara con un `|| esPublicador()`
     * mecánico. **Se puso rojo el día que la tajada 2 lo abrió, que es exactamente
     * para lo que estaba**, y por eso la decisión se tomó acá y no se descubrió
     * después.
     *
     * Lo que se abrió es **crear y nada más**, y las cuatro mitades de abajo son
     * las cuatro cláusulas que lo hacen acotado. El razonamiento —y por qué no se
     * agrupó por uid— está en el docblock del principio de `storage.rules`.
     *
     * ⚠️ **La segunda mitad es la que enseñó algo, y hay que leerla.** La guarda
     * contra pisar el objeto de otro **no** es separar `allow create` de
     * `allow update`: se probó contra este mismo emulador el 2026-09-11 y con
     * `create: if true` + `update: if false` **la segunda subida pasa**. La guarda
     * que sí frena, y que sí se puede verificar, es `resource == null`.
     *
     * MUTACIÓN PROBADA, una por caso:
     *  - sacar `esPublicador()` de la última línea del `allow create, update` →
     *    rojo el primero;
     *  - sacar el `resource == null` de esa misma línea → rojo el segundo (y ésa
     *    es la mutación que importa: con la separación `create`/`update` en su
     *    lugar, este caso queda **verde sin frenar nada**);
     *  - abrir `allow delete` a `esDelPanel()` → rojo el tercero;
     *  - abrir `allow list` a `esDelPanel()` → rojo el cuarto.
     * Ninguna mueve los otros casos del archivo.
     */
    it('el rol publicador de B-888 sube su imagen, y solo eso', async () => {
      await signInWithCustomToken(auth(), await tokenPublicador('uid_test_storage_publicador'));
      const ruta = rutaDeImagen(idNuevo(), 'image/jpeg');

      // 1. Sube. Un archivo **válido** —tipo, tamaño y nombre correctos—, para que
      // lo único que pueda rechazarlo sea el claim.
      await subir(ruta, bytes(512), 'image/jpeg');

      /*
       * 2. Y **no pisa lo que ya está** — `resource == null`.
       *
       * Es la cláusula que impide que un publicador reemplace el flyer de otro
       * conociendo su uuid, y el uuid es conocible: viaja adentro de la URL de
       * descarga, que para una actividad publicada es pública (B-206 #1). Es lo
       * único que el prefijo plano deja verificar sobre «de quién es» este objeto.
       *
       * Se prueba sobre el objeto que **él mismo** acaba de subir, que es el caso
       * más favorable posible: si ni el propio se puede pisar, el ajeno tampoco.
       */
      expect(
        await rechaza(subir(ruta, bytes(600), 'image/jpeg')),
        'un publicador pudo pisar un objeto que ya existía',
      ).toBe(true);

      // 3. No borra: el panel no borra de Storage desde ningún lado, y abrirlo
      // sería dejar borrar la foto de cualquiera que conozca el uuid.
      expect(await rechaza(deleteObject(ref(almacen(), ruta)))).toBe(true);

      // 4. Y tampoco enumera el prefijo (trampa 13): `list` sigue siendo de admin.
      await expect(listAll(ref(almacen(), 'imagenes'))).rejects.toThrow();
    });

    /**
     * **Y las tres cláusulas de forma le siguen aplicando**, que es lo que hace
     * que `create` abierto al rol no sea `create` abierto a cualquier cosa: el
     * tipo, el tamaño y el nombre del objeto se verifican igual que para un admin.
     *
     * Sin este caso, un `create: if esDelPanel()` pelado —sin las tres— pasaría
     * el caso de arriba sin que nada avise, y el prefijo aceptaría un archivo de
     * 80 MB de un rol nuevo. Es la misma clase que el documento sonda de
     * `escritura-anonima`: un aserto que se lee como load-bearing y no puede fallar.
     */
    it('y al publicador le aplican las mismas cláusulas de forma que al admin', async () => {
      await signInWithCustomToken(auth(), await tokenPublicador('uid_test_storage_publicador'));
      expect(
        await rechaza(subir(rutaDeImagen(idNuevo(), 'image/jpeg'), bytes(MAXIMO_BYTES + 1), 'image/jpeg')),
        'el tope de tamaño no le aplica al publicador',
      ).toBe(true);
      expect(
        await rechaza(subir(`imagenes/${idNuevo()}.jpg`.replace('img_', 'otro_'), bytes(512), 'image/jpeg')),
        'el patrón del nombre no le aplica al publicador',
      ).toBe(true);
      expect(
        await rechaza(
          uploadBytes(ref(almacen(), rutaDeImagen(idNuevo(), 'image/jpeg')), bytes(512), {
            contentType: 'image/jpeg',
            // B-220 / D-175 — la marca de la Function no se puede subir desde un
            // cliente, y eso vale para los dos roles: sin esto el trigger de
            // optimización se saltea y el JPEG queda público con su GPS adentro.
            customMetadata: { optimizada: '1' },
          }),
        ),
        'la marca de la Function no le aplica al publicador',
      ).toBe(true);
    });
  });
});
