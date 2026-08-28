/**
 * El contraste del sitio público, **calculado y no estimado** — B-227.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El §10 del diseño dejaba una pregunta abierta —«el acento sobre papel hay que
 * medirlo antes de usarlo en texto chico»— y la primera versión de este frente la
 * contestó de la peor manera: usándolo sin medir, y de paso poniendo texto en
 * `tinta/45`, `/50`, `/55` y `/60`, que sobre papel dan **2,86 · 3,30 · 3,84 ·
 * 4,49**. Los cuatro por debajo del 4,5 que pide AA para texto normal, y el
 * primero por debajo del 3 que pide para texto grande.
 *
 * Nada lo iba a decir: el contraste no rompe ningún build y no se ve mal a simple
 * vista en una pantalla buena. Por eso se calcula acá.
 *
 * ── Las dos mitades, y las dos hacen falta ────────────────────────────────
 * 1. **Los ratios de la paleta**, calculados desde los tokens de `global.css`. Si
 *    alguien oscurece el papel o aclara el acento, esto se pone rojo.
 * 2. **Que ningún componente use una clase por debajo del piso.** Sin esto, la
 *    paleta puede estar perfecta y el componente siguiente escribir
 *    `text-tinta/45` igual — que es exactamente lo que había pasado.
 *
 * Es la diferencia entre verificar la instancia y verificar la clase
 * (`docs/05-patrones.md`).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ───────────────────────────────────────────────────────────────────────────
// OKLCH → sRGB → luminancia relativa → ratio de contraste (WCAG 2.1)
// ───────────────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

/** OKLCH a sRGB lineal-a-gamma, con la matriz de la especificación de CSS Color 4. */
const oklch = (L: number, C: number, H: number): Rgb => {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lineal = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  return lineal.map((v) => Math.min(1, Math.max(0, gamma(v)))) as Rgb;
};

const luminancia = ([r, g, b]: Rgb): number => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

export const contraste = (a: Rgb, b: Rgb): number => {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alta! + 0.05) / (baja! + 0.05);
};

/** Un color con opacidad, compuesto sobre su fondo. Es lo que hace `text-tinta/65`. */
const sobre = (fg: Rgb, bg: Rgb, alfa: number): Rgb =>
  fg.map((v, i) => v * alfa + bg[i]! * (1 - alfa)) as Rgb;

// ───────────────────────────────────────────────────────────────────────────
// Los tokens, leídos de `global.css` y no copiados
// ───────────────────────────────────────────────────────────────────────────

/**
 * Se parsean del CSS a propósito: si estuvieran escritos acá, cambiar la paleta
 * dejaría este archivo midiendo colores que ya no existen y dando verde.
 */
const tokenOklch = (nombre: string): Rgb => {
  const css = readFileSync('src/styles/global.css', 'utf8');
  const m = new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(css);
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return oklch(Number(m![1]), Number(m![2]), Number(m![3]));
};

const PAPEL = tokenOklch('papel');
const TINTA = tokenOklch('tinta');
const ACENTO = tokenOklch('acento');

/** AA para texto normal. El umbral de texto grande (3) no se usa acá. */
const AA = 4.5;

/**
 * La opacidad más baja de `tinta` que todavía pasa AA sobre papel.
 *
 * `tinta/60` da 4,49 — a una centésima. No se redondea para arriba: la fórmula de
 * WCAG no tiene margen y la pantalla de quien lee no es la nuestra.
 */
export const PISO_OPACIDAD = 65;

describe('la paleta pasa AA (§10 del diseño)', () => {
  it('control positivo: los tokens se parsearon y no son todos negros', () => {
    // Sin esto, un parseo roto devolvería tres colores iguales y todos los ratios
    // darían 1 — o peor, tres blancos y todo pasaría.
    expect(new Set([PAPEL, TINTA, ACENTO].map(String)).size).toBe(3);
  });

  it('tinta sobre papel: cómodo', () => {
    expect(contraste(TINTA, PAPEL)).toBeGreaterThan(15);
  });

  it('acento sobre papel: pasa, y por eso se puede usar en texto chico', () => {
    /*
     * Es la pregunta que el §10 dejaba abierta. La respuesta es 5,63 — pasa AA y
     * no llega a AAA (7), así que sirve para «Ya empezó», «Cupo completo» y los
     * links, que es donde se usa.
     */
    expect(contraste(ACENTO, PAPEL)).toBeGreaterThanOrEqual(AA);
  });

  it('papel sobre acento: el botón de inscripción también', () => {
    // El CTA es texto claro sobre el acento, o sea el ratio al revés — que da lo
    // mismo, pero conviene afirmarlo y no deducirlo.
    expect(contraste(PAPEL, ACENTO)).toBeGreaterThanOrEqual(AA);
  });
});

describe('la rampa de opacidad de tinta', () => {
  it(`el piso es tinta/${PISO_OPACIDAD}: ahí pasa`, () => {
    expect(contraste(sobre(TINTA, PAPEL, PISO_OPACIDAD / 100), PAPEL)).toBeGreaterThanOrEqual(AA);
  });

  it('y un escalón más abajo NO pasa, que es por qué el piso está donde está', () => {
    /*
     * El control negativo. Sin esto, el piso podría estar puesto en 90 «por las
     * dudas» y el test seguiría verde sin decir nada útil — o bajarse a 55 sin que
     * nadie note que dejó de significar algo.
     */
    expect(contraste(sobre(TINTA, PAPEL, (PISO_OPACIDAD - 5) / 100), PAPEL)).toBeLessThan(AA);
  });
});

describe('ningún componente del sitio público baja del piso', () => {
  /**
   * La segunda mitad: la paleta puede estar perfecta y el componente siguiente
   * escribir `text-tinta/45` igual. Es lo que había pasado — 35 usos repartidos en
   * seis archivos, todos por debajo de AA.
   *
   * Se mira solo el **sitio público**: el panel es otra audiencia (se usa con
   * sesión, en una pantalla elegida) y tiene su propia deuda, que no es de este
   * cambio.
   */
  const RAICES = ['src/components/publico', 'src/pages/index.astro', 'src/pages/actividad'];

  const archivos = (() => {
    const encontrados: string[] = [];
    const recorrer = (ruta: string) => {
      if (statSync(ruta).isDirectory()) {
        for (const e of readdirSync(ruta)) recorrer(join(ruta, e));
      } else if (/\.(tsx?|astro)$/.test(ruta)) {
        encontrados.push(ruta);
      }
    };
    for (const r of RAICES) recorrer(r);
    return encontrados;
  })();

  it('control positivo: encontró los archivos del sitio', () => {
    expect(archivos.length).toBeGreaterThanOrEqual(5);
  });

  it(`no hay ninguna clase de texto por debajo de tinta/${PISO_OPACIDAD}`, () => {
    const flojos: string[] = [];
    for (const archivo of archivos) {
      const src = readFileSync(archivo, 'utf8');
      for (const m of src.matchAll(/text-tinta\/(\d+)/g)) {
        const nivel = Number(m[1]);
        if (nivel < PISO_OPACIDAD) flojos.push(`${archivo}: text-tinta/${nivel}`);
      }
    }
    expect(
      flojos,
      `estas clases no llegan a 4,5:1 sobre papel, que es el mínimo de AA para texto ` +
        `normal. El piso es text-tinta/${PISO_OPACIDAD}`,
    ).toEqual([]);
  });
});
