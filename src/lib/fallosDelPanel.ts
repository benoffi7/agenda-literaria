/**
 * **Qué dice el cartel rojo del panel cuando algo falla** — B-929, reportado por
 * el dueño.
 *
 * El síntoma: «Failed to get document because the client is offline» en el
 * cartel del panel. Es texto del SDK de Firestore, tal cual, en inglés y
 * hablando de «document» — no dice qué pasó con lo que se estaba cargando, que
 * es lo único que importa en ese momento.
 *
 * ── Por qué es un ítem y no una queja de estilo ───────────────────────────
 * **El panel ya sabe lo que le pasó y no lo usaba para hablar.**
 * `clasificarFalloGuardado` (`lib/analytics-eventos.ts`) mapea `unavailable` y
 * `deadline-exceeded` a `motivo: 'red'` desde antes de este cambio: o sea que la
 * **métrica** quedaba bien etiquetada mientras la persona leía una frase en
 * inglés. La clasificación existía; lo que faltaba era que también decidiera el
 * texto.
 *
 * Por eso este módulo **no clasifica**: importa aquella función y traduce su
 * resultado. Dos clasificadores —uno para medir y otro para hablar— se separan
 * sin que nada falle, y el día que se separen la métrica diría «red» mientras el
 * cartel dice otra cosa (la clase de B-88).
 *
 * ── Qué se traduce y qué NO ──────────────────────────────────────────────
 * Solo lo que viene del SDK. Los mensajes **propios** del proyecto ya están en
 * castellano, nombran el dato concreto y son accionables —«Fecha inválida:
 * "31/02"», «El slug está tomado»— así que reemplazarlos por una frase genérica
 * sería perder información. La regla está escrita como código: los motivos que
 * `clasificarFalloGuardado` reconoce por **mensaje propio** devuelven el mensaje;
 * los que reconoce por **código de Firebase** devuelven texto nuestro.
 *
 * ── Por qué vive acá y no en `analytics-eventos.ts` ──────────────────────
 * Aquel módulo es el vocabulario de lo que se **mide**, y lo que se mide no
 * puede llevar contenido: sus etiquetas son cerradas justamente para que no se
 * escape una frase a GA4 (§9). Esto es lo contrario —texto para una persona— y
 * mezclarlos invitaría a mandar el uno por el otro.
 *
 * Puro: se testea sin DOM y sin Firestore.
 */
import { clasificarFalloGuardado, type MotivoFallo } from '@/lib/analytics-eventos';

/**
 * Los motivos cuyo texto **lo escribimos nosotros**, porque el original viene
 * del SDK y está en inglés.
 *
 * Es un `Record` completo y no un `switch` con `default`: el día que
 * `MOTIVOS_FALLO` gane un valor, el compilador exige la fila. Un `default` lo
 * dejaría caer en silencio al texto genérico, que es exactamente el problema que
 * este módulo viene a resolver.
 *
 * `null` significa «el mensaje original ya sirve»: ver el docblock de arriba.
 */
const TEXTO_POR_MOTIVO: Record<MotivoFallo, string | null> = {
  /*
   * **La frase dice las tres cosas que nadie puede deducir del mensaje del
   * SDK**, y en ese orden: qué pasó, qué NO pasó, y qué hacer.
   *
   * «No se guardó nada» es la que más falta hace: con «the client is offline» la
   * duda inmediata es si quedó a medias, y una escritura de Firestore no queda a
   * medias — o entró o no entró.
   */
  red:
    'Se cortó la conexión. No se guardó nada y no se perdió nada de lo que escribiste: ' +
    'probá de nuevo en un momento.',
  /*
   * **«Salí y volvé a entrar» es accionable y no un cliché**: el permiso viaja
   * en el claim del token de sesión (`setCustomUserClaims`), así que a una
   * cuenta que acaba de recibirlo el panel le sigue diciendo que no hasta que
   * renueve el token. Es el primer caso que le va a pasar a quien reciba acceso.
   */
  permisos:
    'Tu cuenta no tiene permiso para hacer esto. Si te acaban de dar acceso, salí y volvé a ' +
    'entrar: el permiso viaja en la sesión.',
  'sin-sesion': 'Se cerró tu sesión. Entrá de nuevo y volvé a intentarlo.',
  /*
   * Los tres de abajo son mensajes **propios**: ya están en castellano y nombran
   * el dato concreto. `null` = se muestra el original.
   */
  'fecha-invalida': null,
  'slug-tomado': null,
  desconocido: null,
};

/**
 * **El borrador del navegador sigue ahí** — la frase que se suma cuando quien
 * llama tiene autoguardado.
 *
 * Va por parámetro y **no** pegada al texto de `red`, y la diferencia importa:
 * el autoguardado existe solo en el formulario de actividad (`useAutoguardado`,
 * D-122). Prometerlo desde la pantalla de taxonomías o desde la bandeja sería
 * decirle a alguien que su trabajo está a salvo cuando no lo está — la clase de
 * mentira que cuesta más que el error original.
 */
export const TEXTO_DEL_BORRADOR =
  'Lo que cargaste quedó guardado en este navegador, así que no lo pierdas de vista: ' +
  'volvé a intentar el guardado.';

export interface OpcionesDeFallo {
  /**
   * Qué decir cuando no se pudo reconocer nada. Es la frase que cada pantalla ya
   * tenía escrita para el caso «el error no es un `Error`», y se sigue usando
   * para eso: dice qué operación falló, que es lo que un texto genérico no sabe.
   */
  respaldo: string;
  /**
   * ¿Esta pantalla tiene autoguardado? Solo el formulario de actividad, hoy.
   * Ver `TEXTO_DEL_BORRADOR`.
   */
  hayBorrador?: boolean;
}

/**
 * El texto que va al cartel rojo.
 *
 * ── El código de Firebase se agrega, no se esconde ────────────────────────
 * Cuando el motivo es `desconocido` **y** el SDK trajo un código, se muestra
 * entre paréntesis (`failed-precondition`). No es el mensaje en inglés: es una
 * etiqueta corta de vocabulario cerrado (`CODIGOS_FIREBASE`), y es lo único que
 * hace reportable un fallo que no supimos traducir. Sin él, «no se pudo guardar»
 * es lo mismo para quince causas distintas y el reporte que llegue no va a poder
 * decir cuál fue.
 *
 * ── Nunca sale el `message` del SDK ───────────────────────────────────────
 * Ni siquiera en `desconocido`. Es la decisión del ítem: lo que el SDK escribe
 * está en inglés, habla de «document» y a veces trae el path del documento — que
 * es lo mismo que `clasificarFalloGuardado` ya evita mandar a GA4 por si arrastra
 * contenido. Lo que sí se muestra es el mensaje **propio**, que este módulo
 * reconoce por motivo y no por olfato.
 */
export const textoDeFallo = (error: unknown, { respaldo, hayBorrador }: OpcionesDeFallo): string => {
  const { motivo, codigo } = clasificarFalloGuardado(error);
  const nuestro = TEXTO_POR_MOTIVO[motivo];

  if (nuestro) {
    // El borrador solo se promete donde existe, y solo para `red`: en `permisos`
    // y `sin-sesion` lo que hay que hacer es otra cosa y la frase distraería.
    return hayBorrador && motivo === 'red' ? `${nuestro} ${TEXTO_DEL_BORRADOR}` : nuestro;
  }

  /*
   * Motivo reconocido por **mensaje propio**: se muestra tal cual. Es castellano
   * y nombra el dato —«Fecha inválida: "31/02"»— así que taparlo con una frase
   * genérica sería perder lo único accionable que hay.
   */
  if (motivo !== 'desconocido' && error instanceof Error) return error.message;

  return codigo ? `${respaldo} (${codigo})` : respaldo;
};
