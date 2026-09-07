/**
 * Los dos filtros que B-274 repuso, renderizados de verdad.
 *
 * **Por qué necesitan DOM y qué se deja afuera.** Lo que los filtros *deciden*
 * está cubierto puro en `tests/filtrosActividades.test.ts` y no se repite acá:
 * las tres reglas del conteo de cada chip, la unión con «o» adentro del eje, los
 * documentos viejos sin `destacado`. Lo que este archivo cuida es la mitad que un
 * `grep` sobre el JSX vería igual estando roto (la lección de B-202):
 *
 * - que el desplegable de «Destacada» **aparezca solo si hay alguna destacada** —
 *   la condición está escrita en una rama, y una rama que nunca se cumple se ve
 *   idéntica en el fuente;
 * - que los chips sean **botones de alternancia con `aria-pressed`** y no un
 *   `div` con `onClick`, que es lo que decide si se pueden usar con teclado;
 * - que un click **alterne** y no acumule: el modo de falla es un chip que se
 *   enciende y no se puede apagar, y el listado queda filtrado sin salida.
 *
 * Vive en `.render.test.tsx` porque `vitest.config.ts` monta jsdom solo para ese
 * patrón.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FiltrosActividades } from '@/components/admin/FiltrosActividades';
import { FILTROS_VACIOS, ORDEN_POR_DEFECTO, opcionesPresentes } from '@/lib/filtrosActividades';
import type { Filtros } from '@/lib/filtrosActividades';
import type { ActividadConId } from '@/types/actividad';

afterEach(cleanup);

const acto = (over: Partial<ActividadConId> & { id: string }): ActividadConId =>
  ({
    titulo: `Actividad ${over.id}`,
    tipo: 'taller',
    estado: 'publicado',
    modalidad: 'presencial',
    sede: null,
    sesiones: [],
    searchText: '',
    ...over,
  }) as unknown as ActividadConId;

const ahora = new Date('2026-09-07T12:00:00Z');

/**
 * Pinta los filtros **ya abiertos** y devuelve el espía de `onFiltros`.
 *
 * Arrancan abiertos porque el componente los abre cuando hay alguno puesto, y
 * pasarle un filtro cualquiera para eso mezclaría el estado inicial con lo que se
 * quiere medir. Se abre con un click, que es además lo que hace una persona.
 */
const pintar = async (actividades: ActividadConId[], filtros: Filtros = FILTROS_VACIOS) => {
  const onFiltros = vi.fn();
  render(
    <FiltrosActividades
      filtros={filtros}
      onFiltros={onFiltros}
      orden={ORDEN_POR_DEFECTO}
      onOrden={vi.fn()}
      opciones={opcionesPresentes(actividades)}
      labels={{}}
      total={actividades.length}
      mostradas={actividades.length}
      actividades={actividades}
      ahora={ahora}
    />,
  );
  if (filtros === FILTROS_VACIOS) {
    await userEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
  }
  return onFiltros;
};

describe('«Destacada» aparece solo cuando hay alguna — B-274', () => {
  it('con una destacada, el desplegable está y ofrece los tres valores', async () => {
    await pintar([acto({ id: 'a', destacado: true }), acto({ id: 'b' })]);
    const select = screen.getByLabelText('Destacada');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Cualquiera',
      'Solo destacadas',
      'Solo no destacadas',
    ]);
  });

  it('sin ninguna destacada no se pinta, porque los tres valores contestarían lo mismo', async () => {
    /*
     * MUTACIÓN PROBADA: sacar el `opciones.hayDestacadas &&` del componente deja
     * este caso en rojo. Es el aserto que un `grep` no puede dar: el `<select>`
     * está escrito en el fuente en los dos casos.
     */
    await pintar([acto({ id: 'a' }), acto({ id: 'b' })]);
    expect(screen.queryByLabelText('Destacada')).toBeNull();
  });

  it('elegir un valor lo reporta hacia arriba sin tocar los demás filtros', async () => {
    const onFiltros = await pintar([acto({ id: 'a', destacado: true })]);
    await userEvent.selectOptions(screen.getByLabelText('Destacada'), 'no');
    expect(onFiltros).toHaveBeenCalledWith({ ...FILTROS_VACIOS, destacado: 'no' });
  });
});

describe('el eje de etiquetas son botones de alternancia — B-274', () => {
  const datos = [
    acto({ id: 'a', tags: ['poesia', 'principiantes'] }),
    acto({ id: 'b', tags: ['poesia'] }),
  ];

  it('cada etiqueta es un `aria-pressed`, no un div con onClick', async () => {
    /*
     * Es lo que decide si se puede usar sin mouse: así lo anuncia un lector de
     * pantalla como «Poesia, botón de alternancia, no presionado», y funciona con
     * Enter y con barra espaciadora sin escribir un `onKeyDown` de más.
     */
    await pintar(datos);
    const grupo = screen.getByRole('group', { name: /^Etiquetas/ });
    const chips = within(grupo).getAllByRole('button');
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip.getAttribute('aria-pressed')).toBe('false');
      expect(chip.tagName).toBe('BUTTON');
    }
  });

  it('el número de cada etiqueta se lee aparte del nombre', async () => {
    // «Poesía 12» se leería como una poesía número 12. El nombre accesible tiene
    // que traer las dos cosas, separadas.
    await pintar(datos);
    expect(
      within(screen.getByRole('group', { name: /^Etiquetas/ })).getByRole('button', {
        /*
         * «Poesia» sin tilde porque este render pasa `labels={{}}`: es el respaldo
         * de `desSlug`. **La etiqueta curada tiene su propio caso abajo**, y hasta
         * que el `auditor-trampas` lo señaló este aserto fijaba un bug: el
         * componente tenía `labels.tags` y no se lo pasaba a `chipsDeTags`, así que
         * una etiqueta cargada como «Poesía» se leía «Poesia» acá y «Poesía» en el
         * autocompletado, en la tarjeta y en el sitio.
         */
        name: 'Poesia, 2 actividades',
      }),
      'el número quedó pegado al nombre: se leería como «Poesia 2»',
    ).toBeTruthy();
  });

  it('el elegido se muestra presionado, y un click lo apaga', async () => {
    /*
     * El modo de falla que esto frena: un chip que se enciende y no se puede
     * apagar deja el listado filtrado sin salida. Con `conTagAlternada` es la
     * misma operación en los dos sentidos, y acá se mide que el componente la use
     * en vez de acumular.
     */
    const onFiltros = await pintar(datos, { ...FILTROS_VACIOS, tags: ['poesia'] });
    const grupo = screen.getByRole('group', { name: /^Etiquetas/ });
    const elegido = within(grupo).getByRole('button', { name: /^Poesia/ });
    expect(elegido.getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(elegido);
    expect(onFiltros).toHaveBeenCalledWith({ ...FILTROS_VACIOS, tags: [] });
  });

  it('un click en uno apagado lo suma a los que ya estaban', async () => {
    const onFiltros = await pintar(datos, { ...FILTROS_VACIOS, tags: ['poesia'] });
    const grupo = screen.getByRole('group', { name: /^Etiquetas/ });
    await userEvent.click(within(grupo).getByRole('button', { name: /^Principiantes/ }));
    expect(onFiltros).toHaveBeenCalledWith({
      ...FILTROS_VACIOS,
      tags: ['poesia', 'principiantes'],
    });
  });

  it('las flechas mueven el foco dentro del grupo', async () => {
    /*
     * La aritmética es la de `lib/foco.ts` y está testeada ahí; lo que se mide acá
     * es que el componente **la haya cableado**, que es lo que se olvida.
     */
    await pintar(datos);
    const grupo = screen.getByRole('group', { name: /^Etiquetas/ });
    const [primero, segundo] = within(grupo).getAllByRole('button');
    primero!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(segundo);
  });

  it('el chip usa la etiqueta curada de `/opciones/tags`, no el slug legibilizado', async () => {
    /*
     * **El hallazgo del `auditor-trampas`.** `desSlug` separa por guiones y
     * capitaliza: no restaura acentos ni la ñ, y no puede. Una etiqueta cargada
     * como «Poesía» se guarda con el slug `poesia` (§4.2), así que sin la curada el
     * panel dice «Poesia» mientras el autocompletado del formulario, la tarjeta y
     * los chips del sitio dicen «Poesía» — el mismo dato con dos nombres en dos
     * pantallas que se miran juntas.
     *
     * MUTACIÓN PROBADA: volver `chipsDeTags` a `desSlug(valor)` a secas deja este
     * caso en rojo y el de arriba en verde, que es la diferencia entre los dos.
     */
    const onFiltros = vi.fn();
    render(
      <FiltrosActividades
        filtros={{ ...FILTROS_VACIOS, tags: ['poesia'] }}
        onFiltros={onFiltros}
        orden={ORDEN_POR_DEFECTO}
        onOrden={vi.fn()}
        opciones={opcionesPresentes([acto({ id: 'a', tags: ['poesia'] })])}
        labels={{ tags: { poesia: 'Poesía' } }}
        total={1}
        mostradas={1}
        actividades={[acto({ id: 'a', tags: ['poesia'] })]}
        ahora={ahora}
      />,
    );
    const grupo = screen.getByRole('group', { name: /^Etiquetas/ });
    expect(within(grupo).getByRole('button', { name: 'Poesía, 1 actividad' })).toBeTruthy();
    expect(within(grupo).queryByRole('button', { name: /^Poesia,/ })).toBeNull();
  });

  it('sin ninguna etiqueta cargada, el eje no se pinta', async () => {
    await pintar([acto({ id: 'a' })]);
    expect(screen.queryByRole('group', { name: /^Etiquetas/ })).toBeNull();
  });
});
