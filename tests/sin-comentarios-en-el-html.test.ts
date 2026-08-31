import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Ningún comentario de plantilla se emite al HTML — B-261.
 *
 * ── Qué pasó ──────────────────────────────────────────────────────────────
 * Un `{/* … *\/}` puesto **entre `</head>` y `<body>`** en `Base.astro` no lo
 * elimina Astro: se emitió como **texto crudo** al documento. Un párrafo de notas
 * internas sobre `overflow-x-clip` estuvo publicado dentro de la home, servido a
 * todo el que entrara.
 *
 * Nada lo dijo. El build quedó verde, el typecheck también, ningún test miraba el
 * HTML construido y a simple vista no se nota porque el navegador lo reubica.
 * Se encontró leyendo el HTML de producción.
 *
 * ── Por qué esto y no «no uses comentarios» ───────────────────────────────
 * Los comentarios de plantilla son buenos y este repo los usa mucho. El problema
 * no es escribirlos: es **dónde**. Astro los elimina donde parsea una expresión —
 * adentro de un elemento— y los deja pasar donde no. Un chequeo sobre el fuente
 * tendría que replicar el parser de Astro para saber cuál es cuál.
 *
 * Así que se verifica **la salida**, que es la única que sabe la verdad: se lee el
 * HTML construido y se exige que no haya delimitadores de comentario sueltos
 * fuera de `<script>` y `<style>`, donde sí son legítimos.
 *
 * ── Requiere `dist/` ──────────────────────────────────────────────────────
 * Se saltea si no hay build, como los de emulador: correr `npm run build` antes.
 * En CI el build siempre corre, así que ahí no se saltea nunca.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const paginas = (): string[] => {
  try {
    return execFileSync('find', [raiz('dist'), '-name', '*.html'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
};

/** El HTML sin lo que va adentro de `<script>` y `<style>`, donde `/* *\/` es válido. */
const sinCodigo = (html: string): string =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, ''); // los comentarios HTML de verdad son otra cosa

describe('ningún comentario de plantilla llega al HTML — B-261', () => {
  const html = paginas();

  it.skipIf(html.length === 0)('el barrido encuentra páginas construidas', () => {
    // Control positivo: sin build, los asertos de abajo pasarían sin mirar nada.
    expect(html.length).toBeGreaterThan(2);
    expect(html.some((f) => f.endsWith('/index.html'))).toBe(true);
  });

  it.skipIf(html.length === 0)('no hay delimitadores de comentario sueltos en el documento', () => {
    const sucias: string[] = [];
    for (const f of html) {
      const cuerpo = sinCodigo(readFileSync(f, 'utf8'));
      for (const m of cuerpo.matchAll(/\/\*|\*\//g)) {
        const ctx = cuerpo.slice(Math.max(0, m.index! - 40), m.index! + 60).replace(/\s+/g, ' ');
        sucias.push(`${f.split('/dist/')[1]} — …${ctx}…`);
      }
    }
    expect(
      sucias.slice(0, 6),
      'esto es un comentario de plantilla emitido como texto: Astro solo los ' +
        'elimina donde parsea una expresión. Movelo al frontmatter, que es código ' +
        'y nunca se emite.',
    ).toEqual([]);
  });
});
