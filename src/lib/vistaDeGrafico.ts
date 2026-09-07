/**
 * Con qué vista se dibuja un reparto del tablero, y que se recuerde — B-701.
 *
 * ── Por qué hay dos vistas y no una ───────────────────────────────────────
 * La lista **no es un modo degradado de la torta**: es su alternativa
 * accesible. Un `<svg>` de cuñas no lo lee un lector de pantalla y no se puede
 * copiar; una lista con el número y el porcentaje escritos sí, y además contesta
 * mejor «cuántas exactamente» — que es la pregunta que un tablero de programación
 * hace más seguido que «cuál es más grande».
 *
 * La torta contesta la otra: la proporción de un vistazo. Ninguna de las dos
 * gana siempre, así que se elige.
 *
 * ── Por qué se recuerda ───────────────────────────────────────────────────
 * Porque la preferencia es de **quien mira**, no del gráfico: alguien que lee
 * con lector de pantalla no quiere elegir «lista» siete veces cada vez que abre
 * el tablero. El precedente exacto es la memoria de secciones del formulario
 * (`campos/Seccion.tsx`, B-193) y esto es la misma pieza con otro vocabulario:
 * el almacén entra como **puerto**, así que la lógica se testea sin DOM y sin
 * `localStorage`.
 *
 * **Nada de lo que se guarda es contenido** (§5.1): la clave es el nombre del
 * reparto (`tipo`, `arancel`, `barrio`, `estado`) y el valor es `torta` o
 * `lista`. Por eso no lleva la huella del admin en la clave, a diferencia del
 * borrador local — es la misma distinción que hace `Seccion.tsx`.
 */

/** Las dos vistas. En este orden: la torta es el default. */
export const VISTAS_DE_GRAFICO = ['torta', 'lista'] as const;
export type VistaDeGrafico = (typeof VISTAS_DE_GRAFICO)[number];

/** Cómo se llama cada vista en pantalla. Acá y no en el JSX, como `ETIQUETA_ESTADO`. */
export const ETIQUETA_VISTA: Record<VistaDeGrafico, string> = {
  torta: 'Torta',
  lista: 'Lista',
};

/**
 * Lo mínimo de `localStorage` que hace falta.
 *
 * Se declara acá en vez de importar `AlmacenDeSecciones` de `campos/Seccion.tsx`
 * porque aquél vive en un **componente**: importarlo desde `lib/` invertiría la
 * dependencia (un módulo puro colgando de un `.tsx`) por dos nombres de método.
 * Los dos son un `Pick` de la misma interfaz del navegador, así que no hay dos
 * vocabularios para lo mismo: hay dos vistas del mismo tipo estándar.
 */
export interface AlmacenDeVistas {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/** El prefijo de las claves. Uno solo, para poder barrerlas si alguna vez hace falta. */
export const PREFIJO_VISTA = 'agenda:grafico:';

/** ¿Esta cadena es una de las dos vistas? Guarda de **lectura**, no solo de escritura. */
export const esVistaDeGrafico = (valor: unknown): valor is VistaDeGrafico =>
  typeof valor === 'string' && (VISTAS_DE_GRAFICO as readonly string[]).includes(valor);

/**
 * Cómo quedó este reparto la última vez, o `null` si no hay memoria.
 *
 * `null` y `'torta'` no son lo mismo, de ahí el tipo: «nunca se tocó» cae al
 * default y «se eligió torta» también, pero el día que el default cambie los dos
 * casos se separan — y ese es justo el día en que un `?? 'torta'` escondido acá
 * haría que la elección de alguien se pierda sin que nada falle.
 *
 * Un valor ilegible en el almacén (alguien lo editó a mano, o una versión vieja
 * guardó otra cosa) devuelve `null`, no rompe: es la misma guarda que
 * `esTonoElegible` aplica sobre lo que viene de Firestore.
 */
export const leerVistaRecordada = (
  almacen: AlmacenDeVistas | null,
  clave: string,
): VistaDeGrafico | null => {
  if (!almacen || !clave) return null;
  try {
    const guardado = almacen.getItem(`${PREFIJO_VISTA}${clave}`);
    return esVistaDeGrafico(guardado) ? guardado : null;
  } catch {
    // Un almacén que tira no puede romper el tablero: se cae al default.
    return null;
  }
};

export const recordarVista = (
  almacen: AlmacenDeVistas | null,
  clave: string,
  vista: VistaDeGrafico,
): void => {
  if (!almacen || !clave) return;
  try {
    almacen.setItem(`${PREFIJO_VISTA}${clave}`, vista);
  } catch {
    // Sin memoria se pierde la preferencia, no el gráfico.
  }
};

/**
 * Con qué vista arranca un reparto.
 *
 * La memoria gana sobre el default, y el default gana sobre nada. Es puro para
 * poder probar los tres casos sin montar el componente.
 */
export const vistaInicial = ({
  recordada,
  porDefecto,
}: {
  recordada: VistaDeGrafico | null;
  porDefecto: VistaDeGrafico;
}): VistaDeGrafico => recordada ?? porDefecto;

/**
 * El `localStorage` del navegador, o `null` si no se puede usar.
 *
 * Acceder **tira** —no devuelve `null`— en un iframe con cookies bloqueadas y en
 * algunos modos privados, así que el acceso va adentro del `try` y no solo la
 * escritura. Copiado del criterio de `Seccion.tsx`, que ya se comió ese caso.
 */
export const almacenDeVistas = (): AlmacenDeVistas | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
