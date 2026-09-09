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
  describe('el prefijo de las propuestas (DEC-11)', () => {
    const idPropuesta = () => `prop_test-${Date.now().toString(36)}-${n++}`;

    it('un admin sube el flyer y lo puede VER: es lo que le deja decidir', async () => {
      /*
       * El desvío del PRD, con la decisión del dueño del 2026-09-09: pedía «`get`
       * y `list` en `false`», y con `get` cerrado para todos el admin no puede
       * mirar la foto que le mandaron. La trampa 13 está escrita contra el
       * `read: if true` anónimo, no contra la sesión que ya lee la propuesta
       * entera en Firestore.
       */
      await signInWithCustomToken(auth(), await tokenPara(UID, true));
      const ruta = rutaDeImagenPropuesta(idPropuesta(), 'image/jpeg');
      await subir(ruta, bytes(1024), 'image/jpeg');

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

    it('rechaza lo mismo que `imagenes/`: el tamaño, el tipo y el nombre', async () => {
      await signInWithCustomToken(auth(), await tokenPara(UID, true));
      const conNombre = (archivo: string) => `propuestas/${archivo}`;

      expect(
        await rechaza(subir(rutaDeImagenPropuesta(idPropuesta(), 'image/jpeg'), bytes(MAXIMO_BYTES + 1), 'image/jpeg')),
        'el tope de 3 MB',
      ).toBe(true);
      expect(
        await rechaza(subir(conNombre(`${idPropuesta()}.webp`), bytes(512), 'image/webp')),
        'un tipo que no sabemos limpiar',
      ).toBe(true);
      expect(
        await rechaza(subir(conNombre('flyer.jpg'), bytes(512), 'image/jpeg')),
        'un nombre sin la forma de id',
      ).toBe(true);
      expect(
        await rechaza(subir(conNombre('sub/x.jpg'), bytes(512), 'image/jpeg')),
        'un segundo segmento: `match /propuestas/{archivo}` es de uno solo',
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
      await subir(ruta, bytes(512), 'image/jpeg');
      await expect(deleteObject(ref(almacen(), ruta))).rejects.toThrow();
    });

    /**
     * **El testigo de la puerta que todavía no está abierta.**
     *
     * `create` es `esAdmin() && …` a propósito: falta que App Check esté
     * exigiendo (B-836a), exactamente igual que el `create` de `/propuestas` en
     * `firestore.rules`. Este caso es el que se pone rojo el día que se borre ese
     * `esAdmin() &&`, y está escrito para que abrir la puerta sea un diff visible
     * en un test y no un efecto colateral.
     */
    it('un anónimo TODAVÍA no puede subir: falta que App Check exija (B-836a)', async () => {
      await signOut(auth());
      const ruta = rutaDeImagenPropuesta(idPropuesta(), 'image/jpeg');
      expect(await rechaza(subir(ruta, bytes(512), 'image/jpeg'))).toBe(true);
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
      await subir(ruta, bytes(512), 'image/jpeg');
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
  });
});
