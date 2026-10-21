import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `EfemeridesPanel` renderizado de verdad — B-1943.
 *
 * La guarda de publicación (`slugPublicable`) lee y después escribe, sin
 * transacción: dos admins que publican a la vez con el mismo link pasan los
 * dos, y el build deja una sola página. Lo que se verifica es el cableado del
 * aviso, que el test de la función pura no ve: que la pantalla **pinte** cuál
 * quedó sin página y cuál se quedó el link, y que no pinte nada cuando el choque
 * es con un borrador (un borrador no tiene página que perder).
 *
 * Lo único mockeado es la capa de Firestore (`lib/efemerides`), la analítica y
 * el formulario, que esta pantalla no abre en ningún caso de acá.
 */
vi.mock('@/lib/analytics', () => ({ medirFuncion: vi.fn(), medirSeccion: vi.fn() }));
vi.mock('@/components/admin/EfemerideFormulario', () => ({ EfemerideFormulario: () => null }));
vi.mock('@/lib/efemerides', () => ({
  observarEfemerides: vi.fn(),
  moverEfemeride: vi.fn(),
  slugPublicable: vi.fn(async () => true),
}));

import { EfemeridesPanel } from '@/components/admin/EfemeridesPanel';
import { observarEfemerides } from '@/lib/efemerides';
import type { EfemerideConId } from '@/types/efemeride';

const efemeride = (over: Partial<EfemerideConId> & { id: string }): EfemerideConId =>
  ({
    titulo: 'Nace Julio Cortázar',
    slug: 'nace-cortazar',
    descripcion: '',
    dia: 26,
    mes: 8,
    anio: 1914,
    fuente: null,
    estado: 'publicado',
    publicadaAlgunaVez: true,
    ...over,
  }) as unknown as EfemerideConId;

const montar = (es: EfemerideConId[]) => {
  vi.mocked(observarEfemerides).mockImplementation((cb) => {
    cb(es);
    return () => {};
  });
  return render(
    <EfemeridesPanel
      usuario={{ uid: 'uid_admin' }}
      onAbrirFormulario={vi.fn()}
      editando={null}
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
    />,
  );
};

afterEach(cleanup);

describe('el aviso del link repetido — B-1943', () => {
  it('dos publicadas con el mismo link: nombra la que quedó sin página y la que se quedó el link', () => {
    montar([
      efemeride({ id: 'a', titulo: 'La de agosto' }),
      efemeride({ id: 'b', titulo: 'La de enero', mes: 1 }),
    ]);
    const aviso = screen.getByRole('status');
    expect(aviso.textContent).toContain('«La de agosto» está publicada pero no tiene página');
    expect(aviso.textContent).toContain('también es de «La de enero»');
    expect(aviso.textContent).toContain('/efemerides/nace-cortazar');
  });

  it('si la otra es un borrador, no hay página que perder y no avisa', () => {
    montar([
      efemeride({ id: 'a', titulo: 'La de agosto' }),
      efemeride({ id: 'b', titulo: 'La de enero', mes: 1, estado: 'borrador' }),
    ]);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

/**
 * **B-2225 — la lista filtrada y la placa.** Con la importación del relevamiento
 * la lista son casi trescientas: arranca en el mes de hoy (Buenos Aires), se
 * busca por texto, y cada fila abre su placa.
 */
describe('el filtro y la placa — B-2225', () => {
  afterEach(() => vi.useRealTimers());

  const lista = [
    efemeride({ id: 'e1' }),
    efemeride({ id: 'e2', titulo: 'Muere Alejandra Pizarnik', slug: 'muere-pizarnik', dia: 25, mes: 9 }),
    efemeride({ id: 'e3', titulo: 'Nace Alfonsina Storni', slug: 'nace-storni', dia: 29, mes: 5 }),
  ];

  it('arranca en el mes de hoy y dice cuántas muestra', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-10T15:00:00Z'));
    montar(lista);
    expect(screen.getByText('Nace Julio Cortázar')).toBeTruthy();
    expect(screen.queryByText('Muere Alejandra Pizarnik')).toBeNull();
    expect(screen.getByText('1 de 3')).toBeTruthy();
  });

  it('«Todo el año» y el buscador, sin acentos', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    montar(lista);
    await user.selectOptions(screen.getByLabelText('Mes'), '');
    await user.type(screen.getByLabelText('Buscar'), 'alfonsina');
    expect(screen.getByText('Nace Alfonsina Storni')).toBeTruthy();
    expect(screen.queryByText('Nace Julio Cortázar')).toBeNull();
  });

  it('el botón de cada fila abre y cierra su placa', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    montar(lista);
    await user.selectOptions(screen.getByLabelText('Mes'), '');
    const [primero] = screen.getAllByRole('button', { name: 'Placa para Instagram' });
    await user.click(primero!);
    expect(screen.getByRole('button', { name: 'Bajar la imagen' })).toBeTruthy();
    expect(screen.getByLabelText(/Vista previa de la placa de «Nace Alfonsina Storni»/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cerrar la placa' }));
    expect(screen.queryByRole('button', { name: 'Bajar la imagen' })).toBeNull();
  });
});
