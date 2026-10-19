/**
 * **Las huellas del calendario no las toca ningún cliente** — B-2218.
 *
 * Viven en `actividades/{id}/sincronizacion/calendar` y las escribe solo
 * `syncCalendar` con Admin SDK. Ninguna regla las nombra, así que el default de
 * Firestore las niega; esto fija que siga así aunque mañana alguien agregue un
 * `match` con comodín debajo de `/actividades`.
 */
import { beforeAll, describe, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { entrarComo, uidDe } from './fixtures/credenciales-del-emulador';
import { PROJECT_ID, cargarReglas, emuladorAuthVivo, emuladorVivo, limpiarFirestore } from './emulador';
import { denegada } from './fixtures/rechazos-del-emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const UID = uidDe('uid_huellas_admin');
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

describe.skipIf(!vivo)('las huellas del calendario — B-2218', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    const app = initAdmin({ projectId: PROJECT_ID }, `huellas-${Date.now()}`);
    const a = getAdminFirestore(app);
    await a.doc('actividades/act1').set({ titulo: 'Taller', estado: 'publicado' });
    await a.doc('actividades/act1/sincronizacion/calendar').set({ huellas: { ses_1: 'abc' } });
    await deleteAdminApp(app);
    await entrarComo(UID, { admin: true });
  }, 30_000);

  it('ni el admin del panel las lee', async () => {
    // Mutación probada: un `match /actividades/{id}/{x=**} { allow read: if esAdmin() }` pone esto rojo.
    await denegada(getDoc(doc(db(), 'actividades', 'act1', 'sincronizacion', 'calendar')));
  });

  it('ni las escribe', async () => {
    await denegada(setDoc(doc(db(), 'actividades', 'act1', 'sincronizacion', 'calendar'), { huellas: {} }));
  });
});
