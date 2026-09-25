/**
 * El índice de las **clases** de bug con red — PRD 6, M-12.
 *
 * Hasta el 2026-09-25 este archivo era las dieciocho clases juntas, 3.700
 * líneas. Ahora cada clase vive en su archivo de `tests/clases/`, lo que usan
 * dos o más está en `tests/fixtures/clases-de-bug.ts` —con el porqué de todo el
 * registro y cómo leer los `it.fails`—, y acá queda el índice: para sumar o
 * revisar **una** clase se lee esta tabla y un archivo. Los 132 casos son los
 * mismos de antes, con los mismos nombres.
 *
 * El título es el del `describe` del archivo, al pie de la letra: el test de
 * abajo compara las dos cosas, así que una clase nueva sin su fila, o una fila
 * que quedó de una clase que se fue, es rojo.
 *
 * | Archivo | Clase |
 * |---|---|
 * | `tests/clases/descubrimiento-de-triggers.test.ts` | el descubrimiento de triggers sigue viendo lo que hay |
 * | `tests/clases/b-80-un-dueno-por-campo.test.ts` | clase de B-80 · un solo dueño por campo del documento |
 * | `tests/clases/b-171-detector-de-efectos.test.ts` | el detector de efectos duplicables discrimina — B-171 |
 * | `tests/clases/b-82-efecto-duplicable-blindado.test.ts` | clase de B-82 · todo trigger con efecto duplicable se blinda |
 * | `tests/clases/trampa-12-storage-sin-loop.test.ts` | clase de la trampa 12 · un trigger de Storage no puede dispararse a sí mismo |
 * | `tests/clases/b-83-efecto-incondicional.test.ts` | clase de B-83 · un efecto incondicional no puede quedar debajo de una guarda |
 * | `tests/clases/b-905-write-back-con-guarda.test.ts` | trampa 3 · el write-back al propio documento va detrás de su guarda — B-905 |
 * | `tests/clases/b-88-consumidor-y-productor.test.ts` | clase de B-88 · el consumidor acepta todo lo que el productor produce |
 * | `tests/clases/b-81-saneador-en-el-paso.test.ts` | clase de B-81 · el saneador va en un punto de paso obligado |
 * | `tests/clases/b-71-irreversible-ultimo.test.ts` | clase de B-71 · el efecto irreversible va último |
 * | `tests/clases/b-209-consulta-antes.test.ts` | clase de B-209 · la consulta sale antes de cualquier escritura |
 * | `tests/clases/b-211-doble-de-timestamp.test.ts` | clase de B-211 · el doble de Timestamp vive en un solo lugar |
 * | `tests/clases/b-212-caminos-de-una-opcion.test.ts` | clase de B-212 · los cinco caminos de una opción leen lo mismo |
 * | `tests/clases/b-821-marcas-del-navegador.test.ts` | clase de la §5.1 · una marca del navegador tiene clave fija y está declarada — B-821 |
 * | `tests/clases/b-827-campo-con-label.test.ts` | clase de B-827 · todo `Campo` asocia su label con su control |
 * | `tests/clases/b-911-flag-antes-que-el-dato.test.ts` | clase de B-911 · un flag de publicación se lee antes que el dato que esconde |
 * | `tests/clases/b-914-label-de-otro.test.ts` | clase de B-914 · el label de «Otro…» no se tira en el `onChange` |
 * | `tests/clases/b-854-hay-x-igual-en-cada-salida.test.ts` | clase de B-854 · «¿hay X?» se contesta igual en cada salida |
 * | `tests/clases/b-2081-barrido-sin-node-modules.test.ts` | clase de B-2081 · un barrido recursivo que alcanza `functions/` o la raíz saltea `node_modules` |
 */
import { describe, expect, it } from 'vitest';
import { archivosDe, describesDe, filasDelIndice } from './fixtures/indice-de-registro';

const INDICE = 'tests/clases-de-bug.test.ts';
const DIRECTORIO = 'tests/clases';

describe('el índice de las clases de bug dice lo que hay en `tests/clases/` — M-12', () => {
  const filas = filasDelIndice(INDICE);

  it('la tabla se leyó', () => {
    // Control positivo: sin esto, una tabla que el regex dejara de ver haría
    // pasar las comparaciones de abajo con dos listas vacías.
    expect(filas.length).toBeGreaterThanOrEqual(18);
  });

  it('cada archivo de `tests/clases/` tiene su fila, y cada fila su archivo', () => {
    expect(filas.map((f) => f.archivo).sort()).toEqual(archivosDe(DIRECTORIO).sort());
  });

  it('cada archivo es una clase: un solo `describe` de primer nivel, con el título de su fila', () => {
    const desalineados = filas
      .map((f) => ({ ...f, describes: describesDe(f.archivo) }))
      .filter((f) => f.describes.length !== 1 || f.describes[0] !== f.titulo)
      .map((f) => `${f.archivo}: fila «${f.titulo}», describe ${JSON.stringify(f.describes)}`);
    expect(desalineados).toEqual([]);
  });
});
