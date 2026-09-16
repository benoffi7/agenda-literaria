/**
 * **La etiqueta con la que una opción se ve** — §4.2, B-05.
 *
 * Vive en un `.mjs` y no adentro de `taxonomia.ts` por lo mismo que `slugify` y
 * `geografia`: **los scripts de `scripts/` la necesitan y corren en Node plano**,
 * sin TypeScript. `taxonomia.ts` la re-exporta, así que ningún import existente
 * cambió de ruta y sigue habiendo **una sola** implementación — que es el punto:
 * una copia en el script haría que una ciudad sembrada desde ahí y la misma
 * tipeada en el panel se vieran distinto.
 *
 * El slug es la identidad y esto es lo que se lee, en el desplegable, en el
 * evento de Calendar y en los chips del sitio (§4.4). Sin esto, un tag tipeado
 * "narrativa" se publica así al lado de "Poesía": la taxonomía se ve descuidada
 * aunque no esté duplicada. Ya pasó — `/opciones/tags` tiene
 * `narrativa="narrativa"`.
 *
 * **Solo la primera letra, y nada más.** Bajar el resto rompería "Villa Crespo",
 * "Google Meet" o unas siglas; subir cada palabra rompería "Club de lectura".
 * Los espacios internos se colapsan porque "A  la   gorra" y "A la gorra"
 * comparten slug y tienen que compartir etiqueta.
 *
 * No toca las que ya están guardadas: eso se arregla renombrando desde la
 * pantalla de taxonomías (B-06).
 */
export const etiquetaPresentable = (/** @type {string} */ label) => {
  const limpio = label.trim().replace(/\s+/g, ' ');
  if (!limpio) return '';
  return limpio[0].toLocaleUpperCase('es') + limpio.slice(1);
};
