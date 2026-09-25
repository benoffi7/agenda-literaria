/**
 * **El rebuild cuando cambia una efeméride** — B-959, trampa 8.
 *
 * El sitio es estático: una efeméride publicada no existe —ni su página, ni su
 * lugar en `/efemerides.json`, ni el renglón de la home— hasta que el build
 * vuelve a correr. Sin esto se publica desde el panel y el sitio no la muestra
 * nunca, y nada falla.
 *
 * **Y no hay trigger de Calendar sobre esta colección, a propósito**: una
 * efeméride no es una actividad y no va al calendario público (D-1170). Este es
 * el único trigger de `/efemerides`.
 *
 * La forma es la de `directorios-trigger.js`, copiada y no compartida por el
 * mismo motivo que se escribe allá: el chequeo de la clase de B-83
 * (`tests/clases-de-bug.test.ts`) es **textual sobre el cuerpo de cada
 * trigger**, así que mudar el cuerpo a un helper haría que el chequeo dejara de
 * mirarlo sin ponerse rojo. Lo que sí se comparte es la decisión
 * (`efemerideAmeritaRebuild`) y los efectos (`marcarRebuild`, `marcarPublicada`).
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { OPCIONES_BASE } from './despliegue.js';
import { efemerideAmeritaRebuild } from './efemerides.js';
import { faltaMarcarPublicada } from './historial.js';
import { marcarPublicada } from './marca-de-publicada.js';
import { marcarRebuild } from './marca-de-rebuild.js';

export const rebuildPorEfemerides = onDocumentWritten(
  {
    // Explícitas y no heredadas del `setGlobalOptions` de `index.js` — D-35.
    ...OPCIONES_BASE,
    document: 'efemerides/{id}',
  },
  async (event) => {
    const antes = event.data?.before?.data() ?? null;
    const despues = event.data?.after?.data() ?? null;
    const { id } = event.params;

    /*
     * ── La marca de «estuvo publicada alguna vez» — trampa 10 ────────────
     * Es lo que mantiene el slug congelado si la efeméride se despublica: la
     * regla (`slugDeEfemerideCongelado`) mira la marca **o** el estado. Va
     * primero y afuera de todo condicional del rebuild, por el mismo motivo que
     * en los directorios: corresponde porque pasó a publicada, no porque el
     * sitio tenga algo que rehacer.
     *
     * La guarda anti-loop es `faltaMarcarPublicada` (trampa 3): el `update`
     * vuelve a disparar este handler, y en esa pasada la marca ya está.
     */
    if (faltaMarcarPublicada(despues, antes)) {
      try {
        await marcarPublicada(getFirestore(), id, 'efemerides');
        logger.info('efeméride marcada como publicada alguna vez', { id });
      } catch (e) {
        logger.warn('no se pudo marcar la efeméride como publicada', { id, error: e?.message });
      }
    }

    /*
     * La guarda en forma **positiva**, como `rebuildPorLibrerias` y por el mismo
     * motivo (la clase de B-83 exige que la llamada domine todos los cortes).
     * El motivo lleva **solo el id**: el título es contenido.
     */
    if (efemerideAmeritaRebuild(antes, despues)) {
      await marcarRebuild(getFirestore(), `efemeride ${id}`);
    } else {
      logger.debug('cambio de efeméride sin efecto en el sitio: no se rebuildea', { id });
    }
  },
);
