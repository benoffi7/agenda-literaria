#!/usr/bin/env node
/**
 * §5.3 — setea el custom claim `admin` una sola vez con el Admin SDK.
 * Sin este claim las reglas de Firestore rechazan toda escritura.
 *
 *   npm run admin:claim -- <uid|email>
 *
 * Contra los emuladores exportá antes:
 *   export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const objetivo = process.argv[2];
if (!objetivo) {
  console.error('Uso: npm run admin:claim -- <uid|email>');
  console.error('     npm run admin:claim -- --todos   (solo emulador)');
  process.exit(1);
}

const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
const enEmulador = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

const credencial = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return raw ? cert(JSON.parse(raw)) : applicationDefault();
};

initializeApp(enEmulador ? { projectId } : { credential: credencial(), projectId });

const auth = getAuth();

/**
 * `--todos` es comodidad de desarrollo: entrás una vez con el popup del
 * emulador (que inventa un uid nuevo cada vez) y en lugar de copiar el uid a
 * mano, le das el claim a todos los usuarios de mentira que haya.
 * Bloqueado fuera del emulador por razones obvias.
 */
if (objetivo === '--todos') {
  if (!enEmulador) {
    console.error('--todos solo funciona contra el emulador. Exportá FIREBASE_AUTH_EMULATOR_HOST.');
    process.exit(1);
  }
  const { users } = await auth.listUsers(1000);
  if (users.length === 0) {
    console.log('No hay usuarios en el emulador todavía. Entrá una vez a /admin y repetí.');
    process.exit(0);
  }
  for (const u of users) {
    await auth.setCustomUserClaims(u.uid, { admin: true });
    console.log(`admin -> ${u.email ?? u.uid}`);
  }
} else {
  const usuario = objetivo.includes('@')
    ? await auth.getUserByEmail(objetivo)
    : await auth.getUser(objetivo);
  await auth.setCustomUserClaims(usuario.uid, { admin: true });
  console.log(`admin -> ${usuario.email ?? usuario.uid}${enEmulador ? ' (emulador)' : ''}`);
}

console.log('\nEl claim entra al token en el próximo login. Salí y volvé a entrar en /admin.');
