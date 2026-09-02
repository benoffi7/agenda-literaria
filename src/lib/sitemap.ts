/**
 * `sitemap.xml` y `robots.txt` — B-109, §5.6 del diseño.
 *
 * ── Por qué a mano y no con `@astrojs/sitemap` ────────────────────────────
 * Porque las reglas de qué entra son **nuestras** y no se expresan en la
 * configuración de un integrador:
 *
 * | Regla | Dónde vive |
 * |---|---|
 * | 90 días para las pasadas, contados desde la última fecha | `DIAS_DE_PASADA` |
 * | 30 días para las canceladas, contados desde la última edición | `DIAS_DE_CANCELADA` |
 * | solo meses con 3 o más actividades, y solo los que no vencieron | `mesesEnlazables` (`lib/mesPublico.ts`) |
 * | ni `/admin`, ni los endpoints de datos | `RUTAS_FIJAS`, que es una lista y no un barrido |
 *
 * Y una razón más de fondo: el integrador arma el sitemap **de lo que hay en
 * `dist/`**, y lo que hay en `dist/` incluye la página de la actividad de hace
 * dos años, la del mes vencido y la de la cancelada de marzo. Las tres tienen que
 * existir y **ninguna** tiene que estar en el sitemap. Son dos preguntas
 * distintas —«¿esta URL responde?» y «¿le pido a Google que la rastree?»— y
 * confundirlas es lo que llena el índice de páginas muertas.
 *
 * ── `lastmod` no va, y es una decisión ────────────────────────────────────
 * `<lastmod>` sale de `updatedAt`, que **no está en la proyección pública**
 * (§11.2 #3 del diseño, anotado como **B-112**). La alternativa disponible era
 * estampar la fecha del build en todas las entradas, y eso es peor que no poner
 * nada: le enseña a Google que nuestras fechas mienten —cada rebuild por una
 * coma en una actividad diría que las 40 cambiaron— y a partir de ahí deja de
 * mirarlas. Cuando exista B-112 se agrega, y va a ser una línea — **con la fecha
 * recortada al día** (`AAAA-MM-DD`), que es la precisión con la que sale
 * `creadoEn` y por el mismo motivo (D-138): con un solo admin, el instante exacto
 * de cada edición publicado en N entradas es su agenda de trabajo, no una fecha.
 * Lo dejó anotado el `auditor-privacidad` sobre este cambio, y está escrito en
 * B-112 para que la línea que falta no salga con el ISO completo.
 *
 * ── Cero lecturas nuevas de Firestore ─────────────────────────────────────
 * Este módulo es **puro**: recibe las entradas del índice, la lista de canceladas
 * y `ahora`, y devuelve rutas. La lectura la hizo `contenidoDelSitio()`, que está
 * memoizada — el sitemap es el quinto consumidor de la misma lectura (§3 del
 * diseño).
 *
 * ── Es una salida pública (la 9) ──────────────────────────────────────────
 * Y de las más chicas del repo: lo único que publica son **rutas**. Ni un título,
 * ni una descripción, ni una fecha — ver `docs/07-seguridad.md`. Lo que sí decide
 * es *qué páginas se le ofrecen al buscador*, y ahí el error caro es al revés del
 * habitual: no filtrar de más, sino ofrecer la URL de algo que no tendría que
 * estar en Google.
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { estadoDe } from '@/lib/listadoPublico';
import { hubsOfrecidos } from '@/lib/hubsPublicos';
import { mesesEnlazables } from '@/lib/mesPublico';
import {
  RUTA_AGENDA,
  RUTA_AYUDA,
  RUTA_CARTELERA,
  RUTA_CONTACTO,
  RUTA_GRATIS,
  RUTA_ONLINE,
  RUTA_PASADAS,
  RUTA_SUSCRIBIRSE,
  rutaDeDetalle,
  rutaDeMes,
  urlAbsoluta,
} from '@/lib/rutasPublicas';
import { instanteDeIso } from '@/lib/sesiones';

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * Cuánto vive en el sitemap una actividad que ya pasó, desde su última fecha.
 *
 * §7.1 del diseño: **la página no se borra nunca** —está linkeada de Instagram,
 * de un mail y de un grupo de WhatsApp (trampa 10)— y sigue apareciendo en
 * `/pasadas` para siempre. Lo único que se acaba a los 90 días es la entrada del
 * sitemap: pasado ese plazo, pedirle a Google que la rastree de nuevo es gastar
 * rastreo en algo que ya no cambia.
 */
export const DIAS_DE_PASADA = 90;

/**
 * Cuánto vive en el sitemap una cancelada, desde su última edición.
 *
 * §7.3: la página **tampoco se borra** —existe para quien tiene el link y para
 * que Google pueda tachar el resultado que ya indexó (`EventCancelled`)—, y lo
 * que sale a los 30 días es la entrada del sitemap. Es menos que los 90 de una
 * pasada porque una pasada sigue siendo la mejor respuesta a quien busca ese
 * taller por su nombre, y una cancelada no: no pasó nada que contar.
 */
export const DIAS_DE_CANCELADA = 30;

/**
 * Una cancelada, como el sitemap la necesita — B-109.
 *
 * ── `editadaEn` y el problema que resuelve ────────────────────────────────
 * El §7.3 dice «30 días **desde que se canceló**», y *cuándo se canceló* no es un
 * dato del modelo (igual que «estuvo publicada alguna vez», B-285). De las tres
 * fechas disponibles, el ítem B-109 ya eligió: **`updatedAt`**, con su error
 * dicho —cualquier corrección posterior corre el reloj hacia adelante, o sea que
 * la URL se queda un poco más de tiempo en el sitemap, que es el lado inofensivo
 * del error— y sin ir al historial, que costaría una lectura por cancelada.
 *
 * ── Y `updatedAt` no está en la proyección, así que no pasa por ella ──────
 * `toPublic` no lo proyecta a propósito (ver su docblock: publicar una fecha de
 * modificación convierte cada corrección de un typo en «actualizado hoy»), y
 * B-109 **no lo agrega**. El que ve el documento crudo es el lector
 * (`contenidoDelSitio.ts`), que es también el único que sabe de cuál de sus dos
 * queries salió cada actividad — el mismo patrón con el que B-110 resolvió
 * `cancelada`: el dato viaja **al lado** de la proyección, no adentro.
 *
 * Lo que hace que esto no agrande la superficie pública es que la fecha es un
 * **predicado y no un dato de salida**: decide si la URL entra al sitemap y no se
 * emite en ninguna parte. El sitemap no lleva `lastmod` (ver el encabezado), así
 * que `updatedAt` sigue sin salir a ninguna salida — que es lo que promete
 * `docs/07-seguridad.md`.
 */
export interface CanceladaDelSitemap {
  slug: string;
  /** El ISO de `updatedAt`, o `null` si el documento no lo tiene. */
  editadaEn: string | null;
}

/**
 * Las páginas escritas a mano que entran al sitemap.
 *
 * **Es una lista y no un barrido de `src/pages/`**, y esa es la decisión: qué
 * páginas se le ofrecen al buscador se decide una por una. Un barrido metería
 * `/admin` el día que alguien le saque el `noIndex`, y metería sola cualquier
 * página nueva —incluida una que no se quiera indexar— sin que nadie lo piense.
 *
 * `tests/sitemap.test.ts` la ata en las dos direcciones: cada ruta de acá tiene
 * que resolver a una página que existe (si no, se le ofrece un 404 al buscador) y
 * cada página estática del sitio tiene que estar acá **o** en la lista de
 * excepciones con su motivo.
 */
export const RUTAS_FIJAS: readonly string[] = [
  RUTA_AGENDA,
  RUTA_CARTELERA,
  RUTA_PASADAS,
  /*
   * Los dos hubs temáticos entran acá y no por `hubsOfrecidos` — B-108. Son
   * **secciones del sitio** y no valores de una taxonomía: «lo que se hace a
   * distancia» y «lo que no se paga» siempre quieren decir algo en una agenda
   * literaria, así que su vacío es un estado pasajero de los datos, igual que el
   * de `/pasadas` el día que se lanzó o el de `/cartelera` sin ningún flyer, que
   * están en esta lista y pueden estar vacías.
   *
   * Los de `/tipo/*` y `/barrio/*` son al revés: un `/barrio/x` sin nada vigente
   * es una página sobre un lugar donde no hay nada, y puede haber decenas. Ésos
   * entran solo si tienen algo (`hubsOfrecidos`) y si no, salen con `noindex`.
   * El razonamiento completo está en `lib/hubsPublicos.ts`.
   */
  RUTA_ONLINE,
  RUTA_GRATIS,
  RUTA_SUSCRIBIRSE,
  RUTA_AYUDA,
  RUTA_CONTACTO,
];

/** ¿Esta fecha está dentro de la ventana de `dias` contada desde `ahora`? */
const dentroDeVentana = (fecha: Date | null, ahora: Date, dias: number): boolean =>
  fecha !== null && ahora.getTime() - fecha.getTime() <= dias * UN_DIA;

/**
 * Las rutas de las actividades **publicadas** que entran al sitemap.
 *
 * La que todavía tiene fechas por venir entra siempre. La que ya pasó entra
 * mientras su última fecha esté dentro de los 90 días.
 *
 * **Sin ninguna fecha usable entra igual**, y es a propósito: una actividad con
 * todos sus encuentros cancelados (B-254) no tiene `hasta`, así que no hay reloj
 * contra el que medirla. Su página existe y está publicada; excluirla sería
 * decidir que es vieja sin ningún dato que lo diga. Es el mismo criterio del
 * error inofensivo que eligió `editadaEn`: ante la duda, la URL se queda.
 */
const rutasDePublicadas = (entradas: readonly EntradaDeIndice[], ahora: Date): string[] =>
  entradas
    .filter((e) => e.slug)
    .filter((e) => {
      const { paso, hasta } = estadoDe(e, ahora);
      if (!paso) return true;
      if (hasta === null) return true;
      return dentroDeVentana(hasta, ahora, DIAS_DE_PASADA);
    })
    .map((e) => rutaDeDetalle(e.slug));

/**
 * Las rutas de las **canceladas** que entran al sitemap: las editadas en los
 * últimos 30 días.
 *
 * Sin `editadaEn` **no entra**, y acá el default es al revés que en las
 * publicadas: una cancelada está en el sitemap solo mientras la cancelación sea
 * noticia, y sin fecha no se puede afirmar que lo sea. La página sigue
 * respondiendo igual — es lo único que se le prometió a quien tiene el link.
 */
const rutasDeCanceladas = (canceladas: readonly CanceladaDelSitemap[], ahora: Date): string[] =>
  canceladas
    .filter((c) => c.slug)
    .filter((c) => dentroDeVentana(instanteDeIso(c.editadaEn), ahora, DIAS_DE_CANCELADA))
    .map((c) => rutaDeDetalle(c.slug));

export interface EntradaDelSitio {
  entradas: readonly EntradaDeIndice[];
  canceladas: readonly CanceladaDelSitemap[];
  /**
   * Las opciones de taxonomía del índice, **para los hubs** — B-108.
   *
   * Las necesita `hubsOfrecidos` por dos motivos: para saber qué slugs existen y
   * en qué orden, y porque son las opciones **ya filtradas por aprobación** —
   * ofrecerle a Google la URL de un barrio que todavía es un typo sin revisar es
   * exactamente el error caro de esta salida (§4.3, y el argumento con el que el
   * §2.3 dejó afuera los hubs de tema).
   *
   * Es opcional para que un llamador que no le importan los hubs —un test de otra
   * regla— no tenga que armarlas, y el default es «ninguna», o sea ningún hub de
   * taxonomía en el sitemap. El lado inofensivo del error.
   */
  opciones?: Readonly<Record<string, readonly { slug: string }[]>>;
  ahora: Date;
}

/**
 * Todas las rutas del sitemap, en orden: las páginas fijas, los meses, las
 * actividades.
 *
 * El orden no le importa a ningún buscador y sí a quien lo abre para revisarlo:
 * primero lo que no cambia, después lo que se genera.
 *
 * **Los meses salen de `mesesEnlazables` y no de `mesesDelSitio`**: la segunda
 * incluye la del mes vencido, que se emite una última vez con `noindex`
 * justamente para que su URL no se rompa (§2.2). Ofrecerla en el sitemap y
 * pedirle a la vez que no la indexe es mandarle dos señales opuestas a Google.
 *
 * Sin duplicados: una actividad no puede estar dos veces —no puede ser publicada
 * y cancelada a la vez—, pero la garantía se afirma acá en vez de suponerse,
 * porque las dos listas vienen de dos queries distintas.
 */
export const rutasDelSitemap = ({
  entradas,
  canceladas,
  opciones = {},
  ahora,
}: EntradaDelSitio): string[] => [
  ...new Set([
    ...RUTAS_FIJAS,
    /*
     * **Los hubs de taxonomía: los que tienen algo vigente** — B-108. Los dos
     * temáticos ya están en `RUTAS_FIJAS`, así que acá entran solo `/tipo/*` y
     * `/barrio/*`; el `Set` de afuera cubriría el solapamiento igual.
     *
     * Sale de `hubsOfrecidos` y **no** de `hubsDelSitio`, que es la misma
     * distinción que `mesesEnlazables` contra `mesesDelSitio` una línea más
     * abajo: el build emite un hub vacío para que su URL no devuelva 404 (§4.4) y
     * lo emite con `noindex`. Ofrecerlo en el sitemap y pedirle a la vez que no
     * lo indexe es mandarle dos señales opuestas a Google.
     *
     * `etiquetas` va en `{}` a propósito: acá solo se necesitan las **rutas**, y
     * la ruta no depende de la etiqueta —depende del slug, que es lo único que no
     * se renombra (§2.1)—. Pasarle el mapa real armaría los títulos de ochenta
     * hubs para tirarlos.
     */
    ...hubsOfrecidos(entradas, opciones, {}, ahora)
      .filter((h) => h.clase === 'tipo' || h.clase === 'barrio')
      .map((h) => h.ruta),
    ...mesesEnlazables(entradas, ahora).map((m) => rutaDeMes(m.clave)),
    ...rutasDePublicadas(entradas, ahora),
    ...rutasDeCanceladas(canceladas, ahora),
  ]),
];

/**
 * Los cinco caracteres que hay que escapar en un XML.
 *
 * Hoy no puede hacer falta —una ruta se arma con un slug, y `slugify` deja
 * `[a-z0-9-]`— y va igual, por lo mismo que `esTonoElegible` valida lo que lee de
 * Firestore: un documento editado a mano en la consola puede tener un `slug` con
 * un `&`, y un `&` sin escapar **rompe el XML entero**, no una línea. Un sitemap
 * que no parsea es un sitemap que Google descarta completo, y eso no se ve
 * mirando el sitio.
 */
const escaparXml = (texto: string): string =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * El XML del sitemap, con las URLs **absolutas**.
 *
 * El protocolo de sitemaps las exige absolutas, y salen de `urlAbsoluta`: el
 * mismo origen y la misma barra final que la canónica de cada página. Si el
 * sitemap nombrara `/cartelera` y la canónica `/cartelera/`, Google recibiría dos
 * URLs para la misma página y el sitemap le apuntaría a la que redirige.
 *
 * Sin `<lastmod>`, sin `<changefreq>` y sin `<priority>`: los dos últimos Google
 * los ignora desde hace años y el primero necesita B-112.
 */
export const xmlDelSitemap = (rutas: readonly string[]): string => {
  const urls = rutas
    .map((r) => `  <url>\n    <loc>${escaparXml(urlAbsoluta(r))}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

/**
 * Lo que `/admin` tiene bloqueado, y por qué es un prefijo.
 *
 * `Disallow: /admin` es un **prefijo**, así que cubre `/admin`, `/admin/` y
 * cualquier ruta de la SPA que cuelgue de ahí (§9). No hay otra ruta del sitio
 * que empiece con esas letras, así que no hay nada que se bloquee sin querer.
 */
export const RUTA_BLOQUEADA = '/admin';

/**
 * El `robots.txt`.
 *
 * ── Las dos mitades de `/admin`, que no son la misma ──────────────────────
 * El panel ya sale con `<meta name="robots" content="noindex, nofollow">`
 * (`admin.astro`), y esto es la otra mitad. **No son redundantes y no dicen lo
 * mismo:**
 *
 * | Mitad | Qué consigue |
 * |---|---|
 * | `Disallow` acá | que ningún rastreo entre al panel: no se gasta rastreo ni se piden 40 archivos de un bundle que no le sirve a nadie |
 * | `noindex` en la página | que si alguien la enlaza igual, no se indexe |
 *
 * Y hay una trampa que conviene tener escrita: **un `Disallow` impide leer el
 * `noindex`**. Google puede indexar una URL bloqueada por `robots.txt` si alguien
 * la enlaza —la lista como «indexada aunque bloqueada», sin contenido— porque
 * nunca llegó a leer la etiqueta que le pedía no hacerlo. Se acepta a conciencia:
 * `/admin` no está enlazada desde ninguna página pública, no tiene contenido que
 * mostrar sin sesión, y lo que se gana —que un rastreador no baje el bundle del
 * panel— vale más que el caso hipotético. Si algún día apareciera en Search
 * Console como indexada, la respuesta es **sacar este `Disallow`** y dejar solo el
 * `noindex`, no agregar nada.
 *
 * ── Qué NO se bloquea ─────────────────────────────────────────────────────
 * `/events.json` y `/version.json` quedan abiertos. Bloquearlos no esconde nada
 * —son públicos y se sirven igual, y el primero es la base de la búsqueda del
 * §2.5— y una línea de `robots.txt` que no protege nada es una línea que hay que
 * mantener. Lo mismo con `/_astro/`: bloquear los assets impide que Google
 * renderice las páginas y ahí sí se pierde algo real.
 */
export const textoDeRobots = (): string =>
  [
    'User-agent: *',
    `Disallow: ${RUTA_BLOQUEADA}`,
    '',
    `Sitemap: ${urlAbsoluta('/sitemap.xml')}`,
    '',
  ].join('\n');
