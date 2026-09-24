/**
 * **El tablero del backlog, la parte pura** — lee `docs/BACKLOG.md` y
 * `docs/11-ideas-de-producto.md` y devuelve ítems; y reescribe encabezados sin
 * tocar nada más.
 *
 * ── Por qué el markdown sigue siendo la fuente de verdad ──────────────────
 * La tentación evidente era una base de datos del backlog, con el markdown
 * generado desde ahí. No: `docs/BACKLOG.md` está versionado, se lee en un diff,
 * se cita desde el código (`B-xxx` aparece en docblocks y en commits) y lo
 * escriben tanto una persona como un agente. Una segunda fuente de verdad sería
 * la clase de bug que este repo persigue en todas las demás partes (§ «lo
 * relevante se deriva, no se mantiene a mano»).
 *
 * Así que el tablero **no tiene estado propio**: parsea el archivo en cada
 * pedido y, cuando el usuario cambia algo, reescribe **la línea del encabezado**
 * o inserta una nota. Nada más. Si el tablero desaparece, el backlog sigue
 * intacto; si alguien edita el markdown a mano mientras el tablero está abierto,
 * el tablero se entera (el servidor mira la fecha del archivo).
 *
 * ── Y por qué la escritura es quirúrgica ──────────────────────────────────
 * Porque el cuerpo de un ítem es prosa que costó escribir, y el skill
 * `al-backlog` es explícito: «no borres el texto, el rastro importa más que la
 * prolijidad de la lista». Un round-trip markdown → objeto → markdown perdería
 * comillas latinas, saltos de línea y tablas. Acá se reemplaza una línea, o se
 * inserta un bloque entre dos líneas que ya existían.
 *
 * ── El choque de numeración no es hipotético ──────────────────────────────
 * Pasó el 2026-09-15, mientras se escribía este archivo: dos frentes numeraron a
 * la vez y los dos eligieron `B-930` (de ahí el hueco `B-941`–`B-949` anotado en
 * la cabecera del backlog). Por eso `proximoId` existe acá y el servidor lo
 * vuelve a verificar contra el disco justo antes de escribir.
 */

/**
 * Un ítem del backlog. `encabezado` es la línea cruda tal como está en el disco:
 * es el dato con el que toda escritura verifica que el archivo no cambió abajo.
 *
 * @typedef {object} ItemDeBacklog
 * @property {'backlog'} tipo
 * @property {string} id
 * @property {string} titulo
 * @property {string} encabezado
 * @property {number} linea 1-indexada: es la que se le pasa al editor.
 * @property {string | null} seccion
 * @property {string | null} prioridad
 * @property {boolean} prioridadPropia ¿la trae el encabezado, o la hereda?
 * @property {'abierto' | 'hecho' | 'empezado' | 'descartado'} estado
 * @property {string | null} fecha
 * @property {string} cuerpo
 */

/**
 * Una idea de producto. No tiene prioridad ni estado: tiene desarrollo.
 *
 * @typedef {object} IdeaDeProducto
 * @property {'idea'} tipo
 * @property {string} id
 * @property {number} numero
 * @property {string} titulo
 * @property {string} encabezado
 * @property {number} linea
 * @property {string} cuerpo
 */

/**
 * El resultado de una escritura: el texto nuevo, o el motivo por el que no se
 * escribió nada. Nunca las dos cosas.
 *
 * @typedef {{texto: string, id?: string} | {error: string}} Resultado
 */

/*
 * ── El formato del archivo se escribe UNA vez, acá ────────────────────────
 * Lo de abajo —la forma de un id, la de un encabezado, la de una sección— es el
 * formato de `docs/BACKLOG.md`, y **se exporta** porque hay más de un programa
 * que lo lee: este parser y `scripts/archivar-backlog.mjs`. Hasta el 2026-09-17
 * el archivador tenía su propia copia de `ENCABEZADO` y de `SECCION`, idénticas
 * por casualidad. Es la clase de D-88 —un formato cuyo consumidor deriva por
 * separado— y su modo de fallar es el peor que hay: el día que acá se agregue un
 * prefijo de id nuevo, el archivador deja de reconocer esos ítems y **no los
 * archiva nunca más, sin que nada se ponga rojo**. Ahora hay una sola copia y
 * `tests/archivar-backlog.test.ts` frena la próxima.
 */

/**
 * **Los átomos del formato de un id, y por qué se exportan** — B-1113.
 *
 * `DIGITOS`, `SUFIJO` e `ID` son lo que cualquier consumidor necesita para
 * armar **su** matcher sin volver a escribir el formato. Antes eran privados y
 * solo salía `ID` ya compuesto, y eso no alcanzaba: el que necesita
 * `B-(\d+)([a-z]?)` **con grupos de captura propios** —para sacar el número y
 * la letra por separado— no puede usar `ID`, porque `ID` no captura. Así que
 * los escribía de nuevo, que es exactamente la copia que D-88 existe para
 * evitar.
 *
 * Pasó: `scripts/items-referenciados.mjs` nació con **cinco** copias del
 * formato y `tests/bloques-de-codigo-en-la-doc.test.ts` tenía otras dos, una de
 * ellas **más angosta** —`/^### (B-\d+)/`, sin sufijo de letra— así que su mapa
 * de duplicados confundía `B-836a` con `B-836` con la suite en verde.
 *
 * La regla que queda: **el que necesite otra forma del id la compone con estos
 * átomos**, no la reescribe. La red que lo obliga está en
 * `tests/archivar-backlog.test.ts` y su firma es justamente «quién redefine el
 * formato», no «quién escribe un literal de encabezado».
 */

/** Los dígitos de un id, que son lo que se compara para saber cuál es el próximo. */
export const DIGITOS = String.raw`\d+`;

/**
 * El sufijo de letra: `B-836a` es «la mitad manual del dueño de B-836», y va con
 * letra justamente para que no se lea como un ítem independiente.
 */
export const SUFIJO = String.raw`[a-z]?`;

/** El id de un ítem, que el archivo escribe `B-950`, `B-836a` o `DEC-6`. */
export const ID = String.raw`(?:B|DEC)-${DIGITOS}${SUFIJO}`;

/** Un encabezado de ítem: `### B-950 · Título… · P1 — pedido del dueño (fecha)`. */
export const ENCABEZADO = new RegExp(String.raw`^### +(${ID})\b(.*)$`, 'u');

/** La prioridad escrita en el encabezado, que gana sobre la de la sección. */
const PRIORIDAD = /·\s*(P[0-4])\b/u;

/**
 * **El vocabulario de estado se escribe UNA vez, acá, y se exporta** — B-1222.
 *
 * Hasta el 2026-09-24 `ESTADOS` y `ESTADO_DE_EMOJI` eran privados, y
 * `scripts/estados-referenciados.mjs` tenía su propio mapa con siete emojis.
 * No era una copia exacta —era un superset, a propósito— pero tenía el modo de
 * fallar de D-88: el día que un encabezado estrenara un emoji, el barrido de
 * estados dejaba de reconocerlo y **comparaba menos, en silencio**. Ahora el
 * que necesita otra forma la compone con esto, que es lo que B-1113 dejó dicho
 * para los átomos del id: «el que necesite otra forma la compone con estos
 * átomos, no la reescribe». La red está en `tests/estados-referenciados.test.ts`.
 */

/**
 * A qué estado del tablero corresponde cada emoji **de un encabezado**.
 *
 * Son cinco y no dos porque el archivo real usa cinco, y el tablero mostraba
 * **46 ítems cerrados como si estuvieran abiertos** por reconocer solo `✅` y
 * `🟠` detrás de una raya larga (2026-09-17). El vocabulario se lee del
 * archivo, no se le impone: `✅` hecho, `❌` descartado, `⚠️` mirado y sin
 * nada que arreglar, `🟡` a medias, `🟠` empezado.
 *
 * Y son cuatro estados y no dos. `hecho` es lo que se hizo; `descartado` es la
 * puerta que se cerró sin hacer nada —el `❌` explícito, y el `⚠️` de «se miró
 * y no hay bug que arreglar», que es lo mismo con otro nombre—; `empezado` junta
 * el `🟠` y el `🟡` de «a medias», que para quien mira el tablero son la misma
 * cosa: hay trabajo empezado y queda trabajo. Separar `descartado` de `hecho` no
 * es cosmética: son ocho ítems, y meterlos en «hecho» afirmaría un trabajo que
 * nunca se hizo.
 */
export const ESTADO_DE_EMOJI = Object.freeze({
  '✅': 'hecho',
  '❌': 'descartado',
  '⚠️': 'descartado',
  '🟡': 'empezado',
  '🟠': 'empezado',
});

/** Los emojis de un encabezado, en la forma en que se meten en un regex. */
export const ESTADOS = Object.keys(ESTADO_DE_EMOJI).join('|');

/**
 * El mismo mapa **en una celda de tabla**, que es otra forma del archivo.
 *
 * Las tablas —las de los documentos y las de adentro de un encabezado de rango
 * del propio backlog— usan además `⛔` (bloqueado) y `🔵` (futuro), que ningún
 * encabezado lleva y que el tablero no sabe escribir. Por eso no entran en
 * `ESTADO_DE_EMOJI`: meterlos ahí haría que el parser leyera como marcador un
 * emoji que en un título es prosa. Se componen **encima** del de encabezado,
 * así que un emoji nuevo de encabezado llega solo a las tablas.
 */
export const ESTADO_DE_EMOJI_EN_TABLA = Object.freeze({
  ...ESTADO_DE_EMOJI,
  '⛔': 'bloqueado',
  '🔵': 'futuro',
});

/** Los emojis de una celda de tabla, en la forma en que se meten en un regex. */
export const ESTADOS_EN_TABLA = Object.keys(ESTADO_DE_EMOJI_EN_TABLA).join('|');

/**
 * El marcador **cuando va detrás del título**, que es la forma más común.
 *
 * Anclado en el emoji y no en la raya: los títulos de este archivo usan rayas
 * largas para todo («…y nadie se entera de cuál de las dos es»), así que cortar
 * por `—` se llevaría medio título. Lo que no aparece en un título es un emoji
 * de estado. El separador de adelante puede ser `—` o `·` —el archivo usa los
 * dos, y exigir la raya era la mitad de los 46 falsos abiertos—. Se come hasta
 * el próximo `·` —que es donde suele empezar la prioridad— o hasta el final, y
 * el lookahead deja el espacio de antes afuera: sin eso, sacarle el marcador a
 * `… retención — ✅ hecho (fecha) · P1` devolvía `… retención· P1`, pegado.
 */
const MARCADOR_DETRAS = String.raw`\s*[—·]\s*(${ESTADOS})[^·]*?(?=\s*·|\s*$)`;

/**
 * **Un `✅` es «hecho» solo si dice que se cerró — B-1550.**
 *
 * El emoji solo no alcanza, y costó una decisión aprobada: el encabezado de B-98
 * decía «✅ aprobado (2026-08-26), pendiente de implementar», el parseo lo leyó
 * como hecho y el archivador lo mandó a los cerrados sin construir. La tilde
 * verde es también la de «aprobado», «parcial», «las 58 migradas · quedan 5».
 *
 * Por eso la lista es de **lo que cierra**, y no de lo que no: sacada de los dos
 * archivos el 2026-09-24 —`hecho` y sus flexiones, `cerrado`, `resuelto`,
 * `decidido` (incluido «decidido: no se hace»), `contestado`, `sin efecto`—.
 * El sentido importa por cómo falla cada una. Una lista de lo que *no* cierra
 * falla en silencio: la palabra nueva se lee como hecha y el ítem desaparece de
 * la lista viva, que es exactamente lo que le pasó a B-98. Una lista de lo que
 * cierra falla a la vista: el ítem se queda (o vuelve) entre lo que falta, y
 * alguien lo mira.
 *
 * El `✅` que no dice nada de eso se lee como **empezado**, no como abierto:
 * algo se aprobó, se hizo una parte o se decidió, y queda trabajo. Es el mismo
 * criterio que junta `🟠` y `🟡`, y mantiene la red de `tests/tablero.test.ts`
 * —«un encabezado con emoji de estado no se lee como abierto»—.
 */
const CIERRA = /(?<!\p{L})(?:hech[oa]s?|cerrad[oa]s?|resuelt[oa]s?|decidid[oa]s?|contestad[oa]s?|sin efecto)(?!\p{L})/iu;

/** El estado que dice un marcador, mirando el emoji y —si es `✅`— lo que dice. */
const estadoDelMarcador = (emoji, texto) => {
  if (emoji !== '✅') return ESTADO_DE_EMOJI[emoji];
  return CIERRA.test(texto) ? 'hecho' : 'empezado';
};

/**
 * El marcador **cuando va adelante del título**, que es la otra mitad.
 *
 * Treinta ítems (2026-09-17) se escribieron `### B-733 · ✅ hecho (2026-09-07) — El url de
 * cada subEvent…`: el marcador primero y el título después. Ahí no se puede
 * comer hasta el próximo `·`, porque no hay ninguno y se llevaría el título
 * entero. Corta en la fecha entre paréntesis, y si no la hay, en la raya larga
 * que abre el título.
 *
 * El prefijo tolera los ítems que nombran más de un id (`### B-772 / B-654 · ✅
 * hecho…`), porque esos ids son parte del encabezado y no del título.
 */
const MARCADOR_ADELANTE = new RegExp(
  String.raw`^(### +${ID}(?:\s*[·/y]\s*|\s+a\s+)*(?:${ID}\s*)*)\s*[—·]\s*(${ESTADOS})\s*[^·—(]*(?:\([^)]*\))?`,
  'u',
);

/** `(2026-09-15)`. Cuál de las del encabezado es la del estado lo decide `fechaDe`. */
const FECHA = /\((\d{4}-\d{2}-\d{2})\)/gu;

/** Los títulos de sección de primer nivel: `## P1 — bloquean el objetivo…`. */
export const SECCION = /^## +(.+?)\s*$/u;

/**
 * Un `B-` suelto en cualquier parte del texto, con su número aparte.
 *
 * No es lo mismo que `ENCABEZADO`: esto barre la **prosa**, porque un `B-960`
 * citado adentro de otro ítem ya está comprometido aunque no tenga sección
 * propia. Se construye en función: un regex global lleva `lastIndex`, y
 * compartir la instancia entre dos barridos se saltea coincidencias.
 */
const B_SUELTO = () => new RegExp(String.raw`\bB-(${DIGITOS})${SUFIJO}\b`, 'gu');

/** Los números de los `B-` que un texto nombra, uno por uno. */
const numerosEnTexto = (texto) =>
  new Set([...texto.matchAll(B_SUELTO())].map((m) => Number(m[1])));

/** Una idea de `11-ideas-de-producto.md`: `## 3 · "Completo": lo único que…`. */
const IDEA = /^## +(\d+) +· +(.+?)\s*$/u;

/** La prioridad que le corresponde a un ítem por la sección en la que vive. */
const prioridadDeSeccion = (seccion) => {
  const m = /^(P[0-4])\b/u.exec(seccion ?? '');
  return m ? m[1] : null;
};

/**
 * **Todos** los marcadores de estado del encabezado, en orden: dónde empieza
 * cada uno, dónde termina y con qué emoji. `[]` si no tiene ninguno.
 *
 * Se prueba primero la forma «adelante» porque es la más acotada: si el
 * marcador abre el encabezado, comerse hasta el próximo `·` se llevaría el
 * título. Devolver los índices y no el texto es lo que permite sacarlo con un
 * `slice` — reemplazar por texto podría pegarle a una aparición anterior.
 *
 * **Son todos y no el primero desde B-1550.** Un encabezado puede llevar dos:
 * B-785 decía «🟡 la mitad hecha (2026-09-09) — … · ✅ hecho (2026-09-24)»,
 * porque quien lo cerró agregó el marcador nuevo al final sin borrar el viejo.
 * Leer solo el primero lo dejaba empezado para siempre, y el archivador no lo
 * movía nunca.
 *
 * @returns {{emoji: string, estado: string, desde: number, hasta: number}[]}
 */
const marcadoresDe = (encabezado) => {
  const todos = [];
  let desde = 0;
  const adelante = MARCADOR_ADELANTE.exec(encabezado);
  if (adelante) {
    todos.push({ emoji: adelante[2], desde: adelante[1].length, hasta: adelante[0].length });
    desde = adelante[0].length;
  }
  // Global y en función, no compartido: un regex `g` lleva `lastIndex`.
  const detras = new RegExp(MARCADOR_DETRAS, 'gu');
  detras.lastIndex = desde;
  for (let m = detras.exec(encabezado); m; m = detras.exec(encabezado)) {
    if (m[0].length === 0) detras.lastIndex += 1;
    todos.push({ emoji: m[1], desde: m.index, hasta: m.index + m[0].length });
  }
  return todos.map((m) => ({
    ...m,
    estado: estadoDelMarcador(m.emoji, encabezado.slice(m.desde, m.hasta)),
  }));
};

/**
 * **El marcador que manda es el último — B-1550.**
 *
 * Cuando hay dos, el de más a la derecha es la actualización: el archivo se
 * escribe agregando al final (es lo que hace `conEstado`, y lo que hizo quien
 * cerró B-785), no reescribiendo lo anterior. Leer el primero sería leer la foto
 * vieja. Como el archivador clasifica con este mismo parseo, el tablero y el
 * archivador contestan lo mismo por construcción, no por coincidencia.
 *
 * @returns {{emoji: string, estado: string, desde: number, hasta: number} | null}
 */
const marcadorDe = (encabezado) => marcadoresDe(encabezado).at(-1) ?? null;

/**
 * El encabezado sin **ninguno** de sus marcadores de estado.
 *
 * Todos, no solo el que manda: si `conEstado` sacara uno y dejara el otro, marcar
 * B-785 como abierto lo dejaría con su `🟡` viejo, y el ítem seguiría leyéndose
 * empezado. Se sacan de derecha a izquierda para que los índices sigan valiendo.
 */
const sinMarcador = (encabezado) =>
  marcadoresDe(encabezado)
    .reverse()
    .reduce((texto, m) => texto.slice(0, m.desde) + texto.slice(m.hasta), encabezado);

/** El estado de un ítem, leído del encabezado. `abierto` es no tener marcador. */
const estadoDe = (encabezado) => marcadorDe(encabezado)?.estado ?? 'abierto';

/**
 * La fecha del estado: la del **marcador** cuando lo hay, y la última del
 * encabezado cuando no.
 *
 * No siempre es la última de la línea: `✅ contestado (2026-09-07) — … —
 * revisado el 2026-09-08 (D-560)` cierra el 7 y anota una relectura posterior.
 * La tarjeta dice cuándo se cerró, así que la fecha sale de donde se cerró.
 */
const fechaDe = (linea) => {
  const m = marcadorDe(linea);
  const donde = m ? linea.slice(m.desde, m.hasta) : linea;
  const todas = [...donde.matchAll(FECHA)];
  if (todas.length > 0) return todas[todas.length - 1][1];
  if (!m) return null;
  const enLaLinea = [...linea.matchAll(FECHA)];
  return enLaLinea.length > 0 ? enLaLinea[enLaLinea.length - 1][1] : null;
};

/**
 * El título limpio: sin el id, sin el marcador de estado y sin la prioridad.
 *
 * Se limpia para la tarjeta del tablero, donde esos tres datos ya están como
 * chips. El encabezado crudo se conserva aparte (`encabezado`) porque es lo que
 * el servidor compara contra el disco antes de escribir.
 */
const tituloDe = (resto) =>
  resto
    .replace(PRIORIDAD, '')
    // Dos veces: el marcador puede haber dejado el título abierto con su propia
    // raya (`· ✅ hecho (fecha) — El url de cada subEvent…`), y esa raya no es
    // parte del título.
    .replace(/^\s*[·—]\s*/u, '')
    .replace(/^\s*[·—]\s*/u, '')
    .replace(/\s+—\s*$/u, '')
    // Sacar la prioridad del medio deja dos espacios pegados. Se colapsan acá y
    // no en la pantalla: el título limpio es un dato, no una decisión de estilo.
    .replace(/\s{2,}/gu, ' ')
    .trim();

/**
 * Los ítems de `docs/BACKLOG.md`.
 *
 * Devuelve también la sección de cada uno porque no coincide siempre con la
 * prioridad: «Pendiente de acción manual del dueño» y «Decisiones pendientes»
 * están arriba de todo a propósito, y un ítem marcado `· P3` puede vivir dentro
 * de la sección P2 (el archivo lo hace, y es deliberado).
 *
 * @param {string} texto
 * @returns {{items: ItemDeBacklog[], secciones: string[]}}
 */
export const parsearBacklog = (texto) => {
  const lineas = texto.split('\n');
  /** @type {ItemDeBacklog[]} */
  const items = [];
  /** @type {string[]} */
  const secciones = [];
  /** @type {string | null} */
  let seccion = null;
  /** @type {ItemDeBacklog | null} */
  let actual = null;

  const cerrar = (hasta) => {
    if (!actual) return;
    actual.cuerpo = lineas.slice(actual.linea, hasta).join('\n').trim();
    items.push(actual);
    actual = null;
  };

  lineas.forEach((linea, i) => {
    const sec = SECCION.exec(linea);
    if (sec) {
      cerrar(i);
      seccion = sec[1];
      if (!secciones.includes(seccion)) secciones.push(seccion);
      return;
    }
    const enc = ENCABEZADO.exec(linea);
    if (!enc) return;
    cerrar(i);
    const [, id, resto] = enc;
    const prioridad = PRIORIDAD.exec(linea);
    actual = {
      tipo: 'backlog',
      id,
      titulo: tituloDe(ENCABEZADO.exec(sinMarcador(linea))[2]),
      encabezado: linea,
      /** 1-indexada: es la que se le pasa al editor para abrir el archivo ahí. */
      linea: i + 1,
      seccion,
      prioridad: prioridad ? prioridad[1] : prioridadDeSeccion(seccion),
      prioridadPropia: Boolean(prioridad),
      estado: estadoDe(linea),
      fecha: fechaDe(linea),
      cuerpo: '',
    };
  });
  cerrar(lineas.length);

  return { items, secciones };
};

/**
 * Las ideas de `docs/11-ideas-de-producto.md`.
 *
 * Son de otra naturaleza y por eso no se mezclan con el backlog: una idea no
 * tiene prioridad ni estado, tiene desarrollo. Lo único que el tablero necesita
 * saber de una es **si ya se convirtió en ítem**, y eso lo contesta buscando su
 * número de idea citado en el backlog — no un campo nuevo en ninguna parte.
 *
 * @param {string} texto
 * @returns {IdeaDeProducto[]}
 */
export const parsearIdeas = (texto) => {
  const lineas = texto.split('\n');
  /** @type {IdeaDeProducto[]} */
  const ideas = [];
  /** @type {IdeaDeProducto | null} */
  let actual = null;

  const cerrar = (hasta) => {
    if (!actual) return;
    actual.cuerpo = lineas.slice(actual.linea, hasta).join('\n').trim();
    ideas.push(actual);
    actual = null;
  };

  lineas.forEach((linea, i) => {
    const m = IDEA.exec(linea);
    if (!m) return;
    cerrar(i);
    actual = {
      tipo: 'idea',
      id: `IDEA-${m[1]}`,
      numero: Number(m[1]),
      titulo: m[2].trim(),
      encabezado: linea,
      linea: i + 1,
      cuerpo: '',
    };
  });
  cerrar(lineas.length);

  return ideas;
};

/**
 * El próximo `B-` libre.
 *
 * Mira **todo** el archivo y no solo los encabezados: un número citado en la
 * prosa de otro ítem («ver B-960») ya está comprometido aunque todavía no tenga
 * sección propia. Es el lado prudente, y es barato.
 *
 * Desde que lo cerrado se archiva aparte, el servidor le pasa **los dos
 * archivos concatenados**: el vivo solo tiene los ids de lo pendiente.
 *
 * **Y por encima de lo reservado — B-1051.** Un rango que una tanda reservó y
 * todavía no escribió no está en ningún backlog, así que sin `reservados` el
 * tablero lo ofrecía como libre. Los trae `rangosReservados`, leídos del archivo
 * de coordinación de la tanda.
 *
 * @param {string} texto
 * @param {Iterable<number>} [reservados]
 * @returns {number}
 */
export const proximoNumero = (texto, reservados = []) => {
  const usados = [...numerosEnTexto(texto), ...reservados];
  return usados.length === 0 ? 1 : Math.max(...usados) + 1;
};

/**
 * **Los números que una tanda reservó, leídos de donde la tanda los escribe —
 * B-1051.**
 *
 * El ítem ofrecía dos salidas: anotar el rango en la cabecera del backlog al
 * abrir la tanda, o que el tablero lo lea del archivo de coordinación. Se tomó
 * la segunda porque es la única que no depende de acordarse: anotar al reservar
 * «depende de que alguien se acuerde, que es exactamente lo que falló», y la
 * reserva ya está escrita en un solo lugar — la sección `## Rangos` del archivo
 * de frentes. Leerla ahí es derivar, no mantener a mano.
 *
 * El costo que el ítem nombraba —acoplarse a un formato que nadie prometió—
 * se paga con dos decisiones:
 *
 * - **Se lee la prosa, no una tabla.** Las tandas lo escribieron de tres formas
 *   («Bugs (diez c/u): triage 1560, b98 1570…», «Bugs: instagram 1270… (diez
 *   cada uno)», «`frente`: bugs desde el 1240 (diez), decisiones desde la 810
 *   (diez)»), y las tres dicen lo mismo: la palabra `bugs` o `decisiones`, un
 *   ancho y los números de arranque. Eso es lo que se busca, cada tramo hasta
 *   la próxima de esas dos palabras.
 * - **Si no entiende, no inventa.** Sin sección `## Rangos`, o sin números, no
 *   reserva nada y el tablero vuelve a ofrecer lo de antes. Nunca rompe.
 *
 * Y no escribe nada en el repo, que es la trampa de la cabecera del backlog: un
 * rango escrito en prosa versionada lo lee `items-referenciados.mjs` como citas.
 *
 * @param {string} texto el archivo de coordinación de la tanda
 * @returns {{bugs: number[], decisiones: number[]}}
 */
export const rangosReservados = (texto) => {
  const reservados = { bugs: [], decisiones: [] };
  const lineas = (texto ?? '').split('\n');
  const desde = lineas.findIndex((l) => /^## +Rangos\b/iu.test(l));
  if (desde === -1) return reservados;
  const hasta = lineas.findIndex((l, i) => i > desde && /^## /u.test(l));
  const seccion = lineas.slice(desde + 1, hasta === -1 ? lineas.length : hasta).join('\n');

  const ANCHOS = { cinco: 5, diez: 10, veinte: 20 };
  for (const tramo of seccion.split(/(?=\b(?:bugs|decisiones)\b)/iu)) {
    const tipo = /^(bugs|decisiones)\b/iu.exec(tramo)?.[1].toLowerCase();
    if (!tipo) continue;
    const palabra = /\((cinco|diez|veinte)\b/iu.exec(tramo)?.[1].toLowerCase();
    const ancho = palabra ? ANCHOS[palabra] : 10;
    const arranques = [...tramo.matchAll(/(?<![\d-])\d{3,}(?!\d)/gu)].map((m) => Number(m[0]));
    for (const inicio of arranques) {
      for (let n = inicio; n < inicio + ancho; n += 1) reservados[tipo].push(n);
    }
  }
  return reservados;
};

/**
 * Todos los ids `B-xxx` que el archivo ya nombra, para avisar de un choque.
 *
 * El `B-` suelto se deriva de `ID`, igual que el encabezado: son el mismo
 * formato escrito una sola vez. Antes eran dos literales sueltos acá abajo, que
 * es la misma clase de D-88 que el archivador tenía con `ENCABEZADO`.
 */
export const idsUsados = (texto) => new Set([...texto.matchAll(B_SUELTO())].map((m) => m[0]));

/**
 * Reemplaza la línea de encabezado de un ítem.
 *
 * Todas las escrituras pasan por acá, y todas piden el `encabezadoEsperado` que
 * el tablero tenía en pantalla: si el archivo cambió abajo —otra sesión, un
 * agente, el editor— la escritura **no ocurre**. Es la misma precondición que
 * los barridos de este repo usan contra Firestore (B-864), por el mismo motivo:
 * pisar el trabajo de otro es peor que fallar.
 *
 * @returns {Resultado}
 */
const reemplazarEncabezado = (texto, encabezadoEsperado, nuevo) => {
  const lineas = texto.split('\n');
  const i = lineas.indexOf(encabezadoEsperado);
  if (i === -1) {
    return {
      error:
        'El encabezado cambió en el disco desde que se cargó el tablero. ' +
        'Recargá para no pisar lo que escribió otro.',
    };
  }
  if (lineas.indexOf(encabezadoEsperado, i + 1) !== -1) {
    return { error: 'Hay dos encabezados idénticos en el archivo. Se resuelve a mano.' };
  }
  lineas[i] = nuevo;
  return { texto: lineas.join('\n') };
};

/**
 * Cambia la prioridad de un ítem.
 *
 * Si ya tenía una escrita, la pisa en su lugar; si no la tenía —la heredaba de
 * la sección— la agrega al final del encabezado. **No mueve el ítem de
 * sección**: el archivo ya convive con ítems `· P3` adentro de la sección P2, y
 * mover un bloque de prosa de decenas de líneas es exactamente la operación que
 * este tablero decidió no hacer.
 *
 * @returns {Resultado}
 */
export const conPrioridad = (texto, encabezado, prioridad) => {
  if (!/^P[0-4]$/u.test(prioridad)) return { error: `Prioridad inválida: ${prioridad}` };
  const nuevo = PRIORIDAD.test(encabezado)
    ? encabezado.replace(PRIORIDAD, `· ${prioridad}`)
    : `${encabezado.trimEnd()} · ${prioridad}`;
  return reemplazarEncabezado(texto, encabezado, nuevo);
};

const EMOJI = { hecho: '✅', empezado: '🟠', descartado: '❌' };
const PALABRA = { hecho: 'hecho', empezado: 'empezado', descartado: 'descartado' };

/**
 * Marca un ítem como hecho, empezado, o lo devuelve a abierto.
 *
 * El marcador nuevo va **al final de la línea**, aunque el que se sacó estuviera
 * en el medio. Es la forma que el archivo usa más seguido (`… · P1 — ✅ hecho
 * (fecha)` y `… — ✅ hecho (fecha) · P1` conviven), y elegir una sola hace que
 * el resultado sea predecible en un diff.
 *
 * `hecho` **no borra ni mueve el cuerpo** del ítem a la tabla de Cerrados: eso
 * es una decisión de quien escribe, y el propio skill dice que un ítem que se
 * cierra «dejalo donde está y no borres el texto».
 *
 * @returns {Resultado}
 */
export const conEstado = (texto, encabezado, estado, hoy) => {
  if (!['abierto', 'hecho', 'empezado', 'descartado'].includes(estado)) {
    return { error: `Estado inválido: ${estado}` };
  }
  const limpio = sinMarcador(encabezado).trimEnd();
  const nuevo =
    estado === 'abierto' ? limpio : `${limpio} — ${EMOJI[estado]} ${PALABRA[estado]} (${hoy})`;
  return reemplazarEncabezado(texto, encabezado, nuevo);
};

/**
 * Agrega una nota fechada justo debajo del encabezado, como cita.
 *
 * Es la forma que el archivo ya usa para lo que se supo después («> ✅ Hecho el
 * 2026-09-15…», «> Sube de P3 a P2…»): arriba del cuerpo, donde se lee antes de
 * leer el ítem, y sin tocar una coma de lo que estaba escrito.
 *
 * @returns {Resultado}
 */
export const conNota = (texto, encabezado, nota, hoy) => {
  const limpia = nota.trim();
  if (!limpia) return { error: 'La nota está vacía.' };
  const lineas = texto.split('\n');
  const i = lineas.indexOf(encabezado);
  if (i === -1) {
    return {
      error:
        'El encabezado cambió en el disco desde que se cargó el tablero. ' +
        'Recargá para no pisar lo que escribió otro.',
    };
  }
  const cita = limpia.split('\n').map((l) => (l.trim() ? `> ${l.trim()}` : '>'));
  const bloque = [`> **Nota del ${hoy}:** ${cita[0].replace(/^> ?/u, '')}`, ...cita.slice(1)];
  // Una línea en blanco antes de la cita; la que va después ya está en el
  // archivo (entre el encabezado y el cuerpo), así que no se agrega otra.
  lineas.splice(i + 1, 0, '', ...bloque);
  return { texto: lineas.join('\n') };
};

/**
 * Crea un ítem nuevo al principio de su sección.
 *
 * Al principio y no al final por lo mismo que la tanda del 2026-09-15 se escribió
 * ahí: lo último que entró es lo que todavía se está mirando, y el archivo tiene
 * diecisiete mil líneas. El cuerpo es lo que escribió quien lo carga; si no
 * escribió nada, queda el recordatorio de qué hace accionable un reporte, que es
 * lo que pide el skill `al-backlog`.
 *
 * @param {string} texto
 * @param {{
 *   id: string,
 *   titulo: string,
 *   prioridad: string,
 *   seccion: string,
 *   cuerpo: string,
 *   hoy: string,
 *   idsTomados?: Set<string>,
 * }} datos `idsTomados` es opcional: sin él se miran los ids de `texto`, que es
 *   lo correcto cuando el backlog es un archivo solo.
 * @returns {Resultado}
 */
export const conItemNuevo = (texto, { id, titulo, prioridad, seccion, cuerpo, hoy, idsTomados }) => {
  if (!titulo.trim()) return { error: 'El título es obligatorio.' };
  /*
   * Los ids tomados pueden venir de afuera, y el servidor se los pasa: desde que
   * lo cerrado vive en `BACKLOG-cerrados.md`, **la mitad de los ids usados no
   * está en este texto**. Mirar solo el archivo vivo devolvería «libre» un
   * número que un ítem cerrado ya tiene.
   */
  if ((idsTomados ?? idsUsados(texto)).has(id)) {
    return { error: `${id} ya está usado en el backlog. Recargá: otro frente lo tomó.` };
  }
  const lineas = texto.split('\n');
  const inicio = lineas.findIndex((l) => SECCION.exec(l)?.[1] === seccion);
  if (inicio === -1) return { error: `No existe la sección «${seccion}».` };

  // Antes del primer ítem de la sección; si la sección no tiene ninguno, antes
  // de la sección siguiente; y si es la última, al final del archivo.
  let destino = lineas.length;
  for (let i = inicio + 1; i < lineas.length; i += 1) {
    if (ENCABEZADO.test(lineas[i]) || SECCION.test(lineas[i])) {
      destino = i;
      break;
    }
  }

  const texto0 =
    cuerpo.trim() ||
    '_Falta el cuerpo: qué pasa, por qué vale la pena arreglarlo y dónde está el ' +
      'código. Sin eso el ítem no se puede priorizar dentro de seis meses._';

  const bloque = [
    `### ${id} · ${titulo.trim()} · ${prioridad} — cargado desde el tablero (${hoy})`,
    '',
    texto0,
    '',
  ];
  lineas.splice(destino, 0, ...bloque);
  return { texto: lineas.join('\n'), id };
};
