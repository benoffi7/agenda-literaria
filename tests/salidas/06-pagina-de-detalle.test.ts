/**
 * Salida 6: la página de detalle (B-227).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { opcionesPublicas, toPublic } from '@/lib/toPublic';
import { entradaDeIndice } from '@/lib/eventsJson';
import { datosEstructurados, detalleDeActividad, migasDeDetalle } from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import type { TipoActividad } from '@/types/actividad';
import { CENTINELA, actividadCentinela, conDosFormasDeCursar, conDosSedes, conLinkPublico } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';
import { CENTINELA_DEL_DETALLE } from '../../scripts/gate-build/semilla.mjs';
import { canastaDelGateCoincide, MOTIVO_DE_CANCELACION } from '../fixtures/barrido-de-salidas';

/**
 * §4.3 del diseño — barrido de la **página de detalle** — B-227.
 *
 * Es la **cuarta** proyección en serie sobre el mismo documento, y la primera que
 * es una *página* y no un archivo de datos: `toPublic` decide qué puede ser
 * público, `entradaDeIndice` qué necesita el listado, `opcionesPublicas` las
 * taxonomías, y `detalleDeActividad` qué muestra el detalle — que es **más** que
 * el índice y **menos** que `toPublic`.
 *
 * ── Por qué se barre el view-model y no el HTML ───────────────────────────
 * Porque el HTML no se puede barrer desde vitest: un `.astro` no se importa. La
 * respuesta de este cambio no fue «entonces no lo cubrimos», fue mover la
 * decisión a un módulo puro (**D-140**): la plantilla recibe **solo** este objeto,
 * así que lo que no esté acá no puede aparecer en la página — no porque nadie lo
 * escriba, sino porque no lo tiene.
 *
 * La otra mitad de esa afirmación —que la plantilla no reciba nada más— la fija
 * `tests/pagina-de-detalle.test.ts`, leyendo el `.astro`. Las dos juntas son la
 * cobertura; ninguna sola alcanza.
 *
 * ── Y el JSON-LD se barre aparte ──────────────────────────────────────────
 * Se arma con otra función y termina en un `<script>` de la misma página, o sea
 * que es una superficie propia: el §5.4 del diseño tiene una regla que **solo**
 * aplica ahí (el link de la reunión no va al JSON-LD ni con el flag), y una regla
 * que solo aplica a un lado necesita su propio caso.
 *
 * ── El barrido va insensible a mayúsculas, y hay un motivo ────────────────
 * `urlSegura` pasa las URLs por `new URL()`, que **normaliza el host a
 * minúscula**: el centinela `CENTINELA.material.url.publico` sale como
 * `centinela.material.url.publico`. Comparar sensible daría «dejó de publicar»
 * sobre algo que sí se publicó. Insensible es además estrictamente más estricto
 * para la dirección que importa: una fuga en otra caja también se atrapa.
 */
describe('barrido de la página de detalle (§4.3 del diseño, B-227)', () => {
  /*
   * Un tipo que NO está en `TIPO_EN_PLURAL` (`hubsPublicos.ts`) — a propósito,
   * para el barrido de la miga: `pluralDeTipo('presentacion', …)` ignora la
   * etiqueta y devuelve el plural fijo «Presentaciones», así que con el tipo
   * del fixture (`presentacion`, fijo por B-227 más abajo) el centinela nunca
   * llegaría a `migasDeDetalle`. Este slug SÍ cae al fallback (`?? etiqueta`).
   *
   * `TipoActividad` es el tipo cerrado del **formulario**; una taxonomía
   * autogestionada (§4 del `CLAUDE.md`) admite valores que el form todavía no
   * conoce, así que el cast es legítimo y no un escape del tipo real.
   */
  const TIPO_LIBRE = 'centinela-tipo-libre' as unknown as TipoActividad;

  const ETIQUETAS = mapaDeEtiquetas({
    tipo: [
      { slug: 'presentacion', label: CENTINELA['labels.tipo'] },
      { slug: TIPO_LIBRE, label: CENTINELA['labels.tipo'] },
    ],
    barrio: [{ slug: CENTINELA['sede.barrio'], label: CENTINELA['labels.barrio'] }],
    // B-950 — las dos de la geografía. Sin estas líneas `etiquetaDe` cae a
    // `desSlug` y el barrido mediría el respaldo en vez de la resolución.
    ciudad: [{ slug: CENTINELA['sede.ciudad'], label: CENTINELA['labels.ciudad'] }],
    provincia: [{ slug: CENTINELA['sede.provincia'], label: CENTINELA['labels.provincia'] }],
    plataforma: [
      { slug: CENTINELA['online.plataforma'], label: CENTINELA['labels.plataforma'] },
    ],
    arancel: [{ slug: CENTINELA['arancel.tipo'], label: CENTINELA['labels.arancel'] }],
    tags: [{ slug: CENTINELA.tags, label: CENTINELA['labels.tags'] }],
    // B-830 — la clave es el nombre de la **taxonomía** (`incluye-actividad`) y
    // no el del campo del documento (`incluye`). Sin esta línea `etiquetaDe` cae
    // al `desSlug` y la página publicaría el slug crudo, que es justo lo que el
    // caso de abajo prohíbe.
    'incluye-actividad': [{ slug: CENTINELA.incluye, label: CENTINELA['labels.incluye'] }],
  });

  /*
   * **Antes de la primera sesión y antes del cierre de inscripción**, a
   * propósito: es el estado en el que la página publica **más** —hay CTA, hay
   * `offers` en el JSON-LD, no hay franja de «ya pasó»—, y un barrido tiene que
   * correr sobre la superficie más grande. Con un «ahora» posterior, media lista
   * de excepciones pasaría por ausente sin que nadie lo note.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');
  /*
   * Los matices elegidos (D-153). Con un matiz adentro y no vacío, para que el
   * barrido corra sobre un `tipoColor` **elegido** y no sobre el derivado — que es
   * la rama que la pantalla usa cuando alguien pintó el tipo desde Opciones.
   *
   * Acá no hay ningún centinela y no puede haberlo: `TonosDeTipo` es
   * `Record<string, number>`, así que por este mapa no entra una cadena. Que el
   * color no copie nada del documento lo detecta el barrido por el otro lado —los
   * campos del documento **sí** son centinelas—, no por este fixture.
   */
  const TONOS = { presentacion: 195 };
  const detalleDe = (over = {}) =>
    detalleDeActividad(
      toPublic(actividadCentinela(over), 'act_centinela'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );

  /**
   * **El mismo detalle, pero con los hubs emitidos** — B-951, y lo cobró el
   * `auditor-privacidad`.
   *
   * `detalleDe` llama a `detalleDeActividad` **sin** el argumento `rutaDeZona`,
   * así que corre con el default `SIN_HUBS` y todos los `href` son `null`. En el
   * build real `caminosDeDetalle` sí lo pasa, y el view-model lleva
   * `donde[].href = '/barrio/{slug}/'` y `'/ciudad/{slug}/'` — o sea el **slug
   * crudo**, adentro de una URL.
   *
   * O sea que el barrido no estaba mirando la superficie que B-951 agregó, y el
   * `porque` que declaraba la ausencia de `sede.ciudad` («si el slug crudo
   * reaparece acá es que la resolución se salteó») era falso: en producción
   * reaparece, legítimamente, como el `href` de su propio hub.
   */
  const detalleConHubsDe = () =>
    detalleDeActividad(
      toPublic(actividadCentinela(), 'act_centinela'),
      ETIQUETAS,
      AHORA,
      TONOS,
      false,
      {},
      false,
      (campo, slug) =>
        campo === 'barrio'
          ? `/barrio/${slug}/`
          : campo === 'ciudad'
            ? `/ciudad/${slug}/`
            : null,
    );

  /** El mismo fixture con otro reloj, para activar las ramas que dependen del tiempo. */
  const detalleDeCon = (ahora: Date) =>
    detalleDeActividad(
      toPublic(actividadCentinela(), 'act_centinela'),
      ETIQUETAS,
      ahora,
      TONOS,
    );

  /**
   * El mismo fixture con la **actividad cancelada** — B-110.
   *
   * La bandera es el cuarto argumento: `estado` no se proyecta, así que quien
   * sabe de qué query salió el documento es el lector y no la actividad.
   */
  const detalleCanceladoDe = (over = {}) =>
    detalleDeActividad(
      toPublic(actividadCentinela(over), 'act_centinela'),
      ETIQUETAS,
      AHORA,
      TONOS,
      true,
    );

  /**
   * El mismo fixture, pero **con el hub de su tipo existiendo** — B-107.
   *
   * `tipoTieneHub` es el séptimo argumento: solo el lector sabe si alguna otra
   * actividad publicada comparte el tipo, así que el `barrer()` de la miga con
   * sus tres niveles lo pide explícito.
   */
  const detalleConHubDe = (over = {}) =>
    detalleDeActividad(
      toPublic(actividadCentinela(over), 'act_centinela'),
      ETIQUETAS,
      AHORA,
      TONOS,
      false,
      {},
      true,
      undefined,
      // B-1800: ofrecido además de emitido, para que el barrido siga viendo
      // `masDelTipo` distinto de `null` en una pasada.
      true,
    );

  const PERMITIDO_EN_EL_DETALLE: readonly Excepcion[] = [
    {
      nombre: 'identidad',
      centinelas: ['titulo', 'slug', 'descripcion'],
      porque:
        'es la actividad: el título y la descripción **completa** son la razón por la que ' +
        'existe esta página (el índice lleva solo el resumen), y el slug es su propia URL. ' +
        'El `searchText` NO está: es el índice de la búsqueda del listado y en el detalle no ' +
        'lo usa nadie — publicarlo sería la descripción por segunda vez.',
    },
    {
      nombre: 'la galería',
      centinelas: ['imagenes.url', 'imagenes.epigrafe'],
      porque:
        'la URL es lo que el navegador va a pedir igual y el epígrafe se muestra debajo de la ' +
        'foto (D-125). `imagenes.id` NO está —es el handle de la fila, y en una página no ' +
        'identifica nada— y `storagePath` tampoco (§5.1).',
    },
    {
      nombre: 'quién',
      centinelas: [
        'organizador.nombre',
        'organizador.instagram',
        'organizador.web',
        'tallerista.nombre',
        'tallerista.bio',
        'tallerista.instagram',
      ],
      porque:
        'el bloque «Quién lo da» y el «Organiza»: la bio del tallerista es justamente lo que ' +
        'el índice recorta y el detalle sí muestra. Los handles y la web salen como **texto** ' +
        'aunque no se pueda armar un link válido — perder el dato por un formato raro es peor ' +
        'que no linkearlo.',
    },
    {
      nombre: 'la obra presentada',
      centinelas: ['libro.titulo', 'libro.autor'],
      porque: 'DEC-1 / D-126 — es el dato central de una presentación.',
    },
    {
      nombre: 'los encuentros, con su contenido',
      centinelas: ['sesiones.id', 'sesiones.tema', 'sesiones.lectura'],
      porque:
        'el tema y la lectura de cada encuentro son la mitad del valor de un ciclo (§2.2) y ' +
        'son lo que el índice deja afuera. El id es el uuid del §3.1 y acá tiene un uso ' +
        'concreto: es el ancla `#ses_…` de la fila. `calendarEventId` NO está: es interno.',
    },
    {
      nombre: 'las opciones para sumarse',
      centinelas: ['comisiones.etiqueta'],
      porque:
        'B-181 — es la página donde la lista de encuentros se muestra entera, así que es ' +
        'donde el malentendido vive: dieciséis fechas de corrido se leen como un ciclo de ' +
        'dieciséis encuentros y son cuatro de cuatro. La etiqueta es el encabezado de cada ' +
        'grupo. **`comisiones.id` NO está, y lo estuvo por error**: el permiso decía «es con ' +
        'lo que el view-model agrupa», que describe un paso interno y no una necesidad de la ' +
        'página — el agrupado se resuelve dentro de `detalleDeActividad` y la plantilla solo ' +
        'usa la etiqueta. Lo cobró el `auditor-privacidad`, y la asimetría con `sesiones.id` ' +
        'es justo el punto: aquél está permitido porque **es** el ancla `#ses_…` del `<li>`, ' +
        'un consumidor verificable. Un permiso para algo que nunca se pinta es la clase de ' +
        'excepción que después habilita al campo siguiente.',
    },
    {
      nombre: 'dónde, completo',
      centinelas: [
        'modalidades.id',
        'sede.nombre',
        'sede.direccion',
        'sede.indicaciones',
      ],
      porque:
        'sin la dirección y el «timbre del fondo» nadie llega: es el punto de una actividad ' +
        'presencial y es lo que el índice no lleva. La dirección sale además dentro del link ' +
        'de Google Maps, escapada — el mismo `construirLinkMapa` que usa el evento (D-20). ' +
        '**`sede.ciudad` salió de esta lista con B-950/B-951**: dejó de ser texto libre, así ' +
        'que la ficha la resuelve a su etiqueta como venía haciendo con el barrio, y lo que ' +
        'sale está en la lista de abajo. Ojo que esta corrida usa el default `SIN_HUBS`, o ' +
        'sea sin ningún `href`: con los hubs emitidos el slug **sí** sale, adentro de la URL ' +
        'de su propio hub, y eso lo barre el `it` de abajo con `detalleConHubsDe`. Lo cobró ' +
        'el `auditor-privacidad`, porque el motivo que esta celda decía antes era falso.',
    },
    {
      nombre: 'las etiquetas de /opciones, no los slugs',
      centinelas: [
        'labels.tipo',
        'labels.barrio',
        // B-950/B-951 — la geografía del renglón «Dónde», resuelta. El fixture no
        // es de CABA, así que `piezasDeLugar` emite la ciudad y la provincia; en
        // una sede de CABA saldría el barrio solo, que es la regla de B-953.
        'labels.ciudad',
        'labels.provincia',
        'labels.plataforma',
        'labels.arancel',
        'labels.tags',
        'labels.incluye',
      ],
      porque:
        '§4.1 — la actividad guarda el slug y la página muestra la **etiqueta**: «a-la-gorra» ' +
        'crudo en una página pública se ve roto. Es la misma decisión que el evento de ' +
        'Calendar. Los slugs correspondientes NO están permitidos: si aparecen, la resolución ' +
        'se salteó.',
    },
    {
      nombre: 'inscripción y arancel',
      centinelas: ['inscripcion.destino', 'arancel.notas'],
      porque:
        'el destino es el canal de inscripción y sale incluso con el cupo completo (D-127); ' +
        'las notas del arancel son las condiciones. Acá el destino del fixture no es un mail ' +
        'válido, así que no hay botón y se muestra como texto — que es el comportamiento ' +
        'buscado, no un accidente.',
    },
    {
      nombre: 'material',
      centinelas: ['material.titulo.publico', 'material.titulo.privado', 'material.url.publico'],
      porque:
        '§5.2 — de un item sobreviven siempre tipo y título; la URL solo con `publico: true`. ' +
        'La URL del privado NO está, y es la celda que importa.',
    },
  ];

  it('la canasta del detalle del gate dice lo mismo que ésta (B-1761)', () => {
    // El motivo de un encuentro cancelado entra acá solo en los casos
    // cancelados (`MOTIVO_DE_CANCELACION`); el gate siembra uno, así que su
    // canasta lo permite siempre.
    canastaDelGateCoincide(CENTINELA_DEL_DETALLE, [
      ...PERMITIDO_EN_EL_DETALLE,
      MOTIVO_DE_CANCELACION,
    ]);
  });

  const PERMITIDO_EN_EL_JSON_LD: readonly Excepcion[] = [
    {
      nombre: 'lo que Google necesita para el resultado enriquecido',
      centinelas: [
        'titulo',
        'descripcion',
        'organizador.nombre',
        'organizador.web',
        'tallerista.nombre',
        'sede.nombre',
        'sede.direccion',
        // B-950 — el `addressLocality` es la **etiqueta** de la ciudad desde que
        // `ciudad` es taxonomía: mandarle `mar-del-plata` a Google en un dato
        // estructurado es peor que en la página, porque una máquina lo cosecha
        // literal.
        'labels.ciudad',
        'sesiones.tema',
        'imagenes.url',
        'labels.plataforma',
        'labels.arancel',
        'slug',
        'sesiones.id',
        'comisiones.etiqueta',
      ],
      porque:
        '§5.2 — `name`, `description` (el resumen), `organizer`, `performer`, `location` con ' +
        'su `PostalAddress`, el `name` de cada `subEvent` (que lleva el tema), la `image` y ' +
        'la `category` del `Offer`. **El barrio NO está**: `PostalAddress` lleva ' +
        '`addressLocality` (la ciudad) y no el barrio, así que no hay dónde ponerlo sin ' +
        'inventar un campo. `inscripcion.destino`, las `indicaciones`, la `bio`, el ' +
        '`material` y el `libro` tampoco: nada de eso es parte de un `Event` y publicarlo ' +
        'en un formato que las máquinas cosechan es gratis para el que cosecha. ' +
        '**El `slug` entró con B-109**: desde que el dominio existe, el JSON-LD lleva la ' +
        'canónica de la actividad (`url`, el `url` del `VirtualLocation` del §5.4 y el del ' +
        '`Offer`), y una canónica es el slug con el origen adelante. Es el mismo dato que ' +
        'ya es la URL de la página y el `href` de cada fila del listado — no hay campo ' +
        'nuevo, hay un dato público escrito completo. ' +
        '**Y `sesiones.id` entró con B-733**, aprobado por el dueño el 2026-09-07: cada ' +
        '`subEvent` lleva el ancla de su propia fila (`…/actividad/x/#ses_9f2a`) en vez ' +
        'del `url` de la página repetido N veces. **Este barrido lo frenó cuando se ' +
        'intentó sin permiso, y tenía razón**: agregar un centinela a esta lista es una ' +
        'decisión del dueño y no de un frente. Lo que la hace aceptable es que el uuid ' +
        '**ya es público en el HTML de esta misma página** —es el ancla de la fila, ' +
        '`id={e.id}` en el `<li>`— así que es el mismo dato en el mismo documento, no un ' +
        'dato nuevo. El `Offer` y el `VirtualLocation` **siguen sin ancla**: el arancel y ' +
        'el acceso son de la actividad y no de una de sus filas. ' +
        '**`comisiones.etiqueta` entró con B-181**, y por el mismo camino que el tema: el ' +
        '`name` de cada `subEvent` sale de `tituloDeEvento`, la misma función que arma el ' +
        '`summary` del evento de Calendar, y con opciones para sumarse eso incluye la ' +
        'etiqueta («Club de Saer — Martes 19 h»). Es texto que el dueño escribe para ' +
        'mostrarlo, y sin él Google recibe dieciséis `subEvent` con el mismo nombre. ' +
        '**`comisiones.id` NO está**: el JSON-LD ya tiene el ancla de la fila y no ' +
        'necesita el id del grupo.',
    },
  ];

  /**
   * `migasDeDetalle` — B-107, el `BreadcrumbList`. Superficie propia por el
   * mismo motivo que `PERMITIDO_EN_EL_JSON_LD`: se arma con otra función y
   * termina en un `<script>` de la misma página.
   *
   * **`labels.tipo` entra acá y no en `PERMITIDO_EN_EL_JSON_LD`**: el `Event` no
   * nombra el tipo en ninguna parte (el subtipo de schema.org es un `@type`, no
   * un dato interpolado), y la miga sí — es el segundo nivel, «Agenda → Tipo →
   * título». Ya viaja entero en el `events.json` para pintar los chips (salida
   * 1), así que no agranda nada.
   */
  const PERMITIDO_EN_LA_MIGA: readonly Excepcion[] = [
    {
      nombre: 'identidad y el segundo nivel de la miga',
      centinelas: ['titulo', 'slug', 'labels.tipo'],
      porque:
        '§5.5 — Agenda → {Tipo} → {título}. El título y el slug son la propia página; ' +
        '`labels.tipo` es el plural resuelto del tipo (`pluralDeTipo`), el mismo texto que ' +
        'ya nombra al hub de ese tipo. Nada del documento crudo: `migasDeDetalle` solo lee ' +
        '`titulo`, `slug`, `tipo` y `tipoEtiqueta` del view-model.',
    },
  ];

  it('la miga con hub publica el título, el slug y el plural del tipo — nada más (B-107)', () => {
    /*
     * MUTACIÓN PROBADA: agregar `descripcion` o `searchText` a un `ListItem` de
     * `migasDeDetalle` deja este caso en rojo nombrando el centinela que se
     * coló — el mismo modo de falla que el JSON-LD del `Event` ya tenía cubierto
     * y que esta función, por ser nueva, no heredaba.
     */
    barrer(
      'BreadcrumbList del detalle (con hub)',
      JSON.stringify(migasDeDetalle(detalleConHubDe({ tipo: TIPO_LIBRE }))),
      PERMITIDO_EN_LA_MIGA,
      { insensible: true },
    );
  });

  it('sin hub, la miga NO lleva la etiqueta del tipo — dos niveles y no tres', () => {
    /*
     * El complemento del caso de arriba: acá `labels.tipo` **no** puede aparecer,
     * porque el segundo nivel no se arma (B-108: el hub de ese tipo puede no
     * existir para una cancelada cuyo tipo nadie más usa). Declararlo como
     * permitido sin que aparezca haría fallar `barrer` por sobra — la misma
     * garantía que ya usa el hub vacío de la salida 11.
     */
    barrer(
      'BreadcrumbList del detalle (sin hub)',
      JSON.stringify(migasDeDetalle(detalleDe())),
      [{ ...PERMITIDO_EN_LA_MIGA[0]!, centinelas: ['titulo', 'slug'] }],
      { insensible: true },
    );
  });

  it('la miga de una CANCELADA con hub publica lo mismo — B-110', () => {
    // Misma superficie que el `Event`: cancelar no agrega ni saca un campo de
    // la miga (`migasDeDetalle` ni siquiera mira `cancelada`), solo cambia si
    // la página tiene franja y CTA — eso es de `detallePublico.test.ts`.
    const canceladaConHub = detalleDeActividad(
      toPublic(actividadCentinela({ tipo: TIPO_LIBRE }), 'act_centinela'),
      ETIQUETAS,
      AHORA,
      TONOS,
      true,
      {},
      true,
    );
    barrer(
      'BreadcrumbList del detalle (cancelada, con hub)',
      JSON.stringify(migasDeDetalle(canceladaConHub)),
      PERMITIDO_EN_LA_MIGA,
      { insensible: true },
    );
  });

  it('sobreviven exactamente los centinelas que el detalle necesita', () => {
    barrer('página de detalle', JSON.stringify(detalleDe()), PERMITIDO_EN_EL_DETALLE, {
      insensible: true,
    });
  });

  /**
   * **La superficie que B-951 agregó, barrida con los hubs puestos** — ver
   * `detalleConHubsDe`. Sin este caso, el barrido de arriba corre con
   * `SIN_HUBS` y nunca ve los `href`, que son la única parte del view-model
   * donde el slug crudo sale al HTML.
   *
   * Que el slug salga **no es una fuga**: un slug de barrio o de ciudad ya está
   * en el sitemap, es su propia URL. Lo que este caso fija es que salga **solo
   * ahí** —adentro del `href`— y que la etiqueta siga siendo lo que se lee.
   */
  it('con los hubs emitidos, el slug sale solo adentro del `href` (B-951)', () => {
    const detalle = detalleConHubsDe();
    barrer(
      'página de detalle (con los hubs emitidos)',
      JSON.stringify(detalle),
      [
        ...PERMITIDO_EN_EL_DETALLE,
        {
          nombre: 'el slug del hub, adentro de su propia URL',
          centinelas: ['sede.barrio', 'sede.ciudad'],
          porque:
            'B-951 — el renglón «Dónde» enlaza el barrio y la ciudad a su hub, y la ruta ' +
            'de un hub **es** su slug (trampa 10: el segmento es el slug, nunca el label, ' +
            'porque el label se renombra y una URL no). Lo que se **lee** sigue siendo la ' +
            'etiqueta: las dos mitades conviven en la misma pieza, `{ texto, href }`.',
        },
      ],
      { insensible: true },
    );

    /*
     * Control positivo de las dos mitades. Sin esto, un `rutaDeZona` que
     * devolviera siempre `null` dejaría la excepción de arriba sobrando y el
     * caso verde — que es exactamente lo que pasaba antes de este `it`.
     *
     * El fixture no es de CABA y tiene barrio cargado, así que `piezasDeLugar`
     * emite las tres: barrio, ciudad y provincia. Las dos primeras llevan hub;
     * la provincia no, y eso también se afirma acá (`CLASES_DE_TAXONOMIA`).
     */
    const porTexto = new Map(detalle.donde.map((p) => [p.texto, p.href]));
    expect(porTexto.get(CENTINELA['labels.barrio'])).toBe(
      `/barrio/${CENTINELA['sede.barrio']}/`,
    );
    expect(porTexto.get(CENTINELA['labels.ciudad'])).toBe(
      `/ciudad/${CENTINELA['sede.ciudad']}/`,
    );
    // La provincia se dice y no se enlaza: no hay hub de provincia.
    expect(porTexto.get(CENTINELA['labels.provincia'])).toBe(null);
    // Y en ninguna pieza el texto es el slug: lo que se lee es la etiqueta.
    expect(porTexto.has(CENTINELA['sede.ciudad'])).toBe(false);
  });

  /**
   * B-98 — con los encuentros cancelados, el JSON-LD marca cada sub-evento
   * `EventCancelled` y **no** lleva el motivo: se decidió así (D-976). La rama
   * cancelada es el lugar natural para meterlo mañana como `description` del
   * sub-evento, y sin este caso ningún rojo lo diría. Lo pidió el
   * `auditor-privacidad`.
   */
  it('JSON-LD con los encuentros cancelados: el motivo no sale (B-98)', () => {
    const d = detalleDe({
      sesiones: actividadCentinela().sesiones.map((s) => ({ ...s, cancelada: true })),
    });
    // Control positivo: el view-model sí lo trae, así que la ausencia mide algo.
    expect(JSON.stringify(d)).toContain(CENTINELA['sesiones.motivoCancelacion']);
    expect(JSON.stringify(datosEstructurados(d))).not.toContain(
      CENTINELA['sesiones.motivoCancelacion'],
    );
  });

  it('los CUATRO avisos barren igual: ninguno compone con un centinela prohibido', () => {
    /*
     * **Lo pidió el `auditor-privacidad` sobre B-253, y el hueco es de forma.**
     *
     * `aviso.texto` (`detallePublico.ts`) es el primer campo del view-model que
     * **compone** texto en vez de copiarlo: son cuatro ramas excluyentes y una de
     * ellas interpola un valor (`inscripcion.cierra`). El barrido de arriba corre
     * con un solo fixture, y con sus valores —`completo: true`, cierre el 1/9,
     * primera sesión el 3/9, `AHORA` el 20/8— cae **siempre** en la rama
     * `completo`, cuyo texto es una constante. O sea: tres de las cuatro ramas, y
     * justo la única que interpola, no se ejecutaban en ningún `barrer()`.
     *
     * El modo de falla no es hipotético: alguien escribe mañana
     * `Las inscripciones cerraron el ${cierra}. Escribile a ${destino}` en esa
     * rama y el barrido sigue verde, porque el fixture nunca la activa.
     *
     * Se barre el **view-model entero** en cada estado, no solo el aviso: activar
     * la rama cambia también qué más publica la página (sin CTA, sin `offers`),
     * así que cada estado es una superficie distinta y merece su pasada.
     *
     * MUTACIÓN PROBADA: componer la rama `cerrado` con el `searchText` —el caso
     * exacto que se teme, un dato prohibido interpolado en la rama que el fixture
     * no activaba— hace fallar **este** `it` nombrando el estado («cerrado») y
     * deja **verde** el `it` de arriba, que es el que existía. Esa diferencia es
     * todo el valor de este caso.
     */
    const casos: [string, () => ReturnType<typeof detalleDe>][] = [
      ['completo (el del fixture)', () => detalleDe()],
      // Todos los encuentros cancelados → rama `cancelado` (B-254). Se cancelan
      // **todos** y no se sacan: los centinelas de tema y lectura tienen que
      // seguir saliendo, porque un encuentro cancelado conserva su contenido.
      [
        'cancelado',
        () =>
          detalleDe({
            sesiones: actividadCentinela().sesiones.map((s) => ({ ...s, cancelada: true })),
          }),
      ],
      // Un «ahora» posterior a la última sesión → rama `pasado`.
      ['pasado', () => detalleDeCon(new Date('2027-01-01T15:00:00Z'))],
      // Un «ahora» posterior al cierre pero anterior a la sesión → rama `cerrado`.
      ['cerrado', () => detalleDeCon(new Date('2026-09-02T15:00:00Z'))],
    ];

    const tonos = new Set<string>();
    for (const [nombre, armar] of casos) {
      const d = armar();
      tonos.add(d.aviso?.tono ?? 'ninguno');
      barrer(
        `página de detalle (${nombre})`,
        JSON.stringify(d),
        // B-98 — con los encuentros cancelados, el motivo es parte de la fila.
        nombre === 'cancelado'
          ? [...PERMITIDO_EN_EL_DETALLE, MOTIVO_DE_CANCELACION]
          : PERMITIDO_EN_EL_DETALLE,
        { insensible: true },
      );
    }

    /*
     * Control positivo, y es el que hace que esto valga: sin él, los cuatro casos
     * podrían caer en la misma rama —que es exactamente el estado del que se
     * viene— y el `barrer()` pasaría cuatro veces sobre lo mismo.
     */
    expect([...tonos].sort()).toEqual(['cancelado', 'cerrado', 'completo', 'pasado']);
  });

  it('con `urlPublica: true` el link de la reunión TAMPOCO sale al detalle (D-139)', () => {
    /*
     * **Es más estricto que D-15**, que permite el link en las salidas 1 y 2, y
     * es la decisión de este cambio: la página de detalle es la superficie que
     * Google indexa y la que un bot cosecha primero. La lista de permitidos va
     * **sin agregar `online.url`**, y eso es la afirmación.
     *
     * Es el mismo criterio que D-129 aplicó al índice, con más razón acá: en el
     * índice el argumento era «servirlo en lote»; en el detalle es que queda en
     * un HTML indexado para siempre.
     */
    barrer(
      'página de detalle (link de reunión publicado a mano)',
      JSON.stringify(detalleDe(conLinkPublico())),
      PERMITIDO_EN_EL_DETALLE,
      { insensible: true },
    );
  });

  it('con dos formas de cursar salen las dos, y el link de ninguna', () => {
    barrer(
      'página de detalle (dos formas de cursar)',
      JSON.stringify(detalleDe(conDosFormasDeCursar())),
      [
        ...PERMITIDO_EN_EL_DETALLE,
        {
          nombre: 'la segunda forma de cursar',
          centinelas: ['modalidades.2.id', 'modalidades.2.online.plataforma'],
          porque:
            'B-224 — el detalle es donde se dice «los martes presencial, los jueves por Meet»: ' +
            'las dos filas salen con su plataforma. La de esta fila sale **como slug** porque ' +
            'no está registrada en `/opciones/plataforma` del fixture, y ahí `desSlug` es el ' +
            'último recurso del §4.1 — el mismo dato público con otra tipografía. Su **link** ' +
            'NO está en esta lista aunque esa fila tenga `urlPublica: true`: ese es el punto ' +
            'de D-139.',
        },
      ],
      { insensible: true },
    );
  });

  it('con dos sedes salen las dos direcciones', () => {
    barrer(
      'página de detalle (dos sedes)',
      JSON.stringify(detalleDe(conDosSedes())),
      [
        ...PERMITIDO_EN_EL_DETALLE,
        {
          nombre: 'la segunda sede',
          centinelas: [
            'modalidades.2.id',
            'modalidades.2.sede.nombre',
            'modalidades.2.sede.direccion',
          ],
          porque:
            'B-224 — sin la dirección de la segunda forma de cursar, la mitad de la gente no ' +
            'sabe a dónde ir. El índice lleva una sola sede; el detalle, todas.',
        },
      ],
      { insensible: true },
    );
  });

  it('el JSON-LD publica menos que la página, y nunca el link de la reunión (§5.4)', () => {
    /*
     * Superficie propia: lo leen máquinas y es lo primero que cosecha un bot. La
     * regla del §5.4 del diseño es explícita —«el HTML muestra lo que el dueño
     * eligió; el JSON-LD no»— y acá se afirma con la lista más corta de todo el
     * archivo. La lista vive en el scope del `describe` porque la usa también el
     * barrido de la actividad cancelada (B-110).
     */
    barrer(
      'JSON-LD del detalle (link publicado a mano)',
      JSON.stringify(datosEstructurados(detalleDe(conLinkPublico()))),
      PERMITIDO_EN_EL_JSON_LD,
      { insensible: true },
    );
  });

  it('la página de una actividad CANCELADA barre igual — B-110, salida nueva', () => {
    /*
     * **Es una salida pública nueva y por eso tiene su propia pasada.** Hasta
     * B-110 una actividad en `estado: 'cancelado'` no generaba HTML: su página es
     * la primera que el build produce a partir de un documento que el `where` del
     * §5.3 dejaba afuera, y eso la vuelve exactamente el tipo de superficie que
     * este archivo existe para barrer.
     *
     * La lista de permitidos es **la misma** y eso es la afirmación: una cancelada
     * publica ni más ni menos que una viva. Lo que cambia es la franja, el CTA y
     * el `eventStatus`, y ninguno de los tres es un campo del documento.
     *
     * Va con el link de la reunión **publicado a mano** (`conLinkPublico`) porque
     * es el peor caso combinado: el dueño tildó la casilla, canceló la actividad,
     * y la página queda indexada para siempre. Si `online.url` se escapara por
     * esta puerta, la fuga no se despublica nunca (D-139).
     *
     * MUTACIÓN PROBADA: copiar `m.online?.url` en `modalidadDeDetalle` hace fallar
     * este `it` **y** el de la actividad viva; borrar la rama de `cancelada` del
     * aviso no hace fallar ninguno de los dos, que es correcto — el texto del
     * aviso es de `detallePublico.test.ts` y acá se mide qué **datos** salen.
     */
    barrer(
      'página de detalle (actividad cancelada, con link publicado a mano)',
      JSON.stringify(detalleCanceladoDe(conLinkPublico())),
      PERMITIDO_EN_EL_DETALLE,
      { insensible: true },
    );

    /*
     * Y su JSON-LD, que es la otra superficie de la misma página.
     *
     * La lista es la misma **menos `labels.arancel`**, y esa resta es la
     * dirección «de menos» del barrido haciendo su trabajo: la etiqueta del
     * arancel sale del JSON-LD como la `category` del `Offer`, y una actividad
     * cancelada no emite `offers` (no se puede conseguir algo que no va a pasar).
     * Escrito así, si mañana el `Offer` vuelve, este `it` lo dice.
     */
    barrer(
      'JSON-LD (actividad cancelada)',
      JSON.stringify(datosEstructurados(detalleCanceladoDe(conLinkPublico()))),
      PERMITIDO_EN_EL_JSON_LD.map((e) => ({
        ...e,
        centinelas: e.centinelas.filter((c) => c !== 'labels.arancel'),
      })),
      { insensible: true },
    );
  });

  it('CONTROL NEGATIVO: si el detalle copiara la actividad entera, el barrido lo dice', () => {
    /*
     * El atajo que este barrido existe para frenar, y el más plausible de todos
     * en una plantilla: pasarle la `ActividadPublica` a la página «así tiene todo
     * a mano». Compila, se ve bien, y publica el link de la reunión en cuanto una
     * actividad tenga el flag.
     *
     * Se exige que falle **nombrando** el link, que es el campo de la trampa 5.
     */
    let mensaje = '';
    try {
      barrer(
        'página de detalle (mutación: la plantilla recibe la actividad entera)',
        JSON.stringify(toPublic(actividadCentinela(conLinkPublico()), 'act_centinela')),
        PERMITIDO_EN_EL_DETALLE,
        { insensible: true },
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó que se publicó la actividad entera').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('online.url');
  });
});
