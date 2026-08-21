import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MINIMO_ENTRE_CHEQUEOS_MS,
  VERSION_DESCONOCIDA,
  debeChequear,
  decidirAccion,
  hayVersionNueva,
  parsearInfoVersion,
} from '@/lib/version';
import {
  hayCambiosSinGuardar,
  marcarCambiosSinGuardar,
  observarCambiosSinGuardar,
} from '@/lib/formulario-sucio';

const VIEJA = '0.1.0+a1b2c3d';
const NUEVA = '0.1.0+e4f5a6b';

describe('hayVersionNueva — comparación', () => {
  it('dos versiones distintas quieren recarga', () => {
    expect(hayVersionNueva(VIEJA, NUEVA)).toBe(true);
  });

  it('la misma versión no quiere nada', () => {
    expect(hayVersionNueva(VIEJA, VIEJA)).toBe(false);
  });

  it('un rollback también cuenta como distinta: la pestaña quedó desalineada igual', () => {
    expect(hayVersionNueva(NUEVA, VIEJA)).toBe(true);
  });

  it('sin versión publicada no se compara nada', () => {
    expect(hayVersionNueva(VIEJA, null)).toBe(false);
    expect(hayVersionNueva(VIEJA, undefined)).toBe(false);
    expect(hayVersionNueva(VIEJA, '')).toBe(false);
  });

  it('en dev, sin versión estampada, no se recarga por ruido', () => {
    expect(hayVersionNueva(VERSION_DESCONOCIDA, NUEVA)).toBe(false);
    expect(hayVersionNueva(VIEJA, VERSION_DESCONOCIDA)).toBe(false);
  });
});

describe('parsearInfoVersion — respuesta defensiva', () => {
  it('acepta el JSON esperado', () => {
    expect(parsearInfoVersion({ version: NUEVA, generadoEn: '2026-08-21T21:00:00.000Z' })).toEqual({
      version: NUEVA,
      generadoEn: '2026-08-21T21:00:00.000Z',
    });
  });

  it('tolera que falte generadoEn', () => {
    expect(parsearInfoVersion({ version: NUEVA })).toEqual({ version: NUEVA, generadoEn: '' });
  });

  it('descarta cualquier cosa que no sea nuestro JSON', () => {
    // El HTML de un 404, un portal cautivo de wifi, un array vacío.
    expect(parsearInfoVersion('<!doctype html>')).toBeNull();
    expect(parsearInfoVersion(null)).toBeNull();
    expect(parsearInfoVersion([])).toBeNull();
    expect(parsearInfoVersion({ version: '' })).toBeNull();
    expect(parsearInfoVersion({ version: '   ' })).toBeNull();
    expect(parsearInfoVersion({ version: 42 })).toBeNull();
  });
});

describe('decidirAccion — recargar, avisar o no hacer nada', () => {
  it('sin versión nueva no hace nada, ni con el formulario sucio', () => {
    expect(
      decidirAccion({ actual: VIEJA, publicada: VIEJA, hayCambiosSinGuardar: true }),
    ).toEqual({ accion: 'nada', motivo: null });
  });

  it('todavía no se sabe qué hay publicado: no hace nada', () => {
    expect(
      decidirAccion({ actual: VIEJA, publicada: null, hayCambiosSinGuardar: false }),
    ).toEqual({ accion: 'nada', motivo: null });
  });

  it('versión nueva y nada en juego: recarga sola', () => {
    expect(
      decidirAccion({ actual: VIEJA, publicada: NUEVA, hayCambiosSinGuardar: false }),
    ).toEqual({ accion: 'recargar', motivo: null });
  });

  it('versión nueva con cambios sin guardar: avisa, NUNCA recarga (§11 — son 30+ campos)', () => {
    expect(
      decidirAccion({ actual: VIEJA, publicada: NUEVA, hayCambiosSinGuardar: true }),
    ).toEqual({ accion: 'avisar', motivo: 'cambios-sin-guardar' });
  });

  it('ya se recargó por esta versión y sigue igual: avisa en vez de entrar en loop', () => {
    expect(
      decidirAccion({
        actual: VIEJA,
        publicada: NUEVA,
        hayCambiosSinGuardar: false,
        yaSeRecargoPara: NUEVA,
      }),
    ).toEqual({ accion: 'avisar', motivo: 'recarga-sin-efecto' });
  });

  it('la marca de una recarga anterior no bloquea una versión distinta', () => {
    expect(
      decidirAccion({
        actual: VIEJA,
        publicada: NUEVA,
        hayCambiosSinGuardar: false,
        yaSeRecargoPara: '0.1.0+viejisima',
      }),
    ).toEqual({ accion: 'recargar', motivo: null });
  });

  it('el formulario sucio manda sobre la protección anti-loop', () => {
    expect(
      decidirAccion({
        actual: VIEJA,
        publicada: NUEVA,
        hayCambiosSinGuardar: true,
        yaSeRecargoPara: NUEVA,
      }),
    ).toEqual({ accion: 'avisar', motivo: 'cambios-sin-guardar' });
  });
});

describe('debeChequear — sin polling agresivo', () => {
  it('el primer chequeo siempre pasa', () => {
    expect(debeChequear(1_000, null)).toBe(true);
  });

  it('volver a la pestaña cinco veces en un minuto es un solo chequeo', () => {
    const t0 = 1_000_000;
    expect(debeChequear(t0 + 1_000, t0)).toBe(false);
    expect(debeChequear(t0 + 30_000, t0)).toBe(false);
  });

  it('pasado el mínimo vuelve a chequear', () => {
    const t0 = 1_000_000;
    expect(debeChequear(t0 + MINIMO_ENTRE_CHEQUEOS_MS, t0)).toBe(true);
  });
});

describe('formulario-sucio — el store que evita perder el trabajo', () => {
  beforeEach(() => marcarCambiosSinGuardar(false));

  it('arranca limpio', () => {
    expect(hayCambiosSinGuardar()).toBe(false);
  });

  it('avisa a los suscriptos solo cuando el valor cambia', () => {
    const oyente = vi.fn();
    const desuscribir = observarCambiosSinGuardar(oyente);

    marcarCambiosSinGuardar(true);
    marcarCambiosSinGuardar(true);
    expect(oyente).toHaveBeenCalledTimes(1);
    expect(hayCambiosSinGuardar()).toBe(true);

    marcarCambiosSinGuardar(false);
    expect(oyente).toHaveBeenCalledTimes(2);

    desuscribir();
    marcarCambiosSinGuardar(true);
    expect(oyente).toHaveBeenCalledTimes(2);
  });

  it('una decisión de recarga lee el estado real del store', () => {
    marcarCambiosSinGuardar(true);
    expect(
      decidirAccion({
        actual: VIEJA,
        publicada: NUEVA,
        hayCambiosSinGuardar: hayCambiosSinGuardar(),
      }).accion,
    ).toBe('avisar');
  });
});
