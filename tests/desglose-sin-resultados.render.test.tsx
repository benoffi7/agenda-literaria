/**
 * El desglose de «Filtros que no encuentran nada», **dibujado** — B-798.
 *
 * `tests/analitica-del-sitio.test.ts` cubre la forma que arma la Function y
 * `tests/resumen-del-sitio.test.ts` que el lector la cruza. Lo que queda acá es
 * lo que solo existe con DOM: que la fila se despliegue, que cada eje salga con
 * su nombre en castellano y no con el técnico, y que un documento sin desglose
 * —uno de antes de B-798— no dibuje un desplegable vacío.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PanelSitioPublico } from '@/components/admin/estadisticas/PanelSitioPublico';
import { leerResumenDelSitio } from '@/lib/resumenDelSitio';

afterEach(cleanup);

const documento = (sinResultados?: unknown) =>
  leerResumenDelSitio({
    generadoEn: '2026-10-15T10:00:00.000Z',
    ga4: {
      estado: 'ok',
      hayDatos: true,
      ventana: { desde: '2026-09-17', hasta: '2026-10-14' },
      sesiones: { valor: 412, variacion: null },
      eventos: { filtro_sin_resultados: 12, clic_inscripcion: 3 },
      ...(sinResultados === undefined ? {} : { sinResultados }),
    },
    searchConsole: { estado: 'falla', motivo: 'x' },
  });

const filaDelEvento = () =>
  screen.getByText('Filtros que no encuentran nada').closest('li') as HTMLElement;

describe('el desglose de filtro_sin_resultados en el panel — B-798', () => {
  it('la fila se despliega con cada eje en castellano y sus slugs', () => {
    render(
      <PanelSitioPublico
        resumen={documento([
          { eje: null, slug: [], valor: 7 },
          { eje: 'arancel', slug: ['a-la-gorra'], valor: 3 },
          { eje: 'busqueda', slug: [], valor: 2 },
        ])}
      />,
    );
    const fila = filaDelEvento();
    expect(within(fila).getByText('Ver qué filtro fue')).toBeTruthy();
    expect(within(fila).getByText('Sin filtro identificado')).toBeTruthy();
    expect(within(fila).getByText('Arancel')).toBeTruthy();
    expect(within(fila).getByText('· a-la-gorra', { exact: false })).toBeTruthy();
    expect(within(fila).getByText('Texto del buscador')).toBeTruthy();
    // El nombre técnico del eje no se muestra cuando hay castellano.
    expect(within(fila).queryByText('busqueda')).toBeNull();
    // El total sigue en la fila, fuera del desplegable.
    expect(within(fila).getByText('12')).toBeTruthy();
  });

  it('sin desglose —un documento de antes de B-798— no hay desplegable', () => {
    render(<PanelSitioPublico resumen={documento()} />);
    expect(within(filaDelEvento()).queryByText('Ver qué filtro fue')).toBeNull();
  });
});
