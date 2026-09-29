/**
 * **El barrio sobrante fuera de CABA se ve y se quita** — B-2173.
 *
 * La cascada no pide barrio fuera de CABA, así que el campo no estaba en
 * pantalla; pero la ficha lo muestra y el tablero lo señala. El dueño abrió la
 * actividad que el aviso marcaba y no encontró qué corregir. Solo el DOM puede
 * decir si el campo aparece.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { ModalidadesEditor } from '@/components/admin/ModalidadesEditor';
import { modalidadVacia } from '@/lib/formulario/estadoInicial';
import type { ModalidadFilaForm } from '@/types/actividad';

afterEach(cleanup);

const conSede = (provincia: string, ciudad: string, barrio: string): ModalidadFilaForm => {
  const fila = modalidadVacia('presencial');
  return { ...fila, sede: { ...fila.sede!, nombre: 'Agrupación Andaluza', provincia, ciudad, barrio } };
};

const pintar = (fila: ModalidadFilaForm, onChange = vi.fn()) => {
  render(
    <ModalidadesEditor
      hora={{ formato: '24', vista: 'pc' }}
      modalidades={[fila]}
      onChange={onChange}
      uid="u1"
      anotarLabel={vi.fn()}
      errorDe={() => undefined}
    />,
  );
  return onChange;
};

describe('B-2173 · barrio sobrante fuera de CABA', () => {
  it('se muestra con «Quitar el barrio», y quitarlo deja el barrio vacío', async () => {
    const onChange = pintar(conSede('santa-fe', 'rosario', 'rosario'));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el barrio' }));
    const [[filas]] = onChange.mock.calls;
    expect(filas[0].sede.barrio).toBe('');
    expect(filas[0].sede.ciudad).toBe('rosario');
    expect(filas[0].sede.provincia).toBe('santa-fe');
  });

  it('fuera de CABA sin barrio no aparece', () => {
    pintar(conSede('santa-fe', 'rosario', ''));
    expect(screen.queryByRole('button', { name: 'Quitar el barrio' })).toBeNull();
  });

  it('en CABA el barrio es el campo de siempre, sin «Quitar»', () => {
    pintar(conSede('caba', 'caba', 'boedo'));
    expect(screen.queryByRole('button', { name: 'Quitar el barrio' })).toBeNull();
  });
});
