/**
 * **El «Motivo» de un encuentro cancelado se tipea a opacidad plena** — B-1570.
 *
 * Desde B-98, la fila de un encuentro cancelado tiene un input que se escribe y
 * que es público. Antes `claseFila` bajaba el `<li>` entero a `opacity-60`, así
 * que ese input —y la casilla que deshace la cancelación— quedaban atenuados
 * como si ya no rigieran. Lo que se atenúa ahora es el bloque de fecha y tema.
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

/** ¿Algún ancestro del nodo —él incluido— lleva `opacity-60`? */
const atenuado = (el: HTMLElement): boolean => el.closest('.opacity-60') !== null;

describe('la fila de un encuentro cancelado (B-1570)', () => {
  it('atenúa el tema y la fecha', () => {
    dibujar(true);
    expect(atenuado(screen.getByDisplayValue('Cap. 1-4'))).toBe(true);
    expect(atenuado(screen.getByText(/^Cae /))).toBe(true);
  });

  /*
   * MUTACIÓN PROBADA: devolviendo `opacity-60` a `claseFila`, los dos casos de
   * abajo quedan en rojo.
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
