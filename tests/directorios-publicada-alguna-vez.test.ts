/**
 * **B-905 — `publicadaAlgunaVez` en los cuatro directorios de la Guía.**
 *
 * El campo estaba declarado en los cuatro tipos y las cuatro reglas lo
 * respetaban (`slugDe*Congelado`, `firestore.rules`), pero **nadie lo escribía**:
 * publicar → despublicar → renombrar → volver a publicar reabría la URL
 * (trampa 10). Desde B-905 lo prenden los triggers de
 * `functions/directorios-trigger.js`, con la misma decisión y el mismo efecto que
 * `syncCalendar` usa para las actividades (B-285).
 *
 * Lo que este archivo fija, en orden de qué duele más si se rompe:
 *
 * 1. **La guarda anti-loop** (trampa 3): el trigger escribe en el documento que
 *    lo dispara. La segunda pasada no escribe (`faltaMarcarPublicada`) y tampoco
 *    rebuildea (`cambioAmeritaRebuild`).
 * 2. **Cada trigger escribe en su colección.** El bloque se repite en los cuatro
 *    cuerpos a propósito (el chequeo de B-83 es textual), y una copia que se quede
 *    con `'librerias'` en el trigger de lugares marcaría la librería del mismo id
 *    —o fallaría— y dejaría el lugar con la puerta abierta.
 * 3. **Todo directorio con el campo tiene el trigger.** Un quinto directorio que
 *    declare `publicadaAlgunaVez` y no lo escriba es B-905 otra vez.
 *
 * Los triggers no se importan (`tests/tests-no-importan-triggers.test.ts`): la
 * decisión y el efecto viven en módulos puros y se importan de ahí; el cableado
 * se lee como fuente.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { MARCA_DE_PUBLICADA, faltaMarcarPublicada } from '../functions/historial.js';
import { marcarPublicada } from '../functions/marca-de-publicada.js';
import { COLECCIONES_DE_DIRECTORIO, cambioAmeritaRebuild } from '../functions/directorios.js';
import { ESTADOS_DIRECTORIO, ESTADO_PUBLICO } from '@/lib/directorios';
import { libreriaCentinela } from './fixtures/centinelas-libreria';
import { suscripcionCentinela } from './fixtures/centinelas-suscripcion';
import { lugarCentinela } from './fixtures/centinelas-lugar';
import { bibliotecaCentinela } from './fixtures/centinelas-biblioteca';

type Doc = Record<string, unknown>;

/** Un documento de cada directorio, **sin** la marca: el de antes de B-905. */
const sinMarca = (d: object): Doc => {
  const { [MARCA_DE_PUBLICADA]: _marca, ...resto } = d as Doc;
  void _marca;
  return resto;
};

const DIRECTORIOS: { coleccion: string; tipo: string; documento: () => Doc }[] = [
  { coleccion: 'librerias', tipo: 'src/types/libreria.ts', documento: () => sinMarca(libreriaCentinela()) },
  {
    coleccion: 'suscripciones',
    tipo: 'src/types/suscripcion-literaria.ts',
    documento: () => sinMarca(suscripcionCentinela()),
  },
  { coleccion: 'lugares', tipo: 'src/types/lugar.ts', documento: () => sinMarca(lugarCentinela()) },
  {
    coleccion: 'bibliotecas',
    tipo: 'src/types/biblioteca.ts',
    documento: () => sinMarca(bibliotecaCentinela()),
  },
];

/** Un `db` falso que registra los `update` y nada más. */
const dbQueAnota = () => {
  const escrituras: { path: string; datos: Doc }[] = [];
  const db = {
    doc: (path: string) => ({
      update: async (datos: Doc) => {
        escrituras.push({ path, datos });
      },
    }),
  };
  return { db, escrituras };
};

describe('la tabla de este archivo es la de los directorios que existen', () => {
  it('son las colecciones de `COLECCIONES_DE_DIRECTORIO`, ni una más ni una menos', () => {
    // Si un quinto directorio entra al mapa del rebuild y no a esta tabla, los
    // casos de abajo dejan de mirarlo sin ponerse rojos.
    expect(DIRECTORIOS.map((d) => d.coleccion).sort()).toEqual([...COLECCIONES_DE_DIRECTORIO].sort());
  });

  it('las cuatro declaran el campo en su tipo', () => {
    for (const { coleccion, tipo } of DIRECTORIOS) {
      expect(readFileSync(tipo, 'utf8'), coleccion).toMatch(/\bpublicadaAlgunaVez\?: boolean;/);
    }
  });

  it('el estado público de un directorio es el mismo literal que decide la marca', () => {
    // `faltaMarcarPublicada` vive en `functions/historial.js` y compara contra
    // `'publicado'`; los directorios publican con `ESTADO_PUBLICO`. Si uno de los
    // dos cambia, la marca no se escribiría nunca y nada fallaría.
    expect(ESTADO_PUBLICO).toBe('publicado');
  });
});

describe('cuándo se marca', () => {
  it('la primera vez que la ficha está publicada, en las cuatro colecciones', () => {
    for (const { coleccion, documento } of DIRECTORIOS) {
      expect(faltaMarcarPublicada({ ...documento(), estado: 'publicado' }), coleccion).toBe(true);
    }
  });

  it('en ningún otro estado', () => {
    for (const { coleccion, documento } of DIRECTORIOS) {
      for (const estado of ESTADOS_DIRECTORIO.filter((e) => e !== ESTADO_PUBLICO)) {
        expect(faltaMarcarPublicada({ ...documento(), estado }), `${coleccion} · ${estado}`).toBe(
          false,
        );
      }
    }
  });

  it('ni cuando la ficha se borró', () => {
    expect(faltaMarcarPublicada(null)).toBe(false);
  });
});

describe('la guarda anti-loop (trampa 3)', () => {
  it('el write-back vuelve a disparar el trigger y en esa pasada no se escribe ni se rebuildea', async () => {
    /*
     * Se simula el recorrido completo: la ficha pasa a publicada, el trigger la
     * marca, ese `update` vuelve a disparar el mismo handler con el documento de
     * antes y el de después del write-back.
     *
     * MUTACIÓN PROBADA: sacar el `&& !marcadaComoPublicada(documento)` de
     * `faltaMarcarPublicada` pone en rojo el segundo aserto (el loop: cada pasada
     * escribiría otra vez); sumar `'publicadaAlgunaVez'` a una lista de
     * `CAMPOS_PUBLICOS_POR_DIRECTORIO` pone en rojo el tercero (dos builds por
     * publicación).
     */
    for (const { coleccion, documento } of DIRECTORIOS) {
      const pendiente = { ...documento(), estado: 'pendiente' };
      const publicada = { ...documento(), estado: 'publicado' };

      // Primera pasada: la publicación.
      expect(faltaMarcarPublicada(publicada), coleccion).toBe(true);
      const { db, escrituras } = dbQueAnota();
      await marcarPublicada(db, 'f1', coleccion);
      expect(cambioAmeritaRebuild(pendiente, publicada, coleccion), coleccion).toBe(true);

      // Segunda pasada: el write-back.
      const marcada = { ...publicada, ...escrituras[0]!.datos };
      expect(faltaMarcarPublicada(marcada), coleccion).toBe(false);
      expect(cambioAmeritaRebuild(publicada, marcada, coleccion), coleccion).toBe(false);
    }
  });

  it('despublicar no apaga la marca, y volver a publicar no la reescribe', () => {
    // Es el recorrido de B-905: publicar → despublicar → renombrar → publicar.
    for (const { coleccion, documento } of DIRECTORIOS) {
      const despublicada = { ...documento(), estado: 'pendiente', publicadaAlgunaVez: true };
      const republicada = { ...despublicada, estado: 'publicado' };
      expect(faltaMarcarPublicada(despublicada), coleccion).toBe(false);
      expect(faltaMarcarPublicada(republicada), coleccion).toBe(false);
    }
  });
});

describe('despublicar una ficha sin marca la marca — B-1480', () => {
  it('la escritura que la saca de publicado prende la marca si todavía no la tenía', () => {
    // Las publicadas antes de B-905 no tienen la marca hasta su próxima
    // escritura; si esa escritura es la que las despublica, antes quedaban en
    // `pendiente` sin marca y el slug volvía a ser editable (trampa 10).
    for (const { coleccion, documento } of DIRECTORIOS) {
      const antes = { ...documento(), estado: 'publicado' };
      const despues = { ...documento(), estado: 'pendiente' };
      expect(faltaMarcarPublicada(despues, antes), coleccion).toBe(true);
      // Sin `antes` publicado, una pendiente nunca publicada no se marca.
      expect(faltaMarcarPublicada(despues, { ...antes, estado: 'pendiente' }), coleccion).toBe(false);
      expect(faltaMarcarPublicada(despues), coleccion).toBe(false);
      // Y si ya estaba marcada, no se reescribe (la guarda anti-loop sigue entera).
      expect(
        faltaMarcarPublicada({ ...despues, publicadaAlgunaVez: true }, antes),
        coleccion,
      ).toBe(false);
    }
  });

  it('un documento borrado no se marca: no hay dónde', () => {
    expect(faltaMarcarPublicada(null, { estado: 'publicado' })).toBe(false);
  });
});

describe('el efecto', () => {
  it('escribe `true` en el documento de su colección, con `update`', async () => {
    for (const { coleccion } of DIRECTORIOS) {
      const { db, escrituras } = dbQueAnota();
      await marcarPublicada(db, 'f1', coleccion);
      expect(escrituras, coleccion).toEqual([
        { path: `${coleccion}/f1`, datos: { [MARCA_DE_PUBLICADA]: true } },
      ]);
    }
  });

  it('sin colección sigue escribiendo en `actividades`, que es lo que llama `syncCalendar`', async () => {
    const { db, escrituras } = dbQueAnota();
    await marcarPublicada(db, 'a1');
    expect(escrituras).toEqual([{ path: 'actividades/a1', datos: { [MARCA_DE_PUBLICADA]: true } }]);
  });
});

describe('el cableado de los triggers', () => {
  const FUENTE = sinComentarios(readFileSync('functions/directorios-trigger.js', 'utf8'));

  /** El cuerpo del trigger de una colección: desde su `document:` hasta el próximo `export const`. */
  const cuerpoDe = (coleccion: string): string => {
    const desde = FUENTE.indexOf(`document: '${coleccion}/{id}'`);
    if (desde < 0) return '';
    const hasta = FUENTE.indexOf('export const', desde);
    return FUENTE.slice(desde, hasta < 0 ? FUENTE.length : hasta);
  };

  it('cada trigger marca **su** colección, detrás de la guarda', () => {
    /*
     * MUTACIÓN PROBADA: dejar `'librerias'` en la llamada del trigger de
     * `lugares` (el error de copiar el bloque) pone este caso en rojo nombrando
     * la colección; sacar el `if (faltaMarcarPublicada(despues, antes))` de cualquiera
     * de los cuatro, también.
     */
    for (const { coleccion } of DIRECTORIOS) {
      const cuerpo = cuerpoDe(coleccion);
      expect(cuerpo, `falta el trigger de ${coleccion}`).not.toBe('');
      const llamadas = [...cuerpo.matchAll(/marcarPublicada\(getFirestore\(\), id, '(\w+)'\)/g)];
      expect(
        llamadas.map((m) => m[1]),
        coleccion,
      ).toEqual([coleccion]);
      const guarda = cuerpo.indexOf('if (faltaMarcarPublicada(despues, antes))');
      expect(guarda, `${coleccion}: sin guarda`).toBeGreaterThanOrEqual(0);
      expect(guarda, coleccion).toBeLessThan(llamadas[0]!.index!);
    }
  });

  it('la marca va antes del rebuild y no depende de él', () => {
    // Corresponde porque la ficha pasó a publicada, no porque el sitio tenga
    // algo que rehacer: con la marca adentro del `if` del rebuild, una ficha que
    // se publica sin cambiar ningún campo público (no pasa hoy, pero la lista
    // la decide otro archivo) se quedaría sin ella.
    for (const { coleccion } of DIRECTORIOS) {
      const cuerpo = cuerpoDe(coleccion);
      expect(cuerpo.indexOf('marcarPublicada('), coleccion).toBeLessThan(
        cuerpo.indexOf('cambioAmeritaRebuild('),
      );
    }
  });
});

describe('la regla ya contestaba con la marca — por eso B-905 no la toca', () => {
  it('las cuatro `slugDe*Congelado` miran `publicadaAlgunaVez` antes que el estado', () => {
    const reglas = readFileSync('firestore.rules', 'utf8');
    for (const nombre of ['Libreria', 'Suscripcion', 'Lugar', 'Biblioteca']) {
      const m = new RegExp(`function slugDe${nombre}Congelado\\(previo\\) \\{([\\s\\S]*?)\\}`).exec(
        reglas,
      );
      expect(m, nombre).not.toBeNull();
      expect(m![1]!.replace(/\s+/g, ' ').trim(), nombre).toBe(
        "return previo.get('publicadaAlgunaVez', false) == true || previo.get('estado', '') == 'publicado';",
      );
    }
  });
});
