/**
 * B-89 — borrar una actividad dejaba huérfana su subcolección `versiones`.
 *
 * Este archivo prueba la decisión pura de `functions/limpieza-versiones.js`
 * (`decidirPurga`): qué subcolección huérfana ya venció su margen de rescate. El
 * pegamento con Firestore (`versiones-limpieza-trigger.js`) no se prueba acá —
 * mismo criterio que `tests/limpieza-imagenes.test.ts`— pero sí se prueba, contra
 * el emulador, la única pieza que no se puede razonar sin él:
 * `subcoleccionesHuerfanas`, o sea que `listDocuments()` de verdad devuelva las
 * referencias fantasma que un `deleteDoc` deja atrás. De eso depende todo lo
 * demás, y es una promesa de la API, no del código de este repo.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  MARGEN_DE_RESCATE_MS,
  MAX_ACTIVIDADES_POR_CORRIDA,
  decidirPurga,
  subcoleccionesHuerfanas,
} from '../functions/limpieza-versiones.js';
import { HOST_FIRESTORE, PROJECT_ID, emuladorVivo, limpiarFirestore } from './emulador';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-10-10T12:00:00Z');
const VENCIDA = AHORA - MARGEN_DE_RESCATE_MS - DIA;
const RECIENTE = AHORA - DIA;

/** Una versión con la forma que `guardarVersion` escribe, reducida a lo que se lee. */
const version = (id: string, guardadoEn: number) => ({
  id,
  // Un `Timestamp` de Firestore se lee con `toMillis`, que es lo que `milisDe`
  // resuelve. Se arma el mínimo, igual que hacen los tests de `calendario.js`.
  guardadoEn: { toMillis: () => guardadoEn },
});

describe('decidirPurga — qué subcolección huérfana ya venció (B-89)', () => {
  it('una huérfana con la versión más nueva vencida se purga entera', () => {
    // Mutación: sacar el `if` del margen. Este caso sigue verde, pero el de
    // abajo (la reciente) se pone rojo — que es el par que importa.
    const { aPurgar, motivos } = decidirPurga({
      huerfanas: [
        {
          actividadId: 'act_borrada',
          versiones: [version('v1', VENCIDA - DIA), version('v2', VENCIDA)],
        },
      ],
      ahora: AHORA,
    });
    expect(aPurgar).toEqual([{ actividadId: 'act_borrada', versiones: ['v1', 'v2'] }]);
    expect(motivos['act_borrada']).toBe('huerfana-vencida');
  });

  it('una huérfana recién borrada NO se purga — el margen de rescate', () => {
    /*
     * Es el caso que la guarda existe para cubrir, y es lo que hace que este
     * barrido no deje inerte al arreglo de B-41: la versión que escribe
     * `guardarVersionAlBorrar` es la única de la que se puede recuperar la
     * actividad entera, y purgarla en el acto sería borrar lo que se acaba de
     * guardar para poder recuperar.
     *
     * Mutación: sacar el `if` del margen. Este caso se pone rojo.
     */
    const { aPurgar, motivos } = decidirPurga({
      huerfanas: [{ actividadId: 'act_recien_borrada', versiones: [version('v1', RECIENTE)] }],
      ahora: AHORA,
    });
    expect(aPurgar).toEqual([]);
    expect(motivos['act_recien_borrada']).toBe('dentro-del-margen-de-rescate');
  });

  it('manda la versión MÁS NUEVA, no la primera del array', () => {
    /*
     * El orden de `versiones` viene de la query y no está garantizado que sea el
     * cronológico. Con una vieja al lado de una nueva, la que decide es la nueva:
     * si mandara la primera, una actividad borrada hoy con historial de hace un
     * año se purgaría en el acto.
     *
     * Mutación: cambiar `Math.max` por `instantes[0]`. Este caso se pone rojo.
     */
    const { aPurgar } = decidirPurga({
      huerfanas: [
        {
          actividadId: 'act_mezclada',
          versiones: [version('v_vieja', VENCIDA), version('v_nueva', RECIENTE)],
        },
      ],
      ahora: AHORA,
    });
    expect(aPurgar).toEqual([]);
  });

  it('una versión sin fecha legible bloquea la purga de esa actividad', () => {
    /*
     * Falla cerrado. Sin fecha no se puede afirmar que el rescate venció, y lo
     * que está en juego es la única copia de una actividad borrada: el error
     * caro es borrar de más, no de menos.
     *
     * Mutación: reemplazar el `some(t => t === null)` por `?? 0`. Este caso pasa
     * a purgarse y el test lo nota.
     */
    for (const rota of [undefined, null, 'no es una fecha', {}]) {
      const { aPurgar, motivos } = decidirPurga({
        huerfanas: [
          {
            actividadId: 'act_rota',
            versiones: [version('v1', VENCIDA), { id: 'v2', guardadoEn: rota }],
          },
        ],
        ahora: AHORA,
      });
      expect(aPurgar, String(rota)).toEqual([]);
      expect(motivos['act_rota'], String(rota)).toBe('sin-fecha-legible');
    }
  });

  it('una subcolección vacía no produce ninguna operación', () => {
    const { aPurgar, motivos } = decidirPurga({
      huerfanas: [{ actividadId: 'act_vacia', versiones: [] }],
      ahora: AHORA,
    });
    expect(aPurgar).toEqual([]);
    expect(motivos['act_vacia']).toBe('sin-versiones');
  });

  it('el tope corta la lista y deja el motivo de lo que quedó pendiente', () => {
    const huerfanas = Array.from({ length: MAX_ACTIVIDADES_POR_CORRIDA + 3 }, (_, i) => ({
      actividadId: `act_${i}`,
      versiones: [version('v1', VENCIDA)],
    }));
    const { aPurgar, motivos } = decidirPurga({ huerfanas, ahora: AHORA });

    expect(aPurgar).toHaveLength(MAX_ACTIVIDADES_POR_CORRIDA);
    // Y los motivos de TODO lo revisado quedan: el log tiene que poder decir qué
    // se salteó, no solo qué se purgó.
    expect(Object.keys(motivos)).toHaveLength(huerfanas.length);
    const pendientes = Object.values(motivos).filter((m) => m.endsWith('-pendiente-por-tope'));
    expect(pendientes).toHaveLength(3);
  });

  it('el margen es un parámetro: el test no espera 30 días', () => {
    // `05-patrones.md` § «El reloj también es infraestructura». Con el margen en
    // cero, la misma huérfana reciente de arriba se purga.
    const { aPurgar } = decidirPurga({
      huerfanas: [{ actividadId: 'act_recien_borrada', versiones: [version('v1', RECIENTE)] }],
      ahora: AHORA,
      margenMs: 0,
    });
    expect(aPurgar).toEqual([{ actividadId: 'act_recien_borrada', versiones: ['v1'] }]);
  });

  it('el margen por default es de 30 días', () => {
    // Fija la decisión: si alguien lo baja a horas, el rescate del borrado deja
    // de existir en la práctica y nada más lo diría.
    expect(MARGEN_DE_RESCATE_MS).toBe(30 * DIA);
  });
});

/**
 * La clase, no la instancia: **toda subcolección que cuelgue de una actividad
 * tiene que estar en el barrido**, porque ninguna se borra sola con el documento
 * padre. Hoy es una (`versiones`); la segunda que aparezca entra por acá o este
 * chequeo la nombra.
 *
 * La lista se **deriva del fuente** —los paths `actividades/{...}/<sub>` que el
 * código escribe— y no se mantiene a mano: es la propiedad 1 de
 * `05-patrones.md` § «Verificar la clase, no la instancia».
 */
const fuente = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const ARCHIVOS_QUE_ESCRIBEN_SUBCOLECCIONES = [
  'functions/historial-trigger.js',
  'functions/limpieza-versiones.js',
  'functions/versiones-limpieza-trigger.js',
  'src/lib/historial.ts',
];

/**
 * Las subcolecciones de una actividad que el código nombra, por las dos formas
 * en que el repo las escribe:
 *
 *  - el literal en el path — `actividades/${id}/versiones` (`historial-trigger.js`);
 *  - la constante `SUB`, que es la convención cuando el path se arma por partes
 *    — `collection(db(), COL, id, SUB)` en `src/lib/historial.ts`, y
 *    `actividades/${actividadId}/${SUB}` en el barrido.
 *
 * Las dos son necesarias: con solo la primera, una subcolección nueva declarada
 * como constante pasaría de largo, y es justo la forma que usa el panel.
 */
const subcoleccionesDeActividad = (): string[] => {
  const nombres = new Set<string>();
  for (const archivo of ARCHIVOS_QUE_ESCRIBEN_SUBCOLECCIONES) {
    const src = fuente(archivo);
    for (const m of src.matchAll(/actividades\/\$\{[^}]+\}\/([a-z][\w-]*)/g)) {
      nombres.add(m[1]!);
    }
    for (const m of src.matchAll(/const SUB(?:\w*)? = '([^']+)'/g)) {
      nombres.add(m[1]!);
    }
  }
  return [...nombres];
};

describe('clase de B-89 · ninguna subcolección de una actividad se queda sin barrido', () => {
  it('el descubrimiento sigue encontrando lo que hay', () => {
    // Sin esto el chequeo de abajo recorrería una lista vacía y pasaría en verde
    // sin verificar nada — el modo de falla que este repo ya pagó dos veces.
    const encontradas = subcoleccionesDeActividad();
    expect(encontradas.length).toBeGreaterThan(0);
    expect(encontradas).toContain('versiones');

    // Y las dos formas se ven por separado: si una de las dos ramas del
    // descubrimiento se apagara, la otra sola seguiría dando verde con la lista
    // llena, que es un falso verde.
    const soloLiteral = /actividades\/\$\{[^}]+\}\/([a-z][\w-]*)/.exec(
      fuente('functions/historial-trigger.js'),
    );
    expect(soloLiteral?.[1]).toBe('versiones');
    const soloConstante = /const SUB(?:\w*)? = '([^']+)'/.exec(fuente('src/lib/historial.ts'));
    expect(soloConstante?.[1]).toBe('versiones');
  });

  it('B-89: la subcolección que el código escribe es la que el barrido purga', () => {
    /*
     * El barrido borra `SUB`, y `SUB` es `'versiones'`. Si mañana alguien agrega
     * `actividades/{id}/adjuntos`, este chequeo lo nombra: no hay ninguna
     * Function que la borre, así que sobreviviría al borrado de su actividad
     * exactamente como sobrevivía `versiones`.
     */
    const declarada = /const SUB = '([^']+)'/.exec(fuente('functions/versiones-limpieza-trigger.js'));
    expect(declarada?.[1]).toBe('versiones');

    expect(subcoleccionesDeActividad()).toEqual([declarada![1]!]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Contra el emulador: que los fantasmas existan de verdad
// ─────────────────────────────────────────────────────────────────────

const vivo = await emuladorVivo();

describe.skipIf(!vivo)('subcoleccionesHuerfanas contra el emulador (B-89)', () => {
  let app: ReturnType<typeof initAdmin>;
  let db: ReturnType<typeof getAdminFirestore>;

  beforeAll(async () => {
    process.env.FIRESTORE_EMULATOR_HOST = HOST_FIRESTORE;
    await limpiarFirestore();
    app = initAdmin({ projectId: PROJECT_ID }, `huerfanas-${Date.now()}`);
    db = getAdminFirestore(app);
  }, 30_000);

  afterAll(async () => {
    if (app) await deleteAdminApp(app);
  });

  it('encuentra la referencia fantasma que deja borrar una actividad con versiones', async () => {
    /*
     * Esto es lo que ningún test puro puede afirmar, y de lo que depende todo el
     * barrido: que `listDocuments()` devuelva la referencia de un documento que
     * **no existe** pero tiene subcolección. Es una promesa de la API de
     * Firestore, no del código de este repo, así que se verifica contra el
     * emulador y no se asume.
     */
    const viva = db.collection('actividades').doc('act_viva');
    const borrada = db.collection('actividades').doc('act_borrada');

    await viva.set({ titulo: 'sigue existiendo' });
    await viva.collection('versiones').doc('v1').set({ guardadoEn: new Date() });

    await borrada.set({ titulo: 'se va a borrar' });
    await borrada.collection('versiones').doc('v1').set({ guardadoEn: new Date() });
    await borrada.delete(); // `deleteDoc` NO borra la subcolección: ahí está el bug

    const huerfanas: { id: string }[] = await subcoleccionesHuerfanas(db);
    expect(huerfanas.map((r) => r.id)).toEqual(['act_borrada']);

    // Y la subcolección sigue ahí, que es exactamente lo que B-89 reporta.
    const quedaron = await borrada.collection('versiones').get();
    expect(quedaron.size).toBe(1);
  });

  it('una actividad viva nunca es candidata, tenga versiones o no', async () => {
    const huerfanas: { id: string }[] = await subcoleccionesHuerfanas(db);
    expect(huerfanas.map((r) => r.id)).not.toContain('act_viva');
  });
});
