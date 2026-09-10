/**
 * El correo de la agenda: el contenido de la sección de `/suscribirse` que
 * anota a alguien a la lista — B-847, **D-640**.
 *
 * ── Lo que este archivo cambia, y no es una sección más ───────────────────
 * Hasta hoy el sitio público **no le mandaba ni un dato de nadie a ningún
 * tercero**. Se medían páginas ya publicadas con consentimiento (la salida 12)
 * y se abrían enlaces salientes, pero ningún dato **de una persona** salía de
 * acá. Un correo mueve la casilla de quien se anota a **Mailchimp**, que es una
 * empresa de otro país. No es un impedimento: es que la promesa del sitio
 * cambia, y la promesa nueva se escribe en el mismo cambio —en esta página, en
 * `/ayuda` y en `docs/07-seguridad.md`—.
 *
 * ── Por qué es un `<form>` pelado y no el embebido de Mailchimp ───────────
 * Es la decisión del dueño (2026-09-10) y la única de las tres formas que no
 * rompe nada. El embebido con JavaScript trae `mc-validate.js` desde
 * `chimpstatic.com` **antes de cualquier consentimiento**, y eso pone en rojo
 * `tests/terceros-antes-del-consentimiento.test.ts` (D-254) con razón: es un
 * host de tercero contactado en el load, también para quien apretó «Rechazar».
 * Un `<form method="post">` no contacta a nadie hasta que la persona aprieta el
 * botón, que es exactamente la diferencia que D-254 defiende.
 *
 * El precio, aceptado: **el «gracias» lo da Mailchimp y no este sitio**. Por eso
 * el formulario abre pestaña nueva y por eso está avisado antes de tocar el
 * botón —igual que el camino de la aplicación Calendario en `suscripcion.ts`—.
 *
 * ── Por qué el texto vive acá y no en el markup ───────────────────────────
 * Mismo criterio que `suscripcion.ts` y `ayudaDelSitio.ts`: **lo que hay que
 * verificar es el texto**. Acá eso pesa más que en las otras dos, porque estas
 * frases no explican una función: **son la promesa** que alguien lee antes de
 * entregar su dirección, en HTML indexado, y una promesa así puede nacer falsa
 * (B-781). Siendo data, el test puede exigir que cada una **esté** y que ninguna
 * diga de más.
 *
 * ── Dos frases que el `auditor-privacidad` corrigió al revisarlo ─────────
 * La promesa de «dónde queda» decía **«es lo único que la agenda le manda a un
 * tercero»**, y era falsa por la puerta de siempre: con el consentimiento
 * aceptado, la salida 12 le manda a Google la URL, el título, el referrer y el
 * `client_id` — y el banner que lo dice está **en la misma pantalla**. Es la
 * forma exacta del bug de `/apoyar` (B-781), con una exclusividad afirmativa en
 * vez de una negación, que es justamente lo que las fórmulas de
 * `promesas-sobre-datos.test.ts` no ven. Hoy dice «además de lo que se mide con
 * tu permiso».
 *
 * Y decía **«este sitio es un montón de páginas sin base de datos de
 * personas»**, que dejó de ser cierto con B-830: `propuestas[].contacto` es un
 * dato personal de un tercero que el proyecto guarda. Lo que sí es cierto —y es
 * lo que la frase quería decir— es que no guarda la dirección de quien lo lee.
 *
 * ── El supuesto que este archivo no puede verificar ───────────────────────
 * **El doble opt-in es una casilla de la configuración de la lista en
 * Mailchimp, no una línea de código.** La página promete que llega un mail de
 * confirmación y que sin confirmar no queda nadie anotado; que eso sea cierto
 * depende de que la lista esté creada con doble opt-in. Es la misma clase que
 * los ajustes de GA4 que B-480 apagó en la consola: **configuración y no
 * código, así que no hay ningún test que la sostenga** (y por eso está escrito
 * acá, en `docs/07-seguridad.md` y en el checklist de `docs/08-operacion.md`).
 * Si alguien apaga esa casilla, ningún rojo lo dice y la página pasa a mentir.
 *
 * ── Tono ──────────────────────────────────────────────────────────────────
 * El de `suscripcion.ts`: le habla a quien va a un taller de escritura.
 */
import { CONTACTO, LISTA_DE_CORREO, campoTrampaDelBoletin, urlDeAltaAlBoletin } from '@/lib/enlaces';

/**
 * Una promesa de la sección: lo que la persona puede esperar si se anota.
 *
 * Es un registro y no párrafos sueltos por lo mismo que los caminos de
 * `suscripcion.ts`: así el test puede exigir **las cinco**, y una que se caiga
 * en un rediseño se nota. Cada una contesta algo que quien duda se pregunta
 * antes de escribir su dirección, y las cinco juntas son lo que reemplaza a la
 * página de privacidad que este sitio no tiene.
 */
export type IdDelTrato =
  | 'cadencia'
  | 'que-llega'
  | 'quien-lo-manda'
  | 'donde-queda'
  | 'como-te-vas';

export interface TratoDelBoletin {
  id: IdDelTrato;
  titulo: string;
  texto: string;
}

export const EL_BOLETIN = {
  titulo: 'Que te llegue por mail',
  paraQuien:
    'Si no vivís en el calendario pero abrís el mail, ésta es la otra forma de que no se te pase nada.',
} as const;

/**
 * Las cinco.
 *
 * **La de la cadencia es la que más se pensó, y conviene que quede escrito por
 * qué no dice lo que se pidió textual.** El dueño pidió «al menos una vez por
 * semana». Un **piso** se incumple con una sola semana floja, y esto no es una
 * frase de una conversación: es texto de una página indexada que
 * `tests/promesas-sobre-datos.test.ts` barre justamente porque una afirmación
 * pública que el propio proyecto desmiente es lo más caro que puede escribir
 * este sitio. «Al menos una vez por semana» pasa a ser falsa el primer feriado
 * largo, sin que nadie toque nada.
 *
 * La salida no es aflojar la promesa: es **nombrar la excepción**, que es lo que
 * este repo ya hizo dos veces. La advertencia del link de la reunión dice «casi
 * nunca» y no «nunca» porque «una advertencia que promete "nunca" miente el día
 * que pasa» (`suscripcion.ts`), y `/ayuda` corrigió «no tiene publicidad»
 * nombrando el espacio que sí se vende (B-785). Así que la cadencia dice el
 * ritmo —semanal, que es lo que el dueño pidió— **y** dice qué pasa la semana
 * que no hay nada: no sale. Las dos mitades son verdad hoy y siguen siéndolo la
 * semana que viene.
 */
export const EL_TRATO: Record<IdDelTrato, TratoDelBoletin> = {
  cadencia: {
    id: 'cadencia',
    titulo: 'Una vez por semana',
    texto:
      'Sale semanal, y alguna semana puede salir más de una vez si hay mucho. Si una semana no ' +
      'hay nada que valga la pena mandarte, esa semana no sale: preferimos que llegue algo que ' +
      'sirva antes que llegue puntual y vacío.',
  },
  'que-llega': {
    id: 'que-llega',
    titulo: 'Actividades elegidas a mano',
    texto:
      'No es la agenda entera volcada en un mail: es una selección, hecha para que haya para ' +
      'todos los gustos y de las tres maneras de cursar —presencial, virtual y mezclando las ' +
      'dos—. Talleres, clubes de lectura, presentaciones y encuentros, gratis, a la gorra y ' +
      'arancelados.',
  },
  'quien-lo-manda': {
    id: 'quien-lo-manda',
    titulo: 'Lo manda la agenda, no un robot',
    texto:
      `Lo escribe la misma persona que carga las actividades y te llega desde ${CONTACTO}, que ` +
      'es la casilla de siempre del proyecto. Podés responderle: del otro lado hay alguien.',
  },
  'donde-queda': {
    id: 'donde-queda',
    titulo: 'Tu dirección la recibe Mailchimp',
    texto:
      'La lista vive en Mailchimp, una empresa de Estados Unidos: tu dirección se la das a ella ' +
      'al anotarte, y es ella la que la tiene. Acá no queda: este sitio no tiene dónde guardar ' +
      'la dirección de nadie. Es lo único tuyo que sale de acá, además de lo que se mide con tu ' +
      'permiso y que te cuenta el aviso de abajo.',
  },
  'como-te-vas': {
    id: 'como-te-vas',
    titulo: 'Te anotás confirmando y te vas con un clic',
    texto:
      'Después de dejar tu dirección te llega un mail para confirmar: hasta que no lo confirmes ' +
      'no quedás anotado, que es lo que evita que alguien te anote a vos. Y cada envío trae ' +
      'abajo el enlace para darte de baja — con un clic alcanza, no hay que escribir a nadie.',
  },
};

/**
 * El orden en que se muestran. Va aparte del registro por lo mismo que
 * `ORDEN_CAMINOS`: una promesa escrita fuera de esta lista es una promesa que
 * nadie lee, y el test puede exigir que estén las cinco.
 *
 * El orden es el de las preguntas que alguien se hace, no el de importancia:
 * primero qué recibe y cada cuánto, después quién lo manda, y recién ahí las dos
 * que hablan de su dirección — que son las que hay que leer antes de escribirla,
 * y por eso van pegadas al campo.
 */
export const ORDEN_DEL_TRATO: readonly IdDelTrato[] = [
  'cadencia',
  'que-llega',
  'quien-lo-manda',
  'donde-queda',
  'como-te-vas',
];

export const tratoEnOrden = (): TratoDelBoletin[] => ORDEN_DEL_TRATO.map((id) => EL_TRATO[id]);

/**
 * El campo y el botón.
 *
 * `avisoLector` es obligatorio y no decorativo, igual que en `suscripcion.ts`:
 * este botón **no hace lo que un botón hace normalmente**, se va a una pestaña
 * de otro sitio. Quien mira la pantalla ve aparecer la pestaña; quien escucha la
 * página no tiene ninguna señal, salvo ésta.
 */
export const EL_FORMULARIO = {
  etiqueta: 'Tu dirección de mail',
  ayuda: 'Nada más que eso: no pedimos tu nombre ni ninguna otra cosa.',
  boton: 'Quiero recibirlo',
  avisoLector: 'se abre una pestaña de Mailchimp, que es donde se confirma el alta',
} as const;

/** Lo que el `<form>` necesita para existir: a dónde postea y el campo trampa. */
export interface FormularioDelBoletin {
  accion: string;
  campoTrampa: string;
}

/**
 * El formulario, o `null` si la lista todavía no existe.
 *
 * **Devolver `null` es la funcionalidad, no un caso borde.** Sin lista, un
 * formulario dibujado igual postearía la dirección de una persona contra un
 * endpoint que no es nuestro, y la página estaría publicando cinco promesas
 * sobre una lista que nadie puede cumplir. Ver `LISTA_DE_CORREO` en
 * `enlaces.ts`: es el orden que dejó escrito B-780 con `/apoyar`.
 */
export const formularioDelBoletin = (): FormularioDelBoletin | null =>
  LISTA_DE_CORREO === null
    ? null
    : {
        accion: urlDeAltaAlBoletin(LISTA_DE_CORREO),
        campoTrampa: campoTrampaDelBoletin(LISTA_DE_CORREO),
      };

/** Si la sección se dibuja. Es lo mismo que arriba, dicho para una plantilla. */
export const hayBoletin = (): boolean => formularioDelBoletin() !== null;

/**
 * Todo el texto de la sección, concatenado. Lo usa el test de tono, igual que
 * `textoDelContenido()` de `suscripcion.ts`: es la única forma de verificar que
 * no se coló jerga en una frase agregada hoy en un rincón.
 */
export const textoDelBoletin = (): string =>
  [
    EL_BOLETIN.titulo,
    EL_BOLETIN.paraQuien,
    ...tratoEnOrden().flatMap((t) => [t.titulo, t.texto]),
    EL_FORMULARIO.etiqueta,
    EL_FORMULARIO.ayuda,
    EL_FORMULARIO.boton,
    EL_FORMULARIO.avisoLector,
  ].join('\n');
