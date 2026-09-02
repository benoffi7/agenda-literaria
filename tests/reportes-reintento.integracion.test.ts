/**
 * B-31 — reintentar desde el panel un reporte que quedó en `error`.
 *
 * Va en su propio archivo y no dentro de `reportes.integracion.test.ts` porque
 * necesita algo que aquel no hace: **cargar en el emulador las reglas de este
 * checkout**. El emulador sirve el `firestore.rules` del directorio desde el que
 * se lo arrancó, así que con worktrees en paralelo un test de reglas puede estar
 * verificando el archivo de otra rama (ver `cargarReglas`).
 *
 * Lo que se prueba es la **regla**, no la función del panel: la regla es la
 * autorización real (§5.3), y acá abre una escritura del cliente sobre un
 * documento cuyo ciclo de vida es de una Function. Cada test es una forma de
 * hacer daño que la regla tiene que tapar.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { fileURLToPath } from 'node:url';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { reintentarReporte } from '@/lib/reportes';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';

// B-365 — los dos: este archivo hace login, así que Firestore arriba y Auth
// abajo (una tanda de emuladores a medias) no puede leerse como «está todo».
const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());

const UID = 'uid_reintento_admin';
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

/** Cliente Admin: escribe saltándose las reglas, como hace la Function. */
const adminDb = () => {
  const app = initAdmin({ projectId: PROJECT_ID }, `reint-${Date.now()}-${Math.random()}`);
  return { db: getAdminFirestore(app), cerrar: () => deleteAdminApp(app) };
};

/**
 * Deja un reporte en el estado que se quiera, por el camino de la Function (que
 * no pasa por las reglas). Es la única forma de fabricar un `error`: el panel no
 * puede crear un reporte que nazca fallado, y eso ya lo verifica el otro archivo.
 */
const sembrarReporte = async (id: string, over: Record<string, unknown> = {}) => {
  const { db: a, cerrar } = adminDb();
  await a.doc(`reportes/${id}`).set({
    tipo: 'bug',
    titulo: 'No guarda el borrador',
    descripcion: 'Toco guardar y no pasa nada, se queda igual.',
    pasos: null,
    severidad: 'molesta',
    actividad: null,
    contexto: {
      versionPanel: '1.0.1',
      navegador: 'vitest',
      ventana: '390×844 @3x',
      zonaHoraria: 'America/Argentina/Buenos_Aires',
      url: '/admin',
      pantalla: 'listado',
    },
    reportadoPor: { uid: UID, email: 'admin@test.com' },
    estado: 'error',
    intentos: 3,
    github: null,
    error: 'GitHub 401: Bad credentials',
    creadoEn: new Date(),
    ...over,
  });
  await cerrar();
};

const tokenAdmin = async (uid: string) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `t-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, { admin: true });
  const token = await a.createCustomToken(uid, { admin: true });
  await deleteAdminApp(app);
  return token;
};

describe.skipIf(!vivo)('reintentar un reporte fallido — B-31', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    await signInWithCustomToken(auth(), await tokenAdmin(UID));
  }, 30_000);

  it('un reporte en error vuelve a la cola, con los intentos a cero', async () => {
    await sembrarReporte('falló');
    await reintentarReporte('falló');

    const d = (await getDoc(doc(db(), 'reportes', 'falló'))).data()!;
    expect(d.estado).toBe('pendiente');
    // Sin esto el botón no haría nada: `decidirAccion` de functions/reportes.js
    // ignora un reporte con los tres intentos gastados, que es el caso más
    // común de un `error`.
    expect(d.intentos).toBe(0);
    // El mensaje del fallo anterior no puede quedar contradiciendo al estado
    // nuevo en la pantalla.
    expect(d.error).toBeNull();
  });

  it('el texto del reporte no se puede editar de paso', async () => {
    // Es lo que termina en un repo PÚBLICO: si el reintento permitiera tocarlo,
    // el documento que se revisó al crearlo dejaría de ser el que se publica.
    await sembrarReporte('texto');
    await expect(
      updateDoc(doc(db(), 'reportes', 'texto'), {
        estado: 'pendiente',
        intentos: 0,
        error: null,
        titulo: 'Otra cosa completamente distinta',
      }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('no se puede reintentar uno que ya tiene issue: serían dos issues del mismo reporte', async () => {
    await sembrarReporte('yaEsta', {
      estado: 'error',
      github: { numero: 7, url: 'https://github.com/x/y/issues/7', creadoEn: new Date() },
    });
    await expect(reintentarReporte('yaEsta')).rejects.toThrow(/permission|insufficient/i);
  });

  it('no se puede reintentar uno que está en vuelo', async () => {
    // `enviando` significa que la Function lo tomó hace un segundo. Reintentarlo
    // ahí es la carrera que crea el issue duplicado.
    await sembrarReporte('enVuelo', { estado: 'enviando', intentos: 1, error: null });
    await expect(reintentarReporte('enVuelo')).rejects.toThrow(/permission|insufficient/i);
  });

  it('no se puede reintentar uno que ya se publicó bien', async () => {
    await sembrarReporte('creado', {
      estado: 'creado',
      error: null,
      github: { numero: 9, url: 'https://github.com/x/y/issues/9', creadoEn: new Date() },
    });
    await expect(reintentarReporte('creado')).rejects.toThrow(/permission|insufficient/i);
  });

  it('el reintento no es una puerta para adelantar el ciclo de vida', async () => {
    // La transición permitida es una sola: error → pendiente. Cualquier otra
    // sigue siendo de la Function.
    await sembrarReporte('adelanta');
    await expect(
      updateDoc(doc(db(), 'reportes', 'adelanta'), {
        estado: 'creado',
        intentos: 0,
        error: null,
        github: { numero: 1, url: 'https://x', creadoEn: new Date() },
      }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('borrar un reporte sigue prohibido', async () => {
    // Un reporte es el pedido de una persona: el panel no tiene por qué poder
    // hacerlo desaparecer.
    await sembrarReporte('borrable');
    const { deleteDoc } = await import('firebase/firestore');
    await expect(deleteDoc(doc(db(), 'reportes', 'borrable'))).rejects.toThrow(
      /permission|insufficient/i,
    );
  });
});
