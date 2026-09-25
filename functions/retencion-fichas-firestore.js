/**
 * **La retención de las fichas de la Guía, contra Firestore** — B-904, B-912,
 * B-917.
 *
 * La lectura paginada de las vencibles y el borrado con precondición, con el `db`
 * inyectado. Sin `firebase-functions`, por B-561 (M-13 del PRD 6).
 */
import {
  FALLO_DE_PRECONDICION,
} from './retencion-propuestas-firestore.js';
import {
  ESTADOS_DE_FICHA_QUE_CADUCAN,
  FICHAS_POR_PAGINA,
  MAX_FICHAS_POR_CORRIDA,
  RETENCION_DE_FICHA_POR_ESTADO,
  decidirRetencionDeFichas,
} from './retencion-fichas.js';

/**
 * Las fichas de una colección que **pueden** caducar, con lo mínimo para decidir.
 *
 * El `select()` no es una optimización: es lo que hace que el
 * `contactoDeQuienCargo` —el dato personal del tercero— **no entre a la memoria
 * de la Function** ni pueda caer en un log. Es el mismo cuidado que el `select`
 * de `propuestasVencibles`, y acá vale doble porque el documento además trae el
 * motivo del rechazo, que es una nota interna sobre el trabajo de otra persona.
 *
 * La paginación con cursor y el corte **por trabajo y no por cantidad leída**
 * son los de B-865: un `limit()` pelado sobre una query sin `orderBy` lee siempre
 * las mismas primeras N por id, así que una ficha vencida hace meses al final de
 * la colección no se encontraría nunca — y el plazo dejaría de cumplirse en
 * silencio.
 *
 * @returns {Promise<{ id: string, estado?: string, creadoEn?: unknown, revision?: unknown, updateTime?: unknown }[]>}
 */
export const fichasVencibles = async (
  db,
  coleccion,
  { ahora = Date.now(), plazos = RETENCION_DE_FICHA_POR_ESTADO } = {},
) => {
  // Un `in` vacío es un error de Firestore. Solo pasa si alguien pone toda la
  // tabla en `null`, que es «no borres nada».
  if (ESTADOS_DE_FICHA_QUE_CADUCAN.length === 0) return [];

  const base = db
    .collection(coleccion)
    .where('estado', 'in', ESTADOS_DE_FICHA_QUE_CADUCAN)
    .select('estado', 'creadoEn', 'revision.en');

  const leidas = [];
  let desde = null;
  for (;;) {
    const snap = await (desde ? base.startAfter(desde) : base).limit(FICHAS_POR_PAGINA).get();
    for (const d of snap.docs) {
      leidas.push({
        id: d.id,
        estado: d.get('estado'),
        creadoEn: d.get('creadoEn'),
        revision: d.get('revision'),
        // Metadata, no un campo: es la versión que **esta** corrida vio.
        updateTime: d.updateTime,
      });
    }

    if (snap.size < FICHAS_POR_PAGINA) return leidas;

    const { aBorrar } = decidirRetencionDeFichas({ fichas: leidas, ahora, plazos });
    if (aBorrar.length >= MAX_FICHAS_POR_CORRIDA) return leidas;

    desde = snap.docs[snap.size - 1];
  }
};

/**
 * Borra una ficha caducada: relectura de metadata, y el `delete` con
 * precondición.
 *
 * ── Las dos guardas de B-864, y acá alcanza con una ──────────────────────
 * La promesa es la misma: entre `fichasVencibles()` y esta línea pasan segundos,
 * y en esos segundos un admin puede reabrir una ficha descartada y ver el plazo
 * renovado. `delete({ lastUpdateTime })` compara y borra en la misma operación,
 * así que sobre el documento la garantía es atómica.
 *
 * Y a diferencia de `borrarPropuesta`, acá **no hay una segunda mitad sin
 * precondición**: no se borra ningún objeto de Storage (ver
 * `MARGEN_DE_RETENCION_FICHA_MS`), así que no existe el final `la-tocaron-tarde`
 * —la ficha rescatada en el último segundo se queda entera— ni la tensión de
 * orden que B-838 tuvo que resolver eligiendo cuál mitad perder.
 *
 * La relectura sí se queda, y con `fieldMask: []`: devuelve `exists` y
 * `updateTime` y **cero campos**, o sea que el contacto del tercero no entra a
 * memoria. Un `ref.get()` traería el documento entero, que es justo lo que el
 * `select` de la query existe para evitar.
 *
 * @returns {Promise<'borrada' | 'la-tocaron' | 'ya-no-esta'>}
 */
export const borrarFicha = async (db, coleccion, { id, visto }) => {
  if (!visto) {
    // Falla ruidoso y no cerrado, como `borrarPropuesta`: es un error de
    // programación del que llama —armó la lista sin pasar por
    // `fichasVencibles`— y sin la versión vista este borrado se lleva puesta una
    // ficha que un admin acaba de reabrir.
    throw new Error(
      `borrarFicha(${coleccion}/${id}) sin la versión vista: sin precondición este ` +
        'borrado puede llevarse una ficha que un admin acaba de tocar (B-864).',
    );
  }

  const ref = db.collection(coleccion).doc(id);
  const [ahora] = await db.getAll(ref, { fieldMask: [] });

  if (!ahora.exists) return 'ya-no-esta';
  if (!ahora.updateTime.isEqual(visto)) return 'la-tocaron';

  try {
    await ref.delete({ lastUpdateTime: visto });
  } catch (e) {
    // El código 9 no distingue «otra versión» de «ya no existe» — ver
    // `FALLO_DE_PRECONDICION`. Acá las dos salidas son benignas y la relectura
    // extra no aportaría nada que cambie una decisión: sin objeto que borrar, no
    // hay ninguna mitad que pueda haber quedado suelta.
    if (e?.code !== FALLO_DE_PRECONDICION) throw e;
    return 'la-tocaron';
  }
  return 'borrada';
};
