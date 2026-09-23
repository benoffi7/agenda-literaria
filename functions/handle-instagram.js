/**
 * **El handle de Instagram, normalizado, del lado de `functions/`** — B-1145.
 *
 * Es el mismo saneador que usan la ficha pública (B-1141), las cuatro guías y la
 * bandeja de propuestas. Está acá abajo y no en `src/lib/` por el mismo motivo
 * exacto que `slugify.js` y `geografia.js` (D-20, B-968): **`functions/` se
 * despliega con su propio `package.json` y no puede importar `src/`**, así que
 * cuando la Function necesita la misma derivación que el sitio, la
 * implementación baja acá y `src/` la reexporta. Una implementación, N runtimes.
 *
 * ── Una implementación, y no dos copias con red — B-1180 ──────────────────
 * `src/lib/handle-instagram.mjs` es una fachada de una línea que reexporta
 * esto, y `scripts/handle-instagram.mjs` reexporta a su vez de allá. **Así que
 * el arreglo se escribe una vez, acá, y llega a los tres runtimes.**
 *
 * Hasta B-1180 el del sitio tenía su propio cuerpo, letra por letra el de
 * abajo, atado por un test de equivalencia (`tests/calendario.test.ts`). Esa red
 * funcionaba —es la que B-928 corrió entre el script y el sitio—, pero avisa
 * **después** de que alguien tocó una sola de las dos, y el arreglo había que
 * escribirlo dos veces. Hoy el test lee la fachada del fuente y exige que no
 * tenga implementación propia, que es la afirmación que tiene contenido.
 *
 * ── Por qué no se escribe un regex propio en cada salida ──────────────────
 * Porque la regla no es «sacar el `https://`»: es el alfabeto real de Instagram,
 * el corte del `?` o `#` que pega el botón «Compartir» —y solo detrás del
 * prefijo, B-1160—, el orden entre ese corte y la barra final, y el criterio de
 * que lo que no se reconoce sale como se escribió. Una versión más de esas
 * decisiones sería la clase de B-88 con la peor salida posible, porque de este
 * lado el resultado va al calendario **público**.
 *
 * ── De dónde salió (B-928) ────────────────────────────────────────────────
 * De que hay una segunda persona cargando, con la forma real de hacerlo: copiar
 * la URL del perfil es más fácil que acordarse del handle. El criterio del dueño
 * vale más allá de este campo: «no podemos obligarlos a hacerlo como queremos,
 * sino ajustarnos nosotros».
 */

/**
 * El prefijo que `handleInstagram` sabe sacar. Anclado con `^`: así
 * `ar.instagram.com/x`, `instagram.com.evil.com/x` o un redirect con
 * `?u=instagram.com/otra` no cuentan como prefijo y no derivan nada.
 */
const PREFIJO_INSTAGRAM = /^(https?:\/\/)?(www\.)?instagram\.com\//i;

/**
 * `@casabrandon` / `casabrandon` / `instagram.com/casabrandon` → el handle solo.
 *
 * Se valida contra el alfabeto real de Instagram: lo que no lo cumple no es un
 * handle. Un handle con una barra adentro armaría una URL a otra cuenta.
 *
 * Se descarta el query string y el fragmento porque el botón «Compartir» de
 * Instagram pega `https://www.instagram.com/casabrandon/?igsh=MWx…`, o sea que
 * el caso más común de todos era justo el que fallaba (B-928). El corte va en el
 * **primer** `?` o `#` y **antes** de sacar la barra final: al revés, la barra de
 * `…/casabrandon/?igsh=…` no queda al final y sobrevive adentro del handle.
 *
 * **Y el corte va solo si hubo prefijo de `instagram.com`** — B-1160. Aplicado a
 * cualquier valor, `casa#brandon` derivaba a `casa` y `taller?2026` a `taller`,
 * que son **cuentas de otra persona**; en un posteo la arroba menciona y
 * notifica, y `formADocumento` guardaba el recorte, perdiendo lo tipeado. El
 * `?igsh=…` solo aparece detrás de una URL, así que ése es el único caso que el
 * corte tiene que cubrir. Un valor pelado con `?` o `#` falla el alfabeto y sale
 * como se escribió, que es el criterio de siempre para lo que no se reconoce.
 *
 * El `https://` es opcional: copiar de la barra del navegador sin el esquema es
 * lo que hace cualquiera, y el alfabeto sigue siendo la guarda — un
 * `instagram.com/p/ABC/` queda en `p/ABC`, que tiene una barra y no pasa.
 */
export const handleInstagram = (/** @type {string | null | undefined} */ crudo) => {
  const texto = (crudo ?? '').trim();
  const esUrl = PREFIJO_INSTAGRAM.test(texto);
  const sinPrefijo = texto.replace(PREFIJO_INSTAGRAM, '');
  const limpio = (esUrl ? sinPrefijo.replace(/[?#].*$/, '') : sinPrefijo)
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(limpio) ? limpio : null;
};

/**
 * **El texto con el que se muestra ese handle: `@casabrandon`** — B-1141.
 *
 * Es la otra mitad de la misma pregunta que contesta `handleInstagram`: uno dice
 * *cuál es la cuenta*, éste dice *cómo se escribe*. Viajan juntos para que
 * ninguna salida se arme la arroba por su cuenta y quede vieja (la clase de
 * B-88).
 *
 * **Lo que no se reconoce sale como se escribió**, sin arroba: perder «Casa
 * Brandon / IG» por no ser un handle es peor que mostrarlo pelado, y ponerle una
 * arroba adelante a algo que no es una cuenta sería afirmar algo falso.
 */
export const arrobaInstagram = (/** @type {string | null | undefined} */ crudo) => {
  const handle = handleInstagram(crudo);
  return handle ? `@${handle}` : (crudo ?? '').trim();
};
