import { describe, expect, it } from 'vitest';
import { nombreDeOrganizador, slugDeOrganizador } from '@/lib/organizador.mjs';
import { slugify } from '@/lib/slugify';

/**
 * El organizador como taxonomía — roadmap 1.5 (D-723 punto 8). El tramo A: el
 * slug y el nombre que se muestra, con el default de lectura de los documentos
 * que no tienen slug (D-26).
 */

describe('slugDeOrganizador', () => {
  it('un documento viejo sin slug lo deriva del nombre, con el slugify del §4.2', () => {
    // Es lo que evita migrar las actividades: el slug de una vieja y el de la
    // opción que la siembra salen de la misma función.
    expect(slugDeOrganizador({ nombre: 'Casa Brandon ' })).toBe('casa-brandon');
    expect(slugDeOrganizador({ nombre: 'casa brandon' })).toBe(slugify('Casa Brandon'));
  });

  it('el guardado manda sobre el nombre', () => {
    expect(slugDeOrganizador({ nombre: 'Otro nombre', slug: 'casa-brandon' })).toBe('casa-brandon');
  });

  it('sin organizador, vacío', () => {
    expect(slugDeOrganizador({ nombre: '' })).toBe('');
    expect(slugDeOrganizador(null)).toBe('');
  });
});

describe('nombreDeOrganizador', () => {
  const opciones: Record<string, string> = { 'casa-brandon': 'Casa Brandon' };
  const etiqueta = (slug: string) => opciones[slug];

  it('muestra la etiqueta de la opción: renombrarla cambia todas las páginas (§4.1)', () => {
    expect(nombreDeOrganizador({ nombre: 'casa brandon' }, etiqueta)).toBe('Casa Brandon');
  });

  it('sin opción, el nombre guardado', () => {
    expect(nombreDeOrganizador({ nombre: 'Mandolina Libros' }, etiqueta)).toBe('Mandolina Libros');
  });
});
