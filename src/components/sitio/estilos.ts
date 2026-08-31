/**
 * Las clases compartidas del sitio público — B-253.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El panel ya tiene esto resuelto: `campos/Campo.tsx` centraliza `claseInput`,
 * `claseBotonPrimario` y compañía, y el §«Estilo de UI» de `05-patrones.md` dice
 * con todas las letras **«no escribir clases de botón sueltas»**. El sitio
 * público no tenía el equivalente, y se notaba: el anillo de foco
 * —`focus-visible:outline-2 focus-visible:outline-offset-2
 * focus-visible:outline-acento`— estaba copiado **doce veces** entre la página de
 * detalle, `/ayuda`, `/contacto` y el chrome, y la clase del enlace acentuado,
 * cinco.
 *
 * Doce copias de un anillo de foco no son doce copias de una decoración: la copia
 * que se escriba mal el mes que viene deja **un** control sin foco visible, y eso
 * no se ve mirando la pantalla con el mouse. Es la misma forma de bug que este
 * repo persigue en otros lados —dos derivaciones de la misma idea que se separan
 * sin que nada falle (§«si hay un skill, se usa» de `05-patrones.md`)— aplicada a
 * la accesibilidad.
 *
 * `tests/estilos-del-sitio.test.ts` falla si un `.astro` del sitio vuelve a
 * escribir el anillo a mano.
 *
 * ── Y por qué es un `.ts` y no un componente ──────────────────────────────
 * Porque lo que se comparte son **clases**, no markup: el enlace acentuado a
 * veces es un `<a>`, a veces un `<button>` del componente de copiar, y a veces
 * cuelga de un `class:list`. Un componente obligaría a envolver los tres.
 */

/**
 * El anillo de foco del sitio, y el único.
 *
 * Va con el acento —no con la tinta— porque es el color que el sitio usa para
 * «esto es interactivo», y está medido: `acento` sobre las tres superficies de la
 * paleta pasa AA (5,59 sobre `papel`, 5,04 sobre `hondo`, que es la peor).
 */
export const foco =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';

/**
 * El mismo anillo, más separado. Para lo que se apoya contra un borde o contra el
 * fondo de una superficie propia, donde un offset de 2px se pega al borde y el
 * foco se lee como parte del marco.
 */
export const focoAmplio =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento';

/** Un enlace dentro de un párrafo: acentuado y subrayado, nunca solo por color. */
export const claseEnlace = `text-acento underline decoration-borde underline-offset-4 hover:decoration-acento ${foco}`;

/**
 * La acción principal de una pantalla. Hay **una sola** por pantalla y siempre es
 * terracota: el CTA de inscripción del detalle, «Agregar a mi Google Calendar» y
 * los dos de `/contacto` son la misma promesa —«esto es lo que viniste a hacer»—
 * y hasta B-253 se veían de tres formas distintas.
 *
 * `text-papel` sobre `bg-acento` da 5,59:1, y sobre `acento-hondo` (el hover)
 * 8,55:1. Los dos pasan AA.
 */
export const claseBotonPrimario = `inline-flex min-h-touch items-center justify-center rounded-md bg-acento px-6 py-2 text-center font-medium text-papel transition-colors hover:bg-acento-hondo ${foco}`;

/** La acción de al lado: mismo peso de caja, sin el color. */
export const claseBotonSecundario = `inline-flex min-h-touch items-center justify-center rounded-md border border-borde bg-papel px-5 py-2 text-center font-medium text-tinta transition-colors hover:bg-hondo ${foco}`;

/**
 * Una tarjeta apoyada sobre el fondo.
 *
 * **Superficie y borde, nunca una sombra** (D-141): las sombras son exactamente
 * lo que le da a una página el aire de plataforma genérica, y `crema` sobre
 * `papel` alcanza para que la caja se separe.
 */
export const claseTarjeta = 'rounded-lg border border-borde bg-crema';

/** Una superficie hundida: el índice de `/ayuda`, un chip, la caja de una cita. */
export const claseHundido = 'rounded-lg border border-borde bg-hondo';

/**
 * El rótulo de un dato: «CUÁNDO», «DÓNDE», «MATERIAL».
 *
 * Es lo que hace la jerarquía sin subir de tamaño —el patrón que se le copia a
 * Eventbrite— y `tinta/70` sobre la más oscura de las tres superficies da 5,92:1.
 */
export const claseRotulo =
  'text-[0.7rem] font-semibold tracking-[0.16em] text-tinta/70 uppercase';

/** El título de una sección de contenido largo. */
export const claseTituloSeccion = 'font-serif text-2xl font-semibold tracking-tight text-tinta';
