/**
 * §7 — el sync a Google Calendar: el trigger.
 *
 * La parte frágil —el diff, la guarda anti-loop, la construcción del evento— es
 * pura y vive en `calendario.js` y `sincronizacion.js`, así que se testea sin
 * emuladores y sin tocar un calendario real (§10). Acá solo queda el pegamento:
 * leer las etiquetas, ejecutar las operaciones que el diff decidió, y escribir
 * los ids de vuelta.
 *
 * Vive en su propio archivo desde B-77. Antes estaba en `index.js`, que era el
 * único archivo de `functions/` sin este corte — y el único de 327 LOC sin
 * ningún test.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { planificar } from './calendario.js';
import { CALENDAR_ID, calendario, crearEvento } from './calendario-api.js';
import { OPCIONES_BASE } from './despliegue.js';
import { ciudadesParaElLog } from './ciudades.js';
import { quienEscribioTieneCiudad } from './claims-de-cuenta.js';
import {
  cambiaLoPublico,
  conDerivados,
  derivadosDesalineados,
  pideRebuild,
  sedesSinCiudadNuevas,
} from './derivados.js';
import { corregirDerivados } from './derivados-firestore.js';
import { cargarLabels } from './etiquetas.js';
import { faltaMarcarPublicada } from './historial.js';
import { marcarPublicada } from './marca-de-publicada.js';
import { marcarRebuild } from './marca-de-rebuild.js';
import { decidirAnteFallo, reponerIds } from './sincronizacion.js';

/**
 * Las opciones van **explícitas** y no heredadas del `setGlobalOptions` de
 * `index.js`: en ESM los imports se evalúan antes que el cuerpo del importador,
 * así que cuando este módulo se carga `setGlobalOptions` todavía no corrió
 * (D-35). Heredarlas dejaría la Function en `us-central1` y con la SA por
 * defecto de Compute, a la que Calendar le contesta 404 en todo.
 */
export const syncCalendar = onDocumentWritten(
  { ...OPCIONES_BASE, document: 'actividades/{id}' },
  async (event) => {
    const db = getFirestore();
    const antes = event.data?.before?.data() ?? null;
    const despues = event.data?.after?.data() ?? null;
    const { id } = event.params;

    // B-83 — el rebuild del sitio se marca ACÁ, antes de los dos cortes de
    // abajo, porque corresponde por que la actividad cambió y no por que el
    // calendario haya recibido operaciones. `destacado`, `imagenUrl`,
    // `searchText` y el `slug` salen al `events.json` (§5.2) y **no** entran al
    // evento de Calendar: colgando el rebuild del sync, tildar "Destacar en la
    // portada" de una actividad publicada no llegaba nunca al sitio. Y sin
    // `GOOGLE_CALENDAR_ID` configurado no se publicaba nada, nunca.
    //
    // La guarda no puede faltar: esta misma Function escribe `calendarEventId`
    // de vuelta, y marcar el rebuild ahí sería pedir un build por cada sync —
    // que además rearma el contador de reintentos (`CAMPOS_REARME`, D-23) y
    // vuelve a subir `pendiente` justo después de que un build arrancó.
    //
    // La pregunta "¿cambió algo que le importe a quien lo lee?" ya está resuelta
    // en `historial.js`: `huboCambioDeContenido` compara el **contenido
    // editable**, o sea el documento menos lo que escribe la máquina (D-41). El
    // write-back produce, por construcción, el mismo contenido editable. Es la
    // misma propiedad de D-07, y no un acuerdo entre dos listas de campos.
    //
    // B-2050 — `pideRebuild` es ese criterio más los cuatro derivados que salen al
    // sitio (`sede`, `modalidad`, `online`, `searchText`): desde B-2050 son de
    // máquina para el historial, y su corrección tiene que llegar al sitio igual.
    if (pideRebuild(antes, despues)) {
      await marcarRebuild(db, `actividad ${id}`);
    }

    /*
     * B-285 — la marca de «estuvo publicada alguna vez», que reemplaza la
     * inferencia que el build rehacía por su cuenta (D-159).
     *
     * ── Por qué vive en ESTE trigger ──────────────────────────────────────
     * Porque es el único `onDocumentWritten` sobre `actividades/{id}`, y la marca
     * tiene que prenderse también cuando la actividad **nace** publicada — el
     * panel deja crear y publicar en el mismo guardado. `guardarVersion` es un
     * `onDocumentUpdated` y se perdería ese caso, que es justo el de las
     * actividades nuevas, o sea todas las que este campo viene a servir.
     *
     * Va acá arriba, al lado de `marcarRebuild`, y por el mismo motivo que ése:
     * corresponde por que **la actividad cambió**, no por que el calendario haya
     * recibido operaciones. Abajo hay dos cortes tempranos —sin ops y sin
     * `GOOGLE_CALENDAR_ID`— y detrás de cualquiera de los dos la marca no se
     * escribiría nunca en una instalación sin Calendar configurado.
     *
     * (Y la palabra que nombra esos cortes no se escribe acá arriba a propósito:
     * el chequeo de la clase de B-83 busca la palabra clave en el **texto** que
     * precede a la llamada, comentarios incluidos, así que nombrarla en esta
     * prosa daba un falso positivo. Es la misma rugosidad del parser que ya
     * costó un productor fantasma en `07-seguridad.md`.)
     *
     * La guarda anti-loop es doble y las dos mitades hacen falta (trampa 3):
     * `faltaMarcarPublicada` corta la segunda pasada porque la marca ya está, y
     * `MARCA_DE_PUBLICADA` está en `CAMPOS_DE_MAQUINA`, así que esa escritura no
     * cuenta como cambio de contenido — si no, cada publicación costaría una
     * versión de historial y un rebuild de más.
     *
     * El efecto vive en `marca-de-publicada.js` y no inline, por el mismo corte
     * que `marcarRebuild` y por una razón que se verifica: el chequeo de la clase
     * de B-83 recorre **llamadas nombradas**, así que una escritura inline habría
     * quedado fuera de la red que atrapa exactamente este error.
     *
     * Si falla, se loguea y **no se corta el sync**: la marca es para el build de
     * mañana, los eventos del calendario son de ahora.
     */
    if (faltaMarcarPublicada(despues, antes)) {
      try {
        await marcarPublicada(db, id);
        logger.info('marcada como publicada alguna vez', { id });
      } catch (e) {
        logger.warn('no se pudo marcar la actividad como publicada', { id, error: e?.message });
      }
    }

    /*
     * B-1920, B-2050 — los derivados de `modalidades` recalculados del lado del
     * servidor: `modalidad`, `sede`, `online`, `searchText` y `ciudades`.
     *
     * `dentroDeSuCiudad()` le cree a `ciudades` y a la primera `sede` porque una
     * regla no puede recorrer `modalidades[]` (D-1150), y los otros tres salen al
     * sitio, al `location` del evento y a la búsqueda. El panel los escribe bien
     * siempre; un documento armado a mano con el SDK puede traer unos que no son
     * los de sus filas. Acá se corrigen los cinco en una sola escritura y se avisa
     * con `alerta`, que la política de GCP ya toma (docs/08-operacion.md, «Cuando
     * suena `ciudades-no-coinciden`» y «Cuando suena `derivados-no-coinciden`»).
     * Son dos alertas porque son dos preguntas: la primera es de permisos —¿una
     * cuenta cargó fuera de su ciudad?— y la segunda de contenido.
     *
     * Va en este trigger por lo mismo que la marca de arriba: es el único que ve
     * el documento que **nace**, y el `create` es la escritura que la regla
     * dejaría pasar con un derivado inventado. Y va arriba de los dos cortes de
     * abajo porque corresponde por lo que cambió en el documento, no por lo que
     * le pase al calendario.
     *
     * La guarda anti-loop (trampa 3) tiene tres mitades: `derivadosDesalineados`
     * no entra en la segunda pasada porque el documento ya coincide; los cinco
     * están en `CAMPOS_DE_MAQUINA`, así que el write-back no deja versión; y el
     * diff de Calendar de abajo se planifica sobre `conDerivados`, que es la misma
     * antes y después de corregir, así que no hay `update` en falso. El rebuild
     * que el historial ya no ve lo pide la segunda pasada, con `pideRebuild` de
     * arriba: `sede`, `modalidad`, `online` y `searchText` salen al `events.json`.
     *
     * **No toca `estado`** (D-1231). Y el log lleva **nombres de campo**, nunca
     * valores: `sede` es una dirección, `searchText` trae nombres de personas y
     * `online` el link de la reunión. `ciudades` sí muestra sus slugs, como en
     * B-1920, recortados.
     *
     * Un fallo se loguea y el sync sigue: los eventos del calendario son de ahora.
     */
    if (derivadosDesalineados(despues)) {
      try {
        const corregidos = await corregirDerivados(db, id);
        if (corregidos?.campos.includes('ciudades')) {
          logger.warn('ciudades no coincidía con las filas del documento: se corrigió', {
            alerta: 'ciudades-no-coinciden',
            id,
            estado: corregidos.estado,
            guardadas: ciudadesParaElLog(corregidos.ciudadesGuardadas),
            derivadas: ciudadesParaElLog(corregidos.derivados.ciudades),
          });
        }
        if (corregidos && cambiaLoPublico(corregidos.campos)) {
          logger.warn('los derivados no coincidían con las filas del documento: se corrigieron', {
            alerta: 'derivados-no-coinciden',
            id,
            estado: corregidos.estado,
            campos: corregidos.campos.filter((c) => c !== 'ciudades'),
          });
        }
      } catch (e) {
        logger.warn('no se pudieron corregir los derivados', {
          alerta: 'derivados-no-coinciden',
          id,
          campos: derivadosDesalineados(despues)?.campos ?? [],
          error: e?.message,
        });
      }
    }

    /*
     * B-2052 — una fila con sede y la ciudad vacía, cargada por una cuenta
     * publicadora con ciudad.
     *
     * `ciudadesDe` descarta las ciudades vacías, así que esa fila no suma nada a
     * `ciudades` y la regla pasa aunque la dirección sea de otra ciudad (D-1234).
     * **Solo se avisa, no se corrige**: no hay de qué derivar la ciudad que falta.
     * Y solo si quien escribió es una publicadora con ciudad, cuyo panel exige la
     * ciudad (D-1154): de un admin o de una publicadora general es una carga
     * legítima. El claim se lee del registro de la cuenta
     * (`quienEscribioTieneCiudad`), una vez, y solo cuando la escritura trae una
     * fila así **nueva** (`sedesSinCiudadNuevas`): el write-back del
     * `calendarEventId` conserva el `updatedBy` y sin eso volvería a avisar.
     *
     * El log **no lleva el uid ni el mail**: el `id` de la actividad alcanza para
     * llegar a la cuenta desde la consola (docs/08-operacion.md, «Cuando suena
     * `sede-sin-ciudad`»). Si el claim no se puede leer —el rol de IAM que falta
     * es el caso típico— se avisa igual, con el código: un aviso que no puede
     * sonar es peor que uno de más.
     */
    const filasSinCiudad = sedesSinCiudadNuevas(despues, antes);
    if (filasSinCiudad > 0) {
      try {
        if (await quienEscribioTieneCiudad(getAuth(), despues?.updatedBy)) {
          logger.warn('una publicadora con ciudad cargó una sede sin ciudad', {
            alerta: 'sede-sin-ciudad',
            id,
            estado: despues?.estado ?? null,
            filas: filasSinCiudad,
          });
        }
      } catch (e) {
        logger.warn('no se pudo leer el rol de quien cargó una sede sin ciudad', {
          alerta: 'sede-sin-ciudad',
          id,
          filas: filasSinCiudad,
          error: e?.code ?? 'desconocido',
        });
      }
    }

    const labels = await cargarLabels(db);
    // B-2050 — el diff se planifica sobre los derivados **recalculados**: una `sede`
    // escrita a mano que no es la de las filas no llega al `location` del evento,
    // y su corrección —que vuelve a disparar esto— no manda un `update` en falso.
    const ops = planificar(conDerivados(antes), conDerivados(despues), labels);

    if (ops.length === 0) {
      // §7.1 — la guarda anti-loop vive acá: la escritura de `calendarEventId`
      // vuelve a disparar esta Function, pero no produce ninguna operación, así
      // que la recursión se corta en la segunda pasada.
      logger.debug('sin cambios relevantes para Calendar', { id });
      return;
    }

    if (!CALENDAR_ID) {
      logger.error('GOOGLE_CALENDAR_ID sin configurar: no se sincroniza nada', { id });
      return;
    }

    const cal = await calendario();
    // Qué `calendarEventId` queda en cada sesión (`null` = se borró). Se juntan
    // y se escriben de una sola vez al final: un update por sesión serían N
    // disparos más de esta misma Function.
    const ids = new Map();

    for (const op of ops) {
      try {
        if (op.tipo === 'crear') {
          const eventId = await crearEvento(cal, op);
          ids.set(op.id, eventId);
          logger.info('evento creado', { id, sesion: op.id, eventId });
        } else if (op.tipo === 'actualizar') {
          await cal.events.update({
            calendarId: CALENDAR_ID,
            eventId: op.eventId,
            requestBody: op.evento,
          });
          // B-80 — el id se repone también acá, no solo al crear y al borrar: si
          // el panel guardó desde un snapshot previo al write-back, el documento
          // quedó con `calendarEventId: null` y la edición siguiente crearía un
          // segundo evento. Ver `reponerIds`. Desde B-150 el panel además relee
          // el documento antes de escribir, así que esto pasó a ser la red de
          // abajo y no el arreglo.
          ids.set(op.id, op.eventId);
          logger.info('evento actualizado', { id, sesion: op.id });
        } else if (op.tipo === 'borrar') {
          await cal.events.delete({ calendarId: CALENDAR_ID, eventId: op.eventId });
          ids.set(op.id, null);
          logger.info('evento borrado', { id, sesion: op.id });
        }
      } catch (e) {
        // Qué significa el fallo lo decide `decidirAnteFallo` (B-125), que es
        // pura y tiene su tabla testeada; acá solo se ejecuta el efecto.
        const code = e?.code ?? e?.response?.status;
        const { accion, motivo } = decidirAnteFallo(op, code);

        if (accion === 'limpiar-id') {
          ids.set(op.id, null);
          logger.warn('el evento ya no existía en Calendar', { id, sesion: op.id, motivo });
        } else if (accion === 'recrear') {
          // B-125 — alguien borró el evento a mano y el encuentro sigue
          // publicado: se repone. Sin esto el id colgado hacía que cada edición
          // volviera a emitir `actualizar` contra un evento inexistente, así que
          // el encuentro se perdía del calendario público para siempre.
          try {
            const eventId = await crearEvento(cal, op);
            ids.set(op.id, eventId);
            logger.warn('el evento no estaba en Calendar: se recreó', {
              id,
              sesion: op.id,
              eventId,
              motivo,
            });
          } catch (e2) {
            logger.error('falló recrear un evento borrado a mano', {
              id,
              sesion: op.id,
              error: e2?.message,
            });
          }
        } else {
          // No se corta el loop: un encuentro que falla no debe dejar los otros
          // siete sin sincronizar.
          logger.error('falló una operación de Calendar', {
            id,
            sesion: op.id,
            tipo: op.tipo,
            error: e?.message,
          });
        }
      }
    }

    if (ids.size > 0) {
      // Se relee el documento: entre el diff y este punto pudo haber otra
      // edición, y escribir el array que teníamos en memoria la perdería.
      const ref = db.doc(`actividades/${id}`);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const sesiones = reponerIds(snap.data().sesiones ?? [], ids);
        // `null` = el documento ya tiene los ids que corresponden, que es el caso
        // normal de un `actualizar`. Escribirlo igual dispararía esta misma
        // Function otra vez para no cambiar nada.
        if (sesiones) tx.update(ref, { sesiones });
      });
    }
  },
);
