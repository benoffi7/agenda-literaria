/**
 * **Los derivados de `modalidades`, y su verificación del lado del servidor** —
 * B-224, B-2050.
 *
 * Una actividad se cursa en una **lista** de filas (D-130), pero hay salidas que
 * solo pueden decir una cosa: el filtro del panel, el `location` del evento —que
 * dibuja el mapa—, el `searchText` del §6 y la analítica. Por eso el documento
 * guarda, además de la lista, cuatro derivados que escribe `formADocumento` en
 * cada guardado: `modalidad` (la unión), `sede` (la de la primera fila que tenga
 * una), `online` (el primer bloque online) y `searchText`. El quinto, `ciudades`,
 * vive en `ciudades.js` porque existe para una regla (B-919).
 *
 * ── Por qué vive en `functions/` ──────────────────────────────────────────
 * Desde B-2050 `syncCalendar` recalcula los cuatro de lo que guardan las filas y,
 * si el documento dice otra cosa, lo corrige y avisa (`derivadosDesalineados`,
 * abajo; el efecto en `derivados-firestore.js`). Es la misma forma que B-1920 le
 * dio a `ciudades` (D-1230, D-1231). Tienen que ser **las mismas** funciones que
 * usa el panel al guardar: con dos copias, el servidor «corregiría» un documento
 * bien guardado y cada guardado mandaría un mail. `functions/` no puede importar
 * `src/` (D-20), así que viven acá y `src/lib/modalidades.ts` las reexporta con
 * sus tipos. Un test lo ata por identidad (`tests/derivados-del-servidor.test.ts`).
 *
 * Es JS plano y corre sobre documentos **escritos a mano**, así que cada lectura
 * de una fila va con `?.`: una fila `null` no puede hacer tirar al sync del
 * calendario.
 */
import { buildSearchText } from './busqueda.js';
import { ciudadesDe, ciudadesDesalineadas, slugDeCiudad } from './ciudades.js';
import { huboCambioDeContenido } from './historial.js';

/**
 * §11 — la sede aparece en presencial e híbrido. Por fila, no por actividad.
 *
 * @param {unknown} m
 * @returns {boolean}
 */
export const filaPideSede = (m) => m === 'presencial' || m === 'hibrido';

/**
 * §11 — el bloque online aparece en virtual e híbrido.
 *
 * @param {unknown} m
 * @returns {boolean}
 */
export const filaPideOnline = (m) => m === 'virtual' || m === 'hibrido';

/**
 * La modalidad de la actividad entera, **derivada** de sus filas (B-224,
 * decisión 3): la unión de lo que las filas dicen.
 *
 * - todas presenciales → `presencial`
 * - todas virtuales → `virtual`
 * - una presencial y una virtual, o cualquier fila `hibrido` → `hibrido`
 *
 * Es la unión y no «la primera fila manda» a propósito: lo segundo depende del
 * orden del array, que es la trampa 2 en otra forma —reordenar las filas
 * cambiaría lo que publica el `events.json`—. Y es lo que hace que las salidas
 * que solo admiten un valor sigan diciendo algo cierto.
 *
 * **Una lista vacía devuelve `presencial`**, que es el default de `formVacio()`.
 * Solo pasa en un borrador: el schema exige al menos una fila para publicar.
 *
 * @param {readonly ({ modalidad?: unknown } | null | undefined)[]} [filas]
 * @returns {'presencial' | 'virtual' | 'hibrido'}
 */
export const modalidadResultante = (filas = []) => {
  if (filas.length === 0) return 'presencial';
  const hayPresencial = filas.some((f) => filaPideSede(f?.modalidad));
  const hayVirtual = filas.some((f) => filaPideOnline(f?.modalidad));
  if (hayPresencial && hayVirtual) return 'hibrido';
  return hayVirtual ? 'virtual' : 'presencial';
};

/**
 * La sede **principal**: la de la primera fila que tenga una.
 *
 * Existe porque el campo `location` del evento —el que dibuja el mapa—, el
 * `searchText` y el filtro por barrio solo admiten una dirección. «La primera que
 * tenga» y no un flag explícito estilo `portada` (D-125) porque el orden de las
 * filas lo elige quien carga y se ve en pantalla. Si alguna vez importa
 * distinguirla, la respuesta es el flag.
 *
 * @param {readonly ({ sede?: any } | null | undefined)[]} [filas]
 * @returns {any} la sede, o `null`
 */
export const sedePrincipal = (filas = []) => filas.find((f) => f?.sede)?.sede ?? null;

/**
 * El bloque online principal, con el mismo criterio que `sedePrincipal`.
 *
 * **Lleva el link de la reunión**, como el de cada fila: es el mismo objeto. Lo
 * que decide si el link sale es `urlPublica`, y lo mira la proyección
 * (`linkDeReunionQueSale`, `src/lib/toPublic.ts`), nunca este derivado.
 *
 * @param {readonly ({ online?: any } | null | undefined)[]} [filas]
 * @returns {any} el bloque online, o `null`
 */
export const onlinePrincipal = (filas = []) => filas.find((f) => f?.online)?.online ?? null;

/**
 * Las filas de un documento como las leen todos los lectores: `?? []`, y una
 * `modalidades` que no sea lista (escrita a mano) cuenta como sin filas. Es el
 * mismo criterio de `ciudadesDesalineadas`.
 *
 * @param {Record<string, any> | null | undefined} documento
 * @returns {readonly any[]}
 */
const filasDe = (documento) =>
  Array.isArray(documento?.modalidades) ? documento.modalidades : [];

/**
 * Los cuatro derivados que el documento **tendría que** guardar, sacados de lo que
 * guarda — B-2050.
 *
 * Es `formADocumento` releído desde el documento: la sede, el online y la
 * modalidad salen de las filas, y el `searchText` sale de los campos de
 * `CAMPOS_DE_SEARCH_TEXT` con la sede **derivada** (no la guardada: si la
 * guardada miente, el índice mentiría con ella). El panel arma el índice con lo
 * tipeado sin recortar y guarda lo recortado; da lo mismo, porque
 * `buildSearchText` colapsa los espacios.
 *
 * @param {Record<string, any>} documento
 * @returns {{ modalidad: string, sede: any, online: any, searchText: string }}
 */
export const derivadosDe = (documento) => {
  const filas = filasDe(documento);
  const sede = sedePrincipal(filas);
  return {
    modalidad: modalidadResultante(filas),
    sede,
    online: onlinePrincipal(filas),
    searchText: buildSearchText({ ...documento, modalidades: filas, sede }),
  };
};

/**
 * Los derivados que el servidor verifica, **en orden**: los cuatro de arriba y
 * `ciudades`. Es la lista que recorre la comparación y la que nombra el log.
 */
export const CAMPOS_DERIVADOS = Object.freeze(
  /** @type {const} */ (['modalidad', 'sede', 'online', 'searchText', 'ciudades']),
);

/**
 * JSON con las claves de cada objeto ordenadas. `sede` y `online` son maps, y el
 * orden de sus claves depende de quién los escribió: comparar el `JSON.stringify`
 * a secas haría «corregir» una sede idéntica escrita con las claves en otro orden.
 *
 * @param {unknown} v
 * @returns {string | undefined}
 */
const canonico = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]]))
      : x,
  );

/**
 * **¿Los derivados guardados dicen lo mismo que las filas?** — B-2050.
 *
 * La mitad pura de la red: `syncCalendar` lo pregunta en cada escritura y, si hay
 * diferencia, corrige los cinco en una transacción que relee
 * (`corregirDerivados`) y avisa. Incluye `ciudades` (B-1920), así hay **una**
 * guarda y **una** escritura para los cinco, no dos write-backs que se disparan
 * uno al otro.
 *
 * Como en `ciudadesDesalineadas`, **ausente cuenta distinto de `null`**: un
 * documento sin `sede` y con una fila presencial es uno cuyo derivado falta.
 *
 * @param {Record<string, any> | null | undefined} documento
 * @returns {{ campos: string[], derivados: ReturnType<typeof derivadosDe> & { ciudades: string[] } } | null}
 *   `null` si coinciden (o no hay documento: un borrado no tiene nada que corregir).
 *   `campos` son los que difieren, en el orden de `CAMPOS_DERIVADOS`.
 */
export const derivadosDesalineados = (documento) => {
  if (!documento) return null;
  const derivados = { ...derivadosDe(documento), ciudades: ciudadesDe(filasDe(documento)) };
  const campos = CAMPOS_DERIVADOS.filter((c) =>
    c === 'ciudades'
      ? ciudadesDesalineadas(documento) !== null
      : !(c in documento) || canonico(documento[c]) !== canonico(derivados[c]),
  );
  return campos.length ? { campos, derivados } : null;
};

/**
 * ¿La corrección tocó algún derivado de **contenido**? — B-2050.
 *
 * Es lo que decide si suena `derivados-no-coinciden` además de
 * `ciudades-no-coinciden`: `ciudades` solo es una pregunta de permisos; los otros
 * cuatro salen al sitio y al calendario.
 *
 * @param {readonly string[]} campos
 * @returns {boolean}
 */
export const cambiaLoPublico = (campos) => campos.some((c) => c !== 'ciudades');

/** Los derivados que salen al `events.json` (`toPublic.ts`): todos menos `ciudades`. */
const DERIVADOS_PUBLICOS = CAMPOS_DERIVADOS.filter((c) => c !== 'ciudades');

/**
 * ¿Esta escritura pide rebuild del sitio? — B-83, B-2050.
 *
 * Es `huboCambioDeContenido` —el criterio del historial (D-41)— **más** los cuatro
 * derivados que salen al sitio. Desde B-2050 esos cuatro están en
 * `CAMPOS_DE_MAQUINA` para que la corrección de `corregirDerivados` no deje una
 * versión de historial, y sin la segunda mitad de este `||` la corrección tampoco
 * pediría rebuild: el sitio seguiría mostrando la sede inventada hasta la próxima
 * edición. Tampoco lo pediría un backfill que reescriba solo un `searchText` viejo.
 *
 * El write-back del `calendarEventId` no cambia ninguno de los dos lados, así que
 * la guarda de B-83 sigue entera. `ciudades` no entra: es de máquina y no sale al
 * `events.json` (D-1232).
 *
 * @param {Record<string, any> | null | undefined} antes
 * @param {Record<string, any> | null | undefined} despues
 * @returns {boolean}
 */
export const pideRebuild = (antes, despues) =>
  huboCambioDeContenido(antes, despues) ||
  (!!antes &&
    !!despues &&
    DERIVADOS_PUBLICOS.some((c) => canonico(antes[c]) !== canonico(despues[c])));

/**
 * El documento con sus derivados **recalculados**, para quien tiene que decidir
 * con ellos — B-2050.
 *
 * Lo usa `syncCalendar` para planificar el diff de Calendar sobre la verdad de las
 * filas y no sobre lo guardado: así un documento escrito a mano con una `sede` que
 * no es la de sus filas no llega nunca al `location` del evento, y la corrección
 * de esa sede —que vuelve a disparar el trigger— no produce un `update` en falso,
 * porque antes y después de corregir la vista es la misma.
 *
 * @template {Record<string, any> | null | undefined} T
 * @param {T} documento
 * @returns {T}
 */
export const conDerivados = (documento) =>
  documento ? /** @type {T} */ ({ ...documento, ...derivadosDe(documento) }) : documento;

/**
 * Las filas con sede y **sin ciudad** que trae esta escritura y no traía la
 * anterior — B-2052.
 *
 * `ciudadesDe` descarta las ciudades vacías (D-690), así que una segunda fila con
 * una dirección de otra ciudad y `ciudad: ''` deja `ciudades` igual y la regla
 * pasa (D-1234). Esto es la mitad pura del aviso: dice **qué filas** son, y el
 * trigger pregunta si quien escribió es una cuenta publicadora con ciudad
 * (`quienEscribioTieneCiudad`, `claims-de-cuenta.js`).
 *
 * **Solo las nuevas**, comparando por el `id` de la fila (trampa 2): el
 * write-back del `calendarEventId` y la corrección de los derivados conservan el
 * `updatedBy` de la cuenta, y sin esto cada uno volvería a avisar lo mismo. Una
 * fila sin `id` (escrita a mano) se identifica por su posición, que es lo único
 * que tiene.
 *
 * @param {Record<string, any> | null | undefined} despues
 * @param {Record<string, any> | null | undefined} antes
 * @returns {number} cuántas filas nuevas con sede y sin ciudad
 */
export const sedesSinCiudadNuevas = (despues, antes) => {
  const sinCiudad = (documento) =>
    new Set(
      filasDe(documento)
        .map((f, i) => (f?.sede && !slugDeCiudad(f.sede.ciudad) ? `${f?.id ?? `#${i}`}` : null))
        .filter(Boolean),
    );
  const previas = sinCiudad(antes);
  return [...sinCiudad(despues)].filter((id) => !previas.has(id)).length;
};
