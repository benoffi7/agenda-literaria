/**
 * El índice de un test-registro partido por entrada — PRD 6, M-12.
 *
 * `tests/clases-de-bug.test.ts` y `tests/barrido-de-salidas-publicas.test.ts`
 * eran registros de 3.700 y 4.200 líneas: para sumar **una** clase o **una**
 * salida había que leer el archivo entero (~50 mil tokens). Se partieron en un
 * archivo por entrada (`tests/clases/`, `tests/salidas/`) y en su lugar quedó un
 * **índice**: una tabla en el docblock, una fila por archivo con el título de su
 * `describe`. El índice sigue en la ruta vieja porque medio repo la cita —la
 * doc, las fichas de los auditores, los comentarios del código— y leerlo es lo
 * barato: una tabla, no tres mil líneas.
 *
 * Una tabla escrita a mano envejece. Por eso el índice es un test: estas
 * funciones leen la tabla y el directorio, y el test del índice exige que digan
 * lo mismo en las dos direcciones.
 */
import { readFileSync } from 'node:fs';
import { archivosDelRepo } from './archivos-del-repo';

export interface FilaDelIndice {
  archivo: string;
  titulo: string;
}

/** Las filas `| \`tests/…\` | título |` del docblock de un índice. */
export const filasDelIndice = (indice: string): FilaDelIndice[] =>
  [...readFileSync(indice, 'utf8').matchAll(/^ \* \| `(tests\/[^`]+)` \| (.+) \|$/gm)].map((m) => ({
    archivo: m[1]!,
    titulo: m[2]!,
  }));

/** Los títulos de los `describe` de primer nivel de un archivo de test. */
export const describesDe = (archivo: string): string[] =>
  [...readFileSync(archivo, 'utf8').matchAll(/^describe(?:\.\w+)*\('((?:[^'\\]|\\.)*)'/gm)].map(
    (m) => m[1]!,
  );

/** Los archivos de test de un directorio partido. */
export const archivosDe = (directorio: string): string[] =>
  archivosDelRepo(directorio).filter((f) => f.endsWith('.test.ts'));
