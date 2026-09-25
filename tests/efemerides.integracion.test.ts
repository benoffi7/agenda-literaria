/**
 * **Las reglas de `/efemerides` contra el emulador** — B-959.
 *
 * Lo que solo se puede verificar de verdad acá (`05-patrones.md` § Tests): que
 * el documento que arma el panel (`formAEfemeride` + las cuatro firmas) pasa, y
 * que las puertas que la regla dice cerrar lo están — para un anónimo, para una
 * cuenta sin claim y para el `publicador` (D-1171).
 *
 * El control positivo va primero: sin él, todas las negaciones podrían estar
 * pasando porque la regla niega **todo**.
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
import { efemerideVacia, formAEfemeride } from '@/lib/efemeride-schema';
import type { EfemerideForm, EstadoEfemeride } from '@/types/efemeride';
import {
  PROJECT_ID,
  cargarReglas,
  emuladorAuthVivo,
  emuladorVivo,
  limpiarFirestore,
} from './emulador';
import { entrarComo, uidDe } from './fixtures/credenciales-del-emulador';
import { denegada } from './fixtures/rechazos-del-emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID = uidDe('uid_efemerides_admin');
const UID_PELADO = uidDe('uid_efemerides_sin_claim');
const UID_PUBLICADOR = uidDe('uid_efemerides_publicador');

/** El Admin SDK, para escribir lo que solo escribe el trigger. */
const conAdminSdk = async (fn: (db: FirestoreAdmin) => Promise<void>) => {
  const app = initAdmin({ projectId: PROJECT_ID }, `e-sdk-${Date.now()}-${Math.random()}`);
  await fn(getAdminFirestore(app));
  await deleteAdminApp(app);
};

const form = (over: Partial<EfemerideForm> = {}): EfemerideForm => ({
  ...efemerideVacia(),
  titulo: 'Nace Julio Cortázar',
  descripcion: 'Nace en Ixelles, Bélgica, el autor de Rayuela.',
  dia: '26',
  mes: '8',
  anio: '1914',
  fuente: { texto: 'Biblioteca Nacional', url: 'https://bn.gov.ar' },
  ...over,
});

/** El documento que escribe `crearEfemeride`, con sus cuatro firmas. */
const documento = (
  over: Record<string, unknown> = {},
  f: EfemerideForm = form(),
  estado: EstadoEfemeride = 'borrador',
  uid = UID,
) => ({
  ...formAEfemeride(f, estado),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  createdBy: uid,
  updatedBy: uid,
  ...over,
});

/** La edición que escribe `guardarEfemeride`: sin `createdAt`/`createdBy`. */
const edicion = (f: EfemerideForm, estado: EstadoEfemeride = 'borrador') => ({
  ...formAEfemeride(f, estado),
  updatedAt: serverTimestamp(),
  updatedBy: UID,
});

let n = 0;
const nuevaRef = () => doc(db(), 'efemerides', `efe_${Date.now()}_${n++}`);

describe.skipIf(!vivo)('efemérides contra el emulador — B-959', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    await entrarComo(UID, { admin: true });
  }, 30_000);

  describe('el camino que funciona: un admin carga una efeméride', () => {
    it('crea un borrador válido y lo puede leer', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      const snap = await getDoc(ref);
      expect(snap.exists()).toBe(true);
      expect(snap.data()!.dia).toBe(26);
      expect(snap.data()!.mes).toBe(8);
      expect(snap.data()!.anio).toBe(1914);
    });

    it('puede nacer publicada, sin año y sin fuente', async () => {
      const ref = nuevaRef();
      await setDoc(
        ref,
        documento({}, form({ anio: '', fuente: { texto: '', url: '' } }), 'publicado'),
      );
      const d = (await getDoc(ref)).data()!;
      expect(d.estado).toBe('publicado');
      expect(d.anio).toBeNull();
      expect(d.fuente).toBeNull();
    });

    it('el 29 de febrero es un día válido', async () => {
      await setDoc(nuevaRef(), documento({}, form({ dia: '29', mes: '2' })));
    });

    it('lista la colección entera', async () => {
      const snap = await getDocs(collection(db(), 'efemerides'));
      expect(snap.empty).toBe(false);
    });

    it('edita un borrador, cambiándole el slug, y lo publica', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await updateDoc(ref, edicion(form({ slug: 'cortazar-nace' }), 'publicado'));
      const d = (await getDoc(ref)).data()!;
      expect(d.slug).toBe('cortazar-nace');
      expect(d.estado).toBe('publicado');
    });

    it('borra una efeméride', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await deleteDoc(ref);
      expect((await getDoc(ref)).exists()).toBe(false);
    });
  });

  describe('la forma del documento', () => {
    it('el 31 de abril no existe', async () => {
      await denegada(setDoc(nuevaRef(), documento({ dia: 31, mes: 4 })), 'un 31 de abril');
    });

    it('un mes 13 no existe', async () => {
      await denegada(setDoc(nuevaRef(), documento({ mes: 13 })), 'un mes 13');
    });

    it('el día no puede venir como texto', async () => {
      await denegada(setDoc(nuevaRef(), documento({ dia: '26' })), 'un día en texto');
    });

    it('no es un Timestamp: un campo de fecha de más se rechaza', async () => {
      // Trampa 1: la forma es día y mes. Un `fecha` suelto es exactamente el
      // campo que la regla existe para no dejar entrar.
      await denegada(
        setDoc(nuevaRef(), documento({ fecha: Timestamp.fromDate(new Date('1914-08-26')) })),
        'un Timestamp de más',
      );
    });

    it('un link de fuente que no es http(s) se rechaza', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ fuente: { texto: 'x', url: 'javascript:alert(1)' } })),
        'un `javascript:` en la fuente',
      );
    });

    it('un estado que no existe se rechaza', async () => {
      await denegada(setDoc(nuevaRef(), documento({ estado: 'pendiente' })), 'estado pendiente');
    });
  });

  describe('las firmas: quién y cuándo', () => {
    it('no se puede crear a nombre de otro uid', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ createdBy: 'otro', updatedBy: 'otro' })),
        'createdBy ajeno',
      );
    });

    it('no se puede antedatar', async () => {
      await denegada(
        setDoc(
          nuevaRef(),
          documento({ createdAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) }),
        ),
        'createdAt del cliente',
      );
    });

    it('una edición sin firmar `updatedAt` con la hora del servidor se rechaza', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await denegada(
        /*
         * Una fecha claramente vieja y no `Timestamp.now()`: contra el emulador
         * local, el reloj del cliente y `request.time` pueden coincidir en el
         * mismo milisegundo, y el caso daba verde o rojo según la corrida.
         */
        updateDoc(ref, {
          descripcion: 'otra',
          updatedAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
          updatedBy: UID,
        }),
        'updatedAt del cliente',
      );
    });

    it('no se puede reescribir quién la creó', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await denegada(
        updateDoc(ref, { ...edicion(form()), createdBy: 'otro' }),
        'createdBy reescrito',
      );
    });
  });

  describe('el slug inmutable — trampa 10', () => {
    it('una publicada no cambia de slug', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form(), 'publicado'));
      await denegada(
        updateDoc(ref, edicion(form({ slug: 'otro-slug' }), 'publicado')),
        'renombrar una publicada',
      );
    });

    it('despublicada, sigue congelada si ya tuvo la marca', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form(), 'publicado'));
      // La marca la escribe el trigger con el Admin SDK: acá se simula.
      await conAdminSdk((a) => a.doc(ref.path).update({ publicadaAlgunaVez: true }).then(() => {}));
      await updateDoc(ref, edicion(form(), 'borrador'));
      await denegada(
        updateDoc(ref, edicion(form({ slug: 'otro-slug' }), 'borrador')),
        'renombrar una despublicada que ya tuvo URL',
      );
    });

    it('la marca no puede nacer puesta, ni bajarse desde el cliente', async () => {
      await denegada(
        setDoc(nuevaRef(), documento({ publicadaAlgunaVez: true })),
        'nacer con la marca',
      );
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form(), 'publicado'));
      await conAdminSdk((a) => a.doc(ref.path).update({ publicadaAlgunaVez: true }).then(() => {}));
      await denegada(
        updateDoc(ref, { ...edicion(form(), 'publicado'), publicadaAlgunaVez: false }),
        'bajar la marca',
      );
    });

    it('con la marca puesta, editar el resto sigue funcionando', async () => {
      // El `hasOnly` tiene que aceptar la marca: sin eso, toda edición posterior
      // a la primera publicación se rompería.
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form(), 'publicado'));
      await conAdminSdk((a) => a.doc(ref.path).update({ publicadaAlgunaVez: true }).then(() => {}));
      await updateDoc(ref, edicion(form({ descripcion: 'Corregida.' }), 'publicado'));
      expect((await getDoc(ref)).data()!.descripcion).toBe('Corregida.');
    });
  });

  describe('quién no entra', () => {
    it('un anónimo no lee ni una publicada, ni lista, ni escribe', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form(), 'publicado'));
      await signOut(auth());
      try {
        await denegada(getDoc(ref), 'get anónimo de una publicada');
        await denegada(getDocs(collection(db(), 'efemerides')), 'list anónimo');
        await denegada(setDoc(nuevaRef(), documento()), 'create anónimo');
      } finally {
        await entrarComo(UID, { admin: true });
      }
    });

    it('una cuenta sin claim tampoco', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento());
      await entrarComo(UID_PELADO);
      try {
        await denegada(getDoc(ref), 'get sin claim');
        await denegada(setDoc(nuevaRef(), documento({}, form(), 'borrador', UID_PELADO)), 'create sin claim');
      } finally {
        await entrarComo(UID, { admin: true });
      }
    });

    it('el publicador no ve ni carga efemérides — D-1171', async () => {
      const ref = nuevaRef();
      await setDoc(ref, documento({}, form(), 'publicado'));
      await entrarComo(UID_PUBLICADOR, { publicador: true, ciudad: 'caba' });
      try {
        await denegada(getDoc(ref), 'get del publicador');
        await denegada(getDocs(collection(db(), 'efemerides')), 'list del publicador');
        await denegada(
          setDoc(nuevaRef(), documento({}, form(), 'borrador', UID_PUBLICADOR)),
          'create del publicador',
        );
        await denegada(deleteDoc(ref), 'delete del publicador');
      } finally {
        await entrarComo(UID, { admin: true });
      }
    });
  });
});
