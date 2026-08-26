/**
 * §12 y B-40 — el historial de versiones, del lado del panel.
 *
 * El historial ya se guardaba: `functions/historial-trigger.js` escribe el
 * documento anterior en `/actividades/{id}/versiones/{version}` en cada edición
 * que pisa contenido, y también al borrar (B-41). Lo que no existía era la forma
 * de mirarlo: recuperar un campo pisado era abrir la consola de Firestore, elegir
 * un documento por su id —que es una fecha— y copiar el valor a mano.
 *
 * **Restaurar campo por campo, no el documento entero.** Restaurar todo pisaría
 * los cambios posteriores que sí se querían: el caso real es "me comí la
 * descripción hace dos ediciones", no "quiero volver al martes". Con el campo,
 * lo que se recupera es exactamente lo que se perdió.
 *
 * **Qué campos cambió cada versión no se recalcula acá**: viene guardado en el
 * documento (`camposCambiados`), que es lo que la Function ya computó cuando
 * decidió guardarla. Lo que sí se calcula es la comparación **contra el documento
 * de hoy**, que es otra pregunta: una versión de hace cinco ediciones pisó un
 * campo que quizá ya volvió a su valor.
 *
 * Esa comparación se importa de `@historial` —la misma función que usa el
 * trigger— y no se reimplementa. Si el panel tuviera su propia idea de qué campos
 * escribe la máquina, un campo nuevo entraría en una lista y no en la otra, y el
 * panel ofrecería "restaurar" un `updatedAt`. Es el patrón de `@calendario`
 * (D-20) aplicado al §12.
 */
import {
  collection,
  doc,
  documentId,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09, D-51).
import { db } from '@/lib/firestore-client';
import { CAMPOS_DE_SEARCH_TEXT, buildSearchText } from '@/lib/normalize';
import { fechaHoraCorta } from '@/lib/sesiones';
import { camposCambiados } from '@historial';
import type { Actividad, ActividadConId, Sesion, TimestampLike } from '@/types/actividad';

const COL = 'actividades';
const SUB = 'versiones';

/** Un documento de `/actividades/{id}/versiones/{version}`. */
export interface Version {
  /** Cuándo se pisó el contenido. Es el `event.time` del trigger. */
  guardadoEn: TimestampLike | null;
  /** uid del que hizo la edición que pisó estos datos. Nunca sale del panel. */
  actualizadoPor: string | null;
  /** Campos de primer nivel que esa edición cambió, calculados por la Function. */
  camposCambiados: string[];
  /** `true` si la versión es la de un borrado (B-41): es la actividad entera. */
  borrado: boolean;
  /** El documento completo tal como estaba antes. */
  documento: Actividad;
}

export interface VersionConId extends Version {
  /** `2026-08-24T19-30-00-000Z_<evento>` — ordena cronológicamente (D-43). */
  id: string;
}

/**
 * Las versiones de una actividad, de la más nueva a la más vieja.
 *
 * Se ordena por id del documento y no por `guardadoEn` porque el id **es** el
 * instante (D-43) y es de ancho fijo: el orden lexicográfico es el cronológico,
 * y así no hace falta un índice ni depender de un campo que podría faltar en un
 * documento viejo.
 *
 * Sin `limit`: la retención ya las acota a `MAX_VERSIONES` (20) por actividad
 * (D-42), así que no hay paginado que inventar.
 */
export const listarVersiones = async (actividadId: string): Promise<VersionConId[]> => {
  const q = query(collection(db(), COL, actividadId, SUB), orderBy(documentId(), 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const datos = d.data() as Partial<Version>;
    return {
      id: d.id,
      guardadoEn: datos.guardadoEn ?? null,
      actualizadoPor: datos.actualizadoPor ?? null,
      camposCambiados: datos.camposCambiados ?? [],
      borrado: datos.borrado === true,
      documento: (datos.documento ?? {}) as Actividad,
    };
  });
};

// ─────────────────────────────────────────────────────────────────
// Qué se puede restaurar — lógica pura
// ─────────────────────────────────────────────────────────────────

/**
 * Trampa 10 — el slug es inmutable después de publicar: restaurarlo rompe la URL
 * que ya está indexada y compartida. El formulario lo bloquea por la misma razón
 * (`slugBloqueado`), y el historial no puede ser la puerta de atrás.
 */
export const slugRestaurable = (actual: Actividad): boolean => actual.estado !== 'publicado';

/**
 * Los campos de esta versión que **hoy** están distintos, o sea lo único que
 * tiene sentido ofrecer para restaurar.
 *
 * No es `version.camposCambiados`: eso dice qué pisó esa edición en su momento.
 * Si dos ediciones después el campo volvió solo a su valor viejo, restaurarlo no
 * hace nada, y ofrecerlo es ruido en una pantalla que se usa apurado.
 *
 * `camposCambiados` viene de `@historial`, la misma función del trigger, así que
 * los campos de máquina (`updatedAt`, `updatedBy`, `calendarEventId`) quedan
 * afuera sin que este módulo tenga que saber cuáles son.
 */
export const camposRestaurables = (version: Version, actual: Actividad): string[] =>
  (camposCambiados(version.documento, actual) as string[])
    .filter((campo) => campo !== 'slug' || slugRestaurable(actual))
    .filter((campo) => existiaEnLaVersion(campo, version));

/**
 * ¿El campo **existía** cuando se guardó esta versión?
 *
 * `camposCambiados` une las claves de los dos documentos, así que un campo que se
 * agregó al modelo **después** de esta versión sale reportado como cambiado — con
 * razón, para el trigger que decide si vale guardar una versión. Pero para decidir
 * qué es *restaurable* ese criterio miente: no hay nada que restaurar, el campo no
 * existía.
 *
 * Sin este filtro, `valorARestaurar` lo convierte en `null` con su `??`, y
 * `restaurarCampo` lo escribe con un `updateDoc` que **no pasa por el schema**. O
 * sea: la pantalla ofrece "Imágenes — Decía: (vacío)" sobre una versión anterior a
 * B-167, y restaurarla escribe `imagenes: null` en el documento en vivo. De ahí
 * `imagenesDe` lo ve falsy, cae al `imagenUrl` viejo, y **la galería entera se
 * reemplaza por la imagen de antes de la migración** — que además llega al sitio
 * sola, porque la escritura marca rebuild. Nada tira error en toda la cadena.
 *
 * **Es la clase, no la instancia.** Le pasa a cualquier campo agregado al modelo
 * después de que se guardó una versión: `imagenes` es el más nuevo y el que más
 * duele, pero el mismo camino existía para todos los anteriores. Es el patrón del
 * §5 de `05-patrones.md` —un campo nuevo se lee con el default que preserva lo
 * anterior— aplicado al lugar donde nadie lo miró: la restauración.
 */
const existiaEnLaVersion = (campo: string, version: Version): boolean =>
  campo in (version.documento as unknown as Record<string, unknown>);

/**
 * El valor que se va a escribir, que **no siempre es el que dice la versión**.
 *
 * `sesiones` es el caso, y es la trampa cara de esta pantalla: la versión guarda
 * el array completo, `calendarEventId` incluido. Escribirlo tal cual le
 * devolvería al documento ids de eventos de Calendar de hace tres ediciones, y a
 * partir de ahí el diff del §7.2 trabaja sobre ids que pueden no existir más: un
 * `update` contra un evento borrado, o peor, un `insert` que duplica el encuentro
 * en el calendario **público**. Es exactamente la clase de B-80 —un campo que
 * escribe el backend viajando de vuelta por el cliente— y acá entraría por una
 * puerta nueva.
 *
 * La regla, entonces: de la versión sale el **contenido** de cada encuentro
 * (fecha, tema, lectura, cancelado) y del documento de hoy sale su
 * `calendarEventId`, emparejando por `id` de sesión —que es estable y por eso
 * existe (§7.2, trampa 2)—. Una sesión que la versión trae y hoy no existe queda
 * con `calendarEventId: null`, así el sync le crea su evento como si fuera nueva,
 * que es lo correcto.
 */
export const valorARestaurar = (
  campo: string,
  version: Version,
  actual: Actividad,
): unknown => {
  const viejo = (version.documento as unknown as Record<string, unknown>)[campo] ?? null;
  if (campo !== 'sesiones') return viejo;

  const idsDeHoy = new Map(
    (actual.sesiones ?? []).map((s) => [s.id, s.calendarEventId ?? null] as const),
  );
  return ((viejo ?? []) as Sesion[]).map((s) => ({
    ...s,
    calendarEventId: idsDeHoy.get(s.id) ?? null,
  }));
};

/**
 * Los campos con los que se arma el `searchText` (§6).
 *
 * Restaurar un título sin recalcularlo dejaría la búsqueda del panel encontrando
 * la actividad por un texto que ya no está escrito en ninguna parte — y peor, el
 * `searchText` viaja al `events.json` (§5.2), así que la incoherencia sale al
 * sitio público. `formADocumento` lo recalcula en cada guardado justamente por
 * esto; el historial escribe por otro camino y tiene que hacer lo mismo.
 */
/**
 * De qué campos sale el `searchText`. **Importada, no copiada:** esta lista tenía
 * su propia versión con cinco de los seis, y al agregar el libro (DEC-1) restaurar
 * un libro viejo escribía el campo y dejaba el índice de búsqueda con el título
 * descartado — que es lo que sale al `events.json`. Ver `CAMPOS_DE_SEARCH_TEXT`.
 */
const CAMPOS_DE_BUSQUEDA: readonly string[] = CAMPOS_DE_SEARCH_TEXT;

/**
 * El objeto que se le manda a `updateDoc`: el campo restaurado, la autoría de
 * quien restauró, y `searchText` si hizo falta.
 *
 * Es puro para poder verificar sin Firestore las dos cosas que importan: que
 * `calendarEventId` no viaje hacia atrás, y que el `searchText` acompañe.
 */
export const payloadDeRestauracion = (
  campo: string,
  version: Version,
  actual: Actividad,
  uid: string,
): Record<string, unknown> => {
  const valor = valorARestaurar(campo, version, actual);
  const payload: Record<string, unknown> = { [campo]: valor };

  if (CAMPOS_DE_BUSQUEDA.includes(campo)) {
    payload.searchText = buildSearchText({ ...actual, [campo]: valor });
  }

  // La restauración es una edición más y se firma como tal: quien la hizo queda
  // en `updatedBy`, y `updatedAt` la ordena en el listado como cualquier otra.
  payload.updatedBy = uid;
  payload.updatedAt = serverTimestamp();
  return payload;
};

/**
 * Cómo se ve un valor viejo en la pantalla, en una línea.
 *
 * Sin esto la única forma de decidir si una versión es la que se busca es
 * restaurarla y ver qué pasa, que en una pantalla de recuperación es lo último
 * que se quiere. No pretende ser un diff: alcanza con reconocer *"sí, esa era la
 * descripción larga"*.
 *
 * Los `Timestamp` se detectan por forma y no por `instanceof`: el mismo valor
 * llega como `Timestamp` del SDK en el panel y como objeto plano en los tests,
 * igual que hace `canonico` en el trigger.
 */
export const resumenDeCampo = (valor: unknown, largo = 90): string => {
  if (valor === null || valor === undefined) return '(vacío)';
  if (typeof valor === 'string') {
    const limpio = valor.trim();
    if (limpio === '') return '(vacío)';
    return limpio.length > largo ? `${limpio.slice(0, largo)}…` : limpio;
  }
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  if (typeof valor === 'number') return String(valor);
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '(ninguno)';
    return `${valor.length} ${valor.length === 1 ? 'elemento' : 'elementos'}`;
  }
  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    if (typeof o.toDate === 'function') {
      return fechaHoraCorta((o.toDate as () => Date)());
    }
    // Un objeto del modelo (sede, organizador, inscripción): lo que se reconoce
    // de un vistazo es su nombre, y si no tiene, sus claves con algo cargado.
    if (typeof o.nombre === 'string' && o.nombre.trim()) return o.nombre.trim();
    const cargadas = Object.keys(o).filter(
      (k) => o[k] !== null && o[k] !== '' && o[k] !== false,
    );
    return cargadas.length ? cargadas.join(', ') : '(vacío)';
  }
  return String(valor);
};

/**
 * Escribe la restauración.
 *
 * **Deja versión de lo restaurado, y está bien:** es una escritura al documento,
 * así que dispara `guardarVersion` y el estado anterior queda guardado. Deshacer
 * un "deshacer" tiene que ser posible.
 */
export const restaurarCampo = async (
  actual: ActividadConId,
  campo: string,
  version: Version,
  uid: string,
): Promise<void> => {
  await updateDoc(doc(db(), COL, actual.id), payloadDeRestauracion(campo, version, actual, uid));
};
