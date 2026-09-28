import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { estadoDelCatalogo, type ClaseDeAviso, type EstadoDelCatalogo } from '@/lib/estadoDelCatalogo';
import { claveDeMes } from '@/lib/fechasPublicas';
import type { ActividadConId } from '@/types/actividad';

/**
 * **La foto mensual del tablero** — B-378, roadmap 3.5.
 *
 * El tablero del catálogo es una foto del momento: dice cuántas hay publicadas
 * hoy, no cuántas había en agosto. La tendencia —«en septiembre publicamos 40,
 * en octubre 55»— es lo que pregunta un anunciante o un aliado, y **la foto que
 * no se sacó no se recupera**: el catálogo de un mes que pasó no se puede
 * reconstruir, porque las actividades se editan y se borran. Por eso se guarda
 * desde ya, aunque todavía no haya pantalla que dibuje la serie.
 *
 * ── Por qué la saca el panel y no una Function programada ─────────────────
 * Los números tienen que ser **los mismos** que el tablero muestra, y los
 * calcula `estadoDelCatalogo`, que vive en `src/` y depende de media docena de
 * módulos del panel (`tieneFuturo`, `faltaElFlyer`, `modalidadesQueOfrece`…).
 * `functions/` no puede importar `src/` (D-20), así que una Function tendría que
 * reescribir el cálculo, y dos cálculos de «¿ya pasó?» son la clase de B-88: la
 * foto diría una cosa y el tablero otra, y nada fallaría. La saca entonces el
 * panel de un admin, la primera vez que carga el catálogo en el mes, sobre la
 * misma lista que ya tiene en memoria: una lectura (¿ya está la de este mes?) y
 * una escritura por mes.
 *
 * El costo de esa elección, dicho: **la foto es del primer día del mes en que un
 * admin abrió el panel**, no del día 1. Por eso guarda `tomadaEn`; quien dibuje
 * la serie lo tiene que decir si el corrimiento importa.
 *
 * ── Qué guarda y qué no ─────────────────────────────────────────────────────
 * Todo lo del tablero **menos las listas de actividades de los avisos**, que se
 * reducen a su cantidad: una foto de conteos no necesita títulos, y un conteo
 * no envejece mal cuando la actividad se renombra o se borra. Los repartos van
 * con **slugs**, como en el tablero (§4.1): la etiqueta se resuelve al dibujar.
 */

/**
 * La forma de `catalogo`. Sube cuando cambia la de `EstadoDelCatalogo` de un modo
 * que un lector viejo no entendería: la serie va a mezclar fotos de versiones
 * distintas, y quien la dibuje tiene que poder saberlo.
 */
export const VERSION_DE_FOTO = 1;

export type CatalogoDeLaFoto = Omit<EstadoDelCatalogo, 'avisos'> & {
  avisos: { clase: ClaseDeAviso; cantidad: number }[];
};

/**
 * Lo que se guarda del tablero: los conteos, sin ninguna actividad nombrada.
 *
 * **El `...estado` es una proyección abierta, y es a sabiendas**: la foto tiene
 * que seguir al tablero sin que nadie se acuerde de sumar cada conteo nuevo. Lo
 * que lo hace seguro es `tests/foto-del-catalogo.test.ts`, que recorre la foto de
 * un catálogo poblado y solo acepta números y slugs (`valor`, `clase`): el día que
 * `EstadoDelCatalogo` sume una lista de actividades, ese test se pone rojo antes
 * de que la lista entre a un documento que la regla no deja corregir.
 */
export const catalogoDeLaFoto = (estado: EstadoDelCatalogo): CatalogoDeLaFoto => ({
  ...estado,
  avisos: estado.avisos.map((a) => ({ clase: a.clase, cantidad: a.actividades.length })),
});

/**
 * `2026-09`, en la hora del proyecto (trampa 1): la noche del 31 en Buenos Aires
 * sigue siendo ese mes aunque en UTC ya sea el siguiente.
 */
export const idDeFoto = (ahora: Date): string => claveDeMes(ahora);

export type ResultadoDeFoto = 'sacada' | 'ya-estaba';

/**
 * Saca la foto del mes si todavía no está. **Solo con el catálogo entero**: la
 * llama el panel de un admin (`useActividades`), nunca el de un publicador, que
 * ve una parte y sacaría la foto de esa parte.
 *
 * Si dos pestañas la sacan a la vez, la segunda escritura es un `update` y la
 * regla la rechaza (`allow update: if false`): la primera foto queda, que es lo
 * que se quiere.
 */
export const sacarFotoDelMesSiFalta = async (
  actividades: ActividadConId[],
  ahora: Date,
): Promise<ResultadoDeFoto> => {
  const mes = idDeFoto(ahora);
  const ref = doc(db(), 'fotosDelCatalogo', mes);
  if ((await getDoc(ref)).exists()) return 'ya-estaba';
  await setDoc(ref, {
    mes,
    version: VERSION_DE_FOTO,
    tomadaEn: serverTimestamp(),
    catalogo: catalogoDeLaFoto(estadoDelCatalogo(actividades, ahora)),
  });
  return 'sacada';
};

/**
 * El último mes cuya foto se confirmó —sacada o ya estaba— en esta pestaña.
 *
 * **Es el mes y no un booleano** (lo señaló el `auditor-trampas`): con un
 * booleano, un panel que queda abierto del 30 al 2 no sacaba la foto del mes
 * nuevo, y un fallo pasajero dejaba el mes entero sin foto hasta recargar. Y se
 * marca **solo si salió bien**: si falla, la próxima carga del listado reintenta.
 * El costo de un fallo persistente es una lectura por carga, no una por render.
 */
let mesConfirmado: string | null = null;

/** Para los tests: una pestaña nueva. */
export const olvidarMesConfirmado = () => {
  mesConfirmado = null;
};

export const sacarFotoSiToca = async (
  actividades: ActividadConId[],
  ahora: Date,
  sacar: typeof sacarFotoDelMesSiFalta = sacarFotoDelMesSiFalta,
): Promise<ResultadoDeFoto | 'ya-confirmada'> => {
  const mes = idDeFoto(ahora);
  if (mesConfirmado === mes) return 'ya-confirmada';
  const r = await sacar(actividades, ahora);
  mesConfirmado = mes;
  return r;
};
