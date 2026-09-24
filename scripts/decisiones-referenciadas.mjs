#!/usr/bin/env node
/**
 * Lista las referencias `D-nnn` que **el repo entero cita** y que no tienen
 * entrada en `docs/06-decisiones.md`.
 *
 *   node scripts/decisiones-referenciadas.mjs            # informa, sale con 0
 *   node scripts/decisiones-referenciadas.mjs --estricto # sale con 1 si hay huérfanas
 *
 * ── Por qué existe ────────────────────────────────────────────────
 * Un enlace a una decisión que no existe **resuelve igual**:
 * `06-decisiones.md#d-999` abre el documento, sin ancla y sin error, así que
 * nadie lo nota. Es la forma exacta en que nació uno de los hallazgos del
 * `auditor-documentacion`: una entrada citada que nunca se escribió.
 *
 * Informa **dos cosas distintas**, y separadas porque no piden el mismo trabajo:
 * las referencias **sin entrada** —hay que escribir la decisión— y las citadas
 * **con otra grafía** (`D-9` contra `## D-09`), donde la decisión existe y lo
 * único que no resuelve es el ancla. Las nueve primeras entradas llevan cero a la
 * izquierda y ninguna de `D-10` en adelante lo lleva; mezclar las dos listas hacía
 * que una decisión escrita se reportara como inexistente (**B-910**).
 *
 * ── Qué se barre, y por qué dejó de ser solo `docs/` ──────────────
 * **Barre el repo entero, igual que su gemelo `scripts/items-referenciados.mjs`**
 * — B-1147. Hasta el 2026-09-22 miraba 27 archivos, todos `.md`, con este
 * motivo escrito: «es donde vive el registro y donde los enlaces resuelven a un
 * ancla; en el código las decisiones se citan en prosa, así que un número que
 * todavía no existe ahí no produce un link roto».
 *
 * **Ese argumento era cierto y contestaba la pregunta equivocada.** Lo que este
 * barrido persigue no es el link roto: es la decisión que alguien va a buscar y
 * no está. Y una decisión es, sobre todo, lo que el **código** cita — el mismo
 * argumento que D-740 escribió del lado de los duplicados. El caso que lo midió
 * es **D-88**: huérfana hasta B-1330, citada desde **diecisiete** archivos —tres `.mjs` de
 * `scripts/`, un `.sh`, un módulo de `src/`, nueve de `tests/` y los tres `.md`—
 * y el informe nombraba solo esos tres `.md`. Quien lo leía subestimaba el
 * alcance por un factor de casi seis. (El ítem estimaba «cuatro» y se quedó
 * corto, justamente porque la cuenta se hizo a mano con el barrido que no los
 * veía.) Las otras dos las midió
 * **B-1082**: D-400 y D-401 se citaban **diecisiete veces desde siete archivos**
 * de `src/` y `tests/` —el ítem dice «doce», que es la cuenta de D-401 sola— y
 * **no podían aparecer acá**, que es la puerta abierta justo donde el repo más
 * cita decisiones: los docblocks.
 *
 * Abrir el corpus destapa huérfanas de golpe —le pasó al gemelo— así que el
 * informe las separa por dónde se las cita: **desde el código** es el caso caro
 * (el comentario explica el porqué de una línea y manda a buscar una decisión
 * que nadie escribió), desde prosa es casi siempre una cicatriz. La lista de
 * extensiones y las excepciones de `AFUERA` son el resto del control de ruido.
 *
 * ── Por qué NO es un test bloqueante ──────────────────────────────
 * Porque **citar una decisión antes de escribirla es legítimo y frecuente en
 * este repo.** Los frentes trabajan en paralelo sobre ramas distintas: el que
 * documenta su cambio escribe un número en su archivo, y la entrada de
 * `06-decisiones.md` la agrega el frente que tiene ese archivo, a veces en otro
 * commit y a veces en otra rama. Un test bloqueante estaría **rojo mientras la
 * tanda está abierta**, o sea rojo por razones que no son el cambio de quien lo
 * corre: es el modo de falla de B-180, y un gate así se aprende a saltear.
 *
 * **Y por eso acá no hay lista congelada, que es lo único en lo que este barrido
 * se aparta del gemelo.** El de los `B-` congela sus 46 huérfanos y se pone rojo
 * con uno nuevo, porque un `B-` citado sale del backlog y alguien lo tomó de
 * algún lado. Una `D-` no: el número se acuña en el commit que la decide. Lo que
 * sí tiene red es el **corpus** —`tests/decisiones-referenciadas.test.ts` exige
 * que siga incluyendo `src/` y `tests/`—, para que este barrido no pueda volver
 * a encogerse a `docs/` sin que nada lo diga.
 *
 * Así que esto **informa** y no frena. Lo consulta el `auditor-documentacion`,
 * que sí puede juzgar si la referencia huérfana es una tanda en vuelo o una
 * entrada que nadie escribió nunca — que es justo el juicio que un test no
 * puede dar. `--estricto` existe para el día que las tandas en paralelo dejen
 * de ser la forma de trabajo, o para correrlo sobre `main` ya integrado.
 *
 * La mitad que decide es pura y tiene tests; el barrido del disco es la mitad
 * que no se puede testear. Es el mismo corte de `relevar-infra.sh` /
 * `comparar-infra.sh`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El helper de B-964, y no un `git ls-files` propio: lo rastreado **más** lo
// nuevo sin `git add`, que es justo el archivo que estrena una cita.
import { archivosDelRepo } from '../tests/fixtures/archivos-del-repo.ts';

/**
 * **El corpus se comparte, no se copia** — B-1147, clase D-88.
 *
 * `EXTENSIONES` y `esProsa` **se importan del gemelo** y se reexportan acá. La
 * primera versión de este cambio las copió byte a byte, que es exactamente el
 * bug que B-1147 vino a cerrar visto desde el otro lado: dos barridos hermanos
 * mirando corpus distintos sin que nada lo diga. Copiar la lista para arreglar
 * un corpus desalineado lo dejaba listo para volver a desalinearse — lo encontró
 * el `auditor-trampas` en el mismo cambio.
 *
 * **La dirección de la dependencia es la de la historia, no una jerarquía:** la
 * lista blanca nació en `items-referenciados.mjs` (B-1100) y este barrido es el
 * que se le acopla. El día que haya un tercer barrido con corpus, los dos se
 * mudan a un módulo propio; con dos, un archivo nuevo sería más ceremonia que
 * lista.
 *
 * Es la misma lección de **B-1113** («el formato del id se compone, no se
 * reescribe») aplicada al corpus en vez de al id.
 */
import { EXTENSIONES, esProsa } from './items-referenciados.mjs';

export { EXTENSIONES, esProsa };

/** Dónde están escritas las decisiones. */
export const REGISTRO = 'docs/06-decisiones.md';

/**
 * Los números de decisión que `06-decisiones.md` **tiene escritos**, leídos de
 * sus encabezados.
 *
 * Se leen de los encabezados y no de cualquier `D-nnn` del archivo: el cuerpo
 * de una entrada cita otras decisiones todo el tiempo, así que tomar todas las
 * menciones haría que el documento se declarara completo solo.
 *
 * @param {string} contenido
 * @returns {string[]}
 */
export const decisionesEscritas = (contenido) =>
  [...contenido.matchAll(/^#{1,6}\s+(D-\d+)\b/gm)].map((m) => m[1]);

/**
 * Las referencias `D-nnn` de un texto, sin repetir.
 *
 * @param {string} contenido
 * @returns {string[]}
 */
export const referenciasDe = (contenido) => [
  ...new Set([...contenido.matchAll(/\bD-(\d+)\b/g)].map((m) => `D-${m[1]}`)),
];

/**
 * El número de una decisión, sin el cero a la izquierda.
 *
 * **La identidad de una decisión es su número, no cómo se escribió.** Las nueve
 * primeras entradas del registro llevan cero (`D-01` … `D-09`) y de `D-10` en
 * adelante no lo lleva ninguna, así que la misma decisión aparece con dos
 * grafías según quién la cite. Comparar cadenas hacía que `D-9` se reportara
 * como huérfana teniendo `D-09` escrita — que es exactamente lo que pasó con la
 * sexta huérfana de **B-910**, donde además la «cita» era un ejemplo de
 * ordenamiento en prosa (`13-agentes.md`: «que ordene `D-9` después de
 * `D-100`») y no un enlace a nada.
 *
 * @param {string} decision
 * @returns {number}
 */
const numeroDe = (decision) => Number(decision.slice(2));

/**
 * Las referencias que no tienen entrada, con el archivo donde aparecen y con
 * cuáles de esos archivos son código.
 *
 * `desdeCodigo` no cambia qué se reporta, cambia **en qué orden se lee**: una
 * `D-` citada desde un docblock es una decisión que alguien va a ir a buscar
 * porque una línea de código lo mandó; citada solo desde prosa suele ser una
 * cicatriz de un documento viejo (B-1147).
 *
 * @param {Record<string, string>} textos archivo → contenido
 * @param {string[]} escritas
 * @returns {{ decision: string, archivos: string[], desdeCodigo: string[] }[]}
 */
export const huerfanas = (textos, escritas) => {
  const conocidas = new Set(escritas.map(numeroDe));
  /** @type {Map<string, string[]>} */
  const porDecision = new Map();
  for (const [archivo, contenido] of Object.entries(textos)) {
    for (const ref of referenciasDe(contenido)) {
      if (conocidas.has(numeroDe(ref))) continue;
      porDecision.set(ref, [...(porDecision.get(ref) ?? []), archivo]);
    }
  }
  return [...porDecision.entries()]
    .map(([decision, archivos]) => ({
      decision,
      archivos: archivos.sort(),
      desdeCodigo: archivos.filter((a) => !esProsa(a)).sort(),
    }))
    .sort((a, b) => numeroDe(a.decision) - numeroDe(b.decision));
};

/**
 * Las referencias a una decisión **que existe**, escritas con otra grafía que la
 * del encabezado: `D-9` contra `## D-09`.
 *
 * Va aparte de las huérfanas a propósito, porque no es la misma falla y no pide
 * el mismo trabajo. Una huérfana es una decisión que no existe y hay que
 * escribir; esto es una decisión que existe y está bien citada en prosa. Lo
 * único que se pierde es el ancla: `06-decisiones.md#d-9` no resuelve a
 * `## D-09`, así que **si la cita es un enlace** el enlace abre el documento sin
 * ancla, que es la falla que este script existe para ver. Si es prosa, no hay
 * nada que arreglar.
 *
 * Acá `desdeCodigo` se lee al revés que en las huérfanas, y por eso se informa:
 * un comentario de `.ts` **nunca** es un enlace, así que una grafía distinta ahí
 * no rompe nada. Es el lado barato de la lista (B-1147).
 *
 * @param {Record<string, string>} textos archivo → contenido
 * @param {string[]} escritas
 * @returns {{ citada: string, escrita: string, archivos: string[], desdeCodigo: string[] }[]}
 */
export const otraGrafia = (textos, escritas) => {
  const porNumero = new Map(escritas.map((d) => [numeroDe(d), d]));
  /** @type {Map<string, { escrita: string, archivos: string[] }>} */
  const porCita = new Map();
  for (const [archivo, contenido] of Object.entries(textos)) {
    for (const ref of referenciasDe(contenido)) {
      const escrita = porNumero.get(numeroDe(ref));
      if (escrita === undefined || escrita === ref) continue;
      porCita.set(ref, { escrita, archivos: [...(porCita.get(ref)?.archivos ?? []), archivo] });
    }
  }
  return [...porCita.entries()]
    .map(([citada, { escrita, archivos }]) => ({
      citada,
      escrita,
      archivos: archivos.sort(),
      desdeCodigo: archivos.filter((a) => !esProsa(a)).sort(),
    }))
    .sort((a, b) => numeroDe(a.citada) - numeroDe(b.citada));
};

/**
 * Archivos que quedan afuera, con el motivo de cada uno.
 *
 * - `docs/06-decisiones.md`: es el registro, y se cita a sí mismo entero.
 * - `package-lock.json`: megabytes de hashes donde `D-` no significa nada.
 * - `tests/decisiones-referenciadas.test.ts`: **el archivo que prueba este
 *   barrido**. Sus controles positivos necesitan citar decisiones inventadas
 *   —una `D-` que no existe es literalmente el caso que hay que ejercitar— así
 *   que barrerlo hace que el chequeo se reporte a sí mismo y no pueda quedar
 *   limpio nunca. Es la misma excepción, y por el mismo motivo, que
 *   `scripts/items-referenciados.mjs` le hace a la suya.
 * - **Este archivo.** La primera versión de B-1147 lo dejó adentro razonando que
 *   sus ejemplos usan números que existen (`D-9`, `D-100`) o la grafía en
 *   minúscula del ancla. El razonamiento se cayó en el mismo cambio: la cabecera
 *   necesita nombrar **D-88** —el caso medido, huérfano hasta B-1330— y con eso el
 *   script pasó a figurar entre los citantes de su propio ejemplo. Lo encontró
 *   el `auditor-trampas`. La explicación de por qué existe un barrido **tiene**
 *   que poder nombrar la huérfana que lo motivó sin contarse como un lugar donde
 *   el código manda a buscarla, que es lo que este informe mide.
 */
const AFUERA = new Set([
  REGISTRO,
  'package-lock.json',
  'scripts/decisiones-referenciadas.mjs',
  'tests/decisiones-referenciadas.test.ts',
]);

/** @param {string} archivo */
export const seBarre = (archivo) =>
  !AFUERA.has(archivo) && EXTENSIONES.some((e) => archivo.endsWith(e));

/**
 * El relevamiento completo contra el disco: qué decisiones hay escritas, qué se
 * cita, qué queda huérfano y qué está citado con otra grafía.
 *
 * Lo comparten el CLI y el test, para que la red mire **el mismo corpus** que el
 * informe muestra — que es justo lo que B-1147 encontró desalineado entre este
 * barrido y su gemelo. Recibe el lector para poder ejercitarlo sin disco.
 *
 * @param {{ archivos?: string[], leer?: (a: string) => string }} [opciones]
 */
export const relevar = ({ archivos = archivosDelRepo(), leer = (a) => readFileSync(a, 'utf8') } = {}) => {
  const escritas = decisionesEscritas(leer(REGISTRO));

  /** @type {Record<string, string>} */
  const textos = {};
  for (const archivo of archivos.filter(seBarre)) textos[archivo] = leer(archivo);

  return {
    escritas,
    corpus: Object.keys(textos),
    sueltas: huerfanas(textos, escritas),
    grafias: otraGrafia(textos, escritas),
  };
};

// ── CLI ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { escritas, corpus, sueltas, grafias } = relevar();

  process.stdout.write(`decisiones escritas en ${REGISTRO}: ${escritas.length}\n`);
  process.stdout.write(`archivos barridos: ${corpus.length}\n`);

  if (grafias.length > 0) {
    process.stdout.write(`\ncitadas con otra grafía (la decisión existe): ${grafias.length}\n`);
    for (const { citada, escrita, archivos, desdeCodigo } of grafias) {
      const enlaces = archivos.length - desdeCodigo.length;
      process.stdout.write(
        `  ${citada} → ${escrita} — ${archivos.join(', ')} (${enlaces} donde podría ser un enlace)\n`,
      );
    }
    process.stdout.write(
      '  El ancla no resuelve con esa grafía. Si la cita es un enlace hay que corregirla;\n' +
        '  si es prosa o un comentario de código, no hay nada que hacer.\n\n',
    );
  }

  if (sueltas.length === 0) {
    process.stdout.write('sin referencias huérfanas\n');
    process.exit(0);
  }

  const deCodigo = sueltas.filter((s) => s.desdeCodigo.length > 0);
  process.stdout.write(
    `referencias sin entrada: ${sueltas.length} (${deCodigo.length} citadas desde el código)\n`,
  );
  for (const { decision, archivos, desdeCodigo } of sueltas) {
    const marca = desdeCodigo.length > 0 ? 'código' : 'prosa';
    process.stdout.write(`  ${decision} — ${archivos.length} archivo(s), ${marca}\n`);
    process.stdout.write(`      ${archivos.slice(0, 4).join(', ')}`);
    process.stdout.write(archivos.length > 4 ? ` … +${archivos.length - 4}\n` : '\n');
  }
  process.stdout.write(
    '\nUna referencia huérfana es una de dos cosas, y hay que mirarla para saber cuál:\n' +
      '  · una tanda en vuelo — el frente que documentó su cambio ya cita el número y la\n' +
      '    entrada la escribe otro frente. Es legítimo y se resuelve al integrar.\n' +
      '  · una entrada que nadie escribió nunca. Ahí el enlace abre el documento sin ancla\n' +
      '    y quien lo siga no encuentra la decisión que la doc dice que existe.\n' +
      'Citada **desde el código** es lo más caro: el comentario explica el porqué de una\n' +
      'línea y manda a buscar una decisión que nadie escribió (B-1147).\n',
  );
  process.exit(process.argv.includes('--estricto') ? 1 : 0);
}
