import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { correrGate, pagina404 } from './fixtures/artefacto';

import {
  ACCION_NO_ENCONTRADO,
  ARCHIVO_NO_ENCONTRADO,
  BAJADA_NO_ENCONTRADO,
  BUSCAR_NO_ENCONTRADO,
  CLAVE_BUSQUEDA,
  ENLACE_NO_ENCONTRADO,
  TITULO_NO_ENCONTRADO,
  frasesDeNoEncontrado,
} from '@/lib/noEncontrado';
import { aQuery, desdeQuery, filtrosVacios, ORDEN_PUBLICO_POR_DEFECTO } from '@/lib/listadoPublico';
import { RUTA_AGENDA, RUTA_PASADAS } from '@/lib/rutasPublicas';
import type { GrupoDeExploracion } from '@/lib/hubsPublicos';

/**
 * `/404` — la página de error. B-310, §4.5 y §5.1 del diseño.
 *
 * ── Qué se fija acá y qué en otro archivo ─────────────────────────────────
 * | Qué | Dónde |
 * |---|---|
 * | que la página no esté en el sitemap y que la excepción tenga motivo | `tests/sitemap.test.ts` |
 * | que lleve encabezado y pie | `tests/chrome-del-sitio.test.ts` |
 * | que ninguna frase publique un dato de una actividad | `tests/barrido-de-salidas-publicas.test.ts` (salida 13) |
 * | que el anillo de foco no se escriba a mano | `tests/estilos-del-sitio.test.ts` |
 * | **lo de acá**: las frases, el buscador, y que el archivo se llame `404` | este archivo |
 *
 * ── Las tres cosas que se rompen sin que nada se vea ──────────────────────
 * 1. **El nombre del archivo.** Firebase sirve `dist/404.html` cuando no
 *    encuentra una dirección. Renombrar `404.astro` a `no-encontrado.astro` no
 *    rompe el build ni ningún test de contenido: simplemente se vuelve al 404 de
 *    Firebase y la página queda publicada en una URL que nadie visita.
 * 2. **El parámetro de la búsqueda.** El formulario manda a `/?q=…` porque `q` es
 *    lo que la home lee (§6.2). Escrito a mano, el día que ese nombre cambie el
 *    formulario mandaría a la agenda sin filtro y se vería igual de bien.
 * 3. **El enlace al archivo.** Es la razón de ser de la página (§4.5): el destino
 *    de un link viejo es `/pasadas`, no una pared blanca.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

const PAGINA = 'src/pages/404.astro';

/** Dos grupos de tira con texto propio, para el caso «entra y no sale». */
const GRUPOS: GrupoDeExploracion[] = [
  { rotulo: 'Tipos', enlaces: [{ ruta: '/tipo/taller/', texto: 'Talleres' }] },
  { rotulo: 'Además', enlaces: [{ ruta: RUTA_PASADAS, texto: 'Lo que ya pasó' }] },
];

describe('las frases de `/404` — B-310', () => {
  it('las cuatro salen de una sola función, que recibe los grupos', () => {
    const frases = frasesDeNoEncontrado(GRUPOS);
    expect(frases).toEqual({
      titulo: TITULO_NO_ENCONTRADO,
      bajada: BAJADA_NO_ENCONTRADO,
      archivo: ARCHIVO_NO_ENCONTRADO,
      buscar: BUSCAR_NO_ENCONTRADO,
      accion: ACCION_NO_ENCONTRADO,
      enlace: ENLACE_NO_ENCONTRADO,
    });
  });

  it('ninguna frase repite el texto de los grupos que recibió', () => {
    /*
     * La mitad falsable de la propiedad que el barrido de centinelas afirma con
     * la lista de permitidos vacía, escrita también acá porque acá se ve el
     * mecanismo: los datos están a mano y no se usan.
     *
     * MUTACIÓN PROBADA: interpolar `grupos[0]?.enlaces[0]?.texto` en la `bajada`
     * pone este caso en rojo nombrando «Talleres».
     */
    const texto = Object.values(frasesDeNoEncontrado(GRUPOS)).join(' | ');
    for (const grupo of GRUPOS) {
      expect(texto).not.toContain(grupo.rotulo);
      for (const enlace of grupo.enlaces) expect(texto).not.toContain(enlace.texto);
    }
  });

  it('todo el texto visible de la página sale de `frasesDeNoEncontrado`', () => {
    /*
     * **Lo pidió el `auditor-privacidad` sobre este mismo cambio**, y es el
     * alcance del barrido de centinelas, no su solidez: el barrido corre sobre lo
     * que devuelve `frasesDeNoEncontrado`, así que **un texto escrito en el
     * `.astro` queda afuera**. Los dos que había —«Buscar» y «Mirá el archivo»—
     * no llevaban datos y no eran una fuga; el problema era el precedente, porque
     * la frase siguiente se escribe donde ya hay una.
     *
     * Se verifica sobre el markup: ningún texto entre etiquetas que no sea una
     * interpolación. La puntuación suelta sí puede quedar (el punto que cierra la
     * oración después del enlace es del markup, no una frase).
     *
     * **Los delimitadores son `>` o `}` de un lado y `<` o `{` del otro**, y ésa
     * es la mitad que se olvida: con `>…<` a secas, un texto pegado a una
     * interpolación —`{frases.archivo} y algo más`— no matchea ninguna vez,
     * porque viene detrás de un `}`. El mismo agujero lo encontró el
     * `auditor-privacidad` en el caso gemelo de `tests/pasadas.test.ts`.
     *
     * MUTACIÓN PROBADA: devolver «Buscar» al `<button>` como literal, y escribir
     * `{frases.archivo} en el archivo` pegado a la interpolación, ponen este caso
     * en rojo nombrando el texto.
     */
    const markup = fuente(PAGINA)
      .replace(/^---[\s\S]*?^---/m, '') // el frontmatter, que es código
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ''); // los comentarios de plantilla

    /*
     * Se descarta la puntuación suelta y **lo que es atributo y no texto**: entre
     * el `}` que cierra una expresión y el `{` que abre la siguiente, adentro de
     * una etiqueta, queda el pedazo de atributos del medio (`id="q-404"
     * type="search" name=`). Un `=` es la marca de que eso no es una frase.
     */
    const esTextoDeUi = (t: string): boolean => /[\p{L}\p{N}]/u.test(t) && !/[;(){}=]/.test(t);

    const sueltos = [...markup.matchAll(/[>}]([^<>{}]+)[<{]/g)]
      .map((m) => m[1]!.replace(/\s+/g, ' ').trim())
      .filter(esTextoDeUi);

    expect(
      sueltos,
      'estos textos están escritos en la plantilla y no en `noEncontrado.ts`, así ' +
        'que el barrido de centinelas de la salida 13 no los mira.',
    ).toEqual([]);

    /*
     * Y el texto que no va entre etiquetas: el de un atributo, en sus dos formas
     * (con comillas y adentro de llaves). Mismo motivo que el caso gemelo.
     */
    for (const attr of [
      'placeholder',
      'title',
      'alt',
      'label',
      'value',
      'aria-label',
      'aria-description',
      'aria-placeholder',
    ]) {
      expect(
        markup.match(
          new RegExp(`${attr}=(?:"[^"]*[\\p{L}]|\\{\\s*['"\`][^'"\`]*[\\p{L}])`, 'gu'),
        ) ?? [],
        `\`${attr}\` con un literal: ese texto tampoco lo mira el barrido de la salida 13.`,
      ).toEqual([]);
    }
  });

  it('el título no habla del protocolo y la bajada no culpa a quien entró', () => {
    // §5.1 pide «No encontramos esa página». «Error 404» es el número de un
    // protocolo; nombrarlo es hablarle a la máquina y no a la persona.
    expect(TITULO_NO_ENCONTRADO).not.toMatch(/404|error/i);
    expect(TITULO_NO_ENCONTRADO.toLowerCase()).toContain('no encontramos');
  });

  it('la frase del archivo dice que la actividad pudo haber pasado', () => {
    // §4.5, palabra por palabra: «quizá la actividad que buscás ya pasó: mirá el
    // archivo». Es la única salida concreta que la página ofrece.
    expect(ARCHIVO_NO_ENCONTRADO.toLowerCase()).toContain('pasó');
    expect(ARCHIVO_NO_ENCONTRADO.toLowerCase()).toContain('archivo');
  });
});

describe('el buscador de `/404` es la búsqueda de la home, no una segunda — B-310', () => {
  it('`CLAVE_BUSQUEDA` es el parámetro que la home escribe y lee', () => {
    /*
     * El lazo, no el nombre: se mete el texto por el productor (`aQuery`) y se
     * saca por el consumidor (`desdeQuery`) usando la constante que el
     * formulario pone en el `name` del campo. Un renombre de un solo lado rompe
     * esto en vez de publicar un formulario que no filtra nada.
     */
    const filtros = { ...filtrosVacios(), q: 'cronica' };
    expect(aQuery(filtros, ORDEN_PUBLICO_POR_DEFECTO)).toContain(`${CLAVE_BUSQUEDA}=cronica`);
    expect(desdeQuery(`${CLAVE_BUSQUEDA}=cronica`).filtros.q).toBe('cronica');
  });

  it('el formulario es un GET a la agenda con ese parámetro, y sin island', () => {
    const src = fuente(PAGINA);
    expect(src).toMatch(/<form[^>]*method="get"/s);
    expect(src).toMatch(/<form[^>]*action=\{RUTA_AGENDA\}/s);
    expect(src).toMatch(/<input[^>]*name=\{CLAVE_BUSQUEDA\}/s);
    // Cero JavaScript: montar `Buscador` acá traería la home entera (su listado,
    // su riel y el fetch del índice) a la página de error.
    expect(src).not.toMatch(/client:(load|visible|idle|only)/);
  });

  it('el campo tiene una etiqueta de verdad, no un `placeholder`', () => {
    // §10: un `placeholder` desaparece al tipear y no es el nombre accesible del
    // control. El `for` y el `id` tienen que coincidir.
    const src = fuente(PAGINA);
    const label = /<label[^>]*for="([^"]+)"/.exec(src);
    expect(label, 'el campo de búsqueda no tiene `<label for=…>`').not.toBeNull();
    expect(src).toMatch(new RegExp(`<input[^>]*id="${label![1]}"`, 's'));
    expect(src).not.toMatch(/<input[^>]*placeholder=/s);
  });

  it('enlaza el archivo, que es el destino de un link viejo', () => {
    expect(fuente(PAGINA)).toMatch(/href=\{RUTA_PASADAS\}/);
  });
});

describe('`/404` no ve más de lo que necesita — B-310', () => {
  it('del lector importa SOLO la tira de exploración — lista blanca', () => {
    /*
     * La misma lista blanca que la home y el detalle, y por el mismo motivo: el
     * atajo `const { actividades } = await contenidoDelSitio()` compila, no
     * nombra ningún prohibido y entrega el documento proyectado entero. Acá la
     * lista es de **un** símbolo, que entrega `GrupoDeExploracion[]`: pares de
     * ruta y texto, sin una entrada de índice adentro (D-140).
     */
    const imp = /import \{([^}]*)\} from '@\/lib\/contenidoDelSitio'/.exec(fuente(PAGINA));
    expect(imp, 'la página tiene que importar del lector con llaves').not.toBeNull();
    expect(
      imp![1]!
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .sort(),
    ).toEqual(['exploracionDeLaHome']);
  });

  it('y le pasa a las frases los grupos de verdad, no una lista vacía', () => {
    /*
     * Sin esto, la premisa del barrido —«la función que arma el texto tiene los
     * datos a mano»— sería falsa: con `frasesDeNoEncontrado([])` la página no le
     * daría nada que filtrar y el barrido volvería a ser una tautología.
     */
    expect(fuente(PAGINA)).toContain('frasesDeNoEncontrado(exploracion)');
  });

  it('tampoco ve el documento crudo', () => {
    const src = fuente(PAGINA);
    for (const prohibido of ['firebase-admin', 'adminDb', 'toPublic', 'difusion', 'createdBy']) {
      expect(src, `la página de error no puede nombrar ${prohibido}`).not.toContain(prohibido);
    }
  });

  it('va con `noIndex`: §5.1 la deja fuera del índice y del sitemap', () => {
    // Las dos mitades de la misma señal. La otra —que no esté en `RUTAS_FIJAS`—
    // la fija `tests/sitemap.test.ts` con su excepción y su motivo.
    expect(fuente(PAGINA)).toMatch(/<Base[^>]*\bnoIndex\b/s);
  });
});

/**
 * ── El nombre del archivo, verificado sobre el artefacto ──────────────────
 * **Hasta el 2026-09-11 acá había un `it.skipIf(!hayBuild)` que leía
 * `dist/404.html`**, con esta frase en el docblock: «en CI el build siempre
 * corre». Era falsa, y es la misma clase que B-873 —de cuyo chequeo salió este
 * ítem, B-880—: en `deploy.yml` los tests son el paso 4 y el build el paso 5, y
 * en `push-main.yml` los tests son un job que no buildea nunca. En las dos
 * corridas `dist/` no existe cuando vitest mira.
 *
 * Medido el 2026-09-11 moviendo el `dist/` local y corriendo este archivo:
 * `Tests 13 passed | 1 skipped`, **estado 0**. Era el último skip de la suite
 * entera, y la red de contención lo contaba como cobertura.
 *
 * El chequeo vive ahora en **`scripts/verificar-bundle.sh`**, sección 4.1: el
 * paso que los dos workflows corren inmediatamente **después** del build, sobre
 * el mismo `dist/` que el paso siguiente sube a Hosting. Lo que queda de este
 * lado es manejar ese gate con `dist/` sintéticos, igual que
 * `tests/sin-comentarios-en-el-html.test.ts`. **Ningún caso de este archivo
 * depende de que exista un build**, así que ninguno se saltea nunca.
 */
describe('el gate exige que Firebase tenga qué servir como 404 — B-310, B-880', () => {
  it('un artefacto con la página pasa, y el gate dice que la reconoció', () => {
    /*
     * Control positivo, y no es decorativo: los cinco casos de abajo afirman
     * ausencias, y un barrido que solo afirma ausencias pasa igual el día que
     * deje de mirar. El recuento sale en el log de Actions a propósito.
     */
    const { estado, salida } = correrGate();
    expect(salida).toContain('404.html es la página de error');
    expect(estado, salida).toBe(0);
  });

  it('sin `404.html` es rojo — la mutación de renombrar `404.astro`', () => {
    /*
     * Firebase Hosting usa `404.html` de la raíz del directorio publicado, así
     * que este nombre no es un detalle: es el cableado entero. Astro emite `404`
     * como archivo suelto incluso con `build.format` en `directory` (su caso
     * especial para 404 y 500), o sea que no hace falta ninguna `rewrite`.
     *
     * MUTACIÓN PROBADA: renombrar `404.astro` a `no-encontrado.astro` deja el
     * build verde, el typecheck verde y todos los casos de arriba verdes —lo
     * único que se cae es el gate, y con `npm run build` de verdad.
     */
    const { estado, salida } = correrGate({ '404.html': null });
    expect(estado).not.toBe(0);
    expect(salida).toContain('404.html no existe');
    expect(salida, 'el error no nombra el ítem que lo trajo').toContain('B-310');
  });

  it('y con una `404.html` que no es ÉSTA, también', () => {
    // El nombre solo no alcanza: un `404.html` de otra cosa —el de una
    // plantilla, el de un error de build— se sirve igual y se ve como una
    // página de error, que es justo lo que hace que nadie lo mire.
    const { estado, salida } = correrGate({
      '404.html': '<!DOCTYPE html><html lang="es"><head><title>Oops</title></head><body></body></html>',
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('no es la página de error del sitio');
    expect(salida).toContain(TITULO_NO_ENCONTRADO);
  });

  it('sin el `noindex`, rojo: §5.1 la deja fuera del índice', () => {
    const { estado, salida } = correrGate({
      '404.html': pagina404().replace(/<meta name="robots"[^>]*>/, ''),
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('noindex');
  });

  it('sin el parámetro que la home lee, rojo — la trampa 2 del encabezado', () => {
    /*
     * El formulario manda a `/?q=…` porque `q` es lo que la home lee (§6.2). El
     * día que ese nombre cambie de un solo lado, el formulario mandaría a la
     * agenda sin filtro y la página se vería igual de bien.
     */
    const { estado, salida } = correrGate({
      '404.html': pagina404().replace(`name="${CLAVE_BUSQUEDA}"`, 'name="busqueda"'),
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain(CLAVE_BUSQUEDA);
  });

  it('y sin el enlace al archivo, rojo — que es la razón de ser de la página', () => {
    /*
     * §4.5: el destino de un link viejo es `/pasadas`, no una pared blanca.
     *
     * El mensaje del gate nombra la ruta **sin** la barra final, porque la
     * extrae del argumento de `rutaCanonica('/pasadas')` en el fuente y la barra
     * la pone `rutaCanonica` (B-330). El aserto va sobre esa forma, que es la
     * que el gate tiene: escribir la otra sería fijar acá una convención que
     * este archivo no decide.
     */
    const { estado, salida } = correrGate({
      '404.html': pagina404().replace(`href="${RUTA_PASADAS}"`, 'href="/"'),
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain(RUTA_PASADAS.replace(/\/$/, ''));
  });
});
