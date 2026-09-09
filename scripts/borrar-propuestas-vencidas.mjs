#!/usr/bin/env node
/**
 * B-838 / DEC-13 — lista (y opcionalmente borra) las propuestas rechazadas que
 * ya cumplieron los 30 días, **con su imagen**.
 *
 *   node scripts/borrar-propuestas-vencidas.mjs                  # solo informa
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
 *     node scripts/borrar-propuestas-vencidas.mjs --aplicar      # borra, en el emulador
 *   node scripts/borrar-propuestas-vencidas.mjs --aplicar --produccion   # borra, en producción
 *
 * ── Para qué, si ya existe la Function programada ─────────────────────────
 * `borrarPropuestasVencidas` (`functions/retencion-trigger.js`) hace este mismo
 * barrido sola, todos los días. Este script reusa **la misma decisión pura**
 * (`decidirRetencion`, de `functions/retencion.js`) para lo que la Function
 * programada no puede dar: correrlo contra el emulador antes de confiar en la
 * real —lo que el §10 del `CLAUDE.md` pide para todo lo que borra datos— y verlo
 * en seco cuando se quiera, sin esperar el próximo tick ni mirar solo los logs.
 *
 * **Y acá el «verlo antes» vale más que en los otros dos barridos**: lo que se
 * borra es el dato personal de un tercero y la prueba de qué pidió. No hay
 * papelera, y del otro lado hay una persona que quizás vuelva a escribir.
 *
 * ── Las guardas, que son dos y no una ─────────────────────────────────────
 * `--aplicar` fuera del emulador exige `--produccion` explícito (§ «Idempotencia
 * en los scripts» de `05-patrones.md`, y `tests/guardas-de-los-scripts.test.ts`
 * lo hace cumplir). Y como este barrido **también borra objetos**, mira las dos
 * variables: apuntar Firestore al emulador y Storage a producción borraría fotos
 * de verdad mientras el informe dice «EMULADOR», que es la peor combinación
 * posible — un script que parece cuidado.
 *
 * ── Lo que NO hace, a propósito ───────────────────────────────────────────
 * No reimplementa ni relaja el tope: `decidirRetencion` recorta a
 * `MAX_PROPUESTAS_POR_CORRIDA` y marca el resto, así que este script informa
 * **lo mismo que haría la Function**, incluido lo que dejaría para mañana.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  MARGEN_DE_RETENCION_MS,
  MAX_PROPUESTAS_POR_CORRIDA,
  borrarPropuesta,
  decidirRetencion,
  propuestasVencibles,
} from '../functions/retencion.js';

const aplicar = process.argv.includes('--aplicar');
const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const storageEnEmulador = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const confirmaProduccion = process.argv.includes('--produccion');
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
const bucketId = process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'agenda-literaria.firebasestorage.app';

if (aplicar && !enEmulador && !confirmaProduccion) {
  console.error(
    '--aplicar sin FIRESTORE_EMULATOR_HOST apunta a PRODUCCIÓN y borra sin papelera.\n' +
      'Lo que se borra es el contacto de una persona y la prueba de qué propuso.\n' +
      'Si es un accidente: exportá FIRESTORE_EMULATOR_HOST y probá contra el emulador.\n' +
      'Si es a propósito: agregá también --produccion. Abortando.',
  );
  process.exit(1);
}

if (aplicar && enEmulador !== storageEnEmulador) {
  /*
   * **La guarda que ningún otro script necesita: acá se borra en los dos lados,
   * así que los dos tienen que apuntar al mismo lado.**
   *
   * Es de **coherencia y no de dirección**, y esa es la corrección del
   * `auditor-privacidad`: la primera versión solo miraba «Firestore en el
   * emulador y Storage en producción» —la mezcla ruidosa, que borra de más— y
   * dejaba pasar la de al lado, que es peor porque **borra de menos y en
   * silencio**. Con Firestore en producción y Storage en el emulador (el
   * `FIREBASE_STORAGE_EMULATOR_HOST` que quedó de la sesión anterior, y
   * `--produccion` agregado al final para «hacerlo de verdad»), el
   * `delete({ ignoreNotFound: true })` pega contra el emulador, **no encuentra
   * nada y no falla** —ese es el punto de `ignoreNotFound`— así que el orden
   * «objeto primero» no protege: después se borra el documento de producción y
   * la foto del tercero sobrevive en el bucket real, sin referencia, mientras el
   * informe dice `borrada: … (+ propuestas/…)`.
   *
   * Por eso `--produccion` **no** la levanta: ese flag confirma el destino, no
   * autoriza dos destinos distintos.
   */
  console.error(
    'Firestore y Storage apuntan a lugares distintos, y este barrido borra en los dos:\n' +
      `  Firestore: ${enEmulador ? 'EMULADOR' : 'PRODUCCIÓN'}\n` +
      `  Storage:   ${storageEnEmulador ? 'EMULADOR' : 'PRODUCCIÓN'}\n` +
      'Exportá (o sacá) las dos variables juntas. Abortando.',
  );
  process.exit(1);
}

initializeApp(
  enEmulador
    ? { projectId, storageBucket: bucketId }
    : { credential: applicationDefault(), projectId, storageBucket: bucketId },
);

console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `Objetivo: PRODUCCIÓN (${projectId})`,
);
console.log(
  storageEnEmulador
    ? `Imágenes: EMULADOR (${process.env.FIREBASE_STORAGE_EMULATOR_HOST})`
    : `Imágenes: PRODUCCIÓN (${bucketId})`,
);
console.log(aplicar ? 'Modo:     APLICAR (borra)\n' : 'Modo:     informar (no borra)\n');

const db = getFirestore();
const bucket = getStorage().bucket();

const propuestas = await propuestasVencibles(db);
const { aBorrar, motivos } = decidirRetencion({ propuestas, ahora: Date.now() });

const dias = (MARGEN_DE_RETENCION_MS / (24 * 60 * 60 * 1000)).toFixed(0);
const borrar = new Map(aBorrar.map((p) => [p.id, p.objeto]));

console.log(`${propuestas.length} propuesta(s) rechazada(s) en la bandeja`);
console.log(`Retención:        ${dias} días desde el rechazo`);
console.log(`Tope por corrida: ${MAX_PROPUESTAS_POR_CORRIDA} propuestas\n`);

for (const p of propuestas) {
  const marca = borrar.has(p.id) ? '[BORRAR]' : '[      ]';
  const objeto = borrar.get(p.id);
  // Ni el título ni el contacto: el barrido no los lee, y este informe se pega
  // en un chat o en un issue con la misma facilidad que cualquier otra salida.
  console.log(`${marca} ${p.id}  ·  ${motivos[p.id]}${objeto ? `  ·  ${objeto}` : ''}`);
}

const conImagen = aBorrar.filter((p) => p.objeto).length;
console.log(
  `\n${aBorrar.length} propuesta(s) y ${conImagen} imagen(es) ` +
    `${aplicar ? 'a borrar' : 'se borrarían'}`,
);

if (aplicar) {
  let borradas = 0;
  for (const caducada of aBorrar) {
    await borrarPropuesta(db, bucket, caducada);
    borradas += 1;
    console.log(`borrada: ${caducada.id}${caducada.objeto ? ` (+ ${caducada.objeto})` : ''}`);
  }
  console.log(`\n${borradas} propuesta(s) borrada(s).`);
} else if (aBorrar.length > 0) {
  console.log('\nCorré de nuevo con --aplicar para borrarlas de verdad.');
}

process.exit(0);
