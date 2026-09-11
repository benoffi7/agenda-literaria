/**
 * **Las opciones para sumarse, montadas de verdad** — B-181.
 *
 * La parte pura —el agrupado, el desenganche al borrar, las tres reglas del
 * schema— está en `tests/comisiones.test.ts` y `tests/schema.test.ts`. Acá va lo
 * que solo el DOM puede decir, y es exactamente donde este cambio se puede
 * romper sin que nada más se ponga rojo:
 *
 * - **que una actividad normal no vea nada nuevo.** Es la mitad del diseño: el
 *   formulario ya tiene treinta campos, y el desplegable de cada encuentro
 *   aparece **solo** si hay opciones. Un `grep` sobre el JSX no distingue «lo
 *   muestra siempre» de «lo muestra si hay»;
 * - **que agregar una opción haga aparecer el desplegable en cada encuentro**, y
 *   que el encuentro nuevo herede la opción en vez de nacer sin ninguna;
 * - **que borrar una opción no se lleve los encuentros puestos**, que es la
 *   pérdida de datos que el ítem podía introducir.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => ({ valores: [], elegibles: [], cargando: false }),
  useLabelsTaxonomia: () => ({}),
}));

import { ActividadFormulario } from '@/components/admin/ActividadFormulario';

afterEach(cleanup);

/** Monta el formulario y deja abierta la pestaña «Encuentros». */
const enEncuentros = async () => {
  render(<ActividadFormulario
      rol="admin" vistaDelPanel="pc" uid="uid-de-prueba" onGuardado={vi.fn()} onCancelar={vi.fn()} />);
  await userEvent.click(screen.getByRole('tab', { name: /^Encuentros/ }));
  return screen.getByRole('tabpanel', { name: /Encuentros/, hidden: true });
};

const panel = () => screen.getByRole('tabpanel', { name: /Encuentros/, hidden: true });

/**
 * El desplegable de opción de un encuentro. **El `*` es parte del nombre**: el
 * campo es obligatorio y `Campo` pinta el asterisco adentro del `<label>`, así
 * que sin él la búsqueda no encuentra nada — y con `/^Opción/` a secas
 * encontraría también los campos «Opción 1» del editor de opciones.
 */
const selectsDeOpcion = () =>
  within(panel()).queryAllByLabelText(/^Opción\*$/) as HTMLSelectElement[];

/**
 * El bloque de opciones, acotado. Hace falta porque «1 encuentro» lo dice
 * también el contador de la lista de encuentros (`FilasEditor`), y buscar en el
 * panel entero encuentra los dos.
 */
const bloqueDeOpciones = (): HTMLElement =>
  within(panel()).getByText('Opciones para sumarse').closest('div')!.parentElement!;

describe('el bloque de opciones aparece cuando corresponde (B-181)', () => {
  it('en una actividad nueva no está: no es un ciclo todavía', () => {
    /*
     * `esCiclo` arranca destildado, y cuatro horarios alternativos de una charla
     * suelta no existen. Mostrar el bloque siempre sería una pregunta más en un
     * formulario que ya tiene treinta campos.
     *
     * MUTACIÓN PROBADA: sacando la condición `form.esCiclo ||
     * form.comisiones.length > 0` de `SeccionEncuentros`, este caso queda en rojo
     * con el bloque a la vista en toda actividad.
     */
    render(<ActividadFormulario
      rol="admin" vistaDelPanel="pc" uid="uid-de-prueba" onGuardado={vi.fn()} onCancelar={vi.fn()} />);
    expect(screen.queryByText('Opciones para sumarse')).toBeNull();
  });

  it('al tildar «es un ciclo» aparece, y todavía sin ninguna opción', async () => {
    await enEncuentros();
    await userEvent.click(within(panel()).getByLabelText(/Es un ciclo/));

    expect(within(panel()).getByText('Opciones para sumarse')).toBeTruthy();
    // El texto del caso vacío: lo normal es no tener ninguna, y hay que decirlo
    // para que la lista vacía no se lea como algo a medio hacer.
    expect(within(panel()).getByText(/no hace falta ninguna/)).toBeTruthy();
  });

  it('sin opciones, ningún encuentro pregunta de cuál es', async () => {
    await enEncuentros();
    await userEvent.click(within(panel()).getByLabelText(/Es un ciclo/));
    expect(within(panel()).queryByLabelText(/^Opción/)).toBeNull();
  });
});

describe('agregar una opción cambia lo que cada encuentro pide', () => {
  const conUnaOpcion = async (etiqueta = 'Martes 19 h') => {
    await enEncuentros();
    await userEvent.click(within(panel()).getByLabelText(/Es un ciclo/));
    await userEvent.click(within(panel()).getByRole('button', { name: /Agregar opción/ }));
    await userEvent.type(within(panel()).getByLabelText(/^Opción 1/), etiqueta);
  };

  it('el encuentro pasa a tener un desplegable con la opción cargada', async () => {
    await conUnaOpcion();

    const select = within(panel()).getByLabelText(/^Opción\*$/) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      '— elegí una —',
      'Martes 19 h',
    ]);
  });

  /**
   * **El encuentro que ya estaba no se reasigna solo.** Es la decisión fina del
   * diseño: el `select` arranca en «— elegí una —» y no en la primera opción,
   * porque si mostrara la primera como elegida el schema no tendría nada que
   * rechazar y se publicaría un encuentro en una comisión que nadie eligió.
   */
  it('el encuentro que ya existía queda sin elegir', async () => {
    await conUnaOpcion();
    expect((within(panel()).getByLabelText(/^Opción\*$/) as HTMLSelectElement).value).toBe('');
  });

  /**
   * Y la contracara: el encuentro **nuevo** sí hereda. Con `null` habría que
   * elegir la opción en cada una de las ocho filas de un ciclo.
   */
  it('un encuentro agregado después nace en la opción que hay', async () => {
    await conUnaOpcion();
    await userEvent.click(within(panel()).getByRole('button', { name: /Agregar encuentro/ }));

    const selects = within(panel()).getAllByLabelText(/^Opción\*$/) as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(selects[1]!.value).not.toBe('');
    expect(selects[1]!.selectedOptions[0]!.textContent).toBe('Martes 19 h');
  });

  it('la opción dice cuántos encuentros tiene', async () => {
    await conUnaOpcion();
    // Con el encuentro que ya estaba sin asignar, la cuenta es cero: es lo que
    // hace visible que falta elegirle la opción.
    expect(within(bloqueDeOpciones()).getByText('0 encuentros')).toBeTruthy();

    await userEvent.selectOptions(within(panel()).getByLabelText(/^Opción\*$/), 'Martes 19 h');
    expect(within(bloqueDeOpciones()).getByText('1 encuentro')).toBeTruthy();
  });
});

describe('borrar una opción no se lleva los encuentros', () => {
  /**
   * Son fechas cargadas a mano: que desaparezcan por sacar una etiqueta sería
   * destruir trabajo sin preguntar. Quedan sin opción, visibles, y el schema
   * pide que se les asigne otra antes de publicar.
   */
  it('el encuentro sigue ahí y vuelve a «sin opción»', async () => {
    await enEncuentros();
    await userEvent.click(within(panel()).getByLabelText(/Es un ciclo/));
    await userEvent.click(within(panel()).getByRole('button', { name: /Agregar opción/ }));
    await userEvent.type(within(panel()).getByLabelText(/^Opción 1/), 'Martes 19 h');
    await userEvent.selectOptions(within(panel()).getByLabelText(/^Opción\*$/), 'Martes 19 h');

    await userEvent.click(within(panel()).getByRole('button', { name: /Borrar la opción/ }));

    // El bloque queda (el ciclo sigue tildado) pero sin filas, y el encuentro
    // ya no tiene desplegable porque no hay opciones a las que apuntar.
    expect(selectsDeOpcion()).toEqual([]);
    // El contador de la lista de encuentros: la fila sigue ahí.
    expect(within(panel()).getByText(/1 encuentro/)).toBeTruthy();
  });
});
