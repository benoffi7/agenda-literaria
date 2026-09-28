/**
 * **El organizador de una actividad, como taxonomía** — roadmap 1.5, D-723
 * punto 8 (decisión del dueño del 2026-09-28: el modelo completo, con una caja de
 * texto libre que autocompleta).
 *
 * Hasta acá el organizador era texto libre en todo el recorrido, y por eso no
 * podía tener página: «Casa Brandon» y «casa brandon » eran dos. Pasa a ser un
 * valor de `/opciones/organizador` (§4), y lo que lo identifica es su **slug**.
 *
 * ── Por qué vive en `functions/` ───────────────────────────────────────────
 * Lo usan el panel (al guardar), el build (las páginas y el índice) y los
 * scripts: tienen que ser **la misma** regla, y `functions/` no puede importar
 * `src/` (D-20). `src/lib/organizador.mjs` la reexporta, como la geografía.
 *
 * ── Los documentos viejos no se migran (D-26) ──────────────────────────────
 * No tienen `organizador.slug`. El slug se **deriva del nombre al leer**, con el
 * mismo `slugify` con que el panel crea la opción, así que el de una actividad
 * vieja y el de la opción que la siembra (`vocabulario:prod --campo=organizador`)
 * son el mismo por construcción. Por eso no hace falta reescribir las 441
 * actividades: alcanza con sembrar la lista.
 */
import { slugify } from './slugify.js';

/**
 * @typedef {{ nombre?: string | null, slug?: string | null }} OrganizadorLeible
 */

/**
 * El slug del organizador: el guardado si está, y si no el del nombre (D-26).
 * `''` si no hay organizador, que es un caso real (8 actividades al 2026-09-28).
 *
 * @param {OrganizadorLeible | null | undefined} org
 */
export const slugDeOrganizador = (org) => slugify(org?.slug || org?.nombre || '');

/**
 * El nombre que se muestra: la **etiqueta de la opción** si la hay, y si no el
 * nombre guardado. Es lo que hace que renombrar la opción en el panel cambie el
 * nombre en todas las páginas sin tocar una actividad (§4.1): el nombre guardado
 * queda como respaldo para lo que todavía no tiene opción.
 *
 * @param {OrganizadorLeible | null | undefined} org
 * @param {(slug: string) => string | null | undefined} etiquetaDe  la etiqueta de un slug, o nada
 */
export const nombreDeOrganizador = (org, etiquetaDe) => {
  const slug = slugDeOrganizador(org);
  const etiqueta = slug ? etiquetaDe(slug) : null;
  return (etiqueta || org?.nombre || '').trim();
};
