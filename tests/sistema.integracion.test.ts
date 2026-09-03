/**
 * Reglas de `/sistema/{doc}` contra el emulador — la colección que nadie estaba
 * probando.
 *
 * ── Por qué existe ahora y no antes ────────────────────────────────────────
 * Lo pidió el `auditor-privacidad` sobre B-374/B-373. `/actividades`,
 * `/opciones`, `/reportes` y Storage tienen cada uno su test de reglas contra el
 * emulador; `/sistema/*` **no tenía ninguno**, y hasta el 2026-09-03 eso era
 * barato: ahí vivía `rebuild.pendiente`, un booleano y una marca de tiempo.
 *
 * Desde B-374/B-373 ahí vive **`analitica-sitio`**: los rankings de páginas de
 * GA4, de dónde entra la gente, y las consultas con las que Google nos muestra
 * — que son texto que una persona tipeó en el buscador de Google. La regla
 * correcta ya estaba escrita (`read: if esAdmin()` / `write: if false`), y lo
 * que faltaba era que **nada la sostuviera**: aflojarla a `allow read: if true`
 * no rompe ni un test, y la tentación es concreta —es exactamente lo que haría
 * falta el día que alguien quiera poner «X visitas este mes» en el sitio
 * público—.
 *
 * Es la misma lección de **D-128**: la regla de `/actividades` estaba abierta
 * «solo para lo publicado» y entregaba el documento entero, y lo que lo cerró
 * fueron dos `it` contra el emulador, uno por documento y otro por query.
 *
 * ── Y por qué `write: if false` también se verifica ────────────────────────
 * El documento lo escribe el Admin SDK desde una Cloud Function, que **no pasa
 * por las reglas**. O sea que `write: if false` no le estorba a nadie y sí
 * cierra la puerta: ni el panel, ni un admin, ni un anónimo pueden escribirle
 * al tablero del dueño un número inventado.
 *
 * Se saltea solo si el emulador no está, como el resto de los `.integracion`.
 * Las reglas que se verifican son las de **este** checkout (B-174/B-219): se
 * empujan por la API del emulador en el `beforeAll`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { RUTA_RESUMEN } from '@/lib/analiticaDelSitio';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());

const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID_ADMIN = 'uid_sistema_admin';
const UID_PELADO = 'uid_sistema_sin_claim';

const tokenPara = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `s-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, esAdmin ? { admin: true } : {});
  const token = await a.createCustomToken(uid, esAdmin ? { admin: true } : {});
  await deleteAdminApp(app);
  return token;
};

/** El path del resumen, armado con la constante que usa el panel de verdad. */
const RUTA = RUTA_RESUMEN.join('/');

/**
 * Afirma que se rechazó **por permisos** y no por cualquier otra cosa — el
 * mismo helper que `actividades.integracion.test.ts`, y por el mismo motivo que
 * su docblock explica: un `rejects.toThrow()` pelado también lo satisface un
 * emulador caído, y entonces los tests de reglas pintan verde sin haber
 * probado ninguna regla.
 *
 * Y **no se aprieta el mensaje**: para una lectura denegada el emulador no
 * devuelve «Missing or insufficient permissions» —eso es de las escrituras—
 * sino la traza de evaluación (`false for 'get' @ L242`). El `code` de la
 * `FirebaseError` es `permission-denied` en los dos casos, y `unavailable` si
 * el emulador no está: eso es lo que separa «la regla denegó» de «no se pudo
 * preguntar». Se comprobó acá también: el matcher por mensaje falla en las
 * tres lecturas.
 */
const rechazadaPorPermisos = async (operacion: Promise<unknown>, que: string) => {
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

describe.skipIf(!vivo)('las reglas de /sistema contra el emulador', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);

    /*
     * El documento lo siembra el **Admin SDK**, que es exactamente quien lo
     * escribe en producción (la Cloud Function) y quien no pasa por las reglas.
     * Sembrarlo desde el cliente sería imposible —`write: if false`— y eso es
     * justamente lo que uno de los casos de abajo verifica.
     */
    const app = initAdmin({ projectId: PROJECT_ID }, `s-seed-${Date.now()}`);
    await getAdminFirestore(app)
      .doc(RUTA)
      .set({
        version: 1,
        generadoEn: '2026-10-15T10:00:00.000Z',
        ga4: { estado: 'ok', hayDatos: true, paginas: [{ clave: '/', valor: 480 }] },
        searchConsole: {
          estado: 'ok',
          hayDatos: true,
          busquedas: [{ clave: 'CENTINELA taller de escritura', clics: 3 }],
        },
      });
    await deleteAdminApp(app);
  }, 30_000);

  it('un anónimo NO puede leer el resumen de la analítica', async () => {
    /*
     * **El caso que motiva el archivo.** Adentro de ese documento hay texto que
     * gente tipeó en Google (el centinela de la semilla) y el ranking de páginas
     * del sitio. Con `allow read: if true` esto pasaría a verde sin que nada
     * más cambie — que es cómo la puerta de D-128 estuvo abierta.
     *
     * MUTACIÓN PROBADA: se cambió `match /sistema/{doc}` a
     * `allow read: if true;` en `firestore.rules` y este caso pasó a rojo; se
     * restauró y volvió a pasar.
     */
    await signOut(auth());
    await rechazadaPorPermisos(getDoc(doc(db(), ...RUTA_RESUMEN)), 'anónimo lee el resumen');
  });

  it('y tampoco puede LISTAR la colección — get y list son dos permisos', async () => {
    /*
     * Hoy es redundante: `allow read` cubre `get` **y** `list`, así que si el
     * `get` denegó el `list` también. Pero es exactamente el par que
     * `actividades.integracion.test.ts` separa a propósito desde D-128, y por el
     * mismo motivo que la trampa 13 del §13 lo dice para Storage: son dos
     * permisos, y una regla que los separe mal —`allow get: if esAdmin();
     * allow list: if true;`— entrega la colección entera sin que el caso de
     * arriba se entere. Lo pidió el `auditor-privacidad`.
     */
    await signOut(auth());
    await rechazadaPorPermisos(
      getDocs(collection(db(), 'sistema')),
      'anónimo lista /sistema entera',
    );
  });

  it('un usuario logueado SIN el claim de admin tampoco', async () => {
    // Entrar con Google no alcanza: el claim se setea a mano con el Admin SDK
    // (§5.3). Es la diferencia entre «hay login» y «hay autorización».
    await signInWithCustomToken(auth(), await tokenPara(UID_PELADO, false));
    await rechazadaPorPermisos(
      getDoc(doc(db(), ...RUTA_RESUMEN)),
      'logueado sin claim lee el resumen',
    );
  });

  it('un admin sí lo lee — que es lo que hace la pestaña del panel', async () => {
    await signInWithCustomToken(auth(), await tokenPara(UID_ADMIN, true));
    const snap = await getDoc(doc(db(), ...RUTA_RESUMEN));
    expect(snap.exists()).toBe(true);
    expect(snap.data()!.ga4.estado).toBe('ok');
  });

  it('NADIE escribe /sistema desde el cliente, ni siquiera un admin', async () => {
    /*
     * `write: if false` para todos. Lo escribe el Admin SDK desde la Function,
     * que no pasa por reglas, así que la restricción no le estorba a nadie —y
     * cierra que el panel (o alguien con el claim) le pise al tablero un número
     * inventado o borre el flag de rebuild.
     */
    await signInWithCustomToken(auth(), await tokenPara(UID_ADMIN, true));
    await rechazadaPorPermisos(
      setDoc(doc(db(), ...RUTA_RESUMEN), { version: 99 }, { merge: true }),
      'un admin pisa el resumen',
    );
    // Y tampoco un documento nuevo de la misma colección.
    await rechazadaPorPermisos(
      setDoc(doc(db(), 'sistema', 'inventado'), { x: 1 }),
      'un admin crea un documento en /sistema',
    );
  });

  it('el flag de rebuild vive en la misma colección y tiene las mismas reglas', async () => {
    // Control de que el `match /sistema/{doc}` es por comodín y no por
    // documento: si alguien lo especializara para `analitica-sitio`, el flag de
    // rebuild se quedaría sin regla y caería en el `allow read, write: if false`
    // final — el panel dejaría de poder mirarlo sin que nada lo diga.
    const app = initAdmin({ projectId: PROJECT_ID }, `s-reb-${Date.now()}`);
    await getAdminFirestore(app).doc('sistema/rebuild').set({ pendiente: false });
    await deleteAdminApp(app);

    await signInWithCustomToken(auth(), await tokenPara(UID_ADMIN, true));
    expect((await getDoc(doc(db(), 'sistema', 'rebuild'))).exists()).toBe(true);

    await signOut(auth());
    await rechazadaPorPermisos(
      getDoc(doc(db(), 'sistema', 'rebuild')),
      'anónimo lee el flag de rebuild',
    );
  });
});
