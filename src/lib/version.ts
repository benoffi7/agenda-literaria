/**
 * Versión de la app y decisión de qué hacer cuando la publicada no coincide.
 *
 * `PUBLIC_VERSION_APP` la estampa el build: `scripts/version.mjs` la calcula y
 * `astro.config.mjs` la deja en el entorno, así que queda **dentro del bundle**.
 * Eso es lo que la hace útil: identifica al JS que está corriendo en este
 * navegador, no al último que se publicó. Sirve para dos cosas:
 *
 * 1. saber que la pestaña quedó vieja (comparándola contra `/version.json`),
 * 2. que un reporte de bug diga contra qué versión se probó.
 *
 * El módulo es puro a propósito (`docs/05-patrones.md` — lógica pura separada
 * de la infraestructura): el `fetch` y el `location.reload()` viven en
 * `useVersionPublicada`, y así la parte que decide se testea sin navegador.
 */

/** Sin versión estampada (dev server, tests): no se compara ni se recarga nada. */
export const VERSION_DESCONOCIDA = 'desconocida';

/** Recurso servido sin cachear que dice cuál es la versión publicada. */
export const RUTA_VERSION = '/version.json';

export interface InfoVersion {
  /** Legible por una persona: `0.1.0+a1b2c3d`. */
  version: string;
  /** ISO del momento del build. */
  generadoEn: string;
}

/** Versión del bundle que está corriendo ahora mismo. */
export const VERSION_APP: string =
  import.meta.env.PUBLIC_VERSION_APP || VERSION_DESCONOCIDA;

/** Lo mismo con la fecha del build. Es lo que conviene adjuntar a un reporte. */
export const INFO_VERSION: InfoVersion = {
  version: VERSION_APP,
  generadoEn: import.meta.env.PUBLIC_VERSION_GENERADO_EN || '',
};

/**
 * Cada cuánto se pregunta por la versión publicada estando la pestaña visible.
 * 15 minutos: el disparador que importa es volver a la pestaña, esto es solo la
 * red de contención para quien deja el panel abierto y a la vista todo el día.
 */
export const INTERVALO_CHEQUEO_MS = 15 * 60 * 1000;

/**
 * Piso entre dos chequeos. Volver a la pestaña dispara `visibilitychange`
 * muchas veces en una sesión de alt-tab; sin el piso eso es polling agresivo
 * disfrazado de evento.
 */
export const MINIMO_ENTRE_CHEQUEOS_MS = 60 * 1000;

export const debeChequear = (
  ahora: number,
  ultimoChequeo: number | null,
  minimo: number = MINIMO_ENTRE_CHEQUEOS_MS,
): boolean => ultimoChequeo === null || ahora - ultimoChequeo >= minimo;

/**
 * Parseo defensivo de `/version.json`.
 *
 * Si el recurso no está (404 con el HTML de error de Hosting, un portal cautivo
 * de wifi que devuelve su propia página) **no hay versión publicada**: mejor no
 * saber que recargar por una respuesta que no es nuestra.
 */
export function parsearInfoVersion(crudo: unknown): InfoVersion | null {
  if (typeof crudo !== 'object' || crudo === null) return null;
  const { version, generadoEn } = crudo as Record<string, unknown>;
  if (typeof version !== 'string' || version.trim() === '') return null;
  return {
    version: version.trim(),
    generadoEn: typeof generadoEn === 'string' ? generadoEn : '',
  };
}

/**
 * ¿La publicada es distinta de la que está corriendo?
 *
 * Se compara por igualdad, no por orden: un rollback a una versión anterior
 * también deja la pestaña desalineada y también hay que recargar. Y con
 * cualquiera de las dos desconocida no se compara nada — en el dev server no
 * hay versión estampada y recargar solo sería ruido.
 */
export function hayVersionNueva(actual: string, publicada: string | null | undefined): boolean {
  if (!actual || !publicada) return false;
  if (actual === VERSION_DESCONOCIDA || publicada === VERSION_DESCONOCIDA) return false;
  return actual !== publicada;
}

export type AccionVersion = 'nada' | 'recargar' | 'avisar';

export type MotivoAviso = 'cambios-sin-guardar' | 'recarga-sin-efecto';

export interface DecisionVersion {
  accion: AccionVersion;
  /** Solo cuando `accion === 'avisar'`: qué contarle a la persona. */
  motivo: MotivoAviso | null;
}

export interface EntradaDecision {
  /** Versión del bundle corriendo. */
  actual: string;
  /** Versión que dice `/version.json`, o `null` si todavía no se sabe. */
  publicada: string | null;
  /** ¿Hay un formulario con cambios sin guardar? */
  hayCambiosSinGuardar: boolean;
  /**
   * Versión publicada por la que esta pestaña **ya** se recargó una vez. Si
   * sigue sin coincidir después de recargar, recargar de nuevo es un loop.
   */
  yaSeRecargoPara?: string | null;
}

/**
 * La regla del asunto.
 *
 * - Nada en juego → se recarga sola, es lo menos molesto.
 * - Formulario con cambios sin guardar → **no se recarga**: son 30+ campos y
 *   varios minutos de trabajo (§11). Perder eso es peor que tener el JS viejo.
 *   Se avisa y se espera a que la persona guarde.
 * - Ya se recargó por esta misma versión y sigue igual → tampoco se recarga:
 *   el HTML lo está sirviendo algo que ignora las cabeceras, y `location
 *   .reload()` no puede saltear el cache. Se avisa para que intervenga a mano.
 */
export function decidirAccion({
  actual,
  publicada,
  hayCambiosSinGuardar,
  yaSeRecargoPara = null,
}: EntradaDecision): DecisionVersion {
  if (!hayVersionNueva(actual, publicada)) return { accion: 'nada', motivo: null };
  if (hayCambiosSinGuardar) return { accion: 'avisar', motivo: 'cambios-sin-guardar' };
  if (yaSeRecargoPara !== null && yaSeRecargoPara === publicada) {
    return { accion: 'avisar', motivo: 'recarga-sin-efecto' };
  }
  return { accion: 'recargar', motivo: null };
}
