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
 * ── Las respuestas, y son las de la regla o más estrictas ─────────────────
 *  1. **Sin ciudad en el claim** (publicador general, o un admin: `ciudadDeClaims`
 *     devuelve `''` para él) → nada queda afuera.
 *  2. **Las ciudades no cambiaron respecto del documento guardado** → no quedan
 *     ciudades afuera, aunque sean de otra. Es «lo ya cargado no se toca»
 *     (D-1153): una actividad propia de antes de B-921 que está en otra ciudad se
 *     sigue pudiendo mantener, pero no mudar a una tercera. La comparación es
 *     **en orden**, como el `==` de listas de la regla: reordenar las filas de dos
 *     ciudades ajenas cuenta como cambio, y falla cerrado.
 *  3. **Si no, cada ciudad que no sea la suya queda afuera.** Una actividad solo
 *     virtual tiene `ciudades: []` y no deja nada afuera (D-1151): no pasa en
 *     ninguna ciudad, así que no pasa fuera de la suya.
 *  4. **Una sede sin ciudad también frena** (D-1154). Fuera de CABA la ciudad no
 *     se exige para publicar, y `ciudadesDe` descarta las vacías: sin esto, una
 *     presencial en Santa Fe sin ciudad quedaba con `ciudades: []` y pasaba como
 *     si fuera virtual. Lo encontró el `auditor-privacidad`. La regla lo mira en
 *     la **primera** sede (el derivado `sede`, que es lo único que una regla
 *     puede leer); el panel, en **todas** — o sea que acá es más estricto, que es
 *     la dirección en la que se pueden separar sin que nadie choque contra un
 *     rechazo del servidor. Lo que ya estaba así se mantiene con la misma
 *     excepción del punto 2, siempre que no se agregue una sede sin ciudad más.
 *
 * Puro: se testea sin DOM y sin Firestore (`tests/alcance-de-ciudad.test.ts`), y
 * ese archivo también lee la regla para que las dos mitades no se separen.
 */
import { desSlug } from '@calendario';
import { ciudadesDe, slugDeCiudad } from '@/lib/ciudades.mjs';
import { geografiaNormalizada } from '@/lib/geografia.mjs';
import { filaPideSede } from '@/lib/modalidades';
import type { Modalidad } from '@/types/actividad';

/** Lo único de una fila de modalidad que esto mira. */
type FilaConSede = { modalidad?: Modalidad; sede?: { ciudad?: string | null } | null };

/**
 * **Las sedes como las va a escribir `formADocumento`**, no como están en el
 * formulario. Son dos transformaciones y las dos cambian la respuesta: una fila
 * virtual con una sede colgada no escribe sede (`filaPideSede`), y la ciudad
 * pasa por `geografiaNormalizada`, que colapsa los alias de CABA. Preguntar por
 * el formulario crudo sería preguntar por otro documento que el que la regla va
 * a ver.
 */
const comoSeGuardan = (filas: readonly FilaConSede[] = []): FilaConSede[] =>
  filas.map((f) => ({
    sede:
      (f.modalidad === undefined || filaPideSede(f.modalidad)) && f.sede
        ? { ciudad: geografiaNormalizada({ ciudad: f.sede.ciudad ?? undefined }).ciudad }
        : null,
  }));

export interface AlcanceDeCiudad {
  /** El slug del claim `ciudad` (`ciudadDeClaims`), o `''` si no tiene. */
  ciudad: string;
  /** Las filas que se van a escribir. `ciudades` se deriva de acá con `ciudadesDe`. */
  modalidades: readonly FilaConSede[];
  /**
   * El documento tal como está guardado, al editar. Ausente al crear (también al
   * duplicar y al convertir una propuesta: son altas). Un documento anterior a
   * B-919 sin `ciudades` se compara como `[]`, el mismo default que la regla.
   */
  antes?: { ciudades?: readonly string[] | null; modalidades?: readonly FilaConSede[] } | null;
}

export interface FueraDeSuCiudad {
  /** Las ciudades, en slug, que no son la suya. */
  ciudades: string[];
  /** ¿Hay una sede sin ciudad que no estaba antes? */
  sedeSinCiudad: boolean;
}

const mismasEnOrden = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((c, i) => c === b[i]);

const sedesSinCiudad = (filas: readonly FilaConSede[] = []): number =>
  filas.filter((f) => f.sede && !slugDeCiudad(f.sede.ciudad)).length;

/** Qué deja la actividad fuera del alcance de quien guarda. `null` = se puede guardar. */
export const fueraDeSuCiudad = ({ ciudad, modalidades, antes }: AlcanceDeCiudad): FueraDeSuCiudad | null => {
  if (!ciudad) return null;
  const filas = comoSeGuardan(modalidades);
  const ciudades = ciudadesDe(filas);
  const sinCambio = Boolean(antes) && mismasEnOrden(ciudades, antes?.ciudades ?? []);
  const sinCiudad = sedesSinCiudad(filas);

  const r: FueraDeSuCiudad = {
    ciudades: sinCambio ? [] : ciudades.filter((c) => c !== ciudad),
    sedeSinCiudad:
      sinCiudad > 0 && !(sinCambio && sinCiudad <= sedesSinCiudad(comoSeGuardan(antes?.modalidades))),
  };
  return r.ciudades.length > 0 || r.sedeSinCiudad ? r : null;
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
 * otra ciudad, nombrada, o la sede sin ciudad) y qué hacer. No dice «permiso» ni
 * «error», a propósito: no es algo que se arregle saliendo y volviendo a entrar.
 *
 * `etiqueta` resuelve el slug al nombre que se ve en el desplegable; sin ella
 * —o para una ciudad que todavía no está en `/opciones/ciudad`— se usa `desSlug`.
 */
export const textoFueraDeSuCiudad = (
  fuera: FueraDeSuCiudad,
  ciudad: string,
  etiqueta: (slug: string) => string | undefined = () => undefined,
): string => {
  const nombre = (slug: string) => etiqueta(slug) ?? desSlug(slug);
  const suya = nombre(ciudad);
  const causas = [
    ...(fuera.ciudades.length > 0 ? [`tiene una sede en ${enumerar(fuera.ciudades.map(nombre))}`] : []),
    ...(fuera.sedeSinCiudad ? ['tiene una sede sin la ciudad cargada'] : []),
  ];
  return (
    `Tu cuenta carga actividades de ${suya}, y esta ${causas.join(' y ')}. ` +
    `Para guardarla, dejá solo sedes de ${suya}, con la ciudad elegida (o que sea virtual). ` +
    'Si la actividad es de otra ciudad, la tiene que cargar una cuenta de esa ciudad o el administrador.'
  );
};
