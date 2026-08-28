/**
 * §11 — qué partes del formulario aplican a esta actividad.
 *
 * "Se elige `tipo` primero y se muestra solo lo que aplica": el material es
 * sobre todo del club de lectura, el tallerista es del taller, el autor
 * invitado y el libro presentado de la presentación y la charla, la sede de lo
 * presencial y el bloque online de lo virtual.
 *
 * Son reglas del modelo y no de presentación —el schema valida los mismos
 * condicionales en su `superRefine`—, así que viven acá y no en el `.tsx`
 * (B-70). Que la sede se pida y que la sede se muestre tienen que ser la misma
 * condición: si se separan, el formulario esconde un campo que el schema exige
 * y el guardado falla por un campo que no está en pantalla.
 */
import { filaPideOnline, filaPideSede } from '@/lib/modalidades';
import type { ActividadForm, Modalidad } from '@/types/actividad';

/** ¿Alguna de estas filas pide el bloque de sede? */
export const filasPidenSede = (filas: readonly { modalidad: Modalidad }[]): boolean =>
  filas.some((f) => filaPideSede(f.modalidad));

/** ¿Alguna de estas filas pide el bloque online? */
export const filasPidenOnline = (filas: readonly { modalidad: Modalidad }[]): boolean =>
  filas.some((f) => filaPideOnline(f.modalidad));

export const esTaller = (f: ActividadForm): boolean => f.tipo === 'taller';

export const esClub = (f: ActividadForm): boolean => f.tipo === 'club-lectura';

/** Presentación de libro o charla con autor: las dos tienen persona invitada. */
export const esCharla = (f: ActividadForm): boolean =>
  f.tipo === 'presentacion' || f.tipo === 'charla';

/**
 * ¿Esta actividad tiene alguna forma de cursar presencial? (B-224)
 *
 * Desde que las modalidades son una lista, la pregunta «¿hay sede?» se contesta
 * por fila —cada una tiene la suya— y esto es la vista de la actividad entera:
 * lo que decide si la sección «Dónde» tiene algo presencial que mostrar y lo que
 * el schema usa para exigir la dirección.
 */
export const necesitaSede = (f: ActividadForm): boolean => filasPidenSede(f.modalidades);

export const necesitaOnline = (f: ActividadForm): boolean => filasPidenOnline(f.modalidades);

/**
 * ¿Se muestra el bloque del libro presentado? (DEC-1)
 *
 * En presentación y charla **siempre**: son los dos tipos que lo piden (§11), los
 * mismos en los que la persona al frente se llama «autor o autora invitada».
 *
 * Y además **en cualquier tipo que ya lo tenga cargado**, que no es cortesía:
 * `formADocumento` conserva el libro al cambiar de tipo —las cascadas agregan y
 * no sacan, para no borrar lo que alguien escribió— y `duplicar` lo hereda. Sin
 * esta segunda mitad, una presentación pasada a taller sigue publicando
 * «Libro: …» en el sitio y en el evento del calendario sin ninguna pantalla desde
 * donde verlo ni borrarlo: contenido público sin forma de editarlo desde donde se
 * cargó. La condición del §11 dice qué se **pide**; lo que ya está cargado se
 * muestra igual.
 */
export const muestraLibro = (f: ActividadForm): boolean =>
  esCharla(f) || Boolean(f.libro?.titulo?.trim());

/**
 * Cómo se llama la persona al frente. No es lo mismo quien da un taller que
 * quien viene invitado a presentar su libro, y el rótulo del campo es lo único
 * que lo distingue en pantalla.
 */
export const nombrePersona = (f: ActividadForm): string =>
  esCharla(f) ? 'Autor o autora invitada' : 'Tallerista';
