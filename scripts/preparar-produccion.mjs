#!/usr/bin/env node
/**
 * Prepara el proyecto real: siembra `/opciones/*` (§4.1) y le da el claim
 * `admin` (§5.3) a las cuentas que cargan actividades.
 *
 *   node scripts/preparar-produccion.mjs <email> [email...]
 *
 * Usa las Application Default Credentials de gcloud, así que no hace falta
 * bajar ninguna service account key al disco.
 *
 * A diferencia de seed-emulador.mjs, este escribe en producción: aborta si
 * detecta FIRESTORE_EMULATOR_HOST, para no confundir un entorno con el otro.
 */
import { readFile } from 'node:fs/promises';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Hay variables de emulador seteadas. Este script es para producción. Abortando.');
  process.exit(1);
}

const emails = process.argv.slice(2);
if (emails.length === 0) {
  console.error('Uso: node scripts/preparar-produccion.mjs <email> [email...]');
  process.exit(1);
}

const projectId = 'agenda-literaria';
initializeApp({ credential: applicationDefault(), projectId });

// ── Opciones base ────────────────────────────────────────────────
const db = getFirestore();
const base = JSON.parse(
  await readFile(new URL('../src/lib/opciones-base.json', import.meta.url), 'utf8'),
);

for (const [campo, valores] of Object.entries(base)) {
  const ref = db.doc(`opciones/${campo}`);
  const snap = await ref.get();
  if (snap.exists) {
    // Idempotente: no pisa las opciones que se hayan creado con "Otro".
    console.log(`opciones/${campo} — ya existía, no se toca`);
  } else {
    await ref.set({ valores });
    console.log(`opciones/${campo} — sembrado con ${valores.length} valores`);
  }
}

// ── Admins ───────────────────────────────────────────────────────
const auth = getAuth();

for (const email of emails) {
  let usuario;
  try {
    usuario = await auth.getUserByEmail(email);
  } catch {
    // El usuario todavía no entró nunca. Se crea acá para poder dejarle el
    // claim listo: al loguearse con Google, Firebase linkea por email y le
    // conserva este uid junto con el claim.
    usuario = await auth.createUser({ email, emailVerified: true });
    console.log(`auth — cuenta creada para ${email}`);
  }
  await auth.setCustomUserClaims(usuario.uid, { admin: true });
  console.log(`admin -> ${email} (${usuario.uid})`);
}

console.log('\nListo. El claim entra al token en el próximo login.');
