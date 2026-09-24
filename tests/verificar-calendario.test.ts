/**
 * `scripts/verificar-calendario.mjs` — el pegamento de la otra mitad de
 * B-125 (D-293). La lógica de decisión ya está testeada sin red en
 * `tests/reconciliacion.test.ts`; acá se testea la **orquestación**
 * (Firestore + Calendar + la reparación) con un `db` y un `cal` de mentira,
 * sin tocar el emulador ni, sobre todo, el calendario real — no hay
 * emulador de Calendar, así que esto es lo más cerca que se puede probar sin
 * red (CLAUDE.md §10).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  camposDivergentes,
  cuerpoDeCreacion,
  ejecutarVerificacion,
  planificarReescritura,
} from '../scripts/verificar-calendario.mjs';
import { construirEvento } from '../functions/calendario.js';
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

// ── B-631 — ¿el evento dice lo mismo que el código de hoy? ─────────────────

/**
 * Cómo devuelve Calendar un `dateTime` que se le mandó en UTC: con el offset
 * de la zona del evento. `…T22:00:00.000Z` vuelve como `…T19:00:00-03:00`.
 * Argentina no tiene horario de verano, así que el offset es fijo.
 */
const comoLoDevuelveCalendar = (iso: string) =>
  new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().replace(/\.\d{3}Z$/, '-03:00');

/**
 * El cuerpo de un `events.get` para un evento al día: lo que `construirEvento`
 * mandó, con las fechas como las devuelve Calendar, sin los campos vacíos (que
 * Calendar omite) y con todo lo que Calendar agrega por su cuenta.
 */
const cuerpoDeCalendar = (evento: any) => ({
  kind: 'calendar#event',
  etag: '"3421"',
  id: 'evt',
  status: 'confirmed',
  created: '2026-08-01T12:00:00.000Z',
  updated: '2026-08-02T12:00:00.000Z',
  iCalUID: 'evt@google.com',
  sequence: 2,
  reminders: { useDefault: true },
  organizer: { email: 'x@group.calendar.google.com' },
  ...Object.fromEntries(Object.entries(evento).filter(([, v]) => v != null && v !== '')),
  start: { dateTime: comoLoDevuelveCalendar(evento.start.dateTime), timeZone: evento.start.timeZone },
  end: { dateTime: comoLoDevuelveCalendar(evento.end.dateTime), timeZone: evento.end.timeZone },
});

describe('camposDivergentes — compara lo que escribimos, no el evento entero (B-631)', () => {
  const actividad = cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 2 }) }) as any;
  const esperado = construirEvento(actividad, actividad.sesiones[0], labels) as any;

  it('al día: los campos que agrega Calendar (etag, sequence, reminders…) no cuentan', () => {
    expect(camposDivergentes(esperado, cuerpoDeCalendar(esperado))).toEqual([]);
  });

  it('trampa 1: el mismo instante con offset -03:00 es igual; la zona se compara tal cual', () => {
    const enCalendar = cuerpoDeCalendar(esperado);
    // El texto difiere del que mandamos y el instante es el mismo.
    expect(enCalendar.start.dateTime).not.toBe(esperado.start.dateTime);
    expect(camposDivergentes(esperado, enCalendar)).toEqual([]);

    const otraZona = { ...enCalendar, start: { ...enCalendar.start, timeZone: 'UTC' } };
    expect(camposDivergentes(esperado, otraZona)).toEqual(['start']);
  });

  it('trampa 1: la hora de pared cargada como UTC (corrida tres horas) sale divergente', () => {
    const enCalendar = cuerpoDeCalendar(esperado);
    // 19:00 de Buenos Aires guardado como 19:00Z: el bug clásico.
    const corrida = (t: { dateTime: string; timeZone: string }) => ({
      ...t,
      dateTime: t.dateTime.replace('-03:00', 'Z'),
    });
    expect(
      camposDivergentes(esperado, {
        ...enCalendar,
        start: corrida(enCalendar.start),
        end: corrida(enCalendar.end),
      }),
    ).toEqual(['start', 'end']);
  });

  it('un evento de día entero (`date`, sin `dateTime`) no pasa por igual', () => {
    const enCalendar = { ...cuerpoDeCalendar(esperado), start: { date: '2026-09-03' } };
    expect(camposDivergentes(esperado, enCalendar)).toEqual(['start']);
  });

  it('la descripción armada con el código de antes (B-162, D-95) sale divergente', () => {
    const enCalendar = { ...cuerpoDeCalendar(esperado), description: 'Encuentro 1 de 7' };
    expect(camposDivergentes(esperado, enCalendar)).toEqual(['description']);
  });

  it("vacío es vacío: `null`, `''` y el campo que Calendar omite valen lo mismo", () => {
    const sinUbicacion = { ...esperado, location: null, description: '' };
    const enCalendar = cuerpoDeCalendar(sinUbicacion) as any;
    expect('location' in enCalendar).toBe(false);
    expect('description' in enCalendar).toBe(false);
    expect(camposDivergentes(sinUbicacion, enCalendar)).toEqual([]);
    // Y al revés sí cuenta: Calendar tiene una sede que el código de hoy ya no pone.
    expect(camposDivergentes(sinUbicacion, { ...enCalendar, location: 'Corrientes 1234' })).toEqual([
      'location',
    ]);
  });

  it('las claves salen del evento esperado: un campo nuevo entra solo al chequeo (D-07)', () => {
    const conCampoNuevo = { ...esperado, colorId: '5' };
    expect(camposDivergentes(conCampoNuevo, cuerpoDeCalendar(esperado))).toEqual(['colorId']);
  });
});

describe('planificarReescritura — solo sobre lo que existe (B-631)', () => {
  const actividad = cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 3 }) }) as any;
  const candidatas = actividad.sesiones.map((sesion: any) => ({ actividadId: 'act1', actividad, sesion }));
  const construir = (a: any, s: any) => construirEvento(a, s, labels);
  const viejo = (s: any) => ({ ...cuerpoDeCalendar(construir(actividad, s)), summary: 'Título viejo' });

  it("no afirma divergencia sobre un 'no-existe' ni un 'desconocido'", () => {
    const [a, b, c] = actividad.sesiones;
    const resultados = new Map([
      [a.id, 'existe'],
      [b.id, 'no-existe'],
      [c.id, 'desconocido'],
    ]);
    const eventos = new Map(actividad.sesiones.map((s: any) => [s.id, viejo(s)]));
    const plan = planificarReescritura(candidatas, resultados, eventos, construir);
    expect(plan.map((p: any) => p.sesion.id)).toEqual([a.id]);
    expect(plan[0].campos).toEqual(['summary']);
    // El cuerpo a mandar es el del código de hoy, no el que tenía Calendar.
    expect(plan[0].evento).toEqual(construir(actividad, a));
  });

  it('una candidata sin resultado (corrida cortada) cuenta como desconocida', () => {
    const eventos = new Map(actividad.sesiones.map((s: any) => [s.id, viejo(s)]));
    expect(planificarReescritura(candidatas, new Map(), eventos, construir)).toEqual([]);
  });
});

/**
 * Calendar de mentira que devuelve el **cuerpo** del evento (B-631), como hace
 * `events.get` de verdad. `cuerpos` es `calendarEventId` → cuerpo; los que no
 * están dan 404. Registra las escrituras en orden.
 */
const calConCuerpos = (cuerpos: Map<string, any>, opciones: { fallaActualizar?: boolean } = {}) => {
  const escrituras: Array<{ verbo: string; eventId: string | null; evento: any }> = [];
  return {
    escrituras,
    obtener: async (eventId: string) =>
      cuerpos.has(eventId) ? { ok: true, data: cuerpos.get(eventId) } : { ok: false, code: 404 },
    crear: async (eventId: string | null, evento: unknown) => {
      escrituras.push({ verbo: 'crear', eventId, evento });
      return { ok: true, data: { id: eventId ?? `nuevo_${escrituras.length}` } };
    },
    actualizar: async (eventId: string, evento: unknown) => {
      escrituras.push({ verbo: 'actualizar', eventId, evento });
      return opciones.fallaActualizar
        ? { ok: false, code: 403, cuerpo: 'insufficient permission' }
        : { ok: true, data: {} };
    },
  };
};

describe('ejecutarVerificacion — reporta los desactualizados; reescribirlos es otro flag (B-631)', () => {
  /** Tres sesiones: la 0 al día, la 1 con la descripción vieja, la 2 borrada a mano. */
  const escenario = () => {
    const actividad = { id: 'act1', ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 3 }) }) } as any;
    const [s0, s1, s2] = actividad.sesiones;
    const cuerpos = new Map<string, any>([
      [s0.calendarEventId, cuerpoDeCalendar(construirEvento(actividad, s0, labels))],
      [
        s1.calendarEventId,
        { ...cuerpoDeCalendar(construirEvento(actividad, s1, labels)), description: 'Encuentro 2 de 7' },
      ],
    ]);
    return { actividad, s0, s1, s2, cuerpos };
  };

  it('sin flags: lista el desactualizado con sus campos y no escribe nada', async () => {
    const { actividad, s1, cuerpos } = escenario();
    const cal = calConCuerpos(cuerpos);
    const resumen = await ejecutarVerificacion({ db: dbFake([actividad]), cal, labels, reparar: false });

    expect(resumen.desactualizados.map((c: any) => [c.sesion.id, c.campos])).toEqual([
      [s1.id, ['description']],
    ]);
    expect(resumen.borradosAMano).toHaveLength(1);
    expect(resumen.reescritos).toEqual([]);
    expect(cal.escrituras).toEqual([]);
  });

  it('--reparar solo recrea el borrado: NO reescribe el desactualizado', async () => {
    const { actividad, s2, cuerpos } = escenario();
    const cal = calConCuerpos(cuerpos);
    const resumen = await ejecutarVerificacion({ db: dbFake([actividad]), cal, labels, reparar: true });

    expect(cal.escrituras.map((e) => e.verbo)).toEqual(['crear']);
    expect(resumen.reparados.map((c: any) => c.sesion.id)).toEqual([s2.id]);
    expect(resumen.desactualizados).toHaveLength(1);
    expect(resumen.reescritos).toEqual([]);
  });

  it('--reescribir actualiza solo el desactualizado, con el cuerpo de hoy y la zona explícita', async () => {
    const { actividad, s1, cuerpos } = escenario();
    const cal = calConCuerpos(cuerpos);
    const db = dbFake([actividad]);
    const resumen = await ejecutarVerificacion({ db, cal, labels, reparar: false, reescribir: true });

    expect(cal.escrituras).toHaveLength(1);
    const [e] = cal.escrituras;
    expect(e).toMatchObject({ verbo: 'actualizar', eventId: s1.calendarEventId });
    expect(e!.evento).toEqual(construirEvento(actividad, s1, labels));
    expect(e!.evento.start.timeZone).toBe('America/Argentina/Buenos_Aires');
    expect(e!.evento.end.timeZone).toBe('America/Argentina/Buenos_Aires');
    expect(resumen.reescritos.map((c: any) => c.sesion.id)).toEqual([s1.id]);
    // Sin write-back: el `calendarEventId` no cambia.
    expect((db.documentos.get('act1') as any).sesiones).toEqual(actividad.sesiones);
  });

  it('con los dos flags, la reescritura va después de las recreaciones', async () => {
    const { actividad, cuerpos } = escenario();
    const cal = calConCuerpos(cuerpos);
    await ejecutarVerificacion({ db: dbFake([actividad]), cal, labels, reparar: true, reescribir: true });
    expect(cal.escrituras.map((e) => e.verbo)).toEqual(['crear', 'actualizar']);
  });

  it("un evento 'cancelled' no se reescribe: para el público no existe", async () => {
    const { actividad, s1, cuerpos } = escenario();
    cuerpos.set(s1.calendarEventId, { ...cuerpos.get(s1.calendarEventId), status: 'cancelled' });
    const cal = calConCuerpos(cuerpos);
    const resumen = await ejecutarVerificacion({
      db: dbFake([actividad]),
      cal,
      labels,
      reparar: false,
      reescribir: true,
    });
    expect(resumen.desactualizados).toEqual([]);
    expect(cal.escrituras).toEqual([]);
  });

  it('un update que la API rechaza queda en fallidosReescritura, no en reescritos', async () => {
    const { actividad, s1, cuerpos } = escenario();
    const cal = calConCuerpos(cuerpos, { fallaActualizar: true });
    const resumen = await ejecutarVerificacion({
      db: dbFake([actividad]),
      cal,
      labels,
      reparar: false,
      reescribir: true,
    });
    expect(resumen.reescritos).toEqual([]);
    expect(resumen.fallidosReescritura.map((f: any) => f.sesion.id)).toEqual([s1.id]);
    expect(resumen.fallidosReescritura[0].error).toContain('403');
  });
});

/**
 * B-1520 — las etiquetas del evento que este script recrea o compara tienen que
 * ser las mismas que resuelve la Function. El script tenía su propia lista de
 * cinco taxonomías y quedó atrás cuando B-950 sumó `provincia` y `ciudad`: un
 * evento recreado decía el slug, y con B-631 cada evento de afuera de CABA habría
 * salido «desactualizado» por culpa del script. `main` no es testeable sin red,
 * así que esto mira la fuente: la carga es la de `functions/etiquetas.js`, y el
 * script no declara una lista propia.
 */
describe('las etiquetas son las de la Function, no una lista propia (B-1520)', () => {
  const fuente = readFileSync(
    fileURLToPath(new URL('../scripts/verificar-calendario.mjs', import.meta.url)),
    'utf8',
  );

  it("importa `cargarLabels` de `functions/etiquetas.js`", () => {
    expect(fuente).toMatch(/import\s*\{[^}]*\bcargarLabels\b[^}]*\}\s*from\s*'\.\.\/functions\/etiquetas\.js'/);
  });

  it('no declara su propia lista de taxonomías ni su propio `cargarLabels`', () => {
    expect(fuente).not.toMatch(/const\s+CAMPOS_TAXONOMIA\s*=/);
    expect(fuente).not.toMatch(/const\s+cargarLabels\s*=/);
  });
});
