/**
 * B-211: el doble de Timestamp vive en un solo lugar.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { execFileSync } from 'node:child_process';
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { fuente, versionados, sinComentarios } from '../fixtures/clases-de-bug';

/**
 * Clase de B-211 · el doble de un tipo del dominio se define **una vez**.
 *
 * El doble de `Timestamp` estaba escrito trece veces —a mano en once tests y
 * exportado desde los dos fixtures— en cuatro formas distintas, y **dos
 * mentían**: devolvían `seconds: 0`, o sea "todo Timestamp es la época". No
 * rompía nada porque ningún código de producción lee `.seconds`, pero el
 * `Timestamp` real de Firestore sí lo expone. Es la trampa 1 del §13 dentro del
 * fixture que existe para atajarla.
 *
 * ── Por qué hace falta esta guarda y no alcanzaba con unificar ────────────
 * Es **la misma clase que este repo ya automatizó**: «un fixture que no ejercita
 * el caso central del dominio», que hizo nacer `fixtures/ciclo.ts` y
 * `invariantes-de-ciclo.test.ts` después de aparecer cuatro veces. Reapareció con
 * otra cara — no es que el fixture no ejercitara el caso, es que había trece
 * fixtures y no se parecían entre sí.
 *
 * O sea: **la automatización se escribió y no se adoptó.** Ese es un modo de
 * falla distinto del que se atajó, y no tenía red. Unificar sin dejar guarda
 * habría dejado el mismo hueco abierto: el catorceavo `ts()` se escribe en cinco
 * segundos, porque es más rápido que buscar dónde vive el bueno.
 */
describe('clase de B-211 · el doble de Timestamp vive en un solo lugar', () => {
  const FIXTURE = 'tests/fixtures/tiempo.ts';

  /**
   * El hueco que dejaba pasar a `lista-actividades.render.test.tsx` — B-875.
   *
   * `f.endsWith('.ts')` es falso para cualquier `.tsx`, así que los
   * veinticuatro `*.render.test.tsx` (B-08) quedaban afuera del barrido
   * entero: no es que la forma no los reconociera, es que nunca se les leía
   * el fuente. `/\.tsx?$/` es lo que hace falta para que ambas extensiones
   * cuenten.
   */
  const testsVersionados = (): string[] =>
    execFileSync('git', ['ls-files', '-z', 'tests'], { encoding: 'utf8' })
      .split('\0')
      .filter((f) => /\.tsx?$/.test(f) && f !== FIXTURE);

  /**
   * El `.render.test.tsx` que B-875 encontró con su propio doble. Desde B-1050
   * importa el fixture como los demás, así que ya no es una excepción: queda
   * como el caso concreto con el que se controla que el barrido lee los `.tsx`.
   * No hay lista de excepciones — un doble nuevo es una regresión, no deuda.
   */
  const RENDER_QUE_SE_LE_ESCAPABA = 'tests/lista-actividades.render.test.tsx';

  /**
   * La **forma** de un doble de Timestamp, no su nombre: lo que lo delata es
   * devolver `toDate` y `toMillis` juntos. Buscar `const ts =` dejaría pasar al
   * que se llame `stamp`, `fecha` o `t`, que es exactamente lo que escribe quien
   * no encontró el fixture.
   */
  const FORMA_DE_DOBLE = /toDate:\s*\(\)\s*=>[\s\S]{0,80}?toMillis:\s*\(\)\s*=>/;

  /** Sin comentarios: la prosa de este repo cita código, y engancharía. */
  const codigo = (relativo: string): string => sinComentarios(fuente(relativo));

  it('el fixture existe y hay tests que lo usarían', () => {
    // Control positivo: sin esto, «ningún test define su propio doble» pasaría
    // recorriendo una lista vacía.
    expect(testsVersionados().length).toBeGreaterThan(40);
    expect(codigo(FIXTURE)).toContain('export const ts');
    // Y la forma encuentra lo que dice encontrar.
    expect(FORMA_DE_DOBLE.test(codigo(FIXTURE))).toBe(true);
  });

  it('el barrido alcanza los .render.test.tsx — B-875, el hueco que dejaba pasar el .tsx', () => {
    // Control del arreglo puntual: `f.endsWith('.ts')` roto volvería a dejar
    // esta lista vacía aunque el archivo exista y tenga la forma del doble.
    const versionados = testsVersionados();
    expect(versionados.some((f) => f.endsWith('.render.test.tsx'))).toBe(true);
    expect(versionados).toContain(RENDER_QUE_SE_LE_ESCAPABA);
  });

  it('ningún test define su propio doble de Timestamp', () => {
    const conCopia: string[] = [];
    for (const archivo of testsVersionados()) {
      if (FORMA_DE_DOBLE.test(codigo(archivo))) conCopia.push(archivo);
    }
    expect(
      conCopia.sort(),
      'importá { ts } o { tsDe } de tests/fixtures/tiempo en vez de escribirlo de nuevo',
    ).toEqual([]);
  });

  it('el doble no miente en los campos que nadie lee todavía', () => {
    /*
     * `seconds` y `nanoseconds` salen de la fecha, no de un cero. Es la parte
     * que hacía falsas a dos de las cuatro copias: un doble que miente en un
     * campo que nadie lee **todavía** es una bomba con fecha, no una
     * simplificación — y el día que alguien lea `.seconds`, el test que falle no
     * va a ser el que tenga el bug.
     *
     * Se mira el código **sin comentarios**: la primera versión de este `it`
     * falló porque el docblock del fixture cita `seconds: 0` para explicar la
     * variante mala. Es el modo de falla que este repo ya se hizo tres veces —
     * un chequeo que engancha la prosa que habla del bug en vez del bug.
     */
    const src = codigo(FIXTURE);
    expect(src).toMatch(/seconds:\s*Math\.floor/);
    expect(src).not.toMatch(/seconds:\s*0\b/);
    expect(src).not.toMatch(/nanoseconds:\s*0\b/);
  });

  it('el doble satisface el tipo declarado del modelo, no uno propio', () => {
    // `TimestampLike` declara los cuatro campos. Las copias de dos campos
    // convivían porque los builders que las usaban estaban tipados laxo: que el
    // fixture devuelva el tipo hace que el compilador sostenga el acuerdo.
    expect(codigo(FIXTURE)).toContain('): TimestampLike =>');
    expect(codigo(FIXTURE)).toContain(
      "import type { TimestampLike } from '@/types/actividad'",
    );
  });
});
