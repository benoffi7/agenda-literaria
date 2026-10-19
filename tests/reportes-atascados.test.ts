/**
 * **Un reporte trabado en «enviando» tiene salida** — B-2205.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAZO_ENVIANDO_MS, reportesAtascados } from '../functions/reportes.js';

const AHORA = 1_800_000_000_000;
const hace = (ms: number) => ({ toMillis: () => AHORA - ms });

describe('reportesAtascados — B-2205', () => {
  it('toma los que llevan más del plazo en enviando y no tienen issue', () => {
    const ids = reportesAtascados(
      [
        { id: 'viejo', estado: 'enviando', github: null, actualizadoEn: hace(PLAZO_ENVIANDO_MS + 1) },
        { id: 'reciente', estado: 'enviando', github: null, actualizadoEn: hace(60_000) },
        // Ya tiene número: el issue existe, no hay nada que destrabar.
        { id: 'conIssue', estado: 'enviando', github: { numero: 12 }, actualizadoEn: hace(PLAZO_ENVIANDO_MS * 2) },
        { id: 'pendiente', estado: 'pendiente', github: null, actualizadoEn: hace(PLAZO_ENVIANDO_MS * 2) },
        // Sin fecha legible: no hay forma de saber que es reciente, así que se toma.
        { id: 'sinFecha', estado: 'enviando', github: null, actualizadoEn: null },
      ],
      AHORA,
    );
    expect(ids).toEqual(['viejo', 'sinFecha']);
  });

  it('se destraban a `error` y no a `pendiente`: reenviar podría duplicar el issue público', () => {
    const src = readFileSync('functions/frescura-trigger.js', 'utf8');
    const cuerpo = src.slice(src.indexOf('const destrabarReportes'), src.indexOf('export const verificarFrescuraDelSitio'));
    expect(cuerpo).toContain("estado: 'error'");
    expect(cuerpo).not.toContain("estado: 'pendiente'");
    // Y corre antes de cualquier corte temprano de la frescura.
    const handler = src.slice(src.indexOf('export const verificarFrescuraDelSitio'));
    expect(handler.indexOf('await destrabarReportes(db, ahora)')).toBeLessThan(handler.indexOf('return;'));
  });
});
