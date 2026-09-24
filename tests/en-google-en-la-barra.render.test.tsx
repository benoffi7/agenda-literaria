/**
 * **La fila de Google en la barra de guardar** — B-813.
 *
 * Qué se decide en `lib/formulario/enGoogle.ts` lo fija
 * `tests/en-google-del-formulario.test.ts`. Esto fija lo que un test puro no ve:
 * que la fila **se pinte**, cuándo, y que no frene nada.
 *
 * 1. Con el formulario montado de verdad, una actividad lista para publicar y
 *    sin tallerista ni monto muestra la fila, y los botones de guardar siguen
 *    ahí y habilitados: es aviso, no bloqueo (D-440).
 * 2. Tocar un dato lleva a su sección, como el resto de la barra.
 * 3. No aparece mientras hay algo más urgente (el gris de «para publicar falta»)
 *    ni en solo lectura, donde no hay cómo cargar lo que falta.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { BarraAcciones } from '@/components/admin/formulario/BarraAcciones';
import { resumirFaltantes } from '@/lib/formulario/camposFaltantes';
import { loQuePierdeEnGoogle } from '@/lib/formulario/enGoogle';
import type { ActividadForm } from '@/types/actividad';
import { formularioLleno } from './fixtures/formulario';

afterEach(cleanup);
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const fila = (): HTMLElement | null => document.querySelector('[data-aviso="en-google"]');

const sinQuienNiMonto = (): ActividadForm =>
  formularioLleno({
    tallerista: null,
    arancel: { tipo: 'arancelado', notas: '', monto: null },
  });

describe('con el formulario montado', () => {
  const pintar = (copia: ActividadForm) =>
    render(
      <ActividadFormulario
        rol="publicador"
        vistaDelPanel="pc"
        formatoDeHora="24"
        uid="uid-de-prueba"
        copia={copia}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );

  it('una actividad lista para publicar sin tallerista ni monto muestra la fila', () => {
    pintar(sinQuienNiMonto());
    // Control: el fixture está para publicarse, así que no hay un gris antes.
    expect(screen.queryByText(/Para publicar falta/)).toBeNull();
    const aviso = fila();
    expect(aviso?.textContent).toBe(
      'Se publica igual, pero en Google sale sin quién la da ni precio.',
    );
  });

  it('y no frena nada: los dos botones de guardar siguen habilitados', () => {
    pintar(sinQuienNiMonto());
    expect(fila()).not.toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'Guardar borrador',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole('button', {
          name: 'Crear actividad',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('una actividad completa no la muestra (control positivo)', () => {
    pintar(formularioLleno());
    expect(fila()).toBeNull();
  });
});

describe('la barra sola', () => {
  const vacio = resumirFaltantes([]);
  const enGoogle = loQuePierdeEnGoogle(sinQuienNiMonto());

  const barra = (over: Partial<Parameters<typeof BarraAcciones>[0]> = {}) => {
    const onIrASeccion = vi.fn();
    render(
      <BarraAcciones
        guardando={false}
        fallo={null}
        faltantes={vacio}
        pendientesParaPublicar={vacio}
        recomendaciones={[]}
        enGoogle={enGoogle}
        esEdicion={false}
        onCancelar={vi.fn()}
        onGuardarBorrador={vi.fn()}
        onIrASeccion={onIrASeccion}
        {...over}
      />,
    );
    return onIrASeccion;
  };

  it('cada dato es un botón que lleva a su sección', () => {
    const onIrASeccion = barra();
    fireEvent.click(screen.getByRole('button', { name: 'precio' }));
    expect(onIrASeccion).toHaveBeenLastCalledWith('arancel-inscripcion');
    fireEvent.click(screen.getByRole('button', { name: 'quién la da' }));
    expect(onIrASeccion).toHaveBeenLastCalledWith('quien');
  });

  it('convive con el consejo del flyer, debajo', () => {
    barra({
      recomendaciones: [
        {
          id: 'flyer',
          etiqueta: 'el flyer',
          porQue: 'no entra en la cartelera',
          seccion: 'que-es',
        },
      ],
    });
    expect(screen.getByText(/Conviene cargar/)).not.toBeNull();
    expect(fila()).not.toBeNull();
  });

  it('no aparece si hay algo que va a faltar para publicar', () => {
    barra({ pendientesParaPublicar: resumirFaltantes(['titulo']) });
    expect(screen.getByText(/Para publicar falta/)).not.toBeNull();
    expect(fila()).toBeNull();
  });

  it('no aparece con un fallo de guardado', () => {
    barra({ fallo: 'No se pudo guardar.' });
    expect(fila()).toBeNull();
  });

  it('no aparece en solo lectura: no hay cómo cargar lo que falta', () => {
    barra({ soloLectura: true });
    expect(fila()).toBeNull();
  });
});
