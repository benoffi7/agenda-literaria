/**
 * **La frontera del rol `publicador`, probada contra el emulador** — B-888.
 *
 * ── Por qué este archivo y no la UI ───────────────────────────────────────
 * El pedido del dueño se puede leer como «que el panel le esconda las
 * opciones», y esa lectura es la que no sirve: **que un botón no esté no impide
 * nada** a quien abra la consola de Firebase con su propia sesión, que es
 * exactamente el modo de falla que D-128 cerró (una puerta que ninguna
 * proyección atraviesa). La autorización real son las reglas, así que la tajada
 * que vale es ésta, y es la que se prueba acá.
 *
 * ── Las dos mitades, y las dos hacen falta ────────────────────────────────
 * 1. **El control positivo**: que el publicador SÍ pueda hacer lo suyo, y que
 *    el admin siga pudiendo todo. Sin esto, una regla que diga `if false` pasa
 *    todos los casos de negación de abajo — y también los pasa un emulador
 *    caído, una base sin reglas o un `projectId` equivocado.
 * 2. **La negación por cláusula**: cada cláusula nueva de `firestore.rules`
 *    tiene un caso que se pone rojo al borrarla. Una cláusula que no puede
 *    fallar en una regla de seguridad es peor que ninguna: se lee como
 *    load-bearing y el que venga la va a cuidar en vez de mirar la que sí
 *    frena. Cada `it` dice, en un comentario, qué mutación lo pone en rojo.
 *
 * ── Lo que NO prueba ──────────────────────────────────────────────────────
 * La forma del documento de actividad: eso ya es de
 * `actividades.integracion.test.ts`. Acá los documentos son mínimos a propósito
 * —`createdBy`, `updatedBy` y poco más—, porque lo que se está midiendo es
 * **quién** puede tocarlos, no qué campos tienen.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { PROJECT_ID, cargarReglas, emuladorAuthVivo, emuladorVivo, limpiarFirestore } from './emulador';

// B-365 — los dos: este archivo hace login, así que Firestore arriba y Auth
// abajo (una tanda a medias) no puede leerse como «está todo».
const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());

// B-174 / B-219 — las reglas de ESTE checkout, sobre la base de este working-tree.
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID_ADMIN = 'uid_b888_admin';
const UID_PUB = 'uid_b888_publicador';
const UID_AMBOS = 'uid_b888_los_dos_claims';
const UID_PELADO = 'uid_b888_sin_claim';

/*
 * Los mails son de `ejemplo.test`, un TLD reservado, y no de un proveedor
 * gratuito: `tests/sin-datos-personales.test.ts` barre el árbol versionado
 * buscando casillas en los dieciséis proveedores personales, y un
 * `@gmail.com` de mentira acá lo pondría rojo sin que nadie entienda por qué.
 */
const MAIL_ADMIN = 'admin.b888@ejemplo.test';
const MAIL_PUB = 'publicador.b888@ejemplo.test';
const MAIL_PUB_2 = 'otro.publicador.b888@ejemplo.test';

/** Una sola app del Admin SDK para sembrar, creada en el `beforeAll`. */
let appSiembra: ReturnType<typeof initAdmin> | null = null;

/**
 * Un usuario del emulador con su mail y sus claims, y el custom token para
 * entrar con él.
 *
 * El mail va en el **registro de la cuenta** y no en los developer claims, y
 * eso es lo que hace que el token se parezca al de producción: se verificó
 * contra el emulador que un claim llamado `email` en el custom token **no pisa**
 * el del registro. O sea que `request.auth.token.email` es siempre el de la
 * cuenta — que es la propiedad sobre la que descansa `/usuarios`.
 */
const tokenDe = async (
  uid: string,
  claims: Record<string, unknown>,
  email?: string,
  emailVerificado = true,
): Promise<string> => {
  const app = initAdmin({ projectId: PROJECT_ID }, `b888-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  // Alta o actualización según exista: el emulador de Auth no se limpia entre
  // archivos, así que la cuenta puede venir de una corrida anterior.
  const existe = await a.getUser(uid).then(() => true).catch(() => false);
  const datos = email ? { email, emailVerified: emailVerificado } : {};
  if (existe) await a.updateUser(uid, datos);
  else await a.createUser({ uid, ...datos });
  await a.setCustomUserClaims(uid, claims);
  const t = await a.createCustomToken(uid);
  await deleteAdminApp(app);
  return t;
};

const entrarComo = async (
  uid: string,
  claims: Record<string, unknown>,
  email?: string,
  emailVerificado = true,
): Promise<void> => {
  await signInWithCustomToken(auth(), await tokenDe(uid, claims, email, emailVerificado));
};

/**
 * `code === 'permission-denied'` y no el mensaje — el mismo helper que
 * `actividades.integracion.test.ts` y `escritura-anonima.integracion.test.ts`.
 *
 * Un `rejects.toThrow()` pelado lo satisface también un emulador caído; y un
 * matcher por texto falla contra la traza de evaluación (`false for 'get' @
 * L58`), que es lo que el emulador devuelve en las lecturas denegadas. El
 * `code` distingue lo único que importa: `permission-denied` es «la regla
 * denegó» y `unavailable` es «no se pudo preguntar».
 */
const rechazada = async (operacion: Promise<unknown>, que: string): Promise<void> => {
  let error: unknown;
  try {
    await operacion;
  } catch (e) {
    error = e;
  }
  expect(error, `${que}: NO se rechazó`).toBeDefined();
  expect((error as { code?: string }).code, `${que}: se rechazó, pero no por permisos`).toBe(
    'permission-denied',
  );
};

/** Siembra con el Admin SDK, que **no pasa por las reglas**: prepara el escenario sin usarlas. */
const sembrar = async (id: string, datos: Record<string, unknown>): Promise<void> => {
  await getAdminFirestore(appSiembra!).doc(`actividades/${id}`).set(datos);
};

/** Lo mismo, en cualquier ruta: `reportes/x`, `propuestas/x`. */
const sembrarEn = async (ruta: string, datos: Record<string, unknown>): Promise<void> => {
  await getAdminFirestore(appSiembra!).doc(ruta).set(datos);
};

const actividadDe = (uid: string, extra: Record<string, unknown> = {}) => ({
  titulo: 'Taller de crónica',
  slug: `taller-${uid}`,
  estado: 'publicado',
  createdBy: uid,
  updatedBy: uid,
  ...extra,
});

/**
 * Un reporte con **las trece claves** que `reporteValido()` exige, en su estado
 * inicial. No es andamiaje: es lo que hace que el `allow create` de `/reportes`
 * tenga un testigo de verdad (ver el caso que lo usa).
 */
const reporteDeAlta = (uid: string) => ({
  tipo: 'bug',
  titulo: 'Algo no anda en el listado',
  descripcion: 'Al filtrar por tipo se queda cargando y no vuelve nunca.',
  pasos: null,
  severidad: 'molesta',
  actividad: null,
  contexto: {
    versionPanel: '0.0.0',
    navegador: 'test',
    ventana: '800x600',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    url: '/admin',
    pantalla: 'listado',
  },
  reportadoPor: { uid, email: MAIL_PUB },
  estado: 'pendiente',
  intentos: 0,
  github: null,
  error: null,
  creadoEn: serverTimestamp(),
});

/**
 * Una propuesta con **las dieciséis claves** que `propuestaValida()` exige, con
 * `origen: 'formulario-publico'` — la rama que un publicador satisface, porque
 * `!esAdmin()` le da verde. O sea que lo único que puede rechazar esta escritura
 * es el `esAdmin()` del `allow create`, que es exactamente lo que el caso mide.
 *
 * **Lo pidió el `auditor-privacidad`, y es la misma lección que la de
 * `/reportes` dos fixtures más arriba**: con un `{ hola: 'mundo' }` de sonda,
 * `propuestaValida()` rechaza por `hasOnly` con la puerta abierta o cerrada, y el
 * aserto no podía fallar. Ese hueco no lo agarró la primera tanda de mutaciones
 * porque la mutación de ESA cláusula —`allow create` de `/propuestas`— no estaba
 * en la lista: el barrido fue exhaustivo sobre las mutaciones que alguien
 * escribió, no sobre las cláusulas del archivo.
 */
const propuestaDeAlta = () => ({
  titulo: 'Un ciclo nuevo de lectura',
  descripcion: 'Ocho encuentros sobre narrativa breve argentina, los jueves.',
  fechas: ['2026-10-01T19:00'],
  modalidad: 'presencial',
  lugar: { nombre: 'Casa de la cultura', direccion: 'Av. Siempreviva 742', barrio: 'Almagro' },
  organizador: { nombre: 'Colectivo de lectura', instagram: null },
  arancel: { tipo: 'a-la-gorra', notas: null },
  inscripcion: { requiere: true, comoDice: 'Por mail' },
  incluye: [],
  incluyeOtro: null,
  imagen: null,
  contacto: { via: 'mail', valor: 'propone@ejemplo.test' },
  estado: 'nueva',
  creadoEn: serverTimestamp(),
  origen: 'formulario-publico',
  revision: { porUid: null, en: null, actividadId: null, motivo: null },
});

const MIA = 'act_b888_mia';
const AJENA = 'act_b888_ajena';
const VIEJA = 'act_b888_sin_createdby';

describe.skipIf(!vivo)('la frontera del rol publicador — B-888', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    appSiembra = initAdmin({ projectId: PROJECT_ID }, `b888-siembra-${Date.now()}`);
  }, 30_000);

  beforeEach(async () => {
    await sembrar(MIA, actividadDe(UID_PUB));
    await sembrar(AJENA, actividadDe(UID_ADMIN));
    // Un documento anterior a `createdBy` (existen: `autoriaDe` los trata como
    // autoría `desconocida`). No es de nadie, así que no es de ningún publicador.
    await sembrar(VIEJA, { titulo: 'De antes', slug: 'de-antes', estado: 'publicado' });
    /*
     * Documentos existentes en las dos bandejas: sin ellos, un `update` denegado
     * no distingue «la regla frenó» de «el documento no está». `creadoEn` va con
     * una fecha común porque el `serverTimestamp()` del SDK de cliente no lo
     * serializa el Admin SDK, y acá el valor da igual.
     */
    await sembrarEn('reportes/r_b888', {
      ...reporteDeAlta(UID_ADMIN),
      estado: 'error',
      creadoEn: new Date('2026-09-01T12:00:00Z'),
    });
    await sembrarEn('propuestas/p_b888', {
      titulo: 'Un ciclo nuevo',
      estado: 'nueva',
      revision: { porUid: null, en: null, actividadId: null, motivo: null },
    });
  });

  afterAll(async () => {
    await signOut(auth());
    if (appSiembra) await deleteAdminApp(appSiembra);

    /*
     * **Y se limpia al SALIR, no solo al entrar** — y esto lo cobró el gate, no un
     * test. Todos los archivos de integración de este repo limpian en el
     * `beforeAll` y dejan sus documentos puestos al terminar; funcionaba porque los
     * que siembran `/actividades` siembran **documentos completos**. Los de acá son
     * mínimos a propósito (lo que se mide es quién puede tocarlos, no qué campos
     * tienen), así que dejarlos puestos le da de comer al **paso 4 de
     * `scripts/verificar-todo.sh`** —que buildea contra el MISMO emulador, después
     * de los tests— una actividad sin `tipo`, y `toPublic` muere con
     * `Cannot read properties of undefined`. Se reprodujo: el gate quedó en
     * «el build no pasa» por culpa de este archivo.
     *
     * O sea: el emulador es estado compartido **entre pasos del gate**, no solo
     * entre archivos de la suite (que es lo que dice B-219). Limpiar al salir es
     * barato y saca el acoplamiento.
     */
    await limpiarFirestore();
  });

  // ══════════════════════════════════════════════════════════════════════
  //  1. CONTROLES POSITIVOS — sin esto, todo lo de abajo pasa con `if false`
  // ══════════════════════════════════════════════════════════════════════
  describe('el control positivo: el rol tiene que SERVIR, no solo negar', () => {
    it('el admin sigue leyendo y escribiendo todo, como antes del rol nuevo', async () => {
      await entrarComo(UID_ADMIN, { admin: true }, MAIL_ADMIN);
      expect((await getDoc(doc(db(), 'actividades', MIA))).exists()).toBe(true);
      expect((await getDoc(doc(db(), 'actividades', AJENA))).exists()).toBe(true);
      // El listado entero, sin `where`: es lo que hace hoy `listarActividades()`.
      expect((await getDocs(collection(db(), 'actividades'))).size).toBeGreaterThanOrEqual(3);
      await updateDoc(doc(db(), 'actividades', MIA), { titulo: 'Editado por el admin' });
      await setDoc(doc(db(), 'opciones', 'campo-de-prueba-b888'), { valores: [] });
    });

    it('el publicador lee y edita LO SUYO, y puede publicar y despublicar', async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      expect((await getDoc(doc(db(), 'actividades', MIA))).exists()).toBe(true);

      // El pedido del dueño: **puede gestionar el estado de lo suyo**, sin que
      // nadie revise. Las tres transiciones, que son las tres que pidió.
      for (const estado of ['borrador', 'publicado', 'cancelado']) {
        await updateDoc(doc(db(), 'actividades', MIA), { estado, updatedBy: UID_PUB });
      }
      // Y crear algo nuevo, que nace suyo.
      await setDoc(doc(db(), 'actividades', 'act_b888_nueva'), actividadDe(UID_PUB));
      await deleteDoc(doc(db(), 'actividades', 'act_b888_nueva'));
    });

    it('el publicador lista LO SUYO con el `where` que la regla obliga', async () => {
      /*
       * Trampa 7 puesta al servicio del rol: `allow read` incluye el `list`, y la
       * condición sobre `resource.data` **obliga** a que la query traiga el
       * `where('createdBy','==',uid)`. Con él pasa; sin él, el caso de más abajo
       * muestra que Firestore rechaza la query **entera** (no filtra).
       *
       * Es la query que la tajada 2 tiene que usar en el listado del panel.
       */
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      const propias = await getDocs(
        query(collection(db(), 'actividades'), where('createdBy', '==', UID_PUB)),
      );
      expect(propias.size).toBe(1);
      expect(propias.docs[0]!.id).toBe(MIA);
    });

    it('el publicador registra su mail en /usuarios y lo vuelve a leer', async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      const { registrarUsuario } = await import('@/lib/usuarios');
      expect(await registrarUsuario(UID_PUB, MAIL_PUB)).toBe(true);
      const leido = await getDoc(doc(db(), 'usuarios', UID_PUB));
      expect(leido.data()?.email).toBe(MAIL_PUB);
    });

    it('el admin lee el directorio entero, que es lo que le pinta el filtro', async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      const { registrarUsuario } = await import('@/lib/usuarios');
      await registrarUsuario(UID_PUB, MAIL_PUB);
      await entrarComo(UID_ADMIN, { admin: true }, MAIL_ADMIN);
      await registrarUsuario(UID_ADMIN, MAIL_ADMIN);

      const { listarUsuarios, mailesPorUid } = await import('@/lib/usuarios');
      const mapa = mailesPorUid(await listarUsuarios());
      expect(mapa.get(UID_PUB)).toBe(MAIL_PUB);
      expect(mapa.get(UID_ADMIN)).toBe(MAIL_ADMIN);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  2. ROBAR, REGALAR Y FIRMAR A NOMBRE DE OTRO
  // ══════════════════════════════════════════════════════════════════════
  describe('un publicador no se apropia de lo ajeno ni se saca lo propio de encima', () => {
    beforeEach(async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
    });

    it('no edita una actividad ajena', async () => {
      // Mutación: borrar `resource.data.get('createdBy','') == request.auth.uid`
      // del `allow update`. Este caso se pone rojo.
      await rechazada(
        updateDoc(doc(db(), 'actividades', AJENA), { titulo: 'Mío ahora', updatedBy: UID_PUB }),
        'editar una actividad ajena',
      );
    });

    it('no se roba una ajena escribiéndole su propio `createdBy`', async () => {
      /*
       * **La pregunta del modelo de amenaza, y la respuesta es la asimetría de la
       * regla:** el dueño se mira en `resource.data` —el documento **previo**—, así
       * que la regla ya falló antes de mirar lo que se quiere escribir. Escribirle
       * el `createdBy` propio no ayuda, porque no es lo que se está evaluando.
       *
       * Mutación: cambiar el `resource.data` de esa cláusula por
       * `request.resource.data`. Este caso se pone rojo (y el anterior sigue verde,
       * que es lo que lo hace un caso aparte y no el mismo dos veces).
       */
      await rechazada(
        updateDoc(doc(db(), 'actividades', AJENA), {
          createdBy: UID_PUB,
          updatedBy: UID_PUB,
        }),
        'robarse una actividad ajena cambiando createdBy',
      );
    });

    it('no regala la suya cambiándole el `createdBy` a otro', async () => {
      // Mutación: borrar la cláusula
      // `request.resource.data.get('createdBy','') == resource.data.get('createdBy','')`.
      // Este caso se pone rojo.
      await rechazada(
        updateDoc(doc(db(), 'actividades', MIA), {
          createdBy: UID_ADMIN,
          updatedBy: UID_PUB,
        }),
        'regalar la propia actividad a otra cuenta',
      );
    });

    it('no crea una actividad a nombre de otro, ni firmada por otro', async () => {
      /*
       * **Las dos firmas se prueban por separado, y la mutación es lo que lo
       * obligó.** El primer borrador mandaba un documento con `createdBy` Y
       * `updatedBy` ajenos: cualquiera de las dos cláusulas lo frenaba, así que
       * borrar una dejaba el caso verde igual. Un aserto que dos cláusulas pueden
       * satisfacer no es testigo de ninguna.
       *
       * **Y el id tiene que ser distinto en cada mitad**, que es la segunda cosa
       * que enseñó la mutación: si la primera escritura llega a pasar, el
       * documento queda creado y la segunda ya no es un `create` sino un
       * `update` — otra regla, y el aserto pasaría por el motivo equivocado.
       *
       * Mutación: borrar `request.resource.data.get('createdBy','') ==
       * request.auth.uid` del `allow create` → se pone rojo el primero. Borrar
       * `…get('updatedBy','') == request.auth.uid` → el segundo.
       */
      await rechazada(
        setDoc(
          doc(db(), 'actividades', 'act_b888_impostora_a'),
          actividadDe(UID_ADMIN, { updatedBy: UID_PUB }),
        ),
        'crear una actividad con el createdBy de otro',
      );
      await rechazada(
        setDoc(
          doc(db(), 'actividades', 'act_b888_impostora_b'),
          actividadDe(UID_PUB, { updatedBy: UID_ADMIN }),
        ),
        'crear una actividad firmada por otro',
      );
    });

    it('no firma una edición con el `updatedBy` de otro', async () => {
      /*
       * Desde B-888 la marca de autoría muestra **el mail de quien lo cambió**, así
       * que `updatedBy` dejó de ser un campo interno y pasó a ser una afirmación
       * que se lee en pantalla. Sin esta cláusula, un publicador podría dejar su
       * edición firmada por un admin.
       *
       * Mutación: borrar `request.resource.data.get('updatedBy','') ==
       * request.auth.uid` del `allow update`. Este caso se pone rojo.
       */
      await rechazada(
        updateDoc(doc(db(), 'actividades', MIA), { titulo: 'Ojo', updatedBy: UID_ADMIN }),
        'firmar una edición propia con el updatedBy de otro',
      );
    });

    it('no borra una ajena, y sí la suya', async () => {
      // Mutación: borrar la condición de dueño del `allow delete`. La primera
      // mitad de este caso se pone roja.
      await rechazada(deleteDoc(doc(db(), 'actividades', AJENA)), 'borrar una actividad ajena');
      await deleteDoc(doc(db(), 'actividades', MIA));
    });

    it('no toca una actividad anterior a `createdBy`: no es de nadie', async () => {
      /*
       * El default del `.get()` es lo que lo decide, y por eso el default es `''` y
       * no algo que pueda coincidir con un uid. Un documento sin dueño declarado no
       * pasa a ser del primero que pregunte.
       *
       * Mutación: cambiar el default de `resource.data.get('createdBy', '')` por
       * `request.auth.uid`. Este caso se pone rojo (las tres operaciones).
       */
      await rechazada(getDoc(doc(db(), 'actividades', VIEJA)), 'leer una actividad sin createdBy');
      await rechazada(
        updateDoc(doc(db(), 'actividades', VIEJA), { titulo: 'x', updatedBy: UID_PUB }),
        'editar una actividad sin createdBy',
      );
      await rechazada(deleteDoc(doc(db(), 'actividades', VIEJA)), 'borrar una actividad sin createdBy');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  3. LEER LO QUE NO ES SUYO — la trampa 7 del lado del rol
  // ══════════════════════════════════════════════════════════════════════
  describe('un publicador no lee lo que no es suyo', () => {
    beforeEach(async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
    });

    it('no lee una actividad ajena, documento por documento', async () => {
      // Mutación: volver el `allow read` a `esAdmin() || esPublicador()`. Este
      // caso se pone rojo.
      await rechazada(getDoc(doc(db(), 'actividades', AJENA)), 'leer una actividad ajena');
    });

    it('la query SIN `where` se rechaza entera — no devuelve las suyas (trampa 7)', async () => {
      /*
       * **Esto no es un defecto: es el mecanismo.** Una regla es todo-o-nada por
       * documento y no filtra, así que Firestore rechaza la query completa en vez
       * de recortarla. Es lo que obliga al panel a pedir explícitamente lo propio
       * —y lo que hace que un olvido en la tajada 2 se vea como un error y no como
       * un listado que calladamente muestra de más.
       *
       * Es también por qué `slugDisponible()` (`src/lib/actividades.ts`), que barre
       * la colección sin `where`, no funciona con este rol. Está anotado en B-888.
       */
      await rechazada(getDocs(collection(db(), 'actividades')), 'listar todas las actividades');
    });

    it('tampoco pidiendo explícitamente las de otro', async () => {
      // Mutación: la misma que el caso anterior de lectura. Va aparte porque el
      // camino es otro: acá la query es válida y lo que falla es el dueño.
      await rechazada(
        getDocs(query(collection(db(), 'actividades'), where('createdBy', '==', UID_ADMIN))),
        'listar las actividades de otra cuenta',
      );
    });

    it('no lee el historial (§12) — ni el de una actividad suya', async () => {
      /*
       * La regla del padre no cascadea a la subcolección, así que esto es una
       * decisión propia y no una herencia: el historial es una de las pantallas que
       * el panel del publicador no tiene, y la regla dice lo mismo que la UI en vez
       * de contradecirla. El caso cubre la suya **y** la ajena porque si alguna vez
       * se abre, la que se abre es la suya.
       *
       * Mutación: poner `esDelPanel()` en el `allow read` de `versiones`. La
       * primera mitad de este caso se pone roja.
       */
      await rechazada(
        getDoc(doc(db(), 'actividades', MIA, 'versiones', 'v1')),
        'leer el historial de una actividad propia',
      );
      await rechazada(
        getDoc(doc(db(), 'actividades', AJENA, 'versiones', 'v1')),
        'leer el historial de una actividad ajena',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  4. EL RESTO DEL PANEL — lo compartido y lo de terceros
  // ══════════════════════════════════════════════════════════════════════
  describe('un publicador no toca lo compartido ni lo de terceros', () => {
    beforeEach(async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
    });

    it('lee /opciones como cualquiera, pero no la escribe', async () => {
      /*
       * La lectura es pública desde siempre (§4.4, `allow read: if true`) y sigue
       * siéndolo: el formulario la necesita para pintar los desplegables.
       *
       * La escritura no, y el motivo está en el bloque de la regla: las reglas no
       * pueden inspeccionar qué elemento del array `valores` cambió, así que
       * «puede agregar una opción» y «puede reescribir la taxonomía del sitio
       * entero» son, a nivel de regla, el mismo permiso.
       *
       * Mutación: cambiar ese `allow write` por `esDelPanel()`. La segunda mitad de
       * este caso se pone roja.
       */
      await getDoc(doc(db(), 'opciones', 'arancel'));
      await rechazada(
        setDoc(doc(db(), 'opciones', 'arancel'), { valores: [] }),
        'reescribir la taxonomía compartida',
      );
    });

    it('no entra a la bandeja de reportes, que lleva el mail de otra cuenta', async () => {
      /*
       * **Los documentos son VÁLIDOS a propósito, y eso lo enseñó la mutación.**
       * Con un `{ hola: 'mundo' }` de sonda, `reporteValido()`/`resueltoValido()`
       * rechazan la escritura con el `esAdmin()` puesto o sacado, así que abrir
       * `/reportes` al publicador **no ponía nada en rojo**: el aserto se leía como
       * load-bearing y no podía fallar. Es la misma clase que el documento sonda de
       * `escritura-anonima.integracion.test.ts`, dicha en su propio docblock.
       *
       * Mutación: `esDelPanel()` en cualquiera de las tres cláusulas de
       * `/reportes`. La mitad correspondiente se pone roja.
       */
      await rechazada(getDoc(doc(db(), 'reportes', 'r_b888')), 'leer un reporte');
      await rechazada(
        setDoc(doc(db(), 'reportes', 'r_b888_nuevo'), reporteDeAlta(UID_PUB)),
        'crear un reporte (con el documento que la regla acepta)',
      );
      await rechazada(
        updateDoc(doc(db(), 'reportes', 'r_b888'), {
          resuelto: true,
          actualizadoEn: serverTimestamp(),
        }),
        'resolver un reporte (con el cambio que la regla acepta)',
      );
    });

    it('no entra a la bandeja de propuestas, que lleva el contacto de un tercero', async () => {
      // Mutación: `esDelPanel()` en el `allow read`/`create`/`update` de
      // `/propuestas`. La mitad correspondiente se pone roja.
      await rechazada(getDoc(doc(db(), 'propuestas', 'p_b888')), 'leer una propuesta');
      await rechazada(
        setDoc(doc(db(), 'propuestas', 'p_b888_nueva'), propuestaDeAlta()),
        'crear una propuesta (con el documento que la regla acepta)',
      );
      // Igual que con `/reportes`: el update tiene la forma que `revisionValida()`
      // acepta, o sea que lo único que puede rechazarlo es el `esAdmin()`.
      await rechazada(
        updateDoc(doc(db(), 'propuestas', 'p_b888'), {
          estado: 'aceptada',
          revision: { porUid: UID_PUB, en: serverTimestamp(), actividadId: null, motivo: null },
        }),
        'revisar una propuesta (con el cambio que la regla acepta)',
      );
    });

    it('no lee /sistema, que trae las consultas de Google y el flag de rebuild', async () => {
      // Mutación: `esDelPanel()` en el `allow read` de `/sistema`. Este caso se
      // pone rojo.
      await rechazada(getDoc(doc(db(), 'sistema', 'analitica-sitio')), 'leer el tablero');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  5. EL ORDEN DE LAS GUARDAS
  // ══════════════════════════════════════════════════════════════════════
  describe('el orden de las guardas: un token con los dos claims cae del lado acotado', () => {
    /*
     * **Por qué esto es un caso de test y no un detalle.** Cada regla se lee
     * `esAdmin() || (esPublicador() && …)`, y `||` cortocircuita: si `esAdmin()`
     * diera true para una cuenta que además tiene el claim `publicador`, la rama
     * acotada **no se evaluaría nunca** y el rol nuevo sería decorativo. Ese
     * estado no se puede crear con `scripts/set-admin-claim.mjs` —`setCustomUserClaims`
     * reemplaza el objeto entero—, pero sí tocando la consola a mano, y la
     * dirección en la que conviene fallar es la restrictiva: perder acceso es
     * ruidoso y se arregla en un comando; ganarlo en silencio, no.
     */
    beforeEach(async () => {
      await entrarComo(UID_AMBOS, { admin: true, publicador: true }, MAIL_PUB_2);
    });

    it('no lee una actividad ajena, aunque tenga el claim admin', async () => {
      // Mutación: sacarle el `&& !esPublicador()` a `esAdmin()`. Este caso se pone
      // rojo — y es el único lugar del archivo donde esa cláusula se puede cobrar.
      await rechazada(
        getDoc(doc(db(), 'actividades', AJENA)),
        'leer lo ajeno con los dos claims puestos',
      );
    });

    it('tampoco escribe la taxonomía compartida ni lee la bandeja', async () => {
      await rechazada(setDoc(doc(db(), 'opciones', 'arancel'), { valores: [] }), 'taxonomía');
      await rechazada(getDoc(doc(db(), 'reportes', 'r_b888')), 'bandeja de reportes');
    });

    it('y sigue pudiendo lo suyo: el rol acotado se ejerce de verdad', async () => {
      // El control positivo del caso de arriba: «cae del lado acotado» tiene que
      // significar que el lado acotado FUNCIONA, no que quedó sin ninguno.
      await setDoc(doc(db(), 'actividades', 'act_b888_ambos'), actividadDe(UID_AMBOS));
      expect((await getDoc(doc(db(), 'actividades', 'act_b888_ambos'))).exists()).toBe(true);
      await deleteDoc(doc(db(), 'actividades', 'act_b888_ambos'));
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  6. SIN CLAIM NO HAY ROL
  // ══════════════════════════════════════════════════════════════════════
  describe('una cuenta sin claim no gana nada por existir', () => {
    it('logueada sin claim: no lee ni escribe actividades, ni se registra en /usuarios', async () => {
      /*
       * Crear una cuenta está al alcance de cualquiera con la API key web —pública
       * por diseño y versionada en `.env.production` de un repo público—, así que
       * «estar logueado» nunca fue una autorización. Con un rol nuevo en el
       * archivo, conviene volver a decirlo: lo que autoriza es el claim.
       *
       * Mutación: sacar `esDelPanel() &&` del `allow create, update` de
       * `/usuarios`. La última mitad de este caso se pone roja — y es la que
       * impide que `/usuarios` se vuelva un endpoint de escritura abierto al
       * mundo, que es lo que sería si cualquiera con sesión pudiera registrarse.
       */
      await entrarComo(UID_PELADO, {}, 'pelado.b888@ejemplo.test');
      await rechazada(getDoc(doc(db(), 'actividades', MIA)), 'leer sin claim');
      await rechazada(
        setDoc(doc(db(), 'actividades', 'act_b888_pelada'), actividadDe(UID_PELADO)),
        'crear sin claim',
      );
      await rechazada(
        // **Con `serverTimestamp()`**, que es el documento que la regla acepta:
        // con un `actualizadoEn` de mentira el rechazo venía de `usuarioValido()`
        // y no del claim, así que sacar el `esDelPanel()` dejaba este aserto
        // verde. Lo delató la mutación.
        setDoc(doc(db(), 'usuarios', UID_PELADO), {
          email: 'pelado.b888@ejemplo.test',
          actualizadoEn: serverTimestamp(),
        }),
        'registrarse en /usuarios sin claim',
      );
    });

    it('anónima: nada, como antes', async () => {
      await signOut(auth());
      await rechazada(getDoc(doc(db(), 'actividades', MIA)), 'leer sin sesión');
      await rechazada(getDoc(doc(db(), 'usuarios', UID_PUB)), 'leer el directorio sin sesión');
    });
  });
});
