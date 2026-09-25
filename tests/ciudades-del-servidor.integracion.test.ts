/**
 * **La corrección de `ciudades`, contra el emulador** — B-1920.
 *
 * `corregirDerivados` (era `corregirCiudades` hasta B-2050, que le sumó los otros
 * cuatro derivados: `derivados-del-servidor.integracion.test.ts`) es lo que corre `syncCalendar` con el `db` del Admin SDK
 * cuando `ciudadesDesalineadas` dice que el documento se escribió con un
 * `ciudades` que no es el de sus filas. El CI no levanta el emulador de Functions
 * (D-660), así que se prueba la mitad que sí se puede —la transacción de verdad,
 * con el Admin SDK de verdad, sobre el emulador de Firestore—, que es donde vive
 * lo que la lógica pura no ve: la relectura, el documento que se borró en el
 * medio, y que la segunda pasada **no escriba**. La decisión y el cableado están
 * en `ciudades-del-servidor.test.ts`.
 *
 * Que la regla deje pasar el `ciudades` inventado es el agujero que B-1920
 * describe y no se reprueba acá: `dentroDeSuCiudad()` está cubierta cláusula por
 * cláusula en `rol-publicador.integracion.test.ts`.
 *
 * Se saltea si el emulador no está corriendo (`npm run emu`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { buildSearchText } from '../functions/busqueda.js';
import { ciudadesDesalineadas } from '../functions/ciudades.js';
import { derivadosDesalineados } from '../functions/derivados.js';
import { corregirDerivados } from '../functions/derivados-firestore.js';
import { camposCambiados } from '../functions/historial.js';
import { PROJECT_ID, emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

/** El `searchText` que el panel escribe para este documento (§6). */
const conIndice = <T extends Record<string, unknown>>(doc: T): T & { searchText: string } => ({
  ...doc,
  searchText: buildSearchText(doc as Parameters<typeof buildSearchText>[0]),
});

const sede = (ciudad: string) => ({
  nombre: 'Biblioteca popular',
  direccion: 'Calle 1',
  provincia: 'santa-fe',
  barrio: '',
  ciudad,
  indicaciones: '',
  geo: null,
});

/**
 * Un documento que un publicador de Mar del Plata armó a mano con el SDK. Los
 * otros cuatro derivados están bien (B-2050): acá se mide solo `ciudades`.
 */
const mentido = () => conIndice({
  titulo: 'Club de lectura',
  estado: 'publicado',
  createdBy: 'uid_pub_mdp',
  updatedBy: 'uid_pub_mdp',
  updatedAt: Timestamp.fromDate(new Date('2026-09-25T12:00:00Z')),
  modalidades: [
    { id: 'mod_1', modalidad: 'presencial', sede: sede('mar-del-plata'), online: null },
    { id: 'mod_2', modalidad: 'presencial', sede: sede('rosario'), online: null },
  ],
  modalidad: 'presencial',
  sede: sede('mar-del-plata'),
  online: null,
  // La segunda sede no se sumó: la regla lee «solo Mar del Plata».
  ciudades: ['mar-del-plata'],
});

describe.skipIf(!vivo)('la corrección de `ciudades` contra el emulador — B-1920', () => {
  let app: App;
  let db: Firestore;

  beforeAll(async () => {
    app = initializeApp({ projectId: PROJECT_ID }, `ciudades-b1920-${Date.now()}-${Math.random()}`);
    db = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  beforeEach(async () => {
    await limpiarFirestore();
  });

  it('corrige el campo a la derivación de las filas y no toca nada más', async () => {
    const ref = db.doc('actividades/act_mentida');
    await ref.set(mentido());

    const r = await corregirDerivados(db, 'act_mentida');
    expect(r?.campos).toEqual(['ciudades']);
    expect(r?.ciudadesGuardadas).toEqual(['mar-del-plata']);
    expect(r?.derivados.ciudades).toEqual(['mar-del-plata', 'rosario']);
    expect(r?.estado).toBe('publicado');

    const despues = (await ref.get()).data()!;
    expect(despues.ciudades).toEqual(['mar-del-plata', 'rosario']);
    // No despublica (la decisión de B-1920) y no se hace pasar por una edición:
    // `updatedBy` sigue siendo quien la escribió, que es a quien hay que mirar.
    const { ciudades: _a, ...resto } = despues;
    const { ciudades: _b, ...restoOriginal } = mentido();
    expect(resto).toEqual(restoOriginal);
  });

  /**
   * La guarda anti-loop medida sobre Firestore y no sobre un objeto: el
   * write-back vuelve a disparar el trigger, y en esa pasada no hay nada que
   * corregir ni que avisar. (Que el `updateTime` no cambie no mide la guarda: el
   * emulador no lo mueve con una escritura idéntica, y Firestore tampoco dispara
   * un trigger por ella. Se probó escribiendo siempre y quedó verde. Lo que la
   * guarda evita es el `null` de abajo: sin él, cada pasada mandaría el mail.)
   */
  it('la segunda pasada no escribe, y el write-back no es contenido para el historial', async () => {
    const ref = db.doc('actividades/act_mentida');
    await ref.set(mentido());
    const antes = (await ref.get()).data()!;
    await corregirDerivados(db, 'act_mentida');
    const corregido = await ref.get();

    expect(ciudadesDesalineadas(corregido.data())).toBeNull();
    expect(derivadosDesalineados(corregido.data())).toBeNull();
    expect(await corregirDerivados(db, 'act_mentida')).toBeNull();
    expect((await ref.get()).updateTime?.isEqual(corregido.updateTime!)).toBe(true);

    // Lo que ve `guardarVersion` en la pasada del write-back: nada que guardar.
    expect(camposCambiados(antes, corregido.data())).toEqual([]);
  });

  it('relee: si el panel guardó en el medio, deriva de lo que hay ahora', async () => {
    const ref = db.doc('actividades/act_mentida');
    await ref.set(mentido());
    // El panel guarda filas nuevas y su `ciudades`, juntos, antes de que corra
    // la corrección del evento anterior.
    const filas = [{ id: 'mod_3', modalidad: 'presencial', sede: sede('cordoba'), online: null }];
    await ref.update(
      conIndice({ ...mentido(), modalidades: filas, sede: sede('cordoba'), ciudades: ['cordoba'] }),
    );

    expect(await corregirDerivados(db, 'act_mentida')).toBeNull();
    expect((await ref.get()).data()!.ciudades).toEqual(['cordoba']);
  });

  it('un documento sin el campo lo recibe', async () => {
    const ref = db.doc('actividades/act_sin_campo');
    const { ciudades: _, ...sinCampo } = mentido();
    await ref.set(sinCampo);

    expect((await corregirDerivados(db, 'act_sin_campo'))?.ciudadesGuardadas).toBeNull();
    expect((await ref.get()).data()!.ciudades).toEqual(['mar-del-plata', 'rosario']);
  });

  it('un documento que se borró en el medio no se resucita', async () => {
    expect(await corregirDerivados(db, 'act_que_no_existe')).toBeNull();
    expect((await db.doc('actividades/act_que_no_existe').get()).exists).toBe(false);
  });
});
