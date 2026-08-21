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

export const TIPOS_MATERIAL = ['lectura', 'guia', 'contexto', 'autor', 'otro'] as const;
export type TipoMaterial = (typeof TIPOS_MATERIAL)[number];

export const ENTREGAS_MATERIAL = ['previo', 'al-inscribirse', 'en-el-encuentro'] as const;
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
  imagenUrl: string | null;
  organizador: Organizador;
  tallerista: Persona | null;

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
  > {
  sesiones: SesionForm[];
  inscripcion: Omit<Inscripcion, 'cierra'> & { cierra: string };
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
