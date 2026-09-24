/**
 * **El «Motivo» de un encuentro cancelado se tipea a opacidad plena** — B-1570.
 *
 * Desde B-98, la fila de un encuentro cancelado tiene un input que se escribe y
 * que es público. Antes `claseFila` bajaba el `<li>` entero a `opacity-60`, así
 * que ese input —y la casilla que deshace la cancelación— quedaban atenuados
 * como si ya no rigieran. Lo que se atenúa ahora es el bloque de fecha y tema.
 *
 * Y desde B-1750 se atenúa con **tinta** (`claseTintaApagada`) y no con
 * `opacity`, que se multiplicaba con la tinta de adentro. El test busca la
 * clase por ancestros igual que antes: la tinta también se hereda.
 *
 * Por qué necesita DOM: la opacidad se hereda por ancestros, y la pregunta es
 * **quién queda adentro de qué**. Un `grep` sobre el JSX dice que existe la
 * clase, no de qué nodos es ancestro.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));

import { SesionesEditor } from '@/components/admin/SesionesEditor';
import { claseTintaApagada } from '@/components/campos/Campo';
import { sesionVacia } from '@/lib/sesiones';
import type { SesionForm } from '@/types/actividad';

afterEach(cleanup);

const dibujar = (cancelada: boolean) => {
  const sesion: SesionForm = {
    ...sesionVacia(),
    id: 'ses_fijo',
    inicio: '2026-10-01T19:00',
    fin: '2026-10-01T21:00',
    tema: 'Cap. 1-4',
    cancelada,
    motivoCancelacion: 'Se pasa al jueves 12',
  };
  render(
    <SesionesEditor
      hora={{ formato: '24', vista: 'pc' }}
      sesiones={[sesion]}
      onChange={vi.fn()}
      errorDe={() => undefined}
    />,
  );
};

/**
 * ¿El nodo está adentro del bloque de fecha y tema, y ese bloque lleva la tinta
 * apagada de B-1750? Se busca el bloque y no «cualquier ancestro con
 * `text-tinta/70`»: la casilla «Cancelado» tiene esa tinta propia desde antes, y
 * la pregunta es si la apaga el estado.
 */
const atenuado = (el: HTMLElement): boolean => {
  const bloque = el.closest<HTMLElement>('[data-bloque="fecha-y-tema"]');
  return bloque !== null && claseTintaApagada.split(' ').every((c) => bloque.classList.contains(c));
};

/** ¿Algún ancestro lleva un `opacity-NN`? Es lo que B-1750 sacó. */
const conOpacidad = (el: HTMLElement): boolean => {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if ([...n.classList].some((c) => /^opacity-\d+$/.test(c))) return true;
  }
  return false;
};

describe('la fila de un encuentro cancelado (B-1570)', () => {
  it('atenúa el tema y la fecha', () => {
    dibujar(true);
    expect(atenuado(screen.getByDisplayValue('Cap. 1-4'))).toBe(true);
    expect(atenuado(screen.getByText(/^Cae /))).toBe(true);
  });

  /*
   * B-1750 — MUTACIÓN PROBADA: devolviendo `opacity-60` al bloque de fecha y
   * tema, este caso queda en rojo.
   */
  it('no lo atenúa con opacity, que se multiplicaría con la tinta de adentro', () => {
    dibujar(true);
    expect(conOpacidad(screen.getByDisplayValue('Cap. 1-4'))).toBe(false);
    expect(conOpacidad(screen.getByText(/^Cae /))).toBe(false);
  });

  /*
   * MUTACIÓN PROBADA: devolviendo la tinta apagada a `claseFila`, los dos casos
   * de abajo quedan en rojo.
   */
  it('no atenúa el motivo, que se tipea y es público', () => {
    dibujar(true);
    expect(atenuado(screen.getByLabelText(/^Motivo/))).toBe(false);
  });

  it('no atenúa la casilla «Cancelado», que es la que lo deshace', () => {
    dibujar(true);
    expect(atenuado(screen.getByLabelText(/^Cancelado/))).toBe(false);
  });

  it('un encuentro que no está cancelado no atenúa nada', () => {
    dibujar(false);
    expect(atenuado(screen.getByDisplayValue('Cap. 1-4'))).toBe(false);
    expect(screen.queryByLabelText(/^Motivo/)).toBeNull();
  });
});
