/**
 * **El formulario en pestañas, montado de verdad** — pedido del dueño el
 * 2026-09-07: «que sean tabs y con la barra de guardar siempre visible como
 * ahora».
 *
 * La parte pura —que las pestañas cubran el registro de secciones, el conteo por
 * solapa— está en `tests/pestanias-del-formulario.test.ts`. Acá va lo que solo el
 * DOM puede decir, y es justo lo que el rediseño pone en riesgo:
 *
 * - **que se vea una sola pestaña.** Nueve paneles montados y ocho escondidos es
 *   el mecanismo, y si el `hidden` no aplica el formulario se ve exactamente como
 *   antes: largo. Un `grep` sobre el JSX no distingue los dos casos;
 * - **que el enlace de la barra cambie de pestaña.** Es el riesgo entero: un
 *   campo que falta para publicar y vive en otra solapa **no está en la
 *   pantalla**, que es el problema que B-184 resolvió cuando el campo estaba
 *   dentro de un acordeón cerrado;
 * - **que la solapa muestre cuántos campos le faltan**, que es lo que permite
 *   orientarse sin abrirlas de a una.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * La analítica se dobla entera —no hay que emitir nada desde un test— y con
 * **todos** los exports que el árbol del formulario usa: vitest falla nombrando
 * el que falte, que es cómo se armó esta lista.
 */
vi.mock('@/lib/analytics', () => ({
  medir: vi.fn(),
  medirFuncion: vi.fn(),
  medirSeccion: vi.fn(),
  medirPanelAbierto: vi.fn(),
  registrarVersion: vi.fn(),
  analiticaHabilitada: () => false,
}));
/*
 * Las taxonomías se leen de Firestore con listeners de módulo. El doble devuelve
 * la **forma** que consume `TaxonomiaSelect` —`valores` y `elegibles`, las dos
 * listas— y no solo `valores`: sin `elegibles` el componente revienta en el
 * primer render, que es cómo se descubrió cuál era el contrato.
 */
vi.mock('@/components/admin/useOpciones', () => ({
  useOpciones: () => ({ valores: [], elegibles: [], cargando: false }),
  useLabelsTaxonomia: () => ({}),
}));

import { ActividadFormulario } from '@/components/admin/ActividadFormulario';
import { PESTANIAS } from '@/lib/formulario/pestanias';

afterEach(cleanup);

const pintar = () => {
  render(
    <ActividadFormulario uid="uid-de-prueba" onGuardado={vi.fn()} onCancelar={vi.fn()} />,
  );
};

/** Los paneles que de verdad se ven: el `hidden` de Tailwind no los muestra. */
const panelesVisibles = (): HTMLElement[] =>
  screen
    .getAllByRole('tabpanel', { hidden: true })
    .filter((p) => !p.className.includes('hidden'));

describe('se ve una pestaña y una sola', () => {
  it('hay una solapa por pestaña y arranca en la primera', () => {
    pintar();
    const solapas = screen.getAllByRole('tab');
    expect(solapas).toHaveLength(PESTANIAS.length);
    expect(solapas[0]!.getAttribute('aria-selected')).toBe('true');
    expect(solapas.filter((s) => s.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('los otros ocho paneles están escondidos', () => {
    /*
     * MUTACIÓN PROBADA: dejar el `className` de los paneles en `'flex flex-col
     * gap-4'` para todos —o sea, no esconder ninguno— deja este caso en rojo con
     * nueve visibles. Es el aserto que dice que el rediseño hace algo.
     */
    pintar();
    expect(panelesVisibles()).toHaveLength(1);
  });

  it('cambiar de solapa cambia el panel visible, y sigue habiendo uno solo', async () => {
    pintar();
    const antes = panelesVisibles()[0]!;
    await userEvent.click(screen.getByRole('tab', { name: /^Encuentros/ }));

    const visibles = panelesVisibles();
    expect(visibles).toHaveLength(1);
    expect(visibles[0]).not.toBe(antes);
    expect(visibles[0]!.getAttribute('aria-labelledby')).toBe('solapa-encuentros');
    expect(
      screen.getByRole('tab', { name: /^Encuentros/ }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('solo la solapa activa es una parada de Tab', () => {
    /*
     * Con nueve solapas tabbables, llegar al primer campo del formulario cuesta
     * nueve Tabs. El patrón es el del resto del panel: se entra con Tab a la
     * activa y se recorre con las flechas.
     */
    pintar();
    const solapas = screen.getAllByRole('tab');
    expect(solapas.filter((s) => s.tabIndex === 0)).toHaveLength(1);
    expect(solapas[0]!.tabIndex).toBe(0);
  });

  it('las flechas mueven el foco y cambian de pestaña', async () => {
    /*
     * Activación automática, y corresponde acá porque cambiar de solapa no cuesta
     * nada: los paneles ya están montados, no hay una carga detrás.
     */
    pintar();
    const solapas = screen.getAllByRole('tab');
    solapas[0]!.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(document.activeElement).toBe(solapas[1]);
    expect(solapas[1]!.getAttribute('aria-selected')).toBe('true');
  });
});

describe('la barra de guardar sigue abajo y sigue llevando al campo', () => {
  it('la barra está fuera de las pestañas: se ve con cualquiera activa', () => {
    /*
     * El pedido era explícito («como ahora»), y el modo de falla es real: si la
     * barra hubiera quedado adentro de un panel, se escondería con él y no habría
     * forma de guardar desde ocho de las nueve pestañas.
     */
    pintar();
    for (const boton of screen.getAllByRole('button', { name: /Guardar/ })) {
      expect(boton.closest('[role="tabpanel"]')).toBeNull();
    }
    // Y sigue siendo fija, que es la otra mitad de «como ahora».
    expect(
      screen.getByRole('button', { name: 'Crear actividad' }).closest('div.fixed'),
    ).not.toBeNull();
  });

  it('el enlace de «para publicar falta» cambia a la pestaña del campo', async () => {
    /*
     * **El riesgo entero de este rediseño, en un caso.** Con todo apilado, el
     * enlace de la barra abría el acordeón y scrolleaba (B-184). Con pestañas, la
     * sección puede estar en otra solapa, o sea **fuera de la pantalla** — el
     * mismo problema con otra cara.
     *
     * El formulario vacío tiene pendientes en cuatro secciones, así que la barra
     * las nombra con su cuenta: «Qué es (5), Dónde (2), Quién (1), Arancel e
     * inscripción (1)». Se elige **«Dónde»**, que no es la pestaña activa: si el
     * click no cambiara de solapa, quien carga se quedaría mirando «Qué es» sin
     * entender por qué no puede publicar.
     *
     * MUTACIÓN PROBADA: sacarle el `setPestania` a `irASeccion` deja este caso en
     * rojo con la pestaña «Qué es» todavía activa.
     */
    pintar();
    const barra = screen.getByRole('status');
    const enlace = within(barra).getByRole('button', { name: /^Dónde/ });

    await userEvent.click(enlace);

    expect(
      screen.getByRole('tab', { name: /^Dónde/ }).getAttribute('aria-selected'),
      'el enlace de la barra no cambió de pestaña: el campo quedó fuera de la pantalla',
    ).toBe('true');
    expect(panelesVisibles()[0]!.getAttribute('aria-labelledby')).toBe('solapa-donde');
  });

  it('cada solapa dice cuántos campos le faltan para publicar', () => {
    /*
     * Es la otra mitad de lo mismo: el número es lo que permite orientarse sin
     * abrir las nueve. Y va con su propio texto para lector de pantalla, porque un
     * «3» pegado al nombre se lee «Encuentros 3», que suena a la sección número 3.
     *
     * Se afirma contra lo que dice la barra —la misma fuente, `resumirFaltantes`—
     * y no contra números escritos a mano: el día que el schema pida un campo más,
     * este caso sigue siendo cierto sin tocarlo.
     */
    pintar();
    // Se leen los botones de la barra y no su texto entero: el `textContent` del
    // `role="status"` arranca con «Para publicar falta:», que se colaba en el
    // primer nombre y hacía buscar una solapa llamada «Para publicar falta: Qué
    // es». Cada sección pendiente es un botón, y ahí el nombre está solo.
    const enLaBarra = within(screen.getByRole('status'))
      .getAllByRole('button')
      .map((b) => /^(.*?)\s*\((\d+)\)$/.exec(b.textContent ?? ''))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ seccion: m[1]!.trim(), cuantos: Number(m[2]) }));
    expect(enLaBarra.length, 'la barra no nombró ninguna sección pendiente').toBeGreaterThan(0);

    for (const { seccion, cuantos } of enLaBarra) {
      const solapa = screen.getByRole('tab', {
        name: new RegExp(`^${seccion}, ${cuantos} campos? pendientes?$`),
      });
      expect(solapa, `la solapa «${seccion}» no muestra sus ${cuantos}`).toBeTruthy();
    }

    // Y una sin pendientes no inventa un número.
    expect(screen.getByRole('tab', { name: 'Material' })).toBeTruthy();
  });
});
