/**
 * Contraste WCAG entre dos colores, y la mezcla que produce una opacidad — B-235.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El sitio atenúa texto con `text-tinta/NN`, que es `--color-tinta` compuesto
 * sobre `--color-papel`. La pregunta «¿esta opacidad pasa AA?» no se puede
 * contestar mirando: `text-tinta/60` da **4,49:1** contra un piso de 4,5 y se ve
 * perfectamente bien. Cuatro centésimas no se ven; se calculan.
 *
 * Así que se calculan, y `tests/contraste-del-sitio.test.ts` recorre el markup
 * del sitio con esto. **Lo importante es que los colores se leen de
 * `global.css`, no se copian acá**: si mañana se aclara la tinta o se oscurece el
 * papel, el chequeo se entera. Un piso de opacidad escrito a mano —«nunca menos
 * de /65»— quedaría mintiendo con la primera paleta nueva, que es justo el modo
 * de falla que este repo persigue.
 *
 * La conversión de OKLCH sale de la especificación de CSS Color 4; se testea
 * contra valores conocidos en `tests/contraste.test.ts`.
 */

/** Un color en sRGB, con cada canal de 0 a 1 tal como sale de la pantalla. */
export type Srgb = readonly [number, number, number];

const acotar = (x: number): number => Math.max(0, Math.min(1, x));

/** OKLCH → sRGB con gamma aplicada. `L` de 0 a 1, `C` de 0 a ~0,4, `H` en grados. */
export const oklchASrgb = (L: number, C: number, H: number): Srgb => {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  // OKLab → LMS cúbico → sRGB lineal.
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lineal = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const gamma = (x: number): number => {
    const v = acotar(x);
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };

  return [gamma(lineal[0]!), gamma(lineal[1]!), gamma(lineal[2]!)] as const;
};

/** Luminancia relativa de WCAG 2.x. */
export const luminancia = (c: Srgb): number => {
  const lineal = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lineal(c[0]) + 0.7152 * lineal(c[1]) + 0.0722 * lineal(c[2]);
};

/** El cociente de contraste de WCAG, siempre ≥ 1 y en el orden que dé. */
export const contraste = (a: Srgb, b: Srgb): number => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (oscuro! + 0.05);
};

/**
 * El color que resulta de pintar `frente` con `opacidad` sobre `fondo`.
 *
 * **La mezcla va en sRGB con gamma, no en lineal**, porque es lo que hace el
 * navegador al componer un `color-mix` de Tailwind: calcularlo «bien» en espacio
 * lineal daría un número más lindo y una respuesta equivocada sobre lo que la
 * persona ve.
 */
export const mezclar = (frente: Srgb, fondo: Srgb, opacidad: number): Srgb =>
  [0, 1, 2].map((i) => frente[i]! * opacidad + fondo[i]! * (1 - opacidad)) as unknown as Srgb;

/** El piso de WCAG AA para texto normal. */
export const AA_TEXTO = 4.5;

/** El piso de AA para texto grande (≥24px, o ≥18,66px en negrita) y para gráficos. */
export const AA_GRANDE = 3;
