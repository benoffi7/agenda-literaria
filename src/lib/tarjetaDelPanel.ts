/**
 * Qué insignias lleva la fila de una actividad en el listado del panel (B-622).
 *
 * ── El problema que resuelve ──────────────────────────────────────────────
 * La fila mostraba el estado, «Cupo completo» y «Sin flyer», y cada una era un
 * `&&` suelto dentro del JSX. Eso tiene dos consecuencias que se pagan juntas:
 *
 * 1. **`destacado` no se veía en ninguna parte.** Es un flag que decide dónde
 *    aparece la actividad en el sitio y se prende desde el acordeón «Opcional»,
 *    o sea el lugar del formulario que nadie vuelve a abrir. Quedaba prendido —o
 *    apagado— sin que el listado, que es la pantalla del conjunto, lo dijera.
 * 2. **La próxima insignia también iba a nacer suelta en el JSX**, sin test, y
 *    la decisión de *qué merece una insignia* iba a seguir sin estar escrita en
 *    ninguna parte. Es la regla de `docs/05-patrones.md`: la decisión va a un
 *    módulo puro, el componente pinta.
 *
 * ── La regla, que es lo que hay que respetar al agregar la próxima ────────
 * **Solo se marca lo excepcional.** Si todo lleva marca, la marca deja de
 * avisar: es el mismo criterio con el que B-130 marca únicamente lo ajeno y con
 * el que B-264 pone «Sin flyer» solo en las publicadas. Una insignia nueva tiene
 * que pasar las tres:
 *
 * - es **poco frecuente** (si la mayoría la lleva, no informa);
 * - **cambia lo que se ve afuera** —el sitio, el calendario— o avisa de algo que
 *   ya no tiene arreglo;
 * - **no se puede leer de otra cosa que ya esté en la fila**.
 *
 * ── Por qué `tags` NO entra, que es la mitad de B-622 ─────────────────────
 * Fue la decisión del dueño y coincide con la regla de arriba, por tres razones
 * que se suman:
 *
 * - **son muchos y son de largo variable.** El estado, «Destacada» y «Cupo
 *   completo» son insignias de ancho acotado; una lista de etiquetas empuja la
 *   fila y en 360px se come el título, que es lo único que hace falta para
 *   encontrar la actividad;
 * - **no son excepcionales**: casi toda actividad tiene etiquetas, así que la
 *   marca no distinguiría nada;
 * - **ya son buscables**: entran en el buscador de texto del listado y tienen su
 *   propia pantalla en «Opciones», que es donde se los revisa de a montones.
 *
 * Si algún día hacen falta en la fila, no es como insignia: es como filtro, que
 * es la pregunta que la gente hace sobre una etiqueta («¿qué tengo de poesía?»),
 * y eso ya está descartado con motivo en D-74.
 */
import { faltaElFlyer, imagenesDe } from '@/lib/imagenes';

/** Una insignia de la fila. `id` es para el `key` y para los tests. */
export interface InsigniaDePanel {
  id: string;
  texto: string;
}

/**
 * La forma mínima que hace falta mirar. Los campos van opcionales porque esto se
 * corre sobre el documento crudo de Firestore: un documento anterior a que el
 * campo existiera no lo tiene, y el default de lectura tiene que ser «no lleva
 * la insignia» y no un `TypeError` en el render del listado.
 */
export interface DatosDeTarjeta {
  estado?: string;
  destacado?: boolean;
  inscripcion?: { completo?: boolean } | null;
}

/**
 * Las insignias de esta fila, en el orden en que se pintan.
 *
 * El **estado** no está acá: va aparte porque lleva color propio
 * (`COLOR_ESTADO`) y lo lleva **siempre**, así que no es una excepción sino la
 * identidad de la fila.
 *
 * `imagenes` entra por parámetro y no se lee del documento acá adentro para que
 * el llamador use la misma derivación que ya tiene en la mano (`imagenesDe`), y
 * para que este módulo no dependa de la forma de la galería más que en un lugar.
 */
export const insigniasDeTarjeta = (
  a: DatosDeTarjeta,
  imagenes: Parameters<typeof faltaElFlyer>[0],
): InsigniaDePanel[] => {
  const insignias: InsigniaDePanel[] = [];

  /*
   * B-97 — lo que se publica se ve desde el panel. Sin este cartel, «está
   * marcada como completa» solo se sabría abriendo el menú «⋯», y el sitio y el
   * calendario ya lo están diciendo.
   */
  if (a.inscripcion?.completo === true) {
    insignias.push({ id: 'cupo-completo', texto: 'Cupo completo' });
  }

  /*
   * B-622 — `destacado` cumple las tres condiciones de la regla: es raro por
   * definición (destacar todo es no destacar nada), cambia dónde aparece la
   * actividad en el sitio, y no se deduce de ningún otro dato de la fila.
   *
   * **Sin condicionar al estado**, a diferencia de «Sin flyer»: un borrador
   * destacado es información útil —está listo para salir arriba en cuanto se
   * publique— y, sobre todo, destacar es un acto deliberado que conviene poder
   * revisar antes de publicar y no después.
   */
  if (a.destacado === true) {
    insignias.push({ id: 'destacada', texto: 'Destacada' });
  }

  /*
   * B-264 — «se nota que falta»: el aviso del formulario solo lo ve quien ya
   * abrió esa actividad, y el listado es donde se ve el conjunto.
   *
   * **Solo en las publicadas**: un borrador sin flyer no le falta nada todavía;
   * una publicada sin flyer ya está afuera de la cartelera. La condición sale de
   * `faltaElFlyer`, la misma que usan el aviso del formulario y la cartelera:
   * tres lugares que tienen que decir lo mismo y una sola derivación.
   */
  if (a.estado === 'publicado' && faltaElFlyer(imagenes)) {
    insignias.push({ id: 'sin-flyer', texto: 'Sin flyer' });
  }

  return insignias;
};

/** Atajo para el listado, que ya tiene el documento entero en memoria. */
export const insigniasDeActividad = (
  a: DatosDeTarjeta & Parameters<typeof imagenesDe>[0],
): InsigniaDePanel[] => insigniasDeTarjeta(a, imagenesDe(a));
