/**
 * **App Check** — B-836, la capa que frena al script que no pasa por la página.
 *
 * Dos mitades, y las dos hacen falta:
 *
 * 1. **La decisión de activarlo o no**, que es pura (`motivoParaNoActivar`) y se
 *    prueba exhaustivamente. Es donde vive el criterio: no contra los
 *    emuladores, no sin clave, no fuera del navegador.
 * 2. **Que esté cableado en el lugar correcto**, que no es pura y se afirma
 *    sobre el fuente: App Check tiene que estar inicializado **antes de la
 *    primera llamada a Firestore**, y eso depende de *desde dónde* se lo llama.
 *    Un test que solo verificara la función pura dejaría pasar un cableado que
 *    activa App Check después de la primera escritura, que es el modo de falla
 *    que importa el día que el enforcement se active.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { _resetAppCheck, activarAppCheck, motivoParaNoActivar } from '@/lib/appcheck';
import type { FirebaseApp } from 'firebase/app';

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/**
 * El fuente **sin comentarios**, que es lo que los asertos de prohibición tienen
 * que mirar.
 *
 * No es una comodidad: los docblocks de `appcheck.ts` explican justamente lo que
 * no hay que hacer —nombran `ReCaptchaV3Provider`, `recaptcha/enterprise.js` y
 * `grecaptcha` para decir que no van—, así que un barrido sobre el archivo
 * entero se agarra a sí mismo. Es el mismo saneador que usan
 * `guardas-de-los-scripts.test.ts` y `promesas-sobre-datos.test.ts`, y por el
 * mismo motivo: distinguir lo que el código hace de lo que un comentario dice.
 */
const codigo = (rel: string): string => sinComentarios(fuente(rel));

const CLAVE = 'clave-de-sitio-de-prueba';
const NAVEGADOR = { hayNavegador: true, usarEmuladores: false, claveDeSitio: CLAVE };

describe('cuándo se activa App Check, y cuándo no — B-836', () => {
  it('en el navegador, sin emuladores y con clave: se activa', () => {
    expect(motivoParaNoActivar(NAVEGADOR)).toBe(null);
  });

  it('fuera del navegador no: el build lee con el Admin SDK, que no pasa por App Check', () => {
    expect(motivoParaNoActivar({ ...NAVEGADOR, hayNavegador: false })).toBe('sin-navegador');
  });

  /**
   * **Es la razón por la que este archivo no necesita token de debug.** Los
   * emuladores no verifican App Check, así que activarlo contra ellos solo
   * agrega una llamada a reCAPTCHA que no sirve — y haría que la suite de
   * integración dependa de un tercero para poder correr.
   */
  it('contra los emuladores no, aunque haya clave', () => {
    expect(motivoParaNoActivar({ ...NAVEGADOR, usarEmuladores: true })).toBe('emuladores');
  });

  it('sin clave de sitio no, y una cadena vacía cuenta como sin clave', () => {
    expect(motivoParaNoActivar({ ...NAVEGADOR, claveDeSitio: undefined })).toBe('sin-clave');
    expect(motivoParaNoActivar({ ...NAVEGADOR, claveDeSitio: '' })).toBe('sin-clave');
  });

  /**
   * El orden entre los motivos no es cosmético: fuera del navegador **no hay
   * nada que avisar**, así que ese caso tiene que ganarle a `sin-clave` — si no,
   * el build imprimiría el aviso de configuración incompleta en cada página que
   * genera.
   */
  it('sin navegador le gana a sin clave: el build no tiene que avisar nada', () => {
    expect(
      motivoParaNoActivar({ hayNavegador: false, usarEmuladores: false, claveDeSitio: undefined }),
    ).toBe('sin-navegador');
  });
});

describe('activar es idempotente y no puede romper el panel', () => {
  beforeEach(() => _resetAppCheck());

  const appFalsa = {} as FirebaseApp;

  it('en un entorno donde no corresponde, devuelve null y no tira', () => {
    expect(() => activarAppCheck(appFalsa, { ...NAVEGADOR, usarEmuladores: true })).not.toThrow();
    expect(activarAppCheck(appFalsa, { ...NAVEGADOR, usarEmuladores: true })).toBe(null);
  });

  /**
   * `initializeAppCheck` sobre una app de mentira tira. Es exactamente el caso
   * que el `catch` existe para tapar —clave mal, reCAPTCHA sin responder— y lo
   * que se afirma es lo que importa: **no propaga**. Mientras el enforcement
   * esté apagado, la escritura la autorizan las reglas igual; cuando se active,
   * el error tiene que verse del lado del servidor y no dejando la pantalla de
   * login en blanco.
   */
  it('un fallo de inicialización no propaga', () => {
    expect(() => activarAppCheck(appFalsa, NAVEGADOR)).not.toThrow();
    expect(activarAppCheck(appFalsa, NAVEGADOR)).toBe(null);
  });

  it('no reintenta después de un fallo: un aviso por carga, no uno por llamada', () => {
    // `app()` se llama muchas veces —cada consumidor del SDK entra por ahí—, así
    // que sin el recuerdo del motivo el panel intentaría inicializar App Check
    // en cada una y llenaría la consola.
    activarAppCheck(appFalsa, NAVEGADOR);
    expect(activarAppCheck(appFalsa, NAVEGADOR)).toBe(null);
  });
});

describe('el cableado: App Check se activa antes de la primera petición', () => {
  const CLIENTE = fuente('src/lib/firebase-client.ts');
  const APPCHECK = fuente('src/lib/appcheck.ts');

  /**
   * **`app()` es el único borde por el que pasan todos**: `getAuth`,
   * `getFirestore` y `getStorage` lo llaman antes de su primera petición. Es lo
   * que hace que el orden se cumpla sin que cada módulo nuevo se acuerde — y por
   * eso el aserto es sobre *dónde* está la llamada y no sobre que exista.
   */
  it('se llama desde `app()`, y antes del `return`', () => {
    const cuerpo = /export const app = \(\): FirebaseApp => \{([\s\S]*?)\n\};/.exec(CLIENTE)?.[1];
    expect(cuerpo, 'no se pudo leer el cuerpo de `app()`').toBeDefined();
    expect(cuerpo, '`app()` ya no activa App Check').toContain('activarAppCheck(');
    const activar = cuerpo!.indexOf('activarAppCheck(');
    const retorno = cuerpo!.lastIndexOf('return _app;');
    expect(activar).toBeGreaterThan(-1);
    expect(retorno).toBeGreaterThan(activar);
  });

  it('la clave sale del entorno y no está escrita en el código', () => {
    expect(CLIENTE).toContain('import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY');
    // El módulo decide, no configura: la clave se le pasa.
    expect(APPCHECK, 'appcheck.ts lee el entorno por su cuenta').not.toContain('import.meta.env');
  });

  /**
   * **El proveedor tiene que ser el de Enterprise.** La clave que registró el
   * dueño es de reCAPTCHA Enterprise (score-based), y los dos proveedores no son
   * intercambiables: validan contra servicios distintos, así que con
   * `ReCaptchaV3Provider` el token se rechaza. Es un error que no se ve hasta
   * que el enforcement está activo, o sea el peor momento.
   */
  it('usa `ReCaptchaEnterpriseProvider` y no el de v3 clásico', () => {
    const src = codigo('src/lib/appcheck.ts');
    expect(src).toContain('ReCaptchaEnterpriseProvider');
    expect(src, 'v3 clásico no sirve con una clave Enterprise').not.toContain(
      'ReCaptchaV3Provider',
    );
  });

  it('el token se refresca solo', () => {
    // La sesión del panel dura horas; sin esto, la segunda mitad de la tarde
    // escribiría con un token vencido.
    expect(APPCHECK).toContain('isTokenAutoRefreshEnabled: true');
  });

  /**
   * **El `<script>` de reCAPTCHA a mano no va, y esto lo prohíbe.**
   *
   * La integración *genérica* de reCAPTCHA Enterprise —la que muestra la consola
   * de Google al crear la clave— es cargar `recaptcha/enterprise.js` en el
   * `<head>` y llamar `grecaptcha.enterprise.execute()` uno mismo. **No es** la de
   * App Check: el SDK carga el script y ejecuta el desafío por su cuenta a partir
   * de la clave, y las dos integraciones juntas se pelean por el mismo widget.
   *
   * Es fácil de agregar de buena fe —está en la documentación de Google, y el
   * síntoma de tenerlo doble no es un error sino un comportamiento raro—, así que
   * se barre todo el markup del sitio y del panel y no solo el archivo que hoy
   * lo tendría.
   */
  it('nadie carga el script de reCAPTCHA ni ejecuta el desafío a mano', () => {
    const enElRepo = (patron: RegExp): string[] =>
      ['src/lib/appcheck.ts', 'src/lib/firebase-client.ts', 'src/layouts/Base.astro'].filter((f) =>
        patron.test(codigo(f)),
      );
    expect(enElRepo(/recaptcha\/(enterprise|api)\.js/), 'el script se carga a mano').toEqual([]);
    expect(enElRepo(/\bgrecaptcha\b/), 'alguien ejecuta el desafío a mano').toEqual([]);
  });

  /**
   * El import es **estático** a propósito, y conviene que un test lo diga: con un
   * `import()` diferido la activación es asíncrona y la primera escritura puede
   * salir sin token. Hoy es inocuo —el enforcement está apagado— y el día que se
   * active sería un fallo intermitente, que es la peor forma de fallar.
   */
  it('el import de `firebase/app-check` es estático', () => {
    // `sinComentarios` colapsa los saltos de línea, así que el aserto es sobre
    // la forma del especificador y no sobre la línea.
    const src = codigo('src/lib/appcheck.ts');
    expect(src).toContain("} from 'firebase/app-check';");
    expect(src, 'se difirió el SDK y la activación pasó a ser asíncrona').not.toMatch(
      /import\(\s*'firebase\/app-check'/,
    );
  });
});
