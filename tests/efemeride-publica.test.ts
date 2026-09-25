/**
 * **Lo que el sitio publica de una efeméride, y qué día la muestra** — B-959.
 *
 * Dos mitades:
 *
 * 1. **El barrido de centinelas** (§5.2, whitelist): cada string del documento
 *    es un centinela (`fixtures/centinelas-efemeride.ts`) y por cada salida
 *    pública hay una lista corta de los que **deben** sobrevivir. La aserción va
 *    en las dos direcciones: ninguno de más (fuga) y ninguno de menos (se dejó
 *    de publicar algo).
 * 2. **El día**: que la de hoy se elija en Buenos Aires y no en el reloj del
 *    navegador (trampa 1 del lado del cliente), y el pliegue del 29 de febrero.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  CAMPOS_DE_LA_PROYECCION_EFEMERIDE,
  construirIndiceDeEfemerides,
  descripcionDeEfemeride,
  efemeridePublica,
  efemeridesDeHoy,
  efemeridesDelDia,
  efemeridesPorMes,
  entradasDelIndice,
  fechaDeEfemeride,
  migasDeEfemeride,
  renglonDeHoy,
  sinSlugsRepetidos,
  vecinasDelMes,
  type EfemeridePublica,
} from '@/lib/efemeridePublica';
import type { Efemeride } from '@/types/efemeride';
import { CAMPOS_PUBLICOS_DE_EFEMERIDE } from '../functions/efemerides.js';
import {
  CENTINELA_EFEMERIDE,
  RUTAS_EFEMERIDE,
  VALORES_NO_TEXTO_EFEMERIDE,
  efemerideCentinela,
  type RutaDeEfemeride,
} from './fixtures/centinelas-efemeride';

const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string) => readFileSync(raiz(rel), 'utf8');

/** Qué centinelas aparecen en una salida serializada. */
const sobrevivientes = (salida: unknown): RutaDeEfemeride[] => {
  const texto = JSON.stringify(salida);
  return RUTAS_EFEMERIDE.filter((r) => texto.includes(CENTINELA_EFEMERIDE[r]));
};

const publica = (): EfemeridePublica => efemeridePublica(efemerideCentinela())!;

const una = (over: Partial<EfemeridePublica> = {}): EfemeridePublica => ({
  slug: 'nace-cortazar',
  titulo: 'Nace Julio Cortázar',
  descripcion: '',
  dia: 26,
  mes: 8,
  anio: 1914,
  fuente: null,
  ...over,
});

describe('barrido de la proyección de una efeméride (§5.2, whitelist)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    // Los uids de `createdBy`/`updatedBy` son lo que esta proyección existe
    // para no publicar (§5.1).
    expect(sobrevivientes(publica()).sort()).toEqual(
      ['titulo', 'slug', 'descripcion', 'fuente.texto', 'fuente.url'].sort(),
    );
  });

  it('las claves de la proyección son exactamente las que la query del build pide', () => {
    expect(Object.keys(publica()).sort()).toEqual([...CAMPOS_DE_LA_PROYECCION_EFEMERIDE].sort());
  });

  it('la guarda de rebuild compara los campos publicados más `estado` (D-20: functions no importa de src)', () => {
    expect([...CAMPOS_PUBLICOS_DE_EFEMERIDE].sort()).toEqual(
      ['estado', ...CAMPOS_DE_LA_PROYECCION_EFEMERIDE].sort(),
    );
  });

  it('ni el estado, ni la marca, ni las fechas del documento salen', () => {
    const p = publica() as unknown as Record<string, unknown>;
    for (const campo of ['estado', 'publicadaAlgunaVez', 'createdAt', 'updatedAt']) {
      expect(p, campo).not.toHaveProperty(campo);
    }
  });

  it('CONTROL NEGATIVO: con un spread, el barrido falla nombrando el campo', () => {
    const conFuga = { ...efemerideCentinela(), ...publica() };
    expect(sobrevivientes(conFuga)).toContain('createdBy');
  });

  it('el fixture cubre todos los campos de `Efemeride`', () => {
    const conCentinela = new Set([
      ...RUTAS_EFEMERIDE.map((r) => r.split('.')[0]!),
      ...Object.keys(VALORES_NO_TEXTO_EFEMERIDE),
    ]);
    expect(Object.keys(efemerideCentinela()).filter((k) => !conCentinela.has(k))).toEqual([]);
  });

  it('ningún centinela es subcadena de otro', () => {
    const valores = Object.values(CENTINELA_EFEMERIDE);
    for (const a of valores) {
      for (const b of valores) if (a !== b) expect(b.includes(a), `${a} ⊂ ${b}`).toBe(false);
    }
  });
});

describe('barrido de las otras salidas', () => {
  it('`/efemerides.json` lleva solo el título y el slug — ni la descripción, ni la fuente', () => {
    expect(sobrevivientes(construirIndiceDeEfemerides([publica()])).sort()).toEqual(
      ['slug', 'titulo'].sort(),
    );
  });

  it('el renglón de la home, lo mismo', () => {
    const ahora = new Date('2026-08-26T15:00:00Z');
    const r = renglonDeHoy(construirIndiceDeEfemerides([publica()]).efemerides, ahora);
    expect(r).not.toBeNull();
    expect(sobrevivientes(r).sort()).toEqual(['slug', 'titulo'].sort());
  });

  it('la descripción de la página y las migas: título, slug y descripción', () => {
    expect(sobrevivientes(descripcionDeEfemeride(publica()))).toEqual(['descripcion']);
    expect(sobrevivientes(migasDeEfemeride(publica())).sort()).toEqual(['slug', 'titulo'].sort());
  });
});

describe('lo que se publica sale saneado', () => {
  it('un link de fuente que no es http(s) sale sin link, y el texto queda', () => {
    const p = efemeridePublica({
      ...efemerideCentinela(),
      fuente: { texto: 'BN', url: 'javascript:alert(1)' },
    });
    expect(p!.fuente).toEqual({ texto: 'BN', url: null });
  });

  it('un documento con un día imposible, o un slug raro, se descarta en vez de tirar el build', () => {
    expect(efemeridePublica({ ...efemerideCentinela(), dia: 31, mes: 4 })).toBeNull();
    expect(efemeridePublica({ ...efemerideCentinela(), mes: 13 })).toBeNull();
    expect(efemeridePublica({ ...efemerideCentinela(), slug: '../admin' })).toBeNull();
    expect(efemeridePublica({ ...efemerideCentinela(), titulo: '   ' })).toBeNull();
  });

  it('un slug repetido queda una sola vez: la primera en el orden del año', () => {
    const quedan = sinSlugsRepetidos([
      una({ titulo: 'La de agosto' }),
      una({ titulo: 'La de enero', mes: 1 }),
      una({ slug: 'otra' }),
    ]);
    expect(quedan.map((e) => [e.slug, e.titulo])).toEqual([
      ['nace-cortazar', 'La de enero'],
      ['otra', 'Nace Julio Cortázar'],
    ]);
  });

  it('el índice que baja el navegador se valida antes de usarlo', () => {
    expect(entradasDelIndice(null)).toEqual([]);
    expect(entradasDelIndice({ efemerides: 'x' })).toEqual([]);
    expect(
      entradasDelIndice({ efemerides: [{ slug: '../x', titulo: 't', dia: 1, mes: 1 }] }),
    ).toEqual([]);
  });

  it('el script de la home pinta con `textContent`, nunca con `innerHTML`', () => {
    // Sin comentarios: el docblock nombra lo que está prohibido para explicarlo.
    const componente = sinComentarios(fuente('src/components/sitio/EfemerideDeHoy.astro'));
    expect(componente).toContain('textContent');
    expect(componente).not.toMatch(/innerHTML|set:html|client:/);
  });

  it('la query del build filtra por publicado y pide solo los campos de la proyección', () => {
    const lector = fuente('src/lib/contenidoDelSitio.ts');
    const i = lector.indexOf('const efemeridesPublicadas');
    const cuerpo = lector.slice(i, lector.indexOf('};', i));
    expect(cuerpo).toContain(".where('estado', '==', ESTADO_PUBLICO_EFEMERIDE)");
    expect(cuerpo).toContain('.select(...CAMPOS_DE_LA_PROYECCION_EFEMERIDE)');
    expect(cuerpo).toContain('sinSlugsRepetidos(');
  });
});

describe('qué día se muestra', () => {
  const lista = [
    una(),
    una({ slug: 'rayuela', titulo: 'Se publica Rayuela', dia: 28, mes: 6, anio: 1963 }),
    una({ slug: 'bisiesta', titulo: 'Una del 29', dia: 29, mes: 2, anio: null }),
  ];

  it('el día se decide en Buenos Aires, no en el reloj del navegador', () => {
    // 02:30 UTC del 27 son las 23:30 del 26 en Buenos Aires: sigue siendo el 26.
    expect(efemeridesDeHoy(lista, new Date('2026-08-27T02:30:00Z')).map((e) => e.slug)).toEqual([
      'nace-cortazar',
    ]);
    // Y a las 03:30 UTC ya es el 27 acá.
    expect(efemeridesDeHoy(lista, new Date('2026-08-27T03:30:00Z'))).toEqual([]);
  });

  it('el 29 de febrero, en un año que no lo tiene, se muestra el 28', () => {
    expect(efemeridesDelDia(lista, '2027-02-28').map((e) => e.slug)).toEqual(['bisiesta']);
    // En un bisiesto va en su día, y no también el 28.
    expect(efemeridesDelDia(lista, '2028-02-28')).toEqual([]);
    expect(efemeridesDelDia(lista, '2028-02-29').map((e) => e.slug)).toEqual(['bisiesta']);
  });

  it('el año del hecho no decide el día', () => {
    expect(efemeridesDelDia(lista, '1999-06-28').map((e) => e.slug)).toEqual(['rayuela']);
  });
});

describe('el renglón de la home', () => {
  const ahora = new Date('2026-08-26T15:00:00Z');

  it('sin efeméride hoy, no hay renglón', () => {
    expect(renglonDeHoy([], ahora)).toBeNull();
    expect(renglonDeHoy([una({ dia: 1 })], ahora)).toBeNull();
  });

  it('con una, dice cuándo y lleva a su página', () => {
    expect(renglonDeHoy([una()], ahora)).toEqual({
      titulo: 'Nace Julio Cortázar',
      href: '/efemerides/nace-cortazar/',
      cuando: 'Un 26 de agosto de 1914',
      mas: null,
    });
  });

  it('con varias, muestra la del hecho más viejo y lleva al día en el listado', () => {
    const r = renglonDeHoy(
      [una({ slug: 'nueva', titulo: 'Otra', anio: 2001 }), una(), una({ slug: 'sin', anio: null })],
      ahora,
    );
    expect(r!.titulo).toBe('Nace Julio Cortázar');
    expect(r!.mas).toEqual({ cuantas: 2, href: '/efemerides/#dia-08-26' });
  });
});

describe('las páginas', () => {
  it('la fecha se escribe sin `Intl`: son dos números, no un instante', () => {
    expect(fechaDeEfemeride(una())).toBe('26 de agosto de 1914');
    expect(fechaDeEfemeride(una({ anio: null }))).toBe('26 de agosto');
  });

  it('el listado va por mes, en orden, sin los meses vacíos', () => {
    const meses = efemeridesPorMes([
      una({ slug: 'b', dia: 30 }),
      una({ slug: 'c', mes: 1, dia: 5 }),
      una({ slug: 'a', dia: 2 }),
    ]);
    expect(meses.map((m) => m.nombre)).toEqual(['enero', 'agosto']);
    expect(meses[1]!.efemerides.map((e) => e.slug)).toEqual(['a', 'b']);
  });

  it('las vecinas son las del mismo mes, sin la propia', () => {
    const e = una();
    const vecinas = vecinasDelMes(e, [e, una({ slug: 'x', dia: 3 }), una({ slug: 'y', mes: 9 })]);
    expect(vecinas.map((v) => v.slug)).toEqual(['x']);
  });

  it('la plantilla del detalle recibe la proyección, no el documento', () => {
    const plantilla = sinComentarios(fuente('src/pages/efemerides/[slug].astro'));
    expect(plantilla).toContain('efemeride: EfemeridePublica');
    expect(plantilla).not.toMatch(/createdBy|updatedBy|from '@\/types\/efemeride'/);
  });

  it('el tipo del documento no le sirve a la proyección más que por sus campos públicos', () => {
    // Compila: `efemeridePublica` acepta el documento entero sin castear.
    const doc: Efemeride = efemerideCentinela();
    expect(efemeridePublica(doc)).not.toBeNull();
  });
});
