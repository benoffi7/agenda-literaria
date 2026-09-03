import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Contra qué commit diffear un push a `main` — B-205.
 *
 * **El bug, reproducido el 2026-08-26 y no supuesto.** `github.event.before` es
 * el head del push ANTERIOR. Si esa corrida no llegó a deployar nada (falló al
 * arrancar, se canceló, GitHub Actions tuvo un `major_outage` — pasó, y a mitad
 * del push de la `1.2.0`), el push siguiente diffea desde un commit que ya
 * está en `main` pero nunca se publicó. Esos cambios quedan fuera del diff
 * **para siempre**, y `que-deployar.sh` decide sobre una lista incompleta sin
 * decir nada: el síntoma es "nada que deployar" cuando en realidad hay un
 * commit entero sin publicar.
 *
 * **El arreglo:** preferir lo que `/version.json` dice que está PUBLICADO
 * (`INFO_VERSION.sha`) sobre el `before` del push. Solo se cae al `before`
 * cuando esa fuente no sirve — el sitio no contesta, no trae `sha`, o el
 * commit no está en este historial (clon superficial, sitio nunca deployado).
 *
 * **Cómo se prueba sin pegarle al sitio real.** La decisión solo lee una URL,
 * así que alcanza un servidor HTTP de mentira apuntado con `VERSION_JSON_URL`
 * — la misma idea que `tests/emuladores-arriba.test.ts` con
 * `FIREBASE_EMULATOR_HUB`. Los commits "válidos" son de este mismo repo
 * (HEAD real), así que el `git cat-file -e` que hace el script no es un
 * mock: es la verificación real contra el historial del checkout donde
 * corre el test.
 */
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const correr = promisify(execFile);

const HEAD = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
  cwd: RAIZ,
  encoding: 'utf8',
}).trim();

// No es un mock de "commit inexistente": son siete hex que casi con certeza no
// nombran ningún objeto de este repo, así que `git cat-file -e` falla de
// verdad, igual que fallaría contra un commit que el fetch superficial nunca
// trajo.
const SHA_INEXISTENTE = 'deadbee';

const decidir = async (
  entorno: Record<string, string> = {},
): Promise<string> => {
  const { stdout } = await correr('./scripts/commit-base-deploy.sh', [], {
    cwd: RAIZ,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', ...entorno },
  });
  const linea = stdout.trim();
  const i = linea.indexOf('=');
  return linea.slice(i + 1);
};

/** Un servidor que contesta el `version.json` de mentira que le pidamos. */
const servidorVersion = async (
  cuerpo: string | null,
  status = 200,
): Promise<{ url: string; cerrar: () => void }> => {
  const s: Server = createServer((_req, res) => {
    if (cuerpo === null) {
      res.writeHead(status);
      res.end();
      return;
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(cuerpo);
  });
  await new Promise<void>((listo) => s.listen(0, '127.0.0.1', listo));
  const dir = s.address();
  if (typeof dir === 'string' || dir === null) throw new Error('el servidor no dio puerto');
  return { url: `http://127.0.0.1:${dir.port}/version.json`, cerrar: () => s.close() };
};

const abiertos: (() => void)[] = [];
afterAll(() => abiertos.forEach((cerrar) => cerrar()));

describe('contra qué commit diffear un deploy — B-205', () => {
  it('con /version.json publicando un commit real, diffea contra ESE, no contra el before', async () => {
    const { url, cerrar } = await servidorVersion(JSON.stringify({ sha: HEAD }));
    abiertos.push(cerrar);
    const antes = await decidir({
      VERSION_JSON_URL: url,
      EVENT_BEFORE: SHA_INEXISTENTE, // si esto ganara, se notaría
    });
    expect(antes).toBe(HEAD);
  });

  it('si el sha publicado no está en este historial, cae al before', async () => {
    const { url, cerrar } = await servidorVersion(JSON.stringify({ sha: SHA_INEXISTENTE }));
    abiertos.push(cerrar);
    const antes = await decidir({ VERSION_JSON_URL: url, EVENT_BEFORE: HEAD });
    expect(antes).toBe(HEAD);
  });

  it('si /version.json no trae "sha", cae al before', async () => {
    const { url, cerrar } = await servidorVersion(JSON.stringify({ version: '1.2.0' }));
    abiertos.push(cerrar);
    const antes = await decidir({ VERSION_JSON_URL: url, EVENT_BEFORE: HEAD });
    expect(antes).toBe(HEAD);
  });

  it('si el sitio contesta un error de servidor, cae al before', async () => {
    const { url, cerrar } = await servidorVersion(null, 503);
    abiertos.push(cerrar);
    const antes = await decidir({ VERSION_JSON_URL: url, EVENT_BEFORE: HEAD });
    expect(antes).toBe(HEAD);
  });

  it('si el sitio no contesta nada, cae al before', async () => {
    // Puerto 1: reservado y nadie lo escucha, así que el connect falla al toque.
    const antes = await decidir({
      VERSION_JSON_URL: 'http://127.0.0.1:1/version.json',
      EVENT_BEFORE: HEAD,
    });
    expect(antes).toBe(HEAD);
  });

  it('sin ninguna de las dos fuentes, el resultado es vacío — el llamador deploya todo', async () => {
    const antes = await decidir({
      VERSION_JSON_URL: 'http://127.0.0.1:1/version.json',
      EVENT_BEFORE: '',
    });
    expect(antes).toBe('');
  });

  it('el workflow consume el script y no repite la decisión por su cuenta', () => {
    /*
     * La mitad que los casos de arriba no dan: que `push-main.yml`
     * efectivamente use esto. Sin este test, alguien podría dejar el `if`
     * inline al lado del script nuevo — dos versiones, y la que corre no
     * sería la que se prueba. Es la misma forma que
     * `tests/emuladores-arriba.test.ts` usa para `verificar-todo.sh`.
     */
    const workflow = readFileSync(
      new URL('../.github/workflows/push-main.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('./scripts/commit-base-deploy.sh');
    expect(
      workflow,
      'el workflow volvió a pedirle /version.json por su cuenta',
    ).not.toMatch(/curl[^\n]*version\.json/);
  });
});
