/**
 * **«No pudimos verificar tu navegador»** — el cartel de B-930, renderizado.
 *
 * Lo puro (cuándo se avisa, el umbral, el triaje) está en
 * `verificacion-del-navegador.test.ts`. Acá se afirma lo que solo el render
 * muestra: que el cartel aparece **solo** en `sin-verificar`, que trae los tres
 * pasos en orden y que se lo anuncia sin que haya que ir a buscarlo.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AvisoVerificacion,
  useVerificacionDelNavegador,
} from '@/components/admin/AvisoVerificacion';
import {
  _fijarVerificacion,
  _resetVerificacion,
  PASOS_SIN_VERIFICAR,
} from '@/lib/verificacionDelNavegador';

afterEach(cleanup);
beforeEach(() => _resetVerificacion());

describe('AvisoVerificacion', () => {
  /**
   * MUTACIÓN PROBADA (2026-09-23): cambiando el `if (!debeAvisar(estado))` del
   * componente por `if (estado === 'verificado')`, las filas `no-aplica` y
   * `verificando` se ponen rojas — o sea que con emuladores el cartel habría
   * aparecido en cada `npm run dev`.
   */
  it.each(['no-aplica', 'verificando', 'verificado'] as const)(
    'con `%s` no pinta nada',
    (estado) => {
      const { container } = render(<AvisoVerificacion estado={estado} />);
      expect(container.innerHTML).toBe('');
    },
  );

  it('con `sin-verificar` dice qué pasa, los tres pasos en orden y ofrece recargar', () => {
    render(<AvisoVerificacion estado="sin-verificar" />);

    const aviso = screen.getByRole('alert');
    expect(aviso.textContent).toMatch(/No pudimos verificar tu navegador/);
    expect(aviso.textContent).toMatch(/aunque tengas internet/);

    const pasos = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(pasos).toEqual([...PASOS_SIN_VERIFICAR]);

    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy();
  });

  it('no se puede cerrar: se va cuando el token llega, no por reflejo', () => {
    render(<AvisoVerificacion estado="sin-verificar" />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('useVerificacionDelNavegador', () => {
  it('sigue al store: el cartel aparece y se va solo', () => {
    const { result } = renderHook(() => useVerificacionDelNavegador());
    expect(result.current).toBe('no-aplica');

    act(() => _fijarVerificacion('sin-verificar'));
    expect(result.current).toBe('sin-verificar');

    act(() => _fijarVerificacion('verificado'));
    expect(result.current).toBe('verificado');
  });
});
