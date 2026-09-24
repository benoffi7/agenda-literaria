/**
 * «Lo revisé hoy y sigue siendo éste» — B-913, la escritura.
 *
 * `confirmarPrecioDeSuscripcion` y `confirmarPrecioDeLugar` refechan el precio
 * con **el reloj del servidor** sin tocar el valor. Lo que este archivo fija es
 * **la forma de la escritura**, que es lo que la regla mira:
 *
 * 1. **Una sola ruta, `precio.cargadoEn`**, con el sentinel de `serverTimestamp()`.
 *    Si alguien la cambia por el `precio` entero armado desde la pantalla, el
 *    valor que queda es el que la pantalla tenía en memoria —y pisa el de otro
 *    admin— y un `Timestamp` reenviado con otra forma hace rebotar la escritura.
 * 2. **Nada más en el diff**: ni `estado`, ni `revision`, ni el valor. Tocar
 *    `revision` obligaría a firmarla, y el gesto no es una revisión del estado.
 * 3. **Sin precio no escribe**: un `update` con ruta sobre `precio: null` crearía
 *    `{ cargadoEn }` sin `valor`, que la regla rechaza sin decir por qué.
 *
 * Que la regla **acepte** esta escritura lo prueban los casos de
 * `tests/suscripciones.integracion.test.ts` y `tests/lugares.integracion.test.ts`
 * que llaman a estas mismas funciones contra el emulador.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateDocEspia = vi.fn(async (..._args: unknown[]) => {});

vi.mock('firebase/firestore', async () => {
  const real = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...real,
    doc: (_db: unknown, col: string, id: string) => ({ ruta: `${col}/${id}` }),
    updateDoc: (...args: unknown[]) => updateDocEspia(...args),
    serverTimestamp: () => 'RELOJ_DEL_SERVIDOR',
  };
});

vi.mock('@/lib/firestore-client', () => ({ db: () => ({}) }));

import { confirmarPrecioDeSuscripcion } from '@/lib/suscripcionesLiterarias';
import { confirmarPrecioDeLugar } from '@/lib/lugares';

type Confirmar = (id: string, actual: { precio: unknown }) => Promise<void>;

const cargadoEn = { toDate: () => new Date('2026-06-01T12:00:00Z') };

const CASOS = [
  {
    nombre: 'una suscripción',
    col: 'suscripciones',
    confirmar: confirmarPrecioDeSuscripcion as unknown as Confirmar,
    precio: { valor: { monto: 18000, porPeriodo: 'mensual' }, cargadoEn },
  },
  {
    nombre: 'un lugar',
    col: 'lugares',
    confirmar: confirmarPrecioDeLugar as unknown as Confirmar,
    precio: { valor: { monto: 25000, porUnidad: 'hora' }, cargadoEn },
  },
];

beforeEach(() => updateDocEspia.mockClear());

describe.each(CASOS)('confirmar el precio de $nombre — B-913', ({ col, confirmar, precio }) => {
  it('escribe solo `precio.cargadoEn`, con el reloj del servidor', async () => {
    await confirmar('f1', { precio });
    expect(updateDocEspia).toHaveBeenCalledTimes(1);
    const [ref, datos] = updateDocEspia.mock.calls[0];
    expect(ref).toEqual({ ruta: `${col}/f1` });
    // El diff entero y no un `objectContaining`: lo que importa es lo que NO está.
    expect(datos).toEqual({ 'precio.cargadoEn': 'RELOJ_DEL_SERVIDOR' });
  });

  it('no reenvía el valor ni la fecha previa', async () => {
    await confirmar('f1', { precio });
    const datos = updateDocEspia.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.values(datos)).not.toContain(cargadoEn);
    expect(JSON.stringify(datos)).not.toContain('monto');
  });

  it('sin precio no escribe nada, y lo dice', async () => {
    await expect(confirmar('f1', { precio: null })).rejects.toThrow(/no tiene precio/);
    expect(updateDocEspia).not.toHaveBeenCalled();
  });
});
