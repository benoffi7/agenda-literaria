/**
 * B-221 — decide qué objetos de `imagenes/` y `miniaturas/` están huérfanos:
 * ya no los referencia ninguna actividad **ni ninguna versión de su historial**
 * (B-560), y no son recientes.
 *
 * **Todo lo de acá es puro**: entran datos ya leídos (los objetos del bucket,
 * los `storagePath` que las actividades referencian), sale una decisión. No
 * importa `firebase-admin`, no toca Storage ni Firestore. El pegamento vive en
 * `imagenes-limpieza-trigger.js` — mismo corte que `imagenes.js` /
 * `imagenes-trigger.js`: **lo que decide se puede probar**.
 *
 * La excepción del "puro" es `referenciasEnUso`, que recibe el `db` y no importa
 * `firebase-admin` — mismo criterio que `subcoleccionesHuerfanas` en
 * `limpieza-versiones.js`, y por el mismo motivo práctico (B-561). Su docblock
 * tiene el porqué de B-560 y lo que cuesta por corrida.
 *
 * ── Por qué esto NO es la trampa 12, y hay que poder decirlo con un test ───
 * La trampa (§13 punto 12) es un trigger que **escribe** donde lo disparó y
 * se dispara a sí mismo. Acá no hay ningún riesgo de loop, y no por una
 * guarda sino por la forma del disparador: este barrido corre por
 * `onSchedule` (un reloj, no un evento del bucket) y lo único que hace sobre
 * el bucket es **borrar**. `onObjectFinalized` —el trigger que sí escucha
 * este bucket, en `imagenes-trigger.js`— se dispara con la creación o la
 * sobreescritura de un objeto; un `delete()` no dispara `onObjectFinalized`,
 * dispara `onObjectDeleted`, al que nada de este proyecto está suscripto. Sin
 * un segundo trigger escuchando el borrado, no hay con qué encadenarse.
 *
 * ── El margen de gracia, y por qué depende de la fecha de creación ─────────
 * Sin margen, subir una imagen y no llegar a guardar la actividad (o guardarla
 * unos minutos después, mientras el barrido corre en el medio) la borraría:
 * en el momento de la subida el objeto existe en el bucket y ninguna
 * actividad todavía lo referencia. `MARGEN_DE_GRACIA_MS` hace que un
 * objeto reciente, aunque hoy no esté referenciado, no se toque — le da
 * tiempo a que su actividad se guarde.
 *
 * Está probado en `tests/limpieza-imagenes.test.ts`.
 */
import { PREFIJO_MINIATURAS, PREFIJO_ORIGINALES, rutaDeMiniatura } from './imagenes.js';

/**
 * 72 horas. Bastante para cubrir un formulario dejado a medias durante un fin
 * de semana largo, chico contra la escala de "el bucket crece al doble de
 * velocidad" que B-221 describe — no hace falta más para que el barrido no
 * corra contra objetos que todavía se están guardando.
 */
export const MARGEN_DE_GRACIA_MS = 72 * 60 * 60 * 1000;

/**
 * Tope de borrados por corrida. Es la misma clase de salvaguarda que
 * `MAX_EVENTOS_RESYNC` en `opciones-trigger.js` (B-04): un bug en `referenciados` —una
 * lectura de Firestore que vino vacía, por ejemplo— no puede vaciar el bucket
 * entero en una sola pasada. Lo que sobra queda para la corrida de mañana, y
 * lo dice el log.
 */
export const MAX_BORRADOS_POR_CORRIDA = 20;

/** ¿Este nombre es un objeto de primer nivel bajo ese prefijo? Mismo criterio
 * que `decidirOptimizacion` de `imagenes.js`: un solo segmento.
 *
 * **Exportado desde B-863** para que el test pueda atarlo a los otros dos
 * lugares donde el proyecto decide lo mismo —`objetoDePropuesta` en
 * `retencion.js` y `copiasEnLaGaleria` en `propuestas.js`—. No se unifica el
 * código, que devuelve cosas distintas en cada uno: se ata el **criterio**, que
 * es lo que puede divergir en silencio (clase de B-88, lo vio el
 * `auditor-trampas`). Nadie más lo importa en producción. */
export const esDePrimerNivel = (nombre, prefijo) =>
  nombre.startsWith(prefijo) && !nombre.slice(prefijo.length).includes('/') && nombre !== prefijo;

/**
 * ¿Qué objetos hay que borrar?
 *
 * @param {{
 *   objetos?: { nombre: string, creado?: number }[],
 *   referenciados?: Set<string> | string[],
 *   ahora?: number,
 * }} _
 * @returns {{
 *   aBorrar: string[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirLimpieza = ({ objetos = [], referenciados = new Set(), ahora = Date.now() } = {}) => {
  const refs = referenciados instanceof Set ? referenciados : new Set(referenciados);

  // La miniatura de un original referenciado sobrevive aunque nadie la
  // nombre en ningún documento: es derivada, no se guarda en ningún lado
  // (D-175), así que su "referencia" es la de su original.
  const miniaturasReferenciadas = new Set(
    [...refs].map((storagePath) => rutaDeMiniatura(storagePath)).filter(Boolean),
  );

  const aBorrar = [];
  const motivos = {};

  for (const objeto of objetos) {
    const nombre = objeto.nombre ?? '';
    const esOriginal = esDePrimerNivel(nombre, PREFIJO_ORIGINALES);
    const esMiniatura = esDePrimerNivel(nombre, PREFIJO_MINIATURAS);

    if (!esOriginal && !esMiniatura) {
      // Fuera del alcance de este barrido: no tocamos lo que no entendemos
      // (mismo criterio que `decidirOptimizacion`), ni objetos anidados.
      motivos[nombre] = 'fuera-del-alcance';
      continue;
    }

    const referenciado = esOriginal ? refs.has(nombre) : miniaturasReferenciadas.has(nombre);
    if (referenciado) {
      motivos[nombre] = 'referenciado';
      continue;
    }

    if (!Number.isFinite(objeto.creado) || ahora - objeto.creado < MARGEN_DE_GRACIA_MS) {
      // Falla cerrado: sin fecha de creación legible, se trata como "muy
      // reciente" y no se borra. Mismo criterio que `convieneReemplazar` ante
      // un dato que no entendemos.
      motivos[nombre] = 'dentro-del-margen-de-gracia';
      continue;
    }

    motivos[nombre] = esOriginal ? 'original-huerfano' : 'miniatura-huerfana';
    aBorrar.push(nombre);
  }

  if (aBorrar.length <= MAX_BORRADOS_POR_CORRIDA) {
    return { aBorrar, motivos };
  }

  // El tope corta la lista, pero los motivos de TODO lo revisado quedan —así
  // el log dice qué se salteó por el tope y no solo qué se borró.
  const recortado = aBorrar.slice(0, MAX_BORRADOS_POR_CORRIDA);
  for (const nombre of aBorrar.slice(MAX_BORRADOS_POR_CORRIDA)) {
    motivos[nombre] = `${motivos[nombre]}-pendiente-por-tope`;
  }
  return { aBorrar: recortado, motivos };
};


/**
 * La subcolección del §12: el historial de versiones de una actividad. Es la
 * única que cuelga de una actividad, y el nombre está acá y no literal en la
 * query porque `limpieza-versiones.js` tiene la misma constante para lo suyo.
 */
const SUBCOLECCION_VERSIONES = 'versiones';

/**
 * El único campo de una versión que este barrido necesita.
 *
 * `documento` es el `before` **entero** de la actividad (D-41): sin este
 * `select` la Function tendría en memoria una copia completa de cada versión de
 * cada actividad —`online.url`, `difusion`, `createdBy`— para leerle un array de
 * paths. Es el mismo cuidado que el `select('imagenes')` de las vivas (§5.1), y
 * acá pesa más, porque las versiones son veinte veces más.
 */
const CAMPO_IMAGENES_DE_VERSION = 'documento.imagenes';

/** Suma a `destino` los `storagePath` de una lista de imágenes, si los tiene. */
const sumarStoragePaths = (destino, imagenes) => {
  for (const imagen of imagenes ?? []) {
    // Una imagen externa (DEC-7c) no tiene `storagePath`: no hay objeto de
    // Storage que le corresponda, así que no tiene nada que hacer acá.
    if (imagen?.storagePath) destino.add(imagen.storagePath);
  }
};

/**
 * Los `storagePath` que **alguna** actividad referencia hoy, de cualquier
 * estado — y también los que referencia su **historial**.
 *
 * Recibe el `db` (no importa `firebase-admin`), así que vive acá, en el módulo
 * puro, y el test lo importa de acá y no del trigger — que arrastra
 * `firebase-functions/scheduler`, ausente en el `node_modules` de la raíz (B-561).
 *
 * ── B-560: por qué el historial también cuenta ────────────────────────────
 * Hasta acá se leían solo los documentos **en vivo**, que es exactamente lo que
 * B-221 pedía, y eso le puso una fecha de vencimiento silenciosa a la función de
 * restaurar del §12: se saca una fila de la galería y se guarda → la imagen
 * queda huérfana → 72 horas después el barrido la borra → alguien restaura esa
 * versión desde el historial y la fila vuelve con una `url` que da 404. La
 * versión guarda el `before` **entero** (D-41), `imagenes` incluido, así que era
 * este barrido pisando el insumo de otra feature.
 *
 * **Una versión que nombra un `storagePath` es una referencia tan buena como la
 * de una actividad viva**: mientras esa versión exista, restaurarla puede traer
 * la imagen de vuelta. Por eso entra al mismo Set y no a una lista aparte —
 * `decidirLimpieza` no se entera de que el historial existe, y las miniaturas
 * siguen sobreviviendo por derivación de su original, sin tocar nada.
 *
 * ── De paso, arregla el rescate del borrado (B-41) ────────────────────────
 * Al borrar una actividad, `guardarVersionAlBorrar` deja la única copia de la
 * que se la puede recuperar entera, y `limpieza-versiones.js` le da 30 días de
 * rescate. Pero sus imágenes se iban a las 72 horas, así que el rescate
 * devolvía la actividad con la galería rota. Ahora la subcolección huérfana
 * sostiene sus imágenes exactamente el mismo tiempo que se sostiene a sí misma:
 * los dos barridos se destraban en el orden correcto — primero B-89 suelta las
 * versiones, y recién la corrida siguiente de éste suelta las imágenes.
 *
 * ── Qué cuesta por corrida, y por qué es aceptable ────────────────────────
 * Una lectura por versión, además de la que ya había por actividad. Es **una
 * sola query** (`collectionGroup`) y no N: recorrer las subcolecciones de a una,
 * como hace `versiones-limpieza-trigger.js`, serían N round-trips, y ahí hace
 * falta porque se necesita saber de **qué** actividad es cada versión. Acá no:
 * solo interesa el conjunto de paths. El `collectionGroup` es además lo que hace
 * visibles las subcolecciones **huérfanas** —una query sobre `/actividades` no
 * las ve, por eso `subcoleccionesHuerfanas` necesita `listDocuments()`—, que es
 * justo el caso del párrafo anterior.
 *
 * Y no crece sin tope, que era la objeción del ítem: la retención de D-42 corta
 * en `MAX_VERSIONES = 20` por actividad, y las subcolecciones huérfanas las
 * purga `limpiarVersionesHuerfanas` (B-89) a los 30 días. O sea ≤ 21 lecturas
 * por actividad, una vez cada 24 horas: con mil actividades editadas veinte
 * veces cada una son ~21k lecturas diarias, abajo de las 50k del tramo gratuito.
 * Si algún día no alcanzara, lo que hay que acotar es la retención de versiones,
 * no esta lectura: **leer de menos acá borra archivos**. Por eso tampoco hay
 * tope de lectura ni paginado con corte — el tope está del otro lado, en
 * `MAX_BORRADOS_POR_CORRIDA`, que es donde recortar no pierde nada.
 *
 * ── El precio, dicho: una imagen sacada a propósito vive más ──────────────
 * La otra objeción del ítem, y es cierta: quitar una fila de la galería ya no
 * libera el objeto a las 72 horas, sino recién cuando se va la última versión
 * que la nombra. No es "para siempre" —D-42 y B-89 la acotan—, pero para una
 * actividad que no se vuelve a editar puede ser mucho. Se elige igual: el costo
 * es un objeto de unos KB (B-221: "sigue costando centavos") y lo que compra es
 * que restaurar una versión nunca devuelva una imagen rota.
 */
export const referenciasEnUso = async (db) => {
  const referenciados = new Set();

  const [vivas, versiones] = await Promise.all([
    db.collection('actividades').select('imagenes').get(),
    db.collectionGroup(SUBCOLECCION_VERSIONES).select(CAMPO_IMAGENES_DE_VERSION).get(),
  ]);

  for (const doc of vivas.docs) sumarStoragePaths(referenciados, doc.data().imagenes);
  // El `select` de un campo anidado conserva el anidado: llega
  // `{ documento: { imagenes: [...] } }`, no `{ 'documento.imagenes': [...] }`.
  for (const doc of versiones.docs) {
    sumarStoragePaths(referenciados, doc.data()?.documento?.imagenes);
  }

  return referenciados;
};
