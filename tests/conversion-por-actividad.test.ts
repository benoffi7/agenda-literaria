import { describe, expect, it } from 'vitest';
import {
  MINIMO_PARA_COMPARAR,
  PISO_DE_VISTAS,
  comparacionDeConversion,
  pedidosGa4,
} from '../functions/analitica.js';
import { leerResumenDelSitio } from '@/lib/resumenDelSitio';

/**
 * Roadmap 3.2 — «qué actividades se miran y no generan mensajes»: vistas contra
 * clics en inscribirse, **comparado entre actividades** y con un piso de vistas
 * debajo del cual no se opina (fricción 8 del §4 del diseño).
 */
const respuesta = (filas: [string, string, number][]) => ({
  rows: filas.map(([ruta, evento, n]) => ({
    dimensionValues: [{ value: ruta }, { value: evento }],
    metricValues: [{ value: String(n) }],
  })),
});

const PISO = PISO_DE_VISTAS;

describe('comparacionDeConversion', () => {
  it('ordena de menor a mayor tasa, contra la mediana de las que pasan el piso', () => {
    const c = comparacionDeConversion(
      respuesta([
        ['/actividad/a/', 'page_view', 100],
        ['/actividad/a/', 'clic_inscripcion', 1],
        ['/actividad/b/', 'page_view', PISO + 20],
        ['/actividad/b/', 'clic_inscripcion', 10],
        ['/actividad/c/', 'page_view', PISO + 10],
        ['/actividad/c/', 'clic_inscripcion', 4],
      ]),
    );
    expect(c.filas.map((f: { slug: string }) => f.slug)).toEqual(['a', 'c', 'b']);
    expect(c.mediana).toBeCloseTo(4 / (PISO + 10));
    expect(c.comparables).toBe(3);
  });

  it('debajo del piso no se opina: no entra a la comparación', () => {
    // Mutación: sacar el filtro del piso mete a «d», con 5 vistas y 0 clics, primera.
    const c = comparacionDeConversion(
      respuesta([
        ['/actividad/a/', 'page_view', PISO],
        ['/actividad/b/', 'page_view', PISO],
        ['/actividad/c/', 'page_view', PISO],
        ['/actividad/d/', 'page_view', 5],
      ]),
    );
    expect(c.filas.map((f: { slug: string }) => f.slug)).not.toContain('d');
  });

  it(`con menos de ${MINIMO_PARA_COMPARAR} sobre el piso no hay comparación, y dice cuántas hay`, () => {
    const c = comparacionDeConversion(
      respuesta([
        ['/actividad/a/', 'page_view', 100],
        ['/actividad/b/', 'page_view', 100],
        ['/actividad/c/', 'page_view', 5],
      ]),
    );
    expect(c).toEqual({ piso: PISO, comparables: 2, mediana: null, filas: [] });
  });

  it('una ruta que no es una actividad no entra', () => {
    const c = comparacionDeConversion(
      respuesta([
        ['/actividad/a/', 'page_view', 100],
        ['/actividad/b/', 'page_view', 100],
        ['/actividad/c/', 'page_view', 100],
        ['/actividad/Raro?x=1', 'page_view', 500],
        ['/actividad/a/foto/', 'page_view', 500],
        ['/cartelera/', 'page_view', 500],
      ]),
    );
    expect(c.filas.map((f: { slug: string }) => f.slug).sort()).toEqual(['a', 'b', 'c']);
  });

  it('el pedido trae solo las páginas de detalle y los dos eventos que se comparan', () => {
    const p = pedidosGa4({ desde: '2026-09-01', hasta: '2026-09-28' }).conversion;
    const [eventos, rutas] = p.dimensionFilter.andGroup.expressions;
    expect(eventos.filter.inListFilter?.values).toEqual(['page_view', 'clic_inscripcion']);
    expect(rutas.filter.stringFilter).toEqual({ matchType: 'BEGINS_WITH', value: '/actividad/' });
  });
});

describe('el panel lee la comparación', () => {
  it('un documento de antes de 3.2 da «sin comparación», no un error', () => {
    const r = leerResumenDelSitio({ ga4: { estado: 'ok', hayDatos: true } });
    expect(r.ga4.conversion.mediana).toBeNull();
    expect(r.ga4.conversion.filas).toEqual([]);
  });

  it('lo que llega se lee campo por campo', () => {
    const r = leerResumenDelSitio({
      ga4: {
        estado: 'ok',
        hayDatos: true,
        conversion: {
          piso: 30,
          comparables: 3,
          mediana: 0.1,
          filas: [{ slug: 'a', vistas: 100, clics: 1, tasa: 0.01, extra: 'no' }],
        },
      },
    });
    expect(r.ga4.conversion.filas).toEqual([{ slug: 'a', vistas: 100, clics: 1, tasa: 0.01 }]);
  });
});
