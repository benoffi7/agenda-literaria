/**
 * **Qué cambio de una ficha de directorio amerita rehacer el sitio** — B-901,
 * trampa 8 del §13.
 *
 * Lógica pura: sin Firebase, sin red y sin reloj. El efecto —marcar
 * `sistema/rebuild.pendiente`— vive en `directorios-trigger.js`, que es el corte
 * que pide `docs/05-patrones.md` y el mismo que tienen `rebuild.js` y
 * `sincronizacion.js`.
 *
 * ── La trampa 8 con otra cara ────────────────────────────────────────────
 * «Olvidar disparar rebuild al cambiar `/opciones/*` → labels desactualizados en
 * los filtros». Acá es peor y más visible: **se publica una librería y el sitio
 * no la muestra**, para siempre, hasta que alguien edite cualquier actividad. Es
 * la sexta de las nueve cosas que se rompen en silencio
 * (`prd/05-inventario-de-archivos.md` § 6).
 *
 * ── Y la trampa 3, que es la razón por la que esto es una función y no un
 * `return true` ─────────────────────────────────────────────────────────────
 * Un trigger que escribe donde lo dispararon se dispara a sí mismo. Éste **no
 * escribe en `/librerias`** —escribe en `sistema/rebuild`— así que el loop
 * directo no existe. Lo que sí existe es el desperdicio: el trigger de la marca
 * de «estuvo publicada» (el que la tajada que venga escriba) va a hacer un
 * write-back sobre el mismo documento, y sin esta guarda cada publicación
 * costaría **dos** rebuilds. La guarda es la misma forma que `relevantChanged`
 * del §7.1: comparar solo los campos que cambian lo que el sitio muestra.
 *
 * ── Los campos son los de la proyección, y eso se afirma ─────────────────
 * Cada lista de `CAMPOS_PUBLICOS_POR_DIRECTORIO` tiene que ser exactamente lo que
 * publica la proyección de esa colección (`src/lib/libreriaPublica.ts`,
 * `src/lib/suscripcionPublica.ts`), más `estado`, que es lo que decide si la
 * ficha existe para el sitio. `functions/` **no puede importar de `src/`** (D-20), así
 * que la lista se escribe de este lado y la ata un test —el mismo trato que
 * `cargarLabels` y los topes de `/reportes`—.
 *
 * El default es **rebuildear**: ante la duda, un build de más cuesta dos minutos
 * de Actions y un build de menos deja el sitio mintiendo. Es la dirección barata
 * del error.
 */

/**
 * Los campos de una ficha que el sitio publica, **por colección**, más el que
 * decide si la publica.
 *
 * `estado` es el primero de cada lista y el que más importa: publicar y
 * despublicar son exactamente los dos momentos en que el sitio tiene que
 * cambiar.
 *
 * **No están, en ninguna de las dos**, `origen`, `revision`, `creadoEn`,
 * `searchText`, `publicadaAlgunaVez` ni `contactoDeQuienCargo`. Los tres primeros
 * son ciclo de vida; `searchText` es **derivado** de los que sí están, así que no
 * puede cambiar solo; `publicadaAlgunaVez` la escribe un trigger y es justo el
 * write-back que esta guarda existe para no contar; y el contacto interno **no
 * sale al sitio**, así que corregirlo no cambia una sola letra de lo publicado.
 *
 * ── Era una lista sola y ahora es un mapa — B-832 ───────────────────────────
 * Con una sola colección daba igual; con dos, una lista compartida sería la peor
 * de las dos opciones posibles: el campo que existe en una y no en la otra
 * (`barrio`, `periodicidad`) se compara contra `undefined` en los dos lados de la
 * segunda, o sea que **nunca cambia**, y editarlo no dispararía ningún build. Eso
 * es exactamente la trampa 8 volviendo por la puerta de al lado y sin que nada
 * falle. El mapa es lo que obliga a que cada colección declare lo suyo.
 */
export const CAMPOS_PUBLICOS_POR_DIRECTORIO = {
  librerias: [
    'estado',
    'slug',
    'nombre',
    'descripcion',
    'direccion',
    'barrio',
    'ciudad',
    'geo',
    'imagenes',
    'instagram',
    'whatsapp',
    'web',
    'mail',
  ],
  /*
   * B-832 — § 3 del PRD 3. `precio` está: es un campo publicado (como frase, con
   * su fecha) y corregirlo tiene que rehacer la ficha. `compromisoMinimo` y
   * `ofrecidaPor` también, que son texto de la ficha; `envio`, `incluye`,
   * `extras` y `alcance` son lo que la ficha muestra y lo que decide en qué chip
   * cae, o sea que cambiarlos cambia hasta el listado.
   */
  suscripciones: [
    'estado',
    'slug',
    'nombre',
    'descripcion',
    'imagenes',
    'ofrecidaPor',
    'periodicidad',
    'compromisoMinimo',
    'incluye',
    'incluyeOtro',
    'envio',
    'extras',
    'extrasOtro',
    'precio',
    'alcance',
    'linkDeSuscripcion',
    'instagram',
    'whatsapp',
    'mail',
  ],
  /*
   * B-833 — § 3 del PRD 4. Tres cosas de esta lista no se ven venir:
   *
   * 1. **`direccionPublica` está**, y es de lo que más importa que esté: es el
   *    flag del § 6, así que apagarlo **saca la dirección de la ficha publicada**.
   *    Sin él acá, alguien apaga la casilla en el panel, el sitio no se rehace y
   *    la dirección de una casa sigue publicada — que es el peor efecto posible de
   *    la trampa 8 en todo el proyecto.
   * 2. **`direccion` y `geo` están** aunque no siempre se publiquen: cuando el
   *    flag está prendido son contenido de la ficha, y comparar solo el flag
   *    dejaría un cambio de dirección sin rebuild.
   * 3. **`costo` NO está**, y no es un olvido: es un campo de la **proyección**,
   *    derivado de `condicion` (`claseDeCosto`), y no existe en el documento.
   *    Compararlo sería comparar `undefined` con `undefined` en los dos lados.
   *    Lo mismo pasa con `donde`, que en el documento son los cinco campos de
   *    arriba. `tests/directorios-rebuild.test.ts` lo declara en su tabla.
   */
  lugares: [
    'estado',
    'slug',
    'nombre',
    'descripcion',
    'imagenes',
    'tipo',
    'direccion',
    'barrio',
    'ciudad',
    'geo',
    'direccionPublica',
    'capacidad',
    'capacidadNotas',
    'incluye',
    'incluyeOtro',
    'condicion',
    'precio',
    'condicionNotas',
    'instagram',
    'whatsapp',
    'mail',
    'web',
  ],
};

/**
 * Las colecciones de la Guía que el sitio publica.
 *
 * **Se deriva del mapa de arriba**, no se escribe al lado: una colección con
 * campos declarados y sin trigger —o al revés— es justo el olvido que la lista
 * existía para evitar, y mantenerlas a mano lo permitía. La tajada 4 suma su
 * entrada arriba y aparece acá sola; lo que sigue sin poder derivarse es el
 * `export` del trigger en `index.js`, y eso lo ata un test.
 */
export const COLECCIONES_DE_DIRECTORIO = Object.keys(CAMPOS_PUBLICOS_POR_DIRECTORIO);

/**
 * ¿Este cambio cambia lo que el sitio muestra?
 *
 * Alta y baja del documento siempre cuentan: una ficha publicada que se borra
 * deja una página que ya no tiene que existir.
 *
 * La comparación es por `JSON.stringify` campo por campo, igual que
 * `relevantChanged` del §7.1: es suficiente para mapas y listas chicas, y no
 * pretende ser un `deepEqual` — un falso positivo por reordenar las claves de
 * `geo` cuesta un build, que es el lado barato.
 */
export const cambioAmeritaRebuild = (antes, despues, coleccion) => {
  if (!antes || !despues) return true;
  const campos = CAMPOS_PUBLICOS_POR_DIRECTORIO[coleccion];
  /*
   * Una colección que nadie declaró **rebuildea**, y es la dirección barata del
   * error: con la lista vacía la comparación no encontraría ninguna diferencia y
   * el sitio se quedaría viejo para siempre, en silencio. Es el mismo default que
   * el docblock de arriba: un build de más cuesta dos minutos de Actions.
   */
  if (!campos) return true;
  return campos.some((c) => JSON.stringify(antes[c]) !== JSON.stringify(despues[c]));
};
