/**
 * **Ninguna página del sitio promete algo que el sitio desmiente** — sobre los
 * datos del visitante (B-781) y sobre la plata (B-851).
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
 *
 * ── El segundo eje: las promesas sobre plata — B-851 ───────────────────────
 * El archivo barre **dos familias** y se sigue llamando `promesas-sobre-datos`
 * porque así lo nombran B-781 y todo lo que lo cita; la clase, en cambio, es una
 * sola: **una afirmación pública que el propio sitio desmiente, en HTML
 * indexado**. La segunda familia salió de B-785, y de que este barrido no la vio:
 * la ayuda decía «no tiene publicidad y va a seguir así» mientras `/anunciar`
 * **vende espacio del sitio**, dos ítems más allá en el mismo encabezado. Las
 * fórmulas de arriba son sobre medición, así que la frase pasó en verde — y el
 * caso quedó resuelto en `tests/ayuda-del-sitio.test.ts`, o sea en **una sola
 * página**, que es exactamente lo que B-781 dijo que no alcanzaba.
 *
 * Lo que hace distinta a esta familia es que **su premisa se deriva**: la promesa
 * es imposible solo mientras el sitio venda espacio. El día que deje de venderlo,
 * `elSitioVendeEspacio()` da `false`, el barrido deja de exigirla y la frase
 * vuelve a ser escribible — sin que nadie tenga que acordarse de venir a borrar
 * un test que empezó a mentir.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
 * Un archivo barrido, ya leído y ya vuelto prosa.
 *
 * Existe para que un detector pueda barrer **un texto** y no solo un archivo del
 * repo: las dos frases de B-785 —la que hubo que corregir y la corrección— son
 * historia y no viven en ninguna salida, así que se pasan como texto con el
 * nombre de dónde salieron, que es lo que después aparece en el mensaje de error.
 */
interface Fuente {
  archivo: string;
  prosa: string;
}

const deArchivos = (archivos: readonly string[]): Fuente[] =>
  archivos.map((archivo) => ({ archivo, prosa: prosaDe(readFileSync(raiz(archivo), 'utf8')) }));

const deTexto = (archivo: string, texto: string): Fuente => ({ archivo, prosa: prosaDe(texto) });

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
  {
    /*
     * **La estrenó el correo de B-847, y la señaló el `auditor-privacidad`.**
     * Hasta que el sitio público pidió un dato no había ninguna frase de esta
     * forma, así que la fórmula no existía: las cuatro de arriba hablan de
     * *guardar* y *medir*, y «no te pedimos» dice lo mismo un paso antes. Es la
     * puerta por la que una página nueva puede prometer en absoluto («acá no se
     * pide nada») sin que nada la mire.
     *
     * La escapatoria es la de siempre y no una excepción: nombrar de qué habla.
     * «Tu dirección y nada más, no pedimos ninguna otra cosa» pasa por el
     * alcance «tu dirección», que es lo que la vuelve verdadera.
     */
    nombre: 'no pedimos / no se pide',
    /*
     * **Primera persona o impersonal, nunca la tercera**, y hace falta: la
     * ayuda dice «algunas **no piden** inscripción», que habla de las
     * actividades y no de nosotros. Un `piden` suelto lo agarraba, y un barrido
     * que se pone rojo por una frase ajena al tema se afloja (B-180).
     */
    patron: /no (te )?(pedimos|solicitamos)\w*|no se (pide|piden|solicita|solicitan)\b/gi,
  },
];

/**
 * Lo que vuelve verdadera a una negación: **la condición del consentimiento**.
 *
 * Es la forma que el banner ya usa («No se instala ninguna medición **hasta que
 * elijas**») y la que `/apoyar` tuvo que adoptar.
 *
 * **Ojo con lo que una condición NO arregla — B-848.** El banner decía «no se
 * instala **nada** hasta que elijas», condicionado y todo, y dejó de ser cierto
 * el día que existieron los favoritos: quien apretó «Rechazar» y después guardó
 * una actividad tiene algo escrito en su navegador. La condición cubre *cuándo*;
 * no cubre que el **objeto** de la negación sea el mundo entero. Eso lo mira el
 * caso «una negación cuyo objeto es "nada"» de más abajo. No es una escapatoria del test: es la única
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

const barrerPromesas = (archivos: readonly string[]): Hallazgo[] =>
  barrerFuentes(deArchivos(archivos));

/**
 * El mismo barrido sobre **texto**, para poder ejercitar una fórmula con la
 * frase que existe para dispararla sin tener que versionar un archivo por
 * fórmula. Es lo que `barrerPlata` ya hacía; esta familia lo ganó con B-847,
 * cuando entraron dos fórmulas nuevas y no había dónde probarlas.
 */
const barrerFuentes = (fuentes: readonly Fuente[]): Hallazgo[] => {
  const hallazgos: Hallazgo[] = [];
  for (const { archivo, prosa } of fuentes) {
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

// ───────────────────────────────────────────────────────────────────────────
// Familia 2 — las promesas sobre plata (B-851)
// ───────────────────────────────────────────────────────────────────────────

/**
 * **La premisa de toda esta familia, derivada y no afirmada a mano.**
 *
 * Ninguna de las promesas de abajo es falsa por sí sola: son falsas **porque el
 * sitio vende espacio**. Así que la premisa se lee del código que la hace cierta
 * —`comercialDelSitio.ts` ofreciendo publicidad, y `/anunciar` existiendo como
 * página— y no de una constante puesta acá.
 *
 * La diferencia importa el día que el sitio deje de vender espacio: el barrido se
 * apaga solo y la promesa vuelve a ser escribible, en vez de quedar un test
 * exigiendo callar algo que ya es verdad. Se lee la **prosa** y no el fuente
 * entero a propósito: el docblock de ese módulo razona largo sobre publicidad, y
 * lo que decide acá es lo que la página **dice**, no lo que su comentario cuenta.
 */
const elSitioVendeEspacio = (): boolean =>
  /publicidad/i.test(prosaDe(readFileSync(raiz('src/lib/comercialDelSitio.ts'), 'utf8'))) &&
  existsSync(raiz('src/pages/anunciar.astro'));

interface FormulaDePlata {
  nombre: string;
  patron: RegExp;
  /**
   * Si **nombrar el alcance** la puede volver verdadera.
   *
   * «Publicar es gratis y va a seguir siendo gratis» dice qué es gratis y es
   * cierto; «no tiene publicidad» no tiene alcance que la salve, porque no habla
   * de lo que se le cobra a quien lee sino de lo que el sitio hace, y el sitio
   * vende espacio.
   *
   * Sin esta distinción el barrido se perdería justamente la frase de B-785: venía
   * con un alcance legítimo pegado —«es gratis, no tiene publicidad y va a seguir
   * así»— y el alcance, que rescataba a la mitad verdadera, le habría dado paso
   * también a la falsa.
   */
  acotable: boolean;
}

/**
 * Las formas de prometer que acá no hay plata de por medio.
 *
 * Mismo criterio que `NEGACIONES`: son **fórmulas** y no una lista de frases
 * prohibidas. Las tres primeras hablan de lo que el sitio **hace** —vender
 * espacio— y las dos últimas de lo que **cuesta usarlo**; por eso solo las dos
 * últimas se pueden acotar.
 */
const PROMESAS_SOBRE_PLATA: readonly FormulaDePlata[] = [
  {
    nombre: 'no tiene publicidad / no hay anuncios',
    patron:
      /no (tiene|hay|va a haber|vas a ver|tenemos|vamos a tener)\w* (ning[úu]n[ao]?s? )?(publicidad|anuncios?|avisos? publicitarios?|pauta|banners?)/gi,
    acotable: false,
  },
  {
    nombre: 'sin publicidad / libre de anuncios',
    patron: /(sin|libre de) (publicidad|anuncios|pauta|banners)/gi,
    acotable: false,
  },
  {
    nombre: 'no vendemos espacio / no se vende nada',
    patron: /no (se |te )?(vende|vendemos|alquila|alquilamos)\w* (nada|espacio|lugar|publicidad)/gi,
    acotable: false,
  },
  {
    nombre: 'nunca vamos a cobrar / no se cobra',
    patron: /(nunca|jam[áa]s|no) (te |se |le )?(vamos a |va a |van a )?(cobrar|cobra|cobramos|cobran)\w*/gi,
    acotable: true,
  },
  {
    nombre: 'siempre va a ser gratis',
    patron:
      /((siempre|nunca) [^.]{0,24}gratis|va(n)? a seguir siendo gratis|gratis para siempre|gratis y va a seguir)/gi,
    acotable: true,
  },
];

/**
 * Lo que vuelve verdadera a una promesa sobre plata: **nombrar la excepción**.
 *
 * Es lo que hizo la respuesta de `/ayuda` al corregirse. No dice «no hay
 * publicidad»: dice que entrar y publicar son gratis y que **un espacio sí puede
 * pagar para que se lo vea**. Una frase que nombra a `/anunciar` no lo esconde, y
 * es la única forma de hablar del tema sin mentir.
 */
const CONDICIONES_PLATA =
  /s[íi] (puede|pueden|pod[ée]s) pagar|pagar para que se lo vea|salvo|excepto|el espacio que se (vende|paga)/i;

/**
 * Lo que también la vuelve verdadera: **decir qué es lo gratis**.
 *
 * Entrar es gratis, publicar una actividad es gratis, la agenda es gratis para
 * quien la usa, y anotarse a una actividad no pasa por acá. Las cuatro son ciertas
 * y las cuatro nombran de qué hablan; lo que no se puede escribir es la promesa
 * sin sujeto («nunca vamos a cobrar»), que abarca también lo que sí se cobra.
 *
 * La lista es corta a propósito, igual que `ALCANCES`: cada entrada es una promesa
 * que alguien tiene que poder desmentir mirando el código, y agregarle una es
 * agregar una promesa.
 */
const ALCANCES_PLATA =
  /entrar es gratis|publicar\w* (una actividad )?(es gratis|no cuesta|tampoco)|la agenda es gratis|esta agenda no|no toma inscripciones|para anotarte/i;

const barrerPlata = (fuentes: readonly Fuente[]): Hallazgo[] => {
  // La premisa. Sin espacio vendido no hay promesa imposible, y el barrido no
  // tiene nada que exigirle a nadie.
  if (!elSitioVendeEspacio()) return [];

  const hallazgos: Hallazgo[] = [];
  for (const { archivo, prosa } of fuentes) {
    for (const { nombre, patron, acotable } of PROMESAS_SOBRE_PLATA) {
      // `matchAll` sobre una copia: el `lastIndex` de un regex global es estado.
      for (const m of prosa.matchAll(new RegExp(patron.source, patron.flags))) {
        const contexto = ventana(prosa, m.index, m[0].length);
        if (CONDICIONES_PLATA.test(contexto)) continue;
        if (acotable && ALCANCES_PLATA.test(contexto)) continue;
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

  it('DETECTOR: las dos fórmulas que estrenó el correo disparan, y la acotada no — B-847', () => {
    /*
     * Una fórmula que ningún caso dispara se puede achicar entera sin que nada
     * se ponga en rojo, y a éstas no las ejercita el texto publicado —hoy nadie
     * promete eso, que es justamente lo que el barrido cuida—. Es el mismo
     * criterio con el que la familia de la plata tiene una fuente por fórmula.
     *
     * La tercera es la forma **acotada** y tiene que pasar: es el texto que hoy
     * está al lado del campo del correo, y lo que la rescata no es una
     * excepción sino nombrar de qué habla («tu dirección»).
     */
    expect(
      barrerFuentes([
        deTexto('la promesa de no pedir, sin sujeto', 'Para leer la agenda no te pedimos nada.'),
        deTexto('la misma, en impersonal', 'Acá no se pide ningún dato para entrar.'),
      ]).map((h) => `${h.archivo} · ${h.formula}`),
      'una fórmula dejó de disparar sobre la frase que existe para dispararla',
    ).toEqual([
      'la promesa de no pedir, sin sujeto · no pedimos / no se pide',
      'la misma, en impersonal · no pedimos / no se pide',
    ]);

    expect(
      barrerFuentes([
        deTexto(
          'la forma acotada, que es la que está publicada',
          'Tu dirección de mail. Nada más que eso: no pedimos tu nombre ni ninguna otra cosa.',
        ),
      ]),
      'el barrido se pasó de rosca: la frase nombra de qué habla',
    ).toEqual([]);
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

describe('una negación cuyo objeto es «nada» no se salva con una condición — B-848', () => {
  /*
   * **La clase que el barrido de arriba no puede ver, y por qué es una clase.**
   * Aquél pregunta *cuándo* vale la negación —«hasta que elijas», «si aceptás»—
   * y con eso alcanzaba mientras el sitio no escribiera nada en el dispositivo
   * sin permiso. Desde B-848 sí escribe: los favoritos y las búsquedas guardadas
   * son almacenamiento **que la persona pidió**, funcional y exento del banner,
   * pero escrito igual y también cuando apretó «Rechazar».
   *
   * O sea que «no se instala **nada** hasta que elijas» pasaba el barrido —tiene
   * su condición— y era falsa. Lo que falla no es el *cuándo*: es que el
   * **objeto** de la negación sea el mundo entero. Una frase así envejece sola
   * en cuanto el sitio gana una función, sin que nadie la toque.
   *
   * La red es angosta a propósito: solo los verbos de «poner algo en el
   * dispositivo o mandarlo afuera» seguidos de «nada». Se salva nombrando de qué
   * habla —«ninguna medición», «ninguna cookie»—, que es lo que hace verdadera a
   * la frase y no una excepción del test.
   */
  /*
   * **`queda` y el `se` opcional entraron con B-847.** «Acá no queda nada tuyo»
   * es exactamente la misma frase que «no se instala nada» con otro verbo, y la
   * primera versión del texto del correo la tenía; el regex no la veía porque
   * pedía el `se` y no conocía ese verbo. Lo señaló el `auditor-privacidad`.
   */
  const OBJETO_ABSOLUTO =
    /no (se )?(instala|guarda|manda|env[íi]a|escribe|comparte|queda)\w*\s+nada\b/gi;

  it('ninguna página del sitio niega en absoluto sobre el dispositivo', () => {
    /*
     * MUTACIÓN PROBADA: volver a poner «No se instala nada hasta que elijas» en
     * `AvisoDeCookies.astro` pone este caso en rojo — y el barrido de negaciones
     * de arriba lo deja pasar, que es exactamente el agujero que este caso vino
     * a tapar.
     */
    const hallazgos: string[] = [];
    for (const { archivo, prosa } of deArchivos(archivosBarridos())) {
      for (const m of prosa.matchAll(OBJETO_ABSOLUTO)) {
        hallazgos.push(`${archivo}: «${ventana(prosa, m.index, m[0].length).trim()}»`);
      }
    }
    expect(
      hallazgos,
      'el objeto de la negación es el mundo entero: nombrá de qué habla —«ninguna ' +
        'medición», «ninguna cookie»—. Una condición dice *cuándo* vale, no *sobre qué*, ' +
        'y esa frase envejece sola en cuanto el sitio gana una función (B-848)',
    ).toEqual([]);
  });

  it('DETECTOR: la frase vieja del banner se agarra, y la corregida no', () => {
    // Sin esto, un regex que dejó de matchear nada haría pasar el caso de arriba
    // sin haber mirado.
    const vieja = 'Usamos Google Analytics. No se instala nada hasta que elijas.';
    const nueva = 'Usamos Google Analytics. No se instala ninguna medición hasta que elijas.';
    expect([...vieja.matchAll(OBJETO_ABSOLUTO)]).toHaveLength(1);
    expect([...nueva.matchAll(OBJETO_ABSOLUTO)]).toHaveLength(0);
  });
});

describe('ninguna página promete sobre plata algo que el sitio desmiente — B-851', () => {
  it('la premisa se deriva de /anunciar, y hoy el sitio sí vende espacio', () => {
    /*
     * **El caso que sostiene a los otros tres.** Si esto se pone en rojo hay
     * exactamente dos motivos, y son opuestos:
     *
     * 1. El sitio dejó de vender espacio. Entonces la familia entera sobra:
     *    `barrerPlata` ya devuelve vacío solo, y lo que corresponde es **borrarla
     *    con su motivo escrito**, no dejarla apagada.
     * 2. La derivación se rompió —`/anunciar` se renombró, el texto dejó de decir
     *    «publicidad»— y el sitio sigue vendiendo espacio. Entonces el barrido se
     *    apagó en silencio, que es el modo de falla que este caso existe para que
     *    no pase, y hay que arreglar la derivación.
     *
     * El aserto no puede distinguirlos; el mensaje manda a mirar cuál es.
     */
    expect(
      elSitioVendeEspacio(),
      'si /anunciar dejó de vender espacio, borrá esta familia; si no, la derivación se rompió',
    ).toBe(true);
  });

  it('el barrido no encuentra una sola promesa sobre plata sin acotar', () => {
    /*
     * El gemelo del caso de B-781, sobre el otro eje. El mensaje dice archivo,
     * fórmula y frase, que es lo que hace falta para elegir entre las tres
     * salidas: nombrar la excepción, decir qué es lo gratis, o no prometerlo.
     *
     * Y ojo con el arreglo fácil, que acá es todavía más tentador que en la
     * familia de datos: **agregar la frase a `ALCANCES_PLATA` no es arreglarla**.
     *
     * MUTACIÓN PROBADA: sacarle la escapatoria del alcance a `barrerPlata`
     * (`acotable && ALCANCES_PLATA`) deja este caso en rojo nombrando las tres
     * frases acotadas que hoy están publicadas —dos de `/apoyar` y una de
     * `/ayuda`—, o sea que esto barre texto vivo y no aire. Que la frase de B-785
     * caiga cuando vuelve a aparecer se prueba abajo, sobre la frase misma.
     */
    const hallazgos = barrerPlata(deArchivos(archivosBarridos()));
    expect(
      hallazgos.map((h) => `${h.archivo} · ${h.formula} · «${h.frase}»`),
      '/anunciar vende espacio del sitio. Nombrá la excepción, decí qué es lo gratis, o no lo prometas.',
    ).toEqual([]);
  });

  it('DETECTOR: la frase que /ayuda tuvo que corregir se agarra, y las cinco fórmulas disparan', () => {
    /*
     * El control negativo, con la frase histórica de verdad y no con una
     * inventada. Va inline y no en `tests/fixtures/`: lo que enseña el caso es la
     * **comparación** con la corrección, que está en el caso de abajo, y
     * separarlas en otro archivo la esconde.
     *
     * Hay una fuente por fórmula, y no es prolijidad: una fórmula que ningún caso
     * dispara se puede achicar entera sin que nada se ponga en rojo, y a las
     * últimas cuatro no las ejercita el texto publicado —hoy nadie promete eso,
     * que es justamente lo que el barrido cuida—.
     *
     * La segunda fuente es aparte la que hace que `acotable: false` sea algo más
     * que una opinión escrita en un docblock. La promesa de que no hay publicidad
     * viaja pegada a una verdadera —«la agenda es gratis», que en la frase
     * original era «es gratis»— y en la misma ventana; un barrido que aceptara
     * cualquier alcance cercano la dejaría pasar, que es exactamente cómo B-785
     * llegó a producción. Con `acotable: false` las dos caen igual.
     *
     * Qué lo haría pasar si alguien lo rompe: sacar la promesa, o nombrar la
     * excepción como hizo `/ayuda`. Poner `acotable: true` no es arreglarlo.
     */
    const hallazgos = barrerPlata([
      deTexto(
        'B-785 · la respuesta original de /ayuda',
        'Sí, es gratis, no tiene publicidad y va a seguir así.',
      ),
      deTexto(
        'la misma promesa con el alcance legítimo pegado',
        'La agenda es gratis y va a seguir siendo gratis, y no tiene publicidad.',
      ),
      deTexto('la promesa dicha sin verbo', 'Una agenda sin publicidad, hecha a mano.'),
      deTexto(
        'la promesa de que no se vende espacio',
        'Acá no se vende espacio: ninguna marca puede comprar un lugar.',
      ),
      deTexto(
        'la promesa de no cobrar, sin decir a quién',
        'Lo hace una persona en sus ratos libres, y nunca vamos a cobrar.',
      ),
      deTexto(
        'la promesa de gratis para siempre, sin decir qué',
        'Todo lo que ves acá siempre va a ser gratis.',
      ),
    ]);
    expect(
      hallazgos.map((h) => `${h.archivo} · ${h.formula}`),
      'una fórmula dejó de disparar sobre la frase que existe para dispararla',
    ).toEqual([
      'B-785 · la respuesta original de /ayuda · no tiene publicidad / no hay anuncios',
      'la misma promesa con el alcance legítimo pegado · no tiene publicidad / no hay anuncios',
      'la promesa dicha sin verbo · sin publicidad / libre de anuncios',
      'la promesa de que no se vende espacio · no vendemos espacio / no se vende nada',
      'la promesa de no cobrar, sin decir a quién · nunca vamos a cobrar / no se cobra',
      'la promesa de gratis para siempre, sin decir qué · siempre va a ser gratis',
    ]);
  });

  it('DETECTOR: y no agarra ni el texto publicado ni la única forma honesta de negarlo', () => {
    /*
     * La otra dirección, la que evita que la familia se vuelva un impuesto sobre
     * el texto honesto (B-180). Las dos primeras son texto publicado hoy:
     *
     * - `/ayuda`, que en vez de prometer nombra la excepción («un café sí puede
     *   pagar para que se lo vea»): es la corrección que B-785 eligió;
     * - `/apoyar`, que dice **qué** es lo gratis —la agenda, publicar— y eso
     *   `/anunciar` no lo desmiente: lo que se vende es que se te vea, no leer la
     *   agenda ni estar en ella.
     *
     * La tercera **no** está publicada, y es la que mantiene abierta la única
     * puerta que le queda a una promesa no acotable: una página que necesite
     * hablar de anuncios puede hacerlo si nombra el espacio que sí se vende. Sin
     * este caso no hay nada que ejercite `CONDICIONES_PLATA`, y la familia queda
     * diciendo «esto no se puede decir» en vez de «así sí».
     *
     * Si alguna de las tres empezara a dar hallazgo, el arreglo no es corregir la
     * página: es que el barrido se pasó de rosca.
     */
    expect(
      barrerPlata([
        deTexto(
          'la corrección de /ayuda',
          'Sí. Entrar es gratis y publicar una actividad también, y las dos cosas van a seguir así. ' +
            'Un café, una librería o un espacio cultural sí puede pagar para que se lo vea.',
        ),
        deTexto(
          'la entrada de /apoyar',
          'La agenda es gratis y va a seguir siendo gratis. Publicar es gratis y va a seguir siendo ' +
            'gratis, así que aportar no adelanta a nadie en la fila.',
        ),
        deTexto(
          'cómo sí se puede hablar de anuncios',
          'En las páginas de actividad no vas a ver publicidad, salvo el espacio que un café, una ' +
            'librería o un espacio cultural puede pagar para que se lo vea.',
        ),
      ]),
    ).toEqual([]);
  });
});
