/**
 * **Los chequeos del paso 4 del gate, nombrados y en orden** — B-1960 (M-11 del
 * PRD 6).
 *
 * Hasta B-1960 eran un solo `try` de 1.500 líneas en `build-contra-emulador.mjs`:
 * para sumar un aserto había que leer el archivo entero, y una excepción en el
 * paso 4 se llevaba puestos los pasos 5 a 10 sin decir cuáles. Ahora cada
 * chequeo es un archivo de `chequeos/` con un `nombre` y un `chequear(ctx)`, y el
 * cuerpo de cada uno es el que estaba en el script, sin cambios de fondo.
 *
 * **Un chequeo nuevo se suma acá**, en `CHEQUEOS`: `tests/gate-build-resultado.test.ts`
 * falla si hay un archivo en `chequeos/` que esta lista no corre, y si hay un
 * chequeo que no se pone rojo sobre un `dist/` vacío (el positivo que impide que
 * uno pase por no haber mirado nada).
 *
 * El contexto que reciben —y su tipo— vive en `contexto.mjs`.
 *
 * @typedef {import('./contexto.mjs').Contexto} Contexto
 */
import * as indice from './chequeos/01-indice.mjs';
import * as canceladas from './chequeos/02-canceladas-y-borrador.mjs';
import * as opciones from './chequeos/03-opciones-y-que-se-llevan.mjs';
import * as ciudad from './chequeos/04-ciudad.mjs';
import * as miniatura from './chequeos/05-miniatura.mjs';
import * as sitemap from './chequeos/06-sitemap-robots-canonica.mjs';
import * as galeria from './chequeos/07-galeria.mjs';
import * as directorios from './chequeos/08-directorios.mjs';
import * as efemerides from './chequeos/09-efemerides.mjs';
import * as motivo from './chequeos/10-motivo-de-cancelacion.mjs';
import * as barrido from './chequeos/11-barrido.mjs';
import * as seo from './chequeos/12-seo.mjs';

/** En el orden en que corrían adentro del `try`. */
export const CHEQUEOS = [
  indice,
  canceladas,
  opciones,
  ciudad,
  miniatura,
  sitemap,
  galeria,
  directorios,
  efemerides,
  motivo,
  barrido,
  seo,
];

/**
 * Corre los chequeos en orden. **Una excepción adentro de uno es un rojo con su
 * nombre, y los demás siguen**: antes cortaba el `try` entero y el mensaje no
 * decía qué paso se había caído.
 *
 * @param {{ nombre: string, chequear: (ctx: Contexto) => Promise<void> }[]} chequeos
 * @param {Contexto} ctx
 */
export const correrChequeos = async (chequeos, ctx) => {
  for (const { nombre, chequear } of chequeos) {
    try {
      await chequear(ctx);
    } catch (e) {
      ctx.fallo(`el chequeo «${nombre}» se cortó: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
};
