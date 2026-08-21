import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { buildSearchText } from '@/lib/normalize';
import { deDatetimeLocal, aDatetimeLocal } from '@/lib/sesiones';
import { slugify } from '@/lib/slugify';
import type {
  Actividad,
  ActividadConId,
  ActividadForm,
  SesionForm,
} from '@/types/actividad';

const COL = 'actividades';

/**
 * Trampa 1 — siempre `Timestamp` en Firestore, nunca strings de fecha.
 * El `timeZone` explícito lo pone la Function al armar el evento de Calendar
 * (§7.4); acá basta con guardar el instante correcto.
 */
const aTimestamp = (s: string): Timestamp => {
  const d = deDatetimeLocal(s);
  if (!d) throw new Error(`Fecha inválida: "${s}"`);
  return Timestamp.fromDate(d);
};

const limpiar = (s: string): string => s.trim();
const nuloSiVacio = (s: string): string | null => (s.trim() ? s.trim() : null);

/** Form → documento de Firestore. */
export const formADocumento = (
  f: ActividadForm,
  uid: string,
  esNuevo: boolean,
): Record<string, unknown> => {
  const necesitaSede = f.modalidad === 'presencial' || f.modalidad === 'hibrido';
  const necesitaOnline = f.modalidad === 'virtual' || f.modalidad === 'hibrido';

  const sede = necesitaSede && f.sede ? { ...f.sede } : null;
  const online = necesitaOnline && f.online ? { ...f.online } : null;

  // El tallerista solo tiene sentido si tiene nombre.
  const tallerista = f.tallerista?.nombre?.trim() ? f.tallerista : null;

  const base = {
    tipo: f.tipo,
    titulo: limpiar(f.titulo),
    slug: slugify(f.slug),
    descripcion: limpiar(f.descripcion),
    imagenUrl: nuloSiVacio(f.imagenUrl ?? ''),
    organizador: f.organizador,
    tallerista,

    esCiclo: f.esCiclo,
    sesiones: f.sesiones.map((s) => ({
      // El id viene del cliente y se conserva tal cual: es la llave del diff
      // contra Calendar (§7.2, trampa 2).
      id: s.id,
      inicio: aTimestamp(s.inicio),
      fin: aTimestamp(s.fin),
      tema: nuloSiVacio(s.tema),
      lectura: nuloSiVacio(s.lectura),
      cancelada: s.cancelada,
      calendarEventId: s.calendarEventId ?? null,
    })),

    modalidad: f.modalidad,
    sede,
    online,

    inscripcion: {
      requiere: f.inscripcion.requiere,
      via: f.inscripcion.requiere ? f.inscripcion.via : null,
      destino: f.inscripcion.requiere ? limpiar(f.inscripcion.destino) : '',
      cupo: f.inscripcion.cupo,
      cierra: f.inscripcion.cierra ? aTimestamp(f.inscripcion.cierra) : null,
    },
    arancel: { tipo: f.arancel.tipo, notas: limpiar(f.arancel.notas) },
    material: {
      tiene: f.material.tiene,
      items: f.material.tiene ? f.material.items : [],
    },
    difusion: {
      arrobar: f.difusion.arrobar.map(limpiar).filter(Boolean),
      notas: limpiar(f.difusion.notas),
    },

    estado: f.estado,
    tags: f.tags,
    destacado: f.destacado,
    // §6 — se recalcula en cada guardado, si no queda desfasado del título.
    searchText: buildSearchText({
      titulo: f.titulo,
      descripcion: f.descripcion,
      sede,
      organizador: f.organizador,
      tallerista,
    }),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };

  // En edición NO se tocan `createdAt` ni `createdBy`: son de la creación
  // original y pisarlos borraría quién cargó la actividad.
  return esNuevo ? { ...base, createdBy: uid, createdAt: serverTimestamp() } : base;
};

/** Documento de Firestore → form (para editar). */
export const documentoAForm = (a: Actividad): ActividadForm => ({
  tipo: a.tipo,
  titulo: a.titulo,
  slug: a.slug,
  descripcion: a.descripcion,
  imagenUrl: a.imagenUrl ?? '',
  organizador: a.organizador ?? { nombre: '', instagram: '', web: '' },
  tallerista: a.tallerista ?? null,
  esCiclo: a.esCiclo,
  sesiones: (a.sesiones ?? []).map(
    (s): SesionForm => ({
      id: s.id,
      inicio: aDatetimeLocal(s.inicio.toDate()),
      fin: aDatetimeLocal(s.fin.toDate()),
      tema: s.tema ?? '',
      lectura: s.lectura ?? '',
      cancelada: s.cancelada,
      calendarEventId: s.calendarEventId ?? null,
    }),
  ),
  modalidad: a.modalidad,
  sede: a.sede,
  online: a.online,
  inscripcion: {
    requiere: a.inscripcion.requiere,
    via: a.inscripcion.via,
    destino: a.inscripcion.destino,
    cupo: a.inscripcion.cupo,
    cierra: a.inscripcion.cierra ? aDatetimeLocal(a.inscripcion.cierra.toDate()) : '',
  },
  arancel: a.arancel,
  material: a.material ?? { tiene: false, items: [] },
  difusion: a.difusion ?? { arrobar: [], notas: '' },
  estado: a.estado,
  tags: a.tags ?? [],
  destacado: a.destacado ?? false,
});

/** ¿El slug ya está tomado por otra actividad? */
export const slugDisponible = async (slug: string, idActual?: string): Promise<boolean> => {
  const snap = await getDocs(collection(db(), COL));
  return !snap.docs.some((d) => d.id !== idActual && (d.data() as Actividad).slug === slug);
};

export const listarActividades = async (): Promise<ActividadConId[]> => {
  const q = query(collection(db(), COL), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Actividad) }));
};

export const leerActividad = async (id: string): Promise<ActividadConId | null> => {
  const snap = await getDoc(doc(db(), COL, id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Actividad) } : null;
};

export const crearActividad = async (f: ActividadForm, uid: string): Promise<string> => {
  const ref = await addDoc(collection(db(), COL), formADocumento(f, uid, true));
  return ref.id;
};

export const actualizarActividad = async (
  id: string,
  f: ActividadForm,
  uid: string,
): Promise<void> => {
  // `updateDoc` y no `setDoc`: preserva `createdAt`/`createdBy`, y de todas
  // formas reemplaza el array `sesiones` completo, así que una sesión borrada
  // en el form desaparece del documento (que es lo que el diff de §7.2 espera).
  await updateDoc(doc(db(), COL, id), formADocumento(f, uid, false));
};

export const borrarActividad = async (id: string): Promise<void> => {
  await deleteDoc(doc(db(), COL, id));
};
