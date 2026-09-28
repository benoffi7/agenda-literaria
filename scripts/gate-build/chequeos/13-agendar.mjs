/**
 * Paso 13 del gate — «Agendar este encuentro» (roadmap 1.1).
 *
 * Dos cosas que ningún unitario ve, porque dependen de lo que Astro escribió:
 *
 *  1. **Que haya `.ics` en el `dist/`.** Si el endpoint deja de emitir, el barrido
 *     del paso 11 pasa en verde sin haber mirado ningún `.ics` (el modo de falla
 *     de B-217). La semilla tiene encuentros por venir, así que tiene que haber.
 *  2. **Que cada link a un `.ics` de una página tenga su archivo.** El link lo
 *     arma `rutaDelIcs` (`rutasPublicas.ts`) y el archivo lo genera el endpoint
 *     por los `params` de Astro: son dos convenciones que hoy coinciden, y el día
 *     que no, «iPhone u Outlook» da 404 y nada lo dice (la clase de B-88; lo
 *     señaló el `auditor-trampas`).
 */
export const nombre = 'agendar: los .ics existen y cada link tiene su archivo';

/** @param {import('../contexto.mjs').Contexto} ctx */
export const chequear = async (ctx) => {
  const { fallo } = ctx;
  const archivos = await ctx.publicables();
  const icsEscritos = new Set(archivos.filter((a) => a.relativa.endsWith('.ics')).map((a) => `/${a.relativa}`));

  if (icsEscritos.size === 0) {
    fallo(
      'el build no escribió ningún .ics en dist/actividad/.\n' +
        '  La semilla tiene encuentros por venir, así que «Agendar» tendría que generar uno por\n' +
        '  cada uno. Sin archivos, el barrido del paso 11 no miró ningún .ics (B-217).',
    );
    return;
  }

  const huerfanos = [];
  for (const { relativa, contenido } of archivos) {
    if (!relativa.endsWith('.html')) continue;
    for (const m of contenido.matchAll(/href="(\/actividad\/[^"]+\.ics)"/g)) {
      if (!icsEscritos.has(m[1])) huerfanos.push(`    dist/${relativa} → ${m[1]}`);
    }
  }
  if (huerfanos.length > 0) {
    fallo(
      `hay ${huerfanos.length} link(s) a un .ics que no existe:\n${huerfanos.join('\n')}\n` +
        '  El link sale de `rutaDelIcs` y el archivo de los params de `[encuentro].ics.ts`:\n' +
        '  se desalinearon, y «iPhone u Outlook» da 404.',
    );
    return;
  }
  ctx.ok(`${icsEscritos.size} .ics de «Agendar» en el dist/, y cada link de una página tiene su archivo (roadmap 1.1).`);
};
