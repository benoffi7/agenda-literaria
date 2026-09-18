/**
 * En qué formato se **tipea** una hora en el panel — B-889, **D-720**.
 *
 * ── El pedido, y por qué no era «cambiar el formato» ──────────────────────
 * Del dueño, dos veces (2026-09-11 y 2026-09-15): «un selector de am/pm», solo
 * en el admin. Los campos de hora son `<input type="datetime-local">`, y ese
 * control **no decide el formato: lo decide el navegador**, a partir del idioma
 * del sistema. En `es-AR` sale en 24 horas y en `en-US` con AM/PM, sin que la
 * página tenga nada que ver. Así que ofrecer elegir significa **dejar de usar el
 * control nativo**, que es la parte cara y la que el dueño aprobó con el costo a
 * la vista.
 *
 * ── Lo que este módulo NO hace, y es lo primero ───────────────────────────
 * **No toca el dato.** En Firestore va un `Timestamp` y hacia Calendar va con
 * `timeZone` explícito (trampa 1). Acá se compone y se descompone el mismo
 * string de `datetime-local` que el formulario ya maneja (`aDatetimeLocal` /
 * `deDatetimeLocal`, `lib/sesiones.ts`), así que del control para adentro no
 * cambió nada. El día que alguien guarde `'7:30 PM'` como texto, eso es la
 * trampa 1 otra vez — y un control propio es justamente lo que lo hace fácil, de
 * ahí que la composición viva acá, pura y con test, y no adentro del JSX.
 *
 * ── La preferencia vive en `localStorage` (D-720) ─────────────────────────
 * No nace un perfil de usuario para esto. El almacén entra como **puerto**, con
 * la misma forma que `vistaDelPanel.ts` (B-814) y `vistaDeGrafico.ts` (B-701):
 * la lógica se testea sin DOM y sin `localStorage`. La consecuencia —es de
 * **este navegador**— se dice en pantalla, no se deja implícita.
 *
 * ── El default es 24, y eso no es una preferencia estética ────────────────
 * Es lo que hoy ve quien carga en `es-AR`, o sea que **quien no toque el
 * interruptor no ve ningún cambio**. Mismo criterio que `VISTA_POR_DEFECTO`: el
 * lado barato de equivocarse.
 *
 * ── Dónde se usa el formato de 12, y dónde no ─────────────────────────────
 * D-720 dice «abajo de cierto ancho se sigue usando el nativo», porque cuatro
 * cajitas para tipear son peores que el selector del teléfono. **Acá eso no se
 * detecta con un `matchMedia`, y conviene decir por qué:** el panel ya tiene una
 * elección explícita de forma —`vistaDelPanel.ts`, pc o celular— y B-814 la
 * decidió justamente **contra** la detección («que no sea automatico por
 * deteccion sino eleccion del usuario»). Colgar el control propio de un ancho de
 * ventana metería en el panel las dos políticas a la vez, y la que gana en el
 * caso raro —una notebook con la ventana a media pantalla— sería la que el dueño
 * ya descartó. Así que la regla es `vista === 'pc'`, y quien quiera el nativo lo
 * tiene a un interruptor de distancia, que es el mismo que ya usa.
 *
 * El formulario público (`/proponer`) no entra: ahí quien carga usa su propio
 * teléfono una sola vez y el formato de su sistema es el que entiende.
 */

import { type VistaDelPanel } from '@/lib/vistaDelPanel';

/** Los dos formatos. En este orden: `'24'` es el default (ver el docblock). */
export const FORMATOS_DE_HORA = ['24', '12'] as const;
export type FormatoDeHora = (typeof FORMATOS_DE_HORA)[number];

export const FORMATO_POR_DEFECTO: FormatoDeHora = '24';

/** Cómo se llama cada uno en pantalla. Acá y no en el JSX, como `ETIQUETA_VISTA_DEL_PANEL`. */
export const ETIQUETA_FORMATO_DE_HORA: Record<FormatoDeHora, string> = {
  '24': '24 h',
  '12': 'AM/PM',
};

/** Qué hace cada uno, para el `title` del interruptor. Una línea, sin jerga. */
export const QUE_HACE_EL_FORMATO: Record<FormatoDeHora, string> = {
  '24': 'Las horas se cargan de 0 a 23, con el control del navegador',
  '12': 'Las horas se cargan de 1 a 12 eligiendo AM o PM',
};

/**
 * Lo mínimo de `localStorage` que hace falta.
 *
 * Se declara acá y no se importa de `vistaDelPanel.ts` por lo mismo que aquél no
 * lo importa de `vistaDeGrafico.ts`: son vistas del mismo tipo estándar, no tres
 * vocabularios para lo mismo.
 */
export interface AlmacenDeFormatoDeHora {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/**
 * La clave. Una sola: el formato es del panel entero, no de un campo.
 *
 * **Fija y sin la huella del uid**, porque lo que guarda es una **marca** y no
 * contenido: el valor es `'24'` o `'12'` y nadie lo tipeó. Esa distinción es la
 * del § 5.1 de `docs/07-seguridad.md`, y la clave está declarada en su tabla —
 * `tests/clases-de-bug.test.ts` la deriva de ahí y del fuente, y falla en los dos
 * sentidos. Esa red cobró esta clave al escribirla.
 */
export const CLAVE_FORMATO_DE_HORA = 'agenda:formato-de-hora';

/** ¿Esta cadena es uno de los dos formatos? Guarda de **lectura**, no de escritura. */
export const esFormatoDeHora = (valor: unknown): valor is FormatoDeHora =>
  typeof valor === 'string' && (FORMATOS_DE_HORA as readonly string[]).includes(valor);

/**
 * Qué eligió esta persona, o `null` si nunca tocó el interruptor.
 *
 * `null` y `'24'` no son lo mismo, de ahí el tipo: hoy caen al mismo lugar y se
 * separan el día que cambie el default, que es justo cuando un `?? '24'`
 * escondido acá perdería la elección de alguien sin que nada falle. Es el mismo
 * argumento de `leerVistaElegida`.
 */
export const leerFormatoElegido = (
  almacen: AlmacenDeFormatoDeHora | null,
): FormatoDeHora | null => {
  if (!almacen) return null;
  try {
    const guardado = almacen.getItem(CLAVE_FORMATO_DE_HORA);
    return esFormatoDeHora(guardado) ? guardado : null;
  } catch {
    // Un almacén que tira no puede romper el panel: se cae al default.
    return null;
  }
};

export const recordarFormatoDeHora = (
  almacen: AlmacenDeFormatoDeHora | null,
  formato: FormatoDeHora,
): void => {
  if (!almacen) return;
  try {
    almacen.setItem(CLAVE_FORMATO_DE_HORA, formato);
  } catch {
    // Sin memoria se pierde la preferencia, no el formato: la sesión sigue con
    // el que se eligió, y la próxima arranca en el default.
  }
};

/** Con qué formato arranca el panel: el elegido, o el default. */
export const formatoInicialDeHora = (almacen: AlmacenDeFormatoDeHora | null): FormatoDeHora =>
  leerFormatoElegido(almacen) ?? FORMATO_POR_DEFECTO;

/** El otro, para el interruptor de dos estados. */
export const elOtroFormato = (formato: FormatoDeHora): FormatoDeHora =>
  formato === '24' ? '12' : '24';

/**
 * ¿Se dibuja el control propio, o el `datetime-local` del navegador?
 *
 * Las dos condiciones, y ninguna sobra:
 *
 *  - **el formato elegido es 12**, porque en 24 el nativo ya hace exactamente lo
 *    que se quiere y reemplazarlo sería perder el selector del sistema a cambio
 *    de nada;
 *  - **la vista del panel es `pc`** (D-720, primer punto): cuatro cajitas para
 *    tipear son peores en una pantalla chica que el selector del teléfono.
 *
 * Que la segunda mire la **vista elegida** y no el ancho de la ventana es la
 * única desviación de cómo estaba escrita D-720, y está argumentada en el
 * docblock de arriba: el panel ya decidió preferir la elección a la detección
 * (B-814).
 */
export const usaControlDeHoraPropio = (
  formato: FormatoDeHora,
  vista: VistaDelPanel,
): boolean => formato === '12' && vista === 'pc';

/**
 * Las dos preferencias que decide un campo de fecha y hora, juntas.
 *
 * Viajan como **una** prop desde `AdminApp` hasta los tres campos del
 * formulario, y no como dos: son la misma pregunta —«cómo se tipea una hora
 * acá»— y separarlas significaría que una sección se olvide de una mitad, que es
 * la clase que `campos-del-panel.render.test.tsx` persigue (B-841).
 *
 * `vista` no se duplica: es la misma de `vistaDelPanel.ts` que el formulario ya
 * recibe para elegir entre pestañas y apilado.
 */
export interface PreferenciaDeHora {
  formato: FormatoDeHora;
  vista: VistaDelPanel;
}

// ─────────────────────────────────────────────────────────────────
// Las piezas del control propio
// ─────────────────────────────────────────────────────────────────

export const MERIDIANOS = ['AM', 'PM'] as const;
export type Meridiano = (typeof MERIDIANOS)[number];

/**
 * Las cuatro piezas que se tipean, **como strings**, que es lo que un `<input>`
 * y un `<select>` devuelven.
 *
 * `''` en cualquiera es «todavía no», y tiene que sobrevivir: un campo a medio
 * completar no puede convertirse en una fecha inventada mientras se tipea. Es la
 * misma razón por la que `datetime-local` reporta `''` hasta estar completo.
 */
export interface PiezasDeFechaYHora {
  /** `aaaa-mm-dd`, tal cual lo devuelve un `<input type="date">`. */
  fecha: string;
  /** De `'1'` a `'12'` en formato 12; de `'0'` a `'23'` en formato 24. */
  hora: string;
  /** De `'00'` a `'59'`. */
  minutos: string;
  /** Solo se usa en formato 12. En 24 queda como `'AM'` y no se mira. */
  meridiano: Meridiano;
}

export const PIEZAS_VACIAS: PiezasDeFechaYHora = {
  fecha: '',
  hora: '',
  minutos: '',
  meridiano: 'AM',
};

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/**
 * `0..23` → la hora de reloj y su meridiano.
 *
 * Los dos bordes son el mismo y son los que se escriben mal: **la medianoche es
 * `12 AM` y el mediodía es `12 PM`**, no `0 AM` ni `0 PM`. Un `h % 12` pelado
 * los manda a los dos a «0», que no es una hora que exista en un reloj de 12.
 */
export const aReloj12 = (hora24: number): { hora: number; meridiano: Meridiano } => ({
  hora: hora24 % 12 === 0 ? 12 : hora24 % 12,
  meridiano: hora24 < 12 ? 'AM' : 'PM',
});

/** La vuelta: la hora de reloj y su meridiano → `0..23`. */
export const de12A24 = (hora12: number, meridiano: Meridiano): number => {
  const base = hora12 % 12;
  return meridiano === 'PM' ? base + 12 : base;
};

/**
 * El string de `datetime-local` → las piezas, en el formato pedido.
 *
 * Un valor vacío o que no tiene la forma esperada devuelve las piezas vacías, y
 * **no tira**: al control lo puede alcanzar un borrador viejo o un valor a
 * medio tipear, y eso no puede voltear el formulario.
 */
/**
 * **El único parser de `datetime-local` de este módulo**, y la razón de que sea
 * uno solo — D-88.
 *
 * Nació duplicado: `aPiezas` tenía su regex y el eco tenía la suya, con el
 * agravante de que las dos hacían lo mismo con formas distintas. Lo marcó el
 * `auditor-trampas` sobre este mismo cambio, y tiene razón por dónde duele: el
 * día que el formato se extienda —segundos, un sufijo de zona— en un solo lugar,
 * el eco mostraría una hora distinta de la que el formulario compone, **y nada
 * se pondría rojo**.
 *
 * **No reusa `deDatetimeLocal` de `lib/sesiones.ts`, y eso es deliberado.** Aquél
 * devuelve un `Date` construido con `new Date(s)`, que es el parser del motor y
 * depende de la forma exacta del string; acá hacen falta los **componentes**
 * —la fecha va a una cajita y la hora a otra—, y sacarlos de un `Date` sería
 * recorrer el camino de ida y vuelta por la zona horaria para nada. Lo que sí hay
 * es una red: `tests/formato-de-hora.test.ts` cruza los dos contra la misma lista
 * de valores, así que si uno acepta algo que el otro no, se pone rojo.
 */
export const partesDeDatetimeLocal = (
  valor: string,
): { fecha: string; hora24: number; minutos: string } | null => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(valor);
  if (!m) return null;
  const hora24 = Number(m[2]);
  const minutos = m[3]!;
  if (hora24 > 23 || Number(minutos) > 59) return null;
  return { fecha: m[1]!, hora24, minutos };
};

export const aPiezas = (valor: string, formato: FormatoDeHora): PiezasDeFechaYHora => {
  const partes = partesDeDatetimeLocal(valor);
  if (!partes) return PIEZAS_VACIAS;

  const { fecha, hora24, minutos } = partes;
  if (formato === '24') {
    return { fecha, hora: dosDigitos(hora24), minutos, meridiano: 'AM' };
  }
  const { hora, meridiano } = aReloj12(hora24);
  return { fecha, hora: String(hora), minutos, meridiano };
};

/**
 * Las piezas → el string de `datetime-local`, o `''` si todavía falta algo.
 *
 * **`''` es la respuesta correcta a un campo incompleto**, no un error: es lo
 * que el schema ya sabe leer como «falta la fecha» (`lib/schema.ts`), y es lo
 * que evita que media fecha tipeada se guarde como una fecha entera. Una hora
 * fuera de rango también da `''`: no se recorta ni se ajusta, porque un `23` que
 * se convierte solo en `11 PM` mientras alguien tipea es peor que un campo que
 * todavía no vale.
 */
export const dePiezas = (piezas: PiezasDeFechaYHora, formato: FormatoDeHora): string => {
  const { fecha, hora, minutos, meridiano } = piezas;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || hora === '' || minutos === '') return '';

  const h = Number(hora);
  const min = Number(minutos);
  if (!Number.isInteger(h) || !Number.isInteger(min) || min < 0 || min > 59) return '';

  if (formato === '12') {
    if (h < 1 || h > 12) return '';
    return `${fecha}T${dosDigitos(de12A24(h, meridiano))}:${dosDigitos(min)}`;
  }
  if (h < 0 || h > 23) return '';
  return `${fecha}T${dosDigitos(h)}:${dosDigitos(min)}`;
};

/**
 * Lo que quedó cargado, escrito en palabras — el **eco** de D-720.
 *
 * No es decoración: un control que dibujamos nosotros necesita confirmar lo que
 * entendió más que uno que garantiza el navegador. Era la opción (a) que se
 * recomendó y el dueño no eligió; entra adentro de la (b) porque ahí sale casi
 * gratis y es la red de que el control propio no esté mintiendo.
 *
 * Siempre en 12 horas **aunque el formato sea 24**, y es a propósito: el eco
 * existe para contestar «¿esto es de mañana o de tarde?», que es la pregunta del
 * pedido original. Repetir `19:30` al lado de `19:30` no confirma nada.
 */
export const ecoDeFechaYHora = (valor: string, hoy = new Date()): string => {
  const partes = partesDeDatetimeLocal(valor);
  if (!partes) return '';

  const [anio, mes, dia] = partes.fecha.split('-').map(Number) as [number, number, number];
  // Por componentes y **no** `new Date(string)`: el constructor de un string sin
  // zona es ambiguo entre motores, y eso es la trampa 1 entrando por la puerta
  // de atrás — en un texto que existe justamente para confirmar la hora.
  const d = new Date(anio, mes - 1, dia, partes.hora24, Number(partes.minutos));
  if (Number.isNaN(d.getTime())) return '';

  const { hora, meridiano } = aReloj12(d.getHours());
  const fecha = d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    // El año solo cuando no es el corriente: en la carga normal es ruido.
    ...(d.getFullYear() === hoy.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `${fecha}, ${hora}:${dosDigitos(d.getMinutes())} ${meridiano}`;
};
