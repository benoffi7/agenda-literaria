/**
 * Modelo de datos — §3 de CLAUDE.md.
 * Los nombres de campo van en español, coherente con el dominio (§14).
 */

/** `Timestamp` de Firestore. Se tipa laxo para no acoplar cliente y Admin SDK. */
export interface TimestampLike {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
}

export const TIPOS_ACTIVIDAD = [
  'taller',
  'club-lectura',
  'encuentro',
  'presentacion',
  'charla',
] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

export const MODALIDADES = ['presencial', 'virtual', 'hibrido'] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const ESTADOS = ['borrador', 'pendiente', 'publicado', 'cancelado'] as const;
export type Estado = (typeof ESTADOS)[number];

export const VIAS_INSCRIPCION = ['mail', 'whatsapp', 'dm', 'formulario'] as const;
export type ViaInscripcion = (typeof VIAS_INSCRIPCION)[number];

/**
 * Los formatos de material de un club de lectura (B-134).
 *
 * **No se agregó `libro`, y no es un olvido.** El reporte que abrió esto lo
 * nombra —"son varias cosas: libro, newsletters, guía, playlist"— pero `lectura`
 * ya es eso: el texto asignado. Tener las dos partiría los datos existentes en
 * dos valores que después no se pueden volver a juntar, porque nadie va a saber
 * cuál eligió cada uno. Se cambió la **etiqueta** a "Libro o lectura", que es
 * reversible; agregar el valor no lo es.
 *
 * `newsletter` y `playlist` sí son formatos nuevos: no entraban en ninguno.
 */
export const TIPOS_MATERIAL = [
  'lectura',
  'guia',
  'contexto',
  'autor',
  'newsletter',
  'playlist',
  'otro',
] as const;
export type TipoMaterial = (typeof TIPOS_MATERIAL)[number];

/**
 * Cuándo llega el material. Sigue **cerrado** a propósito, a diferencia de las
 * taxonomías del §4: son momentos del ciclo de vida de la inscripción, no
 * vocabulario libre, y el §5.1 los usa para decidir qué se publica.
 *
 * `durante-el-mes` es el pedido concreto del dueño (B-134), y dice algo del
 * dominio: la entrega no siempre es un instante, puede ser progresiva a lo largo
 * del ciclo. Encaja con el §2.2 —ocho encuentros con su lectura cada uno.
 */
export const ENTREGAS_MATERIAL = [
  'previo',
  'al-inscribirse',
  'durante-el-mes',
  'en-el-encuentro',
] as const;
export type EntregaMaterial = (typeof ENTREGAS_MATERIAL)[number];

export interface Organizador {
  nombre: string;
  instagram: string;
  web: string;
}

/** Tallerista, o autor invitado en presentaciones y charlas (§11). */
export interface Persona {
  nombre: string;
  bio: string;
  instagram: string;
}

/**
 * La obra que se presenta (DEC-1). Aparece en `presentacion` y `charla`, los
 * mismos dos tipos que abren el bloque de autor invitado (§11).
 *
 * **Es un campo propio y no un párrafo de la descripción**: así se puede mostrar
 * aparte, buscar por él (entra al `searchText` del §6) y filtrar más adelante.
 * Hasta acá una presentación cargaba el autor en `tallerista` y el título del
 * libro quedaba enterrado en la descripción, donde nada lo puede leer.
 */
export interface Libro {
  /** Título de la obra. Es lo que identifica al libro; sin esto no hay libro. */
  titulo: string;
  /**
   * Autor de la obra, **solo si difiere del invitado** que ya está en
   * `tallerista`. En una presentación normal el autor es el invitado y este
   * campo queda vacío; se llena cuando se presenta a un tercero (una traducción,
   * una antología, un autor que no viene o que ya murió).
   */
  autor: string;
}

export interface Sesion {
  /** `ses_<uuid>` — generado en cliente, NUNCA por índice (§3.1, trampa 2). */
  id: string;
  inicio: TimestampLike;
  /** La duración del encuentro sale de acá. */
  fin: TimestampLike;
  tema: string | null;
  lectura: string | null;
  cancelada: boolean;
  calendarEventId: string | null;
}

/**
 * Una imagen de la galería (B-167, DEC-7).
 *
 * Reemplaza al `imagenUrl` único. El modelo es una **lista** porque una actividad
 * tiene el flyer, fotos del espacio y de ediciones anteriores, y B-107 necesita
 * exactamente una para Open Graph — de ahí `portada`.
 */
export interface Imagen {
  /** `img_<uuid>` — generado en cliente, NUNCA por índice (§3.1, trampa 2). */
  id: string;
  url: string;
  /**
   * Pie de foto, **opcional** (DEC-7a). No es el texto alternativo: ese sale del
   * título de la actividad, decidido a propósito para no pedir un campo por
   * imagen que terminaría diciendo "foto". Ver D-125.
   */
  epigrafe: string;
  /**
   * `externa` es una URL de otro lado, que se sirve tal cual desde su origen;
   * `propia` está en nuestro Storage y la Function le quitó el EXIF y derivó una
   * miniatura (DEC-7c, DEC-7d).
   */
  origen: 'externa' | 'propia';
  /**
   * Ruta del objeto en Storage. Solo las propias. **Nunca sale al público**
   * (§5.1): dibuja la estructura del bucket.
   */
  storagePath?: string;
  ancho?: number;
  alto?: number;
  /** Exactamente una por actividad: es la que va a Open Graph y a la tarjeta. */
  portada: boolean;
}

export interface Sede {
  nombre: string;
  direccion: string;
  barrio: string;
  ciudad: string;
  indicaciones: string;
  geo: { lat: number; lng: number } | null;
}

export interface Online {
  plataforma: string;
  url: string;
  /** ¿El link se puede publicar? Por defecto false (§5.1, trampa 5). */
  urlPublica: boolean;
}

export interface Inscripcion {
  requiere: boolean;
  via: ViaInscripcion | null;
  /** Mail, teléfono, @handle o URL. */
  destino: string;
  cupo: number | null;
  cierra: TimestampLike | null;
  /**
   * B-97 — «se llenó». Se prende desde el menú «⋯» del listado, no desde el
   * formulario: es el dato que cambia **después** de publicar, y abrir 30+
   * campos desde el teléfono para tocar una casilla no se hace.
   *
   * **Un booleano y no un contador de lugares.** Un número queda viejo con cada
   * inscripción y no solo con la última, y un número viejo es peor que ninguno
   * porque parece información fresca. Esto se prende cuando no entra nadie más y
   * se apaga si se libera un lugar.
   *
   * **No esconde el canal de inscripción** (§5.2, `toPublic`): queda, con el
   * cartel al lado. Siempre hay lista de espera y las bajas existen — esconder el
   * canal convierte una baja en un lugar que se pierde.
   *
   * **Opcional a propósito:** los documentos que ya están en producción no lo
   * tienen, y el default de lectura los devuelve en `false`, que es exactamente
   * el comportamiento anterior. Que el tipo lo declare opcional es lo que obliga
   * al compilador a decidirlo en cada lectura (D-26).
   */
  completo?: boolean;
}

export interface Arancel {
  /** Slug de taxonomía (§4). */
  tipo: string;
  /** Libre: "2 cuotas", "incluye material". */
  notas: string;
}

export interface ItemMaterial {
  tipo: TipoMaterial;
  titulo: string;
  url: string;
  entrega: EntregaMaterial;
  /** ¿Se muestra el link sin inscribirse? (§5.1) */
  publico: boolean;
}

export interface Material {
  tiene: boolean;
  items: ItemMaterial[];
}

/** Interno, nunca público (§3.2, §5.1). */
export interface Difusion {
  /** Handles a etiquetar al publicar en redes. */
  arrobar: string[];
  notas: string;
}

export interface Actividad {
  tipo: TipoActividad;
  titulo: string;
  /** Único, inmutable después de publicar (§7, trampa 10). */
  slug: string;
  descripcion: string;
  /**
   * B-167 — la galería. **Opcional a propósito:** los documentos que ya están en
   * producción tienen `imagenUrl` y no tienen esto, y el default de lectura los
   * convierte en una lista de un elemento (D-125). Que el tipo lo declare
   * opcional es lo que obliga al compilador a decidirlo en cada lectura (D-26).
   */
  imagenes?: Imagen[];
  /**
   * @deprecated Lo reemplazó `imagenes` (B-167). Sigue en el tipo porque los
   * documentos viejos lo tienen y el default de lectura lo lee; las escrituras
   * nuevas **no** lo escriben.
   */
  imagenUrl?: string | null;
  organizador: Organizador;
  tallerista: Persona | null;
  /**
   * DEC-1 — el libro presentado. **Opcional a propósito:** los documentos que ya
   * están en producción no lo tienen, y el default de lectura los devuelve con
   * el bloque vacío (`libroVacio()` en `formulario/estadoInicial.ts`), que es
   * exactamente el comportamiento anterior. Que el tipo lo declare opcional es
   * lo que obliga al compilador a decidirlo en cada lectura (D-26).
   *
   * `null` es el valor que escribe el panel cuando no hay título: un libro sin
   * título no es un libro, igual que un `tallerista` sin nombre.
   */
  libro?: Libro | null;

  esCiclo: boolean;
  sesiones: Sesion[];

  modalidad: Modalidad;
  sede: Sede | null;
  online: Online | null;

  inscripcion: Inscripcion;
  arancel: Arancel;
  material: Material;
  difusion: Difusion;

  estado: Estado;
  tags: string[];
  destacado: boolean;
  /** Normalizado — §6. Lo calcula el cliente al guardar. */
  searchText: string;

  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  createdBy: string;
  updatedBy: string;
}

/** Documento con id, tal como lo consume el panel. */
export type ActividadConId = Actividad & { id: string };

/**
 * Forma del formulario: fechas como strings `datetime-local` y sin campos
 * de auditoría. Se convierte a `Actividad` al guardar.
 */
export interface SesionForm {
  id: string;
  inicio: string;
  fin: string;
  tema: string;
  lectura: string;
  cancelada: boolean;
  calendarEventId: string | null;
}

export interface ActividadForm
  extends Omit<
    Actividad,
    | 'sesiones'
    | 'searchText'
    | 'createdAt'
    | 'updatedAt'
    | 'createdBy'
    | 'updatedBy'
    | 'inscripcion'
    | 'imagenes'
    | 'imagenUrl'
    | 'libro'
  > {
  sesiones: SesionForm[];
  /**
   * `completo` es **siempre un booleano en el formulario**, nunca `undefined`:
   * el default de lectura ya resolvió los documentos anteriores a B-97 antes de
   * llegar acá, así que la pantalla no tiene que preguntárselo. Es la misma
   * asimetría que `libro` y por el mismo motivo.
   *
   * Está en el formulario **aunque no se prenda desde el formulario**: sin esto,
   * `formADocumento` reescribe `inscripcion` completo en cada guardado y una
   * edición de la descripción apagaría el cartel de «Cupo completo» sin que
   * nadie lo pida — y con él la línea de los N eventos del calendario.
   */
  inscripcion: Omit<Inscripcion, 'cierra' | 'completo'> & {
    cierra: string;
    completo: boolean;
  };
  /**
   * DEC-1 — **siempre un objeto en el formulario, nunca `null`**, aunque en el
   * documento sea `Libro | null`.
   *
   * Es la asimetría de `imagenes` por el mismo motivo: el default de lectura ya
   * resolvió el caso de los documentos viejos antes de llegar acá, así que la
   * pantalla no tiene que preguntarse si el bloque existe. Y a diferencia de
   * `tallerista`, que lo crea la cascada de tipo, este nace con el formulario:
   * dos campos de texto vacíos no fabrican datos que nadie cargó, porque
   * `formADocumento` los convierte en `null` si no tienen título.
   */
  libro: Libro;
  /**
   * Siempre un array, nunca `undefined`: el formulario no tiene el problema de
   * los documentos viejos, porque el default de lectura ya resolvió eso antes de
   * llegar acá. Y `imagenUrl` no está: el formulario no escribe el campo viejo.
   */
  imagenes: Imagen[];
}

/** §4.1 — `/opciones/{campo}` */
export interface ValorOpcion {
  slug: string;
  label: string;
  orden: number;
  /** Protege las opciones base: no se borran ni renombran desde la UI (§4.3). */
  fijo: boolean;
  usos: number;
  /**
   * §4.3 — una opción creada con "Otro" no entra al desplegable de los demás
   * hasta que alguien la valida.
   *
   * **Opcional a propósito:** los documentos de `/opciones/*` que ya están en
   * producción se escribieron antes de que existiera el campo. Ausente cuenta
   * como aprobada — ver `estaAprobada` en `lib/opciones.ts`.
   */
  aprobada?: boolean;
  /**
   * Huella del uid de quien la creó, para que la siga viendo mientras espera
   * aprobación. **Es una huella, no un uid:** este documento es de lectura
   * pública (§5.3) y los uids no salen al público (§5.1). Ver `lib/huella.ts`.
   */
  huellaCreador?: string;
}

export interface DocOpciones {
  valores: ValorOpcion[];
}

/** Campos que usan el patrón de taxonomía autogestionada (§4). */
export const CAMPOS_TAXONOMIA = ['arancel', 'tipo', 'barrio', 'plataforma', 'tags'] as const;
export type CampoTaxonomia = (typeof CAMPOS_TAXONOMIA)[number];
