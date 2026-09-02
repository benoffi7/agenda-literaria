/**
 * `/pasadas` — el archivo. B-109, §4.5 del diseño.
 *
 * ── Por qué esta página entra en B-109 y no en B-108 ──────────────────────
 * Porque su razón de ser es de **indexación** y no de navegación (§2.1):
 *
 * > «no es para el buscador: es para que **ninguna página de detalle quede
 * > huérfana**. Una actividad que pasó sale del listado y de los hubs; si nada la
 * > enlaza, su única entrada es el sitemap, y una página sin links internos vale
 * > casi nada.»
 *
 * Y desde este mismo cambio hay una segunda mitad de la misma moneda: la entrada
 * del sitemap de una pasada **se acaba a los 90 días** (`lib/sitemap.ts`), así que
 * a partir de ese día `/pasadas` es *el único* camino interno hacia esa página.
 * Sin esta página, a los tres meses cada actividad que pasó queda sin un solo
 * link que la apunte.
 *
 * ── La regla, y su invariante ─────────────────────────────────────────────
 * Entra **todo lo publicado que ya pasó**, y para siempre (§7.1: «Aparece en
 * `/pasadas` para siempre»). «Pasó» es la misma definición que usa el resto del
 * sitio —ninguna sesión no cancelada por venir— y no se reescribe acá: sale de
 * `estadoDe`, que es lo que decide el filtro «Cuándo» de la home.
 *
 * De ahí sale el invariante que fija `tests/pasadas.test.ts`: **la home y
 * `/pasadas` parten en dos exactamente el conjunto de las publicadas**. Ninguna
 * actividad puede estar en las dos y ninguna puede faltar en las dos — y la
 * segunda mitad es la que importa, porque una actividad publicada sin ninguna
 * página que la enlace es una página huérfana, que es justo lo que esta página
 * viene a evitar.
 *
 * **Las canceladas no entran** (§7.3): no es algo a lo que se pueda ir, y este
 * módulo no las puede ver ni queriendo — recibe `EntradaDeIndice[]`, o sea el
 * índice, y las canceladas nunca entran ahí (B-110).
 *
 * ── Cero lecturas nuevas y cero JavaScript ────────────────────────────────
 * Es puro: recibe las entradas del índice ya leído y `ahora`. Y la página no
 * monta ninguna island — el buscador vive en la home (ver la nota de abajo).
 *
 * ── Es una salida pública (la 10) ─────────────────────────────────────────
 * Hereda de la 1 por el mismo mecanismo que la página de mes: su entrada es
 * `EntradaDeIndice`, la proyección más angosta del repo, así que **solo puede
 * sacar**. Lo nuevo son las tres frases de acá abajo, y ninguna interpola datos
 * de una actividad — a diferencia de `descripcionDelMes`, que mete tres títulos
 * en la `meta description`. Ver `docs/07-seguridad.md`.
 */
import type { EntradaDeIndice } from '@/lib/eventsJson';
import { estadoDe } from '@/lib/listadoPublico';

/**
 * Lo que ya pasó, **de lo más reciente a lo más antiguo**.
 *
 * El orden es al revés que en la home y es la decisión de la página: en una
 * agenda lo próximo va primero; en un archivo, lo último que pasó. Quien entra
 * quiere ver «qué hubo hace poco» —para seguir a quien lo organiza y no perderse
 * la próxima vuelta, que es literalmente lo que dice la cabecera del §4.5— y no
 * el taller de hace dos años.
 *
 * Se ordena por `hasta` (la última fecha no cancelada) porque es el dato que dice
 * *cuándo terminó*, que es lo que el mes de esta página significa. `agruparPorMes`
 * agrupa por `proxima ?? hasta`, y en una pasada `proxima` es siempre `null`: los
 * grupos salen entonces en este mismo orden, de septiembre hacia atrás.
 *
 * Sin `hasta` —una actividad con todos sus encuentros cancelados (B-254)— va al
 * fondo: no hay fecha con la que ubicarla en el archivo, y adivinarle una la
 * pondría en un mes que no le corresponde.
 */
export const pasadasDelSitio = (
  entradas: readonly EntradaDeIndice[],
  ahora: Date,
): EntradaDeIndice[] =>
  entradas
    .filter((e) => estadoDe(e, ahora).paso)
    .map((e) => ({ entrada: e, hasta: estadoDe(e, ahora).hasta }))
    .sort((a, b) => (b.hasta?.getTime() ?? -Infinity) - (a.hasta?.getTime() ?? -Infinity))
    .map((x) => x.entrada);

/** Cuántas actividades, dicho bien en singular y en plural. */
const cuantas = (n: number): string => `${n} ${n === 1 ? 'actividad' : 'actividades'}`;

/** El `<h1>` y la primera mitad del `<title>`. */
export const TITULO_DE_PASADAS = 'Lo que ya pasó';

/**
 * La cabecera del §4.5, **palabra por palabra**.
 *
 * > «Lo que ya pasó. Muchas de estas actividades se repiten: si te interesa una,
 * > seguí a quien la organiza.»
 *
 * Es la frase que convierte un archivo en algo útil: casi todo el circuito
 * literario es cíclico —un taller que se dio en marzo se vuelve a dar—, así que
 * la respuesta correcta a «llegué tarde» no es un cartel de error sino a quién
 * seguir. Va como constante y no escrita en el markup por lo de siempre: un
 * `.astro` no se puede importar desde vitest, así que una frase escrita ahí no la
 * verifica nadie.
 */
export const BAJADA_DE_PASADAS =
  'Muchas de estas actividades se repiten: si te interesa una, seguí a quien la organiza.';

/** Qué se ofrece cuando el archivo todavía está vacío. */
export const VACIO_DE_PASADAS =
  'Todavía no hay nada en el archivo: no pasó ninguna de las actividades publicadas.';

/**
 * La `meta description` (§5.1).
 *
 * Lleva **la cuenta y nada más**: ni un título de actividad. No es timidez, es
 * que acá no aportarían —los títulos de lo que ya pasó no son la consulta que
 * trae a nadie a esta página, que se indexa para que las páginas de detalle
 * tengan un link permanente, no para competir por una búsqueda—. Y de paso deja
 * esta salida sin ninguna interpolación de datos de actividad, que es la clase de
 * riesgo que el §5 vigila.
 */
export const descripcionDePasadas = (cuantasPasaron: number): string =>
  cuantasPasaron === 0
    ? 'El archivo de actividades literarias de la agenda: talleres, clubes de lectura, encuentros y presentaciones que ya pasaron.'
    : `${cuantas(cuantasPasaron)} literarias que ya pasaron: talleres, clubes de lectura, ` +
      'encuentros y presentaciones. Muchas se repiten.';
