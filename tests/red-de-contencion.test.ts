import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * La tabla «Qué se decidió no automatizar» de `docs/13-agentes.md` no se
 * rompe por merges — B-367 (duplicado de B-294, la misma cicatriz).
 *
 * **El daño que ya pasó dos veces, con el mismo mecanismo.** Varios frentes
 * tocan esta tabla en paralelo, y un merge sin criterio puede pegar dos filas
 * en una línea física con un `||` en el medio, o dejar una fila repetida con
 * dos versiones que se contradicen. El 2026-09-02 pasó de verdad: catorce
 * filas terminaron siendo once (B-294), con `color-de-tipo.test.ts` triplicado
 * y una fila fusionada con `sin-marcadores-de-conflicto.test.ts` detrás de un
 * `||`. Una fila fusionada **no renderiza como fila** — la mitad de su
 * contenido deja de leerse — y una fila triplicada dice, dos de cada tres
 * veces, una cobertura vieja. Esta tabla es justo lo que `auditor-trampas` y
 * `auditor-privacidad` consultan para no reportar lo que un test ya frena, así
 * que una copia desactualizada les hace reportar de más o de menos.
 *
 * El chequeo es el que B-367 proponía y B-294 no llegó a dejar escrito:
 * ninguna línea de la tabla tiene `||`, ninguna deja de empezar con `|`, y
 * ninguna celda de la primera columna se repite.
 */
const doc = readFileSync(
  fileURLToPath(new URL('../docs/13-agentes.md', import.meta.url)),
  'utf8',
);

/** Las líneas de la tabla, sin el título, sin la fila de encabezado ni la de separadores. */
const filasDeLaTabla = (): string[] => {
  const inicio = doc.indexOf('### Porque ya hay un test, y duplicarlo daría falsa cobertura');
  const fin = doc.indexOf('### Porque un agente no es la herramienta');
  if (inicio === -1 || fin === -1 || fin <= inicio) {
    throw new Error('no se encontraron los encabezados que delimitan la sección de la tabla');
  }
  return doc
    .slice(inicio, fin)
    .split('\n')
    .filter((l) => l.trim().length > 0)
    // El título de la sección y el encabezado/separador de la tabla no son filas de datos.
    .filter((l) => !l.startsWith('###'))
    .slice(2); // encabezado (`| Lo que...`) y separador (`|---|---|`)
};

describe('la tabla «no automatizar» no se rompe por merges — B-367/B-294', () => {
  it('tiene filas de verdad para chequear (si esto da 0, cambió el formato del documento)', () => {
    expect(filasDeLaTabla().length).toBeGreaterThan(30);
  });

  it('ninguna línea tiene `||` — dos filas fusionadas en una', () => {
    const fusionadas = filasDeLaTabla().filter((l) => l.includes('||'));
    expect(fusionadas, `líneas fusionadas:\n${fusionadas.join('\n')}`).toEqual([]);
  });

  it('toda línea de la tabla empieza con `|` — si no, dejó de ser una fila', () => {
    const rotas = filasDeLaTabla().filter((l) => !l.startsWith('|'));
    expect(rotas, `líneas que no empiezan con "|":\n${rotas.join('\n')}`).toEqual([]);
  });

  it('ninguna celda de la primera columna se repite', () => {
    const primeraColumna = filasDeLaTabla().map((l) => l.split('|')[1]?.trim() ?? '');
    const vistas = new Set<string>();
    const repetidas = primeraColumna.filter((c) => (vistas.has(c) ? true : (vistas.add(c), false)));
    expect(repetidas, `celdas repetidas:\n${repetidas.join('\n')}`).toEqual([]);
  });
});
