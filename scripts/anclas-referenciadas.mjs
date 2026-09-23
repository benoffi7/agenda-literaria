#!/usr/bin/env node
/**
 * Lista los enlaces `](#…)` y `](archivo.md#…)` de `docs/` y del `CLAUDE.md`
 * cuyo ancla **no resuelve a ningún encabezado** del documento al que apuntan.
 *
 *   node scripts/anclas-referenciadas.mjs            # informa, sale con 0
 *   node scripts/anclas-referenciadas.mjs --estricto # sale con 1 si hay rotos
 *
 * Es el tercer hermano de `scripts/decisiones-referenciadas.mjs` y
 * `scripts/items-referenciados.mjs` —mismo corte, misma salida— corrido sobre
 * la tercera parte del vocabulario del repo: allá los `D-nnn` y los `B-nnn`,
 * acá las anclas. B-1171.
 *
 * ── Por qué existe ────────────────────────────────────────────────
 * Un ancla rota **funciona**: la página carga, no hay 404, y el salto no va a
 * ninguna parte. Quien la sufre supone que se distrajo. Es la rotura más
 * silenciosa que puede tener un documento largo, y en este repo tiene una
 * causa estructural: los encabezados llevan `·`, que al generar el ancla se
 * borra y **deja sus dos espacios**. `### 5.3 · El invariante…` es
 * `#53--el-invariante…`, con dos guiones; escribir uno solo da un enlace que
 * parece bien. `16-analitica-del-sitio.md` tuvo cuatro así durante tres
 * semanas, y el 2026-09-22 aparecieron otras cuatro en `06-decisiones.md` y
 * `12-sitio-publico.md` — las cuatro por un encabezado que se renombró sin
 * actualizar a quien lo citaba. La clase no es de un archivo: es el costo de
 * renombrar un encabezado en un repo con cientos de citas cruzadas.
 *
 * ── El slug, y la trampa del `_` ──────────────────────────────────
 * Es el de GitHub (`github-slugger`): minúsculas; se borra todo lo que no sea
 * letra, marca, número, **conector** (`\p{Pc}`, el `_`), espacio o guion; cada
 * espacio pasa a guion **sin colapsar**; y un encabezado repetido gana `-1`,
 * `-2`… en orden de aparición.
 *
 * **El `_` se conserva, y no es un detalle.** El barrido a mano que abrió
 * B-1171 lo borraba, reportó tres falsos positivos en
 * `16-analitica-del-sitio.md` (`page_view`, `filtro_sin_resultados`) y se
 * llegaron a «arreglar» dos enlaces que funcionaban. Un chequeo que miente así
 * enseña a no creerle — el caso tiene su test.
 *
 * El texto del encabezado se toma **como se ve**, no como se escribe: un
 * `[texto](url)` aporta solo `texto`, y los `*`/`` ` `` de énfasis y código
 * caen solos por no ser `\w`. Una etiqueta HTML real no aporta texto, pero
 * una escrita como código en línea sí: `` `<form>` `` deja `form` en el ancla. Los bloques de código cercados no aportan
 * encabezados ni enlaces: un `# comentario` de bash no es un título, y un
 * ejemplo de markdown adentro de ` ``` ` no es una cita.
 *
 * ── Qué se barre ──────────────────────────────────────────────────
 * Los `.md` de `docs/` (subcarpetas incluidas) y el `CLAUDE.md`, que es lo que
 * B-1171 nombra y donde vive la navegación por anclas. El **destino** puede
 * ser cualquier `.md` del repo: un `](../CLAUDE.md#…)` desde `docs/` se
 * resuelve igual. Un destino que **no existe** también se informa — no es la
 * clase del ítem, pero es el mismo síntoma («el enlace no lleva a ningún
 * lado») y dejarlo pasar sería verde por no buscar.
 *
 * Un ancla escrita a mano con `<a id="…">` o `<a name="…">` cuenta como
 * encabezado: GitHub la resuelve.
 *
 * ── Por qué informa acá y frena en el test ────────────────────────
 * Igual que `items-referenciados.mjs`, y por el mismo motivo: un ancla no se
 * cita «antes de escribirse» como una decisión en vuelo. Si se la escribe, se
 * la copió de un encabezado que existe, o se la derivó mal. Así que
 * `tests/anclas-referenciadas.test.ts` congela la deuda de hoy —que es **cero**
 * para todo lo que no es un registro histórico— y se pone rojo con una nueva.
 *
 * La mitad que decide (el slug, los encabezados, los enlaces) es pura y tiene
 * tests; el barrido del disco es la mitad que no se puede testear.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { archivosDelRepo } from '../tests/fixtures/archivos-del-repo.ts';

/**
 * El slug de GitHub para el texto de un encabezado, **sin** el sufijo de
 * duplicado (eso depende del documento, ver `anclasDe`).
 *
 * `\p{Pc}` y no `\w`: `\w` de JS sin la bandera `u` es solo ASCII y se come la
 * `ñ` y las tildes, que GitHub conserva.
 *
 * @param {string} texto
 * @returns {string}
 */
export const slugDeGithub = (texto) =>
  texto
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');

/**
 * El texto visible de un encabezado: sin los `#`, sin los de cierre opcionales,
 * y con cada enlace reducido a su texto.
 *
 * @param {string} crudo lo que sigue a los `#`
 */
const textoVisible = (crudo) =>
  crudo
    .replace(/\s+#+\s*$/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Una etiqueta HTML no aporta texto… salvo adentro de código en línea,
    // donde `<form>` se ve tal cual y GitHub deja `form` en el ancla (D-640).
    .split(/(`[^`]*`)/)
    .map((tramo, i) => (i % 2 === 1 ? tramo : tramo.replace(/<[^>]+>/g, '')))
    .join('')
    .trim();

/**
 * Las líneas de un documento con los bloques de código cercados vaciados, para
 * que ni sus `#` cuenten como encabezados ni sus `](#…)` como citas. Se
 * conservan las líneas (vacías) para que los números de línea sigan valiendo.
 *
 * @param {string} contenido
 * @returns {string[]}
 */
export const lineasSinCodigo = (contenido) => {
  /** @type {string | null} */
  let cerca = null;
  return contenido.split('\n').map((linea) => {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(linea);
    if (cerca === null) {
      if (m) {
        cerca = m[1];
        return '';
      }
      return linea;
    }
    if (m && m[1][0] === cerca[0] && m[1].length >= cerca.length && linea.trim() === m[1]) cerca = null;
    return '';
  });
};

/**
 * Todas las anclas que un documento ofrece: la de cada encabezado ATX, con el
 * sufijo `-1`, `-2`… de GitHub para los repetidos, más las `<a id>`/`<a name>`.
 *
 * @param {string} contenido
 * @returns {Set<string>}
 */
export const anclasDe = (contenido) => {
  const anclas = new Set();
  /** @type {Map<string, number>} */
  const vistos = new Map();
  for (const linea of lineasSinCodigo(contenido)) {
    for (const m of linea.matchAll(/<a\s+(?:[^>]*\s)?(?:id|name)="([^"]+)"/g)) anclas.add(m[1]);
    const h = /^\s{0,3}#{1,6}\s+(.*)$/.exec(linea);
    if (!h) continue;
    const base = slugDeGithub(textoVisible(h[1]));
    let slug = base;
    const n = vistos.get(base);
    if (n !== undefined) {
      slug = `${base}-${n}`;
      // `github-slugger` sigue buscando si el sufijado choca con otro existente.
      let k = n;
      while (anclas.has(slug)) slug = `${base}-${++k}`;
      vistos.set(base, k + 1);
    } else {
      vistos.set(base, 1);
    }
    anclas.add(slug);
  }
  return anclas;
};

/**
 * Los enlaces con ancla de un documento: `](#x)` y `](algo.md#x)`. Los que van
 * a `http(s)://` quedan afuera — son de otro sitio y no se pueden resolver
 * acá. El código en línea (`` `](#x)` ``) tampoco cuenta: es un ejemplo, no
 * una cita.
 *
 * @param {string} contenido
 * @returns {{ linea: number, destino: string, ancla: string }[]}
 */
export const enlacesConAncla = (contenido) =>
  lineasSinCodigo(contenido).flatMap((linea, i) =>
    [...linea.replace(/`[^`]*`/g, '').matchAll(/\]\(\s*<?([^()\s#>]*\.md|)#([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)/g)].map(
      (m) => {
        let ancla = m[2];
        try {
          ancla = decodeURIComponent(ancla);
        } catch {
          /* se deja como está: un `%` suelto no es un escape */
        }
        return { linea: i + 1, destino: m[1], ancla };
      },
    ),
  );

/**
 * Los enlaces rotos de un corpus.
 *
 * @param {Record<string, string>} textos archivo del corpus → contenido
 * @param {(ruta: string) => string | null} leerDestino lee un `.md` del repo, o `null` si no existe
 * @returns {{ archivo: string, linea: number, enlace: string, motivo: 'sin-archivo' | 'sin-encabezado' }[]}
 */
export const rotos = (textos, leerDestino) => {
  /** @type {Map<string, Set<string> | null>} */
  const cache = new Map();
  const anclasDeRuta = (ruta) => {
    if (!cache.has(ruta)) {
      const c = ruta in textos ? textos[ruta] : leerDestino(ruta);
      cache.set(ruta, c === null ? null : anclasDe(c));
    }
    return cache.get(ruta);
  };

  const salida = [];
  for (const [archivo, contenido] of Object.entries(textos)) {
    for (const { linea, destino, ancla } of enlacesConAncla(contenido)) {
      const ruta = destino === '' ? archivo : normalize(join(dirname(archivo), destino));
      const anclas = anclasDeRuta(ruta);
      const enlace = `${destino}#${ancla}`;
      if (anclas === null) salida.push({ archivo, linea, enlace, motivo: 'sin-archivo' });
      else if (!anclas.has(ancla)) salida.push({ archivo, linea, enlace, motivo: 'sin-encabezado' });
    }
  }
  return salida.sort((a, b) => a.archivo.localeCompare(b.archivo) || a.linea - b.linea);
};

/** @param {string} archivo */
export const seBarre = (archivo) =>
  archivo === 'CLAUDE.md' || (archivo.startsWith('docs/') && archivo.endsWith('.md'));

/**
 * El relevamiento completo contra el disco. Lo comparten el CLI y el test, para
 * que la red congele **lo mismo** que el informe muestra.
 *
 * @param {{ archivos?: string[], leer?: (a: string) => string | null }} [opciones]
 */
export const relevar = ({
  archivos = archivosDelRepo(),
  leer = (a) => (existsSync(a) ? readFileSync(a, 'utf8') : null),
} = {}) => {
  /** @type {Record<string, string>} */
  const textos = {};
  for (const archivo of archivos.filter(seBarre)) {
    const c = leer(archivo);
    if (c !== null) textos[archivo] = c;
  }
  const enlaces = Object.values(textos).reduce((n, c) => n + enlacesConAncla(c).length, 0);
  return { corpus: Object.keys(textos), enlaces, rotos: rotos(textos, leer) };
};

// ── CLI ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { corpus, enlaces, rotos: sueltos } = relevar();

  process.stdout.write(`archivos barridos: ${corpus.length}\n`);
  process.stdout.write(`enlaces con ancla: ${enlaces}\n`);
  if (sueltos.length === 0) {
    process.stdout.write('sin anclas rotas\n');
    process.exit(0);
  }
  process.stdout.write(`anclas rotas: ${sueltos.length}\n`);
  for (const { archivo, linea, enlace, motivo } of sueltos) {
    const que = motivo === 'sin-archivo' ? 'el archivo no existe' : 'ningún encabezado da ese slug';
    process.stdout.write(`  ${archivo}:${linea}  ](${enlace})  — ${que}\n`);
  }
  process.stdout.write(
    '\nUn ancla rota no da error: la página carga y el salto no va a ninguna parte.\n' +
      'La causa típica en este repo es el `·` de los encabezados, que deja **dos**\n' +
      'guiones (`### 5.3 · Algo` es `#53--algo`), o un encabezado renombrado.\n' +
      'La red que impide que aparezca una nueva es `tests/anclas-referenciadas.test.ts`.\n',
  );
  process.exit(process.argv.includes('--estricto') ? 1 : 0);
}
