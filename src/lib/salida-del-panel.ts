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

/**
 * Las vistas del router que tienen un formulario adentro.
 *
 * `'convertir'` entra con B-830 y es la que más caro sale olvidar: lo que hay
 * adentro salió de una propuesta que **no se puede volver a abrir igual** —la
 * conversión genera encuentros nuevos cada vez— así que abandonarla sin aviso no
 * pierde treinta campos tipeados, pierde media hora de correcciones sobre lo que
 * escribió otra persona.
 */
/*
 * `'libreria'` entra con B-901 y es la primera vista con formulario que no carga
 * una actividad. Lo que se pierde al abandonarla es menos que en las otras cuatro
 * —doce campos, no treinta— pero la mitad cara es la misma: la galería, que puede
 * llevar cuatro fotos subidas a mano, y esas no se recuperan tecleando de nuevo.
 */
export const VISTAS_CON_FORMULARIO = [
  'nueva',
  'editar',
  'duplicar',
  'convertir',
  'libreria',
  /*
   * `'suscripcion'` entra con B-832. Lo que se pierde al abandonarla es **más**
   * que en una librería: el formulario tiene el doble de campos, y la mitad cara
   * sigue siendo la misma —la galería, que puede llevar cuatro fotos subidas a
   * mano, y ésas no se recuperan tecleando de nuevo—.
   */
  'suscripcion',
  /*
   * `'lugar'` entra con B-833. Lo que se pierde al abandonarlo es lo mismo que en
   * los otros dos —la galería, que puede llevar cuatro fotos subidas a mano, y
   * ésas no se recuperan tecleando de nuevo— más algo propio: la decisión sobre
   * `direccionPublica`, que es la que hay que volver a tomar a conciencia y no
   * la que conviene que se pierda a mitad de camino.
   */
  'lugar',
] as const;

export type VistaConFormulario = (typeof VISTAS_CON_FORMULARIO)[number];

export const tieneFormulario = (tipoDeVista: string): boolean =>
  (VISTAS_CON_FORMULARIO as readonly string[]).includes(tipoDeVista);

/**
 * El texto del `confirm()`. Dice qué se pierde y no solo que hay cambios: la
 * pregunta se contesta en dos segundos y sin contexto.
 */
export const AVISO_CAMBIOS_SIN_GUARDAR =
  'El formulario tiene cambios sin guardar. Si salís ahora se pierden. ¿Salir igual?';

/**
 * ¿Preguntar antes de dejar esta vista?
 *
 * Se llama en el momento del click, no en un `useEffect`: así lee el estado del
 * store tal cual está al salir, sin depender de que un render intermedio haya
 * ocurrido.
 */
export const debeConfirmarSalida = (tipoDeVista: string, hayCambiosSinGuardar: boolean): boolean =>
  tieneFormulario(tipoDeVista) && hayCambiosSinGuardar;
