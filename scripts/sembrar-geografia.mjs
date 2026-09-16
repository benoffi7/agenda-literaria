#!/usr/bin/env node
/**
 * **Backfill de la geografía de las sedes** — B-950.
 *
 *   node scripts/sembrar-geografia.mjs                          # informar (no escribe)
 *   node scripts/sembrar-geografia.mjs --aplicar                # escribe, en el emulador
 *   node scripts/sembrar-geografia.mjs --aplicar --produccion   # escribe, en producción
 *
 * ── Qué hace, y por qué es OPCIONAL ───────────────────────────────────────
 * B-950 agregó `provincia` a `Sede` y convirtió `ciudad` en taxonomía. Los
 * documentos anteriores no tienen la provincia y guardan la ciudad **como se
 * tipeó** («Mar del Plata»), no como slug.
 *
 * Eso **no rompe nada hoy**, y ésa es la diferencia con `sembrar-ciudades.mjs`:
 * `geografiaNormalizada` es idempotente y se aplica en los cuatro lugares que
 * leen o escriben el documento sin pasar por el formulario —`toPublic.ts`,
 * `filtrosActividades.ts`, `formADocumento` y `payloadDeRestauracion`—, así que
 * un documento sin migrar se ve y se filtra bien igual. El evento de Calendar es
 * la excepción y está anotada (B-968): `functions/` no puede importar hacia
 * arriba, así que usa el valor crudo. Lo que este script hace es
 * dejar el **documento** en la forma nueva, y con eso:
 *
 *  - el historial del §12 deja de guardar versiones con dos formas mezcladas;
 *  - `searchText` y `ciudades[]` se reescriben derivados de la forma nueva;
 *  - y quien mire el documento en la consola de Firebase ve lo mismo que el sitio.
 *
 * ── Lo que NO hace, y es la parte importante ──────────────────────────────
 * **No inventa la provincia de una ciudad que no sea CABA.** `provinciaDeSede`
 * la deduce de la ciudad solo cuando es CABA —que es casi todo el catálogo,
 * porque `sedeVacia()` traía `'CABA'` cableado como default—. Para «Mar del
 * Plata» la provincia es deducible por una persona y no por el código: una tabla
 * ciudad→provincia sería inventar el dato, y el primer error se publicaría en el
 * `addressLocality` del JSON-LD.
 *
 * Esas sedes quedan **sin provincia**, se cuentan aparte al final, y se completan
 * al reeditar la actividad desde el panel. Es exactamente lo que B-950 pide: «la
 * provincia de lo que ya está cargado se completa con un backfill propio o al
 * reeditar», y «no reescribir los documentos ya guardados por las bravas».
 *
 * ── Idempotente ───────────────────────────────────────────────────────────
 * Recalcula la geografía de cada sede y escribe **solo las actividades que
 * difieren**. Correrlo dos veces seguidas: la segunda no escribe nada.
 *
 * ── Lo que la escritura dispara, dicho antes de correrlo ──────────────────
 *  - **Una versión del §12 por actividad tocada**, igual que `sembrar-ciudades`.
 *  - **Los eventos de Calendar SÍ se reescriben**, y acá está la diferencia con
 *    aquél: `sesiones` no cambia, pero `modalidades` y `sede` son campos que la
 *    guarda del §7.1 mira, y la dirección del evento lleva la ciudad. O sea que
 *    esta corrida actualiza la descripción de cada evento de cada sesión — que es
 *    lo correcto (antes decía la ciudad tipeada, ahora la etiqueta) pero es una
 *    llamada a la API de Calendar por sesión. **Correrlo una vez, fuera de hora.**
 *  - **Un rebuild del sitio.** El debounce del §8 lo colapsa en uno solo.
 *
 * Escribe con el Admin SDK, que pasa por encima de las reglas.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// **La misma derivación que el panel y que la proyección pública**, importada y
// no copiada: con una copia acá, un documento sembrado y uno guardado desde el
// panel podrían discrepar en el slug de la ciudad — y el síntoma sería una
// actividad que el filtro del sitio no encuentra. Es la clase de B-88.
import { geografiaNormalizada } from '../src/lib/geografia.mjs';
import { ciudadesDe } from '../src/lib/ciudades.mjs';

const aplicar = process.argv.includes('--aplicar');
const confirmaProduccion = process.argv.includes('--produccion');

const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

/*
 * La guarda de las dos direcciones (§"Idempotencia en los scripts", B-630), la
 * misma que `sembrar-slugs.mjs` y `sembrar-ciudades.mjs`.
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

/**
 * Las modalidades con la geografía de cada sede normalizada. Devuelve `null` si
 * no hay nada que cambiar, para que el llamador no escriba de más.
 *
 * Solo se tocan los tres campos de la geografía: el resto de la sede —nombre,
 * dirección, indicaciones, `geo`— se copia tal cual. Un backfill que reescriba
 * un campo que no le toca es un backfill que puede perder datos.
 */
const modalidadesMigradas = (modalidades = []) => {
  let cambio = false;
  const nuevas = modalidades.map((m) => {
    if (!m?.sede) return m;
    const geo = geografiaNormalizada(m.sede);
    const igual =
      (m.sede.provincia ?? '') === geo.provincia &&
      (m.sede.barrio ?? '') === geo.barrio &&
      (m.sede.ciudad ?? '') === geo.ciudad;
    if (igual) return m;
    cambio = true;
    return { ...m, sede: { ...m.sede, ...geo } };
  });
  return cambio ? nuevas : null;
};

const actividades = await db.collection('actividades').get();

const aEscribir = [];
const yaAlDia = [];
for (const d of actividades.docs) {
  const modalidades = modalidadesMigradas(d.get('modalidades') ?? []);
  if (!modalidades) {
    yaAlDia.push(d.id);
    continue;
  }
  /*
   * `sede` y `ciudades` son **derivados** del array y se recalculan en la misma
   * escritura. Si no, el documento quedaría con la lista migrada y la sede
   * derivada con la ciudad vieja — o sea, la actividad se filtraría por una cosa
   * y se mostraría con otra. La derivada es «la primera fila que tenga sede»
   * (D-130) y `ciudades` sale de `ciudadesDe`, la misma función que el panel.
   */
  const sede = modalidades.find((m) => m.sede)?.sede ?? null;
  aEscribir.push([d.id, { modalidades, sede, ciudades: ciudadesDe(modalidades) }]);
}

console.log(`Actividades: ${actividades.size}`);
console.log(`Ya al día: ${yaAlDia.length}`);
console.log(`A escribir: ${aEscribir.length}`);
for (const [id, payload] of aEscribir) {
  const zonas = payload.modalidades
    .filter((m) => m.sede)
    .map((m) => `${m.sede.provincia || '—'}/${m.sede.ciudad || '—'}/${m.sede.barrio || '—'}`);
  console.log(`  · ${id}: ${zonas.join(' | ')}`);
}

/*
 * Las que quedan **sin provincia** son las que hay que mirar a mano: son las
 * sedes de afuera de CABA, donde la provincia no se puede deducir de la ciudad.
 * Se cuentan aparte porque son las que alguien va a venir a preguntar, y porque
 * hasta que se completen no aparecen bajo ningún filtro de lugar del sitio.
 */
const sinProvincia = aEscribir.filter(([, p]) =>
  p.modalidades.some((m) => m.sede && !m.sede.provincia),
);
if (sinProvincia.length > 0) {
  console.log(
    `\n⚠️  ${sinProvincia.length} quedan con alguna sede SIN provincia.\n` +
      '   No se adivina: para una ciudad que no es CABA, la provincia la sabe una\n' +
      '   persona y no este script. Se completan reeditando la actividad en el panel.\n' +
      '   Hasta entonces no aparecen bajo ningún filtro de lugar del sitio.\n' +
      sinProvincia.map(([id]) => `     · ${id}`).join('\n'),
  );
}

if (!aplicar) {
  console.log('\nCorré de nuevo con --aplicar para escribirlo de verdad.');
  process.exit(0);
}

// Un `batch` admite 500 operaciones; se parte de a 400 para dejar margen, igual
// que `sembrar-slugs.mjs` y `sembrar-ciudades.mjs`.
for (let i = 0; i < aEscribir.length; i += 400) {
  const batch = db.batch();
  for (const [id, payload] of aEscribir.slice(i, i + 400)) {
    // `update` y no `set`: preserva el resto del documento y falla si la
    // actividad desapareció entre el `get` y esto, que es la dirección correcta.
    batch.update(db.doc(`actividades/${id}`), payload);
  }
  await batch.commit();
}

console.log(`\nListo. Escritas ${aEscribir.length}.`);
process.exit(0);
