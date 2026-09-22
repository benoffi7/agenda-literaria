import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { ENTRADAS_DE_BUILD, componerVersion, shaDeVersion } from '../scripts/version.mjs';

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

/** El mismo commit que `HEAD`, en 40 hex: el sha largo que git también produce. */
const HEAD_LARGO = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: RAIZ,
  encoding: 'utf8',
}).trim();

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

  it('si /version.json no trae "sha" ni un sufijo parseable, cae al before', async () => {
    const { url, cerrar } = await servidorVersion(JSON.stringify({ version: '1.2.0' }));
    abiertos.push(cerrar);
    const antes = await decidir({ VERSION_JSON_URL: url, EVENT_BEFORE: HEAD });
    expect(antes).toBe(HEAD);
  });

  it('sin campo "sha", saca el sha del sufijo de "version" — el formato REAL (B-562)', async () => {
    // `version.json` de producción es `{version, generadoEn}`, sin `.sha`
    // (`INFO_VERSION`, `src/lib/version.ts`). El sha va embebido como
    // `<x.y.z>+<sha>` (`componerVersion`). Sin este parseo, B-205 leía `.sha`,
    // no lo encontraba y caía al before: quedaba inerte, que es lo que dejó
    // producción vieja el 2026-09-03.
    const { url, cerrar } = await servidorVersion(JSON.stringify({ version: `1.6.0+${HEAD}` }));
    abiertos.push(cerrar);
    const antes = await decidir({ VERSION_JSON_URL: url, EVENT_BEFORE: 'deadbee' });
    expect(antes).toBe(HEAD);
  });

  it('un build sucio en el sufijo no se usa como base: cae al before', async () => {
    // `<x.y.z>+<sha>-sucio.<sello>` o `+sin-git.<sello>` no terminan en hex puro,
    // así que el sed no matchea y no se confía ese sha como base.
    const { url, cerrar } = await servidorVersion(
      JSON.stringify({ version: `1.6.0+${HEAD}-sucio.20260903` }),
    );
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

describe('el `sed` del script y `shaDeVersion` contestan lo mismo — B-1121, clase D-88', () => {
  /*
   * **Por qué existe esta red.** El formato de la versión lo define
   * `componerVersion` (`scripts/version.mjs`). Desde B-1121 hay un parser al
   * lado, `shaDeVersion`, que es su inverso — y hay un **segundo** lado que
   * sabe el mismo formato: el `sed` de la línea 47 de este script, que no puede
   * importar un módulo porque es bash.
   *
   * Dos lados derivando lo mismo es exactamente la clase D-88, la que acaba de
   * costar B-1111 en `tests/emulador.ts`. Acá no se puede unificar sin tocar el
   * camino del deploy —cambiar producción para arreglar un reporte—, así que en
   * vez de unificarlos se los **ata**: para toda versión que este build puede
   * llegar a estampar, los dos tienen que contestar lo mismo.
   *
   * Se recorre `ENTRADAS_DE_BUILD` y no tres literales por lo mismo que en
   * `version.test.ts`: una forma nueva de versión entra sola en la red, y quien
   * la agregue está parado al lado de `componerVersion`.
   *
   * El sha usado es **HEAD de verdad**, no uno inventado: el `sh` hace
   * `git cat-file -e` antes de aceptarlo, así que con un sha falso las cuatro
   * entradas darían vacío y el caso pasaría sin comparar nada.
   */
  const ahora = new Date('2026-09-22T12:00:00Z');

  for (const hechos of ENTRADAS_DE_BUILD) {
    const version = componerVersion({
      base: '1.10.0',
      sha: hechos.sha === null ? null : HEAD,
      sucio: hechos.sucio,
      ahora,
    });
    const esperado = shaDeVersion(version) ?? '';
    const forma = `${hechos.sha === null ? 'sin git' : 'con sha'}, ${hechos.sucio ? 'sucio' : 'limpio'}`;

    it(`build ${forma}: el sh saca "${esperado || '(nada)'}", igual que el módulo`, async () => {
      const { url, cerrar } = await servidorVersion(JSON.stringify({ version }));
      abiertos.push(cerrar);
      // EVENT_BEFORE vacío a propósito: así lo que sale es la extracción y no
      // el fallback, que es lo único que este caso compara.
      expect(await decidir({ VERSION_JSON_URL: url, EVENT_BEFORE: '' })).toBe(esperado);
    });
  }

  /**
   * El `sed` del script, **leído del script** y no copiado acá.
   *
   * Es el mismo movimiento que `reglasDeCache` con `firebase.json`: si la red
   * repitiera la expresión, sería una tercera copia del formato y el test
   * pasaría para siempre aunque el script cambiara — exactamente la clase que
   * esta red viene a cerrar.
   */
  const sedDelScript = (): string => {
    const fuente = readFileSync(`${RAIZ}scripts/commit-base-deploy.sh`, 'utf8');
    const m = /\|\s*sed -n '([^']+)'/.exec(fuente);
    if (!m) throw new Error('no se encontró el `sed` de extracción en commit-base-deploy.sh');
    return m[1]!;
  };

  /** Lo que el `sed` del script extrae de una versión, sin pasar por git. */
  const extraeElSed = (version: string): string | null => {
    const salida = execFileSync('sed', ['-n', sedDelScript()], {
      input: version,
      encoding: 'utf8',
    }).trim();
    return salida === '' ? null : salida;
  };

  /*
   * **Los bordes van contra el `sed` aislado, y eso no es un atajo: es lo único
   * que mide la extracción.** Medido con dos mutaciones que el camino completo
   * dejó pasar —`{7,40}` → `{6,40}`, y sacarle el ancla de fin a la expresión—:
   * las dos siguen en verde de punta a punta, porque la salida del `sh`
   * **no distingue** «no lo extraje» de «lo extraje y el commit no existe»
   * (las dos caen al `before`), y ningún sha inventado existe.
   *
   * Es B-1129 con una cara más: el chequeo pasaba por el `git cat-file` que
   * tenía abajo, no por lo que decía mirar. Corriendo el `sed` solo, las dos
   * mutaciones dan rojo.
   */
  const BORDES = [
    { version: '1.10.0+abc123', que: 'seis hex — más corto que el sha corto' },
    { version: `1.10.0+${'a'.repeat(40)}`, que: 'cuarenta hex — el sha largo' },
    { version: `1.10.0+${'a'.repeat(41)}`, que: 'cuarenta y uno — pasado de largo' },
    { version: '1.10.0+xyz1234', que: 'siete, pero no hex' },
    { version: '1.10.0+abc1234-sucio.2609221200', que: 'el sufijo sucio, que no se usa de base' },
    { version: '1.10.0+sin-git.2609221200', que: 'un build sin git' },
    { version: '1.10.0', que: 'sin sufijo: estampada a mano' },
  ];

  for (const { version, que } of BORDES) {
    it(`borde (${que}): el sed y el módulo extraen lo mismo`, () => {
      expect(extraeElSed(version), que).toBe(shaDeVersion(version));
    });
  }

  it('el `sed` se lee del script y no está copiado en este test', () => {
    // Si alguien pega la expresión acá, la red deja de atar los dos lados.
    const expr = sedDelScript();
    expect(expr).toContain('0-9a-f');
    expect(readFileSync(`${RAIZ}tests/commit-base-deploy.test.ts`, 'utf8')).not.toContain(
      `'${expr}'`,
    );
  });

  it('el dominio recorrido es el completo, no un subconjunto', () => {
    // Sin esto, alguien podría vaciar ENTRADAS_DE_BUILD y los casos de arriba
    // desaparecerían en silencio: cero tests corriendo se lee igual que verde.
    expect(ENTRADAS_DE_BUILD.length).toBeGreaterThanOrEqual(4);
    expect(ENTRADAS_DE_BUILD.some((h) => h.sha !== null && !h.sucio)).toBe(true);
    expect(ENTRADAS_DE_BUILD.some((h) => h.sucio)).toBe(true);
    expect(ENTRADAS_DE_BUILD.some((h) => h.sha === null)).toBe(true);
  });
});
