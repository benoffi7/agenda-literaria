/**
 * La identidad del sitio: cómo se llama y de qué color es cada cosa — B-245.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El sitio se presentaba como «Agenda literaria», que es **su categoría, no su
 * nombre**. El nombre estaba decidido desde el 2026-08-27 (DEC-6) y no se había
 * usado en ninguna parte: ocho lugares repetían la descripción genérica. Un sitio
 * que se presenta con su categoría no tiene identidad, y esto es la mitad de la
 * causa.
 *
 * La otra mitad es el color. Las tarjetas del listado necesitan **una portada
 * aunque nadie suba una imagen**, y el color de esa portada sale del tipo de
 * actividad: es lo que hace que la grilla se lea de un vistazo y no como una
 * lista de rectángulos iguales.
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

/**
 * El tono de cada tipo de actividad, en OKLCH.
 *
 * ── Por qué es derivable y no una tabla de siete ──────────────────────────
 * `tipo` es una **taxonomía autogestionada** (§4 del `CLAUDE.md`): quien carga
 * puede crear un tipo nuevo desde la casilla «Otro», y ese tipo aparece en los
 * filtros solo. Una tabla de colores escrita a mano queda vieja **el mismo día**
 * que alguien agregue uno, y el modo de falla es silencioso: el tipo nuevo cae en
 * un gris de descarte y sus tarjetas se ven roïdas sin que nada falle.
 *
 * Así que los tipos que existen hoy tienen su tono asignado —para que «taller»
 * sea siempre el mismo color y la gente lo aprenda— y **cualquier otro deriva su
 * tono del slug**. Es determinístico: el mismo slug da siempre el mismo color,
 * en el build y en el cliente, sin guardar nada.
 */
const TONOS: Record<string, number> = {
  taller: 25, // terracota — la familia del acento
  'club-lectura': 250, // azul tinta
  encuentro: 148, // verde botella
  presentacion: 305, // ciruela
  charla: 68, // ocre
  feria: 195, // petróleo
  'libreria-a-la-calle': 12, // ladrillo
};

/**
 * La luminosidad y el croma son fijos para **todos** los tipos, y eso es lo que
 * hace que la grilla se vea de una sola pieza aunque los tonos sean distintos:
 * varía el matiz, no el peso. Y es lo que permite garantizar el contraste de una
 * vez para todos en vez de tono por tono.
 */
const L = 0.42;
const C = 0.105;

/**
 * Un tono estable derivado del slug, para los tipos que no están en la tabla.
 *
 * No es un hash criptográfico ni hace falta: lo único que se le pide es repartir
 * y no cambiar nunca para el mismo texto. Se saltean los tonos ya asignados por
 * un margen para que un tipo nuevo no salga idéntico a «taller».
 */
const tonoDerivado = (slug: string): number => {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % 360;
  const asignados = Object.values(TONOS);
  // Empuja el tono hasta que quede a más de 18° de todos los asignados.
  for (let i = 0; i < 360; i++) {
    const t = (h + i) % 360;
    if (asignados.every((a) => Math.min(Math.abs(t - a), 360 - Math.abs(t - a)) > 18)) return t;
  }
  return h;
};

/** El tono del tipo, asignado si lo tiene y derivado del slug si no. */
export const tonoDeTipo = (slug: string): number => TONOS[slug] ?? tonoDerivado(slug);

/** El color del tipo, listo para `background`. */
export const colorDeTipo = (slug: string): string => `oklch(${L} ${C} ${tonoDeTipo(slug)})`;

/** El mismo color en sRGB, para poder medirle el contraste en los tests. */
export const colorDeTipoSrgb = (slug: string): Srgb => oklchASrgb(L, C, tonoDeTipo(slug));

/** Los tipos con tono propio, para que un test pueda recorrerlos. */
export const TIPOS_CON_TONO = Object.keys(TONOS);

/**
 * ¿El texto claro sobre el color de este tipo pasa AA?
 *
 * Se exporta para que el test lo recorra sobre **todos** los tipos y no sobre una
 * muestra: la portada generada pone el título encima de este color, así que si
 * alguno no pasa, hay una tarjeta ilegible en producción y nada lo dice.
 */
export const contrasteSobreTipo = (slug: string, textoClaro: Srgb): number =>
  contraste(textoClaro, colorDeTipoSrgb(slug));

export { AA_TEXTO };
