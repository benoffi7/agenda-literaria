/**
 * **El rol y la ciudad de una cuenta, dichos en castellano** — B-2051.
 *
 * Es la mitad pura de `npm run admin:claim:prod -- --ver <uid|email>`: recibe
 * los `customClaims` que devuelve el Admin SDK y contesta qué rol tiene la
 * cuenta, con qué ciudad, y si el objeto tiene algo raro. Vive aparte del
 * script para poder testearla sin Admin SDK (`tests/describir-claims.test.ts`).
 *
 * ── El rol NO se deriva acá ───────────────────────────────────────────────
 * Sale de `rolDeLaSesion` (`functions/alta-de-opcion.js`), la misma derivación
 * que la callable, y que `tests/alta-de-opcion.test.ts` ya corre contra
 * `rolDeClaims` del panel. Una cuarta copia de «el publicador gana cuando están
 * los dos» es la clase de B-88: el `--ver` diría «admin» de una cuenta que las
 * reglas tratan como acotada, que es justo lo que el runbook de
 * `ciudades-no-coinciden` le pregunta. Se importa la implementación `.js` y no
 * la fachada `.ts` por el mismo motivo que el `slugify` del script: node no
 * corre TypeScript.
 *
 * La ciudad sigue la misma regla que `ciudadDeClaims` (`src/lib/rolDelPanel.ts`):
 * verbatim, solo para el publicador, y `''` si no es texto. El test la compara
 * contra esa función sobre la misma tabla.
 */
import { rolDeLaSesion } from '../functions/alta-de-opcion.js';

/**
 * @typedef {{
 *   rol: 'admin' | 'publicador' | null,
 *   ciudad: string,
 *   nombre: string,
 *   avisos: string[],
 * }} DescripcionDeClaims
 */

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @returns {DescripcionDeClaims}
 */
export const describirClaims = (claims) => {
  const c = claims ?? {};
  const rol = rolDeLaSesion(c);
  const ciudad = rol === 'publicador' && typeof c.ciudad === 'string' ? c.ciudad : '';

  const nombre =
    rol === 'admin'
      ? 'admin'
      : rol === 'publicador'
        ? ciudad
          ? `publicador de ${ciudad}`
          : 'publicador general'
        : 'sin rol';

  /*
   * Los avisos son los estados que el script **no produce** —reemplaza el
   * objeto entero y rechaza una ciudad sin slug— y que solo salen de tocar la
   * consola a mano. Se dicen porque el que corre `--ver` está justamente
   * investigando por qué una cuenta hace lo que no debería.
   */
  const avisos = [];
  if (c.admin === true && c.publicador === true) {
    avisos.push(
      'tiene los dos claims, admin y publicador: las reglas y el panel la tratan como PUBLICADOR. ' +
        'Volvé a dar el rol que corresponde y el objeto se reemplaza entero.',
    );
  }
  for (const flag of ['admin', 'publicador']) {
    if (flag in c && c[flag] !== true) {
      avisos.push(
        `tiene \`${flag}: ${JSON.stringify(c[flag])}\`, que no es \`true\`: no cuenta como ${flag}.`,
      );
    }
  }
  if ('ciudad' in c) {
    if (rol !== 'publicador') {
      avisos.push(
        `tiene \`ciudad: ${JSON.stringify(c.ciudad)}\` sin ser publicador: no restringe nada.`,
      );
    } else if (!ciudad) {
      avisos.push(
        `tiene \`ciudad: ${JSON.stringify(c.ciudad)}\`, vacía o que no es texto: ` +
          'el panel la trata como publicador general. Volvé a dar el rol con --ciudad.',
      );
    }
  }

  return { rol, ciudad, nombre, avisos };
};
