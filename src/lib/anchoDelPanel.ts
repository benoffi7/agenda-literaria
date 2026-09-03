/**
 * Cuánto ancho ocupa cada pantalla del panel (B-621).
 *
 * ── El problema ───────────────────────────────────────────────────────────
 * El panel entero vivía dentro de un `max-w-3xl lg:max-w-4xl`, y ese número está
 * bien elegido **para un formulario**: una medida de lectura, porque una línea de
 * texto de 1400px no se lee y un campo de 1400px de ancho es peor. Pero el
 * chasis es uno solo, así que la misma medida le tocaba a las dos pantallas que
 * no son un formulario ni una lista de lectura:
 *
 * - el **calendario**, cuya vista de mes es una grilla de 7 columnas — a 896px
 *   cada día mide ~120px y no entra ni un título;
 * - el **tablero**, que son repartos y números que se comparan **al lado uno del
 *   otro**: apilados dejan de comparar nada, que es para lo que existen.
 *
 * ── Por qué una decisión por vista y no un ancho para todo ────────────────
 * Ensanchar el chasis entero arregla esas dos y rompe el formulario y el listado,
 * que es donde se pasa el 90% del tiempo. Y ensanchar «a ojo» dentro de cada
 * pantalla reparte el mismo problema en cinco archivos: la próxima pantalla nace
 * con el ancho que le toque según de dónde se copió.
 *
 * Así que el ancho es **una propiedad de la vista**, declarada en un solo lugar.
 * Entrar una vista nueva es agregarla a `VISTAS_A_TODO_ANCHO`.
 *
 * ── Y una advertencia, que es la mitad del ítem ───────────────────────────
 * **Entrar acá es una línea; repartir la pantalla es el trabajo real.** Una vista
 * ancha que no reparte su contenido no mejora: estira las mismas filas hasta que
 * el ojo tiene que viajar de una punta a la otra para leer un renglón. Antes de
 * agregar una vista a la lista hay que mirar qué hace con el espacio de más.
 */

/** La medida de lectura: formularios y listas. Es el default y no se declara. */
export const ANCHO_DE_LECTURA = 'max-w-3xl lg:max-w-4xl';

/**
 * La medida ancha. **Tiene tope**, y no es `w-full`: en un monitor de 27
 * pulgadas una grilla sin límite deja celdas enormes y vacías, y el ojo pierde la
 * fila. `max-w-7xl` (1280px) es donde la grilla de 7 días da celdas de ~176px,
 * que es lo que hace falta para que entre un título.
 *
 * Los escalones intermedios están para que el salto no ocurra de golpe en un
 * ancho intermedio, donde el contenido todavía no tiene con qué llenarlo.
 */
export const ANCHO_DE_TABLERO = 'max-w-3xl lg:max-w-5xl xl:max-w-7xl';

/**
 * Las vistas que se reparten a lo ancho. Las dos que el dueño pidió (B-621), y
 * las dos por el mismo motivo: **su contenido se compara en paralelo**, no se lee
 * en una columna.
 *
 * - `calendario` — la vista de mes es `grid-cols-7`: siete columnas dentro de una
 *   medida de lectura son siete columnas ilegibles. La vista de agenda además
 *   deja de recortar los títulos.
 * - `estadisticas` — es el tablero: repartos, coberturas y números que solo
 *   significan algo puestos al lado uno del otro.
 *
 * **Lo que NO entra, y no es olvido:** el formulario (una medida de lectura es
 * exactamente lo que necesita), el listado (una fila por actividad; a lo ancho el
 * título queda a 900px del botón «Editar»), el historial y los reportes (texto
 * largo). Un `Set` y no una cadena de `||` por lo mismo que `CICLOS_POR_TIPO`:
 * ya son dos y la lista es el dato.
 */
export const VISTAS_A_TODO_ANCHO: ReadonlySet<string> = new Set(['calendario', 'estadisticas']);

/**
 * La clase de ancho del chasis para esta vista.
 *
 * Devuelve solo el ancho —no el `mx-auto` ni el padding— porque eso es igual para
 * todas y no es una decisión: acá vive lo que cambia según la pantalla.
 */
export const claseAnchoDePanel = (vista: string): string =>
  VISTAS_A_TODO_ANCHO.has(vista) ? ANCHO_DE_TABLERO : ANCHO_DE_LECTURA;
