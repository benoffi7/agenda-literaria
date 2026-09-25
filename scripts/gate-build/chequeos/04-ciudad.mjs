/**
 * B-969: la quinta clase de hub y el «Dónde» de una sede de afuera.
 */
import {
  CIUDAD_DEL_GATE,
  ETIQUETA_CIUDAD_DEL_GATE,
  ETIQUETA_PROVINCIA_DEL_GATE,
  SLUG_AFUERA,
} from '../semilla.mjs';

export const nombre = "el hub de ciudad y el renglón de afuera de CABA";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, htmlDe, leer: leerDist } = ctx;
  /*
   * **B-969 — la quinta clase de hub y el renglón de afuera, en el HTML de
   * verdad.**
   *
   * Las dos cosas que ningún unitario puede mirar: que Astro **escriba** la
   * página (`caminosDeCiudad` devuelve rutas, Astro las convierte en archivos)
   * y que la plantilla la pinte. Es el mismo argumento con el que el gate mira
   * la página de una cancelada.
   */
  /**
   * El `<h1>` de una página, y **por qué el aserto se recorta** — lo cobró el
   * `auditor-privacidad` sobre B-969.
   *
   * Buscar la etiqueta en el HTML entero pasaba por el motivo equivocado: la
   * página del hub pinta además la **tarjeta** de la actividad, y
   * `lugarDeTarjeta` resuelve la ciudad a su etiqueta desde B-950. O sea que si
   * mañana el `<h1>` emitiera el slug crudo —justo la trampa 10 que el mensaje
   * nombra— el aserto seguía verde por la tarjeta.
   */
  const encabezadoDe = (html) => {
    const fin = html.indexOf('</h1>');
    return fin === -1 ? '' : html.slice(0, fin);
  };

  const htmlHubDeCiudad = await leerDist(`ciudad/${CIUDAD_DEL_GATE}/index.html`);
  if (htmlHubDeCiudad === null) {
    fallo(
      `no se generó dist/ciudad/${CIUDAD_DEL_GATE}/index.html.\n` +
        '  Es la quinta clase de hub (B-951). Se emite para las opciones **aprobadas**\n' +
        '  de /opciones/ciudad que tengan alguna actividad publicada: si falta, o el\n' +
        '  hub dejó de emitirse, o la siembra de la opción no quedó aprobada.',
    );
  } else if (!encabezadoDe(htmlHubDeCiudad).includes(ETIQUETA_CIUDAD_DEL_GATE)) {
    fallo(
      `el hub /ciudad/${CIUDAD_DEL_GATE}/ no dice su etiqueta «${ETIQUETA_CIUDAD_DEL_GATE}» ` +
        'en el `<h1>`.\n' +
        '  El título de un hub lleva la etiqueta resuelta, nunca el slug (§4.1, trampa 10).',
    );
  }

  /*
   * Y el renglón «Dónde» de la ficha de afuera: la ciudad con su **etiqueta**
   * y la provincia detrás. Es la rama de `piezasDeLugar` que en CABA no corre,
   * y la que publicaba el slug crudo antes de B-950.
   */
  const htmlAfuera = await htmlDe(SLUG_AFUERA);
  if (htmlAfuera === null) {
    fallo(`no se generó dist/actividad/${SLUG_AFUERA}/index.html.`);
  } else {
    /*
     * **La etiqueta pegada a su `href`, y no suelta en el archivo** — lo cobró
     * el `auditor-privacidad` sobre B-969.
     *
     * Buscar «Ciudad del gate» en todo el HTML pasaba por el motivo
     * equivocado: el JSON-LD de la misma página emite `addressLocality` con la
     * etiqueta ya resuelta, así que si `piezasDeLugar` dejara de pintar el
     * renglón entero, el aserto seguía verde por el dato estructurado.
     *
     * Pedirlas juntas ata las **tres** afirmaciones a la pieza que las produce:
     * que el renglón existe, que enlaza al hub con el slug (trampa 10) y que lo
     * que se lee es la etiqueta.
     */
    const rutaDelHub = `/ciudad/${CIUDAD_DEL_GATE}/`;
    /*
     * El `<a …>` completo, con sus clases en el medio: se busca el `href` y se
     * exige que la etiqueta aparezca antes del cierre de esa etiqueta, no en
     * cualquier parte del archivo.
     */
    const desdeElHref = htmlAfuera.slice(htmlAfuera.indexOf(rutaDelHub));
    const anclaDeLaCiudad = desdeElHref.slice(0, desdeElHref.indexOf('</a>') + 4);
    if (!htmlAfuera.includes(rutaDelHub) || !anclaDeLaCiudad.includes(ETIQUETA_CIUDAD_DEL_GATE)) {
      fallo(
        `la ficha de ${SLUG_AFUERA} no tiene la ciudad enlazada a su hub.\n` +
          `  Se buscó la etiqueta «${ETIQUETA_CIUDAD_DEL_GATE}» adentro del <a> que apunta\n` +
          `  a ${rutaDelHub}: el «Dónde» de una sede de afuera de CABA dice la ciudad con su\n` +
          '  etiqueta y la enlaza al hub con su slug (B-951, D-710).\n' +
          '  Si el hub existe pero esto falla, mirá si `rutaDeZona` sigue resolviendo.',
      );
    }
    /*
     * La provincia, que **no** lleva enlace: no hay hub de provincia
     * (`CLASES_DE_TAXONOMIA`). Se busca en el mismo renglón —los 300 caracteres
     * que siguen a la pieza de la ciudad— y no en todo el archivo, porque
     * «Buenos Aires» es un literal genérico que mañana puede aparecer por otro
     * lado.
     */
    const desdeLaCiudad = desdeElHref.slice(0, 500);
    if (!desdeLaCiudad.includes(ETIQUETA_PROVINCIA_DEL_GATE)) {
      fallo(
        `la ficha de ${SLUG_AFUERA} no dice la provincia «${ETIQUETA_PROVINCIA_DEL_GATE}» ` +
          'al lado de la ciudad.',
      );
    }
  }
};
