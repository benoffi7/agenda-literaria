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
 * **`SIN_COSTO`, `esSinCosto`, `admiteMonto` y `montoLegible` viven en
 * `functions/calendario.js` desde B-114, y el motivo es D-20.** La
 * descripción del evento de Calendar necesita las dos cosas —saber si el arancel
 * admite monto y cómo se escribe el número— y una Function **no puede importar de
 * `src/`**. Las alternativas eran una copia atada por un test (el patrón de D-20)
 * o una sola implementación del lado que las dos pueden importar; se eligió la
 * segunda, que es la que no puede divergir.
 *
 * Este módulo queda como la puerta del sitio: reexporta, y se queda con
 * `primeroSinCosto`, que ninguna Function necesita.
 *
 * Lo que la lista dice sigue siendo lo de siempre: no «cuánto cuesta» sino **no
 * hay que pagar nada para entrar**, que es la pregunta que trae quien busca. Son
 * los dos slugs `fijo: true` de `/opciones/arancel` que no cobran, y
 * `tests/tarjetaPublica.test.ts` los ata a la taxonomía base.
 */
export { SIN_COSTO, admiteMonto, esSinCosto, montoLegible } from '@calendario';

import { esSinCosto } from '@calendario';

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

/**
 * Lo que se tipeó en el campo «Monto» → el número que se guarda, o `null`.
 *
 * ── El bug que esto arregla, y lo encontró el `auditor-trampas` ────────────
 * El campo era un `<input type="number">` y el `onChange` hacía
 * `Number(e.target.value)`. Parece inofensivo y no lo es: **para HTML, el punto es
 * el separador decimal**, así que `15.000` —la forma natural de escribir quince
 * mil en Argentina— es un número válido que vale **quince**. `min`, `step` y el
 * `z.number().int().positive()` del schema lo aceptan todos: `15` es un entero
 * positivo perfectamente legal.
 *
 * Resultado: el taller de $15.000 se publicaba como **$15** en las cinco salidas
 * —la tarjeta, el detalle, el JSON-LD que indexa Google, el calendario de todos
 * los suscriptos y el texto pegado en Instagram— sin un solo test en rojo ni un
 * error de validación. Un precio falso en un formato que las máquinas creen es
 * justo lo que B-114 vino a evitar.
 *
 * ── Cómo se lee, y por qué así ────────────────────────────────────────────
 * Con la convención de acá: **el punto agrupa miles y la coma separa decimales**.
 *
 * 1. se tiran los puntos, los espacios y el `$` — son adorno de miles;
 * 2. si queda una coma, se corta ahí: **los centavos no existen en este dominio**
 *    y un «$15.000,50» en un cartel es un error de carga, no un precio;
 * 3. de lo que sobra se toman **solo los dígitos**. Cualquier otra cosa —letras,
 *    un signo, un campo vacío— es `null`, que es «no cargué el monto» y no cero.
 *
 * El campo pasó además de `type="number"` a `type="text"` con `inputMode="numeric"`:
 * el teclado del teléfono sigue abriendo en números, y la interpretación del punto
 * la hace esta función y no el navegador.
 */
export const montoDesdeTexto = (texto: string): number | null => {
  const sinMiles = String(texto ?? '').replace(/[.\s$]/g, '');
  const enteros = sinMiles.split(',')[0] ?? '';
  const digitos = enteros.replace(/\D/g, '');
  if (!digitos) return null;
  const valor = Number(digitos);
  // `Number.isSafeInteger` y no `> 0`: un pegado de cuarenta dígitos da un float
  // que el schema rechazaría igual, pero acá se corta antes de guardarlo.
  return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
};
