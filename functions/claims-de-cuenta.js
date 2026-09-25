/**
 * B-2052 — ¿quien escribió es una cuenta publicadora **con ciudad**?
 *
 * `syncCalendar` lo pregunta solo cuando una escritura trae una fila con sede y la
 * ciudad vacía (`sedesSinCiudadNuevas`, `derivados.js`). `ciudadesDe` descarta las
 * ciudades vacías (D-690), así que esa fila no suma nada a `ciudades` y la regla
 * `dentroDeSuCiudad()` pasa aunque la dirección sea de otra ciudad (D-1234). Un
 * admin puede cargar una sede sin ciudad legítimamente —fuera de CABA la ciudad
 * se exige solo en el panel del publicador (D-1154)—, así que avisar siempre sería
 * un mail por cada carga legítima. Lo que sí es una señal es que lo haga una
 * cuenta cuyo panel **no la deja**: la publicadora con ciudad. La general
 * (`--publicador` sin `--ciudad`, D-1152) carga donde quiera, así que una fila
 * suya sin ciudad no esquiva nada.
 *
 * El claim se lee del **registro de la cuenta** con el Admin SDK y no del
 * documento: `updatedBy` es lo único que el documento dice de quién escribió, y
 * la regla exige que sea el propio uid del publicador (`firestore.rules`).
 *
 * El `auth` se inyecta, igual que el `db` de `derivados-firestore.js`: así el test
 * de integración lo prueba contra el emulador de Auth sin cargar un trigger.
 *
 * **Sin caché.** Se consulta a lo sumo una vez por escritura, y solo en el caso
 * raro de arriba; una caché entre invocaciones además podría seguir tratando como
 * general a una cuenta a la que ya se le asignó ciudad.
 *
 * Necesita `roles/firebaseauth.viewer` para `calendar-sync@`
 * (docs/02-infraestructura.md § «Roles de `calendar-sync@`»). Sin ese rol,
 * `getUser` tira y el trigger avisa igual, con el código de error: ver
 * docs/08-operacion.md § «Cuando suena `sede-sin-ciudad`».
 */

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @returns {boolean}
 */
export const esPublicadorConCiudad = (claims) =>
  claims?.publicador === true && typeof claims.ciudad === 'string' && claims.ciudad !== '';

/**
 * @param {{ getUser: (uid: string) => Promise<{ customClaims?: Record<string, unknown> }> }} auth
 * @param {unknown} uid el `updatedBy` del documento, que puede venir de cualquier forma
 * @returns {Promise<boolean>}
 */
export const quienEscribioTieneCiudad = async (auth, uid) => {
  // Un documento escrito por un admin con el Admin SDK puede no traer `updatedBy`:
  // sin cuenta, no hay publicadora.
  if (typeof uid !== 'string' || uid === '') return false;
  const cuenta = await auth.getUser(uid);
  return esPublicadorConCiudad(cuenta.customClaims);
};
