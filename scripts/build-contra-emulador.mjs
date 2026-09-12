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
// B-804 — el número lo escribe el mismo código que lo publica. Escribir
// `'$7.654.321'` a mano acá sería una segunda derivación de la misma idea, que
// es cómo se separan los formatos (§ «si hay un skill, se usa», mismo motivo).
import { montoLegible } from '../functions/calendario.js';

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
 * **Las dos librerías del gate** — B-901.
 *
 * Una publicada y una esperando decisión, que es el par mínimo que prueba lo
 * único que no se puede probar sin emulador: que la lectura del build **pidió
 * solo las publicadas** (`where('estado','==','publicado')`, B-903). Con una sola
 * ficha, un build que leyera la colección entera daría exactamente el mismo
 * `dist/`.
 *
 * El slug lleva el prefijo del gate, así que es un slug válido (`esSlugDeFicha`) y
 * a la vez imposible de confundir con una librería de verdad.
 */
/**
 * **Las dos suscripciones del gate** — B-832. Mismo par y mismo motivo que el de
 * librerías, más una cosa que ninguna otra colección tiene: la publicada lleva un
 * **precio**, así que el `dist/` es donde se puede verificar que salió con su
 * fecha pegada y no como número suelto (DEC-12). Eso ningún unitario lo ve: el
 * barrido mira la función pura, y acá se mira lo que quedó escrito en el archivo.
 */
const ID_SUSCRIPCION = `${PREFIJO}suscripcion`;
const ID_SUSCRIPCION_PENDIENTE = `${PREFIJO}suscripcion-pendiente`;
const SLUG_SUSCRIPCION = `${PREFIJO}suscripcion`;
const SLUG_SUSCRIPCION_PENDIENTE = `${PREFIJO}suscripcion-pendiente`;

const ID_LIBRERIA = `${PREFIJO}libreria`;
const ID_LIBRERIA_PENDIENTE = `${PREFIJO}libreria-pendiente`;
const SLUG_LIBRERIA = `${PREFIJO}libreria`;
const SLUG_LIBRERIA_PENDIENTE = `${PREFIJO}libreria-pendiente`;

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
  /*
   * ── B-901 · las librerías de la Guía ────────────────────────────────────
   *
   * Los dos primeros **salen a propósito** (la descripción y la dirección de un
   * local comercial), y por eso tienen su canasta abajo. Los dos últimos **no
   * salen a ninguna parte**, y son la razón por la que esta colección se siembra
   * acá además de tener su barrido de unitarios:
   *
   *  - `libreriaContacto` es el `contactoDeQuienCargo`, el **segundo dato
   *    personal de un tercero** que guarda el proyecto. Su barrido de vitest
   *    mira la función pura; éste mira lo que quedó escrito en el artefacto, que
   *    es lo único que prueba que ninguna plantilla lo interpoló por su cuenta.
   *  - `libreriaMotivo` es por qué un admin descartó una ficha: texto interno
   *    sobre un tercero.
   *
   * Y `libreriaPendiente` es el control del `where('estado','==','publicado')`
   * de la lectura del build (**B-903**): es la descripción de una ficha que
   * **espera decisión**, así que no puede aparecer en un solo archivo del
   * `dist/`. Sin canasta: prohibido en todos.
   */
  libreriaDescripcion: 'gate.libreria.descripcion',
  libreriaDireccion: 'gate.libreria.direccion',
  libreriaContacto: 'gate.libreria.contactoDeQuienCargo',
  libreriaMotivo: 'gate.libreria.revision.motivo',
  libreriaPendiente: 'gate.libreria.pendiente.descripcion',
  /*
   * ── B-832 · las suscripciones literarias ────────────────────────────────
   *
   * Los dos primeros **salen a propósito** (la descripción y la temática de lo
   * que manda) y tienen su canasta abajo. Los otros tres **no salen a ninguna
   * parte**:
   *
   *  - `suscripcionContacto` es el `contactoDeQuienCargo`;
   *  - `suscripcionMotivo` es por qué un admin descartó una ficha;
   *  - `suscripcionPendiente` es la descripción de una que **espera decisión**, o
   *    sea el control del `where('estado','==','publicado')` de la lectura.
   *
   * Y `suscripcionPrecioSolo` es el centinela propio de esta colección: **el
   * monto formateado sin su fecha**. No se siembra como texto —es lo que produce
   * `fraseDePrecio` con el número del gate— y el paso 8j lo usa para afirmar que
   * en el `dist/` el precio aparece **siempre** pegado a «cargado el». Es DEC-12
   * verificada contra el archivo y no contra la intención.
   */
  suscripcionDescripcion: 'gate.suscripcion.descripcion',
  suscripcionTematica: 'gate.suscripcion.tematica',
  suscripcionContacto: 'gate.suscripcion.contactoDeQuienCargo',
  suscripcionMotivo: 'gate.suscripcion.revision.motivo',
  suscripcionPendiente: 'gate.suscripcion.pendiente.descripcion',
  // B-296 — el epígrafe **sí** sale a la página de detalle (es el `figcaption` de
  // su imagen) y **no** al `events.json`, que solo lleva la URL de la portada.
  // O sea que este centinela se afirma en las dos direcciones a la vez.
  epigrafeImagen: 'gate.imagenes.epigrafe',
  /*
   * B-181 — el **id** de la comisión no sale a ninguna parte, y por eso está acá
   * y no en la familia de los que sí salen.
   *
   * Lo cobró el `auditor-privacidad`: estaba declarado como *permitido* en el
   * barrido de vitest y como *nada* en el del artefacto, que es la asimetría que
   * el docblock de `CENTINELA_DEL_INDICE` prohíbe («cuando un campo nuevo entre a
   * una salida, se declara en las dos»). No dejaba el gate rojo: dejaba el campo
   * invisible. Con el centinela acá, el paso 9 —el que recorre todo el `dist/`—
   * lo verifica solo.
   *
   * La página agrupa con la **etiqueta**, no con el id: el agrupado se resuelve
   * dentro de `detalleDeActividad`.
   */
  comisionId: 'com_gate.comisiones.id',
  /*
   * B-830 — el **slug** de «qué se llevan», que no sale a ninguna parte: la
   * página muestra la etiqueta (`ETIQUETA_DE_INCLUYE`, abajo) y el índice no
   * lleva ni el campo ni su vocabulario (D-580).
   *
   * **Lo cobró el `auditor-privacidad` sobre B-830**, y por la misma asimetría
   * que `comisionId`: el campo quedó anclado en el barrido de vitest —en las dos
   * direcciones— y en **nada** acá, así que el paso 9 era ciego al campo nuevo.
   * No dejaba el gate rojo: dejaba el campo invisible, que es peor.
   *
   * Va con guiones a propósito. `desSlug` los convierte en espacios y capitaliza,
   * así que la etiqueta derivada (`Gate Incluye Slug`) **no contiene** esta
   * cadena: si el slug crudo apareciera en el HTML o en el archivo, sería porque
   * alguien lo publicó sin resolver, que es exactamente lo que hay que agarrar.
   */
  incluyeSlug: 'gate-incluye-slug',
  /*
   * B-888 — el mail de una cuenta del panel, que vive en `/usuarios/{uid}` y
   * **no sale a ninguna parte**. §5.1 y D-57: uid y mail de una cuenta del panel
   * no salen «ni crudos ni hasheados».
   *
   * **Lo pidió el `auditor-privacidad`, y es el de la salida 5 con otra cara: el
   * agujero no es de cobertura, es de índice.** Hoy el build no lee `/usuarios`
   * —`contenidoDelSitio.ts` lee `actividades` y sus `versiones`, nada más—, así
   * que este centinela **no puede ponerse rojo todavía**, y eso está dicho a
   * propósito. Está acá porque la tajada 2 es, literalmente, el cambio que va a
   * conectar `mailesPorUid()` a un view-model dentro de `src/lib/` — el mismo
   * directorio donde viven `toPublic.ts`, `detallePublico.ts` y
   * `hubsPublicos.ts`—, y el momento de escribir el testigo es **antes** de ese
   * cambio, no después: un barrido que se agrega junto con la funcionalidad se
   * escribe contra el código que quedó.
   *
   * Es la misma forma que `tests/escritura-anonima.integracion.test.ts`, que
   * también fija un estado de partida y también declara su propio límite.
   *
   * Cómo comprobar que sirve, el día que haga falta: interpolarlo a mano en
   * cualquier `.astro` del sitio deja el paso 9 rojo nombrando el archivo — el
   * mismo mecanismo que ya cobra los otros veinte, que no tiene nada de
   * particular acá.
   */
  mailDePanel: 'gate.usuarios.email@ejemplo.test',
};

/**
 * El id de sesión, que **sí sale** al `events.json` desde B-99 y por eso no está
 * en `CENTINELA`.
 *
 * Estuvo en esa lista —la de los campos que el índice recorta— hasta hoy, y
 * quedó vieja el día que B-99 metió el **eje plano de encuentros**
 * (`{slug, sesionId, inicio}`) al archivo: ese eje es la razón de ser del
 * tríptico «¿Qué hay ahora?» de la home. B-99 actualizó el barrido de
 * `tests/barrido-de-salidas-publicas.test.ts` —donde `sesiones.id` figura
 * permitido, con su motivo escrito— y **no** esta lista, así que este gate viene
 * fallando desde `1.8.0` para cualquiera que lo corra. Lo encontró el propio
 * gate al ir a pushear la tanda siguiente, que es exactamente lo que tiene que
 * hacer.
 *
 * Se afirma **en la otra dirección**: el id tiene que aparecer. Sacarlo de
 * `CENTINELA` sin poner nada en su lugar habría dejado el archivo sin nadie que
 * mire ese campo, que es cómo un recorte se pierde en silencio. Es el mismo
 * patrón de dos direcciones que ya usa `epigrafeImagen`.
 *
 * Que sea publicable no es una opinión de este script: es un uuid opaco generado
 * en el cliente (trampa 2), sin PII, y ya público en la página de detalle.
 */
const ID_DE_SESION_QUE_SALE = 'ses_gate.sesiones.id';

/**
 * La etiqueta de la comisión (B-181), que **también sale** — y por eso está acá y
 * no en `CENTINELA`.
 *
 * Se afirma **en una sola dirección y sobre un solo artefacto**: el HTML de la
 * página, donde es el encabezado del grupo de encuentros y donde hace que el
 * título de la sección pase a «Elegí tu opción».
 *
 * Es la razón de que esto exista: el agrupado por comisión vive en
 * `src/pages/actividad/[slug].astro` y **ningún test unitario puede mirarlo** —un
 * `.astro` no se importa desde vitest (D-140), así que `detallePublico.ts` afirma
 * qué se decide mostrar y este gate es el único que ve si la plantilla lo muestra.
 * Es el mismo motivo por el que B-804 pide que el gate siembre el monto.
 *
 * **Y NO se afirma sobre el `events.json`, que es lo primero que se intentó.**
 * Ese archivo no es la proyección: es el **índice recortado** de B-106
 * (`entradaDeIndice`, una whitelist propia con lo que el listado necesita), y las
 * comisiones no están ahí porque el listado no agrupa — muestra una tarjeta por
 * actividad. La página de detalle no lo lee: se genera en el build desde
 * `toPublic` directo (§2.4). El barrido de centinelas llama «events.json» a la
 * proyección, y esa diferencia de nombre es justo la que hizo escribir el aserto
 * equivocado.
 */
const ETIQUETA_DE_COMISION = 'gate.comisiones.etiqueta';

/**
 * La etiqueta de «qué se llevan» (B-830), que **sí sale** al HTML de la página —
 * y por eso se afirma en la dirección contraria, como `ID_DE_SESION_QUE_SALE`.
 *
 * **No se siembra `/opciones/incluye-actividad`**, y no hace falta: sin el
 * documento, `etiquetaDe` cae a `desSlug` y la página imprime la etiqueta
 * derivada del slug del fixture. Eso alcanza para lo único que este gate puede
 * ver y ningún unitario puede: **que la plantilla pinte la sección**. El
 * `.astro` no se importa desde vitest (D-140), así que `detallePublico.ts` afirma
 * qué se decide mostrar y esto ve si se muestra. Es el mismo motivo por el que
 * existe `ETIQUETA_DE_COMISION`.
 *
 * Si algún día el gate siembra `/opciones/*` —lo pide B-804 para el monto—, este
 * valor pasa a ser la etiqueta sembrada y el aserto no cambia de forma.
 */
const ETIQUETA_DE_INCLUYE = 'Gate Incluye Slug';

/**
 * **El monto del arancel: el único centinela numérico del gate** — B-804.
 *
 * El paso 9 barre todo `dist/` buscando los centinelas de `CENTINELA`, que son
 * strings, y la semilla cargaba `arancel: { tipo: 'gratis', notas }`: sin monto,
 * y con un tipo que además **no lo admite**. O sea que el barrido sobre el
 * artefacto de verdad no sembraba ni buscaba el campo nuevo, y la afirmación de
 * esa salida pasaba sin haber tenido el dato. La decisión de B-114 quedó
 * declarada en el barrido de vitest —que la cubre bien, en las dos formas— y en
 * nada acá: es la asimetría de B-99/B-180 al revés, la misma que ya cobraron
 * `comisionId` y `incluyeSlug`.
 *
 * Va **por valor y no por texto**, como en `tests/fixtures/centinelas.ts`: el
 * schema declara el monto entero, así que `gate.arancel.monto` no podría
 * guardarse. `7654321` no aparece en ningún otro lado del repo ni sale de ningún
 * cálculo del sitio, así que encontrarlo en un archivo del `dist/` es porque
 * salió de este campo.
 *
 * **Y hay dos formas, no una.** El número crudo viaja a las salidas JSON (el
 * índice, el `Offer` del JSON-LD) y la forma legible a las de texto (la línea
 * del precio, la tarjeta). Buscar una sola daría verde en la mitad de las
 * salidas por el motivo equivocado — es la trampa que B-114 ya había pisado del
 * lado de vitest.
 */
const MONTO_DEL_GATE = 7654321;

/** El slug de arancel que **admite** monto (`SIN_COSTO` no lo admite). */
const ARANCEL_CON_MONTO = 'arancelado';

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
  /*
   * B-181 — una comisión, con su único encuentro adentro. Alcanza una: lo que el
   * gate mira es que la plantilla **agrupe** —que aparezca el encabezado y que el
   * título de la sección cambie—, y eso ya pasa con un grupo. Con dos, el mismo
   * aserto costaría dos sesiones más y no probaría nada nuevo.
   */
  comisiones: [{ id: CENTINELA.comisionId, etiqueta: ETIQUETA_DE_COMISION }],
  // B-830 — un solo slug: lo que se prueba es el par slug-oculto/etiqueta-visible,
  // y con dos el mensaje de falla no diría cuál se escapó.
  incluye: [CENTINELA.incluyeSlug],
  sesiones: [
    {
      id: ID_DE_SESION_QUE_SALE,
      inicio: enUnaHora(24),
      fin: enUnaHora(26),
      tema: CENTINELA.tema,
      lectura: CENTINELA.lectura,
      cancelada: false,
      calendarEventId: null,
      comisionId: CENTINELA.comisionId,
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
 * Lo que el **`events.json`** publica a propósito y este gate creía privado.
 *
 * `sesionId` es el **id de sesión**, y desde **B-99** el índice lleva un eje plano
 * de encuentros (`{slug, sesionId, inicio}`). Es un uuid opaco generado en el
 * cliente (trampa 2), sin PII, y ya era público en la página de detalle — está en
 * `CENTINELA_DEL_DETALLE` de arriba. `tests/barrido-de-salidas-publicas.test.ts`
 * lo declaró en su `PERMITIDO_EN_EL_INDICE` («el eje plano de encuentros (B-99)»)
 * cuando la salida nació; **este archivo no se actualizó en el mismo cambio**, así
 * que el paso 3 quedó fallando por un campo que se publica a propósito.
 *
 * Eso es el modo de falla de B-180 en vivo —un gate que falla por su propia
 * plomería enseña a saltearlo— y explica por qué se descubrió recién al escribir
 * el paso 9: hay que correr el gate para verlo, y el gate estaba rojo.
 *
 * **La lista de al lado es la autoritativa.** Cuando un campo nuevo entre a una
 * salida, se declara **en las dos**: allá sobre el view-model, acá sobre el
 * artefacto. Ver la nota de `docs/13-agentes.md` sobre por qué los dos barridos
 * existen y no se reemplazan.
 */
const CENTINELA_DEL_INDICE = [];

/*
 * **Está vacía a propósito, y no le falta el id de sesión.** Cuando este barrido
 * del artefacto se escribió, `sesionId` era un centinela de `CENTINELA` —la lista
 * de lo que el índice recorta— y había que declararlo como excepción acá. Al
 * integrar se resolvió del otro lado y mejor: el id **salió de `CENTINELA`** y se
 * afirma en la dirección contraria, o sea que el gate exige que **aparezca**
 * (`ID_DE_SESION_QUE_SALE`). Una excepción es un permiso que hay que recordar;
 * un aserto positivo se rompe solo el día que el campo deje de salir.
 */

/**
 * Lo que la **cartelera** publica a propósito.
 *
 * `/cartelera` muestra los flyers con su epígrafe debajo, que es exactamente para
 * lo que D-125 agregó el campo — el mismo criterio con el que está permitido en la
 * página de detalle. No publica nada más de la actividad que el índice no lleve:
 * eso es lo que el paso 9 verifica barriéndole todo el resto de la lista.
 */
const CENTINELA_DE_LA_CARTELERA = ['epigrafeImagen'];

/**
 * **La quinta canasta: el directorio de librerías** — B-901.
 *
 * `/librerias.json`, `/guia/librerias/` y cada `/guia/librerias/{slug}/` publican
 * a propósito la descripción y la dirección de la librería: son los datos de un
 * **local comercial** y son el punto de la ficha (§ 8 del PRD 2).
 *
 * **Lo que no está acá es la mitad que importa**, y por eso la lista es corta:
 * `libreriaContacto`, `libreriaMotivo` y `libreriaPendiente` quedan prohibidos en
 * los tres archivos igual que en todo el resto del `dist/`. Y `storagePath`
 * tampoco está: la ficha publica la URL de cada imagen, nunca su handle interno
 * en el bucket (trampa 13).
 */
const CENTINELA_DEL_DIRECTORIO = ['libreriaDescripcion', 'libreriaDireccion'];

/**
 * **La sexta canasta: el directorio de suscripciones literarias** — B-832.
 *
 * `/suscripciones.json`, `/guia/suscripciones/` y cada
 * `/guia/suscripciones/{slug}/` publican a propósito la descripción y la temática
 * de lo que manda: es el punto de la ficha (§ 5 del PRD 3).
 *
 * **Lo que no está acá es la mitad que importa**: `suscripcionContacto`,
 * `suscripcionMotivo` y `suscripcionPendiente` quedan prohibidos en los tres
 * archivos igual que en todo el resto del `dist/`. Y `storagePath` tampoco está.
 */
const CENTINELA_DE_SUSCRIPCIONES = ['suscripcionDescripcion', 'suscripcionTematica'];

/**
 * **La cuarta canasta** — B-804.
 *
 * Las tres de arriba (`actividad/`, `events.json`, `cartelera/`) alcanzaban
 * mientras lo que se barría era el contenido que **solo** la página de detalle
 * publica. El monto rompe esa forma y por eso el ítem no era copiar y pegar:
 * lo imprime la **tarjeta compartida**, así que sale en la home, en las páginas
 * de mes, en `/pasadas` y en los hubs. Con el modelo de tres canastas y `[]`
 * para todo lo demás, sembrar el monto los pone a todos en rojo — y ese rojo no
 * es un bug, es esta lista pidiendo que se escriba (incluida la celda de
 * `/pasadas` que D-500 dejó anotada).
 *
 * Es una lista y no un `else`: una página nueva que pinte la tarjeta entra en
 * rojo hasta que alguien la agregue, que es la decisión que hay que tomar una
 * vez por salida. Lo que no puede pasar es que entre sola. Y no inventa alcance:
 * es el párrafo de **D-500** —«las páginas que pintan la tarjeta del listado: la
 * de mes, los hubs y `/pasadas`»— hecho mecánico.
 *
 * **De esta lista, la semilla de este gate produce dos:** `index.html` y
 * `online/`. Las otras están por adelantado y no por las dudas — la tarjeta es
 * la misma productora en todas—, y no aparecen por motivos que son del fixture
 * y no del sitio: las páginas de mes piden tres actividades
 * (`MINIMO_DE_ACTIVIDADES`) y acá se siembran dos publicadas, los hubs de
 * taxonomía piden que el slug esté en `/opciones/*` y el gate no lo siembra, y
 * `/pasadas` pide una actividad que ya pasó. Un build de verdad las tiene todas,
 * y ahí es donde una omisión saldría en rojo por el motivo equivocado.
 */
const PAGINAS_CON_TARJETA = [
  'index.html', // la home
  'agenda/', // las páginas de mes (B-107)
  'pasadas/', // D-500
  'tipo/', // los hubs de taxonomía
  'barrio/',
  'online/',
  'gratis/',
];

const pintaLaTarjeta = (relativa) =>
  PAGINAS_CON_TARJETA.some((p) => (p.endsWith('/') ? relativa.startsWith(p) : relativa === p));

/**
 * Las dos formas del monto, cada una con los archivos donde **sí** puede
 * aparecer — B-804.
 *
 * `permitido` es una función y no una lista de nombres porque las dos formas no
 * comparten canasta: el número crudo sale al índice y al JSON-LD, y la forma
 * legible a todo lo que pinte la tarjeta. Un campo cuyo permiso depende de la
 * forma en que se escribe es el primero que hay, y meterlo a la fuerza en el
 * modelo de canastas habría pedido declararlo mal en una de las dos.
 */
const MONTO_EN_EL_ARTEFACTO = [
  {
    campo: 'montoCrudo',
    valor: String(MONTO_DEL_GATE),
    permitido: (r) => r === 'events.json' || r.startsWith('actividad/'),
    donde: 'el `events.json` (el índice lleva el número, B-114) y el `Offer` del JSON-LD',
  },
  {
    campo: 'montoLegible',
    valor: montoLegible(MONTO_DEL_GATE),
    permitido: (r) => r.startsWith('actividad/') || pintaLaTarjeta(r),
    donde: 'la página de detalle y las páginas que pintan la tarjeta compartida',
  },
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
  const [actividades, usuarios, librerias, suscripciones] = await Promise.all([
    borrar('actividades'),
    borrar('usuarios'),
    borrar('librerias'),
    borrar('suscripciones'),
  ]);
  return actividades + usuarios + librerias + suscripciones;
};

const fallo = (mensaje) => {
  console.error(`\n\x1b[31m✗ ${mensaje}\x1b[0m`);
  process.exitCode = 1;
};

let salida = 0;

try {
  await limpiar();

  /*
   * B-804 — la publicada es la que lleva el monto, y con un tipo de arancel que
   * lo admite: `SIN_COSTO` lo rechaza, así que sembrarlo sobre `gratis` habría
   * dejado el campo en el documento y fuera de todas las salidas (`admiteMonto`
   * lo descarta en el view-model), o sea un barrido verde sin haber tenido el
   * dato — el mismo agujero con otra forma.
   *
   * Las otras cuatro se quedan en `gratis`, que es lo que mantiene con contenido
   * al hub `/gratis` y deja las **dos** ramas de `admiteMonto` sembradas.
   */
  const publicada = actividadDePrueba(SLUG_PUBLICADA, 'publicado');
  publicada.arancel = {
    tipo: ARANCEL_CON_MONTO,
    notas: CENTINELA.arancelNotas,
    monto: MONTO_DEL_GATE,
  };
  await db.doc(`actividades/${ID_PUBLICADA}`).set(publicada);
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

  /*
   * B-901 — el directorio de librerías, con el par que hace al gate útil.
   *
   * La publicada lleva los dos centinelas que **sí** salen (descripción y
   * dirección) y los dos que **no** (el contacto de quien la cargó y el motivo de
   * la revisión), más el `storagePath` de su imagen. La pendiente lleva un
   * centinela propio que no puede aparecer en un solo archivo del `dist/`: es el
   * control del `where` de la lectura.
   *
   * El `origen` es `'formulario-publico'` en las dos a propósito: es la rama en la
   * que el `contactoDeQuienCargo` existe de verdad, que es lo que se está
   * barriendo.
   */
  const libreria = (slug, estado, descripcion) => ({
    nombre: `Gate libreria ${estado}`,
    slug,
    descripcion,
    imagenes: [
      {
        id: 'img_gate_libreria',
        url: 'https://example.invalid/gate-libreria.jpg',
        epigrafe: '',
        origen: 'propia',
        storagePath: CENTINELA.storagePath,
        ancho: 1200,
        alto: 800,
        portada: true,
      },
    ],
    direccion: CENTINELA.libreriaDireccion,
    barrio: 'gate-barrio',
    ciudad: 'Ciudad de Buenos Aires',
    geo: { lat: -34.6, lng: -58.43 },
    instagram: 'gatelibreria',
    whatsapp: '5491100000001',
    web: 'https://example.invalid/gate-libreria',
    mail: 'gate@example.invalid',
    contactoDeQuienCargo: { via: 'mail', valor: CENTINELA.libreriaContacto },
    estado,
    origen: 'formulario-publico',
    searchText: descripcion,
    creadoEn: new Date('2026-09-01T12:00:00Z'),
    revision: {
      porUid: CENTINELA.createdBy,
      en: new Date('2026-09-02T12:00:00Z'),
      motivo: CENTINELA.libreriaMotivo,
    },
    publicadaAlgunaVez: estado === 'publicado',
  });

  await db
    .doc(`librerias/${ID_LIBRERIA}`)
    .set(libreria(SLUG_LIBRERIA, 'publicado', CENTINELA.libreriaDescripcion));
  await db
    .doc(`librerias/${ID_LIBRERIA_PENDIENTE}`)
    .set(libreria(SLUG_LIBRERIA_PENDIENTE, 'pendiente', CENTINELA.libreriaPendiente));

  /*
   * B-832 — el directorio de suscripciones, con el mismo par que hace útil al
   * gate y con **un precio**: el monto del gate (`18246813`) formateado es
   * `$18.246.813`, que no aparece por casualidad en ningún otro archivo, así que
   * el paso 8j lo puede buscar y exigir que **nunca** esté sin su «cargado el»
   * al lado (DEC-12).
   *
   * El `origen` es `'formulario-publico'` en las dos a propósito: es la rama en
   * la que el `contactoDeQuienCargo` existe de verdad.
   */
  const suscripcion = (slug, estado, descripcion) => ({
    nombre: `Gate suscripcion ${estado}`,
    slug,
    descripcion,
    imagenes: [
      {
        id: 'img_gate_suscripcion',
        url: 'https://example.invalid/gate-suscripcion.jpg',
        epigrafe: '',
        origen: 'propia',
        storagePath: CENTINELA.storagePath,
        ancho: 1200,
        alto: 800,
        portada: true,
      },
    ],
    ofrecidaPor: {
      nombre: 'Gate oferente',
      tipo: 'libreria',
      instagram: 'gatesuscripcion',
      // A propósito apunta a la librería **publicada** del gate: así el paso 8j
      // puede exigir que la ficha la enlace, que es la mitad que confirma que el
      // build resolvió la lista de librerías y no linkeó a ciegas.
      libreriaSlug: SLUG_LIBRERIA,
    },
    periodicidad: 'mensual',
    compromisoMinimo: 'Sin compromiso',
    incluye: ['libros'],
    incluyeOtro: null,
    envio: {
      manda: true,
      cuantos: 2,
      tematica: CENTINELA.suscripcionTematica,
      editoriales: 'independientes',
      sorpresa: true,
    },
    extras: [],
    extrasOtro: null,
    precio: {
      valor: { monto: 18246813, porPeriodo: 'mensual' },
      cargadoEn: new Date('2026-09-01T12:00:00Z'),
    },
    alcance: ['caba'],
    linkDeSuscripcion: 'https://example.invalid/gate-cobro',
    instagram: 'gatesuscripcion',
    whatsapp: '5491100000002',
    mail: 'gate-sus@example.invalid',
    contactoDeQuienCargo: { via: 'mail', valor: CENTINELA.suscripcionContacto },
    estado,
    origen: 'formulario-publico',
    searchText: descripcion,
    creadoEn: new Date('2026-09-01T12:00:00Z'),
    revision: {
      porUid: CENTINELA.createdBy,
      en: new Date('2026-09-02T12:00:00Z'),
      motivo: CENTINELA.suscripcionMotivo,
    },
    publicadaAlgunaVez: estado === 'publicado',
  });

  await db
    .doc(`suscripciones/${ID_SUSCRIPCION}`)
    .set(suscripcion(SLUG_SUSCRIPCION, 'publicado', CENTINELA.suscripcionDescripcion));
  await db
    .doc(`suscripciones/${ID_SUSCRIPCION_PENDIENTE}`)
    .set(suscripcion(SLUG_SUSCRIPCION_PENDIENTE, 'pendiente', CENTINELA.suscripcionPendiente));

  // B-888 — la cuenta del panel con su mail. No la lee ninguna parte del build;
  // se siembra para que el barrido del paso 9 tenga qué encontrar el día que
  // alguien la conecte a una salida. Ver `CENTINELA.mailDePanel`.
  await db.doc(`usuarios/${PREFIJO}cuenta`).set({
    email: CENTINELA.mailDePanel,
    actualizadoEn: new Date('2026-09-11T12:00:00Z'),
  });

  console.log(
    `  (sembradas 5 actividades de prueba en ${host}: publicada, borrador, dos canceladas y ` +
      'una con tres imágenes; 2 librerías y 2 suscripciones, cada par con una ' +
      'publicada y una esperando decisión)',
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
      `  ⚠ no se pudieron borrar los documentos de prueba (prefijo ${PREFIJO}): ` +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

process.exit(salida);
