/**
 * **El índice en dos archivos** — B-2191, D-1276.
 *
 * Decisión del dueño del 2026-10-19: la home ofrece desde el mes pasado; lo
 * anterior va a `/pasadas.json`.
 */
import { describe, expect, it } from 'vitest';
import {
  esVigente,
  mesDeCorte,
  separarIndice,
  unirIndices,
  type EntradaDeIndice,
  type Indice,
} from '@/lib/eventsJson';

const entrada = (slug: string, fechas: [string, string][]): EntradaDeIndice =>
  ({
    slug,
    sesiones: fechas.map(([inicio, fin]) => ({ inicio, fin, cancelada: false })),
  }) as unknown as EntradaDeIndice;

const indice = (actividades: EntradaDeIndice[], generadoEn: string): Indice =>
  ({ generadoEn, version: '1', opciones: { tipo: [] }, actividades, encuentros: [{ x: 1 }] }) as unknown as Indice;

describe('el mes de corte — B-2191', () => {
  it('es el mes pasado en hora argentina', () => {
    expect(mesDeCorte('2026-10-19T15:00:00.000Z')).toBe('2026-09');
  });

  it('cruza el año en enero', () => {
    expect(mesDeCorte('2027-01-10T12:00:00.000Z')).toBe('2026-12');
  });

  it('usa la hora argentina y no UTC: el 1 a las 01:00 UTC todavía es el mes anterior acá', () => {
    // 2026-11-01T01:00Z son las 22:00 del 31 de octubre en Buenos Aires.
    expect(mesDeCorte('2026-11-01T01:00:00.000Z')).toBe('2026-09');
  });

  it('sin fecha legible no corta nada', () => {
    expect(mesDeCorte('')).toBe('');
    expect(esVigente(entrada('x', [['2020-01-01T10:00:00Z', '2020-01-01T12:00:00Z']]), '')).toBe(true);
  });
});

describe('qué queda en la home — B-2191', () => {
  const corte = '2026-09';

  it('lo que terminó antes del mes pasado se va; lo del mes pasado se queda', () => {
    expect(esVigente(entrada('agosto', [['2026-08-20T21:00:00Z', '2026-08-20T23:00:00Z']]), corte)).toBe(false);
    expect(esVigente(entrada('septiembre', [['2026-09-02T21:00:00Z', '2026-09-02T23:00:00Z']]), corte)).toBe(true);
  });

  it('un ciclo que arrancó antes y tiene un encuentro en el mes de corte queda entero', () => {
    const ciclo = entrada('ciclo', [
      ['2026-07-01T21:00:00Z', '2026-07-01T23:00:00Z'],
      ['2026-09-30T21:00:00Z', '2026-09-30T23:00:00Z'],
    ]);
    expect(esVigente(ciclo, corte)).toBe(true);
  });

  it('una entrada sin fechas queda: no hay de qué deducir que pasó', () => {
    expect(esVigente(entrada('sinFechas', []), corte)).toBe(true);
  });
});

describe('separar y unir — B-2191', () => {
  const todo = indice(
    [
      entrada('vieja', [['2026-06-01T21:00:00Z', '2026-06-01T23:00:00Z']]),
      entrada('nueva', [['2026-11-01T21:00:00Z', '2026-11-01T23:00:00Z']]),
    ],
    '2026-10-19T15:00:00.000Z',
  );

  it('cada entrada va a un solo archivo, y las dos llevan las opciones', () => {
    // Mutación probada: invertir el filtro del pasado pone esto rojo.
    const { vigente, pasado } = separarIndice(todo);
    expect(vigente.actividades.map((a) => a.slug)).toEqual(['nueva']);
    expect(pasado.actividades.map((a) => a.slug)).toEqual(['vieja']);
    expect(pasado.opciones).toEqual(todo.opciones);
    // El eje de encuentros es de lo que viene: solo en el vigente.
    expect(vigente.encuentros).toEqual(todo.encuentros);
    expect(pasado.encuentros).toEqual([]);
  });

  it('unidos son todo otra vez; si falta una mitad, queda la otra', () => {
    const { vigente, pasado } = separarIndice(todo);
    expect(unirIndices(vigente, pasado)!.actividades.map((a) => a.slug).sort()).toEqual(['nueva', 'vieja']);
    expect(unirIndices(vigente, null)).toBe(vigente);
    expect(unirIndices(null, pasado)).toBe(pasado);
  });
});
