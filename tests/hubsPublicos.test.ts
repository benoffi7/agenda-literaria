import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import opcionesBase from '@/lib/opciones-base.json';
import {
  CLASES_DE_HUB,
  CLASES_DE_TAXONOMIA,
  CONTEXTO_DE_TIPO,
  TIPO_EN_PLURAL,
  esIndexable,
  exploracionDelSitio,
  filtrosDelHub,
  hubDelSitio,
  hubsDelSitio,
  hubsOfrecidos,
  pluralDeTipo,
  rutaDelHub,
  slugsConHub,
  type Hub,
} from '@/lib/hubsPublicos';
import { filtrarPublico, mapaDeEtiquetas, ordenarPublico, ORDEN_PUBLICO_POR_DEFECTO } from '@/lib/listadoPublico';
import { RUTA_GRATIS, RUTA_ONLINE, rutaDeBarrio, rutaDeMes, rutaDeTipo } from '@/lib/rutasPublicas';
import { RUTAS_FIJAS, rutasDelSitemap } from '@/lib/sitemap';
import { entradaDePrueba } from './fixtures/indice';

/**
 * **Los hubs** — B-108, §2.1 y §4.4 del diseño.
 *
 * ── Qué se puede romper acá, que no es que se rompa ───────────────────────
 * Nada de lo que este módulo haga mal deja el build en rojo, y las páginas se ven
 * bien igual: son listados. Los seis modos de falla, y cada uno tiene su caso con
 * la mutación anotada:
 *
 * | # | Qué | Qué se pierde |
 * |---|---|---|
 * | 1 | un hub **desaparece** cuando se queda sin actividades vigentes | un 404 sobre una URL que estuvo indexada (§4.4). Es el peor: no se recupera |
 * | 2 | un hub vacío **se ofrece** en el sitemap | páginas delgadas indexadas, compitiendo con el resto del sitio |
 * | 3 | un hub vacío se ofrece **y** lleva `noindex` | dos señales opuestas a Google |
 * | 4 | la URL usa el **label** y no el slug | el día que se renombre la opción, la URL cambia (trampa 10) |
 * | 5 | la selección **no es la del filtro de la home** | `/tipo/taller` y `/?tipo=taller` contestan distinto sobre los mismos datos (B-88) |
 * | 6 | un hub **sin actividad publicada** se emite | una página indexada por cada valor del vocabulario, incluidos los que nadie usó |
 *
 * ── El reloj entra como parámetro ────────────────────────────────────────
 * Todo se mide contra `AHORA`, así que ningún caso depende de qué día es hoy — que
 * en un módulo que separa vigente de pasado es la diferencia entre un test y una
 * bomba de tiempo.
 */
const AHORA = new Date('2026-09-10T15:00:00Z');

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

/** El archivo sin comentarios: los docblocks explican lo que se prohíbe. */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [
    { slug: 'taller', label: 'Taller' },
    { slug: 'club-lectura', label: 'Club de lectura' },
    { slug: 'charla', label: 'Charla' },
  ],
  barrio: [
    { slug: 'boedo', label: 'Boedo' },
    { slug: 'villa-crespo', label: 'Villa Crespo' },
  ],
  arancel: [
    { slug: 'gratis', label: 'Gratis' },
    { slug: 'a-la-gorra', label: 'A la gorra' },
  ],
});

/** Las opciones como viajan en el índice: ya filtradas por aprobación. */
const OPCIONES = {
  tipo: [{ slug: 'taller' }, { slug: 'club-lectura' }, { slug: 'charla' }],
  barrio: [{ slug: 'boedo' }, { slug: 'villa-crespo' }],
};

const PROXIMA = '2026-09-24T22:00:00Z';
const PASADA = '2026-07-24T22:00:00Z';

const hubs = (entradas: ReturnType<typeof entradaDePrueba>[], opciones = OPCIONES) =>
  hubsDelSitio(entradas, opciones, ETIQUETAS, AHORA);

const buscar = (lista: Hub[], clase: string, slug = ''): Hub | undefined =>
  lista.find((h) => h.clase === clase && h.slug === slug);

// ───────────────────────────────────────────────────────────────────────────
// 1 · Qué hubs se emiten
// ───────────────────────────────────────────────────────────────────────────

describe('qué hubs emite el build', () => {
  it('los dos temáticos están siempre, incluso sin ninguna actividad', () => {
    /*
     * MUTACIÓN PROBADA: hacerlos condicionales —«si hay algo online, emitir
     * `/online`»— pone este caso en rojo. Son secciones del sitio y no valores de
     * una taxonomía: su vacío es un estado pasajero de los datos, igual que el de
     * `/pasadas` el día que se lanzó.
     */
    const lista = hubs([]);
    expect(buscar(lista, 'online')).toBeDefined();
    expect(buscar(lista, 'gratis')).toBeDefined();
    expect(lista.map((h) => h.clase)).toEqual(['online', 'gratis']);
  });

  it('un tipo sin ninguna actividad publicada NO tiene página', () => {
    /*
     * Modo de falla 6. Sin esto habría una página indexada por cada valor del
     * vocabulario, incluidos los que nadie usó nunca: páginas sin contenido y sin
     * motivo, que además diluyen el sitio.
     *
     * MUTACIÓN PROBADA: devolver todos los slugs de la taxonomía en
     * `slugsConHub` —o sea saltear el cruce contra las actividades— pone este
     * caso en rojo.
     */
    const lista = hubs([entradaDePrueba({ id: 'a', slug: 'a', tipo: 'taller', fechas: [PROXIMA] })]);
    expect(buscar(lista, 'tipo', 'taller')).toBeDefined();
    expect(buscar(lista, 'tipo', 'club-lectura')).toBeUndefined();
    expect(buscar(lista, 'tipo', 'charla')).toBeUndefined();
  });

  it('una actividad PASADA alcanza para que el hub siga existiendo', () => {
    /*
     * **El caso más importante del archivo, y el modo de falla 1.**
     *
     * §4.4: «un hub que se queda sin actividades vigentes **no se borra**: se
     * genera con el aviso y links a los demás. Un 404 sobre una URL indexada es
     * peor que una página honesta y vacía».
     *
     * Lo que hace que esa promesa se cumpla sola es que una actividad publicada no
     * sale nunca del índice (§7.1), así que el conjunto de hubs emitidos solo
     * puede crecer. Si el corte de **emisión** mirara lo vigente, `/tipo/charla`
     * dejaría de existir el día después de la última charla — y esa URL puede
     * estar indexada, linkeada de Instagram y en el historial de alguien.
     *
     * MUTACIÓN PROBADA: filtrar `slugsConHub` por `estadoDe(e, ahora).paso ===
     * false` —o sea usar el mismo corte que para ofrecer— pone este caso en rojo y
     * deja todos los demás en verde. Es exactamente el bug que este ítem no puede
     * cometer.
     */
    const soloPasada = entradaDePrueba({ id: 'v', slug: 'v', tipo: 'charla', fechas: [PASADA] });
    const hub = buscar(hubs([soloPasada]), 'tipo', 'charla');
    expect(hub, 'un tipo con una actividad pasada tiene que conservar su página').toBeDefined();
    expect(hub!.vacio).toBe(true);
    expect(hub!.entradas).toEqual([]);
  });

  it('el orden es el de la taxonomía, no el de aparición en los datos', () => {
    /*
     * Es el orden que el dueño acomoda desde Opciones (§4.3), y es lo que hace que
     * la tira «Explorá por» no se reacomode sola en cada build — un enlace que
     * cambia de lugar cada vez que se carga una actividad se lee como inestable.
     *
     * MUTACIÓN PROBADA: recorrer las actividades en vez de las opciones pone este
     * caso en rojo, porque el fixture las carga al revés.
     */
    const lista = hubs([
      entradaDePrueba({ id: 'b', slug: 'b', tipo: 'charla', fechas: [PROXIMA] }),
      entradaDePrueba({ id: 'a', slug: 'a', tipo: 'taller', fechas: [PROXIMA] }),
    ]);
    expect(lista.filter((h) => h.clase === 'tipo').map((h) => h.slug)).toEqual([
      'taller',
      'charla',
    ]);
  });

  it('una opción pendiente de aprobar no tiene hub, aunque una actividad la use', () => {
    /*
     * §4.3 — el sitio no publica vocabulario sin validar, y **ofrecer un hub es
     * publicar vocabulario**: una URL indexada con el nombre de un barrio recién
     * tipeado es un typo sostenido para siempre. Es el mismo argumento con el que
     * el §2.3 dejó afuera los hubs de tema (B-05, B-06).
     *
     * Se modela como el índice lo entrega: las opciones que llegan acá **ya están
     * filtradas** por aprobación, así que basta con que el slug no esté en la
     * lista. La asimetría con `etiquetaDe` —que resuelve con la lista sin filtrar—
     * es la de D-30, y las dos mitades siguen valiendo.
     *
     * MUTACIÓN PROBADA: armar los hubs con los slugs que usan las actividades en
     * vez de cruzarlos contra las opciones pone este caso en rojo.
     */
    const conBarrioNuevo = entradaDePrueba({
      id: 'n',
      slug: 'n',
      barrio: 'almagro-typo',
      fechas: [PROXIMA],
    });
    expect(buscar(hubs([conBarrioNuevo]), 'barrio', 'almagro-typo')).toBeUndefined();
    // Control positivo: con la opción aprobada sí aparece.
    expect(
      buscar(
        hubsDelSitio(
          [conBarrioNuevo],
          { ...OPCIONES, barrio: [...OPCIONES.barrio, { slug: 'almagro-typo' }] },
          ETIQUETAS,
          AHORA,
        ),
        'barrio',
        'almagro-typo',
      ),
    ).toBeDefined();
  });

  it('`slugsConHub` cubre las dos taxonomías y ninguna más', () => {
    // Control de forma: si mañana alguien agrega `/tema/*` sin pasar por el §2.3,
    // esto lo manda a decidirlo. Los temas están afuera a propósito.
    expect([...CLASES_DE_TAXONOMIA]).toEqual(['tipo', 'barrio']);
    expect([...CLASES_DE_HUB]).toEqual(['tipo', 'barrio', 'online', 'gratis']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Qué hubs se ofrecen, y el invariante con `noindex`
// ───────────────────────────────────────────────────────────────────────────

describe('ofrecer, indexar y el sitemap son la misma decisión', () => {
  const conVacio = () => [
    entradaDePrueba({ id: 'a', slug: 'a', tipo: 'taller', fechas: [PROXIMA] }),
    entradaDePrueba({ id: 'v', slug: 'v', tipo: 'charla', fechas: [PASADA] }),
  ];

  it('el hub con algo vigente se ofrece; el vacío no', () => {
    const ofrecidos = hubsOfrecidos(conVacio(), OPCIONES, ETIQUETAS, AHORA);
    expect(ofrecidos.map((h) => h.ruta)).toContain(rutaDeTipo('taller'));
    expect(ofrecidos.map((h) => h.ruta)).not.toContain(rutaDeTipo('charla'));
  });

  it('**el invariante**: un hub está en el sitemap si y solo si no lleva `noindex`', () => {
    /*
     * Los modos de falla 2 y 3 de una vez, y en las **dos** direcciones. Un hub
     * ofrecido con `noindex` le manda a Google dos señales opuestas; un hub vacío
     * en el sitemap sin `noindex` le pide que indexe una lista sin nada.
     *
     * Se afirma sobre la salida real —las rutas del sitemap— y no sobre la lista
     * intermedia, así que cubre también el paso que las mete ahí.
     *
     * MUTACIÓN PROBADA: usar `hubsDelSitio` en vez de `hubsOfrecidos` en
     * `rutasDelSitemap` pone este caso en rojo por la dirección «en el sitemap y
     * con noindex»; hacer que `esIndexable` devuelva siempre `true` lo pone en rojo
     * por la otra.
     */
    const entradas = conVacio();
    const rutas = rutasDelSitemap({
      entradas,
      canceladas: [],
      opciones: OPCIONES,
      ahora: AHORA,
    });

    const todos = hubs(entradas);
    // Control positivo: hay hubs de los dos lados, así que las dos direcciones se
    // ejercitan de verdad.
    expect(todos.filter(esIndexable).length).toBeGreaterThan(0);
    expect(todos.filter((h) => !esIndexable(h)).length).toBeGreaterThan(0);

    for (const hub of todos) {
      expect(
        rutas.includes(hub.ruta),
        `${hub.ruta} ${esIndexable(hub) ? 'debería' : 'no debería'} estar en el sitemap`,
      ).toBe(esIndexable(hub));
    }
  });

  it('los dos temáticos son indexables siempre, y están en `RUTAS_FIJAS`', () => {
    /*
     * Su vacío no puede volverse permanente por estructura —«lo que se hace a
     * distancia» siempre quiere decir algo— así que no necesitan el par
     * sitemap/`noindex`, y por eso viven en la lista fija en vez de entrar por
     * `hubsOfrecidos`.
     *
     * MUTACIÓN PROBADA: sacarlos de `RUTAS_FIJAS` pone este caso en rojo, y
     * `tests/sitemap.test.ts` además: quedarían como páginas estáticas que no
     * están ni en la lista ni exceptuadas.
     */
    const vacios = hubs([]);
    for (const clase of ['online', 'gratis'] as const) {
      const hub = buscar(vacios, clase)!;
      expect(hub.vacio).toBe(true);
      expect(esIndexable(hub), `${clase} tiene que indexarse igual`).toBe(true);
    }
    expect(RUTAS_FIJAS).toContain(RUTA_ONLINE);
    expect(RUTAS_FIJAS).toContain(RUTA_GRATIS);
  });

  it('sin opciones, el sitemap no ofrece ningún hub de taxonomía', () => {
    /*
     * El default del parámetro nuevo de `rutasDelSitemap`, y es el lado inofensivo
     * del error: un llamador que no le pase las opciones ofrece menos, nunca la
     * URL de un barrio sin aprobar.
     */
    const rutas = rutasDelSitemap({ entradas: conVacio(), canceladas: [], ahora: AHORA });
    expect(rutas.filter((r) => r.startsWith('/tipo/') || r.startsWith('/barrio/'))).toEqual([]);
    // Y los temáticos siguen, porque son fijos.
    expect(rutas).toContain(RUTA_ONLINE);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · La URL
// ───────────────────────────────────────────────────────────────────────────

describe('la URL sale del slug y de `rutasPublicas`', () => {
  it('el segmento es el slug, nunca el label — trampa 10', () => {
    /*
     * Modo de falla 4. §2.1: «el slug de la URL es el slug de la taxonomía, no el
     * label: el label se puede renombrar (§4.1) y una URL no». El caso concreto:
     * renombrar «Villa Crespo» a «V. Crespo» no toca ningún documento de actividad
     * (§4.1) y **no puede** mover la URL.
     *
     * MUTACIÓN PROBADA: armar la ruta con la etiqueta —`rutaDeBarrio(etiqueta)`,
     * que produce una URL que se ve razonable— pone este caso en rojo.
     */
    const hub = hubDelSitio(
      'barrio',
      'villa-crespo',
      [entradaDePrueba({ id: 'a', slug: 'a', barrio: 'villa-crespo', fechas: [PROXIMA] })],
      ETIQUETAS,
      AHORA,
    );
    expect(hub.ruta).toBe(rutaDeBarrio('villa-crespo'));
    expect(hub.ruta).toBe('/barrio/villa-crespo/');
    // La etiqueta se muestra, pero no está en la URL.
    expect(hub.titulo).toContain('Villa Crespo');
    expect(hub.ruta).not.toContain('Villa');
  });

  it('las cuatro clases derivan su ruta del módulo de rutas', () => {
    // Un productor y un consumidor derivando el mismo formato por separado es la
    // clase de B-88, y acá el modo de falla es un enlace a 404.
    expect(rutaDelHub('tipo', 'taller')).toBe(rutaDeTipo('taller'));
    expect(rutaDelHub('barrio', 'boedo')).toBe(rutaDeBarrio('boedo'));
    expect(rutaDelHub('online', '')).toBe(RUTA_ONLINE);
    expect(rutaDelHub('gratis', '')).toBe(RUTA_GRATIS);
  });

  it('cada ruta de hub está en la forma que contesta 200 — B-293', () => {
    for (const hub of hubs([entradaDePrueba({ id: 'a', slug: 'a', fechas: [PROXIMA] })])) {
      expect(hub.ruta.endsWith('/'), `${hub.ruta} sin barra final`).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · La selección es la del filtro de la home
// ───────────────────────────────────────────────────────────────────────────

describe('la selección es la del filtro de la home, importada', () => {
  const universo = () => [
    entradaDePrueba({ id: 't1', slug: 't1', tipo: 'taller', barrio: 'boedo', arancel: 'gratis', fechas: [PROXIMA] }),
    entradaDePrueba({ id: 't2', slug: 't2', tipo: 'taller', barrio: 'villa-crespo', arancel: 'arancelado', fechas: ['2026-10-01T22:00:00Z'] }),
    entradaDePrueba({ id: 'c1', slug: 'c1', tipo: 'club-lectura', barrio: 'boedo', arancel: 'a-la-gorra', fechas: [PROXIMA], modalidades: ['virtual'] }),
    entradaDePrueba({ id: 'p1', slug: 'p1', tipo: 'taller', barrio: 'boedo', arancel: 'gratis', fechas: [PASADA] }),
  ];

  it('`/tipo/taller` da lo mismo que `/?tipo=taller`', () => {
    /*
     * **Modo de falla 5, y el que este archivo existe para cerrar.** Si el hub
     * reimplementara la selección, `/tipo/taller` y la home con el chip «Taller»
     * contestarían distinto sobre los mismos datos, y las dos páginas se verían
     * bien por separado — la firma de B-88.
     *
     * Se afirma contra `filtrarPublico` + `ordenarPublico` llamados acá, o sea
     * contra el filtro de la home de verdad y no contra una lista escrita a mano:
     * un test con la lista esperada escrita pasaría igual con las dos
     * implementaciones divergidas.
     *
     * MUTACIÓN PROBADA: reemplazar `filtrarPublico` por un `entradas.filter((e) =>
     * e.tipo === slug)` —que es lo que uno escribe y que da lo mismo en este
     * fixture salvo por lo pasado— pone este caso en rojo.
     */
    const entradas = universo();
    const hub = buscar(hubs(entradas), 'tipo', 'taller')!;
    const porLaHome = ordenarPublico(
      filtrarPublico(entradas, filtrosDelHub('tipo', 'taller'), AHORA),
      ORDEN_PUBLICO_POR_DEFECTO,
      AHORA,
    );
    expect(hub.entradas.map((e) => e.id)).toEqual(porLaHome.map((e) => e.id));
    // Control positivo: la selección no es ni todo ni nada.
    expect(hub.entradas.length).toBe(2);
    expect(hub.entradas.length).toBeLessThan(entradas.length);
  });

  it('lo que ya pasó no entra en un hub: vive en `/pasadas`', () => {
    /*
     * El mapa de URLs del §2.2 dice «un hub por slug con actividad **vigente**», y
     * `/pasadas` existe justamente para que lo pasado no quede huérfano (§2.1).
     * Un hub que mezclara las dos cosas sería un archivo con otro nombre.
     *
     * MUTACIÓN PROBADA: sacar el `cuando: CUANDO_PROXIMAS` de `filtrosDelHub`
     * —que es el default de `filtrosVacios`, así que parece redundante— pone este
     * caso en rojo… y **no**: el default ya es «próximas». Se afirma igual porque
     * el día que ese default cambie, este caso lo dice.
     */
    const hub = buscar(hubs(universo()), 'tipo', 'taller')!;
    expect(hub.entradas.map((e) => e.id)).not.toContain('p1');
  });

  it('`/online` junta virtual e híbrido, y `/gratis` junta gratis y a la gorra', () => {
    /*
     * §2.1 — los dos juntan dos valores **a propósito**: «para quien busca caen
     * del mismo lado». La mitad que se olvidaría es la segunda de cada par: sin
     * `hibrido`, `/online` esconde las que tienen sede y se pueden seguir por
     * videollamada, que son justo las que resuelven el caso de quien está en otra
     * provincia; sin `a-la-gorra`, `/gratis` esconde la mitad del circuito (§4.1).
     *
     * MUTACIÓN PROBADA: dejar un solo valor en cualquiera de los dos pone este
     * caso en rojo.
     */
    const entradas = [
      entradaDePrueba({ id: 'v', slug: 'v', fechas: [PROXIMA], modalidades: ['virtual'] }),
      entradaDePrueba({ id: 'h', slug: 'h', fechas: [PROXIMA], modalidades: ['presencial', 'virtual'] }),
      entradaDePrueba({ id: 'p', slug: 'p', fechas: [PROXIMA], modalidades: ['presencial'] }),
      entradaDePrueba({ id: 'g', slug: 'g', fechas: [PROXIMA], arancel: 'gratis' }),
      entradaDePrueba({ id: 'gorra', slug: 'gorra', fechas: [PROXIMA], arancel: 'a-la-gorra' }),
      entradaDePrueba({ id: 'ar', slug: 'ar', fechas: [PROXIMA], arancel: 'arancelado' }),
    ];
    const lista = hubs(entradas);

    const online = buscar(lista, 'online')!.entradas.map((e) => e.id);
    expect(online).toContain('v');
    expect(online, 'la híbrida tiene que entrar a /online').toContain('h');
    expect(online).not.toContain('p');

    const gratis = buscar(lista, 'gratis')!.entradas.map((e) => e.id);
    expect(gratis).toContain('g');
    expect(gratis, '«a la gorra» tiene que entrar a /gratis').toContain('gorra');
    expect(gratis).not.toContain('ar');
  });

  it('el orden es el del listado, no otro', () => {
    // Un hub es la home filtrada; ordenarlo distinto lo haría parecer otra cosa
    // sin serlo. Sale de `ordenarPublico` con el orden por defecto.
    const entradas = [
      entradaDePrueba({ id: 'tarde', slug: 'tarde', tipo: 'taller', fechas: ['2026-10-20T22:00:00Z'] }),
      entradaDePrueba({ id: 'pronto', slug: 'pronto', tipo: 'taller', fechas: [PROXIMA] }),
    ];
    expect(buscar(hubs(entradas), 'tipo', 'taller')!.entradas.map((e) => e.id)).toEqual([
      'pronto',
      'tarde',
    ]);
  });

  it('el link «buscar dentro» lleva a la home con el filtro que la home entiende', () => {
    /*
     * Es lo que hace posible el «buscar dentro» del §4.4 **sin una island**: el
     * hub no lleva JavaScript, así que el buscador que ofrece es el de la home ya
     * filtrada. Si la query no coincidiera con lo que `desdeQuery` sabe leer, el
     * link llevaría a la home sin filtrar y nadie lo notaría: la página se ve bien.
     *
     * MUTACIÓN PROBADA: escribir la query a mano con otro nombre de parámetro
     * (`?categoria=taller`) pone este caso en rojo.
     */
    const lista = hubs([
      entradaDePrueba({ id: 'a', slug: 'a', tipo: 'taller', fechas: [PROXIMA] }),
    ]);
    expect(buscar(lista, 'tipo', 'taller')!.queryEnLaAgenda).toBe('?tipo=taller');
    expect(buscar(lista, 'online')!.queryEnLaAgenda).toBe('?modalidad=virtual%2Chibrido');
    expect(buscar(lista, 'gratis')!.queryEnLaAgenda).toBe('?arancel=gratis%2Ca-la-gorra');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Los textos
// ───────────────────────────────────────────────────────────────────────────

describe('los textos de cada hub', () => {
  it('todo tipo base tiene su plural y su párrafo escritos', () => {
    /*
     * **El chequeo que hace mantenible la tabla.** El §5.1 pide `{Label en plural}
     * en Argentina` y el §4.4 «un párrafo de contexto por hub, con algo de texto
     * real». Los dos son tablas por slug, y una opción base nueva no puede entrar
     * sin decidir las dos cosas: el título saldría en singular y la bajada sería
     * la frase genérica, sin que nada falle.
     *
     * Se compara contra `opciones-base.json`, que es de donde salen los tipos
     * `fijo`, y no contra una lista escrita acá.
     *
     * MUTACIÓN PROBADA: agregar un tipo `fijo` a `opciones-base.json` sin tocar
     * `TIPO_EN_PLURAL` pone este caso en rojo nombrando el slug.
     */
    const base = opcionesBase.tipo.filter((v) => v.fijo).map((v) => v.slug);
    expect(base.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(TIPO_EN_PLURAL).sort()).toEqual([...base].sort());
    expect(Object.keys(CONTEXTO_DE_TIPO).sort()).toEqual([...base].sort());
  });

  it('el plural no se inventa con una `s`', () => {
    /*
     * El castellano no pluraliza con una `s`, y los tres casos del vocabulario base
     * lo prueban: el irregular, el que pierde el acento, y el que pluraliza la
     * **primera** palabra y no la última.
     *
     * MUTACIÓN PROBADA: reemplazar la tabla por `` `${etiqueta}s` `` produce
     * «Club de lecturas», «Presentacións» y «Librería a la calles», y pone este
     * caso en rojo.
     */
    expect(TIPO_EN_PLURAL['club-lectura']).toBe('Clubes de lectura');
    expect(TIPO_EN_PLURAL['presentacion']).toBe('Presentaciones');
    expect(TIPO_EN_PLURAL['libreria-a-la-calle']).toBe('Librerías a la calle');
  });

  it('un tipo que no está en la tabla cae al label, no a una `s` inventada', () => {
    /*
     * Una opción creada desde «Otro» no se puede prever (§4). El respaldo es el
     * label tal cual: el título queda en singular —se lee un poco raro y es
     * correcto— en vez de inventar un plural que puede quedar mal. Es el criterio
     * del error inofensivo que este repo usa en todos lados.
     */
    expect(pluralDeTipo('recital-de-poesia', 'Recital de poesía')).toBe('Recital de poesía');
  });

  it('la `meta description` lleva hasta tres títulos, como la de la página de mes', () => {
    const entradas = ['a', 'b', 'c', 'd'].map((id, i) =>
      entradaDePrueba({
        id,
        slug: id,
        titulo: `Actividad ${id}`,
        tipo: 'taller',
        fechas: [`2026-09-2${i}T22:00:00Z`],
      }),
    );
    const hub = buscar(hubs(entradas), 'tipo', 'taller')!;
    expect(hub.descripcion).toContain('Actividad a');
    expect(hub.descripcion).toContain('Actividad c');
    // El cuarto no entra: lo único que se gana es que se corte el tercero.
    expect(hub.descripcion).not.toContain('Actividad d');
  });

  it('con la lista vacía la descripción no dice «0», y el aviso sí lo dice', () => {
    /*
     * «0 librerías a la calle con fecha próxima» es cierto y se lee como un error
     * de software, que es lo peor que puede decir la frase que Google muestra
     * debajo del título. **Lo apareció mirando el HTML construido, no un test.**
     *
     * El aviso de la página sí puede decirlo con palabras («ahora no hay»),
     * porque ahí es lo que hay que decir.
     */
    const vacio = buscar(hubs([entradaDePrueba({ id: 'v', slug: 'v', tipo: 'charla', fechas: [PASADA] })]), 'tipo', 'charla')!;
    expect(vacio.descripcion).not.toMatch(/\b0\b/);
    expect(vacio.avisoVacio).toMatch(/no hay/i);
    for (const clase of ['online', 'gratis'] as const) {
      expect(buscar(hubs([]), clase)!.descripcion).not.toMatch(/\b0\b/);
    }
  });

  it('`/gratis` explica la diferencia entre gratis y a la gorra — §2.1', () => {
    /*
     * §2.1, textual: «junta `gratis` y `a-la-gorra` a propósito… **el texto de la
     * página aclara la diferencia**». Sin esa frase la página promete gratis y
     * cobra a la salida, que es lo que el §4.1 quiere evitar cuando dice que «a la
     * gorra» no es un caso raro sino la mitad de los casos.
     */
    const gratis = buscar(hubs([]), 'gratis')!;
    expect(gratis.bajada.toLowerCase()).toContain('a la gorra');
    expect(gratis.bajada.toLowerCase()).toContain('gratis');
    expect(gratis.bajada.length).toBeGreaterThan(120);
  });

  it('el rótulo del filtro nombra el eje y el valor', () => {
    // Es el chip del §4.4 sin JavaScript: lo que dice qué recorte estás viendo.
    const lista = hubs([
      entradaDePrueba({ id: 'a', slug: 'a', tipo: 'taller', barrio: 'boedo', fechas: [PROXIMA] }),
    ]);
    expect(buscar(lista, 'tipo', 'taller')!.rotuloDelFiltro).toBe('Tipo · Taller');
    expect(buscar(lista, 'barrio', 'boedo')!.rotuloDelFiltro).toBe('Barrio · Boedo');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · La tira «Explorá por»
// ───────────────────────────────────────────────────────────────────────────

describe('la tira «Explorá por» — el linkeo interno', () => {
  const lista = () =>
    hubs([
      entradaDePrueba({ id: 'a', slug: 'a', tipo: 'taller', barrio: 'boedo', fechas: [PROXIMA] }),
      entradaDePrueba({ id: 'b', slug: 'b', tipo: 'club-lectura', barrio: 'villa-crespo', fechas: [PROXIMA] }),
      entradaDePrueba({ id: 'v', slug: 'v', tipo: 'charla', fechas: [PASADA] }),
    ]);

  const MESES = [{ clave: '2026-09', nombre: 'Septiembre de 2026' }];

  it('agrupa por eje y mete los meses en la misma tira', () => {
    // §4.1 los dibuja juntos («Online · Gratis · Septiembre · Octubre») porque
    // para quien mira son la misma pregunta.
    const grupos = exploracionDelSitio(lista().filter(esIndexable), MESES, rutaDeMes);
    expect(grupos.map((g) => g.rotulo)).toEqual([
      'Por tipo',
      'Por barrio',
      'Además',
      'Mes por mes',
    ]);
  });

  it('no se enlaza a sí misma', () => {
    /*
     * Un enlace a la página en la que ya estás no lleva a ninguna parte, y le dice
     * a Google que esa URL se enlaza a sí misma. Es lo mismo que hace la
     * navegación entre meses con `otros`.
     *
     * MUTACIÓN PROBADA: ignorar `rutaActual` pone este caso en rojo.
     */
    const propia = rutaDeTipo('taller');
    const grupos = exploracionDelSitio(lista().filter(esIndexable), MESES, rutaDeMes, propia);
    const rutas = grupos.flatMap((g) => g.enlaces.map((e) => e.ruta));
    expect(rutas).not.toContain(propia);
    // Control positivo: los otros hubs siguen.
    expect(rutas).toContain(rutaDeTipo('club-lectura'));
  });

  it('un hub vacío no se enlaza', () => {
    /*
     * Es la otra mitad del invariante: enlazar una página que le pedimos a Google
     * no indexar es mandarle dos señales opuestas, y mandar a una persona a una
     * lista sin nada es peor.
     */
    const grupos = exploracionDelSitio(lista().filter(esIndexable), MESES, rutaDeMes);
    const rutas = grupos.flatMap((g) => g.enlaces.map((e) => e.ruta));
    expect(rutas).not.toContain(rutaDeTipo('charla'));
  });

  it('un grupo sin enlaces no se pinta', () => {
    // Un rótulo «Por barrio» sin barrios se lee como algo que falta.
    const grupos = exploracionDelSitio(hubs([]).filter(esIndexable), [], rutaDeMes);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Además']);
  });

  it('no se recorta: la tira es el único enlace interno de un hub', () => {
    /*
     * La tentación con veinte barrios es cortar en los diez primeros. **No se
     * corta**, y el motivo es estructural: esta tira es el único enlace interno que
     * un hub tiene, así que recortarla dejaría huérfanos justamente a los que
     * quedaron afuera del corte.
     *
     * MUTACIÓN PROBADA: un `.slice(0, 10)` en `exploracionDelSitio` pone este caso
     * en rojo.
     */
    const muchos = Array.from({ length: 14 }, (_, i) =>
      entradaDePrueba({ id: `b${i}`, slug: `b${i}`, barrio: `barrio-${i}`, fechas: [PROXIMA] }),
    );
    const opciones = {
      tipo: [],
      barrio: Array.from({ length: 14 }, (_, i) => ({ slug: `barrio-${i}` })),
    };
    const grupos = exploracionDelSitio(
      hubsOfrecidos(muchos, opciones, ETIQUETAS, AHORA),
      [],
      rutaDeMes,
    );
    const barrios = grupos.find((g) => g.rotulo === 'Por barrio')!;
    expect(barrios.enlaces.length).toBe(14);
  });

  it('el texto de la tira es corto: el plural del tipo, el nombre del barrio', () => {
    // «Talleres en Argentina» repetido veinte veces con el país en cada uno es
    // ruido: en la tira se lee el nombre, no la frase.
    const grupos = exploracionDelSitio(lista().filter(esIndexable), [], rutaDeMes);
    const textos = grupos.flatMap((g) => g.enlaces.map((e) => e.texto));
    expect(textos).toContain('Talleres');
    expect(textos).toContain('Clubes de lectura');
    expect(textos).toContain('Boedo');
    expect(textos).toContain('Online');
    expect(textos.every((t) => !t.includes('en Argentina'))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7 · Las páginas
// ───────────────────────────────────────────────────────────────────────────

describe('las cuatro páginas de hub', () => {
  const PAGINAS = [
    'src/pages/tipo/[tipo].astro',
    'src/pages/barrio/[barrio].astro',
    'src/pages/online.astro',
    'src/pages/gratis.astro',
  ];

  it('las cuatro existen y usan el mismo cuerpo', () => {
    /*
     * §4.4: «un solo componente de página con tres variables». Cuatro copias del
     * markup serían cuatro páginas que se separan en el primer cambio, y las
     * cuatro se ven bien por separado.
     */
    for (const p of PAGINAS) {
      const src = sinComentarios(fuente(p));
      expect(src, `${p} no monta el cuerpo compartido`).toContain('CuerpoDeHub');
      expect(src, `${p} no declara su sección`).toMatch(/<Base[^>]*seccion="agenda"/s);
    }
  });

  it('ninguna lee el índice ni la proyección: reciben su view-model (D-140)', () => {
    /*
     * La misma frontera que el detalle y la página de mes. La tentación acá es
     * hacer `indiceDelSitio()` en el frontmatter para sacar las etiquetas: no
     * filtra nada, y deja el índice entero —con `searchText` y `creadoEn`— al
     * alcance de un `{}`. Es la puerta que el `auditor-privacidad` encontró
     * abierta en la primera versión de la página de mes.
     */
    for (const p of [...PAGINAS, 'src/components/sitio/CuerpoDeHub.astro']) {
      const src = sinComentarios(fuente(p));
      for (const prohibido of [
        'firebase-admin',
        'adminDb',
        'toPublic',
        'ActividadPublica',
        'indiceDelSitio',
        'contenidoDelSitio()',
        'searchText',
        'difusion',
      ]) {
        expect(src, `${p} no puede nombrar ${prohibido}`).not.toContain(prohibido);
      }
    }
  });

  it('ninguna lleva JavaScript al cliente: cero islands', () => {
    /*
     * El §4.4 pide el chip y el «buscar dentro», y las dos cosas salen sin bajar un
     * byte: el rótulo del filtro y un enlace a la home ya filtrada. Montar la
     * island para filtrar veinte filas sería bajar el runtime de React a la página
     * que existe para ser rápida en un resultado de Google.
     *
     * MUTACIÓN PROBADA: agregar `client:load` a `ListaDeActividades` en
     * `CuerpoDeHub.astro` pone este caso en rojo — y no cambia nada visible.
     */
    for (const p of [...PAGINAS, 'src/components/sitio/CuerpoDeHub.astro']) {
      expect(sinComentarios(fuente(p)), `${p} monta una island`).not.toMatch(/client:/);
    }
  });

  it('las dos dinámicas envuelven `getStaticPaths`, no lo aliasean — B-237', () => {
    /*
     * Astro llama a `getStaticPaths` con un argumento propio (`{ paginate, rss }`)
     * y con el alias ese objeto cae en el parámetro `ahora`: el build muere con
     * `ahora.getTime is not a function` y ningún test unitario lo ve. Lo encontró
     * el build de verdad en B-237, y esta es la alarma barata para que no vuelva.
     */
    const casos = [
      ['src/pages/tipo/[tipo].astro', 'caminosDeTipo'],
      ['src/pages/barrio/[barrio].astro', 'caminosDeBarrio'],
    ] as const;
    for (const [p, fn] of casos) {
      const src = fuente(p);
      expect(src).not.toMatch(new RegExp(`getStaticPaths\\s*=\\s*${fn}\\s*;`));
      expect(src).toMatch(new RegExp(`getStaticPaths\\s*=\\s*\\(\\)\\s*=>\\s*${fn}\\(\\)`));
    }
  });

  it('el `noIndex` de un hub vacío sale de `esIndexable`, no de una condición suelta', () => {
    /*
     * Es la mitad del invariante que vive en la plantilla. Escrito acá como
     * `vista.hub.vacio`, los dos temáticos —que están en el sitemap y pueden estar
     * vacíos— saldrían con `noindex` y con entrada de sitemap a la vez.
     *
     * MUTACIÓN PROBADA: `noIndex={vista.hub.vacio}` pone en rojo el caso del
     * invariante de arriba y este.
     */
    for (const p of ['src/pages/tipo/[tipo].astro', 'src/pages/barrio/[barrio].astro']) {
      expect(sinComentarios(fuente(p))).toContain('noIndex={!esIndexable(vista.hub)}');
    }
    // Y los temáticos no lo llevan: no pueden quedar vacíos por estructura.
    for (const p of ['src/pages/online.astro', 'src/pages/gratis.astro']) {
      expect(sinComentarios(fuente(p))).not.toContain('noIndex');
    }
  });

  it('la home muestra la tira, y no la arma por su cuenta', () => {
    /*
     * §4.1: «"Explorá por" no es decorativo. Es la navegación sin JavaScript, y es
     * el linkeo interno que hace que los hubs existan para Google». Sin la tira en
     * la home —que es la página con más autoridad del sitio— los hubs quedan con
     * un enlace interno menos, y el de la home es el que más vale.
     */
    const home = sinComentarios(fuente('src/pages/index.astro'));
    expect(home).toContain('ExploraPor');
    expect(home).toContain('exploracionDeLaHome');
    // No deriva los grupos acá: eso es del lector, que es lo que un test puede
    // evaluar.
    expect(home).not.toContain('hubsDelSitio');
    expect(home).not.toContain('exploracionDelSitio');
  });

  it('toda página de hub está en el sitemap o entra por su propia regla', () => {
    /*
     * La dirección que se olvida, y la que `tests/sitemap.test.ts` ya vigila para
     * las estáticas: **una página nueva no entra sola al sitemap**. Los dos
     * temáticos son estáticos y tienen que estar en `RUTAS_FIJAS`; los dos
     * dinámicos entran por `hubsOfrecidos`, como las actividades y los meses.
     */
    const estaticas = execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f.endsWith('.astro') && !f.includes('['));
    expect(estaticas).toContain('src/pages/online.astro');
    expect(estaticas).toContain('src/pages/gratis.astro');
    expect(RUTAS_FIJAS).toContain(RUTA_ONLINE);
    expect(RUTAS_FIJAS).toContain(RUTA_GRATIS);
  });
});
