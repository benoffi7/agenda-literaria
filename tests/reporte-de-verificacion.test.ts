/**
 * **El panel reporta un navegador sin verificar, una vez** — B-930 paso 3.
 *
 * `src/lib/reporteDeVerificacion.ts` mira el store de la verificación y la
 * sesión, y manda el motivo a la Function. Lo que se afirma acá:
 *
 * - que reporta **una sola vez por pestaña**, aunque el estado vaya y venga y la
 *   persona recargue (la marca de `sessionStorage`);
 * - que **sin sesión no reporta** (el crawler que renderiza `/admin`);
 * - que un token que llega dentro de la gracia **no** reporta;
 * - que lo que viaja es el motivo y nada más, sin cookies ni `Referer`;
 * - y que nada de esto tira.
 *
 * Y, del store, que la causa que viaja es la del camino que dejó el navegador
 * sin verificar.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  _fijarVerificacion,
  _resetVerificacion,
  causaSinVerificar,
  registrarEventoDeToken,
  UMBRAL_VERIFICACION_MS,
  verificarNavegador,
  type CausaSinVerificar,
} from '@/lib/verificacionDelNavegador';
import {
  _resetReporteDeVerificacion,
  cuerpoDelReporte,
  debeReportar,
  enviarReportePorFetch,
  GRACIA_DEL_REPORTE_MS,
  iniciarReporteDeVerificacion,
} from '@/lib/reporteDeVerificacion';

beforeEach(() => {
  _resetVerificacion();
  _resetReporteDeVerificacion();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Una sesión que el test prende y apaga, y una marca de pestaña en memoria. */
const armar = ({ marcaInicial = false, enviar }: { marcaInicial?: boolean; enviar?: (m: CausaSinVerificar) => Promise<unknown> } = {}) => {
  let oyenteDeSesion: (hay: boolean) => void = () => {};
  let marca = marcaInicial;
  const enviados: CausaSinVerificar[] = [];
  iniciarReporteDeVerificacion({
    observarSesion: (oyente) => {
      oyenteDeSesion = oyente;
    },
    enviar:
      enviar ??
      (async (motivo) => {
        enviados.push(motivo);
      }),
    leerMarca: () => marca,
    escribirMarca: () => {
      marca = true;
    },
  });
  return {
    enviados,
    sesion: (hay: boolean) => oyenteDeSesion(hay),
    marca: () => marca,
  };
};

describe('debeReportar', () => {
  it('solo sin verificar, con sesión y sin reporte previo', () => {
    expect(debeReportar({ estado: 'sin-verificar', haySesion: true, yaReportado: false })).toBe(true);
    for (const estado of ['no-aplica', 'verificando', 'verificado'] as const) {
      expect(debeReportar({ estado, haySesion: true, yaReportado: false }), estado).toBe(false);
    }
    expect(debeReportar({ estado: 'sin-verificar', haySesion: false, yaReportado: false })).toBe(false);
    expect(debeReportar({ estado: 'sin-verificar', haySesion: true, yaReportado: true })).toBe(false);
  });
});

describe('iniciarReporteDeVerificacion', () => {
  it('sin verificar con sesión: reporta el motivo pasada la gracia, no antes', async () => {
    const r = armar();
    r.sesion(true);
    _fijarVerificacion('sin-verificar', 'sin-respuesta');

    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS - 1);
    expect(r.enviados).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.enviados).toEqual(['sin-respuesta']);
    expect(r.marca()).toBe(true);
  });

  /**
   * **La promesa del ítem: una vez por sesión.** El estado puede ir y venir
   * —un token que llega, una renovación que falla— y la persona puede cerrar y
   * abrir sesión: el dueño recibe un reporte, no cinco.
   *
   * MUTACIÓN PROBADA: sacando `yaReportado = true;` del reporte, este test da
   * tres envíos.
   */
  it('una sola vez, aunque el estado y la sesión vayan y vengan', async () => {
    const r = armar();
    r.sesion(true);
    for (let i = 0; i < 3; i++) {
      _fijarVerificacion('sin-verificar', 'token-rechazado');
      await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS);
      _fijarVerificacion('verificado');
      r.sesion(false);
      r.sesion(true);
    }
    expect(r.enviados).toEqual(['token-rechazado']);
  });

  it('con la marca de la pestaña puesta (recargó) no reporta de nuevo', async () => {
    const r = armar({ marcaInicial: true });
    r.sesion(true);
    _fijarVerificacion('sin-verificar', 'sin-respuesta');
    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS * 3);
    expect(r.enviados).toEqual([]);
  });

  it('sin sesión no reporta; cuando la persona entra, sí', async () => {
    const r = armar();
    _fijarVerificacion('sin-verificar', 'sin-respuesta');
    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS * 3);
    expect(r.enviados).toEqual([]);

    r.sesion(true);
    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS);
    expect(r.enviados).toEqual(['sin-respuesta']);
  });

  it('un token que llega dentro de la gracia no reporta', async () => {
    const r = armar();
    r.sesion(true);
    _fijarVerificacion('sin-verificar', 'sin-respuesta');
    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS / 2);
    _fijarVerificacion('verificado');
    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS * 2);
    expect(r.enviados).toEqual([]);
  });

  it('si la sesión se cierra durante la gracia, no reporta', async () => {
    const r = armar();
    r.sesion(true);
    _fijarVerificacion('sin-verificar', 'sin-respuesta');
    r.sesion(false);
    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS * 2);
    expect(r.enviados).toEqual([]);
  });

  it('una segunda llamada no suscribe dos veces', async () => {
    const r = armar();
    const otros: CausaSinVerificar[] = [];
    iniciarReporteDeVerificacion({
      observarSesion: (o) => o(true),
      enviar: async (m) => {
        otros.push(m);
      },
    });
    r.sesion(true);
    _fijarVerificacion('sin-verificar', 'sin-respuesta');
    await vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS);
    expect(r.enviados).toEqual(['sin-respuesta']);
    expect(otros).toEqual([]);
  });

  it('un envío que tira o rechaza no rompe nada', async () => {
    const r = armar({
      enviar: () => {
        throw new Error('sin red');
      },
    });
    r.sesion(true);
    _fijarVerificacion('sin-verificar', 'sin-respuesta');
    await expect(vi.advanceTimersByTimeAsync(GRACIA_DEL_REPORTE_MS)).resolves.not.toThrow();
    expect(r.marca()).toBe(true);
  });

  it('observarSesion que tira no se propaga', () => {
    expect(() =>
      iniciarReporteDeVerificacion({
        observarSesion: () => {
          throw new Error('auth');
        },
        enviar: async () => {},
      }),
    ).not.toThrow();
  });
});

describe('lo que viaja', () => {
  it('el motivo y nada más, sin cookies ni Referer', async () => {
    const llamadas: [string, RequestInit][] = [];
    const falso = (async (url: string, init: RequestInit) => {
      llamadas.push([url, init]);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    await enviarReportePorFetch('https://x.example/f', falso)('renovacion-fallida');

    expect(llamadas).toHaveLength(1);
    const [url, init] = llamadas[0];
    expect(url).toBe('https://x.example/f');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"motivo":"renovacion-fallida"}');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    // Sin `Content-Type` propio: un string va como `text/plain`, que es un
    // pedido simple y no dispara preflight.
    expect(init.headers).toBeUndefined();
  });

  it('el cuerpo es JSON con una sola clave', () => {
    expect(JSON.parse(cuerpoDelReporte('no-se-activo'))).toEqual({ motivo: 'no-se-activo' });
  });
});

describe('la causa que guarda el store', () => {
  it('activación fallida: no-se-activo', async () => {
    await verificarNavegador({ motivo: 'fallo', pedirToken: null });
    expect(causaSinVerificar()).toBe('no-se-activo');
  });

  it('activado sin quién pida el token: no-se-activo', async () => {
    await verificarNavegador({ motivo: null, pedirToken: null });
    expect(causaSinVerificar()).toBe('no-se-activo');
  });

  it('getToken que rechaza: token-rechazado', async () => {
    await verificarNavegador({ motivo: null, pedirToken: () => Promise.reject(new Error('403')) });
    expect(causaSinVerificar()).toBe('token-rechazado');
  });

  it('getToken que no vuelve: sin-respuesta', async () => {
    void verificarNavegador({ motivo: null, pedirToken: () => new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(UMBRAL_VERIFICACION_MS);
    expect(causaSinVerificar()).toBe('sin-respuesta');
  });

  it('renovación que se queda sin token: renovacion-fallida; y al volver, se borra', async () => {
    await verificarNavegador({ motivo: null, pedirToken: () => Promise.resolve('t') });
    expect(causaSinVerificar()).toBeNull();
    registrarEventoDeToken('error');
    expect(causaSinVerificar()).toBe('renovacion-fallida');
    registrarEventoDeToken('token');
    expect(causaSinVerificar()).toBeNull();
  });

  it('con emuladores no hay causa: no hay nada que reportar', async () => {
    await verificarNavegador({ motivo: 'emuladores', pedirToken: null });
    expect(causaSinVerificar()).toBeNull();
  });
});

describe('el cableado en firebase-client.ts', () => {
  const src = () => sinComentarios(readFileSync('src/lib/firebase-client.ts', 'utf8'));

  it('con emuladores no se engancha', () => {
    expect(src()).toMatch(/if \(!usarEmuladores && config\.projectId\) \{\s*iniciarReporteDeVerificacion\(/);
  });

  it('a la sesión le pasa un booleano, nunca el usuario: el uid no llega al reporte', () => {
    expect(src()).toContain('(u) => oyente(u !== null)');
  });
});
