/**
 * **Un barrido programado que falla entero avisa** — B-2195.
 *
 * Los barridos diarios (la retención de propuestas y de fichas, las imágenes
 * huérfanas, las versiones huérfanas) atrapan el fallo de **cada objeto** y lo
 * dejan para la corrida de mañana, sin `alerta`: avisar por cada uno sería ruido
 * diario, y se reintenta solo. Lo que no tenía aviso es lo otro: que el barrido
 * **entero** falle —la consulta inicial, un permiso, un timeout del código— y que
 * eso se repita cada día sin que nadie se entere. La retención de 30 días de los
 * contactos (DEC-13) es una promesa de privacidad, y un barrido que no corre es
 * un dato personal que se queda de más.
 *
 * Se re-lanza después de loguear: la corrida tiene que seguir figurando como
 * fallida en la consola.
 *
 * Recibe el `logger` y no lo importa: así es puro y los tests lo importan sin
 * arrastrar `firebase-functions` (B-561).
 */

/**
 * @param {{ error: (mensaje: string, datos: object) => void }} logger
 * @param {string} barrido el nombre de la Function, para el log
 * @param {() => Promise<unknown>} cuerpo
 * @returns {() => Promise<unknown>}
 */
export const conAlertaDeBarrido = (logger, barrido, cuerpo) => async () => {
  try {
    return await cuerpo();
  } catch (e) {
    logger.error('falló un barrido programado entero', {
      alerta: 'barrido-fallo',
      barrido,
      error: e?.message,
    });
    throw e;
  }
};
