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

describe('la portada arriba no puede empujar la fecha fuera de la pantalla — D-144', () => {
  it('la imagen tiene relación de aspecto fija y recorta', () => {
    /*
     * Es **la** condición que hace válido el desvío del §4.3, que ponía la imagen
     * después de la ficha. El motivo de aquella decisión —«un flyer vertical de
     * Instagram como cabecera empuja la fecha fuera de la pantalla»— sigue siendo
     * cierto y lo que cambió es que el alto de la caja ya no depende del alto de
     * la imagen.
     *
     * **La relación tiene que estar sin prefijo de breakpoint**, y eso lo enseñó
     * la mutación: la primera versión de este aserto aceptaba cualquier
     * `aspect-[…]`, así que borrar el `aspect-[16/9]` base y dejar solo el
     * `sm:aspect-[2/1]` lo dejaba verde — con la caja sin recortar **justo en el
     * teléfono**, que es el único lugar donde el problema existe. Un aserto que
     * pasa en el caso que importa es peor que no tenerlo.
     *
     * MUTACIÓN PROBADA: sacar `aspect-[16/9]` (dejando el `sm:`) deja la página
     * igual con una imagen apaisada y rompe el caso del flyer vertical en móvil.
     * Este test lo agarra.
     */
    const codigo = sinComentarios(src());
    const img = /<img[\s\S]*?\/>/.exec(codigo)?.[0] ?? '';
    expect(img, 'no se encontró la portada').toContain('src={portada.url}');
    expect(
      img,
      'la portada necesita una relación de aspecto **sin prefijo**: el caso que se ' +
        'quiere evitar —el flyer vertical que empuja la fecha fuera de la pantalla— es el ' +
        'del teléfono, y ahí no aplica ningún `sm:`',
    ).toMatch(/["\s]aspect-\[\d+\/\d+\]/);
    expect(img, 'sin `object-cover` la imagen se deforma dentro de la caja').toContain(
      'object-cover',
    );
  });

  it('y se pide temprano, porque ahora es lo primero que se ve', () => {
    // Con la portada arriba, `loading="lazy"` retrasa el elemento más grande de
    // la pantalla inicial. Es el cambio que acompaña al de posición.
    const img = /<img[\s\S]*?\/>/.exec(sinComentarios(src()))?.[0] ?? '';
    expect(img).toContain('loading="eager"');
    expect(img).not.toContain('loading="lazy"');
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
