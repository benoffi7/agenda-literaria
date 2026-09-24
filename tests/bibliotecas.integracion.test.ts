/**
 * Reglas y escritura de `/bibliotecas/{id}` contra el emulador — B-960.
 *
 * ── Por qué este archivo es el que importa de este frente ─────────────────
 * `/bibliotecas` acepta una escritura **anónima**, y `formaDeBiblioteca()` es lo
 * único que acota un documento que escribe alguien sin login. El schema de zod
 * no cuenta: se saltea con un `curl`. Así que cada tope, cada enum y cada `null`
 * de la regla tiene su caso acá, y se prueban **contra el emulador** porque un
 * `grep` al archivo pasaría con la regla escrita mal (`'Publicado'`, `!=`, el
 * campo renombrado) — el argumento de B-218.
 *
 * ── Y por qué hay tantos controles POSITIVOS ──────────────────────────────
 * Porque una denegación es lo que devuelve también un emulador que no está, una
 * base sin reglas o un `projectId` equivocado. **B-894 fue exactamente eso**: el
 * emulador de CI corría en otro proyecto que los tests, y el desajuste apagó
 * *solo* lo que las reglas otorgan — todo lo que niegan siguió en verde. Cada
 * `describe` de acá abre o cierra con el caso que tiene que **funcionar**.
 *
 * ── Lo propio de esta colección ───────────────────────────────────────────
 * Las dos cláusulas de DEC-12 sobre `asociarse.costo` —la hora del servidor al
 * crear, y las dos formas legales al editar— y la que rechaza **un costo colgado
 * de un «no hace falta»**. Son las únicas de este archivo que no existen en
 * `librerias.integracion.test.ts`, y son las que hay que mirar.
 *
 * Las reglas que se verifican son las de **este** checkout: se empujan por la
 * API del emulador en el `beforeAll` (B-174), sobre la base de **este**
 * working-tree (B-219, el `projectId` derivado de la ruta absoluta).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import type { Firestore as FirestoreAdmin } from 'firebase-admin/firestore';
import { signOut } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { bibliotecaVacia, formABiblioteca } from '@/lib/biblioteca-schema';
import { confirmarCostoDeBiblioteca } from '@/lib/bibliotecas';
import type { BibliotecaForm } from '@/types/biblioteca';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';
/*
 * **El helper compartido de credenciales — B-1060**, y no una copia propia.
 * Entró a `main` mientras se escribía este archivo, y `tests/credenciales-del-emulador.test.ts`
 * barre `tests/` para que la copia quince no vuelva a nacer. Además trae gratis
 * la guarda de **B-1112**: `entrarComo` compara el `aud` del ID token contra
 * `PROJECT_ID` en el primer login del proceso y falla nombrando los dos
 * proyectos, en vez de dejar un `PERMISSION_DENIED` que se diagnostica de cero.
 */
import { entrarComo } from './fixtures/credenciales-del-emulador';
import { denegada } from './fixtures/rechazos-del-emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID = 'uid_bibliotecas_admin';
const UID_PELADO = 'uid_bibliotecas_sin_claim';

/** El Admin SDK, para sembrar lo que ningún cliente puede escribir. */
const conAdminSdk = async (fn: (db: FirestoreAdmin) => Promise<void>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `b-sdk-${Date.now()}-${Math.random()}`);
  await fn(getAdminFirestore(app));
  await deleteAdminApp(app);
};

const form = (over: Partial<BibliotecaForm> = {}): BibliotecaForm => ({
  ...bibliotecaVacia(),
  nombre: 'Biblioteca Popular Alberdi',
  descripcion: 'Biblioteca de barrio con sala de lectura y hemeroteca.',
  tipo: 'popular',
  direccion: 'Talcahuano 1261',
  barrio: 'recoleta',
  horarios: 'Lun a vie de 9 a 20',
  horarioDeSala: 'Lun a vie de 14 a 19',
  asociarse: { haceFalta: true, costo: '$3.000 por año' },
  catalogo: 'catalogo.alberdi.test',
  instagram: '@bpalberdi',
  whatsapp: '+54 9 11 2222-3333',
  web: 'alberdi.test',
  mail: 'hola@alberdi.test',
  contactoDeQuienCargo: { via: 'mail', valor: 'quien.cargo@alberdi.test' },
  ...over,
});

/**
 * El documento tal como lo manda el cliente, para poder deformarlo campo por
 * campo.
 *
 * `serverTimestamp()` en los dos lugares donde la regla exige `request.time`:
 * `creadoEn` y el `cargadoEn` del costo. Que el segundo sea **el mismo
 * centinela** y no un `Timestamp` armado en el cliente es justamente lo que
 * DEC-12 pide, y hay un caso abajo que lo verifica al revés.
 */
const documento = (
  over: Record<string, unknown> = {},
  f: BibliotecaForm = form(),
  origen: 'panel' | 'formulario-publico' = 'panel',
) => ({
  ...formABiblioteca(f, serverTimestamp() as never, origen),
  creadoEn: serverTimestamp(),
  ...over,
});


/*
 * El helper que afirma «la regla corrió y denegó» —y no «la regla explotó»—
 * vive en `fixtures/rechazos-del-emulador.ts` (B-1130). Acá había una copia que
 * miraba solo el `code`; el porqué de cada decisión, y los mensajes medidos que
 * la sostienen, están en su docblock.
 */

/** Un id nuevo por caso: los documentos no se pisan entre tests. */
let n = 0;
const nuevaRef = () => doc(db(), 'bibliotecas', `bib_${Date.now()}_${n++}`);

describe.skipIf(!vivo)('bibliotecas contra el emulador — B-960', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    // B-174 / B-219 — las reglas de este checkout, sobre la base de este
    // working-tree, que arranca sin ninguna.
    await cargarReglas(REGLAS);
    await entrarComo(UID, { admin: true });
  }, 30_000);

  describe('el camino que funciona: un admin carga una biblioteca', () => {
    it('crea una ficha válida y la puede leer', async () => {
      // Control positivo. Sin esto, todas las negaciones de abajo podrían estar
      // pasando porque la regla niega **todo**.
      const ref = nuevaRef();
      await setDoc(ref, documento());
      const snap = await getDoc(ref);
      expect(snap.exists()).toBe(true);
      expect(snap.data()!.estado).toBe('pendiente');
      expect(snap.data()!.asociarse.haceFalta).toBe(true);
      expect(snap.data()!.asociarse.costo.valor).toBe('$3.000 por año');
    });

    it('un admin puede listar el directorio entero', async () => {
      const snap = await getDocs(collection(db(), 'bibliotecas'));
      expect(snap.empty).toBe(false);
    });

    it('desde el panel puede nacer publicada (B-983)', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento({ estado: 'publicado' }));
      expect((await getDoc(ref)).data()!.estado).toBe('publicado');
    });

    it('edita el contenido sin refirmar la revisión', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      const { estado, origen, revision, ...contenido } = formABiblioteca(
        form({ descripcion: 'Con hemeroteca y sala de lectura para 40 personas.' }),
        (await getDoc(ref)).data()!.asociarse.costo.cargadoEn,
        'panel',
      );
      void estado;
      void origen;
      void revision;
      await updateDoc(ref, contenido);
      expect((await getDoc(ref)).data()!.descripcion).toContain('40 personas');
    });

    it('mueve el estado firmando con su uid y la hora del servidor', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await updateDoc(ref, {
        estado: 'publicado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      expect((await getDoc(ref)).data()!.estado).toBe('publicado');
    });

    it('borra una ficha: la retención tarda 30 días y esto es inmediato', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await deleteDoc(ref);
      expect((await getDoc(ref)).exists()).toBe(false);
    });
  });

  describe('el costo de asociarse — DEC-12 / B-837, lo propio de esta colección', () => {
    it('un costo colgado de un «no hace falta» se rechaza', async () => {
      /*
       * La contradicción que la ficha publicaría al lado: «no hace falta
       * asociarse · $3.000 por año». El schema lo frena para quien mira la
       * pantalla; esto lo frena para el `curl`.
       */
      await denegada(
        setDoc(
          nuevaRef(),
          documento({
            asociarse: {
              haceFalta: false,
              costo: { valor: '$3.000 por año', cargadoEn: serverTimestamp() },
            },
          }),
        ),
        'un costo sobre un «no hace falta»',
      );
    });

    it('`haceFalta: true` sin costo es válido: es la ficha que llega de afuera', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form({ asociarse: { haceFalta: true, costo: '' } })));
      expect((await getDoc(ref)).data()!.asociarse.costo).toBeNull();
    });

    it('la fecha del costo no se puede antedatar: tiene que ser la hora del servidor', async () => {
      // El reloj del navegador no puede decir que el número es más viejo —ni más
      // nuevo— de lo que es. Es toda la razón por la que la fecha existe.
      await denegada(
        setDoc(
          nuevaRef(),
          documento({
            asociarse: {
              haceFalta: true,
              costo: {
                valor: '$3.000 por año',
                cargadoEn: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
              },
            },
          }),
        ),
        'un `cargadoEn` puesto por el cliente',
      );
    });

    it('editar sin tocar el costo conserva su fecha, y eso NO refecha nada', async () => {
      /*
       * La mitad de DEC-12 que más importa: corregir un typo de la descripción
       * no puede mover la fecha del costo, porque publicaría que el número es
       * más fresco de lo que es.
       */
      const ref = nuevaRef();
      await setDoc(ref, documento());
      const antes = (await getDoc(ref)).data()!.asociarse.costo.cargadoEn;
      const { estado, origen, revision, ...contenido } = formABiblioteca(
        form({ descripcion: 'Otra descripción, mismo costo.' }),
        antes,
        'panel',
      );
      void estado;
      void origen;
      void revision;
      await updateDoc(ref, contenido);
      const despues = (await getDoc(ref)).data()!.asociarse.costo.cargadoEn;
      expect(despues.isEqual(antes)).toBe(true);
    });

    it('dejar la fecha vieja con un valor nuevo se rechaza', async () => {
      // Publicar un número de hoy con cara de viejo. Es la cláusula que le falta
      // a la de arriba para que las dos formas legales sean solo dos.
      const ref = nuevaRef();
      await setDoc(ref, documento());
      const antes = (await getDoc(ref)).data()!.asociarse.costo.cargadoEn;
      await denegada(
        updateDoc(ref, {
          asociarse: { haceFalta: true, costo: { valor: '$9.000 por año', cargadoEn: antes } },
        }),
        'valor nuevo con la fecha vieja',
      );
    });

    it('cambiar el valor con la hora del servidor sí se acepta', async () => {
      // Control positivo del par anterior: sin esto, «se rechaza» podría querer
      // decir que la cláusula rechaza toda edición del costo.
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await updateDoc(ref, {
        asociarse: { haceFalta: true, costo: { valor: '$9.000 por año', cargadoEn: serverTimestamp() } },
      });
      expect((await getDoc(ref)).data()!.asociarse.costo.valor).toBe('$9.000 por año');
    });

    it('«lo revisé: sigue siendo éste» refecha el costo sin tocar el valor — B-1410', async () => {
      /*
       * El botón de la bandeja entra por la puerta que la cláusula de DEC-12 ya
       * dejaba abierta: `cargadoEn == request.time` con el mismo valor. La regla
       * no se tocó; esto prueba que la función que llama el panel pasa por ahí.
       * MUTACIÓN A PROBAR: escribir `{ 'asociarse.costo': { cargadoEn } }` se
       * queda sin `valor` y da rojo.
       */
      const ref = nuevaRef();
      await setDoc(ref, documento());
      const antes = (await getDoc(ref)).data()!;
      await confirmarCostoDeBiblioteca(ref.id, antes as never);
      const despues = (await getDoc(ref)).data()!;
      expect(despues.asociarse.costo.valor).toBe(antes.asociarse.costo.valor);
      expect((despues.asociarse.costo.cargadoEn as Timestamp).toMillis()).toBeGreaterThanOrEqual(
        (antes.asociarse.costo.cargadoEn as Timestamp).toMillis(),
      );
    });

    it('el costo es texto: un número se rechaza', async () => {
      await denegada(
        setDoc(
          nuevaRef(),
          documento({
            asociarse: { haceFalta: true, costo: { valor: 3000, cargadoEn: serverTimestamp() } },
          }),
        ),
        'un costo numérico',
      );
    });

    it('`haceFalta` tiene que ser un booleano', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ asociarse: { haceFalta: 'si', costo: null } })),
        'un `haceFalta` de texto',
      );
    });
  });

  describe('lo que el `create` fuerza y un `curl` no se puede saltear', () => {
    it('un anónimo puede crear la ficha que el formulario manda', async () => {
      /*
       * **El control positivo de la puerta anónima**, y es el caso más
       * importante del archivo: si esto se rompe, el formulario público de
       * `/guia/bibliotecas/sumar` deja de funcionar y ninguna de las negaciones
       * de abajo lo diría.
       */
      await signOut(auth());
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form(), 'formulario-publico'));
      await entrarComo(UID, { admin: true });
      const leida = await getDoc(ref);
      expect(leida.data()!.origen).toBe('formulario-publico');
      expect(leida.data()!.estado).toBe('pendiente');
    });

    it('un anónimo no puede publicar la suya', async () => {
      await signOut(auth());
      await denegada(
        setDoc(nuevaRef(), documento({ estado: 'publicado' }, form(), 'formulario-publico')),
        'un anónimo publicando',
      );
      await entrarComo(UID, { admin: true });
    });

    it('un anónimo no puede decir que su ficha vino del panel', async () => {
      await signOut(auth());
      await denegada(
        setDoc(nuevaRef(), documento({}, form(), 'panel')),
        'un anónimo con origen panel',
      );
      await entrarComo(UID, { admin: true });
    });

    it('una ficha que llega de afuera nace SIN fotos', async () => {
      const conFoto = form({
        imagenes: [
          {
            id: 'img_1',
            url: 'https://ejemplo.test/f.jpg',
            epigrafe: '',
            origen: 'externa',
            portada: true,
          },
        ],
      });
      await signOut(auth());
      await denegada(
        setDoc(nuevaRef(), documento({}, conFoto, 'formulario-publico')),
        'un anónimo con una foto',
      );
      await entrarComo(UID, { admin: true });
      // Y el control positivo: desde el panel **sí** entra, que es donde vive el
      // editor de galería y donde hay alguien mirando.
      const ref = nuevaRef();
      await setDoc(ref, documento({}, conFoto, 'panel'));
      expect((await getDoc(ref)).data()!.imagenes).toHaveLength(1);
    });

    it('nadie nace revisado ni con la marca de la trampa 10 puesta', async () => {
      await denegada(
        setDoc(
          nuevaRef(),
          documento({ revision: { porUid: UID, en: serverTimestamp(), motivo: null } }),
        ),
        'una ficha que nace revisada',
      );
      await denegada(
        setDoc(nuevaRef(), documento({ publicadaAlgunaVez: true })),
        'una ficha que nace con el slug congelado',
      );
    });

    it('`creadoEn` no se puede antedatar', async () => {
      await denegada(
        setDoc(
          nuevaRef(),
          documento({ creadoEn: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) }),
        ),
        'un `creadoEn` del cliente',
      );
    });
  });

  describe('los topes y los alfabetos de `formaDeBiblioteca()`', () => {
    it('el slug tiene que tener el alfabeto de `slugify`', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ slug: 'Alberdi Recoleta' })),
        'un slug con mayúsculas y espacios',
      );
    });

    it('el tipo tiene que ser un slug, y `\'\'` se acepta', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ tipo: 'Biblioteca Popular' })),
        'un tipo sin slugificar',
      );
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form({ tipo: '' })));
      expect((await getDoc(ref)).data()!.tipo).toBe('');
    });

    it('los dos horarios están capados, y por separado', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ horarios: 'x'.repeat(201) })),
        'un horario de atención de 201',
      );
      await denegada(
        setDoc(nuevaRef(), documento({ horarioDeSala: 'x'.repeat(201) })),
        'un horario de sala de 201',
      );
    });

    it('el costo está capado en 120', async () => {
      await denegada(
        setDoc(
          nuevaRef(),
          documento({
            asociarse: {
              haceFalta: true,
              costo: { valor: 'x'.repeat(121), cargadoEn: serverTimestamp() },
            },
          }),
        ),
        'un costo de 121',
      );
    });

    it('el catálogo necesita esquema http(s), igual que la web', async () => {
      // `javascript:` en un `href` de una página indexada. Sin esta cláusula la
      // defensa la pondría el consumidor y no el dato.
      await denegada(
        setDoc(nuevaRef(), documento({ catalogo: 'javascript:alert(1)' })),
        'un catálogo con esquema javascript',
      );
    });

    it('la provincia tiene que ser una de las 24 (B-972)', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ provincia: 'cordoba-capital' })),
        'una provincia inventada',
      );
    });

    it('el `searchText` está capado: un campo que nadie mira no es una bolsa', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ searchText: 'x'.repeat(2001) })),
        'un searchText de 2001',
      );
    });

    it('una geo rota se rechaza y una sana entra', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ geo: { lat: 200, lng: -58.4 } })),
        'una latitud de 200',
      );
      const ref = nuevaRef();
      await setDoc(ref, documento({ geo: { lat: -34.6, lng: -58.4 } }));
      expect((await getDoc(ref)).data()!.geo.lat).toBe(-34.6);
    });

    it('un campo que no está en el `hasOnly` tira la escritura entera', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ presupuesto: 100 })),
        'un campo de más',
      );
    });
  });

  describe('lo que el `update` no deja mover', () => {
    it('el slug de una ficha publicada queda congelado — trampa 10', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento({ estado: 'publicado' }));
      await denegada(
        updateDoc(ref, { slug: 'otro-slug' }),
        'el slug de una publicada',
      );
    });

    it('la marca `publicadaAlgunaVez` no la puede bajar un cliente', async () => {
      const ref = nuevaRef();
      await conAdminSdk(async (adb) => {
        /*
         * ⚠️ **`new Date()` y no `Timestamp.now()`.** Este bloque escribe con el
         * **Admin SDK** y el `Timestamp` importado arriba es el del SDK
         * **cliente**: son dos clases de dos paquetes distintos, y el Admin SDK
         * rechaza el documento entero con «Detected an object of type
         * "Timestamp" that doesn't match the expected instance». Un `Date` lo
         * convierten los dos sin discutir, así que es lo que sirve de los dos
         * lados de la frontera.
         */
        await adb.doc(ref.path).set({
          ...formABiblioteca(form(), new Date() as never, 'panel'),
          creadoEn: new Date(),
          publicadaAlgunaVez: true,
        });
      });
      await denegada(
        updateDoc(ref, { publicadaAlgunaVez: false }),
        'bajar la marca del slug congelado',
      );
    });

    it('`origen` y `creadoEn` no se reescriben', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await denegada(
        updateDoc(ref, { origen: 'formulario-publico' }),
        'repintar el origen',
      );
      await denegada(
        updateDoc(ref, { creadoEn: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) }),
        'reescribir la fecha de alta',
      );
    });

    it('de `rechazado` no se publica de un saque: hay que reabrir primero', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await updateDoc(ref, {
        estado: 'rechazado',
        revision: { porUid: UID, en: serverTimestamp(), motivo: 'Duplicada' },
      });
      await denegada(
        updateDoc(ref, {
          estado: 'publicado',
          revision: { porUid: UID, en: serverTimestamp(), motivo: null },
        }),
        'publicar directo desde rechazado',
      );
      // Y el control positivo: reabrir sí, que son los dos clicks con un estado
      // en el medio donde la ficha se vuelve a mirar.
      await updateDoc(ref, {
        estado: 'pendiente',
        revision: { porUid: UID, en: serverTimestamp(), motivo: null },
      });
      expect((await getDoc(ref)).data()!.estado).toBe('pendiente');
    });

    it('nadie firma una revisión a nombre de otro ni la antedata', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await denegada(
        updateDoc(ref, {
          estado: 'publicado',
          revision: { porUid: 'uid_de_otro', en: serverTimestamp(), motivo: null },
        }),
        'firmar a nombre de otro',
      );
      await denegada(
        updateDoc(ref, {
          estado: 'publicado',
          revision: {
            porUid: UID,
            en: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
            motivo: null,
          },
        }),
        'antedatar la firma',
      );
    });
  });

  describe('la lectura está cerrada, y las dos cláusulas por separado', () => {
    it('un anónimo no puede leer una ficha ni listar el directorio', async () => {
      /*
       * `get` y `list` se deciden por separado: aquél porque **una regla no
       * proyecta** (D-128) —entregaría el documento entero con el
       * `contactoDeQuienCargo` adentro—, éste porque `read` incluye `list`
       * (trampa 13) y un `list` abierto entrega el directorio completo de una
       * sentada.
       */
      const ref = nuevaRef();
      await setDoc(ref, documento({ estado: 'publicado' }));
      await signOut(auth());
      await denegada(getDoc(ref), 'un anónimo leyendo una publicada');
      await denegada(
        getDocs(collection(db(), 'bibliotecas')),
        'un anónimo listando el directorio',
      );
      await entrarComo(UID, { admin: true });
    });

    it('una cuenta sin el claim tampoco', async () => {
      // Tener sesión no es ser admin: sin esto, la cláusula podría estar
      // diciendo «cualquiera logueado» y los casos de arriba no lo verían.
      const ref = nuevaRef();
      await setDoc(ref, documento({ estado: 'publicado' }));
      await entrarComo(UID_PELADO);
      await denegada(getDoc(ref), 'una cuenta pelada leyendo');
      await denegada(
        updateDoc(ref, { descripcion: 'otra' }),
        'una cuenta pelada editando',
      );
      await denegada(deleteDoc(ref), 'una cuenta pelada borrando');
      await entrarComo(UID, { admin: true });
    });
  });

  /*
   * Acá había un `it` que fijaba la regex local de rechazo para que «el helper
   * no se degrade en silencio». Ese trabajo lo hace ahora
   * `tests/rechazos-del-emulador.test.ts`, que fija las **cuatro** formas de
   * mensaje medidas contra el emulador en vez de una sola, y sin necesitarlo
   * levantado (B-1130).
   */
});
