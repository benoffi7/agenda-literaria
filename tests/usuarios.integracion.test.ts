/**
 * **`/usuarios/{uid}`: quién lo escribe y por qué se le puede creer** — B-888.
 *
 * El testigo de la **forma** de esta colección.
 * `escritura-anonima.integracion.test.ts` la barre sola —la lista de colecciones
 * sale de `firestore.rules`— pero es testigo de la **lista**, no de la forma:
 * prueba con un documento sonda (`{ hola: 'mundo' }`), que `usuarioValido()`
 * rechaza por `hasOnly` con la puerta abierta o cerrada. Lo que decide si el mail
 * es confiable se prueba acá.
 *
 * ── La propiedad que sostiene todo lo demás ───────────────────────────────
 * El admin ve el mail de quien cargó cada actividad, y ese mail tiene que ser
 * **el de esa cuenta**, no el que alguien haya querido escribir. La regla lo
 * consigue sin una Function: exige que el documento se escriba en el uid propio
 * y que el `email` sea **exactamente** `request.auth.token.email`, que es un
 * claim del ID token y no un dato que mande el cliente.
 *
 * Se verificó contra el emulador, y en los dos sentidos que importan: el token
 * trae `email` y `email_verified` (también entrando con un custom token, que es
 * como corren estos tests), y **un developer claim llamado `email` NO lo pisa** —
 * el token emitido sigue trayendo el del registro de la cuenta. Forjarlo pide la
 * service account, y quien la tiene no necesita esta colección para nada.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { PROJECT_ID, cargarReglas, emuladorAuthVivo, emuladorVivo, limpiarFirestore } from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const RUTA_REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID_ADMIN = 'uid_u888_admin';
const UID_PUB = 'uid_u888_publicador';
const UID_OTRO = 'uid_u888_otro';
const UID_SIN_VERIFICAR = 'uid_u888_sin_verificar';
const UID_SIN_MAIL = 'uid_u888_sin_mail';

// `ejemplo.test` (TLD reservado) y no un proveedor gratuito: ver el comentario
// de `tests/rol-publicador.integracion.test.ts` y `sin-datos-personales.test.ts`.
// Con sufijo propio de este archivo: el emulador de Auth NO se limpia entre
// archivos (`limpiarFirestore()` borra documentos, no cuentas) y una dirección
// ya tomada por otro uid hace fallar el alta con `EMAIL_EXISTS`. Es el emulador
// como estado compartido, la misma clase que B-219 con otra cara.
const MAIL_ADMIN = 'admin.u888@ejemplo.test';
const MAIL_PUB = 'publicador.u888@ejemplo.test';
const MAIL_OTRO = 'otro.u888@ejemplo.test';

const entrarComo = async (
  uid: string,
  claims: Record<string, unknown>,
  email: string,
  emailVerificado = true,
): Promise<void> => {
  const app = initAdmin({ projectId: PROJECT_ID }, `u888-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  // Alta o actualización según exista, y no `create` con `catch`: el alta falla
  // también por `EMAIL_EXISTS`, y ahí el `update` sobre un uid inexistente tira
  // un `user-not-found` que no dice nada del motivo real.
  const existe = await a.getUser(uid).then(() => true).catch(() => false);
  if (existe) await a.updateUser(uid, { email, emailVerified: emailVerificado });
  else await a.createUser({ uid, email, emailVerified: emailVerificado });
  await a.setCustomUserClaims(uid, claims);
  const t = await a.createCustomToken(uid);
  await deleteAdminApp(app);
  await signInWithCustomToken(auth(), t);
};

/**
 * Una cuenta **sin dirección de correo** y con `emailVerified: true`, que es el
 * caso que el emulador acepta y que tira abajo el supuesto del que casi cuelga
 * una cláusula borrada (ver el caso que lo usa).
 */
const entrarSinMail = async (uid: string, claims: Record<string, unknown>): Promise<void> => {
  const app = initAdmin({ projectId: PROJECT_ID }, `u888-sm-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  const existe = await a.getUser(uid).then(() => true).catch(() => false);
  if (!existe) await a.createUser({ uid, emailVerified: true });
  await a.setCustomUserClaims(uid, claims);
  const t = await a.createCustomToken(uid);
  await deleteAdminApp(app);
  await signInWithCustomToken(auth(), t);
};

const rechazada = async (operacion: Promise<unknown>, que: string): Promise<void> => {
  let error: unknown;
  try {
    await operacion;
  } catch (e) {
    error = e;
  }
  expect(error, `${que}: NO se rechazó`).toBeDefined();
  expect((error as { code?: string }).code, `${que}: se rechazó, pero no por permisos`).toBe(
    'permission-denied',
  );
};

/** El documento que la regla acepta: los dos campos, y el `actualizadoEn` del servidor. */
const registro = (email: string) => ({ email, actualizadoEn: serverTimestamp() });

describe.skipIf(!vivo)('/usuarios — el directorio de las cuentas del panel (B-888)', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(RUTA_REGLAS);
  }, 30_000);

  afterAll(async () => {
    await signOut(auth());

    /*
     * **Y se limpia al SALIR, no solo al entrar** — y esto lo cobró el gate, no un
     * test. Todos los archivos de integración de este repo limpian en el
     * `beforeAll` y dejan sus documentos puestos al terminar; funcionaba porque los
     * que siembran `/actividades` siembran **documentos completos**. Los de acá son
     * mínimos a propósito (lo que se mide es quién puede tocarlos, no qué campos
     * tienen), así que dejarlos puestos le da de comer al **paso 4 de
     * `scripts/verificar-todo.sh`** —que buildea contra el MISMO emulador, después
     * de los tests— una actividad sin `tipo`, y `toPublic` muere con
     * `Cannot read properties of undefined`. Se reprodujo: el gate quedó en
     * «el build no pasa» por culpa de este archivo.
     *
     * O sea: el emulador es estado compartido **entre pasos del gate**, no solo
     * entre archivos de la suite (que es lo que dice B-219). Limpiar al salir es
     * barato y saca el acoplamiento.
     */
    await limpiarFirestore();
  });

  describe('el control positivo', () => {
    it('cada cuenta se registra con su mail, y el admin las lee todas', async () => {
      // Sin esto, todas las negaciones de abajo las pasa también un `if false`
      // (y un emulador caído, y una base sin reglas).
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      await setDoc(doc(db(), 'usuarios', UID_PUB), registro(MAIL_PUB));
      expect((await getDoc(doc(db(), 'usuarios', UID_PUB))).data()?.email).toBe(MAIL_PUB);

      await entrarComo(UID_ADMIN, { admin: true }, MAIL_ADMIN);
      await setDoc(doc(db(), 'usuarios', UID_ADMIN), registro(MAIL_ADMIN));
      const todos = await getDocs(collection(db(), 'usuarios'));
      expect(todos.docs.map((d) => d.id).sort()).toEqual([UID_ADMIN, UID_PUB].sort());
    });

    it('registrarse dos veces es idempotente: refresca, no duplica', async () => {
      // Es lo que hace que el mail **no envejezca**: se reescribe en cada login
      // desde el token, en vez de quedar cableado a mano (el defecto que D-610 le
      // señalaba al mapa uid→nombre).
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      await setDoc(doc(db(), 'usuarios', UID_PUB), registro(MAIL_PUB));
      await setDoc(doc(db(), 'usuarios', UID_PUB), registro(MAIL_PUB));
      // El conteo lo hace el admin: **el publicador no puede listar** (la regla
      // condiciona por ruta y eso no es satisfacible en un `list`), y ese rechazo
      // es justamente lo que afirma el caso «tampoco lista el directorio entero».
      await entrarComo(UID_ADMIN, { admin: true }, MAIL_ADMIN);
      const suyos = (await getDocs(collection(db(), 'usuarios'))).docs.filter(
        (d) => d.id === UID_PUB,
      );
      expect(suyos).toHaveLength(1);
      expect(suyos[0]!.data().email).toBe(MAIL_PUB);
    });
  });

  describe('escalar escribiendo en /usuarios', () => {
    beforeAll(async () => {
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
    });

    it('no escribe el documento de otro uid', async () => {
      /*
       * La pregunta directa del modelo de amenaza: ¿puede un publicador escribirle
       * el mail a otra cuenta para que el panel la muestre mal? No: el uid es el
       * del **path**, y tiene que ser el de la sesión.
       *
       * Mutación: borrar `uid == request.auth.uid` del `allow create, update`.
       * Este caso se pone rojo.
       */
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_OTRO), registro(MAIL_PUB)),
        'escribir el registro de otra cuenta',
      );
    });

    it('no escribe un mail que no es el suyo, ni siquiera en su propio uid', async () => {
      /*
       * **Ésta es la cláusula de la que depende que al mail se le pueda creer.**
       * Sin ella, el uid propio alcanzaría para presentarse con la dirección de
       * cualquier otra persona del equipo, y el filtro «quién lo creó» del admin
       * estaría mostrando lo que el publicador quiso.
       *
       * Mutación: borrar `d.email == request.auth.token.get('email','')`. Este caso
       * se pone rojo.
       */
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_PUB), registro(MAIL_OTRO)),
        'registrarse con el mail de otra cuenta',
      );
    });

    it('no se agrega un campo de más — no hay `rol`, `admin` ni nada que escalar', async () => {
      /*
       * El documento **no guarda el rol**, a propósito: el rol es el custom claim y
       * ése es su único dueño. `hasOnly` es lo que hace que eso sea una propiedad y
       * no una costumbre — sin él, un campo `rol: 'admin'` entraría al documento y
       * cualquier pantalla que lo leyera estaría leyendo una autorización que nadie
       * verificó.
       *
       * Mutación: borrar el `hasOnly` de `usuarioValido()`. Este caso se pone rojo.
       */
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_PUB), { ...registro(MAIL_PUB), rol: 'admin' }),
        'meter un rol en el registro propio',
      );
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_PUB), { ...registro(MAIL_PUB), admin: true }),
        'meter un flag admin en el registro propio',
      );
    });

    it('no escribe un registro sin mail ni antedatado', async () => {
      /*
       * La clave ausente y el valor equivocado son **el mismo rechazo**, y eso es
       * lo que hace que `hasAll` no haga falta en esta función: `.get('email','')`
       * devuelve el default, y el default no puede ser igual al mail del token.
       * Está explicado en el bloque de `usuarioValido()`, y lo descubrió la
       * mutación: con `hasAll` borrado, este caso seguía rojo.
       *
       * Mutación: borrar `d.get('email','') == request.auth.token.get('email','')`
       * → el primero se pone rojo (y también el caso del mail ajeno, que es la
       * otra cara). Borrar `d.get('actualizadoEn', null) == request.time` → el
       * segundo.
       */
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_PUB), { actualizadoEn: serverTimestamp() }),
        'un registro sin mail',
      );
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_PUB), {
          email: MAIL_PUB,
          actualizadoEn: new Date('2020-01-01'),
        }),
        'antedatar el registro',
      );
    });

    it('no borra ningún registro, ni el suyo', async () => {
      /*
       * `allow delete: if false`, y es una decisión: las actividades que cargó una
       * cuenta sobreviven al claim, y su `createdBy` las sigue señalando. Borrar el
       * registro dejaría al panel mostrando un uid pelado en trabajo que sí pasó.
       *
       * Mutación: `allow delete: if uid == request.auth.uid`. Este caso se pone rojo.
       */
      await setDoc(doc(db(), 'usuarios', UID_PUB), registro(MAIL_PUB));
      const { deleteDoc } = await import('firebase/firestore');
      await rechazada(deleteDoc(doc(db(), 'usuarios', UID_PUB)), 'borrar el registro propio');
    });
  });

  describe('leer lo que no es suyo', () => {
    it('un publicador no lee el registro de otra cuenta', async () => {
      // El directorio tiene los mails del equipo. El único que necesita el mapa
      // completo es el admin, que es quien muestra la autoría.
      //
      // Mutación: cambiar el `allow read` por `esDelPanel()`. Este caso se pone rojo.
      await entrarComo(UID_ADMIN, { admin: true }, MAIL_ADMIN);
      await setDoc(doc(db(), 'usuarios', UID_ADMIN), registro(MAIL_ADMIN));

      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      await rechazada(getDoc(doc(db(), 'usuarios', UID_ADMIN)), 'leer el registro del admin');
    });

    it('un publicador tampoco lista el directorio entero', async () => {
      /*
       * La condición es por **ruta** (`uid == request.auth.uid`), y una condición
       * por ruta no es satisfacible en un `list`: Firestore rechaza la query
       * completa. O sea que `listarUsuarios()` es del admin y de nadie más, y el
       * rechazo es limpio y no una lista recortada.
       */
      await entrarComo(UID_PUB, { publicador: true }, MAIL_PUB);
      await rechazada(getDocs(collection(db(), 'usuarios')), 'listar el directorio');
    });

    it('un anónimo no lee nada: no es una salida pública', async () => {
      await signOut(auth());
      await rechazada(getDoc(doc(db(), 'usuarios', UID_PUB)), 'leer un registro sin sesión');
      await rechazada(getDocs(collection(db(), 'usuarios')), 'listar el directorio sin sesión');
    });
  });

  describe('el mail sin verificar', () => {
    it('una cuenta con el mail sin verificar no se registra', async () => {
      /*
       * Hoy el login es solo con Google (`loginConGoogle`, `firebase-client.ts`) y
       * eso llega siempre verificado — así que esta cláusula **no se cobra hoy**, y
       * eso es exactamente por qué tiene que tener su caso: el día que alguien
       * habilite mail+contraseña en la consola, un alta deja elegir la dirección
       * **sin probarla**, y sin esto esa cuenta podría presentarse con el mail de
       * otra persona del equipo. Es la única cláusula del bloque cuyo riesgo vive
       * en una casilla de la consola de Firebase y no en el código.
       *
       * Mutación: borrar `request.auth.token.get('email_verified', false) == true`.
       * Este caso se pone rojo.
       */
      await entrarComo(
        UID_SIN_VERIFICAR,
        { publicador: true },
        'sin-verificar.u888@ejemplo.test',
        false,
      );
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_SIN_VERIFICAR), registro('sin-verificar.u888@ejemplo.test')),
        'registrarse con un mail sin verificar',
      );
    });

    it('una cuenta SIN dirección no se registra con el mail vacío', async () => {
      /*
       * **El caso que tiró abajo un argumento, y por eso existe la cláusula que
       * verifica.** El borrador de `usuarioValido()` iba a borrar
       * `d.get('email','').size() > 0` junto con las otras tres cláusulas muertas,
       * con este razonamiento: «queda cubierto por `email_verified`, que no puede
       * ser true en una cuenta sin dirección». Lo marcó el `auditor-privacidad`
       * como un supuesto sobre Identity Platform **declarado sin verificar**, se
       * probó, y es falso: el emulador acepta `createUser({ emailVerified: true })`
       * sin `email`, y el token sale con `email_verified: true` y **sin** claim
       * `email`.
       *
       * Con eso, `.get('email','')` da `''` de los dos lados —el documento y el
       * token—, `'' == ''` es true, y el registro entraría con el mail vacío. No
       * es una fuga: es una fila en blanco en el directorio, y una promesa de la
       * doc («el mail de cada cuenta») que dejaría de ser cierta.
       *
       * Mutación: borrar `d.get('email','').size() > 0` de `usuarioValido()`.
       * Este caso se pone rojo, y **ningún otro se mueve** — que es lo que lo
       * hace el único testigo de esa cláusula.
       */
      await entrarSinMail(UID_SIN_MAIL, { publicador: true });
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_SIN_MAIL), { email: '', actualizadoEn: serverTimestamp() }),
        'registrarse con el mail vacío',
      );
    });
  });
});
