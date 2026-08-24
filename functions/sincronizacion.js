/**
 * Lógica pura del *trigger* de sync a Calendar: lo que no es el diff.
 *
 * El diff en sí (`planificar`, `construirEvento`, `debeExistir`) vive en
 * `calendario.js`, que además comparte el panel por el alias `@calendario`
 * (D-20). Acá viven las reglas que solo le importan a la Function:
 *
 *  - de dónde sale el id del evento de Calendar (idempotencia, B-82);
 *  - qué `calendarEventId` queda escrito en el documento después de
 *    sincronizar (B-80);
 *  - qué eventos hay que reescribir cuando se renombra una etiqueta de
 *    taxonomía (B-04).
 *
 * Sin dependencias de Firebase ni de red, mismo criterio que `calendario.js` y
 * `rebuild.js`: la parte frágil del sistema se testea sin emuladores y sin
 * tocar un calendario real.
 */
import { construirEvento, debeExistir } from './calendario.js';

/**
 * §3.1 — forma documentada del id de sesión: `ses_<uuid>`, generado en el
 * cliente (`nuevaSesionId`).
 *
 * Los guiones del uuid están en posiciones fijas, así que sacarlos es
 * **inyectivo**: dos ids de sesión distintos nunca dan el mismo id de evento.
 * Eso es lo que hace segura la derivación de abajo.
 */
const FORMA_ID_SESION =
  /^ses_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Alfabeto que exige la API de Calendar para un id elegido por el cliente:
 * base32hex (RFC 2938 §3.1.2), o sea `0-9a-v`, entre 5 y 1024 caracteres.
 *
 * Se exporta para que el test lo verifique contra ids reales en vez de
 * confiar en que la cuenta dé: `ses_` + un uuid sin guiones son 35 caracteres
 * de `0-9a-f`, que es un subconjunto del alfabeto.
 */
export const ALFABETO_ID_CALENDAR = /^[0-9a-v]{5,1024}$/;

/**
 * B-82 — Id del evento de Calendar derivado del id de sesión.
 *
 * **Por qué el id lo elige el cliente.** La entrega de eventos de Firestore es
 * *al menos una vez*, y `syncCalendar` decide con el payload del evento
 * (`before`/`after`), no con el estado del documento: una reentrega de la
 * escritura que publicó una actividad vuelve a emitir `crear`. Con un id
 * elegido por nosotros, ese segundo `insert` choca contra el que ya existe y
 * Calendar contesta **409** en lugar de crear un segundo evento. La
 * idempotencia queda en el sistema externo, que es donde tiene que estar: no
 * depende de que la Function lleve la cuenta de nada.
 *
 * Devuelve `null` si el id de sesión no tiene la forma documentada —por
 * ejemplo el respaldo sin `crypto.randomUUID` de `nuevaSesionId`, que usa
 * base36 y tiene letras fuera del alfabeto—. En ese caso el `insert` va sin
 * id y lo elige Google, que es el comportamiento de siempre: se pierde la
 * idempotencia para esa sesión, no la sincronización.
 *
 * **Compatible hacia atrás:** los eventos que ya existen conservan el id que
 * les dio Google. El diff los sigue encontrando por el `calendarEventId`
 * guardado en el documento; esta derivación solo decide el id de los que se
 * crean de ahora en adelante.
 */
export const idDeEvento = (sesionId) => {
  const id = String(sesionId ?? '').toLowerCase();
  if (!FORMA_ID_SESION.test(id)) return null;
  const candidato = id.replace(/[_-]/g, '');
  // Redundante con la forma de arriba, y a propósito: si algún día se afloja
  // el formato del id de sesión, esto falla acá y no con un 400 de Calendar.
  return ALFABETO_ID_CALENDAR.test(candidato) ? candidato : null;
};

/**
 * B-80 — El array de sesiones con los `calendarEventId` que dejó el sync,
 * o `null` si no hay nada que escribir.
 *
 * `ids` va por id de sesión: el id del evento, o `null` si se borró.
 *
 * **Por qué también las ops `actualizar`.** El panel es dueño de un campo que
 * escribe la Function: `formADocumento` emite `calendarEventId` en cada
 * guardado, y si el listado se refrescó *antes* del write-back, ese guardado
 * lo pisa con `null`. El guardado en sí todavía actualiza el evento correcto
 * —`planificar` saca el id del `before`—, pero la edición siguiente ya no
 * tiene de dónde sacarlo y emite `crear`: dos eventos para el mismo encuentro
 * en el calendario público, y el primero huérfano.
 *
 * Reponiendo el id en **toda** operación (no solo en `crear` y `borrar`) el
 * documento se repara solo en la misma pasada que pisó el campo. Es del lado
 * de la Function a propósito: no depende de que el cliente se porte bien.
 *
 * Devolver `null` cuando nada cambió es parte del arreglo: en el caso normal
 * el documento ya tiene el id correcto, y escribirlo igual sería un disparo
 * más de esta misma Function por cada `actualizar`.
 */
export const reponerIds = (sesiones = [], ids) => {
  if (!ids || ids.size === 0) return null;

  let cambio = false;
  const repuestas = sesiones.map((sesion) => {
    if (!ids.has(sesion.id)) return sesion;
    const eventId = ids.get(sesion.id) ?? null;
    if ((sesion.calendarEventId ?? null) === eventId) return sesion;
    cambio = true;
    return { ...sesion, calendarEventId: eventId };
  });

  return cambio ? repuestas : null;
};

/** `/opciones/{campo}.valores` → `{ slug: label }`, como lo espera `construirEvento`. */
export const mapaDeEtiquetas = (valores = []) =>
  Object.fromEntries((valores ?? []).map((v) => [v.slug, v.label]));

/**
 * ¿Los dos mapas dicen lo mismo?
 *
 * No se comparan con `JSON.stringify`: el mapa se arma recorriendo el array
 * `valores`, así que reordenar las opciones —o agregar una nueva— cambia el
 * orden de las claves sin cambiar ninguna etiqueta. Y la escritura frecuente de
 * `/opciones/*` no es un renombre, es el `usos + 1` de `upsertOpcion` (§4.2),
 * que pasa en **cada** guardado del formulario: sin esta comparación, cada
 * guardado dispararía una re-sincronización completa del calendario.
 */
export const mismasEtiquetas = (antes = {}, despues = {}) => {
  const slugs = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  for (const slug of slugs) {
    if (antes[slug] !== despues[slug]) return false;
  }
  return true;
};

/**
 * B-04 — Los eventos de una actividad que hay que reescribir porque cambió una
 * etiqueta de taxonomía.
 *
 * La descripción y la ubicación del evento muestran la **etiqueta**, no el
 * slug (D-11). Renombrar "A la gorra" no toca ninguna actividad, así que sin
 * esto los eventos ya creados siguen diciendo lo anterior hasta la próxima
 * edición de cada actividad.
 *
 * No se puede resolver con `planificar`: recibe un solo juego de etiquetas y
 * compara el evento de `antes` contra el de `despues`, así que con la
 * actividad igual a los dos lados nunca ve diferencia. Acá la diferencia son
 * las **etiquetas**, no la actividad: se construye el mismo evento con el
 * mapa viejo y con el nuevo y se compara eso, que es el mismo criterio de
 * D-07 (comparar el payload, no una lista de campos).
 *
 * Solo emite `actualizar` de eventos que ya existen: crear o borrar es trabajo
 * del diff, y renombrar una etiqueta no cambia qué encuentros tienen que estar
 * en el calendario.
 */
export const replanificarPorEtiquetas = (actividad, labelsAntes, labelsDespues) => {
  const ops = [];
  for (const sesion of actividad?.sesiones ?? []) {
    if (!sesion.calendarEventId) continue;
    if (!debeExistir(actividad, sesion)) continue;

    const evento = construirEvento(actividad, sesion, labelsDespues);
    const anterior = construirEvento(actividad, sesion, labelsAntes);
    if (JSON.stringify(evento) === JSON.stringify(anterior)) continue;

    ops.push({ tipo: 'actualizar', id: sesion.id, eventId: sesion.calendarEventId, evento });
  }
  return ops;
};
