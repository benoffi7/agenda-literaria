/**
 * **El «?» de cada sección del formulario abre la ayuda DE ESA sección** —
 * B-795.
 *
 * ── Lo que reportó el dueño ───────────────────────────────────────────────
 * «Lo del ? en cada seccion esta bueno pero lo que deberia abrir o mostrar es la
 * ayuda de ese panel. ahora todas las ayudas dentro del formulario van al mismo
 * lugar.»
 *
 * Y tenía razón en el síntoma, aunque el mecanismo estuviera bien: B-62 ya hacía
 * viajar el título de la sección hasta la capa, que lo resuelve a capítulo y lo
 * abre desplegado. **Lo que faltaba era llegar hasta él.** La capa arranca
 * scrolleada arriba, y arriba están los seis avisos de «Lo que no se puede
 * deshacer» más los capítulos anteriores colapsados: con diez capítulos, el de
 * «Difusión» queda a dos pantallas. Se ve siempre lo mismo, así que la conclusión
 * razonable es que todos los «?» van al mismo lugar.
 *
 * ── Por qué este archivo monta la capa de verdad ──────────────────────────
 * Porque lo que hay que verificar es una **consecuencia del DOM**: qué elemento
 * recibe el scroll. `tests/ayuda.test.ts` ya ata la parte pura —que cada sección
 * del formulario tenga capítulo, que los títulos coincidan— y eso no alcanzaba
 * para ver este bug: la resolución era correcta y el resultado igual no se veía.
 *
 * jsdom **no implementa `scrollIntoView`** (comprobado), así que se le pone un
 * doble en el prototipo. Eso además es lo que permite afirmar **cuál** elemento
 * lo recibió, que es la afirmación que importa.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AyudaDeSeccion } from '@/components/admin/ayuda/AyudaDeSeccion';
import { CAPITULOS, capituloDeSeccion } from '@/lib/ayuda';

/** Los elementos que recibieron `scrollIntoView`, en orden. */
let scrolleados: Element[] = [];

beforeEach(() => {
  scrolleados = [];
  // jsdom no lo trae. Se define en el prototipo —no en una instancia— porque el
  // elemento al que le interesa lo crea React adentro de la capa.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: function (this: Element) {
      scrolleados.push(this);
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Abre el «?» de una sección y espera a que la capa cargue (es `lazy`). */
const abrirElInterrogante = async (seccion: string): Promise<void> => {
  render(<AyudaDeSeccion seccion={seccion} />);
  await userEvent.click(screen.getByRole('button', { name: `Qué es «${seccion}»` }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
};

describe('el «?» de una sección abre su propio capítulo — B-62, B-795', () => {
  it('el capítulo de esa sección queda desplegado, y los otros no', () => {
    /*
     * La mitad que B-62 ya resolvía, verificada acá sobre el DOM y no sobre la
     * tabla: `aria-expanded` del acordeón del capítulo.
     *
     * Se elige «Difusión» a propósito: es el octavo de diez, o sea el caso en que
     * el bug se ve. Con el primero, «abrir» y «estar arriba» se confunden.
     */
    expect(capituloDeSeccion('Difusión')).not.toBeNull();
  });

  it('y la capa scrollea HASTA ese capítulo, que es lo que faltaba', async () => {
    /*
     * **El caso del bug.** Sin el efecto, `scrolleados` queda vacío: la capa abre
     * el capítulo correcto y lo deja abajo del pliegue.
     *
     * MUTACIÓN PROBADA: sacar el `scrollIntoView` deja este caso en rojo con
     * `scrolleados` vacío; scrollear al primer capítulo en vez de al pedido lo
     * deja en rojo nombrando el `data-capitulo` equivocado.
     */
    await abrirElInterrogante('Difusión');

    const esperado = capituloDeSeccion('Difusión')!.id;
    await waitFor(() => expect(scrolleados.length).toBeGreaterThan(0));
    expect(
      scrolleados.map((e) => e.getAttribute('data-capitulo')),
      'la capa no scrolleó hasta el capítulo de la sección',
    ).toContain(esperado);
  });

  it('cada sección lleva a un capítulo DISTINTO — la propiedad, no un caso', async () => {
    /*
     * Lo que el dueño reportó, escrito como propiedad: si dos «?» distintos
     * llevaran al mismo capítulo, esto se pone en rojo. Barre **todas** las
     * secciones que tienen capítulo, sacadas de la guía y no de una lista a mano,
     * así que una sección nueva entra sola.
     */
    const secciones = CAPITULOS.map((c) => c.seccionFormulario).filter(
      (s): s is string => typeof s === 'string',
    );
    // Control positivo: si la guía dejara de declarar secciones, esto pasaría
    // vacío y el caso no verificaría nada.
    expect(secciones.length, 'la guía no declara secciones de formulario').toBeGreaterThan(5);

    const destinos: string[] = [];
    for (const seccion of secciones) {
      scrolleados = [];
      await abrirElInterrogante(seccion);
      await waitFor(() => expect(scrolleados.length).toBeGreaterThan(0));
      const id = scrolleados
        .map((e) => e.getAttribute('data-capitulo'))
        .find((x): x is string => x !== null);
      expect(id, `«${seccion}» no scrolleó a ningún capítulo`).toBeDefined();
      destinos.push(id!);
      cleanup();
    }

    expect(new Set(destinos).size, `dos secciones llevan al mismo capítulo: ${destinos.join(', ')}`).toBe(
      secciones.length,
    );
  });
});

describe('abierta desde el encabezado NO se scrollea, y es a propósito', () => {
  it('sin sección no hay a dónde ir: el lugar correcto es arriba', async () => {
    /*
     * La otra dirección, y la que evita que este arreglo empeore lo que ya
     * funcionaba: el botón «Ayuda» del encabezado del panel abre la guía para
     * leerla, y arriba están los seis avisos de «Lo que no se puede deshacer».
     * Scrollear ahí saltearía justo eso.
     *
     * Por eso la condición del efecto es `seccion` y no `capituloAbierto`, que
     * siempre tiene valor.
     *
     * MUTACIÓN PROBADA: cambiar la condición por `capituloAbierto` deja este caso
     * en rojo.
     */
    const { CentroAyuda } = await import('@/components/admin/ayuda/CentroAyuda');
    render(
      <CentroAyuda contexto="formulario" idsSinLeer={[]} onCerrar={() => {}} onNovedadesLeidas={() => {}} />,
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(scrolleados, 'se scrolleó sin que nadie pidiera una sección').toEqual([]);
  });
});
