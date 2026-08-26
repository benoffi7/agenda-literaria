/**
 * Rutas de campo del schema, normalizadas.
 *
 * Zod reporta la fila exacta de un array (`sesiones.3.fin`, `material.items.1.titulo`)
 * y hay dos lugares que necesitan la ruta **sin** la fila: el vocabulario de la
 * analítica —que reporta qué campo traba a la gente, no en qué fila— y el
 * diccionario de nombres de campo del formulario, que le pone «Fecha de inicio»
 * a `sesiones.N.inicio`.
 *
 * Vive suelto en un módulo propio porque los dos que lo usan no se pueden
 * importar entre sí: `analytics-eventos.ts` no puede depender del formulario, y
 * el formulario no debería arrastrar la analítica para leer un nombre. Y porque
 * es exactamente la clase de regla de una línea que en este repo ya se escribió
 * dos veces con dos comportamientos distintos (B-72, B-75).
 */

/** `sesiones.3.fin` → `sesiones.N.fin`. Deja intactas las rutas sin índice. */
export const colapsarIndices = (ruta: string): string => ruta.replace(/\.\d+(?=\.|$)/g, '.N');
