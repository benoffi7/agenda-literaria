import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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

afterEach(cleanup);

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
});
