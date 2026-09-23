/**
 * **La transacción de la callable del publicador, contra el emulador** — B-893.
 *
 * `aplicarAltaDeOpcion` es lo que corre `crearOpcionDelPanel` con el `db` del
 * Admin SDK. El CI no levanta el emulador de Functions (D-660), así que se prueba
 * **la mitad que sí se puede**: la transacción de verdad, con el Admin SDK de
 * verdad, sobre el emulador de Firestore — que es donde vive lo que la lógica
 * pura no puede ver (la lectura transaccional, dos altas simultáneas, el
 * documento que no existe). Lo que la callable agrega arriba —sesión, rol, App
 * Check— lo cubre `tests/alta-de-opcion-callable.test.ts` sobre el fuente.
 *
 * Que el publicador **siga sin poder escribir `/opciones/*` desde el cliente**
 * es de `tests/rol-publicador.integracion.test.ts` («lee /opciones como
 * cualquiera, pero no la escribe»), y sigue verde: B-893 no tocó la regla.
 *
 * Se saltea si el emulador no está corriendo (`npm run emu`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { aplicarAltaDeOpcion } from '../functions/alta-de-opcion-firestore.js';
import base from '@/lib/opciones-base.json';
import { huellaCreador } from '@/lib/huella';
import { slugify } from '@/lib/slugify';
import { opcionesVisibles } from '@/lib/taxonomia';
import type { ValorOpcion } from '@/types/actividad';
import { PROJECT_ID, emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

const UID_PUBLICADOR = 'uid_test_publicador_b893';
const UID_OTRO_PUBLICADOR = 'uid_test_publicador_b893_2';
// `arancel` y no `tags`: tiene opciones base, así que «no tocó nada más» mira algo.
const BASE = (base as Record<string, ValorOpcion[]>).arancel ?? [];

describe.skipIf(!vivo)('el alta de la callable contra el emulador — B-893', () => {
  let app: App;
  let db: Firestore;

  const valores = async (campo: string): Promise<ValorOpcion[]> =>
    ((await db.doc(`opciones/${campo}`).get()).data()?.valores ?? []) as ValorOpcion[];

  const alta = (label: string, uid = UID_PUBLICADOR, campo = 'arancel') =>
    aplicarAltaDeOpcion(db, {
      campo,
      label,
      slug: slugify(label),
      uid,
      aprobada: false,
    });

  beforeAll(async () => {
    app = initializeApp({ projectId: PROJECT_ID }, `alta-b893-${Date.now()}-${Math.random()}`);
    db = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  beforeEach(async () => {
    await limpiarFirestore();
    await db.doc('opciones/arancel').set({ valores: BASE, otroCampo: 'intacto' });
  });

  it('agrega UN elemento sin aprobar, con la huella de quien la creó, y no toca nada más', async () => {
    const r = await alta('Poesía joven');
    expect(r).toEqual({ slug: 'poesia-joven', creada: true });

    const despues = await valores('arancel');
    expect(despues.slice(0, -1)).toEqual(BASE);
    expect(despues.at(-1)).toEqual({
      slug: 'poesia-joven',
      label: 'Poesía joven',
      orden: 99,
      fijo: false,
      usos: 1,
      aprobada: false,
      huellaCreador: huellaCreador(UID_PUBLICADOR),
    });
    // `update({ valores })`, no `set`: el resto del documento sigue ahí.
    expect((await db.doc('opciones/arancel').get()).data()?.otroCampo).toBe('intacto');
  });

  it('le aparece a quien la creó y no a los demás, hasta que se apruebe', async () => {
    await alta('Slam');
    const todos = await valores('arancel');
    expect(opcionesVisibles(todos, UID_PUBLICADOR).map((v) => v.slug)).toContain('slam');
    expect(opcionesVisibles(todos, UID_OTRO_PUBLICADOR).map((v) => v.slug)).not.toContain('slam');
    // Y el sitio público (sin uid) tampoco la ve: `opcionesPublicas` filtra así.
    expect(opcionesVisibles(todos).map((v) => v.slug)).not.toContain('slam');
  });

  it('otra cuenta que la tipea la aprueba y la marca (B-29)', async () => {
    await alta('Slam');
    const r = await alta('SLAM', UID_OTRO_PUBLICADOR);
    expect(r).toEqual({ slug: 'slam', creada: false });
    const slam = (await valores('arancel')).find((v) => v.slug === 'slam');
    expect(slam).toMatchObject({
      usos: 2,
      aprobada: true,
      aprobadaPorReuso: true,
      huellaCreador: huellaCreador(UID_PUBLICADOR),
    });
  });

  it('dos altas simultáneas no se pisan: la transacción relee el array', async () => {
    const r = await Promise.all([alta('Uno'), alta('Dos'), alta('Tres')]);
    expect(r.map((x) => ('slug' in x ? x.slug : null)).sort()).toEqual(['dos', 'tres', 'uno']);
    const slugs = (await valores('arancel')).map((v) => v.slug);
    expect(slugs).toEqual(expect.arrayContaining(['uno', 'dos', 'tres']));
    expect(slugs).toHaveLength(BASE.length + 3);
  });

  it('sin documento no escribe nada, ni siquiera lo crea', async () => {
    const r = await alta('Algo', UID_PUBLICADOR, 'plataforma');
    expect(r.rechazo?.codigo).toBe('failed-precondition');
    expect((await db.doc('opciones/plataforma').get()).exists).toBe(false);
  });

  it('un documento con un slug repetido se deja como está', async () => {
    const repetido = [...BASE, { slug: 'x', label: 'X', orden: 99, fijo: false, usos: 1 }];
    await db.doc('opciones/arancel').set({ valores: [...repetido, repetido.at(-1)] });
    const r = await alta('x');
    expect(r.rechazo?.codigo).toBe('internal');
    expect(await valores('arancel')).toEqual([...repetido, repetido.at(-1)]);
  });
});
