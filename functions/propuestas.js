/**
 * **La foto que mandó un tercero sigue la suerte de su propuesta** — B-830 paso
 * 8 (DEC-11) y **B-863**.
 *
 * Son dos cierres y no uno, y hasta B-863 solo estaba escrito el primero:
 *
 *  - **Se rechaza** → la imagen se borra **en el acto**. El dueño lo pidió con
 *    estas palabras: «si el evento lo descartamos se tiene que borrar». Y no
 *    espera al barrido: la retención de 30 días (B-838) es para el documento
 *    —que queda como prueba de qué se pidió, y para poder reabrirlo—, pero la
 *    foto de una persona que ya sabemos que no vamos a usar no tiene por qué
 *    quedarse un mes más.
 *  - **Se acepta** → el original de `propuestas/` **también se borra**, porque la
 *    copia promovida a `imagenes/` ya lo reemplaza (decisión del dueño el
 *    2026-09-10, **B-863**). Sin esto la foto no se iba nunca: la `aceptada` no
 *    vence (B-844, `RETENCION_POR_ESTADO`) así que la retención no llega, y
 *    `limpiarImagenesHuerfanas` solo recorre `imagenes/` y `miniaturas/`. Una
 *    decisión que se tomó mirando el contacto —«ahí sirve, puede haber que
 *    repreguntar»— se estaba aplicando también a la foto, y de eso no se había
 *    hablado.
 *
 * El barrido de huérfanas de B-221 queda como **red**, no como mecanismo — y
 * para el prefijo de propuestas ni siquiera eso: no lo recorre.
 *
 * ── Cuándo, que es la mitad de B-863 y no un detalle ──────────────────────
 * «Convertir» son **dos momentos** (D-600). En el primero el panel promueve la
 * copia y abre el formulario, y **no escribe nada** en Firestore; en el segundo,
 * cuando la actividad ya está guardada, `alGuardar` mueve la propuesta a
 * `aceptada`. El borrado tiene que ir en el **segundo**: si se borrara el
 * original al apretar el botón y el admin abandonara el formulario, la copia
 * promovida —huérfana, porque ninguna actividad la referencia— se la lleva
 * `limpiarImagenesHuerfanas` a las 72 horas, y la propuesta se queda **sin flyer
 * sin haber sido aceptada nunca**: no hay forma de reintentar y nadie se entera.
 *
 * Que esto sea un trigger sobre `propuestas/{id}` es lo que hace que el momento
 * sea el correcto **por construcción** y no por acordarse: la transición a
 * `aceptada` es, por D-600, exactamente «la actividad ya se guardó». Y es
 * además el único lugar donde se puede: `storage.rules` cierra el `delete` de
 * `propuestas/` para todo cliente, incluido un admin, justamente para que el
 * borrado sea consecuencia del estado y no de un botón.
 *
 * **Todo lo de acá es puro** salvo `borrarOriginalAlAceptar`, que recibe el `db`
 * y el `bucket` y no importa `firebase-admin` — mismo criterio que
 * `borrarPropuesta` en `retencion.js` y por el mismo motivo práctico: así el
 * test lo importa de acá y no del trigger. El pegamento vive en
 * `propuestas-trigger.js`.
 *
 * ── Por qué esto no es la trampa 3 ni la 12 ───────────────────────────────
 * El trigger escucha `propuestas/{id}` en **Firestore** y lo único que hace es
 * borrar un objeto en **Storage**. No escribe el documento que lo disparó —ni
 * para marcar que borró la imagen, y eso es deliberado: el documento es prueba de
 * qué se pidió, y un write-back además volvería a dispararlo—. Del lado de
 * Storage, un `delete()` emite `onObjectDeleted`, al que nada de este proyecto
 * está suscripto (`optimizarImagen` es `onObjectFinalized`). Sin un trigger del
 * otro lado, no hay con qué encadenarse. La lectura de `/actividades` que agrega
 * B-863 tampoco lo cambia: **lee y no escribe**.
 *
 * ── Y la consecuencia que hay que decir, porque la bandeja ofrece reabrir ──
 * Reabrir una propuesta —rechazada **o aceptada**— **no trae la foto de vuelta**.
 * El documento sigue nombrando su `storagePath` y el objeto ya no está. Está
 * dicho en la ayuda del panel y en la pantalla, porque es la clase de cosa que se
 * descubre tarde.
 *
 * Está probado en `tests/propuestas-imagen.test.ts` y, contra los emuladores, en
 * `tests/propuestas-imagen.integracion.test.ts`.
 */
import { PREFIJO_ORIGINALES } from './imagenes.js';
import { objetoDePropuesta } from './retencion.js';

/**
 * Los dos estados que **cierran** una propuesta, que es el vocabulario que la
 * bandeja ya usa («Ver aceptadas y rechazadas» = ver las cerradas).
 *
 * Está escrito como lista y no como dos `if` para que el día que aparezca un
 * tercer cierre haya un solo lugar donde mirar — y para que se lea que los dos
 * comparten el motivo: la foto de un tercero no sobrevive al cierre de su
 * propuesta.
 */
export const ESTADOS_QUE_CIERRAN = ['rechazada', 'aceptada'];

/**
 * ¿Hay que borrar la imagen de esta propuesta?
 *
 * `dejaLaFoto` es la parte que agregó el `auditor-privacidad` sobre B-863, y no
 * es cosmética: **no todo «ignorar» es lo mismo**. La mayoría son estados sanos
 * («todavía no cerró», «no hay imagen propia») y el trigger los loguea en
 * `debug`, que Cloud Logging no muestra por defecto. Pero dos de ellos ocurren
 * sobre una propuesta **aceptada** con un objeto vivo en `propuestas/`, y ahí el
 * estado del mundo es idéntico al del `warn`: la aceptada no vence, ningún
 * barrido recorre ese prefijo, y la foto de un tercero se queda para siempre. Sin
 * esta bandera esos dos caminos salían por `debug` y sin `alerta`, o sea
 * invisibles — y el aserto que cuenta las alertas los habría congelado así.
 *
 * @param {{ before?: Record<string, unknown> | null, after?: Record<string, unknown> | null }} _
 * @returns {{ accion: 'borrar' | 'ignorar', objeto: string | null, motivo: string, actividadId: string | null, dejaLaFoto: boolean }}
 */
export const decidirBorradoDeImagen = ({ before = null, after = null } = {}) => {
  const nada = (motivo, dejaLaFoto = false) => ({
    accion: 'ignorar',
    objeto: null,
    motivo,
    actividadId: null,
    dejaLaFoto,
  });

  /*
   * **El borrado del documento no dispara este borrado**, y no es un olvido: el
   * único que borra documentos de `/propuestas` es la retención, que borra el
   * objeto ella misma y en el orden correcto (objeto primero). Actuar acá
   * también sería un segundo borrado en carrera con aquel, que es el error que
   * B-89 documenta para los triggers del mismo evento.
   */
  if (!after) return nada('propuesta-borrada');

  if (!ESTADOS_QUE_CIERRAN.includes(after.estado)) return nada(`estado-${after.estado}`);

  /*
   * **Solo la transición**, no el estado. Sin esto, cualquier escritura sobre una
   * propuesta que ya está cerrada volvería a intentar el borrado: hoy sería
   * inofensivo (`ignoreNotFound`) y sería igual una llamada a Storage por cada
   * escritura. La transición es la que significa «se acaba de cerrar».
   *
   * Se compara contra `after.estado` y no contra un literal porque los dos
   * cierres necesitan la misma guarda: pasar de `rechazada` a `aceptada` **sí**
   * es una transición y tiene que volver a intentarlo (el objeto puede seguir
   * ahí si el borrado del rechazo falló).
   */
  if (before?.estado === after.estado) return nada(`ya-estaba-${after.estado}`);

  /*
   * La misma guarda de prefijo que la retención, **importada y no copiada**: dos
   * versiones de «qué objeto es nuestro» divergen y una queda vieja (B-88). Y
   * acá aplica por el mismo motivo que allá — este trigger corre con el Admin
   * SDK, así que el `matches('^propuestas/…')` de `firestore.rules` no lo
   * protege: un documento que nombrara el flyer de una actividad publicada haría
   * que cerrar una propuesta se lo llevara del sitio, en vivo.
   */
  const objeto = objetoDePropuesta(after.imagen);
  if (!objeto) {
    /*
     * `imagen-fuera-del-prefijo` sobre una **aceptada** avisa, y sobre una
     * rechazada no: allá el barrido de retención va a pasar por el documento en
     * 30 días y alguien va a ver el desajuste; acá no pasa nadie nunca.
     */
    return after?.imagen?.storagePath
      ? nada('imagen-fuera-del-prefijo', after.estado === 'aceptada')
      : nada('sin-imagen-propia');
  }

  if (after.estado === 'rechazada') {
    return { accion: 'borrar', objeto, motivo: 'rechazada', actividadId: null, dejaLaFoto: false };
  }

  /*
   * **Aceptada sin actividad no borra nada** (B-863). `revisionValida()` acepta
   * `actividadId: null` incluso en `aceptada` —la regla pide que el campo esté,
   * no que tenga valor—, así que este caso es alcanzable: una propuesta marcada
   * a mano desde la consola, o un camino futuro que se olvide de pasarlo. Sin el
   * id no hay dónde verificar que la copia existe, y sin esa verificación el
   * borrado es exactamente lo que B-863 decidió no hacer.
   */
  const actividadId = after.revision?.actividadId ?? null;
  if (typeof actividadId !== 'string' || actividadId.length === 0) {
    return nada('aceptada-sin-actividad', true);
  }

  return { accion: 'borrar', objeto, motivo: 'aceptada', actividadId, dejaLaFoto: false };
};

/**
 * El primer `storagePath` de la galería que es una imagen **nuestra de
 * `imagenes/`**, o `null`.
 *
 * Es el hermano de `objetoDePropuesta` para el otro prefijo, y tiene las mismas
 * dos guardas por el mismo motivo: el prefijo y **un solo segmento** debajo de
 * él. Acá no protegen un borrado sino una **afirmación** —«la copia existe»—, y
 * una afirmación laxa es peor que ninguna: si valiera cualquier `storagePath`,
 * una fila cuyo path apuntara a `propuestas/` haría que el original se
 * verificara **contra sí mismo** y el borrado se autorizara siempre.
 *
 * @param {unknown[]} [imagenes]
 * @returns {string[]}
 */
export const copiasEnLaGaleria = (imagenes) => {
  const paths = [];
  for (const imagen of Array.isArray(imagenes) ? imagenes : []) {
    const path = imagen && typeof imagen === 'object' ? imagen.storagePath : null;
    // Una imagen externa (DEC-7c) no tiene `storagePath`: no hay objeto nuestro
    // que le corresponda, así que no prueba nada sobre la promoción.
    if (typeof path !== 'string' || !path.startsWith(PREFIJO_ORIGINALES)) continue;
    const resto = path.slice(PREFIJO_ORIGINALES.length);
    if (resto.length > 0 && !resto.includes('/')) paths.push(path);
  }
  return paths;
};

/**
 * **Verificar que la copia existe y recién entonces borrar el original** —
 * B-863.
 *
 * ── El orden es la decisión, y va al revés que en B-838 ───────────────────
 * Acá también hay dos efectos irreversibles y el orden es lo único que decide
 * cuál es el modo de falla, pero la conclusión se da vuelta. En B-838 los dos
 * borrados eran del **mismo** dato (documento y objeto de una propuesta) y había
 * que elegir cuál huérfano dolía menos. Acá no se borran dos cosas: se **afirma**
 * una y se borra la otra.
 *
 *  - **Verificar y después borrar** (lo que hace este código): si la
 *    verificación sale bien y el borrado falla, quedan **dos copias de la misma
 *    foto**. Es inofensivo —cuesta unos KB, la foto está igual bajo control— y
 *    se puede volver a intentar mientras el documento siga nombrando su
 *    `storagePath`.
 *  - **Borrar y después verificar** es el que no se puede deshacer: si la copia
 *    no estaba, la foto que mandó un tercero **ya no existe en ninguna parte** y
 *    no hay de dónde sacarla. Ni siquiera se puede avisar qué se perdió.
 *
 * Por eso la verificación va arriba y no al lado, y por eso son **dos** y no
 * una: que el documento de la actividad **nombre** una copia no alcanza —el
 * objeto pudo irse en el medio, que es exactamente lo que le pasa a una copia
 * promovida si el formulario se queda abierto más de 72 horas
 * (`MARGEN_DE_GRACIA_MS` de `limpieza-imagenes.js`)—, así que además se le
 * pregunta al bucket.
 *
 * ── Lo que esta verificación **no** puede afirmar, dicho ──────────────────
 * No puede identificar **cuál** de las imágenes de la actividad es la copia
 * promovida: `promoverImagenDePropuesta` genera un `img_<uuid>` nuevo y nada ata
 * ese id al original (la regla `revisionValida()` acota el update de la
 * propuesta a `estado` + `revision`, así que tampoco hay dónde anotarlo sin
 * ensanchar la regla). Lo que afirma es lo más fuerte que se puede afirmar sin
 * eso: **la actividad que salió de esta propuesta tiene una imagen propia y ese
 * objeto está en el bucket**. Las dos consecuencias:
 *
 *  - si el admin cambió el flyer por otra foto suya, el original se borra igual
 *    — y está bien: la foto del tercero quedó descartada, que es el lado que
 *    B-863 quiere;
 *  - si la actividad se guardó **sin ninguna** imagen propia (la promoción
 *    falló y el panel avisó, o el admin sacó la fila), el original **se
 *    conserva**. Eso es lo correcto para no perder la foto y es, a la vez, el
 *    agujero que B-863 no cierra: esa propuesta queda `aceptada` para siempre
 *    con la foto de un tercero adentro. Ver **B-871**.
 *
 * `db` y `bucket` van sin tipo a propósito, igual que en `borrarPropuesta`: es
 * lo que deja que el test los reemplace por dobles y mida el **orden** de las
 * llamadas, que es la propiedad que este código existe para tener.
 *
 * @param {{ objeto: string, actividadId: string }} _
 * @returns {Promise<'borrado' | 'objeto-ajeno' | 'sin-actividad' | 'sin-copia' | 'copia-sin-objeto'>}
 */
export const borrarOriginalAlAceptar = async (db, bucket, { objeto, actividadId }) => {
  /*
   * **La guarda del prefijo, otra vez y acá adentro** — lo pidió el
   * `auditor-privacidad` sobre este mismo cambio, y el argumento es de forma y
   * no de paranoia: `objetoDePropuesta` **empareja** la guarda con el valor (si
   * el path no es nuestro, no hay objeto), y partir la decisión del efecto rompe
   * ese emparejamiento — esta función recibe `objeto` como string libre,
   * verifica una condición sobre **otra cosa** (la galería de la actividad) y
   * borra. Hoy el único llamador la alimenta desde la decisión guardada, pero es
   * una función exportada y el próximo llamador —un backfill de B-871, el script
   * en seco— es exactamente el que no va a pasar por ahí.
   *
   * Y lo que está del otro lado es lo de siempre: esto corre con el Admin SDK,
   * así que `storage.rules` no la frena, y un `imagenes/img_<uuid>.jpg` acá
   * borraría el flyer de una actividad publicada, en vivo. Se reusa la guarda
   * **importada** y no una copia (B-88).
   */
  if (objetoDePropuesta({ storagePath: objeto }) !== objeto) return 'objeto-ajeno';

  const ref = db.collection('actividades').doc(actividadId);
  /*
   * **Con máscara, y no un `get()` pelado.** Mismo cuidado que el
   * `select('imagenes')` de `limpieza-imagenes.js` y que el `fieldMask: []` de
   * `borrarPropuesta`: sin la máscara esta Function tendría en memoria la
   * actividad entera —`online.url`, `difusion`, `createdBy`— para leerle un
   * array de paths (§5.1).
   */
  const [snap] = await db.getAll(ref, { fieldMask: ['imagenes'] });
  if (!snap.exists) return 'sin-actividad';

  const copias = copiasEnLaGaleria(snap.data()?.imagenes);
  if (copias.length === 0) return 'sin-copia';

  let alguna = false;
  for (const copia of copias) {
    const [existe] = await bucket.file(copia).exists();
    if (existe) {
      alguna = true;
      break;
    }
  }
  if (!alguna) return 'copia-sin-objeto';

  /*
   * `ignoreNotFound` por el mismo motivo que en la retención: la entrega de
   * eventos de Firestore es **al menos una vez**, así que este handler puede
   * correr dos veces sobre la misma transición. Borrar lo que ya no está no es
   * un error, es el estado que se quería.
   */
  await bucket.file(objeto).delete({ ignoreNotFound: true });
  return 'borrado';
};
