import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * La detección de emuladores del gate — B-180.
 *
 * El paso 3 de `scripts/verificar-todo.sh` decide entre dos ramas: si ya hay
 * emuladores escuchando usa esos (`npm test` directo), y si no levanta unos
 * efímeros (`emulators:exec`). Esa decisión era un `if` en bash sin ningún test,
 * a diferencia de la de `que-deployar.sh`, que tiene veinte.
 *
 * **Por qué importa que se pueda probar.** El modo de falla es el que ya se vio:
 * con los emuladores arriba, `emulators:exec` corta con "port taken" y el gate
 * falla *por su propia plomería* — los emuladores estaban, la suite pasaba, y el
 * push no salía. Un gate que falla así enseña a saltearlo. Y desde B-217 esa
 * misma detección decide **dos** ramas y no una: la del paso 3 y la del paso 4.
 *
 * **Cómo se prueba sin emuladores de verdad.** La decisión solo mira si el hub
 * contesta, así que alcanza un servidor HTTP de dos líneas apuntado con
 * `FIREBASE_EMULATOR_HUB`. Eso deja las tres respuestas ejercitadas —contesta,
 * no contesta, contesta un error— sin arrancar ningún Java.
 *
 * **Ojo con `execFileSync`**: el servidor de mentira vive en este mismo proceso,
 * así que una llamada *sincrónica* al script bloquea el event loop y el servidor
 * nunca llega a contestar — el caso "arriba" daría `false` y el test estaría
 * midiendo el bloqueo, no la decisión. De ahí el `execFile` promisificado.
 */
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const correr = promisify(execFile);

const detectar = async (
  entorno: Record<string, string> = {},
): Promise<Record<string, string>> => {
  const { stdout } = await correr('./scripts/emuladores-arriba.sh', [], {
    cwd: RAIZ,
    encoding: 'utf8',
    // Se limpia el entorno heredado: `vitest.config.ts` exporta
    // FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST a todos los tests, y
    // sin esto los casos de "el default" estarían probando el valor del
    // desarrollador en vez del default del script.
    env: { PATH: process.env.PATH ?? '', ...entorno },
  });
  return Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .map((linea) => {
        const i = linea.indexOf('=');
        return [linea.slice(0, i), linea.slice(i + 1)];
      }),
  );
};

/** Un servidor que contesta `status` en `/emulators`, en un puerto que da el SO. */
const servidor = async (status: number): Promise<{ host: string; cerrar: () => void }> => {
  const s: Server = createServer((_req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end('{"firestore":{}}');
  });
  await new Promise<void>((listo) => s.listen(0, '127.0.0.1', listo));
  const dir = s.address();
  if (typeof dir === 'string' || dir === null) throw new Error('el servidor no dio puerto');
  return { host: `127.0.0.1:${dir.port}`, cerrar: () => s.close() };
};

const abiertos: (() => void)[] = [];
afterAll(() => abiertos.forEach((cerrar) => cerrar()));

describe('la detección de emuladores del gate — B-180', () => {
  it('un hub que contesta 200 es "arriba": el gate usa los que están', async () => {
    const { host, cerrar } = await servidor(200);
    abiertos.push(cerrar);
    expect((await detectar({ FIREBASE_EMULATOR_HUB: host })).arriba).toBe('true');
  });

  it('un hub que no contesta es "no arriba": el gate levanta los suyos', async () => {
    // Puerto 1: reservado y nadie lo escucha, así que el connect falla al toque.
    expect((await detectar({ FIREBASE_EMULATOR_HUB: '127.0.0.1:1' })).arriba).toBe('false');
  });

  it('un hub que contesta un error de servidor NO cuenta como arriba', async () => {
    /*
     * La rama prudente, y es una decisión y no un accidente de `curl -sf`:
     * correr la suite contra algo que contesta 503 en `/emulators` es correrla
     * contra un proceso que no sabemos qué es. Levantar unos propios falla
     * ruidoso ("port taken") en vez de silencioso, y ése es el lado correcto.
     *
     * Sin este caso, cambiar `curl -sf` por `curl -s` pasaría los otros dos
     * tests: el `-f` es exactamente lo que este `it` sostiene.
     */
    const { host, cerrar } = await servidor(503);
    abiertos.push(cerrar);
    expect((await detectar({ FIREBASE_EMULATOR_HUB: host })).arriba).toBe('false');
  });

  it('los cuatro hosts salen con el default del proyecto si no vienen del entorno', async () => {
    const r = await detectar({ FIREBASE_EMULATOR_HUB: '127.0.0.1:1' });
    expect(r).toMatchObject({
      hub: '127.0.0.1:1',
      firestore: '127.0.0.1:8080',
      auth: '127.0.0.1:9099',
      storage: '127.0.0.1:9199',
    });
  });

  it('y respeta los del entorno, que es cómo el CI apunta a los suyos', async () => {
    const r = await detectar({
      FIREBASE_EMULATOR_HUB: '127.0.0.1:1',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8081',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9098',
      FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9198',
    });
    expect(r).toMatchObject({
      firestore: '127.0.0.1:8081',
      auth: '127.0.0.1:9098',
      storage: '127.0.0.1:9198',
    });
  });

  it('el gate consume el script y no tiene su propia copia de la decisión', () => {
    /*
     * La mitad que los casos de arriba no dan: que `verificar-todo.sh`
     * efectivamente use esto. Extraer la decisión y dejar la copia vieja
     * adentro del gate sería peor que no extraerla — habría dos, y la que se
     * testea no sería la que corre.
     */
    const gate = readFileSync(new URL('../scripts/verificar-todo.sh', import.meta.url), 'utf8');
    expect(gate).toContain('./scripts/emuladores-arriba.sh');
    expect(gate, 'el gate volvió a preguntarle al hub por su cuenta').not.toMatch(
      /curl[^\n]*\/emulators/,
    );
  });
});
