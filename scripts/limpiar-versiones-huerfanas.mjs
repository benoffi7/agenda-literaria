#!/usr/bin/env node
/**
 * B-630 — lista (y opcionalmente borra) las subcolecciones `versiones` que
 * quedaron huérfanas: la actividad se borró y su historial siguió ahí.
 *
 *   node scripts/limpiar-versiones-huerfanas.mjs                 # solo informa
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *     node scripts/limpiar-versiones-huerfanas.mjs --aplicar     # borra, en el emulador
 *   node scripts/limpiar-versiones-huerfanas.mjs --aplicar --produccion   # borra, en producción
 *
 * ── Es el espejo del de imágenes, y la asimetría no era de diseño ─────────
 * `limpiarImagenesHuerfanas` (B-221) tiene su script en seco desde el primer día;
 * `limpiarVersionesHuerfanas` (B-89) no lo tenía porque el frente que escribió la
 * Function no podía tocar `scripts/`. Hasta ahora la única forma de verificar una
 * corrida era por logs.
 *
 * ── Para qué sirve, si ya existe la Function programada ───────────────────
 * `limpiarVersionesHuerfanas` (`functions/versiones-limpieza-trigger.js`) hace
 * este mismo barrido sola, todos los días. Este script reusa **la misma decisión
 * pura** (`decidirPurga`, de `functions/limpieza-versiones.js`) para dos cosas que
 * la Function programada no puede dar:
 *
 *  - **correrlo contra el emulador antes de confiar en la Function real**, que es
 *    lo que pide el §10 del `CLAUDE.md` para todo lo que borra datos de verdad;
 *  - **verlo en seco cuando se quiera**, sin esperar al próximo tick del reloj ni
 *    mirar únicamente los logs de Cloud Functions.
 *
 * **Y acá vale más que en el de imágenes**, que es el argumento del ítem: lo que
 * este barrido borra es **la única copia** de una actividad que ya no existe. Una
 * imagen huérfana perdida es una imagen; una subcolección de versiones purgada
 * antes de tiempo es el historial completo de algo que alguien podría querer de
 * vuelta (§12).
 *
 * ── El default es no borrar ───────────────────────────────────────────────
 * Sin `--aplicar` solo lista qué borraría, con el motivo de cada caso. No hay
 * papelera de la que sacarlo.
 *
 * **Guarda contra el olvido, no solo contra la mala intención** — la misma que
 * tienen `limpiar-imagenes-huerfanas.mjs`, `seed-emulador.mjs` y
 * `preparar-produccion.mjs`. `--aplicar` sin `FIRESTORE_EMULATOR_HOST` seteado
 * —el olvido más fácil de cometer, justo cuando se lo quiere probar «antes de
 * confiar en la Function real»— apuntaría a producción y borraría en silencio. Por
 * eso `--aplicar` fuera del emulador exige además `--produccion`, explícito.
 *
 * ── Lo que este script NO hace, y es a propósito ──────────────────────────
 * No reimplementa ni relaja el tope de la decisión: `decidirPurga` recorta a
 * `MAX_ACTIVIDADES_POR_CORRIDA` y marca el resto como `diferida-por-tope`, así que
 * el script informa **lo mismo que haría la Function**, incluido lo que dejaría
 * para la corrida siguiente. Un script que barriera «todo de una» estaría
 * mostrando un plan que la Function nunca ejecuta.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';

import {
  MARGEN_DE_RESCATE_MS,
  MAX_ACTIVIDADES_POR_CORRIDA,
  decidirPurga,
  subcoleccionesHuerfanas,
} from '../functions/limpieza-versiones.js';

const SUB = 'versiones';
/** El mismo tope de batch que el trigger. Firestore no acepta más de 500. */
const MAX_BORRADOS_POR_BATCH = 400;

const aplicar = process.argv.includes('--aplicar');
const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const confirmaProduccion = process.argv.includes('--produccion');
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

if (aplicar && !enEmulador && !confirmaProduccion) {
  console.error(
    '--aplicar sin FIRESTORE_EMULATOR_HOST apunta a PRODUCCIÓN y borra sin papelera.\n' +
      'Lo que se borra es la única copia de una actividad que ya no existe (§12).\n' +
      'Si es un accidente: exportá FIRESTORE_EMULATOR_HOST y probá contra el emulador.\n' +
      'Si es a propósito: agregá también --produccion. Abortando.',
  );
  process.exit(1);
}

initializeApp(
  enEmulador ? { projectId } : { credential: applicationDefault(), projectId },
);

console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `Objetivo: PRODUCCIÓN (${projectId})`,
);
console.log(aplicar ? 'Modo:     APLICAR (borra)\n' : 'Modo:     informar (no borra)\n');

const db = getFirestore();
const referencias = await subcoleccionesHuerfanas(db);

/*
 * Se leen solo los ids y el `guardadoEn`, igual que el trigger: traer el
 * `documento` entero de cada versión sería bajar copias completas de actividades
 * borradas para decidir si se borran.
 */
const huerfanas = [];
for (const ref of referencias) {
  const snap = await ref
    .collection(SUB)
    .orderBy(FieldPath.documentId())
    .select('guardadoEn')
    .get();
  huerfanas.push({
    actividadId: ref.id,
    versiones: snap.docs.map((d) => ({ id: d.id, guardadoEn: d.get('guardadoEn') })),
  });
}

const { aPurgar, motivos } = decidirPurga({ huerfanas, ahora: Date.now() });

const dias = (MARGEN_DE_RESCATE_MS / (24 * 60 * 60 * 1000)).toFixed(0);
const purgar = new Set(aPurgar.map((p) => p.actividadId));

console.log(`${referencias.length} subcolección(es) huérfana(s) encontrada(s)`);
console.log(`Margen de rescate: ${dias} días`);
console.log(`Tope por corrida:  ${MAX_ACTIVIDADES_POR_CORRIDA} actividades\n`);

for (const { actividadId, versiones } of huerfanas) {
  const marca = purgar.has(actividadId) ? '[PURGAR]' : '[      ]';
  console.log(
    `${marca} ${actividadId}  ·  ${versiones.length} versión(es)  ·  ${motivos[actividadId]}`,
  );
}

const documentos = aPurgar.reduce((n, p) => n + p.versiones.length, 0);
console.log(
  `\n${aPurgar.length} subcolección(es) y ${documentos} documento(s) ` +
    `${aplicar ? 'a purgar' : 'se purgarían'}`,
);

if (aplicar) {
  let purgadas = 0;
  for (const { actividadId, versiones } of aPurgar) {
    const coleccion = db.collection(`actividades/${actividadId}/${SUB}`);
    const batch = db.batch();
    for (const version of versiones.slice(0, MAX_BORRADOS_POR_BATCH)) {
      batch.delete(coleccion.doc(version));
    }
    await batch.commit();
    purgadas += 1;
    console.log(`purgada: ${actividadId} (${versiones.length} versiones)`);
  }
  console.log(`\n${purgadas} subcolección(es) purgada(s).`);
} else if (aPurgar.length > 0) {
  console.log('\nCorré de nuevo con --aplicar para purgarlas de verdad.');
}

process.exit(0);
