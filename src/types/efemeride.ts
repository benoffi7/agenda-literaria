/**
 * Efemérides — `/efemerides/{id}`. **B-959**, pedido del dueño (2026-09-15).
 *
 * «Hoy nació Cortázar», «se publicó *Rayuela*»: **el dato del día, sin lugar ni
 * horario**. No es una actividad a la que se vaya, y por eso no es un `tipo` más
 * de `/actividades` (los tres motivos están en el ítem del BACKLOG y en la
 * decisión D-1170):
 *
 * 1. una actividad publicada va al calendario, y la guarda de eso son `estado` y
 *    `sesiones` (§7.3) — meter efemérides ahí pedía un `if` por tipo adentro de
 *    `syncCalendar`, la parte más frágil del sistema;
 * 2. no tiene nada del formulario de una actividad;
 * 3. **y no es una fecha: es un día y un mes.** Se repite todos los años.
 *
 * ── Por qué `dia` y `mes` y no un `Timestamp` ────────────────────────────
 * La trampa 1 del §13 es «timestamps sin timezone → corridos 3 horas». Una
 * efeméride guardada como `Timestamp` a la medianoche de Buenos Aires es el 24 a
 * las 21:00 en UTC, y cualquier lector que se olvide de la zona la muestra el día
 * anterior. Con dos enteros no hay zona que olvidar: el 25 de septiembre es
 * `{ dia: 25, mes: 9 }` en todos los relojes. El año del hecho va **aparte** y es
 * opcional —hay efemérides sin año cierto, y el año no decide qué día se muestra—.
 *
 * Esto **no** contradice el §2.2 («no usar RRULE»): esa decisión es sobre los
 * encuentros de un ciclo; acá no hay ningún evento que recurrir, y la efeméride
 * **no llega al calendario** (no hay trigger de Calendar sobre esta colección).
 *
 * ── Qué NO se reusa de los directorios, y por qué ────────────────────────
 * Los directorios de la Guía (`lib/directorios.ts`) tienen tres estados
 * —`pendiente`, `publicado`, `rechazado`— porque **cualquiera** puede pedir el
 * alta. Acá no: una efeméride la carga solo un admin desde el panel, así que el
 * ciclo es el de un borrador (`borrador` → `publicado`), sin bandeja ni
 * `rechazado`. Sí se copia **el patrón**: tipo propio, schema propio, proyección
 * whitelist propia, JSON estático y páginas SSG.
 */
import type { TimestampLike } from '@/types/actividad';

/**
 * Los dos estados. **No son los de un directorio** (ver el docblock del
 * archivo): nadie de afuera propone una efeméride, así que no hay nada que
 * rechazar.
 */
export const ESTADOS_EFEMERIDE = ['borrador', 'publicado'] as const;
export type EstadoEfemeride = (typeof ESTADOS_EFEMERIDE)[number];

/** El único estado que sale al sitio. Lo usan la query del build y el panel. */
export const ESTADO_PUBLICO_EFEMERIDE: EstadoEfemeride = 'publicado';

/**
 * De dónde sale el dato. **Opcional y uno solo**: el texto («Wikipedia»,
 * «Biblioteca Nacional») y la dirección. Cualquiera de las dos mitades puede
 * faltar — una fuente sin link («Diario de Pizarnik, 1962») es una cita válida.
 */
export interface FuenteDeEfemeride {
  texto: string;
  url: string;
}

export interface Efemeride {
  titulo: string;
  /** Único e **inmutable después de publicar** — trampa 10 del §13. */
  slug: string;
  /** Corta: es el dato, no un artículo. */
  descripcion: string;
  /** 1–31, validado contra el mes (el 29 de febrero existe). */
  dia: number;
  /** 1–12. */
  mes: number;
  /** El año del hecho, o `null` si no se sabe o no importa. */
  anio: number | null;
  fuente: FuenteDeEfemeride | null;
  estado: EstadoEfemeride;
  /**
   * La escribe el trigger de rebuild con el Admin SDK la primera vez que la
   * efeméride se publica, y nunca la apaga (B-285, D-910). Es lo que mantiene el
   * slug congelado si se despublica. Ausente en los documentos nuevos.
   */
  publicadaAlgunaVez?: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  createdBy: string;
  updatedBy: string;
}

export type EfemerideConId = Efemeride & { id: string };

/**
 * Lo que tipea el formulario. Los números viajan como texto porque un `<input>`
 * no tiene `number | null`: la conversión es una sola y vive en
 * `formAEfemeride`.
 */
export interface EfemerideForm {
  titulo: string;
  slug: string;
  descripcion: string;
  dia: string;
  mes: string;
  anio: string;
  fuente: FuenteDeEfemeride;
}

// ─────────────────────────────────────────────────────────────────
// Topes — los mismos números en el schema y en `firestore.rules`
// (los ata `tests/efemerides.test.ts`, clase de B-88)
// ─────────────────────────────────────────────────────────────────

export const MIN_TITULO_EFEMERIDE = 3;
export const TOPE_TITULO_EFEMERIDE = 120;
export const TOPE_SLUG_EFEMERIDE = 120;
/** «Descripción corta»: dos o tres oraciones. El renglón de la home es el título. */
export const TOPE_DESCRIPCION_EFEMERIDE = 600;
export const TOPE_FUENTE_TEXTO_EFEMERIDE = 120;
export const TOPE_FUENTE_URL_EFEMERIDE = 500;
/**
 * El rango del año del hecho. Desde el año 1 —las efemérides no son solo de
 * literatura argentina— hasta un techo que solo existe para que un typo de cinco
 * cifras no entre. Sin años negativos: un hecho anterior a la era común se carga
 * sin año y con el dato en la descripción.
 */
export const MIN_ANIO_EFEMERIDE = 1;
export const TOPE_ANIO_EFEMERIDE = 2999;

/**
 * Cuántos días tiene cada mes **en un año bisiesto**: el 29 de febrero es una
 * efeméride posible (en los otros años se muestra el 28 — ver
 * `efemeridesDelDia` en `lib/efemeridePublica.ts`).
 */
export const DIAS_POR_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
