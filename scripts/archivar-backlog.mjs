/**
 * **Archivar los ítems cerrados del backlog** — mueve de `docs/BACKLOG.md` a
 * `docs/BACKLOG-cerrados.md` todo lo que ya está `✅ hecho` o `❌ descartado`.
 *
 *   node scripts/archivar-backlog.mjs --dry-run   # qué se movería, sin tocar nada
 *   node scripts/archivar-backlog.mjs             # lo mueve
 *
 * ── Por qué hace falta ────────────────────────────────────────────────────
 * El 2026-09-17 el archivo tenía **19.143 líneas y 426 ítems, de los cuales 360
 * estaban cerrados**: el 87% de la prosa era rastro, y lo que falta hacer estaba
 * enterrado adentro. El rastro **no se borra** —la cabecera del backlog y el
 * skill `al-backlog` son explícitos: «no borres el texto, el rastro importa más
 * que la prolijidad de la lista»— pero no tiene por qué estar en el mismo
 * archivo que lo pendiente.
 *
 * ── Por qué es un script y no una edición a mano ──────────────────────────
 * Porque el mes que viene hay otros cincuenta cerrados. Una partición hecha a
 * mano es una foto que envejece desde el minuto siguiente; esto se vuelve a
 * correr y el archivo vivo vuelve a quedar en lo que falta. Es la misma regla que
 * el resto del repo aplica a todo lo demás: **lo relevante se deriva, no se
 * mantiene a mano**.
 *
 * ── La garantía: no se pierde ni una línea ────────────────────────────────
 * El movimiento es por **rebanada de líneas**, del encabezado del ítem hasta la
 * línea anterior al próximo encabezado o sección. No hay round-trip markdown →
 * objeto → markdown, que perdería comillas latinas, tablas y saltos (el mismo
 * motivo por el que el tablero reescribe una línea y nada más). Antes de escribir
 * nada, el script **verifica** que la suma de las dos salidas contenga cada
 * bloque movido carácter por carácter, y aborta si no.
 *
 * ── Lo que NO se mueve ────────────────────────────────────────────────────
 * - La cabecera del archivo, con los seis huecos de numeración. Es la que explica
 *   por qué faltan números, y se lee antes de numerar uno nuevo.
 * - La prosa introductoria de cada sección, que es de la sección y no del ítem.
 * - Los ítems `abierto` y `empezado`, que son lo que falta hacer.
 *
 * ── Y la trampa que esto abre, ya tapada ──────────────────────────────────
 * `proximoNumero` del tablero busca `B-\d+` en **todo** el archivo, y los ids
 * cerrados son parte de la defensa contra el choque de numeración (el `B-930`
 * que dos frentes eligieron a la vez el 2026-09-15). Sacarlos de la vista del
 * tablero haría que el próximo id propuesto pisara uno ya usado. Por eso
 * `servidor.mjs` lee **los dos archivos** y le pasa los dos textos a
 * `proximoNumero` e `idsUsados`.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * El formato del archivo —qué es un encabezado de ítem y qué es una sección— se
 * **importa**, no se vuelve a escribir. Hasta el 2026-09-17 este archivo tenía su
 * propia copia de los dos regex, idéntica por casualidad a la de `parseo.mjs`. Es
 * la clase de D-88 (un formato cuyo consumidor deriva por separado) y el modo de
 * fallar era silencioso: el día que el parser reconozca un prefijo de id nuevo,
 * el archivador deja de ver esos ítems y **no los archiva nunca más**, con la
 * suite en verde. Una sola copia, y el test lo sostiene.
 */
import { ENCABEZADO, SECCION, parsearBacklog } from './tablero/parseo.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
export const VIVO = join(RAIZ, 'docs', 'BACKLOG.md');
export const ARCHIVO = join(RAIZ, 'docs', 'BACKLOG-cerrados.md');

/**
 * Un ítem que cambió de archivo.
 *
 * @typedef {{id: string, estado: string, seccion: string}} Movimiento
 */

/** Los dos estados que son una puerta cerrada. El resto es lo que falta hacer. */
const CERRADOS = new Set(['hecho', 'descartado']);

/**
 * La sección que no tiene ítems `###` sino una tabla de una fila por bug, para
 * lo que se reportó y se arregló en el momento. Se mueve entera: es, por
 * definición, lo ya cerrado.
 */
const SECCION_TABLA = 'Cerrados';

/**
 * La cabecera que lleva el archivo de cerrados, con el enlace de vuelta.
 *
 * Se escribe una sola vez: si el archivo ya existe, se conserva la suya tal como
 * esté —alguien puede haberle agregado una nota— y solo se le agregan los ítems
 * nuevos.
 */
const CABECERA = [
  '# Backlog — cerrados',
  '',
  'El rastro de lo que se rompió y por qué, y de lo que se decidió no hacer.',
  '**Nada de acá está pendiente**: lo que falta vive en [`BACKLOG.md`](BACKLOG.md).',
  '',
  'Los ítems están tal como se escribieron, con su prosa entera y bajo la sección',
  'en la que vivían. Se mueven solos: `node scripts/archivar-backlog.mjs` se lleva',
  'de `BACKLOG.md` todo lo que quedó `✅ hecho` o `❌ descartado`, así que el',
  'archivo vivo vuelve a ser lo que falta hacer cada vez que se corre.',
  '',
  '**El tablero (`npm run tablero`) lee los dos archivos**, así que los chips de',
  '«Hechos» y «Descartados» siguen mostrando todo esto, y el próximo `B-` libre se',
  'calcula sobre los ids de los dos — si se calculara solo sobre el vivo,',
  'propondría un número ya usado.',
  '',
].join('\n');

/**
 * Parte un texto de backlog en sus piezas, por rebanadas de líneas.
 *
 * Devuelve el preámbulo (todo lo anterior a la primera sección) y, por sección,
 * su prosa y sus ítems con el texto exacto de cada uno.
 */
export const despiezar = (texto) => {
  const lineas = texto.split('\n');
  const { items } = parsearBacklog(texto);
  const porLinea = new Map(items.map((it) => [it.linea - 1, it]));

  const secciones = [];
  let preambulo = lineas;
  let actual = null;
  let bloque = null;

  const cerrarBloque = (hasta) => {
    if (!bloque) return;
    bloque.texto = lineas.slice(bloque.desde, hasta).join('\n');
    actual.items.push(bloque);
    bloque = null;
  };

  lineas.forEach((linea, i) => {
    const sec = SECCION.exec(linea);
    if (sec) {
      cerrarBloque(i);
      if (secciones.length === 0) preambulo = lineas.slice(0, i);
      else actual.hasta = i;
      actual = { titulo: sec[1], desde: i, hasta: lineas.length, prosa: [], items: [] };
      secciones.push(actual);
      return;
    }
    if (!actual) return;
    if (ENCABEZADO.test(linea)) {
      cerrarBloque(i);
      const it = porLinea.get(i);
      // Un `###` con forma de id que el parser no reconoció no se toca: se queda
      // donde está, que es más seguro que adivinar su estado.
      if (it) bloque = { id: it.id, estado: it.estado, desde: i };
      else if (actual.items.length === 0) actual.prosa.push(linea);
      return;
    }
    if (bloque) return;
    if (actual.items.length === 0) actual.prosa.push(linea);
  });
  cerrarBloque(lineas.length);

  return { preambulo: preambulo.join('\n'), secciones };
};

/** El texto de una sección entera, tal como está en el archivo. */
const textoDeSeccion = (texto, sec) => texto.split('\n').slice(sec.desde, sec.hasta).join('\n');

/**
 * Calcula las dos salidas. Puro: no toca el disco, para que el test pueda
 * afirmar sobre el texto y no sobre un archivo.
 *
 * Mueve en las dos direcciones: lo cerrado va al archivo, y lo que estaba
 * archivado y volvió a estar abierto regresa al vivo.
 *
 * @returns {{vivo: string, archivo: string, movidos: Movimiento[], devueltos: Movimiento[]}}
 */
export const archivar = (textoVivo, textoArchivo = '') => {
  const { preambulo, secciones } = despiezar(textoVivo);
  const yaArchivado = textoArchivo.trim() ? despiezar(textoArchivo) : { preambulo: '', secciones: [] };

  const movidos = [];
  const devueltos = [];
  const vivo = [preambulo];
  /** @type {Map<string, string[]>} Sección → bloques que se van, en orden. */
  const aArchivar = new Map();

  /*
   * El camino de vuelta, que hace que los dos archivos no se puedan separar.
   * Un ítem archivado se puede reabrir —desde el tablero, o a mano— y ahí deja
   * de ser rastro: vuelve a ser trabajo pendiente. Sin esto quedaría abierto
   * adentro del archivo de cerrados, que es la peor de las dos mentiras
   * posibles, y ninguna corrida futura lo sacaría de ahí.
   */
  const aDevolver = new Map();
  for (const sec of yaArchivado.secciones) {
    for (const it of sec.items) {
      if (CERRADOS.has(it.estado)) continue;
      if (!aDevolver.has(sec.titulo)) aDevolver.set(sec.titulo, []);
      aDevolver.get(sec.titulo).push(it);
      devueltos.push({ id: it.id, estado: it.estado, seccion: sec.titulo });
    }
  }

  for (const sec of secciones) {
    // La tabla de «Cerrados» no tiene ítems: se mueve entera y no deja sección
    // vacía atrás.
    if (sec.titulo === SECCION_TABLA) {
      const entero = textoDeSeccion(textoVivo, sec);
      if (entero.trim()) {
        aArchivar.set(sec.titulo, [entero.split('\n').slice(1).join('\n')]);
        movidos.push({ id: `(tabla de ${SECCION_TABLA})`, estado: 'hecho', seccion: sec.titulo });
      }
      continue;
    }

    const quedan = sec.items.filter((it) => !CERRADOS.has(it.estado));
    const se_van = sec.items.filter((it) => CERRADOS.has(it.estado));

    vivo.push([`## ${sec.titulo}`, ...sec.prosa].join('\n'));
    for (const it of quedan) vivo.push(it.texto);
    for (const it of aDevolver.get(sec.titulo) ?? []) vivo.push(it.texto);
    aDevolver.delete(sec.titulo);

    if (se_van.length === 0) continue;
    if (!aArchivar.has(sec.titulo)) aArchivar.set(sec.titulo, []);
    for (const it of se_van) {
      aArchivar.get(sec.titulo).push(it.texto);
      movidos.push({ id: it.id, estado: it.estado, seccion: sec.titulo });
    }
  }

  // El archivo: su cabecera, después cada sección con lo que ya tenía y lo nuevo
  // al final. El orden de las secciones es el del archivo vivo, que es el orden
  // de prioridad — y las que solo existen en el archivo se conservan atrás.
  // Una sección que solo existe del lado del archivo y tiene un ítem reabierto
  // se recrea en el vivo: es raro, pero perder el ítem no es una opción.
  for (const [titulo, its] of aDevolver) {
    vivo.push(`## ${titulo}`);
    for (const it of its) vivo.push(it.texto);
  }

  const cabecera = yaArchivado.preambulo.trim() || CABECERA;
  const titulosViejos = yaArchivado.secciones.map((s) => s.titulo);
  const orden = [...aArchivar.keys(), ...titulosViejos.filter((t) => !aArchivar.has(t))];

  const salida = [cabecera];
  for (const titulo of orden) {
    const vieja = yaArchivado.secciones.find((s) => s.titulo === titulo);
    const previos = vieja
      ? [
          vieja.prosa.join('\n').trim(),
          ...vieja.items.filter((i) => CERRADOS.has(i.estado)).map((i) => i.texto),
        ]
      : [];
    const bloques = [...previos, ...(aArchivar.get(titulo) ?? [])].filter((b) => b.trim());
    if (bloques.length === 0) continue;
    salida.push(`## ${titulo}`);
    salida.push(...bloques);
  }

  /*
   * Cada pieza se normaliza por los dos extremos y se junta con **una** línea en
   * blanco. Recortar solo el final no alcanzaba: la tabla de «Cerrados» se
   * mueve sin su título y arrancaba con un blanco, así que la primera corrida
   * dejaba dos y la segunda uno — el archivo no era idéntico a sí mismo. Lo
   * encontró el caso de idempotencia, no una lectura del diff.
   */
  const unir = (partes) =>
    `${partes.map((p) => p.replace(/^\n+/u, '').replace(/\s+$/u, '')).join('\n\n')}\n`;
  return { vivo: unir(vivo), archivo: unir(salida), movidos, devueltos };
};

/**
 * La verificación que corre **antes** de escribir: cada bloque que se mueve
 * tiene que estar, carácter por carácter, en una de las dos salidas.
 *
 * No es paranoia decorativa. Lo que se mueve es prosa que costó escribir y que
 * nadie va a poder reconstruir, y el modo de fallar de un script como este es
 * silencioso: un `slice` corrido por uno se come una línea y el diff tiene mil.
 */
export const verificar = (textoVivo, salida) => {
  const { secciones } = despiezar(textoVivo);
  const juntas = `${salida.vivo}\n${salida.archivo}`;
  const perdidos = [];
  for (const sec of secciones) {
    for (const it of sec.items) {
      if (!juntas.includes(it.texto.trim())) perdidos.push(it.id);
    }
  }
  return perdidos;
};

/** Escribe un archivo sin dejarlo a medias: temporal al lado y `rename`. */
const escribirAtomico = async (ruta, texto) => {
  const tmp = `${ruta}.archivar.tmp`;
  await writeFile(tmp, texto, 'utf8');
  await rename(tmp, ruta);
};

const principal = async () => {
  const seco = process.argv.includes('--dry-run');
  const textoVivo = await readFile(VIVO, 'utf8');
  const textoArchivo = await readFile(ARCHIVO, 'utf8').catch(() => '');

  const salida = archivar(textoVivo, textoArchivo);
  const perdidos = verificar(textoVivo, salida);
  if (perdidos.length > 0) {
    process.stderr.write(
      `\n  ✗ No se escribió nada: ${perdidos.length} ítems no aparecen enteros en la salida.\n` +
        `    ${perdidos.slice(0, 10).join(', ')}\n\n`,
    );
    process.exitCode = 1;
    return;
  }

  const lineas = (t) => t.split('\n').length;
  const porEstado = salida.movidos.reduce((acc, m) => {
    acc[m.estado] = (acc[m.estado] ?? 0) + 1;
    return acc;
  }, {});

  process.stdout.write(
    `\n  Se mueven ${salida.movidos.length} ítems ` +
      `(${Object.entries(porEstado).map(([k, v]) => `${v} ${k}`).join(', ')})\n` +
      `  docs/BACKLOG.md          ${lineas(textoVivo)} → ${lineas(salida.vivo)} líneas\n` +
      `  docs/BACKLOG-cerrados.md ${textoArchivo ? lineas(textoArchivo) : 0} → ${lineas(salida.archivo)} líneas\n` +
      (seco ? '\n  --dry-run: no se tocó nada.\n\n' : '\n'),
  );

  if (seco) return;
  // El archivo primero: si algo falla en el medio, el rastro está duplicado —que
  // es recuperable— y no perdido.
  await escribirAtomico(ARCHIVO, salida.archivo);
  await escribirAtomico(VIVO, salida.vivo);
  process.stdout.write('  Escritos los dos archivos.\n\n');
};

if (import.meta.url === `file://${process.argv[1]}`) await principal();
