/**
 * El contenido de `/anunciar` — la sección comercial del sitio (B-770).
 *
 * ── Qué se ofrece, y qué NO se ofrece ─────────────────────────────────────
 * Se ofrece **espacio en el sitio** a cafés, librerías y espacios culturales, y
 * la acción es **un mail**. No hay formulario —el sitio es estático y no hay nada
 * que reciba uno—, no hay alta de cuenta y **no hay planes ni precios**: eso
 * último es una instrucción del dueño y no un olvido. Una tabla de «Básico / Pro
 * / Premium» en una página pública le saca la negociación de las manos a quien
 * tiene que negociar, y encima habría que inventar los tres nombres y los tres
 * números.
 *
 * ── Por qué el texto vive acá y no en el `.astro` ─────────────────────────
 * Por lo mismo que `ayudaDelSitio.ts`, `contactoDelSitio.ts` y `suscripcion.ts`:
 * porque **lo que hay que verificar es el texto**, y esta página tiene una
 * propiedad que ninguna otra del sitio necesita —**no puede afirmar un número de
 * audiencia**— que solo se puede afirmar sobre datos.
 *
 * El sitio empezó a medir el 2026-09-03 (B-372, B-373). O sea que hoy **no hay
 * un histórico que valga presentar**, y la tentación de la página comercial es
 * exactamente la de escribir «miles de lectores» porque suena mejor que la
 * verdad. Eso sería inventar, que es lo que este repo lleva media docena de
 * decisiones evitando (D-138, D-159, D-272: mejor un dato ausente que uno que
 * miente). `tests/comercial-del-sitio.test.ts` barre el texto buscando cifras de
 * audiencia y palabras de volumen, así que la próxima versión de esta página no
 * las puede meter sin que algo se ponga en rojo.
 *
 * ── La dirección no se escribe acá ────────────────────────────────────────
 * El `mailto:` sale de `enlaces.ts` (`urlDeContactoComercial`), que es el único
 * lugar donde vive la casilla del proyecto (B-228). Ver ahí por qué esto **no**
 * es un tercer `MOTIVO_DE_CONTACTO`.
 *
 * ── Tono ──────────────────────────────────────────────────────────────────
 * El de `/ayuda`: directo, concreto, en segunda persona. Sin jerga de marketing
 * —ni «potenciá tu marca» ni «sinergia» ni «audiencia calificada»—, que además de
 * sonar a otro sitio es lo que se escribe cuando no se tiene nada concreto que
 * decir. Acá hay cosas concretas que decir, y son verificables.
 */
import { ASUNTO_COMERCIAL, urlDeContactoComercial } from '@/lib/enlaces';
import { RUTA_CONTACTO } from '@/lib/rutasPublicas';

/**
 * Un bloque de la página: un título corto y uno o dos párrafos.
 *
 * `id` es el ancla de la sección (`/anunciar#publico`) y **no se renombra**:
 * puede estar linkeado desde un mail.
 */
export interface BloqueComercial {
  id: string;
  titulo: string;
  texto: string;
}

/** La acción de la página: el mail, con el asunto ya puesto. */
export interface AccionComercial {
  /** Lo que dice el botón. */
  etiqueta: string;
  /** El asunto con el que llega el mail. Se muestra para que se sepa. */
  asunto: string;
  /** El `mailto:` armado. Nunca se escribe a mano. */
  href: string;
}

// ───────────────────────────────────────────────────────────────────────────
// La entrada
// ───────────────────────────────────────────────────────────────────────────

/**
 * Lo primero que se lee, y lo único que la página necesita que se entienda: **el
 * público de esta agenda y el de un café literario son el mismo**.
 *
 * Es el argumento entero y no necesita un número para pararse — lo que sí
 * necesita es no exagerarlo, así que dice qué busca esa gente y no cuánta es.
 */
export const ENTRADA_COMERCIAL =
  'A esta agenda entra gente que está buscando un taller de escritura, un club de lectura o una ' +
  'presentación, en una ciudad concreta y para las próximas semanas. Si tenés un café, una ' +
  'librería o un espacio cultural, es la misma gente que se sienta en tus mesas.';

// ───────────────────────────────────────────────────────────────────────────
// Por qué acá
// ───────────────────────────────────────────────────────────────────────────

/**
 * Los cuatro argumentos, y **los cuatro son verificables hoy**: cualquiera puede
 * abrir el sitio, mirar el `sitemap.xml`, ver una página de actividad o revisar
 * qué scripts carga la página y comprobarlos. Ninguno afirma un tamaño de
 * audiencia, porque todavía no hay con qué (ver `LETRA_CHICA_COMERCIAL`).
 */
export const POR_QUE_ACA: BloqueComercial[] = [
  {
    id: 'publico',
    titulo: 'El público es el mismo, no parecido',
    texto:
      'Quien entra acá ya salió a buscar algo para leer, escribir o escuchar: no hay que ' +
      'convencerlo de que le interesan los libros. Un café con una mesa larga, una librería que ' +
      'presta el fondo del local o un espacio con sillas y micrófono le sirven el mismo día.',
  },
  {
    id: 'buscador',
    titulo: 'Se llega buscando, no pasando',
    texto:
      'El sitio está hecho para que se lo encuentre en el buscador: cada actividad tiene su ' +
      'propia página, con su fecha y su dirección, y esas páginas se le ofrecen a Google con los ' +
      'datos escritos para que los entienda. No es una historia que dura un día.',
  },
  {
    id: 'circuito',
    titulo: 'Es de acá, y está cargado a mano',
    texto:
      'Solo hay actividades literarias en Argentina, cargadas y revisadas una por una. No es un ' +
      'directorio automático que junta todo lo que encuentra, y por eso quien lo usa vuelve.',
  },
  {
    id: 'sin-perseguir',
    titulo: 'No perseguimos a nadie',
    texto:
      'El sitio no arma perfiles, no hace remarketing y no guarda de quien lo visita más de lo ' +
      'que dice el aviso de cookies. Hoy no tiene un solo anuncio ni un script de un tercero: si ' +
      'se muestra algo tuyo, lo vamos a cargar nosotros como cargamos una actividad.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// La letra chica: lo que todavía no se puede decir
// ───────────────────────────────────────────────────────────────────────────

/**
 * **La sección que hace honesta a la página**, y la que le da a esta salida su
 * único chequeo propio.
 *
 * Va escrita antes de que la pregunten, y en la página se ve como letra chica sin
 * dejar de leerse — el mismo lugar y el mismo criterio que «lo que el calendario
 * no hace» en `/suscribirse`. Quien vende publicidad y no tiene números tiene dos
 * caminos: inventarlos, o decir que no los tiene. El segundo es más incómodo por
 * un minuto y no se puede desmentir nunca.
 */
export const LETRA_CHICA_COMERCIAL: BloqueComercial[] = [
  {
    id: 'sin-numeros',
    titulo: 'Todavía no tenemos números de audiencia',
    texto:
      'Empezamos a medir las visitas en septiembre de 2026, así que no hay un histórico que ' +
      'valga presentar. Lo decimos antes de que lo preguntes: cuando haya datos te los pasamos ' +
      'como estén, sin redondear para arriba.',
  },
  {
    id: 'sin-planes',
    titulo: 'No hay planes ni una lista de precios',
    texto:
      'No vendemos paquetes cerrados ni hay un formato fijo todavía. Contanos qué espacio tenés ' +
      'y lo vemos con vos, que para eso alcanza un mail y no un formulario de diez campos.',
  },
  {
    id: 'sin-red',
    titulo: 'No hay una red de anuncios en el medio',
    texto:
      'Nada de lo que se muestre acá va a venir de una red que pone sus propias cookies y decide ' +
      'sola qué mostrar. Es la razón por la que el sitio carga rápido y no te sigue: cambiar eso ' +
      'por unos pesos sería vender lo único que lo hace distinto.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Cómo sigue
// ───────────────────────────────────────────────────────────────────────────

/**
 * Qué conviene contar en el mail.
 *
 * Es lo propio de esta página, igual que la lista de `/contacto`: sin estas
 * cuatro cosas la respuesta es una repregunta, y ese ida y vuelta es donde se
 * pierde una conversación que empezó con ganas.
 */
export const QUE_CONTARNOS: string[] = [
  'Qué espacio tenés y dónde: el nombre, la dirección y qué se hace ahí.',
  'Qué te gustaría que se vea: el lugar, algo que estés organizando, o las dos cosas.',
  'Si hay una fecha o un momento que te importe: una apertura, un ciclo que arranca.',
  'Cómo te conviene que te contestemos, y en qué horario te encontramos.',
];

/** El mail. El asunto y la dirección salen del contrato de enlaces, siempre. */
export const ACCION_COMERCIAL: AccionComercial = {
  etiqueta: 'Escribirnos sobre publicidad',
  asunto: ASUNTO_COMERCIAL,
  href: urlDeContactoComercial(),
};

/** Qué pasa después de mandarlo. Corto, y sin prometer un plazo. */
export const DESPUES_DEL_MAIL: string[] = [
  'Lo lee una persona, no un sistema: no vas a recibir un acuse automático y puede demorar unos ' +
    'días.',
  'No usamos tu dirección para nada más que responderte, y no se la damos a nadie.',
];

/**
 * **Lo primero que la página dice, y es para no cobrar por lo que es gratis.**
 *
 * La mitad de los espacios que van a leer esto **organizan** actividades
 * literarias, y publicarlas en la agenda no cuesta nada ni lo va a costar: se
 * piden por `/contacto`, con la lista de qué conviene contar que ya está escrita
 * ahí. Sin esta línea, esta página convierte un pedido gratuito en una consulta
 * comercial, que es la clase de confusión que sale caro aclarar después.
 */
export const ANTES_DE_ESCRIBIRNOS: { href: string; texto: string } = {
  href: RUTA_CONTACTO,
  texto: 'Si lo que organizás son actividades literarias, publicarlas en la agenda no cuesta nada',
};
