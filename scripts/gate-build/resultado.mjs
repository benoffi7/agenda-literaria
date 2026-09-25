/**
 * **El rojo del gate, en un solo lugar** — B-1960 (M-11 del PRD 6).
 *
 * `build-contra-emulador.mjs` termina con `process.exit(resultado.salida)`.
 * Hasta B-1960, `fallo()` ponía `process.exitCode = 1` y el script salía con
 * `process.exit(salida)`, que **lo pisaba**: cada una de las 70 llamadas llevaba
 * un `salida = 1` a mano en la línea siguiente, y la que lo olvidara imprimía el
 * rojo y salía con 0. Ahora marcar el rojo es parte de `fallo()`, y
 * `tests/gate-build-resultado.test.ts` falla si deja de serlo.
 *
 * No toca `process`: recibe dónde escribir, para que el test lo use sin consola.
 *
 * @param {{ error?: (texto: string) => void, log?: (texto: string) => void }} [salidas]
 */
export const crearResultado = ({ error = console.error, log = console.log } = {}) => {
  let salida = 0;
  let fallos = 0;
  return {
    /** Imprime el mensaje en rojo y deja el gate en rojo. */
    fallo: (mensaje) => {
      error(`\n\x1b[31m✗ ${mensaje}\x1b[0m`);
      salida = 1;
      fallos += 1;
    },
    ok: (mensaje) => log(`  ✓ ${mensaje}`),
    sinFallos: () => salida === 0,
    /** Cuántos `fallo()` hubo: un chequeo lo mira antes y después para su ✓ propio. */
    cuenta: () => fallos,
    /** El código con el que sale el proceso. */
    get salida() {
      return salida;
    },
  };
};
