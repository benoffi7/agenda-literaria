import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, oklchASrgb } from '@/lib/contraste';
import {
  BAJADA,
  NOMBRE,
  NOMBRE_COMPLETO,
  TIPOS_CON_TONO,
  colorDeTipo,
  colorDeTipoSrgb,
  tonoDeTipo,
} from '@/lib/identidad';

/**
 * La identidad del sitio — B-245.
 */
const papel = () => {
  const css = readFileSync(
    fileURLToPath(new URL('../src/styles/global.css', import.meta.url)),
    'utf8',
  );
  const m = css.match(/--color-papel:\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  expect(m, 'no se encontró --color-papel').not.toBeNull();
  return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
};

describe('el nombre del sitio', () => {
  it('el nombre completo se arma del nombre y la bajada', () => {
    // Sin esto, los dos podrían divergir y el `<title>` diría una cosa y el
    // encabezado otra — que es el estado del que se viene.
    expect(NOMBRE_COMPLETO).toContain(NOMBRE);
    expect(NOMBRE_COMPLETO).toContain(BAJADA);
  });

  it('la bajada desarrolla el acrónimo, no lo repite', () => {
    /*
     * «LEH» tiene que poder leerse. La propiedad: las iniciales de la bajada son
     * las letras de la sigla, en orden. Si alguien cambia una de las dos y no la
     * otra, la sigla queda muda y esto lo dice.
     */
    // La sigla es la **palabra** en mayúsculas, no todas las mayúsculas del
    // nombre: «Agenda LEH» tiene una A capital que no es parte de la sigla.
    const sigla = NOMBRE.split(/\s+/).find((p) => /^[A-Z]{2,}$/.test(p));
    expect(sigla, `no se encontró una sigla en «${NOMBRE}»`).toBeDefined();
    const iniciales = BAJADA.split(/[\s,·]+/)
      .filter(Boolean)
      .map((p) => p[0]!.toUpperCase())
      .join('');
    expect(iniciales).toBe(sigla);
  });

  it('no se presenta con su categoría', () => {
    // El estado del que se viene: el sitio se llamaba «Agenda literaria», que es
    // lo que es y no cómo se llama. Un nombre que describe no es un nombre.
    expect(NOMBRE.toLowerCase()).not.toContain('literaria');
  });
});

/**
 * Toda página del sitio se presenta con el nombre — B-245.
 *
 * Es la misma clase de error que hizo nacer este módulo: una página que se titula
 * con su categoría en vez de con su nombre. No rompe nada, se ve bien, y el sitio
 * entero queda sin identidad en la pestaña, en el historial y en Google — que son
 * los tres lugares donde la gente lo vuelve a encontrar.
 *
 * `/admin` **sí** entra: es la pestaña que el dueño tiene abierta todo el día.
 */
describe('el nombre está en el título de cada página', () => {
  const paginas = (): string[] =>
    execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.endsWith('.astro'));

  it('el barrido encuentra páginas', () => {
    expect(paginas().length).toBeGreaterThan(3);
  });

  it('ninguna se presenta sin el nombre', () => {
    const sinNombre = paginas().filter((f) => {
      const src = readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8');
      const m = src.match(/titulo=\{?[`"']([^`"']*)/);
      if (!m) return false; // el título sale de otra parte; lo cubre su propio test
      // Vale la interpolación de `NOMBRE` tanto como el literal.
      return !src.includes('${NOMBRE}') && !m[1]!.includes(NOMBRE);
    });

    expect(
      sinNombre,
      'estas páginas se titulan sin el nombre del sitio: en la pestaña, en el ' +
        'historial y en Google quedan sin identidad.',
    ).toEqual([]);
  });
});

describe('el color de cada tipo de actividad', () => {
  it('los tipos de hoy tienen tono propio y son todos distintos', () => {
    expect(TIPOS_CON_TONO.length).toBeGreaterThanOrEqual(7);
    const tonos = TIPOS_CON_TONO.map(tonoDeTipo);
    expect(new Set(tonos).size, 'dos tipos comparten tono').toBe(tonos.length);
  });

  it('un tipo desconocido igual recibe un tono, y siempre el mismo', () => {
    /*
     * `tipo` es una taxonomía autogestionada (§4): quien carga puede crear uno
     * nuevo desde «Otro». Esta es la propiedad que evita que la tarjeta de ese
     * tipo salga sin color y nadie se entere.
     */
    const a = tonoDeTipo('microrrelato-en-voz-alta');
    const b = tonoDeTipo('microrrelato-en-voz-alta');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });

  it('y no se confunde con el tono de un tipo conocido', () => {
    // Si un tipo nuevo cae encima de «taller», la grilla miente: dos colores
    // iguales para dos cosas distintas.
    for (const slug of ['feria-del-libro-2', 'club', 'taller-de-poesia', 'zzz', 'a']) {
      const t = tonoDeTipo(slug);
      if (TIPOS_CON_TONO.includes(slug)) continue;
      for (const conocido of TIPOS_CON_TONO.map(tonoDeTipo)) {
        const d = Math.min(Math.abs(t - conocido), 360 - Math.abs(t - conocido));
        expect(d, `${slug} cayó a ${d}° de un tono asignado`).toBeGreaterThan(18);
      }
    }
  });

  it('el color sale como oklch válido', () => {
    expect(colorDeTipo('taller')).toMatch(/^oklch\([\d.]+ [\d.]+ [\d.]+\)$/);
  });

  /**
   * **El aserto que importa.** La portada generada pone el título del taller
   * encima de este color, así que un tono que no contraste es una tarjeta
   * ilegible en producción.
   *
   * Y no se verifican los siete tipos de hoy: se verifican **los 360 tonos
   * posibles**, porque el tono de un tipo nuevo lo decide un slug que todavía no
   * existe. Comprobar la muestra dejaría la garantía en «los que ya vimos»; la
   * propiedad real es que la luminosidad y el croma son fijos, y con eso el
   * contraste no depende del matiz.
   */
  it('el texto claro pasa AA sobre CUALQUIER tono posible, no solo los de hoy', () => {
    const claro = papel();
    const flojos: string[] = [];

    for (let h = 0; h < 360; h++) {
      const color = oklchASrgb(0.42, 0.105, h);
      const r = contraste(claro, color);
      if (r < AA_TEXTO) flojos.push(`tono ${h}: ${r.toFixed(2)}:1`);
    }

    expect(
      flojos,
      'hay tonos donde la portada generada queda ilegible. Como el tono de un ' +
        'tipo nuevo se deriva de su slug, esto no se puede arreglar caso por caso: ' +
        'hay que bajar la luminosidad de la banda entera en `identidad.ts`.',
    ).toEqual([]);
  });

  it('y los siete de hoy pasan con margen', () => {
    // Control concreto además del barrido: si el barrido se rompiera y diera
    // lista vacía por otro motivo, esto lo agarra.
    const claro = papel();
    for (const slug of TIPOS_CON_TONO) {
      expect(contraste(claro, colorDeTipoSrgb(slug)), slug).toBeGreaterThan(AA_TEXTO);
    }
  });
});
