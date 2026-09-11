/**
 * Las URLs del sitio público, en un solo lugar — B-227, con el dominio desde
 * B-109 y **la barra final desde B-330**.
 *
 * ── Por qué un módulo para dos líneas ─────────────────────────────────────
 * Porque la ruta de una actividad ya se derivaba en **dos** lados y el tercero
 * está escrito, en un comentario, esperando a que exista el sitio:
 *
 * | Quién | Dónde |
 * |---|---|
 * | el que **produce** las páginas | `caminosDeDetalle` (`lib/contenidoDelSitio.ts`) |
 * | el que **linkea** desde el listado | `FilaDeActividad.tsx` |
 * | el que **linkea** desde el posteo (B-312) | `textoRedes.ts` — `construirTextoRedes`, con `urlDeDetalle` y solo cuando la actividad ya tiene página |
 *
 * Desde B-113 hay un segundo par igual: la página de mes (`/agenda/{aaaa-mm}`) la
 * **produce** `caminosDeMes` y la **linkean** la tira de la home y la navegación
 * entre meses. Tres lugares escribiendo `/agenda/${clave}` es la misma clase, con
 * el agravante de que un mes sin página es un 404 que solo se ve en producción.
 *
 * Y desde B-108 hay un tercero, con **cuatro** patrones más: los hubs
 * (`/tipo/*`, `/barrio/*`, `/online`, `/gratis`), que los produce
 * `caminosDeTipo`/`caminosDeBarrio` y los linkean la tira de la home, la tira de
 * cada hub y el sitemap.
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
 *
 * ── Y desde B-330, **una sola forma de la ruta**: la que contesta 200 ──────
 * Hasta B-330 este módulo tenía dos formas de la misma ruta y las repartía por
 * consumidor: `rutaCanonica` agregaba la barra final —porque es lo que Firebase
 * contesta con un 200— y los `href` del sitio iban sin ella, comiéndose un 301
 * por click. Estaba anotado como **B-293** y medido: `curl -I /cartelera` →
 * `301 → /cartelera/`.
 *
 * Hoy **hay una sola forma y la produce `rutaCanonica`**: los constructores de
 * abajo la aplican, así que un `href`, una entrada del sitemap y una canónica de
 * la misma página son el mismo texto. El día que la config del host cambie
 * (`cleanUrls`) hay **un** lugar donde darla vuelta, y `tests/canonico.test.ts`
 * afirma que esa config sigue sin tocarse justamente para que el par no se rompa
 * por la mitad.
 */

// ─────────────────────────────────────────────────────────────────
// El origen y la forma — B-109, D-165
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
 * El dominio **sin el esquema**, para escribirlo en una frase.
 *
 * `agendaleh.ar` es lo que se lee bien en un texto —«el sitio está en
 * agendaleh.ar»— y es lo que la ayuda del panel y las novedades necesitan. Sale
 * de `SITIO` y no escrito otra vez: son textos que le prometen algo a quien
 * carga, y el día que el dominio cambie una promesa vieja manda a alguien a un
 * sitio que no existe. Es la razón por la que `tests/canonico.test.ts` barre
 * **todo** `src/` y no solo el markup del sitio público.
 */
export const DOMINIO = SITIO.replace(/^https?:\/\//, '');

/**
 * La ruta como la sirve Firebase Hosting: **con barra final**, salvo un archivo.
 *
 * ── Por qué la barra ──────────────────────────────────────────────────────
 * Porque es la forma que contesta **200**. Astro emite `cartelera/index.html` y
 * Firebase, con su comportamiento por defecto, redirige `/cartelera` a
 * `/cartelera/` con un 301 — está medido contra producción el 2026-09-02:
 *
 *     curl -I https://agendaleh.ar/cartelera   → 301 → /cartelera/
 *     curl -I https://agendaleh.ar/cartelera/  → 200
 *
 * Una canónica que apunta a una redirección es un aviso en Search Console
 * («la URL canónica alternativa es una redirección») y una entrada de sitemap
 * que apunta a una redirección es una URL menos rastreada.
 *
 * **Desde B-330 los `href` internos también van por acá** (era **B-293**): un
 * enlace sin la barra costaba un viaje de ida y vuelta por click, no se veía, y
 * dejaba dos textos para la misma página conviviendo en el repo. La otra salida
 * posible era `"trailingSlash": false` en `firebase.json`, que es más linda y
 * toca producción; se eligió ésta porque es la que se puede verificar sin
 * deployar y porque deja **una sola** forma escrita en un solo lugar.
 *
 * **El caso del archivo:** `/robots.txt`, `/sitemap.xml`, `/events.json` y
 * `/version.json` son archivos, no directorios, y una barra al final los
 * convierte en un 404.
 *
 * Se detectan por **un solo segmento con un punto**, no por «tiene un punto»: los
 * cuatro endpoints del sitio viven en la raíz, y las rutas de más de un segmento
 * son siempre páginas (`/actividad/{slug}`, `/agenda/{aaaa-mm}`, `/barrio/{slug}`).
 * Con la regla laxa, un slug con un punto —que `slugify` no produce, pero un
 * documento editado a mano en la consola sí puede tener— dejaría a esa página sin
 * la barra, o sea con una canónica que redirige. Es la regla más chica que separa
 * los dos casos sin una lista de endpoints que mantener.
 *
 * **Es idempotente**, y eso importa desde B-330: las constantes de abajo ya
 * vienen con la barra, y el layout las vuelve a pasar por acá para armar la
 * canónica.
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
  const segmentos = sinBarraFinal.slice(1).split('/');
  const esArchivo = segmentos.length === 1 && segmentos[0]!.includes('.');
  return esArchivo ? sinBarraFinal : `${sinBarraFinal}/`;
};

// ─────────────────────────────────────────────────────────────────
// Las páginas escritas a mano
// ─────────────────────────────────────────────────────────────────

/**
 * Las rutas fijas del sitio, **en la forma que contesta 200** — B-330.
 *
 * Están definidas pasándolas por `rutaCanonica` y no escritas con la barra a
 * mano, y eso es la garantía: no hay forma de escribir acá una variante que el
 * host redirija. Son las que `RUTAS_FIJAS` (`lib/sitemap.ts`) le ofrece al
 * buscador y las que el encabezado y el pie usan como `href` — un solo texto por
 * página, y no uno para el enlace y otro para el sitemap.
 */
export const RUTA_AGENDA = rutaCanonica('/');
export const RUTA_CARTELERA = rutaCanonica('/cartelera');
export const RUTA_SUSCRIBIRSE = rutaCanonica('/suscribirse');
export const RUTA_AYUDA = rutaCanonica('/ayuda');
export const RUTA_CONTACTO = rutaCanonica('/contacto');

/**
 * `/proponer/` — el formulario público de propuestas (B-830, paso 9).
 *
 * **Se llama `/proponer` y no `/sumar` ni `/cargar`**: es el verbo de quien
 * entra, y describe lo que de verdad pasa —se propone, no se publica—. «Cargar»
 * es lo que hace el panel y prometería que lo que se manda entra solo;
 * «sumar-actividad» dice lo mismo y más largo.
 *
 * ✅ **Anunciada desde el 2026-09-11** — B-896, pasos 3 y 4. Está en
 * `RUTAS_FIJAS` del sitemap y enlazada desde el chrome y desde `/contacto`.
 *
 * Estuvo fuera de los dos durante toda la tajada 1, y por un motivo que conviene
 * no perder: indexar una página cuyo formulario **no puede recibir nada** es
 * prometer lo que no se cumple, que es lo que B-780 costó como P0. Lo que
 * destrabó no fue exigir App Check en Storage —eso sigue sin resolverse, y es
 * B-872— sino sacar la subida de la foto de `storage.rules` y meterla en una
 * callable atestada (B-896 paso 1). O sea: la promesa se cumple, y por eso se
 * anuncia.
 */
export const RUTA_PROPONER = rutaCanonica('/proponer');

// ─────────────────────────────────────────────────────────────────
// La Guía y sus tres directorios — B-835 + B-834, tajada 2
// ─────────────────────────────────────────────────────────────────

/**
 * **El `/guia` se escribe una sola vez, y es esta línea** — decisión del dueño
 * del 2026-09-08 (`docs/prd/README.md` § «Las decisiones del dueño»).
 *
 * La pregunta era si los directorios viven en `/librerias` o en
 * `/guia/librerias`, y la respuesta cambió dos cosas de golpe: la barra gana
 * **una** pestaña en vez de tres —lo que desinfló B-835 antes de empezar— y
 * aparece una página madre, porque una pestaña tiene que llevar a algún lado.
 *
 * Que el prefijo sea una constante y no esté tipeado en cada ruta es la regla de
 * siempre de este módulo, y acá pesa más que nunca: son **cuatro páginas fijas y
 * tres familias de fichas** colgando del mismo segmento. Con el segmento escrito
 * ocho veces, moverlo sería ocho ediciones y la que se olvide publica una URL
 * que no existe. Con esto, es una.
 *
 * ⚠️ **Las colecciones de Firestore NO llevan `/guia/`.** El documento vive en
 * `/librerias/{id}` y la página se sirve en `/guia/librerias/{slug}`. `/guia/` es
 * una decisión de navegación y de SEO, no de modelo, y los PRDs usan las dos
 * formas — vale decirlo acá porque este archivo es donde se parecen.
 */
const PREFIJO_GUIA = '/guia';

/**
 * `/guia/` — el índice de los tres directorios.
 *
 * Es la única de las cuatro que existe hoy. Las otras tres llegan con su tajada
 * (B-831, B-832, B-833) y **sus constantes ya están abajo**: son las que la fila
 * de `/guia` usa como destino en cuanto `DIRECTORIOS` marque la sección como
 * disponible (`lib/directorios.ts`), y tenerlas acá desde el día uno es lo que
 * impide que la tajada que llegue primero escriba su `href` a mano (B-293).
 */
export const RUTA_GUIA = rutaCanonica(PREFIJO_GUIA);

/** Los prefijos de cada directorio: el listado es el prefijo, y las fichas cuelgan de él. */
export const PREFIJO_LIBRERIAS = `${PREFIJO_GUIA}/librerias`;
export const PREFIJO_SUSCRIPCIONES = `${PREFIJO_GUIA}/suscripciones`;
export const PREFIJO_LUGARES = `${PREFIJO_GUIA}/lugares`;

/** `/guia/librerias/` — el directorio de librerías (B-831). */
export const RUTA_LIBRERIAS = rutaCanonica(PREFIJO_LIBRERIAS);
/** `/guia/suscripciones/` — el directorio de suscripciones literarias (B-832). */
export const RUTA_SUSCRIPCIONES = rutaCanonica(PREFIJO_SUSCRIPCIONES);
/** `/guia/lugares/` — el directorio de lugares para hacer eventos (B-833). */
export const RUTA_LUGARES = rutaCanonica(PREFIJO_LUGARES);

/**
 * **¿Este texto puede ser el segmento de la URL de una ficha?**
 *
 * El alfabeto que produce `slugify` (`[a-z0-9-]`, sin guiones al borde ni
 * dobles), igual que `esSlugGuardable` de `guardadosDelSitio.ts` y por el mismo
 * motivo: lo que no pasa **se descarta**, nunca se emite.
 *
 * ── Por qué las fichas de directorio lo necesitan y la actividad no ───────
 * Lo señaló el `auditor-privacidad`, y la diferencia es de dónde viene el dato:
 * el slug de una actividad lo escribe siempre un admin, y el de una ficha de
 * directorio vive en una colección **cuya alta la pide cualquiera desde un
 * formulario público**. Acá el slug es además un campo de persona y no de
 * máquina (`CAMPOS_DE_MAQUINA_FICHA`, `lib/directorios.ts`), o sea que el único
 * productor correcto es `slugDeFicha` y nada obliga a que haya pasado por ahí.
 *
 * **Es un predicado y no un saneo adentro del constructor**, y las dos
 * alternativas se pensaron:
 *
 * - **Aplicar `slugify` en el constructor** reescribe el valor en silencio, o
 *   sea que la ficha queda servida en una URL distinta de la que su documento
 *   dice. Eso es la trampa 10 con un disfraz: el listado linkea a un lado y el
 *   `getStaticPaths` genera el otro.
 * - **Tirar**, como hace `rutaCanonica` con una URL absoluta, es lo correcto
 *   cuando el error es de quien llama; acá el valor puede venir de un documento
 *   que cargó un anónimo, así que un solo documento mal formado se llevaría
 *   puesto el build **entero**.
 *
 * Queda entonces la tercera: quien genera las páginas filtra con esto y deja
 * afuera la ficha rara, que es el comportamiento de `esSlugGuardable` y el que
 * no publica nada raro ni apaga el sitio.
 */
export const esSlugDeFicha = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valor) && valor.length <= 120;

/**
 * Las fichas de cada directorio: `/guia/librerias/del-otro-lado/`.
 *
 * Van con su listado y no en el bloque de «páginas generadas» de más abajo a
 * propósito: lo que las hace una familia es el prefijo, y separarlas sería volver
 * a escribir `/guia/librerias` en otro lugar del archivo. El segmento es el
 * **slug** de la ficha y no su id ni su nombre, por lo mismo que en los hubs: el
 * nombre se corrige y una URL no (trampa 10).
 *
 * **Interpolan sin sanear, a propósito**: la verificación es `esSlugDeFicha`, de
 * arriba, y le toca a quien produce las páginas —ahí se puede descartar la ficha
 * sin tirar el build—. Ver el docblock de ese predicado.
 */
export const rutaDeLibreria = (slug: string): string =>
  rutaCanonica(`${PREFIJO_LIBRERIAS}/${slug}`);
export const rutaDeSuscripcion = (slug: string): string =>
  rutaCanonica(`${PREFIJO_SUSCRIPCIONES}/${slug}`);
export const rutaDeLugar = (slug: string): string => rutaCanonica(`${PREFIJO_LUGARES}/${slug}`);

/**
 * `/apoyar/` — la página de aportes, B-780.
 *
 * **Se llama `/apoyar` y no `/donar` ni `/colaborar`**, y los tres se pensaron:
 *
 * - **`/donar`** reduce la página a la plata, y la mitad de lo que ofrece no es
 *   plata: mandar una actividad que falta o pasarle el link a alguien sostienen
 *   la agenda igual. Además «donar» pone al visitante frente a una causa, y esto
 *   no es una causa.
 * - **`/colaborar`** en este circuito quiere decir *colaborar con el contenido*
 *   —mandar un texto, sugerir una actividad—, que es exactamente lo que hace
 *   `/contacto`. Dos páginas que suenan a lo mismo y contestan cosas distintas
 *   es la peor de las tres.
 * - **`/apoyar`** es el verbo de quien entra: apoyar la agenda. Cubre las dos
 *   formas y no promete nada que la página no tenga.
 *
 * Y no se renombra después de publicar, como cualquier ruta (trampa 10).
 */
export const RUTA_APOYAR = rutaCanonica('/apoyar');

/**
 * El archivo: `/pasadas/` — B-109, §4.5 del diseño.
 *
 * Vive acá y no como literal en cada llamador porque tiene **tres** consumidores
 * el día uno: el pie del sitio, el aviso de la página de un mes vencido
 * (`mesPublico.ts`, que hasta B-109 mandaba a la home porque esta página no
 * existía) y el sitemap. Es la misma regla que hizo nacer este módulo.
 */
export const RUTA_PASADAS = rutaCanonica('/pasadas');

/**
 * La sección comercial: `/anunciar/` — B-770.
 *
 * **`/anunciar` y no `/publicidad`**, y es una decisión (D-450): el sitio nombra
 * sus páginas por lo que la persona va a hacer —`/suscribirse`, `/contacto`,
 * `/anunciar`— y no por el nombre de la industria. «Publicidad» además es la
 * consulta de quien busca cómo funciona la publicidad, no de quien quiere poner
 * un aviso en esta agenda.
 *
 * Tiene dos consumidores el día uno, que es lo que hace nacer una constante acá:
 * el pie del sitio y el sitemap.
 */
export const RUTA_ANUNCIAR = rutaCanonica('/anunciar');

/**
 * Lo que cada persona guardó: `/mis-favoritos/` — B-848.
 *
 * **Es la única ruta de este módulo que no se le ofrece al buscador**, y no por
 * olvido: su contenido sale del `localStorage` de quien la abre, así que para
 * Googlebot —que llega sin nada guardado— está siempre vacía, y una página vacía
 * indexada es peor que ninguna. Va con `noIndex` y **fuera de `RUTAS_FIJAS`**;
 * la excepción está anotada con su motivo en `tests/sitemap.test.ts`, que es el
 * que no deja que una página estática quede fuera del sitemap sin que alguien lo
 * decida.
 *
 * Lo que **no** lleva es un `Disallow` en el `robots.txt`, y es a propósito: un
 * `Disallow` impide leer el `noindex` (ver el docblock de `textoDeRobots`), así
 * que la señal que queremos que Google lea tiene que poder leerla.
 *
 * Tres consumidores el día uno, que es lo que hace nacer una constante acá: el
 * pie del sitio, la nota del botón de favorito de la página de detalle, y el
 * aviso de «búsqueda guardada» del listado.
 */
export const RUTA_MIS_FAVORITOS = rutaCanonica('/mis-favoritos');

// ─────────────────────────────────────────────────────────────────
// Las páginas generadas
// ─────────────────────────────────────────────────────────────────

/** El prefijo de la ruta de una actividad. Astro lo deriva del nombre del archivo. */
export const PREFIJO_ACTIVIDAD = '/actividad';

/**
 * La ruta **relativa** de la página de una actividad: `/actividad/{slug}/`.
 *
 * Relativa, y la absoluta se arma con `urlAbsoluta` — que es la que necesitan el
 * canonical, el Open Graph y el sitemap (B-109). Sigue habiendo **un solo lugar**
 * donde el path se escribe, y ahora también uno donde se escribe el origen.
 */
export const rutaDeDetalle = (slug: string): string =>
  rutaCanonica(`${PREFIJO_ACTIVIDAD}/${slug}`);

/** El prefijo de la ruta de una página de mes — B-113, §2.2 del diseño. */
export const PREFIJO_MES = '/agenda';

/**
 * La ruta **relativa** de la página de un mes: `/agenda/2026-09/`.
 *
 * El segmento es la **clave** del mes (`aaaa-mm`) y no el nombre: es ordenable
 * como texto, no depende del idioma y no se renombra. El mismo criterio que hace
 * que los hubs vayan por slug de taxonomía y no por label (§2.1).
 */
export const rutaDeMes = (clave: string): string => rutaCanonica(`${PREFIJO_MES}/${clave}`);

/**
 * Los prefijos de los hubs de taxonomía — B-108, §2.1 del diseño.
 *
 * **El segmento es el `slug` de la taxonomía, nunca el label.** El label se
 * renombra (§4.1: renombrar «Con Beca Parcial» a «Con beca parcial» no toca
 * ningún documento) y una URL no (trampa 10). Es la misma razón por la que la
 * página de mes va por clave `aaaa-mm` y no por «Septiembre».
 */
export const PREFIJO_TIPO = '/tipo';
export const PREFIJO_BARRIO = '/barrio';

/** `/tipo/club-lectura/` — el hub de un tipo de actividad. */
export const rutaDeTipo = (slug: string): string => rutaCanonica(`${PREFIJO_TIPO}/${slug}`);

/** `/barrio/villa-crespo/` — el hub de un barrio. */
export const rutaDeBarrio = (slug: string): string => rutaCanonica(`${PREFIJO_BARRIO}/${slug}`);

/**
 * Los dos hubs temáticos: `/online/` y `/gratis/` — B-108.
 *
 * No salen de ninguna taxonomía: juntan varios slugs a propósito («virtual» +
 * «híbrido», «gratis» + «a la gorra») porque para quien busca caen del mismo
 * lado. Por eso son dos páginas escritas y no dos rutas generadas, y por eso
 * están en `RUTAS_FIJAS`.
 */
export const RUTA_ONLINE = rutaCanonica('/online');
export const RUTA_GRATIS = rutaCanonica('/gratis');

// ─────────────────────────────────────────────────────────────────
// Las URLs absolutas
// ─────────────────────────────────────────────────────────────────

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
