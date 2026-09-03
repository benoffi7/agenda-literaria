/**
 * B-323 — los chunks PNG que no llevan texto, fecha ni metadatos de contenido:
 * la lista **blanca** que reemplaza a la lista negra `CHUNKS_A_TIRAR`.
 *
 * **Por qué esto vive en su propio archivo y no dentro de `imagenes-optimizar.js`
 * ni de `imagenes-archivo.ts`.** Hasta B-323 había dos listas: esta, ya blanca,
 * adentro de `estructuraConocida` (`imagenes-optimizar.js`, DEC-7d); y
 * `CHUNKS_A_TIRAR`, negra, en `src/lib/imagenes-archivo.ts` — la que limpia el
 * panel antes de subir. La negra dejó pasar `caBX`: 13,6 KB de credenciales de
 * contenido C2PA, firmadas por Google LLC, públicas en la portada de una
 * actividad real desde que se subió (D-175 § auditoría). El problema no era el
 * chunk: era que una lista negra deja pasar todo lo que no conoce, y el formato
 * PNG sigue agregando chunks.
 *
 * Sacar esta lista a un archivo aparte, sin `sharp` ni `firebase-admin`, es lo
 * que permite que **una sola** liste los chunks seguros y los dos lados la
 * importen: `functions/imagenes-optimizar.js` la usa tal cual, y el panel la
 * importa por el alias `@png-chunks-seguros` (`astro.config.mjs`,
 * `tsconfig.json`, `vitest.config.ts` — mismo patrón que `@calendario` y
 * `@historial`). Es la salida que B-323 dejó escrita como preferible a un JSON
 * compartido o a un test que ate dos copias: acá no hay dos copias.
 *
 * Los catorce son los del [PNG spec](https://www.w3.org/TR/png/) que no llevan
 * texto libre ni una fecha: la imagen en sí (`IHDR`, `PLTE`, `IDAT`, `IEND`),
 * la transparencia y el color (`tRNS`, `gAMA`, `cHRM`, `sRGB`, `iCCP`, `sBIT`,
 * `bKGD`), y la forma de decodificarla (`pHYs`, `hIST`, `sPLT`). Cualquier otro
 * — `eXIf`, `tEXt`, `iTXt`, `zTXt`, `tIME`, `caBX`, o uno que el formato agregue
 * mañana — **no** está acá, y por eso se tira sin que haga falta nombrarlo.
 */
export const CHUNKS_PNG_SEGUROS = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'bKGD',
  'pHYs',
  'hIST',
  'sPLT',
]);
