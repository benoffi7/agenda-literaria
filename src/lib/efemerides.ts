/**
 * **La capa de datos de `/efemerides`, del lado del panel** — B-959.
 *
 * ⚠️ **Este módulo toca Firestore, así que NO puede llegar a una página
 * pública.** Es el mismo corte que separa `actividades.ts` de `toPublic.ts` y
 * `bibliotecas.ts` de `bibliotecaPublica.ts`: lo que el sitio necesita de una
 * efeméride está en `lib/efemeridePublica.ts`, que es puro.
 *
 * | Pieza | Dónde |
 * |---|---|
 * | los campos, los topes | `types/efemeride.ts` |
 * | la validación y el armado del documento | `lib/efemeride-schema.ts` |
 * | la proyección pública | `lib/efemeridePublica.ts` |
 * | **leer y escribir** | acá |
 *
 * Acá no se decide nada: se lee, se escribe, y lo que se escribe sale de
 * `formAEfemeride`.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { formAEfemeride, slugDeEfemerideBloqueado } from '@/lib/efemeride-schema';
import type {
  Efemeride,
  EfemerideConId,
  EfemerideForm,
  EstadoEfemeride,
} from '@/types/efemeride';

const COL = 'efemerides';

/**
 * Cuántas trae la pantalla. Un año tiene 366 días y el dueño puede cargar más de
 * una por día, así que el tope es holgado: existe para que una colección que
 * crece no baje entera sin límite, no como regla de producto.
 */
export const LIMITE_EFEMERIDES = 1000;

/**
 * Escucha la colección entera.
 *
 * `onSnapshot` por lo mismo que las pantallas de la Guía: con dos admins
 * mirando, la que uno publica cambia de estado en la pantalla del otro sin
 * recargar. Ordenada por `mes` en el servidor —un solo campo, sin índice
 * compuesto— y por día en el componente.
 */
export const observarEfemerides = (
  cb: (es: EfemerideConId[]) => void,
  onError: (e: Error) => void,
  cuantas = LIMITE_EFEMERIDES,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('mes', 'asc'), limit(cuantas)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Efemeride), id: d.id }))),
    onError,
  );

/**
 * ¿Ese slug está libre? — el aviso del formulario.
 *
 * Una URL no puede ser de dos efemérides: la segunda que se publicara pisaría a
 * la primera en el build. Se consulta **antes** de guardar, y al publicar se
 * vuelve a consultar contra las que tienen el slug congelado.
 */
export const slugDeEfemerideDisponible = async (
  slug: string,
  idActual?: string,
): Promise<boolean> => {
  if (!slug) return false;
  const snap = await getDocs(query(collection(db(), COL), where('slug', '==', slug), limit(2)));
  return snap.docs.every((d) => d.id === idActual);
};

/**
 * Alta. `createdAt`/`updatedAt` con `serverTimestamp()` porque la regla exige
 * `request.time` (el reloj del navegador no puede antedatarla), y
 * `createdBy`/`updatedBy` con el uid propio porque la regla lo exige igual a
 * `request.auth.uid`.
 *
 * `setDoc` sobre una ref acuñada en el cliente, como en la Guía: el id se conoce
 * antes de la ida.
 */
export const crearEfemeride = async (
  f: EfemerideForm,
  uid: string,
  estado: EstadoEfemeride,
): Promise<string> => {
  const ref = doc(collection(db(), COL));
  await setDoc(ref, {
    ...formAEfemeride(f, estado),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
  });
  return ref.id;
};

/**
 * Edición. **No manda `createdAt`/`createdBy`** —la regla los exige iguales a
 * los del documento, y reenviar un `Timestamp` reconstruido es cómo se cuela un
 * milisegundo de diferencia— ni `publicadaAlgunaVez`, que es de la máquina.
 *
 * ⚠️ **El `slug` sí se manda**: si está congelado, el formulario lo muestra
 * apagado y manda el que ya estaba; la regla es la que lo impide de verdad.
 */
export const guardarEfemeride = async (
  id: string,
  f: EfemerideForm,
  uid: string,
  estado: EstadoEfemeride,
): Promise<void> => {
  await updateDoc(doc(db(), COL, id), {
    ...formAEfemeride(f, estado),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
};

/**
 * Publicar o despublicar sin abrir el formulario. Firma la edición igual que
 * un guardado: la regla pide `updatedBy == request.auth.uid` en todo update.
 */
export const moverEfemeride = async (
  id: string,
  uid: string,
  estado: EstadoEfemeride,
): Promise<void> => {
  await updateDoc(doc(db(), COL, id), {
    estado,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
};

/**
 * ¿Se puede publicar con este slug? Es la guarda **de publicación**: que ninguna
 * **otra** efeméride que ya tuvo URL use el mismo. La de disponibilidad del
 * formulario mira todas; ésta mira las que importan cuando el slug está por
 * convertirse en una dirección.
 */
export const slugPublicable = async (slug: string, id?: string): Promise<boolean> => {
  const snap = await getDocs(query(collection(db(), COL), where('slug', '==', slug), limit(10)));
  return !snap.docs.some(
    (d) => d.id !== id && slugDeEfemerideBloqueado(d.data() as Efemeride),
  );
};

/**
 * Borrar. **No hay subcolección `/versiones` acá**, así que un borrado no se
 * recupera; el formulario lo pregunta antes. Si estaba publicada, su página deja
 * de existir en el próximo build (el trigger de rebuild lo marca).
 */
export const borrarEfemeride = async (id: string): Promise<void> => {
  await deleteDoc(doc(db(), COL, id));
};
