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
import { FORMATO_VERSION, construirEvento } from '@/lib/analytics-eventos';
import {
  ENTRADAS_DE_BUILD,
  componerVersion,
  infoVersion,
  versionBase,
  versionesPosibles,
} from '../scripts/version.mjs';

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

describe('el pie del panel — qué muestra según el estado', () => {
  /**
   * `PieVersion` es JSX y no hay testing-library (B-08), así que se testea la
   * decisión que toma, que es la parte que puede estar mal: cuándo decir que
   * hay una actualización disponible y cuándo ofrecer el botón.
   *
   * Replica las dos condiciones del componente. Si alguna cambia allá y no
   * acá, este test deja de proteger nada — está anotado en B-08.
   */
  const hayActualizacion = (actual: string, publicada: string | null) =>
    Boolean(publicada) && publicada !== actual;

  const ofreceBoton = (accion: string, actual: string, publicada: string | null) =>
    hayActualizacion(actual, publicada) && accion !== 'recargar';

  it('no anuncia nada cuando la versión corriendo es la publicada', () => {
    expect(hayActualizacion('1.0.0+abc', '1.0.0+abc')).toBe(false);
  });

  it('anuncia la actualización cuando difieren', () => {
    expect(hayActualizacion('1.0.0+abc', '1.0.1+def')).toBe(true);
  });

  it('no anuncia nada si no se pudo leer la publicada', () => {
    // Sin red o sin /version.json: no se sabe. Insinuar que está al día sería
    // peor, y el pie lo dice como "no se pudo verificar".
    expect(hayActualizacion('1.0.0+abc', null)).toBe(false);
  });

  it('no ofrece el botón si el panel ya se va a recargar solo', () => {
    // Un botón que vive un segundo hasta que la página se recarga es ruido.
    expect(ofreceBoton('recargar', '1.0.0+abc', '1.0.1+def')).toBe(false);
  });

  it('ofrece el botón cuando la recarga automática no va a ocurrir', () => {
    // El caso real: hay un formulario con cambios sin guardar.
    expect(ofreceBoton('avisar', '1.0.0+abc', '1.0.1+def')).toBe(true);
  });

  it('no ofrece el botón si no hay nada que actualizar', () => {
    expect(ofreceBoton('nada', '1.0.0+abc', '1.0.0+abc')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// El formato de versión: un solo productor, un solo consumidor (B-88 · D-98)
// ────────────────────────────────────────────────────────────────────

/**
 * `scripts/version.mjs` **produce** el formato y `analytics-eventos.ts` lo
 * **consume**, y no pueden compartir el código: el productor importa
 * `node:child_process` y el consumidor viaja al navegador — el mismo motivo por
 * el que `CAMPOS_VALIDABLES` es una constante y no una derivación de zod (D-60).
 *
 * Hasta B-88 los dos lados derivaron por separado y se separaron: el build
 * estampaba `1.0.1+5e2cb50-sucio.20260821-2124` y la analítica lo mandaba como
 * `'otro'`, o sea que perdía el único dato que existía para atribuir un pico a
 * un deploy.
 *
 * **Este describe es el lazo.** No hay una lista de ejemplos copiada a mano: se
 * recorre el dominio completo de entradas de un build y se mete cada salida del
 * productor en el sanitizador real del consumidor. Un formato nuevo del lado
 * del build falla acá, no en producción y no en silencio.
 */
describe('el formato de versión que produce el build es el que la analítica acepta', () => {
  /** Lo que la analítica dejaría salir para esta versión. */
  const medida = (v: string): unknown =>
    construirEvento('panel_abierto', { version: v })!.params.version;

  const ahora = new Date('2026-08-21T21:24:33.000Z');

  it('las tres formas que el build puede estampar viajan enteras', () => {
    const posibles = versionesPosibles({ ahora });
    // Tres formas: con commit limpio, con commit sucio, y sin `.git`.
    expect(posibles).toHaveLength(3);
    for (const v of posibles) {
      expect(medida(v), `el build estampa ${v} y la analítica lo manda como otro`).toBe(v);
    }
  });

  it('el dominio de entradas está completo: hay commit o no, y el árbol está limpio o no', () => {
    // Si mañana `componerVersion` mira un hecho nuevo del build, la forma que
    // produzca queda fuera de `versionesPosibles()` y el lazo de arriba deja de
    // cubrirla. Esto lo fija: el dominio son las 2×2 combinaciones.
    expect(ENTRADAS_DE_BUILD).toHaveLength(4);
    for (const entrada of ENTRADAS_DE_BUILD) {
      expect(Object.keys(entrada).sort()).toEqual(['sha', 'sucio']);
    }
  });

  it('la versión que estampa ESTE árbol de trabajo la acepta la analítica', () => {
    // El lazo vivo: corre git de verdad. En CI el árbol está limpio y en la
    // máquina de quien trabaja casi nunca lo está, así que entre las dos se
    // cubren las dos ramas con commit — y las dos tienen que pasar.
    const { version } = infoVersion();
    expect(medida(version), `el build estampa ${version}`).toBe(version);
  });

  it('`sin-git` no depende de que el árbol esté sucio: un clone sin `.git` es una sola forma', () => {
    const limpio = componerVersion({ base: '1.0.1', sha: null, sucio: false, ahora });
    const sucio = componerVersion({ base: '1.0.1', sha: null, sucio: true, ahora });
    expect(limpio).toBe(sucio);
    expect(limpio).toBe('1.0.1+sin-git.20260821-2124');
  });

  it('el sello de tiempo distingue dos builds sucios del mismo commit', () => {
    const uno = componerVersion({ base: '1.0.1', sha: '5e2cb50', sucio: true, ahora });
    const dos = componerVersion({
      base: '1.0.1',
      sha: '5e2cb50',
      sucio: true,
      ahora: new Date('2026-08-21T22:00:00.000Z'),
    });
    expect(uno).not.toBe(dos);
    // Y el mismo commit limpio, dos veces, es la misma versión (D-36): el panel
    // no se recarga solo por un rebuild que no cambió el JS.
    expect(componerVersion({ base: '1.0.1', sha: '5e2cb50', sucio: false, ahora })).toBe(
      componerVersion({
        base: '1.0.1',
        sha: '5e2cb50',
        sucio: false,
        ahora: new Date('2026-09-01T10:00:00.000Z'),
      }),
    );
  });

  it('`versionBase` sale del package.json, que es la parte que mueve una persona', () => {
    expect(versionBase()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('aceptar el guion no abrió la puerta al texto libre', () => {
    // La otra mitad de B-88: el formato se amplió a lo que el build produce, no
    // se abrió. Nada de esto puede viajar como `version`.
    const rechazados = [
      'Taller de crónica urbana',
      'centinela-inscripciones@ejemplo.com',
      'https://zoom.us/j/999999',
      '1.0.1+5e2cb50 sucio',
      '1.0.1+' + 'a'.repeat(41),
      '1.0.1++5e2cb50',
      '1.0.1+-sucio',
      '1.0.1+',
    ];
    for (const v of rechazados) {
      expect(FORMATO_VERSION.test(v), v).toBe(false);
      expect(medida(v), v).toBe('otro');
    }
    // Un semver sin sufijo es legítimo: es lo que se ve si alguien estampa la
    // versión a mano.
    expect(medida('1.0.1')).toBe('1.0.1');
  });
});
