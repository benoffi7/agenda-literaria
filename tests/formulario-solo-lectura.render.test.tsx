/**
 * **El formulario en solo lectura, montado de verdad** — B-919.
 *
 * Una actividad de la ciudad del publicador que cargó otra cuenta: la regla le da
 * `read` y rechaza el `update` («era modo lectura los otros que no son de ella»,
 * el dueño). El formulario se abre para mirarla y **no puede ofrecer guardar**.
 *
 * ── Por qué esto necesita DOM ─────────────────────────────────────────────
 * Lo que hace el apagado es un `<fieldset disabled>`: el navegador apaga los
 * ~ochenta controles de adentro **por herencia del DOM**, no por un atributo en
 * cada uno. Un test que lea el fuente puede verificar que el `<fieldset>` está —y
 * eso ya lo hace el compilador— pero **no** que los controles queden realmente
 * apagados, que es lo único que importa. Es exactamente el falso verde de B-202.
 *
 * Y es el §«Verificar la clase, no la instancia» aplicado a la UI: con una lista
 * de `disabled` campo por campo, **el campo que se agregue mañana nacería
 * habilitado**; con el fieldset nace apagado. Este archivo mide esa propiedad
 * —cuenta los controles contra el formulario editable, no contra un número
 * escrito a mano— para que siga siendo cierta.
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

/**
 * La descripción de la sección «Difusión», copiada de `SeccionDifusion.tsx`.
 * Es lo que distingue que la sección **está** de que su pestaña exista.
 */
const DESCRIPCION_DE_DIFUSION = 'Uso interno. Nunca sale al sitio público ni al calendario.';

const pintar = (soloLectura: boolean) =>
  render(
    <ActividadFormulario
      rol="publicador"
      vistaDelPanel="celular"
      uid="uid-de-prueba"
      soloLectura={soloLectura}
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
    />,
  );

/** Todo lo que se puede tocar adentro del formulario. */
const controles = (): HTMLElement[] => [
  ...screen.queryAllByRole('textbox', { hidden: true }),
  ...screen.queryAllByRole('combobox', { hidden: true }),
  ...screen.queryAllByRole('checkbox', { hidden: true }),
  ...screen.queryAllByRole('spinbutton', { hidden: true }),
];

describe('en solo lectura no hay dónde guardar (B-919)', () => {
  it('no están los dos botones de guardar, y «Cancelar» pasa a «Volver»', () => {
    /*
     * **Un botón que existe y siempre falla es peor que no tenerlo**, y acá el
     * fallo llegaría después de veinte minutos de edición. «Volver» sí tiene que
     * seguir apretándose: por eso la barra queda **afuera** del `fieldset`.
     *
     * MUTACIÓN PROBADA: sacarle el `soloLectura ?` al `className` del bloque de
     * los dos botones en `BarraAcciones.tsx` deja este caso en rojo; el de abajo
     * —el control positivo— sigue verde.
     */
    pintar(true);
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear actividad' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Volver' })).not.toBeNull();
  });

  it('y dice por qué, arriba de todo', () => {
    // Se lee al abrir, que es cuando sirve: un cartel abajo aparecería recién
    // cuando ya se intentó editar.
    pintar(true);
    expect(screen.getByText('Solo lectura')).not.toBeNull();
  });

  it('TODOS los controles quedan apagados, y son los mismos que el editable tiene', () => {
    /*
     * **Las dos mitades del caso, y hacen falta las dos.**
     *
     * La primera —que ninguno quede encendido— es lo que mide el apagado. La
     * segunda —que la cuenta sea la misma que en el formulario editable— es lo
     * que impide el falso verde obvio: un formulario que en solo lectura no
     * renderizara **ningún** campo pasaría la primera mitad con cero controles.
     *
     * MUTACIÓN PROBADA: cambiar `disabled={soloLectura}` por `disabled={false}`
     * en el `<fieldset>` de `ActividadFormulario.tsx` deja este caso en rojo.
     */
    const { unmount } = pintar(false);
    const cuantosEditable = controles().length;
    expect(cuantosEditable).toBeGreaterThan(10);
    unmount();

    pintar(true);
    const enSoloLectura = controles();
    expect(enSoloLectura).toHaveLength(cuantosEditable);
    /*
     * `:disabled` y **no** `.disabled`: la propiedad refleja el atributo del
     * propio elemento, y acá ninguno lo tiene — lo que los apaga es el
     * `<fieldset disabled>` de arriba, que es herencia del DOM. Preguntar por la
     * propiedad da `false` en los treinta y ese es el falso rojo que este
     * comentario existe para que nadie «arregle» sacando el fieldset.
     */
    expect(enSoloLectura.filter((c) => !c.matches(':disabled')).map((c) => c.id)).toEqual([]);
  });

  it('las solapas se pueden apretar: la ficha ajena se recorre entera', () => {
    /*
     * **Lo cobró el `auditor-privacidad`, y era un efecto y no una decisión.**
     * Un `<fieldset disabled>` apaga TODOS sus descendientes, y las solapas son
     * `<button>`: con la tira adentro, la ficha ajena quedaba clavada en la
     * primera pestaña en pantalla ancha y se recorría entera en el teléfono —o
     * sea que qué se veía de un tercero dependía del ancho de la ventana—.
     *
     * MUTACIÓN PROBADA: volver a abrir el `<fieldset>` antes de
     * `<PestaniasFormulario>` deja este caso en rojo con las nueve solapas
     * deshabilitadas.
     */
    render(
      <ActividadFormulario
        rol="publicador"
        vistaDelPanel="pc"
        uid="uid-de-prueba"
        soloLectura
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );
    const solapas = screen.getAllByRole('tab');
    expect(solapas.length).toBeGreaterThan(1);
    expect(solapas.filter((t) => t.matches(':disabled'))).toEqual([]);
  });

  it('no muestra lo interno de quien la cargó (§5.1)', () => {
    /*
     * `difusion` es la única sección que es **trabajo interno** de la otra
     * cuenta: los handles que va a etiquetar al publicar y sus notas libres, que
     * el §5.1 declara «nunca público». El panel no tiene por qué ponérselo
     * adelante a otra cuenta.
     *
     * Se afirma sobre la **descripción de la sección** y no sobre las etiquetas de
     * sus dos campos, y los dos motivos se descubrieron escribiendo esto: la
     * sección es `colapsable` con `abiertaPorDefecto={false}`, así que sus campos
     * no están en el DOM ni en el formulario editable —el control positivo de
     * abajo daba rojo—; y la ayuda de «Texto para redes» **nombra** las notas
     * internas en una frase explicativa, así que buscar el texto suelto daría
     * rojo por algo que no es el dato de nadie.
     *
     * MUTACIÓN PROBADA: sacarle el `soloLectura ? null :` a la entrada `difusion`
     * del mapa deja este caso en rojo; el de abajo —el editable— sigue verde.
     */
    pintar(true);
    expect(screen.queryByText(DESCRIPCION_DE_DIFUSION)).toBeNull();
  });

  it('y el editable sí la muestra — el control positivo de lo anterior', () => {
    pintar(false);
    expect(screen.getByText(DESCRIPCION_DE_DIFUSION)).not.toBeNull();
  });

  it('el formulario editable sigue ofreciendo guardar — el control positivo', () => {
    /*
     * Sin esto, un `BarraAcciones` que **nunca** dibujara los botones de guardar
     * dejaría verdes los tres casos de arriba. Es lo que B-894 destapó: lo que se
     * apaga primero es lo que OTORGA.
     */
    pintar(false);
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Crear actividad' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toBeNull();
    expect(screen.queryByText('Solo lectura')).toBeNull();
  });
});
