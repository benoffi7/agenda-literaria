/**
 * **El registro de los campos de Instagram contra la tabla de docs/03, y el
 * barrido contra sí mismo** — B-1590, B-1780.
 *
 * El registro vive en `tests/fixtures/campos-de-instagram.ts` y cada salida lo
 * recorre en su propio test (`calendario`, `textoRedes`, `detallePublico`). Acá
 * queda lo que no es de ninguna salida: que el registro sea la tabla, fila por
 * fila, y que el barrido ponga en rojo lo que dice que pone en rojo.
 */
import { describe, expect, it } from 'vitest';

import {
  ARCHIVO_DE_SALIDA,
  CAMPOS_DE_INSTAGRAM,
  barrerSalida,
  filasDeLaTabla,
} from './fixtures/campos-de-instagram';

describe('el registro de campos de Instagram — B-1590, B-1780', () => {
  it('es la tabla de docs/03, fila por fila', () => {
    const filas = filasDeLaTabla();
    // Sin esto el cruce pasaría vacío el día que la tabla cambie de formato o de título.
    expect(filas.length, 'el cruce dejó de encontrar las filas de la tabla').toBeGreaterThanOrEqual(6);
    expect(
      CAMPOS_DE_INSTAGRAM.map((c) => c.fila),
      'el registro y la tabla de docs/03 no tienen las mismas filas: la nueva decide, salida por salida, si sale',
    ).toEqual(filas);
  });

  it('cada fila contesta todas las salidas, y la que no sale dice por qué', () => {
    const salidas = Object.keys(ARCHIVO_DE_SALIDA).sort();
    for (const { fila, salidas: en } of CAMPOS_DE_INSTAGRAM) {
      expect(Object.keys(en).sort(), fila.join(', ')).toEqual(salidas);
      for (const [salida, decision] of Object.entries(en)) {
        if ('porque' in decision) {
          expect(decision.porque.trim().length, `${fila.join(', ')} en ${salida}`).toBeGreaterThan(20);
        } else {
          for (const c of decision.crudo ?? []) {
            expect(c.porque.trim().length, `${fila.join(', ')} en ${salida}`).toBeGreaterThan(20);
          }
        }
      }
    }
  });
});

/**
 * El barrido sobre código chico y escrito a mano: la prueba de que la guarda
 * tiene dientes no depende de que alguien haga la mutación sobre el archivo real.
 */
describe('el barrido pone en rojo lo que dice — B-1780', () => {
  const REDES_SANO = [
    "const destinoLegible = (via, destino) => via === 'dm' ? arrobaInstagram(destino) : (destino ?? '').trim();",
    'const c = [...(actividad.difusion?.arrobar ?? []), arrobaInstagram(actividad.organizador?.instagram), arrobaInstagram(tallerista.instagram)];',
    'const destino = destinoLegible(insc.via, insc.destino);',
  ].join(' ');

  it('el código sano da verde', () => {
    expect(barrerSalida(REDES_SANO, 'redes')).toEqual([]);
  });

  it('un destino crudo, un Instagram sin envolver o un campo nuevo dan rojo nombrando la fila', () => {
    const casos: [string, string][] = [
      ['destinoLegible(insc.via, insc.destino)', 'insc.destino'],
      ['arrobaInstagram(actividad.organizador?.instagram)', 'actividad.organizador?.instagram'],
      ['arrobaInstagram(tallerista.instagram)', 'tallerista?.instagram'],
    ];
    for (const [sano, crudo] of casos) {
      const problemas = barrerSalida(REDES_SANO.replace(sano, crudo), 'redes');
      expect(problemas.join('\n'), crudo).toMatch(/entra crudo a redes/);
    }
    const nuevo = barrerSalida(`${REDES_SANO} const x = libro.autorInstagram;`, 'redes');
    expect(nuevo.join('\n')).toMatch(/libro\.autorInstagram.*el registro no conoce/);
  });

  it('un saneador vaciado adentro da rojo aunque la llamada siga igual', () => {
    const vaciado = REDES_SANO.replace('arrobaInstagram(destino)', 'destino');
    expect(barrerSalida(vaciado, 'redes').join('\n')).toMatch(/falta lo que sanea/);
  });

  it('y un campo que desaparece también: la guarda no pasa vacía', () => {
    expect(barrerSalida('', 'redes').join('\n')).toMatch(/encontró 0 lecturas/);
  });
});
