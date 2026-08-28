import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Toda página del sitio público lleva encabezado y pie — B-229.
 *
 * ── Por qué hace falta un test para esto ──────────────────────────────────
 * `Base.astro` trae el chrome **apagado por defecto** (`seccion = 'ninguna'`),
 * porque `/admin` es una SPA con su propia navegación y dos barras compitiendo
 * por el mismo lugar es peor que ninguna. El default correcto para el panel es
 * el default equivocado para el sitio.
 *
 * O sea: **olvidarse de `seccion` no rompe nada, solo publica una página sin
 * salida.** No hay error, no hay warning, el build queda verde y la página se ve
 * bien sola — se nota recién cuando alguien entra y no puede volver. Es
 * exactamente la clase de cosa que este repo pone en un test en vez de confiar
 * en que se recuerde, y más ahora que las páginas las escriben frentes en
 * paralelo que no se ven entre sí.
 *
 * ── Qué NO verifica ───────────────────────────────────────────────────────
 * Que la sección declarada sea la correcta: `/ayuda` podría declarar
 * `seccion="contacto"` y esto pasaría. Eso se ve mirando la página, y un test
 * que lo atara tendría que repetir el mapa de rutas — dos listas que se
 * desincronizan. Acá se verifica lo que se olvida de verdad: que esté.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/**
 * Las páginas que **no** son del sitio público, con su motivo. Es una lista
 * explícita y no un patrón: una excepción por patrón («todo lo que no esté en
 * tal carpeta») dejaría entrar la próxima página sin que nadie lo decida.
 */
const SIN_CHROME: Record<string, string> = {
  'src/pages/admin.astro': 'el panel es una SPA con su propia navegación',
};

const paginasAstro = (): string[] =>
  execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.astro'));

describe('el chrome del sitio público — B-229', () => {
  it('el barrido encuentra páginas de verdad', () => {
    // Control positivo: sin esto, un `git ls-files` que no devuelve nada haría
    // pasar el test de abajo sin haber mirado una sola página.
    const paginas = paginasAstro();
    expect(paginas.length).toBeGreaterThan(1);
    expect(paginas).toContain('src/pages/admin.astro');
  });

  it('toda página pública le pasa una sección a Base', () => {
    const sinDeclarar = paginasAstro()
      .filter((f) => !(f in SIN_CHROME))
      .filter((f) => {
        const src = readFileSync(raiz(f), 'utf8');
        // Solo aplica a las que usan el layout: una página que no lo usa es otro
        // problema, y confundirlos haría que este test diga algo que no mira.
        if (!/<Base[\s>]/.test(src)) return false;
        return !/<Base[^>]*\bseccion=/s.test(src);
      });

    expect(
      sinDeclarar,
      'estas páginas usan Base sin pasar `seccion`, así que se publican sin ' +
        'encabezado ni pie: quien entre no tiene cómo volver. Si alguna es a ' +
        'propósito, va en SIN_CHROME con su motivo.',
    ).toEqual([]);
  });

  it('las excepciones declaradas existen', () => {
    // Una excepción para un archivo que ya no está es una excepción que quedó
    // tapando algo distinto de lo que decía tapar.
    for (const f of Object.keys(SIN_CHROME)) expect(paginasAstro()).toContain(f);
  });
});
