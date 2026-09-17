import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AREAS_PRODUCCION,
  ciclos,
  contarLineas,
  corpus,
  grafo,
  grafoEstatico,
} from '../scripts/salud-del-codigo.mjs';

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
    /*
     * **El grafo estático, no el completo** — 2026-09-07. Un `import()` diferido
     * no puede cerrar un ciclo de inicialización: se resuelve cuando la función
     * corre y no cuando el módulo se evalúa, así que ninguno de los dos ve al
     * otro a medio construir. El motivo largo está en `grafoEstatico`.
     */
    const encontrados = ciclos(grafoEstatico());
    expect(
      encontrados.map((c: string[]) => c.join(' → ')),
      'apareció un ciclo de imports. El §1.5 de docs/10-salud-del-codigo.md ' +
        'afirma cero, y un ciclo no aparece por trabajo ajeno: lo introduce el ' +
        'import que se acaba de escribir.',
    ).toEqual([]);
  });

  /*
   * **Los ciclos diferidos declarados son exactamente los que hay — B-1070.**
   *
   * Es el chequeo que el propio §1.5 pedía y que B-849 dejó sin escribir: «nada
   * verifica que este ciclo diferido siga siendo el único, ni que siga
   * existiendo. Si mañana nace otro `lazy(import())` circular, lo va a decir el
   * script y no un rojo; y si alguien rompe éste, esta sección queda vieja sin
   * que nada avise.»
   *
   * **Por qué es legítimo y las cifras del documento no** (B-180): un ciclo
   * —diferido o no— no aparece por trabajo ajeno. Lo introduce el `import()`
   * que alguien acaba de escribir, y el rojo nombra la cadena entera. Una cifra
   * de tamaño, en cambio, se mueve con cada commit de cualquiera.
   *
   * **Por qué se compara canonizado.** El DFS arranca por donde le toca, así
   * que el mismo ciclo puede salir rotado. Se rota al nodo menor antes de
   * comparar: lo que se afirma es el ciclo, no por dónde se entró.
   *
   * MUTACIÓN PROBADA: sacar una de las tres rutas del bloque del §1.5, o
   * convertir el `lazy(() => import('@/components/admin/ayuda/CentroAyuda'))`
   * de `AyudaDeSeccion.tsx` en un import estático, pone este caso en rojo
   * nombrando la diferencia.
   */
  describe('los ciclos diferidos declarados en el §1.5 son los que hay (B-1070)', () => {
    /** El ciclo, rotado a su nodo menor, para que dos rotaciones sean iguales. */
    const canonico = (cadena: string[]): string => {
      // El DFS devuelve el primer nodo repetido al final; se saca para rotar.
      const nodos = cadena.slice(0, -1);
      const menor = [...nodos].sort()[0]!;
      const i = nodos.indexOf(menor);
      const rotado = [...nodos.slice(i), ...nodos.slice(0, i)];
      return [...rotado, rotado[0]!].join(' → ');
    };

    /**
     * Los ciclos que el §1.5 declara, leídos de su bloque indentado.
     *
     * El formato es el que esa sección ya tenía: una ruta por línea con cuatro
     * espacios de sangría, las siguientes con `→ ` adelante, y una línea en
     * blanco entre un ciclo y el próximo.
     */
    const declarados = (): string[] => {
      const desde = doc.indexOf('### 1.5 Ciclos');
      const hasta = doc.indexOf('### 1.6', desde);
      const bloque = doc.slice(desde, hasta).split('\n');
      const cadenas: string[][] = [];
      let actual: string[] = [];
      for (const linea of bloque) {
        const m = /^ {4,}(?:→ )?((?:src|functions|scripts|tests)\/\S+)\s*$/.exec(linea);
        if (m) {
          actual.push(m[1]!);
          continue;
        }
        if (actual.length) {
          cadenas.push(actual);
          actual = [];
        }
      }
      if (actual.length) cadenas.push(actual);
      return cadenas.map(canonico).sort();
    };

    it('el §1.5 declara al menos un ciclo y se pudo leer (control positivo)', () => {
      expect(
        declarados().length,
        'no se pudo leer ningún ciclo del bloque indentado del §1.5 de ' +
          'docs/10-salud-del-codigo.md: o se declararon cero ciclos, o cambió ' +
          'el formato del bloque y hay que reescribir el lector de este caso.',
      ).toBeGreaterThan(0);
    });

    it('los ciclos del grafo completo son exactamente los declarados', () => {
      const encontrados = (ciclos(grafo()) as string[][]).map(canonico).sort();
      expect(
        encontrados,
        'los ciclos del grafo completo no son los que el §1.5 de ' +
          'docs/10-salud-del-codigo.md declara. Si nació uno, hay que ' +
          'declararlo ahí con su motivo y con qué lo volvería un problema; si ' +
          'desapareció, hay que sacarlo — una sección que declara un ciclo que ' +
          'ya no existe es la que envejece sin que nada avise.',
      ).toEqual(declarados());
    });
  });

  it('el grafo mira archivos de verdad (control positivo)', () => {
    // Sin esto, un `corpus()` vacío daría cero ciclos sin haber mirado nada.
    const g = grafo();
    expect(g.size).toBeGreaterThan(100);
    const conImports = [...g.values()].filter((d) => (d as string[]).length > 0);
    expect(conImports.length).toBeGreaterThan(50);
  });

  /*
   * **El regex `IMPORTS` no pierde el import multilínea — B-877.**
   *
   * La clase negada del primer alternativo llevaba un `\n`, así que un
   * `import { ... } from` con las llaves abiertas en varias líneas quedaba
   * afuera del grafo entero: 234 aristas en 180 archivos del corpus, cero
   * ciclos verificados sobre un grafo al que le faltaba el 16 %.
   *
   * El caso de control es un archivo real del corpus, no una string sintética:
   * `functions/analitica-trigger.js` importa `RETRASO`, `ventanas` y compañía
   * de `./analitica.js` con el import abierto en varias líneas — es el import
   * real del archivo, así que un cambio de estilo ajeno no lo hace desaparecer
   * solo (la lista de nombres es incidental; lo que se verifica es la arista).
   *
   * MUTACIÓN PROBADA: volver a agregar `\n` a la clase negada
   * (`[^'"\n]*?` en vez de `[^'"]*?`) pone este caso en rojo — la arista
   * desaparece del grafo aunque el import siga ahí.
   */
  it('un import multilínea real del corpus entra al grafo (B-877, caso de control)', () => {
    const origen = 'functions/analitica-trigger.js';
    const destino = 'functions/analitica.js';
    const src = readFileSync(fileURLToPath(new URL(origen, raiz)), 'utf8');
    expect(
      src,
      `el caso de control asume que ${origen} importa de ${destino} con las ` +
        'llaves abiertas en varias líneas; si esto cambió, hay que reelegir el ' +
        'archivo de control',
    ).toMatch(/import\s*\{\n[^}]*\}\s*from\s*'\.\/analitica\.js'/);

    const g = grafo();
    expect(
      g.get(origen),
      `${origen} → ${destino} es un import multilínea real: si no aparece acá, ` +
        'el regex IMPORTS volvió a angostarse',
    ).toContain(destino);
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

  /*
   * El gemelo del caso de arriba, para JSX — B-878.
   *
   * `l.startsWith('/*')` no reconoce `{/* … *\/}`: una línea de comentario JSX
   * empieza con `{`, no con `/`, así que caía en el `else` y contaba como
   * significativa. Mismo texto que el caso de arriba, cambiando el comentario
   * de línea por uno JSX de una sola línea, para que sea el gemelo exacto.
   *
   * MUTACIÓN PROBADA: revertir el `|| l.startsWith('{/*')` de `contarLineas`
   * pone este caso en rojo — `significativas` pasa de 1 a 2.
   */
  it('una línea de comentario JSX ({/* … */}) cuenta como comentario, no como significativa', () => {
    const c = contarLineas('<p>hola</p>\n\n{/* solo prosa */}\n');
    expect(c).toEqual({ loc: 3, blancas: 1, comentario: 1, significativas: 1 });
  });

  /*
   * El patrón real del corpus no cierra en la misma línea — ver
   * `src/components/admin/ActividadFormulario.tsx`, donde el comentario JSX
   * abre con `{/*` solo en su línea y cierra varias líneas después con `*\/}`.
   * Sin el `|| l.startsWith('{/*')`, ninguna de las tres líneas de prosa caía
   * en `enBloque` y las tres contaban como significativas.
   */
  it('un bloque de comentario JSX multilínea cuenta entero como comentario', () => {
    const c = contarLineas('<div>\n  {/*\n    prosa\n    más prosa\n  */}\n  <p>hola</p>\n</div>\n');
    expect(c).toEqual({ loc: 7, blancas: 0, comentario: 4, significativas: 3 });
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
 * **Las dos formas, y por qué la segunda es la que importa (B-858).** La
 * mutación original de este caso —volver a escribir «2.637 tests en 118
 * archivos» en `docs/README.md`— era cierta, y no alcanzaba: probaba la forma
 * que el chequeo ya sabía leer. El número **pegado** al sustantivo es la forma
 * de laboratorio. La que una persona escribe de verdad, cuando quiere que el
 * dato se vea, es «**107** de esos tests … repartidos en **9** archivos»: con
 * la negrita de markdown en el medio, con un «de esos» entre el número y el
 * sustantivo, y con la mitad del conteo colgada de «archivos» en otra oración.
 * Ninguna de las tres entraba en el regex viejo, así que el chequeo estuvo en
 * verde **sobre exactamente la copia que existe para atrapar**:
 * `docs/README.md` llevaba escrito «107 en 9» cuando la medición decía 210 en
 * 15. Un chequeo que solo reconoce la forma sintética no protege nada — la
 * forma humana es la que llega al documento.
 *
 * MUTACIÓN PROBADA, las dos formas:
 * - la pegada: escribir «2.637 tests en 118 archivos» en `docs/README.md`;
 * - la humana: escribir «**107** de esos tests … repartidos en **9**
 *   archivos» en el paso «Correr los tests».
 * Cada una pone este caso en rojo nombrando la línea.
 */
describe('el conteo de tests no se escribe a mano en la doc de uso — B-662', () => {
  const DOCUMENTOS_DE_USO = ['docs/README.md', 'docs/08-operacion.md'];

  /*
   * La negrita de markdown no cambia el número: `**107**` es `107` escrito por
   * alguien que quiere que se vea, que es justamente cómo llega al documento.
   * Se saca antes de mirar la línea.
   */
  const sinEnfasis = (linea: string) => linea.replace(/\*+|_{2}/g, '');

  /*
   * Las formas en que este repo lo escribió: «2.173 tests», «97 archivos de
   * test», «tests en 93 archivos» y —la que se le escapó al chequeo— «**107**
   * de esos tests». Entre el número y el sustantivo se admite un «de …», que
   * es el nexo que una persona escribe; la lista de determinantes es cerrada a
   * propósito: con un comodín libre, «B-219 los tests corren contra…» de
   * `08-operacion.md` entraría, y el número sería el del ticket.
   */
  const CONTEO =
    /\b\d[\d.,]*(?:\s+de(?:\s+(?:esos|esas|estos|estas|los|las|sus))?)?\s+(?:tests|casos)\b|\btests\s+en\s+\d+\s+archivos\b|\b\d+\s+archivos\s+de\s+test\b/gi;

  /*
   * La otra mitad del conteo: «repartidos en **9** archivos». No lleva la
   * palabra `test` al lado —puede estar dos oraciones más arriba—, así que no
   * se puede reconocer por adyacencia. Se reconoce por el **párrafo**: un
   * número pegado a «archivos» dentro de un párrafo que habla de la suite.
   *
   * El contexto no es decoración. Sin él, `08-operacion.md` § «Remedir la
   * salud del código» se pondría rojo por «llegó a declarar 111 archivos de
   * producción», que es un relato fechado y no un conteo de la suite: sería el
   * chequeo ruidoso que se aprende a saltear (B-180).
   */
  const CONTEO_DE_ARCHIVOS = /\b\d[\d.,]*\s+archivos\b/gi;
  const HABLA_DE_LA_SUITE = /\b(?:tests?|casos|suite|vitest)\b/i;

  /** Para cada línea, si el párrafo que la contiene habla de la suite. */
  const contextoDeSuite = (lineas: string[]): boolean[] => {
    const marca = new Array<boolean>(lineas.length).fill(false);
    let desde = 0;
    const cerrar = (hasta: number) => {
      if (HABLA_DE_LA_SUITE.test(lineas.slice(desde, hasta).join(' ')))
        for (let i = desde; i < hasta; i++) marca[i] = true;
    };
    lineas.forEach((linea, i) => {
      if (linea.trim() === '') {
        cerrar(i);
        desde = i + 1;
      }
    });
    cerrar(lineas.length);
    return marca;
  };

  /** Los conteos escritos a mano que tiene un documento, con línea y texto. */
  const conteosEscritos = (documento: string, texto: string): string[] => {
    const lineas = texto.split('\n');
    const enSuite = contextoDeSuite(lineas);
    const hallazgos = new Set<string>();
    lineas.forEach((cruda, i) => {
      // La nota que explica por qué no se escribe cita los números viejos: es
      // el único lugar donde nombrarlos es el punto. Se reconoce por el `—`
      // de la enumeración de valores caducados.
      if (cruda.includes('quedaron viejas') || cruda.includes('quedó viejo')) return;
      const linea = sinEnfasis(cruda);
      for (const m of linea.matchAll(CONTEO)) hallazgos.add(`${documento}:${i + 1} → ${m[0]}`);
      if (!enSuite[i]) return;
      for (const m of linea.matchAll(CONTEO_DE_ARCHIVOS))
        hallazgos.add(`${documento}:${i + 1} → ${m[0]}`);
    });
    return [...hallazgos];
  };

  it('ninguno de los dos documentos de uso lleva un conteo escrito', () => {
    const hallazgos: string[] = [];
    for (const documento of DOCUMENTOS_DE_USO) {
      const texto = readFileSync(fileURLToPath(new URL(documento, raiz)), 'utf8');
      hallazgos.push(...conteosEscritos(documento, texto));
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

  /*
   * La forma humana — B-858. Es la que estuvo escrita en `docs/README.md`
   * mientras este chequeo daba verde, así que se prueba sobre texto sintético
   * para que no vuelva a depender de que el documento la tenga.
   */
  it('reconoce el conteo con negrita y con nexo, que es como lo escribe una persona', () => {
    expect(sinEnfasis('**107** de esos tests').match(CONTEO)).not.toBeNull();
    expect(sinEnfasis('**210** de los casos').match(CONTEO)).not.toBeNull();
    // Dos dígitos: el regex viejo exigía tres caracteres y no los veía.
    expect(sinEnfasis('**15** tests').match(CONTEO)).not.toBeNull();
    // Y el nexo no puede tragarse un id de ticket: «B-219 los tests corren…».
    expect(sinEnfasis('Desde B-219 los tests corren contra otra base').match(CONTEO)).toBeNull();
  });

  it('la mitad colgada de «archivos» se reconoce por el párrafo, no por adyacencia', () => {
    const conSuite = [
      '2. **Correr los tests.** `npm test`.',
      '   necesitan los emuladores, repartidos en **9** archivos: siete enteros.',
    ].join('\n');
    expect(conteosEscritos('doc.md', conSuite)).toEqual(['doc.md:2 → 9 archivos']);

    // Mismo texto, párrafo que no habla de la suite: no es un conteo de la
    // suite y no se reporta. Es el caso real de `08-operacion.md`.
    const sinSuite = 'no se remedía: llegó a declarar 111 archivos de producción.';
    expect(conteosEscritos('doc.md', sinSuite)).toEqual([]);
  });
});

/**
 * El conteo de la suite se escribe **una vez** en este documento — B-1071.
 *
 * ── Qué pasó ───────────────────────────────────────────────────────────────
 * El 2026-09-09 el documento quedó afirmando dos cosas distintas del mismo día:
 * «`npm test` corre **4.044 casos en 179 archivos**» en el §1.1 (al cerrar
 * B-849) y «al 2026-09-09 son **3.968 casos en 178 archivos**» en el §2 (al
 * cerrar B-806). Las dos eran ciertas cuando se escribieron —seis commits las
 * separan— y las dos quedaron viejas; pero como ninguna decía **sobre qué
 * árbol** se había contado, leerlas no permitía decidir cuál era la buena. Y
 * ningún test podía verlo: son dos afirmaciones de prosa, no un valor derivado.
 *
 * ── Por qué este chequeo y no el obvio ─────────────────────────────────────
 * El obvio —comparar el número contra la suite— es B-180 con otra cara: se
 * pondría rojo cada vez que cualquiera agrega un test. Y la respuesta de B-662
 * —que el número no esté— no aplica acá: en este documento el número **es** el
 * contenido, es una medición fechada, y por eso `10-salud-del-codigo.md` está
 * excluido a propósito del alcance de aquel chequeo.
 *
 * Lo que sí se puede exigir, y es lo que faltaba, es que haya **una sola copia
 * viva**. El número puede quedar viejo —va a quedar viejo—, pero viejo en un
 * solo lugar es un dato con fecha; viejo en dos lugares que no coinciden es un
 * documento que se contradice a sí mismo. Su rojo nunca es ajeno: lo produce
 * quien escribe la segunda copia, en el commit en que la escribe.
 *
 * ── Qué cuenta como copia viva ─────────────────────────────────────────────
 * Las líneas de cita (`>`) quedan afuera: son el registro de las mediciones
 * anteriores, que este documento conserva a propósito —«la medición vieja no se
 * borra: baja a su fila con su fecha»—. Prohibirlas ahí borraría la serie, que
 * es la mitad del valor del archivo.
 *
 * MUTACIÓN PROBADA: volver a escribir «4.044 casos en 179 archivos» en el §1.1,
 * fuera de una cita, pone este caso en rojo nombrando las dos líneas.
 */
describe('el conteo de la suite se escribe una sola vez — B-1071', () => {
  /*
   * El `\s+` entre las piezas no es cosmético: este documento envuelve a 80
   * columnas, y la copia que abrió la contradicción estaba partida en dos
   * líneas («son 3.968 casos en 178 / archivos»). Un regex que mirara línea por
   * línea no la veía — o sea, daría verde sobre exactamente el caso que existe
   * para atrapar, que es cómo B-858 encontró roto al chequeo de B-662.
   */
  const CONTEO_DE_LA_SUITE = /\b[\d.]+\s+casos\s+en\s+\d+\s+archivos\b/gi;
  const sinEnfasisAcá = (texto: string) => texto.replace(/\*+|_{2}/g, '');

  /** Las líneas vivas que llevan el conteo: `archivo:línea → texto`. */
  const copiasVivas = (): string[] => {
    // Las citas son la serie histórica y se conservan a propósito: se vacían
    // en vez de sacarse, para que los números de línea sigan siendo los del
    // archivo y el mensaje del rojo se pueda abrir directo.
    const vivas = doc
      .split('\n')
      .map((l) => (l.trimStart().startsWith('>') ? '' : sinEnfasisAcá(l)))
      .join('\n');
    return [...vivas.matchAll(CONTEO_DE_LA_SUITE)].map((m) => {
      const linea = vivas.slice(0, m.index).split('\n').length;
      return `docs/10-salud-del-codigo.md:${linea} → ${m[0].replace(/\s+/g, ' ')}`;
    });
  };

  it('hay exactamente una copia viva del conteo', () => {
    expect(
      copiasVivas(),
      'el conteo de casos de la suite está escrito más de una vez fuera de una ' +
        'cita en docs/10-salud-del-codigo.md. Dos copias vivas se desincronizan ' +
        '—pasó el 2026-09-09, 4.044 contra 3.968— y desde afuera no hay forma ' +
        'de saber cuál vale. Va en el §6.1, y el resto apunta ahí.',
    ).toHaveLength(1);
  });

  it('el regex reconoce las formas que este documento usó de verdad', () => {
    expect(sinEnfasisAcá('**4.044 casos en 179 archivos**').match(CONTEO_DE_LA_SUITE)).not.toBeNull();
    expect(sinEnfasisAcá('son **3.968 casos en 178 archivos**').match(CONTEO_DE_LA_SUITE)).not.toBeNull();
    // La forma partida por el envoltorio a 80 columnas, que es la que hubo.
    expect('son 3.968 casos en 178\narchivos y el argumento'.match(CONTEO_DE_LA_SUITE)).not.toBeNull();
    // Control negativo: los casos de render se cuentan aparte y no llevan
    // «en N archivos» pegado.
    expect('son 155 casos de render'.match(CONTEO_DE_LA_SUITE)).toBeNull();
  });
});
