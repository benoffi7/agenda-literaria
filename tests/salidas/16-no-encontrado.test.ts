/**
 * Salida 16: la página de error `/404` (B-310).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { GrupoDeExploracion } from '@/lib/hubsPublicos';
import { frasesDeNoEncontrado } from '@/lib/noEncontrado';
import { CENTINELA } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';

/*
 * **Este `describe` NO se atribuye un número de salida, y es a propósito.**
 *
 * `/404` es una salida pública nueva y le correspondería la **13**, pero el índice
 * de `docs/07-seguridad.md` todavía tiene doce filas: agregar la fila —y sus
 * gemelas en el skill `campo-nuevo` y en la ficha del `auditor-privacidad`— es
 * **B-654**, y esos archivos no son de este frente.
 *
 * Ponerle «salida 13» al rótulo mientras tanto es exactamente lo que
 * `tests/agentes-y-skills.test.ts` prohíbe desde B-600: «un barrido se atribuye un
 * número de salida que en el índice es otra cosa… el índice queda apuntando a la
 * salida equivocada, y ningún otro chequeo lo ve». Y ese chequeo lo agarró: el
 * rótulo decía «salida 13» y el caso se puso rojo al mergear main.
 *
 * Así que el rótulo dice **qué** barre y no qué número tiene, y el número llega
 * junto con la fila. Lo que no cambia por eso: el barrido corre igual y afirma
 * exactamente lo mismo.
 */
describe('barrido de la página de error `/404` (§5, B-310 — su fila del índice es B-654)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, como la 7, la 8 y la 10.
   *
   * Es la salida más chica del repo: cuatro frases escritas a mano
   * (`lib/noEncontrado.ts`) y ningún dato de ninguna actividad. Lo único que la
   * página ve de los datos son **los grupos de la tira «Explorá por»** —etiquetas
   * de taxonomía y nombres de mes, ya públicos por la salida 11— y
   * `frasesDeNoEncontrado` los **recibe**, que es lo que hace que este barrido
   * signifique algo: la función que arma el texto tiene los datos a mano y no los
   * usa.
   *
   * Por eso la lista de permitidos está **vacía**, y eso es el aserto. El día que
   * a alguien se le ocurra la mejora obvia de una página de error —«¿buscabas
   * *Taller de crónica*?», o «hay 12 talleres con fecha próxima»— este `describe`
   * lo dice y hay que decidirlo.
   *
   * MUTACIÓN PROBADA: interpolar `grupos[0]?.enlaces[0]?.texto` en la `bajada` de
   * `frasesDeNoEncontrado` hace fallar este `it` nombrando el centinela de la
   * etiqueta de barrio.
   */

  /**
   * Los grupos con **centinelas en las tres posiciones** que un grupo tiene: el
   * rótulo, el texto del enlace y la ruta. Es la forma real de la tira —los
   * rótulos son etiquetas de taxonomía y los enlaces se direccionan por slug— con
   * cada string reemplazado por algo verificable.
   */
  const grupos = (): GrupoDeExploracion[] => [
    {
      rotulo: CENTINELA['labels.tipo'],
      enlaces: [
        { ruta: `/barrio/${CENTINELA['sede.barrio']}/`, texto: CENTINELA['labels.barrio'] },
      ],
    },
  ];

  /** El texto que esta salida agrega, y nada más: sus cuatro frases. */
  const textoDeLaPagina = (): string => Object.values(frasesDeNoEncontrado(grupos())).join(' | ');

  it('control positivo: hay texto que barrer, y los grupos traen centinelas', () => {
    expect(textoDeLaPagina().length).toBeGreaterThan(120);
    // Sin esto, unos grupos que dejaran de traer centinelas harían pasar el
    // barrido de abajo sin haber tenido nada que filtrar.
    const enLosGrupos = JSON.stringify(grupos());
    expect(enLosGrupos).toContain(CENTINELA['labels.tipo']);
    expect(enLosGrupos).toContain(CENTINELA['labels.barrio']);
    expect(enLosGrupos).toContain(CENTINELA['sede.barrio']);
  });

  it('ninguna frase de la página publica un dato de una actividad', () => {
    barrer('/404', textoDeLaPagina(), [], { insensible: true });
  });
});
