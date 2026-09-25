/**
 * Salida 10: `/pasadas` (B-109).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import { cuentaDePasadas, frasesDePasadas, pasadasDelSitio } from '@/lib/pasadasPublicas';
import { actividadCentinela } from '../fixtures/centinelas';
import { barrer } from '../fixtures/barrido';

describe('barrido de `/pasadas` (§5, salida 10, B-109)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, como la 7 y la 8.
   *
   * De la página, las filas las pinta `FilaDeActividad` con los campos que ya
   * barre el índice del listado y que fija por lista blanca
   * `tests/listado-del-sitio.test.ts`. Lo **nuevo** de esta salida son sus cuatro
   * frases (`pasadasPublicas.ts`), y la propiedad que se afirma acá es más fuerte
   * que la de la salida 8: **ninguna interpola un dato de una actividad**.
   *
   * Por eso la lista de permitidos está **vacía**, y eso es el aserto: la
   * `meta description` de la página de mes mete tres títulos —y por eso su
   * barrido los permite—; acá no entra ni uno. Si mañana alguien agrega «Lo que
   * ya pasó: Taller de crónica, Club de lectura…», este `describe` lo dice y hay
   * que decidirlo.
   *
   * Y el barrido puede afirmarlo porque `frasesDePasadas` **recibe las
   * entradas**: la función que arma el texto tiene los datos a mano y no los usa,
   * así que meter un título adentro es una línea y el barrido la ve sin que haya
   * que tocar este archivo. Con las frases sueltas y sin datos, la interpolación
   * se agregaría por un parámetro nuevo y el barrido no vería nada.
   *
   * MUTACIÓN PROBADA: interpolar `pasadas[0]?.titulo` en la `descripcion` de
   * `frasesDePasadas` hace fallar este `it` nombrando el centinela del título.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  const entradas = () =>
    ['act_pasada_1', 'act_pasada_2'].map((id) =>
      entradaDeIndice(toPublic(actividadCentinela(), id)),
    );

  /**
   * El texto que esta salida agrega, y nada más: sus frases y el contador.
   *
   * El contador entra desde **B-292**: es texto que la página muestra y lo arma
   * `cuentaDePasadas`, no la island — que es lo que lo deja adentro de este
   * barrido. Armado con un template en el componente, quedaría afuera.
   */
  const textoDeLaPagina = (): string => {
    const pasadas = pasadasDelSitio(entradas(), AHORA);
    const conPasadas = frasesDePasadas(pasadas);
    const vacia = frasesDePasadas([]);
    return [
      ...Object.values(conPasadas),
      ...Object.values(vacia),
      cuentaDePasadas(pasadas.length, pasadas.length),
      cuentaDePasadas(1, pasadas.length),
      cuentaDePasadas(0, 0),
    ].join(' | ');
  };

  it('control positivo: hay texto que barrer', () => {
    expect(textoDeLaPagina().length).toBeGreaterThan(120);
  });

  it('ninguna frase de la página publica un dato de una actividad', () => {
    barrer('/pasadas', textoDeLaPagina(), [], { insensible: true });
  });

  it('y lo que entra a la lista es la misma entrada del índice, sin un campo más', () => {
    /*
     * La afirmación de **forma**, igual que en la salida 8: esta página deriva de
     * la 1 y por construcción solo puede sacar. Si algún día alguien le pasa el
     * documento en vez de la entrada del índice, las claves dejan de coincidir.
     */
    const conFechaVieja = entradaDeIndice(toPublic(actividadCentinela(), 'act_pasada_vieja'));
    const [enLaPagina] = pasadasDelSitio([conFechaVieja], new Date('2030-01-01T00:00:00Z'));
    expect(enLaPagina, 'el fixture dejó de producir una pasada').toBeDefined();
    expect(Object.keys(enLaPagina!).sort()).toEqual(Object.keys(conFechaVieja).sort());
  });
});
