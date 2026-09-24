/**
 * **El handle de Instagram, normalizado**, reexportado — B-928, B-1180.
 *
 * La implementación vive en `functions/handle-instagram.js` desde B-1145: la
 * Function de Calendar publica el mismo `@casabrandon` que la ficha, y
 * `functions/` se despliega con su propio `package.json` y no puede importar
 * `src/` (D-20). Es el reparto de `slugify.mjs` y `geografia.mjs` (B-968). Ver
 * el docblock de allá, que tiene la regla entera y su historia.
 *
 * Este archivo queda como fachada para que ningún import de `src/` ni de
 * `scripts/` haya tenido que cambiar de ruta: `enlaceSeguro.ts` y
 * `scripts/handle-instagram.mjs` siguen importando de acá. **No le vuelvas a
 * poner cuerpo**: `tests/calendario.test.ts` lo lee del fuente y da rojo.
 *
 * Qué hace cada campo de Instagram del modelo con lo que este saneador no
 * reconoce —corregir sin frenar, frenar, no normalizar— está en una sola tabla:
 * `docs/03-modelo-de-datos.md` § «Los campos de Instagram, campo por campo»
 * (B-1191).
 */
export { handleInstagram, arrobaInstagram } from '../../functions/handle-instagram.js';
