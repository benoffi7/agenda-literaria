/**
 * `MenuAcciones` renderizado de verdad — B-08.
 *
 * **Por qué este componente y no otro.** De los cuatro candidatos que el ítem
 * relevó, tres no necesitan DOM (son preguntas puras, ya cubiertas sin
 * testing-library) o jsdom no los puede verificar (el scroll de
 * `VistaPreviaEvento`: jsdom no hace layout). Este es el único caso genuino:
 * cierre por clic afuera, cierre por `Escape` con el foco devuelto al "⋯", y
 * eso es cableado real de DOM —`addEventListener`, `document.activeElement`—
 * que ningún test puro puede ejercitar.
 *
 * **Por qué no alcanza con `tests/foco.test.ts`.** Esos `it` leen el FUENTE de
 * `MenuAcciones.tsx` con regex (`toContain('disparador.current?.focus()')`,
 * `toMatch(/onKeyDown=/)`) para confirmar que el cableado está escrito. No
 * confirman que **funcione**: un cambio que deje el string presente pero rompa
 * el comportamiento real (el listener en el elemento equivocado, la condición
 * invertida) pasaría igual. Es la misma familia que B-202, que fue exactamente
 * eso — un `toContain` satisfecho por un import sin la llamada real detrás.
 *
 * Vive en `.render.test.tsx` y no en `.test.ts`: `vitest.config.ts` solo monta
 * jsdom para ese patrón (`environmentMatchGlobs`), así que el resto de la
 * suite —lógica pura, en su enorme mayoría— sigue en `node` y no paga el costo
 * de un DOM por archivo.
 *
 * `cleanup()` se llama a mano en `afterEach` porque el auto-cleanup de
 * `@testing-library/react` depende de detectar `afterEach` como global, y este
 * proyecto no prende `test.globals` en `vitest.config.ts` — todo se importa
 * explícito, como el resto de la suite.
 */
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MenuAcciones, type Accion } from '@/components/admin/MenuAcciones';

afterEach(() => cleanup());

const acciones = (): Accion[] => [
  { label: 'Editar', onSelect: () => {} },
  { label: 'Duplicar', onSelect: () => {}, devuelveFoco: true },
  { label: 'Borrar', onSelect: () => {}, peligrosa: true },
];

const montar = () => {
  render(<MenuAcciones acciones={acciones()} etiqueta="Más acciones" />);
  return screen.getByRole('button', { name: 'Más acciones' });
};

describe('MenuAcciones — cierre por clic afuera (B-14)', () => {
  it('un clic afuera cierra el menú abierto', async () => {
    const disparador = montar();
    await userEvent.click(disparador);
    expect(screen.queryByRole('menu')).not.toBeNull();

    // Afuera de verdad: en el body, no en el contenedor del menú.
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('un clic ADENTRO del menú no lo cierra por el listener de "afuera"', async () => {
    // Control negativo: sin esto, el test de arriba pasaría igual aunque el
    // listener escuchara en cualquier lado y cerrara con cualquier clic.
    const disparador = montar();
    await userEvent.click(disparador);
    act(() => {
      fireEvent.pointerDown(screen.getByText('Editar'));
    });
    expect(screen.queryByRole('menu')).not.toBeNull();
  });
});

describe('MenuAcciones — cierre por Escape y foco devuelto (B-14)', () => {
  it('Escape cierra el menú Y devuelve el foco al "⋯"', async () => {
    const disparador = montar();
    await userEvent.click(disparador);
    expect(screen.queryByRole('menu')).not.toBeNull();

    // Crítico: el foco tiene que estar ADENTRO del menú antes de cerrar. Con
    // el foco todavía en el disparador (nadie navegó con flechas), la
    // aserción de abajo pasaría igual aunque `cerrarYVolverAlDisparador` no
    // devolviera nada — el foco nunca se habría movido.
    act(() => {
      fireEvent.keyDown(disparador, { key: 'ArrowDown' });
    });
    expect(document.activeElement).toBe(screen.getByText('Editar'));

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('menu')).toBeNull();
    // La mitad que un `toContain` sobre el fuente no puede ver: que el foco
    // haya vuelto de verdad al disparador, no solo que se llame a algo.
    expect(document.activeElement).toBe(disparador);
  });

  it('abrir con ↓ enfoca el primer ítem (no hace falta el mouse)', () => {
    const disparador = montar();
    disparador.focus();
    act(() => {
      fireEvent.keyDown(disparador, { key: 'ArrowDown' });
    });
    expect(document.activeElement).toBe(screen.getByText('Editar'));
  });
});
