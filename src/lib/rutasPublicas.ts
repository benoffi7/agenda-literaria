/**
 * Las URLs del sitio público, en un solo lugar — B-227, con el dominio desde
 * B-109.
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
 *
 * ── Y desde B-109, el origen: `SITIO` ─────────────────────────────────────
 * El dominio se registró y el canónico lo decidió el dueño (**D-165**). Con eso
 * este módulo pasa a ser también el dueño del **origen**, y por lo tanto de las
 * tres salidas que necesitan URL absoluta: el `canonical`, el Open Graph y el
 * `sitemap.xml`. Escrito a mano en tres lugares serían tres lugares donde puede
 * quedar viejo, y el modo de falla del peor de ellos —una canónica a un dominio
 * equivocado— es que Google saque la página del índice.
 *
 * `astro.config.mjs` importa `SITIO` de acá para su `site`, así que no hay dos
 * copias del dominio ni siquiera entre la config y el código.
 */

/** El prefijo de la ruta de una actividad. Astro lo deriva del nombre del archivo. */
export const PREFIJO_ACTIVIDAD = '/actividad';

/**
 * La ruta **relativa** de la página de una actividad: `/actividad/{slug}`.
 *
 * Relativa, y la absoluta se arma con `urlAbsoluta` — que es la que necesitan el
 * canonical, el Open Graph y el sitemap (B-109). Sigue habiendo **un solo lugar**
 * donde el path se escribe, y ahora también uno donde se escribe el origen.
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
 */
export const rutaDeMes = (clave: string): string => `${PREFIJO_MES}/${clave}`;

/**
 * El archivo: `/pasadas` — B-109, §4.5 del diseño.
 *
 * Vive acá y no como literal en cada llamador porque tiene **tres** consumidores
 * el día uno: el pie del sitio, el aviso de la página de un mes vencido
 * (`mesPublico.ts`, que hasta B-109 mandaba a la home porque esta página no
 * existía) y el sitemap. Es la misma regla que hizo nacer este módulo.
 */
export const RUTA_PASADAS = '/pasadas';

// ─────────────────────────────────────────────────────────────────
// El origen — B-109, D-165
// ─────────────────────────────────────────────────────────────────

/**
 * **El canónico del sitio, y la única vez que el dominio se escribe.**
 *
 * Lo decidió el dueño: de los tres nombres que responden hoy —`agendaleh.ar`,
 * `agendaleh.com.ar` y `agenda-literaria.web.app`— la buena es la primera
 * (D-165). Los otros dos siguen sirviendo el mismo HTML: `web.app` **para
 * siempre**, porque Firebase no lo apaga, y `com.ar` hasta que el dueño
 * configure la redirección en la consola (`docs/08-operacion.md`).
 *
 * Por eso el canonical **tiene que ser absoluto**: es lo único que le dice a
 * Google cuál de los tres nombres es el bueno, y tiene que decirlo también en el
 * HTML que sirven los otros dos. Un canonical relativo apunta al host que lo
 * sirvió, o sea que en `web.app` diría que la página buena es la de `web.app` —
 * el contenido duplicado que esto viene a cerrar.
 *
 * Sin barra final: la barra la pone `rutaCanonica`, que es la que sabe cuándo va.
 */
export const SITIO = 'https://agendaleh.ar';

/**
 * La ruta como la sirve Firebase Hosting: **con barra final**, salvo un archivo.
 *
 * ── Por qué la barra, si todos los `href` del sitio van sin ella ──────────
 * Porque es la forma que contesta **200**. Astro emite `cartelera/index.html` y
 * Firebase, con su comportamiento por defecto, redirige `/cartelera` a
 * `/cartelera/` con un 301 — está medido contra producción el 2026-09-02:
 *
 *     curl -I https://agendaleh.ar/cartelera   → 301 → /cartelera/
 *     curl -I https://agendaleh.ar/cartelera/  → 200
 *
 * Una canónica que apunta a una redirección es un aviso en Search Console
 * («la URL canónica alternativa es una redirección») y una entrada de sitemap
 * que apunta a una redirección es una URL menos rastreada. Los `href` internos
 * pueden pagar el salto —lo pagan hoy, y se ve como un 301 en el navegador—;
 * la canónica y el sitemap no, porque son lo que Google indexa.
 *
 * **El caso del archivo:** `/robots.txt`, `/sitemap.xml`, `/events.json` y
 * `/version.json` son archivos, no directorios, y una barra al final los
 * convierte en un 404. Se detectan por el punto en el último segmento, que es la
 * regla más chica que separa los dos casos sin una lista que mantener.
 *
 * La raíz queda en `/` — no hay barra que agregar ni sacar.
 */
export const rutaCanonica = (ruta: string): string => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ruta)) {
    /*
     * Una URL absoluta acá es un error de quien llama, y **se corta el build**
     * en vez de emitir `https://agendaleh.arhttps://…`: una canónica malformada
     * no se ve mirando la página y la publica el deploy siguiente.
     */
    throw new Error(
      `rutaCanonica espera una ruta del sitio y recibió una URL absoluta: ${ruta}. ` +
        'El origen lo pone `SITIO`; acá va solo el path.',
    );
  }
  // Ni query ni fragmento: la canónica es la URL limpia de la página. El
  // `pathname` de Astro nunca los trae, y si alguien los pasa se descartan acá y
  // no en cada llamador.
  const limpia = ruta.split(/[?#]/)[0] ?? '';
  const conBarra = limpia.startsWith('/') ? limpia : `/${limpia}`;
  const sinBarraFinal = conBarra.replace(/\/+$/, '');
  if (sinBarraFinal === '') return '/';
  const ultimo = sinBarraFinal.slice(sinBarraFinal.lastIndexOf('/') + 1);
  return ultimo.includes('.') ? sinBarraFinal : `${sinBarraFinal}/`;
};

/**
 * La URL absoluta de una ruta del sitio: `https://agendaleh.ar/pasadas/`.
 *
 * Es **la** función de la que salen el canonical, el `og:url`, el sitemap y las
 * URLs del JSON-LD. Ninguna de esas salidas escribe el dominio: si lo hicieran,
 * el día que el dominio cambie tres de ellas quedarían viejas y ninguna fallaría.
 */
export const urlAbsoluta = (ruta: string): string => `${SITIO}${rutaCanonica(ruta)}`;

/** La URL absoluta de la página de una actividad. */
export const urlDeDetalle = (slug: string): string => urlAbsoluta(rutaDeDetalle(slug));

/** La URL absoluta de la página de un mes. */
export const urlDeMes = (clave: string): string => urlAbsoluta(rutaDeMes(clave));
