/**
 * **El rojo del paso 4 del gate, y sus chequeos nombrados** — B-1960 (M-11 del
 * PRD 6).
 *
 * La trampa que desarma: `fallo()` ponía `process.exitCode = 1` y el script
 * salía con `process.exit(salida)`, que la pisaba. 70 llamadas dependían de un
 * `salida = 1` escrito a mano, y una sin él imprimía el rojo y salía con 0 —sin
 * que ningún test lo mirara, porque el gate corre contra el emulador y un
 * `dist/` de verdad—. Acá se prueba la mecánica sin build:
 *
 *   1. que `fallo()` deja el resultado en rojo, con una mutación que lo prueba;
 *   2. que el script sale con ese resultado y no tiene otro camino al código de
 *      salida;
 *   3. que cada archivo de `chequeos/` está registrado, y que cada chequeo se
 *      pone rojo sobre un `dist/` vacío **a través del mismo resultado** que
 *      decide el código de salida.
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { CHEQUEOS, contextoSobre, correrChequeos } from '../scripts/gate-build/chequeos.mjs';
import { crearResultado } from '../scripts/gate-build/resultado.mjs';

const silencio = { error: () => {}, log: () => {} };
const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));

type Crear = typeof crearResultado;

/** El contrato que el script necesita de `crearResultado`: `fallo()` pone el rojo. */
const problemasDelContrato = (crear: Crear): string[] => {
  const problemas: string[] = [];
  const limpio = crear(silencio);
  if (limpio.salida !== 0 || !limpio.sinFallos()) problemas.push('arranca en rojo');
  const r = crear(silencio);
  r.fallo('x');
  if (r.salida !== 1) problemas.push(`después de fallo() la salida es ${r.salida}`);
  if (r.sinFallos()) problemas.push('después de fallo() sinFallos() sigue en true');
  if (r.cuenta() !== 1) problemas.push(`después de un fallo() la cuenta es ${r.cuenta()}`);
  return problemas;
};

describe('fallo() pone el gate en rojo él mismo', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'gate-resultado-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('el resultado de verdad cumple el contrato', () => {
    expect(problemasDelContrato(crearResultado)).toEqual([]);
  });

  it('y fallo() imprime el mensaje por el canal de error', () => {
    const errores: string[] = [];
    crearResultado({ error: (t) => errores.push(t), log: () => {} }).fallo('se rompió');
    expect(errores.join('')).toContain('se rompió');
  });

  /*
   * MUTACIÓN PROBADA, y se prueba sola: la copia de `resultado.mjs` a la que se
   * le saca el `salida = 1` de adentro de `fallo()` —la trampa de B-1960 con su
   * forma exacta: el rojo impreso y el código en 0— no cumple el contrato. Se
   * escribe en `os.tmpdir()`, nunca adentro de `tests/` (M-1 del PRD 6).
   */
  it('la mutación que saca el `salida = 1` de fallo() se detecta', async () => {
    const fuente = readFileSync(ruta('../scripts/gate-build/resultado.mjs'), 'utf8');
    const mutada = fuente.replace(/^\s*salida = 1;\n/m, '');
    expect(mutada).not.toBe(fuente);
    const archivo = join(tmp, 'resultado-mutado.mjs');
    writeFileSync(archivo, mutada);
    const { crearResultado: crearMutado } = await import(pathToFileURL(archivo).href);
    expect(problemasDelContrato(crearMutado)).toContain('después de fallo() la salida es 0');
  });
});

describe('el script sale con el resultado y con nada más', () => {
  const gate = readFileSync(ruta('../scripts/build-contra-emulador.mjs'), 'utf8');

  it('el código de salida es el del resultado', () => {
    expect(gate).toContain('process.exit(resultado.salida);');
    expect(gate).toMatch(/const \{ fallo \} = resultado;/);
  });

  it('no hay un `salida` propio, ni `exitCode`, ni otro `fallo`', () => {
    // Cualquiera de los tres es la trampa de vuelta: un segundo lugar donde se
    // decide el rojo, que el primero no ve.
    expect(gate).not.toMatch(/\bsalida\s*=[^=]/);
    expect(gate).not.toMatch(/process\.exitCode/);
    expect(gate).not.toMatch(/(const|let|function)\s+fallo\b/);
  });
});

describe('los chequeos nombrados', () => {
  it('cada archivo de chequeos/ está en CHEQUEOS, y ninguno dos veces', async () => {
    const dir = ruta('../scripts/gate-build/chequeos/');
    const archivos = readdirSync(dir).filter((f) => f.endsWith('.mjs'));
    expect(archivos.length).toBe(CHEQUEOS.length);
    for (const f of archivos) {
      const mod = await import(pathToFileURL(join(dir, f)).href);
      expect(CHEQUEOS, f).toContain(mod);
    }
    expect(new Set(CHEQUEOS).size).toBe(CHEQUEOS.length);
    const nombres = CHEQUEOS.map((c) => c.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  /*
   * El positivo que impide el verde por vacuidad, chequeo por chequeo: sobre un
   * `dist/` sin ningún archivo, **cada uno** tiene que ponerse rojo, y sin
   * tirar. Y el rojo tiene que llegar al `resultado.salida` que el script le pasa
   * a `process.exit`, que es la mitad que B-1960 vino a atar.
   */
  it.each(CHEQUEOS.map((c) => [c.nombre, c] as const))(
    '«%s» se pone rojo sobre un dist/ vacío',
    async (_nombre, chequeo) => {
      const resultado = crearResultado(silencio);
      const ctx = contextoSobre([], resultado, { rutaDeLaMiniatura: 'miniaturas/x.jpg' });
      await expect(chequeo.chequear(ctx)).resolves.toBeUndefined();
      expect(resultado.cuenta()).toBeGreaterThan(0);
      expect(resultado.salida).toBe(1);
    },
  );

  it('un chequeo que tira es un rojo con su nombre, y los demás corren igual', async () => {
    const mensajes: string[] = [];
    const resultado = crearResultado({ error: (t) => mensajes.push(t), log: () => {} });
    const ctx = contextoSobre([], resultado, { rutaDeLaMiniatura: 'x' });
    let corrioElSegundo = false;
    await correrChequeos(
      [
        {
          nombre: 'el que se cae',
          chequear: async () => {
            throw new Error('boom');
          },
        },
        {
          nombre: 'el de después',
          chequear: async () => {
            corrioElSegundo = true;
          },
        },
      ],
      ctx,
    );
    expect(resultado.salida).toBe(1);
    expect(mensajes.join('')).toContain('«el que se cae» se cortó: boom');
    expect(corrioElSegundo).toBe(true);
  });

  it('el contexto lee del dist/ que recibió, y null para lo que no está', async () => {
    const ctx = contextoSobre(
      [{ relativa: 'actividad/a/index.html', contenido: '<h1>a</h1>' }],
      crearResultado(silencio),
      { rutaDeLaMiniatura: 'x' },
    );
    expect(await ctx.htmlDe('a')).toBe('<h1>a</h1>');
    expect(await ctx.leer('sitemap.xml')).toBeNull();
  });
});
