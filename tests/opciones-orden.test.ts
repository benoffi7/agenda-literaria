import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import base from '@/lib/opciones-base.json';
import { ordenarValores } from '@/lib/opciones';
import { formVacio } from '@/lib/formulario/estadoInicial';
import type { ValorOpcion } from '@/types/actividad';

const primera = (campo: keyof typeof base) =>
  ordenarValores(base[campo] as ValorOpcion[])[0];

/**
 * El bloque de un `<TaxonomiaSelect campo="X" …/>`, buscado en el formulario y
 * en sus secciones (B-79 las partió en archivos aparte). Devuelve `''` si el
 * campo no está en ninguno: sin ese caso explícito, mover el campo de archivo
 * dejaría los tests de abajo pasando sin haber leído nada.
 */
const bloqueDelCampo = (campo: string): string => {
  const archivos = [
    'src/components/admin/ActividadFormulario.tsx',
    ...readdirSync('src/components/admin/formulario')
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => `src/components/admin/formulario/${f}`),
  ];
  for (const archivo of archivos) {
    const src = readFileSync(archivo, 'utf8');
    const i = src.indexOf(`campo="${campo}"`);
    if (i === -1) continue;
    const resto = src.slice(i);
    return resto.slice(0, resto.indexOf('/>'));
  }
  return '';
};

/**
 * Qué opción muestra elegida cada desplegable. Estos tests la fijan: si alguien
 * reordena opciones-base.json, el default del formulario cambia sin que se
 * note, y una actividad puede terminar guardada con un arancel que nadie
 * eligió.
 */
describe('opción preseleccionada por campo', () => {
  it('el campo arancel sigue estando en el formulario', () => {
    expect(bloqueDelCampo('arancel')).not.toBe('');
  });

  it('arancel NO se preselecciona', () => {
    // Decisión del dueño: el default sería "Gratis" y un taller pago que nadie
    // corrige se publica como gratuito. El campo obliga a elegir.
    expect(bloqueDelCampo('arancel')).not.toContain('autoSeleccionarPrimera');
  });

  it('tipo arranca en taller, y el estado inicial trae esa misma opción', () => {
    // Desde B-87 la preselección de `tipo` no la hace un efecto del hijo sino
    // `formVacio()`, así que las dos derivaciones tienen que coincidir: si se
    // separan, el formulario muestra una opción y guarda otra.
    expect(primera('tipo')?.slug).toBe('taller');
    expect(formVacio().tipo).toBe(primera('tipo')?.slug);
  });

  it('plataforma arranca en zoom', () => {
    expect(primera('plataforma')?.slug).toBe('zoom');
  });

  it('barrio y tags no tienen nada que preseleccionar', () => {
    expect(base.barrio).toEqual([]);
    expect(base.tags).toEqual([]);
  });
});

describe('ordenarValores', () => {
  it('pone las fijas antes que las creadas con "Otro"', () => {
    const valores: ValorOpcion[] = [
      { slug: 'beca', label: 'Con beca', orden: 99, fijo: false, usos: 50 },
      { slug: 'gratis', label: 'Gratis', orden: 1, fijo: true, usos: 0 },
    ];
    expect(ordenarValores(valores).map((v) => v.slug)).toEqual(['gratis', 'beca']);
  });

  it('entre las fijas respeta `orden`, no el uso', () => {
    const valores: ValorOpcion[] = [
      { slug: 'c', label: 'C', orden: 3, fijo: true, usos: 99 },
      { slug: 'a', label: 'A', orden: 1, fijo: true, usos: 0 },
    ];
    expect(ordenarValores(valores).map((v) => v.slug)).toEqual(['a', 'c']);
  });

  it('entre las creadas con "Otro" ordena por uso descendente', () => {
    const valores: ValorOpcion[] = [
      { slug: 'poco', label: 'Poco', orden: 99, fijo: false, usos: 1 },
      { slug: 'mucho', label: 'Mucho', orden: 99, fijo: false, usos: 20 },
    ];
    expect(ordenarValores(valores).map((v) => v.slug)).toEqual(['mucho', 'poco']);
  });

  it('no muta el array que recibe', () => {
    const valores: ValorOpcion[] = [
      { slug: 'b', label: 'B', orden: 2, fijo: true, usos: 0 },
      { slug: 'a', label: 'A', orden: 1, fijo: true, usos: 0 },
    ];
    ordenarValores(valores);
    expect(valores[0]!.slug).toBe('b');
  });
});
