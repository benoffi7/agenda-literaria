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
import { libroVacio } from '@/lib/formulario/estadoInicial';
import { buildSearchText } from '@/lib/normalize';
import { deDatetimeLocal, aDatetimeLocal } from '@/lib/sesiones';
import { imagenesDe } from '@/lib/imagenes';
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

  /**
   * DEC-1 — el libro solo tiene sentido si tiene título: es lo que lo identifica,
   * igual que el nombre al tallerista. Un autor cargado sin título no se escribe,
   * porque «el autor de nada» no es un dato.
   *
   * **No depende del `tipo`**, a diferencia de `sede`/`online` con la modalidad:
   * las cascadas del §11 agregan y no sacan, así que cambiar el desplegable de
   * tipo no borra lo que alguien ya escribió. Se enumeran los dos campos en lugar
   * de copiar el objeto con un spread: una clave de más que llegue de un borrador
   * recuperado no puede entrar al documento (§5.2).
   */
  const libro = f.libro?.titulo?.trim()
    ? { titulo: limpiar(f.libro.titulo), autor: limpiar(f.libro.autor) }
    : null;

  const base = {
    tipo: f.tipo,
    titulo: limpiar(f.titulo),
    slug: slugify(f.slug),
    descripcion: limpiar(f.descripcion),
    // La galería viaja como lista. `imagenUrl` **no se escribe**: es el campo
    // viejo, que solo se lee (B-167, D-125).
    imagenes: f.imagenes.map((i) => ({ ...i })),
    organizador: f.organizador,
    tallerista,
    libro,

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
      /**
       * B-97 — se escribe **siempre**, aunque el formulario no lo edite y aunque
       * `requiere` esté en false.
       *
       * Que se escriba es lo que evita la pérdida: el objeto `inscripcion` se
       * reemplaza entero en cada guardado, así que omitirlo acá haría que editar
       * la descripción apague el cartel de «Cupo completo» —y con él la línea de
       * los N eventos del calendario— sin que nadie lo haya pedido.
       *
       * Y no se pone en `false` cuando `requiere` es false, a diferencia de `via`
       * y `destino`: se sigue el criterio de `cupo`, que tampoco se borra. «Se
       * llenó» es un hecho de la sala, no del canal — una actividad sin
       * inscripción previa también se llena.
       */
      completo: f.inscripcion.completo,
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
      // DEC-1 — el libro entra a la búsqueda: encontrar la presentación
      // buscando el título de la obra es la mitad de por qué el campo existe.
      libro,
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
  // Default de lectura para siempre: un documento anterior a la galería trae
  // `imagenUrl` y se lee como una lista de un elemento marcada como portada, con
  // un id determinístico (D-125).
  imagenes: imagenesDe(a),
  organizador: a.organizador ?? { nombre: '', instagram: '', web: '' },
  tallerista: a.tallerista ?? null,
  // DEC-1 — default de lectura: un documento anterior al campo (o uno sin libro
  // cargado, que lo tiene en `null`) se lee con el bloque vacío. Es la misma
  // fábrica que usa `formVacio`, así que es **determinístico**: si devolviera
  // algo distinto en cada lectura, el formulario nacería sucio y se escribiría
  // una versión al historial por cada apertura (D-125, D-26).
  libro: a.libro ?? libroVacio(),
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
    // B-97 — default de lectura: un documento anterior al campo se lee como no
    // completo, que es exactamente el comportamiento anterior (D-26). Es
    // **determinístico** —`false` y no algo derivado de la hora o del cupo—: un
    // default que variara haría que el formulario nazca sucio y se escriba una
    // versión al historial por cada vez que alguien **mira** una actividad
    // (D-125, D-126).
    completo: a.inscripcion.completo ?? false,
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

/**
 * Lo que se le manda a `updateDoc` al guardar el formulario.
 *
 * Es puro y está separado para poder verificar sin emuladores la única cosa que
 * importa acá: que **`inscripcion.completo` no viaje**.
 *
 * `inscripcion` se escribe **por subcampos punteados** y ese queda afuera (B-97).
 * Lo prende el menú del listado, no el formulario: escribir el objeto entero haría
 * que guardar una coma de la descripción —con el formulario abierto desde antes de
 * marcarlo— **apague el cartel** del sitio y de los N eventos del ciclo sin que
 * nadie lo pida. Es la clase de B-80, un campo con dos dueños adentro de un objeto
 * de contenido, y la respuesta es la misma: un solo dueño.
 */
export const payloadDeActualizacion = (
  f: ActividadForm,
  uid: string,
): Record<string, unknown> => {
  const { inscripcion, ...resto } = formADocumento(f, uid, false) as Record<string, unknown> & {
    inscripcion: Record<string, unknown>;
  };
  const porSubcampo = Object.fromEntries(
    Object.entries(inscripcion)
      .filter(([clave]) => clave !== 'completo')
      .map(([clave, valor]) => [`inscripcion.${clave}`, valor]),
  );
  return { ...resto, ...porSubcampo };
};

export const actualizarActividad = async (
  id: string,
  f: ActividadForm,
  uid: string,
): Promise<void> => {
  // `updateDoc` y no `setDoc`: preserva `createdAt`/`createdBy`, y de todas
  // formas reemplaza el array `sesiones` completo, así que una sesión borrada
  // en el form desaparece del documento (que es lo que el diff de §7.2 espera).
  //
  // **`inscripcion` se escribe por subcampos, y `completo` queda afuera** (B-97).
  // Ese campo lo prende el menú del listado, no el formulario: escribir el objeto
  // entero haría que guardar una coma de la descripción, con el formulario abierto
  // desde antes de marcarlo, **apague el cartel** del sitio y de los N eventos del
  // ciclo sin que nadie lo pida. Es la clase de B-80 —un campo con dos dueños
  // adentro de un objeto de contenido— y la respuesta es la misma: un solo dueño.
  await updateDoc(doc(db(), COL, id), payloadDeActualizacion(f, uid));
};

/**
 * B-97 — prender o apagar «se llenó», desde el menú del listado.
 *
 * Escribe **solo esa clave**, con ruta punteada, y no el objeto `inscripcion`
 * entero: así un toque desde el teléfono no puede pisar el destino ni el cierre
 * que tenga el documento en este momento, y no hace falta traer el formulario
 * para tocar una casilla.
 *
 * Firma la edición como cualquier otra (`updatedBy`/`updatedAt`): pasa por el
 * trigger del historial (§12) y el sync le actualiza la descripción a los N
 * eventos del ciclo (§7.1, D-07), que es de dónde se enteran los suscriptos.
 */
export const marcarCupoCompleto = async (
  id: string,
  completo: boolean,
  uid: string,
): Promise<void> => {
  await updateDoc(doc(db(), COL, id), {
    'inscripcion.completo': completo,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
};

export const borrarActividad = async (id: string): Promise<void> => {
  await deleteDoc(doc(db(), COL, id));
};
