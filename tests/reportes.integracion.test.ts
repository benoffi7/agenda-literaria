/**
 * Reglas y escritura de `/reportes/{id}` contra el emulador.
 *
 * Se saltean solos si el emulador no está. **Ojo:** el emulador sirve las
 * reglas del directorio desde el que se lo arrancó, así que hay que arrancarlo
 * en este checkout (`npm run emu`) o las reglas de `/reportes` no existen y
 * todo se deniega.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { formAReporte } from '@/lib/reporte-schema';
import { crearReporte } from '@/lib/reportes';
import type { ContextoReporte, ReporteForm } from '@/types/reporte';
import { emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

const UID = 'uid_reportes_admin';

const tokenAdmin = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: 'agenda-literaria' }, `r-${uid}-${Date.now()}`);
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

const contexto = (): ContextoReporte => ({
  versionPanel: '0.1.0 (test)',
  navegador: 'vitest',
  ventana: '390×844 @3x',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  url: '/admin',
  pantalla: 'listado',
});

const form = (over: Partial<ReporteForm> = {}): ReporteForm => ({
  tipo: 'bug',
  titulo: 'No guarda el borrador',
  descripcion: 'Toco guardar y no pasa nada, se queda igual.',
  pasos: '1) entré 2) toqué guardar',
  severidad: 'molesta',
  pantalla: 'listado',
  actividadId: '',
  ...over,
});

/** Documento tal como lo manda el panel, para poder deformarlo campo a campo. */
const documento = (uid: string, over: Record<string, unknown> = {}) => ({
  ...formAReporte(form(), contexto(), { uid, email: 'x@y.com' }),
  creadoEn: serverTimestamp(),
  ...over,
});

describe.skipIf(!vivo)('reportes contra el emulador', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
  }, 30_000);

  it('un admin crea un reporte y lo puede leer', async () => {
    const id = await crearReporte(form(), contexto(), { uid: UID, email: 'admin@test.com' });
    const snap = await getDoc(doc(db(), 'reportes', id));
    expect(snap.exists()).toBe(true);
    const d = snap.data()!;
    expect(d.titulo).toBe('No guarda el borrador');
    expect(d.reportadoPor.uid).toBe(UID);
    // El contexto técnico viaja completo: es lo que le ahorra el ida y vuelta
    // al dueño.
    expect(d.contexto.zonaHoraria).toBe('America/Argentina/Buenos_Aires');
  });

  it('acepta una sugerencia, que va con pasos y severidad en null', async () => {
    // Los campos nulos son el caso que una regla mal escrita rechaza de más:
    // acceder a un campo null en las reglas es un error de evaluación, y un
    // error deniega igual que un `false`.
    const id = await crearReporte(
      form({ tipo: 'sugerencia', severidad: null, pasos: '' }),
      contexto(),
      { uid: UID, email: 'admin@test.com' },
    );
    const d = (await getDoc(doc(db(), 'reportes', id))).data()!;
    expect(d.pasos).toBeNull();
    expect(d.severidad).toBeNull();
  });

  it('acepta un reporte que referencia una actividad', async () => {
    const id = await crearReporte(
      form({ actividadId: 'act_1' }),
      contexto(),
      { uid: UID, email: 'admin@test.com' },
      'Club de lectura',
    );
    const d = (await getDoc(doc(db(), 'reportes', id))).data()!;
    expect(d.actividad).toEqual({ id: 'act_1', titulo: 'Club de lectura' });
  });

  it('el reporte no puede nacer con el issue ya asignado', async () => {
    await expect(
      setDoc(
        doc(db(), 'reportes', 'trucho1'),
        documento(UID, { github: { numero: 1, url: 'https://x' } }),
      ),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('el reporte no puede nacer con el ciclo de vida adelantado', async () => {
    // Si naciera "creado" o con los intentos gastados, la Function no lo
    // tomaría nunca y el reporte quedaría muerto en Firestore.
    await expect(
      setDoc(doc(db(), 'reportes', 'trucho2'), documento(UID, { estado: 'creado' })),
    ).rejects.toThrow(/permission|insufficient/i);
    await expect(
      setDoc(doc(db(), 'reportes', 'trucho3'), documento(UID, { intentos: 5 })),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('nadie puede cargar un reporte a nombre de otro admin', async () => {
    await expect(
      setDoc(doc(db(), 'reportes', 'trucho4'), documento('otro_uid')),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('no se puede antedatar un reporte', async () => {
    await expect(
      setDoc(
        doc(db(), 'reportes', 'trucho5'),
        documento(UID, { creadoEn: Timestamp.fromDate(new Date('2020-01-01')) }),
      ),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('no se puede meter un campo de más', async () => {
    await expect(
      setDoc(doc(db(), 'reportes', 'trucho6'), documento(UID, { labels: ['sos-el-dueño'] })),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('rechaza el texto que pasa los topes del issue', async () => {
    await expect(
      setDoc(doc(db(), 'reportes', 'trucho7'), documento(UID, { titulo: 'x'.repeat(121) })),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('el cliente no puede tocar un reporte ya creado: el estado lo mueve la Function', async () => {
    const id = await crearReporte(form(), contexto(), { uid: UID, email: 'admin@test.com' });
    await expect(
      updateDoc(doc(db(), 'reportes', id), { estado: 'creado' }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('sin el claim admin no se puede crear ni leer un reporte', async () => {
    const id = await crearReporte(form(), contexto(), { uid: UID, email: 'admin@test.com' });
    await signInWithCustomToken(auth(), await tokenAdmin('uid_pelado_reportes', false));
    await expect(
      setDoc(doc(db(), 'reportes', 'trucho8'), documento('uid_pelado_reportes')),
    ).rejects.toThrow(/permission|insufficient/i);
    await expect(getDoc(doc(db(), 'reportes', id))).rejects.toThrow();
  });

  it('un anónimo no lee los reportes', async () => {
    const idAjeno = 'cualquiera';
    await signOut(auth());
    await expect(getDoc(doc(db(), 'reportes', idAjeno))).rejects.toThrow();
  });
});
