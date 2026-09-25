/**
 * El helper `archivosDelRepo` — B-964.
 *
 * Se prueba por mutación: es la única forma de confirmar que el helper ve lo
 * que los ~30 barridos que lo usan necesitan que vea. Los dos casos que
 * importan:
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
 *
 * **Las mutaciones van a un repo de juguete en `os.tmpdir()`** — B-1962. Antes
 * se escribían adentro de `tests/fixtures/`, y con los archivos en paralelo
 * (PRD 6, M-1) los barridos que recorren el árbol las encontraban a medio
 * borrar y morían con `ENOENT`. El repo de juguete lleva el `.gitignore` del
 * repo real, así que «ignorado» sigue queriendo decir lo mismo; y el helper
 * que se ejercita es el mismo, con otro `cwd` (`archivosDelRepoEn`).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { archivosDelRepo, archivosDelRepoEn } from './fixtures/archivos-del-repo';

const raiz = new URL('..', import.meta.url);
const ruta = (relativo: string) => fileURLToPath(new URL(relativo, raiz));

const PREFIJO = 'tests/fixtures';
// Rastreado: el control de que el `ls-files` plano del repo de juguete ve algo.
const RASTREADO = `${PREFIJO}/rastreado.txt`;
// Sin rastrear y no ignorado: tiene que aparecer.
const SIN_RASTREAR = `${PREFIJO}/.mutacion-b964-sin-rastrear-tmp.txt`;
// Sin rastrear pero matchea `*.log` del `.gitignore` (raíz del repo): tiene
// que seguir sin aparecer.
const IGNORADO = `${PREFIJO}/mutacion-b964-ignorado-tmp.log`;

describe('archivosDelRepo — B-964', () => {
  let juguete = '';
  const escribir = (relativo: string) =>
    writeFileSync(join(juguete, relativo), 'contenido de prueba — B-964\n');

  beforeEach(() => {
    juguete = mkdtempSync(join(tmpdir(), 'archivos-del-repo-'));
    execFileSync('git', ['init', '-q'], { cwd: juguete });
    copyFileSync(ruta('.gitignore'), join(juguete, '.gitignore'));
    mkdirSync(join(juguete, PREFIJO), { recursive: true });
    escribir(RASTREADO);
    execFileSync('git', ['add', RASTREADO], { cwd: juguete });
  });
  afterEach(() => rmSync(juguete, { recursive: true, force: true }));

  it('ve un archivo sin rastrear, todavía sin `git add`', () => {
    escribir(SIN_RASTREAR);

    expect(archivosDelRepoEn(juguete, PREFIJO)).toContain(SIN_RASTREAR);
  });

  it('no ve un archivo ignorado por `.gitignore` (`*.log`)', () => {
    escribir(IGNORADO);

    expect(archivosDelRepoEn(juguete, PREFIJO)).not.toContain(IGNORADO);
  });

  it('mutación — sin `--others --exclude-standard`, el archivo sin rastrear se pierde', () => {
    escribir(SIN_RASTREAR);

    // El `git ls-files` a secas que tenían los ~30 barridos antes de B-964.
    const soloRastreado = execFileSync('git', ['ls-files', '-z', PREFIJO], {
      encoding: 'utf8',
      cwd: juguete,
    })
      .split('\0')
      .filter(Boolean);

    // Control: el plano ve lo rastreado, así que no es una lista vacía.
    expect(soloRastreado).toContain(RASTREADO);
    expect(soloRastreado).not.toContain(SIN_RASTREAR);
    // Y el helper, con las mismas condiciones de partida, sí lo ve.
    expect(archivosDelRepoEn(juguete, PREFIJO)).toContain(SIN_RASTREAR);
  });

  it('`archivosDelRepo` es `archivosDelRepoEn` sobre el repo de la corrida', () => {
    // Sin esto, la fachada podría apuntar a otro lado y las mutaciones de
    // arriba estarían probando una función que ningún barrido usa.
    expect(archivosDelRepo(PREFIJO)).toEqual(archivosDelRepoEn(undefined, PREFIJO));
    expect(archivosDelRepo(PREFIJO)).toContain('tests/fixtures/archivos-del-repo.ts');
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
