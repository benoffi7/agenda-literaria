/**
 * Escritura y lectura de `/reportes/{id}` desde el panel.
 *
 * El panel **no** habla con la API de GitHub: el §5.4 prohíbe que el PAT
 * llegue al bundle, y cualquiera que abra `/admin` puede leer el bundle. Acá se
 * escribe el reporte en Firestore y la Cloud Function `reporteAIssue` crea el
 * issue con el token en Secret Manager.
 */
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
// `firestore-client` y no `firebase-client`: el corte del bundle (B-09) saca
// Firestore del chunk de login.
import { db } from '@/lib/firestore-client';
import { formAReporte } from '@/lib/reporte-schema';
import { INFO_VERSION } from '@/lib/version';
import type { ContextoReporte, Pantalla, Reporte, ReporteConId, ReporteForm } from '@/types/reporte';

const COL = 'reportes';

/**
 * Contexto técnico del navegador. Es lo que le ahorra el ida y vuelta al
 * dueño: versión del panel, navegador, tamaño de ventana y zona horaria.
 *
 * La versión es la que estampa el build (`VERSION_APP`: `0.1.0+<sha>`), no la
 * última publicada: identifica al JS que está corriendo en ESE navegador, que
 * es contra el que se reportó el bug. Con ese string el dueño rebuildea el
 * código exacto — y si el árbol estaba sucio al buildear, la versión lo dice.
 */
export const contextoTecnico = (pantalla: Pantalla): ContextoReporte => ({
  versionPanel: INFO_VERSION.generadoEn
    ? `${INFO_VERSION.version} (build ${INFO_VERSION.generadoEn})`
    : INFO_VERSION.version,
  // Recortado: un UA largo no aporta y el issue es público.
  navegador: (navigator.userAgent ?? '').slice(0, 300),
  ventana: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio ?? 1}x`,
  // Trampa 1 — la zona horaria del que reporta es media diagnosis de cualquier
  // bug de fechas.
  zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
  // Sin query string: no hace falta y podría llevar algo que no queremos
  // publicar.
  url: window.location.pathname,
  pantalla,
});

export const crearReporte = async (
  f: ReporteForm,
  contexto: ContextoReporte,
  usuario: { uid: string; email: string | null },
  tituloActividad = '',
): Promise<string> => {
  const ref = await addDoc(collection(db(), COL), {
    ...formAReporte(f, contexto, usuario, tituloActividad),
    // Las reglas exigen `creadoEn == request.time`: así el cliente no puede
    // antedatar un reporte.
    creadoEn: serverTimestamp(),
  });
  return ref.id;
};

/**
 * B-31 — vuelve a poner en cola un reporte que quedó en `error`.
 *
 * **Por qué esto y no una función `onCall` de reintento.** El disparador de la
 * publicación ya es una escritura en el documento: `estadoTrasFallo` de
 * `functions/reportes.js` reintenta poniendo `estado: 'pendiente'`, y esa misma
 * escritura vuelve a disparar el trigger. El botón del panel hace exactamente lo
 * que la Function ya hace sola, así que no hace falta un segundo camino —con su
 * endpoint, su chequeo de claim a mano y su propia forma de fallar— para el
 * mismo efecto. La autorización la siguen haciendo las reglas (§5.3).
 *
 * **`intentos: 0` no es opcional.** `decidirAccion` ignora un reporte con los
 * intentos agotados, que es el caso más común de un `error` (falló tres veces).
 * Sin resetearlos, el botón escribiría el documento y no pasaría nada.
 *
 * No se toca el texto del reporte: la regla lo prohíbe explícitamente, porque es
 * lo que termina en un repo público.
 */
export const reintentarReporte = async (id: string): Promise<void> => {
  await updateDoc(doc(db(), COL, id), {
    estado: 'pendiente',
    intentos: 0,
    // Se limpia el mensaje del fallo anterior: si no, queda contradiciendo al
    // estado nuevo en la pantalla.
    error: null,
    // Las reglas exigen `request.time`, igual que en la creación.
    actualizadoEn: serverTimestamp(),
  });
};

/**
 * Escucha los últimos reportes. Es `onSnapshot` y no una lectura suelta a
 * propósito: el número de issue lo escribe la Function un segundo después de
 * guardar, y así aparece solo sin que nadie recargue.
 *
 * Sin `where` por autor: son dos admins, las reglas ya limitan la lectura a
 * ellos, y filtrar por `reportadoPor.uid` con `orderBy` obligaría a un índice
 * compuesto para nada.
 */
export const observarReportes = (
  cb: (rs: ReporteConId[]) => void,
  onError: (e: Error) => void,
  cuantos = 10,
): (() => void) =>
  onSnapshot(
    query(collection(db(), COL), orderBy('creadoEn', 'desc'), limit(cuantos)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Reporte), id: d.id }))),
    onError,
  );
