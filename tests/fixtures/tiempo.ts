import type { TimestampLike } from '@/types/actividad';

/**
 * El doble de `Timestamp` de Firestore, uno y solo uno — B-211.
 *
 * ── Por qué existe este archivo ───────────────────────────────────────────
 * Estaba escrito **trece veces**: a mano en once archivos de test y exportado
 * dos veces más desde `fixtures/ciclo.ts` y `fixtures/centinelas.ts`, con formas
 * distintas cada uno. Cuatro variantes en total:
 *
 * | Forma | Copias |
 * |---|---|
 * | `{ toDate, toMillis }` | 6 |
 * | `{ toDate, toMillis, seconds: Math.floor(…), nanoseconds: 0 }` | 4 |
 * | `{ toDate, toMillis, seconds: 0, nanoseconds: 0 }` | 2 |
 * | delegando en `tsDe` | 1 |
 *
 * **La tercera forma mentía**: decía que todo `Timestamp` es la época. No rompía
 * nada porque ningún código de producción lee `.seconds` —lee `.toDate()` y
 * `.toMillis()`—, pero el `Timestamp` real de Firestore sí lo expone, así que el
 * día que algo lo use esos dos archivos iban a pasar con datos falsos. Es la
 * trampa 1 del §13 dentro del fixture que existe para atajarla.
 *
 * Y es **la misma clase que este repo ya automatizó** —«un fixture que no
 * ejercita el caso central del dominio», que hizo nacer `fixtures/ciclo.ts` y
 * `invariantes-de-ciclo.test.ts`—, reaparecida con otra cara: no es que el
 * fixture no ejercite el caso, es que había trece fixtures y no se parecían
 * entre sí. **La automatización se escribió y no se adoptó**, que es un modo de
 * falla distinto del que se atajó y no tenía red.
 *
 * ── Por qué la forma completa ─────────────────────────────────────────────
 * `TimestampLike` (en `src/types/actividad.ts`) declara los cuatro campos. Las
 * copias de dos campos no lo satisfacían y convivían igual porque los builders
 * que las usaban estaban tipados laxo (`Record<string, unknown>`). Devolver el
 * tipo declarado es lo que hace que el compilador sostenga el acuerdo en vez de
 * que lo sostenga la memoria.
 *
 * `seconds` sale de la fecha de verdad y no de un cero: un doble que miente en
 * un campo que nadie lee todavía es una bomba con fecha, no una simplificación.
 */
export const ts = (iso: string): TimestampLike => {
  const d = new Date(iso);
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: (d.getTime() % 1000) * 1_000_000,
  };
};

/**
 * Lo mismo desde un `Date` ya construido, para cuando quien llama hizo la
 * aritmética (correr una fecha, sumar minutos) y volver a pasar por ISO solo
 * agrega una conversión que puede perder precisión.
 */
export const tsDe = (d: Date): TimestampLike => ts(d.toISOString());
