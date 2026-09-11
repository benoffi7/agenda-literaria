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
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { TOPE_EMAIL_USUARIO } from '@/types/usuario';
import { PROJECT_ID, cargarReglas, emuladorAuthVivo, emuladorVivo, limpiarFirestore } from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const RUTA_REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID_ADMIN = 'uid_u888_admin';
const UID_PUB = 'uid_u888_publicador';
const UID_OTRO = 'uid_u888_otro';
const UID_SIN_VERIFICAR = 'uid_u888_sin_verificar';

// `ejemplo.test` (TLD reservado) y no un proveedor gratuito: ver el comentario
// de `tests/rol-publicador.integracion.test.ts` y `sin-datos-personales.test.ts`.
const MAIL_ADMIN = 'admin@ejemplo.test';
const MAIL_PUB = 'publicador@ejemplo.test';
const MAIL_OTRO = 'otro@ejemplo.test';

const entrarComo = async (
  uid: string,
  claims: Record<string, unknown>,
  email: string,
  emailVerificado = true,
): Promise<void> => {
  const app = initAdmin({ projectId: PROJECT_ID }, `u888-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid, email, emailVerified: emailVerificado });
  } catch {
    await a.updateUser(uid, { email, emailVerified: emailVerificado });
  }
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
      expect((await getDocs(collection(db(), 'usuarios'))).docs.filter((d) => d.id === UID_PUB)).toHaveLength(1);
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
      // Mutación: borrar `hasAll` → el primero se pone rojo. Borrar
      // `d.actualizadoEn == request.time` → el segundo.
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
        'sin-verificar@ejemplo.test',
        false,
      );
      await rechazada(
        setDoc(doc(db(), 'usuarios', UID_SIN_VERIFICAR), registro('sin-verificar@ejemplo.test')),
        'registrarse con un mail sin verificar',
      );
    });
  });

  describe('el tope de largo vive en dos runtimes', () => {
    it('`firestore.rules` dice el mismo número que `TOPE_EMAIL_USUARIO`', () => {
      /*
       * El patrón de B-364: las reglas son un runtime aparte que no puede importar
       * TypeScript, así que la única forma de que los dos números no se separen es
       * que un test lea el archivo. Sin esto, subir el tope en un lado deja al otro
       * rechazando lo que el primero acepta, y el síntoma aparece con un mail largo.
       */
      const reglas = readFileSync(RUTA_REGLAS, 'utf8');
      const bloque = reglas.slice(
        reglas.indexOf('function usuarioValido()'),
        reglas.indexOf('match /usuarios/{uid}'),
      );
      expect(bloque.length, 'no se encontró el bloque de usuarioValido()').toBeGreaterThan(0);
      const m = /d\.email\.size\(\) <= (\d+)/.exec(bloque);
      expect(m, 'no se encontró el tope del mail en firestore.rules').not.toBeNull();
      expect(Number(m![1])).toBe(TOPE_EMAIL_USUARIO);
    });
  });
});
