import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Roadmap 2.8 — «Cancelar o cambiar» en cada recordatorio del lunes: lee la
 * actividad y abre el formulario **en ese encuentro**. No escribe nada desde acá:
 * cancelar pasa por el guardado de siempre.
 */
const actividad = { id: 'act_1', titulo: 'Club', slug: 'club' };
vi.mock('@/lib/actividades', () => ({ leerActividad: vi.fn(async () => actividad) }));
vi.mock('@/components/admin/useOpciones', () => ({ useLabelsTaxonomia: () => ({}) }));

import { Recordatorio } from '@/components/admin/BoletinPanel';

afterEach(cleanup);

const encuentro = { clave: 'club#ses_1', slug: 'club', sesionId: 'ses_1', titulo: 'Club', detalle: '19:00' };

describe('Recordatorio — «Cancelar o cambiar»', () => {
  it('abre la actividad en el formulario, en ese encuentro', async () => {
    const onEditar = vi.fn();
    render(<Recordatorio e={encuentro} idDe={() => 'act_1'} onEditar={onEditar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar o cambiar' }));
    await waitFor(() => expect(onEditar).toHaveBeenCalledWith(actividad, 'ses_1'));
  });

  it('sin quien la abra, el botón no aparece', () => {
    render(<Recordatorio e={encuentro} idDe={() => 'act_1'} />);
    expect(screen.queryByRole('button', { name: 'Cancelar o cambiar' })).toBeNull();
  });
});
