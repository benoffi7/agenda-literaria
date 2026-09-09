/**
 * **Hoy nadie escribe sin el claim `admin`** — el control positivo de B-836 y de
 * los cuatro PRDs de `docs/prd/`.
 *
 * ── Para qué existe, y por qué se escribe ANTES de abrir la puerta ─────────
 * Los cuatro formularios públicos (`prd/README.md` § 2) abren **la primera
 * escritura anónima del proyecto**. Hoy no hay ninguna: `firestore.rules` es
 * tajante y el `match /{document=**}` del final cierra todo lo que no se nombró.
 * Este archivo fija ese estado de partida, y lo hace ahora porque un test que
 * afirma «esto no se puede» escrito **después** del cambio ya no prueba nada: se
 * escribe contra el código que quedó, y lo que hay que capturar es el antes.
 *
 * Es lo que el inventario llama el control positivo de la tajada 0
 * (`prd/05-inventario-de-archivos.md` § 5): cuando `/propuestas` acepte un
 * `create` anónimo, este archivo se pone **rojo**, y eso es la señal — obliga a
 * venir acá y escribir la excepción a mano, en `COLECCIONES_ABIERTAS`, con su
 * motivo al lado. Una puerta que se abre sin que nadie la nombre es exactamente
 * lo que este archivo impide.
 *
 * ── Por qué la lista de colecciones NO está escrita a mano ─────────────────
 * Sale de `firestore.rules`. Una lista a mano deja afuera la colección que se
 * agregue mañana, que es justo la que va a tener la regla nueva; leyéndola del
 * archivo, `match /propuestas/{id}` entra al barrido **solo**, y con la regla
 * puesta al revés entra en rojo. Es la forma de `promesas-sobre-datos.test.ts` y
 * de `barrido-de-salidas-publicas.test.ts`: la lista se deriva, y el control
 * positivo garantiza que derivarla encontró algo.
 *
 * ── Las dos identidades que se prueban, y no es lo mismo ───────────────────
 * **Anónimo** (sin sesión) y **logueado sin el claim**. La segunda es la que se
 * olvida y la que más se parece a la vida real: cualquiera puede crear una cuenta
 * con la API key web —pública por diseño y versionada en `.env.production` de un
 * repo público—, así que «no está logueado» no es la defensa. La defensa es el
 * claim, y por eso los dos casos corren sobre las mismas colecciones.
 *
 * ── El control positivo, que es lo que hace que el verde signifique algo ───
 * Todo lo de acá es una denegación esperada, y **una denegación es lo que
 * devuelve también un emulador que no está, una base sin reglas o un `projectId`
 * equivocado**. Así que el archivo empieza afirmando algo que tiene que
 * **funcionar**: un anónimo lee `/opciones/{campo}` (`allow read: if true`, §4.4)
 * y un admin escribe. Si esas dos no pasan, el resto no está midiendo nada.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());

const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

/**
 * Las colecciones que `firestore.rules` nombra, sacadas del archivo.
 *
 * Se toman los `match /<coleccion>/{...}` de primer nivel: los anidados
 * (`versiones`) se prueban por su ruta completa aparte, y el `match
 * /{document=**}` no es una colección sino la red del final.
 */
const coleccionesDeLasReglas = (): string[] => {
  const reglas = readFileSync(REGLAS, 'utf8');
  const nombres = [...reglas.matchAll(/^\s{4}match \/([a-z][A-Za-z]*)\/\{/gm)].map((m) => m[1]!);
  return [...new Set(nombres)].sort();
};

/**
 * Las colecciones que los PRDs van a crear, **hoy inexistentes en las reglas**.
 *
 * Van a mano y a propósito: son las que todavía no están, así que no se pueden
 * derivar de nada. El día que se agregue el `match /propuestas/{id}`, la
 * colección pasa a estar en las dos listas y no cambia nada — el barrido de
 * arriba la cubre igual, y esta línea deja de ser la única que la nombra.
 *
 * Es la mitad que prueba la **red del final** (`match /{document=**}`): una
 * colección que nadie nombró tiene que estar cerrada, no abierta.
 */
const COLECCIONES_FUTURAS = ['propuestas', 'librerias', 'suscripciones', 'lugares'] as const;

/**
 * Las colecciones donde un anónimo **sí** puede escribir. Hoy: ninguna.
 *
 * Cuando B-836 y la tajada 1 abran `/propuestas`, la excepción se escribe acá
 * con su motivo, y el caso correspondiente pasa a afirmar la regla nueva —qué
 * forma de documento acepta, con qué `estado` forzado por la regla, con qué
 * topes— en su propio archivo de integración. Esta constante existe para que
 * abrir la puerta sea un cambio **visible** en un test y no un efecto colateral
 * de tocar `firestore.rules`.
 */
const COLECCIONES_ABIERTAS: readonly string[] = [];

const UID_ADMIN = 'uid_anon_admin';
const UID_PELADO = 'uid_anon_sin_claim';

const token = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `ea-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, esAdmin ? { admin: true } : {});
  const t = await a.createCustomToken(uid, esAdmin ? { admin: true } : {});
  await deleteAdminApp(app);
  return t;
};

/**
 * `code === 'permission-denied'` y no el mensaje.
 *
 * El emulador devuelve la traza de evaluación en el `message` de algunos
 * rechazos (`false for 'create' @ L263`) y «Missing or insufficient permissions»
 * en otros, así que un matcher por texto falla contra la mitad de los casos. El
 * `code`, en cambio, distingue lo único que importa: `permission-denied` es «la
 * regla denegó» y `unavailable` es «no se pudo preguntar». Es el mismo helper que
 * `actividades.integracion.test.ts`, y está acá y no importado porque ese archivo
 * no lo exporta.
 */
const rechazada = async (operacion: Promise<unknown>, que: string) => {
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

/** Las tres formas de escribir. Borrar va aparte: necesita el documento puesto. */
const escrituras = (coleccion: string, id: string) => [
  ['create', () => setDoc(doc(db(), coleccion, id), { hola: 'mundo' })],
  ['update', () => updateDoc(doc(db(), coleccion, id), { hola: 'mundo' })],
  ['delete', () => deleteDoc(doc(db(), coleccion, id))],
] as const;

describe.skipIf(!vivo)('hoy nadie escribe sin el claim admin — B-836', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    // B-174 / B-219 — las reglas de ESTE checkout, y la base de este
    // working-tree arranca sin ninguna.
    await cargarReglas(REGLAS);
  }, 30_000);

  describe('el control positivo: sin esto, todo lo de abajo pasa con el emulador caído', () => {
    it('el barrido encontró las colecciones de las reglas', () => {
      const cs = coleccionesDeLasReglas();
      // Si el formato del archivo cambia y la regex deja de matchear, esto es lo
      // que avisa — en vez de un barrido vacío que da verde sin mirar nada.
      expect(cs.length).toBeGreaterThanOrEqual(4);
      expect(cs).toContain('actividades');
      expect(cs).toContain('opciones');
      expect(cs).toContain('reportes');
    });

    it('un anónimo SÍ lee /opciones, que es la única lectura pública (§4.4)', async () => {
      await signOut(auth());
      // No importa si el documento existe: importa que la regla deje preguntar.
      const snap = await getDoc(doc(db(), 'opciones', 'arancel'));
      expect(snap.exists()).toBe(false);
    });

    it('un admin SÍ escribe, o sea que la conexión y las reglas están vivas', async () => {
      await signInWithCustomToken(auth(), await token(UID_ADMIN, true));
      await setDoc(doc(db(), 'opciones', 'campo-de-prueba'), { valores: [] });
      const snap = await getDoc(doc(db(), 'opciones', 'campo-de-prueba'));
      expect(snap.exists()).toBe(true);
    });
  });

  describe('un anónimo (sin sesión)', () => {
    beforeAll(async () => {
      await signOut(auth());
    });

    it.each(coleccionesDeLasReglas())('no escribe en /%s', async (coleccion) => {
      expect(
        COLECCIONES_ABIERTAS,
        `/${coleccion} figura como abierta: el caso tiene que afirmar la regla nueva`,
      ).not.toContain(coleccion);
      for (const [verbo, operacion] of escrituras(coleccion, 'anon_intento')) {
        await rechazada(operacion(), `${verbo} anónimo en /${coleccion}`);
      }
    });

    it.each(COLECCIONES_FUTURAS)('tampoco en /%s, que todavía no existe', async (coleccion) => {
      // La red del final (`match /{document=**}`). Es la mitad que hace que
      // «hoy nadie escribe» sea cierto de verdad y no solo de las cuatro
      // colecciones que alguien se acordó de nombrar.
      for (const [verbo, operacion] of escrituras(coleccion, 'anon_intento')) {
        await rechazada(operacion(), `${verbo} anónimo en /${coleccion}`);
      }
    });

    it('ni en una ruta inventada, ni en una subcolección', async () => {
      await rechazada(
        setDoc(doc(db(), 'coleccion-que-nadie-nombro', 'x'), { a: 1 }),
        'una colección inventada',
      );
      await rechazada(
        setDoc(doc(db(), 'actividades', 'act_1', 'versiones', 'v1'), { a: 1 }),
        'el historial de una actividad',
      );
    });

    it('y no lee nada que no sea /opciones', async () => {
      for (const coleccion of [...coleccionesDeLasReglas(), ...COLECCIONES_FUTURAS]) {
        if (coleccion === 'opciones') continue;
        await rechazada(getDoc(doc(db(), coleccion, 'x')), `lectura anónima de /${coleccion}`);
      }
    });
  });

  describe('logueado, pero sin el claim admin', () => {
    beforeAll(async () => {
      // La API key web es pública por diseño, así que crear una cuenta está al
      // alcance de cualquiera: «tener sesión» no es una autorización.
      await signInWithCustomToken(auth(), await token(UID_PELADO, false));
    });

    it.each(coleccionesDeLasReglas())('no escribe en /%s', async (coleccion) => {
      for (const [verbo, operacion] of escrituras(coleccion, 'pelado_intento')) {
        await rechazada(operacion(), `${verbo} sin claim en /${coleccion}`);
      }
    });

    it.each(COLECCIONES_FUTURAS)('tampoco en /%s', async (coleccion) => {
      for (const [verbo, operacion] of escrituras(coleccion, 'pelado_intento')) {
        await rechazada(operacion(), `${verbo} sin claim en /${coleccion}`);
      }
    });

    it('lee /opciones como cualquiera, y nada más', async () => {
      const snap = await getDoc(doc(db(), 'opciones', 'arancel'));
      expect(snap.exists()).toBe(false);
      await rechazada(getDoc(doc(db(), 'actividades', 'x')), 'lectura sin claim de /actividades');
      await rechazada(getDoc(doc(db(), 'reportes', 'x')), 'lectura sin claim de /reportes');
    });
  });

  /**
   * La forma del `estado` inicial, que es lo que el PRD llama «lo único que hace
   * que abrir la escritura anónima no sea abrir la publicación anónima»
   * (`prd/README.md` § 1): el `estado` lo tiene que forzar **la regla**, no el
   * cliente, porque si lo decide el cliente un `curl` publica.
   *
   * Hoy no hay nada que probar de eso —no hay colección abierta— y por eso el
   * caso afirma la precondición y nombra quién lo va a reemplazar. No es un
   * `it.fails`: no hay una clase viva esperando arreglo, hay una puerta cerrada
   * cuya apertura tiene que pasar por acá.
   */
  it('y el día que se abra una, el estado inicial lo fuerza la regla — no hay ninguna todavía', () => {
    expect(
      COLECCIONES_ABIERTAS,
      'se abrió una colección a la escritura anónima: el `estado` inicial tiene que ' +
        'estar forzado en `firestore.rules` y verificado en el test de esa colección',
    ).toEqual([]);
  });
});
