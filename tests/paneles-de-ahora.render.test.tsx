import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PanelesDeAhora } from '@/components/publico/PanelesDeAhora';
import type { ProgramacionInmediata } from '@/lib/ahoraPublico';

/**
 * **El clic del tríptico, por los dos caminos que lo pintan** — B-1501.
 *
 * `PanelesDeAhora` lo renderizan el build (HTML sin hidratar, sin la prop) y la
 * island (con `onEncuentro`, que es la que mide `clic_triptico`, B-601). Lo que
 * se fija acá:
 *
 * 1. **La island** llama a `onEncuentro` con el clic principal **y** con el del
 *    medio (`auxclick`, el que abre en pestaña nueva), una vez por gesto, y no
 *    con el botón derecho.
 * 2. **El build** no lleva ningún handler: sin la prop, el marcado es el mismo
 *    enlace liso, y un clic de cualquier botón no rompe nada.
 */

afterEach(cleanup);

const programacion: ProgramacionInmediata = {
  sello: 'Actualizado hoy',
  paneles: [
    {
      clave: 'finde',
      rotulo: 'Este finde',
      fechas: 'sáb 26 y dom 27',
      encuentros: [
        {
          clave: 'ses_1',
          ruta: '/actividad/un-taller/',
          iso: '2026-09-26T21:00:00.000Z',
          hora: '18:00',
          dia: 'sáb',
          titulo: 'Un taller',
          tipo: 'taller',
          tipoEtiqueta: 'Taller',
          lugar: 'Palermo',
          arancel: { texto: 'Gratis', sinCosto: true },
        },
      ],
      restantes: 0,
      resto: null,
      rutaDelResto: null,
    },
  ],
};

const auxclick = (button: number) => new MouseEvent('auxclick', { bubbles: true, button });

const enlaceDelEncuentro = () => screen.getByRole('link', { name: /Un taller/ });

describe('el tríptico de la island mide el enlace que se abre — B-1501', () => {
  it('el clic principal llama una vez, con la clave del panel', () => {
    const onEncuentro = vi.fn();
    render(<PanelesDeAhora programacion={programacion} tonos={{}} onEncuentro={onEncuentro} />);
    fireEvent.click(enlaceDelEncuentro());
    expect(onEncuentro).toHaveBeenCalledTimes(1);
    expect(onEncuentro).toHaveBeenCalledWith('finde');
  });

  it('el clic del medio también llama, una vez', () => {
    /* MUTACIÓN PROBADA: volver al `onClick` solo deja este caso en rojo. */
    const onEncuentro = vi.fn();
    render(<PanelesDeAhora programacion={programacion} tonos={{}} onEncuentro={onEncuentro} />);
    fireEvent(enlaceDelEncuentro(), auxclick(1));
    expect(onEncuentro).toHaveBeenCalledTimes(1);
    expect(onEncuentro).toHaveBeenCalledWith('finde');
  });

  it('el botón derecho no llama', () => {
    /* MUTACIÓN PROBADA: un `onAuxClick` que no mira el botón deja este caso en rojo. */
    const onEncuentro = vi.fn();
    render(<PanelesDeAhora programacion={programacion} tonos={{}} onEncuentro={onEncuentro} />);
    const enlace = enlaceDelEncuentro();
    fireEvent(enlace, auxclick(2));
    fireEvent.contextMenu(enlace);
    expect(onEncuentro).not.toHaveBeenCalled();
  });

  it('un `click` que no es del botón principal no cuenta: el gesto del medio no suma dos', () => {
    /*
     * Un navegador viejo que dispare `click` **y** `auxclick` por la rueda
     * mediría dos veces si `click` aceptara cualquier botón.
     */
    const onEncuentro = vi.fn();
    render(<PanelesDeAhora programacion={programacion} tonos={{}} onEncuentro={onEncuentro} />);
    const enlace = enlaceDelEncuentro();
    fireEvent.click(enlace, { button: 1 });
    fireEvent(enlace, auxclick(1));
    expect(onEncuentro).toHaveBeenCalledTimes(1);
  });
});

describe('el tríptico del build no lleva handler — B-1501', () => {
  it('sin `onEncuentro`, el HTML es el enlace liso', () => {
    const html = renderToStaticMarkup(
      <PanelesDeAhora programacion={programacion} tonos={{}} />,
    );
    expect(html).toContain('href="/actividad/un-taller/"');
    expect(html).not.toMatch(/onclick|onauxclick/i);
  });

  it('sin `onEncuentro`, ningún botón rompe', () => {
    render(<PanelesDeAhora programacion={programacion} tonos={{}} />);
    const enlace = enlaceDelEncuentro();
    expect(() => {
      fireEvent.click(enlace);
      fireEvent(enlace, auxclick(1));
      fireEvent(enlace, auxclick(2));
    }).not.toThrow();
  });
});
