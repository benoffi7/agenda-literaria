/**
 * El contenido de `/apoyar` — B-780.
 *
 * ── Por qué es un módulo de datos y no párrafos adentro del `.astro` ───────
 * Es la forma de D-140, la misma de `ayudaDelSitio.ts` y `contactoDelSitio.ts`:
 * el texto vive acá y la plantilla solo acomoda. Acá hay dos motivos propios,
 * y ninguno es la reutilización:
 *
 * 1. **Es la única página del sitio que le pide algo a alguien**, y lo que la
 *    hace aceptable son cuatro frases concretas: que la agenda es gratis, que
 *    nadie tiene que pagar nada, qué cuesta plata de verdad y qué se queda el
 *    intermediario. Si esas frases viven en el marcado, nada verifica que sigan
 *    estando cuando alguien reordene la página — y una página de donaciones a
 *    la que se le cayó el «no hace falta» es otra página.
 * 2. **Ninguna dirección se escribe acá.** El perfil de Cafecito sale de
 *    `lib/enlaces.ts` (B-228) y los destinos internos de `lib/rutasPublicas.ts`
 *    (B-227), que es lo que hace que el día que el usuario de Cafecito cambie no
 *    haya una copia vieja en un párrafo.
 *
 * ── El tono, que es la mitad del pedido ───────────────────────────────────
 * Lo pidió el dueño con todas las letras: **ni formal ni dramático**. En
 * concreto, y esto es lo que el test vigila:
 *
 * - **Nada de «en estos tiempos difíciles para la cultura»**, ni pedir con
 *   culpa, ni «gracias a personas como vos». El circuito literario no necesita
 *   que le tengan lástima: necesita que se sepa qué hay el sábado.
 * - **Nada de tercera persona institucional** («el proyecto agradece su
 *   colaboración»). Esto lo hace una persona, así que habla una persona.
 * - Lo que sí funciona es **contar qué es y qué cuesta**. Los números están
 *   escritos donde se pueden verificar y sin inventar precisión: «unos pocos
 *   dólares por mes» es lo que se puede afirmar sin que envejezca mal.
 *
 * ── Y una cosa que el módulo NO dice: cuánto ──────────────────────────────
 * No hay montos sugeridos ni una barra de meta. El monto lo pone Cafecito en su
 * propia página, así que escribirlo acá sería una segunda fuente que se queda
 * vieja sola (B-72, B-88 otra vez), y una meta convierte el gesto en una deuda
 * pendiente que la página tiene que ir mostrando.
 */
import { CAFECITO, urlDeCafecito, urlDeInstagram, INSTAGRAM } from '@/lib/enlaces';
import { hayBoletin } from '@/lib/boletinDelSitio';
import { RUTA_AYUDA, RUTA_CONTACTO, RUTA_SUSCRIBIRSE } from '@/lib/rutasPublicas';

/** Un destino que la página ofrece: del sitio o de afuera. */
export interface EnlaceDeApoyo {
  href: string;
  texto: string;
  /** `true` si sale del sitio: la plantilla lo tiene que decir. */
  externo?: boolean;
}

/** Una sección de párrafos corridos. */
export interface BloqueDeApoyo {
  id: string;
  titulo: string;
  parrafos: string[];
}

/** Una forma de dar una mano que no es plata. */
export interface FormaDeAyudar {
  titulo: string;
  texto: string;
  enlace: EnlaceDeApoyo;
}

/** Un ítem de la letra chica: lo que hay que decir aunque no se pregunte. */
export interface AclaracionDeApoyo {
  titulo: string;
  texto: string;
}

// ─────────────────────────────────────────────────────────────────
// La entrada
// ─────────────────────────────────────────────────────────────────

/**
 * La bajada del título.
 *
 * Es la frase más importante de la página y va primero a propósito: quien entró
 * de curiosidad tiene que poder irse en la primera línea sabiendo que no le
 * están cobrando nada. Todo lo que sigue es para quien se queda.
 */
export const ENTRADA_DE_APOYO =
  'La agenda es gratis y va a seguir siendo gratis. Esta página es para quien quiera ' +
  'poner algo igual.';

/**
 * El `<h1>` y la mitad del `<title>`.
 *
 * Vive acá y no en la plantilla por lo mismo que el resto: es una frase, y el
 * docblock de este módulo promete que las frases se pueden verificar. El nombre
 * del sitio lo agrega la página desde `identidad.ts` — acá no se escribe (D-141).
 */
export const TITULO_DE_APOYO = 'Apoyar la agenda';

/**
 * La `meta description`, y **la razón por la que está acá y no en el `.astro`**.
 *
 * `/ayuda`, `/contacto` y `/suscribirse` la escriben en la plantilla, así que
 * esto es un desvío del precedente y hay que justificarlo: la `meta description`
 * es exactamente la superficie que obligó a barrer la salida 8 con centinelas
 * —es texto libre que sale en el HTML indexado y está a un carácter de
 * interpolar algo—, y escrita en el `.astro` **queda afuera de
 * `TEXTO_DE_APOYO`**, que es la lista que este módulo declara como «un bloque
 * que no llegue acá es un bloque que nadie revisa».
 *
 * O sea que la página tenía dos frases exentas del único barrido que la cuida,
 * mientras su propio docblock afirmaba que no escribía ninguna. Lo encontró el
 * `auditor-privacidad`. Con las dos acá, el barrido de centinelas y los asertos
 * de tono las miran como al resto.
 *
 * Los ~160 caracteres son el recorte de Google; ésta entra.
 */
export const DESCRIPCION_DE_APOYO =
  'La agenda de actividades literarias es gratis y la hace una persona. Si te sirve y querés ' +
  'poner algo, se puede por Cafecito — y también hay tres formas que no cuestan nada.';

// ─────────────────────────────────────────────────────────────────
// Qué es esto
// ─────────────────────────────────────────────────────────────────

/**
 * Quién hace la agenda y por qué es gratis.
 *
 * Acá va el espíritu ad honorem, y va contado en primera persona y con hechos
 * —no cobro, no hay cuenta, no se vende nada— en vez de con adjetivos. «Proyecto
 * independiente y sin fines de lucro» es la versión formal de lo mismo y no dice
 * ninguna de las tres cosas.
 *
 * ── Lo que este párrafo NO puede decir, y por qué ─────────────────────────
 * La primera versión decía «**no se guarda quién entró**», y era falso: en la
 * misma pantalla está el banner de `AvisoDeCookies` diciendo que el sitio usa
 * Google Analytics, y con el consentimiento aceptado sale un `page_view` con su
 * client-id (la **salida 12**). Lo encontró el `auditor-privacidad`: no es una
 * fuga de nada, es peor de otra manera — **una promesa pública sobre datos que
 * el propio sitio contradice, en la única página cuyo valor entero es que se le
 * crea**, y en el HTML que se indexa. Los cuatro asertos de «las promesas»
 * verificaban que estuvieran, no que fueran verdad.
 *
 * Lo que quedó es lo verificable, con la condición dicha: se mide cuánta gente
 * entra, con Google Analytics y **solo si lo aceptás**. Y hay un test que
 * prohíbe volver a la versión sin condición.
 */
export const QUIEN_LA_HACE: BloqueDeApoyo = {
  id: 'quien-la-hace',
  titulo: 'Quién hace esto',
  parrafos: [
    'Una persona, en los ratos que le quedan. No cobro por publicar una actividad y no vendo ' +
      'datos de nadie: acá no hay cuenta que abrir, y lo único que se mide es cuánta gente ' +
      'entra — con Google Analytics, y solo si lo aceptás.' +
      (hayBoletin()
        ? ' Hay un correo semanal, y anotarse es decisión tuya: esa lista la maneja Mailchimp, ' +
          'que es quien lo manda.'
        : ''),
    'Empezó porque me perdí un taller que quería hacer. Estaba anunciado en una historia de ' +
      'Instagram que duró un día y me enteré tres semanas después, cuando ya había empezado. Eso ' +
      'sigue pasando todo el tiempo, y es lo único que la agenda arregla: que lo que se organiza ' +
      'quede escrito en algún lado, con fecha, lugar y cómo entrar.',
  ],
};

/**
 * Por qué esto tiene sentido: el circuito y quiénes lo sostienen.
 *
 * ── Cómo se habla de «la importancia de la cultura» sin ponerse solemne ───
 * Nombrando lo que existe. Un club de lectura en el fondo de una librería y una
 * gorra que circula al final son datos del circuito, verificables, y dicen lo
 * mismo que «la cultura es fundamental» sin pedirle nada al lector. El párrafo
 * evita a propósito «crisis», «difícil» y «resistir»: son las tres palabras con
 * las que este texto se volvería el que el dueño pidió no escribir.
 */
export const POR_QUE_IMPORTA: BloqueDeApoyo = {
  id: 'por-que-importa',
  titulo: 'Por qué vale la pena',
  parrafos: [
    'Casi todo lo que está acá lo organiza alguien que no vive de eso: una librería que presta el ' +
      'fondo del local los jueves, alguien que coordina un club de lectura y cobra a la gorra, un ' +
      'ciclo de poesía que se hace desde hace seis años y nunca cobró entrada. Se sostiene con ' +
      'trabajo de gente que además tiene otro trabajo.',
    'Una agenda no organiza nada de eso, pero hace la única cosa que faltaba: que se pueda ' +
      'encontrar. Un taller con cuatro inscriptos y uno con doce cuestan lo mismo de dar, y la ' +
      'diferencia entre los dos suele ser que alguien se enteró a tiempo.',
    'Si la usás y te sirve, la mejor noticia es que ya está: no hay nada que pagar. Y si te ' +
      'quedan ganas de poner algo, acá abajo está cómo — con plata y sin plata, y ninguna de ' +
      'las dos es obligatoria.',
  ],
};

// ─────────────────────────────────────────────────────────────────
// Qué cuesta
// ─────────────────────────────────────────────────────────────────

/**
 * Los costos reales, con nombre.
 *
 * Es lo que reemplaza al pedido genérico: en vez de «ayudanos a seguir online»,
 * la lista de qué se paga. Los tres primeros son plata y el cuarto no, y ese es
 * el que explica por qué la agenda crece despacio.
 *
 * **Los números son los que se pueden afirmar hoy.** El dominio se renueva por
 * año y el plan de Firebase cobra por uso, así que un monto exacto sería una
 * cifra que envejece sola en una página pública — el mismo criterio con el que
 * el pie no lleva un año de copyright escrito a mano.
 */
export const QUE_CUESTA: {
  id: string;
  titulo: string;
  entrada: string;
  puntos: AclaracionDeApoyo[];
} = {
  id: 'que-cuesta',
  titulo: 'Qué cuesta plata',
  entrada: 'Poco, pero no cero. Esto es todo:',
  puntos: [
    {
      titulo: 'El dominio',
      texto: 'Se renueva una vez por año. Es la parte más chica y la única que tiene fecha fija.',
    },
    {
      titulo: 'El hosting y el calendario',
      texto:
        'El sitio se sirve desde Firebase, y las funciones que mandan cada encuentro al ' +
        'calendario público están en un plan que cobra por uso. Hoy son unos pocos dólares por ' +
        'mes; si el sitio crece, sube.',
    },
    {
      titulo: hayBoletin() ? 'Casi nada más' : 'Nada más',
      texto:
        'No hay una suscripción de diseño ni un servicio de búsqueda: el sitio es HTML servido ' +
        'tal cual, que es también por qué carga rápido en un teléfono con mala señal.' +
        (hayBoletin()
          ? ' Lo único que se suma es la herramienta que manda el correo semanal, que hoy entra ' +
            'en su plan gratis; si la lista crece mucho empieza a costar, y ese día va a figurar ' +
            'en esta lista.'
          : ''),
    },
    {
      titulo: 'Y lo que cuesta y no es plata',
      texto:
        'Cada actividad se carga a mano: alguien la lee, entiende cuándo y dónde es, chequea ' +
        'cómo se anota la gente y la escribe. Son unos minutos por actividad, y es la razón por ' +
        'la que la agenda crece despacio.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// El cafecito
// ─────────────────────────────────────────────────────────────────

/**
 * El pedido, y el único de la página.
 *
 * ── El chiste del cafecito se usa una vez ─────────────────────────────────
 * La unidad de la plataforma es literalmente un café, así que la frase está
 * ahí para usarla — y una sola vez. Un texto que insiste con el cafecito en
 * cada párrafo («¡invitame otro!», «para que no me falte el café») es el tono
 * que el dueño pidió no escribir, con disfraz de simpático.
 *
 * ── Y la comisión se dice, sin porcentaje ─────────────────────────────────
 * Cafecito se queda una comisión y Mercado Pago otra: al 2026-09-04 la
 * plataforma publica un 5% y el medio de pago cobra lo suyo aparte, pero
 * Cafecito remite el detalle a lo que informa en el momento de pagar. Escribir
 * «5%» acá sería una cifra de un tercero copiada en nuestro sitio, que es la
 * clase de dato que se queda viejo sin que nada falle. Se dice el hecho —una
 * parte no llega— y se manda a leerlo donde es cierto.
 */
export const EL_CAFECITO: {
  id: string;
  titulo: string;
  parrafos: string[];
  accion: EnlaceDeApoyo;
  letraChica: string;
} = {
  id: 'un-cafecito',
  titulo: 'Invitame un cafecito',
  parrafos: [
    'Se hace por Cafecito, que es una plataforma argentina donde el aporte se mide, ' +
      'literalmente, en cafés: elegís cuántos, pagás con Mercado Pago y listo. No hace falta ' +
      'crear una cuenta ni suscribirse a nada, y se puede una sola vez.',
    'No compra nada. No hay una versión paga de la agenda, no se desbloquea ninguna actividad y ' +
      'no vas a aparecer en una lista de agradecimientos. Sirve para lo de arriba: el dominio, el ' +
      'hosting y las funciones del calendario.',
  ],
  accion: { href: urlDeCafecito(), texto: 'Invitame un cafecito', externo: true },
  letraChica:
    `El botón te lleva a cafecito.app/${CAFECITO}, que es otro sitio: el pago pasa por ahí y ` +
    'nosotros no vemos tus datos ni tu tarjeta. Una parte del aporte se la quedan Cafecito y ' +
    'Mercado Pago —es de lo que viven— y el resto llega acá; el detalle lo muestran ellos antes ' +
    'de que confirmes.',
};

// ─────────────────────────────────────────────────────────────────
// Sin plata
// ─────────────────────────────────────────────────────────────────

/**
 * Las formas que no son plata, y por qué están en la misma página.
 *
 * Porque son las que más sirven. Una actividad que falta es contenido que la
 * agenda no tiene, y un link pasado a la persona correcta es exactamente lo que
 * el sitio existe para hacer. Ponerlas acá —y no esconderlas en otra página— es
 * lo que hace que ésta no sea una página de cobranza.
 *
 * Los destinos salen de `rutasPublicas.ts` y de `enlaces.ts`, nunca escritos.
 */
export const SIN_PLATA: {
  id: string;
  titulo: string;
  entrada: string;
  formas: FormaDeAyudar[];
} = {
  id: 'sin-plata',
  titulo: 'Tres formas que no cuestan nada',
  entrada: 'Y que, siendo honesto, ayudan más que un cafecito:',
  formas: [
    {
      titulo: 'Contanos una actividad que falta',
      texto:
        'Es lo más útil que se puede hacer acá. Si viste un taller anunciado y no está en la ' +
        'agenda, probablemente no lo vimos: con quién lo da, cuándo y dónde alcanza para empezar.',
      enlace: { href: RUTA_CONTACTO, texto: 'Sugerir una actividad' },
    },
    {
      titulo: 'Pasale el link a quien lo esté buscando',
      texto:
        'Alguien que quiere escribir y no sabe dónde, alguien que se acaba de mudar de barrio. ' +
        'La agenda sirve en el momento exacto en que alguien la necesita, y ese momento lo ' +
        'conocés vos y no un buscador.',
      enlace: { href: RUTA_SUSCRIBIRSE, texto: 'Suscribirse al calendario' },
    },
    {
      titulo: 'Seguí a quien organiza, y a la agenda',
      texto:
        'En la página de cada actividad está la cuenta de quien la da: un taller que llena se ' +
        'vuelve a dar, y quien lo organiza se entera de que sirvió por la gente que aparece. Y en ' +
        'la cuenta de la agenda se anuncia lo que va entrando, antes de que lo busques.',
      enlace: { href: urlDeInstagram(), texto: `@${INSTAGRAM} en Instagram`, externo: true },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// La letra chica
// ─────────────────────────────────────────────────────────────────

/**
 * Lo que hay que decir aunque nadie lo pregunte.
 *
 * El primer ítem es el que sostiene la página entera y por eso va primero: **la
 * agenda no cambia si nadie aporta**. Es lo que hace que un aporte sea un gesto
 * y no un peaje, y es también la promesa que un rediseño podría borrar sin que
 * nada falle — de ahí que el test la exija por separado.
 */
export const LETRA_CHICA: { titulo: string; puntos: AclaracionDeApoyo[] } = {
  titulo: 'La letra chica',
  puntos: [
    {
      titulo: 'Si nadie aporta, no pasa nada',
      texto:
        'La agenda sigue igual: mismas actividades, mismo calendario, y sin un cartel pidiéndote ' +
        'plata cuando entrás a ver qué hay el sábado. Esta página existe para quien la vino a ' +
        'buscar, y no hay ninguna otra que te la ofrezca.',
    },
    {
      titulo: 'No es una organización ni recibe donaciones formales',
      texto:
        'No hay una asociación detrás, no emitimos recibos y esto no es deducible de ningún ' +
        'impuesto. Es una persona con un sitio y una cuenta de Cafecito.',
    },
    {
      titulo: 'Y no compra un lugar en la agenda',
      texto:
        'Publicar es gratis y va a seguir siendo gratis, así que aportar no adelanta a nadie en ' +
        'la fila ni destaca una actividad. Si organizás algo, mandalo y listo: no hace falta ' +
        'pasar por acá.',
    },
  ],
};

/** Adónde mandar a quien en realidad venía con una pregunta sobre el sitio. */
export const ANTES_DE_APOYAR: EnlaceDeApoyo = {
  href: RUTA_AYUDA,
  texto: 'Si lo que buscabas es cómo funciona la agenda, está en la ayuda',
};

/**
 * Todos los párrafos y frases de la página en una lista, para los tests.
 *
 * Es lo que permite barrer el texto entero de una sola vez —el tono, los
 * centinelas del §5.1, las direcciones escritas a mano— sin que un bloque nuevo
 * quede afuera del barrido por olvido. Un bloque que no llegue acá es un bloque
 * que nadie revisa.
 */
export const TEXTO_DE_APOYO: string[] = [
  TITULO_DE_APOYO,
  DESCRIPCION_DE_APOYO,
  ENTRADA_DE_APOYO,
  QUIEN_LA_HACE.titulo,
  ...QUIEN_LA_HACE.parrafos,
  POR_QUE_IMPORTA.titulo,
  ...POR_QUE_IMPORTA.parrafos,
  QUE_CUESTA.titulo,
  QUE_CUESTA.entrada,
  ...QUE_CUESTA.puntos.flatMap((p) => [p.titulo, p.texto]),
  EL_CAFECITO.titulo,
  ...EL_CAFECITO.parrafos,
  EL_CAFECITO.accion.texto,
  EL_CAFECITO.letraChica,
  SIN_PLATA.titulo,
  SIN_PLATA.entrada,
  ...SIN_PLATA.formas.flatMap((f) => [f.titulo, f.texto, f.enlace.texto]),
  LETRA_CHICA.titulo,
  ...LETRA_CHICA.puntos.flatMap((p) => [p.titulo, p.texto]),
  ANTES_DE_APOYAR.texto,
];
