/**
 * El barrido falla cuando debe, y dice qué se escapó.
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { construirEvento } from '../../functions/calendario.js';
import { LABELS_CENTINELA, actividadCentinela } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';
import { PERMITIDO_EN_LA_PROYECCION, PERMITIDO_EN_EVENTO_DE_CALENDAR } from '../fixtures/barrido-de-salidas';

// ───────────────────────────────────────────────────────────────────────────
// Que el barrido falle cuando debe. Un barrido que nadie vio fallar no vale.
// ───────────────────────────────────────────────────────────────────────────

describe('el barrido falla cuando debe, y dice qué se escapó', () => {
  const actividad = actividadCentinela();

  it('una fuga en la proyección falla nombrando el centinela y la salida', () => {
    // La fuga más plausible: alguien agrega la difusión a la proyección "para
    // que el sitio pueda mostrar los handles".
    const conFuga = {
      ...toPublic(actividad, 'act_centinela'),
      difusion: actividad.difusion,
    };
    let error: unknown;
    try {
      barrer('proyección de la actividad (toPublic)', JSON.stringify(conFuga), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      error = e;
    }
    const mensaje = String((error as Error | undefined)?.message ?? '');
    expect(error, 'el barrido tenía que fallar con la difusión adentro').toBeDefined();
    expect(mensaje).toContain('FUGA DE PRIVACIDAD');
    // B-181 — la salida se nombra por lo que es: lo barrido es `toPublic`, no el
    // archivo `dist/events.json` (que es el índice). El nombre viejo mandaba a
    // buscar la fuga al archivo equivocado.
    expect(mensaje).toContain('proyección de la actividad');
    expect(mensaje).toContain('difusion.notas');
    expect(mensaje).toContain('difusion.arrobar');
  });

  it('una fuga en la descripción del evento falla nombrando el centinela', () => {
    // El caso real que motivó B-196: `construirDescripcion` son ~15
    // interpolaciones a mano, y la de más se lee bien («el link, para que lo
    // tengan a mano»).
    const evento = construirEvento(actividad, actividad.sesiones[0], LABELS_CENTINELA);
    const conFuga = {
      ...evento,
      description: `${evento.description}\n\nLink: ${actividad.online!.url}`,
    };
    let error: unknown;
    try {
      barrer('evento de Calendar', JSON.stringify(conFuga), PERMITIDO_EN_EVENTO_DE_CALENDAR);
    } catch (e) {
      error = e;
    }
    const mensaje = String((error as Error | undefined)?.message ?? '');
    expect(error, 'el barrido tenía que fallar con el link de la reunión adentro').toBeDefined();
    expect(mensaje).toContain('FUGA DE PRIVACIDAD');
    expect(mensaje).toContain('evento de Calendar');
    expect(mensaje).toContain('online.url');
  });

  it('dejar de publicar algo permitido también falla, y no como fuga', () => {
    // La otra dirección: una proyección que se queda corta. Sin esto, el barrido
    // pasaría con `toPublic` devolviendo un objeto vacío.
    const sinLibro = toPublic(actividadCentinela({ libro: null }), 'act_sin_libro');
    let error: unknown;
    try {
      barrer('proyección de la actividad (toPublic)', JSON.stringify(sinLibro), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      error = e;
    }
    const mensaje = String((error as Error | undefined)?.message ?? '');
    expect(error, 'el barrido tenía que notar que el libro no salió').toBeDefined();
    expect(mensaje).toContain('dejó de publicar');
    expect(mensaje).toContain('libro.titulo');
  });
});
