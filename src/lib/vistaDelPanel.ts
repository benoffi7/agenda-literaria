/**
 * Con qué forma se dibuja el formulario de carga, y que la elección se recuerde
 * — B-814.
 *
 * ── El pedido, y lo que tiene de raro ─────────────────────────────────────
 * Del dueño, el 2026-09-08: «el formulario que tenga una vista PC o mobile
 * configurable. si es mobile es a lo largo y si es pc usar pestañas y todo a lo
 * ancho. **que no sea automatico por deteccion sino eleccion del usuario**».
 *
 * Esa última frase es la decisión de diseño entera y va contra el reflejo, que
 * sería un `@media` o un `matchMedia`. Y tiene razón el pedido: el ancho de la
 * ventana **no** es la pregunta. Quien carga desde una notebook con la ventana a
 * media pantalla puede querer las nueve secciones apiladas, y quien carga desde
 * una tablet apoyada puede querer las pestañas. Detectar acierta en el promedio y
 * no se puede contradecir; elegir acierta siempre. Por eso no hay ninguna
 * consulta de ancho en este módulo, y no es un olvido.
 *
 * ── Por qué las dos vistas y no una responsive ────────────────────────────
 * Las pestañas son D-490 y resolvieron un problema medido («quedó muy largo»).
 * Pero en 390px las nueve solapas no entran en una fila: la tira scrollea
 * horizontal y «¿en qué pestaña estaba el arancel?» se contesta buscando. El
 * dueño carga desde el teléfono —de ahí salieron B-186, B-204 y media docena de
 * reportes— así que la forma de antes de D-490 no era peor, era **otra**, y
 * seguía siendo la buena para el pulgar.
 *
 * Así que ninguna gana siempre, que es exactamente la condición para que se
 * elija en vez de decidirse. Es el mismo razonamiento que `vistaDeGrafico.ts`
 * (B-701) con otro vocabulario, y este módulo es esa pieza copiada a propósito:
 * el almacén entra como **puerto**, así que la lógica se testea sin DOM y sin
 * `localStorage`.
 *
 * ── Por qué `pc` es el default ────────────────────────────────────────────
 * Porque es lo que el panel hace hoy: quien no toque el interruptor no ve ningún
 * cambio, y eso es el lado barato de equivocarse (mismo criterio que D-41 y que
 * `VISTAS_A_TODO_ANCHO`). El default **no** se detecta, por lo de arriba: un
 * default que dependiera del ancho de la primera visita haría que la misma
 * persona abriera el panel de dos formas según con qué aparato entró, sin haber
 * elegido nada.
 *
 * **Nada de lo que se guarda es contenido** (§5.1): la clave es fija y el valor
 * es `pc` o `celular`. Por eso no lleva la huella del admin, a diferencia del
 * borrador local — es la misma distinción que hacen `Seccion.tsx` y
 * `vistaDeGrafico.ts`.
 */

/** Las dos vistas. En este orden: `pc` es el default (ver el docblock). */
export const VISTAS_DEL_PANEL = ['pc', 'celular'] as const;
export type VistaDelPanel = (typeof VISTAS_DEL_PANEL)[number];

export const VISTA_POR_DEFECTO: VistaDelPanel = 'pc';

/**
 * Cómo se llama cada vista en pantalla. Acá y no en el JSX, como
 * `ETIQUETA_ESTADO` y `ETIQUETA_VISTA`.
 *
 * «PC» y «Celular» son las palabras del pedido, y se conservan a propósito: son
 * las que el dueño usa. «Escritorio» y «Móvil» serían más de manual y menos de
 * él.
 */
export const ETIQUETA_VISTA_DEL_PANEL: Record<VistaDelPanel, string> = {
  pc: 'PC',
  celular: 'Celular',
};

/**
 * Qué hace cada una, para el `title` del interruptor. Una línea, sin jerga: el
 * interruptor vive en la cabecera del panel y no tiene lugar para una leyenda.
 */
export const QUE_HACE_LA_VISTA: Record<VistaDelPanel, string> = {
  pc: 'El formulario en pestañas y a todo el ancho de la pantalla',
  celular: 'El formulario todo a lo largo, sin pestañas',
};

/**
 * Lo mínimo de `localStorage` que hace falta.
 *
 * Se declara acá y no se importa de `vistaDeGrafico.ts` por lo mismo que aquél
 * no lo importa de `campos/Seccion.tsx`: los tres son un `Pick` de la misma
 * interfaz del navegador, así que no hay tres vocabularios para lo mismo — hay
 * tres vistas del mismo tipo estándar. Colgar este módulo de otro por dos
 * nombres de método sería acoplarlos sin ganar nada.
 */
export interface AlmacenDeVistaDelPanel {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** La clave. Una sola: la preferencia es del panel entero, no de una pantalla. */
export const CLAVE_VISTA_DEL_PANEL = 'agenda:vista-del-panel';

/** ¿Esta cadena es una de las dos vistas? Guarda de **lectura**, no de escritura. */
export const esVistaDelPanel = (valor: unknown): valor is VistaDelPanel =>
  typeof valor === 'string' && (VISTAS_DEL_PANEL as readonly string[]).includes(valor);

/**
 * Qué eligió esta persona, o `null` si nunca tocó el interruptor.
 *
 * `null` y `'pc'` no son lo mismo, de ahí el tipo — y es el mismo argumento que
 * `leerVistaRecordada` (B-701): los dos casos caen hoy al mismo lugar, pero el
 * día que el default cambie se separan, y ése es justo el día en que un
 * `?? 'pc'` escondido acá haría que la elección de alguien se pierda sin que
 * nada falle.
 *
 * Un valor ilegible —alguien lo editó a mano, una versión vieja guardó otra
 * cosa— devuelve `null` y no rompe.
 */
export const leerVistaElegida = (
  almacen: AlmacenDeVistaDelPanel | null,
): VistaDelPanel | null => {
  if (!almacen) return null;
  try {
    const guardado = almacen.getItem(CLAVE_VISTA_DEL_PANEL);
    return esVistaDelPanel(guardado) ? guardado : null;
  } catch {
    // Un almacén que tira no puede romper el panel: se cae al default.
    return null;
  }
};

export const recordarVistaDelPanel = (
  almacen: AlmacenDeVistaDelPanel | null,
  vista: VistaDelPanel,
): void => {
  if (!almacen) return;
  try {
    almacen.setItem(CLAVE_VISTA_DEL_PANEL, vista);
  } catch {
    // Sin memoria se pierde la preferencia, no la vista: la sesión sigue con la
    // que se eligió, y la próxima arranca en el default.
  }
};

/** Con qué vista arranca el panel: la elegida, o el default. */
export const vistaInicialDelPanel = (
  almacen: AlmacenDeVistaDelPanel | null,
): VistaDelPanel => leerVistaElegida(almacen) ?? VISTA_POR_DEFECTO;

/** La otra, para el interruptor de dos estados. */
export const laOtraVista = (vista: VistaDelPanel): VistaDelPanel =>
  vista === 'pc' ? 'celular' : 'pc';

/**
 * ¿El formulario se dibuja en pestañas? — la única pregunta que le hace el
 * formulario a este módulo.
 *
 * Existe como función y no como `vista === 'pc'` suelto en el JSX por lo mismo
 * que `ocupaTodoElAncho` (B-620, D-330): el día que aparezca una tercera vista,
 * un `===` desparramado no le pregunta nada a nadie, y acá cae en un solo lugar
 * que **no compila** hasta que se lo mire.
 */
export const usaPestanias = (vista: VistaDelPanel): boolean => vista === 'pc';
