/**
 * Qué campos faltan, dichos por su nombre y con su sección (B-184).
 *
 * El pedido del dueño: «cuando no se pueda guardar y diga que faltan campos,
 * siempre especificarlos». Antes la barra decía «3 campos para revisar» y nada
 * más. La decisión escrita era mostrar solo el contador —listar rutas de campo
 * tapaba media pantalla en mobile, y el detalle está en rojo al lado de cada
 * campo— y le faltaba un dato: **cuatro de las nueve secciones arrancan
 * colapsadas**. Un campo rechazado adentro de un acordeón cerrado no está en
 * ninguna parte de la pantalla: el contador dice tres y no hay forma de saber
 * dónde mirar.
 *
 * Entonces acá viven tres cosas y ninguna es presentación:
 *
 * 1. **El nombre de cada campo**, el que se ve al lado del control
 *    (`sede.direccion` → «Dirección»), no la ruta del schema.
 * 2. **A qué sección pertenece**, que es lo que permite abrir el acordeón y
 *    llevar hasta él.
 * 3. **Cómo se resume** cuando son muchos: nombrando secciones con su cuenta en
 *    lugar de doce campos, que es lo que resuelve el problema de espacio que
 *    motivó la decisión original.
 *
 * Es data y no JSX para poder testearlo: `tests/campos-faltantes.test.ts` deriva
 * del schema **todo** lo que puede fallar y falla si algo no tiene nombre acá.
 * Un campo nuevo sin nombre no se descubre en producción con un mensaje que dice
 * «1 campo» y no dice cuál.
 */
import { colapsarIndices } from '@/lib/rutaCampo';

/** Una sección del formulario, en el orden en que se ve en la pantalla. */
export interface SeccionFormulario {
  /** Ancla en el DOM (`id` de la `<section>`), para poder scrollear hasta ella. */
  id: string;
  /** El título tal como aparece en el encabezado de la sección. */
  titulo: string;
  /** Arranca cerrada: es la que hay que abrir para que el error se vea. */
  colapsable: boolean;
}

/**
 * Las nueve secciones del §11, en orden de pantalla.
 *
 * El orden importa dos veces: el mensaje las nombra de arriba hacia abajo (que
 * es el orden en que quien carga va a recorrerlas) y «el primer error» se
 * resuelve por orden del documento.
 */
export const SECCIONES = [
  { id: 'que-es', titulo: 'Qué es', colapsable: false },
  { id: 'encuentros', titulo: 'Encuentros', colapsable: false },
  { id: 'donde', titulo: 'Dónde', colapsable: false },
  { id: 'quien', titulo: 'Quién', colapsable: false },
  { id: 'arancel-inscripcion', titulo: 'Arancel e inscripción', colapsable: false },
  { id: 'material', titulo: 'Material', colapsable: true },
  { id: 'opcional', titulo: 'Opcional', colapsable: true },
  { id: 'difusion', titulo: 'Difusión', colapsable: true },
  // B-95 — no lleva campos, igual que la vista previa: está en el registro porque
  // el test exige que toda sección del formulario declare su ancla, no porque la
  // barra pueda mandar a un campo de acá.
  { id: 'texto-redes', titulo: 'Texto para publicar', colapsable: true },
  { id: 'vista-previa', titulo: 'Vista previa del evento', colapsable: true },
] as const satisfies readonly SeccionFormulario[];

export type IdSeccion = (typeof SECCIONES)[number]['id'];

/** El nombre visible de un campo y dónde vive. */
interface CampoUI {
  etiqueta: string;
  seccion: IdSeccion;
}

/**
 * Ruta del schema → nombre visible y sección.
 *
 * Las rutas vienen con los índices colapsados (`sesiones.N.inicio`): lo que hay
 * que decir es «Fecha de inicio», no en qué fila. Las etiquetas son las del
 * formulario, palabra por palabra: si el mensaje dice «Dirección» y el campo
 * dice «Dirección», no hay que traducir nada al buscarlo.
 */
export const CAMPOS: Readonly<Record<string, CampoUI>> = {
  // ── Qué es ──
  tipo: { etiqueta: 'Tipo de actividad', seccion: 'que-es' },
  estado: { etiqueta: 'Estado', seccion: 'que-es' },
  titulo: { etiqueta: 'Título', seccion: 'que-es' },
  slug: { etiqueta: 'Slug', seccion: 'que-es' },
  descripcion: { etiqueta: 'Descripción', seccion: 'que-es' },

  // B-167 — todas las rutas de la galería dicen «Flyer e imágenes»: el mensaje de
  // la barra nombra el campo que hay que ir a mirar, y ahí lo que se mira es la
  // sección entera, no la clave `portada` de la tercera fila.
  //
  // B-264 — y la sección es «Qué es» y ya no «Opcional». Es lo que sostiene la
  // mudanza del editor: si el mapa se quedaba apuntando a «Opcional», la barra
  // abriría un acordeón donde el campo ya no está.
  imagenes: { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.alto': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.ancho': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.epigrafe': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.id': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.origen': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.portada': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.storagePath': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },
  'imagenes.N.url': { etiqueta: 'Flyer e imágenes', seccion: 'que-es' },

  // ── Encuentros ──
  esCiclo: { etiqueta: 'Es un ciclo', seccion: 'encuentros' },
  sesiones: { etiqueta: 'Encuentros', seccion: 'encuentros' },
  'sesiones.N': { etiqueta: 'Encuentro', seccion: 'encuentros' },
  'sesiones.N.id': { etiqueta: 'Encuentro', seccion: 'encuentros' },
  'sesiones.N.inicio': { etiqueta: 'Fecha de inicio', seccion: 'encuentros' },
  'sesiones.N.fin': { etiqueta: 'Fecha de fin', seccion: 'encuentros' },
  'sesiones.N.tema': { etiqueta: 'Tema del encuentro', seccion: 'encuentros' },
  'sesiones.N.lectura': { etiqueta: 'Lectura del encuentro', seccion: 'encuentros' },
  'sesiones.N.cancelada': { etiqueta: 'Encuentro cancelado', seccion: 'encuentros' },
  'sesiones.N.calendarEventId': { etiqueta: 'Encuentro', seccion: 'encuentros' },

  // ── Dónde ──
  // B-224 — las modalidades son una lista, y `sede`/`online` viven adentro de
  // cada fila. Las rutas vienen con el índice colapsado: lo que hay que decir es
  // «Dirección», no en qué fila — igual que con los encuentros.
  modalidades: { etiqueta: 'Modalidad', seccion: 'donde' },
  'modalidades.N': { etiqueta: 'Modalidad', seccion: 'donde' },
  'modalidades.N.id': { etiqueta: 'Modalidad', seccion: 'donde' },
  'modalidades.N.modalidad': { etiqueta: 'Modalidad', seccion: 'donde' },
  'modalidades.N.inicio': { etiqueta: 'Desde cuándo', seccion: 'donde' },
  'modalidades.N.fin': { etiqueta: 'Hasta cuándo', seccion: 'donde' },
  'modalidades.N.sede': { etiqueta: 'Sede', seccion: 'donde' },
  'modalidades.N.sede.nombre': { etiqueta: 'Sede', seccion: 'donde' },
  'modalidades.N.sede.direccion': { etiqueta: 'Dirección', seccion: 'donde' },
  'modalidades.N.sede.barrio': { etiqueta: 'Barrio', seccion: 'donde' },
  'modalidades.N.sede.ciudad': { etiqueta: 'Ciudad', seccion: 'donde' },
  'modalidades.N.sede.indicaciones': { etiqueta: 'Cómo llegar', seccion: 'donde' },
  'modalidades.N.sede.geo': { etiqueta: 'Coordenadas de la sede', seccion: 'donde' },
  'modalidades.N.sede.geo.lat': { etiqueta: 'Coordenadas de la sede', seccion: 'donde' },
  'modalidades.N.sede.geo.lng': { etiqueta: 'Coordenadas de la sede', seccion: 'donde' },
  'modalidades.N.online': { etiqueta: 'Datos del encuentro virtual', seccion: 'donde' },
  'modalidades.N.online.plataforma': { etiqueta: 'Plataforma', seccion: 'donde' },
  'modalidades.N.online.url': { etiqueta: 'Link del encuentro', seccion: 'donde' },
  'modalidades.N.online.urlPublica': {
    // B-240 — el mismo texto que la casilla del formulario: si acá dijera «en el
    // sitio» y la casilla «en el calendario», el aviso de campo faltante mandaría
    // a buscar una casilla que no existe con ese nombre.
    etiqueta: 'Publicar el link en el calendario',
    seccion: 'donde',
  },

  // ── Quién ──
  organizador: { etiqueta: 'Organizador', seccion: 'quien' },
  'organizador.nombre': { etiqueta: 'Organizador', seccion: 'quien' },
  'organizador.instagram': { etiqueta: 'Instagram del organizador', seccion: 'quien' },
  'organizador.web': { etiqueta: 'Web del organizador', seccion: 'quien' },
  tallerista: { etiqueta: 'Tallerista o invitado', seccion: 'quien' },
  'tallerista.nombre': { etiqueta: 'Tallerista o invitado', seccion: 'quien' },
  'tallerista.instagram': { etiqueta: 'Instagram del tallerista', seccion: 'quien' },
  'tallerista.bio': { etiqueta: 'Bio del tallerista', seccion: 'quien' },
  // DEC-1 — el libro presentado vive en «Quién», al lado del autor invitado: son
  // los dos campos que aparecen juntos en una presentación (§11). Las etiquetas
  // son palabra por palabra las del formulario, para no tener que traducir nada
  // al ir a buscarlo.
  libro: { etiqueta: 'Libro presentado', seccion: 'quien' },
  'libro.titulo': { etiqueta: 'Libro presentado', seccion: 'quien' },
  'libro.autor': { etiqueta: 'Autor del libro', seccion: 'quien' },

  // ── Arancel e inscripción ──
  arancel: { etiqueta: 'Arancel', seccion: 'arancel-inscripcion' },
  'arancel.tipo': { etiqueta: 'Arancel', seccion: 'arancel-inscripcion' },
  'arancel.notas': { etiqueta: 'Notas del arancel', seccion: 'arancel-inscripcion' },
  inscripcion: { etiqueta: 'Inscripción', seccion: 'arancel-inscripcion' },
  'inscripcion.requiere': { etiqueta: 'Requiere inscripción', seccion: 'arancel-inscripcion' },
  'inscripcion.via': { etiqueta: 'Por dónde se inscriben', seccion: 'arancel-inscripcion' },
  'inscripcion.destino': { etiqueta: 'Destino de la inscripción', seccion: 'arancel-inscripcion' },
  'inscripcion.cupo': { etiqueta: 'Cupo', seccion: 'arancel-inscripcion' },
  // B-97 — no se edita desde el formulario (se prende desde el menú del
  // listado), pero el schema lo puede rechazar igual, y entonces el mensaje
  // tiene que nombrarlo. La sección es la que muestra el aviso de que está
  // marcada como completa.
  'inscripcion.completo': { etiqueta: 'Cupo completo', seccion: 'arancel-inscripcion' },
  'inscripcion.cierra': { etiqueta: 'Cierre de la inscripción', seccion: 'arancel-inscripcion' },

  // ── Material ──
  material: { etiqueta: 'Material', seccion: 'material' },
  'material.tiene': { etiqueta: 'Tiene material', seccion: 'material' },
  'material.items': { etiqueta: 'Material', seccion: 'material' },
  'material.items.N': { etiqueta: 'Material', seccion: 'material' },
  // B-342 — el id de cliente, como 'imagenes.N.id' y 'sesiones.N.id'.
  'material.items.N.id': { etiqueta: 'Material', seccion: 'material' },
  'material.items.N.titulo': { etiqueta: 'Título del material', seccion: 'material' },
  'material.items.N.url': { etiqueta: 'Link del material', seccion: 'material' },
  'material.items.N.tipo': { etiqueta: 'Formato del material', seccion: 'material' },
  'material.items.N.entrega': { etiqueta: 'Entrega del material', seccion: 'material' },
  'material.items.N.publico': { etiqueta: 'Visibilidad del material', seccion: 'material' },

  // ── Opcional ──
  tags: { etiqueta: 'Tags', seccion: 'opcional' },
  'tags.N': { etiqueta: 'Tags', seccion: 'opcional' },
  destacado: { etiqueta: 'Destacar en la portada', seccion: 'opcional' },

  // ── Difusión ──
  difusion: { etiqueta: 'Difusión', seccion: 'difusion' },
  'difusion.arrobar': { etiqueta: 'Arrobar al publicar', seccion: 'difusion' },
  'difusion.arrobar.N': { etiqueta: 'Arrobar al publicar', seccion: 'difusion' },
  'difusion.notas': { etiqueta: 'Notas internas', seccion: 'difusion' },
};

/** Nombre visible de una ruta del schema, o la ruta si no lo tiene. */
export const etiquetaDeCampo = (ruta: string): string =>
  CAMPOS[colapsarIndices(ruta)]?.etiqueta ?? ruta;

/** A qué sección pertenece una ruta. `null` si no está en el diccionario. */
export const seccionDeCampo = (ruta: string): IdSeccion | null =>
  CAMPOS[colapsarIndices(ruta)]?.seccion ?? null;

/** Los campos que faltan en una sección, ya con nombre y sin repetidos. */
export interface FaltantesDeSeccion {
  id: IdSeccion;
  titulo: string;
  /** Nombres de campo, en el orden en que aparecen en la sección. */
  etiquetas: string[];
  /** Cuántas rutas del schema fallaron acá (dos filas de material son dos). */
  cantidad: number;
}

export interface ResumenFaltantes {
  /** Cuántas rutas fallaron en total. Es el número que se mostraba solo. */
  total: number;
  secciones: FaltantesDeSeccion[];
  /** Rutas que el diccionario no conoce. Vacío es lo esperable. */
  sinUbicar: string[];
}

/**
 * Agrupa las rutas rechazadas por sección, en orden de pantalla.
 *
 * Recibe las rutas y no el mapa de errores para poder usarse con las dos
 * fuentes: los errores de un guardado que falló y el aviso de
 * `faltaParaPublicar`, que no bloquea nada.
 */
export const resumirFaltantes = (rutas: readonly string[]): ResumenFaltantes => {
  const porSeccion = new Map<IdSeccion, { etiquetas: string[]; cantidad: number }>();
  const sinUbicar: string[] = [];

  for (const ruta of rutas) {
    const seccion = seccionDeCampo(ruta);
    if (!seccion) {
      sinUbicar.push(ruta);
      continue;
    }
    const acumulado = porSeccion.get(seccion) ?? { etiquetas: [], cantidad: 0 };
    const etiqueta = etiquetaDeCampo(ruta);
    // Dos filas de material sin título son dos faltantes pero un solo nombre:
    // repetir «Título del material» dos veces no agrega información.
    if (!acumulado.etiquetas.includes(etiqueta)) acumulado.etiquetas.push(etiqueta);
    acumulado.cantidad += 1;
    porSeccion.set(seccion, acumulado);
  }

  return {
    total: rutas.length,
    secciones: SECCIONES.filter((s) => porSeccion.has(s.id)).map((s) => ({
      id: s.id,
      titulo: s.titulo,
      etiquetas: porSeccion.get(s.id)!.etiquetas,
      cantidad: porSeccion.get(s.id)!.cantidad,
    })),
    sinUbicar,
  };
};

/**
 * Hasta cuántos campos se nombran uno por uno antes de pasar a nombrar
 * secciones. Tres entran en una línea de un teléfono de 360 px; cinco no.
 */
export const MAX_CAMPOS_NOMBRADOS = 3;

/**
 * ¿Se nombran los campos o las secciones? Es la decisión que hace que el
 * mensaje sea corto en mobile y accionable igual: con pocos, «Falta: Título,
 * Arancel»; con muchos, «Falta: Dónde (2), Arancel e inscripción (1)».
 */
export const nombraSecciones = (resumen: ResumenFaltantes): boolean =>
  resumen.total > MAX_CAMPOS_NOMBRADOS;

/**
 * Lo que se lee en la barra, sin marcado: los nombres separados por comas.
 *
 * La barra lo pinta como botones para poder ir hasta el campo, pero el texto se
 * arma acá para poder testearlo y para que el lector de pantalla reciba la misma
 * frase que se ve.
 */
export const textoFaltantes = (resumen: ResumenFaltantes): string => {
  if (resumen.total === 0) return '';
  const partes = nombraSecciones(resumen)
    ? resumen.secciones.map((s) => `${s.titulo} (${s.cantidad})`)
    : resumen.secciones.flatMap((s) => s.etiquetas);
  const conocidos = partes.join(', ');
  // Una ruta sin nombre no se esconde: se muestra tal cual. Es preferible un
  // mensaje feo a un mensaje que dice que falta algo y no dice qué.
  return [conocidos, ...resumen.sinUbicar].filter(Boolean).join(', ');
};
