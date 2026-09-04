/**
 * B-77 — el cliente de la API de Calendar: autenticación y creación de eventos.
 *
 * Es el pegamento con `googleapis`, y lo comparten los dos triggers del lado de
 * Calendar (`calendario-trigger.js` y `opciones-trigger.js`). La lógica de qué
 * evento mandar es pura y vive en `calendario.js` (§7.2); acá está lo que habla
 * con la red.
 *
 * `crearEvento` está en este archivo y no en el trigger a propósito: la
 * idempotencia de B-82 —el id elegido por el cliente y el 409 que la sostiene—
 * es una regla del cliente de Calendar, no del trigger, y la usan también las
 * reparaciones de `decidirAnteFallo`.
 */
import { logger } from 'firebase-functions/v2';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { idDeEvento } from './sincronizacion.js';

export const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

/**
 * §2.6 — service account, sin OAuth ni refresh tokens.
 *
 * Desvío respecto del documento: en vez de una key de service account, la
 * Function CORRE como la service account (`calendar-sync@…`) y toma el token de
 * las credenciales de su propio runtime. Mismo resultado, sin una key que
 * guardar, rotar ni filtrar. El setup del calendario es idéntico: compartirlo
 * con el mail de la service account dándole "Realizar cambios en los eventos".
 */
let _calendar = null;
export const calendario = async () => {
  if (_calendar) return _calendar;
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
  _calendar = google.calendar({ version: 'v3', auth: await auth.getClient() });
  return _calendar;
};

/**
 * Crea el evento de una sesión y devuelve el id que quedó en Calendar.
 *
 * B-82 — el id lo elige el cliente (`idDeEvento`), derivado del id de sesión.
 * Así un `insert` repetido —una reentrega del mismo evento de Firestore, que la
 * plataforma garantiza *al menos una vez*— choca con el que ya existe y devuelve
 * 409 en lugar de crear un segundo evento en el calendario público.
 */
export const crearEvento = async (cal, op) => {
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
