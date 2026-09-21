/**
 * El pie del tríptico salta al listado, y el ancla existe — B-1136.
 *
 * ── Qué se rompió ─────────────────────────────────────────────────────────
 * Pedido del dueño: *«presionás "+11 más hoy" o cualquiera del tríptico. Los
 * eventos cambian, sí, pero como el tríptico ocupa mucho espacio, el usuario
 * percibe que no pasó nada»*.
 *
 * El filtro se aplicaba bien. Lo que faltaba era que se **viera**: el pie es un
 * `<a>` de página completa (B-791), así que la página volvía a cargar arriba de
 * todo y el resultado quedaba abajo del pliegue, detrás del mismo tríptico que
 * se acababa de tocar.
 *
 * ── Por qué este archivo, y no un caso más en `ahoraPublico.test.ts` ──────
 * Porque la mitad que se rompe en silencio **no es el link**: es el `id`. Un
 * ancla que no existe no es un error — el navegador se queda arriba, la página
 * funciona, y nadie se entera. Son dos archivos que no se conocen
 * (`ahoraPublico.ts` arma el link, `index.astro` escribe el `id`) y el nombre lo
 * declara un tercero, así que lo que hay que afirmar es que **los tres dicen lo
 * mismo**.
 *
 * `tests/ahoraPublico.test.ts` cubre la otra mitad: que el link termine en el
 * ancla y que el fragmento no se cuele en la query.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { ANCLA_RESULTADOS } from '@/lib/rutasPublicas';

const HOME = 'src/pages/index.astro';

const codigo = (): string =>
  sinComentarios(readFileSync(fileURLToPath(new URL(`../${HOME}`, import.meta.url)), 'utf8'));

describe('el ancla a la que salta el pie del tríptico — B-1136', () => {
  it('la home escribe el `id`, y sale de la constante compartida', () => {
    /*
     * **La mutación del bug**: escribir `id="resultados"` a mano acá dejaría
     * este caso en verde por el primer aserto y en rojo por el segundo, que es
     * el que importa — dos literales que pueden separarse es exactamente la
     * clase de D-88, y acá se separan sin que nada falle.
     */
    const c = codigo();
    expect(c, 'la home no declara el ancla').toContain('ANCLA_RESULTADOS');
    expect(c, 'el `id` no sale de la constante').toMatch(/id=\{ID_RESULTADOS\}/);
    expect(c, 'el id se escribió a mano en vez de usar la constante').not.toContain(
      `id="${ANCLA_RESULTADOS}"`,
    );
  });

  it('el ancla NO envuelve al tríptico, que es lo que hay que correr de la vista', () => {
    /*
     * Saltar a `#listado` no habría servido: ese `id` envuelve al tríptico, al
     * buscador y a la lista, así que la vista quedaría con el tríptico arriba —
     * justo lo que el pedido quiere sacar del medio.
     *
     * Se afirma por orden en el archivo: el contenedor del tríptico
     * (`ID_PANELES`) aparece **antes** que el del ancla.
     */
    const c = codigo();
    const paneles = c.indexOf('id={ID_PANELES}');
    const resultados = c.indexOf('id={ID_RESULTADOS}');
    expect(paneles, 'no se encontró el contenedor del tríptico').toBeGreaterThan(-1);
    expect(resultados, 'no se encontró el contenedor del ancla').toBeGreaterThan(-1);
    expect(resultados, 'el ancla quedó arriba del tríptico: saltar ahí no corre nada').
      toBeGreaterThan(paneles);
  });

  it('y NO vive adentro de lo que la island saca del DOM', () => {
    /*
     * La otra forma de romperse, y es peor porque **solo pasa después de
     * hidratar**: la island saca del DOM el tríptico del build y la lista del
     * build para montar los suyos. Un ancla adentro de cualquiera de los dos
     * existe en el HTML del build —así que un test sobre el artefacto pasaría— y
     * desaparece en cuanto carga el JavaScript.
     *
     * El contenedor del `<Buscador>` no lo toca nadie, y ahí está.
     */
    const c = codigo();
    const anclaEnvuelveAlBuscador = /id=\{ID_RESULTADOS\}[^>]*>\s*<Buscador/.test(c);
    expect(anclaEnvuelveAlBuscador, 'el ancla ya no envuelve al buscador').toBe(true);

    const listado = c.indexOf('id={ID_LISTADO}');
    expect(c.indexOf('id={ID_RESULTADOS}'), 'el ancla quedó adentro de la lista del build')
      .toBeLessThan(listado);
  });
});
