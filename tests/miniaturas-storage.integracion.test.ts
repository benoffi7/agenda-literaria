import { afterAll, describe, expect, it } from 'vitest';
import { adminBucket } from '@/lib/firebase-admin';
import { miniaturasConocidas, olvidarMiniaturas } from '@/lib/contenidoDelSitio';
import { rutaDeMiniatura, urlDeMiniaturaSiExiste } from '@/lib/imagenes';
import { PROJECT_ID, emuladorStorageVivo } from './emulador';

/**
 * La clave del listado de Storage tiene que ser **la misma** que
 * `rutaDeMiniatura` deriva — D-210, clase de B-88.
 *
 * ── Por qué esto no se puede testear sin el emulador ──────────────────────
 * `miniaturasConocidas()` compara dos strings que **nadie más compara**, y cada
 * uno lo produce un lado distinto:
 *
 * | Lado | Quién lo produce | Qué produce |
 * |---|---|---|
 * | el set | `@google-cloud/storage` (`o.name` de `getFiles`) | la clave, con la forma que decide la librería |
 * | la consulta | `rutaDeMiniatura` (`src/lib/imagenes.ts`) | `miniaturas/<id>.jpg`, derivado por nosotros |
 *
 * Los tests de unidad de `urlDeMiniaturaSiExiste` usan un `Set` **escrito a
 * mano**, o sea el lado del consumidor duplicado: prueban la lógica de
 * membresía y no pueden ver si el productor real coincide. Si algún día
 * `getFiles` devolviera las claves con otra forma —con el bucket adelante, con
 * `gs://`, con el prefijo recortado— `has()` daría `false` **siempre**, todos
 * los `srcset` del sitio desaparecerían, y la suite entera quedaría en verde.
 * No es una fuga: es la optimización de B-320/B-321 apagada en silencio, que es
 * la familia de modo de falla que B-189 evita del lado de Firestore. Lo
 * encontró el `auditor-privacidad` cerrando D-210.
 *
 * Va en un archivo aparte y no en `tests/imagenes.test.ts` por la misma razón
 * que `storage-reglas.integracion.test.ts`: pide el emulador de Storage arriba,
 * y el resto de aquel archivo es puro y corre sin nada.
 *
 * MUTACIÓN PROBADA: devolver `gs://x/${o.name}` en vez de `o.name` desde
 * `leerMiniaturas()` deja los dos primeros `it` en rojo. Ningún otro test del
 * repo se entera de ese cambio.
 */
const vivo = await emuladorStorageVivo();

/**
 * El id lleva el `projectId` de **este** checkout — B-219.
 *
 * Aquella partición fue por `projectId` de Firestore, y el bucket del emulador
 * **no** se particionó: `BUCKET_EMULADOR` es el mismo string para todos los
 * worktrees. Con un id fijo, el `afterAll` de un checkout puede borrar el objeto
 * entre el `save()` y el `has()` de otro — y el rojo intermitente diría «las
 * claves vienen con otra forma», que es un diagnóstico equivocado. Misma
 * disciplina que `tests/storage-reglas.integracion.test.ts`.
 */
const ID = `img_d210-${PROJECT_ID}`;
/** El original que un panel habría subido, tal como queda en el documento. */
const PATH_ORIGINAL = `imagenes/${ID}.jpg`;
const URL_ORIGINAL =
  'https://firebasestorage.googleapis.com/v0/b/agenda-literaria.firebasestorage.app/o/' +
  `imagenes%2F${ID}.jpg?alt=media&token=tok`;

const RUTA = rutaDeMiniatura(PATH_ORIGINAL)!;

describe.skipIf(!vivo)('el listado de Storage y la derivación coinciden (D-210, clase de B-88)', () => {
  afterAll(async () => {
    // El emulador de quien está trabajando persiste su estado
    // (`--export-on-exit`): este objeto le quedaría en el bucket. Y sin la
    // variable no se borra nada: el objeto que habría que borrar estaría en
    // producción, y este archivo no toca producción ni para limpiar.
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      await adminBucket().file(RUTA).delete({ ignoreNotFound: true });
    }
    olvidarMiniaturas();
  });

  it('lo que `getFiles` devuelve es exactamente lo que `rutaDeMiniatura` deriva', async () => {
    /*
     * **Este archivo ESCRIBE en el bucket, así que la guarda va antes del
     * `save()` y no puede ser el `skipIf`.** `emuladorStorageVivo()` mira
     * `HOST_STORAGE` —hace un `fetch`—, que es una variable **distinta** de la
     * que resuelve el destino del Admin SDK: el emulador puede estar arriba y
     * `FIREBASE_STORAGE_EMULATOR_HOST` faltar en el entorno del proceso (un
     * `--config` alternativo, alguien tocando el bloque `env`), y entonces esto
     * crearía un objeto **en producción**, dentro de `miniaturas/`, que es
     * world-readable por `allow get: if true`.
     *
     * La guarda de `leerMiniaturas()` no alcanza para este caso: corta la
     * lectura, que ocurre **después** de la escritura. Lo encontró el
     * `auditor-privacidad`.
     */
    expect(
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
      'este test escribe en el bucket: sin FIREBASE_STORAGE_EMULATOR_HOST escribiría en producción',
    ).toBeTruthy();

    await adminBucket().file(RUTA).save(Buffer.from([0xff, 0xd8, 0xff]), {
      contentType: 'image/jpeg',
    });
    olvidarMiniaturas();

    const conocidas = await miniaturasConocidas();

    // Control positivo: sin esto, un set vacío pasaría el aserto de abajo por
    // ausencia — que es justo el modo de falla que este archivo persigue.
    expect(conocidas.size, 'el listado no devolvió nada: ¿el emulador tiene el objeto?').toBeGreaterThan(0);

    expect(
      conocidas.has(RUTA),
      `el listado no trae "${RUTA}". Devolvió: ${JSON.stringify([...conocidas])}. ` +
        'Si las claves vienen con otra forma, `has()` da false siempre y el sitio ' +
        'se queda sin ningún `srcset`, en silencio (D-210).',
    ).toBe(true);
  });

  it('y con eso la URL sale confirmada de punta a punta', async () => {
    const conocidas = await miniaturasConocidas();
    const url = urlDeMiniaturaSiExiste(URL_ORIGINAL, conocidas);

    expect(url).toContain(`miniaturas%2F${ID}.jpg`);
    // El token del original no viaja: la miniatura tiene el suyo y no hace
    // falta ninguno (`allow get: if true`, D-175).
    expect(url).not.toContain('token=');
  });

  it('un original cuya miniatura no está en el bucket no se confirma', async () => {
    // Control negativo: sin esto, una implementación que devolviera la URL
    // siempre pasaría los dos `it` de arriba.
    const conocidas = await miniaturasConocidas();
    expect(urlDeMiniaturaSiExiste(URL_ORIGINAL.replace(ID, `${ID}-ausente`), conocidas))
      .toBeNull();
  });
});
