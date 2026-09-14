#!/usr/bin/env node
/**
 * **Backfill de `ciudades` en `/actividades`** — B-919, D-690.
 *
 *   node scripts/sembrar-ciudades.mjs                          # informar (no escribe)
 *   node scripts/sembrar-ciudades.mjs --aplicar                # escribe, en el emulador
 *   node scripts/sembrar-ciudades.mjs --aplicar --produccion   # escribe, en producción
 *
 * ── Por qué hace falta, y qué pasa si no se corre ─────────────────────────
 * `ciudades` es el derivado que hace expresable el alcance por ciudad del rol
 * `publicador`: la regla pregunta `token.ciudad in resource.data.ciudades`, y una
 * regla no puede mirar adentro de `modalidades[]` ni normalizar lo que alguien
 * tipeó en un campo libre (el razonamiento largo está en `src/lib/ciudades.mjs`).
 *
 * Lo escribe `formADocumento` en cada guardado, o sea que **lo nuevo nace con el
 * campo puesto**. Los documentos que ya están en producción no lo tienen, y el
 * default de lectura de la regla —`.get('ciudades', [])`— los deja fuera del
 * alcance de todo publicador.
 *
 * **O sea: hasta que esto corra, la publicadora no ve NADA de su ciudad.** Solo
 * lo suyo, que es exactamente el comportamiento anterior a B-919. Es la dirección
 * correcta para fallar —no se abre de más— pero es un paso del despliegue y no
 * una prolijidad, igual que `sembrar-slugs.mjs`.
 *
 * ── Idempotente, y a propósito no pisa lo que ya está bien ────────────────
 * Recalcula `ciudades` de cada actividad y escribe **solo las que difieren**
 * (§"Idempotencia en los scripts"). Correrlo dos veces seguidas: la segunda no
 * escribe nada. Y no borra nada: no hay caso de «ciudad huérfana», porque el
 * campo entero se deriva del documento en el que vive.
 *
 * ── Lo que la escritura dispara, dicho antes de correrlo ──────────────────
 *  - **Una versión del §12 por actividad tocada.** `ciudades` no está en
 *    `CAMPOS_DE_MAQUINA` de `functions/historial.js`, con el mismo criterio que
 *    `searchText` y `sede`: los derivados del contenido son parte de la foto. Es
 *    un documento de más y visible, que es el lado barato de la asimetría de
 *    D-41.
 *  - **Ningún evento de Calendar cambia.** La guarda del §7.1 compara el payload
 *    que se le mandaría a Calendar, y `ciudades` no entra en ese payload.
 *  - **Un rebuild del sitio.** El flag se prende por escritura; el debounce del §8
 *    lo colapsa en uno solo.
 *
 * Escribe con el Admin SDK, que pasa por encima de las reglas.
 *
 * Objetivo: el emulador si `FIRESTORE_EMULATOR_HOST` está seteado, producción si
 * no (con las Application Default Credentials de gcloud, sin bajar ninguna key).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// **La misma derivación que el panel**, importada y no copiada: el permiso
// depende de que el slug del documento y el del claim sean idénticos, así que un
// segundo `slugify` acá sería el bug (clase de B-88). Ver `src/lib/ciudades.mjs`.
import { ciudadesDe } from '../src/lib/ciudades.mjs';

const aplicar = process.argv.includes('--aplicar');
const confirmaProduccion = process.argv.includes('--produccion');

const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

/*
 * La guarda de las dos direcciones (§"Idempotencia en los scripts", B-630), la
 * misma que `sembrar-slugs.mjs`: `--aplicar` sin el host del emulador apunta a
 * producción, y acá eso escribe en cada actividad del catálogo.
 */
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

/**
 * Las que hay que escribir: las que no tienen el campo, y las que lo tienen
 * desactualizado (un documento editado a mano en la consola, o guardado antes de
 * que `ModalidadesEditor` tuviera la ciudad).
 *
 * La comparación es sobre el JSON del array **en orden**, y no sobre un `Set`,
 * porque el orden lo decide `ciudadesDe` de forma determinística a partir del
 * orden de las filas: dos listas con los mismos slugs en distinto orden son dos
 * derivaciones distintas del mismo documento, y conviene que se noten.
 */
const aEscribir = [];
const yaAlDia = [];
for (const d of actividades.docs) {
  const esperado = ciudadesDe(d.get('modalidades') ?? []);
  const actual = d.get('ciudades');
  if (JSON.stringify(actual ?? null) === JSON.stringify(esperado)) yaAlDia.push(d.id);
  else aEscribir.push([d.id, esperado, actual]);
}

console.log(`Actividades: ${actividades.size}`);
console.log(`Ya al día: ${yaAlDia.length}`);
console.log(`A escribir: ${aEscribir.length}`);
for (const [id, esperado, actual] of aEscribir) {
  const antes = actual === undefined ? 'sin campo' : JSON.stringify(actual);
  console.log(`  · ${id}: ${antes} → ${JSON.stringify(esperado)}`);
}

/*
 * Las que quedan en `[]` **no son un error**: una actividad solo virtual no es de
 * ninguna ciudad, y una presencial sin la ciudad cargada tampoco se puede afirmar
 * que lo sea. Se cuentan aparte porque son las que ninguna publicadora va a ver, y
 * ese es el caso que alguien va a venir a preguntar.
 */
const sinCiudad = aEscribir.filter(([, esperado]) => esperado.length === 0).length;
if (sinCiudad > 0) {
  console.log(
    `\nℹ️  ${sinCiudad} de ellas quedan sin ninguna ciudad (virtuales, o con la ciudad vacía).\n` +
      '   No las ve ningún publicador por ciudad: es lo correcto, no un error.',
  );
}

if (!aplicar) {
  console.log('\nCorré de nuevo con --aplicar para escribirlo de verdad.');
  process.exit(0);
}

// Un `batch` admite 500 operaciones; se parte de a 400 para dejar margen, igual
// que `sembrar-slugs.mjs`.
for (let i = 0; i < aEscribir.length; i += 400) {
  const batch = db.batch();
  for (const [id, esperado] of aEscribir.slice(i, i + 400)) {
    // `update` y no `set`: preserva el resto del documento y falla si la
    // actividad desapareció entre el `get` y esto, que es la dirección correcta.
    batch.update(db.doc(`actividades/${id}`), { ciudades: esperado });
  }
  await batch.commit();
}

console.log(`\nListo. Escritas ${aEscribir.length}.`);
process.exit(0);
