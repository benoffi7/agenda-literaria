import { describe, expect, it } from 'vitest';
// La Function es JS plano; TS le infiere los tipos con allowJs.
import {
  CAMPOS_REARME,
  decidirDisparo,
  esperaMs,
  ESPERA_BASE_MS,
  MAX_INTENTOS,
  registrarExito,
  registrarFallo,
} from '../functions/rebuild.js';

const T0 = new Date('2026-08-21T18:00:00Z').getTime();
const MINUTO = 60_000;

/** Timestamp mínimo, como el que entrega Firestore al leer el documento. */
const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

/** El documento `sistema/rebuild` recién marcado por la Function de sync. */
const pendiente = (over: Record<string, unknown> = {}) => ({
  pendiente: true,
  motivo: 'actividad abc123',
  intentos: 0,
  ultimoError: null,
  agotado: false,
  ...over,
});

describe('decidirDisparo — cuándo se dispara el rebuild (§8)', () => {
  it('sin documento no hay nada que disparar', () => {
    expect(decidirDisparo(null, T0)).toEqual({ accion: 'esperar', motivo: 'sin-pendiente' });
  });

  it('con pendiente en false no dispara', () => {
    const d = decidirDisparo({ pendiente: false, intentos: 0 }, T0);
    expect(d).toEqual({ accion: 'esperar', motivo: 'sin-pendiente' });
  });

  it('con pendiente en true dispara en el primer tick, sin esperar', () => {
    expect(decidirDisparo(pendiente(), T0)).toEqual({ accion: 'disparar', intento: 1 });
  });

  it('un documento viejo, sin los campos de intentos, dispara igual', () => {
    // Compatibilidad: `sistema/rebuild` ya existe en producción escrito por la
    // versión anterior, que no tenía contador.
    expect(decidirDisparo({ pendiente: true }, T0)).toEqual({ accion: 'disparar', intento: 1 });
  });
});

describe('decidirDisparo — backoff entre reintentos (B-13)', () => {
  it('después de un fallo espera un período completo del schedule', () => {
    const estado = pendiente({ intentos: 1, ultimoIntento: ts(T0) });

    const enseguida = decidirDisparo(estado, T0 + MINUTO);
    expect(enseguida.accion).toBe('esperar');
    expect(enseguida.motivo).toBe('backoff');
    expect(enseguida.restanteMs).toBe(4 * MINUTO);

    expect(decidirDisparo(estado, T0 + 5 * MINUTO)).toEqual({ accion: 'disparar', intento: 2 });
  });

  it('la espera se duplica con cada fallo: 5, 10, 20, 40 minutos', () => {
    expect(esperaMs(0)).toBe(0);
    expect(esperaMs(1)).toBe(5 * MINUTO);
    expect(esperaMs(2)).toBe(10 * MINUTO);
    expect(esperaMs(3)).toBe(20 * MINUTO);
    expect(esperaMs(4)).toBe(40 * MINUTO);
    expect(ESPERA_BASE_MS).toBe(5 * MINUTO);
  });

  it('al tercer fallo saltea los ticks intermedios', () => {
    const estado = pendiente({ intentos: 3, ultimoIntento: ts(T0) });
    // El schedule tickea igual cada 5 minutos; el backoff decide en cuál se
    // intenta. A los 15 minutos todavía no toca.
    expect(decidirDisparo(estado, T0 + 15 * MINUTO).accion).toBe('esperar');
    expect(decidirDisparo(estado, T0 + 20 * MINUTO).accion).toBe('disparar');
  });

  it('acepta el ultimoIntento como Date además de Timestamp', () => {
    const estado = pendiente({ intentos: 1, ultimoIntento: new Date(T0) });
    expect(decidirDisparo(estado, T0 + MINUTO).accion).toBe('esperar');
    expect(decidirDisparo(estado, T0 + 5 * MINUTO).accion).toBe('disparar');
  });

  it('si falta el ultimoIntento no se queda esperando para siempre', () => {
    // Un documento a medio escribir no puede bloquear el rebuild.
    const estado = pendiente({ intentos: 2, ultimoIntento: null });
    expect(decidirDisparo(estado, T0).accion).toBe('disparar');
  });
});

describe('decidirDisparo — límite de intentos (B-13)', () => {
  it('agotado deja de reintentar en vez de golpear cada 5 minutos', () => {
    const estado = pendiente({ intentos: MAX_INTENTOS, agotado: true, ultimoIntento: ts(T0) });
    const d = decidirDisparo(estado, T0 + 24 * 60 * MINUTO);
    expect(d.accion).toBe('esperar');
    expect(d.motivo).toBe('agotado');
  });

  it('el contador corta aunque falte el flag agotado', () => {
    // Red de contención si el documento quedó a medio escribir.
    const estado = pendiente({ intentos: MAX_INTENTOS, ultimoIntento: ts(T0) });
    expect(decidirDisparo(estado, T0 + 24 * 60 * MINUTO).motivo).toBe('agotado');
  });

  it('el límite es configurable para bajarlo sin tocar la lógica', () => {
    const estado = pendiente({ intentos: 2, ultimoIntento: null });
    expect(decidirDisparo(estado, T0, { maxIntentos: 2 }).motivo).toBe('agotado');
  });
});

describe('registrarFallo — el fallo queda en el documento (B-13)', () => {
  it('incrementa el contador y guarda el error', () => {
    const fallo = registrarFallo(pendiente(), 'HTTP 401 Bad credentials', T0);
    expect(fallo.intentos).toBe(1);
    expect(fallo.ultimoError).toBe('HTTP 401 Bad credentials');
    expect(fallo.ultimoIntento).toEqual(new Date(T0));
    expect(fallo.agotado).toBe(false);
  });

  it('deja pendiente en true: el sitio sigue viejo', () => {
    expect(registrarFallo(pendiente(), 'boom', T0).pendiente).toBe(true);
  });

  it('marca agotado al llegar al máximo', () => {
    const fallo = registrarFallo(pendiente({ intentos: MAX_INTENTOS - 1 }), 'boom', T0);
    expect(fallo.intentos).toBe(MAX_INTENTOS);
    expect(fallo.agotado).toBe(true);
  });

  it('recorta el error: GitHub puede contestar un HTML entero', () => {
    const fallo = registrarFallo(pendiente(), 'x'.repeat(5000), T0);
    expect(fallo.ultimoError.length).toBeLessThanOrEqual(300);
  });

  it('sin mensaje deja algo legible en vez de "undefined"', () => {
    expect(registrarFallo(pendiente(), undefined, T0).ultimoError).toBe('error sin mensaje');
  });
});

describe('vuelta a la normalidad — el contador se resetea (B-13)', () => {
  it('un disparo exitoso baja el flag y limpia el contador', () => {
    const exito = registrarExito(T0);
    expect(exito).toMatchObject({ pendiente: false, intentos: 0, ultimoError: null, agotado: false });
    expect(decidirDisparo({ ...pendiente(), ...exito }, T0 + 60 * MINUTO).motivo).toBe(
      'sin-pendiente',
    );
  });

  it('un cambio nuevo rearma los intentos después de haberlos agotado', () => {
    // El caso real: el PAT venció, se agotaron los reintentos, el dueño lo
    // renovó. La próxima edición de una actividad tiene que volver a disparar
    // sin que nadie toque el documento a mano.
    const agotado = pendiente({ intentos: MAX_INTENTOS, agotado: true, ultimoIntento: ts(T0) });
    expect(decidirDisparo(agotado, T0 + 60 * MINUTO).motivo).toBe('agotado');

    const remarcado = { ...agotado, pendiente: true, ...CAMPOS_REARME };
    expect(decidirDisparo(remarcado, T0 + 60 * MINUTO)).toEqual({ accion: 'disparar', intento: 1 });
  });

  it('la secuencia completa: falla, reintenta, se agota, y se recupera', () => {
    let estado: Record<string, unknown> = pendiente();
    let ahora = T0;
    const intentos: number[] = [];

    // 24 horas de ticks cada 5 minutos con GitHub caído.
    for (let tick = 0; tick < 288; tick += 1) {
      const d = decidirDisparo(estado, ahora);
      if (d.accion === 'disparar') {
        intentos.push(ahora - T0);
        estado = { ...estado, ...registrarFallo(estado, 'HTTP 500', ahora) };
      }
      ahora += 5 * MINUTO;
    }

    // Cinco intentos y se detiene: sin el límite serían 288.
    expect(intentos).toHaveLength(MAX_INTENTOS);
    expect(intentos.map((ms) => ms / MINUTO)).toEqual([0, 5, 15, 35, 75]);
    expect(estado.agotado).toBe(true);
    expect(estado.ultimoError).toBe('HTTP 500');

    // GitHub volvió y el dueño editó una actividad: rearma y dispara.
    const remarcado = { ...estado, pendiente: true, ...CAMPOS_REARME };
    expect(decidirDisparo(remarcado, ahora).accion).toBe('disparar');
    const exito = registrarExito(ahora);
    expect(decidirDisparo({ ...remarcado, ...exito }, ahora).motivo).toBe('sin-pendiente');
  });
});
