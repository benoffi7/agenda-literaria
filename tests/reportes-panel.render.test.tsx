/**
 * `ReportesPanel` renderizado de verdad — B-580.
 *
 * **Por qué este componente necesita DOM.** El pedido del dueño era muy
 * puntual: la pantalla tiene que dejar de mostrar TODOS los reportes que se
 * cargaron alguna vez y reflejar solo los abiertos. Eso es cableado de
 * pantalla —el filtro sobre `reportes`, qué botón aparece con qué texto según
 * `resuelto`, qué pasa cuando se tilda «Ver resueltos»— y ninguna de esas
 * piezas tiene lógica pura propia que testear sin React (a diferencia de,
 * por ejemplo, `reporte-schema.ts`). La misma lección de
 * `menu-acciones.render.test.tsx` (B-202): un test que solo mira el fuente no
 * detecta un filtro invertido.
 *
 * `observarReportes`, `reintentarReporte` y `marcarResuelto` van mockeados —son
 * I/O contra Firestore—. `@/lib/actividades` (que usa `ReporteFormulario` para
 * la lista de "actividad referida") y `@/lib/analytics` (que arrastra
 * `Seccion`, y por ahí `firebase-client`) van mockeados por lo mismo que en
 * `historial-actividad.render.test.tsx`: nada que este archivo necesite
 * ejercitar.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReporteConId } from '@/types/reporte';

vi.mock('@/lib/analytics', () => ({
  medirSeccion: vi.fn(),
}));

vi.mock('@/lib/actividades', () => ({
  listarActividades: vi.fn(),
}));

vi.mock('@/lib/reportes', () => ({
  observarReportes: vi.fn(),
  reintentarReporte: vi.fn(),
  marcarResuelto: vi.fn(),
  contextoTecnico: vi.fn(() => ({
    versionPanel: '1.0.0',
    navegador: 'vitest',
    ventana: '390×844',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    url: '/admin',
    pantalla: 'listado',
  })),
  crearReporte: vi.fn(),
}));

import { listarActividades } from '@/lib/actividades';
import { ReportesPanel } from '@/components/admin/ReportesPanel';
import { marcarResuelto, observarReportes } from '@/lib/reportes';

beforeEach(() => {
  // `ReporteFormulario` pide la lista de actividades al montar, para el
  // desplegable de "actividad referida" — ninguno de estos tests la ejercita,
  // pero tiene que resolver algo para no dejar la promesa colgada.
  vi.mocked(listarActividades).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.mocked(observarReportes).mockReset();
  vi.mocked(marcarResuelto).mockReset();
  vi.mocked(listarActividades).mockReset();
});

const USUARIO = { uid: 'uid-admin', email: 'admin@test.com' };

const reporte = (over: Partial<ReporteConId> = {}): ReporteConId => ({
  id: 'r1',
  tipo: 'bug',
  titulo: 'No guarda el borrador',
  descripcion: 'Toco guardar y no pasa nada.',
  pasos: null,
  severidad: 'molesta',
  actividad: null,
  contexto: {
    versionPanel: '1.0.0',
    navegador: 'vitest',
    ventana: '390×844',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    url: '/admin',
    pantalla: 'listado',
  },
  reportadoPor: { uid: 'uid-admin', email: 'admin@test.com' },
  estado: 'creado',
  intentos: 1,
  github: { numero: 5, url: 'https://github.com/x/y/issues/5', creadoEn: { toDate: () => new Date() } as never },
  error: null,
  creadoEn: { toDate: () => new Date('2026-09-01T12:00:00-03:00') } as never,
  ...over,
});

/** Monta el panel entregando `rs` como si `observarReportes` los hubiera emitido. */
const montar = (rs: ReporteConId[]) => {
  vi.mocked(observarReportes).mockImplementation((cb) => {
    cb(rs);
    return () => {};
  });
  render(<ReportesPanel usuario={USUARIO} />);
};

describe('ReportesPanel — filtro por defecto: solo abiertos (B-580)', () => {
  it('un reporte resuelto no aparece de entrada', async () => {
    montar([reporte({ id: 'abierto', titulo: 'Abierto de verdad' }), reporte({ id: 'cerrado', titulo: 'Ya arreglado', resuelto: true })]);

    await screen.findByText('Abierto de verdad');
    // Control negativo: si el filtro estuviera invertido o ausente, esto
    // aparecería también.
    expect(screen.queryByText('Ya arreglado')).toBeNull();
  });

  it('un reporte sin el campo `resuelto` (los de antes de B-580) se sigue mostrando', async () => {
    // `resuelto` es opcional — ausente = abierto. Si el filtro comparara con
    // `=== false` en vez de negar el valor, un documento viejo sin el campo
    // (`undefined`) desaparecería de la lista por error.
    const { resuelto: _sinUsar, ...sinCampo } = reporte({ titulo: 'Reporte viejo' });
    montar([sinCampo as ReporteConId]);
    await screen.findByText('Reporte viejo');
  });

  it('con todo resuelto, la lista lo dice y no queda en blanco sin explicación', async () => {
    montar([reporte({ titulo: 'Ya arreglado', resuelto: true })]);
    await screen.findByText(/No hay reportes abiertos/);
    expect(screen.queryByText('Ya arreglado')).toBeNull();
  });

  it('«Ver resueltos» los vuelve a mostrar, sin ocultar los abiertos', async () => {
    montar([
      reporte({ id: 'abierto', titulo: 'Abierto de verdad' }),
      reporte({ id: 'cerrado', titulo: 'Ya arreglado', resuelto: true }),
    ]);
    await screen.findByText('Abierto de verdad');
    expect(screen.queryByText('Ya arreglado')).toBeNull();

    await userEvent.click(screen.getByRole('checkbox', { name: /ver resueltos/i }));

    await screen.findByText('Ya arreglado');
    expect(screen.getByText('Abierto de verdad')).not.toBeNull();
  });
});

describe('ReportesPanel — marcar resuelto saca la fila de la lista (B-580)', () => {
  it('tocar «Marcar resuelto» llama a marcarResuelto(id, true)', async () => {
    montar([reporte({ id: 'r1', titulo: 'Un bug cualquiera' })]);
    vi.mocked(marcarResuelto).mockResolvedValue(undefined);

    const fila = screen.getByText('Un bug cualquiera').closest('li')!;
    const boton = within(fila).getByRole('button', { name: 'Marcar resuelto' });
    await userEvent.click(boton);

    await waitFor(() => expect(marcarResuelto).toHaveBeenCalledWith('r1', true));
  });

  it('el botón dice «Reabrir» en un reporte ya resuelto (con «Ver resueltos» activo)', async () => {
    montar([reporte({ id: 'r1', titulo: 'Un bug cualquiera', resuelto: true })]);
    await userEvent.click(screen.getByRole('checkbox', { name: /ver resueltos/i }));

    const fila = await screen.findByText('Un bug cualquiera');
    const boton = within(fila.closest('li')!).getByRole('button', { name: 'Reabrir' });

    vi.mocked(marcarResuelto).mockResolvedValue(undefined);
    await userEvent.click(boton);
    await waitFor(() => expect(marcarResuelto).toHaveBeenCalledWith('r1', false));
  });

  it('CONTROL NEGATIVO — si `marcarResuelto` falla, la fila sigue en la lista y se ve el error', async () => {
    montar([reporte({ id: 'r1', titulo: 'Un bug cualquiera' })]);
    vi.mocked(marcarResuelto).mockRejectedValue(new Error('sin permiso'));

    const fila = screen.getByText('Un bug cualquiera').closest('li')!;
    await userEvent.click(within(fila).getByRole('button', { name: 'Marcar resuelto' }));

    await screen.findByText('sin permiso');
    // Como el mock no cambió `reportes` (nadie llamó al `cb` de vuelta), la
    // fila sigue ahí: el filtro depende del snapshot, no de un estado local
    // optimista que la pantalla no tiene.
    expect(screen.getByText('Un bug cualquiera')).not.toBeNull();
  });
});
