/**
 * **El formulario apilado, montado de verdad** — B-814, pedido del dueño el
 * 2026-09-08: «si es mobile es a lo largo y si es pc usar pestañas».
 *
 * El gemelo de `formulario-en-pestanias.render.test.tsx`, y existe por la misma
 * razón que aquél: **un `grep` sobre el JSX no distingue los dos casos.** El
 * mecanismo de las pestañas es «nueve paneles montados y ocho con `hidden`», así
 * que si la clase se aplica igual en vista celular el formulario se ve idéntico
 * al de pestañas y ningún test puro lo nota — la lista de secciones, el contero
 * por solapa y el registro siguen todos correctos.
 *
 * Tres cosas que solo el DOM puede decir, y las tres se pueden romper solas:
 *
 * - **que se vean las nueve secciones**, que es literalmente el pedido;
 * - **que no haya tira de solapas**, y que tampoco queden `tabpanel` huérfanos:
 *   un `role="tabpanel"` sin `tablist` que lo gobierne le miente al lector de
 *   pantalla, y eso no se ve mirando;
 * - **que la barra siga llevando al campo que falta** (B-184). Es el riesgo
 *   entero de esta vista, igual que lo fue de D-490 con el otro mecanismo: acá
 *   `setPestania` no movería nada, porque los nueve paneles están visibles y la
 *   sección que falta puede estar tres pantallas más abajo.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* La analítica se dobla entera, con los mismos exports que el otro archivo. */
vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => ({ valores: [], elegibles: [], cargando: false }),
  useLabelsTaxonomia: () => ({}),
}));

import { ActividadFormulario } from '@/components/admin/ActividadFormulario';
import { SECCIONES } from '@/lib/formulario/camposFaltantes';
import { PESTANIAS } from '@/lib/formulario/pestanias';

afterEach(cleanup);

/**
 * `scrollIntoView` no existe en jsdom, y `irASeccion` lo llama en esta vista.
 * Se dobla en vez de guardarse en el código: la guarda viviría en producción
 * para tapar una carencia del entorno de test, que es al revés.
 */
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const pintar = () =>
  render(
    <ActividadFormulario
      rol="admin"
      vistaDelPanel="celular"
      uid="uid-de-prueba"
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
    />,
  );

describe('apilado se ven todas las secciones, y no hay pestañas (B-814)', () => {
  it('no hay tira de solapas', () => {
    /*
     * MUTACIÓN PROBADA: sacando el `conPestanias &&` de `PestaniasFormulario`,
     * este caso falla — y el formulario queda con nueve solapas que en 390px
     * scrollean horizontal, que es el problema que el ítem describe.
     */
    pintar();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('y tampoco quedan `tabpanel` huérfanos', () => {
    // Sin `tablist` que los gobierne, un `tabpanel` le miente al lector de
    // pantalla: anuncia una pestaña que no existe.
    pintar();
    expect(screen.queryAllByRole('tabpanel', { hidden: true })).toHaveLength(0);
  });

  it('las nueve secciones están visibles a la vez', () => {
    /*
     * El pedido, literal: «a lo largo». Se cuenta contra `SECCIONES` —el
     * registro— y no contra un nueve escrito a mano: la sección que se agregue
     * mañana entra sola, igual que gana su pestaña sola en la otra vista.
     *
     * Se mira el **título** de cada una y no el panel, porque el título es lo que
     * se ve: una sección colapsada muestra su encabezado, que es lo que permite
     * recorrer el formulario con el pulgar.
     *
     * MUTACIÓN PROBADA: dejando el `p.id === pestania ? … : 'hidden'` sin la rama
     * de `!conPestanias`, este caso falla con ocho secciones invisibles.
     */
    const { container } = pintar();
    const visibles = [...container.querySelectorAll('section')].filter(
      (s) => !s.closest('.hidden'),
    );

    for (const seccion of SECCIONES) {
      const titulo = screen.getByText(seccion.titulo);
      expect(titulo.closest('.hidden'), `«${seccion.titulo}» está escondida`).toBeNull();
    }
    // Y que de verdad se contaron secciones: cero pasaría solo.
    expect(visibles.length).toBeGreaterThanOrEqual(PESTANIAS.length);
  });
});

describe('la barra sigue llevando al campo que falta, sin pestañas (B-184)', () => {
  it('el enlace de «para publicar falta» scrollea hasta la sección', async () => {
    /*
     * **El riesgo entero de esta vista.** Con pestañas, el enlace cambia de
     * solapa y hace foco (D-490). Apilado, `setPestania` no movería nada: los
     * nueve paneles están visibles y la sección que falta puede estar tres
     * pantallas abajo, o sea **fuera de la pantalla** — que es exactamente el
     * problema que B-184 resolvió cuando el campo estaba dentro de un acordeón
     * cerrado.
     *
     * Se afirma sobre el doble de `scrollIntoView` porque jsdom no tiene layout:
     * no hay scroll que medir, pero sí se puede afirmar que se pidió, y sobre
     * **qué** se pidió.
     *
     * MUTACIÓN PROBADA: sacando el bloque `if (!conPestanias)` de `irASeccion`,
     * este caso falla — nadie scrollea y el campo que falta queda donde estaba.
     */
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    pintar();

    /*
     * **El enlace se busca dentro de la barra**, como en el archivo gemelo: los
     * títulos de sección también son el texto de los encabezados de acordeón, y
     * ésos no llaman a `irASeccion` — clickear uno de ellos dejaría el test
     * verificando que abrir un acordeón no scrollea, que es cierto y no es esto.
     * La primera versión de este caso caía justo ahí.
     */
    const barra = screen.getByRole('status');
    const enlace = within(barra).getByRole('button', { name: /^Dónde/ });

    await userEvent.click(enlace);
    await vi.waitFor(() => expect(scroll).toHaveBeenCalled());

    // Y scrollea hasta ESA sección, no hasta cualquiera.
    expect(scroll.mock.instances[0]).toBe(document.getElementById('donde'));
  });
});

describe('cambiar de vista no reinicia el formulario a medio cargar — B-822', () => {
  /*
   * **Hoy no hay bug, y el test existe igual.** Se verificó a mano que ni
   * `AdminApp` ni el wrapper `diferido(...)` le ponen un `key={vistaDelPanel}` a
   * `ActividadFormulario`, así que cambiar de vista es un cambio de prop y React no
   * remonta nada. Lo que faltaba era la red — lo pidió el `auditor-trampas` como
   * «sin red», y es la clase de trampa que no falla al principio: alguien que
   * mañana agregue un `key` para forzar el remount —por ejemplo para resetear el
   * scroll al cambiar de vista, que es un pedido razonable— le **borra el
   * formulario en curso** a quien estaba cargando, y ningún test lo nota.
   *
   * Y el momento en que pasa es el peor posible: quien carga tocó el interruptor
   * justo porque el formulario le quedaba incómodo, o sea con datos ya escritos.
   */
  const pintarCon = (vista: 'pc' | 'celular') =>
    render(
      <ActividadFormulario
      rol="admin"
        vistaDelPanel={vista}
        uid="uid-de-prueba"
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );

  it('lo escrito sobrevive al pasar de «PC» a «Celular»', async () => {
    const { rerender } = pintarCon('pc');

    /*
     * **Se agarra por label, y eso es B-827 cerrado.** Este caso lo destapó: el
     * `htmlFor` de `Campo` era opcional y «Título» no lo pasaba, así que
     * `getByLabelText` no encontraba el control —o sea que un lector de pantalla
     * tampoco lo anunciaba— y hubo que agarrarlo por `placeholder`, que era un
     * parche del test y no del problema.
     *
     * Ahora `htmlFor` es requerido y el barrido de `clases-de-bug.test.ts` exige
     * el par `htmlFor`/`id`. Buscar por label acá es lo que prueba que la
     * asociación **resuelve en el DOM**: el barrido lee el fuente y no puede
     * saber si el id llega pintado.
     */
    const titulo = screen.getByLabelText(/título/i);
    await userEvent.type(titulo, 'Un ciclo a medio cargar');

    rerender(
      <ActividadFormulario
      rol="admin"
        vistaDelPanel="celular"
        uid="uid-de-prueba"
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );

    expect(
      (screen.getByLabelText(/título/i) as HTMLInputElement).value,
      'cambiar de vista remontó el formulario y se perdió lo cargado',
    ).toBe('Un ciclo a medio cargar');
  });

  it('y también al volver de «Celular» a «PC»', async () => {
    // Las dos direcciones: un `key` puesto de un lado rompe las dos, pero una
    // condición mal escrita —`key` solo en apilado, digamos— rompería una sola.
    const { rerender } = pintarCon('celular');

    await userEvent.type(screen.getByLabelText(/título/i), 'Otro a medio cargar');

    rerender(
      <ActividadFormulario
      rol="admin"
        vistaDelPanel="pc"
        uid="uid-de-prueba"
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );

    expect(
      (screen.getByLabelText(/título/i) as HTMLInputElement).value,
    ).toBe('Otro a medio cargar');
  });
});

describe('con más de una sección incompleta, el scroll cae en la primera — B-823', () => {
  /*
   * `ActividadFormulario` recorre `faltantes.secciones` **en orden inverso**
   * llamando a `irASeccion` por cada una. Con pestañas eso converge porque cada
   * `setPestania` pisa al anterior. Apilado, cada llamada agenda su propio
   * `requestAnimationFrame`, y el resultado también converge —los callbacks corren
   * en el orden en que se agendaron, así que el **último** en ejecutarse es el de
   * la **primera** sección— pero eso depende de que los `rAF` no se re-ordenen, y
   * nadie lo verificaba con más de un error a la vez.
   *
   * El archivo cubría el click manual en la barra, que es **una** sección. Lo pidió
   * el `auditor-trampas` como «sin red», y el peor caso es scrollear a la sección
   * equivocada al intentar publicar: molesta, no pierde nada. De ahí que sea P3.
   */
  it('el último scroll de sección es el de la sección más arriba', async () => {
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    pintar();

    /*
     * La barra lista lo que falta **en orden del documento**, así que su primer
     * enlace es la sección más arriba. Se deriva de ahí y no de un id escrito a
     * mano: la sección que se agregue mañana no rompe el caso, y si el orden de
     * `SECCIONES` cambia, el test sigue afirmando lo correcto.
     */
    const barra = screen.getByRole('status');
    const primerFaltante = within(barra).getAllByRole('button')[0]!;
    const titulo = primerFaltante.textContent?.trim() ?? '';
    const seccion = SECCIONES.find((s) => titulo.startsWith(s.titulo));
    expect(seccion, `no se pudo mapear «${titulo}» a una sección`).toBeDefined();

    // Un formulario vacío tiene varias secciones incompletas: si tuviera una, este
    // caso sería el que ya existe con otro nombre.
    expect(within(barra).getAllByRole('button').length).toBeGreaterThan(1);

    scroll.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /crear actividad/i }));

    await vi.waitFor(() => expect(scroll).toHaveBeenCalled());

    /*
     * Se miran solo los scrolls **de sección**: después de los `rAF` hay un
     * `setTimeout` que scrollea hasta `[data-campo-con-error]`, así que el último
     * scroll de todos no es de una sección. Lo que se afirma es el último de los
     * que sí lo son.
     */
    /*
     * `mock.instances` viene tipado por el `this` de `scrollIntoView`, que TS no
     * puede estrechar con `instanceof`. Se castea a `Element[]`, que es lo que son:
     * el doble se instaló en `Element.prototype`.
     */
    const deSeccion = (scroll.mock.instances as unknown as Element[]).filter(
      (el) => el?.tagName === 'SECTION',
    );
    expect(deSeccion.length, 'ninguna sección recibió scroll').toBeGreaterThan(0);
    expect(deSeccion[deSeccion.length - 1]).toBe(document.getElementById(seccion!.id));
  });
});
