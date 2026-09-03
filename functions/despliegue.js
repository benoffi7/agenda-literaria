/**
 * B-77 — las opciones de despliegue que comparten todas las Functions de este
 * proyecto, en un solo lugar.
 *
 * ── Por qué esto existe, y por qué no alcanza `setGlobalOptions` ───────────
 * `index.js` llama a `setGlobalOptions({ region, maxInstances, serviceAccount })`
 * en su cuerpo, y **eso corre después de los imports**: en ESM los módulos
 * importados se evalúan antes que el cuerpo del importador, así que una Function
 * definida en un módulo aparte no puede heredar nada de ahí. Es D-35, y el
 * síntoma es caro y silencioso: la Function se despliega en `us-central1` con la
 * service account por defecto de Compute, y Calendar le contesta 404 en todo.
 *
 * Por eso cada módulo de trigger declara sus opciones explícitas. Lo que este
 * archivo evita es que «explícitas» signifique «copiadas»: el mail de la service
 * account estaba escrito literal en cinco archivos, y el día que cambie hay que
 * acordarse de los cinco.
 *
 * No importa `firebase-functions` ni `firebase-admin`: son constantes.
 */

/** Al lado de Firestore: cada op del diff contra Calendar es un round trip. */
export const REGION = 'southamerica-east1';

/**
 * §2.6 / D-06 — la identidad con la que se comparte el calendario. Sin esto la
 * Function correría como la SA por defecto de Compute, que no tiene acceso.
 *
 * Es también la identidad del resto del deploy: ya tiene los roles que un
 * trigger de Firestore v2 necesita y que hay que otorgar a mano
 * (`datastore.user`, `eventarc.eventReceiver`, `run.invoker`,
 * `artifactregistry.reader`).
 */
export const CUENTA_DE_SERVICIO = 'calendar-sync@agenda-literaria.iam.gserviceaccount.com';

/** Lo que lleva toda Function de este proyecto, para spreadear sobre lo propio. */
export const OPCIONES_BASE = {
  region: REGION,
  maxInstances: 5,
  serviceAccount: CUENTA_DE_SERVICIO,
};
