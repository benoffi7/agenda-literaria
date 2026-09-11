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
 * ── La doctrina que este archivo fijaba, y que B-853 dio vuelta ───────────
 * Hasta B-853 acá decía que esto «no es un parser y cuando se confunde borra de
 * más, que es el lado en que un test se pone rojo y alguien mira». **Media frase
 * sigue siendo cierta y la otra media era falsa, y la falsa es la que costó
 * plata.** Los consumidores preguntan las dos cosas:
 *
 * - un barrido de privacidad pregunta `not.toContain('online.url')`, y ahí
 *   borrar de más **pasa sin mirar nada**;
 * - un chequeo de presencia pregunta `toContain('setVistaDelPanel')`, y ahí
 *   dejar residuo de comentario **pasa con el cuerpo vacío**.
 *
 * O sea que no hay un lado seguro al que apostar: hay que **no equivocarse**, y
 * por eso el saneador dejó de ser cuatro `replace` sueltos y pasó a ser un
 * recorrido único. Lo que sí se elige es qué pasa con lo que igual se escape, y
 * ahí el criterio es el de `docs/05-patrones.md` §«Verificar la clase»: el
 * residuo es un error **acotado** al comentario que lo produjo y borrar código
 * es un error **sin cota** — B-853 se llevó el 83% de `Buscador.tsx`.
 *
 * El último `describe` es el que sostiene esa elección sin depender de que a
 * alguien se le ocurra el caso: compara contra el **parser de TypeScript** sobre
 * todos los `.ts`/`.tsx`/`.mjs`/`.js` del repo, y desde B-876 también sobre el
 * frontmatter de los `.astro` — que son justamente los que leen los tests sobre
 * páginas. Hasta dónde llega esa segunda mitad está escrito ahí.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { sinComentarios, sinComentariosConFormato } from '../scripts/sin-comentarios.mjs';

/**
 * El frontmatter de un `.astro`: lo que va entre los dos `---`, que es la parte
 * que el parser de TypeScript entiende. Mismo recorte que usa
 * `tests/pagina-de-detalle.test.ts`.
 */
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

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
     * `{/* *\/}` va **como unidad**: sacando solo el interior quedan las llaves
     * sueltas, y dos llaves son un cambio de código. Lo agarró el caso de
     * `Buscador.tsx`, que comenta así.
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

/**
 * **Las dos salidas del módulo, y cuál es el default** — B-855.
 *
 * El módulo exporta dos cosas y eso es una decisión, no un detalle: la que elige
 * el que escribe `sinComentarios(src)` sin pensarlo es la que va a estar en los
 * tests que vengan. El default colapsa el espacio en blanco, y por eso
 * reindentar no puede poner en rojo un aserto que no tiene nada que ver.
 * `sinComentariosConFormato` es para el caso contrario y más frágil —cuando el
 * aserto usa la **forma** a propósito— y se pide por nombre justamente para que
 * sea una elección y no una herencia.
 *
 * Los dos casos de abajo son lo que impide que las salidas se separen: el
 * primero fija que una es la otra más el colapso —así el control de clase del
 * final, que corre sobre el default, vale para las dos— y el segundo fija la
 * **única** diferencia, que es la que el consumidor de la variante necesita.
 */
describe('las dos salidas: `sinComentarios` es la variante más el colapso', () => {
  // La forma real: `cerrarPanel` vive adentro del componente, así que su `};` de
  // cierre está indentado dos espacios — que es el delimitador del que depende
  // el recorte de `tests/listado-del-sitio.test.ts`.
  const CON_FORMA = [
    '  const cerrarPanel = () => {',
    '    entradaPropia.current = false;',
    '    window.history.back();',
    '  };',
  ].join('\n');

  const RECORTE = /const cerrarPanel = \(\) => \{[\s\S]*?\n  \};/;

  it('el default no agrega ni saca nada: es la variante colapsada', () => {
    /*
     * Lo que hace que no haya dos saneadores. Si alguien arreglara un caso en
     * uno solo, esto se pone rojo antes de que la divergencia llegue a un test
     * sobre fuente — que es el modo de falla que B-855 vino a cerrar, con dos
     * recortes locales que ya se habían separado del compartido.
     *
     * MUTACIÓN PROBADA: hacer que `sinComentarios` recorra por su cuenta (un
     * `replace` de bloques más el colapso) deja este caso en rojo; sacarle el
     * `.trim()` también.
     */
    for (const fuente of [
      CON_FORMA,
      '/** doc */\nexport const f = () => 1; // y nada más',
      '<!-- nota -->\n<p>Hola</p>\n{/* otra */}',
      "const u = 'a // b';\n\n  const v = 2;",
    ]) {
      expect(sinComentarios(fuente)).toBe(
        sinComentariosConFormato(fuente).replace(/\s+/g, ' ').trim(),
      );
    }
  });

  it('y la variante conserva el salto y la indentación, que es para lo que existe', () => {
    /*
     * El consumidor es `tests/listado-del-sitio.test.ts`, que recorta el cuerpo
     * de una función con `\n  };` — la indentación de cierre como delimitador
     * de bloque. Acá está el mismo recorte en chico, para que la propiedad
     * tenga dueño en el módulo y no solo en el test que la usa.
     *
     * MUTACIÓN PROBADA: hacer que la variante colapse también deja el `exec` en
     * `null` y este caso en rojo — es literalmente el fallo que se midió antes
     * de separar las dos salidas.
     */
    const limpio = sinComentariosConFormato(`// arriba\n${CON_FORMA}`);
    const m = RECORTE.exec(limpio);
    expect(m, 'la variante perdió la forma del bloque').not.toBeNull();
    expect(m![0]).toContain('window.history.back()');
    // Y la mitad negativa, que es la que explica por qué hay dos: sobre el
    // default el mismo recorte no encuentra nada.
    expect(RECORTE.exec(sinComentarios(CON_FORMA))).toBeNull();
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
    /*
     * El error clásico de este regex, y acá tendría consecuencia: el fuente de
     * este repo está lleno de URLs (`urlDeCafecito`, el canónico, el sitemap).
     *
     * La URL **entre comillas** ya la cubre el tratamiento de strings, así que
     * la que le queda al `(?<!:)` es la URL **desnuda** del markup de un
     * `.astro`. Hoy no hay ninguna (verificado con `grep`), y por eso la guarda
     * se conserva: cuesta cuatro caracteres y el día que alguien escriba una
     * dirección en el cuerpo de una página no se lleva media línea.
     *
     * MUTACIÓN PROBADA: sacar el `(?<!:)` de `TOKENS` deja el segundo caso en
     * `<p>Escribinos a https:` y lo pone rojo. El primero sobrevive igual,
     * porque lo sostiene el string.
     */
    expect(sinComentarios("const u = 'https://agendaleh.ar/apoyar';")).toContain(
      'https://agendaleh.ar/apoyar',
    );
    expect(sinComentarios('<p>Escribinos a https://agendaleh.ar/apoyar</p>')).toContain(
      'https://agendaleh.ar/apoyar</p>',
    );
  });
});

/**
 * **La familia entera de «una apertura falsa se come hasta el próximo cierre»**
 * — B-830 y B-853.
 *
 * Las tres instancias tienen la misma forma: una pasada global ve como apertura
 * de comentario algo que en realidad vive **adentro de otra construcción**, y
 * como el `[\s\S]*?` no para en el cierre propio sino en el próximo del archivo,
 * el destrozo no tiene cota. Lo que las junta en un solo `describe` es que las
 * tres las cierra el mismo cambio de diseño —un recorrido único de izquierda a
 * derecha, donde en cada posición gana una construcción y se consume completa—
 * y no tres regex distintos.
 *
 * Los dos primeros casos son B-830 (`firestore.rules`, quince cláusulas de una
 * regla de seguridad). El tercero es B-853, y es el que demuestra que invertir
 * el orden de dos pasadas no era el arreglo: **arregló uno de los tres y dejó
 * los otros dos**.
 */
describe('una apertura falsa no se come el archivo — B-830, B-853', () => {
  it('un `/*` adentro de un comentario de línea no se lleva el código que sigue', () => {
    /*
     * MUTACIÓN PROBADA: poner la pasada de `/* … *\/` antes que la de `//` —el
     * estado anterior a B-830— hace que este caso pierda `const importante`.
     */
    const src = [
      'const a = 1;',
      '// ojo: escribir en /opciones/*, que es de lectura pública',
      "const importante = 'no me borres';",
      '/* un bloque de verdad */',
      'const b = 2;',
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

  it('y el caso simétrico ya no deja ni residuo: el `//` de adentro de un bloque es texto', () => {
    /*
     * Antes esto dejaba un `/*` sin cerrar y eso estaba **documentado como
     * aceptable**, porque un residuo hace fallar un barrido en vez de pasarlo.
     * Con el recorrido único el bloque se consume entero y no queda nada, así
     * que el caso pasa de «acotado» a «correcto».
     *
     * MUTACIÓN PROBADA: sacar `/\*[\s\S]*?\*\/` de `TOKENS` deja el comentario
     * completo en la salida y `not.toContain('para comentar')` se pone rojo.
     */
    const limpio = sinComentarios(['/* usar // para comentar */', 'const c = 3;'].join('\n'));
    expect(limpio).toBe('const c = 3;');
  });

  it('un `{` seguido del docblock de su primer miembro NO es un comentario de JSX — B-853', () => {
    /*
     * **El caso que costó el 83% de `Buscador.tsx`.** El patrón de JSX era
     * `\{\s*\/\*[\s\S]*?\*\/\s*\}`: ese `\s*` deja que `interface Props {` más el
     * docblock de `version` sea una apertura válida, y como el cierre exige el
     * `*\/` **pegado** a un `}`, la búsqueda no para en el `*\/` del docblock —
     * sigue hasta el primer `*\/}` del archivo. En `Buscador.tsx` estaba 464
     * líneas más abajo, y con él se fueron `export function Buscador` y dos de
     * las tres llamadas a `medirSitio`.
     *
     * MUTACIÓN PROBADA: reponer en `TOKENS` la alternativa vieja
     * `\{\s*\/\*[\s\S]*?\*\/\s*\}` **antes** que la del bloque hace desaparecer
     * `export function Buscador` y pone rojo este caso — y también el control de
     * clase del final. Lo que lo arregla no es un `\s*` de menos: es que el token
     * de bloque termina en **su propio** `*\/`, así que ya no hay forma de que la
     * búsqueda del `}` arrastre lo que hay en el medio.
     */
    const src = [
      'interface Props {',
      '  /**',
      '   * La versión del build. Va como `?v=` del fetch.',
      '   */',
      '  version: string;',
      '}',
      '',
      'export function Buscador({ version }: Props) {',
      "  return <p>{/* el riel */}{version}</p>;",
      '}',
    ].join('\n');

    const limpio = sinComentarios(src);
    expect(limpio, 'se comió el cuerpo del componente').toContain('export function Buscador');
    expect(limpio).toContain('version: string;');
    expect(limpio, 'quedó el docblock de la propiedad').not.toContain('La versión del build');
    expect(limpio, 'quedó el comentario de JSX').not.toContain('el riel');
    // Y el comentario de JSX se fue **con** sus llaves: dos llaves sueltas son
    // un cambio de código para cualquier barrido que cuente delimitadores.
    expect(limpio).toContain('<p>{version}</p>');
  });

  it('y un `{ /* … */ }` con espacios conserva las llaves, porque no es JSX', () => {
    /*
     * La otra mitad de exigir el `{` pegado: en este repo los comentarios de JSX
     * se escriben siempre `{/*` (verificado con `grep` sobre `src/`), así que la
     * adyacencia distingue el comentario de JSX de un objeto vacío con una nota
     * adentro. Comerse **esas** llaves sí sería cambiar el código.
     *
     * MUTACIÓN PROBADA: aceptar `\s*` entre el `{` y el `/*` (y entre el `*\/` y
     * el `}`) devuelve `const o = ;`, o sea un objeto vacío convertido en un
     * error de sintaxis.
     */
    expect(sinComentarios('const o = { /* nada por ahora */ };')).toBe('const o = { };');
  });
});

/**
 * **Los strings se conservan**, que es la otra mitad del mismo agujero.
 *
 * Un `//` o un `*\/` escrito adentro de un string no es un comentario, y hasta
 * B-853 el saneador no podía verlo: `'a // b'` volvía como `'a`. Estaba escrito
 * como «se equivoca del lado seguro», y para un barrido de privacidad ese lado
 * es el inseguro — es exactamente borrar de más.
 */
describe('un `//` o un `*/` adentro de un string es texto, no comentario', () => {
  it('el `//` de un string sobrevive', () => {
    // MUTACIÓN PROBADA: sacar las tres alternativas de comillas de `TOKENS`
    // devuelve `const u = 'a`, que es el comportamiento viejo.
    expect(sinComentarios("const u = 'a // b';")).toBe("const u = 'a // b';");
  });

  it('un `/*` de un string no abre nada, y un `*/` de un string no cierra nada', () => {
    // El orden importa para que el caso muerda: la apertura falsa **primero** y
    // el cierre falso después, con código en el medio. Al revés no hay nada que
    // comerse y el caso pasa aunque el saneador ignore los strings.
    // MUTACIÓN PROBADA: sacar las tres alternativas de comillas de `TOKENS` se
    // lleva `const enElMedio` entero.
    const src = [
      "const apertura = '/*';",
      "const enElMedio = 'no me borres';",
      "const cierre = '*/';",
    ].join('\n');
    expect(sinComentarios(src), 'el string se leyó como delimitador de comentario').toBe(
      "const apertura = '/*'; const enElMedio = 'no me borres'; const cierre = '*/';",
    );
  });

  it('una comilla suelta no puede abrir un string que cruce el archivo', () => {
    /*
     * La cota del error del lado del residuo: las comillas simples y dobles no
     * cruzan el salto de línea, así que un apóstrofo en prosa de markup pierde
     * como mucho una línea de saneado — nunca medio archivo.
     *
     * MUTACIÓN PROBADA: sacar el `\n` de las clases negadas de las comillas hace
     * que el docblock de abajo se conserve entero y el `not.toContain` se ponga
     * rojo.
     */
    const src = [
      "<p>Taller de rock 'n roll</p>",
      '/* el motivo verdadero */',
      "<p>Club de lectura d'Annunzio</p>",
    ].join('\n');
    expect(sinComentarios(src)).not.toContain('el motivo verdadero');
  });
});

/**
 * **El control de clase: contra el parser de TypeScript, sobre el repo entero.**
 *
 * Los casos de arriba fijan las instancias conocidas. Esto fija la **propiedad**,
 * que es lo que B-853 no tenía: el saneador puede tirar comentarios, pero no
 * puede hacer desaparecer un identificador que el parser de TypeScript dice que
 * es código. Es el chequeo que habría gritado el día que `Buscador.tsx` empezó a
 * volver sin `export function Buscador`, en vez de esperar a que alguien midiera.
 *
 * Cumple las tres propiedades de `docs/05-patrones.md` §«Verificar la clase»:
 * la lista **se deriva** (`git ls-files`, así que un archivo nuevo entra solo),
 * no se puede satisfacer sin arreglar nada, y el saneador dice en su docblock
 * qué lo haría fallar — un literal de expresión regular con `//` o `/*` adentro,
 * que es lo único que un recorrido por texto no puede distinguir de un
 * comentario. Ese día esto se pone rojo y hay que venir a decidir acá.
 *
 * ── Dos familias, porque los `.astro` no son `.ts` — B-876 ─────────────────
 * Hasta B-876 esto recorría **solo** los `.ts/.tsx/.mjs/.js`, y los `.astro`
 * quedaban afuera — justo los que leen `tests/pagina-de-detalle.test.ts` y
 * `tests/listado-del-sitio.test.ts` con el saneador compartido, más otros ocho
 * con recortes locales. O sea que los archivos con red eran los que ningún test
 * sobre fuente miraba tanto.
 *
 * Extenderlo daba rojo con el árbol de entonces, y por un caso real: el
 * `og:image` de `src/layouts/Base.astro` se decidía con `/^https?:\/\//i`, cuyo
 * `\/\/` **contiene el par `//`**. El saneador lo leía como comentario de línea
 * y se comía el ternario entero. Era el **único** ofensor entre los 28 `.astro`
 * de `src/`, medido, y se cerró escribiendo el predicado sin el par (`\/{2}`) en
 * vez de enseñarle al saneador a lexear expresiones regulares — que es lo que el
 * módulo ya argumentó que no vale la pena: necesita el token anterior, o sea
 * medio parser de JavaScript, que además no serviría para `firestore.rules`.
 */
describe('control de clase: el saneador no borra código, sobre todo el repo', () => {
  /** Los archivos versionados de las cuatro carpetas que tienen código. */
  const versionados = (extensiones: RegExp): string[] =>
    execFileSync('git', ['ls-files', 'src', 'scripts', 'functions', 'tests'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => extensiones.test(f));

  /**
   * Los identificadores que el parser de TypeScript ve como **código** en un
   * texto. `.mjs` se le pasa con nombre de `.js` y el frontmatter de un `.astro`
   * con nombre de `.ts`: en los dos casos es para que TypeScript no aplique las
   * reglas de lexado de otra extensión sobre el mismo contenido.
   */
  const identificadores = (nombre: string, src: string): Set<string> => {
    const sf = ts.createSourceFile(nombre, src, ts.ScriptTarget.Latest, true);
    const ids = new Set<string>();
    const recorrer = (n: ts.Node): void => {
      if (ts.isIdentifier(n)) ids.add(n.text);
      n.forEachChild(recorrer);
    };
    recorrer(sf);
    return ids;
  };

  /**
   * Qué archivos perdieron un identificador al pasar por el saneador.
   *
   * `codigo` dice qué parte del archivo entiende el parser; el saneado se corre
   * siempre sobre el **archivo entero**, que es lo que hacen los consumidores —
   * así una apertura falsa que arranca en una parte y se come la otra queda
   * adentro del chequeo.
   */
  const ofensores = (
    archivos: string[],
    codigo: (archivo: string, src: string) => { nombre: string; texto: string },
    leer: (archivo: string) => string = (f) => readFileSync(f, 'utf8'),
  ): string[] =>
    archivos
      .map((archivo) => {
        const src = leer(archivo);
        const { nombre, texto } = codigo(archivo, src);
        const limpio = sinComentarios(src);
        const faltan = [...identificadores(nombre, texto)].filter((i) => !limpio.includes(i));
        return { archivo, faltan };
      })
      .filter((o) => o.faltan.length > 0)
      .map((o) => `${o.archivo}: ${o.faltan.slice(0, 5).join(', ')}`);

  const EXPLICACION =
    'el saneador borró código, no comentarios: cualquier test que lea estos ' +
    'archivos está afirmando sobre menos de lo que hay (B-853)';

  it('ningún identificador que el parser de TypeScript ve como código desaparece', () => {
    const archivos = versionados(/\.(ts|tsx|mjs|js)$/);

    expect(archivos.length, 'no se listó ningún archivo: el `git ls-files` falló').toBeGreaterThan(
      100,
    );

    expect(
      ofensores(archivos, (archivo, src) => ({
        nombre: archivo.replace(/\.mjs$/, '.js'),
        texto: src,
      })),
      EXPLICACION,
    ).toEqual([]);
  });

  /**
   * **Lo mismo sobre los `.astro`, y hasta dónde llega — B-876.**
   *
   * Un `.astro` es **frontmatter + plantilla**, y el parser de TypeScript solo
   * entiende la primera parte: la segunda es markup con expresiones adentro de
   * `{…}` y necesitaría el parser de Astro. Así que este caso dice, exactamente:
   *
   * | | ¿entra? |
   * |---|---|
   * | el saneado | el **archivo entero**, igual que los consumidores |
   * | los identificadores que se buscan | los del **frontmatter** |
   * | las expresiones `{…}` de la plantilla | **no** |
   *
   * Que el saneado sea del archivo entero es lo que hace que la mitad cubierta
   * valga de verdad: el caso de `Base.astro` era una apertura falsa **en el
   * frontmatter**, y las aperturas falsas no respetan el `---`. Lo que queda
   * afuera es un `//` o un `/*` escrito adentro de una expresión de la plantilla
   * — poco denso (las de este repo son `{titulo}`, `{conChrome && …}`) pero no
   * imposible. Está escrito acá y no prometido de más: un control que mira menos
   * de lo que dice es la falta de B-873.
   *
   * Y no se puede volver vacío en silencio: si el frontmatter deja de
   * encontrarse en algún archivo, ese archivo va a la lista de `sinFrontmatter`
   * en vez de saltearse.
   */
  it('ni en el frontmatter de los `.astro`, que es lo que leen los tests sobre páginas — B-876', () => {
    const archivos = versionados(/\.astro$/);

    expect(archivos.length, 'no se listó ningún `.astro`: el `git ls-files` falló').toBeGreaterThan(
      20,
    );

    const sinFrontmatter = archivos.filter((f) => !FRONTMATTER.test(readFileSync(f, 'utf8')));
    expect(
      sinFrontmatter,
      'sin frontmatter no hay nada que parsear, y saltearlos en silencio dejaría ' +
        'el control mirando menos archivos de los que dice (B-873)',
    ).toEqual([]);

    expect(
      ofensores(archivos, (archivo, src) => ({
        nombre: `${archivo}.ts`,
        texto: FRONTMATTER.exec(src)![1]!,
      })),
      EXPLICACION,
    ).toEqual([]);
  });

  /**
   * **Control positivo: el chequeo de arriba tiene dientes.**
   *
   * Un barrido que compara dos listas puede quedar verde porque no encuentra
   * nada **y** porque no busca nada, y desde afuera se ven igual — es la forma
   * de B-873. Así que acá se le pasa al mismo mecanismo el frontmatter que
   * `Base.astro` tenía antes de B-876 y se exige que lo marque.
   *
   * MUTACIÓN PROBADA: es literalmente la línea que se revirtió para medir. Con
   * `\/\/` en `src/layouts/Base.astro`, el caso de los `.astro` de arriba da
   * `['src/layouts/Base.astro: test']` — **un solo** identificador, porque en el
   * archivo de verdad `urlAbsoluta` sobrevive gracias a la línea de la canónica,
   * unas líneas más arriba. Acá, con el recorte solo, se pierden los dos: es el
   * recordatorio de que este control detecta por **desaparición total** del
   * identificador, así que un nombre repetido en otra línea tapa el destrozo.
   */
  it('control positivo: el `\\/\\/` de un literal de regex lo marca como ofensor — B-876', () => {
    const COMO_ESTABA = [
      '---',
      "const paraOg = imagen ?? '/compartir.png';",
      'const ogImagen = /^https?:\\/\\//i.test(paraOg) ? paraOg : urlAbsoluta(paraOg);',
      '---',
      '<meta property="og:image" content={ogImagen} />',
    ].join('\n');

    expect(
      ofensores(
        ['Base.astro'],
        (archivo, src) => ({ nombre: `${archivo}.ts`, texto: FRONTMATTER.exec(src)![1]! }),
        () => COMO_ESTABA,
      ),
      'el control no vio desaparecer el `.test(…)` que el saneador se come',
    ).toEqual(['Base.astro: test, urlAbsoluta']);

    // Y la mitad que explica por qué: el saneado corta la línea en el par `//`.
    expect(sinComentarios(COMO_ESTABA)).not.toContain('urlAbsoluta(paraOg)');
    // La forma de hoy, en cambio, sobrevive entera.
    expect(sinComentarios(COMO_ESTABA.replace('\\/\\/', '\\/{2}'))).toContain(
      'urlAbsoluta(paraOg)',
    );
  });
});
