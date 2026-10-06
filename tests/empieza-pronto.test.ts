import { describe, expect, it } from 'vitest';
import { estadoDe } from '@/lib/listadoPublico';
import { empiezaPronto } from '@/lib/tarjetaPublica';
import { entradaDePrueba } from './fixtures/indice';

/**
 * Roadmap 1.6 — «Empieza el jueves» en la tarjeta: un ciclo que todavía no
 * arrancó, con la inscripción abierta, cuyo primer encuentro cae esta semana.
 */
// Martes 6 de octubre de 2026, 15:00 en Buenos Aires.
const AHORA = new Date('2026-10-06T18:00:00Z');

const ciclo = (fechas: string[], extra: Parameters<typeof entradaDePrueba>[0] = {}) =>
  entradaDePrueba({ fechas, ...extra });

const decir = (e: ReturnType<typeof entradaDePrueba>) => empiezaPronto(e, estadoDe(e, AHORA), AHORA);

describe('empiezaPronto', () => {
  it('el jueves de esta semana', () => {
    expect(decir(ciclo(['2026-10-08T22:00:00Z', '2026-10-15T22:00:00Z']))).toBe('Empieza el jueves');
  });

  it('hoy y mañana, por su nombre', () => {
    expect(decir(ciclo(['2026-10-06T22:00:00Z', '2026-10-13T22:00:00Z']))).toBe('Empieza hoy');
    expect(decir(ciclo(['2026-10-07T22:00:00Z', '2026-10-14T22:00:00Z']))).toBe('Empieza mañana');
  });

  it('el día se cuenta en Buenos Aires: las 23:30 del miércoles son el miércoles', () => {
    // 02:30 UTC del jueves = 23:30 del miércoles en Buenos Aires: «mañana», no «el jueves».
    expect(decir(ciclo(['2026-10-08T02:30:00Z', '2026-10-15T02:30:00Z']))).toBe('Empieza mañana');
  });

  it('más de una semana adelante, nada', () => {
    expect(decir(ciclo(['2026-10-14T22:00:00Z', '2026-10-21T22:00:00Z']))).toBeNull();
  });

  it('un evento de una sola fecha no: el bloque de fecha ya lo dice', () => {
    expect(decir(ciclo(['2026-10-08T22:00:00Z']))).toBeNull();
  });

  it('si ya empezó, no (tiene su propia línea)', () => {
    expect(decir(ciclo(['2026-10-01T22:00:00Z', '2026-10-08T22:00:00Z']))).toBeNull();
  });

  it('sin inscripción o con el cupo completo, no: no hay a quién escribirle', () => {
    expect(decir(ciclo(['2026-10-08T22:00:00Z', '2026-10-15T22:00:00Z'], { requiereInscripcion: false }))).toBeNull();
    expect(decir(ciclo(['2026-10-08T22:00:00Z', '2026-10-15T22:00:00Z'], { completo: true }))).toBeNull();
  });
});
