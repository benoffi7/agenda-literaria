/**
 * Paso 10 del gate (B-122).
 */
import { problemasDeJerarquia, tituloDe } from '../../seo-del-artefacto.mjs';

export const nombre = "el <title> único y la jerarquía de encabezados";

/** @param {import('../contexto.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo, publicables } = ctx;
  /*
   * 10 · **B-122 — las dos propiedades del HTML indexable que quedaban sin
   * red, y que resultaron ser propiedades y no juicios.**
   *
   * El ítem pedía «un auditor del sitio público». Mirándolo con el criterio
   * del propio repo —un agente que repite lo que un chequeo ya frena es costo
   * sin cobertura— lo que le quedaba sin cubrir eran cuatro cosas, y solo dos
   * de ellas necesitan un modelo:
   *
   *   · **un `<title>` distinto en cada página** → es una propiedad del
   *     artefacto. Un título repetido hace que Google elija cuál de las dos
   *     páginas indexar, y la que pierde deja de existir para quien busca. El
   *     modo de falla clásico es una plantilla nueva que hereda el título del
   *     layout y nadie lo nota, porque la página se ve bien.
   *   · **la jerarquía de encabezados** → también es una propiedad: un `h1`
   *     por página y ningún nivel salteado. Es lo primero que mira un lector
   *     de pantalla para armarse el índice de la página, y se rompe en
   *     silencio: visualmente un `h3` con la clase del `h2` es idéntico.
   *   · el **nombre accesible** de un control y **el foco en un recorrido
   *     real** → ésos no son propiedades del HTML: hay que tabular una página
   *     viva. No los hace ni un test ni un agente con `grep`, y quedan
   *     anotados como manuales en `docs/13-agentes.md`.
   *
   * Van acá y no en la suite por el mismo motivo que el paso 9: necesitan el
   * HTML construido (criterio de B-217). Y **no cubren `/admin`**, que es una
   * SPA de React: su HTML de build es una cáscara vacía y no tiene sentido
   * medirle la jerarquía.
   */
  {
    const paginas = (await publicables())
      .filter((a) => a.relativa.endsWith('.html') && !a.relativa.startsWith('admin/'));

    if (paginas.length < 5) {
      fallo(
        `el chequeo de SEO encontró ${paginas.length} página(s) en dist/: son muy pocas ` +
          'para comparar títulos, así que un verde acá no diría nada.',
      );
    }

    const titulos = new Map();
    const jerarquia = [];

    for (const { relativa, contenido: html } of paginas) {

      // 10a · El título, único.
      const t = tituloDe(html);
      if (!t) {
        fallo(`dist/${relativa} no tiene <title>.`);
      } else {
        if (!titulos.has(t)) titulos.set(t, []);
        titulos.get(t).push(relativa);
      }

      // 10b · Un solo `h1`, y ningún nivel salteado al bajar.
      for (const p of problemasDeJerarquia(html)) jerarquia.push(`    dist/${relativa} → ${p}`);
    }

    const repetidos = [...titulos.entries()].filter(([, rutas]) => rutas.length > 1);
    if (repetidos.length > 0) {
      fallo(
        'hay páginas que comparten el <title>:\n' +
          repetidos
            .map(([t, rutas]) => `    "${t}" → ${rutas.map((r) => `dist/${r}`).join(', ')}`)
            .join('\n') +
          '\n  Google elige cuál de las dos indexar, y la que pierde deja de existir\n' +
          '  para quien busca. Es el objetivo del proyecto (§2.3): que la gente\n' +
          '  encuentre los talleres.',
      );
    }

    if (jerarquia.length > 0) {
      fallo(
        'la jerarquía de encabezados está rota:\n' +
          jerarquia.join('\n') +
          '\n  Es el índice con el que un lector de pantalla recorre la página, y se\n' +
          '  rompe en silencio: un h3 con la clase del h2 se ve idéntico.',
      );
    }
  }
};
