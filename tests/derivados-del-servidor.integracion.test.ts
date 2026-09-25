/**
 * **La corrección de los derivados y la lectura del claim, contra el emulador** —
 * B-2050, B-2052.
 *
 * `corregirDerivados` es lo que corre `syncCalendar` con el `db` del Admin SDK
 * cuando `derivadosDesalineados` dice que el documento guarda una `sede`, una
 * `modalidad`, un `online` o un `searchText` que no son los de sus filas. El CI no
 * levanta el emulador de Functions (D-660), así que se prueba la mitad que sí se
 * puede: la transacción de verdad sobre el emulador de Firestore, y
 * `quienEscribioTieneCiudad` con el Admin SDK de verdad sobre el emulador de
 * Auth, que es donde vive lo que la lógica pura no ve —que `customClaims` llegue
 * con la forma que `setCustomUserClaims` escribió—. `ciudades` tiene su propio
 * archivo (`ciudades-del-servidor.integracion.test.ts`).
 *
 * Se saltea si los emuladores no están corriendo (`npm run emu`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { buildSearchText } from '../functions/busqueda.js';
import { quienEscribioTieneCiudad } from '../functions/claims-de-cuenta.js';
import { derivadosDesalineados } from '../functions/derivados.js';
import { corregirDerivados } from '../functions/derivados-firestore.js';
import { camposCambiados } from '../functions/historial.js';
import { linkDeReunionQueSale } from '@/lib/toPublic';
import {
  PROJECT_ID,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
  proyectoDeAuth,
} from './emulador';
import { tokenDe, uidDe } from './fixtures/credenciales-del-emulador';

const vivo = await emuladorVivo();
const authVivo = vivo && (await emuladorAuthVivo());

const sede = (nombre: string, ciudad: string) => ({
  nombre,
  direccion: 'Calle 1',
  provincia: 'santa-fe',
  barrio: '',
  ciudad,
  indicaciones: '',
  geo: null,
});

const privado = { plataforma: 'zoom', url: 'https://zoom.us/j/privado', urlPublica: false };

/** Un documento como lo deja el panel: los derivados salen de sus filas. */
const alineado = () => {
  const modalidades = [
    { id: 'mod_1', modalidad: 'presencial', sede: sede('Biblioteca popular', 'rosario'), online: null },
    { id: 'mod_2', modalidad: 'virtual', sede: null, online: privado },
  ];
  const base = {
    titulo: 'Club de lectura',
    descripcion: 'Leemos a Saer',
    estado: 'publicado',
    organizador: { nombre: 'La biblioteca', instagram: '', web: '' },
    tallerista: null,
    libro: null,
    createdBy: 'uid_pub',
    updatedBy: 'uid_pub',
    updatedAt: Timestamp.fromDate(new Date('2026-09-25T12:00:00Z')),
    modalidades,
    modalidad: 'hibrido',
    sede: modalidades[0]!.sede,
    online: privado,
    ciudades: ['rosario'],
  };
  return { ...base, searchText: buildSearchText(base) };
};

/** El mismo documento, armado a mano con el SDK: los cuatro derivados mienten. */
const mentido = () => ({
  ...alineado(),
  modalidad: 'presencial',
  sede: sede('Otra sede', 'rosario'),
  // Un link de raíz declarado público que ninguna fila tiene (§5.1).
  online: { plataforma: 'zoom', url: 'https://zoom.us/j/inventado', urlPublica: true },
  searchText: 'aparezco en toda busqueda',
});

describe.skipIf(!vivo)('la corrección de los derivados contra el emulador — B-2050', () => {
  let app: App;
  let db: Firestore;

  beforeAll(async () => {
    app = initializeApp({ projectId: PROJECT_ID }, `derivados-b2050-${Date.now()}-${Math.random()}`);
    db = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  beforeEach(async () => {
    await limpiarFirestore();
  });

  it('corrige los cuatro a la derivación de las filas y no toca nada más', async () => {
    const ref = db.doc('actividades/act_mentida');
    await ref.set(mentido());

    const r = await corregirDerivados(db, 'act_mentida');
    expect(r?.campos).toEqual(['modalidad', 'sede', 'online', 'searchText']);
    expect(r?.estado).toBe('publicado');

    const despues = (await ref.get()).data()!;
    // Queda exactamente como lo habría dejado el panel, `updatedBy` incluido: la
    // corrección no se hace pasar por una edición, y no despublica.
    expect(despues).toEqual(alineado());
  });

  it('el link que el documento declaraba público en la raíz deja de salir', async () => {
    const ref = db.doc('actividades/act_mentida');
    await ref.set(mentido());
    await corregirDerivados(db, 'act_mentida');
    expect(linkDeReunionQueSale((await ref.get()).data()!.online)).toBeNull();
  });

  /**
   * La guarda anti-loop medida sobre Firestore: en la pasada del write-back no
   * hay nada que corregir, y para el historial no hubo edición.
   */
  it('la segunda pasada no escribe, y el write-back no es contenido para el historial', async () => {
    const ref = db.doc('actividades/act_mentida');
    await ref.set(mentido());
    const antes = (await ref.get()).data()!;
    await corregirDerivados(db, 'act_mentida');
    const corregido = await ref.get();

    expect(derivadosDesalineados(corregido.data())).toBeNull();
    expect(await corregirDerivados(db, 'act_mentida')).toBeNull();
    expect((await ref.get()).updateTime?.isEqual(corregido.updateTime!)).toBe(true);
    expect(camposCambiados(antes, corregido.data())).toEqual([]);
  });

  it('relee: si el panel guardó en el medio, deriva de lo que hay ahora', async () => {
    const ref = db.doc('actividades/act_mentida');
    await ref.set(mentido());
    await ref.set(alineado());
    expect(await corregirDerivados(db, 'act_mentida')).toBeNull();
  });

  it('un documento que se borró en el medio no se resucita', async () => {
    expect(await corregirDerivados(db, 'act_que_no_existe')).toBeNull();
    expect((await db.doc('actividades/act_que_no_existe').get()).exists).toBe(false);
  });
});

describe.skipIf(!authVivo)('el claim de quien escribió, contra el emulador de Auth — B-2052', () => {
  let app: App;

  beforeAll(async () => {
    app = initializeApp({ projectId: await proyectoDeAuth() }, `claims-b2052-${Date.now()}-${Math.random()}`);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  it.each([
    ['la publicadora con ciudad', 'pub_mdp_b2052', { publicador: true, ciudad: 'mar-del-plata' }, true],
    ['la publicadora general', 'pub_gral_b2052', { publicador: true }, false],
    ['un admin', 'admin_b2052', { admin: true }, false],
    ['una cuenta sin claims', 'nadie_b2052', {}, false],
  ])('%s → %s', async (_, base, claims, esperado) => {
    const uid = uidDe(base);
    await tokenDe(uid, claims);
    expect(await quienEscribioTieneCiudad(getAuth(app), uid)).toBe(esperado);
  });

  it('una cuenta que ya no existe tira, con un código y sin el uid en el código', async () => {
    const uid = uidDe('borrada_b2052');
    const err = await quienEscribioTieneCiudad(getAuth(app), uid).catch((e) => e);
    expect(err?.code).toBe('auth/user-not-found');
    expect(String(err.code)).not.toContain(uid);
  });
});
