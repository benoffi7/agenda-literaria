/**
 * §4.2 — la normalización de taxonomías, **reexportada**.
 *
 * La implementación vive en `functions/slugify.js` desde B-968: la Function de
 * Calendar también tiene que normalizar igual, y `functions/` se despliega con su
 * propio `package.json` y no puede importar `src/` (D-20). Ver el docblock de
 * allá, que explica los cuatro runtimes.
 *
 * Este archivo queda como fachada para que ningún import de `src/` ni de
 * `scripts/` haya tenido que cambiar de ruta.
 */
export { slugify } from '../../functions/slugify.js';
