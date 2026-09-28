import { describe, expect, it } from 'vitest';
import {
  palabrasDelTitulo,
  parecidoDeTitulos,
  posiblesDuplicados,
} from '@/lib/formulario/duplicados';
import { aDatetimeLocal } from '@/lib/sesiones';
import type { SesionForm } from '@/types/actividad';

/**
 * Los posibles duplicados del formulario — roadmap 5.4. Es un aviso que no
 * frena, así que lo que se fija acá es sobre todo **qué no avisa**: un aviso que
 * salta todos los sábados se aprende a ignorar.
 */

// Las fechas del formulario son `datetime-local` en la hora **del navegador**, y
// el gate corre la suite también con `TZ=Asia/Tokyo`: por eso el fixture recibe
// un instante absoluto (ISO) y lo convierte como lo haría el formulario.
const sesion = (iso: string, cancelada = false) => ({
  id: `ses_${iso}`,
  inicio: aDatetimeLocal(new Date(iso)),
  // Dos horas y no cero: el detector de fixtures flojos de B-135.
  fin: aDatetimeLocal(new Date(new Date(iso).getTime() + 2 * 60 * 60 * 1000)),
  tema: '',
  lectura: '',
  cancelada,
});
const form = (titulo: string, inicios: string[], sede = '') => ({
  titulo,
  sesiones: inicios.map((i) => sesion(i)) as SesionForm[],
  modalidades: [{ sede: sede ? { nombre: sede } : null }] as never,
});
const publicada = (id: string, titulo: string, iniciosIso: string[], sede = 'Otra sede') => ({
  id,
  slug: id,
  titulo,
  sesiones: iniciosIso.map((inicio) => ({
    inicio,
    fin: new Date(new Date(inicio).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    cancelada: false,
  })),
  sede: { nombre: sede, provincia: 'caba', barrio: '', ciudad: 'caba' },
});

describe('parecidoDeTitulos', () => {
  it('saca las palabras que no distinguen nada en el circuito', () => {
    expect([...palabrasDelTitulo('Club de lectura: Basura, de Héctor Abad')].sort()).toEqual([
      'abad',
      'basura',
      'hector',
    ]);
  });

  it('el mismo libro con un título más largo se parece', () => {
    expect(parecidoDeTitulos('Basura', 'Club de lectura - Basura, de Héctor Abad')).toBe(1);
  });

  it('dos clubes de lectura de libros distintos no se parecen', () => {
    expect(parecidoDeTitulos('Club de lectura: Basura', 'Club de lectura: Rayuela')).toBe(0);
  });
});

describe('posiblesDuplicados', () => {
  it('avisa un título parecido el mismo día, aunque la hora sea otra', () => {
    const r = posiblesDuplicados(
      form('Taller de escritura: el comienzo de un relato', ['2026-10-12T19:00:00-03:00']),
      [publicada('a', 'El comienzo de un relato', ['2026-10-12T14:00:00Z'])],
      null,
    );
    expect(r).toEqual([{ id: 'a', slug: 'a', titulo: 'El comienzo de un relato', motivo: 'titulo', dia: '2026-10-12' }]);
  });

  it('avisa el mismo lugar a la misma hora aunque el título haya cambiado bastante', () => {
    // El caso real del 2026-09-28: dos palabras de seis en común, y la misma sede y hora.
    const r = posiblesDuplicados(
      form('"El Buen Mal" de Samanta Schweblin - Terror contemporáneo', ['2026-10-12T19:00:00-03:00'], 'Espacio Pont'),
      [publicada('b', 'Club de lectura: El buen mal - Espacio Pont', ['2026-10-12T22:30:00Z'], ' espacio pont ')],
      null,
    );
    expect(r.map((d) => d.motivo)).toEqual(['lugar-y-hora']);
  });

  it('NO avisa dos cosas distintas en el mismo lugar y a la misma hora: un centro cultural tiene salas', () => {
    const r = posiblesDuplicados(
      // El nombre del lugar está en los dos títulos, como en el catálogo real.
      form('Autoetnografía y ficción - La Libre', ['2026-10-12T19:00:00-03:00'], 'La Libre'),
      [publicada('b', 'Regalate la furia- La Libre', ['2026-10-12T22:00:00Z'], 'La Libre')],
      null,
    );
    expect(r).toEqual([]);
  });

  it('las fechas, los handles y «on line» escritos en el título no cuentan', () => {
    expect(
      parecidoDeTitulos('Taller de escritura creativa - On line - Martes', 'Club de lectura: "La cámara" ON LINE 6-10'),
    ).toBe(0);
    expect(parecidoDeTitulos('Club de lectura Septiembre - @librosofia_26', 'Taller para todas las edades - @librosofia_26')).toBe(0);
  });

  it('NO avisa otro día, ni el mismo lugar a otra hora, ni a sí misma', () => {
    const f = form('El comienzo de un relato', ['2026-10-12T19:00:00-03:00'], 'Casa Brandon');
    expect(posiblesDuplicados(f, [publicada('a', 'El comienzo de un relato', ['2026-10-13T22:00:00Z'])], null)).toEqual([]);
    expect(posiblesDuplicados(f, [publicada('b', 'Otra cosa', ['2026-10-12T15:00:00Z'], 'Casa Brandon')], null)).toEqual([]);
    expect(posiblesDuplicados(f, [publicada('yo', 'El comienzo de un relato', ['2026-10-12T22:00:00Z'])], 'yo')).toEqual([]);
  });

  it('el día es el de Buenos Aires y no el de UTC (trampa 1)', () => {
    // 11 de octubre a las 22:30 en Buenos Aires es el 12 en UTC.
    const r = posiblesDuplicados(
      form('El comienzo de un relato', ['2026-10-11T20:00:00-03:00']),
      [publicada('a', 'El comienzo de un relato', ['2026-10-12T01:30:00Z'])],
      null,
    );
    expect(r.map((d) => d.dia)).toEqual(['2026-10-11']);
  });

  it('no cuenta los encuentros cancelados, ni avisa sin fechas', () => {
    const cancelada = {
      ...form('El comienzo de un relato', []),
      sesiones: [sesion('2026-10-12T19:00:00-03:00', true)] as SesionForm[],
    };
    const otra = [publicada('a', 'El comienzo de un relato', ['2026-10-12T22:00:00Z'])];
    expect(posiblesDuplicados(cancelada, otra, null)).toEqual([]);
    expect(posiblesDuplicados(form('El comienzo de un relato', []), otra, null)).toEqual([]);
  });

  it('muestra como mucho tres', () => {
    const muchas = ['a', 'b', 'c', 'd'].map((id) => publicada(id, 'Basura', ['2026-10-12T22:00:00Z']));
    expect(posiblesDuplicados(form('Basura', ['2026-10-12T19:00:00-03:00']), muchas, null)).toHaveLength(3);
  });
});

describe('diaYMesDeDia — cómo dice el aviso el día', async () => {
  const { diaYMesDeDia } = await import('@/lib/fechasPublicas');
  it('sale de la clave con el ancla del módulo, sin correrse con la zona del navegador', () => {
    expect(diaYMesDeDia('2026-10-12')).toBe('12 de octubre');
  });
});
