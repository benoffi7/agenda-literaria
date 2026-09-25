/**
 * B-83: un efecto incondicional no puede quedar debajo de una guarda.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { triggers, TRIGGERS, primero, EFECTOS_INCONDICIONALES } from '../fixtures/clases-de-bug';

const llamadasAEfecto = () =>
  TRIGGERS.flatMap((t) =>
    EFECTOS_INCONDICIONALES.filter((e) => new RegExp(`\\b${e}\\(`).test(t.cuerpo)).map((e) => ({
      trigger: t,
      efecto: e,
    })),
  );

describe('clase de B-83 · un efecto incondicional no puede quedar debajo de una guarda', () => {
  it('los efectos declarados incondicionales se llaman desde más de un trigger', () => {
    const llamadas = llamadasAEfecto();
    expect(llamadas.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * **Qué lo haría pasar:** mover `await marcarRebuild(...)` arriba de
   * `if (ops.length === 0) return;` y de `if (!CALENDAR_ID) return;` en
   * `syncCalendar`. Cuesta un build de más cuando el cambio es solo interno, y
   * el debounce del §8 ya los junta.
   *
   * Y vale para el efecto que se declare mañana: alcanza con sumarlo a
   * `EFECTOS_INCONDICIONALES` y el chequeo lo cubre en todos los triggers.
   */
  it('B-83: ningún return se ejecuta antes de un efecto incondicional', () => {
    const tapados: string[] = [];
    for (const { trigger, efecto } of llamadasAEfecto()) {
      const idx = primero(trigger.cuerpo, new RegExp(`\\b${efecto}\\(`));
      const antes = trigger.cuerpo.slice(0, idx);
      if (/\breturn\b/.test(antes)) {
        tapados.push(`${trigger.archivo} · ${trigger.nombre} → ${efecto}()`);
      }
    }
    expect(tapados).toEqual([]);
  });
});
