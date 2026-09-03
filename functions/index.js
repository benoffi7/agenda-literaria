/**
 * §7 y §8 — sync a Google Calendar y trigger de rebuild.
 * Cloud Functions v2 (§14).
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { planificar } from './calendario.js';
import {
  decidirAnteFallo,
  idDeEvento,
  mapaDeEtiquetas,
  mismasEtiquetas,
  replanificarPorEtiquetas,
  reponerIds,
} from './sincronizacion.js';
import { huboCambioDeContenido } from './historial.js';
import {
  CAMPOS_REARME,
  decidirDisparo,
  registrarExito,
  registrarFallo,
} from './rebuild.js';

initializeApp();
const db = getFirestore();

// southamerica-east1, al lado de Firestore: cada op del diff es un round trip.
//
// La Function corre como `calendar-sync@`, que es la identidad con la que se
// comparte el calendario. Sin esto correría como la SA por defecto de Compute
// y Calendar le devolvería 404 en todo.
setGlobalOptions({
  region: 'southamerica-east1',
  maxInstances: 5,
  serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
});

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

/** `owner/repo` del repositorio que tiene el workflow de build (§8). */
const GITHUB_REPO = process.env.GITHUB_REPO;

/**
 * §5.4 — el PAT de GitHub es lo único secreto de este proyecto, así que va a
 * Secret Manager y no a `functions/.env` (que sí está versionado).
 *
 * `defineSecret` es lo que ata el secreto a la Function: leerlo de
 * `process.env` sin declararlo acá daría `undefined` en producción, porque
 * nadie habría montado el secreto en el runtime.
 */
const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');

/**
 * §2.6 — service account, sin OAuth ni refresh tokens.
 *
 * Desvío respecto del documento: en vez de una key de service account, la
 * Function CORRE como la service account (`calendar-sync@…`) y toma el token
 * de las credenciales de su propio runtime. Mismo resultado, sin una key que
 * guardar, rotar ni filtrar. El setup del calendario es idéntico: compartirlo
 * con el mail de la service account dándole "Realizar cambios en los eventos".
 */
let _calendar = null;
const calendario = async () => {
  if (_calendar) return _calendar;
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
  _calendar = google.calendar({ version: 'v3', auth: await auth.getClient() });
  return _calendar;
};

/**
 * §4.1 — la actividad guarda solo el slug de cada taxonomía, así que para que
 * la descripción del evento diga "A la gorra" y no "a-la-gorra" hay que
 * resolver las etiquetas contra /opciones/*.
 *
 * Se cachea por instancia: son 5 documentos que cambian muy de vez en cuando y
 * la Function corre una vez por escritura de actividad.
 *
 * §4.3 — acá entran TODAS las opciones, también las pendientes de aprobación.
 * A propósito: `aprobada` decide qué se puede *elegir* en el desplegable de las
 * otras cuentas, no qué se puede *mostrar*. La actividad guardó ese slug
 * legítimamente y el evento es público: filtrar acá haría que la descripción
 * dijera "con-beca-parcial" en lugar de "Con beca parcial".
 */
const CAMPOS_TAXONOMIA = ['arancel', 'tipo', 'barrio', 'plataforma', 'tags'];
let _labels = null;

const cargarLabels = async () => {
  if (_labels) return _labels;
  const labels = {};
  const snaps = await db.getAll(...CAMPOS_TAXONOMIA.map((c) => db.doc(`opciones/${c}`)));
  snaps.forEach((snap, i) => {
    const campo = CAMPOS_TAXONOMIA[i];
    labels[campo] = Object.fromEntries(
      (snap.data()?.valores ?? []).map((v) => [v.slug, v.label]),
    );
  });
  _labels = labels;
  return labels;
};

/**
 * Marca que hay que rebuildear el sitio (§8). El debounce lo hace el schedule.
 *
 * `CAMPOS_REARME` resetea el contador de fallos: un cambio nuevo merece sus
 * propios intentos. Es lo que hace que el rebuild se recupere solo después de
 * un problema persistente (ver `rebuild.js`).
 */
const marcarRebuild = (motivo) =>
  db.doc('sistema/rebuild').set(
    {
      pendiente: true,
      motivo,
      actualizado: FieldValue.serverTimestamp(),
      ...CAMPOS_REARME,
    },
    { merge: true },
  );

// ─────────────────────────────────────────────────────────────────
// Sync a Calendar
// ─────────────────────────────────────────────────────────────────

/**
 * Crea el evento de una sesión y devuelve el id que quedó en Calendar.
 *
 * B-82 — el id lo elige el cliente (`idDeEvento`), derivado del id de sesión.
 * Así un `insert` repetido —una reentrega del mismo evento de Firestore, que
 * la plataforma garantiza *al menos una vez*— choca con el que ya existe y
 * devuelve 409 en lugar de crear un segundo evento en el calendario público.
 */
const crearEvento = async (cal, op) => {
  const propuesto = idDeEvento(op.id);

  try {
    const { data } = await cal.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: propuesto ? { ...op.evento, id: propuesto } : op.evento,
    });
    return data.id;
  } catch (e) {
    const code = e?.code ?? e?.response?.status;
    if (!propuesto || code !== 409) throw e;

    // 409 = ya existe un evento con ese id. Llegan dos caminos, y los dos se
    // resuelven igual —dejando el contenido de ahora en ese mismo evento:
    //
    //  - la reentrega que este id vino a resolver: el evento ya se creó en la
    //    entrega anterior, así que el update reescribe lo mismo;
    //  - una sesión que pasó a borrador (se borró el evento) y volvió a
    //    publicarse: Calendar reserva el id de un evento borrado, así que sin
    //    esto ese encuentro no podría volver nunca al calendario.
    //    `status: 'confirmed'` es lo que lo resucita.
    await cal.events.update({
      calendarId: CALENDAR_ID,
      eventId: propuesto,
      requestBody: { ...op.evento, status: 'confirmed' },
    });
    logger.info('el evento ya existía con el id derivado: se actualizó', {
      sesion: op.id,
      eventId: propuesto,
    });
    return propuesto;
  }
};

export const syncCalendar = onDocumentWritten('actividades/{id}', async (event) => {
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
  if (huboCambioDeContenido(antes, despues)) {
    await marcarRebuild(`actividad ${id}`);
  }

  const labels = await cargarLabels();
  const ops = planificar(antes, despues, labels);

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
        // segundo evento. Ver `reponerIds`.
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
});

// ─────────────────────────────────────────────────────────────────
// §4.4 — el rebuild también se dispara al cambiar /opciones/*, si no se
// renombra una etiqueta y el sitio sigue mostrando la vieja (trampa 8).
// ─────────────────────────────────────────────────────────────────

/**
 * Cuántos eventos se reescriben como máximo al renombrar una etiqueta (B-04).
 *
 * Es un tope de seguridad, no una regla de negocio: con 30 actividades
 * publicadas de 8 encuentros ya son 240 round trips a Calendar, y la Function
 * tiene un timeout. Si se alcanza, se loguea `error` con lo que faltó: cada
 * actividad se pone al día sola con su próxima edición, y el sitio (que sí
 * muestra la etiqueta nueva) ya se rebuildeó.
 */
const MAX_EVENTOS_RESYNC = 150;

export const rebuildPorOpciones = onDocumentWritten(
  {
    document: 'opciones/{campo}',
    // Renombrar una etiqueta reescribe los eventos de todas las actividades
    // publicadas (B-04): son N round trips a Calendar, no una escritura.
    timeoutSeconds: 300,
  },
  async (event) => {
    const { campo } = event.params;

    // El caché de etiquetas quedó viejo. Se invalida solo en esta instancia; las
    // demás lo recargan al reciclarse.
    _labels = null;
    await marcarRebuild(`opciones/${campo}`);

    // ── B-04 · los eventos ya creados muestran la etiqueta, no el slug ──
    //
    // La descripción y la ubicación del evento resuelven el slug a su etiqueta
    // (D-11), así que renombrar "A la gorra" dejaba a los eventos existentes
    // diciendo lo anterior hasta la próxima edición de cada actividad. El
    // rebuild del sitio no alcanza: el calendario es la otra salida pública.
    const antes = mapaDeEtiquetas(event.data?.before?.data()?.valores);
    const despues = mapaDeEtiquetas(event.data?.after?.data()?.valores);

    if (mismasEtiquetas(antes, despues)) {
      // El caso frecuente y de lejos: `usos + 1` de `upsertOpcion` en cada
      // guardado del formulario, o una opción nueva (que ninguna actividad usa
      // todavía). Sin esta guarda, cada guardado re-sincronizaría todo.
      logger.debug('sin etiquetas renombradas: no se re-sincroniza el calendario', { campo });
      return;
    }

    if (!CALENDAR_ID) {
      logger.error('GOOGLE_CALENDAR_ID sin configurar: no se re-sincroniza nada', { campo });
      return;
    }

    // `cargarLabels` ya releyó las cinco taxonomías (el caché se invalidó
    // arriba), así que `labels` tiene las etiquetas nuevas. El mapa viejo es el
    // mismo con este campo pisado por el `before`.
    const labels = await cargarLabels();
    const labelsAntes = { ...labels, [campo]: antes };

    // Solo las publicadas: las demás no tienen eventos (§7.3).
    const snap = await db.collection('actividades').where('estado', '==', 'publicado').get();
    const cal = await calendario();
    let reescritos = 0;
    let pendientes = 0;

    for (const doc of snap.docs) {
      const ops = replanificarPorEtiquetas(doc.data(), labelsAntes, labels);
      for (const op of ops) {
        if (reescritos >= MAX_EVENTOS_RESYNC) {
          pendientes += 1;
          continue;
        }
        try {
          await cal.events.update({
            calendarId: CALENDAR_ID,
            eventId: op.eventId,
            requestBody: op.evento,
          });
          reescritos += 1;
        } catch (e) {
          // Un evento que falla no puede dejar los otros sin actualizar, igual
          // que en el diff.
          logger.error('falló la re-sincronización de un evento', {
            campo,
            actividad: doc.id,
            sesion: op.id,
            error: e?.message,
          });
        }
      }
    }

    if (pendientes > 0) {
      logger.error('la re-sincronización por etiquetas se cortó por el tope', {
        campo,
        reescritos,
        pendientes,
        tope: MAX_EVENTOS_RESYNC,
      });
    } else if (reescritos > 0) {
      logger.info('eventos re-sincronizados por un cambio de etiqueta', { campo, reescritos });
    }
  },
);

// ─────────────────────────────────────────────────────────────────
// §8 — debounce del rebuild: si se editan cinco campos seguidos no se
// disparan cinco builds.
// ─────────────────────────────────────────────────────────────────

/** Timeout del dispatch. Sin esto un socket colgado se come el tick entero. */
const TIMEOUT_DISPATCH_MS = 15_000;

/**
 * Dispara el `repository_dispatch` que arranca el workflow de build
 * (`.github/workflows/deploy.yml`, `types: [rebuild]`).
 *
 * Devuelve `null` si salió bien, o el mensaje del error para guardarlo en el
 * documento. No tira: el que decide qué hacer con el fallo es el schedule.
 */
const dispararDispatch = async (repo, token, motivo) => {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      // El motivo viaja al workflow para que el run diga qué lo disparó.
      body: JSON.stringify({
        event_type: 'rebuild',
        client_payload: { motivo: motivo ?? 'sin motivo' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_DISPATCH_MS),
    });
    if (r.ok) return null;
    // El cuerpo trae el porqué real ("Bad credentials", "Not Found" si el PAT
    // no ve el repo). Sin él, un 404 y un PAT vencido se ven igual.
    const cuerpo = await r.text().catch(() => '');
    return `HTTP ${r.status} ${cuerpo}`.trim();
  } catch (e) {
    return e?.message ?? String(e);
  }
};

export const dispararRebuild = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Argentina/Buenos_Aires',
    secrets: [GITHUB_TOKEN],
  },
  async () => {
    const ref = db.doc('sistema/rebuild');
    const snap = await ref.get();
    const estado = snap.exists ? snap.data() : null;
    const ahora = Date.now();

    const decision = decidirDisparo(estado, ahora);
    if (decision.accion === 'esperar') {
      if (decision.motivo === 'agotado') {
        // El `error` ya se logueó en el tick que agotó los intentos. Repetirlo
        // cada 5 minutos sería el ruido que el límite vino a evitar: el estado
        // persistente está en el documento (`agotado`, `ultimoError`).
        logger.debug('rebuild agotado: espera un cambio nuevo o un disparo manual', {
          intentos: decision.intentos,
        });
      }
      return;
    }

    const token = GITHUB_TOKEN.value();
    if (!token || !GITHUB_REPO) {
      // Falta configuración, no falló nada: no consume un intento ni ensucia
      // el contador. Y va como info, que cada 5 minutos ya es suficiente.
      logger.info('rebuild pendiente pero sin GitHub configurado (§8)');
      return;
    }

    const error = await dispararDispatch(GITHUB_REPO, token, estado.motivo);

    if (error) {
      // El flag `pendiente` queda en true: el próximo tick reintenta, con
      // backoff, hasta agotar los intentos.
      const fallo = registrarFallo(estado, error, ahora);
      await ref.set(fallo, { merge: true });
      if (fallo.agotado) {
        logger.error('el rebuild agotó los reintentos: el sitio quedó viejo', {
          // B-21 — etiqueta estable para la alerta de GCP. El filtro de una
          // log-based alert sobre el *texto* del mensaje se rompe en silencio
          // el día que alguien reescribe la frase; sobre un campo, no. Es el
          // único log del proyecto que amerita despertar a alguien: significa
          // que el sitio público quedó viejo y que ya nadie va a reintentar.
          alerta: 'rebuild-agotado',
          intentos: fallo.intentos,
          error: fallo.ultimoError,
          motivo: estado.motivo,
        });
      } else {
        logger.warn('repository_dispatch falló, se reintenta', {
          intentos: fallo.intentos,
          error: fallo.ultimoError,
        });
      }
      return;
    }

    // B-85 — bajar `pendiente` se hace comparando: entre la lectura de arriba y
    // este punto pasó una llamada a GitHub de hasta 15 s, y una actividad
    // guardada en esa ventana marcó su rebuild. Ese cambio no entró al build que
    // acabamos de disparar, así que el flag tiene que quedar arriba.
    //
    // Va en transacción para que la comparación no tenga su propia ventana: si
    // la marca llega mientras la transacción corre, Firestore la reintenta y la
    // ve.
    const exito = await db.runTransaction(async (tx) => {
      const actual = await tx.get(ref);
      const campos = registrarExito(ahora, {
        marcaLeida: estado.actualizado ?? null,
        marcaActual: (actual.exists ? actual.data().actualizado : null) ?? null,
      });
      tx.set(ref, campos, { merge: true });
      return campos;
    });

    logger.info('rebuild disparado', { motivo: estado.motivo, intento: decision.intento });
    if (exito.pendiente) {
      logger.info('llegó otro cambio durante el dispatch: queda pendiente para el próximo tick');
    }
  },
);

export { guardarVersion, guardarVersionAlBorrar } from './historial-trigger.js';
export { limpiarVersionesHuerfanas } from './versiones-limpieza-trigger.js';
export { reporteAIssue } from './reportes-trigger.js';
export { optimizarImagen } from './imagenes-trigger.js';
export { limpiarImagenesHuerfanas } from './imagenes-limpieza-trigger.js';
