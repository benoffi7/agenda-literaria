import { huellaCreador } from '@/lib/huella';
import { normalize } from '@/lib/normalize';
import { slugify } from '@/lib/slugify';
import type { ValorOpcion } from '@/types/actividad';

/**
 * §4 — las reglas de taxonomía que **no** hablan con Firestore.
 *
 * Vive separado de `opciones.ts` a propósito: acá está la mitad del §4.2 que
 * corre en el cliente —el autocompletado y la deduplicación por slug antes de
 * escribir, la que evita que el 90 % de los duplicados nazca— y esa mitad
 * estaba escrita **dos veces**, en `TaxonomiaSelect` y en `TagsInput`, sin
 * ningún test y ya divergida (B-72). Un módulo puro se testea sin emulador y
 * sin testing-library, que es lo que faltaba.
 *
 * `opciones.ts` re-exporta lo que ya exportaba para que nadie tenga que
 * cambiar de import.
 */

/** Cuántas sugerencias se ofrecen. Una sola para los dos widgets (B-72). */
export const TOPE_SUGERENCIAS = 8;

/**
 * Orden del desplegable: primero las fijas por su `orden`, después las creadas
 * por "Otro" por frecuencia real de uso — mejor que alfabético (§4.3).
 */
export const ordenarValores = (valores: ValorOpcion[]): ValorOpcion[] =>
  [...valores].sort((a, b) => {
    if (a.fijo !== b.fijo) return a.fijo ? -1 : 1;
    if (a.fijo) return a.orden - b.orden;
    if (b.usos !== a.usos) return b.usos - a.usos;
    return a.label.localeCompare(b.label, 'es');
  });

/**
 * §4.3 — ¿la opción está validada? Las fijas lo están por definición: son las
 * base, las que puede haber cableadas en la lógica.
 *
 * **El campo ausente cuenta como aprobada, y eso es deliberado.** Los
 * documentos de `/opciones/*` que ya están en producción se escribieron antes
 * de que existiera `aprobada`, y `preparar-produccion.mjs` no los pisa (es
 * idempotente). Tratar la ausencia como "pendiente" haría desaparecer del
 * desplegable opciones que hoy se usan y que ya están guardadas en actividades
 * publicadas: el formulario mostraría el slug crudo en lugar de la etiqueta y
 * quien edite esa actividad tendría que volver a elegir un valor que ya estaba
 * bien.
 *
 * La regla general: un campo nuevo sobre documentos que ya existen se lee con
 * el default que preserva el comportamiento anterior. Solo lo nuevo arranca
 * pendiente, porque solo lo nuevo se escribe con el campo puesto.
 */
export const estaAprobada = (v: ValorOpcion): boolean => v.fijo || (v.aprobada ?? true);

/**
 * §4.3 — qué opciones puede elegir quien está mirando: las aprobadas, más las
 * que creó esa persona y todavía esperan validación.
 *
 * Sin `uid` devuelve solo las aprobadas. Ese es el caso del sitio público: el
 * `events.json` del §4.4 no debe publicar vocabulario sin validar.
 *
 * Ojo: esto filtra lo **elegible**, no lo que se puede *resolver*. La etiqueta
 * de un slug pendiente se sigue mostrando (en el formulario y en el calendario)
 * porque la actividad lo guardó legítimamente; esconderlo mostraría el slug
 * crudo, que se ve roto.
 */
export const opcionesVisibles = (valores: ValorOpcion[], uid?: string): ValorOpcion[] => {
  const huella = uid ? huellaCreador(uid) : '';
  return valores.filter(
    (v) => estaAprobada(v) || (huella !== '' && v.huellaCreador === huella),
  );
};

/**
 * B-05 — la etiqueta que se guarda, presentable.
 *
 * `slugify` normaliza la **identidad** de la opción; esto normaliza lo que se
 * **ve**. Sin esto, un tag tipeado "narrativa" se publica así en el calendario
 * y en los chips de filtro del sitio (§4.4), al lado de "Poesía" que alguien
 * escribió con mayúscula: la taxonomía se ve descuidada aunque no esté
 * duplicada. Ya pasó: `/opciones/tags` tiene `narrativa="narrativa"`.
 *
 * Solo la primera letra, y nada más. Bajar el resto rompería "Villa Crespo",
 * "Google Meet" o unas siglas; subir cada palabra rompería "Club de lectura".
 * Los espacios internos se colapsan porque "A  la   gorra" y "A la gorra"
 * comparten slug y tienen que compartir etiqueta.
 *
 * No toca las que ya están guardadas: eso se arregla renombrando desde la
 * pantalla de taxonomías (B-06).
 */
export const etiquetaPresentable = (label: string): string => {
  const limpio = label.trim().replace(/\s+/g, ' ');
  if (!limpio) return '';
  return limpio[0]!.toLocaleUpperCase('es') + limpio.slice(1);
};

export interface OpcionesDeSugerencias {
  /** Cuántas ofrecer. Default: `TOPE_SUGERENCIAS`. */
  tope?: number;
  /**
   * Qué mostrar con el input vacío. `true` (el desplegable: entrar a "Otro" es
   * un paso deliberado y la lista orienta) muestra las primeras `tope`;
   * `false` (el input de chips, siempre visible) no muestra nada, porque una
   * lista desplegada sin que nadie escriba tapa el formulario.
   */
  mostrarConTextoVacio?: boolean;
  /** Slugs ya elegidos, que no tiene sentido volver a ofrecer (caso `tags`). */
  excluir?: readonly string[];
}

/**
 * §4.2 — el autocompletado contra la lista existente: "si el usuario escribe
 * 'gor' y aparece 'A la gorra', el 90 % de los duplicados no llega a nacer".
 *
 * Recibe **elegibles**, no todos los valores: sugerir una opción pendiente de
 * otra cuenta ofrecería algo que esa persona no puede elegir (§4.3).
 *
 * Busca con `normalize` (sin acentos, sin mayúsculas) y no con `slugify`: se
 * compara contra lo que la persona está tipeando a mitad de camino, y
 * "poesia" tiene que encontrar "Poesía".
 */
export const sugerenciasPara = (
  texto: string,
  elegibles: ValorOpcion[],
  {
    tope = TOPE_SUGERENCIAS,
    mostrarConTextoVacio = false,
    excluir = [],
  }: OpcionesDeSugerencias = {},
): ValorOpcion[] => {
  const disponibles = excluir.length
    ? elegibles.filter((v) => !excluir.includes(v.slug))
    : elegibles;
  const q = normalize(texto.trim());
  if (!q) return mostrarConTextoVacio ? disponibles.slice(0, tope) : [];
  return disponibles.filter((v) => normalize(v.label).includes(q)).slice(0, tope);
};

export interface EtiquetaResuelta {
  /** El slug con el que se va a guardar. Vacío si no hay nada que guardar. */
  slug: string;
  /** La opción que ya existía con ese slug, si la había: se reusa, no se duplica. */
  coincidencia?: ValorOpcion;
  /** La etiqueta a persistir, solo cuando la opción es nueva. */
  labelNuevo?: string;
}

/**
 * §4.2 — qué hacer con un texto tipeado: "A la Gorra " → "a-la-gorra" → ya
 * existe → reusa, no duplica.
 *
 * Recibe **todos** los valores, no solo los elegibles: si la etiqueta ya
 * existe como opción pendiente de otra persona hay que reusar su slug igual.
 * La transacción del §4.2 lo haría de todas formas; resolverlo acá es lo que
 * permite avisarlo antes de guardar. La deduplicación gana: §4.2 es crítico.
 */
export const resolverEtiqueta = (texto: string, valores: ValorOpcion[]): EtiquetaResuelta => {
  const slug = slugify(texto);
  if (!slug) return { slug: '' };
  const coincidencia = valores.find((v) => v.slug === slug);
  return coincidencia
    ? { slug, coincidencia }
    : { slug, labelNuevo: etiquetaPresentable(texto) };
};

/**
 * Lo que se muestra a la derecha de una sugerencia: por qué esta opción está
 * acá. "sin aprobar" tiene prioridad sobre el uso porque es lo accionable
 * (§4.3): explica por qué la otra cuenta no la ve.
 */
export const pistaDeOpcion = (v: ValorOpcion): string => {
  if (!estaAprobada(v)) return 'sin aprobar';
  return v.usos > 0 ? `${v.usos} usos` : '';
};

/**
 * §4.3 — la etiqueta con su estado, para el desplegable y para los chips.
 * Marcar las propias sin aprobar no es decoración: si no, quien las creó no
 * tiene forma de entender por qué la otra cuenta no las ve.
 */
export const etiquetaConEstado = (v: ValorOpcion): string =>
  estaAprobada(v) ? v.label : `${v.label} (sin aprobar)`;
