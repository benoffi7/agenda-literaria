/**
 * **Que el dueño se entere de un navegador sin verificar** — B-930 paso 3.
 *
 * El cartel de `AvisoVerificacion.tsx` le dice a la persona que su navegador no
 * consiguió token de App Check. Hasta acá nadie más se enteraba: el token que no
 * llega pasa en el navegador, y la alerta de GCP (B-871) solo ve logs del
 * servidor. Este módulo manda **un** reporte —el motivo y nada más— a la
 * Function `reportarVerificacionDelNavegador`, que lo loguea con `alerta` y la
 * política de GCP lo convierte en mail. Decisiones en **D-1225** a **D-1228**.
 *
 * ── Cuándo reporta ────────────────────────────────────────────────────────
 * 1. **Con el navegador `sin-verificar` durante `GRACIA_DEL_REPORTE_MS`.** El
 *    cartel sale a los diez segundos y se va solo si el token llega tarde; un
 *    token que tarda doce segundos en una red lenta no amerita un mail. La
 *    gracia es lo que separa «tardó» de «no llega».
 * 2. **Con una sesión iniciada.** No es seguridad —el servidor no puede
 *    verificar la sesión sin otro token— sino filtro de ruido: un crawler que
 *    renderiza `/admin` con reCAPTCHA bloqueado, o alguien que abrió el panel
 *    sin cuenta, no es a quien hay que ir a ayudar. **El uid no viaja**: alcanza
 *    con saber que le pasó a alguien que carga.
 * 3. **Una vez por carga del panel.** El estado puede ir y venir —un token que
 *    llega, una renovación que falla— y la sesión cerrarse y abrirse: el reporte
 *    sale una sola vez. **Sin marca en `sessionStorage`, a propósito** (D-1227):
 *    quien sigue el triaje recarga y vuelve a reportar, pero eso son dos o tres
 *    líneas de log, y la política de GCP manda como mucho un mail por hora. Una
 *    marca en el navegador sería una fila más en la tabla del §5.1 de
 *    `07-seguridad.md` para no ahorrar ningún mail.
 *
 * ── Cómo reporta ──────────────────────────────────────────────────────────
 * Un `fetch` plano, **no** una callable: el SDK de Functions pide el token de
 * App Check antes de mandar, y con reCAPTCHA bloqueado ese pedido no vuelve
 * nunca (D-1225). El cuerpo va como texto (`text/plain` por defecto de un
 * string), que es un pedido «simple» sin preflight; sin cookies
 * (`credentials: 'omit'`) y sin `Referer`. Nadie lee la respuesta: manda y se
 * olvida, y un fallo del reporte no toca nada del panel.
 *
 * **Nunca tira**, por lo mismo que `verificarNavegador`: esto es un aviso, y un
 * aviso que rompe la pantalla es peor que el problema.
 *
 * No importa ningún SDK: la sesión y el envío entran por parámetro desde
 * `firebase-client.ts`, y así se testea sin Firebase y con relojes falsos.
 */
import {
  causaSinVerificar,
  debeAvisar,
  estadoDeVerificacion,
  observarVerificacion,
  type CausaSinVerificar,
  type EstadoVerificacion,
} from '@/lib/verificacionDelNavegador';

/** Cuánto tiene que durar `sin-verificar` antes de reportar. Ver el punto 1. */
export const GRACIA_DEL_REPORTE_MS = 20_000;

/** El nombre de la Function, el que exporta `functions/index.js`. */
export const FUNCTION_DEL_REPORTE = 'reportarVerificacionDelNavegador';

/** La de todas las Functions del proyecto (`functions/despliegue.js`). */
export const REGION_DEL_REPORTE = 'southamerica-east1';

/**
 * La URL de la Function. Las v2 tienen, además de la de Cloud Run con un hash,
 * esta forma **derivable**, que es la que permite no guardar la URL en ningún
 * `.env`: sale de la región, el proyecto y el nombre.
 */
export const urlDelReporte = (projectId: string): string =>
  `https://${REGION_DEL_REPORTE}-${projectId}.cloudfunctions.net/${FUNCTION_DEL_REPORTE}`;

/** ¿Corresponde reportar ahora? Puro. */
export const debeReportar = ({
  estado,
  haySesion,
  yaReportado,
}: {
  estado: EstadoVerificacion;
  haySesion: boolean;
  yaReportado: boolean;
}): boolean =>
  // `debeAvisar` y no `=== 'sin-verificar'` a mano: el reporte es del cartel, y
  // si cambia cuándo va el cartel tiene que cambiar cuándo se reporta.
  debeAvisar(estado) && haySesion && !yaReportado;

/** Lo que manda el panel: el motivo, y nada más (la Function rechaza cualquier otra clave). */
export const cuerpoDelReporte = (motivo: CausaSinVerificar): string => JSON.stringify({ motivo });

const esperarPorDefecto = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));

/** El envío de verdad: `fetch` plano, sin cookies ni `Referer`, sin leer la respuesta. */
export const enviarReportePorFetch =
  (url: string, hacerFetch: typeof fetch = fetch) =>
  (motivo: CausaSinVerificar): Promise<unknown> =>
    hacerFetch(url, {
      method: 'POST',
      body: cuerpoDelReporte(motivo),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });

let iniciado = false;

/**
 * Empieza a mirar el store y la sesión, y reporta **a lo sumo una vez**. Se
 * llama desde el arranque del panel; una segunda llamada no hace nada, por la
 * misma razón que `verificarNavegador` (StrictMode, cambios de sesión).
 */
export const iniciarReporteDeVerificacion = ({
  observarSesion,
  enviar,
  graciaMs = GRACIA_DEL_REPORTE_MS,
  esperar = esperarPorDefecto,
}: {
  /** Se suscribe a la sesión: `true` si hay alguien logueado. */
  observarSesion: (oyente: (haySesion: boolean) => void) => unknown;
  enviar: (motivo: CausaSinVerificar) => Promise<unknown>;
  graciaMs?: number;
  esperar?: (ms: number) => Promise<void>;
}): void => {
  if (iniciado) return;
  iniciado = true;

  try {
    let haySesion = false;
    let yaReportado = false;
    let esperando = false;

    const corresponde = () =>
      debeReportar({ estado: estadoDeVerificacion(), haySesion, yaReportado });

    const evaluar = (): void => {
      if (esperando || !corresponde()) return;
      esperando = true;
      void esperar(graciaMs).then(() => {
        esperando = false;
        const motivo = causaSinVerificar();
        // Se vuelve a mirar después de la gracia: si el token llegó o la
        // sesión se cerró, no se reporta. Un cambio posterior vuelve a llamar
        // a `evaluar` por la suscripción.
        if (!corresponde() || !motivo) return;
        yaReportado = true;
        return enviar(motivo);
      })
        // Un reporte que falla —la red, la Function caída— no se reintenta ni
        // se cuenta: el cartel ya le dijo a la persona lo que tiene que hacer.
        .catch(() => {});
    };

    observarVerificacion(evaluar);
    observarSesion((hay) => {
      haySesion = hay;
      evaluar();
    });
    evaluar();
  } catch {
    // Nada: ver el docblock.
  }
};

/** Para los tests: vuelve al arranque. */
export const _resetReporteDeVerificacion = (): void => {
  iniciado = false;
};
