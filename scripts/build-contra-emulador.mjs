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
 * Siembra cuatro actividades de prueba —una publicada, una en borrador y las dos
 * canceladas de B-110—, corre el build, y **afirma sobre los archivos que
 * salieron**: el `events.json` y el HTML de cada página.
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
import { readFile } from 'node:fs/promises';

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

/**
 * El prefijo de los ids sembrados.
 *
 * Con prefijo y no con ids sueltos para que la limpieza pueda barrer también lo
 * que haya quedado de una corrida anterior que murió a mitad de camino.
 */
const PREFIJO = 'zz-gate-verificar-todo-';
const ID_PUBLICADA = `${PREFIJO}publicada`;
const ID_BORRADOR = `${PREFIJO}borrador`;
/*
 * B-110 — las dos canceladas. La primera **estuvo publicada** (conserva el
 * `calendarEventId` de una de sus sesiones, que es la heurística del §7.3) y
 * tiene que tener su HTML; la segunda nació y murió en `cancelado`, así que no
 * tiene que existir. Son la mitad de este gate que mira la **página** y no el
 * `events.json`: el modo de falla de B-110 es un archivo HTML que se genera o no
 * se genera, y eso no se ve en el índice.
 */
const ID_CANCELADA = `${PREFIJO}cancelada`;
const ID_CANCELADA_NUNCA = `${PREFIJO}cancelada-nunca`;

const SLUG_PUBLICADA = `${PREFIJO}publicada`;
const SLUG_BORRADOR = `${PREFIJO}borrador`;
const SLUG_CANCELADA = `${PREFIJO}cancelada`;
const SLUG_CANCELADA_NUNCA = `${PREFIJO}cancelada-nunca`;

/**
 * Los centinelas de los campos que el índice recorta (§3.1 del diseño de B-106).
 *
 * Igual que en `tests/fixtures/centinelas.ts`, **el valor dice la ruta**: si uno
 * se escapa, el mensaje de falla nombra el campo sin que haya que traducir nada.
 * Y son URL-safe, para que una fuga por un camino que escape la cadena no quede
 * invisible.
 */
const CENTINELA = {
  descripcion: 'gate.descripcion.centinela',
  destino: 'gate.inscripcion.destino',
  direccion: 'gate.sede.direccion',
  indicaciones: 'gate.sede.indicaciones',
  tema: 'gate.sesiones.tema',
  lectura: 'gate.sesiones.lectura',
  sesionId: 'ses_gate.sesiones.id',
  bio: 'gate.tallerista.bio',
  talleristaInstagram: 'gate.tallerista.instagram',
  organizadorInstagram: 'gate.organizador.instagram',
  organizadorWeb: 'gate.organizador.web',
  arancelNotas: 'gate.arancel.notas',
  materialTitulo: 'gate.material.titulo',
  materialUrl: 'gate.material.url',
  difusionNotas: 'gate.difusion.notas',
  difusionArrobar: 'gate.difusion.arrobar',
  onlineUrl: 'gate.online.url',
  storagePath: 'gate.imagenes.storagePath',
  createdBy: 'gate.createdBy',
};

/**
 * La descripción del fixture: larga a propósito, para que `resumenDe` tenga que
 * cortarla de verdad (`LARGO_RESUMEN` = 160) en vez de devolverla entera.
 *
 * El centinela va **al final**, pasado el corte: así el aserto de que no aparece
 * en el archivo prueba que el resumen recorta, y no que el índice no lleva
 * descripción.
 */
const descripcionLarga = `${'Taller de prueba del gate mecanico, con una descripcion deliberadamente larga para que el resumen tenga que cortarla en limite de palabra. '.repeat(
  2,
)}${CENTINELA.descripcion}`;

const enUnaHora = (horas) => new Date(Date.now() + horas * 3_600_000);

/** Un documento de `/actividades` válido para `toPublic`, todo centinelas. */
const actividadDePrueba = (slug, estado) => ({
  tipo: 'taller',
  titulo: `Gate mecanico — ${estado}`,
  slug,
  descripcion: descripcionLarga,
  imagenes: [
    {
      id: 'img_gate',
      url: 'https://example.invalid/gate.jpg',
      epigrafe: 'Portada del fixture',
      origen: 'externa',
      portada: true,
      storagePath: CENTINELA.storagePath,
    },
  ],
  organizador: {
    nombre: 'Organizador del gate',
    instagram: CENTINELA.organizadorInstagram,
    web: CENTINELA.organizadorWeb,
  },
  tallerista: {
    nombre: 'Tallerista del gate',
    bio: CENTINELA.bio,
    instagram: CENTINELA.talleristaInstagram,
  },
  libro: null,
  esCiclo: false,
  sesiones: [
    {
      id: CENTINELA.sesionId,
      inicio: enUnaHora(24),
      fin: enUnaHora(26),
      tema: CENTINELA.tema,
      lectura: CENTINELA.lectura,
      cancelada: false,
      calendarEventId: null,
    },
  ],
  /*
   * **B-241 — la lista de formas de cursar, que es la forma del modelo desde
   * B-224.** Este fixture se escribió antes y traía solo `modalidad`/`sede`/
   * `online` de primer nivel, que son los **derivados**: con eso, la página de
   * detalle que genera este gate no pintaba el bloque «Cómo se cursa» ni la sede,
   * y `datosEstructurados` devolvía `null` porque no había ningún `location`.
   *
   * Se arregla acá y no en su propio cambio porque **B-110 lo necesita**: el
   * aserto nuevo es que la página cancelada lleva `eventStatus: EventCancelled`,
   * y sin `location` no hay JSON-LD sobre el cual afirmarlo. Un gate que existe
   * para mirar el artefacto de verdad tiene que mirarlo entero.
   *
   * Los centinelas son **los mismos** de la sede derivada: el barrido cuenta
   * presencia y no ocurrencias, así que el mismo dato en dos lugares no cambia
   * ninguna de las dos direcciones del chequeo.
   */
  modalidades: [
    {
      id: 'mod_gate',
      modalidad: 'hibrido',
      inicio: null,
      fin: null,
      sede: {
        nombre: 'Sede del gate',
        direccion: CENTINELA.direccion,
        barrio: 'boedo',
        ciudad: 'CABA',
        indicaciones: CENTINELA.indicaciones,
        geo: null,
      },
      online: { plataforma: 'meet', url: CENTINELA.onlineUrl, urlPublica: true },
    },
  ],
  modalidad: 'hibrido',
  sede: {
    nombre: 'Sede del gate',
    direccion: CENTINELA.direccion,
    barrio: 'boedo',
    ciudad: 'CABA',
    indicaciones: CENTINELA.indicaciones,
    geo: null,
  },
  // `urlPublica: true` a propósito: es el caso en el que `toPublic` **sí** deja
  // pasar el link (D-15), así que es el único que prueba que el recorte del
  // índice lo saca por decisión propia y no de rebote.
  online: { plataforma: 'meet', url: CENTINELA.onlineUrl, urlPublica: true },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: CENTINELA.destino,
    cupo: 12,
    cierra: enUnaHora(12),
    completo: false,
  },
  arancel: { tipo: 'gratis', notas: CENTINELA.arancelNotas },
  material: {
    tiene: true,
    items: [
      {
        tipo: 'lectura',
        titulo: CENTINELA.materialTitulo,
        url: CENTINELA.materialUrl,
        entrega: 'previo',
        publico: true,
      },
    ],
  },
  difusion: { arrobar: [CENTINELA.difusionArrobar], notas: CENTINELA.difusionNotas },
  estado,
  tags: ['gate'],
  destacado: false,
  searchText: 'gate mecanico',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: CENTINELA.createdBy,
  updatedBy: CENTINELA.createdBy,
});

/**
 * Los centinelas que la **página de detalle** sí publica, y el índice no.
 *
 * El detalle muestra más que el índice (§4.3 del diseño): la descripción entera,
 * la dirección con el cómo llegar, el canal de inscripción, la bio, las notas del
 * arancel y el material público. Lo que **no** está en esta lista tiene que
 * seguir sin aparecer en el HTML — y el que importa es `onlineUrl`, que el
 * fixture publica con `urlPublica: true` (D-139).
 *
 * Es la misma lista que `PERMITIDO_EN_EL_DETALLE` de
 * `tests/barrido-de-salidas-publicas.test.ts`, con los nombres de acá. Allá la
 * afirmación es sobre el view-model; acá, sobre el HTML que se sube.
 */
const CENTINELA_DEL_DETALLE = [
  'descripcion',
  'destino',
  'direccion',
  'indicaciones',
  'tema',
  'lectura',
  'sesionId',
  'bio',
  'talleristaInstagram',
  'organizadorInstagram',
  'organizadorWeb',
  'arancelNotas',
  'materialTitulo',
  'materialUrl',
];

initializeApp({ projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria' });
const db = getFirestore();

const limpiar = async () => {
  const snap = await db.collection('actividades').get();
  const aBorrar = snap.docs.filter((d) => d.id.startsWith(PREFIJO));
  await Promise.all(aBorrar.map((d) => d.ref.delete()));
  return aBorrar.length;
};

const fallo = (mensaje) => {
  console.error(`\n\x1b[31m✗ ${mensaje}\x1b[0m`);
  process.exitCode = 1;
};

let salida = 0;

try {
  await limpiar();

  await db.doc(`actividades/${ID_PUBLICADA}`).set(actividadDePrueba(SLUG_PUBLICADA, 'publicado'));
  await db.doc(`actividades/${ID_BORRADOR}`).set(actividadDePrueba(SLUG_BORRADOR, 'borrador'));

  // B-110 — la cancelada que estuvo publicada: se le deja el `calendarEventId`
  // de su sesión, que es lo que prueba que el sync le creó el evento.
  const cancelada = actividadDePrueba(SLUG_CANCELADA, 'cancelado');
  cancelada.sesiones[0].calendarEventId = 'evt_gate_cancelada';
  await db.doc(`actividades/${ID_CANCELADA}`).set(cancelada);
  // Y la que nunca lo estuvo: sin id de evento y sin historial.
  await db
    .doc(`actividades/${ID_CANCELADA_NUNCA}`)
    .set(actividadDePrueba(SLUG_CANCELADA_NUNCA, 'cancelado'));

  console.log(
    `  (sembradas 4 actividades de prueba en ${host}: publicada, borrador y dos canceladas)`,
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

    if (salida === 0) {
      console.log(
        `\n  ✓ el build leyó Firestore: ${slugs.length} actividad(es) en el events.json, ` +
          'sin la borrador y sin ningún campo recortado.\n' +
          '  ✓ la cancelada que estuvo publicada conserva su página, con la franja y el ' +
          'EventCancelled; la que nunca lo estuvo no existe (B-110).',
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
      `  ⚠ no se pudieron borrar los documentos de prueba (prefijo ${PREFIJO}): ` +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

process.exit(salida);
