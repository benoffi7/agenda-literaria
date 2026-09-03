/**
 * §5.4 — SOLO build time. Puede importarse desde frontmatter de `.astro`,
 * `getStaticPaths` o scripts de build. Si se cuela en un componente cliente,
 * la service account key termina en el bundle.
 *
 * La guarda de abajo hace que ese error explote en el build en vez de
 * filtrarse silenciosamente.
 */
import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (typeof window !== 'undefined') {
  throw new Error(
    'firebase-admin importado desde el cliente. Ver §5.4 de CLAUDE.md: ' +
      'esto filtra la service account key al bundle.',
  );
}

const PROJECT_ID = process.env.PUBLIC_FIREBASE_PROJECT_ID ?? 'agenda-literaria';

let _app: App | null = null;

/**
 * ¿Tenemos con qué leer Firestore en este build?
 *
 * Las tres fuentes son las que `credencial()` sabe usar, más el emulador. Es
 * deliberadamente una pregunta sobre el **entorno** y no un intento de conexión:
 * tiene que poder contestarse antes de inicializar nada y sin red.
 *
 * Lo que no ve: credenciales que vengan del metadata server de una máquina de
 * Google (`applicationDefault()` las encuentra sin ninguna variable). Un build ahí
 * quedaría bloqueado por esta guarda hasta exportar una de las tres. Es el lado
 * prudente del error: hoy el build corre en Actions con el secret y a mano en una
 * máquina de trabajo, y en los dos casos hay variable.
 */
export const hayCredenciales = (): boolean =>
  Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

const credencial = () => {
  // En CI la key viaja como secret en una variable de entorno, nunca en el repo.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return cert(JSON.parse(raw));
  // Local: GOOGLE_APPLICATION_CREDENTIALS, o nada si vamos contra el emulador.
  return applicationDefault();
};

/**
 * La app de admin, y **la única puerta a Firestore en build time**.
 *
 * ── B-189 · la guarda va acá, en la puerta, y no en el paso del workflow ──
 * `hayCredenciales()` existía desde el principio y no la llamaba nadie: era la
 * guarda escrita para el consumidor que todavía no existía, y el patrón que la
 * deja apagada es que el consumidor nazca sin llamarla. Puesta acá **no se puede
 * no llamar**: cualquier lectura de Firestore en el build —el `events.json` y las
 * páginas de detalle de B-106, y lo que venga después— pasa por esta función,
 * porque es el único módulo que puede hablar con el Admin SDK (§5.4).
 *
 * En el paso de build de los dos workflows habría cubierto menos: `1.1.0` se
 * desplegó a mano (`npm run build && firebase deploy`), que es justo el camino
 * que ningún `if` de un YAML mira.
 *
 * **Qué evita.** Un build sin credenciales que lee Firestore no falla: produce
 * cero actividades y un `events.json` vacío, y el deploy lo publica encima del
 * sitio que sí tenía datos. Sin error, sin log, con el workflow en verde. Es la
 * familia del `EXIGIR_EMULADOR=1` del §CI: "verde" no puede significar a la vez
 * "los datos están" y "no había datos que leer".
 *
 * **El camino local es el emulador**, que `hayCredenciales()` acepta: es lo que
 * el §10 pide para desarrollar, y evita que un build de prueba tenga que ver la
 * base de producción.
 */
export const adminApp = (): App => {
  if (_app) return _app;
  if (!hayCredenciales()) {
    throw new Error(
      'Build sin credenciales: no se puede leer Firestore, y un sitio vacío se ' +
        'publicaría encima del que tiene datos (B-189). Levantá el emulador ' +
        '(FIRESTORE_EMULATOR_HOST) o exportá FIREBASE_SERVICE_ACCOUNT o ' +
        'GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }
  if (getApps().length) {
    _app = getApps()[0]!;
    return _app;
  }
  // Contra el emulador (FIRESTORE_EMULATOR_HOST) no hace falta credencial real.
  _app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId: PROJECT_ID })
    : initializeApp({ credential: credencial(), projectId: PROJECT_ID });
  return _app;
};

export const adminDb = (): Firestore => getFirestore(adminApp());

/**
 * El nombre del bucket. **El mismo valor que `PUBLIC_FIREBASE_STORAGE_BUCKET`**
 * de los tres `.env.*` (`src/lib/firebase-client.ts`) y que
 * `scripts/optimizar-imagenes.mjs` — se explicita acá y no se deja al default
 * de la app porque `adminApp()` no configura `storageBucket` (solo lo necesita
 * Firestore).
 */
const BUCKET = process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'agenda-literaria.firebasestorage.app';

/**
 * El bucket de Storage en build time — B-320/B-321 (D-210).
 *
 * **Bypasea `storage.rules`, igual que `adminDb()` bypasea `firestore.rules`.**
 * Es el Admin SDK: lo que autoriza el acceso es el IAM de la service account
 * con la que corre el build (`deploy-ci@` en CI), no `allow get`/`allow list`
 * de `storage.rules` — esas reglas son para el SDK de cliente. Es la
 * consecuencia de IAM que `docs/08-operacion.md` ya deja anotada al lado de la
 * trampa 13: `allow list: if esAdmin()` protege **un canal y no el bucket**.
 *
 * **No hace falta otorgar nada para que esto funcione**, y conviene decirlo
 * porque la primera versión de D-210 suponía lo contrario: `deploy-ci@` ya
 * tiene `roles/firebase.developAdmin` (`docs/02-infraestructura.md` § «Roles
 * de `deploy-ci@`»), y ese rol incluye `storage.objects.list` y
 * `storage.objects.get`. Verificado contra el proyecto el 2026-09-03.
 *
 * El único consumidor es `miniaturasConocidas()` de `contenidoDelSitio.ts`,
 * que **lista** un prefijo y no baja ni un byte: el build no descarga imágenes
 * (DEC-7d) y esto no lo cambia.
 *
 * Respeta `FIREBASE_STORAGE_EMULATOR_HOST` para apuntar al emulador, igual que
 * `scripts/optimizar-imagenes.mjs` — es el cliente de `@google-cloud/storage`
 * el que lo resuelve, no código de acá.
 */
export const adminBucket = () => getStorage(adminApp()).bucket(BUCKET);
