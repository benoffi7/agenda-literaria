/**
 * Las URLs del sitio público, en un solo lugar — B-227.
 *
 * ── Por qué un módulo para dos líneas ─────────────────────────────────────
 * Porque la ruta de una actividad ya se derivaba en **dos** lados y el tercero
 * está escrito, en un comentario, esperando a que exista el sitio:
 *
 * | Quién | Dónde |
 * |---|---|
 * | el que **produce** las páginas | `caminosDeDetalle` (`lib/contenidoDelSitio.ts`) |
 * | el que **linkea** desde el listado | `Tarjeta.tsx` |
 * | el que **linkeará** desde el posteo | `textoRedes.ts`, hoy comentado, con `${base}/actividad/${slug}` escrito |
 *
 * Es la clase de B-88 con nombre y apellido: un productor y un consumidor
 * derivando el mismo formato por separado. Lo señaló el `auditor-privacidad`
 * pidiendo que se extraiga **antes** de que exista el tercer lado, que es cuando
 * todavía es gratis: el día que alguien mueva las páginas a `/taller/{slug}`, el
 * listado linkea a 404 y el posteo publica una URL rota en Instagram — de donde
 * no se vuelve.
 *
 * La regla del §7 sigue valiendo por encima de esto: **el slug es inmutable
 * después de publicar** (trampa 10). Esto no lo cambia; asegura que quien lo use
 * arme la misma URL.
 */

/** El prefijo de la ruta de una actividad. Astro lo deriva del nombre del archivo. */
export const PREFIJO_ACTIVIDAD = '/actividad';

/**
 * La ruta **relativa** de la página de una actividad: `/actividad/{slug}`.
 *
 * Relativa y no absoluta a propósito: la absoluta necesita `site` en
 * `astro.config.mjs`, que necesita que el dominio esté decidido (**B-109**).
 * Cuando exista, la absoluta se arma acá —`${base}${rutaDeDetalle(slug)}`— y
 * sigue habiendo un solo lugar donde el path se escribe.
 */
export const rutaDeDetalle = (slug: string): string => `${PREFIJO_ACTIVIDAD}/${slug}`;
