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
