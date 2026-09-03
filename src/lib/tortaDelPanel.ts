import { colorDeTipo } from '@/lib/identidad';
import type { Tajada } from '@/lib/estadoDelCatalogo';

/**
 * La torta del tablero, dibujada a mano — B-700, D-401.
 *
 * ── Por qué a mano ────────────────────────────────────────────────────────
 * Porque el bundle del panel tiene un corte que se sostiene sobre el grafo de
 * imports (B-09, `tests/bundle-panel.test.ts`) y una librería de gráficos son
 * 50-200 KB para dibujar cinco cuñas. Una cuña es un `path` de SVG con dos
 * puntos y un arco: la aritmética entera son las veinte líneas de `arcosDeTorta`,
 * y a cambio son testeables — que es lo que ninguna librería da.
 *
 * Es el mismo precedente que la flecha del `select`, que es un triángulo de tres
 * bordes y no un paquete de iconos.
 *
 * ── La regla que hace honesta a una torta (D-401) ─────────────────────────
 * **El todo de la torta es la suma de sus tajadas, nunca «la cantidad de
 * actividades».** Suena obvio y es justo lo que se rompe: el reparto por forma
 * de cursar cuenta cada actividad en **cada** forma que ofrece (B-224), así que
 * 40 actividades dan 47 tajadas y una torta sobre 40 dibujaría 117 % de
 * circunferencia. Acá la referencia sale siempre de `sumaDeTajadas`, y quien
 * pinta tiene que decir en palabras qué es ese todo («47 formas ofrecidas», no
 * «40 actividades»).
 *
 * De ahí que `arcosDeTorta` no reciba ningún total: no hay forma de pasarle uno
 * equivocado.
 *
 * ── Y la que la hace legible ──────────────────────────────────────────────
 * Con muchas categorías —el caso real es el barrio— una torta de veinte cuñas no
 * se lee: `agruparCola` deja las primeras y junta la cola en «el resto». La
 * agrupación **conserva la suma**, así que la torta sigue cerrando en 360°.
 *
 * ── Lo que la torta NO resuelve, y por eso existe la lista ────────────────
 * Un `<svg>` de cuñas no lo lee un lector de pantalla, y dos barrios con matices
 * derivados de slugs parecidos pueden caer a pocos grados uno del otro. La vista
 * de lista no es un modo degradado: es la alternativa accesible, con el número y
 * el porcentaje escritos. El toggle resuelve las dos cosas de una
 * (`vistaDeGrafico.ts`).
 */

/**
 * Cuántas tajadas se dibujan antes de juntar la cola.
 *
 * Cinco y no diez: a partir de la sexta cuña, la etiqueta ya no entra al lado y
 * el ojo deja de comparar áreas. Es el mismo criterio del tope de cuatro
 * columnas de D-330 — el límite lo pone lo que se lee de un barrido, no lo que
 * entra.
 */
export const TOPE_DE_TORTA = 5;

/**
 * El slug de la tajada que junta la cola.
 *
 * Lleva guiones bajos a los costados a propósito: `slugify` nunca los produce
 * (baja todo a `[a-z0-9-]`), así que no puede chocar con un barrio, un arancel
 * ni un tipo real. Es la misma guarda que usa cualquier centinela de este repo.
 */
export const SLUG_RESTO = '__resto__';

/** Una tajada que, además, sabe **cuántas** tajadas originales representa. */
export interface TajadaAgrupada extends Tajada {
  /** `1` para una tajada normal; `n` para «el resto», que junta n categorías. */
  agrupa: number;
}

/** Una cuña lista para el `<path>`: el `d`, su color y de qué es. */
export interface Arco extends TajadaAgrupada {
  /** El atributo `d` del `<path>`. */
  d: string;
  /** El color de relleno, ya resuelto. */
  color: string;
  /** Grados de arranque y de fin, para poder afirmar que la torta cierra. */
  desde: number;
  hasta: number;
}

/** El todo de la torta: la suma de lo que dibuja, no un total de afuera. */
export const sumaDeTajadas = (tajadas: Tajada[]): number =>
  tajadas.reduce((suma, t) => suma + t.cantidad, 0);

/**
 * El porcentaje **como se escribe**, no como número.
 *
 * `'<1 %'` y no `'0 %'` para una tajada que existe: redondear a cero una
 * categoría que tiene actividades adentro es afirmar que no tiene ninguna, y en
 * un catálogo de 200 actividades con un barrio de 1 eso pasa siempre. Es la
 * misma familia que el «sin comparación todavía» ≠ «0 %» de la pestaña del sitio.
 */
export const porcentajeLegible = (parte: number, total: number): string => {
  if (total <= 0 || parte <= 0) return '0 %';
  const exacto = (parte / total) * 100;
  if (exacto < 1) return '<1 %';
  return `${Math.round(exacto)} %`;
};

/**
 * Deja las `tope` primeras tajadas y junta la cola en una sola.
 *
 * **Solo agrupa si la cola tiene al menos dos**: con `tope + 1` categorías,
 * juntar la última en «el resto» le esconde el nombre sin ganar ni una cuña de
 * legibilidad. El caso de borde importa porque es el más frecuente — un catálogo
 * chico tiene seis barrios, no veinte.
 *
 * La suma se conserva: es lo que deja la torta cerrando en 360° (D-401).
 *
 * ── Ordena por cantidad, y no da por sentado que ya venga ordenado ────────
 * La primera versión decía «espera las tajadas ya ordenadas por cantidad, que es
 * como las devuelve `estadoDelCatalogo`» — y era **falso para la mitad de los
 * repartos**: `repartirFijo` (el de `porEstado` y `porModalidad`) devuelve el
 * vocabulario **en su orden**, no por magnitud. Hoy no se nota porque `ESTADOS`
 * tiene cuatro valores y el corte recién actúa a partir de siete, así que la
 * precondición nunca se ejerce; el día que existan un quinto y un sexto estado,
 * «el resto» juntaría **lo último del vocabulario** en vez de lo más chico, la
 * torta seguiría cerrando en 360° y nadie se enteraría. Lo encontró el
 * `auditor-trampas`, y es el patrón exacto de «precondición documentada pero no
 * verificada».
 *
 * Así que ordena acá, con el **mismo criterio y el mismo desempate** que
 * `repartir`: cantidad descendente, alfabético para desempatar. El desempate no
 * es cosmético — sin él, dos categorías con la misma cantidad quedan en el orden
 * en que llegaron y la torta se reordena sola entre dos recargas.
 *
 * **No toca la lista que recibe**: la vista de lista sigue mostrando el orden que
 * su reparto eligió, que para `porEstado` es el del vocabulario a propósito.
 */
export const agruparCola = (tajadas: Tajada[], tope: number = TOPE_DE_TORTA): TajadaAgrupada[] => {
  const porCantidad = [...tajadas].sort(
    (a, b) => b.cantidad - a.cantidad || a.valor.localeCompare(b.valor, 'es'),
  );
  if (porCantidad.length <= tope + 1) return porCantidad.map((t) => ({ ...t, agrupa: 1 }));
  const cabeza = porCantidad.slice(0, tope).map((t) => ({ ...t, agrupa: 1 }));
  const cola = porCantidad.slice(tope);
  return [
    ...cabeza,
    { valor: SLUG_RESTO, cantidad: sumaDeTajadas(cola), agrupa: cola.length },
  ];
};

/**
 * El color de una tajada.
 *
 * Sale de `colorDeTipo` (D-150) para **todos** los repartos y no solo para el de
 * tipo: es la función que el sitio público usa para pintar una categoría, ya
 * tiene su piso de contraste recorrido entero en `tests/color-de-tipo.test.ts`, y
 * derivar el matiz del slug hace que el mismo valor se vea igual en las dos
 * puntas. Inventar una paleta de ocho colores para el tablero sería una segunda
 * identidad para las mismas categorías.
 *
 * «El resto» es la excepción y va con una tinta **con nombre** (`--color-super`,
 * la de superposición): no es una categoría, es la ausencia de una, y darle un
 * matiz derivado la haría parecer una más.
 */
export const colorDeTajada = (valor: string, tonos: Record<string, number> = {}): string =>
  valor === SLUG_RESTO ? 'var(--color-super)' : colorDeTipo(valor, tonos[valor]);

// ── La aritmética del arco ─────────────────────────────────────────

/** El lienzo es un cuadrado de 100×100 con la torta inscripta. */
const CENTRO = 50;
const RADIO = 50;

/** Dos decimales alcanzan a esta escala y dejan el `d` legible en un test. */
const redondear = (n: number): number => Math.round(n * 100) / 100;

/**
 * Un punto del borde, con `0°` **arriba** y girando en el sentido del reloj.
 *
 * El `-90` es lo que pone el arranque a las 12 y no a las 3, que es donde lo
 * pone la trigonometría sola. Se lee mal como número mágico y se lee peor si
 * cada llamador lo repite.
 */
const punto = (grados: number): [number, number] => {
  const rad = ((grados - 90) * Math.PI) / 180;
  return [redondear(CENTRO + RADIO * Math.cos(rad)), redondear(CENTRO + RADIO * Math.sin(rad))];
};

/**
 * El `d` de la circunferencia entera, para la torta de **una sola** tajada.
 *
 * Es el caso que rompe la fórmula general y el que más se da en un catálogo
 * chico (todas las actividades del mismo tipo): con `desde === 0` y
 * `hasta === 360` los dos extremos del arco son el mismo punto, y un arco de un
 * punto a sí mismo no dibuja **nada** — la torta desaparecería en vez de
 * llenarse. Se resuelve con dos medias vueltas.
 */
const CIRCUNFERENCIA = `M ${CENTRO} ${CENTRO - RADIO} A ${RADIO} ${RADIO} 0 1 1 ${CENTRO} ${
  CENTRO + RADIO
} A ${RADIO} ${RADIO} 0 1 1 ${CENTRO} ${CENTRO - RADIO} Z`;

/** El `d` de una cuña entre dos ángulos. */
const cunia = (desde: number, hasta: number): string => {
  if (hasta - desde >= 360) return CIRCUNFERENCIA;
  const [x0, y0] = punto(desde);
  const [x1, y1] = punto(hasta);
  // El flag de arco grande: sin él, una cuña de más de media torta se dibuja
  // por el lado corto y sale el complemento en vez de la tajada.
  const arcoGrande = hasta - desde > 180 ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${x0} ${y0} A ${RADIO} ${RADIO} 0 ${arcoGrande} 1 ${x1} ${y1} Z`;
};

/**
 * Las cuñas de la torta, en el orden en que llegan las tajadas.
 *
 * **No recibe ningún total** (D-401): el todo es la suma de las tajadas y no
 * puede venir de afuera equivocado. Con suma cero devuelve la lista vacía —un
 * catálogo sin nada dibuja nada, no una torta rota.
 *
 * Las tajadas de cantidad cero se descartan: una cuña de 0° no se ve y ensucia
 * el DOM con un `path` por cada categoría vacía del vocabulario.
 */
export const arcosDeTorta = (
  tajadas: TajadaAgrupada[],
  tonos: Record<string, number> = {},
): Arco[] => {
  const conAlgo = tajadas.filter((t) => t.cantidad > 0);
  const total = sumaDeTajadas(conAlgo);
  if (total <= 0) return [];
  const arcos: Arco[] = [];
  let desde = 0;
  conAlgo.forEach((t, i) => {
    /*
     * La última cuña cierra en 360 **exactos** en vez de acumular su fracción:
     * con tres tercios, el redondeo del punto flotante deja 359,999… y queda
     * una rendija de fondo entre la última cuña y la primera. Es cosmético en
     * pantalla y no en el test, que es donde se afirma que la torta cierra.
     */
    const hasta = i === conAlgo.length - 1 ? 360 : desde + (t.cantidad / total) * 360;
    arcos.push({
      ...t,
      desde: redondear(desde),
      hasta: redondear(hasta),
      d: cunia(desde, hasta),
      color: colorDeTajada(t.valor, tonos),
    });
    desde = hasta;
  });
  return arcos;
};
