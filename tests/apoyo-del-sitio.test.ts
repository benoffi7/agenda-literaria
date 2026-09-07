import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { CAFECITO, urlDeCafecito } from '@/lib/enlaces';
import { RUTA_APOYAR } from '@/lib/rutasPublicas';
import { RUTAS_FIJAS } from '@/lib/sitemap';
import {
  ANTES_DE_APOYAR,
  DESCRIPCION_DE_APOYO,
  EL_CAFECITO,
  ENTRADA_DE_APOYO,
  TITULO_DE_APOYO,
  LETRA_CHICA,
  POR_QUE_IMPORTA,
  QUE_CUESTA,
  QUIEN_LA_HACE,
  SIN_PLATA,
  TEXTO_DE_APOYO,
} from '@/lib/apoyoDelSitio';

/**
 * `/apoyar` — la página de aportes, B-780.
 *
 * ── Qué verifica esto que no se ve mirando la página ──────────────────────
 * Es la única página del sitio que le pide algo a alguien, y lo que la hace
 * aceptable son **cuatro promesas escritas**: que la agenda es gratis, que nadie
 * tiene que pagar nada, que una parte del aporte se la queda el intermediario, y
 * que aportar no compra un lugar en la agenda. Ninguna de las cuatro es
 * necesaria para que la página se vea bien: un rediseño que apriete el texto las
 * puede borrar de a una y el build queda verde. Por eso están acá una por una,
 * con el motivo.
 *
 * Lo otro que verifica es el **tono**, que es la restricción explícita del
 * encargo: ni formal ni dramático. Eso no se puede afirmar en general, así que
 * se afirma por su negación —la lista de fórmulas que este texto no puede
 * usar—, que es lo mismo que `tests/sistema-visual.test.ts` hace con las sombras
 * y los degradados: prohibir lo que se sabe que vuelve.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const PAGINA = 'src/pages/apoyar.astro';
const MODULO = 'src/lib/apoyoDelSitio.ts';

/** El fuente de un archivo del repo. */
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

/**
 * El fuente **sin comentarios**: es lo que hay que mirar para preguntar «¿la
 * página escribe esto?». Los docblocks de estos archivos explican justamente lo
 * que los asertos prohíben, así que mirarlos con comentarios da falsos
 * positivos. Mismo helper que `tests/estilos-del-sitio.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** El texto de la página, todo junto y en minúsculas, para buscar fórmulas. */
const todoElTexto = (): string => TEXTO_DE_APOYO.join('\n').toLowerCase();

describe('el barrido lee la página de verdad — control positivo', () => {
  it('el texto existe y es una lista plana sin huecos', () => {
    // Sin esto, un `TEXTO_DE_APOYO` vacío haría pasar todos los asertos de tono
    // sin haber mirado una sola frase.
    expect(TEXTO_DE_APOYO.length).toBeGreaterThan(20);
    expect(TEXTO_DE_APOYO.filter((t) => typeof t !== 'string' || t.trim() === '')).toEqual([]);
    expect(todoElTexto()).toContain('cafecito');
  });

  it('todos los bloques del módulo llegan al barrido', () => {
    /*
     * La otra mitad: un bloque nuevo que no se agregue a `TEXTO_DE_APOYO` es un
     * bloque que ningún aserto de tono ni de centinelas revisa. Se compara
     * contra los títulos de los seis bloques, que es lo que no se puede agregar
     * sin darse cuenta.
     */
    for (const titulo of [
      QUIEN_LA_HACE.titulo,
      POR_QUE_IMPORTA.titulo,
      QUE_CUESTA.titulo,
      EL_CAFECITO.titulo,
      SIN_PLATA.titulo,
      LETRA_CHICA.titulo,
    ]) {
      expect(TEXTO_DE_APOYO, `«${titulo}» no está en TEXTO_DE_APOYO`).toContain(titulo);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · Las cuatro promesas
// ───────────────────────────────────────────────────────────────────────────

describe('las cuatro promesas que hacen aceptable pedir algo', () => {
  it('dice que la agenda es gratis, en la primera línea', () => {
    /*
     * Va en la bajada y no enterrada abajo: quien entró de curiosidad tiene que
     * poder irse en la primera línea sabiendo que no le están cobrando nada.
     *
     * MUTACIÓN PROBADA: cambiar `ENTRADA_DE_APOYO` por «Ayudanos a sostener la
     * agenda» pone este caso en rojo.
     */
    expect(ENTRADA_DE_APOYO.toLowerCase()).toContain('gratis');
  });

  it('dice que si nadie aporta no pasa nada', () => {
    /*
     * Es lo que convierte el aporte en un gesto y no en un peaje. Está en la
     * letra chica como ítem propio para que se pueda exigir por separado: un
     * texto que lo diga «en general» no se puede verificar.
     */
    const punto = LETRA_CHICA.puntos[0];
    expect(punto, 'la letra chica se quedó sin ítems').toBeDefined();
    expect(punto!.titulo.toLowerCase()).toMatch(/no pasa nada|nadie aporta/);
    expect(punto!.texto.toLowerCase()).toContain('sigue igual');
  });

  it('dice que una parte del aporte no llega, y no inventa el porcentaje', () => {
    /*
     * Cafecito cobra comisión y Mercado Pago también. Decirlo es honestidad
     * básica; **escribir el porcentaje no**: es una cifra de un tercero copiada
     * en nuestro sitio, que se queda vieja sin que nada falle. Es el mismo
     * criterio con el que el pie no lleva un año de copyright escrito a mano
     * (`tests/sistema-visual.test.ts`).
     */
    const chica = EL_CAFECITO.letraChica.toLowerCase();
    expect(chica).toContain('cafecito');
    expect(chica).toContain('mercado pago');
    expect(chica).toMatch(/comisi|se la quedan|se lo quedan/);

    const conPorcentaje = TEXTO_DE_APOYO.filter((t) => /\d+\s*%|\d+\s*por ciento/i.test(t));
    expect(
      conPorcentaje,
      'no escribas la comisión de Cafecito acá: la publica Cafecito y cambia sin ' +
        'avisarnos. Decí que hay comisión y mandá a leerla donde es cierta.',
    ).toEqual([]);
  });

  it('dice que aportar no compra un lugar en la agenda', () => {
    // Sin esto, la página abre la puerta a que un organizador crea que pagar le
    // consigue publicación — y publicar es gratis (§ «Cómo entra una actividad»
    // de `/ayuda`).
    const texto = todoElTexto();
    expect(texto).toMatch(/publicar (es|sigue siendo) gratis/);
    expect(texto).toMatch(/no (compra|adelanta)/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · El tono: ni formal ni dramático
// ───────────────────────────────────────────────────────────────────────────

describe('el tono es el que pidió el dueño: ni formal ni dramático', () => {
  /**
   * Las fórmulas prohibidas, con por qué cada una.
   *
   * Es una lista de lo que **se sabe que vuelve** cuando alguien reescribe un
   * texto de donaciones, no una lista de palabras feas. Cada entrada apareció
   * alguna vez en una página de este tipo.
   */
  const PROHIBIDAS: { patron: RegExp; motivo: string }[] = [
    {
      patron: /estos tiempos|tiempos dif[íi]ciles|momento dif[íi]cil/,
      motivo: 'el circuito literario no necesita que le tengan lástima',
    },
    {
      patron: /gracias a personas como (vos|usted|tí|ti)/,
      motivo: 'halago hueco: pide con culpa disfrazada de agradecimiento',
    },
    {
      patron: /la cultura (est[áa] en (peligro|crisis)|nos necesita)|resistir/,
      motivo: 'dramático, y además no es cierto de una agenda de talleres',
    },
    {
      patron: /\b(el proyecto|este sitio) (agradece|le agradece|agradecer[áa])\b/,
      motivo: 'tercera persona institucional: esto lo hace una persona y habla ella',
    },
    {
      patron: /su (colaboraci[óo]n|aporte|generosidad)\b|le invitamos|los invitamos a/,
      motivo: 'el sitio habla de vos, no de usted (mismo registro que /ayuda)',
    },
    {
      patron: /sin (vos|ustedes|tu ayuda) (esto )?no (existe|ser[íi]a posible)/,
      motivo: 'falso: la agenda no cambia si nadie aporta, y eso lo dice la letra chica',
    },
    {
      patron: /ay[úu]danos|ayudanos a seguir|colabor[áa] con nosotros/,
      motivo: 'el pedido genérico que la lista de costos reemplaza',
    },
  ];

  it('la lista de fórmulas prohibidas no está vacía ni es inerte', () => {
    // Control del control: el detector tiene que saber decir que sí.
    expect(PROHIBIDAS.length).toBeGreaterThan(5);
    expect(PROHIBIDAS.some((p) => p.patron.test('en estos tiempos difíciles'))).toBe(true);
  });

  it('ninguna aparece en el texto', () => {
    const encontradas = PROHIBIDAS.filter((p) => p.patron.test(todoElTexto())).map(
      (p) => `${p.patron} — ${p.motivo}`,
    );
    expect(
      encontradas,
      'el tono de esta página lo pidió el dueño: ni formal ni dramático. Contá qué es ' +
        'y qué cuesta en vez de pedir.',
    ).toEqual([]);
  });

  it('no hay signos de exclamación: el resto del sitio no los usa', () => {
    // Ni uno en `/ayuda`, `/contacto` ni `/suscribirse`. Una página de
    // donaciones es justo donde se cuelan.
    const conSignos = TEXTO_DE_APOYO.filter((t) => t.includes('!') || t.includes('¡'));
    expect(conSignos).toEqual([]);
  });

  it('el chiste del cafecito se usa una vez y no se exprime', () => {
    /*
     * La unidad de la plataforma es literalmente un café, así que la frase está
     * para usarla — y una sola vez. Un texto que insiste («¡invitame otro!»,
     * «para que no me falte el café») es el tono que el dueño pidió no escribir,
     * con disfraz de simpático.
     *
     * Se cuentan solo las menciones del **café** como gesto, no las del nombre
     * de la plataforma: «Cafecito» aparece las veces que haga falta para decir
     * dónde va el click.
     */
    const cafes = (todoElTexto().match(/\bcaf[ée]s?\b/g) ?? []).length;
    expect(cafes, 'el chiste del café se está exprimiendo').toBeLessThanOrEqual(3);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Lo que sí tiene que decir
// ───────────────────────────────────────────────────────────────────────────

describe('la página cuenta qué es y qué cuesta, que es lo que reemplaza al pedido', () => {
  it('nombra los costos concretos y no una frase genérica', () => {
    const costos = QUE_CUESTA.puntos.map((p) => `${p.titulo} ${p.texto}`.toLowerCase()).join(' ');
    expect(costos).toContain('dominio');
    expect(costos).toMatch(/hosting|firebase/);
    expect(costos).toMatch(/calendario|funciones/);
    // Y el que no es plata, que es el que explica por qué la agenda crece
    // despacio y por qué la ayuda más útil es mandar una actividad.
    expect(costos).toMatch(/a mano|minutos/);
  });

  it('no promete que no se mide nada: el sitio mide con consentimiento (salida 12)', () => {
    /*
     * La primera versión decía «no se guarda quién entró», y era falso: en la
     * misma pantalla está el banner de `AvisoDeCookies` diciendo que el sitio usa
     * Google Analytics, y con el consentimiento aceptado sale un `page_view` con
     * su client-id. Lo encontró el `auditor-privacidad`.
     *
     * No es una fuga: es una **promesa pública sobre datos que el propio sitio
     * contradice**, en la única página cuyo valor entero es que se le crea, y en
     * el HTML que se indexa. Los cuatro asertos de «las promesas» verificaban que
     * estuvieran, no que fueran verdad — este cubre esa diferencia.
     *
     * MUTACIÓN PROBADA: reponer «y no se guarda quién entró» pone este caso en
     * rojo.
     */
    const bannerExiste = existsSync(raiz('src/components/sitio/AvisoDeCookies.astro'));
    expect(bannerExiste, 'si el banner desapareció, esta regla hay que redecidirla').toBe(true);

    const absolutas = TEXTO_DE_APOYO.filter((t) =>
      /no se (guarda|mide|registra)|sin anal[íi]tica|no hay anal[íi]tica|no us(amos|o) cookies/i.test(
        t,
      ),
    );
    expect(
      absolutas,
      'el sitio SÍ mide, con consentimiento (salida 12). Decilo condicionado o no lo digas.',
    ).toEqual([]);

    /*
     * Y si el texto nombra la medición, la nombra condicionada. El detector es
     * «Analytics» y no «se mide»: la página dice también que «el aporte **se
     * mide**, literalmente, en cafés», que es otra cosa y no lleva condición.
     */
    const nombraMedicion = TEXTO_DE_APOYO.filter((t) => /analytics/i.test(t));
    expect(nombraMedicion.length, 'la página no dice qué se mide').toBeGreaterThan(0);
    for (const t of nombraMedicion) {
      expect(t, `«${t.slice(0, 60)}…» nombra la medición sin la condición`).toMatch(
        /solo si|si (lo )?acept/i,
      );
    }
  });

  it('el título y la meta description entran al barrido, como el resto del texto', () => {
    /*
     * Estaban escritas en el `.astro`, o sea **afuera de `TEXTO_DE_APOYO`**, que
     * es la lista que este módulo declara como «un bloque que no llegue acá es un
     * bloque que nadie revisa». O sea: dos frases exentas del barrido de
     * centinelas y de los asertos de tono, mientras el docblock de la página
     * afirmaba que no escribía ninguna. Lo encontró el `auditor-privacidad`.
     *
     * La `meta description` es exactamente la superficie que obligó a barrer la
     * salida 8 con centinelas: texto libre en HTML indexado, a un carácter de
     * interpolar algo.
     */
    expect(TEXTO_DE_APOYO).toContain(TITULO_DE_APOYO);
    expect(TEXTO_DE_APOYO).toContain(DESCRIPCION_DE_APOYO);
    // Y la descripción entra en el recorte de Google.
    expect(DESCRIPCION_DE_APOYO.length).toBeLessThanOrEqual(200);

    // La plantilla las consume, no las escribe: sin literales largos en `<Base>`.
    const props = /<Base([\s\S]*?)>/.exec(sinComentarios(fuente(PAGINA)))?.[1] ?? '';
    expect(props, 'el <Base> de la página no se encontró').not.toBe('');
    const literales = (props.match(/"[^"]{25,}"/g) ?? []).filter((l) => !l.includes('{'));
    expect(
      literales,
      'estas frases están escritas en la plantilla, así que ningún barrido las mira: ' +
        'movelas a `apoyoDelSitio.ts` y sumalas a TEXTO_DE_APOYO.',
    ).toEqual([]);
  });

  it('el trabajo es ad honorem y está dicho con hechos, no con adjetivos', () => {
    /*
     * «Proyecto independiente y sin fines de lucro» es la versión formal de esto
     * y no dice ninguna de las dos cosas verificables: que no se cobra por
     * publicar y que no se guardan datos.
     */
    const quien = QUIEN_LA_HACE.parrafos.join(' ').toLowerCase();
    expect(quien).toMatch(/no cobro|no cobra/);
    expect(quien).toMatch(/no vendo datos|no los tengo/);
  });

  it('ofrece formas de ayudar que no son plata, y son las de arriba de la lista', () => {
    /*
     * Es lo que hace que ésta no sea una página de cobranza: mandar una
     * actividad que falta es contenido que la agenda no tiene, y eso vale más
     * que un aporte. Están en la misma página a propósito.
     */
    expect(SIN_PLATA.formas.length).toBeGreaterThanOrEqual(3);
    expect(SIN_PLATA.entrada.toLowerCase()).toMatch(/ayudan m[áa]s|sirven m[áa]s/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Ninguna dirección escrita a mano
// ───────────────────────────────────────────────────────────────────────────

describe('las direcciones salen de los módulos, no del texto ni del marcado', () => {
  it('el destino del botón es el que produce `urlDeCafecito`', () => {
    expect(EL_CAFECITO.accion.href).toBe(urlDeCafecito());
    expect(EL_CAFECITO.accion.externo).toBe(true);
  });

  it('la página no escribe ninguna URL absoluta', () => {
    /*
     * Es el mismo aserto que `tests/suscribirse.test.ts` hace con las
     * direcciones del calendario, y acá cuida otra cosa: el usuario de Cafecito
     * vive en `CAFECITO` (`lib/enlaces.ts`) y una copia en el marcado es la que
     * se olvida de cambiar el día que el perfil se renombre — dejando un botón
     * que lleva a un 404 y se ve perfecto.
     *
     * MUTACIÓN PROBADA: pegar `href="https://cafecito.app/otro"` en la página
     * pone este caso en rojo.
     */
    const src = sinComentarios(fuente(PAGINA));
    const absolutas = src.match(/https?:\/\/[^\s"'`]+/g) ?? [];
    expect(
      absolutas,
      'esta página no escribe direcciones: salen de `lib/enlaces.ts` y de ' +
        '`lib/rutasPublicas.ts`.',
    ).toEqual([]);
  });

  it('el módulo de texto tampoco: solo el nombre de dominio en una frase', () => {
    /*
     * La letra chica dice adónde te lleva el botón, y eso es información que hay
     * que dar. Lo que no puede hacer es escribir el enlace: la frase se arma
     * interpolando `CAFECITO`, así que el día que el perfil cambie cambia sola.
     */
    const src = sinComentarios(fuente(MODULO));
    expect(src.match(/https?:\/\/[^\s"'`]+/g) ?? []).toEqual([]);
    expect(EL_CAFECITO.letraChica).toContain(`cafecito.app/${CAFECITO}`);
  });

  it('el sitio no embebe ningún recurso de Cafecito', () => {
    /*
     * Cafecito ofrece un botón para pegar: un `<img>` servido desde
     * `cdn.cafecito.app` dentro de un `<a>`. **Acá no se usa**, y la garantía va
     * en este archivo y no en el barrido de terceros porque
     * `tests/terceros-antes-del-consentimiento.test.ts` **excluye `<img>` a
     * propósito** (una actividad puede traer un flyer externo). O sea: ese
     * barrido no frenaría el botón oficial, y este sí.
     *
     * Rehospedar el SVG acá tampoco: sus términos dicen que las marcas y los
     * signos distintivos son de ellos y que acceder al sitio no da ningún
     * derecho sobre ellos. El botón se dibuja con `claseBotonPrimario`.
     *
     * MUTACIÓN PROBADA: agregar un `<img>` con `cdn.cafecito.app` a la página
     * pone este caso en rojo nombrando el archivo.
     */
    const archivos = execFileSync('git', ['ls-files', 'src', 'public'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    expect(archivos.length, 'el barrido no encontró archivos').toBeGreaterThan(10);

    /*
     * **Sin comentarios**, y esa es la mitad que hay que explicar: el docblock
     * de `urlDeCafecito` nombra `cdn.cafecito.app` justamente para dejar escrito
     * por qué no se usa, y sin este filtro el propio motivo dispararía el caso.
     * Mismo helper y mismo motivo que `tests/estilos-del-sitio.test.ts`.
     */
    const conRecurso = archivos.filter((f) =>
      /cdn\.cafecito\.app|cafecito[\w.-]*\.(?:svg|png|js)/i.test(sinComentarios(fuente(f))),
    );
    expect(
      conRecurso,
      'estos archivos referencian un recurso alojado por Cafecito, o una copia de su ' +
        'botón. A Cafecito se va por un enlace de salida; el botón lo dibuja el sitio.',
    ).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · La ruta, el chrome y el buscador
// ───────────────────────────────────────────────────────────────────────────

describe('la página entra al sitio como corresponde', () => {
  it('la ruta va con barra final, como todas (B-330)', () => {
    expect(RUTA_APOYAR).toBe('/apoyar/');
  });

  it('está en el sitemap y sin `noindex`', () => {
    /*
     * Las dos mitades de la misma señal. Es la página que contesta «¿quién hace
     * esto y cómo se sostiene?», que es lo primero que se pregunta quien llega a
     * un sitio que no conoce: esconderla del buscador sería esconder justamente
     * donde está escrito que no hace falta pagar nada.
     */
    expect(RUTAS_FIJAS).toContain(RUTA_APOYAR);
    expect(fuente(PAGINA)).not.toMatch(/<Base[^>]*\bnoIndex\b/s);
  });

  it('el pie la enlaza, y el encabezado no', () => {
    /*
     * La decisión, atada en las dos direcciones. El pie es el único link
     * permanente que necesita (mismo criterio que `/pasadas`, B-109) y la barra
     * no la lleva: una página que promete que nadie tiene que pagar nada y
     * aparece en la navegación de todas las pantallas se contradice sola.
     *
     * Si algún día se decide subirla al encabezado, este caso se pone en rojo y
     * hay que venir a decidirlo acá — que es exactamente lo que se quiere.
     */
    const pie = fuente('src/components/sitio/PieDePagina.astro');
    expect(pie).toContain('RUTA_APOYAR');

    const encabezado = sinComentarios(fuente('src/components/sitio/Encabezado.astro'));
    expect(
      encabezado,
      'si `/apoyar` sube al encabezado, actualizá el motivo en la página y en el pie',
    ).not.toContain('RUTA_APOYAR');
    // Y sí declara la sección, que es lo que le da chrome sin darle pestaña.
    expect(encabezado).toContain("'apoyar'");
  });

  it('manda a la ayuda a quien venía con otra pregunta', () => {
    // Mismo cierre que `/contacto`: una página que pide algo tiene que tener una
    // salida hacia lo que la persona probablemente buscaba.
    expect(ANTES_DE_APOYAR.href).toBe('/ayuda/');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · No se cuela nada del §5.1
// ───────────────────────────────────────────────────────────────────────────

describe('es texto libre en una salida pública (§5.1)', () => {
  it('ninguna frase trae un link de reunión, un mail o un teléfono', () => {
    /*
     * El mismo barrido que `tests/ayuda-del-sitio.test.ts`: es texto escrito a
     * mano en una página indexada, y un ejemplo bien intencionado con un dato
     * real es la trampa 5. Acá la página **no recibe ningún dato de ninguna
     * actividad** —es toda texto fijo— así que la lista de permitidos está
     * vacía y cualquier hallazgo es una fuga.
     */
    const CENTINELAS: { patron: RegExp; que: string }[] = [
      { patron: /zoom\.us|meet\.google\.com|teams\.microsoft\.com/i, que: 'link de reunión' },
      { patron: /\b\d{2,4}[-\s]?\d{4}[-\s]?\d{4}\b/, que: 'algo que parece un teléfono' },
      { patron: /\bwa\.me\//i, que: 'un WhatsApp directo' },
      { patron: /[\w.+-]+@[\w-]+\.[\w.]+/, que: 'una dirección de mail' },
    ];
    const fugas = CENTINELAS.filter((c) => TEXTO_DE_APOYO.some((t) => c.patron.test(t))).map(
      (c) => c.que,
    );
    expect(fugas, 'se colaron datos que el §5.1 no publica').toEqual([]);
  });

  it('el detector distingue: reconocería una fuga', () => {
    // Control del control. Sin esto, un regex roto haría pasar el caso de arriba
    // comparando dos listas vacías.
    expect(/[\w.+-]+@[\w-]+\.[\w.]+/.test('escribinos a hola@ejemplo.com')).toBe(true);
    expect(/zoom\.us/i.test('https://zoom.us/j/123')).toBe(true);
  });
});
