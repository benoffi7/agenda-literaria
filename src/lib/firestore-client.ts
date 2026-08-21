/**
 * Firestore del panel. Vive aparte de `firebase-client.ts` a propósito.
 *
 * B-09 — la pantalla de login solo necesita `firebase/auth`. Mientras `db()`
 * convivía con `auth()` en el mismo módulo, entrar a `/admin` bajaba también el
 * SDK de Firestore (~360 KB sin comprimir) antes de poder pintar el botón
 * "Entrar con Google". Separados, el grafo de imports deja Firestore del lado
 * de los módulos que recién se cargan después del login (ver el `diferido()`
 * de `AdminApp`).
 *
 * Consecuencia práctica: **importar `db` desde acá, nunca desde
 * `firebase-client`**. Si se vuelve a exportar desde ahí, el import estático
 * arrastra Firestore al chunk del login y la mejora se pierde en silencio.
 *
 * La app de Firebase sigue siendo una sola (`app()`), así que auth y Firestore
 * comparten la misma instancia y el mismo usuario.
 */
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { app, usarEmuladores } from '@/lib/firebase-client';

let _db: Firestore | null = null;

export const db = (): Firestore => {
  if (_db) return _db;
  _db = getFirestore(app());
  if (usarEmuladores) {
    connectFirestoreEmulator(_db, '127.0.0.1', 8080);
  }
  return _db;
};
