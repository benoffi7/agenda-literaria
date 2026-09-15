/**
 * **La precondición del borrado de una ficha, contra el emulador** —
 * B-904 / B-912 / B-917, con la promesa de B-864.
 *
 * La decisión de qué caduca es pura y está en `tests/retencion-de-guias.test.ts`.
 * Lo que este archivo verifica es lo único que **no se puede razonar sin el
 * emulador**: que una ficha que alguien toca **mientras el barrido corre**
 * sobrevive. Un doble a mano diría que sí sin haber comparado nada — una
 * precondición de Firestore (`delete({ lastUpdateTime })`) es una propiedad del
 * servidor.
 *
 * Y verifica lo otro que un fixture no puede: que la query paginada
 * (`fichasVencibles`) devuelve el `updateTime` que después la precondición
 * exige, y que el orden implícito del cursor es el que el SDK deriva del
 * snapshot.
 *
 * ── Una sola colección alcanza, y eso es una afirmación ───────────────────
 * `borrarFicha` y `fichasVencibles` reciben la colección por parámetro y no
 * tienen ni una rama por entidad: el ciclo de vida es el de
 * `lib/directorios.ts`, que es el mismo para las tres. Que el barrido corra
 * sobre las tres lo fija `tests/retencion-de-guias.test.ts` leyendo el trigger,
 * que es donde vive esa decisión. Repetir estos cuatro casos por colección
 * probaría tres veces la misma línea de Firestore.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminDb } from '@/lib/firebase-admin';
import {
  borrarFicha,
  decidirRetencionDeFichas,
  fichasVencibles,
} from '../functions/retencion.js';
import { PROJECT_ID, emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

const COL = 'librerias';
/** Los ids llevan el `projectId` de **este** checkout (B-219). */
const VENCIDA = `lib_vencida-${PROJECT_ID}`;
const RECIENTE = `lib_reciente-${PROJECT_ID}`;
const RESCATADA = `lib_rescatada-${PROJECT_ID}`;
const OLVIDADA = `lib_olvidada-${PROJECT_ID}`;

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);

/** El documento como lo escribe el formulario, con el contacto interno adentro. */
const documento = (over: Record<string, unknown> = {}) => ({
  nombre: 'Librería que se descartó',
  slug: 'libreria-que-se-descarto',
  descripcion: null,
  imagenes: [],
  direccion: 'Thames 1762',
  barrio: 'palermo',
  ciudad: 'Ciudad de Buenos Aires',
  geo: null,
  instagram: null,
  whatsapp: null,
  web: null,
  mail: null,
  // El dato personal del tercero. Está en el fixture a propósito: es contra lo
  // que se afirma que el barrido no lo lee.
  contactoDeQuienCargo: { via: 'whatsapp', valor: '+54 9 11 2222-3333' },
  estado: 'rechazado',
  origen: 'formulario-publico',
  searchText: 'libreria que se descarto',
  creadoEn: hace(90),
  revision: { porUid: 'uid_admin', en: hace(40), motivo: 'ya no existe' },
  ...over,
});

describe.skipIf(!vivo)('la retención de la Guía honra el rescate de último momento', () => {
  beforeAll(async () => {
    const db = adminDb();
    await Promise.all([
      db.collection(COL).doc(VENCIDA).set(documento()),
      db
        .collection(COL)
        .doc(RECIENTE)
        .set(documento({ revision: { porUid: 'uid_admin', en: hace(2), motivo: 'reciente' } })),
      db.collection(COL).doc(RESCATADA).set(documento()),
      db
        .collection(COL)
        .doc(OLVIDADA)
        .set(
          documento({
            estado: 'pendiente',
            creadoEn: hace(90),
            revision: { porUid: null, en: null, motivo: null },
          }),
        ),
    ]);
  });

  afterAll(async () => {
    if (!vivo) return;
    await limpiarFirestore();
  });

  it('la query trae la vencida y la olvidada, y NO lee el contacto del tercero', async () => {
    const leidas = await fichasVencibles(adminDb() as never, COL);
    const ids = leidas.map((f) => f.id);
    expect(ids).toContain(VENCIDA);
    expect(ids).toContain(OLVIDADA);

    /*
     * Lo que este caso existe para afirmar: el `select()` no es una
     * optimización. Sin él, `contactoDeQuienCargo` —el mail o el WhatsApp de
     * alguien que no está logueado— viaja hasta la memoria de la Function para
     * leerle un estado y dos fechas, y de ahí puede caer en cualquier log del
     * camino.
     *
     * Mutación: borrar el `.select(...)` de `fichasVencibles`. Este caso se
     * pone rojo.
     */
    for (const f of leidas) {
      expect(f).not.toHaveProperty('contactoDeQuienCargo');
      expect(f).not.toHaveProperty('nombre');
      // El motivo del rechazo es una nota interna sobre el trabajo de otra
      // persona: la proyección pide `revision.en` y trae solo esa clave.
      expect(f.revision).not.toHaveProperty('motivo');
    }
  });

  it('cada leída trae el updateTime, que es lo que la precondición va a exigir', async () => {
    const leidas = await fichasVencibles(adminDb() as never, COL);
    for (const f of leidas) expect(f.updateTime).toBeTruthy();
  });

  it('una rechazada hace 40 días se borra de verdad', async () => {
    const db = adminDb();
    const leidas = await fichasVencibles(db as never, COL);
    const { aBorrar } = decidirRetencionDeFichas({ fichas: leidas });
    const caducada = aBorrar.find((f) => f.id === VENCIDA);
    expect(caducada).toBeTruthy();

    expect(await borrarFicha(db as never, COL, caducada!)).toBe('borrada');
    expect((await db.collection(COL).doc(VENCIDA).get()).exists).toBe(false);
    // La reciente sigue: el plazo corre desde el rechazo.
    expect((await db.collection(COL).doc(RECIENTE).get()).exists).toBe(true);
  });

  it('borrar una que ya no está no es un error — la corrida anterior murió en el medio', async () => {
    const db = adminDb();
    // `VENCIDA` ya se fue en el caso anterior. La versión que la query vio
    // sigue siendo una versión válida, y el estado final es el que se quería.
    const snap = await db.collection(COL).doc(RECIENTE).get();
    const resultado = await borrarFicha(db as never, COL, {
      id: VENCIDA,
      visto: snap.updateTime,
    });
    expect(resultado).toBe('ya-no-esta');
  });

  it('una ficha que un admin REABRE durante la corrida sobrevive entera', async () => {
    // El caso de B-864 aplicado a la Guía, y el único que no se puede escribir
    // sin el emulador: entre la query y el borrado pasan segundos, y en esos
    // segundos un admin puede reabrir la ficha y ver el plazo renovado. Sin la
    // precondición, la pierde igual.
    const db = adminDb();
    const leidas = await fichasVencibles(db as never, COL);
    const { aBorrar } = decidirRetencionDeFichas({ fichas: leidas });
    const caducada = aBorrar.find((f) => f.id === RESCATADA);
    expect(caducada).toBeTruthy();

    // El admin la reabre: la ficha vuelve a `pendiente` con su plazo renovado.
    await db
      .collection(COL)
      .doc(RESCATADA)
      .update({ estado: 'pendiente', revision: { porUid: 'uid_admin', en: new Date(), motivo: null } });

    expect(await borrarFicha(db as never, COL, caducada!)).toBe('la-tocaron');
    expect((await db.collection(COL).doc(RESCATADA).get()).exists).toBe(true);
  });

  it('sin la versión vista, el borrado se niega en vez de hacerlo a ciegas', async () => {
    // Falla ruidoso y no cerrado: es un error de programación del que llama
    // —armó la lista sin pasar por `fichasVencibles`— y clasificarlo lo dejaría
    // pasar como «una que no se borró».
    await expect(
      borrarFicha(adminDb() as never, COL, { id: OLVIDADA, visto: undefined }),
    ).rejects.toThrow(/sin la versión vista/);
    expect((await adminDb().collection(COL).doc(OLVIDADA).get()).exists).toBe(true);
  });
});
