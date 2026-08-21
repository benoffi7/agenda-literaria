/**
 * SDK de cliente — auth del admin y escritura a Firestore desde el panel.
 * Estas claves son públicas por diseño: la seguridad la dan las reglas (§5.3),
 * no el secreto de la config.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
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
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

const usarEmuladores = import.meta.env.PUBLIC_USE_EMULATORS === 'true';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export const app = (): FirebaseApp => {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(config);
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

export const db = (): Firestore => {
  if (_db) return _db;
  _db = getFirestore(app());
  if (usarEmuladores) {
    connectFirestoreEmulator(_db, '127.0.0.1', 8080);
  }
  return _db;
};

export const loginConGoogle = () => signInWithPopup(auth(), new GoogleAuthProvider());
export const logout = () => fbSignOut(auth());
export const observarAuth = (cb: (u: User | null) => void) => onAuthStateChanged(auth(), cb);

/**
 * §5.3 — la escritura la habilita el custom claim `admin`, seteado una vez con
 * el Admin SDK. Acá solo lo leemos para decidir qué mostrar; la autorización
 * real la hacen las reglas de Firestore.
 */
export const tieneClaimAdmin = async (u: User): Promise<boolean> => {
  const token = await u.getIdTokenResult(true);
  return token.claims.admin === true;
};

export { usarEmuladores };
