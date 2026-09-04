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

/**
 * Los hooks que disparan al `auditor-privacidad` están cableados de verdad —
 * B-124, D-350.
 *
 * **Clase de bug: un hook que no hace nada y nadie se entera.** Es la de
 * `tests/agentes-y-skills.test.ts` (un frontmatter inválido hace que el agente
 * se ignore sin ningún error visible) una capa más arriba. Acá los modos de
 * falla son tres, y los tres dejan el repo en verde:
 *
 * 1. `.claude/settings.json` con JSON inválido → Claude Code **descarta el
 *    archivo entero**, así que se pierden los tres hooks de golpe.
 * 2. El comando apunta a un script que se renombró → el hook corre, falla, y
 *    —por la regla anti-B-180 de `hook-auditores.mjs`, que sale con 0 ante
 *    cualquier excepción— el silencio es total.
 * 3. El modo que el comando pasa no existe en el script → el script sale con 0
 *    sin verificar nada. Un `parada` mal escrito no avisa nunca.
 *
 * El chequeo ata las dos puntas: los modos que `settings.json` invoca tienen
 * que ser modos que el script implementa, y al revés.
 */
describe('el disparo automático del auditor está cableado — B-124', () => {
  const raiz = new URL('..', import.meta.url);
  const settings = readFileSync(fileURLToPath(new URL('.claude/settings.json', raiz)), 'utf8');
  const script = readFileSync(fileURLToPath(new URL('scripts/hook-auditores.mjs', raiz)), 'utf8');

  /** Los comandos de hook declarados, con el evento en el que están. */
  const comandos = (): { evento: string; command: string }[] => {
    const config = JSON.parse(settings) as {
      hooks?: Record<string, { hooks?: { type?: string; command?: string }[] }[]>;
    };
    return Object.entries(config.hooks ?? {}).flatMap(([evento, grupos]) =>
      grupos.flatMap((g) =>
        (g.hooks ?? [])
          .filter((h) => h.type === 'command' && typeof h.command === 'string')
          .map((h) => ({ evento, command: h.command! })),
      ),
    );
  };

  it('`.claude/settings.json` es JSON válido', () => {
    // Modo de falla 1. Un JSON roto descarta el archivo completo, sin error.
    expect(() => JSON.parse(settings)).not.toThrow();
  });

  it('están los tres eventos que la decisión necesita', () => {
    /*
     * `Stop` avisa al terminar el turno; `PreToolUse` frena el `git commit`,
     * que es donde el aviso tiene que valer (después del commit el árbol queda
     * limpio y el `Stop` ya no ve el cambio); `PostToolUse` sella lo auditado.
     * Sin el tercero el gate no se puede satisfacer nunca, y un gate que no se
     * puede satisfacer se aprende a saltear — B-180.
     */
    const eventos = [...new Set(comandos().map((c) => c.evento))].sort();
    expect(eventos).toEqual(['PostToolUse', 'PreToolUse', 'Stop']);
  });

  it('cada comando apunta a un script que existe', () => {
    // Modo de falla 2.
    const rotos = comandos()
      .map((c) => ({ ...c, ruta: /scripts\/[\w.-]+\.mjs/.exec(c.command)?.[0] }))
      .filter((c) => !c.ruta || !existsSync(fileURLToPath(new URL(c.ruta, raiz))));
    expect(rotos.map((r) => `${r.evento}: ${r.command}`)).toEqual([]);
  });

  it('los modos que invoca son modos que el script implementa', () => {
    /*
     * Modo de falla 3, y el que vale: un modo mal escrito hace que el hook
     * corra, no encuentre nada que hacer y salga con 0. El gate deja de existir
     * sin que nada lo diga.
     */
    const implementados = [...script.matchAll(/^ {2}(\w+)\(\) \{$/gm)].map((m) => m[1]!);
    // Control positivo: si el regex dejara de encontrar los modos, la
    // comparación de abajo pasaría contra una lista vacía.
    expect(implementados.length).toBeGreaterThanOrEqual(3);

    const invocados = comandos().map((c) => c.command.trim().split(/\s+/).pop()!);
    expect(invocados.filter((m) => !implementados.includes(m)), 'modos inexistentes').toEqual([]);
    // Y al revés: un modo implementado que nadie invoca es código muerto que
    // parece cobertura.
    expect(implementados.filter((m) => !invocados.includes(m)), 'modos que nadie invoca').toEqual([]);
  });

  it('el hook del commit mira el tool `Bash` y el del sello el de sub-agentes', () => {
    const config = JSON.parse(settings) as { hooks: Record<string, { matcher?: string }[]> };
    expect(config.hooks.PreToolUse!.map((g) => g.matcher)).toEqual(['Bash']);
    // `Task` es el nombre del tool de sub-agentes y `Agent` su alias: los dos
    // están a propósito. Con el matcher equivocado el sello no se escribe
    // nunca, y entonces el gate del commit es imposible de satisfacer.
    expect(config.hooks.PostToolUse!.map((g) => g.matcher)).toEqual(['Task|Agent']);
  });

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
      /*
       * Fuera: bloques de código, filas de tabla y bloques indentados — los tres
       * pasan de 100 legítimamente.
       *
       * La fila de tabla se reconoce **después de recortar los espacios**: una
       * tabla anidada dentro de una viñeta va indentada dos espacios y sigue
       * siendo una tabla. Sin el `trim` este chequeo reportaba las tres filas de
       * la tabla de B-122, que es reportar de más — o sea, el camino más corto a
       * que alguien afloje el umbral en vez de mirar el hallazgo.
       */
      if (enCodigo || linea.trim().startsWith('|') || linea.startsWith('    ')) continue;
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
