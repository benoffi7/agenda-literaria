import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DirectorioPanel,
  type FichaDeDirectorio,
} from '@/components/admin/DirectorioPanel';
import type { EstadoDirectorio } from '@/lib/directorios';

/**
 * `DirectorioPanel` renderizado de verdad — B-834, tajada 2 paso 12.
 *
 * ── Por qué este componente necesita DOM ──────────────────────────────────
 * Porque lo que hay que verificar es **cableado**, y la lección de B-202 —y la
 * razón por la que la excepción de `*.render.test.tsx` existe (§«Tests» de
 * `05-patrones.md`)— es que un test que lee el fuente no distingue un filtro
 * puesto de un filtro invertido. Acá hay dos cosas de ese tipo, y las dos se
 * ven bien igual si están al revés:
 *
 * 1. **El filtro que arranca apagado.** La bandeja muestra lo que espera
 *    decisión; con el `filter` invertido muestra lo demás y sigue siendo una
 *    lista prolija de fichas.
 * 2. **Que los botones sean el grafo.** `TRANSICIONES` ya tiene su test puro
 *    (`tests/directorios.test.ts`), pero que el grafo **llegue al DOM** es otra
 *    pregunta: reemplazar el `map` por tres `if` deja el módulo intacto, el test
 *    puro en verde, y a la pantalla ofreciendo «Publicar» sobre una ficha que
 *    nadie volvió a leer. Ese es el bug que este archivo existe para atrapar.
 *
 * No hay nada mockeado y no hace falta: el componente **recibe** las fichas y la
 * escritura (§«Un control compartido recibe, no importa»), así que se monta sin
 * Firestore, sin emulador y sin sesión. Que eso sea posible es, de hecho, parte
 * de lo que el paso 12 tenía que dejar resuelto.
 */
afterEach(cleanup);

const ficha = (over: Partial<FichaDeDirectorio> = {}): FichaDeDirectorio => ({
  id: 'f1',
  nombre: 'Del Otro Lado',
  slug: 'del-otro-lado',
  estado: 'pendiente',
  origen: 'formulario-publico',
  ...over,
});

/** Los tres estados a la vez, que es lo que hace visible cualquier filtro. */
const LAS_TRES: FichaDeDirectorio[] = [
  ficha({ id: 'esperando', nombre: 'La Libre', estado: 'pendiente' }),
  ficha({ id: 'en-el-sitio', nombre: 'Eterna Cadencia', estado: 'publicado' }),
  ficha({ id: 'descartada', nombre: 'Kiosco de Diarios', estado: 'rechazado' }),
];

const montar = (over: Partial<Parameters<typeof DirectorioPanel>[0]> = {}) =>
  render(
    <DirectorioPanel
      directorio="librerias"
      fichas={LAS_TRES}
      onMover={vi.fn(async () => {})}
      {...over}
    />,
  );

/**
 * Muestra también las publicadas y las descartadas.
 *
 * Hace falta en casi todos los casos de abajo **porque el filtro por defecto
 * funciona**, y eso es información: una ficha que ya se decidió no está en la
 * bandeja hasta que alguien la pide.
 */
const verTodas = async (): Promise<void> => {
  await userEvent.click(screen.getByLabelText('Ver publicadas y descartadas'));
};

/** Los nombres de las fichas que están en pantalla, en orden. */
const enPantalla = (): string[] =>
  screen.queryAllByRole('listitem').map((li) => li.querySelector('p')?.textContent ?? '');

describe('la bandeja arranca mostrando lo que espera decisión', () => {
  it('la publicada y la descartada no están hasta que se piden', async () => {
    /*
     * MUTACIÓN PROBADA: invertir el filtro —`verCerradas ? fichas.filter(…) :
     * fichas`— deja la pantalla funcionando, con las tres fichas visibles y el
     * checkbox andando, y pone este caso en rojo. Es exactamente el falso verde
     * que un test sobre el fuente no ve.
     */
    montar();
    expect(enPantalla()).toEqual(['La Libre']);

    await userEvent.click(screen.getByLabelText('Ver publicadas y descartadas'));
    expect(enPantalla()).toEqual(['La Libre', 'Eterna Cadencia', 'Kiosco de Diarios']);
  });

  it('el vacío distingue «no hay nada» de «no hay nada esperando»', () => {
    // Son dos estados distintos y el segundo tiene una salida (el checkbox). Un
    // solo mensaje para los dos manda a buscar en Firestore lo que está a un
    // click.
    montar({ fichas: [] });
    expect(screen.getByText(/Todavía no hay nada cargado/)).toBeTruthy();

    cleanup();
    montar({ fichas: [ficha({ estado: 'publicado' })] });
    expect(screen.getByText(/No hay nada esperando decisión/)).toBeTruthy();
  });
});

describe('los botones son el grafo de transiciones', () => {
  it('una ficha descartada no ofrece publicar: hay que reabrirla', async () => {
    /*
     * **El caso que justifica todo este archivo.** Publicar de un saque lo que
     * alguien descartó mete al sitio una ficha que nadie volvió a leer.
     *
     * MUTACIÓN PROBADA: reemplazar el `map` sobre `TRANSICIONES[f.estado]` por
     * una lista escrita en el componente (`['publicado', 'pendiente',
     * 'rechazado']`) deja `tests/directorios.test.ts` **entero en verde** —el
     * grafo no se tocó— y pone este caso en rojo. Esa es la mitad que el test
     * puro no puede cubrir.
     */
    montar({ fichas: [ficha({ estado: 'rechazado' })] });
    await verTodas();
    const fila = screen.getByRole('listitem');

    expect(within(fila).queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(within(fila).getByRole('button', { name: 'Reabrir' })).toBeTruthy();
  });

  it('la publicada se baja o se despublica, y no se vuelve a publicar', async () => {
    // «Publicar lo publicado» no es una acción: un destino de más en el grafo
    // es un botón de más que no hace nada.
    montar({ fichas: [ficha({ estado: 'publicado' })] });
    await verTodas();
    const fila = screen.getByRole('listitem');

    expect(within(fila).queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(within(fila).getByRole('button', { name: 'Despublicar' })).toBeTruthy();
    expect(within(fila).getByRole('button', { name: 'Bajar del sitio' })).toBeTruthy();
  });

  it('el botón manda el destino que dice su nombre', async () => {
    /*
     * MUTACIÓN PROBADA: llamar a `onMover(f, 'publicado')` fijo —que es el
     * descuido natural cuando el `map` se escribe a mano— deja los tres botones
     * dibujados igual y pone este caso en rojo. Sin esto, «Descartar» podría
     * publicar.
     */
    // El espía se tipa con los dos parámetros —y no como `async () => {}`—
    // para que `mock.calls` sea la tupla de verdad: sin eso, leer el destino es
    // un índice sobre una tupla vacía y el chequeo de tipos lo rechaza.
    const onMover = vi.fn(async (_f: FichaDeDirectorio, _estado: EstadoDirectorio) => {});
    montar({ fichas: [ficha({ id: 'f9', estado: 'pendiente' })], onMover });

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onMover).toHaveBeenCalledTimes(1);
    expect(onMover.mock.calls[0]?.[1]).toBe('rechazado');
    expect(onMover.mock.calls[0]?.[0].id).toBe('f9');
  });
});

describe('lo que la ficha dice de sí misma', () => {
  it('la dirección web se muestra, y dice cuándo quedó fija — trampa 10', async () => {
    /*
     * Que el campo esté congelado sin explicación es lo que hace que alguien lo
     * intente cambiar por la consola. Y el aviso sale de `slugBloqueado`, no de
     * un `estado === 'publicado'` escrito acá: el caso de B-285 —despublicada,
     * pero publicada alguna vez— tiene que seguir mostrándolo.
     *
     * MUTACIÓN PROBADA: comparar `f.estado === 'publicado'` en vez de llamar a
     * `slugBloqueado(f)` pone en rojo el segundo aserto, que es la puerta de
     * atrás del candado.
     */
    montar({ fichas: [ficha({ estado: 'publicado' })] });
    await verTodas();
    expect(screen.getByText(/\/del-otro-lado \(fija desde que se publicó\)/)).toBeTruthy();

    cleanup();
    // Despublicada pero publicada alguna vez: sigue congelada (B-285).
    montar({ fichas: [ficha({ estado: 'pendiente', publicadaAlgunaVez: true })] });
    expect(screen.getByText(/\(fija desde que se publicó\)/)).toBeTruthy();
  });

  it('dice de dónde vino, que es lo que cambia cuánto hay que revisar', () => {
    montar({ fichas: [ficha({ origen: 'formulario-publico' })] });
    expect(screen.getByText(/la cargaron desde el sitio/)).toBeTruthy();
  });

  it('el detalle de cada entidad entra por una función, no por una lista de campos', () => {
    /*
     * Es la costura que hace que esta pantalla sirva para los tres directorios
     * sin un `if` por entidad: agregar «qué incluye» a los lugares (tajada 4) no
     * toca este componente.
     */
    montar({
      fichas: [ficha()],
      detalle: (f) => <span>Palermo · {f.slug}</span>,
    });
    expect(screen.getByText('Palermo · del-otro-lado')).toBeTruthy();
  });

  it('sin `onEditar` no hay botón que abra un formulario que no existe', () => {
    // Los formularios por entidad llegan con su tajada. Un botón «Abrir» que no
    // lleva a ningún lado es peor que no tenerlo.
    montar({ fichas: [ficha()] });
    expect(screen.queryByRole('button', { name: 'Abrir' })).toBeNull();

    cleanup();
    montar({ fichas: [ficha()], onEditar: vi.fn() });
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeTruthy();
  });
});
