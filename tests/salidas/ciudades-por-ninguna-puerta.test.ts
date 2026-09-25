/**
 * `ciudades` no sale por ninguna puerta (B-919).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { construirIndice } from '@/lib/eventsJson';
import { buildSearchText } from '@/lib/normalize';
import { construirEvento } from '../../functions/calendario.js';
import { CENTINELA, LABELS_CENTINELA, actividadCentinela, opcionCentinela } from '../fixtures/centinelas';

describe('`ciudades` no sale por ninguna puerta — B-919', () => {
  /**
   * **El campo que existe para una regla, no para una pantalla.**
   *
   * `ciudades` es el derivado con el que `firestore.rules` contesta el alcance
   * por ciudad del rol `publicador` (D-690). No tiene que salir a ninguna salida
   * pública, y no sale porque `toPublic` es una whitelist.
   *
   * ── Esto se anclaba por valor y con B-950 dejó de poder ───────────────────
   * La versión anterior buscaba el **valor** (`centinela-sede-ciudad`) en las
   * cuatro salidas, con el argumento —correcto— de que para un campo que no
   * tiene que salir, un valor que nunca aparece *es* la aserción. Ese argumento
   * dependía de que el valor no se publicara por ningún otro camino: era
   * `slugify` de la ciudad, y la ciudad se publicaba **como se tipeó**.
   *
   * B-950 convirtió `ciudad` en taxonomía, así que la proyección publica el
   * slug — y el slug de la ciudad es, literalmente, el contenido de
   * `ciudades[]`. O sea que **ya no existe ningún valor que `ciudades` pueda
   * llevar y que no esté publicado**: se deriva entero de datos que sí salen.
   * Buscarlo ahora daría rojo siempre, y peor todavía, esconderlo con una
   * excepción dejaría el caso verde sin afirmar nada.
   *
   * Lo que queda es el ancla por **clave**, que es más débil pero es honesta y
   * sigue atrapando la mutación que importa. Queda anotado como B-965: si algún
   * día `ciudades` deja de derivarse de lo publicado, el ancla por valor vuelve.
   *
   * MUTACIÓN PROBADA: agregar `ciudades` a la lista de `pick` de `toPublic` deja
   * el primer `expect` en rojo nombrando la clave.
   */
  const claves = (json: string): string[] => Object.keys(JSON.parse(json) as object);

  /**
   * **El elemento que no se deriva de nada** — B-965.
   *
   * `ciudades[0]` es el slug de la ciudad de la sede, y desde B-950 **se
   * publica**: es lo que `sede.ciudad` lleva. Así que ése no puede anclar nada.
   * `ciudades[1]` es un centinela propio, o sea un texto que ninguna salida
   * pública puede contener nunca — y eso, para un campo que no tiene que salir,
   * **es** la aserción, igual que con `difusion.notas`.
   *
   * Se lee del fixture y no se escribe acá: si el fixture dejara de traerlo, el
   * control positivo de abajo lo dice en vez de pasar buscando `undefined`.
   */
  const EXTRA = actividadCentinela().ciudades![1]!;

  it('el contenido de `ciudades` no aparece en la proyección, el índice, el detalle ni el evento', () => {
    // Control positivo del propio caso: sin esto, los cuatro `not.toContain`
    // pasarían buscando una cadena vacía.
    expect(EXTRA).toBe(CENTINELA['ciudades.extra']);

    const publica = toPublic(actividadCentinela(), 'act_centinela');
    expect(JSON.stringify(publica)).not.toContain(EXTRA);

    const indice = construirIndice({
      actividades: [publica],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    expect(JSON.stringify(indice)).not.toContain(EXTRA);

    const actividad = actividadCentinela();
    expect(
      JSON.stringify(construirEvento(actividad, actividad.sesiones[0], LABELS_CENTINELA)),
    ).not.toContain(EXTRA);

    expect(buildSearchText(actividad)).not.toContain(EXTRA);
  });

  /**
   * Y el ancla por **clave**, que es la que atrapa la mutación más plausible:
   * alguien agrega `ciudades` al `pick` de `toPublic` «para que el sitio pueda
   * filtrar por ciudad». Ahí el valor derivado saldría igual —ya sale adentro de
   * `sede`— así que el caso de arriba no lo vería solo.
   *
   * Las dos mitades son necesarias y ninguna sobra: la de valor cubre una fuga
   * que publique el **contenido** sin la clave (interpolado en un texto), la de
   * clave cubre la que publique la clave con contenido que ya era público.
   *
   * MUTACIÓN PROBADA: agregar `ciudades` al `pick` de `toPublic` deja este caso
   * en rojo y el de arriba verde.
   */
  it('y la clave `ciudades` tampoco está en ninguna de las cuatro', () => {
    const publica = toPublic(actividadCentinela(), 'act_centinela');
    expect(Object.keys(publica).length).toBeGreaterThan(5);
    expect(Object.keys(publica)).not.toContain('ciudades');

    const indice = construirIndice({
      actividades: [publica],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    for (const entrada of indice.actividades) {
      expect(Object.keys(entrada)).not.toContain('ciudades');
    }

    const actividad = actividadCentinela();
    expect(
      claves(JSON.stringify(construirEvento(actividad, actividad.sesiones[0], LABELS_CENTINELA))),
    ).not.toContain('ciudades');
  });
});
