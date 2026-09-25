/**
 * **Los backfills de la geografía escriben lo mismo que el panel** — B-950,
 * B-976, B-2090.
 *
 * `scripts/sembrar-geografia.mjs` y `scripts/reubicar-barrios.mjs` reescriben
 * `modalidades` y, con ellas, los derivados que el documento guarda. Hasta B-2090
 * cada uno derivaba la sede con su propio `modalidades.find((m) => m.sede)` y no
 * reescribía el `searchText`: el script de barrios vaciaba el barrio y el índice
 * seguía nombrándolo, así que `syncCalendar` —que desde B-2050 recalcula los
 * derivados— habría corregido y mandado `derivados-no-coinciden` por cada
 * actividad tocada. Es la clase de B-88: el productor y un consumidor derivando
 * por separado.
 *
 * Lo que se ata acá es que el payload sale de **las mismas funciones** que usa el
 * servidor para verificar (`derivadosDesalineados` da `null` sobre el resultado),
 * y que ningún script vuelva a escribirse la derivación.
 *
 * **Se importan los módulos puros y no los scripts**: los scripts corren en el
 * cuerpo del módulo y un `import()` suyo se conecta a Firestore (ver
 * `tests/sembrar-slugs.test.ts`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { derivadosDesalineados } from '../functions/derivados.js';
import { buildSearchText } from '../functions/busqueda.js';
import { ciudadesDe } from '../functions/ciudades.js';
import { reubicacionDe } from '../src/lib/reubicacion-de-barrio.mjs';
import { escrituraDeModalidades } from '../scripts/escritura-de-modalidades.mjs';
import { modalidadesMigradas } from '../scripts/geografia-a-sembrar.mjs';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const sede = (o: Record<string, unknown> = {}) => ({
  nombre: 'Casa Brandon',
  direccion: 'Luis María Drago 236',
  provincia: '',
  barrio: 'villa-crespo',
  ciudad: 'CABA',
  indicaciones: '',
  geo: null,
  ...o,
});

const fila = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  modalidad: 'presencial',
  sede: sede(o),
  online: null,
});

/** Un documento como lo dejaba el panel antes de la migración: alineado con sus filas. */
const documentoGuardado = (modalidades: ReturnType<typeof fila>[]) => {
  const s = modalidades.find((m) => m.sede)?.sede ?? null;
  return {
    titulo: 'Taller de la llanura',
    descripcion: 'Escritura del paisaje',
    organizador: { nombre: 'La Grieta' },
    tallerista: null,
    libro: null,
    estado: 'publicado',
    modalidades,
    modalidad: 'presencial',
    sede: s,
    online: null,
    searchText: buildSearchText({
      titulo: 'Taller de la llanura',
      descripcion: 'Escritura del paisaje',
      organizador: { nombre: 'La Grieta' },
      modalidades,
      sede: s,
    }),
    ciudades: ciudadesDe(modalidades),
  };
};

describe('`modalidadesMigradas` — qué sede normaliza sembrar-geografia', () => {
  it('normaliza la ciudad tipeada y deduce CABA, sin tocar el resto de la sede', () => {
    const nuevas = modalidadesMigradas([fila('mod_1')]);
    expect(nuevas?.[0].sede).toEqual(sede({ provincia: 'caba', ciudad: 'caba' }));
  });

  it('una lista ya migrada devuelve `null`: la segunda corrida no escribe', () => {
    expect(modalidadesMigradas([fila('mod_1', { provincia: 'caba', ciudad: 'caba' })])).toBeNull();
  });

  it('una sede que se contradice se saltea — B-976', () => {
    const contradictoria = fila('mod_1', { barrio: 'provincia-de-buenos-aires', ciudad: 'CABA' });
    expect(modalidadesMigradas([contradictoria])).toBeNull();
  });
});

describe('`escrituraDeModalidades` — el payload no dispara `derivados-no-coinciden` (B-2090)', () => {
  it('sembrar-geografia: el documento escrito coincide con lo que recalcula el servidor', () => {
    const doc = documentoGuardado([fila('mod_1', { ciudad: 'Mar del Plata', barrio: '' }), fila('mod_2')]);
    const nuevas = modalidadesMigradas(doc.modalidades);
    expect(nuevas).not.toBeNull();
    const escrito = { ...doc, ...escrituraDeModalidades(doc, nuevas!) };
    expect(derivadosDesalineados(escrito)).toBeNull();
    expect(escrito.ciudades).toEqual(['mar-del-plata', 'caba']);
  });

  it('reubicar-barrios: el barrio que era provincia sale también del `searchText`', () => {
    const doc = documentoGuardado([
      fila('mod_1', { barrio: 'provincia-de-buenos-aires', ciudad: 'Tandil' }),
    ]);
    const r = reubicacionDe(doc.modalidades[0].sede);
    expect(r.estado).toBe('reubicar');
    const nuevas = [{ ...doc.modalidades[0], sede: { ...doc.modalidades[0].sede, ...r.geografia } }];

    /*
     * **El bug, con nombre y apellido.** El payload de antes —`{ modalidades,
     * sede, ciudades }`— deja el `searchText` viejo, que sigue diciendo
     * «provincia-de-buenos-aires»: el servidor lo nota. Es el control positivo de
     * que la comparación de abajo mide algo.
     */
    const payloadViejo = {
      modalidades: nuevas,
      sede: nuevas.find((m) => m.sede)?.sede ?? null,
      ciudades: ciudadesDe(nuevas),
    };
    expect(derivadosDesalineados({ ...doc, ...payloadViejo })?.campos).toEqual(['searchText']);

    const escrito = { ...doc, ...escrituraDeModalidades(doc, nuevas) };
    expect(derivadosDesalineados(escrito)).toBeNull();
    expect(escrito.searchText).not.toContain('provincia');
  });

  it('escribe las filas y los cinco derivados, y nada más', () => {
    const doc = documentoGuardado([fila('mod_1')]);
    expect(Object.keys(escrituraDeModalidades(doc, doc.modalidades)).sort()).toEqual(
      ['ciudades', 'modalidad', 'modalidades', 'online', 'searchText', 'sede'],
    );
  });
});

describe('los scripts no se escriben la derivación — la clase de B-88', () => {
  const fuente = (rel: string) => sinComentarios(readFileSync(rel, 'utf8'));

  it('el payload importa los derivados de `functions/`, no los reimplementa', () => {
    const src = fuente('scripts/escritura-de-modalidades.mjs');
    expect(src).toContain("from '../functions/derivados.js'");
    expect(src).toContain("from '../functions/ciudades.js'");
  });

  it('los dos backfills de la geografía escriben con `escrituraDeModalidades`', () => {
    for (const rel of ['scripts/sembrar-geografia.mjs', 'scripts/reubicar-barrios.mjs']) {
      expect(fuente(rel), rel).toContain("from './escritura-de-modalidades.mjs'");
      expect(fuente(rel), rel).toContain('escrituraDeModalidades(d.data(),');
    }
  });

  it('ningún script de `scripts/` deriva la sede o el online con un `.find` propio', () => {
    /*
     * La forma de la copia: `filas.find((m) => m.sede)` / `m?.online`. La
     * implementación es `sedePrincipal` y `onlinePrincipal` de
     * `functions/derivados.js`; un script que la necesite la importa.
     *
     * MUTACIÓN PROBADA: devolver a `reubicar-barrios.mjs` su
     * `const sede = nuevas.find((m) => m.sede)?.sede ?? null;` deja este caso en
     * rojo nombrando el archivo.
     */
    const copia = /\.find\(\(?\w+\)?\s*=>\s*\w+\??\.(sede|online)\)/;
    const archivos = readdirSync('scripts').filter((f) => /\.(mjs|js)$/.test(f));
    expect(archivos.length).toBeGreaterThan(20);
    const culpables = archivos.filter((f) => copia.test(fuente(`scripts/${f}`)));
    expect(culpables).toEqual([]);
    // Control positivo: el patrón reconoce la implementación de verdad.
    expect(copia.test(readFileSync('functions/derivados.js', 'utf8'))).toBe(true);
  });
});
