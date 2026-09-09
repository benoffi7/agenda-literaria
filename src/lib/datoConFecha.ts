/**
 * **El dato que envejece** — B-837, y el mecanismo compartido de DEC-12.
 *
 * ── Qué problema resuelve ──────────────────────────────────────────────────
 * Hay datos que el proyecto va a publicar y que **nadie va a mantener al día**:
 * las promos bancarias de una librería (`prd/02-librerias.md` § 6) y el precio de
 * una suscripción (`prd/03-suscripciones-literarias.md` § 6). El dueño lo dudó en
 * los dos pedidos con la misma frase —«porque puede cambiar»— y la duda es la
 * correcta, pero el problema real es peor que la ausencia: es **cuando está y ya
 * no es cierto**. «30 % con Banco Ciudad los martes» tres meses después de que se
 * cortó no es un dato viejo, es información equivocada, y la paga la librería con
 * alguien que fue al local por eso.
 *
 * Los dos casos son **el mismo problema**, así que van con un solo mecanismo. Las
 * tres reglas salen de los PRDs y las tres están acá abajo, cada una escrita como
 * una propiedad del módulo y no como una recomendación:
 *
 * 1. **La fecha se muestra siempre que se muestra el dato.** Lo sostiene la forma
 *    de `fraseConFecha`, que devuelve **un solo string** con las dos cosas: no hay
 *    ninguna función acá que devuelva el valor solo, así que no hay forma de
 *    mostrar uno sin el otro. Y la vuelta que importa: **sin fecha usable no se
 *    muestra el dato**, no al revés.
 * 2. **Nunca entra a un filtro, a un orden ni a un `Offer`.** Filtrar por precio
 *    afirma que los precios son comparables, y no lo son si uno tiene una semana y
 *    otro cuatro meses. La proyección pública de un dato con fecha es **la frase**,
 *    o sea un string como «$18.000 por mes · cargado el 24 de septiembre de 2026»,
 *    que es inservible como número: la regla la impone la forma y no la disciplina
 *    (D-570).
 * 3. **El panel avisa a los `DIAS_PARA_REVISAR` días.** `pideRevision` es el
 *    predicado; contar y pintar el número es del panel, con el patrón del badge de
 *    pendientes que ya existe.
 *
 * ── Por qué la fecha es absoluta y lleva el año ────────────────────────────
 * «cargado hace tres meses» se lee mejor, y en este sitio **no se puede**: las
 * páginas son estáticas (§2.3) y se rebuildean cuando cambia un dato, no cuando
 * pasa el tiempo, así que una frase relativa horneada en el HTML envejece sola y
 * termina afirmando algo falso con cara de cierto — que es exactamente el daño que
 * este módulo existe para evitar. Una fecha absoluta no envejece nunca.
 *
 * Y lleva el **año** aunque para un dato reciente sea ruido: el único trabajo de
 * esta fecha es dejar que quien lee decida si le cree, y «cargado el 24 de
 * septiembre» sin año no lo deja decidir nada. Es la misma razón por la que va
 * `fechaCompleta` y no un `12/09`.
 */
import { fechaCompleta } from '@/lib/fechasPublicas';
import type { TimestampLike } from '@/types/actividad';

/**
 * Un valor y **cuándo se cargó**, juntos en el documento.
 *
 * Los dos campos son obligatorios en el tipo a propósito: un `cargadoEn`
 * opcional invierte el default y deja que el próximo campo nazca sin fecha. Lo
 * que sí puede faltar es el dato entero (`DatoConFecha<string> | null`), que es
 * como lo declaran las entidades que lo usan.
 */
export interface DatoConFecha<T> {
  valor: T;
  cargadoEn: TimestampLike;
}

/**
 * A los cuántos días el panel pide revisar el dato.
 *
 * Es el número de los dos PRDs. Vive acá y no repetido en cada pantalla: el
 * aviso de una librería y el de una suscripción no pueden querer decir cosas
 * distintas por «viejo».
 */
export const DIAS_PARA_REVISAR = 60;

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * La fecha del dato como `Date`, o `null` si no hay una usable.
 *
 * Los documentos vienen de Firestore y el `cargadoEn` puede llegar ausente, en
 * `null` o como un string —un documento anterior al campo, una escritura de un
 * script, una restauración desde el historial—. El tipo no alcanza para eso, así
 * que la guarda es de runtime: `toDate()` sobre lo que no es un `Timestamp` tira,
 * y acá tirar sería peor que no mostrar nada (misma decisión que el `catch` de
 * `issuesDelDocumento` en `historial.ts`).
 */
const fechaDe = <T>(dato: DatoConFecha<T> | null | undefined): Date | null => {
  const t = dato?.cargadoEn;
  if (!t || typeof t.toDate !== 'function') return null;
  try {
    const d = t.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
};

/**
 * **La única salida de un dato con fecha:** un string con el valor y la fecha,
 * o vacío.
 *
 * `formatear` es de quien lo usa —«$18.000 por mes», el texto de las promos— y
 * este módulo no sabe nada del valor. Lo que decide acá es que las dos cosas
 * salen pegadas o no sale ninguna:
 *
 * - sin dato → `''`;
 * - **sin fecha usable → `''` también**, y esta es la mitad que importa: un valor
 *   sin su fecha es justo lo que no se puede publicar, así que el dato huérfano
 *   desaparece en vez de salir solo;
 * - con un `formatear` que devuelve vacío → `''`, para no publicar una fecha
 *   suelta que no fecha nada.
 *
 * El `·` es el separador del sitio (`tarjetaPublica.ts`), no uno nuevo.
 */
export const fraseConFecha = <T>(
  dato: DatoConFecha<T> | null | undefined,
  formatear: (valor: T) => string,
): string => {
  if (!dato) return '';
  const cuando = fechaDe(dato);
  if (!cuando) return '';
  const texto = formatear(dato.valor).trim();
  if (!texto) return '';
  return `${texto} · cargado el ${fechaCompleta(cuando)}`;
};

/**
 * Cuántos días pasaron desde la carga, o `null` si no hay fecha usable.
 *
 * `ahora` se recibe y no se lee del reloj: es lo que hace que esto sea puro y
 * testeable sin viajar en el tiempo, y el resto del repo lo hace igual. Se
 * redondea **para abajo**, así que «60 días» son 60 días cumplidos.
 *
 * Una carga con fecha futura da un número negativo y no `0`: el panel tiene que
 * poder ver que el dato está mal, no que está fresco.
 */
export const diasDesdeLaCarga = <T>(
  dato: DatoConFecha<T> | null | undefined,
  ahora: Date,
): number | null => {
  const cuando = fechaDe(dato);
  if (!cuando) return null;
  return Math.floor((ahora.getTime() - cuando.getTime()) / UN_DIA);
};

/**
 * ¿El panel tiene que pedir que se revise este dato?
 *
 * **Un dato sin fecha usable también pide revisión**, y no es un detalle: es el
 * único caso en que el sitio no lo está publicando (`fraseConFecha` lo devuelve
 * vacío), o sea que sin este aviso el dato quedaría cargado, invisible y sin que
 * nadie se enterara.
 */
export const pideRevision = <T>(
  dato: DatoConFecha<T> | null | undefined,
  ahora: Date,
): boolean => {
  if (!dato) return false;
  const dias = diasDesdeLaCarga(dato, ahora);
  return dias === null || dias >= DIAS_PARA_REVISAR;
};
