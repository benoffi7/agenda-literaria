import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/slugify';

describe('slugify — §4.2, trampa 6', () => {
  it('colapsa las variantes de "a la gorra" en un solo slug', () => {
    const variantes = ['A la gorra', 'a la gorra ', 'A la Gorra', '  A LA GORRA  '];
    const slugs = new Set(variantes.map(slugify));
    expect(slugs).toEqual(new Set(['a-la-gorra']));
  });

  it('saca acentos', () => {
    expect(slugify('Presentación')).toBe('presentacion');
    expect(slugify('Poesía y crónica')).toBe('poesia-y-cronica');
    expect(slugify('Ñandú')).toBe('nandu');
  });

  it('no deja guiones colgando en las puntas', () => {
    expect(slugify('  ¡Taller!  ')).toBe('taller');
    expect(slugify('--taller--')).toBe('taller');
  });

  it('devuelve vacío si no queda nada usable', () => {
    expect(slugify('¡!¿?')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});
