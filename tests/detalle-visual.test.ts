import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * La forma de la página de detalle — B-253, D-144, D-145.
 *
 * ── Por qué hay un test de markup y no «se mira y listo» ──────────────────
 * Porque las tres cosas que este archivo fija **se rompen sin que se note**:
 *
 * 1. **El CTA duplicado.** El botón de inscripción se escribe dos veces —uno para
 *    el flujo de escritorio, otro para la barra fija del teléfono— y cada uno
 *    está detrás de un `sm:`. Sacarle el `hidden` a uno deja los dos visibles en
 *    la misma pantalla: se ve casi bien, y quien escucha la página oye el mismo
 *    enlace dos veces.
 * 2. **La barra fija sin el aire abajo.** `position: fixed` tapa la última fila
 *    del pie al llegar al final del scroll. El aire lo da un `<style>` de esta
 *    ruta, y son dos piezas que solo funcionan juntas: borrar una deja la otra
 *    verde.
 * 3. **`sticky` volviendo a entrar.** `Base.astro` le pone `overflow-x-hidden` al
 *    `body`, y un ancestro con `overflow` distinto de `visible` **rompe
 *    `position: sticky` en silencio** — el elemento simplemente nunca se pega, sin
 *    error ni warning. Es la razón por la que la barra es `fixed`, y es
 *    exactamente el tipo de cosa que alguien «mejora» seis meses después.
 *
 * Es la misma familia que `tests/pagina-de-detalle.test.ts`: propiedades del
 * archivo que solo se ven leyéndolo, porque un `.astro` no se importa desde
 * vitest.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const DETALLE = 'src/pages/actividad/[slug].astro';
const src = (): string => readFileSync(raiz(DETALLE), 'utf8');

/** El archivo sin comentarios: los docblocks explican justo lo que se prohíbe. */
const sinComentarios = (s: string): string =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

describe('el CTA de inscripción: uno por pantalla — B-238, D-145', () => {
  it('control positivo: la página tiene el botón y la barra', () => {
    const codigo = sinComentarios(src());
    expect(codigo).toContain('detalle.inscripcion.accion.href');
    expect(codigo).toContain('claseBotonPrimario');
  });

  it('se pinta exactamente dos veces, y cada una detrás de su corte', () => {
    /*
     * Dos y no una: en el teléfono el del flujo no alcanza —queda arriba de todo
     * y el CTA tiene que estar siempre a mano (§8)—, y en escritorio la barra
     * fija se come pantalla sin necesidad, porque el del flujo se ve sin
     * scrollear.
     *
     * MUTACIÓN PROBADA: sacar el `hidden` del botón del flujo deja tres
     * ocurrencias del corte y este test lo dice. Duplicar el enlace sin corte
     * también.
     */
    const codigo = sinComentarios(src());
    const veces = [...codigo.matchAll(/detalle\.inscripcion\.accion\.href/g)].length;
    expect(veces, 'el CTA se pinta dos veces: el del flujo y el de la barra').toBe(2);

    // El del flujo: oculto en el teléfono. La barra: oculta de `sm` en adelante.
    expect(codigo, 'al botón del flujo le falta el corte `hidden sm:block`').toContain(
      'hidden sm:block',
    );
    expect(codigo, 'a la barra fija le falta el corte `sm:hidden`').toContain('sm:hidden');
  });

  it('la barra fija viene con el aire que evita que tape el pie', () => {
    /*
     * Las dos mitades de la misma decisión, y solo sirven juntas. Sin el
     * `padding-bottom` del `body`, al final del scroll la barra se come la última
     * fila del pie — que es donde están «Sugerir una actividad» y el Instagram.
     *
     * MUTACIÓN PROBADA: borrar el bloque `<style is:global>` deja el test en
     * rojo aunque la página se siga viendo perfecta en cualquier captura que no
     * llegue al final.
     */
    const codigo = sinComentarios(src());
    expect(codigo).toMatch(/fixed inset-x-0 bottom-0/);
    expect(codigo).toMatch(/padding-bottom:\s*calc\([^)]*safe-area-inset-bottom\)/);
    // Y el respiro de la barra de gestos del iPhone, que es la otra mitad.
    expect(codigo).toContain('pb-segura');
  });

  it('no vuelve a ser `sticky` mientras el `body` recorte el overflow', () => {
    /*
     * Un invariante condicional y no una prohibición: `sticky` sería **mejor**
     * —se suelta sola al final del contenido y no haría falta el aire de arriba—
     * y el único motivo por el que no se usa es el `overflow-x-hidden` del `body`.
     * El día que eso cambie (a `overflow-x: clip`, por ejemplo, que no crea
     * contenedor de scroll), este test deja de oponerse solo.
     */
    const base = readFileSync(raiz('src/layouts/Base.astro'), 'utf8');
    const bodyRecorta = /<body[^>]*overflow-x-hidden/.test(base);
    const usaSticky = /sticky[^"']*bottom-0/.test(sinComentarios(src()));

    expect(
      usaSticky && bodyRecorta,
      'la barra usa `position: sticky` y el `body` tiene `overflow-x-hidden`: un ancestro ' +
        'con overflow recortado rompe sticky en silencio, así que la barra nunca se pega. ' +
        'O la barra vuelve a `fixed`, o el layout pasa a `overflow-x: clip`.',
    ).toBe(false);
  });
});

describe('la portada arriba no puede empujar la fecha fuera de la pantalla — D-144, D-147', () => {
  it('la caja topea el alto y la proporción sale de la imagen', () => {
    /*
     * Es **la** condición que hace válido el desvío del §4.3, que ponía la imagen
     * después de la ficha. El motivo de aquella decisión —«un flyer vertical de
     * Instagram como cabecera empuja la fecha fuera de la pantalla»— sigue siendo
     * cierto, y **lo que lo atiende cambió en B-263**.
     *
     * Hasta D-144 lo atendía una proporción fija (`--aspect-portada`, 16/9) con
     * `object-cover`. Eso cumplía la condición y rompía otra cosa: los flyers del
     * circuito son verticales (0,87), así que la página perdía el 51 % de la
     * imagen — el título, la fecha y cómo anotarse, que en un flyer están
     * tipografiados adentro del JPEG.
     *
     * Ahora lo atiende el **tope de alto** de `claseAfiche`, y la proporción sale
     * de `ancho`/`alto` de cada imagen. Los dos asertos son la clase y no la
     * instancia: no se exige un valor, se exige que el valor **no esté escrito
     * acá**.
     *
     * MUTACIONES PROBADAS:
     *  - cambiar `claseAfiche` por las mismas utilidades copiadas en el atributo
     *    deja la página **idéntica** y pone esto en rojo: es la divergencia que
     *    `--aspect-portada` frenaba y que la clase compartida frena mejor.
     *  - agregar `object-cover` al lado de la clase la pisa (dos `object-fit` los
     *    resuelve el orden de la hoja, no el del atributo) y vuelve el recorte
     *    de B-263 sin que nada más falle. El aserto lo prohíbe.
     *  - sacar `estiloDeAfiche` deja la imagen entera pero sin reservar la caja,
     *    o sea con el salto de layout que la medida existe para evitar.
     */
    const codigo = sinComentarios(src());
    const img = /<img[\s\S]*?\/>/.exec(codigo)?.[0] ?? '';
    expect(img, 'no se encontró la portada').toContain('src={portada.url}');
    expect(
      img,
      'la portada usa `claseAfiche`, que es donde vive la regla compartida de que ' +
        'ninguna salida recorta (D-147)',
    ).toContain('class={claseAfiche}');
    expect(
      img,
      'la proporción no se escribe a mano: sale de la imagen, con `estiloDeAfiche`',
    ).not.toMatch(/aspect-\[|aspect-portada/);
    expect(img, 'la caja se reserva con la medida de la imagen').toContain(
      'style={estiloDeAfiche(portada)}',
    );
    expect(
      img,
      'un `object-cover` al lado de la clase la pisa y devuelve el recorte de B-263',
    ).not.toContain('object-cover');

    // Y `--aspect-portada` no vuelve por la puerta de atrás: se retiró en D-147
    // porque cualquier proporción única recorta alguna forma de imagen.
    const css = readFileSync(raiz('src/styles/global.css'), 'utf8');
    expect(css).not.toMatch(/^\s*--aspect-portada:/m);
  });

  it('y se pide temprano, porque ahora es lo primero que se ve', () => {
    // Con la portada arriba, `loading="lazy"` retrasa el elemento más grande de
    // la pantalla inicial. Es el cambio que acompaña al de posición.
    const img = /<img[\s\S]*?\/>/.exec(sinComentarios(src()))?.[0] ?? '';
    expect(img).toContain('loading="eager"');
    expect(img).not.toContain('loading="lazy"');
  });
});

describe('la página no dice dos cuentas distintas de lo mismo — B-258', () => {
  it('el título de la lista de encuentros no lleva número', () => {
    /*
     * Lo encontró **mirar el HTML del build**, no un test: la ficha decía «Ciclo
     * de 4 encuentros» y el título de abajo «Los 5 encuentros», en la misma
     * pantalla. Las dos cuentas están bien por separado —la ficha cuenta los que
     * quedan en pie, la lista numera sobre todos porque el número es la identidad
     * del encuentro dentro del ciclo (D-95)— y ninguna se puede cambiar sin
     * romper algo. Lo que sobraba era decir el número dos veces.
     *
     * MUTACIÓN PROBADA: volver a `Los ${detalle.encuentros.length} encuentros`
     * pone esto en rojo.
     */
    const codigo = sinComentarios(src());
    const h2 = /<h2 id="encuentros"[\s\S]*?<\/h2>/.exec(codigo)?.[0] ?? '';
    expect(h2, 'no se encontró el título de la lista de encuentros').toContain('El encuentro');
    expect(
      h2,
      'el título de la lista no puede llevar la cuenta de encuentros: la ficha ya da una ' +
        'cuenta distinta —y correcta— unas líneas más arriba',
    ).not.toContain('encuentros.length}');
  });
});

describe('la página sigue sin JavaScript — §4.3, presupuesto de 0 KB', () => {
  it('el único `<script>` es el de los datos estructurados', () => {
    /*
     * `tests/pagina-de-detalle.test.ts` prohíbe las islands (`client:`), que es la
     * forma en que entraría React. Esto cierra la otra puerta, que es la que B-253
     * abría de verdad: **la barra fija con JavaScript** que pedía el §8 —medir el
     * scroll para mostrarla recién cuando el botón original sale de la pantalla—
     * habría sido un `<script>` suelto, sin island y sin que aquel test dijera
     * nada.
     *
     * MUTACIÓN PROBADA: agregar un `<script>` de dos líneas para el scroll deja
     * verde el test de islands y rojo éste.
     */
    const scripts = [...sinComentarios(src()).matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]!);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('application/ld+json');
  });
});
