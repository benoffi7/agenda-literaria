/**
 * Los nombres de los meses, en un solo lugar — B-215.
 *
 * ── Por qué se unificaron, contra el comentario que decía lo contrario ──────
 * `calendarioPanel.ts` tenía la lista con un comentario que la justificaba:
 * «duplicados a propósito respecto de `novedades.ts`: ahí son contenido de una
 * lista de novedades y acá son la navegación del calendario; atar los dos
 * módulos por una constante de texto no compra nada».
 *
 * El argumento es razonable y no se sostiene, y vale decir por qué en vez de
 * borrarlo: los doce nombres **no son de ninguno de los dos dominios**. Son un
 * hecho del castellano. Atar dos módulos por una constante de dominio los
 * acopla —si mañana el calendario quiere «Ene» y las novedades «enero», la
 * constante compartida estorba—; atarlos por el nombre de un mes no, porque no
 * hay ninguna versión del futuro en la que agosto se llame distinto en una
 * pantalla y no en la otra.
 *
 * Y lo que sí puede pasar es lo de siempre con dos copias: que una se arregle.
 * El caso concreto que estaba a un typo de distancia es un acento —«miercoles»
 * por «miércoles» ya vivió en este repo, en `DIAS_SEMANA`— corregido en un
 * archivo y no en el otro, con las dos pantallas a un clic de distancia
 * mostrando el mismo mes escrito distinto. Es exactamente la divergencia de
 * B-175 («Híbrido» en el formulario y «Presencial y virtual» en los filtros),
 * que también nació de dos mapas «a propósito» separados.
 *
 * Si en algún momento hace falta otra forma —abreviada, capitalizada— es un
 * **formateo** sobre esta lista, no otra lista.
 */

/** Los doce, en minúscula y arrancando en enero. `MESES[0] === 'enero'`. */
export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/**
 * El nombre del mes de un `'AAAA-MM'` o de un `'MM'`, o `null` si el número no
 * es un mes.
 *
 * Devuelve `null` y no una cadena vacía a propósito: los tres llamadores usan
 * ese `null` para caer en su propio texto de reserva (devolver la clave cruda),
 * y una cadena vacía se colaría al HTML como un hueco silencioso.
 */
export const nombreDeMes = (numero: string | number): string | null =>
  MESES[Number(numero) - 1] ?? null;
