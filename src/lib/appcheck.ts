/**
 * **App Check** — la puerta que frena al script que no pasa por la página
 * (B-836, `docs/prd/README.md` § 2).
 *
 * ── Por qué existe, y por qué existe *antes* de que haga falta ─────────────
 * Hoy ninguna colección acepta una escritura sin el claim `admin`, y eso está
 * fijado en `tests/escritura-anonima.integracion.test.ts`. Los cuatro
 * formularios públicos de `prd/` abren la primera escritura anónima del
 * proyecto, y un formulario público sin login **es un endpoint de escritura a
 * Firestore**: sin App Check, un script llena la bandeja y la factura (el plan
 * es Blaze, §2.3).
 *
 * App Check es **una** de las cinco capas de B-836 —las otras cuatro son la
 * validación en la regla, los topes de tamaño y forma, el honeypot y el barrido
 * programado— y es la única que depende de un tercero. No reemplaza a ninguna.
 *
 * ── reCAPTCHA **Enterprise**, no v3 clásico ───────────────────────────────
 * La clave que registró el dueño el 2026-09-09 es de reCAPTCHA Enterprise
 * (score-based), así que el proveedor es `ReCaptchaEnterpriseProvider` y no
 * `ReCaptchaV3Provider`. No son intercambiables: cada uno valida contra un
 * servicio distinto, y con el proveedor equivocado el token se rechaza.
 *
 * **La clave de sitio es pública por diseño**, igual que la API key web: viaja
 * en el bundle porque el navegador la necesita para pedir el desafío. Con App
 * Check no hay clave privada de reCAPTCHA de este lado — el *assessment* lo hace
 * Firebase con las credenciales del proyecto—, así que no hay ningún secreto que
 * se pueda filtrar por acá (§5.4).
 *
 * **Y no va el `<script src="…/recaptcha/enterprise.js">` a mano**, ni un
 * `grecaptcha.enterprise.execute()` propio. Esa es la integración *genérica* de
 * reCAPTCHA; el SDK de App Check carga el script y ejecuta el desafío por su
 * cuenta a partir de la clave. Las dos integraciones juntas se pelean por el
 * mismo widget.
 *
 * ── Import estático, y es a propósito ─────────────────────────────────────
 * `firebase/app-check` entra al chunk inicial del panel, que es justo lo que el
 * corte de B-09 cuida. Se paga igual porque **App Check tiene que estar
 * inicializado antes de la primera llamada a Firestore**: con un `import()`
 * diferido la activación es asíncrona y la primera escritura puede salir sin
 * token. Hoy eso sería inocuo —el enforcement está apagado— y el día que se
 * active sería un fallo intermitente, que es la peor forma de fallar. No es del
 * orden de peso de los tres SDK que `tests/bundle-panel.test.ts` mantiene afuera
 * (`firebase/firestore`, `firebase/analytics`, `firebase/storage`): el desafío
 * de reCAPTCHA lo baja Google en runtime, no el bundle.
 */
import type { FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';

/**
 * Por qué App Check no se activó en esta carga. `null` = se activó.
 *
 * Es un enum de causas y no un booleano porque las tres significan cosas
 * distintas y solo una es un problema: `sin-navegador` y `emuladores` son
 * caminos deliberados, `sin-clave` es una configuración incompleta.
 */
export type MotivoSinAppCheck = 'sin-navegador' | 'emuladores' | 'sin-clave' | 'fallo';

/**
 * ¿Corresponde activar App Check en este entorno? — puro, y por eso testeable.
 *
 * Las tres razones para no hacerlo:
 *
 * - **`sin-navegador`**: no hay `window`. El build lee Firestore con el Admin
 *   SDK, que no pasa por App Check, así que acá no hay nada que activar.
 * - **`emuladores`**: los emuladores **no verifican** App Check. Activarlo
 *   contra ellos solo agrega una llamada a reCAPTCHA que no sirve para nada, y
 *   —peor— haría que la suite de integración dependa de un tercero para correr.
 *   Por eso no hace falta el token de debug: el camino local no pasa por acá.
 * - **`sin-clave`**: sin clave de sitio no hay proveedor posible. Se avisa por
 *   consola y el panel sigue funcionando: mientras el enforcement esté apagado,
 *   la escritura la autorizan las reglas igual (§5.3).
 */
export const motivoParaNoActivar = (entorno: {
  hayNavegador: boolean;
  usarEmuladores: boolean;
  claveDeSitio: string | undefined;
}): MotivoSinAppCheck | null => {
  if (!entorno.hayNavegador) return 'sin-navegador';
  if (entorno.usarEmuladores) return 'emuladores';
  if (!entorno.claveDeSitio) return 'sin-clave';
  return null;
};

let _appCheck: AppCheck | null = null;
let _motivo: MotivoSinAppCheck | null = null;

/**
 * Activa App Check sobre la app de Firebase, **una sola vez**.
 *
 * Idempotente por la misma razón que `app()`: se llama desde el borde por el que
 * pasan todos los consumidores del SDK, así que se llama muchas veces.
 *
 * **Un fallo acá no puede romper el panel.** `initializeAppCheck` puede tirar
 * —clave mal, reCAPTCHA sin responder, la app ya inicializada por otra vía— y
 * mientras el enforcement esté apagado el panel funciona igual: la autorización
 * real la siguen dando las reglas. Cuando el enforcement se active, la escritura
 * va a fallar del lado del servidor con un error propio, que es donde se tiene
 * que ver — y no acá, dejando la pantalla de login en blanco.
 */
export const activarAppCheck = (
  app: FirebaseApp,
  entorno: {
    hayNavegador: boolean;
    usarEmuladores: boolean;
    claveDeSitio: string | undefined;
  },
): AppCheck | null => {
  if (_appCheck) return _appCheck;
  if (_motivo) return null;

  const motivo = motivoParaNoActivar(entorno);
  if (motivo) {
    _motivo = motivo;
    if (motivo === 'sin-clave') {
      console.warn(
        '[app-check] sin PUBLIC_RECAPTCHA_SITE_KEY: no se activa. ' +
          'Mientras el enforcement esté apagado no rompe nada, pero la consola no ' +
          'va a mostrar peticiones verificadas (ver docs/02-infraestructura.md).',
      );
    }
    return null;
  }

  try {
    _appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(entorno.claveDeSitio!),
      // Sin esto el token se saca una vez y vence: la sesión del panel dura
      // horas, así que la segunda mitad de la tarde escribiría sin token.
      isTokenAutoRefreshEnabled: true,
    });
    return _appCheck;
  } catch (e) {
    _motivo = 'fallo';
    console.warn('[app-check] no se pudo activar:', e);
    return null;
  }
};

/** Para los tests: olvida la activación anterior. */
export const _resetAppCheck = (): void => {
  _appCheck = null;
  _motivo = null;
};
