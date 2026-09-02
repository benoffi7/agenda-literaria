/**
 * `scripts/wip.sh` — la alternativa a `git stash` que no se lleva puesto el
 * trabajo de otro worktree — B-236.
 *
 * Corre contra un repo git **temporal y descartable**, nunca contra este
 * repo: `guardar`/`restaurar` hacen commits y resets de verdad, y probarlos
 * contra el checkout real sería el mismo tipo de accidente que el ítem existe
 * para evitar.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const WIP_SH = fileURLToPath(new URL('../scripts/wip.sh', import.meta.url));

const repos: string[] = [];

/** Un repo git de mentira, con un commit inicial y el usuario configurado. */
const repoNuevo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'wip-sh-'));
  repos.push(dir);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  writeFileSync(join(dir, 'archivo.txt'), 'original\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'commit inicial');
  return dir;
};

const correr = (dir: string, ...args: string[]) =>
  execFileSync(WIP_SH, args, { cwd: dir, encoding: 'utf8' });

const correrFalla = (dir: string, ...args: string[]): { status: number; stderr: string } => {
  try {
    execFileSync(WIP_SH, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    throw new Error('se esperaba que fallara y no falló');
  } catch (e) {
    const err = e as { status: number; stderr: string };
    return { status: err.status, stderr: err.stderr };
  }
};

const log1 = (dir: string) =>
  execFileSync('git', ['log', '-1', '--format=%s'], { cwd: dir, encoding: 'utf8' }).trim();

const sinCommitear = (dir: string): boolean => {
  const salida = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
  return salida.trim().length === 0;
};

afterEach(() => {
  while (repos.length) rmSync(repos.pop()!, { recursive: true, force: true });
});

describe('scripts/wip.sh guardar — B-236', () => {
  it('con el árbol sucio, lo commitea entero (staged y no) y lo deja limpio', () => {
    const dir = repoNuevo();
    writeFileSync(join(dir, 'archivo.txt'), 'modificado\n');
    writeFileSync(join(dir, 'nuevo.txt'), 'un archivo nuevo\n');

    correr(dir, 'guardar');

    expect(sinCommitear(dir)).toBe(true);
    expect(log1(dir)).toMatch(/^wip: guardado por scripts\/wip\.sh —/);
    expect(readFileSync(join(dir, 'archivo.txt'), 'utf8')).toBe('modificado\n');
    expect(existsSync(join(dir, 'nuevo.txt'))).toBe(true);
  });

  it('con el árbol limpio, no hace nada y avisa', () => {
    const dir = repoNuevo();
    const antes = log1(dir);
    const { status, stderr } = correrFalla(dir, 'guardar');
    expect(status).toBe(1);
    expect(stderr).toMatch(/árbol ya está limpio/);
    expect(log1(dir)).toBe(antes); // no agregó ningún commit
  });
});

describe('scripts/wip.sh restaurar — B-236', () => {
  it('deshace el commit WIP y los cambios vuelven al árbol', () => {
    const dir = repoNuevo();
    writeFileSync(join(dir, 'archivo.txt'), 'modificado\n');
    correr(dir, 'guardar');

    correr(dir, 'restaurar');

    expect(sinCommitear(dir)).toBe(false); // el cambio volvió a estar sin commitear
    expect(readFileSync(join(dir, 'archivo.txt'), 'utf8')).toBe('modificado\n');
  });

  it('SE NIEGA si el HEAD no es un commit de este script — no es un reset a ciegas', () => {
    // El caso real que hace falta cubrir: alguien corre `restaurar` sin haber
    // corrido `guardar` antes (o después de un commit real de otra persona en
    // el medio), y el script no puede deshacer lo que no guardó él.
    const dir = repoNuevo();
    const antes = log1(dir);
    const { status, stderr } = correrFalla(dir, 'restaurar');
    expect(status).toBe(1);
    expect(stderr).toMatch(/no es un WIP de este script/);
    expect(log1(dir)).toBe(antes); // no tocó el commit real
  });

  it('el mensaje de un commit real que EMPIECE parecido no engaña al chequeo', () => {
    // Control: el chequeo compara el prefijo completo, no una subcadena
    // suelta. Un commit real que mencione "wip" de pasada no tiene que activar
    // `restaurar`.
    const dir = repoNuevo();
    execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'wip: revisar el flujo de carga'], {
      cwd: dir,
    });
    const { status } = correrFalla(dir, 'restaurar');
    expect(status).toBe(1);
  });
});

describe('scripts/wip.sh — la interfaz', () => {
  it('sin subcomando, o con uno que no existe, falla con el uso', () => {
    const dir = repoNuevo();
    expect(correrFalla(dir).status).toBe(2);
    expect(correrFalla(dir, 'lo-que-sea').status).toBe(2);
  });
});
