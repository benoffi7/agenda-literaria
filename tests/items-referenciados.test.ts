/**
 * El barrido de `B-nnn` citados sin entrada — B-1100.
 *
 * La red que `scripts/items-referenciados.mjs` anuncia en su propia salida. El
 * frente que escribió el script se cortó antes de escribirla, y durante unas
 * horas el script **afirmó una red que no existía**: 345 líneas que nada
 * ejecutaba nunca. Que un barrido exista no es que corra.
 *
 * ── Qué congela, y por qué se congela en vez de exigir cero ───────────────
 * Hoy hay **46 referencias huérfanas** y no se pueden cerrar escribiendo 46
 * entradas: la mayoría son cicatrices sin consecuencia, y una entrada inventada
 * es peor que un hueco — es la lección de `D-9` en B-910, donde la sexta
 * «huérfana» resultó ser `D-09` escrita sin el cero y escribirla habría sido
 * inventar una decisión para tapar un falso positivo.
 *
 * Así que la deuda de hoy queda congelada y lo que se persigue es la **nueva**:
 * una cita a un id que nadie escribió se pone roja en el commit que la
 * introduce, que es el único momento en que sale barato. Cerrar una de las
 * viejas también da rojo, y está bien: hay que sacarla de la lista a mano, que
 * es la forma de que la lista solo baje.
 */
import { describe, expect, it } from 'vitest';
import { huerfanos, itemsEscritos, itemsDeFilaEnNegrita, relevar } from '../scripts/items-referenciados.mjs';

/**
 * Citadas **desde el código** — un comentario de `firestore.rules`, el nombre
 * de un `describe()`, un docblock. Son las caras: el comentario explica el
 * porqué de una línea y manda a buscar un ítem que nadie escribió.
 *
 * Las tres que más duelen, para que la lista no se lea como ruido parejo:
 * **B-919** (45 archivos, `firestore.rules` incluido, con su decisión D-690 y su
 * commit `ef33665`, mientras B-920 y B-921 arrancan citándolo), **B-700 a
 * B-706** (la pestaña «Estado del catálogo» entera) y **B-302** (citado en tres
 * archivos de código mientras la cabecera del backlog lo cuenta dentro de un
 * hueco donde «no se borró nada»).
 */
const HUERFANOS_DESDE_CODIGO = [
  'B-135', 'B-136', 'B-139', 'B-228', 'B-229', 'B-230', 'B-245', 'B-246',
  'B-247', 'B-249', 'B-254', 'B-256', 'B-257', 'B-258', 'B-259', 'B-262',
  'B-302', 'B-330', 'B-331', 'B-482', 'B-561', 'B-562', 'B-590', 'B-650',
  'B-654', 'B-660', 'B-661', 'B-662', 'B-700', 'B-701', 'B-702', 'B-703',
  'B-704', 'B-705', 'B-706', 'B-750', 'B-903a', 'B-919', 'B-924', 'B-999',
];

/** Citadas solo desde prosa. Casi todas de la tabla «se arregló sin ítem». */
const HUERFANOS_DESDE_PROSA = ['B-138', 'B-226', 'B-248', 'B-368', 'B-732', 'B-831b'];

const CONGELADOS = [...HUERFANOS_DESDE_CODIGO, ...HUERFANOS_DESDE_PROSA].sort();

describe('las referencias a ítems del backlog — B-1100', () => {
  const { sueltos } = relevar();

  it('no nació ninguna huérfana nueva', () => {
    const nuevas = sueltos.map((s) => s.item).filter((i) => !CONGELADOS.includes(i));
    expect(
      nuevas,
      'Citaste un `B-` que no tiene entrada en docs/BACKLOG.md ni en ' +
        'docs/BACKLOG-cerrados.md. El id es la dirección de un ítem: sin entrada ' +
        'se lee como una dirección válida y no lleva a ninguna parte. Escribí el ' +
        'ítem, o corregí la cita.',
    ).toEqual([]);
  });

  it('las viejas siguen ahí, y si cerraste una hay que sacarla de la lista', () => {
    const cerradas = CONGELADOS.filter((i) => !sueltos.some((s) => s.item === i));
    expect(
      cerradas,
      'Estas dejaron de ser huérfanas — sacalas de la lista congelada de este ' +
        'archivo. La lista solo puede bajar.',
    ).toEqual([]);
  });

  it('la mayoría se cita desde el código, que es el caso caro', () => {
    const desdeCodigo = sueltos.filter((s) => s.desdeCodigo.length > 0);
    expect(desdeCodigo.length).toBeGreaterThan(sueltos.length / 2);
  });
});

/**
 * Los controles positivos, con el lector inyectado para no depender del disco.
 *
 * **Sin esto el barrido queda verde por no buscar nada**, que es la clase de
 * B-873 y lo que este repo persigue. Cada caso ejercita una de las cuatro formas
 * reales de estar escrito: si alguna dejara de reconocerse, el barrido
 * empezaría a reportar como huérfanos ítems que sí existen — y el ruido lo
 * volvería inservible, que es la otra manera de que un chequeo muera.
 */
describe('el mecanismo — las cuatro formas de estar escrito', () => {
  it('reconoce un encabezado propio', () => {
    expect(itemsEscritos('### B-42 · lo que sea · P2\n')).toContain('B-42');
  });

  it('reconoce un encabezado de rango, con los números del medio', () => {
    const vistos = itemsEscritos('### B-830 a B-839 · los cuatro formularios · P1\n');
    expect(vistos).toEqual(expect.arrayContaining(['B-830', 'B-834', 'B-839']));
    expect(vistos).not.toContain('B-840');
  });

  it('reconoce una fila de tabla con el id en negrita', () => {
    expect(itemsDeFilaEnNegrita('| **B-1021** · algo que pasó | con su causa |\n')).toContain(
      'B-1021',
    );
  });

  it('una cita sin entrada sale por huérfana, y una con entrada no', () => {
    const textos = {
      'src/lib/cualquiera.ts': '// el motivo está en B-77 y en B-99999\n',
    };
    const sueltos = huerfanos(textos, new Set(['B-77']));
    expect(sueltos.map((s) => s.item)).toEqual(['B-99999']);
    expect(sueltos[0].desdeCodigo).toEqual(['src/lib/cualquiera.ts']);
  });

  it('una cita en prosa no se cuenta como cita desde el código', () => {
    const sueltos = huerfanos({ 'docs/algo.md': 'ver B-99999' }, new Set());
    expect(sueltos[0].desdeCodigo).toEqual([]);
  });
});
