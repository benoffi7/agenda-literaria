import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ARCHIVO_NO_ENCONTRADO,
  BAJADA_NO_ENCONTRADO,
  BUSCAR_NO_ENCONTRADO,
  CLAVE_BUSQUEDA,
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
 * ── El nombre del archivo, verificado sobre `dist/` ───────────────────────
 * Se saltea si no hay build, como los de emulador y el de comentarios en el
 * HTML: correr `npm run build` antes. En CI el build siempre corre.
 */
describe('Firebase sirve esta página como 404 — B-310', () => {
  const dist = raiz('dist');
  const hayBuild = existsSync(dist);

  it.skipIf(!hayBuild)('el build la emite como `dist/404.html`, en la raíz', () => {
    /*
     * Firebase Hosting usa `404.html` de la raíz del directorio publicado, así
     * que este nombre no es un detalle: es el cableado entero. Astro emite `404`
     * como archivo suelto incluso con `build.format` en `directory` (su caso
     * especial para 404 y 500), o sea que no hace falta ninguna `rewrite`.
     *
     * MUTACIÓN PROBADA: renombrar `404.astro` a `no-encontrado.astro` deja el
     * build verde, el typecheck verde y todos los casos de arriba verdes —lo
     * único que se cae es este.
     */
    expect(existsSync(raiz('dist/404.html'))).toBe(true);
    // Y que sea **esta** página y no un 404 de otra cosa.
    const html = fuente('dist/404.html');
    expect(html).toContain(TITULO_NO_ENCONTRADO);
    expect(html).toMatch(/name="robots" content="noindex/);
    expect(html).toContain(`action="${RUTA_AGENDA}"`);
    expect(html).toContain(`href="${RUTA_PASADAS}"`);
  });
});
