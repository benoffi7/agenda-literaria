/**
 * El motivo de la cancelación sale solo con el encuentro cancelado (B-98).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { construirIndice } from '@/lib/eventsJson';
import { construirEvento } from '../../functions/calendario.js';
import { construirTextoRedes } from '@/lib/textoRedes';
import { CENTINELA, LABELS_CENTINELA, actividadCentinela, opcionCentinela } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';
import { PERMITIDO_EN_LA_PROYECCION, PERMITIDO_EN_EVENTO_DE_CALENDAR, MOTIVO_DE_CANCELACION } from '../fixtures/barrido-de-salidas';

/** El fixture con **todos** los encuentros cancelados, conservando su motivo. */
const todoCancelado = () =>
  actividadCentinela({
    sesiones: actividadCentinela().sesiones.map((s) => ({ ...s, cancelada: true })),
  });

describe('el motivo de la cancelación sale solo con el encuentro cancelado — B-98', () => {
  it('en el fixture base (encuentros vivos) el motivo cargado no sale por ninguna puerta', () => {
    const actividad = actividadCentinela();
    // Control positivo: el motivo está cargado, así que el `not` mide algo.
    expect(actividad.sesiones[0]!.motivoCancelacion).toBe(CENTINELA['sesiones.motivoCancelacion']);
    const motivo = CENTINELA['sesiones.motivoCancelacion'];
    expect(JSON.stringify(toPublic(actividad, 'act_centinela'))).not.toContain(motivo);
    for (const sesion of actividad.sesiones) {
      expect(JSON.stringify(construirEvento(actividad, sesion, LABELS_CENTINELA))).not.toContain(
        motivo,
      );
    }
  });

  it('cancelados: la proyección lo lleva y nada más cambia', () => {
    barrer(
      'proyección de la actividad (toPublic, encuentros cancelados)',
      JSON.stringify(toPublic(todoCancelado(), 'act_centinela')),
      [...PERMITIDO_EN_LA_PROYECCION, MOTIVO_DE_CANCELACION],
    );
  });

  it('cancelados: el evento de cada encuentro lo lleva, y nada más cambia', () => {
    const actividad = todoCancelado();
    for (const sesion of actividad.sesiones) {
      const evento = construirEvento(actividad, sesion, LABELS_CENTINELA);
      expect(evento.summary.startsWith('CANCELADO — ')).toBe(true);
      barrer(
        `evento de Calendar cancelado (${sesion.id})`,
        JSON.stringify(evento),
        [...PERMITIDO_EN_EVENTO_DE_CALENDAR, MOTIVO_DE_CANCELACION],
      );
    }
  });

  it('cancelados: el índice del listado (`events.json`) no lo lleva', () => {
    const indice = construirIndice({
      actividades: [toPublic(todoCancelado(), 'act_centinela')],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    expect(JSON.stringify(indice)).not.toContain(CENTINELA['sesiones.motivoCancelacion']);
  });

  it('cancelados: el texto para redes no lo lleva', () => {
    // Uno solo cancelado: con todos, no hay nada que anunciar y no hay texto.
    const unoCancelado = actividadCentinela({
      sesiones: actividadCentinela().sesiones.map((s, i) => ({ ...s, cancelada: i === 0 })),
    });
    const r = construirTextoRedes(
      unoCancelado as never,
      'anuncio',
      new Date('2020-01-01T00:00:00Z'),
      LABELS_CENTINELA,
    );
    expect(r.ok, 'el fixture cancelado dejó de producir texto para redes').toBe(true);
    if (r.ok) expect(r.texto).not.toContain(CENTINELA['sesiones.motivoCancelacion']);
  });
});
