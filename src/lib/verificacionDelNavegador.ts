/**
 * **¿Pudimos verificar este navegador?** — B-930, reportado por el dueño.
 *
 * ── El síntoma, y por qué el panel tiene que contarlo ─────────────────────
 * Desde el 2026-09-10 App Check está **exigido en Cloud Firestore**: ninguna
 * lectura ni escritura del panel llega a las reglas sin un token de reCAPTCHA
 * Enterprise. Cuando el token no se consigue —una extensión que bloquea
 * reCAPTCHA, la red de quien carga, un score bajo— el SDK de Firestore **no dice
 * que lo rechazaron**: acumula fallos de canal, se declara offline, y el cartel
 * dice «se cortó la conexión». Pasó de verdad, y el diagnóstico costó un ida y
 * vuelta entero con alguien que no puede abrir devtools.
 *
 * Este módulo es lo que faltaba: **pedir el token al entrar** —no en el primer
 * guardado, que es tarde— y dejar escrito si llegó. Lo leen dos lugares:
 *
 * 1. El cartel de arriba del panel (`AvisoVerificacion.tsx`), con el triaje en
 *    tres pasos que la persona puede hacer sola.
 * 2. `clasificarFalloGuardado`, para que un `unavailable` con el navegador sin
 *    verificar deje de leerse como «no hay internet» (`motivo: 'verificacion'`).
 *
 * ── Store de módulo, no contexto de React ─────────────────────────────────
 * Mismo patrón que `formulario-sucio.ts` y `rolActivo.ts`: el clasificador de
 * fallos lo consulta desde diecisiete pantallas y ninguna tiene por qué saber
 * de App Check. Un contexto obligaría a cablear el dato por todas.
 *
 * **Este archivo no importa el SDK** (solo un tipo): lo importa
 * `analytics-eventos.ts`, que también usa el sitio público. El `getToken` real
 * lo pone `firebase-client.ts` por parámetro.
 *
 * Puro salvo el store: se testea sin DOM, sin Firebase y con relojes falsos.
 */
import type { MotivoSinAppCheck } from '@/lib/appcheck';

/**
 * - **`no-aplica`**: no hay nada que verificar — emuladores (no verifican App
 *   Check), fuera del navegador, o sin clave de sitio. Es también el valor de
 *   arranque, así que nada cambia para quien no llama a `verificarNavegador`
 *   (el sitio público, los tests).
 * - **`verificando`**: el token está pedido y todavía no volvió, dentro del
 *   umbral. No se avisa nada: el primer token tarda uno o dos segundos.
 * - **`verificado`**: llegó un token.
 * - **`sin-verificar`**: `getToken` falló, tardó más que el umbral, o App Check
 *   ni siquiera se pudo inicializar. Es el único estado que pinta el cartel.
 */
export type EstadoVerificacion = 'no-aplica' | 'verificando' | 'verificado' | 'sin-verificar';

/**
 * Cuánto se espera el primer token antes de avisar.
 *
 * El primer token de reCAPTCHA Enterprise tarda uno o dos segundos (baja el
 * script, corre el desafío, lo intercambia). Diez segundos es cinco veces eso:
 * lo bastante para no asustar a nadie con una red lenta, y lo bastante corto
 * para que el cartel ya esté arriba cuando la persona termina de mirar la
 * lista y aprieta algo. **El umbral existe porque el `catch` no alcanza**: con
 * el script de reCAPTCHA bloqueado, `getToken` no rechaza nunca — se queda
 * esperando un widget que no se inicializa.
 */
export const UMBRAL_VERIFICACION_MS = 10_000;

/**
 * Qué estado corresponde apenas se intentó activar App Check, antes de pedir
 * nada. Puro.
 *
 * **`sin-clave` no avisa**, y es a propósito: es una configuración incompleta
 * del deploy, no algo del navegador de quien carga. El triaje del cartel
 * —recargar, incógnito, otro navegador— no lo resuelve, así que mostrarlo sería
 * mandar a la persona a probar tres cosas que no pueden andar. Ese caso ya
 * tiene su `console.warn` en `activarAppCheck`.
 *
 * **`fallo` sí avisa**: `initializeAppCheck` tiró, así que no va a haber token.
 */
export const estadoSegunActivacion = (motivo: MotivoSinAppCheck | null): EstadoVerificacion => {
  if (motivo === null) return 'verificando';
  if (motivo === 'fallo') return 'sin-verificar';
  return 'no-aplica';
};

/** ¿Va el cartel? Una línea, pero con nombre: la pregunta la hacen dos lugares. */
export const debeAvisar = (estado: EstadoVerificacion): boolean => estado === 'sin-verificar';

// ── El store ──────────────────────────────────────────────────────────────

let estado: EstadoVerificacion = 'no-aplica';
let iniciada = false;
const oyentes = new Set<() => void>();

const fijar = (nuevo: EstadoVerificacion): void => {
  if (nuevo === estado) return;
  estado = nuevo;
  for (const oyente of oyentes) oyente();
};

export const estadoDeVerificacion = (): EstadoVerificacion => estado;

/**
 * Lo que consulta el clasificador de fallos. Solo `sin-verificar` cuenta:
 * `verificando` dura como mucho el umbral, y en ese rato un `unavailable` es
 * más probablemente la red que un token que todavía puede llegar.
 */
export const navegadorSinVerificar = (): boolean => debeAvisar(estado);

/** Devuelve la función para desuscribirse (va derecho al cleanup de un efecto). */
export const observarVerificacion = (oyente: () => void): (() => void) => {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
};

const esperarPorDefecto = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Pide el primer token y deja el resultado en el store. **Una sola vez** por
 * carga: se llama desde el arranque del panel, que puede montarse más de una
 * vez (StrictMode, cambios de sesión).
 *
 * **Nunca tira.** Un fallo acá no puede dejar el login en blanco, por la misma
 * razón que `activarAppCheck` no propaga nada: lo que hace este módulo es
 * **avisar**, y un aviso que rompe la pantalla es peor que el problema.
 *
 * **Si el token llega tarde, el cartel se va.** Pasado el umbral se avisa, pero
 * se sigue esperando: una red lenta que termina entregando el token no tiene
 * por qué dejar el cartel puesto toda la tarde.
 */
export const verificarNavegador = async ({
  motivo,
  pedirToken,
  umbralMs = UMBRAL_VERIFICACION_MS,
  esperar = esperarPorDefecto,
}: {
  motivo: MotivoSinAppCheck | null;
  pedirToken: (() => Promise<unknown>) | null;
  umbralMs?: number;
  esperar?: (ms: number) => Promise<void>;
}): Promise<void> => {
  if (iniciada) return;
  iniciada = true;

  const inicial = estadoSegunActivacion(motivo);
  // Activado pero sin quién pida el token: no debería pasar, y si pasa no hay
  // nada que verificar. Se trata como fallo, que es lo que es.
  if (inicial === 'verificando' && !pedirToken) {
    fijar('sin-verificar');
    return;
  }
  fijar(inicial);
  if (inicial !== 'verificando' || !pedirToken) return;

  let respondio = false;
  void esperar(umbralMs).then(() => {
    // `estado === 'verificando'` y no solo `!respondio`: un token que llegó por
    // la suscripción (B-1250) antes que la respuesta de `getToken` ya verificó
    // el navegador, y el umbral no tiene por qué pisarlo.
    if (!respondio && estado === 'verificando') fijar('sin-verificar');
  });

  try {
    await pedirToken();
    respondio = true;
    fijar('verificado');
  } catch {
    respondio = true;
    fijar('sin-verificar');
  }
};

// ── Las renovaciones — B-1250 ─────────────────────────────────────────────

/**
 * Lo que avisa la suscripción al token (`onTokenChanged`, en `appcheck.ts`):
 * llegó uno bueno, o el SDK se quedó sin ninguno válido.
 */
export type EventoDeToken = 'token' | 'error';

/**
 * Qué estado corresponde después de un aviso de la suscripción. Puro.
 *
 * **Por qué hace falta**: `verificarNavegador` mira solo el primer token.
 * `isTokenAutoRefreshEnabled` lo renueva solo a lo largo de la tarde, y si una
 * renovación falla —la persona cambió de red, prendió una VPN, se activó una
 * extensión— el estado seguía en `verificado` y el guardado fallido volvía a
 * decir «se cortó la conexión», que es lo que B-930 vino a sacar.
 *
 * Las reglas, en orden:
 *
 * - **`no-aplica` no se mueve.** Es el estado de quien nunca pidió verificar
 *   —el sitio público, que también activa App Check para sus formularios—, y
 *   ahí el cartel no existe. Tampoco lo mueve un aviso que llegue antes de que
 *   el panel arranque la verificación: de ese caso se encarga el primer
 *   `getToken`.
 * - **Un token bueno verifica**, venga de donde venga: es la vuelta de un
 *   `sin-verificar` (volvió la red, se apagó la VPN) y es también un
 *   `verificando` que se resolvió por este lado antes que por `getToken`.
 * - **Un error solo baja a quien estaba `verificado`.** En `verificando` quien
 *   decide es el primer pedido con su umbral —el error le llega igual, porque
 *   el SDK comparte el intercambio—, y en `sin-verificar` ya está avisado.
 *
 * **Por qué esto no parpadea**: una renovación normal manda otro token con el
 * estado ya en `verificado`, y `fijar` no avisa a nadie si el estado no cambió.
 * Y el SDK **no manda error mientras quede un token válido**: si una renovación
 * falla con el anterior todavía vigente, el oyente recibe ese token (con un
 * `internalError` que acá no se mira) y reintenta con backoff. El error llega
 * recién cuando no hay ninguno válido, que es cuando Firestore empieza a fallar
 * de verdad.
 */
export const estadoTrasEventoDeToken = (
  actual: EstadoVerificacion,
  evento: EventoDeToken,
): EstadoVerificacion => {
  if (actual === 'no-aplica') return actual;
  if (evento === 'token') return 'verificado';
  return actual === 'verificado' ? 'sin-verificar' : actual;
};

/**
 * Lo que llama la suscripción al token. **Nunca tira**: el SDK se traga las
 * excepciones de los oyentes, pero este módulo no depende de eso.
 */
export const registrarEventoDeToken = (evento: EventoDeToken): void => {
  try {
    fijar(estadoTrasEventoDeToken(estado, evento));
  } catch {
    // Un oyente del cartel que tira no puede cortar el aviso a los demás.
  }
};

/** Para los tests: vuelve al arranque. */
export const _resetVerificacion = (): void => {
  estado = 'no-aplica';
  iniciada = false;
  oyentes.clear();
};

/** Para los tests: fija el estado sin pedir nada. */
export const _fijarVerificacion = (nuevo: EstadoVerificacion): void => fijar(nuevo);

// ── El texto del cartel ───────────────────────────────────────────────────

/**
 * Lo que dice el cartel. Vive acá y no en el componente para que el test del
 * triaje no dependa del JSX, y porque es la misma frase que abre el texto del
 * fallo de guardado (`fallosDelPanel.ts`): las dos tienen que decir lo mismo.
 */
export const TITULO_SIN_VERIFICAR = 'No pudimos verificar tu navegador.';

export const EXPLICACION_SIN_VERIFICAR =
  'Sin esa verificación el panel no puede leer ni guardar nada, aunque tengas internet. ' +
  'No es tu cuenta: casi siempre lo resuelve alguna de estas tres cosas, en este orden.';

/**
 * El triaje, **en el orden en que más descarta por minuto** (B-930):
 *
 * 1. Recargar — si vuelve a andar, fue transitorio.
 * 2. Incógnito sin extensiones — si ahí anda, es una extensión bloqueando
 *    reCAPTCHA. Es el caso más común y el que peor esconde el mensaje del SDK.
 * 3. Otro navegador o datos móviles — si con datos anda y con el wifi no, es la
 *    red (oficina, VPN, portal cautivo).
 */
export const PASOS_SIN_VERIFICAR = [
  'Recargá la página.',
  'Abrí el panel en una ventana de incógnito, sin extensiones: los bloqueadores de anuncios suelen frenar la verificación.',
  'Probá con otro navegador, o con los datos del celular en vez del wifi.',
] as const;
