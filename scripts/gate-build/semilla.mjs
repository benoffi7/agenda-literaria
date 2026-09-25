/**
 * La semilla del paso 4 del gate: los documentos que se siembran, los centinelas
 * que llevan adentro y las canastas de lo que cada salida publica a propósito —
 * corte 1 de D-1070 (B-1760).
 *
 * **Datos puros, sin efectos al cargarse.** No importa `firebase-admin`, no lee
 * el entorno y no toca el disco: por eso lo puede importar vitest, que es lo que
 * faltaba para que un test compare estas canastas con las del barrido de
 * `tests/barrido-de-salidas-publicas.test.ts` (B-1761). Mientras vivían adentro
 * de `build-contra-emulador.mjs` —que siembra al cargarse— no había forma, y
 * «se declara en los dos» ya había fallado cuatro veces.
 *
 * Lo que **escribe** los documentos sigue en el script: acá solo se dice qué va
 * a dónde (`documentosDeLaSemilla`).
 */
// B-804 — el número lo escribe el mismo código que lo publica. Escribir
// `'$7.654.321'` a mano acá sería una segunda derivación de la misma idea, que
// es cómo se separan los formatos (§ «si hay un skill, se usa», mismo motivo).
import { montoLegible } from '../../functions/calendario.js';

/**
 * El prefijo de los ids sembrados.
 *
 * Con prefijo y no con ids sueltos para que la limpieza pueda barrer también lo
 * que haya quedado de una corrida anterior que murió a mitad de camino.
 */
export const PREFIJO = 'zz-gate-verificar-todo-';
export const ID_PUBLICADA = `${PREFIJO}publicada`;
/*
 * **La publicada de afuera de CABA** — B-969, abierto por el `auditor-privacidad`
 * sobre B-950.
 *
 * Hasta acá el gate sembraba una sola geografía —`ciudad: 'CABA'`, sin
 * `provincia`—, así que el paso 9 (el único chequeo que mira el HTML realmente
 * emitido) **nunca ejercitaba** la mitad no-CABA de la cascada ni ninguna página
 * `/ciudad/*`. Y esa mitad es la mitad del pedido de B-950.
 *
 * No es hipotético: el bug que se escapó a los unitarios fue exactamente de esa
 * forma —`SedeDeIndice` sin `provincia`, o sea el eje muerto para todo lo que no
 * fuera CABA— y ningún test lo vio porque todos le pasaban la otra forma del
 * mismo dato. Un build real con una sede de afuera lo habría mostrado.
 */
export const ID_AFUERA = `${PREFIJO}afuera`;
export const SLUG_AFUERA = `${PREFIJO}afuera`;
/**
 * El slug de ciudad del gate, y **por qué no es `mar-del-plata`**.
 *
 * Tiene que ser un valor que no pueda existir en el emulador de quien corre
 * esto: el gate siembra este slug en `/opciones/ciudad` para que el hub se emita,
 * y si coincidiera con una ciudad real, la restauración de abajo —que devuelve
 * `valores` a como estaba— sería indistinguible de borrarle un dato suyo.
 */
export const CIUDAD_DEL_GATE = `${PREFIJO}ciudad`;
export const ETIQUETA_CIUDAD_DEL_GATE = 'Ciudad del gate';
/**
 * La provincia **no se siembra** en `/opciones/provincia`, y es a propósito: sin
 * el documento, `etiquetaDe` cae a `desSlug`, que sobre `buenos-aires` devuelve
 * «Buenos Aires» — o sea la etiqueta correcta sin tocar una taxonomía que el
 * emulador de quien trabaja sí tiene poblada de verdad. Es el mismo criterio con
 * el que el gate no siembra `/opciones/incluye-actividad`.
 */
export const PROVINCIA_DEL_GATE = 'buenos-aires';
export const ETIQUETA_PROVINCIA_DEL_GATE = 'Buenos Aires';
export const ID_BORRADOR = `${PREFIJO}borrador`;
/*
 * B-110 — las dos canceladas. La primera **estuvo publicada** (conserva el
 * `calendarEventId` de una de sus sesiones, que es la heurística del §7.3) y
 * tiene que tener su HTML; la segunda nació y murió en `cancelado`, así que no
 * tiene que existir. Son la mitad de este gate que mira la **página** y no el
 * `events.json`: el modo de falla de B-110 es un archivo HTML que se genera o no
 * se genera, y eso no se ve en el índice.
 */
export const ID_CANCELADA = `${PREFIJO}cancelada`;
export const ID_CANCELADA_NUNCA = `${PREFIJO}cancelada-nunca`;
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
export const ID_GALERIA = `${PREFIJO}galeria`;

export const SLUG_PUBLICADA = `${PREFIJO}publicada`;
export const SLUG_BORRADOR = `${PREFIJO}borrador`;
export const SLUG_CANCELADA = `${PREFIJO}cancelada`;
export const SLUG_CANCELADA_NUNCA = `${PREFIJO}cancelada-nunca`;
export const SLUG_GALERIA = `${PREFIJO}galeria`;

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
export const ID_SUSCRIPCION = `${PREFIJO}suscripcion`;
export const ID_SUSCRIPCION_PENDIENTE = `${PREFIJO}suscripcion-pendiente`;
export const SLUG_SUSCRIPCION = `${PREFIJO}suscripcion`;
export const SLUG_SUSCRIPCION_PENDIENTE = `${PREFIJO}suscripcion-pendiente`;

/**
 * **Los tres lugares del gate** — B-833. Son **tres y no dos**, y el tercero es
 * el que hace útil a este paso: además del par publicado/pendiente que las otras
 * dos colecciones tienen, va **una casa publicada con la dirección apagada**.
 *
 * Ese documento es el único del gate que existe para probar una **ausencia
 * condicional**: su dirección está en Firestore, la ficha se genera, la página se
 * indexa — y la dirección no puede aparecer en ningún archivo del `dist/`. Es el
 * § 6 del PRD 4 verificado contra el artefacto y no contra la intención, que es
 * lo que ningún unitario puede hacer: el barrido mira la función pura, y una
 * plantilla que interpole `ficha.donde.direccion` en un `title=` pasa aquél y
 * muere acá.
 */
export const ID_LUGAR = `${PREFIJO}lugar`;
export const ID_LUGAR_PENDIENTE = `${PREFIJO}lugar-pendiente`;
export const ID_LUGAR_CASA = `${PREFIJO}lugar-casa`;
export const SLUG_LUGAR = `${PREFIJO}lugar`;
export const SLUG_LUGAR_PENDIENTE = `${PREFIJO}lugar-pendiente`;
export const SLUG_LUGAR_CASA = `${PREFIJO}lugar-casa`;

/**
 * **Las dos bibliotecas del gate** — B-960. El par publicada/pendiente, como
 * librerías y suscripciones; no hace falta un tercer documento como la casa de
 * lugares, porque bibliotecas no tiene ninguna ausencia condicional: su dirección
 * sale siempre.
 *
 * **Entraron en el pase de auditores y no con el frente**, que es el hallazgo que
 * las trajo: el paso de esta colección no existía, así que el barrido del paso 9
 * recorría `dist/bibliotecas.json` y `dist/guia/bibliotecas/**` **sin un solo
 * centinela que pudiera encontrar** y pasaba trivialmente. Un barrido sin nada
 * que buscar es verde por vacuidad, que es la clase de B-873 en su forma más
 * pura.
 */
export const ID_BIBLIOTECA = `${PREFIJO}biblioteca`;
export const ID_BIBLIOTECA_PENDIENTE = `${PREFIJO}biblioteca-pendiente`;
export const SLUG_BIBLIOTECA = `${PREFIJO}biblioteca`;
export const SLUG_BIBLIOTECA_PENDIENTE = `${PREFIJO}biblioteca-pendiente`;
/**
 * La latitud de la casa del gate — **un número que no aparece en ningún otro
 * lado**, ni del gate ni del sitio.
 *
 * Es lo que hace verificable la mitad numérica del § 6: el barrido del paso 9
 * busca strings centinela y una coordenada no lo es, así que la `geo` de la casa
 * necesita su propia ancla por valor. Ver el paso 8k.7.
 */
export const LAT_DE_LA_CASA = -33.000123;

export const ID_LIBRERIA = `${PREFIJO}libreria`;
export const ID_LIBRERIA_PENDIENTE = `${PREFIJO}libreria-pendiente`;
export const SLUG_LIBRERIA = `${PREFIJO}libreria`;
export const SLUG_LIBRERIA_PENDIENTE = `${PREFIJO}libreria-pendiente`;

/**
 * Los centinelas de los campos que el índice recorta (§3.1 del diseño de B-106).
 *
 * Igual que en `tests/fixtures/centinelas.ts`, **el valor dice la ruta**: si uno
 * se escapa, el mensaje de falla nombra el campo sin que haya que traducir nada.
 * Y son URL-safe, para que una fuga por un camino que escape la cadena no quede
 * invisible.
 */
export const CENTINELA = {
  descripcion: 'gate.descripcion.centinela',
  destino: 'gate.inscripcion.destino',
  direccion: 'gate.sede.direccion',
  indicaciones: 'gate.sede.indicaciones',
  tema: 'gate.sesiones.tema',
  lectura: 'gate.sesiones.lectura',
  /*
   * B-1572 — el motivo de un encuentro cancelado (D-976). Sale a la página de
   * detalle y **a nada más**: ni al `events.json`, ni al JSON-LD, ni a la
   * tarjeta. Lo siembra solo el encuentro cancelado de la galería
   * (`encuentroCanceladoDelGate`); ver el paso 8m.
   */
  motivoCancelacion: 'gate.sesiones.motivoCancelacion',
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
  /*
   * ── B-833 · los lugares para eventos ────────────────────────────────────
   *
   * Los dos primeros **salen a propósito** y tienen su canasta abajo: la
   * descripción, y la dirección **de un local comercial** cuyo flag está
   * prendido.
   *
   * Los otros cuatro **no salen a ninguna parte**, y el tercero es el que hace
   * que este paso valga:
   *
   *  - `lugarContacto` es el `contactoDeQuienCargo`;
   *  - `lugarMotivo` es por qué un admin descartó una ficha;
   *  - `lugarPendiente` es la descripción de uno que **espera decisión**, o sea
   *    el control del `where('estado','==','publicado')` de la lectura;
   *  - ⚠️ **`lugarDireccionDeCasa` es la dirección de un lugar PUBLICADO cuyo
   *    `direccionPublica` está en `false`** (§ 6 del PRD 4). Su ficha se genera,
   *    su página se indexa, su JSON viaja — y esta cadena no puede aparecer en
   *    **ningún** archivo del `dist/`. No hace falta ninguna cláusula especial
   *    para vigilarlo: al no estar en la canasta de abajo, el barrido del paso 9
   *    lo prohíbe en todos lados, que es exactamente lo que corresponde.
   */
  lugarDescripcion: 'gate.lugar.descripcion',
  lugarDireccion: 'gate.lugar.direccion',
  lugarContacto: 'gate.lugar.contactoDeQuienCargo',
  lugarMotivo: 'gate.lugar.revision.motivo',
  lugarPendiente: 'gate.lugar.pendiente.descripcion',
  lugarDireccionDeCasa: 'gate.lugar.casa.direccion',
  /*
   * B-960 — la cuarta colección de la Guía. `bibliotecaDescripcion` y
   * `bibliotecaDireccion` salen a propósito (son los datos de una institución con
   * puerta, y son el punto de la ficha); los otros tres quedan prohibidos en todo
   * el `dist/`, igual que sus hermanos de las otras tres colecciones.
   */
  bibliotecaDescripcion: 'gate.biblioteca.descripcion',
  bibliotecaDireccion: 'gate.biblioteca.direccion',
  bibliotecaContacto: 'gate.biblioteca.contactoDeQuienCargo',
  bibliotecaMotivo: 'gate.biblioteca.revision.motivo',
  bibliotecaPendiente: 'gate.biblioteca.pendiente.descripcion',
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
export const ID_DE_SESION_QUE_SALE = 'ses_gate.sesiones.id';

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
export const ETIQUETA_DE_COMISION = 'gate.comisiones.etiqueta';

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
export const ETIQUETA_DE_INCLUYE = 'Gate Incluye Slug';

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
export const MONTO_DEL_GATE = 7654321;

/** El slug de arancel que **admite** monto (`SIN_COSTO` no lo admite). */
export const ARANCEL_CON_MONTO = 'arancelado';

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
export const actividadDePrueba = (slug, estado) => ({
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
 * afirmación es sobre el view-model; acá, sobre el HTML que se sube. Desde
 * B-1761 un test de aquel archivo compara las dos —y las del índice y la
 * cartelera— con `RUTA_DEL_CENTINELA_DEL_GATE` como traducción de nombres. Las cuatro de la Guía se comparan desde B-1812 con `RUTA_EN_LA_GUIA`, contra las listas de `tests/fixtures/canastas-de-la-guia.ts`.
 */
export const CENTINELA_DEL_DETALLE = [
  'descripcion',
  'destino',
  'direccion',
  'indicaciones',
  'tema',
  'lectura',
  /*
   * B-1810 — acá estaba `'sesionId'`, que **no es una clave de `CENTINELA`**
   * desde B-99: el id de sesión sale a propósito y se afirma en la dirección
   * contraria (`ID_DE_SESION_QUE_SALE`). La entrada no permitía nada y no
   * avisaba; ahora `tests/gate-build.test.ts` frena una canasta que nombre algo
   * que no existe.
   */
  'bio',
  'talleristaInstagram',
  'organizadorInstagram',
  'organizadorWeb',
  'arancelNotas',
  'materialTitulo',
  'materialUrl',
  // B-296 — el epígrafe de una imagen se muestra debajo de esa imagen (D-125).
  'epigrafeImagen',
  /*
   * B-1572 — el motivo de un encuentro cancelado, debajo de ese encuentro
   * (D-976): es el anuncio que reemplaza al borrado del evento (§7.3), y lo que
   * distingue «se pasa al jueves» de «se suspende». Es el mismo permiso que
   * `MOTIVO_DE_CANCELACION` en `tests/barrido-de-salidas-publicas.test.ts`.
   *
   * El permiso es **del archivo** y el JSON-LD vive adentro del mismo HTML, así
   * que esta canasta sola lo dejaría pasar ahí también: por eso el paso 8m mira
   * los bloques `application/ld+json` por separado.
   */
  'motivoCancelacion',
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
export const CENTINELA_DEL_INDICE = [];

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
export const CENTINELA_DE_LA_CARTELERA = ['epigrafeImagen'];

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
export const CENTINELA_DEL_DIRECTORIO = ['libreriaDescripcion', 'libreriaDireccion'];

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
export const CENTINELA_DE_SUSCRIPCIONES = ['suscripcionDescripcion', 'suscripcionTematica'];

/**
 * **La séptima canasta: el directorio de lugares para eventos** — B-833.
 *
 * `/lugares.json`, `/guia/lugares/` y cada `/guia/lugares/{slug}/` publican a
 * propósito la descripción y **la dirección de un local comercial**: son los
 * datos de un lugar con puerta y son el punto de la ficha (§ 6 del PRD 4).
 *
 * **Lo que no está acá es la mitad que importa**, y esta canasta es la única del
 * gate donde eso incluye una **ausencia condicional**: `lugarDireccionDeCasa` es
 * la dirección de un lugar **publicado** cuyo flag está apagado, y queda
 * prohibida en los tres archivos igual que en todo el resto del `dist/`.
 * `lugarContacto`, `lugarMotivo` y `lugarPendiente`, lo mismo. Y `storagePath`
 * tampoco está.
 */
export const CENTINELA_DE_LUGARES = ['lugarDescripcion', 'lugarDireccion'];

/**
 * **La octava canasta: el directorio de bibliotecas** — B-960.
 *
 * `/bibliotecas.json`, `/guia/bibliotecas/` y cada `/guia/bibliotecas/{slug}/`
 * publican a propósito la descripción y la dirección: son los datos de una
 * institución con puerta y son el punto de la ficha.
 *
 * **Lo que no está acá es la mitad que importa**: `bibliotecaContacto`,
 * `bibliotecaMotivo` y `bibliotecaPendiente` quedan prohibidos en los tres
 * archivos igual que en todo el resto del `dist/`. Y `storagePath` tampoco está.
 *
 * ⚠️ **Sin esta canasta el barrido no era laxo: era vacío.** Hasta el pase de
 * auditores de B-960 el gate no sembraba ninguna biblioteca, así que los archivos
 * de esta sección se recorrían sin que existiera un solo valor que pudiera
 * aparecer en ellos. Verde por vacuidad.
 */
export const CENTINELA_DE_BIBLIOTECAS = ['bibliotecaDescripcion', 'bibliotecaDireccion'];

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
 * **De esta lista, la semilla de este gate produce tres:** `index.html`,
 * `online/` y —desde B-969— `ciudad/`. Las otras están por adelantado y no por
 * las dudas — la tarjeta es la misma productora en todas—, y no aparecen por
 * motivos que son del fixture y no del sitio: las páginas de mes piden tres
 * actividades (`MINIMO_DE_ACTIVIDADES`), los hubs de `tipo` y `barrio` piden que
 * el slug esté en `/opciones/*` y el gate **solo siembra el de ciudad**, y
 * `/pasadas` pide una actividad que ya pasó. Un build de verdad las tiene todas,
 * y ahí es donde una omisión saldría en rojo por el motivo equivocado.
 *
 * **Por qué `ciudad` sí y las otras dos no** (B-969): sembrar `/opciones/*` es
 * tocar un documento de id fijo en el emulador de quien trabaja, así que hay que
 * sacarlo después por prefijo (`sembrarCiudadDelGate`/`limpiarCiudadDelGate`), que
 * es lo que hace que una corrida interrumpida la repare la siguiente. Se
 * paga ese costo una vez, por la clase que no tenía **ninguna** cobertura sobre
 * el artefacto real: la geografía de afuera de CABA. Para `tipo` y `barrio` no
 * hace falta — la clase de hub ya está barrida por la de ciudad, que comparte
 * productora.
 */
export const PAGINAS_CON_TARJETA = [
  'index.html', // la home
  'agenda/', // las páginas de mes (B-107)
  'pasadas/', // D-500
  'tipo/', // los hubs de taxonomía
  'barrio/',
  'ciudad/', // B-951 — la quinta clase
  'online/',
  'gratis/',
];

export const pintaLaTarjeta = (relativa) =>
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
export const MONTO_EN_EL_ARTEFACTO = [
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
export const TRES_IMAGENES = [
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

/**
 * **El encuentro cancelado con motivo** — B-1572, sobre D-976.
 *
 * Hasta acá ningún encuentro sembrado estaba cancelado —la cancelada de B-110 es
 * la **actividad** entera, con sus encuentros vivos—, así que `motivoCancelacion`
 * no existía en el `dist/` y el gate afirmaba sobre un campo que nunca tuvo: los
 * barridos de vitest lo fijan sobre las funciones puras y el artefacto quedaba
 * sin testigo. Es la clase de B-804 (sembrar el dato para que el barrido tenga
 * qué encontrar).
 *
 * Va en la **galería** y no en la publicada porque la publicada es la que cargan
 * el sitemap, la canónica, el Open Graph y el agrupado por opción: un segundo
 * encuentro ahí movería asertos que no son de este ítem. La galería es publicada
 * igual, tiene página y JSON-LD, y sus asertos son de imágenes.
 *
 * Con la **misma comisión** que el vivo, para no abrir una segunda opción para
 * sumarse; sin tema ni lectura, para que el único texto nuevo de la fila sea el
 * motivo; y en el futuro, para que la fila se pinte como cancelada y no como
 * «ya pasó».
 */
export const encuentroCanceladoDelGate = () => ({
  id: 'ses_gate.sesiones.cancelada',
  inicio: enUnaHora(48),
  fin: enUnaHora(50),
  tema: null,
  lectura: null,
  cancelada: true,
  motivoCancelacion: CENTINELA.motivoCancelacion,
  calendarEventId: null,
  comisionId: CENTINELA.comisionId,
});

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
export const libreriaDePrueba = (slug, estado, descripcion) => ({
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
export const suscripcionDePrueba = (slug, estado, descripcion) => ({
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

/*
 * B-833 — el directorio de lugares, con **tres** documentos y no dos.
 *
 * El par publicado/pendiente es el de siempre. El tercero —una casa publicada
 * con `direccionPublica: false`— es lo propio de esta colección: existe para
 * que el paso 8k pueda afirmar una **ausencia condicional** sobre el `dist/`,
 * que es lo único que ningún unitario puede ver.
 */
export const lugarDePrueba = (slug, estado, descripcion, sobre = {}) => ({
  nombre: `Gate lugar ${estado}`,
  slug,
  descripcion,
  imagenes: [
    {
      id: 'img_gate_lugar',
      url: 'https://example.invalid/gate-lugar.jpg',
      epigrafe: '',
      origen: 'propia',
      storagePath: CENTINELA.storagePath,
      ancho: 1200,
      alto: 800,
      portada: true,
    },
  ],
  tipo: 'cafe',
  direccion: CENTINELA.lugarDireccion,
  // El barrio del gate: el mismo vocabulario que las actividades. Sale
  // **siempre**, también para la casa (§ 6: es el «más o menos por Villa
  // Crespo» que sí se publica).
  barrio: 'gate-barrio',
  ciudad: 'Ciudad de Buenos Aires',
  geo: { lat: -34.5875, lng: -58.4306 },
  direccionPublica: true,
  capacidad: 30,
  capacidadNotas: 'Sentados 20, de pie 35',
  incluye: ['mesa-larga'],
  incluyeOtro: null,
  condicion: 'con-consumicion',
  precio: {
    valor: { monto: 24681357, porUnidad: 'hora' },
    cargadoEn: new Date('2026-09-01T12:00:00Z'),
  },
  condicionNotas: 'Minimo de consumicion',
  instagram: 'gatelugar',
  whatsapp: '5491100000003',
  mail: 'gate-lugar@example.invalid',
  web: 'https://example.invalid/gate-lugar',
  contactoDeQuienCargo: { via: 'mail', valor: CENTINELA.lugarContacto },
  estado,
  origen: 'formulario-publico',
  // ⚠️ El `searchText` del gate **no lleva la dirección**, igual que el que
  // produce `formALugar`: sembrarlo con la dirección adentro haría que el
  // barrido del paso 9 fallara por el fixture y no por el sitio.
  searchText: descripcion,
  creadoEn: new Date('2026-09-01T12:00:00Z'),
  revision: {
    porUid: CENTINELA.createdBy,
    en: new Date('2026-09-02T12:00:00Z'),
    motivo: CENTINELA.lugarMotivo,
  },
  publicadaAlgunaVez: estado === 'publicado',
  ...sobre,
});

/*
 * **Las dos bibliotecas** — B-960. El par publicada/pendiente, con el mismo
 * molde que librerías y suscripciones.
 *
 * `asociarse` va con `haceFalta: true` y su costo **como frase con fecha**
 * (D-570, B-837): es la forma que la proyección publica, y sembrarla acá es lo
 * que permite que el `dist/` sea testigo de que salió como frase y nunca como
 * número suelto.
 */
export const bibliotecaDePrueba = (slug, estado, descripcion, sobre = {}) => ({
  nombre: `Gate biblioteca ${estado}`,
  slug,
  descripcion,
  imagenes: [
    {
      id: 'img_gate_biblioteca',
      url: 'https://example.invalid/gate-biblioteca.jpg',
      epigrafe: '',
      textoAlternativo: '',
      origen: 'propia',
      storagePath: CENTINELA.storagePath,
      ancho: 1200,
      alto: 800,
      portada: true,
    },
  ],
  tipo: 'popular',
  direccion: CENTINELA.bibliotecaDireccion,
  horarios: 'Lunes a viernes de 10 a 20',
  horarioDeSala: 'Lunes a viernes de 10 a 18',
  asociarse: {
    haceFalta: true,
    costo: { valor: '$3.000 por año', cargadoEn: new Date('2026-09-01T12:00:00Z') },
  },
  catalogo: 'https://example.invalid/gate-catalogo',
  provincia: 'ciudad-autonoma-de-buenos-aires',
  barrio: 'gate-barrio',
  ciudad: 'Ciudad de Buenos Aires',
  geo: { lat: -34.60009, lng: -58.43009 },
  instagram: 'gatebiblioteca',
  whatsapp: null,
  web: null,
  mail: null,
  contactoDeQuienCargo: { via: 'mail', valor: CENTINELA.bibliotecaContacto },
  estado,
  origen: 'formulario-publico',
  // Mismo criterio que las otras tres: el `searchText` del gate **no lleva la
  // dirección**, así que si aparece en el `dist/` es porque la publicó la
  // proyección y no porque viajó de contrabando en el índice de búsqueda.
  searchText: descripcion,
  creadoEn: new Date('2026-09-01T12:00:00Z'),
  revision: {
    porUid: CENTINELA.createdBy,
    en: new Date('2026-09-02T12:00:00Z'),
    motivo: CENTINELA.bibliotecaMotivo,
  },
  publicadaAlgunaVez: estado === 'publicado',
  ...sobre,
});

/**
 * **La miniatura del gate** — B-1790, sobre D-210.
 *
 * `leerMiniaturas()` (`src/lib/contenidoDelSitio.ts`) lista `miniaturas/` en
 * Storage **una vez por build** y el sitio pone la miniatura en el `srcset` solo
 * si está confirmada ahí. Hasta B-1790 el paso 4 corría sin el emulador de
 * Storage, así que esa lectura cortaba en la rama «Firestore emulado sin Storage
 * emulado» y el gate que existe para correr el build de verdad corría justo la
 * mitad que no confirma nada.
 *
 * Así que la de afuera de CABA lleva una portada con URL de Storage, y el script
 * sube el objeto de su miniatura: el HTML tiene que salir con el `srcset`. Va en
 * la de afuera porque es la publicada que ningún aserto de imágenes mira (los de
 * la galería y el «control de la mayoría» son de la galería y la publicada).
 *
 * **La huella va en el nombre** porque el emulador de Storage es de la máquina y
 * no del checkout: dos gates a la vez comparten el bucket, y sin ella uno borraría
 * la miniatura del otro a mitad de su build. Es el nombre que `rutaDeMiniatura`
 * reconoce (`imagenes/img_<id>.jpg` → `miniaturas/img_<id>.jpg`).
 */
export const idDeLaImagenConMiniatura = (huella) => `img_${PREFIJO}${huella}`;

/** La ruta del objeto que el script sube, la misma que deriva `rutaDeMiniatura`. */
export const rutaDeLaMiniaturaDelGate = (huella) =>
  `miniaturas/${idDeLaImagenConMiniatura(huella)}.jpg`;

/**
 * El bucket que el build lista si nadie dice otro. **Es el mismo default que
 * `adminBucket()`** (`src/lib/firebase-admin.ts`), que un `.mjs` no puede
 * importar; si se separan, el `srcset` no sale y el aserto del gate se pone rojo
 * nombrando esta constante, así que la copia no puede mentir en silencio.
 */
export const BUCKET_POR_DEFECTO = 'agenda-literaria.firebasestorage.app';

const imagenConMiniatura = (bucket, huella) => ({
  id: 'img_gate_miniatura',
  url:
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/` +
    `imagenes%2F${idDeLaImagenConMiniatura(huella)}.jpg?alt=media`,
  epigrafe: '',
  origen: 'propia',
  portada: true,
  storagePath: CENTINELA.storagePath,
  ancho: 1200,
  alto: 800,
});

/**
 * **Qué documento va a qué ruta** — todo lo que el gate siembra, como datos.
 *
 * Es la lista que el script recorre con `db.doc(ruta).set(datos)`, y lo único
 * que queda afuera es `/opciones/ciudad`: ése no se reemplaza, se le **agrega**
 * un valor a lo que ya tenga el emulador de quien trabaja (`sembrarCiudadDelGate`),
 * así que necesita leer antes de escribir y no puede ser un dato.
 *
 * Es una función y no una constante porque las fechas de los encuentros son
 * relativas a ahora (`enUnaHora`): cargar este módulo no calcula nada.
 *
 * `bucket` y `huella` son los de la miniatura del gate (B-1790): el script los
 * saca del entorno, y acá solo se arman con ellos la URL de la portada de la de
 * afuera. Con los defaults sale igual de válida, para quien la importe sin
 * emulador.
 *
 * @param {{ bucket?: string, huella?: string }} [opciones]
 * @returns {[string, Record<string, unknown>][]} pares `[ruta, datos]`
 */
export const documentosDeLaSemilla = ({
  bucket = BUCKET_POR_DEFECTO,
  huella = 'local',
} = {}) => {
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

  // B-110 — la cancelada que estuvo publicada: se le deja el `calendarEventId`
  // de su sesión, que es lo que prueba que el sync le creó el evento.
  const cancelada = actividadDePrueba(SLUG_CANCELADA, 'cancelado');
  cancelada.sesiones[0].calendarEventId = 'evt_gate_cancelada';

  /*
   * B-969 — **la publicada de afuera de CABA**, y con ella la única página
   * `/ciudad/*` del artefacto.
   *
   * Se le limpia el barrio a propósito: fuera de CABA no se pide, y dejarlo
   * sembrado haría que `piezasDeLugar` emitiera tres piezas en vez de dos y que
   * los asertos del gate pasaran por el motivo equivocado.
   */
  const afuera = actividadDePrueba(SLUG_AFUERA, 'publicado');
  afuera.titulo = 'Gate mecanico — afuera de CABA';
  const geografiaDeAfuera = {
    provincia: PROVINCIA_DEL_GATE,
    barrio: '',
    ciudad: CIUDAD_DEL_GATE,
  };
  afuera.modalidades = afuera.modalidades.map((m) =>
    m.sede ? { ...m, sede: { ...m.sede, ...geografiaDeAfuera } } : m,
  );
  afuera.sede = { ...afuera.sede, ...geografiaDeAfuera };
  afuera.ciudades = [CIUDAD_DEL_GATE];
  // B-1790 — y la única portada **propia** del gate, cuya miniatura el script
  // sube al emulador de Storage. Ver `imagenConMiniatura`.
  afuera.imagenes = [imagenConMiniatura(bucket, huella)];

  // B-296 — la publicada con tres imágenes de proporciones distintas.
  const galeria = actividadDePrueba(SLUG_GALERIA, 'publicado');
  galeria.titulo = 'Gate mecanico — galeria de tres';
  galeria.imagenes = TRES_IMAGENES;
  // B-1572 — y el único encuentro cancelado del gate, con su motivo.
  galeria.sesiones = [...galeria.sesiones, encuentroCanceladoDelGate()];

  return [
    [`actividades/${ID_PUBLICADA}`, publicada],
    [`actividades/${ID_BORRADOR}`, actividadDePrueba(SLUG_BORRADOR, 'borrador')],
    [`actividades/${ID_CANCELADA}`, cancelada],
    // Y la que nunca lo estuvo: sin id de evento y sin historial.
    [`actividades/${ID_CANCELADA_NUNCA}`, actividadDePrueba(SLUG_CANCELADA_NUNCA, 'cancelado')],
    [`actividades/${ID_AFUERA}`, afuera],
    [`actividades/${ID_GALERIA}`, galeria],

    [
      `librerias/${ID_LIBRERIA}`,
      libreriaDePrueba(SLUG_LIBRERIA, 'publicado', CENTINELA.libreriaDescripcion),
    ],
    [
      `librerias/${ID_LIBRERIA_PENDIENTE}`,
      libreriaDePrueba(SLUG_LIBRERIA_PENDIENTE, 'pendiente', CENTINELA.libreriaPendiente),
    ],

    [
      `suscripciones/${ID_SUSCRIPCION}`,
      suscripcionDePrueba(SLUG_SUSCRIPCION, 'publicado', CENTINELA.suscripcionDescripcion),
    ],
    [
      `suscripciones/${ID_SUSCRIPCION_PENDIENTE}`,
      suscripcionDePrueba(SLUG_SUSCRIPCION_PENDIENTE, 'pendiente', CENTINELA.suscripcionPendiente),
    ],

    [`lugares/${ID_LUGAR}`, lugarDePrueba(SLUG_LUGAR, 'publicado', CENTINELA.lugarDescripcion)],
    [
      `lugares/${ID_LUGAR_PENDIENTE}`,
      lugarDePrueba(SLUG_LUGAR_PENDIENTE, 'pendiente', CENTINELA.lugarPendiente),
    ],
    /*
     * ⚠️ **La casa** — § 6 del PRD 4, y el documento que hace útil al paso 8k.
     *
     * Está **publicada**: su ficha se genera, su página se indexa y su entrada
     * viaja en `/lugares.json`. Lo único apagado es el flag, así que su dirección
     * —`lugarDireccionDeCasa`, que no está en ninguna canasta— no puede aparecer en
     * ningún archivo del `dist/`.
     *
     * ⚠️ **Su `geo` lleva coordenadas propias e inconfundibles**, y no las del
     * local: lo pidió el `auditor-privacidad`. La primera versión las compartía «a
     * propósito», con un comentario que afirmaba que el paso 8k encontraría una
     * fuga por su valor — y era falso por partida doble: el barrido del paso 9 mira
     * **strings centinela** y no números, y el 8k solo miraba el JSON-LD de la
     * ficha. Con las coordenadas compartidas, además, una fuga de la `geo` de la
     * casa al índice no se podría distinguir de la del local, que sí viaja. Con
     * éstas, el paso 8k.7 la busca en `dist/lugares.json` y la encuentra.
     */
    [
      `lugares/${ID_LUGAR_CASA}`,
      lugarDePrueba(SLUG_LUGAR_CASA, 'publicado', 'Gate lugar casa', {
        // El nombre va aparte del molde: los dos están publicados, y con el nombre
        // derivado del estado las dos fichas compartirían el `<title>` — que es
        // justo lo que el paso de títulos duplicados frena (y lo frenó).
        nombre: 'Gate lugar casa',
        tipo: 'casa',
        direccion: CENTINELA.lugarDireccionDeCasa,
        // Coordenadas **propias**: ver el comentario de arriba. La latitud es la que
        // el paso 8k.7 busca en `dist/lugares.json`, y no aparece en ningún otro
        // documento del gate.
        geo: { lat: LAT_DE_LA_CASA, lng: -59.000123 },
        direccionPublica: false,
      }),
    ],

    [
      `bibliotecas/${ID_BIBLIOTECA}`,
      bibliotecaDePrueba(SLUG_BIBLIOTECA, 'publicado', CENTINELA.bibliotecaDescripcion),
    ],
    [
      `bibliotecas/${ID_BIBLIOTECA_PENDIENTE}`,
      bibliotecaDePrueba(SLUG_BIBLIOTECA_PENDIENTE, 'pendiente', CENTINELA.bibliotecaPendiente),
    ],

    // B-888 — la cuenta del panel con su mail. No la lee ninguna parte del build;
    // se siembra para que el barrido del paso 9 tenga qué encontrar el día que
    // alguien la conecte a una salida. Ver `CENTINELA.mailDePanel`.
    [
      `usuarios/${PREFIJO}cuenta`,
      { email: CENTINELA.mailDePanel, actualizadoEn: new Date('2026-09-11T12:00:00Z') },
    ],
  ];
};

/*
 * B-959 — las efemérides del gate (paso 8n). No entran a las canastas del
 * barrido de actividades: se verifican aparte, con sus propios centinelas, en
 * `chequeos/09-efemerides.mjs`. La publicada lleva los uids centinela —lo que la
 * proyección existe para no publicar— y el borrador lleva el título centinela.
 * Viven acá desde B-1960 porque las usan dos archivos: el script que las siembra
 * y el chequeo que las busca.
 */
export const SLUG_EFEMERIDE = `${PREFIJO}efemeride`;
export const SLUG_EFEMERIDE_BORRADOR = `${PREFIJO}efemeride-borrador`;
export const UID_CENTINELA_EFEMERIDE = 'gate.efemerides.createdBy';
export const TITULO_BORRADOR_EFEMERIDE = 'gate.efemerides.borrador.titulo';
export const efemerideDelGate = (slug, titulo, estado) => ({
  titulo,
  slug,
  descripcion: 'Efeméride sembrada por el gate.',
  dia: 1,
  mes: 1,
  anio: 1900,
  fuente: null,
  estado,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: UID_CENTINELA_EFEMERIDE,
  updatedBy: UID_CENTINELA_EFEMERIDE,
});
