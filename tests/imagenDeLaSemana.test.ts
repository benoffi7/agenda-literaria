import { describe, expect, it } from 'vitest';
import type { Boletin, EncuentroDelBoletin } from '@/lib/boletinSemanal';
import { FORMATOS, contenidoDeLaImagen, diaCorto, partirEnLineas } from '@/lib/imagenDeLaSemana';
import { DOMINIO } from '@/lib/rutasPublicas';

/**
 * Roadmap 4.3 — la imagen «Esta semana en la agenda». Lo que se fija acá es la
 * parte pura: qué entra, en qué orden, que diga cuántos faltan, y que ningún
 * título se salga de la imagen.
 */
const enc = (clave: string, dia: string, hora: string, titulo = `Título ${clave}`): EncuentroDelBoletin => ({
  clave,
  url: `https://x/${clave}`,
  hora,
  titulo,
  tipoEtiqueta: 'Taller',
  lugar: 'Casa · Boedo',
  arancel: '',
  dia,
});

const boletin = (destacadas: EncuentroDelBoletin[], resto: EncuentroDelBoletin[]): Boletin => ({
  asunto: '',
  preencabezado: '',
  destacadas,
  dias: [{ clave: 'x', rotulo: 'x', encuentros: resto }],
  total: destacadas.length + resto.length,
  desde: 'martes 6 de octubre',
  hasta: 'lunes 12 de octubre',
  urlDeLaAgenda: '',
});

describe('diaCorto', () => {
  it('el día de la semana y el número', () => {
    expect(diaCorto('2026-10-07')).toBe('MIÉ 7');
    expect(diaCorto('2026-10-11')).toBe('DOM 11');
  });
});

describe('contenidoDeLaImagen', () => {
  it('en orden de fecha y hora, con el rango y la dirección', () => {
    const c = contenidoDeLaImagen(
      boletin([enc('d', '2026-10-09', '18:00')], [enc('a', '2026-10-07', '19:00'), enc('b', '2026-10-07', '10:00')]),
      'feed',
    );
    expect(c.filas.map((f) => f.clave)).toEqual(['b', 'a', 'd']);
    expect(c.rango).toBe('Del martes 6 de octubre al lunes 12 de octubre');
    expect(c.pie).toBe(DOMINIO);
    expect(c.faltan).toBe(0);
  });

  it('si sobran, entran las destacadas aunque sean las últimas, y dice cuántos faltan', () => {
    const resto = Array.from({ length: 10 }, (_, i) => enc(`r${i}`, '2026-10-07', `1${i}:00`));
    const destacada = enc('dest', '2026-10-12', '20:00');
    const c = contenidoDeLaImagen(boletin([destacada], resto), 'feed');
    expect(c.filas).toHaveLength(FORMATOS.feed.maximo);
    expect(c.filas.map((f) => f.clave)).toContain('dest');
    expect(c.faltan).toBe(11 - FORMATOS.feed.maximo);
  });

  it('la historia lleva más que el feed', () => {
    const resto = Array.from({ length: 10 }, (_, i) => enc(`r${i}`, '2026-10-07', `1${i}:00`));
    expect(contenidoDeLaImagen(boletin([], resto), 'historia').filas).toHaveLength(FORMATOS.historia.maximo);
  });
});

describe('partirEnLineas', () => {
  // Un medidor de mentira: cada letra mide 10.
  const medir = (t: string) => t.length * 10;

  it('parte por palabras sin pasarse del ancho', () => {
    expect(partirEnLineas('Club de lectura de Saer', 120, medir, 3)).toEqual(['Club de', 'lectura de', 'Saer']);
  });

  it('con más líneas que el máximo, la última termina en «…» y entra', () => {
    const l = partirEnLineas('uno dos tres cuatro cinco seis', 100, medir, 2);
    expect(l).toHaveLength(2);
    expect(l[1]!.endsWith('…')).toBe(true);
    for (const x of l) expect(medir(x)).toBeLessThanOrEqual(100);
  });

  it('una palabra más ancha que la línea se corta: nada se sale de la imagen', () => {
    const [l] = partirEnLineas('Supercalifragilístico', 80, medir, 1);
    expect(medir(l!)).toBeLessThanOrEqual(80);
    expect(l!.endsWith('…')).toBe(true);
  });
});
