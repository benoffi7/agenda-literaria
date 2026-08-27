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
import { construirIndice } from '@/lib/eventsJson';
import { buildSearchText } from '@/lib/normalize';
import { construirEvento } from '../functions/calendario.js';
import {
  CENTINELA,
  ENCUENTROS,
  LABELS_CENTINELA,
  VOCABULARIO_CERRADO,
  actividadCentinela,
  opcionCentinela,
} from './fixtures/centinelas';
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
    porque: 'sin la dirección y el cómo llegar nadie llega: es el punto de una actividad presencial.',
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
    const abierta = actividadCentinela({
      online: {
        plataforma: CENTINELA['online.plataforma'],
        url: CENTINELA['online.url'],
        urlPublica: true,
      },
    });
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
    const abierta = actividadCentinela({
      online: {
        plataforma: CENTINELA['online.plataforma'],
        url: CENTINELA['online.url'],
        urlPublica: true,
      },
    });
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
    const [publica] = opcionesPublicas([opcionCentinela()]);
    expect(Object.keys(publica!).sort()).toEqual(['label', 'slug']);
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
