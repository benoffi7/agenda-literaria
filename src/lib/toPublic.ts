import { imagenesDe } from '@/lib/imagenes';
import type { Actividad, Imagen, ItemMaterial, Libro, Sesion } from '@/types/actividad';

/**
 * §5 — Todo lo que entra al `events.json` es público y scrapeable.
 * El build NO vuelca el documento entero: lo proyecta.
 *
 * Nunca al JSON (§5.1):
 *  - `online.url` con `urlPublica: false` → el link de la reunión se manda
 *                        al inscribirse (trampa 5). Con `urlPublica: true`
 *                        el dueño decidió publicarlo — ver abajo.
 *  - `difusion`        → trabajo interno
 *  - `material.items[].url` con `publico: false`
 *  - `createdBy` / `updatedBy` → uids
 */

export interface SesionPublica {
  id: string;
  inicio: string;
  fin: string;
  tema: string | null;
  lectura: string | null;
  cancelada: boolean;
}

export interface ItemMaterialPublico {
  tipo: ItemMaterial['tipo'];
  titulo: string;
  entrega: ItemMaterial['entrega'];
  url?: string;
}

/** §5.1 — lo mismo que `Imagen` **menos `storagePath`**, que es interno. */
export interface ImagenPublica {
  id: string;
  url: string;
  epigrafe: string;
  origen: 'externa' | 'propia';
  portada: boolean;
  ancho?: number;
  alto?: number;
}

/**
 * §5.1 + DEC-1 — el libro presentado **sí es público**.
 *
 * Es información de la actividad, del mismo orden que el título y el tallerista:
 * quien busca «se presenta tal libro» tiene que encontrarla. Se enumeran los dos
 * campos igual que el resto de la proyección —whitelist, sin spread— así que una
 * clave que se agregue mañana al modelo no sale sola.
 */
export interface LibroPublico {
  titulo: string;
  autor: string;
}

export interface ActividadPublica {
  id: string;
  titulo: string;
  slug: string;
  tipo: Actividad['tipo'];
  descripcion: string;
  imagenes: ImagenPublica[];
  modalidad: Actividad['modalidad'];
  sede: Actividad['sede'];
  tags: string[];
  destacado: boolean;
  searchText: string;
  arancel: Actividad['arancel'];
  organizador: Actividad['organizador'];
  tallerista: Actividad['tallerista'];
  libro: LibroPublico | null;
  esCiclo: boolean;
  sesiones: SesionPublica[];
  inscripcion: {
    requiere: boolean;
    via: Actividad['inscripcion']['via'];
    destino: string;
    cupo: number | null;
    abierta: boolean;
  };
  online: { plataforma: string; url?: string } | null;
  material: {
    tiene: boolean;
    items: ItemMaterialPublico[];
  };
}

/** Serializa un Timestamp a ISO. Acepta Date por comodidad en tests. */
const aIso = (t: { toDate(): Date } | Date): string =>
  t instanceof Date ? t.toISOString() : t.toDate().toISOString();

const aMillis = (t: { toMillis(): number } | Date): number =>
  t instanceof Date ? t.getTime() : t.toMillis();

/**
 * Qué de cada imagen es público (§5.1, B-167).
 *
 * **`storagePath` no sale.** Es la ruta interna del bucket: publicarla dibuja su
 * estructura y deja probar objetos por nombre. Lo demás sí: la URL es lo que el
 * navegador va a pedir igual, el epígrafe se muestra, y `ancho`/`alto` evitan que
 * la tarjeta salte al cargar.
 *
 * `origen` sale porque el build lo necesita: las propias tienen tamaños derivados
 * y las externas se sirven tal cual desde su origen (DEC-7d). Es un enum cerrado
 * de dos valores, no contenido.
 */
const imagenPublica = (i: Imagen): ImagenPublica => ({
  id: i.id,
  url: i.url,
  epigrafe: i.epigrafe,
  origen: i.origen,
  portada: i.portada,
  ...(i.ancho !== undefined ? { ancho: i.ancho } : {}),
  ...(i.alto !== undefined ? { alto: i.alto } : {}),
});

/**
 * El libro, o `null`. Sin título no se inventa el campo (D-15): un objeto con
 * dos cadenas vacías en el `events.json` haría que el sitio pinte el rótulo
 * «Libro:» vacío en toda actividad que no lo tenga.
 */
const libroPublico = (l: Libro | null | undefined): LibroPublico | null =>
  l?.titulo ? { titulo: l.titulo, autor: l.autor ?? '' } : null;

const sesionPublica = (s: Sesion): SesionPublica => ({
  id: s.id,
  inicio: aIso(s.inicio),
  fin: aIso(s.fin),
  tema: s.tema ?? null,
  lectura: s.lectura ?? null,
  cancelada: s.cancelada ?? false,
});

/** Un item privado conserva título y tipo, pero pierde la URL (§5.1). */
const itemPublico = (i: ItemMaterial): ItemMaterialPublico =>
  i.publico
    ? { tipo: i.tipo, titulo: i.titulo, entrega: i.entrega, url: i.url }
    : { tipo: i.tipo, titulo: i.titulo, entrega: i.entrega };

export const toPublic = (a: Actividad, id: string, ahora = Date.now()): ActividadPublica => ({
  id,
  titulo: a.titulo,
  slug: a.slug,
  tipo: a.tipo,
  descripcion: a.descripcion,
  imagenes: imagenesDe(a).map(imagenPublica),
  modalidad: a.modalidad,
  sede: a.sede ?? null,
  tags: a.tags ?? [],
  destacado: a.destacado ?? false,
  searchText: a.searchText ?? '',
  arancel: a.arancel,
  organizador: a.organizador,
  tallerista: a.tallerista ?? null,
  libro: libroPublico(a.libro),
  esCiclo: a.esCiclo ?? false,
  sesiones: (a.sesiones ?? []).map(sesionPublica),
  inscripcion: {
    requiere: a.inscripcion.requiere,
    via: a.inscripcion.via,
    destino: a.inscripcion.destino,
    cupo: a.inscripcion.cupo,
    abierta: !a.inscripcion.cierra || aMillis(a.inscripcion.cierra) > ahora,
  },
  /**
   * La plataforma siempre; la URL solo si `urlPublica` está en true.
   *
   * Desvío consciente del §5.2, que descarta la URL sin condición: el modelo
   * del §3.1 tiene el flag `urlPublica` y el formulario su casilla, así que
   * ignorarlo era prometer algo que no pasaba. Decisión explícita del dueño.
   *
   * El default sigue siendo `false` y el formulario advierte que un link de
   * reunión público habilita zoombombing (trampa 5). Publicarlo es una acción
   * deliberada por actividad, no el comportamiento por omisión.
   */
  online: a.online
    ? a.online.urlPublica && a.online.url
      ? { plataforma: a.online.plataforma, url: a.online.url }
      : { plataforma: a.online.plataforma }
    : null,
  material: {
    tiene: a.material?.tiene ?? false,
    items: (a.material?.items ?? []).map(itemPublico),
  },
});
