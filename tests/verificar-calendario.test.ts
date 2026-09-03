/**
 * `scripts/verificar-calendario.mjs` — el pegamento de la otra mitad de
 * B-125 (D-293). La lógica de decisión ya está testeada sin red en
 * `tests/reconciliacion.test.ts`; acá se testea la **orquestación**
 * (Firestore + Calendar + la reparación) con un `db` y un `cal` de mentira,
 * sin tocar el emulador ni, sobre todo, el calendario real — no hay
 * emulador de Calendar, así que esto es lo más cerca que se puede probar sin
 * red (CLAUDE.md §10).
 */
import { describe, expect, it } from 'vitest';
import { cuerpoDeCreacion, ejecutarVerificacion } from '../scripts/verificar-calendario.mjs';
import { cicloDeOcho, sesionesDeCiclo } from './fixtures/ciclo';

/**
 * Lo encontró el `auditor-trampas`: la primera versión mandaba `id: eventId`
 * literal siempre, así que un `eventId` null (una sesión cuyo id no tiene la
 * forma `ses_<uuid>`, como los ids `ses_0001` de los fixtures de este mismo
 * archivo) mandaba `id: null` a la API en vez de omitir el campo — que es lo
 * que hace `crearEvento` en `functions/index.js` en el mismo caso.
 */
describe('cuerpoDeCreacion — el `id` propuesto solo va si se pudo derivar', () => {
  it('con un id, lo incluye', () => {
    expect(cuerpoDeCreacion('evtnuevo', { summary: 'x' })).toEqual({
      summary: 'x',
      id: 'evtnuevo',
    });
  });

  it('sin id (null), NO manda el campo — ni siquiera en null', () => {
    const cuerpo = cuerpoDeCreacion(null, { summary: 'x' });
    expect(cuerpo).toEqual({ summary: 'x' });
    expect('id' in cuerpo).toBe(false);
  });
});

/** Firestore de mentira: alcanza con lo que `ejecutarVerificacion` usa. */
const dbFake = (actividades: Array<Record<string, unknown>>) => {
  // Copia superficial, no `structuredClone`: los Timestamp del fixture
  // (`ts()`) llevan funciones (`toDate`/`toMillis`), que no son clonables
  // estructuralmente. Alcanza con una copia superficial porque nada de este
  // flujo muta un array de sesiones in-place — `reponerIds` devuelve uno
  // nuevo (§7.2, trampa 2 al revés: nunca se pisa por índice).
  const documentos = new Map(actividades.map((a) => [a.id as string, { ...a }]));
  // La query real es `.collection(...).where(...).orderBy(FieldPath.
  // documentId()).startAfter(cursor)?.get()`. El fake ordena siempre por id
  // (ignora el argumento de `orderBy`, que en la vida real es
  // `FieldPath.documentId()` y acá no hace falta simular) y filtra por
  // `startAfter` cuando se llama — es lo mínimo para probar el cursor de
  // B-125/D-293 sin un Firestore de verdad.
  const ordenar = (docs: any[]) => docs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    documentos,
    collection: () => ({
      where: () => ({
        orderBy: () => {
          let despuesDe: string | undefined;
          const query = {
            startAfter: (cursor: string) => {
              despuesDe = cursor;
              return query;
            },
            get: async () => ({
              docs: ordenar([...documentos.values()].filter((d: any) => d.estado === 'publicado'))
                .filter((d: any) => !despuesDe || d.id > despuesDe)
                .map((d: any) => ({ id: d.id, data: () => d })),
            }),
          };
          return query;
        },
      }),
    }),
    doc: (path: string) => {
      const id = path.split('/')[1]!;
      return { id };
    },
    runTransaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: async (ref: { id: string }) => ({
          exists: documentos.has(ref.id),
          data: () => documentos.get(ref.id),
        }),
        update: (ref: { id: string }, campos: Record<string, unknown>) => {
          const actual = documentos.get(ref.id);
          documentos.set(ref.id, { ...actual, ...campos });
        },
      };
      return fn(tx);
    },
  };
};

/**
 * Calendar de mentira: `existentes` es el set de `calendarEventId` que
 * Calendar dice que tiene; `codigos` fuerza una respuesta de error puntual
 * (para el caso "desconocido").
 */
const calFake = (existentes: Set<string>, codigos: Map<string, number> = new Map()) => ({
  obtener: async (eventId: string) => {
    if (codigos.has(eventId)) return { ok: false, code: codigos.get(eventId) };
    return existentes.has(eventId) ? { ok: true, data: { status: 'confirmed' } } : { ok: false, code: 404 };
  },
  crear: async (eventId: string | null, _evento: unknown) => {
    const id = eventId ?? `nuevo_${Math.random().toString(36).slice(2)}`;
    existentes.add(id);
    return { data: { id } };
  },
});

const labels = { arancel: {}, tipo: {}, barrio: {}, plataforma: {}, tags: {} };

describe('ejecutarVerificacion — detecta y, si se pide, repara (B-125, D-293)', () => {
  it('detecta un evento borrado a mano SIN reparar por default: no escribe nada', async () => {
    const actividad = { id: 'act1', ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 3 }) }) };
    const sesiones = actividad.sesiones as Array<{ id: string; calendarEventId: string }>;
    const existentes = new Set(sesiones.map((s) => s.calendarEventId));
    existentes.delete(sesiones[1]!.calendarEventId); // el segundo, "borrado a mano"

    const db = dbFake([actividad]);
    const resumen = await ejecutarVerificacion({
      db,
      cal: calFake(existentes),
      labels,
      reparar: false,
    });

    expect(resumen.verificados).toBe(3);
    expect(resumen.borradosAMano).toHaveLength(1);
    expect(resumen.borradosAMano[0]!.sesion.id).toBe(sesiones[1]!.id);
    expect(resumen.reparados).toHaveLength(0);

    // Nada se tocó: el documento sigue con el id viejo.
    const guardado = db.documentos.get('act1') as any;
    expect(guardado.sesiones[1].calendarEventId).toBe(sesiones[1]!.calendarEventId);
  });

  it('con --reparar: recrea el evento borrado y escribe el calendarEventId nuevo en Firestore', async () => {
    const actividad = { id: 'act1', ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 3 }) }) };
    const sesiones = actividad.sesiones as Array<{ id: string; calendarEventId: string }>;
    const idViejo = sesiones[1]!.calendarEventId;
    const existentes = new Set(sesiones.map((s) => s.calendarEventId));
    existentes.delete(idViejo);

    const db = dbFake([actividad]);
    const resumen = await ejecutarVerificacion({
      db,
      cal: calFake(existentes),
      labels,
      reparar: true,
    });

    expect(resumen.reparados).toHaveLength(1);
    expect(resumen.fallidos).toHaveLength(0);

    const guardado = db.documentos.get('act1') as any;
    const sesionReparada = guardado.sesiones.find((s: any) => s.id === sesiones[1]!.id);
    // No alcanza con "no es null" — el id viejo tampoco lo era. La guarda que
    // importa es que el documento quedó con el id NUEVO que Calendar asignó,
    // no con el que ya no existía.
    expect(sesionReparada.calendarEventId).toBe(resumen.reparados[0]!.eventId);
    expect(sesionReparada.calendarEventId).not.toBe(idViejo);
    // Las otras dos sesiones no se tocaron.
    const otras = guardado.sesiones.filter((s: any) => s.id !== sesiones[1]!.id);
    expect(otras.map((s: any) => s.calendarEventId)).toEqual(
      sesiones.filter((s) => s.id !== sesiones[1]!.id).map((s) => s.calendarEventId),
    );
  });

  it('un código de error ambiguo (403) no se reporta como borrado ni se repara', async () => {
    const actividad = { id: 'act1', ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 2 }) }) };
    const sesiones = actividad.sesiones as Array<{ id: string; calendarEventId: string }>;
    const existentes = new Set(sesiones.map((s) => s.calendarEventId));
    const codigos = new Map([[sesiones[0]!.calendarEventId, 403]]);

    const db = dbFake([actividad]);
    const resumen = await ejecutarVerificacion({
      db,
      cal: calFake(existentes, codigos),
      labels,
      reparar: true,
    });

    expect(resumen.borradosAMano).toHaveLength(0);
    expect(resumen.desconocidos).toHaveLength(1);
    expect(resumen.desconocidos[0]!.sesion.id).toBe(sesiones[0]!.id);
    expect(resumen.reparados).toHaveLength(0);
    const guardado = db.documentos.get('act1') as any;
    expect(guardado.sesiones).toEqual(actividad.sesiones);
  });

  it('todo existe: no hay nada que reparar y el resumen lo dice en cero', async () => {
    const actividad = { id: 'act1', ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 4 }) }) };
    const sesiones = actividad.sesiones as Array<{ calendarEventId: string }>;
    const existentes = new Set(sesiones.map((s) => s.calendarEventId));

    const resumen = await ejecutarVerificacion({
      db: dbFake([actividad]),
      cal: calFake(existentes),
      labels,
      reparar: true,
    });

    expect(resumen).toMatchObject({ verificados: 4, borradosAMano: [], reparados: [] });
  });

  /**
   * Lo encontró el `auditor-trampas` (P1): sin cursor real, correr el script
   * de nuevo repetía siempre las mismas primeras candidatas. Esto prueba el
   * camino completo —Firestore de mentira incluido— y no solo la función pura
   * `sesionesAVerificar`: que pasar `desde: resumen.siguienteCursor` a la
   * segunda corrida de verdad avanza a las actividades siguientes.
   */
  it('con --desde, la corrida siguiente avanza en vez de repetir las mismas candidatas', async () => {
    // 30 actividades de 8 sesiones = 240 candidatas > 200 (el tope real de
    // `functions/reconciliacion.js`): el corte cae justo en 25 actividades.
    // Los ids de sesión/evento de `sesionesDeCiclo` son locales a cada
    // actividad (`ses_0001`, `evt_0001`…) y se repiten entre actividades —a
    // propósito, es el mismo fixture que usa el resto de la suite—, así que
    // la garantía que se puede afirmar acá es por **cantidad** y por
    // **actividad** (que sí son únicas: `act00`…`act29`), no comparando ids
    // de evento crudos entre las dos corridas.
    const actividades = Array.from({ length: 30 }, (_, i) => ({
      id: `act${String(i).padStart(2, '0')}`,
      ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 8 }) }),
    }));
    const todosLosIds = new Set(
      actividades.flatMap((a: any) => a.sesiones.map((s: any) => s.calendarEventId)),
    );

    const db = dbFake(actividades);
    const primera = await ejecutarVerificacion({ db, cal: calFake(todosLosIds), labels, reparar: false });
    expect(primera.truncado).toBe(true);
    expect(primera.siguienteCursor).toBe('act24'); // 25 × 8 = 200
    expect(primera.verificados).toBe(200);

    // Sin `desde`: la corrida "de nuevo" ingenua repetiría las mismas 200 —
    // es exactamente el bug que encontró el auditor. Se prueba explícito.
    const repetida = await ejecutarVerificacion({ db, cal: calFake(todosLosIds), labels, reparar: false });
    expect(repetida.verificados).toBe(200);
    expect(repetida.siguienteCursor).toBe(primera.siguienteCursor);

    // Con `desde`, en cambio, avanza: cubre las 40 que faltaban y no trunca.
    const segunda = await ejecutarVerificacion({
      db,
      cal: calFake(todosLosIds),
      labels,
      reparar: false,
      desde: primera.siguienteCursor,
    });
    expect(segunda.verificados).toBe(40); // 240 − 200
    expect(segunda.truncado).toBe(false);
    expect(primera.verificados + segunda.verificados).toBe(240);
  });
});
