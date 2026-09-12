import { urlSegura } from '@/lib/enlaceSeguro';
import { imagenesPublicables, portadaDe } from '@/lib/imagenes';
import { modalidadesQueOfrece } from '@/lib/modalidades';
import { opcionesPublicas, type ActividadPublica, type OpcionPublica } from '@/lib/toPublic';
import type { CampoTaxonomia, ValorOpcion } from '@/types/actividad';

/**
 * `/events.json` — el índice que el listado filtra en memoria (§2.5) — B-106.
 *
 * ── Dos filtros en serie, no uno ──────────────────────────────────────────
 * `toPublic` decide **qué puede ser público** (§5). Esto decide **qué necesita el
 * listado**, que es menos. Son dos preguntas distintas y se contestan en dos
 * lugares a propósito (§3.1 del diseño): la primera es de privacidad y la segunda
 * de peso y de superficie.
 *
 * Lo que el índice **no** lleva, y sí está en `toPublic`: `descripcion`,
 * `sede.direccion`, `sede.geo`, `sede.indicaciones`, `inscripcion.destino`,
 * `material`, `sesiones[].tema`, `sesiones[].lectura`, `tallerista.bio` y las
 * **filas** de `modalidades` con su sede (el índice lleva solo sus valores, para
 * el filtro — B-224). Nada
 * de eso se usa para filtrar ni para pintar una tarjeta, y todo vive en el HTML
 * de la página de detalle, que es donde hace falta.
 *
 * Las dos ventajas, en este orden:
 *
 * 1. **Menos superficie scrapeable.** `inscripcion.destino` es un mail o un
 *    WhatsApp, y el §5.1 ya advierte que queda expuesto a bots. Sacarlo del JSON
 *    no lo esconde —está en el HTML del detalle— pero deja de **servirlo en lote,
 *    en un solo GET**. La diferencia entre scrapear un archivo y crawlear N
 *    páginas es la que decide si alguien lo hace.
 * 2. **Peso.** El campo caro es `descripcion`, y `searchText` ya lo contiene
 *    normalizado (§6): mandar los dos es mandar la descripción dos veces.
 *
 * ── Y es la TERCERA proyección de la misma decisión ───────────────────────
 * Ya hay `toPublic` (salida 1) y `opcionesPublicas` (§4.4). Ésta se apoya en la
 * primera en vez de leer el documento: **recorta una `ActividadPublica`, no una
 * `Actividad`.** Es lo que hace que no pueda publicar algo que la frontera de
 * privacidad ya descartó — un `Actividad` de entrada la habría dejado decidir de
 * nuevo sobre `difusion` y `createdBy`, y esa decisión ya está tomada.
 *
 * El barrido de centinelas la cubre como salida propia
 * (`tests/barrido-de-salidas-publicas.test.ts`).
 */

/** Una sesión en el índice: solo lo que el listado necesita para ordenar y filtrar. */
export interface SesionDeIndice {
  inicio: string;
  fin: string;
  cancelada: boolean;
}

/** La sede en el índice: sin dirección, sin indicaciones y sin coordenadas. */
export interface SedeDeIndice {
  nombre: string;
  barrio: string;
  ciudad: string;
}

export interface EntradaDeIndice {
  id: string;
  slug: string;
  titulo: string;
  tipo: string;
  /** Los primeros ~160 caracteres de `descripcion`, cortados en palabra. */
  resumen: string;
  /** La portada de la galería, o `null`. Ver la nota de `imagenUrlDe`. */
  imagenUrl: string | null;
  /** La resultante: la unión de las formas de cursar. Es lo que la tarjeta dice. */
  modalidad: string;
  /**
   * **Todas** las modalidades que la actividad ofrece, para el filtro (B-224).
   *
   * No es la lista de formas de cursar: son sus valores, sin repetir y sin sede
   * ni fechas. Es lo único que el filtro necesita, y es lo que hace que una
   * actividad presencial-y-virtual aparezca bajo los tres chips en vez de solo
   * bajo «Presencial y virtual» — las tres cosas son ciertas de ella, y con el
   * escalar solo el sitio la escondería de los dos filtros que la describen mejor.
   * Es el mismo criterio que el filtro del panel.
   *
   * Las **sedes** de cada fila y las fechas de la ventana **no** entran: la
   * primera es del detalle (el índice ya lleva una sola sede, la derivada) y las
   * segundas no salen a ninguna salida todavía.
   */
  modalidades: string[];
  sede: SedeDeIndice | null;
  /** Solo el slug del arancel: las notas («2 cuotas») son del detalle. */
  /*
   * B-114 — el índice lleva **el monto además del tipo** porque la tarjeta del
   * listado lo dice. Sigue sin llevar `notas`: eso es texto libre («2 cuotas»,
   * «incluye material») que la tarjeta no muestra, y el índice recorta más que
   * `toPublic` a propósito.
   */
  arancel: { tipo: string; monto: number | null };
  /** **Strings, no objetos**: el Instagram y la bio son del detalle. */
  organizador: string;
  /**
   * El nombre, o `null` si no hay tallerista — y «no hay tallerista» es **que no
   * tenga nombre**, no que falte el objeto (B-861).
   *
   * Esta línea lo colapsa con `a.tallerista?.nombre ?? null` y **no repite el
   * predicado**: `toPublic` ya devuelve `null` para la cáscara `{ nombre: '', … }`,
   * así que el índice lo hereda. Antes de B-861 esa cáscara llegaba hasta acá y
   * salía como `''` — un tallerista que existe y se llama «».
   */
  tallerista: string | null;
  tags: string[];
  destacado: boolean;
  /**
   * El ISO de cuándo se cargó — D-138. Es la clave del orden «Recién agregadas»
   * del listado, que es lo único que la usa: la tarjeta no muestra esta fecha.
   */
  creadoEn: string;
  esCiclo: boolean;
  /** Solo la plataforma, para el filtro de modalidad. */
  online: { plataforma: string } | null;
  sesiones: SesionDeIndice[];
  inscripcion: {
    requiere: boolean;
    cupo: number | null;
    /**
     * **El ISO del cierre, no un booleano** — B-111.
     *
     * `toPublic` emite `abierta`, que se calcula **en el build** y desde ahí
     * miente hasta el rebuild siguiente: una inscripción que cerró a la
     * medianoche sigue diciendo «abierta» todo el día. Mandando la fecha, el
     * listado lo decide con el reloj de quien mira.
     */
    cierraEn: string | null;
    completo: boolean;
  };
  searchText: string;
}

/**
 * Un encuentro en el índice plano — B-99. Es una re-indexación de dato que ya es
 * público (la sesión ya viaja dentro de su actividad): solo el slug de la
 * actividad, el id de la sesión y su inicio. **Nada nuevo se expone**; lo que se
 * gana es contestar «¿qué hay hoy / mañana / este finde?» sin aplanar los ciclos
 * en el navegador en cada filtrado.
 */
export interface EncuentroDeIndice {
  /** La actividad a la que pertenece — para ir a buscar su tarjeta en `actividades`. */
  slug: string;
  /** El id de la sesión (uuid del cliente, trampa 2). Identifica el encuentro. */
  sesionId: string;
  /** ISO del inicio. El índice va ordenado ascendente por este campo. */
  inicio: string;
}

export interface Indice {
  generadoEn: string;
  /** La misma que estampa `scripts/version.mjs`: de qué build salió este archivo. */
  version: string;
  opciones: Record<string, OpcionPublica[]>;
  actividades: EntradaDeIndice[];
  /**
   * Índice **plano** de encuentros próximos (no cancelados, desde el build hacia
   * adelante), ordenado por fecha — B-99. Deriva de `actividades[].sesiones`, no
   * agrega dato: mismo criterio que el listado (el build emite, el cliente filtra
   * por su reloj), pero por encuentro en vez de por actividad.
   */
  encuentros: EncuentroDeIndice[];
}

/**
 * El eje plano de encuentros de B-99, derivado de las actividades ya proyectadas.
 * Puro y exportado para el barrido de `tests/barrido-de-salidas-publicas.test.ts`
 * y el test de forma. Emite solo encuentros **no cancelados** cuyo `inicio` es
 * `>= generadoEn` (los pasados no sirven a «lo que viene» y solo engordarían el
 * archivo). Los ISO son UTC, así que el `>=` y el orden son comparación de string.
 */
export const encuentrosDelIndice = (
  actividades: readonly ActividadPublica[],
  generadoEn: string,
): EncuentroDeIndice[] =>
  actividades
    .flatMap((a) =>
      a.sesiones
        .filter((s) => !s.cancelada && s.inicio >= generadoEn)
        .map((s) => ({ slug: a.slug, sesionId: s.id, inicio: s.inicio })),
    )
    .sort((x, y) => x.inicio.localeCompare(y.inicio));

/** Largo del resumen. 160 es el corte útil como `meta description` (§5.1). */
/**
 * Las taxonomías cuyo **vocabulario** no viaja en el `events.json` — B-830,
 * D-580.
 *
 * §4.4 dice que las opciones viajan en el archivo «y la web arma los chips de
 * filtro recorriendo `opciones.*`». Ese es el contrato, y define quién las lee:
 * la island. `incluye-actividad` **no es eje de filtro** (D-580), así que no hay
 * chip que armar y su vocabulario viajaría sin que nada lo lea — la primera
 * taxonomía del repo en esa situación.
 *
 * Sin este filtro, el archivo gana una clave con los siete slugs y etiquetas
 * base **más todo «Otro» que alguien tipee**, que desde B-131 nace `aprobada` y
 * sale en el rebuild siguiente sin pasar por moderación. Y una etiqueta se tipea
 * al guardar, también con la actividad en **borrador**: sería texto sobre algo no
 * publicado, en la salida más barata de cosechar (D-129). Lo encontró el
 * `auditor-privacidad` sobre B-830: el campo no entra al índice y su vocabulario
 * sí, por el otro camino, así que la fila de D-580 era cierta del campo y falsa
 * del archivo.
 *
 * **La página de detalle no se entera**, y por eso el filtro es gratis: resuelve
 * las etiquetas en el build, contra `contenidoDelSitio()` directo, no contra el
 * índice (§2.4).
 *
 * Es una lista y no un `!== 'incluye-actividad'` para que la séptima taxonomía
 * obligue a decidir en vez de entrar sola: `tests/barrido-de-salidas-publicas.test.ts`
 * la ata contra `CAMPOS_TAXONOMIA`.
 */
export const TAXONOMIAS_FUERA_DEL_INDICE: readonly CampoTaxonomia[] = [
  'incluye-actividad',
  /*
   * **Los seis de las suscripciones literarias** — B-832. Es el mismo argumento
   * un paso más lejos: aquélla no viaja porque no es eje de filtro **de la
   * agenda**; éstas tampoco lo son, y además no describen una actividad. Sus
   * chips los arma `/suscripciones.json`, que baja solo quien abre
   * `/guia/suscripciones` — que es todo el motivo por el que ese índice es un
   * archivo propio y no una clave más de `events.json` (§ 5 del PRD 3).
   *
   * Meterlas acá no es prolijidad: el `events.json` lo baja **toda** persona que
   * abre la agenda, y seis vocabularios sin consumidor son peso para todos más
   * la superficie de D-129 —texto tipeado en «Otro», que nace aprobado y sale en
   * el rebuild siguiente— multiplicada por seis.
   */
  'periodicidad',
  'tipo-oferente',
  'perfil-editorial',
  'incluye-suscripcion',
  'extras-suscripcion',
  'alcance-envio',
];

export const LARGO_RESUMEN = 160;

/**
 * Los primeros `LARGO_RESUMEN` caracteres, **cortados en límite de palabra**.
 *
 * Se calcula en el build y no es un campo nuevo del modelo (§3.1): pedirle un
 * resumen a mano a quien carga es un campo más en un formulario de treinta, y lo
 * que se escribiría es la primera oración de la descripción.
 *
 * Cortar por caracteres a secas parte la última palabra al medio, y eso se lee
 * como un error de software en la tarjeta y en el resultado de Google.
 */
export const resumenDe = (descripcion: string): string => {
  const limpia = descripcion.replace(/\s+/g, ' ').trim();
  if (limpia.length <= LARGO_RESUMEN) return limpia;

  const recorte = limpia.slice(0, LARGO_RESUMEN + 1);
  const ultimoEspacio = recorte.lastIndexOf(' ');
  // Sin espacios en 161 caracteres (una URL pegada, por ejemplo) se corta duro:
  // es preferible a devolver la cadena entera y romper el largo prometido.
  const cuerpo = ultimoEspacio > 0 ? recorte.slice(0, ultimoEspacio) : limpia.slice(0, LARGO_RESUMEN);
  return `${cuerpo.replace(/[.,;:—-]$/, '')}…`;
};

/**
 * La URL de la portada, **saneada y filtrada con las mismas dos funciones que la
 * página de detalle** — B-860, que cierra la tanda de B-854.
 *
 * **Nota de fidelidad al diseño:** §3.1 escribe este campo como `imagenUrl`, que
 * era el nombre del campo del modelo cuando se diseñó. B-167 lo reemplazó por la
 * galería `imagenes: Imagen[]` con un flag `portada`. Se conserva el nombre del
 * diseño y se deriva de la portada: el listado necesita **una** imagen y elegir
 * cuál es una decisión del modelo (D-125), no del consumidor.
 *
 * ── Era la tercera respuesta a «cuál es la imagen», y la única cruda ───────
 * Hasta B-860 esta línea era `portadaDe(a.imagenes)?.url ?? null`: **ni
 * `urlSegura` ni el filtro de `imagenesPublicables`**. Las otras dos respuestas
 * del repo sí los usan —`imagenesDeDetalle` (`lib/detallePublico.ts`), que es lo
 * que alimenta la pared de `/cartelera` y el `image` del JSON-LD, y
 * `faltaElFlyer` (`lib/imagenes.ts`), que es lo que el panel dice—, así que la
 * misma pregunta tenía dos respuestas convergidas por B-854 y una tercera que
 * había quedado afuera. Es la clase de B-88 en su cara más chata: no una segunda
 * lista de reglas, la **misma** pregunta contestada por una función que nació
 * para otra cosa.
 *
 * El caso que divergía es el mismo de B-854 y es alcanzable: un documento con el
 * `imagenUrl` legacy (D-125) nunca pasó por `esUrl` ni por el esquema que B-817
 * puso en `imagenes[].url`, así que puede traer `javascript:alert(1)`,
 * `C:\fotos\flyer.jpg` o «Ver el flyer en instagram». El `events.json` lo
 * publicaba crudo.
 *
 * **El atenuante, dicho entero porque es lo que lo mantuvo en P4:** hoy este
 * campo **no tiene lector**. D-146 sacó las imágenes del listado y el `og:image`
 * sale de `detalle.imagenes[0]`, que ya está saneado. O sea que no era un XSS
 * —ningún `href` ni ningún `src` recibía este valor—, era un dato crudo en un
 * artefacto público y estático que el próximo consumidor iba a leer creyendo que
 * había pasado por el mismo filtro que las otras dos respuestas. **Verificado el
 * 2026-09-11**, y si algún día aparece el lector, esta línea ya no lo espera.
 *
 * ── El orden: filtrar y después elegir portada ────────────────────────────
 * Es el mismo que el docblock de `imagenesDeDetalle` deja explícito, y por el
 * mismo motivo: con la portada rota y una foto sana, elegir primero dejaría el
 * índice sin imagen habiendo una válida. `portadaDe` sobre la lista ya filtrada
 * da exactamente eso.
 *
 * Y lo que se publica es el valor **saneado** (`urlSegura`), no el crudo: es lo
 * que hace que el índice y el detalle digan la misma URL para la misma imagen.
 * El `urlSegura` de acá no puede devolver `null` —`imagenesPublicables` dejó
 * pasar exactamente las filas para las que no lo devuelve—, pero se deja tipado
 * `string | null` porque el campo ya lo era.
 */
const imagenUrlDe = (a: ActividadPublica): string | null => {
  const portada = portadaDe(imagenesPublicables(a.imagenes));
  return portada ? urlSegura(portada.url) : null;
};

/**
 * Las sesiones, **ordenadas por inicio**.
 *
 * El array del documento no garantiza orden: el formulario permite agregar filas
 * en cualquier orden y el botón de «generar N encuentros» las agrega al final.
 * Ordenar es del build —una vez— y no de cada consumidor: si lo hiciera cada
 * consumidor, el que se olvide muestra «Encuentro 3» antes que «Encuentro 1» y
 * nada falla.
 */
const sesionesDeIndice = (a: ActividadPublica): SesionDeIndice[] =>
  [...a.sesiones]
    .map((s) => ({ inicio: s.inicio, fin: s.fin, cancelada: s.cancelada }))
    .sort((x, y) => x.inicio.localeCompare(y.inicio));

/** Una `ActividadPublica` recortada a lo que el listado necesita. */
export const entradaDeIndice = (a: ActividadPublica): EntradaDeIndice => ({
  id: a.id,
  slug: a.slug,
  titulo: a.titulo,
  tipo: a.tipo,
  resumen: resumenDe(a.descripcion),
  imagenUrl: imagenUrlDe(a),
  modalidad: a.modalidad,
  // Los valores, no las filas: el filtro no necesita la sede de cada una.
  modalidades: modalidadesQueOfrece(a.modalidades),
  sede: a.sede
    ? { nombre: a.sede.nombre, barrio: a.sede.barrio, ciudad: a.sede.ciudad }
    : null,
  arancel: { tipo: a.arancel.tipo, monto: a.arancel.monto ?? null },
  organizador: a.organizador.nombre,
  tallerista: a.tallerista?.nombre ?? null,
  tags: a.tags,
  destacado: a.destacado,
  creadoEn: a.creadoEn,
  esCiclo: a.esCiclo,
  online: a.online ? { plataforma: a.online.plataforma } : null,
  sesiones: sesionesDeIndice(a),
  inscripcion: {
    requiere: a.inscripcion.requiere,
    cupo: a.inscripcion.cupo,
    cierraEn: a.inscripcion.cierraEn,
    completo: a.inscripcion.completo,
  },
  searchText: a.searchText,
});

/**
 * El archivo entero.
 *
 * Las opciones viajan **en el mismo archivo** (§4.4) para que los chips de filtro
 * no tengan nada cableado: al agregar una etiqueta aparece sola en los filtros.
 * Por eso el rebuild se dispara también cuando cambia `/opciones/*` (§8, trampa 8).
 */
export const construirIndice = ({
  actividades,
  opciones,
  version,
  generadoEn,
}: {
  actividades: readonly ActividadPublica[];
  opciones: Partial<Record<CampoTaxonomia, ValorOpcion[]>>;
  version: string;
  generadoEn: string;
}): Indice => ({
  generadoEn,
  version,
  opciones: Object.fromEntries(
    Object.entries(opciones)
      .filter(([campo]) => !TAXONOMIAS_FUERA_DEL_INDICE.includes(campo as CampoTaxonomia))
      .map(([campo, valores]) => [campo, opcionesPublicas(valores ?? [])]),
  ),
  actividades: actividades.map(entradaDeIndice),
  encuentros: encuentrosDelIndice(actividades, generadoEn),
});
