/**
 * **Las pestañas del formulario de carga**, y de dónde sale cada una.
 *
 * Pedido del dueño el 2026-09-07: «¿podemos hacer un rediseño del formulario en
 * la carga? Quedó muy largo. Que sean tabs y con la barra de guardar siempre
 * visible como ahora». Y con la agrupación elegida por él: **una pestaña por
 * sección**, con los nombres de hoy.
 *
 * ── Se derivan de `SECCIONES`, no se escriben a mano ──────────────────────
 * El registro de secciones ya existe —`camposFaltantes.ts`, con el `id`, el
 * título y el ancla de cada una— y es el que la barra usa para decir «Falta
 * completar: Dónde (2)». Escribir una segunda lista de nueve nombres al lado
 * garantizaba el bug de siempre: la sección que se agregue mañana entra en el
 * registro, la barra la nombra, **y no tiene pestaña donde vivir**.
 *
 * Así que el default es **una pestaña por sección, en el orden del registro**, y
 * lo único escrito a mano son las excepciones (`JUNTAS`). Una sección nueva
 * aparece sola como pestaña propia; si tiene que compartir, se declara acá y se
 * ve en el diff.
 *
 * `tests/pestanias-del-formulario.test.ts` cierra la puerta: exige que las
 * pestañas **partan** el registro —cada sección en exactamente una— así que ni
 * una sección huérfana ni una declarada dos veces pasan.
 *
 * ── Lo que las pestañas NO cambian ────────────────────────────────────────
 * Tres cosas se conservan enteras, y las tres son de decisiones escritas:
 *
 * - **la barra de acciones sigue fija abajo** (pedido explícito: «como ahora»);
 * - **el enlace de la barra sigue llevando al campo** (B-184). Ahora tiene que
 *   hacer una cosa más —cambiar de pestaña— y ese es el riesgo entero de este
 *   rediseño: un campo que falta para publicar y vive en otra pestaña **no está
 *   en la pantalla**, que es exactamente el problema que B-184 vino a resolver
 *   cuando el campo estaba dentro de un acordeón cerrado. De ahí `pestaniaDe` y
 *   el contador por pestaña de `faltantesPorPestania`;
 * - **los acordeones de adentro siguen existiendo** (B-193, y su memoria): una
 *   pestaña puede tener más de una sección, y «Material» sigue arrancando
 *   cerrada si no es un club.
 */
import { SECCIONES, type IdSeccion } from '@/lib/formulario/camposFaltantes';
import type { ResumenFaltantes } from '@/lib/formulario/camposFaltantes';

/**
 * Las secciones que **no** son su propia pestaña, con la pestaña a la que van.
 *
 * Una sola entrada, y con motivo: «Texto para publicar» y «Vista previa del
 * evento» son las dos «cómo se ve esto afuera» —una para Instagram, la otra para
 * el calendario de quien se suscribió— y ninguna tiene campos que se carguen.
 * Dos pestañas para mirar lo mismo son dos clicks para comparar.
 *
 * El título de la pestaña se declara acá porque **no puede ser el de ninguna de
 * las dos secciones**: la que las junta no es «Texto para publicar» ni «Vista
 * previa del evento».
 */
const JUNTAS = {
  'vista-previa': { pestania: 'texto-redes', titulo: 'Vista previa' },
} as const satisfies Partial<Record<IdSeccion, { pestania: IdSeccion; titulo: string }>>;

/** El id de una pestaña es el id de su sección principal. */
export type IdPestania = IdSeccion;

export interface Pestania {
  id: IdPestania;
  /** Lo que se lee en la solapa. */
  titulo: string;
  /** Las secciones que se pintan adentro, en orden de pantalla. */
  secciones: readonly IdSeccion[];
}

/**
 * Las pestañas, en el orden del registro de secciones.
 *
 * Se arma en un paso: cada sección es una pestaña nueva salvo que `JUNTAS` la
 * mande a otra, y en ese caso se agrega al final de las secciones de aquélla.
 */
export const PESTANIAS: readonly Pestania[] = (() => {
  const armadas: { id: IdPestania; titulo: string; secciones: IdSeccion[] }[] = [];
  const porId = new Map<IdPestania, (typeof armadas)[number]>();

  for (const seccion of SECCIONES) {
    const junta = (JUNTAS as Partial<Record<IdSeccion, { pestania: IdSeccion; titulo: string }>>)[
      seccion.id
    ];
    if (junta) {
      const anfitriona = porId.get(junta.pestania);
      /*
       * Si la anfitriona todavía no existe, la declaración de `JUNTAS` está al
       * revés respecto del orden del registro. **Se cae acá y no se pinta una
       * pestaña de menos**: una sección sin pestaña es un campo que no se puede
       * completar, y eso no puede degradarse en silencio.
       */
      if (!anfitriona) {
        throw new Error(
          `«${seccion.id}» va a la pestaña «${junta.pestania}», que no está declarada antes en SECCIONES.`,
        );
      }
      anfitriona.secciones.push(seccion.id);
      // El título de la pestaña junta lo declara `JUNTAS`: ver su docblock.
      anfitriona.titulo = junta.titulo;
      continue;
    }
    const nueva = { id: seccion.id, titulo: seccion.titulo, secciones: [seccion.id] };
    armadas.push(nueva);
    porId.set(seccion.id, nueva);
  }

  return armadas;
})();

/** La primera, que es con la que abre el formulario. */
export const PRIMERA_PESTANIA: IdPestania = PESTANIAS[0]!.id;

/**
 * En qué pestaña vive una sección.
 *
 * Es lo que convierte «llevame al campo Título» en «cambiá a la pestaña Qué es y
 * después bajá hasta el campo». Devuelve `undefined` solo si le pasan un id que
 * no está en el registro, que el test de partición vuelve imposible para las
 * secciones de verdad.
 */
export const pestaniaDe = (seccion: IdSeccion): IdPestania | undefined =>
  PESTANIAS.find((p) => p.secciones.includes(seccion))?.id;

/**
 * Cuántos campos faltan en cada pestaña.
 *
 * **Es la mitad que hace que las pestañas no escondan nada.** Con todo apilado,
 * un campo pendiente se veía scrolleando; con pestañas, ocho de nueve están
 * fuera de la pantalla. El número en la solapa es lo que dice dónde mirar sin
 * abrirlas una por una.
 *
 * Suma las secciones de cada pestaña: la que junta dos muestra el total de las
 * dos, que es lo que corresponde a una solapa.
 */
export const faltantesPorPestania = (
  resumen: ResumenFaltantes,
): Readonly<Partial<Record<IdPestania, number>>> => {
  const cuenta: Partial<Record<IdPestania, number>> = {};
  for (const seccion of resumen.secciones) {
    const pestania = pestaniaDe(seccion.id);
    if (!pestania) continue;
    cuenta[pestania] = (cuenta[pestania] ?? 0) + seccion.cantidad;
  }
  return cuenta;
};
