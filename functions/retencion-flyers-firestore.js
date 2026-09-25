/**
 * **Los flyers de `propuestas/`, contra Storage y Firestore** — B-871.
 *
 * La lectura del prefijo, las propuestas que nombran cada objeto y el borrado con
 * su relectura, con el `db` y el `bucket` inyectados. Sin `firebase-functions`,
 * por B-561 (M-13 del PRD 6).
 */
import {
  PREFIJO_PROPUESTAS,
  objetoDePropuesta,
} from './retencion-propuestas.js';
import {
  decidirFlyeresSinPlazo,
} from './retencion-flyers.js';

/**
 * Los objetos que hoy existen bajo `propuestas/`.
 *
 * `getFiles` con prefijo y no un listado del bucket entero: lo que este barrido
 * mira es un prefijo chico —los flyers de las propuestas abiertas más lo que
 * quedó colgado— y nunca la galería, que tiene su propio barrido.
 *
 * @returns {Promise<{ nombre: string, creado: number }[]>}
 */
export const flyeresDelBucket = async (bucket) => {
  const [objetos] = await bucket.getFiles({ prefix: PREFIJO_PROPUESTAS });
  return objetos.map((o) => ({
    nombre: o.name,
    // Mismo criterio que `objetosDelBucket` en el barrido de imágenes: si la
    // fecha no se puede leer, `NaN` y la decisión lo trata como recién subido.
    creado: Date.parse(o.metadata?.timeCreated ?? ''),
  }));
};

/** El techo de valores de un `where(…, 'in', …)` de Firestore. */
const MAXIMO_DEL_IN = 30;

/**
 * Las propuestas que nombran **alguno de estos objetos**, con **lo mínimo** para
 * decidir — B-871.
 *
 * ── Se entra por el bucket, y es lo que deja correrlo todos los días ──────
 * Hasta la salida 3 esto leía la colección `/propuestas` **entera** y por eso
 * corría solo a pedido: es la lectura que B-865 sacó del camino diario. Pero lo
 * que la decisión necesita no es la colección: es saber, **para cada objeto
 * vivo**, qué documentos lo nombran. Así que se buscan esos y nada más, de a 30
 * por `in` —el mismo camino que `aceptadasConOriginalVivo` (B-1370)—, y el costo
 * crece con los flyers vivos y no con el archivo histórico. La decisión es la
 * misma: un documento que no nombra ningún objeto vivo no cambiaba nada.
 *
 * Se leen **todos** los estados y no solo la aceptada: lo que hay que poder
 * distinguir es «este objeto lo borra la retención» de «este objeto no lo borra
 * nadie», y de «este objeto no lo nombra nadie», que ahora **se borra** — o sea
 * que un documento que la query no trajera convertiría su flyer en huérfano.
 *
 * El `select` es el de siempre y por el mismo motivo: el contacto de quien
 * propuso **no entra a la memoria** — ni `revision.motivo`, que es una nota
 * interna sobre el trabajo de otra persona, ni `revision.porUid`. **Las dos
 * fechas están en el `select` y no son opcionales**: sin `revision.en` ninguna
 * aceptada se podría fechar (y ninguna se borraría), y sin `creadoEn` la
 * retención diría que ninguna `nueva` se puede fechar. `updateTime` es metadata
 * y no afloja la máscara (B-864).
 *
 * @param {string[]} nombres — ya pasados por la guarda del prefijo.
 * @returns {Promise<{ id: string, estado: string, creadoEn: unknown, revision: unknown, imagen: unknown, updateTime: unknown }[]>}
 */
export const propuestasQueNombran = async (db, nombres) => {
  const leidas = [];
  for (let i = 0; i < nombres.length; i += MAXIMO_DEL_IN) {
    const snap = await db
      .collection('propuestas')
      .where('imagen.storagePath', 'in', nombres.slice(i, i + MAXIMO_DEL_IN))
      .select('estado', 'creadoEn', 'revision.en', 'imagen.storagePath')
      .get();
    for (const d of snap.docs) {
      leidas.push({
        id: d.id,
        estado: d.get('estado'),
        creadoEn: d.get('creadoEn'),
        revision: d.get('revision'),
        imagen: d.get('imagen'),
        updateTime: d.updateTime,
      });
    }
  }
  return leidas;
};

/**
 * La lectura completa y la decisión pura en el medio. Es lo que el informe del
 * script imprime **y** lo que la Function ejecuta — B-871.
 *
 * @returns {Promise<{
 *   aBorrar: { objeto: string, propuesta: string | null, visto: unknown, motivo: string }[],
 *   aRevisar: { objeto: string, propuesta: string | null, motivo: string }[],
 *   motivos: Record<string, string>,
 *   objetos: number,
 * }>}
 */
export const relevarFlyeresSinPlazo = async (db, bucket, { ahora = Date.now() } = {}) => {
  const objetos = await flyeresDelBucket(bucket);
  // Solo se preguntan los que la decisión va a mirar: los demás quedan
  // `fuera-del-alcance` sin importar quién los nombre.
  const nombres = objetos
    .map((o) => o.nombre)
    .filter((n) => objetoDePropuesta({ storagePath: n }) === n);
  const propuestas = await propuestasQueNombran(db, nombres);
  return { ...decidirFlyeresSinPlazo({ objetos, propuestas, ahora }), objetos: objetos.length };
};

/**
 * Borra **un** flyer que la decisión mandó a borrar, si sigue siendo el que se
 * decidió — B-871.
 *
 * ── Dos relecturas distintas, una por cada motivo ─────────────────────────
 * Entre la lectura y este `delete()` pasa la corrida entera, y cada caso tiene su
 * forma de dejar de ser cierto:
 *
 *  - **`aceptada-vencida`** — un admin **reabre** la propuesta, o la vuelve a
 *    aceptar (y le renueva el plazo). Se relee con `fieldMask: []` —`exists` y
 *    `updateTime`, cero campos: el contacto no entra— y se exige la versión que
 *    la lectura vio, como `borrarPropuesta` (B-864). Si el documento **ya no
 *    está**, el objeto quedó sin nadie que lo nombre y se sigue por el camino del
 *    huérfano.
 *  - **`sin-propuesta`** — llega el envío de `/proponer` que subió esa foto hace
 *    más de 72 horas. Se pregunta de nuevo si algún documento la nombra, con
 *    `select()` vacío: solo los ids.
 *
 * Storage no tiene precondición que ponerle a un `delete()` sin generación, así
 * que la ventana que queda es de un round-trip, igual que en la retención. El
 * peor caso está acotado: una propuesta que se reabre **justo** en ese
 * round-trip, pasados los 30 días de aceptada, se queda sin flyer.
 *
 * **La guarda del prefijo se vuelve a aplicar acá** aunque la decisión ya la
 * aplicó: esta función es exportada, corre con el Admin SDK sin pasar por las
 * reglas, y el próximo llamador puede no haber pasado por la decisión. Un path
 * fuera de `propuestas/<un segmento>` es un error de programación y tira — no se
 * clasifica, porque clasificarlo lo dejaría pasar como «uno que no se borró».
 *
 * ── Por qué no es la trampa 3 ni la 12 ────────────────────────────────────
 * Lo único que escribe es un `delete()` en Storage, que emite
 * `onObjectDeleted` —nada del proyecto lo escucha; `optimizarImagen` es
 * `onObjectFinalized`— y no toca ningún documento: ni el de la aceptada, que
 * sigue nombrando un `storagePath` que ya no existe, igual que después del
 * borrado de la transición.
 *
 * @param {{ objeto: string, propuesta: string | null, visto: unknown }} flyer
 * @returns {Promise<'borrado' | 'la-tocaron' | 'lo-nombran'>}
 */
export const borrarFlyer = async (db, bucket, { objeto, propuesta, visto }) => {
  if (objetoDePropuesta({ storagePath: objeto }) !== objeto) {
    throw new Error(
      `borrarFlyer(${objeto}) fuera de ${PREFIJO_PROPUESTAS}<un segmento>: este barrido ` +
        'no borra nada que no sea el flyer de una propuesta (B-871).',
    );
  }

  let huerfano = propuesta === null;
  if (!huerfano) {
    if (!visto) {
      // Falla ruidoso, como `borrarPropuesta`: sin la versión vista, esto se
      // lleva el flyer de una propuesta que un admin acaba de reabrir.
      throw new Error(
        `borrarFlyer(${objeto}) sin la versión vista de ${propuesta}: sin eso este borrado ` +
          'puede llevarse el flyer de una propuesta que un admin acaba de reabrir (B-871).',
      );
    }
    const [ahora] = await db.getAll(db.collection('propuestas').doc(propuesta), {
      fieldMask: [],
    });
    if (ahora.exists && !ahora.updateTime.isEqual(visto)) return 'la-tocaron';
    huerfano = !ahora.exists;
  }

  if (huerfano) {
    const nombrado = await db
      .collection('propuestas')
      .where('imagen.storagePath', '==', objeto)
      .select()
      .limit(1)
      .get();
    if (!nombrado.empty) return 'lo-nombran';
  }

  await bucket.file(objeto).delete({ ignoreNotFound: true });
  return 'borrado';
};
