/**
 * **Los derivados de `modalidades`, y su verificación del lado del servidor** —
 * B-224, B-2050.
 *
 * Una actividad se cursa en una **lista** de filas (D-130), pero hay salidas que
 * solo pueden decir una cosa: el filtro del panel, el `location` del evento —que
 * dibuja el mapa—, el `searchText` del §6 y la analítica. Por eso el documento
 * guarda, además de la lista, cuatro derivados que escribe `formADocumento` en
 * cada guardado: `modalidad` (la unión), `sede` (la de la primera fila que tenga
 * una), `online` (el primer bloque online) y `searchText`. El quinto, `ciudades`,
 * vive en `ciudades.js` porque existe para una regla (B-919).
 *
 * ── Por qué vive en `functions/` ──────────────────────────────────────────
 * Desde B-2050 `syncCalendar` recalcula los cuatro de lo que guardan las filas y,
 * si el documento dice otra cosa, lo corrige y avisa (`derivadosDesalineados`,
 * abajo; el efecto en `derivados-firestore.js`). Es la misma forma que B-1920 le
 * dio a `ciudades` (D-1230, D-1231). Tienen que ser **las mismas** funciones que
 * usa el panel al guardar: con dos copias, el servidor «corregiría» un documento
 * bien guardado y cada guardado mandaría un mail. `functions/` no puede importar
 * `src/` (D-20), así que viven acá y `src/lib/modalidades.ts` las reexporta con
 * sus tipos. Un test lo ata por identidad (`tests/derivados-del-servidor.test.ts`).
 *
 * Es JS plano y corre sobre documentos **escritos a mano**, así que cada lectura
 * de una fila va con `?.`: una fila `null` no puede hacer tirar al sync del
 * calendario.
 */
/**
 * §11 — la sede aparece en presencial e híbrido. Por fila, no por actividad.
 *
 * @param {unknown} m
 * @returns {boolean}
 */
export const filaPideSede = (m) => m === 'presencial' || m === 'hibrido';

/**
 * §11 — el bloque online aparece en virtual e híbrido.
 *
 * @param {unknown} m
 * @returns {boolean}
 */
export const filaPideOnline = (m) => m === 'virtual' || m === 'hibrido';

/**
 * La modalidad de la actividad entera, **derivada** de sus filas (B-224,
 * decisión 3): la unión de lo que las filas dicen.
 *
 * - todas presenciales → `presencial`
 * - todas virtuales → `virtual`
 * - una presencial y una virtual, o cualquier fila `hibrido` → `hibrido`
 *
 * Es la unión y no «la primera fila manda» a propósito: lo segundo depende del
 * orden del array, que es la trampa 2 en otra forma —reordenar las filas
 * cambiaría lo que publica el `events.json`—. Y es lo que hace que las salidas
 * que solo admiten un valor sigan diciendo algo cierto.
 *
 * **Una lista vacía devuelve `presencial`**, que es el default de `formVacio()`.
 * Solo pasa en un borrador: el schema exige al menos una fila para publicar.
 *
 * @param {readonly ({ modalidad?: unknown } | null | undefined)[]} [filas]
 * @returns {'presencial' | 'virtual' | 'hibrido'}
 */
export const modalidadResultante = (filas = []) => {
  if (filas.length === 0) return 'presencial';
  const hayPresencial = filas.some((f) => filaPideSede(f?.modalidad));
  const hayVirtual = filas.some((f) => filaPideOnline(f?.modalidad));
  if (hayPresencial && hayVirtual) return 'hibrido';
  return hayVirtual ? 'virtual' : 'presencial';
};

/**
 * La sede **principal**: la de la primera fila que tenga una.
 *
 * Existe porque el campo `location` del evento —el que dibuja el mapa—, el
 * `searchText` y el filtro por barrio solo admiten una dirección. «La primera que
 * tenga» y no un flag explícito estilo `portada` (D-125) porque el orden de las
 * filas lo elige quien carga y se ve en pantalla. Si alguna vez importa
 * distinguirla, la respuesta es el flag.
 *
 * @param {readonly ({ sede?: any } | null | undefined)[]} [filas]
 * @returns {any} la sede, o `null`
 */
export const sedePrincipal = (filas = []) => filas.find((f) => f?.sede)?.sede ?? null;

/**
 * El bloque online principal, con el mismo criterio que `sedePrincipal`.
 *
 * **Lleva el link de la reunión**, como el de cada fila: es el mismo objeto. Lo
 * que decide si el link sale es `urlPublica`, y lo mira la proyección
 * (`linkDeReunionQueSale`, `src/lib/toPublic.ts`), nunca este derivado.
 *
 * @param {readonly ({ online?: any } | null | undefined)[]} [filas]
 * @returns {any} el bloque online, o `null`
 */
export const onlinePrincipal = (filas = []) => filas.find((f) => f?.online)?.online ?? null;
