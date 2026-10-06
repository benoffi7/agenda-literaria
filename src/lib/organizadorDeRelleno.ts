/**
 * **¿Este «organizador» es de verdad un organizador?** — lo que B-2178 enseñó.
 *
 * Cuando se sembró la lista de organizadores (2026-09-29) aparecieron unos diez
 * valores que no lo eran: texto de relleno («A conf», «Buscando»), una cuenta de
 * Instagram en vez de un nombre, el barrio o la ciudad en vez de la casa, un nombre
 * con un `|` colgando. Cada uno es una página pública mal (`/organiza/{slug}`) y una
 * línea «Organiza» que no dice quién. Esta regla los detecta **al día siguiente de
 * cargarlos** —en el tablero—, en vez de meses después mirando una lista.
 *
 * Es **pura** y no lee nada: recibe el nombre y los lugares de la actividad. Devuelve
 * el motivo, o `null` si no hay nada raro. No intenta adivinar lo que no se puede
 * (un nombre cortado, «Fundación La»): ese caso necesita a una persona.
 */
import { slugify } from '@/lib/slugify';

export type MotivoDeRelleno = 'relleno' | 'cuenta' | 'lugar' | 'caracteres';

/**
 * El texto de relleno conocido, **por slug** (o sea sin importar mayúsculas,
 * espacios ni acentos). Lo que se escribe cuando todavía no se sabe quién
 * organiza. Es una lista cerrada a propósito: un patrón más ancho marcaría nombres
 * de verdad.
 */
export const RELLENO = [
  'a-conf',
  /*
   * Lo que se tipea, pasado por `slugify`, y no el slug de la plataforma «a
   * confirmar» (`SLUG_PLATAFORMA_A_CONFIRMAR`): coinciden en el texto y no en lo
   * que significan, así que no se atan (la clase de B-88 vigila esa copia).
   */
  slugify('A confirmar'),
  'aconf',
  'buscando',
  'lo-estoy-buscando',
  'sin-definir',
  'sin-organizador',
  'pendiente',
  'tbd',
  'xx',
  'xxx',
];

/** Lo que no va en el nombre de una casa, una editorial ni una persona. */
const CARACTERES_RAROS = /[|<>{}[\]\\^~]/;

/**
 * El motivo por el que `nombre` no parece un organizador, o `null`.
 *
 * @param nombre  lo que dice `organizador.nombre`
 * @param lugares  los slugs de barrio y ciudad de las sedes de la actividad
 */
export const organizadorDeRelleno = (
  nombre: string | null | undefined,
  lugares: readonly string[] = [],
): MotivoDeRelleno | null => {
  const crudo = (nombre ?? '').trim();
  if (!crudo) return null; // sin organizador es otro problema, y el schema lo pide al publicar
  const slug = slugify(crudo);
  if (RELLENO.includes(slug)) return 'relleno';
  if (crudo.startsWith('@')) return 'cuenta';
  if (CARACTERES_RAROS.test(crudo)) return 'caracteres';
  if (slug && lugares.some((l) => slugify(l) === slug)) return 'lugar';
  return null;
};

/** Cómo se dice cada motivo en el tablero, al lado del título de la actividad. */
export const DICHO_DEL_MOTIVO: Record<MotivoDeRelleno, string> = {
  relleno: 'es texto de relleno',
  cuenta: 'es una cuenta de Instagram, no un nombre',
  lugar: 'es el barrio o la ciudad, no quién organiza',
  caracteres: 'tiene caracteres que no van en un nombre',
};
