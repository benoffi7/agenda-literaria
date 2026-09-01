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
import { construirIndice, type Indice } from '@/lib/eventsJson';
import { detalleDeActividad, type DetallePublico } from '@/lib/detallePublico';
import { carteleraDeDetalles, type Afiche } from '@/lib/cartelera';
import {
  mapaDeEtiquetas,
  tonosDeTipo,
  type MapaDeEtiquetas,
  type TonosDeTipo,
} from '@/lib/listadoPublico';
import { toPublic, type ActividadPublica } from '@/lib/toPublic';
import { INFO_VERSION } from '@/lib/version';
import {
  CAMPOS_TAXONOMIA,
  type Actividad,
  type CampoTaxonomia,
  type ValorOpcion,
} from '@/types/actividad';

/** El `where` del §5.3: solo lo publicado entra al sitio (§3.3 del diseño). */
const ESTADO_PUBLICO = 'publicado';

export interface ContenidoDelSitio {
  actividades: ActividadPublica[];
  opciones: Partial<Record<CampoTaxonomia, ValorOpcion[]>>;
}

/**
 * Las actividades publicadas, proyectadas.
 *
 * La query lleva el `where('estado','==','publicado')` porque es lo que el §3.3
 * define que entra al sitio — y no por las reglas de Firestore: el Admin SDK las
 * saltea. Vale decirlo porque la trampa 7 del §13 habla del caso contrario.
 *
 * **Las canceladas no entran todavía** (§7.3 del diseño, B-110): una actividad
 * cancelada que estuvo publicada tendría que conservar su página con la franja
 * CANCELADA en vez de devolver 404. Es su propio ítem porque necesita saber si
 * *estuvo* publicada alguna vez, que no es un dato del modelo.
 */
const publicadas = async (): Promise<ActividadPublica[]> => {
  const snap = await adminDb()
    .collection('actividades')
    .where('estado', '==', ESTADO_PUBLICO)
    .get();
  return snap.docs.map((d) => toPublic(d.data() as Actividad, d.id));
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
    const [actividades, opciones] = await Promise.all([publicadas(), opcionesDeTaxonomia()]);
    return { actividades, opciones };
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
  return { actividades: [], opciones: {} };
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
const detallesDelSitio = async (instante: Date): Promise<DetallePublico[]> => {
  const { actividades } = await contenidoDelSitio();
  // Sin filtrar por aprobación: acá se **resuelve** el slug que la actividad ya
  // tiene guardado, no se ofrece un chip. Ver `etiquetasDelDetalle` (D-30).
  const etiquetas = await etiquetasDelDetalle();
  // El color sí sale de la lista filtrada, que es la del listado. Ver
  // `tonosDelSitio`: la etiqueta y el color no se resuelven con la misma lista, y
  // cada mitad tiene su motivo.
  const tonos = await tonosDelSitio();
  return (
    actividades
      // Una actividad sin slug no puede tener URL. No debería pasar (el schema lo
      // exige), y si pasa es mejor una página menos que una ruta `/actividad/`.
      .filter((a) => a.slug)
      .map((a) => detalleDeActividad(a, etiquetas, instante, tonos))
  );
};

export const caminosDeDetalle = async (
  ahora?: unknown,
): Promise<{ params: { slug: string }; props: { detalle: DetallePublico } }[]> => {
  const instante = ahora instanceof Date ? ahora : new Date();
  return (await detallesDelSitio(instante)).map((detalle) => ({
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
 */
export const carteleraDelSitio = async (ahora?: unknown): Promise<Afiche[]> => {
  const instante = ahora instanceof Date ? ahora : new Date();
  return carteleraDeDetalles(await detallesDelSitio(instante));
};
