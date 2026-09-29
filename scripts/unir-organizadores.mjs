#!/usr/bin/env node
/**
 * **Los organizadores que son la misma casa con dos nombres** — B-2178, roadmap 1.5.
 *
 *   node scripts/unir-organizadores.mjs                          # informar (no escribe)
 *   node scripts/unir-organizadores.mjs --aplicar                # escribe, en el emulador
 *   node scripts/unir-organizadores.mjs --aplicar --produccion   # escribe, en producción
 *   node scripts/unir-organizadores.mjs --tabla=otra.json        # otra tabla (default: scripts/datos/organizadores-a-unir.local.json, ignorada por git)
 *
 * El slug de un organizador junta las variantes de tipeo («Casa Brandon» y
 * «casa brandon »), pero no los nombres distintos de la misma casa: «Hormiga» y
 * «Hormiga Libros» son dos slugs, y con las páginas `/organiza/{slug}` serían
 * dos páginas públicas. Renombrar o borrar la opción no alcanza —el slug de una
 * actividad sale de su propio `organizador` (D-26)—: juntar dos es reescribir el
 * `organizador` de esas actividades.
 *
 * ── Qué corrige ───────────────────────────────────────────────────────────
 * Lee una tabla **decidida por el dueño**, `{ unir: { "<slug origen>": "<slug
 * destino>" } }`, y a cada actividad cuyo `slugDeOrganizador` es un origen le
 * escribe `organizador.nombre` = la etiqueta del destino y `organizador.slug` = el
 * destino. La etiqueta es la de `/opciones/organizador` si el destino está ahí; si
 * no, la variante más escrita entre sus actividades. **Instagram y web no se
 * tocan.** Reescribe también el `searchText`, que lleva el nombre (§6).
 *
 * La tabla se valida entera antes de leer una actividad (cadenas, un origen igual
 * a su destino, slugs mal escritos) y `--aplicar` exige `confirmada: true` en ella:
 * se entregó como propuesta. Es idempotente: la segunda corrida no escribe nada,
 * porque el slug guardado ya es el destino.
 *
 * Informa, por grupo, cuántas actividades cambian, y los orígenes que no aparecen
 * en ninguna actividad (un slug mal copiado, o una variante que alguien ya
 * corrigió a mano). Las decisiones viven en `unir-organizadores-decision.mjs`.
 *
 * ── Lo que la escritura dispara ───────────────────────────────────────────
 * Una versión del §12 por actividad (`organizador` es contenido) y un rebuild (el
 * debounce del §8 lo colapsa en uno).
 *
 * **Y Calendar sí**, a diferencia de `corregir-contactos-mal-cargados.mjs`: la
 * guarda del §7.1 no es una lista de campos sino el payload del evento
 * (`mismoEvento` en `functions/calendario.js`), y la descripción del evento lleva
 * «Organiza: {nombre}». Cada actividad **publicada** cuyo nombre cambia recibe un
 * `actualizar` por sesión con evento —ni altas ni bajas: recordatorios y
 * suscripciones se conservan—. Las que solo cambian el slug (el nombre ya era la
 * etiqueta) no mandan nada. Es lo correcto, pero es una llamada a la API por
 * sesión: correrlo una vez, fuera de hora.
 *
 * El `searchText` va escrito para que `syncCalendar` no lo encuentre desalineado
 * (B-2050): sin él, cada actividad «corregida» mandaría un `derivados-no-coinciden`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { planDeUnion, problemasDeLaTabla, tablaConfirmada } from './unir-organizadores-decision.mjs';

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
if (confirmaProduccion && enEmulador) {
  console.error('`--produccion` con FIRESTORE_EMULATOR_HOST seteado. Elegí uno. Abortando.');
  process.exit(1);
}

/* La tabla, validada antes de conectarse: un error acá no tiene por qué tocar la base. */
const rutaTabla =
  process.argv.find((a) => a.startsWith('--tabla='))?.slice('--tabla='.length) ??
  new URL('./datos/organizadores-a-unir.local.json', import.meta.url);
if (!existsSync(rutaTabla)) {
  console.error(
    `No está la tabla (${rutaTabla}). Copiá scripts/datos/organizadores-a-unir.ejemplo.json\n` +
      'como organizadores-a-unir.local.json y completala: git la ignora, porque lleva\n' +
      'nombres de borradores y el repo es público (B-2178).',
  );
  process.exit(1);
}
const tabla = JSON.parse(readFileSync(rutaTabla, 'utf8'));
const problemas = problemasDeLaTabla(tabla);
if (problemas.length) {
  console.error(`La tabla tiene ${problemas.length} problema(s); no se toca nada:\n  · ${problemas.join('\n  · ')}`);
  process.exit(1);
}
if (aplicar && !tablaConfirmada(tabla)) {
  console.error(
    'La tabla es una propuesta: `confirmada` no es `true`.\n' +
      'Revisala con la corrida en seco, corregila y confirmala antes de aplicar. Abortando.',
  );
  process.exit(1);
}

initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();
console.log(enEmulador ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})\n` : `Objetivo: PRODUCCIÓN (${projectId})\n`);

const snap = await db.collection('actividades').get();
const opciones = (await db.doc('opciones/organizador').get()).data()?.valores ?? [];
const plan = planDeUnion(
  tabla,
  snap.docs.map((d) => ({ id: d.id, data: d.data() })),
  opciones,
);

console.log(
  `Actividades: ${snap.size} · /opciones/organizador: ${opciones.length} · ` +
    `tabla ${tablaConfirmada(tabla) ? 'confirmada' : 'SIN CONFIRMAR (propuesta)'}\n`,
);
for (const [destino, g] of plan.grupos) {
  const total = [...g.porOrigen.values()].reduce((a, b) => a + b, 0);
  console.log(`→ ${destino}  «${g.etiqueta ?? '¿sin etiqueta?'}»  — ${total} actividad(es) cambian`);
  for (const [origen, n] of g.porOrigen) console.log(`    ${origen.padEnd(45)} ${n}`);
  for (const s of plan.parecidos.get(destino) ?? []) console.log(`    ? ${s}  (parecido, no está en la tabla)`);
}
for (const [destino, nota] of Object.entries(tabla.porCompletar ?? {})) {
  if (plan.grupos.has(destino)) continue;
  console.log(`… ${destino}  (por completar: ${nota})`);
  for (const s of plan.parecidos.get(destino) ?? []) console.log(`    ? ${s}`);
}
const noSeUnen = Object.keys(tabla.noSeUnen ?? {});
if (noSeUnen.length) console.log(`\nNo se unen (decidido en la tabla): ${noSeUnen.join(', ')}`);
if (plan.origenesSinUso.length) {
  console.log(`\n⚠️  ${plan.origenesSinUso.length} origen(es) que no aparecen en ninguna actividad:\n  · ${plan.origenesSinUso.join('\n  · ')}`);
}
if (plan.destinosSinUso.length) {
  console.log(`\n⚠️  Destino(s) que ninguna actividad usa hoy: ${plan.destinosSinUso.join(', ')}`);
}
if (plan.destinosSinEtiqueta.length) {
  console.log(
    `\n⚠️  Destino(s) sin etiqueta —ni en /opciones/organizador ni en una actividad—, sus grupos no se escriben:\n  · ${plan.destinosSinEtiqueta.join('\n  · ')}`,
  );
}
if (plan.origenesEnLaLista.length) {
  console.log(
    `\nℹ️  Orígenes que siguen como opción en /opciones/organizador (borralos desde el panel después de unir): ${plan.origenesEnLaLista.join(', ')}`,
  );
}

const publicadas = plan.aEscribir.filter((f) => f.estado === 'publicado').length;
console.log(`\nA escribir: ${plan.aEscribir.length} actividad(es), ${publicadas} publicada(s) (esas actualizan sus eventos de Calendar si el nombre cambia).`);
for (const f of plan.aEscribir) {
  console.log(`  · [${f.estado}] ${f.slug}  ${f.origen} → ${f.destino}  «${f.cambios['organizador.nombre']}»`);
}

if (!aplicar) {
  console.log('\nNada escrito. Corré de nuevo con --aplicar para escribirlo de verdad.');
  process.exit(0);
}
if (plan.destinosSinEtiqueta.length) {
  console.error('\nHay destinos sin etiqueta: corregí la tabla antes de aplicar. Abortando.');
  process.exit(1);
}

/*
 * `update` de campos puntuales, nunca `set`, y con la hora de lectura como
 * precondición: el `searchText` sale del documento leído, así que si alguien lo
 * editó en el medio, pisarlo se comería su cambio. Ese lote falla y se vuelve a
 * correr (es idempotente). De a 400 por el límite de 500 escrituras por lote.
 */
const porId = new Map(snap.docs.map((d) => [d.id, d]));
for (let i = 0; i < plan.aEscribir.length; i += 400) {
  const batch = db.batch();
  for (const f of plan.aEscribir.slice(i, i + 400)) {
    const d = porId.get(f.id);
    batch.update(d.ref, f.cambios, { lastUpdateTime: d.updateTime });
  }
  await batch.commit();
}
console.log(
  `\nListo: ${plan.aEscribir.length} escritas. Se disparan una versión del §12 por actividad, un rebuild y, ` +
    `en las publicadas, un update de Calendar por sesión.`,
);
