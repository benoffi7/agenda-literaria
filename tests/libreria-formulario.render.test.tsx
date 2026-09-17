import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LibreriaFormulario } from '@/components/admin/LibreriaFormulario';

/**
 * El formulario de una librería, renderizado de verdad — B-901.
 *
 * ── Por qué este necesita DOM ─────────────────────────────────────────────
 * Porque lo que se verifica acá son **dos carteles**, y un cartel es exactamente
 * lo que un test que lee el fuente no sabe si llegó a la pantalla: el texto puede
 * estar escrito en el archivo y quedar dentro de una rama que no se pinta, o
 * colgado de un campo que no se monta. Es la lección de B-202, y la razón por la
 * que la excepción de `*.render.test.tsx` existe.
 *
 * Los dos carteles dicen **cosas opuestas sobre datos** y los dos importan:
 *
 * 1. **«Este número se publica en el sitio»**, arriba del WhatsApp. Es el
 *    criterio de aceptación 4 del PRD 2, escrito con esas palabras, y el §5.1 del
 *    `CLAUDE.md` explica por qué: un número personal publicado queda expuesto a
 *    bots. Acá lo carga el dueño sobre el número **de otra persona**, así que
 *    decirlo importa igual o más que en el formulario público.
 * 2. **«Interno — no se publica»**, sobre el `contactoDeQuienCargo`. Es el
 *    segundo dato personal de un tercero que guarda el proyecto, y quien lo tipea
 *    tiene que saber que no sale.
 *
 * Sin mocks de Firestore: el formulario no lee nada al montarse. Lo único que se
 * mockea es `campos-del-panel`, que sí lee `/opciones/*` con el SDK — y que no es
 * lo que este archivo verifica.
 */
vi.mock('@/components/admin/campos-del-panel', () => ({
  TaxonomiaSelect: ({ id, value }: { id: string; value: string }) => (
    <input id={id} defaultValue={value} readOnly />
  ),
}));

vi.mock('@/lib/analytics', () => ({ medirFuncion: vi.fn() }));

afterEach(cleanup);

const montar = (over: Partial<Parameters<typeof LibreriaFormulario>[0]> = {}) =>
  render(
    <LibreriaFormulario
      uid="uid-de-prueba"
      onGuardado={vi.fn()}
      onCancelar={vi.fn()}
      {...over}
    />,
  );

describe('los dos carteles sobre datos, y dicen cosas opuestas', () => {
  it('el WhatsApp avisa que se publica — criterio 4 del PRD', () => {
    /*
     * MUTACIÓN PROBADA: sacarle el `ayuda="Este número se publica en el sitio."`
     * al `<Campo label="WhatsApp">` deja este caso en rojo.
     */
    montar();
    const whatsapp = screen.getByLabelText('WhatsApp');
    expect(whatsapp).toBeTruthy();
    expect(screen.getByText(/este número se publica en el sitio/i)).toBeTruthy();
  });

  it('y el contacto de quien cargó avisa lo contrario: que NO se publica', () => {
    montar();
    expect(screen.getByText(/interno — no se publica/i)).toBeTruthy();
  });

  /**
   * **B-983 — los dos botones, y el texto que dice qué hace cada uno.**
   *
   * Antes había uno solo y un aviso: «Guardar no la publica. Para que entre al
   * sitio hay que publicarla desde la lista de librerías». Lo reportó el dueño —
   * «no se sube automáticamente, lo tengo que validar después de cargar»— y el
   * paso era ceremonia: quien carga desde el panel **es** el revisor.
   *
   * «Guardar sin publicar» se queda porque los estados del directorio no tienen
   * `borrador`: es la única forma de guardar una ficha a medio cargar sin que
   * salga al sitio, y sin ella el arreglo habría sacado una capacidad.
   */
  it('al crear ofrece publicar y no publicar, y dice qué pasa si no', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Guardar y publicar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar sin publicar' })).toBeTruthy();
    expect(screen.getByText(/no se ve en el sitio/i)).toBeTruthy();
  });
});

describe('el link de la ficha se congela al publicar — trampa 10', () => {
  const ficha = (over = {}) => ({
    id: 'lib1',
    nombre: 'Del Otro Lado',
    slug: 'del-otro-lado',
    descripcion: null,
    imagenes: [],
    direccion: 'Thames 1762',
    // B-982 — el horario de atención, texto libre.
    horarios: null,
    barrio: 'villa-crespo',
    provincia: 'caba',
    ciudad: 'caba',
    geo: null,
    instagram: null,
    whatsapp: null,
    web: null,
    mail: null,
    contactoDeQuienCargo: null,
    estado: 'pendiente' as const,
    origen: 'panel' as const,
    searchText: '',
    creadoEn: null as never,
    revision: { porUid: null, en: null, motivo: null },
    ...over,
  });

  /**
   * **B-983 — al editar hay un botón solo, y es a propósito.**
   *
   * `crearLibreria` es lo único que elige el estado; `guardarLibreria` no lo toca
   * —el estado de una ficha que ya existe lo mueve la bandeja, que es donde está
   * el historial de revisión—. Un «Guardar y publicar» acá sería un botón que a
   * veces publica y a veces no: un botón que miente.
   *
   * Sin este caso, poner los dos también al editar pasaría en verde.
   */
  it('al editar no ofrece publicar: eso lo mueve la bandeja', () => {
    montar({ inicial: ficha() });
    expect(screen.queryByRole('button', { name: 'Guardar y publicar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
    expect(screen.getByText(/editar no cambia si está publicada/i)).toBeTruthy();
  });

  it('mientras espera decisión se puede corregir: es el trabajo de la bandeja', () => {
    montar({ inicial: ficha() });
    expect((screen.getByLabelText('Link de la ficha') as HTMLInputElement).disabled).toBe(false);
  });

  it('publicada, el campo se apaga **y se explica por qué**', () => {
    /*
     * Las dos mitades. Un campo deshabilitado **sin motivo** es lo que hace que
     * alguien lo intente cambiar por la consola de Firebase, que es justo donde la
     * UI no puede impedir nada.
     *
     * MUTACIÓN PROBADA: cambiar `slugBloqueado(inicial)` por `false` deja el
     * primer aserto en rojo; borrar la rama del `ayuda` deja el segundo.
     */
    montar({ inicial: ficha({ estado: 'publicado' }) });
    expect((screen.getByLabelText('Link de la ficha') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/fija desde que se publicó/i)).toBeTruthy();
  });

  it('y una que se despublicó sigue congelada — B-285, la puerta de atrás', () => {
    // `publicadaAlgunaVez` gana sobre el estado actual: una ficha que se publicó y
    // se bajó del sitio tiene su URL en Google igual.
    montar({ inicial: ficha({ estado: 'pendiente', publicadaAlgunaVez: true }) });
    expect((screen.getByLabelText('Link de la ficha') as HTMLInputElement).disabled).toBe(true);
  });
});
