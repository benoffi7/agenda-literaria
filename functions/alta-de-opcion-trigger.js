/**
 * **La callable con la que el publicador crea una etiqueta** — B-893, D-810.
 *
 * El publicador no tiene `write` sobre `/opciones/*` y no lo va a tener: el
 * documento es de todo el sitio y las reglas no pueden inspeccionar qué elemento
 * del array `valores` cambió, así que «agrega una opción con Otro» y «reescribe
 * la taxonomía entera» serían el mismo permiso (`firestore.rules`). Esta
 * Function es el camino 1 de B-893: corre con el Admin SDK, así que **puede**
 * leer el array anterior y verificar que lo único que cambia es un elemento —y
 * lo verifica, en `cambioInesperado`— antes de escribir.
 *
 * ── Lo que decide este archivo, y nada más ────────────────────────────────
 * 1. **Quién**: sesión con claim `publicador` o `admin`, por `rolDeLaSesion`
 *    (mismo criterio que `esAdmin()`: si están los dos, gana el publicador).
 * 2. **Qué**: `validarPedidoDeOpcion` —lista blanca de campos, largo, y el slug
 *    derivado acá con el `slugify` compartido (trampa 6)—.
 * 3. **Con qué aprobación**: `false` para el publicador —la etiqueta le sirve a
 *    quien la creó y a nadie más hasta que el admin la apruebe—, `true` para el
 *    admin, igual que su camino directo (B-131).
 *
 * Todo lo demás es puro (`alta-de-opcion.js`) o pegamento con el `db` inyectado
 * (`alta-de-opcion-firestore.js`), y se prueba sin el emulador de Functions
 * (D-660). Lo que no es ejecutable desde vitest —que `enforceAppCheck` esté en
 * `true`, que el nombre sea el que `index.js` exporta y el cliente invoca— lo
 * afirma `tests/alta-de-opcion-callable.test.ts` sobre este fuente.
 */
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { CUENTA_DE_SERVICIO, REGION } from './despliegue.js';
import { rolDeLaSesion, validarPedidoDeOpcion } from './alta-de-opcion.js';
import { aplicarAltaDeOpcion } from './alta-de-opcion-firestore.js';

export const crearOpcionDelPanel = onCall(
  {
    // Explícitas y no heredadas de `setGlobalOptions()`, por el orden de
    // evaluación de ESM (D-35). El mail sale de `despliegue.js` (B-77).
    region: REGION,
    serviceAccount: CUENTA_DE_SERVICIO,
    /*
     * El mismo portón que la callable del flyer (B-896) y que Firestore, que
     * está `ENFORCED` desde el 2026-09-10 (B-836a): el panel ya pide un token de
     * App Check para cada lectura, así que exigirlo acá no le agrega ningún paso
     * a quien carga, y le saca la puerta al script que tiene una sesión robada
     * pero no el navegador.
     */
    enforceAppCheck: true,
    // Una lectura y una escritura de un documento chico: el escalón más bajo
    // alcanza de sobra. El tope de instancias es el freno al volumen, junto con
    // `TOPE_DE_PENDIENTES_POR_CUENTA`.
    memory: '256MiB',
    timeoutSeconds: 30,
    maxInstances: 5,
  },
  async (peticion) => {
    if (!peticion.auth) {
      throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión para agregar opciones.');
    }
    const rol = rolDeLaSesion(peticion.auth.token);
    if (!rol) {
      throw new HttpsError('permission-denied', 'Tu cuenta no puede agregar opciones.');
    }

    const { pedido, rechazo } = validarPedidoDeOpcion(peticion.data);
    if (rechazo) throw new HttpsError(rechazo.codigo, rechazo.message);

    const r = await aplicarAltaDeOpcion(getFirestore(), {
      ...pedido,
      uid: peticion.auth.uid,
      aprobada: rol === 'admin',
    });

    if (r.rechazo) {
      /*
       * El motivo de la verificación va al log y no a la respuesta: le sirve a
       * quien programa, no a quien carga. **Ni el uid ni la etiqueta tal como
       * se tipeó** van al log: alcanza con el campo y el motivo para reconstruir
       * qué pasó. (El motivo puede nombrar un slug, que es lo mismo que ya lee
       * cualquiera en `/opciones/*`, de lectura pública.)
       */
      if (r.rechazo.motivo) {
        logger.error('el alta de la opción no pasó la verificación', {
          campo: pedido.campo,
          motivo: r.rechazo.motivo,
        });
      }
      throw new HttpsError(r.rechazo.codigo, r.rechazo.message);
    }

    logger.info('opción agregada desde el panel', {
      campo: pedido.campo,
      rol,
      creada: r.creada,
    });
    // De vuelta va el slug: es el que el cliente ya guardó en la actividad, y
    // devolverlo deja que el panel verifique que las dos derivaciones coinciden.
    return { slug: r.slug, creada: r.creada };
  },
);
