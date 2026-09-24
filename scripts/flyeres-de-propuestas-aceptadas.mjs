#!/usr/bin/env node
/**
 * **B-1322 — qué propuestas aceptadas dejaron a su actividad sin el flyer, y si
 * el original todavía está para rescatarlo.** Solo lectura.
 *
 *   node scripts/flyeres-de-propuestas-aceptadas.mjs
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
 *     node scripts/flyeres-de-propuestas-aceptadas.mjs
 *
 * ── Por qué no alcanzaba con `borrar-propuestas-vencidas.mjs` ─────────────
 * Su segunda lista (`relevarFlyeresSinPlazo`, B-871) entra por el bucket y dice
 * «este objeto de `propuestas/` no lo va a borrar nadie», con el id de la
 * propuesta. Eso contesta la pregunta de **privacidad** —la foto de un tercero
 * que se queda para siempre— y no la de **producto** que abrió B-1322: antes del
 * arreglo del CORS (B-1235) la promoción de la foto fallaba en el navegador, la
 * actividad se guardaba **sin flyer**, y `borrarOriginalAlAceptar` devolvía
 * `sin-copia` y conservaba el original. Para arreglar cada una hace falta saber
 * **a qué actividad** se convirtió, **cómo se llama** y **si tiene imágenes** —
 * y ese informe no lee la actividad.
 *
 * Este entra por el otro lado: las propuestas `aceptada` que tenían foto, la
 * actividad que nombra su `revision.actividadId`, y el bucket. La clasificación
 * es pura (`clasificarAceptadas`) y está testeada sin red en
 * `tests/flyeres-de-propuestas-aceptadas.test.ts`.
 *
 * ── Qué NO hace, y el test lo ata ─────────────────────────────────────────
 * **No escribe nada**: ni Firestore ni Storage. No acepta `--aplicar` —así que
 * `tests/guardas-de-los-scripts.test.ts` no lo cuenta entre los que escriben— y
 * el fuente no llama a `set`, `update`, `delete`, `save` ni `upload`. El remedio
 * es manual y va impreso al lado de cada caso: subir la foto desde el panel es
 * una decisión sobre una actividad publicada, no un backfill.
 *
 * ── Qué lee, y qué no ─────────────────────────────────────────────────────
 * De la propuesta, **solo** `estado`, `revision.actividadId`,
 * `revision.fotoDescartada` e `imagen.storagePath`: ni el contacto de quien
 * propuso ni `revision.motivo`, que es una nota interna (mismo `select` acotado
 * que `propuestasConFlyer`). De la actividad, con máscara, `titulo`, `estado` e
 * `imagenes` — ni `online.url` ni `difusion` (§5.1). Lo que se imprime es el
 * título de la actividad, su id y el path del original; nada de la persona.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { copiasEnLaGaleria } from '../functions/propuestas.js';
import { PREFIJO_PROPUESTAS, objetoDePropuesta } from '../functions/retencion.js';

/**
 * Los casos, con el qué hacer al lado. El orden es el de la impresión: primero
 * lo que B-1322 vino a buscar.
 */
export const CASOS = {
  'sin-foto-con-original': {
    titulo: 'Actividad SIN foto, y el original de la propuesta todavía está',
    accion:
      'Es el caso de B-1322. Bajar el original del bucket, subirlo como flyer desde el ' +
      'panel y guardar; después borrar el original a mano. Si la foto no se quiere, borrarlo.',
  },
  'copia-rota-con-original': {
    titulo: 'La actividad nombra una foto propia que ya no existe, y el original está',
    accion:
      'La galería apunta a un objeto borrado (se ve rota). Subir el original de nuevo desde ' +
      'el panel, sacar la fila rota, y después borrar el original a mano.',
  },
  'solo-externas-con-original': {
    titulo: 'La actividad tiene solo imágenes de afuera (link), y el original está',
    accion:
      'Mirar si el link es el mismo flyer. Si sí, el original sobra y se borra a mano; si no, ' +
      'subirlo desde el panel.',
  },
  'sin-actividad-con-original': {
    titulo: 'La propuesta no apunta a ninguna actividad que exista, y el original está',
    accion:
      'Buscar a mano la actividad que salió de esta propuesta. Si no hay ninguna, borrar el original.',
  },
  'descartada-con-original': {
    titulo: 'Se eligió «No usarla» y el original no se borró',
    accion: 'No hay nada que decidir: la foto se descartó a propósito. Borrar el original a mano.',
  },
  'con-copia-con-original': {
    titulo: 'La actividad tiene su copia, y el original quedó de más',
    accion:
      'La actividad está bien. El original es un duplicado de la foto de un tercero: borrarlo a mano.',
  },
  'sin-foto-sin-original': {
    titulo: 'Actividad SIN foto, y el original ya no está',
    accion:
      'La foto se perdió de este lado. Si hace falta, pedírsela de nuevo a quien propuso.',
  },
  'sin-actividad-sin-original': {
    titulo: 'La propuesta no apunta a ninguna actividad que exista, y el original ya no está',
    accion: 'Nada que rescatar. Sirve solo para saber que pasó.',
  },
};

/** Lo que no pide a nadie: la actividad tiene su foto, o se descartó y se borró. */
export const EN_ORDEN = 'en-orden';

/**
 * **La clasificación, pura.** Una fila por propuesta `aceptada` que tuvo foto.
 *
 * @param {{
 *   propuestas: { id: string, estado?: string, revision?: { actividadId?: unknown, fotoDescartada?: unknown }, imagen?: unknown }[],
 *   originalesVivos: Set<string>,
 *   actividades: Map<string, { titulo?: string, estado?: string, imagenes?: unknown[] }>,
 *   copiasVivas: Set<string>,
 * }} _
 * @returns {{ propuesta: string, original: string, actividadId: string | null, titulo: string | null, estadoActividad: string | null, imagenes: number, caso: string }[]}
 */
export const clasificarAceptadas = ({ propuestas, originalesVivos, actividades, copiasVivas }) => {
  const filas = [];
  for (const p of propuestas) {
    if (p?.estado !== 'aceptada') continue;
    // La misma guarda que el trigger y la retención: un `storagePath` fuera de
    // `propuestas/<un segmento>` no es «el original» de nadie (B-88).
    const original = objetoDePropuesta(p.imagen);
    if (!original) continue;

    const vivo = originalesVivos.has(original);
    const id = p.revision?.actividadId;
    const actividadId = typeof id === 'string' && id.length > 0 ? id : null;
    const actividad = actividadId ? actividades.get(actividadId) : undefined;
    const imagenes = Array.isArray(actividad?.imagenes) ? actividad.imagenes : [];

    const fila = {
      propuesta: p.id,
      original,
      actividadId,
      titulo: actividad ? (actividad.titulo ?? null) : null,
      estadoActividad: actividad ? (actividad.estado ?? null) : null,
      imagenes: imagenes.length,
    };

    let caso;
    // `=== true`, igual que `decidirBorradoDeImagen`: un truthy raro no cuenta
    // como que una persona miró la foto y la descartó.
    if (p.revision?.fotoDescartada === true) {
      caso = vivo ? 'descartada-con-original' : EN_ORDEN;
    } else if (!actividad) {
      caso = vivo ? 'sin-actividad-con-original' : 'sin-actividad-sin-original';
    } else if (imagenes.length === 0) {
      caso = vivo ? 'sin-foto-con-original' : 'sin-foto-sin-original';
    } else {
      const copias = copiasEnLaGaleria(imagenes);
      const algunaViva = copias.some((c) => copiasVivas.has(c));
      if (algunaViva) caso = vivo ? 'con-copia-con-original' : EN_ORDEN;
      else if (copias.length > 0) caso = vivo ? 'copia-rota-con-original' : 'sin-foto-sin-original';
      /*
       * Solo externas y sin original: la actividad **tiene** una imagen, y no
       * hay nada nuestro que rescatar. No se sabe si es el mismo flyer, pero
       * tampoco hay con qué compararlo.
       */
      else caso = vivo ? 'solo-externas-con-original' : EN_ORDEN;
    }
    filas.push({ ...fila, caso });
  }
  return filas;
};

/** Las filas agrupadas por caso, en el orden de `CASOS`, sin los vacíos. */
export const agruparPorCaso = (filas) =>
  Object.keys(CASOS)
    .map((caso) => ({ caso, filas: filas.filter((f) => f.caso === caso) }))
    .filter((g) => g.filas.length > 0);

const main = async () => {
  const enEmulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const storageEnEmulador = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
  const bucketId =
    process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'agenda-literaria.firebasestorage.app';

  if (enEmulador !== storageEnEmulador) {
    // Cruzar documentos de un lado con objetos del otro daría todo como
    // «el original ya no está»: un informe que inventa pérdidas.
    console.error(
      'Firestore y Storage apuntan a lugares distintos y el cruce diría cualquier cosa:\n' +
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
      : `Objetivo: PRODUCCIÓN (${projectId} · ${bucketId})`,
  );
  console.log('Modo:     solo lectura\n');

  const db = getFirestore();
  const bucket = getStorage().bucket();

  const snap = await db
    .collection('propuestas')
    .where('estado', '==', 'aceptada')
    .select('estado', 'revision.actividadId', 'revision.fotoDescartada', 'imagen.storagePath')
    .get();
  const propuestas = snap.docs.map((d) => ({
    id: d.id,
    estado: d.get('estado'),
    revision: {
      actividadId: d.get('revision.actividadId'),
      fotoDescartada: d.get('revision.fotoDescartada'),
    },
    imagen: d.get('imagen'),
  }));

  const [objetos] = await bucket.getFiles({ prefix: PREFIJO_PROPUESTAS });
  const originalesVivos = new Set(objetos.map((o) => o.name));

  const ids = [
    ...new Set(
      propuestas
        .map((p) => p.revision.actividadId)
        .filter((id) => typeof id === 'string' && id.length > 0),
    ),
  ];
  /*
   * Los `Map`/`Set` se arman por constructor y no con `.set()`/`.add()`: el test
   * que ata que este script no escribe busca esos verbos en el fuente, y así
   * no hay excepción que explicarle.
   */
  const docs =
    ids.length > 0
      ? await db.getAll(...ids.map((id) => db.collection('actividades').doc(id)), {
          fieldMask: ['titulo', 'estado', 'imagenes'],
        })
      : [];
  const actividades = new Map(docs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

  const vivas = [];
  for (const a of actividades.values()) {
    for (const copia of copiasEnLaGaleria(a.imagenes)) {
      const [existe] = await bucket.file(copia).exists();
      if (existe) vivas.push(copia);
    }
  }
  const copiasVivas = new Set(vivas);

  const filas = clasificarAceptadas({ propuestas, originalesVivos, actividades, copiasVivas });
  const enOrden = filas.filter((f) => f.caso === EN_ORDEN).length;

  console.log(
    `${snap.size} propuesta(s) aceptada(s) · ${filas.length} con foto · ` +
      `${objetos.length} objeto(s) bajo ${PREFIJO_PROPUESTAS}`,
  );
  console.log(`${enOrden} en orden (la actividad tiene su foto, o se descartó y se borró)\n`);

  for (const { caso, filas: delCaso } of agruparPorCaso(filas)) {
    console.log(`── ${CASOS[caso].titulo} (${delCaso.length})`);
    console.log(`   Qué hacer: ${CASOS[caso].accion}`);
    for (const f of delCaso) {
      const actividad = f.actividadId
        ? `${f.titulo ?? '(sin título)'} · ${f.estadoActividad ?? 'sin estado'} · ${f.actividadId} · ${f.imagenes} imagen(es)`
        : '(sin actividad)';
      console.log(`   - ${actividad}`);
      console.log(`     propuesta ${f.propuesta} · original ${f.original}`);
    }
    console.log('');
  }
  if (filas.length === enOrden) console.log('Ninguna actividad quedó sin su foto.');
};

// Importable desde el test sin disparar `main` (mismo patrón que
// `verificar-calendario.mjs`).
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Falló el relevamiento:', e);
      process.exit(1);
    });
}
