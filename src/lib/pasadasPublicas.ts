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
import { coincideBusqueda, estadoDe } from '@/lib/listadoPublico';

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

/**
 * **La búsqueda del archivo** — B-292, §4.5: «sin filtros salvo la búsqueda».
 *
 * ── Por qué no se puede usar `filtrarPublico` ─────────────────────────────
 * Porque su eje «Cuándo» arranca en «Próximas», que por definición deja afuera
 * todo lo que esta página muestra: pasarle `filtrosVacios()` con un `q` devuelve
 * cero resultados siempre. El archivo **no filtra**, busca — es la única
 * dimensión que el §4.5 le da.
 *
 * ── Y por qué eso no es una segunda búsqueda ──────────────────────────────
 * El match es `coincideBusqueda` (`lib/listadoPublico.ts`), **la misma función**
 * que usa `filtrarPublico` para la home, los hubs y las páginas de mes. Lo que
 * esta función agrega es el conjunto sobre el que corre, no cómo se compara: dos
 * definiciones de «coincide» serían la home y el archivo contestando distinto a
 * la misma consulta, en lo único que la gente usa tipeando (la clase de B-88).
 *
 * ── El orden no se toca ───────────────────────────────────────────────────
 * Sale de `pasadasDelSitio` y se conserva: buscar acota, no reordena. Que el
 * resultado de una búsqueda salga de lo más reciente a lo más viejo es lo mismo
 * que dice la página sin buscar, y reordenar por «relevancia» sería inventar un
 * criterio que nada respalda.
 */
export const buscarEnPasadas = (
  pasadas: readonly EntradaDeIndice[],
  q: string,
): EntradaDeIndice[] => pasadas.filter(coincideBusqueda(q));

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

/**
 * **Las cuatro frases de la página, armadas a partir de las entradas.**
 *
 * ── Por qué recibe las entradas si ninguna frase las usa ──────────────────
 * Justamente por eso. Que la función que arma el texto **tenga los datos a mano
 * y no los use** es lo que convierte «acá no se interpola nada» en algo que un
 * test puede sostener: `tests/barrido-de-salidas-publicas.test.ts` barre esta
 * salida con la lista de permitidos **vacía**, y el barrido corre sobre el
 * fixture de centinelas. El día que alguien meta un título en la
 * `meta description` —que es lo que hace la página de mes, y por eso su barrido
 * los permite— el barrido lo dice sin que haya que tocar el test.
 *
 * Con las frases sueltas y sin este punto de entrada, ese cambio se haría
 * agregándole un parámetro a `descripcionDePasadas`, y el barrido no vería nada
 * porque seguiría llamándola sin datos.
 *
 * Es además el mismo corte que `mesPublico.ts`, donde las tres frases reciben la
 * `PaginaDeMes` entera: la plantilla no arma texto, lo pide.
 */
export interface FrasesDePasadas {
  titulo: string;
  bajada: string;
  descripcion: string;
  /** Qué se muestra cuando la lista está vacía. */
  vacio: string;
  /** El rótulo del buscador del archivo — B-292. */
  buscar: string;
  /** La pista de qué se puede tipear. */
  pista: string;
  /** Qué se dice cuando la búsqueda no encontró nada. */
  sinResultados: string;
  /** Y qué se dice mientras el índice no llegó, o si no llega. */
  cargando: string;
  error: string;
}

export const frasesDePasadas = (pasadas: readonly EntradaDeIndice[]): FrasesDePasadas => ({
  titulo: TITULO_DE_PASADAS,
  bajada: BAJADA_DE_PASADAS,
  descripcion: descripcionDePasadas(pasadas.length),
  vacio: VACIO_DE_PASADAS,
  buscar: BUSCAR_EN_PASADAS,
  pista: PISTA_DE_PASADAS,
  sinResultados: SIN_RESULTADOS_EN_PASADAS,
  cargando: CARGANDO_PASADAS,
  error: ERROR_DE_PASADAS,
});

// ─────────────────────────────────────────────────────────────────
// Las frases del buscador — B-292
// ─────────────────────────────────────────────────────────────────

/**
 * El rótulo del campo, y **dice «en el archivo»** a propósito.
 *
 * Es la mitad que evita el malentendido caro de esta página: quien tipea acá está
 * buscando entre lo que **ya pasó**, no en la agenda. Un «Buscar» a secas invita a
 * escribir el taller al que se quiere ir y a leer «no encontramos nada» como que
 * ese taller no existe.
 */
export const BUSCAR_EN_PASADAS = 'Buscar en el archivo';

/** Qué se puede tipear: los mismos campos que arma el `searchText` del §6. */
export const PISTA_DE_PASADAS = 'Título, barrio, tallerista…';

/**
 * Cero resultados, **sin repetir lo que se tipeó**.
 *
 * Echar de vuelta la consulta —«no encontramos nada para *cronica*»— es la forma
 * habitual y acá no aporta: el texto sigue en el campo, a la vista, dos
 * centímetros más arriba. Y deja esta salida sin ninguna interpolación, que es la
 * propiedad que su barrido de centinelas afirma con la lista de permitidos vacía.
 */
export const SIN_RESULTADOS_EN_PASADAS =
  'No encontramos nada con esas palabras. Probá con menos, o con el nombre de quien lo organizó.';

/**
 * El estado de carga, y el de fallo.
 *
 * El fallo importa más de lo que parece: si el índice no llega, **la lista del
 * build sigue en la página** —igual que en la home (§6.3)— así que lo único que
 * se pierde es el buscador. El aviso lo dice, en vez de dejar un campo que no
 * hace nada.
 */
export const CARGANDO_PASADAS = 'Cargando el buscador…';
export const ERROR_DE_PASADAS =
  'No pudimos cargar el buscador. El archivo completo sigue abajo; probá recargar la página.';

/**
 * El contador de arriba de la lista: «38 actividades» o «12 de 38».
 *
 * ── Por qué es una función y no una de las frases de arriba ───────────────
 * Porque depende de dos números que cambian con cada tecla, así que no puede ser
 * una constante. Lo que **no** cambia es dónde vive: acá, y no armado en la
 * island con un template. Si el texto se armara en el componente, ese texto
 * quedaría fuera del barrido de centinelas de esta salida —que corre sobre lo que
 * devuelven estas funciones— y la frase siguiente se escribiría donde ya hay
 * una. Es el mismo hallazgo que el `auditor-privacidad` hizo sobre la página
 * `/404` en este mismo cambio.
 *
 * **Y no reusa `descripcionDePasadas`**, que es la `meta description`: esa es una
 * frase de catálogo para el buscador («… talleres, clubes de lectura, encuentros
 * y presentaciones. Muchas se repiten.») y como rótulo de un contador sería una
 * parrafada arriba de la lista. Son dos textos con dos trabajos distintos y el
 * mismo número adentro.
 *
 * Va en un `aria-live`, así que es lo que escucha quien no ve la lista cambiar:
 * por eso dice **la unidad** («actividades») y no un número pelado.
 */
export const cuentaDePasadas = (mostradas: number, total: number): string =>
  mostradas === total ? cuantas(total) : `${mostradas} de ${cuantas(total)}`;
