#!/usr/bin/env node
/**
 * **Importa las efemérides literarias del relevamiento** — B-2224.
 *
 *   npm run efemerides:importar                        # informar (no escribe), en el emulador
 *   npm run efemerides:importar -- --aplicar           # escribe, en el emulador
 *   npm run efemerides:importar:prod                   # informar (no escribe), en producción
 *   npm run efemerides:importar:prod -- --aplicar      # escribe, en producción
 *
 * Lee `scripts/datos/efemerides-literarias.json`, que salió una sola vez del
 * `efemerides.csv` del dueño (2026-10-21): solo las 296 con **día y mes**
 * —las 25 que tenían solo el mes quedaron afuera, a pedido—, con el título en la
 * forma del formulario («Nace Umberto Eco», «Se publica «Rayuela», de Julio
 * Cortázar») y las notas de investigación que iban a salir al público
 * reescritas como el dato. Las 22 de fecha discutida (≈ en el PDF) entran como
 * **borrador**: el PDF dice «leé la nota antes de publicar», y su nota queda
 * entera para eso.
 *
 * **Idempotente**: una efeméride cuyo slug ya está en la base no se toca, así que
 * correrlo dos veces no duplica nada ni pisa lo editado en el panel.
 *
 * Escribe con el Admin SDK, que no pasa por las reglas: por eso cada entrada
 * del archivo se valida en `tests/efemerides-a-importar.test.ts` contra el
 * mismo schema que el formulario (`efemerideFormSchema`) y los topes de la regla.
 * `publicadaAlgunaVez` no se escribe: la pone el trigger de rebuild
 * (`rebuildPorEfemerides`), que además marca el rebuild del sitio.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { AUTOR_DE_LA_IMPORTACION, aImportar } from './efemerides-a-importar.mjs';

const aplicar = process.argv.includes('--aplicar');
const produccion = process.argv.includes('--produccion');
const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

/*
 * Falla cerrado en las dos direcciones (§«Idempotencia en los scripts», B-630):
 * escribir en producción exige decirlo, y decirlo con el emulador exportado es
 * una contradicción.
 */
if (produccion && enEmulador) {
  console.error('`--produccion` con FIRESTORE_EMULATOR_HOST seteado. Elegí uno. Abortando.');
  process.exit(1);
}
if (!produccion && !enEmulador) {
  console.error(
    'Sin FIRESTORE_EMULATOR_HOST y sin `--produccion`: no está claro contra qué base es.\n' +
      'Usá `npm run efemerides:importar` (emulador) o `npm run efemerides:importar:prod`.',
  );
  process.exit(1);
}

const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

const entradas = JSON.parse(
  readFileSync(new URL('./datos/efemerides-literarias.json', import.meta.url), 'utf8'),
);

console.log(enEmulador ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})` : `Objetivo: PRODUCCIÓN (${projectId})`);
console.log(aplicar ? 'Modo: escribe\n' : 'Modo: informar (no escribe)\n');

const existentes = await db.collection('efemerides').select('slug').get();
const { nuevas, yaEstan, repetidas } = aImportar(
  entradas,
  existentes.docs.map((d) => d.get('slug')),
);

console.log(`En el archivo: ${entradas.length}`);
console.log(`Ya en la base (no se tocan): ${yaEstan.length}`);
console.log(`Repetidas en el archivo (no entran): ${repetidas.length}`);
console.log(
  `A escribir: ${nuevas.length} — ${nuevas.filter((e) => e.estado === 'publicado').length} publicadas, ` +
    `${nuevas.filter((e) => e.estado === 'borrador').length} borradores`,
);
for (const e of repetidas) console.warn(`  ⚠️  repetida: ${e.slug}`);

if (!aplicar) {
  console.log('\nCorré de nuevo con --aplicar para escribirlo de verdad.');
  process.exit(0);
}

// Un `batch` admite 500 operaciones; se parte de a 400 para dejar margen.
for (let i = 0; i < nuevas.length; i += 400) {
  const batch = db.batch();
  for (const e of nuevas.slice(i, i + 400)) {
    batch.set(db.collection('efemerides').doc(), {
      titulo: e.titulo,
      slug: e.slug,
      descripcion: e.descripcion,
      dia: e.dia,
      mes: e.mes,
      anio: e.anio,
      fuente: e.fuente,
      estado: e.estado,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: AUTOR_DE_LA_IMPORTACION,
      updatedBy: AUTOR_DE_LA_IMPORTACION,
    });
  }
  await batch.commit();
}

console.log(`\nListo. Escritas ${nuevas.length}. El sitio las muestra después del próximo build.`);
process.exit(0);
