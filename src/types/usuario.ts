/**
 * `/usuarios/{uid}` — el directorio de las cuentas del panel (B-888).
 *
 * Un documento por cuenta, con el id igual al uid de Firebase Auth. Es lo que
 * le permite al panel decir «la cargó fulano@…» en vez de mostrar un uid, sin
 * meterle el mail al documento de la actividad (D-610, que sigue en pie: acá el
 * dato vive **una vez**, fuera de `toPublic` y fuera del historial del §12).
 *
 * **No guarda el rol.** El rol es el custom claim del token y ese es su único
 * dueño; copiarlo acá crearía una segunda fuente de verdad que se desincroniza
 * en silencio el día que el dueño cambie un claim y la persona no vuelva a
 * entrar. Lo que esta colección contesta es una sola pregunta —qué mail tiene
 * este uid—, y para eso el rol no hace falta.
 */
export interface Usuario {
  /**
   * El mail de la cuenta, tal cual lo trae el ID token (`request.auth.token.email`).
   *
   * `firestore.rules` exige que sea **exactamente** ese y que venga verificado,
   * así que no es un campo que el cliente elija: es el mail de la cuenta de
   * Google con la que entró.
   */
  email: string;
  /** Cuándo se registró por última vez. Lo fuerza la regla con `request.time`. */
  actualizadoEn: unknown;
}

export type UsuarioConId = Usuario & { uid: string };

/**
 * El tope de largo del mail, atado a `firestore.rules`.
 *
 * Vive acá y se compara contra el archivo de reglas en `tests/usuarios.test.ts`,
 * que es el patrón de B-364: las reglas son un runtime aparte que no puede
 * importar TypeScript, así que la única forma de que los dos números no se
 * separen es que un test lea el archivo.
 */
export const TOPE_EMAIL_USUARIO = 200;
