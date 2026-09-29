#!/usr/bin/env node
/**
 * **El vocabulario de lugar que las actividades ya usan** — B-975.
 *
 *   node scripts/vocabulario-desde-actividades.mjs                          # informar (no escribe)
 *   node scripts/vocabulario-desde-actividades.mjs --aplicar                # emulador
 *   node scripts/vocabulario-desde-actividades.mjs --aplicar --produccion   # producción
 *   node scripts/vocabulario-desde-actividades.mjs --aplicar --campo=ciudad # solo ese campo
 *
 * Desde B-2172 también siembra `organizador` (roadmap 1.5): la lista con la
 * variante más escrita de cada uno. La decisión vive en `vocabulario-a-sembrar.mjs`.
 *
 * ── El problema ───────────────────────────────────────────────────────────
 * `/opciones/ciudad` tenía **un** valor —`caba`, el que sembró
 * `opciones-base.json`— mientras las actividades cargadas nombraban treinta
 * ciudades distintas. O sea que el desplegable de «Ciudad» estaba
 * prácticamente vacío en un catálogo lleno de ciudades: había que volver a
 * tipear Mar del Plata aunque hubiera treinta y dos actividades ahí.
 *
 * Pasó porque la ciudad **no era taxonomía** antes de B-950: era un `<input>` de
 * texto libre, así que lo tipeado se guardó en el documento y nunca pasó por
 * `/opciones/*`. Los documentos tienen el dato; el vocabulario no.
 *
 * ── Qué hace ──────────────────────────────────────────────────────────────
 * Recorre `sede` de cada fila de `modalidades` (y la `sede` suelta de los
 * documentos viejos), slugifica lo que encuentra con **el mismo `slugify` que el
 * panel**, y agrega a `/opciones/{campo}` lo que falte, con su `usos` real.
 *
 * **Solo agrega.** No borra, no renombra y no toca las que ya están: una opción
 * con su `label` corregido a mano —o marcada `fijo`— se queda como está. Correrlo
 * dos veces seguidas: la segunda no escribe nada.
 *
 * ── Por qué sigue existiendo después de arreglar el registro ──────────────
 * B-975 también hizo que `elegidosDe` cuente `provincia` y `ciudad`, así que de
 * acá en adelante una ciudad nueva entra sola al guardar. **Esto es para lo que
 * ya estaba cargado**, que es lo que aquel arreglo no puede alcanzar: nadie va a
 * reeditar 293 actividades para que sus ciudades aparezcan en el desplegable.
 *
 * Y queda como herramienta: si algún día una ciudad entra a un documento por un
 * camino que no pasa por el formulario —un backfill, una restauración, una
 * importación—, esto la recupera sin tener que adivinar cuál fue.
 *
 * ── Lo que la escritura dispara ───────────────────────────────────────────
 * Escribir en `/opciones/*` prende el flag del §8 (`rebuildPorOpciones`), así que
 * hay **un** rebuild del sitio. No toca ninguna actividad, así que **no** hay
 * versiones del §12 ni llamadas a Calendar — ésa es la diferencia con
 * `sembrar-geografia.mjs`, que sí reescribe documentos.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
// Qué se siembra y con qué slug —el mismo `slugify` que el panel, importado y no
// copiado (§4.2)— vive en el módulo puro, que es lo que el test mira.
import {
  CAMPOS,
  CAMPOS_LEIDOS,
  sedesDe,
  usosPorCampo,
  valoresNuevos,
} from './vocabulario-a-sembrar.mjs';

const aplicar = process.argv.includes('--aplicar');
const produccion = process.argv.includes('--produccion');

/*
 * Falla cerrado, igual que `sembrar-geografia.mjs`: escribir en producción exige
 * decirlo, y apuntar al emulador exige que el emulador esté. Sin esto, un
 * `--aplicar` suelto escribiría en el proyecto real creyendo tocar el emulador.
 */
if (produccion && process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('`--produccion` con FIRESTORE_EMULATOR_HOST seteado. Elegí uno. Abortando.');
  process.exit(1);
}
if (!produccion && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'Sin FIRESTORE_EMULATOR_HOST y sin `--produccion`: no está claro contra qué base es.\n' +
      'Usá `npm run vocabulario:sembrar` (emulador) o `npm run vocabulario:sembrar:prod`.',
  );
  process.exit(1);
}

const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

/*
 * `--campo=ciudad` acota a uno, y **no es comodidad**: lo que este script
 * encuentra «en uso y sin ofrecer» no siempre es algo que convenga ofrecer. En
 * `barrio` lo que aparece es sobre todo basura de cuando era el único campo de
 * lugar —`"Villa Crespo, CABA"`, una provincia entera—, y agregarla al
 * desplegable empeora justo lo que hay que limpiar. Informar todos y **dejar
 * elegir cuál se escribe** es lo que separa el diagnóstico de la decisión.
 */
const pedido = process.argv.find((a) => a.startsWith('--campo='))?.slice('--campo='.length);
if (pedido && !CAMPOS.includes(pedido)) {
  console.error(`\`--campo=${pedido}\` no es uno de: ${CAMPOS.join(', ')}.`);
  process.exit(1);
}
/** Sobre cuáles se escribe. Se informa siempre sobre todos. */
const A_ESCRIBIR = pedido ? [pedido] : CAMPOS;

const snap = await db.collection('actividades').select(...CAMPOS_LEIDOS).get();
const actividades = snap.docs.map((d) => d.data());
const usos = usosPorCampo(actividades);
const filasConSede = actividades.reduce((n, a) => n + sedesDe(a).length, 0);

console.log(`actividades: ${snap.size} · filas con sede: ${filasConSede} · base: ${produccion ? 'PRODUCCIÓN' : process.env.FIRESTORE_EMULATOR_HOST}\n`);

let algoQueEscribir = false;

for (const campo of CAMPOS) {
  const ref = db.doc(`opciones/${campo}`);
  const existentes = (await ref.get()).data()?.valores ?? [];
  const faltan = valoresNuevos(usos[campo], existentes);

  console.log(`/opciones/${campo} — ${existentes.length} en el vocabulario, ${usos[campo].size} en uso, ${faltan.length} sin ofrecer`);
  for (const { slug, label, usos: n } of faltan) {
    console.log(`    + ${slug.padEnd(30)} "${label}"  (${n} actividad${n === 1 ? '' : 'es'})`);
  }

  if (faltan.length === 0) continue;
  if (!A_ESCRIBIR.includes(campo)) {
    console.log(`  (no se escribe: --campo=${pedido})`);
    continue;
  }
  algoQueEscribir = true;
  if (!aplicar) continue;

  // La forma de cada valor, y por qué `aprobada: true`: `valoresNuevos`.
  await db.runTransaction(async (tx) => {
    /*
     * En transacción y releyendo adentro, por lo mismo que `upsertOpcion` del
     * §4.2: entre la lectura de arriba y esta escritura alguien puede haber
     * guardado una actividad con una etiqueta nueva, y un `set` con la lista de
     * antes se la comería.
     */
    const actual = (await tx.get(ref)).data()?.valores ?? [];
    const yaEstan = new Set(actual.map((v) => v.slug));
    const aAgregar = faltan.filter((v) => !yaEstan.has(v.slug));
    if (aAgregar.length === 0) return;
    // `set` con `merge` y no `update`: si el documento no existe todavía en esa
    // base, `update` fallaría.
    tx.set(ref, { valores: FieldValue.arrayUnion(...aAgregar) }, { merge: true });
  });
  console.log(`  → ${faltan.length} agregada(s) a /opciones/${campo}`);
}

if (!algoQueEscribir) {
  console.log('\n✓ el vocabulario ya ofrece todo lo que las actividades usan.');
} else if (!aplicar) {
  console.log('\nNada escrito. Para aplicar: agregá `--aplicar`.');
} else {
  console.log('\nListo. El rebuild del sitio se dispara solo (§8, `rebuildPorOpciones`).');
}
