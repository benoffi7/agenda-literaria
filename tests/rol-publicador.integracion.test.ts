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
// Las funciones **del panel**, no una query rearmada a mano: el bug que el
// bloque 8 frena es que el panel arme la query mal (ver su docblock).
import {
  actualizarActividad,
  borrarActividad,
  crearActividad,
  listarActividades,
  slugDisponible,
} from '@/lib/actividades';
import { olvidarCentinela } from '@/lib/slugs';
import { formDeCiclo } from './fixtures/formulario-de-ciclo';
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
  /*
   * **`updatedAt` no es andamiaje: sin él la query del listado devuelve vacío** —
   * lo enseñó este archivo al escribir el bloque 8. `listarActividades` ordena por
   * `updatedAt`, y Firestore **excluye del resultado los documentos que no tienen
   * el campo del `orderBy`**, así que un documento sembrado sin él no aparece
   * aunque la regla lo autorice. En producción no pasa (`formADocumento` lo
   * escribe siempre), pero un fixture sin él haría que el caso del listado diera
   * vacío y se leyera como «la regla lo frenó».
   */
  updatedAt: new Date(),
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
  // ══════════════════════════════════════════════════════════════════════
  //  7. EL ÍNDICE DE SLUGS — la rotura 2, y la que no tenía arreglo obvio
  // ══════════════════════════════════════════════════════════════════════
  describe('/slugs — el índice que hace verificable la unicidad (D-660)', () => {
    /*
     * **Por qué esta colección existe.** El bloque 3 de este archivo ya fija el
     * mecanismo: una query sin `where` se le rechaza **entera** al publicador. Eso
     * deja a `slugDisponible()` sin forma de contestar, porque el slug único es un
     * invariante de TODO el catálogo y no se verifica mirando solo lo propio. El
     * índice lo contesta con un `get` por id, y —lo que de verdad cambia— con
     * `allow update: if false` convierte el chequeo en un invariante: la reserva
     * viaja en el mismo `writeBatch` que la actividad.
     */
    const reserva = (uid: string, actividadId: string) => ({
      actividadId,
      porUid: uid,
      creadoEn: serverTimestamp(),
    });

    beforeEach(async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
    });

    it('reserva un nombre libre, y lo puede leer por id', async () => {
      // El control positivo: sin esto, un `allow create: if false` pasaría todos
      // los casos de negación de abajo.
      await setDoc(doc(db(), 'slugs', 'taller-nuevo'), reserva(UID_PUB, 'act_x'));
      const leido = await getDoc(doc(db(), 'slugs', 'taller-nuevo'));
      expect(leido.data()?.actividadId).toBe('act_x');
    });

    it('y NO puede pisar una reserva que ya existe — es la unicidad, no un chequeo', async () => {
      /*
       * **Esto es lo que el barrido de antes no daba.** `slugDisponible()` era
       * check-then-write: dos guardados simultáneos con el mismo slug pasaban los
       * dos, y quedaban dos actividades peleando la misma URL (trampa 10). Acá el
       * segundo `set` es un `update` sobre un documento que existe, y `update`
       * está en `false`: lo rechaza el servidor, no el cliente.
       *
       * Mutación: cambiar `allow update: if false` por `esDelPanel()`. Este caso
       * se pone rojo, y con él se cae la única propiedad que esta colección compra
       * por encima de una Function.
       */
      await setDoc(doc(db(), 'slugs', 'taller-disputado'), reserva(UID_PUB, 'act_1'));
      await rechazada(
        setDoc(doc(db(), 'slugs', 'taller-disputado'), reserva(UID_PUB, 'act_2')),
        'pisar una reserva ajena',
      );
      // Y el dueño no cambió: el rechazo no es cosmético.
      expect((await getDoc(doc(db(), 'slugs', 'taller-disputado'))).data()?.actividadId).toBe(
        'act_1',
      );
    });

    it('no reserva a nombre de otra cuenta', async () => {
      // Mutación: sacar `d.get('porUid','') == request.auth.uid` de
      // `reservaValida()`. Este caso se pone rojo. Es lo que hace verificable el
      // `delete` de más abajo: sin esa cláusula, `porUid` sería un dato que el
      // cliente elige y soltar el nombre de otro sería escribirlo primero.
      await rechazada(
        setDoc(doc(db(), 'slugs', 'taller-firmado-por-otro'), reserva(UID_ADMIN, 'act_1')),
        'reservar a nombre de otra cuenta',
      );
    });

    it('no puede escribir el centinela, que es lo que hace que el índice no falle abierto', async () => {
      /*
       * `/slugs/_indice` lo escribe **solo el Admin SDK** (el script de siembra), y
       * eso no es prolijidad: `slugLibre()` se niega a contestar mientras no está,
       * así que poder crearlo desde el panel sería poder decirle al panel «el
       * índice está completo» sobre un índice vacío — y ahí toda dirección
       * publicada se leería como libre.
       *
       * Lo impide el `slug.matches('^[a-z0-9-]+$')` de `reservaValida()`, porque
       * `slugify` nunca produce un `_`.
       *
       * Mutación: sacar ese `matches`. Este caso se pone rojo.
       */
      await rechazada(
        setDoc(doc(db(), 'slugs', '_indice'), reserva(UID_PUB, 'act_1')),
        'escribir el centinela del índice',
      );
    });

    it('no enumera el índice: sería la lista de direcciones de todos los borradores', async () => {
      // Mutación: `allow list: if esDelPanel()`. Este caso se pone rojo. Es la
      // misma trampa 13 de `storage.rules`: un `read` abierto entrega el prefijo
      // entero, y acá el prefijo son las URLs de lo que todavía no se publicó.
      await rechazada(getDocs(collection(db(), 'slugs')), 'enumerar el índice de slugs');
    });

    it('suelta la suya y no la de otro', async () => {
      /*
       * Liberar el nombre pasa al borrar la actividad y al cambiarle el slug antes
       * de publicarla. Se mira `porUid` y no el dueño de la actividad: eso pediría
       * un `get()` a `/actividades` desde la regla, que se factura como lectura en
       * cada evaluación (es lo que el bloque de `versiones` ya descartó).
       *
       * Mutación: sacar la condición de `porUid` del `allow delete`. La primera
       * mitad de este caso se pone roja.
       */
      await sembrarEn('slugs/taller-del-admin', {
        actividadId: 'act_admin',
        porUid: UID_ADMIN,
        creadoEn: new Date(),
      });
      await rechazada(deleteDoc(doc(db(), 'slugs', 'taller-del-admin')), 'soltar el nombre de otro');

      await setDoc(doc(db(), 'slugs', 'taller-para-soltar'), reserva(UID_PUB, 'act_3'));
      await deleteDoc(doc(db(), 'slugs', 'taller-para-soltar'));
      expect((await getDoc(doc(db(), 'slugs', 'taller-para-soltar'))).exists()).toBe(false);
    });

    it('la reserva no acepta un campo de más, ni un `actividadId` que no sea un string corto', async () => {
      /*
       * **Las cuatro cláusulas de forma de `reservaValida()` que no tenían
       * testigo** — lo marcó el `auditor-privacidad`. La que más importa es
       * `hasOnly`: es lo único que impide que una cuenta acotada guarde texto
       * arbitrario suyo adentro de un documento de `/slugs`, que es una colección
       * que **todo el panel lee**.
       *
       * MUTACIÓN PROBADA: sacar `hasOnly` → rojo el primero; sacar `size() > 0` →
       * rojo el tercero; sacar `size() <= 200` → rojo el cuarto.
       *
       * **El segundo caso —el `actividadId` numérico— no tiene una cláusula
       * propia, y está dicho**: lo rechaza el `size() > 0`, porque un número no
       * tiene `.size()` y el *evaluation error* deniega. Un `is string` adelante
       * no cambiaría ningún veredicto, así que se borró: es el mismo caso que el
       * `is string` que `usuarioValido()` ya había borrado, y lo delató la
       * mutación al ir a probarlo. El caso queda porque el comportamiento sí hay
       * que fijarlo — lo que no hay es una cláusula de adorno que lo finja.
       */
      const base = { porUid: UID_PUB, creadoEn: serverTimestamp() };
      await rechazada(
        setDoc(doc(db(), 'slugs', 'con-campo-de-mas'), {
          ...base,
          actividadId: 'act_1',
          notas: 'texto que nadie valida',
        }),
        'una reserva con un campo de más',
      );
      await rechazada(
        setDoc(doc(db(), 'slugs', 'con-id-numerico'), { ...base, actividadId: 42 }),
        'un actividadId que no es string',
      );
      await rechazada(
        setDoc(doc(db(), 'slugs', 'con-id-vacio'), { ...base, actividadId: '' }),
        'un actividadId vacío',
      );
      await rechazada(
        setDoc(doc(db(), 'slugs', 'con-id-larguisimo'), {
          ...base,
          actividadId: 'x'.repeat(201),
        }),
        'un actividadId de 201 caracteres',
      );
    });

    it('lee la reserva de un admin, `porUid` incluido — y eso es lo aceptado', async () => {
      /*
       * **Un aserto positivo sobre algo que se acepta, no sobre algo que se
       * frena**, y por eso está escrito así: una regla es todo-o-nada por
       * documento y no proyecta (D-128), así que el `get` entrega los tres campos
       * — incluido el uid de quien reservó, que puede ser un admin.
       *
       * No hay arreglo estrecho: condicionar el `get` por `porUid` rompería la
       * unicidad, porque el publicador **tiene que** poder saber que un nombre
       * ajeno está tomado. Lo que se entrega es un uid pelado, que él no puede
       * resolver a un mail (el directorio le está cerrado, y eso sí tiene su caso
       * en el bloque 4).
       *
       * Está acá para que el día que alguien intente cerrar el `get` vea qué se
       * rompe, en vez de descubrirlo con el panel de un publicador sin poder
       * guardar. Lo pidió el `auditor-privacidad`.
       */
      await sembrarEn('slugs/reservado-por-el-admin', {
        actividadId: 'act_del_admin',
        porUid: UID_ADMIN,
        creadoEn: new Date(),
      });
      const leido = await getDoc(doc(db(), 'slugs', 'reservado-por-el-admin'));
      expect(leido.data()?.actividadId).toBe('act_del_admin');
      expect(leido.data()?.porUid, 'el get ya no entrega porUid: ver el docblock').toBe(UID_ADMIN);
    });

    it('puede reservar un nombre sin cargar la actividad, y eso falla cerrada', async () => {
      /*
       * `reservaValida()` no verifica que `actividadId` exista: hacerlo pediría un
       * `get()` a `/actividades` desde la regla, facturado en cada evaluación. O
       * sea que una cuenta acotada puede tomar un nombre que nadie va a usar.
       *
       * **Se acepta porque falla cerrada** —un nombre que nadie puede usar, nunca
       * dos actividades con la misma URL— y porque lo barre
       * `scripts/sembrar-slugs.mjs --reparar`, que saca toda reserva sin actividad
       * viva. Es el mismo tipo de límite que `storage.rules` declara para su
       * prefijo plano. Lo pidió el `auditor-privacidad`.
       */
      await setDoc(doc(db(), 'slugs', 'taller-que-no-existe'), reserva(UID_PUB, 'act_inventada'));
      expect((await getDoc(doc(db(), 'slugs', 'taller-que-no-existe'))).exists()).toBe(true);
    });

    it('un anónimo no lee el índice: es la lista de lo que todavía no se publicó', async () => {
      await signOut(auth());
      await rechazada(getDoc(doc(db(), 'slugs', 'taller-nuevo')), 'leer el índice sin sesión');
    });
  });
  // ══════════════════════════════════════════════════════════════════════
  //  8. Y EL PANEL DE VERDAD: las funciones que la tajada 2 arregló
  // ══════════════════════════════════════════════════════════════════════
  describe('el panel del publicador, con las funciones reales (tajada 2)', () => {
    /*
     * Los bloques de arriba prueban **las reglas**. Éste prueba que el código del
     * panel las satisface, que es lo que la tajada 2 vino a hacer: la tajada 1
     * dejó una frontera correcta y un panel que se rompía contra ella.
     *
     * Se llaman las funciones de `src/lib/` de verdad —no un `getDocs` armado a
     * mano— porque el bug que esto frena es justamente que **el panel** arme la
     * query mal. Un test que rearme la query buena prueba la regla, no el arreglo.
     */
    beforeEach(async () => {
      await sembrarEn('slugs/_indice', { sembradoEn: new Date(), actividades: 2 });
      await sembrarEn(`slugs/taller-${UID_PUB}`, {
        actividadId: MIA,
        porUid: UID_PUB,
        creadoEn: new Date(),
      });
      olvidarCentinela();
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
    });

    it('`listarActividades` le trae lo suyo, y el barrido de antes se rechaza entero', async () => {
      /*
       * **La rotura 1, de las dos puntas.** El listado del panel llamaba a
       * `listarActividades()` sin `where`, y con la regla de B-888 eso no devuelve
       * un subconjunto: Firestore **rechaza la query completa** (trampa 7), así que
       * la pantalla principal de un publicador quedaba rota y no acotada.
       *
       * MUTACIÓN PROBADA: sacarle la rama del `where` a `listarActividades`
       * (`src/lib/actividades.ts`) —o sea, dejar el barrido de antes— deja la
       * primera mitad de este caso en rojo con `permission-denied`. Es la rotura
       * real, no una aproximación.
       */
      const mias = await listarActividades('publicador', UID_PUB);
      expect(mias.map((a) => a.id)).toEqual([MIA]);

      // La otra punta: con el rol equivocado, la misma función hace el barrido y
      // el servidor la corta. Es el control negativo que hace que la primera
      // mitad signifique algo.
      await rechazada(listarActividades('admin', UID_PUB), 'el barrido sin where');
    });

    it('`slugDisponible` contesta sin barrer el catálogo — la rotura 2', async () => {
      /*
       * Barría toda la colección, así que se rechazaba entera igual que el
       * listado. Ahora es un `get` por id contra `/slugs`.
       *
       * MUTACIÓN PROBADA: volver `slugDisponible` al `getDocs` de la colección
       * deja este caso en rojo con `permission-denied`.
       */
      expect(await slugDisponible(`taller-${UID_PUB}`)).toBe(false);
      // El propio documento no cuenta como conflicto consigo mismo.
      expect(await slugDisponible(`taller-${UID_PUB}`, MIA)).toBe(true);
      expect(await slugDisponible('taller-que-nadie-reservo')).toBe(true);
    });

    it('y sin el centinela se niega a contestar, en vez de decir «libre»', async () => {
      /*
       * **La única forma en que este índice puede fallar, y falla cerrada.** Un
       * índice sin sembrar no tiene ninguna reserva, así que toda dirección —
       * incluida una publicada— se leería como libre: eso es la trampa 10 servida
       * en bandeja. El centinela lo convierte en un corte con mensaje.
       *
       * MUTACIÓN PROBADA: sacarle a `slugLibre` el `if (!sembrado) throw` deja
       * este caso en rojo — y devuelve `true` sobre un slug que está tomado.
       */
      await getAdminFirestore(appSiembra!).doc('slugs/_indice').delete();
      olvidarCentinela();
      await expect(slugDisponible(`taller-${UID_PUB}`)).rejects.toThrow(/índice de direcciones/);
    });

    it('guarda una actividad entera, con su reserva, en una sola operación', async () => {
      /*
       * El camino completo: `crearActividad` escribe la actividad **y** su reserva
       * en el mismo `writeBatch`. Es el que prueba que las cuatro cláusulas nuevas
       * de `/actividades` y las cinco de `/slugs` se satisfacen todas juntas desde
       * el panel, que es algo que ningún caso de regla suelto puede decir.
       */
      const form = { ...formDeCiclo(), slug: 'taller-recien-creado' };
      const id = await crearActividad(form, UID_PUB);

      const escrita = await getDoc(doc(db(), 'actividades', id));
      expect(escrita.data()?.createdBy).toBe(UID_PUB);
      const reservado = await getDoc(doc(db(), 'slugs', 'taller-recien-creado'));
      expect(reservado.data()?.actividadId).toBe(id);
      expect(reservado.data()?.porUid).toBe(UID_PUB);

      // Y borrarla suelta el nombre: si no, quedaría tomado para siempre.
      await borrarActividad(id);
      expect((await getDoc(doc(db(), 'slugs', 'taller-recien-creado'))).exists()).toBe(false);
    });

    it('editar una actividad SIN slug en disco también reserva el nuevo', async () => {
      /*
       * **El bug que encontró el `auditor-trampas`, con su red.** La primera
       * versión de `actualizarActividad` gateaba el batch entero con
       * `slugEnDisco &&`, así que una actividad sin slug válido —el caso que
       * `scripts/sembrar-slugs.mjs` lista como `sinSlug`— caía al `updateDoc`
       * pelado: se le escribía el slug nuevo y **no se reservaba nada**. El índice
       * quedaba diciendo «libre» sobre un slug en uso, o sea la trampa 10 con el
       * índice contradiciendo al catálogo.
       *
       * Es alcanzable por el camino normal: alguien edita una actividad vieja y le
       * pone su primera dirección web desde el formulario.
       *
       * MUTACIÓN PROBADA: volver la condición a `if (slugEnDisco && slugNuevo !==
       * slugEnDisco)` deja este caso en rojo, y ningún otro se mueve.
       */
      await sembrarEn('actividades/act_sin_slug', {
        titulo: 'De antes, sin dirección web',
        estado: 'borrador',
        createdBy: UID_PUB,
        updatedBy: UID_PUB,
        updatedAt: new Date(),
        sesiones: [],
      });

      await actualizarActividad(
        'act_sin_slug',
        { ...formDeCiclo(), slug: 'su-primera-direccion' },
        UID_PUB,
      );

      const reservado = await getDoc(doc(db(), 'slugs', 'su-primera-direccion'));
      expect(reservado.exists(), 'se escribió el slug sin reservarlo').toBe(true);
      expect(reservado.data()?.actividadId).toBe('act_sin_slug');
    });

    it('borrar con la fila sin refrescar suelta el slug de VERDAD, no el del snapshot', async () => {
      /*
       * **El tercer bug de la misma familia, y el que cierra la serie** — lo
       * encontró el `auditor-trampas` en el pase sobre el invariante del slug.
       *
       * `borrarActividad` era el único de los cuatro escritores que **no releía**
       * el documento: tomaba el slug de la fila del listado en memoria. Con la
       * fila sin refrescar —otra pestaña le cambió la dirección web en el medio—
       * soltaba el slug **viejo**, que ya no existe (un no-op que «sale bien»), y
       * dejaba el **actual** reservado apuntando a un id recién borrado. Sin
       * error, sin aviso, y sin que nada se pusiera rojo.
       *
       * MUTACIÓN PROBADA: volver `borrarActividad` a recibir el slug por
       * parámetro y soltar ése deja este caso en rojo, y ningún otro se mueve.
       */
      const id = await crearActividad(
        { ...formDeCiclo(), slug: 'direccion-vieja' },
        UID_PUB,
      );
      // La otra pestaña le cambia la dirección web: reserva la nueva y suelta la
      // vieja, atómico y correcto.
      await actualizarActividad(id, { ...formDeCiclo(), slug: 'direccion-nueva' }, UID_PUB);
      expect((await getDoc(doc(db(), 'slugs', 'direccion-vieja'))).exists()).toBe(false);

      // Y esta pestaña, con la fila de antes, aprieta «Borrar».
      await borrarActividad(id);

      expect(
        (await getDoc(doc(db(), 'slugs', 'direccion-nueva'))).exists(),
        'quedó reservada la dirección de una actividad que ya no existe',
      ).toBe(false);
    });

    it('y el guardado simultáneo del mismo slug no pasa dos veces', async () => {
      /*
       * **Lo que el barrido no podía dar.** `slugDisponible` era check-then-write:
       * dos guardados a la vez con el mismo slug pasaban los dos y quedaban dos
       * actividades peleando una URL (trampa 10). Con la reserva adentro del
       * batch, el segundo lo rechaza el servidor.
       *
       * Se lanzan **en paralelo** a propósito: en serie, el segundo lo frenaría el
       * chequeo previo y este caso pasaría sin probar la atomicidad.
       */
      const form = { ...formDeCiclo(), slug: 'taller-disputado-de-verdad' };
      const resultados = await Promise.allSettled([
        crearActividad(form, UID_PUB),
        crearActividad(form, UID_PUB),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });
  });
});
