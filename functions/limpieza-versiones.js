/**
 * B-89 — decide qué subcolecciones `versiones` quedaron huérfanas: su actividad
 * ya no existe, y el rescate del borrado ya venció.
 *
 * **Todo lo de acá es puro** salvo `subcoleccionesHuerfanas`, que recibe el `db`
 * y no importa `firebase-admin` (mismo criterio que `referenciasEnUso` en
 * `limpieza-imagenes.js`). El pegamento vive en
 * `versiones-limpieza-trigger.js`: lo que decide se puede probar.
 *
 * ── El problema ───────────────────────────────────────────────────────────
 * `borrarActividad` es un `deleteDoc`, y Firestore **no borra subcolecciones**.
 * Las hasta 20 versiones de `/actividades/{id}/versiones/*` quedan para siempre,
 * con copias completas del documento —`online.url` y `difusion` incluidos— y sin
 * ninguna forma de llegar a ellas desde el panel. No es una fuga (las reglas
 * limitan la lectura al claim `admin` igual que antes), pero es basura que crece
 * y datos internos que sobreviven a la decisión de borrar la actividad.
 *
 * ── Por qué NO es un `onDocumentDeleted` que purgue en el acto ─────────────
 * Que es lo que B-89 proponía, y es lo que no se puede hacer: el borrado de una
 * actividad **escribe** una versión (`guardarVersionAlBorrar`, B-41) y esa
 * versión es la única de la que se puede recuperar la actividad entera. Un
 * segundo trigger sobre el mismo borrado la borraría —y encima en carrera con el
 * primero, porque el orden entre dos triggers del mismo evento no está
 * definido—: el arreglo de B-89 dejaría inerte al de B-41.
 *
 * Por eso hay **margen de rescate**: la subcolección huérfana sobrevive
 * `MARGEN_DE_RESCATE_MS` desde su versión más nueva, que para una actividad
 * borrada es el instante del borrado. Después se va. El barrido es un
 * `onSchedule` y no un trigger justamente porque tiene que correr *más tarde*,
 * no en el momento del borrado.
 *
 * ── Por qué esto no es la trampa 3 ni la 12 ───────────────────────────────
 * Este barrido escribe (borra) en `/actividades/{id}/versiones/*`. Los dos
 * triggers de Firestore que escuchan actividades —`syncCalendar` y
 * `guardarVersion`— están suscriptos a `actividades/{id}`, no a su subcolección,
 * y un trigger de documento **no se dispara con escrituras en subcolecciones**.
 * Nada del proyecto escucha `versiones/{version}`. Sin un trigger del otro lado,
 * no hay con qué encadenarse. Es el mismo argumento que el de
 * `limpieza-imagenes.js`, y como aquel, corre por reloj y solo borra.
 *
 * Está probado en `tests/limpieza-versiones.test.ts`.
 */
import { milisDe } from './calendario.js';

/**
 * 30 días desde la versión más nueva de la subcolección huérfana.
 *
 * Es el tiempo que se le da al «la borré sin querer». El caso de uso de la
 * retención por cantidad (D-42) es otro —«pisé la descripción hace meses»— y por
 * eso ahí el criterio no es temporal; acá la pregunta es distinta: cuánto tarda
 * alguien en notar que una actividad **entera** ya no está. Un mes cubre un ciclo
 * completo de uso del panel, y es corto contra «para siempre», que es lo que
 * B-89 viene a arreglar.
 *
 * Es un parámetro con default para que el test pueda simular el vencimiento sin
 * esperar un mes — mismo criterio que `decidirDisparo` con el reloj
 * (`05-patrones.md` § «El reloj también es infraestructura»).
 */
export const MARGEN_DE_RESCATE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tope de **actividades** purgadas por corrida (no de documentos borrados: las
 * versiones de una actividad se van juntas o no se van, porque media
 * subcolección huérfana es peor que la entera).
 *
 * Misma clase de salvaguarda que `MAX_BORRADOS_POR_CORRIDA` en
 * `limpieza-imagenes.js` y `MAX_EVENTOS_RESYNC` en `opciones-trigger.js`: un bug en la
 * lectura de qué actividades existen —una query que vino vacía, por ejemplo— no
 * puede borrar el historial de todas en una sola pasada. Lo que sobra queda para
 * la corrida siguiente, y lo dice el log.
 */
export const MAX_ACTIVIDADES_POR_CORRIDA = 20;

/**
 * ¿Qué subcolecciones hay que purgar?
 *
 * @param {{
 *   huerfanas?: { actividadId: string, versiones: { id: string, guardadoEn?: unknown }[] }[],
 *   ahora?: number,
 *   margenMs?: number,
 * }} _
 * @returns {{
 *   aPurgar: { actividadId: string, versiones: string[] }[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirPurga = ({
  huerfanas = [],
  ahora = Date.now(),
  margenMs = MARGEN_DE_RESCATE_MS,
} = {}) => {
  const aPurgar = [];
  const motivos = {};

  for (const { actividadId, versiones = [] } of huerfanas) {
    if (versiones.length === 0) {
      // No hay nada que borrar. Es el caso de una actividad que nunca se editó:
      // `listDocuments()` no la devolvería, pero un cursor a mitad de camino o
      // una purga anterior sí pueden dejar la subcolección vacía.
      motivos[actividadId] = 'sin-versiones';
      continue;
    }

    // La más nueva. Para una actividad borrada es la que escribió
    // `guardarVersionAlBorrar` (B-41), o sea el instante del borrado; para una
    // huérfana anterior a B-41, la última edición — que es más vieja todavía, así
    // que vence antes. Las dos lecturas son correctas.
    const instantes = versiones.map((v) => milisDe(v?.guardadoEn));

    if (instantes.some((t) => t === null)) {
      // Falla cerrado: una versión sin fecha legible es una que no sabemos
      // fechar, y no se puede afirmar que el rescate venció. Mismo criterio que
      // `decidirLimpieza` ante un objeto sin `timeCreated` — y acá importa más,
      // porque lo que está en juego es la única copia de una actividad borrada.
      motivos[actividadId] = 'sin-fecha-legible';
      continue;
    }

    const masNueva = Math.max(...instantes);
    if (ahora - masNueva < margenMs) {
      motivos[actividadId] = 'dentro-del-margen-de-rescate';
      continue;
    }

    motivos[actividadId] = 'huerfana-vencida';
    aPurgar.push({ actividadId, versiones: versiones.map((v) => v.id) });
  }

  if (aPurgar.length <= MAX_ACTIVIDADES_POR_CORRIDA) return { aPurgar, motivos };

  // El tope corta la lista, pero los motivos de TODO lo revisado quedan: así el
  // log dice qué se salteó por el tope y no solo qué se borró.
  const recortado = aPurgar.slice(0, MAX_ACTIVIDADES_POR_CORRIDA);
  for (const { actividadId } of aPurgar.slice(MAX_ACTIVIDADES_POR_CORRIDA)) {
    motivos[actividadId] = `${motivos[actividadId]}-pendiente-por-tope`;
  }
  return { aPurgar: recortado, motivos };
};

/**
 * Las referencias de `/actividades` cuyo documento **no existe** pero que
 * todavía tienen algo colgando.
 *
 * `listDocuments()` es la pieza clave y es la única forma de encontrarlas:
 * devuelve las referencias de la colección **incluidas las de documentos que no
 * existen pero tienen subcolecciones** —los "fantasmas" que deja un `deleteDoc`—,
 * que es justamente lo que ninguna query puede ver. La query `select()` de al
 * lado trae los ids que **sí** existen; la diferencia entre las dos listas son
 * los huérfanos.
 *
 * Recibe el `db` en vez de importar `firebase-admin`, así vive en el módulo puro
 * y el test lo importa de acá y no del trigger — que arrastra
 * `firebase-functions/scheduler`, ausente en el `node_modules` de la raíz
 * (B-561).
 */
export const subcoleccionesHuerfanas = async (db) => {
  const coleccion = db.collection('actividades');
  const [referencias, vivas] = await Promise.all([
    coleccion.listDocuments(),
    // `select()` sin campos: trae solo los ids, que es todo lo que hace falta.
    coleccion.select().get(),
  ]);

  const existentes = new Set(vivas.docs.map((d) => d.id));
  return referencias.filter((ref) => !existentes.has(ref.id));
};
