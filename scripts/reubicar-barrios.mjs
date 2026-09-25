#!/usr/bin/env node
/**
 * **Los barrios que en realidad eran provincias** — B-976.
 *
 *   node scripts/reubicar-barrios.mjs                          # informar (no escribe)
 *   node scripts/reubicar-barrios.mjs --aplicar                # escribe, en el emulador
 *   node scripts/reubicar-barrios.mjs --aplicar --produccion   # escribe, en producción
 *
 * Hasta B-950 el barrio era **el único campo de lugar** del formulario, así que
 * quien cargaba en Tandil puso la provincia donde había lugar: `/opciones/barrio`
 * quedó con «Provincia de Buenos Aires» entre Belgrano y Colegiales, y 54
 * actividades apuntando ahí. El vocabulario es el registro fiel de un campo que
 * faltaba.
 *
 * La regla —cuándo y adónde se mueve cada dato— vive en
 * `src/lib/reubicacion-de-barrio.mjs`, es pura y tiene tests. Acá solo se
 * recorre, se informa y se escribe.
 *
 * ── Lo que la escritura dispara, dicho antes de correrlo ──────────────────
 *  - **Una versión del §12 por actividad tocada.**
 *  - **Los eventos de Calendar SÍ se reescriben**: `modalidades` y `sede` son
 *    campos que la guarda del §7.1 mira, y la dirección del evento lleva la
 *    ciudad. Es una llamada a la API **por sesión**. Correrlo una vez, fuera de
 *    hora — la misma advertencia que `sembrar-geografia.mjs`.
 *  - **Un rebuild del sitio.** El debounce del §8 lo colapsa en uno.
 *
 * ── Lo que NO hace ────────────────────────────────────────────────────────
 * **No borra nada de `/opciones/barrio`.** Al terminar informa qué valores
 * quedaron sin ninguna actividad detrás, que es el momento en que se pueden
 * borrar sin dejar un slug colgado — y eso se hace desde la pantalla de
 * taxonomías del panel (B-06), a mano y mirándolo.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { reubicacionDe } from '../src/lib/reubicacion-de-barrio.mjs';
import { ciudadesDe } from '../src/lib/ciudades.mjs';
import { esCaba } from '../src/lib/geografia.mjs';
import { slugify } from '../functions/slugify.js';

const aplicar = process.argv.includes('--aplicar');
const confirmaProduccion = process.argv.includes('--produccion');
const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

/* La guarda de las dos direcciones (B-630), la misma que los otros cinco. */
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
console.log(enEmulador ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})\n` : `Objetivo: PRODUCCIÓN (${projectId})\n`);

const actividades = await db.collection('actividades').get();

const aEscribir = [];
const ambiguas = [];
const aRevisar = [];

for (const d of actividades.docs) {
  const modalidades = d.get('modalidades') ?? [];
  let cambio = false;
  const nuevas = modalidades.map((m) => {
    if (!m?.sede) return m;
    const r = reubicacionDe(m.sede);
    if (r.estado === 'ambiguo') {
      ambiguas.push({ id: d.id, titulo: d.get('titulo'), sede: m.sede, motivo: r.motivo });
      return m;
    }
    if (r.estado !== 'reubicar') {
      /*
       * **Un barrio junto a una ciudad que no es CABA es sospechoso por
       * construcción**, aunque la regla no sepa qué hacer: en CABA el segundo
       * nivel ES el barrio, así que afuera no debería haber uno. Es
       * `palermo | avellaneda`. No se toca —puede haber ciudades con barrios— y
       * se informa, que es lo único honesto que se puede hacer con un dato que
       * solo quien lo cargó puede desempatar.
       */
      const b = slugify(m.sede.barrio ?? '');
      const c = slugify(m.sede.ciudad ?? '');
      if (b && c && !esCaba(c)) aRevisar.push({ id: d.id, titulo: d.get('titulo'), barrio: b, ciudad: c });
      return m;
    }
    cambio = true;
    return { ...m, sede: { ...m.sede, ...r.geografia } };
  });
  if (!cambio) continue;
  /*
   * `sede` y `ciudades` son derivados del array y se recalculan en la misma
   * escritura, igual que en `sembrar-geografia.mjs`: si no, el documento queda
   * con la lista migrada y la derivada con el barrio viejo, o sea que la
   * actividad se filtra por una cosa y se muestra con otra.
   */
  const sede = nuevas.find((m) => m.sede)?.sede ?? null;
  aEscribir.push([d.id, d.get('titulo'), { modalidades: nuevas, sede, ciudades: ciudadesDe(nuevas) }]);
}

console.log(`Actividades: ${actividades.size}`);
console.log(`A reubicar:  ${aEscribir.length}`);
for (const [id, titulo, p] of aEscribir) {
  const z = p.modalidades.filter((m) => m.sede).map((m) => `${m.sede.provincia || '—'}/${m.sede.ciudad || '—'}/${m.sede.barrio || '—'}`);
  console.log(`  · ${String(titulo ?? id).slice(0, 52).padEnd(54)} ${z.join(' | ')}`);
}

if (ambiguas.length > 0) {
  console.log(`\n⚠️  ${ambiguas.length} sede(s) AMBIGUA(S) — el documento se contradice, no se tocan:`);
  for (const a of ambiguas) {
    console.log(`  · ${String(a.titulo ?? a.id).slice(0, 52).padEnd(54) } barrio=${a.sede.barrio} ciudad=${a.sede.ciudad}`);
    console.log(`      ${a.motivo}`);
  }
}

if (aRevisar.length > 0) {
  console.log(`\nℹ️  ${aRevisar.length} sede(s) con un barrio junto a una ciudad que no es CABA — se informan, no se tocan:`);
  for (const r of aRevisar) console.log(`  · ${String(r.titulo ?? r.id).slice(0, 52).padEnd(54)} barrio=${r.barrio} ciudad=${r.ciudad}`);
}

/*
 * Qué queda sin usar en `/opciones/barrio` **después** de esta corrida. Es el
 * dato que permite borrar sin dejar un slug colgado, y por eso se calcula sobre
 * el resultado y no sobre el estado de ahora.
 */
const enUsoDespues = new Set();
for (const d of actividades.docs) {
  const migrada = aEscribir.find(([id]) => id === d.id);
  const mods = migrada ? migrada[2].modalidades : (d.get('modalidades') ?? []);
  for (const m of mods) if (m?.sede?.barrio) enUsoDespues.add(slugify(m.sede.barrio));
}
const vocabulario = (await db.doc('opciones/barrio').get()).data()?.valores ?? [];
const huerfanos = vocabulario.filter((v) => !enUsoDespues.has(v.slug));
if (huerfanos.length > 0) {
  console.log(`\n🧹 Después de esto, ${huerfanos.length} valor(es) de /opciones/barrio quedan SIN ninguna actividad detrás:`);
  for (const v of huerfanos) console.log(`  · ${v.slug.padEnd(30)} "${v.label}"  (usos registrados: ${v.usos ?? 0})`);
  console.log('   Se borran desde la pantalla de taxonomías del panel (B-06), a mano.');
}

if (!aplicar) {
  console.log('\nNada escrito. Corré de nuevo con --aplicar para escribirlo de verdad.');
  process.exit(0);
}

for (let i = 0; i < aEscribir.length; i += 400) {
  const batch = db.batch();
  for (const [id, , payload] of aEscribir.slice(i, i + 400)) batch.update(db.doc(`actividades/${id}`), payload);
  await batch.commit();
  console.log(`  escritas ${Math.min(i + 400, aEscribir.length)}/${aEscribir.length}`);
}
console.log('\nListo. Se disparan: una versión del §12 por actividad, los eventos de Calendar y un rebuild.');
