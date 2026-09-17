/**
 * El helper `archivosDelRepo` — B-964.
 *
 * Este es el único test que crea y borra archivos de verdad en el árbol de
 * trabajo: es la única forma de probar por mutación que el helper ve lo que
 * los ~30 barridos que lo usan necesitan que vea. Los dos casos que importan:
 *
 *  - un archivo **sin rastrear** (todavía sin `git add`) tiene que aparecer
 *    — es exactamente el agujero de B-826/B-964;
 *  - un archivo **ignorado** por `.gitignore` tiene que seguir sin aparecer
 *    — si no, cualquier barrido que use el helper empezaría a mirar
 *    `node_modules` o un `.log`.
 *
 * El tercer test es el control positivo de la mutación: reproduce el
 * `git ls-files` plano que los ~30 barridos tenían antes de B-964 y confirma
 * que ESE sí se pierde el archivo sin rastrear. Es la prueba de que el
 * helper arregla algo real y no una lista vacía que pasa porque no busca
 * nada (§«Tests» de `docs/05-patrones.md`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

const raiz = new URL('..', import.meta.url);
const ruta = (relativo: string) => fileURLToPath(new URL(relativo, raiz));

const PREFIJO = 'tests/fixtures';
// Sin rastrear y no ignorado: tiene que aparecer.
const SIN_RASTREAR = `${PREFIJO}/.mutacion-b964-sin-rastrear-tmp.txt`;
// Sin rastrear pero matchea `*.log` del `.gitignore` (raíz del repo): tiene
// que seguir sin aparecer.
const IGNORADO = `${PREFIJO}/mutacion-b964-ignorado-tmp.log`;

const limpiar = () => {
  for (const relativo of [SIN_RASTREAR, IGNORADO]) {
    const absoluto = ruta(relativo);
    if (existsSync(absoluto)) rmSync(absoluto);
  }
};

describe('archivosDelRepo — B-964', () => {
  afterEach(limpiar);

  it('ve un archivo sin rastrear, todavía sin `git add`', () => {
    writeFileSync(ruta(SIN_RASTREAR), 'contenido de prueba — B-964\n');

    expect(archivosDelRepo(PREFIJO)).toContain(SIN_RASTREAR);
  });

  it('no ve un archivo ignorado por `.gitignore` (`*.log`)', () => {
    writeFileSync(ruta(IGNORADO), 'contenido de prueba — B-964\n');

    expect(archivosDelRepo(PREFIJO)).not.toContain(IGNORADO);
  });

  it('mutación — sin `--others --exclude-standard`, el archivo sin rastrear se pierde', () => {
    writeFileSync(ruta(SIN_RASTREAR), 'contenido de prueba — B-964\n');

    // El `git ls-files` a secas que tenían los ~30 barridos antes de B-964.
    const soloRastreado = execFileSync('git', ['ls-files', '-z', PREFIJO], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);

    expect(soloRastreado).not.toContain(SIN_RASTREAR);
    // Y el helper, con las mismas condiciones de partida, sí lo ve.
    expect(archivosDelRepo(PREFIJO)).toContain(SIN_RASTREAR);
  });
});

/**
 * La guarda contra la copia treinta y uno — B-964.
 *
 * El arreglo de B-964 fue mudar ~30 copias de `execFileSync('git',
 * ['ls-files', ...])` a este helper. Sin nada que lo sostenga, la próxima
 * persona que escriba un barrido nuevo copia el patrón de al lado —que ya no
 * sería `archivosDelRepo`— y la clase vuelve a nacer sola. Este barrido mira
 * `tests/` y `scripts/` buscando exactamente esa forma.
 */
describe('nadie llama a `git ls-files` sin pasar por archivosDelRepo — B-964', () => {
  /**
   * Excepciones, cada una con su motivo — nunca un patrón, porque un patrón
   * («todo lo que no sea archivos-del-repo.ts») dejaría pasar la próxima
   * copia sin que nadie lo decida.
   */
  const EXCEPCIONES: Record<string, string> = {
    'tests/fixtures/archivos-del-repo.ts': 'es la implementación misma',
    'tests/archivos-del-repo.test.ts':
      'reproduce el `ls-files` plano a propósito, como control de la mutación de arriba',
    // Los tres de abajo son de otros frentes de la tanda del 2026-09-17 (ver
    // `.estado/BRIEF-COMUN.md`): quedan fuera de alcance para este frente y
    // migran en una segunda tanda de B-964.
    'tests/clases-de-bug.test.ts': 'frente ajeno — segunda tanda de B-964',
    'tests/sin-comentarios.test.ts': 'frente ajeno — segunda tanda de B-964',
    'scripts/salud-del-codigo.mjs': 'frente ajeno — segunda tanda de B-964',
  };

  const LLAMADA_PLANA = /execFileSync\(\s*['"]git['"]\s*,\s*\[\s*['"]ls-files['"]/;

  it('el barrido encuentra archivos de verdad', () => {
    // Control positivo: sin esto, un `archivosDelRepo` vacío haría pasar todo.
    const candidatos = archivosDelRepo('tests', 'scripts').filter(
      (f) => f.endsWith('.ts') || f.endsWith('.mjs'),
    );
    expect(candidatos.length).toBeGreaterThan(20);
  });

  it('ningún archivo nuevo de `tests/` o `scripts/` llama a `git ls-files` directo', () => {
    const candidatos = archivosDelRepo('tests', 'scripts').filter(
      (f) => f.endsWith('.ts') || f.endsWith('.mjs'),
    );
    const infractores = candidatos.filter(
      (f) => !(f in EXCEPCIONES) && LLAMADA_PLANA.test(readFileSync(ruta(f), 'utf8')),
    );

    expect(
      infractores,
      'estos archivos llaman a `git ls-files` sin pasar por `archivosDelRepo` ' +
        `(tests/fixtures/archivos-del-repo.ts): ${infractores.join(', ') || '(ninguno)'}`,
    ).toEqual([]);
  });
});
