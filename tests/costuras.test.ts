/**
 * Costuras entre features (B-80 … B-90).
 *
 * Once features se integraron el mismo día, escritas en paralelo. Cada una está
 * testeada por dentro; lo que nadie probó es **el par**. Este archivo junta los
 * pares que se pisan.
 *
 * Los `it.fails` de acá son bugs confirmados que quedaron en el backlog: el
 * `it.fails` mantiene el CI verde y falla el día en que alguien los arregle,
 * que es cuando hay que venir a borrarlo.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import { construirEvento as construirEventoAnalitica } from '@/lib/analytics-eventos';
import { construirIssue, redactar } from '../functions/reportes.js';
import { planificar } from '../functions/calendario.js';
import { idDeEvento, reponerIds } from '../functions/sincronizacion.js';
import { CAMPOS_REARME, registrarExito } from '../functions/rebuild.js';
import { huboCambioDeContenido } from '../functions/historial.js';
import { generarSesiones } from '@/lib/sesiones';
import type { Actividad } from '@/types/actividad';

const raiz = new URL('..', import.meta.url);
const fuente = (relativo: string) =>
  readFileSync(fileURLToPath(new URL(relativo, raiz)), 'utf8');

// ─────────────────────────────────────────────────────────────────────
// Fixtures: el documento tal como lo entrega Firestore a la Function.
// ─────────────────────────────────────────────────────────────────────

const ts = (iso: string) => {
  const d = new Date(iso);
  return { toDate: () => d, toMillis: () => d.getTime() };
};

/** Ocho encuentros semanales, cada uno con su evento ya creado en Calendar. */
const ochoSesiones = (over: (i: number) => Record<string, unknown> = () => ({})) =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `ses_${i}`,
    inicio: ts(new Date(Date.UTC(2026, 8, 3, 22) + i * 7 * 86_400_000).toISOString()),
    fin: ts(new Date(Date.UTC(2026, 8, 4, 0) + i * 7 * 86_400_000).toISOString()),
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: `evt_${i}`,
    ...over(i),
  }));

const ciclo = (over: Record<string, unknown> = {}) => ({
  titulo: 'Club de lectura',
  descripcion: 'Ocho encuentros',
  estado: 'publicado',
  modalidad: 'presencial',
  sede: { nombre: 'Casa Brandon', direccion: 'Drago 236' },
  inscripcion: { requiere: false, destino: '' },
  arancel: { tipo: 'gratis', notas: '' },
  esCiclo: true,
  destacado: false,
  imagenUrl: null,
  sesiones: ochoSesiones(),
  ...over,
});

const tipos = (ops: { tipo: string }[]) => ops.map((o) => o.tipo);

// ─────────────────────────────────────────────────────────────────────
// B-80 · El listado + el write-back de calendarEventId
// ─────────────────────────────────────────────────────────────────────

/**
 * `ListaActividades` lee con `getDocs` una sola vez y refresca al guardar
 * (`version`), así que su snapshot es de **antes** de que `syncCalendar` escriba
 * los `calendarEventId`. `documentoAForm` mete esos ids en el form y
 * `formADocumento` los vuelve a escribir: guardar desde un snapshot viejo los
 * pisa con `null`.
 */
const actividadPlana = (calendarEventId: string | null): Actividad =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    descripcion: 'Ocho encuentros de crónica urbana',
    imagenUrl: null,
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [
      {
        id: 'ses_1',
        inicio: Timestamp.fromDate(new Date('2026-09-03T22:00:00Z')),
        fin: Timestamp.fromDate(new Date('2026-09-04T00:00:00Z')),
        tema: null,
        lectura: null,
        cancelada: false,
        calendarEventId,
      },
    ],
    modalidad: 'presencial',
    sede: {
      nombre: 'Casa Brandon',
      direccion: 'Drago 236',
      barrio: '',
      ciudad: 'CABA',
      indicaciones: '',
      geo: null,
    },
    online: null,
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'publicado',
    tags: [],
    destacado: false,
    searchText: '',
  }) as unknown as Actividad;

describe('B-80 · guardar desde un listado viejo y el calendarEventId', () => {
  const enFirestore = actividadPlana('evt_1'); // ya sincronizada
  const enElListado = actividadPlana(null); // snapshot previo al write-back

  const guardar = (titulo: string) =>
    formADocumento(
      { ...documentoAForm(enElListado), titulo },
      'uid-admin',
      false,
    ) as unknown as Record<string, any>;

  it('el form de un snapshot viejo escribe calendarEventId en null', () => {
    // Esto es el hecho, no el bug: el bug es lo que pasa después.
    expect(guardar('Taller de crónica urbana').sesiones[0].calendarEventId).toBeNull();
  });

  it('ese guardado todavía actualiza el evento correcto: el daño no se ve', () => {
    const ops = planificar(enFirestore, guardar('Taller de crónica urbana'));
    expect(ops).toEqual([
      expect.objectContaining({ tipo: 'actualizar', eventId: 'evt_1' }),
    ]);
  });

  /**
   * Acá se veía el daño. `syncCalendar` escribía ids de vuelta solo para las
   * ops `crear` y `borrar`, así que después del guardado anterior el documento
   * quedaba con `calendarEventId: null` y `evt_1` sin dueño; la edición
   * siguiente volvía a **crear** el evento: dos eventos para el mismo
   * encuentro en el calendario público, y `evt_1` huérfano para siempre.
   *
   * Era la trampa 3 del §13 por otra puerta: no por el loop de la Function,
   * sino porque el panel es dueño de un campo que escribe la Function.
   *
   * **Arreglado** del lado de la Function (`reponerIds`), que es el lado que no
   * depende de que el cliente se porte bien: el `actualizar` que ese mismo
   * guardado dispara repone el id que el panel pisó, en la misma pasada.
   */
  it('B-80: el write-back repone el id y la edición siguiente no crea un segundo evento', () => {
    const trasElPisón = guardar('Taller de crónica urbana');
    expect(trasElPisón.sesiones[0].calendarEventId).toBeNull();

    // El sync de ESE guardado: `actualizar` sobre evt_1, y el id de vuelta al
    // documento. Es lo que hace `syncCalendar` con el mapa `ids`.
    const ops = planificar(enFirestore, trasElPisón) as any[];
    const ids = new Map<string, string | null>(
      ops.map((op) => [op.id, op.tipo === 'borrar' ? null : op.eventId]),
    );
    const reparado = {
      ...trasElPisón,
      sesiones: reponerIds(trasElPisón.sesiones, ids) ?? trasElPisón.sesiones,
    };
    expect(reparado.sesiones[0].calendarEventId).toBe('evt_1');

    // Y con el documento reparado, la edición siguiente actualiza en vez de crear.
    expect(tipos(planificar(reparado, guardar('Taller de crónica, edición 2027')))).not.toContain(
      'crear',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-82 · Entrega al-menos-una-vez + sync a Calendar
// ─────────────────────────────────────────────────────────────────────

/**
 * Réplica mínima del cuerpo de `syncCalendar` (functions/index.js): el plan
 * sale del **payload del evento**, el id del evento se deriva del id de sesión
 * y los ids se escriben en el documento al final. No hay nada más en el
 * original que cambie el resultado.
 *
 * El `calendario` es un `Map` por id de evento, que es justo lo que hace que la
 * réplica sirva: un `insert` con un id que ya existe no puede crear una segunda
 * entrada, igual que Calendar contesta 409 en vez de crear un segundo evento.
 */
const correrSyncCalendar = (
  antes: any,
  despues: any,
  documento: { sesiones: any[] },
  calendario: Map<string, unknown>,
) => {
  const ops = planificar(antes, despues, {});
  if (ops.length === 0) return { ops, marcoRebuild: false };

  const ids = new Map<string, string | null>();
  for (const op of ops as any[]) {
    if (op.tipo === 'crear') {
      // B-82 — el id lo elige el cliente. Sin forma documentada de id de
      // sesión no hay id derivable y lo asigna Google, como antes.
      const propuesto = idDeEvento(op.id) ?? `evt_${calendario.size + 1}`;
      if (calendario.has(propuesto)) {
        // Lo que hace `crearEvento` con el 409: `update` sobre ese mismo
        // evento, nunca un evento nuevo.
        calendario.set(propuesto, { ...op.evento, status: 'confirmed' });
      } else {
        calendario.set(propuesto, op.evento);
      }
      ids.set(op.id, propuesto);
    } else if (op.tipo === 'actualizar') {
      calendario.set(op.eventId, op.evento);
      ids.set(op.id, op.eventId);
    } else if (op.tipo === 'borrar') {
      calendario.delete(op.eventId);
      ids.set(op.id, null);
    }
  }

  const repuestas = reponerIds(documento.sesiones, ids);
  if (repuestas) documento.sesiones = repuestas;
  return { ops, marcoRebuild: true };
};

describe('B-82 · la entrega de eventos de Firestore es al-menos-una-vez', () => {
  /** Id con la forma que genera el panel (`nuevaSesionId`): `ses_<uuid>`. */
  const idSesion = 'ses_3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
  const sinIds = [
    {
      id: idSesion,
      inicio: ts('2026-09-03T22:00:00Z'),
      fin: ts('2026-09-04T00:00:00Z'),
      tema: null,
      lectura: null,
      cancelada: false,
      calendarEventId: null,
    },
  ];
  const publicar = () => ({
    antes: { ...ciclo({ esCiclo: false, sesiones: sinIds }), estado: 'borrador' },
    despues: ciclo({ esCiclo: false, sesiones: sinIds }),
  });

  it('la primera entrega crea el evento y escribe su id', () => {
    const { antes, despues } = publicar();
    const documento = { sesiones: sinIds.map((s) => ({ ...s })) };
    const calendario = new Map();
    correrSyncCalendar(antes, despues, documento, calendario);
    expect(calendario.size).toBe(1);
    expect(documento.sesiones[0]!.calendarEventId).toBe(idDeEvento(idSesion));
  });

  /**
   * El mismo evento entregado dos veces trae el mismo `before`/`after`, así que
   * `planificar` vuelve a decir "crear" aunque el documento ya tenga el id: la
   * guarda del §7.1 corta la recursión, no la reentrega.
   *
   * **Arreglado donde tiene que estar: en el sistema externo.** El id del
   * evento se deriva del id de sesión, así que el segundo `insert` choca con el
   * primero (409) en vez de crear un evento nuevo. No hace falta que la
   * Function lleve la cuenta de qué eventos ya vio.
   */
  it('B-82: una reentrega del mismo evento no duplica el evento', () => {
    const documento = { sesiones: sinIds.map((s) => ({ ...s })) };
    const calendario = new Map();
    const { antes, despues } = publicar();
    correrSyncCalendar(antes, despues, documento, calendario);
    correrSyncCalendar(antes, despues, documento, calendario); // reentrega
    expect(calendario.size).toBe(1);
    expect([...calendario.keys()]).toEqual([idDeEvento(idSesion)]);
  });

  it('y diez reentregas tampoco', () => {
    const documento = { sesiones: sinIds.map((s) => ({ ...s })) };
    const calendario = new Map();
    const { antes, despues } = publicar();
    for (let i = 0; i < 10; i += 1) correrSyncCalendar(antes, despues, documento, calendario);
    expect(calendario.size).toBe(1);
  });

  it('la réplica sigue siendo fiel: index.js decide con el payload del evento', () => {
    const src = fuente('functions/index.js');
    // Si esto deja de matchear, la réplica de arriba dejó de valer.
    expect(src).toContain('const antes = event.data?.before?.data() ?? null;');
    expect(src).toContain('const ops = planificar(antes, despues, labels);');
    // Sigue sin haber guarda por id de evento ni relectura previa al plan: la
    // idempotencia no está en la Function, está en el id que elige el cliente.
    expect(src).not.toMatch(/event\.id/);
    expect(src).toContain('const propuesto = idDeEvento(op.id);');
    expect(src).toContain('requestBody: propuesto ? { ...op.evento, id: propuesto } : op.evento,');
    // Y el 409 se resuelve actualizando ese mismo evento, no creando otro.
    expect(src).toContain("if (!propuesto || code !== 409) throw e;");
    expect(src).toContain("requestBody: { ...op.evento, status: 'confirmed' },");
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-83 · El rebuild cuelga del sync a Calendar
// ─────────────────────────────────────────────────────────────────────

/**
 * `syncCalendar` marcaba `sistema/rebuild` **al final**, después de un
 * `if (ops.length === 0) return;` y de un `if (!CALENDAR_ID) return;`: si el
 * cambio no alteraba el evento del calendario, el sitio público no se
 * rebuildeaba. Era la trampa 8 del §13 con otro disparador.
 *
 * **Arreglado:** el rebuild se marca antes de los dos cortes, y la decisión la
 * toma `huboCambioDeContenido` —el mismo criterio del historial (D-41)— para
 * que el write-back de `calendarEventId` de la propia Function no pida un build
 * por cada sync.
 */
const marcaRebuild = (antes: unknown, despues: unknown) =>
  huboCambioDeContenido(antes, despues);

describe('B-83 · el rebuild ya no cuelga del sync a Calendar', () => {
  it('index.js marca el rebuild antes de los dos cortes tempranos', () => {
    const src = fuente('functions/index.js');
    const marca = src.indexOf('await marcarRebuild(`actividad ${id}`)');
    const corte = src.indexOf('if (ops.length === 0)');
    const sinCalendario = src.indexOf('if (!CALENDAR_ID)');
    expect(marca).toBeGreaterThan(-1);
    expect(corte).toBeGreaterThan(marca);
    expect(sinCalendario).toBeGreaterThan(corte);
    // Y la marca va con guarda: sin ella, el write-back de la propia Function
    // pediría un build por cada sincronización.
    expect(src).toContain('if (huboCambioDeContenido(antes, despues)) {');
  });

  it('destacar una actividad publicada no genera ninguna operación de Calendar', () => {
    expect(planificar(ciclo({ destacado: false }), ciclo({ destacado: true }), {})).toEqual([]);
  });

  /**
   * `destacado` sale al `events.json` (§5.2) y decide la portada del sitio: sin
   * rebuild, tildarlo no se veía nunca. Lo mismo `imagenUrl`, el `slug` y
   * `searchText`.
   */
  it('B-83: destacar una actividad publicada marca rebuild', () => {
    expect(marcaRebuild(ciclo({ destacado: false }), ciclo({ destacado: true }))).toBe(true);
  });

  it('B-83: cambiar la imagen de portada también', () => {
    expect(
      marcaRebuild(ciclo({ imagenUrl: null }), ciclo({ imagenUrl: 'https://cdn/tapa.jpg' })),
    ).toBe(true);
  });

  it('B-83: y corregir el texto de búsqueda o el slug', () => {
    expect(marcaRebuild(ciclo({ searchText: 'club' }), ciclo({ searchText: 'club lectura' }))).toBe(
      true,
    );
    expect(marcaRebuild(ciclo({ slug: 'club' }), ciclo({ slug: 'club-de-lectura' }))).toBe(true);
  });

  /**
   * La otra mitad del arreglo, y la que hace que no sea "poner marcarRebuild
   * arriba a lo bruto": el write-back de `calendarEventId` que escribe esta
   * misma Function no pide un build.
   */
  it('el write-back del propio sync no marca rebuild', () => {
    const sinIds = ciclo({ sesiones: ochoSesiones(() => ({ calendarEventId: null })) });
    expect(marcaRebuild(sinIds, ciclo())).toBe(false);
  });

  it('guardar el formulario sin cambiar nada tampoco', () => {
    const antes = ciclo({ updatedAt: ts('2026-08-24T12:00:00Z'), updatedBy: 'uid-1' });
    const despues = ciclo({ updatedAt: ts('2026-08-24T12:05:00Z'), updatedBy: 'uid-1' });
    expect(marcaRebuild(antes, despues)).toBe(false);
  });

  it('borrar la actividad marca rebuild: hay que sacarla del sitio', () => {
    expect(marcaRebuild(ciclo(), null)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-84 · Cancelar un encuentro de un ciclo renumera los otros siete
// ─────────────────────────────────────────────────────────────────────

/**
 * `posicionEnCiclo` numera sobre las sesiones **no canceladas**, así que
 * cancelar el tercero de ocho convierte al sexto en "Encuentro 5 de 7". El test
 * "cancelar un encuentro borra solo el suyo" de `calendario.test.ts` pasa porque
 * su fixture no es un ciclo — que es justo el caso del §2.2.
 */
describe('B-84 · cancelar un encuentro de un ciclo', () => {
  const antes = ciclo();
  const despues = ciclo({
    sesiones: ochoSesiones((i) => (i === 2 ? { cancelada: true } : {})),
  });

  it('hoy reescribe los otros siete eventos además de borrar el cancelado', () => {
    // Lo que hace hoy, para que el arreglo se note.
    expect(tipos(planificar(antes, despues, {}))).toEqual([
      'actualizar',
      'actualizar',
      'borrar',
      'actualizar',
      'actualizar',
      'actualizar',
      'actualizar',
      'actualizar',
    ]);
  });

  it.fails('B-84: cancelar uno solo tendría que tocar un solo evento', () => {
    const ops = planificar(antes, despues, {});
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'borrar', eventId: 'evt_2' });
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-90 · "Generar N encuentros" sobre un ciclo ya publicado
// ─────────────────────────────────────────────────────────────────────

/**
 * El generador del §11 **reemplaza** la lista, y `generarSesiones` da ids
 * nuevos. Sobre un ciclo ya publicado eso es exactamente lo que el §7.2 dice que
 * no hay que hacer: borrar y recrear los ocho eventos, perdiendo los
 * recordatorios y las suscripciones de la gente. El cartel del formulario avisa
 * "Reemplaza la lista actual"; no dice que reemplaza el calendario.
 */
describe('B-90 · el generador de encuentros sobre un ciclo publicado', () => {
  it('genera ids nuevos, así que el diff no reconoce ningún encuentro', () => {
    const generadas = generarSesiones({
      cantidad: 8,
      inicio: '2026-09-03T19:00',
      duracionMinutos: 120,
    });
    const despues = ciclo({
      sesiones: generadas.map((s) => ({
        id: s.id,
        inicio: ts(new Date(s.inicio).toISOString()),
        fin: ts(new Date(s.fin).toISOString()),
        tema: null,
        lectura: null,
        cancelada: false,
        calendarEventId: null,
      })),
    });
    const ops = tipos(planificar(ciclo(), despues, {}));
    expect(ops.filter((t) => t === 'borrar')).toHaveLength(8);
    expect(ops.filter((t) => t === 'crear')).toHaveLength(8);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-81 · El título del reporte y el issue público (ARREGLADO)
// ─────────────────────────────────────────────────────────────────────

/**
 * `construirIssue` pasaba `descripcion` y `pasos` por `redactar()` pero no el
 * `titulo`, que es el `title` del issue: el renglón más visible del repo
 * público. Y el formulario del panel promete lo contrario en pantalla ("si se
 * cuela alguno, el panel lo tapa antes de publicar").
 *
 * Arreglado en `functions/reportes.js` (una línea). Estos tests son la guarda.
 */
describe('B-81 · el título del reporte también se redacta (§5.1, trampa 5)', () => {
  const issue = (titulo: string) =>
    construirIssue({
      id: 'rep1',
      reporte: {
        tipo: 'bug',
        titulo,
        descripcion: 'Cargo el taller y no me deja guardar el borrador.',
        severidad: 'molesta',
        contexto: { pantalla: 'nueva-actividad', url: '/admin' },
      },
    });

  it('tapa un mail en el título', () => {
    expect(issue('No le llega el mail a hola@casabrandon.org').title).toBe(
      '[bug] No le llega el mail a «mail oculto»',
    );
  });

  it('tapa un link de reunión en el título', () => {
    expect(issue('Se rompe con https://zoom.us/j/9876 cargado').title).toContain(
      '«link de reunión oculto»',
    );
  });

  it('un título sin nada sensible queda intacto', () => {
    expect(issue('No puedo guardar un borrador').title).toBe(
      '[bug] No puedo guardar un borrador',
    );
  });

  it('sigue tolerando un título vacío', () => {
    expect(issue('   ').title).toBe('[bug] (sin título)');
  });

  it('redactar no cambia de comportamiento: recorta y limpia como antes', () => {
    expect(redactar('  hola  ')).toBe('hola');
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-85 · El debounce del rebuild pierde el cambio que llega mientras dispara
// ─────────────────────────────────────────────────────────────────────

/**
 * `dispararRebuild` lee `sistema/rebuild`, habla con GitHub (hasta 15 s de
 * timeout) y después escribe `registrarExito`, que bajaba `pendiente` sin mirar
 * si en el medio alguien lo volvió a subir. Una actividad guardada en esa
 * ventana marcaba su rebuild y el tick se lo comía: el sitio quedaba viejo hasta
 * la próxima edición ajena.
 *
 * **Arreglado:** `registrarExito` compara la marca `actualizado` que el tick
 * leyó contra la que hay al escribir, y la escritura va en transacción.
 */
describe('B-85 · registrarExito compara antes de bajar `pendiente`', () => {
  const ahora = Date.UTC(2026, 7, 21, 12, 0, 0);
  const marca = (iso: string) => {
    const d = new Date(iso);
    return { toMillis: () => d.getTime(), toDate: () => d };
  };

  it('en el camino feliz baja el flag, que es lo que corresponde', () => {
    expect(registrarExito(ahora)).toMatchObject({ pendiente: false, intentos: 0 });
  });

  it('con la misma marca a los dos lados, también', () => {
    const leida = marca('2026-08-21T11:59:00Z');
    expect(
      registrarExito(ahora, { marcaLeida: leida, marcaActual: marca('2026-08-21T11:59:00Z') }),
    ).toMatchObject({ pendiente: false });
  });

  it('B-85: un rebuild marcado durante el dispatch no se pierde', () => {
    // El tick lee el estado…
    let doc: Record<string, unknown> = {
      pendiente: true,
      motivo: 'actividad A',
      intentos: 0,
      actualizado: marca('2026-08-21T11:59:00Z'),
    };
    const leido = { ...doc };
    expect(leido.pendiente).toBe(true);

    // …y mientras el `fetch` a GitHub está en vuelo, syncCalendar marca otro.
    doc = {
      ...doc,
      pendiente: true,
      motivo: 'actividad B',
      actualizado: marca('2026-08-21T11:59:30Z'),
      ...CAMPOS_REARME,
    };

    // El dispatch salió bien, y la escritura compara la marca (en transacción,
    // así que lee la de "actividad B").
    doc = {
      ...doc,
      ...registrarExito(ahora, {
        marcaLeida: leido.actualizado,
        marcaActual: doc.actualizado,
      }),
    };

    // El build que arrancó no incluye a "actividad B": el flag queda arriba y el
    // próximo tick lo dispara.
    expect(doc.pendiente).toBe(true);
    // Y el disparo igual salió bien: los reintentos vuelven a cero.
    expect(doc).toMatchObject({ intentos: 0, ultimoError: null, agotado: false });
  });

  it('index.js escribe el éxito en una transacción, comparando la marca', () => {
    const src = fuente('functions/index.js');
    expect(src).toContain('marcaLeida: estado.actualizado ?? null,');
    expect(src).toMatch(/const exito = await db\.runTransaction\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-88 · El formato de versión del build vs. el sanitizador de analítica
// ─────────────────────────────────────────────────────────────────────

/**
 * `scripts/version.mjs` produce tres formas de versión; el `FORMATO_VERSION` de
 * la analítica solo acepta la primera, así que en un build de árbol sucio o sin
 * `.git` **todos** los eventos viajan con `version: 'otro'` — y `version` existe
 * justamente para atribuir un pico de errores a un deploy.
 */
describe('B-88 · versiones de build que la analítica no reconoce', () => {
  it('las tres formas siguen siendo las que produce el build', () => {
    const src = fuente('scripts/version.mjs');
    expect(src).toContain('`${pkg.version}+${sha}`');
    expect(src).toContain('-sucio.${sello(ahora)}');
    expect(src).toContain('+sin-git.${sello(ahora)}');
  });

  const version = (v: string) =>
    construirEventoAnalitica('panel_abierto', { version: v })!.params.version;

  it('la versión de un build limpio viaja entera', () => {
    expect(version('1.0.1+5e2cb50')).toBe('1.0.1+5e2cb50');
  });

  it.fails('B-88: la versión de un build de árbol sucio también tendría que viajar', () => {
    expect(version('1.0.1+5e2cb50-sucio.20260821-2124')).not.toBe('otro');
  });

  it.fails('B-88: y la de un clone sin .git', () => {
    expect(version('1.0.1+sin-git.20260821-2124')).not.toBe('otro');
  });
});
