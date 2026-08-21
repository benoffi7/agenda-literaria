import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLAVE_VISTO,
  NOVEDADES,
  fechaLegible,
  guardarVisto,
  leerVisto,
  novedadesNoLeidas,
  type Novedad,
} from '@/lib/novedades';

const novedad = (id: string, fecha = '2026-08-21'): Novedad => ({
  id,
  fecha,
  titulo: `Novedad ${id}`,
  detalle: 'Detalle.',
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('qué está sin leer', () => {
  const lista = [novedad('c'), novedad('b'), novedad('a')];

  it('sin marca guardada, todo es nuevo', () => {
    // Primera visita, o navegador nuevo: es la invitación a leer la lista.
    expect(novedadesNoLeidas(lista, null)).toEqual(lista);
  });

  it('con la última leída, no hay nada nuevo', () => {
    expect(novedadesNoLeidas(lista, 'c')).toEqual([]);
  });

  it('con una marca del medio, solo lo posterior', () => {
    expect(novedadesNoLeidas(lista, 'b')).toEqual([lista[0]]);
  });

  it('con una marca que ya no existe, no avisa nada', () => {
    // El lado prudente del error: un aviso falso que aparece siempre se aprende
    // a ignorar, y ahí el mecanismo entero deja de servir.
    expect(novedadesNoLeidas(lista, 'borrada-hace-meses')).toEqual([]);
  });

  it('con la lista vacía no explota', () => {
    expect(novedadesNoLeidas([], null)).toEqual([]);
    expect(novedadesNoLeidas([], 'lo-que-sea')).toEqual([]);
  });
});

describe('la marca se guarda en el navegador', () => {
  it('lee y escribe la misma clave', () => {
    const guardado: Record<string, string> = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => guardado[k] ?? null,
        setItem: (k: string, v: string) => {
          guardado[k] = v;
        },
      },
    });
    guardarVisto('ayuda-y-novedades');
    expect(guardado[CLAVE_VISTO]).toBe('ayuda-y-novedades');
    expect(leerVisto()).toBe('ayuda-y-novedades');
  });

  it('si el navegador no deja guardar datos, no se rompe nada', () => {
    // Ventana privada de Safari, o el sitio bloqueado para guardar datos: el
    // acceso lanza excepción en lugar de devolver vacío.
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('bloqueado');
        },
        setItem: () => {
          throw new Error('bloqueado');
        },
      },
    });
    expect(leerVisto()).toBeNull();
    expect(() => guardarVisto('x')).not.toThrow();
  });
});

describe('la fecha se muestra sin corrimiento', () => {
  it('formatea en castellano', () => {
    expect(fechaLegible('2026-08-21')).toBe('21 de agosto de 2026');
  });

  it('no retrocede un día como haría `new Date` con la zona del proyecto', () => {
    // `new Date('2026-01-01')` es medianoche UTC, que en Buenos Aires es el 31
    // de diciembre. Es la trampa de los eventos corridos tres horas, en chico.
    expect(fechaLegible('2026-01-01')).toBe('1 de enero de 2026');
    expect(fechaLegible('2026-12-31')).toBe('31 de diciembre de 2026');
  });

  it('ante algo que no es una fecha, devuelve lo que recibió', () => {
    expect(fechaLegible('cuando sea')).toBe('cuando sea');
  });
});

describe('la lista publicada', () => {
  it('no repite ids', () => {
    expect(new Set(NOVEDADES.map((n) => n.id)).size).toBe(NOVEDADES.length);
  });

  it('las fechas son válidas y van de la más nueva a la más vieja', () => {
    for (const n of NOVEDADES) {
      expect(n.fecha, `fecha inválida en «${n.id}»`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const fechas = NOVEDADES.map((n) => n.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  it('cada entrada dice qué se puede hacer, en corto', () => {
    for (const n of NOVEDADES) {
      expect(n.titulo.length, `título flojo en «${n.id}»`).toBeGreaterThan(15);
      expect(n.detalle.length, `detalle flojo en «${n.id}»`).toBeGreaterThan(60);
      // El límite es de mantenimiento, no de estilo: una entrada que necesita
      // más de un párrafo es un capítulo de la guía, no una novedad.
      expect(n.detalle.length, `detalle demasiado largo en «${n.id}»`).toBeLessThan(420);
    }
  });

  it('no habla en jerga', () => {
    const corpus = NOVEDADES.map((n) => `${n.titulo} ${n.detalle} ${n.donde ?? ''}`).join('\n');
    for (const termino of ['§', 'trampa', '.tsx', 'Firestore', 'slug ', 'commit']) {
      expect(corpus.toLowerCase()).not.toContain(termino.toLowerCase());
    }
  });

  it('la primera entrada cuenta que existe la ayuda', () => {
    // Es la única novedad que se explica a sí misma: si esa entrada no fuera la
    // primera, nadie se enteraría de que hay una guía.
    expect(NOVEDADES[0]?.id).toBe('ayuda-y-novedades');
  });
});
