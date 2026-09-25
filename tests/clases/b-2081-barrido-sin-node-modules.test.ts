/**
 * B-2081: un barrido recursivo que alcanza `functions/` o la raíz saltea
 * `node_modules`.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 *
 * ── La clase ──────────────────────────────────────────────────────────────
 * Van cuatro instancias con la misma forma: un barrido de un test que recorre el
 * disco —un `grep -r`, un `readdirSync` recursivo— con un alcance que incluye
 * `functions/` o la raíz, y sin saltear `node_modules`. En el árbol principal eso
 * es bajar a `functions/node_modules` (182 MB) y al de la raíz: el último,
 * B-2041, era 0,40 s contra 0,015 s y con la suite en paralelo pasaba los 5 s del
 * timeout; el de `normalize('NFD')` de `tests/ciudades.test.ts` tardaba 6,4 s.
 *
 * **Y es invisible donde se escribe.** En un worktree de agente `node_modules` es
 * un symlink, y ni `grep -r` ni `readdirSync` siguen symlinks: el caso tarda
 * 70 ms ahí y se vuelve lento recién al integrar. Por eso esto lee el **fuente**
 * y no mide nada: medir daría verde justo en el árbol donde se escribe el bug.
 *
 * ── Qué se mira ───────────────────────────────────────────────────────────
 * Los archivos de `tests/` y `scripts/` (rastreados y no rastreados), sin sus
 * comentarios —los docblocks de este repo **nombran** el `grep -r functions` que
 * se está prohibiendo—, en tres formas:
 *
 *  1. un `grep` recursivo (`-r`, `-R`, `--recursive`) escrito como comando: en un
 *     `.sh`, o en un string de JS que empieza el comando (`execSync(\`grep …\`)`,
 *     `['-c', 'git ls-files | grep …']`);
 *  2. un `grep` recursivo por `execFileSync('grep', [ … ])`, con los argumentos
 *     en un array literal;
 *  3. un `readdirSync`/`readdir` recursivo: con `{ recursive: true }`, o dentro
 *     de una función que se llama a sí misma.
 *
 * El alcance es peligroso cuando es `functions`, `.` o la raíz (`raiz`, `RAIZ`,
 * `process.cwd()`), o cuando un `grep -r` no nombra ruta —recorre el directorio
 * actual—. Un `{ recursive: true }` sobre esos alcances es rojo siempre: el
 * recorrido nativo no se puede podar, filtrar el resultado después no ahorra la
 * bajada.
 *
 * **Lo que no ve**, y es a propósito: los argumentos que no son literales y no se
 * pueden resolver en el mismo archivo (el `grep` de
 * `tests/comandos-de-los-skills.test.ts` corre comandos leídos de los skills).
 * Adivinar ahí sería el falso positivo que enseña a saltear el chequeo.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { archivosDelRepo } from '../fixtures/archivos-del-repo';
import { sinComentariosConFormato } from '../../scripts/sin-comentarios.mjs';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const ESTE_ARCHIVO = 'tests/clases/b-2081-barrido-sin-node-modules.test.ts';

// ─────────────────────────────────────────────────────────────────────
// El alcance
// ─────────────────────────────────────────────────────────────────────

/**
 * ¿Esta ruta, tal como está escrita, es `functions/`, `.` o la raíz?
 *
 * Se normaliza la interpolación de la raíz (`${raiz}`, `$RAIZ`, `"$RAIZ"`) a una
 * sola marca y se compara la ruta **entera**: `src/lib`, `functions/lib` o
 * `$RAIZ/src` no tienen `node_modules` adentro y no cuentan.
 */
const RE_ALCANCE_PELIGROSO =
  /^(?:\.|\.\/|\.\/functions\/?|functions\/?|RAIZ\/?|RAIZ\/functions\/?|RAIZ\/\.\/?)$/;

const normalizarRuta = (ruta: string): string =>
  ruta
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(
      /\$\{(?:raiz|RAIZ|ROOT|REPO|RAIZ_DEL_REPO|process\.cwd\(\))\}|\$\{?(?:RAIZ|ROOT|REPO|RAIZ_DEL_REPO|PWD)\}?|\$\(pwd\)|\$\(git rev-parse --show-toplevel\)/g,
      'RAIZ',
    );

const esAlcancePeligroso = (ruta: string): boolean =>
  RE_ALCANCE_PELIGROSO.test(normalizarRuta(ruta));

/** Una expresión de JS que es la raíz del repo, sin subruta. */
const RE_EXPRESION_RAIZ =
  /^(?:fileURLToPath\()?(?:raiz|RAIZ|ROOT|process\.cwd\(\)|new URL\(\s*['"]\.\.?\/?(?:\.\.\/?)*['"]\s*,\s*import\.meta\.url\s*\))\)?$/;

// ─────────────────────────────────────────────────────────────────────
// 1 y 2 · `grep -r`
// ─────────────────────────────────────────────────────────────────────

/** Opciones de `grep` cuyo valor va en el token siguiente. */
const CON_VALOR_APARTE = new Set([
  '-e', '-f', '-m', '-A', '-B', '-C', '-d', '-D',
  '--regexp', '--file', '--max-count', '--include', '--exclude', '--exclude-dir',
  '--context', '--after-context', '--before-context',
]);

type Grep = { recursivo: boolean; excluye: boolean; rutas: string[] };

/**
 * Lee los argumentos de un `grep`: si es recursivo, si excluye `node_modules` y
 * qué rutas recorre. El primer posicional es el patrón salvo que haya `-e`/`-f`.
 */
const leerGrep = (args: string[]): Grep => {
  let recursivo = false;
  let excluye = false;
  let conPatronExplicito = false;
  const posicionales: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const limpio = a.replace(/^["']|["']$/g, '');
    if (limpio === '--') {
      posicionales.push(...args.slice(i + 1));
      break;
    }
    if (limpio.startsWith('--')) {
      const [nombre, valor] = limpio.split('=', 2) as [string, string | undefined];
      if (nombre === '--recursive' || nombre === '--dereference-recursive') recursivo = true;
      if (nombre === '--regexp' || nombre === '--file') conPatronExplicito = true;
      const v = valor ?? (CON_VALOR_APARTE.has(nombre) ? args[++i] ?? '' : '');
      if (nombre === '--exclude-dir' && /\bnode_modules\b/.test(v)) excluye = true;
      continue;
    }
    if (/^-[a-zA-Z]/.test(limpio)) {
      const letras = limpio.slice(1);
      if (/[rR]/.test(letras)) recursivo = true;
      if (/[ef]/.test(letras)) conPatronExplicito = true;
      // La última letra de un grupo puede llevar su valor aparte (`-rne patrón`).
      if (CON_VALOR_APARTE.has(`-${letras.at(-1)}`) && letras.length >= 1) i++;
      continue;
    }
    posicionales.push(a);
  }
  const rutas = conPatronExplicito ? posicionales : posicionales.slice(1);
  return { recursivo, excluye, rutas };
};

/** Un `grep` recursivo que baja a `node_modules`: el alcance es peligroso y no lo excluye. */
const bajaANodeModules = (g: Grep, esPeligrosa: (r: string) => boolean): boolean =>
  g.recursivo && !g.excluye && (g.rutas.length === 0 || g.rutas.some(esPeligrosa));

/** Los tokens de un comando de shell desde después de `grep` hasta el fin del comando. */
const tokensDeComando = (resto: string): string[] => {
  const tokens: string[] = [];
  for (const m of resto.matchAll(/'[^']*'|"(?:[^"\\]|\\.)*"|[^\s'"]+/g)) {
    let t = m[0];
    if (/^(?:\||\|\||&&|;|&|>|2>|<|#|\))/.test(t) || t === '}') break;
    const corte = t.search(/[;)|`]|&&/);
    if (corte !== -1 && !/^["']/.test(t)) {
      t = t.slice(0, corte);
      if (t) tokens.push(t);
      break;
    }
    tokens.push(t);
  }
  return tokens;
};

/** Un `grep` escrito como comando, no precedido de `git`. */
const RE_COMANDO_GREP = /(?:^|[\s|;&(`{])(?<!\bgit\s)grep\s+/g;

const grepsDeComando = (texto: string): string[] => {
  const hallados: string[] = [];
  const unido = texto.replace(/\\\n/g, ' ');
  for (const linea of unido.split('\n')) {
    for (const m of linea.matchAll(RE_COMANDO_GREP)) {
      const resto = linea.slice(m.index! + m[0].length);
      const g = leerGrep(tokensDeComando(resto));
      if (bajaANodeModules(g, esAlcancePeligroso)) hallados.push(`grep ${resto.trim()}`.slice(0, 120));
    }
  }
  return hallados;
};

/** Los literales de string de un fuente de JS (ya sin comentarios). */
const literales = (src: string): string[] =>
  [...src.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) =>
    m[0].slice(1, -1),
  );

/** El array literal que abre en `desde` (el índice del `[`), hasta su `]`. */
const arrayDesde = (src: string, desde: number): string => {
  let nivel = 0;
  for (let i = desde; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '[' || c === '(' || c === '{') nivel++;
    else if (c === ']' || c === ')' || c === '}') {
      nivel--;
      if (nivel === 0) return src.slice(desde + 1, i);
    }
  }
  return src.slice(desde + 1);
};

/** Los elementos de primer nivel de un array literal, como texto. */
const elementos = (interior: string): string[] => {
  const salida: string[] = [];
  let nivel = 0;
  let actual = '';
  for (let i = 0; i < interior.length; i++) {
    const c = interior[i]!;
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      for (; j < interior.length && interior[j] !== c; j++) if (interior[j] === '\\') j++;
      actual += interior.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === '[' || c === '(' || c === '{') nivel++;
    if (c === ']' || c === ')' || c === '}') nivel--;
    if (c === ',' && nivel === 0) {
      salida.push(actual.trim());
      actual = '';
      continue;
    }
    actual += c;
  }
  if (actual.trim()) salida.push(actual.trim());
  return salida;
};

/** Un elemento del array de `execFileSync('grep', [...])` como argumento, o `null` si no es literal. */
const comoArgumento = (el: string): string | null => {
  const m = /^(['"`])([\s\S]*)\1$/.exec(el);
  if (m && !(m[1] === '`' && /\$\{/.test(m[2]!.replace(/\$\{(?:raiz|RAIZ|ROOT|process\.cwd\(\))\}/g, '')))) {
    return m[2]!;
  }
  if (RE_EXPRESION_RAIZ.test(el)) return 'RAIZ';
  return null;
};

const grepsDeArray = (src: string): string[] => {
  const hallados: string[] = [];
  for (const m of src.matchAll(/\b(?:execFileSync|execFile|spawnSync|spawn)\(\s*['"]grep['"]\s*,\s*\[/g)) {
    const interior = arrayDesde(src, m.index! + m[0].length - 1);
    const els = elementos(interior);
    // Un no-literal se cuenta como posicional desconocido: puede ser el patrón,
    // que es lo común (`PATRON_COPIA`), y como ruta no se puede juzgar.
    const args = els.map((e) => comoArgumento(e) ?? '<expresión>');
    const g = leerGrep(args);
    if (bajaANodeModules(g, (r) => r !== '<expresión>' && esAlcancePeligroso(r))) {
      hallados.push(`execFileSync('grep', [${interior.replace(/\s+/g, ' ').trim()}])`.slice(0, 160));
    }
  }
  return hallados;
};

// ─────────────────────────────────────────────────────────────────────
// 3 · `readdirSync` recursivo
// ─────────────────────────────────────────────────────────────────────

/**
 * La ruta que nombra una expresión, cuando se puede saber: un literal, la raíz,
 * o un envoltorio de un solo literal (`raiz('functions')`, `ruta('src/pages')`,
 * `join(RAIZ, 'functions')`, `new URL('functions/', raiz)`). Si es un
 * identificador, se busca su **última** declaración antes del uso (`antes` es
 * el fuente hasta ahí): un `const raiz = new URL('../dist/', …)` local no es la
 * raíz del repo aunque se llame igual —fue el primer falso positivo, en
 * `scripts/build-contra-emulador.mjs`—. `null` = no se sabe.
 */
const rutaDeExpresion = (expr: string, antes: string, profundidad = 0): string | null => {
  const e = expr.trim();
  if (!e) return null;
  const literal = /^(['"`])([^'"`$]*)\1$/.exec(e);
  if (literal) return literal[2]!;
  if (/^[A-Za-z_]\w*$/.test(e)) {
    const decls = [...antes.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${e}\\s*(?::[^=]+)?=\\s*([^;\\n]+)`, 'g'))];
    const ultima = decls.at(-1);
    if (ultima) {
      return profundidad < 2
        ? rutaDeExpresion(ultima[1]!.replace(/[;,]\s*$/, ''), antes.slice(0, ultima.index), profundidad + 1)
        : null;
    }
  }
  if (RE_EXPRESION_RAIZ.test(e)) return 'RAIZ';
  const plantilla = /^`\$\{(?:raiz|RAIZ|ROOT|process\.cwd\(\))\}\/?([^`$]*)`$/.exec(e);
  if (plantilla) return plantilla[1] ? `RAIZ/${plantilla[1]}` : 'RAIZ';
  const envuelto = /^(?:fileURLToPath\()?(?:\w+\.)?(?:raiz|ruta|join|resolve|new URL)\(\s*(?:(?:raiz|RAIZ|ROOT|process\.cwd\(\))\s*,\s*)?(['"])([^'"]*)\1(?:\s*,\s*(?:raiz|import\.meta\.url))?\s*\)\)?$/.exec(e);
  if (envuelto) return envuelto[2]!;
  return null;
};

/**
 * El cuerpo de la función que empieza en `desde` (justo después de `=>` o de la
 * lista de parámetros): entre llaves si abre con `{`; si es una flecha con
 * expresión, hasta el `;` o el salto de línea que cierra la sentencia.
 */
const cuerpoDesde = (src: string, desde: number): string => {
  let i = desde;
  while (i < src.length && /\s/.test(src[i]!)) i++;
  const conLlaves = src[i] === '{';
  let nivel = 0;
  for (; i < src.length; i++) {
    const c = src[i]!;
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') nivel++;
    else if (c === ')' || c === '}' || c === ']') {
      nivel--;
      if (nivel < 0) return src.slice(desde, i);
      if (conLlaves && nivel === 0) return src.slice(desde, i + 1);
    } else if (!conLlaves && nivel === 0) {
      if (c === ';') return src.slice(desde, i);
      if (c === '\n') {
        const antes = src.slice(desde, i).trimEnd().at(-1) ?? '';
        const despues = src.slice(i).trimStart()[0] ?? '';
        if (!/[(,=>?:&|+]/.test(antes) && !/[.?:&|+),]/.test(despues)) return src.slice(desde, i);
      }
    }
  }
  return src.slice(desde);
};

type Recorrido = { donde: string; alcances: (string | null)[]; saltea: boolean; nativo: boolean };

const recorridos = (src: string): Recorrido[] => {
  const salida: Recorrido[] = [];

  // (a) El recursivo nativo: `readdirSync(x, { …recursive: true… })`.
  for (const m of src.matchAll(/\breaddir(?:Sync)?\(\s*/g)) {
    const args = elementos(arrayDesde(src, m.index! + m[0].length - 1));
    if (args.length >= 2 && /\brecursive\s*:\s*true\b/.test(args[1]!)) {
      salida.push({
        donde: src.slice(m.index!, m.index! + 80).replace(/\s+/g, ' '),
        alcances: [rutaDeExpresion(args[0]!, src.slice(0, m.index!))],
        saltea: false,
        nativo: true,
      });
    }
  }

  // (b) La función que se llama a sí misma y lee un directorio.
  const RE_DECL =
    /\b(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?=>|\bfunction\s+(\w+)\s*\(([^)]*)\)/g;
  for (const m of src.matchAll(RE_DECL)) {
    const nombre = (m[1] ?? m[3])!;
    const params = (m[2] ?? m[4] ?? '').trim();
    const cuerpo = cuerpoDesde(src, m.index! + m[0].length);
    if (!/\breaddir(?:Sync)?\(/.test(cuerpo)) continue;
    if (!new RegExp(`\\b${nombre}\\(|\\.(?:flatMap|map|forEach)\\(\\s*${nombre}\\s*\\)`).test(cuerpo)) continue;

    const alcances: (string | null)[] = [];
    const porDefecto = /^\w+\s*(?::\s*\w+)?\s*=\s*(['"][^'"]*['"])/.exec(params);
    if (porDefecto) alcances.push(rutaDeExpresion(porDefecto[1]!, src.slice(0, m.index!)));
    const largo = m[0].length + cuerpo.length;
    const fuera = src.slice(0, m.index!) + src.slice(m.index! + largo);
    // El fuente hasta el uso, en coordenadas del original.
    const hasta = (i: number) => src.slice(0, i < m.index! ? i : i + largo);
    for (const c of fuera.matchAll(new RegExp(`\\b${nombre}\\(`, 'g'))) {
      const arg = elementos(arrayDesde(fuera, c.index! + c[0].length - 1))[0];
      if (arg !== undefined) alcances.push(rutaDeExpresion(arg, hasta(c.index!)));
    }
    for (const c of fuera.matchAll(new RegExp(`\\[([^\\[\\]]*)\\]\\s*\\.(?:flatMap|map|forEach)\\(\\s*${nombre}\\s*\\)`, 'g'))) {
      alcances.push(...elementos(c[1]!).map((e) => rutaDeExpresion(e, hasta(c.index!))));
    }
    salida.push({
      donde: `${nombre}(${params})`,
      alcances,
      saltea: /node_modules/.test(cuerpo),
      nativo: false,
    });
  }
  return salida;
};

const readdirsQueBajan = (src: string): string[] =>
  recorridos(src)
    .filter((r) => (r.nativo || !r.saltea) && r.alcances.some((a) => a !== null && esAlcancePeligroso(a)))
    .map(
      (r) =>
        `${r.nativo ? 'readdirSync { recursive: true }' : 'recorrido recursivo'} ${r.donde} sobre ` +
        [...new Set(r.alcances.filter((a) => a !== null && esAlcancePeligroso(a)))].join(', '),
    );

// ─────────────────────────────────────────────────────────────────────
// El barrido
// ─────────────────────────────────────────────────────────────────────

const RE_EXTENSION = /\.(?:ts|tsx|mts|mjs|js|cjs|sh)$/;

/** El fuente sin comentarios. En un `.sh`, además, sin las líneas `#`. */
const codigoDe = (ruta: string, texto: string): string => {
  if (ruta.endsWith('.sh')) {
    const sinNumeral = texto
      .split('\n')
      .map((l) => (/^\s*#/.test(l) ? '' : l))
      .join('\n');
    return sinComentariosConFormato(sinNumeral);
  }
  return sinComentariosConFormato(texto);
};

/** Los hallazgos de un archivo, con la ruta que se quiera mostrar. */
const hallazgosDe = (nombre: string, texto: string): string[] => {
  const codigo = codigoDe(nombre, texto);
  const comandos = nombre.endsWith('.sh')
    ? grepsDeComando(codigo)
    : literales(codigo).flatMap((l) => (/^\s*grep\s|[|;&(]\s*grep\s/.test(l) ? grepsDeComando(l) : []));
  return [...comandos, ...grepsDeArray(codigo), ...readdirsQueBajan(codigo)].map((h) => `${nombre} · ${h}`);
};

const ARCHIVOS = archivosDelRepo('tests', 'scripts').filter(
  (f) => RE_EXTENSION.test(f) && f !== ESTE_ARCHIVO,
);

/** Lo del repo se lee una vez: la mutación suma archivos, no vuelve a leer todo. */
let delRepo: string[] | null = null;

const barrer = (extra: { nombre: string; ruta: string }[] = []): string[] => {
  delRepo ??= ARCHIVOS.flatMap((f) => hallazgosDe(f, readFileSync(join(RAIZ, f), 'utf8')));
  return [...delRepo, ...extra.flatMap(({ nombre, ruta }) => hallazgosDe(nombre, readFileSync(ruta, 'utf8')))];
};

// ─────────────────────────────────────────────────────────────────────

describe('clase de B-2081 · un barrido recursivo que alcanza `functions/` o la raíz saltea `node_modules`', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'b-2081-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('el barrido mira: hay archivos, y hay greps recursivos y recorridos que se leyeron', () => {
    // Control de alcance: si el listado o los detectores dejaran de ver, el
    // caso principal pasaría con cero hallazgos sin haber mirado nada.
    expect(ARCHIVOS.length).toBeGreaterThan(100);
    const todos = ARCHIVOS.map((f) => codigoDe(f, readFileSync(join(RAIZ, f), 'utf8')));
    const greps = todos.flatMap((c) =>
      [...c.matchAll(/\b(?:execFileSync|spawnSync)\(\s*['"]grep['"]\s*,\s*\[/g)].map((m) =>
        leerGrep(elementos(arrayDesde(c, m.index! + m[0].length - 1)).map((e) => comoArgumento(e) ?? '<e>')),
      ),
    );
    expect(greps.filter((g) => g.recursivo).length).toBeGreaterThanOrEqual(4);
    // Los que excluyen hoy: B-190, FORMATO_VERSION, los meses y el marcador de Tailwind.
    expect(greps.filter((g) => g.recursivo && g.excluye).length).toBeGreaterThanOrEqual(4);
    expect(todos.flatMap(recorridos).length).toBeGreaterThanOrEqual(8);
    // Y el de `ciudades.test.ts`, la cuarta instancia, se ve como recorrido que saltea.
    const ciudades = recorridos(codigoDe('tests/ciudades.test.ts', readFileSync(join(RAIZ, 'tests/ciudades.test.ts'), 'utf8')));
    expect(ciudades.some((r) => r.saltea && r.alcances.includes('functions'))).toBe(true);
  });

  it('ningún `grep -r` ni `readdirSync` recursivo de `tests/` o `scripts/` baja a `node_modules`', () => {
    expect(
      barrer(),
      'agregá `--exclude-dir=node_modules` al grep, o que el recorrido corte en `node_modules` ' +
        '(en un worktree no se nota: ahí es un symlink y no se sigue)',
    ).toEqual([]);
  });

  /**
   * **El control positivo es la mutación de B-2041 y de `ciudades.test.ts`**, en
   * un archivo de `os.tmpdir()` que el barrido recorre como uno más. Cada forma
   * tiene su versión mala (rojo) y su versión corregida (verde), para que un
   * detector que marcara todo tampoco pase.
   */
  it('mutación: la versión sin exclusión de cada forma se detecta, y la corregida no', () => {
    const caso = (nombre: string, contenido: string) => {
      const ruta = join(tmp, nombre);
      writeFileSync(ruta, contenido);
      return barrer([{ nombre: `tmp/${nombre}`, ruta }]).filter((h) => h.startsWith('tmp/'));
    };
    const G = 'gr' + 'ep'; // para que este archivo no se lea a sí mismo si alguna vez entra

    // 2 · el array de B-2041, sin y con la exclusión.
    expect(caso('a.ts', `execFileSync('${G}', ['-rn', "'a-confirmar'", 'src/lib', 'functions'], {});`)).toHaveLength(1);
    expect(caso('b.ts', `execFileSync('${G}', ['-rn', '--exclude-dir=node_modules', "'x'", 'functions'], {});`)).toEqual([]);
    expect(caso('c.ts', `execFileSync('${G}', ['-rln', 'x', 'src'], {});`)).toEqual([]);
    expect(caso('d.ts', `execFileSync('${G}', ['-rl', PATRON, fileURLToPath(raiz)], {});`)).toHaveLength(1);

    // 1 · como comando: en un `.sh`, en un string de JS y sin ruta (recorre `.`).
    expect(caso('e.sh', `N=$(${G} -rn "$PATRON" "$RAIZ" | wc -l)\n`)).toHaveLength(1);
    expect(caso('f.sh', `N=$(${G} -rn --exclude-dir=node_modules "$PATRON" "$RAIZ" | wc -l)\n`)).toEqual([]);
    expect(caso('g.sh', `${G} -rhoE "$X" "$RAIZ/src" || true\n`)).toEqual([]);
    expect(caso('h.ts', `execSync(\`${G} -R TODO .\`);`)).toHaveLength(1);
    expect(caso('i.ts', `execSync('${G} -rn TODO');`)).toHaveLength(1);
    expect(caso('j.ts', `execSync('git ${G} -n TODO');`)).toEqual([]);

    // 3 · el recorrido de `ciudades.test.ts` antes y después, y el nativo.
    const recorrer = (corte: string) =>
      'const archivos = (dir: string): string[] =>\n' +
      '  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {\n' +
      '    const ruta = `${dir}/${e.name}`;\n' +
      `    if (e.isDirectory()) return ${corte}archivos(ruta);\n` +
      "    return /\\.js$/.test(e.name) ? [ruta] : [];\n" +
      '  });\n' +
      "const culpables = ['src', 'functions', 'scripts'].flatMap(archivos);\n";
    expect(caso('k.ts', recorrer(''))).toHaveLength(1);
    expect(caso('l.ts', recorrer("e.name === 'node_modules' ? [] : "))).toEqual([]);
    expect(caso('m.ts', recorrer('').replace("['src', 'functions', 'scripts']", "['src', 'scripts']"))).toEqual([]);
    expect(caso('n.ts', "const t = readdirSync(raiz('.'), { recursive: true });")).toHaveLength(1);
    expect(caso('o.ts', "const t = readdirSync(raiz('src/pages'), { recursive: true });")).toEqual([]);

    // Un comentario que nombra la forma mala no cuenta (los docblocks de B-2041 lo hacen).
    expect(caso('p.ts', `// execFileSync('${G}', ['-rn', 'x', 'functions'])\n/* ${G} -rn x . */\n`)).toEqual([]);
  });
});
