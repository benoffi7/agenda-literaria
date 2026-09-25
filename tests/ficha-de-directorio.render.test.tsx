import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';

/**
 * El ciclo de guardado de los cuatro formularios de la Guía — M-10, D-1196.
 *
 * Los cuatro montan `useFichaDeDirectorio` y `MarcoDeFicha`, así que lo que se
 * fija acá es el esqueleto, corrido **sobre cada formulario de verdad** y no
 * sobre el hook suelto: un formulario que deje de pasarle al hook su función de
 * crear, o que pierda la política de etiquetas que tenía, se pone rojo acá.
 *
 * El schema de cada entidad se reemplaza por uno que acepta o rechaza a pedido,
 * porque lo que se prueba es qué pasa **después** de validar, no qué campos exige
 * (eso lo cubren `librerias.test.ts` y sus tres hermanos). Lo mismo con la
 * escritura: `crear*`, `guardar*` y la guarda de slug son espías.
 */

const h = vi.hoisted(() => ({
  valido: true,
  slugLibre: true,
  crear: vi.fn(),
  guardar: vi.fn(),
  upsertOpcion: vi.fn(),
  upsertOpciones: vi.fn(),
  medir: vi.fn(),
}));

const esquema = {
  safeParse: (f: unknown) =>
    h.valido
      ? { success: true, data: f }
      : { success: false, error: { issues: [{ path: ['nombre'], message: 'Falta el nombre.' }] } },
};

vi.mock('@/components/admin/campos-del-panel', () => ({
  TaxonomiaSelect: ({
    campo,
    onChange,
  }: {
    campo: string;
    onChange: (v: string, label?: string) => void;
  }) => (
    <button type="button" data-otro={campo} onClick={() => onChange(`nuevo-${campo}`, `Nuevo ${campo}`)}>
      otro {campo}
    </button>
  ),
  TagsInput: () => null,
}));
vi.mock('@/lib/analytics', () => ({ medirFuncion: h.medir }));
vi.mock('@/lib/opciones', () => ({ upsertOpcion: h.upsertOpcion, upsertOpciones: h.upsertOpciones }));

vi.mock('@/lib/libreria-schema', async (original) => ({
  ...(await original<object>()),
  libreriaFormSchema: esquema,
}));
vi.mock('@/lib/biblioteca-schema', async (original) => ({
  ...(await original<object>()),
  bibliotecaFormSchema: esquema,
}));
vi.mock('@/lib/suscripcion-literaria-schema', async (original) => ({
  ...(await original<object>()),
  suscripcionFormSchema: esquema,
}));
vi.mock('@/lib/lugar-schema', async (original) => ({
  ...(await original<object>()),
  lugarFormSchema: esquema,
}));

const escritura = () => ({
  crear: (...a: unknown[]) => h.crear(...a),
  guardar: (...a: unknown[]) => h.guardar(...a),
  libre: async () => h.slugLibre,
});
vi.mock('@/lib/librerias', async (original) => {
  const e = escritura();
  return {
    ...(await original<object>()),
    crearLibreria: e.crear,
    guardarLibreria: e.guardar,
    slugDeLibreriaDisponible: e.libre,
  };
});
vi.mock('@/lib/bibliotecas', async (original) => {
  const e = escritura();
  return {
    ...(await original<object>()),
    crearBiblioteca: e.crear,
    guardarBiblioteca: e.guardar,
    slugDeBibliotecaDisponible: e.libre,
  };
});
vi.mock('@/lib/suscripcionesLiterarias', async (original) => {
  const e = escritura();
  return {
    ...(await original<object>()),
    crearSuscripcion: e.crear,
    guardarSuscripcion: e.guardar,
    slugDeSuscripcionDisponible: e.libre,
  };
});
vi.mock('@/lib/lugares', async (original) => {
  const e = escritura();
  return {
    ...(await original<object>()),
    crearLugar: e.crear,
    guardarLugar: e.guardar,
    slugDeLugarDisponible: e.libre,
  };
});

const { LibreriaFormulario } = await import('@/components/admin/LibreriaFormulario');
const { BibliotecaFormulario } = await import('@/components/admin/BibliotecaFormulario');
const { SuscripcionFormulario } = await import('@/components/admin/SuscripcionFormulario');
const { LugarFormulario } = await import('@/components/admin/LugarFormulario');

interface Caso {
  nombre: string;
  Formulario: ComponentType<Record<string, unknown>>;
  medicion: string;
  tomado: string;
  respaldo: string;
  /** Con qué argumentos llama a su `guardar*` al editar: librería no pasa la ficha. */
  pasaLaFicha: boolean;
  /** El aviso cuando una etiqueta nueva no se pudo dar de alta. */
  avisoDeEtiqueta: RegExp;
  pieAlCrear: string;
  pieAlEditar: string;
}

const CASOS: Caso[] = [
  {
    nombre: 'librería',
    Formulario: LibreriaFormulario as unknown as Caso['Formulario'],
    medicion: 'libreria-guardar',
    tomado: 'Ya hay otra librería con esta dirección web.',
    respaldo: 'No se pudo guardar la librería',
    pasaLaFicha: false,
    avisoDeEtiqueta: /Se guardó, pero el (provincia|ciudad|barrio) «Nuevo \w+» no quedó en la lista/,
    pieAlCrear: 'Sin publicar queda esperando en la lista de librerías, y no se ve en el sitio.',
    pieAlEditar: 'Editar no cambia si está publicada o no. Eso se mueve desde la lista de librerías.',
  },
  {
    nombre: 'biblioteca',
    Formulario: BibliotecaFormulario as unknown as Caso['Formulario'],
    medicion: 'biblioteca-guardar',
    tomado: 'Ya hay otra biblioteca con esta dirección web.',
    respaldo: 'No se pudo guardar la biblioteca',
    pasaLaFicha: true,
    avisoDeEtiqueta:
      /Se guardó, pero el (provincia|ciudad|barrio|tipo de biblioteca) «Nuevo [\w-]+» no quedó en la lista/,
    pieAlCrear: 'Sin publicar queda esperando en la lista de bibliotecas, y no se ve en el sitio.',
    pieAlEditar:
      'Editar no cambia si está publicada o no. Eso se mueve desde la lista de bibliotecas.',
  },
  {
    nombre: 'suscripción',
    Formulario: SuscripcionFormulario as unknown as Caso['Formulario'],
    medicion: 'suscripcion-guardar',
    tomado: 'Ya hay otra suscripción con esta dirección web.',
    respaldo: 'No se pudo guardar la suscripción',
    pasaLaFicha: true,
    avisoDeEtiqueta: /Se guardó, pero estas opciones nuevas no quedaron en la lista: Nuevo [\w-]+\./,
    pieAlCrear: 'Sin publicar queda esperando en la lista de suscripciones, y no se ve en el sitio.',
    pieAlEditar:
      'Editar no cambia si está publicada o no. Eso se mueve desde la lista de suscripciones.',
  },
  {
    nombre: 'lugar',
    Formulario: LugarFormulario as unknown as Caso['Formulario'],
    medicion: 'lugar-guardar',
    tomado: 'Ya hay otro lugar con esta dirección web.',
    respaldo: 'No se pudo guardar el lugar',
    pasaLaFicha: true,
    avisoDeEtiqueta: /Se guardó, pero estas opciones nuevas no quedaron en la lista: Nuevo [\w-]+\./,
    pieAlCrear: 'Sin publicar quedo esperando en la lista de lugares, y no se ve en el sitio.',
    pieAlEditar: 'Editar no cambia si está publicado o no. Eso se mueve desde la lista de lugares.',
  },
];

/** Las alertas de la pantalla: el cartel del formulario y el error de cada campo. */
const textosDeAlerta = async () =>
  (await screen.findAllByRole('alert')).map((a) => a.textContent ?? '');

const INICIAL = { id: 'ficha-1', nombre: 'La ficha', slug: 'la-ficha', estado: 'pendiente' };

beforeEach(() => {
  h.valido = true;
  h.slugLibre = true;
  h.crear.mockReset().mockResolvedValue('nuevo-id');
  h.guardar.mockReset().mockResolvedValue(undefined);
  h.upsertOpcion.mockReset().mockResolvedValue('slug');
  h.upsertOpciones.mockReset().mockResolvedValue([]);
  h.medir.mockReset();
});
afterEach(cleanup);

describe.each(CASOS)('el formulario de $nombre', (caso) => {
  const montar = (inicial?: object) => {
    const onGuardado = vi.fn();
    const onCancelar = vi.fn();
    render(
      <caso.Formulario
        uid="uid-de-prueba"
        inicial={inicial}
        onGuardado={onGuardado}
        onCancelar={onCancelar}
      />,
    );
    return { onGuardado, onCancelar };
  };

  it('al crear ofrece los dos botones y el pie del alta', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Guardar y publicar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar sin publicar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect(screen.getByText(caso.pieAlCrear)).toBeTruthy();
  });

  it('al editar ofrece un solo guardar y el pie de la edición', () => {
    montar(INICIAL);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar y publicar' })).toBeNull();
    expect(screen.getByText(caso.pieAlEditar)).toBeTruthy();
  });

  it('con datos inválidos no escribe y dice qué mirar', async () => {
    h.valido = false;
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin publicar' }));
    expect(await textosDeAlerta()).toContain(
      'Faltan datos o hay algo mal cargado. Mirá los campos marcados.',
    );
    expect(screen.getByText('Falta el nombre.')).toBeTruthy();
    expect(h.crear).not.toHaveBeenCalled();
  });

  it('«Guardar y publicar» crea publicada, mide y avisa que terminó', async () => {
    const { onGuardado } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1));
    expect(h.crear).toHaveBeenCalledTimes(1);
    expect(h.crear.mock.calls[0]![1]).toBe(true);
    expect(h.medir).toHaveBeenCalledWith(caso.medicion);
  });

  it('«Guardar sin publicar» crea sin publicar', async () => {
    const { onGuardado } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin publicar' }));
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1));
    expect(h.crear.mock.calls[0]![1]).toBe(false);
  });

  it('al editar guarda sobre el id, y pasa la ficha solo si su escritura la pide', async () => {
    const { onGuardado } = montar(INICIAL);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1));
    expect(h.crear).not.toHaveBeenCalled();
    const args = h.guardar.mock.calls[0]!;
    expect(args[0]).toBe('ficha-1');
    expect(args).toHaveLength(caso.pasaLaFicha ? 3 : 2);
    if (caso.pasaLaFicha) expect(args[2]).toBe(INICIAL);
  });

  it('con el slug tomado no escribe y lo dice en el campo', async () => {
    h.slugLibre = false;
    const { onGuardado } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin publicar' }));
    expect(await textosDeAlerta()).toContain(
      'La dirección web está tomada. Cambiala y volvé a guardar.',
    );
    expect(screen.getByText(caso.tomado)).toBeTruthy();
    expect(h.crear).not.toHaveBeenCalled();
    expect(onGuardado).not.toHaveBeenCalled();
  });

  it('si la escritura falla, lo dice con el respaldo de la entidad', async () => {
    h.crear.mockRejectedValue({ code: 'algo-raro' });
    const { onGuardado } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin publicar' }));
    expect((await textosDeAlerta()).some((t) => t.includes(caso.respaldo))).toBe(true);
    expect(onGuardado).not.toHaveBeenCalled();
  });

  it('da de alta la etiqueta nueva después de guardar', async () => {
    const { onGuardado } = montar();
    const otro = document.querySelector<HTMLButtonElement>('[data-otro]')!;
    const campo = otro.dataset.otro!;
    fireEvent.click(otro);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin publicar' }));
    await waitFor(() => expect(onGuardado).toHaveBeenCalledTimes(1));
    expect(h.upsertOpcion).toHaveBeenCalledWith(campo, `Nuevo ${campo}`, 'uid-de-prueba');
  });

  it('y si no la pudo dar de alta, guardó igual y lo avisa sin cerrar', async () => {
    h.upsertOpcion.mockRejectedValue(new Error('x'));
    const { onGuardado } = montar();
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-otro]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin publicar' }));
    const avisos = await screen.findAllByRole('status');
    expect(avisos.some((a) => caso.avisoDeEtiqueta.test(a.textContent ?? ''))).toBe(true);
    expect(h.crear).toHaveBeenCalledTimes(1);
    expect(onGuardado).not.toHaveBeenCalled();
  });

  it('«Cancelar» no escribe', () => {
    const { onCancelar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(h.crear).not.toHaveBeenCalled();
  });
});
