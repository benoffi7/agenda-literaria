/**
 * Orden y filtros del listado del panel (B-96, B-126, D-73, D-74).
 *
 * **Por qué no hay una sola query nueva.** `listarActividades()` ya trae la
 * colección completa a memoria, así que filtrar y ordenar es gratis: cero
 * lecturas de Firestore, cero índices compuestos, búsqueda instantánea. Es el
 * mismo principio que el §2.5 fija para el sitio público, aplicado al panel.
 *
 * **Por qué el orden por defecto cambia** (B-96): el listado ordenaba por
 * `updatedAt desc`, así que arriba estaba lo que tocaste y no lo que se viene.
 * Un borrador cuyo primer encuentro es en cuatro días no lo veía nadie, y
 * después de la fecha ya no tiene arreglo. Ahora arriba está lo que está por
 * pasar, y "última modificación" sigue disponible como orden explícito.
 *
 * **El reloj entra como parámetro** (`ahora`), como en `functions/rebuild.js`:
 * un test no puede depender de qué día es hoy.
 */
import { modalidadesQueOfrece } from '@/lib/modalidades';
import { normalize } from '@/lib/normalize';
import { instanteDeTimestamp as instante } from '@/lib/sesiones';
import { ESTADOS, MODALIDADES } from '@/types/actividad';
import type { ActividadConId, Estado, Modalidad } from '@/types/actividad';

// ─────────────────────────────────────────────────────────────────
// Orden
// ─────────────────────────────────────────────────────────────────

export const ORDENES = ['proxima', 'reciente', 'titulo'] as const;
export type Orden = (typeof ORDENES)[number];

/** Lo que se lee en el desplegable. */
export const ETIQUETA_ORDEN: Record<Orden, string> = {
  proxima: 'Lo que se viene primero',
  reciente: 'Última modificación',
  titulo: 'Título (A-Z)',
};

/** El orden por defecto del listado (B-96). */
export const ORDEN_POR_DEFECTO: Orden = 'proxima';

// ─────────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────────

export const CUANDOS = ['cualquiera', 'por-venir', 'sin-futuro'] as const;
export type Cuando = (typeof CUANDOS)[number];

export const ETIQUETA_CUANDO: Record<Cuando, string> = {
  cualquiera: 'Cualquier fecha',
  'por-venir': 'Con algo por venir',
  'sin-futuro': 'Sin fechas por venir',
};

/**
 * Los cinco ejes que se pueden cruzar, más el texto.
 *
 * `''` es "sin filtrar" en todos los que son un valor suelto. Los que guardan
 * slugs de taxonomía (`tipo`, `barrio`) guardan el slug: la etiqueta la resuelve
 * quien pinta, con las opciones que el panel ya tiene cargadas (§4.1).
 *
 * Qué **no** está y por qué, en D-74: `arancel`, `tags`, `destacado` y quién la
 * cargó.
 */
export interface Filtros {
  texto: string;
  estado: Estado | '';
  tipo: string;
  modalidad: Modalidad | '';
  barrio: string;
  cuando: Cuando;
}

export const FILTROS_VACIOS: Filtros = {
  texto: '',
  estado: '',
  tipo: '',
  modalidad: '',
  barrio: '',
  cuando: 'cualquiera',
};

/**
 * Cuántos filtros hay puestos, **sin contar el texto**: el buscador está
 * siempre a la vista y se ve solo. Este número es el que va al lado del botón
 * "Filtros", para que un filtro puesto y olvidado detrás de un panel colapsado
 * no explique un listado que parece vacío.
 */
export const cantidadDeFiltros = (f: Filtros): number =>
  (f.estado ? 1 : 0) +
  (f.tipo ? 1 : 0) +
  (f.modalidad ? 1 : 0) +
  (f.barrio ? 1 : 0) +
  (f.cuando !== 'cualquiera' ? 1 : 0);

/** ¿Hay algo filtrando, texto incluido? Decide el mensaje del listado vacío. */
export const hayFiltros = (f: Filtros): boolean =>
  cantidadDeFiltros(f) > 0 || f.texto.trim().length > 0;

// ─────────────────────────────────────────────────────────────────
// Fechas de una actividad
// ─────────────────────────────────────────────────────────────────


const millis = (valor: unknown): number => instante(valor)?.getTime() ?? 0;

/**
 * El próximo encuentro que todavía no terminó, o `null` si no queda ninguno.
 *
 * **Se descarta por el fin y se devuelve el inicio.** Un taller de 19 a 21, a
 * las 19:30, sigue siendo "lo próximo": todavía se puede entrar. Filtrar por el
 * inicio lo mandaba al fondo del listado y lo metía en "sin encuentros por
 * venir" justo durante las dos horas en que alguien podría necesitar abrirlo.
 *
 * Es además el mismo criterio que `yaPaso` de `calendarioPanel.ts` — "hoy sigue
 * siendo hoy" — y el que prometen los textos del filtro y de la guía. Antes los
 * dos módulos contestaban "¿ya pasó?" con campos distintos, y el fixture de los
 * tests tenía `fin === inicio`, así que la diferencia era indetectable.
 *
 * **Los cancelados no cuentan:** un encuentro cancelado no va a pasar, y si
 * contara, un ciclo cancelado a mitad de camino seguiría apareciendo arriba del
 * listado como si fuera lo más urgente.
 */
export const proximoEncuentro = (actividad: ActividadConId, ahora: Date): Date | null => {
  let proximo: Date | null = null;
  for (const sesion of actividad.sesiones ?? []) {
    if (sesion.cancelada) continue;
    const inicio = instante(sesion.inicio);
    const fin = instante(sesion.fin) ?? inicio;
    if (!inicio || !fin || fin.getTime() < ahora.getTime()) continue;
    if (!proximo || inicio.getTime() < proximo.getTime()) proximo = inicio;
  }
  return proximo;
};

/** ¿Le queda algo por pasar? Es el filtro "con algo por venir". */
export const tieneFuturo = (actividad: ActividadConId, ahora: Date): boolean =>
  proximoEncuentro(actividad, ahora) !== null;

// ─────────────────────────────────────────────────────────────────
// Filtrar
// ─────────────────────────────────────────────────────────────────

export const filtrar = (
  actividades: ActividadConId[],
  filtros: Filtros,
  ahora: Date,
): ActividadConId[] => {
  // §6 — la misma normalización que va a usar el sitio público: "cronica"
  // encuentra "Crónica".
  const texto = normalize(filtros.texto.trim());

  return actividades.filter((a) => {
    if (texto && !(a.searchText ?? '').includes(texto)) return false;
    if (filtros.estado && a.estado !== filtros.estado) return false;
    if (filtros.tipo && a.tipo !== filtros.tipo) return false;
    /*
     * B-224 — matchea si **alguna** forma de cursar es la buscada, o si lo es la
     * resultante. Con una sola modalidad es la condición de siempre; con dos, una
     * actividad presencial y virtual aparece bajo «Presencial», bajo «Virtual» y
     * bajo «Presencial y virtual», porque las tres cosas son ciertas de ella.
     * Filtrar solo por la resultante la escondería de los dos filtros que la
     * describen mejor.
     */
    if (
      filtros.modalidad &&
      !modalidadesQueOfrece(a.modalidades ?? [{ modalidad: a.modalidad }]).includes(
        filtros.modalidad,
      )
    ) {
      return false;
    }
    if (filtros.barrio && (a.sede?.barrio ?? '') !== filtros.barrio) return false;
    if (filtros.cuando === 'por-venir' && !tieneFuturo(a, ahora)) return false;
    if (filtros.cuando === 'sin-futuro' && tieneFuturo(a, ahora)) return false;
    return true;
  });
};

// ─────────────────────────────────────────────────────────────────
// Ordenar
// ─────────────────────────────────────────────────────────────────

const porTitulo = (a: ActividadConId, b: ActividadConId): number =>
  a.titulo.localeCompare(b.titulo, 'es');

const porReciente = (a: ActividadConId, b: ActividadConId): number =>
  millis(b.updatedAt) - millis(a.updatedAt) || porTitulo(a, b);

/**
 * `ordenar` no muta: el array que devuelve `listarActividades` lo comparten el
 * listado y el memo de los filtros.
 *
 * En `'proxima'`, lo que **no** tiene nada por venir va al final ordenado por
 * última modificación. Es la mitad menos obvia de la decisión: si las pasadas se
 * intercalaran por su última fecha, el fondo del listado sería un archivo
 * histórico y lo recién tocado —que es lo que se está editando— quedaría
 * perdido en el medio.
 */
export const ordenar = (
  actividades: ActividadConId[],
  orden: Orden,
  ahora: Date,
): ActividadConId[] => {
  const copia = [...actividades];

  if (orden === 'titulo') return copia.sort(porTitulo);
  if (orden === 'reciente') return copia.sort(porReciente);

  return copia.sort((a, b) => {
    const pa = proximoEncuentro(a, ahora);
    const pb = proximoEncuentro(b, ahora);
    if (pa && pb) return pa.getTime() - pb.getTime() || porTitulo(a, b);
    if (pa) return -1;
    if (pb) return 1;
    return porReciente(a, b);
  });
};

/** Filtrar y ordenar de una vez: es lo único que necesita el componente. */
export const listaVisible = (
  actividades: ActividadConId[],
  filtros: Filtros,
  orden: Orden,
  ahora: Date,
): ActividadConId[] => ordenar(filtrar(actividades, filtros, ahora), orden, ahora);

// ─────────────────────────────────────────────────────────────────
// Qué ofrecer en cada desplegable
// ─────────────────────────────────────────────────────────────────

export interface OpcionesPresentes {
  estados: Estado[];
  tipos: string[];
  modalidades: Modalidad[];
  /** Slugs de barrio. La etiqueta la resuelve quien pinta (§4.1). */
  barrios: string[];
}

/** Los cuatro estados, en el idioma del panel. */
export const ETIQUETA_ESTADO: Record<Estado, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  publicado: 'Publicado',
  cancelado: 'Cancelado',
};

/** Las tres modalidades, con el mismo texto que usa la descripción del evento. */
export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Presencial y virtual',
};

/**
 * `'villa-crespo'` → `'Villa Crespo'`. **Último recurso** para un valor de
 * taxonomía cuya etiqueta no está cargada todavía (§4.1): la etiqueta de verdad
 * sale de `/opciones/*`, y esto solo evita que un desplegable muestre el valor
 * crudo mientras las opciones no llegaron. Es el mismo criterio que aplica la
 * descripción del evento cuando el valor no está registrado.
 */
/**
 * Slug → etiqueta legible, cuando el slug no está registrado en `/opciones/*`.
 *
 * Es la MISMA función que usa la descripción del evento público, importada de
 * `@calendario` y no copiada: si el respaldo del panel y el del calendario
 * divergen, el mismo slug se lee distinto en cada lado y nada falla (D-20).
 */
export { desSlug as legible } from '@calendario';

/**
 * Los valores que **existen en los datos**, no la taxonomía completa.
 *
 * Ofrecer un barrio que ninguna actividad usa es ofrecer un filtro que siempre
 * devuelve cero, y la lista de barrios crece sola con el campo "Otro" (§4.2):
 * en tres meses el desplegable tendría treinta entradas y dos servirían.
 */
export const opcionesPresentes = (actividades: ActividadConId[]): OpcionesPresentes => {
  const estados = new Set<Estado>();
  const tipos = new Set<string>();
  const modalidades = new Set<Modalidad>();
  const barrios = new Set<string>();

  for (const a of actividades) {
    estados.add(a.estado);
    if (a.tipo) tipos.add(a.tipo);
    // B-224 — se ofrece cada modalidad que la actividad tiene, no solo la
    // resultante: si no, el desplegable no ofrecería «Virtual» aunque haya una
    // actividad con una fila virtual, y el filtro de arriba sí la encontraría.
    for (const m of modalidadesQueOfrece(a.modalidades ?? [{ modalidad: a.modalidad }])) {
      modalidades.add(m);
    }
    if (a.sede?.barrio) barrios.add(a.sede.barrio);
  }

  // El orden de los desplegables no puede salir del orden de llegada de los
  // datos: `listarActividades()` no garantiza uno estable, así que "Estado"
  // listaría «borrador, publicado» un día y «publicado, cancelado» otro. Los
  // dos que tienen un orden correcto lo usan; los abiertos van alfabéticos.
  const porDeclaracion = <T,>(orden: readonly T[]) => (a: T, b: T) =>
    orden.indexOf(a) - orden.indexOf(b);

  return {
    // Ciclo de vida, que es el orden con el que se piensa el estado.
    estados: [...estados].sort(porDeclaracion(ESTADOS)),
    // Es taxonomía abierta (§4): alfabético, como los barrios.
    tipos: [...tipos].sort((a, b) => a.localeCompare(b, 'es')),
    modalidades: [...modalidades].sort(porDeclaracion(MODALIDADES)),
    barrios: [...barrios].sort((a, b) => a.localeCompare(b, 'es')),
  };
};
