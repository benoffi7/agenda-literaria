/**
 * Dónde vive cada Cloud Function, preguntado y no cableado.
 *
 * ── Por qué existe (B-77) ─────────────────────────────────────────────────
 * Varios tests de este repo verifican que una **réplica** del cuerpo de un
 * trigger —la que usan para simular el sync sin emuladores— sigue siendo fiel al
 * original, leyendo el fuente y buscando líneas. Todos apuntaban a
 * `functions/index.js` por su nombre, porque ahí vivía todo.
 *
 * B-77 terminó el corte puro/trigger y movió `syncCalendar`, `rebuildPorOpciones`
 * y `dispararRebuild` a sus propios archivos. Los siete chequeos se pusieron
 * rojos de golpe, que es el buen final: el otro —que hubieran seguido en verde
 * leyendo un archivo donde ya no está lo que buscaban— es el modo de falla que
 * este repo persigue en todas partes («un chequeo que deja de encontrar lo que
 * busca pasa en verde sin verificar nada»).
 *
 * Re-apuntarlos a `functions/calendario-trigger.js` los habría dejado igual de
 * frágiles para la próxima mudanza. Esto pregunta **qué archivo declara esa
 * Function**, que es un dato del código y no una convención de nombres.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../functions/', import.meta.url));

const archivos = (): string[] => readdirSync(DIR).filter((f) => f.endsWith('.js'));

/**
 * El fuente del archivo que declara `export const <nombre> = onXxx(`.
 *
 * Tira si no lo encuentra o si lo declaran dos archivos: las dos cosas son
 * errores de este helper o del código, y ninguna puede terminar en un test que
 * pasa por no haber mirado nada.
 */
export const fuenteDeLaFunction = (nombre: string): string => {
  const declaracion = new RegExp(`export const ${nombre} = on\\w+\\(`);
  const encontrados = archivos()
    .map((f) => ({ archivo: f, src: readFileSync(DIR + f, 'utf8') }))
    .filter(({ src }) => declaracion.test(src));

  if (encontrados.length === 0) {
    throw new Error(
      `no encontré ninguna Function llamada \`${nombre}\` en functions/: ` +
        '¿se renombró, o dejó de declararse con `export const … = onXxx(`?',
    );
  }
  if (encontrados.length > 1) {
    throw new Error(
      `\`${nombre}\` está declarada en más de un archivo: ` +
        encontrados.map((e) => e.archivo).join(', '),
    );
  }
  return encontrados[0]!.src;
};

/**
 * El fuente de un módulo de `functions/` por su nombre de archivo, para lo que
 * no es un trigger (`github.js`, `marca-de-rebuild.js`).
 */
export const fuenteDelModulo = (archivo: string): string => readFileSync(DIR + archivo, 'utf8');

/**
 * Lo mismo que `fuenteDeLaFunction`, más el fuente de los módulos de
 * `functions/` que ese archivo importa (un nivel).
 *
 * Hace falta cuando lo que se verifica es una **propiedad del trigger que su
 * implementación delega**: la idempotencia de `syncCalendar` (B-82) es el id
 * derivado que elige `crearEvento`, y `crearEvento` vive en `calendario-api.js`
 * desde B-77. Preguntar solo por el archivo del trigger diría que la guarda no
 * está — que es la misma miopía que `tests/clases-de-bug.test.ts` resolvió
 * siguiendo la llamada (B-171).
 */
export const fuenteDeLaFunctionYSusModulos = (nombre: string): string => {
  const propia = fuenteDeLaFunction(nombre);
  const importados = [...propia.matchAll(/from '\.\/([\w.-]+\.js)'/g)].map((m) => m[1]!);
  return [propia, ...new Set(importados)].map((x) => (x === propia ? x : fuenteDelModulo(x))).join('\n');
};
