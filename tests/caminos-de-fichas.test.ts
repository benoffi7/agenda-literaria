import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { caminosDeFichas, SlugDeFichaRepetido } from '@/lib/contenidoDelSitio';
import { DIRECTORIOS } from '@/lib/directorios';

/**
 * B-1640 — dos fichas publicadas de la Guía con el mismo slug ponen el build en
 * rojo, en vez de emitir dos rutas a la misma página y dejar una pisada en
 * silencio.
 *
 * `caminosDe*` leen Firestore, así que el comportamiento se fija sobre el helper
 * puro que los cuatro comparten, y el cableado con una lectura de la fuente: sin
 * ella, un quinto directorio que vuelva al `fichas.map(...)` suelto nace sin red.
 */

const fuente = readFileSync(
  fileURLToPath(new URL('../src/lib/contenidoDelSitio.ts', import.meta.url)),
  'utf8',
);

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
  const nombres: Record<string, string> = {
    librerias: 'caminosDeLibreria',
    bibliotecas: 'caminosDeBiblioteca',
    suscripciones: 'caminosDeSuscripcion',
    lugares: 'caminosDeLugar',
  };

  it('el registro de arriba cubre todos los directorios', () => {
    expect(Object.keys(nombres).sort()).toEqual(DIRECTORIOS.map((d) => d.id).sort());
  });

  for (const [directorio, nombre] of Object.entries(nombres)) {
    it(`${nombre} usa caminosDeFichas('${directorio}', …)`, () => {
      const inicio = fuente.indexOf(`export const ${nombre} = `);
      expect(inicio, `no encontré ${nombre}`).toBeGreaterThan(-1);
      const cuerpo = fuente.slice(inicio, fuente.indexOf('\n\n', inicio));
      expect(cuerpo).toContain(`caminosDeFichas('${directorio}', `);
    });
  }
});
