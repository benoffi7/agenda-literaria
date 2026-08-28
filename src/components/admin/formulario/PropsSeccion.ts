import type { ActividadForm } from '@/types/actividad';

/**
 * Lo que toda sección del formulario necesita para pintarse y para escribir.
 *
 * Las secciones son **presentación**: no deciden reglas del modelo (eso vive en
 * `src/lib/formulario/`, B-70) ni tienen estado propio. Reciben el formulario y
 * la forma de modificarlo, y por eso los nombres son los mismos que tenían
 * dentro de `ActividadFormulario.tsx`: partir el JSX (B-79) no cambió una línea
 * de su cuerpo.
 */
export interface PropsSeccion {
  form: ActividadForm;
  /** Reemplaza un campo de primer nivel del formulario. */
  set: <K extends keyof ActividadForm>(k: K, v: ActividadForm[K]) => void;
  /**
   * El error del schema para una ruta de campo, si lo hay. La ruta lleva el
   * índice cuando el campo vive en una lista: `'modalidades.0.sede.nombre'`.
   */
  errorDe: (path: string) => string | undefined;
  /** Para las taxonomías: quién está cargando (§4.3, huella de autor). */
  uid: string;
}
