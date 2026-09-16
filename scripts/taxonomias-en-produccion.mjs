#!/usr/bin/env node
/**
 * **¿Está en la base toda taxonomía que el código declara?** — B-973.
 *
 *   node scripts/taxonomias-en-produccion.mjs              # falla si falta alguna
 *   node scripts/taxonomias-en-produccion.mjs --informar   # solo informa, no falla
 *
 * ── Por qué existe, y no es una prolijidad ────────────────────────────────
 * Agregar un campo a `CAMPOS_TAXONOMIA` y a `opciones-base.json` **no lo siembra
 * en producción, y ningún paso del despliegue lo hacía**. El vocabulario nuevo
 * llegaba al código y no a la base: un desplegable vacío, y si el campo es
 * obligatorio, **un formulario que no se puede guardar**.
 *
 * Pasó de verdad con B-950: `/opciones/provincia` y `/opciones/ciudad` no
 * existían, la provincia es obligatoria en el schema, y el panel quedó
 * inguardable con el deploy entero en verde.
 *
 * **Y nada lo vio por una razón que este script es la única forma de cerrar:**
 * el emulador **sí** se siembra —`seed-emulador.mjs` lee el mismo
 * `opciones-base.json`— y todo el gate corre contra el emulador. Los seis pasos,
 * el build real, la suite entera: todos miran un entorno donde la taxonomía
 * existe. La asimetría entre los dos entornos es el punto ciego, y solo se ve
 * mirando producción.
 *
 * ── Qué hace, exactamente ─────────────────────────────────────────────────
 * Lee `CAMPOS_TAXONOMIA` del fuente —que es la lista **autoritativa**, no
 * `opciones-base.json`, que es el semillero— y pregunta por cada
 * `/opciones/{campo}`. Si falta alguno, **falla** y dice cómo sembrarlo.
 *
 * Es de **solo lectura**: no siembra. Sembrar desde CI sería escribir en
 * producción en un job que corre solo, y lo que falta no siempre es sembrar (un
 * campo puede estar mal escrito). Lo que este script garantiza es que nadie se
 * entere por el panel.
 *
 * Objetivo: producción, con las Application Default Credentials. **No corre
 * contra el emulador**: ahí la respuesta es siempre que sí, y un chequeo que no
 * puede fallar es peor que ninguno.
 */
import { readFile } from 'node:fs/promises';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const informar = process.argv.includes('--informar');

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'FIRESTORE_EMULATOR_HOST está seteado, y este chequeo es sobre PRODUCCIÓN.\n' +
      'Contra el emulador la respuesta es siempre que sí (`seed-emulador.mjs` lo siembra),\n' +
      'así que correrlo ahí daría verde sin afirmar nada. Abortando.',
  );
  process.exit(1);
}

const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

/*
 * **La misma credencial que usa el build**, en el mismo orden de preferencia que
 * `src/lib/firebase-admin.ts`: `FIREBASE_SERVICE_ACCOUNT` como JSON crudo si
 * está, y si no las Application Default Credentials.
 *
 * No es comodidad. Este chequeo afirma algo sobre **la base que el build va a
 * leer**, y si autenticara distinto podría estar mirando otro proyecto: daría
 * verde sobre una base que no es la que se publica, que es peor que no chequear
 * nada. En CI alcanza con el secret que el build ya recibe; en local, con
 * `gcloud auth application-default login`.
 */
const credencial = () => {
  const crudo = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!crudo) return applicationDefault();
  /*
   * **El `JSON.parse` va envuelto, y no es defensa genérica** (trampa 4, §5.4).
   * V8 mete un prefijo del input en el mensaje de la `SyntaxError` cuando el
   * valor no tiene forma de JSON —`Unexpected token 'e', "ewogICJ0eX"... is not
   * valid JSON`—, y este script corre en un job cuyo log **es público**: el repo
   * lo es. El enmascarado de Actions tapa coincidencias exactas del secreto, no
   * prefijos suyos, así que un `FIREBASE_SERVICE_ACCOUNT` guardado en base64 —una
   * forma de guardado común— echaría sus primeros caracteres al log sin que nadie
   * lo note. Lo encontró el `auditor-privacidad`.
   *
   * El mensaje de reemplazo dice qué pasó y **no incluye el valor**, que es todo
   * lo que hace falta para arreglarlo.
   */
  try {
    return cert(JSON.parse(crudo));
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT no es un JSON válido. Su contenido no se imprime a propósito: ' +
        'este log es público. Revisá el secret en la configuración del repo.',
    );
  }
};

/**
 * Los campos declarados, leídos del **fuente** y no de `opciones-base.json`.
 *
 * `CAMPOS_TAXONOMIA` es la lista autoritativa (§4.1): de ella cuelgan el
 * desplegable, la pantalla que las administra y el contador de pendientes.
 * `opciones-base.json` es el **semillero**, y que las dos coincidan lo ata
 * `tests/opciones.test.ts` — si acá se leyera el JSON, un campo declarado y sin
 * semilla pasaría este chequeo sin existir en ningún lado.
 */
const camposDeclarados = async () => {
  const fuente = await readFile(new URL('../src/types/actividad.ts', import.meta.url), 'utf8');
  const bloque = /export const CAMPOS_TAXONOMIA = \[([\s\S]*?)\] as const;/.exec(fuente);
  if (!bloque) throw new Error('no se encontró `CAMPOS_TAXONOMIA` en src/types/actividad.ts');
  /*
   * Los literales de la lista, **salteando los comentarios**: el bloque tiene
   * párrafos largos entre las entradas y adentro nombran otros slugs entre
   * comillas. Sin esto, «a-la-gorra» o «villa-crespo» entrarían como campos.
   */
  const sinComentarios = bloque[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return [...sinComentarios.matchAll(/'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]);
};

const campos = await camposDeclarados();
if (campos.length === 0) throw new Error('`CAMPOS_TAXONOMIA` se leyó vacío: el regex no sirve');

initializeApp({ credential: credencial(), projectId });
const db = getFirestore();

const snaps = await db.getAll(...campos.map((c) => db.doc(`opciones/${c}`)));
const faltan = campos.filter((_, i) => !snaps[i].exists);
const vacias = campos.filter(
  (_, i) => snaps[i].exists && (snaps[i].data()?.valores ?? []).length === 0,
);

console.log(`Taxonomías declaradas: ${campos.length} (${projectId})`);
for (const [i, campo] of campos.entries()) {
  const n = (snaps[i].data()?.valores ?? []).length;
  console.log(`  ${snaps[i].exists ? '·' : '✗'} ${campo}: ${snaps[i].exists ? `${n} valores` : 'NO EXISTE'}`);
}

/*
 * **Una taxonomía vacía no es un error**, y por eso se informa aparte: `barrio` y
 * `tags` nacen vacías a propósito (`opciones-base.json`) y se llenan con «Otro».
 * Lo que rompe es que el **documento** no exista, porque ahí el desplegable no
 * tiene ni de dónde leer.
 */
if (vacias.length > 0) {
  console.log(
    `\nℹ️  ${vacias.length} existen y están vacías (${vacias.join(', ')}).\n` +
      '   No es un error: hay vocabularios que nacen vacíos y se llenan con «Otro…».',
  );
}

if (faltan.length === 0) {
  console.log('\n✓ todas las taxonomías declaradas existen en la base.');
  process.exit(0);
}

console.error(
  `\n✗ ${faltan.length} taxonomía(s) declarada(s) que NO existen en la base: ${faltan.join(', ')}.\n` +
    '\n  Su desplegable va a salir vacío, y si el campo es obligatorio el formulario\n' +
    '  no se va a poder guardar — con todo el resto del deploy en verde.\n' +
    '\n  Cómo sembrarlas: docs/08-operacion.md § «Sembrar una taxonomía NUEVA en producción».',
);
process.exit(informar ? 0 : 1);
