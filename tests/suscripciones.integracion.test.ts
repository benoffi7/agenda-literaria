/**
 * Reglas y escritura de `/suscripciones/{id}` contra el emulador — B-832, PRD 3.
 *
 * ── Por qué este archivo es el que importa de esta tajada ─────────────────
 * `/suscripciones` es la **tercera** colección que va a aceptar una escritura
 * anónima, y `formaDeSuscripcion()` es lo único que va a acotar un documento que
 * escribe alguien sin login. El schema de zod no cuenta: se saltea con un `curl`.
 * Cada tope, cada enum y cada `null` de la regla tiene su caso acá, y se prueban
 * **contra el emulador** porque un `grep` al archivo pasaría con la regla escrita
 * mal (`'Publicado'`, `!=`, el campo renombrado) — el argumento de B-218.
 *
 * ── Y la cláusula que ningún otro directorio tiene: la fecha del precio ───
 * DEC-12. La regla exige que `precio.cargadoEn` sea **la hora del servidor o la
 * que ya estaba**, nunca una elegida. Es la única cláusula de todo
 * `firestore.rules` que defiende una *afirmación* del sitio y no un dato privado,
 * así que sus cinco casos están escritos aparte y con su motivo: sin ella, la
 * frase «$18.000 por mes · cargado el 24 de septiembre» se fabrica desde el
 * cliente y el mecanismo entero de B-837 deja de afirmar nada.
 *
 * Y uno de los cinco es una **puerta abierta a propósito**: refechar un precio
 * que no cambió es «lo revisé hoy y sigue siendo éste», que es la respuesta al
 * aviso de los sesenta días.
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
import { formASuscripcion, suscripcionVacia } from '@/lib/suscripcion-literaria-schema';
import type {
  SuscripcionLiteraria,
  SuscripcionLiterariaForm,
} from '@/types/suscripcion-literaria';
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

const UID = 'uid_suscripciones_admin';
const UID_PELADO = 'uid_suscripciones_sin_claim';
const UID_PUBLICADOR = 'uid_suscripciones_publicador';

const token = async (uid: string, claims: Record<string, boolean>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `s-${uid}-${Date.now()}`);
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
  const app = initAdmin({ projectId: PROJECT_ID }, `s-sdk-${Date.now()}-${Math.random()}`);
  await fn(getAdminFirestore(app));
  await deleteAdminApp(app);
};

const form = (over: Partial<SuscripcionLiterariaForm> = {}): SuscripcionLiterariaForm => ({
  ...suscripcionVacia(),
  nombre: 'La Caja de los Martes',
  descripcion: 'Una caja mensual de poesía argentina contemporánea, con guía de lectura.',
  ofrecidaPor: {
    nombre: 'Eterna Cadencia',
    tipo: 'libreria',
    instagram: '@eternacadencia',
    libreriaSlug: 'eterna-cadencia',
  },
  periodicidad: 'mensual',
  compromisoMinimo: '3 meses',
  incluye: ['libros'],
  incluyeOtro: 'Un marcapáginas',
  envio: { manda: true, cuantos: '2', tematica: 'poesía argentina', editoriales: 'independientes', sorpresa: 'si' },
  extras: ['descuentos-en-local'],
  extrasOtro: '',
  precio: { monto: '18000', porPeriodo: 'mensual' },
  alcance: ['caba'],
  linkDeSuscripcion: 'https://cobro.example/la-caja',
  instagram: '@lacajadelosmartes',
  whatsapp: '+54 9 11 2222-3333',
  mail: 'hola@lacaja.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@lacaja.test' },
  ...over,
});

/** El sentinel, tipado como el `Timestamp` que va a quedar. Igual que en `lib/`. */
const ahora = () => serverTimestamp() as unknown as TimestampLike;

/**
 * El documento tal como lo va a mandar el cliente, para poder deformarlo campo
 * por campo. `origen: 'panel'` porque el `create` de hoy es del admin, y la regla
 * exige que el origen coincida con quién escribe.
 */
const documento = (over: Record<string, unknown> = {}, f: SuscripcionLiterariaForm = form()) => ({
  ...formASuscripcion(f, ahora(), 'panel'),
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

describe.skipIf(!vivo)('suscripciones literarias contra el emulador — B-832', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    // B-174 / B-219 — las reglas de este checkout, sobre la base de este
    // working-tree, que arranca sin ninguna.
    await cargarReglas(REGLAS);
    await signInWithCustomToken(auth(), await token(UID, { admin: true }));
  }, 30_000);

  describe('el camino que hoy funciona: un admin carga una suscripción', () => {
    it('crea una ficha válida y la puede leer', async () => {
      await setDoc(doc(db(), 'suscripciones', 's_ok'), documento());
      const snap = await getDoc(doc(db(), 'suscripciones', 's_ok'));
      expect(snap.exists()).toBe(true);
      const d = snap.data() as SuscripcionLiteraria;
      expect(d.nombre).toBe('La Caja de los Martes');
      // El slug sale derivado del nombre, y es el que va a estar en la URL para
      // siempre (trampa 10).
      expect(d.slug).toBe('la-caja-de-los-martes');
      expect(d.estado).toBe('pendiente');
      expect(d.revision).toEqual({ porUid: null, en: null, motivo: null });
      // Normalizados, que es lo que la ficha va a publicar.
      expect(d.instagram).toBe('lacajadelosmartes');
      expect(d.whatsapp).toBe('5491122223333');
      expect(d.linkDeSuscripcion).toBe('https://cobro.example/la-caja');
      // Y el precio quedó con la hora del servidor, no con la del navegador.
      expect(d.precio?.valor).toEqual({ monto: 18000, porPeriodo: 'mensual' });
      expect((d.precio?.cargadoEn as Timestamp).toMillis()).toBeGreaterThan(0);
    });

    it('acepta los opcionales en null, que es lo que una regla mal escrita rechaza de más', async () => {
      // Una suscripción sin precio, sin redes, sin extras y cargada por un admin
      // (o sea sin nadie a quien repreguntarle) es una ficha válida. El precio en
      // `null` es el «(opcional)» del pedido del dueño.
      await setDoc(
        doc(db(), 'suscripciones', 's_nulls'),
        documento(
          {},
          form({
            compromisoMinimo: '',
            incluye: [],
            incluyeOtro: '',
            envio: { manda: false, cuantos: '', tematica: '', editoriales: '', sorpresa: '' },
            extras: [],
            extrasOtro: '',
            precio: { monto: '', porPeriodo: '' },
            alcance: [],
            linkDeSuscripcion: '',
            instagram: '',
            whatsapp: '',
            mail: '',
            contactoDeQuienCargo: { via: 'mail', valor: '' },
          }),
        ),
      );
      const d = (await getDoc(doc(db(), 'suscripciones', 's_nulls'))).data() as SuscripcionLiteraria;
      expect(d.precio).toBeNull();
      expect(d.linkDeSuscripcion).toBeNull();
      expect(d.contactoDeQuienCargo).toBeNull();
      expect(d.envio).toEqual({
        manda: false,
        cuantos: null,
        tematica: null,
        editoriales: null,
        sorpresa: null,
      });
    });
  });

  describe('la forma del documento: lo que `formaDeSuscripcion()` rechaza', () => {
    const rechaza = async (id: string, over: Record<string, unknown>, f?: SuscripcionLiterariaForm) =>
      expect(setDoc(doc(db(), 'suscripciones', id), documento(over, f))).rejects.toThrow(RECHAZADA);

    it('un campo de más o uno de menos', async () => {
      await rechaza('s_extra', { colado: 'x' });
      const { mail, ...sinMail } = documento();
      void mail;
      await expect(setDoc(doc(db(), 'suscripciones', 's_falta'), sinMail)).rejects.toThrow(RECHAZADA);
    });

    it('un nombre o una descripción fuera de rango', async () => {
      await rechaza('s_nom', {}, form({ nombre: 'x' }));
      await rechaza('s_desc', {}, form({ descripcion: 'corta' }));
      await rechaza('s_desc2', {}, form({ descripcion: 'x'.repeat(2001) }));
    });

    it('un slug que no es un slug — trampa 10', async () => {
      await rechaza('s_slug', { slug: 'Con Mayúsculas' });
      await rechaza('s_slug2', { slug: '' });
    });

    it('un vocabulario que no es un slug, en cualquiera de los seis', async () => {
      await rechaza('s_per', { periodicidad: 'Cada Mes' });
      await rechaza('s_tipo', {
        ofrecidaPor: { ...documento().ofrecidaPor, tipo: 'Una Librería' },
      });
      await rechaza('s_edit', { envio: { ...documento().envio, editoriales: 'Independientes' } });
      await rechaza('s_lib', {
        ofrecidaPor: { ...documento().ofrecidaPor, libreriaSlug: '../otra' },
      });
    });

    it('un link de cobro que no es `https:` — criterio 7', async () => {
      /*
       * **La diferencia deliberada con la `web` de una librería**, que sí acepta
       * `http://`: acá el link lleva a la página de cobro de un tercero (§ 7 del
       * PRD), y mandar a alguien a pagar por un canal sin cifrar es otra cosa que
       * mandarlo a leer. Y el `javascript:` es un XSS en una página indexada.
       */
      await rechaza('s_link_js', { linkDeSuscripcion: 'javascript:alert(1)' });
      await rechaza('s_link_http', { linkDeSuscripcion: 'http://cobro.example/x' });
    });

    it('una lista más larga que su tope: es lo único que la regla puede acotar de una lista', async () => {
      // B-842 — la regla no itera, así que lo que defiende es la cantidad. La
      // forma de cada elemento la impone la proyección.
      await rechaza('s_incluye', { incluye: Array.from({ length: 13 }, (_, i) => `s-${i}`) });
      await rechaza('s_alcance', { alcance: Array.from({ length: 9 }, (_, i) => `s-${i}`) });
    });

    it('un precio con forma rota, un monto absurdo o un período que no es slug', async () => {
      const cargadoEn = serverTimestamp();
      await rechaza('s_p1', { precio: { valor: { monto: 0, porPeriodo: 'mensual' }, cargadoEn } });
      await rechaza('s_p2', { precio: { valor: { monto: 1.5, porPeriodo: 'mensual' }, cargadoEn } });
      await rechaza('s_p3', {
        precio: { valor: { monto: 100000001, porPeriodo: 'mensual' }, cargadoEn },
      });
      await rechaza('s_p4', { precio: { valor: { monto: 100, porPeriodo: 'Mensual' }, cargadoEn } });
      await rechaza('s_p5', { precio: { valor: { monto: 100 }, cargadoEn } });
      await rechaza('s_p6', { precio: { valor: { monto: 100, porPeriodo: 'mensual' } } });
    });

    it('cuántos libros por entrega, fuera de rango', async () => {
      await rechaza('s_c1', { envio: { ...documento().envio, cuantos: 0 } });
      await rechaza('s_c2', { envio: { ...documento().envio, cuantos: 21 } });
      await rechaza('s_c3', { envio: { ...documento().envio, cuantos: 'dos' } });
    });

    it('un contacto interno demasiado corto o con una vía inventada', async () => {
      await rechaza('s_ct1', { contactoDeQuienCargo: { via: 'mail', valor: 'a' } });
      await rechaza('s_ct2', { contactoDeQuienCargo: { via: 'paloma', valor: 'quien@x.test' } });
    });

    it('y el control POSITIVO: el documento perfecto entra', async () => {
      // Sin esto, «la regla rechaza X» podría querer decir que rechaza todo —que
      // es lo que devuelve un emulador sin reglas (B-894).
      await setDoc(doc(db(), 'suscripciones', 's_positivo'), documento());
      expect((await getDoc(doc(db(), 'suscripciones', 's_positivo'))).exists()).toBe(true);
    });
  });

  describe('lo que solo vale al crearse — `suscripcionValida()`', () => {
    const rechaza = async (id: string, over: Record<string, unknown>) =>
      expect(setDoc(doc(db(), 'suscripciones', id), documento(over))).rejects.toThrow(RECHAZADA);

    it('el estado inicial lo fuerza la REGLA, no el cliente', async () => {
      // Sin esto, un `curl` publica su propia suscripción —con su link de cobro— y
      // la bandeja no sirve para nada.
      await rechaza('s_pub', { estado: 'publicado' });
    });

    it('nadie nace revisado ni «ya publicado alguna vez»', async () => {
      await rechaza('s_rev', { revision: { porUid: UID, en: null, motivo: null } });
      // La marca de la trampa 10 no puede nacer puesta: sería nacer con el slug
      // congelado y con el candado del lado de afuera.
      await rechaza('s_marca', { publicadaAlgunaVez: true });
    });

    it('un admin no puede hacer pasar su carga por una ficha que llegó de afuera', async () => {
      await rechaza('s_origen', { origen: 'formulario-publico' });
    });

    it('el cliente no puede antedatar la ficha', async () => {
      await rechaza('s_fecha', { creadoEn: Timestamp.fromDate(new Date('2020-01-01')) });
    });

    /**
     * **DEC-12, primera mitad: el precio nace con la hora del servidor.**
     *
     * Sin esta cláusula, quien crea la ficha elige qué fecha se publica al lado
     * del número, y la frase «cargado el …» deja de significar nada. Es lo mismo
     * que `creadoEn` con `request.time`, aplicado al único dato del proyecto que
     * envejece a la vista.
     *
     * MUTACIÓN PROBADA: sacar la cláusula del `create` deja este caso en rojo.
     */
    it('el precio no puede nacer con una fecha inventada', async () => {
      await rechaza('s_precio_viejo', {
        precio: {
          valor: { monto: 18000, porPeriodo: 'mensual' },
          cargadoEn: Timestamp.fromDate(new Date('2026-01-01')),
        },
      });
      // Y tampoco con una del futuro, que es la otra forma de mentir.
      await rechaza('s_precio_futuro', {
        precio: {
          valor: { monto: 18000, porPeriodo: 'mensual' },
          cargadoEn: Timestamp.fromDate(new Date('2030-01-01')),
        },
      });
    });
  });

  describe('la edición — `suscripcionActualizable()`', () => {
    beforeAll(async () => {
      await setDoc(doc(db(), 'suscripciones', 's_edit'), documento({ slug: 'para-editar' }));
    });

    it('un admin corrige el contenido', async () => {
      await updateDoc(doc(db(), 'suscripciones', 's_edit'), { compromisoMinimo: 'Sin compromiso' });
      const d = (await getDoc(doc(db(), 'suscripciones', 's_edit'))).data() as SuscripcionLiteraria;
      expect(d.compromisoMinimo).toBe('Sin compromiso');
    });

    it('pero no puede reescribir la historia', async () => {
      await expect(
        updateDoc(doc(db(), 'suscripciones', 's_edit'), { origen: 'formulario-publico' }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'suscripciones', 's_edit'), {
          creadoEn: Timestamp.fromDate(new Date('2020-01-01')),
        }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'suscripciones', 's_edit'), { publicadaAlgunaVez: true }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('mover el estado exige firmar con el uid propio y la hora del servidor', async () => {
      await expect(
        updateDoc(doc(db(), 'suscripciones', 's_edit'), {
          estado: 'publicado',
          revision: { porUid: 'otro-uid', en: serverTimestamp(), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
      await expect(
        updateDoc(doc(db(), 'suscripciones', 's_edit'), {
          estado: 'publicado',
          revision: { porUid: UID, en: Timestamp.fromDate(new Date('2020-01-01')), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
      // Y el control positivo: firmada como corresponde, entra.
      await updateDoc(doc(db(), 'suscripciones', 's_edit'), {
        estado: 'publicado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      const d = (await getDoc(doc(db(), 'suscripciones', 's_edit'))).data() as SuscripcionLiteraria;
      expect(d.estado).toBe('publicado');
    });

    it('con la ficha publicada, el slug queda congelado — trampa 10', async () => {
      // Una dirección publicada está en Instagram, en un mail y en el índice de
      // Google: cambiarla es un 404 sin aviso.
      await expect(
        updateDoc(doc(db(), 'suscripciones', 's_edit'), { slug: 'otro-slug' }),
      ).rejects.toThrow(RECHAZADA);
    });

    it('y no se puede publicar de un saque lo que ya se había descartado', async () => {
      await setDoc(doc(db(), 'suscripciones', 's_rechazada'), documento({ slug: 'descartada' }));
      await updateDoc(doc(db(), 'suscripciones', 's_rechazada'), {
        estado: 'rechazado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: 'spam' },
      });
      await expect(
        updateDoc(doc(db(), 'suscripciones', 's_rechazada'), {
          estado: 'publicado',
          revision: { porUid: UID, en: serverTimestamp(), motivo: null },
        }),
      ).rejects.toThrow(RECHAZADA);
      // Reabrir sí: es el paso que obliga a mirarla de nuevo.
      await updateDoc(doc(db(), 'suscripciones', 's_rechazada'), {
        estado: 'pendiente',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
    });

    /**
     * **DEC-12, segunda mitad, y es la que no se puede resolver en el cliente.**
     *
     * Las dos direcciones son la misma decisión:
     *
     * - corregir **otra cosa** no puede mover la fecha del precio (sería publicar
     *   que el número es más fresco de lo que es);
     * - cambiar el **número** obliga a refecharlo con el reloj del servidor.
     *
     * MUTACIÓN PROBADA: sacar la cláusula del `update` deja los dos primeros
     * casos en rojo; dejar solo `cargadoEn == request.time` deja en rojo el
     * tercero, que es el camino normal de toda edición.
     */
    describe('la fecha del precio no se puede mentir — DEC-12', () => {
      const CON_PRECIO = 's_precio';

      beforeAll(async () => {
        await setDoc(doc(db(), 'suscripciones', CON_PRECIO), documento({ slug: 'con-precio' }));
      });

      it('cambiar el monto sin refechar, rechazado', async () => {
        const previo = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        await expect(
          updateDoc(doc(db(), 'suscripciones', CON_PRECIO), {
            precio: { valor: { monto: 25000, porPeriodo: 'mensual' }, cargadoEn: previo.precio!.cargadoEn },
          }),
        ).rejects.toThrow(RECHAZADA);
      });

      it('pero refechar un precio que NO cambió con el reloj del servidor sí se puede, y es a propósito', async () => {
        /*
         * **Es «lo revisé hoy y sigue siendo éste»**, y la puerta está abierta a
         * propósito: es la respuesta al aviso de los sesenta días
         * (`pideRevision`). Sin ella, un precio que sigue vigente solo podría
         * dejar de pedir revisión **cambiándole el número**, o sea mintiendo.
         *
         * Lo que sigue sin poder hacerse es elegir la fecha: es la hora del
         * servidor o nada (los otros tres casos de este bloque). Y el panel no
         * ofrece hoy este gesto —solo refecha cuando el monto cambia—, así que
         * hoy la puerta existe en la regla y no en la pantalla. Está anotado.
         */
        const previo = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        await updateDoc(doc(db(), 'suscripciones', CON_PRECIO), {
          precio: { valor: previo.precio!.valor, cargadoEn: serverTimestamp() },
        });
        const d = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        expect(d.precio!.valor).toEqual(previo.precio!.valor);
        expect((d.precio!.cargadoEn as Timestamp).toMillis()).toBeGreaterThanOrEqual(
          (previo.precio!.cargadoEn as Timestamp).toMillis(),
        );
      });

      it('y una fecha ELEGIDA —ni la del servidor ni la que estaba— se rechaza', async () => {
        /*
         * El caso que la cláusula existe para frenar: un `cargadoEn` de hoy
         * escrito a mano sobre un precio de hace cuatro meses. Es la frase entera
         * fabricada desde el cliente.
         *
         * MUTACIÓN PROBADA: sacar la cláusula del `update` deja este caso en rojo.
         */
        const previo = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        /*
         * La fecha elegida es **fija y distinta de las dos legítimas**, y eso no
         * es cosmético: la primera versión de este caso usaba
         * `Timestamp.fromDate(new Date())` y era **flaky**. Contra el emulador en
         * la misma máquina, el reloj del cliente y el `request.time` del servidor
         * caen a veces en el mismo milisegundo, así que el `==` de la regla daba
         * verdadero y la escritura entraba por la puerta legítima. Un caso que
         * pasa o falla según el milisegundo no verifica nada.
         */
        await expect(
          updateDoc(doc(db(), 'suscripciones', CON_PRECIO), {
            precio: {
              valor: previo.precio!.valor,
              cargadoEn: Timestamp.fromDate(new Date('2026-09-10T10:00:00Z')),
            },
          }),
        ).rejects.toThrow(RECHAZADA);
      });

      it('corregir otra cosa conservando la fecha del precio, aceptado', async () => {
        // **Es el camino normal de toda edición**, y por eso este control positivo
        // vale doble: una regla que solo aceptara `request.time` obligaría a
        // refechar el precio en cada corrección de un typo.
        const previo = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        await updateDoc(doc(db(), 'suscripciones', CON_PRECIO), {
          compromisoMinimo: 'Sin compromiso',
          precio: { valor: previo.precio!.valor, cargadoEn: previo.precio!.cargadoEn },
        });
        const d = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        expect((d.precio!.cargadoEn as Timestamp).toMillis()).toBe(
          (previo.precio!.cargadoEn as Timestamp).toMillis(),
        );
      });

      it('cambiar el monto refechando con el reloj del servidor, aceptado', async () => {
        const previo = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        await updateDoc(doc(db(), 'suscripciones', CON_PRECIO), {
          precio: { valor: { monto: 25000, porPeriodo: 'mensual' }, cargadoEn: serverTimestamp() },
        });
        const d = (await getDoc(doc(db(), 'suscripciones', CON_PRECIO)))
          .data() as SuscripcionLiteraria;
        expect(d.precio!.valor.monto).toBe(25000);
        expect((d.precio!.cargadoEn as Timestamp).toMillis()).toBeGreaterThan(
          (previo.precio!.cargadoEn as Timestamp).toMillis(),
        );
      });
    });
  });

  describe('quién puede mirar el directorio', () => {
    beforeAll(async () => {
      await conAdminSdk(async (adminDb) => {
        await adminDb.doc('suscripciones/s_privada').set({ nombre: 'x', estado: 'publicado' });
      });
    });

    it('un admin lee y lista', async () => {
      // El control positivo de las dos cláusulas que se niegan abajo.
      expect((await getDoc(doc(db(), 'suscripciones', 's_privada'))).exists()).toBe(true);
      expect((await getDocs(collection(db(), 'suscripciones'))).empty).toBe(false);
    });

    it('un anónimo no lee ni lista, ni siquiera una publicada', async () => {
      /*
       * **Una regla no proyecta** (D-128). Abrir el `get` a «las publicadas»
       * entregaría el documento **entero** —el contacto interno, el motivo del
       * rechazo, el `storagePath` de cada imagen y el precio crudo con su fecha—
       * en vez de la vista que la proyección decide. Y el `list` entregaría el
       * directorio completo de una sentada (trampa 13).
       */
      await signOut(auth());
      await rechazadaPorPermisos(getDoc(doc(db(), 'suscripciones', 's_privada')), 'get anónimo');
      await rechazadaPorPermisos(getDocs(collection(db(), 'suscripciones')), 'list anónimo');
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });

    it('un publicador tampoco: ni lee, ni lista, ni escribe', async () => {
      /*
       * B-888 — las cinco cláusulas se quedan en `esAdmin()`: una ficha de
       * directorio no tiene «dueño» que recortar, decidir qué entra al catálogo es
       * una autoridad que este rol no tiene, y el documento lleva el contacto de un
       * tercero.
       */
      await signInWithCustomToken(auth(), await token(UID_PUBLICADOR, { publicador: true }));
      await rechazadaPorPermisos(getDoc(doc(db(), 'suscripciones', 's_privada')), 'get publicador');
      await rechazadaPorPermisos(getDocs(collection(db(), 'suscripciones')), 'list publicador');
      await expect(
        setDoc(doc(db(), 'suscripciones', 's_pub_intento'), documento()),
      ).rejects.toThrow(RECHAZADA);
      await expect(deleteDoc(doc(db(), 'suscripciones', 's_privada'))).rejects.toThrow(RECHAZADA);
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });
  });

  describe('el `create` anónimo TODAVÍA está cerrado — B-872', () => {
    /*
     * Lo que falta **no es código**: es que App Check exija también en Storage
     * (B-872). Los cuatro pasos para abrirlo están en `firestore.rules`, y este
     * `describe` es **el testigo que se pone rojo** cuando se borre el `esAdmin()
     * &&` — por eso está escrito con el documento perfecto: cuando la puerta se
     * abra, este caso falla y manda a leer los pasos.
     */
    it('un anónimo no puede crear una suscripción, ni con el documento perfecto', async () => {
      await signOut(auth());
      const anonimo = { ...formASuscripcion(form(), ahora(), 'formulario-publico'), creadoEn: serverTimestamp() };
      await expect(setDoc(doc(db(), 'suscripciones', 's_anon'), anonimo)).rejects.toThrow(RECHAZADA);
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });

    it('y alguien logueado sin el claim tampoco', async () => {
      // Crear una cuenta está al alcance de cualquiera con la API key pública, así
      // que «logueado» no es «autorizado».
      await signInWithCustomToken(auth(), await token(UID_PELADO, {}));
      const suyo = { ...formASuscripcion(form(), ahora(), 'formulario-publico'), creadoEn: serverTimestamp() };
      await expect(setDoc(doc(db(), 'suscripciones', 's_pelado'), suyo)).rejects.toThrow(RECHAZADA);
      await signInWithCustomToken(auth(), await token(UID, { admin: true }));
    });
  });
});
