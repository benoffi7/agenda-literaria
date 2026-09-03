import { describe, expect, it } from 'vitest';
import {
  SLUG_RESTO,
  TOPE_DE_TORTA,
  agruparCola,
  arcosDeTorta,
  colorDeTajada,
  porcentajeLegible,
  sumaDeTajadas,
} from '@/lib/tortaDelPanel';
import { colorDeTipo } from '@/lib/identidad';
import type { Tajada } from '@/lib/estadoDelCatalogo';

/**
 * La torta del tablero, dibujada a mano — B-700, D-401.
 *
 * Lo que este archivo fija son las tres cosas que hacen que una torta a mano no
 * mienta, y que ninguna se puede ver mirando la pantalla:
 *
 * 1. **Que cierre.** Las cuñas tienen que cubrir 360° exactos, siempre. Una
 *    torta que cierra en 358° tiene una rendija que nadie ve y una que cierra en
 *    370° dibuja una cuña encima de otra — las dos se leen como una torta.
 * 2. **Que la de una sola tajada se llene.** Es el caso que rompe la fórmula
 *    general (un arco de un punto a sí mismo no dibuja nada) y es el más
 *    frecuente en un catálogo chico.
 * 3. **Que agrupar la cola conserve la suma.** Si «el resto» no suma lo que
 *    junta, la torta cierra igual pero cada porcentaje queda corrido.
 */

const t = (valor: string, cantidad: number): Tajada => ({ valor, cantidad });

/** Los grados que cubre una lista de arcos. La afirmación central del archivo. */
const gradosCubiertos = (arcos: { desde: number; hasta: number }[]): number =>
  arcos.reduce((suma, a) => suma + (a.hasta - a.desde), 0);

describe('el todo de la torta es la suma de sus tajadas (D-401)', () => {
  it('`sumaDeTajadas` suma lo que se dibuja, no lo que le pasen', () => {
    expect(sumaDeTajadas([t('taller', 3), t('charla', 2)])).toBe(5);
    expect(sumaDeTajadas([])).toBe(0);
  });

  it('un reparto que cuenta doble cierra igual en 360°', () => {
    /*
     * El caso que motiva la regla: `porModalidad` cuenta cada actividad en cada
     * forma que ofrece (B-224), así que 40 actividades pueden dar 47 tajadas.
     * Sobre un total de 40, esto dibujaría 117 % de circunferencia; sobre la
     * suma, cierra. Lo que queda del lado de quien pinta es **decir** que el
     * todo son 47 formas y no 40 actividades.
     */
    const arcos = arcosDeTorta(agruparCola([t('presencial', 30), t('virtual', 17)]));
    expect(gradosCubiertos(arcos)).toBe(360);
  });
});

describe('los arcos', () => {
  it('cubren exactamente 360°, con cualquier reparto', () => {
    const repartos: Tajada[][] = [
      [t('a', 1)],
      [t('a', 1), t('b', 1)],
      [t('a', 1), t('b', 1), t('c', 1)], // tres tercios: el que deja 359,99…
      [t('a', 7), t('b', 1), t('c', 1), t('d', 1)],
      [t('a', 100), t('b', 1)],
    ];
    for (const reparto of repartos) {
      const arcos = arcosDeTorta(agruparCola(reparto));
      expect(gradosCubiertos(arcos), JSON.stringify(reparto)).toBe(360);
    }
  });

  it('arrancan a las 12 y giran en el sentido del reloj', () => {
    // Sin el `-90`, la trigonometría arranca a las 3: la primera cuña de un
    // cuarto saldría del lado derecho y la torta se leería rotada.
    //
    // Cuatro tajadas iguales para que la primera sea un cuarto exacto: con dos
    // de distinto tamaño, `agruparCola` pone la grande adelante y el caso ya no
    // mediría un cuarto.
    const [primero] = arcosDeTorta(agruparCola([t('a', 1), t('b', 1), t('c', 1), t('d', 1)]));
    expect(primero!.desde).toBe(0);
    expect(primero!.hasta).toBe(90);
    // Punto de arranque: arriba del todo (50, 0). Punto de cierre: a la derecha.
    expect(primero!.d).toContain('L 50 0');
    expect(primero!.d).toContain('100 50');
  });

  it('la torta de una sola tajada se llena, no desaparece', () => {
    /*
     * El bug que este caso ataja: con `desde === 0` y `hasta === 360` los dos
     * extremos del arco son el mismo punto, y un arco de un punto a sí mismo
     * dibuja **nada**. Un catálogo con un solo tipo de actividad —lo normal al
     * empezar— vería el gráfico vacío y el número al lado diciendo 100 %.
     */
    const arcos = arcosDeTorta(agruparCola([t('taller', 9)]));
    expect(arcos).toHaveLength(1);
    expect(arcos[0]!.hasta - arcos[0]!.desde).toBe(360);
    // Dos medias vueltas, no una cuña: el `d` no pasa por el centro.
    expect(arcos[0]!.d).not.toContain('M 50 50');
    expect(arcos[0]!.d.match(/A /g)).toHaveLength(2);
  });

  it('una cuña de más de media torta lleva el flag de arco grande', () => {
    // Sin él, SVG la dibuja por el lado corto: se ve el complemento en vez de
    // la tajada, o sea el gráfico exactamente al revés.
    const [grande, chica] = arcosDeTorta(agruparCola([t('a', 3), t('b', 1)]));
    expect(grande!.d).toMatch(/A 50 50 0 1 1/);
    expect(chica!.d).toMatch(/A 50 50 0 0 1/);
  });

  it('sin nada que repartir no hay arcos, y no hay error', () => {
    expect(arcosDeTorta([])).toEqual([]);
    expect(arcosDeTorta(agruparCola([t('a', 0), t('b', 0)]))).toEqual([]);
  });

  it('las tajadas en cero se descartan en vez de dibujar cuñas de 0°', () => {
    // `repartirFijo` devuelve el vocabulario entero, así que llegan ceros. Un
    // `path` invisible por cada estado vacío ensucia el DOM y no se ve.
    const arcos = arcosDeTorta(agruparCola([t('publicado', 4), t('cancelado', 0)]));
    expect(arcos.map((a) => a.valor)).toEqual(['publicado']);
  });
});

describe('agrupar la cola (`agruparCola`)', () => {
  const muchos = Array.from({ length: 12 }, (_, i) => t(`barrio-${i}`, 12 - i));

  it('con pocas categorías no agrupa nada', () => {
    const pocas = muchos.slice(0, TOPE_DE_TORTA);
    expect(agruparCola(pocas).map((x) => x.valor)).toEqual(pocas.map((x) => x.valor));
  });

  it('con una sola de más tampoco: esconder un nombre no compra legibilidad', () => {
    /*
     * El caso de borde que más se da —un catálogo chico tiene seis barrios, no
     * veinte—. Juntar la última en «el resto» le saca el nombre y deja la misma
     * cantidad de cuñas: pura pérdida.
     */
    const justas = muchos.slice(0, TOPE_DE_TORTA + 1);
    expect(agruparCola(justas)).toHaveLength(TOPE_DE_TORTA + 1);
    expect(agruparCola(justas).some((x) => x.valor === SLUG_RESTO)).toBe(false);
  });

  it('con muchas deja las primeras y junta el resto', () => {
    const agrupadas = agruparCola(muchos);
    expect(agrupadas).toHaveLength(TOPE_DE_TORTA + 1);
    const resto = agrupadas.at(-1)!;
    expect(resto.valor).toBe(SLUG_RESTO);
    expect(resto.agrupa).toBe(muchos.length - TOPE_DE_TORTA);
  });

  it('y la suma se conserva: es lo que deja los porcentajes derechos', () => {
    // Si «el resto» no sumara lo que junta, la torta cerraría igual (los ángulos
    // se calculan sobre lo que hay) y **todos** los porcentajes saldrían
    // corridos, que es la peor forma de fallar: nada se ve roto.
    expect(sumaDeTajadas(agruparCola(muchos))).toBe(sumaDeTajadas(muchos));
  });

  it('una tajada normal declara que se representa a sí misma', () => {
    expect(agruparCola([t('a', 1)])[0]!.agrupa).toBe(1);
  });

  it('ordena por cantidad aunque le llegue en el orden del vocabulario', () => {
    /*
     * El hallazgo del `auditor-trampas`. `repartirFijo` —el de `porEstado` y
     * `porModalidad`— devuelve el vocabulario **en su orden**, no por magnitud,
     * así que la vieja precondición «esperá que venga ordenado» era falsa para
     * la mitad de los repartos del tablero. Sin ordenar acá, «el resto» juntaría
     * lo último del vocabulario en vez de lo más chico, la torta cerraría igual
     * en 360° y nadie se enteraría.
     *
     * Se prueba con siete —el primer largo en el que el corte actúa— porque con
     * los cuatro estados que hay hoy la rama ni se toca: es un bug latente, y
     * este caso es la red que lo espera.
     */
    const enOrdenDeVocabulario = [
      t('borrador', 1),
      t('pendiente', 2),
      t('publicado', 40),
      t('cancelado', 3),
      t('archivado', 4),
      t('revision', 5),
      t('pausado', 6),
    ];
    const agrupadas = agruparCola(enOrdenDeVocabulario);
    expect(agrupadas.map((x) => x.valor)).toEqual([
      'publicado',
      'pausado',
      'revision',
      'archivado',
      'cancelado',
      SLUG_RESTO,
    ]);
    // «El resto» junta las dos más chicas, que es lo que tiene que juntar.
    expect(agrupadas.at(-1)).toMatchObject({ cantidad: 3, agrupa: 2 });
    expect(sumaDeTajadas(agrupadas)).toBe(sumaDeTajadas(enOrdenDeVocabulario));
  });

  it('desempata alfabético: la torta no se reordena sola entre dos recargas', () => {
    // Sin desempate, dos categorías con la misma cantidad quedan en el orden en
    // que llegaron, que no está garantizado. Mismo criterio que `repartir`.
    expect(agruparCola([t('zeta', 2), t('alfa', 2), t('beta', 2)]).map((x) => x.valor)).toEqual([
      'alfa',
      'beta',
      'zeta',
    ]);
  });

  it('no toca la lista que recibe: la vista de lista conserva su propio orden', () => {
    const original = [t('borrador', 1), t('publicado', 9)];
    agruparCola(original);
    expect(original.map((x) => x.valor)).toEqual(['borrador', 'publicado']);
  });
});

describe('el porcentaje como se escribe', () => {
  it('redondea', () => {
    expect(porcentajeLegible(1, 3)).toBe('33 %');
    expect(porcentajeLegible(2, 3)).toBe('67 %');
    expect(porcentajeLegible(4, 4)).toBe('100 %');
  });

  it('una categoría que existe nunca se escribe «0 %»', () => {
    /*
     * Con 200 actividades y un barrio de 1, el redondeo da 0 y la pantalla
     * afirmaría que ese barrio no tiene ninguna — al lado del «1» que dice que
     * sí. Es la misma familia que «sin comparación todavía» ≠ «0 %».
     */
    expect(porcentajeLegible(1, 200)).toBe('<1 %');
    expect(porcentajeLegible(1, 101)).toBe('<1 %');
  });

  it('el cero de verdad sí, y un total en cero no rompe', () => {
    expect(porcentajeLegible(0, 10)).toBe('0 %');
    expect(porcentajeLegible(0, 0)).toBe('0 %');
    expect(porcentajeLegible(3, 0)).toBe('0 %');
  });
});

describe('el color de una tajada sale del sistema, no de una paleta nueva (D-150)', () => {
  it('es exactamente el que el sitio público le pone a esa categoría', () => {
    /*
     * La atadura que importa: el tablero y el listado del sitio pintan «taller»
     * con el mismo color porque llaman a la misma función, no porque alguien
     * copió un hex. Si esto se rompiera, el panel diría una identidad y el sitio
     * otra para el mismo slug.
     */
    expect(colorDeTajada('taller')).toBe(colorDeTipo('taller'));
    expect(colorDeTajada('club-lectura')).toBe(colorDeTipo('club-lectura'));
  });

  it('respeta el matiz elegido a mano desde Opciones', () => {
    expect(colorDeTajada('taller', { taller: 200 })).toBe(colorDeTipo('taller', 200));
  });

  it('«el resto» va con una tinta con nombre, no con un matiz derivado', () => {
    // No es una categoría: es la ausencia de una. Un matiz derivado la haría
    // parecer una más, y además `__resto__` no es un slug que exista.
    expect(colorDeTajada(SLUG_RESTO)).toBe('var(--color-super)');
  });

  it('un slug desconocido igual tiene color: el default es derivar, no descartar', () => {
    expect(colorDeTajada('barrio-inventado')).toMatch(/^oklch\(/);
  });
});
