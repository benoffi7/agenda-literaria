/**
 * **Las dos mitades del borrado, contra los emuladores** — B-838 / DEC-13,
 * criterios 10 y 11 del PRD 1.
 *
 * La decisión de qué caduca es pura y está en `tests/retencion.test.ts`. Lo que
 * este archivo verifica es lo único que **no se puede razonar sin los
 * emuladores**: que el documento y su objeto se van **juntos**, y que el borrado
 * es idempotente cuando la corrida anterior murió en el medio.
 *
 * ── Por qué esta mitad merece su propio archivo ───────────────────────────
 * Es el punto 4 de «las nueve cosas que se rompen en silencio» del inventario:
 * «la propuesta se borra y su imagen queda viva (o al revés)». Un test con un
 * `bucket` de mentira probaría que **se llama** a `delete()`, que es la mitad
 * fácil; lo que puede fallar de verdad —que el path que la Function arma no sea
 * el que el bucket conoce, que el borrado tire 404 y corte el barrido— solo se ve
 * contra el emulador. Es la misma razón por la que existe
 * `miniaturas-storage.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminBucket, adminDb } from '@/lib/firebase-admin';
import {
  borrarPropuesta,
  decidirRetencion,
  propuestasVencibles,
} from '../functions/retencion.js';
import { PROJECT_ID, emuladorStorageVivo, emuladorVivo } from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorStorageVivo());

const fuente = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/**
 * Los ids llevan el `projectId` de **este** checkout (B-219). Firestore ya está
 * particionado por proyecto, pero **el bucket del emulador no**: sin esto, el
 * `afterAll` de un worktree borraría el objeto de otro a mitad de camino y el
 * rojo intermitente diría «el borrado no funciona», que es un diagnóstico
 * equivocado. Misma disciplina que `miniaturas-storage.integracion.test.ts`.
 */
const VENCIDA = `p_vencida-${PROJECT_ID}`;
const RECIENTE = `p_reciente-${PROJECT_ID}`;
const OBJETO = `propuestas/prop_${PROJECT_ID}.jpg`;

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);

/** El documento como lo escribe el panel, con el contacto adentro. */
const documento = (over: Record<string, unknown> = {}) => ({
  titulo: 'Taller que se rechazó',
  descripcion: 'Cuatro encuentros para escribir crónica, con lecturas y consignas.',
  fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }],
  modalidad: 'presencial',
  lugar: null,
  organizador: { nombre: 'Quien propuso', instagram: null },
  arancel: { tipo: 'gratis', notas: null },
  inscripcion: { requiere: false, comoDice: null },
  incluye: [],
  incluyeOtro: null,
  imagen: null,
  // El dato personal del tercero. Está en el fixture a propósito: es contra lo
  // que se afirma que el barrido no lo lee.
  contacto: { via: 'whatsapp', valor: '+54 9 11 2222-3333' },
  estado: 'rechazada',
  creadoEn: hace(90),
  origen: 'panel',
  revision: { porUid: 'uid_admin', en: hace(40), actividadId: null, motivo: 'ya estaba' },
  ...over,
});

describe.skipIf(!vivo)('la retención de propuestas borra las dos mitades — B-838', () => {
  beforeAll(async () => {
    /*
     * **Este archivo escribe en el bucket, así que la guarda va antes del
     * `save()` y no puede ser el `skipIf`.** `emuladorStorageVivo()` mira
     * `HOST_STORAGE` —un `fetch`—, que es una variable **distinta** de la que
     * resuelve el destino del Admin SDK: el emulador puede estar arriba y
     * `FIREBASE_STORAGE_EMULATOR_HOST` faltar en el entorno del proceso, y
     * entonces esto crearía —y después borraría— un objeto **en producción**. La
     * lección es de `miniaturas-storage.integracion.test.ts`, y acá pesa el
     * doble: este archivo no solo escribe, **borra**.
     */
    expect(
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
      'este test escribe y borra en el bucket: sin FIREBASE_STORAGE_EMULATOR_HOST tocaría producción',
    ).toBeTruthy();
    expect(
      process.env.FIRESTORE_EMULATOR_HOST,
      'este test borra documentos: sin FIRESTORE_EMULATOR_HOST tocaría producción',
    ).toBeTruthy();

    await adminDb().collection('propuestas').doc(VENCIDA).set(documento({ imagen: { storagePath: OBJETO } }));
    await adminDb()
      .collection('propuestas')
      .doc(RECIENTE)
      .set(documento({ revision: { porUid: 'uid_admin', en: hace(2), actividadId: null, motivo: null } }));
    await adminBucket().file(OBJETO).save(Buffer.from([0xff, 0xd8, 0xff]), {
      contentType: 'image/jpeg',
    });
  }, 30_000);

  afterAll(async () => {
    if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) return;
    await adminBucket().file(OBJETO).delete({ ignoreNotFound: true });
    await adminDb().collection('propuestas').doc(RECIENTE).delete();
    await adminDb().collection('propuestas').doc(VENCIDA).delete();
  });

  /**
   * **Lo que este caso prueba es el mapeo, no el `select`** — y la distinción no
   * es un detalle: la verificación por mutación mostró que sacar el
   * `.select('estado','revision','imagen')` de la query **deja el caso en
   * verde**, porque `propuestasVencibles` arma su salida con cuatro claves
   * escritas a mano y el contacto no llega igual.
   *
   * Los dos hacen falta y protegen cosas distintas: el mapeo, que el dato
   * personal del tercero no exista en la memoria de la Function ni pueda entrar a
   * un log; el `select`, que **no viaje** desde Firestore. Lo segundo no se puede
   * ver desde el resultado, así que se afirma sobre el fuente — con el motivo
   * escrito, para que no se lea como redundancia.
   */
  it('lo que la Function tiene en la mano no incluye el contacto de quien propuso', async () => {
    const propuestas = await propuestasVencibles(adminDb());
    const nuestras = propuestas.filter((p) => p.id === VENCIDA || p.id === RECIENTE);

    // Control positivo: sin esto, «no trae el contacto» pasaría porque no trajo
    // nada — que es el falso verde de esta clase de aserto.
    expect(nuestras).toHaveLength(2);
    expect((await adminDb().collection('propuestas').doc(VENCIDA).get()).get('contacto')).toBeTruthy();

    for (const p of nuestras) {
      // `creadoEn` entró con B-844: es el reloj de la que nadie tocó. Lo que
      // sigue sin estar es el contacto, que es de lo que trata este caso.
      expect(Object.keys(p).sort(), p.id).toEqual([
        'creadoEn',
        'estado',
        'id',
        'imagen',
        'revision',
      ]);
    }
  });

  it('y tampoco viaja desde Firestore: la query lo recorta', () => {
    // La otra mitad, afirmada sobre el fuente porque desde el resultado no se
    // distingue (ver el docblock de arriba).
    expect(fuente('functions/retencion.js')).toMatch(
      /\.select\('estado', 'creadoEn', 'revision\.en', 'imagen\.storagePath'\)/,
    );
  });

  /**
   * **Y adentro de `revision` tampoco viaja lo que no se usa** — lo corrigió el
   * `auditor-privacidad`. Con `select('revision')` entero llegaban también
   * `revision.motivo` —una nota interna sobre el trabajo de otra persona, con su
   * propia fila en `07-seguridad.md`— y `revision.porUid`, que es un uid.
   *
   * Esto **sí** se ve desde el resultado, a diferencia del `select` de arriba, y
   * por eso es un caso y no un aserto sobre el fuente.
   */
  it('la revisión llega con la fecha y nada más: ni el motivo del rechazo ni el uid', async () => {
    const propuestas = await propuestasVencibles(adminDb());
    const nuestra = propuestas.find((p) => p.id === VENCIDA);

    // Control positivo: el documento **sí** tiene las tres cosas.
    const crudo = (await adminDb().collection('propuestas').doc(VENCIDA).get()).get('revision');
    expect(Object.keys(crudo).sort()).toEqual(['actividadId', 'en', 'motivo', 'porUid']);

    expect(Object.keys(nuestra!.revision as object)).toEqual(['en']);
  });

  /**
   * **Lo que la lógica lee tiene que estar en el `select`, o el bug es mudo** —
   * B-844. `creadoEn` es el reloj de la propuesta que nadie tocó; si la query no
   * lo pidiera volvería `undefined`, `relojDeRetencion` lo leería como «sin
   * fecha legible» y **ninguna `nueva` caducaría jamás**, con toda la suite en
   * verde. Es el regalo envenenado del `select` acotado, y se afirma contra el
   * emulador porque es ahí donde la proyección de verdad ocurre.
   *
   * MUTACIÓN PROBADA: sacando `'creadoEn'` del `select`, este caso se pone rojo
   * (`creadoEn` llega `undefined`) y ninguno de `retencion.test.ts` se entera,
   * porque ahí los documentos se arman a mano.
   */
  it('y `creadoEn` sí viaja: sin él, la que nadie tocó no caducaría nunca', async () => {
    const propuestas = await propuestasVencibles(adminDb());
    const nuestra = propuestas.find((p) => p.id === VENCIDA);
    expect(nuestra?.creadoEn, 'el reloj de B-844 no llegó desde Firestore').toBeTruthy();
    expect(typeof (nuestra?.creadoEn as { toMillis?: unknown })?.toMillis).toBe('function');
  });

  it('la vencida se borra entera: documento **y** objeto', async () => {
    const propuestas = await propuestasVencibles(adminDb());
    const { aBorrar } = decidirRetencion({ propuestas, ahora: Date.now() });

    const nuestra = aBorrar.find((p) => p.id === VENCIDA);
    expect(nuestra, 'la rechazada hace 40 días tendría que haber vencido').toEqual({
      id: VENCIDA,
      objeto: OBJETO,
    });
    // Y la de hace dos días no está en la lista: el control que hace que el caso
    // de arriba no pase por «borra todo».
    expect(aBorrar.map((p) => p.id)).not.toContain(RECIENTE);

    // Antes: las dos mitades están.
    expect((await adminBucket().file(OBJETO).exists())[0]).toBe(true);

    await borrarPropuesta(adminDb(), adminBucket(), nuestra!);

    expect((await adminDb().collection('propuestas').doc(VENCIDA).get()).exists).toBe(false);
    expect(
      (await adminBucket().file(OBJETO).exists())[0],
      'el documento se fue y la imagen quedó viva: es el punto 4 de las nueve cosas que se rompen en silencio',
    ).toBe(false);
    // Y la reciente sigue ahí, con su contacto: el barrido no se llevó la bandeja.
    expect((await adminDb().collection('propuestas').doc(RECIENTE).get()).exists).toBe(true);
  });

  it('y borrar de nuevo lo mismo no falla: la corrida de mañana reintenta', async () => {
    /*
     * El caso real es una corrida que muere entre las dos mitades. Sin
     * `ignoreNotFound`, el reintento tiraría 404 sobre el objeto que ya no está y
     * el `catch` del trigger dejaría el documento sin borrar **para siempre**:
     * cada corrida volvería a intentar y a fallar en el mismo punto.
     */
    await expect(
      borrarPropuesta(adminDb(), adminBucket(), { id: VENCIDA, objeto: OBJETO }),
    ).resolves.toBeUndefined();
  });
});
