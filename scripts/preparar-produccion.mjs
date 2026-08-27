#!/usr/bin/env node
/**
 * Prepara el proyecto real: siembra `/opciones/*` (§4.1) y le da el claim
 * `admin` (§5.3) a las cuentas que cargan actividades.
 *
 *   node scripts/preparar-produccion.mjs <email> [email...]
 *   node scripts/preparar-produccion.mjs --listar    # quién tiene el claim hoy
 *
 * `--listar` existe porque `docs/02-infraestructura.md` tenía la tabla de
 * mails y uids escrita a mano, y este repo es público (§5.1, D-57). La lista se
 * saca de Auth cuando se la necesita en vez de vivir versionada.
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

const argumentos = process.argv.slice(2);
if (argumentos.length === 0) {
  console.error('Uso: node scripts/preparar-produccion.mjs <email> [email...]');
  console.error('     node scripts/preparar-produccion.mjs --listar');
  process.exit(1);
}

/*
 * `--listar` se busca en TODOS los argumentos y no solo en el primero, y
 * cualquier otro `-algo` aborta.
 *
 * Con `argumentos[0] === '--listar'` a secas, un `node ... mail@x --listar`
 * ignoraba el flag en silencio, sembraba `/opciones/*` **en producción** y
 * terminaba llamando a `createUser({ email: '--listar' })`. Tiraba, sí, pero
 * después de haber escrito: el error llegaba tarde. Lo encontró el
 * `auditor-privacidad` sobre B-209.
 *
 * Un flag mal puesto en un script que escribe en producción tiene que **fallar
 * cerrado**, antes de tocar nada.
 */
const quiereListar = argumentos.includes('--listar');
const desconocidos = argumentos.filter((a) => a.startsWith('-') && a !== '--listar');
if (desconocidos.length > 0) {
  console.error(`Argumento no reconocido: ${desconocidos.join(', ')}`);
  console.error('Uso: node scripts/preparar-produccion.mjs <email> [email...] | --listar');
  process.exit(1);
}
if (quiereListar && argumentos.length > 1) {
  console.error('`--listar` es solo consulta: no se combina con emails para dar el claim.');
  process.exit(1);
}
const emails = argumentos;

const projectId = 'agenda-literaria';
initializeApp({ credential: applicationDefault(), projectId });

/*
 * `--listar` sale antes de sembrar `/opciones/*`: es una consulta, no una
 * preparación, y mezclarlas haría que "quiero ver quién es admin" escriba en
 * producción. Recorre las páginas de Auth porque `listUsers` devuelve 1000 por
 * vez y no hay filtro por claim del lado del servidor.
 */
if (quiereListar) {
  const auth = getAuth();
  let token;
  const admins = [];
  do {
    const pagina = await auth.listUsers(1000, token);
    admins.push(...pagina.users.filter((u) => u.customClaims?.admin === true));
    token = pagina.pageToken;
  } while (token);

  console.log(`Cuentas con claim admin: ${admins.length}`);
  for (const u of admins) console.log(`  ${u.email ?? '(sin email)'} — ${u.uid}`);
  process.exit(0);
}

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
