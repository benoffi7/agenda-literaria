/**
 * Lo compartido por las clases de bug de `tests/clases/` — PRD 6, M-12.
 *
 * Hasta el 2026-09-25 las dieciocho clases vivían en un solo archivo,
 * `tests/clases-de-bug.test.ts` (3.700 líneas): para sumar **una** clase había
 * que leerlas todas. Ahora cada clase es su archivo en `tests/clases/`, y lo que
 * usan dos o más —el descubrimiento de triggers, el trazador de efectos, las
 * listas derivadas del fuente— vive acá. El conteo de casos es el mismo: 132
 * antes y después.
 *
 * ── Por qué existen estos archivos ─────────────────────────────────────────
 * Un test que verifica una instancia protege esa instancia. `costuras.test.ts`
 * demuestra que `calendarEventId` se pisa; nada impide que el mes que viene se
 * pise otro campo, que un trigger nuevo no sea idempotente o que el efecto que
 * tiene que ocurrir siempre quede otra vez abajo de un `return` de guarda.
 *
 * Cada archivo de `tests/clases/` toma un bug, nombra su clase y verifica **la
 * clase**: la regla se evalúa sobre una lista derivada del código (los campos
 * que escribe una Function, los triggers que existen, las formas de versión que
 * produce el build), no sobre el caso conocido. Un campo nuevo, un trigger nuevo
 * o una forma nueva entran solos.
 *
 * ── Cómo leer los `it.fails` ───────────────────────────────────────────────
 * `it.fails` = la clase está viva hoy. El día que el frente que la arregla la
 * cierre, el `it.fails` pasa → **el CI se pone rojo**, que es la señal para
 * venir a borrarle el `.fails`. Cada uno dice en su comentario qué lo haría
 * pasar; si el arreglo elegido es más barato que eso, el `it.fails` sigue
 * fallando y eso también es información: la clase quedó abierta.
 *
 * **No se toca `tests/costuras.test.ts`**: ahí están las instancias, y las
 * promueven los frentes que arreglan cada bug.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { construirIssue } from '../../functions/reportes.js';


export const raiz = new URL('../..', import.meta.url);

export const fuente = (relativo: string) =>
  readFileSync(fileURLToPath(new URL(relativo, raiz)), 'utf8');


export const versionados = (prefijo: string): string[] =>
  execFileSync('git', ['ls-files', '-z', prefijo], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);


export const ARCHIVOS_FUNCTIONS = versionados('functions').filter((f) => f.endsWith('.js'));


// ─────────────────────────────────────────────────────────────────────
// Los triggers, descubiertos del fuente
// ─────────────────────────────────────────────────────────────────────

export type Trigger = {
  archivo: string;
  nombre: string;
  clase: string;
  cuerpo: string;
};


/**
 * Las clases de trigger que este archivo sabe descubrir.
 *
 * **`onObject*` entró antes de que existiera el primer trigger de Storage** —
 * B-167, segunda tajada, y es la **trampa 12** del §13. La cabecera de este
 * archivo promete que "un trigger nuevo entra solo", y para un trigger de Storage
 * eso era falso: el regex solo conocía los de Firestore y el schedule, así que la
 * Function de DEC-7d (la que escribe la miniatura en el mismo bucket que la
 * dispara, o sea la trampa 3 con otra cara) habría entrado sin que nada le
 * pidiera la guarda.
 *
 * Agregarlas hoy no cambia ningún resultado —no hay ninguna todavía, y el test
 * de abajo sigue encontrando los seis de siempre— y es exactamente por eso que
 * se agregan ahora: es el único momento en que el cambio es gratis.
 */
export const CLASES_DE_TRIGGER =
  'onDocumentWritten|onDocumentUpdated|onDocumentCreated|onDocumentDeleted|onSchedule' +
  '|onObjectFinalized|onObjectDeleted|onObjectArchived|onObjectMetadataUpdated';


/**
 * Los triggers definidos en `functions/**`, con su cuerpo.
 *
 * El corte es hasta el cierre de la declaración (`});` o `);` al principio de
 * una línea), y no hasta el `export` siguiente: entre dos triggers puede haber
 * helpers de módulo, y meterlos en el cuerpo del trigger anterior le atribuía
 * un `fetch` que no llama (falso positivo real, encontrado escribiendo esto).
 */
export const triggers = (): Trigger[] => {
  const encontrados: Trigger[] = [];
  for (const archivo of ARCHIVOS_FUNCTIONS) {
    const src = fuente(archivo);
    const re = new RegExp(`export const (\\w+) = (${CLASES_DE_TRIGGER})\\(`, 'g');
    for (const m of src.matchAll(re)) {
      const desde = m.index!;
      // Se cierra contando paréntesis desde el `(` del trigger, no buscando el
      // primer `\n});`. Ese atajo cortaba el cuerpo en la primera llamada
      // anidada que cerrara así, y después del refactor de B-77 **todos** los
      // cuerpos quedaron truncados: el chequeo veía triggers sin efecto y sin
      // guarda, y producía hallazgos que eran artefactos de la extracción.
      let nivel = 0;
      let hasta = src.length;
      for (let i = desde + m[0]!.length - 1; i < src.length; i++) {
        const c = src[i];
        if (c === '(') nivel++;
        else if (c === ')') {
          nivel--;
          if (nivel === 0) {
            hasta = i + 1;
            break;
          }
        }
      }
      encontrados.push({
        archivo,
        nombre: m[1]!,
        clase: m[2]!,
        cuerpo: src.slice(desde, hasta),
      });
    }
  }
  return encontrados;
};


export const TRIGGERS = triggers();


/** Índice de la primera coincidencia, o `Infinity` si no hay. */
export const primero = (cuerpo: string, re: RegExp): number => {
  const m = re.exec(cuerpo);
  return m ? m.index : Infinity;
};


// ─────────────────────────────────────────────────────────────────────
// Seguir la llamada — B-171
// ─────────────────────────────────────────────────────────────────────

/**
 * El detector anterior buscaba el efecto y la guarda **en el cuerpo del
 * trigger**. B-77 movió las dos cosas a helpers y el detector dejó de verlas:
 *
 *  - el efecto de `guardarVersion` es `versiones.doc(version).set(...)`, que
 *    ahora vive en `guardar` (`historial-trigger.js`), así que los dos triggers
 *    de historial pasaron a contarse como "sin efecto";
 *  - la guarda de `syncCalendar` es `idDeEvento(op.id)`, que vive en
 *    `crearEvento` (`index.js`), así que el trigger **ya blindado** seguía
 *    contándose como desguarnecido.
 *
 * Un chequeo que solo mira la hoja del árbol se apaga con el primer
 * `Extract Function`. Lo de abajo **sigue la llamada**: arma la traza del
 * trigger expandiendo cada llamada a una función declarada en `functions/**`
 * —del mismo archivo o importada— y clasifica lo que encuentra en el orden en
 * que ocurre.
 */

/**
 * El fuente sin comentarios, conservando los literales de string.
 *
 * Hace falta porque los comentarios de este repo **nombran** las llamadas que se
 * están buscando ("el `update` reescribe lo mismo", "`eventoId` de `event.id`"):
 * sin sacarlos, la prosa que explica una guarda contaría como la guarda. Los
 * strings se conservan porque distinguir `.doc('literal')` de `.doc(variable)`
 * es justamente lo que decide si una escritura puede duplicar.
 */
export const sinComentarios = (src: string): string => {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') {
          out += src[i]! + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i]!;
        i++;
      }
      out += src[i] ?? '';
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
};


export type Declaracion = { archivo: string; nombre: string; cuerpo: string };


/**
 * Las declaraciones de nivel superior de un archivo, con su cuerpo.
 *
 * El corte es "hasta la próxima declaración de nivel superior". Es aproximado a
 * propósito: lo único que se hace con el cuerpo es buscar llamadas, y unas
 * líneas de más al final no cambian ninguna respuesta.
 */
export const cacheDeclaraciones = new Map<string, Declaracion[]>();

export const declaracionesDe = (archivo: string): Declaracion[] => {
  const ya = cacheDeclaraciones.get(archivo);
  if (ya) return ya;
  const src = sinComentarios(fuente(archivo));
  const anclas = [
    ...src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:const|let|var|function)\s+(\w+)/gm),
  ];
  const decls = anclas.map((m, i) => ({
    archivo,
    nombre: m[1]!,
    cuerpo: src.slice(m.index!, anclas[i + 1]?.index ?? src.length),
  }));
  cacheDeclaraciones.set(archivo, decls);
  return decls;
};


/** Un path relativo resuelto contra el archivo que lo importa. */
export const resolverPath = (desde: string, spec: string): string => {
  const partes = desde.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '.') continue;
    else if (p === '..') partes.pop();
    else partes.push(p);
  }
  return partes.join('/');
};


/** Qué nombre importado viene de qué archivo de `functions/`. */
export const cacheImportes = new Map<string, Map<string, string>>();

export const importesDe = (archivo: string): Map<string, string> => {
  const ya = cacheImportes.get(archivo);
  if (ya) return ya;
  const mapa = new Map<string, string>();
  for (const m of sinComentarios(fuente(archivo)).matchAll(
    /import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g,
  )) {
    const destino = resolverPath(archivo, m[2]!);
    if (!ARCHIVOS_FUNCTIONS.includes(destino)) continue;
    for (const parte of m[1]!.split(',')) {
      const nombre = parte.trim().split(/\s+as\s+/).pop()?.trim();
      if (nombre) mapa.set(nombre, destino);
    }
  }
  cacheImportes.set(archivo, mapa);
  return mapa;
};


/** Cómo se resuelve un nombre llamado desde un archivo. Se inyecta para poder testear el detector. */
export type Resolver = (archivo: string, nombre: string) => Declaracion | null;


export const enFunctions: Resolver = (archivo, nombre) => {
  const local = declaracionesDe(archivo).find((d) => d.nombre === nombre);
  if (local) return local;
  const otro = importesDe(archivo).get(nombre);
  if (!otro) return null;
  return declaracionesDe(otro).find((d) => d.nombre === nombre) ?? null;
};


/**
 * Los tokens que interesan, en un solo barrido para que el **orden** entre ellos
 * quede registrado (la guarda por reclamo de estado depende de eso).
 *
 * `T` — `runTransaction(`: se reclama el estado antes de actuar.
 *
 * `E` — un efecto que puede crear **algo nuevo**:
 *  - `fetch(`: HTTP arbitrario, la identidad la elige el otro lado;
 *  - `.insert(` / `.add(` / `.create(`: verbos de creación;
 *  - `.doc(<expresión>).set(`: escritura en una dirección **calculada** — si la
 *    expresión no deriva del evento, dos entregas escriben dos documentos.
 *
 * Y lo que deliberadamente **no** es efecto duplicable, porque re-ejecutarlo no
 * puede producir un segundo nada:
 *  - `.update(` / `.patch(` / `.delete(`: direccionan una identidad que ya
 *    existe (por eso el re-sync de etiquetas de `rebuildPorOpciones` no cuenta);
 *  - `.doc('literal').set(`: siempre la misma dirección (por eso `marcarRebuild`
 *    no cuenta).
 */
export const RE_TOKEN = new RegExp(
  [
    '\\brunTransaction\\(',
    '\\bfetch\\(',
    '\\.(?:insert|add|create)\\(',
    // `(?!['"`])` = el argumento de `.doc()` no arranca con
    // comilla simple, doble ni backtick: es una expresión, no un path fijo.
    "\\.doc\\(\\s*(?!['\"`])[^)]*\\)\\s*\\.set\\(",
    '\\b(\\w+)\\(',
  ].join('|'),
  'g',
);


export type Traza = { marcas: string; cuerpos: string[] };


/**
 * La traza de una declaración: las marcas en orden de aparición, expandiendo las
 * llamadas que el resolver reconozca, y los cuerpos que se recorrieron.
 */
export const trazar = (
  decl: Declaracion,
  resolver: Resolver,
  visitados = new Set<string>(),
): Traza => {
  visitados.add(`${decl.archivo}::${decl.nombre}`);
  let marcas = '';
  const cuerpos = [decl.cuerpo];
  for (const m of decl.cuerpo.matchAll(RE_TOKEN)) {
    const llamada = m[1];
    if (llamada === undefined) {
      marcas += m[0]!.startsWith('runTransaction') ? 'T' : 'E';
      continue;
    }
    const destino = resolver(decl.archivo, llamada);
    if (!destino || visitados.has(`${destino.archivo}::${destino.nombre}`)) continue;
    const dentro = trazar(destino, resolver, visitados);
    marcas += dentro.marcas;
    cuerpos.push(...dentro.cuerpos);
  }
  return { marcas, cuerpos };
};


export const comoDeclaracion = (t: Trigger): Declaracion => ({
  archivo: t.archivo,
  nombre: t.nombre,
  cuerpo: sinComentarios(t.cuerpo),
});


export const cacheTrazas = new Map<string, Traza>();

export const trazaDe = (t: Trigger): Traza => {
  const clave = `${t.archivo}::${t.nombre}`;
  const ya = cacheTrazas.get(clave);
  if (ya) return ya;
  const traza = trazar(comoDeclaracion(t), enFunctions);
  cacheTrazas.set(clave, traza);
  return traza;
};


// ─────────────────────────────────────────────────────────────────────
// Clase de B-82 · un trigger que decide desde el payload y no desde el
// estado del documento no es idempotente
// ─────────────────────────────────────────────────────────────────────

/**
 * La entrega de eventos de Firestore es **al menos una vez** (§ Cloud Functions
 * v2). Entonces todo trigger cuyo efecto no sea idempotente por naturaleza
 * necesita una guarda, y hay dos formas aceptadas en este repo:
 *
 *  - **por id del evento** — `guardarVersion` deriva el id del documento de
 *    `event.id` (D-43), así que el reintento reescribe en vez de duplicar;
 *  - **por estado, reclamado antes del efecto** — `reporteAIssue` toma el
 *    reporte en una transacción y recién después habla con GitHub.
 *
 * y hoy hay una tercera, que es la que cerró B-82:
 *
 *  - **por identidad elegida por nosotros** — `syncCalendar` deriva el id del
 *    evento de Calendar del id de sesión (`idDeEvento`), así que el `insert`
 *    repetido choca con el que ya existe y devuelve 409.
 *
 * Las tres se reconocen sobre la **traza** del trigger, no sobre su cuerpo: las
 * tres viven hoy en un helper, y buscarlas en el cuerpo es lo que apagó este
 * chequeo (B-171).
 */
export const RE_CLAVE_DERIVADA = /\bevent\.id\b|\bidDe[A-Z]\w*\(/;


/** Guarda por clave: el id de lo que se escribe no lo elige el receptor. */
export const guardaPorClave = (t: Trigger): boolean =>
  trazaDe(t).cuerpos.some((c) => RE_CLAVE_DERIVADA.test(c));


/** Guarda por reclamo: hay una transacción **antes** del primer efecto. */
export const guardaPorReclamo = (marcas: string): boolean => {
  const reclamo = marcas.indexOf('T');
  const efecto = marcas.indexOf('E');
  return reclamo !== -1 && (efecto === -1 || reclamo < efecto);
};


export const tieneGuardaDeReentrega = (t: Trigger): boolean =>
  guardaPorClave(t) || guardaPorReclamo(trazaDe(t).marcas);


/**
 * El detector, probado contra cuerpos inventados — B-171.
 *
 * Es la parte que faltaba la primera vez. El detector de arriba es el que decide
 * si el chequeo de la clase mira algo o da un verde vacío, y hasta ahora nadie
 * lo verificaba: cuando B-77 lo dejó ciego, el síntoma fue un test que había que
 * apagar. Con cuerpos sintéticos se prueba **el detector**, y esos cuerpos no
 * envejecen con el refactor de mañana.
 */
export const trazaFingida = (cuerpo: string, helpers: Record<string, string> = {}): Traza =>
  trazar({ archivo: 'fingido.js', nombre: 'trigger', cuerpo: sinComentarios(cuerpo) }, (_, n) =>
    helpers[n] === undefined
      ? null
      : { archivo: 'fingido.js', nombre: n, cuerpo: sinComentarios(helpers[n]!) },
  );


export const marcasDe = (cuerpo: string, helpers: Record<string, string> = {}): string =>
  trazaFingida(cuerpo, helpers).marcas;


// ─────────────────────────────────────────────────────────────────────
// Clase de B-83 · un efecto que tiene que ocurrir siempre, ubicado
// después de un `return` de guarda
// ─────────────────────────────────────────────────────────────────────

/**
 * Hay efectos que corresponden por lo que **cambió**, no por lo que el efecto
 * de al lado consiguió hacer. Si su llamada está al final de un handler que
 * tiene cortes tempranos, el efecto pasa a depender de los cortes: el rebuild
 * del sitio termina colgando de que el calendario haya recibido operaciones.
 *
 * La regla: la llamada tiene que **dominar** todos los `return` del handler —
 * no puede haber ninguno antes.
 */
export const EFECTOS_INCONDICIONALES = [
  // El rebuild corresponde porque la actividad cambió (§8, trampa 8). Los
  // campos que salen al events.json y no al evento de Calendar (`destacado`,
  // `imagenUrl`, `searchText`, `slug`) no llegan nunca al sitio si el rebuild
  // cuelga del sync.
  'marcarRebuild',
  /*
   * B-285 — la marca de «estuvo publicada alguna vez» corresponde porque la
   * actividad **pasó a publicado**, no porque el calendario haya recibido
   * operaciones. `syncCalendar` corta antes si no hay ops o si falta
   * `GOOGLE_CALENDAR_ID`, así que detrás de cualquiera de los dos la marca no se
   * escribiría nunca — y sin ella una cancelada pierde su página pública (B-110,
   * D-159), que es un 404 en una URL que estuvo en Google.
   *
   * B-905 — y lo mismo en los cuatro rebuild de directorio: la marca corresponde
   * porque la ficha pasó a publicada, no porque el sitio tenga algo que rehacer.
   */
  'marcarPublicada',
];


// ─────────────────────────────────────────────────────────────────────
// Trampa 3 · un write-back al documento que dispara el trigger va
// detrás de su guarda — B-905
// ─────────────────────────────────────────────────────────────────────

/**
 * Un trigger que escribe en el documento que lo disparó se dispara a sí mismo
 * (trampa 3). Para el `calendarEventId` la guarda es el diff del §7.1; para las
 * marcas que se escriben **una sola vez** es un predicado que dice «todavía
 * falta», y el `update` tiene que estar **adentro** de su `if`.
 *
 * Hasta B-905 había un solo llamador (`syncCalendar`) y el caso con nombre de
 * `publicada-alguna-vez.test.ts` alcanzaba. Con B-905 son cinco —los cuatro
 * rebuild de directorio prenden la misma marca— y el bloque está copiado a
 * propósito en cada cuerpo (el chequeo de B-83 es textual), así que la copia que
 * pierda su `if` es exactamente el error que una lista de casos no ve venir.
 *
 * El registro es **efecto → guarda**. Un write-back nuevo de este tipo se suma
 * acá y queda cubierto en todos los triggers que lo llamen.
 */
export const WRITE_BACKS_CON_GUARDA: Record<string, string> = {
  marcarPublicada: 'faltaMarcarPublicada',
};


// ─────────────────────────────────────────────────────────────────────
// Clase de B-81 · un saneador aplicado campo por campo en vez de en un
// punto de paso obligado
// ─────────────────────────────────────────────────────────────────────

/**
 * B-81 fue que `construirIssue` pasaba la descripción y los pasos por
 * `redactar()` y no el título — el renglón más visible de un repo público. Se
 * arregló con una línea, y la clase quedó: mientras el saneador se aplique
 * campo por campo, el campo que se agregue mañana arranca sin sanear y nadie
 * se entera hasta que el issue ya está publicado.
 *
 * Dos verificaciones, y la segunda es la que vale: un **centinela en cada
 * string de la entrada**, y ningún centinela en la salida. Es el mismo truco de
 * `analytics-privacidad.test.ts`, que es lo que hace que un parámetro nuevo con
 * texto libre falle sin que nadie escriba su caso.
 */
export const CENTINELA = 'https://zoom.us/j/CENTINELA-9';
