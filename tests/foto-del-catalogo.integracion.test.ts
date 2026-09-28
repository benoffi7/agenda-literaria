/**
 * **La foto mensual del tablero contra el emulador** — B-378, roadmap 3.5.
 *
 * Lo que solo se verifica de verdad acá: que el documento que arma
 * `sacarFotoDelMesSiFalta` pasa la regla, que la segunda foto del mes **no pisa**
 * a la primera, y que nadie más que el admin la lee o la escribe. El control
 * positivo va primero: sin él, todas las negaciones podrían estar pasando porque
 * la regla niega todo.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import { idDeFoto, sacarFotoDelMesSiFalta } from '@/lib/fotoDelCatalogo';
import type { ActividadConId } from '@/types/actividad';
import { cargarReglas, emuladorAuthVivo, emuladorVivo, limpiarFirestore } from './emulador';
import { entrarComo, uidDe } from './fixtures/credenciales-del-emulador';
import { denegada } from './fixtures/rechazos-del-emulador';

const vivo = (await emuladorVivo()) && (await emuladorAuthVivo());
const REGLAS = fileURLToPath(new URL('../firestore.rules', import.meta.url));

const UID = uidDe('uid_foto_admin');
const UID_PELADO = uidDe('uid_foto_sin_claim');
const UID_PUBLICADOR = uidDe('uid_foto_publicador');

const AHORA = new Date('2026-10-01T15:00:00Z');

/** Lo mínimo que `estadoDelCatalogo` necesita para contar una publicada. */
const actividad = (id: string, over: Partial<ActividadConId> = {}): ActividadConId =>
  ({
    id,
    titulo: `CENTINELA ${id}`,
    tipo: 'taller',
    estado: 'publicado',
    esCiclo: false,
    modalidad: 'virtual',
    modalidades: [{ id: 'mod_1', modalidad: 'virtual', inicio: null, fin: null, sede: null, online: null }],
    sesiones: [],
    tags: [],
    imagenes: [],
    descripcion: 'corta',
    arancel: { tipo: 'a-la-gorra', notas: '' },
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null, completo: false },
    ...over,
  }) as unknown as ActividadConId;

const foto = (mes: string, over: Record<string, unknown> = {}) => ({
  mes,
  version: 1,
  tomadaEn: serverTimestamp(),
  catalogo: { total: 0 },
  ...over,
});

describe.skipIf(!vivo)('las reglas de /fotosDelCatalogo contra el emulador', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await cargarReglas(REGLAS);
    await entrarComo(UID, { admin: true });
  }, 30_000);

  it('el admin saca la foto del mes, y guarda conteos sin ninguna actividad nombrada', async () => {
    const r = await sacarFotoDelMesSiFalta([actividad('a'), actividad('b', { estado: 'borrador' })], AHORA);
    expect(r).toBe('sacada');
    const snap = await getDoc(doc(db(), 'fotosDelCatalogo', idDeFoto(AHORA)));
    const datos = snap.data()!;
    expect(datos.mes).toBe('2026-10');
    expect(datos.catalogo.total).toBe(2);
    expect(datos.catalogo.publicadas.total).toBe(1);
    // Los avisos llegan como cantidad: el título de la actividad no viaja.
    expect(JSON.stringify(datos)).not.toContain('CENTINELA');
    expect(datos.catalogo.avisos.length).toBeGreaterThan(0);
  });

  it('la segunda vez en el mes no la pisa: la primera foto queda', async () => {
    const r = await sacarFotoDelMesSiFalta([actividad('a'), actividad('b'), actividad('c')], AHORA);
    expect(r).toBe('ya-estaba');
    const snap = await getDoc(doc(db(), 'fotosDelCatalogo', idDeFoto(AHORA)));
    expect(snap.data()!.catalogo.total).toBe(2);
  });

  it('ni el admin la reescribe ni la borra: una serie corregible para atrás no es una serie', async () => {
    // MUTACIÓN PROBADA: con `allow update, delete: if esAdmin()` este caso pasa a rojo.
    const ref = doc(db(), 'fotosDelCatalogo', idDeFoto(AHORA));
    await denegada(setDoc(ref, foto('2026-10', { catalogo: { total: 999 } })), 'reescribir la foto');
    await denegada(deleteDoc(ref), 'borrar la foto');
  });

  it('la regla exige la forma: mes válido que coincide con el id, sin campos de más', async () => {
    await denegada(setDoc(doc(db(), 'fotosDelCatalogo', '2026-13'), foto('2026-13')), 'mes 13');
    await denegada(setDoc(doc(db(), 'fotosDelCatalogo', '2026-11'), foto('2026-12')), 'mes distinto del id');
    await denegada(
      setDoc(doc(db(), 'fotosDelCatalogo', '2026-11'), foto('2026-11', { tomadaPor: UID })),
      'campo de más',
    );
    await denegada(
      setDoc(doc(db(), 'fotosDelCatalogo', '2026-11'), foto('2026-11', { tomadaEn: new Date('2020-01-01') })),
      'fecha inventada',
    );
  });

  it('un anónimo, una cuenta sin claim y el publicador no la leen ni la sacan', async () => {
    const ref = doc(db(), 'fotosDelCatalogo', idDeFoto(AHORA));
    const otra = doc(db(), 'fotosDelCatalogo', '2026-12');
    try {
      await signOut(auth());
      await denegada(getDoc(ref), 'get anónimo');
      await denegada(getDocs(collection(db(), 'fotosDelCatalogo')), 'list anónimo');
      await entrarComo(UID_PELADO);
      await denegada(getDoc(ref), 'get sin claim');
      await denegada(setDoc(otra, foto('2026-12')), 'create sin claim');
      // El publicador ve una parte del catálogo: su foto sería la de esa parte.
      await entrarComo(UID_PUBLICADOR, { publicador: true, ciudad: 'caba' });
      await denegada(getDoc(ref), 'get del publicador');
      await denegada(setDoc(otra, foto('2026-12')), 'create del publicador');
    } finally {
      await entrarComo(UID, { admin: true });
    }
  });
});
