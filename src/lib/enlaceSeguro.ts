/**
 * **Los dos saneadores de `href` del proyecto** — y, desde B-1141, la fachada
 * por la que también pasa el texto visible de un handle.
 *
 * La distinción importa y está al principio a propósito: `urlSegura` y
 * `handleInstagram` deciden qué puede terminar en un `href`; `arrobaInstagram`
 * **no sanea nada**, decide cómo se **lee** ese handle en una página indexada.
 * Son dos preguntas distintas que este archivo sirve juntas, y la segunda
 * también es una salida pública.
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
 *
 * **Y por eso tiene que parecer una dirección de verdad** (B-2165). Con el
 * `https://` de regalo, `new URL` acepta casi todo: «centrocultural» —un handle de
 * Instagram pegado en el campo web— daba `https://centrocultural/`, y el sitio lo
 * publicaba como un link que no lleva a ningún lado. Lo encontró
 * `scripts/links-rotos.mjs` el 2026-09-28 en 18 páginas. Se rechaza:
 *
 *  - **un host sin punto** («centrocultural», «fundacionx»): ningún sitio
 *    público se llama así;
 *  - **un host con `_`** («club_de_lectura_x»): es un handle, y un nombre
 *    de dominio no puede llevarlo;
 *  - **usuario o contraseña en la URL** («alguien@ejemplo.com» se lee como el
 *    usuario `alguien` en `ejemplo.com`): es un mail, y linkearlo manda a la
 *    portada del proveedor.
 *  - **un texto que empieza con `@`** (B-2168): es un handle, tenga o no puntos.
 *    «@sol.reviews» pasaba las tres reglas de arriba —`new URL` descarta el `@`
 *    como un usuario vacío— y salía como `https://sol.reviews/`. Casi todos los
 *    links rotos de la primera corrida eran esto, en el destino de una
 *    inscripción «por formulario».
 *
 * `localhost` y una IPv6 entre corchetes pasan aunque no tengan punto: son las
 * URLs de las imágenes del emulador de Storage, y sin ellas el panel en
 * desarrollo no mostraría ni un flyer.
 *
 * Un dominio que tiene la forma pero no existe («algo.leer») no se puede
 * saber sin preguntarle a la red: eso es de `links-rotos.mjs`, no de acá.
 */
export const urlSegura = (crudo: string | null | undefined): string | null => {
  const texto = (crudo ?? '').trim();
  if (!texto || texto.startsWith('@')) return null;
  const candidato = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(texto) ? texto : `https://${texto}`;
  try {
    const url = new URL(candidato);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/\.$/, '');
    const local = host === 'localhost' || host.startsWith('[');
    if ((!host.includes('.') && !local) || host.includes('_') || url.username || url.password)
      return null;
    return url.toString();
  } catch {
    return null;
  }
};

/**
 * §4.2 · B-928 — **la implementación vive en `handle-instagram.mjs`**, por lo
 * mismo que `slugify` y `geografia`: los scripts corren en Node plano. Se
 * re-exporta acá para que ningún import haya tenido que cambiar de ruta, y el
 * porqué de cada regla está en el docblock de allá.
 *
 * **`arrobaInstagram` viaja con él** (B-1141): es cómo se escribe ese mismo
 * handle cuando se lo muestra —`@casabrandon`—, y separarlos dejaría a un
 * consumidor con el handle y sin la forma de mostrarlo.
 */
export { handleInstagram, arrobaInstagram } from '@/lib/handle-instagram.mjs';
import { handleInstagram as handleParaEnlace } from '@/lib/handle-instagram.mjs';

/**
 * La URL del perfil, o `null` si el handle no es uno. El texto se muestra igual.
 * Vive acá desde el 2026-10-06 (antes en `detallePublico.ts`, que la reexporta):
 * la usan también la página del organizador y el panel, que no tienen por qué
 * arrastrar el view-model del detalle.
 */
export const enlaceInstagram = (crudo: string | null | undefined): string | null => {
  const handle = handleParaEnlace(crudo);
  return handle ? `https://instagram.com/${handle}` : null;
};