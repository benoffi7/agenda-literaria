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
import { TagsInput } from '@/components/admin/campos-del-panel';
import { fijarRolActivo } from '@/lib/rolActivo';
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

/**
 * **La rotura 3 del lado de la pantalla: «Otro…» no se le ofrece a quien no
 * puede crear etiquetas** — B-888, tajada 2.
 *
 * `/opciones/{campo}` es de admin, así que para un publicador crear una etiqueta
 * se rechaza siempre. El portón que de verdad saltea las escrituras está en
 * `formulario/guardar.ts` (y tiene sus casos en `formulario-dominio.test.ts`);
 * esto es la otra mitad: **no ofrecer el botón que va a fallar**.
 *
 * La decisión vive en esta capa —la única por la que pasan las cinco taxonomías
 * del panel— y no en una prop cableada por seis componentes, para que el campo de
 * taxonomía que alguien agregue mañana la herede sin acordarse. El razonamiento
 * está en `lib/rolActivo.ts`.
 */
describe('«Otro…» según el rol — B-888', () => {
  afterEach(() => {
    // El store es de módulo: si queda sucio, el archivo siguiente hereda el rol.
    fijarRolActivo(null);
  });

  it('un admin lo sigue teniendo', () => {
    // Control positivo: sin esto, un `permitirOtro` cableado en `false` pasaría
    // el caso de abajo sin que nadie se entere de que rompió el panel del admin.
    fijarRolActivo('admin');
    render(<TaxonomiaSelect campo="arancel" uid="u1" value="" onChange={vi.fn()} id="x" />);
    expect(screen.getByText('Otro…')).not.toBeNull();
  });

  it('un publicador no, ni en el desplegable ni en el input de etiquetas', () => {
    /*
     * MUTACIÓN PROBADA: sacarle el `permitirOtro={puedeCrearEtiquetas()}` a
     * `TaxonomiaSelect` en `campos-del-panel.tsx` deja la primera mitad en rojo;
     * sacárselo a `TagsInput`, la segunda.
     */
    fijarRolActivo('publicador');
    render(<TaxonomiaSelect campo="arancel" uid="u1" value="" onChange={vi.fn()} id="x" />);
    expect(screen.queryByText('Otro…')).toBeNull();

    cleanup();
    render(<TagsInput campo="tags" uid="u1" value={[]} onChange={vi.fn()} id="y" />);
    // El input sigue sirviendo para **elegir**; lo que no invita es a inventar.
    expect((screen.getByRole('textbox') as HTMLInputElement).placeholder).not.toMatch(/Enter/);
  });

  it('y sin rol fijado se comporta como antes de B-888', () => {
    /*
     * El default del store es permisivo a propósito: no es la frontera —la
     * frontera son las reglas— y así el formulario público y cualquier control
     * montado suelto siguen comportándose igual.
     */
    render(<TaxonomiaSelect campo="arancel" uid="u1" value="" onChange={vi.fn()} id="z" />);
    expect(screen.getByText('Otro…')).not.toBeNull();
  });

  it('un publicador no puede meter una etiqueta que no está en la lista', async () => {
    /*
     * La otra mitad del input multivalor: el control es siempre de texto, así que
     * esconder un botón no alcanza — hay que rechazar el alta al confirmar. La
     * condición es contra `elegibles` y no contra «hubo coincidencia», porque
     * `resolverEtiqueta` resuelve contra la lista **completa** (que incluye
     * pendientes ajenas que este input no ofrece).
     *
     * MUTACIÓN PROBADA: sacarle a `confirmar()` de `TagsInput` la guarda de
     * `permitirOtro` deja este caso en rojo.
     */
    fijarRolActivo('publicador');
    const onChange = vi.fn();
    render(<TagsInput campo="tags" uid="u1" value={[]} onChange={onChange} id="w" />);
    await userEvent.type(screen.getByRole('textbox'), 'inventada{Enter}');
    expect(onChange, 'entró una etiqueta que no está en la lista').not.toHaveBeenCalled();
  });
});
