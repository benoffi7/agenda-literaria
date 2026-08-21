/**
 * §6 — normalización para búsqueda: baja a minúsculas y saca acentos, para que
 * "Boedo" matchee "boedo" y "crónica" matchee "cronica".
 * El input de búsqueda del cliente aplica exactamente esta misma función.
 */
export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

interface FuenteSearchText {
  titulo?: string;
  descripcion?: string;
  sede?: { nombre?: string; barrio?: string } | null;
  organizador?: { nombre?: string } | null;
  tallerista?: { nombre?: string } | null;
}

/** Construye el `searchText` que se guarda en el documento (§6). */
export const buildSearchText = (a: FuenteSearchText): string =>
  normalize(
    [
      a.titulo ?? '',
      a.descripcion ?? '',
      a.sede?.nombre ?? '',
      a.sede?.barrio ?? '',
      a.organizador?.nombre ?? '',
      a.tallerista?.nombre ?? '',
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
