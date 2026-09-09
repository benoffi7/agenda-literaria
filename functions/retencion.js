/**
 * **B-838 / DEC-13 — una propuesta rechazada no se guarda para siempre.**
 *
 * Es el paso 11 de la tajada 1, adelantado por decisión del dueño (B-843 punto
 * 1): la excepción del borrado tiene que existir **antes** que el dato, y una
 * propuesta lleva el mail o el WhatsApp de alguien que no está logueado —el
 * primer dato personal de un tercero que el proyecto guarda, y el que B-102 daba
 * por inexistente—.
 *
 * A los **30 días** de rechazada se va el documento **y su imagen**. Las dos
 * mitades juntas, y eso no es prolijidad: es el punto 4 de «las nueve cosas que
 * se rompen en silencio» del inventario. Un objeto que sobrevive a su documento
 * es una foto de una persona **sin nada que la referencie**, así que no hay desde
 * dónde volver a encontrarla para borrarla; y un documento que sobrevive a su
 * objeto muestra un flyer roto en la bandeja.
 *
 * **Todo lo de acá es puro** salvo `propuestasVencibles` y `borrarPropuesta`, que
 * reciben el `db` y el `bucket` y no importan `firebase-admin` — mismo criterio
 * que `subcoleccionesHuerfanas` en `limpieza-versiones.js` y `referenciasEnUso`
 * en `limpieza-imagenes.js`, y por el mismo motivo práctico: así el test los
 * importa **de acá** y no del trigger, que arrastra
 * `firebase-functions/scheduler` (B-561). El pegamento vive en
 * `retencion-trigger.js`.
 *
 * ── Por qué NO es un trigger sobre el rechazo ─────────────────────────────
 * Porque el rechazo no es el borrado: DEC-13 pide **30 días**, que es el margen
 * para el «lo rechacé sin querer» —la bandeja ofrece reabrir— y para que quien
 * propuso pueda repreguntar. Un `onDocumentUpdated` que borrara en el acto haría
 * imposible las dos cosas. Es el mismo argumento del margen de rescate de
 * `limpieza-versiones.js`, con otro número.
 *
 * ── Y por qué esto no es la trampa 3 ni la 12 ─────────────────────────────
 * Este barrido corre por reloj y solo **borra**: en Firestore, un documento de
 * `/propuestas`, colección que **ningún trigger escucha**; en Storage, un objeto
 * bajo `propuestas/`, y un `delete()` dispara `onObjectDeleted`, al que nada de
 * este proyecto está suscripto (`optimizarImagen` es `onObjectFinalized`). Sin un
 * trigger del otro lado, no hay con qué encadenarse. Mismo argumento que
 * `limpieza-imagenes.js`.
 *
 * Está probado en `tests/retencion.test.ts` (la decisión) y en
 * `tests/retencion.integracion.test.ts` (las dos mitades del borrado, contra los
 * emuladores de Firestore y de Storage).
 */
import { milisDe } from './calendario.js';

/**
 * 30 días desde el rechazo — **DEC-13**, contestada por el dueño el 2026-09-08.
 *
 * Se cuenta desde `revision.en` (cuándo se rechazó) y no desde `creadoEn`: el
 * plazo es del rechazo, así que una propuesta que estuvo dos meses en la bandeja
 * y recién ayer se rechazó tiene sus treinta días completos.
 *
 * Parámetro con default para que el test simule el vencimiento sin esperar un
 * mes, como `MARGEN_DE_RESCATE_MS` (`05-patrones.md` § «El reloj también es
 * infraestructura»).
 */
export const MARGEN_DE_RETENCION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tope de propuestas borradas por corrida. Misma salvaguarda que
 * `MAX_BORRADOS_POR_CORRIDA` y `MAX_ACTIVIDADES_POR_CORRIDA`: un bug en la
 * lectura —una fecha mal leída que haga vencer todo, por ejemplo— no puede
 * vaciar la bandeja en una sola pasada. Lo que sobra queda para mañana y lo dice
 * el log.
 */
export const MAX_PROPUESTAS_POR_CORRIDA = 50;

/**
 * El prefijo de Storage donde vive la imagen de una propuesta (DEC-11).
 *
 * Está escrito acá y en el `matches('^propuestas/…')` de `firestore.rules`, que
 * es el mismo caso que los topes de `types/propuesta.ts`: dos runtimes que no se
 * pueden importar entre sí, atados por un test que lee los dos archivos
 * (`tests/retencion.test.ts`). **Va a ser un tercero** cuando el paso 8 escriba
 * el bloque de `storage.rules`; hoy ese bloque no existe y por eso el test no lo
 * mira — un aserto contra un archivo que no dice nada del prefijo pasaría por
 * ausencia.
 */
export const PREFIJO_PROPUESTAS = 'propuestas/';

/**
 * El objeto que hay que borrar junto con la propuesta, o `null`.
 *
 * ── El `startsWith` no es higiene: es lo que impide borrar el flyer de una
 * actividad publicada ──────────────────────────────────────────────────────
 * Esta Function corre con el **Admin SDK**, así que **no pasa por
 * `firestore.rules`**: el `matches('^propuestas/…')` que valida la escritura no
 * la protege a ella. Un documento escrito antes de esa cláusula, o por un camino
 * futuro que se olvide de validar, puede nombrar `imagenes/img_<uuid>.jpg` de una
 * actividad **real y publicada** — y el path no hay que adivinarlo: viaja adentro
 * de la URL de descarga. Borrarlo deja el sitio con la imagen rota, en vivo, y
 * sin forma de recuperarla.
 *
 * Es exactamente el hallazgo que el `auditor-privacidad` cobró sobre la regla en
 * el paso 5, del lado donde la regla no llega. Dos guardas y las dos hacen falta:
 * el prefijo, y **un solo segmento** debajo de él (`propuestas/../imagenes/x.jpg`
 * empieza con el prefijo y no está adentro).
 */
export const objetoDePropuesta = (imagen) => {
  const path = imagen && typeof imagen === 'object' ? imagen.storagePath : null;
  if (typeof path !== 'string' || !path.startsWith(PREFIJO_PROPUESTAS)) return null;
  const resto = path.slice(PREFIJO_PROPUESTAS.length);
  return resto.length > 0 && !resto.includes('/') ? path : null;
};

/**
 * ¿Qué propuestas caducaron?
 *
 * @param {{
 *   propuestas?: { id: string, estado?: string, revision?: unknown, imagen?: unknown }[],
 *   ahora?: number,
 *   margenMs?: number,
 * }} _
 * @returns {{
 *   aBorrar: { id: string, objeto: string | null }[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirRetencion = ({
  propuestas = [],
  ahora = Date.now(),
  margenMs = MARGEN_DE_RETENCION_MS,
} = {}) => {
  const aBorrar = [];
  const motivos = {};

  for (const p of propuestas) {
    /*
     * **Solo las rechazadas**, que es lo que DEC-13 contestó. El trigger ya
     * consulta por estado, así que en producción esta cláusula no ve otra cosa —
     * y está igual, porque el filtro de la query es del pegamento y esta función
     * es la que dice qué se borra. Que una `nueva` o una `aceptada` no caduquen
     * es una decisión con costo, y está anotada: **B-844**.
     */
    if (p.estado !== 'rechazada') {
      motivos[p.id] = `estado-${p.estado}`;
      continue;
    }

    const rechazadaEn = milisDe(p?.revision?.en);
    if (rechazadaEn === null) {
      /*
       * Falla cerrado, como `decidirPurga` y `decidirLimpieza`: una propuesta sin
       * fecha de revisión legible es una que no sabemos fechar, y no se puede
       * afirmar que el plazo venció. Queda en la bandeja y se ve — que es mejor
       * que borrar algo de ayer.
       */
      motivos[p.id] = 'sin-fecha-legible';
      continue;
    }

    if (ahora - rechazadaEn < margenMs) {
      motivos[p.id] = 'dentro-del-plazo';
      continue;
    }

    const objeto = objetoDePropuesta(p.imagen);
    if (p?.imagen?.storagePath && !objeto) {
      /*
       * **Falla cerrado, y esta guarda la trajo el `auditor-privacidad`.**
       *
       * `objetoDePropuesta` devuelve `null` en dos situaciones que no son la
       * misma: «no hay imagen propia» (bien, no hay nada que borrar) y «hay un
       * `storagePath` que no calza el prefijo» (mal). Sin este corte, el segundo
       * caso borraba **el documento igual** y dejaba el objeto vivo: o sea la
       * foto de una persona sin nada que la nombre, y bajo un prefijo que
       * `limpiarImagenesHuerfanas` **no barre** (solo recorre `imagenes/` y
       * `miniaturas/`). Nadie la vuelve a encontrar nunca.
       *
       * Es el punto 4 de «las nueve cosas que se rompen en silencio» en su peor
       * versión, y la asimetría se veía al lado de `sin-fecha-legible`: ahí un
       * dato ilegible bloquea, acá no bloqueaba. El docblock de
       * `objetoDePropuesta` construye el caso sobre un documento mal escrito y
       * después no lo trataba.
       */
      motivos[p.id] = 'imagen-fuera-del-prefijo';
      continue;
    }

    motivos[p.id] = 'rechazada-vencida';
    aBorrar.push({ id: p.id, objeto });
  }

  if (aBorrar.length <= MAX_PROPUESTAS_POR_CORRIDA) return { aBorrar, motivos };

  const recortado = aBorrar.slice(0, MAX_PROPUESTAS_POR_CORRIDA);
  for (const { id } of aBorrar.slice(MAX_PROPUESTAS_POR_CORRIDA)) {
    motivos[id] = `${motivos[id]}-pendiente-por-tope`;
  }
  return { aBorrar: recortado, motivos };
};

/**
 * Las rechazadas, con **lo mínimo** para decidir.
 *
 * El `select()` no es una optimización: es lo que hace que el contacto de quien
 * propuso —el dato personal del tercero— **no entre a la memoria de la Function**
 * ni pueda terminar en un log por accidente. Lo único que este barrido necesita
 * saber de una propuesta es cuándo se rechazó y qué objeto tiene colgado.
 *
 * **Y por eso los dos campos anidados van por su path y no enteros** — lo corrigió
 * el `auditor-privacidad`. `select('revision')` traía también `revision.motivo`
 * («una nota interna sobre el trabajo de otra persona», con su propia fila en
 * `07-seguridad.md`) y `revision.porUid`, que es un uid. No era una fuga —nada de
 * eso se loguea— pero la doc decía «trae lo mínimo» y no lo traía, y la distancia
 * era una línea. Importa además por la trampa del nombre: el log ya tiene una
 * clave `causa`, y con el motivo del rechazo ya en memoria, «enriquecer el log»
 * sería un renglón.
 *
 * `where('estado','==','rechazada')` es de un solo campo, así que no pide índice
 * compuesto — por eso tampoco lleva `orderBy`, que sí lo pediría.
 *
 * @returns {Promise<{ id: string, estado: string, revision: unknown, imagen: unknown }[]>}
 */
export const propuestasVencibles = async (db) => {
  const snap = await db
    .collection('propuestas')
    .where('estado', '==', 'rechazada')
    .select('estado', 'revision.en', 'imagen.storagePath')
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    estado: d.get('estado'),
    revision: d.get('revision'),
    imagen: d.get('imagen'),
  }));
};

/**
 * Borra una propuesta caducada: **el objeto primero, el documento después**.
 *
 * El orden es la parte que importa y es al revés de lo intuitivo. Si fallara el
 * borrado del objeto con el documento ya borrado, la foto quedaría en el bucket
 * **sin nada que la nombre**: el barrido de huérfanas de B-221 solo recorre
 * `imagenes/` y `miniaturas/`, así que nadie la volvería a encontrar. Con este
 * orden, un fallo deja las dos cosas en pie y la corrida de mañana reintenta.
 *
 * `ignoreNotFound` es lo que hace que ese reintento funcione: si el objeto ya no
 * está —porque la corrida anterior murió justo en el medio— borrarlo de nuevo no
 * es un error, es el estado que se quería.
 */
export const borrarPropuesta = async (db, bucket, { id, objeto }) => {
  if (objeto) await bucket.file(objeto).delete({ ignoreNotFound: true });
  await db.collection('propuestas').doc(id).delete();
};
