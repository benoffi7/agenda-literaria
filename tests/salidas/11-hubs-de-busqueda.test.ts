/**
 * Salida 11: los hubs de búsqueda (B-108).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import type { ClaseDeHub, Hub } from '@/lib/hubsPublicos';
import { CLASES_DE_HUB, coleccionSchema, hubDelSitio } from '@/lib/hubsPublicos';
import { RUTA_AGENDA } from '@/lib/rutasPublicas';
import { CENTINELA, actividadCentinela } from '../fixtures/centinelas';
import type { RutaCentinela } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';

describe('barrido de los hubs de búsqueda (§5, salida 11, B-108)', () => {
  /*
   * **Cuatro páginas indexadas nuevas** —`/tipo/{slug}`, `/barrio/{slug}`,
   * `/gratis`, `/online`— y una sola productora, `src/lib/hubsPublicos.ts`. Entran
   * al barrido **al integrarse**, no en el commit que las creó: el frente que las
   * escribió cayó con el ítem abierto y las dejó fuera de las tres listas de
   * salidas. La suite quedó verde igual, porque el índice de salidas solo se
   * compara **consigo mismo** — es el mismo hueco de índice del 2026-08-27, la
   * cuarta vez que aparece, y lo que lo cierra de verdad es este `describe`.
   *
   * ── Qué se barre ──────────────────────────────────────────────────────────
   * Lo mismo que en la salida 8, y por el mismo motivo: las filas las pinta el
   * componente que ya barre el índice del listado, así que lo **nuevo** de esta
   * salida son las frases que arma `hubsPublicos.ts`. Y una de ellas interpola
   * títulos de actividades:
   *
   *     .slice(0, CUANTOS_TITULOS_EN_LA_DESCRIPCION).map((e) => e.titulo)
   *
   * Un carácter separa eso de meter tres descripciones normalizadas en una
   * `meta description` — con el agravante de que acá son **cuatro rutas** y no
   * una, y las de taxonomía se multiplican por cada barrio y cada tipo en uso.
   *
   * ── Las dos mitades de la etiqueta ────────────────────────────────────────
   * Un hub de taxonomía se titula con **la etiqueta** («Villa Crespo») y se
   * direcciona con **el slug** (trampa 10). Por eso el barrido corre **dos veces
   * sobre cada hub, con listas distintas**: en el texto visible tiene que salir la
   * etiqueta y **no** el slug, y en la URL exactamente al revés. Escrito en un
   * solo barrido no afirmaría ninguna de las dos cosas — el slug pasaría por
   * permitido en las frases nada más porque está en la ruta, que es justo la
   * confusión que la trampa 10 describe. La lista de permitidos es **por hub**
   * y no una sola para los cuatro, justamente para poder afirmarlo: `barrer` exige
   * que cada excepción declarada **aparezca de verdad**, así que poner
   * `labels.barrio` en el hub de tipo no es una excepción de más, es una
   * afirmación falsa — y el barrido la rechaza. Los dos temáticos no llevan
   * ninguna etiqueta, y eso también queda dicho.
   *
   * MUTACIÓN PROBADA: cambiar ese `e.titulo` por `e.searchText` hace fallar el
   * primer barrido nombrando el centinela de `descripcion`; titular con el slug
   * crudo en vez de `etiquetaDe` hace fallar el caso de la etiqueta.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  const ETIQUETAS = mapaDeEtiquetas({
    tipo: [{ slug: 'presentacion', label: CENTINELA['labels.tipo'] }],
    barrio: [{ slug: CENTINELA['sede.barrio'], label: CENTINELA['labels.barrio'] }],
    // B-950 — las dos de la geografía. Sin estas líneas `etiquetaDe` cae a
    // `desSlug` y el barrido mediría el respaldo en vez de la resolución.
    ciudad: [{ slug: CENTINELA['sede.ciudad'], label: CENTINELA['labels.ciudad'] }],
    provincia: [{ slug: CENTINELA['sede.provincia'], label: CENTINELA['labels.provincia'] }],
  });

  /** Tres centinelas con distinto id, como en la salida 8. */
  const entradas = (extra: Parameters<typeof actividadCentinela>[0] = {}) =>
    ['act_hub_1', 'act_hub_2', 'act_hub_3'].map((id) =>
      entradaDeIndice(toPublic(actividadCentinela(extra), id)),
    );

  /**
   * Las cuatro clases, con lo que cada una necesita para no salir vacía.
   *
   * `gratis` filtra por `arancel.tipo ∈ {gratis, a-la-gorra}`, y el fixture trae
   * ahí un centinela: sin pisarlo, ese hub no tiene ninguna actividad y el barrido
   * correría sobre la nada. Se pisa **solo ese campo** —el resto de los centinelas
   * queda—, con el costo explícito de que en ese hub el barrido no puede detectar
   * una fuga de `arancel.tipo`; los otros tres sí, y ahí el centinela sigue puesto.
   */
  const LOS_HUBS: readonly {
    clase: ClaseDeHub;
    slug: string;
    extra?: Parameters<typeof actividadCentinela>[0];
    /** Los centinelas de etiqueta que ESTE hub sí publica, en su título. */
    etiquetas: readonly RutaCentinela[];
  }[] = [
    { clase: 'tipo', slug: 'presentacion', etiquetas: ['labels.tipo'] },
    { clase: 'barrio', slug: CENTINELA['sede.barrio'], etiquetas: ['labels.barrio'] },
    /*
     * **B-951 — la quinta clase, y entró sin barrer hasta que lo cobró el
     * `auditor-privacidad`.** El hub de ciudad estrena cinco frases en HTML
     * indexado —`titulo`, `descripcion` (que interpola hasta tres títulos de
     * actividades), `bajada`, `avisoVacio` y `rotuloDelFiltro`— y esta lista
     * seguía recorriendo cuatro, sin que ningún rojo lo dijera. Es la regla del §5
     * textual: si la salida se arma interpolando texto, tiene que existir un
     * barrido de centinelas.
     */
    { clase: 'ciudad', slug: CENTINELA['sede.ciudad'], etiquetas: ['labels.ciudad'] },
    {
      clase: 'gratis',
      slug: '',
      extra: { arancel: { tipo: 'gratis', notas: CENTINELA['arancel.notas'] } },
      etiquetas: [],
    },
    { clase: 'online', slug: '', etiquetas: [] },
  ];

  /*
   * **El ancla que faltaba**: sin esto, la clase de hub número seis vuelve a
   * entrar sin barrido y sin que nada se ponga en rojo — que es exactamente lo
   * que pasó con la quinta. Se compara contra `CLASES_DE_HUB`, que es quien
   * declara cuántas hay.
   */
  it('el barrido cubre las cinco clases de hub, y ninguna más (§5, salida 11)', () => {
    expect([...LOS_HUBS].map((h) => h.clase).sort()).toEqual([...CLASES_DE_HUB].sort());
  });

  /** Las frases que se leen en la pantalla: acá va la etiqueta, no el slug. */
  const frasesDelHub = (h: Hub): string =>
    [
      h.titulo,
      h.descripcion,
      h.bajada,
      h.etiqueta,
      h.textoEnLaTira,
      h.avisoVacio,
      h.rotuloDelFiltro,
    ].join(' | ');

  /** Lo direccionable: acá va el slug, y es lo correcto. */
  const rutasDelHub = (h: Hub): string => [h.ruta, h.queryEnLaAgenda].join(' | ');

  const PORQUE_EL_TITULO =
    '§5.1 — la `meta description` de un hub nombra hasta tres títulos, el mismo corte ' +
    'que la página de mes y por el mismo motivo (~160 caracteres útiles). El título ya ' +
    'es público en el listado y en la página de detalle; lo que esta lista fija es que ' +
    '**solo** el título entre, y no el resumen, el `searchText` ni el nombre de quien ' +
    'organiza.';

  const PORQUE_LA_ETIQUETA =
    '§4.1 — el hub se titula con la etiqueta resuelta y no con el slug (trampa 10). Las ' +
    'etiquetas de `/opciones/*` ya viajan enteras en el `events.json` (salida 1) para ' +
    'pintar los chips de filtro, así que no agregan nada que no fuera público.';

  /** Los permitidos de un hub: la etiqueta siempre, el título solo si hay entradas. */
  const permitidos = (
    etiquetas: readonly RutaCentinela[],
    conEntradas: boolean,
  ): readonly Excepcion[] => [
    ...(conEntradas
      ? [
          {
            nombre: 'los títulos de las tres primeras actividades',
            centinelas: ['titulo'] as const,
            porque: PORQUE_EL_TITULO,
          },
        ]
      : []),
    ...(etiquetas.length
      ? [
          {
            nombre: 'la etiqueta de la taxonomía que da nombre al hub',
            centinelas: [...etiquetas],
            porque: PORQUE_LA_ETIQUETA,
          },
        ]
      : []),
  ];

  it('el fixture hace existir los cuatro hubs y ninguno queda vacío', () => {
    // Control positivo: sin esto, un hub que dejó de generarse pasaría la mitad
    // «no sobra nada» del barrido y el error hablaría de otra cosa.
    for (const { clase, slug, extra } of LOS_HUBS) {
      const h = hubDelSitio(clase, slug, entradas(extra), ETIQUETAS, AHORA);
      expect(h.vacio, `el hub ${clase} quedó vacío y no barre nada`).toBe(false);
      expect(h.entradas, `el hub ${clase}`).toHaveLength(3);
      expect(frasesDelHub(h).length).toBeGreaterThan(60);
    }
  });

  it('en las frases de los cuatro hubs sobreviven solo el título y su etiqueta', () => {
    for (const { clase, slug, extra, etiquetas } of LOS_HUBS) {
      const h = hubDelSitio(clase, slug, entradas(extra), ETIQUETAS, AHORA);
      barrer(`hub ${clase}`, frasesDelHub(h), permitidos(etiquetas, true), {
        insensible: true,
      });
    }
  });

  it('y en la URL va el slug y no la etiqueta — la otra mitad de la trampa 10', () => {
    /*
     * El complemento del caso anterior, y la razón de que sean dos: acá el slug
     * **tiene que** aparecer. Un hub de barrio se direcciona `/barrio/{slug}`
     * porque el label se renombra y una URL no (§4.1). Si alguien invirtiera las
     * dos —etiqueta en la ruta, slug en el título— el barrido de arriba seguiría
     * verde y este se pondría rojo.
     */
    const conSlugCentinela = LOS_HUBS.filter(({ slug }) => slug === CENTINELA['sede.barrio']);
    expect(conSlugCentinela, 'ningún hub direcciona con un centinela').toHaveLength(1);

    for (const { clase, slug, extra } of conSlugCentinela) {
      const h = hubDelSitio(clase, slug, entradas(extra), ETIQUETAS, AHORA);
      expect(rutasDelHub(h)).toContain(CENTINELA['sede.barrio']);
      expect(rutasDelHub(h)).not.toContain(CENTINELA['labels.barrio']);
    }
  });

  it('y con el hub vacío tampoco cambia lo que sale', () => {
    /*
     * La otra rama de las frases: la página **existe igual** con `noindex` y dice
     * otra cosa (`avisoVacio`). Sin este caso esa mitad no la barre nadie — que es
     * exactamente cómo la salida 7 tuvo el link de la reunión cubierto solo de
     * refilón hasta que se le agregó su segunda rama.
     */
    for (const { clase, slug, etiquetas } of LOS_HUBS) {
      const vacio = hubDelSitio(clase, slug, [], ETIQUETAS, AHORA);
      expect(vacio.vacio, `el hub ${clase} sin entradas debería estar vacío`).toBe(true);
      barrer(`hub ${clase} (vacío)`, frasesDelHub(vacio), permitidos(etiquetas, false), {
        insensible: true,
      });
    }
  });

  it('el hub no agrega ni un campo a la entrada: deriva de la salida 1', () => {
    /*
     * La afirmación de **forma**, la que sobrevive a que cambie la lista de
     * permitidos: un hub es la home filtrada, así que por construcción solo puede
     * **sacar**. Si algún día alguien le pasa el documento en vez de la entrada del
     * índice, las claves dejan de coincidir y esto lo dice.
     */
    for (const { clase, slug, extra } of LOS_HUBS) {
      const propias = entradas(extra);
      const enElHub = hubDelSitio(clase, slug, propias, ETIQUETAS, AHORA).entradas[0];
      expect(enElHub, `el hub ${clase} no dejó ninguna entrada`).toBeDefined();
      expect(Object.keys(enElHub!).sort(), `el hub ${clase}`).toEqual(
        Object.keys(propias[0]!).sort(),
      );
    }
  });

  /*
   * `coleccionSchema` — B-107, el `CollectionPage`/`ItemList`. Vive en
   * `hubsPublicos.ts` (por eso el barrido va acá y no en un `describe` propio)
   * pero lo usan **cinco** páginas: los cuatro hubs de este bloque y la home
   * (salida 1) — `src/pages/index.astro:92`. Es la misma superficie que
   * `frasesDelHub` ya cubre —un `name` que puede llevar la etiqueta de la
   * taxonomía y un `itemListElement` con los títulos de las entradas— así que
   * reusa los mismos `permitidos()` de arriba, sin agregar ninguna categoría.
   */
  /**
   * `coleccionSchema` agrega una excepción propia sobre `permitidos()`: **el
   * `slug` de cada entrada**, que va en el `url` de su `ListItem`. No es una
   * fuga — es exactamente el mismo dato que ya es el `href` de cada fila del
   * listado (§5.1) — pero `permitidos()` no lo declara porque `frasesDelHub`
   * (arriba) nunca mira una URL. Mismo criterio que `PERMITIDO_EN_EL_JSON_LD`,
   * que también agrega `slug` sobre lo que el `Event` necesita.
   */
  const CON_SLUG = (
    etiquetas: readonly RutaCentinela[],
    /**
     * El slug **del propio hub** (no el de sus entradas): el `url` del
     * `CollectionPage` es `h.ruta`, y un hub de barrio o de tipo direcciona con
     * su slug (trampa 10) — la otra mitad de lo que ya afirma «y en la URL va
     * el slug y no la etiqueta», dos describes más arriba.
     */
    rutaDelHub: readonly RutaCentinela[] = [],
  ): readonly Excepcion[] => [
    ...permitidos(etiquetas, true),
    {
      nombre: 'la URL de la página y de cada entrada',
      centinelas: ['slug', ...rutaDelHub] as const,
      porque:
        'el `url` del `CollectionPage` es la ruta del propio hub o de la home, y el `url` de ' +
        'cada `ListItem` es la URL de detalle — el slug con el origen adelante. El mismo dato ' +
        'que ya es el `href` de cada fila y la propia URL de la página.',
    },
  ];

  /**
   * A diferencia de `frasesDelHub` (arriba), `coleccionSchema` recibe **solo**
   * `h.titulo` — no ve `h.etiqueta` por separado. Para `barrio` eso no cambia
   * nada: `titulo` es `Actividades literarias en ${etiqueta}`, la etiqueta cruda
   * entra igual. Para `tipo` sí cambia: con un slug **fijo** (`presentacion`,
   * en `TIPO_EN_PLURAL` de `hubsPublicos.ts`) el título usa el plural fijo
   * («Presentaciones») e ignora la etiqueta que le pasaron — así que acá el
   * centinela de tipo **no puede** sobrevivir con el fixture de este archivo, y
   * declararlo haría fallar `barrer` por sobra. (Con un tipo creado desde
   * «Otro» sí aparecería: no está en `TIPO_EN_PLURAL` y `pluralDeTipo` cae al
   * `?? etiqueta`.)
   */
  const ETIQUETA_EN_EL_TITULO_DEL_HUB: Partial<Record<ClaseDeHub, readonly RutaCentinela[]>> = {
    barrio: ['labels.barrio'],
    // B-951 — la quinta clase, con el mismo molde que el barrio: su `titulo` es
    // `Actividades literarias en ${etiqueta}`, así que la etiqueta entra igual.
    ciudad: ['labels.ciudad'],
  };

  /** El slug con el que direcciona cada clase (trampa 10) — `barrio` y `ciudad` usan uno centinela. */
  const SLUG_DEL_HUB: Partial<Record<ClaseDeHub, readonly RutaCentinela[]>> = {
    barrio: ['sede.barrio'],
    ciudad: ['sede.ciudad'],
  };

  it('coleccionSchema de los cinco hubs publica lo mismo que sus frases — nada más', () => {
    /*
     * MUTACIÓN PROBADA: agregar `e.tipo` o `e.searchText` a un `ListItem` de
     * `coleccionSchema` deja este caso en rojo nombrando el centinela que se
     * coló — la función solo debería tocar `slug` y `titulo` de cada entrada.
     */
    for (const { clase, slug, extra } of LOS_HUBS) {
      const h = hubDelSitio(clase, slug, entradas(extra), ETIQUETAS, AHORA);
      const schema = coleccionSchema(h.titulo, h.ruta, h.entradas);
      barrer(
        `CollectionPage del hub ${clase}`,
        JSON.stringify(schema),
        CON_SLUG(ETIQUETA_EN_EL_TITULO_DEL_HUB[clase] ?? [], SLUG_DEL_HUB[clase] ?? []),
        { insensible: true },
      );
    }
  });

  it('coleccionSchema de la home publica solo los títulos y las URLs, sin ninguna etiqueta', () => {
    // La home no tiene taxonomía en su nombre —es un título escrito a mano—,
    // así que acá la única excepción que puede sobrevivir además del slug es
    // la de los títulos.
    const propias = entradas();
    const schema = coleccionSchema(
      'Talleres, clubes de lectura y encuentros literarios en Argentina',
      RUTA_AGENDA,
      propias,
    );
    barrer('CollectionPage de la home', JSON.stringify(schema), CON_SLUG([]), {
      insensible: true,
    });
  });
});
