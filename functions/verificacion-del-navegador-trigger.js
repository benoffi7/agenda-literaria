/**
 * **El endpoint del reporte de verificación** — B-930 paso 3, D-1225.
 *
 * La primera `onRequest` del proyecto. Todo lo que decide está en
 * `verificacion-del-navegador.js`, que es puro y tiene su test; acá solo van las
 * opciones de despliegue y el enganche con `logger.warn`.
 *
 * **Sin `enforceAppCheck`, y es a propósito**: lo que se reporta es que el
 * navegador no consiguió token de App Check. Exigirlo sería no recibir nunca el
 * único reporte que este endpoint existe para recibir. Los frenos contra el
 * ruido están enumerados en la cabecera del otro archivo.
 *
 * `warn` y no `error`: la política de GCP toma `severity>=WARNING`, y un
 * navegador sin verificar le pasa a una persona, no al sistema.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { CUENTA_DE_SERVICIO, REGION } from './despliegue.js';
import { crearManejador, ORIGENES_PERMITIDOS } from './verificacion-del-navegador.js';

export const reportarVerificacionDelNavegador = onRequest(
  {
    // Explícitas y no heredadas de `setGlobalOptions()`, por el orden de
    // evaluación de ESM (D-35). No usa ninguna API de Google, pero corre con la
    // misma cuenta que el resto para no sumar una identidad al inventario.
    region: REGION,
    serviceAccount: CUENTA_DE_SERVICIO,
    // Lo llama el navegador de alguien que no tiene token: tiene que ser
    // invocable sin credenciales de GCP.
    invoker: 'public',
    // Responde el preflight y pone `Access-Control-Allow-Origin` solo para los
    // cuatro nombres del sitio. El panel manda `text/plain`, que no dispara
    // preflight, así que el chequeo que cuenta es el `Origin` de `decidirReporte`.
    cors: [...ORIGENES_PERMITIDOS],
    // Una instancia: el tope por minuto de la decisión es por instancia, y con
    // una sola es un tope del endpoint entero.
    maxInstances: 1,
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  crearManejador({ avisar: (mensaje, campos) => logger.warn(mensaje, campos) }),
);
