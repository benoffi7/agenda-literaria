/**
 * **Reexportación** — B-928.
 *
 * Acá vivía una **copia** del normalizador de handles, atada a la del sitio por
 * un test que corría las dos contra la misma batería y exigía que contestaran
 * igual. Desde B-928 la copia se fue y esto quedó como fachada para no cambiarle
 * la ruta a nadie. La cadena hoy es: este archivo → `src/lib/handle-instagram.mjs`
 * (fachada desde B-1180) → `functions/handle-instagram.js`, que es donde vive la
 * implementación única —`functions/` no puede importar `src/` (D-20), así que el
 * cuerpo quedó del lado que ningún otro runtime le puede prestar—.
 *
 * **El motivo es exactamente lo que pasó**: aquel test avisa *después* de que
 * alguien arregló una sola de las dos, y eso ocurrió — B-928 agregó al módulo la
 * tolerancia al `?igsh=…` que pega el botón «Compartir» de Instagram, y el script
 * se quedó atrás. La red funcionó; el trabajo duplicado, no. Una copia con red
 * sigue siendo una copia.
 */
export { handleInstagram } from '../src/lib/handle-instagram.mjs';
