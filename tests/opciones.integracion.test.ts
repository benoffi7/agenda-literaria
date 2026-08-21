import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { huellaCreador } from '@/lib/huella';
import {
  OPCIONES_BASE,
  estaAprobada,
  leerOpciones,
  opcionesVisibles,
  upsertOpcion,
  upsertOpciones,
} from '@/lib/opciones';
import type { ValorOpcion } from '@/types/actividad';
import { HOST_FIRESTORE, emuladorVivo, limpiarFirestore } from './emulador';

/** El uid que crea las opciones en estos tests (el usuario logueado más abajo). */
const UID = 'uid_test_admin';
/** La otra cuenta con claim admin (§4.3): no debería ver lo pendiente de UID. */
const UID_OTRO = 'uid_test_admin_2';

const vivo = await emuladorVivo();

/** Loguea al panel con el claim `admin`, como lo haría scripts/set-admin-claim.mjs. */
const entrarComoAdmin = async (uid: string) => {
  const adminApp = initAdmin({ projectId: 'agenda-literaria' }, `test-${Date.now()}`);
  const adminAuth = getAdminAuth(adminApp);
  try {
    await adminAuth.createUser({ uid, email: `${uid}@test.local` });
  } catch {
    /* ya existía */
  }
  await adminAuth.setCustomUserClaims(uid, { admin: true });
  const token = await adminAuth.createCustomToken(uid, { admin: true });
  await deleteAdminApp(adminApp);
  await signInWithCustomToken(auth(), token);
};

/** Siembra las base, como hace scripts/seed-emulador.mjs. */
const sembrarBase = async () => {
  for (const [campo, valores] of Object.entries(OPCIONES_BASE)) {
    await setDoc(doc(db(), 'opciones', campo), { valores });
  }
};

/** Los valores tal como quedaron en el documento, sin ordenar ni filtrar. */
const valoresCrudos = async (campo: string): Promise<ValorOpcion[]> => {
  const snap = await getDoc(doc(db(), 'opciones', campo));
  return (snap.data()?.valores ?? []) as ValorOpcion[];
};

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
    await entrarComoAdmin(UID);
    await sembrarBase();
  }, 30_000);

  it('reusa la opción existente en lugar de duplicarla', async () => {
    const antes = await leerOpciones('arancel');

    // Las cuatro variantes del §4.2 que arruinaban el desplegable.
    for (const v of ['A la gorra', 'a la gorra ', 'A la Gorra', '  A LA GORRA  ']) {
      const slug = await upsertOpcion('arancel', v, UID);
      expect(slug).toBe('a-la-gorra');
    }

    const despues = await leerOpciones('arancel');
    expect(despues).toHaveLength(antes.length);
    expect(despues.filter((v) => v.slug === 'a-la-gorra')).toHaveLength(1);
  });

  it('incrementa `usos` cada vez que se reusa', async () => {
    const inicial = (await leerOpciones('arancel')).find((v) => v.slug === 'gratis')!.usos;
    await upsertOpcion('arancel', 'Gratis', UID);
    await upsertOpcion('arancel', 'gratis', UID);
    const final = (await leerOpciones('arancel')).find((v) => v.slug === 'gratis')!.usos;
    expect(final).toBe(inicial + 2);
  });

  it('incorpora una etiqueta nueva al desplegable, no fija', async () => {
    await upsertOpcion('arancel', 'Con beca parcial', UID);
    const valores = await leerOpciones('arancel');
    const nueva = valores.find((v) => v.slug === 'con-beca-parcial');
    expect(nueva).toMatchObject({ label: 'Con beca parcial', fijo: false, usos: 1 });
  });

  it('las opciones fijas van primero y las nuevas se ordenan por uso', async () => {
    await upsertOpciones('barrio', ['Villa Crespo', 'Boedo', 'Villa Crespo', 'Villa Crespo'], UID);
    const valores = await leerOpciones('barrio');
    expect(valores.map((v) => v.slug)).toEqual(['villa-crespo', 'boedo']);
  });

  it('crea el documento del campo si no existía', async () => {
    await limpiarFirestore();
    const slug = await upsertOpcion('plataforma', 'Discord', UID);
    expect(slug).toBe('discord');
    const snap = await getDoc(doc(db(), 'opciones', 'plataforma'));
    expect(snap.exists()).toBe(true);
    // Sembró también las base junto con la nueva.
    const slugs = (snap.data()!.valores as { slug: string }[]).map((v) => v.slug);
    expect(slugs).toContain('zoom');
    expect(slugs).toContain('discord');
  });

  it('rechaza una etiqueta que se normaliza a vacío', async () => {
    await expect(upsertOpcion('barrio', '¡!¿?', UID)).rejects.toThrow();
  });
});

/**
 * §4.3 — aprobación de opciones. Ahora hay dos cuentas con claim `admin`
 * cargando actividades, así que una etiqueta nueva no puede aparecer en el
 * desplegable de la otra persona antes de que alguien la valide.
 *
 * La aprobación se ejecuta corriendo el script de verdad
 * (`scripts/aprobar-opciones.mjs`) contra el emulador: es la única forma de
 * saber que el camino que se va a usar en producción funciona, no solo que la
 * intención estaba bien (§ "verificar contra el sistema real" de 05-patrones).
 */
describe.skipIf(!vivo)('aprobación de taxonomías — §4.3', () => {
  const correrScript = (...args: string[]) =>
    execFileSync('node', ['scripts/aprobar-opciones.mjs', ...args], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, FIRESTORE_EMULATOR_HOST: HOST_FIRESTORE },
      encoding: 'utf8',
    });

  beforeAll(async () => {
    await limpiarFirestore();
    await entrarComoAdmin(UID);
    await sembrarBase();
  }, 30_000);

  it('una opción creada con "Otro" nace pendiente y con la huella de su autor', async () => {
    await upsertOpcion('arancel', 'Con beca parcial', UID);
    const nueva = (await valoresCrudos('arancel')).find((v) => v.slug === 'con-beca-parcial')!;
    expect(nueva.aprobada).toBe(false);
    expect(nueva.huellaCreador).toBe(huellaCreador(UID));
    // §5.1 — este documento es de lectura pública: el uid no puede estar ahí.
    expect(JSON.stringify(nueva)).not.toContain(UID);
  });

  it('funciona para quien la creó y no aparece en el desplegable de la otra cuenta', async () => {
    const valores = await leerOpciones('arancel');
    expect(opcionesVisibles(valores, UID).map((v) => v.slug)).toContain('con-beca-parcial');
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).not.toContain(
      'con-beca-parcial',
    );
    // Tampoco en el events.json, que se genera sin usuario (§4.4).
    expect(opcionesVisibles(valores).map((v) => v.slug)).not.toContain('con-beca-parcial');
  });

  it('registrar el uso de una opción base no la vuelve pendiente ni le pone autor', async () => {
    await upsertOpcion('arancel', 'Gratis', UID);
    const gratis = (await valoresCrudos('arancel')).find((v) => v.slug === 'gratis')!;
    expect(gratis.aprobada).toBe(true);
    expect(gratis.huellaCreador).toBeUndefined();
    expect(gratis.usos).toBe(1);
  });

  it('el script la aprueba', () => {
    expect(correrScript('arancel', 'con-beca-parcial')).toContain(
      'aprobada -> arancel/con-beca-parcial',
    );
  });

  it('aprobada, la ve la otra cuenta y el sitio público, sin perder usos ni autor', async () => {
    const valores = await leerOpciones('arancel');
    const aprobada = valores.find((v) => v.slug === 'con-beca-parcial')!;
    expect(estaAprobada(aprobada)).toBe(true);
    expect(aprobada.usos).toBe(1);
    expect(aprobada.huellaCreador).toBe(huellaCreador(UID));
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).toContain('con-beca-parcial');
    expect(opcionesVisibles(valores).map((v) => v.slug)).toContain('con-beca-parcial');
  });

  it('aprobar dos veces no rompe nada: el script es idempotente', () => {
    expect(correrScript('arancel', 'con-beca-parcial')).toContain('ya estaba aprobada');
  });

  it('rechaza un slug que no existe, sin tocar el resto del array', async () => {
    expect(() => correrScript('arancel', 'no-existe')).toThrow();
    expect((await valoresCrudos('arancel')).map((v) => v.slug)).not.toContain('no-existe');
  });

  it('--listar muestra las pendientes y solo esas', async () => {
    await upsertOpciones('tags', ['Narrativa'], UID);
    const salida = correrScript('--listar');
    expect(salida).toContain('opciones/tags');
    expect(salida).toContain('narrativa');
    // Ya aprobada: no puede seguir apareciendo como pendiente.
    expect(salida).not.toContain('con-beca-parcial');
  });

  /**
   * El caso de producción: los documentos de `/opciones/*` que ya están
   * cargados no tienen el campo `aprobada`. No pueden desaparecer del
   * desplegable de nadie por eso.
   */
  it('las opciones que ya estaban cargadas sin el campo siguen visibles para todos', async () => {
    await setDoc(doc(db(), 'opciones', 'barrio'), {
      valores: [
        // Exactamente la forma que tienen hoy en producción: sin `aprobada`.
        { slug: 'villa-crespo', label: 'Villa Crespo', orden: 99, fijo: false, usos: 4 },
      ],
    });
    const valores = await leerOpciones('barrio');
    expect(valores[0]!.aprobada).toBeUndefined();
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).toEqual(['villa-crespo']);
    expect(opcionesVisibles(valores).map((v) => v.slug)).toEqual(['villa-crespo']);
  });

  it('--backfill hace explícito ese default sin cambiar la visibilidad', async () => {
    expect(correrScript('--backfill')).toContain('opciones/barrio');
    const valores = await valoresCrudos('barrio');
    expect(valores.find((v) => v.slug === 'villa-crespo')!.aprobada).toBe(true);
    expect(opcionesVisibles(valores, UID_OTRO).map((v) => v.slug)).toEqual(['villa-crespo']);
    // Y no despierta lo que está pendiente a propósito.
    expect((await valoresCrudos('tags')).find((v) => v.slug === 'narrativa')!.aprobada).toBe(
      false,
    );
  });
});
