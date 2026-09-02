/**
 * Los hubs — `/tipo/*`, `/barrio/*`, `/online`, `/gratis`. **B-108**, §2.1 y §4.4
 * del diseño.
 *
 * ── Para qué existen, que es lo único que este módulo hace ────────────────
 * Para **capturar búsquedas que hoy no llegan**: «taller de escritura Palermo»,
 * «club de lectura online», «actividades literarias gratis». Un filtro de la home
 * no puede ganarlas, y el §2.1 dice por qué en una línea: **no tiene URL, ni
 * `<title>`, ni `h1`**. Lo que un hub agrega no es una vista nueva de los datos
 * —es literalmente el filtro que la island ya aplica— es una **página** con esas
 * tres cosas.
 *
 * La regla con la que se decidió cuáles: «una sección merece URL propia si
 * alguien la teclea en Google como frase y si el contenido resultante es
 * distinto, no un subconjunto arbitrario» (§2.1). Lo que quedó afuera y por qué
 * está en la tabla del §2.3 — modalidad presencial, cada tipo de arancel, los
 * temas, el organizador, la ciudad.
 *
 * ── Los dos cortes, y son distintos: **emitir** y **ofrecer** ─────────────
 * Es la forma de `mesPublico.ts` (`mesesDelSitio` / `mesesEnlazables`) aplicada a
 * otro eje, y las dos preguntas tienen respuestas distintas a propósito:
 *
 * | | Pregunta | Quién contesta |
 * |---|---|---|
 * | **emitir** | ¿esta URL responde? | `hubsDelSitio` |
 * | **ofrecer** | ¿se la pide rastrear a Google, y se la enlaza? | `hubsOfrecidos` |
 *
 * **Se emite un hub de taxonomía si su slug tiene al menos una actividad
 * publicada — vigente o pasada.** Y ése es el corte que importa, porque es el que
 * hace la promesa del §4.4: *«un hub que se queda sin actividades vigentes no se
 * borra: se genera con el aviso y links a los demás. Un 404 sobre una URL
 * indexada es peor que una página honesta y vacía.»*
 *
 * Lo que hace que esa promesa se cumpla **sola** es que una actividad publicada
 * **no sale nunca del índice** (§7.1: «aparece en `/pasadas` para siempre»). O
 * sea que el conjunto de hubs emitidos solo puede crecer: una vez que
 * `/barrio/boedo` existió, existe en todos los builds siguientes. Es una garantía
 * más fuerte que la del mes, que necesita una emisión de gracia (`vencido`)
 * porque su eje es el tiempo y el tiempo pasa.
 *
 * **Se ofrece si tiene al menos una actividad vigente**, y acá el corte es 1 y no
 * 3 como en el mes. No es inconsistencia, es que el §2.2 pone el corte de tres
 * por un motivo que no aplica acá: la página de mes es *un subconjunto de la home
 * por fecha* y su consulta («agenda literaria septiembre») es de volumen bajo, así
 * que con dos actividades es un casi-duplicado que compite con la página de
 * detalle de cada una. Un hub no es un subconjunto arbitrario: `/barrio/palermo`
 * con **un** taller sigue siendo la mejor respuesta a «taller de escritura
 * palermo», que la home no puede dar porque no tiene el barrio en su `h1` ni en su
 * `<title>`. El corte, entonces, es «tiene algo que mostrar».
 *
 * ── Y la tercera pieza, que cierra el par: `noindex` ──────────────────────
 * Un hub emitido y **no** ofrecido —cero vigentes— sale con `noindex`. Es la
 * misma pareja que la página de un mes vencido (§2.2): **el sitemap dice qué se
 * ofrece y el `noindex` dice qué no se indexa si alguien llega igual**. Ofrecer
 * una página en el sitemap y pedirle a la vez que no se indexe es mandarle dos
 * señales opuestas a Google; y una lista vacía indexada es una página delgada que
 * compite con el resto del sitio.
 *
 * De ahí sale el invariante que fija `tests/hubsPublicos.test.ts`, y es el que
 * conviene tener en la cabeza: **un hub está en el sitemap si y solo si no lleva
 * `noindex`.**
 *
 * ── Los dos temáticos son fijos, y eso es una decisión ───────────────────
 * `/online` y `/gratis` **siempre** se emiten y **siempre** están en el sitemap
 * (`RUTAS_FIJAS`), incluso vacíos, a diferencia de los de taxonomía. El motivo es
 * que no salen de ninguna taxonomía: son **secciones del sitio** cuyo significado
 * no depende de los datos —«lo que se hace a distancia» y «lo que no se paga»
 * siempre quieren decir algo en una agenda literaria— y su vacío es un estado
 * pasajero de los datos, igual que `/pasadas` el día que se lanzó o `/cartelera`
 * sin ningún flyer, que están en `RUTAS_FIJAS` y pueden estar vacías. Un
 * `/barrio/x` vacío es otra cosa: es una página sobre un lugar donde no hay nada,
 * y puede haber decenas.
 *
 * ── La selección la decide `filtrarPublico`, importada ────────────────────
 * Igual que `entradasDelMes`. Qué cae en `/tipo/taller` lo decide el **mismo**
 * filtro que aplica el chip «Taller» de la home, con el mismo `cuando` por
 * defecto. Reescribirlo acá dejaría a `/tipo/taller` y a `/?tipo=taller`
 * contestando distinto sobre los mismos datos —la clase de B-88— y el día que
 * diverjan nadie se entera: las dos páginas se ven bien por separado.
 *
 * Y es lo que hace que los dos temáticos no sean un caso especial: `/online` es
 * `modalidad ∈ {virtual, híbrido}` y `/gratis` es `arancel ∈ {gratis, a la
 * gorra}`, o sea **dos chips a la vez** del filtro que ya existe. El §2.1 lo dice
 * de `/gratis`: junta los dos «a propósito, porque para quien busca caen del
 * mismo lado».
 *
 * ── Cero lecturas nuevas de Firestore ─────────────────────────────────────
 * Este módulo es **puro**: recibe las entradas del índice, las opciones y `ahora`.
 * La lectura la hizo `contenidoDelSitio()`, que está memoizada. Ochenta hubs no
 * cuestan ochenta lecturas, cuestan cero (§2.4, §3 del diseño).
 *
 * ── Es una salida pública (la 11) ─────────────────────────────────────────
 * Hereda de la 1 por el mismo mecanismo que la página de mes y `/pasadas`: su
 * entrada es `EntradaDeIndice`, la proyección más angosta del repo, así que **solo
 * puede sacar**. Lo nuevo son las frases de cada hub, y una de ellas interpola
 * títulos de actividades igual que la de la página de mes — por eso entra al
 * barrido de centinelas en el mismo cambio que la crea. Ver
 * `docs/07-seguridad.md`.
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';
import {
  CUANDO_PROXIMAS,
  ORDEN_PUBLICO_POR_DEFECTO,
  etiquetaDe,
  filtrarPublico,
  filtrosVacios,
  ordenarPublico,
  valoresDe,
  type Eje,
  type FiltrosPublicos,
  type MapaDeEtiquetas,
} from '@/lib/listadoPublico';
import {
  RUTA_GRATIS,
  RUTA_ONLINE,
  rutaDeBarrio,
  rutaDeTipo,
} from '@/lib/rutasPublicas';

// ─────────────────────────────────────────────────────────────────
// Qué hubs hay
// ─────────────────────────────────────────────────────────────────

/**
 * Las cuatro clases de hub. **No es el eje del filtro**: `online` y `gratis`
 * aplican dos valores de un eje cada uno, y `tipo`/`barrio` uno solo.
 */
export const CLASES_DE_HUB = ['tipo', 'barrio', 'online', 'gratis'] as const;
export type ClaseDeHub = (typeof CLASES_DE_HUB)[number];

/**
 * Las dos clases que se generan recorriendo una taxonomía — §2.1.
 *
 * `tipo` y `barrio` son taxonomías autogestionadas (§4), así que **una opción
 * nueva trae su hub sola, sin tocar código**. Es la mitad del valor de este ítem:
 * el día que alguien cargue una actividad en un barrio nuevo, ese barrio tiene su
 * página y su entrada de sitemap en el build siguiente.
 */
export const CLASES_DE_TAXONOMIA = ['tipo', 'barrio'] as const;
export type ClaseDeTaxonomia = (typeof CLASES_DE_TAXONOMIA)[number];

/**
 * El eje del filtro de la home que cada clase aplica, y con qué valores.
 *
 * **Es el puente con `filtrarPublico`, y por eso los cuatro hubs son el mismo
 * código.** Un hub «es el filtro hecho página» (§4.4), y esta tabla es lo que
 * hace que esa frase sea literal en vez de una metáfora: lo único que distingue
 * `/online` de `/tipo/taller` es qué eje y qué valores se le pasan al filtro que
 * ya existe.
 *
 * Los dos temáticos juntan dos valores **a propósito** (§2.1):
 *
 * | Hub | Eje | Valores | Por qué junta |
 * |---|---|---|---|
 * | `/online` | `modalidad` | `virtual`, `hibrido` | «club de lectura online» no distingue: quien busca desde otra provincia quiere poder entrar, y en un híbrido puede |
 * | `/gratis` | `arancel` | `gratis`, `a-la-gorra` | «a la gorra» es la mitad de los casos del circuito (§4.1) y para quien busca cae del mismo lado. El texto de la página aclara la diferencia |
 */
const EJE_DE_LA_CLASE: Record<ClaseDeHub, Eje> = {
  tipo: 'tipo',
  barrio: 'barrio',
  online: 'modalidad',
  gratis: 'arancel',
};

/** Los valores que aplica cada hub temático. Los de taxonomía aplican su slug. */
const VALORES_DEL_TEMATICO: Record<'online' | 'gratis', readonly string[]> = {
  online: ['virtual', 'hibrido'],
  gratis: ['gratis', 'a-la-gorra'],
};

export interface Hub {
  clase: ClaseDeHub;
  /**
   * El slug de la taxonomía, o `''` en los dos temáticos.
   *
   * **Es el slug y nunca el label** (§2.1, trampa 10): el label se renombra
   * —«Con Beca Parcial» a «Con beca parcial» no toca ningún documento (§4.1)— y
   * una URL no.
   */
  slug: string;
  /** La ruta, en la forma que contesta 200. La arma `rutasPublicas.ts`. */
  ruta: string;
  /** Las actividades **vigentes** del hub, en el orden en que se muestran. */
  entradas: EntradaDeIndice[];
  /**
   * No hay nada vigente que mostrar.
   *
   * La página **existe igual** (§4.4) y sale con `noindex`; no entra al sitemap ni
   * a ninguna tira de enlaces. Ver el encabezado de este módulo.
   */
  vacio: boolean;
  /**
   * La etiqueta de la taxonomía ya resuelta —«Taller», «Villa Crespo»—, o el
   * nombre del hub temático.
   *
   * Viaja resuelta y no como slug por lo mismo que `tipoColor` en la página de
   * detalle (D-153): quien puede resolverla es el build, que tiene el mapa de
   * etiquetas; la plantilla no lo ve (D-140). Y viaja **además** de las frases
   * porque la tira «Explorá por» necesita el nombre corto, no el `h1`.
   */
  etiqueta: string;
  /** Cómo se nombra este hub en la tira «Explorá por»: corto, sin el país. */
  textoEnLaTira: string;
  /** El `<h1>`, y la primera mitad del `<title>`. */
  titulo: string;
  /** La `meta description` del §5.1. */
  descripcion: string;
  /** El párrafo de contexto del §4.4, debajo del `h1`. */
  bajada: string;
  /** Qué dice la página cuando no hay nada vigente (§4.4). */
  avisoVacio: string;
  /**
   * El filtro que este hub aplica, dicho para la pantalla: «Tipo · Taller».
   *
   * Es el chip del §4.4 en su versión sin JavaScript — ver `CuerpoDeHub.astro`.
   */
  rotuloDelFiltro: string;
  /** La query de la home con este filtro preaplicado: `/?tipo=taller`. */
  queryEnLaAgenda: string;
}

// ─────────────────────────────────────────────────────────────────
// Los textos
// ─────────────────────────────────────────────────────────────────

/**
 * El plural de cada tipo base, **por slug**.
 *
 * ── Por qué una tabla y no una regla ─────────────────────────────────────
 * Porque el §5.1 pide `{Label en plural} en Argentina` y el plural del castellano
 * no es una `s`: «Club de lectura» → «Clubes de lectura» (irregular y en la
 * cabeza del sintagma), «Presentación» → «Presentaciones» (se pierde el acento),
 * «Librería a la calle» → «Librerías a la calle» (el plural va en la **primera**
 * palabra, no en la última). Una regla ingenua produce «Librería a la calles», y
 * eso queda en el `<title>` de una página indexada.
 *
 * ── Y la clave es el slug, no el label ───────────────────────────────────
 * Por lo mismo que la URL: el label se renombra y el slug no (§4.1). Con el label
 * como clave, renombrar «Taller» a «Taller de escritura» dejaría el plural sin
 * resolver y el título saldría en singular, sin que nada falle.
 *
 * ── Qué pasa con un tipo nuevo ───────────────────────────────────────────
 * `tests/hubsPublicos.test.ts` exige que **todo tipo `fijo` de
 * `opciones-base.json` tenga su plural acá**, así que una opción base nueva no
 * puede entrar sin decidirlo. Para una opción creada desde «Otro» —que no está en
 * el archivo base y no se puede prever— el respaldo es **el label tal cual**: el
 * título queda en singular, que se lee un poco raro y es correcto, en vez de
 * inventar una `s` que puede quedar mal. Es el mismo criterio del error inofensivo
 * que este repo usa en todos lados: ante la duda, la respuesta que no miente.
 */
export const TIPO_EN_PLURAL: Record<string, string> = {
  taller: 'Talleres',
  'club-lectura': 'Clubes de lectura',
  encuentro: 'Encuentros',
  presentacion: 'Presentaciones',
  charla: 'Charlas',
  feria: 'Ferias',
  'libreria-a-la-calle': 'Librerías a la calle',
};

/**
 * El párrafo de contexto de cada tipo, escrito a mano — §4.4.
 *
 * El diseño lo pide con estas palabras: «un párrafo de contexto por hub, con algo
 * de texto real (no "12 resultados"): es lo que diferencia la página del filtro
 * para el buscador y para una persona». Y aclara cuáles van escritos: «los de
 * tipo y los dos temáticos van a mano; los de barrio pueden tener el párrafo
 * autogenerado con el nombre del barrio».
 *
 * **No dicen cuántos hay.** El número está en la `meta description` y en la línea
 * de arriba; repetirlo acá gastaría la única frase de la página que puede decir
 * algo que no se deduce de la lista.
 *
 * El respaldo para un tipo nuevo es una frase genérica: ver `bajadaDeTipo`.
 */
export const CONTEXTO_DE_TIPO: Record<string, string> = {
  taller:
    'Un taller es un grupo que escribe y se lee. Se cursa por encuentros, casi ' +
    'siempre semanales, y quien lo da lee lo que escribís y te devuelve algo.',
  'club-lectura':
    'En un club de lectura se lee el mismo libro y se conversa. La lectura se ' +
    'reparte antes del encuentro, así que se puede entrar sabiendo qué toca.',
  encuentro:
    'Encuentros de una vez: lecturas en voz alta, micrófonos abiertos, ciclos ' +
    'que juntan a quien escribe con quien lee.',
  presentacion:
    'Un libro que sale y se presenta, casi siempre con quien lo escribió y ' +
    'alguien que lo acompaña. Suelen ser gratis y de una sola fecha.',
  charla:
    'Charlas y conversaciones con autoras y autores: menos taller y más ' +
    'escucha, sin cursada ni material previo.',
  feria:
    'Ferias de editoriales independientes: mesas, catálogos y la posibilidad de ' +
    'hablar con quien edita los libros que se llevan.',
  'libreria-a-la-calle':
    'Librerías que sacan las mesas a la vereda. Un día, una cuadra, y libros ' +
    'que no se encuentran en otra parte.',
};

/** Cuántas actividades, dicho bien en singular y en plural. */
const cuantas = (n: number): string => `${n} ${n === 1 ? 'actividad' : 'actividades'}`;

/**
 * Cuántos títulos entran en la `meta description` — el mismo corte que la página
 * de mes (§5.1), y por el mismo motivo: el largo útil son ~160 caracteres, y lo
 * que se gana con el cuarto título es que se corte el tercero.
 */
export const CUANTOS_TITULOS_EN_LA_DESCRIPCION = 3;

const tresTitulos = (entradas: readonly EntradaDeIndice[]): string =>
  entradas
    .slice(0, CUANTOS_TITULOS_EN_LA_DESCRIPCION)
    .map((e) => e.titulo)
    .join(', ');

/** El plural del tipo, o el label tal cual si es una opción que no previmos. */
export const pluralDeTipo = (slug: string, etiqueta: string): string =>
  TIPO_EN_PLURAL[slug] ?? etiqueta;

const bajadaDeTipo = (slug: string, plural: string): string =>
  CONTEXTO_DE_TIPO[slug] ??
  `${plural} de la agenda literaria: se publican a mano, una por una, con su fecha y su lugar.`;

/** Cómo se llama cada hub temático, que no sale de ninguna taxonomía. */
const NOMBRE_DEL_TEMATICO: Record<'online' | 'gratis', string> = {
  online: 'Online',
  gratis: 'Gratis y a la gorra',
};

/** La etiqueta del hub: la de la taxonomía, o el nombre del temático. */
const etiquetaDelHub = (clase: ClaseDeHub, slug: string, etiqueta: string): string =>
  clase === 'online' || clase === 'gratis' ? NOMBRE_DEL_TEMATICO[clase] : etiqueta;

/**
 * El texto de un hub en la tira «Explorá por»: el plural, el nombre del barrio,
 * «Online», «Gratis y a la gorra».
 *
 * Es más corto que el `h1` a propósito: en la tira hay veinte de estos en fila y
 * lo que se lee es el nombre, no la frase. «Talleres en Argentina» repetido veinte
 * veces con el país en cada uno es ruido.
 *
 * Los de tipo van **en plural** —«Talleres», no «Taller»— porque la tira es una
 * lista de secciones y no un filtro: «Taller» suena a un chip que se tilda.
 */
const textoEnLaTira = (clase: ClaseDeHub, slug: string, etiqueta: string): string => {
  if (clase === 'online' || clase === 'gratis') return NOMBRE_DEL_TEMATICO[clase];
  return clase === 'tipo' ? pluralDeTipo(slug, etiqueta) : etiqueta;
};

// ─────────────────────────────────────────────────────────────────
// Armar un hub
// ─────────────────────────────────────────────────────────────────

/** Los filtros de la home que este hub aplica. Es el puente con `filtrarPublico`. */
export const filtrosDelHub = (clase: ClaseDeHub, slug: string): FiltrosPublicos => {
  const filtros = filtrosVacios();
  const valores =
    clase === 'online' || clase === 'gratis' ? VALORES_DEL_TEMATICO[clase] : [slug];
  filtros.valores[EJE_DE_LA_CLASE[clase]] = [...valores];
  // Explícito y no por default: el hub muestra lo **vigente** (§2.2 del mapa de
  // URLs, «un hub por slug con actividad vigente»). Lo que ya pasó vive en
  // `/pasadas`, que es la página que existe para que no quede huérfano.
  filtros.cuando = CUANDO_PROXIMAS;
  return filtros;
};

/**
 * La query de la home con el filtro de este hub puesto: `?tipo=taller`.
 *
 * Es lo que hace posible el «buscar dentro» del §4.4 **sin una island**: el hub no
 * lleva JavaScript, así que el buscador que ofrece es el de la home, ya filtrado.
 * Se arma con `URLSearchParams` y no a mano para que coincida con lo que
 * `desdeQuery` sabe leer — si no coincidiera, el link llevaría a la home sin
 * filtrar y nadie lo notaría.
 */
const queryDelHub = (clase: ClaseDeHub, slug: string): string => {
  const filtros = filtrosDelHub(clase, slug);
  const eje = EJE_DE_LA_CLASE[clase];
  return `?${new URLSearchParams({ [eje]: filtros.valores[eje].join(',') }).toString()}`;
};

/** La ruta de un hub, siempre desde `rutasPublicas.ts`. */
export const rutaDelHub = (clase: ClaseDeHub, slug: string): string => {
  if (clase === 'online') return RUTA_ONLINE;
  if (clase === 'gratis') return RUTA_GRATIS;
  return clase === 'tipo' ? rutaDeTipo(slug) : rutaDeBarrio(slug);
};

/**
 * Las frases de un hub. **Una función y no cuatro**, porque las cuatro clases
 * comparten la forma y solo cambian las palabras: así el barrido de centinelas
 * cubre las cuatro con una sola llamada.
 */
const frasesDelHub = (
  clase: ClaseDeHub,
  slug: string,
  etiqueta: string,
  entradas: readonly EntradaDeIndice[],
): Pick<Hub, 'titulo' | 'descripcion' | 'bajada' | 'avisoVacio' | 'rotuloDelFiltro'> => {
  const n = entradas.length;
  const titulos = tresTitulos(entradas);
  /** «: Taller de crónica, Club de lectura de Saer.» — o nada si no hay ninguna. */
  const cola = titulos ? `: ${titulos}.` : '.';
  /**
   * **Con la lista vacía la cuenta no se escribe.**
   *
   * «0 librerías a la calle con fecha próxima» es cierto y se lee como un error de
   * software, que es lo peor que puede decir la única frase que Google muestra
   * debajo del título. El hub vacío lleva `noindex`, así que esta descripción casi
   * nunca se ve — pero «casi nunca» incluye el link pegado en un chat, donde el
   * `og:description` sale de acá.
   *
   * Lo apareció mirando el HTML construido, no un test.
   */
  const conCuenta = (frase: string, vacia: string): string => (n === 0 ? vacia : frase);

  if (clase === 'tipo') {
    const plural = pluralDeTipo(slug, etiqueta);
    const enMinuscula = plural.toLowerCase();
    return {
      titulo: `${plural} en Argentina`,
      descripcion: conCuenta(
        `${n} ${enMinuscula} con fecha próxima${cola}`,
        `${plural} en la agenda literaria de Argentina. Ahora no hay ninguno con fecha próxima.`,
      ),
      bajada: bajadaDeTipo(slug, plural),
      avisoVacio: `Ahora no hay ${enMinuscula} con fecha próxima.`,
      rotuloDelFiltro: `Tipo · ${etiqueta}`,
    };
  }

  if (clase === 'barrio') {
    return {
      titulo: `Actividades literarias en ${etiqueta}`,
      /*
       * El §5.1 pide `Talleres, clubes de lectura y encuentros en {Barrio}. {N}
       * con fecha próxima.` — se conserva la enumeración porque es lo que hace
       * match con las tres consultas más comunes del barrio, y se le agregan los
       * títulos que el resto de las páginas ya ponen.
       */
      descripcion: conCuenta(
        `Talleres, clubes de lectura y encuentros en ${etiqueta}. ${cuantas(n)} con fecha próxima${cola}`,
        `Talleres, clubes de lectura y encuentros en ${etiqueta}. Ahora no hay ninguna con fecha próxima.`,
      ),
      // Autogenerada con el nombre del barrio, que es lo que el §4.4 permite.
      bajada:
        `Lo que se hace en ${etiqueta}: talleres de escritura, clubes de lectura, ` +
        'encuentros y presentaciones, con la dirección y cómo llegar en cada una.',
      avisoVacio: `Ahora no hay actividades con fecha próxima en ${etiqueta}.`,
      rotuloDelFiltro: `Barrio · ${etiqueta}`,
    };
  }

  if (clase === 'online') {
    return {
      titulo: 'Talleres y clubes de lectura online',
      descripcion: conCuenta(
        `${cuantas(n)} literarias que se hacen a distancia, desde cualquier provincia${cola}`,
        'Talleres de escritura y clubes de lectura que se cursan a distancia, desde cualquier provincia.',
      ),
      bajada:
        'Actividades que se cursan a distancia, y también las híbridas: las que ' +
        'tienen sede pero se pueden seguir por videollamada. El link de la reunión ' +
        'lo manda quien organiza al anotarse, nunca se publica acá.',
      avisoVacio: 'Ahora no hay actividades a distancia con fecha próxima.',
      rotuloDelFiltro: 'Cómo se cursa · A distancia',
    };
  }

  return {
    titulo: 'Actividades literarias gratis y a la gorra',
    descripcion: conCuenta(
      `${cuantas(n)} literarias sin costo de entrada o a la gorra${cola}`,
      'Talleres, clubes de lectura y encuentros literarios gratis o a la gorra en Argentina.',
    ),
    /*
     * «El texto de la página aclara la diferencia» — §2.1, textual. Juntar gratis
     * y a la gorra es correcto para quien busca y **no** es lo mismo, así que la
     * página lo dice: en una a la gorra se pone lo que se puede, y eso es parte de
     * cómo se sostiene el circuito.
     */
    bajada:
      'Dos cosas distintas que caen del mismo lado cuando uno busca: lo que es ' +
      'gratis y lo que va a la gorra. En una actividad a la gorra se deja lo que ' +
      'se puede al terminar, y eso es lo que la sostiene: no es un precio, y ' +
      'tampoco es gratis.',
    avisoVacio: 'Ahora no hay actividades gratis ni a la gorra con fecha próxima.',
    rotuloDelFiltro: 'Arancel · Gratis o a la gorra',
  };
};

/**
 * Un hub armado: la selección y las frases.
 *
 * La selección es **la del filtro de la home, importada** —ver el encabezado— y el
 * orden es el mismo del listado (`ORDEN_PUBLICO_POR_DEFECTO`, por próxima fecha):
 * un hub es la home filtrada, así que ordenarlo distinto lo haría parecer otra
 * cosa sin ser otra cosa.
 */
export const hubDelSitio = (
  clase: ClaseDeHub,
  slug: string,
  entradas: readonly EntradaDeIndice[],
  etiquetas: MapaDeEtiquetas,
  ahora: Date,
): Hub => {
  const filtradas = ordenarPublico(
    filtrarPublico(entradas, filtrosDelHub(clase, slug), ahora),
    ORDEN_PUBLICO_POR_DEFECTO,
    ahora,
  );
  /*
   * La etiqueta se **resuelve** con el mapa que le pasen, que en el build es el de
   * las opciones ya filtradas por aprobación (el mismo del listado). Sin etiqueta
   * `etiquetaDe` cae a `desSlug`, así que un slug sin opción igual produce un
   * título legible en vez de la página en blanco.
   */
  const etiqueta = etiquetaDe(etiquetas, clase === 'barrio' ? 'barrio' : 'tipo', slug);

  return {
    clase,
    slug,
    ruta: rutaDelHub(clase, slug),
    entradas: filtradas,
    vacio: filtradas.length === 0,
    etiqueta: etiquetaDelHub(clase, slug, etiqueta),
    textoEnLaTira: textoEnLaTira(clase, slug, etiqueta),
    ...frasesDelHub(clase, slug, etiqueta, filtradas),
    queryEnLaAgenda: queryDelHub(clase, slug),
  };
};

// ─────────────────────────────────────────────────────────────────
// Qué hubs emite el build, y cuáles se ofrecen
// ─────────────────────────────────────────────────────────────────

/**
 * Los slugs de una taxonomía que **tienen al menos una actividad publicada**,
 * vigente o pasada, en el orden en que la taxonomía los declara.
 *
 * ── Las dos condiciones, y las dos importan ──────────────────────────────
 * 1. **Que la opción esté en la lista** que viaja en el índice, o sea ya filtrada
 *    por aprobación (§4.3). Es la misma regla que los chips: *ofrecer un hub es
 *    publicar vocabulario*, y una opción pendiente de aprobar no se ofrece. La
 *    asimetría con `etiquetaDe` —que resuelve con la lista sin filtrar— es la de
 *    D-30, y las dos mitades siguen valiendo: se filtra lo **elegible**, nunca la
 *    lista con la que se **resuelve** un slug a su etiqueta.
 * 2. **Que alguna actividad publicada lo use.** Sin esto habría una página
 *    indexada por cada valor del vocabulario, incluidas las que nadie usó nunca:
 *    páginas delgadas, sin contenido y sin motivo.
 *
 * El orden es el de la taxonomía y no el de aparición en los datos: es el orden
 * que el dueño puede acomodar desde Opciones (§4.3), y el que hace que la tira de
 * enlaces no se reacomode sola en cada build.
 */
export const slugsConHub = (
  clase: ClaseDeTaxonomia,
  entradas: readonly EntradaDeIndice[],
  opciones: Readonly<Record<string, readonly { slug: string }[]>>,
): string[] => {
  const usados = new Set<string>();
  for (const e of entradas) for (const v of valoresDe(e, clase)) if (v) usados.add(v);
  return (opciones[clase] ?? []).map((o) => o.slug).filter((slug) => usados.has(slug));
};

/**
 * **Todos los hubs que el build emite**, en el orden en que se muestran: los dos
 * temáticos, los de tipo y los de barrio.
 *
 * Ver el encabezado para el corte. La propiedad que sostiene la promesa del §4.4
 * es que el conjunto **solo puede crecer**: una actividad publicada no sale nunca
 * del índice (§7.1), así que un hub que existió una vez existe en todos los builds
 * siguientes y su URL no puede volverse un 404.
 */
export const hubsDelSitio = (
  entradas: readonly EntradaDeIndice[],
  opciones: Readonly<Record<string, readonly { slug: string }[]>>,
  etiquetas: MapaDeEtiquetas,
  ahora: Date,
): Hub[] => [
  hubDelSitio('online', '', entradas, etiquetas, ahora),
  hubDelSitio('gratis', '', entradas, etiquetas, ahora),
  ...CLASES_DE_TAXONOMIA.flatMap((clase) =>
    slugsConHub(clase, entradas, opciones).map((slug) =>
      hubDelSitio(clase, slug, entradas, etiquetas, ahora),
    ),
  ),
];

/**
 * Los hubs que se le **ofrecen** al buscador y que las tiras de enlaces
 * muestran: los que tienen algo vigente, más los dos temáticos siempre.
 *
 * Los dos temáticos entran vacíos porque son secciones del sitio y viven en
 * `RUTAS_FIJAS` (ver el encabezado). Los de taxonomía, no: un `/barrio/x` sin nada
 * vigente sale con `noindex` y fuera del sitemap, que son las dos mitades de la
 * misma señal.
 */
export const hubsOfrecidos = (
  entradas: readonly EntradaDeIndice[],
  opciones: Readonly<Record<string, readonly { slug: string }[]>>,
  etiquetas: MapaDeEtiquetas,
  ahora: Date,
): Hub[] => hubsDelSitio(entradas, opciones, etiquetas, ahora).filter(esIndexable);

/**
 * ¿Este hub se indexa? — y por lo tanto, ¿entra al sitemap?
 *
 * **Las dos preguntas tienen una sola respuesta, y eso es el invariante.** Un hub
 * en el sitemap sin `noindex` y un hub con `noindex` fuera del sitemap son las dos
 * mitades coherentes; cualquier otra combinación le manda a Google dos señales
 * opuestas. `tests/hubsPublicos.test.ts` lo fija en las dos direcciones.
 *
 * Los temáticos son siempre indexables: son secciones del sitio, no una página
 * sobre un valor de taxonomía que puede quedar sin nada.
 */
export const esIndexable = (hub: Hub): boolean =>
  hub.clase === 'online' || hub.clase === 'gratis' || !hub.vacio;

// ─────────────────────────────────────────────────────────────────
// La tira «Explorá por»
// ─────────────────────────────────────────────────────────────────

/**
 * **«Explorá por» no es decorativo** — §4.1, textual: «es la navegación sin
 * JavaScript, y es el linkeo interno que hace que los hubs existan para Google».
 *
 * Sin esta tira los hubs serían páginas en el sitemap sin un solo enlace interno,
 * y una página sin enlaces internos vale casi nada para un buscador aunque
 * responda — es el mismo argumento con el que el §2.1 justifica `/pasadas`.
 *
 * ── Por qué no se recorta ────────────────────────────────────────────────
 * La tentación con veinte barrios es cortar en los diez primeros. **No se corta**,
 * y el motivo es estructural y no estético: esta tira es el **único** enlace
 * interno que un hub tiene, así que recortarla dejaría huérfanos justamente a los
 * hubs que quedaron afuera del corte. La densidad es además lo que el sistema
 * visual pide.
 */
export interface GrupoDeExploracion {
  /** El rótulo del grupo, en versalitas: «Por tipo», «Por barrio». */
  rotulo: string;
  enlaces: { ruta: string; texto: string }[];
}

/**
 * Los grupos de la tira, **sin el de la página que la muestra**.
 *
 * `rutaActual` saca el propio hub de su tira: un enlace a la página en la que ya
 * estás no lleva a ninguna parte y le dice a Google que esa URL se enlaza a sí
 * misma. Es lo mismo que hace la navegación entre meses con `otros`.
 *
 * Los meses llegan de afuera (`mesesEnlazables`) y no se calculan acá: este módulo
 * no sabe de meses, y el §4.1 los dibuja en la misma tira («Online · Gratis ·
 * Septiembre · Octubre») porque para quien mira son la misma pregunta.
 */
export const exploracionDelSitio = (
  hubs: readonly Hub[],
  meses: readonly { clave: string; nombre: string }[],
  rutaDeMes: (clave: string) => string,
  rutaActual?: string,
): GrupoDeExploracion[] => {
  const deClase = (clase: ClaseDeHub) =>
    hubs
      .filter((h) => h.clase === clase && h.ruta !== rutaActual)
      .map((h) => ({ ruta: h.ruta, texto: h.textoEnLaTira }));

  const grupos: GrupoDeExploracion[] = [
    { rotulo: 'Por tipo', enlaces: deClase('tipo') },
    { rotulo: 'Por barrio', enlaces: deClase('barrio') },
    { rotulo: 'Además', enlaces: [...deClase('online'), ...deClase('gratis')] },
    {
      rotulo: 'Mes por mes',
      enlaces: meses.map((m) => ({ ruta: rutaDeMes(m.clave), texto: m.nombre })),
    },
  ];

  // Un grupo sin enlaces no se pinta: un rótulo «Por barrio» sin barrios es una
  // sección vacía que se lee como algo que falta.
  return grupos.filter((g) => g.enlaces.length > 0);
};
