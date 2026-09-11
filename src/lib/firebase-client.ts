/**
 * SDK de cliente — app y auth del admin.
 * Estas claves son públicas por diseño: la seguridad la dan las reglas (§5.3),
 * no el secreto de la config.
 *
 * B-09 — acá NO se importa `firebase/firestore`. Este módulo es el que carga la
 * pantalla de login, y Firestore recién hace falta después de entrar: vive en
 * `@/lib/firestore-client`. No re-exportar `db` desde acá.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { activarAppCheck } from '@/lib/appcheck';
// Puro: no arrastra Firestore, así que no toca el corte del bundle de B-09/D-51.
import { rolDeClaims, type RolDelPanel } from '@/lib/rolDelPanel';
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  // Analítica del panel. Va en la config del app para que `getAnalytics` no
  // tenga que ir a buscar la config dinámica por red (docs/09-analitica.md).
  // Si falta, no se mide: es uno de los portones de `debeMedir`.
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const usarEmuladores = import.meta.env.PUBLIC_USE_EMULATORS === 'true';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

export const app = (): FirebaseApp => {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(config);
  /*
   * B-836 — App Check se activa **acá y no en cada consumidor**, porque éste es
   * el borde por el que pasan todos: auth, Firestore y Storage llaman a `app()`
   * antes de hacer su primera petición. Es lo que garantiza el orden que App
   * Check necesita —estar inicializado antes de la primera llamada— sin que cada
   * módulo nuevo tenga que acordarse.
   *
   * No se activa contra los emuladores ni sin clave de sitio, y un fallo no
   * rompe nada: el detalle y el motivo de cada caso están en `lib/appcheck.ts`.
   */
  activarAppCheck(_app, {
    hayNavegador: typeof window !== 'undefined',
    usarEmuladores,
    claveDeSitio: import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY,
  });
  return _app;
};

export const auth = (): Auth => {
  if (_auth) return _auth;
  _auth = getAuth(app());
  if (usarEmuladores) {
    connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return _auth;
};

export const loginConGoogle = () => signInWithPopup(auth(), new GoogleAuthProvider());
export const logout = () => fbSignOut(auth());
export const observarAuth = (cb: (u: User | null) => void) => onAuthStateChanged(auth(), cb);

/**
 * §5.3 — la escritura la habilita un custom claim (`admin` o, desde B-888,
 * `publicador`), seteado una vez con el Admin SDK. Acá solo lo leemos para
 * decidir qué mostrar; **la autorización real la hacen las reglas de Firestore**
 * y las de Storage.
 *
 * Devuelve `null` cuando la cuenta no tiene ninguno de los dos, que es lo que
 * pinta la pantalla «Sin permisos».
 *
 * La regla de desempate —con los dos claims gana el acotado— vive en
 * `rolDeClaims` (`lib/rolDelPanel.ts`), que es puro y tiene su test contra el
 * texto de `firestore.rules`: acá solo se lee el token.
 */
export const rolDelPanel = async (u: User): Promise<RolDelPanel | null> => {
  const token = await u.getIdTokenResult(true);
  return rolDeClaims(token.claims as Record<string, unknown>);
};

/**
 * @deprecated B-888 — usar `rolDelPanel`. Se conserva porque contesta la
 * pregunta vieja («¿es admin?») sin ambigüedad y hay tests que la nombran; lo
 * que **no** hay que hacer es usarla para decidir qué se muestra, porque un
 * publicador daría `false` y vería «Sin permisos» teniendo permisos.
 */
export const tieneClaimAdmin = async (u: User): Promise<boolean> =>
  (await rolDelPanel(u)) === 'admin';

export { usarEmuladores };
