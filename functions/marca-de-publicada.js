/**
 * B-285 — prender `publicadaAlgunaVez` en el documento, en su propio módulo.
 *
 * ── Por qué es un módulo y no tres líneas en el trigger ───────────────────
 * Dos razones, y la segunda es la que importa:
 *
 * 1. El corte puro/infra/trigger que pide `docs/05-patrones.md`: la **decisión**
 *    de si hay que marcar es pura y vive en `historial.js`
 *    (`faltaMarcarPublicada`); acá queda solo el efecto, con el `db` inyectado.
 * 2. **Es un efecto incondicional**, en el sentido exacto de la clase de B-83:
 *    corresponde porque la actividad **cambió de estado**, no porque el
 *    calendario haya recibido operaciones. `syncCalendar` tiene dos cortes
 *    tempranos abajo —sin operaciones, y sin `GOOGLE_CALENDAR_ID` configurado— y
 *    detrás de cualquiera de los dos la marca no se escribiría nunca. Ese chequeo
 *    (`tests/clases-de-bug.test.ts`, `EFECTOS_INCONDICIONALES`) recorre
 *    **llamadas a funciones nombradas**: con la escritura inline el trigger
 *    quedaba fuera de la red, y ese es justo el error que la red existe para
 *    atrapar.
 *
 * Recibe el `db` como `marcarRebuild`, así que no importa `firebase-admin`.
 */
import { MARCA_DE_PUBLICADA } from './historial.js';

/**
 * Prende la marca. **Solo se llama cuando `faltaMarcarPublicada` dice que sí**,
 * que es la mitad de la guarda anti-loop (trampa 3): la escritura vuelve a
 * disparar el trigger y en la segunda pasada la marca ya está, así que no se
 * escribe de nuevo. La otra mitad es que `MARCA_DE_PUBLICADA` esté en
 * `CAMPOS_DE_MAQUINA`, para que este write-back no cuente como cambio de
 * contenido — si no, cada publicación costaría una versión de historial y un
 * rebuild del sitio de más.
 *
 * **`update` y no `set`:** si el documento se borró entre el evento y este punto,
 * un `set` lo resucitaría con un solo campo. Que falle es el comportamiento
 * correcto; quien llama decide qué hacer con el error, y en el sync la respuesta
 * es loguear y seguir — la marca es para el build de mañana, los eventos del
 * calendario son de ahora.
 *
 * Nunca escribe `false`: el campo es pegajoso y no hay rama que lo apague.
 * Despublicar no des-indexa la URL que estuvo tres semanas en Instagram, así que
 * la pregunta que este campo contesta no tiene vuelta atrás.
 */
export const marcarPublicada = (db, id) =>
  db.doc(`actividades/${id}`).update({ [MARCA_DE_PUBLICADA]: true });
