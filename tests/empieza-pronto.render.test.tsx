import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FilaDeActividad } from '@/components/publico/FilaDeActividad';
import { entradaDePrueba } from './fixtures/indice';

/**
 * Roadmap 1.6 — «Empieza el jueves» solo con el reloj del navegador. En el HTML
 * del build (sin `enVivo`) envejecería al día siguiente, así que no se pinta.
 *
 * Mutación: ignorar `enVivo` en `FilaDeActividad` pone en rojo el primer caso.
 */
afterEach(cleanup);

const AHORA = new Date('2026-10-06T18:00:00Z');
const ciclo = entradaDePrueba({ fechas: ['2026-10-08T22:00:00Z', '2026-10-15T22:00:00Z'] });

describe('FilaDeActividad y «Empieza…»', () => {
  it('en el HTML estático no lo dice', () => {
    render(<FilaDeActividad entrada={ciclo} ahora={AHORA} etiquetas={{}} tonos={{}} />);
    expect(screen.queryByText(/^Empieza /)).toBeNull();
  });

  it('dibujada por una island, sí', () => {
    render(<FilaDeActividad entrada={ciclo} ahora={AHORA} etiquetas={{}} tonos={{}} enVivo />);
    expect(screen.getByText('Empieza el jueves')).toBeTruthy();
  });
});
