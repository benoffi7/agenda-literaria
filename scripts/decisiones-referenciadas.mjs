#!/usr/bin/env node
/**
 * Lista las referencias `D-nnn` de `docs/` que no tienen entrada en
 * `docs/06-decisiones.md`.
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
 * ── Por qué NO es un test bloqueante ──────────────────────────────
 * Porque **citar una decisión antes de escribirla es legítimo y frecuente en
 * este repo.** Los frentes trabajan en paralelo sobre ramas distintas: el que
 * documenta su cambio escribe `D-350` en su archivo, y la entrada de
 * `06-decisiones.md` la agrega el frente que tiene ese archivo, a veces en otro
 * commit y a veces en otra rama. Un test bloqueante estaría **rojo mientras la
 * tanda está abierta**, o sea rojo por razones que no son el cambio de quien lo
 * corre: es el modo de falla de B-180, y un gate así se aprende a saltear.
 *
 * Así que esto **informa** y no frena. Lo consulta el `auditor-documentacion`,
 * que sí puede juzgar si la referencia huérfana es una tanda en vuelo o una
 * entrada que nadie escribió nunca — que es justo el juicio que un test no
 * puede dar. `--estricto` existe para el día que las tandas en paralelo dejen
 * de ser la forma de trabajo, o para correrlo sobre `main` ya integrado.
 *
 * La mitad que decide es pura y tiene tests (`tests/decisiones.test.ts`); el
 * barrido del disco es la mitad que no se puede testear. Es el mismo corte de
 * `relevar-infra.sh` / `comparar-infra.sh`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Las referencias que no tienen entrada, con el archivo donde aparecen.
 *
 * @param {Record<string, string>} textos archivo → contenido
 * @param {string[]} escritas
 * @returns {{ decision: string, archivos: string[] }[]}
 */
export const huerfanas = (textos, escritas) => {
  const conocidas = new Set(escritas);
  /** @type {Map<string, string[]>} */
  const porDecision = new Map();
  for (const [archivo, contenido] of Object.entries(textos)) {
    for (const ref of referenciasDe(contenido)) {
      if (conocidas.has(ref)) continue;
      porDecision.set(ref, [...(porDecision.get(ref) ?? []), archivo]);
    }
  }
  return [...porDecision.entries()]
    .map(([decision, archivos]) => ({ decision, archivos: archivos.sort() }))
    .sort((a, b) => Number(a.decision.slice(2)) - Number(b.decision.slice(2)));
};

/**
 * Todos los `.md` de un directorio, recursivo.
 *
 * @param {string} dir
 * @returns {string[]}
 */
const markdowns = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? markdowns(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );

// ── CLI ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const REGISTRO = 'docs/06-decisiones.md';
  const escritas = decisionesEscritas(readFileSync(REGISTRO, 'utf8'));

  /** @type {Record<string, string>} */
  const textos = {};
  // Solo `docs/`: es donde vive el registro y donde los enlaces resuelven a un
  // ancla. El `CLAUDE.md` y las fichas de `.claude/` citan decisiones también,
  // pero como referencia en prosa y no como enlace, así que un número que
  // todavía no existe ahí no produce un link roto.
  for (const archivo of markdowns('docs')) {
    if (archivo === REGISTRO) continue; // el registro se cita a sí mismo entero
    textos[archivo] = readFileSync(archivo, 'utf8');
  }

  const sueltas = huerfanas(textos, escritas);

  process.stdout.write(`decisiones escritas en ${REGISTRO}: ${escritas.length}\n`);
  process.stdout.write(`archivos barridos: ${Object.keys(textos).length}\n`);
  if (sueltas.length === 0) {
    process.stdout.write('sin referencias huérfanas\n');
    process.exit(0);
  }

  process.stdout.write(`referencias sin entrada: ${sueltas.length}\n`);
  for (const { decision, archivos } of sueltas) {
    process.stdout.write(`  ${decision} — ${archivos.join(', ')}\n`);
  }
  process.stdout.write(
    '\nUna referencia huérfana es una de dos cosas, y hay que mirarla para saber cuál:\n' +
      '  · una tanda en vuelo — el frente que documentó su cambio ya cita el número y la\n' +
      '    entrada la escribe otro frente. Es legítimo y se resuelve al integrar.\n' +
      '  · una entrada que nadie escribió nunca. Ahí el enlace abre el documento sin ancla\n' +
      '    y quien lo siga no encuentra la decisión que la doc dice que existe.\n',
  );
  process.exit(process.argv.includes('--estricto') ? 1 : 0);
}
