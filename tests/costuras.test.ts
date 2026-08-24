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
import { construirDescripcion, planificar } from '../functions/calendario.js';
import { CAMPOS_REARME, registrarExito } from '../functions/rebuild.js';
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
   * Y acá se ve. `syncCalendar` solo escribe ids de vuelta para las ops `crear`
   * y `borrar` (`idsNuevos` / `idsBorrados` en functions/index.js), así que
   * después del guardado anterior el documento quedó con `calendarEventId: null`
   * y `evt_1` sin dueño. La edición siguiente vuelve a **crear** el evento:
   * dos eventos para el mismo encuentro en el calendario público, y `evt_1`
   * huérfano para siempre (nadie lo referencia, así que nada lo va a borrar).
   *
   * Es la trampa 3 del §13 por otra puerta: no por el loop de la Function, sino
   * porque el panel es dueño de un campo que escribe la Function.
   */
  it.fails('B-80: la edición siguiente NO debería crear un segundo evento', () => {
    const trasElPisón = guardar('Taller de crónica urbana');
    const ops = planificar(trasElPisón, guardar('Taller de crónica, edición 2027'));
    expect(tipos(ops)).not.toContain('crear');
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-82 · Entrega al-menos-una-vez + sync a Calendar
// ─────────────────────────────────────────────────────────────────────

/**
 * Réplica mínima del cuerpo de `syncCalendar` (functions/index.js:123-208): el
 * plan sale del **payload del evento**, y los ids nuevos se escriben en el
 * documento al final. No hay nada más en el original que cambie el resultado.
 *
 * `guardarVersion` (historial) y `reporteAIssue` sí se blindan contra la
 * reentrega —el primero con `idDeVersion(event.time, event.id)`, el segundo con
 * una transacción sobre `estado`—; `syncCalendar` no.
 */
const correrSyncCalendar = (
  antes: any,
  despues: any,
  documento: { sesiones: any[] },
  calendario: Map<string, unknown>,
) => {
  const ops = planificar(antes, despues, {});
  if (ops.length === 0) return { ops, marcoRebuild: false };

  const idsNuevos = new Map<string, string>();
  const idsBorrados = new Set<string>();
  for (const op of ops as any[]) {
    if (op.tipo === 'crear') {
      const eventId = `evt_${calendario.size + 1}`;
      calendario.set(eventId, op.evento);
      idsNuevos.set(op.id, eventId);
    } else if (op.tipo === 'actualizar') {
      calendario.set(op.eventId, op.evento);
    } else if (op.tipo === 'borrar') {
      calendario.delete(op.eventId);
      idsBorrados.add(op.id);
    }
  }

  if (idsNuevos.size > 0 || idsBorrados.size > 0) {
    documento.sesiones = documento.sesiones.map((s) => {
      if (idsNuevos.has(s.id)) return { ...s, calendarEventId: idsNuevos.get(s.id) };
      if (idsBorrados.has(s.id)) return { ...s, calendarEventId: null };
      return s;
    });
  }
  return { ops, marcoRebuild: true };
};

describe('B-82 · la entrega de eventos de Firestore es al-menos-una-vez', () => {
  const sinIds = [
    {
      id: 'ses_1',
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
    expect(documento.sesiones[0]!.calendarEventId).toBe('evt_1');
  });

  /**
   * El mismo evento entregado dos veces trae el mismo `before`/`after`, así que
   * `planificar` vuelve a decir "crear" aunque el documento ya tenga el id.
   * Resultado: dos eventos para el mismo encuentro en el calendario público, y
   * el primero huérfano.
   */
  it.fails('B-82: una reentrega del mismo evento NO debería duplicar el evento', () => {
    const documento = { sesiones: sinIds.map((s) => ({ ...s })) };
    const calendario = new Map();
    const { antes, despues } = publicar();
    correrSyncCalendar(antes, despues, documento, calendario);
    correrSyncCalendar(antes, despues, documento, calendario); // reentrega
    expect(calendario.size).toBe(1);
  });

  it('la réplica sigue siendo fiel: index.js decide con el payload del evento', () => {
    const src = fuente('functions/index.js');
    // Si esto deja de matchear, la réplica de arriba dejó de valer.
    expect(src).toContain('const antes = event.data?.before?.data() ?? null;');
    expect(src).toContain('const ops = planificar(antes, despues, labels);');
    // Y no hay ninguna guarda por id de evento ni relectura previa al plan.
    expect(src).not.toMatch(/event\.id/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-83 · El rebuild cuelga del sync a Calendar
// ─────────────────────────────────────────────────────────────────────

/**
 * `syncCalendar` marca `sistema/rebuild` **al final**, después de un
 * `if (ops.length === 0) return;` y de un `if (!CALENDAR_ID) return;`. O sea: si
 * el cambio no altera el evento del calendario, el sitio público no se
 * rebuildea. Es la trampa 8 del §13 con otro disparador.
 */
const marcaRebuild = (antes: unknown, despues: unknown) =>
  planificar(antes, despues, {}).length > 0;

describe('B-83 · un cambio que no toca el evento no dispara rebuild', () => {
  it('index.js corta antes de marcarRebuild cuando no hay operaciones', () => {
    const src = fuente('functions/index.js');
    const corte = src.indexOf('if (ops.length === 0)');
    const sinCalendario = src.indexOf('if (!CALENDAR_ID)');
    const marca = src.indexOf('await marcarRebuild(');
    expect(corte).toBeGreaterThan(-1);
    expect(sinCalendario).toBeGreaterThan(corte);
    expect(marca).toBeGreaterThan(sinCalendario);
  });

  it('destacar una actividad publicada no genera ninguna operación de Calendar', () => {
    expect(planificar(ciclo({ destacado: false }), ciclo({ destacado: true }), {})).toEqual([]);
  });

  /**
   * `destacado` sale al `events.json` (§5.2) y decide la portada del sitio: sin
   * rebuild, tildarlo no se ve nunca. Lo mismo `imagenUrl`, `slug` de un
   * borrador y `searchText`.
   */
  it.fails('B-83: destacar una actividad publicada tiene que marcar rebuild', () => {
    expect(marcaRebuild(ciclo({ destacado: false }), ciclo({ destacado: true }))).toBe(true);
  });

  it.fails('B-83: cambiar la imagen de portada también', () => {
    expect(
      marcaRebuild(ciclo({ imagenUrl: null }), ciclo({ imagenUrl: 'https://cdn/tapa.jpg' })),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B-84 · Cancelar un encuentro de un ciclo renumeraba los otros siete
//        (ARREGLADO)
// ─────────────────────────────────────────────────────────────────────

/**
 * `posicionEnCiclo` numeraba sobre las sesiones **no canceladas**, así que
 * cancelar el tercero de ocho convertía al sexto en "Encuentro 5 de 7": siete
 * `actualizar` de más, y el texto de siete eventos ya agendados cambiando sin
 * que nada hubiera cambiado para su dueño.
 *
 * Arreglado numerando sobre todas las sesiones, canceladas incluidas (D-95).
 * Estos tests son la guarda; el detalle del ciclo está en `calendario.test.ts`.
 */
describe('B-84 · cancelar un encuentro de un ciclo (§7.2, §2.2)', () => {
  const antes = ciclo();
  const despues = ciclo({
    sesiones: ochoSesiones((i) => (i === 2 ? { cancelada: true } : {})),
  });

  it('cancelar uno solo toca un solo evento', () => {
    const ops = planificar(antes, despues, {});
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'borrar', eventId: 'evt_2' });
  });

  it('no renumera a los otros siete: el sexto sigue siendo "6 de 8"', () => {
    const sexta = despues.sesiones[5]!;
    expect(construirDescripcion(antes, antes.sesiones[5]!, {})).toContain('Encuentro 6 de 8');
    expect(construirDescripcion(despues, sexta, {})).toContain('Encuentro 6 de 8');
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
 * timeout) y después escribe `registrarExito`, que baja `pendiente` sin mirar si
 * en el medio alguien lo volvió a subir. Una actividad guardada en esa ventana
 * marca su rebuild y el tick se lo come: el sitio queda viejo hasta la próxima
 * edición ajena.
 */
describe('B-85 · registrarExito baja `pendiente` sin comparar', () => {
  const ahora = Date.UTC(2026, 7, 21, 12, 0, 0);

  it('en el camino feliz baja el flag, que es lo que corresponde', () => {
    expect(registrarExito(ahora)).toMatchObject({ pendiente: false, intentos: 0 });
  });

  it.fails('B-85: un rebuild marcado durante el dispatch no se puede perder', () => {
    // El tick lee el estado…
    let doc: Record<string, unknown> = { pendiente: true, motivo: 'actividad A', intentos: 0 };
    const leido = { ...doc };
    expect(leido.pendiente).toBe(true);

    // …y mientras el `fetch` a GitHub está en vuelo, syncCalendar marca otro.
    doc = { ...doc, pendiente: true, motivo: 'actividad B', ...CAMPOS_REARME };

    // El dispatch salió bien: `ref.set(registrarExito(ahora), { merge: true })`.
    doc = { ...doc, ...registrarExito(ahora) };

    // El build que arrancó no incluye a "actividad B", y ya nadie va a pedir otro.
    expect(doc.pendiente).toBe(true);
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
