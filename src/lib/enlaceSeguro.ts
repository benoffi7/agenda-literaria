/**
 * **Los dos saneadores de `href` del proyecto.**
 *
 * Vivían en `detallePublico.ts` —el view-model de la página de detalle— hasta
 * B-830 paso 7, y salieron de ahí cuando apareció el segundo consumidor: la
 * bandeja de propuestas arma `href` con texto escrito por **alguien sin login**,
 * que es el caso más filoso de todos, y no tiene por qué arrastrar el view-model
 * público entero para sanear una URL.
 *
 * Están juntos y aparte por lo mismo que `taxonomia.ts`: son puros, no dependen
 * de nada y los usan los dos lados. `detallePublico.ts` los reexporta, así que
 * ningún uso cambió.
 */

/**
 * Una URL que se puede poner en un `href`, o `null`.
 *
 * **Solo `http:` y `https:`.** `organizador.web`, `inscripcion.destino` con vía
 * «formulario» y `material.items[].url` son campos de texto libre de un
 * formulario, y un `javascript:…` en cualquiera de los tres es un XSS en una
 * página pública. Astro escapa el **contenido**, no el esquema de un `href`.
 *
 * Sin esquema se asume `https://`: quien carga escribe «casabrandon.com», y
 * pedirle el `https://` en el formulario para que el link ande es trasladarle un
 * detalle nuestro.
 */
export const urlSegura = (crudo: string | null | undefined): string | null => {
  const texto = (crudo ?? '').trim();
  if (!texto) return null;
  const candidato = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(texto) ? texto : `https://${texto}`;
  try {
    const url = new URL(candidato);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/**
 * `@casabrandon` / `casabrandon` / `instagram.com/casabrandon` → el handle solo.
 *
 * Se valida contra el alfabeto real de Instagram: lo que no lo cumple no se
 * convierte en link, se muestra como texto. Un handle con una barra adentro
 * armaría una URL a otra cuenta.
 */
export const handleInstagram = (crudo: string | null | undefined): string | null => {
  const limpio = (crudo ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(limpio) ? limpio : null;
};