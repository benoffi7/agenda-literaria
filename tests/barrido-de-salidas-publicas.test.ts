/**
 * **Barrido de las salidas públicas: sobreviven exactamente los centinelas
 * permitidos** (B-196).
 *
 * ── Qué reemplaza ──────────────────────────────────────────────────────────
 * Las cuatro salidas públicas del §5.1 se verificaban de dos maneras, y dos
 * estaban peor cubiertas:
 *
 * | Salida | Antes | Ahora |
 * |---|---|---|
 * | Issue de GitHub | barrido por clase (`clases-de-bug.test.ts`) | igual |
 * | Analítica | barrido por clase (`analytics-privacidad.test.ts`) | igual |
 * | `events.json` / SSG | lista de campos conocidos | **este barrido** |
 * | Evento de Calendar | lista de campos conocidos | **este barrido** |
 *
 * Las listas nombraban los campos privados que existían el día que se
 * escribieron (`zoom.us/j/secreto`, `coordinar con prensa`, `drive/privado`,
 * `evt_secreto`, `uid_abc`). Eso cubre lo que se conocía, no la propiedad: el
 * campo nuevo que nadie agregue a la lista se publica y nada se pone rojo. Ya
 * pasó dos veces esta semana en la variante barata —una celda de la tabla del
 * paso 0 que no la fijaba nada **porque el fixture no tenía el campo**— y es el
 * agujero que esto cierra de raíz.
 *
 * ── La forma ───────────────────────────────────────────────────────────────
 * 1. Un fixture donde **cada string del documento es un centinela** distinto y
 *    verificable (`tests/fixtures/centinelas.ts`).
 * 2. Por cada salida, una lista **corta, nombrada y justificada** de los
 *    centinelas que SÍ deben salir. Es el corazón del chequeo: sin ella el
 *    barrido fallaría contra todo, y con veinte excepciones sin explicar no
 *    verificaría nada.
 * 3. La aserción va en las **dos** direcciones: ningún centinela de más (fuga)
 *    y ninguno de menos (dejó de publicarse algo, o la excepción sobra).
 *
 * ── Por qué las dos direcciones ────────────────────────────────────────────
 * La dirección "de menos" es la que convierte cada fila de la tabla del paso 0
 * en algo que falla: si mañana se saca `libro` de la proyección, o el bloque
 * «Cupo completo» del evento, este archivo lo dice. Un barrido de una sola
 * dirección pasa con una proyección vacía.
 *
 * ── No se toca lo que ya estaba ────────────────────────────────────────────
 * `toPublic.test.ts` y `calendario.test.ts` siguen con sus casos nombrados:
 * ahí están las **instancias** (la forma exacta de `online`, el desvío de
 * `urlPublica`, la línea del cupo). Acá está la **clase**.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { opcionesPublicas, toPublic } from '@/lib/toPublic';
import { construirIndice, entradaDeIndice } from '@/lib/eventsJson';
import { datosEstructurados, detalleDeActividad, migasDeDetalle } from '@/lib/detallePublico';
import { carteleraDeDetalles } from '@/lib/cartelera';
import { panelesDeAhora } from '@/lib/ahoraPublico';
import { urlDeMiniatura } from '@/lib/imagenes';
import {
  AVISO_DEL_MES_VENCIDO,
  SALIDA_DEL_MES_VENCIDO,
  bajadaDelMes,
  descripcionDelMes,
  mesesDelSitio,
  tituloDelMes,
} from '@/lib/mesPublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import type { ClaseDeHub, GrupoDeExploracion, Hub } from '@/lib/hubsPublicos';
import { coleccionSchema, hubDelSitio } from '@/lib/hubsPublicos';
import { frasesDeNoEncontrado } from '@/lib/noEncontrado';
import { cuentaDePasadas, frasesDePasadas, pasadasDelSitio } from '@/lib/pasadasPublicas';
import { RUTA_AGENDA } from '@/lib/rutasPublicas';
import type { TipoActividad } from '@/types/actividad';
import { lastmodDelSitemap, rutasDelSitemap, textoDeRobots, xmlDelSitemap } from '@/lib/sitemap';
import { buildSearchText } from '@/lib/normalize';
import { construirEvento } from '../functions/calendario.js';
import {
  CENTINELA,
  ENCUENTROS,
  LABELS_CENTINELA,
  VOCABULARIO_CERRADO,
  actividadCentinela,
  conDosFormasDeCursar,
  conDosSedes,
  conLinkPublico,
  opcionCentinela,
} from './fixtures/centinelas';
import type { RutaCentinela } from './fixtures/centinelas';
import { barrer, type Excepcion } from './fixtures/barrido';

// ───────────────────────────────────────────────────────────────────────────
// Las excepciones: lo que SÍ debe salir, agrupado y con su motivo.
// La mecánica del barrido vive en `tests/fixtures/barrido.ts`; acá está el
// criterio, que es lo que se escribe a mano y se justifica una por una.
// ───────────────────────────────────────────────────────────────────────────

/**
 * §5.2 + D-125/D-126/D-127 — lo que el `events.json` publica.
 *
 * Nueve grupos. Lo que **no** está acá y por eso el barrido lo exige ausente:
 * `difusion.*`, `createdBy`/`updatedBy`, `sesiones.calendarEventId`,
 * `imagenes[].storagePath`, `online.url` y la URL del material privado.
 */
const PERMITIDO_EN_EVENTS_JSON: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['titulo', 'descripcion', 'slug', 'searchText'],
    porque:
      'es la actividad: el título y la descripción son lo que el listado muestra, el ' +
      'slug es la URL de la página de detalle (§7, trampa 10) y el searchText es el ' +
      'índice de la búsqueda en memoria del §6 — viaja entero al JSON (quinta fila de D-126).',
  },
  {
    nombre: 'galería',
    centinelas: ['imagenes.id', 'imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la URL es lo que el navegador va a pedir igual y el epígrafe se muestra debajo ' +
      'de la foto (D-125); el id identifica la fila de la galería y es a lo que apunta ' +
      '`portada`, no es contenido. `storagePath` NO está en esta lista: es la ruta ' +
      'interna del bucket (§5.1).',
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
      'quién organiza y quién está al frente, con sus redes: es cómo se llega a ellos, ' +
      'y son datos de trabajo publicados a propósito (§5.2).',
  },
  {
    nombre: 'la obra presentada',
    centinelas: ['libro.titulo', 'libro.autor'],
    porque:
      'DEC-1 / D-126, primera fila de su tabla del paso 0: es el dato central de una ' +
      'presentación, del mismo orden que el título de la actividad, y quien busca la ' +
      'obra tiene que encontrar la actividad.',
  },
  {
    nombre: 'encuentros',
    centinelas: ['sesiones.id', 'sesiones.tema', 'sesiones.lectura'],
    porque:
      'el tema y la lectura de cada encuentro son la mitad del valor de un ciclo (§2.2); ' +
      'el id es el uuid del §3.1 con el que el sitio identifica la fila, no contenido. ' +
      '`calendarEventId` NO está: es interno (§5.1).',
  },
  {
    nombre: 'dónde',
    centinelas: ['sede.nombre', 'sede.direccion', 'sede.ciudad', 'sede.indicaciones'],
    porque:
      'sin la dirección y el cómo llegar nadie llega: es el punto de una actividad ' +
      'presencial. Salen dos veces —adentro de su fila de `modalidades` y en la sede ' +
      'derivada— porque son el mismo dato: el barrido cuenta presencia, no ocurrencias.',
  },
  {
    nombre: 'formas de cursar',
    centinelas: ['modalidades.id'],
    porque:
      'B-224 — el id es el uuid del §3.1 con el que el sitio identifica la fila, no ' +
      'contenido; es lo mismo que `sesiones.id` e `imagenes.id`. Las **fechas** de la ' +
      'fila NO están en esta lista y tampoco tienen centinela (un `Timestamp` no puede ' +
      'llevarlo): que no salgan lo afirma `tests/modalidades.test.ts` buscándolas por su ' +
      'valor.',
  },
  {
    nombre: 'taxonomías, como slug',
    centinelas: ['sede.barrio', 'arancel.tipo', 'online.plataforma', 'tags'],
    porque:
      '§4.1/§4.4 — la actividad guarda el slug y el JSON lo lleva crudo: la web arma los ' +
      'chips de filtro resolviéndolo contra `opciones`, que viajan en el mismo archivo. ' +
      'A diferencia del evento de Calendar, acá no se resuelve la etiqueta.',
  },
  {
    nombre: 'inscripción y arancel',
    centinelas: ['inscripcion.destino', 'arancel.notas'],
    porque:
      'el destino es el canal de inscripción y sale incluso con el cupo completo, por ' +
      'decisión del dueño (D-127); las notas del arancel son las condiciones ' +
      '(«2 cuotas», «incluye material»). El §5.1 advierte que un WhatsApp personal en ' +
      'el destino queda expuesto a bots: es público a propósito, no por descuido.',
  },
  {
    nombre: 'material',
    centinelas: ['material.titulo.publico', 'material.titulo.privado', 'material.url.publico'],
    porque:
      '§5.2 — de un item sobreviven siempre tipo y título; la URL solo con ' +
      '`publico: true`. Los dos títulos están acá y una sola URL: es la única entrada ' +
      'de esta lista que distingue dos items del mismo campo.',
  },
];

/**
 * §5.1 + §7.4 — lo que la descripción del evento de Calendar publica.
 *
 * Igual que arriba **menos** el slug, el `searchText` y la galería (el evento no
 * los lleva), y **más** las etiquetas de `/opciones/*`.
 */
const PERMITIDO_EN_EVENTO_DE_CALENDAR: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['titulo', 'descripcion'],
    porque:
      '§7.4 — el título es el `summary` del evento y la descripción, su primer bloque. ' +
      'El slug y el searchText NO están: el evento no es una página, no tiene para qué ' +
      'llevar la URL ni el índice de búsqueda.',
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
    porque: 'el bloque «Organiza / Invitado» del §7.4: lo mismo que publica el JSON, y por lo mismo.',
  },
  {
    nombre: 'la obra presentada',
    centinelas: ['libro.titulo', 'libro.autor'],
    porque:
      'DEC-1 / D-126, segunda fila: «presentación de tal libro» es el dato central del ' +
      'evento. Va adentro de `construirDescripcion` a propósito, para que entre al ' +
      'payload de la guarda anti-loop y propague a las N sesiones (trampa 9, D-07).',
  },
  {
    nombre: 'este encuentro',
    centinelas: ['sesiones.tema', 'sesiones.lectura'],
    porque:
      'el tema va también en el `summary` («Título — Tema»): es lo que distingue un ' +
      'encuentro del siguiente en la agenda de quien se suscribió. El id de sesión NO ' +
      'está: el evento no lo lleva (lo lleva el documento, en `calendarEventId`).',
  },
  {
    nombre: 'dónde',
    centinelas: ['sede.nombre', 'sede.direccion', 'sede.ciudad', 'sede.indicaciones'],
    porque:
      'el bloque «Dónde» y el campo `location` del evento, que es lo que dibuja el mapa. ' +
      'Salen además dentro del link de Google Maps, escapados con encodeURIComponent.',
  },
  {
    nombre: 'etiquetas de /opciones',
    centinelas: [
      'labels.tipo',
      'labels.barrio',
      'labels.plataforma',
      'labels.arancel',
      'labels.tags',
    ],
    porque:
      '§4.1 — la actividad guarda el slug y el evento muestra la **etiqueta**: ' +
      '"a-la-gorra" crudo en un calendario público se ve roto. `/opciones/*` es de ' +
      'lectura pública (§5.3), así que la etiqueta no agrega nada privado. Los cuatro ' +
      'slugs correspondientes NO están permitidos acá: si aparecen es que la resolución ' +
      'se salteó.',
  },
  {
    nombre: 'inscripción y arancel',
    centinelas: ['inscripcion.destino', 'arancel.notas'],
    porque:
      'D-127 — el canal sigue saliendo con el cupo completo, con el cartel al lado: ' +
      'siempre hay lista de espera y esconderlo convierte una baja en un lugar que se ' +
      'pierde. Las notas del arancel son las condiciones de la inscripción.',
  },
  {
    nombre: 'material',
    centinelas: ['material.titulo.publico', 'material.titulo.privado', 'material.url.publico'],
    porque: '§5.1 — solo tipo y título del item privado; la URL únicamente con `publico: true`.',
  },
];

/**
 * §6 + quinta fila de D-126/D-127 — el `searchText` es una salida pública **por
 * la puerta de atrás**: se guarda en el documento y viaja entero al
 * `events.json`. Se barre aparte porque su lista es más corta que la del JSON.
 */
const PERMITIDO_EN_SEARCH_TEXT: readonly Excepcion[] = [
  {
    nombre: 'lo que alguien tipea para encontrar la actividad',
    centinelas: [
      'titulo',
      'descripcion',
      'sede.nombre',
      'sede.barrio',
      'organizador.nombre',
      'tallerista.nombre',
      'libro.titulo',
      'libro.autor',
    ],
    porque:
      '§6 y `CAMPOS_DE_SEARCH_TEXT` — son las formas en que alguien llega a una ' +
      'actividad: por su nombre, por el barrio, por quién la da, o por la obra que se ' +
      'presenta (D-126). Todo lo demás queda afuera: cada campo que entra acá se ' +
      'publica en el JSON de toda visita, incluido el de una actividad cuyo detalle ' +
      'nadie abrió.',
  },
];

describe('barrido del events.json (§5.2, la proyección pública)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    const publica = toPublic(actividadCentinela(), 'act_centinela');
    barrer('events.json', JSON.stringify(publica), PERMITIDO_EN_EVENTS_JSON);
  });

  it('un documento anterior a la galería publica el `imagenUrl` viejo y nada más', () => {
    // B-167 / D-125 — el default de lectura convierte el campo viejo en una lista
    // de un elemento. El centinela de `imagenUrl` pasa a estar permitido y los de
    // la galería desaparecen porque no están en la entrada.
    const legacy = actividadCentinela({
      imagenes: undefined,
      imagenUrl: CENTINELA.imagenUrl,
    });
    barrer('events.json (documento anterior a B-167)', JSON.stringify(toPublic(legacy, 'act_viejo')), [
      ...PERMITIDO_EN_EVENTS_JSON.filter((g) => g.nombre !== 'galería'),
      {
        nombre: 'la imagen del campo viejo',
        centinelas: ['imagenUrl'],
        porque:
          'D-125 — el default de lectura la convierte en la única fila de la galería, con ' +
          'id determinístico `img_legacy`. Es la misma URL que se publicaba antes de B-167.',
      },
    ]);
  });

  it('con `urlPublica: true` el link de la reunión entra a la lista, y solo así', () => {
    // Desvío consciente del §5.2 decidido por el dueño: el modelo tiene el flag y
    // el formulario su casilla. El default sigue siendo `false` — el caso base de
    // arriba exige que el centinela del link NO salga.
    const abierta = actividadCentinela(conLinkPublico());
    barrer('events.json (link de reunión publicado a mano)', JSON.stringify(toPublic(abierta, 'act_abierta')), [
      ...PERMITIDO_EN_EVENTS_JSON,
      {
        nombre: 'el link de la reunión, publicado a mano',
        centinelas: ['online.url'],
        porque:
          'trampa 5 — sale SOLO con `urlPublica: true`, que es una acción deliberada por ' +
          'actividad. El caso base de este mismo archivo exige que con el default no salga.',
      },
    ]);
  });
});

describe('barrido del events.json con dos formas de cursar (B-224)', () => {
  /**
   * El caso que la lista hace posible y que una sola fila no puede ver: los tres
   * derivados salen de la **primera** fila, así que un cambio que leyera el flag
   * del derivado —o que copiara la fila con un spread— publicaría el link de la
   * segunda sin que nada se ponga rojo.
   */
  it('sale el link de la fila que lo tildó, y NO el de la que no', () => {
    const dos = actividadCentinela(conDosFormasDeCursar());
    barrer('events.json (dos formas de cursar)', JSON.stringify(toPublic(dos, 'act_dos')), [
      ...PERMITIDO_EN_EVENTS_JSON,
      {
        nombre: 'la segunda forma de cursar',
        centinelas: ['modalidades.2.id', 'modalidades.2.online.plataforma'],
        porque:
          'B-224 — la segunda fila es una forma de cursar más: su plataforma es pública igual ' +
          'que la de la primera, y el id es el uuid del §3.1. El **link** de esta fila entra en ' +
          'el grupo de abajo, y el de la primera NO está en ninguna lista: ese es el punto.',
      },
      {
        nombre: 'el link de la segunda fila, publicado a mano',
        centinelas: ['modalidades.2.online.url'],
        porque:
          'trampa 5 — sale SOLO porque **esa fila** tiene `urlPublica: true`. El de la primera ' +
          'sigue en `false` y el barrido lo exige ausente: si `onlinePublico` leyera el flag del ' +
          'derivado en lugar del de la fila, saldrían los dos y esto fallaría.',
      },
    ]);
  });

  it('con dos sedes salen las dos direcciones', () => {
    const dos = actividadCentinela(conDosSedes());
    barrer('events.json (dos sedes)', JSON.stringify(toPublic(dos, 'act_sedes')), [
      ...PERMITIDO_EN_EVENTS_JSON,
      {
        nombre: 'la segunda sede',
        centinelas: [
          'modalidades.2.id',
          'modalidades.2.sede.nombre',
          'modalidades.2.sede.direccion',
        ],
        porque:
          'B-224 — sin la dirección de la segunda forma de cursar, la mitad de la gente no sabe ' +
          'a dónde ir. La **derivada** sigue siendo la de la primera fila, que es la que va al ' +
          'campo que dibuja el mapa.',
      },
    ]);
  });
});

describe('barrido del evento de Calendar (§5.1, §7.4)', () => {
  const actividad = actividadCentinela();

  it('sobreviven exactamente los centinelas permitidos, en los 8 encuentros', () => {
    // Los ocho: la descripción se arma con datos de la sesión Y de la actividad
    // (§7.2), así que un bloque que solo aparece en el primero —o solo en el
    // último— no se ve barriendo uno.
    expect(actividad.sesiones).toHaveLength(ENCUENTROS);
    for (const sesion of actividad.sesiones) {
      const evento = construirEvento(actividad, sesion, LABELS_CENTINELA);
      barrer(
        `evento de Calendar (${sesion.id})`,
        JSON.stringify(evento),
        PERMITIDO_EN_EVENTO_DE_CALENDAR,
      );
    }
  });

  it('con `urlPublica: true` el link entra a la lista, y solo así', () => {
    const abierta = actividadCentinela(conLinkPublico());
    barrer(
      'evento de Calendar (link de reunión publicado a mano)',
      JSON.stringify(construirEvento(abierta, abierta.sesiones[0], LABELS_CENTINELA)),
      [
        ...PERMITIDO_EN_EVENTO_DE_CALENDAR,
        {
          nombre: 'el link de la reunión, publicado a mano',
          centinelas: ['online.url'],
          porque:
            'trampa 5 — el §7.4 dice que el link no va nunca; se respeta el flag del modelo ' +
            'por decisión explícita del dueño, con default `false` y aviso en el formulario.',
        },
      ],
    );
  });

  it('con dos formas de cursar sale el link de la que lo tildó, y solo ese (B-224)', () => {
    const dos = actividadCentinela(conDosFormasDeCursar());
    barrer(
      'evento de Calendar (dos formas de cursar)',
      JSON.stringify(construirEvento(dos, dos.sesiones[0], LABELS_CENTINELA)),
      [
        ...PERMITIDO_EN_EVENTO_DE_CALENDAR,
        {
          nombre: 'la segunda forma de cursar',
          centinelas: ['modalidades.2.online.plataforma', 'modalidades.2.online.url'],
          porque:
            'B-224 — el bloque «Dónde» sale una vez por fila. La plataforma es pública siempre; ' +
            'el link, solo porque **esa fila** tildó `urlPublica`. El de la primera sigue ' +
            'ausente, que es lo que verifica que el flag se lee por fila y no del derivado.',
        },
      ],
    );
  });

  it('con dos sedes el evento nombra las dos direcciones (B-224)', () => {
    const dos = actividadCentinela(conDosSedes());
    barrer(
      'evento de Calendar (dos sedes)',
      JSON.stringify(construirEvento(dos, dos.sesiones[0], LABELS_CENTINELA)),
      [
        ...PERMITIDO_EN_EVENTO_DE_CALENDAR,
        {
          nombre: 'la segunda sede',
          centinelas: ['modalidades.2.sede.nombre', 'modalidades.2.sede.direccion'],
          porque:
            'B-224 — el evento nombra cada forma de cursar con su lugar. El campo `location`, en ' +
            'cambio, lleva **una** dirección: la derivada, o sea la de la primera fila.',
        },
      ],
    );
  });

  it('sin labels el evento muestra el slug desSlugeado, y sigue sin filtrar nada', () => {
    // `syncCalendar` puede quedarse sin `/opciones/*` (un slug que nadie registró):
    // ahí `desSlug` deriva la etiqueta del propio slug. Es el mismo texto público,
    // así que la lista de excepciones cambia solo de columna: salen los slugs y no
    // las etiquetas.
    const evento = construirEvento(actividad, actividad.sesiones[0], {});
    barrer('evento de Calendar (sin /opciones)', JSON.stringify(evento), [
      ...PERMITIDO_EN_EVENTO_DE_CALENDAR.filter((g) => g.nombre !== 'etiquetas de /opciones'),
      {
        nombre: 'taxonomías sin etiqueta registrada',
        centinelas: ['sede.barrio', 'arancel.tipo', 'online.plataforma', 'tags'],
        porque:
          '`desSlug` es el último recurso del §4.1 cuando el slug no está en `/opciones/*`: ' +
          'muestra el slug capitalizado en lugar de la etiqueta. Es el mismo dato público ' +
          'con otra tipografía, no información nueva.',
      },
    ]);
  });
});

describe('barrido del searchText (§6 — salida pública por la puerta de atrás)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    // Se normaliza a minúsculas y sin acentos, así que el barrido compara
    // insensible: si no, cualquier fuga pasaría por ausente.
    const actividad = actividadCentinela();
    barrer('searchText', buildSearchText(actividad), PERMITIDO_EN_SEARCH_TEXT, {
      insensible: true,
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Que el barrido falle cuando debe. Un barrido que nadie vio fallar no vale.
// ───────────────────────────────────────────────────────────────────────────

describe('el barrido falla cuando debe, y dice qué se escapó', () => {
  const actividad = actividadCentinela();

  it('una fuga en el events.json falla nombrando el centinela y la salida', () => {
    // La fuga más plausible: alguien agrega la difusión a la proyección "para
    // que el sitio pueda mostrar los handles".
    const conFuga = {
      ...toPublic(actividad, 'act_centinela'),
      difusion: actividad.difusion,
    };
    let error: unknown;
    try {
      barrer('events.json', JSON.stringify(conFuga), PERMITIDO_EN_EVENTS_JSON);
    } catch (e) {
      error = e;
    }
    const mensaje = String((error as Error | undefined)?.message ?? '');
    expect(error, 'el barrido tenía que fallar con la difusión adentro').toBeDefined();
    expect(mensaje).toContain('FUGA DE PRIVACIDAD');
    expect(mensaje).toContain('events.json');
    expect(mensaje).toContain('difusion.notas');
    expect(mensaje).toContain('difusion.arrobar');
  });

  it('una fuga en la descripción del evento falla nombrando el centinela', () => {
    // El caso real que motivó B-196: `construirDescripcion` son ~15
    // interpolaciones a mano, y la de más se lee bien («el link, para que lo
    // tengan a mano»).
    const evento = construirEvento(actividad, actividad.sesiones[0], LABELS_CENTINELA);
    const conFuga = {
      ...evento,
      description: `${evento.description}\n\nLink: ${actividad.online!.url}`,
    };
    let error: unknown;
    try {
      barrer('evento de Calendar', JSON.stringify(conFuga), PERMITIDO_EN_EVENTO_DE_CALENDAR);
    } catch (e) {
      error = e;
    }
    const mensaje = String((error as Error | undefined)?.message ?? '');
    expect(error, 'el barrido tenía que fallar con el link de la reunión adentro').toBeDefined();
    expect(mensaje).toContain('FUGA DE PRIVACIDAD');
    expect(mensaje).toContain('evento de Calendar');
    expect(mensaje).toContain('online.url');
  });

  it('dejar de publicar algo permitido también falla, y no como fuga', () => {
    // La otra dirección: una proyección que se queda corta. Sin esto, el barrido
    // pasaría con `toPublic` devolviendo un objeto vacío.
    const sinLibro = toPublic(actividadCentinela({ libro: null }), 'act_sin_libro');
    let error: unknown;
    try {
      barrer('events.json', JSON.stringify(sinLibro), PERMITIDO_EN_EVENTS_JSON);
    } catch (e) {
      error = e;
    }
    const mensaje = String((error as Error | undefined)?.message ?? '');
    expect(error, 'el barrido tenía que notar que el libro no salió').toBeDefined();
    expect(mensaje).toContain('dejó de publicar');
    expect(mensaje).toContain('libro.titulo');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Las tres redes que sostienen al barrido. Sin ellas, el fixture envejece y el
// barrido pasa por vacío — que es exactamente el bug que B-196 cierra.
// ───────────────────────────────────────────────────────────────────────────

/** Nombres de campo de una interfaz de `src/types/actividad.ts`. */
const camposDeInterfaz = (src: string, nombre: string): string[] => {
  const bloque = new RegExp(`export interface ${nombre} \\{\\n([\\s\\S]*?)\\n\\}`).exec(src);
  expect(bloque, `no se encontró \`export interface ${nombre}\` en src/types/actividad.ts`).not.toBeNull();
  return [...bloque![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
};

describe('el fixture de centinelas no puede envejecer', () => {
  const src = readFileSync('src/types/actividad.ts', 'utf8');
  const actividad = actividadCentinela();

  /**
   * Cada interfaz del modelo, anclada al lugar del fixture que la representa.
   *
   * **Esto es lo que hace que un campo nuevo entre solo**: nace en el tipo, el
   * chequeo de abajo exige que esté en el fixture, y el de al lado exige que su
   * valor sea un centinela. A partir de ahí el barrido lo ve, y quien lo agregó
   * tiene que decidir en qué lista de excepciones va — o no ponerlo en ninguna.
   */
  const ANCLAS: Record<string, Record<string, unknown>> = {
    Actividad: actividad as unknown as Record<string, unknown>,
    Organizador: actividad.organizador as unknown as Record<string, unknown>,
    Persona: actividad.tallerista as unknown as Record<string, unknown>,
    Libro: actividad.libro as unknown as Record<string, unknown>,
    Sesion: actividad.sesiones[0] as unknown as Record<string, unknown>,
    Imagen: actividad.imagenes![0] as unknown as Record<string, unknown>,
    ModalidadFila: actividad.modalidades[0] as unknown as Record<string, unknown>,
    Sede: actividad.sede as unknown as Record<string, unknown>,
    Online: actividad.online as unknown as Record<string, unknown>,
    Inscripcion: actividad.inscripcion as unknown as Record<string, unknown>,
    Arancel: actividad.arancel as unknown as Record<string, unknown>,
    Material: actividad.material as unknown as Record<string, unknown>,
    ItemMaterial: actividad.material.items[0] as unknown as Record<string, unknown>,
    Difusion: actividad.difusion as unknown as Record<string, unknown>,
    /*
     * B-212 — `/opciones/{campo}` es una salida pública **propia** desde que
     * existe `opcionesPublicas`, y hasta ahora `ValorOpcion` estaba en AJENAS:
     * o sea, afuera de este chequeo. Eso significaba que la única salida nueva
     * ya planificada (B-106) nacía fuera de la red, y que el default —volcar
     * `valores` tal cual— publicaba `huellaCreador` y `usos` sin que nada se
     * pusiera rojo.
     */
    ValorOpcion: opcionCentinela() as unknown as Record<string, unknown>,
  };

  /**
   * Las interfaces del archivo que **no** son parte de un documento de
   * actividad. Está escrita para que agregar una interfaz nueva al modelo
   * obligue a anclarla o a excluirla a mano.
   */
  const AJENAS = [
    'TimestampLike', // no tiene contenido: es la forma de un Timestamp
    'ActividadForm', // el formulario, cubierto por tests/fixtures/formulario.ts
    'SesionForm', // idem
    'ModalidadFilaForm', // idem
    // `DocOpciones` es `{ valores: ValorOpcion[] }` y nada más: lo que hay que
    // decidir está en `ValorOpcion`, que ahora sí está anclada arriba.
    'DocOpciones',
  ];

  it('el fixture tiene todos los campos de todas las interfaces del modelo', () => {
    for (const [interfaz, ancla] of Object.entries(ANCLAS)) {
      for (const campo of camposDeInterfaz(src, interfaz)) {
        expect(
          Object.prototype.hasOwnProperty.call(ancla, campo),
          `\`${interfaz}.${campo}\` no está en tests/fixtures/centinelas.ts. Un campo que ` +
            `no está en el fixture no lo mira ningún barrido: agregalo con su centinela y ` +
            `decidí en qué lista de excepciones va (o en ninguna).`,
        ).toBe(true);
      }
    }
  });

  it('todas las interfaces del modelo están ancladas o excluidas a mano', () => {
    const declaradas = [...src.matchAll(/^export interface (\w+)/gm)].map((m) => m[1]!);
    const sinDecidir = declaradas.filter((i) => !(i in ANCLAS) && !AJENAS.includes(i));
    expect(
      sinDecidir,
      `interfaces nuevas en src/types/actividad.ts que el barrido no mira: ` +
        `${sinDecidir.join(', ')}. Anclalas en ANCLAS o justificalas en AJENAS.`,
    ).toEqual([]);
  });

  it('todo string del fixture es un centinela o vocabulario cerrado', () => {
    // Sin esto, un campo nuevo puede entrar al fixture con un valor inocente
    // ("Casa Brandon") y quedar fuera del barrido para siempre.
    const centinelas = Object.values(CENTINELA);
    const sueltos: string[] = [];

    const recorrer = (valor: unknown, ruta: string): void => {
      if (typeof valor === 'string') {
        const cuantos = centinelas.filter((c) => valor.includes(c)).length;
        if (cuantos !== 1 && !VOCABULARIO_CERRADO.includes(valor)) {
          sueltos.push(`${ruta} = ${JSON.stringify(valor)}`);
        }
        return;
      }
      if (Array.isArray(valor)) {
        valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`));
        return;
      }
      // Los Timestamp del fixture se saltean: no tienen strings adentro.
      if (valor && typeof valor === 'object' && !('toMillis' in valor)) {
        for (const [k, v] of Object.entries(valor)) recorrer(v, `${ruta}.${k}`);
      }
    };

    recorrer(actividad, 'actividad');
    /*
     * B-212 — la opción también, y esto faltaba. Anclar `ValorOpcion` en ANCLAS
     * la metió en el chequeo de cobertura (que sus siete campos estén en el
     * fixture) pero **no** en este recorrido, que es el que exige que cada
     * string sea rastreable. Sin esta línea, un campo de texto nuevo en la
     * taxonomía —digamos `notaDeModeracion`— quedaba obligado a entrar al
     * fixture y podía entrar con un valor inocente: obligatorio de declarar,
     * invisible para todo barrido. Lo encontró el `auditor-privacidad`.
     */
    recorrer(opcionCentinela(), 'opcion');
    expect(
      sueltos,
      `strings del fixture que no son centinelas ni vocabulario cerrado: ${sueltos.join(' | ')}. ` +
        `Un valor así no lo puede seguir el barrido: hacelo centinela, o agregalo a ` +
        `VOCABULARIO_CERRADO si es un enum del modelo.`,
    ).toEqual([]);
  });

  it('ningún centinela es substring de otro, y todos son URL-safe', () => {
    // Las dos reglas de forma del fixture, que el barrido da por ciertas: si un
    // centinela fuera prefijo de otro, encontrar el segundo daría por presente al
    // primero; si no fuera URL-safe, `encodeURIComponent` (link del mapa) lo
    // escondería.
    const valores = Object.values(CENTINELA);
    expect(new Set(valores).size).toBe(valores.length);
    for (const a of valores) {
      expect(encodeURIComponent(a), `${a} no es URL-safe`).toBe(a);
      const contenidos = valores.filter((b) => b !== a && b.includes(a));
      expect(contenidos, `el centinela ${a} está contenido en ${contenidos.join(', ')}`).toEqual([]);
    }
  });
});

/**
 * §4.4 — barrido de `/opciones/*` proyectado, la salida que faltaba — B-212.
 *
 * El `events.json` lleva las opciones de taxonomía además de las actividades:
 * la web arma los chips de filtro recorriéndolas, así que sin ellas no hay
 * filtros. El documento tiene siete campos y **dos** salen.
 *
 * Esto se escribió **antes que su consumidor** (B-106 todavía no existe), y ese
 * es el punto: el camino corto cuando se escriba el `events.json` es volcar
 * `valores` tal cual —una línea, se lee razonable— y con eso entran
 * `huellaCreador` y `usos` sin que nadie lo haya decidido. Y nada lo detendría,
 * porque hasta ahora `ValorOpcion` estaba en la lista de interfaces AJENAS de
 * este archivo.
 */
describe('barrido de las opciones públicas (§4.4, B-212)', () => {
  const PERMITIDO_EN_OPCIONES: readonly Excepcion[] = [
    {
      nombre: 'la etiqueta y su slug',
      centinelas: ['opcion.slug', 'opcion.label'],
      porque:
        '§4.4 — es exactamente lo que el JSON lleva: la web arma los chips de filtro con ' +
        'el label y cruza el slug contra el que guarda cada actividad. Sin los dos no hay ' +
        'filtros, que es el motivo por el que las opciones viajan en el archivo.',
    },
  ];

  it('sobreviven exactamente el slug y la etiqueta', () => {
    const publicas = opcionesPublicas([opcionCentinela()]);
    barrer('opciones del events.json', JSON.stringify(publicas), PERMITIDO_EN_OPCIONES);
  });

  it('la huella del creador no sale, aunque sea una huella y no un uid', () => {
    /*
     * El caso que más importa de los cinco que no salen, y el que un spread
     * publicaría sin ruido. D-27 la hizo una huella justamente porque el
     * documento es de lectura pública, pero «no es un uid» no es lo mismo que
     * «es publicable»: sigue siendo un identificador estable de una persona, y
     * §5.1 dice que del creador no sale nada.
     */
    const json = JSON.stringify(opcionesPublicas([opcionCentinela()]));
    expect(json).not.toContain(CENTINELA['opcion.huellaCreador']);
    expect(json).not.toContain('huellaCreador');
  });

  it('los campos de gestión tampoco: no llevan texto, así que se afirma por clave', () => {
    // `orden`, `fijo`, `usos` y `aprobada` son números y booleanos: no hay
    // string donde esconder contenido, así que el barrido de centinelas no los
    // ve. Se comparan las claves de la salida contra la lista permitida.
    //
    // `tono` es el único de los cinco que sale (D-150): el color de la categoría
    // lo pinta el sitio, y el sitio no lee Firestore. Es la lista de claves —y no
    // el barrido de cadenas— lo que lo fija, porque es un número.
    const [publica] = opcionesPublicas([opcionCentinela()]);
    expect(Object.keys(publica!).sort()).toEqual(['label', 'slug', 'tono']);
  });

  it('sin matiz elegido no se emite la clave: el color se deriva del slug', () => {
    /*
     * D-150 — el caso normal es que nadie haya elegido color, y entonces el JSON
     * no lleva nada: el consumidor deriva el mismo color del slug con la misma
     * función que el build. Emitir el derivado convertiría en dato publicado algo
     * que hoy es una función, y el día que la derivación cambie el archivo viejo
     * mandaría el color viejo.
     */
    const [publica] = opcionesPublicas([opcionCentinela({ tono: undefined })]);
    expect(Object.keys(publica!).sort()).toEqual(['label', 'slug']);
  });

  it('un matiz que no es elegible no sale, aunque esté guardado', () => {
    /*
     * La guarda del lado del que escribe. `/opciones/*` se puede editar a mano
     * desde la consola de Firestore, así que un `tono: 999` o un `tono: 12.5` son
     * posibles; publicarlos pintaría un color fuera de la banda medida, o
     * directamente nada. Es la misma guarda que `tonoDeTipo` aplica al leer: el
     * color ilegible no se puede colar por ninguno de los dos caminos.
     *
     * MUTACIÓN PROBADA: sacar el `esTonoElegible` de `opcionPublica` y dejar el
     * spread condicional a `v.tono !== undefined` hace fallar este caso con
     * `['label','slug','tono']`.
     */
    for (const malo of [999, -1, 12.5, Number.NaN]) {
      const [publica] = opcionesPublicas([opcionCentinela({ tono: malo })]);
      expect(Object.keys(publica!).sort(), `tono ${malo}`).toEqual(['label', 'slug']);
    }
  });

  it('una opción sin aprobar no entra a los filtros del sitio', () => {
    // §4.3 / D-30 — el desplegable del panel se la muestra a quien la creó; un
    // chip en el sitio público publica una decisión a medio tomar.
    expect(opcionesPublicas([opcionCentinela({ aprobada: false })])).toEqual([]);
  });

  it('pero una opción base sí entra, aunque diga `aprobada: false`', () => {
    /*
     * Control del error que la primera versión de `opcionesPublicas` tenía: se
     * filtraba con `v.aprobada !== false` en vez de reusar `estaAprobada`, que
     * es `v.fijo || (v.aprobada ?? true)`. Las `fijo` son las opciones base del
     * §4.1 —«Gratis», «A la gorra»— o sea justo las que no pueden faltar en los
     * filtros.
     */
    const base = opcionCentinela({ fijo: true, aprobada: false });
    expect(opcionesPublicas([base])).toHaveLength(1);
  });

  it('y el default de los documentos viejos cuenta como aprobada', () => {
    // §4.3 — los documentos de producción anteriores al campo no lo tienen, y
    // ausente cuenta como aprobada (`estaAprobada`). Si esto rompiera, renombrar
    // una etiqueta vieja la borraría de los filtros del sitio.
    const vieja = opcionCentinela({ aprobada: undefined });
    expect(opcionesPublicas([vieja])).toHaveLength(1);
  });

  it('CONTROL NEGATIVO: un spread en la proyección dispara la fuga nombrando la huella', () => {
    /*
     * El `docs/BACKLOG.md` de B-212 y `13-agentes.md` afirman «verificado por
     * mutación — cambiar la proyección por un spread dispara FUGA DE
     * PRIVACIDAD». Eso se hizo **a mano**, y una afirmación de la doc que
     * ningún test sostiene envejece igual que cualquier otra: mañana alguien
     * afloja `PERMITIDO_EN_OPCIONES` y la frase sigue ahí, diciendo que hay una
     * red que ya no atrapa nada.
     *
     * Así que se codifica. Es el gemelo del control del `libro` de más arriba, y
     * lo señaló el `auditor-privacidad`: para la actividad ese control existía y
     * para las opciones no.
     *
     * Se simula el atajo —volcar el documento entero, que es lo que uno escribe
     * cuando implementa B-106 con apuro— y se exige que el barrido **falle**, y
     * que falle **nombrando** el campo. Un barrido que se rompe con un mensaje
     * genérico no sirve a las 2 de la mañana.
     */
    let mensaje = '';
    try {
      barrer(
        'opciones (mutación: la proyección hace spread)',
        JSON.stringify([{ ...opcionCentinela() }]),
        PERMITIDO_EN_OPCIONES,
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó el spread: la red no atrapa nada').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('opcion.huellaCreador');
  });
});

/**
 * §3.1 — barrido del índice del listado — B-106.
 *
 * Es la **tercera** proyección en serie sobre el mismo documento: `toPublic`
 * decide qué puede ser público y `entradaDeIndice` decide qué necesita el
 * listado, que es menos. Cada eslabón de una cadena de proyecciones necesita su
 * propio barrido: el de `toPublic` no dice nada sobre lo que el índice agrega o
 * conserva, y el de acá no dice nada sobre privacidad.
 *
 * Se agrega en el mismo cambio que la proyección, y no después, porque las dos
 * vueltas anteriores enseñaron que la salida que nace fuera del barrido se queda
 * afuera (B-212: `ValorOpcion` estuvo en la lista de AJENAS desde que existía).
 */
describe('barrido del índice del listado (§3.1, B-106)', () => {
  const PERMITIDO_EN_EL_INDICE: readonly Excepcion[] = [
    {
      nombre: 'identidad y búsqueda',
      centinelas: ['titulo', 'slug', 'searchText'],
      porque:
        'el título es lo que la tarjeta muestra, el slug es el link al detalle, y el ' +
        'searchText es el índice de la búsqueda en memoria del §6 — es la razón de ser ' +
        'de este archivo.',
    },
    {
      nombre: 'el resumen, que es descripción recortada',
      centinelas: ['descripcion'],
      porque:
        '§3.1 — `resumen` son los primeros ~160 caracteres de `descripcion`, cortados en ' +
        'palabra: es el texto de la tarjeta y la `meta description` del detalle. O sea que ' +
        'el centinela de `descripcion` SÍ aparece, y eso es correcto. Lo que el índice no ' +
        'lleva es la descripción **entera**, que es lo que pesa — y `searchText` ya la ' +
        'contiene normalizada, así que mandar las dos sería mandarla dos veces.',
    },
    {
      nombre: 'la portada',
      centinelas: ['imagenes.url'],
      porque:
        'la tarjeta necesita una imagen, y es la URL que el navegador va a pedir igual. ' +
        'El epígrafe NO está en esta lista: es del detalle, debajo de la foto (D-125).',
    },
    {
      nombre: 'quién, solo el nombre',
      centinelas: ['organizador.nombre', 'tallerista.nombre'],
      porque:
        '§3.1 — en el índice son strings y no objetos. El Instagram, la web y la bio ' +
        'quedan en el detalle: servir los handles de terceros en lote es distinto de ' +
        'mostrarlos en una página.',
    },
    {
      nombre: 'dónde, para el filtro de barrio',
      centinelas: ['sede.nombre', 'sede.barrio', 'sede.ciudad'],
      porque:
        'el barrio es el filtro de más valor (§2.1 del diseño) y el nombre de la sede es ' +
        'lo que la tarjeta muestra. La dirección, las indicaciones y las coordenadas NO ' +
        'están: no se filtra por ellas y viven en el detalle.',
    },
    {
      nombre: 'taxonomías, como slug',
      centinelas: ['arancel.tipo', 'online.plataforma', 'tags'],
      porque:
        '§4.4 — el índice lleva el slug y las etiquetas viajan aparte en `opciones`, así ' +
        'que los chips se arman cruzando los dos sin nada cableado.',
    },
    {
      nombre: 'las opciones de taxonomía',
      centinelas: ['opcion.slug', 'opcion.label'],
      porque: '§4.4 — es lo que hace que un chip nuevo aparezca solo. Ver B-212.',
    },
    {
      nombre: 'el eje plano de encuentros (B-99)',
      centinelas: ['sesiones.id'],
      porque:
        'El índice de encuentros de B-99 lleva `{slug, sesionId, inicio}`. El slug y el ' +
        'inicio ya estaban permitidos arriba; lo nuevo es el **id de sesión**, un uuid ' +
        'opaco generado en el cliente (trampa 2), sin PII, que además ya es público en la ' +
        'salida 6 (la página de detalle lo emite en `sesiones`). El barrido obligó a ' +
        'declararlo acá al agregarlo a esta salida, que es exactamente para lo que sirve.',
    },
    /*
     * `modalidades` (B-224) **no está en esta lista y no le falta un centinela**:
     * el índice lleva sus **valores** —`presencial`, `virtual`, `hibrido`—, que son
     * enums del modelo y están en `VOCABULARIO_CERRADO`. Las sedes de cada fila y
     * las fechas de la ventana no entran, y eso lo verifica el `it` de abajo
     * nombrándolas: sin ese caso, el día que alguien mande la fila entera al índice
     * el barrido no diría nada, porque la sede ya está permitida por la sede
     * derivada.
     */
  ];

  it('sobreviven exactamente los centinelas que el listado necesita', () => {
    const indice = construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_centinela')],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    barrer('events.json (índice del listado)', JSON.stringify(indice), PERMITIDO_EN_EL_INDICE);
  });

  it('lleva los valores de las formas de cursar, no las filas (B-224)', () => {
    /*
     * La celda del campo nuevo en la tercera proyección. El filtro necesita saber
     * que la actividad es presencial **y** virtual —si no, con la resultante sola
     * el sitio la escondería de los dos chips que la describen mejor—, y eso son
     * tres strings de enum. La **sede** de cada fila y las **fechas** de la
     * ventana no: la primera es del detalle y las segundas no salen a ninguna
     * salida todavía.
     */
    const dos = toPublic(actividadCentinela(conDosSedes()), 'act_dos');
    const indice = construirIndice({
      actividades: [dos],
      opciones: {},
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    const entrada = indice.actividades[0]!;
    expect(entrada.modalidades).toEqual(['hibrido', 'presencial']);
    // La segunda sede no entra: la del índice es una sola, la derivada.
    const json = JSON.stringify(indice);
    expect(json).not.toContain(CENTINELA['modalidades.2.sede.nombre']);
    expect(json).not.toContain(CENTINELA['modalidades.2.id']);
  });

  it('con `urlPublica: true` el link TAMPOCO entra al índice, a diferencia de las salidas 1 y 2', () => {
    /*
     * La celda que faltaba decidir. Las otras dos salidas que consumen el flag
     * de D-15 tienen su caso `urlPublica: true` en este mismo archivo y ahí el
     * link **sí** sale; el índice era la única de las tres sin el caso, así que
     * se resolvía por omisión hacia el lado seguro y nada lo sostenía.
     *
     * La lista de permitidos va **sin agregarle `online.url`**, y eso es la
     * afirmación: aunque el dueño haya decidido publicar el link, el listado no
     * lo necesita —la tarjeta no tiene botón «Unirse»— y servirlo en lote es lo
     * que hace barato el zoombombing (trampa 5).
     */
    const abierta = actividadCentinela({
      online: {
        plataforma: CENTINELA['online.plataforma'],
        url: CENTINELA['online.url'],
        urlPublica: true,
      },
    });
    const indice = construirIndice({
      actividades: [toPublic(abierta, 'act_abierta')],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    barrer(
      'events.json (índice, link de reunión publicado a mano)',
      JSON.stringify(indice),
      PERMITIDO_EN_EL_INDICE,
    );
  });

  it('CONTROL NEGATIVO: si el índice dejara de recortar, el barrido lo dice', () => {
    /*
     * El atajo que este archivo existe para frenar: volcar la `ActividadPublica`
     * tal cual en vez de recortarla. Es una línea, compila, y publica en lote el
     * mail de inscripción, las indicaciones de la sede y los temas de cada
     * encuentro.
     *
     * Se exige que el barrido falle **nombrando** al menos el mail, que es el
     * campo por el que el §5.1 ya advierte que los bots cosechan.
     */
    let mensaje = '';
    try {
      barrer(
        'events.json (mutación: sin recorte)',
        JSON.stringify([toPublic(actividadCentinela(), 'act_centinela')]),
        PERMITIDO_EN_EL_INDICE,
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó la falta de recorte').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('inscripcion.destino');
  });
});

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
    plataforma: [
      { slug: CENTINELA['online.plataforma'], label: CENTINELA['labels.plataforma'] },
    ],
    arancel: [{ slug: CENTINELA['arancel.tipo'], label: CENTINELA['labels.arancel'] }],
    tags: [{ slug: CENTINELA.tags, label: CENTINELA['labels.tags'] }],
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
      nombre: 'dónde, completo',
      centinelas: [
        'modalidades.id',
        'sede.nombre',
        'sede.direccion',
        'sede.ciudad',
        'sede.indicaciones',
      ],
      porque:
        'sin la dirección y el «timbre del fondo» nadie llega: es el punto de una actividad ' +
        'presencial y es lo que el índice no lleva. La dirección sale además dentro del link ' +
        'de Google Maps, escapada — el mismo `construirLinkMapa` que usa el evento (D-20).',
    },
    {
      nombre: 'las etiquetas de /opciones, no los slugs',
      centinelas: [
        'labels.tipo',
        'labels.barrio',
        'labels.plataforma',
        'labels.arancel',
        'labels.tags',
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
        'sede.ciudad',
        'sesiones.tema',
        'imagenes.url',
        'labels.plataforma',
        'labels.arancel',
        'slug',
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
        'nuevo, hay un dato público escrito completo.',
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
      barrer(`página de detalle (${nombre})`, JSON.stringify(d), PERMITIDO_EN_EL_DETALLE, {
        insensible: true,
      });
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

// ───────────────────────────────────────────────────────────────────────────
// Salida 7 — la cartelera (B-265)
// ───────────────────────────────────────────────────────────────────────────

describe('barrido de la cartelera (§5, salida 7, B-265)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, que es la lección de
   * B-212 y de la salida 5.
   *
   * Y hay algo que la distingue de las otras seis: **su entrada no es el
   * documento, es la salida 6**. `carteleraDeDetalles` proyecta `DetallePublico`,
   * así que solo puede sacar campos y no agregar ninguno que aquella no haya
   * decidido publicar. Eso hace que la lista de permitidos de acá tenga que ser
   * un **subconjunto** de la del detalle, y es lo que se afirma abajo: si algún
   * día alguien le pasa a la pared el documento en vez del view-model, la lista
   * deja de ser subconjunto y este archivo lo dice.
   */
  const ETIQUETAS = mapaDeEtiquetas({
    tipo: [{ slug: 'presentacion', label: CENTINELA['labels.tipo'] }],
    barrio: [{ slug: CENTINELA['sede.barrio'], label: CENTINELA['labels.barrio'] }],
    plataforma: [
      { slug: CENTINELA['online.plataforma'], label: CENTINELA['labels.plataforma'] },
    ],
    arancel: [{ slug: CENTINELA['arancel.tipo'], label: CENTINELA['labels.arancel'] }],
    tags: [{ slug: CENTINELA.tags, label: CENTINELA['labels.tags'] }],
  });

  // El mismo instante que el barrido del detalle: antes de la primera sesión, que
  // es el único estado en el que la actividad **entra** a la pared.
  const AHORA = new Date('2026-08-20T15:00:00Z');
  const TONOS = { presentacion: 195 };
  const pared = () =>
    carteleraDeDetalles([
      detalleDeActividad(
        toPublic(actividadCentinela(), 'act_centinela'),
        ETIQUETAS,
        AHORA,
        TONOS,
      ),
    ]);

  const PERMITIDO_EN_LA_CARTELERA: readonly Excepcion[] = [
    {
      nombre: 'identidad',
      centinelas: ['titulo', 'slug'],
      porque:
        'el título es el pie del afiche y el slug es el enlace a la actividad. La ' +
        '**descripción no está**: en una pared de afiches no entra un párrafo, y publicarla ' +
        'acá sería la tercera copia del mismo texto.',
    },
    {
      nombre: 'el afiche',
      centinelas: ['imagenes.url', 'imagenes.epigrafe'],
      porque:
        'es la página entera. `storagePath` NO está —y no puede estar, porque tampoco está ' +
        'en `DetallePublico`— y `imagenes.id` tampoco **como campo propio**: en una pared no ' +
        'identifica nada. Sí viaja adentro de `imagenes.url` (ya lo hacía) y, desde B-320, ' +
        'también adentro de `urlMiniatura` —es el mismo id con otro prefijo, `miniaturas/` en ' +
        'vez de `imagenes/`, y B-206 #1 ya decidió que el path es público de hecho y opaco a ' +
        'propósito—, así que no es una fuga nueva.',
    },
    {
      nombre: 'dónde y de qué tipo',
      centinelas: ['sede.nombre', 'labels.barrio', 'labels.tipo'],
      porque:
        'la ficha mínima que convierte un afiche en algo accionable: qué es, cuándo y dónde. ' +
        'La **dirección exacta NO está** —eso es del detalle, donde alguien ya decidió ir— y ' +
        'las indicaciones tampoco.',
    },
  ];

  it('sobreviven exactamente los centinelas que la pared necesita', () => {
    barrer('cartelera', JSON.stringify(pared()), PERMITIDO_EN_LA_CARTELERA, {
      insensible: true,
    });
  });

  it('con el link de la reunión publicado a mano, la pared sigue sin él (D-139)', () => {
    /*
     * **Lo pidió el `auditor-privacidad`, y el hueco era del fixture.**
     * `actividadCentinela()` a secas trae `urlPublica: false`, así que el
     * centinela del link **no estaba en la entrada** del barrido de arriba: ese
     * `it` no podía detectar una fuga del link ni aunque la hubiera. La salida 6
     * sí corre las dos ramas; la 7 quedaba cubierta solo de refilón.
     *
     * La rama que importa es ésta: D-15 deja pasar el link a las salidas 1 y 2,
     * y D-139 lo prohíbe en HTML indexado. La pared es HTML indexado.
     */
    const conLink = detalleDeActividad(
      toPublic(actividadCentinela(conLinkPublico()), 'act_link'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    // Dos controles positivos, y hacen falta los dos: que la rama esté activada
    // de verdad, y que la pared **no** haya quedado vacía —un `barrer()` sobre
    // `[]` pasa sin haber mirado nada—.
    expect(conLink.modalidades.some((m) => m.plataforma !== null)).toBe(true);
    const paredConLink = carteleraDeDetalles([conLink]);
    expect(paredConLink).toHaveLength(1);
    barrer(
      'cartelera (link de reunión publicado a mano)',
      JSON.stringify(paredConLink),
      PERMITIDO_EN_LA_CARTELERA,
      { insensible: true },
    );
  });

  it('todo lo que publica ya lo publicaba el detalle', () => {
    /*
     * La afirmación de **forma**, y la que sobrevive a que cambien las dos
     * listas: una salida derivada no puede publicar un texto que aquella de la
     * que deriva no publique. Se afirma sobre los valores y no sobre la lista de
     * permitidos, así que no hay nada que mantener.
     *
     * **Y no es el mismo chequeo que el de arriba.** Las dos mutaciones lo
     * muestran:
     *
     *  - agregarle a la pared un campo que el detalle **sí** publica
     *    (`descripcion`, «para el `title` del enlace») → lo caza el barrido de
     *    centinelas de arriba, y éste lo deja pasar, que es correcto: si el
     *    detalle lo publica, está auditado;
     *  - hacer que la pared **componga** en vez de copiar
     *    (`titulo: d.titulo.toUpperCase()`) → lo caza **este** y no el de
     *    arriba, porque `barrer` corre con `insensible: true` y encuentra el
     *    centinela igual. Componer es el primer paso de publicar algo que la
     *    salida 6 no publicó, y es como entró el `aviso.texto` del detalle.
     *
     * Las dos mutaciones se corrieron y las dos dieron rojo en su chequeo.
     *
     * `ruta` queda afuera y se verifica aparte: es lo único que la pared
     * **compone** en vez de copiar, y lo compone con el slug (B-227).
     *
     * `urlMiniatura` queda afuera de este `for` **por nombre**, y no por
     * casualidad del fixture — lo encontró el `auditor-privacidad` auditando
     * B-320. `CENTINELA['imagenes.url']` no es una URL de verdad (`new URL()`
     * tira dentro de `urlDeMiniatura`), así que en este fixture el campo da
     * `null` y el `typeof valor !== 'string'` lo saltea solo: el `for` nunca
     * ejercitó la rama no nula. Es exactamente lo que sí publica el afiche y el
     * detalle no —es un **derivado** de `imagenes.url`, no una proyección de
     * `DetallePublico`— así que no puede pasar por el mismo criterio que el
     * resto de los campos; se verifica aparte, con una URL real, más abajo.
     */
    const detalle = detalleDeActividad(
      toPublic(actividadCentinela(), 'act_centinela'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    const afiche = carteleraDeDetalles([detalle])[0]!;
    const delDetalle = JSON.stringify(detalle);

    for (const [campo, valor] of Object.entries(afiche)) {
      if (campo === 'ruta' || campo === 'urlMiniatura' || typeof valor !== 'string' || valor === '')
        continue;
      expect(
        delDetalle.includes(valor),
        `la cartelera publica \`${campo}\` y la página de detalle no: o dejó de derivar de ` +
          '`DetallePublico`, o alguien le pasó el documento',
      ).toBe(true);
    }

    expect(afiche.ruta).toBe(`/actividad/${detalle.slug}/`);
  });

  it('la miniatura es lo único que la pared publica y el detalle no, y es una derivación pura del original', () => {
    /*
     * El caso que el `it` de arriba no puede cubrir: con una URL real de
     * Storage, `urlMiniatura` **sí** es un string no vacío, y sin este test la
     * afirmación de forma de arriba se pondría roja el día que alguien haga el
     * fixture realista — un caso legítimo, no una fuga — y la tentación va a
     * ser aflojar ese `for` en vez de escribir este caso.
     *
     * Lo que hace aceptable que la pared publique algo que el detalle no: es
     * una función **pura** de `imagenes.url` (que el detalle sí publica), sin
     * `storagePath` ni ningún dato que no esté ya en esa misma URL — y sin el
     * token del original, que sería un dato que la miniatura no necesita para
     * autorizar su lectura (`allow get: if true`, D-175).
     */
    const conFotoPropia = detalleDeActividad(
      toPublic(
        actividadCentinela({
          imagenes: [
            {
              id: 'img_1',
              url:
                'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/' +
                'imagenes%2Fimg_1.jpg?alt=media&token=tok',
              epigrafe: '',
              origen: 'propia',
              portada: true,
              storagePath: 'imagenes/img_1.jpg',
            },
          ],
        }),
        'act_miniatura',
      ),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    // D-210: sin confirmar el path en `miniaturasConocidas`, `urlMiniatura`
    // daría `null` — el argumento completo está en `docs/06-decisiones.md`
    // § D-210, no en el BACKLOG (la entrada de B-320 todavía describe el
    // diseño anterior). Acá se confirma a propósito porque lo que este `it`
    // quiere ejercitar es el caso «no nulo».
    const afiche = carteleraDeDetalles(
      [conFotoPropia],
      new Set(['miniaturas/img_1.jpg']),
    )[0]!;
    expect(afiche.urlMiniatura).toBe(urlDeMiniatura(afiche.url));
    expect(afiche.urlMiniatura).toContain('miniaturas%2Fimg_1.jpg');
    expect(afiche.urlMiniatura, 'la miniatura no lleva el token del original').not.toContain(
      'token=',
    );
  });

  it('una actividad sin afiche no aporta nada a la pared', () => {
    // Control negativo del barrido: sin este caso, una pared vacía pasaría el
    // aserto de arriba habiendo barrido un `[]`.
    expect(pared()).toHaveLength(1);
    const sinImagen = detalleDeActividad(
      toPublic(actividadCentinela({ imagenes: [] }), 'act_sin_imagen'),
      ETIQUETAS,
      AHORA,
      TONOS,
    );
    expect(carteleraDeDetalles([sinImagen])).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Salida 8 — la página de mes (B-113)
// ───────────────────────────────────────────────────────────────────────────

describe('barrido de la página de mes (§5, salida 8, B-113)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, como la 7 — y esta vez
   * lo pidió el `auditor-privacidad` antes del commit, no después.
   *
   * ── Qué se barre, y por qué no la página entera ───────────────────────────
   * De la página de mes, las filas las pinta `FilaDeActividad` con los campos que
   * ya barre el índice del listado y que fija por lista blanca
   * `tests/listado-del-sitio.test.ts`. Lo que **es nuevo** de esta salida son las
   * tres frases que arma `mesPublico.ts` y que van al `<title>`, a la
   * `meta description` y a la bajada — y una de ellas **interpola títulos de
   * actividades**:
   *
   *     const titulos = pagina.entradas.slice(0, 3).map((e) => e.titulo)
   *
   * Esa línea es la regla de forma de este archivo: *si una salida se arma
   * interpolando texto, tiene que existir un barrido de centinelas*. Hoy el daño
   * estaría acotado —todo `EntradaDeIndice` ya viaja en el `events.json`— pero el
   * peor caso está a un carácter: `e.searchText` en lugar de `e.titulo` mete la
   * descripción entera y normalizada de tres actividades en una
   * `meta description`, y sin esto nada se pondría en rojo.
   *
   * MUTACIÓN PROBADA: cambiar ese `e.titulo` por `e.searchText` hace fallar el
   * primer caso nombrando el centinela de `descripcion`.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  /**
   * Tres actividades para llegar al corte del §2.2, todas el mismo centinela con
   * distinto id. El ciclo del fixture arranca el 3 de septiembre y son ocho
   * semanales, así que **cruza a octubre**: la página existe y además ejercita el
   * recorte.
   */
  const entradas = () =>
    ['act_mes_1', 'act_mes_2', 'act_mes_3'].map((id) =>
      entradaDeIndice(toPublic(actividadCentinela(), id)),
    );

  const paginaDeSeptiembre = () => {
    const pagina = mesesDelSitio(entradas(), AHORA).find((m) => m.clave === '2026-09');
    expect(pagina, 'el fixture dejó de producir la página de septiembre').toBeDefined();
    return pagina!;
  };

  /** El texto que esta salida agrega, y nada más: las tres frases de `mesPublico`. */
  const textoDeLaPagina = (pagina = paginaDeSeptiembre()): string =>
    [
      tituloDelMes(pagina),
      descripcionDelMes(pagina),
      bajadaDelMes(pagina),
      AVISO_DEL_MES_VENCIDO,
      SALIDA_DEL_MES_VENCIDO,
    ].join(' | ');

  const PERMITIDO_EN_LA_PAGINA_DE_MES: readonly Excepcion[] = [
    {
      nombre: 'los títulos de las tres primeras actividades',
      centinelas: ['titulo'],
      porque:
        '§5.1 del diseño — la `meta description` de una página de mes es «{N} actividades ' +
        'literarias en {mes}: {tres títulos}». El título ya es público en el listado y en ' +
        'la página de detalle de cada actividad; lo que esta lista fija es que **solo** ' +
        'el título entre, y no el resumen, el searchText ni el nombre de quien organiza.',
    },
  ];

  it('el fixture llega al corte y la página existe', () => {
    // Control positivo: `barrer` sobre un texto vacío pasa la dirección «no sobra
    // nada» y falla la otra, así que sin esto una página que dejó de generarse
    // daría un error confuso en vez de decir que el fixture se rompió.
    expect(entradas()).toHaveLength(3);
    expect(paginaDeSeptiembre().entradas).toHaveLength(3);
    expect(textoDeLaPagina().length).toBeGreaterThan(60);
  });

  it('en el título, la descripción y la bajada sobrevive solo el título', () => {
    barrer('página de mes', textoDeLaPagina(), PERMITIDO_EN_LA_PAGINA_DE_MES, {
      insensible: true,
    });
  });

  it('y con el mes ya vencido tampoco cambia lo que sale', () => {
    /*
     * La otra rama de las tres frases: el verbo cambia («Qué hubo») y la bajada es
     * otra. Sin este caso, la mitad vencida de `mesPublico` no la barre nadie —
     * que es la forma en que la salida 7 tenía el link de la reunión cubierto solo
     * de refilón hasta que se le agregó su segunda rama.
     */
    const vencida = { ...paginaDeSeptiembre(), vencido: true };
    expect(tituloDelMes(vencida)).toContain('hubo');
    barrer(
      'página de mes (vencida)',
      textoDeLaPagina(vencida),
      PERMITIDO_EN_LA_PAGINA_DE_MES,
      { insensible: true },
    );
  });

  it('el recorte al mes no agrega ni un campo: es la misma entrada con menos sesiones', () => {
    /*
     * La afirmación de **forma**, la que sobrevive a que cambie la lista de
     * permitidos: la salida 8 deriva de la 1 y por construcción solo puede
     * **sacar**. Si algún día alguien le pasa a la página el documento en vez de
     * la entrada del índice, las claves dejan de coincidir y esto lo dice.
     */
    const [original] = entradas();
    const enLaPagina = paginaDeSeptiembre().entradas[0]!;
    expect(Object.keys(enLaPagina).sort()).toEqual(Object.keys(original!).sort());
  });
});

describe('barrido del sitemap (§5, salida 9, B-109)', () => {
  /*
   * **La salida más chica del repo, y por eso el barrido es al revés.**
   *
   * Lo que el sitemap publica son **rutas**: ni un título, ni una descripción, ni
   * una fecha. Así que la lista de permitidos tiene **un** centinela —el slug, que
   * *es* la URL— y la dirección que importa es la de las fugas: cualquier otro
   * centinela que aparezca en el XML llegó por un campo que alguien interpoló.
   *
   * El caso plausible no es rebuscado: un `<lastmod>` sacado de `updatedAt`
   * (B-112) o el título de la actividad al lado de cada `<loc>` «para poder
   * revisar el archivo a ojo». Con eso, el sitemap dejaría de ser una lista de
   * URLs y sería una segunda proyección del documento, sin proyección.
   *
   * MUTACIÓN PROBADA: emitir un comentario XML con el título al lado de cada
   * `<loc>` hace fallar este `describe` nombrando el centinela del título.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  const entradas = () => [entradaDeIndice(toPublic(actividadCentinela(), 'act_sitemap'))];

  const xml = () =>
    xmlDelSitemap(
      rutasDelSitemap({
        entradas: entradas(),
        canceladas: [{ slug: CENTINELA.slug, editadaEn: AHORA.toISOString() }],
        ahora: AHORA,
      }),
    );

  const PERMITIDO_EN_EL_SITEMAP: readonly Excepcion[] = [
    {
      nombre: 'el slug, que es la URL',
      centinelas: ['slug'],
      porque:
        '§5.6 — una entrada del sitemap **es** la URL de la página: el origen más ' +
        '`/actividad/{slug}/`. El slug es la URL pública de la actividad desde B-227 ' +
        '(trampa 10: inmutable después de publicar) y ya sale en el `events.json`, en el ' +
        '`href` de cada fila y en el JSON-LD. Es el único centinela que puede aparecer ' +
        'acá: todo lo demás sería un campo interpolado en una lista de URLs.',
    },
  ];

  it('control positivo: el XML tiene la URL de la actividad', () => {
    // Sin esto, un sitemap vacío pasaría la dirección «no sobra nada» sin haber
    // mirado una sola URL.
    expect(xml()).toContain(`/actividad/${CENTINELA.slug}/`);
  });

  it('en el sitemap sobrevive solo el slug', () => {
    barrer('sitemap.xml', xml(), PERMITIDO_EN_EL_SITEMAP, { insensible: true });
  });

  it('el `lastmod` de B-112 nunca lleva la hora, ni aunque se lo pasen con ISO completo', () => {
    /*
     * El riesgo que el propio B-112 dejó anotado: «con un solo admin, un
     * `<lastmod>2026-09-02T03:14:52.881Z</lastmod>` no es una fecha, es la
     * agenda de trabajo de una persona identificada» (D-138). La fuente real
     * del recorte es `contenidoDelSitio.ts` (`publicadasEditadasEn`, que ya
     * guarda solo el día), pero `lastmodDelSitemap` recorta **de nuevo** —
     * belt-and-suspenders— para que un llamador futuro que le pase el ISO
     * completo por error no filtre la hora igual.
     *
     * MUTACIÓN PROBADA: sacar el `.slice(0, 10)` de `lastmodDelSitemap` deja
     * este caso en rojo con el instante completo en el XML.
     */
    const rutasOfrecidas = rutasDelSitemap({ entradas: entradas(), canceladas: [], ahora: AHORA });
    const lastmod = lastmodDelSitemap(rutasOfrecidas, {
      [CENTINELA.slug]: '2026-09-02T03:14:52.881Z',
    });
    const xmlConFecha = xmlDelSitemap(rutasOfrecidas, lastmod);
    expect(xmlConFecha).toContain('<lastmod>2026-09-02</lastmod>');
    expect(xmlConFecha).not.toContain('03:14:52');
    expect(xmlConFecha).not.toMatch(/<lastmod>[^<]*T[^<]*<\/lastmod>/);
  });

  it('y el robots.txt no publica ni el slug', () => {
    /*
     * Tres líneas fijas y una URL: la del propio sitemap. No toca los datos —no
     * recibe ninguno— y eso es lo que se afirma, porque el atajo tentador sería
     * listar ahí algo «para que Google lo encuentre antes».
     */
    barrer('robots.txt', textoDeRobots(), [], { insensible: true });
  });
});

describe('barrido de `/pasadas` (§5, salida 10, B-109)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, como la 7 y la 8.
   *
   * De la página, las filas las pinta `FilaDeActividad` con los campos que ya
   * barre el índice del listado y que fija por lista blanca
   * `tests/listado-del-sitio.test.ts`. Lo **nuevo** de esta salida son sus cuatro
   * frases (`pasadasPublicas.ts`), y la propiedad que se afirma acá es más fuerte
   * que la de la salida 8: **ninguna interpola un dato de una actividad**.
   *
   * Por eso la lista de permitidos está **vacía**, y eso es el aserto: la
   * `meta description` de la página de mes mete tres títulos —y por eso su
   * barrido los permite—; acá no entra ni uno. Si mañana alguien agrega «Lo que
   * ya pasó: Taller de crónica, Club de lectura…», este `describe` lo dice y hay
   * que decidirlo.
   *
   * Y el barrido puede afirmarlo porque `frasesDePasadas` **recibe las
   * entradas**: la función que arma el texto tiene los datos a mano y no los usa,
   * así que meter un título adentro es una línea y el barrido la ve sin que haya
   * que tocar este archivo. Con las frases sueltas y sin datos, la interpolación
   * se agregaría por un parámetro nuevo y el barrido no vería nada.
   *
   * MUTACIÓN PROBADA: interpolar `pasadas[0]?.titulo` en la `descripcion` de
   * `frasesDePasadas` hace fallar este `it` nombrando el centinela del título.
   */
  const AHORA = new Date('2026-08-20T15:00:00Z');

  const entradas = () =>
    ['act_pasada_1', 'act_pasada_2'].map((id) =>
      entradaDeIndice(toPublic(actividadCentinela(), id)),
    );

  /**
   * El texto que esta salida agrega, y nada más: sus frases y el contador.
   *
   * El contador entra desde **B-292**: es texto que la página muestra y lo arma
   * `cuentaDePasadas`, no la island — que es lo que lo deja adentro de este
   * barrido. Armado con un template en el componente, quedaría afuera.
   */
  const textoDeLaPagina = (): string => {
    const pasadas = pasadasDelSitio(entradas(), AHORA);
    const conPasadas = frasesDePasadas(pasadas);
    const vacia = frasesDePasadas([]);
    return [
      ...Object.values(conPasadas),
      ...Object.values(vacia),
      cuentaDePasadas(pasadas.length, pasadas.length),
      cuentaDePasadas(1, pasadas.length),
      cuentaDePasadas(0, 0),
    ].join(' | ');
  };

  it('control positivo: hay texto que barrer', () => {
    expect(textoDeLaPagina().length).toBeGreaterThan(120);
  });

  it('ninguna frase de la página publica un dato de una actividad', () => {
    barrer('/pasadas', textoDeLaPagina(), [], { insensible: true });
  });

  it('y lo que entra a la lista es la misma entrada del índice, sin un campo más', () => {
    /*
     * La afirmación de **forma**, igual que en la salida 8: esta página deriva de
     * la 1 y por construcción solo puede sacar. Si algún día alguien le pasa el
     * documento en vez de la entrada del índice, las claves dejan de coincidir.
     */
    const conFechaVieja = entradaDeIndice(toPublic(actividadCentinela(), 'act_pasada_vieja'));
    const [enLaPagina] = pasadasDelSitio([conFechaVieja], new Date('2030-01-01T00:00:00Z'));
    expect(enLaPagina, 'el fixture dejó de producir una pasada').toBeDefined();
    expect(Object.keys(enLaPagina!).sort()).toEqual(Object.keys(conFechaVieja).sort());
  });
});

/*
 * **Este `describe` NO se atribuye un número de salida, y es a propósito.**
 *
 * `/404` es una salida pública nueva y le correspondería la **13**, pero el índice
 * de `docs/07-seguridad.md` todavía tiene doce filas: agregar la fila —y sus
 * gemelas en el skill `campo-nuevo` y en la ficha del `auditor-privacidad`— es
 * **B-654**, y esos archivos no son de este frente.
 *
 * Ponerle «salida 13» al rótulo mientras tanto es exactamente lo que
 * `tests/agentes-y-skills.test.ts` prohíbe desde B-600: «un barrido se atribuye un
 * número de salida que en el índice es otra cosa… el índice queda apuntando a la
 * salida equivocada, y ningún otro chequeo lo ve». Y ese chequeo lo agarró: el
 * rótulo decía «salida 13» y el caso se puso rojo al mergear main.
 *
 * Así que el rótulo dice **qué** barre y no qué número tiene, y el número llega
 * junto con la fila. Lo que no cambia por eso: el barrido corre igual y afirma
 * exactamente lo mismo.
 */
describe('barrido de la página de error `/404` (§5, B-310 — su fila del índice es B-654)', () => {
  /*
   * **Entra al barrido en el mismo cambio que la creó**, como la 7, la 8 y la 10.
   *
   * Es la salida más chica del repo: cuatro frases escritas a mano
   * (`lib/noEncontrado.ts`) y ningún dato de ninguna actividad. Lo único que la
   * página ve de los datos son **los grupos de la tira «Explorá por»** —etiquetas
   * de taxonomía y nombres de mes, ya públicos por la salida 11— y
   * `frasesDeNoEncontrado` los **recibe**, que es lo que hace que este barrido
   * signifique algo: la función que arma el texto tiene los datos a mano y no los
   * usa.
   *
   * Por eso la lista de permitidos está **vacía**, y eso es el aserto. El día que
   * a alguien se le ocurra la mejora obvia de una página de error —«¿buscabas
   * *Taller de crónica*?», o «hay 12 talleres con fecha próxima»— este `describe`
   * lo dice y hay que decidirlo.
   *
   * MUTACIÓN PROBADA: interpolar `grupos[0]?.enlaces[0]?.texto` en la `bajada` de
   * `frasesDeNoEncontrado` hace fallar este `it` nombrando el centinela de la
   * etiqueta de barrio.
   */

  /**
   * Los grupos con **centinelas en las tres posiciones** que un grupo tiene: el
   * rótulo, el texto del enlace y la ruta. Es la forma real de la tira —los
   * rótulos son etiquetas de taxonomía y los enlaces se direccionan por slug— con
   * cada string reemplazado por algo verificable.
   */
  const grupos = (): GrupoDeExploracion[] => [
    {
      rotulo: CENTINELA['labels.tipo'],
      enlaces: [
        { ruta: `/barrio/${CENTINELA['sede.barrio']}/`, texto: CENTINELA['labels.barrio'] },
      ],
    },
  ];

  /** El texto que esta salida agrega, y nada más: sus cuatro frases. */
  const textoDeLaPagina = (): string => Object.values(frasesDeNoEncontrado(grupos())).join(' | ');

  it('control positivo: hay texto que barrer, y los grupos traen centinelas', () => {
    expect(textoDeLaPagina().length).toBeGreaterThan(120);
    // Sin esto, unos grupos que dejaran de traer centinelas harían pasar el
    // barrido de abajo sin haber tenido nada que filtrar.
    const enLosGrupos = JSON.stringify(grupos());
    expect(enLosGrupos).toContain(CENTINELA['labels.tipo']);
    expect(enLosGrupos).toContain(CENTINELA['labels.barrio']);
    expect(enLosGrupos).toContain(CENTINELA['sede.barrio']);
  });

  it('ninguna frase de la página publica un dato de una actividad', () => {
    barrer('/404', textoDeLaPagina(), [], { insensible: true });
  });
});

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
  const LOS_CUATRO: readonly {
    clase: ClaseDeHub;
    slug: string;
    extra?: Parameters<typeof actividadCentinela>[0];
    /** Los centinelas de etiqueta que ESTE hub sí publica, en su título. */
    etiquetas: readonly RutaCentinela[];
  }[] = [
    { clase: 'tipo', slug: 'presentacion', etiquetas: ['labels.tipo'] },
    { clase: 'barrio', slug: CENTINELA['sede.barrio'], etiquetas: ['labels.barrio'] },
    {
      clase: 'gratis',
      slug: '',
      extra: { arancel: { tipo: 'gratis', notas: CENTINELA['arancel.notas'] } },
      etiquetas: [],
    },
    { clase: 'online', slug: '', etiquetas: [] },
  ];

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
    for (const { clase, slug, extra } of LOS_CUATRO) {
      const h = hubDelSitio(clase, slug, entradas(extra), ETIQUETAS, AHORA);
      expect(h.vacio, `el hub ${clase} quedó vacío y no barre nada`).toBe(false);
      expect(h.entradas, `el hub ${clase}`).toHaveLength(3);
      expect(frasesDelHub(h).length).toBeGreaterThan(60);
    }
  });

  it('en las frases de los cuatro hubs sobreviven solo el título y su etiqueta', () => {
    for (const { clase, slug, extra, etiquetas } of LOS_CUATRO) {
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
    const conSlugCentinela = LOS_CUATRO.filter(({ slug }) => slug === CENTINELA['sede.barrio']);
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
    for (const { clase, slug, etiquetas } of LOS_CUATRO) {
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
    for (const { clase, slug, extra } of LOS_CUATRO) {
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
  };

  /** El slug con el que direcciona cada clase (trampa 10) — solo `barrio` usa uno centinela. */
  const SLUG_DEL_HUB: Partial<Record<ClaseDeHub, readonly RutaCentinela[]>> = {
    barrio: ['sede.barrio'],
  };

  it('coleccionSchema de los cuatro hubs publica lo mismo que sus frases — nada más', () => {
    /*
     * MUTACIÓN PROBADA: agregar `e.tipo` o `e.searchText` a un `ListItem` de
     * `coleccionSchema` deja este caso en rojo nombrando el centinela que se
     * coló — la función solo debería tocar `slug` y `titulo` de cada entrada.
     */
    for (const { clase, slug, extra } of LOS_CUATRO) {
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

/**
 * §5 — barrido del **tríptico de «¿Qué hay ahora?»** — salida 1, **séptimo
 * productor**, B-600.
 *
 * ── Por qué es un productor de la salida 1 y no una salida nueva ──────────
 * Porque **no es una URL nueva**: es una sección del HTML de la home, que ya es
 * la salida 1 («`events.json` y el HTML del listado»). Tiene exactamente la forma
 * de los otros tres productores que esa salida fue sumando: `tarjetaPublica.ts`
 * (el cuarto, qué frases dice la fila), `identidad.ts`/`listadoPublico.ts` (el
 * quinto y sexto, de qué color se escribe la categoría) y `coleccionSchema` de
 * `hubsPublicos.ts` (el sexto del JSON-LD) — un módulo que decide **qué dice** el
 * HTML de la home con los campos que el índice ya trae, sin agregar una ruta
 * indexable.
 *
 * Numerarlo como «salida 13» habría sido, además, sumar una fila a las **tres
 * tablas atadas** por `tests/agentes-y-skills.test.ts` para una salida que no
 * recibe campos del modelo: quien agregue un campo nuevo tendría una celda más
 * que decidir y la respuesta sería siempre la misma que la de la salida 1.
 *
 * Lo que **sí** entra en el mismo cambio es este `describe`, y ese «en el mismo
 * cambio» es la lección de B-212 y de los hubs de la salida 11: el productor que
 * nace fuera del barrido se queda afuera, la suite queda verde igual —el índice
 * de salidas solo se compara consigo mismo— y el hueco no se nota hasta que
 * alguien lo busca.
 *
 * ── Por qué necesita el suyo, teniendo el del índice arriba ────────────────
 * Porque **no publica el índice: publica una derivación del índice**, y las dos
 * cosas que agrega son justo las que un barrido de la salida anterior no ve.
 *
 * 1. `panelesDeAhora` recibe la `EntradaDeIndice` **entera** y decide qué campos
 *    de ella salen a la pantalla. Lo que se emite es un puñado de strings ya
 *    resueltos (`titulo`, `lugar`, `tipoEtiqueta`, `arancel.texto`), pero la
 *    entrada de la que salen tiene `searchText` —la descripción entera,
 *    normalizada— y `resumen`, y nada de tipos impide imprimirlos. Es la misma
 *    forma del riesgo que hizo nacer la lista blanca de `FilaDeActividad`
 *    (`tests/listado-del-sitio.test.ts`), del lado del módulo puro.
 * 2. La `clave` de cada fila interpola el **id de sesión**, que hasta B-99 no
 *    salía por esta puerta.
 *
 * ── Qué se barre ──────────────────────────────────────────────────────────
 * El `JSON.stringify` de lo que el módulo devuelve, que es exactamente lo que el
 * componente recibe: el componente no lee ninguna `EntradaDeIndice` —eso lo
 * verifica `tests/listado-del-sitio.test.ts`—, así que barrer la salida del
 * módulo es barrer la sección entera.
 */
describe('barrido del tríptico de «¿qué hay ahora?» (§5, salida 1 · 7º productor, B-600)', () => {
  /*
   * El `ahora` cae **adentro** de la primera ventana del fixture: la primera
   * sesión centinela es el 3 de septiembre de 2026 a las 22:00 UTC (19:00 acá),
   * así que a las 11:00 de ese jueves el panel de «Hoy» la tiene. Con un `ahora`
   * de otro día los tres paneles saldrían vacíos, `panelesDeAhora` devolvería
   * `null` y el barrido correría sobre la nada — que es la forma en que un
   * barrido pasa sin verificar nada.
   */
  const AHORA = new Date('2026-09-03T14:00:00Z');
  const GENERADO_EN = '2026-09-03T12:00:00.000Z';

  const indice = () =>
    construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_paneles')],
      opciones: {},
      version: '1.8.0+abc1234',
      generadoEn: GENERADO_EN,
    });

  /**
   * Ocho centinelas en cinco grupos. Todo lo que **no** está acá el barrido lo
   * exige ausente, y ahí lo que más importa es lo que el índice sí lleva y esta
   * salida no tiene por qué mostrar: `searchText`, el `resumen` (o sea el
   * centinela de `descripcion`), `organizador.nombre`, `tallerista.nombre`,
   * `tags`, `imagenes.url` y la plataforma.
   */
  const PERMITIDO_EN_LOS_PANELES: readonly Excepcion[] = [
    {
      nombre: 'el título, que es lo que la fila dice',
      centinelas: ['titulo'],
      porque:
        'una fila del panel es «19:00 · Título · lugar»: sin el título no hay nada que ' +
        'leer. La **descripción** no está en esta lista y por eso el barrido la exige ' +
        'ausente: el panel es un cronograma de cuatro líneas, no una tarjeta.',
    },
    {
      nombre: 'el slug, que es el link al detalle',
      centinelas: ['slug'],
      porque:
        'toda la fila es un enlace a la página de la actividad (no hay página por ' +
        'encuentro, §2.3): el slug sale en la `ruta` y otra vez en la `clave`.',
    },
    {
      nombre: 'el id de sesión, adentro de la clave de la fila',
      centinelas: ['sesiones.id'],
      porque:
        'la `clave` es `slug#sesionId` — con el slug solo, dos encuentros del mismo ' +
        'ciclo en el mismo panel serían dos filas iguales para React. Es el uuid opaco ' +
        'del cliente (trampa 2), sin PII, y ya es público en la salida 6 y en el eje de ' +
        'encuentros del índice (B-99).',
    },
    {
      nombre: 'la etiqueta de la categoría',
      centinelas: ['labels.tipo'],
      porque:
        '§4.4 — la cajita de la categoría muestra la **etiqueta** resuelta contra ' +
        '`/opciones`, no el slug crudo, con la misma `etiquetaDe` del listado. El slug ' +
        'viaja aparte para pedirle el color a `estiloDeTipo` (D-150) y es un enum, así ' +
        'que no lleva centinela.',
    },
    {
      nombre: 'el lugar y el arancel, los dos vía `tarjetaPublica`',
      centinelas: ['sede.nombre', 'labels.barrio', 'sede.ciudad', 'labels.arancel'],
      porque:
        'la línea de lugar la arma `lugarDeTarjeta` —la misma del listado, de la página ' +
        'de mes, de /pasadas y de los hubs— y el arancel `arancelDeTarjeta`. La ' +
        '**dirección**, las indicaciones y las coordenadas NO están en esta lista: el ' +
        'índice no las lleva y el panel no las necesita. `labels.plataforma` tampoco ' +
        'está, y su ausencia NO es una prohibición: el fixture es `hibrido`, así que ' +
        'gana la rama de sede y la línea termina en «· y online». En una virtual pura ' +
        '`lugarDeTarjeta` sí imprime «Online por <etiqueta>», que es público (§4.1) — ' +
        'lo que nunca sale es el link, y eso lo afirma el `it` de `urlPublica: true`.',
    },
  ];

  it('sobreviven exactamente los centinelas que una fila del panel necesita', () => {
    const programacion = panelesDeAhora(indice(), AHORA, LABELS_CENTINELA);
    expect(programacion, 'el `ahora` quedó fuera de las tres ventanas').not.toBeNull();
    // Control positivo: el barrido tiene que estar mirando una fila de verdad.
    expect(programacion!.paneles.find((p) => p.clave === 'hoy')!.encuentros).toHaveLength(1);

    barrer(
      'tríptico de «¿qué hay ahora?»',
      JSON.stringify(programacion),
      PERMITIDO_EN_LOS_PANELES,
    );
  });

  it('el sello de frescura no lleva ningún dato del documento', () => {
    /*
     * Sale de `generadoEn`, que es del archivo y no de ninguna actividad. Se
     * afirma aparte porque es la única cadena de la salida que no viene de una
     * fila, y el atajo tentador —«decir de cuándo es el dato más nuevo»— sería
     * interpolar el título de una actividad ahí arriba.
     */
    const programacion = panelesDeAhora(indice(), AHORA, LABELS_CENTINELA);
    expect(programacion!.sello).toBe('Actualizado: jue 3 sep, 09:00');
    barrer('sello del tríptico', programacion!.sello, []);
  });

  it('con `urlPublica: true` el link de la reunión tampoco entra al tríptico', () => {
    /*
     * La misma celda que la salida 3 (el índice) decidió: aunque el dueño haya
     * elegido publicar el link, el panel no lo necesita —la fila lleva a la
     * página de detalle, que es donde está el botón— y servirlo en la portada de
     * la home es lo que hace barato el zoombombing (trampa 5).
     *
     * La lista de permitidos va **sin agregarle `online.url`**, y eso es la
     * afirmación.
     */
    const abierta = construirIndice({
      actividades: [toPublic(actividadCentinela(conLinkPublico()), 'act_abierta')],
      opciones: {},
      version: '1.8.0+abc1234',
      generadoEn: GENERADO_EN,
    });
    barrer(
      'tríptico (link de reunión publicado a mano)',
      JSON.stringify(panelesDeAhora(abierta, AHORA, LABELS_CENTINELA)),
      PERMITIDO_EN_LOS_PANELES,
    );
  });

  it('CONTROL NEGATIVO: si la fila llevara la entrada entera, el barrido lo dice', () => {
    /*
     * El atajo que este `describe` existe para frenar, y no es hipotético: es
     * **una línea** —pasar `entrada` en vez de los cuatro strings decididos— y
     * compila, porque el componente ya recibe el objeto de la fila. Publicaría en
     * la portada de la home el `searchText` (la descripción entera, normalizada)
     * y el `resumen` de cada una de las doce actividades del tríptico.
     *
     * Se exige que el barrido falle **nombrando** `searchText`, que es el campo
     * más caro de los que el índice lleva y el panel no muestra.
     */
    const programacion = panelesDeAhora(indice(), AHORA, LABELS_CENTINELA)!;
    const entrada = indice().actividades[0]!;
    const conFuga = {
      ...programacion,
      paneles: programacion.paneles.map((p) => ({
        ...p,
        encuentros: p.encuentros.map((e) => ({ ...e, entrada })),
      })),
    };

    let mensaje = '';
    try {
      barrer(
        'tríptico (mutación: la entrada entera en la fila)',
        JSON.stringify(conFuga),
        PERMITIDO_EN_LOS_PANELES,
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó la entrada entera en la fila').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('searchText');
  });
});
