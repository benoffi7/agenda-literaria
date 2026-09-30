import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildSearchText } from '../functions/busqueda.js';
import {
  cambiosDe,
  cambiosPorActividad,
  etiquetasDeDestinos,
  planDeUnion,
  problemasDeLaTabla,
  tablaConfirmada,
} from '../scripts/unir-organizadores-decision.mjs';

/**
 * B-2178 — lo que decide `unir-organizadores.mjs`: si la tabla del dueño se puede
 * usar, con qué nombre queda cada destino y qué campos se le escriben a cada
 * actividad. El I/O no se prueba acá (se conecta a Firestore al importarlo).
 */
const act = (nombre: string, extra: Record<string, unknown> = {}) => ({
  titulo: 'Club',
  descripcion: '',
  estado: 'publicado',
  organizador: { nombre, instagram: '@casa', web: 'https://casa.com' },
  ...extra,
});

describe('problemasDeLaTabla', () => {
  it('una tabla bien formada no tiene problemas', () => {
    expect(problemasDeLaTabla({ unir: { hormiga: 'hormiga-libros', 'museo-ceibo': 'ceibo' } })).toEqual([]);
  });

  it('frena una cadena: un destino que a su vez es origen', () => {
    // Mutación probada: sin el chequeo de `origenes.has(destino)` queda en verde con la cadena.
    const p = problemasDeLaTabla({ unir: { a: 'b', b: 'c' } });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('«a» → «c» directo');
  });

  it('frena un origen igual a su destino', () => {
    expect(problemasDeLaTabla({ unir: { tilo: 'tilo' } })).toEqual(['«tilo» se une consigo mismo']);
  });

  it('frena slugs que no son slugify de sí mismos, de los dos lados', () => {
    const p = problemasDeLaTabla({ unir: { Hormiga: 'hormiga-libros', zafiro: 'Zafiro Librería', x: '' } });
    expect(p.some((l) => l.includes('origen «Hormiga»') && l.includes('«hormiga»'))).toBe(true);
    expect(p.some((l) => l.includes('destino «Zafiro Librería»') && l.includes('«zafiro-libreria»'))).toBe(true);
    // `''` es `slugify('')`: sin la exigencia de no vacío pasaría.
    expect(p.some((l) => l.includes('destino «»'))).toBe(true);
  });

  it('frena una tabla que se contradice, y una sin `unir`', () => {
    expect(problemasDeLaTabla({ unir: { 'tilo-ceiba': 'tilo' }, noSeUnen: { 'tilo-ceiba': 'conjunta' } })).toEqual([
      '«tilo-ceiba» está en `unir` y en `noSeUnen`',
    ]);
    expect(problemasDeLaTabla({})).toHaveLength(1);
    expect(problemasDeLaTabla({ unir: [] })).toHaveLength(1);
  });

  it('el ejemplo del repo es válido y se entrega sin confirmar', () => {
    // La tabla real es `.local.json` y git la ignora: se arma con nombres de
    // borradores y el repo es público (auditor-privacidad, B-2178).
    const tabla = JSON.parse(readFileSync('scripts/datos/organizadores-a-unir.ejemplo.json', 'utf8'));
    expect(problemasDeLaTabla(tabla)).toEqual([]);
    // Es una propuesta: el que la confirma es el dueño, no un commit.
    expect(tablaConfirmada(tabla)).toBe(false);
  });
});

describe('tablaConfirmada', () => {
  it('solo `true` confirma', () => {
    expect(tablaConfirmada({ confirmada: true })).toBe(true);
    expect(tablaConfirmada({ confirmada: 'true' })).toBe(false);
    expect(tablaConfirmada({})).toBe(false);
  });
});

describe('etiquetasDeDestinos', () => {
  const unir = { hormiga: 'hormiga-libros' };

  it('prefiere la etiqueta de /opciones/organizador', () => {
    const e = etiquetasDeDestinos(unir, [{ slug: 'hormiga-libros', label: 'Hormiga Libros (Palermo)' }], [
      act('hormiga libros'),
    ]);
    expect(e.get('hormiga-libros')).toBe('Hormiga Libros (Palermo)');
  });

  it('si no está en la lista, la variante más escrita entre las actividades del destino', () => {
    const e = etiquetasDeDestinos(unir, [], [
      act('hormiga libros'),
      act('Hormiga Libros'),
      act('Hormiga Libros'),
      act('Hormiga'),
    ]);
    expect(e.get('hormiga-libros')).toBe('Hormiga Libros');
  });

  it('un destino que nadie usa y no está en la lista no tiene etiqueta', () => {
    expect(etiquetasDeDestinos(unir, [], [act('Hormiga')]).has('hormiga-libros')).toBe(false);
  });
});

describe('cambiosDe', () => {
  const unir = { hormiga: 'hormiga-libros' };
  const etiquetas = new Map([['hormiga-libros', 'Hormiga Libros']]);

  it('escribe nombre, slug y searchText, y nada del resto del organizador', () => {
    const a = act('Hormiga', { titulo: 'Poesía' });
    const c = cambiosDe(a, unir, etiquetas);
    expect(c?.origen).toBe('hormiga');
    expect(c?.destino).toBe('hormiga-libros');
    expect(Object.keys(c!.cambios).sort()).toEqual(['organizador.nombre', 'organizador.slug', 'searchText']);
    expect(c!.cambios['organizador.nombre']).toBe('Hormiga Libros');
    expect(c!.cambios['organizador.slug']).toBe('hormiga-libros');
    // El searchText es el que el servidor esperaría (B-2050), con el nombre nuevo.
    expect(c!.cambios.searchText).toBe(
      buildSearchText({ ...a, organizador: { ...a.organizador, nombre: 'Hormiga Libros' } }),
    );
    expect(c!.cambios.searchText).toContain('hormiga libros');
  });

  it('reconoce el origen por el slug guardado antes que por el nombre (D-26)', () => {
    const a = act('Otro nombre', { organizador: { nombre: 'Otro nombre', slug: 'hormiga' } });
    expect(cambiosDe(a, unir, etiquetas)?.destino).toBe('hormiga-libros');
  });

  it('no toca lo que no es origen, ni al destino, ni a quien no tiene organizador', () => {
    expect(cambiosDe(act('Hormiga Libros'), unir, etiquetas)).toBeNull();
    expect(cambiosDe(act('Casa Brandon'), unir, etiquetas)).toBeNull();
    expect(cambiosDe({ titulo: 'x' }, unir, etiquetas)).toBeNull();
  });

  it('es idempotente: lo ya escrito no vuelve a cambiar', () => {
    const a = act('Hormiga');
    const c = cambiosDe(a, unir, etiquetas)!;
    const despues = {
      ...a,
      organizador: { ...a.organizador, nombre: c.cambios['organizador.nombre'], slug: c.cambios['organizador.slug'] },
    };
    expect(cambiosDe(despues, unir, etiquetas)).toBeNull();
  });

  it('sin etiqueta del destino no escribe', () => {
    expect(cambiosDe(act('Hormiga'), unir, new Map())).toBeNull();
  });
});

describe('planDeUnion', () => {
  const tabla = {
    unir: { hormiga: 'hormiga-libros', 'museo-ceibo': 'ceibo', 'fantasma-libros': 'ceibo' },
    noSeUnen: { 'tilo-ceiba': 'conjunta' },
    porCompletar: { 'faro-norte': 'faltan nombres' },
  };
  const actividades = [
    act('Hormiga'),
    act('hormiga '),
    act('Hormiga Libros'),
    act('Museo Ceibo', { estado: 'borrador' }),
    act('Ceibo'),
    act('Tilo - Ceiba'),
    act('Faro Norte Libros - Palermo'),
    act('Faro Norte'),
    act('Hormiga Libros - Sucursal'),
    act('Faro Norteado'),
    act('constructor'),
  ].map((data, i) => ({ id: `a${i}`, data }));

  const plan = planDeUnion(tabla, actividades, [{ slug: 'hormiga', label: 'Hormiga' }]);

  it('cuenta por grupo y por origen cuántas actividades cambian', () => {
    expect([...plan.grupos.get('hormiga-libros')!.porOrigen]).toEqual([['hormiga', 2]]);
    expect([...plan.grupos.get('ceibo')!.porOrigen]).toEqual([
      ['museo-ceibo', 1],
      ['fantasma-libros', 0],
    ]);
    expect(plan.aEscribir.map((f) => f.id)).toEqual(['a0', 'a1', 'a3']);
  });

  it('nombra los orígenes que ninguna actividad usa', () => {
    // Un organizador llamado «constructor» no es un origen: `hasOwn` y no `in` (mutación probada: con `in` el plan tira).
    expect(plan.origenesSinUso).toEqual(['fantasma-libros']);
    expect(plan.destinosSinUso).toEqual([]);
    expect(plan.destinosSinEtiqueta).toEqual([]);
  });

  it('avisa qué orígenes siguen como opción de la lista', () => {
    expect(plan.origenesEnLaLista).toEqual(['hormiga']);
  });

  it('lista los parecidos sin unirlos, por palabras enteras y sin lo que la tabla ya nombra', () => {
    expect(plan.parecidos.get('hormiga-libros')).toEqual(['hormiga-libros-sucursal']);
    // «faro-norteado» no es «faro-norte» (mutación probada: con un `includes` suelto entra); «tilo-ceiba» está en noSeUnen y no se repite.
    expect(plan.parecidos.get('faro-norte')).toEqual(['faro-norte-libros-palermo']);
    expect(plan.parecidos.get('ceibo')).toBeUndefined();
  });
});

describe('porActividad — el organizador de una actividad puntual (el relleno)', () => {
  /*
   * «A conf» son varias actividades de casas distintas: `unir` (por organizador)
   * no alcanza. La tabla dice el **nombre** por actividad, y se resuelve contra
   * la lista como en el formulario.
   */
  const opciones = [
    { slug: 'hormiga-libros', label: 'Hormiga Libros' },
    { slug: 'tilo', label: 'Fundación Tilo' }, // renombrada: el slug no cambió
  ];

  it('reusa la opción que ya existe, aunque se escriba distinto', () => {
    const c = cambiosPorActividad(act('a conf', { slug: 'club-1' }), { 'club-1': 'hormiga libros' }, opciones);
    expect(c).toMatchObject({ origen: 'a-conf', destino: 'hormiga-libros', nueva: false });
    expect(c!.cambios['organizador.nombre']).toBe('Hormiga Libros');
  });

  it('reconoce una opción renombrada por su etiqueta', () => {
    const c = cambiosPorActividad(act('a conf', { slug: 'club-1' }), { 'club-1': 'Fundación Tilo' }, opciones);
    expect(c?.destino).toBe('tilo');
  });

  it('un nombre que no está en la lista queda como se escribió, marcado nuevo', () => {
    const c = cambiosPorActividad(act('a conf', { slug: 'club-1' }), { 'club-1': 'Casa Nueva' }, opciones);
    expect(c).toMatchObject({ destino: 'casa-nueva', nueva: true });
    expect(c!.cambios.searchText).toContain('casa nueva');
  });

  it('si ya está así, no hay nada que escribir (idempotente)', () => {
    const a = act('Hormiga Libros', { slug: 'club-1', organizador: { nombre: 'Hormiga Libros', slug: 'hormiga-libros' } });
    expect(cambiosPorActividad(a, { 'club-1': 'Hormiga Libros' }, opciones)).toBeNull();
  });

  it('manda sobre `unir`, y avisa de las actividades que no existen', () => {
    const plan = planDeUnion(
      { unir: { 'a-conf': 'hormiga-libros' }, porActividad: { 'club-2': 'Casa Nueva', 'no-existe': 'X' } },
      [
        { id: '1', data: act('a conf', { slug: 'club-1' }) },
        { id: '2', data: act('a conf', { slug: 'club-2' }) },
      ],
      opciones,
    );
    expect(plan.aEscribir.map((f) => [f.slug, f.destino])).toEqual([
      ['club-1', 'hormiga-libros'],
      ['club-2', 'casa-nueva'],
    ]);
    expect(plan.actividadesQueNoEstan).toEqual(['no-existe']);
  });

  it('la tabla valida `porActividad`', () => {
    expect(problemasDeLaTabla({ unir: {}, porActividad: { 'Club 1': 'X', ok: '  ' } })).toHaveLength(2);
    expect(problemasDeLaTabla({ unir: {}, porActividad: { 'club-1': 'Casa' } })).toEqual([]);
  });
});
