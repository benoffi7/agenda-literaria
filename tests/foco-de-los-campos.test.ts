/**
 * **El foco de un campo se ve** — B-2199 (WCAG 1.4.11 y 2.4.7).
 */
import { describe, expect, it } from 'vitest';
import { claseInput } from '@/components/campos/Campo';
import { AA_GRANDE, contraste, mezclar, oklchASrgb } from '@/lib/contraste';

// `--color-acento` de `global.css`: oklch(0.4931 0.1551 33.47), #a7341c.
const ACENTO = oklchASrgb(0.4931, 0.1551, 33.47);
const BLANCO = [1, 1, 1] as const;

describe('el foco de los campos de formulario — B-2199', () => {
  it('el anillo de foco es `acento` pleno, sin opacidad', () => {
    // Mutación probada: volver a `focus:ring-acento/15` pone esto rojo.
    expect(claseInput).toMatch(/focus:ring-acento(\s|$)/);
    expect(claseInput).not.toMatch(/focus:ring-acento\/\d+/);
  });

  it('y eso llega a 3:1 contra el fondo blanco del campo; el de antes no', () => {
    expect(contraste(ACENTO, BLANCO)).toBeGreaterThanOrEqual(AA_GRANDE);
    // El control: el anillo al 15 % que había, medido igual, no llegaba.
    expect(contraste(mezclar(ACENTO, BLANCO, 0.15), BLANCO)).toBeLessThan(AA_GRANDE);
  });
});
