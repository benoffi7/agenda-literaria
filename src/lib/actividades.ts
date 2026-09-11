import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firestore-client';
import { PERMISOS, type RolDelPanel } from '@/lib/rolDelPanel';
import {
  SlugTomado,
  liberarSlug,
  refDeSlug,
  reservaDeSlug,
  slugLibre,
} from '@/lib/slugs';
import { libroVacio } from '@/lib/formulario/estadoInicial';
import { buildSearchText } from '@/lib/normalize';
import { deDatetimeLocal, aDatetimeLocal } from '@/lib/sesiones';
import { imagenesDe } from '@/lib/imagenes';
import { idItemMaterialMigrado } from '@/lib/material';
import {
  filaPideOnline,
  filaPideSede,
  modalidadAForm,
  modalidadResultante,
  onlinePrincipal,
  sedePrincipal,
} from '@/lib/modalidades';
import { slugify } from '@/lib/slugify';
// B-150 — la MISMA lista que usa el trigger del historial para decidir qué
// escribe la máquina (§12, D-41). Se importa por `@historial` y no se copia: dos
// ideas de "qué campo es de la máquina" se separan sin que nada falle, que es
// exactamente el acuerdo que el alias existe para no tener que mantener.
import { CAMPOS_DE_MAQUINA_SESION } from '@historial';
import type {
  Actividad,
  ActividadConId,
  ActividadForm,
  ModalidadFila,
  Sesion,
  SesionForm,
} from '@/types/actividad';

const COL = 'actividades';

/**
 * ¿El batch falló **porque el nombre estaba tomado**? — B-888 tajada 2, D-660.
 *
 * Es solo un diagnóstico: sirve para cambiar «Missing or insufficient
 * permissions» por un mensaje con arreglo de una línea. Por eso **no puede
 * tirar**: si la consulta misma falla —el índice sin sembrar, la red— lo que hay
 * que propagar es el error original del guardado, no el de haber preguntado.
 * Sin este `catch`, el diagnóstico tapaba la causa real con la suya.
 */
const tomadoPorOtra = async (slug: string, idActual?: string): Promise<boolean> => {
  try {
    return !(await slugLibre(slug, idActual));
  } catch {
    return false;
  }
};

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
  /**
   * B-224 — las formas de cursar, cada una con su lugar. Se enumeran las claves
   * en lugar de copiar la fila con un spread: una clave de más que llegue de un
   * borrador recuperado no puede entrar al documento, y desde acá `sede` y
   * `online` viajan **adentro de un array**, donde la poda de `autoguardado.ts`
   * no llega (deja pasar los arrays a propósito). Hasta B-224 esa poda era la que
   * cuidaba a `sede` y `online`; ahora los cuida esta enumeración, que además es
   * más fuerte: la clave de más no llega ni siquiera a Firestore.
   *
   * Los bloques de lugar se guardan solo si la fila los pide (§11): una sede que
   * quedó cargada y después la fila pasó a virtual no viaja. Es lo que hacía la
   * cascada de modalidad a nivel actividad, ahora por fila.
   */
  const modalidades: ModalidadFila[] = f.modalidades.map((m) => ({
    id: m.id,
    modalidad: m.modalidad,
    // Trampa 1 — `Timestamp`, nunca strings de fecha. Vacío es `null`, que es
    // «sin fecha»: las dos son opcionales.
    inicio: m.inicio ? aTimestamp(m.inicio) : null,
    fin: m.fin ? aTimestamp(m.fin) : null,
    sede:
      filaPideSede(m.modalidad) && m.sede
        ? {
            nombre: limpiar(m.sede.nombre),
            direccion: limpiar(m.sede.direccion),
            barrio: m.sede.barrio,
            ciudad: limpiar(m.sede.ciudad),
            indicaciones: limpiar(m.sede.indicaciones),
            geo: m.sede.geo ? { lat: m.sede.geo.lat, lng: m.sede.geo.lng } : null,
          }
        : null,
    online:
      filaPideOnline(m.modalidad) && m.online
        ? {
            plataforma: m.online.plataforma,
            url: limpiar(m.online.url),
            urlPublica: m.online.urlPublica,
          }
        : null,
  }));

  /**
   * Los tres derivados de la lista (B-224). Se escriben en cada guardado, igual
   * que `searchText`: son lo que leen el filtro del panel, el `location` del
   * evento, la búsqueda del §6 y la analítica, que solo admiten un valor.
   */
  const sede = sedePrincipal(modalidades);
  const online = onlinePrincipal(modalidades);
  const modalidad = modalidadResultante(modalidades);

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
    /**
     * La galería viaja como lista. `imagenUrl` **no se escribe**: es el campo
     * viejo, que solo se lee (B-167, D-125).
     *
     * **Se enumeran las claves en lugar de spreadear la fila** — B-206 #2, y es
     * el mismo cuidado que `calendarEventId: s.calendarEventId ?? null` dos
     * bloques más abajo. `storagePath`, `ancho` y `alto` son campos de máquina
     * **adentro de un array de contenido**: hoy los escribe la subida del panel
     * y mañana los va a reescribir la Function de DEC-7d, y en cuanto haya dos
     * escritores un spread los pisa con lo que tuviera el formulario en un
     * snapshot viejo. Es exactamente B-80 por una puerta nueva.
     *
     * Enumerar tiene además el efecto del §5.2: una clave de más que llegue de
     * un borrador de `localStorage` recuperado no puede entrar al documento.
     *
     * Los tres se copian **solo si están** —el spread condicional de abajo— y no
     * con `?? null`: Firestore guardaría el `null` como valor presente, y
     * entonces una imagen externa, que nunca tuvo `storagePath`, quedaría
     * distinta de la misma imagen leída de un documento anterior, que no tiene la
     * clave. `huboCambioDeContenido` **no unifica ausente con `null` a propósito**
     * (ver `functions/historial.js`), así que eso sería una versión de historial
     * y un rebuild del sitio por cada guardado.
     */
    imagenes: f.imagenes.map((i) => ({
      id: i.id,
      url: limpiar(i.url),
      epigrafe: limpiar(i.epigrafe),
      /*
       * B-301 — se escribe **siempre y como cadena**, igual que `epigrafe` y no
       * como el spread condicional de `storagePath`/`ancho`/`alto`: es contenido
       * que tipea una persona, no un campo de máquina, así que no tiene el
       * problema de los dos escritores. El `?? ''` cubre las filas de un
       * documento anterior a este campo, que llegan sin la clave.
       *
       * Consecuencia dicha: la primera vez que se guarde una actividad vieja, sus
       * imágenes ganan `textoAlternativo: ''`. Eso es un cambio de contenido —una
       * versión al historial y un rebuild— pero solo ocurre dentro de un guardado
       * que ya iba a producir los dos.
       */
      textoAlternativo: limpiar(i.textoAlternativo ?? ''),
      origen: i.origen,
      portada: i.portada,
      ...(i.storagePath === undefined ? {} : { storagePath: i.storagePath }),
      ...(i.ancho === undefined ? {} : { ancho: i.ancho }),
      ...(i.alto === undefined ? {} : { alto: i.alto }),
    })),
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
      // B-181 — de qué comisión es. Se escribe **siempre**, aunque no haya
      // comisiones: `null` es un valor del modelo («este ciclo no las usa»), no
      // la ausencia del campo, y omitirlo dejaría documentos de dos formas
      // distintas según cuándo se guardaron.
      comisionId: s.comisionId ?? null,
    })),

    /*
     * B-181 — las comisiones, enumeradas campo por campo como todo lo demás que
     * entra en un array del documento (§5.2): un spread de la fila publicaría
     * mañana el campo que alguien agregue al estado del formulario sin que nadie
     * lo decida. Es la clase que `imagenes` ya tuvo (`storagePath`, B-206 #2).
     */
    comisiones: f.comisiones.map((c) => ({ id: c.id, etiqueta: limpiar(c.etiqueta) })),

    modalidades,
    modalidad,
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
    arancel: {
      tipo: f.arancel.tipo,
      notas: limpiar(f.arancel.notas),
      // B-114 — `null` explícito y no la ausencia de la clave: así el documento
      // dice «no hay monto» en vez de «no sé», y `documentoAForm` no tiene que
      // adivinar la diferencia.
      monto: f.arancel.monto ?? null,
    },
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
    incluye: f.incluye,
    destacado: f.destacado,
    // §6 — se recalcula en cada guardado, si no queda desfasado del título.
    searchText: buildSearchText({
      titulo: f.titulo,
      descripcion: f.descripcion,
      // B-224 — **todas** las sedes, no solo la derivada: con dos filas en dos
      // barrios, indexar una sola dejaría el segundo sin poder buscarse. Y es la
      // misma fuente que usa `payloadDeRestauracion`, si no el mismo documento
      // tendría un `searchText` distinto según por dónde se escribió.
      modalidades,
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
      // B-181 — `?? null` para los documentos anteriores al campo (D-26): se
      // leen como «este ciclo no tiene comisiones», que es lo que son.
      comisionId: s.comisionId ?? null,
    }),
  ),
  /** B-181 — `?? []` por lo mismo: sin el campo, no hay comisiones. */
  comisiones: (a.comisiones ?? []).map((c) => ({ id: c.id, etiqueta: c.etiqueta })),
  /**
   * B-224 — las formas de cursar. `?? []` y **ninguna lectura de compatibilidad**
   * que sintetice una fila a partir del `modalidad`/`sede`/`online` viejo: no hay
   * documentos sin el campo (decisión del dueño), y una rama de más en el camino
   * de lectura es una rama más que barrer en las tres proyecciones públicas.
   *
   * `modalidad`, `sede` y `online` no vuelven al formulario: son derivados.
   */
  modalidades: (a.modalidades ?? []).map((m) => modalidadAForm(m, aDatetimeLocal)),
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
  /*
   * B-114 — el arancel se **reconstruye campo por campo** y no se pasa entero.
   * `monto` no existe en los documentos anteriores, así que un passthrough
   * dejaría `undefined` donde el formulario espera `number | null` y el input
   * quedaría en un estado que React no controla (D-26).
   */
  arancel: {
    tipo: a.arancel.tipo,
    notas: a.arancel.notas,
    monto: a.arancel.monto ?? null,
  },
  /**
   * B-342 — un documento anterior al id de cliente puede traer ítems sin
   * `id`. Se completa al leer, determinístico (`idItemMaterialMigrado`, mismo
   * criterio que `imagenesDe`/D-125): un id que cambiara en cada lectura
   * marcaría el formulario como "con cambios sin guardar" cada vez que se
   * abre una actividad vieja sin tocar nada.
   */
  material: a.material
    ? {
        tiene: a.material.tiene,
        items: a.material.items.map((i, n) => (i.id ? i : { ...i, id: idItemMaterialMigrado(n) })),
      }
    : { tiene: false, items: [] },
  difusion: a.difusion ?? { arrobar: [], notas: '' },
  estado: a.estado,
  tags: a.tags ?? [],
  // D-26 — `[]` para el documento anterior al campo: «no se declaró nada», que
  // es exactamente el comportamiento que tenía antes de que `incluye` existiera.
  incluye: a.incluye ?? [],
  destacado: a.destacado ?? false,
});

/**
 * ¿El slug ya está tomado por otra actividad? — B-888 tajada 2, **D-660**.
 *
 * **Ya no barre la colección.** Lo hacía, y con la regla de B-888 ese barrido se
 * le rechaza **entero** a un publicador: `read` incluye `list`, y una condición
 * sobre `resource.data` obliga a que toda query traiga el `where`
 * correspondiente (trampa 7). No se arregla con un `where`, porque el slug único
 * es un invariante de **todo** el catálogo y no se verifica mirando solo lo
 * propio. La respuesta la da el índice `/slugs/{slug}`: un `getDoc` por id.
 *
 * **Un solo camino para los dos roles**, a propósito: dos derivaciones de la
 * misma pregunta —el barrido para el admin, el índice para el publicador— es
 * exactamente la clase de B-88, y la que se quedaría vieja sería justo la que
 * nadie usa todos los días.
 *
 * Sigue siendo la guarda **previa** del formulario, la que da el mensaje
 * accionable. La guarda **real** contra el choque simultáneo está un escalón más
 * abajo, en el `writeBatch` de `crearActividad`/`actualizarActividad`: la reserva
 * viaja junto con la actividad y el servidor rechaza la segunda.
 */
export const slugDisponible = (slug: string, idActual?: string): Promise<boolean> =>
  slugLibre(slug, idActual);

/**
 * El listado del panel.
 *
 * **El `where` no es un filtro de presentación: es lo que hace que la query
 * exista** (B-888, trampa 7). Con la regla nueva, un publicador que pida la
 * colección entera recibe un `permission-denied` sobre la query **completa** —
 * Firestore no recorta, rechaza—, así que el listado se rompería en vez de
 * acotarse. El índice compuesto `createdBy ASC, updatedAt DESC` está en
 * `firestore.indexes.json` desde la tajada 1, justamente para esto.
 *
 * Va por `PERMISOS[rol].veTodoElCatalogo` y no por `rol === 'admin'`: es la misma
 * pregunta que decide el calendario, y un `===` suelto repetido en dos pantallas
 * es cómo se arregla una y no la otra (B-175).
 */
export const listarActividades = async (
  rol: RolDelPanel,
  uid: string,
): Promise<ActividadConId[]> => {
  /*
   * El listado acotado **sin uid sería la colección de nadie**: una query
   * `where('createdBy','==','')` que devuelve vacío y se lee como «todavía no
   * cargaste nada». Se corta acá y ruidosamente, porque el síntoma silencioso es
   * el peor de los dos.
   */
  if (!PERMISOS[rol].veTodoElCatalogo && !uid) {
    throw new Error('El listado acotado necesita el uid de la sesión.');
  }
  const q = PERMISOS[rol].veTodoElCatalogo
    ? query(collection(db(), COL), orderBy('updatedAt', 'desc'))
    : query(collection(db(), COL), where('createdBy', '==', uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Actividad) }));
};

export const leerActividad = async (id: string): Promise<ActividadConId | null> => {
  const snap = await getDoc(doc(db(), COL, id));
  return snap.exists() ? { id: snap.id, ...(snap.data() as Actividad) } : null;
};

/**
 * Alta — la actividad y su reserva de slug, **en el mismo batch** (D-660).
 *
 * Era un `addDoc`. Ahora el id se acuña en el cliente (`doc(collection(…))` sin
 * path devuelve una ref con id, sin tocar la red) para poder escribir la reserva
 * y la actividad en una sola operación atómica: entran las dos o ninguna.
 *
 * **Eso es lo que hace del índice un índice y no un registro de intenciones.**
 * Con dos escrituras sueltas habría un orden que decidir y una forma de fallar
 * en cada dirección —reserva huérfana si muere la segunda, colisión silenciosa
 * si muere la primera— que es cómo un índice escrito «al lado» se desincroniza
 * (clase de B-88, y la misma forma que D-600 tuvo que resolver a mano). Con el
 * batch no hay estado intermedio que reparar.
 *
 * Y como `/slugs` tiene `allow update: if false`, un slug ya reservado hace que
 * el batch entero se rechace: dos guardados simultáneos con el mismo slug ya no
 * pasan los dos, que es lo que sí pasaba con el barrido.
 */
export const crearActividad = async (f: ActividadForm, uid: string): Promise<string> => {
  const ref = doc(collection(db(), COL));
  const documento = formADocumento(f, uid, true);
  const slug = documento.slug as string;

  const batch = writeBatch(db());
  batch.set(refDeSlug(slug), reservaDeSlug(ref.id, uid));
  batch.set(ref, documento);

  try {
    await batch.commit();
  } catch (error) {
    /*
     * El batch falla entero, así que no hay nada que limpiar. Lo único que se
     * hace acá es **nombrar** el motivo más probable: la reserva es la única
     * escritura del batch que un permiso puede rechazar por un dato de otra
     * persona, y sin esto el formulario mostraría «Missing or insufficient
     * permissions» para un caso que tiene un arreglo de una línea (cambiar la
     * dirección web).
     */
    if (await tomadoPorOtra(slug)) throw new SlugTomado(slug);
    throw error;
  }
  return ref.id;
};

/**
 * B-150 — Las sesiones que se van a escribir, con los campos de máquina que
 * tiene el documento **de hoy**, emparejados por id de sesión.
 *
 * ── Qué arregla ───────────────────────────────────────────────────────────
 * `formADocumento` emite `calendarEventId` en cada guardado, así que el
 * formulario es co-dueño de un campo que escribe una Cloud Function. Si el
 * listado se refrescó *antes* del write-back del sync, el form arranca con
 * `null` y el guardado lo escribe: el documento se queda con una sesión sin id.
 * D-91 hizo que la Function lo repusiera (`reponerIds` en **toda** operación),
 * así que la ventana ya no dejaba daño permanente — pero seguía existiendo, y
 * quien la abría era el panel. Esto la cierra del lado que la abre: hay **un
 * solo dueño** por campo, y es la Function.
 *
 * ── Por qué fusionar y no dejar de emitir el campo ────────────────────────
 * La otra salida de B-80 —que `formADocumento` no emita `calendarEventId`— es
 * un bug peor, no un atajo: `actualizarActividad` usa `updateDoc`, que
 * **reemplaza el array `sesiones` entero**, así que una clave ausente adentro de
 * cada elemento borra el id de **todas** las sesiones. La pasada siguiente del
 * sync no ve ningún id y emite `crear` por encuentro: N eventos duplicados en el
 * calendario público y los originales huérfanos. Es el mismo argumento que el
 * comentario de `completo` (B-97) tres bloques más abajo — un objeto de
 * contenido que se reemplaza entero no tolera omitir una clave que otro escribe.
 *
 * ── La lista es negra, y esa dirección es la segura (D-41) ────────────────
 * Se enumera lo que escribe la máquina, no lo que edita una persona, y la lista
 * viene de `@historial` en lugar de estar acá. Con una lista blanca de campos
 * editables, olvidarse de sumar un campo nuevo del formulario haría que su
 * edición se descarte en silencio (pérdida de datos); con la lista negra,
 * olvidarse de un campo de máquina nuevo devuelve el bug de B-80 — que tiene
 * test de clase y se ve. Ante la duda, gana el formulario.
 *
 * Una sesión que el documento no tiene —una fila recién agregada— no tiene nada
 * de máquina que preservar: se le repone el `null` explícito para no cambiar la
 * forma del documento (`Sesion.calendarEventId` no es opcional, y `ausente` vs
 * `null` no los unifica `huboCambioDeContenido`, así que la clave que falta
 * costaría una versión de historial y un rebuild por guardado).
 *
 * Lo comparte la restauración del historial (`valorARestaurar`,
 * `src/lib/historial.ts`), que tenía el mismo emparejamiento escrito aparte.
 */
export const fusionarSesiones = <T extends { id: string }>(
  origen: readonly T[],
  enDisco: readonly Pick<Sesion, 'id' | 'calendarEventId'>[] | undefined,
): Record<string, unknown>[] => {
  const porId = new Map(
    (enDisco ?? []).map((s) => [s.id, s as unknown as Record<string, unknown>]),
  );

  return origen.map((sesion) => {
    const enElDocumento = porId.get(sesion.id);
    const deMaquina = Object.fromEntries(
      CAMPOS_DE_MAQUINA_SESION.map((campo) => [
        campo,
        enElDocumento ? (enElDocumento[campo] ?? null) : null,
      ]),
    );
    return { ...(sesion as unknown as Record<string, unknown>), ...deMaquina };
  });
};

/**
 * Lo que se le manda a `updateDoc` al guardar el formulario.
 *
 * Es puro y está separado para poder verificar sin emuladores las dos cosas que
 * importan acá: que **`inscripcion.completo` no viaje**, y que los campos de
 * máquina de cada sesión salgan del documento y no del formulario (B-150).
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
  sesionesEnDisco: readonly Pick<Sesion, 'id' | 'calendarEventId'>[],
): Record<string, unknown> => {
  const { inscripcion, sesiones, ...resto } = formADocumento(f, uid, false) as Record<
    string,
    unknown
  > & {
    inscripcion: Record<string, unknown>;
    sesiones: { id: string }[];
  };
  const porSubcampo = Object.fromEntries(
    Object.entries(inscripcion)
      .filter(([clave]) => clave !== 'completo')
      .map(([clave, valor]) => [`inscripcion.${clave}`, valor]),
  );
  return {
    ...resto,
    // B-150 — los campos de máquina de cada sesión los pone el documento, no el
    // formulario. El parámetro es **obligatorio** a propósito: con un default
    // el arreglo volvería a ser un acuerdo que se rompe por olvido, y acá el
    // olvido es justamente el bug. Pasar `[]` es una respuesta válida y
    // explícita —"el documento no tiene ninguna de estas sesiones"— y deja los
    // ids en `null`, que es lo correcto: el panel no puede *inventar* un id de
    // evento, y el write-back del sync repone el que corresponda (D-91).
    sesiones: fusionarSesiones(sesiones, sesionesEnDisco),
    ...porSubcampo,
  };
};

export const actualizarActividad = async (
  id: string,
  f: ActividadForm,
  uid: string,
): Promise<void> => {
  const ref = doc(db(), COL, id);

  /**
   * B-150 — se **relee** el documento antes de escribir, y los campos de
   * máquina de cada sesión salen de ahí y no del formulario (`fusionarSesiones`).
   *
   * El form pudo haberse abierto desde un listado anterior al write-back del
   * sync, así que su `calendarEventId` puede tener minutos de atraso; el
   * documento, en cambio, es lo que la Function escribió. Es la misma relectura
   * que hace `syncCalendar` antes de su propio write-back, y por el mismo
   * motivo: entre que se armó el payload y este punto pudo pasar otra
   * escritura.
   *
   * Queda una ventana del tamaño de este `updateDoc`, y es a propósito que no se
   * cierre con una transacción: el sync repone el id en **toda** operación
   * (D-91), así que esa ventana ya no deja daño permanente, y convertir el
   * guardado del formulario —la acción más usada del panel— en una transacción
   * de cliente le cambiaría los modos de falla por un P3.
   */
  const snap = await getDoc(ref);
  const sesionesEnDisco = snap.exists() ? ((snap.data() as Actividad).sesiones ?? []) : [];
  const slugEnDisco = snap.exists() ? ((snap.data() as Actividad).slug ?? '') : '';

  const payload = payloadDeActualizacion(f, uid, sesionesEnDisco);
  const slugNuevo = payload.slug as string;

  /*
   * ── El slug cambió: reservar el nuevo y soltar el viejo, en el mismo batch ──
   * D-660. Pasa solo antes de publicar (trampa 10 — `slugBloqueado` en el
   * formulario), y cuando pasa las tres escrituras tienen que ser una: si la
   * reserva nueva entrara sin el documento, el nombre quedaría tomado por una
   * actividad que no lo usa; si el documento entrara sin la reserva, el nombre
   * quedaría libre para que otro lo pise. Un batch no tiene ese medio camino.
   *
   * Se compara contra el slug **del documento**, no contra el del formulario:
   * entre que se abrió el formulario y este punto pudo haber otra escritura, que
   * es la misma relectura que hace `sesionesEnDisco` dos líneas más arriba.
   */
  if (slugNuevo !== slugEnDisco) {
    const batch = writeBatch(db());
    batch.set(refDeSlug(slugNuevo), reservaDeSlug(id, uid));
    /*
     * **El guard va acá adentro y no en el `if` de afuera** — lo encontró el
     * `auditor-trampas`, y la primera versión lo tenía mal.
     *
     * Con `slugEnDisco &&` en la condición de arriba, una actividad **sin slug
     * válido en disco** —el caso que `scripts/sembrar-slugs.mjs` lista como
     * `sinSlug`— caía al `updateDoc` de abajo: se le escribía el slug nuevo al
     * documento y **no se reservaba nada**. El índice quedaba diciendo «libre»
     * sobre un slug en uso, que es el daño de la trampa 10 con el índice
     * contradiciendo al catálogo — peor que no tener índice.
     *
     * Es alcanzable por el camino normal: alguien edita una actividad vieja y le
     * pone su primera dirección web desde el formulario. `restaurarCampo`
     * (`historial.ts`) ya lo tenía bien; éste era el que divergía, que es la clase
     * de B-88 entre dos de los cuatro lugares que escriben el slug.
     */
    if (slugEnDisco) batch.delete(refDeSlug(slugEnDisco));
    batch.update(ref, payload);
    try {
      await batch.commit();
    } catch (error) {
      if (await tomadoPorOtra(slugNuevo, id)) throw new SlugTomado(slugNuevo);
      throw error;
    }
    return;
  }

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
  await updateDoc(ref, payload);
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

/**
 * Borrar la actividad y soltar su nombre — D-660.
 *
 * **El slug se relee del documento, no se recibe.** La primera versión lo tomaba
 * por parámetro —el de la fila del listado en memoria— y eso tenía un modo de
 * falla que encontró el `auditor-trampas`, silencioso y sin error de por medio:
 *
 *  - la actividad tiene el slug `S1`; en **otra pestaña** se le cambia a `S2`
 *    (`actualizarActividad` reserva `S2` y suelta `S1`, atómico y correcto);
 *  - la pestaña vieja, con la fila sin refrescar, aprieta «Borrar»;
 *  - se borra el documento y se suelta **`S1`**, que ya no existe: un no-op que
 *    «sale bien». **`S2` queda reservado apuntando a un id borrado**, y nada avisa.
 *
 * Releerlo cuesta una lectura —el borrado es la acción más rara del panel— y es
 * lo que hace que los **cuatro** escritores del slug decidan contra el documento
 * y no contra un snapshot, que es la misma lección que ya habían pagado
 * `actualizarActividad` (su `getDoc`) y `restaurarCampo` (su `leerActividad`).
 *
 * **Y si el documento ya no está, no se suelta nada**, a propósito: soltar el
 * slug que traía el caller podría estar borrando la reserva de **otra** actividad
 * que mientras tanto tomó ese nombre. Queda una reserva huérfana —falla cerrada,
 * y la barre `scripts/sembrar-slugs.mjs --reparar`— en vez de un nombre robado.
 *
 * Las dos escrituras **no van en un batch**, al revés que el alta: soltar la
 * reserva puede fallar por permisos en un caso real —si un admin le cambió el
 * slug a la actividad de un publicador, la reserva quedó a nombre del admin— y
 * con un batch ese caso haría que el publicador **no pueda borrar su propia
 * actividad**. Separadas, el borrado ocurre y lo que queda es un nombre tomado de
 * más.
 */
export const borrarActividad = async (id: string): Promise<void> => {
  const ref = doc(db(), COL, id);
  const snap = await getDoc(ref);
  const slugEnDisco = snap.exists() ? ((snap.data() as Actividad).slug ?? '') : '';

  await deleteDoc(ref);
  if (slugEnDisco) await liberarSlug(slugEnDisco);
};
