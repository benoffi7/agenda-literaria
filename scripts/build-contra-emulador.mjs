#!/usr/bin/env node
/**
 * El paso 4 de `verificar-todo.sh`: el build **leyendo Firestore de verdad**, y
 * el aserto que hace que su verde signifique eso y no otra cosa.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 ./scripts/build-contra-emulador.mjs
 *
 * ── Por qué existe (el gate que caía en su propia trampa) ─────────────────
 * B-106 dejó el paso 4 apuntando `FIRESTORE_EMULATOR_HOST` al emulador «para
 * que el build ejercite la lectura real». No la ejercitaba, por dos motivos que
 * se tapaban entre sí:
 *
 * 1. El paso 3 tiene dos ramas. Si hay un hub de emuladores arriba lo reusa y
 *    queda vivo; si no, usa `firebase emulators:exec`, que **levanta y apaga**
 *    los emuladores alrededor de los tests. En esa segunda rama, al llegar al
 *    paso 4 no hay nadie escuchando en el puerto: el build se quedaba ~44
 *    segundos y moría con `14 UNAVAILABLE`. O sea que el gate, corrido sin un
 *    emulador previo, **fallaba siempre y por su propia plomería** — que es
 *    justo lo que el paso 3 aprendió a no hacer.
 * 2. Y con el emulador vivo tampoco probaba nada: los tests de integración del
 *    paso 3 terminan llamando a `limpiarFirestore()`, así que el paso 4 llegaba
 *    a una base **vacía**. El build leía cero actividades, escribía un
 *    `events.json` sin ninguna, y salía en verde.
 *
 * Las dos mitades juntas dan el peor resultado posible: un chequeo agregado
 * *para* garantizar «esto leyó Firestore» que pasa idéntico leyendo cero
 * documentos. Es la trampa que el propio commit decía prevenir (D-123: leer cero
 * actividades no falla solo, produce un `events.json` vacío y el deploy lo
 * publica encima del sitio que sí tenía datos).
 *
 * ── Qué hace en cambio ────────────────────────────────────────────────────
 * Siembra cinco actividades de prueba —una publicada, una en borrador, las dos
 * canceladas de B-110 y la de tres imágenes de B-296—, corre el build, y
 * **afirma sobre los archivos que salieron**: el `events.json` y el HTML de cada
 * página.
 *
 *   1. La publicada está. Si el índice sale con cero actividades, esto falla:
 *      es la mitad que faltaba.
 *   2. La borrador **no** está. El `where('estado','==','publicado')` del
 *      endpoint tiene un control negativo, y no solo un comentario.
 *   3. Ningún centinela de los campos que el índice recorta aparece en el
 *      archivo. Es el barrido de `tests/barrido-de-salidas-publicas.test.ts`,
 *      pero sobre el artefacto de verdad y no sobre el valor de retorno de una
 *      función — que es la diferencia entre «la proyección recorta» y «el
 *      archivo que se sube no lo tiene».
 *   4. **B-110** — la cancelada que estuvo publicada tiene su `index.html`, con
 *      la franja, el `EventCancelled` y sin CTA; y sin ningún campo privado, con
 *      `urlPublica: true` en el fixture. La que nunca se publicó **no** tiene
 *      archivo, igual que el borrador. Es la mitad que ningún unitario puede
 *      mirar: `caminosDeDetalle` devuelve rutas, Astro escribe los archivos.
 *   5. **B-296** — la actividad con **tres imágenes de proporciones distintas**
 *      (vertical, apaisada y cuadrada) pinta las tres, con la portada arriba
 *      —que en el fixture es la **segunda** del array—, un solo `loading="eager"`,
 *      un solo texto alternativo con contenido, tres cajas de proporción
 *      distintas y ningún enlace. Y el control que sostiene el ítem: la de **una
 *      sola** imagen sigue pintando una y no lleva sección de galería. Nada de
 *      eso lo puede ver un unitario: son tres medidas atravesando una plantilla
 *      que vitest no renderiza.
 *   6. **B-121** — el barrido de centinelas sobre **todo** el `dist/`, y no sobre
 *      un puñado de páginas elegidas a mano. Se recorre lo que el build escribió
 *      (`.html`, `.json`, `.xml`, `.txt`) y se barre cada archivo, con las
 *      excepciones declaradas por salida. Es lo que el ítem pedía desde el
 *      principio —«el grep sobre `dist/`»— y lo que hace que una página nueva
 *      entre al barrido sin que nadie se acuerde: el listado, la cartelera, las
 *      páginas de mes, `/pasadas` y los hubs no estaban cubiertos por ninguno de
 *      los pasos anteriores.
 *
 * ── Los dos barridos, y por qué hacen falta los dos ───────────────────────
 * `tests/barrido-de-salidas-publicas.test.ts` mira las **funciones puras** —qué
 * decide publicar la proyección— y corre en milisegundos sin build. El paso 9 de
 * acá mira **lo que quedó escrito en el artefacto**, que es lo único que prueba
 * que ninguna plantilla interpoló algo por su cuenta: un `title={imagen.storagePath}`
 * agregado a un `.astro` pasa el barrido del view-model y muere acá.
 *
 * La contracara es que las excepciones se declaran **en los dos**, y eso ya falló
 * una vez: B-99 declaró el id de sesión en el barrido de vitest y no acá, así que
 * este gate quedó **rojo por un campo que se publica a propósito** — el modo de
 * falla de B-180 en vivo. Ver `CENTINELA_DEL_INDICE` en
 * `scripts/gate-build/semilla.mjs`.
 *
 * ── Cómo está partido (D-1070, B-1760, B-1960) ────────────────────────────
 * `scripts/gate-build/semilla.mjs` son los datos (qué se siembra, los centinelas
 * y las canastas), `directorio.mjs` el verificador de los cuatro directorios de
 * la Guía (pasos 8i-8l) y `barrido.mjs` el barrido del paso 9 como función pura.
 * Los pasos 1 a 10 son **chequeos nombrados**, uno por archivo en
 * `gate-build/chequeos/`, que `gate-build/chequeos.mjs` registra en orden y
 * corre sobre el `dist/` leído una sola vez. Un chequeo que tira una excepción
 * se reporta con su nombre y **no corta a los demás**. Este archivo siembra,
 * buildea y los corre; el rojo lo lleva `gate-build/resultado.mjs`.
 *
 * Los dos documentos se borran al final, pase lo que pase (`finally`): el
 * emulador de quien está trabajando puede tener datos persistidos
 * (`--export-on-exit`) y este gate no es dueño de ellos.
 *
 * ── Por qué contra el emulador y no contra producción ─────────────────────
 * Porque siembra. Es la misma guarda de `seed-emulador.mjs`: si el host no es
 * local, aborta.
 */
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
/*
 * La semilla —los documentos, los centinelas y las canastas— vive aparte desde
 * B-1760 (corte 1 de D-1070): es datos puros, sin efectos al cargarse, así que
 * vitest la puede importar para comparar las canastas con las de su barrido
 * (B-1761). Los chequeos sobre el `dist/` viven en `gate-build/chequeos/` desde
 * B-1960. Este archivo es el que siembra, buildea y los corre.
 */
import {
  CIUDAD_DEL_GATE,
  ETIQUETA_CIUDAD_DEL_GATE,
  PREFIJO,
  SLUG_EFEMERIDE,
  SLUG_EFEMERIDE_BORRADOR,
  TITULO_BORRADOR_EFEMERIDE,
  BUCKET_POR_DEFECTO,
  documentosDeLaSemilla,
  efemerideDelGate,
  rutaDeLaMiniaturaDelGate,
} from './gate-build/semilla.mjs';
import { CHEQUEOS, contextoSobre, correrChequeos } from './gate-build/chequeos.mjs';
import { crearResultado } from './gate-build/resultado.mjs';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const host = process.env.FIRESTORE_EMULATOR_HOST;

if (!host) {
  console.error(
    'build-contra-emulador: falta FIRESTORE_EMULATOR_HOST.\n' +
      'Este script siembra datos, así que solo corre contra el emulador.',
  );
  process.exit(1);
}

const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])/;

// Misma guarda que `seed-emulador.mjs`: escribe sin credenciales, así que solo
// tiene sentido contra el emulador. Nunca contra producción.
if (!LOCAL.test(host)) {
  console.error(`FIRESTORE_EMULATOR_HOST apunta a "${host}", que no es local. Abortando.`);
  process.exit(1);
}

/*
 * B-1790 — **y Storage también, o no hay paso 4.** Sin esta variable el build
 * no lista `miniaturas/` (listaría el bucket de producción, D-210) y sirve todo
 * sin `srcset`: el gate daba verde corriendo justo la mitad que no confirma
 * nada. Y este script **sube** un objeto, así que la guarda es la misma que la de
 * Firestore: sin la variable, el Admin SDK escribiría en el bucket de verdad.
 */
const hostStorage = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (!hostStorage || !LOCAL.test(hostStorage)) {
  console.error(
    `build-contra-emulador: FIREBASE_STORAGE_EMULATOR_HOST ${hostStorage ? `apunta a "${hostStorage}", que no es local` : 'falta'}.\n` +
      'El paso 4 levanta Storage además de Firestore (B-1790): sin él, el build no\n' +
      'confirma ninguna miniatura y el gate no mira el `srcset`. Abortando.',
  );
  process.exit(1);
}

const proyecto = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';
initializeApp({ projectId: proyecto });
const db = getFirestore();
/*
 * El bucket que el build va a listar: el mismo `PUBLIC_FIREBASE_STORAGE_BUCKET ??
 * default` que `adminBucket()`. La huella es la base de este checkout (B-219),
 * que es lo que separa la miniatura de este gate de la del gate de al lado.
 */
const bucket = getStorage().bucket(process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? BUCKET_POR_DEFECTO);
const huella = proyecto;
const RUTA_DE_LA_MINIATURA = rutaDeLaMiniaturaDelGate(huella);

/**
 * **`/opciones/ciudad`: la ciudad del gate, sacada por prefijo** — B-969.
 *
 * Es el único documento de id **fijo** que este gate toca, así que no lo alcanza
 * el borrado por prefijo de `limpiar()`. La alternativa era no sembrarlo, y
 * entonces no se emite ninguna página `/ciudad/*` —un hub solo existe para las
 * opciones **aprobadas** con actividad publicada— que es justo lo que este gate
 * vino a cubrir.
 *
 * ── Por qué se saca por prefijo y no restaurando una copia ────────────────
 * La primera versión guardaba el documento en una variable del módulo y lo
 * escribía de vuelta en el `finally`. **Lo cobró el `auditor-trampas`, y con
 * razón**: eso cubre el éxito y la excepción de JS, pero **no** una interrupción
 * del proceso —un `Ctrl+C`, un `SIGTERM` de CI, cerrar la terminal—, donde node
 * no corre ningún `finally` pendiente. Y la corrida siguiente tampoco lo
 * reparaba: la variable arranca en `undefined` en cada proceso nuevo, así que la
 * limpieza inicial la leía como «no sembré nada» y no tocaba el documento. El
 * slug del gate quedaba en la taxonomía que alimenta **todos los desplegables de
 * ciudad del panel**, hasta que alguien lo notara a mano.
 *
 * Sacarlo por prefijo no depende de que este proceso haya sobrevivido: es el
 * mismo criterio que el borrado de las colecciones, y **se autorepara** porque
 * `limpiar()` corre también al **empezar**. Una corrida interrumpida la arregla
 * la siguiente.
 *
 * Los campos que no son `valores` se conservan: `set()` reemplaza, y la taxonomía
 * puede ganar un campo mañana.
 *
 * Si al sacar lo del gate no queda ningún valor, el documento **se borra**: es el
 * caso del emulador que no lo tenía, que es el normal acá. (Un `/opciones/ciudad`
 * real siempre tiene al menos `caba`, que `opciones-base.json` siembra.)
 */
const sembrarCiudadDelGate = async () => {
  const ref = db.doc('opciones/ciudad');
  const snap = await ref.get();
  const previos = snap.exists ? (snap.data()?.valores ?? []) : [];
  await ref.set({
    ...(snap.exists ? (snap.data() ?? {}) : {}),
    valores: [
      ...previos,
      {
        slug: CIUDAD_DEL_GATE,
        label: ETIQUETA_CIUDAD_DEL_GATE,
        orden: 99,
        fijo: false,
        usos: 1,
        // **Aprobada a propósito**: es la condición que decide si el hub se
        // emite (§4.3). Con `false` esta siembra no probaría nada y el paso 9
        // quedaría verde buscando una página que nunca se genera.
        aprobada: true,
      },
    ],
  });
};

/** Devuelve cuántos valores del gate sacó. Ver el docblock de arriba. */
const limpiarCiudadDelGate = async () => {
  const ref = db.doc('opciones/ciudad');
  const snap = await ref.get();
  if (!snap.exists) return 0;
  const datos = snap.data() ?? {};
  const previos = datos.valores ?? [];
  const quedan = previos.filter((v) => !String(v?.slug ?? '').startsWith(PREFIJO));
  const sacados = previos.length - quedan.length;
  if (sacados === 0) return 0;
  if (quedan.length === 0) await ref.delete();
  else await ref.set({ ...datos, valores: quedan });
  return sacados;
};

const limpiar = async () => {
  /*
   * B-969 — va **primero** y fuera del `Promise.all` de abajo: es un documento de
   * id fijo y no entra al borrado por prefijo de las colecciones. Una limpieza
   * que se olvida de él le deja al emulador de quien trabaja una ciudad que no
   * existe, en la taxonomía que alimenta los desplegables de todo el panel.
   *
   * **Con su propio `try`, y eso lo cobró el `auditor-privacidad`:** sin él, un
   * fallo acá cortaba el `await` y **las actividades de prueba no se borraban**,
   * que es un daño mayor que el que esta línea vino a evitar. Avisa y sigue.
   */
  let ciudadDelGate = 0;
  try {
    ciudadDelGate = await limpiarCiudadDelGate();
  } catch (e) {
    console.error(
      '  ⚠ no se pudo limpiar la ciudad del gate de `/opciones/ciudad`: ' +
        `${e instanceof Error ? e.message : String(e)}\n` +
        `     Revisá que no haya quedado un valor con el prefijo ${PREFIJO}: ` +
        'la corrida siguiente lo saca sola, pero mientras tanto emite un hub /ciudad/*.',
    );
  }
  // Las dos colecciones que este gate siembra. `/usuarios` entró con B-888 y va
  // acá y no en un segundo helper: el `finally` tiene que dejar el emulador como
  // lo encontró, y una limpieza que se olvida de una colección es la clase de
  // olvido que solo se nota semanas después, con datos de prueba en la base de
  // quien está trabajando (`--export-on-exit`).
  const borrar = async (coleccion) => {
    const snap = await db.collection(coleccion).get();
    const aBorrar = snap.docs.filter((d) => d.id.startsWith(PREFIJO));
    await Promise.all(aBorrar.map((d) => d.ref.delete()));
    return aBorrar.length;
  };
  // B-901 — `librerias` entra a la limpieza en el **mismo** cambio que la siembra:
  // una limpieza que se olvida de una colección deja datos de prueba en la base de
  // quien está trabajando (`--export-on-exit`) y solo se nota semanas después.
  // B-832 — `suscripciones` entra a la limpieza en el **mismo** cambio que la
  // siembra, por lo mismo que `librerias`.
  // B-833 — `lugares` entra a la limpieza en el **mismo** cambio que la siembra,
  // por lo mismo que las otras dos.
  // B-960 — `bibliotecas` entra a la limpieza en el **mismo** cambio que la
  // siembra, por lo mismo que las otras tres.
  // B-959 — `efemerides` entra a la limpieza en el **mismo** cambio que la
  // siembra (paso 8n), por lo mismo que los cuatro directorios.
  const [actividades, usuarios, librerias, suscripciones, lugares, bibliotecas, efemerides] =
    await Promise.all([
      borrar('actividades'),
      borrar('usuarios'),
      borrar('librerias'),
      borrar('suscripciones'),
      borrar('lugares'),
      borrar('bibliotecas'),
      borrar('efemerides'),
    ]);
  /*
   * B-1790 — la miniatura del gate, **solo la de este checkout** (la huella va
   * en el nombre): el bucket del emulador es de la máquina, y borrar por el
   * prefijo del gate sin la huella le sacaría la suya al gate de al lado a
   * mitad de su build. Con su propio `try` por lo mismo que la ciudad.
   */
  let miniatura = 0;
  try {
    const [deEste] = await bucket.getFiles({ prefix: RUTA_DE_LA_MINIATURA });
    await Promise.all(deEste.map((o) => o.delete({ ignoreNotFound: true })));
    miniatura = deEste.length;
  } catch (e) {
    console.error(
      `  ⚠ no se pudo borrar la miniatura del gate (${RUTA_DE_LA_MINIATURA}) del emulador de ` +
        `Storage: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return (
    actividades +
    usuarios +
    librerias +
    suscripciones +
    lugares +
    bibliotecas +
    efemerides +
    ciudadDelGate +
    miniatura
  );
};

/*
 * **El rojo lo marca `fallo()`, y en un solo lugar** — B-1960 (M-11 del PRD 6).
 * El código de salida sale de `resultado.salida`; ver `gate-build/resultado.mjs`.
 */
const resultado = crearResultado();
const { fallo } = resultado;

/** Todo lo publicable del `dist/`, leído una vez: los chequeos miran esta lista. */
const leerElDist = async () => {
  const raiz = new URL('../dist/', import.meta.url);
  const rutas = (await readdir(raiz, { recursive: true })).filter((r) =>
    /\.(html|json|txt|xml)$/.test(r),
  );
  return Promise.all(
    rutas.map(async (relativa) => ({
      relativa,
      contenido: await readFile(new URL(relativa, raiz), 'utf8').catch(() => ''),
    })),
  );
};

try {
  await limpiar();

  /*
   * Qué se siembra y por qué vive en `scripts/gate-build/semilla.mjs`, que es
   * datos puros (corte 1 de D-1070). Acá solo se escribe.
   *
   * B-969 — `/opciones/ciudad` va aparte: no se reemplaza, se le agrega el valor
   * del gate a lo que ya tenga el emulador de quien trabaja.
   */
  await sembrarCiudadDelGate();
  for (const [ruta, datos] of documentosDeLaSemilla({ bucket: bucket.name, huella })) {
    await db.doc(ruta).set(datos);
  }
  // B-1790 — el objeto de la miniatura de la portada de la de afuera. El
  // contenido no importa: el build **lista** `miniaturas/` y no baja un byte
  // (DEC-7d), así que lo que se prueba es que el listado la confirme.
  await db
    .doc(`efemerides/${SLUG_EFEMERIDE}`)
    .set(efemerideDelGate(SLUG_EFEMERIDE, 'Efeméride del gate', 'publicado'));
  await db
    .doc(`efemerides/${SLUG_EFEMERIDE_BORRADOR}`)
    .set(efemerideDelGate(SLUG_EFEMERIDE_BORRADOR, TITULO_BORRADOR_EFEMERIDE, 'borrador'));
  await bucket.file(RUTA_DE_LA_MINIATURA).save(Buffer.from('gate'), { contentType: 'image/jpeg' });

  console.log(
    `  (sembradas 6 actividades de prueba en ${host}: publicada, borrador, dos canceladas, ` +
      'la de afuera de CABA con su miniatura en Storage (' +
      `${hostStorage}) y ` +
      'una con tres imágenes y un encuentro cancelado con motivo; 2 librerías, 2 suscripciones y 2 bibliotecas, cada ' +
      'par con una publicada y una esperando decisión; y 3 lugares: uno ' +
      'publicado, uno esperando decisión y una casa publicada SIN dirección ' +
      'publicada)',
  );

  const build = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: host },
  });
  if (build.status !== 0) {
    fallo('el build no pasa');
  } else {
    const ctx = contextoSobre(await leerElDist(), resultado, {
      rutaDeLaMiniatura: RUTA_DE_LA_MINIATURA,
    });
    await correrChequeos(CHEQUEOS, ctx);

    if (resultado.sinFallos()) {
      const indice = JSON.parse((await ctx.leer('events.json')) ?? '{}');
      console.log(
        `\n  ✓ ${CHEQUEOS.length} chequeos en verde sobre el dist/.\n` +
          `  ✓ el build leyó Firestore: ${(indice.actividades ?? []).length} actividad(es) en el events.json, ` +
          'sin la borrador y sin ningún campo recortado.\n' +
          '  ✓ la cancelada que estuvo publicada conserva su página, con la franja y el ' +
          'EventCancelled; la que nunca lo estuvo no existe (B-110).\n' +
          '  ✓ el sitemap ofrece la publicada y la cancelada reciente con URL absoluta y ' +
          'barra final, sin el borrador ni /admin, con lastmod en la publicada y sin él en ' +
          'la home (B-112); el robots.txt bloquea el panel; y el robots, el sitemap y la ' +
          'canónica coinciden en un solo origen (B-109).\n' +
          '  ✓ la de afuera de CABA salió con su provincia en el índice, su ficha diciendo ' +
          'la ciudad y la provincia con etiqueta, y su hub /ciudad/* emitido y enlazado ' +
          '(B-950, B-951, B-969).\n' +
          '  ✓ la miniatura sembrada en el emulador de Storage sale en el srcset de la ficha ' +
          'y de la cartelera: el build listó miniaturas/ de verdad (D-210, B-1790).\n' +
          '  ✓ la actividad con tres imágenes pinta las tres, con la portada marcada arriba, ' +
          'un solo `eager`, un solo texto alternativo y tres cajas de proporción distinta; y ' +
          'la de una sola imagen sigue pintando una, sin sección de galería (B-296).\n' +
          '  ✓ ningún campo privado sobrevivió en NINGÚN archivo publicable del dist/ ' +
          '(B-121): la lista se recorre, no se enumera.\n' +
          '  ✓ el monto del arancel llega crudo al events.json y al JSON-LD, y formateado a ' +
          'la página y a la tarjeta compartida — y a ninguna otra parte (B-804).\n' +
          '  ✓ cada página tiene su propio <title> y una jerarquía de encabezados sana ' +
          '(B-122).',
      );
    }
  }
} catch (e) {
  fallo(`build-contra-emulador: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  try {
    const borradas = await limpiar();
    if (borradas > 0) console.log(`  (limpieza: ${borradas} documento(s) de prueba borrados)`);
  } catch (e) {
    console.error(
      `  ⚠ no se pudieron borrar los documentos de prueba (prefijo ${PREFIJO}), ni de las ` +
        'colecciones ni de `/opciones/ciudad`: ' +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

process.exit(resultado.salida);
