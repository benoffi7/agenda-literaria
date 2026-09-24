/**
 * El barrido de estados que un documento afirma y el backlog desmiente — B-1170.
 *
 * La red que `scripts/estados-referenciados.mjs` anuncia en su propia salida.
 *
 * ── Qué congela, y por qué se congela en vez de exigir cero ───────────────
 * Hoy hay **una** sola contradicción y no se puede cerrar desde acá: se arregla
 * en `docs/BACKLOG.md`, que en una tanda en paralelo lo escribe quien integra.
 * Así que la deuda de hoy queda congelada y lo que se persigue es la **nueva**:
 * una fila que afirme un estado falso se pone roja en el commit que la
 * introduce, que es el único momento en que sale barato. Es el mismo patrón que
 * `tests/items-referenciados.test.ts` dejó para los ids huérfanos (B-1100), y
 * por el mismo motivo.
 *
 * Cerrar una vieja **también da rojo**, y está bien: hay que sacarla de la
 * lista a mano, que es la forma de que la lista solo baje.
 *
 * ── Una sola, y eso no es que sobre ───────────────────────────────────────
 * Cuando esto se escribió, el barrido encontraba **cinco**: las cuatro del caso
 * que abrió B-1170 —`docs/16-analitica-del-sitio.md` llamando «⛔ bloqueado por
 * B-480» a algo resuelto diecinueve días antes— más la de B-481. Las cuatro
 * primeras las arregló a mano el frente de B-1085 mientras tanto, y por eso ya
 * no están: el barrido las vio en el árbol donde todavía existían y dejó de
 * verlas en el árbol donde se corrigieron. **Esa es la medición de que mira
 * donde dice mirar**, que es lo que B-1113, B-1129 y B-1111 enseñaron a exigir.
 * La que queda es la que nadie había visto.
 *
 * ── Y por qué no alcanza con «el barrido corre y no explota» ──────────────
 * Porque un chequeo puede estar verde **por mirar el lugar equivocado**, y este
 * repo ya lo pagó tres veces (B-1113, B-1129, B-1111). Así que los controles
 * positivos de abajo **plantan una contradicción sintética y exigen que el
 * barrido la nombre, con archivo y línea**. Es D-750. Y desde B-1222 el
 * vocabulario de emojis no es de este barrido: lo compone `parseo.mjs`, y lo
 * que se vigila acá es que siga sin haber un mapa propio.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as barrido from '../scripts/estados-referenciados.mjs';
import {
  afirmacionDeFila,
  afirmacionesDe,
  celdasDe,
  contradicciones,
  estadosDelRegistro,
  idsDelEncabezado,
  relevar,
  seBarre,
} from '../scripts/estados-referenciados.mjs';
import { REGISTROS } from '../scripts/items-referenciados.mjs';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { ESTADO_DE_EMOJI, ESTADO_DE_EMOJI_EN_TABLA } from '../scripts/tablero/parseo.mjs';

/** La huella estable de una contradicción: dónde vive y de qué ítem habla. */
const huella = (c: { archivo: string; item: string }): string => `${c.archivo} · ${c.item}`;

/**
 * **El documento se quedó atrás**: dice bloqueado/a medias, el backlog dice
 * cerrado. **Está vacía, y se deja escrita igual.**
 *
 * Es la dirección del caso que abrió B-1170 —`B-480` resuelto el 2026-09-03 y
 * llamado bloqueante durante diecinueve días, con `B-372` arrastrado atrás— y
 * hoy está en cero porque el frente de B-1085 corrigió esas filas a mano. La
 * lista se deja declarada y vacía a propósito: sin ella, el día que aparezca la
 * primera de esta dirección habría que decidir en caliente dónde anotarla, y la
 * decisión fácil es borrar el caso.
 */
const ATRASADAS_CONGELADAS: string[] = [];

/**
 * **El documento va adelante**: dice hecho, el backlog lo tiene abierto.
 *
 * Una sola, y la encontró este barrido al escribirse: **B-481** está hecho
 * —las tipografías se sirven desde `public/fuentes/` desde el 2026-09-03,
 * D-340, y `src/layouts/Base.astro` ya no toca `fonts.googleapis.com`— y la
 * fila de `docs/BACKLOG.md` sigue diciendo `🔵 futuro`.
 *
 * **Es el caso caro de los dos**, porque el que miente es el registro: quien
 * busque trabajo en el backlog puede rehacer algo que ya está. Sobrevive a la
 * integración de esta tanda: se cierra marcando el ítem en `docs/BACKLOG.md`.
 */
const ADELANTADAS_CONGELADAS: string[] = [];

describe('los estados que el repo afirma de un ítem — B-1170', () => {
  const { atrasadas, adelantadas } = relevar();

  it('no nació ninguna contradicción nueva', () => {
    const nuevas = [
      ...atrasadas.map(huella).filter((h) => !ATRASADAS_CONGELADAS.includes(h)),
      ...adelantadas.map(huella).filter((h) => !ADELANTADAS_CONGELADAS.includes(h)),
    ];
    expect(
      [...new Set(nuevas)],
      'Afirmaste el estado de un `B-` y el backlog dice otra cosa. El id existe y ' +
        'la entrada existe: lo único falso es el estado, que es lo que alguien lee ' +
        'para decidir qué hacer esta semana. Corregí la fila, o marcá el ítem en el ' +
        'backlog — y mirá las filas de al lado, que una redacción vieja se copia.',
    ).toEqual([]);
  });

  it('las viejas siguen ahí, y si cerraste una hay que sacarla de la lista', () => {
    const cerradas = [
      ...ATRASADAS_CONGELADAS.filter((h) => !atrasadas.map(huella).includes(h)),
      ...ADELANTADAS_CONGELADAS.filter((h) => !adelantadas.map(huella).includes(h)),
    ];
    expect(
      cerradas,
      'Estas dejaron de contradecirse — sacalas de la lista congelada de este ' +
        'archivo. La lista solo puede bajar, y este rojo es la única forma de que ' +
        'bajar quede escrito.',
    ).toEqual([]);
  });

  it('el barrido mira el repo entero y no solo los `.md`', () => {
    // La lección de B-1147, que es de hace un día: el gemelo de las `D-` miraba
    // 27 `.md` y el de los `B-` miraba todo. Este repo escribe tablas adentro de
    // docblocks, así que una columna de estado no es solo cosa de `docs/`.
    const { corpus } = relevar();
    expect(corpus.length).toBeGreaterThan(100);
    expect(corpus.some((a: string) => a.endsWith('.ts'))).toBe(true);
    expect(corpus.some((a: string) => a.endsWith('.mjs'))).toBe(true);
  });

  it('los dos backlogs quedan afuera del corpus: son el registro, no una cita', () => {
    for (const registro of REGISTROS) expect(seBarre(registro)).toBe(false);
    // Y el propio test queda afuera, porque planta contradicciones a propósito.
    expect(seBarre('tests/estados-referenciados.test.ts')).toBe(false);
  });
});

/**
 * **El control positivo que impide el verde por no mirar nada.**
 *
 * Cada caso planta una contradicción sintética con el lector inyectado —sin
 * disco— y exige que el barrido la nombre con archivo y línea. Sin esto, el
 * barrido podría estar verde por no reconocer ninguna forma, que es la clase de
 * B-873 y lo que este repo persigue.
 */
describe('el mecanismo — una contradicción plantada tiene que salir con archivo y línea', () => {
  const REGISTRO_FALSO = [
    '# Backlog',
    '',
    '## P2 — mejora real',
    '',
    '### B-80 · Lo que sea · P2 — ✅ hecho (2026-09-03)',
    '',
    'Cuerpo.',
    '',
    '### B-813 · Otra cosa · P2',
    '',
    'Cuerpo.',
    '',
  ].join('\n');

  const leerCon = (archivos: Record<string, string>) => (a: string) =>
    a === REGISTROS[0] ? REGISTRO_FALSO : a === REGISTROS[1] ? '' : archivos[a];

  it('una fila que dice bloqueado sobre un ítem hecho sale por atrasada', () => {
    const doc = ['# Doc', '', '| Ítem | Qué es | Estado |', '|---|---|---|', '| **B-80** | algo | ⛔ acción manual |', ''].join('\n');
    const { atrasadas, adelantadas } = relevar({
      archivos: ['docs/falso.md'],
      leer: leerCon({ 'docs/falso.md': doc }),
    });
    expect(adelantadas).toEqual([]);
    expect(atrasadas).toHaveLength(1);
    expect(atrasadas[0].archivo).toBe('docs/falso.md');
    expect(atrasadas[0].linea).toBe(5);
    expect(atrasadas[0].item).toBe('B-80');
    expect(atrasadas[0].real.estado).toBe('hecho');
  });

  it('la frase «bloqueado por» sobre un ítem hecho sale, y trae su línea', () => {
    const doc = ['# Doc', '', 'El tag ya está — **⛔ bloqueado por B-80** para medir.', ''].join('\n');
    const { atrasadas } = relevar({
      archivos: ['docs/falso.md'],
      leer: leerCon({ 'docs/falso.md': doc }),
    });
    expect(atrasadas).toHaveLength(1);
    expect(atrasadas[0].linea).toBe(3);
    expect(atrasadas[0].item).toBe('B-80');
    expect(atrasadas[0].forma).toBe('bloqueo');
  });

  it('una fila que dice hecho sobre un ítem abierto sale por adelantada', () => {
    const doc = ['| **B-813** | algo | ✅ hecho (2026-09-20) |', ''].join('\n');
    const { atrasadas, adelantadas } = relevar({
      archivos: ['docs/falso.md'],
      leer: leerCon({ 'docs/falso.md': doc }),
    });
    expect(atrasadas).toEqual([]);
    expect(adelantadas).toHaveLength(1);
    expect(adelantadas[0].item).toBe('B-813');
    expect(adelantadas[0].real.estado).toBe('abierto');
  });

  it('una fila que coincide con el backlog no sale', () => {
    const doc = ['| **B-80** | algo | ✅ hecho |', '| **B-813** | otra | 🟡 a medias |', ''].join('\n');
    const { atrasadas, adelantadas } = relevar({
      archivos: ['docs/falso.md'],
      leer: leerCon({ 'docs/falso.md': doc }),
    });
    expect([...atrasadas, ...adelantadas]).toEqual([]);
  });

  it('la tabla adentro de un docblock cuenta igual que la de un `.md`', () => {
    const fuente = ['/**', ' * | **B-80** | algo | ⛔ acción manual |', ' */', 'export const x = 1;', ''].join('\n');
    const { atrasadas } = relevar({
      archivos: ['src/lib/falso.ts'],
      leer: leerCon({ 'src/lib/falso.ts': fuente }),
    });
    expect(atrasadas.map((c) => `${c.archivo}:${c.linea}`)).toEqual(['src/lib/falso.ts:2']);
  });
});

describe('el corte — qué se compara y qué no', () => {
  it('un hecho fechado en prosa no es una afirmación de estado', () => {
    // «✅ Construida el 2026-09-02 (B-109)» sigue siendo cierto para siempre,
    // pase lo que pase con B-109. Son 41 de las 60 coincidencias de «emoji cerca
    // de un id» del repo, y compararlas llenaría el informe de ruido.
    expect(afirmacionesDe('✅ **Construida el 2026-09-02 (B-109)** — el sitio ya…')).toEqual([]);
  });

  it('una fila que solo menciona el ítem en prosa no es su registro', () => {
    // `| 4 | **El tag de GA4** (**B-372**) | ✅ … |` es una fila sobre otra cosa.
    expect(afirmacionDeFila('| 4 | **El tag de GA4** (**B-372**) | ✅ hecho |')).toBeNull();
  });

  it('la comparación es binaria: `🟡` contra `⛔` no es una contradicción', () => {
    // El caso real: un documento dice `🟡 construida` de B-374 y el backlog dice
    // `⛔ depende de un mes de datos`. Las dos son ciertas — falta trabajo — y
    // comparar el emoji exacto daría un falso positivo el primer día.
    const estados = estadosDelRegistro({ 'docs/BACKLOG.md': '| **B-80** | x | ⛔ depende |' });
    const { atrasadas, adelantadas } = contradicciones(
      { 'docs/falso.md': afirmacionesDe('| **B-80** | x | 🟡 construida |') },
      estados,
    );
    expect([...atrasadas, ...adelantadas]).toEqual([]);
  });

  it('pero `🟡` sí se compara contra un ítem cerrado', () => {
    // Es la contradicción de B-372, y es verdadera. `🟡` no se excluye: lo que
    // se elige es contra qué se lo compara.
    const estados = estadosDelRegistro({ 'docs/BACKLOG.md': '### B-80 · x · P2 — ✅ hecho (2026-09-03)' });
    const { atrasadas } = contradicciones(
      { 'docs/falso.md': afirmacionesDe('| **B-80** | x | 🟡 a medias |') },
      estados,
    );
    expect(atrasadas.map((c) => c.item)).toEqual(['B-80']);
  });

  it('un ítem del que el registro no dice nada se cuenta y no se reporta', () => {
    const { atrasadas, adelantadas, sinEstado } = contradicciones(
      { 'docs/falso.md': afirmacionesDe('| **B-80** | x | ⛔ bloqueado |') },
      estadosDelRegistro({ 'docs/BACKLOG.md': '' }),
    );
    expect([...atrasadas, ...adelantadas]).toEqual([]);
    expect(sinEstado).toBe(1);
  });
});

describe('el registro — de dónde sale el estado de verdad', () => {
  it('lo lee del encabezado del ítem', () => {
    const estados = estadosDelRegistro({
      'docs/BACKLOG.md': '### B-80 · Lo que sea · P2 — ✅ hecho (2026-09-03)',
    });
    expect(estados.get('B-80')?.estado).toBe('hecho');
    expect(estados.get('B-80')?.donde).toBe('docs/BACKLOG.md:1');
  });

  it('y de la fila en negrita, para los ítems que no tienen encabezado propio', () => {
    // Son 22 en el repo: los que viven adentro de un encabezado de rango.
    const estados = estadosDelRegistro({ 'docs/BACKLOG.md': '| **B-480** | apagar… | ✅ hecho (2026-09-03) |' });
    expect(estados.get('B-480')?.estado).toBe('hecho');
  });

  it('un encabezado de rango sin marcador no le pone estado a ninguno: manda la fila', () => {
    const texto = [
      '### B-370 a B-372 · La analítica · P2',
      '',
      '| **B-370** | paraguas | 🟡 a medias |',
      '| **B-371** | decisión | ✅ resuelto |',
      '',
    ].join('\n');
    const estados = estadosDelRegistro({ 'docs/BACKLOG.md': texto });
    expect(estados.get('B-370')?.estado).toBe('empezado');
    expect(estados.get('B-371')?.estado).toBe('hecho');
    // B-372 está dentro del rango y no tiene fila: el registro no dice nada.
    expect(estados.has('B-372')).toBe(false);
  });

  it('un encabezado que nombra dos ids **con** marcador se lo pone a los dos', () => {
    // `### B-772 / B-654 · ✅ hecho (2026-09-07) — …`, que existe tal cual.
    const estados = estadosDelRegistro({
      'docs/BACKLOG.md': '### B-772 / B-654 · ✅ hecho (2026-09-07) — las páginas de texto',
    });
    expect(estados.get('B-772')?.estado).toBe('hecho');
    expect(estados.get('B-654')?.estado).toBe('hecho');
  });

  it('los ids del título no se leen como definidos: solo los del prefijo', () => {
    // `### B-1132 · Un test … más débil que lo que B-1130 sacó — ✅ hecho`.
    // Leer B-1130 de ahí daría por cerrado un ítem que nadie cerró.
    expect(idsDelEncabezado('### B-1132 · más débil que lo que B-1130 sacó — ✅ hecho')).toEqual([
      'B-1132',
    ]);
  });

  it('el encabezado gana sobre la fila cuando los dos hablan del mismo ítem', () => {
    const texto = ['| **B-80** | viejo | ⛔ bloqueado |', '', '### B-80 · Lo que sea · P2 — ✅ hecho'].join('\n');
    expect(estadosDelRegistro({ 'docs/BACKLOG.md': texto }).get('B-80')?.estado).toBe('hecho');
  });
});

describe('las piezas sueltas', () => {
  it('parte una fila en celdas y devuelve `null` si no es una fila', () => {
    expect(celdasDe('| a | b |')).toEqual([' a ', ' b ']);
    expect(celdasDe('  * | a | b |')).toEqual([' a ', ' b ']);
    expect(celdasDe('> | a | b |')).toEqual([' a ', ' b ']);
    expect(celdasDe('texto | con pipe')).toBeNull();
  });
});

/**
 * **B-1222 — el mapa de emoji → estado es uno solo, y esto lo vigila.**
 *
 * Hasta el 2026-09-24 el barrido tenía su propio mapa, con siete emojis contra
 * los cinco de `scripts/tablero/parseo.mjs`, y la red era un caso que leía los
 * encabezados del backlog y exigía que el mapa los cubriera. Esa red tapaba el
 * síntoma: el día que un encabezado estrenara un emoji, el barrido dejaba de
 * reconocerlo y comparaba menos, en silencio. Ahora `parseo.mjs` exporta el de
 * encabezado y compone encima el de las tablas (`⛔`, `🔵`), y el barrido lo
 * importa.
 *
 * Lo que se verifica es **que siga sin haber copia**, leyendo el fuente, que es
 * el modelo de las fachadas (B-1180 en `tests/calendario.test.ts`): un mapa
 * propio que hoy dé el mismo resultado no rompe ningún test de comportamiento, y
 * justamente por eso es la clase de D-88.
 */
describe('el vocabulario de estado es uno solo (D-88, B-1222)', () => {
  const RUTA = fileURLToPath(new URL('../scripts/estados-referenciados.mjs', import.meta.url));

  it('el barrido importa el mapa de `parseo.mjs` y no escribe el suyo', () => {
    const fuente = readFileSync(RUTA, 'utf8');
    expect(fuente).toMatch(
      /import \{[^}]*\bESTADO_DE_EMOJI_EN_TABLA\b[^}]*\bESTADOS_EN_TABLA\b[^}]*\} from '\.\/tablero\/parseo\.mjs'/u,
    );
    /*
     * MUTACIÓN PROBADA: volver a pegar el mapa de siete —o agregarle un emoji
     * suelto— deja este caso en rojo. La señal es cualquier emoji en el código:
     * un mapa de emoji → estado no se puede escribir sin escribir un emoji, y el
     * barrido no necesita ninguno fuera de los comentarios. Se busca sin
     * comentarios para que el docblock pueda seguir nombrándolos.
     */
    const emojis = sinComentarios(fuente).match(/\p{Extended_Pictographic}/gu) ?? [];
    expect(
      emojis,
      'estados-referenciados.mjs volvió a escribir emojis de estado. El vocabulario ' +
        'vive en scripts/tablero/parseo.mjs: si las tablas necesitan uno más, ' +
        'componelo ahí, en ESTADO_DE_EMOJI_EN_TABLA.',
    ).toEqual([]);
  });

  it('y ya no exporta un mapa propio que alguien pueda importar por error', () => {
    expect(Object.keys(barrido)).not.toContain('ESTADO_DE_EMOJI');
  });

  /**
   * La composición: el de tablas es el de encabezado **más** `⛔` y `🔵`, con
   * los mismos valores. Si `parseo.mjs` gana un emoji de encabezado, las tablas
   * lo reconocen solas, que es la mitad de B-1222 que ningún chequeo de fuente
   * ve.
   */
  it('el mapa de las tablas es el de los encabezados más ⛔ y 🔵', () => {
    expect(ESTADO_DE_EMOJI_EN_TABLA).toEqual({
      ...ESTADO_DE_EMOJI,
      '⛔': 'bloqueado',
      '🔵': 'futuro',
    });
  });

  it('una fila con cualquiera de esos emojis se lee con el estado del mapa', () => {
    for (const [emoji, estado] of Object.entries(ESTADO_DE_EMOJI_EN_TABLA)) {
      expect(afirmacionDeFila(`| **B-7** | algo | ${emoji} lo que sea |`)?.dice, emoji).toBe(estado);
    }
  });
});
