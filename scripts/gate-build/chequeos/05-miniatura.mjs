/**
 * Paso 4c del gate (B-1790, D-210).
 */
import {
  SLUG_AFUERA,
} from '../semilla.mjs';

export const nombre = "la miniatura confirmada en el srcset";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, htmlDe, leer: leerDist } = ctx;
  const RUTA_DE_LA_MINIATURA = ctx.rutaDeLaMiniatura;
  const htmlAfuera = await htmlDe(SLUG_AFUERA);

  /*
   * 4c · **B-1790 — la miniatura confirmada llega al `srcset`, sobre el HTML de
   * verdad.**
   *
   * Es la mitad de D-210 que ningún unitario ve: `urlDeMiniaturaSiExiste` está
   * probada contra un set, y `tests/miniaturas-storage.integracion.test.ts`
   * contra el listado real, pero que el **build** liste Storage, le pase el
   * resultado a la ficha y a la cartelera y la plantilla lo pinte solo se ve
   * acá. Se pide el objeto **codificado** (`miniaturas%2F…`) adentro de un
   * `srcset`: es la forma en que sale en la URL de descarga, y buscarlo suelto
   * en el archivo pasaría por el `src` del original, que comparte el id.
   *
   * Si esto falla con el emulador de Storage arriba, lo primero es que
   * `BUCKET_POR_DEFECTO` (`scripts/gate-build/semilla.mjs`) siga siendo el
   * default de `adminBucket()`: el gate sube a un bucket y el build lista otro.
   */
  const miniaturaEnElSrcset = new RegExp(
    `srcset="[^"]*${RUTA_DE_LA_MINIATURA.replace('/', '%2F').replace(/[.]/g, '[.]')}`,
  );
  const sinMiniatura = [
    [`actividad/${SLUG_AFUERA}/index.html`, htmlAfuera],
    ['cartelera/index.html', await leerDist('cartelera/index.html')],
  ].filter(([, html]) => !html || !miniaturaEnElSrcset.test(html));
  if (sinMiniatura.length > 0) {
    fallo(
      `la miniatura sembrada en Storage (${RUTA_DE_LA_MINIATURA}) no salió en el srcset de:\n` +
        sinMiniatura.map(([r]) => `    dist/${r}`).join('\n') +
        '\n  El build lista miniaturas/ una vez (D-210) y la ficha y la cartelera ponen la\n' +
        '  confirmada como candidato chico. Sin ella se sirve el original, que es más\n' +
        '  pesado: no rompe nada, y por eso nadie lo ve si no lo mira el gate (B-1790).',
    );
  }
};
