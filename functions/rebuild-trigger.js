/**
 * §8 — el debounce del rebuild: si se editan cinco campos seguidos no se
 * disparan cinco builds.
 *
 * La decisión de **cuándo** disparar —el backoff exponencial, el corte por
 * intentos, el rearme (D-23)— es pura y vive en `rebuild.js`; el cliente HTTP de
 * GitHub, en `github.js` (B-77, con el `fetch` inyectable). Acá está el reloj y
 * el efecto.
 *
 * Vive en su propio archivo desde B-77: era la sexta de las responsabilidades que
 * `index.js` acumulaba.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { OPCIONES_BASE } from './despliegue.js';
import { dispararDispatch } from './github.js';
import { decidirDisparo, registrarExito, registrarFallo } from './rebuild.js';

/** `owner/repo` del repositorio que tiene el workflow de build (§8). */
const GITHUB_REPO = process.env.GITHUB_REPO;

/**
 * §5.4 — el PAT de GitHub es lo único secreto de este proyecto, así que va a
 * Secret Manager y no a `functions/.env` (que sí está versionado).
 *
 * `defineSecret` es lo que ata el secreto a la Function: leerlo de `process.env`
 * sin declararlo acá daría `undefined` en producción, porque nadie habría
 * montado el secreto en el runtime.
 */
const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');

export const dispararRebuild = onSchedule(
  {
    // Explícitas, no heredadas del `setGlobalOptions` de `index.js` — D-35.
    //
    // `OPCIONES_BASE` entero, `maxInstances` incluido, aunque un schedule no
    // concurra consigo mismo: antes de B-77 esta Function estaba definida en
    // `index.js` **después** de `setGlobalOptions`, así que lo heredaba. B-77 es
    // un refactor y el endpoint desplegado tiene que salir idéntico —
    // verificado leyendo el `__endpoint` de las nueve Functions antes y después.
    ...OPCIONES_BASE,
    schedule: 'every 5 minutes',
    timeZone: 'America/Argentina/Buenos_Aires',
    secrets: [GITHUB_TOKEN],
  },
  async () => {
    const db = getFirestore();
    const ref = db.doc('sistema/rebuild');
    const snap = await ref.get();
    const estado = snap.exists ? snap.data() : null;
    const ahora = Date.now();

    const decision = decidirDisparo(estado, ahora);
    if (decision.accion === 'esperar') {
      if (decision.motivo === 'agotado') {
        // El `error` ya se logueó en el tick que agotó los intentos. Repetirlo
        // cada 5 minutos sería el ruido que el límite vino a evitar: el estado
        // persistente está en el documento (`agotado`, `ultimoError`).
        logger.debug('rebuild agotado: espera un cambio nuevo o un disparo manual', {
          intentos: decision.intentos,
        });
      }
      return;
    }

    const token = GITHUB_TOKEN.value();
    if (!token || !GITHUB_REPO) {
      // Falta configuración, no falló nada: no consume un intento ni ensucia
      // el contador. Y va como info, que cada 5 minutos ya es suficiente.
      logger.info('rebuild pendiente pero sin GitHub configurado (§8)');
      return;
    }

    const error = await dispararDispatch(GITHUB_REPO, token, estado.motivo);

    if (error) {
      // El flag `pendiente` queda en true: el próximo tick reintenta, con
      // backoff, hasta agotar los intentos.
      const fallo = registrarFallo(estado, error, ahora);
      await ref.set(fallo, { merge: true });
      if (fallo.agotado) {
        logger.error('el rebuild agotó los reintentos: el sitio quedó viejo', {
          // B-21 — etiqueta estable para la alerta de GCP. El filtro de una
          // log-based alert sobre el *texto* del mensaje se rompe en silencio
          // el día que alguien reescribe la frase; sobre un campo, no. Es el
          // único log del proyecto que amerita despertar a alguien: significa
          // que el sitio público quedó viejo y que ya nadie va a reintentar.
          alerta: 'rebuild-agotado',
          intentos: fallo.intentos,
          error: fallo.ultimoError,
          motivo: estado.motivo,
        });
      } else {
        logger.warn('repository_dispatch falló, se reintenta', {
          intentos: fallo.intentos,
          error: fallo.ultimoError,
        });
      }
      return;
    }

    // B-85 — bajar `pendiente` se hace comparando: entre la lectura de arriba y
    // este punto pasó una llamada a GitHub de hasta 15 s, y una actividad
    // guardada en esa ventana marcó su rebuild. Ese cambio no entró al build que
    // acabamos de disparar, así que el flag tiene que quedar arriba.
    //
    // Va en transacción para que la comparación no tenga su propia ventana: si
    // la marca llega mientras la transacción corre, Firestore la reintenta y la
    // ve.
    const exito = await db.runTransaction(async (tx) => {
      const actual = await tx.get(ref);
      const campos = registrarExito(ahora, {
        marcaLeida: estado.actualizado ?? null,
        marcaActual: (actual.exists ? actual.data().actualizado : null) ?? null,
      });
      tx.set(ref, campos, { merge: true });
      return campos;
    });

    logger.info('rebuild disparado', { motivo: estado.motivo, intento: decision.intento });
    if (exito.pendiente) {
      logger.info('llegó otro cambio durante el dispatch: queda pendiente para el próximo tick');
    }
  },
);
