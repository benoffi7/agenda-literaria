/**
 * Salida 11: las páginas de organizador (roadmap 1.5, B-2172 paso 4).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import {
  paginaDeOrganizador,
  paginasDeOrganizador,
  type PaginaDeOrganizador,
} from '@/lib/organizadorPublico';
import { CENTINELA, actividadCentinela, opcionCentinela } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';

describe('barrido de las páginas de organizador (§5, salida 11, B-2172)', () => {
  /*
   * **Una página indexada por organizador**, `/organiza/{slug}`, y una sola
   * productora: `src/lib/organizadorPublico.ts`. Va con los hubs (salida 11)
   * porque es la misma clase de página —una lista con título y `meta description`
   * armados interpolando— aunque no sea un hub del filtro.
   *
   * Lo nuevo son las frases, y dos interpolan: el **nombre del organizador**
   * (título, descripción, bajada, aviso) y hasta **tres títulos** de actividades
   * (descripción). Lo que este barrido fija es que sean solo esos dos: ni la
   * descripción, ni el Instagram o la web del organizador, ni quien da la
   * actividad. Y que el slug vaya en la ruta y no en el texto (trampa 10).
   *
   * MUTACIÓN PROBADA: cambiar `e.titulo` por `e.searchText` en `frases` hace
   * fallar el primer caso nombrando el centinela de `descripcion`.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  const entradas = ['act_org_1', 'act_org_2', 'act_org_3'].map((id) =>
    entradaDeIndice(toPublic(actividadCentinela(), id)),
  );

  const texto = (p: PaginaDeOrganizador): string =>
    [p.titulo, p.descripcion, p.bajada, p.avisoSinProximas, p.nombre].join(' | ');

  const EL_NOMBRE: Excepcion = {
    nombre: 'el nombre del organizador',
    centinelas: ['organizador.nombre'],
    porque:
      'Es de lo que trata la página, y ya es público en el detalle de cada actividad ' +
      '(«Organiza») y en el índice. Sale de la entrada, no de la lista privada de ' +
      '`/opciones/organizador`.',
  };
  const LOS_TITULOS: Excepcion = {
    nombre: 'los títulos de las tres primeras actividades',
    centinelas: ['titulo'],
    porque:
      '§5.1 — el mismo corte que la `meta description` de los hubs. El título ya es ' +
      'público en el listado y en el detalle.',
  };

  it('el fixture hace existir la página, con las tres actividades por venir', () => {
    const p = paginaDeOrganizador(CENTINELA['organizador.slug'], entradas, AHORA);
    expect(p, 'la página no se generó y el barrido no mira nada').not.toBeNull();
    expect(p!.proximas).toHaveLength(3);
  });

  it('en las frases sobreviven solo el nombre del organizador y los títulos', () => {
    const p = paginaDeOrganizador(CENTINELA['organizador.slug'], entradas, AHORA)!;
    barrer('página de organizador', texto(p), [EL_NOMBRE, LOS_TITULOS], { insensible: true });
  });

  it('con nada por venir tampoco cambia lo que sale, salvo los títulos', () => {
    const DESPUES = new Date('2030-01-01T00:00:00Z');
    const p = paginaDeOrganizador(CENTINELA['organizador.slug'], entradas, DESPUES)!;
    expect(p.proximas).toEqual([]);
    barrer('página de organizador (sin próximas)', texto(p), [EL_NOMBRE], { insensible: true });
  });

  it('ningún dato de /opciones/organizador llega a la página (la lista es privada)', () => {
    /*
     * La lista entra por `paginasDeOrganizador` y solo decide **qué slugs** tienen
     * página. Con una opción llena de centinelas —su `label` distinto del nombre
     * guardado, su `huellaCreador`— y una pendiente de otra persona, nada de eso
     * puede aparecer en lo que se serializa. Lo pidió el `auditor-privacidad`: el
     * día que alguien tome `o.label` para el título, este caso lo dice.
     *
     * MUTACIÓN PROBADA: usar `o.label` como `nombre` pone esto en rojo nombrando
     * `opcion.label`.
     */
    const opciones = [
      opcionCentinela({ slug: CENTINELA['organizador.slug'] }),
      opcionCentinela({ slug: 'pendiente-de-otra', aprobada: false }),
    ];
    const paginas = paginasDeOrganizador(entradas, opciones, AHORA);
    expect(paginas.map((p) => p.slug)).toEqual([CENTINELA['organizador.slug']]);
    const serializado = JSON.stringify(
      paginas.map((p) => ({ ...p, proximas: [], pasadas: [] })),
    );
    barrer('página de organizador (con la lista)', serializado, [EL_NOMBRE, LOS_TITULOS, {
      nombre: 'el slug, en `slug` y en la ruta',
      centinelas: ['organizador.slug'],
      porque: 'Es la URL de la página (trampa 10); en el texto no aparece (caso de abajo).',
    }], { insensible: true });
  });

  it('y el slug va en la ruta, no en el texto (trampa 10)', () => {
    const p = paginaDeOrganizador(CENTINELA['organizador.slug'], entradas, AHORA)!;
    expect(p.ruta).toContain(CENTINELA['organizador.slug']);
    expect(texto(p).toLowerCase()).not.toContain(CENTINELA['organizador.slug'].toLowerCase());
  });
});
