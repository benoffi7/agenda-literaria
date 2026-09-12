import { usaPestanias, type VistaDelPanel } from '@/lib/vistaDelPanel';

/**
 * Qué pantallas del panel usan todo el ancho de la pantalla — B-620.
 *
 * ── Por qué no todas ──────────────────────────────────────────────────────
 * «Aprovechar el ancho» no es una mejora universal: un formulario de 30+ campos
 * a 1900px es **peor** que a 900, porque la etiqueta de un campo y su error
 * quedan a treinta centímetros del ojo y el renglón de texto largo pasa el
 * límite de lectura. Lo que gana con el ancho es lo que se recorre de un
 * barrido: una grilla de tarjetas donde entran doce en lugar de tres.
 *
 * Así que el ancho es **por vista** y la lista es explícita. Las exclusiones y
 * su motivo:
 *
 * | Vista | Ancho | Por qué |
 * |---|---|---|
 * | `lista` | todo | es la grilla de tarjetas de B-620: lo que el ancho compra son columnas |
 * | `nueva` / `editar` / `duplicar` / `convertir` | lectura | el formulario del §11; a 1900px la etiqueta y el error se separan del campo |
 * | `historial` | lectura | dos versiones enfrentadas, o sea texto: es el caso donde el renglón largo cansa |
 * | `reportes` | lectura | un formulario y una lista corta |
 * | `taxonomias` | lectura | filas de dos campos: el ancho extra queda vacío |
 * | `calendario` | lectura | la grilla del mes **sí** ganaría, y queda anotado; ensancharla es un cambio visual propio y no entra en este frente |
 * | `estadisticas` | todo | B-621, D-400: un tablero de gráficos es el caso puro de «se recorre de un barrido» |
 * | `propuestas` | lectura | fichas de texto que se leen una por una, como `reportes` |
 *
 * **La fila de `nueva`/`editar`/`duplicar` dejó de ser fija con B-814**: hoy es
 * «lectura en vista celular, todo en vista PC». El motivo está abajo, en
 * `VISTAS_DE_FORMULARIO`, y no reemplaza el argumento de esta tabla — lo acota a
 * la vista donde sigue siendo cierto.
 *
 * ── Por qué `estadisticas` entró y `calendario` no (B-621) ────────────────
 * B-621 nombraba las dos, y el ítem dice por qué van por separado: «ensanchar
 * cada una es un cambio visual propio —qué crece, qué se reparte en columnas,
 * qué queda con su ancho—, no el mismo cambio aplicado dos veces más». El
 * tablero pasó a tener repartos con torta, dos vistas de tiempo y un mapa de
 * calor de ocho semanas, así que el reparto de columnas existe y está escrito
 * (D-400). La grilla del mes sigue esperando el suyo: ensancharla sin decidirlo
 * daría siete columnas de 220px con el mismo contenido de 120 — más aire, no
 * más información.
 *
 * ── Por qué es un módulo y no un `vista.tipo === 'lista'` en `AdminApp` ───
 * Por el mismo motivo que `salida-del-panel.ts`, que es el precedente exacto: la
 * decisión es pura y se testea sin DOM, mientras el `className` es maquetación.
 * Y sobre todo porque es **una lista que envejece sola**: la vista que se agregue
 * mañana no aparece acá, arranca angosta —el default prudente— y quien la escriba
 * decide en una línea. Un `===` suelto en el JSX no le pregunta nada a nadie.
 */

/**
 * Las vistas del router que se pintan a todo ancho.
 *
 * Es una lista y no un booleano en cada vista porque el default tiene que ser
 * «angosta»: agregar una pantalla y olvidarse de esto la deja como está hoy, que
 * es el lado barato de equivocarse (mismo criterio que D-41).
 */
/*
 * `'calendario'` entra el 2026-09-07, por pedido del dueño mirando el panel
 * publicado (B-621): la grilla del mes en 896px daba celdas de 120px. Es la
 * decisión que D-330 había dejado explícitamente afuera —«ensanchar cada una es
 * un cambio visual propio»— y el aviso de arriba sigue valiendo: **entrar acá es
 * una línea; repartir la grilla por dentro es el trabajo real**, y eso todavía
 * no está hecho.
 */
export const VISTAS_A_TODO_ANCHO = ['lista', 'estadisticas', 'calendario'] as const;

export type VistaATodoAncho = (typeof VISTAS_A_TODO_ANCHO)[number];

/**
 * Las vistas del formulario, que **dependen de la vista del panel** — B-814.
 *
 * ── Esto revisa la decisión de B-620, y hay que decirlo ───────────────────
 * La tabla de arriba las excluye con un motivo escrito: «a 1900px la etiqueta y
 * el error se separan del campo». **Ese motivo era cierto y dejó de aplicar
 * entero**, por dos cosas que pasaron después:
 *
 * 1. **D-490 partió el formulario en pestañas.** El argumento de B-620 hablaba de
 *    «un formulario de 30+ campos»; una pestaña tiene seis. El renglón largo que
 *    cansaba era la lista entera, no una sección.
 * 2. **Las secciones ya reparten en dos columnas** (`grid sm:grid-cols-2`, con
 *    `sm:col-span-2` para la descripción y los textos largos), y hoy ese reparto
 *    está apretado en 896px. O sea que el ancho no se estira: **se usa**, que es
 *    exactamente lo que B-621 pide antes de ensanchar algo («qué crece, qué se
 *    reparte en columnas»). Y las tres secciones que no reparten —«Encuentros»,
 *    «Dónde», «Material»— son editores de **filas**, que es el caso que B-620
 *    dice que sí gana con el ancho.
 *
 * Pedido del dueño el 2026-09-08 («si es pc usar pestañas y todo a lo ancho») y
 * decidido por él sobre las tres alternativas.
 *
 * ── Y por eso cuelga de la vista elegida, no de la ventana ────────────────
 * En vista «celular» el formulario va a lo largo y sin pestañas, o sea que vuelve
 * a ser la lista de 30+ campos de la que hablaba B-620 — y ahí su argumento sigue
 * intacto, así que vuelve al ancho de lectura. Es la misma vista la que decide las
 * dos cosas, que es lo que evita la combinación absurda: apilado y a 1900px.
 */
const VISTAS_DE_FORMULARIO: readonly string[] = [
  'nueva',
  'editar',
  'duplicar',
  'convertir',
  /*
   * B-901 — el formulario de una librería. Entra acá por lo mismo que los otros
   * cuatro y no por simetría: sus campos **ya reparten en dos columnas**
   * (`grid sm:grid-cols-2`), así que el ancho no se estira, se usa — que es lo
   * que B-621 pide antes de ensanchar algo. Es además la lista que
   * `salida-del-panel.ts` declara, y `tests/ancho-del-panel.test.ts` cruza las
   * dos: una vista con formulario que no esté acá queda encajonada en PC.
   */
  'libreria',
  /*
   * B-832 — el formulario de una suscripción. Entra por lo mismo que el de una
   * librería y con más razón: es el más largo de los tres directorios —seis
   * desplegables, tres listas de chips, la galería y el precio— y sus campos ya
   * reparten en dos columnas, así que el ancho no se estira, se usa (B-621).
   */
  'suscripcion',
  /*
   * B-833 — el formulario de un lugar. Entra por lo mismo que los otros dos: sus
   * campos ya reparten en dos columnas (la dirección con su casilla, la
   * capacidad con sus notas, el precio con su unidad), así que el ancho no se
   * estira, se usa (B-621).
   */
  'lugar',
];

/**
 * ¿Esta vista se pinta a todo ancho?
 *
 * **`vistaDelPanel` es obligatorio, sin default**, y eso es deliberado: la primera
 * versión le puso uno y no había ninguno honesto. «El comportamiento de antes de
 * B-814» son **dos cosas distintas** según el archivo —acá, ancho de lectura;
 * en el formulario, pestañas— así que un default significaba una en cada lado y
 * el que se equivocara no se iba a enterar. Es la misma razón por la que este
 * módulo existe en vez de un `===` en el JSX: obligar a que alguien lo mire.
 */
export const ocupaTodoElAncho = (
  tipoDeVista: string,
  vistaDelPanel: VistaDelPanel,
): boolean =>
  (VISTAS_A_TODO_ANCHO as readonly string[]).includes(tipoDeVista) ||
  (VISTAS_DE_FORMULARIO.includes(tipoDeVista) && usaPestanias(vistaDelPanel));
