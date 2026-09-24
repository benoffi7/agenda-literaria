/**
 * **¿Este evento abre el enlace?** — B-1501.
 *
 * Los eventos propios que miden «se tocó este enlace» (`clic_triptico`,
 * `clic_banner_ciudad`, `clic_inscripcion`) se emitían solo en `click`, y el
 * clic con la rueda del mouse —el que abre en una pestaña nueva, un uso real en
 * el tríptico de la home— dispara `auxclick` y no `click`. Este módulo es el
 * criterio único para los tres, así que dos eventos hermanos no pueden medir
 * con reglas distintas:
 *
 * - **`click` con el botón principal (0).** Incluye Enter sobre el enlace y el
 *   ctrl/cmd-clic: los dos llegan como `click` con `button === 0`.
 * - **`auxclick` con el botón del medio (1).** El derecho también dispara
 *   `auxclick` (con `button === 2`) y **no se cuenta**: abre un menú, no el
 *   enlace, y quien después elige «abrir en pestaña nueva» ahí no avisa a la
 *   página. Los botones de atrás/adelante (3, 4) tampoco.
 *
 * **Sin contar dos veces.** Los navegadores actuales no disparan `click` para el
 * botón del medio; alguno viejo sí lo hacía, y por eso `click` exige
 * `button === 0` en vez de aceptar cualquiera: si un mismo gesto trajera los dos
 * eventos, solo el `auxclick` pasa.
 *
 * Es puro y sin dependencias a propósito: lo importan el script liso de la
 * página de detalle y dos componentes de React, y ninguno tiene que arrastrar
 * nada por esto.
 */

/** Lo único que se mira del evento: sirve igual el nativo y el de React. */
export interface EventoDeClic {
  type: string;
  button: number;
}

export const BOTON_PRINCIPAL = 0;
export const BOTON_DEL_MEDIO = 1;

export const abreElEnlace = ({ type, button }: EventoDeClic): boolean =>
  type === 'click'
    ? button === BOTON_PRINCIPAL
    : type === 'auxclick' && button === BOTON_DEL_MEDIO;

/**
 * Las dos props de un `<a>` de React que miden su apertura con el criterio de
 * arriba. Se esparcen: `<a {...alAbrirEnlace(() => medir())}>`.
 */
export const alAbrirEnlace = (alAbrir: () => void) => {
  const manejar = (evento: EventoDeClic) => {
    if (abreElEnlace(evento)) alAbrir();
  };
  return { onClick: manejar, onAuxClick: manejar };
};
