/**
 * trampa 3 / B-905: el write-back al propio documento va detrás de su guarda.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { COLECCIONES_DE_DIRECTORIO } from '../../functions/directorios.js';
import { triggers, TRIGGERS, sinComentarios, WRITE_BACKS_CON_GUARDA } from '../fixtures/clases-de-bug';

describe('trampa 3 · el write-back al propio documento va detrás de su guarda — B-905', () => {
  const llamadas = TRIGGERS.flatMap((t) =>
    Object.entries(WRITE_BACKS_CON_GUARDA)
      .filter(([efecto]) => new RegExp(`\\b${efecto}\\(`).test(sinComentarios(t.cuerpo)))
      .map(([efecto, guarda]) => ({ trigger: t, efecto, guarda })),
  );

  it('los llamadores son `syncCalendar`, el rebuild de cada directorio y el de las efemérides', () => {
    // Si esto se achica, un directorio dejó de escribir la marca (B-905 otra
    // vez); si crece, hay un trigger nuevo que la escribe y hay que mirarlo.
    expect(
      llamadas
        .filter((l) => l.efecto === 'marcarPublicada')
        .map((l) => l.trigger.nombre)
        .sort(),
    ).toEqual(
      [
        'syncCalendar',
        // B-959 — no es un directorio (no entra a la retención de la Guía), pero
        // congela su slug con la misma marca.
        'rebuildPorEfemerides',
        ...COLECCIONES_DE_DIRECTORIO.map((c) => `rebuildPor${c[0]!.toUpperCase()}${c.slice(1)}`),
      ].sort(),
    );
  });

  it('B-1920: `corregirCiudades` lo llama solo `syncCalendar`', () => {
    // El único `onDocumentWritten` sobre `actividades/{id}`: si se muda a
    // `guardarVersion` (un `onDocumentUpdated`) deja de ver el documento que
    // nace con un `ciudades` inventado.
    expect(
      llamadas.filter((l) => l.efecto === 'corregirCiudades').map((l) => l.trigger.nombre),
    ).toEqual(['syncCalendar']);
  });

  /**
   * **Qué lo pondría rojo:** sacar el `if (faltaMarcarPublicada(despues, antes))` de
   * cualquiera de los cinco triggers, o poner otro `if` entre la guarda y la
   * llamada (la llamada quedaría gobernada por una condición que no es la
   * guarda). El `try` del medio no cuenta: no decide nada.
   */
  it('el `if` más cercano que precede a cada llamada es el de su guarda', () => {
    const desguarnecidos: string[] = [];
    for (const { trigger, efecto, guarda } of llamadas) {
      const cuerpo = sinComentarios(trigger.cuerpo);
      for (const m of cuerpo.matchAll(new RegExp(`\\b${efecto}\\(`, 'g'))) {
        const antes = cuerpo.slice(0, m.index);
        const ultimoIf = [...antes.matchAll(/\bif\s*\(\s*(!?\s*\w+)/g)].pop();
        if (ultimoIf?.[1] !== guarda) {
          desguarnecidos.push(`${trigger.archivo} · ${trigger.nombre} → ${efecto}() sin ${guarda}()`);
        }
      }
    }
    expect(desguarnecidos).toEqual([]);
  });
});
