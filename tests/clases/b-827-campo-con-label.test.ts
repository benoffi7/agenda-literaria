/**
 * B-827: todo `Campo` asocia su label con su control.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { fuente, versionados } from '../fixtures/clases-de-bug';

// ─────────────────────────────────────────────────────────────────────
// Clase de B-827 · una garantía de accesibilidad que es opt-in
// ─────────────────────────────────────────────────────────────────────

/**
 * B-827 — el `<label>` de `Campo` no estaba asociado a su control, y peor: la
 * asociación era **opcional**.
 *
 * `htmlFor` existía y once usos no lo pasaban, así que el label quedaba
 * huérfano y un lector de pantalla anunciaba «cuadro de texto» y nada más en un
 * formulario de treinta y pico de campos. Lo destapó el test de B-822, que no
 * pudo agarrar «Título» con `getByLabelText` y terminó agarrando por
 * `placeholder` — un parche del test, no del problema.
 *
 * **Es una clase y no una instancia**, por la misma razón que B-821: la
 * garantía existía pero era voluntaria, así que el uso que se agregara mañana
 * nacía mal por default. El arreglo tiene dos mitades y las dos hacen falta:
 *
 * 1. `htmlFor` pasa a ser **requerido** en el tipo — el compilador enumera lo
 *    que falta, que es lo que convirtió «hay que mirar once archivos» en una
 *    lista de 37 errores de tsc.
 * 2. Este barrido, para lo que el compilador **no** puede ver: que el hijo
 *    lleve *ese mismo* id. Un `htmlFor` que apunta a un id que nadie declara
 *    typecheckea igual y deja el label tan huérfano como antes.
 *
 * El campo que rotula un grupo de controles —la tira de botones de modalidad,
 * los dos de «¿Qué es?», el editor de galería— no tiene un control único al que
 * apuntar: ahí `comoGrupo` cambia el `<label for>` por un `role="group"` +
 * `aria-labelledby`, que es el mecanismo que corresponde. Sigue habiendo un id
 * obligatorio, así que sigue sin poder olvidarse.
 *
 * **Y ahora importa más que en el panel.** `campos/` salió de `admin/` para que
 * lo usen los formularios públicos de los cuatro PRDs
 * (`docs/prd/05-inventario-de-archivos.md` § 1.4): mover esto al sitio sin
 * arreglarlo convertía un problema de una herramienta que usan cuatro personas
 * en uno de una página pública.
 */
describe('clase de B-827 · todo `Campo` asocia su label con su control', () => {
  type UsoDeCampo = {
    archivo: string;
    /** El texto de los props del tag de apertura. */
    props: string;
    /** Lo que hay entre el tag de apertura y su `</Campo>`. */
    cuerpo: string;
  };

  /**
   * Los usos de `<Campo>`, sacados del fuente con un escaneo de llaves y no con
   * una regex: los props llevan expresiones con `>` adentro (`(e) => …`,
   * `a > b`), así que «hasta el primer `>`» corta en el lugar equivocado y el
   * barrido leería props de menos sin decirlo.
   */
  const usosDeCampo = (): UsoDeCampo[] => {
    const usos: UsoDeCampo[] = [];
    for (const archivo of versionados('src').filter((f) => f.endsWith('.tsx'))) {
      const src = fuente(archivo);
      for (let i = src.indexOf('<Campo'); i !== -1; i = src.indexOf('<Campo', i + 1)) {
        // `<CampoTaxonomia` no es `<Campo`.
        if (/[A-Za-z0-9_]/.test(src[i + 6] ?? '')) continue;
        let llaves = 0;
        let fin = -1;
        for (let j = i + 6; j < src.length; j++) {
          const c = src[j];
          if (c === '{') llaves++;
          else if (c === '}') llaves--;
          else if (c === '>' && llaves === 0) {
            fin = j;
            break;
          }
        }
        if (fin === -1) throw new Error(`${archivo}: un <Campo sin cerrar el tag de apertura`);
        const cierre = src.indexOf('</Campo>', fin);
        if (cierre === -1) throw new Error(`${archivo}: un <Campo sin </Campo>`);
        usos.push({
          archivo,
          props: src.slice(i + 6, fin),
          cuerpo: src.slice(fin + 1, cierre),
        });
      }
    }
    return usos;
  };

  it('el barrido encuentra los usos, y son muchos', () => {
    // Control positivo: sin esto, un escaneo roto deja los dos casos de abajo
    // en verde por vacuidad, que es la forma en que un barrido deja de ser red.
    const usos = usosDeCampo();
    expect(usos.length).toBeGreaterThan(25);
    expect(new Set(usos.map((u) => u.archivo)).size).toBeGreaterThan(8);
  });

  it('B-827: ningún `Campo` se monta sin `htmlFor`', () => {
    // El tipo ya lo exige; esto lo dice en el idioma del ítem, y agarra el día
    // que alguien lo vuelva opcional «porque este caso no lo necesita».
    const sinHtmlFor = usosDeCampo()
      .filter((u) => !/\bhtmlFor=/.test(u.props))
      .map((u) => `${u.archivo}: ${u.props.trim().slice(0, 60)}`);
    expect(sinHtmlFor, 'un `Campo` sin `htmlFor` deja su label huérfano').toEqual([]);
  });

  it('B-827: el hijo lleva ese mismo id, o el campo se declara `comoGrupo`', () => {
    /*
     * La mitad que el compilador no ve. `htmlFor="act-titulo"` con un input sin
     * `id` es exactamente el bug original y typecheckea perfecto.
     *
     * Se compara el **texto** de la expresión y no su valor: no hay forma de
     * evaluar `campoId('sede-nombre')` desde acá, y comparar el texto tiene el
     * efecto de al lado de obligar a que los dos lados se escriban igual, que
     * es lo que hace que se lean como un par.
     */
    const huerfanos = usosDeCampo()
      .filter((u) => !/\bcomoGrupo\b/.test(u.props))
      .filter((u) => {
        const m = /\bhtmlFor=(\{[\s\S]*?\}|"[^"]*")/.exec(u.props);
        if (!m) return false; // ya lo cobra el caso de arriba
        const valor = m[1]!;
        return !u.cuerpo.includes(`id=${valor}`);
      })
      .map((u) => `${u.archivo}: ${/label=("[^"]*"|\{[^}]*\})/.exec(u.props)?.[1] ?? '?'}`);
    expect(
      huerfanos,
      'el `htmlFor` apunta a un id que ningún hijo declara (o falta `comoGrupo`)',
    ).toEqual([]);
  });

  it('las dos formas de asociación siguen vivas en `Campo`', () => {
    // Que el componente siga cumpliendo su parte: el `<label for>` para un
    // control, el `role="group"` + `aria-labelledby` para un grupo. Sin esto,
    // los dos barridos de arriba miden el uso de una garantía que ya no existe.
    const campo = fuente('src/components/campos/Campo.tsx');
    expect(campo, 'el `<label>` dejó de apuntar al control').toContain('<label htmlFor={htmlFor}');
    expect(campo, 'el grupo dejó de nombrarse').toContain('aria-labelledby={htmlFor}');
    expect(campo, 'el rótulo del grupo dejó de tener id').toContain('<span id={htmlFor}');
    expect(campo, '`htmlFor` volvió a ser opcional').not.toMatch(/^\s*htmlFor\?:/m);
  });

  it('y hay al menos un `comoGrupo` de verdad, para que la salida no sea teórica', () => {
    const grupos = usosDeCampo().filter((u) => /\bcomoGrupo\b/.test(u.props));
    expect(grupos.length).toBeGreaterThan(2);
  });
});
