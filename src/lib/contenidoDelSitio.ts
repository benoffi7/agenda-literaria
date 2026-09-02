/**
 * **SOLO build time** (§5.4) — el lector de Firestore del sitio público, y el
 * único (B-227).
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * Del build salen **tres artefactos con una sola lectura** (§3 del diseño):
 * `/events.json`, el HTML de la home y una página de detalle por actividad. Los
 * tres necesitan exactamente lo mismo —las publicadas, proyectadas, más los cinco
 * documentos de `/opciones/*`— y cuando el `events.json` era el único consumidor
 * esa lectura vivía adentro de su endpoint.
 *
 * ── Dos queries y no una, desde B-110 ─────────────────────────────────────
 * El sitio lee **dos** estados: `publicado` para todo, y `cancelado` para generar
 * su página y nada más (§7.3 del diseño). Son dos queries con dos `==` y no un
 * `where('estado','in',[…])`, y la diferencia es la garantía: **un `in` convierte
 * el estado en una lista, y a una lista alguien le agrega un elemento**. Con dos
 * queries separadas la de las publicadas quedó intacta, y lo peor que puede hacer
 * un error en la nueva es no generar ninguna página de cancelada.
 *
 * Los resultados **no se mezclan**: `actividades` y `canceladas` son dos campos
 * distintos de `ContenidoDelSitio`, así que ninguna lista del sitio puede ver una
 * cancelada aunque se olvide de filtrarla — no la recibe.
 *
 * Copiarla dos veces más habría sido la clase de bug que este repo ya tiene
 * nombrada (B-72, B-88): **tres derivaciones de la misma regla**, donde la que se
 * olvida de actualizar el `where('estado','==','publicado')` publica los
 * borradores en el HTML mientras el JSON sigue limpio, y nada falla.
 *
 * ── La cláusula de credenciales vive acá, y es lo que el diseño pedía ─────
 * §3.2 del diseño lo dice con estas palabras: «las dos cláusulas las decide **el
 * lector de Firestore**, porque *seguir con lista vacía* es una respuesta que
 * solo puede dar él: es su valor de retorno». Con tres consumidores eso deja de
 * ser una preferencia — si cada uno decidiera, uno de los tres se olvidaría, y el
 * modo de falla es un `events.json` vacío publicado encima del sitio que sí tenía
 * datos, con el workflow en verde (D-123, B-189).
 *
 * Detrás sigue estando la red que ya estaba puesta: `adminApp()` tira sin
 * credenciales, así que un consumidor que se saltee este módulo se encuentra un
 * error claro en vez de leer cero documentos en silencio.
 *
 * ── El caché ──────────────────────────────────────────────────────────────
 * Se memoriza la promesa **solo si resuelve**. Sin caché el build hace tres
 * lecturas de la colección en vez de una; cacheando también el fallo, un test que
 * cambia el entorno entre dos llamadas vería la respuesta de la corrida anterior.
 */
import { adminDb, hayCredenciales } from '@/lib/firebase-admin';
import { construirIndice, type EntradaDeIndice, type Indice } from '@/lib/eventsJson';
import { detalleDeActividad, type DetallePublico } from '@/lib/detallePublico';
import { carteleraDeDetalles, type Afiche } from '@/lib/cartelera';
import {
  mapaDeEtiquetas,
  tonosDeTipo,
  type MapaDeEtiquetas,
  type TonosDeTipo,
} from '@/lib/listadoPublico';
import { mesesDelSitio, mesesEnlazables, type PaginaDeMes } from '@/lib/mesPublico';
import { pasadasDelSitio } from '@/lib/pasadasPublicas';
import { rutasDelSitemap } from '@/lib/sitemap';
import { aIsoSeguro, toPublic, type ActividadPublica } from '@/lib/toPublic';
import { INFO_VERSION } from '@/lib/version';
import {
  CAMPOS_TAXONOMIA,
  type Actividad,
  type CampoTaxonomia,
  type ValorOpcion,
} from '@/types/actividad';

/** El `where` del §5.3: solo lo publicado entra al sitio (§3.3 del diseño). */
const ESTADO_PUBLICO = 'publicado';

/**
 * El segundo estado que el build lee, y **solo para generar su página** (B-110).
 *
 * Ver `canceladas`. No entra a `actividades`, así que no llega al `events.json`,
 * ni al listado, ni a los chips, ni a la cartelera.
 */
const ESTADO_CANCELADO = 'cancelado';

export interface ContenidoDelSitio {
  /** **Las publicadas, y nada más.** Es lo que alimenta todas las listas. */
  actividades: ActividadPublica[];
  /**
   * Las **canceladas que estuvieron publicadas** — B-110, §7.3 del diseño.
   *
   * ── Por qué es un array aparte y no un flag adentro de `actividades` ──────
   * Porque la propiedad que hay que garantizar es «una cancelada no aparece en
   * ninguna lista», y con las dos mezcladas eso pasa a depender de que **cada**
   * consumidor se acuerde de filtrar: el índice, los chips, el listado, la
   * cartelera y lo que se agregue después. Es la clase de bug que este repo ya
   * tiene nombrada (B-72, B-88): N derivaciones de la misma regla, y la que se
   * olvida publica una cancelada en el listado sin que nada falle.
   *
   * Separadas, el olvido es imposible por construcción: `indiceDelSitio`,
   * `etiquetasDelListado` y `etiquetasDelDetalle` leen `actividades` y **no
   * pueden ver** las canceladas. El único que las une es `detallesDelSitio`, y
   * solo cuando se lo piden.
   */
  canceladas: ActividadPublica[];
  /**
   * `{ slug: ISO de updatedAt }` de las canceladas — **solo para el sitemap**
   * (B-109).
   *
   * ── Por qué viaja al lado y no adentro de la proyección ───────────────────
   * Porque `updatedAt` **no se publica** y este cambio no lo cambia: `toPublic`
   * lo deja afuera a propósito (una fecha de modificación publicada convierte
   * cada corrección de un typo en «actualizado hoy») y `docs/07-seguridad.md`
   * promete que no sale a ninguna salida. Lo que el sitemap necesita es la
   * ventana de 30 días del §7.3 —«30 días desde que se canceló»—, y esa fecha no
   * es un dato del modelo: `updatedAt` es la mejor aproximación disponible y
   * B-109 ya eligió pagar su error (una edición posterior corre el reloj hacia
   * adelante, o sea que la URL se queda un poco más: el lado inofensivo).
   *
   * Es el patrón exacto con el que B-110 resolvió `cancelada`: **lo decide el
   * lector**, que es el único que ve el documento crudo, y se pasa como argumento
   * en vez de agregarle un campo a la proyección. Así el `events.json` no puede
   * publicar una fecha de modificación por accidente.
   *
   * Y lo que hace que no agrande la superficie pública es que es un **predicado**:
   * decide si la URL entra al sitemap y no se emite en ninguna parte — el sitemap
   * va sin `lastmod` hasta que exista B-112.
   *
   * Es un mapa por slug y no un campo del array de `canceladas` para que el tipo
   * de aquél no cambie: `ActividadPublica` es la frontera de privacidad, y meterle
   * un campo que no se publica invita a que algún consumidor lo publique.
   */
  canceladasEditadasEn: Record<string, string>;
  opciones: Partial<Record<CampoTaxonomia, ValorOpcion[]>>;
}

/**
 * Las actividades publicadas, proyectadas.
 *
 * La query lleva el `where('estado','==','publicado')` porque es lo que el §3.3
 * define que entra al sitio — y no por las reglas de Firestore: el Admin SDK las
 * saltea. Vale decirlo porque la trampa 7 del §13 habla del caso contrario.
 *
 * **Esta query no se tocó al cerrar B-110, y ése es el punto.** Las canceladas
 * entran por `canceladas()`, que es una segunda query con su propio `==`: leer
 * dos estados con un `where('estado','in',[...])` habría convertido este escalar
 * en una lista, y una lista es algo a lo que alguien le agrega un elemento. Con
 * dos `==` no hay lista que crecer, y un error en la query nueva solo puede
 * producir cero páginas de canceladas — nunca una página de un borrador.
 */
const publicadas = async (): Promise<ActividadPublica[]> => {
  const snap = await adminDb()
    .collection('actividades')
    .where('estado', '==', ESTADO_PUBLICO)
    .get();
  return snap.docs.map((d) => toPublic(d.data() as Actividad, d.id));
};

/**
 * ¿Esta actividad **estuvo publicada alguna vez**? — B-110, §7.3 del diseño.
 *
 * Es la condición que separa «se canceló algo que la gente tenía anotado» de «un
 * borrador que nació y murió sin ver la luz». Sin ella, poner una actividad en
 * `cancelado` la publicaría, que es exactamente lo que el §5.3 impide: *«Una
 * actividad que nace y muere en `cancelado` no genera nada. Nunca estuvo pública
 * y publicarla ahora sería filtrar un borrador.»*
 *
 * ── La heurística que el §7.3 propone está muerta, y hay que decirlo ───────
 * El diseño propone mirar si **alguna sesión tiene `calendarEventId`**, porque el
 * sync solo crea eventos de actividades publicadas. El razonamiento es correcto y
 * el dato no sobrevive: al pasar a `cancelado`, `syncCalendar` borra los N eventos
 * y **escribe `calendarEventId: null` de vuelta en cada sesión** (`reponerIds`, y
 * es lo que B-80 arregló). O sea que para cuando el build lee el documento, la
 * prueba de que estuvo publicada la borró el propio sync. Con esa heurística sola,
 * B-110 no habría generado ni una página en producción.
 *
 * ── Lo que sí sobrevive: el historial ─────────────────────────────────────
 * `guardarVersion` (§12) guarda el documento **anterior** a cada edición de
 * contenido en `/actividades/{id}/versiones/{version}`. Cancelar es una edición de
 * contenido, así que deja una versión cuyo `documento.estado` es `'publicado'` —
 * y una actividad que nunca lo estuvo no puede tener ninguna. Es el mismo
 * razonamiento del §7.3 sobre un rastro que no se borra solo.
 *
 * Lo que se paga, dicho:
 *
 * | | |
 * |---|---|
 * | una query por cancelada | son un puñado de documentos, y solo las canceladas la pagan. Las publicadas no leen nada nuevo |
 * | la retención de D-42 | 20 versiones por actividad. Editar una **cancelada** 20 veces empuja la versión publicada afuera y la página vuelve a dar 404. Falla cerrado, que es el lado correcto del error |
 * | el campo explícito sigue faltando | `publicadaAlgunaVez: boolean` es lo correcto y es una decisión del §11.1 del diseño — queda en **B-285** |
 *
 * **No se lee un solo campo de las versiones.** El `.select()` sin argumentos
 * devuelve documentos con id y nada más, y `limit(1)` corta en el primero: la
 * pregunta es de existencia. Importa porque una versión es el documento **entero**
 * de aquel momento —`difusion`, `online.url`, uids—, y nada de eso tiene por qué
 * entrar al proceso que genera el sitio.
 */
const estuvoPublicada = async (
  ref: FirebaseFirestore.DocumentReference,
  a: Actividad,
): Promise<boolean> => {
  // §7.3 tal cual, primero y sin costo: si el id sobrevivió —un sync que no llegó
  // a correr, un borrado que falló— alcanza y no hace falta ir al historial.
  if ((a.sesiones ?? []).some((s) => s.calendarEventId)) return true;

  const versiones = await ref
    .collection('versiones')
    .where('documento.estado', '==', ESTADO_PUBLICO)
    .limit(1)
    .select()
    .get();
  return !versiones.empty;
};

/**
 * Las canceladas **que estuvieron publicadas**, proyectadas — B-110.
 *
 * Su propia query con su propio `==`, deliberadamente separada de `publicadas()`:
 * ver el docblock de aquélla. Lo que devuelve no entra a `actividades`, así que no
 * puede aparecer en el `events.json`, en el listado, en los chips ni en la pared.
 *
 * ── Se publica el documento de HOY, no la última versión publicada ────────
 * `estuvoPublicada` contesta «¿estuvo publicada **alguna vez**?», y la página sale
 * del documento actual. El camino `publicado → borrador → (se edita) → cancelado`
 * genera entonces HTML con ediciones que nunca pasaron por `publicado`.
 *
 * Se acepta, y por una razón concreta: **la superficie es la misma**. Lo que sale
 * pasa por `toPublic` y por `detalleDeActividad` igual que cualquier otra página,
 * así que no puede publicar un campo que la frontera no permita — el barrido de
 * centinelas corre sobre la cancelada con la misma lista de permitidos. Lo que
 * puede quedar publicado es un *texto* más nuevo que el último que se publicó, que
 * es lo que el dueño escribió y no un dato ajeno. La alternativa —reconstruir la
 * página desde la última versión publicada— publicaría datos viejos a propósito y
 * duplicaría la proyección sobre un documento de otra forma.
 */
const canceladas = async (): Promise<{
  actividades: ActividadPublica[];
  editadasEn: Record<string, string>;
}> => {
  const snap = await adminDb()
    .collection('actividades')
    .where('estado', '==', ESTADO_CANCELADO)
    .get();

  const conPagina = await Promise.all(
    snap.docs.map(async (d) => {
      const a = d.data() as Actividad;
      if (!(await estuvoPublicada(d.ref, a))) return null;
      /*
       * B-109 — la fecha de la última edición viaja **al lado** de la proyección,
       * no adentro: es el predicado de la ventana de 30 días del sitemap y no un
       * campo público. Ver `ContenidoDelSitio.canceladasEditadasEn`.
       */
      return { publica: toPublic(a, d.id), editadaEn: aIsoSeguro(a.updatedAt) };
    }),
  );

  const vivas = conPagina.filter((c): c is NonNullable<typeof c> => c !== null);
  return {
    actividades: vivas.map((c) => c.publica),
    editadasEn: Object.fromEntries(
      vivas
        // Sin slug no hay URL que poner en el sitemap, y sin fecha no hay ventana
        // que medir: en los dos casos la entrada no existe, que es más honesto que
        // una clave vacía.
        .filter((c) => c.publica.slug && c.editadaEn)
        .map((c) => [c.publica.slug, c.editadaEn]),
    ),
  };
};

/** Los cinco documentos de `/opciones/*`, en una sola ida (§4.1). */
const opcionesDeTaxonomia = async (): Promise<Partial<Record<CampoTaxonomia, ValorOpcion[]>>> => {
  const refs = CAMPOS_TAXONOMIA.map((c) => adminDb().doc(`opciones/${c}`));
  const snaps = await adminDb().getAll(...refs);
  const porCampo: Partial<Record<CampoTaxonomia, ValorOpcion[]>> = {};
  snaps.forEach((snap, i) => {
    porCampo[CAMPOS_TAXONOMIA[i]!] = (snap.data()?.valores ?? []) as ValorOpcion[];
  });
  return porCampo;
};

const leer = async (): Promise<ContenidoDelSitio> => {
  if (hayCredenciales()) {
    const [actividades, canceladasConPagina, opciones] = await Promise.all([
      publicadas(),
      canceladas(),
      opcionesDeTaxonomia(),
    ]);
    return {
      actividades,
      canceladas: canceladasConPagina.actividades,
      canceladasEditadasEn: canceladasConPagina.editadasEn,
      opciones,
    };
  }

  /*
   * En CI un build sin credenciales tiene que **fallar**, y esa es la mitad
   * importante: leer cero actividades no falla solo, produce un sitio vacío, y el
   * deploy lo publica **encima del que sí tenía datos**. Sin error, sin log, con
   * el workflow en verde — y borrar el sitio de Google se recupera en semanas, no
   * en un rebuild. Es la familia del `EXIGIR_EMULADOR=1`: «verde» no puede
   * significar a la vez «los datos están» y «no había datos».
   */
  if (process.env.CI) {
    throw new Error(
      'Build sin credenciales en CI: un sitio vacío se publicaría encima del que ' +
        'tiene datos (B-189, D-123). Falta el secret FIREBASE_SERVICE_ACCOUNT.',
    );
  }

  // En local sigue con lista vacía y un aviso, para poder trabajar el CSS sin
  // levantar los emuladores. El camino recomendado del §10 igual es el emulador.
  console.warn(
    '[sitio] build sin credenciales: 0 actividades. ' +
      'Levantá el emulador (npm run emu) para ver datos.',
  );
  return { actividades: [], canceladas: [], canceladasEditadasEn: {}, opciones: {} };
};

let cache: Promise<ContenidoDelSitio> | null = null;

/** El contenido del sitio, leído una sola vez por build. */
export const contenidoDelSitio = (): Promise<ContenidoDelSitio> => {
  if (!cache) {
    cache = leer();
    // Un fallo no se cachea: si no, el segundo consumidor recibe el error del
    // primero incluso cuando el entorno cambió.
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
};

/** Para los tests, que cambian el entorno entre dos lecturas. */
export const olvidarContenido = (): void => {
  cache = null;
};

/** El `events.json` completo (§4.4: las opciones viajan adentro). */
export const indiceDelSitio = async (): Promise<Indice> => {
  const { actividades, opciones } = await contenidoDelSitio();
  return construirIndice({
    actividades,
    opciones,
    version: INFO_VERSION.version,
    generadoEn: INFO_VERSION.generadoEn,
  });
};

/**
 * `{ campo: { slug: etiqueta } }` para el **listado** — las mismas etiquetas que
 * tiene la island.
 *
 * Sale del índice y no de una segunda lectura, o sea de las opciones **ya
 * filtradas por aprobación** (§4.3: el sitio no publica vocabulario sin
 * validar). Eso es lo correcto acá por un motivo puntual: el HTML de la home lo
 * imprime el build y lo re-renderiza la island con el mapa del `events.json`, así
 * que si los dos mapas no fueran el mismo, una tarjeta cambiaría de texto al
 * hidratar.
 */
export const etiquetasDelListado = async (): Promise<MapaDeEtiquetas> =>
  mapaDeEtiquetas((await indiceDelSitio()).opciones);

/**
 * `{ slug de tipo: matiz elegido }` — **uno solo para todo el build** (D-153).
 *
 * Lo usan la home y la página de detalle, y por eso está acá y no derivado en
 * cada una: el color de la categoría tiene que ser **el mismo** en la cajita que
 * abre la fila y en la cabecera del detalle, que es literalmente el arreglo de
 * B-273. Dos llamadas sueltas a `tonosDeTipo` sobre dos listas distintas serían
 * la clase de B-88 con las dos mitades a la vista.
 *
 * Sale del **índice**, o sea de las opciones ya filtradas por aprobación, y no de
 * `contenidoDelSitio()` crudo. Es la asimetría opuesta a la de
 * `etiquetasDelDetalle`, y a propósito: la **etiqueta** se resuelve sin filtrar
 * porque una actividad puede tener guardada una opción pendiente y su nombre hay
 * que mostrarlo (D-30), pero el **color** tiene que coincidir con el del listado,
 * que solo puede usar la lista filtrada —es la que viaja en el `events.json` y la
 * que la island vuelve a leer al hidratar—. Con la lista sin filtrar, un tipo
 * pendiente de aprobar pintaría un color en el listado y otro en el detalle:
 * exactamente el salto que este cambio saca.
 */
export const tonosDelSitio = async (): Promise<TonosDeTipo> =>
  tonosDeTipo((await indiceDelSitio()).opciones);

/**
 * `{ campo: { slug: etiqueta } }` para la **página de detalle** — sin filtrar.
 *
 * ── Por qué son dos mapas y no uno (D-30) ─────────────────────────────────
 * Lo encontró el `auditor-privacidad`: al derivar las etiquetas del índice, la
 * página de detalle resolvía con la lista **filtrada**, y eso invierte en
 * silencio una regla escrita en dos lugares —el docblock de `etiquetaDe` y
 * `docs/07-seguridad.md`—: *se filtra lo **elegible**, nunca la lista con la que
 * se **resuelve** un slug a su etiqueta*.
 *
 * El caso concreto que D-30 nombra: una actividad publicada puede tener guardada
 * legítimamente una opción todavía pendiente de aprobar (§4.3). Con el mapa
 * filtrado, su página muestra `desSlug` —«Con Beca Parcial»— en lugar de «Con
 * beca parcial», que es exactamente el síntoma que D-30 existe para evitar y que
 * el evento de Calendar **no** tiene, porque `cargarLabels` lee `/opciones/*`
 * entero.
 *
 * La asimetría con `etiquetasDelListado` es la decisión, y las dos mitades tienen
 * su motivo:
 *
 * | | Qué lista usa | Por qué |
 * |---|---|---|
 * | los **chips** del filtro y las tarjetas | filtrada | §4.3 — ofrecer un chip es publicar vocabulario sin validar; y el mapa tiene que ser idéntico al de la island para que la tarjeta no cambie al hidratar |
 * | la **página de detalle** | sin filtrar | D-30 — resolver no es ofrecer, y acá se resuelve un slug que la actividad ya tiene guardado. Es lo mismo que hace el evento de Calendar |
 *
 * No publica vocabulario de más: la página muestra **la etiqueta del slug que esa
 * actividad usa**, no una lista de opciones elegibles. Lo único que sale es un
 * texto que el evento público de esa misma actividad ya publica.
 */
export const etiquetasDelDetalle = async (): Promise<MapaDeEtiquetas> => {
  const { opciones } = await contenidoDelSitio();
  return mapaDeEtiquetas(
    Object.fromEntries(
      Object.entries(opciones).map(([campo, valores]) => [
        campo,
        (valores ?? []).map((v) => ({ slug: v.slug, label: v.label })),
      ]),
    ),
  );
};

/**
 * Los caminos de `/actividad/[slug]`, uno por actividad publicada.
 *
 * Vive acá y no adentro del `.astro` por una razón concreta: **un `.astro` no se
 * puede importar desde vitest**, así que un `getStaticPaths` escrito en la
 * plantilla es código sin ninguna forma de probarse. Acá lo cubre
 * `tests/sitio-publico.integracion.test.ts` contra el emulador, con el mismo par
 * publicada/borrador que ya usa el endpoint del índice: sin eso, borrar el
 * `where` generaría una página de detalle por cada borrador y la suite seguiría
 * en verde.
 *
 * `props` lleva **solo el view-model** (D-140): la plantilla no recibe la
 * actividad, así que no puede publicar nada que esta proyección no haya decidido.
 *
 * ── `ahora` es tolerante, y eso NO es paranoia (B-237) ────────────────────
 * La plantilla la envuelve (`getStaticPaths = () => caminosDeDetalle()`) en vez
 * de aliasarla, porque **Astro llama a `getStaticPaths` con un argumento
 * propio** —`{ paginate, rss }`— y con el alias ese objeto caía en este
 * parámetro, pisaba el default y el build moría con `ahora.getTime is not a
 * function`.
 *
 * No lo vio ningún test: los tests la llaman bien. Lo encontró el build de
 * verdad (`scripts/build-contra-emulador.mjs`), que es el §"Verificar contra el
 * sistema real" en acción. La guarda de acá es la segunda mitad: si mañana
 * alguien vuelve al alias —que es lo que uno escribe— el sitio se construye
 * igual, con el reloj del build, que es lo correcto.
 */
const detallesDelSitio = async (
  instante: Date,
  /**
   * ¿Se incluyen las canceladas? — B-110.
   *
   * **El default es `false`, y eso es la decisión.** Una cancelada existe solo
   * para quien tiene el link: no entra a ninguna lista (§7.3). Con el default al
   * revés, cada consumidor nuevo de esta función heredaría las canceladas sin
   * enterarse, que es exactamente cómo la pared de `/cartelera` terminaría
   * mostrando el afiche de algo que no se hace.
   *
   * Solo `caminosDeDetalle` lo pide, y lo pide escrito.
   */
  conCanceladas = false,
): Promise<DetallePublico[]> => {
  const { actividades, canceladas: conFranja } = await contenidoDelSitio();
  // Sin filtrar por aprobación: acá se **resuelve** el slug que la actividad ya
  // tiene guardado, no se ofrece un chip. Ver `etiquetasDelDetalle` (D-30).
  const etiquetas = await etiquetasDelDetalle();
  // El color sí sale de la lista filtrada, que es la del listado. Ver
  // `tonosDelSitio`: la etiqueta y el color no se resuelven con la misma lista, y
  // cada mitad tiene su motivo.
  const tonos = await tonosDelSitio();

  /*
   * **Qué páginas de mes existen, para el enlace «Más en septiembre»** — B-331,
   * cierra B-280.
   *
   * Se calcula **una vez para todo el build** y no por página: `mesesEnlazables`
   * recorre el índice entero, y hacerlo por actividad serían N recorridas para
   * obtener siempre la misma respuesta. Es la misma forma que `tonos` y
   * `etiquetas`, que ya viven acá por lo mismo.
   *
   * Y sale del **mismo** `indiceDelSitio()` memoizado que la home, el
   * `events.json`, las páginas de mes, el sitemap y `/pasadas`: cero lecturas
   * nuevas de Firestore (§2.4, §3 del diseño).
   */
  const indice = await indiceDelSitio();
  const mesesConPagina = Object.fromEntries(
    mesesEnlazables(indice.actividades, instante).map((m) => [m.clave, m.nombre]),
  );

  /*
   * La bandera viaja **pegada a cada actividad y desde su origen**, no se deduce
   * después con un `includes`: de qué query salió cada una es lo único que este
   * módulo sabe y el view-model no puede recalcular. Ver `DetallePublico.cancelada`.
   */
  const marcadas: [ActividadPublica, boolean][] = [
    ...actividades.map((a): [ActividadPublica, boolean] => [a, false]),
    ...(conCanceladas ? conFranja.map((a): [ActividadPublica, boolean] => [a, true]) : []),
  ];

  return (
    marcadas
      // Una actividad sin slug no puede tener URL. No debería pasar (el schema lo
      // exige), y si pasa es mejor una página menos que una ruta `/actividad/`.
      .filter(([a]) => a.slug)
      .map(([a, cancelada]) =>
        detalleDeActividad(a, etiquetas, instante, tonos, cancelada, mesesConPagina),
      )
  );
};

export const caminosDeDetalle = async (
  ahora?: unknown,
): Promise<{ params: { slug: string }; props: { detalle: DetallePublico } }[]> => {
  const instante = ahora instanceof Date ? ahora : new Date();
  // B-110 — **el único consumidor que pide las canceladas**, y lo pide escrito:
  // una cancelada tiene página y no aparece en ninguna lista (§7.3).
  return (await detallesDelSitio(instante, true)).map((detalle) => ({
    params: { slug: detalle.slug },
    props: { detalle },
  }));
};

/**
 * Los afiches de `/cartelera` — B-265.
 *
 * Sale del **mismo** `DetallePublico` que genera cada página de detalle, y no de
 * una proyección aparte: la pared muestra la misma imagen que la cabecera de la
 * actividad, y con dos derivaciones eso sería una coincidencia que se rompe sola
 * (la clase de B-88). La proyección a `Afiche` solo saca campos, así que no
 * puede publicar nada que `detallePublico.ts` no haya decidido publicar.
 *
 * `ahora` es tolerante por lo mismo que `caminosDeDetalle`: una plantilla que la
 * aliasee en vez de envolverla recibiría el `{ paginate, rss }` de Astro en el
 * primer parámetro (B-237).
 *
 * **No pide las canceladas** (B-110): la pared es una lista y una cancelada no
 * entra a ninguna. No hace falta que lo diga —el default de `detallesDelSitio` ya
 * es ése— y se deja implícito a propósito: pasarle `false` sugeriría que hay algo
 * que decidir acá, cuando la decisión es del §7.3 y vale para toda lista.
 */
export const carteleraDelSitio = async (ahora?: unknown): Promise<Afiche[]> => {
  const instante = ahora instanceof Date ? ahora : new Date();
  return carteleraDeDetalles(await detallesDelSitio(instante));
};

/**
 * Todo lo que la página de un mes necesita, y **nada más** — el view-model de
 * `/agenda/[mes]` (B-113, D-140).
 *
 * ── Por qué la plantilla no se lee el índice ──────────────────────────────
 * La primera versión recibía `pagina` por props y además hacía
 * `const indice = await indiceDelSitio()` en el frontmatter, para sacar de ahí
 * las etiquetas, los matices y los otros meses. Se veía inocente y no filtraba
 * nada, pero dejaba **el índice entero en el alcance de la plantilla** —las
 * actividades publicadas con su `searchText` y su `creadoEn`—, o sea justo la
 * puerta de al lado que D-140 cerró para la página de detalle: la garantía
 * dejaba de darla el tipo y pasaba a darla un `grep` en un test. Lo encontró el
 * `auditor-privacidad`.
 *
 * Con esto, la plantilla importa **una sola función** y lo que recibe es lo que
 * acá se decidió darle, campo por campo. No puede publicar lo que no tiene.
 *
 * `otros` son los meses enlazables **menos el propio**, ya recortados a lo que la
 * navegación usa: la clave y el nombre. Mandar las `PaginaDeMes` enteras metería
 * en cada página las entradas de todos los demás meses, que es contenido que esa
 * página no muestra.
 */
export interface VistaDeMes {
  pagina: PaginaDeMes;
  etiquetas: MapaDeEtiquetas;
  tonos: TonosDeTipo;
  /** El reloj del build, en ISO. La plantilla lo reconstituye a `Date`. */
  generadoEn: string;
  /** Los otros meses que se pueden enlazar: solo la clave y el nombre. */
  otros: { clave: string; nombre: string }[];
}

/**
 * Los caminos de `/agenda/[mes]`, uno por mes que pasa el corte del §2.2 — B-113.
 *
 * **No agrega una lectura de Firestore.** Sale del mismo `indiceDelSitio()` que
 * ya usan la home y el `events.json`, que está memoizado: el §3 del diseño dice
 * «tres artefactos con una sola lectura», y las páginas de mes son un cuarto que
 * no cambia el número.
 *
 * ── El reloj es el del índice, y eso importa acá más que en otras páginas ──
 * `new Date(indice.generadoEn)` y no `new Date()`: cuáles meses se emiten y qué
 * entra en cada uno se decide con **el mismo instante** que decide qué muestra la
 * home y qué dice el `events.json`. Con dos relojes, un build que arranca a las
 * 23:59:58 del último día del mes puede emitir la página de septiembre como
 * vigente y la home ya en octubre — y eso se ve una vez cada treinta días, que es
 * exactamente la frecuencia con la que nadie lo reproduce.
 *
 * `ahora` es tolerante por lo mismo que `caminosDeDetalle`: Astro llama a
 * `getStaticPaths` con un argumento propio (`{ paginate, rss }`), y una plantilla
 * que aliasee esta función en vez de envolverla lo recibiría acá (B-237).
 */
export const caminosDeMes = async (
  ahora?: unknown,
): Promise<{ params: { mes: string }; props: { vista: VistaDeMes } }[]> => {
  const indice = await indiceDelSitio();
  const instante = ahora instanceof Date ? ahora : new Date(indice.generadoEn);

  // Las mismas etiquetas y los mismos matices que la home: salen del índice, o
  // sea de las opciones ya filtradas por aprobación. Ver `etiquetasDelListado`.
  const etiquetas = mapaDeEtiquetas(indice.opciones);
  const tonos = tonosDeTipo(indice.opciones);
  const enlazables = mesesEnlazables(indice.actividades, instante).map((m) => ({
    clave: m.clave,
    nombre: m.nombre,
  }));

  return mesesDelSitio(indice.actividades, instante).map((pagina) => ({
    params: { mes: pagina.clave },
    props: {
      vista: {
        pagina,
        etiquetas,
        tonos,
        generadoEn: indice.generadoEn,
        // Una página vencida no linkea a otra vencida, y ninguna se linkea a sí
        // misma: mandar de un mes que pasó a otro que pasó es un callejón.
        otros: enlazables.filter((m) => m.clave !== pagina.clave),
      },
    },
  }));
};

/**
 * Las rutas del `sitemap.xml` — B-109.
 *
 * **No agrega una lectura de Firestore**: sale del mismo `indiceDelSitio()`
 * memoizado que la home, el `events.json` y las páginas de mes, más las
 * canceladas que ya trajo la segunda query de B-110. Es el quinto consumidor de
 * la misma lectura (§3 del diseño: «tres artefactos con una sola lectura», y ya
 * van cinco sin cambiar el número).
 *
 * ── Las tres cosas que este módulo aporta y `lib/sitemap.ts` no puede ─────
 * 1. **el reloj**, que es el del índice y no `new Date()`: cuáles meses se
 *    emiten, qué actividad ya pasó y qué cancelada sigue siendo reciente se
 *    deciden con el **mismo** instante que decidió qué muestra la home. Con dos
 *    relojes, un build a caballo de la medianoche puede emitir una página que el
 *    sitemap no lista, y eso se ve una vez cada tanto — o sea nunca en un test;
 * 2. **el `updatedAt` de las canceladas**, que solo el lector ve porque solo él
 *    toca el documento crudo (ver `canceladasEditadasEn`);
 * 3. y que el endpoint reciba **una lista de rutas y nada más** (D-140): no ve el
 *    índice, así que no puede publicar un campo aunque quiera.
 */
export const sitemapDelSitio = async (ahora?: unknown): Promise<string[]> => {
  const indice = await indiceDelSitio();
  const { canceladas, canceladasEditadasEn } = await contenidoDelSitio();
  const instante = ahora instanceof Date ? ahora : new Date(indice.generadoEn);

  return rutasDelSitemap({
    entradas: indice.actividades,
    canceladas: canceladas.map((a) => ({
      slug: a.slug,
      editadaEn: canceladasEditadasEn[a.slug] ?? null,
    })),
    ahora: instante,
  });
};

/**
 * Todo lo que `/pasadas` necesita, y **nada más** — el view-model del archivo
 * (B-109, D-140).
 *
 * La misma forma que `caminosDeMes`: la plantilla importa **una** función y
 * recibe lo que acá se decidió darle, campo por campo. No ve el índice, así que
 * no puede publicar el `searchText` ni el `creadoEn` de nadie por un `{}` de más
 * — que es la puerta que D-140 cerró para la página de detalle y que el
 * `auditor-privacidad` volvió a encontrar abierta en la primera versión de la
 * página de mes.
 *
 * **Cero lecturas nuevas de Firestore**: sale del mismo `indiceDelSitio()`
 * memoizado que la home, el `events.json`, las páginas de mes y el sitemap.
 *
 * El reloj es el del índice y no `new Date()`, por lo mismo que en `caminosDeMes`:
 * qué actividad «ya pasó» tiene que decidirse con el **mismo** instante que decidió
 * qué muestra la home. Con dos relojes, una actividad que termina mientras corre
 * el build puede quedar afuera de las dos páginas — y ésa es exactamente la
 * página huérfana que este archivo existe para que no exista.
 */
export interface VistaDePasadas {
  entradas: EntradaDeIndice[];
  etiquetas: MapaDeEtiquetas;
  tonos: TonosDeTipo;
  /** El reloj del build, en ISO. La plantilla lo reconstituye a `Date`. */
  generadoEn: string;
}

export const vistaDePasadas = async (ahora?: unknown): Promise<VistaDePasadas> => {
  const indice = await indiceDelSitio();
  const instante = ahora instanceof Date ? ahora : new Date(indice.generadoEn);

  return {
    entradas: pasadasDelSitio(indice.actividades, instante),
    // Las mismas etiquetas y los mismos matices que la home y las páginas de mes:
    // salen del índice, o sea de las opciones ya filtradas por aprobación.
    etiquetas: mapaDeEtiquetas(indice.opciones),
    tonos: tonosDeTipo(indice.opciones),
    generadoEn: indice.generadoEn,
  };
};
