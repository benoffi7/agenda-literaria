/**
 * La lectura de la analítica del sitio público — **B-374** (GA4) y **B-373**
 * (Search Console). Arquitectura en `docs/16-analitica-del-sitio.md` §9.
 *
 * **Esto es la mitad pura**, el mismo corte que `reportes.js` / `reportes-trigger.js`
 * y `calendario.js` / `index.js`: acá se arman los pedidos y se le da forma a
 * las respuestas, y no hay una sola llamada de red, ni Firestore, ni
 * credenciales. El efecto vive en `analitica-trigger.js`.
 *
 * El corte pesa más acá que en otros archivos, y el §9.1 del diseño ya lo había
 * anotado como el costo principal de este ítem: **GA4 no tiene emulador.** No
 * hay forma de probar el camino de lectura contra algo que se parezca a la API,
 * así que lo único testeable de verdad es esto: que dado un cuerpo de respuesta
 * con la forma que la API documenta, el resumen que sale es el correcto. Lo que
 * estos tests **no** prueban es que la API devuelva esa forma. Es la clase de
 * test que da verde el día que el contrato cambia, y por eso el trigger loguea
 * la respuesta cruda cuando no la puede interpretar en vez de escribir ceros.
 *
 * ── Las dos fuentes, y por qué son dos y no una ────────────────────────────
 *
 * | | GA4 (Data API v1beta) | Search Console (API v1) |
 * |---|---|---|
 * | Qué contesta | cuánta gente entra, qué mira, de dónde viene, qué toca | con qué se busca en Google y qué páginas rankean |
 * | Preguntas del §3 | 1, 2, 3, 4 y —con los eventos propios— 5, 6 | **7**, la que justifica el proyecto (§2.3 del `CLAUDE.md`) |
 * | Necesita el tag | sí | **no** — ni JavaScript ni cookies |
 * | Latencia de sus datos | 24 a 48 h | **2 a 3 días** |
 * | Empezó a acumular | 2026-09-03 (el tag) | 2026-09-03 (el dominio conectado) |
 *
 * Las dos empezaron el mismo día y **ninguna mide para atrás**, así que un
 * resumen de 28 días recién dice algo a fin de septiembre. Eso no es un
 * problema de este módulo: es lo que la pantalla tiene que decir en vez de
 * mostrar un cero (§8.1bis, D-272).
 */

/**
 * La zona del proyecto (§14 del `CLAUDE.md`).
 *
 * **No es decorativa acá.** GA4 interpreta un `startDate`/`endDate` explícito
 * en la zona de la **propiedad**, no en UTC, así que las ventanas se calculan
 * en esta zona para que los dos lados hablen del mismo día. Que la propiedad
 * esté configurada en esta zona es un paso de consola y está en el runbook de
 * `docs/16-analitica-del-sitio.md` (§9.4, paso 5): si no coincide, los números
 * no fallan — se corren un día, que es la trampa 1 del §13 con otra cara.
 */
export const ZONA = 'America/Argentina/Buenos_Aires';

/** Cuántos días mira el resumen, y contra cuántos se compara. */
export const DIAS_DE_VENTANA = 28;

/**
 * Días que se descuentan del final de la ventana, por fuente.
 *
 * No es prudencia: es la latencia documentada de cada API. Pedirle a Search
 * Console los últimos dos días devuelve filas vacías o incompletas, y una
 * ventana que incluye días sin datos **baja el promedio** — el número queda
 * mal sin que nada falle.
 */
export const RETRASO = { ga4: 1, searchConsole: 3 };

/**
 * Los dos motivos que esta Function produce **sin llamar a nadie**: falta un
 * identificador en `functions/.env`.
 *
 * Están acá —en el módulo puro, que es el que los tests importan— y no escritos
 * a mano en el trigger, y el motivo es la clase de bug de B-88: el consumidor
 * (`src/lib/resumenDelSitio.ts`) distingue «falta un paso de consola» de «la API
 * dijo no» **reconociendo esta frase**, y los dos paquetes no se importan entre
 * sí. Con los literales sueltos, reformular el mensaje —agregarle detalle,
 * cambiar el orden de las palabras— degradaba en silencio el diagnóstico de la
 * pantalla: de «cargá esta variable» a «mirá un log».
 *
 * `MARCA_SIN_CONFIGURAR` es la parte que el consumidor busca, y está acá para
 * que el test pueda verificar que **los dos motivos la contienen** en vez de
 * comparar dos copias congeladas. Lo encontró el `auditor-trampas`.
 */
export const MARCA_SIN_CONFIGURAR = 'sin configurar';

export const MOTIVOS_SIN_CONFIGURAR = {
  ga4: `GA4_PROPERTY_ID ${MARCA_SIN_CONFIGURAR}`,
  searchConsole: `SEARCH_CONSOLE_SITE ${MARCA_SIN_CONFIGURAR}`,
};

/** `YYYY-MM-DD` de un `Date`, en la zona del proyecto. */
export const claveDeDia = (fecha, zona = ZONA) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);

/**
 * Suma (o resta) días a una clave de día, sin tocar zonas.
 *
 * Se opera sobre la clave y no sobre el `Date`: sumarle 24 h a un instante
 * cruza mal el cambio de hora, y acá lo que se quiere es aritmética de
 * **calendario**, que en `Date.UTC` es exacta.
 */
export const sumarDias = (clave, dias) => {
  const [a, m, d] = clave.split('-').map(Number);
  const t = Date.UTC(a, m - 1, d) + dias * 86_400_000;
  const salida = new Date(t);
  return `${salida.getUTCFullYear()}-${String(salida.getUTCMonth() + 1).padStart(2, '0')}-${String(
    salida.getUTCDate(),
  ).padStart(2, '0')}`;
};

/**
 * Las dos ventanas de 28 días: la de ahora y la anterior, pegadas y sin
 * solaparse.
 *
 * **28 y no «este mes»**, y el motivo está en el §9.3 del diseño: son cuatro
 * semanas exactas, así que no mezcla meses de 30 y 31 días ni cambia el peso de
 * los fines de semana entre una ventana y la otra. Un mes calendario contra el
 * anterior compara cinco sábados contra cuatro.
 */
export const ventanas = (ahora, retraso) => {
  const hasta = sumarDias(claveDeDia(ahora), -retraso);
  const desde = sumarDias(hasta, -(DIAS_DE_VENTANA - 1));
  const hastaAnterior = sumarDias(desde, -1);
  const desdeAnterior = sumarDias(hastaAnterior, -(DIAS_DE_VENTANA - 1));
  return {
    actual: { desde, hasta },
    anterior: { desde: desdeAnterior, hasta: hastaAnterior },
  };
};

// ─────────────────────────────────────────────────────────────────
// Los pedidos a GA4
// ─────────────────────────────────────────────────────────────────

/**
 * Los eventos propios del sitio que este resumen sabe leer — la mitad **b**.
 *
 * **Copiada de `src/lib/analyticsSitio.ts` a propósito**, igual que
 * `EJES_MEDIBLES` está copiado allá: `functions/` es otro paquete, con su
 * `package.json` y su deploy, y no importa nada de `src/`. La red que impide
 * que las dos listas se separen es un test —`tests/analitica-del-sitio.test.ts`
 * lee `NOMBRES_EVENTOS_SITIO` del módulo del sitio y falla si difieren—, que es
 * el mismo patrón con el que este repo ata `functions/` a `src/` en todos
 * lados.
 */
export const EVENTOS_PROPIOS = ['clic_inscripcion', 'filtro_sin_resultados', 'clic_triptico'];

/** Cuántas filas se piden de un ranking. Diez es lo que el §9.3 decide mostrar. */
export const TOPE_DE_RANKING = 10;

/**
 * Las **únicas** dimensiones que este módulo le puede pedir a la Data API.
 *
 * ── Por qué es una lista blanca y no cinco strings sueltos ─────────────────
 * Lo encontró el `auditor-privacidad`, y es el invariante del §5.3 de
 * `docs/16-analitica-del-sitio.md` visto **del lado que lee**, que hasta acá no
 * estaba protegido por nada. Del lado que emite sí lo está: `ubicacionSinQuery`
 * recorta la query del `page_location` y del `page_referrer` (D-253), porque el
 * texto que alguien tipeó en el buscador viaja en `?q=…` (`aQuery` de
 * `listadoPublico.ts`).
 *
 * **`pagePath` no lleva la query; `pagePathPlusQueryString` sí.** Es una palabra
 * de diferencia, y con la otra el ranking de páginas del panel mostraría
 * `?q=<lo que alguien tipeó>`. El mismo descuido deja entrar `city`, `region`,
 * `userAgeBracket`, `userGender` o `pageLocation`: son todas un
 * `dimensions: [{ name: … }]` y ninguna verificación de forma las nota.
 *
 * Así que las dimensiones se declaran acá, `dimension()` es el único camino
 * para emitir una, y `tests/analitica-del-sitio.test.ts` compara el conjunto
 * exacto que sale de los seis informes contra esta lista. Agregar una dimensión
 * es agregarla acá **y** al test — que es donde alguien la va a mirar dos veces.
 *
 * Las cinco son **agregados sin persona**: una ruta pública, un nombre de canal,
 * una categoría de aparato, el nombre de un evento propio y una fecha.
 */
export const DIMENSIONES_PERMITIDAS = [
  'pagePath',
  'sessionDefaultChannelGroup',
  'deviceCategory',
  'eventName',
  'date',
];

/**
 * Una dimensión, o se corta.
 *
 * Tirar y no filtrar en silencio: una dimensión mal escrita tiene que ser un
 * informe que no sale, no un informe que sale sin esa columna y un ranking que
 * queda vacío sin decir por qué. El trigger atrapa la excepción y la mitad
 * queda en `estado: 'falla'` con el motivo, que es exactamente lo que la
 * pantalla sabe explicar.
 */
export const dimension = (nombre) => {
  if (!DIMENSIONES_PERMITIDAS.includes(nombre)) {
    throw new Error(
      `dimensión de GA4 no permitida: ${nombre}. Las permitidas están en ` +
        'DIMENSIONES_PERMITIDAS (functions/analitica.js) y son agregados sin persona: ' +
        'agregar una es una decisión, no un detalle.',
    );
  }
  return { name: nombre };
};

/**
 * Los cinco `runReport` de una ventana, en la forma que documenta la Data API
 * v1beta (`properties/{id}:runReport`).
 *
 * **Cinco pedidos chicos y no uno grande con todas las dimensiones cruzadas**:
 * un informe con `pagePath` × `deviceCategory` × canal devuelve el producto de
 * las tres y hay que volver a agregarlo de este lado, que es exactamente el
 * lugar donde se equivocan los números. Cada pedido contesta una fila del
 * §9.3 y nada más.
 *
 * **Y una ventana por llamada, sin usar los dos `dateRanges` de la API.** GA4
 * acepta dos rangos en un informe, pero entonces agrega por su cuenta una
 * dimensión `dateRange` y las filas se duplican con un valor extra; parsear eso
 * bien es más código y más frágil que pedir dos veces. La cuota de la Data API
 * se cuenta en tokens por propiedad y por día, y esto corre una vez al día:
 * diez informes chicos no la mueven.
 */
export const pedidosGa4 = (ventana) => {
  const dateRanges = [{ startDate: ventana.desde, endDate: ventana.hasta }];
  return {
    totales: {
      dateRanges,
      /*
       * **Seis métricas y ninguna dimensión** — B-800. Las tres primeras son las
       * de B-374; las tres nuevas las pidió el dueño («sumarle más cosas con lo
       * que nos de google»).
       *
       * Que sean **métricas** y no dimensiones es lo que hace que agregarlas sea
       * barato: una métrica es un agregado —un número sobre la ventana entera— y
       * no puede traer contenido de nadie. Por eso `DIMENSIONES_PERMITIDAS`
       * existe con su lista blanca y acá no hace falta una: el riesgo que esa
       * lista cuida —`pageLocation` con el `?q=` de lo que alguien tipeó, la
       * demografía— vive del lado de las dimensiones.
       *
       * Y las tres entran en **este mismo informe** y no en uno nuevo: el pedido
       * ya se ejecuta dos veces (ventana actual y anterior), así que la variación
       * de las tres sale gratis y no hay un round trip más.
       */
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        // Cuánta de esa gente entra por primera vez. Contesta «¿crece la
        // audiencia o son los mismos volviendo?», que es otra pregunta.
        { name: 'newUsers' },
        // Segundos promedio por sesión. Se formatea en el panel, no acá.
        { name: 'averageSessionDuration' },
        // 0..1 — la proporción de sesiones «con interacción» (GA4 reemplazó el
        // rebote por esto). El panel lo muestra como porcentaje.
        { name: 'engagementRate' },
      ],
    },
    paginas: {
      dateRanges,
      dimensions: [dimension('pagePath')],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: TOPE_DE_RANKING,
    },
    canales: {
      dateRanges,
      dimensions: [dimension('sessionDefaultChannelGroup')],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: TOPE_DE_RANKING,
    },
    dispositivos: {
      dateRanges,
      dimensions: [dimension('deviceCategory')],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    },
    /*
     * Los eventos propios, **filtrados por nombre y no todos los eventos**: sin
     * el filtro la respuesta trae también los automáticos de GA4
     * (`page_view`, `session_start`, `user_engagement`, `scroll`…) y el ranking
     * quedaría encabezado por ellos, que no contestan ninguna pregunta del §4.
     */
    eventos: {
      dateRanges,
      dimensions: [dimension('eventName')],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: EVENTOS_PROPIOS },
        },
      },
    },
  };
};

/**
 * El informe que contesta «¿desde cuándo hay datos?».
 *
 * **Es la línea que hace creíbles a las demás** (§9.3, última fila): «12.000
 * visitas» sin decir que la medición arrancó hace seis semanas es un número que
 * se cae en la primera pregunta.
 *
 * Se pide el primer día **con sesiones** del último año, ordenado ascendente y
 * con `limit: 1`. La limitación, escrita para que nadie la descubra después: si
 * la propiedad tuviera más de un año de historia, esto diría «hace un año» y no
 * la fecha real. Para esta propiedad —creada el 2026-09-03— es exacto, y el día
 * que deje de serlo el número seguirá siendo cierto como cota.
 */
export const pedidoPrimerDia = (ahora) => ({
  dateRanges: [{ startDate: sumarDias(claveDeDia(ahora), -365), endDate: claveDeDia(ahora) }],
  dimensions: [dimension('date')],
  metrics: [{ name: 'sessions' }],
  orderBys: [{ dimension: { dimensionName: 'date' } }],
  limit: 1,
});

// ─────────────────────────────────────────────────────────────────
// Las respuestas de GA4
// ─────────────────────────────────────────────────────────────────

/**
 * Un número de una respuesta de la Data API.
 *
 * **Las métricas vienen como string, siempre** —`"123"`, y las de tipo `FLOAT`
 * como `"0.4166"`—, así que sumarlas sin convertir concatena. Es el bug de una
 * línea que produce «1231» visitas y no falla nada.
 *
 * Un valor ausente, vacío o no numérico da `0` y no `NaN`: un `NaN` se propaga
 * a la variación, sale del `JSON.stringify` como `null` y llega a la pantalla
 * como un hueco sin explicación.
 */
export const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/** Las métricas de la primera fila de un informe sin dimensiones. */
const metricasDeLaFila = (respuesta, cuantas) => {
  const fila = respuesta?.rows?.[0];
  const valores = fila?.metricValues ?? [];
  return Array.from({ length: cuantas }, (_, i) => numero(valores[i]?.value));
};

/**
 * Un ranking `[{ clave, valor }]` de un informe de una dimensión y una métrica.
 *
 * Sin `rows` devuelve `[]` y no `null`: «no hubo ninguna visita» y «la API no
 * contestó» son dos cosas distintas, y la segunda la decide el trigger al no
 * escribir el documento — acá una respuesta válida y vacía es `[]`.
 */
export const ranking = (respuesta) =>
  (respuesta?.rows ?? []).map((fila) => ({
    clave: fila?.dimensionValues?.[0]?.value ?? '(sin dato)',
    valor: numero(fila?.metricValues?.[0]?.value),
  }));

/**
 * La variación entre dos números, en porcentaje redondeado.
 *
 * `null` cuando la ventana anterior fue **cero**, y esto importa: dividir por
 * cero da `Infinity`, y presentar «+∞ %» o «+100 %» sobre una base de cero es
 * el número que un anunciante pincha primero. Con `null` la pantalla dice «sin
 * comparación» — que es la verdad durante el primer mes de medición, cuando la
 * ventana anterior es exactamente cero.
 */
export const variacion = (actual, anterior) => {
  if (!Number.isFinite(actual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
};

/** `20260903` (la dimensión `date` de GA4) → `2026-09-03`. */
export const fechaDeGa4 = (valor) =>
  /^\d{8}$/.test(valor ?? '') ? `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6)}` : null;

/**
 * El resumen de GA4: las cuatro filas de la mitad **a** más los eventos propios
 * de la mitad **b**, con la variación contra la ventana anterior.
 *
 * `actual` y `anterior` son los objetos que devuelve `pedidosGa4` ejecutados,
 * o sea `{ totales, paginas, canales, dispositivos, eventos }` con la respuesta
 * cruda de cada uno. `primerDia` es la respuesta de `pedidoPrimerDia`.
 */
export const resumenGa4 = ({ actual, anterior, primerDia, ventana }) => {
  const [sesiones, personas, vistas, nuevos, duracion, enganche] = metricasDeLaFila(
    actual?.totales,
    6,
  );
  const [sesionesAntes, personasAntes, vistasAntes, nuevosAntes, duracionAntes, engancheAntes] =
    metricasDeLaFila(anterior?.totales, 6);

  return {
    ventana,
    /*
     * `hayDatos` decide si la pantalla muestra números o el estado vacío
     * honesto de D-272, y **no se deriva de que la API haya contestado**: una
     * propiedad recién creada contesta perfecto y devuelve cero. Un tablero que
     * muestre «0 visitas» durante tres semanas parece roto; el estado vacío
     * dice por qué está vacío.
     */
    hayDatos: sesiones > 0 || vistas > 0,
    desdeCuando: fechaDeGa4(primerDia?.rows?.[0]?.dimensionValues?.[0]?.value),
    sesiones: { valor: sesiones, variacion: variacion(sesiones, sesionesAntes) },
    personas: { valor: personas, variacion: variacion(personas, personasAntes) },
    vistas: { valor: vistas, variacion: variacion(vistas, vistasAntes) },
    nuevos: { valor: nuevos, variacion: variacion(nuevos, nuevosAntes) },
    /*
     * Los dos de abajo **no son enteros** y por eso el `valor` viaja crudo: los
     * segundos con sus decimales y el enganche como 0..1. Formatearlos acá sería
     * decidir en la Function cómo se ven en la pantalla, y esa decisión vive del
     * lado del panel —igual que `variacionLegible`—.
     *
     * La variación sí se calcula acá, y para el enganche es **la variación de la
     * tasa en porcentaje**, no en puntos porcentuales: pasar de 0,50 a 0,55 da
     * «+10 %» y no «+5 puntos». Es una decisión y está escrita porque las dos
     * lecturas son legítimas; se eligió el porcentaje porque es lo que hace la
     * misma `variacion()` que las otras cinco, y una segunda forma de variar
     * sería un segundo formato que explicar.
     */
    duracion: { valor: duracion, variacion: variacion(duracion, duracionAntes) },
    enganche: { valor: enganche, variacion: variacion(enganche, engancheAntes) },
    paginas: ranking(actual?.paginas),
    canales: ranking(actual?.canales),
    dispositivos: ranking(actual?.dispositivos),
    /*
     * Los eventos propios salen como un mapa `nombre → cuenta` y **con las tres
     * claves siempre**, incluso en cero. Sin eso, un evento que todavía no
     * ocurrió desaparece de la respuesta de GA4 y la pantalla no puede
     * distinguir «cero clics de inscripción» de «este evento no existe»: la
     * primera es un dato y la segunda es un bug del enganche.
     */
    eventos: Object.fromEntries(
      EVENTOS_PROPIOS.map((nombre) => [
        nombre,
        ranking(actual?.eventos).find((f) => f.clave === nombre)?.valor ?? 0,
      ]),
    ),
  };
};

// ─────────────────────────────────────────────────────────────────
// Search Console (B-373)
// ─────────────────────────────────────────────────────────────────

/**
 * Las **únicas** dimensiones de Search Console que se piden, por el mismo
 * motivo que `DIMENSIONES_PERMITIDAS` — y con una diferencia que importa: esta
 * API tiene `country` y `device`, que suenan a agregados inocuos, y **no** las
 * pedimos igual, porque `country` sobre un puñado de consultas de un sitio
 * chico deja de ser un agregado. Lo que se necesita para la pregunta 7 son
 * estas dos.
 */
export const DIMENSIONES_SC_PERMITIDAS = ['query', 'page'];

/**
 * Una dimensión de Search Console, o se corta.
 *
 * **De módulo y no local a `pedidosSearchConsole`**, igual que `dimension()`
 * para GA4: local, un segundo constructor de pedidos podría no pasar por la
 * lista y nadie lo notaría. Lo señaló el `auditor-privacidad` — la asimetría
 * entre los dos guardas era la puerta.
 */
export const dimensionSc = (nombre) => {
  if (!DIMENSIONES_SC_PERMITIDAS.includes(nombre)) {
    throw new Error(
      `dimensión de Search Console no permitida: ${nombre}. Las permitidas están en ` +
        'DIMENSIONES_SC_PERMITIDAS (functions/analitica.js).',
    );
  }
  return [nombre];
};

/**
 * Los dos pedidos a `sites/{siteUrl}/searchAnalytics/query`.
 *
 * `type: 'web'` deja afuera imágenes y video, que en este sitio no aportan y
 * mezclarían posiciones de dos índices distintos en el mismo promedio.
 */
export const pedidosSearchConsole = (ventana) => {
  const base = {
    startDate: ventana.desde,
    endDate: ventana.hasta,
    rowLimit: TOPE_DE_RANKING,
    type: 'web',
  };
  const dim = dimensionSc;
  return {
    /** Con qué busca la gente que llega — la pregunta 7 del §3. */
    busquedas: { ...base, dimensions: dim('query') },
    /** Qué páginas rankean: dónde el trabajo de SEO de B-109 rindió. */
    paginas: { ...base, dimensions: dim('page') },
  };
};

/**
 * Una fila de Search Console. Los cuatro campos vienen ya numéricos (a
 * diferencia de GA4), pero se pasan por `numero` igual: una fila sin `clicks`
 * —que la API omite cuando es cero— daría `undefined` y de ahí a `NaN`.
 *
 * `ctr` viene como fracción (`0.0416`) y se guarda **como fracción**: el
 * formateo a porcentaje es de la pantalla, no de los datos. `posicion` se
 * redondea a un decimal porque la API devuelve doce y ninguno significa nada.
 */
const filaDeBusqueda = (fila) => ({
  clave: fila?.keys?.[0] ?? '(sin dato)',
  clics: numero(fila?.clicks),
  impresiones: numero(fila?.impressions),
  ctr: numero(fila?.ctr),
  posicion: Math.round(numero(fila?.position) * 10) / 10,
});

export const resumenSearchConsole = ({ busquedas, paginas, ventana }) => {
  const filasBusquedas = (busquedas?.rows ?? []).map(filaDeBusqueda);
  const filasPaginas = (paginas?.rows ?? []).map(filaDeBusqueda);
  return {
    ventana,
    hayDatos: filasBusquedas.length > 0 || filasPaginas.length > 0,
    /*
     * Los totales se suman de las filas y **no se piden aparte**, que sería un
     * tercer round trip. Ojo con lo que esto significa: son los totales **del
     * top 10**, no del sitio entero, y por eso el campo dice `enElTope`. Un
     * total del sitio presentado como si lo fuera, cuando en realidad es la
     * suma de diez filas, es la clase de número que se cae en la primera
     * pregunta — el mismo cuidado que el §9.3 pide para la fuente de cada dato.
     */
    clicsEnElTope: filasBusquedas.reduce((s, f) => s + f.clics, 0),
    impresionesEnElTope: filasBusquedas.reduce((s, f) => s + f.impresiones, 0),
    busquedas: filasBusquedas,
    paginas: filasPaginas,
  };
};

// ─────────────────────────────────────────────────────────────────
// El documento que se guarda
// ─────────────────────────────────────────────────────────────────

/**
 * Qué versión de esta forma escribió el documento.
 *
 * La pantalla lee un documento que escribió un deploy anterior, y esa es la
 * clase de bug de B-580: un campo que se agrega después deja los documentos
 * viejos sin él, y la pantalla lo lee como `undefined`. Con la versión, la
 * pantalla puede decir «este resumen es de una versión anterior» en vez de
 * dibujar huecos.
 */
export const VERSION_DEL_RESUMEN = 1;

/**
 * El documento de `sistema/analitica-sitio`.
 *
 * **Cada mitad lleva su propio `estado`, y no hay un estado global.** Las dos
 * APIs fallan por separado —una credencial, una cuota, una property mal
 * configurada— y un resumen a medias es más útil que ninguno: si GA4 contesta
 * y Search Console no, la pantalla muestra GA4 y dice qué le falta a la otra.
 * Un solo estado obligaría a tirar las dos.
 *
 * `motivo` es el mensaje del error y **nunca la respuesta cruda**: acá no hay
 * dato personal —son agregados de una API— pero el documento lo lee el panel y
 * volcarle el cuerpo de una respuesta de Google es la clase de fuga por la que
 * este repo tiene un `auditor-privacidad`. La respuesta cruda va al log de la
 * Function, que no es una salida.
 *
 * **Y el recorte va acá, del lado que ESCRIBE.** Lo señaló el
 * `auditor-privacidad`: el docblock afirmaba «nunca la respuesta cruda» y lo
 * único que lo sostenía era `e.message`, cuya forma la decide `googleapis`, no
 * este repo — con un cuerpo de error inesperado ese `message` puede arrastrar
 * el cuerpo o el `statusText` del intermediario. El tope estaba solo en el
 * lector del panel, o sea **después** de persistir. Y hay una consecuencia que
 * no es de privacidad y muerde igual: un string enorme puede hacer fallar el
 * `set()` entero justo el día en que algo anda mal, y el documento se queda con
 * los números de ayer sin decirlo. El lector mantiene su propio tope como
 * defensa en profundidad, no como única defensa.
 */
export const MAX_MOTIVO = 200;

const motivoRecortado = (motivo) => {
  const t = typeof motivo === 'string' ? motivo.trim() : '';
  if (t === '') return 'sin motivo';
  return t.length <= MAX_MOTIVO ? t : `${t.slice(0, MAX_MOTIVO - 1)}…`;
};

export const documentoDeAnalitica = ({ ga4, searchConsole, generadoEn }) => ({
  version: VERSION_DEL_RESUMEN,
  generadoEn,
  zona: ZONA,
  ga4: ga4.ok
    ? { estado: 'ok', ...ga4.resumen }
    : { estado: 'falla', motivo: motivoRecortado(ga4.motivo) },
  searchConsole: searchConsole.ok
    ? { estado: 'ok', ...searchConsole.resumen }
    : { estado: 'falla', motivo: motivoRecortado(searchConsole.motivo) },
});

/**
 * Las claves que cada mitad del documento puede tener, **exactamente**.
 *
 * No es documentación: es lo que `tests/analitica-del-sitio.test.ts` compara.
 * `documentoDeAnalitica` esparce el resumen (`...ga4.resumen`), así que la
 * frontera real no es esa función —que solo copia— sino `resumenGa4` y
 * `resumenSearchConsole`. Hoy las dos son whitelist por construcción, porque
 * devuelven objetos escritos campo por campo; pero un
 * `return { ...respuesta, sesiones: … }` puesto adentro para «tener a mano un
 * dato que falta» pasaría toda la suite en verde y publicaría la respuesta de
 * la Data API entera al documento que lee el panel. Es la regla del protocolo
 * de este repo: un spread en una proyección es hallazgo aunque hoy no filtre.
 * Lo pidió el `auditor-privacidad`.
 */
export const CLAVES_DEL_RESUMEN = {
  ga4Ok: [
    'estado',
    'ventana',
    'hayDatos',
    'desdeCuando',
    'sesiones',
    'personas',
    'vistas',
    // B-800 — las tres que pidió el dueño. Van acá **a mano y una por una**,
    // que es el punto de esta lista: agregar una clave al documento que lee el
    // panel es una decisión, y el test de claves exactas la pide explícita.
    'nuevos',
    'duracion',
    'enganche',
    'paginas',
    'canales',
    'dispositivos',
    'eventos',
  ],
  searchConsoleOk: [
    'estado',
    'ventana',
    'hayDatos',
    'clicsEnElTope',
    'impresionesEnElTope',
    'busquedas',
    'paginas',
  ],
  falla: ['estado', 'motivo'],
};
