/**
 * **Qué efemérides de `datos/efemerides-literarias.json` se escriben** — B-2224.
 *
 * La mitad pura de `importar-efemerides.mjs`: sin Firestore, para que el test la
 * pueda mirar sin hablar con ninguna base (el mismo corte que
 * `slugs-a-reconciliar.mjs`).
 *
 * El slug sale del título con **el mismo `slugify` que el panel** (§4.2), así que
 * una efeméride importada tiene el link que tendría si se la hubiera cargado a
 * mano. Si ya hay una con ese slug en la base, **no se toca**: el importador es
 * idempotente —correrlo dos veces escribe una— y no pisa la que el dueño haya
 * editado después.
 */
import { slugify } from '../functions/slugify.js';

/** Las entradas del archivo, con su slug. */
export const conSlug = (entradas) => entradas.map((e) => ({ ...e, slug: slugify(e.titulo) }));

/**
 * El reparto: las que se escriben, las que ya están en la base y las que el
 * archivo repite (dos títulos que dan el mismo slug — la segunda no entra, igual
 * que en el build, `sinSlugsRepetidos`).
 *
 * @param {Array<{titulo: string}>} entradas
 * @param {Iterable<string>} slugsExistentes
 */
export const aImportar = (entradas, slugsExistentes) => {
  const enLaBase = new Set(slugsExistentes);
  const vistos = new Set();
  const nuevas = [];
  const yaEstan = [];
  const repetidas = [];
  for (const e of conSlug(entradas)) {
    if (vistos.has(e.slug)) repetidas.push(e);
    else if (enLaBase.has(e.slug)) yaEstan.push(e);
    else nuevas.push(e);
    vistos.add(e.slug);
  }
  return { nuevas, yaEstan, repetidas };
};

/** Quién figura como autor: no es un uid, y dice de dónde salió el documento. */
export const AUTOR_DE_LA_IMPORTACION = 'importacion:efemerides-literarias';
