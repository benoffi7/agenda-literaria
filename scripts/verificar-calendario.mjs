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
 * `functions/reconciliacion.js`). El único camino que escribe sobre un evento
 * que existe es `--reescribir` (B-631), y solo sobre los que el reporte ya
 * listó como desactualizados.
 *
 *   node scripts/verificar-calendario.mjs              # reporta, no escribe nada
 *   node scripts/verificar-calendario.mjs --reparar     # además recrea los borrados a mano
 *   node scripts/verificar-calendario.mjs --reescribir  # además reescribe los desactualizados
 *
 * B-631 — además de si el evento existe, mira si **dice lo mismo** que el
 * código de hoy produciría (`construirEvento`, el mismo que usa la Function).
 * Los que difieren salen como «desactualizados», con los campos que cambian.
 * Reescribirlos es un flag **aparte** de `--reparar` a propósito: recrear un
 * evento que no está es reponer algo que falta; reescribir uno que está le
 * cambia el título o la descripción a quien ya lo tiene agendado (D-95), y
 * eso lo decide el dueño viendo el reporte, no un flag que ya usaba para otra
 * cosa.
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
import { construirEvento, milisDe } from '../functions/calendario.js';
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
 * B-631 — Calendar devuelve un campo vacío **omitiéndolo**, y `construirEvento`
 * puede producir `null` (una actividad sin sede no tiene `location`) o `''`.
 * Los tres son «no hay»: sin esto, toda actividad virtual saldría
 * desactualizada.
 */
const vacio = (v) => (v == null || v === '' ? null : v);

/**
 * B-631 — ¿el evento que Calendar tiene dice lo mismo que el código de hoy
 * produciría? Devuelve las claves que difieren (vacío = al día).
 *
 * Es la divergencia que la guarda del §7.1 no puede ver: los dos lados de esa
 * comparación se calculan con el código de hoy (D-07), así que un cambio en
 * *cómo se arma* la descripción deja los eventos publicados atrás sin emitir
 * ninguna operación (B-162). Desde afuera sí se ve, y este script es el único
 * que mira desde afuera.
 *
 * Se comparan **solo las claves que `construirEvento` produce**, derivadas de
 * `esperado` y no listadas a mano: Calendar devuelve además `etag`, `created`,
 * `updated`, `iCalUID`, `sequence`, `reminders`, `organizer`… y compararlo
 * entero daría «distinto» en el 100 % de los eventos. Derivarlas es lo que hace
 * que un campo nuevo del evento entre solo a este chequeo (el criterio de D-07).
 *
 * `start`/`end` se comparan por **instante y zona**, no por texto: Calendar
 * devuelve `dateTime` con el offset local (`…T19:00:00-03:00`) y nosotros
 * mandamos ISO en UTC (`…T22:00:00.000Z`). Son el mismo momento; comparar los
 * strings daría distinto siempre. El `timeZone` sí se compara tal cual — es la
 * trampa 1 del §13, y tiene que decir `America/Argentina/Buenos_Aires`.
 */
export const camposDivergentes = (esperado, enCalendar) => {
  const distintos = [];
  for (const clave of Object.keys(esperado)) {
    const a = esperado[clave];
    const b = enCalendar?.[clave];
    const esFecha = a != null && typeof a === 'object' && 'dateTime' in a;
    const iguales = esFecha
      ? milisDe(a.dateTime) !== null &&
        milisDe(a.dateTime) === milisDe(b?.dateTime) &&
        a.timeZone === b?.timeZone
      : vacio(a) === vacio(b);
    if (!iguales) distintos.push(clave);
  }
  return distintos;
};

/**
 * B-631 — las sesiones cuyo evento existe pero dice otra cosa. `eventos` es un
 * `Map` de `sesion.id` → el cuerpo que devolvió `events.get`.
 *
 * Solo mira las que `interpretarExistencia` dio por `'existe'`: sobre una que no
 * está, o una que no se pudo verificar, no hay contenido que comparar — y
 * afirmar divergencia sobre un `'desconocido'` produciría un `update` sobre una
 * sospecha, que es lo mismo que `interpretarExistencia` ya evita.
 */
export const planificarReescritura = (candidatas, resultados, eventos, construir) => {
  const desactualizados = [];
  for (const c of candidatas) {
    if ((resultados.get(c.sesion.id) ?? 'desconocido') !== 'existe') continue;
    const evento = construir(c.actividad, c.sesion);
    const campos = camposDivergentes(evento, eventos.get(c.sesion.id));
    if (campos.length > 0) desactualizados.push({ ...c, campos, evento });
  }
  return desactualizados;
};

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
    // `PUT` = `events.update`, el mismo verbo que usa la Function para una
    // operación `actualizar` (`calendario-trigger.js`): reemplaza el recurso
    // con lo que produce `construirEvento`, sin sumar nada.
    actualizar: (eventId, evento) => pedir('PUT', eventId, evento),
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
export const ejecutarVerificacion = async ({
  db,
  cal,
  labels,
  reparar: repararFlag,
  reescribir: reescribirFlag = false,
  desde = undefined,
}) => {
  let query = db
    .collection('actividades')
    .where('estado', '==', 'publicado')
    .orderBy(FieldPath.documentId());
  if (desde) query = query.startAfter(desde);
  const snap = await query.get();
  const actividades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const { candidatas, truncado, siguienteCursor } = sesionesAVerificar(actividades);

  const resultados = new Map();
  // B-631 — el cuerpo que ya devuelve `events.get`: antes se usaba solo
  // `status` y se descartaba el resto, sin una llamada más.
  const eventos = new Map();
  for (const c of candidatas) {
    const respuesta = await cal.obtener(c.sesion.calendarEventId);
    if (respuesta.ok) eventos.set(c.sesion.id, respuesta.data);
    resultados.set(
      c.sesion.id,
      interpretarExistencia(
        respuesta.ok ? { ok: true, status: respuesta.data.status } : { ok: false, code: respuesta.code },
      ),
    );
  }

  const { reparar: aReparar, desconocidos } = planificarReparacion(candidatas, resultados);
  const desactualizados = planificarReescritura(candidatas, resultados, eventos, (a, s) =>
    construirEvento(a, s, labels),
  );

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

  // B-631 — **después** de las recreaciones, y con su propio flag. Sin
  // write-back: el `calendarEventId` no cambia. Las dos listas no se pisan
  // (una reescritura es de un evento que existe, una recreación de uno que no),
  // pero el orden queda igual por si algún día se tocan.
  const reescritos = [];
  const fallidosReescritura = [];
  if (reescribirFlag) {
    for (const c of desactualizados) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await cal.actualizar(c.sesion.calendarEventId, c.evento);
        if (r && r.ok === false) throw new Error(`HTTP ${r.code}${r.cuerpo ? `: ${r.cuerpo}` : ''}`);
        reescritos.push(c);
      } catch (e) {
        fallidosReescritura.push({ ...c, error: e?.message ?? String(e) });
      }
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
    desactualizados,
    reescritos,
    fallidosReescritura,
  };
};

/** `--desde <id>` — el cursor que imprimió una corrida anterior truncada. */
const leerDesde = (argv) => {
  const i = argv.indexOf('--desde');
  return i === -1 ? undefined : argv[i + 1];
};

const main = async () => {
  const reparar = process.argv.includes('--reparar');
  const reescribir = process.argv.includes('--reescribir');
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
  const acciones = [reparar && 'REPARAR (recrea los borrados)', reescribir && 'REESCRIBIR (actualiza los desactualizados)']
    .filter(Boolean)
    .join(' + ');
  console.log(acciones ? `Modo: VERIFICAR + ${acciones}` : 'Modo: solo verificar (sin --reparar ni --reescribir)');
  if (desde) console.log(`Retomando después de: ${desde}`);
  console.log('');

  const [cal, labels] = await Promise.all([clienteCalendar(), cargarLabels(db)]);
  const resumen = await ejecutarVerificacion({ db, cal, labels, reparar, reescribir, desde });

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

  if (resumen.desactualizados.length === 0) {
    console.log('\nNingún evento desactualizado: los que existen dicen lo que el código de hoy produciría.');
  } else {
    console.log(
      `\nDesactualizados (${resumen.desactualizados.length}) — existen, pero dicen otra cosa que el código de hoy:`,
    );
    for (const c of resumen.desactualizados) {
      console.log(
        `  - ${c.actividad.titulo} (${c.actividadId}) · sesión ${c.sesion.id} · difiere: ${c.campos.join(', ')}`,
      );
    }
    console.log(
      reescribir
        ? `\nReescritos: ${resumen.reescritos.length}${resumen.fallidosReescritura.length ? `, fallaron: ${resumen.fallidosReescritura.length}` : ''}`
        : '\nCorré con --reescribir para actualizarlos (les cambia el texto a quien ya los tiene agendados).',
    );
    for (const f of resumen.fallidosReescritura) {
      console.error(`  ! falló ${f.actividadId}/${f.sesion.id}: ${f.error}`);
    }
  }

  process.exit(resumen.fallidos.length + resumen.fallidosReescritura.length > 0 ? 1 : 0);
};

// `import.meta.url` se compara contra `process.argv[1]` para que el módulo se
// pueda importar desde un test (`ejecutarVerificacion`) sin disparar `main`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('Falló la verificación:', e);
    process.exit(1);
  });
}
