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
 * `CAMPOS_PUBLICOS` tiene que ser exactamente lo que `libreriaPublica()` publica
 * (`src/lib/libreriaPublica.ts`), más `estado`, que es lo que decide si la ficha
 * existe para el sitio. `functions/` **no puede importar de `src/`** (D-20), así
 * que la lista se escribe de este lado y la ata un test —el mismo trato que
 * `cargarLabels` y los topes de `/reportes`—.
 *
 * El default es **rebuildear**: ante la duda, un build de más cuesta dos minutos
 * de Actions y un build de menos deja el sitio mintiendo. Es la dirección barata
 * del error.
 */

/**
 * Los campos de una ficha que el sitio publica, más el que decide si la publica.
 *
 * `estado` es el primero y el que más importa: publicar y despublicar son
 * exactamente los dos momentos en que el sitio tiene que cambiar.
 *
 * **No están** `origen`, `revision`, `creadoEn`, `searchText`,
 * `publicadaAlgunaVez` ni `contactoDeQuienCargo`. Los tres primeros son ciclo de
 * vida; `searchText` es **derivado** de los que sí están, así que no puede
 * cambiar solo; `publicadaAlgunaVez` la escribe un trigger y es justo el
 * write-back que esta guarda existe para no contar; y el contacto interno **no
 * sale al sitio**, así que corregirlo no cambia una sola letra de lo publicado.
 */
export const CAMPOS_PUBLICOS = [
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
];

/**
 * Las colecciones de la Guía que el sitio publica.
 *
 * Hoy una; las tajadas 3 y 4 suman las suyas. Está como lista y no como literal
 * para que el trigger se declare una vez por colección leyendo de acá, que es lo
 * que evita que la segunda nazca sin rebuild.
 */
export const COLECCIONES_DE_DIRECTORIO = ['librerias'];

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
export const cambioAmeritaRebuild = (antes, despues) => {
  if (!antes || !despues) return true;
  return CAMPOS_PUBLICOS.some((c) => JSON.stringify(antes[c]) !== JSON.stringify(despues[c]));
};
