/**
 * **Los reportes resueltos se borran a los seis meses** — B-2213, decisión del
 * dueño del 2026-10-19.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RETENCION_REPORTE_RESUELTO_MS, reportesParaBorrar } from '../functions/reportes.js';

const AHORA = 1_800_000_000_000;
const hace = (ms: number) => ({ toMillis: () => AHORA - ms });

describe('qué reportes se borran — B-2213', () => {
  it('solo los resueltos hace más de seis meses', () => {
    // Mutación probada: sacar el filtro de `resuelto` pone esto rojo.
    const ids = reportesParaBorrar(
      [
        { id: 'viejoResuelto', resuelto: true, actualizadoEn: hace(RETENCION_REPORTE_RESUELTO_MS + 1) },
        { id: 'recienResuelto', resuelto: true, actualizadoEn: hace(RETENCION_REPORTE_RESUELTO_MS - 1) },
        { id: 'viejoAbierto', resuelto: false, actualizadoEn: hace(RETENCION_REPORTE_RESUELTO_MS * 3) },
        { id: 'sinMarca', actualizadoEn: hace(RETENCION_REPORTE_RESUELTO_MS * 3) },
        // Sin fecha legible no se borra: falla hacia guardar.
        { id: 'sinFecha', resuelto: true, actualizadoEn: null },
      ],
      AHORA,
    );
    expect(ids).toEqual(['viejoResuelto']);
  });

  it('son seis meses', () => {
    expect(RETENCION_REPORTE_RESUELTO_MS).toBe(180 * 24 * 60 * 60 * 1000);
  });

  it('el barrido diario de retención lo corre, y en su propio try', () => {
    const src = readFileSync('functions/retencion-trigger.js', 'utf8');
    expect(src).toContain('await barrerReportesResueltos(db);');
    const fn = src.slice(src.indexOf('const barrerReportesResueltos'), src.indexOf('export const borrarPropuestasVencidas'));
    expect(fn).toContain("where('resuelto', '==', true)");
    expect(fn).toMatch(/catch \(e\)[\s\S]*alerta: 'barrido-fallo'/);
  });
});
