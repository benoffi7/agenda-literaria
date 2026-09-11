/**
 * **La reconciliación del índice `/slugs`** — B-888 tajada 2, D-660.
 *
 * ── Por qué este archivo existe ───────────────────────────────────────────
 * Porque acá estuvo el único bug que `scripts/sembrar-slugs.mjs` tuvo, **y lo
 * encontró correrlo de verdad contra el emulador, no leerlo**. La primera versión
 * separaba «la reserva que falta» de «la reserva que apunta a otra actividad», y
 * mandaba la segunda a la lista de borrar: con `--reparar` se borraba, nadie la
 * reponía en la misma pasada, y la actividad quedaba **sin reserva** — el estado
 * que el script existe para arreglar, producido por el script. Hacían falta dos
 * corridas y nada lo decía.
 *
 * Es el §"Verificar contra el sistema real, no contra lo que se cree que se
 * mandó" cobrándose otra: los tests prueban la intención, y lo que sale al mundo
 * hay que mirarlo. Lo que queda acá es la otra mitad —que el arreglo no se
 * deshaga— sobre la decisión ya separada del I/O.
 *
 * **Se importa `slugs-a-reconciliar.mjs` y no el script**, y eso también lo
 * enseñó la misma tarde: `sembrar-slugs.mjs` corre en el cuerpo del módulo, así
 * que un `import()` suyo se conecta a Firestore — al probarlo se conectó a
 * **producción** y leyó las 255 actividades. Fue una lectura, pero es el motivo
 * por el que la decisión vive aparte.
 */
import { describe, expect, it } from 'vitest';
import { aReconciliar } from '../scripts/slugs-a-reconciliar.mjs';

/** slug → id de la actividad que lo usa hoy. */
const catalogo = (pares: [string, string][]) => new Map(pares);
/** slug → `actividadId` de la reserva que existe. */
const reservas = (pares: [string, string][]) => new Map(pares);

describe('qué escribir y qué borrar del índice de slugs (D-660)', () => {
  it('una actividad sin reserva se escribe', () => {
    const r = aReconciliar(catalogo([['taller-uno', 'a1']]), reservas([]));
    expect(r.desalineados).toEqual([['taller-uno', 'a1']]);
    expect(r.huerfanas).toEqual([]);
  });

  it('una reserva de un nombre que nadie usa se borra', () => {
    const r = aReconciliar(catalogo([]), reservas([['nombre-fantasma', 'borrada']]));
    expect(r.desalineados).toEqual([]);
    expect(r.huerfanas).toEqual([['nombre-fantasma', 'borrada']]);
  });

  it('una reserva que apunta a OTRA actividad se REESCRIBE, no se borra', () => {
    /*
     * **El bug, con nombre y apellido.** Si esta reserva cayera en `huerfanas`,
     * `--reparar` la borraría y nadie la repondría en la misma pasada: `a2`
     * quedaría con su slug escrito en el documento y sin reserva, o sea el índice
     * diciendo «libre» sobre un nombre en uso — la trampa 10 servida por el
     * script que existe para evitarla.
     *
     * MUTACIÓN PROBADA: volver `desalineados` a `!yaReservados.has(slug)` y
     * `huerfanas` a `!enElCatalogo.has(slug) || enElCatalogo.get(slug) !== id`
     * deja este caso en rojo en las dos mitades.
     */
    const r = aReconciliar(
      catalogo([['taller-dos', 'a2']]),
      reservas([['taller-dos', 'otra-cosa']]),
    );
    expect(r.desalineados, 'la reserva desfasada no se reescribe').toEqual([['taller-dos', 'a2']]);
    expect(r.huerfanas, 'la reserva desfasada se borra y queda el hueco').toEqual([]);
  });

  it('una reserva alineada no se toca — es lo que lo hace idempotente', () => {
    // Control positivo del caso de arriba: sin esto, un `desalineados` que
    // devolviera todo el catálogo también lo pasaría.
    const r = aReconciliar(catalogo([['taller-uno', 'a1']]), reservas([['taller-uno', 'a1']]));
    expect(r.desalineados).toEqual([]);
    expect(r.huerfanas).toEqual([]);
  });

  it('una pasada deja el índice alineado: la segunda no tiene nada que hacer', () => {
    /*
     * **La propiedad que de verdad importa, afirmada como propiedad y no como
     * caso**: se aplica lo que la primera pasada decide y se vuelve a preguntar.
     * Es lo que estaba roto, y un caso suelto por estado no lo habría dicho — la
     * primera pasada de la versión vieja también se veía razonable mirándola sola.
     */
    const enElCatalogo = catalogo([
      ['taller-uno', 'a1'],
      ['taller-dos', 'a2'],
      ['taller-tres', 'a3'],
    ]);
    const yaReservados = reservas([
      ['taller-dos', 'otra-cosa'],
      ['nombre-fantasma', 'borrada'],
    ]);

    const primera = aReconciliar(enElCatalogo, yaReservados);
    // Lo que el script hace con `--aplicar --reparar`, en el mismo orden.
    for (const [slug, id] of primera.desalineados) yaReservados.set(slug, id);
    for (const [slug] of primera.huerfanas) yaReservados.delete(slug);

    const segunda = aReconciliar(enElCatalogo, yaReservados);
    expect(segunda.desalineados, 'quedó una actividad sin reserva').toEqual([]);
    expect(segunda.huerfanas, 'quedó una reserva huérfana').toEqual([]);
    // Y el índice terminó diciendo exactamente lo que dice el catálogo.
    expect([...yaReservados].sort()).toEqual([...enElCatalogo].sort());
  });
});
