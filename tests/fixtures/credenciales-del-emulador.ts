/**
 * Las credenciales de los tests de integración — B-1060.
 *
 * Catorce archivos de `tests/*.integracion.test.ts` armaban su propia cuenta y
 * su propio custom token contra el emulador de Auth. El cuerpo era casi el
 * mismo en todos —app admin efímera, `createUser`, `setCustomUserClaims`,
 * `createCustomToken`, `deleteApp`— y las diferencias entre las copias eran
 * **el problema**: casi todas accidentales (el nombre del helper, el prefijo de
 * la app, `esAdmin: boolean` contra un objeto de claims, devolver el token
 * contra loguearse adentro), y dos de verdad deliberadas, que quedan acá como
 * **opciones con nombre** en vez de como un cuerpo distinto que hay que leer
 * entero para notar en qué se parte:
 *
 *  - `claimsEnElToken` — la vía **infiel** a producción (B-895, **B-1030**);
 *  - `email` / `emailVerificado` — el correo va en el **registro de la cuenta**
 *    y nunca en los claims (B-888).
 *
 * El costo de la copia no era el tipeo. Era que una copia podía diferir en algo
 * que importa sin que nadie lo viera: B-895 unificó diez archivos hacia la vía
 * de producción y **se salteó `reportes-resuelto.integracion.test.ts`**, que
 * pasaba los claims por las dos vías a la vez y por eso no se habría caído
 * aunque la vía fiel dejara de funcionar. Nadie lo notó hasta que se contaron
 * las catorce copias una al lado de la otra.
 *
 * `tests/credenciales-del-emulador.test.ts` barre `tests/` para que la copia
 * quince no vuelva a nacer.
 */
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { PROJECT_ID } from '../emulador';

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
   * `emailVerified` del registro. Se puede pedir **sin** `email`: una cuenta sin
   * dirección y con `emailVerified: true` es un caso que el emulador acepta y
   * que tira abajo el supuesto del que colgaba una cláusula de `/usuarios`.
   */
  emailVerificado?: boolean;
  /**
   * Embeber los claims **dentro** del custom token, además del registro — la
   * vía **infiel** a producción, y por eso hay que pedirla a mano.
   *
   * Producción pone los claims con `setCustomUserClaims` y nada más
   * (`npm run admin:claim`, `scripts/set-admin-claim.mjs`), y el panel lee el
   * claim del token de sesión que sale de ahí. Un custom token con claims
   * embebidos toma un atajo que producción no tiene, y mientras B-894 estuvo
   * vivo ese atajo **tapaba** el desajuste: los tests pasaban por la vía que
   * nunca se usa (B-895).
   *
   * Existe igual porque hoy **sostiene un hallazgo**:
   * `tests/storage-reglas.integracion.test.ts` es el único archivo que la
   * necesita, y seis de sus diecinueve casos se ponen rojos al sacarla. Eso es
   * **B-1030** —`storage.rules` no ve el claim cuando llega por el registro y
   * `firestore.rules` sí—, todavía sin decidir si es del emulador o de
   * producción. Unificar ese archivo a la vía fiel taparía el ítem, así que la
   * opción se llama por su nombre y se pide explícita.
   *
   * **No la uses en un archivo nuevo.** Si un test tuyo solo pasa con esto,
   * encontraste otra cara de B-1030 y lo que corresponde es anotarlo.
   */
  claimsEnElToken?: boolean;
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
  const { email, emailVerificado, claimsEnElToken = false, etiqueta = 'cred' } = opciones;

  const app = initAdmin(
    { projectId: PROJECT_ID },
    `${etiqueta}-${uid}-${Date.now()}-${Math.random()}`,
  );
  const a = getAdminAuth(app);
  try {
    const datos: { email?: string; emailVerified?: boolean } = {};
    if (email !== undefined) datos.email = email;
    if (emailVerificado !== undefined) datos.emailVerified = emailVerificado;

    const existe = await a.getUser(uid).then(() => true).catch(() => false);
    if (!existe) await a.createUser({ uid, ...datos });
    else if (Object.keys(datos).length > 0) await a.updateUser(uid, datos);

    // La vía de producción, siempre. `claimsEnElToken` **agrega** la otra, no la
    // reemplaza: así el archivo que la pide registra el claim igual que el resto
    // y lo único que cambia es que además viaja adentro del token.
    await a.setCustomUserClaims(uid, claims);
    return await a.createCustomToken(uid, claimsEnElToken ? claims : undefined);
  } finally {
    await deleteAdminApp(app);
  }
};

/** `tokenDe` y el login del cliente, que es lo que casi todos los tests quieren. */
export const entrarComo = async (
  uid: string,
  claims: Claims = {},
  opciones: OpcionesDeCuenta = {},
): Promise<void> => {
  await signInWithCustomToken(auth(), await tokenDe(uid, claims, opciones));
};
