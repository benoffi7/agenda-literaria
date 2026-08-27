/**
 * El caso central del dominio: un ciclo de ocho encuentros (§2.2).
 *
 * ── Por qué existe este archivo ────────────────────────────────────────────
 * La clase de bug más caro de este repo no es un `if` invertido: es un **test
 * que pasa porque su fixture no ejercita el caso normal del dominio**. Apareció
 * tres veces:
 *
 *  1. **B-84** — `calendario.test.ts` afirma "cancelar un encuentro borra solo
 *     el suyo" y pasa; su fixture tiene una sola sesión y no es ciclo, así que
 *     el invariante no se prueba justo donde no vale.
 *  2. **H1 de la auditoría del calendario** — el listado descartaba encuentros
 *     por `inicio` y el calendario por `fin`; el fixture tenía `fin === inicio`
 *     (duración cero), así que la divergencia era **indetectable por
 *     construcción**.
 *  3. **`opcionesPresentes`** (H5) — un test que cementaba el orden de llegada
 *     de los datos en lugar de fijar un orden decidido.
 *
 * El §2.2 dice que un club de lectura de ocho encuentros es **una** actividad
 * con ocho sesiones, y que ese es el caso normal. Un fixture de una sesión con
 * duración cero no prueba casi nada de este proyecto.
 *
 * ── Cómo se usa ────────────────────────────────────────────────────────────
 * `FAMILIA_DE_CICLOS` no es un fixture: es una **familia**. Los invariantes del
 * dominio se afirman sobre la familia entera (ver
 * `tests/invariantes-de-ciclo.test.ts`), así que un invariante que solo vale
 * para el caso de una sesión no puede pasar por verdadero.
 */

/*
 * B-211 — el doble de `Timestamp` sale de `./tiempo`. Este archivo tenía su
 * propia copia de dos campos, `centinelas.ts` tenía otra de cuatro, y once tests
 * más la tenían a mano: trece definiciones en cuatro formas. La copia de dos
 * campos no satisfacía `TimestampLike`, que declara los cuatro.
 */
import { ts } from './tiempo';

/** Ocho encuentros es el ciclo del §2.2, no un número redondo cualquiera. */
export const ENCUENTROS_DEL_CICLO = 8;

/**
 * Dos horas: la duración típica de un taller. El motivo de que esto sea un
 * parámetro y no una constante escondida es H1 — con `fin === inicio`,
 * cualquier criterio que use `inicio` y cualquiera que use `fin` dan lo mismo,
 * y separarlos no rompe ningún test.
 */
export const DURACION_MINUTOS = 120;

const SEMANA_MS = 7 * 86_400_000;

/** Primer encuentro: jueves 3 de septiembre de 2026, 19:00 en Buenos Aires. */
const PRIMER_INICIO_UTC = Date.UTC(2026, 8, 3, 22);

export type SesionFixture = {
  id: string;
  inicio: ReturnType<typeof ts>;
  fin: ReturnType<typeof ts>;
  tema: string | null;
  lectura: string | null;
  cancelada: boolean;
  calendarEventId: string | null;
};

export type OpcionesSesiones = {
  /** Cuántos encuentros. Por defecto, el ciclo del §2.2. */
  cantidad?: number;
  /** Minutos entre `inicio` y `fin`. Cero solo en el caso que existe para eso. */
  duracionMinutos?: number;
  /** ¿Cada encuentro ya tiene su evento creado en Calendar? */
  conEventos?: boolean;
  /** Índices (base 0) de los encuentros cancelados. */
  canceladas?: number[];
  /** Devolver el array al revés: el orden del array no es el orden del tiempo. */
  desordenadas?: boolean;
};

/**
 * Los encuentros de un ciclo, semanales, cada uno con su id estable
 * (`ses_<algo>`, nunca por índice — trampa 2).
 */
export const sesionesDeCiclo = (opciones: OpcionesSesiones = {}): SesionFixture[] => {
  const {
    cantidad = ENCUENTROS_DEL_CICLO,
    duracionMinutos = DURACION_MINUTOS,
    conEventos = true,
    canceladas = [],
    desordenadas = false,
  } = opciones;

  const sesiones = Array.from({ length: cantidad }, (_, i) => {
    const inicio = PRIMER_INICIO_UTC + i * SEMANA_MS;
    return {
      id: `ses_${String(i + 1).padStart(4, '0')}`,
      inicio: ts(new Date(inicio).toISOString()),
      fin: ts(new Date(inicio + duracionMinutos * 60_000).toISOString()),
      tema: `Capítulos ${i * 4 + 1}-${i * 4 + 4}`,
      lectura: null,
      cancelada: canceladas.includes(i),
      // Una sesión ya cancelada **no** conserva su `calendarEventId`: al borrar
      // el evento, `syncCalendar` repone `null` en esa sesión (`ids.set(op.id,
      // null)` en `functions/index.js`, y también en el 404/410). Un fixture
      // con `cancelada: true` y un id de evento vivo describe un estado que el
      // sistema no puede tener asentado — y le hacía emitir un borrado de más
      // a `planificar` en cada escritura posterior.
      //
      // Es la misma clase que este archivo persigue (B-135): el fixture no
      // reproducía el dominio, así que el invariante "cancelar toca un solo
      // evento" no podía valer. Cancelar en el momento sí conserva el id —eso
      // lo hace `conCancelada` sobre una sesión viva—, que es el caso que los
      // invariantes ejercitan.
      calendarEventId:
        conEventos && !canceladas.includes(i) ? `evt_${String(i + 1).padStart(4, '0')}` : null,
    };
  });

  return desordenadas ? sesiones.reverse() : sesiones;
};

/**
 * El ciclo completo, tal como lo entrega Firestore a la Function. Publicado y
 * con `esCiclo: true`: sin eso la numeración "Encuentro N de M" no se arma y el
 * fixture vuelve a no probar el caso del §2.2.
 */
export const cicloDeOcho = (over: Record<string, unknown> = {}) => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura: Rulfo',
  slug: 'club-de-lectura-rulfo',
  descripcion: 'Ocho encuentros los jueves',
  imagenUrl: null,
  organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
  tallerista: null,
  estado: 'publicado',
  modalidad: 'presencial',
  sede: { nombre: 'Casa Brandon', direccion: 'Drago 236', barrio: '', ciudad: 'CABA' },
  online: null,
  inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
  arancel: { tipo: 'gratis', notas: '' },
  material: { tiene: false, items: [] },
  difusion: { arrobar: [], notas: '' },
  esCiclo: true,
  destacado: false,
  tags: [],
  searchText: '',
  sesiones: sesionesDeCiclo(),
  ...over,
});

export type CasoDeCiclo = {
  nombre: string;
  actividad: Record<string, unknown>;
  /** Cuántos encuentros tiene, para que las aserciones no cuenten a mano. */
  cantidad: number;
};

/**
 * La familia sobre la que se afirman los invariantes.
 *
 * El caso de una sola sesión está adentro **a propósito**: es el fixture que
 * dejó pasar B-84, y tenerlo al lado de los otros es lo que hace visible que un
 * invariante que solo vale ahí no es un invariante.
 */
export const FAMILIA_DE_CICLOS: CasoDeCiclo[] = [
  {
    nombre: 'ciclo de ocho encuentros (el caso del §2.2)',
    actividad: cicloDeOcho(),
    cantidad: 8,
  },
  {
    nombre: 'ciclo de ocho con el array desordenado',
    actividad: cicloDeOcho({ sesiones: sesionesDeCiclo({ desordenadas: true }) }),
    cantidad: 8,
  },
  {
    nombre: 'ciclo de dos encuentros (el mínimo que numera)',
    actividad: cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 2 }) }),
    cantidad: 2,
  },
  {
    nombre: 'ciclo de ocho con el tercero ya cancelado',
    actividad: cicloDeOcho({ sesiones: sesionesDeCiclo({ canceladas: [2] }) }),
    cantidad: 8,
  },
  {
    nombre: 'encuentro único (el fixture que dejó pasar B-84)',
    actividad: cicloDeOcho({ esCiclo: false, sesiones: sesionesDeCiclo({ cantidad: 1 }) }),
    cantidad: 1,
  },
];

/** Los casos donde la numeración del ciclo existe de verdad (§2.2). */
export const CICLOS_QUE_NUMERAN = FAMILIA_DE_CICLOS.filter(
  (c) => c.actividad.esCiclo === true && c.cantidad >= 2,
);
