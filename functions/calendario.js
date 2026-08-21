/**
 * Lógica pura del sync a Calendar (§7). Sin dependencias de Firebase ni de
 * red: así el diff —que es la parte frágil del sistema— se puede testear sin
 * emuladores ni tocar un calendario real.
 */

export const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * §7.1 — Campos de la actividad que afectan al evento de Calendar.
 *
 * `sesiones` NO está en la lista, y es a propósito: la Function escribe
 * `calendarEventId` dentro de `sesiones`, esa escritura vuelve a disparar la
 * Function, y comparar el array completo la haría verse siempre como un
 * cambio → recursión y 20 eventos duplicados. Las sesiones se comparan
 * aparte, subcampo por subcampo, con `sesionCambio`.
 */
export const CAMPOS_ACTIVIDAD = ['titulo', 'descripcion', 'estado', 'sede', 'modalidad'];

/** Subcampos de una sesión que sí cambian el evento. `calendarEventId` no. */
export const CAMPOS_SESION = ['inicio', 'fin', 'tema', 'cancelada'];

/** Serializa un valor para comparar. Normaliza Timestamp y Date a milisegundos. */
const comparable = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return v;
};

const iguales = (a, b) =>
  JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));

/** ¿Cambió algún campo de la actividad que afecte a todos sus eventos? */
export const actividadCambio = (antes, despues) =>
  CAMPOS_ACTIVIDAD.some((f) => !iguales(antes?.[f], despues?.[f]));

/** ¿Cambió esta sesión en algo que afecte a su evento? */
export const sesionCambio = (antes, despues) =>
  CAMPOS_SESION.some((f) => !iguales(antes?.[f], despues?.[f]));

const porId = (sesiones = []) => new Map(sesiones.map((s) => [s.id, s]));

/**
 * §7.3 — Una sesión tiene evento en el calendario solo si la actividad está
 * publicada y la sesión no está cancelada.
 */
const debeExistir = (actividad, sesion) =>
  actividad?.estado === 'publicado' && !sesion.cancelada;

/**
 * §7.2 — Diff por id de sesión. Devuelve las operaciones a aplicar, sin
 * ejecutarlas.
 *
 * Se resuelve por id y nunca por índice: si se usara el índice, borrar la
 * sesión 3 renumera el array y el diff creería que cambiaron cinco encuentros
 * en vez de uno, borrando y recreando eventos que la gente ya tiene agendados
 * (y perdiendo sus recordatorios).
 */
export const planificar = (antes, despues) => {
  const ops = [];
  const sesionesAntes = porId(antes?.sesiones);
  const sesionesDespues = porId(despues?.sesiones);

  // La actividad se borró por completo: se van todos sus eventos.
  if (!despues) {
    for (const [id, s] of sesionesAntes) {
      if (s.calendarEventId) ops.push({ tipo: 'borrar', id, eventId: s.calendarEventId });
    }
    return ops;
  }

  // Sesiones eliminadas del array.
  for (const [id, s] of sesionesAntes) {
    if (!sesionesDespues.has(id) && s.calendarEventId) {
      ops.push({ tipo: 'borrar', id, eventId: s.calendarEventId });
    }
  }

  // Un cambio de sede o de título tiene que propagarse a las N sesiones del
  // ciclo (trampa 9): por eso se calcula una vez y se aplica a todas.
  const cambioGlobal = actividadCambio(antes, despues);

  for (const [id, sesion] of sesionesDespues) {
    const previa = sesionesAntes.get(id);
    const eventId = previa?.calendarEventId ?? sesion.calendarEventId ?? null;

    if (!debeExistir(despues, sesion)) {
      // Pasó a borrador/cancelado, o se canceló el encuentro.
      if (eventId) ops.push({ tipo: 'borrar', id, eventId });
      continue;
    }

    if (!eventId) {
      ops.push({ tipo: 'crear', id, sesion });
      continue;
    }

    if (cambioGlobal || sesionCambio(previa, sesion)) {
      ops.push({ tipo: 'actualizar', id, eventId, sesion });
    }
  }

  return ops;
};

/**
 * §7.4 — Cuerpo del evento.
 *
 * `timeZone` explícito y siempre: es el bug clásico de eventos corridos tres
 * horas (trampa 1).
 *
 * El link de la reunión NO va en la descripción: el calendario es público y
 * publicar un Zoom habilita zoombombing (trampa 5).
 */
export const construirEvento = (actividad, sesion) => {
  const aIso = (t) => (typeof t.toDate === 'function' ? t.toDate() : new Date(t)).toISOString();

  const partes = [actividad.descripcion];
  if (sesion.lectura) partes.push(`Lectura: ${sesion.lectura}`);
  if (actividad.inscripcion?.requiere && actividad.inscripcion.destino) {
    partes.push(`Inscripción: ${actividad.inscripcion.destino}`);
  }

  return {
    summary: actividad.titulo + (sesion.tema ? ` — ${sesion.tema}` : ''),
    description: partes.filter(Boolean).join('\n\n'),
    location: actividad.sede?.direccion || undefined,
    start: { dateTime: aIso(sesion.inicio), timeZone: TIMEZONE },
    end: { dateTime: aIso(sesion.fin), timeZone: TIMEZONE },
  };
};
