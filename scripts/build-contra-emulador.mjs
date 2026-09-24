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
 * falla de B-180 en vivo. Ver `CENTINELA_DEL_INDICE`.
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
import { problemasDeJerarquia, tituloDe } from './seo-del-artefacto.mjs';
/*
 * La semilla —los documentos, los centinelas y las canastas— vive aparte desde
 * B-1760 (corte 1 de D-1070): es datos puros, sin efectos al cargarse, así que
 * vitest la puede importar para comparar las canastas con las de su barrido
 * (B-1761). Este archivo es el que siembra, buildea y afirma.
 */
import {
  CENTINELA,
  CENTINELA_DEL_DETALLE,
  CENTINELA_DEL_INDICE,
  CENTINELA_DE_LA_CARTELERA,
  CENTINELA_DEL_DIRECTORIO,
  CENTINELA_DE_SUSCRIPCIONES,
  CENTINELA_DE_LUGARES,
  CENTINELA_DE_BIBLIOTECAS,
  CIUDAD_DEL_GATE,
  ETIQUETA_CIUDAD_DEL_GATE,
  ETIQUETA_PROVINCIA_DEL_GATE,
  ETIQUETA_DE_COMISION,
  ETIQUETA_DE_INCLUYE,
  ID_DE_SESION_QUE_SALE,
  LAT_DE_LA_CASA,
  MONTO_EN_EL_ARTEFACTO,
  PAGINAS_CON_TARJETA,
  PREFIJO,
  PROVINCIA_DEL_GATE,
  SLUG_AFUERA,
  SLUG_BIBLIOTECA,
  SLUG_BIBLIOTECA_PENDIENTE,
  SLUG_BORRADOR,
  SLUG_CANCELADA,
  SLUG_CANCELADA_NUNCA,
  SLUG_GALERIA,
  SLUG_LIBRERIA,
  SLUG_LIBRERIA_PENDIENTE,
  SLUG_LUGAR,
  SLUG_LUGAR_CASA,
  SLUG_LUGAR_PENDIENTE,
  SLUG_PUBLICADA,
  SLUG_SUSCRIPCION,
  SLUG_SUSCRIPCION_PENDIENTE,
  documentosDeLaSemilla,
  pintaLaTarjeta,
} from './gate-build/semilla.mjs';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;

if (!host) {
  console.error(
    'build-contra-emulador: falta FIRESTORE_EMULATOR_HOST.\n' +
      'Este script siembra datos, así que solo corre contra el emulador.',
  );
  process.exit(1);
}

// Misma guarda que `seed-emulador.mjs`: escribe sin credenciales, así que solo
// tiene sentido contra el emulador. Nunca contra producción.
if (!/^(127\.0\.0\.1|localhost|\[::1\])/.test(host)) {
  console.error(`FIRESTORE_EMULATOR_HOST apunta a "${host}", que no es local. Abortando.`);
  process.exit(1);
}

initializeApp({ projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria' });
const db = getFirestore();

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
  const [actividades, usuarios, librerias, suscripciones, lugares, bibliotecas] =
    await Promise.all([
      borrar('actividades'),
      borrar('usuarios'),
      borrar('librerias'),
      borrar('suscripciones'),
      borrar('lugares'),
      borrar('bibliotecas'),
    ]);
  return (
    actividades + usuarios + librerias + suscripciones + lugares + bibliotecas + ciudadDelGate
  );
};

const fallo = (mensaje) => {
  console.error(`\n\x1b[31m✗ ${mensaje}\x1b[0m`);
  process.exitCode = 1;
};

let salida = 0;

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
  for (const [ruta, datos] of documentosDeLaSemilla()) await db.doc(ruta).set(datos);

  console.log(
    `  (sembradas 5 actividades de prueba en ${host}: publicada, borrador, dos canceladas y ` +
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
    salida = 1;
  } else {
    const crudo = await readFile(new URL('../dist/events.json', import.meta.url), 'utf8');
    const indice = JSON.parse(crudo);
    const slugs = (indice.actividades ?? []).map((a) => a.slug);

    // 1 · El aserto que faltaba: el build tiene que haber LEÍDO algo.
    if (!slugs.includes(SLUG_PUBLICADA)) {
      fallo(
        `el events.json salió con ${slugs.length} actividades y ninguna es la sembrada.\n` +
          '  El build no leyó Firestore: apuntar FIRESTORE_EMULATOR_HOST no alcanza si\n' +
          '  del otro lado no hay nadie o la base está vacía. Un events.json vacío se\n' +
          '  publicaría encima del sitio que tiene datos (D-123, B-189).',
      );
      salida = 1;
    }

    // 2 · Control negativo del `where('estado','==','publicado')` (§5.3).
    if (slugs.includes(SLUG_BORRADOR)) {
      fallo(
        'el events.json trae la actividad en BORRADOR.\n' +
          "  Falta o está mal el where('estado','==','publicado') de src/pages/events.json.ts.",
      );
      salida = 1;
    }

    /*
     * 1b · **B-969 — la mitad no-CABA, sobre el artefacto de verdad.**
     *
     * Tres afirmaciones, y la primera es la que el bug de B-950 habría puesto en
     * rojo: `EntradaDeIndice.sede` tiene que llevar la **provincia**. Sin ella el
     * único chip posible es `caba`, y como la cascada abre el eje `ciudad` solo
     * con una provincia no-CABA elegida, el filtro de ciudad del sitio queda
     * inalcanzable — con la suite entera en verde, porque los unitarios le pasan
     * la otra forma del mismo dato.
     */
    const entradaDeAfuera = (indice.actividades ?? []).find((a) => a.slug === SLUG_AFUERA);
    if (!entradaDeAfuera) {
      fallo(
        `el events.json no trae la actividad de afuera de CABA (${SLUG_AFUERA}).\n` +
          '  Es la que cubre la mitad no-CABA de la cascada de B-950.',
      );
      salida = 1;
    } else if (entradaDeAfuera.sede?.provincia !== PROVINCIA_DEL_GATE) {
      fallo(
        'la entrada del índice salió SIN provincia: ' +
          `\`sede.provincia\` es ${JSON.stringify(entradaDeAfuera.sede?.provincia)}.\n` +
          '  Sin ese campo, `provinciaDeSede` cae al respaldo «¿la ciudad es CABA?»: el\n' +
          '  único chip posible pasa a ser `caba` y el eje `ciudad` del sitio queda\n' +
          '  inalcanzable. Es el bug que B-969 vino a cubrir (B-950, D-710).',
      );
      salida = 1;
    } else if (entradaDeAfuera.sede?.ciudad !== CIUDAD_DEL_GATE) {
      fallo(
        'la entrada del índice salió sin la ciudad esperada: ' +
          `${JSON.stringify(entradaDeAfuera.sede?.ciudad)}.`,
      );
      salida = 1;
    }

    // 2b · B-110 — una cancelada tiene página y **no** entra al índice (§7.3):
    // no es algo a lo que se pueda ir, existe solo para quien tiene el link.
    const canceladasEnElIndice = [SLUG_CANCELADA, SLUG_CANCELADA_NUNCA].filter((s) =>
      slugs.includes(s),
    );
    if (canceladasEnElIndice.length > 0) {
      fallo(
        `el events.json trae actividades CANCELADAS: ${canceladasEnElIndice.join(', ')}.\n` +
          '  Una cancelada conserva su página y no entra al listado (§7.3, B-110).',
      );
      salida = 1;
    }

    // 3b · El eje de encuentros de B-99 sí está, con su id de sesión. Es la
    // dirección contraria del aserto de abajo, y hace falta: sin ella, el día
    // que el eje deje de emitirse el archivo pasaría este gate en silencio.
    if (!crudo.includes(ID_DE_SESION_QUE_SALE)) {
      fallo(
        'el events.json NO trae el eje de encuentros de B-99: falta el id de sesión.\n' +
          '  Es lo que alimenta el tríptico «¿Qué hay ahora?» de la home (B-600).',
      );
      salida = 1;
    }

    // 3 · Ningún centinela de los campos recortados sobrevivió al archivo.
    const filtrados = Object.entries(CENTINELA).filter(([, v]) => crudo.includes(v));
    if (filtrados.length > 0) {
      fallo(
        'el events.json publica campos que el índice recorta:\n' +
          filtrados.map(([campo, valor]) => `    ${campo} → ${valor}`).join('\n'),
      );
      salida = 1;
    }

    /*
     * 4 · B-110 — **la página de la cancelada, sobre el HTML de verdad.**
     *
     * Los tres asertos de arriba miran el `events.json`, y el modo de falla de
     * este ítem no se ve ahí: es un archivo HTML que se genera o no se genera. Y
     * es la mitad que ningún test unitario puede mirar — `caminosDeDetalle`
     * devuelve rutas, Astro las escribe.
     */
    const htmlDe = async (slug) => {
      try {
        return await readFile(new URL(`../dist/actividad/${slug}/index.html`, import.meta.url), 'utf8');
      } catch {
        return null;
      }
    };

    const htmlCancelada = await htmlDe(SLUG_CANCELADA);
    if (htmlCancelada === null) {
      fallo(
        `no se generó dist/actividad/${SLUG_CANCELADA}/index.html.\n` +
          '  Una actividad cancelada que estuvo publicada conserva su página (§7.3, B-110):\n' +
          '  un 404 le contesta «no existe» a quien pregunta si se hace.',
      );
      salida = 1;
    } else {
      // La franja, el `eventStatus` y la ausencia de CTA: las tres cosas del §7.3.
      if (!htmlCancelada.includes('Esta actividad se canceló')) {
        fallo('la página de la cancelada no lleva la franja que dice que se canceló.');
        salida = 1;
      }
      if (!htmlCancelada.includes('EventCancelled')) {
        fallo(
          'el JSON-LD de la cancelada no lleva `eventStatus: EventCancelled`.\n' +
            '  Es lo que Google pide para dejar de mostrarla como vigente (§5.3).',
        );
        salida = 1;
      }
      if (htmlCancelada.includes('Mandar un mail')) {
        fallo('la página de la cancelada muestra el CTA de inscripción (§7.3: sin CTA).');
        salida = 1;
      }
      // Y el barrido, sobre el artefacto: la cancelada no publica nada de más.
      // `urlPublica` está en `true` en el fixture, así que es el peor caso.
      const enLaPagina = Object.entries(CENTINELA).filter(
        ([campo, v]) => !CENTINELA_DEL_DETALLE.includes(campo) && htmlCancelada.includes(v),
      );
      if (enLaPagina.length > 0) {
        fallo(
          'la página de la actividad CANCELADA publica campos privados:\n' +
            enLaPagina.map(([campo, valor]) => `    ${campo} → ${valor}`).join('\n'),
        );
        salida = 1;
      }
    }

    /*
     * 4b · B-181 — **el agrupado por opción, sobre el HTML de verdad.**
     *
     * Es la mitad que ningún test unitario puede mirar: `detallePublico.ts`
     * decide los grupos y los tiene barridos, pero que la plantilla los **pinte**
     * solo se ve en el archivo que sale (D-140, el mismo argumento del punto 4).
     */
    const htmlPublicadaGrupos = await htmlDe(SLUG_PUBLICADA);
    if (htmlPublicadaGrupos === null) {
      fallo(`no se generó dist/actividad/${SLUG_PUBLICADA}/index.html.`);
      salida = 1;
    } else {
      if (!htmlPublicadaGrupos.includes(ETIQUETA_DE_COMISION)) {
        fallo(
          'la página no muestra el encabezado de la opción para sumarse (B-181).\n' +
            '  El view-model la agrupa y la plantilla no la pinta: la lista de encuentros\n' +
            '  se lee como un ciclo largo, que es el malentendido que B-181 arregló.',
        );
        salida = 1;
      }
      /*
       * B-830 — «Qué se llevan», el mismo argumento: `detallePublico.ts` decide
       * qué etiquetas mostrar y **solo acá se ve si la sección se pinta**. Y en
       * las dos direcciones a la vez: la etiqueta tiene que aparecer y el slug
       * crudo (`CENTINELA.incluyeSlug`) lo barre el paso 9 con todo el resto.
       */
      if (!htmlPublicadaGrupos.includes(ETIQUETA_DE_INCLUYE)) {
        fallo(
          'la página no muestra «Qué se llevan» (B-830).\n' +
            '  El view-model trae las etiquetas y la plantilla no las pinta: es código\n' +
            '  muerto que ningún barrido detecta, la lección de B-341.',
        );
        salida = 1;
      }
      if (!htmlPublicadaGrupos.includes('Qué se llevan')) {
        fallo('la página no lleva el encabezado de la sección «Qué se llevan» (B-830).');
        salida = 1;
      }

      if (!htmlPublicadaGrupos.includes('Elegí tu opción')) {
        fallo(
          'la página no cambió el título de la sección de encuentros (B-181).\n' +
            '  Con opciones para sumarse tiene que decir «Elegí tu opción»: lo que sigue\n' +
            '  no es un programa, son programas paralelos y hay que elegir uno.',
        );
        salida = 1;
      }
    }

    // 5 · Y la que nunca estuvo publicada no existe: es un borrador por otra puerta.
    if ((await htmlDe(SLUG_CANCELADA_NUNCA)) !== null) {
      fallo(
        `se generó dist/actividad/${SLUG_CANCELADA_NUNCA}/index.html.\n` +
          '  Una actividad que nace y muere en `cancelado` nunca fue pública (§7.3):\n' +
          '  publicar su página ahora es publicar un borrador.',
      );
      salida = 1;
    }

    // 6 · El borrador tampoco, que es el mismo aserto sobre el HTML.
    if ((await htmlDe(SLUG_BORRADOR)) !== null) {
      fallo(`se generó dist/actividad/${SLUG_BORRADOR}/index.html: es un borrador.`);
      salida = 1;
    }

    /*
     * 7 · B-109 — **el sitemap, el robots.txt y la canónica, sobre los archivos
     * que se suben.**
     *
     * Los unitarios afirman sobre el valor de retorno de `rutasDelSitemap` y
     * sobre el texto de las plantillas; acá se mira lo que quedó en `dist/`, que
     * es lo único que ve Google. Es la misma diferencia que el punto 3: «la
     * proyección recorta» contra «el archivo que se sube no lo tiene».
     *
     * **El dominio no se escribe en este archivo**, y eso es a propósito: `SITIO`
     * (`src/lib/rutasPublicas.ts`) es la única aparición del dominio en el repo y
     * un `.mjs` no puede importar un `.ts`. Así que lo que se afirma es la
     * **forma** —absoluta, con barra final— y, sobre todo, que las cuatro salidas
     * coincidan en un solo origen: el del `Sitemap:` del robots, el de cada `loc`
     * del sitemap y el de la canónica de la página. Si alguien copia el dominio a
     * mano en una de las cuatro, empiezan a discrepar.
     */
    const leerDist = async (ruta) => {
      try {
        return await readFile(new URL(`../dist/${ruta}`, import.meta.url), 'utf8');
      } catch {
        return null;
      }
    };

    /*
     * **B-969 — la quinta clase de hub y el renglón de afuera, en el HTML de
     * verdad.**
     *
     * Las dos cosas que ningún unitario puede mirar: que Astro **escriba** la
     * página (`caminosDeCiudad` devuelve rutas, Astro las convierte en archivos)
     * y que la plantilla la pinte. Es el mismo argumento con el que el gate mira
     * la página de una cancelada.
     */
    /**
     * El `<h1>` de una página, y **por qué el aserto se recorta** — lo cobró el
     * `auditor-privacidad` sobre B-969.
     *
     * Buscar la etiqueta en el HTML entero pasaba por el motivo equivocado: la
     * página del hub pinta además la **tarjeta** de la actividad, y
     * `lugarDeTarjeta` resuelve la ciudad a su etiqueta desde B-950. O sea que si
     * mañana el `<h1>` emitiera el slug crudo —justo la trampa 10 que el mensaje
     * nombra— el aserto seguía verde por la tarjeta.
     */
    const encabezadoDe = (html) => {
      const fin = html.indexOf('</h1>');
      return fin === -1 ? '' : html.slice(0, fin);
    };

    const htmlHubDeCiudad = await leerDist(`ciudad/${CIUDAD_DEL_GATE}/index.html`);
    if (htmlHubDeCiudad === null) {
      fallo(
        `no se generó dist/ciudad/${CIUDAD_DEL_GATE}/index.html.\n` +
          '  Es la quinta clase de hub (B-951). Se emite para las opciones **aprobadas**\n' +
          '  de /opciones/ciudad que tengan alguna actividad publicada: si falta, o el\n' +
          '  hub dejó de emitirse, o la siembra de la opción no quedó aprobada.',
      );
      salida = 1;
    } else if (!encabezadoDe(htmlHubDeCiudad).includes(ETIQUETA_CIUDAD_DEL_GATE)) {
      fallo(
        `el hub /ciudad/${CIUDAD_DEL_GATE}/ no dice su etiqueta «${ETIQUETA_CIUDAD_DEL_GATE}» ` +
          'en el `<h1>`.\n' +
          '  El título de un hub lleva la etiqueta resuelta, nunca el slug (§4.1, trampa 10).',
      );
      salida = 1;
    }

    /*
     * Y el renglón «Dónde» de la ficha de afuera: la ciudad con su **etiqueta**
     * y la provincia detrás. Es la rama de `piezasDeLugar` que en CABA no corre,
     * y la que publicaba el slug crudo antes de B-950.
     */
    const htmlAfuera = await htmlDe(SLUG_AFUERA);
    if (htmlAfuera === null) {
      fallo(`no se generó dist/actividad/${SLUG_AFUERA}/index.html.`);
      salida = 1;
    } else {
      /*
       * **La etiqueta pegada a su `href`, y no suelta en el archivo** — lo cobró
       * el `auditor-privacidad` sobre B-969.
       *
       * Buscar «Ciudad del gate» en todo el HTML pasaba por el motivo
       * equivocado: el JSON-LD de la misma página emite `addressLocality` con la
       * etiqueta ya resuelta, así que si `piezasDeLugar` dejara de pintar el
       * renglón entero, el aserto seguía verde por el dato estructurado.
       *
       * Pedirlas juntas ata las **tres** afirmaciones a la pieza que las produce:
       * que el renglón existe, que enlaza al hub con el slug (trampa 10) y que lo
       * que se lee es la etiqueta.
       */
      const rutaDelHub = `/ciudad/${CIUDAD_DEL_GATE}/`;
      /*
       * El `<a …>` completo, con sus clases en el medio: se busca el `href` y se
       * exige que la etiqueta aparezca antes del cierre de esa etiqueta, no en
       * cualquier parte del archivo.
       */
      const desdeElHref = htmlAfuera.slice(htmlAfuera.indexOf(rutaDelHub));
      const anclaDeLaCiudad = desdeElHref.slice(0, desdeElHref.indexOf('</a>') + 4);
      if (!htmlAfuera.includes(rutaDelHub) || !anclaDeLaCiudad.includes(ETIQUETA_CIUDAD_DEL_GATE)) {
        fallo(
          `la ficha de ${SLUG_AFUERA} no tiene la ciudad enlazada a su hub.\n` +
            `  Se buscó la etiqueta «${ETIQUETA_CIUDAD_DEL_GATE}» adentro del <a> que apunta\n` +
            `  a ${rutaDelHub}: el «Dónde» de una sede de afuera de CABA dice la ciudad con su\n` +
            '  etiqueta y la enlaza al hub con su slug (B-951, D-710).\n' +
            '  Si el hub existe pero esto falla, mirá si `rutaDeZona` sigue resolviendo.',
        );
        salida = 1;
      }
      /*
       * La provincia, que **no** lleva enlace: no hay hub de provincia
       * (`CLASES_DE_TAXONOMIA`). Se busca en el mismo renglón —los 300 caracteres
       * que siguen a la pieza de la ciudad— y no en todo el archivo, porque
       * «Buenos Aires» es un literal genérico que mañana puede aparecer por otro
       * lado.
       */
      const desdeLaCiudad = desdeElHref.slice(0, 500);
      if (!desdeLaCiudad.includes(ETIQUETA_PROVINCIA_DEL_GATE)) {
        fallo(
          `la ficha de ${SLUG_AFUERA} no dice la provincia «${ETIQUETA_PROVINCIA_DEL_GATE}» ` +
            'al lado de la ciudad.',
        );
        salida = 1;
      }
    }

    const robots = await leerDist('robots.txt');
    const sitemap = await leerDist('sitemap.xml');
    const htmlPublicada = await htmlDe(SLUG_PUBLICADA);

    if (robots === null || sitemap === null) {
      fallo(
        'no se generó dist/robots.txt o dist/sitemap.xml.\n' +
          '  Son los dos endpoints de B-109: sin ellos el sitio no se le ofrece a ningún buscador.',
      );
      salida = 1;
    } else if (htmlPublicada === null) {
      fallo(`no se generó dist/actividad/${SLUG_PUBLICADA}/index.html.`);
      salida = 1;
    } else {
      const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      const origenDe = (url) => {
        try {
          return new URL(url).origin;
        } catch {
          return null;
        }
      };

      // 7a · La publicada está, con la URL absoluta y con la barra final, que es
      // la forma que contesta 200 en Firebase (`/x` redirige a `/x/`).
      const suUrl = locs.find((u) => u.includes(`/actividad/${SLUG_PUBLICADA}/`));
      if (!suUrl) {
        fallo(
          `el sitemap.xml no lista /actividad/${SLUG_PUBLICADA}/.\n` +
            `  Salió con ${locs.length} URL(s) y ninguna es la de la actividad sembrada:\n` +
            '  el sitemap no vio los datos, o la ruta de detalle dejó de entrar.',
        );
        salida = 1;
      }

      const malFormadas = locs.filter((u) => !/^https:\/{2}[^/]+\/{1}/.test(u) || !u.endsWith('/'));
      if (malFormadas.length > 0) {
        fallo(
          'el sitemap.xml tiene URLs que no son absolutas o no llevan la barra final:\n' +
            malFormadas.map((u) => `    ${u}`).join('\n') +
            '\n  El protocolo las exige absolutas, y sin la barra Firebase contesta un 301:\n' +
            '  una entrada de sitemap que apunta a una redirección es una URL menos rastreada.',
        );
        salida = 1;
      }

      // 7b · Los controles negativos: ni el borrador, ni la cancelada que nunca
      // se publicó, ni el panel.
      const queNoVan = [
        [SLUG_BORRADOR, 'un borrador'],
        [SLUG_CANCELADA_NUNCA, 'una cancelada que nunca estuvo publicada'],
      ].filter(([slug]) => sitemap.includes(slug));
      if (queNoVan.length > 0) {
        fallo(
          'el sitemap.xml ofrece páginas que no existen:\n' +
            queNoVan.map(([slug, qué]) => `    ${slug} → ${qué}`).join('\n'),
        );
        salida = 1;
      }
      if (sitemap.includes('/admin')) {
        fallo('el sitemap.xml lista /admin: el panel no se indexa.');
        salida = 1;
      }
      // 7b-bis · Desde B-112, la publicada SÍ lleva `lastmod`, con la fecha de
      // su `updatedAt` recortada al día — el fixture la sembró con
      // `updatedAt: new Date()`, o sea hoy.
      const hoy = new Date().toISOString().slice(0, 10);
      const bloquePublicada = sitemap.slice(
        sitemap.indexOf(`<loc>${suUrl}</loc>`),
        sitemap.indexOf('</url>', sitemap.indexOf(`<loc>${suUrl}</loc>`)),
      );
      if (!bloquePublicada.includes(`<lastmod>${hoy}</lastmod>`)) {
        fallo(
          `el sitemap.xml no lleva <lastmod>${hoy}</lastmod> en /actividad/${SLUG_PUBLICADA}/.\n` +
            '  Desde B-112 el lastmod sale de `updatedAt` recortado al día (D-138); el ' +
            'fixture\n' +
            '  la sembró con `updatedAt: new Date()`, o sea hoy.',
        );
        salida = 1;
      }

      // Y la home —que no es una actividad— sigue sin uno: `lastmod` es por
      // ruta y no un booleano global del archivo entero. La URL de la home se
      // ubica por su `pathname` y no por el dominio (que no se escribe acá,
      // ver el comentario de arriba de este bloque).
      const urlHome = locs.find((u) => {
        try {
          return new URL(u).pathname === '/';
        } catch {
          return false;
        }
      });
      const bloqueHome = urlHome
        ? sitemap.slice(
            sitemap.indexOf(`<loc>${urlHome}</loc>`),
            sitemap.indexOf('</url>', sitemap.indexOf(`<loc>${urlHome}</loc>`)),
          )
        : '';
      if (bloqueHome.includes('lastmod')) {
        fallo(
          'el sitemap.xml lleva `lastmod` en la home.\n' +
            '  Solo las actividades tienen una fecha de edición que valga la pena declarar ' +
            '(B-112); la home, los hubs y los meses siguen sin `lastmod`.',
        );
        salida = 1;
      }
      if (sitemap.includes('changefreq') || sitemap.includes('priority')) {
        fallo('el sitemap.xml lleva `changefreq` o `priority`: Google los ignora desde hace años.');
        salida = 1;
      }

      // 7c · La cancelada **reciente** sí está: el fixture tiene `updatedAt` de
      // ahora, o sea dentro de la ventana de 30 días del §7.3.
      if (!sitemap.includes(`/actividad/${SLUG_CANCELADA}/`)) {
        fallo(
          `el sitemap.xml no lista la cancelada reciente (/actividad/${SLUG_CANCELADA}/).\n` +
            '  Se canceló hoy (updatedAt del fixture), así que está dentro de los 30 días\n' +
            '  del §7.3: su URL se sigue ofreciendo para que Google la relea y la tache.',
        );
        salida = 1;
      }

      // 7d · El robots.txt: bloquea el panel y anuncia el sitemap.
      if (!/^Disallow: \/admin$/m.test(robots)) {
        fallo('el robots.txt no bloquea /admin.');
        salida = 1;
      }
      const anuncio = /^Sitemap: (\S+)$/m.exec(robots);
      if (!anuncio) {
        fallo('el robots.txt no anuncia el sitemap.');
        salida = 1;
      }

      // 7e · **Las cuatro salidas, un solo origen.**
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(htmlPublicada);
      if (!canonical) {
        fallo(
          `dist/actividad/${SLUG_PUBLICADA}/index.html no lleva <link rel="canonical">.\n` +
            '  Es lo único que le dice a Google cuál de los tres nombres del sitio es el bueno.',
        );
        salida = 1;
      }
      const origenes = new Set(
        [anuncio?.[1], canonical?.[1], suUrl].filter(Boolean).map(origenDe),
      );
      if (origenes.size !== 1 || origenes.has(null)) {
        fallo(
          'el robots.txt, el sitemap.xml y la canónica de la página no coinciden en un ' +
            `origen: ${[...origenes].join(', ')}.\n` +
            '  Las cuatro salidas absolutas salen de `SITIO`; si discrepan, alguna copió el ' +
            'dominio a mano.',
        );
        salida = 1;
      }

      // 7f · Y la canónica de la página es **exactamente** su URL del sitemap:
      // dos formas distintas de la misma página son dos URLs para Google.
      if (canonical && suUrl && canonical[1] !== suUrl) {
        fallo(
          `la canónica de la página (${canonical[1]}) no es la URL que el sitemap ofrece ` +
            `(${suUrl}).`,
        );
        salida = 1;
      }

      // 7g · El Open Graph, que es la otra mitad de B-107: un link pegado en
      // Instagram sin `og:` se ve como un link pelado.
      for (const propiedad of ['og:title', 'og:url', 'og:site_name']) {
        if (!htmlPublicada.includes(`property="${propiedad}"`)) {
          fallo(`la página de la publicada no lleva ${propiedad}.`);
          salida = 1;
        }
      }

      // 7h · `/pasadas` existe y no publica el borrador. El fixture publicado es
      // de mañana, así que el archivo sale vacío — y eso también se afirma.
      const htmlPasadas = await leerDist('pasadas/index.html');
      if (htmlPasadas === null) {
        fallo(
          'no se generó dist/pasadas/index.html.\n' +
            '  Es la única página que enlaza una actividad que ya pasó una vez que su\n' +
            '  entrada del sitemap venció a los 90 días (§2.1).',
        );
        salida = 1;
      } else if (htmlPasadas.includes(SLUG_BORRADOR) || htmlPasadas.includes(SLUG_CANCELADA)) {
        fallo(
          '/pasadas publica un borrador o una cancelada.\n' +
            '  Recibe `EntradaDeIndice[]`, así que ninguno de los dos debería poder llegar (§7.3).',
        );
        salida = 1;
      }
    }

    /*
     * 8 · **B-296 — la galería de tres imágenes, sobre el HTML construido.**
     *
     * Los unitarios de `tests/galeria-del-detalle.test.ts` afirman sobre el
     * fuente de la plantilla: que dice `alt=""`, que dice `loading="lazy"`, que
     * la proporción sale de `estiloDeAfiche`. Ninguno puede ver el resultado de
     * pasarle **tres medidas distintas** por ahí, porque la plantilla no se
     * renderiza en vitest. Lo que se mira acá es lo que un navegador va a recibir:
     * tres `<img>`, tres cajas distintas, un solo `eager`, un solo `alt` con
     * texto, y el epígrafe donde tiene que estar.
     *
     * Y el control que sostiene todo el ítem: **la página de una sola imagen
     * sigue teniendo una sola imagen y ninguna sección de galería**. Es el 87 % de
     * las actividades con imagen y es lo primero que rompería un `slice(0)`.
     */
    const htmlGaleria = await htmlDe(SLUG_GALERIA);
    if (htmlGaleria === null) {
      fallo(
        `no se generó dist/actividad/${SLUG_GALERIA}/index.html.\n` +
          '  Es la actividad con tres imágenes de B-296.',
      );
      salida = 1;
    } else {
      const imgs = htmlGaleria.match(/<img\b[^>]*>/g) ?? [];
      const delPanel = imgs.filter((i) => i.includes('example.invalid/gate-'));

      // 8a · Las tres están. Antes de B-296 salía **una**.
      if (delPanel.length !== 3) {
        fallo(
          `la página con tres imágenes cargadas pinta ${delPanel.length}.\n` +
            '  Es el bug de B-296: `imagenes[0]` mostraba una sola y las otras no aparecían\n' +
            '  en ninguna salida del sitio.',
        );
        salida = 1;
      }

      // 8b · Arriba va la **marcada** como portada, que en el fixture es la
      // segunda del array (B-268, y su consecuencia nueva).
      if (delPanel[0] && !delPanel[0].includes('gate-vertical')) {
        fallo(
          'la primera imagen de la página no es la marcada como portada.\n' +
            '  El fixture la puso segunda en el array a propósito: si el orden del array\n' +
            '  decide, el flyer baja a la tira como miniatura decorativa (B-268).',
        );
        salida = 1;
      }

      // 8c · Un solo `eager`, y es esa. Lo demás, diferido.
      const eager = delPanel.filter((i) => i.includes('loading="eager"'));
      const lazy = delPanel.filter((i) => i.includes('loading="lazy"'));
      if (eager.length !== 1 || !eager[0]?.includes('gate-vertical') || lazy.length !== 2) {
        fallo(
          `la página pide ${eager.length} imagen(es) temprano y difiere ${lazy.length}.\n` +
            '  Tiene que ser una sola `eager` —la portada— y las secundarias en `lazy`: sin\n' +
            '  la Function de recompresión (B-220), la actividad peor medida de producción\n' +
            '  suma 3,15 MB entre sus tres archivos y 2,1 MB de eso son secundarias.',
        );
        salida = 1;
      }

      // 8d · Un solo texto alternativo con contenido, y es el de la portada. Las
      // secundarias van con `alt=""` (D-168): el mismo alt tres veces es peor
      // que no tenerlo.
      const conAlt = delPanel.filter((i) => /alt="[^"]+"/.test(i));
      const vacios = delPanel.filter((i) => i.includes('alt=""'));
      if (conAlt.length !== 1 || !conAlt[0]?.includes('gate-vertical') || vacios.length !== 2) {
        fallo(
          `la página tiene ${conAlt.length} imagen(es) con texto alternativo y ${vacios.length} ` +
            'con `alt=""`.\n' +
            '  Tiene que ser uno y dos: el título de la actividad describe la portada, y\n' +
            '  repetido en las tres no distingue ninguna para un lector de pantalla (D-168).',
        );
        salida = 1;
      }
      if ((htmlGaleria.match(/alt="Imagen de /g) ?? []).length !== 1) {
        fallo('el «Imagen de …» del texto alternativo aparece más de una vez en la página.');
        salida = 1;
      }

      // 8e · **Tres cajas distintas, ninguna recortada** (D-147). Es lo que no
      // puede ver ningún unitario: son tres medidas pasando por la misma
      // plantilla, y el bug sería que todas salieran con la misma proporción.
      const proporciones = [...htmlGaleria.matchAll(/aspect-ratio:\s*([^";]+)/g)].map((m) =>
        m[1].trim(),
      );
      const esperadas = ['1080 / 1350', '1408 / 768', '1024 / 1024'];
      const faltan = esperadas.filter((p) => !proporciones.includes(p));
      if (faltan.length > 0) {
        fallo(
          `faltan cajas reservadas en la página: ${faltan.join(', ')}.\n` +
            `  Salieron [${proporciones.join(', ')}]. Cada imagen reserva **su** proporción\n` +
            '  (D-147): una sola para las tres es una caja fija, y una caja fija recorta o\n' +
            '  encoge según la forma del archivo.',
        );
        salida = 1;
      }
      if (htmlGaleria.includes('object-cover')) {
        fallo('la página con tres imágenes recorta alguna: apareció `object-cover` (D-147).');
        salida = 1;
      }

      // 8f · La sección: el rótulo que anuncia el grupo, el epígrafe como
      // `figcaption` de su imagen, y ni un enlace que agregue una parada de
      // tabulación.
      const seccion = /<section[^>]*aria-labelledby="mas-imagenes"[\s\S]*?<\/section>/.exec(
        htmlGaleria,
      )?.[0];
      if (!seccion) {
        fallo('la página con tres imágenes no lleva la sección de las secundarias.');
        salida = 1;
      } else {
        if (!/imágenes/i.test(seccion)) {
          fallo(
            'la sección no anuncia que hay más imágenes.\n' +
              '  Es la mitad que hace aceptable el `alt=""`: las secundarias son\n' +
              '  decorativas, así que **este encabezado es lo único** que le dice a quien\n' +
              '  escucha la página que el grupo existe (D-168). Sin él, el grupo desaparece\n' +
              '  del árbol de accesibilidad.\n' +
              '  Se afirma el plural y no el texto exacto: B-302 cambió «Dos imágenes más»\n' +
              '  por «Más imágenes» y esta comprobación no tenía por qué caerse con eso.',
          );
          salida = 1;
        }
        if (!/<figcaption[^>]*>[^<]*gate\.imagenes\.epigrafe/.test(seccion)) {
          fallo(
            'el epígrafe de la secundaria no salió como `figcaption`.\n' +
              '  Tiene que ser el pie de **su** imagen y no texto suelto debajo de la fila.',
          );
          salida = 1;
        }
        /*
         * **Este aserto decía lo contrario hasta B-720, y lo cambió el dueño.**
         * Prohibía cualquier enlace en la tira, con dos motivos: que la página
         * tenía un presupuesto de 0 KB de JavaScript, y que un enlace al JPEG
         * suelto agrega una parada de tabulación que no lleva a ninguna parte.
         *
         * Los dos se reencuadran, no se descartan. La página tiene ahora **una**
         * island (`VisorDeGaleria`, `client:idle`) porque el dueño pidió recorrer
         * las fotos en grande. Y el enlace al archivo **es el fallback deliberado
         * de esa island**: con JavaScript apagado, abrir la imagen es lo mejor
         * que se puede ofrecer, y es la condición que se le puso al frente —el
         * HTML del build no puede depender de la island—. Con JavaScript, el
         * visor intercepta el click y no se navega a ninguna parte.
         *
         * Así que lo que se verifica es **el patrón completo**: que cada imagen
         * secundaria sea un enlace a su propio archivo (el fallback) y que la
         * island esté en la página (el enhancement). Falta cualquiera de los dos
         * y queda una de las dos mitades malas: un enlace crudo al binario, o una
         * tira muerta para quien navega con teclado.
         */
        const enlaces = [...seccion.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
        const alArchivo = enlaces.filter((href) =>
          /\.(jpe?g|png|webp|avif)(\?|$)/i.test(href),
        );
        if (enlaces.length !== alArchivo.length) {
          fallo(
            'la tira de secundarias tiene un enlace que no apunta a su imagen:\n' +
              enlaces
                .filter((h) => !alArchivo.includes(h))
                .map((h) => `    ${h}`)
                .join('\n'),
          );
          salida = 1;
        }
        if (alArchivo.length > 0 && !/VisorDeGaleria|visor-de-galeria/i.test(htmlGaleria)) {
          fallo(
            'la tira enlaza a los archivos y el visor NO está en la página.\n' +
              '  Sin la island, cada enlace lleva al JPEG y deja a quien navega con teclado\n' +
              '  afuera del sitio: el fallback quedó sin su enhancement (B-720).',
          );
          salida = 1;
        }
      }

      /*
       * 8g · **El barrido de centinelas sobre la salida NUEVA.** Lo encontró el
       * `auditor-privacidad`: el fixture pone `storagePath` en las tres imágenes
       * y lo justifica diciendo «el barrido de abajo tiene que cubrir la salida
       * nueva», y el barrido no estaba. El del paso 4 corre sobre la **cancelada**,
       * que tiene una sola imagen y por lo tanto no genera la sección; y el de
       * vitest corre sobre el view-model, así que por construcción no puede ver
       * nada que la plantilla emita **solo para las secundarias**.
       *
       * Modo de falla concreto que esto ataja: un `data-id={imagen.id}` o un
       * `title={imagen.storagePath}` agregado mañana al `<img>` de la tira.
       *
       * Va también sobre la **publicada**, que tampoco se barría: hasta acá el
       * único HTML barrido era el de la cancelada.
       */
      for (const [nombre, html] of [
        ['con tres imágenes', htmlGaleria],
        ['publicada', htmlPublicada],
      ]) {
        if (!html) continue;
        const filtrados = Object.entries(CENTINELA).filter(
          ([campo, v]) => !CENTINELA_DEL_DETALLE.includes(campo) && html.includes(v),
        );
        if (filtrados.length > 0) {
          fallo(
            `la página ${nombre} publica campos privados:\n` +
              filtrados.map(([campo, valor]) => `    ${campo} → ${valor}`).join('\n'),
          );
          salida = 1;
        }
      }

      // 8h · **El control de la mayoría**: con una sola imagen, la página es la
      // de antes. Ni una imagen de más, ni una sección vacía.
      const imgsPublicada = (htmlPublicada?.match(/<img\b[^>]*>/g) ?? []).filter((i) =>
        i.includes('example.invalid/gate.jpg'),
      );
      if (imgsPublicada.length !== 1 || htmlPublicada?.includes('mas-imagenes')) {
        fallo(
          `la página con UNA sola imagen pinta ${imgsPublicada.length} y ` +
            `${htmlPublicada?.includes('mas-imagenes') ? 'sí' : 'no'} lleva la sección de galería.\n` +
            '  26 de las 30 actividades con imagen tienen exactamente una (medido el\n' +
            '  2026-09-02): ese caso no puede cambiar por una galería que casi nunca tiene\n' +
            '  qué mostrar. Un `slice(0)` en vez de `slice(1)` la pinta dos veces.',
        );
        salida = 1;
      }
    }

    /*
     * 8i · **B-901 — el directorio de librerías, sobre los archivos construidos.**
     *
     * (Se llama **8i** y no 8h porque el rótulo estaba tomado: el «control de la
     * mayoría» de la galería es el 8h, y `docs/13-agentes.md` cita «los pasos
     * 8a-8h» contando aquél. Dos pasos con el mismo nombre no rompen el gate
     * —son comentarios— pero mandan a leer el que no es.)
     *
     * Lo que este bloque puede ver y ningún unitario puede: que la **lectura**
     * trajo solo lo publicado y que el **build** escribió la ficha. El barrido de
     * vitest mira la proyección pura —qué se decide publicar— y no puede saber si
     * `getStaticPaths` generó la página ni si la query pidió de más.
     *
     * La pendiente es el control: con una sola librería sembrada, un build que
     * leyera la colección entera daría exactamente el mismo `dist/`.
     */
    {
      const crudoLibrerias = await readFile(
        new URL('../dist/librerias.json', import.meta.url),
        'utf8',
      ).catch(() => null);

      if (crudoLibrerias === null) {
        fallo(
          'no se escribió dist/librerias.json.\n' +
            '  Es el índice que baja el listado de /guia/librerias: sin él, la sección\n' +
            '  carga el HTML del build y los filtros quedan apagados para siempre.',
        );
        salida = 1;
      } else {
        const indiceLibrerias = JSON.parse(crudoLibrerias);
        const slugsLibrerias = (indiceLibrerias.librerias ?? []).map((l) => l.slug);

        // 8i.1 · El build tiene que haber LEÍDO algo. Sin esto, los dos asertos de
        // abajo pasan en verde sobre una lista vacía.
        if (!slugsLibrerias.includes(SLUG_LIBRERIA)) {
          fallo(
            `dist/librerias.json salió con ${slugsLibrerias.length} librerías y ninguna es la\n` +
              '  sembrada. El build no leyó /librerias, así que todo lo que sigue no prueba nada.',
          );
          salida = 1;
        }

        // 8i.2 · **B-903** — el control del `where`. La pendiente no puede estar.
        if (slugsLibrerias.includes(SLUG_LIBRERIA_PENDIENTE)) {
          fallo(
            'dist/librerias.json trae la librería que ESPERA DECISIÓN.\n' +
              "  Falta o está mal el where('estado','==','publicado') de libreriasPublicadas\n" +
              '  (src/lib/contenidoDelSitio.ts). Y lo que se publica con ella es el\n' +
              '  contactoDeQuienCargo de quien pidió el alta (B-903).',
          );
          salida = 1;
        }

        // 8i.3 · La ficha existe en disco, y la de la pendiente no.
        const fichaPublicada = await readFile(
          new URL(`../dist/guia/librerias/${SLUG_LIBRERIA}/index.html`, import.meta.url),
          'utf8',
        ).catch(() => null);
        if (fichaPublicada === null) {
          fallo(
            `no se generó la página /guia/librerias/${SLUG_LIBRERIA}/.\n` +
              '  El listado la linkea igual: sin la página, cada fila del directorio es un 404.',
          );
          salida = 1;
        } else if (!fichaPublicada.includes('"@type":"BookStore"')) {
          fallo(
            'la ficha de la librería no emite el JSON-LD `BookStore`.\n' +
              '  Es el SEO de esta sección entera (§ 4 del PRD 2): sin el marcado, la ficha\n' +
              '  es una página más y no entra al panel local de Google.',
          );
          salida = 1;
        }

        const fichaPendiente = await readFile(
          new URL(`../dist/guia/librerias/${SLUG_LIBRERIA_PENDIENTE}/index.html`, import.meta.url),
          'utf8',
        ).catch(() => null);
        if (fichaPendiente !== null) {
          fallo(
            `se generó la página de la librería que ESPERA DECISIÓN\n` +
              `  (/guia/librerias/${SLUG_LIBRERIA_PENDIENTE}/). Es HTML indexable con el\n` +
              '  contenido de una ficha que nadie aprobó.',
          );
          salida = 1;
        }

        // 8i.4 · Y la URL de la ficha está en el sitemap — §6 #7 del inventario:
        // la página existe y Google no la ve. No falla nada y no se ve.
        const sitemapLibrerias = await readFile(
          new URL('../dist/sitemap.xml', import.meta.url),
          'utf8',
        );
        if (!sitemapLibrerias.includes(`/guia/librerias/${SLUG_LIBRERIA}/`)) {
          fallo(
            'la ficha de la librería no está en el sitemap.xml.\n' +
              '  Existe, se navega, y el buscador no la conoce (§6 #7 del inventario de PRDs).',
          );
          salida = 1;
        }
        if (sitemapLibrerias.includes(`/guia/librerias/${SLUG_LIBRERIA_PENDIENTE}/`)) {
          fallo(
            'el sitemap.xml ofrece la ficha de la librería que espera decisión: es una URL\n' +
              '  que contesta 404 y que además no tendría que existir.',
          );
          salida = 1;
        }

        if (salida === 0) {
          console.log(
            '  ✓ el directorio de librerías salió con la publicada y sin la que espera decisión ' +
              '(B-903), con su ficha, su BookStore y su entrada de sitemap.',
          );
        }
      }
    }

    /*
     * 8j · **B-832 — el directorio de suscripciones, sobre los archivos
     * construidos.**
     *
     * Lo mismo que el 8i una colección más abajo, y **una cosa que ninguna otra
     * tiene: el precio**. DEC-12 dice que el monto no se muestra nunca sin su
     * fecha de carga, y esa garantía la da la forma —`fraseDePrecio` devuelve un
     * solo string— pero eso lo verifica un unitario sobre la función pura. Acá se
     * verifica sobre **lo que quedó escrito en el `dist/`**: que el monto
     * formateado del gate no aparezca en ningún archivo sin «cargado el» pegado.
     * Es la diferencia entre «la función lo hace bien» y «la página lo dice bien».
     */
    {
      const crudoSuscripciones = await readFile(
        new URL('../dist/suscripciones.json', import.meta.url),
        'utf8',
      ).catch(() => null);

      if (crudoSuscripciones === null) {
        fallo(
          'no se escribió dist/suscripciones.json.\n' +
            '  Es el índice que baja el listado de /guia/suscripciones: sin él, la sección\n' +
            '  carga el HTML del build y los filtros quedan apagados para siempre.',
        );
        salida = 1;
      } else {
        const indiceSus = JSON.parse(crudoSuscripciones);
        const slugsSus = (indiceSus.suscripciones ?? []).map((s) => s.slug);

        // 8j.1 · El build tiene que haber LEÍDO algo.
        if (!slugsSus.includes(SLUG_SUSCRIPCION)) {
          fallo(
            `dist/suscripciones.json salió con ${slugsSus.length} suscripciones y ninguna es la\n` +
              '  sembrada. El build no leyó /suscripciones, así que nada de lo que sigue prueba nada.',
          );
          salida = 1;
        }

        // 8j.2 · El control del `where`: la pendiente no puede estar.
        if (slugsSus.includes(SLUG_SUSCRIPCION_PENDIENTE)) {
          fallo(
            'dist/suscripciones.json trae la suscripción que ESPERA DECISIÓN.\n' +
              "  Falta o está mal el where('estado','==','publicado') de suscripcionesPublicadas\n" +
              '  (src/lib/contenidoDelSitio.ts). Y con ella se publica el contactoDeQuienCargo\n' +
              '  de quien pidió el alta, y el precio crudo.',
          );
          salida = 1;
        }

        // 8j.3 · La ficha existe en disco, y la de la pendiente no.
        const fichaSus = await readFile(
          new URL(`../dist/guia/suscripciones/${SLUG_SUSCRIPCION}/index.html`, import.meta.url),
          'utf8',
        ).catch(() => null);
        if (fichaSus === null) {
          fallo(
            `no se generó la página /guia/suscripciones/${SLUG_SUSCRIPCION}/.\n` +
              '  El listado la linkea igual: sin la página, cada fila del directorio es un 404.',
          );
          salida = 1;
        } else {
          if (!fichaSus.includes('"@type":"Product"')) {
            fallo(
              'la ficha de la suscripción no emite el JSON-LD `Product`.\n' +
                '  Es el SEO de esta sección entera (§ 5 del PRD 3).',
            );
            salida = 1;
          }
          /*
           * 8j.4 · **DEC-12 — el precio en el marcado.** El § 5 del PRD lo deja
           * afuera a propósito: Google **muestra** el precio del `Offer` en el
           * resultado, y uno de tres meses se publica equivocado en el lugar de
           * más visibilidad y con la credibilidad de un dato estructurado.
           */
          const ld = fichaSus.slice(fichaSus.indexOf('"@type":"Product"'));
          const finLd = ld.indexOf('</script>');
          if (/"price"|"priceCurrency"|"priceSpecification"/.test(ld.slice(0, finLd))) {
            fallo(
              'el JSON-LD de la suscripción publica el precio.\n' +
                '  El § 5 del PRD 3 lo deja afuera a propósito (DEC-12): Google lo muestra en\n' +
                '  el resultado de búsqueda, y un precio de tres meses se publica equivocado\n' +
                '  en el lugar de más visibilidad. En la página va, con su fecha al lado.',
            );
            salida = 1;
          }
          /*
           * 8j.4b · **El `rel` del link de cobro, y las dos mitades de B-786.**
           *
           * Lo pidió el `auditor-privacidad`: el criterio 8 del PRD 3 y el § 7.2
           * —que es una decisión **discriminada**— vivían solo en un comentario
           * del `.astro`, así que nada se ponía rojo si alguien sacaba el
           * `noreferrer` del link de cobro **ni** si lo aplicaba parejo a todo
           * link externo, que **revierte B-786 sin decirlo**.
           *
           * Va sobre el HTML construido y no sobre el fuente por lo mismo que el
           * resto de este paso: el atributo lo escribe Astro, y el orden de los
           * atributos es suyo — por eso se recorta la etiqueta `<a>` y se
           * pregunta por su contenido, en vez de casar una cadena entera.
           */
          const etiquetaCon = (html, aguja) => {
            const i = html.indexOf(aguja);
            if (i === -1) return null;
            const abre = html.lastIndexOf('<a', i);
            const cierra = html.indexOf('>', i);
            return abre === -1 || cierra === -1 ? null : html.slice(abre, cierra + 1);
          };
          const accion = etiquetaCon(fichaSus, 'https://example.invalid/gate-cobro');
          if (!accion || !accion.includes('noopener') || !accion.includes('noreferrer')) {
            fallo(
              'el link de cobro de la suscripción no sale con `rel="noopener noreferrer"`.\n' +
                '  Sin `noopener`, la página de destino puede tocar la nuestra; sin `noreferrer`\n' +
                '  le mandamos nuestro dominio de referencia a la página de cobro de un tercero\n' +
                '  (§ 7.2 del PRD 3, criterio 8).',
            );
            salida = 1;
          }
          const mail = etiquetaCon(fichaSus, 'mailto:gate-sus@example.invalid');
          if (mail && mail.includes('noreferrer')) {
            fallo(
              'un contacto de la ficha salió con `noreferrer`, y eso revierte B-786 sin decirlo.\n' +
                '  El `noreferrer` es **del link de cobro y de ninguno más**: aplicarlo parejo a\n' +
                '  todo link externo borraría la señal de que un aporte vino del sitio, que es\n' +
                '  justo lo que B-786 decidió conservar.',
            );
            salida = 1;
          }

          // Y la ficha enlaza la librería que la ofrece, que es lo que confirma
          // que el build resolvió la lista y no linkeó a ciegas.
          if (!fichaSus.includes(`/guia/librerias/${SLUG_LIBRERIA}/`)) {
            fallo(
              'la ficha de la suscripción no enlaza la librería publicada que la ofrece.\n' +
                '  O el build no resolvió la lista de librerías, o la está linkeando a ciegas.',
            );
            salida = 1;
          }
        }

        const fichaSusPendiente = await readFile(
          new URL(
            `../dist/guia/suscripciones/${SLUG_SUSCRIPCION_PENDIENTE}/index.html`,
            import.meta.url,
          ),
          'utf8',
        ).catch(() => null);
        if (fichaSusPendiente !== null) {
          fallo(
            `se generó la página de la suscripción que ESPERA DECISIÓN\n` +
              `  (/guia/suscripciones/${SLUG_SUSCRIPCION_PENDIENTE}/). Es HTML indexable con el\n` +
              '  contenido de una ficha que nadie aprobó.',
          );
          salida = 1;
        }

        // 8j.5 · La URL en el sitemap, y la pendiente afuera.
        const sitemapSus = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
        if (!sitemapSus.includes(`/guia/suscripciones/${SLUG_SUSCRIPCION}/`)) {
          fallo(
            'la ficha de la suscripción no está en el sitemap.xml.\n' +
              '  Existe, se navega, y el buscador no la conoce (§6 #7 del inventario de PRDs).',
          );
          salida = 1;
        }
        if (sitemapSus.includes(`/guia/suscripciones/${SLUG_SUSCRIPCION_PENDIENTE}/`)) {
          fallo(
            'el sitemap.xml ofrece la ficha de la suscripción que espera decisión: es una URL\n' +
              '  que contesta 404 y que además no tendría que existir.',
          );
          salida = 1;
        }

        /*
         * 8j.6 · **DEC-12 sobre el `dist/` entero: el monto no aparece nunca solo.**
         *
         * Es el ítem de este paso que no tiene equivalente en ningún unitario. La
         * garantía la da la forma —`fraseDePrecio` devuelve **un** string con las
         * dos cosas— y los unitarios la verifican sobre la función pura; acá se
         * verifica sobre **lo que quedó escrito**: cada aparición del monto del
         * gate en cualquier archivo publicado tiene que traer «cargado el» pegado.
         *
         * Es el modo de falla que D-570 anticipa y que una función pura no puede
         * impedir: que alguien, en una plantilla o en una island, arme la frase por
         * su cuenta y pinte el número solo «porque en la tarjeta angosta no entra
         * la fecha».
         */
        const MONTO_DEL_GATE = (18246813).toLocaleString('es-AR');
        const DIST = new URL('../dist/', import.meta.url);
        const huerfanos = [];
        for (const relativa of await readdir(DIST, { recursive: true })) {
          if (!/\.(html|json|txt|xml)$/.test(relativa)) continue;
          const contenido = await readFile(new URL(relativa, DIST), 'utf8').catch(() => '');
          let desde = contenido.indexOf(MONTO_DEL_GATE);
          while (desde !== -1) {
            // La ventana es generosa a propósito: entre el número y la fecha puede
            // haber el período, el separador y el escape de una entidad HTML.
            const ventana = contenido.slice(desde, desde + 160);
            if (!ventana.includes('cargado el')) huerfanos.push(`    ${relativa}`);
            desde = contenido.indexOf(MONTO_DEL_GATE, desde + 1);
          }
        }
        if (huerfanos.length > 0) {
          fallo(
            'el precio de una suscripción salió publicado SIN su fecha de carga al lado.\n' +
              '  Es DEC-12: un precio de hace tres meses en este país ya no es cierto, y la\n' +
              '  fecha es lo único que deja que quien lee decida si le cree. La proyección\n' +
              '  devuelve UNA frase con las dos cosas; si acá aparece el número solo, alguien\n' +
              '  la rearmó en una plantilla o en una island.\n' +
              `  Archivos:\n${[...new Set(huerfanos)].join('\n')}`,
          );
          salida = 1;
        }
        // Y el control positivo: el monto **tiene** que aparecer en alguna parte.
        // Sin esto, el barrido de arriba pasa en verde si el precio dejó de
        // publicarse — que es el otro error, y también en silencio.
        const conPrecio = (await readdir(DIST, { recursive: true })).filter((r) =>
          /\.(html|json)$/.test(r),
        );
        let apariciones = 0;
        for (const relativa of conPrecio) {
          const contenido = await readFile(new URL(relativa, DIST), 'utf8').catch(() => '');
          if (contenido.includes(MONTO_DEL_GATE)) apariciones += 1;
        }
        if (apariciones === 0) {
          fallo(
            'el precio de la suscripción sembrada no aparece en ningún archivo del dist/.\n' +
              '  O dejó de publicarse, o el barrido de arriba no estaba mirando nada.',
          );
          salida = 1;
        }

        if (salida === 0) {
          console.log(
            '  ✓ el directorio de suscripciones salió con la publicada y sin la que espera ' +
              `decisión, con su ficha, su Product sin precio, su entrada de sitemap y el ` +
              `monto siempre con su fecha (${apariciones} archivos).`,
          );
        }
      }
    }

    /*
     * 8k · **B-833 — el directorio de lugares, sobre los archivos construidos.**
     *
     * Lo mismo que el 8i y el 8j una colección más abajo, y **una cosa que
     * ninguna otra tiene: una ausencia condicional**. La casa del gate está
     * publicada —su ficha se genera, su página se indexa— y su dirección no puede
     * estar en ningún archivo. Eso lo verifica el barrido del paso 9 sin cláusula
     * especial (el centinela no está en ninguna canasta); acá se verifica la otra
     * mitad, que es la que un barrido de ausencias no puede dar: **que la ficha de
     * la casa exista de verdad**. Sin ella, el paso 9 pasaría en verde por no
     * haber mirado nada.
     */
    {
      const crudoLugares = await readFile(
        new URL('../dist/lugares.json', import.meta.url),
        'utf8',
      ).catch(() => null);

      if (crudoLugares === null) {
        fallo(
          'no se escribió dist/lugares.json.\n' +
            '  Es el índice que baja el listado de /guia/lugares: sin él, la sección\n' +
            '  carga el HTML del build y los filtros quedan apagados para siempre.',
        );
        salida = 1;
      } else {
        const indiceLug = JSON.parse(crudoLugares);
        const slugsLug = (indiceLug.lugares ?? []).map((l) => l.slug);

        // 8k.1 · El build tiene que haber LEÍDO algo, y **las dos publicadas**.
        for (const slug of [SLUG_LUGAR, SLUG_LUGAR_CASA]) {
          if (!slugsLug.includes(slug)) {
            fallo(
              `dist/lugares.json salió con ${slugsLug.length} lugares y no está «${slug}».\n` +
                '  El build no leyó /lugares (o dejó una publicada afuera), así que nada de lo\n' +
                '  que sigue prueba nada — incluida la ausencia de la dirección de la casa.',
            );
            salida = 1;
          }
        }

        // 8k.2 · El control del `where`: el pendiente no puede estar.
        if (slugsLug.includes(SLUG_LUGAR_PENDIENTE)) {
          fallo(
            'dist/lugares.json trae el lugar que ESPERA DECISIÓN.\n' +
              "  Falta o está mal el where('estado','==','publicado') de lugaresPublicados\n" +
              '  (src/lib/contenidoDelSitio.ts). Y con él se publica el contactoDeQuienCargo\n' +
              '  de quien pidió el alta, y la dirección de un lugar que nadie aprobó.',
          );
          salida = 1;
        }

        // 8k.3 · Las dos fichas existen en disco, y la del pendiente no.
        const fichaLug = await readFile(
          new URL(`../dist/guia/lugares/${SLUG_LUGAR}/index.html`, import.meta.url),
          'utf8',
        ).catch(() => null);
        if (fichaLug === null) {
          fallo(
            `no se generó la página /guia/lugares/${SLUG_LUGAR}/.\n` +
              '  El listado la linkea igual: sin la página, cada fila del directorio es un 404.',
          );
          salida = 1;
        } else {
          if (!fichaLug.includes('"@type":"Place"')) {
            fallo(
              'la ficha del lugar no emite el JSON-LD `Place`.\n' +
                '  Es el SEO de esta sección entera (§ 7 del PRD 4).',
            );
            salida = 1;
          }
          /*
           * 8k.4 · **§ 7 — la condición no es un rango de precios.** El PRD lo
           * dice con todas las letras, y el precio además queda afuera del marcado
           * por lo mismo que el `Offer` de una suscripción: un número que envejece
           * publicado como dato estructurado es información equivocada en el lugar
           * de más visibilidad.
           */
          const ld = fichaLug.slice(fichaLug.indexOf('"@type":"Place"'));
          const finLd = ld.indexOf('</script>');
          if (/"priceRange"|"price"|"offers"/.test(ld.slice(0, finLd))) {
            fallo(
              'el JSON-LD del lugar publica un precio o un rango de precios.\n' +
                '  El § 7 del PRD 4 lo deja afuera a propósito: la condición no es un rango\n' +
                '  de precios, y un número que envejece publicado como dato estructurado es\n' +
                '  información equivocada donde más se ve.',
            );
            salida = 1;
          }
          // Y el control positivo del marcado: la capacidad sí está.
          if (!ld.slice(0, finLd).includes('"maximumAttendeeCapacity"')) {
            fallo(
              'el JSON-LD del lugar no publica la capacidad.\n' +
                '  Es el dato que hace que el marcado diga algo más que el nombre (§ 7).',
            );
            salida = 1;
          }
        }

        /*
         * 8k.5 · ⚠️ **La casa: su ficha EXISTE y su dirección NO está.**
         *
         * Las dos mitades van juntas y ninguna sirve sola. Que la dirección no
         * aparezca lo verifica el paso 9 en todo el `dist/`; lo que no puede ver es
         * si eso pasó porque la proyección la frenó o porque la página nunca se
         * generó. Esta mitad es la que distingue las dos cosas.
         */
        const fichaCasa = await readFile(
          new URL(`../dist/guia/lugares/${SLUG_LUGAR_CASA}/index.html`, import.meta.url),
          'utf8',
        ).catch(() => null);
        if (fichaCasa === null) {
          fallo(
            `no se generó la página /guia/lugares/${SLUG_LUGAR_CASA}/ (la casa publicada).\n` +
              '  Sin ella, el barrido del paso 9 no prueba nada sobre la dirección de una casa:\n' +
              '  no hay página donde pudiera haberse filtrado (§ 6 del PRD 4).',
          );
          salida = 1;
        } else {
          if (fichaCasa.includes(CENTINELA.lugarDireccionDeCasa)) {
            fallo(
              'LA FICHA DE LA CASA PUBLICA SU DIRECCIÓN.\n' +
                '  Es el § 6 del PRD 4: `direccionPublica` está en `false` y la dirección salió\n' +
                '  igual. Lo que se publicó es el dato con el que se llega a la puerta de\n' +
                '  alguien, cargado por alguien que puede no vivir ahí.',
            );
            salida = 1;
          }
          // Y su JSON-LD no puede llevar `address` ni `geo` — criterio 5 del PRD,
          // el camino que se filtra sin que nadie lo vea.
          const ldCasa = fichaCasa.slice(fichaCasa.indexOf('"@type":"Place"'));
          const finLdCasa = ldCasa.indexOf('</script>');
          if (/"address"|"geo"/.test(ldCasa.slice(0, finLdCasa))) {
            fallo(
              'el JSON-LD de la casa publica `address` o `geo`.\n' +
                '  Criterio 5 del PRD 4: «`direccion` ausente de la ficha implica ausente del\n' +
                '  JSON-LD». Es el camino que se filtra sin que nadie lo note, porque nadie lee\n' +
                '  el JSON-LD al revisar una ficha. Y unas coordenadas son la dirección con otro\n' +
                '  formato.',
            );
            salida = 1;
          }
          // Control positivo: el barrio **sí** está. Es el «más o menos por Villa
          // Crespo» que el § 6 deja publicar, y sin él este bloque estaría
          // afirmando ausencias sobre una página vacía.
          if (!fichaCasa.includes('gate-barrio') && !fichaCasa.includes('Gate lugar casa')) {
            fallo(
              'la ficha de la casa salió sin barrio y sin nombre: está vacía, así que las\n' +
                '  ausencias de arriba no prueban nada.',
            );
            salida = 1;
          }
        }

        const fichaLugPendiente = await readFile(
          new URL(`../dist/guia/lugares/${SLUG_LUGAR_PENDIENTE}/index.html`, import.meta.url),
          'utf8',
        ).catch(() => null);
        if (fichaLugPendiente !== null) {
          fallo(
            `se generó la página del lugar que ESPERA DECISIÓN\n` +
              `  (/guia/lugares/${SLUG_LUGAR_PENDIENTE}/). Es HTML indexable con el contenido\n` +
              '  de una ficha que nadie aprobó.',
          );
          salida = 1;
        }

        /*
         * 8k.7 · ⚠️ **La `geo` de la casa tampoco está, y se busca por valor.**
         *
         * Lo pidió el `auditor-privacidad`: el barrido del paso 9 mira strings
         * centinela, y una coordenada es un número. Sin este chequeo, una fuga de
         * la `geo` de una casa al índice —el archivo que baja todo el mundo—
         * pasaría el gate entero, y es la mitad del § 6 que más silenciosa se
         * publica: unas coordenadas son la dirección con otro formato.
         *
         * Se barre **todo** el `dist/` y no solo el índice, por lo mismo que el
         * barrido del monto: una plantilla puede escribirla en cualquier parte.
         */
        const DIST_LUG = new URL('../dist/', import.meta.url);
        const conLaGeo = [];
        for (const relativa of await readdir(DIST_LUG, { recursive: true })) {
          if (!/\.(html|json|txt|xml)$/.test(relativa)) continue;
          const contenido = await readFile(new URL(relativa, DIST_LUG), 'utf8').catch(() => '');
          if (contenido.includes(String(LAT_DE_LA_CASA))) conLaGeo.push(`    ${relativa}`);
        }
        if (conLaGeo.length > 0) {
          fallo(
            'LAS COORDENADAS DE LA CASA SE PUBLICARON.\n' +
              '  Es el § 6 del PRD 4: `direccionPublica` está en `false` y la `geo` salió igual.\n' +
              '  Unas coordenadas son la dirección con otro formato, y con un mapa al lado el\n' +
              '  «más o menos por Villa Crespo» deja de ser más o menos.\n' +
              `  Archivos:\n${[...new Set(conLaGeo)].join('\n')}`,
          );
          salida = 1;
        }
        // Control positivo: la `geo` del local publicado **sí** aparece. Sin esto,
        // el barrido de arriba pasaría en verde el día que la proyección dejara de
        // publicar toda `geo` — que es el otro error, y también en silencio.
        if (!crudoLugares.includes('-34.5875')) {
          fallo(
            'la `geo` del lugar publicado no aparece en dist/lugares.json.\n' +
              '  O dejó de publicarse, o el barrido de arriba no estaba mirando nada.',
          );
          salida = 1;
        }

        // 8k.6 · Las URLs en el sitemap, y el pendiente afuera.
        const sitemapLug = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
        for (const slug of [SLUG_LUGAR, SLUG_LUGAR_CASA]) {
          if (!sitemapLug.includes(`/guia/lugares/${slug}/`)) {
            fallo(
              `la ficha /guia/lugares/${slug}/ no está en el sitemap.xml.\n` +
                '  Existe, se navega, y el buscador no la conoce (§6 #7 del inventario de PRDs).',
            );
            salida = 1;
          }
        }
        if (sitemapLug.includes(`/guia/lugares/${SLUG_LUGAR_PENDIENTE}/`)) {
          fallo(
            'el sitemap.xml ofrece la ficha del lugar que espera decisión: es una URL\n' +
              '  que contesta 404 y que además no tendría que existir.',
          );
          salida = 1;
        }

        if (salida === 0) {
          console.log(
            '  ✓ el directorio de lugares salió con los dos publicados y sin el que espera ' +
              'decisión, con sus fichas, su Place sin precio, sus entradas de sitemap — y la ' +
              'casa publicada sin su dirección y sin sus coordenadas en ningún archivo (§ 6).',
          );
        }
      }
    }

    /*
     * 8l · **B-960 — el directorio de bibliotecas, sobre los archivos
     * construidos.**
     *
     * Lo mismo que el 8i/8j/8k una colección más abajo, y **entró tarde**: el
     * frente construyó la sección entera y no tocó este archivo, así que hasta el
     * pase de auditores el gate no sembraba ninguna biblioteca. Eso no dejaba el
     * barrido laxo: lo dejaba **vacío** — el paso 9 recorría
     * `dist/bibliotecas.json` y `dist/guia/bibliotecas/**` sin que existiera un
     * solo centinela de esta colección que pudiera aparecer ahí, y pasaba
     * trivialmente. Un barrido sin nada que encontrar es verde por vacuidad.
     *
     * Lo propio de esta colección es **el costo de asociarse**: es un dato con
     * fecha (D-570, B-837) y la garantía es que salga como **frase con su fecha
     * pegada** y nunca como número suelto ni como `Offer` del JSON-LD, por el
     * mismo motivo que el precio de una suscripción (DEC-12).
     */
    {
      const crudoBib = await readFile(
        new URL('../dist/bibliotecas.json', import.meta.url),
        'utf8',
      ).catch(() => null);

      if (crudoBib === null) {
        fallo(
          'no se escribió dist/bibliotecas.json.\n' +
            '  Es el índice que baja el listado de /guia/bibliotecas: sin él, la sección\n' +
            '  carga el HTML del build y los filtros quedan apagados para siempre.',
        );
        salida = 1;
      } else {
        const indiceBib = JSON.parse(crudoBib);
        const slugsBib = (indiceBib.bibliotecas ?? []).map((b) => b.slug);

        // 8l.1 · El build tiene que haber LEÍDO algo.
        if (!slugsBib.includes(SLUG_BIBLIOTECA)) {
          fallo(
            `dist/bibliotecas.json salió con ${slugsBib.length} bibliotecas y ninguna es la\n` +
              '  sembrada. El build no leyó /bibliotecas, así que nada de lo que sigue prueba nada.',
          );
          salida = 1;
        }

        // 8l.2 · El control del `where`: la pendiente no puede estar.
        if (slugsBib.includes(SLUG_BIBLIOTECA_PENDIENTE)) {
          fallo(
            'dist/bibliotecas.json trae la biblioteca que ESPERA DECISIÓN.\n' +
              "  Falta o está mal el where('estado','==','publicado') de bibliotecasPublicadas\n" +
              '  (src/lib/contenidoDelSitio.ts). Y con ella se publica el contactoDeQuienCargo\n' +
              '  de quien la cargó, que es un dato de una persona y no de la institución.',
          );
          salida = 1;
        }

        // 8l.3 · La ficha existe en disco, y la de la pendiente no.
        const fichaBib = await readFile(
          new URL(`../dist/guia/bibliotecas/${SLUG_BIBLIOTECA}/index.html`, import.meta.url),
          'utf8',
        ).catch(() => null);
        if (fichaBib === null) {
          fallo(
            `no se generó la página /guia/bibliotecas/${SLUG_BIBLIOTECA}/.\n` +
              '  El listado la linkea igual: sin la página, cada fila del directorio es un 404.',
          );
          salida = 1;
        } else {
          if (!fichaBib.includes('"@type":"Library"')) {
            fallo(
              'la ficha de la biblioteca no emite el JSON-LD `Library`.\n' +
                '  Es el SEO de esta sección entera.',
            );
            salida = 1;
          }
          /*
           * 8l.4 · **El costo de asociarse no va al marcado.** Mismo argumento
           * que DEC-12 para el precio de una suscripción: Google **muestra** el
           * precio de un `Offer` en el resultado, y un carnet de hace tres meses
           * se publica equivocado en el lugar de más visibilidad y con la
           * credibilidad de un dato estructurado. En la página va, con su fecha
           * al lado.
           */
          const ldBib = fichaBib.slice(fichaBib.indexOf('"@type":"Library"'));
          const finLdBib = ldBib.indexOf('</script>');
          if (/"price"|"priceCurrency"|"priceRange"|"offers"/i.test(ldBib.slice(0, finLdBib))) {
            fallo(
              'el JSON-LD de la biblioteca publica el costo de asociarse.\n' +
                '  Queda afuera a propósito, por el mismo motivo que el precio de una\n' +
                '  suscripción (DEC-12). En la página va, como frase y con su fecha.',
            );
            salida = 1;
          }
        }

        /*
         * 8l.5 · **El costo sale como frase con su fecha, nunca como número
         * suelto** — B-837, D-570, y el mismo modo de falla que el 8j persigue
         * con el precio de una suscripción: que alguien rearme la frase en una
         * plantilla o en una island y pinte el número solo «porque en la tarjeta
         * angosta no entra la fecha».
         *
         * Va con **ventana alrededor de cada aparición** y sobre **todo** el
         * `dist/`, y no con un `includes` sobre la ficha: preguntar si la página
         * tiene «cargado el» en alguna parte da verde aunque el monto esté suelto
         * en otro lado de esa misma página, y no mira el listado ni el JSON. La
         * primera versión de este paso hacía justamente eso — un chequeo laxo con
         * forma de red, que es lo que este gate existe para no tener.
         */
        const COSTO_DEL_GATE = '$3.000';
        const DIST_BIB = new URL('../dist/', import.meta.url);
        const costosHuerfanos = [];
        let vistoElCosto = false;
        for (const relativa of await readdir(DIST_BIB, { recursive: true })) {
          if (!/\.(html|json|txt|xml)$/.test(relativa)) continue;
          const contenido = await readFile(new URL(relativa, DIST_BIB), 'utf8').catch(() => '');
          let desde = contenido.indexOf(COSTO_DEL_GATE);
          while (desde !== -1) {
            vistoElCosto = true;
            // Misma ventana generosa que el 8j: entre el número y la fecha puede
            // haber el período, el separador y el escape de una entidad HTML.
            const ventana = contenido.slice(desde, desde + 160);
            if (!ventana.includes('cargado el')) costosHuerfanos.push(`    ${relativa}`);
            desde = contenido.indexOf(COSTO_DEL_GATE, desde + 1);
          }
        }
        if (costosHuerfanos.length > 0) {
          fallo(
            'el costo de asociarse a una biblioteca salió publicado SIN su fecha de carga.\n' +
              '  D-570 y B-837: un carnet de hace tres meses en este país ya no cuesta lo\n' +
              '  mismo, y la fecha es lo único que deja que quien lee decida si le cree. La\n' +
              '  proyección devuelve UNA frase con las dos cosas; si acá aparece el número\n' +
              '  solo, alguien la rearmó en una plantilla o en una island.\n' +
              `  Archivos:\n${[...new Set(costosHuerfanos)].join('\n')}`,
          );
          salida = 1;
        }
        /*
         * Y el control positivo, por lo mismo que lo tiene el 8j: sin esto el
         * barrido de arriba pasa en verde el día que el costo deje de publicarse,
         * que es la otra mitad del error.
         */
        if (!vistoElCosto) {
          fallo(
            'el costo de asociarse del gate no aparece en ningún archivo del dist/.\n' +
              '  O la ficha dejó de publicarlo, o cambió de forma: en los dos casos el\n' +
              '  chequeo de la fecha de arriba quedó sin nada que mirar.',
          );
          salida = 1;
        }

        const fichaBibPendiente = await readFile(
          new URL(
            `../dist/guia/bibliotecas/${SLUG_BIBLIOTECA_PENDIENTE}/index.html`,
            import.meta.url,
          ),
          'utf8',
        ).catch(() => null);
        if (fichaBibPendiente !== null) {
          fallo(
            `se generó la página /guia/bibliotecas/${SLUG_BIBLIOTECA_PENDIENTE}/.\n` +
              '  Es la ficha de una biblioteca que NADIE revisó: la cargó un desconocido y\n' +
              '  está publicada en HTML indexable, con el nombre y la dirección que tipeó.',
          );
          salida = 1;
        }

        /*
         * 8l.6 · **La ficha entra al sitemap, y la pendiente no.** Es la mitad
         * que faltaba del hallazgo: `sitemap.ts` no tenía a bibliotecas, así que
         * el listado entraba y las fichas no.
         */
        const sitemapBib = await readFile(
          new URL('../dist/sitemap.xml', import.meta.url),
          'utf8',
        ).catch(() => null);
        if (sitemapBib !== null) {
          if (!sitemapBib.includes(`/guia/bibliotecas/${SLUG_BIBLIOTECA}/`)) {
            fallo(
              'la ficha de la biblioteca publicada no está en el sitemap.\n' +
                '  La página existe, se navega, y el buscador no la conoce.',
            );
            salida = 1;
          }
          if (sitemapBib.includes(`/guia/bibliotecas/${SLUG_BIBLIOTECA_PENDIENTE}/`)) {
            fallo(
              'el sitemap ofrece la ficha de la biblioteca que ESPERA DECISIÓN.\n' +
                '  Se le está pidiendo al buscador que indexe contenido sin revisar.',
            );
            salida = 1;
          }
        }

        if (salida === 0) {
          console.log(
            '  ✓ el directorio de bibliotecas salió con la publicada y sin la que espera ' +
              'decisión, con su ficha, su Library sin el costo en el marcado, el costo con ' +
              'su fecha en la página y su entrada de sitemap.',
          );
        }
      }
    }

    /*
     * 8m · **B-1572 — el motivo de la cancelación, en las tres direcciones de
     * D-976.**
     *
     * 1. **Sí** en la página de detalle, debajo del encuentro. Es el control
     *    positivo, y sin él las dos ausencias de abajo pasan en verde el día que
     *    la semilla o la plantilla dejen de producirlo.
     * 2. **No** en el `events.json`: lo frena el paso 3, que barre `CENTINELA`
     *    entero sobre el índice, y el paso 9 en todo el resto del `dist/`.
     * 3. **No** en el JSON-LD. Es la mitad que necesita un chequeo propio: el
     *    permiso del paso 9 es **por archivo**, `CENTINELA_DEL_DETALLE` lo deja
     *    pasar en `actividad/**` y el marcado vive adentro de ese mismo HTML. Así
     *    que un `description` del `subEvent` armado con el motivo pasaría el
     *    barrido entero. Google muestra ese texto en el resultado de búsqueda, y
     *    el motivo es texto libre sobre un encuentro puntual (D-976).
     */
    {
      const htmlConCancelado = await htmlDe(SLUG_GALERIA);
      if (htmlConCancelado === null) {
        fallo(
          `no se generó dist/actividad/${SLUG_GALERIA}/index.html, que es la que lleva el ` +
            'encuentro cancelado con motivo (B-1572).',
        );
        salida = 1;
      } else {
        const motivo = CENTINELA.motivoCancelacion;
        if (!htmlConCancelado.includes(motivo)) {
          fallo(
            'la página de detalle no muestra el motivo del encuentro cancelado (D-976).\n' +
              '  Es el anuncio que reemplaza al borrado del evento (§7.3, B-98): sin él,\n' +
              '  quien llega desde el calendario lee el motivo y la página no lo dice. Y\n' +
              '  las dos ausencias de este paso quedan sin nada que mirar.',
          );
          salida = 1;
        }
        const bloquesLd = [
          ...htmlConCancelado.matchAll(
            /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
          ),
        ].map((m) => m[1]);
        if (bloquesLd.length === 0) {
          fallo(
            `dist/actividad/${SLUG_GALERIA}/index.html no lleva JSON-LD: la ausencia del ` +
              'motivo en el marcado no prueba nada sin marcado (B-1572).',
          );
          salida = 1;
        } else if (bloquesLd.some((ld) => ld.includes(motivo))) {
          fallo(
            'EL JSON-LD PUBLICA EL MOTIVO DE UN ENCUENTRO CANCELADO.\n' +
              '  D-976 lo deja afuera a propósito: Google muestra ese texto en el resultado\n' +
              '  de búsqueda, y el motivo es texto libre sobre un encuentro puntual. En la\n' +
              '  página va, debajo de su encuentro; en el marcado, el `eventStatus` alcanza.',
          );
          salida = 1;
        }
        if (salida === 0) {
          console.log(
            '  ✓ el motivo del encuentro cancelado sale en la página, y no en el JSON-LD ' +
              `(${bloquesLd.length} bloque(s)) ni en el events.json (D-976, B-1572).`,
          );
        }
      }
    }

    /*
     * 9 · **B-121 — el barrido sobre TODO el `dist/`, y no sobre tres páginas
     * elegidas a mano.**
     *
     * Es lo que el ítem pedía desde el principio: «el `grep` sobre `dist/`
     * buscando `difusion`, la URL de la reunión y los uids». Hasta acá el gate
     * barría el `events.json` (paso 3) y **tres** páginas de detalle nombradas
     * una por una: la cancelada (paso 4), la de la galería y la publicada (8g).
     *
     * **Lo que esa forma no ve, y es la mitad del sitio.** El listado, la
     * cartelera, las páginas de mes, `/pasadas`, los hubs y el sitemap también
     * son HTML indexable que interpola datos de actividades, y ninguno estaba
     * barrido. Peor: cada página nueva que nace queda afuera hasta que alguien
     * se acuerde de agregarla acá — que es exactamente cómo la salida 5 y la 6
     * llegaron tarde al mapa (B-212, B-227).
     *
     * Así que la lista **se deriva del `dist/`**: se recorre lo que el build
     * escribió y se barre todo lo que es texto publicable. Una página nueva
     * entra sola. No hay nada que mantener.
     *
     * **Por qué esto no reemplaza a `tests/barrido-de-salidas-publicas.test.ts`
     * ni al revés.** Aquél mira las **funciones puras** —qué decide publicar la
     * proyección— y corre en milisegundos sin build. Éste mira **lo que quedó
     * escrito en el artefacto**, que es lo único que prueba que ninguna
     * plantilla interpoló algo por su cuenta: un `title={imagen.storagePath}`
     * agregado en un `.astro` pasa el barrido del view-model y muere acá. Son
     * complementarios y los dos hacen falta.
     *
     * **Por qué vive en el gate y no en la suite:** necesita un `dist/`
     * construido, y `npm test` no puede depender de eso. Es el criterio de
     * B-217, y es el mismo por el que dos archivos de test se saltean sin build.
     */
    {
      const RAIZ_DIST = new URL('../dist/', import.meta.url);
      const BARRIBLES = /\.(html|json|xml|txt)$/;

      /** Todo lo publicable que el build escribió, relativo a `dist/`. */
      const publicables = (await readdir(RAIZ_DIST, { recursive: true })).filter((r) =>
        BARRIBLES.test(r),
      );

      /*
       * Control positivo, y no es una formalidad: si el glob dejara de encontrar
       * archivos —porque cambió el `outDir`, porque el build falló antes— este
       * paso saldría en verde **sin haber mirado nada**, que es la forma exacta
       * en que el paso 4 original pasaba leyendo cero documentos (B-217).
       */
      if (publicables.length < 5) {
        fallo(
          `el barrido del artefacto encontró ${publicables.length} archivo(s) publicables en dist/.\n` +
            '  Son demasiado pocos: o el build no escribió nada, o cambió dónde escribe.\n' +
            '  Un barrido sobre cero archivos pasa en verde sin haber mirado nada.',
        );
        salida = 1;
      }

      const hallazgos = [];
      /** Dónde apareció cada forma del monto — B-804. Es el control positivo. */
      const vistos = new Map(MONTO_EN_EL_ARTEFACTO.map((f) => [f.campo, []]));
      for (const relativa of publicables) {
        const contenido = await readFile(new URL(relativa, RAIZ_DIST), 'utf8');

        /*
         * Las excepciones son **por salida**, cortas y justificadas, igual que en
         * `tests/barrido-de-salidas-publicas.test.ts`: la página de detalle
         * publica la descripción entera, la dirección y el tema (D-139); el
         * índice publica el id de sesión desde B-99; la cartelera publica el
         * epígrafe (D-125). **Todo lo demás se barre en todos los archivos**, que
         * es lo que hace que una plantilla nueva no pueda publicar de más.
         */
        const permitido = relativa.startsWith('actividad/')
          ? CENTINELA_DEL_DETALLE
          : relativa === 'events.json'
            ? CENTINELA_DEL_INDICE
            : relativa.startsWith('cartelera/')
              ? CENTINELA_DE_LA_CARTELERA
              : relativa === 'librerias.json' || relativa.startsWith('guia/librerias/')
                ? CENTINELA_DEL_DIRECTORIO
                : relativa === 'suscripciones.json' ||
                    relativa.startsWith('guia/suscripciones/')
                  ? CENTINELA_DE_SUSCRIPCIONES
                : relativa === 'lugares.json' || relativa.startsWith('guia/lugares/')
                  ? CENTINELA_DE_LUGARES
                  : relativa === 'bibliotecas.json' ||
                      relativa.startsWith('guia/bibliotecas/')
                    ? CENTINELA_DE_BIBLIOTECAS
                    : [];
        const prohibidos = Object.entries(CENTINELA).filter(
          ([campo]) => !permitido.includes(campo),
        );

        for (const [campo, valor] of prohibidos) {
          if (contenido.includes(valor)) hallazgos.push(`    ${relativa} → ${campo} (${valor})`);
        }

        /*
         * B-804 — y el centinela **numérico**, que no entra en el modelo de
         * canastas de arriba porque sus dos formas no comparten permiso: el
         * número crudo sale al índice y al JSON-LD, la forma legible a todo lo
         * que pinte la tarjeta compartida.
         */
        for (const forma of MONTO_EN_EL_ARTEFACTO) {
          if (!contenido.includes(forma.valor)) continue;
          vistos.get(forma.campo).push(relativa);
          if (!forma.permitido(relativa)) {
            hallazgos.push(`    ${relativa} → ${forma.campo} (${forma.valor})`);
          }
        }
      }

      /*
       * **Los tres controles positivos del monto** — B-804, y son la mitad del
       * ítem. Un barrido que solo afirma ausencias pasa en verde el día que la
       * semilla deja de sembrar el campo, que es exactamente el estado del que
       * este ítem viene: el gate afirmaba sobre una salida que nunca tuvo el
       * dato.
       */
      for (const forma of MONTO_EN_EL_ARTEFACTO) {
        if (vistos.get(forma.campo).length > 0) continue;
        fallo(
          `el monto del arancel no aparece en NINGÚN archivo del dist/ en su forma ` +
            `${forma.campo} (${forma.valor}).\n` +
            `  Tendría que salir en ${forma.donde}.\n` +
            '  O la semilla dejó de cargar `arancel.monto` con un tipo que lo admita, o la\n' +
            '  salida dejó de publicarlo: en los dos casos el barrido de abajo estaría\n' +
            '  afirmando sobre un dato que no existe (B-804).',
        );
        salida = 1;
      }

      const enLaTarjeta = vistos.get('montoLegible').filter((r) => pintaLaTarjeta(r));
      if (enLaTarjeta.length === 0) {
        fallo(
          'el monto no aparece en ninguna de las páginas que pintan la tarjeta compartida.\n' +
            `  Esperaba alguna de: ${PAGINAS_CON_TARJETA.join(', ')}.\n` +
            '  Es la cuarta canasta de B-804: si dejó de imprimirse ahí, el permiso que le\n' +
            '  dimos a esas páginas quedó sin nada que permitir.',
        );
        salida = 1;
      }

      if (!vistos.get('montoCrudo').includes('events.json')) {
        fallo(
          'el events.json no lleva el monto del arancel.\n' +
            '  Lo lleva desde B-114 porque la tarjeta del listado arma la frase del precio\n' +
            '  en el cliente: sin el número, el listado dice la etiqueta sola.',
        );
        salida = 1;
      }

      if (hallazgos.length > 0) {
        fallo(
          `hay campos privados en el artefacto construido (${hallazgos.length} hallazgo(s)):\n` +
            hallazgos.join('\n') +
            '\n  Es B-121: el barrido sobre `dist/`. Lo que se sube tiene un campo que\n' +
            '  ninguna salida pública debería llevar — y si el barrido de\n' +
            '  `tests/barrido-de-salidas-publicas.test.ts` está en verde, entonces la\n' +
            '  proyección recorta bien y lo publicó una **plantilla** por su cuenta.',
        );
        salida = 1;
      }
    }

    /*
     * 10 · **B-122 — las dos propiedades del HTML indexable que quedaban sin
     * red, y que resultaron ser propiedades y no juicios.**
     *
     * El ítem pedía «un auditor del sitio público». Mirándolo con el criterio
     * del propio repo —un agente que repite lo que un chequeo ya frena es costo
     * sin cobertura— lo que le quedaba sin cubrir eran cuatro cosas, y solo dos
     * de ellas necesitan un modelo:
     *
     *   · **un `<title>` distinto en cada página** → es una propiedad del
     *     artefacto. Un título repetido hace que Google elija cuál de las dos
     *     páginas indexar, y la que pierde deja de existir para quien busca. El
     *     modo de falla clásico es una plantilla nueva que hereda el título del
     *     layout y nadie lo nota, porque la página se ve bien.
     *   · **la jerarquía de encabezados** → también es una propiedad: un `h1`
     *     por página y ningún nivel salteado. Es lo primero que mira un lector
     *     de pantalla para armarse el índice de la página, y se rompe en
     *     silencio: visualmente un `h3` con la clase del `h2` es idéntico.
     *   · el **nombre accesible** de un control y **el foco en un recorrido
     *     real** → ésos no son propiedades del HTML: hay que tabular una página
     *     viva. No los hace ni un test ni un agente con `grep`, y quedan
     *     anotados como manuales en `docs/13-agentes.md`.
     *
     * Van acá y no en la suite por el mismo motivo que el paso 9: necesitan el
     * HTML construido (criterio de B-217). Y **no cubren `/admin`**, que es una
     * SPA de React: su HTML de build es una cáscara vacía y no tiene sentido
     * medirle la jerarquía.
     */
    {
      const paginas = (await readdir(new URL('../dist/', import.meta.url), { recursive: true }))
        .filter((r) => r.endsWith('.html') && !r.startsWith('admin/'));

      if (paginas.length < 5) {
        fallo(
          `el chequeo de SEO encontró ${paginas.length} página(s) en dist/: son muy pocas ` +
            'para comparar títulos, así que un verde acá no diría nada.',
        );
        salida = 1;
      }

      const titulos = new Map();
      const jerarquia = [];

      for (const relativa of paginas) {
        const html = await readFile(new URL(relativa, new URL('../dist/', import.meta.url)), 'utf8');

        // 10a · El título, único.
        const t = tituloDe(html);
        if (!t) {
          fallo(`dist/${relativa} no tiene <title>.`);
          salida = 1;
        } else {
          if (!titulos.has(t)) titulos.set(t, []);
          titulos.get(t).push(relativa);
        }

        // 10b · Un solo `h1`, y ningún nivel salteado al bajar.
        for (const p of problemasDeJerarquia(html)) jerarquia.push(`    dist/${relativa} → ${p}`);
      }

      const repetidos = [...titulos.entries()].filter(([, rutas]) => rutas.length > 1);
      if (repetidos.length > 0) {
        fallo(
          'hay páginas que comparten el <title>:\n' +
            repetidos
              .map(([t, rutas]) => `    "${t}" → ${rutas.map((r) => `dist/${r}`).join(', ')}`)
              .join('\n') +
            '\n  Google elige cuál de las dos indexar, y la que pierde deja de existir\n' +
            '  para quien busca. Es el objetivo del proyecto (§2.3): que la gente\n' +
            '  encuentre los talleres.',
        );
        salida = 1;
      }

      if (jerarquia.length > 0) {
        fallo(
          'la jerarquía de encabezados está rota:\n' +
            jerarquia.join('\n') +
            '\n  Es el índice con el que un lector de pantalla recorre la página, y se\n' +
            '  rompe en silencio: un h3 con la clase del h2 se ve idéntico.',
        );
        salida = 1;
      }
    }

    if (salida === 0) {
      console.log(
        `\n  ✓ el build leyó Firestore: ${slugs.length} actividad(es) en el events.json, ` +
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
  salida = 1;
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

process.exit(salida);
