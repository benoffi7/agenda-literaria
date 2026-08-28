import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, luminancia, mezclar, oklchASrgb } from '@/lib/contraste';

/**
 * La matemática de color, contra valores conocidos — B-235.
 *
 * Un módulo de contraste que se testea contra sí mismo no verifica nada: sería
 * la misma fórmula dos veces. Así que se ancla en valores que **no** salen de
 * este código — los de la especificación de WCAG y los extremos, que son los
 * únicos que uno puede afirmar sin calcular.
 */
const NEGRO = [0, 0, 0] as const;
const BLANCO = [1, 1, 1] as const;

describe('la matemática de contraste — B-235', () => {
  it('los extremos dan los números de la especificación', () => {
    // 21:1 es el máximo posible en WCAG y sale de la propia fórmula: (1+0.05)/(0+0.05).
    expect(contraste(NEGRO, BLANCO)).toBeCloseTo(21, 5);
    expect(contraste(BLANCO, BLANCO)).toBeCloseTo(1, 5);
    // Y es simétrico: el orden de los argumentos no cambia el resultado.
    expect(contraste(NEGRO, BLANCO)).toBeCloseTo(contraste(BLANCO, NEGRO), 10);
  });

  it('la luminancia de los extremos es 0 y 1', () => {
    expect(luminancia(NEGRO)).toBeCloseTo(0, 10);
    expect(luminancia(BLANCO)).toBeCloseTo(1, 10);
  });

  it('OKLCH sin croma es gris, y L=0 y L=1 son negro y blanco', () => {
    // Sin croma los tres canales tienen que salir iguales: si la conversión
    // estuviera mal, un gris saldría teñido y nadie lo notaría en un número.
    const [r, g, b] = oklchASrgb(0.5, 0, 0);
    expect(g).toBeCloseTo(r, 6);
    expect(b).toBeCloseTo(r, 6);

    expect(oklchASrgb(0, 0, 0).every((c) => c === 0)).toBe(true);
    expect(oklchASrgb(1, 0, 0).every((c) => Math.abs(c - 1) < 1e-6)).toBe(true);
  });

  it('mezclar con opacidad 1 y 0 devuelve los extremos', () => {
    expect(mezclar(NEGRO, BLANCO, 1)).toEqual([0, 0, 0]);
    expect(mezclar(NEGRO, BLANCO, 0)).toEqual([1, 1, 1]);
  });

  it('atenuar sobre un fondo claro siempre baja el contraste', () => {
    /*
     * La propiedad que hace útil al módulo, y la que un error de signo rompería:
     * cuanta menos opacidad, menos contraste. Monótona, sin excepciones.
     */
    const tinta = oklchASrgb(0.22, 0.015, 265);
    const papel = oklchASrgb(0.985, 0.005, 85);

    const ratios = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((op) =>
      contraste(mezclar(tinta, papel, op), papel),
    );
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]!, `opacidad ${i} no subió el contraste`).toBeGreaterThan(ratios[i - 1]!);
    }
  });

  it('AA_TEXTO es el 4,5 de la norma', () => {
    expect(AA_TEXTO).toBe(4.5);
  });
});

/**
 * El acento sobre el papel, en las dos direcciones — viene del frente del listado,
 * que llegó a la misma necesidad por otro camino y midió algo que este archivo no
 * miraba.
 *
 * El §10 del diseño dejaba la pregunta abierta —«el acento sobre papel hay que
 * medirlo antes de usarlo en texto chico»— y de eso depende algo concreto: si no
 * pasa, el acento sirve para bordes y no para un link. Y el botón de inscripción
 * es el ratio **al revés**, papel sobre acento, que no es el mismo cálculo aunque
 * lo parezca: la fórmula de WCAG es simétrica, pero **cuál de los dos es el fondo
 * decide la mezcla** en cuanto aparece una opacidad.
 */
describe('el acento de la paleta — B-227', () => {
  const paleta = () => {
    const css = readFileSync(
      fileURLToPath(new URL('../src/styles/global.css', import.meta.url)),
      'utf8',
    );
    const token = (nombre: string) => {
      const m = css.match(
        new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
      );
      expect(m, `no se encontró --color-${nombre}`).not.toBeNull();
      return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
    };
    return { acento: token('acento'), papel: token('papel') };
  };

  it('los tokens se parsearon y no son el mismo color', () => {
    // Control positivo: dos parseos fallidos darían negro sobre negro, o sea 1:1,
    // y el test de abajo fallaría por el motivo equivocado.
    const { acento, papel } = paleta();
    expect(contraste(acento, papel)).toBeGreaterThan(1.5);
  });

  it('acento sobre papel pasa AA, y por eso se puede usar en texto chico', () => {
    const { acento, papel } = paleta();
    expect(contraste(acento, papel)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('papel sobre acento también — es el botón de inscripción', () => {
    const { acento, papel } = paleta();
    expect(contraste(papel, acento)).toBeGreaterThanOrEqual(AA_TEXTO);
  });
});
