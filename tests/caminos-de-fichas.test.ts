import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { caminosDeFichas, SlugDeFichaRepetido } from '@/lib/contenidoDeLaGuia';
import { DIRECTORIOS } from '@/lib/directorios';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

/**
 * B-1640 — dos fichas publicadas de la Guía con el mismo slug ponen el build en
 * rojo, en vez de emitir dos rutas a la misma página y dejar una pisada en
 * silencio.
 *
 * `caminosDeDirectorio` lee Firestore, así que el comportamiento se fija sobre el
 * helper puro, y el cableado con una lectura de la fuente: sin ella, una página
 * de ficha que vuelva a un `fichas.map(...)` suelto nace sin red.
 */

const leer = (ruta: string) =>
  readFileSync(fileURLToPath(new URL(`../${ruta}`, import.meta.url)), 'utf8');
const fuente = sinComentarios(leer('src/lib/contenidoDeLaGuia.ts'));

describe('caminosDeFichas', () => {
  it('emite un camino por ficha, en el orden recibido y con la ficha como props', () => {
    const fichas = [
      { slug: 'la-libreria', nombre: 'La Librería' },
      { slug: 'otra', nombre: 'Otra' },
    ];
    expect(caminosDeFichas('librerias', fichas)).toEqual([
      { params: { slug: 'la-libreria' }, props: { ficha: fichas[0] } },
      { params: { slug: 'otra' }, props: { ficha: fichas[1] } },
    ]);
  });

  it('sin fichas no tira: un directorio vacío es un directorio vacío', () => {
    expect(caminosDeFichas('lugares', [])).toEqual([]);
  });

  it('tira con el slug repetido y el directorio en el mensaje', () => {
    const fichas = [{ slug: 'uno' }, { slug: 'dos' }, { slug: 'uno' }];
    let error: unknown;
    try {
      caminosDeFichas('bibliotecas', fichas);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(SlugDeFichaRepetido);
    const repetido = error as SlugDeFichaRepetido;
    expect(repetido.slug).toBe('uno');
    expect(repetido.directorio).toBe('bibliotecas');
    expect(repetido.message).toContain('«uno»');
    expect(repetido.message).toContain('«bibliotecas»');
  });
});

describe('los caminos de cada directorio pasan por caminosDeFichas', () => {
  it('caminosDeDirectorio arma sus caminos con caminosDeFichas(id, …)', () => {
    const inicio = fuente.indexOf('export const caminosDeDirectorio = ');
    expect(inicio, 'no encontré caminosDeDirectorio').toBeGreaterThan(-1);
    const cuerpo = fuente.slice(inicio, fuente.indexOf('\n\n', inicio));
    expect(cuerpo).toContain('caminosDeFichas(id, ');
  });

  for (const { id } of DIRECTORIOS) {
    it(`/guia/${id}/[slug] toma sus caminos de caminosDeDirectorio('${id}')`, () => {
      const pagina = sinComentarios(leer(`src/pages/guia/${id}/[slug].astro`));
      expect(pagina).toContain(`getStaticPaths = () => caminosDeDirectorio('${id}')`);
    });
  }
});
