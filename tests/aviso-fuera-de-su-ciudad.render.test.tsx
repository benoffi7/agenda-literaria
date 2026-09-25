/**
 * **El aviso de «fuera de tu ciudad», montado de verdad** — B-921, D-1150.
 *
 * Un publicador con ciudad no puede guardar una sede fuera de la suya: lo frena
 * la regla (`dentroDeSuCiudad()`), y el panel tiene que decirlo **antes** —con
 * una frase que no parezca un error del sistema— en vez de dejar que llegue el
 * «no tenés permiso» del servidor después de veinte minutos de carga.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  useOpciones: (campo: string) => ({
    valores: campo === 'ciudad' ? [{ slug: 'mar-del-plata', label: 'Mar del Plata' }] : [],
    elegibles: [],
    cargando: false,
  }),
  useLabelsTaxonomia: () => ({}),
}));
vi.mock('@/lib/actividades', async (original) => ({
  ...(await original<typeof import('@/lib/actividades')>()),
  crearActividad: vi.fn(async () => 'act-nueva'),
  slugDisponible: vi.fn(async () => true),
}));

import { ActividadFormulario } from '@/components/admin/ActividadFormulario';
import { crearActividad } from '@/lib/actividades';
import { formDeCiclo } from './fixtures/formulario-de-ciclo';
import type { ActividadForm } from '@/types/actividad';

afterEach(cleanup);
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(crearActividad).mockClear();
});

const enCiudad = (ciudad: string): ActividadForm => {
  const f = formDeCiclo();
  return {
    ...f,
    estado: 'borrador',
    modalidades: f.modalidades.map((m) => ({
      ...m,
      sede: m.sede && { ...m.sede, provincia: 'buenos-aires', barrio: '', ciudad },
    })),
  };
};

const pintar = (copia: ActividadForm, ciudad: string) =>
  render(
    <ActividadFormulario
      rol="publicador"
      vistaDelPanel="celular"
      formatoDeHora="24"
      uid="uid-de-prueba"
      copia={copia}
      ciudad={ciudad}
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
    />,
  );

const aviso = () => document.querySelector('[data-aviso="fuera-de-su-ciudad"]');

describe('el aviso de fuera de su ciudad (B-921)', () => {
  it('aparece apenas la sede es de otra ciudad, con las dos ciudades nombradas', () => {
    pintar(enCiudad('rosario'), 'mar-del-plata');
    expect(aviso()).not.toBeNull();
    expect(aviso()!.textContent).toContain('Mar del Plata');
    expect(aviso()!.textContent).toContain('Rosario');
  });

  it('no aparece dentro de su ciudad, ni para el publicador general', () => {
    // Los controles positivos: un aviso que saliera siempre pasaría el de arriba.
    const { unmount } = pintar(enCiudad('mar-del-plata'), 'mar-del-plata');
    expect(aviso()).toBeNull();
    unmount();
    pintar(enCiudad('rosario'), '');
    expect(aviso()).toBeNull();
  });

  it('guardar igual no escribe, y deja el mismo texto en la barra', async () => {
    /*
     * El aviso se puede no leer; el guardado no se saltea. MUTACIÓN PROBADA:
     * sacar `alcance` de la llamada a `guardarActividad` en
     * `ActividadFormulario.tsx` deja este caso en rojo con `crearActividad`
     * llamado.
     */
    pintar(enCiudad('rosario'), 'mar-del-plata');
    await userEvent.click(screen.getAllByRole('button', { name: /Guardar borrador/ })[0]!);
    expect(vi.mocked(crearActividad)).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Tu cuenta carga actividades de Mar del Plata/).length).toBe(2);
  });
});
