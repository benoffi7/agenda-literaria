/**
 * `HistorialActividad` renderizado de verdad — B-40.
 *
 * **Por qué este componente necesita DOM.** El resto del camino de restauración
 * ya está probado puro (`tests/historial-restaurar.test.ts`, sobre
 * `camposRestaurables`/`valorARestaurar`/`payloadDeRestauracion`) y por eso
 * este archivo no lo repite. Lo que falta de cubrir es el cableado que solo
 * existe en el DOM: que el botón «Restaurar» pida confirmación con
 * `window.confirm` **antes** de escribir, y que un cancelar de verdad frene la
 * escritura — no solo que exista un `if (!confirm(...)) return` en el fuente
 * (la misma familia de lección que `menu-acciones.render.test.tsx`, B-202: un
 * `toContain` sobre el texto pasa aunque la condición esté invertida).
 *
 * `listarVersiones` y `restaurarCampo` van mockeados —son I/O contra
 * Firestore—; `camposRestaurables`, `valorARestaurar` y `resumenDeCampo` se
 * usan **reales** vía `importActual`: son puros y ya tienen su propia
 * cobertura, así que reimplementar acá qué campos ofrece sería la tercera
 * copia de esa lógica, no una prueba de la pantalla.
 *
 * `@/lib/analytics` va mockeado por lo mismo que en
 * `estadisticas-pestanias.render.test.tsx`: `Seccion` (el acordeón colapsable)
 * lo importa para medir aperturas, y ese módulo arrastra `firebase-client` —
 * nada que este archivo necesite ejercitar.
 */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActividadConId } from '@/types/actividad';

vi.mock('@/lib/analytics', () => ({
  medirSeccion: vi.fn(),
}));

vi.mock('@/lib/actividades', () => ({
  leerActividad: vi.fn(),
}));

vi.mock('@/lib/historial', async () => {
  const real = await vi.importActual<typeof import('@/lib/historial')>('@/lib/historial');
  return {
    ...real,
    listarVersiones: vi.fn(),
    restaurarCampo: vi.fn(),
  };
});

import { leerActividad } from '@/lib/actividades';
import { HistorialActividad } from '@/components/admin/HistorialActividad';
import { listarVersiones, restaurarCampo, type VersionConId } from '@/lib/historial';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(listarVersiones).mockReset();
  vi.mocked(leerActividad).mockReset();
  vi.mocked(restaurarCampo).mockReset();
});

const actividad = (over: Partial<ActividadConId> = {}): ActividadConId =>
  ({
    id: 'act-1',
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    descripcion: 'la descripción de hoy',
    imagenes: [],
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [],
    modalidad: 'presencial',
    sede: null,
    online: null,
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'borrador',
    tags: [],
    destacado: false,
    searchText: '',
    ...over,
  }) as unknown as ActividadConId;

const version = (): VersionConId =>
  ({
    id: '2026-08-24T19-30-00-000Z_ev1',
    guardadoEn: { toDate: () => new Date('2026-08-24T19:30:00-03:00') },
    actualizadoPor: 'uid-a',
    camposCambiados: ['descripcion'],
    borrado: false,
    documento: { ...actividad(), descripcion: 'lo que decía antes' },
  }) as unknown as VersionConId;

const montar = async () => {
  vi.mocked(listarVersiones).mockResolvedValue([version()]);
  vi.mocked(leerActividad).mockResolvedValue(actividad());
  const onRestaurado = vi.fn();
  render(<HistorialActividad actividad={actividad()} uid="uid-b" onRestaurado={onRestaurado} />);
  // La sección con la fecha de la versión recién aparece cuando resuelve la
  // carga (`listarVersiones` + `leerActividad` en paralelo).
  await screen.findByText(/24 de agosto/);
  return { onRestaurado };
};

/** Abre el acordeón de la versión y devuelve el botón «Restaurar». */
const abrirYBuscarBoton = async () => {
  const encabezado = screen.getByRole('button', { name: /24 de agosto/ });
  await userEvent.click(encabezado);
  return screen.findByRole('button', { name: 'Restaurar' });
};

describe('HistorialActividad — lista lo que hay para restaurar (B-40)', () => {
  it('sin versiones guardadas, lo dice y no hay nada para abrir', async () => {
    vi.mocked(listarVersiones).mockResolvedValue([]);
    vi.mocked(leerActividad).mockResolvedValue(actividad());
    render(<HistorialActividad actividad={actividad()} uid="uid-b" onRestaurado={vi.fn()} />);
    await screen.findByText(/Todavía no hay versiones guardadas/);
    expect(screen.queryByRole('button', { name: 'Restaurar' })).toBeNull();
  });

  it('la sección de una versión arranca cerrada y el botón aparece al abrirla', async () => {
    await montar();
    // Colapsada por default (`abiertaPorDefecto={false}`): el botón no está
    // en el DOM hasta que se abre el acordeón.
    expect(screen.queryByRole('button', { name: 'Restaurar' })).toBeNull();
    const boton = await abrirYBuscarBoton();
    expect(boton).not.toBeNull();
  });
});

describe('HistorialActividad — Restaurar pide confirmación de verdad (B-40)', () => {
  it('cancelar el confirm NO escribe nada — control negativo', async () => {
    const { onRestaurado } = await montar();
    const boton = await abrirYBuscarBoton();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(boton);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Es el control negativo que evita el falso verde de B-202: si el
    // `if (!confirm(...))` estuviera invertido o ausente, esta aserción es
    // la única que lo detecta.
    expect(restaurarCampo).not.toHaveBeenCalled();
    expect(onRestaurado).not.toHaveBeenCalled();
  });

  it('confirmar restaura el campo y avisa al padre para refrescar', async () => {
    const { onRestaurado } = await montar();
    const boton = await abrirYBuscarBoton();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(restaurarCampo).mockResolvedValue(undefined);

    await userEvent.click(boton);

    await waitFor(() => expect(restaurarCampo).toHaveBeenCalledTimes(1));
    const llamada = vi.mocked(restaurarCampo).mock.calls[0]!;
    expect(llamada[1]).toBe('descripcion'); // el campo que se restauró
    expect(llamada[3]).toBe('uid-b'); // quién restauró, no quién cargó la versión vieja
    expect(onRestaurado).toHaveBeenCalledTimes(1);
  });
});

describe('HistorialActividad — trampa 10, la dirección web sobre una actividad publicada (B-40)', () => {
  /**
   * `camposRestaurables` ya filtra `slug` para `estado === 'publicado'`
   * (`tests/historial-restaurar.test.ts`). Lo que ese test no puede ver es si
   * la PANTALLA respeta el filtro: un `HistorialActividad.tsx` que ignorara
   * `camposRestaurables` y armara la lista a mano mostraría el botón igual.
   */
  it('el banner avisa y «Dirección web» no aparece entre lo restaurable', async () => {
    const publicada = actividad({ estado: 'publicado' });
    const conSlugViejo: VersionConId = {
      ...version(),
      camposCambiados: ['slug', 'descripcion'],
      documento: { ...publicada, slug: 'direccion-vieja', descripcion: 'lo que decía antes' },
    } as unknown as VersionConId;

    vi.mocked(listarVersiones).mockResolvedValue([conSlugViejo]);
    vi.mocked(leerActividad).mockResolvedValue(publicada);
    render(<HistorialActividad actividad={publicada} uid="uid-b" onRestaurado={vi.fn()} />);

    await screen.findByText(/La dirección web no se puede restaurar/);

    const encabezado = await screen.findByRole('button', { name: /24 de agosto/ });
    await userEvent.click(encabezado);

    // Control positivo primero: si esto no aparece, la sección no se abrió y
    // el `queryByText` de abajo pasaría por la razón equivocada.
    await screen.findByText('Descripción');
    expect(screen.queryByText('Dirección web')).toBeNull();
  });
});

describe('todo campo del modelo tiene nombre de pantalla en el historial (B-181)', () => {
  /**
   * **Un chequeo de clase, no de este campo.** El diccionario
   * `NOMBRE_DE_CAMPO` de `HistorialActividad.tsx` es una lista escrita a mano al
   * lado de un modelo que crece: cada campo nuevo que nadie agregue ahí se
   * muestra con su **clave cruda** en la pantalla de restaurar. No falla nada, no
   * lo ve ningún test, y el que lo ve es el que está tratando de recuperar una
   * descripción que pisó.
   *
   * Se lee la fuente y no el módulo por lo mismo que
   * `tests/pagina-de-detalle.test.ts`: lo que se afirma es una propiedad de lo
   * que el archivo **nombra**, y el diccionario no se exporta.
   *
   * MUTACIÓN PROBADA: sacando la entrada `comisiones` del diccionario, este caso
   * falla nombrándola.
   */
  const CAMPOS_SIN_NOMBRE: readonly string[] = [
    // Los de auditoría: el historial no los ofrece para restaurar (D-41), así
    // que no tienen por qué tener nombre de pantalla.
    'createdAt',
    'updatedAt',
    'createdBy',
    'updatedBy',
    // Campos de máquina: los escribe un trigger, no el formulario.
    'publicadaAlgunaVez',
  ];

  it('ningún campo de `Actividad` se mostraría con la clave cruda', () => {
    const fuente = readFileSync('src/components/admin/HistorialActividad.tsx', 'utf8');
    const modelo = readFileSync('src/types/actividad.ts', 'utf8');

    // Los campos de primer nivel de `Actividad`, leídos del bloque de la
    // interfaz: es la lista que crece cuando alguien agrega un campo.
    const bloque = modelo.slice(modelo.indexOf('export interface Actividad {'));
    const cuerpo = bloque.slice(0, bloque.indexOf('\n}'));
    const campos = [...cuerpo.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);

    const sinNombre = campos.filter(
      (c) => !CAMPOS_SIN_NOMBRE.includes(c) && !new RegExp(`^ {2}${c}: '`, 'm').test(fuente),
    );
    expect(
      sinNombre,
      `estos campos del modelo se mostrarían con su clave cruda en el historial: ` +
        `${sinNombre.join(', ')}. Agregalos a NOMBRE_DE_CAMPO en ` +
        `HistorialActividad.tsx, o a CAMPOS_SIN_NOMBRE de este test si el ` +
        `historial no los ofrece.`,
    ).toEqual([]);
  });
});
