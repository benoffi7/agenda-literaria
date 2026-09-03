/**
 * `BuscadorDePasadas` renderizado de verdad — B-292.
 *
 * ── Por qué este componente merece un `.render.test.tsx` ──────────────────
 * Por el criterio de B-08: acá hay **cableado de DOM que ningún test puro puede
 * ejercitar**, y donde un test que lee el fuente da un falso verde (B-202).
 *
 * | Qué | Por qué no alcanza el fuente |
 * |---|---|
 * | la lista del build se saca **al llegar el índice** | `tests/pasadas.test.ts` verifica que el `.remove()` esté escrito adentro del `then`. Que **corra** —y que corra una sola vez— es otra cosa |
 * | y **no** se saca si el fetch falla | es la propiedad que esta página no puede perder (§2.1): sin el archivo del build, cada actividad que pasó queda sin un solo link interno |
 * | tipear filtra la lista montada | `buscarEnPasadas` está probada pura; que el `onChange` la alimente y que el resultado llegue al DOM, no |
 *
 * La lógica de qué coincide es pura y vive en `tests/pasadas.test.ts`: acá se
 * prueba el cableado, no el criterio.
 *
 * `cleanup()` a mano en `afterEach`, como los otros cuatro de este patrón: el
 * proyecto no prende `test.globals`.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BuscadorDePasadas } from '@/components/publico/BuscadorDePasadas';
import { construirIndice } from '@/lib/eventsJson';
import { toPublic } from '@/lib/toPublic';
import { BUSCAR_EN_PASADAS, SIN_RESULTADOS_EN_PASADAS } from '@/lib/pasadasPublicas';
import { actividadDePrueba } from './fixtures/indice';

const ID_LISTADO = 'archivo-del-build';

/**
 * Dos pasadas y una futura, con el reloj **real**: este componente congela
 * `new Date()` al montar y no recibe `ahora` por prop, así que las fechas del
 * fixture se calculan contra hoy y no contra una constante. Es la contrapartida
 * de que el reloj del cliente sea el que decide qué ya pasó (§6.4).
 */
const haceMeses = (n: number): string =>
  new Date(Date.now() - n * 30 * 24 * 60 * 60 * 1000).toISOString();
const enMeses = (n: number): string =>
  new Date(Date.now() + n * 30 * 24 * 60 * 60 * 1000).toISOString();

const indice = () =>
  construirIndice({
    actividades: [
      toPublic(
        actividadDePrueba({
          slug: 'cronica',
          titulo: 'Taller de crónica',
          descripcion: 'Ocho encuentros sobre la ciudad.',
          fechas: [haceMeses(4)],
        }),
        'cronica',
      ),
      toPublic(
        actividadDePrueba({
          slug: 'poesia',
          titulo: 'Club de poesía',
          descripcion: 'Leemos un libro por mes.',
          fechas: [haceMeses(2)],
        }),
        'poesia',
      ),
      toPublic(
        actividadDePrueba({
          slug: 'por-venir',
          titulo: 'Encuentro que viene',
          descripcion: 'Todavía no pasó.',
          fechas: [enMeses(1)],
        }),
        'por-venir',
      ),
    ],
    opciones: { tipo: [{ slug: 'taller', label: 'Taller', orden: 1, fijo: true, usos: 1 }] },
    version: '1.0.0',
    generadoEn: new Date().toISOString(),
  });

/** El HTML que imprimió el build, que la island tiene que sacar (o dejar). */
const montarListaDelBuild = (): HTMLElement => {
  const div = document.createElement('div');
  div.id = ID_LISTADO;
  div.textContent = 'el archivo del build';
  document.body.appendChild(div);
  return div;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const conFetch = (respuesta: () => Promise<unknown>) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => respuesta()),
  );
};

const ok = () =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(indice()) });

describe('BuscadorDePasadas — el cableado, B-292', () => {
  it('con el índice: saca la lista del build y monta las pasadas, sin la futura', async () => {
    conFetch(ok);
    const delBuild = montarListaDelBuild();
    render(<BuscadorDePasadas version="1.0.0" idListadoEstatico={ID_LISTADO} />);

    // Hasta que llega el índice, la lista del build sigue en la página.
    expect(document.getElementById(ID_LISTADO)).toBe(delBuild);

    await waitFor(() => expect(screen.getByText('Taller de crónica')).toBeDefined());
    expect(document.getElementById(ID_LISTADO)).toBeNull();
    expect(screen.getByText('Club de poesía')).toBeDefined();
    // La futura no es una pasada: el archivo y la home parten en dos el conjunto.
    expect(screen.queryByText('Encuentro que viene')).toBeNull();
  });

  it('tipear filtra la lista montada, y borrar la devuelve', async () => {
    conFetch(ok);
    montarListaDelBuild();
    render(<BuscadorDePasadas version="1.0.0" idListadoEstatico={ID_LISTADO} />);
    await waitFor(() => expect(screen.getByText('Taller de crónica')).toBeDefined());

    const campo = screen.getByLabelText(BUSCAR_EN_PASADAS);
    await userEvent.type(campo, 'poesia');
    expect(screen.queryByText('Taller de crónica')).toBeNull();
    expect(screen.getByText('Club de poesía')).toBeDefined();

    await userEvent.clear(campo);
    expect(screen.getByText('Taller de crónica')).toBeDefined();
  });

  it('sin resultados dice qué pasó, y no deja la pantalla vacía', async () => {
    conFetch(ok);
    montarListaDelBuild();
    render(<BuscadorDePasadas version="1.0.0" idListadoEstatico={ID_LISTADO} />);
    await waitFor(() => expect(screen.getByText('Taller de crónica')).toBeDefined());

    await userEvent.type(screen.getByLabelText(BUSCAR_EN_PASADAS), 'zzz');
    expect(screen.getByText(SIN_RESULTADOS_EN_PASADAS)).toBeDefined();
  });

  it('si el fetch falla, el archivo del build **se queda** y el campo se apaga', async () => {
    /*
     * La propiedad más importante de este componente, y la única que se rompe sin
     * que se vea: la razón de ser de `/pasadas` es que cada actividad que pasó
     * conserve un link interno (§2.1). Una island que saca la lista antes de tener
     * con qué reemplazarla deja la página **sin un solo link** cada vez que el CDN
     * falla.
     *
     * MUTACIÓN PROBADA: mover el `.remove()` afuera del `then` —al principio del
     * efecto, que es donde se pondría «para no repetirlo»— pone en rojo este caso,
     * el primero de este archivo y el que lee el fuente en `tests/pasadas.test.ts`.
     */
    conFetch(() => Promise.reject(new Error('sin red')));
    const delBuild = montarListaDelBuild();
    render(<BuscadorDePasadas version="1.0.0" idListadoEstatico={ID_LISTADO} />);

    await waitFor(() =>
      expect((screen.getByLabelText(BUSCAR_EN_PASADAS) as HTMLInputElement).disabled).toBe(true),
    );
    expect(document.getElementById(ID_LISTADO)).toBe(delBuild);
  });

  it('pide el `events.json` una sola vez y con la versión del build', async () => {
    // El §2.5 y el §9: **un solo fetch**, cacheado, con el `?v=` que blinda contra
    // un intermediario que sirva el JSON del build anterior.
    conFetch(ok);
    montarListaDelBuild();
    render(<BuscadorDePasadas version="9.9.9" idListadoEstatico={ID_LISTADO} />);
    await waitFor(() => expect(screen.getByText('Taller de crónica')).toBeDefined());

    const llamadas = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]![0]).toBe('/events.json?v=9.9.9');
  });
});
