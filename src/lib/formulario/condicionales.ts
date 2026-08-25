/**
 * §11 — qué partes del formulario aplican a esta actividad.
 *
 * "Se elige `tipo` primero y se muestra solo lo que aplica": el material es
 * sobre todo del club de lectura, el tallerista es del taller, el autor
 * invitado de la presentación y la charla, la sede de lo presencial y el
 * bloque online de lo virtual.
 *
 * Son reglas del modelo y no de presentación —el schema valida los mismos
 * condicionales en su `superRefine`—, así que viven acá y no en el `.tsx`
 * (B-70). Que la sede se pida y que la sede se muestre tienen que ser la misma
 * condición: si se separan, el formulario esconde un campo que el schema exige
 * y el guardado falla por un campo que no está en pantalla.
 */
import type { ActividadForm } from '@/types/actividad';

export const esTaller = (f: ActividadForm): boolean => f.tipo === 'taller';

export const esClub = (f: ActividadForm): boolean => f.tipo === 'club-lectura';

/** Presentación de libro o charla con autor: las dos tienen persona invitada. */
export const esCharla = (f: ActividadForm): boolean =>
  f.tipo === 'presentacion' || f.tipo === 'charla';

export const necesitaSede = (f: ActividadForm): boolean =>
  f.modalidad === 'presencial' || f.modalidad === 'hibrido';

export const necesitaOnline = (f: ActividadForm): boolean =>
  f.modalidad === 'virtual' || f.modalidad === 'hibrido';

/**
 * Cómo se llama la persona al frente. No es lo mismo quien da un taller que
 * quien viene invitado a presentar su libro, y el rótulo del campo es lo único
 * que lo distingue en pantalla.
 */
export const nombrePersona = (f: ActividadForm): string =>
  esCharla(f) ? 'Autor o autora invitada' : 'Tallerista';
