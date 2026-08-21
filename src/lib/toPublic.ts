import type { Actividad, ItemMaterial, Sesion } from '@/types/actividad';

/**
 * §5 — Todo lo que entra al `events.json` es público y scrapeable.
 * El build NO vuelca el documento entero: lo proyecta.
 *
 * Nunca al JSON (§5.1):
 *  - `online.url`      → el link de Zoom se manda al inscribirse (trampa 5)
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

export interface ActividadPublica {
  id: string;
  titulo: string;
  slug: string;
  tipo: Actividad['tipo'];
  descripcion: string;
  imagenUrl: string | null;
  modalidad: Actividad['modalidad'];
  sede: Actividad['sede'];
  tags: string[];
  destacado: boolean;
  searchText: string;
  arancel: Actividad['arancel'];
  organizador: Actividad['organizador'];
  tallerista: Actividad['tallerista'];
  esCiclo: boolean;
  sesiones: SesionPublica[];
  inscripcion: {
    requiere: boolean;
    via: Actividad['inscripcion']['via'];
    destino: string;
    cupo: number | null;
    abierta: boolean;
  };
  online: { plataforma: string } | null;
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
  imagenUrl: a.imagenUrl ?? null,
  modalidad: a.modalidad,
  sede: a.sede ?? null,
  tags: a.tags ?? [],
  destacado: a.destacado ?? false,
  searchText: a.searchText ?? '',
  arancel: a.arancel,
  organizador: a.organizador,
  tallerista: a.tallerista ?? null,
  esCiclo: a.esCiclo ?? false,
  sesiones: (a.sesiones ?? []).map(sesionPublica),
  inscripcion: {
    requiere: a.inscripcion.requiere,
    via: a.inscripcion.via,
    destino: a.inscripcion.destino,
    cupo: a.inscripcion.cupo,
    abierta: !a.inscripcion.cierra || aMillis(a.inscripcion.cierra) > ahora,
  },
  // Solo la plataforma. La URL nunca sale (§5.1).
  online: a.online ? { plataforma: a.online.plataforma } : null,
  material: {
    tiene: a.material?.tiene ?? false,
    items: (a.material?.items ?? []).map(itemPublico),
  },
});
