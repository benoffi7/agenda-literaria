/**
 * `ListaActividades` — la grilla de tarjetas, renderizada de verdad (B-620).
 *
 * **Por qué este componente necesita DOM, y qué se deja afuera.** Lo que la
 * tarjeta *dice* ya está cubierto puro y sin DOM en
 * `tests/tarjeta-del-panel.test.ts`, y no se repite acá. Lo que este archivo
 * cuida es la mitad que un test de fuente no puede verificar sin arriesgarse a
 * un falso verde (la lección de B-202): que **ninguna acción se perdió al pasar
 * de fila a tarjeta** y que cada una es de su tarjeta y no de la de al lado.
 *
 * Un `grep` sobre el JSX ve el `<button>Editar</button>` y el `<MenuAcciones>`
 * escritos, y los seguiría viendo si quedaran dentro de una rama que nunca se
 * cumple o si el menú de la tercera tarjeta abriera el de la primera. Eso solo
 * lo dice el DOM.
 *
 * La lista de acciones se **deriva del fuente** en lugar de mantenerse a mano,
 * que es la propiedad 1 de un chequeo de clase (`docs/05-patrones.md`): la
 * acción que se agregue mañana entra sola y tiene que aparecer en pantalla.
 *
 * Vive en `.render.test.tsx` porque `vitest.config.ts` monta jsdom solo para ese
 * patrón (`environmentMatchGlobs`).
 */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actividades', () => ({
  listarActividades: vi.fn(async () => ACTIVIDADES),
  documentoAForm: vi.fn(() => ({})),
  borrarActividad: vi.fn(async () => {}),
  marcarCupoCompleto: vi.fn(async () => {}),
}));
vi.mock('@/lib/analytics', () => ({ medirFuncion: vi.fn() }));
vi.mock('@/components/admin/useOpciones', () => ({
  useLabelsTaxonomia: () => ({
    tipo: { taller: 'Taller', 'club-lectura': 'Club de lectura' },
    barrio: { 'villa-crespo': 'Villa Crespo' },
    arancel: { gratis: 'Gratis', arancelado: 'Arancelado' },
  }),
}));

import { ListaActividades } from '@/components/admin/ListaActividades';
import type { ActividadConId } from '@/types/actividad';

/**
 * Desde la raíz del repo, y **no** con el `new URL(…, import.meta.url)` que usa
 * el resto de la suite: bajo jsdom el `URL` global es el de jsdom y
 * `fileURLToPath` no lo reconoce, así que el path sale en `undefined` y el
 * `readFileSync` falla por un archivo que sí existe. Es la clase de trampa que
 * este entorno agrega y que en `node` no aparece.
 */
const raiz = (rel: string): string => `${process.cwd()}/${rel}`;

/** `Timestamp` de mentira: la tarjeta solo llama a `toDate()`. */
const ts = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) });

const acto = (over: Partial<ActividadConId> & { id: string }): ActividadConId =>
  ({
    titulo: `Actividad ${over.id}`,
    tipo: 'taller',
    estado: 'publicado',
    modalidad: 'presencial',
    modalidades: [{ id: 'mod_1', modalidad: 'presencial', inicio: null, fin: null, sede: null, online: null }],
    sede: null,
    online: null,
    sesiones: [],
    imagenes: [{ id: 'img_1', url: 'https://x/y.jpg', epigrafe: '', origen: 'externa', portada: true }],
    arancel: { tipo: 'gratis', notas: '' },
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    createdBy: 'uid-propio',
    updatedAt: ts('2026-08-01T12:00:00Z'),
    searchText: '',
    ...over,
  }) as unknown as ActividadConId;

/**
 * Tres actividades a propósito, y la del medio es la interesante: lleva todo lo
 * que la tarjeta puede decir de más —las dos marcas, la autoría ajena, el
 * arancel que se paga, la modalidad mixta y el barrio— para que «no se perdió
 * ningún dato» se mida sobre una tarjeta cargada y no sobre la más simple.
 */
const ACTIVIDADES: ActividadConId[] = [
  acto({ id: '1', titulo: 'Taller de crónica breve' }),
  acto({
    id: '2',
    titulo: 'Club de lectura de Saer',
    tipo: 'club-lectura',
    estado: 'publicado',
    imagenes: [],
    arancel: { tipo: 'arancelado', notas: '' },
    createdBy: 'otra-cuenta',
    modalidad: 'hibrido',
    modalidades: [
      { id: 'mod_a', modalidad: 'presencial', inicio: null, fin: null, sede: null, online: null },
      { id: 'mod_b', modalidad: 'virtual', inicio: null, fin: null, sede: null, online: null },
    ],
    sede: {
      nombre: 'Casa Brandon',
      direccion: 'Drago 236',
      barrio: 'villa-crespo',
      ciudad: 'CABA',
      indicaciones: '',
      geo: null,
    },
    inscripcion: { requiere: true, via: null, destino: '', cupo: 8, cierra: null, completo: true },
    sesiones: [
      { id: 'ses_1', inicio: ts('2026-09-10T22:00:00Z'), fin: ts('2026-09-11T00:00:00Z'), tema: null, lectura: null, cancelada: false, calendarEventId: null },
    ],
  } as unknown as Partial<ActividadConId> & { id: string }),
  acto({ id: '3', titulo: 'Charla con la autora', tipo: 'taller', estado: 'borrador' }),
];

const props = {
  onEditar: vi.fn(),
  onNueva: vi.fn(),
  onDuplicar: vi.fn(),
  onHistorial: vi.fn(),
  version: 0,
  uid: 'uid-propio',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Monta y espera a que `listarActividades()` resuelva. */
const montar = async () => {
  render(<ListaActividades {...props} />);
  return await screen.findByRole('list');
};

const tarjetaDe = (titulo: string): HTMLElement => {
  const item = screen.getByText(titulo).closest('li');
  expect(item, `no hay tarjeta para «${titulo}»`).not.toBeNull();
  return item as HTMLElement;
};

describe('la grilla (B-620)', () => {
  it('hay una tarjeta por actividad, y son ítems de una lista', async () => {
    const lista = await montar();
    expect(within(lista).getAllByRole('listitem')).toHaveLength(ACTIVIDADES.length);
  });

  it('la lista abre columnas en escritorio y se queda en una en el teléfono', async () => {
    const lista = await montar();
    // El pedido del frente, medido sobre el DOM y no sobre el fuente: una
    // columna de base, y 2/3/4 de `md`/`xl`/`2xl` en adelante.
    for (const clase of ['grid', 'grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3', '2xl:grid-cols-4']) {
      expect([...lista.classList], clase).toContain(clase);
    }
  });
});

describe('ninguna acción se perdió al pasar de fila a tarjeta (B-620)', () => {
  /**
   * Las etiquetas del menú salen del fuente del componente: mantenerlas a mano
   * acá daría un chequeo que envejece solo, y el punto es que la acción nueva
   * tenga que aparecer en pantalla.
   */
  const accionesDelFuente = (): string[] => {
    const src = readFileSync(raiz('src/components/admin/ListaActividades.tsx'), 'utf8');
    const bloque = /acciones=\{\[([\s\S]*?)\n\s*\]\}/.exec(src);
    expect(bloque?.[1], 'se renombró el prop `acciones` de MenuAcciones').toBeTruthy();
    return [...bloque![1]!.matchAll(/label:\s*\n?\s*(?:'([^']+)'|[\s\S]*?\?\s*'([^']+)')/g)].map(
      (m) => (m[1] ?? m[2])!,
    );
  };

  it('cada tarjeta tiene su «Editar» y su menú «⋯»', async () => {
    await montar();
    for (const a of ACTIVIDADES) {
      const tarjeta = tarjetaDe(a.titulo);
      expect(within(tarjeta).getByRole('button', { name: 'Editar' })).not.toBeNull();
      expect(
        within(tarjeta).getByRole('button', { name: `Más acciones de ${a.titulo}` }),
      ).not.toBeNull();
    }
  });

  it('«Editar» abre la actividad de SU tarjeta', async () => {
    await montar();
    await userEvent.click(
      within(tarjetaDe('Club de lectura de Saer')).getByRole('button', { name: 'Editar' }),
    );
    expect(props.onEditar).toHaveBeenCalledTimes(1);
    expect(props.onEditar.mock.calls[0]![0]).toMatchObject({ id: '2' });
  });

  it('el menú de una tarjeta ofrece las cuatro acciones, y ninguna de otra tarjeta', async () => {
    await montar();
    const tarjeta = tarjetaDe('Club de lectura de Saer');
    await userEvent.click(
      within(tarjeta).getByRole('button', { name: 'Más acciones de Club de lectura de Saer' }),
    );

    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem').map((b) => b.textContent);
    // Las cuatro que traía la fila. `Marcar cupo…` viene en la variante que
    // corresponde: esta actividad está marcada como completa.
    expect(items).toEqual(['Marcar cupo disponible', 'Duplicar', 'Historial', 'Borrar']);
    // Y hay UN solo menú abierto: el de esta tarjeta.
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(tarjeta.contains(menu)).toBe(true);

    // La lista derivada del fuente tiene que estar cubierta por lo que se ve.
    // Se afirma primero que **encontró algo**: un regex que dejó de matchear
    // devolvería `[]` y el `for` de abajo pasaría sin mirar nada, que es la
    // cobertura falsa que un chequeo de clase no puede permitirse.
    const delFuente = accionesDelFuente();
    expect(delFuente.length, 'el regex dejó de encontrar las acciones').toBeGreaterThanOrEqual(4);
    for (const label of delFuente) {
      if (label.startsWith('Marcar cupo')) continue; // las dos caras del mismo ítem
      expect(items, `la tarjeta no ofrece «${label}»`).toContain(label);
    }
  });

  it('«Historial» avisa con la actividad de esa tarjeta', async () => {
    await montar();
    await userEvent.click(
      within(tarjetaDe('Charla con la autora')).getByRole('button', {
        name: 'Más acciones de Charla con la autora',
      }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Historial' }));
    expect(props.onHistorial.mock.calls[0]![0]).toMatchObject({ id: '3' });
  });
});

describe('ningún dato de la fila se perdió, y hay dos más (B-620)', () => {
  it('la tarjeta cargada dice todo lo que la fila decía', async () => {
    await montar();
    const tarjeta = tarjetaDe('Club de lectura de Saer');
    const texto = tarjeta.textContent ?? '';
    // Estado, tipo, cantidad de encuentros, barrio, próximo encuentro, las dos
    // marcas y la autoría: lo que la fila mostraba, ítem por ítem.
    for (const dato of [
      'Publicado',
      'Club de lectura',
      '1 encuentro',
      'Villa Crespo',
      'Próximo:',
      'Cupo completo',
      'Sin flyer',
      'La cargó otra cuenta',
    ]) {
      expect(texto, dato).toContain(dato);
    }
  });

  it('y suma la modalidad y el arancel, que estaban en los filtros y no en el resultado', async () => {
    await montar();
    const texto = tarjetaDe('Club de lectura de Saer').textContent ?? '';
    expect(texto).toContain('Presencial y virtual');
    expect(texto).toContain('Arancelado');
  });

  it('lo propio no lleva marca de autoría: si todo la llevara, dejaría de avisar', async () => {
    await montar();
    expect(tarjetaDe('Taller de crónica breve').textContent).not.toContain('La cargó otra cuenta');
  });

  it('un borrador sin encuentros lo dice, en lugar de dejar el renglón vacío', async () => {
    await montar();
    const texto = tarjetaDe('Charla con la autora').textContent ?? '';
    expect(texto).toContain('Borrador');
    expect(texto).toContain('Sin encuentros por venir');
  });
});

describe('accesibilidad de la tarjeta (B-620)', () => {
  it('todo lo que se toca es un botón, no un `div` con `onClick`', async () => {
    const lista = await montar();
    // Un `div`/`span` con handler no aparece como `button` para el lector de
    // pantalla ni se alcanza con Tab. La forma de medirlo sin leer el fuente es
    // que dentro de la tarjeta no haya nada clickeable que no sea un control.
    for (const nodo of lista.querySelectorAll('div, span, p, li')) {
      expect(nodo.getAttribute('role'), nodo.tagName).not.toBe('button');
    }
  });

  it('se llega a los dos controles de cada tarjeta con el teclado, y en ese orden', async () => {
    await montar();
    const tarjeta = tarjetaDe('Taller de crónica breve');
    const editar = within(tarjeta).getByRole('button', { name: 'Editar' });
    const mas = within(tarjeta).getByRole('button', { name: 'Más acciones de Taller de crónica breve' });

    editar.focus();
    expect(document.activeElement).toBe(editar);
    await userEvent.tab();
    // «Editar» primero y el «⋯» después, como en la fila: la acción principal
    // no puede quedar detrás del menú en el recorrido del teclado.
    expect(document.activeElement).toBe(mas);
  });
});
