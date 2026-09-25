/**
 * **Los flyers de `propuestas/` que la retención no alcanza, la decisión pura** —
 * B-871 (D-1160, D-1161).
 *
 * Qué original de una aceptada vence y qué objeto no nombra nadie. No recibe `db`
 * ni `bucket`: la lectura del bucket y el borrado viven en
 * `retencion-flyers-firestore.js` (M-13 del PRD 6).
 */
import { milisDe } from './calendario.js';
import {
  RETENCION_POR_ESTADO,
  objetoDePropuesta,
  relojDeRetencion,
} from './retencion-propuestas.js';

/**
 * Los estados cuyo **documento** no vence, derivados de la tabla — B-871.
 *
 * Es el complemento exacto de `ESTADOS_QUE_CADUCAN` y se deriva por el mismo
 * motivo: hoy es `['aceptada']` y el día que alguien le ponga un número, esta
 * lista queda vacía sola. Una segunda lista escrita a mano sería la que quedaría
 * vieja.
 *
 * **Habla del documento y no del flyer**, y desde la salida 3 de B-871 la
 * diferencia importa: la `aceptada` sigue sin vencer —el contacto sirve para
 * repreguntar por una actividad publicada—, pero su **foto original** sí tiene
 * plazo (`MARGEN_DEL_ORIGINAL_ACEPTADO_MS`).
 */
export const ESTADOS_SIN_PLAZO = Object.entries(RETENCION_POR_ESTADO)
  .filter(([, plazo]) => plazo === null)
  .map(([estado]) => estado);

/**
 * El estado cuyo flyer original tiene un plazo propio aunque el documento no lo
 * tenga — B-871. Es el nombre que `decidirBorradoDeImagen` y
 * `clasificarAceptadas` (`propuestas.js`) ya usan para el mismo estado.
 */
export const ESTADO_ACEPTADO = 'aceptada';

/**
 * **30 días desde que se aceptó**, y después el flyer original se va — B-871,
 * contestado por el dueño el 2026-09-25 (**D-1160**).
 *
 * ── Qué original es éste ──────────────────────────────────────────────────
 * El que `borrarImagenAlCerrar` **no** borró en la transición a `aceptada`: o
 * porque no había copia verificada en la galería (`sin-copia`,
 * `copia-sin-objeto`, `sin-actividad` — conservarlo fue lo correcto en ese
 * momento), o porque el borrado falló, o porque la propuesta ya estaba aceptada
 * antes del deploy y la transición no existió. Hasta B-871 esa foto de un
 * tercero se quedaba **para siempre**, porque la `aceptada` no vence y ningún
 * barrido recorría `propuestas/`.
 *
 * La respuesta del dueño es que **conservar a propósito no es conservar para
 * siempre**: los 30 días son el margen para decidir si la foto se usa —subirla a
 * la actividad desde el panel, y entonces la borra antes B-1370 con la copia
 * verificada— y después el original se va aunque la actividad siga sin imagen.
 * O sea que en el caso `sin-copia` **se acepta perder la foto** pasado el plazo.
 * Es la mitad de la decisión que no era técnica.
 *
 * ── Da el mismo número que `MARGEN_DE_RETENCION_MS`, y son dos constantes ──
 * El dueño lo dijo como «el mismo plazo que la rechazada», y va igual escrito
 * aparte, por el criterio de `MARGEN_SIN_TOCAR_MS`: aquél es cuánto se guarda
 * **el documento** de una rechazada —el margen de un «la rechacé sin querer»—;
 * éste es cuánto se guarda **una foto** cuya propuesta ya se cerró bien. El día
 * que el dueño alargue el margen de arrepentimiento, eso no dice nada sobre
 * cuánto tiempo se queda la foto de un tercero después de aceptarla.
 * `tests/retencion.test.ts` tiene el aserto sobre el fuente.
 *
 * **Se cuenta desde `revision.en`**, que es cuándo se aceptó: el panel lo
 * escribe en todo movimiento de estado, así que para una `aceptada` es el
 * momento de la última aceptación. Sin fecha legible **no se borra**: falla
 * cerrado, como la rechazada (ver `relojDeAceptacion`).
 */
export const MARGEN_DEL_ORIGINAL_ACEPTADO_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tope de flyers borrados por corrida — B-871. Misma salvaguarda que
 * `MAX_PROPUESTAS_POR_CORRIDA` y `MAX_ORIGINALES_POR_CORRIDA`: una fecha mal
 * leída o un cruce que empate mal no puede vaciar el prefijo en una pasada. Lo
 * que sobra queda marcado `-pendiente-por-tope` y va mañana.
 */
export const MAX_FLYERES_POR_CORRIDA = 50;

/**
 * Cuánto se le perdona a un objeto de `propuestas/` que todavía no tenga
 * documento — B-871.
 *
 * **No es el mismo caso que `MARGEN_DE_GRACIA_MS` de `limpieza-imagenes.js`
 * aunque dé el mismo número**, y va aparte por el mismo criterio con el que
 * `MARGEN_SIN_TOCAR_MS` no se escribe en términos de `MARGEN_DE_RETENCION_MS`:
 * son dos decisiones que hoy coinciden. Allá el margen cubre «el admin subió la
 * imagen y todavía no guardó la actividad»; acá cubre algo peor de mirar, que es
 * cómo está escrito `/proponer`: el flyer se sube **al elegir el archivo** y el
 * documento se escribe **al enviar** (`FormularioPublico`), así que entre las dos
 * cosas hay todo el tiempo que la persona tarde en terminar el formulario. Un
 * objeto sin documento en esa ventana es el estado normal y no un huérfano.
 *
 * **Desde la salida 3 de B-871 este margen protege un borrado** —el docblock
 * anterior avisaba que ese día había que volver a mirarlo, y se miró—: es la
 * única red del caso `sin-propuesta`, que ahora se borra. 72 horas siguen
 * sobrando: nadie deja el formulario de `/proponer` abierto tres días, y si lo
 * hiciera, lo peor es que su propuesta llegue sin flyer. La relectura de
 * `borrarFlyer` achica además la carrera con un envío que llega justo en el
 * medio de la corrida.
 */
export const MARGEN_DEL_FLYER_EN_VUELO_MS = 72 * 60 * 60 * 1000;

/**
 * **Cuándo se aceptó esta propuesta**, en ms. `null` si no es una `aceptada` o
 * si no hay fecha legible — B-871.
 *
 * Es `revision.en` y **nada más**, sin caer a `creadoEn`: el plazo es de la
 * aceptación, y contar desde la llegada sería otro plazo decidido por
 * accidente. Es el mismo corte que `relojDeRetencion` hace con la rechazada, y
 * no se reusa esa función porque su vocabulario (`rechazo`, `ultimo-toque`,
 * `llegada`) nombraría mal lo que se está contando.
 */
export const relojDeAceptacion = (p) =>
  p?.estado === ESTADO_ACEPTADO ? milisDe(p?.revision?.en) : null;

/**
 * **Qué hacer con cada flyer de `propuestas/`**: borrarlo, pedir a alguien, o
 * nada porque otro barrido lo cubre — B-871.
 *
 * El nombre es de cuando esto solo **relevaba** («qué flyer no tiene plazo»), y
 * se conserva porque es la misma decisión, ampliada: desde la salida 3 los dos
 * casos que antes iban a la lista para un humano tienen ahora quien los borre.
 * La usan **la Function y el script**, que es lo que el ítem pedía: el informe
 * en seco dice exactamente lo que la corrida diaria va a hacer.
 *
 * ── Qué agujero tapa ──────────────────────────────────────────────────────
 * El borrado del original de una propuesta **aceptada** ocurre una sola vez, en
 * la transición a `aceptada` (`borrarImagenAlCerrar`), y debajo no había nada:
 * la `aceptada` no vence (`RETENCION_POR_ESTADO`) y `limpiarImagenesHuerfanas`
 * solo recorre `imagenes/` y `miniaturas/`. Si ese borrado no ocurría —falló, o
 * la decisión fue **no** borrar porque no había copia verificada— la foto de un
 * tercero se quedaba ahí para siempre. Y hay un séptimo camino que ni siquiera
 * emite el `warn`: una propuesta que ya estaba en `aceptada` antes del deploy
 * nunca dispara la transición.
 *
 * Esta función mira el mundo al revés que el trigger —los **objetos que
 * existen** en el bucket, no las transiciones— así que alcanza los siete
 * caminos por igual, incluido el que no emitió nada.
 *
 * ── Las tres salidas ──────────────────────────────────────────────────────
 *  - **`aBorrar`** — `aceptada-vencida` (el original de una aceptada, a los 30
 *    días de aceptada: **D-1160**) y `sin-propuesta` (un objeto que ningún
 *    documento nombra, pasada la gracia de 72 horas: **D-1161**).
 *  - **`aRevisar`** — lo que ningún barrido va a borrar y hay que mirar:
 *    `aceptada-sin-fecha-legible`, `sin-fecha-legible` (un estado que caduca
 *    pero que la retención no puede fechar), `<estado>-sin-plazo` (un estado que
 *    la tabla no nombra) y `varias-propuestas`.
 *  - **nada** — `de-una-que-caduca` (la retención se lo lleva con su
 *    documento), `aceptada-dentro-del-plazo`, `recien-subido`,
 *    `fuera-del-alcance`.
 *
 * **La retención de `nueva`, `en-revision` y `rechazada` no cambia**, y eso es
 * lo primero que se mira: si el estado tiene plazo de documento, el flyer se va
 * con el documento y esta función no opina. Por eso el caso de la aceptada va
 * **después** del chequeo de la tabla: el día que la `aceptada` tenga plazo de
 * documento, su flyer pasa solo al camino de la retención.
 *
 * ── `visto` viaja, como en `decidirRetencion` ─────────────────────────────
 * Cada `aBorrar` de una aceptada lleva el `updateTime` que la lectura vio, que
 * es lo que `borrarFlyer` exige antes de tocar el objeto. Acá no se juzga.
 *
 * @param {{
 *   objetos?: { nombre: string, creado?: number }[],
 *   propuestas?: { id: string, estado?: string, creadoEn?: unknown, revision?: unknown, imagen?: unknown, updateTime?: unknown }[],
 *   ahora?: number,
 *   margen?: number,
 *   plazos?: Record<string, number | null>,
 *   plazoDelAceptado?: number,
 *   tope?: number,
 * }} _
 * @returns {{
 *   aBorrar: { objeto: string, propuesta: string | null, visto: unknown, motivo: string }[],
 *   aRevisar: { objeto: string, propuesta: string | null, motivo: string }[],
 *   motivos: Record<string, string>,
 * }}
 */
export const decidirFlyeresSinPlazo = ({
  objetos = [],
  propuestas = [],
  ahora = Date.now(),
  margen = MARGEN_DEL_FLYER_EN_VUELO_MS,
  plazos = RETENCION_POR_ESTADO,
  plazoDelAceptado = MARGEN_DEL_ORIGINAL_ACEPTADO_MS,
  tope = MAX_FLYERES_POR_CORRIDA,
} = {}) => {
  /*
   * El índice se arma con la **misma** guarda que usa el borrado
   * (`objetoDePropuesta`) y no con el `storagePath` crudo: si un documento
   * nombrara `imagenes/img_x.jpg`, decir que «referencia» ese objeto sería
   * afirmar que el flyer de una actividad publicada está cubierto por un ciclo
   * de vida que no lo cubre.
   *
   * **Hoy no es alcanzable, y va igual** —mismo caso que el `Object.hasOwn` de
   * `decidirRetencion`—: una clave inválida no puede empatar con ningún objeto,
   * porque todo objeto que llega a consultarse ya pasó esta misma guarda unas
   * líneas más abajo. Lo que sostiene la propiedad es el corte del lado del
   * objeto; esto es que las dos mitades digan lo mismo (B-88).
   *
   * **Una lista por objeto y no un solo dueño**, desde que esto borra: con un
   * `Map` de un valor, dos documentos que nombraran el mismo objeto se pisarían
   * y ganaría el último — y si el último fuera una aceptada vencida, se borraría
   * el flyer que una `nueva` todavía muestra en la bandeja. `/proponer` genera
   * un uuid por flyer, así que solo pasa con un documento escrito a mano; por
   * eso no se resuelve, se pide a alguien (`varias-propuestas`).
   */
  const duenias = new Map();
  for (const p of propuestas) {
    const objeto = objetoDePropuesta(p?.imagen);
    if (!objeto) continue;
    const lista = duenias.get(objeto) ?? [];
    lista.push(p);
    duenias.set(objeto, lista);
  }

  const aBorrar = [];
  const aRevisar = [];
  const motivos = {};
  const revisar = (objeto, propuesta, motivo) => {
    motivos[objeto] = motivo;
    aRevisar.push({ objeto, propuesta, motivo });
  };

  for (const o of objetos) {
    const nombre = o?.nombre ?? '';

    if (objetoDePropuesta({ storagePath: nombre }) !== nombre) {
      // Un objeto anidado, o el prefijo pelado. Mismo criterio que
      // `decidirLimpieza`: no se opina de lo que no se entiende — y acá además
      // es lo que impide que un objeto de la galería llegue a `aBorrar`.
      motivos[nombre] = 'fuera-del-alcance';
      continue;
    }

    const lista = duenias.get(nombre) ?? [];

    if (lista.length > 1) {
      revisar(nombre, null, 'varias-propuestas');
      continue;
    }

    const [propuesta] = lista;
    if (propuesta) {
      const plazo = Object.hasOwn(plazos, propuesta.estado) ? plazos[propuesta.estado] : undefined;
      if (typeof plazo === 'number') {
        /*
         * **Tener plazo no alcanza: hace falta poder contarlo** — lo encontró el
         * `auditor-trampas`, y es la clase de B-88 en su forma más cara: dos
         * lugares que derivan por separado la misma pregunta —«¿el barrido va a
         * pasar por este documento?»— y uno de los dos se queda corto.
         * `decidirRetencion` pide un plazo numérico **y** un reloj legible; una
         * propuesta sin fecha legible cae en `sin-fecha-legible` y no se borra
         * nunca, así que su flyer tampoco. Se reusa el mismo motivo que el
         * barrido porque es el mismo hecho visto desde el otro lado.
         *
         * **Y este camino no borra**, a propósito: el flyer de una propuesta que
         * caduca es de la retención, que se lo lleva junto con el documento y en
         * el orden de B-838. Borrarlo acá sería un segundo borrado del mismo
         * objeto en carrera con aquél, y cambiaría la retención de la `nueva`,
         * la `en-revision` y la `rechazada`, que esto no vino a tocar.
         */
        if (relojDeRetencion(propuesta) === null) {
          revisar(nombre, propuesta.id, 'sin-fecha-legible');
          continue;
        }
        motivos[nombre] = 'de-una-que-caduca';
        continue;
      }

      if (propuesta.estado === ESTADO_ACEPTADO) {
        const aceptadaEn = relojDeAceptacion(propuesta);
        if (aceptadaEn === null) {
          /*
           * **Sin fecha de aceptación no se borra** — falla cerrado, como la
           * rechazada sin `revision.en`. No se puede afirmar que pasaron los 30
           * días, y la foto que se borra no vuelve. Va a la lista con su motivo
           * propio (y no con `sin-fecha-legible`) porque el remedio es otro: acá
           * lo que hay que arreglar es `revision.en`, no `creadoEn`, y el
           * pegamento lo loguea con `alerta` para que no dependa de que alguien
           * corra el script.
           */
          revisar(nombre, propuesta.id, 'aceptada-sin-fecha-legible');
          continue;
        }
        if (ahora - aceptadaEn < plazoDelAceptado) {
          // Tiene red: dentro del plazo, y la corrida del día 30 se lo lleva.
          motivos[nombre] = 'aceptada-dentro-del-plazo';
          continue;
        }
        motivos[nombre] = 'aceptada-vencida';
        aBorrar.push({
          objeto: nombre,
          propuesta: propuesta.id,
          visto: propuesta.updateTime,
          motivo: 'aceptada-vencida',
        });
        continue;
      }

      /*
       * Un estado sin plazo que no es la `aceptada`: hoy no existe (la tabla
       * tiene uno solo en `null`, y un estado que no nombra cae acá también). Si
       * nadie le puso plazo, nadie lo va a borrar — y agregar un estado no puede
       * empezar a borrar fotos de rebote.
       */
      revisar(nombre, propuesta.id, `${propuesta.estado}-sin-plazo`);
      continue;
    }

    if (!Number.isFinite(o?.creado) || ahora - o.creado < margen) {
      /*
       * Falla cerrado, igual que `decidirLimpieza`: sin fecha legible se trata
       * como recién subido. Acá el caso normal no es raro —`/proponer` sube el
       * archivo al elegirlo y escribe el documento al enviar— así que un objeto
       * joven sin documento es una persona llenando el formulario.
       */
      motivos[nombre] = 'recien-subido';
      continue;
    }

    /*
     * **Ningún documento lo nombra**, y tampoco es reciente: un `/proponer` que
     * se abandonó después de subir la foto, o la mitad que sobrevivió a un
     * borrado que se cortó (la foto de una persona **sin nada que la
     * referencie**, el punto 4 del inventario). Nadie la va a encontrar desde
     * otro lado, así que se borra (**D-1161**).
     */
    motivos[nombre] = 'sin-propuesta';
    aBorrar.push({ objeto: nombre, propuesta: null, visto: null, motivo: 'sin-propuesta' });
  }

  if (aBorrar.length <= tope) return { aBorrar, aRevisar, motivos };

  for (const { objeto } of aBorrar.slice(tope)) {
    motivos[objeto] = `${motivos[objeto]}-pendiente-por-tope`;
  }
  return { aBorrar: aBorrar.slice(0, tope), aRevisar, motivos };
};
