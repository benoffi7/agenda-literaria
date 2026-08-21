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

export const syncCalendar = onDocumentWritten('actividades/{id}', async (event) => {
  const antes = event.data?.before?.data() ?? null;
  const despues = event.data?.after?.data() ?? null;
  const { id } = event.params;

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
  // Los ids nuevos se juntan y se escriben de una sola vez al final: un update
  // por sesión serían N disparos más de esta misma Function.
  const idsNuevos = new Map();
  const idsBorrados = new Set();

  for (const op of ops) {
    try {
      if (op.tipo === 'crear') {
        const { data } = await cal.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: op.evento,
        });
        idsNuevos.set(op.id, data.id);
        logger.info('evento creado', { id, sesion: op.id, eventId: data.id });
      } else if (op.tipo === 'actualizar') {
        await cal.events.update({
          calendarId: CALENDAR_ID,
          eventId: op.eventId,
          requestBody: op.evento,
        });
        logger.info('evento actualizado', { id, sesion: op.id });
      } else if (op.tipo === 'borrar') {
        await cal.events.delete({ calendarId: CALENDAR_ID, eventId: op.eventId });
        idsBorrados.add(op.id);
        logger.info('evento borrado', { id, sesion: op.id });
      }
    } catch (e) {
      // 404 o 410 en un borrado: el evento ya no estaba. Es el resultado
      // buscado, no un error — se marca igual para limpiar el id colgado.
      const code = e?.code ?? e?.response?.status;
      if (op.tipo === 'borrar' && (code === 404 || code === 410)) {
        idsBorrados.add(op.id);
        logger.warn('el evento ya no existía en Calendar', { id, sesion: op.id });
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

  if (idsNuevos.size > 0 || idsBorrados.size > 0) {
    // Se relee el documento: entre el diff y este punto pudo haber otra
    // edición, y escribir el array que teníamos en memoria la perdería.
    const ref = db.doc(`actividades/${id}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const sesiones = (snap.data().sesiones ?? []).map((s) => {
        if (idsNuevos.has(s.id)) return { ...s, calendarEventId: idsNuevos.get(s.id) };
        if (idsBorrados.has(s.id)) return { ...s, calendarEventId: null };
        return s;
      });
      tx.update(ref, { sesiones });
    });
  }

  await marcarRebuild(`actividad ${id}`);
});

// ─────────────────────────────────────────────────────────────────
// §4.4 — el rebuild también se dispara al cambiar /opciones/*, si no se
// renombra una etiqueta y el sitio sigue mostrando la vieja (trampa 8).
// ─────────────────────────────────────────────────────────────────

export const rebuildPorOpciones = onDocumentWritten('opciones/{campo}', async (event) => {
  // El caché de etiquetas quedó viejo. Se invalida solo en esta instancia; las
  // demás lo recargan al reciclarse. No es exacto, pero renombrar una etiqueta
  // es raro y el costo de equivocarse es una descripción con el label anterior
  // hasta la próxima edición de la actividad.
  _labels = null;
  await marcarRebuild(`opciones/${event.params.campo}`);
});

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

    await ref.set(registrarExito(ahora), { merge: true });
    logger.info('rebuild disparado', { motivo: estado.motivo, intento: decision.intento });
  },
);

export { reporteAIssue } from './reportes-trigger.js';
