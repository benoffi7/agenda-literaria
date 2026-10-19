import type { Modalidad } from '@/types/actividad';

/**
 * Las tres modalidades, con el mismo texto que usa la descripción del evento.
 *
 * **Vive en un módulo hoja** (B-2214): el sitio público la necesita para la
 * tarjeta y los chips, y cuando se importaba de `filtrosActividades` arrastraba al
 * bundle del buscador ese módulo del panel con todo lo suyo (~3 KB gzip). Solo
 * importa un tipo, así que no trae nada. `filtrosActividades` la reexporta.
 */
export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Presencial y virtual',
};
