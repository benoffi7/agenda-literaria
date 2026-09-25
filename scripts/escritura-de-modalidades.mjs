/**
 * **Lo que escribe un script que reescribe `modalidades`** — B-2090.
 *
 * `modalidades` es la fuente y el documento guarda cinco derivados de ella:
 * `modalidad`, `sede`, `online`, `searchText` (`functions/derivados.js`) y
 * `ciudades` (`functions/ciudades.js`). Un backfill que cambia las filas y no
 * recalcula los cinco deja el documento diciendo dos cosas, y desde B-2050
 * `syncCalendar` lo nota: corrige lo que falte y manda `derivados-no-coinciden`
 * **por cada actividad tocada**. Con `reubicar-barrios.mjs` habrían sido hasta
 * 54 avisos: el barrio pasa de «provincia-de-buenos-aires» a vacío y el
 * `searchText` viejo lo seguía nombrando.
 *
 * Por eso los derivados salen de **las mismas funciones que usa el panel** —
 * importadas, no copiadas (la clase de B-88)— y no de un
 * `modalidades.find((m) => m.sede)` escrito en cada script. Con la copia, un
 * cambio en la derivación del panel no llega al backfill, y la diferencia la
 * descubre el servidor en producción.
 *
 * Es puro y no toca Firestore, para que un test lo pueda importar: los scripts
 * corren en el cuerpo del módulo y un `import()` suyo se conecta (ver
 * `tests/sembrar-slugs.test.ts`).
 */
import { ciudadesDe } from '../functions/ciudades.js';
import { derivadosDe } from '../functions/derivados.js';

/**
 * El payload de un `update` que cambia las filas de una actividad: las filas
 * nuevas y los cinco derivados recalculados de ellas.
 *
 * `documento` es el documento **como está guardado**: el `searchText` también sale
 * del título, la descripción, el organizador, el tallerista y el libro, que el
 * backfill no toca pero el índice necesita.
 *
 * @param {Record<string, any>} documento
 * @param {readonly any[]} modalidades las filas nuevas
 * @returns {{ modalidades: readonly any[], modalidad: string, sede: any, online: any, searchText: string, ciudades: string[] }}
 */
export const escrituraDeModalidades = (documento, modalidades) => ({
  modalidades,
  ...derivadosDe({ ...documento, modalidades }),
  ciudades: ciudadesDe(modalidades),
});
