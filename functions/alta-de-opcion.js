/**
 * **El alta de una opción de taxonomía, sin Firestore** — §4.2, §4.3, B-893.
 *
 * Es la decisión entera de «alguien tipeó una etiqueta en "Otro…"»: reusar por
 * slug o agregar un elemento, sumar el uso, aprobar por reuso (B-29), y —la
 * parte que existe por B-893— **verificar que lo único que cambió del array es
 * ese elemento**. La corren dos caminos, y ése es el punto de que viva acá:
 *
 * | Quién | Por dónde | `aprobada` al nacer |
 * |---|---|---|
 * | el admin | `upsertOpcion` (`src/lib/opciones.ts`), transacción del cliente | `true` (B-131) |
 * | el publicador | la callable `crearOpcionDelPanel` (`alta-de-opcion-trigger.js`), Admin SDK | `false` |
 *
 * Con la transformación copiada en los dos, el día que una cambiara la forma
 * del elemento —un campo más, otro `orden`— la otra seguiría escribiendo la
 * vieja, y el panel mostraría dos clases de etiqueta sin que nada falle: la clase
 * de B-72. Vive en `functions/` y no en `src/` porque la Function no puede
 * importar `src/` (D-20); `src/lib/opciones.ts` y `src/lib/taxonomia.ts` la
 * toman de acá, igual que `slugify`.
 *
 * ── Por qué la verificación y no confiar en la transformación ─────────────
 * Porque las reglas **no pueden** hacerla (`firestore.rules`, `/opciones`): a
 * nivel de regla, «agrega una opción con Otro» y «reescribe la taxonomía del
 * sitio entero» son el mismo permiso. Con el Admin SDK las reglas ni se evalúan,
 * así que la Function es **el único lugar** donde «el publicador solo agregó un
 * elemento, sin aprobar, con `usos: 1`» se puede afirmar. `cambioInesperado`
 * lo afirma **mirando el resultado**, no volviendo a correr la transformación:
 * una verificación que recalcula lo mismo que verifica aprueba cualquier bug de
 * la transformación.
 *
 * **No importa nada que no sea de `functions/`.** El panel la trae a su bundle
 * (a través de `taxonomia.ts`), así que un `firebase-admin` acá terminaría en el
 * navegador (§5.4, trampa 4).
 */
import { etiquetaPresentable } from './etiqueta-presentable.js';
import { slugify } from './slugify.js';

/**
 * La forma mínima de un elemento de `/opciones/{campo}.valores` que esta
 * lógica mira. El tipo completo es `ValorOpcion` (`src/types/actividad.ts`); acá
 * se declara solo lo que se lee, y el resto de los campos (`tono`, …) viaja
 * intacto en los spreads.
 *
 * @typedef {{
 *   slug: string,
 *   label: string,
 *   orden: number,
 *   fijo: boolean,
 *   usos: number,
 *   aprobada?: boolean,
 *   aprobadaPorReuso?: boolean,
 *   huellaCreador?: string,
 *   tono?: number,
 * }} Valor
 */

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
 *
 * @param {Valor} v
 * @returns {boolean}
 */
export const estaAprobada = (v) => v.fijo || (v.aprobada ?? true);

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
 * lo que permite **corregirlo**, no lo que evita que salga. El daño residual es
 * chico por una razón que no hay que deducir: una actividad publicada con una
 * opción pendiente ya mostraba su etiqueta igual (D-11, D-30). Con B-131 lo del
 * admin nace aprobado, así que desde B-893 lo que esta regla alcanza en la
 * práctica es **lo que crea un publicador** (nace pendiente) cuando lo tipea una
 * segunda cuenta — el caso que B-29 dejaba «del otro lado del mismo camino».
 *
 * **No se mide, y es una decisión y no un olvido** (§9). «Cuántas etiquetas se
 * aprueban solas» es una pregunta razonable y hoy no la contesta nadie; si algún
 * día se mide, va como **un valor más del enum cerrado de `funcion_usada`** —al
 * lado de `taxonomia-nueva` y `taxonomia-reusada`— y **nunca la etiqueta**, que
 * es contenido tipeado por una persona.
 *
 * @param {Valor} v
 * @param {string} huellaDeQuienLaUsa
 * @returns {boolean}
 */
export const elReusoLaAprueba = (v, huellaDeQuienLaUsa) =>
  !estaAprobada(v) &&
  Boolean(v.huellaCreador) &&
  Boolean(huellaDeQuienLaUsa) &&
  v.huellaCreador !== huellaDeQuienLaUsa;

// ─────────────────────────────────────────────────────────────────────
// La transformación: reusar o agregar
// ─────────────────────────────────────────────────────────────────────

/**
 * El `orden` de toda opción creada con «Otro». Las fijas tienen el suyo (1, 2,
 * 3…); las creadas se ordenan por `usos` (`ordenarValores`), así que este número
 * solo tiene que ser mayor que el de cualquier fija.
 */
export const ORDEN_DE_LA_CREADA = 99;

/**
 * Lo que hace falta para dar de alta una etiqueta.
 *
 * `aprobada` **no tiene default a propósito**: es la única diferencia entre los
 * dos caminos (el admin `true` por B-131, el publicador `false` por B-893), y un
 * default acá haría que el camino que se olvide de pasarlo herede la decisión del
 * otro sin que nadie lo vea en el diff.
 *
 * @typedef {{ slug: string, label: string, huella: string, aprobada: boolean }} Alta
 */

/**
 * El elemento nuevo, con **exactamente** estos siete campos. `cambioInesperado`
 * exige el mismo conjunto, así que un campo que se agregue acá sin pasar por allá
 * pone la verificación en rojo en vez de colarse en el array de todo el sitio.
 *
 * @param {Alta} alta
 * @returns {Valor}
 */
export const opcionNueva = ({ slug, label, huella, aprobada }) => ({
  slug,
  label: etiquetaPresentable(label),
  orden: ORDEN_DE_LA_CREADA,
  fijo: false,
  usos: 1,
  aprobada,
  huellaCreador: huella,
});

/**
 * §4.2 — «antes de crear, buscar si ya existe por slug».
 *
 * Si existe: le suma un uso y, si la creó **otra** cuenta y estaba pendiente, la
 * aprueba y la marca (B-29) — todo en el mismo `map`, adentro de la transacción
 * de quien llame, que es lo que evita la carrera contra el guardado simultáneo.
 * Reusar **nunca** cambia el autor ni el label.
 *
 * Si no existe: agrega **un** elemento al final.
 *
 * Devuelve arrays nuevos; no toca el que recibe.
 *
 * @param {readonly Valor[]} valores
 * @param {Alta} alta
 * @returns {{ valores: Valor[], creada: boolean }}
 */
export const valoresConLaEtiqueta = (valores, alta) => {
  const existe = valores.some((v) => v.slug === alta.slug);
  if (!existe) return { valores: [...valores, opcionNueva(alta)], creada: true };

  /** @param {Valor} v @returns {Valor} */
  const conElUso = (v) => {
    const sumado = { ...v, usos: (v.usos ?? 0) + 1 };
    return elReusoLaAprueba(v, alta.huella)
      ? { ...sumado, aprobada: true, aprobadaPorReuso: true }
      : sumado;
  };
  return {
    valores: valores.map((v) => (v.slug === alta.slug ? conElUso(v) : v)),
    creada: false,
  };
};

// ─────────────────────────────────────────────────────────────────────
// La verificación: lo único que cambió es ese elemento
// ─────────────────────────────────────────────────────────────────────

/**
 * Igualdad estructural de valores de Firestore ya leídos (maps, arrays,
 * escalares). **Sin importar el orden de las claves** —el Admin SDK no promete
 * conservarlo—, que es por lo que no alcanza un `JSON.stringify`.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export const iguales = (a, b) => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => iguales(x, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = /** @type {Record<string, unknown>} */ (a);
  const rb = /** @type {Record<string, unknown>} */ (b);
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && iguales(ra[k], rb[k]));
};

/** Los campos que el alta puede tocar de un elemento que ya existía. */
const TOCABLES_AL_REUSAR = ['usos', 'aprobada', 'aprobadaPorReuso'];

/** @param {Valor} v */
const sinTocables = (v) =>
  Object.fromEntries(Object.entries(v).filter(([k]) => !TOCABLES_AL_REUSAR.includes(k)));

/** Las claves que tiene que tener, y solo ellas, un elemento recién creado. */
const CLAVES_DE_LA_NUEVA = ['aprobada', 'fijo', 'huellaCreador', 'label', 'orden', 'slug', 'usos'];

/**
 * **La verificación de B-893**: dado el array antes y el que se va a escribir,
 * ¿lo único que cambió es el elemento de `alta.slug`, y cambió como un alta tiene
 * permitido cambiarlo? Devuelve el motivo si no, o `null` si está bien.
 *
 * Lo que un alta tiene permitido, y nada más:
 *
 * - **Crear**: el array crece en uno, todos los anteriores quedan idénticos y en
 *   el mismo orden, y el último es el elemento nuevo con sus siete campos exactos
 *   —`usos: 1`, `fijo: false`, `orden: 99`, `aprobada` igual a lo pedido (para el
 *   publicador, `false`) y la huella de quien llama—.
 * - **Reusar**: el largo no cambia, los elementos de otro slug quedan idénticos,
 *   y el de ese slug solo cambia en `usos` (exactamente +1) y, si B-29 lo
 *   permite, en `aprobada: true` + `aprobadaPorReuso: true`. Ni el label, ni
 *   `fijo`, ni la huella del autor.
 *
 * Mira **el resultado**, no la transformación: no llama a `valoresConLaEtiqueta`.
 * Por eso ataja un bug de la transformación en vez de aprobarlo.
 *
 * @param {readonly Valor[]} antes
 * @param {readonly Valor[]} despues
 * @param {Alta} alta
 * @returns {string | null}
 */
export const cambioInesperado = (antes, despues, alta) => {
  const existia = antes.some((v) => v.slug === alta.slug);

  if (!existia) {
    if (despues.length !== antes.length + 1) {
      return `el alta tenía que agregar un elemento y el largo pasó de ${antes.length} a ${despues.length}`;
    }
    const cambiado = antes.findIndex((v, i) => !iguales(v, despues[i]));
    if (cambiado !== -1) return `el alta tocó un elemento que ya estaba («${antes[cambiado].slug}»)`;

    const nueva = /** @type {Valor} */ (despues[despues.length - 1]);
    const claves = Object.keys(nueva).sort();
    if (!iguales(claves, CLAVES_DE_LA_NUEVA)) {
      return `el elemento nuevo tiene los campos [${claves.join(', ')}] y no los del alta`;
    }
    if (nueva.slug !== alta.slug) return 'el elemento nuevo no tiene el slug pedido';
    if (typeof nueva.label !== 'string' || slugify(nueva.label) !== alta.slug) {
      return 'la etiqueta del elemento nuevo no corresponde a su slug';
    }
    if (nueva.orden !== ORDEN_DE_LA_CREADA) return 'el elemento nuevo no tiene el orden de una creada';
    if (nueva.fijo !== false) return 'el elemento nuevo nació fijo';
    if (nueva.usos !== 1) return `el elemento nuevo nació con ${nueva.usos} usos`;
    if (nueva.aprobada !== alta.aprobada) {
      return `el elemento nuevo nació con aprobada=${nueva.aprobada} y se pidió ${alta.aprobada}`;
    }
    if (!alta.huella || nueva.huellaCreador !== alta.huella) {
      return 'el elemento nuevo no lleva la huella de quien lo creó';
    }
    return null;
  }

  /*
   * Un slug repetido es un documento que alguien editó a mano: el §4.2 existe
   * para que no pase. Reusar tocaría **las dos** copias, cada una con un cambio
   * permitido, y escribir eso sería propagar la basura con el sello de la
   * verificación puesto.
   */
  if (antes.filter((v) => v.slug === alta.slug).length > 1) {
    return `el slug «${alta.slug}» está repetido en la lista`;
  }
  if (despues.length !== antes.length) {
    return `reusar no cambia el largo, y pasó de ${antes.length} a ${despues.length}`;
  }
  for (let i = 0; i < antes.length; i += 1) {
    const a = antes[i];
    const d = despues[i];
    if (a.slug !== alta.slug) {
      if (!iguales(a, d)) return `el alta tocó un elemento que no era el suyo («${a.slug}»)`;
      continue;
    }
    if (!iguales(sinTocables(a), sinTocables(d))) {
      return `reusar «${a.slug}» le cambió algo más que el uso y la aprobación`;
    }
    if (d.usos !== (a.usos ?? 0) + 1) {
      return `reusar «${a.slug}» tenía que sumar un uso y pasó de ${a.usos} a ${d.usos}`;
    }
    const mismaAprobacion = d.aprobada === a.aprobada && d.aprobadaPorReuso === a.aprobadaPorReuso;
    const aprobadaPorReuso =
      elReusoLaAprueba(a, alta.huella) && d.aprobada === true && d.aprobadaPorReuso === true;
    if (!mismaAprobacion && !aprobadaPorReuso) {
      return `reusar «${a.slug}» le cambió la aprobación sin que B-29 lo permita`;
    }
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────
// El pedido de la callable
// ─────────────────────────────────────────────────────────────────────

/**
 * **Los campos en los que la callable acepta crear** — los del formulario de
 * una actividad que ofrecen «Otro…».
 *
 * Es una lista blanca y no «cualquier `CAMPOS_TAXONOMIA`» por lo mismo que las
 * pantallas de `rolDelPanel.ts` arrancan cerradas: el publicador solo carga
 * actividades (las guías son de admin, D-650), así que un documento de
 * `/opciones/*` que ese formulario no usa no tiene por qué ser escribible por
 * esta puerta.
 *
 * **`provincia` no está, y es a propósito** (B-972): las 24 jurisdicciones son
 * un vocabulario cerrado y el schema rechaza cualquier otra. El test la ata
 * contra el fuente de los formularios: todo `campo=` con «Otro…» del formulario
 * de actividad tiene que estar acá, y ninguno con `permitirOtro={false}`.
 */
export const CAMPOS_CREABLES_POR_FUNCTION = [
  'arancel',
  'tipo',
  'barrio',
  'ciudad',
  'plataforma',
  'tags',
  'incluye-actividad',
];

/**
 * El largo máximo de una etiqueta tipeada. No hay otro tope en el proyecto; éste
 * existe porque del otro lado de la callable no hay formulario que corte, y una
 * etiqueta termina en un documento que el sitio entero lee (§4.4). Holgado:
 * «Centro Cultural de la Memoria Haroldo Conti» tiene 43.
 */
export const LARGO_MAXIMO_DE_ETIQUETA = 80;

/**
 * Cuántas etiquetas **pendientes** puede tener una misma cuenta en un mismo
 * campo. Es el freno al volumen: sin esto, un script con una sesión de
 * publicador engorda el documento de un campo hasta el límite de 1 MiB de
 * Firestore —y ese documento se lee en cada formulario y en cada build—. Nadie
 * que cargue actividades llega a 25 etiquetas sin revisar en un mismo campo: si
 * pasa, lo que hace falta es que el admin apruebe, y el mensaje lo dice.
 */
export const TOPE_DE_PENDIENTES_POR_CUENTA = 25;

/**
 * Un rechazo con el código de `HttpsError` y un mensaje escrito para quien carga.
 *
 * `motivo` solo lo trae el rechazo de la verificación, y es para el log.
 *
 * @typedef {{ codigo: 'invalid-argument' | 'failed-precondition' | 'resource-exhausted' | 'internal', message: string, motivo?: string }} Rechazo
 */

/**
 * Valida el cuerpo de la llamada. No confía en nada del cliente: el `slug` se
 * **deriva** acá con el `slugify` compartido (§4.2, trampa 6) y no se acepta
 * uno que venga armado.
 *
 * @param {unknown} datos
 * @returns {{ pedido: { campo: string, label: string, slug: string }, rechazo?: undefined } | { pedido?: undefined, rechazo: Rechazo }}
 */
export const validarPedidoDeOpcion = (datos) => {
  const d = /** @type {Record<string, unknown>} */ (
    datos && typeof datos === 'object' ? datos : {}
  );
  const { campo, label } = d;
  if (typeof campo !== 'string' || !CAMPOS_CREABLES_POR_FUNCTION.includes(campo)) {
    return {
      rechazo: {
        codigo: 'invalid-argument',
        message: 'En esa lista no se pueden agregar opciones desde acá.',
      },
    };
  }
  if (typeof label !== 'string') {
    return { rechazo: { codigo: 'invalid-argument', message: 'Falta la etiqueta.' } };
  }
  const limpio = label.trim();
  if (limpio.length > LARGO_MAXIMO_DE_ETIQUETA) {
    return {
      rechazo: {
        codigo: 'invalid-argument',
        message: `La etiqueta es muy larga: hasta ${LARGO_MAXIMO_DE_ETIQUETA} caracteres.`,
      },
    };
  }
  const slug = slugify(limpio);
  if (!slug) {
    return {
      rechazo: {
        codigo: 'invalid-argument',
        message: 'La etiqueta quedó vacía: escribí al menos una letra o un número.',
      },
    };
  }
  return { pedido: { campo, label: limpio, slug } };
};

/**
 * El rol de quien llama, a partir de los claims del token.
 *
 * **El publicador gana cuando están los dos**, por paridad con `esAdmin()` de
 * `firestore.rules` y con `rolDeClaims` de `src/lib/rolDelPanel.ts` — el test
 * corre las dos contra la misma tabla, porque son dos derivaciones del mismo dato
 * en dos runtimes (clase de B-88). Si acá el admin ganara, una cuenta que las
 * reglas tratan como acotada crearía etiquetas **aprobadas**.
 *
 * @param {Record<string, unknown> | null | undefined} claims
 * @returns {'admin' | 'publicador' | null}
 */
export const rolDeLaSesion = (claims) => {
  if (claims?.publicador === true) return 'publicador';
  if (claims?.admin === true) return 'admin';
  return null;
};

/**
 * **La decisión entera de la callable**, sobre el array ya leído: lo que se
 * escribe, o por qué no.
 *
 * - Sin documento (`null`) → se rechaza. Sembrar las base desde acá obligaría a
 *   la Function a tener su propia copia de `opciones-base.json`, que vive en
 *   `src/`; y crear el documento **solo** con la etiqueta nueva sería peor: el
 *   primer `upsertOpcion` del admin vería el documento existente y nunca
 *   sembraría las base. En producción los documentos existen
 *   (`npm run opciones:sembrar:prod`), así que esto es la red, no un camino.
 * - Etiqueta nueva de alguien que ya tiene el tope de pendientes en el campo →
 *   se rechaza. Reusar no suma elementos, así que no cuenta contra el tope.
 * - Si no, la transformación compartida, y **antes de devolverla** la
 *   verificación: si `cambioInesperado` encuentra algo, no se escribe nada.
 *
 * @param {readonly Valor[] | null} valores
 * @param {Alta} alta
 * @returns {{ valores: Valor[], creada: boolean, rechazo?: undefined } | { valores?: undefined, creada?: undefined, rechazo: Rechazo }}
 */
export const decidirAlta = (valores, alta) => {
  if (valores === null) {
    return {
      rechazo: {
        codigo: 'failed-precondition',
        message:
          'Esa lista todavía no está preparada, así que no se le pueden agregar opciones. ' +
          'Avisale a quien administra el sitio.',
      },
    };
  }

  const existe = valores.some((v) => v.slug === alta.slug);
  const pendientesPropias = valores.filter(
    (v) => !estaAprobada(v) && Boolean(alta.huella) && v.huellaCreador === alta.huella,
  ).length;
  if (!existe && !alta.aprobada && pendientesPropias >= TOPE_DE_PENDIENTES_POR_CUENTA) {
    return {
      rechazo: {
        codigo: 'resource-exhausted',
        message:
          `Ya tenés ${pendientesPropias} opciones nuevas en esta lista esperando que las ` +
          'revisen. Elegí una de la lista o pedí que aprueben las que creaste.',
      },
    };
  }

  const resultado = valoresConLaEtiqueta(valores, alta);
  const motivo = cambioInesperado(valores, resultado.valores, alta);
  if (motivo) {
    /*
     * El motivo va aparte y no en el mensaje: es para el log de la Function
     * (quien lo lee es quien programa), y a quien carga no le dice nada
     * accionable. El mensaje sí: reintentar es razonable, porque la verificación
     * corre sobre una lectura transaccional y un array que cambió en el medio se
     * relee entero.
     */
    return {
      rechazo: {
        codigo: 'internal',
        message:
          'No se pudo agregar la opción. Probá de nuevo; si sigue pasando, avisale a quien ' +
          'administra el sitio.',
        motivo,
      },
    };
  }
  return resultado;
};
