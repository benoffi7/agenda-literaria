/**
 * **El archivador del backlog** — `scripts/archivar-backlog.mjs`.
 *
 * ── Por qué esto tiene tests, y más que el tablero ────────────────────────
 * Porque **mueve las 17.000 líneas de prosa de `docs/BACKLOG.md`**, que es donde
 * vive el rastro de todo lo que se rompió en este proyecto y por qué. El tablero
 * reescribe una línea; esto reescribe los dos archivos enteros. El modo de fallar
 * de un script así es silencioso: un `slice` corrido por uno se come una línea
 * suelta en el medio de un diff de diecisiete mil, y nadie la ve nunca más.
 *
 * Por eso lo que se afirma acá no es «el resultado se ve bien» sino **la
 * conservación**: los mismos ítems antes y después, con el mismo cuerpo, el mismo
 * encabezado y la misma sección. Y el control negativo, que es el que hace que
 * esto valga algo: un movimiento que pierde texto **tiene que** dar rojo.
 */
import { describe, expect, it } from 'vitest';

import { archivar, despiezar, fueraDeSeccion, reubicados, verificar } from '../scripts/archivar-backlog.mjs';
import { archivosDelRepo } from './fixtures/archivos-del-repo';
import { ENCABEZADO, ID, SECCION, idsUsados, parsearBacklog, proximoNumero } from '../scripts/tablero/parseo.mjs';

/** Un backlog de juguete con las piezas que el real tiene: cabecera, prosa de
 *  sección, los cuatro estados, y la tabla de «Cerrados» del final. */
const VIVO = [
  '# Backlog',
  '',
  'Ordenado por prioridad. **Todo reporte de posible bug entra acá.**',
  '',
  '> **Hueco de numeración: `B-297` no existe y no se borró nada.**',
  '',
  '## P1 — bloquean el objetivo del proyecto',
  '',
  'La prosa de la sección, que es de la sección y no de ningún ítem.',
  '',
  '### B-900 · Algo que falta · P1',
  '',
  'El cuerpo del que falta, con una tabla adentro:',
  '',
  '| Qué | Dónde |',
  '|---|---|',
  '| una fila | acá |',
  '',
  '### B-901 · Algo que ya se hizo — ✅ hecho (2026-09-11) · P1',
  '',
  'El cuerpo del hecho, con «comillas latinas» y un — guión largo.',
  '',
  '## P2 — mejoras reales',
  '',
  '### B-902 · Algo empezado · P2 — 🟠 empezado (2026-09-12)',
  '',
  'El cuerpo del empezado.',
  '',
  '### B-903 · Algo que no se hace — ❌ descartado (2026-09-02)',
  '',
  'El cuerpo del descartado, con el motivo.',
  '',
  '## Cerrados',
  '',
  'Se dejan para que quede el rastro de qué se rompió.',
  '',
  '| Qué | Causa | Dónde |',
  '|---|---|---|',
  '| **Un bug que se arregló en el momento** | la causa | `archivo.ts` (2026-09-01) |',
  '',
].join('\n');

const de = (texto: string, id: string) => parsearBacklog(texto).items.find((i) => i.id === id);

describe('archivar los cerrados', () => {
  const s = archivar(VIVO, '');

  it('se lleva lo cerrado y deja lo que falta', () => {
    expect(parsearBacklog(s.vivo).items.map((i) => i.id)).toEqual(['B-900', 'B-902']);
    expect(parsearBacklog(s.archivo).items.map((i) => i.id)).toEqual(['B-901', 'B-903']);
    expect(s.movidos.map((m) => m.id)).toContain('B-901');
    expect(s.movidos.map((m) => m.id)).toContain('B-903');
  });

  it('descartado también es una puerta cerrada, y se va igual que hecho', () => {
    // Si solo se mirara `✅`, los ocho `❌ descartado` del archivo real se
    // quedarían en el vivo pareciendo trabajo pendiente.
    expect(de(s.archivo, 'B-903')!.estado).toBe('descartado');
    expect(de(s.vivo, 'B-903')).toBeUndefined();
  });

  it('no altera una coma del cuerpo, del encabezado ni de la sección', () => {
    for (const antes of parsearBacklog(VIVO).items) {
      const despues = de(s.vivo, antes.id) ?? de(s.archivo, antes.id)!;
      expect(despues.cuerpo.trim()).toBe(antes.cuerpo.trim());
      expect(despues.encabezado).toBe(antes.encabezado);
      expect(despues.seccion).toBe(antes.seccion);
    }
  });

  it('la cabecera y la prosa de cada sección se quedan en el vivo', () => {
    // La cabecera es la que explica los huecos de numeración, y se lee **antes**
    // de numerar uno nuevo: mandarla al archivo la esconde justo de quien la
    // necesita.
    expect(s.vivo).toContain('**Todo reporte de posible bug entra acá.**');
    expect(s.vivo).toContain('Hueco de numeración: `B-297`');
    expect(s.vivo).toContain('La prosa de la sección, que es de la sección');
    expect(s.archivo).not.toContain('Hueco de numeración');
  });

  it('la tabla de «Cerrados» se va entera, con sus filas', () => {
    expect(s.archivo).toContain('| **Un bug que se arregló en el momento** |');
    expect(s.vivo).not.toContain('Un bug que se arregló en el momento');
    // Y la tabla que vive **adentro** del cuerpo de un ítem abierto se queda con
    // él: no toda fila de tabla es de la sección «Cerrados».
    expect(s.vivo).toContain('| una fila | acá |');
  });

  it('el archivo nuevo dice de dónde salió y cómo volver', () => {
    expect(s.archivo).toMatch(/^# Backlog — cerrados/u);
    expect(s.archivo).toContain('BACKLOG.md');
  });
});

describe('correrlo de nuevo', () => {
  it('no mueve nada la segunda vez, y deja los dos archivos idénticos', () => {
    const uno = archivar(VIVO, '');
    const dos = archivar(uno.vivo, uno.archivo);
    expect(dos.movidos).toEqual([]);
    expect(dos.devueltos).toEqual([]);
    expect(dos.vivo).toBe(uno.vivo);
    expect(dos.archivo).toBe(uno.archivo);
  });
});

describe('el camino de vuelta', () => {
  it('un archivado que se reabre vuelve al vivo, a su sección', () => {
    /*
     * Sin esto, reabrir un ítem desde el tablero lo dejaría abierto **adentro**
     * del archivo de cerrados: la peor de las dos mentiras posibles, y ninguna
     * corrida futura lo sacaría de ahí.
     */
    const uno = archivar(VIVO, '');
    const reabierto = uno.archivo.replace(' — ✅ hecho (2026-09-11)', '');
    const dos = archivar(uno.vivo, reabierto);

    expect(dos.devueltos.map((d) => d.id)).toEqual(['B-901']);
    expect(de(dos.vivo, 'B-901')!.seccion).toBe('P1 — bloquean el objetivo del proyecto');
    expect(de(dos.archivo, 'B-901')).toBeUndefined();
    expect(de(dos.vivo, 'B-901')!.cuerpo).toContain('«comillas latinas»');
  });
});

describe('la verificación que corre antes de escribir', () => {
  it('no encuentra nada perdido en un movimiento sano', () => {
    expect(verificar(VIVO, '', archivar(VIVO, ''))).toEqual([]);
  });

  it('**detecta** un movimiento que se comió texto', () => {
    /*
     * El control negativo, y sin él los dos casos de arriba no valen nada: un
     * verificador que compara dos listas queda verde igual porque no encuentra
     * nada que porque no busca nada (B-873). Acá se rompe a propósito lo que
     * dice cuidar —se le saca una línea al cuerpo de un ítem movido— y se exige
     * que lo diga.
     */
    const sano = archivar(VIVO, '');
    const roto = {
      ...sano,
      archivo: sano.archivo.replace('El cuerpo del descartado, con el motivo.', ''),
    };
    expect(verificar(VIVO, '', roto)).toEqual(['B-903']);
  });
});

describe('la numeración, que es lo que el corte puede romper', () => {
  it('el próximo id sale de los dos archivos, nunca de uno solo', () => {
    /*
     * El peligro concreto: los ids de lo cerrado son la mitad de la defensa
     * contra el choque de numeración (el `B-930` que dos frentes eligieron a la
     * vez el 2026-09-15). Si el tablero mirara solo el archivo vivo, propondría
     * un número que un ítem archivado ya tiene.
     */
    const s = archivar(VIVO, '');
    const losDos = `${s.vivo}\n${s.archivo}`;
    expect(proximoNumero(losDos)).toBe(proximoNumero(VIVO));
    expect(idsUsados(losDos)).toEqual(idsUsados(VIVO));
    expect([...idsUsados(s.vivo)]).not.toContain('B-903');
  });
});

describe('contra el archivo real', () => {
  it('no pierde ni un ítem, ni una coma, ni cambia una sección', async () => {
    /*
     * Control positivo sobre el archivo de verdad, que es el único que tiene las
     * formas raras: encabezados con dos ids, ítems con tablas y bloques de
     * código adentro, secciones sin prosa. El número no se escribe —envejece—:
     * lo que se afirma es la conservación.
     */
    const { readFile } = await import('node:fs/promises');
    const original = await readFile(`${process.cwd()}/docs/BACKLOG.md`, 'utf8');
    const s = archivar(original, '');

    const antes = parsearBacklog(original).items;
    const despues = [...parsearBacklog(s.vivo).items, ...parsearBacklog(s.archivo).items];
    expect(despues.length).toBe(antes.length);
    expect(verificar(original, '', s)).toEqual([]);

    const porId = new Map(despues.map((i) => [i.id, i]));
    for (const antesIt of antes) {
      const despuesIt = porId.get(antesIt.id);
      expect(despuesIt, `se perdió ${antesIt.id}`).toBeDefined();
      expect(despuesIt!.encabezado).toBe(antesIt.encabezado);
      expect(despuesIt!.cuerpo.trim()).toBe(antesIt.cuerpo.trim());
      expect(despuesIt!.seccion).toBe(antesIt.seccion);
    }

    // Y lo que queda en el vivo es, exactamente, lo que falta hacer.
    expect(parsearBacklog(s.vivo).items.every((i) => i.estado === 'abierto' || i.estado === 'empezado')).toBe(true);
    expect(proximoNumero(`${s.vivo}\n${s.archivo}`)).toBe(proximoNumero(original));
  });

  it('despiezar no se traga ninguna línea del archivo real', () => {
    // La otra mitad de la conservación, sobre el juguete: cada línea del
    // original está en el preámbulo, en la prosa de una sección, o en un ítem.
    const { preambulo, secciones } = despiezar(VIVO);
    const reconstruido = [
      preambulo,
      ...secciones.map((s) =>
        [`## ${s.titulo}`, ...s.prosa, ...s.items.map((i: { texto: string }) => i.texto)].join('\n'),
      ),
    ].join('\n');
    for (const linea of VIVO.split('\n').filter((l) => l.trim())) {
      expect(reconstruido, `se perdió: ${linea}`).toContain(linea);
    }
  });
});

/**
 * **Una sola definición del formato** — el hallazgo D-88 del 2026-09-17, con la
 * firma corregida en **B-1113**.
 *
 * El archivador tenía su propia copia de `ENCABEZADO` y de `SECCION`, idéntica
 * por casualidad a la de `parseo.mjs`. Nada rompía, y ese es exactamente el
 * problema: el día que el parser reconozca un prefijo de id nuevo, el archivador
 * deja de ver esos ítems y **no los archiva nunca más**, con la suite en verde y
 * sin que el rastro de nadie se pierda de forma visible. Es la misma clase que el
 * `auditor-privacidad` persigue —un formato cuyo consumidor deriva por separado—
 * y acá hay dos redes distintas:
 *
 * 1. **La de arriba, de texto:** nadie en el repo puede volver a escribir el
 *    formato del id. Es la que frena la próxima copia **antes** de que diverja.
 * 2. **La de abajo, de comportamiento:** los prefijos salen de `ID`, así que
 *    agregarle uno a `parseo.mjs` genera el caso solo. Es la que frena la
 *    divergencia si alguien igual escribe la copia.
 *
 * ── Por qué la (1) cambió de firma **y** de alcance — B-1113 ───────────────
 *
 * La versión anterior recorría una lista de cuatro archivos escrita a mano y
 * buscaba `^##` / `^###` adentro de un literal. **No vio las dos copias que
 * existían el día que se escribió**, y no por el alcance sino por la firma:
 *
 * - `scripts/items-referenciados.mjs` nació el mismo día con **cinco** copias
 *   propias del formato. Su literal es `^#{1,6}`, así que **no matchea la firma
 *   vieja** — ensanchar la lista al repo entero no lo habría encontrado.
 * - `tests/bloques-de-codigo-en-la-doc.test.ts` tenía otras dos, una **más
 *   angosta que la canónica** (`/^### (B-\d+)/`, sin sufijo de letra), así que
 *   su mapa de duplicados metía `B-836a` y `B-836` bajo la misma clave.
 *
 * Y medido en su momento, ensanchar el alcance con la firma vieja daba **cuatro**
 * archivos de los cuales **dos eran falsos positivos** (una guarda que se
 * contiene a sí misma y una cita en prosa). Una guarda que parece canónica y no
 * lo es es lo que produjo estas copias: el arreglo no era el alcance.
 *
 * **La firma nueva pregunta quién redefine el formato del id** —`B-` o `DEC-`
 * seguido de una clase de dígitos escrita a mano— y barre **el repo entero**
 * (`archivosDelRepo`, B-964: incluye lo que todavía no llegó a `git add`). Los
 * comentarios se descartan antes de mirar: los dos falsos positivos de la
 * medición vivían adentro de un docblock, y una cita en prosa no es una copia.
 *
 * MUTACIÓN PROBADA: devolverle a `items-referenciados.mjs` cualquiera de sus
 * cinco literales, o a `bloques-de-codigo-en-la-doc.test.ts` el suyo, deja este
 * caso en rojo nombrando el archivo. Con la firma vieja, los dos pasaban.
 */
describe('el formato del backlog se define una sola vez', () => {
  /**
   * **El formato del id escrito a mano**: `B-\d`, `B-(\d`, `(?:B|DEC)-` o
   * `DEC-\d`. Es la firma de una copia — el que necesita otra forma del id la
   * compone con `DIGITOS`, `SUFIJO` e `ID`, que `parseo.mjs` exporta para eso.
   */
  const FORMATO_A_MANO = /B-\\d|B-\(\\d|\(\?:B\|DEC\)-|DEC-\\d/u;

  /**
   * Solo dos archivos pueden contener la firma, y los dos por el mismo motivo:
   * uno **es** la definición y el otro **es** la guarda —para buscar la firma
   * hay que escribirla—. Cualquier tercero es una copia.
   */
  const CANONICO = 'scripts/tablero/parseo.mjs';
  const ESTA_GUARDA = 'tests/archivar-backlog.test.ts';

  /**
   * Las líneas de código, sin comentarios. Se descartan por su primer carácter
   * —`*`, `/*`, `*\/`, `//`— en vez de recortar por pares de delimitadores: un
   * recorte así sobre un archivo con regexes es la clase que D-750 persigue.
   */
  const soloCodigo = (fuente: string): string =>
    fuente
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\*|\*\/|\/\/)/u.test(l))
      .join('\n');

  it('nadie en el repo redefine el formato del id', async () => {
    const { readFile } = await import('node:fs/promises');
    const conCopia: string[] = [];
    for (const ruta of archivosDelRepo()) {
      if (!/\.(mjs|js|ts|tsx|html)$/u.test(ruta)) continue;
      if (ruta === CANONICO || ruta === ESTA_GUARDA) continue;
      const fuente = await readFile(`${process.cwd()}/${ruta}`, 'utf8').catch(() => '');
      if (FORMATO_A_MANO.test(soloCodigo(fuente))) conCopia.push(ruta);
    }
    expect(
      conCopia,
      'componelo con `DIGITOS`, `SUFIJO` o `ID` de parseo.mjs en vez de volver a ' +
        'escribir el formato del id. Una copia más angosta que la canónica no rompe ' +
        'nada hoy y se lleva puesto el sufijo de letra el día que importe (B-1113).',
    ).toEqual([]);
  });

  /**
   * **Control positivo**, que es lo que impide que el caso de arriba pase por
   * estar mirando nada: la firma tiene que reconocer el canónico. Si alguien
   * cambia cómo `parseo.mjs` escribe el formato sin actualizar la firma, este
   * caso avisa en vez de dejar el barrido vacío y verde.
   */
  it('la firma reconoce al canónico, así que no está mirando al vacío', async () => {
    const { readFile } = await import('node:fs/promises');
    const fuente = await readFile(`${process.cwd()}/${CANONICO}`, 'utf8');
    expect(FORMATO_A_MANO.test(soloCodigo(fuente))).toBe(true);
  });

  it('el archivador importa el formato de sección y encabezado, no lo redefine', async () => {
    const { readFile } = await import('node:fs/promises');
    const fuente = await readFile(`${process.cwd()}/scripts/archivar-backlog.mjs`, 'utf8');
    expect(fuente).toMatch(/import \{[^}]*ENCABEZADO[^}]*SECCION[^}]*\} from '\.\/tablero\/parseo\.mjs'/u);
    // Y los usa: importarlos y no usarlos sería la copia con otra cara.
    expect(fuente).toContain('ENCABEZADO.test(');
    expect(fuente).toContain('SECCION.exec(');
  });

  it('reconoce **todos** los prefijos de id que el parser reconoce, sin tener que enterarse', () => {
    /*
     * Los prefijos se sacan de `ID` —`(?:B|DEC)-…`— y el caso se arma con ellos.
     * Si mañana `parseo.mjs` acepta un tercero, este test genera su ítem solo y
     * exige que el archivador lo mueva. Con la copia vieja, ese ítem se quedaba
     * en el vivo para siempre.
     */
    const prefijos = /\(\?:([^)]+)\)/u.exec(ID)![1].split('|');
    expect(prefijos.length).toBeGreaterThan(1);

    const texto = [
      '# Backlog',
      '',
      '## P2 — mejoras reales',
      '',
      ...prefijos.flatMap((p, i) => [
        `### ${p}-${700 + i} · Un ítem con prefijo ${p} — ✅ hecho (2026-09-17)`,
        '',
        `El cuerpo del de ${p}.`,
        '',
      ]),
    ].join('\n');

    const esperados = prefijos.map((p, i) => `${p}-${700 + i}`);
    expect(parsearBacklog(texto).items.map((i) => i.id)).toEqual(esperados);

    const s = archivar(texto, '');
    expect(s.movidos.map((m) => m.id)).toEqual(esperados);
    expect(parsearBacklog(s.archivo).items.map((i) => i.id)).toEqual(esperados);
    expect(parsearBacklog(s.vivo).items).toEqual([]);
    // Y ni una coma del cuerpo se quedó atrás.
    for (const p of prefijos) expect(s.archivo).toContain(`El cuerpo del de ${p}.`);
  });

  it('los dos regex compartidos son los que el archivador usa para partir', () => {
    // El control que ata las dos mitades: `despiezar` tiene que poner en un
    // bloque exactamente las líneas que `ENCABEZADO` reconoce, y abrir una
    // sección exactamente en las que `SECCION` reconoce.
    const { secciones } = despiezar(VIVO);
    const lineas = VIVO.split('\n');
    expect(secciones.map((s: { titulo: string }) => s.titulo)).toEqual(
      lineas.filter((l) => SECCION.test(l)).map((l) => SECCION.exec(l)![1]),
    );
    const enBloques = secciones.flatMap((s: { items: { desde: number }[] }) =>
      s.items.map((i) => lineas[i.desde]),
    );
    expect(enBloques).toEqual(lineas.filter((l) => ENCABEZADO.test(l)));
  });
});

describe('el archivo de cerrados NO es un `\'\'` — B-1219', () => {
  /*
   * **Todo lo de arriba archiva contra un archivo de cerrados vacío**, y ése era
   * el agujero: el corpus no ejercitaba nunca la entrada que en producción tiene
   * cuatrocientos ítems, así que ninguna de las dos mitades del bug del
   * 2026-09-23 podía salir.
   *
   *  - `archivar` colapsaba dos secciones del mismo título con un `find`, y se
   *    comía la segunda: **186 ítems** en una corrida.
   *  - `verificar` solo despiezaba el vivo, así que los ~400 ya archivados no los
   *    miraba nadie y la guarda contestó `[]` sobre esa misma corrida.
   *
   * Las dos son la misma forma: el chequeo pasaba por el archivo chico, que es
   * el que casi nunca se rompe. Es D-771 del lado de una guarda de datos.
   */
  const CERRADOS_CON_TITULO_REPETIDO = [
    '# Cerrados',
    '',
    '## P0 — rompe algo o pierde datos',
    '',
    '### B-500 · Uno viejo · ✅ hecho (2026-01-01) · P0',
    '',
    'Cuerpo del primero.',
    '',
    '## P3 — cuando sobre tiempo',
    '',
    '### B-501 · Otro · ✅ hecho (2026-01-02) · P3',
    '',
    'Cuerpo del segundo.',
    '',
    '## P0 — rompe algo o pierde datos',
    '',
    '### B-502 · El de la sección repetida · ✅ hecho (2026-01-03) · P0',
    '',
    'Cuerpo del tercero, que es el que se perdía.',
    '',
  ].join('\n');

  it('dos secciones con el mismo título no se comen una a la otra', () => {
    const s = archivar(VIVO, CERRADOS_CON_TITULO_REPETIDO);
    const ids = parsearBacklog(s.archivo).items.map((i) => i.id);
    expect(ids, 'B-502 vive en la SEGUNDA sección con ese título').toContain('B-502');
    expect(ids).toContain('B-500');
    expect(ids).toContain('B-501');
  });

  it('y el título repetido se emite una sola vez, fundido', () => {
    // Sin el `Set` sobre el orden, el bloque fundido sale una vez por aparición
    // y los ítems quedan duplicados — el otro lado del mismo bug.
    const s = archivar(VIVO, CERRADOS_CON_TITULO_REPETIDO);
    const veces = s.archivo.split('\n').filter((l) => l === '## P0 — rompe algo o pierde datos');
    expect(veces).toHaveLength(1);
    const ids = parsearBacklog(s.archivo).items.map((i) => i.id);
    expect(ids.filter((id) => id === 'B-500')).toHaveLength(1);
  });

  it('**la guarda lo detecta**, que es lo que tiene que sostenerlo cuando el arreglo no alcance', () => {
    /*
     * El control negativo del control negativo: se le saca a la salida un ítem
     * que venía **del archivo de cerrados** —no del vivo— y se exige que
     * `verificar` lo nombre. Con la firma vieja, `verificar(vivo, salida)`, esto
     * daba `[]`: era imposible de escribir.
     */
    const sano = archivar(VIVO, CERRADOS_CON_TITULO_REPETIDO);
    const roto = {
      ...sano,
      archivo: sano.archivo.replace('Cuerpo del tercero, que es el que se perdía.', ''),
    };
    expect(verificar(VIVO, CERRADOS_CON_TITULO_REPETIDO, roto)).toEqual(['B-502']);
  });

  it('contra los DOS archivos reales: ni un ítem menos, ni uno repetido', async () => {
    /*
     * El control positivo que faltaba. El de más arriba corre con `''` y por eso
     * seguía verde el 2026-09-23 mientras el script se comía 186 ítems del
     * archivo real.
     */
    const { readFile } = await import('node:fs/promises');
    const vivo = await readFile(`${process.cwd()}/docs/BACKLOG.md`, 'utf8');
    const cerrados = await readFile(`${process.cwd()}/docs/BACKLOG-cerrados.md`, 'utf8').catch(
      () => '',
    );
    if (!cerrados.trim()) return;

    const antes = new Set(
      [...parsearBacklog(vivo).items, ...parsearBacklog(cerrados).items].map((i) => i.id),
    );
    expect(antes.size).toBeGreaterThan(300);

    const s = archivar(vivo, cerrados);
    const despues = [...parsearBacklog(s.vivo).items, ...parsearBacklog(s.archivo).items];
    const ids = despues.map((i) => i.id);

    expect([...antes].filter((id) => !ids.includes(id)), 'ítems perdidos').toEqual([]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'ítems duplicados').toEqual([]);
    expect(verificar(vivo, cerrados, s)).toEqual([]);
  });

  it('y correrlo dos veces sobre los archivos reales no cambia nada', async () => {
    const { readFile } = await import('node:fs/promises');
    const vivo = await readFile(`${process.cwd()}/docs/BACKLOG.md`, 'utf8');
    const cerrados = await readFile(`${process.cwd()}/docs/BACKLOG-cerrados.md`, 'utf8').catch(
      () => '',
    );
    if (!cerrados.trim()) return;

    const una = archivar(vivo, cerrados);
    const dos = archivar(una.vivo, una.archivo);
    expect(dos.vivo).toBe(una.vivo);
    expect(dos.archivo).toBe(una.archivo);
  });
});

describe('dónde queda cada ítem, no solo si está — B-1233', () => {
  /*
   * El 2026-09-23 `BACKLOG-cerrados.md` quedó con 201 ítems de P0 debajo de la
   * cabecera `## P2` (`b9265f3`). No faltaba ninguno, así que `verificar` dijo
   * que estaba todo bien. La cadena fue: el script subía la sección del ítem
   * movido adelante de todas (B-1146), el diff era de doce mil líneas, se
   * deshizo a mano, y en ese arreglo se perdió la línea `## P0`.
   *
   * Todo el corpus de arriba archiva contra un archivo cuyas secciones están en
   * el mismo orden que las del vivo, y así el reordenamiento no se ve. Éste no.
   */
  const CERRADOS_EN_OTRO_ORDEN = [
    '# Cerrados',
    '',
    '## P3 — cuando sobre tiempo',
    '',
    '### B-600 · Uno de P3 · ✅ hecho (2026-01-01) · P3',
    '',
    'Cuerpo de P3.',
    '',
    '## P2 — mejoras reales',
    '',
    '### B-601 · Uno de P2 · ✅ hecho (2026-01-02) · P2',
    '',
    'Cuerpo de P2.',
    '',
  ].join('\n');

  const cabeceras = (t: string) => t.split('\n').filter((l) => SECCION.test(l));

  it('el orden de las secciones es el que el archivo ya tenía', () => {
    /*
     * MUTACIÓN PROBADA: volver a `[...aArchivar.keys(), ...secciones del
     * archivo]` deja este caso en rojo — `## P2` sube adelante de `## P3`.
     */
    const s = archivar(VIVO, CERRADOS_EN_OTRO_ORDEN);
    expect(cabeceras(s.archivo)).toEqual([
      '## P3 — cuando sobre tiempo',
      '## P2 — mejoras reales',
      '## P1 — bloquean el objetivo del proyecto',
      '## Cerrados',
    ]);
  });

  it('el ítem movido va al final de su sección, y lo demás no se toca', () => {
    // B-903 es P2 en el vivo: tiene que quedar después de B-601, sin mover P3.
    const s = archivar(VIVO, CERRADOS_EN_OTRO_ORDEN);
    const ids = parsearBacklog(s.archivo).items.map((i) => i.id);
    expect(ids.indexOf('B-600')).toBeLessThan(ids.indexOf('B-601'));
    expect(ids.indexOf('B-601')).toBeLessThan(ids.indexOf('B-903'));
    expect(reubicados(VIVO, CERRADOS_EN_OTRO_ORDEN, s)).toEqual([]);
  });

  it('**la guarda nombra** a un ítem que cambió de cabecera aunque su texto esté entero', () => {
    /*
     * La forma exacta de `b9265f3`: se pierde una línea `## `, ningún texto
     * falta, y los ítems de abajo pasan a vivir en la sección de arriba.
     * `verificar` no lo ve —ése es el punto— y `reubicados` sí.
     */
    const sano = archivar(VIVO, CERRADOS_EN_OTRO_ORDEN);
    const roto = { ...sano, archivo: sano.archivo.replace('## P2 — mejoras reales\n', '') };
    expect(verificar(VIVO, CERRADOS_EN_OTRO_ORDEN, roto), 'verificar no puede verlo').toEqual([]);
    expect(reubicados(VIVO, CERRADOS_EN_OTRO_ORDEN, roto)).toEqual([
      'B-601: P2 — mejoras reales → P3 — cuando sobre tiempo',
      'B-903: P2 — mejoras reales → P3 — cuando sobre tiempo',
    ]);
  });

  it('un ítem antes de la primera sección se detecta, y el script no corre', () => {
    // `b9265f3` tenía B-1230 pegado en el lugar de `## P0`, arriba de todo.
    const pegadoArriba = CERRADOS_EN_OTRO_ORDEN.replace(
      '## P3 — cuando sobre tiempo',
      '### B-602 · Pegado donde iba la cabecera · ✅ hecho (2026-01-03) · P2\n\nCuerpo.\n\n## P3 — cuando sobre tiempo',
    );
    expect(fueraDeSeccion(pegadoArriba)).toEqual(['B-602']);
    expect(fueraDeSeccion(CERRADOS_EN_OTRO_ORDEN)).toEqual([]);
  });

  it('contra los archivos reales: archivar un ítem cambia sus líneas y ninguna más', async () => {
    /*
     * B-1146 medía 19.000 líneas de diff para mover un ítem. Se marca como
     * hecho un ítem abierto cualquiera del vivo real y se exige que el archivo
     * de cerrados crezca en exactamente ese bloque y una línea en blanco.
     */
    const { readFile } = await import('node:fs/promises');
    const vivoCrudo = await readFile(`${process.cwd()}/docs/BACKLOG.md`, 'utf8');
    const cerradosCrudo = await readFile(`${process.cwd()}/docs/BACKLOG-cerrados.md`, 'utf8').catch(
      () => '',
    );
    if (!cerradosCrudo.trim()) return;
    expect(fueraDeSeccion(vivoCrudo)).toEqual([]);
    expect(fueraDeSeccion(cerradosCrudo)).toEqual([]);
    /*
     * La base es el estado **ya archivado**: si el vivo trae un cerrado que
     * nadie movió todavía —pasa entre que se marca y se corre el script, y ya
     * lo tiene en cuenta `tablero.test.ts`—, este caso mediría dos movimientos
     * y diría que el diff es de más. Lo que se afirma es el tamaño de mover
     * **uno**.
     */
    const base = archivar(vivoCrudo, cerradosCrudo);
    const vivo = base.vivo;
    const cerrados = base.archivo;

    const blanco = parsearBacklog(vivo).items.find((i) => i.seccion?.startsWith('P2') && i.estado === 'abierto');
    expect(blanco, 'hay un P2 abierto para probar').toBeDefined();
    const marcado = vivo.replace(blanco!.encabezado, `${blanco!.encabezado} — ✅ hecho (prueba)`);
    const s = archivar(marcado, cerrados);

    expect(reubicados(marcado, cerrados, s)).toEqual([]);
    expect(cabeceras(s.archivo)).toEqual(cabeceras(cerrados));
    const bloque = despiezar(marcado)
      .secciones.flatMap((sec) => sec.items)
      .find((i) => i.id === blanco!.id)!.texto.replace(/\s+$/u, '');
    const crecio = s.archivo.split('\n').length - cerrados.split('\n').length;
    expect(crecio).toBe(bloque.split('\n').length + 1);
  });
});

