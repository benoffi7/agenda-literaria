/**
 * **Ningún documento se renderiza como código por un ` ``` ` de sobra** — B-294.
 *
 * ── El bug que este archivo existe para frenar ────────────────────────────
 * El 2026-09-07, leyendo D-461 por otro motivo, apareció que **D-460 y D-461
 * enteras** estaban adentro de un bloque de código: dos ` ``` ` huérfanos, sin
 * ninguna apertura que cerrar. En Markdown eso no es un error de sintaxis — el
 * primero **abre** un bloque y el segundo lo cierra— así que las dos decisiones se
 * renderizaban como código plano: sin tablas, sin negritas, sin links.
 *
 * Al buscar la misma cicatriz en el resto del repo aparecieron **cinco más**: un
 * ` ```md ` que envolvía siete ítems del BACKLOG (B-780 a B-786), otro con las
 * filas de B-770, otro con trece ítems viejos, y dos entradas del CHANGELOG. En
 * total, **más de cuatrocientas líneas de documentación** que nadie podía leer
 * como documentación.
 *
 * ── Por qué nada lo agarraba ──────────────────────────────────────────────
 * Es el patrón de «merge mal resuelto» que ya tenía ítem propio (**B-294**, sobre
 * filas duplicadas de una tabla) y su misma causa: texto pegado desde un
 * `.estado/*.md` **con sus propias marcas de bloque**. Y nadie lo veía porque:
 *
 * - en un editor el texto se lee igual, con o sin fence;
 * - `tests/red-de-contencion.test.ts` cuenta filas de una tabla, no fences;
 * - el `auditor-documentacion` lee el contenido, y el contenido está bien — lo
 *   que está mal es **cómo se renderiza**.
 *
 * ── Las dos mitades, y por qué hacen falta las dos ────────────────────────
 * 1. **Todo bloque cierra.** Un fence sin pareja deja el resto del archivo —a
 *    veces cien líneas, a veces mil— adentro de un bloque.
 * 2. **Ningún bloque contiene un encabezado ni una fila de tabla.** Ésta es la
 *    que agarra el daño real, porque los fences de sobra venían **en pares** y la
 *    primera mitad los veía balanceados. Un `### ` o un `| **B-` adentro de un
 *    bloque de código es documentación disfrazada de código, casi sin excepción.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raiz = (rel: string): string => `${process.cwd()}/${rel}`;

/** Los `.md` versionados. Del índice de git, no de un glob escrito a mano. */
const documentos = (): string[] =>
  execFileSync('git', ['ls-files', '-z', '*.md'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

interface Bloque {
  abre: number;
  cierra: number;
  cuerpo: string[];
}

/**
 * Los bloques cercados de un documento, y si alguno quedó abierto.
 *
 * Se sigue la regla de CommonMark que importa acá: **un fence de cierre no lleva
 * info string**. O sea que ` ```md ` adentro de un bloque abierto es contenido y
 * no lo cierra — que es exactamente lo que pasaba en el BACKLOG, donde un
 * ` ``` ` abría y el ` ```md ` de tres líneas después no cerraba nada.
 */
const bloquesDe = (texto: string): { bloques: Bloque[]; sinCerrar: number | null } => {
  const lineas = texto.split('\n');
  const bloques: Bloque[] = [];
  let abre: number | null = null;

  lineas.forEach((linea, i) => {
    if (!linea.startsWith('```')) return;
    const info = linea.trim().slice(3);
    if (abre === null) {
      abre = i + 1;
      return;
    }
    if (info) return; // contenido, no cierre
    bloques.push({ abre, cierra: i + 1, cuerpo: lineas.slice(abre, i) });
    abre = null;
  });

  return { bloques, sinCerrar: abre };
};

describe('el parseo de bloques hace lo que dice — control positivo', () => {
  it('encuentra un bloque normal', () => {
    const { bloques, sinCerrar } = bloquesDe('texto\n```ts\nconst x = 1;\n```\nmás texto');
    expect(sinCerrar).toBeNull();
    expect(bloques).toHaveLength(1);
    expect(bloques[0]!.cuerpo).toEqual(['const x = 1;']);
  });

  it('y un fence con info string NO cierra el bloque abierto', () => {
    /*
     * La regla de CommonMark que hace falta para ver el daño real. Sin esto, el
     * caso del BACKLOG —un ` ``` ` que abre y un ` ```md ` tres líneas después—
     * se leía como dos bloques chiquitos en vez de uno grande, y el encabezado
     * que estaba adentro quedaba «afuera».
     */
    const { bloques, sinCerrar } = bloquesDe('```\nY las filas:\n```md\n| a | b |\n```');
    expect(sinCerrar).toBeNull();
    expect(bloques).toHaveLength(1);
    expect(bloques[0]!.cuerpo).toEqual(['Y las filas:', '```md', '| a | b |']);
  });

  it('y avisa cuál quedó abierto', () => {
    expect(bloquesDe('texto\n```\nsin cerrar').sinCerrar).toBe(2);
  });
});

describe('ningún `.md` versionado tiene un bloque de código roto — B-294', () => {
  it('encuentra documentos de verdad', () => {
    // Sin esto, un `git ls-files` que no matchea nada deja los dos casos de abajo
    // pasando sin haber leído un solo archivo.
    expect(documentos().length, 'el índice de git no devolvió `.md`').toBeGreaterThan(10);
    expect(documentos()).toContain('docs/BACKLOG.md');
  });

  it('todos los bloques cierran', () => {
    const abiertos = documentos()
      .map((rel) => ({ rel, sinCerrar: bloquesDe(readFileSync(raiz(rel), 'utf8')).sinCerrar }))
      .filter((x) => x.sinCerrar !== null)
      .map((x) => `${x.rel}:${x.sinCerrar}`);

    expect(
      abiertos,
      'un fence sin pareja mete el resto del archivo adentro de un bloque de código',
    ).toEqual([]);
  });

  it('y ninguno contiene un encabezado o una fila de tabla del backlog', () => {
    /*
     * **La mitad que agarra el daño de verdad.** Los fences de sobra venían en
     * **pares**, así que el caso de arriba los veía balanceados; lo que delata al
     * bloque es lo que tiene adentro.
     *
     * Los dos patrones son los que aparecieron en los seis casos reales: un
     * encabezado de nivel 2 a 4 —un ítem del BACKLOG, una entrada del CHANGELOG,
     * una decisión— y una fila de tabla que arranca con un número de ítem.
     *
     * MUTACIÓN PROBADA: envolver cualquier ítem del BACKLOG en ` ``` ` deja este
     * caso en rojo nombrando el archivo, las líneas del bloque y la primera línea
     * ofensora; y **no** deja en rojo al caso de arriba, que es el punto.
     */
    const ofensores: string[] = [];
    for (const rel of documentos()) {
      const { bloques } = bloquesDe(readFileSync(raiz(rel), 'utf8'));
      for (const { abre, cierra, cuerpo } of bloques) {
        const linea = cuerpo.find((l) => /^#{2,4} /.test(l) || /^\|\s*\*\*B-\d+\*\*/.test(l));
        if (linea) ofensores.push(`${rel}:${abre}-${cierra} → «${linea.slice(0, 60)}…»`);
      }
    }

    expect(
      ofensores,
      'hay documentación adentro de un bloque de código: se renderiza como código ' +
        'plano, sin tablas, sin negritas y sin links. Es el patrón de B-294 — texto ' +
        'pegado desde un `.estado/*.md` con sus propias marcas de bloque',
    ).toEqual([]);
  });
});
