/**
 * **El verificador de un directorio de la Guía sobre el `dist/`** — corte 2 de
 * D-1070 (B-1760).
 *
 * Los pasos 8i-8l del gate (librerías, suscripciones, lugares y bibliotecas)
 * eran cuatro copias del mismo esqueleto —572 líneas de código, el 29 % del
 * script— con una diferencia de fondo cada una. El esqueleto es lo que ninguna
 * prueba unitaria puede ver, porque necesita el build de verdad:
 *
 *   1. el índice (`/{coleccion}.json`) existe y **leyó** algo: las publicadas
 *      están. Sin esto, todo lo que sigue pasa en verde sobre una lista vacía;
 *   2. la que **espera decisión** no está: es el control del
 *      `where('estado','==','publicado')` de la lectura (B-903);
 *   3. la ficha de cada publicada existe en disco y emite su JSON-LD, y la de la
 *      pendiente no existe;
 *   4. el sitemap ofrece las publicadas y no la pendiente (§6 #7 del inventario
 *      de PRDs: la página existe y el buscador no la ve, sin que falle nada).
 *
 * Lo propio de cada colección entra por dos puertas y no por un `if` adentro de
 * este archivo: `verificarFicha` (lo que se mira en la ficha de cada publicada) y
 * `extras` (lo que se mira sobre el `dist/` entero). Una quinta colección es una
 * entrada nueva en el script, no una quinta copia.
 *
 * No toca el disco ni la consola por su cuenta: todo pasa por el contexto, que
 * es lo que deja probarlo sin build.
 *
 * @typedef {{ relativa: string, contenido: string }} Archivo
 * @typedef {object} Contexto
 * @property {(ruta: string) => Promise<string | null>} leer  un archivo de `dist/`, o `null`
 * @property {() => Promise<Archivo[]>} publicables  todo lo publicable del `dist/`
 * @property {(mensaje: string) => void} fallo  marca el gate en rojo
 * @property {() => boolean} sinFallos  si el gate sigue en verde hasta acá
 * @property {(mensaje: string) => void} ok  imprime una línea verde
 */

/**
 * El bloque del JSON-LD de un tipo dado, del `@type` al cierre del `<script>`.
 * Se recorta así, y no se parsea, porque es la forma en que los pasos lo
 * miraron siempre: lo que se pregunta es qué claves aparecen adentro.
 */
export const bloqueLd = (html, tipoLd) => {
  const ld = html.slice(html.indexOf(tipoLd));
  return ld.slice(0, ld.indexOf('</script>'));
};

/**
 * La etiqueta `<a …>` que contiene una aguja, o `null`. El orden de los
 * atributos lo decide Astro, así que se recorta la etiqueta y se pregunta por
 * su contenido en vez de casar una cadena entera.
 */
export const etiquetaCon = (html, aguja) => {
  const i = html.indexOf(aguja);
  if (i === -1) return null;
  const abre = html.lastIndexOf('<a', i);
  const cierra = html.indexOf('>', i);
  return abre === -1 || cierra === -1 ? null : html.slice(abre, cierra + 1);
};

/**
 * **Un dato con fecha nunca aparece solo** — DEC-12, D-570.
 *
 * Cada aparición de `valor` en un archivo publicable tiene que traer «cargado
 * el» en los 160 caracteres que siguen. La ventana es generosa a propósito:
 * entre el número y la fecha puede haber el período, el separador y el escape
 * de una entidad HTML.
 *
 * Devuelve los huérfanos (un renglón por aparición) y los archivos donde el
 * valor apareció, que es el control positivo: sin él, un dato que dejó de
 * publicarse pasa este chequeo en verde.
 *
 * @param {Archivo[]} archivos
 * @param {string} valor
 */
export const datoConFecha = (archivos, valor) => {
  const huerfanos = [];
  const con = [];
  for (const { relativa, contenido } of archivos) {
    let desde = contenido.indexOf(valor);
    if (desde !== -1) con.push(relativa);
    while (desde !== -1) {
      const ventana = contenido.slice(desde, desde + 160);
      if (!ventana.includes('cargado el')) huerfanos.push(`    ${relativa}`);
      desde = contenido.indexOf(valor, desde + 1);
    }
  }
  return { huerfanos: [...new Set(huerfanos)], con };
};

/**
 * @param {Contexto} ctx
 * @param {object} d  la descripción del directorio (ver el script)
 */
export const verificarDirectorio = async (ctx, d) => {
  const crudo = await ctx.leer(d.indice);
  if (crudo === null) {
    ctx.fallo(
      `no se escribió dist/${d.indice}.\n` +
        `  Es el índice que baja el listado de /guia/${d.coleccion}: sin él, la sección\n` +
        '  carga el HTML del build y los filtros quedan apagados para siempre.',
    );
    return;
  }

  const slugs = (JSON.parse(crudo)[d.coleccion] ?? []).map((x) => x.slug);

  // 1 · El build tiene que haber LEÍDO algo, y todas las publicadas.
  for (const slug of d.publicadas) {
    if (!slugs.includes(slug)) ctx.fallo(d.mensajes.sinLeer(slugs.length, slug));
  }

  // 2 · El control del `where`: la pendiente no puede estar.
  if (slugs.includes(d.pendiente)) ctx.fallo(d.mensajes.pendienteEnElIndice);

  // 3 · La ficha de cada publicada existe en disco y emite su marcado.
  const fichas = {};
  for (const slug of d.publicadas) {
    const html = await ctx.leer(`guia/${d.coleccion}/${slug}/index.html`);
    fichas[slug] = html;
    if (html === null) {
      ctx.fallo(d.mensajes.sinFicha(slug));
      continue;
    }
    if (!html.includes(d.tipoLd)) {
      ctx.fallo(d.mensajes.sinLd);
      continue;
    }
    if (d.ldSinPrecio && d.ldSinPrecio.patron.test(bloqueLd(html, d.tipoLd))) {
      ctx.fallo(d.ldSinPrecio.mensaje);
    }
    if (d.verificarFicha) await d.verificarFicha(ctx, { slug, html, ld: bloqueLd(html, d.tipoLd) });
  }

  // 3b · Y la de la pendiente no: sería HTML indexable con una ficha que nadie aprobó.
  if ((await ctx.leer(`guia/${d.coleccion}/${d.pendiente}/index.html`)) !== null) {
    ctx.fallo(d.mensajes.fichaPendiente(d.pendiente));
  }

  // 4 · Las URLs en el sitemap, y la pendiente afuera. Sin sitemap no se mira:
  // eso ya lo frena el paso 7, y el ✓ de abajo no sale con el gate en rojo.
  const sitemap = await ctx.leer('sitemap.xml');
  if (sitemap !== null) {
    for (const slug of d.publicadas) {
      if (!sitemap.includes(`/guia/${d.coleccion}/${slug}/`)) {
        ctx.fallo(d.mensajes.sinSitemap(slug));
      }
    }
    if (sitemap.includes(`/guia/${d.coleccion}/${d.pendiente}/`)) {
      ctx.fallo(d.mensajes.pendienteEnElSitemap);
    }
  }

  // 5 · Lo propio de la colección, sobre el `dist/` entero.
  const resultado = d.extras ? await d.extras(ctx, { crudo, fichas }) : {};

  if (ctx.sinFallos()) ctx.ok(d.exito(resultado));
};
