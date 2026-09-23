/**
 * El control de fecha y hora en 12 horas, verificado por comportamiento —
 * B-889, D-720.
 *
 * ── Por qué éste sí necesita DOM ──────────────────────────────────────────
 * La política del repo (§05-patrones, B-08) es que un `.render.test.tsx` se
 * escribe donde el **cableado** es la pregunta y un test que lee el fuente daría
 * un falso verde. Acá lo es, y por una razón concreta: el componente es
 * controlado por el valor **compuesto**, y las piezas se tipean de a una. El modo
 * de falla no es que la conversión esté mal —eso lo cubre
 * `tests/formato-de-hora.test.ts`, sin DOM— sino que **lo tipeado se borre entre
 * teclas**, que es lo que pasa si el valor de afuera es la única fuente. Eso solo
 * se ve tipeando.
 *
 * Lo mismo con el reemplazo: que el nativo aparezca donde corresponde
 * (`formato: '24'`, o la vista del panel en `celular`) es una decisión de D-720 y
 * se verifica mirando qué control quedó en el DOM, no qué dice el JSX.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampoDeFechaYHora } from '@/components/campos/CampoDeFechaYHora';
import type { FormatoDeHora } from '@/lib/formatoDeHora';
import type { VistaDelPanel } from '@/lib/vistaDelPanel';

afterEach(cleanup);

const dibujar = (over: {
  value?: string;
  formato?: FormatoDeHora;
  vista?: VistaDelPanel;
  onChange?: (v: string) => void;
} = {}) => {
  const onChange = over.onChange ?? vi.fn();
  const utils = render(
    <CampoDeFechaYHora
      label="Inicio"
      id="sesion-inicio-1"
      value={over.value ?? ''}
      onChange={onChange}
      formato={over.formato ?? '12'}
      vista={over.vista ?? 'pc'}
    />,
  );
  return { onChange, ...utils };
};

describe('cuándo se reemplaza el control nativo — D-720', () => {
  it('con formato 12 y vista de PC, las cuatro piezas', () => {
    dibujar({ formato: '12', vista: 'pc' });
    expect(screen.getByLabelText('Inicio — fecha')).toBeTruthy();
    expect(screen.getByLabelText('Inicio — hora, de 1 a 12')).toBeTruthy();
    expect(screen.getByLabelText('Inicio — minutos')).toBeTruthy();
    expect(screen.getByLabelText('Inicio — AM o PM')).toBeTruthy();
  });

  it('con formato 24 se queda el nativo, que ya hace lo que se quiere', () => {
    const { container } = dibujar({ formato: '24', vista: 'pc' });
    expect(container.querySelector('input[type="datetime-local"]')).toBeTruthy();
    expect(screen.queryByLabelText('Inicio — AM o PM')).toBeNull();
  });

  it('en la vista de celular también, aunque el formato sea 12', () => {
    // Cuatro cajitas para tipear son peores que el selector del teléfono.
    const { container } = dibujar({ formato: '12', vista: 'celular' });
    expect(container.querySelector('input[type="datetime-local"]')).toBeTruthy();
    expect(screen.queryByLabelText('Inicio — AM o PM')).toBeNull();
  });
});

describe('tipear', () => {
  it('lo tipeado NO se borra entre teclas cuando el campo todavía no vale', async () => {
    // El modo de falla que este archivo existe para atrapar: con `value` como
    // única fuente, la hora se vacía en cada tecla mientras falte la fecha,
    // porque un campo incompleto compone `''`.
    const onChange = vi.fn();
    dibujar({ onChange });
    const hora = screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement;

    await userEvent.type(hora, '7');
    expect(hora.value).toBe('7');

    const minutos = screen.getByLabelText('Inicio — minutos') as HTMLInputElement;
    await userEvent.type(minutos, '30');
    expect(minutos.value).toBe('30');
    expect(hora.value).toBe('7');

    // Y mientras falta la fecha, hacia afuera sigue siendo «no hay valor».
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('completar las cuatro piezas compone el string del formulario', async () => {
    const onChange = vi.fn();
    dibujar({ onChange });

    await userEvent.type(screen.getByLabelText('Inicio — fecha'), '2026-10-07');
    await userEvent.type(screen.getByLabelText('Inicio — hora, de 1 a 12'), '7');
    await userEvent.type(screen.getByLabelText('Inicio — minutos'), '30');
    await userEvent.selectOptions(screen.getByLabelText('Inicio — AM o PM'), 'PM');

    expect(onChange).toHaveBeenLastCalledWith('2026-10-07T19:30');
  });

  it('cambiar AM por PM corre la hora doce lugares, que es el pedido entero', async () => {
    const onChange = vi.fn();
    dibujar({ value: '2026-10-07T07:30', onChange });

    await userEvent.selectOptions(screen.getByLabelText('Inicio — AM o PM'), 'PM');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-07T19:30');
  });

  /**
   * **B-1234 — «escribo 20 y sigue saliendo 2», el reporte del dueño.**
   *
   * El control de 12 lo usa alguien que viene de cargar en 24. Hasta este ítem,
   * el segundo dígito sacaba la hora de rango y `dePiezas` devolvía `''`: la
   * cajita seguía mostrando `20`, pero **hacia afuera la fecha entera se
   * vaciaba**, sin un error y sin el eco. Lo que se guardaba era un encuentro
   * sin fecha.
   *
   * Acá va montado y no en `formato-de-hora.test.ts` porque lo que se afirma es
   * el **cableado**: que la cajita y el desplegable muestren lo convertido, que
   * es lo que le dice a quien carga que se entendió lo que tipeó.
   */
  it('escribir 20 en la hora queda 8 PM, no vacía la fecha', async () => {
    const onChange = vi.fn();
    dibujar({ value: '2026-10-07T07:30', onChange });
    const hora = screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement;

    await userEvent.clear(hora);
    await userEvent.type(hora, '20');

    expect(hora.value).toBe('8');
    expect((screen.getByLabelText('Inicio — AM o PM') as HTMLSelectElement).value).toBe('PM');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-07T20:30');
  });

  it('y la medianoche montada: 00 queda 12 AM, no «0»', async () => {
    /*
     * El borde que el propio módulo señala como el que se escribe mal, acá
     * arriba del cableado y no solo en la función pura: `aReloj12` lo resuelve
     * bien desde B-889, pero lo que este caso afirma es que la cajita **y** el
     * desplegable lo muestran — que es lo que le dice a quien carga que se
     * entendió «medianoche» y no «cero».
     */
    const onChange = vi.fn();
    dibujar({ value: '2026-10-07T19:30', onChange });
    const hora = screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement;

    await userEvent.clear(hora);
    await userEvent.type(hora, '00');

    expect(hora.value).toBe('12');
    expect((screen.getByLabelText('Inicio — AM o PM') as HTMLSelectElement).value).toBe('AM');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-07T00:30');
  });

  it('y una hora que el reloj de 12 sí dice no se lleva puesto el AM/PM', async () => {
    // La otra mitad: con PM elegido, retipear `10` es las diez de la noche.
    const onChange = vi.fn();
    dibujar({ value: '2026-10-07T19:30', onChange });
    const hora = screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement;

    await userEvent.clear(hora);
    await userEvent.type(hora, '10');

    expect(hora.value).toBe('10');
    expect((screen.getByLabelText('Inicio — AM o PM') as HTMLSelectElement).value).toBe('PM');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-07T22:30');
  });

  it('no deja tipear letras ni un tercer dígito en la hora', async () => {
    dibujar();
    const hora = screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement;
    await userEvent.type(hora, 'a1b2c3');
    expect(hora.value).toBe('12');
  });
});

describe('lo que llega de afuera', () => {
  it('un valor existente se muestra en 12 horas', () => {
    dibujar({ value: '2026-10-07T19:30' });
    expect((screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement).value).toBe('7');
    expect((screen.getByLabelText('Inicio — minutos') as HTMLInputElement).value).toBe('30');
    expect((screen.getByLabelText('Inicio — AM o PM') as HTMLSelectElement).value).toBe('PM');
  });

  it('cambiarlo desde afuera rearma las piezas — restaurar un borrador, generar encuentros', () => {
    const { rerender } = dibujar({ value: '2026-10-07T19:30' });
    rerender(
      <CampoDeFechaYHora
        label="Inicio"
        id="sesion-inicio-1"
        value="2026-11-04T09:00"
        onChange={vi.fn()}
        formato="12"
        vista="pc"
      />,
    );
    expect((screen.getByLabelText('Inicio — fecha') as HTMLInputElement).value).toBe('2026-11-04');
    expect((screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement).value).toBe('9');
    expect((screen.getByLabelText('Inicio — AM o PM') as HTMLSelectElement).value).toBe('AM');
  });

  it('pasar de 24 a 12 rearma la hora aunque el valor compuesto no cambie', () => {
    // `07:30` vale en los dos formatos, así que nada pediría rearmar y la
    // cajita quedaría mostrando `07` en un reloj de 12. Por eso el estado
    // guarda con qué formato se armó.
    const { rerender } = dibujar({ value: '2026-10-07T07:30', formato: '24' });
    rerender(
      <CampoDeFechaYHora
        label="Inicio"
        id="sesion-inicio-1"
        value="2026-10-07T07:30"
        onChange={vi.fn()}
        formato="12"
        vista="pc"
      />,
    );
    expect((screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement).value).toBe('7');
  });
});

describe('lo que se pierde al cambiar el interruptor, dicho', () => {
  it('con una hora inválida a medio tipear, cambiar el formato borra lo tipeado', async () => {
    // Lo marcó el `auditor-trampas` como «sin red», y no es una pérdida de datos
    // —hacia afuera el valor ya era `''`, porque un `25` no compone nada— pero
    // **sí se ve**: la cajita se vacía. Queda afirmado para que sea una decisión
    // y no una sorpresa; es consistente con el resto del diseño, donde un campo
    // incompleto no es un error sino un campo que todavía no vale.
    //
    // **El caso era `13` hasta B-1234**, y el cambio de ejemplo es la prueba de
    // que ese ítem hizo lo que dice: un `13` ya no es una hora inválida, es la
    // una de la tarde. Lo que queda inválido es el typo que no tiene ninguna
    // lectura.
    const { rerender } = dibujar({ value: '' });
    const hora = screen.getByLabelText('Inicio — hora, de 1 a 12') as HTMLInputElement;
    await userEvent.type(hora, '25');
    expect(hora.value).toBe('25');

    rerender(
      <CampoDeFechaYHora
        label="Inicio"
        id="sesion-inicio-1"
        value=""
        onChange={vi.fn()}
        formato="24"
        vista="pc"
      />,
    );
    // En 24 el control vuelve a ser el nativo, así que la cajita ya no existe.
    expect(screen.queryByLabelText('Inicio — hora, de 1 a 12')).toBeNull();
  });
});

describe('el eco — la red de que el control propio no esté mintiendo', () => {
  it('escribe en palabras lo que quedó cargado', () => {
    dibujar({ value: '2026-10-07T19:30' });
    expect(screen.getByText(/7:30 PM/)).toBeTruthy();
  });

  it('no aparece al lado del nativo: sería repetir lo que el navegador dibuja', () => {
    dibujar({ value: '2026-10-07T19:30', formato: '24' });
    expect(screen.queryByText(/7:30 PM/)).toBeNull();
  });

  it('con el campo a medio llenar no dibuja nada', () => {
    dibujar({ value: '' });
    // La hora escrita, no las opciones del desplegable —que sí dicen «AM».
    expect(screen.queryByText(/\d:\d\d\s(AM|PM)/)).toBeNull();
  });
});

describe('accesibilidad — las cuatro piezas se leen como un campo', () => {
  it('el grupo lleva el nombre del rótulo', () => {
    dibujar();
    expect(screen.getByRole('group', { name: /Inicio/ })).toBeTruthy();
  });

  it('el rótulo del grupo no le pisa el id a la cajita de la fecha', () => {
    // Dos elementos con el mismo id es DOM inválido, y deja al lector de
    // pantalla resolviendo cuál de los dos nombra al grupo.
    const { container } = dibujar();
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size, `ids repetidos: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('y cada pieza tiene el suyo: «Inicio» no alcanza para la cajita de minutos', () => {
    dibujar();
    for (const nombre of [
      'Inicio — fecha',
      'Inicio — hora, de 1 a 12',
      'Inicio — minutos',
      'Inicio — AM o PM',
    ]) {
      expect(screen.getByLabelText(nombre), nombre).toBeTruthy();
    }
  });
});
