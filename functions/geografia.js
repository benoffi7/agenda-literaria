/**
 * **La geografía de una sede: provincia, y de ahí barrio o ciudad** — B-950.
 *
 * Hasta acá el par vivía suelto: `barrio` era taxonomía (`/opciones/barrio`, §4)
 * y `ciudad` era un `<input>` de texto libre. La asimetría ya había mordido una
 * vez —`ciudades.mjs` existe porque «Mar del Plata», «mar del plata» y « Mar del
 * Plata » son tres strings distintos— y volvía a morder en cuanto había que
 * ofrecer una cascada: no se puede desplegar «las ciudades de esta provincia»
 * sobre un campo donde cada persona escribe lo que quiere.
 *
 * Lo que decidió el dueño, y lo que este módulo implementa:
 *
 *  - **`provincia` existe** y es taxonomía (`/opciones/provincia`), sembrada con
 *    las 24 jurisdicciones como `fijo: true`. Es un conjunto que no crece, pero
 *    va por el mecanismo del §4 igual que las demás: así hereda el desplegable,
 *    la deduplicación por slug, la pantalla que las administra y el orden por
 *    `usos`, en vez de reimplementar las cuatro cosas (la clase de B-72).
 *  - **`ciudad` pasa a ser taxonomía** (`/opciones/ciudad`), con lo que eso
 *    arrastra: slug, aprobación y `usos`. Es lo que hace expresable la cascada, y
 *    lo que le da al hub de ciudad (B-951) la misma puerta de «aprobada» con la
 *    que el hub de barrio se defiende de publicar un typo como URL indexada.
 *  - **La cascada es de dos niveles, no de tres**: «provincia → barrio *o*
 *    ciudad». CABA de un lado, porque es ciudad y provincia a la vez y su
 *    subdivisión útil es el barrio; toda otra provincia del otro, donde lo que
 *    subdivide es la ciudad. El modelo de tres niveles —CABA como una provincia
 *    con una sola ciudad que a su vez tiene barrios— agrega un paso vacío al
 *    100 % de los casos de CABA, que hoy son casi todos.
 *
 * ── CABA se **guarda** con ciudad, y solo se **esconde** al mostrarla ──────
 * Una sede en CABA queda con `provincia: 'caba'` **y** `ciudad: 'caba'`, aunque
 * el formulario no la pregunte: la completa la cascada. No es redundancia, es lo
 * que evita un agujero que ya está pago:
 *
 *  - `ciudades[]` en la raíz del documento (B-919, D-690) es lo que hace
 *    expresable el alcance por ciudad del rol `publicador`. Si CABA quedara con
 *    la ciudad vacía, **ninguna actividad de CABA entraría en el alcance de
 *    ningún publicador** — y CABA es casi todo el catálogo.
 *  - El eje `ciudad` del listado, el banner de B-961 y el hub de B-951 leen
 *    `sede.ciudad`. Con el campo vacío los tres dejarían de ver CABA, y ninguno
 *    se pondría en rojo.
 *
 * Que en CABA no se diga «Boedo, Ciudad Autónoma de Buenos Aires, CABA» es una
 * regla de **presentación**, y por eso vive en `piezasDeLugar()` acá abajo: una
 * sola función que usan la ficha pública, la tarjeta del panel y el JSON-LD, en
 * vez de un `if` repetido en cada plantilla (B-953 lo pide con todas las letras).
 *
 * ── Por qué esto vive en `functions/` y no en `src/lib/` ──────────────────
 * Porque son **tres** runtimes los que tienen que derivar exactamente lo mismo,
 * y uno de ellos no puede importar hacia arriba:
 *
 *  - el **panel y el sitio** (`src/`), que escriben y proyectan el documento;
 *  - los **scripts de node** (`scripts/sembrar-geografia.mjs`), que hacen el
 *    backfill — por eso es un `.js` plano y no un `.ts`;
 *  - y la **Function de Calendar**, que se despliega con su propio
 *    `package.json` y **no puede importar `src/`**.
 *
 * Ese tercero es el que decide dónde vive el archivo: si estuviera en `src/lib/`,
 * `functions/calendario.js` tendría que reimplementar la normalización, y el
 * síntoma de que las dos copias se separaran sería la misma sede diciendo una
 * cosa en el sitio y otra en el calendario público (B-968). Es el mismo reparto
 * que `@calendario`, `@historial` y `@png-chunks-seguros`: **una implementación,
 * tres runtimes**.
 *
 * `src/lib/geografia.mjs` sigue existiendo y reexporta esto, así que ningún
 * import de `src/` ni de `scripts/` cambió.
 */
import { slugify } from './slugify.js';

/**
 * Lo único que estas funciones miran de una sede. Se declara así —y no como el
 * `Sede` de `types/actividad.ts`— porque el mismo par vive en cuatro entidades
 * (una actividad, una librería, un lugar, y lo que venga después) y las cuatro
 * comparten esta lógica: pedir el tipo completo la ataría a una sola.
 *
 * @typedef {object} SedeGeografica
 * @property {string} [provincia]
 * @property {string} [ciudad]
 * @property {string} [barrio]
 */

/**
 * El slug de CABA. Nombrado y exportado y no tipeado en cada consumidor: es el
 * único valor de esta taxonomía que la lógica cablea —toda la cascada se bifurca
 * acá—, así que es exactamente el caso del §4.3 («las fijas son las que puede
 * haber cableadas en la lógica») y el de `SLUG_PLATAFORMA_A_CONFIRMAR`.
 */
export const SLUG_CABA = 'caba';

/**
 * Las 24 jurisdicciones, en el orden en que se ofrecen.
 *
 * **CABA y Buenos Aires primero, y no es alfabético**: es lo que pidió el dueño
 * («provincia primero, CABA y Buenos Aires») y es donde está el catálogo. El
 * resto sí va alfabético, que es lo único defendible cuando ninguna tiene más
 * derecho que otra. El `orden` que se siembra sale de esta posición, así que
 * mover una fila acá mueve el desplegable.
 *
 * Son `fijo: true` por el §4.3: no se borran ni se renombran desde la pantalla de
 * taxonomías. Una provincia que se pueda borrar deja las sedes que la usaban
 * mostrando el slug crudo.
 */
export const PROVINCIAS = [
  { slug: SLUG_CABA, label: 'Ciudad Autónoma de Buenos Aires' },
  { slug: 'buenos-aires', label: 'Buenos Aires' },
  { slug: 'catamarca', label: 'Catamarca' },
  { slug: 'chaco', label: 'Chaco' },
  { slug: 'chubut', label: 'Chubut' },
  { slug: 'cordoba', label: 'Córdoba' },
  { slug: 'corrientes', label: 'Corrientes' },
  { slug: 'entre-rios', label: 'Entre Ríos' },
  { slug: 'formosa', label: 'Formosa' },
  { slug: 'jujuy', label: 'Jujuy' },
  { slug: 'la-pampa', label: 'La Pampa' },
  { slug: 'la-rioja', label: 'La Rioja' },
  { slug: 'mendoza', label: 'Mendoza' },
  { slug: 'misiones', label: 'Misiones' },
  { slug: 'neuquen', label: 'Neuquén' },
  { slug: 'rio-negro', label: 'Río Negro' },
  { slug: 'salta', label: 'Salta' },
  { slug: 'san-juan', label: 'San Juan' },
  { slug: 'san-luis', label: 'San Luis' },
  { slug: 'santa-cruz', label: 'Santa Cruz' },
  { slug: 'santa-fe', label: 'Santa Fe' },
  { slug: 'santiago-del-estero', label: 'Santiago del Estero' },
  { slug: 'tierra-del-fuego', label: 'Tierra del Fuego' },
  { slug: 'tucuman', label: 'Tucumán' },
];

/**
 * La única ciudad que se siembra: CABA.
 *
 * Las demás las crea quien carga, con «Otro», igual que los barrios
 * (`/opciones/barrio` también arranca vacío). Ésta va sembrada porque **no la
 * tipea nadie**: la pone la cascada sola al elegir la provincia, así que si no
 * existiera como opción el desplegable mostraría el slug crudo.
 */
export const CIUDADES_FIJAS = [
  { slug: SLUG_CABA, label: 'Ciudad Autónoma de Buenos Aires' },
];

/**
 * **Cómo se escribió CABA antes de que fuera un slug** — B-967.
 *
 * Los cuatro entran a `esCaba`, y no es una comodidad: son los valores que están
 * **guardados de verdad** en documentos que nadie migró.
 *
 * | Valor | De dónde sale |
 * |---|---|
 * | `caba` | el slug de hoy, y el `'CABA'` que `sedeVacia()` tenía cableado antes de B-950 |
 * | `ciudad-de-buenos-aires` | `CIUDAD_POR_DEFECTO` de las guías (`types/libreria.ts`), que es «Ciudad de Buenos Aires» |
 * | `ciudad-autonoma-de-buenos-aires` | la etiqueta de `/opciones/provincia`, si alguien la tipeó como ciudad |
 * | `capital-federal` | cómo lo escribe la mitad de la gente |
 *
 * **Sin esto, la conversión de las guías crea una segunda CABA.** El default de
 * las guías slugifica a `ciudad-de-buenos-aires`, que no es `caba`, así que un
 * backfill que slugificara a secas dejaría dos entradas para el mismo lugar en la
 * taxonomía — que es exactamente el bug que la conversión vino a arreglar
 * («"CABA", "Caba", "Capital Federal" y "Buenos Aires" como cuatro ciudades», que
 * es como `12-sitio-publico.md` justificaba no hacer el hub de ciudad).
 *
 * **«Buenos Aires» a secas NO está**, y es la única omisión que hay que
 * defender: es el nombre de la **provincia**, así que tomarlo por CABA convertiría
 * una sede de La Plata en una de CABA. Ante la duda, no se adivina — el mismo
 * criterio que `provinciaDeSede` con una ciudad que no reconoce.
 */
export const ALIAS_DE_CABA = [
  SLUG_CABA,
  'ciudad-de-buenos-aires',
  'ciudad-autonoma-de-buenos-aires',
  'capital-federal',
];

/**
 * ¿Es CABA? Slugifica antes de comparar para que valga también sobre lo que
 * todavía no pasó por el backfill: los documentos anteriores a B-950 tienen la
 * ciudad como texto libre, y `'CABA'` —el default que `sedeVacia()` tenía
 * cableado— slugifica exactamente a `'caba'`.
 *
 * Y desde B-967 acepta las otras tres formas en que CABA quedó escrita — ver
 * `ALIAS_DE_CABA`.
 */
export const esCaba = (/** @type {string | null | undefined} */ valor) =>
  Boolean(valor) && ALIAS_DE_CABA.includes(slugify(valor));

/**
 * ¿Este slug es una de las 24 provincias? — B-972.
 *
 * Es la única de las tres piezas de la geografía que se puede verificar de
 * verdad, y por eso vale la pena: **la lista es cerrada y no cambia**. Un barrio
 * o una ciudad son vocabulario abierto —se agregan con «Otro» y no hay padrón
 * contra el cual medirlos—, pero las provincias argentinas son 24 y están acá
 * enumeradas. Hasta B-972 lo único que se exigía era la **forma** (no vacío, no
 * demasiado largo), así que `provincia: 'chubut '` pasaba, y `'cordoba-capital'`
 * también: un valor con forma de slug que no denota ninguna provincia se
 * guardaba igual y después no casaba con ningún filtro ni con ningún hub.
 *
 * Slugifica antes de comparar, por el mismo motivo que `esCaba`: tiene que valer
 * sobre lo que todavía no pasó por el backfill.
 *
 * Acepta además los alias de CABA (`ALIAS_DE_CABA`), que son provincia aunque no
 * estén en la tabla con ese slug exacto: CABA es ciudad y provincia a la vez, y
 * quedó escrita de cuatro formas distintas antes de B-967.
 */
export const esProvincia = (/** @type {string | null | undefined} */ valor) => {
  if (!valor) return false;
  const slug = slugify(valor);
  return PROVINCIAS.some((p) => p.slug === slug) || ALIAS_DE_CABA.includes(slug);
};

/**
 * Qué subdivide a esta provincia: el barrio en CABA, la ciudad en todas las
 * demás. Es la bifurcación de la cascada, y devuelve el nombre del campo para
 * que quien la use no tenga que volver a escribir el `if`.
 *
 * Sin provincia elegida devuelve `null`: todavía no hay segundo nivel que
 * ofrecer, que es distinto de ofrecer el equivocado.
 */
export const subdivisionDe = (/** @type {string | null | undefined} */ provincia) => {
  if (!provincia) return null;
  return esCaba(provincia) ? 'barrio' : 'ciudad';
};

/**
 * ¿Se muestra este eje de filtro? — B-950, generalizado en B-970.
 *
 * Es **la regla de la cascada del lado del filtro**, y la comparten los tres
 * rieles: el listado de actividades, la guía de librerías y la de lugares. Vive
 * acá y no en cada uno porque ya estuvo escrita una sola vez y copiarla es
 * exactamente como se llega a que la cascada funcione en dos pantallas y en la
 * tercera no.
 *
 * Tres casos, en este orden:
 *
 *  1. **No es una subdivisión** (`tipo`, `arancel`, `provincia`…) → siempre se
 *     muestra. El primer nivel nunca se esconde: es de donde cuelga el resto.
 *  2. **Ya tiene valores elegidos** → se muestra aunque la cascada no lo abra.
 *     Ésta es la regla que rescata un enlace compartido (`?barrio=boedo` sin
 *     provincia): sin ella el filtro quedaría aplicado y **sin ningún control en
 *     pantalla** para entenderlo ni para sacarlo, que es la clase de bug de D-143.
 *  3. Si no, se muestra **solo si alguna provincia elegida lo subdivide**: el
 *     barrio en CABA, la ciudad en las otras 23.
 *
 * Sin ninguna provincia elegida no se muestra ninguna de las dos, que es el
 * punto: ofrecer los treinta y pico de barrios cargados junto a las ciudades de
 * todo el pais es la lista plana que la cascada vino a reemplazar.
 */
export const muestraEjeDeGeografia = (
  /** @type {string} */ eje,
  /** @type {readonly string[]} */ provinciasElegidas,
  /** @type {boolean} */ yaTieneValores,
) => {
  if (eje !== 'barrio' && eje !== 'ciudad') return true;
  if (yaTieneValores) return true;
  return provinciasElegidas.some((p) => subdivisionDe(p) === eje);
};

/**
 * Elegir un valor en el riel de filtros, **con la cascada aplicada** — B-970.
 *
 * Es `conProvincia` del lado del filtro, y existe por la misma razón: al cambiar
 * el primer nivel, lo elegido en el segundo deja de tener sentido. En el
 * formulario eso se ve enseguida —el campo queda con un valor imposible—; en un
 * riel de chips no se ve nada, y el síntoma es **cero resultados sin motivo
 * visible**: elegir CABA + Boedo y después cambiar a Buenos Aires dejaba un
 * filtro de barrio porteño colgado bajo una provincia que no tiene barrios.
 *
 * Toca solo `barrio` y `ciudad`, y solo cuando lo que se movió fue `provincia`:
 * los demás ejes del riel —qué incluye, qué tipo, qué perfil— no cuelgan de la
 * geografía y no tienen por qué limpiarse.
 *
 * Volver a tocar el chip elegido lo apaga (`undefined`), que es el gesto de
 * «todos»; apagar la provincia limpia las dos subdivisiones, porque sin primer
 * nivel no hay segundo.
 */
export const conFiltroDeGeografia = (elegidos, /** @type {string} */ eje, /** @type {string} */ slug) => {
  const siguiente = { ...elegidos, [eje]: elegidos[eje] === slug ? undefined : slug };
  if (eje !== 'provincia') return siguiente;
  /*
   * **Se limpian las dos, siempre**, y no «la que la provincia nueva no
   * subdivide». La primera versión preguntaba `subdivisionDe(provinciaNueva)` y
   * conservaba la subdivisión de ese tipo, y eso dejaba pasar el caso más común
   * de todos: **entre dos provincias que no son CABA la subdivisión es `ciudad`
   * en las dos**, así que ir de Buenos Aires a Santa Fe conservaba Mar del Plata
   * — una ciudad bonaerense filtrando bajo Santa Fe, cero resultados, y el chip
   * marcado como si fuera lo pedido. Lo encontró el `auditor-trampas`.
   *
   * Tocar este eje **siempre** cambia la provincia: o queda `slug`, o queda
   * `undefined` porque se volvió a tocar el chip encendido. No hay caso en que
   * la de antes siga valiendo, así que no hay nada que conservar.
   */
  return { ...siguiente, barrio: undefined, ciudad: undefined };
};

/**
 * La provincia de una sede, con el **default de lectura** del D-26: los
 * documentos anteriores a B-950 no tienen el campo, y lo que se devuelva tiene
 * que preservar el comportamiento anterior.
 *
 *  - Si la ciudad guardada es CABA —sea `'CABA'`, `'caba'` o `'Caba'`—, la
 *    provincia es CABA. Eso cubre a casi todo el catálogo de un saque, porque
 *    `sedeVacia()` traía `ciudad: 'CABA'` cableado como default del formulario.
 *  - Si no, devuelve `''`. **No se adivina**: para «Mar del Plata» la provincia
 *    es deducible por una persona y no por este módulo, y escribir una tabla
 *    ciudad→provincia sería inventar el dato. Queda vacía, no se muestra, y la
 *    completa el backfill o quien reedite la ficha — que es exactamente lo que
 *    B-950 pide («no reescribir los documentos ya guardados por las bravas»).
 */
export const provinciaDeSede = (/** @type {SedeGeografica | null | undefined} */ sede) => {
  if (!sede) return '';
  if (sede.provincia) return slugify(sede.provincia);
  return esCaba(sede.ciudad) ? SLUG_CABA : '';
};

/**
 * **El renglón de lugar, en piezas** — B-951 y B-953 comparten esta función.
 *
 * Devuelve los slugs que hay que nombrar, en orden de lo particular a lo general,
 * ya con la regla de CABA aplicada: en CABA se dice el barrio y nada más («si es
 * CABA, solo barrio», el dueño), y fuera de CABA se dice la ciudad y después la
 * provincia. El barrio fuera de CABA no se pide en el formulario, pero si un
 * documento lo tiene cargado se respeta y va primero: esconder un dato que
 * alguien escribió es peor que mostrarlo.
 *
 * Devuelve **slugs y no etiquetas** porque quien la llama es quien tiene las
 * opciones para resolverlas: el panel las tiene de `useOpciones`, el sitio las
 * tiene del `events.json` (§4.4). Resolverlas acá obligaría a pasarle la
 * taxonomía entera a una función que se llama desde siete lugares.
 *
 * @returns {{ campo: 'barrio'|'ciudad'|'provincia', slug: string }[]}
 */
export const piezasDeLugar = (/** @type {SedeGeografica | null | undefined} */ sede) => {
  if (!sede) return [];
  const provincia = provinciaDeSede(sede);
  /** @type {{ campo: 'barrio'|'ciudad'|'provincia', slug: string }[]} */
  const piezas = [];
  if (sede.barrio) piezas.push({ campo: 'barrio', slug: sede.barrio });
  /*
   * En CABA la ciudad y la provincia son la misma cosa y decirla sería decirla
   * dos veces («Boedo, Ciudad Autónoma de Buenos Aires, Ciudad Autónoma de
   * Buenos Aires»). El corte es acá y no en cada plantilla: es la decisión que
   * B-953 pide que viva en esta función porque la van a necesitar igual la ficha
   * pública y el JSON-LD.
   *
   * **Salvo que no haya barrio**, y ese borde importa: «si es CABA, solo barrio»
   * da por hecho que el barrio está cargado, y sin él cortar acá devolvería una
   * lista vacía — o sea una tarjeta que dice «Casa Brandon» y no dice en qué
   * ciudad queda. Con el barrio vacío se cae a la ciudad, que es la respuesta
   * menos mala y la que había antes de B-950.
   */
  if (esCaba(provincia) && piezas.length > 0) return piezas;
  if (sede.ciudad) piezas.push({ campo: 'ciudad', slug: slugify(sede.ciudad) });
  // La provincia solo afuera de CABA: adentro es la misma etiqueta que la ciudad
  // que se acaba de agregar, y repetirla es el «Boedo, CABA, CABA» de arriba.
  if (provincia && !esCaba(provincia)) piezas.push({ campo: 'provincia', slug: provincia });
  return piezas;
};

/**
 * La cascada aplicada a una sede: elegir una provincia arrastra los otros dos
 * campos. Es `sede → sede`, pura, como todo lo de `formulario/cascadas.ts`.
 *
 * Las dos reglas, y las dos son por lo mismo —que no quede guardado un dato que
 * contradice al que se acaba de elegir—:
 *
 *  - **CABA completa la ciudad sola** (ver el encabezado: `ciudades[]` y las tres
 *    salidas que leen `sede.ciudad` dependen de que esté puesta) y conserva el
 *    barrio, que es lo que la cascada va a ofrecer a continuación.
 *  - **Salir de CABA limpia el barrio**, porque fuera de CABA no se pide y
 *    dejarlo puesto haría que «Boedo, Mar del Plata» siguiera filtrándose por
 *    Boedo. Y limpia la ciudad **solo si era CABA**: si ya había una ciudad de
 *    verdad cargada se conserva, porque corregir la provincia de una sede de Mar
 *    del Plata no es motivo para hacerle volver a tipear la ciudad.
 */
/**
 * @template {SedeGeografica} T
 * @param {T} sede
 * @param {string | null | undefined} provincia
 * @returns {T} la misma sede, con los otros campos conservados: quien la llama
 *   tiene un `Sede` entero (nombre, dirección, `geo`…) y esto solo toca los tres
 *   de la geografía.
 */
export const conProvincia = (sede, provincia) => {
  const slug = provincia ? slugify(provincia) : '';
  if (esCaba(slug)) return { ...sede, provincia: slug, ciudad: SLUG_CABA };
  return {
    ...sede,
    provincia: slug,
    /*
     * **El barrio se limpia solo al SALIR de CABA**, y esto lo cobró el
     * `auditor-trampas`: la versión anterior lo borraba en toda transición hacia
     * una provincia que no fuera CABA, incluida «de Buenos Aires a Córdoba», donde
     * el campo Barrio ni siquiera está en pantalla. O sea que corregir la
     * provincia de una sede de Mar del Plata borraba, sin que nadie lo viera, un
     * barrio que alguien había cargado.
     *
     * Lo que sí hay que limpiar es el barrio **de CABA** que queda colgado al
     * mudarse afuera: «Boedo, Mar del Plata» seguiría filtrándose por Boedo. Y es
     * coherente con `piezasDeLugar`, que respeta y muestra un barrio cargado
     * fuera de CABA — esconder un dato que alguien escribió es peor que mostrarlo.
     */
    barrio: esCaba(sede.provincia) ? '' : (sede.barrio ?? ''),
    ciudad: esCaba(sede.ciudad) ? '' : slugify(sede.ciudad ?? ''),
  };
};

/**
 * **El default de lectura de la geografía de una sede** (D-26) — la función que
 * `campo-nuevo` avisa que siempre se olvida.
 *
 * Los documentos anteriores a B-950 no tienen `provincia` y guardan la ciudad
 * como se tipeó («Mar del Plata»), no como slug. Se aplica en **cuatro** lugares,
 * y conviene saber cuáles son exactamente porque la primera versión de este
 * docblock nombraba uno que no la tenía y lo cobraron dos auditores:
 *
 *  - `toPublic.ts` — la proyección pública, o sea el `events.json`, el detalle,
 *    la cartelera y todo lo que deriva de ellos;
 *  - `filtrosActividades.ts` — los filtros del panel, que leen el documento crudo;
 *  - `actividades.ts` (`formADocumento`) — antes de escribir, porque un borrador
 *    recuperado del navegador pudo guardarse antes de esta versión;
 *  - `historial.ts` (`payloadDeRestauracion`) — **también escribe el documento**,
 *    y sin esto restaurar una versión vieja lo dejaba internamente contradictorio.
 *
 * **Dónde NO se aplica, y es una decisión:** `functions/calendario.js`.
 * `functions/` se despliega con su propio `package.json` y no puede importar
 * hacia arriba (D-20), así que el evento usa el valor crudo del documento. Hoy es
 * inofensivo —`etiqueta()` cae a `desSlug`, que sobre «Mar del Plata» no cambia
 * nada, y la provincia simplemente no aparece, igual que antes de B-950— y se
 * vuelve visible solo si una sede vieja tiene la ciudad con mayúsculas
 * irregulares. Está anotado como **B-968**.
 *
 * `slugify` es idempotente sobre un slug, así que esto se puede aplicar sin
 * preguntar si el documento ya está migrado — que es justo lo que permite que el
 * backfill sea opcional y no un requisito del despliegue.
 *
 * @param {SedeGeografica | null | undefined} sede
 */
export const geografiaNormalizada = (sede) => ({
  provincia: provinciaDeSede(sede),
  barrio: sede?.barrio ?? '',
  /*
   * **Los alias de CABA colapsan al slug canónico** — B-967. Sin esto, una ficha
   * de guía guardada con «Ciudad de Buenos Aires» quedaría como
   * `ciudad-de-buenos-aires` y sería una **segunda CABA** en la taxonomía: dos
   * chips, dos hubs y dos filtros para el mismo lugar.
   */
  ciudad: sede?.ciudad ? (esCaba(sede.ciudad) ? SLUG_CABA : slugify(sede.ciudad)) : '',
});

/**
 * **El renglón de lugar, ya resuelto a etiquetas**: «Villa Crespo» en CABA,
 * «Mar del Plata, Buenos Aires» afuera.
 *
 * Es `piezasDeLugar()` más la resolución de cada slug a su etiqueta, y existe
 * como función porque el mismo renglón lo arman **cinco** salidas: la tarjeta del
 * listado, el tríptico de la home, la ficha de detalle (B-951), la tarjeta del
 * panel (B-953) y el JSON-LD. Con el `join` escrito cinco veces, la regla de CABA
 * se aplica en cuatro y en la quinta no.
 *
 * **El resolvedor entra por parámetro y no se importa**, para que este módulo
 * siga sin depender de nada: el sitio resuelve contra las opciones del
 * `events.json` (`etiquetaDe`) y el panel contra las de `useOpciones`, que son
 * dos mapas distintos. Además evita el ciclo con `listadoPublico.ts`, que desde
 * B-950 importa de acá para armar la cascada.
 *
 * @param {SedeGeografica | null | undefined} sede
 * @param {(campo: 'barrio'|'ciudad'|'provincia', slug: string) => string} resolver
 * @returns {string}
 */
export const zonaDeSede = (sede, resolver) =>
  piezasDeLugar(sede)
    .map(({ campo, slug }) => resolver(campo, slug))
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .join(', ');
