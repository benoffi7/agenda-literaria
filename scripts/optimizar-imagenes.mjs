#!/usr/bin/env node
/**
 * B-220 — pasa por el pipeline de DEC-7d las imágenes que ya estaban en el
 * bucket antes de que existiera la Function.
 *
 *   node scripts/optimizar-imagenes.mjs                 # solo informa
 *   node scripts/optimizar-imagenes.mjs --aplicar
 *
 * ── Por qué hace falta un script y no alcanza la Function ─────────────────
 * `onObjectFinalized` corre cuando un objeto **se escribe**. Las 30 imágenes que
 * hay en producción se escribieron antes, así que ninguna tiene su miniatura ni
 * pasó por la recompresión — y son justamente las que producen los dos
 * disparadores medidos: la página de 3226,7 KB de B-300 y el recorrido de 3518,5
 * KB de la cartelera (B-266).
 *
 * ── Y por qué no reimplementa el pipeline ────────────────────────────────
 * **Lo único que hace es volver a escribir los mismos bytes.** Eso dispara
 * `optimizarImagen`, que es la que optimiza. Tres consecuencias buscadas:
 *
 *  - **una sola fuente de verdad del pipeline.** Un script con su propia copia
 *    de `sharp` produciría objetos distintos de los que produce la Function el
 *    día que una de las dos cambie, que es la clase de B-88 con el peor sabor:
 *    la mitad del bucket optimizada de una manera y la otra mitad de otra;
 *  - **verifica el deploy de verdad.** Si al terminar los objetos no tienen la
 *    marca, la Function no está desplegada o no tiene permisos — y eso es
 *    exactamente lo que uno quiere saber después de desplegarla;
 *  - **es idempotente.** Los que ya tienen `customMetadata.optimizada` se
 *    saltean, así que se puede correr de nuevo sin pensar.
 *
 * ── El default es no escribir ────────────────────────────────────────────
 * Sin `--aplicar` solo lista qué haría. Esto reescribe **todos** los objetos del
 * prefijo, y aunque los bytes sean idénticos, una reescritura es una escritura:
 * conviene mirar la lista antes.
 *
 * Objetivo: el emulador si `FIREBASE_STORAGE_EMULATOR_HOST` está seteado,
 * producción si no (con las Application Default Credentials de gcloud, sin bajar
 * ninguna key). Siempre lo anuncia antes de escribir.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { MARCA_OPTIMIZADA, PREFIJO_ORIGINALES, rutaDeMiniatura } from '../functions/imagenes.js';

const aplicar = process.argv.includes('--aplicar');
const enEmulador = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
const bucketName =
  process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'agenda-literaria.firebasestorage.app';

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
console.log(aplicar ? 'Modo:     APLICAR (reescribe)\n' : 'Modo:     informar (no escribe)\n');

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;

const bucket = getStorage().bucket();
const [objetos] = await bucket.getFiles({ prefix: PREFIJO_ORIGINALES });

/** Solo el nivel de arriba del prefijo, igual que `decidirOptimizacion`. */
const originales = objetos.filter(
  (o) => !o.name.slice(PREFIJO_ORIGINALES.length).includes('/') && o.name !== PREFIJO_ORIGINALES,
);

let yaEstaban = 0;
let tocados = 0;
let bytesAntes = 0;

for (const objeto of originales) {
  const meta = objeto.metadata ?? {};
  const custom = meta.metadata ?? {};
  const tamanio = Number(meta.size ?? 0);
  bytesAntes += tamanio;

  if (custom[MARCA_OPTIMIZADA] !== undefined) {
    yaEstaban += 1;
    continue;
  }

  console.log(`${objeto.name}  ${kb(tamanio)}  ->  ${rutaDeMiniatura(objeto.name) ?? '(sin id)'}`);
  tocados += 1;

  if (!aplicar) continue;

  // Los mismos bytes, de vuelta al mismo lugar: la que optimiza es la Function.
  // `metadata` se conserva tal cual —incluido el token de descarga— para que la
  // URL guardada en el documento siga sirviendo mientras el trigger corre.
  const [bytes] = await objeto.download();
  await objeto.save(bytes, {
    resumable: false,
    metadata: {
      contentType: meta.contentType,
      cacheControl: meta.cacheControl,
      metadata: custom,
    },
  });
}

console.log(
  `\n${originales.length} objetos en ${PREFIJO_ORIGINALES} · ${kb(bytesAntes)} en total`,
);
console.log(`  ${yaEstaban} ya optimizados (se saltean)`);
console.log(`  ${tocados} ${aplicar ? 'reescritos' : 'a reescribir'}`);

if (aplicar && tocados > 0) {
  console.log(
    '\nEl trigger corre en segundo plano. Volvé a correr esto sin `--aplicar` en un\n' +
      'minuto: si algún objeto sigue sin la marca, la Function no está desplegada,\n' +
      'no tiene permisos sobre el bucket, o falló — mirá sus logs.',
  );
}

process.exit(0);
