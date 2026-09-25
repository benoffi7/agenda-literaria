/**
 * El índice de los **barridos de las salidas públicas** — PRD 6, M-12.
 *
 * Hasta el 2026-09-25 este archivo era los veintiún barridos juntos, 4.200
 * líneas (~50 mil tokens). Ahora cada barrido vive en su archivo de
 * `tests/salidas/` —con el número de la salida de `docs/07-seguridad.md` §5
 * adelante cuando es de una sola—, lo que usan dos o más (las listas de
 * permitidos, las canastas del gate) está en `tests/fixtures/barrido-de-salidas.ts`
 * junto con el porqué del barrido entero, y acá queda el índice. Para sumar o
 * revisar **una** salida se lee esta tabla y un archivo. Los 108 casos son los
 * mismos de antes, con los mismos nombres.
 *
 * El título es el del `describe` del archivo, al pie de la letra: el test de
 * abajo compara las dos cosas, así que un barrido nuevo sin su fila, o una fila
 * que quedó de un barrido que se fue, es rojo.
 *
 * | Archivo | Barrido |
 * |---|---|
 * | `tests/salidas/canastas-del-gate.test.ts` | las canastas del gate del build y las de este barrido — B-1761 |
 * | `tests/salidas/01-proyeccion-de-la-actividad.test.ts` | barrido de la proyección de la actividad (§5.2, `toPublic`) |
 * | `tests/salidas/01-proyeccion-dos-formas-de-cursar.test.ts` | barrido de la proyección con dos formas de cursar (B-224) |
 * | `tests/salidas/motivo-de-cancelacion.test.ts` | el motivo de la cancelación sale solo con el encuentro cancelado — B-98 |
 * | `tests/salidas/02-evento-de-calendar.test.ts` | barrido del evento de Calendar (§5.1, §7.4) |
 * | `tests/salidas/ciudades-por-ninguna-puerta.test.ts` | `ciudades` no sale por ninguna puerta — B-919 |
 * | `tests/salidas/01-search-text.test.ts` | barrido del searchText (§6 — salida pública por la puerta de atrás) |
 * | `tests/salidas/el-barrido-falla-cuando-debe.test.ts` | el barrido falla cuando debe, y dice qué se escapó |
 * | `tests/salidas/centinelas-sin-envejecer.test.ts` | el fixture de centinelas no puede envejecer |
 * | `tests/salidas/monto-del-arancel.test.ts` | el monto del arancel llega a las salidas que lo publican, y a ninguna más (B-114) |
 * | `tests/salidas/01-opciones-publicas.test.ts` | barrido de las opciones públicas (§4.4, B-212) |
 * | `tests/salidas/01-indice-del-listado.test.ts` | barrido del índice del listado (§3.1, B-106) |
 * | `tests/salidas/06-pagina-de-detalle.test.ts` | barrido de la página de detalle (§4.3 del diseño, B-227) |
 * | `tests/salidas/07-cartelera.test.ts` | barrido de la cartelera (§5, salida 7, B-265) |
 * | `tests/salidas/08-pagina-de-mes.test.ts` | barrido de la página de mes (§5, salida 8, B-113) |
 * | `tests/salidas/09-sitemap.test.ts` | barrido del sitemap (§5, salida 9, B-109) |
 * | `tests/salidas/10-pasadas.test.ts` | barrido de `/pasadas` (§5, salida 10, B-109) |
 * | `tests/salidas/16-no-encontrado.test.ts` | barrido de la página de error `/404` (§5, B-310 — su fila del índice es B-654) |
 * | `tests/salidas/11-hubs-de-busqueda.test.ts` | barrido de los hubs de búsqueda (§5, salida 11, B-108) |
 * | `tests/salidas/01-que-hay-ahora.test.ts` | barrido del tríptico de «¿qué hay ahora?» (§5, salida 1 · 7º productor, B-600) |
 * | `tests/salidas/29-correo-semanal.test.ts` | barrido del correo semanal (§5, salida 29, B-1230) |
 *
 * La trampa 5 del §13 —el link de la reunión en lo público— la sostienen sobre
 * todo los barridos de la proyección, del evento de Calendar y del detalle; el
 * mapa (`docs/15-mapa-de-trampas.md`) cita esos archivos, no este índice.
 */
import { describe, expect, it } from 'vitest';
import { archivosDe, describesDe, filasDelIndice } from './fixtures/indice-de-registro';

const INDICE = 'tests/barrido-de-salidas-publicas.test.ts';
const DIRECTORIO = 'tests/salidas';

describe('el índice de los barridos dice lo que hay en `tests/salidas/` — M-12', () => {
  const filas = filasDelIndice(INDICE);

  it('la tabla se leyó', () => {
    // Control positivo: sin esto, una tabla que el regex dejara de ver haría
    // pasar las comparaciones de abajo con dos listas vacías.
    expect(filas.length).toBeGreaterThanOrEqual(21);
  });

  it('cada archivo de `tests/salidas/` tiene su fila, y cada fila su archivo', () => {
    expect(filas.map((f) => f.archivo).sort()).toEqual(archivosDe(DIRECTORIO).sort());
  });

  it('cada archivo es un barrido: un solo `describe` de primer nivel, con el título de su fila', () => {
    const desalineados = filas
      .map((f) => ({ ...f, describes: describesDe(f.archivo) }))
      .filter((f) => f.describes.length !== 1 || f.describes[0] !== f.titulo)
      .map((f) => `${f.archivo}: fila «${f.titulo}», describe ${JSON.stringify(f.describes)}`);
    expect(desalineados).toEqual([]);
  });

  it('un archivo con el número de una salida adelante habla de esa salida', () => {
    // El prefijo `NN-` es lo que un agente usa para encontrar el barrido de la
    // salida N sin leer los otros veinte: si el título dice otra salida, el
    // prefijo miente. Solo se mira cuando el título nombra una.
    const mentirosos = filas
      .map((f) => ({
        ...f,
        prefijo: /\/(\d\d)-/.exec(f.archivo)?.[1],
        dice: /salida (\d+)/.exec(f.titulo)?.[1],
      }))
      .filter((f) => f.prefijo && f.dice && Number(f.prefijo) !== Number(f.dice))
      .map((f) => `${f.archivo} dice «salida ${f.dice}»`);
    expect(mentirosos).toEqual([]);
  });
});
