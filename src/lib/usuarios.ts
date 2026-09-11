/**
 * `/usuarios/{uid}` desde el panel — B-888.
 *
 * Dos operaciones y nada más: una cuenta se registra a sí misma al entrar, y el
 * admin lee el directorio para poder mostrar mails en vez de uids.
 *
 * **La autorización no está acá, está en `firestore.rules`.** Este módulo no
 * decide nada: escribe el uid de la sesión con el mail de la sesión, y la regla
 * verifica que las dos cosas sean las del token. Si alguien llamara a
 * `registrarUsuario` con otro uid o con otro mail, Firestore lo rechaza — es el
 * mismo reparto que el resto del panel (el §5.3 y el bloque de `/reportes`: las
 * reglas son la autorización real, el cliente es comodidad).
 */
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09, D-51).
import { db } from '@/lib/firestore-client';
import type { UsuarioConId } from '@/types/usuario';

const COL = 'usuarios';

/**
 * Deja (o refresca) el registro de la cuenta que está usando el panel.
 *
 * Se llama al entrar, y es idempotente: `setDoc` sin `merge` reescribe los dos
 * campos, que es justo lo que la regla acepta (`hasOnly` + `hasAll`). Refrescarlo
 * en cada login es lo que hace que el mail **no envejezca**: es el defecto que
 * D-610 le señalaba al mapa uid→nombre cableado a mano, y la razón por la que el
 * dato se deriva del token en vez de escribirse una vez con el Admin SDK.
 *
 * **Silencioso ante un rechazo, a propósito.** Que el directorio no se pueda
 * actualizar no puede impedirle a nadie usar el panel: el peor caso es que el
 * admin vea un uid donde esperaba un mail. Quien llame decide si quiere loguear
 * el motivo; lo que no debe hacer es cortar el login.
 *
 * @param uid   el de la sesión (`auth().currentUser.uid`)
 * @param email el de la sesión (`auth().currentUser.email`)
 */
export const registrarUsuario = async (uid: string, email: string | null): Promise<boolean> => {
  // Sin mail no hay nada que registrar, y la regla lo rechazaría igual
  // (`d.email.size() > 0` y la igualdad contra el claim del token).
  if (!uid || !email) return false;
  try {
    await setDoc(doc(db(), COL, uid), { email, actualizadoEn: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
};

/**
 * El directorio entero. **Solo lo puede leer un admin**: la regla condiciona por
 * la ruta (`uid == request.auth.uid`) para el otro rol, y una condición por ruta
 * no es satisfacible en un `list`, así que un publicador que llame a esto recibe
 * un `permission-denied` limpio (no una lista recortada).
 */
export const listarUsuarios = async (): Promise<UsuarioConId[]> => {
  const snap = await getDocs(collection(db(), COL));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UsuarioConId, 'uid'>) }));
};

/**
 * El mapa uid→mail que el panel necesita para mostrar autoría.
 *
 * Se arma acá y no en el componente para que haya **una** forma de resolver un
 * uid a un mail, y para que el default sea explícito: un uid que no está en el
 * directorio —una cuenta que todavía no entró desde que existe esta colección—
 * no se resuelve, y quien muestre tiene que decidir qué pone en su lugar. No
 * inventa un texto acá: afirmar de más sobre datos viejos es peor que no decir
 * nada, que es la misma regla que `autoriaDe()` aplica con `desconocida`.
 */
export const mailesPorUid = (usuarios: UsuarioConId[]): Map<string, string> =>
  new Map(usuarios.filter((u) => u.email).map((u) => [u.uid, u.email]));
