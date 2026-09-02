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
/*
 * B-296 — la actividad con **tres imágenes de proporciones distintas**, que es
 * el caso que rompe: una vertical, una apaisada y una cuadrada. Ninguna salida
 * del sitio recorta (D-147), así que las tres tienen que salir enteras y con su
 * propia caja reservada, y eso solo se ve en el HTML construido: los unitarios
 * afirman sobre el fuente de la plantilla, que no sabe nada de estas tres
 * medidas.
 *
 * Y la portada va **segunda** en el array a propósito: así el artefacto prueba
 * de punta a punta lo de B-268 —arriba va la marcada, no la primera cargada— y
 * la consecuencia nueva que trae la tira, que es que el flyer no puede terminar
 * de miniatura decorativa con `alt=""`.
 */
const ID_GALERIA = `${PREFIJO}galeria`;

const SLUG_PUBLICADA = `${PREFIJO}publicada`;
const SLUG_BORRADOR = `${PREFIJO}borrador`;
const SLUG_CANCELADA = `${PREFIJO}cancelada`;
const SLUG_CANCELADA_NUNCA = `${PREFIJO}cancelada-nunca`;
const SLUG_GALERIA = `${PREFIJO}galeria`;

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
  // B-296 — el epígrafe **sí** sale a la página de detalle (es el `figcaption` de
  // su imagen) y **no** al `events.json`, que solo lleva la URL de la portada.
  // O sea que este centinela se afirma en las dos direcciones a la vez.
  epigrafeImagen: 'gate.imagenes.epigrafe',
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
      /*
       * El centinela va en la **portada** y no en una secundaria, y eso lo
       * encontró el `auditor-privacidad`: el `events.json` solo lleva la URL de
       * la portada, así que un centinela puesto en otra fila hace pasar el paso 3
       * sin haber probado nada. Con el epígrafe acá, el paso 3 prueba de verdad
       * que el índice no lo publica, y el barrido de HTML del paso 4 prueba la
       * otra dirección: que el `figcaption` de la página sí lo muestra.
       */
      epigrafe: CENTINELA.epigrafeImagen,
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
  // B-296 — el epígrafe de una imagen se muestra debajo de esa imagen (D-125).
  'epigrafeImagen',
];

/**
 * Las tres imágenes del caso de B-296: **una vertical, una apaisada y una
 * cuadrada**, con la portada en el medio del array.
 *
 * Las medidas no son inventadas: 1080 × 1350 es un flyer de Instagram, y
 * 1408 × 768 y 1024 × 1024 son dos de las tres imágenes reales de «Usted está
 * aquí», la única actividad de producción con tres cargadas (medido el
 * 2026-09-02).
 *
 * El `storagePath` va en las tres: el barrido de abajo tiene que cubrir la salida
 * **nueva**, no solo la portada que ya estaba.
 */
const TRES_IMAGENES = [
  {
    id: 'img_gate_apaisada',
    url: 'https://example.invalid/gate-apaisada.jpg',
    epigrafe: CENTINELA.epigrafeImagen,
    origen: 'externa',
    portada: false,
    storagePath: CENTINELA.storagePath,
    ancho: 1408,
    alto: 768,
  },
  {
    id: 'img_gate_vertical',
    url: 'https://example.invalid/gate-vertical.jpg',
    epigrafe: '',
    origen: 'externa',
    portada: true,
    storagePath: CENTINELA.storagePath,
    ancho: 1080,
    alto: 1350,
  },
  {
    id: 'img_gate_cuadrada',
    url: 'https://example.invalid/gate-cuadrada.jpg',
    epigrafe: '',
    origen: 'externa',
    portada: false,
    storagePath: CENTINELA.storagePath,
    ancho: 1024,
    alto: 1024,
  },
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

  // B-296 — la publicada con tres imágenes de proporciones distintas.
  const galeria = actividadDePrueba(SLUG_GALERIA, 'publicado');
  galeria.titulo = 'Gate mecanico — galeria de tres';
  galeria.imagenes = TRES_IMAGENES;
  await db.doc(`actividades/${ID_GALERIA}`).set(galeria);

  console.log(
    `  (sembradas 5 actividades de prueba en ${host}: publicada, borrador, dos canceladas y ` +
      'una con tres imágenes)',
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

      const malFormadas = locs.filter((u) => !/^https:\/\/[^/]+\//.test(u) || !u.endsWith('/'));
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
      if (sitemap.includes('lastmod')) {
        fallo(
          'el sitemap.xml lleva `lastmod`.\n' +
            '  Sale de `updatedAt`, que no está en la proyección pública (B-112). La fecha\n' +
            '  del build en las N entradas le enseña a Google que nuestras fechas mienten.',
        );
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
        if (/<a\b/.test(seccion)) {
          fallo(
            'la sección de las secundarias tiene un enlace.\n' +
              '  La página tiene un presupuesto de 0 KB de JavaScript y la tira no agrega\n' +
              '  ninguna parada de tabulación: sin lightbox y sin enlaces al JPEG.',
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

    if (salida === 0) {
      console.log(
        `\n  ✓ el build leyó Firestore: ${slugs.length} actividad(es) en el events.json, ` +
          'sin la borrador y sin ningún campo recortado.\n' +
          '  ✓ la cancelada que estuvo publicada conserva su página, con la franja y el ' +
          'EventCancelled; la que nunca lo estuvo no existe (B-110).\n' +
          '  ✓ el sitemap ofrece la publicada y la cancelada reciente con URL absoluta y ' +
          'barra final, sin el borrador, sin /admin y sin lastmod; el robots.txt bloquea el ' +
          'panel; y el robots, el sitemap y la canónica coinciden en un solo origen (B-109).\n' +
          '  ✓ la actividad con tres imágenes pinta las tres, con la portada marcada arriba, ' +
          'un solo `eager`, un solo texto alternativo y tres cajas de proporción distinta; y ' +
          'la de una sola imagen sigue pintando una, sin sección de galería (B-296).',
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
