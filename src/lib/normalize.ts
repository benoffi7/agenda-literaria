/**
 * §6 — normalización para búsqueda: baja a minúsculas y saca acentos, para que
 * "Boedo" matchee "boedo" y "crónica" matchee "cronica".
 * El input de búsqueda del cliente aplica exactamente esta misma función.
 */
export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

interface FuenteSearchText {
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
 * Los campos de primer nivel de los que sale el `searchText`.
 *
 * **Es la lista, y hay una sola.** `historial.ts` la usa para decidir si una
 * restauración tiene que recalcular el `searchText`, y tenía su propia copia con
 * cinco de estos seis: al agregar el libro (DEC-1), restaurar un libro viejo
 * escribía el campo y dejaba el `searchText` con el título descartado — que sale al
 * `events.json`, o sea el documento diciendo una cosa y el índice público otra.
 *
 * Es la clase de B-88 y la de B-72 a la vez: el productor y el consumidor de la
 * misma regla derivando por separado. La respuesta no es un test que compare dos
 * listas, es que haya una.
 */
export const CAMPOS_DE_SEARCH_TEXT = [
  'titulo',
  'descripcion',
  'modalidades',
  'sede',
  'organizador',
  'tallerista',
  'libro',
] as const;

/** Construye el `searchText` que se guarda en el documento (§6). */
export const buildSearchText = (a: FuenteSearchText): string =>
  normalize(
    [
      a.titulo ?? '',
      a.descripcion ?? '',
      // Las sedes de todas las formas de cursar, sin repetir: la derivada es una
      // de ellas y saldría dos veces.
      ...[
        ...new Set(
          (a.modalidades ?? [])
            .flatMap((m) => [m.sede?.nombre ?? '', m.sede?.barrio ?? ''])
            .filter(Boolean),
        ),
      ],
      a.sede?.nombre ?? '',
      a.sede?.barrio ?? '',
      a.organizador?.nombre ?? '',
      a.tallerista?.nombre ?? '',
      a.libro?.titulo ?? '',
      a.libro?.autor ?? '',
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
