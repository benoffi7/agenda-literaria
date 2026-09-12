/**
 * **La proyección pública de un lugar para eventos** — B-833, tajada 4.
 *
 * ── Es una whitelist, y ahí está toda la seguridad de esto ────────────────
 * §5.2 del `CLAUDE.md` y el recuadro del § 1.2 del inventario. Acá no hay un
 * solo spread sobre el documento: cada campo que sale está escrito con su
 * nombre, y el campo que mañana se agregue a `Lugar` **no sale** hasta que
 * alguien venga a escribirlo acá. Ese es el default correcto.
 *
 * ── Y este archivo tiene algo que los otros dos directorios no ────────────
 * **Un campo que sale o no sale según un flag del mismo documento**, y lo que
 * esconde es la dirección de la casa de una persona (§ 6 del PRD 4). Esa
 * decisión vive en **una sola función** —`dondeQueSale`— y no repartida en el
 * llamador: es la cuarta instancia del par flag + dato, registrada en
 * `lib/paresFlagDato.ts` y vigilada como **clase** desde B-911.
 *
 * ── El campo que no sale nunca ────────────────────────────────────────────
 * `contactoDeQuienCargo`, el mismo dato personal de un tercero que ya vigilan
 * los barridos de librerías y suscripciones. El centinela vive en
 * `tests/lugar-publico.test.ts` con el fixture
 * `tests/fixtures/centinelas-lugar.ts`, y el control negativo codificado es el
 * de B-212: se mete el spread y se exige que falle nombrando el campo.
 *
 * Tampoco salen `revision`, `origen`, `estado`, `creadoEn`, `publicadaAlgunaVez`
 * ni **`direccionPublica`**. Los cinco primeros son el ciclo de vida; el último
 * es política de publicación y no un dato de la ficha —y publicarlo sería además
 * poner un cartel de «acá hay una dirección que no te estoy dando»—. Que la
 * dirección salga vacía ya dice todo lo que un consumidor necesita saber.
 *
 * ── Y el campo que sale, pero nunca como número: el precio ────────────────
 * B-837 / D-570, la misma forma que estrenó el precio de una suscripción
 * (DEC-12). La proyección de `precio` es **un string con la frase ya armada** —
 * «$25.000 por hora · cargado el 24 de septiembre de 2026»—, que es lo que hace
 * imposible mostrarlo sin su fecha y, de arriba, lo que hace imposible filtrarlo
 * u ordenarlo. Lo pide además el § 5 del PRD con todas las letras: «el filtro
 * que la gente quiere no es "hasta $X"».
 *
 * ── Lo que llega acá puede venir de cualquiera ────────────────────────────
 * El alta de un lugar la va a poder pedir un anónimo, y `firestore.rules` **no
 * puede iterar una lista** (B-842): `incluye` llega sin validar elemento por
 * elemento. Acá pasa todo por los saneadores que el proyecto ya tiene
 * —`urlSegura`, `handleInstagram`, `slugify`— y lo que no pasa **se descarta**:
 * nunca se emite algo que no se pudo verificar.
 *
 * ── Puro, y por eso barrible ──────────────────────────────────────────────
 * Sin Firestore y sin navegador. La lectura —con su
 * `where('estado','==','publicado')`— vive en `contenidoDelSitio.ts`.
 */
import { fraseConFecha, type DatoConFecha } from '@/lib/datoConFecha';
import { urlSegura, handleInstagram } from '@/lib/enlaceSeguro';
import { imagenesPublicables, portadaDe } from '@/lib/imagenes';
import { NOMBRE } from '@/lib/identidad';
import { normalize } from '@/lib/normalize';
import { RUTA_AGENDA, RUTA_GUIA, RUTA_LUGARES, rutaDeLugar, urlAbsoluta } from '@/lib/rutasPublicas';
import { slugify } from '@/lib/slugify';
import { opcionesPublicas, type OpcionPublica } from '@/lib/toPublic';
import {
  MAX_CAPACIDAD_LUGAR,
  MAX_INCLUYE_LUGAR,
  MIN_WHATSAPP_LUGAR,
  TOPE_SLUG_TAXONOMIA_LUGAR,
  TOPE_WHATSAPP_LUGAR,
  type GeoDeLugar,
  type Lugar,
  type PrecioDeLugar,
} from '@/types/lugar';
import type { ValorOpcion } from '@/types/actividad';

/**
 * Una imagen de la ficha, **sin `storagePath`**.
 *
 * Mismo recorte y mismo motivo que en los otros dos directorios: `storagePath`
 * es el handle interno del objeto en Storage, y publicarlo le da a cualquiera la
 * ruta exacta de un bucket cuyo `list` está cerrado a propósito (trampa 13). El
 * `id` tampoco sale: es del editor del panel.
 */
export interface ImagenDeLugarPublica {
  /** Ya saneada con `urlSegura`: lo que no era `http(s)` no llegó hasta acá. */
  url: string;
  epigrafe: string;
  ancho: number | null;
  alto: number | null;
}

/**
 * **Dónde queda, y solo lo que el flag deja salir** — § 6 del PRD 4.
 *
 * `barrio` y `ciudad` salen siempre: son el «más o menos por Villa Crespo» que
 * el PRD deja publicar en los dos casos, y sin ellos la ficha de una casa no
 * diría nada y el filtro de barrio la dejaría afuera de su propio chip.
 */
export interface DondePublico {
  /** `''` cuando el flag está apagado. Nunca `null`: una sola forma de vacío. */
  direccion: string;
  /** Slug de `/opciones/barrio` — el mismo de las actividades. Sale siempre. */
  barrio: string;
  ciudad: string;
  /** `null` cuando el flag está apagado. Es lo que pone la casa en un mapa. */
  geo: GeoDeLugar | null;
}

/** Las tres clases del filtro de costo — § 5 del PRD. */
export const CLASES_DE_COSTO = ['sin-costo', 'consumiendo', 'pagando'] as const;
export type ClaseDeCosto = (typeof CLASES_DE_COSTO)[number];

/**
 * Lo que de un lugar sale al sitio. **Whitelist: si no está acá, no sale.**
 */
export interface LugarPublico {
  /** El segmento de la URL. Inmutable después de publicar — trampa 10. */
  slug: string;
  nombre: string;
  descripcion: string;
  imagenes: ImagenDeLugarPublica[];
  /** Slug de `/opciones/tipo-lugar`. Eje de filtro 5 del § 7. */
  tipo: string;
  /** ⚠️ La dirección y la `geo` **solo si `direccionPublica`**. Ver `dondeQueSale`. */
  donde: DondePublico;
  /** «Hasta N personas», o `null`. Filtro 1 del § 7, en rangos. */
  capacidad: number | null;
  capacidadNotas: string;
  /** Slugs de `/opciones/incluye-lugar`, ya filtrados. Eje de filtro 4. */
  incluye: string[];
  incluyeOtro: string;
  /** Slug de `/opciones/condicion-de-uso`. **No es un precio** (§ 5). */
  condicion: string;
  /**
   * La clase de costo, **derivada acá y no en la island**.
   *
   * Es el filtro 2 del § 7 —«¿tengo que pagar algo?»— y se deriva de `condicion`
   * en un solo lugar a propósito: con el mapa escrito también del lado del
   * navegador serían dos derivaciones de la misma idea, y la que se quedara
   * vieja dejaría una condición nueva fuera de los tres chips sin que nada
   * falle (la clase de B-88). `''` cuando la condición no se pudo clasificar.
   */
  costo: ClaseDeCosto | '';
  /**
   * **La frase entera, nunca el número** — B-837, D-570.
   *
   * «$25.000 por hora · cargado el 24 de septiembre de 2026», o `''`. Que sea un
   * string es lo que hace que las reglas del § 5 del PRD se cumplan por
   * construcción: no se puede mostrar sin la fecha, no se puede filtrar y no se
   * puede ordenar. El filtro de costo son las tres clases de arriba.
   */
  precio: string;
  condicionNotas: string;
  instagram: string | null;
  /** Solo dígitos: de acá sale un `wa.me/<digitos>`. */
  whatsapp: string | null;
  mail: string | null;
  /** Acepta `http://`: es una página institucional, no un destino de cobro. */
  web: string | null;
  /**
   * El índice de búsqueda del §6, normalizado.
   *
   * ⚠️ **Se DERIVA acá y no se copia del documento**, y esa es la única forma en
   * que la ausencia de la dirección es una propiedad y no una promesa: el campo
   * del documento lo escribe el cliente. Ver `searchTextDeLugar`.
   */
  searchText: string;
}

/**
 * **El índice de búsqueda de un lugar, derivado de los campos que sí se
 * publican** — §6, y el hallazgo del `auditor-privacidad` sobre esta tajada.
 *
 * ── Por qué no se copia el del documento ──────────────────────────────────
 * Porque `searchText` **se publica** —viaja en `/lugares.json` para que el
 * listado filtre en memoria (§2.5)— y en el documento es un campo que escribe el
 * cliente. Que no lleve la dirección lo sostenía `formALugar`, cuyo propio
 * docblock dice que **no es la defensa**: se saltea con un `curl`. Hoy eso es
 * inalcanzable porque el `create` exige `esAdmin()`, pero el día que B-872 abra
 * la puerta, un alta anónima podría mandar el `searchText` con la dirección
 * adentro y quedaría publicada **con el flag apagado y sin forma de bajarla** —el
 * índice se deriva al escribir, así que apagar la casilla no la saca—. Es el § 6
 * por la única puerta que ningún flag gatea.
 *
 * Con la derivación acá, el campo del documento deja de ser publicable: lo que
 * sale se arma con los valores **ya proyectados**, o sea con la dirección
 * afuera por construcción. `formALugar` importa esta misma función para escribir
 * el documento, así que sigue habiendo **una sola** derivación (la clase de
 * B-88) y el buscador del panel y el del sitio dicen lo mismo.
 *
 * ⚠️ **Y no lleva el precio**, por lo mismo que en una suscripción: el buscador
 * del listado **es** un filtro, y filtrar por precio afirma que los precios son
 * comparables.
 */
export const searchTextDeLugar = (c: {
  nombre: string;
  descripcion: string;
  barrio: string;
  ciudad: string;
  capacidadNotas: string;
  condicionNotas: string;
  incluyeOtro: string;
}): string =>
  normalize(
    [c.nombre, c.descripcion, c.barrio, c.ciudad, c.capacidadNotas, c.condicionNotas, c.incluyeOtro]
      .join(' '),
  ).trim();

/**
 * **¿La dirección de este lugar sale, y cuál?** — el predicado, exportado, y la
 * cuarta instancia del par flag + dato (`lib/paresFlagDato.ts`, B-911).
 *
 * ── Por qué es UNA función para los dos campos ───────────────────────────
 * Porque `geo` sin `direccion` **sigue poniendo la casa en un mapa** (§ 6, el
 * segundo agravante: «el "más o menos por Villa Crespo" deja de ser más o
 * menos»). Con dos predicados, el segundo llamador se acuerda del primero y no
 * del otro, que es exactamente cómo se rompen los pares. Con uno, no hay dónde
 * olvidarse.
 *
 * ── Por qué se exporta ───────────────────────────────────────────────────
 * Por la lección de `linkDeReunionQueSale` (B-819): cuando aparece un segundo
 * lector —una guarda del historial, un chequeo— tiene que usar **este** mismo
 * predicado y no uno parecido. Hoy `/lugares` no tiene subcolección
 * `/versiones`, así que ese segundo lector todavía no existe; el predicado está
 * exportado igual para que el día que exista no haya ninguna tentación de
 * escribir «`l.direccionPublica === true`» en otro archivo.
 *
 * ── Falla cerrada ────────────────────────────────────────────────────────
 * `!== true` y no un truthy: un documento viejo, uno restaurado o uno escrito
 * por un script pueden traer el campo ausente, y ausente tiene que querer decir
 * «no publicar». El default que preserva lo anterior acá es el **restrictivo**,
 * al revés que en el resto del repo, y es deliberado: lo que está en juego es
 * la dirección de la casa de alguien.
 */
export const dondeQueSale = (l: {
  direccionPublica?: boolean;
  direccion?: string | null;
  geo?: GeoDeLugar | null;
}): { direccion: string; geo: GeoDeLugar | null } => {
  if (l.direccionPublica !== true) return { direccion: '', geo: null };
  const geo = l.geo;
  return {
    direccion: (l.direccion ?? '').trim(),
    geo:
      geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)
        ? { lat: geo.lat, lng: geo.lng }
        : null,
  };
};

/**
 * En qué clase de costo cae cada condición — el filtro 2 del § 7.
 *
 * «El filtro que la gente quiere no es "hasta $X": es "¿tengo que pagar algo?".
 * Tres opciones —**sin costo** (`gratis`, `canje-por-difusion`), **consumiendo**
 * (`con-consumicion`), **pagando** (los tres de alquiler y `a-convenir`)— y
 * listo.» Es literalmente el § 5 del PRD hecho tabla.
 *
 * Es una segunda derivación del vocabulario de `/opciones/condicion-de-uso` (la
 * clase de B-88) y por eso está atada: `tests/lugar-publico.test.ts` exige que
 * todo slug `fijo: true` de ese vocabulario en `opciones-base.json` tenga su
 * clase acá. Una condición creada con «Otro» no está en el mapa y cae en `''`:
 * la ficha la muestra igual —la condición se muestra siempre, criterio 7— pero
 * queda fuera de los tres chips, que es mejor que meterla en el que no es.
 */
export const CLASE_DE_COSTO: Record<string, ClaseDeCosto> = {
  gratis: 'sin-costo',
  'canje-por-difusion': 'sin-costo',
  'con-consumicion': 'consumiendo',
  'alquiler-por-hora': 'pagando',
  'alquiler-por-evento': 'pagando',
  'porcentaje-de-la-recaudacion': 'pagando',
  'a-convenir': 'pagando',
};

/** Cómo se lee cada clase en el chip. El vocabulario del § 5 en castellano. */
export const TEXTO_DE_COSTO: Record<ClaseDeCosto, string> = {
  'sin-costo': 'Sin costo',
  consumiendo: 'Consumiendo',
  pagando: 'Pagando',
};

/** La clase de costo de una condición, o `''` si no se sabe. */
export const claseDeCosto = (condicion: string): ClaseDeCosto | '' =>
  CLASE_DE_COSTO[condicion] ?? '';

/**
 * Cómo se dice cada unidad **dentro de la frase del precio**.
 *
 * Cubre las cuatro de `UNIDADES_DE_PRECIO_LUGAR`, que es un vocabulario
 * **cerrado en el código** y no una taxonomía abierta — por eso acá no existe el
 * caso «una unidad que no sabemos nombrar» que sí existe en el precio de una
 * suscripción. El tipo lo garantiza y `tests/lugar-publico.test.ts` lo fija.
 */
export const TEXTO_POR_UNIDAD: Record<string, string> = {
  hora: 'por hora',
  jornada: 'por jornada',
  evento: 'por evento',
  persona: 'por persona',
};

/**
 * La frase del precio, o vacío — **la única salida del monto**.
 *
 * Dos cosas tienen que estar para que se publique, y si falta una no sale nada:
 *
 * 1. **el monto**, entero y positivo;
 * 2. **la fecha de carga usable**, que es lo que impone `fraseConFecha` (B-837):
 *    el dato huérfano desaparece en vez de salir solo.
 *
 * La tercera que sí tiene el precio de una suscripción —«el período nombrable»—
 * acá no puede fallar: la unidad es un vocabulario cerrado. Se chequea igual,
 * porque el documento puede venir de un `curl` con cualquier cosa adentro.
 *
 * El separador es el `·` del sitio (`tarjetaPublica.ts`), puesto por
 * `fraseConFecha`; el formateo del monto es `es-AR`, o sea `$25.000`.
 */
export const fraseDePrecioDeLugar = (
  precio: DatoConFecha<PrecioDeLugar> | null | undefined,
): string =>
  fraseConFecha(precio, (v) => {
    const unidad = TEXTO_POR_UNIDAD[v.porUnidad];
    if (!unidad) return '';
    if (!Number.isFinite(v.monto) || v.monto <= 0) return '';
    return `$${Math.round(v.monto).toLocaleString('es-AR')} ${unidad}`;
  });

/** `8–15 dígitos`, el mismo rango que la regla y el schema. */
const whatsappPublicable = (valor: string | null | undefined): string | null => {
  const digitos = (valor ?? '').replace(/\D/g, '');
  return digitos.length >= MIN_WHATSAPP_LUGAR && digitos.length <= TOPE_WHATSAPP_LUGAR
    ? digitos
    : null;
};

/** Lo mínimo para poner un `mailto:` sin publicar un link roto. */
const mailPublicable = (valor: string | null | undefined): string | null => {
  const mail = (valor ?? '').trim();
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(mail) ? mail : null;
};

/**
 * ¿Este valor es un slug de vocabulario?
 *
 * **Se contesta con `slugify` y no con un regex propio**, que es lo mismo que
 * hace `slugDeFicha`: el productor correcto de estos valores es el `slugify` del
 * §4.2, y dos definiciones de «qué es un slug» se separan sin que nada falle (la
 * clase de B-88). Lo que no pasa **se descarta**.
 */
const esSlugDeVocabulario = (valor: unknown): valor is string =>
  typeof valor === 'string' &&
  valor.length > 0 &&
  valor.length <= TOPE_SLUG_TAXONOMIA_LUGAR &&
  slugify(valor) === valor;

/** Los slugs sanos de una lista, sin repetidos y hasta el tope de la regla. */
const slugsPublicables = (valores: readonly string[] | undefined, tope: number): string[] => [
  ...new Set((valores ?? []).filter(esSlugDeVocabulario)),
].slice(0, tope);

/**
 * Las imágenes que se pueden publicar, **con la portada primera**.
 *
 * `imagenesPublicables` y no un `urlSegura` escrito acá: es la misma pregunta
 * que ya contestan el panel, la página de detalle y las fichas de los otros dos
 * directorios, y cinco respuestas escritas a mano se separan sin que nada falle
 * (B-854). La portada se busca **después** de filtrar, para que una portada con
 * la URL rota no deje la ficha sin imagen habiendo otras sanas.
 */
const imagenesDeLugar = (l: Lugar): ImagenDeLugarPublica[] => {
  const sanas = imagenesPublicables(l.imagenes ?? []);
  const portada = portadaDe(sanas);
  const ordenadas = portada ? [portada, ...sanas.filter((i) => i !== portada)] : sanas;
  return ordenadas.map((i) => ({
    url: urlSegura(i.url)!,
    epigrafe: i.epigrafe ?? '',
    ancho: i.ancho ?? null,
    alto: i.alto ?? null,
  }));
};

/**
 * Documento → ficha pública. **Campo por campo, sin un solo spread.**
 *
 * No recibe el id del documento y eso es deliberado: la ficha se direcciona por
 * `slug` (trampa 10) y el id de Firestore no tiene ningún consumidor público.
 */
export const lugarPublico = (l: Lugar): LugarPublico => {
  const condicion = esSlugDeVocabulario(l.condicion) ? l.condicion : '';
  const donde = dondeQueSale(l);
  const capacidad =
    typeof l.capacidad === 'number' && Number.isFinite(l.capacidad)
      ? Math.trunc(l.capacidad)
      : null;

  return {
    slug: l.slug,
    nombre: l.nombre,
    descripcion: l.descripcion ?? '',
    imagenes: imagenesDeLugar(l),
    tipo: esSlugDeVocabulario(l.tipo) ? l.tipo : '',
    // ⚠️ § 6 — la dirección y la `geo` salen por acá y por ningún otro lado.
    donde: {
      direccion: donde.direccion,
      barrio: esSlugDeVocabulario(l.barrio) ? l.barrio : '',
      ciudad: (l.ciudad ?? '').trim(),
      geo: donde.geo,
    },
    capacidad: capacidad !== null && capacidad > 0 && capacidad <= MAX_CAPACIDAD_LUGAR ? capacidad : null,
    capacidadNotas: l.capacidadNotas ?? '',
    incluye: slugsPublicables(l.incluye, MAX_INCLUYE_LUGAR),
    incluyeOtro: l.incluyeOtro ?? '',
    condicion,
    costo: claseDeCosto(condicion),
    // B-837 / D-570 — la frase, nunca el número. Ver `fraseDePrecioDeLugar`.
    precio: fraseDePrecioDeLugar(l.precio),
    condicionNotas: l.condicionNotas ?? '',
    instagram: handleInstagram(l.instagram),
    whatsapp: whatsappPublicable(l.whatsapp),
    mail: mailPublicable(l.mail),
    web: urlSegura(l.web),
    /*
     * ⚠️ **Derivado, no copiado.** `l.searchText` no se lee: lo que sale se arma
     * con los valores ya proyectados —o sea con la dirección afuera por
     * construcción—. Ver `searchTextDeLugar`.
     */
    searchText: searchTextDeLugar({
      nombre: l.nombre ?? '',
      descripcion: l.descripcion ?? '',
      barrio: esSlugDeVocabulario(l.barrio) ? l.barrio : '',
      ciudad: (l.ciudad ?? '').trim(),
      capacidadNotas: l.capacidadNotas ?? '',
      condicionNotas: l.condicionNotas ?? '',
      incluyeOtro: l.incluyeOtro ?? '',
    }),
  };
};

// ─────────────────────────────────────────────────────────────────
// El índice: `/lugares.json`
// ─────────────────────────────────────────────────────────────────

/**
 * Los rangos del filtro de capacidad — **filtro 1 del § 7, y el primero por
 * utilidad real**.
 *
 * «"Somos 20" es la primera pregunta. En **rangos** (hasta 10 · 10-25 · 25-50 ·
 * más de 50), no un input numérico: los rangos toleran que la capacidad esté
 * aproximada, un input no.»
 *
 * Viven acá y no en la island por lo mismo que `CLASE_DE_COSTO`: es la única
 * derivación de «en qué rango cae este lugar», y la usan el chip y el filtro.
 * Los bordes se solapan a propósito —un lugar de 25 entra en «10 a 25» y en «25
 * a 50»— porque una capacidad aproximada no tiene un borde exacto, y dejar un
 * lugar afuera de los dos rangos vecinos es peor que mostrarlo en los dos.
 */
export const RANGOS_DE_CAPACIDAD = [
  { id: 'hasta-10', label: 'Hasta 10', min: 0, max: 10 },
  { id: '10-25', label: '10 a 25', min: 10, max: 25 },
  { id: '25-50', label: '25 a 50', min: 25, max: 50 },
  { id: 'mas-de-50', label: 'Más de 50', min: 50, max: Number.POSITIVE_INFINITY },
] as const;
export type IdRangoDeCapacidad = (typeof RANGOS_DE_CAPACIDAD)[number]['id'];

/**
 * ¿Este lugar entra en ese rango?
 *
 * Un lugar **sin capacidad cargada no entra en ninguno**, y es la decisión
 * correcta del § 9: «la capacidad es un dato que quien carga no sabe». Meterlo
 * en todos afirmaría que entran 50 personas sin que nadie lo haya dicho; sin
 * filtro de capacidad se sigue viendo en la lista completa.
 */
export const entraEnElRango = (capacidad: number | null, id: string): boolean => {
  const rango = RANGOS_DE_CAPACIDAD.find((r) => r.id === id);
  if (!rango || capacidad === null) return false;
  return capacidad >= rango.min && capacidad <= rango.max;
};

/**
 * Los tres ejes de filtro **con vocabulario** del § 7, en el orden en que el PRD
 * los pone: barrio, qué incluye, tipo de lugar.
 *
 * Los otros dos filtros del § 7 no están acá porque no salen de una taxonomía:
 * la **capacidad** son los rangos de arriba y el **costo** son las tres clases
 * del § 5. Los dos los arma la island sin consultar ningún vocabulario.
 *
 * Que sean **estos tres** lo fija `tests/lugar-publico.test.ts`.
 */
export const EJES_DE_LUGAR = ['barrio', 'incluye-lugar', 'tipo-lugar'] as const;
export type EjeDeLugar = (typeof EJES_DE_LUGAR)[number];

/**
 * El artefacto que baja el listado — § 7 del PRD.
 *
 * **Propio y no adentro de `events.json`**, por lo mismo que los otros dos: aquél
 * lo baja **toda** persona que abre la agenda, y sumarle un catálogo que el 90%
 * no va a mirar le cobra el peso a la mayoría.
 *
 * `filtros` viaja adentro por lo mismo que las opciones viajan en el
 * `events.json` (§4.4): los chips se arman recorriéndolo, así que una etiqueta
 * renombrada aparece sola y nada queda hardcodeado en la island.
 */
export interface IndiceDeLugares {
  generadoEn: string;
  version: string;
  /** Solo los valores **con algún lugar publicado detrás**: un chip vacío es ruido. */
  filtros: Record<EjeDeLugar, OpcionPublica[]>;
  lugares: LugarPublico[];
}

/** De qué campo de la ficha sale cada eje. Un solo lugar, y de él salen el recorte y los chips. */
const VALORES_DEL_EJE: Record<EjeDeLugar, (l: LugarPublico) => string[]> = {
  barrio: (l) => (l.donde.barrio ? [l.donde.barrio] : []),
  'incluye-lugar': (l) => l.incluye,
  'tipo-lugar': (l) => (l.tipo ? [l.tipo] : []),
};

/**
 * Arma el índice.
 *
 * Los vocabularios se recortan a los valores que alguna ficha usa —y no la
 * taxonomía entera— por lo mismo que en los otros dos directorios: cada chip sin
 * fichas detrás es una promesa de cero resultados.
 *
 * El orden lo decide la taxonomía (`opcionesPublicas` respeta el de `/opciones`),
 * no este módulo: es el mismo orden que el desplegable del panel.
 */
export const construirIndiceDeLugares = ({
  lugares,
  vocabularios,
  version,
  generadoEn,
}: {
  lugares: readonly LugarPublico[];
  vocabularios: Partial<Record<EjeDeLugar, readonly ValorOpcion[]>>;
  version: string;
  generadoEn: string;
}): IndiceDeLugares => {
  const filtros = Object.fromEntries(
    EJES_DE_LUGAR.map((eje) => {
      const usados = new Set(lugares.flatMap((l) => VALORES_DEL_EJE[eje](l)));
      return [eje, opcionesPublicas([...(vocabularios[eje] ?? [])]).filter((v) => usados.has(v.slug))];
    }),
  ) as Record<EjeDeLugar, OpcionPublica[]>;

  return {
    generadoEn,
    version,
    lugares: [...lugares].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    filtros,
  };
};

// ─────────────────────────────────────────────────────────────────
// La ficha: `/guia/lugares/{slug}`
// ─────────────────────────────────────────────────────────────────

/**
 * Lo que la página de un lugar necesita, y **nada más** — el view-model de
 * D-140.
 *
 * La plantilla `.astro` no ve el documento ni la proyección cruda: recibe esto,
 * con los `href` ya armados y las etiquetas ya resueltas. Es lo que hace que la
 * salida sea barrible desde un test (un `.astro` no se importa desde vitest), y
 * acá tiene una segunda consecuencia que en las otras dos fichas no: **la
 * plantilla no puede publicar la dirección de una casa ni queriendo**, porque no
 * la recibe.
 */
export interface FichaDeLugar {
  slug: string;
  nombre: string;
  descripcion: string;
  imagenes: ImagenDeLugarPublica[];
  /** La etiqueta del tipo ya resuelta: la página no ve la taxonomía. */
  tipo: string;
  /** ⚠️ `direccion` y `geo` ya gateados por el flag. Ver `dondeQueSale`. */
  donde: {
    direccion: string;
    /** La etiqueta del barrio ya resuelta. */
    barrio: string;
    /**
     * A dónde lleva el barrio, o `null`.
     *
     * **Solo si el hub existe de verdad**, mismo criterio que en la ficha de una
     * librería: `/barrio/{slug}` lo emite el build para los barrios que tienen
     * alguna actividad, así que linkear a ciegas publicaría un 404.
     */
    rutaDelBarrio: string | null;
    ciudad: string;
    geo: GeoDeLugar | null;
  };
  capacidad: number | null;
  capacidadNotas: string;
  /** Etiquetas, no slugs. */
  incluye: string[];
  incluyeOtro: string;
  /** La etiqueta de la condición, ya resuelta. Se muestra siempre (criterio 7). */
  condicion: string;
  /** B-837 — la frase con su fecha, o `''`. Nunca un número. */
  precio: string;
  condicionNotas: string;
  /** Los cuatro contactos, ya como destino. `null` es «no hay por dónde». */
  enlaces: {
    instagram: string | null;
    whatsapp: string | null;
    mail: string | null;
    web: string | null;
  };
  /** La ruta relativa, en la forma que contesta 200 (B-330). */
  ruta: string;
  /** La absoluta: el `url` del JSON-LD. La canónica y el OG los pone `Base.astro`. */
  url: string;
}

/** Cómo se resuelve la etiqueta de un slug. La pasa quien leyó `/opciones/*`. */
export interface EtiquetasDeLugar {
  /** `(campo, slug) => etiqueta`. Sin respuesta, se muestra el slug. */
  etiqueta?: (campo: string, slug: string) => string | undefined;
  /** A dónde lleva el barrio, si su hub existe. */
  rutaDelBarrio?: string | null;
}

const etiquetaDe = (e: EtiquetasDeLugar, campo: string, slug: string): string =>
  slug ? (e.etiqueta?.(campo, slug) ?? slug) : '';

/**
 * Proyección → ficha. Acá se arman los `href` y se resuelven las etiquetas;
 * **no se agrega ningún campo del documento** que la proyección no haya dejado
 * pasar, que es lo que mantiene la whitelist en un solo lugar.
 */
export const fichaDeLugar = (l: LugarPublico, e: EtiquetasDeLugar = {}): FichaDeLugar => ({
  slug: l.slug,
  nombre: l.nombre,
  descripcion: l.descripcion,
  imagenes: l.imagenes,
  tipo: etiquetaDe(e, 'tipo-lugar', l.tipo),
  donde: {
    // La dirección **ya viene gateada** de la proyección: acá no se vuelve a
    // decidir nada, que es lo que mantiene el par en un solo lugar.
    direccion: l.donde.direccion,
    barrio: etiquetaDe(e, 'barrio', l.donde.barrio),
    rutaDelBarrio: e.rutaDelBarrio ?? null,
    ciudad: l.donde.ciudad,
    geo: l.donde.geo,
  },
  capacidad: l.capacidad,
  capacidadNotas: l.capacidadNotas,
  incluye: l.incluye.map((slug) => etiquetaDe(e, 'incluye-lugar', slug)),
  incluyeOtro: l.incluyeOtro,
  condicion: etiquetaDe(e, 'condicion-de-uso', l.condicion),
  precio: l.precio,
  condicionNotas: l.condicionNotas,
  enlaces: {
    instagram: l.instagram ? `https://instagram.com/${l.instagram}` : null,
    whatsapp: l.whatsapp ? `https://wa.me/${l.whatsapp}` : null,
    mail: l.mail ? `mailto:${l.mail}` : null,
    web: l.web,
  },
  ruta: rutaDeLugar(l.slug),
  url: urlAbsoluta(rutaDeLugar(l.slug)),
});

/**
 * La `meta description` de la ficha.
 *
 * ── Por qué vive acá y no en la plantilla ────────────────────────────────
 * Es la lección de `descripcionDelMes` (salida 8), `descripcionDeLibreria` y
 * `descripcionDeSuscripcion`: una frase armada interpolando campos **dentro de
 * un `.astro`** es un productor de texto público que vitest no puede importar,
 * así que no se puede barrer. Acá es pura y pasa el mismo barrido de centinelas
 * que la proyección.
 *
 * ⚠️ **Sin la dirección y sin el precio**, y las dos ausencias son decisiones:
 *
 * - la dirección, porque la `meta description` es lo que Google muestra en el
 *   resultado —o sea el lugar donde el dato queda cosechable sin que nadie abra
 *   la página— y porque este productor recibe la ficha, que para una casa ya
 *   viene con `direccion: ''`. No alcanza con eso: si mañana el respaldo la
 *   interpolara, una ficha de café la publicaría y una de casa no, y esa
 *   asimetría se lee como un bug y se «arregla» publicándola siempre. Mejor que
 *   no esté;
 * - el precio, por la misma razón que en una suscripción: es el lugar de más
 *   visibilidad y el que más tarda en refrescarse, y un número de tres meses ahí
 *   se publica equivocado (B-837).
 *
 * La descripción cargada gana cuando existe: la escribió quien conoce el lugar.
 * El respaldo es la ficha mínima —qué es, en qué barrio y para cuántos— y no una
 * frase de relleno: una `meta description` vacía la inventa Google con el primer
 * párrafo que encuentre.
 */
export const descripcionDeLugar = (f: FichaDeLugar): string => {
  if (f.descripcion) return f.descripcion;
  const que = f.tipo ? f.tipo.toLowerCase() : 'lugar';
  const donde = f.donde.barrio ? ` en ${f.donde.barrio}` : '';
  const cuantos = f.capacidad ? `, hasta ${f.capacidad} personas` : '';
  return `${f.nombre}: ${que}${donde} para hacer una actividad literaria${cuantos}.`;
};

/**
 * La `meta description` del listado.
 *
 * Vive al lado de la anterior por lo mismo que en los otros dos directorios: son
 * las dos frases de la misma salida, y separarlas dejaría la mitad barrida y la
 * mitad no.
 *
 * El número sale de los datos y es lo único: cuántos lugares hay no es de nadie.
 */
export const descripcionDelDirectorioDeLugares = (cuantos: number): string =>
  cuantos === 0
    ? 'Lugares para hacer una actividad literaria en Argentina: cafés, librerías y espacios que ' +
      'prestan o alquilan su salón.'
    : `${cuantos} ${cuantos === 1 ? 'lugar' : 'lugares'} para hacer una actividad literaria: ` +
      'para cuántas personas, qué incluye cada uno y en qué condiciones se usa.';

/**
 * **`Place`, y la `address` solo si `direccionPublica`** — § 7 del PRD.
 *
 * ── Por qué `Place` y no `LocalBusiness`/`BookStore` ────────────────────
 * Es la misma pregunta que D-670 contestó para una suscripción, con la respuesta
 * del otro lado. `LocalBusiness` **exige `address`**: es un negocio con puerta, y
 * Google lo usa para el panel local y el mapa. Acá la mitad del directorio sí
 * tiene puerta —un café, una librería— pero **la otra mitad es una casa cuya
 * dirección decidimos no publicar** (§ 6), y un `LocalBusiness` sin `address` es
 * un local que no existe. Además declararía como comercio a un lugar que presta
 * el salón sin cobrar, que es la mitad de este directorio.
 *
 * ── Por qué `Place` y no `EventVenue` ───────────────────────────────────
 * `EventVenue` es subtipo de `Place` y suena más preciso, y por eso mismo afirma
 * de más: dice que el lugar **es** un salón de eventos. Un café que presta la
 * mesa del fondo los martes no lo es, y el § 9 del PRD nombra ese deslizamiento
 * como el contra de esta sección entera —«puede convertirse en una inmobiliaria
 * de salones, que no es lo que el proyecto es»—. El marcado es el lugar donde esa
 * afirmación queda escrita para una máquina, así que se elige el tipo que dice lo
 * que sabemos: es un **lugar**. `EventVenue` además no tiene ninguna propiedad
 * propia ni resultado enriquecido que ganar.
 *
 * ── Las tres propiedades que sí valen ───────────────────────────────────
 * `maximumAttendeeCapacity` (para cuántos), `amenityFeature` como
 * `LocationFeatureSpecification` (qué incluye) y `address` **solo si la
 * dirección salió de la proyección**. Es el criterio 5 del PRD y el caso que más
 * fácil se filtra: «nadie lee el JSON-LD al revisar una ficha».
 *
 * ── Y lo que NO va, con su motivo ───────────────────────────────────────
 * **Sin `priceRange`** — § 7 del PRD con todas las letras: «la condición no es un
 * rango de precios». Y sin el precio en ninguna otra forma, por lo mismo que el
 * `Offer` de una suscripción (§ 5 del PRD 3): un número que envejece publicado
 * como dato estructurado es información equivocada en el lugar de más
 * visibilidad. En la página va, con su fecha al lado.
 */
export const datosEstructuradosDeLugar = (f: FichaDeLugar): Record<string, unknown> => {
  const sameAs = [f.enlaces.instagram, f.enlaces.web].filter((u): u is string => u !== null);
  const incluye = f.incluye.filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: f.nombre,
    url: f.url,
    ...(f.descripcion ? { description: f.descripcion } : {}),
    /*
     * ⚠️ **§ 6, criterio 5.** Sin dirección publicada no hay `address` —ni
     * siquiera una con la localidad sola—: la ausencia tiene que ser total, que
     * es lo que el PRD pide y lo que hace que el test sea inequívoco. Y sin
     * `geo` por lo mismo: unas coordenadas son la dirección con otro formato.
     */
    ...(f.donde.direccion
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: f.donde.direccion,
            ...(f.donde.ciudad ? { addressLocality: f.donde.ciudad } : {}),
            addressCountry: 'AR',
          },
        }
      : {}),
    ...(f.donde.direccion && f.donde.geo
      ? { geo: { '@type': 'GeoCoordinates', latitude: f.donde.geo.lat, longitude: f.donde.geo.lng } }
      : {}),
    ...(f.capacidad ? { maximumAttendeeCapacity: f.capacidad } : {}),
    ...(incluye.length > 0
      ? {
          amenityFeature: incluye.map((nombre) => ({
            '@type': 'LocationFeatureSpecification',
            name: nombre,
            value: true,
          })),
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs: [...new Set(sameAs)] } : {}),
    ...(f.imagenes.length > 0 ? { image: f.imagenes.map((i) => i.url) } : {}),
  };
};

/**
 * Las migas de la ficha: agenda → Guía → Lugares → éste.
 *
 * Misma forma que `migasDeLibreria` y `migasDeSuscripcion`: los tres ancestros
 * existen siempre, así que las posiciones son fijas.
 */
export const migasDeLugar = (f: FichaDeLugar): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: NOMBRE, item: urlAbsoluta(RUTA_AGENDA) },
    { '@type': 'ListItem', position: 2, name: 'Guía', item: urlAbsoluta(RUTA_GUIA) },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Lugares para eventos',
      item: urlAbsoluta(RUTA_LUGARES),
    },
    { '@type': 'ListItem', position: 4, name: f.nombre, item: f.url },
  ],
});

/**
 * `CollectionPage` + `ItemList` para el listado, con la misma forma que
 * `coleccionDeLibrerias` y `coleccionDeSuscripciones`.
 *
 * No se reusa ninguna de aquéllas porque arman los `item` con el constructor de
 * **su** ruta: pasarle lugares publicaría `/guia/librerias/{slug}` para cada uno,
 * o sea un `ItemList` de URLs que dan 404. Es la misma razón por la que la
 * proyección no se generaliza.
 */
export const coleccionDeLugares = (
  /*
   * Pide **solo lo que usa** —slug y nombre— y no un `LugarPublico` entero: un
   * `ItemList` publica exactamente esos dos campos, así que pedir el objeto
   * completo dejaría a esta función con la proyección entera en la mano y el
   * próximo campo a un `${}` de distancia.
   */
  lugares: readonly { slug: string; nombre: string }[],
): Record<string, unknown> | null => {
  if (lugares.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Lugares para hacer eventos',
    url: urlAbsoluta(RUTA_LUGARES),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: lugares.map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: urlAbsoluta(rutaDeLugar(l.slug)),
        name: l.nombre,
      })),
    },
  };
};
