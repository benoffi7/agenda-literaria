/**
 * B-882 — el chequeo de frescura: **¿lo que está publicado aparece en el
 * sitio?**
 *
 * Lógica pura, sin Firebase, sin red y sin reloj (`05-patrones.md` § «El reloj
 * también es infraestructura»): el "ahora" y los dos lados de la comparación
 * entran como parámetros. La infraestructura —el schedule, el `fetch` del
 * `events.json`, Firestore y el issue— vive en `frescura-trigger.js`.
 *
 * ── Por qué esto y no vigilar el workflow ─────────────────────────────────
 *
 * El 2026-09-11 el dueño cargó ocho actividades, las publicó y **ninguna
 * apareció**. El rebuild venía fallando desde el día anterior —ocho corridas
 * rojas seguidas, todas en el paso `Tests`, que corre **antes** del build— y el
 * único que se enteró fue él, mirando el sitio.
 *
 * Ese incidente no lo veía ninguna de las alarmas que ya existen, y no por
 * casualidad:
 *
 *  - `alerta: 'rebuild-agotado'` (B-21) mira los reintentos del
 *    `repository_dispatch`. Ahí **no falló ninguno**: GitHub aceptó los ocho
 *    dispatches con 204 y `registrarExito` bajó `pendiente`. El flag decía que
 *    estaba todo bien mientras el sitio quedaba viejo — es exactamente lo que
 *    B-884 escribió en `rebuild.js`: `pendiente: false` significa «despachado»,
 *    no «publicado».
 *  - Un chequeo del workflow habría visto *ese* eslabón, y solo ese.
 *
 * Por eso este chequeo **mide el efecto y no el mecanismo**. Compara lo que hay
 * publicado en Firestore contra el `events.json` que sirve el sitio, que es la
 * promesa del producto entera: «lo que publicás aparece». Con una sola medición
 * quedan cubiertos el workflow roto, la marca de rebuild perdida, un deploy que
 * sube sin Functions, el CDN sirviendo una copia vieja **y las causas que
 * todavía no conocemos** — ninguna de las cuales hay que anticipar para que el
 * chequeo las agarre.
 *
 * Corolario que decide una línea de código y conviene tener escrito: la lectura
 * del índice pide **la misma URL que pide el público, sin ningún parámetro que
 * esquive la cache**. Si el CDN devuelve una copia vieja, eso *es* la
 * divergencia y no un artefacto de la medición. Ver `frescura-trigger.js`.
 *
 * ── La edición de una actividad ya listada: dos marcas, no dos derivaciones
 *
 * El conjunto de slugs no ve una **edición**: si cambia el título y el slug no
 * (el slug es inmutable después de publicar — trampa 10), los dos conjuntos
 * siguen siendo idénticos. Verlo comparando el *contenido* de cada entrada
 * pediría rederivar `toPublic`/`entradaDeIndice` adentro de una Cloud Function:
 * una segunda derivación de la proyección, que es la forma de bug que
 * `05-patrones.md` nombra («dos derivaciones de la misma idea se separan sin que
 * nada falle») y que terminaría avisando de sus propias diferencias. Eso sigue
 * sin hacerse.
 *
 * Lo que sí se hace desde **B-886** es comparar **dos marcas del pipeline**: el
 * `generadoEn` del índice que sirve el sitio contra `despacho.cubreHasta` de
 * `sistema/rebuild` (B-884), que es el piso de lo que el último despacho tiene
 * que haber llevado al sitio. Si el índice es más viejo que ese piso, hay un
 * cambio despachado —una edición, un cambio de etiqueta en `/opciones/*`,
 * cualquiera— que el sitio no tiene. No nombra **cuál**: no sabe, y no lo
 * inventa. Ver `compararMarcas`.
 *
 * ── Y no reemplaza a B-883, ni al revés ───────────────────────────────────
 * B-883 hace que un workflow roto abra un issue: vigila **un** eslabón, y lo
 * vigila mejor de lo que este chequeo podría (sabe por qué falló y en qué paso).
 * Éste vigila la promesa entera y no sabe por qué. Se necesitan los dos: sin
 * B-883, cada atraso arranca una investigación desde cero; sin éste, un atraso
 * que no pase por un workflow rojo —el dispatch que GitHub aceptó y no corrió,
 * el deploy que subió sin el índice, el CDN cacheado— no lo ve nadie.
 */

// Los dos son puros: `rebuild.js` no toca Firebase ni la red, y `milisDe` es la
// normalización de fechas que ya comparten las Functions. Ver `compararMarcas`.
import { milisDe } from './calendario.js';
import { cubiertoPorElUltimoDespacho } from './rebuild.js';

/* ──────────────────────────────────────────────────────────────────────────
 * La ventana: cuánta divergencia es normal
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * **El criterio, no el número.** El sitio siempre está atrasado un rato, así que
 * la pregunta no es «¿hay diferencia?» sino «¿hace cuánto?». La ventana es la
 * suma del peor camino que puede recorrer un cambio desde que se guarda hasta
 * que el público lo ve, y **cada sumando es un número que vive en otro archivo
 * del repo**:
 *
 * | Sumando | De dónde sale | Hoy |
 * |---|---|---|
 * | `DEBOUNCE_MS` | el `schedule: 'every 5 minutes'` de `dispararRebuild` (§8) | 5 min |
 * | `TOPE_DEL_BUILD_MS` | el `timeout-minutes: 15` de `.github/workflows/deploy.yml` | 15 min |
 * | `REINTENTO_DEL_BUILD_MS` | el `cancel-in-progress: true` de ese mismo workflow: una edición que llega con el build a medias lo cancela y el siguiente empieza de cero | 15 min |
 * | `PROPAGACION_MS` | Hosting publicando la versión nueva + el `no-cache` de `firebase.json` | 5 min |
 *
 * **Cómo se recalcula el día que el build tarde más** (y este párrafo es el
 * entregable, no el 40):
 *
 *  1. Si cambió el tope del workflow → `TOPE_DEL_BUILD_MS` y
 *     `REINTENTO_DEL_BUILD_MS` valen ese tope nuevo. No hay que medir nada: el
 *     `timeout-minutes` **es** la cota, porque pasado eso el job muere y el
 *     rebuild ya no llega.
 *  2. Si cambió el período del schedule → `DEBOUNCE_MS`.
 *  3. `PROPAGACION_MS` solo se toca si se cambia la cabecera de cache de
 *     `/events.json` en `firebase.json` (hoy `no-cache`, o sea revalidación en
 *     cada pedido).
 *
 * Lo que **no** se hace es aflojar el total a ojo porque «avisó de más»: si avisa
 * de más, hay un sumando que quedó viejo, y el que quedó viejo hay que buscarlo.
 * `tests/frescura.test.ts` lee los dos archivos de arriba y se pone rojo si
 * alguno de los dos números deja de coincidir, así que la tabla no puede
 * envejecer en silencio.
 */
export const DEBOUNCE_MS = 5 * 60 * 1000;
export const TOPE_DEL_BUILD_MS = 15 * 60 * 1000;
export const REINTENTO_DEL_BUILD_MS = 15 * 60 * 1000;
export const PROPAGACION_MS = 5 * 60 * 1000;

/** 40 minutos. Ver la tabla de arriba: es una suma, no una elección. */
export const TOLERANCIA_MS =
  DEBOUNCE_MS + TOPE_DEL_BUILD_MS + REINTENTO_DEL_BUILD_MS + PROPAGACION_MS;

/**
 * Cada cuánto se vuelve a avisar de **la misma** divergencia.
 *
 * Un aviso por corrida serían 48 issues por día y el canal se vuelve ruido, que
 * es la forma lenta de apagar una alarma. Un aviso por día mantiene el hilo vivo
 * sin ser insoportable, y cualquier divergencia **nueva** avisa en el acto
 * (cambia la firma).
 */
export const REAVISO_MS = 24 * 60 * 60 * 1000;

/**
 * Cuántas lecturas fallidas seguidas hacen falta para que el chequeo grite.
 *
 * Con el tick de 30 minutos son dos horas. Ver `sinLectura` más abajo: una
 * lectura que falla es, en primera instancia, un problema **del chequeo**, y un
 * chequeo que grita cuando el que está roto es él se apaga a la semana.
 */
export const FALLAS_PARA_ESCALAR = 4;

/** Cuántos slugs entran al aviso antes de resumir. Un issue con 300 no se lee. */
export const TOPE_DE_SLUGS_EN_EL_AVISO = 20;

/**
 * Cuántas divergencias guardan su reloj en `sistema/frescura`.
 *
 * El documento de Firestore tiene un tope duro de 1 MB, y pasado ese tope la
 * transacción que escribe el veredicto empieza a fallar: **la alarma se muere en
 * silencio**, que es el peor final posible para este chequeo. Con 200 entradas
 * de `{slug, desdeMs}` el documento no llega ni a 20 kB.
 *
 * Lo que se pierde pasado el tope es solo el reloj de respaldo (el del borrado
 * duro): esas divergencias se siguen viendo y se siguen avisando, se fechan con
 * `updatedAt` como todas las demás.
 */
export const TOPE_DE_VISTAS = 200;

/**
 * B-886 — cuánto puede estar adelantado el reloj del runner de Actions respecto
 * del de Firestore sin que el chequeo confunda «cubierto» con «viejo».
 *
 * `generadoEn` lo estampa el runner y `cubreHasta` es un `serverTimestamp()`:
 * son dos relojes. Un minuto sobra —los dos van por NTP— y no le quita nada a la
 * medición, porque entre la marca y el `generadoEn` del build que la cubre hay
 * **siempre** varios minutos: el tick del debounce, la cola del runner y el paso
 * `Tests`, que corre antes del build. El margen solo puede hacer que se escape un
 * caso de un minuto que no existe; nunca que avise de más.
 */
export const MARGEN_DE_RELOJ_MS = 60 * 1000;

/* ──────────────────────────────────────────────────────────────────────────
 * Leer el índice
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * La forma de un slug, tal como la produce `src/lib/slugify.ts`.
 *
 * Se usa como **lista blanca de lo que puede salir al issue**: el repo de GitHub
 * es público y el cuerpo del aviso se arma interpolando slugs. Con esto, lo
 * único que puede viajar es `[a-z0-9-]`, así que el aviso no puede llevar un
 * link, un mail ni un teléfono ni aunque alguien meta uno en el campo. Es la
 * misma idea del saneador de `reportes.js` (D-197) resuelta por construcción, y
 * más barata: acá el dato ya tiene forma cerrada.
 */
export const FORMA_DE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Un slug que no tiene la forma esperada no se imprime: se cuenta. */
export const slugImprimible = (slug) => (FORMA_DE_SLUG.test(String(slug)) ? String(slug) : null);

/** La forma de un id de documento de Firestore. Ver el uso en `leerIndice`. */
export const FORMA_DE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Por qué no se pudo leer el índice, en **vocabulario cerrado**.
 *
 * ── Por qué cerrado y no el mensaje del error ─────────────────────────────
 * Porque este valor es lo único que el aviso de «el sitio no contesta»
 * interpola además de números, y ese aviso va a un repo **público**. Con el
 * mensaje crudo, la garantía de que al issue no se cuela nada vuelve a ser de
 * disciplina —«nadie va a agregar el cuerpo de la respuesta acá»— justo lo que
 * `slugImprimible` cerró por forma para el otro aviso. Lo marcó el
 * `auditor-privacidad`.
 *
 * El texto de verdad no se pierde: viaja como `detalle` al `logger` y a
 * `sistema/frescura`, que son admin-only.
 */
export const MOTIVOS = {
  red: 'red',
  timeout: 'timeout',
  http: 'http',
  noJson: 'no-json',
  sinLista: 'sin-lista',
  sinSlug: 'sin-slug',
};

/**
 * Lee el cuerpo del `events.json` vivo y devuelve los slugs que publica.
 *
 * **Un 200 con un cuerpo que no es el índice no es «el sitio no tiene ninguna
 * actividad»: es una lectura fallida.** La diferencia decide todo: una página de
 * error del CDN servida con 200 se leería, sin este corte, como «se borraron las
 * 200 actividades» y dispararía el aviso más ruidoso posible por un problema que
 * es del chequeo. Ver el §4 de la cabecera de `frescura-trigger.js`.
 *
 * `actividades: []` **sí** es una lectura buena, y a propósito: un build que
 * produce un índice vacío (B-189) es justamente una de las formas de romper la
 * promesa que este chequeo existe para ver.
 */
export const leerIndice = (texto) => {
  let datos;
  try {
    datos = JSON.parse(String(texto ?? ''));
  } catch {
    return { ok: false, motivo: MOTIVOS.noJson, detalle: 'el cuerpo no es JSON' };
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, motivo: MOTIVOS.noJson, detalle: 'el JSON no es un objeto' };
  }
  if (!Array.isArray(datos.actividades)) {
    return {
      ok: false,
      motivo: MOTIVOS.sinLista,
      detalle: 'el JSON no tiene la lista de actividades',
    };
  }
  const slugs = [];
  // `{ slug: id }` para poder ir a buscar el documento de un sobrante: es el
  // único caso en el que hace falta una lectura más, y solo se paga cuando hay
  // un sobrante (que es casi nunca).
  const idPorSlug = {};
  for (const a of datos.actividades) {
    const slug = typeof a?.slug === 'string' ? a.slug : '';
    // Una entrada sin slug no es una actividad del índice: el slug es la URL.
    if (!slug) {
      return { ok: false, motivo: MOTIVOS.sinSlug, detalle: 'hay una actividad sin slug' };
    }
    slugs.push(slug);
    /*
     * El `id` viene de un archivo traído por HTTP y del otro lado se interpola
     * en **una ruta de documento** (`actividades/<id>`). Un valor con `/`
     * direccionaría otra colección —`…/versiones/…`— o tiraría. Así que entra
     * por lista blanca de forma, como el slug del aviso: lo que no tiene forma
     * de id de Firestore simplemente no se usa, y ese sobrante se fecha con el
     * reloj de la primera vez. Lo marcó el `auditor-privacidad`.
     */
    if (FORMA_DE_ID.test(String(a?.id ?? ''))) idPorSlug[slug] = a.id;
  }
  return {
    ok: true,
    slugs,
    idPorSlug,
    generadoEn: typeof datos.generadoEn === 'string' ? datos.generadoEn : null,
    version: typeof datos.version === 'string' ? datos.version : null,
  };
};

/* ──────────────────────────────────────────────────────────────────────────
 * Comparar
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * La diferencia entre los dos conjuntos de slugs, en las **dos** direcciones.
 *
 * ── Por qué el conjunto y no el conteo ────────────────────────────────────
 * Contar publicadas de los dos lados es lo obvio y es lo más frágil que se puede
 * elegir: **dos diferencias que se cancelan dan el mismo número.** Una actividad
 * publicada que no llegó al sitio más una cancelada que no se fue dan 200 contra
 * 200, y el chequeo dice «fresco» con las dos mitades rotas. No es un caso de
 * laboratorio: el 2026-09-11 el dueño publicó ocho y, si en la misma tanda
 * hubiera bajado ocho, el contador no habría visto nada.
 *
 * Y hay una segunda razón, que es la que convierte una alarma en una acción: el
 * conjunto **nombra** lo que falta. «`taller-de-cronica` no está en el sitio
 * desde hace 40 minutos» se puede verificar en un click; «hay 199 y tendría que
 * haber 200» manda a contar a mano.
 *
 * El slug y no el id porque el slug **es** la URL: «aparecer en el sitio»
 * significa que `\/actividad\/<slug>` existe, y además es inmutable después de
 * publicar (trampa 10), o sea que es una clave estable de los dos lados.
 */
export const diferenciaDeSlugs = (publicados, enElIndice) => {
  const aca = new Set(publicados);
  const alla = new Set(enElIndice);
  return {
    faltan: [...aca].filter((s) => !alla.has(s)).sort(),
    sobran: [...alla].filter((s) => !aca.has(s)).sort(),
  };
};

/**
 * Le pone fecha a cada divergencia. **De esa fecha depende que el chequeo
 * distinga «el sitio está en camino» de «el sitio está roto».**
 *
 * El reloj que se usa, en orden:
 *
 *  1. **`updatedAt` del documento** (`fechas[slug]`), que es cuando el cambio
 *     quedó escrito en Firestore, o sea cuando arrancó el reloj del debounce y
 *     del build. Es el reloj de verdad y es el que hace que el chequeo sirva
 *     desde la **primera** corrida: ocho actividades publicadas ayer con el
 *     pipeline muerto se ven ya, sin esperar a nada.
 *
 *     Se equivoca solo hacia el lado inofensivo: si `updatedAt` es más nuevo de
 *     lo que debería, la divergencia parece más joven y el chequeo espera de
 *     más. Nunca al revés.
 *
 *  2. **Cuándo se vio por primera vez** (`previo.vistas[slug]`), para lo que no
 *     tiene documento del cual sacar una fecha — el único caso es un slug que
 *     está en el JSON y cuya actividad se **borró**. Ahí no queda ningún reloj
 *     más que el nuestro, y el precio es que ese caso necesita una segunda
 *     corrida para contar. Se paga sin drama: el panel cancela, no borra.
 *
 *  3. **Ahora**, para lo que se ve por primera vez y no se puede fechar. Arranca
 *     el reloj del punto 2.
 *
 * ── `vistas` es una LISTA y no un mapa, y eso es una decisión ─────────────
 * Se guarda en `sistema/frescura`, que se escribe con `set(..., { merge: true })`,
 * y **el merge de Firestore es profundo sobre los mapas**: una clave que deja de
 * venir no se borra, se conserva. O sea que como mapa el registro hacía lo
 * contrario de lo que promete —acumulaba para siempre el slug de todo lo que
 * alguna vez divergió— hasta reventar el tope de 1 MB del documento, y ahí la
 * transacción empieza a fallar: **la alarma se muere en silencio**, que es el
 * modo de falla exacto que este ítem existe para cerrar. Lo encontró el
 * `auditor-privacidad`.
 *
 * Una lista, en cambio, el merge la **reemplaza entera**, así que el registro
 * queda con lo que diverge ahora y nada más. De paso el slug —que viene de un
 * archivo traído por HTTP— deja de ser una clave de un mapa de Firestore y pasa
 * a ser un valor, que es donde un carácter raro no decide nada.
 *
 * @param {string[]} slugs
 * @param {Record<string, number>} [fechas]   `updatedAt` del documento, en milis
 * @param {{slug: string, desdeMs: number}[]} [vistas]  cuándo se vio por primera vez cada uno
 * @param {number} [ahora]
 * @returns {{ slug: string, desdeMs: number, reloj: string }[]}
 */
export const fechar = (slugs, fechas = {}, vistas = [], ahora = Date.now()) => {
  const porVista = new Map(
    (Array.isArray(vistas) ? vistas : []).map((v) => [v?.slug, Number(v?.desdeMs)]),
  );
  return slugs.map((slug) => {
    const porDocumento = Number(fechas?.[slug]);
    if (Number.isFinite(porDocumento)) {
      return { slug, desdeMs: porDocumento, reloj: 'documento' };
    }
    const vista = porVista.get(slug);
    if (Number.isFinite(vista)) return { slug, desdeMs: vista, reloj: 'primera-vez' };
    return { slug, desdeMs: ahora, reloj: 'primera-vez' };
  });
};

/**
 * B-886 — ¿el índice que sirve el sitio es anterior al último despacho?
 *
 * Es la comparación que ve **la edición de una actividad ya listada**, que el
 * conjunto de slugs no puede ver. Compara dos marcas del pipeline y ninguna
 * derivación del documento:
 *
 *  - `generadoEn` del `events.json` vivo, que el build estampa **al arrancar**
 *    (`astro.config.mjs` → `scripts/version.mjs`), o sea **antes** de leer
 *    Firestore. Por eso `generadoEn >= cubreHasta` alcanza para afirmar que el
 *    build leyó después de la marca y la contiene.
 *  - `despacho.cubreHasta` de `sistema/rebuild`: la marca que el tick leyó antes
 *    del `repository_dispatch` (B-884). Se lee con `cubiertoPorElUltimoDespacho`,
 *    que es la lectura que `rebuild.js` dejó escrita para esto.
 *
 * ── Desde cuándo corre el reloj: `disparado`, no `cubreHasta` ─────────────
 * La edad se mide desde el **despacho**, no desde la marca. Con la marca, un
 * dispatch que salió tarde —GitHub caído, el backoff de B-21 esperando hasta
 * 75 minutos— llegaría al build ya con la ventana gastada y el chequeo avisaría
 * **durante el camino normal** de ese build. Lo que pasa antes del dispatch ya
 * tiene su alarma (`rebuild-agotado`); esto mide lo que pasa **después**: build,
 * reintento y propagación. La ventana entera (`TOLERANCIA_MS`) incluye además el
 * debounce, así que desde el dispatch sobra.
 *
 * Y una edición que llega con el build a medias (el `cancel-in-progress`) hace un
 * despacho nuevo con un `disparado` nuevo: el reloj vuelve a cero en vez de
 * acusar al build que se canceló a propósito. Mientras el dueño está editando
 * seguido, el sitio está legítimamente en camino y el chequeo lo dice así.
 *
 * ── `sin-ancla` es «no sé», no «al día» ───────────────────────────────────
 * Sin `cubreHasta` (un `sistema/rebuild` anterior a B-884, o que nunca despachó)
 * o sin un `generadoEn` que se pueda leer (un build de dev lo deja vacío), no hay
 * comparación posible. No se avisa **y no se afirma** nada: el estado lo dice.
 *
 * @param {{ generadoEn?: string | null, rebuild?: Record<string, any> | null,
 *           ahora?: number, toleranciaMs?: number }} args
 * @returns {{ estado: 'al-dia' | 'en-vuelo' | 'atrasado' | 'sin-ancla',
 *             edadMs: number, generadoMs: number | null, cubreHastaMs: number | null,
 *             disparadoMs: number | null }}
 */
export const compararMarcas = ({
  generadoEn = null,
  rebuild = null,
  ahora = Date.now(),
  toleranciaMs = TOLERANCIA_MS,
}) => {
  const cubreHastaMs = cubiertoPorElUltimoDespacho(rebuild);
  const disparadoMs = milisDe(rebuild?.disparado);
  const generado = typeof generadoEn === 'string' && generadoEn ? Date.parse(generadoEn) : NaN;
  const generadoMs = Number.isFinite(generado) ? generado : null;
  const base = { generadoMs, cubreHastaMs, disparadoMs };

  if (cubreHastaMs == null || generadoMs == null) return { estado: 'sin-ancla', edadMs: 0, ...base };
  if (generadoMs + MARGEN_DE_RELOJ_MS >= cubreHastaMs) return { estado: 'al-dia', edadMs: 0, ...base };

  // `disparado` y `cubreHasta` los escribe la misma llamada a `registrarExito`,
  // así que describen el mismo despacho. El `max` es la red si alguno quedó
  // escrito a mano: el reloj arranca en el más tardío, que es el lado que espera
  // de más y no el que avisa de más.
  const desdeMs = Math.max(cubreHastaMs, disparadoMs ?? cubreHastaMs);
  const edadMs = Math.max(0, ahora - desdeMs);
  return { estado: edadMs > toleranciaMs ? 'atrasado' : 'en-vuelo', edadMs, ...base };
};

/**
 * El veredicto.
 *
 * `enVuelo` son las divergencias **más jóvenes que la ventana**: el sitio está
 * en camino y eso es lo normal. No son un problema y no se avisan; se cuentan
 * para que el documento diga «hay tres en camino» en vez de callarse, que es lo
 * que distingue «no pasa nada» de «no estoy mirando».
 *
 * `publicadas` y `enElIndice` viajan **solo como dato del log**. La decisión no
 * los mira, y está dicho acá para que nadie los use más adelante creyendo que
 * son la medición: la medición es el conjunto (ver `diferenciaDeSlugs`).
 *
 * @param {{ faltan?: {slug: string, desdeMs: number, reloj?: string}[],
 *           sobran?: {slug: string, desdeMs: number, reloj?: string}[],
 *           publicadas?: number, enElIndice?: number,
 *           generadoEn?: string | null, marcas?: ReturnType<typeof compararMarcas> | null,
 *           ahora?: number, toleranciaMs?: number }} args
 *
 * `marcas` es el resultado de `compararMarcas` (B-886), o nada. Cuenta como una
 * divergencia más: `en-vuelo` suma a `enVuelo` y `atrasado` pone el veredicto en
 * `atrasado` aunque los conjuntos de slugs coincidan, que es justamente el caso
 * de una edición.
 */
export const compararFrescura = ({
  faltan = [],
  sobran = [],
  publicadas = 0,
  enElIndice = 0,
  generadoEn = null,
  marcas = null,
  ahora = Date.now(),
  toleranciaMs = TOLERANCIA_MS,
}) => {
  const conEdad = (items, lado) =>
    items.map((i) => ({ slug: i.slug, lado, edadMs: ahora - i.desdeMs, reloj: i.reloj }));

  const todas = [...conEdad(faltan, 'falta'), ...conEdad(sobran, 'sobra')];
  const vencidas = todas.filter((d) => d.edadMs > toleranciaMs);
  const enVuelo = todas.filter((d) => d.edadMs <= toleranciaMs);
  const indiceViejo = marcas?.estado === 'atrasado';
  const indiceEnVuelo = marcas?.estado === 'en-vuelo';

  // El reloj de cada divergencia se persiste para la próxima corrida, y **solo
  // el de las que siguen divergiendo**: así el registro se limpia solo y no se
  // convierte en un cementerio de slugs que ya se arreglaron. Es una lista y no
  // un mapa justamente para que eso sea cierto — ver `fechar`. El tope es la
  // otra mitad: ni siquiera un día raro puede empujar el documento al límite.
  const vistas = [...faltan, ...sobran]
    .slice(0, TOPE_DE_VISTAS)
    .map((i) => ({ slug: i.slug, desdeMs: i.desdeMs }));

  const hayVencidas = vencidas.length > 0 || indiceViejo;
  const cuantasEnVuelo = enVuelo.length + (indiceEnVuelo ? 1 : 0);
  return {
    estado: hayVencidas ? 'atrasado' : cuantasEnVuelo ? 'en-vuelo' : 'fresco',
    faltan: vencidas.filter((d) => d.lado === 'falta'),
    sobran: vencidas.filter((d) => d.lado === 'sobra'),
    // B-886 — el índice es anterior al último despacho y ya pasó la ventana.
    indiceViejo,
    // Lo que se persiste de la comparación de marcas: solo el veredicto y la
    // edad, como el resto de este objeto. Las marcas crudas van al log.
    marcas: marcas ? { estado: marcas.estado, edadMs: marcas.edadMs } : null,
    enVuelo: cuantasEnVuelo,
    peorEdadMs: Math.max(
      vencidas.reduce((m, d) => Math.max(m, d.edadMs), 0),
      indiceViejo ? marcas.edadMs : 0,
    ),
    publicadas,
    enElIndice,
    generadoEn,
    toleranciaMs,
    vistas,
  };
};

/**
 * La firma de una divergencia: **qué** está divergiendo, sin **hace cuánto**.
 *
 * Es la clave del deduplicado del aviso. Que no lleve la edad es el punto: si la
 * llevara, cada corrida produciría una firma distinta y el «ya avisé de esto»
 * no existiría.
 */
export const firmaDe = (veredicto) =>
  [
    veredicto.estado,
    ...veredicto.faltan.map((d) => `-${d.slug}`),
    ...veredicto.sobran.map((d) => `+${d.slug}`),
    // B-886 — sin marca de tiempo, por lo mismo que el resto: si llevara
    // `cubreHasta`, cada edición hecha con el build roto abriría otro issue y
    // pediría otro build, en vez de uno por día.
    ...(veredicto.indiceViejo ? ['~indice'] : []),
  ].join('|');

/* ──────────────────────────────────────────────────────────────────────────
 * Avisar
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * ¿Hay que avisar, y por qué no?
 *
 * Devuelve siempre un motivo, también cuando no avisa: el log de una corrida
 * silenciosa tiene que poder explicar por qué se quedó callada, si no el único
 * modo de saber si el chequeo está vivo es que falle.
 *
 * @param {{ previo?: Record<string, any> | null, veredicto: Record<string, any>, ahora?: number }} args
 */
export const decidirAviso = ({ previo = null, veredicto, ahora = Date.now() }) => {
  if (veredicto.estado !== 'atrasado') return { avisar: false, motivo: veredicto.estado };
  const firma = firmaDe(veredicto);
  const aviso = previo?.aviso ?? null;
  if (aviso?.firma === firma) {
    const desde = Number(aviso.enMs);
    if (Number.isFinite(desde) && ahora - desde < REAVISO_MS) {
      return { avisar: false, motivo: 'ya avisado', firma };
    }
    return { avisar: true, motivo: 'sigue atrasado', firma };
  }
  return { avisar: true, motivo: 'divergencia nueva', firma };
};

/**
 * Qué escribir en `sistema/frescura` cuando **no se pudo leer** el índice.
 *
 * ── Un chequeo que grita cuando el roto es él se apaga a la semana ────────
 *
 * Una lectura fallida —timeout, 5xx, un cuerpo que no es el índice— **no es una
 * divergencia**: es la ausencia de una de las dos mitades de la comparación. El
 * veredicto anterior no se pisa con un «atrasado» inventado y no se avisa nada:
 * el estado pasa a `sin-lectura`, que es honesto, y el contador sube.
 *
 * Recién con `FALLAS_PARA_ESCALAR` seguidas —dos horas con el tick de 30
 * minutos— el chequeo habla, y habla de **otra cosa y con otra etiqueta**: a esa
 * altura ya no es «tuve un timeout», es «el sitio no contesta», que es una forma
 * peor de romper la misma promesa y merece saberse. El contador se resetea con
 * la primera lectura buena, así que un timeout suelto no deja rastro.
 *
 * Y no hay reintento dentro de la corrida: el reintento es el próximo tick, que
 * es gratis y está media hora más lejos de la causa transitoria.
 *
 * `motivo` es del vocabulario cerrado de `MOTIVOS` —es lo único que después
 * puede llegar al aviso público— y `detalle` es el texto de verdad, que se
 * guarda acá y en el log porque los dos son admin-only y sin él un 502 del CDN y
 * un socket colgado se ven igual.
 *
 * @param {{ previo?: Record<string, any> | null, motivo?: string, detalle?: string,
 *           ahora?: number }} args
 */
export const registrarFalloDeLectura = ({
  previo = null,
  motivo,
  detalle = '',
  ahora = Date.now(),
}) => {
  const fallas = Number(previo?.lectura?.fallas);
  const seguidas = (Number.isFinite(fallas) && fallas > 0 ? fallas : 0) + 1;
  return {
    estado: 'sin-lectura',
    lectura: {
      ok: false,
      motivo: Object.values(MOTIVOS).includes(motivo) ? motivo : 'desconocido',
      detalle: String(detalle ?? '').slice(0, 300),
      fallas: seguidas,
    },
    escalar: seguidas >= FALLAS_PARA_ESCALAR,
    seguidas,
  };
};

/**
 * ¿Hay que avisar de que el índice no se puede leer?
 *
 * Misma forma que `decidirAviso` y por el mismo motivo: sin esto, a partir de la
 * cuarta falla se abriría un issue **por corrida**, o sea 48 por día mientras el
 * sitio esté caído. La firma no lleva el número exacto de fallas —si no, cada
 * corrida sería una firma nueva y el deduplicado no existiría—, así que el
 * reaviso lo gobierna `REAVISO_MS` igual que el del atraso.
 *
 * @param {{ previo?: Record<string, any> | null, seguidas: number, ahora?: number }} args
 */
export const decidirAvisoDeLectura = ({ previo = null, seguidas, ahora = Date.now() }) => {
  if (seguidas < FALLAS_PARA_ESCALAR) return { avisar: false, motivo: 'sin-lectura, todavía' };
  const firma = 'sin-lectura';
  const aviso = previo?.aviso ?? null;
  if (aviso?.firma === firma) {
    const desde = Number(aviso.enMs);
    if (Number.isFinite(desde) && ahora - desde < REAVISO_MS) {
      return { avisar: false, motivo: 'ya avisado', firma };
    }
  }
  return { avisar: true, motivo: 'el sitio no contesta', firma };
};

/* ──────────────────────────────────────────────────────────────────────────
 * El texto del aviso
 * ────────────────────────────────────────────────────────────────────────── */

const minutos = (ms) => Math.round(ms / 60000);

/**
 * La antigüedad de una divergencia, **en tramos gruesos**, para el aviso público.
 *
 * ── Por qué no el minuto exacto ───────────────────────────────────────────
 * Porque `peorEdadMs` es `ahora - updatedAt`, y un issue de GitHub lleva su
 * `created_at` **público**: publicar «hace 137 minutos» es publicar el
 * `updatedAt` de un documento con precisión de un minuto, en una salida que no se
 * puede despublicar. El §5 dice que `updatedAt` no sale a ninguna salida, y D-138
 * ya había recortado `createdAt` al día por lo mismo — con un solo admin, el
 * instante exacto de cada carga **es su agenda de trabajo**. Lo marcó el
 * `auditor-privacidad`.
 *
 * Los tramos empiezan en seis horas, así que lo más fino que se puede inferir del
 * aviso es una banda de seis horas, y de ahí para arriba es el día. El número
 * exacto sigue estando donde se puede: en `sistema/frescura` y en el
 * `logger.error`, que son admin-only.
 */
export const edadGruesa = (ms) => {
  const horas = Number(ms) / 3_600_000;
  if (!Number.isFinite(horas) || horas < 6) return 'más que la ventana';
  if (horas < 24) return 'más de seis horas';
  if (horas < 24 * 7) return 'más de un día';
  return 'más de una semana';
};

const lista = (divergencias) => {
  const impresos = divergencias
    .map((d) => slugImprimible(d.slug))
    .filter(Boolean)
    .slice(0, TOPE_DE_SLUGS_EN_EL_AVISO);
  const ocultos = divergencias.length - impresos.length;
  const filas = impresos.map((s) => `- \`${s}\``);
  if (ocultos > 0) filas.push(`- …y ${ocultos} más`);
  return filas.join('\n');
};

/**
 * El issue que se abre cuando el sitio quedó atrasado.
 *
 * **Sobre el repo público (§5.1).** Lo único que sale de acá son **slugs** y
 * **conteos**, y los slugs ya son públicos en los dos lados de la comparación: el
 * que falta está `publicado` en Firestore (o sea que su URL está por existir) y
 * el que sobra ya está servido en el `events.json`. No sale ni el título, ni el
 * id, ni nada del documento — y `slugImprimible` lo garantiza por forma, no por
 * disciplina.
 *
 * La antigüedad sale **en tramos** y no en minutos: el minuto exacto reconstruye
 * el `updatedAt` de un documento contra el `created_at` público del issue. Ver
 * `edadGruesa`. La ventana sí va con su número, porque es una constante de este
 * archivo y no un dato de nadie.
 */
export const issueDeAtraso = (veredicto) => {
  const total = veredicto.faltan.length + veredicto.sobran.length;
  const title = total
    ? `[frescura] El sitio quedó atrasado: ${total} ` +
      `${total === 1 ? 'actividad no coincide' : 'actividades no coinciden'} con lo publicado`
    : '[frescura] El sitio quedó atrasado: el índice es anterior al último cambio despachado';

  const cuerpo = [
    `> Abierto automáticamente por \`verificarFrescuraDelSitio\` (B-882).`,
    `> Compara lo publicado en Firestore contra el \`events.json\` que sirve el sitio.`,
    '',
    `La diferencia más vieja lleva **${edadGruesa(veredicto.peorEdadMs)}**, contra una ventana ` +
      `normal de ${minutos(veredicto.toleranciaMs)} minutos (debounce + build + propagación, ` +
      '`functions/frescura.js`). O sea que esto ya no se explica por un build en curso. ' +
      'El número exacto está en `sistema/frescura` y en el log, que no son públicos.',
    '',
    veredicto.faltan.length
      ? `### Publicadas que el sitio no muestra (${veredicto.faltan.length})\n\n${lista(veredicto.faltan)}\n`
      : '',
    veredicto.sobran.length
      ? `### El sitio muestra y ya no está publicado (${veredicto.sobran.length})\n\n${lista(veredicto.sobran)}\n`
      : '',
    // B-886 — sin nombres ni fechas: el chequeo no sabe **qué** cambio falta, y
    // la marca exacta es un `updatedAt` con otro nombre (ver `edadGruesa`).
    veredicto.indiceViejo
      ? '### Un cambio despachado que el sitio no tiene\n\n' +
        'El `events.json` que sirve el sitio se generó **antes** del último cambio que se ' +
        'despachó al build (`despacho.cubreHasta` en `sistema/rebuild`, B-886). Es una ' +
        'edición, un cambio de etiqueta o cualquier otro cambio que no altera la lista ' +
        'de slugs, así que no se puede nombrar: se ve comparando las dos marcas.\n'
      : '',
    '### Dónde mirar',
    '',
    '1. Las corridas de `Build y deploy` en Actions: el fallo del 2026-09-11 fue el paso',
    '   `Tests`, que corre **antes** del build, así que el sitio se quedó en la versión anterior.',
    '2. `sistema/rebuild` en Firestore: `ultimoError`, `agotado`, `intentos`. **Ojo:**',
    '   `pendiente: false` significa «despachado», no «publicado» (B-884).',
    '3. `sistema/frescura`, que tiene este mismo veredicto y la corrida en la que empezó.',
    '',
    '---',
    'Este chequeo mide el efecto y no el mecanismo: si esto está abierto, la promesa del',
    'producto —lo que publicás aparece— está rota, aunque todas las piezas digan que están bien.',
    'Se cierra a mano: el chequeo no cierra issues.',
  ]
    .filter((x) => x !== '')
    .join('\n');

  return { title: title.slice(0, 200), body: cuerpo, labels: ['frescura', 'bug'] };
};

/**
 * El issue de la otra mitad: el índice no se pudo leer varias veces seguidas.
 *
 * **Acá tampoco entra texto libre.** El `motivo` se reduce al vocabulario cerrado
 * de `MOTIVOS` —lo que no esté en la lista se imprime como `desconocido`— y la
 * `url` es la del `.env`, que está impresa en cada página del sitio. Con eso, la
 * promesa «al aviso solo pueden viajar conteos y valores de forma conocida» vale
 * para los **dos** avisos y no solo para el de arriba, que es lo que el
 * `auditor-privacidad` marcó: el `e.message` crudo del `fetch` era la única
 * interpolación que dependía de que nadie le agregara mañana el cuerpo de la
 * respuesta «para saber qué devolvió».
 *
 * El texto de verdad está en `sistema/frescura.lectura.detalle` y en el log.
 */
export const issueDeSinLectura = ({ seguidas, motivo, url }) => {
  const conocido = Object.values(MOTIVOS).includes(motivo) ? motivo : 'desconocido';
  return {
    title: `[frescura] El sitio no contesta: ${seguidas} lecturas fallidas seguidas`.slice(0, 200),
    body: [
      '> Abierto automáticamente por `verificarFrescuraDelSitio` (B-882).',
      '',
      `El chequeo no pudo leer \`${url}\` en las últimas **${seguidas}** corridas.`,
      '',
      `Tipo de falla: \`${conocido}\`. El detalle está en \`sistema/frescura\` y en el log,`,
      'que no son públicos.',
      '',
      'Una lectura fallida suelta es un problema del chequeo y no se avisa. Varias seguidas',
      'ya no: significa que el índice que el listado del sitio necesita no está llegando, y',
      'sin él la home no puede filtrar nada.',
      '',
      '---',
      'Se cierra a mano: el chequeo no cierra issues.',
    ].join('\n'),
    labels: ['frescura', 'bug'],
  };
};
