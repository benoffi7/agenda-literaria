/**
 * **La vista de calendario marca lo que no se puede tocar** — B-919, y lo cobró
 * el `auditor-trampas`.
 *
 * El listado contestaba «¿esto es mío?» de un vistazo —el chip «Solo lectura», el
 * botón «Ver», el menú que no está— y esta pantalla **no contestaba nada**: con el
 * alcance por ciudad entran a la agenda encuentros de actividades ajenas, y la
 * publicadora se enteraba de que no los podía editar recién al ver el formulario
 * deshabilitado.
 *
 * Es la clase de B-175 —la misma pregunta decidida en dos pantallas, y se arregla
 * una y no la otra— y por eso la contesta la misma función pura (`esSoloLectura`)
 * en las tres puertas.
 *
 * ── Por qué DOM ───────────────────────────────────────────────────────────
 * Un test que lea el fuente vería el `soloLectura={…}` y daría verde con el
 * `Set` armado al revés. Lo que se mide acá es que **la fila de una actividad
 * ajena lleve la marca y la de una propia no**, que es el contraste entero, y que
 * un ciclo de varios encuentros no repita la pregunta mal en alguna de sus filas.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { tsDe } from './fixtures/tiempo';
import type { ActividadConId } from '@/types/actividad';

vi.mock('@/lib/analytics', () => ({ medirFuncion: vi.fn(), medirPanelAbierto: vi.fn() }));
vi.mock('@/lib/actividades', () => ({ listarActividades: vi.fn() }));
vi.mock('@/components/admin/useOpciones', () => ({
  useLabelsTaxonomia: () => ({ tipo: { taller: 'Taller' } }),
}));

import { listarActividades } from '@/lib/actividades';
import { CalendarioActividades } from '@/components/admin/CalendarioActividades';
import { claseFilaApagada } from '@/components/campos/Campo';

const UID_PROPIO = 'uid_propio';
const UID_OTRA = 'uid_otra_cuenta';

/** Dos encuentros para que un ciclo tenga más de una fila en la agenda. */
const acto = (over: Partial<ActividadConId> = {}): ActividadConId =>
  ({
    id: 'a1',
    tipo: 'taller',
    titulo: 'Taller propio',
    slug: 'taller-propio',
    estado: 'publicado',
    esCiclo: true,
    sesiones: [
      {
        id: 'ses_1',
        inicio: tsDe(new Date('2026-09-20T22:00:00Z')),
        fin: tsDe(new Date('2026-09-21T00:00:00Z')),
        tema: null,
        lectura: null,
        cancelada: false,
        calendarEventId: 'evt_1',
        comisionId: null,
      },
      {
        id: 'ses_2',
        inicio: tsDe(new Date('2026-09-27T22:00:00Z')),
        fin: tsDe(new Date('2026-09-28T00:00:00Z')),
        tema: null,
        lectura: null,
        cancelada: false,
        calendarEventId: 'evt_2',
        comisionId: null,
      },
    ],
    modalidades: [],
    modalidad: 'presencial',
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    tags: [],
    searchText: 'taller',
    createdBy: UID_PROPIO,
    updatedBy: UID_PROPIO,
    updatedAt: tsDe(new Date('2026-09-10T12:00:00Z')),
    ...over,
  }) as unknown as ActividadConId;

const ajena = () =>
  acto({ id: 'a2', titulo: 'Club de otra cuenta', slug: 'club-ajeno', createdBy: UID_OTRA, updatedBy: UID_OTRA });

const montar = async (rol: 'admin' | 'publicador') => {
  render(
    <CalendarioActividades
      onEditar={vi.fn()}
      version={0}
      rol={rol}
      uid={UID_PROPIO}
      ciudad="mar-del-plata"
    />,
  );
  // La agenda pinta una fila por encuentro, así que hay varias con cada título:
  // se espera a la **primera** en vez de exigir que haya una sola.
  return (await screen.findAllByText('Club de otra cuenta'))[0];
};

/*
 * **El reloj se fija, y hace falta.** El calendario abre en el mes que decide
 * `mesInicial` a partir de `new Date()` —capturado adentro del componente, así
 * que no entra por props—, y sin fijarlo este archivo pasaría hoy y dejaría de
 * encontrar las filas el mes que viene. Es el §«El reloj también es
 * infraestructura» visto desde el único lado donde no se puede parametrizar.
 */
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
});
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  vi.mocked(listarActividades).mockResolvedValue([acto(), ajena()]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('el calendario dice cuál de las dos no se puede tocar — B-919', () => {
  it('marca «Solo lectura» una vez por fila de la ajena, y ninguna de la propia', async () => {
    /*
     * **Las dos mitades del contraste.** La ajena tiene dos encuentros, así que
     * tiene que aparecer dos veces; y la propia, ninguna. Sin la segunda mitad,
     * un `Set` que contuviera **todas** las actividades pasaría la primera.
     *
     * MUTACIÓN PROBADA: sacarle el `esSoloLectura(rol, a, uid)` al `Set` de
     * `CalendarioActividades.tsx` (o invertirlo) deja este caso en rojo.
     */
    await montar('publicador');
    expect(screen.getAllByText('Solo lectura')).toHaveLength(2);

    const propia = screen.getAllByText('Taller propio');
    for (const fila of propia) {
      expect(fila.closest('button')?.textContent).not.toContain('Solo lectura');
    }
  });

  it('para un admin no hay ninguna marca — el control positivo', async () => {
    /*
     * Sin esto, una marca que se pintara **siempre** dejaría verde el caso de
     * arriba en su mitad principal. Es la lección de B-894: lo que se apaga
     * primero es lo que OTORGA.
     */
    await montar('admin');
    expect(screen.queryAllByText('Solo lectura')).toHaveLength(0);
  });

  it('y la vista pide la colección con la ciudad, como el listado', async () => {
    // La misma afirmación que en `panel-del-publicador.render.test.tsx`, y por el
    // mismo motivo: sin la ciudad no existe la segunda consulta y la agenda
    // vuelve a ser solo lo suyo, sin que nada falle.
    await montar('publicador');
    expect(vi.mocked(listarActividades)).toHaveBeenCalledWith(
      'publicador',
      UID_PROPIO,
      'mar-del-plata',
    );
  });
});

/*
 * B-1750 — lo que ya pasó se apaga con fondo y tinta, no con `opacity-70` (la
 * fila de la agenda) ni `opacity-75` (el día de la grilla), que se multiplicaban
 * con el `text-tinta/65` de la hora y del número del día. Tiene que seguir
 * viéndose distinto de lo que viene: es lo que ordena el mes de un vistazo.
 * MUTACIÓN PROBADA: devolviendo cualquiera de las dos `opacity`, queda en rojo.
 */
describe('lo que ya pasó se apaga sin opacity — B-1750', () => {
  const apagada = (el: Element): boolean =>
    claseFilaApagada.split(' ').every((c) => el.classList.contains(c));
  const conOpacidad = (el: Element): boolean =>
    [...el.classList].some((c) => /^opacity-\d+$/.test(c));

  /** Un encuentro antes del «hoy» fijado (15/9) y uno después. */
  const montarConUnoPasado = async () => {
    const [primero, despues] = acto().sesiones;
    vi.mocked(listarActividades).mockResolvedValue([
      acto({
        sesiones: [
          {
            ...primero!,
            id: 'ses_antes',
            inicio: tsDe(new Date('2026-09-10T22:00:00Z')),
            fin: tsDe(new Date('2026-09-11T00:00:00Z')),
          },
          despues!,
        ],
      }),
    ]);
    render(<CalendarioActividades onEditar={vi.fn()} version={0} rol="admin" uid={UID_PROPIO} />);
    await screen.findAllByText('Taller propio');
  };

  it('en la agenda, la fila del encuentro pasado va apagada y la que viene en blanco', async () => {
    await montarConUnoPasado();
    // Las filas de la agenda son los botones con el blanco táctil entero; los de
    // la grilla no lo tienen.
    const filas = screen
      .getAllByText('Taller propio')
      .map((t) => t.closest('button')!)
      .filter((b) => b.classList.contains('min-h-touch'));
    expect(filas).toHaveLength(2);
    expect(filas.filter(apagada)).toHaveLength(1);
    expect(filas.filter((b) => b.classList.contains('bg-white'))).toHaveLength(1);
    expect(filas.some(conOpacidad)).toBe(false);
  });

  it('en la grilla, el día pasado va apagado y el que viene en blanco', async () => {
    await montarConUnoPasado();
    const celdas = [...document.querySelectorAll('div.min-h-24')];
    const celda = (dia: number): Element =>
      celdas.find((d) => d.firstElementChild?.textContent === String(dia))!;
    expect(apagada(celda(14))).toBe(true);
    expect(apagada(celda(16))).toBe(false);
    expect(celda(16).classList.contains('bg-white')).toBe(true);
    expect(celdas.some(conOpacidad)).toBe(false);
  });
});
