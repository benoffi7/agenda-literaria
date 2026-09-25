/**
 * **La retención de las fichas de la Guía, la decisión pura** — B-904, B-912,
 * B-917.
 *
 * Los plazos por estado y `decidirRetencionDeFichas`, que es `decidirRetencion`
 * con la tabla de la Guía y no una segunda decisión. La lectura y el borrado viven
 * en `retencion-fichas-firestore.js` (M-13 del PRD 6).
 */
import {
  decidirRetencion,
} from './retencion-propuestas.js';

/**
 * **DEC-13 sin contestar, tres veces más.**
 *
 * `contactoDeQuienCargo` es el mismo dato que el `contacto` de una propuesta —el
 * mail, el WhatsApp o el Instagram de alguien que no está logueado— y hasta acá
 * una ficha `rechazado` lo conservaba **para siempre**: `/librerias`,
 * `/suscripciones` y `/lugares` no tenían ninguna Function. Lo único que había
 * era `allow delete: if esAdmin()`, o sea el borrado a mano, que depende de que
 * alguien se acuerde — justo lo que B-838 decidió no aceptar.
 *
 * Y con los formularios públicos de `/guia/<x>/sumar` el campo pasa de opcional
 * a **obligatorio** (`libreriaPublicaFormSchema` y sus dos hermanos): quien carga
 * desde afuera no vuelve a entrar, así que sin contacto no hay forma de
 * repreguntar. O sea que cada alta anónima trae el dato de un tercero. La
 * excepción del borrado va **antes** que el dato, que es el orden que el dueño
 * fijó en B-843 punto 1.
 *
 * ── Una Function para las tres, y eso lo pedía el ítem ────────────────────
 * «Con tres directorios, lo que corresponde es extender `functions/retencion.js`
 * con la lista de colecciones, no escribir una Function por cada una» (B-904).
 * La lista sale de `COLECCIONES_DE_DIRECTORIO` (`directorios.js`), que ya es
 * quien declara qué guías existen: la cuarta entra a este barrido sola. Es la
 * misma derivación que B-922 acaba de cobrar en `limpieza-imagenes.js`, y por el
 * mismo motivo — una lista escrita a mano es la que queda vieja.
 *
 * ── Y NO borra nada de Storage, que es la diferencia con las propuestas ───
 * Una propuesta guarda su flyer bajo `propuestas/`, un prefijo que
 * `limpiarImagenesHuerfanas` no barre: por eso allá el objeto se borra a mano y
 * las dos mitades tienen que irse juntas. Una ficha de directorio usa el **mismo**
 * `GaleriaEditor` que una actividad, así que sus fotos viven en `imagenes/` y las
 * levanta ese barrido — desde B-922, que es el cambio que lo hizo cierto: hasta
 * entonces no las contaba como referencia y se las llevaba igual. Borrado el
 * documento, la foto queda sin dueño y se va sola a las 72 horas, con margen de
 * gracia y con tope por corrida. Duplicar acá el borrado de Storage sería una
 * segunda implementación de la misma idea, y la que se equivoque de prefijo borra
 * la imagen de una actividad publicada.
 */
export const MARGEN_DE_RETENCION_FICHA_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * **30 días sin que nadie la toque**, para la `pendiente`.
 *
 * Es B-844 aplicado a la bandeja de la Guía, y hace falta por lo mismo: la ficha
 * que llegó por el formulario público, no interesó y quedó ahí conservaría el
 * contacto de quien la cargó sin que ningún reloj la alcance. Con el otro plazo
 * sola, la única forma de que una ficha caduque sería que un admin apretara
 * «Descartar» — que es la dependencia que esto viene a sacar.
 *
 * Da el mismo número que el de arriba y son **dos constantes**, por el mismo
 * argumento que `MARGEN_SIN_TOCAR_MS` desarrolla para las propuestas: son dos
 * decisiones que hoy coinciden, no una. Atarlas con un `=` haría que mover el
 * margen de arrepentimiento moviera cuánto se guarda el contacto de alguien que
 * nunca recibió respuesta.
 */
export const MARGEN_SIN_TOCAR_FICHA_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cuánto se guarda cada estado de una ficha. `null` es «no vence».
 *
 * **`publicado: null` es el único de los tres que no es un plazo, y es una
 * decisión:** una ficha publicada está en el sitio, así que su contacto es lo
 * que deja avisarle a la librería que su ficha existe, corregirle un horario o
 * darla de baja cuando cierra. Es el mismo argumento con el que la propuesta
 * `aceptada` no vence, y tiene su caso propio en los tests para que nadie le
 * ponga un número «por simetría».
 *
 * Los tres nombres son los de `ESTADOS_DIRECTORIO` (`src/lib/directorios.ts`),
 * y eso lo ata un test: dos vocabularios del mismo ciclo de vida se separan sin
 * que nada falle, y acá el síntoma sería silencioso —un estado que la tabla no
 * nombra **no caduca**, así que el plazo deja de correr sin ningún error—.
 */
export const RETENCION_DE_FICHA_POR_ESTADO = {
  rechazado: MARGEN_DE_RETENCION_FICHA_MS,
  pendiente: MARGEN_SIN_TOCAR_FICHA_MS,
  publicado: null,
};

/** El estado terminal de una ficha, que es el que `relojDeRetencion` necesita saber. */
export const ESTADO_RECHAZADO_DE_FICHA = 'rechazado';

/**
 * Los estados que la query trae, **derivados de la tabla**. Mismo motivo que
 * `ESTADOS_QUE_CADUCAN`: escribir la lista al lado era el modo de falla obvio
 * —la tabla dice que caduca, la query no lo trae, no caduca nunca y nada falla—.
 */
export const ESTADOS_DE_FICHA_QUE_CADUCAN = Object.entries(RETENCION_DE_FICHA_POR_ESTADO)
  .filter(([, plazo]) => plazo !== null)
  .map(([estado]) => estado);

/**
 * Tope de fichas borradas por corrida, **por colección**. Misma salvaguarda que
 * `MAX_PROPUESTAS_POR_CORRIDA`: un bug en la lectura no puede vaciar un
 * directorio en una sola pasada. Lo que sobra queda para mañana y lo dice el log.
 */
export const MAX_FICHAS_POR_CORRIDA = 50;

/** Cuántas fichas trae cada página. Mismo criterio que `PROPUESTAS_POR_PAGINA`. */
export const FICHAS_POR_PAGINA = 200;

/**
 * Qué fichas caducaron. Es `decidirRetencion` con la tabla, el estado terminal y
 * el tope de la Guía — **no una segunda decisión**.
 *
 * Que sea un envoltorio y no una copia es el punto: el reloj de «la última señal
 * de vida», el `Object.hasOwn` contra las claves heredadas, el fallar cerrado
 * ante una fecha ilegible y el recorte por tope son propiedades que costaron
 * cuatro ítems de backlog cada una, y una segunda implementación las perdería de
 * a una sin que nada falle.
 *
 * Lo único que no se hereda es la guarda de la imagen, y porque **no aplica**:
 * una ficha no lleva `imagen`, así que `objetoDePropuesta(undefined)` da `null` y
 * la decisión nunca mira Storage — ver el docblock de
 * `MARGEN_DE_RETENCION_FICHA_MS`.
 *
 * @param {{
 *   fichas?: { id: string, estado?: string, creadoEn?: unknown, revision?: unknown, updateTime?: unknown }[],
 *   ahora?: number,
 *   plazos?: Record<string, number | null>,
 * }} _
 * @returns {{
 *   aBorrar: { id: string, objeto: string | null, visto: unknown }[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirRetencionDeFichas = ({
  fichas = [],
  ahora = Date.now(),
  plazos = RETENCION_DE_FICHA_POR_ESTADO,
} = {}) =>
  decidirRetencion({
    propuestas: fichas,
    ahora,
    plazos,
    estadoRechazado: ESTADO_RECHAZADO_DE_FICHA,
    tope: MAX_FICHAS_POR_CORRIDA,
  });
