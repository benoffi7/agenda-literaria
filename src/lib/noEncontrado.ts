/**
 * `/404` — la página que contesta cuando la dirección no existe. B-310, §4.5 y
 * §5.1 del diseño.
 *
 * ── Por qué existe, y por qué recién ahora ────────────────────────────────
 * El §4.5 la diseñó desde el principio —«buscador, los hubs, y "quizá la
 * actividad que buscás ya pasó: mirá el archivo"»— y **no se había construido**:
 * hasta este cambio respondía el 404 por defecto de Firebase Hosting. B-234 lo
 * encontró barriendo el drift entre el diseño y las rutas reales, y B-310 lo
 * anotó con su motivo, que es lo que explica la demora: **mientras el slug sea
 * inmutable (trampa 10) ninguna URL nuestra se rompe sola**, así que este 404 lo
 * ven sobre todo los bots y quien tipea mal una dirección.
 *
 * Lo que sí gana la página es el caso concreto que el ítem nombra: el link viejo
 * de Instagram hacia algo que se renombró antes de que la regla existiera. El
 * destino natural de esos no es una pared blanca, es **el archivo** — de ahí que
 * la tercera frase de acá abajo mande a `/pasadas`.
 *
 * ── Es una salida pública, y la más chica del repo ────────────────────────
 * Lo único que publica son **estas cuatro frases**, escritas a mano y sin un solo
 * dato de ninguna actividad. Ni un título, ni una cuenta, ni una fecha. Los
 * enlaces de la página —la tira «Explorá por» y el archivo— salen de productores
 * que ya están auditados: `exploracionDelSitio` (salida 11) y `RUTA_PASADAS`
 * (`rutasPublicas.ts`).
 *
 * ── Por qué `frasesDeNoEncontrado` recibe los grupos si ninguna frase los usa ─
 * Por lo mismo que `frasesDePasadas` recibe las entradas: **para que el barrido
 * de centinelas signifique algo**. La función que arma el texto tiene a mano los
 * únicos datos que esta página ve —los grupos de la tira, que traen etiquetas de
 * taxonomía y nombres de mes— y no los usa, así que
 * `tests/barrido-de-salidas-publicas.test.ts` la barre con la lista de permitidos
 * **vacía**. El día que a alguien se le ocurra la mejora obvia —«¿buscabas
 * *Taller de crónica*?», o «hay 12 talleres con fecha próxima»— el barrido lo
 * dice sin que haya que tocar el test.
 *
 * Con las frases sueltas y sin punto de entrada, esa interpolación se agregaría
 * por un parámetro nuevo y el barrido no vería nada: seguiría llamando a
 * constantes.
 */
import type { GrupoDeExploracion } from '@/lib/hubsPublicos';

/**
 * El `<h1>` y la primera mitad del `<title>` — el texto del §5.1, palabra por
 * palabra.
 *
 * **«No encontramos», en primera persona del plural.** No «Error 404», que es el
 * número de un protocolo y no le dice nada a nadie, y no «Página no encontrada»,
 * que suena a que el error lo cometió quien entró.
 */
export const TITULO_NO_ENCONTRADO = 'No encontramos esa página';

/**
 * Los dos motivos posibles, dichos sin culpar a nadie.
 *
 * El orden importa: la dirección mal escrita es el caso frecuente y el que se
 * arregla solo; «la actividad ya no está» es el que necesita el enlace de abajo.
 */
export const BAJADA_NO_ENCONTRADO =
  'Puede que la dirección esté mal escrita, o que la actividad que buscabas ya no esté en la agenda.';

/**
 * La frase del §4.5, la que da la salida concreta: «quizá la actividad que
 * buscás ya pasó: mirá el archivo».
 *
 * Va **antes** de la tira de hubs y no al pie: es la respuesta más probable para
 * quien llegó acá desde un link viejo, que es el único recorrido real de esta
 * página.
 */
export const ARCHIVO_NO_ENCONTRADO =
  'Quizá la actividad que buscabas ya pasó: todo lo que hubo sigue en el archivo.';

/**
 * El rótulo del campo de búsqueda, que es un `<label>` de verdad y no un
 * `placeholder` — §10: un placeholder desaparece al tipear y no lo lee un lector
 * de pantalla como nombre del control.
 */
export const BUSCAR_NO_ENCONTRADO = 'Buscá en la agenda';

/**
 * Los dos textos que van **adentro** de un control: el botón que manda el
 * formulario y el enlace al archivo.
 *
 * Viven acá y no escritos en la plantilla, y no es prolijidad — **lo encontró el
 * `auditor-privacidad` sobre este mismo cambio**. El barrido de centinelas de esta
 * salida corre sobre lo que devuelve `frasesDeNoEncontrado`, así que un texto
 * escrito en el `.astro` queda **fuera del barrido**: hoy no llevan ningún dato y
 * no hay fuga, pero la frase número siete se escribe donde ya hay seis, y el
 * docblock de la página decía «la plantilla no arma texto» cuando ya no era
 * cierto.
 *
 * Entran a la interfaz de abajo, así que entran solos al barrido, que recorre
 * `Object.values`.
 */
export const ACCION_NO_ENCONTRADO = 'Buscar';
export const ENLACE_NO_ENCONTRADO = 'Mirá el archivo';

/** El nombre del parámetro con el que la búsqueda de la home lee el texto (§6.2). */
export const CLAVE_BUSQUEDA = 'q';

/**
 * Las seis frases de la página. Ver el docblock del archivo para por qué
 * recibe los grupos de la tira sin usarlos.
 */
export interface FrasesDeNoEncontrado {
  titulo: string;
  bajada: string;
  archivo: string;
  buscar: string;
  /** El texto del botón que manda el formulario. */
  accion: string;
  /** El texto del enlace a `/pasadas`. */
  enlace: string;
}

export const frasesDeNoEncontrado = (
  /*
   * Entra y no sale: **ésa es la propiedad que el barrido afirma**, y el
   * parámetro no es decorativo por eso. Que la página pase los grupos de verdad
   * —y no `[]`, que volvería la premisa una tautología— lo fija
   * `tests/no-encontrado.test.ts`.
   */
  grupos: readonly GrupoDeExploracion[],
): FrasesDeNoEncontrado => ({
  titulo: TITULO_NO_ENCONTRADO,
  bajada: BAJADA_NO_ENCONTRADO,
  archivo: ARCHIVO_NO_ENCONTRADO,
  buscar: BUSCAR_NO_ENCONTRADO,
  accion: ACCION_NO_ENCONTRADO,
  enlace: ENLACE_NO_ENCONTRADO,
});
