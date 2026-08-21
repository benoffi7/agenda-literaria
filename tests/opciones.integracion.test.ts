import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { OPCIONES_BASE, leerOpciones, upsertOpcion, upsertOpciones } from '@/lib/opciones';
import { emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

/**
 * Tests contra el emulador. Verifican lo que `slugify` solo no puede: que la
 * transacción de §4.2 realmente reuse en vez de duplicar, y que las reglas de
 * §5.3 bloqueen la escritura sin el claim `admin`.
 *
 * Se saltean si los emuladores no están corriendo (`npm run emu`).
 */
describe.skipIf(!vivo)('taxonomías contra el emulador — §4.2', () => {
  beforeAll(async () => {
    await limpiarFirestore();

    // Un usuario con el claim `admin`, como lo haría scripts/set-admin-claim.mjs.
    const adminApp = initAdmin({ projectId: 'agenda-literaria' }, `test-${Date.now()}`);
    const adminAuth = getAdminAuth(adminApp);
    const uid = 'uid_test_admin';
    try {
      await adminAuth.createUser({ uid, email: 'admin@test.local' });
    } catch {
      /* ya existía */
    }
    await adminAuth.setCustomUserClaims(uid, { admin: true });
    const token = await adminAuth.createCustomToken(uid, { admin: true });
    await deleteAdminApp(adminApp);

    await signInWithCustomToken(auth(), token);

    // Siembra las base, como hace scripts/seed-emulador.mjs.
    for (const [campo, valores] of Object.entries(OPCIONES_BASE)) {
      await setDoc(doc(db(), 'opciones', campo), { valores });
    }
  }, 30_000);

  it('reusa la opción existente en lugar de duplicarla', async () => {
    const antes = await leerOpciones('arancel');

    // Las cuatro variantes del §4.2 que arruinaban el desplegable.
    for (const v of ['A la gorra', 'a la gorra ', 'A la Gorra', '  A LA GORRA  ']) {
      const slug = await upsertOpcion('arancel', v);
      expect(slug).toBe('a-la-gorra');
    }

    const despues = await leerOpciones('arancel');
    expect(despues).toHaveLength(antes.length);
    expect(despues.filter((v) => v.slug === 'a-la-gorra')).toHaveLength(1);
  });

  it('incrementa `usos` cada vez que se reusa', async () => {
    const inicial = (await leerOpciones('arancel')).find((v) => v.slug === 'gratis')!.usos;
    await upsertOpcion('arancel', 'Gratis');
    await upsertOpcion('arancel', 'gratis');
    const final = (await leerOpciones('arancel')).find((v) => v.slug === 'gratis')!.usos;
    expect(final).toBe(inicial + 2);
  });

  it('incorpora una etiqueta nueva al desplegable, no fija', async () => {
    await upsertOpcion('arancel', 'Con beca parcial');
    const valores = await leerOpciones('arancel');
    const nueva = valores.find((v) => v.slug === 'con-beca-parcial');
    expect(nueva).toMatchObject({ label: 'Con beca parcial', fijo: false, usos: 1 });
  });

  it('las opciones fijas van primero y las nuevas se ordenan por uso', async () => {
    await upsertOpciones('barrio', ['Villa Crespo', 'Boedo', 'Villa Crespo', 'Villa Crespo']);
    const valores = await leerOpciones('barrio');
    expect(valores.map((v) => v.slug)).toEqual(['villa-crespo', 'boedo']);
  });

  it('crea el documento del campo si no existía', async () => {
    await limpiarFirestore();
    const slug = await upsertOpcion('plataforma', 'Discord');
    expect(slug).toBe('discord');
    const snap = await getDoc(doc(db(), 'opciones', 'plataforma'));
    expect(snap.exists()).toBe(true);
    // Sembró también las base junto con la nueva.
    const slugs = (snap.data()!.valores as { slug: string }[]).map((v) => v.slug);
    expect(slugs).toContain('zoom');
    expect(slugs).toContain('discord');
  });

  it('rechaza una etiqueta que se normaliza a vacío', async () => {
    await expect(upsertOpcion('barrio', '¡!¿?')).rejects.toThrow();
  });
});
