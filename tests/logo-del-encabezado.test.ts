/**
 * **El logo del encabezado pesa lo que se ve** — B-2201.
 *
 * Va en todas las páginas a 32-40 px; hasta B-2201 era el PNG de 512 (91 KB),
 * más que las tres fuentes precargadas juntas.
 */
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('el logo del encabezado — B-2201', () => {
  it('apunta a un archivo que existe y pesa menos de 10 KB', () => {
    // Mutación probada: volver a `/marca-512.png` lo pone rojo.
    const src = readFileSync('src/components/sitio/Encabezado.astro', 'utf8');
    const ruta = src.match(/<img\s+src="(\/marca-[^"]+)"/)?.[1];
    expect(ruta).toBeTruthy();
    expect(statSync(`public${ruta}`).size).toBeLessThan(10_000);
  });
});
