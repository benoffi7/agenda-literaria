/**
 * B-580 — marcar/reabrir un reporte como resuelto desde el panel.
 *
 * Mismo motivo que `reportes-reintento.integracion.test.ts` para tener
 * archivo propio: necesita cargar en el emulador **las reglas de este
 * checkout** (`cargarReglas`), porque con worktrees en paralelo un test de
 * reglas puede estar verificando el `firestore.rules` de otra rama.
 *
 * Lo que se prueba es la regla (`resueltoValido`), no la función del panel:
 * la regla es la autorización real (§5.3). Cada `it` es una forma de hacer
 * daño que la regla tiene que tapar — la que más importa acá es que un
 * anónimo (o un admin sin el claim) no pueda escribir `resuelto`, porque es
 * el flag que decide qué se sigue mostrando en la pantalla de reportes.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { fileURLToPath } from 'node:url';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { marcarResuelto } from '@/lib/reportes';
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

const UID = 'uid_resuelto_admin';
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

/** Cliente Admin: escribe saltándose las reglas, como hace la Function. */
const adminDb = () => {
  const app = initAdmin({ projectId: PROJECT_ID }, `res-${Date.now()}-${Math.random()}`);
  return { db: getAdminFirestore(app), cerrar: () => deleteAdminApp(app) };
};

/** Deja un reporte en el estado que se quiera, por el camino de la Function. */
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
    estado: 'creado',
    intentos: 1,
    github: { numero: 3, url: 'https://github.com/x/y/issues/3', creadoEn: new Date() },
    error: null,
    creadoEn: new Date(),
    ...over,
  });
  await cerrar();
};

const tokenAdmin = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `t-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, esAdmin ? { admin: true } : {});
  const token = await a.createCustomToken(uid, esAdmin ? { admin: true } : {});
  await deleteAdminApp(app);
  return token;
};

describe.skipIf(!vivo)('marcar/reabrir un reporte resuelto — B-580', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
  }, 30_000);

  it('un admin marca resuelto un reporte, sin tocar el resto del documento', async () => {
    await sembrarReporte('marcable');
    await marcarResuelto('marcable', true);

    const d = (await getDoc(doc(db(), 'reportes', 'marcable'))).data()!;
    expect(d.resuelto).toBe(true);
    // El ciclo de vida de envío no se movió por este camino.
    expect(d.estado).toBe('creado');
    expect(d.github.numero).toBe(3);
  });

  it('un admin reabre un reporte ya resuelto', async () => {
    await sembrarReporte('reabrible', { resuelto: true });
    await marcarResuelto('reabrible', false);

    const d = (await getDoc(doc(db(), 'reportes', 'reabrible'))).data()!;
    expect(d.resuelto).toBe(false);
  });

  it('funciona con un reporte que todavía no terminó de enviarse (pendiente/enviando)', async () => {
    // B-580 no depende del estado de envío: el problema puede resolverse
    // antes de que la Function termine de publicar el issue.
    await sembrarReporte('sinIssue', { estado: 'pendiente', github: null, intentos: 0 });
    await marcarResuelto('sinIssue', true);

    const d = (await getDoc(doc(db(), 'reportes', 'sinIssue'))).data()!;
    expect(d.resuelto).toBe(true);
  });

  it('MUTACIÓN — el texto del reporte no se puede colar en la misma escritura', async () => {
    // Si `resueltoValido` no acotara `affectedKeys`, esto pasaría: es la
    // clase de daño que la regla existe para tapar.
    await sembrarReporte('texto');
    await expect(
      updateDoc(doc(db(), 'reportes', 'texto'), {
        resuelto: true,
        titulo: 'Otra cosa completamente distinta',
      }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('MUTACIÓN — no se puede adelantar el ciclo de vida de envío de paso', async () => {
    await sembrarReporte('adelanta', { estado: 'error' });
    await expect(
      updateDoc(doc(db(), 'reportes', 'adelanta'), {
        resuelto: true,
        estado: 'creado',
      }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('MUTACIÓN — `resuelto` tiene que ser booleano, no cualquier valor', async () => {
    await sembrarReporte('noBooleano');
    await expect(
      updateDoc(doc(db(), 'reportes', 'noBooleano'), {
        resuelto: 'si',
        actualizadoEn: new Date(),
      }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('MUTACIÓN — tocar solo `actualizadoEn`, sin `resuelto` en el diff, no alcanza', async () => {
    await sembrarReporte('soloTimestamp');
    await expect(
      updateDoc(doc(db(), 'reportes', 'soloTimestamp'), { actualizadoEn: new Date() }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('MUTACIÓN — un admin sin el claim no puede marcar resuelto', async () => {
    await sembrarReporte('sinClaim');
    await signInWithCustomToken(auth(), await tokenAdmin('uid_pelado_resuelto', false));
    await expect(marcarResuelto('sinClaim', true)).rejects.toThrow(/permission|insufficient/i);
    // Vuelve a loguearse como admin para no romper los `it` que siguen.
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
  });

  it('MUTACIÓN — un anónimo no puede escribir `resuelto`', async () => {
    // El caso que más importa: sin sesión, cualquiera con el SDK de cliente
    // podría intentar ocultar reportes de la bandeja si esto no rechazara.
    await sembrarReporte('anonimo');
    await signOut(auth());
    await expect(marcarResuelto('anonimo', true)).rejects.toThrow(/permission|insufficient/i);
    // Vuelve a loguearse como admin para no romper los `it` que siguen.
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
  });

  it('borrar un reporte sigue prohibido, incluso resuelto', async () => {
    await sembrarReporte('borrableResuelto', { resuelto: true });
    const { deleteDoc } = await import('firebase/firestore');
    await expect(deleteDoc(doc(db(), 'reportes', 'borrableResuelto'))).rejects.toThrow(
      /permission|insufficient/i,
    );
  });
});
