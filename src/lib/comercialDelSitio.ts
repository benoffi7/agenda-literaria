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
// El título y la descripción
// ───────────────────────────────────────────────────────────────────────────

/**
 * El nombre de la página, y **la única copia**: es el `<h1>` y es la primera
 * mitad del `<title>` (la segunda la pone `NOMBRE`, que por regla del repo no se
 * escribe literal en ninguna plantilla — D-141).
 */
export const TITULO_COMERCIAL = 'Anunciar en la agenda';

/**
 * La `meta description`, y **vive acá por el hallazgo del `auditor-privacidad`**.
 *
 * Estaba escrita en el marcado, y ahí quedaba fuera de `TEXTOS()` en el test: o
 * sea que el string **más leído** de esta salida —es el que Google muestra en el
 * resultado— era el único texto sin barrer. «Leída por miles de personas» en la
 * `meta description` habría salido en verde, que es exactamente el modo de falla
 * que este módulo existe para cerrar.
 */
export const DESCRIPCION_COMERCIAL =
  'Espacio para cafés, librerías y espacios culturales en una agenda que leen personas ' +
  'buscando talleres, clubes de lectura y presentaciones en Argentina.';

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
 * abrir el sitio, mirar el `sitemap.xml` o ver una página de actividad y
 * comprobarlos. Ninguno afirma un tamaño de audiencia, porque todavía no hay con
 * qué.
 *
 * ── Dos frases que hubo que corregir, y conviene que quede escrito ────────
 * Las encontró el `auditor-privacidad`, y las dos son la misma clase que el
 * número inventado: una afirmación linda que el propio sitio desmiente.
 *
 * **1 · «no tiene un solo script de un tercero» era falso.** Las tipografías se
 * sirven desde `fonts.googleapis.com` (es **B-481**, anotado a propósito) y
 * `gtag.js` se carga —con consentimiento— desde `googletagmanager.com` (B-372).
 * Que ninguno de los dos viaje en el HTML del build lo hace fácil de creer
 * mirando el `dist/`, y no lo vuelve cierto: peor, **el mismo `index.html` trae
 * el banner que dice que usamos Google Analytics**. Un anunciante que abre las
 * herramientas del navegador lo ve en diez segundos.
 *
 * **2 · «no hace remarketing» afirmaba un ajuste de consola que este repo no
 * controla.** B-480 apagó cuatro cosas de Enhanced Measurement, pero la
 * personalización de anuncios y Google Signals son settings de propiedad que
 * nadie verificó (queda anotado como B-773). Así que la frase dice lo que sí
 * garantiza el código y lo que sí depende de nosotros: **no hay un anuncio, ni
 * una red, ni un píxel**, no armamos perfiles ni vendemos datos, y la medición
 * es una sola y con consentimiento.
 *
 * El criterio es el mismo de los números: la versión honesta vende un poco menos
 * y no se puede desmentir.
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
      'propia página, con su fecha y su dirección, y las que están vigentes se le ofrecen a ' +
      'Google con los datos escritos para que los entienda. No es una historia que dura un día.',
  },
  {
    id: 'circuito',
    titulo: 'Es de acá, y está cargado a mano',
    texto:
      'Solo hay actividades literarias en Argentina, cargadas y revisadas una por una. No es un ' +
      'directorio automático que junta todo lo que encuentra, y por eso quien lo usa vuelve.',
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
  'No usamos tu dirección para nada más que responderte.',
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
