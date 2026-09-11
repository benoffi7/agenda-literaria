#!/usr/bin/env node
/**
 * Siembra y repara el índice `/slugs/{slug}` — B-888 tajada 2, **D-660**.
 *
 *   node scripts/sembrar-slugs.mjs                          # informar (no escribe)
 *   node scripts/sembrar-slugs.mjs --aplicar                # siembra, en el emulador
 *   node scripts/sembrar-slugs.mjs --aplicar --produccion   # siembra, en producción
 *   node scripts/sembrar-slugs.mjs --aplicar --reparar      # además borra las que sobran
 *
 * ── Por qué hace falta, y por qué es bloqueante ───────────────────────────
 * El índice es lo que le permite a un publicador verificar que un slug no esté
 * tomado sin barrer la colección (que la regla de B-888 le rechaza entera —
 * trampa 7). Las actividades **que ya existen** no tienen reserva, así que hasta
 * que esto corra sus slugs se leerían como libres, y eso es el daño de la
 * trampa 10: dos actividades peleando la misma URL.
 *
 * Por eso el script deja el centinela `/slugs/_indice`, y `slugLibre()`
 * (`src/lib/slugs.ts`) **se niega a contestar** si no está. O sea: el panel corta
 * el guardado con un mensaje en vez de creer que todo está libre. Es la dirección
 * en la que conviene fallar, y es lo que vuelve a este script un paso del
 * despliegue y no una prolijidad.
 *
 * El `_` del centinela lo hace inalcanzable como slug: `slugify` solo produce
 * `[a-z0-9-]`, que es el alfabeto que exige `reservaValida()` en las reglas.
 *
 * ── Idempotente, y en los dos sentidos ────────────────────────────────────
 * Escribe la reserva que falta **y la que apunta a otra actividad** (§"Idempotencia
 * en los scripts"); con `--reparar` borra además las huérfanas: las de un slug que
 * ninguna actividad usa, que es lo que queda cuando se borró una actividad y su
 * reserva no se pudo soltar —pasa si un admin le renombró el slug a la actividad
 * de un publicador y la reserva quedó a nombre del admin—.
 *
 * **Una sola pasada alcanza, y eso costó una corrida de verdad:** la primera
 * versión mandaba la reserva desfasada a la lista de borrar y no a la de escribir,
 * así que `--reparar` la borraba y nadie la reponía — la actividad quedaba **sin
 * reserva**, que es el estado que este script existe para arreglar.
 *
 * Escribe con el Admin SDK, que pasa por encima de las reglas: es el único
 * escritor que puede crear el centinela.
 *
 * Objetivo: el emulador si `FIRESTORE_EMULATOR_HOST` está seteado, producción si
 * no (con las Application Default Credentials de gcloud, sin bajar ninguna key).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
// La decisión —qué escribir, qué borrar— vive aparte y pura, con sus tests: este
// módulo corre al importarse, así que un test que lo importara hablaría con
// Firestore. Ver el docblock de `slugs-a-reconciliar.mjs`.
import { aReconciliar } from './slugs-a-reconciliar.mjs';

const ID_CENTINELA = '_indice';
/** El mismo alfabeto que `slugify` y que el `matches` de `firestore.rules`. */
const FORMA_DE_SLUG = /^[a-z0-9-]+$/;

const aplicar = process.argv.includes('--aplicar');
const reparar = process.argv.includes('--reparar');
const confirmaProduccion = process.argv.includes('--produccion');

const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

/*
 * La guarda de las dos direcciones (§"Idempotencia en los scripts", B-630). Acá
 * el daño de equivocarse no es simétrico pero sí real: sembrar producción por
 * accidente deja reservas que nadie pidió, y `--reparar` **borra**.
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
const reservas = await db.collection('slugs').get();

/** slug → id de la actividad que lo usa hoy. */
const enElCatalogo = new Map();
const sinSlug = [];
for (const d of actividades.docs) {
  const slug = d.get('slug');
  if (typeof slug !== 'string' || !FORMA_DE_SLUG.test(slug)) {
    sinSlug.push({ id: d.id, slug });
    continue;
  }
  // Dos actividades con el mismo slug **ya existente** es el caso que este
  // índice viene a impedir hacia adelante; hacia atrás solo se puede informar.
  if (enElCatalogo.has(slug)) {
    console.warn(
      `⚠️  «${slug}» lo usan dos actividades (${enElCatalogo.get(slug)} y ${d.id}). ` +
        'El índice se queda con la primera: resolvelo a mano antes de publicarlas.',
    );
    continue;
  }
  enElCatalogo.set(slug, d.id);
}

const yaReservados = new Map();
for (const d of reservas.docs) {
  if (d.id === ID_CENTINELA) continue;
  yaReservados.set(d.id, d.get('actividadId') ?? null);
}

// La decisión vive arriba, pura y con sus tests (`tests/sembrar-slugs.test.ts`).
const { desalineados, huerfanas } = aReconciliar(enElCatalogo, yaReservados);
const hayCentinela = reservas.docs.some((d) => d.id === ID_CENTINELA);

console.log(`Actividades: ${actividades.size}`);
console.log(`Reservas existentes: ${yaReservados.size}`);
console.log(`Reservas a escribir (faltan o apuntan a otra): ${desalineados.length}`);
console.log(`Reservas huérfanas (ninguna actividad usa ese nombre): ${huerfanas.length}`);
console.log(`Centinela ${ID_CENTINELA}: ${hayCentinela ? 'presente' : 'FALTA'}`);
if (sinSlug.length > 0) {
  console.warn(`\n⚠️  ${sinSlug.length} actividad(es) sin un slug con forma válida:`);
  for (const a of sinSlug) console.warn(`   ${a.id}: ${JSON.stringify(a.slug)}`);
}
for (const [slug, id] of desalineados) {
  const previo = yaReservados.get(slug);
  console.log(`  + ${slug} → ${id}${previo ? ` (apuntaba a ${previo})` : ''}`);
}
for (const [slug, id] of huerfanas) console.log(`  - ${slug} (apunta a ${id ?? 'nada'})`);

if (!aplicar) {
  console.log('\nCorré de nuevo con --aplicar para escribirlo de verdad.');
  console.log('Agregá --reparar si además querés borrar las que sobran.');
  process.exit(0);
}

// Un `batch` admite 500 operaciones; se parte de a 400 para dejar margen.
const enTandas = async (ops) => {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) op(batch);
    await batch.commit();
  }
};

await enTandas(
  desalineados.map(
    ([slug, id]) => (batch) =>
      batch.set(db.doc(`slugs/${slug}`), {
        actividadId: id,
        // El uid del sembrado no es el de ninguna persona: lo escribió el script
        // con el Admin SDK, que no pasa por reglas. Se deja dicho en vez de
        // inventar un uid, porque `porUid` es lo que decide quién puede soltar la
        // reserva desde el panel — y para éstas la respuesta correcta es «solo un
        // admin», que es exactamente lo que un valor que no es de nadie produce.
        porUid: 'sembrado-por-script',
        creadoEn: FieldValue.serverTimestamp(),
      }),
  ),
);

if (reparar) {
  await enTandas(huerfanas.map(([slug]) => (batch) => batch.delete(db.doc(`slugs/${slug}`))));
}

/*
 * El centinela va **último**, y ese orden es la mitad de su valor: es lo que
 * destraba el guardado en el panel, así que no puede existir antes de que el
 * índice esté completo. Si el script muere en el medio, el panel sigue diciendo
 * «no se pudo verificar» en vez de contestar con un índice a medias.
 */
await db.doc(`slugs/${ID_CENTINELA}`).set({
  sembradoEn: FieldValue.serverTimestamp(),
  actividades: actividades.size,
});

console.log(
  `\nListo. Escritas ${desalineados.length}${reparar ? `, borradas ${huerfanas.length}` : ''}.` +
    (!reparar && huerfanas.length > 0 ? ' Las huérfanas quedaron: usá --reparar.' : ''),
);
process.exit(0);
