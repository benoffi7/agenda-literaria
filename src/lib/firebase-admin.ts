/**
 * §5.4 — SOLO build time. Puede importarse desde frontmatter de `.astro`,
 * `getStaticPaths` o scripts de build. Si se cuela en un componente cliente,
 * la service account key termina en el bundle.
 *
 * La guarda de abajo hace que ese error explote en el build en vez de
 * filtrarse silenciosamente.
 */
import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

if (typeof window !== 'undefined') {
  throw new Error(
    'firebase-admin importado desde el cliente. Ver §5.4 de CLAUDE.md: ' +
      'esto filtra la service account key al bundle.',
  );
}

const PROJECT_ID = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

let _app: App | null = null;

const credencial = () => {
  // En CI la key viaja como secret en una variable de entorno, nunca en el repo.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return cert(JSON.parse(raw));
  // Local: GOOGLE_APPLICATION_CREDENTIALS, o nada si vamos contra el emulador.
  return applicationDefault();
};

export const adminApp = (): App => {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0]!;
    return _app;
  }
  // Contra el emulador (FIRESTORE_EMULATOR_HOST) no hace falta credencial real.
  _app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId: PROJECT_ID })
    : initializeApp({ credential: credencial(), projectId: PROJECT_ID });
  return _app;
};

export const adminDb = (): Firestore => getFirestore(adminApp());

/** ¿Tenemos con qué leer Firestore en este build? */
export const hayCredenciales = (): boolean =>
  Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
