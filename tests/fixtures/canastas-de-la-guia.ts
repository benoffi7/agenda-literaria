/**
 * **Lo que cada salida de la Guía publica a propósito** — las listas de
 * excepciones de los cuatro barridos de vitest (librerías, suscripciones, lugares,
 * bibliotecas), con su motivo. B-1812.
 *
 * Vivían cada una en su test (`tests/libreria-publica.test.ts`,
 * `tests/suscripcion-publica.test.ts`, `tests/lugar-publico.test.ts`,
 * `tests/biblioteca-publica.test.ts`), y el gate del build tiene las suyas en
 * `scripts/gate-build/semilla.mjs` (`CENTINELA_DEL_DIRECTORIO`,
 * `CENTINELA_DE_SUSCRIPCIONES`, `CENTINELA_DE_LUGARES`,
 * `CENTINELA_DE_BIBLIOTECAS`). Las dos mitades se sincronizaban de memoria, que
 * es lo que B-1761 cerró para el detalle, el índice y la cartelera. Para que
 * `tests/barrido-de-salidas-publicas.test.ts` las pueda comparar tienen que
 * poder importarse, y por eso se mudaron acá **sin cambiar una entrada**.
 *
 * La lista **es** el chequeo: una entrada sin justificación es una fuga aprobada
 * por cansancio. Se escribe a mano, una por una.
 */
import type { RutaDeLibreria } from './centinelas-libreria';
import type { RutaDeSuscripcion } from './centinelas-suscripcion';
import type { RutaDeLugar } from './centinelas-lugar';
import type { RutaDeBiblioteca } from './centinelas-biblioteca';

export type Excepcion<R extends string> = {
  nombre: string;
  centinelas: readonly R[];
  porque: string;
};

// ───────────────────────────────────────────────────────────────────────────
// Librerías — barrido en `tests/libreria-publica.test.ts`.
// ───────────────────────────────────────────────────────────────────────────

export const PERMITIDO_EN_LA_PROYECCION_DE_LIBRERIAS: readonly Excepcion<RutaDeLibreria>[] = [
  {
    nombre: 'cuándo abre',
    // B-982 — pedido del dueño: «no tiene horario de atención».
    centinelas: ['horarios'],
    porque:
      'es el dato que más se busca después de la dirección: un directorio que dice dónde queda y ' +
      'no cuándo abre manda a la gente a la puerta cerrada. Es un **local comercial** (§ 8 del ' +
      'PRD), así que su horario no dice nada de nadie. **No entra al JSON-LD**: es texto libre y ' +
      '`schema.org/openingHours` quiere un formato fijo — publicarlo mal formado haría que Google ' +
      'muestre un horario equivocado, que es peor que no mostrarlo.',
  },
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10) y qué tiene ' +
      'la librería. Sin esto no hay página.',
  },
  {
    nombre: 'dónde queda',
    // B-967 — los tres de la geografía. La provincia sale por lo mismo que la
    // ciudad: es una etiqueta geográfica de un local comercial, no dice nada de
    // nadie, y es lo que distingue dos ciudades homónimas.
    centinelas: ['direccion', 'provincia', 'barrio', 'ciudad'],
    porque:
      'es un **local comercial**, no la casa de nadie (§ 8 del PRD). La dirección es el dato por ' +
      'el que alguien entra a la ficha, y el barrio es el mismo slug que usan las actividades — ' +
      'lo que deja cruzarlas en el hub.',
  },
  {
    nombre: 'los cuatro contactos públicos',
    centinelas: ['instagram', 'whatsapp', 'web', 'mail'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que la gente le escriba a ' +
      'la librería. El §5.1 del `CLAUDE.md` advierte por el WhatsApp personal y acá el número es ' +
      'de trabajo, con el cartel «este número se publica en el sitio» arriba del input (§ 9.4).',
  },
  {
    nombre: 'la galería',
    centinelas: ['imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la ficha muestra **todas** las imágenes (criterio de B-296) y el epígrafe es el texto que ' +
      'alguien escribió para que se lea debajo. La URL sale **saneada**, no cruda.',
  },
  /*
   * **`searchText` ya NO es una excepción** — 2026-09-15, hallazgo del
   * `auditor-privacidad` al abrir el `create` anónimo.
   *
   * Estuvo acá mientras la proyección **copiaba** `l.searchText` del documento,
   * con el `porque` diciendo «se deriva de los cinco campos de esta misma
   * lista». Eso describía a `formALibreria`, no a la proyección: el campo del
   * documento lo escribe el cliente, y desde que ese cliente puede ser un
   * anónimo, dos mil caracteres elegidos por cualquiera salían al JSON —por el
   * único campo publicado que la bandeja **no muestra**—.
   *
   * Ahora la proyección lo **deriva** con `searchTextDeLibreria` de los valores
   * ya proyectados, así que el centinela del documento no sobrevive y la
   * excepción sobra. Lo que sí hay son los tres casos del final de este archivo,
   * que es el mismo reparto que `tests/lugar-publico.test.ts` ya tenía.
   */
];

/**
 * Lo que sale a la **ficha** (`FichaDeLibreria`, el view-model de la página).
 *
 * Es la proyección **menos `searchText`**: el índice de búsqueda existe para que
 * el listado filtre en memoria, y la página de una librería no filtra nada.
 * Publicarlo ahí sería repetir el nombre, la descripción y la dirección
 * normalizados, sin ningún consumidor.
 */
/*
 * **Desde el 2026-09-15 es la proyección entera, y el filtro se fue con la
 * excepción.** `searchText` dejó de ser una excepción del barrido —la proyección
 * lo deriva en vez de copiarlo—, así que este `filter` no sacaba nada y quedaba
 * nombrando un grupo que ya no existe. La propiedad que la ficha sigue teniendo
 * —no publica el índice de búsqueda— la afirman sus propios casos.
 */
export const PERMITIDO_EN_LA_FICHA_DE_LIBRERIAS: readonly Excepcion<RutaDeLibreria>[] = PERMITIDO_EN_LA_PROYECCION_DE_LIBRERIAS;

/**
 * Lo que sale al **marcado estructurado** (`BookStore` + migas + `CollectionPage`).
 *
 * La lista más corta de las tres, y con motivo: esto lo lee una máquina y es lo
 * que Google puede mostrar **fuera** del sitio.
 */
export const PERMITIDO_EN_EL_MARCADO_DE_LIBRERIAS: readonly Excepcion<RutaDeLibreria>[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      '`name`, `description` y el `url` canónico. Es lo que hace que la ficha entre al panel local ' +
      'de Google, que es todo el SEO de esta sección (§ 4 del PRD).',
  },
  {
    nombre: 'la dirección postal',
    centinelas: ['direccion', 'ciudad', 'provincia'],
    porque:
      '`PostalAddress` de un local comercial: `streetAddress`, `addressLocality` y —desde ' +
      'B-967— `addressRegion`, que es lo que distingue dos ciudades homónimas. El **barrio no ' +
      'entra**: no es un componente de `PostalAddress` y meterlo en `streetAddress` ensuciaría ' +
      'el dato que Google geocodifica.',
  },
  {
    nombre: 'los perfiles',
    centinelas: ['instagram', 'web'],
    porque:
      '`sameAs` es «las otras direcciones de esta misma entidad». El **WhatsApp y el mail no ' +
      'entran**: son canales de contacto, no perfiles, y publicarlos en el marcado los deja ' +
      'cosechables por cualquier parser sin que nadie abra la página.',
  },
  {
    nombre: 'la imagen',
    centinelas: ['imagenes.url'],
    porque:
      '`image` es una lista de URLs. El **epígrafe no entra**: es texto para leer debajo de la ' +
      'foto, no un dato de la entidad.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Suscripciones — barrido en `tests/suscripcion-publica.test.ts`.
// ───────────────────────────────────────────────────────────────────────────

export const PERMITIDO_EN_LA_PROYECCION_DE_SUSCRIPCIONES: readonly Excepcion<RutaDeSuscripcion>[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10) y qué es y ' +
      'para quién. La descripción es **obligatoria** acá, al revés que en una librería: una ' +
      'suscripción es una promesa a futuro y sin eso la ficha no dice nada (§ 3.1 del PRD).',
  },
  {
    nombre: 'quién la ofrece',
    centinelas: ['ofrecidaPor.nombre', 'ofrecidaPor.tipo', 'ofrecidaPor.instagram', 'ofrecidaPor.libreriaSlug'],
    porque:
      'es el sujeto de la oferta y lo que la acción de la ficha nombra («Suscribite en la página ' +
      'de …», criterio 9). El `libreriaSlug` sale porque de él cuelga el enlace a la ficha de esa ' +
      'librería (§ 5 del PRD), y sale **solo si es un slug**.',
  },
  {
    nombre: 'las condiciones',
    centinelas: [
      'periodicidad',
      'compromisoMinimo',
      'incluye',
      'incluyeOtro',
      'envio.tematica',
      'envio.editoriales',
      'extras',
      'extrasOtro',
      'alcance',
    ],
    porque:
      'es literalmente lo que el dueño pidió que se pudiera contestar: «Qué incluye? Si envían ' +
      'libros: tiene temática? Son de editoriales independientes? Extras?». Tres de estos son ' +
      'además los ejes de filtro del § 5.',
  },
  {
    nombre: 'los cuatro destinos públicos',
    centinelas: ['linkDeSuscripcion', 'instagram', 'whatsapp', 'mail'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que la gente se pueda ' +
      'suscribir. El link es el riesgo propio de este PRD (§ 7) y por eso sale saneado, solo con ' +
      '`https:`, y en la página con `rel="noopener noreferrer"`.',
  },
  {
    nombre: 'la galería',
    centinelas: ['imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la ficha muestra **todas** las imágenes (criterio de B-296) y el epígrafe es el texto que ' +
      'alguien escribió para que se lea debajo. La URL sale **saneada**, no cruda.',
  },
  /*
   * **`searchText` ya NO es una excepción** — 2026-09-15, hallazgo del
   * `auditor-privacidad`. El argumento entero está en
   * `tests/libreria-publica.test.ts`, y acá tenía una mitad más: el `porque`
   * afirmaba «no lleva el precio» mientras la proyección copiaba el campo del
   * documento, así que un `curl` metía el monto ahí y quedaba **filtrable** —la
   * segunda regla de DEC-12 dada vuelta—.
   *
   * Ahora la proyección lo deriva con `searchTextDeSuscripcion` de los valores ya
   * proyectados, entre los cuales el precio no está. Los casos propios están al
   * final de este archivo.
   */
];

/**
 * Lo que sale a la **ficha** (`FichaDeSuscripcion`, el view-model de la página).
 *
 * Es la proyección **menos `searchText`** (el índice existe para que el listado
 * filtre, y la página de una suscripción no filtra nada) y **menos
 * `ofrecidaPor.libreriaSlug`**: en la ficha ese slug no viaja como dato, viaja
 * resuelto adentro de una ruta, y solo si esa librería está publicada.
 */
export const PERMITIDO_EN_LA_FICHA_DE_SUSCRIPCIONES: readonly Excepcion<RutaDeSuscripcion>[] = PERMITIDO_EN_LA_PROYECCION_DE_SUSCRIPCIONES.map((g) =>
  g.nombre === 'quién la ofrece'
    ? { ...g, centinelas: g.centinelas.filter((c) => c !== 'ofrecidaPor.libreriaSlug') }
    : g,
);
/*
 * **El `.filter()` del índice de búsqueda se fue el 2026-09-15**, con la
 * excepción: `searchText` dejó de ser una, así que filtraba un grupo que ya no
 * existe. La propiedad que la ficha sigue teniendo —no publica el índice— la
 * afirman sus propios casos.
 */

/**
 * Lo que sale al **marcado estructurado** (`Product` + migas + `CollectionPage`).
 *
 * La lista más corta de las tres, y con motivo: esto lo lee una máquina y es lo
 * que Google puede mostrar **fuera** del sitio.
 */
export const PERMITIDO_EN_EL_MARCADO_DE_SUSCRIPCIONES: readonly Excepcion<RutaDeSuscripcion>[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      '`name`, `description` y el `url` canónico. Es lo que hace que la ficha se entienda como un ' +
      'producto con una oferta, que es el SEO de esta sección (§ 5 del PRD).',
  },
  {
    nombre: 'quién la ofrece',
    centinelas: ['ofrecidaPor.nombre'],
    porque:
      '`brand` y `offers.seller`: quién vende esto. El **tipo no entra** —es un slug de nuestra ' +
      'taxonomía, no un dato de schema.org— y el `libreriaSlug` tampoco.',
  },
  {
    nombre: 'los perfiles',
    centinelas: ['instagram', 'ofrecidaPor.instagram'],
    porque:
      '`sameAs` es «las otras direcciones de esta misma entidad». El **WhatsApp y el mail no ' +
      'entran**: son canales de contacto, no perfiles, y publicarlos en el marcado los deja ' +
      'cosechables por cualquier parser sin que nadie abra la página.',
  },
  {
    nombre: 'el destino de la oferta',
    centinelas: ['linkDeSuscripcion'],
    porque:
      '`offers.url` es a dónde se compra, que es lo que un `Offer` significa. Va **sin `price`**: ' +
      'ver el caso que lo fija y el § 5 del PRD.',
  },
  {
    nombre: 'la imagen',
    centinelas: ['imagenes.url'],
    porque:
      '`image` es una lista de URLs. El **epígrafe no entra**: es texto para leer debajo de la ' +
      'foto, no un dato de la entidad.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Lugares — barrido en `tests/lugar-publico.test.ts`.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Lo que sale cuando **la dirección se publica** (un local comercial).
 *
 * `direccion` está en su propio grupo y no mezclada con el resto de «dónde
 * queda»: es el único campo del proyecto cuya presencia en esta lista depende de
 * otro campo del mismo documento, y separarlo es lo que deja que el caso de la
 * casa sea una resta de un grupo entero y no una edición de un array.
 */
export const PERMITIDO_EN_LA_PROYECCION_DE_LUGARES: readonly Excepcion<RutaDeLugar>[] = [
  {
    nombre: 'cuándo se puede usar',
    // B-982 — el horario, y **no** depende de `direccionPublica`.
    centinelas: ['horarios'],
    porque:
      'cuándo se puede usar un lugar no identifica una casa — lo que la identifica es la calle y ' +
      'el número, y de eso se ocupa `direccionPublica` (§ 6 del PRD). Por eso sale **siempre**, ' +
      'incluso en una casa con la dirección reservada: es justamente lo que esa persona sí quiere ' +
      'decir. No entra al JSON-LD, por lo mismo que en una librería.',
  },
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10) y qué tiene ' +
      'el lugar. La descripción es opcional acá, como en una librería: un café con su capacidad ' +
      'ya dice lo que hay que saber.',
  },
  {
    nombre: 'qué es y dónde, sin la calle',
    centinelas: ['tipo', 'provincia', 'barrio', 'ciudad'],
    porque:
      'los tres de la geografía salen **siempre**, también para una casa: son el «más o menos por ' +
      'Villa Crespo» que el § 6 del PRD sí deja publicar, y sin ellos la ficha de una casa no ' +
      'diría nada y el filtro de barrio la dejaría fuera de su propio chip. El tipo es el eje de ' +
      'filtro 5 y lo que decide el default del flag.',
  },
  {
    nombre: '⚠️ la calle, y SOLO con el flag prendido',
    centinelas: ['direccion'],
    porque:
      '§ 6 del PRD 4. La dirección de un local comercial es pública por definición; la de una ' +
      'casa es el dato con el que se llega a la puerta de alguien. Lo decide `direccionPublica` y ' +
      'lo aplica `dondeQueSale`, una sola función para la dirección y la `geo`.',
  },
  {
    nombre: 'para cuántos y qué incluye',
    centinelas: ['capacidadNotas', 'incluye', 'incluyeOtro'],
    porque:
      'es lo que el dueño pidió: «Capacidad» y «Qué incluye el lugar». Las notas existen por el ' +
      '§ 9 —la capacidad tiene respuestas distintas si están sentados o de pie— y `incluye` es el ' +
      'eje de filtro 4, el que más ayuda con proyector y accesibilidad.',
  },
  {
    nombre: 'la condición, que no es un precio',
    centinelas: ['condicion', 'condicionNotas'],
    porque:
      '§ 5 del PRD, el hallazgo del pedido: «no sé si todos cobran, o le dicen que tienen que ' +
      'consumir». La condición se muestra **siempre** (criterio 7) y las notas son donde entra ' +
      '«mínimo de consumición $8000 por persona».',
  },
  {
    nombre: 'los cuatro contactos',
    centinelas: ['instagram', 'whatsapp', 'mail', 'web'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que alguien pueda pedir ' +
      'el salón. Para una casa son además el único camino, porque la dirección la pide quien ' +
      'escribe.',
  },
  {
    nombre: 'la galería',
    centinelas: ['imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la ficha muestra **todas** las imágenes (criterio de B-296) y el epígrafe es el texto que ' +
      'alguien escribió para que se lea debajo. La URL sale **saneada**, no cruda.',
  },
];

/**
 * Lo que sale cuando **la dirección NO se publica** (una casa).
 *
 * Es la lista de arriba **menos un grupo entero**. Que sea una resta declarada y
 * no una lista aparte es deliberado: así el día que alguien agregue un campo a la
 * proyección tiene que decidir en cuál de los dos grupos va, y no puede agregarlo
 * «al de la casa» sin que se note.
 */
export const PERMITIDO_SIN_DIRECCION_DE_LUGARES: readonly Excepcion<RutaDeLugar>[] = PERMITIDO_EN_LA_PROYECCION_DE_LUGARES.filter(
  (g) => !g.nombre.startsWith('⚠️'),
);

/**
 * Lo que sale a la **ficha** (`FichaDeLugar`, el view-model de la página).
 *
 * Es **la misma lista que la proyección**, y eso no siempre fue así: en los otros
 * dos directorios la ficha es la proyección menos `searchText`. Acá ese campo no
 * tiene centinela porque **la proyección lo deriva en vez de copiarlo**, así que
 * no hay nada que restar. Que sea un alias y no una copia es lo que hace que
 * agregar un campo a la proyección obligue a pensar si va también a la ficha.
 */
export const PERMITIDO_EN_LA_FICHA_DE_LUGARES: readonly Excepcion<RutaDeLugar>[] = PERMITIDO_EN_LA_PROYECCION_DE_LUGARES;

/**
 * Lo que sale al **marcado estructurado** (`Place` + migas + `CollectionPage`).
 *
 * La lista más corta de las tres, y con motivo: esto lo lee una máquina y es lo
 * que Google puede mostrar **fuera** del sitio.
 */
export const PERMITIDO_EN_EL_MARCADO_DE_LUGARES: readonly Excepcion<RutaDeLugar>[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      '`name`, `description` y el `url` canónico. Es lo que hace que la ficha se entienda como un ' +
      'lugar y no como una página suelta.',
  },
  {
    nombre: '⚠️ la dirección, y SOLO con el flag prendido',
    centinelas: ['direccion', 'ciudad', 'provincia'],
    porque:
      '`address.streetAddress` y `addressLocality`. **Es el criterio 5 del PRD y el camino que ' +
      'más fácil se filtra**: nadie lee el JSON-LD al revisar una ficha. Sin dirección publicada ' +
      'no hay clave `address` **en absoluto**, ni con la localidad sola.',
  },
  {
    nombre: 'qué incluye',
    centinelas: ['incluye'],
    porque:
      '`amenityFeature` como `LocationFeatureSpecification`. Es un dato del lugar, y es el que ' +
      'hace que el marcado diga algo más que el nombre.',
  },
  {
    nombre: 'los perfiles',
    centinelas: ['instagram', 'web'],
    porque:
      '`sameAs` es «las otras direcciones de esta misma entidad». El **WhatsApp y el mail no ' +
      'entran**: son canales de contacto, no perfiles, y publicarlos en el marcado los deja ' +
      'cosechables por cualquier parser sin que nadie abra la página.',
  },
  {
    nombre: 'la imagen',
    centinelas: ['imagenes.url'],
    porque:
      '`image` es una lista de URLs. El **epígrafe no entra**: es texto para leer debajo de la ' +
      'foto, no un dato de la entidad.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Bibliotecas — barrido en `tests/biblioteca-publica.test.ts`.
// ───────────────────────────────────────────────────────────────────────────

export const PERMITIDO_EN_LA_PROYECCION_DE_BIBLIOTECAS: readonly Excepcion<RutaDeBiblioteca>[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion', 'tipo'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10), qué tiene ' +
      'la biblioteca y de qué tipo es. El `tipo` además es el eje de filtro propio de esta ' +
      'sección, así que sin él no hay chips.',
  },
  {
    nombre: 'dónde queda',
    centinelas: ['direccion', 'provincia', 'barrio', 'ciudad'],
    porque:
      'es una **institución**, no la casa de nadie — la diferencia con `/lugares`, que tiene ' +
      '`direccionPublica` justamente porque ahí puede serlo. La dirección es el dato por el que ' +
      'alguien entra a la ficha, y el barrio es el mismo slug que usan las actividades, que es ' +
      'lo que deja cruzarlas en el hub.',
  },
  {
    nombre: 'cuándo abre',
    centinelas: ['horarios', 'horarioDeSala'],
    porque:
      'son lo que el directorio existe para contestar después de la dirección, y en una ' +
      'biblioteca **son dos**: el mostrador y la sala de lectura pueden tener horarios ' +
      'distintos. Ninguno identifica a nadie. **No entran al JSON-LD**: son texto libre y ' +
      '`schema.org/openingHours` quiere un formato fijo — publicarlo mal formado haría que ' +
      'Google muestre un horario equivocado, que es peor que no mostrarlo.',
  },
  {
    nombre: 'cómo se saca un libro',
    centinelas: ['asociarse.costo.valor', 'catalogo'],
    porque:
      'es la razón de ser de esta sección. El catálogo es el dato que más le sirve a quien lee ' +
      '—mirar desde casa si el libro está— y el costo de asociarse sale **adentro de la frase ' +
      'con su fecha de carga pegada** (`fraseConFecha`, B-837/DEC-12), nunca como número suelto: ' +
      'la forma es la que impide que se pueda filtrar u ordenar por él.',
  },
  {
    nombre: 'los cuatro contactos públicos',
    centinelas: ['instagram', 'whatsapp', 'web', 'mail'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que la gente le escriba ' +
      'a la biblioteca. El §5.1 del `CLAUDE.md` advierte por el WhatsApp personal y acá el ' +
      'número es institucional, con el cartel «este número se publica en el sitio» arriba del ' +
      'input.',
  },
  {
    nombre: 'la galería',
    centinelas: ['imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la ficha muestra **todas** las imágenes (criterio de B-296) y el epígrafe es el texto que ' +
      'alguien escribió para que se lea debajo. La URL sale **saneada**, no cruda.',
  },
  /*
   * **`searchText` NO es una excepción, y esta colección nace así.**
   *
   * En librerías y suscripciones estuvo acá mientras la proyección **copiaba**
   * el campo del documento, y el `auditor-privacidad` lo cobró el 2026-09-15 al
   * abrir el `create` anónimo: el campo lo escribe el cliente, y dos mil
   * caracteres elegidos por cualquiera salían al JSON por el único campo
   * publicado que la bandeja **no muestra**.
   *
   * Acá la proyección lo **deriva** con `searchTextDeBiblioteca` de los valores
   * ya proyectados desde el primer commit, así que el centinela del documento no
   * sobrevive y la excepción no existe. Los casos del final lo afirman.
   */
];

/**
 * Lo que sale a la **ficha** (`FichaDeBiblioteca`, el view-model de la página).
 *
 * Es la proyección entera: `searchText` no está en el barrido porque no
 * sobrevive, así que no hay nada que filtrar. La propiedad que la ficha sigue
 * teniendo —no publica el índice de búsqueda— la afirman sus propios casos.
 */
export const PERMITIDO_EN_LA_FICHA_DE_BIBLIOTECAS: readonly Excepcion<RutaDeBiblioteca>[] = PERMITIDO_EN_LA_PROYECCION_DE_BIBLIOTECAS;

/**
 * Lo que sale al **marcado estructurado** (`Library` + migas + `CollectionPage`).
 *
 * La lista más corta de las tres, y con motivo: esto lo lee una máquina y es lo
 * que Google puede mostrar **fuera** del sitio.
 */
export const PERMITIDO_EN_EL_MARCADO_DE_BIBLIOTECAS: readonly Excepcion<RutaDeBiblioteca>[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      '`name`, `description` y el `url` canónico. Es lo que hace que la ficha entre al panel ' +
      'local de Google, que es todo el SEO de esta sección. **El `tipo` no entra**: `Library` ya ' +
      'dice qué es la entidad, y «popular» o «universitaria» no tienen propiedad donde caer sin ' +
      'inventarla.',
  },
  {
    nombre: 'la dirección postal',
    centinelas: ['direccion', 'ciudad', 'provincia'],
    porque:
      '`PostalAddress` de una institución: `streetAddress`, `addressLocality` y `addressRegion`, ' +
      'que es lo que distingue dos ciudades homónimas. El **barrio no entra**: no es un ' +
      'componente de `PostalAddress` y meterlo en `streetAddress` ensuciaría el dato que Google ' +
      'geocodifica.',
  },
  {
    nombre: 'los perfiles',
    centinelas: ['instagram', 'web', 'catalogo'],
    porque:
      '`sameAs` es «las otras direcciones de esta misma entidad», y el catálogo lo es: es la ' +
      'biblioteca en otro dominio. El **WhatsApp y el mail no entran**: son canales de contacto, ' +
      'no perfiles, y publicarlos en el marcado los deja cosechables por cualquier parser sin ' +
      'que nadie abra la página.',
  },
  {
    nombre: 'la imagen',
    centinelas: ['imagenes.url'],
    porque:
      '`image` es una lista de URLs. El **epígrafe no entra**: es texto para leer debajo de la ' +
      'foto, no un dato de la entidad.',
  },
  /*
   * **Ni los horarios ni el costo de asociarse entran al marcado**, y las dos
   * ausencias son decisiones:
   *
   * - los horarios, porque `openingHours` quiere un formato fijo (B-982);
   * - el costo, porque un `priceRange` o un `Offer` con esa frase adentro
   *   deshace la regla 2 de `datoConFecha.ts` (D-570) en la salida que más la
   *   amplifica: Google lo mostraría como un precio comparable, que es
   *   exactamente lo que la frase con fecha existe para impedir.
   */
];
