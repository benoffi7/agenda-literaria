import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Red contra un error que ya pasó: se commitearon marcadores de conflicto de
 * git en `docs/01-arquitectura.md` y sobrevivieron dos commits, hasta que un
 * merge posterior volvió a marcar esa región por casualidad.
 *
 * Con nueve ramas integrándose sobre los mismos archivos, resolver conflictos
 * a ojo no alcanza. Esto falla antes del commit y no depende de que alguien se
 * acuerde de mirar.
 */
const MARCADORES = [
  '<'.repeat(7) + ' ',
  '='.repeat(7) + '\n',
  '>'.repeat(7) + ' ',
];

const archivosVersionados = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    // Los binarios y el lockfile no se revisan: el lockfile es generado y un
    // binario no tiene conflictos de texto.
    .filter((f) => !/\.(png|jpe?g|gif|webp|ico|woff2?|pdf)$/i.test(f))
    .filter((f) => f !== 'package-lock.json' && f !== 'functions/package-lock.json');

describe('ningún archivo versionado tiene marcadores de conflicto', () => {
  it('el árbol está limpio', () => {
    const sucios: string[] = [];

    for (const archivo of archivosVersionados()) {
      let contenido: string;
      try {
        contenido = readFileSync(archivo, 'utf8');
      } catch {
        continue; // borrado o ilegible: no es asunto de este test
      }
      // Este archivo contiene los marcadores como dato, obviamente.
      if (archivo.endsWith('sin-marcadores-de-conflicto.test.ts')) continue;

      for (const marcador of MARCADORES) {
        if (contenido.includes(marcador)) {
          const linea = contenido.split('\n').findIndex((l) => l.startsWith(marcador.trim()));
          sucios.push(`${archivo}:${linea + 1}`);
          break;
        }
      }
    }

    expect(sucios).toEqual([]);
  });
});
