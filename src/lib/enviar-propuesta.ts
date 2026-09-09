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
 * **Reusa `subirImagen`**, que es el pipeline del panel: valida tipo y tamaño,
 * verifica que el archivo sea por dentro lo que dice ser, y **le saca los
 * metadatos**. Eso último es lo que más importa acá y es la razón de no escribir
 * una subida nueva y más simple: la foto de un taller en una casa lleva las
 * coordenadas de esa casa, y quien la manda no lo sabe.
 *
 * El destino es el otro prefijo, con su propio id (`prop_<uuid>`), así que el
 * objeto **no es público** y el trigger de optimización lo ignora (trampa 12).
 */
export const subirImagenDePropuesta = async (archivo: File): Promise<string> => {
  const { subirImagen } = await import('@/lib/subir-imagen');
  const { nuevaImagenPropuestaId, rutaDeImagenPropuesta } = await import(
    '@/lib/imagenes-archivo'
  );
  const { imagen } = await subirImagen(
    archivo,
    nuevaImagenPropuestaId(),
    rutaDeImagenPropuesta,
  );
  /*
   * De todo lo que `subirImagen` devuelve, acá sirve **una** cosa: dónde quedó.
   * El resto (`url`, `epigrafe`, `portada`, la medida) es la forma de una fila de
   * galería, y una propuesta no tiene galería — su documento guarda
   * `{ storagePath }` y nada más, que es lo único que `imagenValida()` acepta.
   */
  return imagen.storagePath!;
};
