/**
 * B-221 — decide qué objetos de `imagenes/` y `miniaturas/` están huérfanos:
 * ya no los referencia ninguna actividad, y no son recientes.
 *
 * **Todo lo de acá es puro**: entran datos ya leídos (los objetos del bucket,
 * los `storagePath` que las actividades referencian), sale una decisión. No
 * importa `firebase-admin`, no toca Storage ni Firestore. El pegamento vive en
 * `imagenes-limpieza-trigger.js` — mismo corte que `imagenes.js` /
 * `imagenes-trigger.js`: **lo que decide se puede probar**.
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
 * que `decidirOptimizacion` de `imagenes.js`: un solo segmento. */
const esDePrimerNivel = (nombre, prefijo) =>
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
 * Los `storagePath` que **alguna** actividad referencia hoy, de cualquier estado.
 * Recibe el `db` (no importa `firebase-admin`), así que vive acá, en el módulo
 * puro, y el test lo importa de acá y no del trigger — que arrastra
 * `firebase-functions/scheduler`, ausente en el `node_modules` de la raíz (B-561).
 */
export const referenciasEnUso = async (db) => {
  const referenciados = new Set();
  const snap = await db.collection('actividades').select('imagenes').get();
  for (const doc of snap.docs) {
    for (const imagen of doc.data().imagenes ?? []) {
      if (imagen?.storagePath) referenciados.add(imagen.storagePath);
    }
  }
  return referenciados;
};
