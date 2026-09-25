/**
 * Paso 8 del gate (B-296), sobre el HTML construido.
 */
import {
  CENTINELA,
  CENTINELA_DEL_DETALLE,
  SLUG_GALERIA,
  SLUG_PUBLICADA,
} from '../semilla.mjs';

export const nombre = "la galería de tres imágenes y el control de la de una";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, htmlDe } = ctx;
  const htmlPublicada = await htmlDe(SLUG_PUBLICADA);

  /*
   * 8 · **B-296 — la galería de tres imágenes, sobre el HTML construido.**
   *
   * Los unitarios de `tests/galeria-del-detalle.test.ts` afirman sobre el
   * fuente de la plantilla: que dice `alt=""`, que dice `loading="lazy"`, que
   * la proporción sale de `estiloDeAfiche`. Ninguno puede ver el resultado de
   * pasarle **tres medidas distintas** por ahí, porque la plantilla no se
   * renderiza en vitest. Lo que se mira acá es lo que un navegador va a recibir:
   * tres `<img>`, tres cajas distintas, un solo `eager`, un solo `alt` con
   * texto, y el epígrafe donde tiene que estar.
   *
   * Y el control que sostiene todo el ítem: **la página de una sola imagen
   * sigue teniendo una sola imagen y ninguna sección de galería**. Es el 87 % de
   * las actividades con imagen y es lo primero que rompería un `slice(0)`.
   */
  const htmlGaleria = await htmlDe(SLUG_GALERIA);
  if (htmlGaleria === null) {
    fallo(
      `no se generó dist/actividad/${SLUG_GALERIA}/index.html.\n` +
        '  Es la actividad con tres imágenes de B-296.',
    );
  } else {
    const imgs = htmlGaleria.match(/<img\b[^>]*>/g) ?? [];
    const delPanel = imgs.filter((i) => i.includes('example.invalid/gate-'));

    // 8a · Las tres están. Antes de B-296 salía **una**.
    if (delPanel.length !== 3) {
      fallo(
        `la página con tres imágenes cargadas pinta ${delPanel.length}.\n` +
          '  Es el bug de B-296: `imagenes[0]` mostraba una sola y las otras no aparecían\n' +
          '  en ninguna salida del sitio.',
      );
    }

    // 8b · Arriba va la **marcada** como portada, que en el fixture es la
    // segunda del array (B-268, y su consecuencia nueva).
    if (delPanel[0] && !delPanel[0].includes('gate-vertical')) {
      fallo(
        'la primera imagen de la página no es la marcada como portada.\n' +
          '  El fixture la puso segunda en el array a propósito: si el orden del array\n' +
          '  decide, el flyer baja a la tira como miniatura decorativa (B-268).',
      );
    }

    // 8c · Un solo `eager`, y es esa. Lo demás, diferido.
    const eager = delPanel.filter((i) => i.includes('loading="eager"'));
    const lazy = delPanel.filter((i) => i.includes('loading="lazy"'));
    if (eager.length !== 1 || !eager[0]?.includes('gate-vertical') || lazy.length !== 2) {
      fallo(
        `la página pide ${eager.length} imagen(es) temprano y difiere ${lazy.length}.\n` +
          '  Tiene que ser una sola `eager` —la portada— y las secundarias en `lazy`: sin\n' +
          '  la Function de recompresión (B-220), la actividad peor medida de producción\n' +
          '  suma 3,15 MB entre sus tres archivos y 2,1 MB de eso son secundarias.',
      );
    }

    // 8d · Un solo texto alternativo con contenido, y es el de la portada. Las
    // secundarias van con `alt=""` (D-168): el mismo alt tres veces es peor
    // que no tenerlo.
    const conAlt = delPanel.filter((i) => /alt="[^"]+"/.test(i));
    const vacios = delPanel.filter((i) => i.includes('alt=""'));
    if (conAlt.length !== 1 || !conAlt[0]?.includes('gate-vertical') || vacios.length !== 2) {
      fallo(
        `la página tiene ${conAlt.length} imagen(es) con texto alternativo y ${vacios.length} ` +
          'con `alt=""`.\n' +
          '  Tiene que ser uno y dos: el título de la actividad describe la portada, y\n' +
          '  repetido en las tres no distingue ninguna para un lector de pantalla (D-168).',
      );
    }
    if ((htmlGaleria.match(/alt="Imagen de /g) ?? []).length !== 1) {
      fallo('el «Imagen de …» del texto alternativo aparece más de una vez en la página.');
    }

    // 8e · **Tres cajas distintas, ninguna recortada** (D-147). Es lo que no
    // puede ver ningún unitario: son tres medidas pasando por la misma
    // plantilla, y el bug sería que todas salieran con la misma proporción.
    const proporciones = [...htmlGaleria.matchAll(/aspect-ratio:\s*([^";]+)/g)].map((m) =>
      m[1].trim(),
    );
    const esperadas = ['1080 / 1350', '1408 / 768', '1024 / 1024'];
    const faltan = esperadas.filter((p) => !proporciones.includes(p));
    if (faltan.length > 0) {
      fallo(
        `faltan cajas reservadas en la página: ${faltan.join(', ')}.\n` +
          `  Salieron [${proporciones.join(', ')}]. Cada imagen reserva **su** proporción\n` +
          '  (D-147): una sola para las tres es una caja fija, y una caja fija recorta o\n' +
          '  encoge según la forma del archivo.',
      );
    }
    if (htmlGaleria.includes('object-cover')) {
      fallo('la página con tres imágenes recorta alguna: apareció `object-cover` (D-147).');
    }

    // 8f · La sección: el rótulo que anuncia el grupo, el epígrafe como
    // `figcaption` de su imagen, y ni un enlace que agregue una parada de
    // tabulación.
    const seccion = /<section[^>]*aria-labelledby="mas-imagenes"[\s\S]*?<\/section>/.exec(
      htmlGaleria,
    )?.[0];
    if (!seccion) {
      fallo('la página con tres imágenes no lleva la sección de las secundarias.');
    } else {
      if (!/imágenes/i.test(seccion)) {
        fallo(
          'la sección no anuncia que hay más imágenes.\n' +
            '  Es la mitad que hace aceptable el `alt=""`: las secundarias son\n' +
            '  decorativas, así que **este encabezado es lo único** que le dice a quien\n' +
            '  escucha la página que el grupo existe (D-168). Sin él, el grupo desaparece\n' +
            '  del árbol de accesibilidad.\n' +
            '  Se afirma el plural y no el texto exacto: B-302 cambió «Dos imágenes más»\n' +
            '  por «Más imágenes» y esta comprobación no tenía por qué caerse con eso.',
        );
      }
      if (!/<figcaption[^>]*>[^<]*gate\.imagenes\.epigrafe/.test(seccion)) {
        fallo(
          'el epígrafe de la secundaria no salió como `figcaption`.\n' +
            '  Tiene que ser el pie de **su** imagen y no texto suelto debajo de la fila.',
        );
      }
      /*
       * **Este aserto decía lo contrario hasta B-720, y lo cambió el dueño.**
       * Prohibía cualquier enlace en la tira, con dos motivos: que la página
       * tenía un presupuesto de 0 KB de JavaScript, y que un enlace al JPEG
       * suelto agrega una parada de tabulación que no lleva a ninguna parte.
       *
       * Los dos se reencuadran, no se descartan. La página tiene ahora **una**
       * island (`VisorDeGaleria`, `client:idle`) porque el dueño pidió recorrer
       * las fotos en grande. Y el enlace al archivo **es el fallback deliberado
       * de esa island**: con JavaScript apagado, abrir la imagen es lo mejor
       * que se puede ofrecer, y es la condición que se le puso al frente —el
       * HTML del build no puede depender de la island—. Con JavaScript, el
       * visor intercepta el click y no se navega a ninguna parte.
       *
       * Así que lo que se verifica es **el patrón completo**: que cada imagen
       * secundaria sea un enlace a su propio archivo (el fallback) y que la
       * island esté en la página (el enhancement). Falta cualquiera de los dos
       * y queda una de las dos mitades malas: un enlace crudo al binario, o una
       * tira muerta para quien navega con teclado.
       */
      const enlaces = [...seccion.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
      const alArchivo = enlaces.filter((href) =>
        /\.(jpe?g|png|webp|avif)(\?|$)/i.test(href),
      );
      if (enlaces.length !== alArchivo.length) {
        fallo(
          'la tira de secundarias tiene un enlace que no apunta a su imagen:\n' +
            enlaces
              .filter((h) => !alArchivo.includes(h))
              .map((h) => `    ${h}`)
              .join('\n'),
        );
      }
      if (alArchivo.length > 0 && !/VisorDeGaleria|visor-de-galeria/i.test(htmlGaleria)) {
        fallo(
          'la tira enlaza a los archivos y el visor NO está en la página.\n' +
            '  Sin la island, cada enlace lleva al JPEG y deja a quien navega con teclado\n' +
            '  afuera del sitio: el fallback quedó sin su enhancement (B-720).',
        );
      }
    }

    /*
     * 8g · **El barrido de centinelas sobre la salida NUEVA.** Lo encontró el
     * `auditor-privacidad`: el fixture pone `storagePath` en las tres imágenes
     * y lo justifica diciendo «el barrido de abajo tiene que cubrir la salida
     * nueva», y el barrido no estaba. El del paso 4 corre sobre la **cancelada**,
     * que tiene una sola imagen y por lo tanto no genera la sección; y el de
     * vitest corre sobre el view-model, así que por construcción no puede ver
     * nada que la plantilla emita **solo para las secundarias**.
     *
     * Modo de falla concreto que esto ataja: un `data-id={imagen.id}` o un
     * `title={imagen.storagePath}` agregado mañana al `<img>` de la tira.
     *
     * Va también sobre la **publicada**, que tampoco se barría: hasta acá el
     * único HTML barrido era el de la cancelada.
     */
    for (const [nombre, html] of [
      ['con tres imágenes', htmlGaleria],
      ['publicada', htmlPublicada],
    ]) {
      if (!html) continue;
      const filtrados = Object.entries(CENTINELA).filter(
        ([campo, v]) => !CENTINELA_DEL_DETALLE.includes(campo) && html.includes(v),
      );
      if (filtrados.length > 0) {
        fallo(
          `la página ${nombre} publica campos privados:\n` +
            filtrados.map(([campo, valor]) => `    ${campo} → ${valor}`).join('\n'),
        );
      }
    }

    // 8h · **El control de la mayoría**: con una sola imagen, la página es la
    // de antes. Ni una imagen de más, ni una sección vacía.
    const imgsPublicada = (htmlPublicada?.match(/<img\b[^>]*>/g) ?? []).filter((i) =>
      i.includes('example.invalid/gate.jpg'),
    );
    if (imgsPublicada.length !== 1 || htmlPublicada?.includes('mas-imagenes')) {
      fallo(
        `la página con UNA sola imagen pinta ${imgsPublicada.length} y ` +
          `${htmlPublicada?.includes('mas-imagenes') ? 'sí' : 'no'} lleva la sección de galería.\n` +
          '  26 de las 30 actividades con imagen tienen exactamente una (medido el\n' +
          '  2026-09-02): ese caso no puede cambiar por una galería que casi nunca tiene\n' +
          '  qué mostrar. Un `slice(0)` en vez de `slice(1)` la pinta dos veces.',
      );
    }
  }
};
