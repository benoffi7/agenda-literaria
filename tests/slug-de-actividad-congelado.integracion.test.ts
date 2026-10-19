/**
 * **El slug de una actividad publicada no cambia, tampoco por fuera del panel**
 * — B-2210, trampa 10.
 *
 * Carga en el emulador las reglas de este checkout antes de correr, por lo mismo
 * que `reportes-reintento`: con varios worktrees el emulador puede tener las de
 * otra rama.
 */
import { beforeAll, describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { entrarComo, uidDe } from './fixtures/credenciales-del-emulador';
import { PROJECT_ID, cargarReglas, emuladorAuthVivo, emuladorVivo, limpiarFirestore } from './emulador';
import { denegada } from './fixtures/rechazos-del-emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const UID = uidDe('uid_slug_admin');
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const sembrar = async (id: string, datos: Record<string, unknown>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `slug-${Date.now()}-${Math.random()}`);
  await getAdminFirestore(app).doc(`actividades/${id}`).set({ titulo: 'Taller', slug: `taller-${id}`, ...datos });
  await deleteAdminApp(app);
};

describe.skipIf(!vivo)('el slug de una actividad publicada — B-2210', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    await entrarComo(UID, { admin: true });
  }, 30_000);

  it('publicada: ni un admin le cambia el slug', async () => {
    // Mutación probada: sacar `slugDeActividadIntacto()` de la regla pone esto rojo.
    await sembrar('pub', { estado: 'publicado', publicadaAlgunaVez: true });
    await denegada(updateDoc(doc(db(), 'actividades', 'pub'), { slug: 'otra-url' }));
  });

  it('despublicada después de haberlo estado, tampoco: la URL ya circuló', async () => {
    await sembrar('despub', { estado: 'borrador', publicadaAlgunaVez: true });
    await denegada(updateDoc(doc(db(), 'actividades', 'despub'), { slug: 'otra-url' }));
  });

  it('publicada, editar otra cosa sigue andando', async () => {
    await sembrar('edita', { estado: 'publicado', publicadaAlgunaVez: true });
    await updateDoc(doc(db(), 'actividades', 'edita'), { titulo: 'Taller de crónica' });
  });

  it('un borrador que nunca se publicó sí puede cambiar el slug', async () => {
    await sembrar('borr', { estado: 'borrador', publicadaAlgunaVez: false });
    await updateDoc(doc(db(), 'actividades', 'borr'), { slug: 'la-buena' });
  });
});
