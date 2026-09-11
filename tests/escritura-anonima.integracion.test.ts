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
 * ── Lo que este archivo NO es testigo de, y hay que saberlo ───────────────
 * Es testigo de la **lista de colecciones**, no de la forma de cada una. Prueba
 * las escrituras con un documento sonda (`{ hola: 'mundo' }`), así que en una
 * colección que además valida la forma —`/propuestas`, con `propuestaValida()`—
 * el rechazo llega por `hasOnly` **con la puerta abierta o cerrada**: abrir el
 * `create` anónimo de esa colección **no pone este archivo en rojo**.
 *
 * Lo encontró el `auditor-privacidad` sobre B-830, y no es un defecto de este
 * archivo: es el alcance que tiene. Lo que sí hace es exigir que
 * `COLECCIONES_ABIERTAS` se edite a mano, o sea que abrir una puerta sea un diff
 * visible. **El testigo de cada puerta vive en el archivo de su colección** — para
 * `/propuestas`, el caso «un anónimo no puede crear una propuesta, ni con el
 * documento perfecto» de `propuestas.integracion.test.ts`.
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
import { existsSync, readFileSync } from 'node:fs';
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
 * **Pasó el 2026-09-11 con `/propuestas`** (B-896 paso 2), y la excepción está
 * escrita abajo con su motivo. La regla nueva se afirma en su propio archivo
 * —`propuestas.integracion.test.ts`, el control positivo «un anónimo crea una
 * propuesta bien formada» más los tres negativos que siguen valiendo—. Esta
 * constante existe para que abrir la puerta sea un cambio **visible** en un test
 * y no un efecto colateral de tocar `firestore.rules`.
 */
const COLECCIONES_ABIERTAS: readonly string[] = [
  /*
   * **`/propuestas` — el `create` anónimo, abierto el 2026-09-11 (B-896 paso 2).**
   *
   * Es el punto entero del PRD 1: un organizador propone su actividad sin tener
   * cuenta. Lo que la sostiene son las cinco capas de B-836 —App Check exigiendo
   * en Firestore desde el 2026-09-10, `propuestaValida()`, los topes de tamaño, el
   * honeypot y el tiempo mínimo de `FormularioPublico`, y el barrido de
   * `retencion.js`— y ninguna reemplaza a las otras.
   *
   * **Solo el `create`.** `read`, `update` y `delete` siguen en `esAdmin()`:
   * mandar no es ver, que es lo que separa un buzón de una bandeja.
   *
   * Y la foto **no** entra por esta puerta: va por la callable
   * `subirFlyerDePropuesta` (B-896 paso 1), y `storage.rules` para `propuestas/`
   * quedó en `create: if false` para todo cliente.
   */
  'propuestas',
];

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

    /*
     * **Una colección abierta no sale del barrido: se le barren los OTROS verbos.**
     *
     * Saltearla entera sería convertir `COLECCIONES_ABIERTAS` en una lista de
     * exenciones. Abrir **una** puerta no abre las tres: `/propuestas` acepta que
     * un anónimo mande y no que lea, ni que corrija lo mandado, ni que lo borre.
     *
     * **Y hay que ser exacto con lo que este barrido alcanza, porque la primera
     * versión de este comentario afirmaba de más.** El barrido de los otros verbos
     * vale **solo donde no hay validación de forma**: la sonda es
     * `{ hola: 'mundo' }`, así que en una colección que la valida el rechazo llega
     * por `hasOnly` con la puerta abierta o cerrada — la misma razón por la que
     * este archivo no es testigo del `create`.
     *
     * Donde sí la hay, el testigo vive en el archivo de esa colección y usa un
     * documento que la validación acepte: para `/propuestas`, «ni corrige lo que
     * mandó, ni con una revisión bien formada» de
     * `propuestas.integracion.test.ts`, que se pone rojo cuando la regla se abre
     * del todo. Lo que este archivo sí garantiza en todos los casos es que la
     * **lista** se edite a mano.
     */
    it.each(coleccionesDeLasReglas())('no escribe en /%s', async (coleccion) => {
      const abierta = COLECCIONES_ABIERTAS.includes(coleccion);
      for (const [verbo, operacion] of escrituras(coleccion, 'anon_intento')) {
        if (abierta && verbo === 'create') continue;
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
   * Desde el 2026-09-11 hay una abierta (`/propuestas`, B-896 paso 2), así que el
   * caso dejó de afirmar «no hay ninguna» y pasó a afirmar lo que de verdad
   * importa: que **cada** colección abierta tenga su `estado` forzado en la regla
   * y su propio archivo de integración que lo verifique. Una lista que crece sin
   * que crezca eso es exactamente lo que este archivo existe para impedir.
   */
  it('cada colección abierta tiene el estado forzado en la regla y su propio testigo', () => {
    const reglas = readFileSync(REGLAS, 'utf8');
    for (const coleccion of COLECCIONES_ABIERTAS) {
      const bloque = reglas.slice(reglas.indexOf(`match /${coleccion}/`));
      expect(
        bloque,
        `/${coleccion} está abierta y su regla no fuerza el \`estado\` inicial: ` +
          'si lo decide el cliente, un `curl` publica',
      ).toMatch(/estado.{0,40}==/s);
      expect(
        existsSync(fileURLToPath(new URL(`./${coleccion}.integracion.test.ts`, import.meta.url))),
        `/${coleccion} está abierta y no tiene su propio archivo de integración: ` +
          'este archivo NO es testigo de ninguna puerta',
      ).toBe(true);
    }
  });
});
