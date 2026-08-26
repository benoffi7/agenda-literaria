import { beforeAll, describe, expect, it } from 'vitest';
import { initializeApp as initAdmin, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-client';
import { db } from '@/lib/firestore-client';
import {
  actualizarActividad,
  crearActividad,
  documentoAForm,
  leerActividad,
  slugDisponible,
} from '@/lib/actividades';
import { duplicarActividadForm } from '@/lib/duplicar';
import { toPublic } from '@/lib/toPublic';
import { sesionVacia } from '@/lib/sesiones';
import type { ActividadForm } from '@/types/actividad';
import { emuladorVivo, limpiarFirestore } from './emulador';

const vivo = await emuladorVivo();

const UID = 'uid_test_admin';

const tokenAdmin = async (uid: string, esAdmin: boolean) => {
  const app = initAdmin({ projectId: 'agenda-literaria' }, `t-${uid}-${Date.now()}`);
  const a = getAdminAuth(app);
  try {
    await a.createUser({ uid });
  } catch {
    /* ya existía */
  }
  await a.setCustomUserClaims(uid, esAdmin ? { admin: true } : {});
  const token = await a.createCustomToken(uid, esAdmin ? { admin: true } : {});
  await deleteAdminApp(app);
  return token;
};

const formCompleto = (): ActividadForm => ({
  tipo: 'club-lectura',
  titulo: 'Club de lectura latinoamericana',
  slug: 'club-latinoamericana',
  descripcion: 'Ocho encuentros por narrativa del boom y después.',
  imagenes: [],
  organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: '' },
  tallerista: { nombre: 'María Moreno', bio: 'Cronista', instagram: '@mmoreno' },
  esCiclo: true,
  sesiones: [
    { ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00', tema: 'Cap. 1-4' },
    { ...sesionVacia(), inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00', tema: 'Cap. 5-8' },
  ],
  modalidad: 'hibrido',
  sede: {
    nombre: 'Casa Brandon',
    direccion: 'Drago 236',
    barrio: 'villa-crespo',
    ciudad: 'CABA',
    indicaciones: 'Timbre 2',
    geo: null,
  },
  online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
  inscripcion: {
    requiere: true,
    via: 'mail',
    destino: 'hola@casabrandon.org',
    cupo: 12,
    cierra: '2026-09-01T00:00',
  },
  arancel: { tipo: 'a-la-gorra', notas: 'incluye material' },
  material: {
    tiene: true,
    items: [
      { tipo: 'guia', titulo: 'Guía de lectura', url: 'https://drive/privado', entrega: 'al-inscribirse', publico: false },
    ],
  },
  difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
  estado: 'borrador',
  tags: ['narrativa'],
  destacado: false,
});

describe.skipIf(!vivo)('guardado de actividades contra el emulador', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
  }, 30_000);

  it('guarda las fechas como Timestamp, no como string (trampa 1)', async () => {
    const id = await crearActividad(formCompleto(), UID);
    const a = await leerActividad(id);
    const s = a!.sesiones[0]!;
    expect(typeof s.inicio.toDate).toBe('function');
    expect(s.inicio.toDate().getHours()).toBe(19);
  });

  it('conserva los ids de sesión generados en el cliente (trampa 2)', async () => {
    const form = formCompleto();
    form.slug = 'club-ids';
    const idsOriginales = form.sesiones.map((s) => s.id);

    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);
    expect(a!.sesiones.map((s) => s.id)).toEqual(idsOriginales);
    expect(idsOriginales.every((i) => i.startsWith('ses_'))).toBe(true);
  });

  it('borrar una sesión no renumera las otras (trampa 2)', async () => {
    const form = formCompleto();
    form.slug = 'club-borrado';
    form.sesiones = [
      { ...sesionVacia(), inicio: '2026-09-03T19:00', fin: '2026-09-03T21:00' },
      { ...sesionVacia(), inicio: '2026-09-10T19:00', fin: '2026-09-10T21:00' },
      { ...sesionVacia(), inicio: '2026-09-17T19:00', fin: '2026-09-17T21:00' },
    ];
    const id = await crearActividad(form, UID);

    const sobreviviente = form.sesiones[2]!.id;
    const conMenos = { ...form, sesiones: [form.sesiones[0]!, form.sesiones[2]!] };
    await actualizarActividad(id, conMenos, UID);

    const a = await leerActividad(id);
    expect(a!.sesiones).toHaveLength(2);
    // El id del tercer encuentro sigue siendo el mismo: el diff de §7.2 no va a
    // creer que cambió.
    expect(a!.sesiones[1]!.id).toBe(sobreviviente);
  });

  it('calcula el searchText normalizado (§6)', async () => {
    const form = formCompleto();
    form.slug = 'club-search';
    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);
    expect(a!.searchText).toContain('latinoamericana');
    expect(a!.searchText).toContain('villa-crespo');
    expect(a!.searchText).toContain('maria moreno');
  });

  it('preserva createdAt y createdBy al editar', async () => {
    const form = formCompleto();
    form.slug = 'club-auditoria';
    const id = await crearActividad(form, UID);
    const antes = await leerActividad(id);

    await actualizarActividad(id, { ...form, titulo: 'Título nuevo' }, 'otro_uid');
    const despues = await leerActividad(id);

    expect(despues!.createdBy).toBe(UID);
    expect(despues!.updatedBy).toBe('otro_uid');
    expect(despues!.createdAt.toMillis()).toBe(antes!.createdAt.toMillis());
  });

  it('descarta sede cuando la modalidad es virtual', async () => {
    const form = { ...formCompleto(), slug: 'club-virtual', modalidad: 'virtual' as const };
    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);
    expect(a!.sede).toBeNull();
    expect(a!.online?.plataforma).toBe('zoom');
  });

  it('detecta un slug ya tomado', async () => {
    const form = { ...formCompleto(), slug: 'club-unico' };
    const id = await crearActividad(form, UID);
    expect(await slugDisponible('club-unico')).toBe(false);
    // El propio documento no cuenta como conflicto consigo mismo.
    expect(await slugDisponible('club-unico', id)).toBe(true);
    expect(await slugDisponible('club-libre')).toBe(true);
  });

  it('el ida y vuelta form → documento → form no pierde datos', async () => {
    const form = { ...formCompleto(), slug: 'club-roundtrip' };
    const id = await crearActividad(form, UID);
    const doc = await leerActividad(id);
    const vuelta = documentoAForm(doc!);

    expect(vuelta.titulo).toBe(form.titulo);
    expect(vuelta.sesiones.map((s) => s.id)).toEqual(form.sesiones.map((s) => s.id));
    expect(vuelta.sesiones[0]!.inicio).toBe('2026-09-03T19:00');
    expect(vuelta.inscripcion.cierra).toBe('2026-09-01T00:00');
    expect(vuelta.material.items[0]!.publico).toBe(false);
  });

  it('la copia se guarda como documento nuevo sin tocar los ids ni los eventos del original (B-11)', async () => {
    const form = { ...formCompleto(), slug: 'club-b11', estado: 'publicado' as const };
    // El original ya tiene sus eventos en el calendario.
    form.sesiones = form.sesiones.map((s, i) => ({ ...s, calendarEventId: `evento_${i}` }));
    const idOriginal = await crearActividad(form, UID);

    const guardado = await leerActividad(idOriginal);
    const copia = duplicarActividadForm(documentoAForm(guardado!), { tomados: [form.slug] });
    const idCopia = await crearActividad(copia, 'otro_uid');

    expect(idCopia).not.toBe(idOriginal);
    const laCopia = await leerActividad(idCopia);
    const elOriginal = await leerActividad(idOriginal);

    // La copia: borrador, slug propio, sin eventos y con ids de sesión nuevos.
    expect(laCopia!.estado).toBe('borrador');
    expect(laCopia!.slug).toBe('club-b11-copia');
    expect(laCopia!.sesiones.every((s) => s.calendarEventId === null)).toBe(true);
    const idsOriginal = elOriginal!.sesiones.map((s) => s.id);
    expect(laCopia!.sesiones.some((s) => idsOriginal.includes(s.id))).toBe(false);
    // Fechas como Timestamp, no como string (trampa 1).
    expect(typeof laCopia!.sesiones[0]!.inicio.toDate).toBe('function');
    // `createdAt`/`createdBy` son de la copia.
    expect(laCopia!.createdBy).toBe('otro_uid');

    // Y el original, intacto: sus eventos de Calendar siguen siendo suyos.
    expect(elOriginal!.estado).toBe('publicado');
    expect(elOriginal!.createdBy).toBe(UID);
    expect(elOriginal!.sesiones.map((s) => s.calendarEventId)).toEqual(['evento_0', 'evento_1']);
  });

  it('lo que se guarda, proyectado, no filtra el link ni la difusión (§5)', async () => {
    const form = { ...formCompleto(), slug: 'club-proyeccion', estado: 'publicado' as const };
    const id = await crearActividad(form, UID);
    const a = await leerActividad(id);

    const json = JSON.stringify(toPublic(a!, id));
    expect(json).not.toContain('zoom.us/j/secreto');
    expect(json).not.toContain('drive/privado');
    expect(json).not.toContain('coordinar con prensa');
    expect(json).not.toContain(UID);
    expect(json).toContain('Guía de lectura');
  });
});

describe.skipIf(!vivo)('reglas de Firestore — §5.3', () => {
  beforeAll(async () => {
    await limpiarFirestore();
    await signInWithCustomToken(auth(), await tokenAdmin(UID, true));
    await setDoc(doc(db(), 'actividades', 'publicada'), {
      titulo: 'Publicada',
      estado: 'publicado',
    });
    await setDoc(doc(db(), 'actividades', 'borrador'), {
      titulo: 'Borrador',
      estado: 'borrador',
    });
  }, 30_000);

  it('sin el claim admin no se puede escribir', async () => {
    await signInWithCustomToken(auth(), await tokenAdmin('uid_pelado', false));
    await expect(
      setDoc(doc(db(), 'actividades', 'intento'), { titulo: 'No', estado: 'borrador' }),
    ).rejects.toThrow(/permission|insufficient/i);
  });

  it('un anónimo lee lo publicado', async () => {
    await signOut(auth());
    const snap = await getDoc(doc(db(), 'actividades', 'publicada'));
    expect(snap.exists()).toBe(true);
  });

  it('un anónimo NO lee un borrador', async () => {
    await signOut(auth());
    // Se afirma que la lectura se rechaza, sin atarse al mensaje: para una
    // lectura denegada el emulador devuelve "evaluation error" en lugar de
    // permission-denied (ver el comentario en firestore.rules). Lo que importa
    // es que no entregue el documento.
    await expect(getDoc(doc(db(), 'actividades', 'borrador'))).rejects.toThrow();
  });

  it('las opciones se leen sin estar logueado (§4.4)', async () => {
    await signOut(auth());
    await expect(getDoc(doc(db(), 'opciones', 'arancel'))).resolves.toBeDefined();
  });

  it('sin el claim admin no se pueden escribir opciones', async () => {
    await signOut(auth());
    await expect(
      setDoc(doc(db(), 'opciones', 'arancel'), { valores: [] }),
    ).rejects.toThrow(/permission|insufficient/i);
  });
});
