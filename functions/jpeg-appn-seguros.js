/**
 * B-869 — los segmentos APPn de un JPEG que **no** son metadatos: la lista
 * **blanca** que reemplaza a la lista negra `APP_A_TIRAR` de
 * `src/lib/imagenes-archivo.ts`.
 *
 * Es el mismo movimiento que B-323 hizo del lado de PNG, un ítem más tarde y por
 * el mismo motivo: la lista negra enumeraba lo que se tira (`APP1`, `APP13`,
 * `COM`) y dejaba pasar todo lo demás, así que **no sacaba** ni el APP11 de las
 * credenciales de contenido C2PA ni el APP2 del índice MPF — y `quedanMetadatos`
 * sí busca las marcas de C2PA desde B-220. El saneador se quedaba corto justo
 * donde el detector miraba, y la persona veía un rechazo que le echaba la culpa
 * a su teléfono.
 *
 * ── Qué se conserva, y por qué cada uno ───────────────────────────────────
 * Los tres que **cambian cómo se ve la imagen** si se van. Ninguno lleva
 * ubicación; el ICC tiene un residuo declarado más abajo:
 *
 *  - `0xE0` **APP0/JFIF** — la densidad declarada, **y solo si no trae
 *    thumbnail**. La firma lleva el NUL para que `JFXX` —el thumbnail *de otro*
 *    APP0— no matchee, pero eso no alcanzaba: **el JFIF base tiene el suyo
 *    propio**, en los bytes 12 y 13 del cuerpo (`Xthumbnail`, `Ythumbnail`) más
 *    hasta 255×255×3 bytes de RGB sin comprimir. Es la misma imagen-adentro-de-
 *    la-imagen, de **antes** de cualquier recorte, y la firma sola la dejaba
 *    pasar por las dos capas (lo encontró el `auditor-privacidad` sobre B-869).
 *    Por eso la entrada tiene además una condición: los dos bytes en cero **y
 *    el largo declarado exactamente en 16**, que es lo que impide una cola
 *    pegada detrás de la densidad.
 *  - `0xE2` **APP2/ICC_PROFILE** — el perfil de color. Tirarlo entero cambia los
 *    colores de una foto de gama amplia, que es degradar la imagen sin que nadie
 *    lo pida; el docblock de `sinMetadatos` promete lo contrario. `MPF\0` **no**
 *    entra: comparte marcador y es el índice de la imagen secundaria.
 *
 *    **Y tiene un residuo declarado, porque «un ICC no lleva nada personal» es
 *    falso del contenedor:** el header ICC lleva la **fecha de creación del
 *    perfil** (bytes 24–35) y los tags `cprt`/`desc`/`dmnd`/`dmdd` son texto
 *    libre, así que un perfil **custom** —exportado por Lightroom o Capture
 *    One— puede llevar el nombre de quien fotografió. Lo que **no** lleva es
 *    ubicación. Se acepta el residuo porque los perfiles que emite un teléfono
 *    son enlatados (sRGB, Display P3) y la alternativa es publicar la foto con
 *    los colores cambiados; el tope de bytes de ICC conservados quedó anotado
 *    en el BACKLOG y no se hizo acá.
 *  - `0xEE` **APP14/Adobe** — sin él, un JPEG CMYK se ve invertido. También de
 *    forma fija: el spec le da **14** bytes, y se exige ese largo por el mismo
 *    motivo que al JFIF.
 *
 * ── Qué pasa con un APPn legítimo que no esté acá ─────────────────────────
 * **Se tira, y ese modo de falla es aceptable — acá y no en PNG.** El argumento
 * que B-323 escribió para no invertir el JPEG («la lista blanca de APPn sí se
 * queda corta seguido») es real, pero mide el riesgo del formato equivocado: en
 * PNG una lista blanca corta tira un chunk **estructural** (`PLTE`, `IDAT`) y
 * rompe la imagen. En JPEG lo estructural **no pasa por esta lista**: se
 * conserva por su marcador, y esa lista —`MARCADORES_ESTRUCTURALES`— es
 * **cerrada por el spec** (ITU-T T.81, tabla B.1), que no agrega marcadores
 * desde hace treinta años porque una extensión nueva llega como APPn. O sea que
 * una lista blanca corta acá cuesta perder una extensión de aplicación que el
 * navegador no mira, no una imagen rota.
 *
 * **Y por eso el corte no es «APPn y COM» sino «todo lo que no es
 * estructural»** (lo pidió el `auditor-privacidad` sobre B-869): así quedan
 * también del lado que se tira los `JPG0`–`JPG13` (`0xF0`–`0xFD`, «reserved for
 * JPEG extensions»: un contenedor sin reglas) y los reservados `0x02`–`0xBF`.
 * La versión anterior de esta regla los conservaba —igual que la lista negra
 * que reemplaza—, y eso desmentía la propiedad que este archivo vende: que lo
 * que no está enumerado se va.
 *
 * ── Por qué vive en su propio archivo ─────────────────────────────────────
 * Porque la pregunta es **una sola** y la hacen dos runtimes: el panel
 * (`sinMetadatos`, para decidir qué conserva) y la Function
 * (`estructuraConocida` en `imagenes-optimizar.js`, para decidir si puede dar
 * cuenta de todos los bytes). Hasta B-869 la segunda tenía su propia tabla
 * (`BLOQUES_CONOCIDOS`) y la primera no tenía ninguna: dos ideas del mismo hecho
 * es la clase de B-88. Sin `sharp` ni `firebase-admin` adentro, el panel la
 * importa por el alias `@jpeg-appn-seguros` (`astro.config.mjs`,
 * `tsconfig.json`, `vitest.config.ts`, y el `awk` de `scripts/que-deployar.sh`,
 * que es lo que hace que un cambio a esta tabla deploye Hosting **y**
 * Functions) — mismo patrón que `@png-chunks-seguros`.
 */

/**
 * **El JFIF base también trae thumbnail, y por eso la firma sola no alcanza.**
 * El cuerpo de un APP0/JFIF es `JFIF\0`(5) · versión(2) · unidades(1) ·
 * Xdensity(2) · Ydensity(2) · **Xthumbnail(1) · Ythumbnail(1)** · 3·X·Y bytes
 * de RGB sin comprimir. Con los dos últimos en cero **debería** medir 16 bytes
 * —eso lo verifica `deLargoExacto`, acá abajo, y no esta función—; con
 * cualquier otro valor arrastra hasta 195 KB
 * de una miniatura del original de **antes** de cualquier recorte, que es
 * exactamente el dato que `JFXX` no puede pasar. Lo encontró el
 * `auditor-privacidad` sobre B-869.
 *
 * @param {Uint8Array | Buffer} b
 * @param {number} cuerpo
 */
const jfifSinThumbnail = (b, cuerpo) => b[cuerpo + 12] === 0 && b[cuerpo + 13] === 0;

/**
 * **Y el largo declarado también se acota, porque reconocer la firma no acota
 * el cuerpo.** Un APP0 que arranque con `JFIF\0`, tenga los dos bytes del
 * thumbnail en cero y declare un largo de 500 se conservaba **entero**: lo que
 * se copia sale del largo declarado, no de la firma. Es el residuo exacto de
 * la clase que `jfifSinThumbnail` cierra —se había acotado *un campo* del
 * cuerpo en vez del cuerpo— y lo marcó el `auditor-privacidad`.
 *
 * Los dos segmentos de forma fija del spec se acotan al byte: JFIF sin
 * thumbnail mide **16** (5+2+1+2+2+1+1 de cuerpo, más los 2 del largo) y el
 * APP14 de Adobe mide **14** (5+2+2+2+1, más 2). El perfil ICC **no** se puede
 * acotar así —es variable por diseño y se parte en varios APP2 encadenados— y
 * ése queda como el residuo declarado de arriba.
 *
 * Los dos bytes del largo están justo antes del cuerpo, porque `cuerpo` es
 * `marcador + 4`.
 *
 * @param {number} esperado
 */
const deLargoExacto = (esperado) => (b, cuerpo) =>
  ((b[cuerpo - 2] << 8) | b[cuerpo - 1]) === esperado;

/** JFIF: ni thumbnail embebido, ni cola pegada detrás de la densidad. */
const jfifDeVerdad = (b, cuerpo) => jfifSinThumbnail(b, cuerpo) && deLargoExacto(16)(b, cuerpo);

/**
 * Los marcadores que un decodificador **necesita**: se conservan por su
 * marcador, sin mirarles el cuerpo, y no pasan por la lista blanca.
 *
 * Es la tabla B.1 de ITU-T T.81 sin los APPn, el COM y los reservados: los
 * quince `SOF` más `DHT` (`0xC4`) y `DAC` (`0xCC`) —que comparten su rango—,
 * las tablas y parámetros (`DQT`, `DNL`, `DRI`, `DHP`, `EXP`), el `SOS`, los
 * ocho `RSTn`, el `TEM` y los delimitadores. **Es cerrada**, y eso es lo que
 * hace seguro enumerarla — al revés de los chunks PNG, que son registrables
 * por diseño.
 */
const MARCADORES_ESTRUCTURALES = new Set([
  /*
   * Los quince SOF, más DHT (`0xC4`) y DAC (`0xCC`), que comparten el rango.
   *
   * **`0xC8` NO está, y la ausencia es el punto**: la tabla B.1 lo lista como
   * `JPG`, «reserved for JPEG extensions» — o sea el mismo caso que los
   * `JPG0`–`JPG13` de `0xF0`–`0xFD`, un contenedor sin forma definida, y no un
   * SOF. La primera versión de este conjunto lo metía adentro «porque está en
   * el rango `0xC*`», y así se conservaba entero y sin mirarle el cuerpo
   * mientras el `0xF7` de al lado se tiraba. Lo encontraron los dos auditores
   * sobre B-869, y el propio repo ya lo sabía: `ES_SOF`
   * (`src/lib/imagenes-archivo.ts`) lo excluye junto a `0xC4` y `0xCC`.
   */
  0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
  // RST0–RST7: los marcadores de reinicio del dato comprimido.
  0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
  0xd8, // SOI
  0xd9, // EOI
  0xda, // SOS
  0xdb, // DQT — cuantización
  0xdc, // DNL — número de líneas
  0xdd, // DRI — intervalo de reinicio
  0xde, // DHP — encabezado progresivo jerárquico
  0xdf, // EXP — expansión de referencia
  0x01, // TEM
]);

/**
 * Marcador → las firmas con las que puede arrancar el cuerpo del segmento para
 * que se lo conserve, más una condición opcional sobre el cuerpo. Cualquier
 * otra firma en el mismo marcador **no** se conserva, y una firma que matchea
 * pero no cumple la condición, tampoco.
 *
 * @type {Map<number, { firmas: readonly string[], ademas?: (b: Uint8Array | Buffer, cuerpo: number) => boolean }>}
 */
export const APPN_JPEG_SEGUROS = new Map([
  [0xe0, { firmas: ['JFIF\u0000'], ademas: jfifDeVerdad }],
  [0xe2, { firmas: ['ICC_PROFILE\u0000'] }],
  [0xee, { firmas: ['Adobe'], ademas: deLargoExacto(14) }],
]);

/**
 * ¿Este marcador lo necesita el decodificador? Si sí, se conserva sin mirarle
 * el cuerpo; si no —un APPn, el COM, un `JPG0`–`JPG13`, un reservado— tiene que
 * pasar por `esSegmentoSeguro`.
 *
 * @param {number} marcador
 * @returns {boolean}
 */
export const esMarcadorEstructural = (marcador) => MARCADORES_ESTRUCTURALES.has(marcador);

/**
 * ¿El segmento que empieza en `cuerpo` es uno de los que se conservan?
 *
 * `cuerpo` es el índice del primer byte **después** del largo declarado, o sea
 * `marcador + 4` contando desde el `0xFF`.
 *
 * @param {Uint8Array | Buffer} b
 * @param {number} marcador
 * @param {number} cuerpo
 * @returns {boolean}
 */
export const esSegmentoSeguro = (b, marcador, cuerpo) => {
  const entrada = APPN_JPEG_SEGUROS.get(marcador);
  if (!entrada) return false;
  const coincide = entrada.firmas.some((firma) => {
    for (let i = 0; i < firma.length; i += 1) {
      if (b[cuerpo + i] !== firma.charCodeAt(i)) return false;
    }
    return true;
  });
  if (!coincide) return false;
  return entrada.ademas ? entrada.ademas(b, cuerpo) : true;
};
