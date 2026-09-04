import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VisorDeGaleria from '@/components/publico/VisorDeGaleria';
import { posicionEnLaGaleria, rotuloDeAmpliar, rotuloDelVisor } from '@/lib/afiche';

/**
 * `VisorDeGaleria` — la capa de la galería, ejercitada de verdad (B-720, D-430).
 *
 * ── Por qué este archivo existe y no alcanza un test de fuente ────────────
 * `tests/galeria-del-detalle.test.ts` verifica el **markup del build**: que cada
 * imagen salga envuelta en su `<a href data-visor>`, con su rótulo, y que la
 * island sea una y `client:idle`. Eso es lo que se puede afirmar leyendo un
 * `.astro`, y no alcanza para una capa modal: el modo de falla de un visor es
 * **de comportamiento** y es silencioso en cualquier captura. Una capa que abre
 * pero no devuelve el foco, unas flechas que no dan la vuelta, un
 * `history.back()` de más que saca a la persona del sitio, un `alt` que se
 * pierde al pasar de la página a la capa: nada de eso se ve en el fuente, y la
 * lección de B-202 es exactamente que un test de fuente sobre este tipo de
 * cableado da falso verde.
 *
 * Vive en `.render.test.tsx` porque `vitest.config.ts` monta jsdom solo para ese
 * patrón, que es el rincón donde el repo acepta DOM de verdad.
 *
 * ── El DOM de prueba, y por qué se escribe a mano ─────────────────────────
 * La island **no recibe las imágenes**: las lee del HTML que imprimió el build
 * (§6.3). Así que el sujeto de prueba es ese HTML, y acá se reproduce con la
 * misma forma que `[slug].astro` emite —`figure > a[data-visor] > img` más el
 * `figcaption`—, verificada contra el HTML construido de verdad
 * (`dist/actividad/…/index.html`, el del gate de `build-contra-emulador.mjs`).
 *
 * Lo que hace legítima esa reproducción es el otro archivo: los asertos de
 * markup de `galeria-del-detalle.test.ts` son los que garantizan que la
 * plantilla siga emitiendo esta forma. Si divergen, ése falla.
 *
 * **La portada trae un `src` distinto del `href` a propósito**: el `<img>` de
 * arriba puede llevar la miniatura de 480px como candidato del `srcset`, y la
 * capa tiene que mostrar el **original** (D-210). Con `src === href` ese caso
 * sería invisible.
 *
 * ── Los asertos son `getAttribute` y no `toHaveAttribute` ─────────────────
 * El proyecto no tiene `@testing-library/jest-dom` y no se agrega una
 * dependencia para esto: es la misma forma que usan los otros tres tests de
 * render del repo.
 */
const ORIGINALES = {
  portada: 'https://ejemplo.com/imagenes/flyer-1600.jpg',
  patio: 'https://ejemplo.com/imagenes/patio-1600.jpg',
  publico: 'https://ejemplo.com/imagenes/publico-1600.jpg',
};

const MINIATURA_DE_PORTADA = 'https://ejemplo.com/miniaturas/flyer-480.jpg';
const TITULO = 'Taller de crónica de barrio';
const EPIGRAFE_PORTADA = 'El afiche de este año';
const EPIGRAFE_PATIO = 'El patio, en la edición pasada';

/**
 * El HTML de la galería tal como sale del build.
 *
 * `cuantas` cubre el caso mayoritario (una sola imagen: 26 de las 30 con imagen,
 * medido el 2026-09-02) y el de tres, que es el que ejercita el recorrido.
 */
const pintarGaleria = (cuantas: 1 | 2 | 3): void => {
  const secundarias = [
    { url: ORIGINALES.patio, epigrafe: EPIGRAFE_PATIO },
    { url: ORIGINALES.publico, epigrafe: '' },
  ].slice(0, cuantas - 1);

  document.body.innerHTML = `
    <main>
      <figure class="mt-6">
        <a href="${ORIGINALES.portada}" data-visor aria-label="${rotuloDeAmpliar(1)}" class="block">
          <img
            src="${MINIATURA_DE_PORTADA}"
            alt="Imagen de ${TITULO}"
            width="1080"
            height="1350"
          />
        </a>
        <figcaption>${EPIGRAFE_PORTADA}</figcaption>
      </figure>
      <section aria-labelledby="mas-imagenes">
        <h2 id="mas-imagenes">Más imágenes</h2>
        <div>
          ${secundarias
            .map(
              (s, i) => `
            <figure>
              <a href="${s.url}" data-visor aria-label="${rotuloDeAmpliar(i + 2)}" class="block">
                <img src="${s.url}" alt="" width="1408" height="768" loading="lazy" />
              </a>
              ${s.epigrafe ? `<figcaption>${s.epigrafe}</figcaption>` : ''}
            </figure>`,
            )
            .join('')}
        </div>
      </section>
      <div id="raiz-de-la-island"></div>
    </main>
  `;
};

/** El `<div>` donde monta la island, que en la página va al final del `main`. */
const montarVisor = () =>
  render(<VisorDeGaleria titulo={TITULO} />, {
    container: document.getElementById('raiz-de-la-island')!,
  });

const abridores = () => screen.getAllByRole('link');
const capa = () => screen.queryByRole('dialog');
/**
 * La imagen de la capa, por `querySelector` y no por `getByRole('img')`: una
 * secundaria va con `alt=""` (D-168), o sea que su rol es `presentation` y una
 * búsqueda por rol `img` **no la encontraría**. Que el aserto sirva para las dos
 * es justamente lo que hay que verificar.
 */
const imagenDeLaCapa = (): HTMLImageElement => {
  const img = capa()!.querySelector('img');
  expect(img, 'la capa no está mostrando ninguna imagen').not.toBeNull();
  return img as HTMLImageElement;
};
const urlEnLaCapa = (): string | null => imagenDeLaCapa().getAttribute('src');

/**
 * Abrir la capa clickeando el enlace número `n` de la galería.
 *
 * Va por `userEvent` y no por `elemento.click()` **porque el click tiene que
 * pasar por `act`**: la island escucha en `document`, o sea fuera del árbol que
 * `render` controla, así que un click crudo deja el `setState` de React encolado
 * y el DOM sin actualizar — el test pasaría a afirmar sobre una capa que todavía
 * no se pintó. Es la trampa propia de un componente que escucha el documento, y
 * la razón por la que este helper existe en vez de repetir el click.
 */
const abrir = async (n: number): Promise<HTMLElement> => {
  const enlace = abridores()[n]!;
  await userEvent.click(enlace);
  return enlace;
};

/**
 * El botón atrás del teléfono, que llega como `popstate`. Envuelto en `act` por
 * lo mismo que `abrir`: el cierre lo hace un listener de `window`.
 */
const botonAtras = async (): Promise<void> => {
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
};

beforeEach(() => {
  window.history.replaceState(null, '', '/actividad/taller-de-cronica');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('abrir la capa', () => {
  it('un click en una imagen abre la capa con ESA imagen, no con la primera', async () => {
    /*
     * El caso que ordena todo lo demás. El índice sale del **orden del
     * documento** (`querySelectorAll('[data-visor]')`), y por eso no hay ningún
     * número escrito en el markup: la portada es la 1 y la tira sigue.
     *
     * MUTACIÓN PROBADA: abrir siempre en `0` (`setIndice(0)`). Con una sola
     * imagen —el 87 % de los casos con imagen— no se nota nada; con tres, tocar
     * la foto del patio abre el flyer.
     */
    pintarGaleria(3);
    montarVisor();
    expect(capa(), 'la capa no existe hasta que alguien la abre').toBeNull();

    await abrir(1);

    expect(capa()).not.toBeNull();
    expect(urlEnLaCapa()).toBe(ORIGINALES.patio);
  });

  it('la capa muestra el ORIGINAL y no la miniatura del `srcset` — D-210', async () => {
    /*
     * **La razón por la que el abridor es un `<a href>` y no un `<button>`, más
     * allá de la degradación sin JavaScript.** El `href` es la URL original por
     * construcción, así que la capa no puede terminar mostrando la miniatura de
     * 480px estirada a pantalla completa: no tiene de dónde sacarla.
     *
     * MUTACIÓN PROBADA: leer `img.src` en vez del `href` del enlace. En
     * desarrollo se ve idéntico (las dos URLs existen) y en producción la capa
     * agranda una imagen de 480px justo cuando alguien la abrió para leer la
     * letra chica.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    expect(urlEnLaCapa()).toBe(ORIGINALES.portada);
    expect(urlEnLaCapa()).not.toContain('miniaturas');
  });

  it('un click con Cmd/Ctrl no se intercepta: sigue siendo «abrir en otra pestaña»', async () => {
    /*
     * La mitad progresiva del enlace. Si la island interceptara todo, el gesto
     * del navegador para abrir la imagen en otra pestaña —o guardarla— quedaría
     * reemplazado por una capa que nadie pidió.
     *
     * El listener de este test se engancha **después** del de la island (que se
     * enganchó al montar) solo para que jsdom no intente navegar de verdad: el
     * componente ya decidió antes.
     *
     * MUTACIÓN PROBADA: sacar la guarda de las teclas modificadoras.
     */
    pintarGaleria(3);
    montarVisor();
    const frenarNavegacion = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('click', frenarNavegacion);

    abridores()[0]!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }),
    );
    expect(capa(), 'con Cmd apretado la capa no se abre').toBeNull();

    document.removeEventListener('click', frenarNavegacion);
  });

  it('la capa es un diálogo con nombre, y el nombre dice de qué actividad es', async () => {
    // Un `role="dialog"` sin nombre se anuncia «diálogo» y nada más. Quien entra
    // desde una foto suelta necesita saber a qué actividad pertenece (D-125).
    pintarGaleria(1);
    montarVisor();
    await abrir(0);

    const dialogo = capa()!;
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dialogo.getAttribute('aria-label')).toBe(rotuloDelVisor(TITULO));
    expect(rotuloDelVisor(TITULO)).toContain(TITULO);
  });

  it('con una sola imagen no hay recorrido ni contador: no habría qué recorrer', async () => {
    /*
     * El caso mayoritario. Dos botones que no llevan a ninguna parte y un «1 de
     * 1» son ruido, y el pedido con una sola imagen es solo verla grande — que es
     * exactamente el caso del flyer con la letra chica que motivó B-720.
     */
    pintarGaleria(1);
    montarVisor();
    await abrir(0);

    const dialogo = capa()!;
    expect(within(dialogo).queryByLabelText('Imagen siguiente')).toBeNull();
    expect(within(dialogo).queryByLabelText('Imagen anterior')).toBeNull();
    expect(dialogo.textContent).not.toContain(posicionEnLaGaleria(1, 1));
    // Y el único control que queda es cerrar.
    expect(within(dialogo).getAllByRole('button')).toHaveLength(1);
  });

  it('la capa tiene UNA sola imagen en el aire: abrirla no baja las cuatro', async () => {
    /*
     * Las originales de una actividad suman hasta 3,15 MB (D-168) porque la
     * recompresión todavía no existe (B-220, DEC-7d). Una tira de miniaturas
     * dentro de la capa, o una precarga de la siguiente, costaría eso de golpe en
     * el momento en que alguien toca una foto.
     *
     * MUTACIÓN PROBADA: renderizar las tres imágenes y mostrar una con CSS. Se ve
     * igual y la capa cuesta las tres descargas.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    expect(capa()!.querySelectorAll('img')).toHaveLength(1);
  });

  it('la imagen de la capa no le cuenta a un tercero qué página se está mirando', async () => {
    // `referrerpolicy="no-referrer"`, igual que los `<img>` de la página: una
    // imagen externa la sirve un tercero, y sin esto recibe la URL del detalle en
    // el `Referer`. La capa es una salida nueva de la misma imagen.
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    expect(imagenDeLaCapa().getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('reserva la proporción de la imagen: `width` y `height` viajan a la capa', async () => {
    // Es lo que le da al navegador la forma antes de tener los bytes. Salen del
    // markup del build, que es donde el dato existe (`estiloDeAfiche`, D-147).
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    expect(imagenDeLaCapa().getAttribute('width')).toBe('1080');
    expect(imagenDeLaCapa().getAttribute('height')).toBe('1350');
  });
});

describe('recorrer la galería', () => {
  it('las flechas del teclado avanzan y el contador las acompaña', async () => {
    pintarGaleria(3);
    montarVisor();
    await abrir(0);
    expect(capa()!.textContent).toContain(posicionEnLaGaleria(1, 3));

    await userEvent.keyboard('{ArrowRight}');
    expect(urlEnLaCapa()).toBe(ORIGINALES.patio);
    expect(capa()!.textContent).toContain(posicionEnLaGaleria(2, 3));

    await userEvent.keyboard('{ArrowRight}');
    expect(urlEnLaCapa()).toBe(ORIGINALES.publico);
    expect(capa()!.textContent).toContain(posicionEnLaGaleria(3, 3));

    await userEvent.keyboard('{ArrowLeft}');
    expect(urlEnLaCapa()).toBe(ORIGINALES.patio);
    expect(capa()!.textContent).toContain(posicionEnLaGaleria(2, 3));
  });

  it('da la vuelta en los dos extremos: la última con → vuelve a la primera', async () => {
    /*
     * Con dos o tres imágenes, llegar al final y que la flecha no haga nada se
     * lee como un botón roto. El contador es lo que evita que la vuelta
     * desoriente: dice dónde estás.
     *
     * MUTACIÓN PROBADA: topear con `Math.min`/`Math.max`. Nada falla y el
     * recorrido queda con dos paredes invisibles.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    await userEvent.keyboard('{ArrowLeft}');
    expect(urlEnLaCapa()).toBe(ORIGINALES.publico);
    expect(capa()!.textContent).toContain(posicionEnLaGaleria(3, 3));

    await userEvent.keyboard('{ArrowRight}');
    expect(urlEnLaCapa()).toBe(ORIGINALES.portada);
  });

  it('los botones de recorrido son botones de verdad y con nombre accesible', async () => {
    /*
     * §10 del diseño: nada de `div` con `onClick`. Y el nombre no puede ser solo
     * la flecha visible: «←» se anuncia como el carácter que es.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    const siguiente = within(capa()!).getByLabelText('Imagen siguiente');
    expect(siguiente.tagName).toBe('BUTTON');
    await userEvent.click(siguiente);
    expect(urlEnLaCapa()).toBe(ORIGINALES.patio);

    await userEvent.click(within(capa()!).getByLabelText('Imagen anterior'));
    expect(urlEnLaCapa()).toBe(ORIGINALES.portada);
  });

  it('el cambio de imagen se anuncia: el contador es la live region de la capa', async () => {
    /*
     * Sin esto, recorrer la galería con el teclado es silencio para quien no ve
     * la foto nueva: el `alt` de una secundaria está vacío a propósito (D-168),
     * así que **el contador es lo único que dice que algo pasó**.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    const vivo = capa()!.querySelector('[aria-live="polite"]');
    expect(vivo, 'la capa no tiene ninguna región que anuncie el cambio').not.toBeNull();
    expect(vivo!.textContent).toContain(posicionEnLaGaleria(1, 3));
  });

  it('el epígrafe acompaña a SU foto, y el alt viaja como lo imprimió el build', async () => {
    /*
     * Dos decisiones heredadas, verificadas en el pasaje a la capa. El epígrafe
     * es de D-125 y es de **esa** imagen —no el de la portada repetido—, y el
     * `alt` es el que el build decidió: la portada trae el título (DEC-7a) y las
     * secundarias vienen vacías porque repetirlo N veces es peor (D-168).
     *
     * MUTACIÓN PROBADA: promover el epígrafe al `alt` en la capa. Un lector de
     * pantalla anuncia dos veces el mismo texto —como imagen y como pie—, que es
     * la repetición que D-168 sacó, en chico.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    expect(imagenDeLaCapa().getAttribute('alt')).toBe(`Imagen de ${TITULO}`);
    expect(capa()!.textContent).toContain(EPIGRAFE_PORTADA);

    await userEvent.keyboard('{ArrowRight}');
    expect(capa()!.textContent).toContain(EPIGRAFE_PATIO);
    expect(capa()!.textContent, 'el epígrafe de la portada no se queda pegado').not.toContain(
      EPIGRAFE_PORTADA,
    );
    // La secundaria es decorativa dentro de la capa también, y su epígrafe es lo
    // único que la describe.
    expect(imagenDeLaCapa().getAttribute('alt')).toBe('');
  });

  it('una imagen sin epígrafe no arrastra el de la anterior', async () => {
    // La tercera del fixture no tiene epígrafe (de las cuatro secundarias de
    // producción, ninguna lo tiene — medido el 2026-09-02).
    pintarGaleria(3);
    montarVisor();
    await abrir(2);

    expect(urlEnLaCapa()).toBe(ORIGINALES.publico);
    expect(capa()!.querySelector('figcaption')).toBeNull();
  });
});

describe('cerrar la capa, por los cuatro caminos', () => {
  it('`Escape` cierra y el foco vuelve al enlace que la abrió', async () => {
    /*
     * **La mitad de la accesibilidad que se rompe sin que nada falle.** Si el
     * foco no vuelve, quien navega con teclado queda en el `<body>` y tiene que
     * recorrer la página entera otra vez. Lo devuelve `useCapaModal`, y lo que lo
     * hace posible es que el componente enfoque el abridor **antes** de abrir: un
     * click en un enlace no lo enfoca en todos los navegadores.
     *
     * MUTACIÓN PROBADA: sacar el `enlace.focus()` del handler. En Chrome no se
     * nota (el click enfoca), y en Safari el foco se pierde.
     */
    pintarGaleria(3);
    montarVisor();
    const abridor = await abrir(1);
    expect(capa()).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(capa()).toBeNull();
    expect(document.activeElement).toBe(abridor);
  });

  it('al abrir, el foco entra a la capa: el `Tab` siguiente es de la capa', async () => {
    // `useCapaModal` enfoca la caja (que lleva `tabIndex={-1}`) y atrapa el
    // `Tab`. Sin eso, el primer `Tab` después de abrir seguiría recorriendo los
    // enlaces de la página **detrás** de la capa.
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    expect(document.activeElement).toBe(capa());
    expect(capa()!.getAttribute('tabindex')).toBe('-1');
  });

  it('el `Tab` no se escapa de la capa: del último control vuelve al primero', async () => {
    /*
     * La trampa de foco, que es la mitad que `useCapaModal` comparte y la que
     * convierte una capa de imágenes en una trampa si falta: sin ella, el `Tab`
     * sigue recorriendo los enlaces de la página que está **detrás**.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    const controles = within(capa()!).getAllByRole('button');
    expect(controles.length, 'cerrar + las dos flechas').toBe(3);
    controles[controles.length - 1]!.focus();

    await userEvent.tab();
    expect(capa()!.contains(document.activeElement), 'el foco se fue de la capa').toBe(true);
    expect(document.activeElement).toBe(controles[0]);
  });

  it('el botón «Cerrar» cierra', async () => {
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    await userEvent.click(within(capa()!).getByRole('button', { name: 'Cerrar' }));
    expect(capa()).toBeNull();
  });

  it('un toque en el fondo cierra; uno en la foto o en un control, no', async () => {
    /*
     * El gesto que ya tienen las otras capas del repo (B-238, `CentroAyuda`). La
     * mitad que importa es la negativa: si tocar la foto cerrara la capa, mirar
     * la imagen sería imposible en un teléfono.
     *
     * MUTACIÓN PROBADA: cerrar con cualquier `pointerdown` sobre la capa. La capa
     * se cierra al tocar la foto que se quería ver.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);

    await userEvent.pointer({ target: imagenDeLaCapa(), keys: '[MouseLeft]' });
    expect(capa(), 'tocar la foto no cierra').not.toBeNull();

    await userEvent.pointer({ target: capa()!, keys: '[MouseLeft]' });
    expect(capa(), 'tocar el fondo sí cierra').toBeNull();
  });

  it('el botón atrás del teléfono cierra la capa en vez de salir del sitio — B-720', async () => {
    /*
     * Abrir empuja **una** entrada de historial (`useHistorialDeCapa`), así que
     * el gesto más natural en un teléfono cierra la capa. Sin esto, el botón
     * atrás saca de la página de detalle a la que se llegó desde Google.
     *
     * MUTACIÓN PROBADA: sacar el `pushState`. En escritorio no se nota nunca.
     */
    pintarGaleria(3);
    montarVisor();
    /*
     * Se espía `pushState` en vez de mirar `history.length`, y no es una
     * comodidad: el largo del historial **no crece** cuando hay una entrada
     * hacia adelante, porque un `pushState` la trunca en vez de sumarse. Es el
     * comportamiento real de un navegador (y de jsdom), y hacía que este caso
     * fallara según qué había corrido antes. Lo que hay que afirmar es que se
     * empuja **una** entrada, con la misma URL.
     */
    const empujar = vi.spyOn(window.history, 'pushState');
    await abrir(0);
    expect(empujar, 'abrir empuja una entrada, y una sola').toHaveBeenCalledTimes(1);
    expect(empujar.mock.calls[0]![2], 'la URL no cambia: la capa no es una ruta').toBe(
      window.location.href,
    );

    // El botón atrás real llega como `popstate`.
    await botonAtras();
    expect(capa()).toBeNull();
  });

  it('cerrar por UI deshace esa entrada, y no retrocede dos veces', async () => {
    /*
     * La guarda que B-238 documenta, acá con su test. `history.back()` es
     * asíncrono: el `popstate` no llega en la misma vuelta, así que sin apagar la
     * bandera **antes** de llamarlo, un segundo cierre en esa ventana —`Escape`
     * mantenido, un doble toque— retrocedería una entrada de más y sacaría a la
     * persona del sitio.
     *
     * Se cuenta con un espía sobre `history.back` en vez de mirar
     * `history.length`: lo que hay que afirmar es «una sola vez», y el largo del
     * historial no distingue eso de «ninguna».
     *
     * MUTACIÓN PROBADA: mover el `nuestra.current = false` después del
     * `history.back()`.
     */
    pintarGaleria(3);
    montarVisor();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    await abrir(0);

    await userEvent.keyboard('{Escape}');
    expect(capa()).toBeNull();
    expect(back).toHaveBeenCalledTimes(1);

    // Y el `popstate` que ese `back()` real habría disparado no reabre nada ni
    // vuelve a retroceder.
    await botonAtras();
    expect(back).toHaveBeenCalledTimes(1);
    expect(capa()).toBeNull();
  });

  it('el botón atrás real no dispara un `back()` de más', async () => {
    /*
     * El otro lado del mismo cableado, y el que saca a la persona del sitio si se
     * cuenta mal: cuando el `popstate` viene del botón atrás, el navegador **ya
     * consumió** la entrada, así que la limpieza del efecto no tiene nada que
     * deshacer.
     */
    pintarGaleria(3);
    montarVisor();
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    await abrir(0);

    await botonAtras();
    expect(capa()).toBeNull();
    expect(back, 'el navegador ya volvió: no hay que volver otra vez').not.toHaveBeenCalled();
  });

  it('mientras la capa está abierta, el scroll de atrás queda frenado', async () => {
    // `useCapaModal` pone `overflow: hidden` en el `body` y restaura el valor
    // previo al cerrar. Sin eso, la rueda del mouse sobre la capa scrollea la
    // página de atrás.
    pintarGaleria(3);
    montarVisor();
    await abrir(0);
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('cerrar y volver a abrir funciona igual la segunda vez', async () => {
    /*
     * El cableado de una capa se engancha y se limpia en cada apertura (`activo`
     * de `useCapaModal`, el efecto de historial). Una limpieza mal hecha —un
     * listener que queda, una bandera que no se apaga— se ve recién en la
     * segunda vuelta, que es donde nadie mira.
     */
    pintarGaleria(3);
    montarVisor();
    await abrir(0);
    await userEvent.keyboard('{Escape}');

    await abrir(1);
    expect(capa()).not.toBeNull();
    expect(urlEnLaCapa()).toBe(ORIGINALES.patio);
    await userEvent.keyboard('{ArrowRight}');
    expect(urlEnLaCapa()).toBe(ORIGINALES.publico);
  });
});

describe('la capa no se pinta si no hay nada que mostrar', () => {
  it('sin galería en el HTML, la island no agrega ni un nodo', async () => {
    /*
     * La plantilla no la monta cuando la actividad no tiene imágenes, pero la
     * island tampoco puede depender de eso: un click en cualquier otra parte de
     * la página no abre una capa vacía.
     */
    document.body.innerHTML = '<main><div id="raiz-de-la-island"></div></main>';
    montarVisor();
    document.querySelector('main')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(capa()).toBeNull();
    expect(document.getElementById('raiz-de-la-island')!.innerHTML).toBe('');
  });
});
