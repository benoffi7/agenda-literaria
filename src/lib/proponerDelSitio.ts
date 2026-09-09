/**
 * El contenido de `/proponer` — B-830, paso 9.
 *
 * ── Qué es esta página, y qué no ──────────────────────────────────────────
 * Es el único formulario del sitio público, y lo que manda **no se publica**:
 * cae en una bandeja del panel y alguien lo mira. Eso no es un detalle de
 * implementación, es la primera cosa que la página tiene que decir — quien
 * propone tiene que saber que no está publicando.
 *
 * ── Por qué el texto vive acá y no en el `.astro` ─────────────────────────
 * El mismo motivo que `contactoDelSitio.ts` y `ayudaDelSitio.ts`: siendo data se
 * puede testear. Y acá hay una razón de más, que es de las caras: esta página
 * **promete cosas sobre el dato personal de quien la usa** —para qué se usa,
 * quién lo ve, cuánto se guarda— y `tests/promesas-sobre-datos.test.ts` barre
 * todos los `*DelSitio.ts` buscando negaciones absolutas. Una promesa que nace
 * falsa es lo que costó B-780 como P0, y acá el dato es de un tercero.
 *
 * ── La promesa, y por qué está redactada así ──────────────────────────────
 * El § 7 del PRD pide que la página diga **tres cosas con esas palabras**: para
 * qué se usa el contacto, quién lo ve y cuánto tiempo se guarda. Ninguna está
 * escrita como negación («no compartimos nada», «no guardamos datos») a
 * propósito: son afirmaciones acotadas y verificables, que es lo que el barrido
 * exige y lo que se puede sostener. Cada una tiene su contraparte en el código:
 * el `allow read: if esAdmin()` de `firestore.rules`, la ausencia de proyección
 * pública, y `borrarPropuestasVencidas`.
 *
 * Tono: le habla a quien organiza un taller y quiere que aparezca en la agenda.
 * No a quien mantiene el sitio.
 */
import { RUTA_AYUDA, RUTA_CONTACTO } from '@/lib/rutasPublicas';
import { MAX_FECHAS_PROPUESTA } from '@/types/propuesta';

/** El título y la bajada, que son lo que decide si alguien sigue leyendo. */
export const TITULO = 'Proponer una actividad';

export const BAJADA =
  'Si organizás un taller, un club de lectura o una presentación y querés que esté en la ' +
  'agenda, contanos de qué se trata. Lo miramos y, si entra, lo publicamos nosotros: esto ' +
  'no publica nada solo.';

/**
 * Lo que pasa después de mandar. Van **antes** del formulario y no al pie: son
 * las tres cosas que alguien quiere saber **antes** de escribir su teléfono en
 * una caja de texto de un sitio que no conoce.
 */
export const QUE_PASA_CON_LO_QUE_MANDAS: readonly string[] = [
  'Lo que mandás llega a una bandeja privada del panel. No se publica solo, y hasta que ' +
    'alguien lo revise no aparece en ninguna parte del sitio.',
  'Si la actividad entra, la cargamos nosotros y aparece como cualquier otra. Puede que le ' +
    'corrijamos el título o le completemos algo que falte.',
  'Si no entra, se descarta. La foto que hayas mandado se borra en ese momento y el resto de ' +
    'lo que escribiste se borra a los 30 días.',
];

/**
 * La promesa sobre el contacto, aparte y con su propio rótulo.
 *
 * Es el dato más delicado que el sitio pide —el mail o el WhatsApp de una
 * persona— y merece su bloque: mezclarlo con «qué pasa después» lo convierte en
 * letra chica.
 */
export const SOBRE_TU_CONTACTO: readonly string[] = [
  'Tu forma de contacto la usamos para una sola cosa: escribirte si falta un dato o si algo ' +
    'no se entiende.',
  'La ven las cuatro personas que cargan la agenda, y nadie más: no sale al sitio, ni al ' +
    'calendario público, ni a ninguna otra parte.',
  'Se guarda mientras la propuesta esté en la bandeja. Si la descartamos, se borra a los 30 ' +
    'días junto con el resto.',
];

/** Qué conviene tener a mano antes de empezar. Ahorra la mitad de las repreguntas. */
export const ANTES_DE_EMPEZAR: readonly string[] = [
  'Las fechas y los horarios, aunque sean tentativos. Podés cargar hasta ' +
    `${MAX_FECHAS_PROPUESTA} encuentros.`,
  'Dónde es: el nombre del lugar, la dirección y el barrio. Si es por videollamada, alcanza ' +
    'con decirlo.',
  'Cuánto sale y cómo se hace para anotarse.',
  'El flyer, si tenés. No hace falta.',
];

/**
 * A dónde mandar a quien no viene a proponer nada.
 *
 * **DEC-10 dice que `/contacto` se queda**, así que esta página no puede ser la
 * única puerta: quien encontró un dato mal o quiere avisar de otra cosa va allá,
 * y quien tiene una duda de cómo funciona la agenda va a la ayuda. Sin estos dos
 * enlaces, el formulario se convierte en el buzón de todo.
 */
export const SI_NO_ES_ESTO = [
  {
    texto: 'Si encontraste un dato mal publicado o querés avisarnos de otra cosa',
    enlace: 'escribinos',
    href: RUTA_CONTACTO,
  },
  {
    texto: 'Si tenés una duda de cómo funciona la agenda',
    enlace: 'está la ayuda',
    href: RUTA_AYUDA,
  },
] as const;
