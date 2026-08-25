import { describe, expect, it } from 'vitest';
import {
  aDatetimeLocal,
  deDatetimeLocal,
  duplicarSesion,
  duracionMinutos,
  generarSesiones,
  nuevaSesionId,
  ordenarPorInicio,
  sesionVacia,
} from '@/lib/sesiones';
import type { SesionForm } from '@/types/actividad';

describe('nuevaSesionId — trampa 2', () => {
  it('genera ids únicos, no índices', () => {
    const ids = new Set(Array.from({ length: 200 }, nuevaSesionId));
    expect(ids.size).toBe(200);
  });

  it('usa el prefijo ses_ que espera el schema', () => {
    expect(nuevaSesionId()).toMatch(/^ses_/);
  });
});

describe('generarSesiones — §11', () => {
  it('genera N encuentros semanales desde la fecha base', () => {
    const s = generarSesiones({
      cantidad: 8,
      inicio: '2026-09-03T19:00',
      duracionMinutos: 90,
      cadaDias: 7,
    });
    expect(s).toHaveLength(8);
    expect(s[0]!.inicio).toBe('2026-09-03T19:00');
    expect(s[1]!.inicio).toBe('2026-09-10T19:00');
    expect(s[7]!.inicio).toBe('2026-10-22T19:00');
  });

  it('respeta la duración pedida', () => {
    const [primera] = generarSesiones({
      cantidad: 1,
      inicio: '2026-09-03T19:00',
      duracionMinutos: 90,
    });
    expect(primera!.fin).toBe('2026-09-03T20:30');
  });

  it('da a cada encuentro su propio id', () => {
    const s = generarSesiones({ cantidad: 5, inicio: '2026-09-03T19:00', duracionMinutos: 60 });
    expect(new Set(s.map((x) => x.id)).size).toBe(5);
  });

  it('no acumula desvío: la última fecha se calcula desde la primera', () => {
    const s = generarSesiones({ cantidad: 4, inicio: '2026-01-01T10:00', duracionMinutos: 60, cadaDias: 14 });
    expect(s[3]!.inicio).toBe('2026-02-12T10:00');
  });

  it('devuelve vacío con cantidad 0 o fecha inválida', () => {
    expect(generarSesiones({ cantidad: 0, inicio: '2026-09-03T19:00', duracionMinutos: 60 })).toEqual([]);
    expect(generarSesiones({ cantidad: 3, inicio: '', duracionMinutos: 60 })).toEqual([]);
  });
});

/**
 * B-90 — regenerar la lista de un ciclo **ya publicado** no puede estrenar ids:
 * el diff del §7.2 no reconocería ningún encuentro y borraría y recrearía los
 * ocho eventos, con los recordatorios y las suscripciones de la gente adentro.
 */
describe('generarSesiones — reemplazo de una lista existente (B-90)', () => {
  const previas = (n: number): SesionForm[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `ses_previa_${i}`,
      inicio: '2026-09-03T19:00',
      fin: '2026-09-03T21:00',
      tema: 'Cap. 1-4',
      lectura: 'Pedro Páramo',
      cancelada: false,
      calendarEventId: `evt_${i}`,
    }));

  it('la fila de cada posición hereda el id y su evento de calendario', () => {
    const s = generarSesiones({
      cantidad: 8,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(8),
    });
    expect(s.map((x) => x.id)).toEqual(previas(8).map((x) => x.id));
    expect(s.map((x) => x.calendarEventId)).toEqual(previas(8).map((x) => x.calendarEventId));
  });

  it('las fechas sí son las nuevas: es lo que se pidió regenerar', () => {
    const s = generarSesiones({
      cantidad: 2,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(2),
    });
    expect(s[0]!.inicio).toBe('2026-09-10T19:00');
    expect(s[1]!.inicio).toBe('2026-09-17T19:00');
  });

  it('las filas que sobran estrenan id y nacen sin evento', () => {
    const s = generarSesiones({
      cantidad: 10,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(8),
    });
    expect(s[8]!.id).toMatch(/^ses_[0-9a-f-]{8,}/); // uuid de cliente, no índice
    expect(s[8]!.calendarEventId).toBeNull();
    expect(s[9]!.id).not.toBe(s[8]!.id);
  });

  it('generar de menos deja afuera las últimas, no las primeras', () => {
    const s = generarSesiones({
      cantidad: 6,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: previas(8),
    });
    expect(s.map((x) => x.id)).toEqual(previas(6).map((x) => x.id));
  });

  it('una fila cancelada que se regenera vuelve a estar en pie', () => {
    const [cancelada] = previas(1);
    const [s] = generarSesiones({
      cantidad: 1,
      inicio: '2026-09-10T19:00',
      duracionMinutos: 120,
      previas: [{ ...cancelada!, cancelada: true }],
    });
    expect(s!.cancelada).toBe(false);
    expect(s!.id).toBe(cancelada!.id);
  });

  it('sin `previas` estrena todos los ids: es una lista nueva, no un reemplazo', () => {
    const s = generarSesiones({ cantidad: 3, inicio: '2026-09-10T19:00', duracionMinutos: 60 });
    expect(s.every((x) => x.calendarEventId === null)).toBe(true);
    expect(new Set(s.map((x) => x.id)).size).toBe(3);
  });
});

describe('duplicarSesion', () => {
  const base = {
    id: 'ses_original',
    inicio: '2026-09-03T19:00',
    fin: '2026-09-03T21:00',
    tema: 'Cap. 1-4',
    lectura: 'Pedro Páramo',
    cancelada: true,
    calendarEventId: 'evt_123',
  };

  it('cambia el id y corre una semana', () => {
    const copia = duplicarSesion(base);
    expect(copia.id).not.toBe(base.id);
    expect(copia.inicio).toBe('2026-09-10T19:00');
    expect(copia.fin).toBe('2026-09-10T21:00');
  });

  it('no arrastra el calendarEventId del original — la copia no existe en Calendar', () => {
    expect(duplicarSesion(base).calendarEventId).toBeNull();
  });

  it('la copia no nace cancelada', () => {
    expect(duplicarSesion(base).cancelada).toBe(false);
  });

  it('conserva tema y lectura', () => {
    const copia = duplicarSesion(base);
    expect(copia.tema).toBe('Cap. 1-4');
    expect(copia.lectura).toBe('Pedro Páramo');
  });
});

describe('ida y vuelta de datetime-local', () => {
  it('no corre la hora', () => {
    const d = new Date(2026, 8, 3, 19, 30);
    expect(deDatetimeLocal(aDatetimeLocal(d))?.getTime()).toBe(d.getTime());
  });

  it('rechaza strings inválidos', () => {
    expect(deDatetimeLocal('')).toBeNull();
    expect(deDatetimeLocal('no-es-fecha')).toBeNull();
  });
});

describe('helpers de lista', () => {
  it('duracionMinutos lee la duración de la sesión', () => {
    expect(duracionMinutos({ ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T20:30' })).toBe(90);
  });

  it('ordenarPorInicio no muta el array original', () => {
    const a = { ...sesionVacia(), inicio: '2026-09-10T19:00' };
    const b = { ...sesionVacia(), inicio: '2026-09-03T19:00' };
    const lista = [a, b];
    const ordenada = ordenarPorInicio(lista);
    expect(ordenada[0]!.inicio).toBe('2026-09-03T19:00');
    expect(lista[0]!.inicio).toBe('2026-09-10T19:00');
  });
});
