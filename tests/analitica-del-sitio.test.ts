import { describe, expect, it } from 'vitest';
// La Function es JS plano; TS le infiere los tipos con allowJs.
import {
  CLAVES_DEL_RESUMEN,
  DIAS_DE_VENTANA,
  DIMENSIONES_PERMITIDAS,
  DIMENSIONES_SC_PERMITIDAS,
  EVENTOS_PROPIOS,
  MAX_MOTIVO,
  RETRASO,
  TOPE_DE_RANKING,
  VERSION_DEL_RESUMEN,
  ZONA,
  claveDeDia,
  dimension,
  dimensionSc,
  documentoDeAnalitica,
  fechaDeGa4,
  numero,
  pedidoPrimerDia,
  RUTA_DEL_PANEL,
  pedidosGa4,
  pedidosSearchConsole,
  ranking,
  resumenGa4,
  resumenSearchConsole,
  sumarDias,
  variacion,
  ventanas,
} from '../functions/analitica.js';
import { NOMBRES_EVENTOS_SITIO } from '@/lib/analyticsSitio';

/**
 * La lectura de la analítica del sitio — **B-374** (GA4) y **B-373** (Search
 * Console), `functions/analitica.js`.
 *
 * ── Qué prueba este archivo, y qué NO ──────────────────────────────────────
 *
 * **GA4 no tiene emulador**, y Search Console tampoco. El §9.1 del diseño lo
 * anotó como el costo principal de este ítem y conviene repetirlo acá, en el
 * archivo que podría dar la impresión contraria:
 *
 * > los tests dicen que el nuestro parsea bien lo que **suponemos** que
 * > devuelve la API, no que la API devuelva eso.
 *
 * Los fixtures de abajo están escritos con la forma que documentan las dos
 * APIs —`runReport` v1beta y `searchAnalytics/query` v1—, con los detalles que
 * de verdad rompen cosas: las métricas de GA4 vienen como **string**, la
 * dimensión `date` viene como `20260903`, el `ctr` de Search Console viene como
 * fracción, y las filas en cero **no vienen**. Si el contrato cambia, este
 * archivo sigue en verde: lo que lo va a decir es el log del trigger, que
 * guarda la respuesta cruda cuando no la puede interpretar.
 *
 * Lo que sí queda fijado, y es lo que importa de un módulo puro: las ventanas,
 * la variación (incluido el cero que da `null` y no infinito), el orden de los
 * rankings, y que un evento propio que todavía no ocurrió salga en cero y no
 * ausente.
 */

// ─────────────────────────────────────────────────────────────────────
// Fixtures — la forma real de cada respuesta
// ─────────────────────────────────────────────────────────────────────

/** Un informe sin dimensiones: una fila con N métricas, todas string. */
/**
 * La respuesta de `totales`, con la forma real de la Data API.
 *
 * **Las tres últimas métricas tienen default** (B-800): así los treinta casos que
 * ya existían siguen pasando tres argumentos y este helper no obliga a reescribir
 * ninguno. Los defaults son valores plausibles y no ceros, para que un caso que
 * no las nombra no afirme sin querer que la gente nueva es cero.
 *
 * Y **vienen como string, con decimales en dos de ellas**, porque así las manda
 * GA4: `averageSessionDuration` en segundos con coma y `engagementRate` entre 0 y
 * 1. Un fixture con enteros redondos habría dejado sin ejercitar el único lugar
 * donde eso importa —el formateo— y es justo donde estaba el riesgo.
 */
const totales = (
  sesiones: string,
  personas: string,
  vistas: string,
  nuevos = '180',
  duracion = '134.7',
  enganche = '0.6432',
) => ({
  metricHeaders: [
    { name: 'sessions', type: 'TYPE_INTEGER' },
    { name: 'activeUsers', type: 'TYPE_INTEGER' },
    { name: 'screenPageViews', type: 'TYPE_INTEGER' },
    { name: 'newUsers', type: 'TYPE_INTEGER' },
    { name: 'averageSessionDuration', type: 'TYPE_SECONDS' },
    { name: 'engagementRate', type: 'TYPE_FLOAT' },
  ],
  rows: [
    {
      metricValues: [
        { value: sesiones },
        { value: personas },
        { value: vistas },
        { value: nuevos },
        { value: duracion },
        { value: enganche },
      ],
    },
  ],
  rowCount: 1,
  metadata: { currencyCode: 'ARS', timeZone: 'America/Argentina/Buenos_Aires' },
  kind: 'analyticsData#runReport',
});

/** Un informe de una dimensión y una métrica. */
const conDimension = (dimension: string, metrica: string, filas: [string, string][]) => ({
  dimensionHeaders: [{ name: dimension }],
  metricHeaders: [{ name: metrica, type: 'TYPE_INTEGER' }],
  rows: filas.map(([clave, valor]) => ({
    dimensionValues: [{ value: clave }],
    metricValues: [{ value: valor }],
  })),
  rowCount: filas.length,
  kind: 'analyticsData#runReport',
});

/** Un informe vacío: GA4 **omite `rows` por completo**, no manda `rows: []`. */
const vacio = () => ({
  dimensionHeaders: [{ name: 'pagePath' }],
  metricHeaders: [{ name: 'screenPageViews', type: 'TYPE_INTEGER' }],
  rowCount: 0,
  kind: 'analyticsData#runReport',
});

const informesLlenos = () => ({
  totales: totales('412', '317', '1103'),
  paginas: conDimension('pagePath', 'screenPageViews', [
    ['/', '480'],
    ['/actividad/taller-de-cronica/', '221'],
    ['/cartelera/', '96'],
  ]),
  canales: conDimension('sessionDefaultChannelGroup', 'sessions', [
    ['Organic Search', '210'],
    ['Direct', '132'],
    ['Organic Social', '70'],
  ]),
  dispositivos: conDimension('deviceCategory', 'sessions', [
    ['mobile', '330'],
    ['desktop', '78'],
    ['tablet', '4'],
  ]),
  /*
   * **Dos de los tres eventos, no los tres.** GA4 no devuelve una fila para un
   * evento que no ocurrió, y ése es el caso real del primer mes: los eventos
   * están instalados y el volumen todavía no llegó. Es lo que el resumen tiene
   * que convertir en un cero explícito.
   */
  eventos: conDimension('eventName', 'eventCount', [
    ['clic_inscripcion', '37'],
    ['filtro_sin_resultados', '12'],
  ]),
});

const informesVacios = () => ({
  totales: totales('0', '0', '0'),
  paginas: vacio(),
  canales: vacio(),
  dispositivos: vacio(),
  eventos: vacio(),
});

const primerDia = (valor: string) => ({
  dimensionHeaders: [{ name: 'date' }],
  metricHeaders: [{ name: 'sessions', type: 'TYPE_INTEGER' }],
  rows: [{ dimensionValues: [{ value: valor }], metricValues: [{ value: '9' }] }],
  rowCount: 1,
});

// ─────────────────────────────────────────────────────────────────────
// 1 · Las ventanas
// ─────────────────────────────────────────────────────────────────────

describe('las ventanas de 28 días — §9.3', () => {
  it('la clave de día sale en la zona del proyecto y no en UTC', () => {
    /*
     * **El caso que importa y el único que puede fallar en silencio.** A las
     * 23:30 del 3 de septiembre en Buenos Aires ya es el 4 en UTC: con
     * `toISOString().slice(0,10)` la ventana se corre un día, los números
     * siguen saliendo y nadie lo nota. Es la trampa 1 del §13 con otra cara.
     */
    expect(claveDeDia(new Date('2026-09-04T02:30:00Z'))).toBe('2026-09-03');
    expect(new Date('2026-09-04T02:30:00Z').toISOString().slice(0, 10)).toBe('2026-09-04');
    expect(ZONA).toBe('America/Argentina/Buenos_Aires');
  });

  it('sumarDias hace aritmética de calendario, no de milisegundos', () => {
    expect(sumarDias('2026-09-03', -1)).toBe('2026-09-02');
    expect(sumarDias('2026-09-01', -1)).toBe('2026-08-31');
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
    // Bisiesto, que es donde una tabla de largos de mes escrita a mano falla.
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('las dos ventanas son de 28 días, pegadas y sin solaparse', () => {
    const v = ventanas(new Date('2026-10-15T15:00:00-03:00'), 1);
    // Retraso de 1: el último día es ayer, no hoy.
    expect(v.actual.hasta).toBe('2026-10-14');
    expect(v.actual.desde).toBe('2026-09-17');
    // Pegadas: el día anterior al `desde` de la actual es el `hasta` de la
    // anterior. Un día de hueco o un día repetido se ve acá y en ningún otro
    // lado — la variación quedaría comparando 27 contra 29 días.
    expect(v.anterior.hasta).toBe('2026-09-16');
    expect(v.anterior.desde).toBe('2026-08-20');
    // Y las dos miden lo mismo, contado y no asumido.
    const largo = (a: string, b: string) =>
      (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000 + 1;
    expect(largo(v.actual.desde, v.actual.hasta)).toBe(DIAS_DE_VENTANA);
    expect(largo(v.anterior.desde, v.anterior.hasta)).toBe(DIAS_DE_VENTANA);
  });

  it('el retraso de Search Console es mayor que el de GA4, y los dos son > 0', () => {
    // No es un detalle: una ventana que incluye días sin datos consolidados
    // baja el promedio y el número queda mal sin que nada falle.
    expect(RETRASO.ga4).toBeGreaterThan(0);
    expect(RETRASO.searchConsole).toBeGreaterThan(RETRASO.ga4);
    const v = ventanas(new Date('2026-10-15T15:00:00-03:00'), RETRASO.searchConsole);
    expect(v.actual.hasta).toBe('2026-10-12');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2 · Los pedidos
// ─────────────────────────────────────────────────────────────────────

describe('los pedidos a la Data API', () => {
  const v = { desde: '2026-09-17', hasta: '2026-10-14' };

  it('cada informe pide una sola ventana y una sola dimensión', () => {
    /*
     * La decisión del docblock, fijada: un informe por pregunta. Un
     * `pagePath` × `deviceCategory` devuelve el producto de los dos y hay que
     * volver a agregarlo de este lado, que es donde los números se rompen.
     */
    const p = pedidosGa4(v);
    for (const [nombre, pedido] of Object.entries(p)) {
      expect(pedido.dateRanges, nombre).toEqual([{ startDate: v.desde, endDate: v.hasta }]);
      expect((pedido as { dimensions?: unknown[] }).dimensions?.length ?? 0, nombre).toBeLessThan(
        2,
      );
    }
    expect(Object.keys(p).sort()).toEqual([
      'canales',
      'dispositivos',
      'eventos',
      'paginas',
      'totales',
    ]);
  });

  it('los rankings vienen ordenados por la API y topeados', () => {
    // Ordenar de este lado obliga a traer todas las filas: son 46 actividades
    // hoy, pero `pagePath` crece con el catálogo y la cuota no.
    const p = pedidosGa4(v);
    expect(p.paginas.orderBys).toEqual([
      { metric: { metricName: 'screenPageViews' }, desc: true },
    ]);
    expect(p.paginas.limit).toBe(TOPE_DE_RANKING);
    expect(p.canales.limit).toBe(TOPE_DE_RANKING);
    // Los dispositivos NO se topean: son tres valores fijos (`mobile`,
    // `desktop`, `tablet`) y un límite ahí sería ceremonia.
    expect((p.dispositivos as { limit?: number }).limit).toBeUndefined();
  });

  it('solo se le piden dimensiones de la lista blanca — nunca `pagePathPlusQueryString` ni una de persona', () => {
    /*
     * **El invariante del §5.3 del diseño, visto del lado que LEE.** Lo encontró
     * el `auditor-privacidad`: del lado que emite está protegido
     * (`ubicacionSinQuery` recorta la query del `page_location` y del
     * `page_referrer`, D-253), y del lado que lee no lo estaba por nada.
     *
     * `pagePath` no lleva la query; **`pagePathPlusQueryString` sí**. Una palabra
     * de diferencia, y el ranking de páginas del panel mostraría
     * `?q=<lo que alguien tipeó en el buscador>`. Y por la misma puerta entran
     * `city`, `region`, `userAgeBracket`, `userGender` o `pageLocation`: son
     * todas un `dimensions: [{ name: … }]` y ninguna verificación de forma las
     * distingue de las buenas.
     *
     * Se compara el conjunto **exacto** que sale de los seis informes contra la
     * lista blanca: ni una de más (una dimensión nueva sin decidir) ni una de
     * menos (una que se dejó de pedir y quedó en la lista sin que nadie lo
     * note).
     *
     * MUTACIÓN PROBADA: se cambió `dimension('pagePath')` por
     * `dimension('pagePathPlusQueryString')` en `functions/analitica.js`. El
     * módulo tira al armar el pedido, así que este caso pasó a rojo con el
     * nombre exacto de la dimensión en el mensaje — y el informe no sale, que es
     * el modo de falla que se quiere: no un ranking sin columna.
     */
    const pedidas = new Set<string>();
    for (const pedido of Object.values(pedidosGa4(v)) as { dimensions?: { name: string }[] }[]) {
      for (const d of pedido.dimensions ?? []) pedidas.add(d.name);
    }
    for (const d of pedidoPrimerDia(new Date('2026-10-15T15:00:00-03:00')).dimensions ?? []) {
      pedidas.add((d as { name: string }).name);
    }
    expect([...pedidas].sort()).toEqual([...DIMENSIONES_PERMITIDAS].sort());
    // Y las que NO pueden estar, nombradas para que se lea qué se está evitando.
    for (const prohibida of [
      'pagePathPlusQueryString',
      'pageLocation',
      'city',
      'region',
      'country',
      'userAgeBracket',
      'userGender',
      'streamId',
    ]) {
      expect(pedidas.has(prohibida), `${prohibida} no puede pedirse`).toBe(false);
    }
  });

  it('una dimensión fuera de la lista blanca CORTA, no se filtra en silencio', () => {
    /*
     * El título prometía más de lo que probaba —afirmaba que `pedidosGa4` no
     * tira y que la whitelist no tiene la mala—, así que ahora se ejercita el
     * throw de verdad. Lo señaló el `auditor-privacidad`.
     *
     * **Tirar y no filtrar** es la decisión: una dimensión mal escrita tiene que
     * ser un informe que no sale —el trigger lo atrapa y la mitad queda en
     * `falla` con el motivo, que la pantalla sabe explicar— y no un informe que
     * sale sin esa columna y un ranking que queda vacío sin decir por qué.
     */
    for (const mala of ['pagePathPlusQueryString', 'city', 'userGender', '']) {
      expect(() => dimension(mala), mala).toThrow(/no permitida/);
    }
    for (const buena of DIMENSIONES_PERMITIDAS) {
      expect(dimension(buena)).toEqual({ name: buena });
    }
    // Y su gemela de Search Console, que hasta el hallazgo era local a
    // `pedidosSearchConsole` — o sea que un segundo constructor de pedidos
    // podía no pasar por la lista.
    expect(() => dimensionSc('country')).toThrow(/no permitida/);
    expect(dimensionSc('query')).toEqual(['query']);
  });

  it('el informe de eventos filtra por los eventos propios, no trae todos', () => {
    /*
     * Sin el filtro la respuesta la encabezan los automáticos de GA4
     * (`page_view`, `session_start`, `user_engagement`), que no contestan
     * ninguna pregunta del §4 y empujarían a los propios fuera del tope.
     */
    const p = pedidosGa4(v);
    expect(p.eventos.dimensionFilter).toEqual({
      filter: { fieldName: 'eventName', inListFilter: { values: EVENTOS_PROPIOS } },
    });
  });

  it('EVENTOS_PROPIOS no se desactualiza contra el módulo del sitio', () => {
    /*
     * **La red que ata `functions/` a `src/`.** La lista está copiada porque
     * `functions/` es otro paquete y no importa nada de `src/` (mismo criterio
     * que `EJES_MEDIBLES`), así que la garantía tiene que ser un test.
     *
     * MUTACIÓN PROBADA: se sacó `clic_triptico` de `EVENTOS_PROPIOS` en
     * `functions/analitica.js` y este caso pasó a rojo nombrando el faltante.
     * Sin él, el evento nuevo se mide en el sitio y **nunca llega al panel**:
     * el filtro del informe no lo pide, así que la fila sale en cero para
     * siempre y parece que nadie lo toca.
     */
    expect([...EVENTOS_PROPIOS].sort()).toEqual([...NOMBRES_EVENTOS_SITIO].sort());
  });

  it('el pedido del primer día pide una fila, ascendente, del último año', () => {
    const p = pedidoPrimerDia(new Date('2026-10-15T15:00:00-03:00'));
    expect(p.dateRanges).toEqual([{ startDate: '2025-10-15', endDate: '2026-10-15' }]);
    expect(p.limit).toBe(1);
    // Ascendente = sin `desc`. Con `desc: true` esto devolvería el ÚLTIMO día
    // con datos, que es un número distinto y parecido: el bug no se vería.
    expect(p.orderBys).toEqual([{ dimension: { dimensionName: 'date' } }]);
  });
});

describe('los pedidos a Search Console — B-373', () => {
  it('pide búsquedas y páginas, solo web, con el tope del ranking', () => {
    const p = pedidosSearchConsole({ desde: '2026-09-15', hasta: '2026-10-12' });
    expect(p.busquedas.dimensions).toEqual(['query']);
    expect(p.paginas.dimensions).toEqual(['page']);
    /*
     * Las dos y ninguna más. Esta API tiene `country` y `device`, que suenan
     * inocuas — y sobre un puñado de consultas de un sitio chico `country` deja
     * de ser un agregado. Se pide lo que la pregunta 7 necesita.
     */
    const pedidas = new Set(Object.values(p).flatMap((x) => x.dimensions as string[]));
    expect([...pedidas].sort()).toEqual([...DIMENSIONES_SC_PERMITIDAS].sort());
    expect(pedidas.has('country')).toBe(false);
    for (const pedido of Object.values(p)) {
      // `type: 'web'` deja afuera imágenes y video: mezclar dos índices en el
      // mismo promedio de posición da un número que no significa nada.
      expect(pedido.type).toBe('web');
      expect(pedido.rowLimit).toBe(TOPE_DE_RANKING);
      expect(pedido.startDate).toBe('2026-09-15');
      expect(pedido.endDate).toBe('2026-10-12');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3 · El parseo
// ─────────────────────────────────────────────────────────────────────

describe('numero — las métricas de GA4 vienen como string', () => {
  it('convierte, y no concatena', () => {
    // `"412" + "317"` da `"412317"`. Es el bug de una línea que produce un
    // número diez veces más grande y no falla nada.
    expect(numero('412')).toBe(412);
    expect(numero('412') + numero('317')).toBe(729);
    expect(numero('0.0416')).toBeCloseTo(0.0416);
  });

  it('un valor ausente o basura da 0 y nunca NaN', () => {
    /*
     * Un `NaN` se propaga a la variación, sale del `JSON.stringify` como
     * `null` y llega a la pantalla como un hueco sin explicación. Cero es
     * falso pero legible; `NaN` es un bug que se ve como un diseño.
     */
    expect(numero(undefined)).toBe(0);
    expect(numero(null)).toBe(0);
    expect(numero('')).toBe(0);
    expect(numero('(other)')).toBe(0);
    expect(Number.isNaN(numero('x'))).toBe(false);
  });
});

describe('variacion — el cero de la ventana anterior', () => {
  it('calcula el porcentaje redondeado', () => {
    expect(variacion(412, 300)).toBe(37);
    expect(variacion(300, 412)).toBe(-27);
    expect(variacion(300, 300)).toBe(0);
  });

  it('con la ventana anterior en cero devuelve null, no infinito', () => {
    /*
     * **Es el caso del primer mes de medición, no un borde raro**: la ventana
     * anterior a la primera es exactamente cero. Dividir da `Infinity`, y
     * presentar «+∞ %» o —peor— «+100 %» sobre una base de cero es el número
     * que un anunciante pincha primero.
     */
    expect(variacion(412, 0)).toBeNull();
    expect(variacion(0, 0)).toBeNull();
  });

  it('no devuelve NaN con entradas rotas', () => {
    expect(variacion(NaN, 10)).toBeNull();
    expect(variacion(10, NaN)).toBeNull();
  });
});

describe('ranking', () => {
  it('conserva el orden que dio la API', () => {
    // El orden lo decide `orderBys`, y reordenar de este lado sería tener dos
    // criterios para lo mismo.
    const r = ranking(informesLlenos().paginas);
    expect(r.map((f: { clave: string }) => f.clave)).toEqual([
      '/',
      '/actividad/taller-de-cronica/',
      '/cartelera/',
    ]);
    expect(r[0]).toEqual({ clave: '/', valor: 480 });
  });

  it('un informe sin `rows` da [] y no explota', () => {
    // GA4 **omite** `rows` cuando no hay filas: no manda `rows: []`.
    expect(ranking(vacio())).toEqual([]);
    expect(ranking(undefined)).toEqual([]);
    expect(ranking({})).toEqual([]);
  });
});

describe('fechaDeGa4', () => {
  it('la dimensión `date` viene sin guiones', () => {
    expect(fechaDeGa4('20260903')).toBe('2026-09-03');
  });

  it('cualquier otra cosa da null, y no una fecha inventada', () => {
    expect(fechaDeGa4('2026-09-03')).toBeNull();
    expect(fechaDeGa4('(other)')).toBeNull();
    expect(fechaDeGa4(undefined)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4 · El resumen
// ─────────────────────────────────────────────────────────────────────

describe('el panel no es una página del sitio público — B-801', () => {
  it('el ranking de páginas excluye las rutas del panel', () => {
    /*
     * **Lo vio el dueño en la pantalla:** `/admin/` aparecía en «Las páginas más
     * vistas» del sitio público.
     *
     * La causa de raíz estaba del otro lado —la analítica del panel usa la misma
     * propiedad de GA4 y mandaba su `page_view` automático, apagado en
     * `src/lib/analytics.ts`— y este filtro es defensa en profundidad por dos
     * motivos que no son teóricos:
     *
     * 1. **los días ya medidos tienen esas vistas y GA4 no recalcula para atrás**,
     *    así que sin el filtro `/admin/` sigue apareciendo hasta que la ventana de
     *    28 días lo deje atrás;
     * 2. **el ranking tiene tope de diez**, o sea que una fila del panel no es
     *    ruido: desplaza a una página real.
     *
     * MUTACIÓN PROBADA: sacar el `dimensionFilter` deja este caso en rojo; cambiar
     * `BEGINS_WITH` por `EXACT` también, y ése es el que importa —con igualdad,
     * `/admin/` pasa y una pantalla nueva del panel entra sola—.
     */
    const pedidos = pedidosGa4({ desde: '2026-09-15', hasta: '2026-10-12' });
    const filtro = pedidos.paginas.dimensionFilter;

    expect(filtro, 'el ranking de páginas no filtra nada').toBeDefined();
    // `notExpression`: se excluye, no se incluye. Con un `filter` a secas el
    // ranking mostraría SOLO el panel, que es el error opuesto y silencioso.
    expect(filtro.notExpression.filter.fieldName).toBe('pagePath');
    expect(filtro.notExpression.filter.stringFilter).toEqual({
      matchType: 'BEGINS_WITH',
      value: RUTA_DEL_PANEL,
    });
    expect(RUTA_DEL_PANEL).toBe('/admin');
  });

  it('y no se le puso el filtro a los informes donde no corresponde', () => {
    /*
     * El control que evita el arreglo de más. `totales`, `canales` y
     * `dispositivos` son **sesiones**, no vistas de página: una sesión que pasó
     * por el panel es una sesión igual, y filtrarla por `pagePath` daría un número
     * que no es ni «con panel» ni «sin panel» — sería la mitad de una sesión.
     *
     * Eso queda como lo que es: los días ya medidos tienen esas sesiones adentro,
     * y la única forma de excluirlas de verdad es un filtro de datos en la consola
     * de GA4, que tampoco es retroactivo. Está escrito en B-801.
     */
    const pedidos = pedidosGa4({ desde: '2026-09-15', hasta: '2026-10-12' });
    for (const informe of ['totales', 'canales', 'dispositivos']) {
      expect(
        'dimensionFilter' in pedidos[informe],
        `${informe} no se filtra por ruta: son sesiones, no vistas de página`,
      ).toBe(false);
    }
    // El de eventos sí tiene el suyo, y es el de los eventos propios.
    expect(pedidos.eventos.dimensionFilter.filter.fieldName).toBe('eventName');
  });
});

describe('las tres métricas que sumó B-800', () => {
  it('llegan desde la respuesta cruda, con su variación', () => {
    /*
     * **Que las seis salgan del mismo informe es la decisión que este caso
     * fija.** `pedidosGa4` ya se ejecuta dos veces —ventana actual y anterior—
     * así que las tres nuevas traen su variación **sin un round trip más**. Si
     * alguien las moviera a un informe propio, el pedido pasaría de dos a cuatro
     * llamadas a la Data API por corrida y la variación habría que armarla a
     * mano.
     *
     * MUTACIÓN PROBADA: pedirle 3 métricas a `metricasDeLaFila` en vez de 6 deja
     * las tres nuevas en `0` y este caso en rojo.
     */
    const r = resumenGa4({
      actual: { ...informesVacios(), totales: totales('412', '317', '1103', '180', '134.7', '0.6432') },
      anterior: { ...informesVacios(), totales: totales('300', '250', '900', '150', '120', '0.58') },
      primerDia: {},
      ventana: { desde: '2026-09-15', hasta: '2026-10-12' },
    });

    expect(r.nuevos).toEqual({ valor: 180, variacion: 20 });
    // Los dos que no son enteros llegan CRUDOS: el formato es de la pantalla.
    expect(r.duracion.valor).toBeCloseTo(134.7, 5);
    expect(r.enganche.valor).toBeCloseTo(0.6432, 5);
    expect(r.duracion.variacion).toBe(12);
  });

  it('y no se formatean en la Function: el valor viaja como lo manda GA4', () => {
    /*
     * La otra mitad de la decisión. Si la Function devolviera `'2 min 15 s'`, el
     * panel no podría mostrar el mismo dato de otra forma —ni un test comparar
     * números— y el formato quedaría cableado del lado que no lo mira. Es el mismo
     * criterio con el que `variacionLegible` vive en `src/` y no acá.
     */
    const r = resumenGa4({
      actual: { ...informesVacios(), totales: totales('1', '1', '1', '1', '134.7', '0.6432') },
      anterior: informesVacios(),
      primerDia: {},
      ventana: { desde: '2026-09-15', hasta: '2026-10-12' },
    });
    expect(typeof r.duracion.valor).toBe('number');
    expect(typeof r.enganche.valor).toBe('number');
    expect(JSON.stringify(r.duracion)).not.toContain('min');
    expect(JSON.stringify(r.enganche)).not.toContain('%');
  });

  it('las tres son MÉTRICAS y no agregan ninguna dimensión — la razón de que sean baratas', () => {
    /*
     * **Lo que hace que sumarlas no sea una decisión de privacidad.** Una métrica
     * es un agregado sobre la ventana entera y no puede traer contenido de nadie;
     * una dimensión sí —`pageLocation` llevaría el `?q=` de lo que alguien tipeó, y
     * `city`/`userGender` la demografía—. Por eso hay lista blanca de dimensiones y
     * no de métricas.
     *
     * Este caso ata esa afirmación: el informe de totales sigue **sin dimensiones**.
     * Si alguien le agregara una para «desglosar», el test de dimensiones
     * permitidas la vería, pero recién si además está fuera de la lista blanca —
     * esto lo frena antes, en el informe donde no tiene por qué haber ninguna.
     */
    const pedidos = pedidosGa4({ desde: '2026-09-15', hasta: '2026-10-12' });
    /*
     * `dimensions` no está en el tipo inferido del objeto —justamente porque el
     * informe no la lleva— así que se lo pregunta por clave. Un `as` diría lo
     * mismo y con menos ruido, pero también dejaría de fallar el día que alguien
     * agregue la propiedad: `in` no.
     */
    expect('dimensions' in pedidos.totales).toBe(false);
    expect(pedidos.totales.metrics).toHaveLength(6);
    expect(pedidos.totales.metrics.map((m: { name: string }) => m.name)).toEqual([
      'sessions',
      'activeUsers',
      'screenPageViews',
      'newUsers',
      'averageSessionDuration',
      'engagementRate',
    ]);
  });
});

describe('resumenGa4', () => {
  const ventana = { desde: '2026-09-17', hasta: '2026-10-14' };

  it('junta las cuatro filas de la mitad vendible con su variación', () => {
    const r = resumenGa4({
      actual: informesLlenos(),
      anterior: { ...informesVacios(), totales: totales('300', '250', '900') },
      primerDia: primerDia('20260903'),
      ventana,
    });
    expect(r.hayDatos).toBe(true);
    expect(r.ventana).toEqual(ventana);
    expect(r.desdeCuando).toBe('2026-09-03');
    expect(r.sesiones).toEqual({ valor: 412, variacion: 37 });
    expect(r.personas).toEqual({ valor: 317, variacion: 27 });
    expect(r.vistas).toEqual({ valor: 1103, variacion: 23 });
    expect(r.paginas[0]).toEqual({ clave: '/', valor: 480 });
    expect(r.canales[0]).toEqual({ clave: 'Organic Search', valor: 210 });
    expect(r.dispositivos.map((d: { clave: string }) => d.clave)).toEqual(['mobile', 'desktop', 'tablet']);
  });

  it('un evento propio que todavía no ocurrió sale en CERO, no ausente', () => {
    /*
     * **El caso que decide si la pantalla puede ser honesta.** GA4 no devuelve
     * una fila para un evento con cero ocurrencias, así que sin este relleno
     * la pantalla no puede distinguir «cero clics de inscripción» —un dato— de
     * «este evento no está enganchado» —un bug—. Las dos se ven igual: un
     * hueco.
     *
     * El fixture trae dos de los tres eventos a propósito, que es el estado
     * real del primer mes.
     */
    const r = resumenGa4({
      actual: informesLlenos(),
      anterior: informesVacios(),
      primerDia: primerDia('20260903'),
      ventana,
    });
    expect(r.eventos).toEqual({
      clic_inscripcion: 37,
      filtro_sin_resultados: 12,
      clic_triptico: 0,
    });
    // Las tres claves están, siempre, sin importar qué devolvió la API.
    expect(Object.keys(r.eventos).sort()).toEqual([...EVENTOS_PROPIOS].sort());
  });

  it('con la propiedad recién creada, `hayDatos` es false — no «0 visitas»', () => {
    /*
     * D-272: la pantalla muestra el estado vacío honesto y no un cero. Un
     * tablero que dice «0 visitas» tres semanas parece roto; el estado vacío
     * dice por qué está vacío. Y **no se deriva de que la API haya fallado**:
     * acá la API contestó perfecto.
     */
    const r = resumenGa4({
      actual: informesVacios(),
      anterior: informesVacios(),
      primerDia: { rowCount: 0 },
      ventana,
    });
    expect(r.hayDatos).toBe(false);
    expect(r.desdeCuando).toBeNull();
    expect(r.sesiones).toEqual({ valor: 0, variacion: null });
    expect(r.paginas).toEqual([]);
    expect(r.eventos).toEqual({
      clic_inscripcion: 0,
      filtro_sin_resultados: 0,
      clic_triptico: 0,
    });
  });

  it('con vistas pero sin sesiones igual hay datos', () => {
    // Pasa el primer día de medición, con el muestreo de GA4 todavía a medias.
    // «Sin sesiones» no puede apagar la pantalla si hubo vistas.
    const r = resumenGa4({
      actual: { ...informesVacios(), totales: totales('0', '0', '4') },
      anterior: informesVacios(),
      primerDia: primerDia('20260903'),
      ventana,
    });
    expect(r.hayDatos).toBe(true);
  });
});

describe('resumenSearchConsole — B-373', () => {
  const ventana = { desde: '2026-09-15', hasta: '2026-10-12' };

  /** La forma real de `searchAnalytics/query`: números, y `ctr` como fracción. */
  const respuesta = () => ({
    rows: [
      { keys: ['taller de escritura'], clicks: 14, impressions: 320, ctr: 0.04375, position: 8.42 },
      { keys: ['club de lectura palermo'], clicks: 6, impressions: 91, ctr: 0.0659, position: 12.9 },
      // Una fila con cero clics: la API **omite** el campo, no manda `0`.
      { keys: ['agenda literaria'], impressions: 44, ctr: 0, position: 31.777 },
    ],
    responseAggregationType: 'byProperty',
  });

  it('arma las dos listas y suma los totales del tope', () => {
    const r = resumenSearchConsole({
      busquedas: respuesta(),
      paginas: { rows: [{ keys: ['https://agendaleh.ar/'], clicks: 9, impressions: 210, ctr: 0.0428, position: 6.1 }] },
      ventana,
    });
    expect(r.hayDatos).toBe(true);
    expect(r.busquedas[0]).toEqual({
      clave: 'taller de escritura',
      clics: 14,
      impresiones: 320,
      ctr: 0.04375,
      posicion: 8.4,
    });
    // La fila sin `clicks` da 0 y no NaN.
    expect(r.busquedas[2]!.clics).toBe(0);
    // La posición se redondea a un decimal: la API devuelve doce y ninguno
    // significa nada.
    expect(r.busquedas[2]!.posicion).toBe(31.8);
    /*
     * **El nombre del campo es la mitad del punto.** Es la suma del top 10, no
     * del sitio: presentarlo como «los clics del sitio» sería un número que se
     * cae en la primera pregunta (§9.3, la línea de la fuente de cada dato).
     */
    expect(r.clicsEnElTope).toBe(20);
    expect(r.impresionesEnElTope).toBe(455);
  });

  it('el `ctr` se guarda como fracción y no como porcentaje', () => {
    // Formatear es de la pantalla. Guardarlo ya multiplicado por 100 hace que
    // el día que alguien lo formatee otra vez salga 437 %.
    const r = resumenSearchConsole({ busquedas: respuesta(), paginas: {}, ventana });
    expect(r.busquedas[0]!.ctr).toBeLessThan(1);
  });

  it('sin filas, `hayDatos` es false y las listas están vacías', () => {
    const r = resumenSearchConsole({ busquedas: {}, paginas: {}, ventana });
    expect(r.hayDatos).toBe(false);
    expect(r.busquedas).toEqual([]);
    expect(r.paginas).toEqual([]);
    expect(r.clicsEnElTope).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5 · El documento
// ─────────────────────────────────────────────────────────────────────

describe('documentoDeAnalitica', () => {
  const resumen = () =>
    resumenGa4({
      actual: informesLlenos(),
      anterior: informesVacios(),
      primerDia: primerDia('20260903'),
      ventana: { desde: '2026-09-17', hasta: '2026-10-14' },
    });

  it('cada mitad lleva su propio estado', () => {
    /*
     * Las dos APIs fallan por separado —una credencial, una cuota, una property
     * mal configurada— y un resumen a medias es más útil que ninguno. Un solo
     * estado global obligaría a tirar la mitad buena.
     */
    const doc = documentoDeAnalitica({
      ga4: { ok: true, resumen: resumen() },
      searchConsole: { ok: false, motivo: 'user does not have sufficient permission' },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    expect(doc.version).toBe(VERSION_DEL_RESUMEN);
    expect(doc.ga4.estado).toBe('ok');
    expect(doc.ga4.sesiones).toEqual({ valor: 412, variacion: null });
    expect(doc.searchConsole).toEqual({
      estado: 'falla',
      motivo: 'user does not have sufficient permission',
    });
  });

  it('el documento tiene exactamente estas claves — una respuesta cruda esparcida no pasa', () => {
    /*
     * **`documentoDeAnalitica` esparce el resumen**, así que la frontera real no
     * es esa función —que solo copia— sino `resumenGa4` y
     * `resumenSearchConsole`. Hoy las dos son whitelist por construcción, pero
     * un `return { ...respuesta, sesiones: … }` puesto adentro para «tener a
     * mano un dato que falta» pasaría el resto de la suite en verde y
     * publicaría la respuesta de la Data API entera al documento que lee el
     * panel. Lo pidió el `auditor-privacidad`, y es la regla del protocolo de
     * este repo: un spread en una proyección es hallazgo aunque hoy no filtre.
     *
     * MUTACIÓN PROBADA: se agregó `...actual.totales` al objeto que devuelve
     * `resumenGa4`; este caso pasó a rojo listando `metricHeaders`, `rows`,
     * `rowCount`, `metadata` y `kind` como claves de más.
     */
    const doc = documentoDeAnalitica({
      ga4: { ok: true, resumen: resumen() },
      searchConsole: {
        ok: true,
        resumen: resumenSearchConsole({
          busquedas: {},
          paginas: {},
          ventana: { desde: '2026-09-15', hasta: '2026-10-12' },
        }),
      },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    expect(Object.keys(doc.ga4).sort()).toEqual([...CLAVES_DEL_RESUMEN.ga4Ok].sort());
    expect(Object.keys(doc.searchConsole).sort()).toEqual(
      [...CLAVES_DEL_RESUMEN.searchConsoleOk].sort(),
    );
    // Y la rama de falla, que es la otra forma que puede tener cada mitad.
    const roto = documentoDeAnalitica({
      ga4: { ok: false, motivo: 'x' },
      searchConsole: { ok: false, motivo: 'x' },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    expect(Object.keys(roto.ga4).sort()).toEqual([...CLAVES_DEL_RESUMEN.falla].sort());
  });

  it('el motivo que se GUARDA está topeado, no solo el que se lee', () => {
    /*
     * Lo encontró el `auditor-privacidad`. El docblock afirmaba «nunca la
     * respuesta cruda» y lo único que lo sostenía era `e.message`, cuya forma la
     * decide `googleapis` y no este repo: con un cuerpo de error inesperado ese
     * `message` puede arrastrar el cuerpo entero. El único tope vivía en el
     * lector del panel, o sea **después** de persistir.
     *
     * Y hay un modo de falla que no es de privacidad y muerde igual: un string
     * enorme puede hacer fallar el `set()` justo el día en que algo anda mal, y
     * el documento se queda con los números de ayer sin decirlo.
     *
     * MUTACIÓN PROBADA: se sacó `motivoRecortado` del `documentoDeAnalitica` y
     * este caso pasó a rojo con la longitud entera.
     */
    const enorme = `403 Forbidden: ${'y'.repeat(5000)}`;
    const doc = documentoDeAnalitica({
      ga4: { ok: false, motivo: enorme },
      searchConsole: { ok: false, motivo: enorme },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    expect(doc.ga4.motivo.length).toBe(MAX_MOTIVO);
    expect(doc.ga4.motivo.endsWith('…')).toBe(true);
    // Lo que se conserva es el principio, que es donde está el diagnóstico.
    expect(doc.ga4.motivo.startsWith('403 Forbidden')).toBe(true);
    expect(doc.searchConsole.motivo.length).toBe(MAX_MOTIVO);
  });

  it('una falla sin mensaje igual dice algo', () => {
    // `motivo: undefined` en un documento de Firestore es un campo que no
    // existe, y la pantalla lo lee como un hueco.
    const doc = documentoDeAnalitica({
      ga4: { ok: false },
      searchConsole: { ok: false },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    expect(doc.ga4.motivo).toBe('sin motivo');
    expect(doc.searchConsole.motivo).toBe('sin motivo');
  });

  it('el documento es serializable a JSON sin perder nada', () => {
    /*
     * Va a Firestore, así que no puede llevar `undefined` (que Firestore
     * rechaza con `Cannot use "undefined" as a Firestore value`) ni `NaN`
     * (que `JSON.stringify` convierte en `null`). El `null` de `variacion` es
     * deliberado y sí sobrevive.
     */
    const doc = documentoDeAnalitica({
      ga4: { ok: true, resumen: resumen() },
      searchConsole: { ok: true, resumen: resumenSearchConsole({ busquedas: {}, paginas: {}, ventana: { desde: 'x', hasta: 'y' } }) },
      generadoEn: '2026-10-15T10:00:00.000Z',
    });
    const ida = JSON.stringify(doc);
    expect(ida).not.toContain('undefined');
    expect(ida).not.toContain('NaN');
    expect(JSON.parse(ida)).toEqual(doc);
  });
});
