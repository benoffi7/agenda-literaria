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
 * §4.3 · B-29 — ¿alcanza este reuso para aprobar la etiqueta?
 *
 * **La decisión del dueño es que sí, y con la etiqueta marcada.** Si la cuenta B
 * tipea en «Otro» una etiqueta que ya existe como pendiente de la cuenta A, hoy
 * se reusa el slug (§4.2) y la opción **sigue pendiente**: dos personas la usan y
 * ninguna la ve en su desplegable, que es el peor de los estados posibles.
 *
 * Que dos personas distintas escriban el mismo vocabulario es la mejor señal
 * automática de que el vocabulario es real. El contra que el ítem nombra —«y
 * alcanza con que la segunda persona repita el mismo typo»— es lo que resuelve la
 * **marca**: la etiqueta queda aprobada *y* señalada como aprobada sin que nadie
 * la mirara, así que el typo de dos se puede deshacer desde la pantalla de
 * taxonomías. Sin la marca, aprobar así sería indistinguible de una aprobación
 * humana y no habría por dónde revisarla.
 *
 * Las tres condiciones, y las tres son necesarias:
 *
 * 1. **Todavía no está aprobada.** Si ya lo está no hay nada que hacer, y volver
 *    a escribirla la marcaría «aprobada por reuso» cuando la aprobó una persona.
 * 2. **Se sabe de quién era.** Sin `huellaCreador` —los documentos anteriores a
 *    que el campo existiera— no se puede decir que la esté reusando *otra*
 *    cuenta: podría ser la misma persona, y ahí no hay ninguna señal. El borde lo
 *    nombra el propio ítem, y el default seguro es no aprobar.
 * 3. **Es otra cuenta.** Quien la creó reusando su propia etiqueta no agrega
 *    ninguna información: la señal es *dos personas*, no *dos veces*.
 *
 * Puro y sobre la huella, nunca sobre el uid: `/opciones/{campo}` es de lectura
 * pública (§5.3) y los uids no salen al público (§5.1, D-27). Quien llama pasa la
 * huella ya calculada, así que este módulo no puede recibir un uid por error.
 *
 * **Aprobar es también publicar, y conviene tenerlo escrito.** `opcionesPublicas`
 * filtra con `opcionesVisibles` sin uid, o sea que emite **las aprobadas**: una
 * etiqueta que aprueba esta regla entra al `events.json` y a los chips del sitio
 * aunque solo la usen borradores. El `label` es texto que tipeó una persona, y el
 * `events.json` ya cosechado no se despublica renombrando después — la marca es
 * lo que permite **corregirlo**, no lo que evita que salga. Hoy el daño residual
 * es chico y por dos razones que no hay que deducir: con B-131 nada nace
 * pendiente, así que esto solo alcanza a lo heredado, y una actividad publicada
 * con una opción pendiente ya mostraba su etiqueta igual (D-11, D-30).
 *
 * **No se mide, y es una decisión y no un olvido** (§9). «Cuántas etiquetas se
 * aprueban solas» es una pregunta razonable y hoy no la contesta nadie; si algún
 * día se mide, va como **un valor más del enum cerrado de `funcion_usada`** —al
 * lado de `taxonomia-nueva` y `taxonomia-reusada`— y **nunca la etiqueta**, que
 * es contenido tipeado por una persona.
 */
export const elReusoLaAprueba = (v: ValorOpcion, huellaDeQuienLaUsa: string): boolean =>
  !estaAprobada(v) &&
  Boolean(v.huellaCreador) &&
  Boolean(huellaDeQuienLaUsa) &&
  v.huellaCreador !== huellaDeQuienLaUsa;

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
