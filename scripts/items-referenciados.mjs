#!/usr/bin/env node
/**
 * Lista los `B-nnn` que **el repo entero cita** y que no tienen entrada en
 * ninguno de los dos backlogs.
 *
 *   node scripts/items-referenciados.mjs            # informa, sale con 0
 *   node scripts/items-referenciados.mjs --estricto # sale con 1 si hay huérfanos
 *
 * Es el gemelo de `scripts/decisiones-referenciadas.mjs` —mismo corte, misma
 * salida, mismo motivo— corrido sobre la otra mitad del vocabulario del repo:
 * allá las decisiones `D-nnn` de `06-decisiones.md`, acá los ítems `B-nnn` de
 * `BACKLOG.md` + `BACKLOG-cerrados.md`.
 *
 * ── Por qué existe ────────────────────────────────────────────────
 * Un `B-` citado y sin entrada **no se nota de ninguna forma**. No hay enlace
 * que se rompa: el id viaja en prosa («ver B-919»), en un comentario de
 * `firestore.rules`, en el nombre de un `describe()`. Nada lo resuelve contra
 * nada, así que el número se lee como una dirección válida y no lleva a
 * ninguna parte.
 *
 * Y el id **es** la dirección: la cabecera de `BACKLOG.md` lo dice con todas
 * las letras —«el id es la dirección y sigue siendo única entre los dos
 * archivos»— y lo usa para justificar que la partición no reescribiera las 96
 * citas cruzadas. Un id sin entrada rompe esa promesa en silencio.
 *
 * El caso que lo abrió es **B-919**: citado en 45 archivos, con su decisión
 * escrita (D-690) y su commit, y con **dos ítems abiertos (B-920 y B-921) que
 * arrancan diciendo «dos bordes que B-919 dejó abiertos»**. Quien siga ese hilo
 * no encuentra nada, y el archivo no tiene forma de avisarlo.
 *
 * ── Qué cuenta como entrada, y por qué hay cuatro formas ──────────
 * El registro son los dos backlogs, y un ítem queda escrito de cuatro maneras
 * distintas. Las cuatro son reales y ninguna se puede dejar afuera sin llenar
 * la salida de ruido, que es como un informe deja de leerse:
 *
 *  1. **Un encabezado propio** — `### B-962 · …`. El caso normal.
 *  2. **Un encabezado de rango** — `### B-830 a B-839 · …`,
 *     `### B-370 a B-379, B-480 y B-481 · …`. Los números del medio existen
 *     aunque no tengan encabezado; adentro suelen ser filas de una tabla.
 *  3. **Una fila de tabla con el id en negrita** — `| **B-1021** · …`. Es como
 *     la tabla `## Cerrados` («lo que se arregló sin ítem») escribe sus
 *     entradas, y también las tajadas de un rango. La negrita es el corte: una
 *     fila que *cita* un ítem definido en otro lado lo escribe pelado
 *     (`| B-28 | ¿Claim curador?…`).
 *  4. **Un hueco explicado** — los ids que la cabecera de `BACKLOG.md` declara
 *     inexistentes a propósito (reserva de números entre frentes en paralelo).
 *     No tienen entrada porque **no son ítems**, y reportarlos sería el ruido
 *     que hace que nadie mire la lista dos veces.
 *
 * ── Por qué informa acá y frena en el test ────────────────────────
 * Al revés que su gemelo, este barrido **sí** tiene una red bloqueante
 * (`tests/items-referenciados.test.ts`), y la diferencia tiene motivo: citar
 * una decisión antes de escribirla es la forma normal de trabajar en este repo
 * —el frente documenta en su rama y la entrada la escribe otro—, pero citar un
 * `B-` que nadie va a escribir nunca no tiene esa excusa: el número sale del
 * backlog, así que quien lo escribe en el código lo tomó de algún lado.
 *
 * El test congela los huérfanos de hoy con su motivo y **se pone rojo con uno
 * nuevo**. Este script es la mitad que informa: lista los de hoy con dónde se
 * los cita, que es lo que hace falta para escribirles la entrada.
 *
 * La mitad que decide es pura y tiene tests; el barrido del disco es la mitad
 * que no se puede testear. Mismo corte que `relevar-infra.sh` /
 * `comparar-infra.sh`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El helper de B-964, y no un `git ls-files` propio: lo rastreado **más** lo
// nuevo sin `git add`, que es justo el archivo que estrena una cita.
import { archivosDelRepo } from '../tests/fixtures/archivos-del-repo.ts';
import { DIGITOS, SUFIJO } from './tablero/parseo.mjs';

/**
 * **El formato del id se compone, no se reescribe** — B-1113, clase D-88.
 *
 * Este archivo nació el mismo día que B-1110 sacaba la copia del formato del
 * archivador, y con **cinco** copias propias: `ID`, el regex de `orden`,
 * `TRAMO`, el de `itemsEscritos` y el de `itemsDeFilaEnNegrita`. Los dos
 * frentes trabajaron sin enterarse uno del otro, y la red de entonces no podía
 * verlo: su firma era «quién escribe `^###` adentro de un literal» y acá el
 * literal es `^#{1,6}`.
 *
 * Ahora las cinco se arman con `DIGITOS` y `SUFIJO` de `parseo.mjs`, que es el
 * único lugar donde el formato está escrito. Si mañana un id acepta otra forma
 * —un prefijo nuevo, dos letras de sufijo— este barrido se entera solo.
 *
 * **El prefijo se deja en `B-` a propósito y no se toma de `ID`:** `ID` es
 * `(?:B|DEC)-…` y este barrido es explícitamente el de los `B-`
 * (`scripts/decisiones-referenciadas.mjs` es el de las `D-`). Lo que se
 * comparte es la forma del **número**, que es donde estaba la divergencia real:
 * el sufijo de letra.
 */

/** `B-` seguido del número y la letra, cada uno en su grupo. */
const B_CON_GRUPOS = String.raw`B-(${DIGITOS})(${SUFIJO})`;

/** `B-836a` entero, sin grupos, para cuando solo hace falta reconocerlo. */
const B_ENTERO = String.raw`B-${DIGITOS}${SUFIJO}`;

/** Los dos archivos donde un ítem puede estar escrito. */
export const REGISTROS = ['docs/BACKLOG.md', 'docs/BACKLOG-cerrados.md'];

/**
 * Los ids **reservados por una tanda y nunca escritos**, explicados en el repo
 * pero fuera de las líneas de hueco que `huecosDeclarados` sabe leer.
 *
 * Es la clase que **B-1051** nombra: `proximoNumero` deriva el próximo `B-` de
 * lo que encuentra escrito, así que un id reservado y no usado no queda en
 * ninguna parte. Los cuatro de acá están contados en prosa corrida —dos adentro
 * del cuerpo de B-1051, dos como la punta de un rango reservado en la cabecera
 * («tenía reservado el rango **B-310 a B-319**», «se numeró primero en **B-930 a
 * B-940**»)— y ninguna de esas formas tiene el molde de una línea de hueco.
 *
 * Van a mano, con el motivo al lado: es lo que permite decidir dentro de un año
 * si siguen valiendo. Si la cabecera los adopta algún día como un hueco más,
 * esta constante se vacía sola — `huecosDeclarados` los encuentra ahí.
 */
export const RESERVADOS_SIN_ESCRIBIR = {
  'B-319': 'punta del rango B-310 a B-319 que reservó el frente de barrido de backlog y drift; usó tres — cabecera de BACKLOG.md',
  'B-940': 'punta del rango B-930 a B-940 con el que se numeró primero la tanda del 2026-09-15, corrida después a B-950 — cabecera de BACKLOG.md',
  'B-1000': 'reservado por el frente `barridos` de la tanda del 2026-09-17, cerrado al integrar — B-1051',
  'B-1020': 'reservado por el frente `saneador` de la tanda del 2026-09-17, cerrado al integrar — B-1051',
};

/**
 * La forma canónica de un id: el número sin ceros de más, repadeado a dos
 * dígitos, más el sufijo de letra si lo tiene.
 *
 * Existe porque el repo escribe `B-01` y no `B-1`, y un barrido que compare
 * cadenas daría `B-9` y `B-09` como ítems distintos — o sea, un huérfano
 * inventado el día que alguien escriba el número corto. El resultado se ve
 * igual que lo que hay escrito hoy (`B-08`, `B-919`, `B-836a`), así que la
 * normalización no cambia la salida, solo la vuelve estable.
 *
 * @param {string} numero
 * @param {string} [letra]
 * @returns {string}
 */
export const idCanonico = (numero, letra = '') => `B-${String(Number(numero)).padStart(2, '0')}${letra}`;

/** Un id suelto, tal como se escribe. */
const ID = new RegExp(String.raw`${B_CON_GRUPOS}\b`, 'u');

/**
 * El número de un id canónico, para ordenar. `B-836a` va justo después de
 * `B-836` y antes de `B-837`.
 *
 * @param {string} id
 * @returns {[number, string]}
 */
const orden = (id) => {
  const m = new RegExp(String.raw`^${B_CON_GRUPOS}$`, 'u').exec(id);
  return m ? [Number(m[1]), m[2]] : [Infinity, ''];
};

/**
 * Expande una declaración de ids: `B-830 a B-839`, `B-370 a B-379, B-480 y
 * B-481`, `B-828 y B-829`, `B-603`.
 *
 * El rango se expande entero — los números del medio existen aunque no tengan
 * encabezado propio, que es exactamente lo que dice `### B-830 a B-839`—. Un
 * rango cuyas puntas llevan **sufijo de letra** no se expande: no hay orden
 * definido entre letras y no existe ningún rango así en el repo, así que se
 * toman las dos puntas y nada más. (El ejemplo no se escribe acá con ids de
 * verdad a propósito: un `B-` inventado en un comentario es exactamente lo que
 * este barrido reporta, y se reportó a sí mismo al escribirlo.)
 *
 * @param {string} texto
 * @returns {string[]}
 */
export const expandir = (texto) => {
  /** @type {string[]} */
  const ids = [];
  // Cada tramo es «un id» o «un id `a` otro id». El separador entre tramos es
  // una coma o una `y`.
  const TRAMO = new RegExp(String.raw`${B_CON_GRUPOS}(?:\s+a\s+${B_CON_GRUPOS})?`, 'gu');
  for (const m of texto.matchAll(TRAMO)) {
    const [, desdeN, desdeL, hastaN, hastaL] = m;
    ids.push(idCanonico(desdeN, desdeL));
    if (hastaN === undefined) continue;
    ids.push(idCanonico(hastaN, hastaL));
    if (desdeL || hastaL) continue; // rango con letra: solo las puntas
    for (let n = Number(desdeN) + 1; n < Number(hastaN); n += 1) ids.push(idCanonico(String(n)));
  }
  return [...new Set(ids)];
};

/**
 * Los ítems que un backlog **tiene escritos**, leídos de sus encabezados.
 *
 * Se leen de los encabezados y no de cualquier `B-nnn` del archivo, por el
 * mismo motivo que su gemelo: el cuerpo de un ítem cita otros todo el tiempo
 * («reabre B-102», «la clase de B-80»), así que tomar cualquier mención haría
 * que el archivo se declarara completo solo y no encontrara nunca un huérfano.
 *
 * Y el encabezado tiene que **arrancar** con el id: `### Agentes y
 * automatización del flujo (B-115 a B-124)` es el título de una sección que
 * agrupa ítems, no la definición de diez.
 *
 * @param {string} contenido
 * @returns {string[]}
 */
export const itemsEscritos = (contenido) =>
  [
    ...contenido.matchAll(
      new RegExp(
        String.raw`^#{1,6}\s+\**\s*(${B_ENTERO}(?:\s*(?:a|y|,)\s*\**${B_ENTERO})*)`,
        'gmu',
      ),
    ),
  ].flatMap((m) => expandir(m[1]));

/**
 * Los ítems escritos como **fila de tabla con el id en negrita**.
 *
 * Las dos tablas que definen ítems lo hacen así: la `## Cerrados` de
 * `BACKLOG-cerrados.md` («lo que se arregló sin ítem», el único ítem que nunca
 * tuvo encabezado) y las tajadas de un encabezado de rango en `BACKLOG.md`
 * —donde además aparecen ids **fuera** del rango del título: el de la analítica
 * dice `B-370 a B-379, B-480 y B-481` y adentro tiene las filas de B-500, B-501
 * y B-502—.
 *
 * **La negrita es el corte, y no es cosmética.** Una fila que *cita* un ítem
 * definido en otro lado lo escribe pelado: `| B-28 | ¿Claim `curador` para
 * aprobar? |` es una pregunta al dueño sobre B-28, no la entrada de B-28. Leer
 * cualquier fila que empiece con un `B-` daría por escrito lo que apenas se
 * menciona, que es el mismo error que leer cualquier mención del cuerpo.
 *
 * @param {string} contenido
 * @returns {string[]}
 */
export const itemsDeFilaEnNegrita = (contenido) =>
  [
    ...contenido.matchAll(new RegExp(String.raw`^\|\s*\*\*\s*${B_CON_GRUPOS}\b`, 'gmu')),
  ].map((m) => idCanonico(m[1], m[2]));

/**
 * Los ids que los registros declaran **inexistentes a propósito**. Desde la
 * limpieza del 2026-09-25 las notas viven en «Huecos de numeración», al final de
 * `BACKLOG-cerrados.md`, y se leen de los dos archivos.
 *
 * Se leen del archivo y no de una lista acá: la cabecera ya los explica uno por
 * uno —van seis— y duplicar esa lista garantiza que las dos copias se separen.
 * El formato que se lee es el que el archivo usa: una línea en negrita que
 * nombra un hueco, dos puntos, y los ids.
 *
 * La línea que dice «**una convención nueva, que no es un hueco**» queda
 * afuera a propósito y por dos vías: no hay ningún id adentro de su negrita, y
 * además se descarta explícitamente. B-836a **existe**, es media mitad de
 * B-836, y darlo por inexistente lo escondería del barrido.
 *
 * @param {string} contenido
 * @returns {string[]}
 */
export const huecosDeclarados = (contenido) =>
  contenido
    .split('\n')
    .filter((linea) => /hueco/i.test(linea) && !/no es un hueco/i.test(linea))
    .flatMap((linea) => {
      const m = linea.match(/\*\*[^*]*?hueco[^*]*?:\s*([^*]*?)\*\*/i);
      return m ? expandir(m[1]) : [];
    });

/**
 * Las referencias `B-nnn` de un texto, sin repetir y en forma canónica.
 *
 * @param {string} contenido
 * @returns {string[]}
 */
export const referenciasDe = (contenido) => [
  ...new Set(
    [...contenido.matchAll(new RegExp(`\\b${ID.source}`, 'g'))].map((m) => idCanonico(m[1], m[2])),
  ),
];

/** Los archivos que son prosa; el resto del corpus es código. */
export const esProsa = (archivo) => archivo.endsWith('.md');

/**
 * Los ids citados que no tienen entrada, con dónde se los cita.
 *
 * @param {Record<string, string>} textos archivo → contenido
 * @param {Iterable<string>} escritos
 * @returns {{ item: string, archivos: string[], desdeCodigo: string[] }[]}
 */
export const huerfanos = (textos, escritos) => {
  const conocidos = new Set(escritos);
  /** @type {Map<string, string[]>} */
  const porItem = new Map();
  for (const [archivo, contenido] of Object.entries(textos)) {
    for (const ref of referenciasDe(contenido)) {
      if (conocidos.has(ref)) continue;
      porItem.set(ref, [...(porItem.get(ref) ?? []), archivo]);
    }
  }
  return [...porItem.entries()]
    .map(([item, archivos]) => ({
      item,
      archivos: archivos.sort(),
      desdeCodigo: archivos.filter((a) => !esProsa(a)).sort(),
    }))
    .sort((a, b) => {
      const [na, la] = orden(a.item);
      const [nb, lb] = orden(b.item);
      return na - nb || la.localeCompare(lb);
    });
};

/**
 * Las extensiones que se barren.
 *
 * Lista blanca y no lista negra: un `.png` nuevo no tiene que acordarse de
 * pedir permiso para quedar afuera, y un formato de texto nuevo entra cuando
 * alguien decide que entre. `package-lock.json` queda afuera aparte — son
 * megabytes de hashes donde `B-` no significa nada.
 */
export const EXTENSIONES = [
  '.md', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.astro', '.json', '.jsonc',
  '.rules', '.yml', '.yaml', '.sh', '.txt', '.html', '.css', '.indexes',
];

/**
 * Archivos que quedan afuera, con el motivo de cada uno.
 *
 * - `package-lock.json`: megabytes de hashes donde `B-` no significa nada.
 * - `tests/items-referenciados.test.ts`: **el archivo que prueba este barrido**.
 *   Sus controles positivos necesitan citar ids inventados —un `B-` que no
 *   existe es literalmente el caso que hay que ejercitar— así que barrerlo hace
 *   que el chequeo se reporte a sí mismo y no pueda quedar verde nunca. Es la
 *   misma excepción que se le hace a un barrido que contiene su propio
 *   contraejemplo.
 */
const AFUERA = new Set(['package-lock.json', 'tests/items-referenciados.test.ts']);

/** @param {string} archivo */
export const seBarre = (archivo) =>
  !AFUERA.has(archivo) && EXTENSIONES.some((e) => archivo.endsWith(e));

/**
 * El relevamiento completo contra el disco: qué ítems hay escritos, qué se cita
 * y qué queda huérfano.
 *
 * Lo comparten el CLI y el test, para que la red congele **lo mismo** que el
 * informe muestra. Recibe el lector para poder ejercitarlo sin disco.
 *
 * @param {{ archivos?: string[], leer?: (a: string) => string }} [opciones]
 */
export const relevar = ({ archivos = archivosDelRepo(), leer = (a) => readFileSync(a, 'utf8') } = {}) => {
  const registros = REGISTROS.map(leer);
  const escritos = new Set([
    ...registros.flatMap(itemsEscritos),
    ...registros.flatMap(itemsDeFilaEnNegrita),
    ...registros.flatMap(huecosDeclarados),
    ...Object.keys(RESERVADOS_SIN_ESCRIBIR),
  ]);

  /** @type {Record<string, string>} */
  const textos = {};
  for (const archivo of archivos.filter(seBarre)) textos[archivo] = leer(archivo);

  return { escritos: [...escritos], corpus: Object.keys(textos), sueltos: huerfanos(textos, escritos) };
};

// ── CLI ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { escritos, corpus, sueltos } = relevar();

  process.stdout.write(`ítems escritos en ${REGISTROS.join(' + ')}: ${escritos.length}\n`);
  process.stdout.write(`archivos barridos: ${corpus.length}\n`);
  if (sueltos.length === 0) {
    process.stdout.write('sin referencias huérfanas\n');
    process.exit(0);
  }

  const deCodigo = sueltos.filter((s) => s.desdeCodigo.length > 0);
  process.stdout.write(
    `referencias sin entrada: ${sueltos.length} (${deCodigo.length} citadas desde el código)\n`,
  );
  for (const { item, archivos, desdeCodigo } of sueltos) {
    const marca = desdeCodigo.length > 0 ? 'código' : 'prosa';
    process.stdout.write(`  ${item} — ${archivos.length} archivo(s), ${marca}\n`);
    process.stdout.write(`      ${archivos.slice(0, 4).join(', ')}`);
    process.stdout.write(archivos.length > 4 ? ` … +${archivos.length - 4}\n` : '\n');
  }
  process.stdout.write(
    '\nUn `B-` huérfano no rompe ningún enlace, y ése es el problema: el id es la\n' +
      'dirección de un ítem —lo dice la cabecera de `BACKLOG.md`— así que un número\n' +
      'sin entrada se lee como una dirección válida y no lleva a ninguna parte.\n' +
      'Citado **desde el código** es lo más caro: el comentario explica el porqué de\n' +
      'una línea y manda a buscar un ítem que nadie escribió.\n' +
      'La red que impide que aparezca uno nuevo es `tests/items-referenciados.test.ts`.\n',
  );
  process.exit(process.argv.includes('--estricto') ? 1 : 0);
}
