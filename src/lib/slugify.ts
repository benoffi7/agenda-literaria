/**
 * §4.2 — el slugify del proyecto, la **única** fachada.
 *
 * La implementación vive en `functions/slugify.js` (B-968): la usan el panel, el
 * sitio, las Functions y los scripts de node, y `functions/` no puede importar
 * `src/` (D-20). Desde `src/` se entra por acá; los `.mjs` que corren en node
 * (`ciudades.mjs`, `reubicacion-de-barrio.mjs`, los de `scripts/`) importan el
 * `.js` de `functions/` directo, porque node no corre TypeScript (M-18).
 */
export { slugify } from '../../functions/slugify.js';
