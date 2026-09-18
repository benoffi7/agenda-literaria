/**
 * El encabezado entra en una pantalla de teléfono — B-1134.
 *
 * ── Qué se rompió ─────────────────────────────────────────────────────────
 * Lo reportó el dueño con una captura: en ~390px las ocho secciones se envolvían
 * en **tres filas** (`flex-wrap`, sin ninguna variante de teléfono) y el logo,
 * que comparte la fila, se partía en dos renglones y quedaba debajo. El
 * encabezado ocupaba casi un tercio de la pantalla de entrada y no se leía como
 * una barra.
 *
 * **Y creció sin que nadie lo decidiera**, que es lo que hace que un test valga
 * más que un arreglo: eran cuatro secciones, y Guía, Anunciar y Apoyar se
 * sumaron de a una. Ninguna tenía por qué mirar cómo quedaba el conjunto en un
 * teléfono. El comentario de `Encabezado.astro` ya lo había anticipado —«si en
 * algún momento no entran, lo que hay que revisar es esta fila entera y no sacar
 * la última que llegó»— y ese momento llegó sin que nada se pusiera rojo.
 *
 * ── Por qué se lee el fuente ──────────────────────────────────────────────
 * Es un `.astro`: no se puede montar en jsdom como un componente de React, y el
 * ancho de pantalla no existe en un test de todos modos. Lo que sí se puede
 * afirmar —y es lo que se rompió— es **la estructura**: que las secciones del
 * primer grupo estén afuera del desplegable, que las demás estén adentro, que el
 * corte salga de la lista y no de un número escrito dos veces, y que la fila no
 * pueda volver a envolverse.
 *
 * Es el mismo corte que `tests/chrome-del-sitio.test.ts`, que verifica que toda
 * página pase una sección: lo que se olvida, no lo que se ve.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const ENCABEZADO = 'src/components/sitio/Encabezado.astro';

const fuente = (): string =>
  readFileSync(fileURLToPath(new URL(`../${ENCABEZADO}`, import.meta.url)), 'utf8');

/**
 * **Sin comentarios** (D-124): este archivo cita el marcado viejo en su prosa, y
 * el de `Encabezado.astro` explica justamente por qué ya no hay `flex-wrap`. Un
 * aserto que lee prosa mide la prosa.
 */
const codigo = (): string => sinComentarios(fuente());

describe('el encabezado en una pantalla de teléfono — B-1134', () => {
  it('el control positivo: el archivo se lee y tiene las ocho secciones', () => {
    // Sin esto, una ruta mal escrita dejaría todo lo de abajo en verde sobre un
    // string vacío (B-873).
    const f = fuente();
    for (const seccion of [
      'agenda',
      'cartelera',
      'guia',
      'suscribirse',
      'ayuda',
      'contacto',
      'anunciar',
      'apoyar',
    ]) {
      expect(f, `falta la sección ${seccion}`).toContain(`seccion: '${seccion}'`);
    }
  });

  it('la barra sigue pudiendo envolverse, y eso es a propósito', () => {
    /*
     * **Lo aprendí sacándolo y mirando una captura.** La primera versión de
     * B-1134 quitó el `flex-wrap` pensando que envolver *era* el bug. No lo era:
     * con `nowrap`, las cuatro cosas que quedan en el teléfono —las tres
     * principales y el desplegable— **desbordan** en vez de envolverse, y
     * empujan el ancho de la página entera; el título de la home pasó a cortarse
     * a la derecha.
     *
     * El bug era tener **ocho** para envolver, no envolver. Esto queda fijado
     * para que el próximo que lo lea no repita el atajo.
     */
    const barra = /<ul class="-me-2 flex[^"]*"/.exec(codigo());
    expect(barra, 'no se encontró la lista de la barra').not.toBeNull();
    expect(barra![0], 'sin `flex-wrap` la barra desborda en vez de envolverse').toContain(
      'flex-wrap',
    );
  });

  it('el desplegable flota: abrirlo no puede estirar el encabezado', () => {
    /*
     * La otra mitad de lo mismo, y también salió de una captura: como nace
     * abierto cuando la sección actual está adentro, entrar a `/ayuda` desde el
     * teléfono estiraba el encabezado a media pantalla y mandaba el logo al
     * fondo — peor que el problema que este ítem venía a arreglar.
     */
    const c = codigo();
    expect(c, 'el `<details>` perdió su ancla de posicionamiento').toContain(
      '<details open={activaEstaAdentro} class="relative">',
    );
    const panel = /<ul class="absolute[^"]*"/.exec(c);
    expect(panel, 'el panel del desplegable volvió al flujo').not.toBeNull();
    // Sin sombra: lo que separa una superficie de otra en este sistema es una
    // regla (regla 1 de `global.css`).
    expect(panel![0], 'una sombra acá contradice el sistema visual').not.toContain('shadow');
    expect(panel![0]).toContain('border');
  });

  it('el corte sale de la lista, no de un número escrito dos veces', () => {
    /*
     * `PRINCIPALES` y `SECUNDARIAS` se derivan de `ENLACES` con el mismo número.
     * Escritas a mano serían dos listas que se separan: agregar una sección al
     * medio la dejaría afuera de las dos, o en las dos.
     */
    const c = codigo();
    expect(c).toContain('ENLACES.slice(0, A_LA_VISTA_EN_MOBILE)');
    expect(c).toContain('ENLACES.slice(A_LA_VISTA_EN_MOBILE)');
  });

  it('en el teléfono, el desplegable se esconde de `sm` para arriba y la fila larga al revés', () => {
    // Las dos mitades del mismo interruptor. Si una se olvida, en el teléfono se
    // ven las secciones dos veces, o en el escritorio no se ve el desplegable
    // pero tampoco la fila.
    const c = codigo();
    expect(c, 'el desplegable no se esconde en escritorio').toContain('<li class="sm:hidden">');
    expect(c, 'la fila larga no se esconde en el teléfono').toContain(
      '<li class="hidden sm:block">',
    );
  });

  it('es un `<details>` nativo y no una isla', () => {
    /*
     * Abrir y cerrar un menú es lo que el elemento hace —con teclado, con `Esc` y
     * anunciado como desplegable—, así que una isla de React acá sería bajar un
     * runtime al sitio público para reimplementar peor lo que el navegador trae.
     * El sitio no tiene más JS que la island de filtros, y esto no lo cambia.
     */
    const c = codigo();
    expect(c).toMatch(/<details[^>]*>/);
    expect(c).toMatch(/<summary/);
    expect(c, 'el encabezado no puede volverse una isla').not.toMatch(/client:(load|only|idle)/);
  });

  it('si la sección actual quedó adentro, el desplegable nace abierto y se marca', () => {
    // Sin esto, quien está en «Ayuda» abre el sitio en el teléfono y no ve por
    // ningún lado dónde está parado: la pestaña activa está escondida.
    const c = codigo();
    expect(c).toContain('const activaEstaAdentro = SECUNDARIAS.some((e) => e.seccion === activa)');
    expect(c).toContain('open={activaEstaAdentro}');
    expect(c, 'el rótulo del desplegable no marca que la activa está adentro').toMatch(
      /activaEstaAdentro\s*\n?\s*\?\s*'border-b-2 border-acento text-acento'/,
    );
  });

  it('el estilo de una pestaña está escrito una sola vez', () => {
    /*
     * Hay **tres** lugares que dibujan pestañas —las principales, las del
     * desplegable y las de la fila de escritorio—. Inline serían tres copias del
     * mismo `class:list`, y la que se olvide de actualizar es la que muestra la
     * sección activa sin marcar. Es la clase de D-88.
     */
    const c = codigo();
    expect(c).toContain('const clasePestania =');
    // Tres usos: uno por lugar. Si aparece un cuarto lugar que escribe el estilo
    // a mano, este número deja de coincidir y hay que venir a mirarlo.
    expect(c.match(/class=\{clasePestania\(seccion\)\}/g) ?? []).toHaveLength(3);
  });

  it('las tres que quedan a la vista son las tres formas de buscar', () => {
    /*
     * El corte no es «cuántas entran»: es el primer grupo de `ENLACES`, el que el
     * comentario de «Guía» define como las tres formas de buscar algo en este
     * sitio. Si alguien reordena la lista y el corte deja de coincidir con ese
     * grupo, esto se pone rojo y hay que releer la decisión, no correr el número.
     */
    const c = codigo();
    expect(c).toContain('const A_LA_VISTA_EN_MOBILE = 3');
    const orden = [...c.matchAll(/seccion: '([a-z]+)'/g)].map((m) => m[1]);
    expect(orden.slice(0, 3)).toEqual(['agenda', 'cartelera', 'guia']);
  });
});
