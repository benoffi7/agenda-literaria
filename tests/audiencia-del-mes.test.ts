import { describe, expect, it } from 'vitest';
import { RUTA_DEL_PANEL, audienciaDelMes, mesCerrado, pedidoDelMes } from '../functions/analitica.js';
import { bloqueDeAudiencia } from '@/lib/comercialDelSitio';
import { audienciaProyectada } from '@/lib/contenidoDelSitio';

/**
 * Roadmap 3.3, B-771 — un número real para `/anunciar`: la audiencia del último
 * mes cerrado, que guarda la analítica diaria y lee el build.
 */
describe('mesCerrado', () => {
  it('el 1 de octubre, septiembre ya cerró (GA4 mide hasta ayer)', () => {
    expect(mesCerrado(new Date('2026-10-01T10:00:00Z'))).toEqual({
      clave: '2026-09',
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
  });

  it('con un retraso de dos días, el 1 de octubre todavía es agosto', () => {
    expect(mesCerrado(new Date('2026-10-01T10:00:00Z'), 2).clave).toBe('2026-08');
  });

  it('en enero, el diciembre del año anterior, con sus 31 días', () => {
    expect(mesCerrado(new Date('2027-01-05T10:00:00Z'))).toEqual({
      clave: '2026-12',
      desde: '2026-12-01',
      hasta: '2026-12-31',
    });
  });

  it('en la zona del proyecto: el 1 de octubre a las 00:30 de Buenos Aires sigue siendo 30', () => {
    // 03:30 UTC del 1 es 00:30 del 1 en Buenos Aires: ayer es el 30, cerró septiembre.
    expect(mesCerrado(new Date('2026-10-01T03:30:00Z')).clave).toBe('2026-09');
    // 02:30 UTC del 1 es 23:30 del 30: ayer es el 29, septiembre no cerró.
    expect(mesCerrado(new Date('2026-10-01T02:30:00Z')).clave).toBe('2026-08');
  });
});

describe('pedidoDelMes y audienciaDelMes', () => {
  it('el pedido no lleva dimensiones: un agregado del mes, sin contenido de nadie', () => {
    const p = pedidoDelMes(mesCerrado(new Date('2026-10-06T10:00:00Z')));
    expect(p).not.toHaveProperty('dimensions');
    expect(p.dateRanges).toEqual([{ startDate: '2026-09-01', endDate: '2026-09-30' }]);
  });

  it('el pedido del mes excluye el panel: lo que se mide sin consentimiento no llega a /anunciar (B-801)', () => {
    // Mutación: sacar el `dimensionFilter` pone esto en rojo.
    const p = pedidoDelMes(mesCerrado(new Date('2026-10-06T10:00:00Z')));
    expect(p.dimensionFilter.notExpression.filter).toEqual({
      fieldName: 'pagePath',
      stringFilter: { matchType: 'BEGINS_WITH', value: RUTA_DEL_PANEL },
    });
  });

  it('lee las dos métricas; sin filas no es cero, es nada', () => {
    const mes = { clave: '2026-09' };
    expect(audienciaDelMes({ rows: [{ metricValues: [{ value: '1234' }, { value: '5678' }] }] }, mes)).toEqual({
      mes: '2026-09',
      personas: 1234,
      vistas: 5678,
    });
    expect(audienciaDelMes({}, mes)).toBeNull();
  });
});

describe('audienciaProyectada — lo que el build deja pasar del documento', () => {
  it('solo mes, personas y vistas: un campo de más no sale', () => {
    expect(
      audienciaProyectada({ mes: '2026-09', personas: 10, vistas: 30, otro: 'secreto', actualizado: 'x' }),
    ).toEqual({ mes: '2026-09', personas: 10, vistas: 30 });
  });

  it('lo que no cierra es null, y la página no dice ningún número', () => {
    expect(audienciaProyectada(undefined)).toBeNull();
    expect(audienciaProyectada({ mes: 'septiembre', personas: 10, vistas: 30 })).toBeNull();
    expect(audienciaProyectada({ mes: '2026-09', personas: 0, vistas: 30 })).toBeNull();
    expect(audienciaProyectada({ mes: '2026-09', personas: 1.5, vistas: 30 })).toBeNull();
  });
});

describe('bloqueDeAudiencia — la frase de /anunciar', () => {
  it('dice el mes, «al menos» y que se actualiza, con el número formateado', () => {
    const b = bloqueDeAudiencia({ mes: '2026-09', personas: 1234, vistas: 5678 })!;
    expect(b.titulo).toBe('Cuánta gente lo ve');
    expect(b.texto).toContain('En septiembre de 2026');
    expect(b.texto).toContain('al menos 1.234 visitantes');
    expect(b.texto).toContain('5.678 páginas');
    expect(b.texto).toContain('Se actualiza cada mes');
  });

  it('sin dato no hay bloque: la página vuelve a no decir ningún tamaño', () => {
    expect(bloqueDeAudiencia(null)).toBeNull();
    expect(bloqueDeAudiencia({ mes: '2026-13', personas: 10, vistas: 1 })).toBeNull();
  });
});
