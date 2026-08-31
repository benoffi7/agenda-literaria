import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { BAJADA, NOMBRE } from '@/lib/identidad';

/**
 * El sitio se ve de una sola manera porque lo dice **un** archivo — B-257.
 *
 * ── El bug que esto frena, que no es estético ─────────────────────────────
 * Antes de B-253 el anillo de foco —`focus-visible:outline-2
 * focus-visible:outline-offset-2 focus-visible:outline-acento`— estaba escrito
 * **doce veces** en el markup del sitio, y la clase del enlace acentuado cinco.
 * El día que una de esas copias se escriba con un typo, **un** control queda sin
 * foco visible: no lo ve nadie que use el mouse, no lo dice el compilador, no lo
 * dice ningún test de contraste, y quien navega con teclado pierde de vista dónde
 * está. Es el mismo mecanismo que este repo persigue en otros lados —dos
 * derivaciones de la misma idea que se separan sin que nada falle— aplicado a la
 * accesibilidad.
 *
 * `src/components/sitio/estilos.ts` es ahora el único lugar donde se escribe, y
 * esto lo sostiene.
 *
 * ── Y el nombre del sitio, por lo mismo (D-141) ───────────────────────────
 * «Agenda LEH» estaba escrito literal en ocho lugares y **los ocho habían quedado
 * viejos a la vez**: esa es la historia entera de D-141. `identidad.test.ts` exige
 * que cada página se **titule** con el nombre; lo que faltaba era prohibir el
 * literal en el markup, que es por donde volvería a entrar.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/**
 * El alcance, explícito y con motivo.
 *
 * `src/pages/index.astro` y `src/components/publico/*` **no entran**: son de otro
 * frente y se estaban editando en paralelo cuando esto se escribió. La regla vale
 * igual para ellos y sumarlos es una línea; lo que no se puede es marcarlos en
 * rojo sin haberlos migrado, porque un test que nace fallando se apaga.
 */
const FUERA_DE_ALCANCE: Record<string, string> = {
  'src/pages/index.astro': 'la home es de otro frente — migrarla es sumarla acá',
  'src/pages/admin.astro': 'el panel tiene su propio centralizador en campos/Campo.tsx',
};

const archivos = (): string[] =>
  execFileSync('git', ['ls-files', 'src/pages', 'src/components/sitio'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.astro'))
    .filter((f) => !(f in FUERA_DE_ALCANCE));

/**
 * El archivo **sin comentarios**, que es lo que hay que mirar para preguntar
 * «¿escribe esto a mano?».
 *
 * Los docblocks de estos componentes explican justamente por qué el anillo está
 * centralizado y qué dice el nombre accesible de la marca, así que un barrido
 * sobre el texto crudo falla contra su propia documentación — y la salida fácil
 * sería dejar de explicarlo. Es el mismo recorte que hace
 * `tests/pagina-de-detalle.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const fuente = (rel: string): string => sinComentarios(readFileSync(raiz(rel), 'utf8'));

const ESTILOS = 'src/components/sitio/estilos.ts';

describe('el anillo de foco se escribe una sola vez — B-257', () => {
  it('el barrido encuentra archivos, y las exclusiones existen', () => {
    // Control positivo: sin esto, un `git ls-files` vacío haría pasar todo.
    expect(archivos().length).toBeGreaterThan(4);
    expect(archivos()).toContain('src/pages/actividad/[slug].astro');
    const todas = execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' }).split('\n');
    for (const f of Object.keys(FUERA_DE_ALCANCE)) expect(todas).toContain(f);
  });

  it('estilos.ts lo define, y lo define una vez', () => {
    /*
     * El otro control positivo, y el que importa: si el anillo desapareciera de
     * `estilos.ts`, el barrido de abajo pasaría sobre un sitio **sin foco
     * visible en ninguna parte**, que es peor que el estado del que se viene.
     */
    const src = readFileSync(raiz(ESTILOS), 'utf8');
    expect(src).toContain('focus-visible:outline-acento');
    expect(src).toContain('export const foco');
    expect(src).toContain('export const focoAmplio');
  });

  it('ningún archivo del sitio lo vuelve a escribir a mano', () => {
    const aMano = archivos().filter((f) => /focus-visible:outline/.test(fuente(f)));

    expect(
      aMano,
      'estos archivos escriben el anillo de foco en vez de usar `foco` / `focoAmplio` ' +
        `de ${ESTILOS}. Una copia con un typo deja un control sin foco visible y nada falla.`,
    ).toEqual([]);
  });

  it('y todos los que tienen algo enfocable lo importan', () => {
    /*
     * La otra mitad. Sin esto, «no escribe el anillo a mano» también lo cumple una
     * página que **no tiene foco visible en ningún lado**, que es justo el bug.
     */
    const conEnfocables = archivos().filter((f) => /<(a|button)[\s>]/.test(fuente(f)));
    expect(conEnfocables.length).toBeGreaterThan(3);

    const sinImportar = conEnfocables.filter(
      (f) => !/from '@\/components\/sitio\/estilos'/.test(readFileSync(raiz(f), 'utf8')),
    );
    expect(
      sinImportar,
      'estos archivos tienen enlaces o botones y no importan nada de estilos.ts: o el ' +
        'foco lo pone otro componente, o quedaron sin anillo.',
    ).toEqual([]);
  });
});

describe('el nombre del sitio no se escribe literal en el markup — D-141', () => {
  it('ni el nombre ni la bajada aparecen como texto suelto', () => {
    const literales = archivos()
      .map((f) => ({ f, src: fuente(f) }))
      .filter(({ src }) => src.includes(NOMBRE) || src.includes(BAJADA))
      .map(({ f }) => f);

    expect(
      literales,
      `estos archivos escriben «${NOMBRE}» o «${BAJADA}» a mano. Van interpolados desde ` +
        '`@/lib/identidad`: ocho literales sueltos son ocho lugares donde el nombre queda ' +
        'viejo, y ya habían quedado viejos los ocho a la vez (D-141).',
    ).toEqual([]);
  });

  it('el chrome sí los muestra, desde el módulo', () => {
    /*
     * Control positivo del de arriba: «no está el literal» también lo cumple un
     * encabezado que dejó de mostrar el nombre.
     */
    const encabezado = readFileSync(raiz('src/components/sitio/Encabezado.astro'), 'utf8');
    const pie = readFileSync(raiz('src/components/sitio/PieDePagina.astro'), 'utf8');
    for (const src of [encabezado, pie]) {
      expect(src).toMatch(/from '@\/lib\/identidad'/);
      expect(src).toContain('{NOMBRE}');
      expect(src).toContain('{BAJADA}');
    }
  });
});

describe('el chrome conserva lo que no se puede sacar — B-229', () => {
  const encabezado = () => readFileSync(raiz('src/components/sitio/Encabezado.astro'), 'utf8');

  it('el salto al contenido sigue siendo el primer enfocable', () => {
    /*
     * Sin él, llegar al listado con teclado obliga a pasar por los cuatro enlaces
     * en **cada** página. Se verifica que exista y que apunte al `id` que pone
     * `Base.astro`: un salto a un ancla que no existe se ve igual de bien.
     */
    const src = encabezado();
    expect(src).toContain('Saltar al contenido');
    expect(src).toContain('href="#contenido"');
    expect(readFileSync(raiz('src/layouts/Base.astro'), 'utf8')).toContain('id="contenido"');
  });

  it('las cuatro secciones y `aria-current` siguen ahí', () => {
    const src = encabezado();
    const hrefs = [...src.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/', '/suscribirse', '/ayuda', '/contacto']);
    // `aria-current="page"` es lo que dice «estás acá» a quien no ve el color.
    expect(src).toMatch(/aria-current=\{activa === seccion \? 'page' : undefined\}/);
  });
});
