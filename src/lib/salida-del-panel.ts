/**
 * B-35 — ¿hay que preguntar antes de abandonar lo que está a medio cargar?
 *
 * El store de `formulario-sucio.ts` ya sabía que había cambios pendientes, y lo
 * usaba el aviso de versión nueva para no recargar la pestaña por atrás. Lo que
 * faltaba era el otro lado: **las salidas que dispara la propia persona**. Tocar
 * "Volver", "Calendario", "Reportar algo", "Salir" o cerrar la pestaña
 * descartaba los 30+ campos del §11 sin decir nada.
 *
 * La decisión vive acá y no en `AdminApp` por el patrón de
 * `docs/05-patrones.md`: el `confirm()` y el `beforeunload` son
 * infraestructura del navegador, la regla es pura y se testea sin DOM.
 *
 * **Por qué la vista entra en la decisión y no solo el store.** El store se
 * apaga en el cleanup del formulario, así que en régimen alcanza con él. Pero si
 * alguna vez queda encendido por un camino que nadie previó —un formulario que
 * se desmonta sin pasar por su cleanup—, la consecuencia sin este chequeo es que
 * **todos** los botones del panel empiezan a pedir confirmación, incluso en el
 * listado, donde no hay nada que perder. Un aviso que aparece cuando no hay nada
 * en juego se aprende a ignorar, y entonces también se ignora el que sí importa.
 */

/** Las vistas del router que tienen un formulario adentro. */
export const VISTAS_CON_FORMULARIO = ['nueva', 'editar', 'duplicar'] as const;

export type VistaConFormulario = (typeof VISTAS_CON_FORMULARIO)[number];

export const tieneFormulario = (tipoDeVista: string): boolean =>
  (VISTAS_CON_FORMULARIO as readonly string[]).includes(tipoDeVista);

/**
 * El texto del `confirm()`. Dice qué se pierde y no solo que hay cambios: la
 * pregunta se contesta en dos segundos y sin contexto.
 */
export const AVISO_CAMBIOS_SIN_GUARDAR =
  'La actividad tiene cambios sin guardar. Si salís ahora se pierden. ¿Salir igual?';

/**
 * ¿Preguntar antes de dejar esta vista?
 *
 * Se llama en el momento del click, no en un `useEffect`: así lee el estado del
 * store tal cual está al salir, sin depender de que un render intermedio haya
 * ocurrido.
 */
export const debeConfirmarSalida = (tipoDeVista: string, hayCambiosSinGuardar: boolean): boolean =>
  tieneFormulario(tipoDeVista) && hayCambiosSinGuardar;
