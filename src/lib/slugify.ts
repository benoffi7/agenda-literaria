/**
 * §4.2 — normalización de taxonomías.
 * Sin esto, en tres meses hay "A la gorra", "a la gorra ", "A la Gorra"
 * y "Gorra" como cuatro opciones distintas.
 */
export const slugify = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
