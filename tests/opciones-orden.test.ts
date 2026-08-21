import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import base from '@/lib/opciones-base.json';
import { ordenarValores } from '@/lib/opciones';
import type { ValorOpcion } from '@/types/actividad';

const primera = (campo: keyof typeof base) =>
  ordenarValores(base[campo] as ValorOpcion[])[0];

/**
 * `TaxonomiaSelect` con `autoSeleccionarPrimera` toma `valores[0]` después de
 * ordenar. Estos tests fijan cuál es esa opción: si alguien reordena
 * opciones-base.json, el default del formulario cambia sin que se note, y una
 * actividad puede terminar guardada con un arancel que nadie eligió.
 */
describe('opción preseleccionada por campo', () => {
  it('arancel NO se preselecciona', () => {
    // Decisión del dueño: el default sería "Gratis" y un taller pago que nadie
    // corrige se publica como gratuito. El campo obliga a elegir.
    const form = readFileSync('src/components/admin/ActividadFormulario.tsx', 'utf8');
    const bloqueArancel = form.slice(form.indexOf('campo="arancel"'));
    const hastaElCierre = bloqueArancel.slice(0, bloqueArancel.indexOf('/>'));
    expect(hastaElCierre).not.toContain('autoSeleccionarPrimera');
  });

  it('tipo arranca en taller', () => {
    expect(primera('tipo')?.slug).toBe('taller');
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
