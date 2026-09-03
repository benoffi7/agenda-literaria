/**
 * Qué pantallas del panel usan todo el ancho de la pantalla — B-620.
 *
 * ── Por qué no todas ──────────────────────────────────────────────────────
 * «Aprovechar el ancho» no es una mejora universal: un formulario de 30+ campos
 * a 1900px es **peor** que a 900, porque la etiqueta de un campo y su error
 * quedan a treinta centímetros del ojo y el renglón de texto largo pasa el
 * límite de lectura. Lo que gana con el ancho es lo que se recorre de un
 * barrido: una grilla de tarjetas donde entran doce en lugar de tres.
 *
 * Así que el ancho es **por vista** y la lista es explícita. Las exclusiones y
 * su motivo:
 *
 * | Vista | Ancho | Por qué |
 * |---|---|---|
 * | `lista` | todo | es la grilla de tarjetas de B-620: lo que el ancho compra son columnas |
 * | `nueva` / `editar` / `duplicar` | lectura | el formulario del §11; a 1900px la etiqueta y el error se separan del campo |
 * | `historial` | lectura | dos versiones enfrentadas, o sea texto: es el caso donde el renglón largo cansa |
 * | `reportes` | lectura | un formulario y una lista corta |
 * | `taxonomias` | lectura | filas de dos campos: el ancho extra queda vacío |
 * | `calendario` | lectura | la grilla del mes **sí** ganaría, y queda anotado; ensancharla es un cambio visual propio y no entra en este frente |
 * | `estadisticas` | lectura | ídem, y además se está rehaciendo en paralelo |
 *
 * ── Por qué es un módulo y no un `vista.tipo === 'lista'` en `AdminApp` ───
 * Por el mismo motivo que `salida-del-panel.ts`, que es el precedente exacto: la
 * decisión es pura y se testea sin DOM, mientras el `className` es maquetación.
 * Y sobre todo porque es **una lista que envejece sola**: la vista que se agregue
 * mañana no aparece acá, arranca angosta —el default prudente— y quien la escriba
 * decide en una línea. Un `===` suelto en el JSX no le pregunta nada a nadie.
 */

/**
 * Las vistas del router que se pintan a todo ancho.
 *
 * Es una lista y no un booleano en cada vista porque el default tiene que ser
 * «angosta»: agregar una pantalla y olvidarse de esto la deja como está hoy, que
 * es el lado barato de equivocarse (mismo criterio que D-41).
 */
export const VISTAS_A_TODO_ANCHO = ['lista'] as const;

export type VistaATodoAncho = (typeof VISTAS_A_TODO_ANCHO)[number];

export const ocupaTodoElAncho = (tipoDeVista: string): boolean =>
  (VISTAS_A_TODO_ANCHO as readonly string[]).includes(tipoDeVista);
