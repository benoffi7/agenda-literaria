import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { BAJADA, NOMBRE, NOMBRE_COMPLETO } from '@/lib/identidad';

/**
 * La identidad del sitio: **el nombre** — B-245, recortado en B-260.
 *
 * **Acá está solo el nombre, y el color tiene archivo propio.** B-245 derivaba un
 * tono por tipo de actividad y este archivo lo verificaba sobre los 360 tonos
 * posibles; D-146 lo retiró y **D-150 lo trajo de vuelta**, ahora elegible desde
 * Opciones. El barrido de los 360 y las guardas del matiz viven en
 * `tests/color-de-tipo.test.ts`, que es donde corresponde: son bastante más que un
 * caso, y este archivo es sobre cómo se llama el sitio.
 *
 * Lo que se conserva acá —y es lo que D-141 vino a arreglar de fondo— es que el
 * nombre viva en un módulo y que toda página se titule con él.
 *
 * El contraste de las tintas con nombre lo verifica `tests/sistema-visual.test.ts`,
 * que además ata cada token de `global.css` al hex de
 * `docs/referencias/sistema-visual.md`.
 */

describe('el nombre del sitio', () => {
  it('el nombre completo se arma del nombre y la bajada', () => {
    // Sin esto, los dos podrían divergir y el `<title>` diría una cosa y el
    // encabezado otra — que es el estado del que se viene.
    expect(NOMBRE_COMPLETO).toContain(NOMBRE);
    expect(NOMBRE_COMPLETO).toContain(BAJADA);
  });

  it('la bajada desarrolla el acrónimo, no lo repite', () => {
    /*
     * «LEH» tiene que poder leerse. La propiedad: las iniciales de la bajada son
     * las letras de la sigla, en orden. Si alguien cambia una de las dos y no la
     * otra, la sigla queda muda y esto lo dice.
     */
    // La sigla es la **palabra** en mayúsculas, no todas las mayúsculas del
    // nombre: «Agenda LEH» tiene una A capital que no es parte de la sigla.
    const sigla = NOMBRE.split(/\s+/).find((p) => /^[A-Z]{2,}$/.test(p));
    expect(sigla, `no se encontró una sigla en «${NOMBRE}»`).toBeDefined();
    const iniciales = BAJADA.split(/[\s,·]+/)
      .filter(Boolean)
      .map((p) => p[0]!.toUpperCase())
      .join('');
    expect(iniciales).toBe(sigla);
  });

  it('no se presenta con su categoría', () => {
    // El estado del que se viene: el sitio se llamaba «Agenda literaria», que es
    // lo que es y no cómo se llama. Un nombre que describe no es un nombre.
    expect(NOMBRE.toLowerCase()).not.toContain('literaria');
  });
});

/**
 * Toda página del sitio se presenta con el nombre — B-245.
 *
 * Es la misma clase de error que hizo nacer este módulo: una página que se titula
 * con su categoría en vez de con su nombre. No rompe nada, se ve bien, y el sitio
 * entero queda sin identidad en la pestaña, en el historial y en Google — que son
 * los tres lugares donde la gente lo vuelve a encontrar.
 *
 * `/admin` **sí** entra: es la pestaña que el dueño tiene abierta todo el día.
 */
describe('el nombre está en el título de cada página', () => {
  const paginas = (): string[] =>
    execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.endsWith('.astro'));

  it('el barrido encuentra páginas', () => {
    expect(paginas().length).toBeGreaterThan(3);
  });

  it('ninguna se presenta sin el nombre', () => {
    const sinNombre = paginas().filter((f) => {
      const src = readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8');
      const m = src.match(/titulo=\{?[`"']([^`"']*)/);
      if (!m) return false; // el título sale de otra parte; lo cubre su propio test
      // Vale la interpolación de `NOMBRE` tanto como el literal.
      return !src.includes('${NOMBRE}') && !m[1]!.includes(NOMBRE);
    });

    expect(
      sinNombre,
      'estas páginas se titulan sin el nombre del sitio: en la pestaña, en el ' +
        'historial y en Google quedan sin identidad.',
    ).toEqual([]);
  });
});
