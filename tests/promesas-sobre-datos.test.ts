/**
 * **Ninguna página del sitio promete sobre datos algo que el sitio contradice** —
 * B-781.
 *
 * ── De dónde sale este archivo ─────────────────────────────────────────────
 * `/apoyar` decía «no se guarda quién entró». Era **falso**: en la misma pantalla
 * está el banner de `AvisoDeCookies` diciendo que el sitio usa Google Analytics,
 * y con el consentimiento aceptado sale un `page_view` con su client-id (la
 * salida 12 del §5 de `docs/07-seguridad.md`). Lo encontró el
 * `auditor-privacidad`, se corrigió, y quedó un caso en
 * `tests/apoyo-del-sitio.test.ts` que prohíbe volver — **pero solo en esa
 * página**.
 *
 * Este archivo es el barrido general, y existe porque el caso de `/apoyar` mostró
 * que la afirmación **puede nacer falsa**, no solo envejecer. Son páginas
 * indexadas, escritas a mano, que hablan de tratamiento de datos: la única cosa
 * del sitio cuyo valor entero es que se le crea.
 *
 * ── Qué barre, y por qué la lista no está escrita a mano ───────────────────
 * Los archivos salen de **globs**, no de una lista: todo `src/lib/*DelSitio.ts`,
 * todas las páginas de `src/pages/` y los componentes de `src/components/sitio/`.
 * Una lista escrita a mano deja afuera la página que se escriba mañana, que es
 * exactamente el modo de falla que B-781 describe (`/apoyar` nació con la frase
 * falsa: el barrido tiene que agarrar a la página nueva sin que nadie lo agregue).
 *
 * `src/lib/ayuda.ts` **no** entra, y no es un olvido: es la ayuda del **panel de
 * admin**, no del sitio público. Ahí «la dirección no se guarda ni se publica» es
 * una afirmación sobre el formulario, verdadera, y no una promesa a un visitante.
 *
 * ── La regla, dicha en una línea ───────────────────────────────────────────
 * Una negación sobre medición o datos del visitante es un hallazgo **salvo que la
 * misma frase la condicione** («solo si lo aceptás», «hasta que elijas») **o la
 * acote** («para anotarte», «tu dirección»). Las dos escapatorias están acá abajo
 * con su motivo, y las dos se verifican en los dos sentidos: que el detector
 * agarre una frase falsa, y que no agarre una verdadera.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/**
 * El fuente **sin comentarios**. Los docblocks de estos archivos explican
 * justamente lo que los asertos prohíben —el de `comercialDelSitio.ts` cita «ni
 * un píxel» para razonar sobre él, el de `apoyoDelSitio.ts` cita la frase falsa
 * original— así que mirarlos con comentarios da falsos positivos. Mismo helper
 * que `tests/apoyo-del-sitio.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * El fuente como **prosa corrida**.
 *
 * Los dos reemplazos del medio son lo que hace que esto funcione sobre código: el
 * texto de estas páginas vive en literales **concatenados** —`'…no cobra y ' +
 * 'no guardamos…'`— y una frase partida en dos literales no se puede leer con un
 * regex de frase. Pegando la concatenación, la oración vuelve a ser una oración,
 * y la ventana de contexto de abajo puede buscarle la condición.
 */
const prosaDe = (src: string): string =>
  sinComentarios(src)
    .replace(/'\s*\+\s*'/g, '')
    .replace(/`\s*\+\s*`/g, '')
    .replace(/\s+/g, ' ');

/** Los archivos barridos, por glob y no a mano. */
const archivosBarridos = (): string[] => {
  const libs = readdirSync(raiz('src/lib'))
    .filter((f) => /DelSitio\.ts$/.test(f))
    .map((f) => `src/lib/${f}`);
  const paginas = readdirSync(raiz('src/pages'), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? readdirSync(raiz(`src/pages/${d.name}`))
          .filter((f) => f.endsWith('.astro'))
          .map((f) => `src/pages/${d.name}/${f}`)
      : d.name.endsWith('.astro')
        ? [`src/pages/${d.name}`]
        : [],
  );
  const componentes = readdirSync(raiz('src/components/sitio'))
    .filter((f) => f.endsWith('.astro'))
    .map((f) => `src/components/sitio/${f}`);
  return [...libs, ...paginas, ...componentes];
};

/**
 * Las formas de negar que se mide o se guarda algo del visitante.
 *
 * Son **fórmulas**, no una lista de frases prohibidas: lo que se detecta es el
 * verbo de la negación, y la decisión de si está bien o mal la toma la ventana de
 * contexto. Así una frase nueva que diga lo mismo con otras palabras cae en el
 * mismo patrón.
 */
const NEGACIONES: readonly { nombre: string; patron: RegExp }[] = [
  {
    nombre: 'no se guarda / no guardamos / no se mide',
    patron:
      /no (se |te )?(guarda|guardamos|almacena|almacenamos|registra|registramos|mide|medimos|rastrea|rastreamos|sigue|seguimos)\w*/gi,
  },
  {
    nombre: 'sin analítica / sin seguimiento / sin cookies',
    patron: /sin (anal[íi]tica|seguimiento|rastreo|cookies|m[eé]tricas|medici[óo]n)/gi,
  },
  {
    nombre: 'no usamos cookies / no hay analítica',
    patron: /no (usamos|hay|tenemos) (cookies|anal[íi]tica|seguimiento|rastreo|medici[óo]n)/gi,
  },
  { nombre: 'nadie te sigue', patron: /nadie te (sigue|rastrea|mira|ve)\w*/gi },
];

/**
 * Lo que vuelve verdadera a una negación: **la condición del consentimiento**.
 *
 * Es la forma que el banner ya usa («No se instala nada **hasta que elijas**») y
 * la que `/apoyar` tuvo que adoptar. No es una escapatoria del test: es la única
 * manera de decir la verdad sobre esto, porque el sitio no mide hasta que alguien
 * acepta y sí mide después.
 */
const CONDICIONES =
  /solo si|s[oó]lo si|si (lo |la )?acept|hasta que (elijas|acept|digas)|con (tu |su )?consentimiento|sin (tu |su )?consentimiento|mientras no acept|si no acept|si acept/i;

/**
 * Lo que también vuelve verdadera a una negación: **el alcance explícito**.
 *
 * «No te pedimos ni guardamos datos **para anotarte**» es cierto sin condición
 * ninguna —esta agenda no toma inscripciones— y «no usamos **tu dirección** para
 * nada más que responderte» también. La diferencia con la frase que `/apoyar`
 * tuvo que corregir es que aquélla negaba en absoluto («no se guarda quién
 * entró») y éstas nombran de qué hablan.
 *
 * La lista es corta a propósito. Cada entrada es una promesa que alguien tiene
 * que poder desmentir mirando el código, y agregarle una es agregar una promesa.
 */
const ALCANCES =
  /para anotarte|para inscribirte|de inscripci[óo]n|tu direcci[óo]n|tu mail|tu correo|datos personales para|en ning[úu]n lado/i;

/** ±160 caracteres alrededor del match: la frase y sus vecinas inmediatas. */
const ventana = (prosa: string, indice: number, largo: number): string =>
  prosa.slice(Math.max(0, indice - 160), indice + largo + 160);

interface Hallazgo {
  archivo: string;
  formula: string;
  frase: string;
}

const barrerPromesas = (archivos: readonly string[]): Hallazgo[] => {
  const hallazgos: Hallazgo[] = [];
  for (const archivo of archivos) {
    const prosa = prosaDe(readFileSync(raiz(archivo), 'utf8'));
    for (const { nombre, patron } of NEGACIONES) {
      // `matchAll` sobre una copia: el `lastIndex` de un regex global es estado.
      for (const m of prosa.matchAll(new RegExp(patron.source, patron.flags))) {
        const contexto = ventana(prosa, m.index, m[0].length);
        if (CONDICIONES.test(contexto) || ALCANCES.test(contexto)) continue;
        hallazgos.push({ archivo, formula: nombre, frase: contexto.trim() });
      }
    }
  }
  return hallazgos;
};

describe('el barrido mira archivos de verdad — control positivo', () => {
  it('los globs encuentran las cuatro páginas de texto y el banner', () => {
    /*
     * Sin esto, un glob que no matchea nada deja el test en verde **sin barrer
     * nada**, que es la forma en que un barrido pasa sin verificar. Se nombran las
     * cinco piezas que B-781 identificó, y son un **subconjunto**: el glob trae
     * más, y eso es el punto.
     */
    const archivos = archivosBarridos();
    for (const esperado of [
      'src/lib/apoyoDelSitio.ts',
      'src/lib/ayudaDelSitio.ts',
      'src/lib/contactoDelSitio.ts',
      'src/lib/comercialDelSitio.ts',
      'src/components/sitio/AvisoDeCookies.astro',
    ]) {
      expect(archivos, `el glob no trajo ${esperado}`).toContain(esperado);
    }
    // Y las páginas, que es donde vivían el título y la meta de `/apoyar` cuando
    // estaban exentas del barrido de su propio módulo.
    expect(archivos).toContain('src/pages/apoyar.astro');
    expect(archivos).toContain('src/pages/ayuda.astro');
  });

  it('la ayuda del panel NO entra, y es una decisión y no un olvido', () => {
    /*
     * `src/lib/ayuda.ts` dice «la dirección se queda en pantalla pero no se guarda
     * ni se publica», que es una afirmación **sobre el formulario del panel** y es
     * verdadera. No es una promesa a un visitante de un sitio indexado, que es la
     * clase que este archivo cuida. Si algún día la ayuda del panel se publica,
     * este caso se pone en rojo y hay que redecidirlo.
     */
    expect(archivosBarridos()).not.toContain('src/lib/ayuda.ts');
    expect(readFileSync(raiz('src/lib/ayuda.ts'), 'utf8')).toContain('no se guarda ni se publica');
  });

  it('la prosa pega los literales concatenados: una frase partida se lee entera', () => {
    /*
     * La pieza que hace que esto funcione sobre código. Sin el pegado, «no cobra y
     * ' + 'no guardamos» son dos strings y la ventana de contexto nunca alcanza la
     * condición que está en el literal de al lado.
     */
    const partida = "const x = 'No guardamos nada ' +\n  'salvo si lo aceptás.';";
    expect(prosaDe(partida)).toContain('No guardamos nada salvo si lo aceptás.');
  });
});

describe('ninguna página promete sobre datos algo que el sitio contradice — B-781', () => {
  it('el barrido no encuentra una sola negación absoluta', () => {
    /*
     * **El caso que este archivo existe para tener.** Si falla, el mensaje dice
     * qué archivo, qué fórmula y la frase: las tres cosas que hacen falta para
     * decidir si la frase se acota, se condiciona o se saca.
     *
     * Y ojo con el arreglo fácil: **agregar la frase a `ALCANCES` no es
     * arreglarla**. Cada entrada de esa lista es una promesa que alguien tiene que
     * poder desmentir mirando el código.
     *
     * MUTACIÓN PROBADA con la frase que este barrido encontró de verdad:
     * `/ayuda` decía «esta agenda no toma inscripciones, no cobra y **no guarda
     * tus datos**», que es la misma clase que la de `/apoyar` —negación absoluta,
     * página indexada— y era la única del sitio. Reponerla deja este caso en rojo
     * nombrando el archivo, la fórmula y la frase. Se corrigió acotándola: «no te
     * pedimos ni guardamos datos **para anotarte**», que es lo que la respuesta
     * quería decir y ahora es verdad literal.
     */
    const hallazgos = barrerPromesas(archivosBarridos());
    expect(
      hallazgos.map((h) => `${h.archivo} · ${h.formula} · «${h.frase}»`),
      'el sitio mide con consentimiento (salida 12). Condicionalo, acotalo, o no lo digas.',
    ).toEqual([]);
  });

  it('DETECTOR: la frase que /apoyar tuvo que corregir se agarra', () => {
    /*
     * El control negativo, con la frase histórica de verdad. Sin esto, un regex
     * roto dejaría el caso de arriba en verde para siempre — y este archivo es
     * justamente el que se escribió porque una frase falsa pasó desapercibida.
     */
    const hallazgos = barrerPromesas(['tests/fixtures/promesa-falsa.ts']);
    expect(hallazgos.length, 'el detector no agarró «no se guarda quién entró»').toBe(1);
    expect(hallazgos[0]!.formula).toContain('no se guarda');
  });

  it('DETECTOR: y no agarra la forma condicionada ni la acotada', () => {
    /*
     * La otra dirección, que es la que evita que este archivo se vuelva un
     * impuesto: el banner («No se instala nada hasta que elijas») y la respuesta
     * de `/ayuda` («no te pedimos ni guardamos datos para anotarte») son
     * verdaderas y tienen que pasar.
     */
    expect(barrerPromesas(['tests/fixtures/promesa-condicionada.ts'])).toEqual([]);
  });
});
