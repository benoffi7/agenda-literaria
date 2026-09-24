/**
 * **Que dos fichas de la Guía no publiquen la misma dirección web** — B-909,
 * trampa 10. Una sola implementación para los cuatro directorios.
 *
 * ⚠️ **Toca Firestore: es del panel.** Lo importan `librerias.ts`,
 * `bibliotecas.ts`, `suscripcionesLiterarias.ts` y `lugares.ts`, nunca una
 * página del sitio.
 *
 * ── Por qué no es `/slugs` (D-660) ───────────────────────────────────────
 * En `/actividades` el slug se **reserva al crear**, en el mismo `writeBatch`
 * que el documento, porque ahí el slug es una URL desde el primer guardado
 * que sale publicado. Acá lo que importa es otra cosa, y es más barato:
 *
 *  - **Una ficha de la Guía no tiene URL hasta que un admin la publica.** Dos
 *    `pendiente` con el mismo slug no rompen nada: ninguna de las dos tiene
 *    página. El invariante que protege la trampa 10 es «dos fichas **publicadas**
 *    no comparten dirección», y ése se puede verificar en el único momento en que
 *    el slug pasa a ser una URL: al publicar.
 *  - **El alta pública no puede participar de una reserva.** Un anónimo no lee
 *    la colección (D-128), así que no sabe si el nombre está tomado: una reserva
 *    en el batch haría que su envío rebote con un `permission-denied` que no
 *    puede entender ni corregir —el slug lo deriva el sistema del nombre—, y la
 *    librería que ya está en la Guía y se vuelve a sumar es el caso **más común**,
 *    no el raro. Abrirle un índice a un anónimo es además una superficie para
 *    acaparar nombres, y la retención (`borrarFichasVencidas`) tendría que soltar
 *    reservas.
 *  - **El que publica es siempre un admin**, que sí puede consultar.
 *
 * ── Lo que queda sin garantía, dicho al derecho ──────────────────────────
 * Es check-then-write: dos admins publicando **en el mismo segundo** dos fichas
 * con el mismo slug pasarían los dos. Con un dueño y una bandeja, no se espera
 * que pase; y si pasa es visible —dos fichas en la bandeja con la misma
 * dirección— y queda anotado como el límite de esta decisión.
 */
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { slugBloqueado, type EstadoDirectorio, type IdDirectorio } from '@/lib/directorios';

/** Cuántas fichas con el mismo slug se traen para decidir. Con dos alcanza para saber; diez da margen. */
const TOPE_DE_CHOQUES = 10;

/**
 * ¿Esta dirección web está libre? — la guarda **de aviso** del formulario del
 * panel.
 *
 * Choca contra **cualquier** ficha, publicada o no: al cargar a mano, mejor
 * enterarse de que ya hay una pendiente con ese nombre —suele ser la misma
 * librería, que alguien sumó desde afuera— que descubrirlo al publicar.
 *
 * `idActual` es para editar: una ficha no colisiona consigo misma.
 */
export const slugDeGuiaDisponible = async (
  coleccion: IdDirectorio,
  slug: string,
  idActual?: string,
): Promise<boolean> => {
  if (!slug) return false;
  const snap = await getDocs(query(collection(db(), coleccion), where('slug', '==', slug), limit(2)));
  return snap.docs.every((d) => d.id === idActual);
};

/**
 * **La garantía de B-909**: tira si publicar la ficha `id` le daría una
 * dirección que ya es de otra.
 *
 * «Ya es de otra» es `slugBloqueado`: la que **está o estuvo** publicada. La
 * que se publicó y se bajó sigue siendo dueña de su URL —está en Google, en
 * Instagram, en un mail—, así que dársela a otra sería el mismo daño de la
 * trampa 10 con otra cara. Una `pendiente` o `rechazada` que nunca salió no es
 * dueña de nada: gana la primera que se publique.
 *
 * ── Decide contra el documento, no contra la pantalla ────────────────────
 * Relee la ficha por id en vez de recibir su slug, y es la lección de D-660: los
 * tres bugs de aquella tajada eran decidir contra el snapshot de la bandeja. Si
 * otro admin le cambió el slug hace un segundo, se verifica el que va a quedar.
 *
 * Dice «ficha» y no el nombre de la entidad: «otra lugar» no se lee. El
 * mensaje es un `Error` pelado y en castellano: `textoDeFallo` lo muestra
 * tal cual en el cartel de la bandeja, y dice qué hacer.
 */
export const asegurarSlugPublicable = async (coleccion: IdDirectorio, id: string): Promise<void> => {
  const ficha = await getDoc(doc(db(), coleccion, id));
  const slug = ficha.data()?.slug;
  if (typeof slug !== 'string' || !slug) {
    throw new Error('Esta ficha no tiene dirección web: abrila, escribila y volvé a publicar.');
  }
  const snap = await getDocs(
    query(collection(db(), coleccion), where('slug', '==', slug), limit(TOPE_DE_CHOQUES)),
  );
  const duena = snap.docs.find(
    (d) =>
      d.id !== id &&
      slugBloqueado(d.data() as { estado: EstadoDirectorio; publicadaAlgunaVez?: boolean }),
  );
  if (duena) {
    throw new Error(
      `La dirección web «${slug}» ya es de otra ficha publicada. ` +
        'Abrí ésta, cambiale la dirección y volvé a publicarla.',
    );
  }
};
