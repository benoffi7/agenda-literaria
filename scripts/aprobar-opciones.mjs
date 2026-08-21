#!/usr/bin/env node
/**
 * §4.3 — aprueba opciones de taxonomía creadas con "Otro".
 *
 * Una opción nueva nace pendiente: funciona para quien la creó pero no aparece
 * en el desplegable de las otras cuentas hasta que alguien la valida. Esto es
 * ese "alguien".
 *
 *   node scripts/aprobar-opciones.mjs --listar
 *   node scripts/aprobar-opciones.mjs arancel con-beca-parcial
 *   node scripts/aprobar-opciones.mjs tags narrativa poesia
 *   node scripts/aprobar-opciones.mjs --backfill
 *
 * `--backfill` deja explícito el default de compatibilidad: marca
 * `aprobada: true` en los valores que se escribieron antes de que existiera el
 * campo. No cambia ningún comportamiento (la ausencia ya se lee como aprobada),
 * solo evita que dentro de seis meses alguien vea un documento a medias y crea
 * que hay un bug. Es opcional e idempotente.
 *
 * Objetivo: el emulador si `FIRESTORE_EMULATOR_HOST` está seteado, producción si
 * no (con las Application Default Credentials de gcloud, sin bajar ninguna key).
 * Siempre lo anuncia antes de escribir: ensayarlo contra el emulador y recién
 * después correrlo en producción es lo recomendable.
 */
import { initializeApp, applicationDefault, deleteApp, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const CAMPOS = ['arancel', 'tipo', 'barrio', 'plataforma', 'tags'];

const USO = [
  'Uso:',
  '  node scripts/aprobar-opciones.mjs --listar',
  '  node scripts/aprobar-opciones.mjs <campo> <slug> [slug...]',
  '  node scripts/aprobar-opciones.mjs --backfill',
  '',
  `Campos: ${CAMPOS.join(', ')}`,
].join('\n');

/** Igual que `estaAprobada` en src/lib/opciones.ts: el campo ausente cuenta como aprobada. */
const aprobada = (v) => v.fijo === true || (v.aprobada ?? true);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(USO);
  process.exit(1);
}

const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

initializeApp(enEmulador ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

console.log(
  enEmulador
    ? `Objetivo: EMULADOR (${process.env.FIRESTORE_EMULATOR_HOST})\n`
    : `Objetivo: PRODUCCIÓN (${projectId})\n`,
);

const leer = async (campo) => {
  const snap = await db.doc(`opciones/${campo}`).get();
  return snap.exists ? (snap.data().valores ?? []) : [];
};

// ── Listar pendientes ────────────────────────────────────────────
const listar = async () => {
  let total = 0;
  for (const campo of CAMPOS) {
    const pendientes = (await leer(campo)).filter((v) => !aprobada(v));
    if (pendientes.length === 0) continue;
    total += pendientes.length;
    console.log(`opciones/${campo}`);
    for (const v of pendientes) {
      console.log(
        `  ${v.slug.padEnd(28)} «${v.label}»  usos: ${v.usos ?? 0}  autor: ${v.huellaCreador ?? '—'}`,
      );
    }
    console.log(
      `  → node scripts/aprobar-opciones.mjs ${campo} ${pendientes.map((v) => v.slug).join(' ')}\n`,
    );
  }
  if (total === 0) {
    console.log('No hay opciones pendientes de aprobación.');
    return;
  }
  console.log(`${total} pendiente(s).`);
  console.log(
    'La huella identifica a la cuenta que la creó pero no es reversible a un uid\n' +
      '(§5.1: este documento es de lectura pública). Para saber quién fue, mirá el\n' +
      '`createdBy` de la actividad que usa el slug.',
  );
};

// ── Backfill del default de compatibilidad ───────────────────────
const backfill = async () => {
  for (const campo of CAMPOS) {
    const ref = db.doc(`opciones/${campo}`);
    const tocados = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return 0;
      const valores = snap.data().valores ?? [];
      const faltan = valores.filter((v) => v.aprobada === undefined);
      if (faltan.length === 0) return 0;
      tx.update(ref, {
        valores: valores.map((v) => (v.aprobada === undefined ? { ...v, aprobada: true } : v)),
      });
      return faltan.length;
    });
    console.log(
      tocados > 0
        ? `opciones/${campo} — ${tocados} valor(es) marcados aprobada: true`
        : `opciones/${campo} — nada que hacer`,
    );
  }
  console.log('\nListo. Idempotente: correrlo dos veces no cambia nada.');
};

// ── Aprobar ──────────────────────────────────────────────────────
const aprobar = async (campo, slugs) => {
  if (!CAMPOS.includes(campo)) {
    throw new Error(`"${campo}" no es un campo de taxonomía. Campos: ${CAMPOS.join(', ')}`);
  }
  if (slugs.length === 0) {
    throw new Error('Faltan los slugs a aprobar. Corré --listar para verlos.');
  }

  const ref = db.doc(`opciones/${campo}`);

  // En transacción, como toda escritura sobre este array (§4.2): entre la
  // lectura y la escritura alguien puede estar guardando una actividad con una
  // etiqueta nueva, y un set con el array que teníamos en memoria la perdería.
  //
  // La validación de los slugs va ANTES de la transacción, no adentro: tirar
  // desde el callback aborta la transacción y deja el documento lockeado en el
  // emulador hasta que expire, lo que hace fallar los tests que corren después.
  const valores = await leer(campo);
  const noEstan = slugs.filter((s) => !valores.some((v) => v.slug === s));
  if (noEstan.length > 0) {
    throw new Error(
      `No existe(n) en opciones/${campo}: ${noEstan.join(', ')}. Corré --listar para ver los slugs.`,
    );
  }

  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const actuales = snap.exists ? (snap.data().valores ?? []) : [];
    const yaEstaban = slugs.filter((s) => {
      const v = actuales.find((x) => x.slug === s);
      return v ? aprobada(v) : false;
    });

    tx.update(ref, {
      valores: actuales.map((v) => (slugs.includes(v.slug) ? { ...v, aprobada: true } : v)),
    });

    return { yaEstaban, aprobados: slugs.filter((s) => !yaEstaban.includes(s)) };
  });

  for (const s of resultado.aprobados) console.log(`aprobada -> ${campo}/${s}`);
  for (const s of resultado.yaEstaban) console.log(`ya estaba aprobada -> ${campo}/${s}`);

  console.log(
    '\nListo. El panel lee las opciones en vivo, así que aparece en el desplegable\n' +
      'de las demás cuentas sin recargar. El sitio público se actualiza en el próximo\n' +
      'rebuild, que `rebuildPorOpciones` ya dejó marcado.',
  );
};

try {
  if (args[0] === '--listar') await listar();
  else if (args[0] === '--backfill') await backfill();
  else await aprobar(args[0], args.slice(1));
} catch (e) {
  // Un slug mal tipeado es un error de uso, no un bug: se muestra el mensaje y
  // se sale con código distinto de cero, sin volcar un stack trace de Firestore.
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  // Cierra el cliente en vez de matar el proceso con `process.exit`: un exit
  // abrupto puede cortar un RPC en vuelo (un commit, un rollback) y dejar el
  // documento lockeado del otro lado.
  await deleteApp(getApp());
}
