/**
 * Paso 8n del gate (B-959).
 */
import {
  SLUG_EFEMERIDE,
  SLUG_EFEMERIDE_BORRADOR,
  TITULO_BORRADOR_EFEMERIDE,
  UID_CENTINELA_EFEMERIDE,
} from '../semilla.mjs';

export const nombre = "las efemérides";

/** @param {import('../chequeos.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { leer: leerDist, publicables } = ctx;
  /*
   * 8n · B-959 — **las efemérides, sobre los archivos de verdad.** El barrido de
   * centinelas de `tests/efemeride-publica.test.ts` mira el valor de retorno de
   * la proyección; esto mira lo que el build escribió: la publicada está en el
   * índice y tiene su página, el borrador no aparece en **ningún** archivo, y
   * los uids de la publicada no están en todo el `dist/`. Sin este paso el
   * `where` y el `.select()` de `efemeridesPublicadas` solo se verificaban por
   * el texto del fuente (lo cobró el `auditor-privacidad`).
   */
  {
    const antes = ctx.cuenta();
    const indice = JSON.parse((await leerDist('efemerides.json')) || '{}');
    const slugs = (indice.efemerides ?? []).map((e) => e.slug);
    if (!slugs.includes(SLUG_EFEMERIDE)) {
      ctx.fallo(
        `dist/efemerides.json no trae la efeméride publicada del gate (trae ${slugs.length}).\n` +
          '  El build no leyó /efemerides, así que nada de lo que sigue prueba nada.',
      );
    }
    if (!(await leerDist(`efemerides/${SLUG_EFEMERIDE}/index.html`))) {
      ctx.fallo(`la efeméride publicada no tiene su página: falta dist/efemerides/${SLUG_EFEMERIDE}/.`);
    }
    const conFuga = (await publicables()).filter(
      (a) =>
        a.contenido.includes(SLUG_EFEMERIDE_BORRADOR) ||
        a.contenido.includes(TITULO_BORRADOR_EFEMERIDE) ||
        a.contenido.includes(UID_CENTINELA_EFEMERIDE),
    );
    if (conFuga.length > 0) {
      ctx.fallo(
        'un borrador de efeméride, o el uid de quien la cargó, llegó al dist/.\n' +
          "  Falta o está mal el where('estado','==','publicado') o el .select() de\n" +
          '  efemeridesPublicadas (src/lib/contenidoDelSitio.ts), o la proyección dejó\n' +
          `  de ser una whitelist (§5.1). Archivos:\n${conFuga.map((a) => `    ${a.relativa}`).join('\n')}`,
      );
    }
    if (ctx.cuenta() === antes) {
      ctx.ok(
        'las efemérides salieron con la publicada en el índice y con su página, sin el ' +
          'borrador en ningún archivo y sin los uids de quien las cargó (B-959).',
      );
    }
  }
};
