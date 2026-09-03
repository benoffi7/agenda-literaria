/**
 * El vocabulario de la UI del panel: los enums del modelo en el idioma de la
 * pantalla, **en un solo lugar** (B-76, B-175).
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * El bug de B-76 fue una instancia: el listado renderizaba el valor guardado y
 * decía «borrador» donde el formulario decía «Borrador». La clase es *el mismo
 * valor guardado leído distinto en dos pantallas del panel*, y siguió viva en
 * `modalidad`: el formulario decía **«Híbrido»** y el desplegable de filtros
 * **«Presencial y virtual»**, para el mismo `'hibrido'`, en dos pantallas que
 * están a un clic de distancia.
 *
 * No es una duplicación estética. Quien carga aprende un nombre en el
 * formulario y después no lo encuentra en el filtro; y el que no coincide con lo
 * que se publica es el del formulario, o sea el que se lee al decidir.
 *
 * ── Cuál ganó, y por qué no fue un refactor ───────────────────────────────
 * Que fueran dos mapas era un refactor; **elegir cuál gana es una decisión de
 * copy**, y por eso B-175 quedó anotado en vez de resolverse con B-76. Ganó
 * **«Presencial y virtual»**, por tres razones que apuntan al mismo lado:
 *
 * 1. es el que ya usan el **sitio público** (`listadoPublico.ts`,
 *    `tarjetaPublica.ts`, `detallePublico.ts`) y la descripción del **evento**,
 *    así que es el que la gente ve;
 * 2. dice qué es sin saber la palabra. «Híbrido» es la jerga del modelo, y la
 *    guía del panel tiene un test que prohíbe la jerga justamente por esto;
 * 3. cambiar el del sitio para que coincida con el del formulario habría sido
 *    cambiar lo publicado por una etiqueta de una pantalla interna.
 *
 * ── Lo que NO se unifica, y no es olvido ──────────────────────────────────
 * Los `ETIQUETA_*` de `functions/calendario.js`, de `textoRedes.ts` y de
 * `detallePublico.ts` son **prosa de una salida**, no etiquetas de UI: «por DM
 * al Instagram» en el evento del calendario, «por DM» en un caption de
 * Instagram, «Escribir por Instagram» en el botón del sitio. Son registros
 * distintos del mismo valor, y unificarlos haría que un cambio de copy del panel
 * cambie lo que se publica (D-20). La regla es: **una etiqueta de control del
 * panel vive acá; una frase de una salida vive con su salida.**
 *
 * ── Por qué `ESTADO` y `MODALIDAD` se re-exportan ─────────────────────────
 * Los dos mapas se declaran en `filtrosActividades.ts` y viven ahí desde antes:
 * los importa el sitio público, no solo el panel. Este módulo es **el punto de
 * import único del panel** y los reexporta para que la identidad sea la misma
 * —el mismo objeto, no dos con el mismo contenido— sin obligar a las cinco
 * pantallas públicas a cambiar de import por un arreglo del panel.
 */
export { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD } from '@/lib/filtrosActividades';

import type { ViaInscripcion } from '@/types/actividad';

/**
 * Por dónde se inscribe la gente, como se lee en el desplegable del panel.
 *
 * Este sí se declara acá: es el único de los tres que no tiene un consumidor
 * fuera del panel. Los que se le parecen son prosa de una salida (ver arriba).
 */
export const ETIQUETA_VIA: Record<ViaInscripcion, string> = {
  mail: 'Mail',
  whatsapp: 'WhatsApp',
  // B-185 — «al Instagram», no «de Instagram»: reporte del dueño (2026-08-25).
  dm: 'DM al Instagram',
  formulario: 'Formulario',
};
