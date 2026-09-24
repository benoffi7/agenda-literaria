/**
 * **Dos fichas publicadas de la Guía no comparten dirección web** — B-909.
 *
 * El alta pública de las cuatro guías deriva el slug del nombre sin poder
 * consultar la colección (un anónimo no la lee), así que dos fichas con el mismo
 * slug en `pendiente` son esperables: la librería que ya está en la Guía y
 * alguien vuelve a sumar. Lo que no puede pasar es que las dos **salgan**: la
 * trampa 10 es sobre la URL, y la URL nace al publicar. Este archivo fija que
 * `moverX(…, 'publicado')` de los cuatro directorios lo verifique **antes** de
 * escribir, contra el documento y no contra la pantalla.
 *
 * Firestore va con un doble en memoria: lo que se fija es la decisión y que la
 * escritura no salga. Que un admin pueda hacer esas dos lecturas lo dicen las
 * reglas (`get` y `list` en `esAdmin()` en las cuatro colecciones) y lo prueba
 * `tests/librerias.integracion.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
const almacen: Record<string, Record<string, Doc>> = {};
const updateDocEspia = vi.fn(async (..._args: unknown[]) => {});
const getDocEspia = vi.fn();

vi.mock('firebase/firestore', async () => {
  const real = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...real,
    collection: (_db: unknown, col: string) => ({ col }),
    doc: (_db: unknown, col: string, id: string) => ({ col, id }),
    where: (campo: string, _op: string, valor: unknown) => ({ campo, valor }),
    limit: (n: number) => ({ limite: n }),
    query: (c: { col: string }, w: { campo: string; valor: unknown }, l: { limite: number }) => ({
      col: c.col,
      ...w,
      ...l,
    }),
    getDoc: async (ref: { col: string; id: string }) => {
      getDocEspia(ref);
      const d = almacen[ref.col]?.[ref.id];
      return { exists: () => d !== undefined, data: () => d };
    },
    getDocs: async (q: { col: string; campo: string; valor: unknown; limite: number }) => ({
      docs: Object.entries(almacen[q.col] ?? {})
        .filter(([, d]) => d[q.campo] === q.valor)
        .slice(0, q.limite)
        .map(([id, d]) => ({ id, data: () => d })),
    }),
    updateDoc: (...args: unknown[]) => updateDocEspia(...args),
    serverTimestamp: () => 'RELOJ_DEL_SERVIDOR',
  };
});

vi.mock('@/lib/firestore-client', () => ({ db: () => ({}) }));

import { moverLibreria, slugDeLibreriaDisponible } from '@/lib/librerias';
import { moverBiblioteca, slugDeBibliotecaDisponible } from '@/lib/bibliotecas';
import { moverSuscripcion, slugDeSuscripcionDisponible } from '@/lib/suscripcionesLiterarias';
import { moverLugar, slugDeLugarDisponible } from '@/lib/lugares';

type Mover = (id: string, uid: string, estado: 'pendiente' | 'publicado' | 'rechazado') => Promise<void>;
type Disponible = (slug: string, idActual?: string) => Promise<boolean>;

const GUIAS: { nombre: string; col: string; mover: Mover; disponible: Disponible }[] = [
  { nombre: 'librerías', col: 'librerias', mover: moverLibreria, disponible: slugDeLibreriaDisponible },
  { nombre: 'bibliotecas', col: 'bibliotecas', mover: moverBiblioteca, disponible: slugDeBibliotecaDisponible },
  { nombre: 'suscripciones', col: 'suscripciones', mover: moverSuscripcion, disponible: slugDeSuscripcionDisponible },
  { nombre: 'lugares', col: 'lugares', mover: moverLugar, disponible: slugDeLugarDisponible },
];

beforeEach(() => {
  for (const k of Object.keys(almacen)) delete almacen[k];
  updateDocEspia.mockClear();
  getDocEspia.mockClear();
});

describe.each(GUIAS)('publicar en $nombre — B-909', ({ col, mover, disponible }) => {
  const sembrar = (fichas: Record<string, Doc>) => {
    almacen[col] = fichas;
  };

  it('con otra ficha PUBLICADA con el mismo slug, no escribe y dice por qué', async () => {
    sembrar({
      vieja: { slug: 'eterna-cadencia', estado: 'publicado', publicadaAlgunaVez: true },
      nueva: { slug: 'eterna-cadencia', estado: 'pendiente', publicadaAlgunaVez: false },
    });
    await expect(mover('nueva', 'uid-admin', 'publicado')).rejects.toThrow(
      /«eterna-cadencia» ya es de otra ficha publicada/,
    );
    expect(updateDocEspia).not.toHaveBeenCalled();
  });

  it('la que se publicó y se bajó sigue siendo dueña de su dirección', async () => {
    // `slugBloqueado`: la URL ya está en Google aunque hoy la ficha no salga.
    // MUTACIÓN PROBADA: mirar solo `estado == 'publicado'` pone este caso en rojo.
    sembrar({
      vieja: { slug: 'la-libre', estado: 'rechazado', publicadaAlgunaVez: true },
      nueva: { slug: 'la-libre', estado: 'pendiente' },
    });
    await expect(mover('nueva', 'uid-admin', 'publicado')).rejects.toThrow(/ya es de otra ficha/);
    expect(updateDocEspia).not.toHaveBeenCalled();
  });

  it('con otra PENDIENTE con el mismo slug publica: gana la primera que sale', async () => {
    sembrar({
      a: { slug: 'la-libre', estado: 'pendiente', publicadaAlgunaVez: false },
      b: { slug: 'la-libre', estado: 'pendiente' },
    });
    await mover('a', 'uid-admin', 'publicado');
    expect(updateDocEspia).toHaveBeenCalledTimes(1);
    expect(updateDocEspia.mock.calls[0]![1]).toMatchObject({ estado: 'publicado' });
  });

  it('una ficha no choca consigo misma', async () => {
    sembrar({ a: { slug: 'la-libre', estado: 'publicado', publicadaAlgunaVez: true } });
    await mover('a', 'uid-admin', 'publicado');
    expect(updateDocEspia).toHaveBeenCalledTimes(1);
  });

  it('decide contra el documento, no contra lo que la bandeja tenía en pantalla', async () => {
    // El slug se relee por id (la lección de D-660): el de la ficha es el que va a quedar.
    sembrar({
      vieja: { slug: 'otro-nombre', estado: 'publicado', publicadaAlgunaVez: true },
      nueva: { slug: 'otro-nombre', estado: 'pendiente' },
    });
    await expect(mover('nueva', 'uid-admin', 'publicado')).rejects.toThrow(/otro-nombre/);
    expect(getDocEspia).toHaveBeenCalledWith({ col, id: 'nueva' });
  });

  it('sin slug no publica', async () => {
    sembrar({ a: { slug: '', estado: 'pendiente' } });
    await expect(mover('a', 'uid-admin', 'publicado')).rejects.toThrow(/no tiene dirección web/);
    expect(updateDocEspia).not.toHaveBeenCalled();
  });

  it('mover a otro estado no consulta nada', async () => {
    // Rechazar o reabrir no crea ninguna URL: una lectura ahí sería pagar por nada.
    sembrar({ a: { slug: 'x', estado: 'pendiente' } });
    await mover('a', 'uid-admin', 'rechazado');
    expect(getDocEspia).not.toHaveBeenCalled();
    expect(updateDocEspia).toHaveBeenCalledTimes(1);
  });

  it('la guarda de aviso del formulario sigue chocando contra cualquier ficha', async () => {
    sembrar({ a: { slug: 'la-libre', estado: 'pendiente' } });
    expect(await disponible('la-libre')).toBe(false);
    expect(await disponible('la-libre', 'a')).toBe(true);
    expect(await disponible('otra')).toBe(true);
    expect(await disponible('')).toBe(false);
  });
});
