#!/usr/bin/env node
/**
 * **Los contactos cargados en el campo equivocado** — B-2166.
 *
 *   node scripts/corregir-contactos-mal-cargados.mjs                          # informar (no escribe)
 *   node scripts/corregir-contactos-mal-cargados.mjs --aplicar                # escribe, en el emulador
 *   node scripts/corregir-contactos-mal-cargados.mjs --aplicar --produccion   # escribe, en producción
 *
 * La primera corrida de `links-rotos.mjs` (2026-09-28) dio 14 links rotos y se
 * leyeron como webs de organizador mal cargadas (B-2165). **Eran casi todos otra
 * cosa**: una inscripción con vía «formulario» cuyo destino es un `@usuario` de
 * Instagram. `urlSegura("@amiacultura")` daba `https://amiacultura/`, y el botón
 * «Inscribirme» llevaba ahí. Quien cargó quiso decir «escribí por Instagram», que
 * es la vía `dm`.
 *
 * ── Qué corrige ───────────────────────────────────────────────────────────
 *  - **Inscripción `formulario` con un handle de destino** → vía `dm`, mismo
 *    destino. Es handle si empieza con `@` o tiene `_`, y `handleInstagram` lo
 *    acepta. Una palabra suelta sin arroba («buscando») no: puede ser un texto
 *    de relleno, y pasarla a `dm` publicaría un perfil de Instagram de un
 *    tercero. Esa, y cualquier destino de formulario que no sea una dirección, se
 *    informa para corregirla a mano.
 *  - **`organizador.web` que no es una dirección**, en tres formas: un handle
 *    (pasa a `organizador.instagram` si está vacío), un texto que trae una URL
 *    adentro (queda la URL) y el resto (un mail, «Enlace en la descripción») se
 *    vacía. El mail no se pierde: es el que ya figura en la inscripción.
 *
 * ── Lo que la escritura dispara ───────────────────────────────────────────
 * Una versión del §12 por actividad y un rebuild (el debounce lo colapsa en
 * uno). **Calendar no**: ni `inscripcion` ni `organizador` están en los campos
 * que mira la guarda del §7.1.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleInstagram } from './handle-instagram.mjs';

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

initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();
console.log(enEmulador ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})\n` : `Objetivo: PRODUCCIÓN (${projectId})\n`);

const conEsquema = (s) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s);

/** ¿Es un `@usuario` y no una dirección? */
export const pareceHandle = (crudo) => {
  const t = (crudo ?? '').trim();
  if (!t || conEsquema(t) || !handleInstagram(t)) return false;
  return t.startsWith('@') || t.includes('_');
};

/** ¿Es una dirección? — la forma de `urlSegura`, sin la excepción del emulador. */
const pareceDireccion = (crudo) => {
  const t = (crudo ?? '').trim();
  if (!t || t.startsWith('@')) return false;
  try {
    const url = new URL(conEsquema(t) ? t : `https://${t}`);
    const host = url.hostname;
    return /^https?:$/.test(url.protocol) && host.includes('.') && !host.includes('_') && !url.username && !url.password;
  } catch {
    return false;
  }
};

const actividades = await db.collection('actividades').get();
const aEscribir = [];
const aMano = [];

for (const d of actividades.docs) {
  const a = d.data();
  const cambios = {};
  const notas = [];

  const i = a.inscripcion ?? {};
  if (i.via === 'formulario' && pareceHandle(i.destino)) {
    cambios['inscripcion.via'] = 'dm';
    notas.push(`inscripción formulario → dm (${i.destino.trim()})`);
  } else if (i.via === 'formulario' && (i.destino ?? '').trim() && !pareceDireccion(i.destino)) {
    aMano.push(`[${a.estado}] ${a.slug} — destino «${i.destino.trim()}»`);
  }

  const web = (a.organizador?.web ?? '').trim();
  if (web && !pareceDireccion(web)) {
    const adentro = web.match(/https?:\/\/[^\s]+/)?.[0];
    if (pareceHandle(web)) {
      cambios['organizador.web'] = '';
      if (!(a.organizador?.instagram ?? '').trim()) cambios['organizador.instagram'] = web;
      notas.push(`web «${web}» es un handle → instagram`);
    } else if (adentro) {
      cambios['organizador.web'] = adentro;
      notas.push(`web con texto → queda ${adentro}`);
    } else {
      cambios['organizador.web'] = '';
      notas.push(`web «${web.slice(0, 40)}» no es una dirección → se vacía`);
    }
  }

  if (notas.length) aEscribir.push({ id: d.id, estado: a.estado, slug: a.slug, cambios, notas });
}

console.log(`Actividades: ${actividades.size} · a corregir: ${aEscribir.length}\n`);
for (const f of aEscribir) console.log(`  · [${f.estado}] ${f.slug}\n      ${f.notas.join('\n      ')}`);
if (aMano.length) console.log(`\n⚠️  ${aMano.length} inscripción(es) por formulario sin dirección, para corregir a mano:\n  · ${aMano.join('\n  · ')}`);

if (!aplicar) {
  console.log('\nNada escrito. Corré de nuevo con --aplicar para escribirlo de verdad.');
  process.exit(0);
}

// B-2184 — un `batch` admite 500 operaciones; se parte de a 400 para dejar
// margen, igual que `sembrar-ciudades.mjs`. Si un lote falla, los anteriores ya
// quedaron escritos, y correrlo de nuevo solo toca lo que falta: recalcula desde
// lo que hay en la base.
for (let i = 0; i < aEscribir.length; i += 400) {
  const batch = db.batch();
  for (const f of aEscribir.slice(i, i + 400)) batch.update(db.doc(`actividades/${f.id}`), f.cambios);
  await batch.commit();
}
console.log(`\nListo: ${aEscribir.length} escritas. Se disparan una versión del §12 por actividad y un rebuild.`);
