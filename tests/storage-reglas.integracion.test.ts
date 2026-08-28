import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import {
  connectStorageEmulator,
  getDownloadURL,
  getStorage,
  listAll,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { app, auth } from '@/lib/firebase-client';
import { MAXIMO_BYTES } from '@/lib/imagenes';
import { rutaDeImagen } from '@/lib/imagenes-archivo';
import { cargarReglasStorage, emuladorStorageVivo } from './emulador';

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
  const app = initAdmin({ projectId: 'agenda-literaria' }, `s-${uid}-${Date.now()}`);
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
      await signOut(auth());
      await expect(listAll(ref(almacen(), 'imagenes'))).rejects.toThrow();
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
