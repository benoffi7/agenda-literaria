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
import { derivadosDesalineados, sedePrincipal } from '../functions/derivados.js';
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
  const s = sedePrincipal(modalidades);
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

  /*
   * La forma de la copia: `filas.find((m) => m.sede)` / `m?.online`. La
   * implementación es `sedePrincipal` y `onlinePrincipal` de
   * `functions/derivados.js`; quien la necesite la importa.
   */
  const copia = /\.find\(\(?\w+\)?\s*=>\s*\w+\??\.(sede|online)\)/;

  /** Los `.mjs`/`.js`/`.ts`/`.tsx` de un directorio, recursivo, sin `node_modules`. */
  const archivosDe = (dir: string): string[] =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => !f.split(/[\\/]/).includes('node_modules'))
      .filter((f) => /\.(mjs|js|ts|tsx)$/.test(f))
      .map((f) => `${dir}/${f.replaceAll('\\', '/')}`);

  it('ningún script de `scripts/` deriva la sede o el online con un `.find` propio', () => {
    /*
     * MUTACIÓN PROBADA: devolver a `reubicar-barrios.mjs` su
     * `const sede = nuevas.find((m) => m.sede)?.sede ?? null;` deja este caso en
     * rojo nombrando el archivo.
     */
    const archivos = archivosDe('scripts');
    expect(archivos.length).toBeGreaterThan(20);
    const culpables = archivos.filter((f) => copia.test(fuente(f)));
    expect(culpables).toEqual([]);
    // Control positivo: el patrón reconoce la implementación de verdad.
    expect(copia.test(readFileSync('functions/derivados.js', 'utf8'))).toBe(true);
  });

  /**
   * **Los tests tampoco — B-2140.** Un fixture que arma la sede, el online o la
   * modalidad con su propia regla sigue armando documentos «alineados» con la
   * regla vieja cuando la de verdad cambia, y los tests pasan sobre una forma que
   * el panel ya no produce. `tests/fixtures/indice.ts` y
   * `tests/ciudades-del-servidor.test.ts` lo hacían.
   *
   * Las excepciones son los tests que arman **a propósito** un documento con la
   * derivación de otra regla, como control de que la comparación mide algo. Cada
   * una lleva su motivo; una excepción que ya no tiene la copia se cae sola (el
   * último `expect`), así la lista no junta entradas muertas.
   *
   * MUTACIÓN PROBADA: devolverle a `tests/fixtures/indice.ts` su
   * `modalidades.find((m) => m.sede)?.sede ?? null` deja este caso en rojo
   * nombrando el archivo.
   */
  const EXCEPCIONES_EN_TESTS: Readonly<Record<string, string>> = {
    'tests/sembrar-geografia.test.ts':
      'el `payloadViejo` de reubicar-barrios reproduce el payload de antes de B-2090 como control positivo, y este archivo nombra la forma de la copia',
  };

  it('ningún test de `tests/` deriva la sede o el online con un `.find` propio', () => {
    const archivos = archivosDe('tests');
    expect(archivos.length).toBeGreaterThan(100);
    const culpables = archivos
      .filter((f) => !(f in EXCEPCIONES_EN_TESTS))
      .filter((f) => copia.test(fuente(f)));
    expect(culpables).toEqual([]);
    for (const [rel, motivo] of Object.entries(EXCEPCIONES_EN_TESTS)) {
      expect(motivo.length, rel).toBeGreaterThan(20);
      expect(copia.test(fuente(rel)), `${rel} ya no tiene la copia: sacala de las excepciones`).toBe(true);
    }
  });

  it('ningún test de `tests/` arma la modalidad resultante con su propia unión', () => {
    /*
     * La otra mitad de la copia de `tests/fixtures/indice.ts`: un `Set` de las
     * modalidades de las filas con su `has('hibrido')`. La regla es
     * `modalidadResultante`.
     *
     * MUTACIÓN PROBADA: devolverle al fixture su
     * `new Set(modalidades.map((m) => m.modalidad))` deja este caso en rojo.
     */
    const union = /new Set\(\s*\w+\??\.map\(\(?\w+\)?\s*=>\s*\w+\??\.modalidad\)/;
    const culpables = archivosDe('tests').filter((f) => union.test(fuente(f)));
    expect(culpables).toEqual([]);
  });
});
