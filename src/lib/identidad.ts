/**
 * La identidad del sitio: cómo se llama y de qué color es cada tipo de
 * actividad — B-245, recortado en B-260, y el color de vuelta en B-270 (D-150).
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El sitio se presentaba como «Agenda literaria», que es **su categoría, no su
 * nombre**. El nombre estaba decidido desde el 2026-08-27 (DEC-6) y no se había
 * usado en ninguna parte: ocho lugares repetían la descripción genérica. Un sitio
 * que se presenta con su categoría no tiene identidad, y esto es la mitad de la
 * causa.
 *
 * La otra mitad es el color del tipo de actividad. Estuvo acá (D-141), lo retiró
 * el rediseño (D-146, «la paleta es limitada, siete tintas por categoría son lo
 * contrario de eso») y **vuelve por pedido del dueño**, con una diferencia que es
 * la que cambia la decisión: ahora el color **se elige desde Opciones**, así que
 * ya no es una paleta que el sistema impone sino una que el sitio administra. El
 * porqué completo está en D-150; lo que sigue es la mecánica.
 *
 * ── Las tres cosas que este módulo garantiza ──────────────────────────────
 * 1. **Un tipo nuevo nace con color.** `tipo` es taxonomía autogestionada (§4):
 *    quien carga puede crear uno desde «Otro». Si el color se asignara solo a
 *    mano, ese tipo nacería sin color y nadie se enteraría — el modo de falla es
 *    silencioso. Se **deriva del slug** y lo elegido es la excepción.
 * 2. **Ningún color elegible puede quedar ilegible.** La luminosidad y el croma
 *    son fijos; lo único que varía —y lo único que se puede elegir— es el
 *    **matiz**. Así el contraste se garantiza sobre los 360 tonos posibles y no
 *    sobre los que alguien ya miró (ver `contrasteDelTono`).
 * 3. **Un tono guardado que no sea elegible se ignora.** Un documento editado a
 *    mano en la consola de Firestore no puede pintar una fila ilegible: se cae al
 *    derivado, que sí está garantizado (`tonoDeTipo`).
 */
import { AA_TEXTO, contraste, oklchASrgb, type Srgb } from '@/lib/contraste';

/** El nombre, corto, para el encabezado y el `og:site_name`. */
export const NOMBRE = 'Agenda LEH';

/**
 * La bajada. Hace trabajo doble: es la línea de qué es el sitio y es el
 * desarrollo del acrónimo, así que «LEH» no queda como una sigla muda.
 */
export const BAJADA = 'Leer, Escribir, Hacer';

/** El nombre completo, para el `<title>` y los metadatos. */
export const NOMBRE_COMPLETO = `${NOMBRE} — ${BAJADA}`;

/**
 * De qué habla el sitio, en una línea. Vive acá y no en cada página porque las
 * cinco lo necesitan y tres lo tenían escrito distinto.
 */
export const QUE_ES = 'Talleres de escritura, clubes de lectura, encuentros y presentaciones en Argentina.';

// ─────────────────────────────────────────────────────────────────
// El color del tipo de actividad
// ─────────────────────────────────────────────────────────────────

/**
 * El tono de arranque de cada tipo de actividad, en grados de OKLCH.
 *
 * **Es un default, no una tabla de verdad.** Cualquiera de estos se pisa desde
 * la pantalla de Opciones y el valor elegido gana (`tonoDeTipo`). Están acá para
 * que los siete tipos que existen desde el día uno arranquen con colores
 * elegidos y no con siete matices repartidos por una función de hash.
 *
 * Lo que **no** hace esta tabla es decidir qué tipos hay: un tipo que no esté
 * acá deriva su tono del slug, que es lo que evita el modo de falla silencioso
 * del §4 (un tipo nuevo cayendo en un gris de descarte). Por eso agregarle una
 * entrada es opcional y sacarle una no rompe nada.
 *
 * `tests/color-de-tipo.test.ts` exige que cada slug de acá exista en
 * `opciones-base.json`: la tabla puede quedarse corta —eso está previsto— pero no
 * puede envejecer nombrando tipos que ya no existen.
 */
export const TONOS_DE_TIPO: Record<string, number> = {
  taller: 25, // terracota — la familia del acento
  'club-lectura': 250, // azul tinta
  encuentro: 148, // verde botella
  presentacion: 305, // ciruela
  charla: 68, // ocre
  feria: 195, // petróleo
  'libreria-a-la-calle': 12, // ladrillo
};

/**
 * La banda: la luminosidad y el croma son fijos para **todos** los tipos.
 *
 * No es estética, es lo que hace verificable la promesa de contraste. Con `L` y
 * `C` fijos el espacio de colores posibles tiene **una** dimensión —360 matices—
 * y se puede recorrer entero en un test. Con un selector de color libre el
 * espacio son millones de colores y la garantía se degrada a «los que alguien ya
 * miró»: alguien elige un amarillo, el texto encima queda ilegible y no falla
 * nada.
 *
 * Cambiar cualquiera de estos dos números cambia los 360 colores a la vez, y por
 * eso el test que los recorre es la red que corresponde: subir `L` a 0,55 deja el
 * peor tono en 4,1:1 sobre la capa tonal más honda y el caso se pone rojo.
 */
export const L_DEL_TIPO = 0.42;
export const C_DEL_TIPO = 0.105;

/** Cuántos grados tiene la rueda. Escrito una vez para no repetir el 360. */
const GRADOS = 360;

/**
 * Un tono estable derivado del slug, para los tipos que no están en la tabla.
 *
 * No es un hash criptográfico ni hace falta: lo único que se le pide es repartir
 * y no cambiar nunca para el mismo texto — el build y el cliente tienen que
 * llegar al mismo color sin guardar nada. Se saltean los tonos ya asignados por
 * un margen para que un tipo nuevo no salga idéntico a «taller».
 */
const tonoDerivado = (slug: string): number => {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % GRADOS;
  const asignados = Object.values(TONOS_DE_TIPO);
  // Empuja el tono hasta que quede a más de 18° de todos los asignados.
  for (let i = 0; i < GRADOS; i++) {
    const t = (h + i) % GRADOS;
    if (asignados.every((a) => Math.min(Math.abs(t - a), GRADOS - Math.abs(t - a)) > 18)) return t;
  }
  return h;
};

/**
 * ¿Este número es un tono que se puede guardar?
 *
 * Entero y dentro de la rueda. **Es la guarda de lectura además de la de
 * escritura**: `tonoDeTipo` la aplica sobre lo que viene de Firestore, así que un
 * `tono: 999`, un `tono: 12.5` o un `tono: null` escritos a mano en la consola no
 * pintan nada raro — se caen al derivado, que está garantizado.
 */
export const esTonoElegible = (tono: unknown): tono is number =>
  typeof tono === 'number' && Number.isInteger(tono) && tono >= 0 && tono < GRADOS;

/**
 * El tono del tipo: el elegido si es elegible, el de la tabla si lo tiene, y el
 * derivado del slug si no. **En ese orden**, que es la regla del §4 escrita en
 * una línea: se deriva por defecto y lo elegido es la excepción.
 */
export const tonoDeTipo = (slug: string, elegido?: unknown): number =>
  esTonoElegible(elegido) ? elegido : (TONOS_DE_TIPO[slug] ?? tonoDerivado(slug));

/** El color del tipo, listo para un `color` o un `border-color` de CSS. */
export const colorDeTipo = (slug: string, elegido?: unknown): string =>
  colorDelTono(tonoDeTipo(slug, elegido));

/** Un tono suelto como color de CSS. Es lo que pinta la muestra del selector. */
export const colorDelTono = (tono: number): string =>
  `oklch(${L_DEL_TIPO} ${C_DEL_TIPO} ${tono})`;

/** El mismo color en sRGB, para poder medirle el contraste. */
export const colorDelTonoSrgb = (tono: number): Srgb =>
  oklchASrgb(L_DEL_TIPO, C_DEL_TIPO, tono);

/** Los tipos con tono de arranque, para que un test pueda recorrerlos. */
export const TIPOS_CON_TONO = Object.keys(TONOS_DE_TIPO);

/**
 * Las tres superficies claras del sitio, **copiadas de `global.css`**.
 *
 * ── Por qué se copian, si el repo persigue justamente eso ─────────────────
 * Los chequeos de contraste (`contraste-del-sitio`, `contraste-de-superficies`,
 * `sistema-visual`) **parsean `global.css`** en vez de copiar los valores, y esa
 * es la regla. Acá no se puede: esto corre en el navegador, adentro del bundle
 * del panel, y no hay hoja de estilos que leer al momento de decidir si un color
 * elegido se puede guardar.
 *
 * Es el caso 2 de D-98 —«un formato que no se puede importar se ata con un
 * test»—: `tests/color-de-tipo.test.ts` lee los tokens de `global.css` y exige
 * que estos tres números sean exactamente esos. Aclarar una superficie en la hoja
 * y no acá pone el test en rojo, que es cuándo hay que mirarlo.
 */
export const SUPERFICIES: readonly { nombre: string; oklch: readonly [number, number, number] }[] =
  [
    { nombre: 'papel', oklch: [0.9823, 0.0069, 88.64] },
    { nombre: 'crema', oklch: [0.9643, 0.007, 88.64] },
    { nombre: 'hondo', oklch: [0.9129, 0.0071, 88.65] },
  ];

/**
 * El contraste del tono contra la superficie **más exigente** de las tres.
 *
 * El tipo se escribe sobre el papel y, cuando el mouse pasa por la fila, sobre
 * `crema`. Medir contra la más oscura de las tres cubre las dos y la que venga:
 * es el criterio de `contraste-de-superficies.test.ts` (B-256), donde está
 * escrito el motivo — cada superficie nueva es más oscura que el papel, así que
 * medir contra el papel da un número **optimista**.
 */
export const contrasteDelTono = (tono: number): number => {
  const color = colorDelTonoSrgb(tono);
  return Math.min(
    ...SUPERFICIES.map(({ oklch }) => contraste(color, oklchASrgb(oklch[0], oklch[1], oklch[2]))),
  );
};

/** El piso que tiene que pasar un color de tipo: es texto chico, así que AA. */
export const PISO_DEL_TIPO = AA_TEXTO;

/**
 * ¿Un tono se puede usar como texto? Elegible **y** por encima del piso.
 *
 * Con la banda de arriba los 360 lo pasan, y eso está verificado. Esto existe
 * igual, y no es redundante: es lo que hace que **aflojar la banda no pueda
 * pasar en silencio**. El día que alguien suba `L_DEL_TIPO` para que los colores
 * se vean más vivos, el guardado empieza a rechazar los tonos que dejaron de
 * alcanzar en vez de publicarlos.
 */
export const tonoLegible = (tono: unknown): tono is number =>
  esTonoElegible(tono) && contrasteDelTono(tono) >= PISO_DEL_TIPO;

/**
 * La banda que ofrece el selector de Opciones — doce matices con nombre.
 *
 * ── Por qué una lista de matices y no un selector de color ────────────────
 * Un selector de color libre deja elegir la luminosidad, y ahí se pierde la
 * garantía: los 360 tonos de esta banda pasan AA con margen, y un amarillo claro
 * elegido a mano no. La banda es la forma de que **la elección no pueda estar
 * mal**, en vez de avisar después de que estuvo mal.
 *
 * Doce y no veinticuatro porque cada uno tiene que tener un nombre que se pueda
 * leer en voz alta: «Tono 195» no le dice nada a nadie, y un botón sin nombre no
 * existe para quien usa un lector de pantalla. Los nombres son de tinta de
 * imprenta, que es de lo que habla el sistema visual.
 *
 * **No es la lista de tipos**, y esa distinción es la que importa: acá no hay
 * ningún slug escrito a mano, así que un tipo nuevo no necesita que nadie toque
 * esto (trampa 6 del §13).
 */
export const TINTAS_DE_TIPO: readonly { tono: number; nombre: string }[] = [
  { tono: 25, nombre: 'Terracota' },
  { tono: 55, nombre: 'Naranja' },
  { tono: 85, nombre: 'Ocre' },
  { tono: 115, nombre: 'Oliva' },
  { tono: 148, nombre: 'Verde botella' },
  { tono: 170, nombre: 'Esmeralda' },
  { tono: 195, nombre: 'Petróleo' },
  { tono: 225, nombre: 'Celeste profundo' },
  { tono: 250, nombre: 'Azul tinta' },
  { tono: 290, nombre: 'Violeta' },
  { tono: 315, nombre: 'Ciruela' },
  { tono: 350, nombre: 'Frambuesa' },
];

export { AA_TEXTO };
