/**
 * `EstadisticasPanel` — las pestañas internas, renderizadas de verdad (B-501).
 *
 * **Por qué este componente necesita DOM.** Qué panel se muestra y la
 * navegación por teclado son cableado real —`document.activeElement`, el
 * `aria-selected` que cambia, el `tabIndex` que se mueve entre botones— que un
 * test que lea el fuente no puede verificar sin arriesgarse a un falso verde
 * (la misma familia de `tests/menu-acciones.render.test.tsx`, y la misma
 * lección de B-202).
 *
 * `listarActividades`, `medirFuncion` y `useLabelsTaxonomia` van mockeados: lo
 * que este archivo cuida son las pestañas, no `estadoDelCatalogo` (ya cubierto
 * puro en `tests/estado-del-catalogo.test.ts`) ni la lectura de Firestore.
 *
 * Vive en `.render.test.tsx` y no en `.test.ts` por el mismo motivo que
 * `menu-acciones.render.test.tsx`: `vitest.config.ts` solo monta jsdom para
 * ese patrón (`environmentMatchGlobs`).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actividades', () => ({
  listarActividades: vi.fn(async () => []),
}));
vi.mock('@/lib/analytics', () => ({
  medirFuncion: vi.fn(),
}));
/*
 * `useOpciones('tipo')` entra con B-700: el tablero le pide los **matices
 * elegidos a mano** para pintar la torta con el mismo color que el sitio
 * (D-150). Va mockeado por lo mismo que `useLabelsTaxonomia` —es una
 * suscripción a Firestore— y devuelve la forma real, no un objeto suelto: sin
 * `valores`, `tonosDeTipo` recibiría `undefined` y el mock estaría probando otra
 * cosa que la pantalla.
 */
vi.mock('@/components/admin/useOpciones', () => ({
  useLabelsTaxonomia: () => ({}),
  useOpciones: () => ({ valores: [], cargando: false }),
}));
/*
 * B-374/B-373 — la pestaña «El sitio público» pasó a leer un documento de
 * Firestore (`sistema/analitica-sitio`) al abrirse. Va mockeado por lo mismo
 * que `listarActividades`: lo que este archivo cuida son las pestañas.
 *
 * El mock devuelve el resumen **vacío**, que es el estado que la pantalla tiene
 * que dibujar cuando la Function todavía no corrió — y se arma con
 * `leerResumenDelSitio(null)`, el lector de verdad, en vez de escribir el
 * objeto a mano: así un campo nuevo en el resumen no deja este mock viejo
 * fingiendo una forma que ya no existe.
 */
vi.mock('@/lib/analiticaDelSitio', () => ({
  leerAnaliticaDelSitio: vi.fn(async () => leerResumenDelSitio(null)),
}));

import { EstadisticasPanel } from '@/components/admin/EstadisticasPanel';
import { listarActividades } from '@/lib/actividades';
import { leerResumenDelSitio } from '@/lib/resumenDelSitio';
import { PREFIJO_VISTA } from '@/lib/vistaDeGrafico';
import type { ActividadConId } from '@/types/actividad';

afterEach(() => cleanup());

/**
 * El texto que ancla la pestaña del sitio público.
 *
 * **Es el de la franja de arriba, que está en las dos ramas** —con datos y
 * sin—, y no la frase del estado vacío: ésa cambia según la situación (nunca
 * corrió, falta configurar, falló, sin volumen), así que atar el test a una de
 * ellas lo haría fallar el día que la pantalla dice la verdad de otra forma.
 */
const ANCLA_SITIO = /Cómo se usa el sitio público/;

const montar = async () => {
  render(<EstadisticasPanel onEditar={() => {}} />);
  // El tablist recién aparece cuando `listarActividades()` resuelve — el
  // mismo instante en que se apaga «Cargando…».
  return screen.findByRole('tablist');
};

describe('EstadisticasPanel — qué panel se muestra (B-501)', () => {
  it('arranca en «El catálogo», con su contenido', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    expect(tabCatalogo.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Todavía no hay actividades cargadas/)).not.toBeNull();
    expect(screen.queryByText(ANCLA_SITIO)).toBeNull();
  });

  it('un clic en «El sitio público» cambia el panel que se ve, no solo el botón activo', async () => {
    await montar();
    await userEvent.click(screen.getByRole('tab', { name: 'El sitio público' }));

    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });
    expect(tabSitio.getAttribute('aria-selected')).toBe('true');
    // La mitad que un cambio de estilo sin cambiar el contenido no puede
    // fingir: el texto de la otra pestaña tiene que estar, y el del catálogo
    // ya no.
    // La lectura del resumen es asíncrona: hasta que resuelve, el panel dice
    // «Cargando…». `findByText` espera ese tick — con `getByText` este caso
    // fallaría por la carrera y no por el cableado que verifica.
    expect(await screen.findByText(ANCLA_SITIO)).not.toBeNull();
    expect(screen.queryByText(/Todavía no hay actividades cargadas/)).toBeNull();
  });
});

describe('EstadisticasPanel — navegación por teclado (B-501)', () => {
  it('ArrowRight mueve el foco Y activa la pestaña siguiente, en el mismo gesto', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });

    tabCatalogo.focus();
    act(() => {
      fireEvent.keyDown(tabCatalogo, { key: 'ArrowRight' });
    });

    expect(document.activeElement).toBe(tabSitio);
    expect(tabSitio.getAttribute('aria-selected')).toBe('true');
    // La lectura del resumen es asíncrona: hasta que resuelve, el panel dice
    // «Cargando…». `findByText` espera ese tick — con `getByText` este caso
    // fallaría por la carrera y no por el cableado que verifica.
    expect(await screen.findByText(ANCLA_SITIO)).not.toBeNull();
  });

  it('ArrowLeft desde la primera pestaña da la vuelta a la última (wrap)', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });

    tabCatalogo.focus();
    act(() => {
      fireEvent.keyDown(tabCatalogo, { key: 'ArrowLeft' });
    });

    expect(document.activeElement).toBe(tabSitio);
    expect(tabSitio.getAttribute('aria-selected')).toBe('true');
  });

  it('roving tabindex: solo la pestaña activa es alcanzable con Tab', async () => {
    await montar();
    const tabCatalogo = screen.getByRole('tab', { name: 'El catálogo' });
    const tabSitio = screen.getByRole('tab', { name: 'El sitio público' });

    expect(tabCatalogo.tabIndex).toBe(0);
    expect(tabSitio.tabIndex).toBe(-1);

    tabCatalogo.focus();
    act(() => {
      fireEvent.keyDown(tabCatalogo, { key: 'ArrowRight' });
    });

    expect(tabSitio.tabIndex).toBe(0);
    expect(tabCatalogo.tabIndex).toBe(-1);
  });
});

/**
 * El toggle torta/lista — B-700, B-701.
 *
 * **Solo el cableado.** Los ángulos de la torta, la agrupación de la cola y el
 * porcentaje están cubiertos puros en `tests/torta-del-panel.test.ts`, y la
 * memoria en `tests/vista-de-grafico.test.ts`. Lo que ninguno de los dos puede
 * ver es lo que se rompe acá: que el botón **cambie lo que se dibuja** (y no
 * solo su propio estilo), y que lo elegido **llegue** a `localStorage` — una
 * memoria perfecta sin nadie que la llame se ve exactamente igual.
 */
describe('EstadisticasPanel — el toggle torta/lista (B-700, B-701)', () => {
  /**
   * Lo mínimo para que el tablero dibuje un reparto con dos tajadas.
   *
   * Se arma a mano y no con el fixture de `estado-del-catalogo.test.ts`: lo que
   * este archivo necesita es que `estadoDelCatalogo` devuelva **dos** tipos y
   * **dos** aranceles distintos, y nada más. Un fixture completo acá haría
   * pensar que se está probando el cálculo, que ya está cubierto puro.
   */
  const acto = (id: string, tipo: string, arancel: string) =>
    ({
      id,
      titulo: `Actividad ${id}`,
      tipo,
      estado: 'publicado',
      esCiclo: false,
      modalidad: 'presencial',
      modalidades: [],
      sede: null,
      online: null,
      sesiones: [],
      tags: ['escritura'],
      imagenes: [],
      descripcion: 'x'.repeat(120),
      arancel: { tipo: arancel, notas: '' },
      inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
      material: { tiene: false, items: [] },
      difusion: { arrobar: [], notas: '' },
    }) as unknown as ActividadConId;

  const DOS_TIPOS = [acto('a', 'taller', 'gratis'), acto('b', 'club-lectura', 'arancelado')];

  const montarConDatos = async () => {
    vi.mocked(listarActividades).mockResolvedValueOnce(DOS_TIPOS);
    render(<EstadisticasPanel onEditar={() => {}} />);
    return screen.findByRole('tablist');
  };

  const toggleDeTipo = () =>
    screen.getByRole('group', { name: 'Vista de «Por tipo»' });

  it('arranca en torta y el botón dice cuál está activa', async () => {
    await montarConDatos();
    const [torta, lista] = [...toggleDeTipo().querySelectorAll('button')];
    expect(torta!.getAttribute('aria-pressed')).toBe('true');
    expect(lista!.getAttribute('aria-pressed')).toBe('false');
    // La torta de verdad está dibujada: un `<svg role="img">` con su etiqueta.
    expect(screen.getByRole('img', { name: /^Por tipo:/ })).not.toBeNull();
  });

  it('un clic en «Lista» cambia lo que se dibuja, no solo el botón activo', async () => {
    await montarConDatos();
    await userEvent.click(
      [...toggleDeTipo().querySelectorAll('button')].find((b) => b.textContent === 'Lista')!,
    );
    // La mitad que un cambio de estilo no puede fingir: la torta ya no está.
    expect(screen.queryByRole('img', { name: /^Por tipo:/ })).toBeNull();
  });

  it('y lo elegido queda guardado: la próxima visita arranca donde se dejó', async () => {
    /*
     * El cableado que `vista-de-grafico.test.ts` no puede ver. Sin la llamada a
     * `recordarVista`, la memoria funciona perfecto y no la usa nadie: el
     * toggle vuelve a torta en cada recarga y nada falla.
     */
    localStorage.clear();
    await montarConDatos();
    await userEvent.click(
      [...toggleDeTipo().querySelectorAll('button')].find((b) => b.textContent === 'Lista')!,
    );
    expect(localStorage.getItem(`${PREFIJO_VISTA}tipo`)).toBe('lista');

    cleanup();
    await montarConDatos();
    expect(screen.queryByRole('img', { name: /^Por tipo:/ })).toBeNull();
  });

  it('cada reparto recuerda el suyo: elegir en «tipo» no cambia «arancel»', async () => {
    localStorage.clear();
    await montarConDatos();
    await userEvent.click(
      [...toggleDeTipo().querySelectorAll('button')].find((b) => b.textContent === 'Lista')!,
    );
    expect(screen.getByRole('img', { name: /^Por arancel:/ })).not.toBeNull();
  });
});
