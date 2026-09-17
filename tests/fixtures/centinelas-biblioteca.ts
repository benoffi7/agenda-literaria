/**
 * Un documento de **biblioteca** donde cada string es un centinela — B-960,
 * sobre la forma de B-196.
 *
 * ── Por qué hace falta uno propio ─────────────────────────────────────────
 * `tests/fixtures/centinelas.ts` describe una **actividad** y el de al lado una
 * **librería**. Una biblioteca es otra colección, con otros campos y —lo que
 * importa— con **su propio dato personal de un tercero adentro**:
 * `contactoDeQuienCargo`, que convive en el mismo documento que los cuatro
 * contactos que sí son públicos. Esa convivencia es exactamente la condición
 * donde una proyección por spread filtra un campo, y es lo que este fixture
 * existe para que no pase sin que nada se ponga rojo.
 *
 * ── Las tres reglas de forma, y las tres son load-bearing ─────────────────
 * 1. **El valor dice la ruta**, así que el mensaje de falla nombra el campo que
 *    se escapó sin que haya que traducir nada.
 * 2. **Todos pasan la validación de su campo.** No es cosmético: `slug`,
 *    `tipo`, `barrio`, `instagram`, `whatsapp`, `web`, `catalogo` y `mail`
 *    tienen formato acotado en `firestore.rules` y en el schema, y la proyección
 *    **descarta lo que no sanea**. Un centinela con formato inválido saldría
 *    `null` y el barrido diría «dejó de publicarse» por el motivo equivocado —
 *    un rojo que se arregla aflojando la excepción, que es el peor final posible.
 * 3. **Ninguno es subcadena de otro**, ni de un valor de vocabulario cerrado.
 *
 * ── El centinela propio de esta colección ────────────────────────────────
 * `asociarse.costo.valor` es el único que **sale transformado y no verbatim**:
 * la proyección lo publica dentro de una frase con su fecha pegada
 * (`fraseConFecha`), así que el barrido lo encuentra igual —está adentro del
 * string— pero el aserto de «sale tal cual» no valdría. Está declarado como
 * excepción con ese motivo en `tests/biblioteca-publica.test.ts`.
 *
 * ── Lo que este fixture NO es ────────────────────────────────────────────
 * No es una biblioteca verosímil: es un documento donde todo es rastreable. La
 * verosimilitud vive en `tests/bibliotecas.integracion.test.ts`, que escribe
 * contra el emulador y por eso tiene que pasar la regla de verdad.
 */
import type { Biblioteca } from '@/types/biblioteca';
import { ts } from './tiempo';

/**
 * Cada ruta de **contenido** del documento.
 *
 * **Es la lista que hay que tocar al agregar un campo**, y no hace falta
 * acordarse: `tests/biblioteca-publica.test.ts` compara este fixture contra
 * `src/types/biblioteca.ts` y falla si falta una clave.
 */
const RUTAS = [
  // Identidad y texto.
  'nombre',
  'slug',
  'descripcion',
  'searchText',

  // Qué biblioteca es: slug de `/opciones/tipo-biblioteca`.
  'tipo',

  // Dónde queda. Público: es una institución, no la casa de nadie.
  'direccion',
  // Los dos horarios. PÚBLICOS: son lo que el directorio existe para contestar
  // después de la dirección, y no identifican a nadie.
  'horarios',
  'horarioDeSala',
  // Los tres de la geografía son slugs de taxonomía, como en una sede. Sus
  // centinelas son **su propio slug** por lo mismo que en el fixture de
  // actividad (`RUTAS_SLUG`): la proyección los normaliza, así que un centinela
  // con puntos y mayúsculas no sobreviviría y el barrido quedaría verde sin
  // afirmar nada.
  'provincia',
  'barrio',
  'ciudad',

  // Lo propio de esta entidad. El costo sale **adentro de una frase con fecha**,
  // no verbatim: ver el docblock de arriba.
  'asociarse.costo.valor',
  'catalogo',

  // La galería (D-125). `storagePath` es el handle interno y NO sale.
  'imagenes.id',
  'imagenes.url',
  'imagenes.epigrafe',
  'imagenes.textoAlternativo',
  'imagenes.storagePath',

  // Los cuatro contactos PÚBLICOS: salen a propósito, y ése es el punto de la ficha.
  'instagram',
  'whatsapp',
  'web',
  'mail',

  // ⚠️ INTERNO — el dato personal de un tercero.
  'contactoDeQuienCargo.valor',

  // El ciclo de vida: quién revisó y por qué descartó. Interno.
  'revision.porUid',
  'revision.motivo',
] as const;

export type RutaDeBiblioteca = (typeof RUTAS)[number];

/**
 * El valor de cada centinela.
 *
 * Los que llevan formato no pueden ser `CENTINELA.<ruta>` a secas (regla 2 de
 * arriba), así que se escriben a mano **conservando la ruta adentro**: el
 * mensaje de falla los sigue nombrando.
 */
export const CENTINELA_BIBLIOTECA = {
  nombre: 'CENTINELA.nombre',
  // Alfabeto de `slugify`: lo exige `firestore.rules` y lo exige `esSlugDeFicha`.
  slug: 'centinela-slug',
  descripcion: 'CENTINELA.descripcion',
  // Normalizado (§6): sin mayúsculas ni acentos, como lo deja `formABiblioteca`.
  searchText: 'centinela.searchtext',
  // Slug de `/opciones/tipo-biblioteca`.
  tipo: 'centinela-tipo',
  direccion: 'CENTINELA.direccion',
  horarios: 'CENTINELA.horarios',
  horarioDeSala: 'CENTINELA.horarioDeSala',
  provincia: 'centinela-provincia',
  barrio: 'centinela-barrio',
  ciudad: 'centinela-ciudad',
  // Texto libre: entra tal cual, y sale adentro de la frase con fecha.
  'asociarse.costo.valor': 'CENTINELA.asociarse.costo.valor',
  catalogo: 'https://centinela.catalogo.example/CENTINELA.catalogo',
  'imagenes.id': 'img_centinela_id',
  'imagenes.url': 'https://centinela.imagen.example/CENTINELA.imagenes.url.jpg',
  'imagenes.epigrafe': 'CENTINELA.imagenes.epigrafe',
  'imagenes.textoAlternativo': 'CENTINELA.imagenes.textoAlternativo',
  'imagenes.storagePath': 'imagenes/CENTINELA.imagenes.storagePath.jpg',
  // El alfabeto real de Instagram acepta el punto, así que el centinela entra tal cual.
  instagram: 'CENTINELA.instagram',
  // Solo dígitos: de acá sale un `wa.me/<digitos>`. Trece, dentro del 8–15 de la regla.
  whatsapp: '5491187654321',
  web: 'https://centinela.web.example/CENTINELA.web',
  mail: 'centinela.mail@example.com',
  'contactoDeQuienCargo.valor': 'CENTINELA.contactoDeQuienCargo.valor',
  'revision.porUid': 'CENTINELA.revision.porUid',
  'revision.motivo': 'CENTINELA.revision.motivo',
} as const satisfies Record<RutaDeBiblioteca, string>;

/** Todas las rutas, para recorrerlas en el barrido. */
export const RUTAS_BIBLIOTECA: readonly RutaDeBiblioteca[] = RUTAS;

/**
 * Los campos del documento que **no son texto**, con dónde se verifica cada uno.
 *
 * Misma disciplina que los otros dos fixtures: un booleano, un número o un
 * `Timestamp` no tienen dónde esconder contenido, así que se verifican **por
 * clave** y no por valor. La entrada existe para que un campo nuevo no pueda
 * entrar al modelo sin que alguien diga qué lo cubre.
 */
export const VALORES_NO_TEXTO_BIBLIOTECA: Record<string, string> = {
  geo: 'dos números de una institución. Público sin discusión; se verifica por clave en la proyección.',
  estado:
    'vocabulario cerrado de `ESTADOS_DIRECTORIO`. No sale: el JSON solo tiene publicadas, así que el campo no agrega nada.',
  origen:
    'vocabulario cerrado de `ORIGENES_BIBLIOTECA`. No sale: es ciclo de vida, y dice si la ficha la cargó la propia biblioteca.',
  creadoEn: 'un `Timestamp`. No sale; se verifica por clave en la proyección.',
  'asociarse.haceFalta':
    'booleano. **Sale a propósito**: es la respuesta a «¿hay que asociarse?», que es media ficha. Se verifica por clave.',
  'asociarse.costo.cargadoEn':
    'un `Timestamp`. Sale **formateado adentro de la frase** (`fraseConFecha`), nunca como campo: es la regla 1 de `datoConFecha.ts`.',
  'revision.en': 'un `Timestamp`. No sale: `revision` entera es interna.',
  'contactoDeQuienCargo.via':
    'vocabulario cerrado de `VIAS_CONTACTO_BIBLIOTECA`. No sale, porque el campo entero es interno.',
  'imagenes.origen':
    "vocabulario cerrado (`'externa' | 'propia'`): dice de dónde vino la imagen, no qué es.",
  'imagenes.portada':
    'booleano. No sale como campo: la proyección lo usa para **ordenar** y pone la portada primera.',
  'imagenes.ancho': 'número. Sale a propósito: es el `width` que reserva la caja de la imagen.',
  'imagenes.alto': 'número. Ídem `ancho`.',
  publicadaAlgunaVez:
    'booleano pegajoso de la trampa 10. No sale: es el candado del slug, no un dato de la ficha.',
};

/** Una biblioteca publicada donde cada string es rastreable. */
export const bibliotecaCentinela = (): Biblioteca => ({
  nombre: CENTINELA_BIBLIOTECA.nombre,
  slug: CENTINELA_BIBLIOTECA.slug,
  descripcion: CENTINELA_BIBLIOTECA.descripcion,
  tipo: CENTINELA_BIBLIOTECA.tipo,
  imagenes: [
    {
      id: CENTINELA_BIBLIOTECA['imagenes.id'],
      url: CENTINELA_BIBLIOTECA['imagenes.url'],
      epigrafe: CENTINELA_BIBLIOTECA['imagenes.epigrafe'],
      textoAlternativo: CENTINELA_BIBLIOTECA['imagenes.textoAlternativo'],
      origen: 'propia',
      storagePath: CENTINELA_BIBLIOTECA['imagenes.storagePath'],
      ancho: 1200,
      alto: 800,
      portada: true,
    },
  ],
  direccion: CENTINELA_BIBLIOTECA.direccion,
  horarios: CENTINELA_BIBLIOTECA.horarios,
  horarioDeSala: CENTINELA_BIBLIOTECA.horarioDeSala,
  asociarse: {
    haceFalta: true,
    costo: {
      valor: CENTINELA_BIBLIOTECA['asociarse.costo.valor'],
      cargadoEn: ts('2026-09-01T12:00:00Z'),
    },
  },
  catalogo: CENTINELA_BIBLIOTECA.catalogo,
  provincia: CENTINELA_BIBLIOTECA.provincia,
  barrio: CENTINELA_BIBLIOTECA.barrio,
  ciudad: CENTINELA_BIBLIOTECA.ciudad,
  geo: { lat: -34.6, lng: -58.43 },
  instagram: CENTINELA_BIBLIOTECA.instagram,
  whatsapp: CENTINELA_BIBLIOTECA.whatsapp,
  web: CENTINELA_BIBLIOTECA.web,
  mail: CENTINELA_BIBLIOTECA.mail,
  contactoDeQuienCargo: {
    via: 'mail',
    valor: CENTINELA_BIBLIOTECA['contactoDeQuienCargo.valor'],
  },
  estado: 'publicado',
  origen: 'formulario-publico',
  searchText: CENTINELA_BIBLIOTECA.searchText,
  creadoEn: ts('2026-09-01T12:00:00Z'),
  revision: {
    porUid: CENTINELA_BIBLIOTECA['revision.porUid'],
    en: ts('2026-09-02T12:00:00Z'),
    motivo: CENTINELA_BIBLIOTECA['revision.motivo'],
  },
  publicadaAlgunaVez: true,
});
