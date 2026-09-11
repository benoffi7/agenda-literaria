/**
 * Un documento de **librería** donde cada string es un centinela — B-901, sobre
 * la forma de B-196.
 *
 * ── Por qué hace falta uno propio ─────────────────────────────────────────
 * `tests/fixtures/centinelas.ts` describe una **actividad**, y el barrido de
 * `tests/fixtures/barrido.ts` recorre sus rutas. Una librería es otra colección,
 * con otros campos y —lo que importa— con **su propio dato personal de un
 * tercero adentro**: `contactoDeQuienCargo`, que convive en el mismo documento
 * que los cuatro contactos que sí son públicos. Esa convivencia es exactamente
 * la condición donde una proyección por spread filtra un campo (§ 8 del PRD 2),
 * y es lo que este fixture existe para que no pase sin que nada se ponga rojo.
 *
 * ── Las tres reglas de forma, y las tres son load-bearing ─────────────────
 * 1. **El valor dice la ruta**, así que el mensaje de falla nombra el campo que
 *    se escapó sin que haya que traducir nada.
 * 2. **Todos pasan la validación de su campo.** No es cosmético: `slug`,
 *    `barrio`, `instagram`, `whatsapp`, `web` y `mail` tienen formato acotado en
 *    `firestore.rules` y en el schema, y la proyección **descarta lo que no
 *    sanea**. Un centinela con formato inválido saldría `null` y el barrido
 *    diría «dejó de publicarse» por el motivo equivocado — un rojo que se
 *    arregla aflojando la excepción, que es el peor final posible.
 * 3. **Ninguno es subcadena de otro**, ni de un valor de vocabulario cerrado.
 *
 * ── Lo que este fixture NO es ────────────────────────────────────────────
 * No es una librería verosímil: es un documento donde todo es rastreable. La
 * verosimilitud vive en `tests/librerias.integracion.test.ts`, que escribe contra
 * el emulador y por eso tiene que pasar la regla de verdad.
 */
import type { Libreria } from '@/types/libreria';
import { ts } from './tiempo';

/**
 * Cada ruta de **contenido** del documento.
 *
 * **Es la lista que hay que tocar al agregar un campo**, y no hace falta
 * acordarse: `tests/libreria-publica.test.ts` compara este fixture contra
 * `src/types/libreria.ts` y falla si falta una clave.
 */
const RUTAS = [
  // Identidad y texto.
  'nombre',
  'slug',
  'descripcion',
  'searchText',

  // Dónde queda. Público: es un local comercial (§ 8 del PRD).
  'direccion',
  'barrio',
  'ciudad',

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

  // ⚠️ INTERNO — el segundo dato personal de un tercero que guarda el proyecto.
  'contactoDeQuienCargo.valor',

  // El ciclo de vida: quién revisó y por qué descartó. Interno.
  'revision.porUid',
  'revision.motivo',
] as const;

export type RutaDeLibreria = (typeof RUTAS)[number];

/**
 * El valor de cada centinela.
 *
 * Los que llevan formato no pueden ser `CENTINELA.<ruta>` a secas (regla 2 de
 * arriba), así que se escriben a mano **conservando la ruta adentro**: el
 * mensaje de falla los sigue nombrando.
 */
export const CENTINELA_LIBRERIA = {
  nombre: 'CENTINELA.nombre',
  // Alfabeto de `slugify`: lo exige `firestore.rules` y lo exige `esSlugDeFicha`.
  slug: 'centinela-slug',
  descripcion: 'CENTINELA.descripcion',
  // Normalizado (§6): sin mayúsculas ni acentos, como lo deja `formALibreria`.
  searchText: 'centinela.searchtext',
  direccion: 'CENTINELA.direccion',
  // Slug de `/opciones/barrio`, el mismo que usan las actividades.
  barrio: 'centinela-barrio',
  ciudad: 'CENTINELA.ciudad',
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
} as const satisfies Record<RutaDeLibreria, string>;

/** Todas las rutas, para recorrerlas en el barrido. */
export const RUTAS_LIBRERIA: readonly RutaDeLibreria[] = RUTAS;

/**
 * Los campos del documento que **no son texto**, con dónde se verifica cada uno.
 *
 * Misma disciplina que `VALORES_NO_TEXTO` del fixture de actividad: un booleano,
 * un número o un `Timestamp` no tienen dónde esconder contenido, así que se
 * verifican **por clave** y no por valor. La entrada existe para que un campo
 * nuevo no pueda entrar al modelo sin que alguien diga qué lo cubre.
 */
export const VALORES_NO_TEXTO_LIBRERIA: Record<string, string> = {
  geo: 'dos números de un local comercial. Público sin discusión (§ 8 del PRD); se verifica por clave en la proyección.',
  estado:
    'vocabulario cerrado de `ESTADOS_DIRECTORIO`. No sale: el JSON solo tiene publicadas, así que el campo no agrega nada.',
  origen:
    'vocabulario cerrado de `ORIGENES_LIBRERIA`. No sale: es ciclo de vida, y dice si la ficha la cargó la propia librería.',
  creadoEn: 'un `Timestamp`. No sale; se verifica por clave en la proyección.',
  'revision.en': 'un `Timestamp`. No sale: `revision` entera es interna.',
  'contactoDeQuienCargo.via':
    'vocabulario cerrado de `VIAS_CONTACTO_LIBRERIA`. No sale, porque el campo entero es interno.',
  'imagenes.origen': "vocabulario cerrado (`'externa' | 'propia'`): dice de dónde vino la imagen, no qué es.",
  'imagenes.portada': 'booleano. No sale como campo: la proyección lo usa para **ordenar** y pone la portada primera.',
  'imagenes.ancho': 'número. Sale a propósito: es el `width` que reserva la caja de la imagen.',
  'imagenes.alto': 'número. Ídem `ancho`.',
  publicadaAlgunaVez:
    'booleano pegajoso de la trampa 10. No sale: es el candado del slug, no un dato de la ficha.',
};

/** Una librería publicada donde cada string es rastreable. */
export const libreriaCentinela = (): Libreria => ({
  nombre: CENTINELA_LIBRERIA.nombre,
  slug: CENTINELA_LIBRERIA.slug,
  descripcion: CENTINELA_LIBRERIA.descripcion,
  imagenes: [
    {
      id: CENTINELA_LIBRERIA['imagenes.id'],
      url: CENTINELA_LIBRERIA['imagenes.url'],
      epigrafe: CENTINELA_LIBRERIA['imagenes.epigrafe'],
      textoAlternativo: CENTINELA_LIBRERIA['imagenes.textoAlternativo'],
      origen: 'propia',
      storagePath: CENTINELA_LIBRERIA['imagenes.storagePath'],
      ancho: 1200,
      alto: 800,
      portada: true,
    },
  ],
  direccion: CENTINELA_LIBRERIA.direccion,
  barrio: CENTINELA_LIBRERIA.barrio,
  ciudad: CENTINELA_LIBRERIA.ciudad,
  geo: { lat: -34.6, lng: -58.43 },
  instagram: CENTINELA_LIBRERIA.instagram,
  whatsapp: CENTINELA_LIBRERIA.whatsapp,
  web: CENTINELA_LIBRERIA.web,
  mail: CENTINELA_LIBRERIA.mail,
  contactoDeQuienCargo: {
    via: 'mail',
    valor: CENTINELA_LIBRERIA['contactoDeQuienCargo.valor'],
  },
  estado: 'publicado',
  origen: 'formulario-publico',
  searchText: CENTINELA_LIBRERIA.searchText,
  creadoEn: ts('2026-09-01T12:00:00Z'),
  revision: {
    porUid: CENTINELA_LIBRERIA['revision.porUid'],
    en: ts('2026-09-02T12:00:00Z'),
    motivo: CENTINELA_LIBRERIA['revision.motivo'],
  },
  publicadaAlgunaVez: true,
});
