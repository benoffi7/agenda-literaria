/**
 * Lugares para hacer eventos — `/lugares/{id}`. **PRD 4**
 * (`docs/prd/04-lugares-para-eventos.md` § 3), B-833, tajada 4.
 *
 * **La colección no lleva `/guia/`.** El documento vive en `/lugares/{id}` y la
 * página se sirve en `/guia/lugares/{slug}`, igual que en los otros dos
 * directorios: `/guia/` es navegación y SEO, no modelo (`prd/README.md`).
 *
 * ── Qué se reusa ──────────────────────────────────────────────────────────
 * El ciclo de vida entero es el de `src/lib/directorios.ts` (B-834). `Imagen`
 * sale de `types/actividad.ts` (**D-125**). `DatoConFecha` sale de
 * `lib/datoConFecha.ts` (**B-837**), que es el mecanismo que la tajada 3 estrenó
 * para el precio de una suscripción y que acá vuelve a ser el correcto por el
 * mismo motivo: **«no sé si todos cobran»** (§ 5 del PRD) es la duda de un dato
 * que envejece.
 *
 * ── Lo propio de este modelo, y es lo más serio de los cuatro PRDs ────────
 * **Este es el único directorio que puede publicar la dirección de la casa de
 * una persona** (§ 6). «Casa», «PH con patio» y «mi living» son lugares reales
 * de este circuito, y la diferencia con un café es total: la dirección de un
 * local comercial es pública por definición; la de una casa es el dato con el
 * que se llega a la puerta de alguien. Con dos agravantes propios: lo carga
 * cualquiera sin login, y `geo` la pone en un mapa.
 *
 * De ahí sale `direccionPublica`, que es un **par flag + dato** —la cuarta
 * instancia de la clase de `online.urlPublica` (D-15),
 * `material.items[].publico` (§5.1) y `envio.manda` (B-832)—. Lo que hace que
 * el par se cumpla no es la disciplina: es que la proyección pública tenga **una
 * sola** función que decida si la dirección sale (`direccionQueSale` en
 * `lib/lugarPublico.ts`) y que la clase tenga su registro y su chequeo
 * (`lib/paresFlagDato.ts`, `tests/clases-de-bug.test.ts` — **B-911**).
 *
 * Y una consecuencia que se ve venir tarde: **el `searchText` se publica**, y en
 * el documento lo escribe el cliente. Que no lleve la dirección no puede
 * depender de `formALugar` —que se saltea con un `curl`— así que la proyección
 * **lo deriva en vez de copiarlo** (`searchTextDeLugar`, `lib/lugarPublico.ts`):
 * lo que sale se arma con los valores ya proyectados, con la dirección afuera por
 * construcción. Lo encontró el `auditor-privacidad`.
 *
 * Nombres en español, como el resto del modelo (§14).
 */
import type { DatoConFecha } from '@/lib/datoConFecha';
import type { Imagen, TimestampLike } from '@/types/actividad';
import type { EstadoDirectorio } from '@/lib/directorios';

/**
 * Por dónde escribirle a **quien cargó la ficha**. Mismo vocabulario que
 * `VIAS_CONTACTO_LIBRERIA` y `VIAS_CONTACTO_SUSCRIPCION`, por el mismo motivo:
 * es el canal como lo nombra quien lo usa.
 */
export const VIAS_CONTACTO_LUGAR = ['mail', 'whatsapp', 'instagram'] as const;
export type ViaContactoLugar = (typeof VIAS_CONTACTO_LUGAR)[number];

/** De dónde entró la ficha. Un admin también la puede cargar a mano. */
export const ORIGENES_LUGAR = ['formulario-publico', 'panel'] as const;
export type OrigenLugar = (typeof ORIGENES_LUGAR)[number];

/**
 * **Los tipos de lugar cuya dirección NO se publica por default** — § 6 del PRD.
 *
 * Hoy es uno solo, `casa`, y es una lista y no un `=== 'casa'` escrito en cuatro
 * lados a propósito: el día que aparezca `departamento` o `ph`, el default lo
 * decide esta constante y no cuatro condiciones que se separan (la clase de
 * B-88). El vocabulario de `/opciones/tipo-lugar` es abierto («Otro» crea
 * valores), así que lo que esta lista **no** puede prometer es cubrir un tipo
 * nuevo que alguien tipee: ahí el default vuelve a ser publicar, y quien revisa
 * la ficha en la bandeja es el que lo ve. Está dicho para que no se lea como una
 * garantía que no es.
 *
 * «`casa` está en la lista **porque es el caso que dispara la regla del §6**, no
 * porque haga falta llenar la lista» (§ 4 del PRD).
 */
export const TIPOS_SIN_DIRECCION_PUBLICA: readonly string[] = ['casa'];

/**
 * ¿A este tipo de lugar le corresponde publicar la dirección **por default**?
 *
 * «El default lo decide el tipo, no el usuario. Un default que hay que apagar a
 * mano es el que se olvida» (§ 6). Se exporta porque lo usan tres lugares que
 * tienen que decir lo mismo: el formulario (prende y apaga la casilla), el
 * armado del documento (fuerza el `false` en el camino público) y los tests.
 */
export const direccionPublicaPorDefecto = (tipo: string): boolean =>
  !TIPOS_SIN_DIRECCION_PUBLICA.includes(tipo.trim());

/**
 * Las unidades en que se cobra un lugar. **Cerradas y en el código, no un cuarto
 * vocabulario** — y es un desvío chico del § 3 del PRD, que escribe `porUnidad`
 * como texto libre.
 *
 * El motivo es el § 2.4 del inventario: «once vocabularios nuevos de golpe es
 * mucho; vale preguntarse cuáles se pueden empezar como texto libre». Acá la
 * respuesta es la contraria a la de `compromisoMinimo` en suscripciones: esto
 * **no** puede ser texto libre, porque de él sale la mitad de una frase que se
 * publica («$25.000 **por hora**»), y un texto libre ahí produce «x hora», «la
 * hora», «hs» — las cuatro variantes de lo mismo que la trampa 6 describe. Y
 * tampoco necesita ser taxonomía: no es eje de filtro (el filtro de costo son
 * las tres clases del § 5) y son cuatro valores que no crecen.
 *
 * Con vocabulario cerrado, `TEXTO_POR_UNIDAD` (`lib/lugarPublico.ts`) los cubre
 * a todos y no existe el caso «una unidad que no sabemos nombrar».
 */
export const UNIDADES_DE_PRECIO_LUGAR = ['hora', 'jornada', 'evento', 'persona'] as const;
export type UnidadDePrecioLugar = (typeof UNIDADES_DE_PRECIO_LUGAR)[number];

/*
 * ── Los topes ─────────────────────────────────────────────────────────────
 *
 * **Cada uno está dicho en tres lugares y tiene que ser el mismo número**: acá,
 * en `src/lib/lugar-schema.ts` y en `firestore.rules`. Es el patrón de
 * `TOPE_TITULO_REPORTE` (B-364) y el mismo que ya aplican `types/propuesta.ts`,
 * `types/libreria.ts` y `types/suscripcion-literaria.ts`.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * ese lado lo ata un test que lee el archivo: `tests/lugares.test.ts`.
 */

/** El nombre del lugar, que es de dónde sale el slug. */
export const MIN_NOMBRE_LUGAR = 2;
export const TOPE_NOMBRE_LUGAR = 80;
/**
 * Qué es el lugar, en prosa. **Opcional**, como en una librería y al revés que
 * en una suscripción: un café con su dirección y su capacidad ya dice lo que hay
 * que saber; una promesa a futuro, no.
 */
export const TOPE_DESCRIPCION_LUGAR = 1500;
/** La dirección web de la ficha. Mismo tope que en los otros dos directorios. */
export const TOPE_SLUG_LUGAR = 120;
/**
 * ⚠️ **La dirección física** — § 6 del PRD. El piso de 4 es el de una librería:
 * lo que impide es el `-` cargado para poder guardar.
 *
 * Que tenga tope y piso no es lo que la protege: lo que la protege es
 * `direccionPublica` y la proyección que lo mira.
 */
export const MIN_DIRECCION_LUGAR = 4;
export const TOPE_DIRECCION_LUGAR = 160;
/** La ciudad, texto libre como en una librería. */
export const MIN_CIUDAD_LUGAR = 1;
export const TOPE_CIUDAD_LUGAR = 80;
/**
 * Los slugs de taxonomía que guarda el documento: `tipo-lugar`,
 * `condicion-de-uso`, `barrio` y cada elemento de `incluye`.
 *
 * **Un solo tope para los cuatro**, por lo mismo que en suscripciones: son todos
 * slugs del mismo `slugify` (§4.2), y cuatro constantes con el mismo número
 * serían cuatro lugares donde uno queda desalineado.
 */
export const TOPE_SLUG_TAXONOMIA_LUGAR = 80;
/**
 * Cuántas personas entran. El techo no es una previsión: es la cota que impide
 * que un campo numérico sirva de bolsa, y 5000 ya es un estadio.
 */
export const MIN_CAPACIDAD_LUGAR = 1;
export const MAX_CAPACIDAD_LUGAR = 5000;
/**
 * «Sentados 20, de pie 35» — el segundo contra del § 9 del PRD: «la capacidad es
 * un dato que quien carga no sabe», y tiene respuestas distintas según estén
 * sentadas, de pie o con mesa.
 */
export const TOPE_CAPACIDAD_NOTAS_LUGAR = 200;
/** «Y además…», el texto libre que acompaña a `incluye`. */
export const TOPE_OTRO_LUGAR = 200;
/**
 * Cuántos slugs entran en `incluye`.
 *
 * No es una regla de producto: es el techo que impide que un `curl` mande mil
 * elementos en un array que la regla **no puede iterar** (B-842). Es más alto
 * que el de suscripciones porque el vocabulario base ya tiene trece valores y
 * un centro cultural completo los marca casi todos.
 */
export const MAX_INCLUYE_LUGAR = 16;
/** «Mínimo de consumición $8000 por persona», «dos horas». */
export const TOPE_CONDICION_NOTAS_LUGAR = 300;
/**
 * El precio, en pesos. Entero: los centavos no existen en este circuito.
 *
 * El techo es el mismo que el de una suscripción y por el mismo motivo: no es
 * una previsión de inflación, es la cota que impide que el campo sirva de bolsa.
 */
export const MIN_PRECIO_LUGAR = 1;
export const MAX_PRECIO_LUGAR = 100000000;
/** El handle de Instagram, **sin la arroba**. El largo real de Instagram. */
export const TOPE_INSTAGRAM_LUGAR = 30;
/** El WhatsApp, **solo dígitos y con código de país**: `5491122223333`. */
export const MIN_WHATSAPP_LUGAR = 8;
export const TOPE_WHATSAPP_LUGAR = 15;
/** El mail público del lugar. */
export const MIN_MAIL_LUGAR = 3;
export const TOPE_MAIL_LUGAR = 200;
/** La web del lugar. Acepta `http://`, como la de una librería: es una página institucional. */
export const TOPE_WEB_LUGAR = 500;
/** El valor del contacto interno: un mail, un teléfono o un handle. */
export const MIN_CONTACTO_LUGAR = 3;
export const TOPE_CONTACTO_LUGAR = 200;
/** Por qué se descartó, que escribe un admin y no sale nunca. */
export const TOPE_MOTIVO_LUGAR = 500;
/**
 * El `searchText` normalizado (§6). Lo **deriva** el armado del documento y
 * ningún humano lo escribe, así que el tope no es una regla de producto: es el
 * techo que impide que un campo derivado se use para meter un kilobyte de texto
 * por una puerta que nadie mira.
 */
export const TOPE_SEARCH_TEXT_LUGAR = 2000;
/**
 * Cuántas imágenes entran.
 *
 * **Es `MAXIMO_IMAGENES` de `src/lib/imagenes.ts`, no un número propio**: la
 * galería es la misma pieza que la de una actividad, una librería y una
 * suscripción (D-125), y dos techos para el mismo widget se separan sin que nada
 * falle.
 */
export { MAXIMO_IMAGENES as MAX_IMAGENES_LUGAR } from '@/lib/imagenes';

/**
 * El precio de un lugar, **con su fecha de carga pegada** — B-837, y la misma
 * decisión que DEC-12 tomó para el precio de una suscripción.
 *
 * Es `DatoConFecha<PrecioDeLugar>` y no los tres campos sueltos que el § 3 del
 * PRD dibuja (`{ monto, porUnidad, cargadoEn }`): con el tipo compartido,
 * `fraseConFecha` es la **única** salida posible y no hay forma de mostrar el
 * monto sin la fecha (D-570).
 *
 * Y acá el argumento del § 5 del PRD pesa incluso más que en suscripciones: «no
 * sé si todos cobran, o le dicen que tienen que consumir» es la duda del dueño
 * sobre si el número existe siquiera. Por eso **el precio es opcional y la
 * condición no**: lo que siempre se puede decir es *qué tipo de arreglo es*.
 */
export interface PrecioDeLugar {
  /** En pesos, entero. */
  monto: number;
  /**
   * En qué unidad se cobra ese monto. Vocabulario cerrado —ver
   * `UNIDADES_DE_PRECIO_LUGAR`—, no un slug de `/opciones/*`.
   *
   * **No se deriva de `condicion`**, y esa es la misma lección que `porPeriodo`:
   * un lugar con `condicion: 'alquiler-por-evento'` puede publicar su precio por
   * hora, y decir «por evento» cuando cobra por hora es el dato equivocado con
   * cara de cierto que este mecanismo existe para evitar.
   */
  porUnidad: UnidadDePrecioLugar;
}

/** Dónde queda. Los dos campos sensibles del § 6 viven acá. */
export interface GeoDeLugar {
  lat: number;
  lng: number;
}

/**
 * Un lugar donde hacer una actividad literaria.
 *
 * El ciclo de vida (`estado`, `origen`, `revision`, `creadoEn`, `searchText`) es
 * el de `CAMPOS_DE_MAQUINA_FICHA` de `src/lib/directorios.ts`: **no lo tipea
 * nadie**, y el `estado` inicial lo fuerza `firestore.rules`, no el cliente.
 */
export interface Lugar {
  nombre: string;
  /**
   * Único e **inmutable después de publicar** — trampa 10. La mitad que lo
   * congela del lado del panel es `slugBloqueado` (`lib/directorios.ts`); la que
   * lo congela de verdad está en `firestore.rules`.
   */
  slug: string;
  /** Opcional, como en una librería. `null` cuando no la cargaron. */
  descripcion: string | null;
  /** Reusa `Imagen` de `types/actividad.ts` — D-125. Exactamente una `portada`. */
  imagenes: Imagen[];
  /**
   * Slug de `/opciones/tipo-lugar` — el «(por ahí poner a completar)» del pedido
   * del dueño, que es exactamente el patrón §4 del `CLAUDE.md`.
   *
   * **Decide el default de `direccionPublica`** (§ 6), así que no es un campo
   * decorativo: ver `TIPOS_SIN_DIRECCION_PUBLICA`.
   */
  tipo: string;

  // ── dónde ────────────────────────────────────────────────────────────────
  /**
   * ⚠️ **Puede NO publicarse** — § 6. Se guarda siempre (el admin necesita saber
   * dónde queda para poder contestar), y **sale solo si `direccionPublica`**.
   * Es la misma forma que `online.url` con `urlPublica` (D-15): el documento la
   * tiene, la proyección decide.
   */
  direccion: string | null;
  /** Slug de `/opciones/barrio` — **el mismo de siempre**, el de las actividades. */
  barrio: string;
  ciudad: string;
  /**
   * ⚠️ **Mismo cuidado que la dirección, y peor**: `geo` la pone en un mapa, o
   * sea que el «más o menos por Villa Crespo» deja de ser más o menos (§ 6).
   * Sale solo si `direccionPublica`.
   */
  geo: GeoDeLugar | null;
  /**
   * ⚠️ **El flag del § 6, y la mitad que hace que todo lo de arriba funcione.**
   *
   * `false` ⇒ ni `direccion` ni `geo` salen a ninguna salida pública: ni al
   * JSON, ni a la ficha, ni al JSON-LD, ni a la `meta description`. Arranca en
   * `false` para los tipos de `TIPOS_SIN_DIRECCION_PUBLICA`, y **el formulario
   * público no puede prenderlo** para esos tipos (criterio 3): eso lo fuerza
   * `firestore.rules`, no el cliente.
   *
   * Es un par flag + dato y la clase tiene registro y chequeo desde B-911
   * (`lib/paresFlagDato.ts`).
   */
  direccionPublica: boolean;

  // ── capacidad ────────────────────────────────────────────────────────────
  /** «Hasta N personas». `null` es «no lo dice». Filtro 1 del § 7, en rangos. */
  capacidad: number | null;
  /** «Sentados 20, de pie 35» — el segundo contra del § 9. */
  capacidadNotas: string | null;

  // ── qué incluye ──────────────────────────────────────────────────────────
  /** Slugs de `/opciones/incluye-lugar`. Filtro 4 del § 7. */
  incluye: string[];
  /** Lo que no entró en el vocabulario. El admin decide si se promueve. */
  incluyeOtro: string | null;

  // ── la condición, que no es un precio (§ 5) ───────────────────────────────
  /**
   * Slug de `/opciones/condicion-de-uso` — **el hallazgo del PRD**.
   *
   * «El precio no es un número: es una forma de arreglo» (§ 5).
   * `con-consumicion` es el `a-la-gorra` de los lugares: misma estructura, misma
   * solución que el `arancel` de una actividad (§4.1 del `CLAUDE.md`).
   */
  condicion: string;
  /** El número, **con su fecha**, o nada. Opcional: la condición no lo es. */
  precio: DatoConFecha<PrecioDeLugar> | null;
  /** «Mínimo de consumición $8000 por persona», «dos horas». */
  condicionNotas: string | null;

  // ── contacto, todo público ────────────────────────────────────────────────
  /** Handle sin `@`. Público. */
  instagram: string | null;
  /**
   * ⚠️ **Se publica.** Mismo cartel que en los otros dos directorios (§5.1 del
   * `CLAUDE.md`): el formulario lo tiene que decir arriba del input.
   */
  whatsapp: string | null;
  mail: string | null;
  /** Acepta `http://`: es una página institucional, no un destino de cobro. */
  web: string | null;

  // ── interno, no sale nunca ────────────────────────────────────────────────
  /**
   * Cómo repreguntarle a **quien cargó la ficha**. Interno como `difusion`
   * (§5.1), con su fila en `docs/07-seguridad.md` y su centinela en el barrido
   * de esta colección (`tests/lugar-publico.test.ts`).
   */
  contactoDeQuienCargo: { via: ViaContactoLugar; valor: string } | null;

  // ── el ciclo de vida, que es el de `lib/directorios.ts` ───────────────────
  /** Lo fuerza la regla en `'pendiente'` al crearse. */
  estado: EstadoDirectorio;
  origen: OrigenLugar;
  /**
   * Normalizado con `normalize` (§6). Lo deriva `formALugar` con
   * `searchTextDeLugar`, y **no lleva la dirección**.
   *
   * ⚠️ Lo que se publica **no es este campo**: la proyección lo vuelve a derivar
   * de lo que publica. Este valor es el del documento, y el buscador del panel es
   * quien lo usa. Ver el docblock del archivo.
   */
  searchText: string;
  /** `request.time`: el cliente no puede antedatar su ficha. */
  creadoEn: TimestampLike;
  /** Quién lo revisó y por qué lo descartó, si lo descartó. Interno. */
  revision: {
    porUid: string | null;
    en: TimestampLike | null;
    motivo: string | null;
  };
  /**
   * ¿Estuvo publicado **alguna vez**? — la marca que cierra la puerta de atrás
   * de la trampa 10. Opcional, con el default de lectura que preserva lo
   * anterior. Misma forma y mismo motivo que en `types/libreria.ts`; hoy no la
   * escribe nadie (la escribe un trigger con el Admin SDK, B-905).
   */
  publicadaAlgunaVez?: boolean;
}

export interface LugarConId extends Lugar {
  id: string;
}

/**
 * Lo que se llena en el formulario — **el mismo formulario con dos
 * configuraciones** (§ 1 del PRD), no dos formularios.
 *
 * Todo string y nada `null` en lo que sale de un `<input>`: un `<input>` no
 * tiene `null`, y `formALugar` traduce el `''` a `null` al armar el documento,
 * que es donde la ausencia tiene que representarse **de una sola forma** para
 * que la regla pueda exigir `== null`.
 *
 * Las excepciones son `imagenes` (que ya es una estructura, la maneja
 * `GaleriaEditor`), `incluye` (que maneja `TagsInput`) y `direccionPublica`, que
 * es una casilla y por lo tanto un booleano de verdad.
 */
export interface LugarForm {
  nombre: string;
  /** `''` ⇒ lo deriva `slugDeFicha(nombre)` al armar el documento. */
  slug: string;
  descripcion: string;
  imagenes: Imagen[];
  tipo: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  /** Los dos `''` ⇒ `geo: null`. Se tipean como texto porque salen de un input. */
  geo: { lat: string; lng: string };
  /**
   * La casilla del § 6. Su valor inicial lo decide el **tipo**
   * (`direccionPublicaPorDefecto`) y no quien carga, y el formulario la vuelve a
   * apagar cuando el tipo pasa a uno de `TIPOS_SIN_DIRECCION_PUBLICA`.
   */
  direccionPublica: boolean;
  /** Texto porque sale de un `<input type="number">`: `''` es «no lo dice». */
  capacidad: string;
  capacidadNotas: string;
  incluye: string[];
  incluyeOtro: string;
  condicion: string;
  /**
   * El precio, **sin la fecha**: la fecha no la tipea nadie.
   *
   * La pone `formALugar` con el reloj de quien guarda, y por eso no está en este
   * tipo — es la mitad de B-837 que no se le puede delegar al formulario. Un
   * campo de fecha que se puede escribir es un campo de fecha que se puede
   * mentir.
   */
  precio: { monto: string; porUnidad: string };
  condicionNotas: string;
  instagram: string;
  whatsapp: string;
  mail: string;
  web: string;
  contactoDeQuienCargo: { via: ViaContactoLugar; valor: string };
}
