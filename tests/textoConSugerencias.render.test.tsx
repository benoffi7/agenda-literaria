import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TextoConSugerencias } from '@/components/campos/TextoConSugerencias';
import type { ValorOpcion } from '@/types/actividad';

/**
 * Roadmap 1.5, B-2172 — la caja de «Organiza»: se escribe, sugiere mientras se
 * tipea y avisa antes de guardar si lo escrito ya existe o es nuevo (§4.2).
 */
afterEach(cleanup);

const opcion = (slug: string, label: string): ValorOpcion => ({
  slug,
  label,
  orden: 99,
  fijo: false,
  usos: 4,
});
const LISTA = [opcion('casa-brandon', 'Casa Brandon'), opcion('casa-de-la-lectura', 'Casa de la Lectura')];

function Caja({ inicial = '' }: { inicial?: string }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <TextoConSugerencias
      campo="organizador"
      valores={LISTA}
      elegibles={LISTA}
      id="org"
      value={texto}
      onChange={setTexto}
      avisoDeNuevo="Es nuevo."
    />
  );
}

describe('TextoConSugerencias', () => {
  it('sugiere mientras se tipea y elegir una deja escrita su etiqueta', () => {
    render(<Caja />);
    const caja = screen.getByRole('combobox');
    fireEvent.focus(caja);
    fireEvent.change(caja, { target: { value: 'casa' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Casa Brandon/ }));
    expect(caja).toHaveProperty('value', 'Casa Brandon');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('avisa que lo escrito ya está en la lista, aunque se haya tipeado distinto', () => {
    render(<Caja inicial="casa  brandon" />);
    expect(screen.getByText(/Ya está en la lista como «Casa Brandon»/)).toBeTruthy();
  });

  it('y que es nuevo cuando no está', () => {
    render(<Caja inicial="Ana Pérez" />);
    expect(screen.getByText('Es nuevo.')).toBeTruthy();
  });

  it('vacía no dice nada', () => {
    render(<Caja />);
    expect(screen.queryByText('Es nuevo.')).toBeNull();
  });
});
