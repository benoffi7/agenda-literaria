/**
 * **La retención de las propuestas, contra Firestore y Storage** — B-838, B-864,
 * B-865.
 *
 * La lectura paginada de las vencibles y el borrado con precondición, con el `db`
 * y el `bucket` inyectados. No importa `firebase-admin` ni `firebase-functions`:
 * así `tests/retencion.integracion.test.ts` los importa sin arrastrar el
 * scheduler (B-561). El pegamento con el reloj vive en `retencion-trigger.js`
 * (B-1960, M-13 del PRD 6).
 */
import {
  ESTADOS_QUE_CADUCAN,
  MAX_PROPUESTAS_POR_CORRIDA,
  PROPUESTAS_POR_PAGINA,
  RETENCION_POR_ESTADO,
  decidirRetencion,
} from './retencion-propuestas.js';

/**
 * Las que **pueden** caducar, con **lo mínimo** para decidir.
 *
 * Ya no son solo las rechazadas (B-844): los estados los pone
 * `ESTADOS_QUE_CADUCAN`, que sale de `RETENCION_POR_ESTADO`. La `aceptada`
 * queda afuera de la query **porque queda afuera de la tabla**, y no porque acá
 * haya una segunda lista que alguien tenga que acordarse de mover.
 *
 * El `select()` no es una optimización: es lo que hace que el contacto de quien
 * propuso —el dato personal del tercero— **no entre a la memoria de la Function**
 * ni pueda terminar en un log por accidente. Lo único que este barrido necesita
 * saber de una propuesta es su estado, cuándo dio su última señal de vida y qué
 * objeto tiene colgado.
 *
 * **Y por eso los dos campos anidados van por su path y no enteros** — lo corrigió
 * el `auditor-privacidad`. `select('revision')` traía también `revision.motivo`
 * («una nota interna sobre el trabajo de otra persona», con su propia fila en
 * `07-seguridad.md`) y `revision.porUid`, que es un uid. No era una fuga —nada de
 * eso se loguea— pero la doc decía «trae lo mínimo» y no lo traía, y la distancia
 * era una línea. Importa además por la trampa del nombre: el log ya tiene una
 * clave `causa`, y con el motivo del rechazo ya en memoria, «enriquecer el log»
 * sería un renglón.
 *
 * **`creadoEn` está en el `select` y eso no es opcional** (B-844): es el reloj de
 * la propuesta que nadie tocó, y un campo que la query no pide vuelve
 * `undefined`, así que `relojDeRetencion` lo leería como «sin fecha legible» y
 * **ninguna `nueva` caducaría jamás**, en silencio y con la suite en verde. Es
 * la clase de bug que este `select` acotado trae de regalo: lo que se agrega a
 * la lógica hay que agregarlo también acá.
 *
 * El `where('estado','in', …)` es de un solo campo, así que no pide índice
 * compuesto — por eso tampoco lleva `orderBy`, que sí lo pediría.
 *
 * ── `updateTime` es la sexta clave, y **no** afloja el `select`** (B-864) ──
 * Es **metadata del snapshot**, no un campo del documento: viaja en la respuesta
 * de Firestore aunque la máscara no pida nada, y por eso pedirlo no agrega ni un
 * campo del documento a la memoria de la Function. El `select` sigue trayendo
 * exactamente lo mismo que traía; lo que cambia es que ahora también se **guarda**
 * la versión que esta corrida vio, que es lo que `borrarPropuesta` va a exigir
 * como precondición.
 *
 * Sin esto el barrido borra «el id que decidí hace un rato», sin condición: entre
 * esta query y el `delete()` un admin puede apretar «la estoy mirando» sobre una
 * vencida, ver el plazo renovado en Firestore y **perder el documento igual**.
 * B-844 ensanchó esa carrera de «solo las rechazadas» a toda la bandeja pendiente
 * y le puso enfrente la promesa que la vuelve intolerable: «moverla de estado le
 * renueva el plazo».
 *
 * ── Y se lee de a páginas, cortando por trabajo (B-865) ───────────────────
 * La query lleva `limit()` desde B-865 y esta función pide páginas hasta que las
 * candidatas llenan el tope de borrados o hasta que la colección se termina. El
 * porqué de las dos mitades —y por qué un `limit()` a secas habría dejado de
 * cumplir el plazo en silencio— está en `PROPUESTAS_POR_PAGINA`. Es también por
 * lo que esta función recibe `ahora` y `plazos`: no decide nada, pero le
 * **pregunta** a la decisión pura cuándo dejar de leer, y tiene que preguntarlo
 * con el mismo reloj con el que el llamador va a decidir después.
 *
 * @param {{ ahora?: number, plazos?: Record<string, number | null> }} [opciones]
 * @returns {Promise<{ id: string, estado: string, creadoEn: unknown, revision: unknown, imagen: unknown, updateTime: unknown }[]>}
 */
export const propuestasVencibles = async (
  db,
  { ahora = Date.now(), plazos = RETENCION_POR_ESTADO } = {},
) => {
  // Un `in` vacío es un error de Firestore, no una query que no devuelve nada.
  // Solo pasa si alguien pone toda la tabla en `null`, que es «no borres nada».
  if (ESTADOS_QUE_CADUCAN.length === 0) return [];

  const base = db
    .collection('propuestas')
    .where('estado', 'in', ESTADOS_QUE_CADUCAN)
    .select('estado', 'creadoEn', 'revision.en', 'imagen.storagePath');

  const leidas = [];
  let desde = null;
  for (;;) {
    /*
     * El cursor va con el **snapshot** de la última leída y no con su id: así el
     * orden lo pone Firestore y no hay que repetirlo acá. Sin `orderBy`
     * explícito el SDK deriva del snapshot el orden implícito por `__name__`,
     * que es el mismo con el que la página vino. Verificado contra el emulador,
     * y fijado por el caso de `retencion.integracion.test.ts` — un doble a mano
     * diría que sí sin haber preguntado.
     */
    const snap = await (desde ? base.startAfter(desde) : base).limit(PROPUESTAS_POR_PAGINA).get();
    for (const d of snap.docs) {
      leidas.push({
        id: d.id,
        estado: d.get('estado'),
        creadoEn: d.get('creadoEn'),
        revision: d.get('revision'),
        imagen: d.get('imagen'),
        // Metadata, no un campo: `d.get(...)` no lo alcanzaría ni haría falta que
        // lo hiciera. Es la versión del documento que **esta** corrida vio.
        updateTime: d.updateTime,
      });
    }

    // Página corta: la colección se terminó. No hace falta pedir una vacía.
    if (snap.size < PROPUESTAS_POR_PAGINA) return leidas;

    /*
     * **El corte es por trabajo y no por cantidad leída** (B-865, ver
     * `PROPUESTAS_POR_PAGINA`). Se llama a la decisión pura —que es barata y no
     * toca la red— para preguntar si lo leído ya llena el tope de borrados de
     * hoy; si lo llena, lo que falta leer no cambiaría nada, porque de todos
     * modos quedaría marcado `-pendiente-por-tope`. El `ahora` entra por
     * parámetro para que sea **el mismo** con el que el llamador va a decidir
     * después: dos relojes distintos podrían cortar acá y no allá.
     */
    const { aBorrar } = decidirRetencion({ propuestas: leidas, ahora, plazos });
    if (aBorrar.length >= MAX_PROPUESTAS_POR_CORRIDA) return leidas;

    desde = snap.docs[snap.size - 1];
  }
};

/**
 * El código gRPC de `FAILED_PRECONDITION`.
 *
 * **Y dice menos de lo que parece, que es el hallazgo del `auditor-trampas`.**
 * La primera versión de este comentario afirmaba que en un
 * `delete({ lastUpdateTime })` sólo puede significar «la versión no era la
 * esperada», y es falso: Firestore devuelve **el mismo código** cuando el
 * documento **ya no existe** (se verificó contra el emulador — el mensaje habla
 * de `the stored version … does not match` en los dos casos). O sea que el
 * código solo no distingue «un admin la tocó» de «otra corrida ya se la llevó
 * entera», y son dos finales distintos con dos logs distintos. Por eso el
 * `catch` vuelve a preguntar por la existencia en vez de suponer.
 *
 * El caso de las dos corridas no es teórico: el trigger corre por reloj **y**
 * `scripts/borrar-propuestas-vencidas.mjs` se corre a mano, que es el uso que
 * `08-operacion.md` describe como normal.
 */
export const FALLO_DE_PRECONDICION = 9;

/**
 * Borra una propuesta caducada: **la relectura primero, después el objeto,
 * después el documento** — y el documento con precondición.
 *
 * ── Lo que estaba y por qué no alcanzaba (B-864) ──────────────────────────
 * Esto hacía `delete()` con el id que se decidió al principio de la corrida,
 * **sin condición**. Entre `propuestasVencibles()` y esta línea pasan segundos, y
 * en esos segundos un admin puede apretar «la estoy mirando» sobre una vencida:
 * ve el plazo renovado en Firestore y **pierde el documento igual**. B-844 ensanchó
 * esa carrera de «solo las rechazadas» a toda la bandeja pendiente y le puso
 * enfrente la promesa que la vuelve intolerable —«moverla de estado le renueva el
 * plazo»—, así que el barrido tiene que poder decir «no la borro, la tocaron».
 *
 * ── Por qué son DOS guardas y no una, y ahí está la decisión ──────────────
 * Porque son **dos almacenes con capacidades distintas**, no cinturón y tiradores:
 *
 *  - **Firestore tiene precondición.** `delete({ lastUpdateTime })` compara y
 *    borra en la misma operación, así que sobre el documento la garantía es
 *    atómica y no hay ventana. Es la única forma de cumplir la promesa de B-844
 *    de verdad.
 *  - **Storage no tiene ninguna.** No hay `lastUpdateTime` que ponerle a
 *    `file().delete()`, y el objeto se borra **antes** que el documento (la
 *    decisión de B-838, abajo). O sea que con la precondición sola, una propuesta
 *    rescatada en el último segundo conservaría el documento y **perdería el
 *    flyer**: el huérfano que B-838 eligió como «el menos malo», cayendo justo
 *    sobre la que un admin acaba de salvar. Al objeto solo se lo puede proteger
 *    **no llegando hasta él**, y para eso está la relectura.
 *
 * La relectura no elimina la carrera —entre ella y el `delete` del objeto queda
 * un viaje de ida y vuelta—, la **reduce de la corrida entera a un round-trip**.
 * Eso importa porque la ventana real que este ítem ataca no es de microsegundos:
 * la query trae hasta 50 documentos y cada uno se procesa con su borrado de
 * Storage en el medio, así que el último de la lista se borra segundos después de
 * haber sido leído. Lo que queda es la cuarta forma de perder la mitad del
 * borrado, y está nombrada abajo.
 *
 * ── Lo que NO se cambió: el orden de B-838 ────────────────────────────────
 * El objeto sigue yendo **primero** y el documento después. Se evaluó invertirlo
 * cuando hay precondición —así una precondición que falla no toca nada— y no se
 * hizo: eso hace catastrófico el fallo **más probable**. Un `delete` de Storage
 * que falla por transitorio es un viaje de red que falla; una precondición que
 * falla son segundos por día. Con el documento borrado primero, el transitorio de
 * Storage deja la foto de una persona **sin nada que la nombre** —`propuestas/`
 * no lo barre nadie (B-221 solo recorre `imagenes/` y `miniaturas/`)— y sin
 * documento no hay corrida de mañana que reintente. El orden se queda donde
 * estaba, la guarda nueva se pone **arriba de los dos**, y `retencion.test.ts`
 * fija ahora las tres posiciones.
 *
 * ── Los cuatro finales ────────────────────────────────────────────────────
 *  - `'borrada'`      — las dos mitades se fueron.
 *  - `'la-tocaron'`   — la relectura vio otra versión. **No se tocó nada**: ni el
 *                       documento ni la foto. Es el final que este ítem existe
 *                       para producir.
 *  - `'ya-no-esta'`   — el documento ya no está (una corrida anterior murió en el
 *                       medio, o corrieron dos). Se llega por los **dos**
 *                       caminos: la relectura de arriba, y la precondición que
 *                       corta porque otra corrida lo borró en el medio. El objeto **sí** se borra: sin
 *                       documento que lo nombre es exactamente el huérfano
 *                       imposible de encontrar después, y acá todavía tenemos el
 *                       path en la mano y pasado por las dos guardas del prefijo.
 *  - `'la-tocaron-tarde'` — la precondición cortó el `delete` del documento, pero
 *                       el objeto ya no estaba. Es la cuarta forma de perder la
 *                       mitad, cae del lado tolerado por B-838 (documento vivo,
 *                       flyer roto, se ve en la bandeja) y el trigger la loguea
 *                       como `warn` porque cae sobre una propuesta rescatada.
 *
 * `ignoreNotFound` sigue siendo lo que hace que el reintento funcione: si el
 * objeto ya no está —porque la corrida anterior murió justo en el medio— borrarlo
 * de nuevo no es un error, es el estado que se quería.
 *
 * @param {{ id: string, objeto: string | null, visto: unknown }} caducada
 * @returns {Promise<'borrada' | 'la-tocaron' | 'ya-no-esta' | 'la-tocaron-tarde'>}
 */
export const borrarPropuesta = async (db, bucket, { id, objeto, visto }) => {
  if (!visto) {
    /*
     * **Falla ruidoso y no cerrado, que es la excepción de este archivo.**
     * `sin-fecha-legible` e `imagen-fuera-del-prefijo` son datos del documento
     * que pueden venir mal y se clasifican; esto es un **error de programación**
     * del que llama —armó la lista sin pasar por `propuestasVencibles`— y
     * clasificarlo lo dejaría pasar como «una que no se borró». Sin la versión
     * vista este borrado es el de antes de B-864, o sea el que se lleva puesta
     * una propuesta que un admin acaba de rescatar.
     */
    throw new Error(
      `borrarPropuesta(${id}) sin la versión vista: sin precondición este borrado ` +
        'puede llevarse una propuesta que un admin acaba de tocar (B-864).',
    );
  }

  const ref = db.collection('propuestas').doc(id);

  /*
   * **La relectura, y trae metadata y nada más.** `fieldMask: []` devuelve el
   * snapshot con `exists` y `updateTime` y **cero campos**: sin esto, un
   * `ref.get()` traería el documento entero y con él el contacto del tercero,
   * que es exactamente lo que el `select` de `propuestasVencibles` existe para
   * evitar. Un `runTransaction` tendría el mismo problema —y encima no puede
   * abarcar el borrado de Storage, así que no resolvería la tensión del orden—.
   */
  const [ahora] = await db.getAll(ref, { fieldMask: [] });

  if (!ahora.exists) {
    if (objeto) await bucket.file(objeto).delete({ ignoreNotFound: true });
    return 'ya-no-esta';
  }

  if (!ahora.updateTime.isEqual(visto)) return 'la-tocaron';

  if (objeto) await bucket.file(objeto).delete({ ignoreNotFound: true });
  try {
    await ref.delete({ lastUpdateTime: visto });
  } catch (e) {
    if (e?.code !== FALLO_DE_PRECONDICION) throw e;
    /*
     * **Una relectura más, y solo en este camino** (`auditor-trampas`). El
     * código 9 no distingue «otra versión» de «ya no existe», y la diferencia es
     * la que decide el log: `la-tocaron-tarde` afirma que **una propuesta viva
     * quedó con el flyer roto**, y si el documento se lo llevó otra corrida no
     * hay nada que rescatar ni nadie a quien avisarle — el operador iría a
     * buscar una propuesta que no está. Cuesta un viaje extra en un camino que
     * casi nunca se toma.
     */
    const [despues] = await db.getAll(ref, { fieldMask: [] });
    return despues.exists ? 'la-tocaron-tarde' : 'ya-no-esta';
  }
  return 'borrada';
};
