/**
 * **El panel no relee la colección en cada cambio de vista** — B-2203.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.fn(async () => [{ id: 'a1', titulo: 'Taller' }]);
vi.mock('@/lib/actividades', () => ({ listarActividades: (...args: unknown[]) => listar(...(args as [])) }));
vi.mock('@/lib/fotoDelCatalogo', () => ({ sacarFotoSiToca: async () => {} }));

import { olvidarActividadesLeidas, useActividades } from '@/components/admin/useActividades';

const montar = (version = 0) =>
  renderHook(() => useActividades(version, 'admin', 'uid1', ''));

describe('la lectura compartida del panel — B-2203', () => {
  beforeEach(() => listar.mockClear());

  it('la segunda vista con la misma clave no relee, y arranca ya cargada', async () => {
    const primera = montar();
    await waitFor(() => expect(primera.result.current.cargando).toBe(false));
    primera.unmount();

    const segunda = montar();
    expect(segunda.result.current.cargando).toBe(false);
    expect(segunda.result.current.actividades).toHaveLength(1);
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('salir del formulario la tira: la vista siguiente relee', async () => {
    // Mutación probada: un `olvidarActividadesLeidas` vacío pone esto rojo.
    const a = montar();
    await waitFor(() => expect(a.result.current.cargando).toBe(false));
    a.unmount();
    olvidarActividadesLeidas();
    const b = montar();
    await waitFor(() => expect(b.result.current.cargando).toBe(false));
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('una versión nueva (guardar, restaurar) relee', async () => {
    const a = montar(0);
    await waitFor(() => expect(a.result.current.cargando).toBe(false));
    a.unmount();
    const b = montar(1);
    await waitFor(() => expect(b.result.current.cargando).toBe(false));
    expect(listar).toHaveBeenCalledTimes(2);
  });
});
