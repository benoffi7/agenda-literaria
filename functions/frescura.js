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
 * ── Lo que este chequeo NO ve, dicho de frente ────────────────────────────
 *
 * Una **edición** de una actividad que ya está listada: si cambia el título y el
 * slug no (el slug es inmutable después de publicar — trampa 10), los dos
 * conjuntos siguen siendo idénticos. Verlo pediría comparar el *contenido* de
 * cada entrada, o sea rederivar `toPublic`/`entradaDeIndice` adentro de una
 * Cloud Function: una segunda derivación de la proyección, que es la forma de
 * bug que `05-patrones.md` nombra («dos derivaciones de la misma idea se separan
 * sin que nada falle») y que terminaría avisando de sus propias diferencias.
 *
 * El conjunto de slugs es **la comparación más grande que no duplica ninguna
 * derivación**: de un lado `slug` y `estado` salen crudos del documento, del
 * otro `slug` sale crudo del JSON. Queda anotado como **B-883**.
 */

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
    return { ok: false, motivo: 'el cuerpo no es JSON' };
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, motivo: 'el JSON no es un objeto' };
  }
  if (!Array.isArray(datos.actividades)) {
    return { ok: false, motivo: 'el JSON no tiene la lista de actividades' };
  }
  const slugs = [];
  // `{ slug: id }` para poder ir a buscar el documento de un sobrante: es el
  // único caso en el que hace falta una lectura más, y solo se paga cuando hay
  // un sobrante (que es casi nunca).
  const idPorSlug = {};
  for (const a of datos.actividades) {
    const slug = typeof a?.slug === 'string' ? a.slug : '';
    // Una entrada sin slug no es una actividad del índice: el slug es la URL.
    if (!slug) return { ok: false, motivo: 'hay una actividad sin slug en el índice' };
    slugs.push(slug);
    if (typeof a?.id === 'string' && a.id) idPorSlug[slug] = a.id;
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
 */
export const fechar = (slugs, fechas = {}, vistas = {}, ahora = Date.now()) =>
  slugs.map((slug) => {
    const porDocumento = Number(fechas?.[slug]);
    if (Number.isFinite(porDocumento)) {
      return { slug, desdeMs: porDocumento, reloj: 'documento' };
    }
    const porVista = Number(vistas?.[slug]);
    if (Number.isFinite(porVista)) return { slug, desdeMs: porVista, reloj: 'primera-vez' };
    return { slug, desdeMs: ahora, reloj: 'primera-vez' };
  });

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
 */
export const compararFrescura = ({
  faltan = [],
  sobran = [],
  publicadas = 0,
  enElIndice = 0,
  generadoEn = null,
  ahora = Date.now(),
  toleranciaMs = TOLERANCIA_MS,
}) => {
  const conEdad = (items, lado) =>
    items.map((i) => ({ slug: i.slug, lado, edadMs: ahora - i.desdeMs, reloj: i.reloj }));

  const todas = [...conEdad(faltan, 'falta'), ...conEdad(sobran, 'sobra')];
  const vencidas = todas.filter((d) => d.edadMs > toleranciaMs);
  const enVuelo = todas.filter((d) => d.edadMs <= toleranciaMs);

  // El reloj de cada divergencia se persiste para la próxima corrida, y **solo
  // el de las que siguen divergiendo**: así el registro se limpia solo y no se
  // convierte en un cementerio de slugs que ya se arreglaron.
  const vistas = Object.fromEntries([...faltan, ...sobran].map((i) => [i.slug, i.desdeMs]));

  return {
    estado: vencidas.length ? 'atrasado' : enVuelo.length ? 'en-vuelo' : 'fresco',
    faltan: vencidas.filter((d) => d.lado === 'falta'),
    sobran: vencidas.filter((d) => d.lado === 'sobra'),
    enVuelo: enVuelo.length,
    peorEdadMs: vencidas.reduce((m, d) => Math.max(m, d.edadMs), 0),
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
 */
export const registrarFalloDeLectura = ({ previo = null, motivo, ahora = Date.now() }) => {
  const fallas = Number(previo?.lectura?.fallas);
  const seguidas = (Number.isFinite(fallas) && fallas > 0 ? fallas : 0) + 1;
  return {
    estado: 'sin-lectura',
    lectura: { ok: false, motivo: String(motivo ?? 'sin motivo').slice(0, 300), fallas: seguidas },
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
 * **Sobre el repo público (§5.1).** Lo único que sale de acá son slugs, y los
 * slugs ya son públicos en los dos lados de la comparación: el que falta está
 * `publicado` en Firestore (o sea que su URL está por existir) y el que sobra ya
 * está servido en el `events.json`. No sale ni el título, ni el id, ni nada del
 * documento — y `slugImprimible` lo garantiza por forma, no por disciplina.
 */
export const issueDeAtraso = (veredicto) => {
  const total = veredicto.faltan.length + veredicto.sobran.length;
  const title =
    `[frescura] El sitio quedó atrasado: ${total} ` +
    `${total === 1 ? 'actividad no coincide' : 'actividades no coinciden'} con lo publicado`;

  const cuerpo = [
    `> Abierto automáticamente por \`verificarFrescuraDelSitio\` (B-882).`,
    `> Compara lo publicado en Firestore contra el \`events.json\` que sirve el sitio.`,
    '',
    `La diferencia más vieja tiene **${minutos(veredicto.peorEdadMs)} minutos** y la ventana ` +
      `normal es de ${minutos(veredicto.toleranciaMs)} (debounce + build + propagación, ` +
      '`functions/frescura.js`). O sea que esto ya no se explica por un build en curso.',
    '',
    veredicto.faltan.length
      ? `### Publicadas que el sitio no muestra (${veredicto.faltan.length})\n\n${lista(veredicto.faltan)}\n`
      : '',
    veredicto.sobran.length
      ? `### El sitio muestra y ya no está publicado (${veredicto.sobran.length})\n\n${lista(veredicto.sobran)}\n`
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

/** El issue de la otra mitad: el índice no se pudo leer varias veces seguidas. */
export const issueDeSinLectura = ({ seguidas, motivo, url }) => ({
  title: `[frescura] El sitio no contesta: ${seguidas} lecturas fallidas seguidas`,
  body: [
    '> Abierto automáticamente por `verificarFrescuraDelSitio` (B-882).',
    '',
    `El chequeo no pudo leer \`${url}\` en las últimas **${seguidas}** corridas.`,
    '',
    `Último motivo: \`${String(motivo ?? '').replace(/`/g, "'").slice(0, 300)}\``,
    '',
    'Una lectura fallida suelta es un problema del chequeo y no se avisa. Varias seguidas',
    'ya no: significa que el índice que el listado del sitio necesita no está llegando, y',
    'sin él la home no puede filtrar nada.',
    '',
    '---',
    'Se cierra a mano: el chequeo no cierra issues.',
  ].join('\n'),
  labels: ['frescura', 'bug'],
});
