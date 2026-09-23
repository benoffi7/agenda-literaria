/**
 * §4.3 — la huella del autor de una opción, **reexportada**.
 *
 * La implementación vive en `functions/huella.js` desde B-893: la callable que
 * crea la etiqueta de un publicador tiene que marcarla con **la misma** huella
 * con la que el panel de esa persona la reconoce como suya (`opcionesVisibles`),
 * y `functions/` no puede importar `src/` (D-20). Ver el docblock de allá.
 */
export { huellaCreador } from '../../functions/huella.js';
