/**
 * §4.2 — el slugify del proyecto, tipado.
 *
 * **La implementación vive en `./slugify.mjs`** y esto es solo su fachada con
 * tipos: node no corre TypeScript, y desde B-919 hay dos scripts que necesitan
 * la MISMA normalización que el documento (ver el docblock del `.mjs`). Lo que
 * no puede pasar es que haya dos.
 */
export { slugify } from './slugify.mjs';
