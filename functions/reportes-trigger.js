/**
 * Infraestructura del reporte → issue de GitHub. La lógica pura está en
 * `reportes.js`; acá solo vive lo que necesita red, secreto y Firestore.
 *
 * ── Por qué trigger de Firestore y no `onCall` ─────────────────────────────
 * El pedido dice que el reporte no se puede perder. Con `onCall` el reporte
 * vive en la memoria de la Function: si la API de GitHub está caída, o el
 * token venció, la llamada falla y lo que escribió la persona se va con ella.
 * Con el trigger, la escritura en `/reportes/{id}` **es** el reporte: queda
 * guardado antes de que GitHub entre en juego, y el issue es un efecto
 * posterior que puede reintentarse.
 *
 * Además:
 *  - la autorización ya la hacen las reglas de Firestore con `esAdmin()`
 *    (§5.3), sin reimplementar el chequeo del claim en la Function;
 *  - el panel se entera del número de issue escuchando el documento, así que
 *    no hace falta una respuesta síncrona;
 *  - `estado` en el documento deja el fallo a la vista en el panel, en vez de
 *    en un log que nadie mira.
 *
 * Lo que se pierde: el usuario no ve el número de issue en el mismo click.
 * Lo ve un segundo después, por el `onSnapshot`.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  actividadParaIssue,
  construirIssue,
  decidirAccion,
  estadoTrasFallo,
} from './reportes.js';

/**
 * §5.4 — el PAT nunca en el repo ni en `functions/.env`: Secret Manager. El
 * valor se resuelve en runtime (`.value()`), nunca en el deploy.
 * El repo destino no es secreto y va en `functions/.env` como `GITHUB_REPO`.
 */
const githubToken = defineSecret('GITHUB_TOKEN');

/**
 * Las opciones van explícitas y no por el `setGlobalOptions` de `index.js`.
 *
 * No es preferencia: en ESM los imports corren antes que el cuerpo del módulo
 * que importa, así que cuando este archivo define la Function el
 * `setGlobalOptions()` de `index.js` **todavía no se ejecutó** y el endpoint
 * quedaría sin región ni service account. Con las opciones acá, el orden deja
 * de importar (y de paso el archivo se puede mergear sin tocar `index.js`).
 */
const OPCIONES = {
  document: 'reportes/{id}',
  region: 'southamerica-east1',
  maxInstances: 3,
  serviceAccount: 'calendar-sync@agenda-literaria.iam.gserviceaccount.com',
  secrets: [githubToken],
};

const API = 'https://api.github.com';

/**
 * Timeout de la llamada a GitHub (B-74). Sin esto un socket colgado se come la
 * invocación entera hasta el timeout de la plataforma.
 *
 * El conocimiento ya estaba escrito en la otra copia de esta misma llamada
 * (`TIMEOUT_DISPATCH_MS` en `index.js`): acá se habían copiado las cinco
 * cabeceras y no el `AbortSignal`. Es el ejemplo de por qué B-77 vale.
 */
const TIMEOUT_MS = 15_000;

/** Crea el issue. Devuelve `{ ok, numero, url, status, mensaje }`. */
const crearIssue = async ({ repo, token, issue }) => {
  let r;
  try {
    r = await fetch(`${API}/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'agenda-literaria',
      },
      body: JSON.stringify(issue),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // Sin status: error de red. Reintentable.
    return { ok: false, status: null, mensaje: e?.message ?? 'error de red' };
  }

  if (!r.ok) {
    // Se guarda el status y un recorte del cuerpo, no el cuerpo entero: en el
    // documento lo lee un humano en el panel, no un parser.
    const texto = await r.text().catch(() => '');
    return { ok: false, status: r.status, mensaje: `GitHub ${r.status}: ${texto.slice(0, 300)}` };
  }

  const data = await r.json();
  return { ok: true, numero: data.number, url: data.html_url };
};

export const reporteAIssue = onDocumentWritten(OPCIONES, async (event) => {
  const { id } = event.params;
  const db = getFirestore();
  const ref = db.doc(`reportes/${id}`);

  /**
   * Se toma el reporte en una transacción antes de hablar con GitHub.
   *
   * Dos cosas al mismo tiempo: la guarda anti-loop (la escritura de vuelta del
   * número de issue vuelve a disparar este trigger, y en esa segunda pasada
   * `decidirAccion` devuelve "ignorar" — §7.1, trampa 3) y la garantía de que
   * un evento entregado dos veces no cree dos issues.
   */
  const reporte = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const datos = snap.exists ? snap.data() : null;
    const { accion, motivo, intento } = decidirAccion(datos);
    if (accion !== 'enviar') {
      logger.debug('reporte sin acción', { id, motivo });
      return null;
    }
    tx.update(ref, { estado: 'enviando', intentos: intento, actualizadoEn: FieldValue.serverTimestamp() });
    return { ...datos, intentos: intento };
  });

  if (!reporte) return;

  const repo = process.env.GITHUB_REPO;
  const token = githubToken.value();
  if (!repo || !token) {
    // No es reintentable: falta configuración. El reporte queda guardado y el
    // panel lo muestra como fallido; se reintenta a mano cuando el secreto
    // esté (ver docs/08-operacion.md).
    logger.error('falta GITHUB_REPO o el secreto GITHUB_TOKEN: el reporte queda sin issue', { id });
    await ref.update({
      estado: 'error',
      error: 'Falta configurar el repo o el token de GitHub en la Function.',
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    return;
  }

  // Solo título y slug, y solo si la actividad está publicada: el repo de
  // GitHub es público y el título de un borrador todavía no lo es. La decisión
  // se toma acá y no en el panel, para que no dependa del cliente.
  let actividad = null;
  if (reporte.actividad?.id) {
    const snap = await db.doc(`actividades/${reporte.actividad.id}`).get();
    actividad = actividadParaIssue(snap.exists ? snap.data() : null);
  }

  const issue = construirIssue({ id, reporte, actividad });
  const r = await crearIssue({ repo, token, issue });

  if (r.ok) {
    await ref.update({
      estado: 'creado',
      error: null,
      github: { numero: r.numero, url: r.url, creadoEn: FieldValue.serverTimestamp() },
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    logger.info('issue creado', { id, numero: r.numero });
    return;
  }

  const estado = estadoTrasFallo(reporte.intentos, r.status);
  // Volver a "pendiente" es lo que reintenta: esa misma escritura dispara este
  // trigger de nuevo, y `intentos` (que ya se incrementó al tomarlo) corta la
  // cadena a MAX_INTENTOS.
  await ref.update({
    estado,
    error: r.mensaje,
    actualizadoEn: FieldValue.serverTimestamp(),
  });
  logger.error('no se pudo crear el issue', {
    id,
    intento: reporte.intentos,
    status: r.status,
    estado,
    error: r.mensaje,
  });
});
