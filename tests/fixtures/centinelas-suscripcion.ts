/**
 * Un documento de **suscripción literaria** donde cada string es un centinela —
 * B-832, sobre la forma de B-196 y el fixture de librerías.
 *
 * ── Por qué hace falta uno propio ─────────────────────────────────────────
 * `tests/fixtures/centinelas.ts` describe una **actividad** y
 * `centinelas-libreria.ts` una librería. Ésta es una tercera colección, con otros
 * campos y —lo que importa— con el reparto de público e interno más mezclado de
 * los cuatro PRDs: el § 8 del PRD 3 lo dice con todas las letras («es el que más
 * necesita que la proyección sea explícita»), porque el `contactoDeQuienCargo`
 * convive con **cuatro** destinos públicos, uno de ellos un link de cobro.
 *
 * ── Las tres reglas de forma, y las tres son load-bearing ─────────────────
 * 1. **El valor dice la ruta**, así que el mensaje de falla nombra el campo que
 *    se escapó sin que haya que traducir nada.
 * 2. **Todos pasan la validación de su campo.** Acá eso es más exigente que en
 *    librerías: además de `slug`, `instagram`, `whatsapp`, `mail` y el link
 *    —que tienen formato acotado en `firestore.rules` y en el schema— están los
 *    **seis vocabularios**, y la proyección **descarta todo elemento que no sea
 *    un slug** (`slugify(v) === v`). Un centinela mal formado saldría vacío y el
 *    barrido diría «dejó de publicarse» por el motivo equivocado — un rojo que se
 *    arregla aflojando la excepción, que es el peor final posible.
 * 3. **Ninguno es subcadena de otro.** Ojo con los dos Instagram y con los dos
 *    «incluye»: por eso el del oferente es `igDelOferente` y el de la suscripción
 *    `igDeLaSuscripcion`, y no `CENTINELA.instagram` los dos.
 *
 * ── El precio no tiene centinela, y está declarado ───────────────────────
 * Ver `VALORES_NO_TEXTO_SUSCRIPCION`. Lo que sale de `precio` es **una frase
 * armada** (DEC-12), no un texto del documento, así que se verifica por valor en
 * los casos de `fraseDePrecio` y del JSON-LD, no por centinela. El `porPeriodo`
 * del fixture es `mensual` **a propósito**: con un slug inventado la frase saldría
 * vacía —el período no se sabría nombrar— y los casos que afirman que el precio
 * se publica pasarían por el motivo equivocado.
 *
 * ── Lo que este fixture NO es ────────────────────────────────────────────
 * No es una suscripción verosímil: es un documento donde todo es rastreable. La
 * verosimilitud vive en `tests/suscripciones.integracion.test.ts`, que escribe
 * contra el emulador y por eso tiene que pasar la regla de verdad.
 */
import type { SuscripcionLiteraria } from '@/types/suscripcion-literaria';
import { ts } from './tiempo';

/**
 * Cada ruta de **contenido** del documento.
 *
 * **Es la lista que hay que tocar al agregar un campo**, y no hace falta
 * acordarse: `tests/suscripcion-publica.test.ts` compara este fixture contra
 * `src/types/suscripcion-literaria.ts` y falla si falta una clave.
 */
const RUTAS = [
  // Identidad y texto.
  'nombre',
  'slug',
  'descripcion',
  'searchText',

  // La galería (D-125). `storagePath` es el handle interno y NO sale.
  'imagenes.id',
  'imagenes.url',
  'imagenes.epigrafe',
  'imagenes.textoAlternativo',
  'imagenes.storagePath',

  // Quién la ofrece. Todo público: es el punto de la ficha.
  'ofrecidaPor.nombre',
  'ofrecidaPor.tipo',
  'ofrecidaPor.instagram',
  'ofrecidaPor.libreriaSlug',

  // Las condiciones.
  'periodicidad',
  'compromisoMinimo',
  'incluye',
  'incluyeOtro',
  'envio.tematica',
  'envio.editoriales',
  'extras',
  'extrasOtro',
  'alcance',

  // ⚠️ Un destino de cobro de un tercero (§ 7 del PRD) y tres contactos, los
  // cuatro PÚBLICOS: salen a propósito.
  'linkDeSuscripcion',
  'instagram',
  'whatsapp',
  'mail',

  // ⚠️ INTERNO — el dato personal de quien pidió el alta.
  'contactoDeQuienCargo.valor',

  // El ciclo de vida: quién revisó y por qué descartó. Interno.
  'revision.porUid',
  'revision.motivo',
] as const;

export type RutaDeSuscripcion = (typeof RUTAS)[number];

/**
 * El valor de cada centinela.
 *
 * Los que llevan formato no pueden ser `CENTINELA.<ruta>` a secas (regla 2 de
 * arriba), así que se escriben a mano **conservando la ruta adentro**: el mensaje
 * de falla los sigue nombrando.
 */
export const CENTINELA_SUSCRIPCION = {
  nombre: 'CENTINELA.nombreDeLaSuscripcion',
  // Alfabeto de `slugify`: lo exige `firestore.rules` y lo exige `esSlugDeFicha`.
  slug: 'centinela-suscripcion-slug',
  descripcion: 'CENTINELA.descripcionDeLaSuscripcion',
  // Normalizado (§6): sin mayúsculas ni acentos, como lo deja `formASuscripcion`.
  searchText: 'centinela.searchtext.suscripcion',
  'imagenes.id': 'img_centinela_sus',
  'imagenes.url': 'https://centinela.imagen.example/CENTINELA.imagenesUrl.jpg',
  'imagenes.epigrafe': 'CENTINELA.imagenesEpigrafe',
  'imagenes.textoAlternativo': 'CENTINELA.imagenesTextoAlternativo',
  'imagenes.storagePath': 'imagenes/CENTINELA.imagenesStoragePath.jpg',
  'ofrecidaPor.nombre': 'CENTINELA.quienLaOfrece',
  // Slug de `/opciones/tipo-oferente`.
  'ofrecidaPor.tipo': 'centinela-tipo-oferente',
  // El alfabeto real de Instagram acepta el punto, así que el centinela entra
  // tal cual. **No es `CENTINELA.instagram`**: sería subcadena del de abajo.
  'ofrecidaPor.instagram': 'CENTINELA.igDelOferente',
  // La dirección web de una librería del PRD 2: mismo alfabeto que un slug.
  'ofrecidaPor.libreriaSlug': 'centinela-libreria-slug',
  'periodicidad': 'centinela-periodicidad',
  'compromisoMinimo': 'CENTINELA.compromisoMinimo',
  // Los tres multivalor guardan slugs, así que sus centinelas también.
  incluye: 'centinela-incluye',
  incluyeOtro: 'CENTINELA.incluyeOtro',
  'envio.tematica': 'CENTINELA.tematicaDelEnvio',
  'envio.editoriales': 'centinela-perfil-editorial',
  extras: 'centinela-extras',
  extrasOtro: 'CENTINELA.extrasOtro',
  alcance: 'centinela-alcance',
  // ⚠️ `https:` y solo `https:` — criterio 7 del PRD.
  linkDeSuscripcion: 'https://centinela.cobro.example/CENTINELA.linkDeSuscripcion',
  instagram: 'CENTINELA.igDeLaSuscripcion',
  // Solo dígitos: de acá sale un `wa.me/<digitos>`. Trece, dentro del 8–15.
  whatsapp: '5491155556666',
  mail: 'centinela.mail.suscripcion@example.com',
  'contactoDeQuienCargo.valor': 'CENTINELA.contactoDeQuienCargo',
  'revision.porUid': 'CENTINELA.revisionPorUid',
  'revision.motivo': 'CENTINELA.revisionMotivo',
} as const satisfies Record<RutaDeSuscripcion, string>;

/** Todas las rutas, para recorrerlas en el barrido. */
export const RUTAS_SUSCRIPCION: readonly RutaDeSuscripcion[] = RUTAS;

/**
 * Los campos del documento que **no son texto**, con dónde se verifica cada uno.
 *
 * Misma disciplina que en los otros dos fixtures: un booleano, un número o un
 * `Timestamp` no tienen dónde esconder contenido, así que se verifican **por
 * clave** y no por valor. La entrada existe para que un campo nuevo no pueda
 * entrar al modelo sin que alguien diga qué lo cubre.
 */
export const VALORES_NO_TEXTO_SUSCRIPCION: Record<string, string> = {
  /*
   * **El precio, y es la declaración que más importa de esta tabla.**
   *
   * No lleva centinela porque lo que sale no es un texto del documento: es **una
   * frase armada** por `fraseDePrecio` con el monto formateado y la fecha de
   * carga pegada (DEC-12, D-570). Un centinela no podría distinguir «se publicó
   * la frase entera» de «se publicó el número solo», que es justamente el modo de
   * falla de este campo, así que se verifica **por valor**: los casos de
   * `fraseDePrecio` fijan que sin fecha usable, sin período nombrable o sin monto
   * no sale nada, y el caso del JSON-LD fija que el número no entra al `Offer`.
   *
   * `porPeriodo` es un slug de vocabulario cerrado y `monto` un entero; ninguno
   * de los dos tiene dónde esconder contenido de un tercero.
   */
  precio:
    'una frase armada, no un texto del documento: se verifica por valor en `fraseDePrecio` y en el JSON-LD (DEC-12).',
  estado:
    'vocabulario cerrado de `ESTADOS_DIRECTORIO`. No sale: el JSON solo tiene publicadas, así que el campo no agrega nada.',
  origen:
    'vocabulario cerrado de `ORIGENES_SUSCRIPCION`. No sale: es ciclo de vida, y dice si la ficha la cargó quien la ofrece.',
  creadoEn: 'un `Timestamp`. No sale; se verifica por clave en la proyección.',
  'revision.en': 'un `Timestamp`. No sale: `revision` entera es interna.',
  'contactoDeQuienCargo.via':
    'vocabulario cerrado de `VIAS_CONTACTO_SUSCRIPCION`. No sale, porque el campo entero es interno.',
  'envio.manda':
    'booleano. **Sale a propósito**: es el primer filtro del § 5 y lo que parte el catálogo en dos mundos.',
  'envio.cuantos': 'número. Sale: cuántos libros por entrega es un dato de la ficha.',
  'envio.sorpresa': 'booleano de tres estados (`null` es «no lo dice»). Sale: es un dato de la ficha.',
  'imagenes.origen': "vocabulario cerrado (`'externa' | 'propia'`): dice de dónde vino la imagen, no qué es.",
  'imagenes.portada': 'booleano. No sale como campo: la proyección lo usa para **ordenar**.',
  'imagenes.ancho': 'número. Sale a propósito: es el `width` que reserva la caja de la imagen.',
  'imagenes.alto': 'número. Ídem `ancho`.',
  publicadaAlgunaVez:
    'booleano pegajoso de la trampa 10. No sale: es el candado del slug, no un dato de la ficha.',
};

/** Una suscripción publicada donde cada string es rastreable. */
export const suscripcionCentinela = (): SuscripcionLiteraria => ({
  nombre: CENTINELA_SUSCRIPCION.nombre,
  slug: CENTINELA_SUSCRIPCION.slug,
  descripcion: CENTINELA_SUSCRIPCION.descripcion,
  imagenes: [
    {
      id: CENTINELA_SUSCRIPCION['imagenes.id'],
      url: CENTINELA_SUSCRIPCION['imagenes.url'],
      epigrafe: CENTINELA_SUSCRIPCION['imagenes.epigrafe'],
      textoAlternativo: CENTINELA_SUSCRIPCION['imagenes.textoAlternativo'],
      origen: 'propia',
      storagePath: CENTINELA_SUSCRIPCION['imagenes.storagePath'],
      ancho: 1200,
      alto: 800,
      portada: true,
    },
  ],
  ofrecidaPor: {
    nombre: CENTINELA_SUSCRIPCION['ofrecidaPor.nombre'],
    tipo: CENTINELA_SUSCRIPCION['ofrecidaPor.tipo'],
    instagram: CENTINELA_SUSCRIPCION['ofrecidaPor.instagram'],
    libreriaSlug: CENTINELA_SUSCRIPCION['ofrecidaPor.libreriaSlug'],
  },
  periodicidad: CENTINELA_SUSCRIPCION.periodicidad,
  compromisoMinimo: CENTINELA_SUSCRIPCION.compromisoMinimo,
  incluye: [CENTINELA_SUSCRIPCION.incluye],
  incluyeOtro: CENTINELA_SUSCRIPCION.incluyeOtro,
  envio: {
    manda: true,
    cuantos: 2,
    tematica: CENTINELA_SUSCRIPCION['envio.tematica'],
    editoriales: CENTINELA_SUSCRIPCION['envio.editoriales'],
    sorpresa: true,
  },
  extras: [CENTINELA_SUSCRIPCION.extras],
  extrasOtro: CENTINELA_SUSCRIPCION.extrasOtro,
  /*
   * `mensual` y no un centinela: ver el docblock de arriba. El monto es un número
   * reconocible —18.246.813 formateado no aparece por casualidad— para que los
   * casos que verifican la frase por valor no dependan de un literal chico.
   */
  precio: { valor: { monto: 18246813, porPeriodo: 'mensual' }, cargadoEn: ts('2026-09-01T12:00:00Z') },
  alcance: [CENTINELA_SUSCRIPCION.alcance],
  linkDeSuscripcion: CENTINELA_SUSCRIPCION.linkDeSuscripcion,
  instagram: CENTINELA_SUSCRIPCION.instagram,
  whatsapp: CENTINELA_SUSCRIPCION.whatsapp,
  mail: CENTINELA_SUSCRIPCION.mail,
  contactoDeQuienCargo: {
    via: 'mail',
    valor: CENTINELA_SUSCRIPCION['contactoDeQuienCargo.valor'],
  },
  estado: 'publicado',
  origen: 'formulario-publico',
  searchText: CENTINELA_SUSCRIPCION.searchText,
  creadoEn: ts('2026-09-01T12:00:00Z'),
  revision: {
    porUid: CENTINELA_SUSCRIPCION['revision.porUid'],
    en: ts('2026-09-02T12:00:00Z'),
    motivo: CENTINELA_SUSCRIPCION['revision.motivo'],
  },
  publicadaAlgunaVez: true,
});
