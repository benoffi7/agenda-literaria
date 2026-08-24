import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SELECTOR_ENFOCABLE,
  indiceDeTab,
  indiceDeTecla,
  indiceSiguiente,
} from '@/lib/foco';

/**
 * B-14 y B-64 — la aritmética del foco.
 *
 * Los dos ítems eran la misma clase vista en dos pantallas: un patrón de teclado
 * a medio hacer (cierra con `Escape`, se alcanza con Tab, y nada más) en el menú
 * "⋯" del listado y en la capa del centro de ayuda. Por eso hay una sola
 * implementación y este archivo la cubre una vez.
 */

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

describe('el índice siguiente da la vuelta', () => {
  it('avanza y vuelve al principio', () => {
    expect(indiceSiguiente(0, 3, 1)).toBe(1);
    expect(indiceSiguiente(2, 3, 1)).toBe(0);
  });

  it('retrocede y vuelve al final', () => {
    expect(indiceSiguiente(0, 3, -1)).toBe(2);
    expect(indiceSiguiente(1, 3, -1)).toBe(0);
  });

  it('desde «ninguno» (-1) cae en el primero o en el último', () => {
    // Es lo que hace que abrir el menú con ↓ caiga en el primero y con ↑ en el
    // último, sin ningún caso especial en el componente.
    expect(indiceSiguiente(-1, 3, 1)).toBe(0);
    expect(indiceSiguiente(-1, 3, -1)).toBe(2);
  });

  it('con un solo ítem se queda ahí, no se va a -1', () => {
    expect(indiceSiguiente(0, 1, 1)).toBe(0);
    expect(indiceSiguiente(0, 1, -1)).toBe(0);
  });

  it('sin ítems no hay dónde poner el foco', () => {
    expect(indiceSiguiente(0, 0, 1)).toBe(-1);
  });
});

describe('qué tecla mueve a dónde en un menú', () => {
  it('las flechas mueven de a uno', () => {
    expect(indiceDeTecla('ArrowDown', 0, 3)).toBe(1);
    expect(indiceDeTecla('ArrowUp', 0, 3)).toBe(2);
  });

  it('Home y End van a los extremos', () => {
    expect(indiceDeTecla('Home', 2, 3)).toBe(0);
    expect(indiceDeTecla('End', 0, 3)).toBe(2);
  });

  it('una tecla que no es de navegación devuelve null', () => {
    // `null` y no el índice actual: es lo que le dice al componente que NO
    // llame a preventDefault(), así Tab, Escape y las letras siguen andando.
    for (const tecla of ['Tab', 'Escape', 'Enter', 'a', 'ArrowLeft']) {
      expect(indiceDeTecla(tecla, 0, 3)).toBeNull();
    }
  });

  it('un menú vacío no navega a ninguna parte', () => {
    expect(indiceDeTecla('ArrowDown', -1, 0)).toBeNull();
  });
});

describe('el ciclo de Tab de una capa', () => {
  it('desde el último Tab vuelve al primero, y Shift+Tab al revés', () => {
    expect(indiceDeTab(2, 3, false)).toBe(0);
    expect(indiceDeTab(0, 3, true)).toBe(2);
  });

  it('con el foco en la caja del diálogo entra por el extremo que corresponde', () => {
    expect(indiceDeTab(-1, 3, false)).toBe(0);
    expect(indiceDeTab(-1, 3, true)).toBe(2);
  });

  it('el selector no toma tabindex="-1": es enfocable por programa, no una parada de Tab', () => {
    // La caja del diálogo tiene tabindex={-1} para recibir el foco al abrirse.
    // Si entrara al ciclo, Tab pasaría por el contenedor y no por sus controles.
    expect(SELECTOR_ENFOCABLE).toContain('[tabindex]:not([tabindex="-1"])');
  });
});

describe('las dos pantallas usan la misma implementación (B-14, B-64)', () => {
  it('el menú del listado navega con teclas y devuelve el foco al disparador', () => {
    const src = fuente('components/admin/MenuAcciones.tsx');
    expect(src).toContain("from '@/lib/foco'");
    expect(src).toContain('indiceDeTecla');
    // Sin esto, cerrar con Escape obliga a re-tabular el listado entero.
    expect(src).toContain('disparador.current?.focus()');
  });

  it('la capa de ayuda atrapa el Tab y devuelve el foco al cerrarse', () => {
    const src = fuente('components/admin/ayuda/CentroAyuda.tsx');
    expect(src).toContain("from '@/lib/foco'");
    expect(src).toContain('SELECTOR_ENFOCABLE');
    expect(src).toContain('anterior?.focus()');
  });

  it('ninguna de las dos tiene su propia copia del cálculo', () => {
    // La clase que se cerró es «el mismo patrón de teclado a medio hacer en dos
    // lugares»: una copia local del módulo la reabre.
    for (const rel of ['components/admin/MenuAcciones.tsx', 'components/admin/ayuda/CentroAyuda.tsx']) {
      expect(fuente(rel)).not.toMatch(/%\s*enfocables\.length|%\s*acciones\.length/);
    }
  });
});
