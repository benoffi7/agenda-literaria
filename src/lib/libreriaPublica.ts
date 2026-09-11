/**
 * **La proyección pública de una librería** — B-831, tajada 2 paso 14.
 *
 * ── Es una whitelist, y ahí está toda la seguridad de esto ────────────────
 * §5.2 del `CLAUDE.md`, y el recuadro del § 1.2 del inventario de los PRDs:
 *
 * > «`toPublic` por entidad, no genérico. La proyección es una **whitelist** y
 * > ahí está toda la seguridad de esto: un `pick` con la lista escrita a mano.
 * > Un `toPublic` genérico que proyecte "todo menos lo prohibido" invierte el
 * > default y el primer campo nuevo sale solo. **No hacerlo.**»
 *
 * Así que acá no hay un solo spread sobre el documento. Cada campo que sale está
 * escrito con su nombre, y el campo que mañana se agregue a `Libreria` **no
 * sale** hasta que alguien venga a escribirlo acá. Ese es el default correcto.
 *
 * ── El campo que no sale nunca ────────────────────────────────────────────
 * `contactoDeQuienCargo` es el **segundo dato personal de un tercero** que el
 * proyecto guarda, después del `contacto` de una propuesta, y vive en el mismo
 * documento que los cuatro contactos **públicos** de la librería
 * (`instagram`, `whatsapp`, `web`, `mail`). Que convivan es exactamente la
 * condición donde una proyección por spread filtra un campo (§ 8 del PRD), y por
 * eso además de la whitelist hay un centinela. **Vive en
 * `tests/libreria-publica.test.ts`, no en `tests/barrido-de-salidas-publicas.test.ts`**:
 * aquél recorre las rutas de una **actividad** (`RUTAS_CENTINELA`), que es otra
 * colección con otro fixture, y decirlo mal manda al que grepee «librería» en el
 * barrido canónico a concluir que no la cubre nadie. El fixture es
 * `tests/fixtures/centinelas-libreria.ts` y el control negativo codificado es el
 * de B-212: se mete el spread y se exige que falle nombrando el campo.
 *
 * Tampoco salen `revision` (lleva el uid de quien revisó y el motivo del
 * descarte), `origen`, `estado`, `creadoEn` ni `publicadaAlgunaVez`: son el
 * ciclo de vida, no la ficha.
 *
 * ── Lo que se publica se publica **saneado** ──────────────────────────────
 * Los cuatro contactos terminan en un `href` de una página **indexada**, y las
 * URLs de las imágenes en un `src`. `firestore.rules` ya acota su forma, pero la
 * regla **no itera una lista** (B-842), así que las filas de `imagenes` llegan
 * sin validar fila por fila. Acá se pasa todo por los saneadores que el proyecto
 * ya tiene —`urlSegura`, `handleInstagram`— y lo que no pasa **se descarta**, que
 * es el criterio de `imagenesDeDetalle` y de `esSlugDeFicha`: nunca se emite algo
 * que no se pudo verificar.
 *
 * ── Puro, y por eso barrible ──────────────────────────────────────────────
 * Sin Firestore y sin navegador: lo importan el build (`contenidoDelSitio.ts`),
 * el endpoint del JSON, las dos páginas y los tests. La lectura —con su
 * `where('estado','==','publicado')`, que es la primera de las nueve cosas que se
 * rompen en silencio— vive en `contenidoDelSitio.ts`.
 */
import { urlSegura, handleInstagram } from '@/lib/enlaceSeguro';
import { imagenesPublicables, portadaDe } from '@/lib/imagenes';
import { NOMBRE } from '@/lib/identidad';
import {
  RUTA_AGENDA,
  RUTA_GUIA,
  RUTA_LIBRERIAS,
  rutaDeLibreria,
  urlAbsoluta,
} from '@/lib/rutasPublicas';
import { opcionesPublicas, type OpcionPublica } from '@/lib/toPublic';
import {
  MIN_WHATSAPP_LIBRERIA,
  TOPE_WHATSAPP_LIBRERIA,
  type Libreria,
} from '@/types/libreria';
import type { ValorOpcion } from '@/types/actividad';

/**
 * Una imagen de la ficha, **sin `storagePath`**.
 *
 * Es el mismo recorte que `ImagenPublica` de `toPublic.ts` le hace a la galería
 * de una actividad y por el mismo motivo: `storagePath` es el handle interno del
 * objeto en Storage, y publicarlo le da a cualquiera la ruta exacta de un bucket
 * cuyo `list` está cerrado a propósito (trampa 13).
 *
 * `id` tampoco sale: es el identificador de la fila en el editor del panel, y la
 * página no lo necesita para nada — la imagen se pinta por su URL.
 */
export interface ImagenDeLibreriaPublica {
  /** Ya saneada con `urlSegura`: lo que no era `http(s)` no llegó hasta acá. */
  url: string;
  epigrafe: string;
  ancho: number | null;
  alto: number | null;
}

/**
 * Lo que de una librería sale al sitio. **Whitelist: si no está acá, no sale.**
 *
 * Los cuatro contactos son `null` cuando la librería no los cargó **o cuando lo
 * cargado no se pudo sanear**, y las dos cosas se leen igual desde la página:
 * «no hay por dónde». Distinguirlas obligaría a publicar el valor crudo para que
 * el consumidor lo juzgue, que es justo lo que esta capa existe para evitar.
 */
export interface LibreriaPublica {
  /** El segmento de la URL. Inmutable después de publicar — trampa 10. */
  slug: string;
  nombre: string;
  /** `''` cuando no hay: un `<input>` vacío y un `null` significan lo mismo acá. */
  descripcion: string;
  direccion: string;
  /** El **mismo slug** de `/opciones/barrio` que usan las actividades (§ 2 del PRD). */
  barrio: string;
  ciudad: string;
  /**
   * Público sin discusión (§ 8 del PRD): es la ubicación de un **local
   * comercial**, no de una persona, y la sede de una actividad ya la publica.
   */
  geo: { lat: number; lng: number } | null;
  imagenes: ImagenDeLibreriaPublica[];
  /** Handle sin `@`, saneado con `handleInstagram`. */
  instagram: string | null;
  /** Solo dígitos: de acá sale un `wa.me/<digitos>`. */
  whatsapp: string | null;
  /** Con esquema `http(s)`, saneada con `urlSegura`. */
  web: string | null;
  mail: string | null;
  /**
   * El índice de búsqueda del §6, normalizado al escribir.
   *
   * Sale por lo mismo que el de una actividad: el listado filtra **en memoria**
   * (§2.5) y necesita contra qué comparar. No publica nada nuevo — se deriva de
   * nombre, descripción, dirección, barrio y ciudad, los cinco de esta misma
   * lista— y eso es lo que lo hace inocuo, no el hecho de estar normalizado.
   */
  searchText: string;
}

/** `8–15 dígitos`, el mismo rango que la regla y el schema. */
const whatsappPublicable = (valor: string | null): string | null => {
  const digitos = (valor ?? '').replace(/\D/g, '');
  return digitos.length >= MIN_WHATSAPP_LIBRERIA && digitos.length <= TOPE_WHATSAPP_LIBRERIA
    ? digitos
    : null;
};

/** Lo mínimo para poner un `mailto:` sin publicar un link roto. */
const mailPublicable = (valor: string | null): string | null => {
  const mail = (valor ?? '').trim();
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(mail) ? mail : null;
};

/**
 * Las imágenes que se pueden publicar, **con la portada primera**.
 *
 * `imagenesPublicables` y no un `urlSegura` escrito acá: es la misma pregunta que
 * el panel hace con `faltaElFlyer` y que la página de detalle hace con
 * `imagenesDeDetalle`, y tres respuestas escritas a mano se separan sin que nada
 * falle (la clase de B-88, y es literalmente lo que B-854 cerró).
 *
 * La portada se busca **después** de filtrar, por lo mismo que allá: una portada
 * con la URL rota no puede dejar la ficha sin imagen habiendo otras sanas.
 */
const imagenesDeLibreria = (l: Libreria): ImagenDeLibreriaPublica[] => {
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
 * `toPublic` sí lo lleva porque el `events.json` lo usa como clave de los
 * favoritos del navegador; acá no hay nada equivalente.
 */
export const libreriaPublica = (l: Libreria): LibreriaPublica => ({
  slug: l.slug,
  nombre: l.nombre,
  descripcion: l.descripcion ?? '',
  direccion: l.direccion,
  barrio: l.barrio,
  ciudad: l.ciudad,
  geo: l.geo ? { lat: l.geo.lat, lng: l.geo.lng } : null,
  imagenes: imagenesDeLibreria(l),
  instagram: handleInstagram(l.instagram),
  whatsapp: whatsappPublicable(l.whatsapp),
  web: urlSegura(l.web),
  mail: mailPublicable(l.mail),
  searchText: l.searchText ?? '',
});

/**
 * La `meta description` de la ficha de una librería.
 *
 * ── Por qué vive acá y no en la plantilla ────────────────────────────────
 * Lo pidió el `auditor-privacidad`, y el argumento es el de `descripcionDelMes`
 * (salida 8): una frase armada interpolando campos **dentro de un `.astro`** es
 * un productor de texto público que vitest no puede importar, así que no se
 * puede barrer. Hoy los cuatro campos que usa son públicos y no filtra nada; lo
 * que cambia es qué pasa mañana, cuando alguien sume un campo al view-model y
 * esta línea lo publique normalizado en el `<head>` sin que nada se ponga rojo.
 *
 * Acá es puro, y `tests/libreria-publica.test.ts` la pasa por el mismo barrido de
 * centinelas que la proyección. La plantilla vuelve a «solo acomodar» (D-140).
 *
 * La descripción cargada gana cuando existe: la escribió quien conoce la
 * librería. El respaldo es la ficha mínima —qué es, dónde queda— y no una frase
 * de relleno: una `meta description` vacía la inventa Google con el primer
 * párrafo que encuentre.
 */
export const descripcionDeLibreria = (f: FichaDeLibreria): string =>
  f.descripcion ||
  `${f.nombre}: librería en ${f.barrio}, ${f.ciudad}. ${f.direccion}.`;

/**
 * La `meta description` del listado.
 *
 * Vive al lado de la anterior por lo mismo, aunque ésta **no interpole ningún
 * campo de ninguna ficha**: son las dos frases de la misma salida, y separarlas
 * dejaría la mitad barrida y la mitad no — que es cómo se pierde de vista cuál de
 * las dos toca un dato.
 *
 * El número sí sale de los datos, y es lo único: cuántas librerías hay no es de
 * nadie.
 */
export const descripcionDelDirectorio = (cuantas: number): string =>
  cuantas === 0
    ? 'Librerías de la Ciudad de Buenos Aires: dónde comprar libros, en qué barrio y cómo seguirlas.'
    : `${cuantas} ${cuantas === 1 ? 'librería' : 'librerías'} de la Ciudad de Buenos Aires: ` +
      'la dirección, el barrio y cómo seguirlas.';

// ─────────────────────────────────────────────────────────────────
// El índice: `/librerias.json`
// ─────────────────────────────────────────────────────────────────

/**
 * El artefacto que baja el listado — § 4 del PRD.
 *
 * **Propio y no adentro de `events.json`**, y el PRD lo argumenta: aquél lo baja
 * **toda** persona que abre la agenda, y sumarle un catálogo que el 90% no va a
 * mirar le cobra el peso a la mayoría. Es la misma lógica con la que el panel se
 * corta del bundle público (§9).
 *
 * `barrios` viaja adentro por lo mismo que las opciones viajan en el
 * `events.json` (§4.4): los chips de filtro se arman recorriéndolo, así que una
 * etiqueta renombrada aparece sola y nada queda hardcodeado en el island.
 */
export interface IndiceDeLibrerias {
  generadoEn: string;
  version: string;
  /** Solo los barrios **con alguna librería publicada**: un chip vacío es ruido. */
  barrios: OpcionPublica[];
  librerias: LibreriaPublica[];
}

/**
 * Arma el índice.
 *
 * Los barrios se recortan a los que alguna ficha usa —y no la taxonomía entera—
 * porque `/opciones/barrio` la comparten las actividades: sin el recorte, el
 * filtro del directorio ofrecería cuarenta barrios de los que treinta y cinco no
 * tienen ninguna librería, y cada uno de esos chips es una promesa de cero
 * resultados. Es el mismo criterio con el que un hub sin nada vigente no entra al
 * sitemap (B-108).
 *
 * El orden lo decide la taxonomía (`opcionesPublicas` respeta el de `/opciones`),
 * no este módulo: es el mismo orden que el desplegable del panel.
 */
export const construirIndiceDeLibrerias = ({
  librerias,
  barrios,
  version,
  generadoEn,
}: {
  librerias: readonly LibreriaPublica[];
  barrios: readonly ValorOpcion[];
  version: string;
  generadoEn: string;
}): IndiceDeLibrerias => {
  const usados = new Set(librerias.map((l) => l.barrio));
  return {
    generadoEn,
    version,
    barrios: opcionesPublicas([...barrios]).filter((b) => usados.has(b.slug)),
    librerias: [...librerias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  };
};

// ─────────────────────────────────────────────────────────────────
// La ficha: `/guia/librerias/{slug}`
// ─────────────────────────────────────────────────────────────────

/**
 * Todo lo que la página de una librería necesita, y **nada más** — el
 * view-model de D-140.
 *
 * La plantilla `.astro` no ve el documento ni la proyección cruda: recibe esto,
 * con los `href` ya armados. Es la misma frontera que `DetallePublico` le pone a
 * `actividad/[slug].astro`, y lo que hace que la salida sea barrible desde un
 * test (un `.astro` no se importa desde vitest).
 */
export interface FichaDeLibreria {
  slug: string;
  nombre: string;
  descripcion: string;
  direccion: string;
  /** La etiqueta del barrio ya resuelta: la página no ve la taxonomía. */
  barrio: string;
  /**
   * A dónde lleva el barrio, o `null`.
   *
   * **Solo si el hub existe de verdad.** `/barrio/{slug}` lo emite el build para
   * los barrios que tienen alguna actividad (`hubsPublicos.ts`), así que linkear
   * a ciegas publicaría un 404 en cada ficha de un barrio sin actividades — que
   * son justo los que este directorio va a estrenar. Lo decide quien arma la
   * ficha, que es el único que sabe qué hubs se emitieron.
   */
  rutaDelBarrio: string | null;
  ciudad: string;
  geo: { lat: number; lng: number } | null;
  imagenes: ImagenDeLibreriaPublica[];
  /** Los cuatro contactos, ya como destino. `null` es «no hay por dónde». */
  enlaces: {
    instagram: string | null;
    whatsapp: string | null;
    web: string | null;
    mail: string | null;
  };
  /** La ruta relativa, en la forma que contesta 200 (B-330). */
  ruta: string;
  /** La absoluta: el `url` del JSON-LD. La canónica y el OG los pone `Base.astro`. */
  url: string;
}

/**
 * Proyección → ficha. Acá se arman los `href` y se resuelve la etiqueta del
 * barrio; **no se agrega ningún campo del documento** que la proyección no haya
 * dejado pasar, que es lo que mantiene la whitelist en un solo lugar.
 */
export const fichaDeLibreria = (
  l: LibreriaPublica,
  {
    etiquetaDeBarrio,
    rutaDelBarrio = null,
  }: { etiquetaDeBarrio?: string; rutaDelBarrio?: string | null } = {},
): FichaDeLibreria => ({
  slug: l.slug,
  nombre: l.nombre,
  descripcion: l.descripcion,
  direccion: l.direccion,
  barrio: etiquetaDeBarrio ?? l.barrio,
  rutaDelBarrio,
  ciudad: l.ciudad,
  geo: l.geo,
  imagenes: l.imagenes,
  enlaces: {
    instagram: l.instagram ? `https://instagram.com/${l.instagram}` : null,
    whatsapp: l.whatsapp ? `https://wa.me/${l.whatsapp}` : null,
    web: l.web,
    mail: l.mail ? `mailto:${l.mail}` : null,
  },
  ruta: rutaDeLibreria(l.slug),
  url: urlAbsoluta(rutaDeLibreria(l.slug)),
});

/**
 * `BookStore` — § 4 del PRD, y es donde está el SEO de este directorio.
 *
 * Una ficha sin marcado estructurado es una página más; con `BookStore` —subtipo
 * de `LocalBusiness`— entra al panel local de Google. Es lo que `detallePublico.ts`
 * ya hace con `Event`, con otro tipo.
 *
 * **Sin `openingHours`, y es una decisión del PRD**: no se piden horarios (§ 7),
 * y un `openingHours` inventado es peor que ninguno — Google lo muestra como un
 * hecho y quien va se encuentra el local cerrado.
 *
 * `sameAs` lleva solo los perfiles que existen, `image` solo las imágenes que
 * sobrevivieron al saneo y `geo` solo si está: una clave con `null` adentro es un
 * dato mal declarado, y el validador de Google lo trata como error en vez de como
 * ausencia.
 */
export const datosEstructuradosDeLibreria = (f: FichaDeLibreria): Record<string, unknown> => {
  const sameAs = [f.enlaces.instagram, f.enlaces.web].filter((u): u is string => u !== null);
  return {
    '@context': 'https://schema.org',
    '@type': 'BookStore',
    name: f.nombre,
    url: f.url,
    ...(f.descripcion ? { description: f.descripcion } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: f.direccion,
      addressLocality: f.ciudad,
      addressCountry: 'AR',
    },
    ...(f.geo
      ? { geo: { '@type': 'GeoCoordinates', latitude: f.geo.lat, longitude: f.geo.lng } }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(f.imagenes.length > 0 ? { image: f.imagenes.map((i) => i.url) } : {}),
  };
};

/**
 * Las migas de la ficha: agenda → Guía → Librerías → esta librería.
 *
 * Misma forma que `migasDeDetalle`, con la diferencia de que acá los tres
 * ancestros **existen siempre** —no hay el condicional del hub de tipo—, así que
 * las posiciones son fijas.
 */
export const migasDeLibreria = (f: FichaDeLibreria): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: NOMBRE, item: urlAbsoluta(RUTA_AGENDA) },
    { '@type': 'ListItem', position: 2, name: 'Guía', item: urlAbsoluta(RUTA_GUIA) },
    { '@type': 'ListItem', position: 3, name: 'Librerías', item: urlAbsoluta(RUTA_LIBRERIAS) },
    { '@type': 'ListItem', position: 4, name: f.nombre, item: f.url },
  ],
});

/**
 * `CollectionPage` + `ItemList` para el listado, con la misma forma que
 * `coleccionSchema` le da a la home y a los hubs (§5.5 del diseño).
 *
 * No se reusa aquella función porque arma los `item` con `urlDeDetalle`, que es
 * la ruta de una **actividad**: pasarle librerías publicaría `/actividad/{slug}`
 * para cada una, o sea un `ItemList` de URLs que dan 404. Es la misma razón por
 * la que la proyección no se generaliza.
 *
 * `null` con la lista vacía, igual que allá: un `ItemList` sin elementos no
 * ayuda a entender la página.
 */
export const coleccionDeLibrerias = (
  librerias: readonly LibreriaPublica[],
): Record<string, unknown> | null => {
  if (librerias.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Librerías',
    url: urlAbsoluta(RUTA_LIBRERIAS),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: librerias.map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: urlAbsoluta(rutaDeLibreria(l.slug)),
        name: l.nombre,
      })),
    },
  };
};
