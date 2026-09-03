import { existsSync, readFileSync } from 'node:fs';
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

/*
 * Las dos mitades que a B-294 le faltaban — B-660.
 *
 * B-294 se cerró **a mano**: alguien verificó que los 41 nombres de test que la
 * tabla citaba existieran, y que no hubiera quedado ninguna línea fusionada en
 * la sección de abajo. Las dos verificaciones eran correctas y ninguna quedó
 * escrita, así que el documento volvía a poder envejecer por los mismos dos
 * caminos. Estas son esas dos, derivadas del árbol y no de una lista:
 *
 * 1. **El índice apunta a archivos que existen.** Es la misma clase que B-260
 *    cerró para la ficha del `auditor-privacidad`
 *    (`tests/agentes-y-skills.test.ts`) y que acá no estaba: un test renombrado
 *    deja la fila apuntando a un archivo que no está, y quien consulte «quién
 *    verifica esto» concluye que no lo verifica nadie — que es peor que no
 *    tener la tabla, porque invita a escribir el agente que la fila decía que
 *    no hacía falta.
 * 2. **Ninguna línea de prosa quedó pegada a otra.** La sección «Porque un
 *    agente no es la herramienta» es una lista de viñetas y no una tabla, así
 *    que el chequeo de `||` de arriba no la mira; el 2026-09-03 tenía una línea
 *    de 115 caracteres donde el resto del documento envuelve a 80, y era
 *    exactamente eso: dos oraciones que un merge dejó en la misma línea física.
 *    Se mide el largo porque es la señal genérica de «un merge pegó dos cosas»,
 *    y no hay ninguna lista que mantener.
 *
 * **Por qué el largo no se puede poner rojo por algo ajeno** (B-180): el umbral
 * es 100 con el documento envuelto a 80, se aplica **solo a este archivo**, y
 * las filas de tabla y los bloques de código quedan afuera — o sea que la única
 * forma de romperlo es escribir la línea larga uno mismo.
 *
 * MUTACIÓN PROBADA: poner `tests/inexistente.test.ts` en una fila hace fallar el
 * segundo caso; volver a pegar las dos oraciones del 2026-09-03 en una línea
 * hace fallar el tercero.
 */
describe('el índice de la tabla «no automatizar» no apunta al vacío — B-660', () => {
  /**
   * Los tests que el documento nombra, con o sin el prefijo `tests/`.
   *
   * `x.test.ts` se excluye a mano y es el único: no es una referencia, es el
   * marcador de posición de la frase que le dice al auditor cómo dejar escrita
   * una celda ya cubierta («cubierto por `tests/x.test.ts`, no lo reportes»).
   */
  const nombrados = (): string[] => {
    const crudos = [...doc.matchAll(/`(?:tests\/)?([A-Za-z0-9._-]+\.test\.tsx?)`/g)].map(
      (m) => m[1]!,
    );
    return [...new Set(crudos)].filter((n) => n !== 'x.test.ts');
  };

  it('nombra tests de verdad (control positivo: si da poco, el regex dejó de encontrarlos)', () => {
    expect(nombrados().length).toBeGreaterThan(30);
  });

  it('todos los tests que nombra existen', () => {
    const inexistentes = nombrados().filter(
      (n) => !existsSync(fileURLToPath(new URL(`../tests/${n}`, import.meta.url))),
    );
    expect(
      inexistentes,
      'docs/13-agentes.md nombra tests que no existen: la fila afirma que algo ya ' +
        'está verificado y apunta a un archivo borrado o renombrado.',
    ).toEqual([]);
  });

  it('ninguna línea de prosa quedó pegada a otra por un merge', () => {
    const LIMITE = 100;
    let enCodigo = false;
    const largas: string[] = [];
    for (const [i, linea] of doc.split('\n').entries()) {
      if (linea.trim().startsWith('```')) {
        enCodigo = !enCodigo;
        continue;
      }
      // Fuera: bloques de código, filas de tabla y bloques indentados — los tres
      // pasan de 100 legítimamente.
      if (enCodigo || linea.startsWith('|') || linea.startsWith('    ')) continue;
      if (linea.length > LIMITE) largas.push(`${i + 1}: (${linea.length}) ${linea.slice(0, 90)}…`);
    }
    expect(
      largas,
      `líneas de prosa de más de ${LIMITE} caracteres en un documento envuelto a 80 — ` +
        'lo más probable es que un merge haya pegado dos oraciones en la misma línea:\n' +
        largas.join('\n'),
    ).toEqual([]);
  });
});
