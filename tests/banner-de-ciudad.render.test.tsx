import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BannerDeCiudad } from '@/components/publico/BannerDeCiudad';
import { MEDIDA_ANCHA, MEDIDA_COMPACTA, type BannerDeCiudad as Banner } from '@/lib/bannerDeCiudad';

/**
 * **Lo que el banner tiene que decir de sí mismo** — B-961.
 *
 * Tres cosas, y ninguna es maquetación: las tres se rompen en silencio.
 *
 * 1. **Está identificado.** No lleva rótulo visible —no es publicidad, decisión
 *    del dueño (2026-09-15)— así que lo único que dice qué es son el `alt` de la
 *    imagen y el nombre en la región. Sin eso, para quien usa lector de pantalla
 *    es una imagen suelta arriba del listado.
 * 2. **El `rel` lleva `noopener` y NO lleva `sponsored`.** El primero impide que
 *    el destino toque esta pestaña. El segundo le declararía a Google que el
 *    enlace es publicidad, y no lo es: se fija por valor para que no vuelva a
 *    entrar de copiar otro enlace saliente.
 * 3. **La imagen tiene alto y ancho declarados**, en las dos piezas. Sin eso el
 *    listado salta hacia abajo cuando el banner termina de cargar, justo
 *    mientras alguien lo está leyendo.
 */

/*
 * El transporte de la analítica, reemplazado: acá se mira **qué** se le pide
 * medir, no si `gtag` lo manda. La guarda del consentimiento vive en
 * `medirSitio` y no es de este componente (B-963).
 */
const medirSitio = vi.hoisted(() => vi.fn());
vi.mock('@/lib/medicionSitio', () => ({ medirSitio }));

afterEach(() => {
  cleanup();
  medirSitio.mockClear();
});

const banner: Banner = {
  ciudad: 'mar-del-plata',
  nombre: 'Un emprendimiento',
  href: 'https://ejemplo.ar/',
  textoAlternativo: 'Una mesa con libros usados y un cartel escrito a mano',
  ancha: { src: '/banners/x-ancha.webp', ...MEDIDA_ANCHA },
  compacta: { src: '/banners/x-compacta.webp', ...MEDIDA_COMPACTA },
};

describe('el banner de una ciudad', () => {
  it('queda identificado sin rótulo visible: la región lleva el nombre y la imagen su alt', () => {
    render(<BannerDeCiudad banner={banner} />);
    expect(screen.getByRole('complementary', { name: banner.nombre })).toBeTruthy();
    expect(screen.getByAltText(banner.textoAlternativo)).toBeTruthy();
  });

  it('no se anuncia como publicidad: no hay rótulo ni `sponsored`', () => {
    /*
     * El control de la decisión del dueño. Las dos mitades: lo que se lee en la
     * pantalla y lo que se le declara a un buscador.
     */
    const { container } = render(<BannerDeCiudad banner={banner} />);
    expect(container.textContent ?? '').toBe('');
    expect(screen.getByRole('link').getAttribute('rel') ?? '').not.toContain('sponsored');
  });

  it('abre en una pestaña nueva sin dejarle la ventana al destino', () => {
    render(<BannerDeCiudad banner={banner} />);
    const enlace = screen.getByRole('link');
    expect(enlace.getAttribute('href')).toBe('https://ejemplo.ar/');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(enlace.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('reserva el espacio de la imagen antes de bajarla, en las dos piezas', () => {
    const { container } = render(<BannerDeCiudad banner={banner} />);

    const img = screen.getByAltText(banner.textoAlternativo);
    expect(img.getAttribute('width')).toBe(String(MEDIDA_COMPACTA.ancho));
    expect(img.getAttribute('height')).toBe(String(MEDIDA_COMPACTA.alto));
    expect(img.getAttribute('src')).toBe(banner.compacta.src);

    const source = container.querySelector('picture source');
    expect(source, 'sin `<source>` el teléfono y el escritorio comparten pieza').not.toBeNull();
    expect(source!.getAttribute('srcset')).toBe(banner.ancha.src);
    expect(source!.getAttribute('width')).toBe(String(MEDIDA_ANCHA.ancho));
    expect(source!.getAttribute('height')).toBe(String(MEDIDA_ANCHA.alto));
  });

  it('el clic se mide con la ciudad en slug y nada más — B-963', () => {
    /*
     * La decisión de privacidad del evento, fijada por valor: **ni el destino ni
     * el nombre del emprendimiento** viajan, solo `banner.ciudad`. `medirSitio`
     * recibe `Record<string, unknown>`, así que agregarle `href` compilaría y el
     * saneador lo descartaría en silencio: este caso lo pone en rojo antes.
     *
     * MUTACIÓN PROBADA: con `{ ciudad: banner.ciudad, href: banner.href }` en el
     * handler, el `toHaveBeenCalledWith` falla.
     */
    render(<BannerDeCiudad banner={banner} />);
    fireEvent.click(screen.getByRole('link'));
    expect(medirSitio).toHaveBeenCalledTimes(1);
    expect(medirSitio).toHaveBeenCalledWith('clic_banner_ciudad', { ciudad: 'mar-del-plata' });
  });

  it('el clic del medio también cuenta, una vez — B-1501', () => {
    /*
     * La rueda del mouse abre el banner en una pestaña nueva con `auxclick`, no
     * con `click`. El criterio es `alAbrirEnlace` (`lib/clicQueAbre.ts`), el
     * mismo del tríptico: un gesto, un evento.
     *
     * MUTACIÓN PROBADA: volver al `onClick` solo deja este caso en rojo.
     */
    render(<BannerDeCiudad banner={banner} />);
    fireEvent(screen.getByRole('link'), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(medirSitio).toHaveBeenCalledTimes(1);
    expect(medirSitio).toHaveBeenCalledWith('clic_banner_ciudad', { ciudad: 'mar-del-plata' });
  });

  it('el botón derecho no cuenta: abre un menú, no el enlace — B-1501', () => {
    /*
     * MUTACIÓN PROBADA: con `onAuxClick` sin mirar el botón, el derecho mide y
     * este caso queda en rojo.
     */
    render(<BannerDeCiudad banner={banner} />);
    const enlace = screen.getByRole('link');
    fireEvent(enlace, new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    fireEvent.contextMenu(enlace);
    expect(medirSitio).not.toHaveBeenCalled();
  });

  it('dibujarlo no mide nada: solo el clic', () => {
    render(<BannerDeCiudad banner={banner} />);
    expect(medirSitio).not.toHaveBeenCalled();
  });
});
