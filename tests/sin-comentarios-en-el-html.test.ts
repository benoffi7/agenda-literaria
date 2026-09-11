import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { RAIZ, correrGate, paginaLimpia } from './fixtures/artefacto';

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
 * ── El barrido ya no vive acá, y el motivo es B-873 ───────────────────────
 * **Hasta el 2026-09-11 este archivo leía el `dist/` del repo y se salteaba si no
 * estaba**, con esta frase escrita en el docblock: «en CI el build siempre corre,
 * así que ahí no se saltea nunca». Era falsa, y medida contra los dos workflows:
 *
 * | dónde | qué pasa |
 * |---|---|
 * | `deploy.yml`, job `deploy` | `Tests` es el paso 4 y `Build` el paso 5 |
 * | `push-main.yml`, job `verificar` | corre `npm test` y no buildea nunca |
 * | `push-main.yml`, job `hosting` | buildea, en **otro** runner |
 *
 * O sea que `dist/` no existía en ninguna de las dos corridas donde vitest mira.
 * Reproducido moviendo el `dist/` local: la suite sale **verde con los casos
 * salteados y estado 0**, sin decir una palabra. Un `skipIf` que se saltea en
 * silencio es peor que no tener el chequeo, porque la red de contención lo cuenta
 * como cobertura — y encima el docblock afirmaba la cobertura que no existía, que
 * es lo que hizo que nadie lo notara en meses.
 *
 * El barrido está ahora en **`scripts/verificar-bundle.sh`**, sección 3: el paso
 * que los dos workflows corren inmediatamente **después** del build, sobre el
 * mismo `dist/` que el paso siguiente sube a Hosting. Lo que queda acá es probar
 * ese barrido, manejando el script con artefactos sintéticos — igual que
 * `tests/que-deployar.test.ts` maneja el suyo. **Ningún caso de este archivo
 * depende de que exista un build**, así que ninguno se saltea nunca.
 */
describe('el gate atrapa un comentario de plantilla emitido al HTML — B-261', () => {
  it('un artefacto limpio pasa, y dice cuántas páginas barrió', () => {
    /*
     * Control positivo, y es el que le faltaba al chequeo viejo: sin una señal de
     * que el barrido tuvo algo que mirar, «verde» y «no verificó nada» se ven
     * idénticos. El recuento sale en el log de Actions a propósito.
     */
    const { estado, salida } = correrGate();
    // Tres desde B-880: la base del fixture gana la `404.html` que la sección 4
    // del gate exige, y el recuento la cuenta como la página que es.
    expect(salida).toContain('barrido: 3 páginas');
    expect(estado, salida).toBe(0);
  });

  it('un `{/* … */}` entre `</head>` y `<body>` lo pone en rojo, con el archivo', () => {
    /*
     * La forma exacta de B-261: el comentario no está adentro de ningún elemento,
     * así que Astro no lo parsea como expresión y lo emite crudo.
     */
    const { estado, salida } = correrGate({
      'index.html':
        '<!DOCTYPE html><html lang="es"><head><title>Agenda</title></head>' +
        '{/* nota interna sobre overflow-x-clip */}' +
        '<body><h1>Agenda</h1></body></html>',
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('un comentario de plantilla se emitió como texto al HTML (B-261)');
    expect(salida, 'el error no dice en qué página está').toContain('index.html');
    expect(salida, 'el error no muestra el texto que se publicó').toContain('overflow-x-clip');
  });

  it('y también si sale en una página que no es la home', () => {
    // El barrido recorre el árbol entero, no solo la raíz: el layout es
    // compartido, pero una plantilla de detalle tiene su propio comentario.
    const { estado, salida } = correrGate({
      'ayuda/index.html': `${paginaLimpia('Ayuda')}\n{/* pendiente: revisar */}`,
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('ayuda/index.html');
  });

  it('los `/* */` adentro de `<script>` y de `<style>` no lo ensucian', () => {
    /*
     * Es la razón por la que el barrido sanea antes de buscar. Sin esto el
     * chequeo sería rojo en cualquier página con un script comentado, o sea que
     * se aprendería a ignorar — que es la otra forma de no tener chequeo.
     */
    const { estado, salida } = correrGate({
      'index.html':
        '<!DOCTYPE html><html lang="es"><head><title>Agenda</title>' +
        '<style>/* la grilla del listado */ main{display:grid}</style></head>' +
        '<body><h1>Agenda</h1><script>/* el filtro en memoria */ const f=1;</script></body></html>',
    });
    expect(estado, salida).toBe(0);
  });

  it('un comentario HTML de verdad tampoco: es otra cosa', () => {
    const { estado, salida } = correrGate({
      'index.html': paginaLimpia('Agenda').replace('<body>', '<body><!-- comentario HTML -->'),
    });
    expect(estado, salida).toBe(0);
  });

  it('un artefacto sin una sola página es ROJO, no verde — la guarda de B-873', () => {
    /*
     * **El aserto que cierra el agujero.** Un barrido sobre cero páginas pasa
     * todos los `expect` que se le pongan: es exactamente la forma en que este
     * chequeo estuvo mintiendo. Que «no hay nada que mirar» sea un fallo es lo
     * que distingue «el artefacto está limpio» de «el artefacto no se miró».
     */
    const { estado, salida } = correrGate({
      'index.html': null,
      'ayuda/index.html': null,
      // La tercera de la base, desde B-880. Sin sacarla también, «cero páginas»
      // dejaría de ser cero y este caso probaría otra cosa.
      '404.html': null,
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('no tiene ninguna página HTML');
    expect(salida).toContain('B-873');
  });

  it('y un directorio que no existe también — la condición exacta del CI viejo', () => {
    /*
     * Es el caso que en CI se saltaba en silencio: no hay `dist/` porque el build
     * todavía no corrió. Del lado del gate eso no puede ser verde, porque el gate
     * corre *después* del build: si no está, algo se rompió.
     */
    const r = spawnSync('./scripts/verificar-bundle.sh', ['dist-que-no-existe'], {
      cwd: RAIZ,
      encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
    expect(`${r.stdout}${r.stderr}`).toContain('no existe dist-que-no-existe');
  });
});
