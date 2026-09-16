#!/usr/bin/env node
/**
 * **El vocabulario de lugar que las actividades ya usan** — B-975.
 *
 *   node scripts/vocabulario-desde-actividades.mjs                          # informar (no escribe)
 *   node scripts/vocabulario-desde-actividades.mjs --aplicar                # emulador
 *   node scripts/vocabulario-desde-actividades.mjs --aplicar --produccion   # producción
 *   node scripts/vocabulario-desde-actividades.mjs --aplicar --campo=ciudad # solo ese campo
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
/*
 * **El mismo `slugify` que el panel**, importado y no copiado: con una copia acá,
 * una ciudad sembrada por este script y la misma tipeada en el formulario podrían
 * dar slugs distintos, y el síntoma sería una opción duplicada en el desplegable
 * — exactamente lo que el §4.2 existe para evitar.
 */
import { slugify } from '../functions/slugify.js';
import { etiquetaPresentable } from '../src/lib/etiqueta-presentable.mjs';

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

/** Los tres campos de lugar que viven en una sede y son taxonomía (§4, D-710). */
const TODOS = ['provincia', 'barrio', 'ciudad'];

/*
 * `--campo=ciudad` acota a uno, y **no es comodidad**: lo que este script
 * encuentra «en uso y sin ofrecer» no siempre es algo que convenga ofrecer. En
 * `barrio` lo que aparece es sobre todo basura de cuando era el único campo de
 * lugar —`"Villa Crespo, CABA"`, una provincia entera—, y agregarla al
 * desplegable empeora justo lo que hay que limpiar. Informar los tres y **dejar
 * elegir cuál se escribe** es lo que separa el diagnóstico de la decisión.
 */
const pedido = process.argv.find((a) => a.startsWith('--campo='))?.slice('--campo='.length);
if (pedido && !TODOS.includes(pedido)) {
  console.error(`\`--campo=${pedido}\` no es uno de: ${TODOS.join(', ')}.`);
  process.exit(1);
}
const CAMPOS = TODOS;
/** Sobre cuáles se escribe. Se informa siempre sobre los tres. */
const A_ESCRIBIR = pedido ? [pedido] : TODOS;

const snap = await db.collection('actividades').select('modalidades', 'sede').get();

/** Cada sede de cada actividad: las filas de `modalidades`, más la `sede` suelta de los documentos viejos. */
const sedes = snap.docs.flatMap((d) => {
  const a = d.data();
  return [...(a.modalidades ?? []).map((m) => m?.sede).filter(Boolean), ...(a.sede ? [a.sede] : [])];
});

/*
 * El conteo es **por actividad y no por fila de sede**: una actividad con dos
 * modalidades en Mar del Plata usa Mar del Plata una vez, no dos. Es la misma
 * definición que `elegidosDe` (el `new Set` por documento), y tiene que serlo:
 * si los dos contaran distinto, el `usos` quedaría torcido apenas alguien edite.
 */
const usosPorCampo = Object.fromEntries(CAMPOS.map((c) => [c, new Map()]));
for (const d of snap.docs) {
  const a = d.data();
  const delDoc = [...(a.modalidades ?? []).map((m) => m?.sede).filter(Boolean), ...(a.sede ? [a.sede] : [])];
  for (const campo of CAMPOS) {
    const slugs = new Set(delDoc.map((s) => slugify(s?.[campo] ?? '')).filter(Boolean));
    for (const slug of slugs) {
      const previo = usosPorCampo[campo].get(slug) ?? { usos: 0, crudo: '' };
      /* Se guarda **un** valor tal como se tipeó, para poder proponer la etiqueta. */
      const crudo = previo.crudo || delDoc.map((s) => s?.[campo]).find((v) => v && slugify(v) === slug) || '';
      usosPorCampo[campo].set(slug, { usos: previo.usos + 1, crudo });
    }
  }
}

console.log(`actividades: ${snap.size} · filas con sede: ${sedes.length} · base: ${produccion ? 'PRODUCCIÓN' : process.env.FIRESTORE_EMULATOR_HOST}\n`);

let algoQueEscribir = false;

for (const campo of CAMPOS) {
  const ref = db.doc(`opciones/${campo}`);
  const existentes = (await ref.get()).data()?.valores ?? [];
  const conocidos = new Set(existentes.map((v) => v.slug));
  const encontrados = [...usosPorCampo[campo]].sort((a, b) => b[1].usos - a[1].usos);
  const faltan = encontrados.filter(([slug]) => !conocidos.has(slug));

  console.log(`/opciones/${campo} — ${existentes.length} en el vocabulario, ${encontrados.length} en uso, ${faltan.length} sin ofrecer`);
  for (const [slug, { usos, crudo }] of faltan) {
    console.log(`    + ${slug.padEnd(30)} "${etiquetaPresentable(crudo || slug)}"  (${usos} actividad${usos === 1 ? '' : 'es'})`);
  }

  if (faltan.length === 0) continue;
  if (!A_ESCRIBIR.includes(campo)) {
    console.log(`  (no se escribe: --campo=${pedido})`);
    continue;
  }
  algoQueEscribir = true;
  if (!aplicar) continue;

  /*
   * `orden: 99` es el de las opciones creadas con «Otro» (§4.1): el orden real lo
   * decide `ordenarValores`, que ordena por `usos` cuando el `orden` empata — que
   * es justo lo que se quiere acá, porque el `usos` que se escribe es el de verdad.
   *
   * `aprobada: true`: son ciudades que **ya están publicadas en el sitio**, dentro
   * de actividades que alguien cargó y revisó. Dejarlas pendientes las escondería
   * del desplegable de los demás (§4.3) justo a las que más se usan.
   *
   * Sin `huellaCreador`: nadie las creó tipeando, se derivan del catálogo. Y esa
   * huella no se publica (§5.1), así que inventar una sería agregar un dato de
   * persona a un valor que no lo tiene.
   */
  const nuevos = faltan.map(([slug, { usos, crudo }]) => ({
    slug,
    label: etiquetaPresentable(crudo || slug),
    orden: 99,
    fijo: false,
    usos,
    aprobada: true,
  }));

  await db.runTransaction(async (tx) => {
    /*
     * En transacción y releyendo adentro, por lo mismo que `upsertOpcion` del
     * §4.2: entre la lectura de arriba y esta escritura alguien puede haber
     * guardado una actividad con una etiqueta nueva, y un `set` con la lista de
     * antes se la comería.
     */
    const actual = (await tx.get(ref)).data()?.valores ?? [];
    const yaEstan = new Set(actual.map((v) => v.slug));
    const aAgregar = nuevos.filter((v) => !yaEstan.has(v.slug));
    if (aAgregar.length === 0) return;
    tx.update(ref, { valores: FieldValue.arrayUnion(...aAgregar) });
  });
  console.log(`  → ${nuevos.length} agregada(s) a /opciones/${campo}`);
}

if (!algoQueEscribir) {
  console.log('\n✓ el vocabulario ya ofrece todo lo que las actividades usan.');
} else if (!aplicar) {
  console.log('\nNada escrito. Para aplicar: agregá `--aplicar`.');
} else {
  console.log('\nListo. El rebuild del sitio se dispara solo (§8, `rebuildPorOpciones`).');
}
