/**
 * **Rechazar una propuesta borra su imagen en el acto** — B-830 paso 8, DEC-11.
 *
 * El dueño lo pidió con estas palabras: «si el evento lo descartamos se tiene
 * que borrar». Y **no espera al barrido**: la retención de 30 días (B-838) es
 * para el documento —que queda como prueba de qué se pidió, y para poder
 * reabrirlo—, pero la foto de una persona que ya sabemos que no vamos a usar no
 * tiene por qué quedarse un mes más. El barrido de huérfanas de B-221 queda como
 * **red**, no como mecanismo: si fuera lo único que borra, la imagen viviría
 * hasta que ese barrido corra… y encima no la vería, porque solo recorre
 * `imagenes/` y `miniaturas/`.
 *
 * **Todo lo de acá es puro.** El pegamento vive en `propuestas-trigger.js`.
 *
 * ── Por qué esto no es la trampa 3 ni la 12 ───────────────────────────────
 * El trigger escucha `propuestas/{id}` en **Firestore** y lo único que hace es
 * borrar un objeto en **Storage**. No escribe el documento que lo disparó —ni
 * para marcar que borró la imagen, y eso es deliberado: el documento es prueba de
 * qué se pidió, y un write-back además volvería a dispararlo—. Del lado de
 * Storage, un `delete()` emite `onObjectDeleted`, al que nada de este proyecto
 * está suscripto (`optimizarImagen` es `onObjectFinalized`). Sin un trigger del
 * otro lado, no hay con qué encadenarse.
 *
 * ── Y la consecuencia que hay que decir, porque la bandeja ofrece reabrir ──
 * Reabrir una propuesta rechazada **no trae la foto de vuelta**. El documento
 * sigue nombrando su `storagePath` y el objeto ya no está. Está dicho en la
 * ayuda del panel y en la pantalla, porque es la clase de cosa que se descubre
 * tarde.
 *
 * Está probado en `tests/propuestas-imagen.test.ts`.
 */
import { objetoDePropuesta } from './retencion.js';

/**
 * ¿Hay que borrar la imagen de esta propuesta?
 *
 * @param {{ before?: Record<string, unknown> | null, after?: Record<string, unknown> | null }} _
 * @returns {{ accion: 'borrar' | 'ignorar', objeto: string | null, motivo: string }}
 */
export const decidirBorradoDeImagen = ({ before = null, after = null } = {}) => {
  const nada = (motivo) => ({ accion: 'ignorar', objeto: null, motivo });

  /*
   * **El borrado del documento no dispara este borrado**, y no es un olvido: el
   * único que borra documentos de `/propuestas` es la retención, que borra el
   * objeto ella misma y en el orden correcto (objeto primero). Actuar acá
   * también sería un segundo borrado en carrera con aquel, que es el error que
   * B-89 documenta para los triggers del mismo evento.
   */
  if (!after) return nada('propuesta-borrada');

  if (after.estado !== 'rechazada') return nada(`estado-${after.estado}`);

  /*
   * **Solo la transición**, no el estado. Sin esto, cualquier escritura sobre una
   * propuesta que ya está rechazada volvería a intentar el borrado: hoy sería
   * inofensivo (`ignoreNotFound`) y sería igual una llamada a Storage por cada
   * escritura. La transición es la que significa «se acaba de descartar».
   */
  if (before?.estado === 'rechazada') return nada('ya-estaba-rechazada');

  /*
   * La misma guarda de prefijo que la retención, **importada y no copiada**: dos
   * versiones de «qué objeto es nuestro» divergen y una queda vieja (B-88). Y
   * acá aplica por el mismo motivo que allá — este trigger corre con el Admin
   * SDK, así que el `matches('^propuestas/…')` de `firestore.rules` no lo
   * protege: un documento que nombrara el flyer de una actividad publicada haría
   * que rechazar una propuesta se lo llevara del sitio, en vivo.
   */
  const objeto = objetoDePropuesta(after.imagen);
  if (!objeto) {
    return after?.imagen?.storagePath
      ? nada('imagen-fuera-del-prefijo')
      : nada('sin-imagen-propia');
  }

  return { accion: 'borrar', objeto, motivo: 'rechazada' };
};
