/**
 * El contenido de `/ayuda` — B-232.
 *
 * ── Por qué es un módulo de datos y no párrafos adentro del `.astro` ───────
 * Porque así el texto se puede **verificar**, y hay tres cosas que verificar
 * que no se ven mirando la página:
 *
 * 1. **Que no falte ninguna pregunta.** La página le habla a quien busca una
 *    actividad, no a quien la carga, y las preguntas que de verdad se hacen no
 *    son las que uno recuerda mientras escribe HTML. La lista obligatoria vive
 *    en `tests/ayuda-del-sitio.test.ts` y borrar una respuesta pone el test en
 *    rojo.
 * 2. **Que el texto no contradiga al modelo.** El glosario de tipos y el de
 *    aranceles **se derivan de `opciones-base.json`**: no hay una lista de
 *    tipos escrita a mano acá que pueda quedarse vieja. El día que se agregue
 *    una categoría base —ya pasó con «Feria» (B-129) y con «Librería a la
 *    calle»— la ayuda queda incompleta y el test lo dice, nombrando la
 *    categoría que falta explicar.
 * 3. **Que no se cuele lo que el §5.1 no publica.** Es texto libre en una
 *    página pública: un ejemplo bien intencionado con el link de una reunión
 *    real es exactamente la trampa 5. El barrido de centinelas del test lo
 *    busca.
 *
 * Es el mismo criterio de `src/lib/ayuda.ts` —la guía del **panel**, que le
 * habla a quien carga actividades y no tiene nada que ver con esta— y por eso
 * también el mismo tono: sin jerga, sin nombres de campo, sin referencias a
 * secciones de documentos.
 *
 * ── Lo que este módulo NO decide ──────────────────────────────────────────
 * Cómo se ve. La página elige el marcado; acá está qué dice y en qué orden.
 */
import opcionesBase from '@/lib/opciones-base.json';

/** Un destino del propio sitio que una respuesta ofrece al final. */
export interface EnlaceDeAyuda {
  href: string;
  texto: string;
}

/**
 * Una entrada del glosario: un valor de taxonomía base con su explicación.
 *
 * El `label` **no** se escribe acá: sale de `opciones-base.json`, que es de
 * donde también sale el desplegable del panel. Dos listas de nombres de tipos
 * es la clase de duplicación que este repo ya tiene nombrada (B-72, B-88), y la
 * copia que envejece siempre es la que está en el texto.
 */
export interface TerminoExplicado {
  slug: string;
  label: string;
  /** Qué es, en una o dos frases, para alguien que no conoce el circuito. */
  que: string;
}

export interface PreguntaDelSitio {
  /**
   * Ancla estable de la URL (`/ayuda#a-la-gorra`). **No se renombra**: puede
   * estar linkeada desde afuera, y un ancla rota no avisa.
   */
  id: string;
  pregunta: string;
  /** Párrafos. Si hacen falta más de tres, probablemente sean dos preguntas. */
  respuesta: string[];
  /** Glosario que acompaña a la respuesta, cuando la respuesta es una lista. */
  glosario?: TerminoExplicado[];
  enlaces?: EnlaceDeAyuda[];
}

export interface GrupoDeAyuda {
  id: string;
  titulo: string;
  preguntas: PreguntaDelSitio[];
}

/** La forma de un valor de `opciones-base.json`, para no depender del JSON. */
interface ValorBase {
  slug: string;
  label: string;
  orden: number;
  fijo: boolean;
}

/**
 * Cruza las opciones base con sus explicaciones, en el orden del desplegable.
 *
 * Una opción sin explicación **no se muestra**: mejor un glosario corto que una
 * definición vacía en una página pública. Lo que la pone en rojo es el test, y
 * es a propósito que sea así y no un error en tiempo de build — un build que se
 * cae por un texto que falta deja el sitio entero abajo.
 */
const explicar = (
  valores: readonly ValorBase[],
  explicaciones: Readonly<Record<string, string>>,
): TerminoExplicado[] =>
  [...valores]
    .filter((v) => v.fijo && explicaciones[v.slug])
    .sort((a, b) => a.orden - b.orden)
    .map((v) => ({ slug: v.slug, label: v.label, que: explicaciones[v.slug]! }));

const QUE_ES_CADA_TIPO: Readonly<Record<string, string>> = {
  taller:
    'Se escribe. Un grupo que se junta a producir textos propios con alguien que coordina, ' +
    'da consignas y devuelve lecturas. Suele tener varios encuentros y cupo chico.',
  'club-lectura':
    'Se lee. Todos leen lo mismo y se juntan a conversarlo. Casi siempre son varios encuentros, ' +
    'uno por libro o por tramo, y de un encuentro al otro hay una lectura asignada.',
  encuentro:
    'Una junta literaria que no es ninguna de las otras: una lectura en voz alta, un ciclo de ' +
    'poesía, un micrófono abierto, una mesa de escritores.',
  presentacion:
    'Se presenta un libro que acaba de salir. Suele estar quien lo escribió y alguien que lo ' +
    'comenta, y dura una tarde sola.',
  charla:
    'Alguien invitado habla y se le pregunta. A diferencia del taller, se escucha; a diferencia ' +
    'de la presentación, no gira alrededor de un libro recién publicado.',
  feria:
    'Editoriales y librerías con mesa propia, casi siempre con actividades encima. Dura uno o ' +
    'varios días y se entra y se sale.',
  'libreria-a-la-calle':
    'Librerías que sacan las mesas a la vereda por un día. Es una jornada del barrio, con ' +
    'descuentos y lecturas, no la actividad de una sola librería.',
};

const QUE_ES_CADA_ARANCEL: Readonly<Record<string, string>> = {
  gratis: 'No se paga nada. Puede tener cupo igual, así que conviene anotarse temprano.',
  'a-la-gorra':
    'Entrás sin pagar y al final ponés lo que puedas y quieras, en una gorra o un sobre que ' +
    'circula. No es lo mismo que gratis y no es una propina: es la forma en que se sostiene ' +
    'buena parte del circuito literario, y muchas veces es lo único que hace que la actividad ' +
    'exista. Nadie te va a decir un monto ni te va a mirar cuánto ponés.',
  arancelado:
    'Se paga. Cuánto, en cuántas veces y qué incluye lo escribe quien organiza al lado del ' +
    'precio, porque cambia mucho de una actividad a otra.',
};

export const TIPOS_DE_ACTIVIDAD: TerminoExplicado[] = explicar(
  opcionesBase.tipo as ValorBase[],
  QUE_ES_CADA_TIPO,
);

export const FORMAS_DE_ARANCEL: TerminoExplicado[] = explicar(
  opcionesBase.arancel as ValorBase[],
  QUE_ES_CADA_ARANCEL,
);

/**
 * Las preguntas, agrupadas. El orden de los grupos es el del recorrido de quien
 * llega: primero qué es esto, después cómo se lee una actividad, después cómo
 * se entra, y al final cómo seguirnos y cómo escribirnos.
 */
export const GRUPOS_DE_AYUDA: GrupoDeAyuda[] = [
  {
    id: 'que-es-esto',
    titulo: 'Qué es esta agenda',
    preguntas: [
      {
        id: 'que-es',
        pregunta: '¿Qué es esto?',
        respuesta: [
          'Una agenda de actividades literarias en Argentina: talleres de escritura, clubes de ' +
            'lectura, encuentros, presentaciones de libros y charlas con autores, en un solo lugar.',
          'Existe porque hoy todo eso se anuncia en historias que duran un día y en grupos a los ' +
            'que hay que estar adentro. Acá queda escrito, con fecha, lugar y cómo entrar.',
        ],
      },
      {
        id: 'no-es-inscripcion',
        pregunta: '¿Me anoto desde acá?',
        respuesta: [
          'No. Esta agenda no toma inscripciones, no cobra y no guarda tus datos: cada actividad ' +
            'se inscribe por el canal de quien la organiza, que puede ser un mail, un WhatsApp, un ' +
            'mensaje directo o un formulario propio. En la página de cada actividad está cuál es.',
          'Lo decimos fuerte porque es la confusión que sale cara: si nos escribís a nosotros para ' +
            'reservar un lugar, ese lugar no queda reservado en ningún lado.',
        ],
      },
      {
        id: 'como-entra-una-actividad',
        pregunta: '¿Cómo entra una actividad a la agenda?',
        respuesta: [
          'La cargamos a mano, una por una. No hay alta automática ni cuenta para organizadores: ' +
            'alguien la leyó, la entendió y la escribió acá.',
          'Publicar no cuesta nada. Que una actividad esté en la agenda no quiere decir que la ' +
            'recomendemos: quiere decir que existe, que se entiende cuándo y dónde es, y que hay ' +
            'una forma de anotarse.',
        ],
        enlaces: [{ href: '/contacto', texto: 'Sugerir una actividad' }],
      },
    ],
  },
  {
    id: 'leer-una-actividad',
    titulo: 'Cómo leer una actividad',
    preguntas: [
      {
        id: 'tipos',
        pregunta: '¿Qué quiere decir cada tipo?',
        respuesta: [
          'Son las categorías del circuito, no una clasificación cerrada: la lista puede crecer ' +
            'cuando aparece algo que no entra en ninguna.',
        ],
        glosario: TIPOS_DE_ACTIVIDAD,
      },
      {
        id: 'a-la-gorra',
        pregunta: '¿Qué quiere decir «a la gorra»?',
        respuesta: [
          'Es una de las tres formas de arancel que vas a ver, y la que más se malentiende.',
        ],
        glosario: FORMAS_DE_ARANCEL,
      },
      {
        id: 'ciclo',
        pregunta: 'La tarjeta dice ocho encuentros. ¿Es una actividad o son ocho?',
        respuesta: [
          'Es una sola. Un club de lectura de ocho encuentros no son ocho actividades: te anotás ' +
            'una vez y vas a las ocho fechas. Por eso aparece una tarjeta y no ocho, con la lista ' +
            'de encuentros adentro y, cuando corresponde, la lectura o el tema de cada uno.',
          'Las fechas están escritas una por una, no generadas «todos los martes»: siempre hay un ' +
            'feriado en el medio o una semana que se corre, y lo que ves es el calendario real.',
          'Un ciclo que ya empezó puede seguir aceptando gente. Si tiene fechas por venir, sigue ' +
            'en la agenda con la próxima a la vista.',
        ],
      },
      {
        id: 'encuentro-cancelado',
        pregunta: '¿Y si se cancela un encuentro, o la actividad entera?',
        respuesta: [
          'Un encuentro cancelado queda marcado como cancelado y sale del calendario, pero el ' +
            'resto del ciclo sigue igual.',
          'Si se cancela la actividad entera, la página no desaparece: queda con el aviso de que ' +
            'se canceló. Un link que ya circuló por Instagram y por WhatsApp tiene que llevar a ' +
            'algún lado que explique qué pasó, y no a una página de error.',
        ],
      },
      {
        id: 'modalidad',
        pregunta: '¿Presencial, virtual, híbrido?',
        respuesta: [
          'Presencial es en un lugar físico, con su dirección y su barrio. Virtual es por ' +
            'videollamada. Híbrido es que las dos cosas conviven.',
          'Una misma actividad puede tener más de una forma de cursarse, cada una con su lugar: ' +
            'los martes presencial en una librería y los jueves por videollamada. Cuando es así, ' +
            'están las dos escritas y no una sola mezclada.',
        ],
      },
      {
        id: 'ya-paso',
        pregunta: 'Entré por una búsqueda y la actividad ya pasó',
        respuesta: [
          'Las actividades que terminaron salen del listado pero conservan su página, porque el ' +
            'link puede seguir circulando meses y decirte «no existe» sería peor que decirte «ya ' +
            'fue».',
          'Muchas se repiten: si te interesó, lo más útil es seguir a quien la organiza, que ' +
            'figura en la misma página.',
        ],
      },
    ],
  },
  {
    id: 'anotarse',
    titulo: 'Anotarse',
    preguntas: [
      {
        id: 'como-me-anoto',
        pregunta: '¿Cómo me anoto?',
        respuesta: [
          'Por donde diga la actividad. En su página está el canal —mail, WhatsApp, mensaje ' +
            'directo o un formulario— y desde ahí se sale directo hacia quien organiza.',
          'Algunas no piden inscripción: en ese caso lo dice, y es entrada libre.',
        ],
      },
      {
        id: 'link-de-la-reunion',
        pregunta: 'Es virtual. ¿Dónde está el link de la reunión?',
        respuesta: [
          'No lo publicamos, y no es un olvido. Un link de videollamada publicado en internet es ' +
            'una invitación abierta para que se meta cualquiera a interrumpir, y eso ya arruinó ' +
            'suficientes encuentros. Te lo manda quien organiza cuando te anotás.',
          'Lo que sí vas a ver es por dónde es, para que sepas qué necesitás tener instalado.',
        ],
      },
      {
        id: 'cierre-de-inscripcion',
        pregunta: '¿Hasta cuándo me puedo anotar?',
        respuesta: [
          'Algunas actividades tienen fecha de cierre de inscripción y en ese caso figura. Cuando ' +
            'ya pasó, la página lo dice en vez de seguir ofreciéndote una puerta que no abre.',
          'Las que no tienen fecha de cierre se anotan hasta que se llenan, o hasta el día.',
        ],
      },
      {
        id: 'cupo-completo',
        pregunta: 'Dice que se llenó. ¿Escribo igual?',
        respuesta: [
          'Sí, y por eso el contacto sigue estando a la vista. En este circuito casi siempre hay ' +
            'lista de espera y casi siempre alguien se baja a último momento: esconder el contacto ' +
            'cuando se llena convierte cada baja en un lugar que se pierde.',
        ],
      },
      {
        id: 'material',
        pregunta: '¿Y el material de lectura?',
        respuesta: [
          'Sobre todo en los clubes de lectura hay lecturas, guías y textos de contexto. Algunos ' +
            'se publican acá y los podés mirar antes de decidir; otros te los mandan al anotarte o ' +
            'se reparten en el encuentro.',
          'Cuando el material no es público vas a ver de qué se trata y cuándo lo vas a recibir, ' +
            'pero no el archivo: publicarlo sería publicar el trabajo de otra persona.',
        ],
      },
    ],
  },
  {
    id: 'seguir-la-agenda',
    titulo: 'Seguir la agenda',
    preguntas: [
      {
        id: 'suscribirme',
        pregunta: '¿Puedo tener esto en mi calendario?',
        respuesta: [
          'Sí. Hay un calendario público al que te podés suscribir desde Google Calendar, desde el ' +
            'teléfono o desde cualquier lector de calendarios: cada encuentro entra como un evento, ' +
            'y si cambia la fecha o se cancela, se actualiza solo.',
          'No te suscribe a nada más ni te manda mails: es un calendario de solo lectura.',
        ],
        enlaces: [{ href: '/suscribirse', texto: 'Cómo suscribirse al calendario' }],
      },
      {
        id: 'buscar',
        pregunta: '¿Cómo busco?',
        respuesta: [
          'La búsqueda no distingue acentos ni mayúsculas: escribir «poesia» encuentra «poesía». ' +
            'Mira el título, la descripción, quién organiza, quién lo da, el libro que se presenta ' +
            'y dónde es.',
          'Los filtros se combinan entre sí, así que se puede pedir taller, a la gorra y virtual a ' +
            'la vez.',
        ],
        enlaces: [{ href: '/', texto: 'Ir a la agenda' }],
      },
      {
        id: 'no-esta',
        pregunta: 'Vi una actividad anunciada y acá no está',
        respuesta: [
          'Puede que todavía no la hayamos cargado, o que la acabemos de cargar y el sitio se esté ' +
            'armando de nuevo: un cambio recién hecho tarda unos minutos en verse.',
          'Si pasó un día y sigue sin estar, lo más probable es que no la hayamos visto. Contanos ' +
            'y la cargamos.',
        ],
        enlaces: [{ href: '/contacto', texto: 'Sugerir una actividad' }],
      },
    ],
  },
  {
    id: 'escribirnos',
    titulo: 'Escribirnos',
    preguntas: [
      {
        id: 'sugerir',
        pregunta: 'Quiero sugerir una actividad',
        respuesta: [
          'Escribinos con quién la da, cuándo y dónde. Con eso alcanza para empezar; si falta ' +
            'algo, lo buscamos.',
        ],
        enlaces: [{ href: '/contacto', texto: 'Sugerir una actividad' }],
      },
      {
        id: 'hay-un-error',
        pregunta: 'Hay un dato mal',
        respuesta: [
          'Pasa, y preferimos enterarnos por vos antes que dejarlo mal. Contanos qué viste mal y ' +
            'en qué página estabas.',
        ],
        enlaces: [{ href: '/contacto', texto: 'Reportar un error' }],
      },
      {
        id: 'soy-quien-organiza',
        pregunta: 'Organizo una actividad publicada y quiero cambiarla o sacarla',
        respuesta: [
          'Escribinos y la corregimos o la bajamos. No hace falta que expliques por qué.',
          'Si la bajamos, la página deja de estar y los links que ya circularon dejan de ' +
            'funcionar. Es lo esperable, y por eso conviene avisarnos antes de que el link circule ' +
            'mucho.',
        ],
        enlaces: [{ href: '/contacto', texto: 'Escribirnos' }],
      },
    ],
  },
];

/** La bajada del título: a quién le habla esta página. */
export const ENTRADA_DE_AYUDA =
  'Lo que suele preguntarse quien encuentra una actividad acá y quiere ir.';

/**
 * El cierre. Está acá y no suelto en la página por la misma razón que el resto:
 * si el texto vive en el marcado, nada verifica que siga ofreciendo una salida
 * cuando alguien reordene la página.
 */
export const CIERRE_DE_AYUDA: {
  titulo: string;
  texto: string;
  enlace: EnlaceDeAyuda;
} = {
  titulo: '¿No estaba tu pregunta?',
  texto:
    'Escribinos. Lo lee una persona, así que también sirve para decirnos que algo de esta ' +
    'página se entiende mal.',
  enlace: { href: '/contacto', texto: 'Ir a contacto' },
};

/** Todas las preguntas en una lista, para el índice y para los tests. */
export const PREGUNTAS_DE_AYUDA: PreguntaDelSitio[] = GRUPOS_DE_AYUDA.flatMap((g) => g.preguntas);
