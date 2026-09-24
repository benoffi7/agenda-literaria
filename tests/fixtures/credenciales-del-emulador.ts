/**
 * Las credenciales de los tests de integración — B-1060.
 *
 * Catorce archivos de `tests/*.integracion.test.ts` armaban su propia cuenta y
 * su propio custom token contra el emulador de Auth. El cuerpo era casi el
 * mismo en todos —app admin efímera, `createUser`, `setCustomUserClaims`,
 * `createCustomToken`, `deleteApp`— y las diferencias entre las copias eran
 * **el problema**: casi todas accidentales (el nombre del helper, el prefijo de
 * la app, `esAdmin: boolean` contra un objeto de claims, devolver el token
 * contra loguearse adentro), y una sola de verdad deliberada, que queda acá
 * como **opción con nombre** en vez de como un cuerpo distinto que hay que leer
 * entero para notar en qué se parte: `email` / `emailVerificado`, porque el
 * correo va en el **registro de la cuenta** y nunca en los claims (B-888).
 *
 * El costo de la copia no era el tipeo. Era que una copia podía diferir en algo
 * que importa sin que nadie lo viera: B-895 unificó diez archivos hacia la vía
 * de producción y **se salteó `reportes-resuelto.integracion.test.ts`**, que
 * pasaba los claims por las dos vías a la vez y por eso no se habría caído
 * aunque la vía fiel dejara de funcionar. Nadie lo notó hasta que se contaron
 * las catorce copias una al lado de la otra.
 *
 * **Una sola vía para los claims: `setCustomUserClaims`, la de producción.** Es
 * lo que hace `npm run admin:claim` (`scripts/set-admin-claim.mjs`) y es como le
 * llega el claim al panel. Este helper **no ofrece** embeberlos dentro del
 * custom token, y la ausencia es la decisión: mientras B-894 estuvo vivo esa
 * segunda vía **tapaba** el desajuste (B-895), y el único archivo que parecía
 * necesitarla —`storage-reglas.integracion.test.ts`— resultó estar midiendo el
 * worktree y no a Storage (**B-1030**, cerrado el 2026-09-17: la misma mutación
 * en el árbol principal da 19/19). Si un test tuyo solo pasa con los claims
 * adentro del token, lo que encontraste es otra cara de **B-1021** —un emulador
 * medido desde un directorio que no es el que lo levantó— y lo que corresponde
 * es anotarlo, no volver a agregar la vía.
 *
 * `tests/credenciales-del-emulador.test.ts` barre `tests/` para que la copia
 * quince no vuelva a nacer.
 */
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { faltaVerificarProyectoDeAuth, proyectoDeAuth, verificarProyectoDeAuth } from '../emulador';

/**
 * Los claims de la cuenta. `unknown` y no `boolean` porque el valor no siempre
 * es un flag: el `publicador` de B-888 viaja con su lista de ciudades al lado.
 */
export type Claims = Record<string, unknown>;

export interface OpcionesDeCuenta {
  /**
   * La dirección de correo de la cuenta, en el **registro** — nunca un claim
   * llamado `email`.
   *
   * Se verificó contra el emulador que un claim `email` en el custom token **no
   * pisa** el del registro, así que `request.auth.token.email` es siempre el de
   * la cuenta. Es la propiedad sobre la que descansa `/usuarios` (B-888), y por
   * eso el helper no deja elegir: el correo entra por acá o no entra.
   */
  email?: string;
  /**
   * `emailVerified` del registro. **Con `email`, el default es `true`**, porque
   * así entra todo el mundo en producción: el login del panel es con Google y
   * ese mail viene verificado. La cuenta sin verificar es la excepción, y por
   * eso se pide a mano (`{ email, emailVerificado: false }`).
   *
   * Se puede pedir **sin** `email`: una cuenta sin dirección y con
   * `emailVerified: true` es un caso que el emulador acepta y que tira abajo el
   * supuesto del que colgaba una cláusula de `/usuarios`.
   */
  emailVerificado?: boolean;
  /**
   * Prefijo del nombre de la app admin efímera. Solo sirve para leer una traza:
   * el nombre termina siendo único de todos modos.
   */
  etiqueta?: string;
}

/**
 * Deja la cuenta como la pide `opciones` y devuelve un custom token para ella.
 *
 * El alta es `getUser` → `updateUser` o `createUser`, y **no** `createUser` con
 * un `catch` vacío como tenían once de las catorce copias: el emulador de Auth
 * no se limpia entre archivos, así que la cuenta puede venir de una corrida
 * anterior, y el alta también falla por `EMAIL_EXISTS` — que el `catch` vacío se
 * tragaba, dejando la cuenta con el mail viejo y el test rojo por un motivo que
 * no se parecía en nada a la causa.
 */
export const tokenDe = async (
  uid: string,
  claims: Claims = {},
  opciones: OpcionesDeCuenta = {},
): Promise<string> => {
  const { email, emailVerificado, etiqueta = 'cred' } = opciones;

  // El proyecto del emulador de **Auth**, no la base de Firestore de este
  // checkout — B-1201, D-1020. Auth es de un solo proyecto, el de su
  // `--project` de arranque; con `PROJECT_ID` los claims quedaban en un
  // namespace donde el cliente nunca entra, salvo que el emulador se hubiera
  // levantado desde este mismo checkout.
  const app = initAdmin(
    { projectId: await proyectoDeAuth() },
    `${etiqueta}-${uid}-${Date.now()}-${Math.random()}`,
  );
  const a = getAdminAuth(app);
  try {
    const datos: { email?: string; emailVerified?: boolean } = {};
    if (email !== undefined) {
      datos.email = email;
      datos.emailVerified = emailVerificado ?? true;
    } else if (emailVerificado !== undefined) {
      datos.emailVerified = emailVerificado;
    }

    const existe = await a.getUser(uid).then(() => true).catch(() => false);
    if (!existe) await a.createUser({ uid, ...datos });
    else if (Object.keys(datos).length > 0) await a.updateUser(uid, datos);

    // Los claims se **escriben siempre**, también cuando `claims` viene vacío:
    // el emulador de Auth no se limpia entre archivos, así que «esta cuenta no
    // tiene claims» tiene que ser una afirmación y no una suposición sobre lo
    // que dejó la corrida anterior.
    await a.setCustomUserClaims(uid, claims);
    return await a.createCustomToken(uid);
  } finally {
    await deleteAdminApp(app);
  }
};

/**
 * `tokenDe` y el login del cliente, que es lo que casi todos los tests quieren.
 *
 * El primer login del proceso paga además una lectura del ID token, para
 * `verificarProyectoDeAuth` (D-730, B-1112): es el único momento donde el
 * desajuste de proyecto del emulador de Auth es visible, y si no se mira acá el
 * síntoma llega después como un `PERMISSION_DENIED` sobre un documento válido.
 * Del segundo login en adelante no cuesta nada.
 */
export const entrarComo = async (
  uid: string,
  claims: Claims = {},
  opciones: OpcionesDeCuenta = {},
): Promise<void> => {
  const credencial = await signInWithCustomToken(auth(), await tokenDe(uid, claims, opciones));
  if (faltaVerificarProyectoDeAuth()) {
    verificarProyectoDeAuth(await credencial.user.getIdToken(), await proyectoDeAuth());
  }
};
