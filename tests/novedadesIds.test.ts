import { afterEach, describe, expect, it, vi } from 'vitest';
import * as completo from '@/lib/novedades';
import { CLAVE_VISTO, NOVEDADES_IDS, idsSinLeer, leerVisto } from '@/lib/novedadesIds';

/**
 * B-1961 — `novedadesIds.ts` existe para que el contador del botón «Ayuda» no
 * traiga el texto de las novedades al chunk inicial del panel. Sirve mientras
 * diga lo mismo que `novedades.ts`: si se separan, el número cuenta mal y nadie
 * lo ve. Estos casos son la atadura.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const IDS_REALES = completo.NOVEDADES.map((n) => n.id);

describe('NOVEDADES_IDS es la lista de NOVEDADES — B-1961', () => {
  it('los mismos ids, en el mismo orden', () => {
    const faltan = IDS_REALES.filter((id) => !NOVEDADES_IDS.includes(id));
    const sobran = NOVEDADES_IDS.filter((id) => !IDS_REALES.includes(id));
    expect(
      { faltan, sobran },
      'src/lib/novedadesIds.ts no coincide con NOVEDADES: cada novedad nueva suma su id arriba ' +
        `de NOVEDADES_IDS, en el mismo lugar que en novedades.ts. Faltan: ${faltan.join(', ') || '—'}. ` +
        `Sobran: ${sobran.join(', ') || '—'}.`,
    ).toEqual({ faltan: [], sobran: [] });
    expect([...NOVEDADES_IDS], 'mismos ids, otro orden: el orden decide qué está sin leer').toEqual(
      IDS_REALES,
    );
  });

  it('CONTROL POSITIVO: la lista no está vacía', () => {
    expect(NOVEDADES_IDS.length).toBeGreaterThan(100);
  });

  it('la marca se guarda y se lee con la misma clave', () => {
    expect(CLAVE_VISTO).toBe(completo.CLAVE_VISTO);
  });
});

describe('idsSinLeer cuenta igual que novedadesNoLeidas — D-64', () => {
  const comoLaCompleta = (visto: string | null) =>
    completo.novedadesNoLeidas(completo.NOVEDADES, visto).map((n) => n.id);

  it('sin marca, todas', () => {
    expect(idsSinLeer(NOVEDADES_IDS, null)).toEqual(comoLaCompleta(null));
    expect(idsSinLeer(NOVEDADES_IDS, null)).toHaveLength(NOVEDADES_IDS.length);
  });

  it('con una marca que ya no existe, ninguna', () => {
    expect(idsSinLeer(NOVEDADES_IDS, 'una-que-se-borro')).toEqual([]);
    expect(comoLaCompleta('una-que-se-borro')).toEqual([]);
  });

  it('con cada marca posible, lo mismo que la completa', () => {
    const distintas = IDS_REALES.filter(
      (visto) => idsSinLeer(NOVEDADES_IDS, visto).join() !== comoLaCompleta(visto).join(),
    );
    expect(distintas).toEqual([]);
  });

  it('con la última leída, nada; con la segunda, una', () => {
    expect(idsSinLeer(NOVEDADES_IDS, NOVEDADES_IDS[0]!)).toEqual([]);
    expect(idsSinLeer(NOVEDADES_IDS, NOVEDADES_IDS[1]!)).toEqual([NOVEDADES_IDS[0]]);
  });

  it('no devuelve la misma lista: quien la reciba no puede tocar NOVEDADES_IDS', () => {
    expect(idsSinLeer(NOVEDADES_IDS, null)).not.toBe(NOVEDADES_IDS);
  });
});

describe('leerVisto', () => {
  it('lee la marca que guarda la capa', () => {
    const guardado = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => guardado.get(k) ?? null,
        setItem: (k: string, v: string) => void guardado.set(k, v),
      },
    });
    completo.guardarVisto('ayuda-y-novedades');
    expect(leerVisto()).toBe('ayuda-y-novedades');
  });

  it.each([
    ['con marca', 'ayuda-y-novedades'],
    ['sin marca', null],
  ])('%s, lee lo mismo que el leerVisto de novedades.ts', (_caso, marca) => {
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => (k === CLAVE_VISTO ? marca : null) },
    });
    expect(leerVisto()).toBe(completo.leerVisto());
  });

  it('si el navegador no deja leer, null y sin romper', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
      },
    });
    expect(leerVisto()).toBeNull();
    expect(completo.leerVisto()).toBeNull();
  });
});
