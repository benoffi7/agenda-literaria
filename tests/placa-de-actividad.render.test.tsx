/**
 * **Las casillas de la placa de una actividad** — B-2227.
 *
 * Que se pueda sacar una fila y que la elección quede en el navegador. Qué texto
 * lleva cada fila lo mira `tests/placas.test.ts`; el dibujo no se testea (un
 * canvas de jsdom no dibuja).
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/admin/useOpciones', () => ({ useLabelsTaxonomia: () => ({}) }));

import { PlacaDeActividad } from '@/components/admin/placa/PlacaDeActividad';
import { CLAVE_CAMPOS_DE_LA_PLACA } from '@/lib/placas';
import { formularioLleno } from './fixtures/formulario';

beforeEach(() => globalThis.localStorage?.removeItem(CLAVE_CAMPOS_DE_LA_PLACA));
afterEach(cleanup);

describe('qué lleva la placa — B-2227', () => {
  it('arranca con todas tildadas, y sacar una queda recordado', async () => {
    const user = userEvent.setup();
    render(<PlacaDeActividad form={formularioLleno()} yaTienePagina={false} />);
    await user.click(screen.getByRole('button', { name: 'Armar la placa para Instagram' }));

    const arancel = screen.getByRole('checkbox', { name: 'Arancel' }) as HTMLInputElement;
    expect(arancel.checked).toBe(true);
    await user.click(arancel);
    expect(arancel.checked).toBe(false);
    expect(JSON.parse(globalThis.localStorage.getItem(CLAVE_CAMPOS_DE_LA_PLACA)!)).not.toContain('arancel');
  });

  it('la próxima placa arranca con lo elegido', async () => {
    globalThis.localStorage.setItem(CLAVE_CAMPOS_DE_LA_PLACA, '["cuando"]');
    const user = userEvent.setup();
    render(<PlacaDeActividad form={formularioLleno()} yaTienePagina={false} />);
    await user.click(screen.getByRole('button', { name: 'Armar la placa para Instagram' }));
    expect((screen.getByRole('checkbox', { name: 'Cuándo' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Dónde' }) as HTMLInputElement).checked).toBe(false);
  });
});
