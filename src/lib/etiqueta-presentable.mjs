/**
 * §4.2 · B-05 — la etiqueta con la que una opción se ve, **reexportada**.
 *
 * La implementación vive en `functions/etiqueta-presentable.js` desde B-893: la
 * callable que crea la etiqueta del publicador (`functions/alta-de-opcion.js`)
 * tiene que presentarla **igual** que el panel, y `functions/` se despliega con
 * su propio `package.json` y no puede importar `src/` (D-20). Es el mismo reparto
 * que `slugify.mjs` y `geografia.mjs`: una implementación, N runtimes. Ver el
 * docblock de allá.
 *
 * Este archivo queda como fachada para que ni `taxonomia.ts` ni
 * `scripts/vocabulario-desde-actividades.mjs` hayan tenido que cambiar de ruta.
 */
export { etiquetaPresentable } from '../../functions/etiqueta-presentable.js';
