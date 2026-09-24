/**
 * «Ya pasó» en el panel es lo mismo que en `/pasadas` — B-101, D-1050.
 *
 * ── Qué se protege ────────────────────────────────────────────────────────
 * El listado del panel parte lo cargado en «Vigentes» y «Pasadas», y el sitio
 * tiene su archivo en `/pasadas`. Si los dos contestaran distinto «¿ya pasó?»
 * sobre la misma actividad, el dueño vería en «Pasadas» algo que el sitio
 * todavía ofrece en la home, o al revés, y nada fallaría. Es la clase de D-88:
 * dos lados derivando el mismo valor.
 *
 * El criterio no está escrito dos veces —los dos terminan en `proximaVentana`
 * (B-227)—, pero cada lado llega con otro formato (`Timestamp` acá, ISO allá) y
 * con su propia conversión. Este archivo ata **los resultados**: la misma
 * actividad, pasada por las dos proyecciones reales (`fixtures/indice.ts`),
 * tiene que caer del mismo lado en los dos.
 *
 * ── La única diferencia, y es a propósito ────────────────────────────────
 * Sin ninguna fecha cargada, el sitio la cuenta como pasada y el panel no: en el
 * panel eso es un borrador a medio cargar, y mandarlo al archivo sería
 * esconderlo justo mientras se lo carga. Lo fija el último caso.
 */
import { describe, expect, it } from 'vitest';

import {
  FILTROS_VACIOS,
  cantidadDeFiltros,
  cantidadesPorPestana,
  dePestana,
  esPasada,
  etiquetaDeOrden,
  filtrar,
  hayFiltros,
  listaVisible,
  ultimaFecha,
} from '@/lib/filtrosActividades';
import { pasadasDelSitio } from '@/lib/pasadasPublicas';
import type { ActividadConId } from '@/types/actividad';
import { actividadDePrueba, entradaDePrueba, type OpcionesDeEntrada } from './fixtures/indice';
import { ts } from './fixtures/tiempo';

const AHORA = new Date('2026-09-10T15:00:00Z');

const delPanel = (o: OpcionesDeEntrada & { id: string }): ActividadConId =>
  ({ ...actividadDePrueba(o), id: o.id }) as ActividadConId;

const enPasadasDelSitio = (o: OpcionesDeEntrada, ahora: Date): boolean =>
  pasadasDelSitio([entradaDePrueba(o)], ahora).length === 1;

/**
 * Los casos que deciden: todo atrás, todo adelante, un ciclo a mitad de
 * camino, el encuentro que **está pasando ahora** (se descarta por el fin, no
 * por el inicio: B-227), y los cancelados, que no cuentan para «lo que viene».
 */
const CASOS: Array<[string, OpcionesDeEntrada]> = [
  ['todo atrás', { fechas: ['2026-05-20T22:00:00Z', '2026-06-03T22:00:00Z'] }],
  ['todo adelante', { fechas: ['2026-09-24T22:00:00Z'] }],
  ['ciclo a mitad de camino', { fechas: ['2026-08-20T22:00:00Z', '2026-09-17T22:00:00Z'] }],
  ['el encuentro está pasando ahora', { fechas: ['2026-09-10T14:00:00Z'] }],
  ['terminó hace un minuto', { fechas: ['2026-09-10T12:59:00Z'] }],
  [
    'lo único por venir está cancelado',
    { fechas: ['2026-08-20T22:00:00Z', '2026-09-17T22:00:00Z'], canceladas: [1] },
  ],
  [
    'lo que queda por venir no está cancelado',
    { fechas: ['2026-08-20T22:00:00Z', '2026-09-17T22:00:00Z'], canceladas: [0] },
  ],
  ['todos cancelados', { fechas: ['2026-09-17T22:00:00Z'], canceladas: [0] }],
];

describe('el panel y /pasadas contestan lo mismo — D-1050, D-88', () => {
  it.each(CASOS)('%s', (_nombre, o) => {
    expect(esPasada(delPanel({ ...o, id: 'a' }), AHORA)).toBe(enPasadasDelSitio(o, AHORA));
  });

  it('el control positivo: la matriz tiene casos de los dos lados', () => {
    // Sin esto, una matriz en la que todo cae de un solo lado pasaría aunque
    // `esPasada` devolviera una constante.
    const lados = new Set(CASOS.map(([, o]) => enPasadasDelSitio(o, AHORA)));
    expect(lados).toEqual(new Set([true, false]));
  });

  it('y la única diferencia es la de sin fechas: el borrador a medio cargar no se archiva', () => {
    expect(enPasadasDelSitio({ fechas: [] }, AHORA)).toBe(true);
    expect(esPasada(delPanel({ fechas: [], id: 'b' }), AHORA)).toBe(false);
  });
});

describe('las pestañas — B-101', () => {
  const MARZO = delPanel({ id: 'marzo', titulo: 'Antes, de marzo', fechas: ['2026-03-10T22:00:00Z'] });
  const JULIO = delPanel({ id: 'julio', titulo: 'De julio', fechas: ['2026-07-10T22:00:00Z'] });
  const VIENE = delPanel({ id: 'viene', titulo: 'Se viene', fechas: ['2026-09-20T22:00:00Z'] });
  const SIN_FECHA = delPanel({ id: 'sin-fecha', titulo: 'Borrador', fechas: [] });
  const TODAS = [MARZO, VIENE, JULIO, SIN_FECHA];
  const ids = (as: ActividadConId[]) => as.map((a) => a.id);

  it('parten lo cargado en dos, sin que nada se pierda ni se repita', () => {
    const vigentes = dePestana(TODAS, 'vigentes', AHORA);
    const pasadas = dePestana(TODAS, 'pasadas', AHORA);
    expect(ids(vigentes).sort()).toEqual(['sin-fecha', 'viene']);
    expect(ids(pasadas).sort()).toEqual(['julio', 'marzo']);
    expect(vigentes.length + pasadas.length).toBe(TODAS.length);
  });

  it('nada cambia de estado: la pasada sigue siendo la misma actividad publicada', () => {
    const [pasada] = dePestana([MARZO], 'pasadas', AHORA);
    expect(pasada).toBe(MARZO);
    expect(pasada?.estado).toBe('publicado');
  });

  it('el listado arranca en «Vigentes»', () => {
    expect(FILTROS_VACIOS.pestana).toBe('vigentes');
    expect(ids(listaVisible(TODAS, FILTROS_VACIOS, 'proxima', AHORA))).toEqual([
      'viene',
      'sin-fecha',
    ]);
  });

  it('en «Pasadas», lo último que pasó primero — el orden de /pasadas', () => {
    const f = { ...FILTROS_VACIOS, pestana: 'pasadas' as const };
    expect(ids(listaVisible(TODAS, f, 'proxima', AHORA))).toEqual(['julio', 'marzo']);
    // Y el orden por título sigue siendo el por título.
    expect(ids(listaVisible(TODAS, f, 'titulo', AHORA))).toEqual(['marzo', 'julio']);
    expect(etiquetaDeOrden('proxima', 'pasadas')).toBe('Lo último que pasó primero');
    expect(etiquetaDeOrden('proxima', 'vigentes')).toBe('Lo que se viene primero');
  });

  it('la pestaña no es un filtro: no la cuenta el botón ni la mira `filtrar`', () => {
    const f = { ...FILTROS_VACIOS, pestana: 'pasadas' as const };
    expect(cantidadDeFiltros(f)).toBe(0);
    expect(hayFiltros(f)).toBe(false);
    expect(filtrar(TODAS, f, AHORA)).toHaveLength(TODAS.length);
  });

  it('el número de cada pestaña se cuenta con los filtros puestos', () => {
    const conTexto = filtrar(
      TODAS.map((a) => ({ ...a, searchText: a.titulo.toLowerCase() })),
      { ...FILTROS_VACIOS, texto: 'de ' },
      AHORA,
    );
    expect(cantidadesPorPestana(conTexto, AHORA)).toEqual({ vigentes: 0, pasadas: 2 });
    expect(cantidadesPorPestana(TODAS, AHORA)).toEqual({ vigentes: 2, pasadas: 2 });
  });

  it('`ultimaFecha` es la última no cancelada, como el `hasta` del sitio', () => {
    const a = delPanel({
      id: 'c',
      fechas: ['2026-03-10T22:00:00Z', '2026-03-17T22:00:00Z'],
      canceladas: [1],
    });
    expect(ultimaFecha(a)?.toISOString()).toBe('2026-03-10T22:00:00.000Z');
    expect(ultimaFecha({ ...a, sesiones: [] })).toBeNull();
    // Un `Timestamp` suelto, sin el resto de la fila, alcanza para ubicarla.
    expect(
      ultimaFecha({
        ...a,
        sesiones: [{ ...a.sesiones[0]!, inicio: ts('2026-01-01T00:00:00Z') }],
      })?.getUTCFullYear(),
    ).toBe(2026);
  });
});
