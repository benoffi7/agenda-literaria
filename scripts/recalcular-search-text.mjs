#!/usr/bin/env node
/**
 * **El `searchText` de las actividades guardadas antes de B-2185.**
 *
 *   node scripts/recalcular-search-text.mjs                          # informar (no escribe)
 *   node scripts/recalcular-search-text.mjs --aplicar                # escribe, en el emulador
 *   node scripts/recalcular-search-text.mjs --aplicar --produccion   # escribe, en producción
 *
 * Hasta B-2185 `buildSearchText` metía la descripción cruda, y el `searchText`
 * sale entero a `/events.json`: un link de Meet pegado en la descripción se
 * publicaba por ahí. El arreglo corrige cada guardado nuevo; esto corrige los que
 * ya estaban guardados, con **la misma** función del servidor (`derivadosDe`), así
 * que lo que escribe es exactamente lo que `syncCalendar` dejaría.
 *
 * ── Correrlo después del deploy de functions, no antes ────────────────────
 * Con el servidor viejo, la próxima escritura de cada actividad la «corregiría»
 * de vuelta al texto con el link (`derivadosDesalineados`, B-2050).
 *
 * ── Lo que la escritura dispara ───────────────────────────────────────────
 *  - **Ninguna versión del §12**: `searchText` está en `CAMPOS_DE_MAQUINA`.
 *  - **Ningún evento de Calendar**: `searchText` no está en la guarda del §7.1.
 *  - **Un rebuild del sitio** (`pideRebuild`), que el debounce del §8 colapsa en uno.
 *
 * El informe dice **ids y cuántas**, nunca el texto: el `searchText` viejo es
 * justamente lo que tiene el link.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { derivadosDe } from '../functions/derivados.js';

const aplicar = process.argv.includes('--aplicar');
const confirmaProduccion = process.argv.includes('--produccion');
const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

/* La guarda de las dos direcciones (B-630), la misma que los otros scripts. */
if (aplicar && !enEmulador && !confirmaProduccion) {
  console.error(
    '--aplicar sin FIRESTORE_EMULATOR_HOST apunta a PRODUCCIÓN.\n' +
      '¿Te olvidaste de exportar el host del emulador?\n' +
      'Si es a propósito: agregá también --produccion. Abortando.',
  );
  process.exit(1);
}

initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();
console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})\n`
    : `Objetivo: PRODUCCIÓN (${projectId})\n`,
);

const actividades = await db.collection('actividades').get();
const aEscribir = actividades.docs.flatMap((d) => {
  const searchText = derivadosDe(d.data()).searchText;
  return d.data().searchText === searchText ? [] : [[d.id, searchText]];
});

console.log(`${aEscribir.length} de ${actividades.size} actividades con el searchText desactualizado.`);
for (const [id] of aEscribir) console.log(`  ${id}`);

if (!aplicar) {
  console.log('\nNada escrito. Corré de nuevo con --aplicar para escribirlo de verdad.');
  process.exit(0);
}

for (let i = 0; i < aEscribir.length; i += 400) {
  const batch = db.batch();
  for (const [id, searchText] of aEscribir.slice(i, i + 400))
    batch.update(db.doc(`actividades/${id}`), { searchText });
  await batch.commit();
}
console.log(`\nEscritas ${aEscribir.length}.`);
