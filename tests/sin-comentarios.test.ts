/**
 * **El archivo sin sus comentarios** — el saneador de los tests sobre fuente.
 *
 * ── Por qué este archivo sobrevivió a lo que lo motivó ────────────────────
 * Nació como `huella-de-auditoria.test.ts` (B-794), fijando qué entraba en la
 * huella del sello que decidía si un cambio ya había pasado por el
 * `auditor-privacidad`: el código sí, los comentarios no. **Ese sello se
 * eliminó con D-560**, así que `huellaDeAuditoria` se fue y con ella los casos
 * que la ejercitaban.
 *
 * Lo que queda tiene un consumidor propio y bien vivo:
 * `tests/guardas-de-los-scripts.test.ts` y los demás tests que afirman sobre el
 * fuente necesitan distinguir **lo que el código hace** de **lo que un
 * comentario dice que hace**. Es una distinción con dientes: un docblock que
 * nombra la función que el test busca alcanza para que un chequeo de presencia
 * pase con el cuerpo vacío — el modo de falla que `tests/vista-del-panel.test.ts`
 * nombra en su propio docblock.
 *
 * La decisión de fondo que se conserva es la del §«se equivoca del lado seguro»:
 * esto **no es un parser** y no pretende serlo. Cuando se confunde, se confunde
 * borrando de más, que es el lado en que un test se pone rojo y alguien mira —
 * nunca el lado en que un chequeo se calla.
 */
import { describe, expect, it } from 'vitest';

import { sinComentarios } from '../scripts/sin-comentarios.mjs';

describe('qué saca: las cuatro sintaxis que aparecen en este repo', () => {
  it('el docblock y el `//` de TypeScript', () => {
    /*
     * El caso por el que existe: un test sobre fuente que busque
     * `setVistaDelPanel` no puede darse por satisfecho porque el docblock de
     * arriba lo nombre al explicar qué hace.
     */
    const fuente = [
      '/**',
      ' * Llama a `setVistaDelPanel` y además persiste la elección.',
      ' */',
      'export const elegirVista = (v) => recordar(v); // y nada más',
    ].join('\n');

    const codigo = sinComentarios(fuente);
    expect(codigo).not.toContain('setVistaDelPanel');
    expect(codigo).toContain('export const elegirVista');
    expect(codigo).not.toContain('y nada más');
  });

  it('los de JSX y los de markup, que son los de los componentes y las páginas', () => {
    /*
     * `{/* *\/}` va **como unidad y primero**: sacando solo el interior quedan
     * las llaves sueltas, y dos llaves son un cambio de código. Lo agarró el
     * caso de `Buscador.tsx`, que comenta así.
     */
    expect(sinComentarios('<p>Hola</p>\n{/* el motivo */}')).toBe('<p>Hola</p>');
    expect(sinComentarios('<!-- el motivo -->\n<p>Hola</p>')).toBe('<p>Hola</p>');
  });

  it('y el formato no cuenta: reindentar o mover saltos de línea da lo mismo', () => {
    // Un `prettier` que pase por encima no puede cambiar lo que un test lee.
    expect(sinComentarios('export const x = 1;\n\n\n    export const y = 2;')).toBe(
      sinComentarios('// viejo\nexport const x = 1;\nexport const y = 2;\n'),
    );
  });
});

describe('qué NO saca, que es lo que lo hace usable', () => {
  it('el código, aunque cambie una sola cosa', () => {
    /*
     * El control que sostiene todo lo de arriba. Si el saneador se comiera
     * código, los tests sobre fuente pasarían en silencio, que es el peor
     * resultado posible: parecen cobertura y no verifican nada.
     */
    const antes = sinComentarios('export const toPublic = (a) => ({ titulo: a.titulo });');
    const despues = sinComentarios(
      'export const toPublic = (a) => ({ titulo: a.titulo, url: a.online.url });',
    );
    expect(despues).not.toBe(antes);
    expect(despues).toContain('a.online.url');
  });

  it('el `//` de una URL', () => {
    // El error clásico de este regex, y acá tendría consecuencia: el fuente de
    // este repo está lleno de URLs (`urlDeCafecito`, el canónico, el sitemap).
    expect(sinComentarios("const u = 'https://agendaleh.ar/apoyar';")).toContain(
      'https://agendaleh.ar/apoyar',
    );
  });
});

describe('cuando se equivoca, se equivoca del lado seguro', () => {
  it('un `//` adentro de un string se lo come, y está aceptado', () => {
    /*
     * Está escrito en el módulo y se fija acá para que nadie lo lea como un bug
     * y lo «arregle» con un parser. El resultado de este error es que un test
     * sobre fuente ve **menos** código del que hay, así que falla de más y
     * alguien mira. Un parser que se equivocara al revés dejaría pasar un
     * comentario como si fuera código, y eso sí calla un chequeo.
     */
    expect(sinComentarios("const u = 'a // b';")).toBe("const u = 'a");
  });
});

/**
 * **El orden entre `//` y `/* … *\/`, que se comía código** — B-830.
 *
 * Los dos reemplazos estaban al revés, y con eso un `/*` escrito **adentro de un
 * comentario de línea** abría un bloque que corría hasta el próximo `*\/` del
 * archivo. Pasó de verdad sobre `firestore.rules`: el comentario
 * `// … escribir en /opciones/*, que es de lectura pública` se llevó **quince
 * cláusulas** de una regla de seguridad, y el barrido que consumía el resultado
 * habría pasado sin mirarlas.
 *
 * Lo que este `describe` fija es la **dirección del error**, que es lo que el
 * docblock del módulo argumenta: sacar de más es seguro cuando esto calcula una
 * huella, e **inseguro** cuando alimenta un barrido — ahí sacar de más es
 * auditar de menos.
 */
describe('el orden de los reemplazos: sacar de menos, nunca código — B-830', () => {
  it('un `/*` adentro de un comentario de línea no se lleva el código que sigue', () => {
    const src = [
      "const a = 1;",
      "// ojo: escribir en /opciones/*, que es de lectura pública",
      "const importante = 'no me borres';",
      "/* un bloque de verdad */",
      "const b = 2;",
    ].join('\n');
    const limpio = sinComentarios(src);
    expect(limpio, 'se comió el código que seguía al comentario de línea').toContain(
      "const importante = 'no me borres';",
    );
    expect(limpio).toContain('const a = 1;');
    expect(limpio).toContain('const b = 2;');
    expect(limpio, 'quedó el bloque de verdad').not.toContain('un bloque de verdad');
    expect(limpio, 'quedó el comentario de línea').not.toContain('lectura pública');
  });

  it('y el caso simétrico cae del lado seguro: deja residuo, no se lleva código', () => {
    // Un `//` adentro de un bloque: el bloque queda sin cerrar y el residuo
    // sobrevive. Un residuo hace **fallar** un barrido, no pasarlo — que es la
    // dirección correcta del error.
    const limpio = sinComentarios(['/* usar // para comentar */', "const c = 3;"].join('\n'));
    expect(limpio, 'se comió el código que seguía al bloque').toContain('const c = 3;');
  });
});
