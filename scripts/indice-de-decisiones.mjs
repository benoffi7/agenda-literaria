#!/usr/bin/env node
/**
 * Genera `docs/06-decisiones-indice.md`: una línea por decisión de
 * `docs/06-decisiones.md`, con su id, su título y el enlace a su ancla — M-7
 * del PRD 6.
 *
 *   node scripts/indice-de-decisiones.mjs              # reescribe el índice
 *   node scripts/indice-de-decisiones.mjs --verificar  # sale con 1 si no coincide
 *
 * El registro pesa ~205 mil tokens y no se puede leer entero; el índice deja
 * encontrar una D por su título sin cargarlo, y saltar a su ancla. Se genera y
 * no se escribe a mano porque un índice escrito a mano envejece en silencio:
 * `tests/indice-de-decisiones.test.ts` falla si el archivo no es lo que este
 * script produce hoy, y el arreglo es correrlo.
 *
 * El ancla sale de `encabezadosDe` de `anclas-referenciadas.mjs`, el mismo
 * barrido que verifica los enlaces del repo: si se derivara acá por separado,
 * un desacuerdo entre los dos se vería como un índice que apunta a anclas
 * rotas.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { encabezadosDe } from './anclas-referenciadas.mjs';

/** El registro que se indexa, y el índice que se escribe. */
export const REGISTRO = 'docs/06-decisiones.md';
export const INDICE = 'docs/06-decisiones-indice.md';

/** Lo que el índice dice de sí mismo, arriba de la lista. */
const CABECERA = `# Índice de decisiones

Una línea por entrada de [\`06-decisiones.md\`](06-decisiones.md): id, título y
enlace a su ancla. Sirve para encontrar una decisión sin cargar el registro
entero.

**No se edita a mano.** Lo escribe \`npm run decisiones:indice\`, y
\`tests/indice-de-decisiones.test.ts\` falla si no coincide con los títulos de
hoy. Al agregar o renombrar una decisión, se corre el script en el mismo
cambio.

---
`;

/**
 * Las entradas `## D-nnn · Título` del registro, en orden, con su ancla.
 *
 * @param {string} contenido el texto de `06-decisiones.md`
 * @returns {{ id: string, titulo: string, ancla: string }[]}
 */
export const decisionesDe = (contenido) =>
  encabezadosDe(contenido)
    .filter((e) => e.nivel === 2)
    .map((e) => ({ e, m: /^(D-\d+)\s*·\s*(.*)$/.exec(e.texto) }))
    .filter(({ m }) => m !== null)
    .map(({ e, m }) => ({ id: m[1], titulo: m[2].trim(), ancla: e.ancla }));

/**
 * Las secciones `##` del registro que no son decisiones («Pendiente de
 * decidir», etc.), para que el índice también lleve a ellas.
 *
 * @param {string} contenido
 * @returns {{ texto: string, ancla: string }[]}
 */
const otrasSecciones = (contenido) =>
  encabezadosDe(contenido).filter((e) => e.nivel === 2 && !/^D-\d+\b/.test(e.texto));

/**
 * El índice completo, como texto.
 *
 * @param {string} contenido el texto de `06-decisiones.md`
 * @returns {string}
 */
export const indiceDe = (contenido) => {
  const lineas = decisionesDe(contenido).map(
    ({ id, titulo, ancla }) => `- [${id}](06-decisiones.md#${ancla}) · ${titulo}`,
  );
  const otras = otrasSecciones(contenido).map(
    ({ texto, ancla }) => `- [${texto}](06-decisiones.md#${ancla})`,
  );
  return (
    `${CABECERA}\n## Decisiones\n\n${lineas.join('\n')}\n` +
    (otras.length ? `\n## Otras secciones del registro\n\n${otras.join('\n')}\n` : '')
  );
};

// ── CLI ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const esperado = indiceDe(readFileSync(REGISTRO, 'utf8'));
  if (process.argv.includes('--verificar')) {
    let actual = '';
    try {
      actual = readFileSync(INDICE, 'utf8');
    } catch {
      // Sin archivo es lo mismo que desactualizado.
    }
    if (actual === esperado) {
      process.stdout.write(`${INDICE} al día\n`);
      process.exit(0);
    }
    process.stdout.write(`${INDICE} no coincide con ${REGISTRO}: corré npm run decisiones:indice\n`);
    process.exit(1);
  }
  writeFileSync(INDICE, esperado);
  process.stdout.write(`${INDICE}: ${decisionesDe(readFileSync(REGISTRO, 'utf8')).length} decisiones\n`);
}
