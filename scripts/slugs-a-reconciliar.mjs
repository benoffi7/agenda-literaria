/**
 * **Qué hay que escribir y qué hay que borrar del índice `/slugs`** — la parte
 * que decide, sin red (B-888 tajada 2, D-660).
 *
 * ── Por qué vive en su propio archivo y no adentro del script ─────────────
 * Por lo mismo que `sin-comentarios.mjs` y `decisiones-referenciadas.mjs`:
 * `sembrar-slugs.mjs` **corre al importarse** —tiene su I/O en el cuerpo del
 * módulo, como todos los scripts de este repo—, así que un test que lo importara
 * le hablaría a Firestore. Se comprobó en el peor lugar posible: un
 * `node -e "import('./scripts/sembrar-slugs.mjs')"` al escribir esto se conectó a
 * **producción** y leyó las 255 actividades. Fue una lectura y nada más, pero la
 * lección es la del §"Lógica pura separada de la infraestructura": si la decisión
 * tiene que ser testeable, no puede compartir módulo con la conexión.
 *
 * ── Y por qué esta decisión necesitaba un test ────────────────────────────
 * **Acá estuvo el único bug que este script tuvo, y lo encontró correrlo contra
 * el emulador, no la lectura.** La primera versión separaba «la reserva que
 * falta» de «la reserva que apunta a otra actividad», y mandaba la segunda a la
 * lista de **borrar**: con `--reparar` se borraba, nadie la reponía en la misma
 * pasada, y la actividad quedaba **sin reserva** — o sea el estado que el script
 * existe para arreglar, producido por el script. Hacían falta dos corridas y nada
 * lo decía.
 */

/**
 * @param enElCatalogo `Map` slug → id de la actividad que lo usa hoy.
 * @param yaReservados `Map` slug → `actividadId` de la reserva que ya existe.
 * @returns `desalineados` (hay que escribirlos) y `huerfanas` (hay que borrarlas
 *   con `--reparar`), las dos como pares `[slug, id]`.
 */
export const aReconciliar = (enElCatalogo, yaReservados) => ({
  /*
   * Los slugs del catálogo cuya reserva **no apunta a la actividad que los usa**.
   * Son dos casos —la que falta y la que apunta a otra— y van juntos porque se
   * arreglan igual: escribiendo la reserva correcta, que con el Admin SDK pisa la
   * que hubiera. Separarlos es el bug de arriba.
   */
  desalineados: [...enElCatalogo].filter(([slug, id]) => yaReservados.get(slug) !== id),
  /*
   * Las reservas de un nombre que **ninguna actividad usa**. Ésas sí se borran, y
   * solo con `--reparar`: es la única dirección en la que el índice puede fallar
   * —un nombre tomado por nadie— y falla cerrada.
   */
  huerfanas: [...yaReservados].filter(([slug]) => !enElCatalogo.has(slug)),
});
