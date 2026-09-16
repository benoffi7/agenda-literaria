/**
 * **La geografía de una sede**, reexportada — B-950.
 *
 * La implementación vive en `functions/geografia.js` desde B-968: la Function de
 * Calendar también tiene que normalizarla, y `functions/` no puede importar
 * `src/` (D-20). Ver el docblock de allá, que explica los tres runtimes y por qué
 * el tercero decide dónde vive el archivo.
 *
 * Este archivo queda como fachada para que ningún import de `src/` ni de
 * `scripts/` haya tenido que cambiar de ruta.
 */
export * from '../../functions/geografia.js';
