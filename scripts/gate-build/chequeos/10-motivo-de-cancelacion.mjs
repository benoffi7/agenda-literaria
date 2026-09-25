/**
 * Paso 8m del gate (B-1572, D-976).
 */
import {
  CENTINELA,
  CENTINELA_DEL_DETALLE,
  SLUG_GALERIA,
} from '../semilla.mjs';

export const nombre = "el motivo del encuentro cancelado";

/** @param {import('../contexto.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, htmlDe } = ctx;
  /*
   * 8m · **B-1572 — el motivo de la cancelación, en las tres direcciones de
   * D-976.**
   *
   * 1. **Sí** en la página de detalle, debajo del encuentro. Es el control
   *    positivo, y sin él las dos ausencias de abajo pasan en verde el día que
   *    la semilla o la plantilla dejen de producirlo.
   * 2. **No** en el `events.json`: lo frena el paso 3, que barre `CENTINELA`
   *    entero sobre el índice, y el paso 9 en todo el resto del `dist/`.
   * 3. **No** en el JSON-LD. Es la mitad que necesita un chequeo propio: el
   *    permiso del paso 9 es **por archivo**, `CENTINELA_DEL_DETALLE` lo deja
   *    pasar en `actividad/**` y el marcado vive adentro de ese mismo HTML. Así
   *    que un `description` del `subEvent` armado con el motivo pasaría el
   *    barrido entero. Google muestra ese texto en el resultado de búsqueda, y
   *    el motivo es texto libre sobre un encuentro puntual (D-976).
   */
  {
    const htmlConCancelado = await htmlDe(SLUG_GALERIA);
    if (htmlConCancelado === null) {
      fallo(
        `no se generó dist/actividad/${SLUG_GALERIA}/index.html, que es la que lleva el ` +
          'encuentro cancelado con motivo (B-1572).',
      );
    } else {
      const motivo = CENTINELA.motivoCancelacion;
      if (!htmlConCancelado.includes(motivo)) {
        fallo(
          'la página de detalle no muestra el motivo del encuentro cancelado (D-976).\n' +
            '  Es el anuncio que reemplaza al borrado del evento (§7.3, B-98): sin él,\n' +
            '  quien llega desde el calendario lee el motivo y la página no lo dice. Y\n' +
            '  las dos ausencias de este paso quedan sin nada que mirar.',
        );
      }
      const bloquesLd = [
        ...htmlConCancelado.matchAll(
          /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
        ),
      ].map((m) => m[1]);
      if (bloquesLd.length === 0) {
        fallo(
          `dist/actividad/${SLUG_GALERIA}/index.html no lleva JSON-LD: la ausencia del ` +
            'motivo en el marcado no prueba nada sin marcado (B-1572).',
        );
      } else if (bloquesLd.some((ld) => ld.includes(motivo))) {
        fallo(
          'EL JSON-LD PUBLICA EL MOTIVO DE UN ENCUENTRO CANCELADO.\n' +
            '  D-976 lo deja afuera a propósito: Google muestra ese texto en el resultado\n' +
            '  de búsqueda, y el motivo es texto libre sobre un encuentro puntual. En la\n' +
            '  página va, debajo de su encuentro; en el marcado, el `eventStatus` alcanza.',
        );
      }
      if (ctx.sinFallos()) {
        console.log(
          '  ✓ el motivo del encuentro cancelado sale en la página, y no en el JSON-LD ' +
            `(${bloquesLd.length} bloque(s)) ni en el events.json (D-976, B-1572).`,
        );
      }
    }
  }
};
