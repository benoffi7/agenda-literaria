/**
 * **El rebuild cuando cambia una ficha de directorio** — B-901 / B-832, trampa 8.
 *
 * Es literalmente el mismo caso que `opciones-trigger.js` («el rebuild debe
 * dispararse también cuando cambia `/opciones/*`», §4.4) con otras colecciones: el
 * sitio es estático, así que una librería publicada no existe hasta que el build
 * vuelva a correr. Sin esto, se publica una ficha desde el panel y el sitio no la
 * muestra **nunca** —hasta que alguien edite cualquier actividad por otro
 * motivo—, y nada falla.
 *
 * La decisión de **si corresponde** es pura y vive en `directorios.js`. Acá está
 * el pegamento, que es todo lo que este archivo tiene que ser.
 *
 * ── Una Function por colección, y no un `{coleccion}` genérico ───────────
 * Firestore no matchea un comodín en el segmento de colección: el patrón
 * `{coleccion}/{id}` no existe. Así que la tajada 4 declara la suya leyendo
 * `COLECCIONES_DE_DIRECTORIO`, que es lo que hace que agregar un directorio sin su
 * rebuild se vea en el diff de `index.js`.
 *
 * ── Y los dos cuerpos son casi iguales **a propósito** ───────────────────
 * La tentación al escribir el segundo fue extraer un `rebuildDeDirectorio(event,
 * coleccion)` compartido y dejar los dos handlers en una línea. **No se hizo, y
 * el motivo es una red:** el chequeo de la clase de B-83
 * (`tests/clases-de-bug.test.ts`) es **textual sobre el cuerpo de cada trigger** —
 * busca la llamada a `marcarRebuild` ahí adentro y verifica que ninguna salida
 * temprana la preceda—. Con el cuerpo mudado a un helper, los dos triggers dejan
 * de contener esa llamada y el chequeo **deja de mirarlos sin ponerse rojo**: la
 * suite quedaría verde afirmando algo que ya no verifica, que es exactamente la
 * clase de falso verde que este repo persigue. Quince líneas repetidas a cambio de
 * que la red siga puesta es un buen precio; lo que sí está compartido es la
 * decisión, que es lo que importa que no se duplique (`cambioAmeritaRebuild`).
 *
 * ── B-905: estos triggers también prenden `publicadaAlgunaVez` ───────────
 * La marca de «estuvo publicada alguna vez» la declaraban los cuatro tipos y la
 * respetaban las cuatro reglas (`slugDe*Congelado`), pero no la escribía nadie:
 * publicar → despublicar → renombrar → volver a publicar reabría la URL
 * (trampa 10). La escriben estos cuatro handlers, **y no cuatro Functions
 * nuevas** (D-910):
 *
 *  - es el patrón de B-285, que la puso adentro de `syncCalendar` —el trigger
 *    que ya existía sobre `actividades/{id}`— y no en uno propio;
 *  - dos `onDocumentWritten` sobre el mismo path son dos handlers del mismo
 *    evento (B-89), y cada escritura de una ficha costaría dos invocaciones;
 *  - y la guarda del rebuild ya sabe que este write-back no cuenta:
 *    `publicadaAlgunaVez` no está en `CAMPOS_PUBLICOS_POR_DIRECTORIO`.
 *
 * La decisión es `faltaMarcarPublicada` y el efecto `marcarPublicada`, **los
 * mismos** que usa `syncCalendar`: una sola implementación para las cinco
 * colecciones. Y el bloque se repite en los cuatro cuerpos por el mismo motivo
 * que el rebuild: `marcarPublicada` está en `EFECTOS_INCONDICIONALES`, y el
 * chequeo de B-83 es textual sobre cada cuerpo.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { OPCIONES_BASE } from './despliegue.js';
import { cambioAmeritaRebuild } from './directorios.js';
import { faltaMarcarPublicada } from './historial.js';
import { marcarPublicada } from './marca-de-publicada.js';
import { marcarRebuild } from './marca-de-rebuild.js';

export const rebuildPorLibrerias = onDocumentWritten(
  {
    // Explícitas y no heredadas del `setGlobalOptions` de `index.js` — D-35,
    // mismo comentario que el resto de los triggers.
    ...OPCIONES_BASE,
    document: 'librerias/{id}',
  },
  async (event) => {
    const antes = event.data?.before?.data() ?? null;
    const despues = event.data?.after?.data() ?? null;
    const { id } = event.params;

    /*
     * ── B-905 · la marca de «estuvo publicada alguna vez» ────────────────
     * Va primero y afuera de todo condicional del rebuild, por el mismo motivo
     * que en `syncCalendar`: corresponde porque la ficha **pasó a publicada**, no
     * porque el sitio tenga algo que rehacer. `marcarPublicada` está en
     * `EFECTOS_INCONDICIONALES` y ningún corte puede precederla.
     *
     * **La guarda anti-loop es `faltaMarcarPublicada`** (trampa 3): el `update`
     * vuelve a disparar este mismo handler, y en esa segunda pasada la marca ya
     * está en `true`, así que no se escribe de nuevo. La otra mitad es que la
     * marca no está en `CAMPOS_PUBLICOS_POR_DIRECTORIO`: esa segunda pasada
     * tampoco rebuildea.
     *
     * Si falla —la ficha se borró entre el evento y el `update`, por ejemplo—
     * se loguea y el rebuild sigue: la marca es para el próximo intento de
     * renombrar, el sitio es de ahora. Y la próxima escritura de una ficha
     * publicada la vuelve a intentar, porque la decisión se toma sobre el
     * documento y no sobre la transición.
     */
    if (faltaMarcarPublicada(despues, antes)) {
      try {
        await marcarPublicada(getFirestore(), id, 'librerias');
        logger.info('ficha marcada como publicada alguna vez', { id, coleccion: 'librerias' });
      } catch (e) {
        logger.warn('no se pudo marcar la ficha como publicada', {
          id,
          coleccion: 'librerias',
          error: e?.message,
        });
      }
    }

    /*
     * ── La guarda va en forma POSITIVA, y no es estilo ───────────────────
     * `marcarRebuild` está declarada en `EFECTOS_INCONDICIONALES`
     * (`tests/clases-de-bug.test.ts`), y la clase de B-83 exige que su llamada
     * **domine** todos los cortes del handler: un efecto que corresponde por lo
     * que cambió no puede colgar de lo que el efecto de al lado haya conseguido
     * hacer. El chequeo es **textual** y mira todo lo que precede a la llamada,
     * comentarios incluidos —por eso esta prosa no nombra la palabra clave en
     * inglés, que es la misma rugosidad que `calendario-trigger.js` ya tiene
     * anotada—.
     *
     * Escribirlo al revés (cortar temprano cuando no corresponde) es lógicamente
     * idéntico y **rompe el chequeo**, que fue exactamente lo que los dos
     * auditores encontraron sobre la primera versión de este archivo. Así que va
     * como sus dos hermanos: `syncCalendar` con `huboCambioDeContenido` y
     * `rebuildPorOpciones`. Que las tres se lean igual es lo que hace que la
     * tajada 4 copie la forma correcta.
     *
     * La guarda no puede faltar: la marca `publicadaAlgunaVez` (el bloque de
     * arriba, B-905) es un write-back sobre este mismo documento que vuelve a
     * disparar este handler, y sin ella cada publicación costaría **dos**
     * builds; además
     * rearma el contador de reintentos (`CAMPOS_REARME`, D-23). Corregir el
     * contacto interno, que no sale al sitio, tampoco tiene por qué costar uno.
     *
     * El motivo lleva **solo el id**: el nombre y la dirección son contenido, y
     * el contacto de quien cargó la ficha es de un tercero (§9 y la fila de
     * `07-seguridad.md`). Misma forma que `actividad <id>`.
     */
    if (cambioAmeritaRebuild(antes, despues, 'librerias')) {
      await marcarRebuild(getFirestore(), `libreria ${id}`);
    } else {
      logger.debug('cambio de librería sin efecto en el sitio: no se rebuildea', { id });
    }
  },
);

export const rebuildPorSuscripciones = onDocumentWritten(
  {
    ...OPCIONES_BASE,
    document: 'suscripciones/{id}',
  },
  async (event) => {
    const antes = event.data?.before?.data() ?? null;
    const despues = event.data?.after?.data() ?? null;
    const { id } = event.params;

    // B-905 — la marca, con la misma guarda y en el mismo lugar que en
    // `rebuildPorLibrerias` (ver ahí el detalle).
    if (faltaMarcarPublicada(despues, antes)) {
      try {
        await marcarPublicada(getFirestore(), id, 'suscripciones');
        logger.info('ficha marcada como publicada alguna vez', { id, coleccion: 'suscripciones' });
      } catch (e) {
        logger.warn('no se pudo marcar la ficha como publicada', {
          id,
          coleccion: 'suscripciones',
          error: e?.message,
        });
      }
    }

    /*
     * La misma guarda, en la misma forma positiva y por el mismo motivo que la
     * de arriba (ver ahí el detalle de la clase de B-83).
     *
     * Lo propio de esta colección: acá el sitio publica además un **precio que
     * envejece** (DEC-12), así que un cambio que no dispare el build no deja el
     * sitio «viejo» sino **mintiendo** — el número anterior sigue publicado con su
     * fecha anterior al lado, que es la afirmación que el mecanismo de B-837
     * existe para no hacer. La lista de campos que se comparan la elige
     * `cambioAmeritaRebuild` con el nombre de la colección, y `precio` está
     * adentro.
     *
     * El motivo lleva **solo el id**: el nombre, el precio y el link de cobro son
     * contenido, y el contacto de quien cargó la ficha es de un tercero.
     */
    if (cambioAmeritaRebuild(antes, despues, 'suscripciones')) {
      await marcarRebuild(getFirestore(), `suscripcion ${id}`);
    } else {
      logger.debug('cambio de suscripción sin efecto en el sitio: no se rebuildea', { id });
    }
  },
);

export const rebuildPorLugares = onDocumentWritten(
  {
    ...OPCIONES_BASE,
    document: 'lugares/{id}',
  },
  async (event) => {
    const antes = event.data?.before?.data() ?? null;
    const despues = event.data?.after?.data() ?? null;
    const { id } = event.params;

    // B-905 — la marca, con la misma guarda y en el mismo lugar que en
    // `rebuildPorLibrerias` (ver ahí el detalle).
    if (faltaMarcarPublicada(despues, antes)) {
      try {
        await marcarPublicada(getFirestore(), id, 'lugares');
        logger.info('ficha marcada como publicada alguna vez', { id, coleccion: 'lugares' });
      } catch (e) {
        logger.warn('no se pudo marcar la ficha como publicada', {
          id,
          coleccion: 'lugares',
          error: e?.message,
        });
      }
    }

    /*
     * La misma guarda, en la misma forma positiva y por el mismo motivo que las
     * dos de arriba (ver el detalle de la clase de B-83 en la primera).
     *
     * Lo propio de esta colección, y es lo más caro que depende de este trigger
     * en todo el proyecto: acá el sitio publica **una dirección que puede ser la
     * de la casa de una persona**, y lo que decide si sale es un booleano del
     * documento (`direccionPublica`, § 6 del PRD 4). Ese campo está en la lista
     * de `cambioAmeritaRebuild`, así que apagarlo dispara el build; sin este
     * trigger —o sin ese campo en la lista— alguien apaga la casilla en el panel,
     * el sitio no se rehace y **la dirección sigue publicada**. La trampa 8 con el
     * dato más sensible del proyecto adentro.
     *
     * El motivo lleva **solo el id**: el nombre, la dirección y el precio son
     * contenido, y el contacto de quien cargó la ficha es de un tercero.
     */
    if (cambioAmeritaRebuild(antes, despues, 'lugares')) {
      await marcarRebuild(getFirestore(), `lugar ${id}`);
    } else {
      logger.debug('cambio de lugar sin efecto en el sitio: no se rebuildea', { id });
    }
  },
);

export const rebuildPorBibliotecas = onDocumentWritten(
  {
    ...OPCIONES_BASE,
    document: 'bibliotecas/{id}',
  },
  async (event) => {
    const antes = event.data?.before?.data() ?? null;
    const despues = event.data?.after?.data() ?? null;
    const { id } = event.params;

    // B-905 — la marca, con la misma guarda y en el mismo lugar que en
    // `rebuildPorLibrerias` (ver ahí el detalle).
    if (faltaMarcarPublicada(despues, antes)) {
      try {
        await marcarPublicada(getFirestore(), id, 'bibliotecas');
        logger.info('ficha marcada como publicada alguna vez', { id, coleccion: 'bibliotecas' });
      } catch (e) {
        logger.warn('no se pudo marcar la ficha como publicada', {
          id,
          coleccion: 'bibliotecas',
          error: e?.message,
        });
      }
    }

    /*
     * La misma guarda, en la misma forma positiva y por el mismo motivo que las
     * tres de arriba (ver el detalle de la clase de B-83 en la primera).
     *
     * Lo propio de esta colección es **el costo de asociarse**: se publica con su
     * fecha de carga al lado (DEC-12), así que cambiar el número tiene que
     * rehacer la ficha o el sitio queda mostrando el monto viejo con una fecha
     * que ya no le corresponde — que es peor que no mostrarlo, porque parece
     * fresco. `asociarse` está entero en `cambioAmeritaRebuild`, así que tanto el
     * flag como el costo lo disparan.
     *
     * El motivo lleva **solo el id**: el nombre y la dirección son contenido, y
     * el contacto de quien cargó la ficha es de un tercero.
     */
    if (cambioAmeritaRebuild(antes, despues, 'bibliotecas')) {
      await marcarRebuild(getFirestore(), `biblioteca ${id}`);
    } else {
      logger.debug('cambio de biblioteca sin efecto en el sitio: no se rebuildea', { id });
    }
  },
);
