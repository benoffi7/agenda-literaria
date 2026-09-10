/**
 * **Las dos mitades del borrado, contra los emuladores** — B-838 / DEC-13,
 * criterios 10 y 11 del PRD 1.
 *
 * La decisión de qué caduca es pura y está en `tests/retencion.test.ts`. Lo que
 * este archivo verifica es lo único que **no se puede razonar sin los
 * emuladores**: que el documento y su objeto se van **juntos**, que el borrado
 * es idempotente cuando la corrida anterior murió en el medio, y —desde
 * **B-864**— que una propuesta que alguien toca **mientras el barrido corre**
 * sobrevive entera. Lo último no se puede probar con un fixture: una
 * precondición de Firestore (`delete({ lastUpdateTime })`) es una propiedad del
 * servidor, y un doble a mano diría que sí sin haber comparado nada.
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
/** B-864 — la que un admin rescata a mitad de la corrida, con su propia foto. */
const RESCATADA = `p_rescatada-${PROJECT_ID}`;
const OBJETO_RESCATADA = `propuestas/prop_rescatada_${PROJECT_ID}.jpg`;
/** B-864 — la que se toca en la ventana que la relectura no cubre. */
const TARDIA = `p_tardia-${PROJECT_ID}`;
const OBJETO_TARDIA = `propuestas/prop_tardia_${PROJECT_ID}.jpg`;
/** B-864 — la que dos corridas del barrido se pelean. */
const CONCURRENTE = `p_concurrente-${PROJECT_ID}`;
const OBJETO_CONCURRENTE = `propuestas/prop_concurrente_${PROJECT_ID}.jpg`;

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
  /**
   * La versión que la query vio de `VENCIDA`, para que el caso de idempotencia
   * la reuse. Se pasa entre casos y no se recalcula porque después del borrado
   * **ya no hay de dónde sacarla**, que es justamente el estado que ese caso
   * quiere ejercitar.
   */
  let versionDeLaVencida: unknown;

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
    // Las tres de B-864: `nueva` de hace 90 días —o sea vencida por el reloj de
    // «nadie la tocó»— y cada una con su propia foto, que es la mitad que estos
    // casos tienen que poder mirar por separado.
    for (const [id, objeto] of [
      [RESCATADA, OBJETO_RESCATADA],
      [TARDIA, OBJETO_TARDIA],
      [CONCURRENTE, OBJETO_CONCURRENTE],
    ] as const) {
      await adminDb()
        .collection('propuestas')
        .doc(id)
        .set(
          documento({
            estado: 'nueva',
            creadoEn: hace(90),
            revision: { porUid: null, en: null, actividadId: null, motivo: null },
            imagen: { storagePath: objeto },
          }),
        );
    }
    for (const objeto of [OBJETO, OBJETO_RESCATADA, OBJETO_TARDIA, OBJETO_CONCURRENTE]) {
      await adminBucket().file(objeto).save(Buffer.from([0xff, 0xd8, 0xff]), {
        contentType: 'image/jpeg',
      });
    }
  }, 30_000);

  afterAll(async () => {
    if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) return;
    for (const objeto of [OBJETO, OBJETO_RESCATADA, OBJETO_TARDIA, OBJETO_CONCURRENTE]) {
      await adminBucket().file(objeto).delete({ ignoreNotFound: true });
    }
    for (const id of [RECIENTE, VENCIDA, RESCATADA, TARDIA, CONCURRENTE]) {
      await adminDb().collection('propuestas').doc(id).delete();
    }
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
      /*
       * `creadoEn` entró con B-844 (el reloj de la que nadie tocó) y
       * `updateTime` con B-864 (la versión que la precondición del borrado va a
       * exigir). **`updateTime` no afloja nada de este caso**: es metadata del
       * snapshot, no un campo del documento, así que no hay un `select` que lo
       * traiga ni de él se puede llegar al contacto. Lo que sigue sin estar es
       * el contacto, que es de lo que trata este caso.
       */
      expect(Object.keys(p).sort(), p.id).toEqual([
        'creadoEn',
        'estado',
        'id',
        'imagen',
        'revision',
        'updateTime',
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
      // B-864 — la versión que la query vio, que es lo que el borrado exige.
      visto: expect.anything(),
    });
    versionDeLaVencida = nuestra!.visto;
    // Y la de hace dos días no está en la lista: el control que hace que el caso
    // de arriba no pase por «borra todo».
    expect(aBorrar.map((p) => p.id)).not.toContain(RECIENTE);

    // Antes: las dos mitades están.
    expect((await adminBucket().file(OBJETO).exists())[0]).toBe(true);

    await expect(borrarPropuesta(adminDb(), adminBucket(), nuestra!)).resolves.toBe('borrada');

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
     *
     * **Con la precondición de B-864 el reintento sigue funcionando, y por un
     * camino distinto**: la relectura ve que el documento ya no está y contesta
     * `'ya-no-esta'` sin tirar. El objeto se borra igual —es lo que queda del
     * huérfano y todavía tenemos el path en la mano—, así que la idempotencia
     * que este caso protege no se perdió: se volvió explícita.
     */
    expect(versionDeLaVencida, 'el caso anterior no dejó la versión').toBeTruthy();
    await expect(
      borrarPropuesta(adminDb(), adminBucket(), {
        id: VENCIDA,
        objeto: OBJETO,
        visto: versionDeLaVencida,
      }),
    ).resolves.toBe('ya-no-esta');
  });
  /**
   * ══ EL CASO DE B-864 ═══════════════════════════════════════════════════
   *
   * **Una propuesta que un admin toca mientras el barrido corre sobrevive
   * entera** — que es la promesa que B-844 hizo («moverla de estado le renueva
   * el plazo») y que el `delete()` sin condición rompía en silencio.
   *
   * ── Cómo se arma la carrera, porque no se puede esperar ───────────────
   * En producción la ventana son **segundos por día**: `propuestasVencibles()`
   * lee hasta 50 documentos de un saque y después los borra de a uno, con un
   * viaje a Storage en el medio, así que el último de la lista se borra segundos
   * después de haber sido leído. Acá esos segundos se hacen **explícitos**: se
   * lee (t0), se escribe a mano lo que el admin habría escrito (t1) y recién
   * entonces se borra con la lista vieja en la mano (t2). No hay `sleep` ni
   * `vi.useFakeTimers`: lo que importa no es el tiempo sino **el orden**, y el
   * orden es lo único que un test puede fijar.
   *
   * El `update` de t1 es el mismo que escribe el panel al apretar «la estoy
   * mirando» (`cambioDeRevision` en `bandejaDePropuestas.ts`): mueve `estado` y
   * `revision`, o sea que mueve el `updateTime`, que es lo único que la
   * precondición mira.
   *
   * MUTACIÓN PROBADA (tres, y son la razón de que este caso exista):
   *  1. volviendo `borrarPropuesta` al `delete()` sin condición, este caso se
   *     pone rojo en las **dos** mitades: el documento se borra y la foto
   *     también;
   *  2. dejando la precondición pero **sacando la relectura**, se pone rojo
   *     solo en la mitad de la imagen — el documento se salva y el flyer no,
   *     que es exactamente la tensión con el orden de B-838 que este ítem tuvo
   *     que resolver;
   *  3. dejando la relectura pero **sacando el `{ lastUpdateTime }`**, este caso
   *     sigue verde y el de la ventana (abajo) se pone rojo: la relectura sola
   *     no es la garantía, es la que achica la ventana.
   */
  it('una propuesta que tocan durante la corrida no se borra, y conserva su imagen', async () => {
    // t0 — el barrido lee y decide. Acá queda fijada la versión que va a exigir.
    const { aBorrar } = decidirRetencion({
      propuestas: await propuestasVencibles(adminDb()),
      ahora: Date.now(),
    });
    const nuestra = aBorrar.find((p) => p.id === RESCATADA);
    expect(nuestra, 'la `nueva` de hace 90 días tendría que haber vencido').toBeTruthy();
    expect(nuestra!.visto, 'la versión que vio la query no llegó a la lista de borrado').toBeTruthy();

    // t1 — **LA CARRERA**: el admin aprieta «la estoy mirando» sobre una
    // vencida. En Firestore el plazo le queda renovado.
    await adminDb()
      .collection('propuestas')
      .doc(RESCATADA)
      .update({
        estado: 'en-revision',
        revision: { porUid: 'uid_admin', en: new Date(), actividadId: null, motivo: null },
      });

    // t2 — el barrido llega con la lista vieja y **no la borra**.
    const final = await borrarPropuesta(adminDb(), adminBucket(), nuestra!);

    /*
     * **Las dos mitades primero y el nombre del final después**, y el orden de
     * los asertos no es estético: con `expect(...).resolves.toBe('la-tocaron')`
     * arriba, la mutación que borra igual se pone roja por el nombre del
     * resultado y **nunca llega a decir que el documento se perdió**. Lo que
     * este caso tiene que mostrar en rojo es la pérdida, no la etiqueta.
     */
    expect(
      (await adminDb().collection('propuestas').doc(RESCATADA).get()).exists,
      'el admin renovó el plazo y el barrido se la llevó igual: es B-864',
    ).toBe(true);
    expect(
      (await adminBucket().file(OBJETO_RESCATADA).exists())[0],
      'la propuesta se salvó pero quedó con el flyer roto: la relectura tiene que ir ANTES de tocar Storage',
    ).toBe(true);
    expect(final).toBe('la-tocaron');
  });

  /**
   * **Y la ventana que queda, dicha de frente: la cuarta forma de perder la
   * mitad del borrado.**
   *
   * B-838 nombró tres formas de terminar con **la foto viva y el documento
   * muerto** —un `storagePath` fuera del prefijo, el script apuntando a dos
   * lugares distintos, y un fallo transitorio entre las dos mitades— y las cerró
   * las tres. Ésta es la cuarta y va **al revés**: documento vivo, foto muerta.
   * Cae del lado que B-838 eligió como «el menos malo» (se ve en la bandeja, no
   * es una foto que nadie puede volver a encontrar) pero cae sobre la peor
   * propuesta posible, la que un admin acaba de rescatar.
   *
   * No se puede cerrar: Storage **no tiene precondición**, así que entre la
   * relectura y el borrado del documento siempre queda un viaje de ida y vuelta.
   * Lo que se puede es medirla y decir qué pasa, y eso es este caso. El trigger
   * la loguea como `warn` por esto mismo.
   *
   * ── Cómo se fuerza esa ventana ────────────────────────────────────────
   * Con un `db` que se hace pasar por el real y mete la escritura del admin
   * **adentro** del `getAll`, justo después de que la relectura leyó. Es la única
   * forma de pararse en un intervalo de microsegundos, y el doble es honesto:
   * delega todo en el Firestore de verdad y la precondición la sigue evaluando el
   * servidor.
   */
  it('y si la tocan en la ventana que queda, el documento se salva y la imagen no', async () => {
    const { aBorrar } = decidirRetencion({
      propuestas: await propuestasVencibles(adminDb()),
      ahora: Date.now(),
    });
    const nuestra = aBorrar.find((p) => p.id === TARDIA);
    expect(nuestra, 'la `nueva` de hace 90 días tendría que haber vencido').toBeTruthy();

    const real = adminDb();
    const dbConLaCarreraEnLaVentana = {
      collection: (c: string) => real.collection(c),
      getAll: async (...args: unknown[]) => {
        const leido = await (real.getAll as (...a: never[]) => Promise<unknown[]>)(
          ...(args as never[]),
        );
        // El admin aprieta acá: después de la relectura, antes del `delete`.
        await real
          .collection('propuestas')
          .doc(TARDIA)
          .update({
            estado: 'en-revision',
            revision: { porUid: 'uid_admin', en: new Date(), actividadId: null, motivo: null },
          });
        return leido;
      },
    };

    const final = await borrarPropuesta(
      dbConLaCarreraEnLaVentana as never,
      adminBucket(),
      nuestra!,
    );

    // El estado primero, el nombre del final después — mismo motivo que arriba.
    expect(
      (await adminDb().collection('propuestas').doc(TARDIA).get()).exists,
      'la precondición es lo único atómico que hay: el documento no puede irse',
    ).toBe(true);
    // Y lo que se perdió, dicho como aserto y no como comentario: el flyer.
    expect((await adminBucket().file(OBJETO_TARDIA).exists())[0]).toBe(false);
    expect(final).toBe('la-tocaron-tarde');
  });
  /**
   * **La relectura trae la versión y ni un campo, verificado por valor** —
   * B-864, lo pidió el `auditor-privacidad` y la objeción es exacta: la garantía
   * de que `getAll(ref, { fieldMask: [] })` no trae el contacto del tercero
   * estaba fijada **solo** por un aserto de texto sobre el fuente
   * (`retencion.test.ts`), o sea por la promesa de que una `DocumentMask` vacía
   * significa «ningún campo».
   *
   * La asimetría con la garantía hermana era la señal: el `select` de
   * `propuestasVencibles` tiene las **dos** —el aserto sobre el fuente y el
   * `Object.keys` contra el emulador— y la relectura tenía una sola. El día que
   * un bump del SDK o del backend cambie la interpretación de la máscara vacía,
   * la Function empieza a tener el contacto en la mano **con toda la suite en
   * verde**, que es exactamente el modo de falla que este archivo existe para
   * cubrir.
   *
   * Va contra el emulador porque es ahí donde la proyección de verdad ocurre —el
   * mismo motivo que «y `creadoEn` sí viaja»—.
   */
  it('la relectura del borrado trae la versión y ni un campo del documento', async () => {
    const ref = adminDb().collection('propuestas').doc(RESCATADA);

    // Control positivo: el documento **sí** tiene el contacto adentro. Sin esto,
    // «no trajo campos» pasaría porque no hay campos que traer.
    expect((await ref.get()).get('contacto')).toBeTruthy();

    const [metadata] = await adminDb().getAll(ref, { fieldMask: [] });
    expect(metadata.exists, 'la relectura no encontró el documento').toBe(true);
    expect(
      Object.keys(metadata.data() ?? {}),
      'la relectura trajo campos del documento: el contacto del tercero entró a la memoria de la Function',
    ).toEqual([]);
    expect(
      metadata.updateTime,
      'la relectura no trajo la versión, que es para lo único que existe',
    ).toBeTruthy();
    // Y es **la misma** versión que la query guardó: si no lo fuera, la guarda
    // compararía dos cosas distintas y no protegería nada.
    const desdeLaQuery = (await propuestasVencibles(adminDb())).find((p) => p.id === RESCATADA);
    expect(
      (metadata.updateTime as { isEqual: (o: unknown) => boolean }).isEqual(desdeLaQuery!.updateTime),
    ).toBe(true);
  });

  /**
   * **Dos corridas sobre la misma propuesta: la segunda no dice que la
   * rescataron** — B-864, lo pidió el `auditor-trampas`.
   *
   * El caso no es teórico: el trigger corre por reloj **y**
   * `scripts/borrar-propuestas-vencidas.mjs` se corre a mano, que es el uso que
   * `08-operacion.md` describe como normal. Si la otra corrida se lleva el
   * documento entre la relectura y el `delete`, la precondición corta con el
   * **mismo código 9** que usa para «otra versión», y la primera versión de este
   * cambio lo etiquetaba `la-tocaron-tarde`: un `warn` diciendo que una
   * propuesta viva quedó con el flyer roto, sobre una propuesta que ya no
   * existe. El operador iría a buscarla.
   *
   * MUTACIÓN PROBADA: devolviendo `'la-tocaron-tarde'` a secas en el `catch`
   * —o sea sin la segunda relectura— este caso se pone rojo y todos los demás
   * siguen verdes.
   */
  it('si otra corrida se la lleva en el medio, el final es `ya-no-esta` y no un rescate', async () => {
    const { aBorrar } = decidirRetencion({
      propuestas: await propuestasVencibles(adminDb()),
      ahora: Date.now(),
    });
    const nuestra = aBorrar.find((p) => p.id === CONCURRENTE);
    expect(nuestra, 'la `nueva` de hace 90 días tendría que haber vencido').toBeTruthy();

    const real = adminDb();
    const dbConOtraCorridaEnLaVentana = {
      collection: (c: string) => real.collection(c),
      getAll: async (...args: unknown[]) => {
        const leido = await (real.getAll as (...a: never[]) => Promise<unknown[]>)(
          ...(args as never[]),
        );
        // La otra corrida se lleva el documento acá. Solo la primera vez: la
        // segunda relectura es la del `catch`, y tiene que ver el documento ido.
        await real.collection('propuestas').doc(CONCURRENTE).delete();
        return leido;
      },
    };

    const final = await borrarPropuesta(
      dbConOtraCorridaEnLaVentana as never,
      adminBucket(),
      nuestra!,
    );

    expect((await adminDb().collection('propuestas').doc(CONCURRENTE).get()).exists).toBe(false);
    expect((await adminBucket().file(OBJETO_CONCURRENTE).exists())[0]).toBe(false);
    expect(
      final,
      'código 9 también significa «ya no existe»: llamarlo rescate manda a buscar una propuesta que no está',
    ).toBe('ya-no-esta');
  });
});
