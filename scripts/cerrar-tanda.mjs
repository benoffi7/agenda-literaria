#!/usr/bin/env node
/**
 * El barrido del cierre de una tanda en paralelo — B-1125 y B-1090.
 *
 *   node scripts/cerrar-tanda.mjs                       # la tanda de /tmp/agenda-literaria-frentes.md
 *   node scripts/cerrar-tanda.mjs /tmp/otra-tanda.md    # otra tanda
 *   node scripts/cerrar-tanda.mjs --desde e025ca7       # otra base (varias tandas juntas)
 *   node scripts/cerrar-tanda.mjs --estado ruta/.estado # otro directorio de estado
 *   node scripts/cerrar-tanda.mjs --todo-el-estado      # sin filtrar .estado/ por fecha
 *
 * Sale con 1 si falta algo, con 0 si la tanda se puede dar por cerrada.
 *
 * ── Por qué existe ────────────────────────────────────────────────
 * Las dos cosas que se perdían al cerrar una tanda tienen la misma forma: el
 * dato **está escrito**, pero en un lugar que no se versiona, y el paso que lo
 * mueve al repo dependía de que quien integra se acordara.
 *
 * - **B-1090:** un frente acuña un número de decisión o de ítem en un commit o
 *   en un comentario, y el texto de la entrada queda en su informe o en
 *   `.estado/`. Seis veces nadie lo pegó.
 * - **B-1125:** el protocolo manda anotar lo que quedó abierto (`⏸`) y las
 *   preguntas al orquestador (`❓`) en `.estado/<frente>.md`, que está en el
 *   `.gitignore`. Un `npm audit fix` y un helper compartido se perdieron así.
 *
 * `.estado/` **se queda ignorado** —son archivos de coordinación de una sola
 * tanda— y el arreglo no es versionarlo: es que el cierre los lea solo.
 *
 * ── Qué mira, y por qué solo lo nuevo ─────────────────────────────
 * Las citas se toman de dos lugares: **los mensajes de commit** de la tanda
 * (`base..HEAD`) y **las líneas agregadas** en su diff. No del repo entero:
 * eso ya lo barren `items-referenciados.mjs` y `decisiones-referenciadas.mjs`,
 * con la deuda vieja congelada en sus tests. Si este script mirara el repo
 * entero saldría con 1 en todas las tandas por huérfanas de hace meses, y un
 * chequeo que siempre falla se aprende a saltear (B-180). Lo que acá importa
 * es lo que **esta tanda** citó y no escribió.
 *
 * El «escrito» es el mismo que usan los dos barridos gemelos —encabezados,
 * filas en negrita, huecos declarados— y se importa de ellos: el formato de un
 * id se compone, no se reescribe (B-1113).
 *
 * La base se lee del archivo de la tanda (`Base: \`main\` @ \`abc1234\``),
 * que es donde el orquestador ya la escribe. Si no está, pide `--desde`: no
 * inventa una.
 *
 * La mitad que decide es pura y tiene tests (`tests/cerrar-tanda.test.ts`); el
 * `git` y el disco van en el CLI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REGISTROS,
  RESERVADOS_SIN_ESCRIBIR,
  huecosDeclarados,
  itemsDeFilaEnNegrita,
  itemsEscritos,
  referenciasDe as referenciasB,
  seBarre as seBarreB,
} from './items-referenciados.mjs';
import {
  REGISTRO,
  decisionesEscritas,
  referenciasDe as referenciasD,
  seBarre as seBarreD,
} from './decisiones-referenciadas.mjs';
import { DIGITOS, SUFIJO, rangosReservados } from './tablero/parseo.mjs';

/** El archivo de coordinación de la tanda, el mismo default que el tablero (D-981). */
export const ARCHIVO_DE_TANDA = process.env.FRENTES ?? '/tmp/agenda-literaria-frentes.md';

/**
 * El commit base que el archivo de la tanda declara, o `null`.
 *
 * Las tandas lo escriben siempre igual —`Base: \`main\` @ \`46cc3f5\``, a veces
 * con texto después— así que se busca eso y nada más.
 *
 * @param {string} texto
 * @returns {string | null}
 */
export const baseDeLaTanda = (texto) =>
  /^Base:[^\n@]*@\s*`([0-9a-f]{7,40})`/mu.exec(texto ?? '')?.[1] ?? null;

/**
 * Las líneas agregadas de un diff unificado, con su archivo.
 *
 * Se leen las `+` y se descartan las cabeceras `+++`. El archivo sale de la
 * línea `+++ b/…`; un archivo borrado (`+++ /dev/null`) no aporta líneas.
 *
 * @param {string} diff salida de `git diff -U0`
 * @returns {{ archivo: string, texto: string }[]}
 */
export const lineasAgregadas = (diff) => {
  /** @type {{ archivo: string, texto: string }[]} */
  const lineas = [];
  let archivo = null;
  for (const linea of (diff ?? '').split('\n')) {
    if (linea.startsWith('+++ ')) {
      archivo = linea.startsWith('+++ b/') ? linea.slice(6) : null;
      continue;
    }
    if (archivo && linea.startsWith('+')) lineas.push({ archivo, texto: linea.slice(1) });
  }
  return lineas;
};

/**
 * El texto sin las declaraciones de rango («del 1 al 9» escrito con ids y una
 * `a` en el medio).
 *
 * Un rango es una **reserva**, no un id acuñado: el orquestador anota en un
 * commit qué números le da a una sesión hermana, y la punta de ese rango casi
 * nunca llega a usarse. Sin esto, el commit que reservó cuatro decisiones
 * aparecía como si hubiera citado una que nadie escribió.
 *
 * @param {string} texto
 * @returns {string}
 */
export const sinRangos = (texto) =>
  (texto ?? '').replace(new RegExp(String.raw`\b([BD])-${DIGITOS}${SUFIJO}\s+a\s+\1-${DIGITOS}${SUFIJO}`, 'gu'), '');

/** El número de una decisión sin el cero a la izquierda: `D-09` y `D-9` son la misma. */
const numeroD = (d) => Number(d.slice(2));

/**
 * Lo que los registros versionados tienen escrito, con la misma lectura que
 * los barridos gemelos.
 *
 * @param {{ backlog: string, cerrados: string, decisiones: string }} registros
 * @returns {{ items: Set<string>, decisiones: Set<number> }}
 */
export const escritos = ({ backlog, cerrados, decisiones }) => ({
  items: new Set([
    ...[backlog, cerrados].flatMap(itemsEscritos),
    ...[backlog, cerrados].flatMap(itemsDeFilaEnNegrita),
    ...[backlog, cerrados].flatMap(huecosDeclarados),
    ...Object.keys(RESERVADOS_SIN_ESCRIBIR),
  ]),
  decisiones: new Set(decisionesEscritas(decisiones).map(numeroD)),
});

/**
 * Los ids citados por la tanda que no tienen entrada, con dónde se los citó.
 *
 * `fuentes` es una lista de `{ donde, texto, archivo? }`: un commit trae su
 * hash corto en `donde` y ningún archivo; una línea agregada trae el archivo,
 * que se filtra con el `seBarre` del gemelo que corresponde —así este cierre
 * no se tropieza con el test que cita ids inventados a propósito—.
 *
 * `reservados` marca los números que la tanda reservó (sección `## Rangos`):
 * uno de esos sin entrada es casi seguro el texto de un informe que no se pegó.
 *
 * @param {{ donde: string, texto: string, archivo?: string }[]} fuentes
 * @param {{ items: Set<string>, decisiones: Set<number> }} registro
 * @param {{ bugs: number[], decisiones: number[] }} [reservados]
 * @returns {{ id: string, donde: string[], reservado: boolean }[]}
 */
export const sinEntrada = (fuentes, registro, reservados = { bugs: [], decisiones: [] }) => {
  const bugsReservados = new Set(reservados.bugs);
  const decisionesReservadas = new Set(reservados.decisiones);
  /** @type {Map<string, { donde: Set<string>, reservado: boolean }>} */
  const porId = new Map();
  const anotar = (id, donde, reservado) => {
    const previo = porId.get(id) ?? { donde: new Set(), reservado };
    previo.donde.add(donde);
    porId.set(id, previo);
  };

  for (const { donde, texto: crudo, archivo } of fuentes) {
    const texto = sinRangos(crudo);
    if (!archivo || seBarreB(archivo)) {
      for (const id of referenciasB(texto)) {
        if (registro.items.has(id)) continue;
        anotar(id, donde, bugsReservados.has(Number(id.replace(/\D/gu, ''))));
      }
    }
    if (!archivo || seBarreD(archivo)) {
      for (const id of referenciasD(texto)) {
        if (registro.decisiones.has(numeroD(id))) continue;
        anotar(`D-${numeroD(id)}`, donde, decisionesReservadas.has(numeroD(id)));
      }
    }
  }

  const clave = (id) => [id.startsWith('D-') ? 1 : 0, Number(id.replace(/\D/gu, ''))];
  return [...porId.entries()]
    .map(([id, { donde, reservado }]) => ({ id, donde: [...donde].sort(), reservado }))
    .sort((a, b) => {
      const [ta, na] = clave(a.id);
      const [tb, nb] = clave(b.id);
      return ta - tb || na - nb || a.id.localeCompare(b.id);
    });
};

/** Los tres marcadores del protocolo de `.estado/`. */
const MARCADOR = /[✅⏸❓]/gu;

/**
 * Un pendiente que dice adónde fue: «Anotado como B-nnn», «anotada en B-nnn».
 * Si ese ítem está escrito, el pendiente ya tiene rastro versionado.
 */
const DESTINO = new RegExp(String.raw`anotad[oa]s?\s+(?:como|en)\s+(?:el\s+)?(B-${DIGITOS}${SUFIJO})`, 'iu');

/**
 * La línea de ejemplo del formato, que el brief de cada tanda copia tal cual
 * («`[HH:MM] B-xxx ⏸  por qué se dejó abierto`»). No es un pendiente.
 */
const PLANTILLA = /\[HH:MM\]|B-xxx/u;

/**
 * Las líneas de un archivo de estado que quedaron abiertas.
 *
 * Una línea está abierta si su **último** marcador es `⏸` o `❓` —la misma
 * regla que D-980 le puso al backlog: el archivo crece agregando al final, y
 * «⏸ … ✅ resuelto» en la misma línea es una cosa cerrada—.
 *
 * Una abierta que dice adónde fue («Anotado como B-nnn») y cuyo destino está
 * escrito sale como `derivada`: se informa, pero no frena el cierre.
 *
 * @param {string} texto
 * @param {Set<string>} [items] los ítems escritos
 * @returns {{ linea: number, marca: string, texto: string, derivada: string | null }[]}
 */
export const pendientesDe = (texto, items = new Set()) =>
  (texto ?? '').split('\n').flatMap((linea, i) => {
    const marcas = linea.match(MARCADOR);
    const marca = marcas?.at(-1);
    if (marca !== '⏸' && marca !== '❓') return [];
    if (PLANTILLA.test(linea)) return [];
    const destino = DESTINO.exec(linea)?.[1];
    const canonico = destino ? referenciasB(destino)[0] : null;
    return [{
      linea: i + 1,
      marca,
      texto: linea.trim(),
      derivada: canonico && items.has(canonico) ? canonico : null,
    }];
  });

/**
 * El veredicto de la tanda, a partir de lo ya leído.
 *
 * @param {{
 *   commits: { hash: string, mensaje: string }[],
 *   agregadas: { archivo: string, texto: string }[],
 *   registros: { backlog: string, cerrados: string, decisiones: string },
 *   tanda: string,
 *   estado: { archivo: string, texto: string }[],
 *   yaCitados?: (id: string) => boolean,
 * }} entrada
 */
export const cerrarTanda = ({ commits, agregadas, registros, tanda, estado, yaCitados = () => false }) => {
  const registro = escritos(registros);
  const reservados = rangosReservados(tanda);
  const fuentes = [
    ...commits.map(({ hash, mensaje }) => ({ donde: `commit ${hash}`, texto: mensaje })),
    ...agregadas.map(({ archivo, texto }) => ({ donde: archivo, texto, archivo })),
  ];
  const candidatos = sinEntrada(fuentes, registro, reservados);
  // Un id que ya se citaba sin entrada en la base es deuda vieja, no de esta
  // tanda: la congelan los tests de los barridos gemelos. Aparece acá cuando
  // la tanda **mueve** texto —el archivador pasa ítems de un backlog al otro y
  // cada línea movida es una línea agregada— y reportarlo haría que el cierre
  // saliera con 1 en todas las tandas.
  const huerfanos = candidatos.filter((h) => !yaCitados(h.id));
  const arrastrados = candidatos.filter((h) => yaCitados(h.id));

  const pendientes = [
    { archivo: 'archivo de la tanda', texto: tanda },
    ...estado,
  ].flatMap(({ archivo, texto }) =>
    pendientesDe(texto, registro.items).map((p) => ({ archivo, ...p })),
  );
  const abiertos = pendientes.filter((p) => !p.derivada);
  const derivados = pendientes.filter((p) => p.derivada);

  return {
    huerfanos,
    arrastrados,
    abiertos,
    derivados,
    cerrada: huerfanos.length === 0 && abiertos.length === 0,
  };
};

// ── CLI ───────────────────────────────────────────────────────────

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/** El `.estado/` del árbol principal: en un worktree no existe, vive al lado del `.git` común. */
const estadoPorDefecto = () => {
  const comun = resolve(git('rev-parse', '--git-common-dir').trim());
  return join(dirname(comun), '.estado');
};

const opcion = (nombre) => {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? undefined : process.argv[i + 1];
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const conValor = new Set(['--desde', '--estado']);
  const posicionales = process.argv
    .slice(2)
    .filter((a, i, todos) => !a.startsWith('--') && !conValor.has(todos[i - 1]));
  const archivoTanda = posicionales[0] ?? ARCHIVO_DE_TANDA;
  const tanda = existsSync(archivoTanda) ? readFileSync(archivoTanda, 'utf8') : '';
  const base = opcion('--desde') ?? baseDeLaTanda(tanda);

  if (!base) {
    process.stderr.write(
      `No encuentro la base de la tanda en ${archivoTanda} (una línea «Base: \`main\` @ \`abc1234\`»).\n` +
        'Pasala con --desde <commit>.\n',
    );
    process.exit(2);
  }

  const baseCommit = git('rev-parse', base).trim();
  const desdeMs = Number(git('show', '-s', '--format=%ct', baseCommit).trim()) * 1000;

  const commits = git('log', '--format=%h%x00%B%x01', `${baseCommit}..HEAD`)
    .split('\x01')
    .map((c) => c.replace(/^\n+/u, ''))
    .filter(Boolean)
    .map((c) => {
      const [hash, mensaje = ''] = c.split('\x00');
      return { hash, mensaje };
    });
  const agregadas = lineasAgregadas(git('diff', '-U0', '--no-color', `${baseCommit}`));

  const [backlog, cerrados] = REGISTROS.map((r) => readFileSync(r, 'utf8'));
  const decisiones = readFileSync(REGISTRO, 'utf8');

  const dirEstado = opcion('--estado') ?? estadoPorDefecto();
  const todoElEstado = process.argv.includes('--todo-el-estado');
  const estado = existsSync(dirEstado)
    ? readdirSync(dirEstado)
        .filter((a) => a.endsWith('.md'))
        .map((a) => join(dirEstado, a))
        .filter((a) => todoElEstado || statSync(a).mtimeMs >= desdeMs)
        .map((archivo) => ({ archivo, texto: readFileSync(archivo, 'utf8') }))
    : [];

  // ¿El id ya se citaba en el árbol de la base? `git grep -q` sale con 1 si no.
  const yaCitados = (id) => {
    try {
      git('grep', '-q', '-w', '-F', id, baseCommit, '--');
      return true;
    } catch {
      return false;
    }
  };

  const { huerfanos, arrastrados, abiertos, derivados, cerrada } = cerrarTanda({
    commits,
    agregadas,
    registros: { backlog, cerrados, decisiones },
    tanda,
    estado,
    yaCitados,
  });

  const out = (s) => process.stdout.write(`${s}\n`);
  out(`tanda: ${archivoTanda}${tanda ? '' : ' (no existe)'}`);
  out(`base: ${base} — ${commits.length} commit(s), ${agregadas.length} línea(s) agregadas`);
  out(`estado: ${dirEstado} — ${estado.length} archivo(s)${todoElEstado ? '' : ' tocados desde la base'}`);

  out(`\nids citados por la tanda sin entrada en ${REGISTROS.join(', ')} ni ${REGISTRO}: ${huerfanos.length}`);
  for (const { id, donde, reservado } of huerfanos) {
    out(`  ${id}${reservado ? ' (rango de esta tanda)' : ''} — ${donde.slice(0, 4).join(', ')}${donde.length > 4 ? ` … +${donde.length - 4}` : ''}`);
  }

  if (arrastrados.length > 0) {
    out(`  (más ${arrastrados.length} que ya se citaban sin entrada en la base, deuda vieja: ${arrastrados.map((a) => a.id).join(', ')})`);
  }

  out(`\npendientes ⏸/❓ sin rastro versionado: ${abiertos.length}`);
  for (const { archivo, linea, texto } of abiertos) out(`  ${archivo}:${linea}  ${texto}`);
  if (derivados.length > 0) {
    out(`\npendientes que ya dicen adónde fueron (no frenan): ${derivados.length}`);
    for (const { archivo, linea, derivada } of derivados) out(`  ${archivo}:${linea} → ${derivada}`);
  }

  if (cerrada) {
    out('\nla tanda se puede cerrar: todo lo citado está escrito y no queda nada abierto');
    process.exit(0);
  }
  out(
    '\nCada huérfano es el texto de un informe o de un .estado/ que no se pegó: va a su\n' +
      'archivo antes de cerrar. Cada pendiente sale como ítem del BACKLOG o como línea\n' +
      'del cierre; .estado/ está en el .gitignore y lo que quede ahí se pierde (B-1125).',
  );
  process.exit(1);
}
