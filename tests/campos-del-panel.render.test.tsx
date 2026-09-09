/**
 * **La capa que ata los controles compartidos al panel, verificada por
 * comportamiento** — B-841.
 *
 * ── Por qué hace falta este archivo ───────────────────────────────────────
 * B-841 sacó la medición y la ayuda de `components/campos/` y las pasó a props
 * **opcionales**, con `components/admin/campos-del-panel.tsx` atándolas del lado
 * del panel. Eso deja una clase nueva y de las peores: **una prop opcional que
 * nadie pasa se ve idéntica y apaga una función.** Si un refactor deja el
 * `medir={medirSeccion}` afuera, el build queda verde, `tsc` queda verde —son
 * opcionales— y lo que se pierde es GA4 dejando de ver `funcion_usada` para todas
 * las aperturas de sección y toda interacción de taxonomía del panel. Se nota
 * semanas después, mirando un hueco en el tablero.
 *
 * Lo pidió el `auditor-trampas` sobre el propio commit de B-841, y con un detalle
 * que conviene tener escrito: **el aserto de `taxonomia.test.ts` se degradó con el
 * refactor.** «TagsInput mide la taxonomía, como el desplegable» hace
 * `toContain('taxonomia-nueva')` sobre el fuente, y esos literales siguen ahí como
 * argumentos de `onMedir?.(…)` — así que sigue pasando y ya **no prueba que se
 * mida**: prueba que el string existe. La medición depende de que la capa pase la
 * prop, y eso es lo que se verifica acá.
 *
 * ── Y la otra dirección, que es la razón de ser del corte ──────────────────
 * Los controles **genéricos** no miden nada sin la prop. Eso es lo que hace que un
 * formulario público pueda usarlos, y se afirma acá igual que lo de arriba: es la
 * misma propiedad mirada desde el otro lado.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const medirSeccion = vi.fn();
const medirFuncion = vi.fn();

vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: (...args: unknown[]) => medirFuncion(...args),
  medirSeccion: (...args: unknown[]) => medirSeccion(...args),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));

/** Una opción base, para que el desplegable tenga qué ofrecer. */
const OPCION = {
  slug: 'gratis',
  label: 'Gratis',
  orden: 1,
  fijo: true,
  usos: 0,
  aprobada: true,
};

vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => ({ valores: [OPCION], elegibles: [OPCION], cargando: false }),
  useLabelsTaxonomia: () => ({}),
}));

import { Seccion, TaxonomiaSelect } from '@/components/admin/campos-del-panel';
import { Seccion as SeccionGenerica } from '@/components/campos/Seccion';
import { TaxonomiaSelect as TaxonomiaGenerica } from '@/components/campos/TaxonomiaSelect';

afterEach(cleanup);
beforeEach(() => {
  medirSeccion.mockClear();
  medirFuncion.mockClear();
});

describe('la capa del panel cablea la medición — B-841', () => {
  it('abrir un acordeón mide, con el título de la sección', async () => {
    render(
      <Seccion titulo="Difusión" colapsable abiertaPorDefecto={false}>
        <p>algo</p>
      </Seccion>,
    );
    await userEvent.click(screen.getByRole('button', { name: /difusión/i }));
    expect(medirSeccion, 'la capa dejó de pasar `medir`').toHaveBeenCalledWith('Difusión', true);
  });

  it('y cerrarlo también, con el mismo título', async () => {
    render(
      <Seccion titulo="Difusión" colapsable abiertaPorDefecto>
        <p>algo</p>
      </Seccion>,
    );
    await userEvent.click(screen.getByRole('button', { name: /difusión/i }));
    expect(medirSeccion).toHaveBeenCalledWith('Difusión', false);
  });

  /**
   * `taxonomia-otro` es el camino más corto para ver la prop cableada: elegir
   * «Otro» en el desplegable lo dispara sin necesidad de tipear nada.
   */
  it('elegir «Otro» en un desplegable de taxonomía mide, con el nombre del campo', async () => {
    render(
      <TaxonomiaSelect
        campo="arancel"
        uid="uid-de-prueba"
        value=""
        onChange={vi.fn()}
        id="t"
      />,
    );
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, '__otro__');
    expect(medirFuncion, 'la capa dejó de pasar `onMedir`').toHaveBeenCalledWith(
      'taxonomia-otro',
      'arancel',
    );
  });
});

describe('el «?» de la guía sigue colgado del `conAyuda` del panel', () => {
  it('con `conAyuda`, la sección lo muestra', () => {
    render(
      <Seccion titulo="Difusión" conAyuda>
        <p>algo</p>
      </Seccion>,
    );
    // `AyudaDeSeccion` pinta un botón propio, aparte del del acordeón.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('sin `conAyuda`, no hay ningún botón: la sección no colapsable no tiene otro', () => {
    // El control negativo del caso de arriba: si `AyudaDeSeccion` se pintara
    // siempre, este caso encontraría un botón igual y el de arriba pasaría por el
    // motivo equivocado.
    render(
      <Seccion titulo="Difusión">
        <p>algo</p>
      </Seccion>,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

/**
 * **La otra dirección: los controles genéricos son silenciosos.**
 *
 * Es la razón de ser del corte, y sin estos casos «la capa mide» no prueba que
 * `campos/` **no** mida: podría medir por su cuenta y la capa estar de más.
 */
describe('los controles de `campos/` no miden sin la prop — B-841', () => {
  it('el acordeón genérico se abre y no mide nada', async () => {
    render(
      <SeccionGenerica titulo="Difusión" colapsable abiertaPorDefecto={false}>
        <p>algo</p>
      </SeccionGenerica>,
    );
    await userEvent.click(screen.getByRole('button', { name: /difusión/i }));
    expect(medirSeccion, '`campos/Seccion` mide por su cuenta').not.toHaveBeenCalled();
    expect(medirFuncion).not.toHaveBeenCalled();
  });

  it('y el desplegable genérico tampoco, ni siquiera al elegir «Otro»', async () => {
    render(
      <TaxonomiaGenerica
        campo="arancel"
        valores={[OPCION]}
        elegibles={[OPCION]}
        value=""
        onChange={vi.fn()}
        id="t"
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), '__otro__');
    expect(medirFuncion, '`campos/TaxonomiaSelect` mide por su cuenta').not.toHaveBeenCalled();
  });

  it('el genérico tampoco pinta el «?»: la ayuda es del panel', () => {
    render(
      <SeccionGenerica titulo="Difusión">
        <p>algo</p>
      </SeccionGenerica>,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
