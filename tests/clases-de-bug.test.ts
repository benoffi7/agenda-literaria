/**
 * Las **clases** de los bugs de `tests/costuras.test.ts`, no las instancias.
 *
 * ── Por qué existe este archivo ────────────────────────────────────────────
 * Un test que verifica una instancia protege esa instancia. `costuras.test.ts`
 * demuestra que `calendarEventId` se pisa; nada impide que el mes que viene se
 * pise otro campo, que un trigger nuevo no sea idempotente o que el efecto que
 * tiene que ocurrir siempre quede otra vez abajo de un `return` de guarda.
 *
 * Cada bloque de acá toma un bug, nombra su clase y verifica **la clase**: la
 * regla se evalúa sobre una lista derivada del código (los campos que escribe
 * una Function, los triggers que existen, las formas de versión que produce el
 * build), no sobre el caso conocido. Un campo nuevo, un trigger nuevo o una
 * forma nueva entran solos.
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
import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { documentoAForm, formADocumento } from '@/lib/actividades';
import { construirEvento as construirEventoAnalitica } from '@/lib/analytics-eventos';
import { construirIssue } from '../functions/reportes.js';
import { versionesPosibles } from '../scripts/version.mjs';
import type { Actividad } from '@/types/actividad';

const raiz = new URL('..', import.meta.url);
const fuente = (relativo: string) =>
  readFileSync(fileURLToPath(new URL(relativo, raiz)), 'utf8');

const versionados = (prefijo: string): string[] =>
  execFileSync('git', ['ls-files', '-z', prefijo], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

const ARCHIVOS_FUNCTIONS = versionados('functions').filter((f) => f.endsWith('.js'));

/** Un array literal de constantes del fuente: `const X = ['a', 'b'];` → `['a','b']`. */
const listaLiteral = (src: string, nombre: string): string[] => {
  const m = new RegExp(`${nombre}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src);
  if (!m) return [];
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
};

// ─────────────────────────────────────────────────────────────────────
// Los triggers, descubiertos del fuente
// ─────────────────────────────────────────────────────────────────────

type Trigger = {
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
const CLASES_DE_TRIGGER =
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
const triggers = (): Trigger[] => {
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

const TRIGGERS = triggers();
const deDocumento = TRIGGERS.filter((t) => t.clase !== 'onSchedule');

/** Índice de la primera coincidencia, o `Infinity` si no hay. */
const primero = (cuerpo: string, re: RegExp): number => {
  const m = re.exec(cuerpo);
  return m ? m.index : Infinity;
};

/**
 * Helpers del módulo que llegan a la red. Se derivan del fuente para que un
 * helper nuevo con `fetch` adentro cuente sin que nadie lo agregue a una lista.
 */
const helpersConRed = (src: string): string[] =>
  [...src.matchAll(/const (\w+) = (?:async )?\(?[^=]*?\)? =>/g)]
    .map((m) => ({ nombre: m[1]!, desde: m.index! }))
    .filter(({ desde }, i, todos) => {
      const hasta = todos[i + 1]?.desde ?? src.length;
      return /\bfetch\(|cal\.events\.|google\.calendar\(/.test(src.slice(desde, hasta));
    })
    .map(({ nombre }) => nombre);

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
const sinComentarios = (src: string): string => {
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

type Declaracion = { archivo: string; nombre: string; cuerpo: string };

/**
 * Las declaraciones de nivel superior de un archivo, con su cuerpo.
 *
 * El corte es "hasta la próxima declaración de nivel superior". Es aproximado a
 * propósito: lo único que se hace con el cuerpo es buscar llamadas, y unas
 * líneas de más al final no cambian ninguna respuesta.
 */
const cacheDeclaraciones = new Map<string, Declaracion[]>();
const declaracionesDe = (archivo: string): Declaracion[] => {
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
const resolverPath = (desde: string, spec: string): string => {
  const partes = desde.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '.') continue;
    else if (p === '..') partes.pop();
    else partes.push(p);
  }
  return partes.join('/');
};

/** Qué nombre importado viene de qué archivo de `functions/`. */
const cacheImportes = new Map<string, Map<string, string>>();
const importesDe = (archivo: string): Map<string, string> => {
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
type Resolver = (archivo: string, nombre: string) => Declaracion | null;

const enFunctions: Resolver = (archivo, nombre) => {
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
const RE_TOKEN = new RegExp(
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

type Traza = { marcas: string; cuerpos: string[] };

/**
 * La traza de una declaración: las marcas en orden de aparición, expandiendo las
 * llamadas que el resolver reconozca, y los cuerpos que se recorrieron.
 */
const trazar = (
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

const comoDeclaracion = (t: Trigger): Declaracion => ({
  archivo: t.archivo,
  nombre: t.nombre,
  cuerpo: sinComentarios(t.cuerpo),
});

const cacheTrazas = new Map<string, Traza>();
const trazaDe = (t: Trigger): Traza => {
  const clave = `${t.archivo}::${t.nombre}`;
  const ya = cacheTrazas.get(clave);
  if (ya) return ya;
  const traza = trazar(comoDeclaracion(t), enFunctions);
  cacheTrazas.set(clave, traza);
  return traza;
};

/** Lo mismo, sin seguir ninguna llamada: sirve para saber si seguirla cambió algo. */
const trazaSuperficial = (t: Trigger): Traza => trazar(comoDeclaracion(t), () => null);

/** ¿Este trigger produce un efecto que no se puede deshacer emitiéndolo dos veces? */
const tieneEfectoDuplicable = (t: Trigger): boolean => trazaDe(t).marcas.includes('E');

describe('el descubrimiento de triggers sigue viendo lo que hay', () => {
  it('encuentra los seis triggers del proyecto', () => {
    // Si esto se rompe, todos los chequeos de abajo dejaron de mirar algo y
    // pasarían en verde sin verificar nada.
    expect(TRIGGERS.map((t) => t.nombre).sort()).toEqual([
      'dispararRebuild',
      'guardarVersion',
      // Agregado por B-41 (guardar versión al borrar una actividad). Este test
      // lo detectó solo, que es su razón de ser: si la lista se queda vieja,
      // los chequeos de abajo dejan de mirar el trigger nuevo y pasan en verde
      // sin verificar nada.
      'guardarVersionAlBorrar',
      'rebuildPorOpciones',
      'reporteAIssue',
      'syncCalendar',
    ]);
  });

  it('cada cuerpo tiene contenido y no se comió código ajeno', () => {
    for (const t of TRIGGERS) {
      expect(t.cuerpo.length, t.nombre).toBeGreaterThan(200);
      expect(t.cuerpo, t.nombre).toContain(t.nombre);
      // Un cuerpo con dos `export const` adentro se tragó al vecino, y le
      // atribuiría efectos que no produce.
      expect([...t.cuerpo.matchAll(/export const/g)].length, t.nombre).toBe(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Clase de B-80 · un campo que escribe el backend, pisado por el ida y
// vuelta del documento a través del formulario
// ─────────────────────────────────────────────────────────────────────

/**
 * La clase, en una línea: **hay un solo dueño por campo.** Si una Cloud
 * Function escribe un campo y el formulario también lo emite, el panel puede
 * pisarlo con lo que tenía en un snapshot viejo — y el daño ni se nota, porque
 * el guardado que lo pisa todavía funciona.
 *
 * La verificación va sobre la **lista** de campos que escribe la máquina, no
 * sobre `calendarEventId`. La lista no se mantiene a mano acá: se deriva del
 * write-back de `functions/index.js` y de la lista negra de `functions/
 * historial.js` (D-41), que es hoy el único lugar del repo donde está escrito
 * qué campo escribe la máquina.
 */
const SRC_HISTORIAL = fuente('functions/historial.js');
/**
 * El fuente de **todas** las Functions, concatenado, y no el de `index.js`.
 *
 * Apuntar a un archivo concreto ya se rompió una vez: B-77 partió `index.js` en
 * módulos y el write-back se mudó a `sincronizacion.js`, así que los chequeos de
 * abajo se quedaron recorriendo listas vacías. El guard de "la lista no está
 * vacía" lo agarró, que es para lo que está — pero la respuesta correcta no es
 * re-apuntar a otro archivo, es dejar de depender de dónde vive el código.
 */
const SRC_FUNCTIONS = ARCHIVOS_FUNCTIONS.map((f) => fuente(f)).join('\n');

const CAMPOS_DE_MAQUINA_SESION = listaLiteral(SRC_HISTORIAL, 'CAMPOS_DE_MAQUINA_SESION');

/**
 * Lo mismo dentro de cada imagen de la galería — B-206 #2.
 *
 * No hay un `CAMPOS_QUE_ESCRIBE_EL_SYNC` con el que cruzarla: hoy el único que
 * escribe estos campos es la subida del panel, y el segundo escritor (la Function
 * de DEC-7d) todavía no existe. Lo que sí se puede afirmar ya, y es lo que hace
 * el chequeo de abajo, es que **el registro creció con el cambio**: si mañana se
 * agrega una clave de máquina a `Imagen` y nadie la suma acá, cada write-back de
 * la Function va a dejar una versión de historial y un rebuild del sitio.
 */
const CAMPOS_DE_MAQUINA_IMAGEN = listaLiteral(SRC_HISTORIAL, 'CAMPOS_DE_MAQUINA_IMAGEN');

/**
 * Los campos que el sync escribe dentro de una sesión, leídos de la constante
 * que el propio módulo declara.
 *
 * Antes se derivaba con un regex sobre el fuente y se rompió dos veces: al
 * mudarse el write-back de archivo, y al renombrarse la variable esparcida. Las
 * dos veces el chequeo se quedó recorriendo una lista vacía — o sea, pasando en
 * verde sin verificar nada. Una lista declarada sobrevive a los dos casos.
 */
const CAMPOS_QUE_ESCRIBE_EL_SYNC = listaLiteral(
  fuente('functions/sincronizacion.js'),
  'CAMPOS_QUE_ESCRIBE_EL_SYNC',
);

/** Claves de primer nivel que la Function escribe en la actividad. */
const CAMPOS_DOCUMENTO_QUE_ESCRIBE_EL_SYNC = [
  ...new Set(
    [...fuente('functions/index.js').matchAll(/tx\.update\(ref,\s*\{([^}]*)\}\)/g)].flatMap((m) =>
      m[1]!
        .split(',')
        .map((c) => c.split(':')[0]!.trim())
        .filter(Boolean),
    ),
  ),
];

const actividadCon = (sesion: Record<string, unknown>): Actividad =>
  ({
    tipo: 'taller',
    titulo: 'Taller de crónica',
    slug: 'taller-de-cronica',
    descripcion: 'Ocho encuentros de crónica urbana',
    imagenUrl: null,
    organizador: { nombre: 'Casa Brandon', instagram: '', web: '' },
    tallerista: null,
    esCiclo: false,
    sesiones: [
      {
        id: 'ses_1',
        inicio: Timestamp.fromDate(new Date('2026-09-03T22:00:00Z')),
        fin: Timestamp.fromDate(new Date('2026-09-04T00:00:00Z')),
        tema: null,
        lectura: null,
        cancelada: false,
        ...sesion,
      },
    ],
    modalidad: 'presencial',
    sede: {
      nombre: 'Casa Brandon',
      direccion: 'Drago 236',
      barrio: '',
      ciudad: 'CABA',
      indicaciones: '',
      geo: null,
    },
    online: null,
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    arancel: { tipo: 'gratis', notas: '' },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    estado: 'publicado',
    tags: [],
    destacado: false,
    searchText: '',
  }) as unknown as Actividad;

describe('clase de B-80 · un solo dueño por campo del documento', () => {
  it('la lista de campos que escribe la máquina existe y no está vacía', () => {
    // Sin esto los chequeos de abajo recorrerían una lista vacía y pasarían
    // sin verificar nada. La lista vive en functions/historial.js (D-41).
    expect(CAMPOS_DE_MAQUINA_SESION.length).toBeGreaterThan(0);
    expect(CAMPOS_QUE_ESCRIBE_EL_SYNC.length).toBeGreaterThan(0);
    // B-206 #2 — el registro creció con la galería. Si esto se rompe, o se
    // renombró la constante o alguien la borró, y el chequeo de abajo estaría
    // recorriendo una lista vacía.
    expect(CAMPOS_DE_MAQUINA_IMAGEN.length).toBeGreaterThan(0);
  });

  /**
   * B-206 #2 — la clave de máquina de una imagen sobrevive el ida y vuelta por
   * el formulario, y **ninguna clave de más entra al documento**.
   *
   * Son las dos mitades de "conservar explícitamente" en vez de spreadear la
   * fila. La primera es lo que hace que la subida no se pierda al guardar; la
   * segunda es lo que va a hacer que, cuando la Function de DEC-7d sea el otro
   * escritor, el panel no le meta claves que ella no puso — y de paso cierra el
   * camino del §5.2 por el que un borrador viejo de `localStorage` mete una
   * clave inventada en el documento.
   */
  it('B-206: formADocumento enumera las claves de una imagen, no las spreadea', () => {
    const conImagen = (imagen: Record<string, unknown>): Actividad =>
      ({
        ...actividadCon({}),
        imagenes: [
          { id: 'img_1', url: 'https://x.ar/a.jpg', epigrafe: '', origen: 'propia', portada: true, ...imagen },
        ],
      }) as unknown as Actividad;

    // 1 · los campos de máquina dan la vuelta completa
    const conMaquina = Object.fromEntries(
      CAMPOS_DE_MAQUINA_IMAGEN.map((c) => [c, c === 'storagePath' ? 'imagenes/img_1.jpg' : 1200]),
    );
    const ida = formADocumento(documentoAForm(conImagen(conMaquina)), 'uid', false) as {
      imagenes: Record<string, unknown>[];
    };
    for (const campo of CAMPOS_DE_MAQUINA_IMAGEN) {
      expect(ida.imagenes[0]![campo], campo).toEqual(conMaquina[campo]);
    }

    // 2 · una clave que el modelo no tiene NO llega al documento
    const conBasura = formADocumento(
      documentoAForm(conImagen({ inventada: 'no-deberia-viajar' })),
      'uid',
      false,
    ) as { imagenes: Record<string, unknown>[] };
    expect(Object.keys(conBasura.imagenes[0]!)).not.toContain('inventada');
  });

  it('todo campo de sesión que escribe el sync está declarado como campo de máquina', () => {
    // Si el sync escribe un campo que `historial.js` no considera de máquina,
    // cada write-back genera una versión de basura en el historial (§12).
    const sinDeclarar = CAMPOS_QUE_ESCRIBE_EL_SYNC.filter(
      (c) => !CAMPOS_DE_MAQUINA_SESION.includes(c),
    );
    expect(sinDeclarar).toEqual([]);
  });

  it('el sync no escribe ningún campo de primer nivel de la actividad', () => {
    // Hoy escribe solo el contenedor `sesiones`. Un campo suelto acá —
    // `ultimoSync`, `calendarSyncedAt` — sería un dueño nuevo en disputa con el
    // formulario, y hay que decidirlo antes de escribirlo.
    expect(CAMPOS_DOCUMENTO_QUE_ESCRIBE_EL_SYNC).toEqual(['sesiones']);
  });

  /**
   * El chequeo de la clase. El formulario no puede ser dueño de un campo que
   * escribe una Function: si lo emite, lo emite con lo que tenía en el snapshot.
   *
   * **Qué lo haría pasar:** que `formADocumento` deje de emitir el campo (y que
   * el write-back de la Function sea el único que lo escribe), o que el camino
   * de escritura del panel relea el documento y fusione — la primera y la
   * segunda de las tres salidas de B-80.
   *
   * **Qué NO lo haría pasar, a propósito:** que `syncCalendar` reponga el id
   * también en las ops `actualizar` (la tercera salida). Eso tapa el síntoma
   * conocido y deja la ventana abierta entre las dos escrituras, así que la
   * clase sigue viva y este `it.fails` sigue fallando. Es información, no un
   * falso positivo.
   */
  it.fails('B-80: el formulario no emite ningún campo que escriba una Function', () => {
    const emitidos: string[] = [];
    for (const campo of CAMPOS_DE_MAQUINA_SESION) {
      const enFirestore = actividadCon({ [campo]: 'valor-escrito-por-la-function' });
      const viejo = actividadCon({ [campo]: null }); // snapshot previo al write-back
      const escrito = formADocumento(documentoAForm(viejo), 'uid-admin', false) as {
        sesiones: Record<string, unknown>[];
      };
      const enElDocumento = (enFirestore.sesiones as unknown as Record<string, unknown>[])[0]!;
      if (
        Object.prototype.hasOwnProperty.call(escrito.sesiones[0]!, campo) &&
        escrito.sesiones[0]![campo] !== enElDocumento[campo]
      ) {
        emitidos.push(`${campo}: el panel escribe ${JSON.stringify(escrito.sesiones[0]![campo])}`);
      }
    }
    expect(emitidos).toEqual([]);
  });
});

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
const RE_CLAVE_DERIVADA = /\bevent\.id\b|\bidDe[A-Z]\w*\(/;

/** Guarda por clave: el id de lo que se escribe no lo elige el receptor. */
const guardaPorClave = (t: Trigger): boolean =>
  trazaDe(t).cuerpos.some((c) => RE_CLAVE_DERIVADA.test(c));

/** Guarda por reclamo: hay una transacción **antes** del primer efecto. */
const guardaPorReclamo = (marcas: string): boolean => {
  const reclamo = marcas.indexOf('T');
  const efecto = marcas.indexOf('E');
  return reclamo !== -1 && (efecto === -1 || reclamo < efecto);
};

const tieneGuardaDeReentrega = (t: Trigger): boolean =>
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
const marcasDe = (cuerpo: string, helpers: Record<string, string> = {}): string =>
  trazar({ archivo: 'fingido.js', nombre: 'trigger', cuerpo: sinComentarios(cuerpo) }, (_, n) =>
    helpers[n] === undefined
      ? null
      : { archivo: 'fingido.js', nombre: n, cuerpo: sinComentarios(helpers[n]!) },
  ).marcas;

describe('el detector de efectos duplicables discrimina — B-171', () => {
  it('un efecto que solo vive en un helper se detecta igual', () => {
    // LA regresión de B-171, congelada: `guardarVersion` dejó de contar como
    // "con efecto" el día que su `.set()` se mudó a `guardar`.
    expect(marcasDe('await guardar({ id, eventoId: event.id });')).toBe('');
    expect(
      marcasDe('await guardar({ id, eventoId: event.id });', {
        guardar: 'await versiones.doc(version).set({ documento });',
      }),
    ).toBe('E');
  });

  it('sigue la llamada más de un salto', () => {
    expect(marcasDe('await a();', { a: 'await b();', b: 'await fetch(url);' })).toBe('E');
  });

  it('no se cuelga con un ciclo entre helpers', () => {
    expect(marcasDe('await a();', { a: 'await b();', b: 'await a();' })).toBe('');
  });

  it('direccionar una identidad que ya existe no es un efecto duplicable', () => {
    // Re-ejecutarlos no puede producir un segundo nada.
    expect(marcasDe('await cal.events.update({ eventId });')).toBe('');
    expect(marcasDe('await cal.events.delete({ eventId });')).toBe('');
    expect(marcasDe('await ref.update({ estado });')).toBe('');
    expect(marcasDe('batch.delete(versiones.doc(viejo));')).toBe('');
  });

  it('escribir siempre en la misma dirección tampoco lo es', () => {
    // `marcarRebuild`: si contara, cualquier trigger que marque el rebuild
    // pediría una guarda de reentrega que no necesita.
    expect(marcasDe("db.doc('sistema/rebuild').set({ pendiente: true }, { merge: true });")).toBe(
      '',
    );
  });

  it('escribir en una dirección calculada sí lo es', () => {
    expect(marcasDe('await versiones.doc(version).set({ documento });')).toBe('E');
  });

  it('los verbos de creación lo son, y un `Map` no', () => {
    expect(marcasDe('await cal.events.insert({ requestBody });')).toBe('E');
    expect(marcasDe('await col.add({ x: 1 });')).toBe('E');
    // `ids.set(op.id, eventId)` es un `Map` en memoria, no una escritura.
    expect(marcasDe('const ids = new Map(); ids.set(op.id, eventId);')).toBe('');
  });

  it('un comentario que nombra la llamada no cuenta como la llamada', () => {
    // El repo explica sus guardas en prosa: "el `update` reescribe lo mismo",
    // "`eventoId` de `event.id`". Sin sacar los comentarios, la explicación de
    // una guarda contaría como la guarda.
    expect(marcasDe('// acá iría un await fetch(url) y un .add({})\nreturn;')).toBe('');
    expect(marcasDe('/* await fetch(url); */ return;')).toBe('');
    // Y al revés: un `//` adentro de un string no arranca un comentario.
    expect(marcasDe("const API = 'https://api.github.com'; await fetch(API);")).toBe('E');
  });

  it('el orden entre el reclamo y el efecto se registra, y decide la guarda', () => {
    expect(guardaPorReclamo(marcasDe('await db.runTransaction(tx); await fetch(url);'))).toBe(true);
    expect(guardaPorReclamo(marcasDe('await fetch(url); await db.runTransaction(tx);'))).toBe(false);
    // Y también cuando el efecto está un salto más abajo.
    expect(
      guardaPorReclamo(
        marcasDe('await db.runTransaction(tx); await crear();', { crear: 'await fetch(url);' }),
      ),
    ).toBe(true);
  });
});

describe('clase de B-82 · todo trigger con efecto duplicable se blinda', () => {
  it('hay triggers con efecto duplicable y hay al menos dos ya blindados', () => {
    const conEfecto = deDocumento.filter(tieneEfectoDuplicable);
    // Los positivos: sin al menos dos, el detector podría estar midiendo
    // cualquier cosa y el chequeo de abajo daría un verde vacío.
    expect(conEfecto.length).toBeGreaterThanOrEqual(2);
    // Y el negativo, que es la otra mitad: un detector que dijera "todo efecto
    // es duplicable" también daría un verde vacío, con la lista llena.
    expect(deDocumento.length).toBeGreaterThan(conEfecto.length);

    // Se afirma la propiedad y no la lista. Enumerar los blindados obliga a
    // editar este test con cada trigger nuevo, y un test que hay que actualizar
    // para que siga pasando se termina actualizando sin pensar — que es como se
    // apagan los chequeos. B-41 agregó `guardarVersionAlBorrar` y la lista
    // enumerada lo dio por regresión.
    const blindados = conEfecto.filter(tieneGuardaDeReentrega).map((t) => t.nombre);
    expect(blindados.length, `blindados: ${blindados.join(', ')}`).toBeGreaterThanOrEqual(2);

    // Las dos formas de blindaje están vivas. Que exista un ejemplo de cada una
    // es lo que mantiene honestas a las dos ramas del detector: si una se
    // apagara, la otra sola seguiría dando verde.
    expect(conEfecto.filter(guardaPorClave).length).toBeGreaterThanOrEqual(1);
    expect(
      conEfecto.filter((t) => guardaPorReclamo(trazaDe(t).marcas)).length,
    ).toBeGreaterThanOrEqual(1);
  });

  /**
   * La razón por la que este archivo tuvo que rehacerse (B-171): hoy el efecto y
   * la guarda de los triggers blindados **no están en el cuerpo del trigger**.
   * Si algún día volvieran todos al cuerpo, seguir la llamada dejaría de aportar
   * y este test avisa — no para volver atrás, sino para que nadie crea que el
   * seguimiento está cubierto cuando ya no se ejercita.
   */
  it('seguir la llamada es lo que hace visible el efecto y la guarda', () => {
    const efectoSoloEnHelper = deDocumento.filter(
      (t) => !trazaSuperficial(t).marcas.includes('E') && trazaDe(t).marcas.includes('E'),
    );
    expect(efectoSoloEnHelper.map((t) => t.nombre).length).toBeGreaterThanOrEqual(1);

    const guardaSoloEnHelper = deDocumento.filter(
      (t) =>
        guardaPorClave(t) &&
        !RE_CLAVE_DERIVADA.test(sinComentarios(t.cuerpo)) &&
        tieneEfectoDuplicable(t),
    );
    expect(guardaSoloEnHelper.map((t) => t.nombre).length).toBeGreaterThanOrEqual(1);
  });

  /**
   * B-82 cerrado: `syncCalendar` elige el id del evento de Calendar derivándolo
   * del id de sesión (`idDeEvento`), así que un `insert` repetido choca con el
   * que ya existe y devuelve 409 en vez de crear un segundo evento.
   *
   * Era `it.fails` mientras la clase estaba viva. Pasó a `it` con el arreglo —
   * y no antes, porque el detector viejo no veía la guarda nueva: el `it.fails`
   * siguió "pasando" (fallando) un tiempo después de que el bug estaba
   * arreglado. Un detector ciego no solo pierde regresiones: también miente
   * sobre lo que sigue roto.
   *
   * Vale para el trigger que se agregue mañana: un `onDocumentWritten` nuevo con
   * un `fetch` adentro y sin guarda cae acá el día que se escribe, y ahora
   * también si el `fetch` lo hace un helper.
   */
  it('B-82: ningún trigger con efecto duplicable decide solo con el payload', () => {
    const sinGuarda = deDocumento
      .filter(tieneEfectoDuplicable)
      .filter((t) => !tieneGuardaDeReentrega(t))
      .map((t) => `${t.archivo} · ${t.nombre}`);
    expect(sinGuarda).toEqual([]);
  });

  /**
   * Clase prima (B-85): leer estado → llamar a la red → escribir el estado
   * leído. La escritura no compara contra lo que hay, así que se come el cambio
   * que llegó mientras la llamada estaba en vuelo. Pasa cuando el efecto de
   * red no es un evento entregado sino un tick del schedule.
   *
   * **Qué lo haría pasar:** que la escritura del resultado ocurra dentro de una
   * transacción que verifique que el estado sigue siendo el que se leyó.
   */
  it('B-85: ninguna función programada escribe el estado que leyó sin compararlo', () => {
    const pierden: string[] = [];
    for (const t of TRIGGERS.filter((x) => x.clase === 'onSchedule')) {
      const lectura = primero(t.cuerpo, /\.get\(\)/);
      const red = primero(t.cuerpo, new RegExp(`\\b(${helpersConRed(fuente(t.archivo)).join('|')}|fetch)\\(`));
      const escritura = primero(t.cuerpo, /\.(set|update)\(/);
      const transaccion = primero(t.cuerpo, /runTransaction\(/);
      if (lectura < red && red < escritura && transaccion === Infinity) {
        pierden.push(`${t.archivo} · ${t.nombre}`);
      }
    }
    expect(pierden).toEqual([]);
  });
});

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
const EFECTOS_INCONDICIONALES = [
  // El rebuild corresponde porque la actividad cambió (§8, trampa 8). Los
  // campos que salen al events.json y no al evento de Calendar (`destacado`,
  // `imagenUrl`, `searchText`, `slug`) no llegan nunca al sitio si el rebuild
  // cuelga del sync.
  'marcarRebuild',
];

const llamadasAEfecto = () =>
  TRIGGERS.flatMap((t) =>
    EFECTOS_INCONDICIONALES.filter((e) => new RegExp(`\\b${e}\\(`).test(t.cuerpo)).map((e) => ({
      trigger: t,
      efecto: e,
    })),
  );

describe('clase de B-83 · un efecto incondicional no puede quedar debajo de una guarda', () => {
  it('los efectos declarados incondicionales se llaman desde más de un trigger', () => {
    const llamadas = llamadasAEfecto();
    expect(llamadas.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * **Qué lo haría pasar:** mover `await marcarRebuild(...)` arriba de
   * `if (ops.length === 0) return;` y de `if (!CALENDAR_ID) return;` en
   * `syncCalendar`. Cuesta un build de más cuando el cambio es solo interno, y
   * el debounce del §8 ya los junta.
   *
   * Y vale para el efecto que se declare mañana: alcanza con sumarlo a
   * `EFECTOS_INCONDICIONALES` y el chequeo lo cubre en todos los triggers.
   */
  it('B-83: ningún return se ejecuta antes de un efecto incondicional', () => {
    const tapados: string[] = [];
    for (const { trigger, efecto } of llamadasAEfecto()) {
      const idx = primero(trigger.cuerpo, new RegExp(`\\b${efecto}\\(`));
      const antes = trigger.cuerpo.slice(0, idx);
      if (/\breturn\b/.test(antes)) {
        tapados.push(`${trigger.archivo} · ${trigger.nombre} → ${efecto}()`);
      }
    }
    expect(tapados).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Clase de B-88 · el productor de un formato y su consumidor derivan por
// separado
// ─────────────────────────────────────────────────────────────────────

/**
 * Cuando un lado produce un formato y otro lo valida, el acuerdo no está
 * escrito en ninguna parte: son dos derivaciones independientes de la misma
 * idea, y se separan sin que nada falle.
 *
 * La verificación no repite el formato: **saca las formas del productor** y las
 * hace pasar por el consumidor. Una forma nueva en `version.mjs` entra sola.
 */
const SUSTITUCIONES: Record<string, string> = {
  '${pkg.version}': '1.0.1',
  '${sha}': '5e2cb50',
  '${sello(ahora)}': '20260821-2124',
};

/**
 * Las versiones que el build puede llegar a estampar.
 *
 * Sale de `versionesPosibles()` —que el propio `scripts/version.mjs` exporta
 * como el dominio completo de sus salidas (D-98)— y no de un regex sobre sus
 * plantillas. La versión anterior de este helper extraía los literales con
 * backticks y se quedó en cero cuando 1C reescribió el módulo: un chequeo que
 * deja de encontrar lo que busca pasa en verde sin verificar nada.
 *
 * Que el productor declare su dominio es exactamente la forma correcta de atar
 * productor y consumidor, que es la clase de B-88.
 */
const formasDeVersionQueProduceElBuild = (): string[] => versionesPosibles();

const versionSegunLaAnalitica = (v: string) =>
  construirEventoAnalitica('panel_abierto', { version: v })!.params.version;

describe('clase de B-88 · el consumidor acepta todo lo que el productor produce', () => {
  it('las formas se extraen del build y no quedó ningún hueco sin sustituir', () => {
    const formas = formasDeVersionQueProduceElBuild();
    // Tres hoy: limpio, árbol sucio y clone sin `.git`.
    expect(formas.length).toBeGreaterThanOrEqual(3);
    // Si `version.mjs` estrena un `${...}` que acá no está mapeado, esto falla
    // antes de que el chequeo de abajo dé un falso verde sobre un literal.
    for (const forma of formas) expect(forma, forma).not.toContain('${');
  });

  /**
   * **Qué lo haría pasar:** ampliar `FORMATO_VERSION` en
   * `src/lib/analytics-eventos.ts` a las formas que el build produce de verdad
   * (el guion y el largo del sello), sin abrirlo a texto libre.
   */
  it('B-88: la analítica reconoce las tres formas de versión del build', () => {
    const rechazadas = formasDeVersionQueProduceElBuild().filter(
      (v) => versionSegunLaAnalitica(v) !== v,
    );
    expect(rechazadas).toEqual([]);
  });

  /**
   * El otro lado de la clase, ya resuelto y con guarda: el panel no
   * reimplementa la descripción del evento, importa la del sync por el alias
   * `@calendario` (D-20). Si alguien vuelve a copiarla, las dos versiones se
   * separan y el panel promete algo distinto de lo que se publica.
   */
  it('la vista previa del panel consume el módulo del sync, no una copia', () => {
    const src = fuente('src/lib/vistaPreviaEvento.ts');
    expect(src).toMatch(/from '@calendario'/);
    expect(src).not.toMatch(/timeZone:\s*'America/);
  });

  /**
   * Los tres pares de prefijo de id del modelo: quien **produce** el id de una
   * fila y quien lo **valida** en el schema derivan cada uno por su cuenta.
   *
   * Es la clase, con tres instancias: `ses_`, `img_` y `mod_`. El día que un
   * productor cambie de prefijo, el schema rechaza toda fila nueva y el guardado
   * falla por un campo que nadie tocó; el día que se agregue una cuarta lista sin
   * su regla, el id deja de verificarse y vuelve la trampa 2 por la puerta de
   * atrás. Se lee del fuente porque el prefijo está en un template literal del
   * productor y en un regex del validador: no hay valor que comparar.
   *
   * Se pide para los tres a la vez y no solo para el nuevo: una lista que nombra
   * uno solo no protege a los otros dos, y agregarlos cuesta una línea.
   */
  it('cada lista con ids de cliente tiene su prefijo validado en el schema', () => {
    const schema = fuente('src/lib/schema.ts');
    const productores: [string, string][] = [
      ['ses_', 'src/lib/sesiones.ts'],
      ['img_', 'src/lib/imagenes.ts'],
      ['mod_', 'src/lib/modalidades.ts'],
    ];
    for (const [prefijo, archivo] of productores) {
      expect(fuente(archivo), `${archivo} ya no produce ids \`${prefijo}\``).toContain(
        `\`${prefijo}`,
      );
      expect(schema, `el schema no valida el prefijo \`${prefijo}\``).toContain(
        `/^${prefijo}/`,
      );
    }
  });
});

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
const CENTINELA = 'https://zoom.us/j/CENTINELA-9';

/**
 * Todo string de la entrada reemplazado por el centinela.
 *
 * `creadoEn` se excluye porque no es texto: es una fecha, y un string en su
 * lugar hace explotar el formateador antes de llegar a la aserción.
 */
const conCentinelas = (valor: unknown, clave = ''): unknown => {
  if (clave === 'creadoEn') return valor;
  if (typeof valor === 'string') return CENTINELA;
  if (Array.isArray(valor)) return valor.map((v) => conCentinelas(v));
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, conCentinelas(v, k)]),
    );
  }
  return valor;
};

const REPORTE = {
  tipo: 'bug',
  titulo: 'No me deja guardar el borrador',
  descripcion: 'Cargo el taller y no me deja guardar.',
  pasos: 'Entrar, cargar, guardar.',
  severidad: 'molesta',
  creadoEn: new Date('2026-08-21T22:00:00Z'),
  contexto: {
    pantalla: 'nueva-actividad',
    url: '/admin',
    versionPanel: '1.0.1+5e2cb50',
    navegador: 'Safari',
    ventana: '390x844',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
  },
  actividad: { id: 'act1' },
};

const ACTIVIDAD = { titulo: 'Taller de crónica', slug: 'taller-de-cronica' };

describe('clase de B-81 · el saneador va en un punto de paso obligado', () => {
  it('el issue sigue saliendo sin centinelas cuando el texto libre los trae', () => {
    // La instancia de B-81, generalizada a los tres campos de texto libre: es
    // lo que ya funciona, y sirve de control del chequeo de abajo.
    const issue = construirIssue({
      id: 'rep1',
      reporte: { ...REPORTE, titulo: CENTINELA, descripcion: CENTINELA, pasos: CENTINELA },
      actividad: ACTIVIDAD,
    });
    expect(JSON.stringify(issue)).not.toContain('zoom.us');
  });

  /**
   * **Qué lo haría pasar:** que `construirIssue` sanee su salida en un punto
   * único (el `title` y el `body` ya armados) en vez de campo por campo. Los
   * cuatro que hoy se cuelan —`id` del reporte, `actividad.slug`,
   * `reporte.actividad.id` y `severidad`— son valores de máquina o enums del
   * schema, así que **hoy** no pueden traer un link; el punto es que la próxima
   * interpolación no tiene por qué serlo. Ver B-137.
   */
  it.fails('B-81: ningún string de la entrada llega crudo al issue público', () => {
    const issue = construirIssue({
      id: CENTINELA,
      reporte: conCentinelas(REPORTE) as Record<string, unknown>,
      actividad: conCentinelas(ACTIVIDAD) as { titulo: string; slug: string },
    });
    expect(JSON.stringify(issue)).not.toContain('zoom.us');
  });

  it.fails('B-137: el saneador se aplica sobre la salida, no en cada campo', () => {
    const src = fuente('functions/reportes.js');
    const desde = src.indexOf('export const construirIssue');
    const cuerpo = src.slice(desde);
    const aplicaciones = [...cuerpo.matchAll(/\bredactar\(/g)].length;
    // Dos como máximo: el `title` y el `body`, una vez cada uno.
    expect(aplicaciones).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Clase de B-71 · un efecto irreversible ejecutado antes del que puede
// fallar
// ─────────────────────────────────────────────────────────────────────

/**
 * Cuando un caso de uso escribe en dos lugares y uno de los dos no se puede
 * deshacer, el orden decide el modo de falla. Hoy `guardar()` crea las
 * etiquetas nuevas de taxonomía —para las que **no hay UI de limpieza**
 * (B-06)— antes de escribir la actividad, que es la escritura que puede
 * fallar. El resultado de un fallo es basura permanente en el desplegable.
 *
 * Invertido, el peor caso es "la etiqueta no quedó registrada para la próxima
 * vez", que se recupera tipeándola otra vez.
 *
 * El chequeo busca los dos efectos por nombre en todo `src/`, no en un archivo:
 * cuando B-70 saque `guardar()` del componente, sigue mirando.
 */
const EFECTO_IRREVERSIBLE = /await upsertOpcion(?:es)?\(/;
const EFECTO_QUE_PUEDE_FALLAR = /await (?:crear|actualizar)Actividad\(/;

const flujosQueEscribenEnDosLugares = () =>
  versionados('src')
    .filter((f) => /\.tsx?$/.test(f))
    .map((archivo) => ({ archivo, src: fuente(archivo) }))
    .filter(
      ({ src }) => EFECTO_IRREVERSIBLE.test(src) && EFECTO_QUE_PUEDE_FALLAR.test(src),
    );

describe('clase de B-71 · el efecto irreversible va último', () => {
  it('hay al menos un flujo que escribe la actividad y la taxonomía', () => {
    // Si los nombres cambian y esto queda en cero, el chequeo de abajo pasaría
    // sin mirar nada.
    expect(flujosQueEscribenEnDosLugares().map((f) => f.archivo).length).toBeGreaterThan(0);
  });

  /**
   * **Arreglado (B-71):** el caso de uso salió del componente a
   * `src/lib/formulario/guardar.ts` (B-70) y ahí la actividad se escribe
   * primero. El `it.fails` quedó promovido a `it`: de acá en adelante, un flujo
   * nuevo que cree la etiqueta antes de la actividad rompe el CI.
   */
  it('B-71: la actividad se escribe antes que las etiquetas de taxonomía', () => {
    const alReves: string[] = [];
    for (const { archivo, src } of flujosQueEscribenEnDosLugares()) {
      const irreversible = primero(src, EFECTO_IRREVERSIBLE);
      const puedeFallar = primero(src, EFECTO_QUE_PUEDE_FALLAR);
      if (irreversible < puedeFallar) alReves.push(`${archivo}: la taxonomía se escribe primero`);
    }
    expect(alReves).toEqual([]);
  });
});

/**
 * Clase de B-209 · un comando de consulta no puede convertirse en escritura
 * porque alguien movió una línea.
 *
 * `scripts/preparar-produccion.mjs --listar` contesta "quién tiene el claim
 * admin hoy". Reemplazó a una tabla versionada con los mails y los uids reales
 * en un repo público, así que **tiene que poder correrse sin miedo**: la doc de
 * `08-operacion.md` promete que "es solo consulta: no siembra ni escribe nada".
 *
 * Hoy eso es cierto, pero **no es una propiedad del código: es del orden de las
 * líneas.** La rama sale con `process.exit(0)` antes del `getFirestore()`, del
 * `ref.set` y del `setCustomUserClaims`. Mover el `if` treinta líneas abajo, o
 * subir el `getFirestore()` con un `set` en el medio, convierte una consulta en
 * una escritura a producción — y este script **aborta** si detecta un emulador,
 * así que la escritura sería siempre contra lo real. Lo señaló el
 * `auditor-privacidad` sobre el propio cambio que agregó el flag.
 *
 * Es la misma forma que la clase de B-71 (el efecto irreversible va último):
 * una garantía que depende de qué viene antes de qué se verifica leyendo el
 * orden, no confiando en que nadie lo toque.
 */
describe('clase de B-209 · la consulta sale antes de cualquier escritura', () => {
  const SCRIPT = 'scripts/preparar-produccion.mjs';

  /** Primera aparición, o `Infinity` si no está. */
  const donde = (src: string, aguja: string): number => {
    const i = src.indexOf(aguja);
    return i === -1 ? Infinity : i;
  };

  it('el script y sus marcas siguen ahí', () => {
    // Control positivo: con un `indexOf` que no encuentra nada, las
    // comparaciones de abajo pasarían comparando Infinity contra Infinity.
    const src = fuente(SCRIPT);
    expect(donde(src, 'quiereListar')).toBeLessThan(Infinity);
    expect(donde(src, 'process.exit(0)')).toBeLessThan(Infinity);
    expect(donde(src, 'getFirestore()')).toBeLessThan(Infinity);
    expect(donde(src, 'setCustomUserClaims')).toBeLessThan(Infinity);
  });

  it('la rama de --listar termina antes de tocar Firestore o Auth', () => {
    const src = fuente(SCRIPT);
    const salida = donde(src, 'process.exit(0)');

    for (const escritura of ['getFirestore()', 'ref.set(', 'setCustomUserClaims']) {
      expect(
        salida,
        `--listar tiene que salir antes de \`${escritura}\`: si no, consultar escribe`,
      ).toBeLessThan(donde(src, escritura));
    }
  });

  it('un argumento no reconocido aborta antes de escribir', () => {
    // El bug concreto que había: `--listar` se buscaba solo en argv[2], así que
    // `<email> --listar` ignoraba el flag y sembraba en producción.
    const src = fuente(SCRIPT);
    expect(src).toContain("argumentos.includes('--listar')");
    expect(donde(src, 'Argumento no reconocido')).toBeLessThan(donde(src, 'getFirestore()'));
  });
});

/**
 * Clase de B-211 · el doble de un tipo del dominio se define **una vez**.
 *
 * El doble de `Timestamp` estaba escrito trece veces —a mano en once tests y
 * exportado desde los dos fixtures— en cuatro formas distintas, y **dos
 * mentían**: devolvían `seconds: 0`, o sea "todo Timestamp es la época". No
 * rompía nada porque ningún código de producción lee `.seconds`, pero el
 * `Timestamp` real de Firestore sí lo expone. Es la trampa 1 del §13 dentro del
 * fixture que existe para atajarla.
 *
 * ── Por qué hace falta esta guarda y no alcanzaba con unificar ────────────
 * Es **la misma clase que este repo ya automatizó**: «un fixture que no ejercita
 * el caso central del dominio», que hizo nacer `fixtures/ciclo.ts` y
 * `invariantes-de-ciclo.test.ts` después de aparecer cuatro veces. Reapareció con
 * otra cara — no es que el fixture no ejercitara el caso, es que había trece
 * fixtures y no se parecían entre sí.
 *
 * O sea: **la automatización se escribió y no se adoptó.** Ese es un modo de
 * falla distinto del que se atajó, y no tenía red. Unificar sin dejar guarda
 * habría dejado el mismo hueco abierto: el catorceavo `ts()` se escribe en cinco
 * segundos, porque es más rápido que buscar dónde vive el bueno.
 */
describe('clase de B-211 · el doble de Timestamp vive en un solo lugar', () => {
  const FIXTURE = 'tests/fixtures/tiempo.ts';

  const testsVersionados = (): string[] =>
    execFileSync('git', ['ls-files', '-z', 'tests'], { encoding: 'utf8' })
      .split('\0')
      .filter((f) => f.endsWith('.ts') && f !== FIXTURE);

  /**
   * La **forma** de un doble de Timestamp, no su nombre: lo que lo delata es
   * devolver `toDate` y `toMillis` juntos. Buscar `const ts =` dejaría pasar al
   * que se llame `stamp`, `fecha` o `t`, que es exactamente lo que escribe quien
   * no encontró el fixture.
   */
  const FORMA_DE_DOBLE = /toDate:\s*\(\)\s*=>[\s\S]{0,80}?toMillis:\s*\(\)\s*=>/;

  /** Sin comentarios: la prosa de este repo cita código, y engancharía. */
  const codigo = (relativo: string): string => sinComentarios(fuente(relativo));

  it('el fixture existe y hay tests que lo usarían', () => {
    // Control positivo: sin esto, «ningún test define su propio doble» pasaría
    // recorriendo una lista vacía.
    expect(testsVersionados().length).toBeGreaterThan(40);
    expect(codigo(FIXTURE)).toContain('export const ts');
    // Y la forma encuentra lo que dice encontrar.
    expect(FORMA_DE_DOBLE.test(codigo(FIXTURE))).toBe(true);
  });

  it('ningún test define su propio doble de Timestamp', () => {
    const conCopia: string[] = [];
    for (const archivo of testsVersionados()) {
      if (FORMA_DE_DOBLE.test(codigo(archivo))) conCopia.push(archivo);
    }
    expect(
      conCopia,
      'importá { ts } de tests/fixtures/tiempo en vez de escribirlo de nuevo',
    ).toEqual([]);
  });

  it('el doble no miente en los campos que nadie lee todavía', () => {
    /*
     * `seconds` y `nanoseconds` salen de la fecha, no de un cero. Es la parte
     * que hacía falsas a dos de las cuatro copias: un doble que miente en un
     * campo que nadie lee **todavía** es una bomba con fecha, no una
     * simplificación — y el día que alguien lea `.seconds`, el test que falle no
     * va a ser el que tenga el bug.
     *
     * Se mira el código **sin comentarios**: la primera versión de este `it`
     * falló porque el docblock del fixture cita `seconds: 0` para explicar la
     * variante mala. Es el modo de falla que este repo ya se hizo tres veces —
     * un chequeo que engancha la prosa que habla del bug en vez del bug.
     */
    const src = codigo(FIXTURE);
    expect(src).toMatch(/seconds:\s*Math\.floor/);
    expect(src).not.toMatch(/seconds:\s*0\b/);
    expect(src).not.toMatch(/nanoseconds:\s*0\b/);
  });

  it('el doble satisface el tipo declarado del modelo, no uno propio', () => {
    // `TimestampLike` declara los cuatro campos. Las copias de dos campos
    // convivían porque los builders que las usaban estaban tipados laxo: que el
    // fixture devuelva el tipo hace que el compilador sostenga el acuerdo.
    expect(codigo(FIXTURE)).toContain('): TimestampLike =>');
    expect(codigo(FIXTURE)).toContain(
      "import type { TimestampLike } from '@/types/actividad'",
    );
  });
});

/**
 * Clase de B-212 · la misma decisión de privacidad, escrita en tres lugares.
 *
 * El documento de `/opciones/{campo}` llega a **tres** salidas por tres caminos
 * distintos, y cada uno decide por su cuenta qué de un `ValorOpcion` es público:
 *
 * | Camino | Salida | Forma |
 * |---|---|---|
 * | `opcionesPublicas` (`src/lib/toPublic.ts`) | 1 — `events.json` | objetos `{ slug, label }` |
 * | `labelsDeOpciones` (`src/lib/vistaPreviaEvento.ts`) | 5 y la vista previa | `Record<slug, label>` |
 * | `cargarLabels` (`functions/index.js`) | 2 — el evento de Calendar | `Record<slug, label>` |
 *
 * ── Por qué no se unifican ────────────────────────────────────────────────
 * Los dos primeros podrían compartir algo; el tercero **no puede**, y eso es lo
 * que hace que este test sea la respuesta correcta en vez de un refactor:
 * `functions/` se despliega con su propio `package.json` y no importa hacia
 * arriba (D-20). Es el mismo caso que la copia de `CAMPOS_TAXONOMIA`, donde
 * `docs/10-salud-del-codigo.md` ya dejó escrita la política: «si molesta, la
 * respuesta es un test que compare las dos listas, no un import imposible».
 *
 * ── Qué se afirma ─────────────────────────────────────────────────────────
 * Que cada camino lea de un `ValorOpcion` **exactamente `slug` y `label`**. Si
 * alguno agrega `.usos` para ordenar los chips, o `.huellaCreador` para «mostrar
 * quién la creó», este test lo nombra. Lo pidió el `auditor-privacidad` al notar
 * que la tabla de `07-seguridad.md` atribuía todo a `opcionesPublicas`, que no
 * interviene en dos de los tres caminos.
 */
describe('clase de B-212 · los tres caminos de una opción leen lo mismo', () => {
  const CAMINOS = [
    { archivo: 'src/lib/toPublic.ts', funcion: 'opcionPublica' },
    { archivo: 'src/lib/vistaPreviaEvento.ts', funcion: 'labelsDeOpciones' },
    { archivo: 'functions/index.js', funcion: 'cargarLabels' },
  ];

  const PERMITIDAS = ['slug', 'label'];

  /**
   * Los campos de `ValorOpcion` que **no** son públicos, derivados del modelo y
   * no escritos a mano: si mañana se agrega uno, entra solo a este chequeo.
   *
   * ── Por qué se busca el nombre del campo y no la variable ─────────────────
   * La primera versión de este test rastreaba accesos a través de una variable
   * llamada `v` (`v.usos`, `v.huellaCreador`). **No detectaba nada realista:** se
   * probó metiendo un `.sort((a, b) => b.usos - a.usos)` en `labelsDeOpciones` y
   * el test siguió en verde, porque la variable se llamaba `b`. Un chequeo que
   * depende del nombre que eligió quien escribió el código no verifica el código,
   * verifica la convención de nombres.
   */
  const PROHIBIDAS = (() => {
    const src = sinComentarios(fuente('src/types/actividad.ts'));
    const desde = src.indexOf('export interface ValorOpcion');
    const cuerpo = src.slice(desde, src.indexOf('}', desde));
    return [...cuerpo.matchAll(/^\s{2}(\w+)\??:/gm)]
      .map((m) => m[1]!)
      .filter((c) => !PERMITIDAS.includes(c));
  })();

  /**
   * El cuerpo de una función, desde su nombre hasta el próximo `export`/`const`
   * de nivel superior. Alcanza para estas tres, que son cortas; lo que importa es
   * que no cruce hacia la función siguiente.
   */
  const cuerpo = (archivo: string, funcion: string): string => {
    const src = sinComentarios(fuente(archivo));
    const desde = src.indexOf(funcion);
    expect(desde, `no encontré \`${funcion}\` en ${archivo}`).toBeGreaterThan(-1);
    const resto = src.slice(desde);
    const corte = resto.slice(1).search(/\n(?:export )?const \w/);
    return corte === -1 ? resto : resto.slice(0, corte + 1);
  };

  it('los tres caminos existen, y la lista de campos prohibidos salió del modelo', () => {
    /*
     * Control positivo en las dos mitades. Sin la primera, el `it` de abajo
     * recorrería cuerpos vacíos; sin la segunda, compararía contra una lista
     * vacía de campos prohibidos y no podría fallar nunca.
     */
    for (const { archivo, funcion } of CAMINOS) {
      const src = cuerpo(archivo, funcion);
      expect(src.length, `${funcion} salió vacío`).toBeGreaterThan(20);
      // Y que cada camino lea de verdad las dos permitidas: si no, no es el
      // camino que creemos y el chequeo de abajo mira otra cosa.
      for (const permitida of PERMITIDAS) {
        expect(src, `${funcion} no lee \`${permitida}\``).toContain(`.${permitida}`);
      }
    }

    expect(PROHIBIDAS.length, 'no se pudieron derivar los campos de ValorOpcion').toBeGreaterThan(
      3,
    );
    expect(PROHIBIDAS).toContain('huellaCreador');
    expect(PROHIBIDAS).toContain('usos');
  });

  it('ninguno menciona un campo de la opción que no sea público', () => {
    const deMas: string[] = [];

    for (const { archivo, funcion } of CAMINOS) {
      const src = cuerpo(archivo, funcion);
      for (const prop of PROHIBIDAS) {
        // `.usos` y no `usos`: se busca el **acceso**, sin importar de qué
        // variable. Así `b.usos` dentro de un `sort` cuenta igual que `v.usos`.
        if (src.includes(`.${prop}`)) deMas.push(`${archivo} · ${funcion} lee \`${prop}\``);
      }
    }

    expect(
      [...new Set(deMas)],
      'un camino de /opciones/* lee un campo que no es público (§4.4, §5.1)',
    ).toEqual([]);
  });
});
