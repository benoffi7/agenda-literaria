/**
 * §12 — Infraestructura del historial de versiones.
 *
 * La lógica pura (cuándo se guarda una versión, con qué id, qué se poda) está
 * en `historial.js` y se testea sin emuladores. Acá solo queda el pegamento con
 * Firestore, igual que `index.js` es el pegamento de `calendario.js`.
 *
 * Vive en su propio archivo y no en `index.js` a propósito: `index.js` se toca
 * desde varios frentes a la vez y este trigger no necesita nada de ahí.
 */
import { onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldPath, Timestamp } from 'firebase-admin/firestore';
import {
  camposCambiados,
  idDeVersion,
  MAX_VERSIONES,
  versionesAborrar,
} from './historial.js';

/**
 * Un `batch` de Firestore admite 500 operaciones. En régimen la poda borra una
 * sola versión por edición; el tope solo importa si algún día se baja
 * `MAX_VERSIONES` y hay que recortar de golpe. Lo que sobre se poda en la
 * edición siguiente.
 */
const MAX_BORRADOS_POR_CORRIDA = 400;

/**
 * Firestore perezoso: este módulo lo importa `index.js`, y los imports de ESM
 * se evalúan **antes** del cuerpo del importador. Llamar a `getFirestore()` acá
 * arriba correría antes del `initializeApp()` de `index.js` y explotaría.
 */
let _db = null;
const firestore = () => {
  if (!_db) {
    if (getApps().length === 0) initializeApp();
    _db = getFirestore();
  }
  return _db;
};

/**
 * `region` y `serviceAccount` van explícitas y no heredadas del
 * `setGlobalOptions` de `index.js` por el mismo orden de evaluación de arriba:
 * cuando este módulo se carga, `setGlobalOptions` todavía no corrió, así que
 * heredarlas dejaría la función en us-central1 y con la SA por defecto.
 *
 * Se reusa `calendar-sync@` —la identidad del resto del deploy— porque ya tiene
 * los roles que un trigger de Firestore v2 necesita y que hay que otorgar a
 * mano (D-06): `datastore.user`, `eventarc.eventReceiver`, `run.invoker`,
 * `artifactregistry.reader`. Una SA nueva sin permiso de Calendar sería más
 * prolijo, pero es trabajo de IAM antes de poder desplegar una mejora P2.
 */
const OPCIONES = {
  document: 'actividades/{id}',
  region: 'southamerica-east1',
  maxInstances: 5,
  serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
};

/**
 * Escribe una versión y poda las que sobran (D-42).
 *
 * Lo comparten los dos triggers de abajo para que la retención, el id y la
 * forma del documento no puedan separarse entre "editaron" y "borraron".
 *
 * `instante` sale de `event.time` y `eventoId` de `event.id`: es lo que hace al
 * id idempotente frente a un reintento del mismo evento (D-43).
 */
const guardar = async ({ id, instante, eventoId, documento, campos, actualizadoPor, borrado }) => {
  const db = firestore();
  const versiones = db.collection(`actividades/${id}/versiones`);
  const version = idDeVersion(instante, eventoId);

  await versiones.doc(version).set({
    guardadoEn: Timestamp.fromDate(new Date(instante)),
    // Quién hizo la edición que pisó estos datos. Es un uid y la subcolección
    // solo la lee un admin (firestore.rules): nunca sale al `events.json`.
    actualizadoPor: actualizadoPor ?? null,
    // Para poder elegir la versión desde la consola de Firestore sin abrirlas
    // de a una, mientras no exista UI de restauración (B-40).
    camposCambiados: campos,
    // La versión de un borrado no es una edición más: es la última que hubo, y
    // la única de la que se puede recuperar la actividad entera (B-41).
    borrado: borrado === true,
    // §12 — el documento completo, tal cual, con sus Timestamp nativos: así
    // recuperar un campo a mano es copiar y pegar.
    documento,
  });

  logger.info('versión guardada', { id, version, campos, borrado: borrado === true });

  // ── Retención (ver `versionesAborrar`) ───────────────────────
  // Se leen solo los ids (`select()` sin campos). En régimen son
  // MAX_VERSIONES + 1 lecturas por edición, un costo despreciable al lado de
  // las llamadas a Calendar que la misma edición ya dispara.
  const existentes = await versiones.orderBy(FieldPath.documentId()).select().get();
  const sobrantes = versionesAborrar(
    existentes.docs.map((d) => d.id),
    MAX_VERSIONES,
  ).slice(0, MAX_BORRADOS_POR_CORRIDA);

  if (sobrantes.length === 0) return;

  const batch = db.batch();
  for (const viejo of sobrantes) batch.delete(versiones.doc(viejo));
  await batch.commit();

  logger.info('versiones viejas podadas', { id, borradas: sobrantes.length });
};

/**
 * §12 — Guarda el documento anterior en `/actividades/{id}/versiones/{version}`
 * cada vez que una edición pisa contenido cargado por una persona.
 */
export const guardarVersion = onDocumentUpdated(OPCIONES, async (event) => {
  const antes = event.data?.before?.data() ?? null;
  const despues = event.data?.after?.data() ?? null;
  const { id } = event.params;

  if (!antes) return;

  const campos = camposCambiados(antes, despues);
  if (campos.length === 0) {
    // El caso que rompería todo: `syncCalendar` escribe `calendarEventId` de
    // vuelta en `sesiones` y vuelve a disparar este trigger. El contenido
    // editable es idéntico, así que no se guarda una versión de basura por
    // cada publicación (ver `huboCambioDeContenido`).
    logger.debug('sin cambios de contenido: no se guarda versión', { id });
    return;
  }

  await guardar({
    id,
    // `event.time` y no `Date.now()`: es estable entre reintentos del mismo
    // evento, así que el id del documento también lo es y un reintento
    // reescribe la misma versión en lugar de duplicarla.
    instante: event.time ?? new Date().toISOString(),
    eventoId: event.id,
    documento: antes,
    campos,
    actualizadoPor: despues?.updatedBy ?? null,
    borrado: false,
  });
});

/**
 * B-41 — La versión que faltaba: la del borrado.
 *
 * `guardarVersion` es un `onDocumentUpdated` (§12), así que no se dispara al
 * borrar. El panel borra por fila y sin papelera: se iba la actividad entera y
 * no quedaba nada que recuperar. Era el último agujero de pérdida de datos.
 *
 * **Por qué un trigger de borrado y no borrado lógico.** Marcar
 * `estado: 'borrado'` y filtrarlo del listado también resolvería el "lo borré
 * sin querer", pero toca el listado, el formulario, las reglas y el enum del
 * modelo —y `estado` ya decide qué se publica (§7.3), así que sumarle un valor
 * mezcla dos cosas—. Esto son quince líneas, no cambia el modelo y guarda
 * exactamente lo que se perdía.
 *
 * **Lo que queda pendiente (B-89):** la subcolección sobrevive al documento
 * padre, así que las versiones quedan huérfanas — alcanzables por path desde la
 * consola, invisibles desde el panel. Es lo que hace recuperable el borrado, y
 * a la vez lo que B-89 tiene que resolver cuando exista UI (B-40).
 */
export const guardarVersionAlBorrar = onDocumentDeleted(OPCIONES, async (event) => {
  const borrado = event.data?.data() ?? null;
  const { id } = event.params;

  if (!borrado) return;

  await guardar({
    id,
    instante: event.time ?? new Date().toISOString(),
    eventoId: event.id,
    documento: borrado,
    // Qué se perdió: todo el contenido editable que tenía la actividad. Con
    // `despues` en `null`, `camposCambiados` devuelve justamente eso.
    campos: camposCambiados(borrado, null),
    // El último que la editó, que es lo más cerca que estamos de saber quién la
    // borró: el evento de borrado no trae uid.
    actualizadoPor: borrado.updatedBy ?? null,
    borrado: true,
  });
});
