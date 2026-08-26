import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SALTOS_DE_FECHA,
  conInicioNuevo,
  correrSesion,
  nombreDelSalto,
  resumirSesion,
} from '@/components/admin/SesionesEditor';
import { sesionVacia } from '@/lib/sesiones';
import type { SesionForm } from '@/types/actividad';

/**
 * B-186 — correr la fecha de un encuentro sin pelear con el almanaque nativo.
 *
 * El reporte era «el almanaque se cierra si no pongo rápido la fecha», y el
 * diagnóstico terminó afuera del repo: el almanaque es el selector nativo de
 * `<input type="datetime-local">` y nada nuestro corre mientras está abierto.
 * Por eso lo que se testea acá no es "el almanaque no se cierra" —no se puede—
 * sino las tres cosas que hacen que **no haga falta abrirlo**: los saltos, la
 * duración que se conserva, y el día de la semana en palabras.
 *
 * Es lógica pura exportada del `.tsx`, así que se ejercita de verdad y no
 * leyendo el fuente: el panel no tiene testing-library (B-08) pero importar una
 * función que no toca el DOM no la necesita.
 */

const sesion = (inicio: string, fin: string, extra: Partial<SesionForm> = {}): SesionForm => ({
  ...sesionVacia(),
  inicio,
  fin,
  ...extra,
});

describe('correrSesion mueve inicio y fin juntos', () => {
  it('una semana adelante corre las dos fechas y conserva el día', () => {
    const r = correrSesion(sesion('2026-09-10T19:00', '2026-09-10T21:00'), 7);
    expect(r.inicio).toBe('2026-09-17T19:00');
    expect(r.fin).toBe('2026-09-17T21:00');
  });

  it('una semana atrás también', () => {
    const r = correrSesion(sesion('2026-09-10T19:00', '2026-09-10T21:00'), -7);
    expect(r.inicio).toBe('2026-09-03T19:00');
    expect(r.fin).toBe('2026-09-03T21:00');
  });

  it('un día cruza el fin de mes sin que nadie tenga que contar', () => {
    const r = correrSesion(sesion('2026-09-30T19:00', '2026-09-30T21:00'), 1);
    expect(r.inicio).toBe('2026-10-01T19:00');
    expect(r.fin).toBe('2026-10-01T21:00');
  });

  it('la duración no cambia, aunque el encuentro pase de medianoche', () => {
    const r = correrSesion(sesion('2026-09-10T23:00', '2026-09-11T01:30'), 7);
    expect(r.inicio).toBe('2026-09-17T23:00');
    expect(r.fin).toBe('2026-09-18T01:30');
  });

  /**
   * La red que importa: mover una fecha no puede perder el evento que ya está en
   * el calendario de la gente. El diff del §7.2 cruza por `id` (trampa 2) y sin
   * `calendarEventId` crea un **segundo** evento para el mismo encuentro en vez
   * de moverlo.
   */
  it('conserva id, calendarEventId, cancelada y el contenido de la fila', () => {
    const original = sesion('2026-09-10T19:00', '2026-09-10T21:00', {
      id: 'ses_fijo',
      calendarEventId: 'evt_123',
      cancelada: true,
      tema: 'Cap. 1-4',
      lectura: 'Rulfo',
    });
    const r = correrSesion(original, 7);
    expect(r.id).toBe('ses_fijo');
    expect(r.calendarEventId).toBe('evt_123');
    expect(r.cancelada).toBe(true);
    expect(r.tema).toBe('Cap. 1-4');
    expect(r.lectura).toBe('Rulfo');
  });

  it('sin inicio legible no hay desde dónde correr: la fila vuelve igual', () => {
    const vacia = sesion('', '');
    expect(correrSesion(vacia, 7)).toEqual(vacia);
    const roto = sesion('no es una fecha', '2026-09-10T21:00');
    expect(correrSesion(roto, 7)).toEqual(roto);
  });

  it('con inicio bueno y fin ilegible corre el inicio y no le inventa un fin', () => {
    const r = correrSesion(sesion('2026-09-10T19:00', ''), 7);
    expect(r.inicio).toBe('2026-09-17T19:00');
    expect(r.fin).toBe('');
  });

  it('los cuatro saltos son los que la UI ofrece, y son simétricos', () => {
    expect(SALTOS_DE_FECHA.map((s) => s.dias)).toEqual([-7, -1, 1, 7]);
  });

  it('cada salto se dice con palabras, para el lector de pantalla', () => {
    // El «−» de las etiquetas es un signo menos tipográfico y no se lee.
    expect(nombreDelSalto(-7)).toBe('una semana antes');
    expect(nombreDelSalto(7)).toBe('una semana después');
    expect(nombreDelSalto(-1)).toBe('1 día antes');
    expect(nombreDelSalto(1)).toBe('1 día después');
    expect(nombreDelSalto(3)).toBe('3 días después');
  });
});

describe('conInicioNuevo conserva la duración', () => {
  it('cambiar el día mueve el fin lo mismo: una fecha en vez de dos', () => {
    const r = conInicioNuevo(sesion('2026-09-10T19:00', '2026-09-10T21:00'), '2026-09-24T19:00');
    expect(r.fin).toBe('2026-09-24T21:00');
  });

  it('cambiar solo la hora también', () => {
    const r = conInicioNuevo(sesion('2026-09-10T19:00', '2026-09-10T21:30'), '2026-09-10T20:00');
    expect(r.inicio).toBe('2026-09-10T20:00');
    expect(r.fin).toBe('2026-09-10T22:30');
  });

  /**
   * Sin esto, el estado intermedio de tipear el inicio dejaba `fin <= inicio`,
   * que es lo que `schema.ts` rechaza al guardar («el fin tiene que ser
   * posterior al inicio»). Con la duración conservada ese estado no se produce.
   */
  it('el fin nunca queda antes del inicio nuevo', () => {
    const r = conInicioNuevo(sesion('2026-09-10T19:00', '2026-09-10T21:00'), '2026-12-01T19:00');
    expect(new Date(r.fin).getTime()).toBeGreaterThan(new Date(r.inicio).getTime());
  });

  it('mientras se tipea, un inicio a medio completar no toca el fin', () => {
    // Un `datetime-local` incompleto reporta `''`.
    const r = conInicioNuevo(sesion('2026-09-10T19:00', '2026-09-10T21:00'), '');
    expect(r.inicio).toBe('');
    expect(r.fin).toBe('2026-09-10T21:00');
  });

  it('sin fin legible no hay duración que conservar: se guarda el inicio y nada más', () => {
    const r = conInicioNuevo(sesion('2026-09-10T19:00', ''), '2026-09-24T19:00');
    expect(r.inicio).toBe('2026-09-24T19:00');
    expect(r.fin).toBe('');
  });

  it('un fin que ya venía antes del inicio no se arrastra ni se corrige solo', () => {
    // Corregirlo acá esconde un dato que la persona cargó mal; el resumen lo
    // nombra y el schema lo rechaza.
    const r = conInicioNuevo(sesion('2026-09-10T19:00', '2026-09-10T18:00'), '2026-09-24T19:00');
    expect(r.inicio).toBe('2026-09-24T19:00');
    expect(r.fin).toBe('2026-09-10T18:00');
  });

  it('conserva id y calendarEventId, igual que correrSesion', () => {
    const r = conInicioNuevo(
      sesion('2026-09-10T19:00', '2026-09-10T21:00', { id: 'ses_fijo', calendarEventId: 'evt_1' }),
      '2026-09-24T19:00',
    );
    expect(r.id).toBe('ses_fijo');
    expect(r.calendarEventId).toBe('evt_1');
  });
});

describe('resumirSesion dice en qué día cae', () => {
  it('nombra el día de la semana, que es lo que se iba a buscar al almanaque', () => {
    expect(resumirSesion(sesion('2026-09-10T19:00', '2026-09-10T21:00')).dia).toBe(
      'jueves, 10 de septiembre',
    );
  });

  it('correr una semana no cambia el día de la semana', () => {
    const original = sesion('2026-09-10T19:00', '2026-09-10T21:00');
    expect(resumirSesion(correrSesion(original, 7)).dia).toContain('jueves');
    expect(resumirSesion(correrSesion(original, -7)).dia).toContain('jueves');
  });

  it('la duración se lee en horas y minutos', () => {
    expect(resumirSesion(sesion('2026-09-10T19:00', '2026-09-10T21:00')).duracion).toBe('2 h');
    expect(resumirSesion(sesion('2026-09-10T19:00', '2026-09-10T20:30')).duracion).toBe(
      '1 h 30 min',
    );
    expect(resumirSesion(sesion('2026-09-10T19:00', '2026-09-10T19:45')).duracion).toBe('45 min');
  });

  it('un fin anterior al inicio se nombra, en vez de aparecer recién al guardar', () => {
    const r = resumirSesion(sesion('2026-09-10T19:00', '2026-09-10T18:00'));
    expect(r.finAntesDelInicio).toBe(true);
    expect(r.duracion).toBeNull();
  });

  it('un fin igual al inicio también: el schema pide posterior, no distinto', () => {
    expect(resumirSesion(sesion('2026-09-10T19:00', '2026-09-10T19:00')).finAntesDelInicio).toBe(
      true,
    );
  });

  it('sin inicio no afirma nada, ni que el fin esté al revés', () => {
    expect(resumirSesion(sesion('', ''))).toEqual({
      dia: null,
      duracion: null,
      finAntesDelInicio: false,
    });
  });

  it('con inicio y sin fin dice el día y no inventa duración', () => {
    const r = resumirSesion(sesion('2026-09-10T19:00', ''));
    expect(r.dia).toBe('jueves, 10 de septiembre');
    expect(r.duracion).toBeNull();
    expect(r.finAntesDelInicio).toBe(false);
  });
});

/**
 * Que el editor **use** lo de arriba. Las funciones puras pueden estar perfectas
 * y el input seguir escribiendo el string crudo, que era el estado anterior.
 *
 * Se lee el fuente con los comentarios afuera: este archivo cita el código viejo
 * en la prosa, y un aserto que lee prosa mide la prosa (D-124).
 */
describe('el editor de encuentros usa los saltos y la duración conservada', () => {
  const editor = (): string =>
    readFileSync(
      fileURLToPath(new URL('../src/components/admin/SesionesEditor.tsx', import.meta.url)),
      'utf8',
    )
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, ' ');

  it('el campo de inicio pasa por conInicioNuevo y no escribe el string crudo', () => {
    // Se afirma la **llamada** y no el nombre: el nombre solo lo satisface la
    // definición de la función, tres pantallas más arriba.
    expect(editor()).toContain('conInicioNuevo(x, e.target.value)');
    expect(editor()).not.toContain('editar(s.id, { inicio: e.target.value })');
  });

  it('los botones de correr llaman a correrSesion con el salto de la lista', () => {
    expect(editor()).toContain('correrSesion(x, dias)');
    expect(editor()).toContain('SALTOS_DE_FECHA.map(');
  });

  it('cada botón de correr tiene nombre para el lector de pantalla', () => {
    expect(editor()).toContain('nombreDelSalto(dias)');
  });

  it('la fila muestra el resumen del día', () => {
    expect(editor()).toContain('resumirSesion(s)');
    expect(editor()).toContain('resumen.dia');
  });

  /**
   * Mobile (docs/05-patrones.md): los botones de la fila mantienen el blanco
   * táctil de 44px. `claseBotonFila` es el que ya lo garantiza para «Duplicar» y
   * «Borrar», que quedan igual de pegados que estos.
   */
  it('los botones de correr usan la clase que trae el blanco táctil', () => {
    const src = editor();
    // Del `.map(` de los saltos hasta el cierre de su `<button>`: es el único
    // recorte que no se puede satisfacer con la clase de otro botón de la fila.
    const bloque = /SALTOS_DE_FECHA\.map\(([\s\S]*?)<\/button>/.exec(src)?.[1] ?? '';
    expect(bloque, 'no se encontró el bloque de los botones de correr').not.toBe('');
    expect(bloque).toContain('claseBotonFila');
  });
});
