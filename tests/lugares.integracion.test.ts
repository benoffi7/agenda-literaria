/**
 * Reglas y escritura de `/lugares/{id}` contra el emulador — B-833, PRD 4.
 *
 * ── Por qué este archivo es el que importa de esta tajada ─────────────────
 * `/lugares` es la **cuarta** colección que va a aceptar una escritura anónima, y
 * `formaDeLugar()` es lo único que va a acotar un documento que escribe alguien
 * sin login. El schema de zod no cuenta: se saltea con un `curl`. Cada tope, cada
 * enum y cada `null` de la regla tiene su caso acá, y se prueban **contra el
 * emulador** porque un `grep` al archivo pasaría con la regla escrita mal
 * (`'Publicado'`, `!=`, el campo renombrado) — el argumento de B-218.
 *
 * ── Y la cláusula que ninguna otra colección tiene: el domicilio particular ─
 * § 6 del PRD 4. **Del camino público la dirección no puede nacer publicada**, y
 * eso lo tiene que hacer cumplir la regla porque los dos agravantes del § 6 son
 * de este lado: lo carga cualquiera sin login —nada garantiza que quien cargó la
 * casa sea quien vive ahí— y `geo` la pone en un mapa. Con la validación solo en
 * el cliente, un `curl` publica la dirección de la casa de un tercero.
 *
 * **La cláusula NO mira el tipo de lugar**, y eso lo corrigió el
 * `auditor-privacidad`: `/opciones/tipo-lugar` es un vocabulario abierto, así que
 * una lista de tipos en la regla es una lista negra que `ph` o `mi-living`
 * esquivan. Por eso los casos de abajo prueban con cuatro tipos y no con uno.
 *
 * Es la única cláusula del proyecto que defiende **el dato de una persona que no
 * está en la conversación**, así que sus casos están escritos aparte y con su
 * motivo.
 *
 * ── Y por qué hay tantos controles POSITIVOS ──────────────────────────────
 * Porque una denegación es lo que devuelve también un emulador que no está, una
 * base sin reglas o un `projectId` equivocado (**B-894**). Cada `describe` abre o
 * cierra con el caso que tiene que **funcionar**.
 *
 * ── El `create` anónimo todavía está cerrado, y los casos lo dicen ────────
 * Lo bloquea **B-872** (App Check sin exigir en Storage), no la falta de código.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import type { Firestore as FirestoreAdmin } from 'firebase-admin/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { formALugar, lugarVacio } from '@/lib/lugar-schema';
import type { Lugar, LugarForm } from '@/types/lugar';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';
import type { TimestampLike } from '@/types/actividad';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID = 'uid_lugares_admin';
const UID_PELADO = 'uid_lugares_sin_claim';
const UID_PUBLICADOR = 'uid_lugares_publicador';

const token = async (uid: string, claims: Record<string, boolean>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `l-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, claims);
  const t = await a.createCustomToken(uid, claims);
  await deleteAdminApp(app);
  return t;
};

/** El Admin SDK, para sembrar lo que ningún cliente puede escribir. */
const conAdminSdk = async (fn: (db: FirestoreAdmin) => Promise<void>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `l-sdk-${Date.now()}-${Math.random()}`);
  await fn(getAdminFirestore(app));
  await deleteAdminApp(app);
};

const form = (over: Partial<LugarForm> = {}): LugarForm => ({
  ...lugarVacio(),
  nombre: 'El Salón del Fondo',
  descripcion: 'Un salón con mesa larga y patio, atrás del café.',
  tipo: 'cafe',
  direccion: 'Honduras 4321',
  barrio: 'palermo',
  ciudad: 'Ciudad de Buenos Aires',
  geo: { lat: '-34.5875', lng: '-58.4306' },
  direccionPublica: true,
  capacidad: '30',
  capacidadNotas: 'Sentados 20, de pie 35',
  incluye: ['mesa-larga'],
  incluyeOtro: 'Una biblioteca de la casa',
  condicion: 'con-consumicion',
  precio: { monto: '25000', porUnidad: 'hora' },
  condicionNotas: 'Mínimo de consumición $8000 por persona',
  instagram: '@elsalondelfondo',
  whatsapp: '+54 9 11 2222-3333',
  mail: 'hola@elsalon.test',
  web: 'https://elsalon.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@elsalon.test' },
  ...over,
});

/** El sentinel, tipado como el `Timestamp` que va a quedar. Igual que en `lib/`. */
const ahora = () => serverTimestamp() as unknown as TimestampLike;

/**
 * El documento tal como lo va a mandar el cliente, para poder deformarlo campo
 * por campo. `origen: 'panel'` porque el `create` de hoy es del admin, y la regla
 * exige que el origen coincida con quién escribe.
 */
const documento = (over: Record<string, unknown> = {}, f: LugarForm = form()) => ({
  ...formALugar(f, ahora(), 'panel'),
  creadoEn: serverTimestamp(),
  ...over,
});

const RECHAZADA = /permission|insufficient/i;

/** Una lectura denegada **por permisos**, no por cualquier cosa. */
const rechazadaPorPermisos = async (lectura: Promise<unknown>, que: string) => {
  let error: unknown;
  try {
    await lectura;
  } catch (e) {
    error = e;
  }
  expect(error, `${que}: NO se rechazó`).toBeDefined();
  expect((error as { code?: string }).code, `${que}: se rechazó, pero no por permisos`).toBe(
    'permission-denied',
  );
};

describe.skipIf(!vivo)('lugares para eventos contra el emulador — B-833', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    // B-174 / B-219 — las reglas de este checkout, sobre la base de este
    // working-tree, que arranca sin ninguna.
    await cargarReglas(REGLAS);
    await signInWithCustomToken(auth(), await token(UID, { admin: true }));
  }, 30_000);

  describe('el camino que hoy funciona: un admin carga un lugar', () => {
    it('crea una ficha válida y la puede leer', async () => {
      await setDoc(doc(db(), 'lugares', 'l_ok'), documento());
      const snap = await getDoc(doc(db(), 'lugares', 'l_ok'));
      expect(snap.exists()).toBe(true);
      const d = snap.data() as Lugar;
      expect(d.nombre).toBe('El Salón del Fondo');
      // El slug sale derivado del nombre, y es el que va a estar en la URL para
      // siempre (trampa 10).
      expect(d.slug).toBe('el-salon-del-fondo');
      expect(d.estado).toBe('pendiente');
      expect(d.revision).toEqual({ porUid: null, en: null, motivo: null });
      // Normalizados, que es lo que la ficha va a publicar.
      expect(d.instagram).toBe('elsalondelfondo');
      expect(d.whatsapp).toBe('5491122223333');
      expect(d.web).toBe('https://elsalon.test/');
      expect(d.direccionPublica).toBe(true);
      expect(d.capacidad).toBe(30);
      // Y el precio quedó con la hora del servidor, no con la del navegador.
      expect(d.precio?.valor).toEqual({ monto: 25000, porUnidad: 'hora' });
      expect((d.precio?.cargadoEn as Timestamp).toMillis()).toBeGreaterThan(0);
      // ⚠️ Y el `searchText` NO lleva la dirección: ese campo se publica.
      expect(d.searchText).not.toContain('honduras');
    });

    it('acepta los opcionales en null, que es lo que una regla mal escrita rechaza de más', async () => {
      /*
       * Un lugar sin precio, sin redes, sin foto, sin capacidad **y sin
       * dirección** es una ficha válida: es exactamente la casa del § 6, donde la
       * dirección se pide escribiendo. Y el precio en `null` es el «no sé si todos
       * cobran» del § 5.
       */
      await setDoc(
        doc(db(), 'lugares', 'l_nulls'),
        documento(
          {},
          form({
            descripcion: '',
            tipo: 'casa',
            direccion: '',
            direccionPublica: false,
            geo: { lat: '', lng: '' },
            capacidad: '',
            capacidadNotas: '',
            incluye: [],
            incluyeOtro: '',
            precio: { monto: '', porUnidad: '' },
            condicionNotas: '',
            instagram: '',
            whatsapp: '',
            mail: '',
            web: '',
            contactoDeQuienCargo: { via: 'mail', valor: '' },
          }),
        ),
      );
      const d = (await getDoc(doc(db(), 'lugares', 'l_nulls'))).data() as Lugar;
      expect(d.direccion).toBeNull();
      expect(d.geo).toBeNull();
      expect(d.direccionPublica).toBe(false);
      expect(d.capacidad).toBeNull();
      expect(d.precio).toBeNull();
      expect(d.contactoDeQuienCargo).toBeNull();
    });
  });

  describe('la forma del documento: lo que `formaDeLugar()` rechaza', () => {
    const rechaza = async (id: string, over: Record<string, unknown>, f?: LugarForm) =>
      expect(setDoc(doc(db(), 'lugares', id), documento(over, f))).rejects.toThrow(RECHAZADA);

    it('un campo de más o uno de menos', async () => {
      await rechaza('l_extra', { colado: 'x' });
      const { mail, ...sinMail } = documento();
      void mail;
      await expect(setDoc(doc(db(), 'lugares', 'l_falta'), sinMail)).rejects.toThrow(RECHAZADA);
    });

    it('un nombre o una descripción fuera de rango', async () => {
      await rechaza('l_nom', {}, form({ nombre: 'x' }));
      await rechaza('l_desc', { descripcion: 'x'.repeat(1501) });
    });

    it('un slug que no es un slug — trampa 10', async () => {
      await rechaza('l_slug', { slug: 'Con Mayúsculas' });
      await rechaza('l_slug2', { slug: '' });
    });

    it('un vocabulario que no es un slug, en cualquiera de los cuatro', async () => {
      await rechaza('l_tipo', { tipo: 'Café' });
      await rechaza('l_tipo2', { tipo: '' });
      await rechaza('l_barrio', { barrio: 'Villa Crespo' });
      await rechaza('l_cond', { condicion: 'Con Consumición' });
      await rechaza('l_cond2', { condicion: '' });
    });

    it('una dirección demasiado corta o demasiado larga', async () => {
      await rechaza('l_dir', { direccion: 'a-' });
      await rechaza('l_dir2', { direccion: 'x'.repeat(161) });
    });

    it('⚠️ el flag de la dirección tiene que ser un booleano, no un truthy', async () => {
      /*
       * La proyección falla cerrada (`!== true`), pero la regla es la que impide
       * que el documento llegue con `'si'` o con `1` adentro. Sin esta cláusula, un
       * consumidor futuro que escriba `if (l.direccionPublica)` publicaría la
       * dirección de una casa.
       */
      await rechaza('l_flag', { direccionPublica: 'si' });
      await rechaza('l_flag2', { direccionPublica: 1 });
      await rechaza('l_flag3', { direccionPublica: null });
    });

    it('una geo rota', async () => {
      await rechaza('l_geo', { geo: { lat: 200, lng: 0 } });
      await rechaza('l_geo2', { geo: { lat: -34.6, lng: 500 } });
      await rechaza('l_geo3', { geo: { lat: -34.6 } });
      await rechaza('l_geo4', { geo: { lat: '-34.6', lng: '-58.4' } });
    });

    it('una capacidad fuera de rango', async () => {
      await rechaza('l_cap', { capacidad: 0 });
      await rechaza('l_cap2', { capacidad: 99999 });
    });

    it('una lista más larga que su tope: es lo único que la regla puede acotar de una lista', async () => {
      await rechaza('l_incluye', {
        incluye: Array.from({ length: 17 }, (_, i) => `cosa-${i}`),
      });
    });

    it('un precio con forma rota, un monto absurdo o una unidad inventada', async () => {
      await rechaza('l_precio', { precio: { monto: 25000 } });
      await rechaza('l_precio2', {
        precio: { valor: { monto: 0, porUnidad: 'hora' }, cargadoEn: serverTimestamp() },
      });
      await rechaza('l_precio3', {
        precio: { valor: { monto: 25000.5, porUnidad: 'hora' }, cargadoEn: serverTimestamp() },
      });
      await rechaza('l_precio4', {
        precio: {
          valor: { monto: 25000, porUnidad: 'por-luna-llena' },
          cargadoEn: serverTimestamp(),
        },
      });
    });

    it('una web sin esquema, o con uno que no es http(s)', async () => {
      await rechaza('l_web', { web: 'elsalon.test' });
      await rechaza('l_web2', { web: 'javascript:alert(1)' });
    });

    it('un contacto interno demasiado corto o con una vía inventada', async () => {
      await rechaza('l_cont', { contactoDeQuienCargo: { via: 'mail', valor: 'ab' } });
      await rechaza('l_cont2', { contactoDeQuienCargo: { via: 'paloma', valor: 'hola@x.test' } });
    });

    it('y el control POSITIVO: el documento perfecto entra', async () => {
      // Sin esto, todos los casos de arriba podrían estar pasando porque la regla
      // rechaza **todo** — que es lo que devuelve también un emulador sin reglas.
      await setDoc(doc(db(), 'lugares', 'l_perfecto'), documento({ slug: 'perfecto' }));
      expect((await getDoc(doc(db(), 'lugares', 'l_perfecto'))).exists()).toBe(true);
    });
  });

  describe('lo que solo vale al crearse — `lugarDeGuiaValido()`', () => {
    const rechaza = async (id: string, over: Record<string, unknown>, f?: LugarForm) =>
      expect(setDoc(doc(db(), 'lugares', id), documento(over, f))).rejects.toThrow(RECHAZADA);

    it('el estado inicial lo fuerza la REGLA, no el cliente', async () => {
      // Sin esto, un `curl` publica su propio lugar —con la dirección adentro— y
      // la bandeja no sirve para nada.
      await rechaza('l_pub', { estado: 'publicado' });
    });

    it('nadie nace revisado ni «ya publicado alguna vez»', async () => {
      await rechaza('l_rev', { revision: { porUid: UID, en: null, motivo: null } });
      await rechaza('l_marca', { publicadaAlgunaVez: true });
    });

    it('un admin no puede hacer pasar su carga por una ficha que llegó de afuera', async () => {
      await rechaza('l_origen', { origen: 'formulario-publico' });
    });

    it('el cliente no puede antedatar la ficha', async () => {
      await rechaza('l_fecha', { creadoEn: Timestamp.fromDate(new Date('2020-01-01')) });
    });

    it('el precio no puede nacer con una fecha inventada — B-837', async () => {
      await rechaza('l_precio_viejo', {
        precio: {
          valor: { monto: 25000, porUnidad: 'hora' },
          cargadoEn: Timestamp.fromDate(new Date('2026-01-01')),
        },
      });
      await rechaza('l_precio_futuro', {
        precio: {
          valor: { monto: 25000, porUnidad: 'hora' },
          cargadoEn: Timestamp.fromDate(new Date('2030-01-01')),
        },
      });
    });
  });

  /**
   * ⚠️ **§ 6 DEL PRD 4 — LA CLÁUSULA QUE NINGUNA OTRA COLECCIÓN TIENE.**
   *
   * «Un lugar con `tipo: 'casa'` no publica dirección ni `geo` por default, **y
   * ese default no lo puede cambiar el formulario público**» (criterio 3).
   *
   * Los tres casos de abajo son las tres mitades de la decisión: qué rechaza,
   * qué acepta, y por qué un admin sí puede.
   */
  describe('el domicilio particular — § 6, criterio 3', () => {
    it('⚠️ el camino público NO publica la dirección, con NINGÚN tipo de lugar', async () => {
      /*
       * **La cláusula que defiende el dato de alguien que no está en la
       * conversación.** Nada garantiza que quien cargó la casa sea quien vive ahí,
       * y `geo` la pone en un mapa.
       *
       * Se escribe con el documento deformado a propósito: `formALugar` ya fuerza
       * el `false` del lado del cliente, así que para probar **la regla** hay que
       * mandarle lo que un `curl` mandaría. Es la diferencia entre «el cliente lo
       * hace bien» y «el servidor no acepta otra cosa».
       *
       * **Y se prueba con cuatro tipos, no con `casa`** — lo pidió el
       * `auditor-privacidad`. La primera versión de la cláusula decía
       * `d.tipo != 'casa' || …`, o sea una lista negra de **un** elemento sobre un
       * vocabulario **abierto**: `ph`, `mi-living` o `domicilio-particular` la
       * pasaban con el flag prendido. Hoy la cláusula mira solo el origen.
       *
       * MUTACIÓN PROBADA: volver a la versión con `d.tipo != 'casa'` deja en rojo
       * los tres tipos que no son `casa`; sacar la cláusula entera deja los cuatro.
       */
      await signOut(auth());
      for (const tipo of ['casa', 'ph', 'mi-living', 'domicilio-particular']) {
        const lugar = {
          ...formALugar(form({ tipo }), ahora(), 'panel'),
          creadoEn: serverTimestamp(),
          origen: 'formulario-publico',
          direccionPublica: true,
        };
        await expect(
          setDoc(doc(db(), 'lugares', `l_anon_${tipo}`), lugar),
          `el tipo «${tipo}» publicó la dirección desde el camino público`,
        ).rejects.toThrow(RECHAZADA);
      }
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });

    it('y el control POSITIVO: el camino público SÍ puede crear, con el flag apagado', async () => {
      /*
       * Sin esto, el caso de arriba podría estar pasando porque la regla rechaza
       * **todo** lo que venga del formulario público, que es lo que devuelve
       * también un `create` cerrado. Se escribe con el Admin SDK porque el `create`
       * anónimo todavía está bloqueado por `esAdmin()` (B-872): lo que se verifica
       * acá es `lugarDeGuiaValido()`, no la puerta.
       */
      // El Admin SDK no entiende el sentinel del cliente, así que la fecha del
      // precio entra como `Date` — es siembra, no la escritura que la regla mira.
      await conAdminSdk(async (adminDb) => {
        await adminDb.doc('lugares/l_anon_ok').set({
          ...formALugar(form({ tipo: 'ph' }), new Date() as never, 'formulario-publico'),
          creadoEn: new Date(),
        });
      });
      const d = (await getDoc(doc(db(), 'lugares', 'l_anon_ok'))).data() as Lugar;
      expect(d.origen).toBe('formulario-publico');
      expect(d.direccionPublica).toBe(false);
      // La dirección **se guarda**: lo que no se hace es publicarla.
      expect(d.direccion).toBe('Honduras 4321');
    });

    it('un admin SÍ puede: puede haber pedido permiso a quien vive ahí', async () => {
      /*
       * Es la única forma legítima en que la casa de alguien publica su dirección,
       * y por eso la cláusula mira el **origen** y no el tipo a secas. Prohibirlo
       * del todo dejaría sin camino al caso real —la persona que sí quiere que se
       * publique— y empujaría a cargarlo como «centro cultural», que es peor.
       */
      await setDoc(
        doc(db(), 'lugares', 'l_casa_admin'),
        documento({ slug: 'casa-con-permiso', direccionPublica: true }, form({ tipo: 'casa' })),
      );
      const d = (await getDoc(doc(db(), 'lugares', 'l_casa_admin'))).data() as Lugar;
      expect(d.tipo).toBe('casa');
      expect(d.direccionPublica).toBe(true);
    });

    it('y el camino público con la casilla apagada entra sin problema', async () => {
      /*
       * El control positivo de la cláusula: lo que se rechaza es **publicar la
       * dirección**, no cargar una casa. Sin este caso, la cláusula podría estar
       * rechazando el tipo entero y los dos de arriba no lo dirían.
       */
      const casa = {
        ...formALugar(form({ tipo: 'casa', direccionPublica: false }), ahora(), 'panel'),
        creadoEn: serverTimestamp(),
        slug: 'casa-sin-direccion',
      };
      await setDoc(doc(db(), 'lugares', 'l_casa_ok'), casa);
      const d = (await getDoc(doc(db(), 'lugares', 'l_casa_ok'))).data() as Lugar;
      expect(d.direccionPublica).toBe(false);
      // Y la dirección **está guardada**: el admin la necesita para poder
      // contestar «¿dónde queda?». Lo que la protege es la proyección.
      expect(d.direccion).toBe('Honduras 4321');
    });

    it('apagar la casilla de una ficha ya publicada es una edición normal — y tiene que serlo', async () => {
      /*
       * El caso urgente: alguien pide que se baje su dirección. Tiene que ser un
       * click y una escritura, sin pasar por despublicar la ficha entera.
       *
       * MUTACIÓN PROBADA: agregar `d.direccionPublica == previo.direccionPublica`
       * a `lugarDeGuiaActualizable()` deja este caso en rojo — y el efecto real
       * sería que bajar una dirección obliga a borrar la ficha.
       */
      await setDoc(doc(db(), 'lugares', 'l_bajar'), documento({ slug: 'para-bajar' }));
      await updateDoc(doc(db(), 'lugares', 'l_bajar'), {
        estado: 'publicado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      await updateDoc(doc(db(), 'lugares', 'l_bajar'), { direccionPublica: false });
      const d = (await getDoc(doc(db(), 'lugares', 'l_bajar'))).data() as Lugar;
      expect(d.direccionPublica).toBe(false);
      expect(d.estado).toBe('publicado');
    });
  });

  describe('la edición — `lugarDeGuiaActualizable()`', () => {
    beforeAll(async () => {
      await setDoc(doc(db(), 'lugares', 'l_edit'), documento({ slug: 'para-editar' }));
    });

    it('un admin corrige el contenido', async () => {
      await updateDoc(doc(db(), 'lugares', 'l_edit'), { capacidadNotas: 'Sentados 25' });
      const d = (await getDoc(doc(db(), 'lugares', 'l_edit'))).data() as Lugar;
      expect(d.capacidadNotas).toBe('Sentados 25');
    });

    it('pero no puede reescribir la historia', async () => {
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_edit'), { origen: 'formulario-publico' }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_edit'), {
          creadoEn: Timestamp.fromDate(new Date('2020-01-01')),
        }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_edit'), { publicadaAlgunaVez: true }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('mover el estado exige firmar con el uid propio y la hora del servidor', async () => {
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_edit'), {
          estado: 'publicado',
          revision: { porUid: 'otro-uid', en: serverTimestamp(), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_edit'), {
          estado: 'publicado',
          revision: { porUid: UID, en: Timestamp.fromDate(new Date('2020-01-01')), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
      // Y el control positivo: firmada como corresponde, entra.
      await updateDoc(doc(db(), 'lugares', 'l_edit'), {
        estado: 'publicado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      const d = (await getDoc(doc(db(), 'lugares', 'l_edit'))).data() as Lugar;
      expect(d.estado).toBe('publicado');
    });

    it('con la ficha publicada, el slug queda congelado — trampa 10', async () => {
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_edit'), { slug: 'otro-slug' }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('y no se puede publicar de un saque lo que ya se había descartado', async () => {
      await setDoc(doc(db(), 'lugares', 'l_rechazado'), documento({ slug: 'descartado' }));
      await updateDoc(doc(db(), 'lugares', 'l_rechazado'), {
        estado: 'rechazado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: 'spam' },
      });
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_rechazado'), {
          estado: 'publicado',
          revision: { porUid: UID, en: serverTimestamp(), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
      // Reabrir sí: es el paso que obliga a mirarlo de nuevo.
      await updateDoc(doc(db(), 'lugares', 'l_rechazado'), {
        estado: 'pendiente',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
    });

    /**
     * **B-837 — la fecha del precio, y es la mitad que no se puede resolver en el
     * cliente.**
     *
     * Las dos direcciones son la misma decisión: corregir **otra cosa** no puede
     * mover la fecha del precio, y cambiar el **número** obliga a refecharlo con
     * el reloj del servidor.
     *
     * MUTACIÓN PROBADA: sacar la cláusula del `update` deja los dos primeros
     * casos en rojo; dejar solo `cargadoEn == request.time` deja en rojo el
     * tercero, que es el camino normal de toda edición.
     */
    it('la fecha del precio no se puede elegir, y no se mueve sola', async () => {
      await setDoc(doc(db(), 'lugares', 'l_precio'), documento({ slug: 'con-precio' }));
      const previo = (await getDoc(doc(db(), 'lugares', 'l_precio'))).data() as Lugar;

      // (1) Una fecha elegida, con el mismo precio: no.
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_precio'), {
          precio: {
            valor: { monto: 25000, porUnidad: 'hora' },
            cargadoEn: Timestamp.fromDate(new Date('2026-01-01')),
          },
        }),
      ).rejects.toThrow(RECHAZADA);

      // (2) Un precio nuevo con la fecha vieja: tampoco. Sería publicar un número
      // nuevo diciendo que es de hace meses.
      await expect(
        updateDoc(doc(db(), 'lugares', 'l_precio'), {
          precio: { valor: { monto: 30000, porUnidad: 'hora' }, cargadoEn: previo.precio!.cargadoEn },
        }),
      ).rejects.toThrow(RECHAZADA);

      // (3) El camino normal: corregir otra cosa deja la fecha donde estaba.
      await updateDoc(doc(db(), 'lugares', 'l_precio'), {
        condicionNotas: 'Dos horas mínimo',
        precio: { valor: { monto: 25000, porUnidad: 'hora' }, cargadoEn: previo.precio!.cargadoEn },
      });

      // (4) Y cambiar el número refecha con la hora del servidor.
      await updateDoc(doc(db(), 'lugares', 'l_precio'), {
        precio: { valor: { monto: 30000, porUnidad: 'hora' }, cargadoEn: serverTimestamp() },
      });
      const d = (await getDoc(doc(db(), 'lugares', 'l_precio'))).data() as Lugar;
      expect(d.precio?.valor.monto).toBe(30000);
      expect((d.precio!.cargadoEn as Timestamp).toMillis()).toBeGreaterThan(
        (previo.precio!.cargadoEn as Timestamp).toMillis(),
      );

      // (5) La puerta abierta a propósito: refechar un precio que **no** cambió es
      // «lo revisé hoy y sigue siendo éste», que es la respuesta al aviso de los
      // sesenta días. Sin ella, un precio vigente solo podría dejar de pedir
      // revisión cambiándole el número — o sea mintiendo.
      await updateDoc(doc(db(), 'lugares', 'l_precio'), {
        precio: { valor: { monto: 30000, porUnidad: 'hora' }, cargadoEn: serverTimestamp() },
      });
    });
  });

  describe('quién puede mirar el directorio', () => {
    beforeAll(async () => {
      await conAdminSdk(async (adminDb) => {
        await adminDb.doc('lugares/l_privado').set({ nombre: 'x', estado: 'publicado' });
      });
    });

    it('un admin lee y lista', async () => {
      // El control positivo de las dos cláusulas que se niegan abajo.
      expect((await getDoc(doc(db(), 'lugares', 'l_privado'))).exists()).toBe(true);
      expect((await getDocs(collection(db(), 'lugares'))).empty).toBe(false);
    });

    it('⚠️ un anónimo no lee ni lista, ni siquiera uno publicado', async () => {
      /*
       * **Una regla no proyecta** (D-128), y en esta colección eso es lo más caro
       * de todo el proyecto: abrir el `get` a «los publicados» entregaría el
       * documento **entero** — y eso incluye **la dirección y la `geo` de una casa
       * cuyo `direccionPublica` está en `false`**. La decisión entera del § 6 se
       * saltearía con una lectura, sin tocar una línea de la proyección.
       *
       * Y el `list` entregaría el directorio completo de una sentada: todas las
       * direcciones, todos los contactos internos (trampa 13).
       */
      await signOut(auth());
      await rechazadaPorPermisos(getDoc(doc(db(), 'lugares', 'l_privado')), 'get anónimo');
      await rechazadaPorPermisos(getDocs(collection(db(), 'lugares')), 'list anónimo');
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });

    it('un publicador tampoco: ni lee, ni lista, ni escribe', async () => {
      /*
       * B-888 — las cinco cláusulas se quedan en `esAdmin()`, con un argumento más
       * que en los otros dos directorios: decidir si la dirección de una casa se
       * publica es exactamente la clase de autoridad que este rol no tiene.
       */
      await signInWithCustomToken(auth(), await token(UID_PUBLICADOR, { publicador: true }));
      await rechazadaPorPermisos(getDoc(doc(db(), 'lugares', 'l_privado')), 'get publicador');
      await rechazadaPorPermisos(getDocs(collection(db(), 'lugares')), 'list publicador');
      await expect(setDoc(doc(db(), 'lugares', 'l_pub_intento'), documento())).rejects.toThrow(
        RECHAZADA,
      );
      await expect(deleteDoc(doc(db(), 'lugares', 'l_privado'))).rejects.toThrow(RECHAZADA);
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });
  });

  describe('el `create` anónimo TODAVÍA está cerrado — B-872', () => {
    /*
     * Lo que falta **no es código**: es que App Check exija también en Storage
     * (B-872). Los cinco pasos para abrirlo están en `firestore.rules`, y este
     * `describe` es **el testigo que se pone rojo** cuando se borre el `esAdmin()
     * &&` — por eso está escrito con el documento perfecto: cuando la puerta se
     * abra, este caso falla y manda a leer los pasos.
     */
    it('un anónimo no puede crear un lugar, ni con el documento perfecto', async () => {
      await signOut(auth());
      const anonimo = {
        ...formALugar(form(), ahora(), 'formulario-publico'),
        creadoEn: serverTimestamp(),
      };
      await expect(setDoc(doc(db(), 'lugares', 'l_anon'), anonimo)).rejects.toThrow(RECHAZADA);
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });

    it('y alguien logueado sin el claim tampoco', async () => {
      // Crear una cuenta está al alcance de cualquiera con la API key pública, así
      // que «logueado» no es «autorizado».
      await signInWithCustomToken(auth(), await token(UID_PELADO, {}));
      const suyo = {
        ...formALugar(form(), ahora(), 'formulario-publico'),
        creadoEn: serverTimestamp(),
      };
      await expect(setDoc(doc(db(), 'lugares', 'l_pelado'), suyo)).rejects.toThrow(RECHAZADA);
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });
  });
});
