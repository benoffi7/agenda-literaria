import { describe, expect, it } from 'vitest';
import { mapaDeFicha } from '@/lib/detallePublico';

/**
 * El link al mapa en la ficha, debajo de «Dónde» — pedido del dueño el
 * 2026-09-29. Sale del mismo `sede.mapa` que «Ver en el mapa» de «Cómo se
 * cursa», y solo con un único lugar.
 */
type Modalidad = Parameters<typeof mapaDeFicha>[0][number];

const presencial = (direccion: string, mapa: string | null): Modalidad =>
  ({ sede: { direccion, mapa } }) as unknown as Modalidad;
const virtual = (): Modalidad => ({ sede: null }) as unknown as Modalidad;

const MAPA = 'https://www.google.com/maps/search/?api=1&query=Manuel%20Ugarte%202439';

describe('mapaDeFicha', () => {
  it('con un lugar, la dirección es el link al mapa', () => {
    expect(mapaDeFicha([presencial('Manuel Ugarte 2439', MAPA)])).toEqual({
      texto: 'Manuel Ugarte 2439',
      href: MAPA,
    });
  });

  it('sin dirección pero con coordenadas, dice «Ver en el mapa»', () => {
    expect(mapaDeFicha([presencial('  ', MAPA)])?.texto).toBe('Ver en el mapa');
  });

  it('una forma virtual al lado no cambia nada: sigue habiendo un solo lugar', () => {
    expect(mapaDeFicha([presencial('Manuel Ugarte 2439', MAPA), virtual()])?.href).toBe(MAPA);
  });

  it('con dos lugares distintos, nada: no se sabe a cuál lleva', () => {
    expect(mapaDeFicha([presencial('A 1', MAPA), presencial('B 2', `${MAPA}0`)])).toBeNull();
  });

  it('dos filas en el mismo lugar cuentan como uno', () => {
    expect(mapaDeFicha([presencial('A 1', MAPA), presencial('A 1', MAPA)])?.texto).toBe('A 1');
  });

  it('con dos sedes y solo una con mapa, nada: «Dónde» dice las dos', () => {
    expect(mapaDeFicha([presencial('A 1', MAPA), presencial('', null)])).toBeNull();
  });

  it('sin mapa, nada', () => {
    expect(mapaDeFicha([presencial('Manuel Ugarte 2439', null), virtual()])).toBeNull();
  });
});
