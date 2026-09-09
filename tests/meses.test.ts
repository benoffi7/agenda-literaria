import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MESES, nombreDeMes } from '@/lib/meses';
import { nombreMes, diaLegible } from '@/lib/calendarioPanel';
import { fechaLegible } from '@/lib/novedades';

/**
 * Los nombres de los meses viven en un lugar — B-215.
 *
 * `calendarioPanel.ts` y `novedades.ts` tenían cada uno los doce, idénticos, y
 * en los dos para lo mismo: formatear el nombre de un mes. El motivo por el que
 * se unificaron está en el docblock de `src/lib/meses.ts`; acá está lo que hace
 * que no se vuelvan a separar, más los casos de borde de `nombreDeMes`.
 */
const RAIZ = fileURLToPath(new URL('..', import.meta.url));

describe('nombreDeMes', () => {
  it('los doce, y el primero es enero', () => {
    expect(MESES).toHaveLength(12);
    expect(nombreDeMes('01')).toBe('enero');
    expect(nombreDeMes('12')).toBe('diciembre');
    // Con número y con string: los llamadores le pasan las dos cosas.
    expect(nombreDeMes(8)).toBe('agosto');
  });

  it('un número que no es un mes da null, no una cadena vacía', () => {
    /*
     * El `null` es load-bearing: los tres llamadores lo usan para caer en su
     * propio texto de reserva (devolver la clave cruda, `'2026-13'`). Una cadena
     * vacía se colaría al HTML como un hueco silencioso — `'de 2026'` sin mes —
     * que es peor que mostrar la clave.
     */
    for (const malo of ['00', '13', '-1', 'ago', '', '1.5']) {
      expect(nombreDeMes(malo), malo).toBeNull();
    }
  });

  it('los tres formateadores siguen dando lo mismo que antes de unificar', () => {
    // Los tres consumidores, con su forma propia. Es lo que garantiza que el
    // refactor no cambió ninguna salida visible.
    expect(nombreMes('2026-08')).toBe('agosto de 2026');
    expect(diaLegible('2026-08-24')).toBe('lunes 24 de agosto');
    expect(fechaLegible('2026-08-21')).toBe('21 de agosto de 2026');
  });

  it('y una clave inválida sigue cayendo en la clave cruda, no en un hueco', () => {
    expect(nombreMes('2026-13')).toBe('2026-13');
    expect(fechaLegible('2026-13-01')).toBe('2026-13-01');
  });
});

/**
 * El patrón que busca una copia de la lista, en las cuatro formas en que se
 * escribe el mismo dato: `'enero'`, `"enero"`, `` `enero` `` y la clave suelta
 * de un mapa (`{ enero: 1, … }`). Sale a una constante porque el caso de abajo
 * lo ejercita contra muestras — un patrón de guarda que nadie prueba es una
 * guarda que nadie sabe si mira.
 */
const PATRON_COPIA = "[\"'`]enero[\"'`]|\\benero:";

describe('la lista no vuelve a duplicarse', () => {
  it('los nombres de los meses se declaran en un solo archivo', () => {
    /*
     * La guarda, y el modo de falla que atiende es silencioso: una segunda lista
     * no rompe nada el día que nace. Rompe meses después, cuando una de las dos
     * se corrige —un acento, una abreviatura— y las dos pantallas quedan
     * mostrando el mismo mes escrito distinto. Es la divergencia de B-175,
     * exactamente, que también nació de dos mapas separados «a propósito».
     *
     * Se busca `enero` y no `MESES`: lo que no puede haber dos veces es la
     * **lista**, y quien la copie probablemente le ponga otro nombre.
     *
     * Y se busca con `grep -r` sobre el disco y no con `git grep`, que fue el
     * primer intento: `git grep` solo mira el índice, así que un archivo nuevo
     * **todavía sin agregar** —justo el estado en el que está una copia recién
     * escrita— es invisible para él. El guarda daba verde exactamente en el
     * momento en que tenía que hablar.
     *
     * **Y no se busca `'enero'` con las comillas puestas, que fue el segundo
     * intento y tenía el mismo agujero con otra cara.** El patrón literal
     * `'enero'` obliga a que la copia esté escrita con comillas simples, o sea
     * que le pide a quien la escribe que ya haya pasado por Prettier — y el
     * estado que este guarda existe para agarrar es justo el anterior, el
     * archivo recién tipeado y todavía sin formatear. Una copia con comillas
     * dobles pasaba en verde; el caso de abajo lo fija. Por eso la comilla es una
     * clase (`"`, `'`, backtick) y hay una segunda alternativa para la copia
     * que no es una lista sino un mapa (`{ enero: 1, … }`): es el mismo dato
     * con otra forma, y divergir es lo mismo de caro.
     */
    const apariciones = execFileSync(
      'grep',
      [
        '-rlE',
        '--exclude-dir=node_modules',
        PATRON_COPIA,
        'src',
        'functions',
        'scripts',
      ],
      { cwd: RAIZ, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort();

    expect(apariciones).toEqual(['src/lib/meses.ts']);
  });

  it('y el patrón agarra la copia con cualquier comilla, sin morder la prosa', () => {
    /*
     * **La mitad que hace honesto al caso de arriba.** Ese caso pasa de dos
     * maneras: porque no hay ninguna copia, o porque el patrón no la ve. Lo
     * segundo ya pasó una vez —el patrón literal `'enero'` dejaba entrar la
     * copia con comillas dobles— y desde el lado de la lista de archivos las
     * dos se leen igual: verde.
     *
     * Las cuatro primeras son la misma lista escrita por cuatro personas
     * distintas. La última es el control negativo, y es lo que impide
     * «arreglar» esto ensanchando el patrón a `enero` pelado: la palabra vive
     * en la prosa de media docena de docblocks del repo (`fechasPublicas.ts`,
     * `listadoPublico.ts`, `detallePublico.ts`), y una guarda que se pone roja
     * por un comentario se termina borrando.
     */
    const patron = new RegExp(PATRON_COPIA);

    for (const copia of [
      "const MESES = ['enero', 'febrero',",
      'const MESES = ["enero", "febrero",',
      'const MESES = [`enero`, `febrero`,',
      'const NUMERO_DE_MES = { enero: 1, febrero: 2 };',
    ]) {
      expect(patron.test(copia), copia).toBe(true);
    }

    for (const prosa of [
      ' * rueda a enero de 2027 en silencio, y el filtro se lleva otro mes.',
      ' * el taller de enero seguía publicando `availability: InStock`.',
    ]) {
      expect(patron.test(prosa), prosa).toBe(false);
    }
  });
});
