/**
 * §7 y §8 — sync a Google Calendar y trigger de rebuild.
 * Cloud Functions v2 (§14).
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { construirEvento, planificar } from './calendario.js';

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

/** Marca que hay que rebuildear el sitio (§8). El debounce lo hace el schedule. */
const marcarRebuild = (motivo) =>
  db.doc('sistema/rebuild').set(
    { pendiente: true, motivo, actualizado: FieldValue.serverTimestamp() },
    { merge: true },
  );

// ─────────────────────────────────────────────────────────────────
// Sync a Calendar
// ─────────────────────────────────────────────────────────────────

export const syncCalendar = onDocumentWritten('actividades/{id}', async (event) => {
  const antes = event.data?.before?.data() ?? null;
  const despues = event.data?.after?.data() ?? null;
  const { id } = event.params;

  const ops = planificar(antes, despues);

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
          requestBody: construirEvento(despues, op.sesion),
        });
        idsNuevos.set(op.id, data.id);
        logger.info('evento creado', { id, sesion: op.id, eventId: data.id });
      } else if (op.tipo === 'actualizar') {
        await cal.events.update({
          calendarId: CALENDAR_ID,
          eventId: op.eventId,
          requestBody: construirEvento(despues, op.sesion),
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

export const rebuildPorOpciones = onDocumentWritten('opciones/{campo}', (event) =>
  marcarRebuild(`opciones/${event.params.campo}`),
);

// ─────────────────────────────────────────────────────────────────
// §8 — debounce del rebuild: si se editan cinco campos seguidos no se
// disparan cinco builds.
// ─────────────────────────────────────────────────────────────────

export const dispararRebuild = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const ref = db.doc('sistema/rebuild');
    const snap = await ref.get();
    if (!snap.exists || snap.data().pendiente !== true) return;

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    if (!token || !repo) {
      // El paso 5 todavía no está armado. No es un error: es una pieza que
      // falta, y logearlo como error cada 5 minutos es ruido.
      logger.info('rebuild pendiente pero sin GitHub configurado (paso 5)');
      return;
    }

    const r = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'rebuild' }),
    });

    if (!r.ok) {
      // El flag queda en true a propósito: el próximo tick reintenta.
      logger.error('repository_dispatch falló', { status: r.status });
      return;
    }

    await ref.set({ pendiente: false, disparado: FieldValue.serverTimestamp() }, { merge: true });
    logger.info('rebuild disparado');
  },
);
