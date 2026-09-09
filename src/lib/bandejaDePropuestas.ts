/**
 * **La bandeja de propuestas, del lado de los datos** — B-830, paso 7.
 *
 * Es a `/propuestas` lo que `reportes.ts` es a `/reportes`: la lectura en vivo
 * para la pantalla y las **únicas** escrituras que el panel puede hacer sobre
 * una propuesta. Lo demás —qué se ve, cómo se ve— es del componente.
 *
 * ── Lo que un admin puede escribir, y por qué es tan poco ─────────────────
 * Una propuesta es **prueba de qué se pidió**, así que su contenido no se edita:
 * si hay que corregir el título, se corrige en la actividad que sale de ella
 * (§4.3 del PRD). La regla lo hace cumplir —`revisionValida()` acota el update a
 * `estado` + `revision`— y este módulo no ofrece ningún otro camino, que es la
 * mitad de la propiedad: la regla frena lo que se intente, y acá no se intenta.
 *
 * ── Y una cosa que no está acá ────────────────────────────────────────────
 * **La conversión a actividad no vive en este archivo**: es pura y vive en
 * `propuestas.ts`, sin un solo `await`. Acá está solo el segundo movimiento de
 * **D-600** —marcar la propuesta aceptada con el id de la actividad que ya se
 * creó—, que es el que necesita Firestore.
 */
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09).
import { db } from '@/lib/firestore-client';
// Los dos saneadores de `href` del proyecto, importados y **no copiados**: dos
// versiones de «qué URL es segura» divergen y una queda vieja (la clase de B-88).
import { handleInstagram, urlSegura } from '@/lib/enlaceSeguro';
import type {
  EstadoPropuesta,
  FechaPropuesta,
  ImagenPropuesta,
  Propuesta,
  PropuestaConId,
  ViaContactoPropuesta,
} from '@/types/propuesta';

const COL = 'propuestas';

/**
 * Cuántas trae el `onSnapshot` de la bandeja.
 *
 * Mismo número y mismo motivo que `LIMITE_REPORTES` (B-580): la pantalla oculta
 * las cerradas por defecto y el filtro es **en memoria**, así que la query tiene
 * que traer de más para que una racha de aceptadas no le coma el lugar a las
 * pendientes. Filtrar en la query pediría un índice compuesto (`estado` +
 * `orderBy creadoEn`) para ahorrar cuarenta documentos.
 */
export const LIMITE_PROPUESTAS = 50;

/** Las que esperan una decisión. Es lo que cuenta el badge y lo que la bandeja muestra por defecto. */
export const ESTADOS_PENDIENTES = ['nueva', 'en-revision'] as const;

export const esPendiente = (p: Pick<Propuesta, 'estado'>): boolean =>
  (ESTADOS_PENDIENTES as readonly string[]).includes(p.estado);

/**
 * **El único cambio que el panel escribe**, armado aparte del `updateDoc` para
 * que se pueda verificar sin Firestore y —sobre todo— para que el test de
 * integración escriba **este** objeto contra el emulador en vez de un literal
 * calcado a mano, que es lo que se desincroniza (la clase de B-88).
 *
 * Los cuatro campos de `revision` van **siempre**, incluidos los dos que quedan
 * en `null`: `revisionValida()` los exige con un `hasAll` y ahí sí frena (en el
 * `create` no hacía falta, porque el default centinela ya tapa la clave
 * ausente). Mandar `{ porUid, en }` a secas es un permission-denied.
 *
 * `en` entra por parámetro y no se toma de acá: la regla pide `request.time`, o
 * sea `serverTimestamp()`, que es un valor de Firestore. Así la forma se testea
 * pura y el I/O queda en `revisarPropuesta`.
 */
export const cambioDeRevision = <T>(
  uid: string,
  estado: EstadoPropuesta,
  en: T,
  extras: { actividadId?: string | null; motivo?: string | null } = {},
): { estado: EstadoPropuesta; revision: Record<string, unknown> } => ({
  estado,
  revision: {
    porUid: uid,
    en,
    actividadId: extras.actividadId ?? null,
    motivo: extras.motivo ?? null,
  },
});

/**
 * A dónde lleva el contacto de quien propuso, si se puede armar un link seguro.
 *
 * ── Es texto de un anónimo puesto en un `href`, y eso tiene una trampa ────
 * `contacto.valor` es el **primer dato de un tercero sin login** que el panel
 * muestra, y el `href` es el lugar donde un string ajeno deja de ser texto: un
 * valor que empiece con `javascript:` es código que corre en el panel de un
 * admin logueado, con su sesión. React escapa el contenido de un atributo, no su
 * esquema.
 *
 * Por eso ninguna rama concatena el valor crudo:
 *
 *  - **mail** — se exige que parezca un mail antes de ponerle `mailto:`;
 *  - **whatsapp** — se queda con los dígitos y descarta todo lo demás, así que
 *    de `+54 9 11 2222-3333` sale `5491122223333` y de cualquier otra cosa no
 *    sale nada;
 *  - **instagram** — solo el alfabeto de un handle, sin la arroba.
 *
 * Y cuando no se puede armar, devuelve `null` **y no un link roto**: la pantalla
 * muestra el valor como texto plano, que sigue siendo útil (se copia y se pega)
 * y no es clickeable. Preferir el texto al link es lo barato de equivocarse.
 */
export const enlaceDeContacto = (c: {
  via: ViaContactoPropuesta;
  valor: string;
}): string | null => {
  const valor = c.valor.trim();
  if (c.via === 'mail') {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(valor)
      ? `mailto:${valor}`
      : null;
  }
  if (c.via === 'whatsapp') {
    const digitos = valor.replace(/\D/g, '');
    // Ocho es más corto que cualquier número con característica; quince es el
    // largo máximo de un número internacional (E.164).
    return digitos.length >= 8 && digitos.length <= 15 ? `https://wa.me/${digitos}` : null;
  }
  /*
   * `handleInstagram` y no un regex propio: es el mismo saneo que la ficha
   * pública ya hace —el alfabeto real de Instagram, sin barras que manden a otra
   * cuenta— y de paso acepta las formas en que alguien pega su cuenta
   * (`@casabrandon`, `instagram.com/casabrandon`).
   */
  const handle = handleInstagram(valor);
  return handle ? `https://instagram.com/${handle}` : null;
};

/**
 * La imagen que pegaron, si se puede abrir sin riesgo.
 *
 * **Es el otro `href` de texto ajeno de la bandeja, y lo señaló el
 * `auditor-privacidad`**: `imagen.url` es el único string de una propuesta que no
 * pasa por ningún validador de forma —la regla exige `is string` y 1–500
 * caracteres, el schema solo el largo— así que un `javascript:…` llega entero al
 * documento. Hoy no es explotable porque React reescribe ese esquema y porque el
 * `create` sigue cerrado a admin; con `/proponer` abierto (paso 9) la defensa no
 * puede ser el framework.
 *
 * `null` cuando no se puede: la pantalla muestra la URL como texto, igual que con
 * el contacto.
 */
export const enlaceDeImagen = (imagen: ImagenPropuesta | null): string | null =>
  imagen && 'url' in imagen ? urlSegura(imagen.url) : null;

/**
 * Una fecha propuesta, para leerla de un vistazo.
 *
 * **No pasa por `new Date`, y eso es la trampa 1 del §13 aplicada al revés**: lo
 * que hay acá son strings de hora de pared (D-590), y darles un `Date` para
 * formatearlos les inventaría una zona —la del navegador del admin— para después
 * leerlos en otra. Reordenar tres pedazos de string no puede correr una fecha un
 * día.
 */
export const fraseDeFechaPropuesta = (f: FechaPropuesta): string => {
  const [a, m, d] = f.dia.split('-');
  const dia = a && m && d ? `${d}/${m}/${a}` : f.dia;
  return f.hasta
    ? `${dia} · ${f.desde} a ${f.hasta}`
    : `${dia} · ${f.desde} (sin hora de fin)`;
};

/**
 * Escucha la bandeja. `onSnapshot` y no una lectura suelta por lo mismo que en
 * `/reportes`: con dos admins mirando, la que uno acaba de aceptar tiene que
 * dejar de estar pendiente en la pantalla del otro sin que nadie recargue.
 */
export const observarPropuestas = (
  cb: (ps: PropuestaConId[]) => void,
  onError: (e: Error) => void,
  cuantas = LIMITE_PROPUESTAS,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('creadoEn', 'desc'), limit(cuantas)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Propuesta), id: d.id }))),
    onError,
  );

/**
 * Cuántas esperan una decisión, para el badge de la cabecera.
 *
 * Query propia y no un `filter` sobre la de arriba: el badge se monta en el
 * listado, donde la bandeja no está abierta. Es un `where` de un solo campo, así
 * que no pide índice compuesto — por eso no lleva `orderBy`, que es justamente lo
 * que lo pediría.
 */
export const observarPendientes = (
  cb: (cuantas: number) => void,
  onError: (e: Error) => void,
): (() => void) =>
  onSnapshot(
    query(
      collection(db(), COL),
      where('estado', 'in', [...ESTADOS_PENDIENTES]),
      limit(LIMITE_PROPUESTAS),
    ),
    (snap) => cb(snap.size),
    onError,
  );

/**
 * Mueve el estado y firma la revisión. Es **la única escritura** del panel sobre
 * una propuesta.
 *
 * `serverTimestamp()` y no la hora del navegador: la regla exige
 * `revision.en == request.time`, así que un reloj adelantado no puede firmar en
 * el futuro (mismo criterio que `creadoEn` en la creación).
 */
export const revisarPropuesta = async (
  id: string,
  uid: string,
  estado: EstadoPropuesta,
  extras: { actividadId?: string | null; motivo?: string | null } = {},
): Promise<void> => {
  await updateDoc(doc(db(), COL, id), cambioDeRevision(uid, estado, serverTimestamp(), extras));
};
