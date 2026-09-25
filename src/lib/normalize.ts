/**
 * §6 — normalización para búsqueda y el `searchText`, **reexportados** — B-2050.
 *
 * La implementación vive en `functions/busqueda.js` desde B-2050: `syncCalendar`
 * recalcula el `searchText` del lado del servidor para corregir un documento
 * escrito a mano, y `functions/` no puede importar `src/` (D-20). Tiene que ser
 * **la misma** `buildSearchText` que usa el panel al guardar: con dos, el servidor
 * «corregiría» un documento bien guardado. Ver el docblock de allá.
 *
 * Este archivo queda como fachada, con los tipos, para que ningún import de `src/`
 * ni de `tests/` haya tenido que cambiar de ruta. Es el reparto de `ciudades.mjs`
 * (D-1233). Un test ata las dos por identidad (`tests/derivados-del-servidor.test.ts`).
 */
import * as busqueda from '../../functions/busqueda.js';

export interface FuenteSearchText {
  titulo?: string;
  descripcion?: string;
  /**
   * B-224 — las formas de cursar. Entran por sus **sedes**: con dos filas en dos
   * barrios, indexar solo la derivada dejaría el segundo barrio sin poder
   * buscarse, y buscar por barrio es una de las formas en que alguien llega a una
   * actividad.
   */
  modalidades?: readonly { sede?: { nombre?: string; barrio?: string } | null }[];
  /**
   * La sede **derivada** (la de la primera fila que tenga una). Se sigue leyendo
   * además de `modalidades` para los llamadores que solo tienen ese escalar —
   * `historial.ts` restaurando otro campo, y los tests—. Los repetidos no
   * molestan: esto es un índice de substrings, no una lista.
   */
  sede?: { nombre?: string; barrio?: string } | null;
  organizador?: { nombre?: string } | null;
  tallerista?: { nombre?: string } | null;
  /**
   * DEC-1 — el libro presentado. Entra a la búsqueda porque es una de las formas
   * en que alguien va a llegar a la actividad: se busca «Pedro Páramo», no
   * «presentación del jueves». El autor va también, y sirve incluso cuando
   * coincide con el invitado: repetirlo no cambia el resultado.
   */
  libro?: { titulo?: string; autor?: string } | null;
}

/**
 * §6 — baja a minúsculas y saca acentos. El input de búsqueda del cliente aplica
 * exactamente esta misma función.
 */
export const normalize: (s: string) => string = busqueda.normalize;

/**
 * Los campos de primer nivel de los que sale el `searchText`. **Es la lista, y hay
 * una sola** — ver `functions/busqueda.js`.
 */
export const CAMPOS_DE_SEARCH_TEXT: readonly (
  | 'titulo'
  | 'descripcion'
  | 'modalidades'
  | 'sede'
  | 'organizador'
  | 'tallerista'
  | 'libro'
)[] = busqueda.CAMPOS_DE_SEARCH_TEXT;

/** Construye el `searchText` que se guarda en el documento (§6). */
export const buildSearchText: (a: FuenteSearchText) => string = busqueda.buildSearchText;
