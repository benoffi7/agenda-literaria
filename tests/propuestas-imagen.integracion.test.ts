/**
 * **Aceptar una propuesta se lleva el flyer original, y solo el flyer** —
 * **B-863**, contra los emuladores.
 *
 * La decisión de qué se borra y el **orden** de las dos operaciones son puros y
 * están en `tests/propuestas-imagen.test.ts`, con dobles que anotan qué se hizo
 * y en qué orden. Lo que este archivo verifica es lo único que **no se puede
 * razonar sin los emuladores**: que los paths que la Function arma son los que
 * el bucket conoce, y que después de aceptar el estado del mundo es el que la
 * decisión del dueño pidió — el contacto **sí**, la foto original **no**.
 *
 * ── Por qué el caso está escrito sobre las dos mitades a la vez ───────────
 * Porque el bug era exactamente eso: `aceptada: null` se decidió **por el
 * contacto** («ahí sirve: la actividad existe y puede haber que repreguntar») y
 * se aplicó también a la foto sin que nadie lo dijera. Un caso que mirara solo
 * la foto pasaría en verde el día que alguien «arregle» esto haciendo caducar la
 * aceptada, que es la otra forma de romperlo — y se llevaría puesta la decisión
 * de B-844. Por eso el mismo `it` afirma las dos.
 *
 * El flujo se ejercita llamando a `borrarOriginalAlAceptar` con el `db` y el
 * `bucket` de verdad, no levantando el emulador de Functions: es el mismo corte
 * que `retencion.integracion.test.ts` usa con `borrarPropuesta`, y por eso esas
 * dos funciones reciben sus dependencias en vez de importarlas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminBucket, adminDb } from '@/lib/firebase-admin';
import { borrarOriginalAlAceptar, decidirBorradoDeImagen } from '../functions/propuestas.js';
import { PROJECT_ID, emuladorStorageVivo, emuladorVivo } from './emulador';

const vivo = (await emuladorVivo()) && (await emuladorStorageVivo());

/**
 * Los ids llevan el `projectId` de **este** checkout (B-219). Firestore ya está
 * particionado por proyecto, pero **el bucket del emulador no**: sin esto, el
 * `afterAll` de un worktree borraría el objeto de otro a mitad de camino.
 */
const PROPUESTA = `p_aceptada-${PROJECT_ID}`;
const ACTIVIDAD = `a_de_la_propuesta-${PROJECT_ID}`;
/** El flyer que mandó el tercero, en el prefijo que nadie barre. */
const ORIGINAL = `propuestas/prop_aceptada_${PROJECT_ID}.jpg`;
/** La copia que `promoverImagenDePropuesta` dejó en la galería. */
const COPIA = `imagenes/img_promovida_${PROJECT_ID}.jpg`;

/** La propuesta como queda después de `alGuardar`: aceptada, con su actividad. */
const propuestaAceptada = () => ({
  titulo: 'Taller que se aceptó',
  descripcion: 'Cuatro encuentros para escribir crónica, con lecturas y consignas.',
  fechas: [{ dia: '2026-10-07', desde: '19:00', hasta: '21:00' }],
  modalidad: 'presencial',
  lugar: null,
  organizador: { nombre: 'Quien propuso', instagram: null },
  arancel: { tipo: 'gratis', notas: null },
  inscripcion: { requiere: false, comoDice: null },
  incluye: [],
  incluyeOtro: null,
  imagen: { storagePath: ORIGINAL },
  /*
   * El dato personal del tercero, y está en el fixture **a propósito**: es
   * contra lo que se afirma que la aceptación no lo toca. B-844 decidió que la
   * aceptada no vence justamente por este campo.
   */
  contacto: { via: 'whatsapp', valor: '+54 9 11 2222-3333' },
  estado: 'aceptada',
  creadoEn: new Date('2026-09-01T12:00:00Z'),
  origen: 'formulario-publico',
  revision: {
    porUid: 'uid_admin',
    en: new Date('2026-09-10T12:00:00Z'),
    actividadId: ACTIVIDAD,
    motivo: null,
  },
});

/** La actividad que salió de la conversión, con la copia ya en su galería. */
const actividadConLaCopia = () => ({
  titulo: 'Taller que se aceptó',
  slug: `taller-que-se-acepto-${PROJECT_ID}`,
  estado: 'borrador',
  imagenes: [
    {
      id: `img_promovida_${PROJECT_ID}`,
      url: 'https://ejemplo.test/no-se-lee',
      epigrafe: '',
      textoAlternativo: '',
      origen: 'propia',
      storagePath: COPIA,
      portada: true,
    },
  ],
  // Campos que la máscara de la lectura **no** tiene que traer. Están para que
  // el caso de privacidad de abajo pueda afirmar algo.
  online: { plataforma: 'meet', url: 'https://meet.test/secreto', urlPublica: false },
  difusion: { arrobar: ['@alguien'], notas: 'interno' },
  createdBy: 'uid_admin',
});

const jpegDeMentira = () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

describe.skipIf(!vivo)('aceptar una propuesta y su flyer original — B-863', () => {
  beforeAll(async () => {
    /*
     * **Este archivo escribe y borra en el bucket, así que la guarda va antes
     * del `save()` y no puede ser el `skipIf`.** `emuladorStorageVivo()` mira
     * `HOST_STORAGE` —un `fetch`—, que es una variable **distinta** de la que
     * resuelve el destino del Admin SDK: el emulador puede estar arriba y
     * `FIREBASE_STORAGE_EMULATOR_HOST` faltar del entorno del proceso, y
     * entonces esto crearía —y después borraría— un objeto **en producción**.
     * Misma lección que `retencion.integracion.test.ts`.
     */
    expect(
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
      'este test escribe y borra en el bucket: sin FIREBASE_STORAGE_EMULATOR_HOST tocaría producción',
    ).toBeTruthy();
    expect(
      process.env.FIRESTORE_EMULATOR_HOST,
      'este test escribe documentos: sin FIRESTORE_EMULATOR_HOST tocaría producción',
    ).toBeTruthy();

    await adminDb().collection('propuestas').doc(PROPUESTA).set(propuestaAceptada());
    await adminDb().collection('actividades').doc(ACTIVIDAD).set(actividadConLaCopia());
    for (const objeto of [ORIGINAL, COPIA]) {
      await adminBucket().file(objeto).save(jpegDeMentira(), { contentType: 'image/jpeg' });
    }
  }, 30_000);

  afterAll(async () => {
    if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) return;
    for (const objeto of [ORIGINAL, COPIA]) {
      await adminBucket().file(objeto).delete({ ignoreNotFound: true });
    }
    await adminDb().collection('propuestas').doc(PROPUESTA).delete();
    await adminDb().collection('actividades').doc(ACTIVIDAD).delete();
  });

  /**
   * **El caso que nombra el ítem.** Antes de B-863 pasaba la primera mitad y
   * fallaba la segunda: el original se quedaba en `propuestas/` sin fecha de
   * vencimiento, bajo un prefijo que `limpiarImagenesHuerfanas` no recorre.
   *
   * MUTACIÓN PROBADA: sacando `'aceptada'` de `ESTADOS_QUE_CIERRAN`, este caso
   * se pone rojo en la decisión —«cerrar no incluye aceptar»—, que es
   * exactamente el estado del mundo el 2026-09-09: el bug reproducido.
   */
  it('la aceptada conserva el contacto pero no la foto original', async () => {
    // Control positivo: sin esto, «el original ya no está» pasaría también si
    // el `beforeAll` no hubiera subido nada.
    expect((await adminBucket().file(ORIGINAL).exists())[0], 'el original tiene que existir antes').toBe(true);

    /*
     * **Se pasa por la decisión y no se la saltea**, aunque el emulador de
     * Functions no esté levantado: el trigger es `decidirBorradoDeImagen` +
     * `borrarOriginalAlAceptar`, y un caso que llamara solo al segundo diría que
     * el borrado funciona sin decir que **se dispara**. Es el mismo corte que
     * `retencion.integracion.test.ts` hace con `propuestasVencibles` +
     * `borrarPropuesta`.
     */
    const antes = await adminDb().collection('propuestas').doc(PROPUESTA).get();
    const decision = decidirBorradoDeImagen({
      before: { ...antes.data(), estado: 'en-revision' },
      after: antes.data(),
    });
    expect(decision).toMatchObject({
      accion: 'borrar',
      objeto: ORIGINAL,
      motivo: 'aceptada',
      actividadId: ACTIVIDAD,
    });

    expect(
      await borrarOriginalAlAceptar(adminDb(), adminBucket(), {
        objeto: decision.objeto,
        actividadId: decision.actividadId,
      }),
    ).toBe('borrado');

    // La foto del tercero se fue del prefijo que nadie barre…
    expect((await adminBucket().file(ORIGINAL).exists())[0], 'el original tenía que borrarse').toBe(false);
    // …y la copia promovida —la que la actividad muestra— sigue intacta.
    expect((await adminBucket().file(COPIA).exists())[0], 'la copia promovida no se toca').toBe(true);

    // El contacto sigue, que es lo que B-844 decidió y este ítem NO cambia.
    const doc = await adminDb().collection('propuestas').doc(PROPUESTA).get();
    expect(doc.exists, 'la aceptada no se borra: no vence').toBe(true);
    expect(doc.get('contacto')).toEqual({ via: 'whatsapp', valor: '+54 9 11 2222-3333' });
    expect(doc.get('estado')).toBe('aceptada');
    /*
     * Y el documento **sigue nombrando** un objeto que ya no está. No es un
     * descuido: escribirle el `storagePath` en `null` sería un write-back sobre
     * el documento que disparó el trigger (trampa 3), y además borraría la
     * prueba de qué mandaron. La consecuencia —reabrir no trae la foto— es la
     * misma que ya tenía el rechazo y está dicha en la pantalla.
     */
    expect(doc.get('imagen')).toEqual({ storagePath: ORIGINAL });
  }, 30_000);

  /**
   * **La lectura de la actividad trae `imagenes` y nada más, medido contra el
   * emulador** (§5.1). El caso puro afirma que la máscara se **pasa**; éste
   * afirma que la máscara **hace algo** — que es lo que un doble no puede decir,
   * porque el que decide qué campos vuelven es el servidor.
   *
   * Importa acá y no en cualquier lectura: la actividad que sale de una
   * propuesta lleva el link de la reunión, la difusión interna y los uids, y
   * esta Function solo necesita un array de paths.
   *
   * MUTACIÓN PROBADA: sacando el `fieldMask` del `getAll`, este caso se pone
   * rojo y todos los demás siguen verdes.
   */
  it('la actividad se lee sin el link de la reunión, la difusión ni los uids', async () => {
    /*
     * El `db` real, envuelto para anotar **qué campos volvieron de verdad**. No
     * es un doble: la lectura la hace el emulador y el que decide qué campos
     * manda es el servidor — que es justo lo que un doble no puede decir.
     */
    const vistos: string[][] = [];
    const espia = {
      collection: (nombre: string) => adminDb().collection(nombre),
      getAll: async (...args: Parameters<ReturnType<typeof adminDb>['getAll']>) => {
        const snaps = await adminDb().getAll(...args);
        vistos.push(Object.keys(snaps[0]?.data() ?? {}));
        return snaps;
      },
    };

    await borrarOriginalAlAceptar(espia, adminBucket(), {
      objeto: ORIGINAL,
      actividadId: ACTIVIDAD,
    });

    expect(vistos).toEqual([['imagenes']]);

    // Control positivo: los campos existen en el documento, así que su ausencia
    // de arriba es la máscara y no un fixture pobre.
    const entero = await adminDb().collection('actividades').doc(ACTIVIDAD).get();
    expect(entero.get('online')?.url).toBe('https://meet.test/secreto');
    expect(entero.get('difusion')).toBeTruthy();
    expect(entero.get('createdBy')).toBe('uid_admin');
  }, 30_000);

  /**
   * **Idempotencia.** La entrega de eventos de Firestore es «al menos una vez»,
   * así que el handler puede correr dos veces sobre la misma transición: el
   * segundo pasaje tiene que ser inofensivo y no tirar 404.
   *
   * Corre **después** del caso de arriba a propósito (el orden de los `it` en un
   * archivo es el de declaración): el estado que ejercita es «el original ya no
   * está».
   */
  it('correr dos veces sobre la misma transición no rompe nada', async () => {
    expect(
      await borrarOriginalAlAceptar(adminDb(), adminBucket(), {
        objeto: ORIGINAL,
        actividadId: ACTIVIDAD,
      }),
    ).toBe('borrado');
    expect((await adminBucket().file(COPIA).exists())[0]).toBe(true);
  }, 30_000);
});
