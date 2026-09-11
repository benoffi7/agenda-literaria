/**
 * **El rebuild cuando cambia una ficha de directorio** — B-901, trampa 8.
 *
 * Es literalmente el mismo caso que `opciones-trigger.js` («el rebuild debe
 * dispararse también cuando cambia `/opciones/*`», §4.4) con otra colección: el
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
 * `{coleccion}/{id}` no existe. Así que las tajadas 3 y 4 declaran la suya
 * leyendo `COLECCIONES_DE_DIRECTORIO`, que es lo que hace que agregar un
 * directorio sin su rebuild se vea en el diff de `index.js`.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { OPCIONES_BASE } from './despliegue.js';
import { cambioAmeritaRebuild } from './directorios.js';
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
     * tajada 3 copie la forma correcta.
     *
     * La guarda no puede faltar: el trigger que escriba `publicadaAlgunaVez`
     * —que todavía no existe, B-905— hace un write-back sobre este mismo
     * documento, y sin ella cada publicación costaría **dos** builds; además
     * rearma el contador de reintentos (`CAMPOS_REARME`, D-23). Corregir el
     * contacto interno, que no sale al sitio, tampoco tiene por qué costar uno.
     *
     * El motivo lleva **solo el id**: el nombre y la dirección son contenido, y
     * el contacto de quien cargó la ficha es de un tercero (§9 y la fila de
     * `07-seguridad.md`). Misma forma que `actividad <id>`.
     */
    if (cambioAmeritaRebuild(antes, despues)) {
      await marcarRebuild(getFirestore(), `libreria ${id}`);
    } else {
      logger.debug('cambio de librería sin efecto en el sitio: no se rebuildea', { id });
    }
  },
);
