/**
 * §6 — el índice de búsqueda de una actividad: `normalize` y `buildSearchText`.
 *
 * `normalize` baja a minúsculas y saca acentos, para que "Boedo" matchee "boedo" y
 * "crónica" matchee "cronica". El input de búsqueda del cliente aplica exactamente
 * esta misma función.
 *
 * ── Por qué vive en `functions/` ──────────────────────────────────────────
 * Desde B-2050 `syncCalendar` recalcula el `searchText` de lo que el documento
 * guarda, para corregir el que llegó escrito a mano (`derivadosDesalineados`,
 * `derivados.js`). Tiene que ser **la misma** función que usa el panel al guardar:
 * con dos, el servidor «corregiría» cada documento bien guardado y cada guardado
 * mandaría un mail. `functions/` no puede importar `src/` (D-20), así que la
 * implementación vive acá y `src/lib/normalize.ts` es su fachada, que es el
 * reparto de `ciudades.js` (D-1233) y de `geografia.js` (B-968).
 *
 * Es JS plano y corre sobre documentos escritos a mano, así que cada lectura va con
 * `?.`: una fila `null` en `modalidades` no puede hacer tirar al sync.
 */
import { AVISO_DE_REUNION, linksDeReunionDe, sinLinksDeReunion } from './links-de-reunion.js';

/**
 * @param {string} s
 * @returns {string}
 */
export const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

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
export const CAMPOS_DE_SEARCH_TEXT = Object.freeze(
  /** @type {const} */ ([
    'titulo',
    'descripcion',
    'modalidades',
    'sede',
    'organizador',
    'tallerista',
    'libro',
  ]),
);

/**
 * Construye el `searchText` que se guarda en el documento (§6).
 *
 * - `modalidades` (B-224) entra por sus **sedes**: con dos filas en dos barrios,
 *   indexar solo la derivada dejaría el segundo barrio sin poder buscarse.
 * - `sede` es la **derivada** (la de la primera fila que tenga una). Se sigue
 *   leyendo para los llamadores que solo tienen ese escalar; los repetidos no
 *   molestan: esto es un índice de substrings, no una lista.
 * - `libro` (DEC-1) entra porque se busca «Pedro Páramo», no «presentación del
 *   jueves».
 * - `descripcion` entra **sin los links de reunión** (B-2185, trampa 5): el
 *   `searchText` sale entero al `events.json`, así que un link de Meet pegado en
 *   la descripción se publicaba por acá aunque el detalle y Calendar lo sacaran.
 *   El aviso que deja `sinLinksDeReunion` tampoco entra: no es algo que se busque.
 *
 * @param {{
 *   titulo?: string,
 *   descripcion?: string,
 *   online?: { url?: unknown } | null,
 *   modalidades?: readonly ({ sede?: { nombre?: string, barrio?: string } | null, online?: { url?: unknown } | null } | null)[],
 *   sede?: { nombre?: string, barrio?: string } | null,
 *   organizador?: { nombre?: string } | null,
 *   tallerista?: { nombre?: string } | null,
 *   libro?: { titulo?: string, autor?: string } | null,
 * }} a
 * @returns {string}
 */
export const buildSearchText = (a) =>
  normalize(
    [
      a.titulo ?? '',
      sinLinksDeReunion(a.descripcion ?? '', linksDeReunionDe(a)).replaceAll(AVISO_DE_REUNION, ' '),
      // Las sedes de todas las formas de cursar, sin repetir: la derivada es una
      // de ellas y saldría dos veces.
      ...[
        ...new Set(
          (Array.isArray(a.modalidades) ? a.modalidades : [])
            .flatMap((m) => [m?.sede?.nombre ?? '', m?.sede?.barrio ?? ''])
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
