/**
 * Paso 9 del gate (B-121).
 */
import { barrerArtefacto } from '../barrido.mjs';

export const nombre = "el barrido de centinelas sobre todo el dist/";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { publicables } = ctx;
  /*
   * 9 · **B-121 — el barrido sobre TODO el `dist/`, y no sobre tres páginas
   * elegidas a mano.**
   *
   * Es lo que el ítem pedía desde el principio: «el `grep` sobre `dist/`
   * buscando `difusion`, la URL de la reunión y los uids». Hasta B-121 el gate
   * barría el `events.json` (paso 3) y **tres** páginas de detalle nombradas una
   * por una, y el listado, la cartelera, las páginas de mes, `/pasadas`, los
   * hubs y el sitemap quedaban afuera — cada página nueva, hasta que alguien se
   * acordara de agregarla (B-212, B-227). Así que la lista **se deriva del
   * `dist/`**: una página nueva entra sola.
   *
   * Desde B-1760 (corte 3 de D-1070) el barrido es una función pura sobre
   * `{relativa, contenido}[]` —`barrerArtefacto`, en
   * `scripts/gate-build/barrido.mjs`, con las canastas por salida y los
   * controles positivos del monto—, y acá solo se le pasa lo que el build
   * escribió.
   *
   * **Por qué vive en el gate y no en la suite:** necesita un `dist/`
   * construido, y `npm test` no puede depender de eso. Es el criterio de
   * B-217. Lo que sí corre en la suite es la función, contra un `dist/` de
   * mentira con una fuga por canasta.
   */
  for (const mensaje of barrerArtefacto(await publicables())) ctx.fallo(mensaje);
};
