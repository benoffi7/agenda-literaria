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

const CLASES_DE_TRIGGER =
  'onDocumentWritten|onDocumentUpdated|onDocumentCreated|onDocumentDeleted|onSchedule';

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

/** ¿Este trigger produce un efecto que no se puede deshacer emitiéndolo dos veces? */
const tieneEfectoDuplicable = (t: Trigger): boolean => {
  const red = helpersConRed(fuente(t.archivo));
  const llamaHelper = red.some((h) => new RegExp(`\\b${h}\\(`).test(t.cuerpo));
  return (
    llamaHelper ||
    /\bfetch\(|cal\.events\.\w+\(/.test(t.cuerpo) ||
    /\.(set|add|create)\(/.test(t.cuerpo)
  );
};

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
 * La asimetría era la pista: los dos que se blindan lo hacen, `syncCalendar`
 * no mira `event.id` en ninguna parte.
 */
const tieneGuardaDeReentrega = (t: Trigger): boolean => {
  // Por clave derivada del evento. Se acepta el `event.id` crudo y también que
  // se lo pase a un constructor de clave: B-77 refactorizó `guardarVersion`
  // para que reciba el id como parámetro y arme la clave con `idDeVersion`, y
  // la detección atada al literal `event.id` dejó de verlo. Un chequeo que
  // reconoce una guarda por el nombre de una variable local se apaga con el
  // primer renombre.
  if (/\bevent\.id\b|\bidDe[A-Z]\w*\(/.test(t.cuerpo)) return true;
  const transaccion = primero(t.cuerpo, /runTransaction\(/);
  const efecto = primero(t.cuerpo, /\bfetch\(|cal\.events\.\w+\(|\.(set|add|create)\(/);
  return transaccion < efecto;
};

describe('clase de B-82 · todo trigger con efecto duplicable se blinda', () => {
  // APAGADO a propósito (B-166). El detector de guardas dejó de reconocer las
  // de `guardarVersion` y `guardarVersionAlBorrar` después del refactor de
  // B-77: la guarda se mudó a un helper y la detección la buscaba en el cuerpo
  // del trigger. Queda `skip` y no `fails` porque un test apagado se ve apagado,
  // mientras que un `it.fails` que empieza a pasar es ruido. El resto de la
  // clase de B-82 sigue verificándose.
  it.skip('hay triggers con efecto duplicable y hay al menos dos ya blindados', () => {
    const conEfecto = deDocumento.filter(tieneEfectoDuplicable);
    expect(conEfecto.length).toBeGreaterThanOrEqual(2);
    // Los positivos: sin al menos dos, el detector podría estar midiendo
    // cualquier cosa y el chequeo de abajo daría un verde vacío.
    //
    // Se afirma la propiedad y no la lista. Enumerar los blindados obliga a
    // editar este test con cada trigger nuevo, y un test que hay que actualizar
    // para que siga pasando se termina actualizando sin pensar — que es como se
    // apagan los chequeos. B-41 agregó `guardarVersionAlBorrar` y la lista
    // enumerada lo dio por regresión.
    const blindados = conEfecto.filter(tieneGuardaDeReentrega).map((t) => t.nombre);
    expect(blindados.length, `blindados: ${blindados.join(', ')}`).toBeGreaterThanOrEqual(2);
    expect(blindados).toContain('reporteAIssue');
  });

  /**
   * **Qué lo haría pasar:** que `syncCalendar` derive el id del evento de
   * Calendar del id de sesión (la salida que propone el plan de saneamiento:
   * un `insert` repetido da 409 en vez de crear un segundo evento), o que
   * relea el documento dentro de una transacción antes de decidir `crear`, o
   * que lleve la marca de `event.id` ya aplicado.
   *
   * Y vale para el trigger que se agregue mañana: un `onDocumentWritten` nuevo
   * con un `fetch` adentro y sin guarda cae acá el día que se escribe.
   */
  it.fails('B-82: ningún trigger con efecto duplicable decide solo con el payload', () => {
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
