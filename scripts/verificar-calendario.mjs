#!/usr/bin/env node
/**
 * B-125 (D-293) — la otra mitad: enterarse de que alguien borró a mano el
 * evento de un encuentro publicado **sin** que haya una escritura de por
 * medio. La vista calendario del panel solo compara el `calendarEventId`
 * guardado contra lo que **debería** existir (`debeExistir`), nunca contra lo
 * que Calendar tiene de verdad (D-71) — esto es lo que le pregunta a la API.
 *
 * ── Por qué un script y no un botón del panel ────────────────────────────
 * Leer Calendar pide la identidad de la Function (`calendar-sync@…`, D-06): el
 * panel no tiene, ni debería tener, credenciales propias contra esa API. La
 * decisión (D-293) fue no sumar un `onCall` nuevo —superficie de auth de más
 * para una tarea de mantenimiento ocasional— cuando "el panel o un script" ya
 * estaba sancionado como las dos vías válidas para cerrar B-125. Se
 * autentica **impersonando** esa service account desde las ADC de quien
 * corre el script (sin bajar ninguna key, mismo espíritu que D-06):
 *
 *   1. `gcloud auth application-default login` (una vez, si no lo hiciste ya
 *      para los otros scripts de este archivo).
 *   2. Que alguien con permisos le dé a tu cuenta el rol
 *      `roles/iam.serviceAccountTokenCreator` sobre
 *      `calendar-sync@agenda-literaria.iam.gserviceaccount.com`:
 *
 *        gcloud iam service-accounts add-iam-policy-binding \
 *          calendar-sync@agenda-literaria.iam.gserviceaccount.com \
 *          --member="user:<tu-mail>" \
 *          --role="roles/iam.serviceAccountTokenCreator"
 *
 *      Es un permiso nuevo, se otorga una sola vez y no requiere ninguna key
 *      descargada — exactamente el punto de D-06. Documentado en
 *      `docs/08-operacion.md` § "Verificar contra Calendar de verdad (B-125)".
 *
 * ── Firestore sí tiene emulador; Calendar no ─────────────────────────────
 * Con `FIRESTORE_EMULATOR_HOST` seteado, lee del emulador (mismo patrón que
 * `aprobar-opciones.mjs`); si no, de producción con las ADC. **La llamada a
 * Calendar es SIEMPRE contra el calendario real** — no existe un emulador de
 * Calendar. Por eso el default es de solo lectura (reporta, no repara) y la
 * reparación pide `--reparar` explícito: nunca toca un evento que Calendar
 * confirma que existe, solo recrea los que confirma 404/410 (ver
 * `functions/reconciliacion.js`).
 *
 *   node scripts/verificar-calendario.mjs              # reporta, no escribe nada
 *   node scripts/verificar-calendario.mjs --reparar     # además recrea los borrados a mano
 *
 * La lógica de qué verificar y qué decide cada respuesta es pura y está en
 * `functions/reconciliacion.js`, testeada sin red en
 * `tests/reconciliacion.test.ts`. Este archivo es el pegamento: junta
 * Firestore, Calendar y esas funciones, y ejecuta el efecto — igual que
 * `functions/index.js` es el pegamento de `functions/calendario.js` (§7).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import { construirEvento } from '../functions/calendario.js';
import { idDeEvento, mapaDeEtiquetas, reponerIds } from '../functions/sincronizacion.js';
import {
  interpretarExistencia,
  planificarReparacion,
  sesionesAVerificar,
} from '../functions/reconciliacion.js';

const CALENDAR_SA = 'calendar-sync@agenda-literaria.iam.gserviceaccount.com';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? 'primary';
const CAMPOS_TAXONOMIA = ['arancel', 'tipo', 'barrio', 'plataforma', 'tags'];

/**
 * El cuerpo de un `events.insert`, pura y exportada para poder testearla sin
 * red (`tests/verificar-calendario.test.ts`).
 *
 * El `id` propuesto solo va si `idDeEvento` pudo derivarlo (B-82): con `null`
 * —el respaldo de una sesión cuyo id no tiene la forma `ses_<uuid>`, D-293—
 * mandar `id: null` literal es un campo que la API no espera. Mismo ternario
 * que usa `crearEvento` en `functions/index.js:144`: sin id, Calendar elige
 * uno y se pierde la idempotencia para esa sesión, no la reparación.
 */
export const cuerpoDeCreacion = (eventId, evento) => (eventId ? { ...evento, id: eventId } : evento);

/**
 * Un cliente REST mínimo sobre `fetch`, autenticado como `calendar-sync@…`
 * por impersonación. Se evitó la dependencia `googleapis` a propósito —este
 * script usa un solo verbo (`events.get`) y ocasionalmente `insert`/`update`
 * para reparar, y un cliente HTTP de tres funciones no justifica sumar el SDK
 * completo (`functions/` sí lo usa, porque ahí es una dependencia productiva
 * y no de una herramienta de mantenimiento).
 */
const clienteCalendar = async () => {
  const fuente = new GoogleAuth();
  const cliente = await fuente.getClient();
  const impersonado = new Impersonated({
    sourceClient: cliente,
    targetPrincipal: CALENDAR_SA,
    targetScopes: ['https://www.googleapis.com/auth/calendar.events'],
    lifetime: 3600,
  });

  const pedir = async (metodo, eventId, body) => {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      CALENDAR_ID,
    )}/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`;
    const headers = await impersonado.getRequestHeaders();
    const r = await fetch(url, {
      method: metodo,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.ok) return { ok: true, data: await r.json() };
    // El cuerpo trae el motivo real ("Not Found", "insufficient permission");
    // sin él, un 403 y un 404 se ven igual en el log.
    const cuerpo = await r.text().catch(() => '');
    return { ok: false, code: r.status, cuerpo };
  };

  return {
    obtener: (eventId) => pedir('GET', eventId),
    crear: (eventId, evento) => pedir('POST', undefined, cuerpoDeCreacion(eventId, evento)),
  };
};

const cargarLabels = async (db) => {
  const labels = {};
  const snaps = await db.getAll(...CAMPOS_TAXONOMIA.map((c) => db.doc(`opciones/${c}`)));
  // `mapaDeEtiquetas` (de `functions/sincronizacion.js`) ya hace exactamente
  // esta proyección de `ValorOpcion.valores` a `{ slug: label }` — la misma
  // que usa `cargarLabels` de `functions/index.js`. Se reusa en vez de
  // reimplementar el `.map` a mano: una tercera copia de una proyección que
  // toca qué campos de una opción son públicos (la clase de bug de B-212) es
  // exactamente lo que hay que evitar, y con esto no hay ningún "camino"
  // nuevo que registrar — es el mismo código, no un duplicado que hoy da lo
  // mismo.
  snaps.forEach((snap, i) => {
    labels[CAMPOS_TAXONOMIA[i]] = mapaDeEtiquetas(snap.data()?.valores);
  });
  return labels;
};

/**
 * El núcleo, separado del `main` de abajo para poder testearlo con un `cal`
 * y un `db` de mentira sin tocar la red ni el emulador (`tests/
 * verificar-calendario.test.ts`). Devuelve el resumen; no imprime nada.
 *
 * `desde` es el cursor de una corrida anterior truncada
 * (`resumen.siguienteCursor`): la query se ordena por id de documento
 * (`FieldPath.documentId()`, mismo patrón que `historial-trigger.js`) y
 * arranca **después** de esa actividad — sin esto, "correr de nuevo" repetía
 * siempre las mismas primeras `MAX_VERIFICACION_POR_CORRIDA` candidatas y una
 * sesión más allá del tope no se verificaba jamás (hallazgo del
 * `auditor-trampas`, P1).
 */
export const ejecutarVerificacion = async ({ db, cal, labels, reparar: repararFlag, desde = undefined }) => {
  let query = db
    .collection('actividades')
    .where('estado', '==', 'publicado')
    .orderBy(FieldPath.documentId());
  if (desde) query = query.startAfter(desde);
  const snap = await query.get();
  const actividades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const { candidatas, truncado, siguienteCursor } = sesionesAVerificar(actividades);

  const resultados = new Map();
  for (const c of candidatas) {
    const respuesta = await cal.obtener(c.sesion.calendarEventId);
    resultados.set(
      c.sesion.id,
      interpretarExistencia(
        respuesta.ok ? { ok: true, status: respuesta.data.status } : { ok: false, code: respuesta.code },
      ),
    );
  }

  const { reparar: aReparar, desconocidos } = planificarReparacion(candidatas, resultados);

  const reparados = [];
  const fallidos = [];
  if (repararFlag) {
    const idsPorActividad = new Map();
    for (const c of aReparar) {
      try {
        const evento = construirEvento(c.actividad, c.sesion, labels);
        const propuesto = idDeEvento(c.sesion.id);
        const { data } = await cal.crear(propuesto, evento);
        const eventId = data?.id ?? propuesto;
        if (!idsPorActividad.has(c.actividadId)) idsPorActividad.set(c.actividadId, new Map());
        idsPorActividad.get(c.actividadId).set(c.sesion.id, eventId);
        reparados.push({ ...c, eventId });
      } catch (e) {
        fallidos.push({ ...c, error: e?.message ?? String(e) });
      }
    }

    for (const [actividadId, ids] of idsPorActividad) {
      const ref = db.doc(`actividades/${actividadId}`);
      // eslint-disable-next-line no-await-in-loop
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists) return;
        const sesiones = reponerIds(doc.data().sesiones ?? [], ids);
        if (sesiones) tx.update(ref, { sesiones });
      });
    }
  }

  return {
    verificados: candidatas.length,
    truncado,
    siguienteCursor,
    borradosAMano: aReparar,
    desconocidos,
    reparados,
    fallidos,
  };
};

/** `--desde <id>` — el cursor que imprimió una corrida anterior truncada. */
const leerDesde = (argv) => {
  const i = argv.indexOf('--desde');
  return i === -1 ? undefined : argv[i + 1];
};

const main = async () => {
  const reparar = process.argv.includes('--reparar');
  const desde = leerDesde(process.argv);
  const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

  initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });
  const db = getFirestore();

  console.log(
    enEmulador
      ? `Firestore: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})`
      : `Firestore: PRODUCCIÓN (${projectId})`,
  );
  console.log('Calendar: SIEMPRE el real — no hay emulador para esta API.');
  console.log(reparar ? 'Modo: VERIFICAR Y REPARAR' : 'Modo: solo verificar (sin --reparar)');
  if (desde) console.log(`Retomando después de: ${desde}`);
  console.log('');

  const [cal, labels] = await Promise.all([clienteCalendar(), cargarLabels(db)]);
  const resumen = await ejecutarVerificacion({ db, cal, labels, reparar, desde });

  console.log(
    `Verificados: ${resumen.verificados}` +
      (resumen.truncado
        ? ` (tope alcanzado — correlo de nuevo con --desde ${resumen.siguienteCursor} para seguir con las que faltan)`
        : ''),
  );

  if (resumen.borradosAMano.length === 0) {
    console.log('Ningún evento borrado a mano detectado.');
  } else {
    console.log(`\nBorrados a mano en Calendar (${resumen.borradosAMano.length}):`);
    for (const c of resumen.borradosAMano) {
      console.log(`  - ${c.actividad.titulo} (${c.actividadId}) · sesión ${c.sesion.id}`);
    }
    console.log(
      reparar
        ? `\nRecreados: ${resumen.reparados.length}${resumen.fallidos.length ? `, fallaron: ${resumen.fallidos.length}` : ''}`
        : '\nCorré con --reparar para recrearlos.',
    );
    for (const f of resumen.fallidos) {
      console.error(`  ! falló ${f.actividadId}/${f.sesion.id}: ${f.error}`);
    }
  }

  if (resumen.desconocidos.length > 0) {
    console.log(
      `\nNo se pudieron verificar (${resumen.desconocidos.length}) — código de error ambiguo, no se tocan:`,
    );
    for (const c of resumen.desconocidos) {
      console.log(`  - ${c.actividad.titulo} (${c.actividadId}) · sesión ${c.sesion.id}`);
    }
  }

  process.exit(resumen.fallidos.length > 0 ? 1 : 0);
};

// `import.meta.url` se compara contra `process.argv[1]` para que el módulo se
// pueda importar desde un test (`ejecutarVerificacion`) sin disparar `main`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('Falló la verificación:', e);
    process.exit(1);
  });
}
