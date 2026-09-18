/**
 * El pie no es una tira de nueve filas — B-1135.
 *
 * ── Qué se rompió ─────────────────────────────────────────────────────────
 * Lo reportó el dueño con dos capturas, una de teléfono y otra de escritorio.
 * Los nueve enlaces del pie estaban en un `flex flex-col` **sin columnas**, así
 * que se apilaban en cualquier ancho: con `min-h-touch` por fila son ~400px de
 * pie, más el bloque de la marca, en un sitio cuyas páginas a veces miden menos
 * que eso. En escritorio quedaba además un hueco enorme en el medio — la marca a
 * la izquierda y una columna flaca pegada al borde derecho.
 *
 * **Y el pie no es decoración:** es lo que sostiene las rutas que no están en la
 * barra —«lo que ya pasó», «mis favoritos», «proponer una actividad»—, y un pie
 * que se lee como una pared se saltea entero.
 *
 * ── Qué se afirma acá, y qué no ───────────────────────────────────────────
 * Es un `.astro` y el ancho de pantalla no existe en un test, así que lo que se
 * verifica es la **estructura**: que los enlaces se repartan en columnas, que
 * ninguna fila se pueda partir entre dos, y que cada enlace tenga su `<li>`.
 * Cómo se ve se mira en una captura, y así se miró.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const PIE = 'src/components/sitio/PieDePagina.astro';

const codigo = (): string =>
  sinComentarios(readFileSync(fileURLToPath(new URL(`../${PIE}`, import.meta.url)), 'utf8'));

describe('el pie del sitio — B-1135', () => {
  it('el control positivo: el archivo se lee y tiene la lista de enlaces', () => {
    const c = codigo();
    expect(c.length).toBeGreaterThan(500);
    expect(c).toContain('aria-label="Enlaces del pie"');
  });

  it('los enlaces van en columnas, no en una tira', () => {
    /*
     * **Ésta es la mutación del bug**: devolver `flex flex-col` a la lista deja
     * los nueve apilados otra vez.
     *
     * `columns-*` y no un `grid`: son filas de alto distinto —hay textos de una
     * y de dos líneas— y una grilla alinea renglones, así que dejaría huecos
     * debajo de los más cortos. Misma razón que la pared de la cartelera.
     */
    const lista = /<ul class="mt-2[^"]*"/.exec(codigo());
    expect(lista, 'no se encontró la lista del pie').not.toBeNull();
    expect(lista![0], 'el pie volvió a ser una tira de una columna').toContain('columns-2');
    expect(lista![0]).not.toContain('flex-col');
  });

  it('ninguna fila se parte entre dos columnas', () => {
    /*
     * La mitad que no se puede olvidar: sin esto, CSS parte «Suscribirse al
     * calendario» entre el pie de una columna y la cabeza de la otra. Es la misma
     * lección que `claseAficheEnPared`.
     *
     * Se cuenta contra los `<li>`: si aparece uno nuevo sin la clase, este caso
     * lo dice.
     */
    const c = codigo();
    const filas = (c.match(/<li\b/g) ?? []).length;
    const protegidas = (c.match(/<li class="break-inside-avoid">/g) ?? []).length;
    expect(filas, 'el pie tiene menos enlaces de los que tenía').toBeGreaterThanOrEqual(9);
    expect(protegidas, `hay ${filas} filas y ${protegidas} con break-inside-avoid`).toBe(filas);
  });

  it('cada enlace tiene su propio `<li>`', () => {
    /*
     * «Anunciar en la agenda» y «Apoyar la agenda» compartían uno, así que un
     * lector de pantalla anunciaba ocho elementos sobre una lista de nueve — y en
     * columnas se notaba también a la vista: quedaban pegados y sin poder
     * repartirse.
     */
    const c = codigo();
    const lista = c.slice(c.indexOf('aria-label="Enlaces del pie"'));
    expect((lista.match(/<li\b/g) ?? []).length).toBe((lista.match(/<a\b/g) ?? []).length);
  });
});
