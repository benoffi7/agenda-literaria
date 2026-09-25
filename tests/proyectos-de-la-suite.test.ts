/**
 * Los tres proyectos de la suite — PRD 6, M-1.
 *
 * Desde M-1, `vitest.config.ts` reparte la suite en `unidad` y `render`, que
 * corren en paralelo, e `integracion`, que corre en fila porque comparte el
 * emulador. El reparto tiene dos maneras de romperse sin que nada lo diga:
 *
 *  1. **Un archivo que no cae en ningún proyecto no corre**, y la suite da
 *     verde con un archivo menos. Le pasa a un sufijo nuevo que nadie sumó a
 *     un `include`.
 *  2. **Un archivo que usa el emulador y no está en `integracion`** corre en
 *     paralelo con los que vacían la base, y se pisan a mitad de un `it`. Es
 *     la carrera que `fileParallelism: false` tapaba para toda la suite (y la
 *     que B-219 explica). Pasa con cualquier test nuevo que llame a
 *     `limpiarFirestore()` sin el sufijo `.integracion`: dos de los que hay
 *     hoy lo hacen, y por eso `INTEGRACION` los nombra.
 */
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';
import config, { INTEGRACION } from '../vitest.config';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

interface Proyecto {
  test: { name: string; include: string[]; exclude?: string[] };
}

const test = (config as { test: { projects: Proyecto[] } }).test;
const coincide = (patrones: string[]) => (archivo: string): boolean =>
  patrones.some((patron) => matchesGlob(archivo, patron));

const proyectos = test.projects.map(({ test: t }) => ({
  nombre: t.name,
  entra: coincide(t.include),
  // `configDefaults.exclude` trae globs de `node_modules` y demás; ninguno
  // matchea algo de `tests/`, así que no cambia el reparto.
  sale: coincide(t.exclude ?? []),
}));

// El universo es **todo lo que tiene nombre de test**, no lo que dicen los
// `include`: si se mirara solo eso, un sufijo que ningún proyecto incluye
// quedaría también fuera del barrido y el chequeo de abajo no lo vería nunca.
const archivos = archivosDelRepo('tests').filter((f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f));

const proyectosDe = (archivo: string): string[] =>
  proyectos.filter((p) => p.entra(archivo) && !p.sale(archivo)).map((p) => p.nombre);

/**
 * Las llamadas que hablan con el emulador. Son los helpers de
 * `tests/emulador.ts` y de `tests/fixtures/credenciales-del-emulador.ts`: la
 * suite no tiene otra puerta al emulador (B-1060 y B-1130 cierran las copias).
 * Se buscan **llamadas** en líneas de código, no menciones en un comentario.
 */
const USA_EL_EMULADOR =
  /\b(emuladorVivo|emuladorAuthVivo|emuladorStorageVivo|limpiarFirestore|cargarReglas|cargarReglasStorage|sembrarCentinelaDeSlugs|tokenDe|entrarComo)\(/;

const usaElEmulador = (fuente: string): boolean =>
  fuente
    .split('\n')
    .filter((linea) => !/^\s*(\*|\/\/|\/\*)/.test(linea))
    .some((linea) => USA_EL_EMULADOR.test(linea));

describe('el reparto de la suite en proyectos — M-1', () => {
  it('los tres proyectos están, con los nombres que usa el gate', () => {
    // `scripts/verificar-todo.sh` corre `--project unidad --project render` en
    // el paso de zona horaria (M-2): un proyecto renombrado dejaría a ese paso
    // corriendo nada, o a vitest cortando con «No projects matched».
    expect(proyectos.map((p) => p.nombre)).toEqual(['unidad', 'render', 'integracion']);
    expect(readFileSync('scripts/verificar-todo.sh', 'utf8')).toMatch(
      /TZ=Asia\/Tokyo npx vitest run --project unidad --project render/,
    );
  });

  it('el barrido encuentra archivos de verdad, de los tres proyectos', () => {
    // Control positivo: sin esto, un `include` mal leído dejaría pasar todo.
    expect(archivos.length).toBeGreaterThan(250);
    for (const { nombre } of proyectos) {
      expect(archivos.filter((f) => proyectosDe(f).includes(nombre)).length).toBeGreaterThan(5);
    }
  });

  it('cada archivo de la suite cae en exactamente un proyecto', () => {
    const malRepartidos = archivos
      .map((f) => [f, proyectosDe(f)] as const)
      .filter(([, ps]) => ps.length !== 1)
      .map(([f, ps]) => `${f} → [${ps.join(', ') || 'ninguno'}]`);

    expect(malRepartidos, 'estos archivos no corren, o corren dos veces').toEqual([]);
  });

  it('todo archivo que habla con el emulador corre en `integracion`, en fila', () => {
    const sueltos = archivos.filter(
      (f) =>
        usaElEmulador(readFileSync(f, 'utf8')) && !proyectosDe(f).includes('integracion'),
    );

    expect(
      sueltos,
      'estos archivos usan el emulador y corren en paralelo con los que lo vacían: ' +
        'renombralos a `.integracion.test.ts` o sumalos a `INTEGRACION` en vitest.config.ts',
    ).toEqual([]);
  });

  it('`INTEGRACION` no nombra archivos que no usan el emulador', () => {
    // La otra mitad: un archivo de más en la fila no rompe nada, pero es un
    // archivo que paga la espera sin motivo, y la lista deja de decir la
    // verdad. Los que llevan el sufijo quedan afuera de esto: el sufijo es la
    // convención, y alguno puede saltearse entero sin emulador.
    const nombrados = INTEGRACION.filter((patron) => !patron.includes('*'));
    expect(nombrados.length).toBeGreaterThan(0);
    for (const archivo of nombrados) {
      expect(usaElEmulador(readFileSync(archivo, 'utf8')), archivo).toBe(true);
    }
  });

  it('mutación — un archivo nuevo que limpia la base sin el sufijo se marca', () => {
    const falso = 'tests/un-test-nuevo.test.ts';
    expect(proyectosDe(falso)).toEqual(['unidad']);
    // La llamada se arma en partes: escrita entera, este archivo se marcaría solo.
    const llamada = ['limpiarFirestore', '()'].join('');
    expect(usaElEmulador(`beforeEach(async () => {\n  await ${llamada};\n});\n`)).toBe(true);
    // Y nombrarlo en un comentario no alcanza.
    expect(usaElEmulador(` * antes de \`${llamada}\` se siembra…\n`)).toBe(false);
  });
});
