/**
 * Las clases compartidas del sitio público — B-253, reescritas en B-260.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El panel ya tiene esto resuelto: `campos/Campo.tsx` centraliza `claseInput`,
 * `claseBotonPrimario` y compañía, y el §«Estilo de UI» de `05-patrones.md` dice
 * con todas las letras **«no escribir clases de botón sueltas»**. El sitio
 * público no tenía el equivalente, y se notaba: el anillo de foco estaba copiado
 * **doce veces** entre la página de detalle, `/ayuda`, `/contacto` y el chrome.
 *
 * Doce copias de un anillo de foco no son doce copias de una decoración: la copia
 * que se escriba mal el mes que viene deja **un** control sin foco visible, y eso
 * no se ve mirando la pantalla con el mouse.
 *
 * `tests/estilos-del-sitio.test.ts` falla si un `.astro` del sitio vuelve a
 * escribir el anillo a mano.
 *
 * ── Lo que B-260 cambió ───────────────────────────────────────────────────
 * El sistema visual es **brutalismo editorial** (`docs/referencias/sistema-visual.md`,
 * D-146), y eso toca todas las clases de este archivo por tres reglas que no son
 * negociables ni caso por caso:
 *
 * 1. **Radio 0.** No hay `rounded-*` en ninguna clase de acá. El lenguaje es
 *    filoso: botones, campos y contenedores tienen esquina viva.
 * 2. **Estrictamente plano.** Ninguna sombra, ningún degradado. Lo que separa una
 *    superficie de otra es una **regla** o una **capa tonal**, nunca una sombra.
 * 3. **Tintas con nombre, no opacidades.** Donde antes había `text-tinta/70` hoy
 *    va `text-super` o `text-suave`, que son tintas del sistema con su contraste
 *    medido. Una opacidad es una trama de medio tono: en una impresión a tintas
 *    planas no existe, y además es por donde se cae el contraste (B-235).
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
 * «esto es interactivo», y está medido: `acento` (#a7341c) sobre las tres
 * superficies da 6,33 / 6,01 / 5,15, o sea AA en la peor.
 *
 * **`outline-offset` positivo y no `0`**: con radio 0 y reglas por todos lados,
 * un anillo pegado al borde se lee como parte del marco y deja de decir dónde
 * está el foco. Es la contrapartida de que ya no haya esquinas redondeadas.
 */
export const foco =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento';

/**
 * El mismo anillo, más separado. Para lo que se apoya contra un borde o contra el
 * fondo de una superficie propia, donde un offset de 2px se pega al borde.
 */
export const focoAmplio =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento';

/**
 * Un enlace dentro de un párrafo.
 *
 * **Subrayado grueso, no fino** (`decoration-2`): es el mismo gesto que el botón
 * de texto del sistema —«texto con un subrayado grueso»— y hace que el enlace se
 * lea como enlace sin depender solo del color, que es el requisito de
 * accesibilidad de siempre.
 */
export const claseEnlace = `text-acento underline decoration-2 underline-offset-4 hover:text-super hover:decoration-super ${foco}`;

/**
 * La acción principal de una pantalla: **un bloque rectangular macizo**.
 *
 * Hay una sola por pantalla y siempre es terracota. `text-papel` sobre
 * `bg-acento` da 6,33:1; el hover pasa a `super` —la tinta de superposición, que
 * es lo que el sistema pide para el hover de una tinta plena— y ahí da 6,34:1.
 * Los dos pasan AA con margen.
 *
 * Sin `rounded-*` y sin `shadow-*`, y no es un olvido: es la regla 1 y la 2.
 */
export const claseBotonPrimario = `inline-flex min-h-touch items-center justify-center bg-acento px-6 py-2 text-center font-medium text-papel transition-colors hover:bg-super ${foco}`;

/**
 * La acción de al lado: **texto con el subrayado grueso**, no una segunda caja.
 *
 * El sistema da dos formas de botón —bloque macizo o texto subrayado— y usar la
 * segunda para lo secundario es lo que hace que la principal se distinga sin
 * inventar una tercera. `text-acento` sobre las tres superficies pasa AA.
 */
export const claseBotonSecundario = `inline-flex min-h-touch items-center justify-center px-2 py-2 text-center font-medium text-acento underline decoration-2 underline-offset-4 transition-colors hover:text-super hover:decoration-super ${foco}`;

/**
 * Un bloque apoyado sobre el papel: **regla y capa tonal, nunca una sombra**.
 *
 * Sustituye a la `claseTarjeta` de D-141. No se llama «tarjeta» a propósito: en
 * este sistema no hay tarjetas —hay bloques separados por reglas—, y el nombre
 * viejo invitaba a volver a apilarlas con sombra.
 */
export const claseBloque = 'border border-borde bg-crema';

/** Una superficie hundida: el índice de `/ayuda`, la caja de una cita. */
export const claseHundido = 'border border-borde bg-hondo';

/**
 * El rótulo de un dato: «CUÁNDO», «DÓNDE», «MATERIAL».
 *
 * Es `label-caps` del sistema —Archivo Narrow 11/12, versalitas— con la tinta
 * azul, que es la que el sistema reserva para lo funcional y las categorías.
 * `azul` da 6,14 / 5,82 / 4,99 sobre las tres superficies: AA en la peor, que es
 * lo que hay que exigirle a 11px.
 */
export const claseRotulo = 'label-caps text-azul';

/** El mismo rótulo cuando va calado sobre una tinta plena. */
export const claseRotuloCalado = 'label-caps text-papel';

/** El título de una sección de contenido largo. */
export const claseTituloSeccion = 'headline-sm text-tinta';

/**
 * El bloque de fecha: **rectángulo de tinta plena con el texto calado en papel**.
 *
 * Es el gesto central del sistema, así que se escribe una sola vez: lo usan la
 * fila del listado y los encuentros de la página de detalle, y dos definiciones
 * serían dos bloques de fecha distintos para el mismo dato.
 *
 * ── La tinta la pone quien lo usa, y eso no es pereza ─────────────────────
 * Esta clase trae la **forma** y el texto calado, no el fondo. El bloque va en
 * `acento` cuando la fecha todavía va a pasar y en `super` cuando ya pasó o se
 * canceló —el terracota es la tinta de lo que se puede hacer—, así que hay dos
 * fondos posibles.
 *
 * La primera versión traía `bg-acento` adentro y los llamadores le agregaban
 * `bg-super` encima. **Eso salía mal en silencio**: dos utilidades de
 * `background-color` en el mismo elemento no las resuelve el orden en que están
 * escritas en el atributo, sino el orden en que Tailwind las emitió en la hoja.
 * Hoy ganaba `bg-super` por casualidad alfabética; un cambio de versión de
 * Tailwind, o una clase nueva que corra el orden, y el bloque de un encuentro
 * cancelado se pinta terracota — sin que falle nada. Lo encontró **mirar el HTML
 * construido**, no un test.
 *
 * Con el fondo afuera no hay conflicto que resolver: cada llamador pone una sola
 * tinta. `tests/sistema-visual.test.ts` prohíbe que vuelvan a convivir dos.
 *
 * `text-papel` da 6,33:1 sobre `acento` y 6,34:1 sobre `super` — el sistema lo
 * midió y da cómodo incluso para las versalitas de 11px que van adentro.
 */
export const claseBloqueFecha =
  'flex min-w-14 flex-col items-center justify-center px-2 py-1.5 text-papel';

/**
 * Un afiche: la imagen de una actividad, **entera y sin recortar** — B-263.
 *
 * Es la clase que reemplaza al token `--aspect-portada` de B-249, y lo sustituye
 * por una garantía más fuerte. El token compartía **un número** entre los
 * consumidores para que la misma imagen no tuviera dos recortes; esta clase
 * comparte **la regla**: nadie recorta. Un token no impedía que un consumidor lo
 * usara con `object-cover` y otro con `object-contain` —que es cómo la
 * divergencia volvería— y esto sí, porque el `object-fit` viaja adentro.
 *
 * Las tres piezas, y ninguna es decorativa:
 *
 * | Pieza | Qué hace |
 * |---|---|
 * | `object-contain` | la red: si la caja y la imagen no coinciden, sobra papel a los costados, **nunca falta imagen** |
 * | `w-full` | la imagen ocupa la columna. Una más angosta se agranda, y eso se acepta: los flyers del circuito salen de Instagram y vienen de 1080 de ancho |
 *
 * La proporción **no** está acá: es un dato de cada imagen y la pone
 * `estiloDeAfiche` (`lib/afiche.ts`). Escribirla en la clase sería volver al
 * número único para imágenes de formas distintas, que es el bug de B-263.
 *
 * El borde y la capa tonal son la física del sistema —una regla separa, no una
 * sombra— y el fondo solo se ve si sobra caja.
 */
export const claseAfiche = 'block w-full border border-borde bg-hondo object-contain';

/**
 * El afiche **de la página de detalle**: el mismo, con el alto topeado.
 *
 * El tope es lo que hace válido el desvío del §4.3 (D-144): arriba de la ficha,
 * un flyer vertical de 1080×1350 empujaría la fecha fuera de la primera
 * pantalla. `svh` y no `vh` por lo mismo que el panel de filtros de D-143: con
 * la barra retráctil de un navegador móvil, `vh` mide de más.
 *
 * **Y la cartelera no lo lleva, a propósito.** Ahí no hay ficha que quede
 * abajo: el afiche *es* el contenido y la página se recorre scrolleando, que es
 * lo que se hace frente a una pared de afiches. Topear el alto en una columna
 * ancha además dejaría el flyer flotando entre dos bandas de papel, que es
 * exactamente el aspecto que B-263 vino a sacar.
 */
export const claseAfichePortada = `${claseAfiche} max-h-[70svh]`;

/**
 * La pared de `/cartelera`, según cuántos afiches haya — B-265.
 *
 * El número lo decide `columnasDeCartelera` (`lib/afiche.ts`), que es la regla y
 * está testeada; acá está el mapeo a clases, y vive en este archivo por una
 * razón mecánica además de la de siempre: **Tailwind genera las utilidades
 * leyendo el fuente**, así que un `columns-${n}` armado en tiempo de ejecución
 * no existiría en la hoja. Los tres valores tienen que estar escritos literales
 * en algún lado, y ese lado es el centralizador.
 *
 * Son **columnas de CSS** y no una grilla, y esa es la decisión: una grilla
 * alinea filas, y una fila de afiches de altos distintos deja huecos debajo de
 * los más bajos. Las columnas dejan que cada uno mida lo que mide y el de abajo
 * arranque donde terminó el anterior — que es literalmente cómo se pega un
 * afiche sobre una pared. Nada se mueve solo: es continuo porque no termina, no
 * porque avance.
 *
 * Con **una** columna se agrega un tope de ancho: es el caso de hoy (dos flyers)
 * y sin el tope el afiche mediría el ancho entero de un monitor de 27".
 */
export const CLASES_DE_PARED: Record<1 | 2 | 3, string> = {
  1: 'mx-auto max-w-3xl',
  2: 'sm:columns-2',
  3: 'sm:columns-2 lg:columns-3',
};

/**
 * Un afiche pegado en la pared: el bloque entero es el enlace.
 *
 * `break-inside-avoid` es la mitad que no se puede olvidar — sin él, CSS parte
 * el bloque entre dos columnas y el epígrafe de un afiche aparece arriba del
 * siguiente.
 */
export const claseAficheEnPared = `mb-10 block break-inside-avoid ${foco}`;

/**
 * Un campo: **la etiqueta apoyada sobre una regla de 1px, sin caja**.
 *
 * La caja aparece solo al enfocar, que es lo que el sistema pide. Se consigue con
 * el borde de abajo siempre presente y el anillo de foco haciendo el resto: no
 * hace falta cambiar el `border` en `:focus`, porque el `outline` ya dibuja la
 * caja y además es el único que un lector de pantalla y el modo de alto
 * contraste respetan.
 */
export const claseCampo = `w-full border-0 border-b border-borde bg-transparent px-0 py-2 text-tinta placeholder:text-super ${foco}`;

/**
 * Una casilla cuadrada con la X maciza en azul — ver `@utility casilla` en
 * `global.css`, que es donde se dibuja.
 *
 * `accent-color` no sirve acá: pinta el tilde nativo del sistema operativo, que
 * es redondeado en macOS y no es una X. La casilla del sistema hay que dibujarla.
 */
export const claseCasilla = `casilla ${foco}`;

/**
 * La tira de imágenes secundarias de la página de detalle — B-296.
 *
 * El número de columnas lo decide `columnasDeGaleria` (`lib/afiche.ts`), que es
 * la regla y está testeada; acá está el mapeo a clases, y vive en este archivo
 * por la misma razón mecánica que `CLASES_DE_PARED`: **Tailwind genera las
 * utilidades leyendo el fuente**, así que un número de columnas armado en tiempo
 * de ejecución no existiría en la hoja.
 *
 * ── Grilla acá, columnas de CSS en la pared: son problemas distintos ──────
 * D-148 eligió columnas para `/cartelera` porque una fila de afiches de altos
 * distintos deja huecos debajo de los más bajos. Acá la fila tiene **dos o tres
 * elementos y una sola línea**, así que no hay «debajo» que rellenar, y la grilla
 * da lo que las columnas no dan: cada celda mide lo mismo de ancho, o sea que dos
 * secundarias de formas distintas salen a la misma escala en vez de una grande y
 * una chica según cómo CSS reparta el alto.
 *
 * `items-start` es la mitad que no se puede olvidar: sin él la celda se estira al
 * alto de la más alta y el epígrafe de la más baja queda flotando lejos de su
 * imagen, que es justo lo que un `figcaption` no puede hacer.
 *
 * **Dos columnas en el teléfono también con tres imágenes** (2 + 1): un tercio de
 * 343px son 105px, que para una foto es una estampilla. `sm:grid-cols-3` es el
 * refinamiento donde hay ancho de sobra.
 *
 * El `gap-4` es el medianil de 16px del sistema visual, no un número elegido acá.
 * El contenedor no lleva borde ni fondo: el borde lo trae cada imagen desde
 * `claseAfiche`, y dos reglas pegadas serían una regla doble.
 */
export const CLASES_DE_GALERIA: Record<2 | 3, string> = {
  2: 'grid grid-cols-2 items-start gap-4',
  3: 'grid grid-cols-2 items-start gap-4 sm:grid-cols-3',
};
