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
import { ListaActividades } from '@/components/admin/ListaActividades';

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

const montar = async (rol: 'admin' | 'publicador') => {
  render(<ListaActividades {...props} rol={rol} />);
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
    expect(vi.mocked(listarActividades)).toHaveBeenCalledWith('publicador', UID_PROPIO);
  });

  it('y un admin sigue pidiendo el catálogo entero', async () => {
    // Control positivo: sin esto, un `listarActividades` que siempre acotara
    // también pasaría el caso de arriba.
    await montar('admin');
    expect(vi.mocked(listarActividades)).toHaveBeenCalledWith('admin', UID_PROPIO);
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
