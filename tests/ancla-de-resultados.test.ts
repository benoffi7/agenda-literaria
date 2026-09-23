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

/**
 * Y que el salto **se vea** — B-1232.
 *
 * La otra mitad del mismo pedido del dueño, un frente después: *«cuando hacés
 * click en "+9 más hoy" o en el finde, no baja lo suficiente»*. El ancla existía
 * y el link apuntaba bien; lo que faltaba era descontar el encabezado, que de
 * `sm` en adelante es `sticky` y se apoya encima del punto de llegada.
 *
 * **Es exactamente la clase de bug que B-1136 documenta**: no hay error, la
 * página funciona, el navegador salta — y el destino queda tapado. Un test sobre
 * el link no lo ve, un test sobre el `id` tampoco, y el HTML del build se ve
 * perfecto. Solo se nota mirando la pantalla.
 *
 * Lo que se afirma es el **origen del número**, no el número: que salga de
 * `--spacing-encabezado`, que es el mismo token del que sale la altura de la
 * cabecera (`min-h-encabezado`) y el `top` de todo lo que se pega debajo. Con un
 * valor a mano el día que el encabezado cambie de alto el salto vuelve a caer
 * corto, en silencio, que es como cayó esta vez — es la clase de D-88.
 */
describe('el salto descuenta el encabezado pegado — B-1232', () => {
  /*
   * Los dos destinos de salto de la home: `#listado` («Saltar al listado», el
   * link de accesibilidad) y `#resultados` (el pie del tríptico). Los dos
   * aterrizan debajo de la misma cabecera, así que los dos necesitan el mismo
   * descuento — arreglar uno solo deja el otro roto igual.
   */
  const DESTINOS = [
    { id: 'id="listado"', nombre: '«Saltar al listado»' },
    { id: 'id={ID_RESULTADOS}', nombre: 'el pie del tríptico' },
  ];

  it.each(DESTINOS)('$nombre descuenta la altura de la cabecera', ({ id }) => {
    const c = codigo();
    const desde = c.indexOf(id);
    expect(desde, `no se encontró el destino ${id}`).toBeGreaterThan(-1);
    // La lista de clases del mismo elemento: de su `id` hasta el `>` que lo cierra.
    const clases = c.slice(desde, c.indexOf('>', desde));
    expect(clases, 'el destino no descuenta el encabezado en `sm`').toContain(
      'sm:scroll-mt-[calc(var(--spacing-encabezado)',
    );
  });

  it('y el descuento sale del token, no de un número a mano', () => {
    /*
     * **La mutación del bug**: `sm:scroll-mt-20` deja el salto bien hoy y mal el
     * día que la cabecera crezca. El caso de arriba ya lo agarra por el `calc`,
     * pero éste dice por qué, y falla también si alguien copia el valor resuelto
     * (`sm:scroll-mt-[5.5rem]`) creyendo que es lo mismo.
     */
    const c = codigo();
    const saltos = c.match(/sm:scroll-mt-\[[^\]]+\]/g) ?? [];
    expect(saltos.length, 'la home ya no tiene ningún salto compensado').toBe(DESTINOS.length);
    for (const salto of saltos) {
      expect(salto, 'un salto se escribió con un valor propio en vez del token').toContain(
        'var(--spacing-encabezado)',
      );
    }
  });
});
