import { describe, expect, it } from 'vitest';
import { buildSearchText, normalize } from '@/lib/normalize';

describe('normalize — §6', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(normalize('Crónica')).toBe('cronica');
    expect(normalize('BOEDO')).toBe('boedo');
  });

  it('deja que la búsqueda sin acento matchee el texto con acento', () => {
    expect(normalize('Taller de poesía').includes(normalize('poesia'))).toBe(true);
  });
});

describe('buildSearchText — §6', () => {
  it('junta título, descripción, sede, barrio, organizador y tallerista', () => {
    const texto = buildSearchText({
      titulo: 'Taller de Crónica',
      descripcion: 'Escritura de no ficción',
      sede: { nombre: 'Casa Brandon', barrio: 'Villa Crespo' },
      organizador: { nombre: 'Brandon' },
      tallerista: { nombre: 'María Moreno' },
    });
    expect(texto).toContain('cronica');
    expect(texto).toContain('villa crespo');
    expect(texto).toContain('maria moreno');
  });

  it('tolera los campos nulos sin dejar huecos', () => {
    const texto = buildSearchText({ titulo: 'Club', sede: null, tallerista: null });
    expect(texto).toBe('club');
  });
});
