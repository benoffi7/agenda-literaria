/**
 * **El contexto que reciben los chequeos del paso 4 del gate** — B-1960.
 *
 * Vive aparte de `chequeos.mjs` para que cada chequeo pueda nombrar su tipo sin
 * importar el registro que lo importa a él: el `import('…')` de un JSDoc cuenta
 * como arista en el grafo de `scripts/salud-del-codigo.mjs`, y apuntarlo al
 * registro armaba doce ciclos.
 *
 * @typedef {{ relativa: string, contenido: string }} Archivo
 * @typedef {object} Contexto
 * @property {(ruta: string) => Promise<string | null>} leer  un archivo de `dist/`, o `null`
 * @property {(slug: string) => Promise<string | null>} htmlDe  la ficha de una actividad, o `null`
 * @property {() => Promise<Archivo[]>} publicables  todo lo publicable del `dist/`
 * @property {(mensaje: string) => void} fallo  marca el gate en rojo
 * @property {() => boolean} sinFallos  si el gate sigue en verde hasta acá
 * @property {() => number} cuenta  cuántos fallos van
 * @property {(mensaje: string) => void} ok  imprime una línea verde
 * @property {string} rutaDeLaMiniatura  el objeto de Storage que el gate sembró (B-1790)
 */

/**
 * El contexto sobre una lista de archivos ya leída: el `dist/` de verdad en el
 * script, uno de mentira en el test. Ningún chequeo toca el disco por su cuenta.
 *
 * @param {Archivo[]} archivos
 * @param {ReturnType<typeof import('./resultado.mjs').crearResultado>} resultado
 * @param {{ rutaDeLaMiniatura: string }} extras
 * @returns {Contexto}
 */
export const contextoSobre = (archivos, resultado, { rutaDeLaMiniatura }) => {
  const porRuta = new Map(archivos.map((a) => [a.relativa, a.contenido]));
  const leer = async (ruta) => (porRuta.has(ruta) ? porRuta.get(ruta) : null);
  return {
    leer,
    htmlDe: (slug) => leer(`actividad/${slug}/index.html`),
    publicables: async () => archivos,
    fallo: resultado.fallo,
    ok: resultado.ok,
    sinFallos: resultado.sinFallos,
    cuenta: resultado.cuenta,
    rutaDeLaMiniatura,
  };
};
