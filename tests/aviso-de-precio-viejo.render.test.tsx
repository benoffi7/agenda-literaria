import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AvisoDePrecioViejo } from '@/components/admin/AvisoDePrecioViejo';
import { DIAS_PARA_REVISAR } from '@/lib/datoConFecha';

/**
 * `AvisoDePrecioViejo` renderizado de verdad — B-913.
 *
 * El aviso de los sesenta días ya existía; lo nuevo es **su salida**, «lo revisé:
 * sigue siendo éste». Lo que se verifica es cableado, que es lo que un test que
 * lee el fuente no ve: que el botón **llame** a la escritura que recibe, que no
 * se pueda disparar dos veces mientras viaja, y que un rebote **se diga** en vez
 * de tragarse. No hay nada de Firestore mockeado: el componente recibe la
 * escritura (§ «Un control compartido recibe, no importa»).
 */
afterEach(cleanup);

describe('el aviso de los sesenta días con su salida — B-913', () => {
  it('dice el aviso y ofrece el botón', () => {
    render(<AvisoDePrecioViejo onConfirmar={vi.fn(async () => {})} />);
    expect(
      screen.getByText(`· conviene revisar el precio (más de ${DIAS_PARA_REVISAR} días)`),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lo revisé: sigue siendo éste' })).toBeTruthy();
  });

  it('tocarlo llama a la escritura una vez', async () => {
    const onConfirmar = vi.fn(async () => {});
    render(<AvisoDePrecioViejo onConfirmar={onConfirmar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Lo revisé: sigue siendo éste' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mientras viaja, el botón queda deshabilitado', async () => {
    let soltar: () => void = () => {};
    const onConfirmar = vi.fn(() => new Promise<void>((r) => (soltar = r)));
    render(<AvisoDePrecioViejo onConfirmar={onConfirmar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Lo revisé: sigue siendo éste' }));
    const boton = screen.getByRole('button', { name: 'Confirmando…' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    await userEvent.click(boton);
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    soltar();
    expect(await screen.findByRole('button', { name: 'Lo revisé: sigue siendo éste' })).toBeTruthy();
  });

  it('si la escritura rebota, lo dice y el aviso sigue ahí', async () => {
    const onConfirmar = vi.fn(async () => {
      throw new Error('Missing or insufficient permissions.');
    });
    render(<AvisoDePrecioViejo onConfirmar={onConfirmar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Lo revisé: sigue siendo éste' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/conviene revisar el precio/)).toBeTruthy();
  });
});
