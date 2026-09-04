#!/usr/bin/env node
/**
 * Las cifras de `docs/10-salud-del-codigo.md`, medidas.
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 * Ese documento vale porque cada número salió de contar el árbol real, y su
 * propio encabezado lo dice: «estimarlas para que queden actualizadas es
 * exactamente lo que lo haría inútil». El costo de esa regla es que remedir a
 * mano son un par de horas, así que en la práctica no se remide: entre el
 * 2026-08-27 y el 2026-09-03 el §1.1 declaraba 111 archivos de producción
 * mientras el árbol tenía 156, o sea un 40 % de código que ningún número del
 * documento reflejaba (B-311, que sale de B-201).
 *
 * Este script es la mitad automatizable de esa pasada. **No decide nada y no
 * escribe el documento**: imprime las tablas listas para pegar, y el juicio
 * —qué significa que una cifra se movió, qué entra en «lo que está bien», qué
 * problema abrió o cerró— sigue siendo de quien remide. Eso es a propósito: lo
 * caro de ese documento nunca fue contar.
 *
 * ── Por qué NO es un test ──────────────────────────────────────────────────
 * Un test que comparara estas cifras contra las del documento se pondría rojo
 * cada vez que **otra persona** agrega un archivo, que es el modo de falla que
 * B-180 dejó escrito: un gate que falla por su propia plomería enseña a
 * saltearlo. Estos números se mueven con cada commit de cualquiera y no hay
 * umbral honesto que distinga «el documento quedó viejo» de «alguien trabajó».
 *
 * Lo que sí está atado, en `tests/salud-del-codigo.test.ts`, es lo discreto:
 * cero ciclos de import (que solo puede romper quien introduce el ciclo), que
 * los archivos que el documento nombra existan, y que el criterio escrito en el
 * documento sea el mismo que este script aplica — o sea, que la metodología y
 * la herramienta no se separen. Las cifras se avisan; no bloquean.
 *
 * ── Metodología (la misma que declara el documento) ────────────────────────
 * - **Corpus:** `git ls-files` filtrado a `.ts`, `.tsx`, `.js`, `.mjs` y
 *   `.astro`. Nada de `node_modules`, nada sin versionar.
 * - **Áreas:** `src/`, `functions/` y `scripts/` son código de producción;
 *   `tests/` va aparte y no suma al total de producción.
 * - **LOC:** líneas del archivo, como `wc -l`.
 * - **Significativas:** sin líneas en blanco y sin líneas de comentario. Una
 *   línea con código *y* comentario al final cuenta como significativa: lo que
 *   se mide es cuánta línea es solo prosa.
 * - **Prosa:** líneas de comentario sobre LOC, por área.
 * - **Grafo de imports:** resuelve `@/`, los alias a `functions/` declarados en
 *   `astro.config.mjs` y los relativos; incluye los `import()` diferidos.
 *   `node_modules` queda afuera del grafo, `react` incluido.
 * - **Fan-in:** consumidores **de producción** (no cuenta `tests/`).
 * - **Ciclos:** DFS sobre el grafo completo.
 *
 * Uso:
 *   node scripts/salud-del-codigo.mjs           # las tablas en markdown
 *   node scripts/salud-del-codigo.mjs --json    # lo mismo, para otro programa
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

const EXTENSIONES = ['.ts', '.tsx', '.js', '.mjs', '.astro'];

/** El corpus: lo versionado, con las extensiones que el documento declara. */
export const corpus = (raiz = RAIZ) =>
  execFileSync('git', ['ls-files', '-z'], { cwd: raiz, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((f) => EXTENSIONES.some((e) => f.endsWith(e)))
    // `functions/node_modules` no está versionado, pero por las dudas.
    .filter((f) => !f.includes('node_modules/'));

/**
 * El área a la que pertenece un archivo, o `null` si no se cuenta.
 *
 * `tests/` se nombra aparte a propósito: no suma al total de producción, y la
 * relación entre los dos es una de las dos cifras del §0.
 */
export const area = (archivo) => {
  if (archivo.startsWith('src/')) return 'src/';
  if (archivo.startsWith('functions/')) return 'functions/';
  if (archivo.startsWith('scripts/')) return 'scripts/';
  if (archivo.startsWith('tests/')) return 'tests/';
  return null;
};

export const AREAS_PRODUCCION = ['src/', 'functions/', 'scripts/'];

/**
 * Cuenta líneas de un archivo: totales, en blanco, de comentario.
 *
 * El seguimiento de bloques `/* … *\/` es de una pasada y no un parser: alcanza
 * para esta medición y no tiene forma de equivocarse en silencio con el estilo
 * de este repo (comentarios de bloque abiertos y cerrados en su propia línea,
 * o `//` de línea). Las comillas que contengan `/*` dentro de una string son el
 * caso que no distingue, y se acepta: no hay ninguna en el corpus.
 */
export const contarLineas = (texto) => {
  const lineas = texto.split('\n');
  // Un archivo que termina en `\n` produce un último elemento vacío que `wc -l`
  // no cuenta como línea.
  if (lineas.length > 0 && lineas[lineas.length - 1] === '') lineas.pop();

  let blancas = 0;
  let comentario = 0;
  let enBloque = false;

  for (const cruda of lineas) {
    const l = cruda.trim();
    if (enBloque) {
      comentario += 1;
      if (l.includes('*/')) enBloque = false;
      continue;
    }
    if (l === '') {
      blancas += 1;
      continue;
    }
    if (l.startsWith('//')) {
      comentario += 1;
      continue;
    }
    if (l.startsWith('/*')) {
      comentario += 1;
      if (!l.includes('*/')) enBloque = true;
      continue;
    }
  }

  return {
    loc: lineas.length,
    blancas,
    comentario,
    significativas: lineas.length - blancas - comentario,
  };
};

/** Los alias de `astro.config.mjs` que apuntan a un archivo del repo. */
export const aliasDelBuild = (raiz = RAIZ) => {
  const config = readFileSync(join(raiz, 'astro.config.mjs'), 'utf8');
  const alias = {};
  for (const m of config.matchAll(/'(@[\w-]+)':\s*fileURLToPath\(\s*\n?\s*new URL\('\.\/([^']+)'/g)) {
    alias[m[1]] = m[2];
  }
  return alias;
};

/**
 * Resuelve un especificador de import a un archivo del corpus, o `null`.
 *
 * Devolver `null` para todo lo que no es del proyecto es lo que mantiene el
 * grafo en «módulos propios»: `node_modules`, `node:*` y los paquetes de
 * Firebase salen solos por no resolver a ningún archivo versionado.
 */
export const resolver = (especificador, desde, enElCorpus, alias) => {
  let candidato = null;

  if (especificador.startsWith('@/')) {
    candidato = join('src', especificador.slice(2));
  } else if (alias[especificador]) {
    candidato = alias[especificador];
  } else if (especificador.startsWith('.')) {
    candidato = normalize(join(dirname(desde), especificador));
  } else {
    return null;
  }

  const pruebas = [
    candidato,
    ...EXTENSIONES.map((e) => candidato + e),
    ...EXTENSIONES.map((e) => join(candidato, 'index' + e)),
    // TypeScript deja escribir `./x.js` para `./x.ts`.
    candidato.replace(/\.js$/, '.ts'),
  ];
  return pruebas.find((p) => enElCorpus.has(p)) ?? null;
};

const IMPORTS =
  /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

/** El grafo dirigido `archivo → archivos del proyecto que importa`. */
export const grafo = (raiz = RAIZ, archivos = corpus(raiz)) => {
  const enElCorpus = new Set(archivos);
  const alias = aliasDelBuild(raiz);
  const g = new Map();

  for (const archivo of archivos) {
    const src = readFileSync(join(raiz, archivo), 'utf8');
    const destinos = new Set();
    for (const m of src.matchAll(IMPORTS)) {
      const especificador = m[1] ?? m[2] ?? m[3];
      if (!especificador) continue;
      const destino = resolver(especificador, archivo, enElCorpus, alias);
      if (destino && destino !== archivo) destinos.add(destino);
    }
    g.set(archivo, [...destinos].sort());
  }
  return g;
};

/** Los ciclos del grafo, por DFS con pila de color. */
export const ciclos = (g) => {
  const encontrados = [];
  const estado = new Map(); // 0 sin visitar · 1 en la pila · 2 cerrado
  const pila = [];

  const visitar = (n) => {
    estado.set(n, 1);
    pila.push(n);
    for (const v of g.get(n) ?? []) {
      if (estado.get(v) === 1) {
        encontrados.push([...pila.slice(pila.indexOf(v)), v]);
      } else if ((estado.get(v) ?? 0) === 0) {
        visitar(v);
      }
    }
    pila.pop();
    estado.set(n, 2);
  };

  for (const n of g.keys()) if ((estado.get(n) ?? 0) === 0) visitar(n);
  return encontrados;
};

/** Todas las cifras, en un objeto. */
export const medir = (raiz = RAIZ) => {
  const archivos = corpus(raiz);
  const porArchivo = new Map(
    archivos.map((f) => [f, { ...contarLineas(readFileSync(join(raiz, f), 'utf8')), area: area(f) }]),
  );

  const areas = {};
  for (const nombre of [...AREAS_PRODUCCION, 'tests/']) {
    const suyos = archivos.filter((f) => porArchivo.get(f).area === nombre);
    areas[nombre] = {
      archivos: suyos.length,
      loc: suyos.reduce((a, f) => a + porArchivo.get(f).loc, 0),
      significativas: suyos.reduce((a, f) => a + porArchivo.get(f).significativas, 0),
      comentario: suyos.reduce((a, f) => a + porArchivo.get(f).comentario, 0),
    };
  }

  const produccion = archivos.filter((f) => AREAS_PRODUCCION.includes(porArchivo.get(f).area));
  const locProduccion = produccion.reduce((a, f) => a + porArchivo.get(f).loc, 0);

  const ranking = [...produccion].sort((a, b) => porArchivo.get(b).loc - porArchivo.get(a).loc);
  const quince = ranking.slice(0, 15);
  const locQuince = quince.reduce((a, f) => a + porArchivo.get(f).loc, 0);

  const g = grafo(raiz, archivos);
  const fanIn = new Map(produccion.map((f) => [f, 0]));
  for (const [origen, destinos] of g) {
    // Fan-in de producción: quién lo importa sin contar `tests/`.
    if (!AREAS_PRODUCCION.includes(area(origen) ?? '')) continue;
    for (const d of destinos) if (fanIn.has(d)) fanIn.set(d, fanIn.get(d) + 1);
  }

  const acoplamiento = [...fanIn.entries()]
    .map(([archivo, entradas]) => ({
      archivo,
      fanIn: entradas,
      fanOut: (g.get(archivo) ?? []).length,
    }))
    .sort((a, b) => b.fanIn - a.fanIn);

  // Testeable = lo que no es `.tsx` ni `.astro`: la relación del §0 compara
  // tests contra el código que la suite puede ejercitar sin montar un DOM.
  const locTesteable = produccion
    .filter((f) => !f.endsWith('.tsx') && !f.endsWith('.astro'))
    .reduce((a, f) => a + porArchivo.get(f).loc, 0);

  const prosa = {};
  for (const nombre of [...AREAS_PRODUCCION, 'tests/']) {
    prosa[nombre] = areas[nombre].loc ? areas[nombre].comentario / areas[nombre].loc : 0;
  }
  const libSinCopy = archivos.filter(
    (f) =>
      f.startsWith('src/lib/') && !f.endsWith('/ayuda.ts') && !f.endsWith('/novedades.ts'),
  );
  const lib = archivos.filter((f) => f.startsWith('src/lib/'));
  const razon = (fs) => {
    const loc = fs.reduce((a, f) => a + porArchivo.get(f).loc, 0);
    const com = fs.reduce((a, f) => a + porArchivo.get(f).comentario, 0);
    return loc ? com / loc : 0;
  };
  prosa['src/lib/'] = razon(lib);
  prosa['src/lib/ sin ayuda.ts ni novedades.ts'] = razon(libSinCopy);
  prosa['src/components/'] = razon(archivos.filter((f) => f.startsWith('src/components/')));

  return {
    medidoEn: new Date().toISOString().slice(0, 10),
    commit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: raiz,
      encoding: 'utf8',
    }).trim(),
    areas,
    produccion: { archivos: produccion.length, loc: locProduccion, locTesteable },
    concentracion: {
      quince: quince.map((f) => ({ archivo: f, loc: porArchivo.get(f).loc })),
      porcentajeQuince: locQuince / locProduccion,
      porcentajeMayor: porArchivo.get(quince[0]).loc / locProduccion,
    },
    ranking: ranking.map((f) => ({ archivo: f, loc: porArchivo.get(f).loc })),
    acoplamiento,
    ciclos: ciclos(g),
    ratioTests: areas['tests/'].loc / locTesteable,
    prosa,
  };
};

const pct = (n) => `${(n * 100).toFixed(1).replace('.', ',')} %`;
const mil = (n) => n.toLocaleString('es-AR');

const imprimir = (m) => {
  console.log(`Medido el ${m.medidoEn} sobre \`${m.commit}\`.\n`);

  console.log('### 1.1 Tamaño\n');
  console.log('| Área | Archivos | LOC | Significativas |');
  console.log('|---|---:|---:|---:|');
  for (const a of AREAS_PRODUCCION) {
    const d = m.areas[a];
    console.log(`| \`${a}\` | ${d.archivos} | ${mil(d.loc)} | ${mil(d.significativas)} |`);
  }
  const sig = AREAS_PRODUCCION.reduce((s, a) => s + m.areas[a].significativas, 0);
  console.log(
    `| **Código (total)** | **${m.produccion.archivos}** | **${mil(m.produccion.loc)}** | **${mil(sig)}** |`,
  );
  const t = m.areas['tests/'];
  console.log(`| \`tests/\` | ${t.archivos} | ${mil(t.loc)} | ${mil(t.significativas)} |`);
  console.log(
    `\nRelación tests / código testeable (${mil(m.produccion.locTesteable)} LOC, sin \`.tsx\` ni \`.astro\`): **${m.ratioTests.toFixed(2).replace('.', ',')}**.\n`,
  );

  console.log('### 1.2 Concentración\n');
  console.log(
    `Los quince más grandes son el **${pct(m.concentracion.porcentajeQuince)}** del código. El más grande es el **${pct(m.concentracion.porcentajeMayor)}**.\n`,
  );
  console.log('| LOC | Archivo |');
  console.log('|---:|---|');
  for (const { archivo, loc } of m.concentracion.quince) {
    console.log(`| ${mil(loc)} | \`${archivo}\` |`);
  }

  console.log('\n### 1.4 Acoplamiento\n');
  console.log('| Consumidores | Módulo | Fan-out |');
  console.log('|---:|---|---:|');
  for (const f of m.acoplamiento.slice(0, 10)) {
    console.log(`| ${f.fanIn} | \`${f.archivo}\` | ${f.fanOut} |`);
  }

  console.log('\n### 1.5 Ciclos\n');
  console.log(
    m.ciclos.length === 0
      ? `**Cero**, en ${m.produccion.archivos} archivos de producción.`
      : m.ciclos.map((c) => `- ${c.join(' → ')}`).join('\n'),
  );

  console.log('\n### 1.6 Prosa\n');
  console.log('| Área | Comentarios / LOC |');
  console.log('|---|---:|');
  for (const [a, v] of Object.entries(m.prosa).sort((x, y) => y[1] - x[1])) {
    console.log(`| \`${a}\` | ${pct(v)} |`);
  }
};

if (process.argv[1] && process.argv[1].endsWith('salud-del-codigo.mjs')) {
  const m = medir();
  if (process.argv.includes('--json')) console.log(JSON.stringify(m, null, 2));
  else imprimir(m);
}
