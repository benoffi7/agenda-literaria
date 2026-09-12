/**
 * Un documento de **lugar para eventos** donde cada string es un centinela —
 * B-833, sobre la forma de B-196 y los fixtures de librerías y suscripciones.
 *
 * ── Por qué hace falta uno propio ─────────────────────────────────────────
 * `centinelas.ts` describe una **actividad**, `centinelas-libreria.ts` una
 * librería y `centinelas-suscripcion.ts` una suscripción. Ésta es una cuarta
 * colección, y con algo que ninguna de las otras tiene: **un campo cuya
 * publicación depende de un booleano del mismo documento** (§ 6 del PRD 4). El
 * barrido tiene entonces que correr **dos veces** —con el flag prendido y con el
 * flag apagado— y esperar listas de permitidos distintas, que es exactamente lo
 * que `lugarCentinela()` y `lugarCentinelaSinDireccion()` habilitan.
 *
 * ── Las tres reglas de forma, y las tres son load-bearing ─────────────────
 * 1. **El valor dice la ruta**, así que el mensaje de falla nombra el campo que
 *    se escapó sin que haya que traducir nada.
 * 2. **Todos pasan la validación de su campo.** Acá eso incluye los cuatro
 *    vocabularios —la proyección **descarta** todo elemento que no sea un slug
 *    (`slugify(v) === v`)— y `slug`, `instagram`, `whatsapp`, `mail` y `web`, que
 *    tienen formato acotado en `firestore.rules` y en el schema. Un centinela mal
 *    formado saldría vacío y el barrido diría «dejó de publicarse» por el motivo
 *    equivocado — un rojo que se arregla aflojando la excepción, que es el peor
 *    final posible.
 * 3. **Ninguno es subcadena de otro.** Ojo con `condicion` / `condicionNotas` y
 *    con `incluye` / `incluyeOtro`: por eso los slugs van en minúscula con
 *    guiones y los textos libres en `CENTINELA.camelCase`.
 *
 * ── El precio no tiene centinela, y está declarado ───────────────────────
 * Ver `VALORES_NO_TEXTO_LUGAR`. Lo que sale de `precio` es **una frase armada**
 * (B-837), no un texto del documento, así que se verifica por valor. El
 * `porUnidad` del fixture es `hora` **a propósito**: es un vocabulario cerrado
 * (`UNIDADES_DE_PRECIO_LUGAR`), y con un valor inventado la frase saldría vacía y
 * los casos que afirman que el precio se publica pasarían por el motivo
 * equivocado.
 *
 * ── Lo que este fixture NO es ────────────────────────────────────────────
 * No es un lugar verosímil: es un documento donde todo es rastreable. La
 * verosimilitud vive en `tests/lugares.integracion.test.ts`, que escribe contra
 * el emulador y por eso tiene que pasar la regla de verdad.
 */
import type { Lugar } from '@/types/lugar';
import { ts } from './tiempo';

/**
 * Cada ruta de **contenido** del documento.
 *
 * **Es la lista que hay que tocar al agregar un campo**, y no hace falta
 * acordarse: `tests/lugar-publico.test.ts` compara este fixture contra
 * `src/types/lugar.ts` y falla si falta una clave.
 */
const RUTAS = [
  // Identidad y texto.
  'nombre',
  'slug',
  'descripcion',

  // La galería (D-125). `storagePath` es el handle interno y NO sale.
  'imagenes.id',
  'imagenes.url',
  'imagenes.epigrafe',
  'imagenes.textoAlternativo',
  'imagenes.storagePath',

  // Qué es el lugar. Decide el default de `direccionPublica` (§ 6).
  'tipo',

  // ⚠️ Dónde queda. `direccion` sale **solo con el flag prendido** — § 6 del
  // PRD 4, y es la única ruta de los cuatro fixtures cuya lista de permitidos
  // cambia según otro campo del mismo documento.
  'direccion',
  'barrio',
  'ciudad',

  // Capacidad y qué incluye.
  'capacidadNotas',
  'incluye',
  'incluyeOtro',

  // La condición, que no es un precio (§ 5).
  'condicion',
  'condicionNotas',

  // Los cuatro contactos, PÚBLICOS: salen a propósito.
  'instagram',
  'whatsapp',
  'mail',
  'web',

  // ⚠️ INTERNO — el dato personal de quien pidió el alta, y acá además es por
  // dónde se pide el permiso del § 6.
  'contactoDeQuienCargo.valor',

  // El ciclo de vida: quién revisó y por qué descartó. Interno.
  'revision.porUid',
  'revision.motivo',
] as const;

export type RutaDeLugar = (typeof RUTAS)[number];

/**
 * El valor de cada centinela.
 *
 * Los que llevan formato no pueden ser `CENTINELA.<ruta>` a secas (regla 2 de
 * arriba), así que se escriben a mano **conservando la ruta adentro**: el mensaje
 * de falla los sigue nombrando.
 */
export const CENTINELA_LUGAR = {
  nombre: 'CENTINELA.nombreDelLugar',
  // Alfabeto de `slugify`: lo exige `firestore.rules` y lo exige `esSlugDeFicha`.
  slug: 'centinela-lugar-slug',
  descripcion: 'CENTINELA.descripcionDelLugar',
  'imagenes.id': 'img_centinela_lug',
  'imagenes.url': 'https://centinela.imagen.example/CENTINELA.imagenesUrl.jpg',
  'imagenes.epigrafe': 'CENTINELA.imagenesEpigrafe',
  'imagenes.textoAlternativo': 'CENTINELA.imagenesTextoAlternativo',
  'imagenes.storagePath': 'imagenes/CENTINELA.imagenesStoragePath.jpg',
  // Slug de `/opciones/tipo-lugar`. **No es `casa`**: el fixture base publica la
  // dirección, y el caso de la casa tiene su propio documento.
  tipo: 'centinela-tipo-de-lugar',
  // ⚠️ El dato del § 6. Texto libre, entre 4 y 160.
  direccion: 'CENTINELA.direccionDelLugar 1234',
  // Slug de `/opciones/barrio`, el mismo vocabulario que las actividades.
  barrio: 'centinela-barrio',
  ciudad: 'CENTINELA.ciudadDelLugar',
  capacidadNotas: 'CENTINELA.capacidadNotas',
  // La lista multivalor guarda slugs, así que su centinela también.
  incluye: 'centinela-incluye',
  incluyeOtro: 'CENTINELA.incluyeOtro',
  // Slug de `/opciones/condicion-de-uso`. **No está en `CLASE_DE_COSTO`** a
  // propósito: la clase se verifica por valor con los slugs reales, y con un
  // centinela clasificable el caso «una condición nueva queda fuera de los tres
  // chips» no tendría dónde probarse.
  condicion: 'centinela-condicion',
  condicionNotas: 'CENTINELA.condicionNotas',
  // El alfabeto real de Instagram acepta el punto, así que el centinela entra
  // tal cual.
  instagram: 'CENTINELA.igDelLugar',
  // Solo dígitos: de acá sale un `wa.me/<digitos>`. Trece, dentro del 8–15.
  whatsapp: '5491177778888',
  mail: 'centinela.mail.lugar@example.com',
  // Acepta `http://` — al revés que el link de cobro de una suscripción.
  web: 'https://centinela.web.example/CENTINELA.webDelLugar',
  'contactoDeQuienCargo.valor': 'CENTINELA.contactoDeQuienCargo',
  'revision.porUid': 'CENTINELA.revisionPorUid',
  'revision.motivo': 'CENTINELA.revisionMotivo',
} as const satisfies Record<RutaDeLugar, string>;

/** Todas las rutas, para recorrerlas en el barrido. */
export const RUTAS_LUGAR: readonly RutaDeLugar[] = RUTAS;

/**
 * Los campos del documento que **no son texto**, con dónde se verifica cada uno.
 *
 * Misma disciplina que en los otros tres fixtures: un booleano, un número o un
 * `Timestamp` no tienen dónde esconder contenido, así que se verifican **por
 * clave** y no por valor. La entrada existe para que un campo nuevo no pueda
 * entrar al modelo sin que alguien diga qué lo cubre.
 */
export const VALORES_NO_TEXTO_LUGAR: Record<string, string> = {
  /*
   * ⚠️ **`searchText` no lleva centinela porque la proyección NO lo copia: lo
   * deriva** (`searchTextDeLugar`), de los siete campos que sí publica. Un
   * centinela acá no probaría nada —el valor del documento nunca sale— y peor:
   * daría la falsa impresión de que lo que hay que vigilar es que ese texto salga
   * limpio, cuando lo que hay que vigilar es que **no salga**.
   *
   * Se verifica **por valor**, en los dos sentidos: un documento con la dirección
   * metida a mano en su `searchText` no la publica, y el derivado sí trae lo que
   * tiene que traer (el control positivo, sin el cual el caso pasaría en verde con
   * un `searchText` vacío). Ver `tests/lugar-publico.test.ts`.
   */
  searchText:
    'se DERIVA en la proyección, no se copia del documento: se verifica por valor en las dos ' +
    'direcciones (§ 6, el hallazgo del `auditor-privacidad`).',
  /*
   * ⚠️ **`geo`, y es la declaración que más importa de esta tabla.**
   *
   * Son dos números, así que no tienen dónde esconder un texto — y sin embargo
   * son el dato más sensible del documento después de la dirección: unas
   * coordenadas **son** la dirección con otro formato, y para una casa eso es la
   * puerta de alguien en un mapa (§ 6). Se verifica **por valor**: los casos de
   * `dondeQueSale` fijan que con el flag apagado sale `null`, y el del JSON-LD
   * que sin dirección publicada no hay `geo`.
   */
  geo: 'dos números que son la dirección con otro formato. Se verifica por valor en `dondeQueSale` y en el JSON-LD (§ 6).',
  /*
   * **El flag del § 6.** No sale como campo —publicarlo sería poner un cartel de
   * «acá hay una dirección que no te estoy dando»— y lo que hace es **decidir**
   * si salen otros dos. Se verifica por valor, corriendo el barrido entero dos
   * veces con listas de permitidos distintas.
   */
  direccionPublica:
    'booleano. NO sale como campo: es política de publicación, no un dato de la ficha. Lo que ' +
    'hace se verifica corriendo el barrido con el flag prendido y apagado.',
  capacidad: 'número. Sale a propósito: es el filtro 1 del § 7, en rangos.',
  precio:
    'una frase armada, no un texto del documento: se verifica por valor en `fraseDePrecioDeLugar` y en el JSON-LD (B-837).',
  estado:
    'vocabulario cerrado de `ESTADOS_DIRECTORIO`. No sale: el JSON solo tiene publicados, así que el campo no agrega nada.',
  origen:
    'vocabulario cerrado de `ORIGENES_LUGAR`. No sale: es ciclo de vida, y dice si la ficha la cargó quien presta el lugar.',
  creadoEn: 'un `Timestamp`. No sale; se verifica por clave en la proyección.',
  'revision.en': 'un `Timestamp`. No sale: `revision` entera es interna.',
  'contactoDeQuienCargo.via':
    'vocabulario cerrado de `VIAS_CONTACTO_LUGAR`. No sale, porque el campo entero es interno.',
  'imagenes.origen': "vocabulario cerrado (`'externa' | 'propia'`): dice de dónde vino la imagen, no qué es.",
  'imagenes.portada': 'booleano. No sale como campo: la proyección lo usa para **ordenar**.',
  'imagenes.ancho': 'número. Sale a propósito: es el `width` que reserva la caja de la imagen.',
  'imagenes.alto': 'número. Ídem `ancho`.',
  publicadaAlgunaVez:
    'booleano pegajoso de la trampa 10. No sale: es el candado del slug, no un dato de la ficha.',
};

/**
 * Un lugar publicado **que sí publica su dirección** — un local comercial.
 *
 * Es el fixture base, y `direccionPublica: true` es parte de lo que verifica: sin
 * él, el barrido no tendría cómo distinguir «la dirección no salió porque el flag
 * la frenó» de «la dirección no salió porque la proyección se rompió».
 */
export const lugarCentinela = (): Lugar => ({
  nombre: CENTINELA_LUGAR.nombre,
  slug: CENTINELA_LUGAR.slug,
  descripcion: CENTINELA_LUGAR.descripcion,
  imagenes: [
    {
      id: CENTINELA_LUGAR['imagenes.id'],
      url: CENTINELA_LUGAR['imagenes.url'],
      epigrafe: CENTINELA_LUGAR['imagenes.epigrafe'],
      textoAlternativo: CENTINELA_LUGAR['imagenes.textoAlternativo'],
      origen: 'propia',
      storagePath: CENTINELA_LUGAR['imagenes.storagePath'],
      ancho: 1200,
      alto: 800,
      portada: true,
    },
  ],
  tipo: CENTINELA_LUGAR.tipo,
  direccion: CENTINELA_LUGAR.direccion,
  barrio: CENTINELA_LUGAR.barrio,
  ciudad: CENTINELA_LUGAR.ciudad,
  geo: { lat: -34.6037, lng: -58.3816 },
  direccionPublica: true,
  capacidad: 37,
  capacidadNotas: CENTINELA_LUGAR.capacidadNotas,
  incluye: [CENTINELA_LUGAR.incluye],
  incluyeOtro: CENTINELA_LUGAR.incluyeOtro,
  condicion: CENTINELA_LUGAR.condicion,
  /*
   * `hora` y no un centinela: ver el docblock de arriba. El monto es un número
   * reconocible —24.681.357 formateado no aparece por casualidad— para que los
   * casos que verifican la frase por valor no dependan de un literal chico.
   */
  precio: { valor: { monto: 24681357, porUnidad: 'hora' }, cargadoEn: ts('2026-09-01T12:00:00Z') },
  condicionNotas: CENTINELA_LUGAR.condicionNotas,
  instagram: CENTINELA_LUGAR.instagram,
  whatsapp: CENTINELA_LUGAR.whatsapp,
  mail: CENTINELA_LUGAR.mail,
  web: CENTINELA_LUGAR.web,
  contactoDeQuienCargo: {
    via: 'mail',
    valor: CENTINELA_LUGAR['contactoDeQuienCargo.valor'],
  },
  estado: 'publicado',
  origen: 'formulario-publico',
  /*
   * ⚠️ **La dirección metida a mano en el índice de búsqueda**, que es la forma
   * exacta que tendría un documento escrito por un `curl` el día que el `create`
   * público se abra. El fixture lo trae adentro **a propósito**: es lo único que
   * hace que el caso «la proyección no copia el `searchText`» pruebe algo.
   */
  searchText: `centinela.searchtext.lugar ${CENTINELA_LUGAR.direccion}`,
  creadoEn: ts('2026-09-01T12:00:00Z'),
  revision: {
    porUid: CENTINELA_LUGAR['revision.porUid'],
    en: ts('2026-09-02T12:00:00Z'),
    motivo: CENTINELA_LUGAR['revision.motivo'],
  },
  publicadaAlgunaVez: true,
});

/**
 * **El mismo lugar, con la dirección apagada** — el caso del § 6 del PRD 4.
 *
 * Cambia **una sola cosa**: `direccionPublica: false`. El documento conserva la
 * dirección, la `geo` y hasta el tipo de lugar, así que este fixture es
 * exactamente lo que hace falta para que el barrido pruebe algo: si la proyección
 * publicara la dirección, acá la encontraría.
 *
 * ── Por qué NO cambia también el `tipo` a `'casa'` ────────────────────────
 * Porque la proyección **no mira el tipo: mira el flag**, y este fixture existe
 * para probar exactamente eso. Con `tipo: 'casa'` el barrido no podría distinguir
 * «la proyección respetó el flag» de «la proyección miró el tipo», que son dos
 * implementaciones distintas con consecuencias distintas: si mirara el tipo,
 * apagar el flag no alcanzaría para bajar una dirección a pedido, y cualquier
 * tipo nuevo tipeado con «Otro» —el vocabulario es abierto— se llevaría el
 * default permisivo.
 *
 * El tipo es lo que decide el **default** del flag, y eso vive en el formulario,
 * en `formALugar` y en `firestore.rules`; sus casos están en
 * `tests/lugares.test.ts` y en `tests/lugares.integracion.test.ts`.
 */
export const lugarCentinelaSinDireccion = (): Lugar => ({
  ...lugarCentinela(),
  direccionPublica: false,
});
