import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — el script es .mjs sin tipos, igual que `scripts/version.mjs`.
import { AREAS_PRODUCCION, ciclos, contarLineas, corpus, grafo } from '../scripts/salud-del-codigo.mjs';

/**
 * Lo que de `docs/10-salud-del-codigo.md` **sí** se puede atar — B-311.
 *
 * ── La decisión de qué NO se chequea, que es la mitad del diseño ───────────
 * Las cifras de ese documento (tamaño, concentración, prosa, fan-in) **no se
 * comparan contra el árbol acá**, y no por pereza: se mueven con cada commit de
 * cualquier frente. Un chequeo así se pondría rojo en la rama de alguien que no
 * tocó el documento, con un arreglo que no es suyo, y eso es lo que enseña a
 * saltearse los chequeos — el modo de falla que B-180 dejó escrito y que este
 * repo pagó dos veces. No hay umbral honesto que distinga «el documento quedó
 * viejo» de «alguien trabajó».
 *
 * La automatización de esas cifras es `scripts/salud-del-codigo.mjs`, que se
 * corre a mano y **avisa** en vez de bloquear. Está en `docs/08-operacion.md`.
 *
 * ── Lo que sí se chequea, y por qué cada uno tiene el rojo correcto ────────
 * 1. **Cero ciclos de import.** Es la única cifra del documento que es una
 *    propiedad y no una foto, y su rojo nunca es ajeno: un ciclo lo introduce el
 *    import que alguien acaba de escribir, y el mensaje nombra la cadena entera.
 * 2. **Los archivos que las tablas nombran existen.** Un renombre deja el
 *    documento apuntando al vacío; el rojo es de quien renombró y el arreglo es
 *    una línea. Misma clase que B-260 y B-660.
 * 3. **El criterio del documento y el del script no se separan.** Es lo que
 *    hace que la metodología escrita sea la que se aplica, en vez de una
 *    descripción de al lado que envejece sola — que es exactamente cómo este
 *    documento llegó a declarar 111 archivos con 180 en el árbol.
 */
const raiz = new URL('..', import.meta.url);
const doc = readFileSync(fileURLToPath(new URL('docs/10-salud-del-codigo.md', raiz)), 'utf8');

describe('salud del código — ciclos de import (B-311)', () => {
  it('cero ciclos, que es lo único que el documento afirma como propiedad', () => {
    const encontrados = ciclos(grafo());
    expect(
      encontrados.map((c: string[]) => c.join(' → ')),
      'apareció un ciclo de imports. El §1.5 de docs/10-salud-del-codigo.md ' +
        'afirma cero, y un ciclo no aparece por trabajo ajeno: lo introduce el ' +
        'import que se acaba de escribir.',
    ).toEqual([]);
  });

  it('el grafo mira archivos de verdad (control positivo)', () => {
    // Sin esto, un `corpus()` vacío daría cero ciclos sin haber mirado nada.
    const g = grafo();
    expect(g.size).toBeGreaterThan(100);
    const conImports = [...g.values()].filter((d) => (d as string[]).length > 0);
    expect(conImports.length).toBeGreaterThan(50);
  });
});

describe('salud del código — el documento no apunta al vacío (B-311)', () => {
  /** Los archivos del repo que el documento nombra entre backticks. */
  const nombrados = (): string[] => {
    const crudos = [
      ...doc.matchAll(/`((?:src|functions|scripts|tests)\/[A-Za-z0-9._/[\]-]+)`/g),
    ].map((m) => m[1]!);
    return [...new Set(crudos)];
  };

  it('nombra archivos de verdad (control positivo)', () => {
    expect(nombrados().length).toBeGreaterThan(20);
  });

  it('todos los archivos que nombra existen', () => {
    const inexistentes = nombrados().filter(
      (f) => !existsSync(fileURLToPath(new URL(f, raiz))),
    );
    expect(
      inexistentes,
      'docs/10-salud-del-codigo.md nombra archivos que no existen: una tabla de ' +
        'medición que apunta a un archivo borrado o renombrado ya no se puede ' +
        'comparar contra nada.',
    ).toEqual([]);
  });
});

describe('salud del código — la metodología escrita es la que se aplica (B-311)', () => {
  /*
   * El acuerdo que se rompe solo, y que es el que dejó al documento declarando
   * 111 archivos con 180 en el árbol: la prosa que describe cómo se contó y el
   * programa que cuenta viven en archivos distintos y nada los ata.
   *
   * Se atan las tres piezas del criterio que cambian el resultado: qué
   * extensiones entran al corpus, qué áreas son producción, y que el documento
   * nombre el script. Lo que **no** se ata es la redacción — el documento puede
   * explicar el criterio como quiera mientras nombre las mismas piezas.
   *
   * MUTACIÓN PROBADA: sacar `.astro` de EXTENSIONES en el script, o de la lista
   * del documento, hace fallar el primer caso.
   */
  const script = readFileSync(fileURLToPath(new URL('scripts/salud-del-codigo.mjs', raiz)), 'utf8');

  it('las extensiones del corpus son las mismas en el documento y en el script', () => {
    const enElScript = [...script.matchAll(/const EXTENSIONES = \[([^\]]+)\]/g)]
      .flatMap((m) => [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!))
      .sort();
    expect(enElScript.length, 'no se encontró EXTENSIONES en el script').toBeGreaterThan(3);

    // El documento las lista en su bloque de metodología, entre backticks.
    const bloque = doc.slice(doc.indexOf('**Corpus:**'), doc.indexOf('**Áreas:**'));
    const enElDoc = [...bloque.matchAll(/`(\.[a-z]+)`/g)].map((m) => m[1]!).sort();

    expect(
      enElDoc,
      'la lista de extensiones del §Metodología no coincide con la del script: ' +
        'el documento estaría describiendo un corpus que no es el que se mide.',
    ).toEqual(enElScript);
  });

  it('las áreas de producción son las mismas en el documento y en el script', () => {
    for (const area of AREAS_PRODUCCION as string[]) {
      expect(
        doc.includes(`\`${area}\``),
        `el script cuenta \`${area}\` como producción y el documento no la nombra`,
      ).toBe(true);
    }
  });

  it('el documento nombra el script, que es cómo se vuelve a medir', () => {
    expect(doc).toContain('scripts/salud-del-codigo.mjs');
  });

  it('`contarLineas` cuenta lo mismo que `wc -l`, que es lo que el documento dice', () => {
    // Se elige un archivo del corpus real en vez de un literal: así el caso
    // sigue midiendo el contador y no una string de este archivo.
    const alguno = (corpus() as string[]).find((f: string) => f.startsWith('src/lib/'))!;
    const texto = readFileSync(fileURLToPath(new URL(alguno, raiz)), 'utf8');
    const esperado = texto.endsWith('\n')
      ? texto.split('\n').length - 1
      : texto.split('\n').length;
    expect(contarLineas(texto).loc).toBe(esperado);
  });

  it('una línea con código y comentario al final cuenta como significativa', () => {
    // Es la parte del criterio que el documento explicita, y la que un cambio
    // de implementación podría invertir sin que ningún número lo delate.
    const c = contarLineas('const a = 1; // por qué\n\n// solo prosa\n');
    expect(c).toEqual({ loc: 3, blancas: 1, comentario: 1, significativas: 1 });
  });
});

/**
 * El conteo de tests no se escribe a mano — B-662.
 *
 * **El número que más veces envejeció de todo el repo.** `docs/README.md` y la
 * tabla de comandos de `docs/08-operacion.md` lo llevaban escrito, y en dos
 * semanas pasó por 2.148, 2.006, 2.039, 2.173 y 2.208 contra los 2.637 que mide
 * la suite hoy. Con el agravante de B-296: `README.md` llegó a tener el mismo
 * párrafo **tres veces**, con tres conteos distintos, porque tres frentes lo
 * actualizaron en paralelo y el merge los apiló.
 *
 * Un número que hay que actualizar a mano en un documento envejece siempre —
 * pero mientras tanto **miente con autoridad**, que es peor que no estar: quien
 * lo lee no tiene forma de saber que es viejo. El propio `auditor-documentacion`
 * tiene la instrucción «no cuentes los tests ni actualices ese número», así que
 * ni siquiera el auditor lo iba a arreglar.
 *
 * La solución no es un chequeo que compare el número (se pondría rojo cada vez
 * que alguien agrega un test, y sería B-180 otra vez): es que **el número no
 * esté**. La suite lo imprime al terminar. Este caso hace cumplir esa ausencia.
 *
 * **Alcance, y por qué es angosto.** Solo los dos documentos que describen el
 * repo *ahora*. `CHANGELOG.md`, `BACKLOG.md` y `10-salud-del-codigo.md` citan
 * conteos a propósito y con razón: son relatos fechados de una medición pasada,
 * y ahí el número viejo es el dato. Prohibirlo en todos lados convertiría este
 * chequeo en el que hay que saltear.
 *
 * MUTACIÓN PROBADA: volver a escribir «2.637 tests en 118 archivos» en
 * `docs/README.md` pone este caso en rojo nombrando la línea.
 */
describe('el conteo de tests no se escribe a mano en la doc de uso — B-662', () => {
  const DOCUMENTOS_DE_USO = ['docs/README.md', 'docs/08-operacion.md'];

  /*
   * Las formas en que este repo lo escribió: «2.173 tests», «97 archivos de
   * test», «tests en 93 archivos». Se busca el número pegado al sustantivo, no
   * cualquier número: `npm test` y `2 archivos que se saltean` no son conteos de
   * la suite.
   */
  const CONTEO = /\b\d[\d.,]{2,}\s+(?:tests|casos)\b|\btests\s+en\s+\d+\s+archivos\b|\b\d+\s+archivos\s+de\s+test\b/gi;

  it('ninguno de los dos documentos de uso lleva un conteo escrito', () => {
    const hallazgos: string[] = [];
    for (const documento of DOCUMENTOS_DE_USO) {
      const texto = readFileSync(fileURLToPath(new URL(documento, raiz)), 'utf8');
      for (const [i, linea] of texto.split('\n').entries()) {
        // La nota que explica por qué no se escribe cita los números viejos: es
        // el único lugar donde nombrarlos es el punto. Se reconoce por el `—`
        // de la enumeración de valores caducados.
        if (linea.includes('quedaron viejas') || linea.includes('quedó viejo')) continue;
        for (const m of linea.matchAll(CONTEO)) hallazgos.push(`${documento}:${i + 1} → ${m[0]}`);
      }
    }
    expect(
      hallazgos,
      'un conteo de la suite escrito a mano en un documento de uso. Ese número ' +
        'envejece siempre y mientras tanto miente con autoridad: la suite lo ' +
        'imprime al terminar (`Test Files` / `Tests`), y eso no puede quedar ' +
        'viejo. Ver la nota de docs/08-operacion.md § Comandos.',
    ).toEqual([]);
  });

  it('los documentos existen y se leyeron (control positivo)', () => {
    for (const documento of DOCUMENTOS_DE_USO) {
      const texto = readFileSync(fileURLToPath(new URL(documento, raiz)), 'utf8');
      expect(texto.length).toBeGreaterThan(1000);
    }
    // Y el regex reconoce las formas que este repo usó de verdad.
    expect('la suite corre 2.173 tests hoy'.match(CONTEO)).not.toBeNull();
    expect('2.208 tests en 97 archivos'.match(CONTEO)).not.toBeNull();
    expect('32 de los 59 archivos de test usan readFileSync'.match(CONTEO)).not.toBeNull();
    // Control negativo: no cualquier número es un conteo de la suite.
    expect('son 2 archivos que se saltean enteros'.match(CONTEO)).toBeNull();
  });
});
