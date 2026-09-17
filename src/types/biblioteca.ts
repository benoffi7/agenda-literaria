/**
 * Bibliotecas — `/bibliotecas/{id}`. **B-960**, el cuarto directorio de la Guía.
 *
 * **La colección no lleva `/guia/`.** El documento vive en `/bibliotecas/{id}` y
 * la página se sirve en `/guia/bibliotecas/{slug}`: `/guia/` es una decisión de
 * navegación y de SEO (`prd/README.md` § «Las decisiones del dueño»), no de
 * modelo. Es lo mismo que ya hacen las otras tres.
 *
 * ── La decisión de producto que había que tomar antes de escribir nada ────
 * El ítem del backlog la marcaba como «lo único que no es copiar-y-pegar»: una
 * biblioteca **ya puede estar cargada como lugar** (`/opciones/tipo-lugar` tiene
 * `biblioteca`), así que la institución que presta su sala para un encuentro ya
 * tiene ficha en `/guia/lugares`.
 *
 * **Decidido por el dueño el 2026-09-17: son dos fichas.** Una como lugar
 * —dónde hacer un evento— y otra como biblioteca —dónde sacar libros—. Lo que lo
 * decide es que **son dos preguntas distintas de dos personas distintas**: quien
 * organiza busca sala y quien lee busca catálogo, y una ficha que contesta las
 * dos obliga a las dos a leer la mitad que no les sirve.
 *
 * El costo está dicho para que no sorprenda: la misma institución aparece dos
 * veces en la Guía y hay que cargarla dos veces. Lo que se compra es que cada
 * colección mantenga **su** whitelist y **su** formulario, que es exactamente lo
 * que el recuadro del § 1.2 del inventario manda no generalizar.
 *
 * ── Qué se reusa ─────────────────────────────────────────────────────────
 * El ciclo de vida entero es el de `src/lib/directorios.ts` (B-834): los tres
 * estados, el grafo de transiciones, qué campos escribe la máquina y cuándo se
 * congela el slug. Acá viven **solo los campos**.
 *
 * `Imagen` sale de `types/actividad.ts` tal cual (**D-125**), y la geografía es
 * la misma cascada de dos niveles que una sede y que una librería (**D-710**),
 * con los mismos vocabularios: una biblioteca en Palermo y un taller en Palermo
 * comparten el slug del barrio, que es lo que las deja aparecer juntas en el hub
 * que ya existe.
 *
 * ── Los cuatro campos que la distinguen de una librería ──────────────────
 * Elegidos por el dueño el 2026-09-17, y los cuatro salen de lo mismo: **una
 * biblioteca no vende, presta**. `tipo`, `asociarse`, `catalogo` y
 * `horarioDeSala`. Cada uno tiene su docblock abajo.
 *
 * Nombres en español, como el resto del modelo (§14).
 */
import { SLUG_CABA } from '@/lib/geografia.mjs';
import type { DatoConFecha } from '@/lib/datoConFecha';
import type { Imagen, TimestampLike } from '@/types/actividad';
import type { EstadoDirectorio } from '@/lib/directorios';

/**
 * Por dónde escribirle a **quien cargó la ficha**. Mismo vocabulario y mismo
 * motivo que `VIAS_CONTACTO_LIBRERIA`: es el canal como lo nombra quien lo usa.
 *
 * **Ojo con la homonimia, que es la trampa de este archivo igual que del de
 * librerías:** una biblioteca tiene **dos clases de contacto en el mismo
 * documento** y no tienen el mismo destino. `instagram` / `whatsapp` / `web` /
 * `mail` son **públicos y ese es el punto**; esto es `contactoDeQuienCargo`, que
 * es **interno** como `difusion` (§5.1) y no sale a ninguna salida pública.
 */
export const VIAS_CONTACTO_BIBLIOTECA = ['mail', 'whatsapp', 'instagram'] as const;
export type ViaContactoBiblioteca = (typeof VIAS_CONTACTO_BIBLIOTECA)[number];

/** De dónde entró la ficha. Un admin también la puede cargar a mano. */
export const ORIGENES_BIBLIOTECA = ['formulario-publico', 'panel'] as const;
export type OrigenBiblioteca = (typeof ORIGENES_BIBLIOTECA)[number];

/** La ciudad por defecto del formulario, **como slug** — igual que en librerías (B-967). */
export const CIUDAD_POR_DEFECTO = SLUG_CABA;
/** La provincia por defecto, del mismo lado que la ciudad. */
export const PROVINCIA_POR_DEFECTO = SLUG_CABA;

/*
 * ── Los topes ─────────────────────────────────────────────────────────────
 *
 * **Cada uno está dicho en tres lugares y tiene que ser el mismo número**: acá,
 * en `src/lib/biblioteca-schema.ts` y en `firestore.rules`. Es el patrón de
 * `types/libreria.ts`, y el motivo es el mismo: del otro lado del formulario
 * público va a haber un anónimo, así que el tope de la **regla** es el único que
 * no se puede saltear —el del schema y el del `maxLength` los saltea un `curl`—.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * ese lado lo ata un test que lee el archivo y compara:
 * `tests/bibliotecas.test.ts`.
 */

/** El nombre de la biblioteca, que es de dónde sale el slug. */
export const MIN_NOMBRE_BIBLIOTECA = 2;
export const TOPE_NOMBRE_BIBLIOTECA = 80;
/** «Qué tiene, qué la hace distinta». Opcional. */
export const TOPE_DESCRIPCION_BIBLIOTECA = 1000;
/**
 * **El horario de atención, texto libre** — el mismo campo y la misma decisión
 * que B-982 le dio a las otras tres fichas.
 *
 * Y la misma consecuencia dicha: **no se emite en el JSON-LD.**
 * `schema.org/openingHours` quiere un formato fijo (`Mo-Fr 10:00-20:00`) y un
 * texto libre no valida — emitirlo mal es peor que no emitirlo, porque Google
 * puede mostrar un horario equivocado al costado del resultado.
 */
export const TOPE_HORARIOS_BIBLIOTECA = 200;
/**
 * **El horario de sala, texto libre** — uno de los cuatro campos propios.
 *
 * ── Por qué es un campo aparte del horario de atención ───────────────────
 * Porque en una biblioteca **no son lo mismo**, y ésa es justamente la
 * diferencia con una librería. El mostrador puede estar abierto de 9 a 20 para
 * retirar y devolver, y la sala de lectura abrir de 14 a 19 o no existir. Quien
 * va a sacar un libro necesita el primero; quien va a pasar la tarde leyendo
 * necesita el segundo, y hoy no hay ficha en el proyecto que lo conteste.
 *
 * Meterlos en un solo campo obligaría a que cada biblioteca invente cómo decir
 * las dos cosas en un renglón, que es cómo se llega a un directorio donde el
 * mismo dato está escrito de cuarenta formas.
 *
 * **`''` es una respuesta válida y significa «no tiene sala», no «no lo
 * cargué».** La página no lo muestra cuando está vacío, que es la lectura
 * correcta de las dos.
 *
 * Mismo tope y mismo motivo que el horario de atención: entra «Lun a vie de 14 a
 * 19. Sábados cerrado» con margen, y no alcanza para un párrafo.
 */
export const TOPE_HORARIO_DE_SALA_BIBLIOTECA = 200;

/** La dirección, texto libre: «Talcahuano 1261». */
export const MIN_DIRECCION_BIBLIOTECA = 4;
export const TOPE_DIRECCION_BIBLIOTECA = 160;
/** La dirección web de la ficha. Más largo que el nombre, por el desempate. */
export const TOPE_SLUG_BIBLIOTECA = 120;
/** Slugs de taxonomía: `/opciones/barrio`, `/opciones/provincia`, `/opciones/ciudad`. */
export const TOPE_BARRIO_BIBLIOTECA = 80;
export const TOPE_PROVINCIA_BIBLIOTECA = 80;
export const TOPE_CIUDAD_BIBLIOTECA = 80;
/** Slug de `/opciones/tipo-biblioteca`. Mismo tope que los demás de taxonomía. */
export const TOPE_TIPO_BIBLIOTECA = 80;
/** El handle de Instagram, **sin la arroba**. El largo real de un handle. */
export const TOPE_INSTAGRAM_BIBLIOTECA = 30;
/** El WhatsApp, **solo dígitos y con código de país**: `5491122223333`. */
export const MIN_WHATSAPP_BIBLIOTECA = 8;
export const TOPE_WHATSAPP_BIBLIOTECA = 15;
/** La web de la biblioteca. */
export const TOPE_WEB_BIBLIOTECA = 500;
export const TOPE_MAIL_BIBLIOTECA = 200;
/**
 * **La URL del catálogo online** — uno de los cuatro campos propios.
 *
 * Es el dato que más distingue una biblioteca de una librería como salida
 * pública: poder mirar desde casa si el libro está antes de cruzar la ciudad.
 *
 * Mismo tope que `web` y **saneada con `urlSegura` igual que ella**, no con un
 * regex propio: termina en un `href` de una página indexada, así que es la misma
 * pregunta que el proyecto ya contesta en un solo lugar (la clase de B-88).
 *
 * **Es un campo aparte de `web` y no un segundo uso de ella**: la web
 * institucional y el catálogo consultable son dos destinos distintos, y una
 * biblioteca puede tener el segundo sin la primera (muchos catálogos viven en un
 * dominio de un sistema compartido, tipo Koha o Aguapey).
 */
export const TOPE_CATALOGO_BIBLIOTECA = 500;
/** El valor del contacto interno: un mail, un teléfono o un handle. */
export const MIN_CONTACTO_BIBLIOTECA = 3;
export const TOPE_CONTACTO_BIBLIOTECA = 200;
/** Por qué se descartó, que escribe un admin y no sale nunca. */
export const TOPE_MOTIVO_BIBLIOTECA = 500;
/** El piso de un mail: `a@b.c` ya son cinco. */
export const MIN_MAIL_BIBLIOTECA = 3;
/**
 * **El costo de asociarse, como texto y no como número** — el segundo de los
 * cuatro campos propios, y el único donde hubo algo que decidir.
 *
 * ── Por qué texto y no un entero como el precio de una suscripción ───────
 * Porque acá el número casi nunca es un número. Una biblioteca popular cobra
 * «$2.000 por año», otra «$500 el carnet y después nada», otra «gratis para
 * jubilados y estudiantes» y la mayoría de las municipales no cobra. El campo
 * `PrecioDeSuscripcion` es un entero más un período justamente porque una caja
 * de libros siempre cuesta un número por mes; esto no.
 *
 * **Y no entra a ningún filtro ni a ningún orden**, que es lo que hace que la
 * decisión no cueste nada: el § 2 de `datoConFecha.ts` ya prohíbe filtrar por un
 * dato que envejece, así que el entero no compraba nada que se pudiera usar.
 *
 * 120 caracteres: entra «$3.000 por año, gratis para jubilados» con margen.
 */
export const TOPE_COSTO_DE_ASOCIARSE_BIBLIOTECA = 120;
/** El `searchText` normalizado (§6). Lo deriva el armado; ningún humano lo escribe. */
export const TOPE_SEARCH_TEXT_BIBLIOTECA = 2000;
/**
 * Cuántas imágenes entran.
 *
 * **Es `MAXIMO_IMAGENES` de `src/lib/imagenes.ts`, no un número propio**: la
 * galería es la misma pieza que la de una actividad (D-125) y dos techos para el
 * mismo widget se separan sin que nada falle.
 */
export { MAXIMO_IMAGENES as MAX_IMAGENES_BIBLIOTECA } from '@/lib/imagenes';

/**
 * **Si hace falta asociarse, y cuánto sale** — el tercero de los cuatro campos
 * propios, y el que tiene la forma más cargada.
 *
 * ── Por qué es un objeto y no dos campos sueltos ─────────────────────────
 * Porque `costo` **solo tiene sentido si `hraceFalta` es `true`**, y esa relación
 * escrita en dos campos de primer nivel se pierde: el formulario dejaría cargar
 * un costo sobre una biblioteca que no pide asociarse, y la ficha publicaría «no
 * hace falta asociarse · $3.000 por año». Es la misma razón por la que
 * `inscripcion` de una actividad es un objeto y no seis campos.
 *
 * ── Esto NO es un par flag+dato, y conviene decirlo ──────────────────────
 * `haceFalta` **no decide si el costo se publica**: decide si hay costo. Un par
 * de `paresFlagDato.ts` es un booleano que **esconde** un dato que existe igual
 * —el link de la reunión, la dirección de una casa—, y el modo de falla de esa
 * clase es publicar lo que alguien pidió no publicar. Acá no hay nada escondido:
 * si no hace falta asociarse, no hay costo que esconder.
 *
 * Queda escrito porque el nombre se parece y el registro de `paresFlagDato.ts`
 * se lee al revés —lo que no está ahí es lo que nadie vigila—, así que la
 * próxima persona que audite este archivo tiene que poder descartarlo sin
 * releerlo entero.
 *
 * ── El costo va con `DatoConFecha` — B-837 y DEC-12 ──────────────────────
 * Es un dato que **nadie va a mantener al día** y que, cuando está y ya no es
 * cierto, es peor que ausente: alguien va a la biblioteca con $2.000 y el carnet
 * sale $8.000. El mecanismo ya existe y sus tres reglas lo resuelven solo —la
 * fecha se muestra siempre, nunca entra a un filtro, y el panel avisa a los
 * `DIAS_PARA_REVISAR` días.
 */
export interface AsociarseABiblioteca {
  /** ¿Hay que asociarse para llevarse un libro? */
  haceFalta: boolean;
  /**
   * Cuánto sale, con su fecha de carga pegada. `null` es «no lo sabemos» y es
   * distinto de `haceFalta: false`, que es «no hace falta».
   *
   * Cuando `haceFalta` es `false` esto **tiene que ser `null`**, y lo exigen el
   * schema y la regla: un costo colgado de un «no hace falta» es un dato que
   * contradice al de al lado.
   */
  costo: DatoConFecha<string> | null;
}

/**
 * Una biblioteca del directorio.
 *
 * El ciclo de vida (`estado`, `origen`, `revision`, `creadoEn`, `searchText`) es
 * el de `CAMPOS_DE_MAQUINA_FICHA` de `src/lib/directorios.ts`: **no lo tipea
 * nadie**, y el `estado` inicial lo fuerza `firestore.rules`, no el cliente.
 */
export interface Biblioteca {
  nombre: string;
  /**
   * Único e **inmutable después de publicar** — trampa 10. La mitad que lo
   * congela del lado del panel es `slugBloqueado` (`lib/directorios.ts`); la que
   * lo congela de verdad está en `firestore.rules`.
   */
  slug: string;
  descripcion: string | null;
  /** Reusa `Imagen` de `types/actividad.ts` — D-125. Exactamente una `portada`. */
  imagenes: Imagen[];
  /**
   * Slug de `/opciones/tipo-biblioteca` — popular, municipal, provincial,
   * nacional, universitaria, especializada, comunitaria, escolar.
   *
   * **Opcional**, con `''` como «no lo dijo». No se exige para publicar por lo
   * mismo que el horario de B-982: una ficha sin el tipo cargado sigue diciendo
   * dónde queda y qué presta, y exigirlo dejaría inguardable la ficha que llega
   * de afuera con lo que la persona sabía.
   */
  tipo: string;
  direccion: string;
  /** Texto libre, o `null` si no se cargó. El del mostrador. */
  horarios: string | null;
  /** Texto libre, o `null`. El de la sala de lectura — ver su tope. */
  horarioDeSala: string | null;
  /** Ver `AsociarseABiblioteca`. Siempre presente: `haceFalta: false` es la respuesta por defecto. */
  asociarse: AsociarseABiblioteca;
  /** La URL del catálogo consultable, saneada con `urlSegura`. */
  catalogo: string | null;
  /** Slug de `/opciones/provincia` — el mismo vocabulario que una actividad. */
  provincia: string;
  /** Slug de `/opciones/barrio`. **Se pide solo en CABA**, igual que en una sede. */
  barrio: string;
  /** Slug de `/opciones/ciudad`. */
  ciudad: string;
  /** Opcional, lo pone el admin. */
  geo: { lat: number; lng: number } | null;

  // ── los cuatro contactos PÚBLICOS, y ése es el punto ─────────────────────
  /** Handle sin `@`. */
  instagram: string | null;
  /**
   * ⚠️ **Se publica.** El §5.1 del `CLAUDE.md` advierte que un WhatsApp personal
   * publicado queda expuesto a bots. Acá el número es institucional, pero el
   * formulario público lo tiene que decir arriba del input y con esas palabras:
   * «este número se publica en el sitio».
   */
  whatsapp: string | null;
  web: string | null;
  mail: string | null;

  // ── interno, no sale nunca ───────────────────────────────────────────────
  /**
   * Cómo repreguntarle a **quien cargó la ficha**. Mismo trato que el de una
   * librería: interno como `difusion` (§5.1), su fila en `docs/07-seguridad.md`
   * y su centinela en el barrido de **esta** colección
   * (`tests/biblioteca-publica.test.ts`, con el fixture
   * `tests/fixtures/centinelas-biblioteca.ts`).
   *
   * **Que conviva en el mismo documento que los cuatro contactos públicos es
   * exactamente la condición donde una proyección por spread filtra un campo**:
   * la whitelist de la proyección no se negocia.
   */
  contactoDeQuienCargo: { via: ViaContactoBiblioteca; valor: string } | null;

  // ── el ciclo de vida, que es el de `lib/directorios.ts` ──────────────────
  /** Lo fuerza la regla en `'pendiente'` al crearse. */
  estado: EstadoDirectorio;
  origen: OrigenBiblioteca;
  /** Normalizado con `normalize` (§6). Lo deriva `formABiblioteca`. */
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
   * de la trampa 10, con el mismo default de lectura que en librerías: ausente ⇒
   * se contesta con el estado actual.
   *
   * **Hoy no la escribe nadie** — la escribiría un trigger con el Admin SDK, y
   * el de esta colección tampoco existe (es B-905 con otra cara, y por eso este
   * campo nace ya declarado en vez de agregarse después).
   */
  publicadaAlgunaVez?: boolean;
}

export interface BibliotecaConId extends Biblioteca {
  id: string;
}

/**
 * Lo que se llena en el formulario — **el mismo formulario con dos
 * configuraciones**, no dos formularios.
 *
 * Todo string y nada `null`, por el mismo motivo que `LibreriaForm`: un
 * `<input>` no tiene `null`. `formABiblioteca` traduce el `''` a `null` al armar
 * el documento, que es donde la ausencia tiene que representarse **de una sola
 * forma** para que la regla pueda exigir `== null`.
 */
export interface BibliotecaForm {
  nombre: string;
  /** `''` ⇒ lo deriva `slugDeFicha(nombre)` al armar el documento. */
  slug: string;
  descripcion: string;
  imagenes: Imagen[];
  tipo: string;
  direccion: string;
  horarios: string;
  horarioDeSala: string;
  /**
   * El costo va como texto y **sin la fecha: la fecha no la tipea nadie** — la
   * estampa el servidor, que es lo que impide elegir qué fecha se publica al
   * lado del número (el desvío que DEC-12 le fijó a suscripciones).
   */
  asociarse: { haceFalta: boolean; costo: string };
  catalogo: string;
  provincia: string;
  barrio: string;
  ciudad: string;
  /** Los dos `''` ⇒ `geo: null`. Se tipean como texto porque salen de un input. */
  geo: { lat: string; lng: string };
  instagram: string;
  whatsapp: string;
  web: string;
  mail: string;
  contactoDeQuienCargo: { via: ViaContactoBiblioteca; valor: string };
}
