#!/usr/bin/env node
/**
 * Lista los lugares donde el repo **afirma el estado** de un `B-nnn` y esa
 * afirmación no coincide con el estado que el ítem tiene en los dos backlogs.
 *
 *   node scripts/estados-referenciados.mjs            # informa, sale con 0
 *   node scripts/estados-referenciados.mjs --estricto # sale con 1 si hay contradicciones
 *
 * Es el tercero de la familia de `scripts/items-referenciados.mjs` y
 * `scripts/decisiones-referenciadas.mjs` —mismo corte, misma salida, mismo
 * motivo—, corrido sobre la capa que a los otros dos se les escapa por diseño.
 * Los dos gemelos verifican que un id **exista**; ninguno mira lo que la cita
 * **afirma**.
 *
 * ── Por qué existe ────────────────────────────────────────────────
 * Una fila `| **B-480** | … | ⛔ acción manual del dueño |` pasa los dos
 * barridos que ya hay: el id tiene el formato correcto, tiene entrada, y el
 * enlace —si lo hay— resuelve. Lo único falso es el estado, que es justamente
 * lo que alguien lee para decidir qué hacer esta semana.
 *
 * El caso que lo abrió es **B-480**: `docs/16-analitica-del-sitio.md` lo llamó
 * «⛔ bloqueado» durante **diecinueve días** después de que dejara de bloquear
 * (resuelto el 2026-09-03). El documento **se contradecía a tres párrafos de
 * distancia** —su propia cabecera decía «B-480 resuelto el 2026-09-03»— y nadie
 * lo vio. Peor: el frente que estaba arreglando ese archivo **propagó la
 * redacción vieja a filas nuevas**, porque lo razonable al escribir una fila es
 * copiar el formato de la de al lado. Un estado falso no se queda quieto: se
 * reproduce.
 *
 * Esas filas ya están arregladas —las corrigió a mano el frente de B-1085
 * mientras esto se escribía— y el barrido nace, para esa dirección, en cero. No
 * es que sobre: **es la prueba de que el barrido mide lo que dice medir.** Lo
 * que no estaba arreglado, y nadie había visto, es la contradicción en la
 * dirección contraria (B-481, abajo).
 *
 * Y no es la primera vez que este repo lo paga. **B-784** existe entero por lo
 * mismo, con el título escrito como un parte médico: «la ficha del auditor dice
 * que B-480 está pendiente, y ya está hecho». Se arregló a mano, sin dejar nada
 * que impidiera la próxima.
 *
 * ── Qué cuenta como afirmar un estado, y qué no ───────────────────
 * **La afirmación es de registro, no de prosa.** El corte no es «un emoji cerca
 * de un id» —eso da sesenta coincidencias y casi todas son historia, no
 * estado—, sino las dos formas con las que un documento lleva **un registro
 * paralelo** de lo que el backlog ya registra:
 *
 *  1. **Una fila de tabla con una columna de estado** — una celda que es *solo*
 *     el id (`| **B-480** |`, con o sin negrita) y una última celda que abre
 *     con un emoji de estado. Es la forma de un mini-backlog embebido, y es la
 *     que se pudre: afirma el estado **de hoy**, así que el día que el ítem
 *     cambia, la fila miente.
 *  2. **`⛔ bloqueado por B-nnn`** — la única forma en prosa que se compara,
 *     porque no cuenta una fecha sino una condición vigente: dice que ese ítem
 *     **sigue abierto y sigue frenando**. Es la redacción exacta que se propagó
 *     a ocho lugares en el caso de B-480.
 *
 * Lo que queda afuera, y a propósito: `✅ Construida el 2026-09-02 (B-109)`.
 * Eso es un **hecho fechado**, no un estado — fue construida ese día y lo sigue
 * siendo para siempre, pase lo que pase con B-109. Compararlo llenaría el
 * informe de ruido, que es como un informe deja de leerse. Medido: de las **71**
 * coincidencias de «emoji cerca de un id» que tienen los `.md` del repo, **17**
 * son afirmaciones de estado y **54** son historia fechada.
 *
 * ── Por qué la comparación es binaria y no emoji contra emoji ─────
 * Se compara **cerrado contra no cerrado**, y nada más fino. El vocabulario de
 * «abierto» tiene cuatro emojis (`🟡` a medias, `🟠` empezado, `⛔` bloqueado,
 * `🔵` futuro) y la elección entre ellos es de quien escribe, no un dato: hoy
 * mismo `docs/16-analitica-del-sitio.md` dice `🟡 construida` de B-374 y
 * `docs/BACKLOG.md` dice `⛔ depende de un mes de datos` del mismo ítem. Las
 * dos son ciertas y dicen lo mismo —falta trabajo— así que compararlas al
 * detalle daría un falso positivo el primer día.
 *
 * **`🟡` es el que más falsos positivos amenazaba** —significa «a medias»,
 * «empezado» y «hecho el alcance angosto que el dueño aprobó», según la fila— y
 * el corte binario lo desactiva. Medido sobre el repo del 2026-09-22, antes de
 * que el frente de B-1085 corrigiera las filas: de las **5** afirmaciones con
 * `🟡`, el corte binario reportaba **1** —B-372, que el backlog tenía `✅
 * hecho`— y era verdadera; comparar el emoji exacto habría reportado además
 * B-374, que es falsa (el documento dice `🟡 construida` y el backlog `⛔
 * depende de un mes de datos`: las dos ciertas). Por eso `🟡` **sí** se
 * compara; lo que no se compara es contra qué.
 *
 * ── Las dos direcciones se informan por separado ──────────────────
 * No son la misma falla ni piden el mismo trabajo:
 *
 * - **El documento se quedó atrás** (dice ⛔/🟡/🟠/🔵, el backlog dice ✅/❌).
 *   Es el caso de B-480: el trabajo está hecho y el documento sigue mandando a
 *   esperar. Se arregla en el documento.
 * - **El documento va adelante** (dice ✅/❌, el backlog lo tiene abierto). Es
 *   el caso de **B-481**, que este barrido encontró al escribirse: las
 *   tipografías están autoalojadas desde el 2026-09-03 —`public/fuentes/`,
 *   D-340— y `docs/BACKLOG.md` sigue diciendo `🔵 futuro`. **Éste es el peor de
 *   los dos**, porque el que miente es el registro: quien busque trabajo en el
 *   backlog puede rehacer algo que ya está. Se arregla en el backlog.
 *
 * ── Lo que este barrido NO hace ───────────────────────────────────
 * **No mira la historia de git.** La otra mitad de la clase —un ítem abierto
 * cuyo trabajo ya está commiteado en `main`, que es como B-1112 casi se rehace—
 * se midió y **no entró**. Se midió dos veces el mismo día, y los dos números
 * juntos son el argumento:
 *
 * - **Con la tanda del 2026-09-22 en vuelo**: 64 ítems abiertos, **8** con
 *   commits `feat(B-nnn)`/`fix(B-nnn)` en `main`. De esos 8, **cuatro** eran
 *   ítems que un frente estaba trabajando en ese mismo momento.
 * - **Con la tanda ya integrada**: 67 abiertos, **2**. Los mismos dos ítems, que
 *   son los dos falsos positivos duros: `B-813` y `B-836a`, ítems con varias
 *   salidas de los que se hizo una — `B-836a` lo dice en el título, «registrado
 *   y cableado, **falta** publicar, verificar y exigir».
 *
 * O sea: **cero verdaderos positivos en el estado estable, y seis de ocho
 * falsos en el inestable.** Un chequeo que está rojo mientras hay una tanda
 * abierta —o sea por razones que no son el cambio de quien lo corre— es el modo
 * de falla de B-180, y se aprende a saltear. Queda anotado como un ítem aparte
 * del backlog, con los dos números medidos adentro. Es lo que D-750 pide: un chequeo tiene que
 * verificar lo que dice, y entregar uno que no se puede creer es la otra cara
 * de uno que no mira nada.
 *
 * ── Por qué informa acá y frena en el test ────────────────────────
 * Igual que su gemelo de los `B-` huérfanos: `tests/estados-referenciados.test.ts`
 * congela las contradicciones de hoy y **se pone rojo con una nueva**, que es
 * el único momento en que arreglarla sale barato —la fila recién escrita, el
 * autor todavía con el contexto en la cabeza—. Hoy la lista congelada tiene
 * **una** sola entrada, y no se puede cerrar desde acá: se arregla en
 * `docs/BACKLOG.md`, que en una tanda en paralelo lo escribe quien integra.
 * Cerrar una vieja también da rojo, y está bien: hay que sacarla de la lista a
 * mano, que es la forma de que la lista **solo baje**.
 *
 * La mitad que decide es pura y tiene tests; el barrido del disco es la mitad
 * que no se puede testear. Mismo corte que `relevar-infra.sh` /
 * `comparar-infra.sh`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El helper de B-964, y no un `git ls-files` propio: lo rastreado **más** lo
// nuevo sin `git add`, que es justo el archivo que estrena una fila.
import { archivosDelRepo } from '../tests/fixtures/archivos-del-repo.ts';
import {
  DIGITOS,
  ESTADO_DE_EMOJI_EN_TABLA,
  ESTADOS_EN_TABLA,
  ID,
  SUFIJO,
  parsearBacklog,
} from './tablero/parseo.mjs';
import { EXTENSIONES, REGISTROS, expandir, idCanonico } from './items-referenciados.mjs';

/*
 * **Nada de lo de arriba se vuelve a escribir acá, y es deliberado** — D-88,
 * B-1113, B-1222. `DIGITOS`/`SUFIJO`/`ID` son el formato del id y
 * `ESTADO_DE_EMOJI_EN_TABLA`/`ESTADOS_EN_TABLA` el vocabulario de estado, que
 * viven una sola vez en `parseo.mjs`; `expandir`/`idCanonico`/`REGISTROS`/
 * `EXTENSIONES` son el vocabulario del backlog y el corpus del repo, que viven
 * una sola vez en el gemelo. Un barrido que se escribe sus propias copias es exactamente la clase
 * que este repo persigue, y `tests/archivar-backlog.test.ts` lo frena.
 */

/*
 * **El mapa de emoji → estado no se escribe acá** — B-1222.
 *
 * Hasta el 2026-09-24 este archivo tenía el suyo, con siete emojis contra los
 * cinco de `parseo.mjs`: las **tablas** usan además `⛔` (bloqueado) y `🔵`
 * (futuro), que ningún encabezado lleva. Eran dos formas distintas del archivo y
 * no dos copias de la misma, pero fallaban como una copia: el día que un
 * encabezado estrenara un emoji, este barrido dejaba de reconocerlo y comparaba
 * menos, en silencio. Ahora el de las tablas se compone en `parseo.mjs` encima
 * del de encabezado, y acá se importa. `tests/estados-referenciados.test.ts`
 * lee este fuente y frena el día que vuelva a haber un mapa propio.
 */

/**
 * Los dos estados que son una puerta cerrada, igual que en el archivador. El
 * resto —`abierto`, `empezado`, `bloqueado`, `futuro`— es lo que falta hacer.
 *
 * **Toda la comparación de este barrido pasa por acá y por nada más fino.** El
 * porqué está arriba, en «Por qué la comparación es binaria».
 */
export const CERRADO = new Set(['hecho', 'descartado']);

/** El primer emoji de estado de un texto, o `null`. */
const emojiDe = (texto) => new RegExp(`(${ESTADOS_EN_TABLA})`, 'u').exec(texto ?? '')?.[1] ?? null;

/** `B-836a` con el número y la letra en grupos propios. */
const B_CON_GRUPOS = String.raw`B-(${DIGITOS})(${SUFIJO})`;

/** Una celda cuyo contenido es **solo** el id, con o sin negrita. */
const CELDA_DE_ID = new RegExp(String.raw`^\s*\**\s*${B_CON_GRUPOS}\s*\**\s*$`, 'u');

/**
 * El run de ids con el que **abre** un encabezado: `### B-830 a B-839 · …`,
 * `### B-772 / B-654 · …`, `### B-1112 · …`.
 *
 * Es el prefijo y no «cualquier id de la línea», y la diferencia importa: el
 * título de un ítem cita otros todo el tiempo (`### B-1132 · Un `toThrow()`
 * pelado … más débil que lo que B-1130 sacó — ✅ hecho`). Leer B-1130 de ahí
 * daría por cerrado un ítem que nadie cerró.
 */
const PREFIJO_DE_IDS = new RegExp(String.raw`^###\s+(${ID}(?:\s*(?:a|y|,|/)\s*${ID})*)`, 'u');

/**
 * El emoji seguido de `bloqueado por` y un id — la única forma en prosa que se
 * compara. (El ejemplo no se escribe acá entero y a propósito: escrito de
 * corrido es literalmente lo que este barrido reporta, y se reportó a sí mismo
 * al escribirlo. Es la misma cautela que el gemelo anota sobre sus rangos de
 * ejemplo.)
 *
 * Se construye en función y no como constante: un regex global lleva
 * `lastIndex`, y compartir la instancia entre dos barridos se saltea
 * coincidencias (la misma trampa que `parseo.mjs` anota en `B_SUELTO`).
 *
 * Los 40 caracteres de margen dejan entrar el `**` de la negrita y un adverbio
 * («sigue bloqueado por»), y dejan afuera la frase larga donde el emoji ya no
 * habla de ese id. **`bloqueante para B-nnn` queda afuera a propósito**: eso
 * afirma el estado *del otro* ítem, de rebote, y la cadena de inferencia es
 * justo lo que vuelve ruidoso a un chequeo.
 */
const bloqueadoPor = () =>
  new RegExp(
    String.raw`(${ESTADOS_EN_TABLA})[^|]{0,40}?bloquead[oa]s?\s+por\s+\**\s*${B_CON_GRUPOS}`,
    'giu',
  );

/**
 * El cuerpo de una línea, sin la decoración que la envuelve.
 *
 * Una tabla no vive solo en un `.md`: este repo escribe tablas adentro de
 * docblocks (`src/styles/global.css` tiene una comparando el load con y sin
 * tipografías de Google) y adentro de citas. Sin esto, el barrido miraría solo
 * los `.md` — que es exactamente el desbalance que **B-1147** acaba de
 * corregir en el gemelo de las `D-`.
 */
export const cuerpoDeLinea = (linea) => linea.replace(/^[\s>]*(?:\/\/|\/\*|\*\/|\*)?\s*/u, '');

/**
 * Las celdas de una fila de tabla, o `null` si la línea no es una fila.
 *
 * @param {string} linea
 * @returns {string[] | null}
 */
export const celdasDe = (linea) => {
  const cuerpo = cuerpoDeLinea(linea);
  if (!cuerpo.startsWith('|')) return null;
  return cuerpo.slice(1).replace(/\|\s*$/u, '').split('|');
};

/**
 * La afirmación de estado que hace una fila de tabla, o `null`.
 *
 * El id sale de la **primera celda que es solo el id**, y el estado de la
 * **última celda no vacía**. Las dos elecciones son el mismo corte: así es una
 * columna de estado, y así la escriben las tablas que el repo ya tiene —la de
 * `16-analitica-del-sitio.md`, las de adentro de los encabezados de rango del
 * backlog, la de `prd/01-propuestas-de-organizadores.md`—.
 *
 * Una fila donde el id aparece **mezclado con prosa** (`| 4 | El tag de GA4
 * (**B-372**) | ✅ … |`) no es un registro de ese ítem: es una fila sobre otra
 * cosa que lo menciona. No se compara.
 *
 * @param {string} linea
 * @returns {{item: string, emoji: string, dice: string, forma: 'fila'} | null}
 */
export const afirmacionDeFila = (linea) => {
  const celdas = celdasDe(linea);
  if (!celdas) return null;
  let item = null;
  for (const celda of celdas) {
    const m = CELDA_DE_ID.exec(celda);
    if (m) {
      item = idCanonico(m[1], m[2]);
      break;
    }
  }
  if (!item) return null;
  const ultima = [...celdas].reverse().find((c) => c.trim());
  const emoji = emojiDe(ultima);
  return emoji ? { item, emoji, dice: ESTADO_DE_EMOJI_EN_TABLA[emoji], forma: 'fila' } : null;
};

/**
 * Todas las afirmaciones de estado de un texto, con su línea.
 *
 * @param {string} contenido
 * @returns {{item: string, emoji: string, dice: string, forma: string, linea: number}[]}
 */
export const afirmacionesDe = (contenido) =>
  contenido.split('\n').flatMap((linea, i) => {
    /** @type {any[]} */
    const encontradas = [];
    const fila = afirmacionDeFila(linea);
    if (fila) encontradas.push({ ...fila, linea: i + 1 });
    for (const m of linea.matchAll(bloqueadoPor())) {
      encontradas.push({
        item: idCanonico(m[2], m[3]),
        emoji: m[1],
        dice: 'bloqueado',
        forma: 'bloqueo',
        linea: i + 1,
      });
    }
    return encontradas;
  });

/**
 * Los ids con los que abre un encabezado, expandidos y en forma canónica.
 *
 * @param {string} encabezado
 * @returns {string[]}
 */
export const idsDelEncabezado = (encabezado) => {
  const m = PREFIJO_DE_IDS.exec(encabezado);
  return m ? expandir(m[1]) : [];
};

/**
 * El estado que cada ítem tiene **en el registro**, que son los dos backlogs.
 *
 * Hay dos fuentes y una gana sobre la otra:
 *
 *  1. **La fila de tabla en negrita** (`| **B-480** | … | ✅ hecho |`). Es como
 *     están escritos los ítems que viven adentro de un encabezado de rango, que
 *     son 22 y no tienen encabezado propio.
 *  2. **El encabezado del ítem**, leído con `parsearBacklog` para no reescribir
 *     el formato. Gana, porque es la definición del ítem.
 *
 * **Un encabezado que nombra más de un id no le pone estado a ninguno**, salvo
 * que traiga marcador. `### B-370 a B-379, B-480 y B-481 · La analítica del
 * sitio público · P2` es el título de una sección con una tabla adentro: leerlo
 * como «B-370 está abierto» pisaría el `🟡` de su propia fila. Los cuatro
 * encabezados de rango del repo se resuelven así, y el único que sí trae
 * marcador (`### B-772 / B-654 · ✅ hecho …`) se lo pone a los dos.
 *
 * @param {Record<string, string>} textos archivo → contenido
 * @returns {Map<string, {estado: string, donde: string}>}
 */
export const estadosDelRegistro = (textos) => {
  /** @type {Map<string, {estado: string, donde: string}>} */
  const estados = new Map();

  for (const [archivo, contenido] of Object.entries(textos)) {
    contenido.split('\n').forEach((linea, i) => {
      const fila = afirmacionDeFila(linea);
      if (fila) estados.set(fila.item, { estado: fila.dice, donde: `${archivo}:${i + 1}` });
    });
  }

  for (const [archivo, contenido] of Object.entries(textos)) {
    for (const item of parsearBacklog(contenido).items) {
      const ids = idsDelEncabezado(item.encabezado);
      const donde = `${archivo}:${item.linea}`;
      if (ids.length === 1) estados.set(ids[0], { estado: item.estado, donde });
      else if (item.estado !== 'abierto') {
        for (const id of ids) estados.set(id, { estado: item.estado, donde });
      }
    }
  }

  return estados;
};

/** El número y la letra de un id canónico, para ordenar. */
const orden = (id) => {
  const m = new RegExp(String.raw`^${B_CON_GRUPOS}$`, 'u').exec(id);
  return m ? [Number(m[1]), m[2]] : [Infinity, ''];
};

const porItem = (a, b) => {
  const [na, la] = orden(a.item);
  const [nb, lb] = orden(b.item);
  return na - nb || la.localeCompare(lb) || a.archivo.localeCompare(b.archivo) || a.linea - b.linea;
};

/**
 * Las afirmaciones que contradicen al registro, separadas por dirección.
 *
 * `sinEstado` son las que hablan de un ítem del que el registro no dice nada
 * —un id sin entrada, que es lo que reporta `items-referenciados.mjs`, o un
 * ítem dentro de un rango sin fila propia—. Se cuentan y no se reportan: no hay
 * contra qué compararlas, y reportarlas duplicaría el informe del gemelo.
 *
 * @param {Record<string, {item: string, dice: string}[]>} porArchivo
 * @param {Map<string, {estado: string, donde: string}>} estados
 */
export const contradicciones = (porArchivo, estados) => {
  const atrasadas = [];
  const adelantadas = [];
  let sinEstado = 0;

  for (const [archivo, afirmaciones] of Object.entries(porArchivo)) {
    for (const afirmacion of afirmaciones) {
      const real = estados.get(afirmacion.item);
      if (!real) {
        sinEstado += 1;
        continue;
      }
      const documentoCerrado = CERRADO.has(afirmacion.dice);
      const registroCerrado = CERRADO.has(real.estado);
      if (documentoCerrado === registroCerrado) continue;
      (documentoCerrado ? adelantadas : atrasadas).push({ ...afirmacion, archivo, real });
    }
  }

  return { atrasadas: atrasadas.sort(porItem), adelantadas: adelantadas.sort(porItem), sinEstado };
};

/**
 * Archivos que quedan afuera, con el motivo de cada uno.
 *
 * - `package-lock.json`: megabytes de hashes donde `B-` no significa nada.
 * - Los dos backlogs: **son** el registro. Compararlos contra sí mismos no dice
 *   nada, y la única discrepancia interna posible —encabezado de rango contra
 *   fila— ya la resuelve `estadosDelRegistro`.
 * - `tests/estados-referenciados.test.ts`: **el archivo que prueba este
 *   barrido**. Sus controles positivos necesitan plantar contradicciones
 *   sintéticas —es literalmente el caso que hay que ejercitar— así que barrerlo
 *   haría que el chequeo se reporte a sí mismo y no pueda quedar verde nunca.
 *   Es la misma excepción que el gemelo le hace a la suya.
 */
const AFUERA = new Set(['package-lock.json', 'tests/estados-referenciados.test.ts', ...REGISTROS]);

/** @param {string} archivo */
export const seBarre = (archivo) =>
  !AFUERA.has(archivo) && EXTENSIONES.some((e) => archivo.endsWith(e));

/**
 * El relevamiento completo contra el disco.
 *
 * Lo comparten el CLI y el test, para que la red congele **lo mismo** que el
 * informe muestra. Recibe el lector para poder ejercitarlo sin disco.
 *
 * @param {{ archivos?: string[], leer?: (a: string) => string }} [opciones]
 */
export const relevar = ({
  archivos = archivosDelRepo(),
  leer = (a) => readFileSync(a, 'utf8'),
} = {}) => {
  const estados = estadosDelRegistro(Object.fromEntries(REGISTROS.map((r) => [r, leer(r)])));

  /** @type {Record<string, any[]>} */
  const porArchivo = {};
  for (const archivo of archivos.filter(seBarre)) {
    const afirmaciones = afirmacionesDe(leer(archivo));
    if (afirmaciones.length > 0) porArchivo[archivo] = afirmaciones;
  }

  const { atrasadas, adelantadas, sinEstado } = contradicciones(porArchivo, estados);
  return {
    estados,
    corpus: archivos.filter(seBarre),
    afirmaciones: Object.values(porArchivo).flat().length,
    atrasadas,
    adelantadas,
    sinEstado,
  };
};

// ── CLI ───────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { estados, corpus, afirmaciones, atrasadas, adelantadas, sinEstado } = relevar();

  process.stdout.write(`ítems con estado en ${REGISTROS.join(' + ')}: ${estados.size}\n`);
  process.stdout.write(`archivos barridos: ${corpus.length}\n`);
  process.stdout.write(
    `afirmaciones de estado: ${afirmaciones}` +
      (sinEstado > 0 ? ` (${sinEstado} sobre ítems sin estado en el registro)\n` : '\n'),
  );

  const linea = ({ archivo, linea: n, item, emoji, real }) =>
    `  ${archivo}:${n} — ${item} dice ${emoji} ${ESTADO_DE_EMOJI_EN_TABLA[emoji] ?? 'bloqueado'}, ` +
    `el registro dice ${real.estado} (${real.donde})\n`;

  if (atrasadas.length === 0 && adelantadas.length === 0) {
    process.stdout.write('sin contradicciones\n');
    process.exit(0);
  }

  if (atrasadas.length > 0) {
    process.stdout.write(`\nel documento se quedó atrás: ${atrasadas.length}\n`);
    for (const c of atrasadas) process.stdout.write(linea(c));
    process.stdout.write(
      '  El trabajo está cerrado y el documento sigue mandando a esperar. Se arregla\n' +
        '  en el documento, y conviene mirar las filas de al lado: una redacción vieja\n' +
        '  se copia a la fila siguiente, que es como B-480 llegó a ocho lugares.\n',
    );
  }

  if (adelantadas.length > 0) {
    process.stdout.write(`\nel documento va adelante: ${adelantadas.length}\n`);
    for (const c of adelantadas) process.stdout.write(linea(c));
    process.stdout.write(
      '  Acá el que miente es el **registro**, y por eso es el caso caro: quien busque\n' +
        '  trabajo en el backlog puede rehacer algo que ya está hecho. Verificá contra el\n' +
        '  código cuál de los dos tiene razón, y después marcá el ítem.\n',
    );
  }

  process.stdout.write(
    '\nNingún otro barrido de este repo mira esto: `items-referenciados.mjs` y\n' +
      '`decisiones-referenciadas.mjs` verifican que el id **exista**, no lo que la cita\n' +
      '**afirma**. Un estado falso es un id válido con una entrada válida.\n' +
      'La red que impide que aparezca uno nuevo es `tests/estados-referenciados.test.ts`.\n',
  );
  process.exit(process.argv.includes('--estricto') ? 1 : 0);
}
