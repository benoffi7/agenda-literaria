/**
 * **La proyección pública de una suscripción literaria** — B-832, tajada 3.
 *
 * ── Es una whitelist, y ahí está toda la seguridad de esto ────────────────
 * §5.2 del `CLAUDE.md`, el recuadro del § 1.2 del inventario y el § 8 del PRD 3,
 * que además explica por qué acá pesa más que en los otros tres directorios:
 *
 * > «Este documento tiene más campos internos y públicos mezclados que los otros
 * > tres, así que es el que más necesita que la proyección sea explícita. Un
 * > `...pick(...)` con la lista escrita a mano.»
 *
 * Así que acá no hay un solo spread sobre el documento. Cada campo que sale está
 * escrito con su nombre, y el campo que mañana se agregue a `SuscripcionLiteraria`
 * **no sale** hasta que alguien venga a escribirlo acá. Ese es el default
 * correcto.
 *
 * ── El campo que no sale nunca ────────────────────────────────────────────
 * `contactoDeQuienCargo`, el mismo dato personal de un tercero que ya vigila el
 * barrido de librerías, y acá conviviendo con **cuatro** destinos públicos
 * —`instagram`, `whatsapp`, `mail` y el `linkDeSuscripcion`—. El centinela vive
 * en `tests/suscripcion-publica.test.ts` con el fixture
 * `tests/fixtures/centinelas-suscripcion.ts`, y el control negativo codificado es
 * el de B-212: se mete el spread y se exige que falle nombrando el campo.
 *
 * Tampoco salen `revision`, `origen`, `estado`, `creadoEn` ni
 * `publicadaAlgunaVez`: son el ciclo de vida, no la ficha.
 *
 * ── Y el campo que sale, pero **nunca como número**: el precio ────────────
 * **DEC-12**, § 6 del PRD y [D-570](../../docs/06-decisiones.md). La proyección
 * de `precio` es **un string con la frase ya armada** —«$18.000 por mes · cargado
 * el 24 de septiembre de 2026»—, que es lo que hace imposible mostrarlo sin su
 * fecha y, de arriba, lo que hace imposible filtrarlo, ordenarlo o meterlo en un
 * `Offer`: no hay número que comparar. La garantía la da la forma, no la
 * disciplina.
 *
 * ── Lo que se publica se publica **saneado** ──────────────────────────────
 * Los cuatro destinos terminan en un `href` de una página **indexada** y las URLs
 * de las imágenes en un `src`. `firestore.rules` ya acota su forma, pero la regla
 * **no itera una lista** (B-842), así que las filas de `imagenes` y los tres
 * arrays de slugs llegan sin validar elemento por elemento. Acá pasa todo por los
 * saneadores que el proyecto ya tiene —`urlSegura`, `handleInstagram`, `slugify`—
 * y lo que no pasa **se descarta**: nunca se emite algo que no se pudo verificar.
 *
 * ── Puro, y por eso barrible ──────────────────────────────────────────────
 * Sin Firestore y sin navegador. La lectura —con su
 * `where('estado','==','publicado')`— vive en `contenidoDelSitio.ts`.
 */
import { fraseConFecha, type DatoConFecha } from '@/lib/datoConFecha';
import { urlSegura, handleInstagram } from '@/lib/enlaceSeguro';
import { imagenesPublicables, portadaDe } from '@/lib/imagenes';
import { NOMBRE } from '@/lib/identidad';
import {
  RUTA_AGENDA,
  RUTA_GUIA,
  RUTA_SUSCRIPCIONES,
  esSlugDeFicha,
  rutaDeLibreria,
  rutaDeSuscripcion,
  urlAbsoluta,
} from '@/lib/rutasPublicas';
import { slugify } from '@/lib/slugify';
import { opcionesPublicas, type OpcionPublica } from '@/lib/toPublic';
import {
  MAX_ALCANCE_SUSCRIPCION,
  MAX_EXTRAS_SUSCRIPCION,
  MAX_INCLUYE_SUSCRIPCION,
  MIN_WHATSAPP_SUSCRIPCION,
  TOPE_SLUG_TAXONOMIA_SUSCRIPCION,
  TOPE_WHATSAPP_SUSCRIPCION,
  type PrecioDeSuscripcion,
  type SuscripcionLiteraria,
} from '@/types/suscripcion-literaria';
import type { ValorOpcion } from '@/types/actividad';

/**
 * Una imagen de la ficha, **sin `storagePath`**.
 *
 * Mismo recorte y mismo motivo que `ImagenDeLibreriaPublica`: `storagePath` es el
 * handle interno del objeto en Storage, y publicarlo le da a cualquiera la ruta
 * exacta de un bucket cuyo `list` está cerrado a propósito (trampa 13). El `id`
 * tampoco sale: es del editor del panel.
 */
export interface ImagenDeSuscripcionPublica {
  /** Ya saneada con `urlSegura`: lo que no era `http(s)` no llegó hasta acá. */
  url: string;
  epigrafe: string;
  ancho: number | null;
  alto: number | null;
}

/** Quién la ofrece, ya saneado. */
export interface OferentePublico {
  nombre: string;
  /** Slug de `/opciones/tipo-oferente`. La etiqueta la resuelve la ficha. */
  tipo: string;
  /** Handle sin `@`, saneado con `handleInstagram`. */
  instagram: string | null;
  /**
   * El slug de la librería que la ofrece, o `null`.
   *
   * Sale **solo si es un slug** (`esSlugDeFicha`): de acá cuelga un link a
   * `/guia/librerias/{slug}`, y una interpolación sin verificar publica una URL
   * que `getStaticPaths` no generó. Que esa librería además **esté publicada** lo
   * confirma quien arma la ficha, que es el único que tiene la lista.
   */
  libreriaSlug: string | null;
}

/** Qué manda, si manda. Los cuatro de adentro son `null` cuando `manda` es `false`. */
export interface EnvioPublico {
  manda: boolean;
  cuantos: number | null;
  tematica: string;
  /** Slug de `/opciones/perfil-editorial`. La etiqueta la resuelve la ficha. */
  editoriales: string;
  sorpresa: boolean | null;
}

/**
 * Lo que de una suscripción sale al sitio. **Whitelist: si no está acá, no sale.**
 */
export interface SuscripcionPublica {
  /** El segmento de la URL. Inmutable después de publicar — trampa 10. */
  slug: string;
  nombre: string;
  descripcion: string;
  imagenes: ImagenDeSuscripcionPublica[];
  ofrecidaPor: OferentePublico;
  /** Slug de `/opciones/periodicidad`. Eje de filtro 4 del § 5. */
  periodicidad: string;
  /** Texto libre: «Sin compromiso», «3 meses». `''` cuando no lo dice. */
  compromisoMinimo: string;
  /** Slugs de `/opciones/incluye-suscripcion`, ya filtrados. */
  incluye: string[];
  incluyeOtro: string;
  envio: EnvioPublico;
  extras: string[];
  extrasOtro: string;
  /**
   * **DEC-12 — la frase entera, nunca el número.**
   *
   * «$18.000 por mes · cargado el 24 de septiembre de 2026», o `''`. Que sea un
   * string es lo que hace que las tres reglas del § 6 del PRD se cumplan por
   * construcción: no se puede mostrar sin la fecha, no se puede filtrar, no se
   * puede ordenar y no se puede meter en un `Offer`.
   *
   * `''` cubre tres casos que desde afuera se leen igual —no hay precio, la fecha
   * no es usable, el período no se pudo nombrar— y distinguirlos obligaría a
   * publicar el número crudo para que el consumidor lo juzgue, que es justo lo
   * que esta capa existe para evitar.
   */
  precio: string;
  /** Slugs de `/opciones/alcance-envio`. Eje de filtro 3 del § 5. */
  alcance: string[];
  /** ⚠️ El destino de cobro de un tercero (§ 7). `https:` o nada. */
  linkDeSuscripcion: string | null;
  instagram: string | null;
  /** Solo dígitos: de acá sale un `wa.me/<digitos>`. */
  whatsapp: string | null;
  mail: string | null;
  /**
   * El índice de búsqueda del §6, normalizado al escribir.
   *
   * **No lleva el precio**, y eso es DEC-12 y no un olvido: el buscador del
   * listado es un filtro, y filtrar por precio afirma que los precios son
   * comparables. Lo dice también `formASuscripcion`, que es quien lo deriva.
   */
  searchText: string;
}

/**
 * Cómo se dice cada período **dentro de la frase del precio**.
 *
 * Es una segunda derivación del vocabulario de `/opciones/periodicidad` (la clase
 * de B-88) y por eso está atada: `tests/suscripcion-publica.test.ts` exige que
 * todo slug `fijo: true` de ese vocabulario en `opciones-base.json` tenga su
 * entrada acá.
 *
 * Existe porque la etiqueta de la taxonomía no sirve pegada a un monto: «$18.000
 * Mensual» no es castellano. Y el día que alguien agregue un período con «Otro»,
 * el slug no va a estar en este mapa — ahí **la frase sale sin el período**
 * («$18.000 · cargado el …») en vez de inventarle una preposición. Publicar el
 * monto sin decir de qué período es sería peor que no publicarlo, así que ese
 * caso lo resuelve `fraseDePrecio` devolviendo vacío. Ver ahí.
 */
export const TEXTO_POR_PERIODO: Record<string, string> = {
  mensual: 'por mes',
  bimestral: 'por bimestre',
  trimestral: 'por trimestre',
  anual: 'por año',
  unica: 'pago único',
};

/**
 * La frase del precio, o vacío — **la única salida del monto**.
 *
 * Tres cosas tienen que estar para que se publique, y si falta una no sale nada:
 *
 * 1. **el monto**, entero y positivo;
 * 2. **la fecha de carga usable**, que es lo que impone `fraseConFecha` (B-837):
 *    el dato huérfano desaparece en vez de salir solo;
 * 3. **el período nombrable**. Un slug que no está en `TEXTO_POR_PERIODO` es un
 *    período que no sabemos decir, y «$18.000 · cargado el 24 de septiembre» sin
 *    decir por cuánto tiempo es el dato equivocado con cara de cierto que DEC-12
 *    existe para evitar. El panel lo ve igual —el documento tiene el número— y
 *    `pideRevision` lo manda a revisar.
 *
 * El separador es el `·` del sitio (`tarjetaPublica.ts`), puesto por
 * `fraseConFecha`; el formateo del monto es `es-AR`, o sea `$18.000`.
 */
export const fraseDePrecio = (
  precio: DatoConFecha<PrecioDeSuscripcion> | null | undefined,
): string =>
  fraseConFecha(precio, (v) => {
    const periodo = TEXTO_POR_PERIODO[v.porPeriodo];
    if (!periodo) return '';
    if (!Number.isFinite(v.monto) || v.monto <= 0) return '';
    return `$${Math.round(v.monto).toLocaleString('es-AR')} ${periodo}`;
  });

/** `8–15 dígitos`, el mismo rango que la regla y el schema. */
const whatsappPublicable = (valor: string | null): string | null => {
  const digitos = (valor ?? '').replace(/\D/g, '');
  return digitos.length >= MIN_WHATSAPP_SUSCRIPCION && digitos.length <= TOPE_WHATSAPP_SUSCRIPCION
    ? digitos
    : null;
};

/** Lo mínimo para poner un `mailto:` sin publicar un link roto. */
const mailPublicable = (valor: string | null): string | null => {
  const mail = (valor ?? '').trim();
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(mail) ? mail : null;
};

/**
 * ¿Este valor es un slug de vocabulario?
 *
 * **Se contesta con `slugify` y no con un regex propio**, que es lo mismo que
 * hace `slugDeFicha`: el productor correcto de estos valores es el `slugify` del
 * §4.2, y dos definiciones de «qué es un slug» se separan sin que nada falle (la
 * clase de B-88). Lo que no pasa **se descarta**: un slug con mayúsculas no
 * resuelve etiqueta y, en los tres que son eje de filtro, deja la ficha fuera de
 * su propio chip.
 */
const esSlugDeVocabulario = (valor: unknown): valor is string =>
  typeof valor === 'string' &&
  valor.length > 0 &&
  valor.length <= TOPE_SLUG_TAXONOMIA_SUSCRIPCION &&
  slugify(valor) === valor;

/** Los slugs sanos de una lista, sin repetidos y hasta el tope de la regla. */
const slugsPublicables = (valores: readonly string[] | undefined, tope: number): string[] => [
  ...new Set((valores ?? []).filter(esSlugDeVocabulario)),
].slice(0, tope);

/**
 * Las imágenes que se pueden publicar, **con la portada primera**.
 *
 * `imagenesPublicables` y no un `urlSegura` escrito acá: es la misma pregunta que
 * ya contestan el panel, la página de detalle y la ficha de una librería, y
 * cuatro respuestas escritas a mano se separan sin que nada falle (B-854). La
 * portada se busca **después** de filtrar, para que una portada con la URL rota
 * no deje la ficha sin imagen habiendo otras sanas.
 */
const imagenesDeSuscripcion = (s: SuscripcionLiteraria): ImagenDeSuscripcionPublica[] => {
  const sanas = imagenesPublicables(s.imagenes ?? []);
  const portada = portadaDe(sanas);
  const ordenadas = portada ? [portada, ...sanas.filter((i) => i !== portada)] : sanas;
  return ordenadas.map((i) => ({
    url: urlSegura(i.url)!,
    epigrafe: i.epigrafe ?? '',
    ancho: i.ancho ?? null,
    alto: i.alto ?? null,
  }));
};

/**
 * El envío, **con el flag mandando sobre el dato** — la tercera instancia del par
 * flag + dato, después de `urlPublica` y `material.items[].publico`.
 *
 * ⚠️ **Y la clase no tiene red todavía.** Lo señaló el `auditor-privacidad`, y este
 * docblock afirmaba lo contrario: `tests/clases-de-bug.test.ts` **no** tiene un
 * `describe` de esta clase. Lo que hay es cobertura **por instancia** —acá en
 * `tests/suscripcion-publica.test.ts` y en el armado, las dos con mutación
 * probada—, así que el cuarto par que alguien escriba se va a escribir confiando
 * en algo que no está puesto. Anotado para el backlog.
 *
 * Si `manda` es `false`, los cuatro campos salen vacíos aunque el documento tenga
 * algo adentro. Sin esto, una suscripción que dejó de mandar libros publica «novela
 * negra» de algo que ya no manda nada: el flag dice una cosa y el dato otra, y la
 * página elige mal el día que alguien lea el campo sin mirar el flag.
 */
const envioPublico = (s: SuscripcionLiteraria): EnvioPublico => {
  const envio = s.envio;
  const manda = envio?.manda === true;
  if (!manda) {
    return { manda: false, cuantos: null, tematica: '', editoriales: '', sorpresa: null };
  }
  const cuantos = typeof envio.cuantos === 'number' && Number.isFinite(envio.cuantos)
    ? Math.trunc(envio.cuantos)
    : null;
  return {
    manda: true,
    cuantos: cuantos !== null && cuantos > 0 ? cuantos : null,
    tematica: envio.tematica ?? '',
    editoriales: esSlugDeVocabulario(envio.editoriales) ? envio.editoriales : '',
    sorpresa: typeof envio.sorpresa === 'boolean' ? envio.sorpresa : null,
  };
};

/**
 * Documento → ficha pública. **Campo por campo, sin un solo spread.**
 *
 * No recibe el id del documento y eso es deliberado: la ficha se direcciona por
 * `slug` (trampa 10) y el id de Firestore no tiene ningún consumidor público.
 */
export const suscripcionPublica = (s: SuscripcionLiteraria): SuscripcionPublica => ({
  slug: s.slug,
  nombre: s.nombre,
  descripcion: s.descripcion ?? '',
  imagenes: imagenesDeSuscripcion(s),
  ofrecidaPor: {
    nombre: s.ofrecidaPor?.nombre ?? '',
    tipo: esSlugDeVocabulario(s.ofrecidaPor?.tipo) ? s.ofrecidaPor.tipo : '',
    instagram: handleInstagram(s.ofrecidaPor?.instagram),
    libreriaSlug: esSlugDeFicha(s.ofrecidaPor?.libreriaSlug) ? s.ofrecidaPor.libreriaSlug : null,
  },
  periodicidad: esSlugDeVocabulario(s.periodicidad) ? s.periodicidad : '',
  compromisoMinimo: s.compromisoMinimo ?? '',
  incluye: slugsPublicables(s.incluye, MAX_INCLUYE_SUSCRIPCION),
  incluyeOtro: s.incluyeOtro ?? '',
  envio: envioPublico(s),
  extras: slugsPublicables(s.extras, MAX_EXTRAS_SUSCRIPCION),
  extrasOtro: s.extrasOtro ?? '',
  // DEC-12 — la frase, nunca el número. Ver `fraseDePrecio`.
  precio: fraseDePrecio(s.precio),
  alcance: slugsPublicables(s.alcance, MAX_ALCANCE_SUSCRIPCION),
  // ⚠️ `https:` y solo `https:` (§ 9.7 del PRD). `urlSegura` deja pasar `http://`
  // para el resto del sitio; acá el destino es una página de cobro.
  linkDeSuscripcion: (() => {
    const url = urlSegura(s.linkDeSuscripcion);
    return url && url.startsWith('https://') ? url : null;
  })(),
  instagram: handleInstagram(s.instagram),
  whatsapp: whatsappPublicable(s.whatsapp),
  mail: mailPublicable(s.mail),
  searchText: s.searchText ?? '',
});

// ─────────────────────────────────────────────────────────────────
// El índice: `/suscripciones.json`
// ─────────────────────────────────────────────────────────────────

/**
 * Los tres ejes de filtro con vocabulario del § 5 del PRD, **en el orden en que
 * el PRD los pone**: editoriales, alcance y periodicidad.
 *
 * El primero de los cuatro filtros —«¿manda libros?»— no está acá porque no es un
 * vocabulario: es el booleano `envio.manda`, y el chip lo arma la island sin
 * consultar ninguna taxonomía.
 *
 * Es una lista y no tres campos sueltos para que el índice, los chips y el
 * recorte por uso se escriban una sola vez. Que sean **estas tres** lo fija
 * `tests/suscripcion-publica.test.ts`.
 */
export const EJES_DE_SUSCRIPCION = ['perfil-editorial', 'alcance-envio', 'periodicidad'] as const;
export type EjeDeSuscripcion = (typeof EJES_DE_SUSCRIPCION)[number];

/**
 * El artefacto que baja el listado — § 5 del PRD.
 *
 * **Propio y no adentro de `events.json`**, por lo mismo que el de librerías:
 * aquél lo baja **toda** persona que abre la agenda, y sumarle un catálogo que el
 * 90% no va a mirar le cobra el peso a la mayoría.
 *
 * `filtros` viaja adentro por lo mismo que las opciones viajan en el
 * `events.json` (§4.4): los chips se arman recorriéndolo, así que una etiqueta
 * renombrada aparece sola y nada queda hardcodeado en la island.
 */
export interface IndiceDeSuscripciones {
  generadoEn: string;
  version: string;
  /** Solo los valores **con alguna suscripción publicada detrás**: un chip vacío es ruido. */
  filtros: Record<EjeDeSuscripcion, OpcionPublica[]>;
  suscripciones: SuscripcionPublica[];
}

/** De qué campo de la ficha sale cada eje. Un solo lugar, y de él salen el recorte y los chips. */
const VALORES_DEL_EJE: Record<EjeDeSuscripcion, (s: SuscripcionPublica) => string[]> = {
  'perfil-editorial': (s) => (s.envio.editoriales ? [s.envio.editoriales] : []),
  'alcance-envio': (s) => s.alcance,
  periodicidad: (s) => (s.periodicidad ? [s.periodicidad] : []),
};

/**
 * Arma el índice.
 *
 * Los vocabularios se recortan a los valores que alguna ficha usa —y no la
 * taxonomía entera— por lo mismo que los barrios del directorio de librerías:
 * cada chip sin fichas detrás es una promesa de cero resultados. Es el mismo
 * criterio con el que un hub sin nada vigente no entra al sitemap (B-108).
 *
 * El orden lo decide la taxonomía (`opcionesPublicas` respeta el de `/opciones`),
 * no este módulo: es el mismo orden que el desplegable del panel.
 */
export const construirIndiceDeSuscripciones = ({
  suscripciones,
  vocabularios,
  version,
  generadoEn,
}: {
  suscripciones: readonly SuscripcionPublica[];
  vocabularios: Partial<Record<EjeDeSuscripcion, readonly ValorOpcion[]>>;
  version: string;
  generadoEn: string;
}): IndiceDeSuscripciones => {
  const filtros = Object.fromEntries(
    EJES_DE_SUSCRIPCION.map((eje) => {
      const usados = new Set(suscripciones.flatMap((s) => VALORES_DEL_EJE[eje](s)));
      return [eje, opcionesPublicas([...(vocabularios[eje] ?? [])]).filter((v) => usados.has(v.slug))];
    }),
  ) as Record<EjeDeSuscripcion, OpcionPublica[]>;

  return {
    generadoEn,
    version,
    filtros,
    suscripciones: [...suscripciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
};

// ─────────────────────────────────────────────────────────────────
// La ficha: `/guia/suscripciones/{slug}`
// ─────────────────────────────────────────────────────────────────

/**
 * Lo que la página de una suscripción necesita, y **nada más** — el view-model de
 * D-140.
 *
 * La plantilla `.astro` no ve el documento ni la proyección cruda: recibe esto,
 * con los `href` ya armados y las etiquetas ya resueltas. Es la misma frontera
 * que `DetallePublico` le pone a `actividad/[slug].astro`, y lo que hace que la
 * salida sea barrible desde un test (un `.astro` no se importa desde vitest).
 */
export interface FichaDeSuscripcion {
  slug: string;
  nombre: string;
  descripcion: string;
  imagenes: ImagenDeSuscripcionPublica[];
  ofrecidaPor: {
    nombre: string;
    /** La etiqueta del tipo ya resuelta: la página no ve la taxonomía. */
    tipo: string;
    /** El `href` del perfil, o `null`. */
    instagram: string | null;
    /**
     * A dónde lleva la librería que la ofrece, o `null`.
     *
     * **Solo si esa librería está publicada.** Lo decide quien arma la ficha, que
     * es el único que tiene la lista de librerías del build: linkear a ciegas
     * publicaría un 404 en cada ficha cuya librería todavía espera decisión. Es
     * el mismo criterio que `rutaDelBarrio` en la ficha de una librería.
     */
    ruta: string | null;
  };
  /** La etiqueta de la periodicidad, ya resuelta. */
  periodicidad: string;
  compromisoMinimo: string;
  /** Etiquetas, no slugs. */
  incluye: string[];
  incluyeOtro: string;
  envio: {
    manda: boolean;
    cuantos: number | null;
    tematica: string;
    /** La etiqueta del perfil editorial, ya resuelta. */
    editoriales: string;
    sorpresa: boolean | null;
  };
  extras: string[];
  extrasOtro: string;
  /** DEC-12 — la frase con su fecha, o `''`. Nunca un número. */
  precio: string;
  alcance: string[];
  /**
   * La acción de la ficha — **criterio de aceptación 9 del PRD: nombra a quién le
   * estás comprando.**
   *
   * «Suscribite en la página de Eterna Cadencia», no «Suscribite». Una ficha con
   * un botón grande que dice «Suscribite» es un endoso, y el proyecto no
   * respalda el cobro de un tercero: es la lección de B-780/B-781.
   *
   * `null` cuando no hay link, y entonces la ficha manda a los contactos. Que el
   * texto viva en el view-model y no en la plantilla es lo que hace que el
   * barrido lo vea (§ 21 de `07-seguridad.md`, la lección de `descripcionDelMes`).
   */
  accion: { texto: string; href: string } | null;
  /** Los tres contactos, ya como destino. `null` es «no hay por dónde». */
  enlaces: {
    instagram: string | null;
    whatsapp: string | null;
    mail: string | null;
  };
  /** La ruta relativa, en la forma que contesta 200 (B-330). */
  ruta: string;
  /** La absoluta: el `url` del JSON-LD. La canónica y el OG los pone `Base.astro`. */
  url: string;
}

/** Cómo se resuelve la etiqueta de un slug. La pasa quien leyó `/opciones/*`. */
export interface EtiquetasDeSuscripcion {
  /** `(campo, slug) => etiqueta`. Sin respuesta, se muestra el slug. */
  etiqueta?: (campo: string, slug: string) => string | undefined;
  /** Las librerías publicadas, por slug: de eso depende si se linkea. */
  libreriasPublicadas?: ReadonlySet<string>;
}

const etiquetaDe = (
  e: EtiquetasDeSuscripcion,
  campo: string,
  slug: string,
): string => (slug ? (e.etiqueta?.(campo, slug) ?? slug) : '');

/**
 * Proyección → ficha. Acá se arman los `href` y se resuelven las etiquetas;
 * **no se agrega ningún campo del documento** que la proyección no haya dejado
 * pasar, que es lo que mantiene la whitelist en un solo lugar.
 */
export const fichaDeSuscripcion = (
  s: SuscripcionPublica,
  e: EtiquetasDeSuscripcion = {},
): FichaDeSuscripcion => ({
  slug: s.slug,
  nombre: s.nombre,
  descripcion: s.descripcion,
  imagenes: s.imagenes,
  ofrecidaPor: {
    nombre: s.ofrecidaPor.nombre,
    tipo: etiquetaDe(e, 'tipo-oferente', s.ofrecidaPor.tipo),
    instagram: s.ofrecidaPor.instagram
      ? `https://instagram.com/${s.ofrecidaPor.instagram}`
      : null,
    ruta:
      s.ofrecidaPor.libreriaSlug && e.libreriasPublicadas?.has(s.ofrecidaPor.libreriaSlug)
        ? rutaDeLibreria(s.ofrecidaPor.libreriaSlug)
        : null,
  },
  periodicidad: etiquetaDe(e, 'periodicidad', s.periodicidad),
  compromisoMinimo: s.compromisoMinimo,
  incluye: s.incluye.map((slug) => etiquetaDe(e, 'incluye-suscripcion', slug)),
  incluyeOtro: s.incluyeOtro,
  envio: {
    manda: s.envio.manda,
    cuantos: s.envio.cuantos,
    tematica: s.envio.tematica,
    editoriales: etiquetaDe(e, 'perfil-editorial', s.envio.editoriales),
    sorpresa: s.envio.sorpresa,
  },
  extras: s.extras.map((slug) => etiquetaDe(e, 'extras-suscripcion', slug)),
  extrasOtro: s.extrasOtro,
  precio: s.precio,
  alcance: s.alcance.map((slug) => etiquetaDe(e, 'alcance-envio', slug)),
  accion: s.linkDeSuscripcion
    ? {
        // Criterio 9: la acción dice **a dónde va**. Sin nombre de quien la
        // ofrece caería en «Suscribite» a secas, que es el endoso que el § 7
        // prohíbe; por eso el respaldo es el nombre de la suscripción y no una
        // frase sin sujeto.
        texto: `Suscribite en la página de ${s.ofrecidaPor.nombre || s.nombre}`,
        href: s.linkDeSuscripcion,
      }
    : null,
  enlaces: {
    instagram: s.instagram ? `https://instagram.com/${s.instagram}` : null,
    whatsapp: s.whatsapp ? `https://wa.me/${s.whatsapp}` : null,
    mail: s.mail ? `mailto:${s.mail}` : null,
  },
  ruta: rutaDeSuscripcion(s.slug),
  url: urlAbsoluta(rutaDeSuscripcion(s.slug)),
});

/**
 * La `meta description` de la ficha.
 *
 * ── Por qué vive acá y no en la plantilla ────────────────────────────────
 * Es la lección de `descripcionDelMes` (salida 8) y de `descripcionDeLibreria`:
 * una frase armada interpolando campos **dentro de un `.astro`** es un productor
 * de texto público que vitest no puede importar, así que no se puede barrer. Acá
 * es pura y pasa el mismo barrido de centinelas que la proyección.
 *
 * **Sin el precio**, y no por largo: es la segunda regla de DEC-12 llevada hasta
 * el final. La `meta description` es lo que Google muestra en el resultado, o sea
 * el lugar de más visibilidad y el que más tarda en refrescarse — publicar ahí un
 * número que puede tener tres meses es exactamente lo que el § 5 del PRD decide
 * no hacer con el `Offer`.
 *
 * La descripción cargada gana cuando existe: la escribió quien conoce la
 * suscripción. El respaldo es la ficha mínima —qué es, de quién y cada cuánto— y
 * no una frase de relleno: una `meta description` vacía la inventa Google con el
 * primer párrafo que encuentre.
 */
export const descripcionDeSuscripcion = (f: FichaDeSuscripcion): string => {
  if (f.descripcion) return f.descripcion;
  const quien = f.ofrecidaPor.nombre ? ` de ${f.ofrecidaPor.nombre}` : '';
  const cada = f.periodicidad ? `, ${f.periodicidad.toLowerCase()}` : '';
  const que = f.envio.manda ? 'Suscripción literaria con envío de libros' : 'Suscripción literaria';
  return `${f.nombre}: ${que.toLowerCase()}${quien}${cada}.`;
};

/**
 * La `meta description` del listado.
 *
 * Vive al lado de la anterior por lo mismo que en librerías: son las dos frases
 * de la misma salida, y separarlas dejaría la mitad barrida y la mitad no.
 *
 * El número sale de los datos y es lo único: cuántas suscripciones hay no es de
 * nadie.
 */
export const descripcionDelDirectorioDeSuscripciones = (cuantas: number): string =>
  cuantas === 0
    ? 'Suscripciones literarias en Argentina: cajas y clubes por abono, qué incluye cada uno y a dónde llegan.'
    : `${cuantas} ${cuantas === 1 ? 'suscripción literaria' : 'suscripciones literarias'} en Argentina: ` +
      'qué incluye cada una, cada cuánto llega y a dónde.';

/**
 * **`Product` con una `Offer` — y el precio afuera** (§ 5 del PRD, DEC-12).
 *
 * ── Por qué no es `BookStore` ni ningún `LocalBusiness` ──────────────────
 * Porque **no hay lugar**. `LocalBusiness` (y su subtipo `BookStore`, que es lo
 * que usa la ficha de una librería) exige `address`: es un negocio con puerta, y
 * Google lo usa para el panel local y el mapa. Una suscripción no tiene
 * dirección, así que declararla así obligaría a inventar una —o a emitir un
 * `BookStore` sin `address`, que es un lugar que no existe—. Las dos cosas
 * ensucian el dato que se geocodifica, y la segunda además compite con la ficha
 * de la librería **real** que a veces la ofrece.
 *
 * ── Por qué `Product` y no `Service` ────────────────────────────────────
 * `Service` se consideró y describe bien la mitad del catálogo —el club que da
 * acceso a encuentros y no manda nada—, pero no la otra: una caja que envía tres
 * libros por trimestre es un producto que llega a tu casa. Elegir por ficha
 * (`envio.manda ? Product : Service`) daría dos marcados distintos para la misma
 * sección, o sea dos formas que hay que mantener y cuyo error —el de la rama que
 * se use menos— no se ve nunca. `Product` los cubre a los dos: es el tipo que
 * lleva `offers` de forma natural, que es lo que esta ficha realmente publica —
 * una oferta a la que se accede por un link—, y es el que el § 5 del PRD ya
 * había elegido.
 *
 * ── Y la excepción deliberada: el precio NO va al marcado ───────────────
 * El § 5 lo argumenta y el criterio 5 lo exige con un test: Google **muestra** el
 * precio del `Offer` en el resultado de búsqueda, y un precio de tres meses en un
 * país con esta inflación se publica equivocado en el lugar de más visibilidad y
 * con la credibilidad de un dato estructurado. En la página va, con su fecha al
 * lado, donde la persona lo lee en contexto. El costo asumido es que la ficha no
 * es elegible para el resultado enriquecido de precio; el beneficio es no
 * afirmar un número que nadie mantiene. Es la misma clase de decisión que B-780.
 *
 * `sameAs` lleva los **perfiles** —el Instagram de la suscripción y el de quien
 * la ofrece— y no el WhatsApp, ni el mail, ni el `linkDeSuscripcion`: los dos
 * primeros son canales de contacto y el tercero es el destino de la oferta, que
 * ya viaja en `offers.url`. Publicarlos en el marcado los deja cosechables sin
 * que nadie abra la página.
 */
export const datosEstructuradosDeSuscripcion = (
  f: FichaDeSuscripcion,
): Record<string, unknown> => {
  const sameAs = [f.enlaces.instagram, f.ofrecidaPor.instagram].filter(
    (u): u is string => u !== null,
  );
  const marca = f.ofrecidaPor.nombre
    ? { brand: { '@type': 'Organization', name: f.ofrecidaPor.nombre } }
    : {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: f.nombre,
    url: f.url,
    ...(f.descripcion ? { description: f.descripcion } : {}),
    ...marca,
    ...(sameAs.length > 0 ? { sameAs: [...new Set(sameAs)] } : {}),
    ...(f.imagenes.length > 0 ? { image: f.imagenes.map((i) => i.url) } : {}),
    offers: {
      '@type': 'Offer',
      /*
       * **Sin `price` ni `priceCurrency`, y es el criterio de aceptación 5.** Si
       * mañana alguien los agrega, `tests/suscripcion-publica.test.ts` se cae y
       * lee por qué: un precio de tres meses publicado como dato estructurado es
       * información equivocada en el lugar de más visibilidad (§ 5 del PRD).
       */
      availability: 'https://schema.org/InStock',
      url: f.accion?.href ?? f.url,
      ...(f.ofrecidaPor.nombre
        ? { seller: { '@type': 'Organization', name: f.ofrecidaPor.nombre } }
        : {}),
    },
  };
};

/**
 * Las migas de la ficha: agenda → Guía → Suscripciones → ésta.
 *
 * Misma forma que `migasDeLibreria`: los tres ancestros existen siempre, así que
 * las posiciones son fijas.
 */
export const migasDeSuscripcion = (f: FichaDeSuscripcion): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: NOMBRE, item: urlAbsoluta(RUTA_AGENDA) },
    { '@type': 'ListItem', position: 2, name: 'Guía', item: urlAbsoluta(RUTA_GUIA) },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Suscripciones literarias',
      item: urlAbsoluta(RUTA_SUSCRIPCIONES),
    },
    { '@type': 'ListItem', position: 4, name: f.nombre, item: f.url },
  ],
});

/**
 * `CollectionPage` + `ItemList` para el listado, con la misma forma que
 * `coleccionDeLibrerias`.
 *
 * No se reusa aquella función porque arma los `item` con `rutaDeLibreria`:
 * pasarle suscripciones publicaría `/guia/librerias/{slug}` para cada una, o sea
 * un `ItemList` de URLs que dan 404. Es la misma razón por la que la proyección
 * no se generaliza.
 */
export const coleccionDeSuscripciones = (
  /*
   * Pide **solo lo que usa** —slug y nombre— y no una `SuscripcionPublica`
   * entera, y no es comodidad: un `ItemList` publica exactamente esos dos
   * campos, así que pedir el objeto completo dejaría a esta función con la
   * proyección entera en la mano y el próximo campo a un `${}` de distancia. Es
   * la misma forma con la que `rutasDelSitemap` pide slugs y no fichas.
   */
  suscripciones: readonly { slug: string; nombre: string }[],
): Record<string, unknown> | null => {
  if (suscripciones.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Suscripciones literarias',
    url: urlAbsoluta(RUTA_SUSCRIPCIONES),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: suscripciones.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: urlAbsoluta(rutaDeSuscripcion(s.slug)),
        name: s.nombre,
      })),
    },
  };
};
