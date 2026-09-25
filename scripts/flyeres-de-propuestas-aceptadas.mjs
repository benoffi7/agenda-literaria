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
 * qué objeto de `propuestas/` se borra y cuál no va a borrar nadie, con el id de
 * la propuesta. Eso contesta la pregunta de **privacidad** —la foto de un
 * tercero que no se quede de más— y no la de **producto** que abrió B-1322: antes del
 * arreglo del CORS (B-1235) la promoción de la foto fallaba en el navegador, la
 * actividad se guardaba **sin flyer**, y `borrarOriginalAlAceptar` devolvía
 * `sin-copia` y conservaba el original. Para arreglar cada una hace falta saber
 * **a qué actividad** se convirtió, **cómo se llama** y **si tiene imágenes** —
 * y ese informe no lee la actividad.
 *
 * Este entra por el otro lado: las propuestas `aceptada` que tenían foto, la
 * actividad que nombra su `revision.actividadId`, y el bucket. La clasificación
 * es pura (`clasificarAceptadas`) y está testeada sin red en
 * `tests/flyeres-de-propuestas-aceptadas.test.ts`. Desde B-1370 vive en
 * `functions/propuestas.js`, porque el barrido diario la usa para decidir el
 * único caso que borra solo.
 *
 * ── Qué NO hace, y el test lo ata ─────────────────────────────────────────
 * **No escribe nada**: ni Firestore ni Storage. No acepta `--aplicar` —así que
 * `tests/guardas-de-los-scripts.test.ts` no lo cuenta entre los que escriben— y
 * el fuente no llama a `set`, `update`, `delete`, `save` ni `upload`. El remedio
 * es manual y va impreso al lado de cada caso: subir la foto desde el panel es
 * una decisión sobre una actividad publicada, no un backfill. La excepción es
 * `con-copia-con-original`, que desde B-1370 lo resuelve solo
 * `borrarPropuestasVencidas` — no este script. Y desde B-871 el remedio tiene
 * **plazo**: el mismo barrido borra todo original de una aceptada a los 30 días
 * de aceptada, así que subir la foto a la actividad hay que hacerlo antes.
 *
 * ── Qué lee, y qué no ─────────────────────────────────────────────────────
 * De la propuesta, **solo** `estado`, `revision.actividadId`,
 * `revision.fotoDescartada` e `imagen.storagePath`: ni el contacto de quien
 * propuso ni `revision.motivo`, que es una nota interna (mismo `select` acotado
 * que `propuestasQueNombran`). De la actividad, con máscara, `titulo`, `estado` e
 * `imagenes` — ni `online.url` ni `difusion` (§5.1). Lo que se imprime es el
 * título de la actividad, su id y el path del original; nada de la persona.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  CASO_QUE_SE_BORRA_SOLO,
  EN_ORDEN,
  clasificarAceptadas,
  copiasVivasDe,
} from '../functions/propuestas.js';
import { PREFIJO_PROPUESTAS } from '../functions/retencion.js';

/**
 * Los casos, con el qué hacer al lado. El orden es el de la impresión: primero
 * lo que B-1322 vino a buscar.
 */
export const CASOS = {
  'sin-foto-con-original': {
    titulo: 'Actividad SIN foto, y el original de la propuesta todavía está',
    accion:
      'Es el caso de B-1322. Bajar el original del bucket, subirlo como flyer desde el ' +
      'panel y guardar. El original lo borra solo el barrido diario (B-1370) una vez que la ' +
      'actividad tiene su copia. Hay que hacerlo antes de los 30 días de aceptada: pasado ese ' +
      'plazo el original se borra solo (B-871). Si la foto no se quiere, no hace falta nada.',
  },
  'copia-rota-con-original': {
    titulo: 'La actividad nombra una foto propia que ya no existe, y el original está',
    accion:
      'La galería apunta a un objeto borrado (se ve rota). Subir el original de nuevo desde ' +
      'el panel y sacar la fila rota, antes de los 30 días de aceptada. El original lo borra ' +
      'solo el barrido diario (B-1370); si no se sube, se borra igual a los 30 días (B-871).',
  },
  'solo-externas-con-original': {
    titulo: 'La actividad tiene solo imágenes de afuera (link), y el original está',
    accion:
      'Mirar si el link es el mismo flyer. Si sí, el original sobra y se borra solo a los 30 ' +
      'días de aceptada (B-871); si no, subirlo desde el panel antes de ese plazo.',
  },
  'sin-actividad-con-original': {
    titulo: 'La propuesta no apunta a ninguna actividad que exista, y el original está',
    accion:
      'Buscar a mano la actividad que salió de esta propuesta y, si la foto se usa, subirla ahí ' +
      'antes de los 30 días de aceptada. Si no, el original se borra solo a los 30 días (B-871).',
  },
  'descartada-con-original': {
    titulo: 'Se eligió «No usarla» y el original no se borró',
    accion:
      'No hay nada que decidir: la foto se descartó a propósito. Borrar el original a mano, o ' +
      'dejar que el barrido lo borre a los 30 días de aceptada (B-871).',
  },
  [CASO_QUE_SE_BORRA_SOLO]: {
    titulo: 'La actividad tiene su copia, y el original quedó de más',
    accion:
      'Nada: el barrido diario (`borrarPropuestasVencidas`, B-1370) lo borra solo en su próxima ' +
      'corrida, después de volver a verificar la copia. Si sigue acá dos días seguidos, mirar el log.',
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

/*
 * **La clasificación no vive acá desde B-1370**: el barrido diario
 * (`borrarPropuestasVencidas`) borra uno de sus casos —`con-copia-con-original`—
 * y la definición de ese caso no puede estar escrita dos veces (D-88). Vive en
 * `functions/propuestas.js`, que este script puede importar y la Function
 * también; al revés no se puede (D-20). Se re-exporta para que el test y quien
 * lea este archivo la encuentren donde siempre.
 */
export { CASO_QUE_SE_BORRA_SOLO, EN_ORDEN, clasificarAceptadas };

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

  const copiasVivas = await copiasVivasDe(bucket, actividades.values());

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
