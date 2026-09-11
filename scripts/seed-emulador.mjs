#!/usr/bin/env node
/**
 * Siembra `/opciones/*` con las opciones base (§4.1) en el emulador, para que
 * el formulario arranque con los desplegables poblados.
 *
 *   npm run emu     (en otra terminal)
 *   npm run seed
 */
import { readFile } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

// Guarda: este script escribe sin credenciales, así que solo tiene sentido
// contra el emulador. Nunca contra producción.
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^(127\.0\.0\.1|localhost)/.test(host)) {
  console.error(`FIRESTORE_EMULATOR_HOST apunta a "${host}", que no es local. Abortando.`);
  process.exit(1);
}

initializeApp({ projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria' });
const db = getFirestore();

const base = JSON.parse(
  await readFile(new URL('../src/lib/opciones-base.json', import.meta.url), 'utf8'),
);

for (const [campo, valores] of Object.entries(base)) {
  await db.doc(`opciones/${campo}`).set({ valores }, { merge: false });
  console.log(`opciones/${campo} — ${valores.length} valores`);
}

/*
 * B-888 / D-660 — el centinela del índice de slugs.
 *
 * Sin esto el panel **no deja guardar nada en el emulador**: `slugLibre()` se
 * niega a contestar mientras el centinela no está, que es justo lo que hace que
 * el índice no pueda fallar abierto. Una base recién sembrada no tiene ninguna
 * actividad, así que el índice vacío **es** el índice completo: acá alcanza con
 * marcarlo. Para una base con actividades ya cargadas —un `--import` de una
 * sesión anterior— hay que correr `npm run slugs:sembrar -- --aplicar`, que es el
 * mismo script que se corre contra producción.
 */
await db.doc('slugs/_indice').set({ sembradoEn: new Date(), actividades: 0 });
console.log('slugs/_indice — centinela del índice de direcciones web');

console.log(`\nListo, sembrado en ${host}.`);
