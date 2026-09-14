/**
 * **Las ciudades de una actividad, normalizadas** — B-919.
 *
 * La ciudad no vive en la raíz del documento: vive en `modalidades[].sede.ciudad`
 * (D-130), que es una **lista** —una actividad puede ser presencial en una
 * librería de Mar del Plata y virtual por Meet— y además es un `<input>` de texto
 * libre, no una taxonomía. O sea que «Mar del Plata», «mar del plata», «MAR DEL
 * PLATA» y « Mar del Plata » son cuatro strings distintos.
 *
 * Las dos cosas juntas hacen imposible el alcance por ciudad del publicador:
 *
 *  - una regla de Firestore **no puede inspeccionar adentro de un array de maps**
 *    (es lo mismo que frenó abrir `/opciones` en B-888), así que no hay forma de
 *    preguntar por `modalidades[].sede.ciudad`;
 *  - y aunque se pudiera, un `==` contra lo tipeado es **un permiso que falla en
 *    silencio** el día que alguien escribe la ciudad con otra mayúscula.
 *
 * Por eso el documento gana `ciudades: string[]` en la raíz: los **slugs** de
 * todas las ciudades de sus modalidades, sin repetir. Lo escribe `formADocumento`
 * en cada guardado, igual que `searchText`, `modalidad` y `sede` — **no es una
 * segunda fuente de verdad, es la misma proyectada** (§"Comparar payloads": lo
 * relevante se deriva, no se mantiene a mano).
 *
 * Una actividad solo virtual queda con `[]` y no la ve ningún publicador, que es
 * lo correcto: no es «de» ninguna ciudad.
 *
 * ── Por qué esto es `.mjs` ────────────────────────────────────────────────
 * Por lo mismo que `slugify.mjs`, del que sale la normalización: el backfill
 * (`scripts/sembrar-ciudades.mjs`) corre en node y tiene que derivar **exactamente
 * lo mismo** que el panel. Con una copia en el script, un documento sembrado y uno
 * guardado desde el panel podrían tener slugs distintos para la misma ciudad, y el
 * síntoma sería un permiso que no matchea.
 */
import { slugify } from './slugify.mjs';

/**
 * El slug de una ciudad. Es `slugify` y nada más: existe como nombre propio para
 * que el script del claim y el del documento no puedan llamar a dos funciones
 * distintas sin que se note.
 *
 * @param {string | null | undefined} ciudad
 * @returns {string} `''` si no queda nada usable
 */
export const slugDeCiudad = (ciudad) => (ciudad ? slugify(ciudad) : '');

/**
 * Las ciudades de una lista de modalidades, en **slug**, sin repetir y en el
 * orden en que aparecen.
 *
 * Sirve para las filas del documento y para las del formulario: las dos tienen
 * `sede: { ciudad }`, y lo único que se mira es eso.
 *
 * Las filas sin sede (virtuales) y las que tienen la ciudad vacía **no aportan
 * nada**: no se cuela un `''` a la lista, porque un claim sin ciudad —el
 * `.get('ciudad','')` de la regla— matchearía contra él y le abriría a un
 * publicador sin ciudad todas las actividades sin ciudad.
 *
 * @param {readonly { sede?: { ciudad?: string | null } | null }[]} [filas]
 * @returns {string[]}
 */
export const ciudadesDe = (filas = []) => [
  ...new Set(filas.map((f) => slugDeCiudad(f.sede?.ciudad)).filter(Boolean)),
];
