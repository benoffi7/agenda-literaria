import { describe, expect, it } from 'vitest';
import { avisoDelFormulario, organizadorDeRelleno } from '@/lib/organizadorDeRelleno';

/** B-2178 — lo que no es un organizador, con los casos reales de producción. */
describe('organizadorDeRelleno', () => {
  it.each([
    ['a conf', 'relleno'],
    ['A Confirmar', 'relleno'],
    ['buscando ', 'relleno'],
    ['lo estoy buscando', 'relleno'],
    ['@laraliteraria', 'cuenta'],
    ['Biblioteca Central UNMDP|', 'caracteres'],
  ])('«%s» es %s', (nombre, motivo) => {
    expect(organizadorDeRelleno(nombre)).toBe(motivo);
  });

  it('el barrio o la ciudad de su propia sede, como organizador', () => {
    expect(organizadorDeRelleno('Chivilcoy ', ['chivilcoy'])).toBe('lugar');
    expect(organizadorDeRelleno('Boedo', ['boedo', 'caba'])).toBe('lugar');
  });

  it('un nombre de verdad no, aunque contenga una palabra de la lista o un lugar', () => {
    expect(organizadorDeRelleno('Mandolina Libros')).toBeNull();
    expect(organizadorDeRelleno('Buscando lectores', [])).toBeNull();
    expect(organizadorDeRelleno('Boedo Libros', ['boedo'])).toBeNull();
    expect(organizadorDeRelleno('')).toBeNull();
  });
});

describe('avisoDelFormulario — el mismo aviso, en el momento de cargar', () => {
  it('cada motivo con su texto, que dice qué hacer', () => {
    expect(avisoDelFormulario('A conf')).toMatch(/«A conf» no es un organizador.*borrador/);
    expect(avisoDelFormulario('@laraliteraria')).toMatch(/Instagram del organizador/);
    expect(avisoDelFormulario('Boedo', ['boedo'])).toMatch(/barrio o la ciudad/);
    expect(avisoDelFormulario('Biblioteca|')).toMatch(/caracteres/);
  });

  it('un nombre de verdad, o vacío, no dice nada', () => {
    expect(avisoDelFormulario('Mandolina Libros')).toBeNull();
    expect(avisoDelFormulario('')).toBeNull();
  });
});
