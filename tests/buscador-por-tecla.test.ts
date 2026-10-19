/**
 * **El buscador no recalcula todo en cada tecla** — B-2202.
 *
 * Se lee el fuente: lo que se fija es la forma del componente, que es lo que se
 * pierde en un refactor sin que ningún test de comportamiento lo note (el
 * resultado es el mismo, solo más lento).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/components/publico/Buscador.tsx', 'utf8');

describe('el buscador de la home por tecla — B-2202', () => {
  it('la lista se calcula con los filtros diferidos', () => {
    expect(src).toContain('const filtrosDeLaLista = useDeferredValue(filtros);');
    expect(src).toMatch(/listaPublica\(entradas, filtrosDeLaLista, orden, ahora\)/);
  });

  it('los chips salen de un memo, no de una llamada en el JSX', () => {
    // Mutación probada: volver a `chips={chipsDe(...)}` pone esto rojo.
    expect(src).not.toContain('chips={chipsDe(');
    expect(src).toContain('chips={chipsPorEje.get(eje) ?? []}');
    expect(src).toMatch(/const chipsPorEje = useMemo\(/);
  });

  it('el orden calcula el estado de cada entrada una vez, fuera del comparador', () => {
    const listado = readFileSync('src/lib/listadoPublico.ts', 'utf8');
    const orden = listado.slice(listado.indexOf("if (orden === 'nuevas')"));
    const comparador = orden.slice(orden.indexOf('return copia.sort((a, b) => {'));
    expect(comparador.slice(0, 200)).not.toContain('estadoDe(');
  });
});
