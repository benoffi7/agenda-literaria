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
 * Desde B-113 hay un segundo par igual: la página de mes (`/agenda/{aaaa-mm}`) la
 * **produce** `caminosDeMes` y la **linkean** la tira de la home y la navegación
 * entre meses. Tres lugares escribiendo `/agenda/${clave}` es la misma clase, con
 * el agravante de que un mes sin página es un 404 que solo se ve en producción.
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

/** El prefijo de la ruta de una página de mes — B-113, §2.2 del diseño. */
export const PREFIJO_MES = '/agenda';

/**
 * La ruta **relativa** de la página de un mes: `/agenda/2026-09`.
 *
 * El segmento es la **clave** del mes (`aaaa-mm`) y no el nombre: es ordenable
 * como texto, no depende del idioma y no se renombra. El mismo criterio que hace
 * que los hubs vayan por slug de taxonomía y no por label (§2.1).
 *
 * Relativa por lo mismo que `rutaDeDetalle`: la absoluta necesita `site` en
 * `astro.config.mjs`, que necesita el dominio decidido (**B-109**).
 */
export const rutaDeMes = (clave: string): string => `${PREFIJO_MES}/${clave}`;
