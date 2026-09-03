/**
 * `functions/reconciliacion.js` — la otra mitad de B-125 (D-293): qué
 * sesiones hay que verificar contra Calendar y qué significa cada respuesta.
 * Sin red, igual que `calendario.test.ts` y `sincronizacion.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_VERIFICACION_POR_CORRIDA,
  interpretarExistencia,
  planificarReparacion,
  sesionesAVerificar,
} from '../functions/reconciliacion.js';
import { cicloDeOcho, sesionesDeCiclo } from './fixtures/ciclo';

describe('sesionesAVerificar — qué sesiones dependen de un id que nadie comparó contra Calendar', () => {
  it('candidata: publicada, no cancelada, con calendarEventId', () => {
    const actividad = { id: 'act1', ...cicloDeOcho() };
    const { candidatas, truncado } = sesionesAVerificar([actividad]);
    expect(candidatas).toHaveLength(8);
    expect(truncado).toBe(false);
    expect(candidatas.map((c) => c.sesion.id)).toEqual(actividad.sesiones.map((s) => s.id));
    expect(candidatas.every((c) => c.actividadId === 'act1')).toBe(true);
  });

  it('un encuentro cancelado no es candidato: no debería existir, así que no hay nada que verificar', () => {
    const actividad = {
      id: 'act1',
      ...cicloDeOcho({ sesiones: sesionesDeCiclo({ canceladas: [2] }) }),
    };
    const { candidatas } = sesionesAVerificar([actividad]);
    expect(candidatas).toHaveLength(7);
    expect(candidatas.some((c) => c.sesion.id === actividad.sesiones[2].id)).toBe(false);
  });

  it('una actividad en borrador no aporta candidatas, aunque sus sesiones tengan un id colgado', () => {
    // `sobra-en-calendario`: un id vivo cuando no debería existir es un
    // problema de escritura, no de verificación contra Calendar (ver el
    // comentario del fuente).
    const actividad = { id: 'act1', ...cicloDeOcho({ estado: 'borrador' }) };
    expect(sesionesAVerificar([actividad]).candidatas).toHaveLength(0);
  });

  it('una sesión sin calendarEventId no es candidata: nada que comparar', () => {
    const actividad = {
      id: 'act1',
      ...cicloDeOcho({ sesiones: sesionesDeCiclo({ conEventos: false }) }),
    };
    expect(sesionesAVerificar([actividad]).candidatas).toHaveLength(0);
  });

  it('sin actividades, ninguna candidata (y no explota con undefined)', () => {
    expect(sesionesAVerificar([]).candidatas).toEqual([]);
    expect(sesionesAVerificar(undefined).candidatas).toEqual([]);
  });

  /**
   * El tope no es un detalle: sin él, una corrida sobre muchas actividades
   * publicadas puede comerse varios minutos en llamadas de a una a Calendar
   * (comentario del fuente). Se verifica con más candidatas que el tope, no
   * ajustando el tope al fixture.
   */
  it('corta en el tope y lo avisa con `truncado`', () => {
    const actividades = Array.from({ length: 30 }, (_, i) => ({
      id: `act${i}`,
      ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 8 }) }),
    })); // 240 sesiones candidatas > 200 (30 × 8, y el tope corta justo en 25 × 8)
    const { candidatas, truncado } = sesionesAVerificar(actividades);
    expect(candidatas).toHaveLength(MAX_VERIFICACION_POR_CORRIDA);
    expect(truncado).toBe(true);
  });

  /**
   * Lo encontró el `auditor-trampas` (P1): sin un cursor real, "correr de
   * nuevo" repetía siempre las mismas primeras `MAX_VERIFICACION_POR_CORRIDA`
   * candidatas — una sesión borrada a mano más allá del tope no se detectaba
   * jamás, aunque el mensaje dijera lo contrario. El corte es por
   * **actividad**, no por sesión: así el cursor apunta a una actividad
   * completa y la corrida siguiente no repite ni saltea ninguna sesión.
   */
  it('el cursor apunta a la última actividad procesada ENTERA, no a mitad de una', () => {
    const actividades = Array.from({ length: 30 }, (_, i) => ({
      id: `act${String(i).padStart(2, '0')}`,
      ...cicloDeOcho({ sesiones: sesionesDeCiclo({ cantidad: 8 }) }),
    }));
    const { candidatas, siguienteCursor } = sesionesAVerificar(actividades);
    // 200 / 8 = 25 actividades completas (act00..act24); la 26ª (act25) queda
    // afuera, así que el cursor es la última que SÍ entró.
    expect(siguienteCursor).toBe('act24');
    expect(candidatas.every((c) => c.actividadId <= 'act24')).toBe(true);
    expect(candidatas.some((c) => c.actividadId === 'act25')).toBe(false);
  });

  it('sin truncar, no hay cursor', () => {
    const actividades = [{ id: 'act1', ...cicloDeOcho() }];
    expect(sesionesAVerificar(actividades).siguienteCursor).toBeNull();
  });

  it('no trunca cuando entra justo', () => {
    const actividades = [{ id: 'act1', ...cicloDeOcho() }]; // 8, muy por debajo del tope
    expect(sesionesAVerificar(actividades).truncado).toBe(false);
  });
});

describe('interpretarExistencia — qué dice una respuesta de Calendar (B-125)', () => {
  it('respuesta ok con un status normal: existe', () => {
    expect(interpretarExistencia({ ok: true, status: 'confirmed' })).toBe('existe');
    expect(interpretarExistencia({ ok: true, status: undefined })).toBe('existe');
  });

  it('respuesta ok pero con status "cancelled": no existe (Calendar no siempre da 404)', () => {
    expect(interpretarExistencia({ ok: true, status: 'cancelled' })).toBe('no-existe');
  });

  it('404 y 410 son "no existe" — los mismos códigos que decidirAnteFallo (D-191)', () => {
    expect(interpretarExistencia({ ok: false, code: 404 })).toBe('no-existe');
    expect(interpretarExistencia({ ok: false, code: 410 })).toBe('no-existe');
    // String también: `e.code` puede venir como texto según la librería.
    expect(interpretarExistencia({ ok: false, code: '404' })).toBe('no-existe');
  });

  /**
   * El caso que importa que NO se interprete como "borrado a mano": un código
   * ambiguo (permisos, cuota, red) no dice nada del evento puntual. Tratarlo
   * como "no existe" repararía (recrearía el evento) sobre una sospecha, y un
   * duplicado es peor que no decir nada.
   */
  it('cualquier otro código es "desconocido", nunca "no-existe"', () => {
    for (const code of [403, 500, 0, undefined, null]) {
      expect(interpretarExistencia({ ok: false, code })).toBe('desconocido');
    }
  });
});

describe('planificarReparacion — separa qué reparar de qué no se pudo verificar', () => {
  const candidatas = [
    { actividadId: 'a', actividad: {}, sesion: { id: 's1' } },
    { actividadId: 'a', actividad: {}, sesion: { id: 's2' } },
    { actividadId: 'b', actividad: {}, sesion: { id: 's3' } },
  ];

  it('no-existe va a reparar; desconocido y existe no', () => {
    const resultados = new Map([
      ['s1', 'no-existe'],
      ['s2', 'existe'],
      ['s3', 'desconocido'],
    ]);
    const { reparar, desconocidos } = planificarReparacion(candidatas, resultados);
    expect(reparar.map((c) => c.sesion.id)).toEqual(['s1']);
    expect(desconocidos.map((c) => c.sesion.id)).toEqual(['s3']);
  });

  /**
   * Falla segura: una candidata que no llegó a tener resultado (la corrida se
   * cortó a mitad de camino) se trata como "desconocido", nunca como
   * "reparar". Reparar por default sobre un dato ausente crearía eventos sin
   * ninguna confirmación de que hacían falta.
   */
  it('una candidata sin entrada en el mapa de resultados es "desconocido", no "reparar"', () => {
    const { reparar, desconocidos } = planificarReparacion(candidatas, new Map());
    expect(reparar).toEqual([]);
    expect(desconocidos.map((c) => c.sesion.id)).toEqual(['s1', 's2', 's3']);
  });

  it('todo existe: no hay nada que reparar ni desconocidos', () => {
    const resultados = new Map(candidatas.map((c) => [c.sesion.id, 'existe']));
    expect(planificarReparacion(candidatas, resultados)).toEqual({
      reparar: [],
      desconocidos: [],
    });
  });
});
