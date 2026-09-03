/**
 * La lectura de Firestore del resumen de la analítica del sitio — B-374 y
 * B-373.
 *
 * **Es solo el acceso.** Toda la interpretación —qué significa un documento
 * ausente, una fuente en falla, un cero— vive en `resumenDelSitio.ts`, que es
 * puro y está testeado. Están en dos archivos por lo mismo que
 * `estadoDelCatalogo.ts` está separado de `actividades.ts`: un módulo que toca
 * Firestore no se puede testear sin emulador, y lo que hay que verificar acá es
 * lo otro.
 *
 * ── Por qué una lectura y no un `onSnapshot` ───────────────────────────────
 * El documento lo escribe una Function programada **una vez por día**. Un
 * `onSnapshot` mantendría un canal abierto para recibir, como máximo, una
 * actualización cada 24 horas, y el panel se abre por minutos. Es la misma
 * lectura de una sola vez que hace el resto del tablero (`listarActividades`).
 *
 * ── Una lectura, y ninguna de más ──────────────────────────────────────────
 * El §8 del diseño hace un punto de que el tablero del catálogo «no cuesta una
 * lectura de Firestore de más». Esta pestaña cuesta **una**, y solo cuando se
 * la abre: el `import()` de la vista y esta lectura cuelgan de la pestaña, no
 * del panel. Un documento por apertura, contra la cuota de un plan Blaze, es
 * ruido.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { leerResumenDelSitio, type ResumenDelSitio } from '@/lib/resumenDelSitio';

/**
 * El documento que escribe `functions/analitica-trigger.js`.
 *
 * `sistema/*` es `read: if esAdmin()` y `write: if false` en `firestore.rules`,
 * o sea que esta lectura usa el permiso que el panel ya tiene y nadie más
 * puede leerla ni escribirla. Es lo que hace innecesario un `onCall` con su
 * propia verificación de claim — el razonamiento completo está en el docblock
 * de la Function.
 */
export const RUTA_RESUMEN = ['sistema', 'analitica-sitio'] as const;

/**
 * Trae el resumen, ya interpretado.
 *
 * **No tira nunca.** Un fallo de red o un permiso denegado se leen igual que
 * «el documento no existe», que es lo correcto para esta pantalla: la acción
 * del dueño no cambia y una pestaña de estadísticas no puede romper el panel.
 * El estado vacío que sale de acá **dice qué falta** (D-272), así que un error
 * silencioso no deja la pantalla muda.
 */
export const leerAnaliticaDelSitio = async (): Promise<ResumenDelSitio> => {
  try {
    const snap = await getDoc(doc(db(), ...RUTA_RESUMEN));
    return leerResumenDelSitio(snap.exists() ? snap.data() : null);
  } catch {
    return leerResumenDelSitio(null);
  }
};
