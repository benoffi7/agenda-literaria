/**
 * Reportes del panel — `/reportes/{id}`.
 *
 * Los carga un admin desde el panel y una Cloud Function los publica como
 * issue en GitHub (`functions/reportes-trigger.js`). El repo es **público**:
 * lo que no debe salir de acá está marcado campo por campo.
 *
 * Nombres en español, como el resto del modelo (§14).
 */
import type { TimestampLike } from '@/types/actividad';

export const TIPOS_REPORTE = ['bug', 'sugerencia'] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

/** Cuánto molesta el bug. Sirve para que el dueño priorice sin preguntar. */
export const SEVERIDADES = ['me-bloquea', 'molesta', 'menor'] as const;
export type Severidad = (typeof SEVERIDADES)[number];

/**
 * En qué pantalla estaba. Se pregunta en vez de deducirlo del router: el
 * problema casi siempre pasó en la pantalla anterior a la del reporte.
 * Los slugs se convierten a texto en el issue con des-slug, así que agregar
 * uno no obliga a tocar la Function.
 */
/**
 * El tope de largo del título — B-364. Es el **mismo** límite dicho en tres
 * lugares (`firestore.rules`, `reporte-schema.ts`, el `maxLength` del input
 * de `ReporteFormulario.tsx`), a diferencia del `.slice(0, 200)` de
 * `functions/reportes.js` o el límite de 256 de GitHub, que son otra cosa —
 * el margen que el saneador necesita para expandir, y el techo de un
 * tercero— y no hay que atarlos con este.
 *
 * `firestore.rules` no puede importarlo (es un runtime aparte), así que ese
 * lado se ata con un test que lee el archivo y compara el número:
 * `tests/clases-de-bug.test.ts` → «los tres topes de 120 son el mismo
 * límite» (B-364).
 */
export const TOPE_TITULO_REPORTE = 120;

export const PANTALLAS = [
  'listado',
  'nueva-actividad',
  'editar-actividad',
  'encuentros',
  'otra',
] as const;
export type Pantalla = (typeof PANTALLAS)[number];

/** Ciclo de vida del reporte. Lo mueve la Function; el panel solo lo muestra. */
export const ESTADOS_REPORTE = ['pendiente', 'enviando', 'creado', 'error'] as const;
export type EstadoReporte = (typeof ESTADOS_REPORTE)[number];

/**
 * Contexto técnico. Va entero al issue público: nada de esto identifica a la
 * persona más de lo que ya lo hace cualquier visita a un sitio web.
 */
export interface ContextoReporte {
  /**
   * `VERSION_APP` del bundle que estaba corriendo (`0.1.0+<sha>`) más la fecha
   * del build. Es lo que permite rebuildear el código exacto del reporte.
   */
  versionPanel: string;
  /** `navigator.userAgent`, recortado. */
  navegador: string;
  /** "390×844 @3x" — la mayoría de los bugs de layout son de tamaño. */
  ventana: string;
  /** Trampa 1: sin la zona horaria, un reporte de fechas no se diagnostica. */
  zonaHoraria: string;
  /** Ruta dentro del panel, sin query. */
  url: string;
  pantalla: Pantalla;
}

export interface Reporte {
  tipo: TipoReporte;
  titulo: string;
  descripcion: string;
  /** Cómo reproducirlo. Solo tiene sentido en un bug. */
  pasos: string | null;
  severidad: Severidad | null;
  /** Actividad referida. Al issue solo sale el título si está publicada. */
  actividad: { id: string; titulo: string } | null;
  contexto: ContextoReporte;
  /** NUNCA al issue (§5.1: uids y mails no salen). Es la trazabilidad interna. */
  reportadoPor: { uid: string; email: string };
  estado: EstadoReporte;
  intentos: number;
  github: { numero: number; url: string; creadoEn: TimestampLike } | null;
  error: string | null;
  creadoEn: TimestampLike;
  actualizadoEn?: TimestampLike;
}

export interface ReporteConId extends Reporte {
  id: string;
}

/** Lo que llena la persona en el formulario. */
export interface ReporteForm {
  tipo: TipoReporte;
  titulo: string;
  descripcion: string;
  pasos: string;
  severidad: Severidad | null;
  pantalla: Pantalla;
  /** `''` = el reporte no es sobre una actividad puntual. */
  actividadId: string;
}
