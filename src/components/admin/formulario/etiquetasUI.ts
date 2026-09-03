/**
 * Vocabulario de la UI del formulario — **ya no vive acá: se reexporta entero**
 * de `src/lib/etiquetas.ts`, que es el único vocabulario del panel (B-175).
 *
 * Este archivo queda como el punto de import de las secciones del formulario, que
 * no tienen por qué saber de dónde sale cada mapa. Lo que se fue son las
 * **declaraciones**: mientras estuvieron acá, el formulario decía «Híbrido» donde
 * el listado decía «Presencial y virtual» para el mismo valor guardado, y las dos
 * pantallas están a un clic de distancia.
 *
 * El porqué de cuál ganó, y qué **no** se unifica (la prosa del evento, la del
 * caption de redes y la del botón del sitio son registros distintos, no copias),
 * está en `src/lib/etiquetas.ts`.
 */
export { ETIQUETA_ESTADO, ETIQUETA_MODALIDAD, ETIQUETA_VIA } from '@/lib/etiquetas';
