/**
 * **La copia del normalizador de handles de Instagram, para los scripts.**
 *
 * La normalización de verdad es `handleInstagram` (`src/lib/detallePublico.ts`):
 * resuelve `@casabrandon`, `casabrandon` y `instagram.com/casabrandon`, y valida
 * contra el alfabeto real de Instagram — lo que no lo cumple no se convierte en
 * link, porque **un handle con una barra adentro armaría una URL a otra cuenta**.
 *
 * ── Por qué hay una copia ─────────────────────────────────────────────────
 * Un `.mjs` que corre con `node` a secas **no resuelve los alias `@/`** de
 * TypeScript, y arrastrar un loader para un script de una página no vale. Es la
 * misma restricción que **D-20** resolvió para las Functions, y se resuelve
 * igual: hay una copia y un test la ata.
 *
 * ── Por qué vive acá y no adentro del script ──────────────────────────────
 * Porque importar el script lo **ejecuta**: se conecta a Firestore y termina con
 * `process.exit(0)`, así que un test que lo importara moriría ahí. Es el mismo
 * corte que `huella-de-auditoria.mjs` (B-794): la mitad pura aparte, para que
 * tenga test.
 *
 * `tests/instagrams-de-la-base.test.ts` corre esta función y la del sitio contra
 * la misma batería de entradas y exige que contesten **igual**. Cualquier cambio
 * va en los dos lados.
 */

/** `@casabrandon` / `casabrandon` / `instagram.com/casabrandon` → el handle solo. */
export const handleInstagram = (crudo) => {
  const limpio = (crudo ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(limpio) ? limpio : null;
};
