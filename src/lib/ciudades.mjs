/**
 * **Las ciudades de una actividad**, reexportadas — B-919, B-1920.
 *
 * La implementación vive en `functions/ciudades.js` desde B-1920: `syncCalendar`
 * recalcula `ciudades` del lado del servidor para corregir un documento escrito a
 * mano, y `functions/` no puede importar `src/` (D-20). Tiene que ser **la misma**
 * `ciudadesDe` que usa el panel al guardar: con dos, el servidor «corregiría» un
 * documento bien guardado.
 *
 * Este archivo queda como fachada para que ningún import de `src/`, de `scripts/`
 * ni de `tests/` haya tenido que cambiar de ruta. Es el reparto de `geografia.mjs`.
 */
export * from '../../functions/ciudades.js';
