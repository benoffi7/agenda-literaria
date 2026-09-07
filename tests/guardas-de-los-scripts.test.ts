/**
 * **Todo script que escribe con `--aplicar` exige `--produccion` para apuntar
 * afuera del emulador** — B-630.
 *
 * ── Por qué es un test y no una convención escrita ────────────────────────
 * La regla existía —`docs/05-patrones.md` § «Idempotencia en los scripts»: los
 * scripts tienen guardas de entorno en las dos direcciones— y **nada la
 * verificaba**. El `auditor-trampas` la había encontrado faltando una vez
 * (`limpiar-imagenes-huerfanas.mjs` no la tenía, comparado contra
 * `seed-emulador.mjs` y `preparar-produccion.mjs`), o sea que ya se olvidó una
 * vez y el modo de falla es el peor posible: **el script corre y borra**.
 *
 * El olvido no es hipotético ni raro. Es exactamente el momento en que alguien
 * quiere probar el barrido «antes de confiar en la Function real» —lo que el §10
 * del `CLAUDE.md` pide hacer— y se olvida de exportar el host del emulador. Sin
 * la guarda, ese olvido apunta a producción y borra sin papelera.
 *
 * ── Se verifica la clase y no los scripts de hoy ──────────────────────────
 * La lista sale de `scripts/`: **todo** `.mjs` que acepte `--aplicar` tiene que
 * traer la guarda. Así el próximo entra al chequeo sin que nadie lo agregue, que
 * es el único orden en que esto sirve — y se comprobó al escribirlo: el barrido
 * encontró un tercero que nadie había mirado (`optimizar-imagenes.mjs`) y que no
 * la tenía.
 *
 * Es un chequeo **sobre el fuente**, y eso tiene un límite que conviene escribir:
 * verifica que la guarda **esté**, no que funcione. Que funciona se verificó a
 * mano contra el emulador al escribir cada script (el ida y vuelta está en
 * `docs/08-operacion.md`); lo que este test impide es que desaparezca.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raiz = (rel: string): string => `${process.cwd()}/${rel}`;

const scripts = (): string[] =>
  readdirSync(raiz('scripts'))
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => `scripts/${f}`);

/**
 * Los que **escriben**: aceptan `--aplicar`.
 *
 * «Escriben» y no «borran», y la diferencia la trajo un hallazgo: el barrido
 * encontró un tercero, `optimizar-imagenes.mjs`, que no borra —**reescribe todos
 * los objetos del bucket**— y no tenía la guarda. No es más benigno: un
 * `--aplicar` con el host del emulador sin exportar pasa el pipeline entero por
 * las imágenes de producción, y con el `sharp` de la máquina de quien lo corre y
 * no el de la Function. Así que el criterio de este archivo es el flag, no el
 * verbo.
 */
const losQueEscriben = (): { rel: string; src: string }[] =>
  scripts()
    .map((rel) => ({ rel, src: readFileSync(raiz(rel), 'utf8') }))
    .filter(({ src }) => src.includes("includes('--aplicar')"));

describe('las guardas de los scripts que escriben — B-630', () => {
  it('hay scripts que escriben, y son los que se esperan', () => {
    /*
     * Control positivo: si el detector dejara de encontrarlos —porque alguien
     * cambió cómo se lee el flag— los casos de abajo pasarían sin verificar nada,
     * que es la forma en que un barrido miente.
     *
     * Se afirma el conjunto y no solo la cantidad: un script nuevo que escriba
     * pone esto en rojo, y eso es a propósito. Es el momento de mirar si tiene la
     * guarda, no un mes después.
     *
     * Y **así apareció el tercero**: `optimizar-imagenes.mjs` estaba en la lista y
     * no en las expectativas, y al mirarlo no tenía la guarda. Es la primera cosa
     * que este chequeo encontró, antes de existir del todo.
     */
    expect(losQueEscriben().map((s) => s.rel).sort()).toEqual([
      'scripts/limpiar-imagenes-huerfanas.mjs',
      'scripts/limpiar-versiones-huerfanas.mjs',
      'scripts/optimizar-imagenes.mjs',
    ]);
  });

  it('cada uno aborta si `--aplicar` apunta afuera del emulador sin `--produccion`', () => {
    /*
     * Las tres piezas que hacen a la guarda, y las tres tienen que estar:
     * detectar el emulador por su variable de entorno, pedir el `--produccion`
     * explícito, y **cortar** (`process.exit`) en vez de seguir con un aviso.
     *
     * MUTACIÓN PROBADA: sacarle el `process.exit(1)` a cualquiera de los dos deja
     * este caso en rojo nombrando el archivo.
     */
    for (const { rel, src } of losQueEscriben()) {
      expect(src, `${rel}: no detecta el emulador por variable de entorno`).toMatch(
        /process\.env\.(FIRESTORE|FIREBASE_STORAGE)_EMULATOR_HOST/,
      );
      expect(src, `${rel}: no pide el --produccion explícito`).toContain("includes('--produccion')");
      // El corte, y con código distinto de 0: un script que avisa y sigue
      // escribiendo es peor que uno sin guarda, porque parece cuidado.
      expect(src, `${rel}: no corta con process.exit(1)`).toContain('process.exit(1)');
    }
  });

  it('y el default de cada uno es NO escribir', () => {
    /*
     * La otra mitad de la decisión, y la que hace usable a la primera: sin
     * `--aplicar` el script informa. Si el default fuera escribir, la guarda de
     * arriba sería lo único entre un `node scripts/…` distraído y la pérdida de
     * datos.
     *
     * Se busca la frase que imprimen, que es la que ve quien los corre.
     */
    for (const { rel, src } of losQueEscriben()) {
      // «no borra» o «no escribe», que es lo que imprime cada uno según lo que
      // haga. Lo que se exige es que el modo por defecto **se anuncie**.
      expect(src, `${rel}: no anuncia que el default no escribe`).toMatch(
        /informar \(no (borra|escribe)\)/,
      );
    }
  });

  it('los dos barridos no reimplementan la decisión: la importan de `functions/`', () => {
    /*
     * **La propiedad que hace que el script en seco valga algo.** Si el script
     * tuviera su propia copia de «qué borrar», mostraría un plan que la Function
     * no ejecuta — y mirarlo antes de confiar en la Function real no probaría
     * nada. Es la razón por la que las dos mitades puras viven en `functions/` y
     * reciben el `db`/los objetos por parámetro.
     *
     * Aplica a **los dos barridos** y no a los tres: `optimizar-imagenes.mjs` no
     * espeja ninguna decisión programada —pasa por el pipeline las imágenes que
     * ya estaban en el bucket antes de que la Function existiera, o sea que su
     * trabajo es justamente el que ninguna Function va a hacer— así que no hay
     * decisión que importar. La lista está acá y no en un `filter` para que el
     * día que eso cambie haya que venir a decidirlo.
     */
    const ESPEJAN_UNA_FUNCTION = [
      'scripts/limpiar-imagenes-huerfanas.mjs',
      'scripts/limpiar-versiones-huerfanas.mjs',
    ];
    for (const { rel, src } of losQueEscriben().filter((s) => ESPEJAN_UNA_FUNCTION.includes(s.rel))) {
      expect(src, `${rel}: no importa la decisión de functions/`).toMatch(
        /from '\.\.\/functions\/limpieza-(imagenes|versiones)\.js'/,
      );
      expect(src, `${rel}: parece tener su propia decisión`).not.toMatch(
        /const (decidirLimpieza|decidirPurga) =/,
      );
    }
    // Control: la lista no puede quedarse corta en silencio.
    expect(ESPEJAN_UNA_FUNCTION.every((r) => losQueEscriben().some((s) => s.rel === r))).toBe(true);
  });
});
