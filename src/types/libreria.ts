/**
 * Librerías — `/librerias/{id}`. **PRD 2** (`docs/prd/02-librerias.md` § 3),
 * B-831, tajada 2 paso 14.
 *
 * **La colección no lleva `/guia/`.** El documento vive en `/librerias/{id}` y
 * la página se sirve en `/guia/librerias/{slug}`: `/guia/` es una decisión de
 * navegación y de SEO (`prd/README.md` § «Las decisiones del dueño»), no de
 * modelo.
 *
 * ── Qué se reusa, y no es poco ────────────────────────────────────────────
 * El ciclo de vida entero es el de `src/lib/directorios.ts` (B-834): los tres
 * estados, el grafo de transiciones, qué campos escribe la máquina y cuándo se
 * congela el slug. Acá viven **solo los campos**, que es lo que no se
 * generaliza: la proyección pública tiene que ser una whitelist **por entidad**
 * (§5.2 del `CLAUDE.md`, y el recuadro del § 1.2 del inventario).
 *
 * `Imagen` sale de `types/actividad.ts` tal cual (**D-125**): una librería tiene
 * el frente del local más las fotos de adentro, y Open Graph necesita **una**
 * señalada — que es exactamente para lo que nació `portada`. Con eso viene la
 * subida, el recorte, el saneo de metadatos y la Function de optimización
 * (B-167, B-220) sin escribir una línea.
 *
 * Y el **barrio es el mismo slug que usa una actividad** (`/opciones/barrio`,
 * §4): una librería en Palermo y un taller en Palermo comparten valor, que es lo
 * que deja mostrar las dos cosas en el hub de barrio que ya existe (§ 2 del
 * PRD). El costo está escrito allá: el contador `usos` de esa taxonomía pasa a
 * contar dos cosas distintas.
 *
 * Nombres en español, como el resto del modelo (§14).
 */
import type { Imagen, TimestampLike } from '@/types/actividad';
import type { EstadoDirectorio } from '@/lib/directorios';

/**
 * Por dónde escribirle a **quien cargó la ficha**. Mismo vocabulario que
 * `VIAS_CONTACTO_PROPUESTA`, y por el mismo motivo: es el canal como lo nombra
 * quien lo usa (`'instagram'`, no el `'dm'` del modelo de actividad).
 *
 * **Ojo con la homonimia, que es la trampa de este archivo:** una librería tiene
 * **dos clases de contacto en el mismo documento** y no tienen el mismo destino
 * (§ 8 del PRD). `instagram` / `whatsapp` / `web` / `mail` son **públicos y ese
 * es el punto**; esto es `contactoDeQuienCargo`, que es **interno** como
 * `difusion` (§5.1) y no sale a ninguna de las diecinueve salidas.
 */
export const VIAS_CONTACTO_LIBRERIA = ['mail', 'whatsapp', 'instagram'] as const;
export type ViaContactoLibreria = (typeof VIAS_CONTACTO_LIBRERIA)[number];

/** De dónde entró la ficha. Un admin también la puede cargar a mano. */
export const ORIGENES_LIBRERIA = ['formulario-publico', 'panel'] as const;
export type OrigenLibreria = (typeof ORIGENES_LIBRERIA)[number];

/**
 * La ciudad por defecto del formulario.
 *
 * Es un **default de escritura**, no de lectura: el campo se guarda siempre. El
 * proyecto es de actividades literarias en Argentina y hoy el circuito es
 * porteño; que sea una constante y no un literal repetido es lo que hace que el
 * día que haya fichas de otra ciudad se cambie en un lugar.
 */
export const CIUDAD_POR_DEFECTO = 'Ciudad de Buenos Aires';

/*
 * ── Los topes ─────────────────────────────────────────────────────────────
 *
 * **Cada uno está dicho en tres lugares y tiene que ser el mismo número**: acá,
 * en `src/lib/libreria-schema.ts` y en `firestore.rules`. Es el patrón de
 * `TOPE_TITULO_REPORTE` (B-364) y el mismo que ya aplica `types/propuesta.ts`.
 *
 * Acá importa por lo mismo que allá: **del otro lado del formulario público va a
 * haber un anónimo** (§ 5 del PRD), así que el tope de la **regla** es el único
 * que no se puede saltear —el del schema y el del `maxLength` los saltea un
 * `curl`—. Hoy ese `create` sigue cerrado a admin por **B-872**, y eso no cambia
 * el argumento: los números se atan ahora, no el día que se abra la puerta.
 *
 * `firestore.rules` es un runtime aparte y no puede importar TypeScript, así que
 * ese lado lo ata un test que lee el archivo y compara: `tests/librerias.test.ts`.
 */

/** El nombre de la librería, que es de dónde sale el slug. */
export const MIN_NOMBRE_LIBRERIA = 2;
export const TOPE_NOMBRE_LIBRERIA = 80;
/** «Qué tiene, qué la hace distinta». Opcional. */
export const TOPE_DESCRIPCION_LIBRERIA = 1000;
/** La dirección, texto libre: «Thames 1762». */
export const MIN_DIRECCION_LIBRERIA = 4;
export const TOPE_DIRECCION_LIBRERIA = 160;
/**
 * La dirección web de la ficha. Más largo que el nombre a propósito: el sufijo
 * que desempata dos librerías parecidas (§ 8 del PRD: `-palermo` es mejor que
 * `-2`) se suma al slug ya derivado.
 */
export const TOPE_SLUG_LIBRERIA = 120;
/** Slugs de taxonomía: `/opciones/barrio`. */
export const TOPE_BARRIO_LIBRERIA = 80;
export const TOPE_CIUDAD_LIBRERIA = 80;
/**
 * El handle de Instagram, **sin la arroba**. Treinta es el largo real de un
 * handle de Instagram, que es el mismo número que usa `handleInstagram`
 * (`src/lib/enlaceSeguro.ts`) — y por eso el schema lo valida con esa función y
 * no con un regex propio (la clase de B-88: dos versiones de «qué es un
 * handle»).
 */
export const TOPE_INSTAGRAM_LIBRERIA = 30;
/**
 * El WhatsApp, **solo dígitos y con código de país**: `5491122223333`.
 *
 * Las cotas son las de `enlaceDeContacto` (`src/lib/bandejaDePropuestas.ts`),
 * que es donde el proyecto ya decidió qué cuenta como teléfono armable. Se
 * guarda normalizado —sin `+`, sin espacios, sin guiones— porque **este número
 * se publica** y de él sale un `wa.me/<digitos>`: dejar el formato libre
 * significa que la mitad de las fichas produzcan un link roto.
 */
export const MIN_WHATSAPP_LIBRERIA = 8;
export const TOPE_WHATSAPP_LIBRERIA = 15;
/** La web de la librería. Mismo tope que la URL de imagen de una propuesta. */
export const TOPE_WEB_LIBRERIA = 500;
export const TOPE_MAIL_LIBRERIA = 200;
/** El valor del contacto interno: un mail, un teléfono o un handle. */
export const MIN_CONTACTO_LIBRERIA = 3;
export const TOPE_CONTACTO_LIBRERIA = 200;
/** Por qué se descartó, que escribe un admin y no sale nunca. */
export const TOPE_MOTIVO_LIBRERIA = 500;
/**
 * El mail de la librería. El mínimo no es una validación de mail —eso lo hace el
 * schema, que es donde hay alguien mirando la pantalla— sino el piso por debajo
 * del cual no puede haber ninguno: `a@b.c` ya son cinco.
 */
export const MIN_MAIL_LIBRERIA = 3;
/**
 * «No vacío». Hoy lo usa **un solo campo, `ciudad`**, y esa soledad es un
 * resultado de la verificación por mutación y no un descuido: el slug, el barrio
 * y la web tenían el mismo piso y los tres eran **letra muerta**, porque sus
 * `matches` ya exigen al menos un carácter. `ciudad` es el único sin patrón.
 *
 * Va declarado y no escrito a mano en `firestore.rules` por lo que señaló el
 * `auditor-trampas` sobre `/propuestas`: **un número de la regla que no está
 * declarado en ninguna parte no se puede atar**, o sea que cambiarlo o borrarlo
 * no pone nada en rojo.
 */
export const MIN_NO_VACIO_LIBRERIA = 1;
/**
 * El `searchText` normalizado (§6). Lo **deriva** el armado del documento y
 * ningún humano lo escribe, así que el tope no es una regla de producto: es el
 * techo que impide que un campo derivado se use para meter un kilobyte de texto
 * por una puerta que nadie mira.
 */
export const TOPE_SEARCH_TEXT_LIBRERIA = 2000;
/**
 * Cuántas imágenes entran.
 *
 * **Es `MAXIMO_IMAGENES` de `src/lib/imagenes.ts`, no un número propio**: la
 * galería es la misma pieza que la de una actividad (D-125) y dos techos para el
 * mismo widget se separan sin que nada falle. Se reexporta acá para que el lado
 * de la regla lo pueda atar en un solo lugar, como los demás.
 */
export { MAXIMO_IMAGENES as MAX_IMAGENES_LIBRERIA } from '@/lib/imagenes';

/**
 * Una librería del directorio.
 *
 * El ciclo de vida (`estado`, `origen`, `revision`, `creadoEn`, `searchText`) es
 * el de `CAMPOS_DE_MAQUINA_FICHA` de `src/lib/directorios.ts`: **no lo tipea
 * nadie**, y el `estado` inicial lo fuerza `firestore.rules`, no el cliente.
 */
export interface Libreria {
  nombre: string;
  /**
   * Único e **inmutable después de publicar** — trampa 10. La mitad que lo
   * congela del lado del panel es `slugBloqueado` (`lib/directorios.ts`); la que
   * lo congela de verdad, contra alguien con la consola de Firebase abierta,
   * está en `firestore.rules`.
   */
  slug: string;
  descripcion: string | null;
  /** Reusa `Imagen` de `types/actividad.ts` — D-125. Exactamente una `portada`. */
  imagenes: Imagen[];
  direccion: string;
  /** Slug de `/opciones/barrio` — **el mismo que usan las actividades** (§ 2 del PRD). */
  barrio: string;
  ciudad: string;
  /** Opcional, lo pone el admin (`CoordenadasSede.tsx` ya existe). */
  geo: { lat: number; lng: number } | null;

  // ── los cuatro contactos PÚBLICOS, y ése es el punto ─────────────────────
  /** Handle sin `@`. */
  instagram: string | null;
  /**
   * ⚠️ **Se publica.** El §5.1 del `CLAUDE.md` advierte que un WhatsApp personal
   * publicado queda expuesto a bots y recomienda un número de trabajo. Acá el
   * número **es** de trabajo —es una librería—, pero el formulario público lo
   * tiene que decir arriba del input y con esas palabras: «este número se publica
   * en el sitio» (§ 3 del PRD). Sin eso, alguien pone su celular sin darse
   * cuenta. Ese cartel es del componente y tiene su criterio de aceptación (§ 9.4).
   */
  whatsapp: string | null;
  web: string | null;
  mail: string | null;

  // ── interno, no sale nunca ───────────────────────────────────────────────
  /**
   * Cómo repreguntarle a **quien cargó la ficha**. Es el segundo dato personal
   * de un tercero que el proyecto guarda, después del `contacto` de una
   * propuesta, y tiene el mismo trato: interno como `difusion` (§5.1), su fila
   * en `docs/07-seguridad.md` y su centinela en el barrido de **esta** colección
   * —`tests/libreria-publica.test.ts`, con el fixture
   * `tests/fixtures/centinelas-libreria.ts`—, que es otro archivo que el barrido
   * de la actividad: aquél recorre `RUTAS_CENTINELA`, que son campos de
   * `Actividad`.
   *
   * **Que conviva en el mismo documento que los cuatro contactos públicos es
   * exactamente la condición donde una proyección por spread filtra un campo**
   * (§ 8 del PRD): la whitelist de `toPublic` no se negocia.
   */
  contactoDeQuienCargo: { via: ViaContactoLibreria; valor: string } | null;

  // ── el ciclo de vida, que es el de `lib/directorios.ts` ──────────────────
  /** Lo fuerza la regla en `'pendiente'` al crearse. */
  estado: EstadoDirectorio;
  origen: OrigenLibreria;
  /** Normalizado con `normalize` (§6). Lo deriva `formALibreria`. */
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
   * de la trampa 10.
   *
   * **Opcional, con el default de lectura que preserva el comportamiento
   * anterior** (§ «Un campo nuevo se lee con el default que preserva lo
   * anterior» de `05-patrones.md`): ausente ⇒ se contesta con el estado actual,
   * que es exactamente lo que hace `slugBloqueado` hoy. Sin ese default, el día
   * que el campo exista las fichas anteriores quedarían con el slug editable — o
   * sea el candado abierto justo para las que ya están en Google.
   *
   * **Hoy no la escribe nadie**: la escribe un trigger con el Admin SDK, y el de
   * esta colección todavía no existe. Por eso `firestore.rules` no la exige
   * (`hasAll`) pero sí **impide que un cliente la toque**: si un admin pudiera
   * bajarla a `false`, tendría de vuelta el slug de una ficha ya indexada.
   */
  publicadaAlgunaVez?: boolean;
}

export interface LibreriaConId extends Libreria {
  id: string;
}

/**
 * Lo que se llena en el formulario — **el mismo formulario con dos
 * configuraciones** (§ 5 del PRD), no dos formularios.
 *
 * Todo string y nada `null`, por el mismo motivo que `PropuestaForm`: un
 * `<input>` no tiene `null`. `formALibreria` traduce el `''` a `null` al armar
 * el documento, que es donde la ausencia tiene que representarse **de una sola
 * forma** para que la regla pueda exigir `== null`.
 *
 * Los campos que el formulario **público** no muestra —`slug` (lo deriva el
 * admin del nombre), `geo`, y los tres de gestión— están igual en este tipo:
 * la diferencia entre las dos configuraciones es qué se **pinta**, no qué
 * existe. Lo que sí cambia de un lado al otro es una regla de validación, y por
 * eso hay dos schemas (`libreriaFormSchema` y `libreriaPublicaFormSchema`).
 */
export interface LibreriaForm {
  nombre: string;
  /** `''` ⇒ lo deriva `slugDeFicha(nombre)` al armar el documento. */
  slug: string;
  descripcion: string;
  imagenes: Imagen[];
  direccion: string;
  barrio: string;
  ciudad: string;
  /** Los dos `''` ⇒ `geo: null`. Se tipean como texto porque salen de un input. */
  geo: { lat: string; lng: string };
  instagram: string;
  whatsapp: string;
  web: string;
  mail: string;
  contactoDeQuienCargo: { via: ViaContactoLibreria; valor: string };
}
