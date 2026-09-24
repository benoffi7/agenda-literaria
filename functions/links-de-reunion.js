/**
 * El link de la reunión pegado en un texto libre, cambiado por un aviso — B-980,
 * B-1690, D-1036.
 *
 * Nació en `src/lib/descripcionEnlazada.ts` para la página de detalle, y bajó acá
 * cuando B-1690 mostró que el evento de Calendar publicaba la misma descripción
 * cruda: `functions/` no puede importar `src/` (D-20), así que la implementación
 * vive de este lado y el sitio la importa (D-88: se escribe una vez). Es el mismo
 * reparto que `handle-instagram.js`.
 *
 * Lo que decide «esto es un link de reunión» es un host conocido (con esquema o
 * sin él, porque el `?pwd=` viaja igual) o una coincidencia exacta con un
 * `online.url` de la actividad, para las plataformas que la lista no reconoce.
 */

/**
 * Los mismos hosts que `HOSTS_DE_REUNION` de `src/lib/schema.ts`, que no se
 * exporta. `tests/descripcionEnlazada.test.ts` compara las dos listas leyendo el
 * fuente, así que agregar una plataforma allá sin agregarla acá lo pone en rojo.
 */
const HOSTS_DE_REUNION =
  /(meet\.google|zoom\.us|teams\.microsoft|teams\.live|meet\.jit\.si|whereby\.com|discord\.gg|gotomeet)/i;

/** El texto que ocupa el lugar del link de la reunión. */
export const AVISO_DE_REUNION = '[el link de la reunión lo manda quien organiza cuando te anotás]';

const PUNTUACION_FINAL = /[.,;:!?…»«"'”’“‘]$/;

const cuenta = (texto, caracter) => texto.split(caracter).length - 1;

/**
 * Separa la puntuación que rodea a un token del token mismo. El cierre solo se
 * saca si no tiene su apertura adentro.
 *
 * @param {string} token
 * @returns {{ antes: string, nucleo: string, despues: string }}
 */
export const recortar = (token) => {
  const apertura = /^[(\[«"'“‘]+/.exec(token)?.[0] ?? '';
  let nucleo = token.slice(apertura.length);
  let despues = '';
  for (;;) {
    const ultimo = nucleo.slice(-1);
    const sobra =
      PUNTUACION_FINAL.test(ultimo) ||
      (ultimo === ')' && cuenta(nucleo, '(') < cuenta(nucleo, ')')) ||
      (ultimo === ']' && cuenta(nucleo, '[') < cuenta(nucleo, ']'));
    if (!sobra || !nucleo) break;
    despues = ultimo + despues;
    nucleo = nucleo.slice(0, -1);
  }
  return { antes: apertura, nucleo, despues };
};

/** Un link comparable: sin esquema, sin barra final y en minúsculas. */
const clave = (url) =>
  url.trim().replace(/^https?:\/{2}/i, '').replace(/\/+$/, '').toLowerCase();

/**
 * El texto sin ningún link de reunión: cada token que lo sea se cambia por
 * `AVISO_DE_REUNION`, conservando la puntuación que lo rodeaba.
 *
 * @param {string} texto
 * @param {readonly string[]} [conocidos] los `online.url` de la actividad
 * @returns {string}
 */
export const sinLinksDeReunion = (texto, conocidos = []) => {
  const exactos = new Set(conocidos.filter((u) => typeof u === 'string').map(clave).filter(Boolean));
  return texto.replace(/\S+/g, (token) => {
    const { antes, nucleo, despues } = recortar(token);
    const esReunion = HOSTS_DE_REUNION.test(nucleo) || exactos.has(clave(nucleo));
    return esReunion ? `${antes}${AVISO_DE_REUNION}${despues}` : token;
  });
};

/**
 * Los `online.url` de una actividad, de todas sus formas de cursar (D-130) y del
 * campo viejo `online`, para que `sinLinksDeReunion` reconozca también las
 * plataformas que la lista de hosts no conoce.
 *
 * @param {{ online?: { url?: unknown } | null, modalidades?: Array<{ online?: { url?: unknown } | null }> | null }} actividad
 * @returns {string[]}
 */
export const linksDeReunionDe = (actividad) =>
  [actividad?.online?.url, ...(actividad?.modalidades ?? []).map((m) => m?.online?.url)].filter(
    (u) => typeof u === 'string' && u.trim() !== '',
  );
