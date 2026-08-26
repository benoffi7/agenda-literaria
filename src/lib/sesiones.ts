import type { SesionForm } from '@/types/actividad';

/**
 * §7.2 / trampa 2 — los ids de sesión se generan al crear la fila del
 * formulario, NUNCA por índice del array. Si se usa el índice, borrar la
 * sesión 3 renumera todo y el diff contra Calendar cree que cambiaron cinco
 * encuentros en vez de uno.
 */
export const nuevaSesionId = (): string => {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : // Fallback para contextos sin crypto.randomUUID (no debería pasar en
        // localhost ni en https, pero no queremos ids colisionables).
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `ses_${uuid}`;
};

const DOS_HORAS_MS = 2 * 60 * 60 * 1000;

/** `Date` → string apto para `<input type="datetime-local">`, en hora local. */
export const aDatetimeLocal = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

/** String de `datetime-local` → `Date` en hora local del navegador. */
export const deDatetimeLocal = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const sesionVacia = (inicio?: Date, duracionMs = DOS_HORAS_MS): SesionForm => {
  const desde = inicio ?? new Date();
  return {
    id: nuevaSesionId(),
    inicio: aDatetimeLocal(desde),
    fin: aDatetimeLocal(new Date(desde.getTime() + duracionMs)),
    tema: '',
    lectura: '',
    cancelada: false,
    calendarEventId: null,
  };
};

/** Duplica una sesión conservando datos pero con id nuevo y una semana después. */
export const duplicarSesion = (s: SesionForm, cadaDias = 7): SesionForm => {
  const inicio = deDatetimeLocal(s.inicio);
  const fin = deDatetimeLocal(s.fin);
  const salto = cadaDias * 24 * 60 * 60 * 1000;
  return {
    ...s,
    id: nuevaSesionId(),
    inicio: inicio ? aDatetimeLocal(new Date(inicio.getTime() + salto)) : s.inicio,
    fin: fin ? aDatetimeLocal(new Date(fin.getTime() + salto)) : s.fin,
    cancelada: false,
    // El id de Calendar es de la sesión original: la copia todavía no existe allá.
    calendarEventId: null,
  };
};

/**
 * §11 — "generar N encuentros semanales" ahorra mucho tipeo, pero las fechas
 * resultantes quedan editables una por una: los ciclos siempre tienen
 * excepciones (un feriado, una semana que se corre).
 *
 * No usa RRULE ni eventos recurrentes de Calendar (§2.2): siempre lista
 * explícita de sesiones.
 */
export const generarSesiones = (opts: {
  cantidad: number;
  inicio: string;
  duracionMinutos: number;
  cadaDias?: number;
  /**
   * Las sesiones que se están reemplazando. La fila generada en la posición N
   * hereda el `id` y el `calendarEventId` de la que ocupaba esa posición.
   *
   * B-90 — sin esto, regenerar los encuentros de un ciclo **ya publicado**
   * daba ocho ids nuevos y el diff del §7.2 no reconocía ninguno: ocho
   * `borrar` y ocho `crear` contra el calendario, o sea "perder los
   * recordatorios y las suscripciones de la gente", que es exactamente lo que
   * ese diff existe para evitar. Reusando el id, el mismo cambio son ocho
   * `actualizar`: al suscripto se le mueve la fecha del evento, que es lo que
   * pasó de verdad.
   *
   * Si la cantidad cambia, se reusa lo que se superpone: generar 10 sobre 8
   * son 8 actualizaciones y 2 altas; generar 6 sobre 8, 6 actualizaciones y 2
   * bajas.
   */
  previas?: readonly SesionForm[];
}): SesionForm[] => {
  const { cantidad, inicio, duracionMinutos, cadaDias = 7, previas = [] } = opts;
  const primera = deDatetimeLocal(inicio);
  if (!primera || cantidad < 1) return [];

  const saltoMs = cadaDias * 24 * 60 * 60 * 1000;
  const duracionMs = duracionMinutos * 60 * 1000;

  return Array.from({ length: cantidad }, (_, i) => {
    // Se recalcula desde la primera fecha en cada paso para no acumular
    // desvíos, y con Date local para que un cambio de horario de verano no
    // corra el horario del encuentro.
    const arranque = new Date(primera.getTime() + saltoMs * i);
    const previa = previas[i];
    return {
      // El id se hereda por posición, pero **nunca se deriva del índice**
      // (trampa 2): el de una fila nueva sigue siendo un uuid de cliente.
      id: previa?.id ?? nuevaSesionId(),
      inicio: aDatetimeLocal(arranque),
      fin: aDatetimeLocal(new Date(arranque.getTime() + duracionMs)),
      /**
       * B-176 — el contenido de la fila **se conserva**. Lo que el generador
       * recalcula son las fechas, y nada más.
       *
       * Devolvía `''` en las tres, así que regenerar un club de ocho encuentros
       * borraba las ocho lecturas asignadas, que es lo más caro de tipear de toda
       * la actividad. Venía de cuando el generador reemplazaba la lista entera;
       * desde D-103 la fila **conserva su identidad** —el encuentro 3 sigue siendo
       * el 3, con su evento de calendario— y perder su tema dejó de tener sentido.
       *
       * `cancelada` va con los otros dos, y el ítem no lo nombraba: pisarlo a
       * `false` **recrea el evento en el calendario de todo el que esté
       * suscripto**. Es la asimetría de D-124 otra vez — destildar a mano cuesta
       * un click, y un evento que reaparece en la agenda de otros no se deshace.
       * Si la fila no existía antes, nace en `false`, que es lo correcto.
       */
      tema: previa?.tema ?? '',
      lectura: previa?.lectura ?? '',
      cancelada: previa?.cancelada ?? false,
      // Va con el id: sin él, el diff vería una sesión conocida sin evento y
      // crearía un segundo evento para el mismo encuentro.
      calendarEventId: previa?.calendarEventId ?? null,
    };
  });
};

/** Duración en minutos de una sesión, para prellenar el generador. */
export const duracionMinutos = (s: SesionForm): number => {
  const a = deDatetimeLocal(s.inicio);
  const b = deDatetimeLocal(s.fin);
  if (!a || !b) return 120;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
};

/** Ordena por fecha de inicio. Las sesiones se muestran cronológicamente. */
export const ordenarPorInicio = (sesiones: SesionForm[]): SesionForm[] =>
  [...sesiones].sort((a, b) => a.inicio.localeCompare(b.inicio));

/**
 * `Timestamp` de Firestore → `Date`, o `null` si no hay una fecha usable.
 *
 * Vive acá porque es la conversión de la trampa 1 y este módulo es el hogar de
 * las conversiones de fecha. Estaba copiada, idéntica y privada, en
 * `calendarioPanel.ts` y en `filtrosActividades.ts`: el día que una de las dos
 * aceptara algo más —un `Date` crudo, un ISO de `duplicar`— el listado y el
 * calendario habrían discrepado sobre **cuáles sesiones existen**, sin error.
 */
export const instanteDeTimestamp = (valor: unknown): Date | null => {
  const fecha =
    valor && typeof (valor as { toDate?: unknown }).toDate === 'function'
      ? (valor as { toDate: () => Date }).toDate()
      : null;
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
};

/**
 * Fecha y hora cortas, en la zona del proyecto, para mostrar en el panel.
 *
 * Vive acá por el mismo motivo que `instanteDeTimestamp`: este módulo es el
 * hogar de las conversiones de fecha, y el `timeZone` explícito es el que evita
 * la trampa 1 también al mostrar. Sin esto, quien mira desde otra zona ve la
 * hora de su navegador y no la del encuentro.
 */
export const fechaHoraCorta = (d: Date): string =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d);
