import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `BibliotecasPanel` renderizado de verdad — B-1410, B-1411 y B-1412.
 *
 * La bandeja de bibliotecas **no pintaba** el aviso de los sesenta días, aunque
 * el formulario promete «el panel te avisa». Lo que se verifica es cableado,
 * que un test que lee el fuente no ve:
 *
 * 1. que un costo viejo **pinte** el aviso, con el nombre del dato y sin el
 *    número (la bandeja no muestra un valor sin su fecha);
 * 2. que el botón llame a `confirmarCostoDeBiblioteca` con **esa** ficha;
 * 3. que un costo sin fecha usable diga que no se está publicando (B-1412);
 * 4. que una biblioteca **publicada** con el costo viejo entre al contador
 *    (B-1411), que es el caso que el filtro por defecto escondía.
 *
 * Lo único mockeado es la capa de Firestore (`lib/bibliotecas`), la analítica y
 * el formulario, que esta pantalla no abre en ningún caso de acá.
 */
vi.mock('@/lib/analytics', () => ({ medirFuncion: vi.fn(), medirSeccion: vi.fn() }));
vi.mock('@/components/admin/BibliotecaFormulario', () => ({ BibliotecaFormulario: () => null }));
vi.mock('@/lib/bibliotecas', () => ({
  observarBibliotecas: vi.fn(),
  moverBiblioteca: vi.fn(),
  confirmarCostoDeBiblioteca: vi.fn(async () => {}),
}));

import { BibliotecasPanel } from '@/components/admin/BibliotecasPanel';
import { confirmarCostoDeBiblioteca, observarBibliotecas } from '@/lib/bibliotecas';
import { DIAS_PARA_REVISAR } from '@/lib/datoConFecha';
import type { BibliotecaConId } from '@/types/biblioteca';
import { tsDe } from './fixtures/tiempo';

const UN_DIA = 24 * 60 * 60 * 1000;
// El doble de `Timestamp` del repo, uno y solo uno (B-211).
const haceDias = (n: number) => tsDe(new Date(Date.now() - n * UN_DIA));

const biblioteca = (over: Partial<BibliotecaConId> & { id: string }): BibliotecaConId =>
  ({
    nombre: 'Biblioteca Popular Alberdi',
    slug: over.id,
    estado: 'pendiente',
    origen: 'panel',
    direccion: 'Talcahuano 1261',
    barrio: 'recoleta',
    asociarse: { haceFalta: true, costo: { valor: '$3.000 por año', cargadoEn: haceDias(5) } },
    ...over,
  }) as unknown as BibliotecaConId;

const montar = (bs: BibliotecaConId[]) => {
  vi.mocked(observarBibliotecas).mockImplementation((cb) => {
    cb(bs);
    return () => {};
  });
  return render(
    <BibliotecasPanel
      usuario={{ uid: 'uid_admin' }}
      onAbrirFormulario={vi.fn()}
      editando={null}
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
    />,
  );
};

const fila = (nombre: string) => screen.getByText(nombre).closest('li') as HTMLElement;

beforeEach(() => {
  vi.mocked(observarBibliotecas).mockReset();
  vi.mocked(confirmarCostoDeBiblioteca).mockClear();
});
afterEach(cleanup);

describe('el aviso del costo de asociarse — B-1410', () => {
  it('un costo viejo pinta el aviso, sin el número', () => {
    montar([
      biblioteca({
        id: 'vieja',
        nombre: 'La Vieja',
        asociarse: {
          haceFalta: true,
          costo: { valor: '$3.000 por año', cargadoEn: haceDias(DIAS_PARA_REVISAR + 30) },
        },
      } as never),
    ]);
    const li = fila('La Vieja');
    expect(
      within(li).getByText(
        `· conviene revisar el costo de asociarse (más de ${DIAS_PARA_REVISAR} días)`,
      ),
    ).toBeTruthy();
    expect(li.textContent).not.toContain('3.000');
  });

  it('un costo reciente no pinta nada', () => {
    montar([biblioteca({ id: 'fresca', nombre: 'La Fresca' })]);
    expect(screen.queryByText(/costo de asociarse/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lo revisé: sigue siendo éste' })).toBeNull();
  });

  it('sin costo cargado no hay nada que revisar', () => {
    montar([
      biblioteca({ id: 'gratis', nombre: 'Sin Costo', asociarse: { haceFalta: false, costo: null } } as never),
    ]);
    expect(screen.queryByText(/costo de asociarse/)).toBeNull();
  });

  it('el botón confirma el costo de esa ficha', async () => {
    const vieja = biblioteca({
      id: 'vieja',
      nombre: 'La Vieja',
      asociarse: { haceFalta: true, costo: { valor: '$3.000 por año', cargadoEn: haceDias(400) } },
    } as never);
    montar([vieja, biblioteca({ id: 'otra', nombre: 'Otra' })]);
    await userEvent.click(
      within(fila('La Vieja')).getByRole('button', { name: 'Lo revisé: sigue siendo éste' }),
    );
    expect(confirmarCostoDeBiblioteca).toHaveBeenCalledTimes(1);
    expect(vi.mocked(confirmarCostoDeBiblioteca).mock.calls[0][0]).toBe('vieja');
  });
});

describe('sin fecha usable, dice que no se publica — B-1412', () => {
  it('un costo sin `cargadoEn` no dice «más de 60 días»', () => {
    montar([
      biblioteca({
        id: 'huerfana',
        nombre: 'Huérfana',
        asociarse: { haceFalta: true, costo: { valor: '$3.000 por año', cargadoEn: null } },
      } as never),
    ]);
    expect(
      screen.getByText('· el costo de asociarse no se está publicando: falta su fecha'),
    ).toBeTruthy();
    expect(screen.queryByText(/más de/)).toBeNull();
  });
});

describe('la publicada con el costo viejo entra al contador — B-1411', () => {
  it('se cuenta, y tocar el contador la muestra con el filtro apagado', async () => {
    montar([
      biblioteca({ id: 'espera', nombre: 'La Que Espera' }),
      biblioteca({
        id: 'publicada',
        nombre: 'La Publicada',
        estado: 'publicado',
        asociarse: { haceFalta: true, costo: { valor: '$3.000 por año', cargadoEn: haceDias(90) } },
      } as never),
    ]);
    // El filtro por defecto la esconde: es el caso que el contador existe para atrapar.
    expect(screen.queryByText('La Publicada')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '1 costo de asociarse para revisar' }));
    expect(screen.getByText('La Publicada')).toBeTruthy();
    expect(screen.queryByText('La Que Espera')).toBeNull();
  });
});
