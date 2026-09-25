/**
 * B-1920, B-2050 — corregir los derivados de `modalidades` en el documento, en su
 * propio módulo.
 *
 * La decisión es pura y vive en `derivados.js` (`derivadosDesalineados`); acá queda
 * solo el efecto, con el `db` inyectado y sin `firebase-admin` ni
 * `firebase-functions`, para que el test de integración lo importe sin cargar un
 * trigger (B-561, D-1210). Lo llama `syncCalendar`, que es el único
 * `onDocumentWritten` sobre `actividades/{id}`: `guardarVersion` es un
 * `onDocumentUpdated` y se perdería el documento que **nace** mentido, que es
 * justo el que la regla de `create` deja pasar.
 *
 * Era `corregirCiudades` (`ciudades-firestore.js`, B-1920) y corregía solo
 * `ciudades`. Desde B-2050 corrige los cinco derivados —`modalidad`, `sede`,
 * `online`, `searchText` y `ciudades`— **en la misma transacción y con una sola
 * escritura**: con dos write-backs, cada uno dispararía el trigger y la segunda
 * pasada vería el otro a medio corregir.
 *
 * ── La guarda anti-loop (trampa 3) ─────────────────────────────────────────
 * Esta escritura vuelve a disparar `syncCalendar` y `guardarVersion`. Se corta en
 * la segunda pasada por tres cosas:
 *
 *  1. **La guarda del llamador**: `derivadosDesalineados(despues)`. Después de
 *     esta escritura el documento coincide consigo mismo, así que la segunda
 *     pasada no entra.
 *  2. **Los cinco están en `CAMPOS_DE_MAQUINA`** (`historial.js`): el write-back
 *     no cuenta como cambio de contenido, así que no deja una versión en el
 *     historial. No se pierde nada: son derivados de lo que sí es contenido, y
 *     cuando cambian de verdad cambian sus fuentes en la misma escritura. El
 *     rebuild sí se pide, porque cuatro de los cinco salen al sitio: lo decide
 *     `pideRebuild` (`derivados.js`) en la segunda pasada, que es la que ve el
 *     cambio.
 *  3. **El diff de Calendar se planifica sobre la vista derivada**
 *     (`conDerivados`): antes y después de corregir es la misma, así que la
 *     segunda pasada no manda un `update` en falso a las N sesiones.
 *
 * ── Por qué en una transacción ─────────────────────────────────────────────
 * Entre el evento y este punto el panel pudo haber guardado otra vez —filas
 * nuevas y sus derivados nuevos, juntos—. Escribir la derivación del **evento**
 * pisaría la buena con una vieja. Se relee y se deriva de lo que hay **ahora**; si
 * ya coincide, no se escribe nada. Es el criterio de `reponerIds` en el sync.
 *
 * Se escriben **los cinco** aunque difiera uno: los que ya coincidían reciben el
 * mismo valor, y así la escritura tiene una sola forma —la que lee el chequeo de
 * B-80 (`CAMPOS_DOCUMENTO_QUE_ESCRIBE_EL_SYNC`)—.
 *
 * ── Qué NO hace ────────────────────────────────────────────────────────────
 * **No toca `estado`** (D-1231): corregir no despublica. Una actividad de un
 * publicador que, corregida, queda fuera de su ciudad sigue publicada; lo decide
 * una persona, con el aviso.
 *
 * **Y `online` no puede abrir el link de la reunión.** El corregido es el bloque
 * de una de las filas —el mismo objeto—, así que su `url` y su `urlPublica` son
 * las de esa fila, que la proyección ya publica o ya calla
 * (`modalidades[].online`, `toPublic.ts`). Lo único que la corrección puede hacer
 * con el link es **sacar** uno que el documento declaraba público en la raíz sin
 * que ninguna fila lo tuviera (`tests/derivados-del-servidor.test.ts`).
 *
 * `update` y no `set`: si el documento se borró en el medio, no se resucita.
 */
import { derivadosDesalineados } from './derivados.js';

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} id
 * @returns {Promise<{ campos: string[], ciudadesGuardadas: unknown, derivados: Record<string, any>, estado: unknown } | null>}
 *   lo que se corrigió, o `null` si al releer ya no había nada que corregir
 */
export const corregirDerivados = (db, id) => {
  const ref = db.doc(`actividades/${id}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const datos = snap.data();
    const desalineados = derivadosDesalineados(datos);
    if (!desalineados) return null;
    const d = desalineados.derivados;
    tx.update(ref, { modalidad: d.modalidad, sede: d.sede, online: d.online, searchText: d.searchText, ciudades: d.ciudades });
    return {
      campos: desalineados.campos,
      // Solo para el log de `ciudades-no-coinciden`, que ya lo mostraba (B-1920):
      // es una lista de slugs, no contenido.
      ciudadesGuardadas: datos?.ciudades === undefined ? null : datos.ciudades,
      derivados: d,
      // El `estado` de la relectura y no el del evento: es el que va al mail.
      estado: datos?.estado ?? null,
    };
  });
};
