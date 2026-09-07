/**
 * **La forma de un chip de filtro, y nada más.**
 *
 * Vive sola en un módulo de cuatro campos por un motivo concreto: la usan las
 * **dos** pantallas —los chips del sitio (`chipsDe`, `lib/listadoPublico.ts`) y
 * el eje de etiquetas del panel (`chipsDeTags`, `lib/filtrosActividades.ts`)— y
 * entre esos dos módulos **ya hay una flecha**: `listadoPublico` toma
 * `ETIQUETA_MODALIDAD` del panel, para que «Presencial y virtual» se diga igual en
 * las dos pantallas. Declarar el tipo en `listadoPublico` y usarlo desde el panel
 * **cerraría** ese círculo, y el §1.5 de `docs/10-salud-del-codigo.md` afirma cero
 * ciclos — lo cobró `tests/salud-del-codigo.test.ts` al escribir B-274.
 *
 * (La flecha es una sola y va en esa dirección: el docblock original decía «ya se
 * importan entre sí», que invitaba a creer que el ciclo ya existía. Lo corrigió el
 * `auditor-privacidad`.)
 *
 * La alternativa era declararlo dos veces. No: **es la misma cosa mirada por dos
 * personas que hablan entre ellas** —quien carga y quien busca— y el día que un
 * chip necesite un quinto campo, dos declaraciones se separan sin que nada falle.
 */
export interface Chip {
  /** El slug guardado. Es lo que viaja al filtro. */
  valor: string;
  /** Lo que se lee. Sale de `/opciones/*`, con `desSlug` como respaldo (§4.1). */
  label: string;
  /**
   * Cuántas actividades quedarían. **Se cuenta con los demás filtros puestos y
   * este eje no**: si se contara con el propio eje puesto, elegir un valor
   * dejaría los demás en cero y no habría forma de sumar el segundo.
   */
  cantidad: number;
  elegido: boolean;
}
