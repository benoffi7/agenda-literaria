/**
 * **Dónde puede cargar un publicador** — B-921, D-1150.
 *
 * La decisión del dueño, textual: «un publicador que tiene una ciudad asignada
 * debería no poder publicar fuera de esa. Puede haber publicadores generales».
 *
 * ⚠️ **Nada de acá autoriza nada**, igual que `rolDelPanel.ts`. La frontera es
 * `dentroDeSuCiudad()` en `firestore.rules` (`/actividades`, `allow create` y
 * `allow update`). Este módulo es el **espejo** de esa cláusula en el panel, para
 * que la persona se entere **antes** de apretar «Guardar» y con una frase que no
 * parezca un error del sistema: sin él, lo que vería es el «Tu cuenta no tiene
 * permiso para hacer esto» de `fallosDelPanel.ts`, que la manda a salir y volver
 * a entrar — el consejo equivocado para este caso.
 *
 * ── Las tres respuestas, y son las mismas que da la regla ─────────────────
 *  1. **Sin ciudad en el claim** (publicador general, o un admin: `ciudadDeClaims`
 *     devuelve `''` para él) → nada queda afuera.
 *  2. **Las ciudades no cambiaron respecto del documento guardado** → nada queda
 *     afuera, aunque sean de otra ciudad. Es «lo ya cargado no se toca»: una
 *     actividad propia de antes de B-921 que está en otra ciudad se sigue
 *     pudiendo mantener —despublicarla, corregirle una fecha—, pero no mudarla a
 *     una tercera. La comparación es **en orden**, como el `==` de listas de la
 *     regla: reordenar las filas de dos ciudades ajenas cuenta como cambio, y
 *     falla cerrado.
 *  3. **Si no, cada ciudad que no sea la suya queda afuera.** Una actividad solo
 *     virtual tiene `ciudades: []` y no deja nada afuera (D-1151): no pasa en
 *     ninguna ciudad, así que no pasa fuera de la suya.
 *
 * Puro: se testea sin DOM y sin Firestore (`tests/alcance-de-ciudad.test.ts`), y
 * ese archivo también lee la regla para que las dos mitades no se separen.
 */
import { desSlug } from '@calendario';

export interface AlcanceDeCiudad {
  /** El slug del claim `ciudad` (`ciudadDeClaims`), o `''` si no tiene. */
  ciudad: string;
  /** Las `ciudades` que se van a escribir (el derivado de `ciudadesDe`). */
  ciudades: readonly string[];
  /**
   * Las `ciudades` del documento tal como está guardado. Ausente al crear
   * (también al duplicar y al convertir una propuesta: son altas). Un documento
   * anterior a B-919 sin el campo llega como `undefined` y se compara como `[]`,
   * que es el mismo default que la regla (`.get('ciudades', [])`).
   */
  ciudadesAntes?: readonly string[] | null;
  /** ¿Es una edición? Distingue «sin ciudades antes» de «no hay antes». */
  editando: boolean;
}

const mismasEnOrden = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((c, i) => c === b[i]);

/** Las ciudades que dejan la actividad fuera del alcance de quien guarda. `[]` = se puede. */
export const ciudadesFueraDeSuCiudad = ({
  ciudad,
  ciudades,
  ciudadesAntes,
  editando,
}: AlcanceDeCiudad): string[] => {
  if (!ciudad) return [];
  if (editando && mismasEnOrden(ciudades, ciudadesAntes ?? [])) return [];
  return ciudades.filter((c) => c !== ciudad);
};

const enumerar = (nombres: readonly string[]): string =>
  nombres.length <= 1
    ? (nombres[0] ?? '')
    : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/**
 * El aviso, en el idioma del panel.
 *
 * **Dice las tres cosas que la persona necesita, en este orden**: por qué no se
 * puede (su cuenta es de una ciudad), qué del formulario lo causa (la sede en
 * otra ciudad, nombrada) y qué hacer (dejar sedes de su ciudad o solo virtual;
 * si de verdad es de otra ciudad, la carga otra cuenta). No dice «permiso» ni
 * «error», a propósito: no es algo que se arregle saliendo y volviendo a entrar.
 *
 * `etiqueta` resuelve el slug al nombre que se ve en el desplegable; sin ella
 * —o para una ciudad que todavía no está en `/opciones/ciudad`— se usa `desSlug`.
 */
export const textoFueraDeSuCiudad = (
  fuera: readonly string[],
  ciudad: string,
  etiqueta: (slug: string) => string | undefined = () => undefined,
): string => {
  const nombre = (slug: string) => etiqueta(slug) ?? desSlug(slug);
  const otras = enumerar(fuera.map(nombre));
  return (
    `Tu cuenta carga actividades de ${nombre(ciudad)}, y esta tiene una sede en ${otras}. ` +
    `Para guardarla, dejá solo sedes de ${nombre(ciudad)} (o que sea virtual). ` +
    'Si la actividad es de otra ciudad, la tiene que cargar una cuenta de esa ciudad o el administrador.'
  );
};
