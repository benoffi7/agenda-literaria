/**
 * **Mandar una propuesta desde el sitio público** — B-830, paso 9.
 *
 * Es el pegamento con Firebase del único formulario del sitio, y vive aparte del
 * componente por el mismo corte de siempre: lo que se puede decidir sin red está
 * en `propuesta-schema.ts` (puro), acá queda lo que habla con Firestore y con
 * Storage.
 *
 * ── Este módulo se carga con `import()` y **nunca** estáticamente ──────────
 * Y acá el motivo es más fuerte que el del panel. Importarlo desde el árbol
 * estático de `/proponer` haría que **App Check se active al abrir la página**:
 * `app()` es el borde donde se inicializa (B-836), así que el desafío de
 * reCAPTCHA Enterprise —un tercero de Google, con cuota facturable por visitante—
 * se cargaría para cualquiera que **mire** la página, haya o no tocado el
 * formulario.
 *
 * Cargándolo en el submit, el tercero entra cuando la persona **decide mandar**
 * algo, que es cuando el anti-abuso tiene sentido y cuando ya no hay nada que
 * explicarle a nadie. Lo hace cumplir `tests/panel-fuera-del-sitio.test.ts`, que
 * separa el alcance estático del diferido justo para esto.
 *
 * ── Y por qué el sitio puede escribir en Firestore, si es estático ─────────
 * Porque escribir no es lo mismo que leer: el sitio se **construye** leyendo
 * Firestore con el Admin SDK (§2.4) y se sirve como HTML, pero un formulario
 * escribe desde el navegador de quien lo usa, con el SDK cliente y contra las
 * reglas. Es la primera vez que el sitio público lo hace, y por eso todo lo de
 * este archivo pasa por `firestore.rules` — que hoy, además, **todavía no deja
 * pasar a un anónimo** (ver abajo).
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { formAPropuesta } from '@/lib/propuesta-schema';
import type { PropuestaForm } from '@/types/propuesta';

const COL = 'propuestas';

/**
 * Escribe la propuesta. Devuelve el id, que no se le muestra a nadie: sirve para
 * el log de un fallo y para el test.
 *
 * ⚠️ **Hoy esto es un permission-denied para cualquiera que no sea admin**, a
 * propósito: `firestore.rules` tiene `allow create: if esAdmin() && …` esperando
 * que App Check exija (B-836a). El formulario lo trata como cualquier otro fallo
 * y lo dice sin inventar el motivo — que es lo que hay que hacer igual el día que
 * la puerta esté abierta y Firestore se caiga.
 */
export const enviarPropuesta = async (
  f: PropuestaForm,
  storagePath: string | null = null,
): Promise<string> => {
  const ref = await addDoc(collection(db(), COL), {
    ...formAPropuesta(f, 'formulario-publico', storagePath),
    // La regla exige `creadoEn == request.time`: así nadie antedata su propuesta.
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * Sube el flyer a `propuestas/` y devuelve su path — DEC-11.
 *
 * ── B-896: ya no sube con el SDK de Storage, sube por una callable ────────
 * Hasta acá esto llamaba a `subirImagen(archivo, id, rutaDeImagenPropuesta)`, o
 * sea `uploadBytes` contra el bucket. El problema no era el camino sino **dónde
 * corría el saneado**: solo en el cliente. Un cliente se puede saltear el
 * saneado del cliente —consola del navegador y listo—, así que ese chequeo no
 * podía fallar nunca y, como garantía, era peor que no tenerlo.
 *
 * Ahora los bytes pasan por una Cloud Function callable con
 * `enforceAppCheck: true` (`functions/flyer-de-propuesta-trigger.js`), que
 * **vuelve a sanear** sobre lo que de verdad llegó y escribe el objeto con el
 * Admin SDK. Dos consecuencias, y las dos son ganancia:
 *
 *  - el endpoint anónimo queda **atestado**, sin tener que exigir App Check en
 *    Storage —que es por servicio y no por path, y se llevaría puestas las
 *    lecturas públicas de imágenes del sitio (B-872)—;
 *  - `storage.rules` para `propuestas/` se queda con el `create` **cerrado a todo
 *    cliente**, que es más fuerte que abrirlo.
 *
 * El id y el path los elige **el servidor**: de este lado ya no se arma ningún
 * nombre, así que tampoco hay forma de que alguien intente pisar el objeto de
 * otro. Lo que sigue igual es que de todo esto acá sirve **una** cosa —dónde
 * quedó—, porque el documento de una propuesta guarda `{ storagePath }` y nada
 * más, que es lo único que `imagenValida()` acepta.
 */
export const subirImagenDePropuesta = async (archivo: File): Promise<string> => {
  const { subirFlyerPorCallable } = await import('@/lib/subir-imagen');
  return subirFlyerPorCallable(archivo);
};
