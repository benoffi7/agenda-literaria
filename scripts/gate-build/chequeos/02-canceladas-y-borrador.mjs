/**
 * Pasos 4, 5 y 6 del gate (B-110), sobre el HTML de verdad.
 */
import {
  CENTINELA,
  CENTINELA_DEL_DETALLE,
  SLUG_BORRADOR,
  SLUG_CANCELADA,
  SLUG_CANCELADA_NUNCA,
} from '../semilla.mjs';

export const nombre = "las páginas de la cancelada, la que nunca se publicó y el borrador";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, htmlDe } = ctx;
  /*
   * 4 · B-110 — **la página de la cancelada, sobre el HTML de verdad.**
   *
   * Los tres asertos de arriba miran el `events.json`, y el modo de falla de
   * este ítem no se ve ahí: es un archivo HTML que se genera o no se genera. Y
   * es la mitad que ningún test unitario puede mirar — `caminosDeDetalle`
   * devuelve rutas, Astro las escribe.
   */
  const htmlCancelada = await htmlDe(SLUG_CANCELADA);
  if (htmlCancelada === null) {
    fallo(
      `no se generó dist/actividad/${SLUG_CANCELADA}/index.html.\n` +
        '  Una actividad cancelada que estuvo publicada conserva su página (§7.3, B-110):\n' +
        '  un 404 le contesta «no existe» a quien pregunta si se hace.',
    );
  } else {
    // La franja, el `eventStatus` y la ausencia de CTA: las tres cosas del §7.3.
    if (!htmlCancelada.includes('Esta actividad se canceló')) {
      fallo('la página de la cancelada no lleva la franja que dice que se canceló.');
    }
    if (!htmlCancelada.includes('EventCancelled')) {
      fallo(
        'el JSON-LD de la cancelada no lleva `eventStatus: EventCancelled`.\n' +
          '  Es lo que Google pide para dejar de mostrarla como vigente (§5.3).',
      );
    }
    if (htmlCancelada.includes('Mandar un mail')) {
      fallo('la página de la cancelada muestra el CTA de inscripción (§7.3: sin CTA).');
    }
    // Y el barrido, sobre el artefacto: la cancelada no publica nada de más.
    // `urlPublica` está en `true` en el fixture, así que es el peor caso.
    const enLaPagina = Object.entries(CENTINELA).filter(
      ([campo, v]) => !CENTINELA_DEL_DETALLE.includes(campo) && htmlCancelada.includes(v),
    );
    if (enLaPagina.length > 0) {
      fallo(
        'la página de la actividad CANCELADA publica campos privados:\n' +
          enLaPagina.map(([campo, valor]) => `    ${campo} → ${valor}`).join('\n'),
      );
    }
  }

  // 5 · Y la que nunca estuvo publicada no existe: es un borrador por otra puerta.
  if ((await htmlDe(SLUG_CANCELADA_NUNCA)) !== null) {
    fallo(
      `se generó dist/actividad/${SLUG_CANCELADA_NUNCA}/index.html.\n` +
        '  Una actividad que nace y muere en `cancelado` nunca fue pública (§7.3):\n' +
        '  publicar su página ahora es publicar un borrador.',
    );
  }

  // 6 · El borrador tampoco, que es el mismo aserto sobre el HTML.
  if ((await htmlDe(SLUG_BORRADOR)) !== null) {
    fallo(`se generó dist/actividad/${SLUG_BORRADOR}/index.html: es un borrador.`);
  }
};
