/**
 * `EstadisticasPanel` — las pestañas internas, renderizadas de verdad (B-501).
 *
 * **Por qué este componente necesita DOM.** Qué panel se muestra y la
 * navegación por teclado son cableado real —`document.activeElement`, el
 * `aria-selected` que cambia, el `tabIndex` que se mueve entre botones— que un
 * test que lea el fuente no puede verificar sin arriesgarse a un falso verde
 * (la misma familia de `tests/menu-acciones.render.test.tsx`, y la misma
 * lección de B-202).
 *
 * `listarActividades`, `medirFuncion` y `useLabelsTaxonomia` van mockeados: lo
 * que este archivo cuida son las pestañas, no `estadoDelCatalogo` (ya cubierto
 * puro en `tests/estado-del-catalogo.test.ts`) ni la lectura de Firestore.
 *
 * Vive en `.render.test.tsx` y no en `.test.ts` por el mismo motivo que
 * `menu-acciones.render.test.tsx`: `vitest.config.ts` solo monta jsdom para
 * ese patrón (`environmentMatchGlobs`).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actividades', () => ({
  listarActividades: vi.fn(async () => []),
}));
vi.mock('@/lib/analytics', () => ({
  medirFuncion: vi.fn(),
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useLabelsTaxonomia: () => ({}),
}));

import { EstadisticasPanel } from '@/components/admin/EstadisticasPanel';

afterEach(() => cleanup());

const montar = async () => {
  render(<EstadisticasPanel onEditar={() => {}} />);
  // El tablist recién aparece cuando `listarActividades()` resuelve — el
  // mismo instante en que se apaga «Cargando…».
  return screen.findByRole('tablist');
};

describe('EstadisticasPanel — qué panel se muestra (B-501)', () => {
  it('arranca en «El catálogo», con su contenido', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    expect(tabCatalogo.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Todavía no hay actividades cargadas/)).not.toBeNull();
    expect(screen.queryByText(/La medición del sitio arranca/)).toBeNull();
  });

  it('un clic en «El sitio público» cambia el panel que se ve, no solo el botón activo', async () => {
    await montar();
    await userEvent.click(screen.getByRole('tab', { name: 'El sitio público' }));

    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });
    expect(tabSitio.getAttribute('aria-selected')).toBe('true');
    // La mitad que un cambio de estilo sin cambiar el contenido no puede
    // fingir: el texto de la otra pestaña tiene que estar, y el del catálogo
    // ya no.
    expect(screen.getByText(/La medición del sitio arranca/)).not.toBeNull();
    expect(screen.queryByText(/Todavía no hay actividades cargadas/)).toBeNull();
  });
});

describe('EstadisticasPanel — navegación por teclado (B-501)', () => {
  it('ArrowRight mueve el foco Y activa la pestaña siguiente, en el mismo gesto', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });

    tabCatalogo.focus();
    act(() => {
      fireEvent.keyDown(tabCatalogo, { key: 'ArrowRight' });
    });

    expect(document.activeElement).toBe(tabSitio);
    expect(tabSitio.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/La medición del sitio arranca/)).not.toBeNull();
  });

  it('ArrowLeft desde la primera pestaña da la vuelta a la última (wrap)', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });

    tabCatalogo.focus();
    act(() => {
      fireEvent.keyDown(tabCatalogo, { key: 'ArrowLeft' });
    });

    expect(document.activeElement).toBe(tabSitio);
    expect(tabSitio.getAttribute('aria-selected')).toBe('true');
  });

  it('roving tabindex: solo la pestaña activa es alcanzable con Tab', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });

    expect(tabCatalogo.tabIndex).toBe(0);
    expect(tabSitio.tabIndex).toBe(-1);

    tabCatalogo.focus();
    act(() => {
      fireEvent.keyDown(tabCatalogo, { key: 'ArrowRight' });
    });

    expect(tabSitio.tabIndex).toBe(0);
    expect(tabCatalogo.tabIndex).toBe(-1);
  });
});
