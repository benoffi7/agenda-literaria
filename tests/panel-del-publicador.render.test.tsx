/**
 * **El listado del panel con el rol acotado, renderizado de verdad** — B-888,
 * tajada 2.
 *
 * ── Por qué esta pantalla necesita DOM ────────────────────────────────────
 * Lo que se mide son dos cosas que un test sobre el fuente no puede distinguir
 * de un falso verde (B-202): **con qué argumentos se pide la colección** —que no
 * es presentación, es lo único que hace que la query exista para este rol
 * (trampa 7)— y **qué acciones quedan en el menú de una tarjeta**, que es un
 * array armado con un spread condicional. Un `toContain('puedeVer')` sobre el
 * archivo pasaría igual con la condición invertida.
 *
 * La tabla de quién ve qué es pura y vive en `tests/rol-del-panel.test.ts`; acá
 * no se repite. Lo de acá es el cableado.
 *
 * Vive en `.render.test.tsx` porque `vitest.config.ts` monta jsdom solo para ese
 * patrón (`environmentMatchGlobs`).
 */
import { useState } from 'react';
import { FILTROS_VACIOS, ORDEN_POR_DEFECTO } from '@/lib/filtrosActividades';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tsDe } from './fixtures/tiempo';
import type { ActividadConId } from '@/types/actividad';
import type { UsuarioConId } from '@/types/usuario';

vi.mock('@/lib/analytics', () => ({ medirFuncion: vi.fn() }));

vi.mock('@/lib/actividades', () => ({
  listarActividades: vi.fn(),
  documentoAForm: vi.fn(() => ({})),
  borrarActividad: vi.fn(async () => {}),
  marcarCupoCompleto: vi.fn(async () => {}),
}));

vi.mock('@/lib/usuarios', () => ({
  listarUsuarios: vi.fn(),
  // `mailesPorUid` es puro: se reimplementa igual que el real para no inventar
  // una forma distinta del mapa (es lo que decide qué dice la marca de autoría).
  mailesPorUid: (us: UsuarioConId[]) =>
    new Map(us.filter((u) => u.email).map((u) => [u.uid, u.email])),
}));

vi.mock('@/components/admin/useOpciones', () => ({
  useLabelsTaxonomia: () => ({ tipo: { taller: 'Taller' } }),
}));

import { listarActividades } from '@/lib/actividades';
import { listarUsuarios } from '@/lib/usuarios';
import {
  ListaActividades,
  type Props as PropsDeLista,
} from '@/components/admin/ListaActividades';

const UID_PROPIO = 'uid_propio';
const UID_OTRA = 'uid_otra_cuenta';

const acto = (over: Partial<ActividadConId> = {}): ActividadConId =>
  ({
    id: 'a1',
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    estado: 'publicado',
    esCiclo: false,
    sesiones: [],
    modalidades: [],
    modalidad: 'presencial',
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    imagenes: [{ id: 'img_1', url: 'https://x/f.jpg', epigrafe: '', origen: 'externa', portada: true }],
    tags: [],
    searchText: 'taller de cronica',
    createdBy: UID_PROPIO,
    updatedBy: UID_PROPIO,
    updatedAt: tsDe(new Date('2026-09-10T12:00:00Z')),
    ...over,
  }) as unknown as ActividadConId;

/**
 * **El estado de los filtros entra por props desde B-955**, así que el montaje
 * del test lo provee: subirlo a `AdminApp` es justamente lo que arregló el ítem
 * —el listado se desmonta al editar y perdía todo—, y acá hace falta un lugar
 * donde viva para que el componente se comporte como en el panel.
 *
 * Es un wrapper y no un objeto fijo a propósito: con `filtros` constante, un
 * caso que tipee en el buscador no vería cambiar nada y pasaría por vacío.
 */
const ConFiltros = (p: Omit<PropsDeLista, 'filtros' | 'setFiltros' | 'orden' | 'setOrden'>) => {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState(ORDEN_POR_DEFECTO);
  return (
    <ListaActividades
      {...p}
      filtros={filtros}
      setFiltros={setFiltros}
      orden={orden}
      setOrden={setOrden}
    />
  );
};

const props = {
  onEditar: vi.fn(),
  onNueva: vi.fn(),
  onDuplicar: vi.fn(),
  onHistorial: vi.fn(),
  version: 0,
  uid: UID_PROPIO,
};

beforeEach(() => {
  vi.mocked(listarActividades).mockResolvedValue([acto()]);
  vi.mocked(listarUsuarios).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const montar = async (rol: 'admin' | 'publicador', ciudad = '') => {
  render(<ConFiltros {...props} rol={rol} ciudad={ciudad} />);
  return await screen.findByRole('list');
};

const menuDe = async (titulo: string) => {
  const boton = screen.getByRole('button', { name: `Más acciones de ${titulo}` });
  await userEvent.click(boton);
  return screen.getByRole('menu');
};

describe('el listado pide lo suyo, y eso no es presentación — B-888', () => {
  it('un publicador pide la colección acotada a su uid', async () => {
    /*
     * **Esta es la primera de las cuatro roturas, y la que no se puede tapar con
     * un filtro en memoria.** Con la regla de B-888, `read` incluye `list` y la
     * condición sobre `resource.data` obliga a que la query traiga el `where`:
     * sin él Firestore **rechaza la query entera** y el listado queda roto, no
     * acotado (trampa 7). Por eso lo que se afirma son los argumentos y no lo que
     * se ve después.
     *
     * MUTACIÓN PROBADA: sacarle la rama del `where` a `listarActividades`
     * (`src/lib/actividades.ts`) —o pasarle `'admin'` desde el hook— deja este
     * caso en rojo. Con el emulador corriendo, la rotura real la muestra
     * `rol-publicador.integracion.test.ts`, que ve el `permission-denied`.
     */
    await montar('publicador');
    expect(vi.mocked(listarActividades)).toHaveBeenCalledWith('publicador', UID_PROPIO, '');
  });

  it('y un admin sigue pidiendo el catálogo entero', async () => {
    // Control positivo: sin esto, un `listarActividades` que siempre acotara
    // también pasaría el caso de arriba.
    await montar('admin');
    expect(vi.mocked(listarActividades)).toHaveBeenCalledWith('admin', UID_PROPIO, '');
  });

  it('con ciudad en el claim, la ciudad viaja a la query — B-919', async () => {
    /*
     * **La ciudad no es presentación, es la segunda consulta.** El alcance por
     * ciudad lo resuelve `listarActividades` con `where('ciudades',
     * 'array-contains', ciudad)`, y esa consulta no existe si el valor no llega:
     * el listado le mostraría a la publicadora **solo lo suyo**, o sea el
     * comportamiento anterior a B-919, sin que nada falle.
     *
     * MUTACIÓN PROBADA: sacar `ciudad={ciudad}` del `<ListaActividades>` de
     * `AdminApp`, o el cuarto argumento del `useActividades` de
     * `ListaActividades`, deja este caso en rojo. Los dos casos de arriba siguen
     * verdes, que es lo que lo hace un caso aparte.
     */
    await montar('publicador', 'mar-del-plata');
    expect(vi.mocked(listarActividades)).toHaveBeenCalledWith(
      'publicador',
      UID_PROPIO,
      'mar-del-plata',
    );
  });

  it('el publicador no pide el directorio de cuentas, que la regla le cierra', async () => {
    /*
     * La regla le da **su** documento por id, y una condición por ruta no es
     * satisfacible en un `list`: pedir el directorio le devolvería un
     * `permission-denied` por un dato que no usa (no ve el filtro de autor ni
     * actividades de nadie más). Es la misma idea que el `where`: no hacer la
     * llamada que ya sabemos que falla.
     *
     * MUTACIÓN PROBADA: poner `leeElDirectorio: true` en `PERMISOS.publicador`
     * deja este caso en rojo.
     */
    await montar('publicador');
    expect(vi.mocked(listarUsuarios)).not.toHaveBeenCalled();
  });

  it('y el admin sí, porque es lo que le pone nombre a la autoría', async () => {
    await montar('admin');
    expect(vi.mocked(listarUsuarios)).toHaveBeenCalled();
  });
});

describe('el menú de una tarjeta no ofrece la pantalla que no le corresponde — B-888', () => {
  it('un publicador no tiene «Historial»', async () => {
    /*
     * **La segunda mutación obligatoria de esta tajada.** El historial es la
     * subcolección `versiones`, que **no hereda** la regla del padre y se quedó en
     * `esAdmin()`: el botón sería un `permission-denied` garantizado sobre una
     * actividad que sí es suya, que es la peor forma de fallar (parece un bug del
     * panel, no un permiso).
     *
     * MUTACIÓN PROBADA: sacarle el `puedeVer(rol, 'historial') ? … : []` al array
     * de `MenuAcciones` en `ListaActividades.tsx` deja este caso en rojo, y el de
     * abajo en verde — que es la diferencia entre los dos.
     */
    await montar('publicador');
    const menu = await menuDe('Taller de crónica');
    expect(within(menu).queryByText('Historial')).toBeNull();

    // Y no se llevó puestas las otras tres: esconder de más también es un bug.
    expect(within(menu).getByText('Duplicar')).not.toBeNull();
    expect(within(menu).getByText('Borrar')).not.toBeNull();
  });

  it('un admin sí lo tiene', async () => {
    await montar('admin');
    const menu = await menuDe('Taller de crónica');
    expect(within(menu).getByText('Historial')).not.toBeNull();
  });
});

describe('la fila de la ciudad que cargó otra cuenta se mira y no se toca — B-919', () => {
  /**
   * Una actividad **de su ciudad** que cargó otra cuenta: la regla le da `read` y
   * rechaza el `update` y el `delete` («era modo lectura los otros que no son de
   * ella», el dueño). Llega al listado por la segunda consulta.
   */
  const ajenaDeSuCiudad = () =>
    acto({ id: 'ajena', titulo: 'Club ajeno', createdBy: UID_OTRA, updatedBy: UID_OTRA });

  it('dice «Ver» y no «Editar», y no tiene menú de acciones', async () => {
    /*
     * **Las cuatro acciones del menú o escriben o ya estaban cerradas**: marcar
     * cupo y borrar son escrituras que la regla rechaza, historial es de admin y
     * duplicar abre el camino de creación sobre contenido que no es suyo. Un
     * botón que existe y siempre falla es peor que no tenerlo — es el argumento
     * entero de `rolDelPanel.ts`.
     *
     * MUTACIÓN PROBADA: cambiar `esSoloLectura` por `rol !== 'admin' &&
     * autoriaDe(…) === 'ajena'` **no** alcanza para poner esto en rojo (acá la
     * autoría ES ajena); lo que sí lo pone en rojo es sacarle el `!soloLectura &&`
     * al `<MenuAcciones>` de `ListaActividades.tsx`, o volver el texto del botón a
     * `'Editar'` fijo. El caso de abajo cubre la otra mitad.
     */
    vi.mocked(listarActividades).mockResolvedValue([ajenaDeSuCiudad()]);
    await montar('publicador', 'mar-del-plata');

    expect(screen.getByRole('button', { name: 'Ver' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Más acciones de Club ajeno' })).toBeNull();
    // Y lo dice, además de no ofrecerlo: la fila tiene que **verse** distinta.
    expect(screen.getByText('Solo lectura')).not.toBeNull();
  });

  it('y la suya sigue teniendo «Editar» y el menú entero', async () => {
    /*
     * **El control positivo, y sin él lo de arriba pasa con la pantalla tapiada.**
     * Un `soloLectura` que devolviera siempre `true` deja el caso anterior en
     * verde: es exactamente lo que B-894 destapó —lo que se apaga primero es lo
     * que OTORGA— y por eso las dos mitades van juntas.
     */
    vi.mocked(listarActividades).mockResolvedValue([acto()]);
    await montar('publicador', 'mar-del-plata');

    expect(screen.getByRole('button', { name: 'Editar' })).not.toBeNull();
    expect(screen.queryByText('Solo lectura')).toBeNull();
    const menu = await menuDe('Taller de crónica');
    expect(within(menu).getByText('Borrar')).not.toBeNull();
  });

  it('para un admin nada es de solo lectura, aunque la haya cargado otro', async () => {
    /*
     * La otra mitad del control positivo, del lado del rol: `esSoloLectura` mira
     * el rol **primero**. Sin este caso, un `esSoloLectura` que se olvidara del
     * `rol !== 'admin'` dejaría al admin sin poder borrar lo que cargó la otra
     * cuenta y los dos casos de arriba seguirían verdes.
     */
    vi.mocked(listarActividades).mockResolvedValue([ajenaDeSuCiudad()]);
    await montar('admin');

    expect(screen.getByRole('button', { name: 'Editar' })).not.toBeNull();
    expect(screen.queryByText('Solo lectura')).toBeNull();
  });
});

describe('la marca de autoría dice el mail de quien la tocó — B-888', () => {
  it('con el directorio cargado, nombra la cuenta', async () => {
    /*
     * B-130 preguntaba «¿esto lo cargué yo?» y contestaba «La cargó otra cuenta»
     * porque no había con qué decir cuál. Con `/usuarios` (D-650) sí hay, y el
     * mail no envejece: cada cuenta lo refresca al entrar.
     *
     * MUTACIÓN PROBADA: volver `marcaDeAutoria` a `ETIQUETA_AUTORIA[autoriaDe(…)]`
     * deja este caso en rojo y el de abajo en verde.
     */
    vi.mocked(listarActividades).mockResolvedValue([acto({ createdBy: UID_OTRA })]);
    vi.mocked(listarUsuarios).mockResolvedValue([
      { uid: UID_OTRA, email: 'otra@ejemplo.test', actualizadoEn: null },
    ]);
    await montar('admin');
    expect(await screen.findByText('La cargó otra@ejemplo.test')).not.toBeNull();
  });

  it('sin el directorio dice lo mismo que decía antes de B-888', async () => {
    /*
     * El default que preserva lo anterior (§"Un campo nuevo se lee con el default
     * que preserva lo anterior"): la colección arranca **vacía** y se llena a
     * medida que cada cuenta entra, así que durante un rato el panel no tiene
     * ningún mail. Ahí la marca vuelve al artículo indefinido de B-130, que es lo
     * que no envejece con la cantidad de cuentas.
     */
    vi.mocked(listarActividades).mockResolvedValue([acto({ createdBy: UID_OTRA })]);
    vi.mocked(listarUsuarios).mockResolvedValue([]);
    await montar('admin');
    expect(await screen.findByText('La cargó otra cuenta')).not.toBeNull();
  });

  it('lo propio y sin tocar por nadie sigue sin marca', async () => {
    // Si todo llevara marca, la marca dejaría de avisar.
    await montar('admin');
    expect(screen.queryByText(/^La (cargó|cambió)/)).toBeNull();
  });

  it('pero lo propio que tocó otro sí la lleva, que es el dato nuevo', async () => {
    /*
     * El §12 guardaba `updatedBy` desde siempre y el listado no lo miraba. Es la
     * otra mitad del pedido del dueño: «el mail de quien lo cambió».
     *
     * MUTACIÓN PROBADA: sacarle a `marcaDeAutoria` la rama de `updatedBy` deja
     * este caso en rojo y los tres de arriba en verde.
     */
    vi.mocked(listarActividades).mockResolvedValue([acto({ updatedBy: UID_OTRA })]);
    vi.mocked(listarUsuarios).mockResolvedValue([
      { uid: UID_OTRA, email: 'otra@ejemplo.test', actualizadoEn: null },
    ]);
    await montar('admin');
    expect(await screen.findByText('La cambió otra@ejemplo.test')).not.toBeNull();
  });
});
