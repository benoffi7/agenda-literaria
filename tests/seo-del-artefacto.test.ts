import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — el script es .mjs sin tipos, igual que `scripts/version.mjs`.
import { problemasDeJerarquia, tituloDe } from '../scripts/seo-del-artefacto.mjs';

/**
 * Las dos propiedades del HTML indexable que decidían B-122, probadas sin build.
 *
 * ── Por qué esto y no un auditor ──────────────────────────────────────────
 * B-122 pedía «un auditor del sitio público». Al mirarlo con el criterio del
 * propio repo —un agente que repite lo que un chequeo ya frena es costo sin
 * cobertura (`docs/13-agentes.md` § El criterio)— lo que le quedaba sin red eran
 * cuatro cosas, y **dos son propiedades del artefacto**, no juicios:
 *
 * - **un `<title>` distinto por página.** Un título repetido hace que el
 *   buscador elija cuál de las dos indexar, y la que pierde deja de existir para
 *   quien busca — que es el objetivo del proyecto (§2.3). El modo de falla
 *   típico es una plantilla nueva que hereda el título del layout: la página se
 *   ve perfecta.
 * - **la jerarquía de encabezados.** Un `h1` por página y ningún nivel salteado
 *   al bajar. Es el índice con el que un lector de pantalla recorre la página, y
 *   se rompe en silencio: un `h3` con la clase del `h2` es visualmente idéntico.
 *
 * Las otras dos —el **nombre accesible** de un control y el **foco en un
 * recorrido real**— no son propiedades del HTML: hay que tabular una página
 * viva, y eso no lo hace ni un test ni un agente con `grep`. Quedan anotadas
 * como manuales en `docs/13-agentes.md`.
 *
 * ── Dónde corre cada mitad ────────────────────────────────────────────────
 * La verificación **sobre el `dist/`** es el paso 10 de
 * `scripts/build-contra-emulador.mjs`, porque necesita el HTML construido
 * (criterio de B-217: `npm test` no puede depender de un build). Este archivo
 * prueba la **decisión** —las dos funciones puras que el paso usa— con HTML
 * escrito a mano, que es lo que permite meterle los casos rotos que el sitio de
 * verdad no tiene.
 *
 * Es el mismo reparto que `functions/calendario.js`: la lógica frágil aparte de
 * la I/O, así se puede probar el caso feo.
 */
describe('el título de una página — B-122', () => {
  it('lo saca del <title>, sin los espacios de alrededor', () => {
    expect(tituloDe('<head><title>  Cartelera · Agenda LEH  </title></head>')).toBe(
      'Cartelera · Agenda LEH',
    );
  });

  it('un título partido en varias líneas es el mismo título', () => {
    // Astro puede envolver el título del layout: sin el `[\s\S]` el regex no lo
    // encuentra y la página se reporta como «sin <title>».
    expect(tituloDe('<title>\n  Ayuda —\n  Agenda LEH\n</title>')).toContain('Ayuda');
  });

  it('sin <title> devuelve null, que es lo que el paso reporta como falta', () => {
    expect(tituloDe('<html><body>nada</body></html>')).toBeNull();
  });

  it('las páginas construidas de verdad tienen títulos distintos', () => {
    /*
     * El caso sobre el árbol, no sobre un fixture: las plantillas del sitio
     * declaran su título y este caso lo lee de ahí. No reemplaza al paso 10 —que
     * mira el HTML que salió— pero atrapa la copia obvia sin necesidad de build.
     */
    const paginas = [
      'src/pages/index.astro',
      'src/pages/cartelera.astro',
      'src/pages/pasadas.astro',
      'src/pages/ayuda.astro',
      'src/pages/contacto.astro',
      'src/pages/suscribirse.astro',
    ];
    const titulos = paginas
      .map((p) => {
        try {
          return readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
        } catch {
          return null;
        }
      })
      .filter((x): x is string => x !== null)
      // El título viaja al layout como prop `titulo`; se compara el valor tal
      // cual está escrito en la plantilla.
      .map((src) => /titulo=\{?["'`]([^"'`]+)/.exec(src)?.[1])
      .filter((t): t is string => Boolean(t));

    // Control positivo: si el regex dejara de encontrarlos, la comparación de
    // abajo sería sobre una lista vacía.
    expect(titulos.length).toBeGreaterThanOrEqual(4);
    expect(new Set(titulos).size, `títulos repetidos entre páginas: ${titulos.join(' | ')}`).toBe(
      titulos.length,
    );
  });
});

describe('la jerarquía de encabezados — B-122', () => {
  it('una página sana no tiene problemas', () => {
    expect(problemasDeJerarquia('<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2>')).toEqual([]);
  });

  it('subir de nivel puede saltear: cerrar un h4 y abrir un h2 es correcto', () => {
    // Es el caso que un chequeo ingenuo reporta de más, y reportar de más es
    // cómo un chequeo se vuelve el que hay que saltear.
    expect(problemasDeJerarquia('<h1>a</h1><h2>b</h2><h3>c</h3><h4>d</h4><h2>e</h2>')).toEqual([]);
  });

  it('bajar salteando un nivel sí es un problema', () => {
    expect(problemasDeJerarquia('<h1>a</h1><h2>b</h2><h4>c</h4>')).toEqual(['salta de h2 a h4']);
  });

  it('sin h1 y con dos h1, las dos son problema', () => {
    expect(problemasDeJerarquia('<h2>a</h2><h3>b</h3>')).toContain(
      '0 <h1> (tiene que haber exactamente uno)',
    );
    expect(problemasDeJerarquia('<h1>a</h1><h1>b</h1>')).toContain(
      '2 <h1> (tiene que haber exactamente uno)',
    );
  });

  it('reporta un salto por página y no una avalancha', () => {
    // Una página con la jerarquía rota tiene el mismo arreglo sea uno o diez
    // saltos: listar diez líneas por página convierte el error en ruido.
    const problemas = problemasDeJerarquia('<h1>a</h1><h3>b</h3><h1x>x</h1x><h2>c</h2><h5>d</h5>');
    expect(problemas.filter((p: string) => p.startsWith('salta'))).toHaveLength(1);
  });

  it('no confunde un `<h1>` con `<header>` ni con `<hr>`', () => {
    // El `\b` del regex es lo que lo sostiene: sin él, `<hr>` y `<header>` no
    // matchean pero `<h1x>` sí, y el conteo de h1 saldría mal.
    expect(problemasDeJerarquia('<header><hr><h1>a</h1></header>')).toEqual([]);
  });
});

describe('el gate consume estas decisiones y no tiene su propia copia', () => {
  /*
   * La lección que B-180 dejó escrita al extraer `emuladores-arriba.sh`:
   * **extraer la decisión y dejar la copia adentro es peor que no extraerla**,
   * porque habría dos y la que se testea no sería la que corre. Sin este caso,
   * todo lo de arriba puede estar en verde mientras el paso 10 del gate usa un
   * regex propio.
   *
   * MUTACIÓN PROBADA: pegar de vuelta las dos funciones adentro de
   * `build-contra-emulador.mjs` y sacar el import hace fallar este caso.
   */
  const gate = readFileSync(
    fileURLToPath(new URL('../scripts/build-contra-emulador.mjs', import.meta.url)),
    'utf8',
  );

  it('el gate importa `tituloDe` y `problemasDeJerarquia` del módulo', () => {
    expect(gate).toMatch(
      /import \{[^}]*problemasDeJerarquia[^}]*\} from '\.\/seo-del-artefacto\.mjs'/,
    );
    expect(gate).toMatch(/import \{[^}]*tituloDe[^}]*\} from '\.\/seo-del-artefacto\.mjs'/);
  });

  it('y no las define de nuevo', () => {
    expect(gate).not.toMatch(/const (tituloDe|problemasDeJerarquia)\s*=/);
    // Ni reimplementa el regex de los encabezados por su cuenta.
    expect(gate).not.toContain('<h([1-6])');
  });
});
