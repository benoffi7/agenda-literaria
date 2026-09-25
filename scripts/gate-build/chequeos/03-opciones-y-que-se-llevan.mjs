/**
 * Paso 4b del gate (B-181, B-830), sobre el HTML de la publicada.
 */
import {
  CENTINELA,
  ETIQUETA_DE_COMISION,
  ETIQUETA_DE_INCLUYE,
  SLUG_PUBLICADA,
} from '../semilla.mjs';

export const nombre = "el agrupado por opción y «Qué se llevan»";

/** @param {import('../contexto.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, htmlDe } = ctx;
  /*
   * 4b · B-181 — **el agrupado por opción, sobre el HTML de verdad.**
   *
   * Es la mitad que ningún test unitario puede mirar: `detallePublico.ts`
   * decide los grupos y los tiene barridos, pero que la plantilla los **pinte**
   * solo se ve en el archivo que sale (D-140, el mismo argumento del punto 4).
   */
  const htmlPublicadaGrupos = await htmlDe(SLUG_PUBLICADA);
  if (htmlPublicadaGrupos === null) {
    fallo(`no se generó dist/actividad/${SLUG_PUBLICADA}/index.html.`);
  } else {
    if (!htmlPublicadaGrupos.includes(ETIQUETA_DE_COMISION)) {
      fallo(
        'la página no muestra el encabezado de la opción para sumarse (B-181).\n' +
          '  El view-model la agrupa y la plantilla no la pinta: la lista de encuentros\n' +
          '  se lee como un ciclo largo, que es el malentendido que B-181 arregló.',
      );
    }
    /*
     * B-830 — «Qué se llevan», el mismo argumento: `detallePublico.ts` decide
     * qué etiquetas mostrar y **solo acá se ve si la sección se pinta**. Y en
     * las dos direcciones a la vez: la etiqueta tiene que aparecer y el slug
     * crudo (`CENTINELA.incluyeSlug`) lo barre el paso 9 con todo el resto.
     */
    if (!htmlPublicadaGrupos.includes(ETIQUETA_DE_INCLUYE)) {
      fallo(
        'la página no muestra «Qué se llevan» (B-830).\n' +
          '  El view-model trae las etiquetas y la plantilla no las pinta: es código\n' +
          '  muerto que ningún barrido detecta, la lección de B-341.',
      );
    }
    if (!htmlPublicadaGrupos.includes('Qué se llevan')) {
      fallo('la página no lleva el encabezado de la sección «Qué se llevan» (B-830).');
    }

    if (!htmlPublicadaGrupos.includes('Elegí tu opción')) {
      fallo(
        'la página no cambió el título de la sección de encuentros (B-181).\n' +
          '  Con opciones para sumarse tiene que decir «Elegí tu opción»: lo que sigue\n' +
          '  no es un programa, son programas paralelos y hay que elegir uno.',
      );
    }
  }
};
