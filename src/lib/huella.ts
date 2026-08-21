/**
 * Huella corta y estable de un uid. Marca quién creó una opción de taxonomía
 * para que su autor la siga viendo mientras espera aprobación (§4.3).
 *
 * **Por qué una huella y no el uid.** `/opciones/{campo}` es de lectura pública
 * (§5.3) y el §5.1 es explícito en que los uids no salen al público. Lo único
 * que necesita la visibilidad es una comparación de igualdad ("¿esta opción la
 * creé yo?"), y para eso alcanza un pseudónimo opaco: publicarlo no agrega
 * información sobre nadie.
 *
 * FNV-1a de 32 bits, a propósito:
 *
 * - **sincrónica** — `crypto.subtle` es async y obligaría a un estado de carga
 *   en el render de cada desplegable,
 * - **isomorfa** — mismo resultado en el navegador y en Node, sin partir la
 *   implementación entre `crypto.subtle` y `node:crypto`,
 * - **sin dependencias**.
 *
 * No es criptográfica y no hace falta que lo sea: no protege un secreto,
 * distingue personas. Con dos o tres cuentas la probabilidad de colisión es del
 * orden de 1 en mil millones, y si colisionara el daño es que alguien vería una
 * opción pendiente de más en su desplegable.
 *
 * Si hace falta saber *quién* creó una opción, el rastro está en la actividad
 * que la usa: `actividades.createdBy` guarda el uid y solo lo leen los admins.
 */
export const huellaCreador = (uid: string): string => {
  // Sin uid no hay huella: devolver un valor fijo haría que dos sesiones sin
  // usuario se reconocieran como la misma persona.
  if (!uid) return '';

  let h = 0x811c9dc5;
  for (let i = 0; i < uid.length; i += 1) {
    h ^= uid.charCodeAt(i);
    // Math.imul: la multiplicación de 32 bits sin perder precisión en doubles.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};
