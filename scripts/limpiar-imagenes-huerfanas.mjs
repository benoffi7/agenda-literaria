#!/usr/bin/env node
/**
 * B-221 — lista (y opcionalmente borra) las imágenes propias que quedaron
 * huérfanas en Storage: la fila salió de la galería, o la actividad se
 * borró, y nadie más referencia ese objeto.
 *
 *   node scripts/limpiar-imagenes-huerfanas.mjs                 # solo informa
 *   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
 *     node scripts/limpiar-imagenes-huerfanas.mjs --aplicar     # borra, en el emulador
 *   node scripts/limpiar-imagenes-huerfanas.mjs --aplicar --produccion   # borra, en producción
 *
 * ── Para qué sirve este script, si ya existe la Function programada ───────
 * `limpiarImagenesHuerfanas` (`functions/imagenes-limpieza-trigger.js`) hace
 * este mismo barrido sola, cada 24 horas. Este script reusa la misma decisión
 * pura (`decidirLimpieza`, de `functions/limpieza-imagenes.js`) para dos
 * cosas que la Function programada no puede dar:
 *
 *  - **correrlo contra el emulador antes de confiar en la Function real**,
 *    igual que pide `docs/CLAUDE.md` §10 para todo lo que borra datos de
 *    verdad;
 *  - **verlo en seco cuando se quiera**, sin esperar al próximo tick del
 *    reloj ni mirar únicamente los logs de Cloud Functions.
 *
 * ── El default es no borrar ─────────────────────────────────────────────
 * Sin `--aplicar` solo lista qué borraría. Un borrado no tiene papelera de la
 * que sacarlo (B-221), así que conviene mirar la lista antes.
 *
 * Objetivo: el emulador si `FIREBASE_STORAGE_EMULATOR_HOST` (y, para leer las
 * actividades, `FIRESTORE_EMULATOR_HOST`) están seteados; producción si no,
 * con las Application Default Credentials de gcloud. Siempre lo anuncia antes
 * de escribir.
 *
 * **Guarda contra el olvido, no solo contra la mala intención** (la encontró
 * el `auditor-trampas`, comparando contra `seed-emulador.mjs` y
 * `preparar-produccion.mjs`, que sí la tienen). Un borrado no tiene papelera
 * (B-221): `--aplicar` sin `FIREBASE_STORAGE_EMULATOR_HOST` seteado —el olvido
 * más fácil de cometer, justo cuando se lo quiere probar "antes de confiar en
 * la Function real"— apuntaría a producción y borraría en silencio. Por eso
 * `--aplicar` fuera del emulador exige además `--produccion`, explícito: sin
 * los dos juntos, aborta antes de tocar nada.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { decidirLimpieza, MARGEN_DE_GRACIA_MS } from '../functions/limpieza-imagenes.js';
import { referenciasEnUso, objetosDelBucket } from '../functions/imagenes-limpieza-trigger.js';

const aplicar = process.argv.includes('--aplicar');
const enEmulador = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const confirmaProduccion = process.argv.includes('--produccion');
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
const bucketName =
  process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'agenda-literaria.firebasestorage.app';

if (aplicar && !enEmulador && !confirmaProduccion) {
  console.error(
    '--aplicar sin FIREBASE_STORAGE_EMULATOR_HOST apunta a PRODUCCIÓN y borra sin papelera.\n' +
      'Si es un accidente: exportá FIREBASE_STORAGE_EMULATOR_HOST y probá contra el emulador.\n' +
      'Si es a propósito: agregá también --produccion. Abortando.',
  );
  process.exit(1);
}

initializeApp(
  enEmulador
    ? { projectId, storageBucket: bucketName }
    : { credential: applicationDefault(), projectId, storageBucket: bucketName },
);

console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIREBASE_STORAGE_EMULATOR_HOST})`
    : `Objetivo: PRODUCCIÓN (${projectId})`,
);
console.log(`Bucket:   ${bucketName}`);
console.log(
  aplicar ? 'Modo:     APLICAR (borra)\n' : 'Modo:     informar (no borra)\n',
);

const db = getFirestore();
const bucket = getStorage().bucket();

const referenciados = await referenciasEnUso(db);
const objetos = await objetosDelBucket(bucket);

const { aBorrar, motivos } = decidirLimpieza({
  objetos: objetos.map(({ nombre, creado }) => ({ nombre, creado })),
  referenciados,
  ahora: Date.now(),
});

const porNombre = new Map(objetos.map((o) => [o.nombre, o.archivo]));
const dias = (MARGEN_DE_GRACIA_MS / (24 * 60 * 60 * 1000)).toFixed(0);

console.log(`${objetos.length} objetos revisados en imagenes/ y miniaturas/`);
console.log(`${referenciados.size} storagePath en uso, leídos de /actividades`);
console.log(`Margen de gracia: ${dias} días\n`);

for (const [nombre, motivo] of Object.entries(motivos)) {
  if (motivo === 'referenciado') continue;
  console.log(`${aBorrar.includes(nombre) ? '[BORRAR]' : '[      ]'} ${nombre}  ·  ${motivo}`);
}

console.log(`\n${aBorrar.length} objeto(s) ${aplicar ? 'a borrar' : 'se borrarían'}`);

if (aplicar) {
  let borrados = 0;
  for (const nombre of aBorrar) {
    await porNombre.get(nombre)?.delete();
    borrados += 1;
  }
  console.log(`${borrados} objeto(s) borrados.`);
} else if (aBorrar.length > 0) {
  console.log('\nCorré de nuevo con --aplicar para borrarlos de verdad.');
}

process.exit(0);
