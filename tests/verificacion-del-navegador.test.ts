/**
 * **¿Pudimos verificar este navegador?** — B-930.
 *
 * Lo que se afirma acá es lo que el cartel necesita para decir la verdad:
 *
 * - que con emuladores (o sin App Check activo por un camino deliberado) el
 *   cartel **no puede** aparecer;
 * - que un `getToken` que falla, o que **no vuelve nunca** —el caso real de una
 *   extensión que bloquea reCAPTCHA—, termina en `sin-verificar`;
 * - que un token que llega tarde saca el cartel;
 * - y que nada de esto tira.
 *
 * Sin DOM, sin Firebase: el `getToken` real lo inyecta `firebase-client.ts`, acá
 * es una promesa que controla el test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  _resetVerificacion,
  debeAvisar,
  estadoDeVerificacion,
  estadoSegunActivacion,
  navegadorSinVerificar,
  observarVerificacion,
  PASOS_SIN_VERIFICAR,
  UMBRAL_VERIFICACION_MS,
  verificarNavegador,
} from '@/lib/verificacionDelNavegador';

const codigo = (rel: string): string =>
  sinComentarios(readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8'));

/** Una promesa que el test resuelve o rechaza cuando quiere. */
const diferida = () => {
  let resolver!: (v: unknown) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<unknown>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
};

beforeEach(() => {
  _resetVerificacion();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('qué estado corresponde según cómo se activó App Check', () => {
  it('activado: hay que verificar', () => {
    expect(estadoSegunActivacion(null)).toBe('verificando');
  });

  /**
   * **Es la promesa del ítem para el desarrollo local**: los emuladores no
   * verifican App Check, así que ahí no hay nada que avisar. Si esto diera
   * `sin-verificar`, cada `npm run dev` con emuladores mostraría el cartel.
   */
  it('con emuladores, fuera del navegador o sin clave: no aplica, y el cartel no va', () => {
    for (const motivo of ['emuladores', 'sin-navegador', 'sin-clave'] as const) {
      expect(estadoSegunActivacion(motivo), motivo).toBe('no-aplica');
      expect(debeAvisar(estadoSegunActivacion(motivo)), motivo).toBe(false);
    }
  });

  it('si `initializeAppCheck` tiró, no va a haber token: se avisa de entrada', () => {
    expect(estadoSegunActivacion('fallo')).toBe('sin-verificar');
  });

  it('el arranque es `no-aplica`: quien no llama a verificar (el sitio público) no ve nada', () => {
    expect(estadoDeVerificacion()).toBe('no-aplica');
    expect(navegadorSinVerificar()).toBe(false);
  });
});

describe('pedir el token al entrar', () => {
  it('token que llega dentro del umbral: verificado, y el cartel nunca aparece', async () => {
    const token = diferida();
    const vistos: string[] = [];
    observarVerificacion(() => vistos.push(estadoDeVerificacion()));

    const corriendo = verificarNavegador({ motivo: null, pedirToken: () => token.promesa });
    expect(estadoDeVerificacion()).toBe('verificando');

    token.resolver({ token: 'x' });
    await corriendo;
    await vi.advanceTimersByTimeAsync(UMBRAL_VERIFICACION_MS * 2);

    expect(estadoDeVerificacion()).toBe('verificado');
    expect(vistos).not.toContain('sin-verificar');
  });

  it('`getToken` que rechaza (403, red): sin verificar', async () => {
    await verificarNavegador({
      motivo: null,
      pedirToken: () => Promise.reject(new Error('appCheck/fetch-status-error')),
    });
    expect(estadoDeVerificacion()).toBe('sin-verificar');
    expect(navegadorSinVerificar()).toBe(true);
  });

  /**
   * **El caso real, y el motivo del umbral.** Con el script de reCAPTCHA
   * bloqueado por una extensión, el `getToken` del SDK espera a que el widget
   * se inicialice y eso no pasa nunca: la promesa no rechaza. Un `catch` solo no
   * lo ve.
   *
   * MUTACIÓN PROBADA (2026-09-23): sacando el `esperar(umbralMs).then(...)` de
   * `verificarNavegador` este caso queda en `verificando` para siempre y el test
   * se pone rojo; el de «rechaza» sigue verde, que es justamente por qué hace
   * falta este.
   */
  it('`getToken` que no vuelve nunca: pasado el umbral, sin verificar', async () => {
    void verificarNavegador({ motivo: null, pedirToken: () => new Promise(() => {}) });

    await vi.advanceTimersByTimeAsync(UMBRAL_VERIFICACION_MS - 1);
    expect(estadoDeVerificacion()).toBe('verificando');

    await vi.advanceTimersByTimeAsync(1);
    expect(estadoDeVerificacion()).toBe('sin-verificar');
  });

  it('token que llega después del umbral: el cartel se va', async () => {
    const token = diferida();
    const corriendo = verificarNavegador({ motivo: null, pedirToken: () => token.promesa });

    await vi.advanceTimersByTimeAsync(UMBRAL_VERIFICACION_MS);
    expect(estadoDeVerificacion()).toBe('sin-verificar');

    token.resolver({ token: 'tarde' });
    await corriendo;
    expect(estadoDeVerificacion()).toBe('verificado');
  });

  it('con emuladores no pide nada', async () => {
    const pedirToken = vi.fn(() => Promise.resolve({}));
    await verificarNavegador({ motivo: 'emuladores', pedirToken });
    expect(pedirToken).not.toHaveBeenCalled();
    expect(estadoDeVerificacion()).toBe('no-aplica');
  });

  it('activado pero sin quién pida el token: se trata como fallo', async () => {
    await verificarNavegador({ motivo: null, pedirToken: null });
    expect(estadoDeVerificacion()).toBe('sin-verificar');
  });

  it('una sola vez por carga: el panel puede montarse más de una vez', async () => {
    const pedirToken = vi.fn(() => Promise.resolve({}));
    await verificarNavegador({ motivo: null, pedirToken });
    await verificarNavegador({ motivo: null, pedirToken });
    expect(pedirToken).toHaveBeenCalledTimes(1);
  });

  it('nunca tira, aunque `pedirToken` tire síncrono', async () => {
    await expect(
      verificarNavegador({
        motivo: null,
        pedirToken: () => {
          throw new Error('síncrono');
        },
      }),
    ).resolves.toBeUndefined();
    expect(estadoDeVerificacion()).toBe('sin-verificar');
  });
});

describe('el cartel', () => {
  /**
   * El orden es el del triaje de B-930 —de lo que más descarta por minuto a lo
   * que menos— y no es cosmético: incógnito antes que otro navegador porque
   * descarta la causa más común (una extensión) sin instalar nada.
   */
  it('los tres pasos, en el orden del triaje', () => {
    expect(PASOS_SIN_VERIFICAR).toHaveLength(3);
    expect(PASOS_SIN_VERIFICAR[0]).toMatch(/recarg/i);
    expect(PASOS_SIN_VERIFICAR[1]).toMatch(/incógnito/i);
    expect(PASOS_SIN_VERIFICAR[1]).toMatch(/extensiones/i);
    expect(PASOS_SIN_VERIFICAR[2]).toMatch(/otro navegador/i);
    expect(PASOS_SIN_VERIFICAR[2]).toMatch(/datos/i);
  });
});

describe('el cableado', () => {
  it('`firebase-client` activa App Check antes de preguntar cómo le fue', () => {
    const cliente = codigo('src/lib/firebase-client.ts');
    const cuerpo = cliente.slice(cliente.indexOf('verificarNavegadorAlArrancar'));
    expect(cuerpo.indexOf('app()')).toBeGreaterThan(-1);
    expect(cuerpo.indexOf('app()')).toBeLessThan(cuerpo.indexOf('motivoSinAppCheck()'));
  });

  /**
   * Lo importa `analytics-eventos.ts`, que usa también el sitio público: un
   * import de valor del SDK acá lo arrastraría a cada página.
   */
  it('no importa ningún SDK de Firebase, solo tipos', () => {
    const fuente = codigo('src/lib/verificacionDelNavegador.ts');
    const imports = fuente.match(/^import\s.+$/gm) ?? [];
    for (const linea of imports) expect(linea).toMatch(/^import type /);
  });
});
