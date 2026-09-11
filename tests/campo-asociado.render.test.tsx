/**
 * **El `id` que declara `Campo` llega al control real del DOM** — B-827, el
 * punto ciego del barrido.
 *
 * El barrido de `clases-de-bug.test.ts` compara **texto**: exige que dentro de
 * `<Campo htmlFor={X}>…</Campo>` aparezca `id={X}`. Eso agarra el caso original
 * —un `htmlFor` apuntando a un id que nadie declara— y **no puede** agarrar el
 * siguiente: un componente hijo que **recibe** el `id` y no lo reenvía a su
 * `<input>`. El texto dice `id={campoId('x')}` y el DOM sale sin nada.
 *
 * Hoy los tres widgets que reciben `id` lo reenvían bien (`TaxonomiaSelect` a su
 * `<select>` **y** al input de «Otro», `TagsInput` y `ChipsInput` a su input), y
 * eso está verificado a mano. Este archivo lo pone en un test: monta el
 * formulario de verdad y busca cada campo **por su label**, que es como lo
 * encuentra una persona con lector de pantalla.
 *
 * Lo señaló el `auditor-trampas` sobre esta tanda, y es la única forma de
 * cerrarlo: un render test. Un cuarto widget que reciba `id` y no lo forwardee
 * dejaría el barrido en verde.
 *
 * **Se monta en «celular»** (apilado) a propósito: en esa vista las nueve
 * secciones están en el DOM a la vez, así que un solo render alcanza para cubrir
 * los cuatro tipos de control. En «PC» habría que ir pestaña por pestaña.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const pintar = () =>
  render(
    <ActividadFormulario
      rol="admin"
      vistaDelPanel="celular"
      uid="uid-de-prueba"
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
    />,
  );

/**
 * Un campo por **tipo de control**, no todos los campos: lo que puede romperse
 * es el reenvío del `id`, y eso es del componente, no del campo. Con uno de cada
 * forma se cubre el mecanismo entero.
 */
const CAMPOS: [etiqueta: RegExp, control: string, quien: string][] = [
  [/^título/i, 'INPUT', '`<input>` suelto — el caso de B-822, el que destapó todo'],
  [/^descripción/i, 'TEXTAREA', '`<textarea>` suelto'],
  [/^estado/i, 'SELECT', '`<select>` suelto'],
  [/^tipo de actividad/i, 'SELECT', '`TaxonomiaSelect` → su `<select>`'],
  [/^qué se llevan/i, 'INPUT', '`TagsInput` → su input (B-830)'],
];

describe('el id que declara `Campo` llega al control real — B-827', () => {
  it.each(CAMPOS)('«%s» se encuentra por su label (%s)', (etiqueta, tag, quien) => {
    pintar();
    // `getByLabelText` es la forma en que Testing Library espera que se busque un
    // campo, justamente porque es la que se parece a cómo lo encuentra una
    // persona: resuelve la asociación `label[for]` ↔ `id` de verdad, sobre el DOM.
    const control = screen.getByLabelText(etiqueta);
    expect(control.tagName, quien).toBe(tag);
  });

  /**
   * **El caso del grupo**, que es la otra mitad de B-827. Donde no hay **un**
   * control al que apuntar —la tira de botones de modalidad— el rótulo no es un
   * `<label for>` sino un `<span id>` con un `role="group"` que lo referencia por
   * `aria-labelledby`. El nombre accesible existe igual, y se busca distinto.
   */
  it('«Modalidad» nombra a un grupo y no a un control (`comoGrupo`)', () => {
    pintar();
    const grupo = screen.getByRole('group', { name: /^modalidad/i });
    expect(grupo.tagName).toBe('DIV');
    // Y los botones de la tira están adentro, que es lo que el grupo nombra.
    expect(grupo.querySelectorAll('button').length).toBeGreaterThan(1);
  });

  /**
   * Control positivo del archivo: si el formulario dejara de montarse —un mock
   * de menos, un throw en un hijo— todos los casos de arriba fallarían con
   * «unable to find a label», que se lee como «el label se rompió» y no como «no
   * hay formulario». Esto lo distingue.
   */
  it('el formulario se montó de verdad', () => {
    pintar();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(5);
    expect(screen.getAllByRole('group').length).toBeGreaterThan(0);
  });
});
