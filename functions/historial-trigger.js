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
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
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
 * §12 — Guarda el documento anterior en `/actividades/{id}/versiones/{version}`
 * cada vez que una edición pisa contenido cargado por una persona.
 *
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
export const guardarVersion = onDocumentUpdated(
  {
    document: 'actividades/{id}',
    region: 'southamerica-east1',
    maxInstances: 5,
    serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
  },
  async (event) => {
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

    const db = firestore();
    const versiones = db.collection(`actividades/${id}/versiones`);

    // `event.time` y no `Date.now()`: es estable entre reintentos del mismo
    // evento, así que el id del documento también lo es y un reintento
    // reescribe la misma versión en lugar de duplicarla.
    const instante = event.time ?? new Date().toISOString();
    const version = idDeVersion(instante, event.id);

    await versiones.doc(version).set({
      guardadoEn: Timestamp.fromDate(new Date(instante)),
      // Quién hizo la edición que pisó estos datos. Es un uid y la subcolección
      // solo la lee un admin (firestore.rules): nunca sale al `events.json`.
      actualizadoPor: despues?.updatedBy ?? null,
      // Para poder elegir la versión desde la consola de Firestore sin abrirlas
      // de a una, mientras no exista UI de restauración (B-40).
      camposCambiados: campos,
      // §12 — el `before` completo, tal cual, con sus Timestamp nativos: así
      // recuperar un campo a mano es copiar y pegar.
      documento: antes,
    });

    logger.info('versión guardada', { id, version, campos });

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
  },
);
