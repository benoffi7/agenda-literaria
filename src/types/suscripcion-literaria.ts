/**
 * Suscripciones literarias — `/suscripciones/{id}`. **PRD 3**
 * (`docs/prd/03-suscripciones-literarias.md` § 3), B-832, tajada 3.
 *
 * **La colección no lleva `/guia/`.** El documento vive en `/suscripciones/{id}`
 * y la página se sirve en `/guia/suscripciones/{slug}`, igual que en librerías:
 * `/guia/` es navegación y SEO, no modelo (`prd/README.md`).
 *
 * ⚠️ **Ojo con el nombre del archivo.** `src/lib/suscripcion.ts` ya existe y es
 * otra cosa: la página `/suscribirse`, que explica cómo suscribirse **al
 * calendario público** (B-230). El PRD dedica su § 2 entero a ese choque de
 * nombres; acá el sufijo `-literaria` es lo que impide que alguien importe el
 * que no es.
 *
 * ── Qué se reusa, y no es poco ────────────────────────────────────────────
 * El ciclo de vida entero es el de `src/lib/directorios.ts` (B-834): los tres
 * estados, el grafo de transiciones, qué campos escribe la máquina y cuándo se
 * congela el slug. `Imagen` sale de `types/actividad.ts` tal cual (**D-125**) y
 * con ella la subida, el recorte, el saneo de metadatos y la Function de
 * optimización. Y `DatoConFecha` sale de `lib/datoConFecha.ts` (**B-837**), que
 * es el mecanismo que **DEC-12** manda usar para el precio.
 *
 * ── Por qué este modelo es el más complicado de los cuatro PRDs ───────────
 * § 3.1: los otros tres describen **una cosa que existe en un lugar**; una
 * suscripción describe **una promesa a futuro**. De ahí salen las tres cosas
 * que ninguno de los otros tiene, y las tres se ven en esta interfaz:
 *
 * 1. **Campos condicionales de verdad** (`envio.*` solo vale si `envio.manda`),
 *    que es el §11 del `CLAUDE.md` — y como allá, la condición vive en el
 *    `superRefine` del schema, no en el tipo.
 * 2. **Dos vocabularios abiertos en el mismo documento**: `incluye` y `extras`.
 *    Son distintos a propósito —«un libro por mes» es lo que incluye, «10% de
 *    descuento en el local» es un extra— y mezclarlos daría un desplegable de
 *    treinta opciones inservible.
 * 3. **Un precio**, el único dato numérico y vivo de los cuatro PRDs, y por eso
 *    el único campo del proyecto que se guarda con su fecha de carga pegada.
 *
 * Nombres en español, como el resto del modelo (§14).
 */
import type { DatoConFecha } from '@/lib/datoConFecha';
import type { Imagen, TimestampLike } from '@/types/actividad';
import type { EstadoDirectorio } from '@/lib/directorios';

/**
 * Por dónde escribirle a **quien cargó la ficha**. Mismo vocabulario que
 * `VIAS_CONTACTO_LIBRERIA` y que `VIAS_CONTACTO_PROPUESTA`, por el mismo motivo:
 * es el canal como lo nombra quien lo usa.
 *
 * **Ojo con la homonimia, que es la trampa de este archivo y pesa más que en
 * librerías:** este documento tiene **cuatro** contactos públicos —`instagram`,
 * `whatsapp`, `mail` y el `linkDeSuscripcion`, que además es un destino de
 * cobro de un tercero— conviviendo con `contactoDeQuienCargo`, que es
 * **interno** como `difusion` (§5.1). El § 8 del PRD lo dice con todas las
 * letras: «este documento tiene más campos internos y públicos mezclados que los
 * otros tres, así que es el que más necesita que la proyección sea explícita».
 */
export const VIAS_CONTACTO_SUSCRIPCION = ['mail', 'whatsapp', 'instagram'] as const;
export type ViaContactoSuscripcion = (typeof VIAS_CONTACTO_SUSCRIPCION)[number];

/** De dónde entró la ficha. Un admin también la puede cargar a mano. */
export const ORIGENES_SUSCRIPCION = ['formulario-publico', 'panel'] as const;
export type OrigenSuscripcion = (typeof ORIGENES_SUSCRIPCION)[number];

/**
 * La periodicidad por defecto del formulario — § 4.1 del PRD.
 *
 * «Creo que todos son mensuales (pero podría de otra manera??)», preguntó el
 * dueño, y la respuesta del PRD es modelarlo igual **con `mensual`
 * preseleccionado**: así el formulario se ve igual de simple —quien carga no
 * toca nada y sale mensual— y el día que aparezca una caja trimestral no hay que
 * migrar documentos.
 *
 * > **Un cuidado que este repo ya aprendió con el arancel (DEC-2):**
 * > preseleccionar un valor hace que nadie lo mire. Acá la preselección es
 * > defendible —«mensual» es cierto en la enorme mayoría y el campo no cambia el
 * > precio de nada— pero si empiezan a aparecer suscripciones mal cargadas como
 * > mensuales, la respuesta es la de DEC-2: sacar el default y obligar a elegir.
 *
 * Es un **default de escritura**: el campo se guarda siempre.
 */
export const PERIODICIDAD_POR_DEFECTO = 'mensual';

/**
 * La moneda del precio. **`ARS` y no un campo**, igual que en el §14 del
 * `CLAUDE.md`: el circuito es argentino y un selector de moneda sería un campo
 * más en un formulario largo para una respuesta que hoy es siempre la misma.
 *
 * Vive como constante y no como literal repetido porque de ella sale el símbolo
 * de la frase pública (`$`), y dos derivaciones de «en qué moneda está esto» se
 * separan sin que nada falle.
 */
export const MONEDA_SUSCRIPCION = 'ARS';

/*
 * ── Los topes ─────────────────────────────────────────────────────────────
 *
 * **Cada uno está dicho en tres lugares y tiene que ser el mismo número**: acá,
 * en `src/lib/suscripcion-literaria-schema.ts` y en `firestore.rules`. Es el
 * patrón de `TOPE_TITULO_REPORTE` (B-364) y el mismo que ya aplican
 * `types/propuesta.ts` y `types/libreria.ts`.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * ese lado lo ata un test que lee el archivo y compara:
 * `tests/suscripciones.test.ts`.
 *
 * Importa por lo mismo que allá: **del otro lado del formulario público va a
 * haber un anónimo** (§ 5 del PRD), así que el tope de la **regla** es el único
 * que no se puede saltear. Hoy ese `create` sigue cerrado a admin (B-872), y eso
 * no cambia el argumento: los números se atan ahora, no el día que se abra la
 * puerta.
 */

/** El nombre de la suscripción, que es de dónde sale el slug. */
export const MIN_NOMBRE_SUSCRIPCION = 2;
export const TOPE_NOMBRE_SUSCRIPCION = 80;
/**
 * «Qué es y para quién» — § 3 del PRD, y **obligatoria** al revés que en una
 * librería.
 *
 * La diferencia no es de estilo: una librería se explica sola con su nombre y su
 * dirección, y una suscripción es una **promesa a futuro** que sin descripción no
 * dice nada. El piso de 15 es el del PRD y lo que impide es la ficha con un «ta
 * buena» adentro.
 */
export const MIN_DESCRIPCION_SUSCRIPCION = 15;
export const TOPE_DESCRIPCION_SUSCRIPCION = 2000;
/** La dirección web de la ficha. Mismo tope que en librerías, y por lo mismo. */
export const TOPE_SLUG_SUSCRIPCION = 120;
/** Quién la ofrece: la librería, la editorial, el club o la persona. */
export const MIN_OFRECIDA_POR_SUSCRIPCION = 2;
export const TOPE_OFRECIDA_POR_SUSCRIPCION = 80;
/**
 * Los slugs de taxonomía que guarda el documento: `tipo-oferente`,
 * `periodicidad`, `perfil-editorial`, y cada elemento de `incluye`, `extras` y
 * `alcance`.
 *
 * **Un solo tope para los seis vocabularios**, y es deliberado: son todos slugs
 * producidos por el mismo `slugify` (§4.2), así que seis constantes con el mismo
 * número serían seis lugares donde el día de mañana uno queda desalineado — la
 * clase de B-88 aplicada a una cota.
 */
export const TOPE_SLUG_TAXONOMIA_SUSCRIPCION = 80;
/**
 * El compromiso mínimo: «Sin compromiso», «3 meses».
 *
 * **Texto libre y no un séptimo vocabulario**, y es un desvío chico del § 3 del
 * PRD que lo escribe como slug (`'sin-compromiso' | '3-meses' | …`). El motivo
 * es el del § 2.4 del inventario —«once vocabularios nuevos de golpe es mucho;
 * vale preguntarse cuáles se pueden empezar como texto libre»— más el criterio
 * del § 4.2 del propio PRD: lo que necesita slug es **un eje de filtro**, y éste
 * no lo es (los cuatro filtros del § 5 son otros). Lo único que hace es leerse
 * en la ficha, y para eso el texto tal cual es mejor que un desplegable que hay
 * que mantener. Entra a `searchText` como `tematica`.
 */
export const TOPE_COMPROMISO_SUSCRIPCION = 80;
/**
 * La temática de lo que manda: «poesía argentina», «novela negra».
 *
 * **Texto libre a propósito** — § 4.2 del PRD: «Novela negra latinoamericana
 * contemporánea» no entra en un desplegable, y forzarlo produce las cuatro
 * variantes de lo mismo que la trampa 6 describe. Entra a `searchText`, y ahí el
 * buscador en memoria lo encuentra igual (§2.5).
 */
export const TOPE_TEMATICA_SUSCRIPCION = 160;
/** Cuántos libros por entrega. Un número, no un texto: el cero es «no manda». */
export const MIN_LIBROS_POR_ENTREGA = 1;
export const MAX_LIBROS_POR_ENTREGA = 20;
/** «Y además…», el texto libre que acompaña a `incluye` y a `extras`. */
export const TOPE_OTRO_SUSCRIPCION = 200;
/**
 * Cuántos slugs entran en cada lista multivalor.
 *
 * No es una regla de producto: es el techo que impide que un `curl` mande mil
 * elementos en un array que la regla **no puede iterar** (B-842). Lo que acota
 * la forma de cada uno es la proyección, que descarta el que no sea un slug.
 */
export const MAX_INCLUYE_SUSCRIPCION = 12;
export const MAX_EXTRAS_SUSCRIPCION = 12;
export const MAX_ALCANCE_SUSCRIPCION = 8;
/**
 * El precio, en pesos. Entero: los centavos no existen en este circuito y un
 * decimal en la ficha se lee como un error de software.
 *
 * El techo no es una previsión de inflación sino la cota que impide que un campo
 * numérico sirva de bolsa. Si algún día hace falta subirlo, es una línea acá y
 * una en la regla — atadas por el test.
 */
export const MIN_PRECIO_SUSCRIPCION = 1;
export const MAX_PRECIO_SUSCRIPCION = 100000000;
/**
 * El link de suscripción — **el riesgo propio de este PRD** (§ 7).
 *
 * Apunta a la página de cobro de otra persona: Mercado Pago, Tienda Nube, un
 * formulario. De ahí salen las cuatro cosas del § 7, y dos son de este archivo:
 * el tope, y que el esquema tenga que ser `https:` **y solo `https:`** (§ 9.7),
 * al revés que la `web` de una librería, que acepta `http`. La mitad que lo hace
 * cumplir del lado que no se puede saltear está en `firestore.rules`.
 */
export const TOPE_LINK_SUSCRIPCION = 500;
/** El handle de Instagram, **sin la arroba**. El largo real de Instagram. */
export const TOPE_INSTAGRAM_SUSCRIPCION = 30;
/** El WhatsApp, **solo dígitos y con código de país**: `5491122223333`. */
export const MIN_WHATSAPP_SUSCRIPCION = 8;
export const TOPE_WHATSAPP_SUSCRIPCION = 15;
/** El mail público de la suscripción. */
export const MIN_MAIL_SUSCRIPCION = 3;
export const TOPE_MAIL_SUSCRIPCION = 200;
/** El valor del contacto interno: un mail, un teléfono o un handle. */
export const MIN_CONTACTO_SUSCRIPCION = 3;
export const TOPE_CONTACTO_SUSCRIPCION = 200;
/** Por qué se descartó, que escribe un admin y no sale nunca. */
export const TOPE_MOTIVO_SUSCRIPCION = 500;
/**
 * El `searchText` normalizado (§6). Lo **deriva** el armado del documento y
 * ningún humano lo escribe, así que el tope no es una regla de producto: es el
 * techo que impide que un campo derivado se use para meter un kilobyte de texto
 * por una puerta que nadie mira.
 */
export const TOPE_SEARCH_TEXT_SUSCRIPCION = 2000;
/**
 * Cuántas imágenes entran.
 *
 * **Es `MAXIMO_IMAGENES` de `src/lib/imagenes.ts`, no un número propio**: la
 * galería es la misma pieza que la de una actividad y la de una librería
 * (D-125), y dos techos para el mismo widget se separan sin que nada falle.
 */
export { MAXIMO_IMAGENES as MAX_IMAGENES_SUSCRIPCION } from '@/lib/imagenes';

/**
 * El precio, **con su fecha de carga pegada** — DEC-12 y B-837.
 *
 * Es `DatoConFecha<PrecioDeSuscripcion>` y no los tres campos sueltos que el § 3
 * del PRD dibuja (`{ monto, porPeriodo, cargadoEn }`), y la diferencia es la que
 * el propio PRD pide en su § 6: «un solo mecanismo compartido — eso es B-837».
 * Con el tipo compartido, `fraseConFecha` es la **única** salida posible y no
 * hay forma de mostrar el monto sin la fecha; con los tres campos sueltos, esa
 * regla volvería a depender de que cada consumidor se acuerde
 * ([D-570](../../docs/06-decisiones.md), § «Un dato que envejece se proyecta con
 * su fecha» de `05-patrones.md`).
 */
export interface PrecioDeSuscripcion {
  /** En pesos (`MONEDA_SUSCRIPCION`), entero. */
  monto: number;
  /**
   * El slug de `/opciones/periodicidad` al que corresponde el monto.
   *
   * **No se asume igual a `periodicidad`**: una caja trimestral puede publicar
   * su precio por mes, y decir «$18.000 por trimestre» cuando cobra por mes es
   * exactamente el dato equivocado con cara de cierto que DEC-12 existe para
   * evitar.
   */
  porPeriodo: string;
}

/**
 * Si envía libros, qué envía — § 4.2 del PRD.
 *
 * Los cuatro campos de adentro **solo valen si `manda`**, y esa condición vive
 * en el `superRefine` del schema y no en el tipo: es el §11 del `CLAUDE.md` («el
 * formulario muestra lo que aplica») y el mismo reparto que `filaPideSede` tiene
 * con `modalidades`.
 */
export interface EnvioDeSuscripcion {
  /** **El filtro que parte el catálogo en dos mundos** (§ 5 del PRD, filtro 1). */
  manda: boolean;
  /** Libros por entrega. `null` es «no lo dice». */
  cuantos: number | null;
  /** Texto libre: «poesía argentina», «novela negra». */
  tematica: string | null;
  /**
   * Slug de `/opciones/perfil-editorial`: `independientes` | `mixto` | `grandes`
   * | `no-dice`.
   *
   * **Taxonomía cerrada y eje de filtro** (§ 4.2): en este circuito
   * «independientes» es la consulta que importa. `no-dice` existe a propósito —
   * es lo que va a llegar en la mitad de las cargas, y sin ese valor alguien va a
   * marcar `mixto` para poder guardar.
   */
  editoriales: string | null;
  /** ¿Se sabe qué libro llega, o es sorpresa? `null` es «no lo dice». */
  sorpresa: boolean | null;
}

/** Quién ofrece la suscripción — § 3 del PRD. */
export interface OferenteDeSuscripcion {
  nombre: string;
  /** Slug de `/opciones/tipo-oferente`: `libreria` | `editorial` | `club` | `persona`. */
  tipo: string;
  /** Handle sin `@`. */
  instagram: string | null;
  /**
   * Si quien la ofrece es una **librería del PRD 2**, su slug: la ficha las
   * linkea (§ 5 del PRD).
   *
   * **Se guarda el slug y no el id**, por lo mismo que en todos lados: el slug
   * es lo que está en la URL y es inmutable después de publicar (trampa 10). Y
   * el enlace **no se emite a ciegas**: quien arma la ficha confirma que esa
   * librería esté publicada, igual que se hace con el hub de barrio — si no,
   * cada ficha de una librería despublicada sería un 404.
   */
  libreriaSlug: string | null;
}

/**
 * Una suscripción literaria del directorio.
 *
 * El ciclo de vida (`estado`, `origen`, `revision`, `creadoEn`, `searchText`) es
 * el de `CAMPOS_DE_MAQUINA_FICHA` de `src/lib/directorios.ts`: **no lo tipea
 * nadie**, y el `estado` inicial lo fuerza `firestore.rules`, no el cliente.
 */
export interface SuscripcionLiteraria {
  nombre: string;
  /**
   * Único e **inmutable después de publicar** — trampa 10. La mitad que lo
   * congela del lado del panel es `slugBloqueado` (`lib/directorios.ts`); la que
   * lo congela de verdad está en `firestore.rules`.
   */
  slug: string;
  /** Obligatoria acá, al revés que en una librería. Ver `MIN_DESCRIPCION_SUSCRIPCION`. */
  descripcion: string;
  /** Reusa `Imagen` de `types/actividad.ts` — D-125. Exactamente una `portada`. */
  imagenes: Imagen[];
  ofrecidaPor: OferenteDeSuscripcion;

  /** Slug de `/opciones/periodicidad`. Default de escritura: `mensual` (§ 4.1). */
  periodicidad: string;
  /** Texto libre: «Sin compromiso», «3 meses». `null` si no lo dice. */
  compromisoMinimo: string | null;

  /** Slugs de `/opciones/incluye-suscripcion`. **Qué te llega**. */
  incluye: string[];
  /** Lo que no entró en el vocabulario. El admin decide si se promueve. */
  incluyeOtro: string | null;

  envio: EnvioDeSuscripcion;

  /** Slugs de `/opciones/extras-suscripcion`. **Qué te llega además**. */
  extras: string[];
  extrasOtro: string | null;

  /** DEC-12 — el monto **con su fecha de carga**, o nada. */
  precio: DatoConFecha<PrecioDeSuscripcion> | null;

  /** Slugs de `/opciones/alcance-envio`. Filtro 3 del § 5: dónde llega. */
  alcance: string[];

  /**
   * ⚠️ **Un link a la página de cobro de un tercero** — § 7 del PRD, el riesgo
   * propio de este directorio. Cuatro cosas salen de acá y ninguna es opcional:
   *
   * 1. **No puede parecer que el proyecto lo respalda**: la acción de la ficha
   *    dice «Suscribite en la página de <nombre>», no «Suscribite» (lección de
   *    B-780/B-781).
   * 2. **`rel="noopener noreferrer"` y `target="_blank"`**. El `noreferrer` va
   *    **acá y solo acá**: B-786 decidió a propósito que el link de Cafecito
   *    **no** lo lleve, porque borraría la única señal de que el aporte vino del
   *    sitio. De una suscripción no ganamos ninguna señal que valga la pena
   *    conservar. Esto **no cierra B-786 ni toca el link de Cafecito**.
   * 3. **Se valida al publicar y no solo al cargar** (B-817): `https:` y solo
   *    `https:`, en el schema **y** en la regla.
   * 4. Un link muerto hace perder tiempo, y por eso la ficha muestra la fecha de
   *    carga del precio: es lo que deja que quien lee decida si le cree.
   */
  linkDeSuscripcion: string | null;
  /** Handle sin `@`. Público. */
  instagram: string | null;
  /**
   * ⚠️ **Se publica.** Mismo cartel que en una librería (§5.1 del `CLAUDE.md`):
   * el formulario lo tiene que decir arriba del input, con esas palabras.
   */
  whatsapp: string | null;
  mail: string | null;

  // ── interno, no sale nunca ───────────────────────────────────────────────
  /**
   * Cómo repreguntarle a **quien cargó la ficha**. Interno como `difusion`
   * (§5.1), con su fila en `docs/07-seguridad.md` y su centinela en el barrido de
   * **esta** colección (`tests/suscripcion-publica.test.ts`, con el fixture
   * `tests/fixtures/centinelas-suscripcion.ts`).
   */
  contactoDeQuienCargo: { via: ViaContactoSuscripcion; valor: string } | null;

  // ── el ciclo de vida, que es el de `lib/directorios.ts` ──────────────────
  /** Lo fuerza la regla en `'pendiente'` al crearse. */
  estado: EstadoDirectorio;
  origen: OrigenSuscripcion;
  /** Normalizado con `normalize` (§6). Lo deriva `formASuscripcion`. */
  searchText: string;
  /** `request.time`: el cliente no puede antedatar su ficha. */
  creadoEn: TimestampLike;
  /** Quién la revisó y por qué la descartó, si la descartó. Interno. */
  revision: {
    porUid: string | null;
    en: TimestampLike | null;
    motivo: string | null;
  };
  /**
   * ¿Estuvo publicada **alguna vez**? — la marca que cierra la puerta de atrás
   * de la trampa 10. Opcional, con el default de lectura que preserva lo
   * anterior. Misma forma y mismo motivo que en `types/libreria.ts`; hoy no la
   * escribe nadie (la escribe un trigger con el Admin SDK, B-905).
   */
  publicadaAlgunaVez?: boolean;
}

export interface SuscripcionLiterariaConId extends SuscripcionLiteraria {
  id: string;
}

/**
 * Lo que se llena en el formulario — **el mismo formulario con dos
 * configuraciones** (§ 5 del PRD), no dos formularios.
 *
 * Todo string y nada `null` en lo que sale de un `<input>`: un `<input>` no
 * tiene `null`, y `formASuscripcion` traduce el `''` a `null` al armar el
 * documento, que es donde la ausencia tiene que representarse **de una sola
 * forma** para que la regla pueda exigir `== null`.
 *
 * Las dos excepciones son `imagenes` (que ya es una estructura, la maneja
 * `GaleriaEditor`) y los tres arrays de slugs, que los maneja `TagsInput`.
 */
export interface SuscripcionLiterariaForm {
  nombre: string;
  /** `''` ⇒ lo deriva `slugDeFicha(nombre)` al armar el documento. */
  slug: string;
  descripcion: string;
  imagenes: Imagen[];
  ofrecidaPor: { nombre: string; tipo: string; instagram: string; libreriaSlug: string };
  periodicidad: string;
  compromisoMinimo: string;
  incluye: string[];
  incluyeOtro: string;
  envio: {
    manda: boolean;
    /** Texto porque sale de un `<input type="number">`: `''` es «no lo dice». */
    cuantos: string;
    tematica: string;
    editoriales: string;
    /** `''` = no lo dice, `'si'` / `'no'` — un `<select>` de tres estados. */
    sorpresa: string;
  };
  extras: string[];
  extrasOtro: string;
  /**
   * El precio, **sin la fecha**: la fecha no la tipea nadie.
   *
   * `cargadoEn` lo pone `formASuscripcion` con el reloj de quien guarda, y por
   * eso no está en este tipo — es la mitad de DEC-12 que no se puede delegar al
   * formulario. Lo mismo que `creadoEn`: un campo de fecha que se puede escribir
   * es un campo de fecha que se puede mentir.
   */
  precio: { monto: string; porPeriodo: string };
  alcance: string[];
  linkDeSuscripcion: string;
  instagram: string;
  whatsapp: string;
  mail: string;
  contactoDeQuienCargo: { via: ViaContactoSuscripcion; valor: string };
}
