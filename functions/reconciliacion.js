/**
 * Lógica pura de la reconciliación con Calendar — la otra mitad de B-125
 * (D-293): qué sesiones hay que verificar contra la API y qué significa cada
 * respuesta. Sin red: quien llama a Calendar de verdad es
 * `scripts/verificar-calendario.mjs`, que es efecto y no se testea contra el
 * calendario real, mismo criterio que el resto del §7 (CLAUDE.md §10).
 *
 * ── Por qué esto no se cierra solo con lo que ya existe ──────────────────
 * `decidirAnteFallo` (`sincronizacion.js`, D-191) ya recrea un evento borrado a
 * mano el día que una escritura genuina dispara un `actualizar` que pega un
 * 404. Lo que NO hace, y es la mitad que quedaba de B-125, es enterarse **sin**
 * esa escritura: la vista calendario del panel sigue leyendo `calendarEventId`
 * del documento y asumiendo que eso es lo que Calendar tiene (D-71). Cerrar eso
 * pide preguntarle a la API, y la identidad para hacerlo es la de la Function
 * (D-06) — de ahí el script y no un botón del panel: no hay que sumar un
 * `onCall` nuevo (superficie de auth de más) cuando la vía ya sancionada por la
 * propia decisión es "el panel o un script".
 */
import { debeExistir } from './calendario.js';

/**
 * Tope de sesiones que se piden por corrida. Son llamadas de a una a
 * `events.get` (no hay un `batchGet` de Calendar v3 para leer), así que una
 * cuenta con muchas actividades publicadas se puede comer varios minutos —el
 * mismo motivo de `MAX_EVENTOS_RESYNC` en `index.js` (B-04). El resto queda
 * para la corrida siguiente: no hay nada que se pierda por dividir en lotes,
 * a diferencia de una operación de escritura a mitad de camino.
 */
export const MAX_VERIFICACION_POR_CORRIDA = 200;

/**
 * Las sesiones cuyo estado publicado depende de un dato que nadie comparó
 * contra la realidad: la actividad las da por publicadas (`debeExistir`) y el
 * documento tiene un `calendarEventId`, pero ese id puede estar mintiendo si
 * alguien borró el evento a mano en Calendar (B-125). Es la mitad de la tabla
 * de `estadoPublicacion` (`calendarioPanel.ts`) que hoy se **asume**:
 * `debería=sí, existe=sí` porque el campo dice que sí, no porque se haya
 * comprobado.
 *
 * No se incluyen las sesiones donde `debeExistir` es `false`: si el evento no
 * debería estar, que sobre o no un id colgado es un problema de escritura
 * (`sobra-en-calendario`, que se corrige solo en el próximo sync con
 * operaciones), no de un borrado externo — no hay nada que "verificar" ahí
 * porque la fuente de verdad para ese caso es el documento, no Calendar.
 *
 * Devuelve como mucho `MAX_VERIFICACION_POR_CORRIDA` candidatas, y si hubo más
 * de las que entraron (`truncado`), devuelve también `siguienteCursor`: el id
 * de la última actividad que sí se procesó entera, para que la corrida
 * siguiente pueda arrancar **después** de esa (con `.startAfter` en la query
 * de Firestore) en vez de repetir siempre las mismas primeras
 * `MAX_VERIFICACION_POR_CORRIDA` — lo encontró el `auditor-trampas`: sin esto,
 * "correr de nuevo" no avanzaba nunca, así que una sesión borrada a mano más
 * allá del tope no se detectaba jamás, sin que nada lo dijera.
 *
 * **El corte es por actividad, no por sesión**, a propósito: así el cursor es
 * exacto (la próxima corrida arranca en una actividad que todavía no se tocó,
 * nunca a mitad de una) y ninguna sesión queda ni repetida ni salteada entre
 * corridas. Puede exceder el tope por hasta las sesiones de una actividad
 * (en la práctica, ~8 — el ciclo del §2.2), que es preferible a partir una
 * actividad entre dos corridas.
 */
export const sesionesAVerificar = (actividades) => {
  const candidatas = [];
  let ultimaActividadIncluida = null;
  let truncado = false;

  for (const actividad of actividades ?? []) {
    if (candidatas.length >= MAX_VERIFICACION_POR_CORRIDA) {
      truncado = true;
      break;
    }
    let aporto = false;
    for (const sesion of actividad.sesiones ?? []) {
      if (sesion.calendarEventId && debeExistir(actividad, sesion)) {
        candidatas.push({ actividadId: actividad.id, actividad, sesion });
        aporto = true;
      }
    }
    if (aporto) ultimaActividadIncluida = actividad.id;
  }

  return { candidatas, truncado, siguienteCursor: truncado ? ultimaActividadIncluida : null };
};

/**
 * Los mismos códigos con que Calendar dice "ese evento no está" que usa
 * `decidirAnteFallo` (`sincronizacion.js`, B-125/D-191): 404 si nunca existió o
 * el id se liberó, 410 si está borrado y todavía retenido.
 */
const NO_ESTA = [404, 410];

/**
 * ¿Qué dice una respuesta de `events.get` sobre si el evento existe de
 * verdad?
 *
 * `respuesta` es `{ ok: true, status }` para un `events.get` que no tiró (el
 * `status` del evento, que Calendar puede dar `'cancelled'` para uno recién
 * borrado en vez de un 404 directo), o `{ ok: false, code }` para uno que
 * tiró.
 *
 * **Solo 404/410 se interpretan como "no está".** Cualquier otro código —403
 * por un permiso que cambió, una cuota, un timeout de red— no dice nada
 * concluyente sobre el evento puntual: es el mismo criterio de
 * `decidirAnteFallo`, que tampoco trata un código ambiguo como "no está".
 * Afirmarlo con un error así generaría una reparación (recrear el evento)
 * sobre una sospecha, y un evento recreado sin necesidad es peor que no
 * decir nada — quedaría un duplicado el día que el 403 se debía a una demora
 * pasajera y el evento seguía estando.
 */
export const interpretarExistencia = (respuesta) => {
  if (respuesta?.ok) {
    // Un evento 'cancelled' es, al efecto público, lo mismo que borrado: sigue
    // en la papelera de Calendar pero nadie lo ve. `events.delete` normalmente
    // da 404/410 en una lectura posterior, pero Calendar puede devolver 200
    // con `status: 'cancelled'` en su lugar — sobre todo si el evento se
    // acaba de borrar y todavía no se purgó del todo.
    return respuesta.status === 'cancelled' ? 'no-existe' : 'existe';
  }
  return NO_ESTA.includes(Number(respuesta?.code)) ? 'no-existe' : 'desconocido';
};

/**
 * Separa las candidatas verificadas en las que hay que reparar (recrear) y
 * las que no se pudieron verificar de forma concluyente.
 *
 * `resultados` es un `Map` de `sesion.id` → `'existe' | 'no-existe' |
 * 'desconocido'` (la salida de `interpretarExistencia` por candidata). Una
 * candidata sin entrada en el mapa (no se llegó a verificar, por ejemplo si
 * el proceso se cortó a mitad de camino) se trata como `'desconocido'`: no
 * reparar es la falla segura.
 */
export const planificarReparacion = (candidatas, resultados) => {
  const reparar = [];
  const desconocidos = [];
  for (const c of candidatas) {
    const r = resultados.get(c.sesion.id) ?? 'desconocido';
    if (r === 'no-existe') reparar.push(c);
    else if (r === 'desconocido') desconocidos.push(c);
  }
  return { reparar, desconocidos };
};
