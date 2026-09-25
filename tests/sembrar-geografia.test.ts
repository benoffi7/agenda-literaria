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
 * y que ningún script, test, componente ni Function vuelva a escribirse la
 * derivación (B-2140, B-2150).
 *
 * **Se importan los módulos puros y no los scripts**: los scripts corren en el
 * cuerpo del módulo y un `import()` suyo se conecta a Firestore (ver
 * `tests/sembrar-slugs.test.ts`).
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('nadie se escribe la derivación — la clase de B-88', () => {
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
   * **Las formas de la copia — B-2140, B-2150.** La implementación es
   * `sedePrincipal` y `onlinePrincipal` de `functions/derivados.js`: «la primera
   * fila que tenga una». Quien la necesite la importa; estas son las maneras de
   * reescribirla que el barrido reconoce, una por nombre para que el rojo diga
   * cuál apareció.
   */
  const FLECHA = String.raw`(?:\(?\w+\)?\s*=>\s*\w+\??\.(?:sede|online)|\(\{\s*(?:sede|online)\s*\}\)\s*=>\s*(?:sede|online))`;
  const FORMAS: Readonly<Record<string, RegExp>> = {
    // `filas.find((m) => m.sede)`, `m?.online`, y la desestructurada `({ sede }) => sede`.
    find: new RegExp(String.raw`\.find\(\s*${FLECHA}\s*\)`),
    // `filas.filter((m) => m.sede)[0]` — la misma regla, con un array de por medio.
    'filter-cero': new RegExp(String.raw`\.filter\(\s*${FLECHA}\s*\)\s*(?:\?\.)?\[0\]`),
    // `filas[0]?.sede` / `modalidades[0]?.sede`: la regla vieja de antes de B-224,
    // «la sede de la primera fila» aunque esa fila sea virtual.
    'primera-fila': /\b(?:filas|modalidades)(?:\?\.)?\[0\]\?\.(?:sede|online)\b/,
  };
  const formasEn = (src: string) => Object.keys(FORMAS).filter((k) => FORMAS[k].test(src));
  const tieneCopia = (src: string) => formasEn(src).length > 0;

  /** Los `.mjs`/`.js`/`.ts`/`.tsx`/`.astro` de un directorio, recursivo, sin entrar a `node_modules`. */
  const archivosDe = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.name === 'node_modules') return [];
      const ruta = `${dir}/${e.name}`;
      if (e.isDirectory()) return archivosDe(ruta);
      return /\.(mjs|js|ts|tsx|astro)$/.test(e.name) ? [ruta] : [];
    });

  /** Los archivos de `dir` —relativos a él— que se escriben la derivación. */
  const culpablesEn = (dir: string, fuera: Readonly<Record<string, string>> = {}) =>
    archivosDe(dir)
      .filter((f) => !(f in fuera))
      .filter((f) => tieneCopia(fuente(f)))
      .map((f) => `${f} (${formasEn(fuente(f)).join(', ')})`);

  describe('el detector', () => {
    /*
     * MUTACIÓN PROBADA, una por forma: cada línea de abajo, escrita en un
     * archivo de un árbol barrido, lo deja en rojo con el nombre de la forma.
     * Se prueba sobre un árbol en `os.tmpdir()` —y no dejando una copia en el
     * repo— para que la prueba no dependa de que alguien la vuelva a sacar.
     */
    const VARIANTES: readonly (readonly [string, string])[] = [
      ['find', 'const s = filas.find((m) => m.sede)?.sede ?? null;'],
      ['find', 'const o = modalidades.find((m) => m?.online)?.online ?? null;'],
      ['find', 'const s = filas.find(({ sede }) => sede)?.sede ?? null;'],
      ['find', 'const o = filas.find(({ online }) => online)?.online ?? null;'],
      ['primera-fila', 'const s = filas[0]?.sede ?? null;'],
      ['primera-fila', 'const s = doc.modalidades[0]?.sede ?? null;'],
      ['primera-fila', 'const o = doc.modalidades?.[0]?.online ?? null;'],
      ['filter-cero', 'const s = filas.filter((m) => m.sede)[0]?.sede ?? null;'],
      ['filter-cero', 'const s = filas.filter(({ sede }) => sede)[0]?.sede ?? null;'],
    ];

    it.each(VARIANTES)('reconoce la forma `%s` en «%s»', (forma, linea) => {
      expect(formasEn(linea)).toEqual([forma]);
    });

    it('cada variante, en un archivo de un árbol barrido, lo nombra; en un comentario, no', () => {
      const raiz = mkdtempSync(join(tmpdir(), 'barrido-derivados-'));
      try {
        mkdirSync(join(raiz, 'componentes', 'node_modules'), { recursive: true });
        VARIANTES.forEach(([, linea], i) => {
          writeFileSync(join(raiz, 'componentes', `copia-${i}.tsx`), `export const f = (filas) => {\n  ${linea}\n  return s;\n};\n`);
        });
        // La misma línea comentada no es código, y lo de `node_modules` no es del repo.
        writeFileSync(join(raiz, 'comentada.ts'), `// ${VARIANTES[0][1]}\n/* ${VARIANTES[4][1]} */\n`);
        writeFileSync(join(raiz, 'componentes', 'node_modules', 'ajeno.js'), VARIANTES[0][1]);
        const culpables = culpablesEn(raiz).map((c) => c.slice(raiz.length + 1)).sort();
        expect(culpables).toEqual(
          VARIANTES.map(([forma], i) => `componentes/copia-${i}.tsx (${forma})`).sort(),
        );
      } finally {
        rmSync(raiz, { recursive: true, force: true });
      }
    });

    it('no confunde lo que no es la derivación', () => {
      // Leer una fila puntual, filtrar para listar, preguntar si hay alguna.
      for (const legitimo of [
        'const r = reubicacionDe(doc.modalidades[0].sede);',
        "const z = p.modalidades.filter((m) => m.sede).map((m) => m.sede.ciudad);",
        'const hay = p.modalidades.some((m) => m.sede && !m.sede.provincia);',
        'const c = filas.find((m) => m.sede?.ciudad === slug);',
        'const tope = filas[0]?.valor ?? 0;',
      ]) {
        expect(formasEn(legitimo), legitimo).toEqual([]);
      }
    });

    it('reconoce la implementación de verdad (control positivo)', () => {
      expect(formasEn(fuente('functions/derivados.js'))).toContain('find');
    });
  });

  /*
   * El control de alcance: un árbol que de pronto tiene menos archivos es un
   * barrido que dejó de mirar (un `dir` mal escrito da cero y `[]` pasa).
   */
  const ALCANCE: Readonly<Record<string, number>> = {
    scripts: 20,
    tests: 100,
    src: 200,
    functions: 40,
  };

  it.each(Object.entries(ALCANCE))('el barrido de `%s/` mira más de %i archivos', (dir, minimo) => {
    expect(archivosDe(dir).length).toBeGreaterThan(minimo);
  });

  it('ningún script de `scripts/` deriva la sede o el online por su cuenta', () => {
    /*
     * MUTACIÓN PROBADA: devolver a `reubicar-barrios.mjs` su
     * `const sede = nuevas.find((m) => m.sede)?.sede ?? null;` deja este caso en
     * rojo nombrando el archivo.
     */
    expect(culpablesEn('scripts')).toEqual([]);
  });

  /**
   * **Ni el panel, ni el sitio, ni las Functions — B-2150.** Una copia en un
   * componente del panel o en otra Function es la misma clase de B-88 que en un
   * script: el documento sale derivado con otra regla y `syncCalendar` lo
   * corrige y avisa `derivados-no-coinciden`.
   *
   * Quedan afuera **la implementación** y **las fachadas** que la reexportan con
   * tipos para `src/`. Cada una lleva su motivo, y el motivo se verifica: una
   * fachada que deja de importar de `functions/` ya no es fachada y vuelve al
   * barrido.
   */
  const FUERA_EN_SRC_Y_FUNCTIONS: Readonly<Record<string, readonly [string, string]>> = {
    'functions/derivados.js': ['la implementación de `sedePrincipal` y `onlinePrincipal`', 'export const sedePrincipal'],
    'functions/busqueda.js': ['la implementación del `searchText`, que recorre las sedes', 'export const buildSearchText'],
    'src/lib/modalidades.ts': ['fachada tipada de `functions/derivados.js`', "from '../../functions/derivados.js'"],
    'src/lib/normalize.ts': ['fachada tipada de `functions/busqueda.js`', "from '../../functions/busqueda.js'"],
  };
  const fueraDe = Object.fromEntries(
    Object.entries(FUERA_EN_SRC_Y_FUNCTIONS).map(([rel, [motivo]]) => [rel, motivo]),
  );

  it('las exclusiones de `src/` y `functions/` siguen siendo lo que dicen', () => {
    for (const [rel, [motivo, marca]] of Object.entries(FUERA_EN_SRC_Y_FUNCTIONS)) {
      expect(motivo.length, rel).toBeGreaterThan(20);
      expect(fuente(rel), `${rel} ya no es ${motivo}: sacalo de las exclusiones`).toContain(marca);
    }
  });

  it.each(['src', 'functions'])('ningún archivo de `%s/` deriva la sede o el online por su cuenta', (dir) => {
    /*
     * MUTACIÓN PROBADA: escribir en `src/components/admin/ModalidadesEditor.tsx`
     * un `const s = form.modalidades[0]?.sede ?? null;` deja el caso de `src` en
     * rojo con «(primera-fila)»; un `.find(({ online }) => online)` en
     * `functions/calendario-trigger.js`, el de `functions` con «(find)».
     */
    expect(culpablesEn(dir, fueraDe)).toEqual([]);
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
      'el `payloadViejo` de reubicar-barrios reproduce el payload de antes de B-2090 como control positivo, y este archivo escribe las variantes que el detector tiene que reconocer',
  };

  it('ningún test de `tests/` deriva la sede o el online por su cuenta', () => {
    expect(culpablesEn('tests', EXCEPCIONES_EN_TESTS)).toEqual([]);
    for (const [rel, motivo] of Object.entries(EXCEPCIONES_EN_TESTS)) {
      expect(motivo.length, rel).toBeGreaterThan(20);
      expect(tieneCopia(fuente(rel)), `${rel} ya no tiene la copia: sacala de las excepciones`).toBe(true);
    }
  });

  it.each(Object.keys(ALCANCE))('ningún archivo de `%s/` arma la modalidad resultante con su propia unión', (dir) => {
    /*
     * La otra mitad de la copia de `tests/fixtures/indice.ts`: un `Set` de las
     * modalidades de las filas con su `has('hibrido')`. La regla es
     * `modalidadResultante`.
     *
     * MUTACIÓN PROBADA: devolverle al fixture su
     * `new Set(modalidades.map((m) => m.modalidad))` deja el caso de `tests` en
     * rojo.
     */
    const union = /new Set\(\s*\w+\??\.map\(\(?\w+\)?\s*=>\s*\w+\??\.modalidad\)/;
    // Control positivo, partido para que este archivo no se nombre a sí mismo.
    expect(union.test('const formas = new Set(' + 'modalidades.map((m) => m.modalidad));')).toBe(true);
    const culpables = archivosDe(dir)
      .filter((f) => !(f in fueraDe))
      .filter((f) => union.test(fuente(f)));
    expect(culpables).toEqual([]);
  });
});
