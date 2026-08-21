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
