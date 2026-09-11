/**
 * Lógica pura del trigger de rebuild (§8). Sin dependencias de Firebase, de
 * red ni del reloj: el "cuándo" entra como parámetro.
 *
 * Está separada de `index.js` por el mismo criterio que `calendario.js`: el
 * corte por intentos y el backoff son reglas de tiempo, y testearlas contra la
 * Function desplegada significaría esperar horas para ver un solo caso.
 *
 * Lo único que importa es `milisDe`, que es puro y vive en `calendario.js`
 * porque de los dos archivos ese es el que ya comparte el panel (D-20). Acá
 * había una copia idéntica salvo el respaldo; ver el comentario de `milisDe`.
 */
import { milisDe } from './calendario.js';

/**
 * ── Qué significa hoy `pendiente`, y qué debería significar — B-884 ────────
 *
 * El nombre promete **«hay un cambio sin publicar»**. Lo que el código
 * implementa es **«hay un cambio sin despachar»**, y no es lo mismo: el flag se
 * baja cuando GitHub **acepta** el `repository_dispatch`, que es un workflow
 * entero antes de que el sitio tenga el cambio.
 *
 *   marcarRebuild → dispararRebuild → GitHub acepta → ¿arranca el workflow? →
 *   ¿pasan los tests? → ¿buildea? → ¿deploya? → el sitio tiene el cambio
 *                          ↑
 *                          acá se baja `pendiente`
 *
 * `registrarExito` deja el flag arriba **solo** si llegó una marca nueva
 * durante el dispatch (B-85). De ahí en adelante no mira nada: si el build
 * muere —el workflow no arranca, los tests fallan, el deploy se cae— **nadie
 * reintenta y el documento dice que está todo bien**.
 *
 * Los únicos tres lugares que escriben `pendiente` son `marcarRebuild`,
 * `registrarFallo` y `registrarExito`, y ninguno de los tres conoce el
 * resultado del build. **No hay ningún camino por el que un build fallido
 * vuelva a levantar el flag**, y eso incluye a `deploy.yml`: los dos jobs que
 * B-883 le agregó —abrir y cerrar el issue `deploy-roto`— corren con
 * `permissions: contents: read, issues: write` y sin la service account, así
 * que no tocan Firestore.
 *
 * **B-883 y esto son mitades distintas del mismo 2026-09-11.** Aquél hace que
 * un build roto llegue a **una persona**; esto es que el **estado** sigue
 * diciendo que está todo bien. Con el issue abierto, alguien se entera y
 * pushea; si nadie pushea —porque el fallo fue transitorio y ya pasó— el sitio
 * se queda viejo hasta la próxima edición de contenido, porque `pendiente`
 * está en `false` y el schedule no tiene nada que disparar. Y hay un caso que
 * el issue tampoco cubre: si el workflow **no arranca**, `avisar` tampoco
 * corre, porque cuelga de `needs: [deploy]`.
 *
 * Y el corte es más temprano de lo que parece: `repository_dispatch` contesta
 * 204 sin decir qué run arrancó, y contesta 204 igual si el workflow **no
 * corre** —el archivo no parsea (trampa 11, B-188), Actions está desactivado—.
 * «GitHub aceptó» no es siquiera «el build arrancó».
 *
 * **Lo tapa el volumen.** Cada edición marca un rebuild, así que ocho
 * actividades cargadas seguidas dan ocho disparos y ocho oportunidades de que
 * alguno de los builds sea el bueno. Con **una sola** actividad no hay octava
 * oportunidad, y eso es lo que pasó el 2026-09-11.
 *
 * **Lo que falta para que el nombre sea cierto** es una confirmación desde el
 * otro lado —comparar lo publicado en Firestore contra el `events.json` vivo—
 * y eso no vive acá. Lo que sí vive acá es la mitad que la hace posible: el
 * despacho deja escrito **qué** cubre (`despacho.cubreHasta`) y **cuándo**
 * salió (`disparado`). Hasta que alguien compare, `pendiente: false` hay que
 * leerlo como «despachado», nunca como «publicado».
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
 * número o nada. Es `milisDe` de `calendario.js`, importada y no copiada: el
 * alias local existe solo para no tocar los seis usos de abajo.
 */
const milis = milisDe;

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
 *
 * **B-85 — `pendiente` no se baja a ciegas.** El tick lee el documento, habla
 * con GitHub (hasta 15 s de timeout) y después escribe. Una actividad guardada
 * en esa ventana marca su rebuild, y bajar el flag sin mirar se lo comía: el
 * build que arrancó no la incluye y ya nadie iba a pedir otro, así que el sitio
 * quedaba viejo hasta la próxima edición ajena.
 *
 * `marcaLeida` y `marcaActual` son el `actualizado` del documento cuando el
 * tick lo leyó y ahora, en la transacción que escribe. Si difieren, alguien
 * marcó un rebuild nuevo en el medio y `pendiente` queda en `true` para que el
 * próximo tick lo dispare. El resto se resetea igual: el disparo **sí** salió
 * bien, así que los reintentos vuelven a cero.
 *
 * Sin argumentos se comporta como antes (baja el flag), que es lo que
 * corresponde cuando no hay con qué comparar.
 *
 * **B-884 — el despacho deja registrado qué cubre.** `despacho.cubreHasta` es
 * la marca `actualizado` que el tick leyó **antes** de hablar con GitHub, y
 * `despacho.motivo` la etiqueta que viajó en el `client_payload`. El par
 * `(despacho, disparado)` es el «qué» y el «cuándo» del último disparo, y es el
 * comparable que hoy no existía: `disparado` solo decía cuándo, y `motivo` —el
 * de arriba del documento— lo pisa la marca siguiente.
 *
 * **El ancla es la marca leída y no la actual, a propósito.** El build que
 * arranca lee Firestore *después* del dispatch, así que cubre **al menos** todo
 * lo marcado hasta `marcaLeida`; anclar en `marcaActual` afirmaría que cubre un
 * cambio que puede no haber entrado — que es B-85 otra vez, un nivel más
 * arriba, con el agravante de que esta vez la afirmación falsa se la cree el
 * que venga a confirmar.
 *
 * Esto **no confirma nada**: es el comparable para que otro pueda confirmar
 * (ver el bloque de arriba). Va en el mismo objeto que baja `pendiente`, así
 * que el flag no se puede bajar sin dejar dicho qué tendría que estar
 * publicado.
 */
export const registrarExito = (ahora, { marcaLeida, marcaActual, motivo } = {}) => ({
  pendiente: milis(marcaActual) !== milis(marcaLeida),
  disparado: new Date(ahora),
  intentos: 0,
  ultimoError: null,
  ultimoIntento: new Date(ahora),
  agotado: false,
  // `?? null` y no el valor a secas: Firestore rechaza `undefined`, y acá llega
  // `undefined` cada vez que el documento no tiene `actualizado` todavía.
  despacho: { cubreHasta: marcaLeida ?? null, motivo: motivo ?? null },
});

/**
 * Qué tiene que contener, como mínimo, el sitio vivo — en milisegundos, o
 * `null` si no hay ancla.
 *
 * Es la mitad de este módulo del chequeo de frescura (B-884): quien compare el
 * `events.json` publicado contra Firestore necesita un piso contra el cual
 * comparar, y hasta acá el documento no tenía ninguno. Normaliza porque el
 * valor guardado es el `actualizado` tal como se leyó —un `Timestamp` de
 * Firestore hoy, un `Date` o un número en un documento escrito a mano—.
 *
 * **`null` no significa «está al día»**: significa que este documento no
 * alcanza para juzgarlo, y el que confirme tiene que tratarlo como «no sé», no
 * como «sí». Pasa con un `sistema/rebuild` anterior a B-884 y con uno que
 * nunca se marcó.
 */
export const cubiertoPorElUltimoDespacho = (estado) => milis(estado?.despacho?.cubreHasta);

/**
 * Campos a escribir cuando falló. `pendiente` queda en `true`: el sitio sigue
 * desactualizado, y eso no lo arregla haber fallado.
 *
 * El error queda en el documento y no solo en los logs porque los logs de
 * Cloud Functions se retienen 30 días y nadie los mira: `sistema/rebuild` es
 * un solo doc que dice, ahora mismo, si el rebuild está roto y por qué.
 *
 * **No toca `despacho` (B-884).** Un disparo que falló no despachó nada, así
 * que no mueve el ancla: el último despacho que sí salió sigue siendo el que
 * describe qué tendría que estar publicado.
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
 *
 * **Lo que rearma es el contador, no el registro (B-884).** `despacho` no está
 * acá a propósito: una marca nueva no invalida lo que el último despacho
 * cubría, y borrarlo le sacaría el piso al que venga a confirmar justo cuando
 * más lo necesita — cuando hay un cambio encima de un build que quizá no
 * llegó.
 */
export const CAMPOS_REARME = { intentos: 0, ultimoError: null, agotado: false };
