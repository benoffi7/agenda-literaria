/**
 * Lógica pura del trigger de rebuild (§8). Sin dependencias de Firebase, de
 * red ni del reloj: el "cuándo" entra como parámetro.
 *
 * Está separada de `index.js` por el mismo criterio que `calendario.js`: el
 * corte por intentos y el backoff son reglas de tiempo, y testearlas contra la
 * Function desplegada significaría esperar horas para ver un solo caso.
 */

/**
 * Cuántos disparos fallidos consecutivos se toleran antes de rendirse.
 *
 * Con el backoff de abajo, 5 intentos cubren ~75 minutos (0 + 5 + 10 + 20 +
 * 40). Una caída de GitHub más corta que eso se resuelve sola; una más larga
 * necesita un cambio nuevo o un disparo manual, y para eso está el registro en
 * el documento.
 */
export const MAX_INTENTOS = 5;

/**
 * Base del backoff exponencial: el propio período del schedule.
 *
 * El schedule tickea cada 5 minutos igual; el backoff no cambia eso, decide en
 * qué ticks se intenta. Reintentar cada 5 minutos para siempre contra un PAT
 * vencido son ~288 llamadas por día que van a fallar todas.
 */
export const ESPERA_BASE_MS = 5 * 60 * 1000;

/** Recorta el error antes de guardarlo: GitHub puede contestar un HTML entero. */
const LARGO_MAX_ERROR = 300;

/**
 * Normaliza a milis lo que puede venir como Timestamp de Firestore, Date,
 * número o nada. Mismo criterio que `calendario.js` con `toDate`.
 */
const milis = (t) => {
  if (t == null) return null;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const intentosDe = (estado) => {
  const n = Number(estado?.intentos);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Cuánto hay que esperar desde el último intento antes de volver a probar. */
export const esperaMs = (intentos, esperaBaseMs = ESPERA_BASE_MS) =>
  intentos <= 0 ? 0 : esperaBaseMs * 2 ** (intentos - 1);

/**
 * Decide qué hacer en un tick del schedule.
 *
 * Devuelve `{ accion: 'disparar' }` o `{ accion: 'esperar', motivo }`, nunca
 * hace nada por sí sola. Los motivos de espera son distinguibles a propósito:
 * `index.js` loguea cada uno con el nivel que le corresponde.
 */
export const decidirDisparo = (estado, ahora, opciones = {}) => {
  const { maxIntentos = MAX_INTENTOS, esperaBaseMs = ESPERA_BASE_MS } = opciones;

  if (estado?.pendiente !== true) return { accion: 'esperar', motivo: 'sin-pendiente' };

  const intentos = intentosDe(estado);

  // `agotado` es el flag explícito; la comparación con el máximo es la red de
  // contención si el documento quedó a medio escribir o si el límite bajó.
  if (estado.agotado === true || intentos >= maxIntentos) {
    return { accion: 'esperar', motivo: 'agotado', intentos };
  }

  const desde = milis(estado.ultimoIntento);
  const espera = esperaMs(intentos, esperaBaseMs);
  // Sin `ultimoIntento` no hay de dónde medir: se intenta. Es el caso del
  // primer disparo y el de un documento escrito por una versión anterior.
  if (desde != null && espera > 0) {
    const restanteMs = desde + espera - ahora;
    if (restanteMs > 0) return { accion: 'esperar', motivo: 'backoff', intentos, restanteMs };
  }

  return { accion: 'disparar', intento: intentos + 1 };
};

/**
 * Campos a escribir cuando el `repository_dispatch` salió bien.
 *
 * Acá se resetea el contador: el camino normal de vuelta a cero es que el
 * problema se resuelva y el disparo funcione.
 */
export const registrarExito = (ahora) => ({
  pendiente: false,
  disparado: new Date(ahora),
  intentos: 0,
  ultimoError: null,
  ultimoIntento: new Date(ahora),
  agotado: false,
});

/**
 * Campos a escribir cuando falló. `pendiente` queda en `true`: el sitio sigue
 * desactualizado, y eso no lo arregla haber fallado.
 *
 * El error queda en el documento y no solo en los logs porque los logs de
 * Cloud Functions se retienen 30 días y nadie los mira: `sistema/rebuild` es
 * un solo doc que dice, ahora mismo, si el rebuild está roto y por qué.
 */
export const registrarFallo = (estado, error, ahora, opciones = {}) => {
  const { maxIntentos = MAX_INTENTOS } = opciones;
  const intentos = intentosDe(estado) + 1;
  return {
    pendiente: true,
    intentos,
    ultimoError: String(error ?? 'error sin mensaje').slice(0, LARGO_MAX_ERROR),
    ultimoIntento: new Date(ahora),
    agotado: intentos >= maxIntentos,
  };
};

/**
 * Campos que rearman el contador al marcar un rebuild nuevo (§8).
 *
 * Es el segundo camino de vuelta a cero, y el que hace que el sistema se
 * recupere solo: si los reintentos se agotaron con el PAT vencido, la próxima
 * edición de una actividad —después de renovarlo— vuelve a tener sus 5
 * intentos sin que nadie toque el documento a mano.
 *
 * El presupuesto es por cambio, no global: aunque el problema persista, cada
 * cambio gasta a lo sumo `MAX_INTENTOS` llamadas, no infinitas.
 */
export const CAMPOS_REARME = { intentos: 0, ultimoError: null, agotado: false };
