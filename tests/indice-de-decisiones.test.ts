/**
 * El índice de `docs/06-decisiones.md` es el que el script produce hoy — M-7
 * del PRD 6.
 *
 * `docs/06-decisiones-indice.md` existe para encontrar una decisión sin cargar
 * los ~205 mil tokens del registro. Un índice así solo sirve si es completo: al
 * que le falta la D que se busca, se lo deja de consultar, y un título viejo
 * manda a leer una decisión que ya no dice eso. Por eso no se escribe a mano:
 * este test compara el archivo con `indiceDe(06-decisiones.md)` y el arreglo es
 * `npm run decisiones:indice`, en el mismo cambio que tocó el registro.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { anclasDe } from '../scripts/anclas-referenciadas.mjs';
import { decisionesEscritas } from '../scripts/decisiones-referenciadas.mjs';
import { decisionesDe, INDICE, indiceDe, REGISTRO } from '../scripts/indice-de-decisiones.mjs';

const fuente = (ruta: string): string =>
  readFileSync(fileURLToPath(new URL(`../${ruta}`, import.meta.url)), 'utf8');

describe('el índice de 06-decisiones.md — M-7', () => {
  const registro = fuente(REGISTRO);

  it('lee una decisión por cada `## D-nnn` del registro (control positivo)', () => {
    const indexadas = decisionesDe(registro).map((d) => d.id);
    expect(indexadas.length).toBeGreaterThan(250);
    // Las que el barrido de huérfanas da por escritas: si una no entra al
    // índice, el regex de acá y el de allá dejaron de leer lo mismo.
    const escritas = decisionesEscritas(registro);
    expect(escritas.filter((id) => !indexadas.includes(id))).toEqual([]);
  });

  it('cada ancla del índice existe en el registro', () => {
    const anclas = anclasDe(registro);
    const rotas = decisionesDe(registro).filter((d) => !anclas.has(d.ancla));
    expect(rotas).toEqual([]);
  });

  it('toma el título de lo que sigue al `·`', () => {
    const muestra = '# X\n\n## D-7 · Un título con `código`\n\ncuerpo\n\n## Pendiente de decidir\n';
    expect(decisionesDe(muestra)).toEqual([
      { id: 'D-7', titulo: 'Un título con `código`', ancla: 'd-7--un-título-con-código' },
    ]);
    expect(indiceDe(muestra)).toContain('- [D-7](06-decisiones.md#d-7--un-título-con-código) · Un título con `código`');
    expect(indiceDe(muestra)).toContain('- [Pendiente de decidir](06-decisiones.md#pendiente-de-decidir)');
  });

  it('el archivo commiteado coincide con lo que genera el script', () => {
    // MUTACIÓN PROBADA: borrar una línea del índice, o renombrar el título de
    // una D en el registro sin regenerar, pone este caso en rojo.
    expect(
      fuente(INDICE) === indiceDe(registro),
      `${INDICE} no coincide con los títulos de ${REGISTRO}: corré \`npm run decisiones:indice\` ` +
        'y commiteá el resultado junto con el cambio al registro',
    ).toBe(true);
  });
});
