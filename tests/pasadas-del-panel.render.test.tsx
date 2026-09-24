/**
 * Las pestañas «Vigentes» y «Pasadas» del listado, renderizadas — B-101.
 *
 * ── Qué mide esto que el test puro no ─────────────────────────────────────
 * El criterio y la partición son puros y viven en `tests/pasadas-del-panel.test.ts`.
 * Acá va el cableado: que la grilla arranque sin las pasadas, que la pestaña
 * las traiga, que cada una diga cuántas tiene **con la búsqueda puesta**, que
 * «Limpiar filtros» no mande de vuelta a «Vigentes», y que con el rol de
 * publicador las pestañas partan lo que la query le trajo y nada más.
 *
 * Las fechas son relativas a hoy (B-875): el componente toma su reloj de
 * `new Date()`, y una fecha cableada en el futuro es una bomba con fecha.
 *
 * Vive en `.render.test.tsx` porque `vitest.config.ts` monta jsdom solo para ese
 * patrón (`environmentMatchGlobs`).
 */
import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTROS_VACIOS, ORDEN_POR_DEFECTO, type Filtros } from '@/lib/filtrosActividades';
import type { ActividadConId } from '@/types/actividad';
import { tsDe } from './fixtures/tiempo';

vi.mock('@/lib/analytics', () => ({ medirFuncion: vi.fn() }));
vi.mock('@/lib/actividades', () => ({
  listarActividades: vi.fn(),
  documentoAForm: vi.fn(() => ({})),
  borrarActividad: vi.fn(async () => {}),
  marcarCupoCompleto: vi.fn(async () => {}),
}));
vi.mock('@/lib/usuarios', () => ({
  listarUsuarios: vi.fn(async () => []),
  mailesPorUid: () => new Map(),
}));
vi.mock('@/components/admin/useOpciones', () => ({
  useLabelsTaxonomia: () => ({ tipo: { taller: 'Taller' } }),
}));

import { listarActividades } from '@/lib/actividades';
import {
  ListaActividades,
  type Props as PropsDeLista,
} from '@/components/admin/ListaActividades';

const DIA = 24 * 60 * 60 * 1000;
const UID = 'uid_propio';

const sesionA = (dias: number) => {
  const inicio = new Date(Date.now() + dias * DIA);
  return {
    id: `ses_${dias}`,
    inicio: tsDe(inicio),
    fin: tsDe(new Date(inicio.getTime() + 2 * 60 * 60 * 1000)),
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
  };
};

const acto = (id: string, titulo: string, dias: number[], over: Partial<ActividadConId> = {}) =>
  ({
    id,
    tipo: 'taller',
    titulo,
    slug: id,
    estado: 'publicado',
    esCiclo: false,
    sesiones: dias.map(sesionA),
    modalidades: [],
    modalidad: 'presencial',
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    imagenes: [{ id: 'img_1', url: 'https://x/f.jpg', epigrafe: '', origen: 'externa', portada: true }],
    tags: [],
    searchText: titulo.toLowerCase(),
    createdBy: UID,
    updatedBy: UID,
    updatedAt: tsDe(new Date()),
    ...over,
  }) as unknown as ActividadConId;

const DE_MARZO = acto('marzo', 'Taller de marzo', [-180]);
const DE_JULIO = acto('julio', 'Club de julio', [-60, -53]);
const SE_VIENE = acto('viene', 'Taller que se viene', [7]);
const BORRADOR = acto('borrador', 'Borrador sin fechas', [], { estado: 'borrador' });

/** El estado de los filtros vive afuera (B-955): el wrapper hace de `AdminApp`. */
const ConFiltros = (
  p: Omit<PropsDeLista, 'filtros' | 'setFiltros' | 'orden' | 'setOrden'> & { inicial?: Filtros },
) => {
  const [filtros, setFiltros] = useState(p.inicial ?? FILTROS_VACIOS);
  const [orden, setOrden] = useState(ORDEN_POR_DEFECTO);
  return (
    <ListaActividades
      {...p}
      filtros={filtros}
      setFiltros={setFiltros}
      orden={orden}
      setOrden={setOrden}
    />
  );
};

const props = {
  onEditar: vi.fn(),
  onNueva: vi.fn(),
  onDuplicar: vi.fn(),
  onHistorial: vi.fn(),
  version: 0,
  uid: UID,
};

beforeEach(() => {
  vi.mocked(listarActividades).mockResolvedValue([DE_MARZO, SE_VIENE, DE_JULIO, BORRADOR]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const montar = async (extra: Partial<Parameters<typeof ConFiltros>[0]> = {}) => {
  render(<ConFiltros {...props} rol="admin" {...extra} />);
  await screen.findAllByText(/Taller que se viene|Taller de marzo|Borrador sin fechas/);
  return screen.getByRole('group', { name: 'Qué actividades ver' });
};

const titulosEnLaGrilla = (): string[] =>
  within(screen.getAllByRole('list').at(-1)!)
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('p.font-serif')?.textContent ?? '');

const pestana = (grupo: HTMLElement, nombre: RegExp) => within(grupo).getByRole('button', { name: nombre });

describe('las pestañas del listado — B-101', () => {
  it('arranca en «Vigentes», sin las que ya pasaron, y el borrador sin fechas se queda', async () => {
    const grupo = await montar();
    expect(pestana(grupo, /^Vigentes/).getAttribute('aria-pressed')).toBe('true');
    expect(pestana(grupo, /^Pasadas/).getAttribute('aria-pressed')).toBe('false');
    expect(titulosEnLaGrilla().sort()).toEqual(['Borrador sin fechas', 'Taller que se viene']);
  });

  it('cada pestaña dice cuántas tiene', async () => {
    const grupo = await montar();
    expect(pestana(grupo, /^Vigentes/).textContent).toContain('2');
    expect(pestana(grupo, /^Pasadas/).textContent).toContain('2');
  });

  it('«Pasadas» trae las que pasaron, la última primero, y nada más', async () => {
    const grupo = await montar();
    await userEvent.click(pestana(grupo, /^Pasadas/));
    expect(pestana(grupo, /^Pasadas/).getAttribute('aria-pressed')).toBe('true');
    expect(titulosEnLaGrilla()).toEqual(['Club de julio', 'Taller de marzo']);
    // El desplegable de orden no promete «lo que se viene» en el archivo.
    expect(screen.getByRole('option', { name: 'Lo último que pasó primero' })).not.toBeNull();
  });

  it('una pasada conserva su estado y sus acciones: no se archivó nada', async () => {
    const grupo = await montar();
    await userEvent.click(pestana(grupo, /^Pasadas/));
    const tarjeta = screen.getByText('Taller de marzo').closest('li') as HTMLElement;
    expect(within(tarjeta).getByText('Publicado')).not.toBeNull();
    expect(within(tarjeta).getByRole('button', { name: 'Editar' })).not.toBeNull();
  });

  it('la búsqueda que no encuentra nada en «Vigentes» avisa que en «Pasadas» sí', async () => {
    const grupo = await montar();
    await userEvent.type(screen.getByPlaceholderText('Buscar…'), 'marzo');
    expect(titulosEnLaGrilla()).toEqual([]);
    expect(screen.getByText(/En «Pasadas» hay una\./)).not.toBeNull();
    expect(pestana(grupo, /^Vigentes/).textContent).toContain('0');
    expect(pestana(grupo, /^Pasadas/).textContent).toContain('1');
  });

  it('«Limpiar filtros» no manda de vuelta a «Vigentes»', async () => {
    const grupo = await montar({
      inicial: { ...FILTROS_VACIOS, pestana: 'pasadas', estado: 'publicado' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(pestana(grupo, /^Pasadas/).getAttribute('aria-pressed')).toBe('true');
    expect(titulosEnLaGrilla()).toEqual(['Club de julio', 'Taller de marzo']);
  });

  it('con todo en el pasado, «Vigentes» dice dónde está lo cargado', async () => {
    vi.mocked(listarActividades).mockResolvedValue([DE_MARZO]);
    render(<ConFiltros {...props} rol="admin" />);
    expect(await screen.findByText(/todo lo cargado ya pasó y está en «Pasadas»/)).not.toBeNull();
  });
});

describe('el publicador — B-888, B-919', () => {
  it('las pestañas parten lo que la query le trajo: la ajena de su ciudad es de solo lectura en las dos', async () => {
    const AJENA_PASADA = acto('ajena', 'Charla ajena de junio', [-90], { createdBy: 'otra' });
    vi.mocked(listarActividades).mockResolvedValue([DE_MARZO, SE_VIENE, AJENA_PASADA]);
    const grupo = await montar({ rol: 'publicador', ciudad: 'caba' });

    expect(titulosEnLaGrilla()).toEqual(['Taller que se viene']);
    await userEvent.click(pestana(grupo, /^Pasadas/));
    expect(titulosEnLaGrilla().sort()).toEqual(['Charla ajena de junio', 'Taller de marzo']);

    const ajena = screen.getByText('Charla ajena de junio').closest('li') as HTMLElement;
    expect(within(ajena).getByText('Solo lectura')).not.toBeNull();
    expect(within(ajena).getByRole('button', { name: 'Ver' })).not.toBeNull();
    // Una sola query, la de siempre: la pestaña no pide nada nuevo.
    expect(vi.mocked(listarActividades)).toHaveBeenCalledTimes(1);
  });
});
