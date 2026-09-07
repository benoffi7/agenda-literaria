import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ASUNTO_COMERCIAL, CONTACTO, MOTIVOS_DE_CONTACTO, urlDeContactoComercial } from '@/lib/enlaces';
import { RUTA_ANUNCIAR, RUTA_CONTACTO } from '@/lib/rutasPublicas';
import { RUTAS_FIJAS } from '@/lib/sitemap';
import {
  ACCION_COMERCIAL,
  ANTES_DE_ESCRIBIRNOS,
  DESCRIPCION_COMERCIAL,
  DESPUES_DEL_MAIL,
  ENTRADA_COMERCIAL,
  LETRA_CHICA_COMERCIAL,
  POR_QUE_ACA,
  QUE_CONTARNOS,
  TITULO_COMERCIAL,
} from '@/lib/comercialDelSitio';

/**
 * La sección comercial `/anunciar` — B-770.
 *
 * ── Lo que hay que verificar, y por qué no se ve mirando la página ────────
 * Esta página vende algo, y **la forma en que sale mal es escribiendo un número
 * que no existe**. El sitio empezó a medir el 2026-09-03: no hay un histórico que
 * valga presentar, así que cualquier «X visitas al mes», «llegamos a N personas»
 * o «miles de lectores» sería inventado. Se ve perfectamente bien en pantalla,
 * suena mejor que la verdad, y no se puede desmentir hasta que un anunciante
 * pregunte de dónde salió.
 *
 * Es la misma clase de bug que D-138, D-159 y D-272 vienen frenando del lado de
 * los datos —mejor un dato ausente que uno que miente— entrando por la puerta que
 * ninguna proyección cubre: **texto libre en una página pública**. Por eso el
 * chequeo central de este archivo es un barrido de cifras y de palabras de
 * volumen sobre el texto, y por eso el texto es un módulo de datos y no párrafos
 * adentro del `.astro` (si se escribe en el markup, nada de esto lo mira).
 *
 * Las otras tres cosas son las de `/contacto`, porque es la misma clase de
 * página: que la dirección no esté escrita en el marcado, que el asunto sea
 * propio para poder separar el mail en la bandeja, y que el texto no tenga jerga.
 *
 * ── No es una salida numerada, y está decidido ────────────────────────────
 * `docs/07-seguridad.md` § «Las páginas de texto del sitio no son una salida
 * más»: `/ayuda` y `/contacto` no proyectan ningún documento, así que no hay
 * proyección que auditar y no llevan fila en el índice de salidas. `/anunciar` es
 * la tercera de esa clase, y **más chica todavía**: no recibe ni una prop, o sea
 * que no hay un solo dato de una actividad que pueda tocar. Lo que sí tiene es el
 * riesgo propio del texto libre, y de eso se ocupa el barrido de abajo. El texto
 * exacto para el índice está en `.estado/comercial.md`.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const PAGINA = 'src/pages/anunciar.astro';

/**
 * Todo el texto que la página muestra, que es lo que se barre.
 *
 * **El `<title>` y la `meta description` están en esta lista desde que las
 * encontró el `auditor-privacidad`**, y son el hallazgo más caro del cambio:
 * escritas en el marcado quedaban fuera de acá, o sea que el string más leído de
 * la salida —el que Google muestra en el resultado— era el único sin barrer.
 * «Leída por miles de personas» en la `meta description` salía en verde.
 */
const TEXTOS = (): string[] => [
  TITULO_COMERCIAL,
  DESCRIPCION_COMERCIAL,
  ENTRADA_COMERCIAL,
  ANTES_DE_ESCRIBIRNOS.texto,
  ...POR_QUE_ACA.flatMap((b) => [b.titulo, b.texto]),
  ...LETRA_CHICA_COMERCIAL.flatMap((b) => [b.titulo, b.texto]),
  ...QUE_CONTARNOS,
  ACCION_COMERCIAL.etiqueta,
  ACCION_COMERCIAL.asunto,
  ...DESPUES_DEL_MAIL,
];

/**
 * Las palabras con las que se afirma un tamaño de audiencia sin tener el dato.
 *
 * No están para que la página no exagere de estilo: están porque **hoy el dato no
 * existe**. El día que B-374 traiga números reales, esta lista se revisa con esos
 * números en la mano — que es distinto de sacarla porque molesta.
 */
const PALABRAS_DE_VOLUMEN = [
  'miles',
  'millones',
  'cientos',
  /*
   * Las tres de acá las pidió el `auditor-privacidad`: el barrido de cifras
   * exige un dígito, así que «mil visitas por mes», «decenas de miles de
   * personas» y «centenares de lectores» pasaban por los dos chequeos. Un número
   * escrito en palabras es el mismo número.
   */
  'mil ',
  'decenas',
  'centenares',
  'masiv',
  'multitud',
  'récord',
  'record de',
  'la más visitada',
  'el más visitado',
  'líder',
  'lider en',
];

/** Jerga de marketing: lo que se escribe cuando no hay nada concreto que decir. */
const JERGA_DE_MARKETING = [
  'potenciá',
  'potencia tu',
  'sinergia',
  'branding',
  'engagement',
  'awareness',
  'target',
  'ROI',
  'impactos',
  'audiencia calificada',
  'oportunidad única',
];

/** Jerga técnica: no le dice nada a quien tiene un café. */
const JERGA = ['§', '.ts', '.json', '.astro', 'Firestore', 'toPublic', 'slug', 'sitemap'];

/**
 * Lo que el §5.1 no publica nunca. El riesgo de una página escrita a mano es el
 * ejemplo bien intencionado, igual que en `/ayuda`.
 */
const PROHIBIDO = [
  'zoom.us/j',
  'meet.google.com/',
  'jit.si/',
  'https://',
  'http://',
  'wa.me/',
  '@gmail',
];

describe('la sección comercial `/anunciar` — B-770', () => {
  it('el barrido recorre la página entera', () => {
    /*
     * Control positivo: todo lo de abajo recorre `TEXTOS()`, y con una lista
     * corta pasaría sin haber leído nada. Es el modo de falla de B-109 (un
     * barrido que se acorta en silencio) aplicado a un módulo de texto.
     */
    expect(POR_QUE_ACA.length).toBeGreaterThanOrEqual(4);
    expect(LETRA_CHICA_COMERCIAL.length).toBeGreaterThanOrEqual(3);
    expect(QUE_CONTARNOS.length).toBeGreaterThanOrEqual(3);
    expect(TEXTOS().length).toBeGreaterThanOrEqual(20);
    expect(TEXTOS().join(' ').length).toBeGreaterThan(1500);
  });

  it('no afirma ningún número de audiencia', () => {
    /*
     * **El chequeo que justifica este archivo.** El sitio empezó a medir el
     * 2026-09-03 (B-372/B-373) y todavía no hay histórico, así que un número de
     * audiencia en esta página está inventado por definición.
     *
     * Se busca la **forma** y no una lista de frases: una cifra de dos dígitos o
     * más a menos de 40 caracteres de una palabra de audiencia. Así entra
     * «1.200 visitas», «llega a 3000 personas» y «40 mil lectores por mes», y no
     * entra «septiembre de 2026» ni «las próximas semanas», que son las cifras
     * legítimas que la página sí tiene.
     *
     * MUTACIÓN PROBADA: agregarle a `ENTRADA_COMERCIAL` la frase «Hoy la leen
     * 2.500 personas por mes» pone este caso en rojo nombrando el fragmento.
     */
    /*
     * `audiencia`, `gente` y `público` los agregó el `auditor-privacidad`, y el
     * segundo es el que más importa: **es la palabra que la propia página usa
     * para nombrar a su audiencia** («entra gente que está buscando…»), así que
     * era el camino más corto para escribir el número que este caso prohíbe.
     */
    const AUDIENCIA =
      /(?:visita|persona|lector|usuario|seguidor|suscript|vista|clic|impres|alcance|audiencia|gente|p[úu]blico)/i;
    const CIFRA = /\d[\d.,]*\s*(?:mil|millones|k\b)?/g;

    const sospechosos: string[] = [];
    for (const texto of TEXTOS()) {
      for (const m of texto.matchAll(CIFRA)) {
        // Sin la puntuación de la cola: `\d[\d.,]*` se lleva la coma de «2026,».
        const cifra = m[0].trim().replace(/[.,]+$/, '');
        // Un solo dígito no es una métrica de audiencia: es «una» o «dos cosas».
        if (!/\d\d/.test(cifra) && !/mil|millones|k$/i.test(cifra)) continue;
        /*
         * Un año **introducido** tampoco lo es, y esta página tiene uno a
         * propósito: «empezamos a medir las visitas en septiembre **de** 2026» es
         * justamente la frase honesta, y cae a dos palabras de «visitas». Sin
         * esta exención el chequeo se pone rojo contra el texto que existe para
         * cumplirlo — que es el modo de falla de B-180: un gate que falla por lo
         * correcto se aprende a saltear.
         *
         * **Y la exención tiene que mirar el contexto, no la forma** — lo
         * encontró el `auditor-privacidad`, y era un agujero de 200 valores: con
         * `/^(?:19|20)\d\d$/` sola, «2000 personas por mes» y «1950 lectores»
         * salían exentos por parecerse a un año, que es justo el orden de
         * magnitud que este sitio va a tener. Así que además de tener forma de
         * año, tiene que venir presentado como una fecha.
         *
         * MUTACIÓN PROBADA: sacar la segunda mitad de la condición deja pasar
         * «2000 personas por mes», y el caso de abajo lo dice.
         */
        const antes = texto.slice(0, m.index ?? 0);
        if (/^(?:19|20)\d\d$/.test(cifra) && /\b(?:de|en|desde|hasta)\s+$/i.test(antes)) continue;
        const desde = Math.max(0, (m.index ?? 0) - 40);
        const contexto = texto.slice(desde, (m.index ?? 0) + cifra.length + 40);
        if (AUDIENCIA.test(contexto)) sospechosos.push(`«${contexto.trim()}»`);
      }
    }

    expect(
      sospechosos,
      'la página afirma un número de audiencia y el sitio todavía no tiene uno: la ' +
        'medición arrancó el 2026-09-03 (B-372/B-373). Cuando B-374 traiga datos reales, ' +
        'este chequeo se revisa con esos datos en la mano.',
    ).toEqual([]);
  });

  it('«2000 personas por mes» no pasa por parecerse a un año', () => {
    /*
     * El control de la exención de arriba, por valor y no sobre el texto real:
     * si la exención volviera a mirar solo la forma del número, doscientos
     * valores plausibles de audiencia —justo los del orden de magnitud de este
     * sitio— entrarían sin que nada falle. Lo encontró el `auditor-privacidad`.
     */
    const AUDIENCIA =
      /(?:visita|persona|lector|usuario|seguidor|suscript|vista|clic|impres|alcance|audiencia|gente|p[úu]blico)/i;
    const CIFRA = /\d[\d.,]*\s*(?:mil|millones|k\b)?/g;

    /** El mismo predicado del caso de arriba, aplicado a un texto cualquiera. */
    const afirmaUnNumero = (texto: string): boolean => {
      for (const m of texto.matchAll(CIFRA)) {
        const cifra = m[0].trim().replace(/[.,]+$/, '');
        if (!/\d\d/.test(cifra) && !/mil|millones|k$/i.test(cifra)) continue;
        const antes = texto.slice(0, m.index ?? 0);
        if (/^(?:19|20)\d\d$/.test(cifra) && /\b(?:de|en|desde|hasta)\s+$/i.test(antes)) continue;
        const desde = Math.max(0, (m.index ?? 0) - 40);
        const contexto = texto.slice(desde, (m.index ?? 0) + cifra.length + 40);
        if (AUDIENCIA.test(contexto)) return true;
      }
      return false;
    };

    // Los que tienen que caer: cifras de audiencia con forma de año, y sin.
    expect(afirmaUnNumero('Hoy la leen 2000 personas por mes')).toBe(true);
    expect(afirmaUnNumero('Ya somos 1950 lectores')).toBe(true);
    expect(afirmaUnNumero('Tenemos una audiencia de 4.500')).toBe(true);
    expect(afirmaUnNumero('Llega a 3000 personas')).toBe(true);
    // Y los que no: la fecha de la medición y una cifra que no es de audiencia.
    expect(afirmaUnNumero('Empezamos a medir las visitas en septiembre de 2026')).toBe(false);
    expect(afirmaUnNumero('Un ciclo de 8 encuentros')).toBe(false);
  });

  it('tampoco lo insinúa con palabras de volumen', () => {
    /*
     * La otra mitad, y la que se escribe sin darse cuenta: «miles de lectores» no
     * tiene una cifra, afirma exactamente lo mismo y no se puede sostener.
     *
     * MUTACIÓN PROBADA: cambiar «gente que está buscando» por «miles de lectores
     * que buscan» en `ENTRADA_COMERCIAL` pone este caso en rojo.
     */
    for (const texto of TEXTOS()) {
      for (const palabra of PALABRAS_DE_VOLUMEN) {
        expect(
          texto.toLowerCase(),
          `«${texto.slice(0, 60)}…» insinúa un volumen que no está medido: ${palabra}`,
        ).not.toContain(palabra);
      }
    }
  });

  it('no afirma que el sitio no tenga terceros: los tiene', () => {
    /*
     * **El hallazgo P1 del `auditor-privacidad`, convertido en chequeo.** La
     * primera versión de esta página decía «hoy no tiene un solo anuncio ni un
     * script de un tercero», y es falso: las tipografías se sirven desde
     * `fonts.googleapis.com` (B-481) y `gtag.js` desde `googletagmanager.com`
     * con consentimiento (B-372). Peor: el **mismo** `index.html` trae el banner
     * que dice que usamos Google Analytics, así que la página se contradecía
     * sola, y un anunciante que abre las herramientas del navegador lo ve.
     *
     * Es la misma clase que el número inventado —una afirmación linda que el
     * propio sitio desmiente— así que va con la misma red y no con la memoria.
     * Lo que la página puede afirmar es lo que dice hoy: que **no hay un
     * anuncio, ni una red, ni un píxel**, que no armamos perfiles ni vendemos
     * datos, y que la medición es una sola y con consentimiento.
     *
     * MUTACIÓN PROBADA: devolver la frase «ni un script de un tercero» al bloque
     * `sin-perseguir` pone este caso en rojo.
     */
    const TERCEROS_NEGADOS = [
      'script de un tercero',
      'scripts de terceros',
      'sin terceros',
      'ningún tercero',
      'no hay terceros',
      'sin google analytics',
      'no usamos google analytics',
      'sin cookies',
      'no usamos cookies',
      'no hay cookies',
    ];
    for (const texto of TEXTOS()) {
      for (const frase of TERCEROS_NEGADOS) {
        expect(
          texto.toLowerCase(),
          `«${texto.slice(0, 60)}…» niega un tercero que el sitio sí tiene (${frase}): las ` +
            'tipografías salen de fonts.googleapis.com (B-481) y gtag.js de googletagmanager.com ' +
            'con consentimiento (B-372), y el banner de la misma página lo dice',
        ).not.toContain(frase);
      }
    }

    // Control positivo: el banner que contradiría la frase existe de verdad.
    const banner = readFileSync(raiz('src/components/sitio/AvisoDeCookies.astro'), 'utf8');
    expect(banner).toContain('Google Analytics');
  });

  it('dice que todavía no hay números, en vez de callarlo', () => {
    /*
     * Que no mienta no alcanza: **el silencio también engaña** en una página
     * comercial, porque quien la lee supone que si no dicen los números es porque
     * son malos, o porque los van a mandar después. La página lo dice antes de
     * que lo pregunten, y eso es lo que la hace defendible.
     */
    const letraChica = LETRA_CHICA_COMERCIAL.map((b) => `${b.titulo} ${b.texto}`)
      .join(' ')
      .toLowerCase();

    expect(letraChica).toMatch(/número|numeros|números/);
    expect(letraChica).toMatch(/medi[rmc]|medición/);
    // Y la fecha de arranque de la medición, que es el dato que sí existe.
    expect(letraChica).toContain('septiembre de 2026');
  });

  it('no promete planes ni precios: eso lo negocia una persona por mail', () => {
    /*
     * Instrucción explícita del dueño («no hagas planes ni nada»), y no una
     * preferencia de redacción: una tabla de precios en el sitio le saca la
     * negociación de las manos a quien tiene que negociar.
     *
     * Se afirma en las dos direcciones — que no aparezca un precio, y que la
     * página **diga** que no hay lista — porque la primera sola la cumple también
     * una página que dejó el tema sin mencionar.
     */
    for (const texto of TEXTOS()) {
      expect(texto, `«${texto.slice(0, 60)}…» tiene un precio`).not.toMatch(/\$\s*\d/);
      for (const palabra of ['ARS', 'por mes $', 'plan básico', 'plan premium', 'suscripción men']) {
        expect(texto.toLowerCase()).not.toContain(palabra.toLowerCase());
      }
    }

    const letraChica = LETRA_CHICA_COMERCIAL.map((b) => `${b.titulo} ${b.texto}`)
      .join(' ')
      .toLowerCase();
    expect(letraChica).toMatch(/plan/);
    expect(letraChica).toMatch(/precio|paquete/);
  });

  it('manda a `/contacto` a quien organiza actividades, que es gratis', () => {
    /*
     * La mitad de los espacios que leen esto **organizan** actividades, y
     * publicarlas en la agenda no cuesta nada. Sin esta línea la página convierte
     * un pedido gratuito en una consulta comercial, que es una confusión que sale
     * caro aclarar después — y que el dueño se comería en la bandeja.
     */
    expect(ANTES_DE_ESCRIBIRNOS.href).toBe(RUTA_CONTACTO);
    expect(RUTA_CONTACTO).toBe('/contacto/');
    expect(ANTES_DE_ESCRIBIRNOS.texto.toLowerCase()).toMatch(/no cuesta nada|gratis|sin costo/);
  });

  it('el mail sale del contrato de enlaces y con su propio asunto', () => {
    expect(ACCION_COMERCIAL.href).toBe(urlDeContactoComercial());
    expect(ACCION_COMERCIAL.href.startsWith('mailto:')).toBe(true);

    // El asunto que se muestra es el que viaja en el link: si se separan, la
    // bandeja se ordena por el que nadie ve.
    const enElLink = new URL(ACCION_COMERCIAL.href).searchParams.get('subject');
    expect(enElLink).toBe(ACCION_COMERCIAL.asunto);
    expect(ACCION_COMERCIAL.asunto).toBe(ASUNTO_COMERCIAL);

    // Y es distinto de los dos motivos del visitante, que es lo único que permite
    // separar una consulta comercial de una sugerencia sin abrirlas.
    const otros = Object.values(MOTIVOS_DE_CONTACTO).map((m) => m.asunto);
    expect(otros).not.toContain(ASUNTO_COMERCIAL);
  });

  it('la página no escribe la dirección ni el mailto a mano', () => {
    /*
     * Un `mailto:` pegado en el marcado anda igual de bien hoy: se rompe el día
     * que la casilla cambie, en una sola de las páginas, y nada falla. Es la
     * clase B-72/B-88, y el mismo chequeo que tiene `/contacto`.
     */
    const src = readFileSync(raiz(PAGINA), 'utf8');
    expect(src, `${PAGINA} tiene la dirección escrita a mano`).not.toContain(CONTACTO);
    expect(src.match(/href=["'`]mailto:/), `${PAGINA} arma un mailto a mano`).toBeNull();
  });

  it('la página no incrusta el texto: lo importa', () => {
    /*
     * La regla que sostiene todo lo de arriba. Si el próximo párrafo se escribe
     * directo en el `.astro`, ninguna de estas aserciones lo mira y la página
     * queda con una mitad verificada y otra no.
     */
    const src = readFileSync(raiz(PAGINA), 'utf8');
    expect(src).toContain("from '@/lib/comercialDelSitio'");

    const incrustados = TEXTOS().filter((t) => t.length > 40 && src.includes(t));
    expect(
      incrustados.map((t) => `${t.slice(0, 50)}…`),
      'estas frases están escritas en la página además del módulo: la copia que se ' +
        'edite sola es la que queda mintiendo',
    ).toEqual([]);
  });

  it('el texto no tiene jerga, ni técnica ni de marketing', () => {
    for (const texto of TEXTOS()) {
      for (const palabra of JERGA) {
        expect(texto, `«${texto.slice(0, 60)}…» tiene jerga técnica: ${palabra}`).not.toContain(
          palabra,
        );
      }
      for (const palabra of JERGA_DE_MARKETING) {
        expect(
          texto.toLowerCase(),
          `«${texto.slice(0, 60)}…» tiene jerga de marketing: ${palabra}`,
        ).not.toContain(palabra.toLowerCase());
      }
    }
  });

  it('no publica nada que el §5.1 prohíbe', () => {
    for (const texto of TEXTOS()) {
      for (const aguja of PROHIBIDO) {
        expect(texto, `«${texto.slice(0, 60)}…» contiene ${aguja}`).not.toContain(aguja);
      }
    }
  });

  it('cada bloque tiene ancla propia, estable y única', () => {
    // El ancla es la URL de una sección (`/anunciar#sin-numeros`): repetida, el
    // navegador salta al primero y el link lleva al lugar equivocado sin fallar.
    const ids = [...POR_QUE_ACA, ...LETRA_CHICA_COMERCIAL].map((b) => b.id);
    expect(new Set(ids).size, 'hay ids repetidos').toBe(ids.length);
    for (const id of ids) expect(id, `«${id}» no es un ancla válida`).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('ningún bloque queda sin texto', () => {
    for (const bloque of [...POR_QUE_ACA, ...LETRA_CHICA_COMERCIAL]) {
      expect(bloque.titulo.trim().length, `«${bloque.id}» sin título`).toBeGreaterThan(10);
      expect(bloque.texto.trim().length, `«${bloque.id}» sin texto`).toBeGreaterThan(80);
    }
    for (const item of QUE_CONTARNOS) expect(item.trim().length).toBeGreaterThan(20);
  });

  it('la ruta es canónica, se indexa y está en el sitemap', () => {
    /*
     * Las dos mitades de la misma señal, al revés que en `/404` y en los hubs
     * vacíos: esta página **sí** quiere ser encontrada —por otra búsqueda que las
     * actividades— así que entra al sitemap y no lleva `noIndex`. Sin la entrada,
     * una página sin links internos más que el pie vale casi nada (§2.1).
     */
    expect(RUTA_ANUNCIAR).toBe('/anunciar/');
    expect(RUTAS_FIJAS).toContain(RUTA_ANUNCIAR);

    const src = readFileSync(raiz(PAGINA), 'utf8');
    expect(src).not.toMatch(/<Base[^>]*\bnoIndex\b/s);
    // Y con chrome: una página sin encabezado ni pie no tiene cómo volver (B-229).
    expect(src).toMatch(/<Base[^>]*seccion="anunciar"/s);
  });

  it('el pie la enlaza, y el encabezado a propósito no', () => {
    /*
     * La decisión, atada: la barra de arriba es para quien busca una actividad y
     * tiene cinco enlaces (`tests/estilos-del-sitio.test.ts` fija cuáles). La
     * entrada de esta página es el pie, que es el único lugar que se ve en todas
     * las páginas sin cobrarle ancho a nadie.
     *
     * Y `'anunciar'` es una `Seccion` sin enlace en la barra: eso prende el
     * chrome sin poner un `aria-current="page"` sobre un enlace que lleva a otra
     * página.
     */
    const pie = readFileSync(raiz('src/components/sitio/PieDePagina.astro'), 'utf8');
    expect(pie).toContain('RUTA_ANUNCIAR');
    expect(pie).toContain('Anunciar en la agenda');

    const encabezado = readFileSync(raiz('src/components/sitio/Encabezado.astro'), 'utf8');
    expect(encabezado).toContain("'anunciar'");
    expect(
      encabezado.includes('RUTA_ANUNCIAR'),
      'la sección comercial entró a la barra de navegación: era una decisión (B-770), ' +
        'así que si cambió tiene que cambiar con su motivo escrito',
    ).toBe(false);
  });
});
