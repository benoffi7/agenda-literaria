/**
 * Qué aranceles no se pagan — B-271.
 *
 * ── Por qué un módulo de dos líneas ───────────────────────────────────────
 * Esto nació adentro de `tarjetaPublica.ts`, donde lo usaba una sola cosa: la
 * fila del listado pinta «Gratis» y «A la gorra» con el acento en vez de dejarlos
 * en el gris del resto. Desde B-271 lo usan **tres**, y las tres del mismo lado
 * del mismo problema:
 *
 * | Quién | Para qué |
 * |---|---|
 * | `tarjetaPublica.ts` | el acento del arancel en la fila del listado |
 * | `listadoPublico.ts` | los chips del sitio: lo que no se paga va primero (D-151) |
 * | `filtrosActividades.ts` | el desplegable de arancel del panel, en el mismo orden (D-152) |
 *
 * Y no puede vivir en ninguno de los tres: `tarjetaPublica` importa de
 * `listadoPublico`, que importa de `filtrosActividades`. Poniéndolo en el
 * último funcionaría hoy y sería el archivo equivocado —se llama «los filtros del
 * panel» y esto lo usa sobre todo el sitio—, así que va en un módulo propio, sin
 * dependencias, como `slugify` y `normalize`.
 *
 * ── Y por qué no es un booleano en el modelo ──────────────────────────────
 * Porque `arancel.tipo` es **taxonomía autogestionada** (§4): mañana puede haber
 * «Con beca parcial» o «Bono social», y ninguno de los dos es gratis. Lo que esta
 * lista dice no es «cuánto cuesta» sino «no hay que pagar nada para entrar», que
 * es la pregunta que trae quien busca. Una opción nueva creada desde «Otro» cae
 * afuera por defecto, que es el lado prudente: cobrarse de menos en un filtro es
 * peor que no aparecer en él.
 */

/**
 * Los aranceles que no se pagan.
 *
 * `'a-la-gorra'` está acá y **no es un caso raro**: el §4.1 del `CLAUDE.md` dice
 * que en el circuito literario es la mitad de los casos y que no entra en el
 * binario gratis/pago.
 *
 * Son los dos slugs `fijo: true` de `/opciones/arancel` que no cobran, y
 * `tests/tarjetaPublica.test.ts` los ata a la taxonomía base.
 */
export const SIN_COSTO: readonly string[] = ['gratis', 'a-la-gorra'];

export const esSinCosto = (slugArancel: string): boolean => SIN_COSTO.includes(slugArancel);

/**
 * Comparador para ordenar slugs de arancel: **primero lo que no se paga**.
 *
 * Devuelve `0` entre dos del mismo grupo a propósito, para que quien llame
 * encadene su propio desempate — el sitio ordena por cantidad de actividades y el
 * panel alfabéticamente, y ninguno de los dos criterios sirve para el otro. Lo que
 * sí tiene que ser igual en los dos lados es **qué va arriba**, y eso es esto.
 */
export const primeroSinCosto = (a: string, b: string): number =>
  (esSinCosto(a) ? 0 : 1) - (esSinCosto(b) ? 0 : 1);
