/**
 * Las fechas como las lee alguien que entra al sitio — B-227.
 *
 * **Todo se formatea con `timeZone` explícito**, y esa es la única regla que
 * importa acá: es la trampa 1 aplicada al frontend (§6.4 del diseño). Las fechas
 * del `events.json` son ISO en UTC, así que un teléfono con el reloj en Madrid
 * formatea `22:00` para un taller que empieza a las `19:00` en Buenos Aires — y
 * la actividad pasa en Buenos Aires, no en Madrid. No hay una sola llamada a
 * `Intl` en el sitio público que no pase por este módulo.
 *
 * Es puro y no toca DOM ni red: el build y la island lo usan igual, así que la
 * tarjeta que sale en el HTML y la que pinta el filtrado dicen lo mismo.
 *
 * **No se comparte con `lib/sesiones.ts`** —que también formatea, con
 * `fechaHoraCorta`— porque son dos audiencias distintas: aquélla es el `2/3/26,
 * 19:00` del panel, donde lo que importa es verificar de un vistazo lo que se
 * tipeó; acá es «miércoles 24 de septiembre, 19:00», que es prosa. Lo que sí es
 * uno solo es el `timeZone`, y por eso se importa de allá en lugar de escribir la
 * cadena una segunda vez.
 */
import { TIMEZONE } from '@calendario';

/** La zona del proyecto (§14). Se re-exporta para que nadie escriba la cadena. */
export const ZONA = TIMEZONE;

const fmt = (opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, ...opciones });

/**
 * `jueves 24 de septiembre` — la fecha de la ficha del detalle.
 *
 * `es-AR` mete una coma después del día de la semana; se saca acá y no en cada
 * componente, que es lo que hace que las dos vistas del listado escriban la fecha
 * igual.
 */
export const fechaLarga = (d: Date): string =>
  fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d).replace(',', '');

/**
 * `mié 24 sep` — la de la tarjeta.
 *
 * `es-AR` devuelve `mié, 24 sept` con `weekday: 'short'`: se le saca la coma y se
 * recorta `sept` a tres letras, que es lo que se lee bien en 360px. Es cosmético
 * y está acá y no en cada componente, que es lo que hace que las dos vistas del
 * listado —la del HTML y la de la island— no puedan escribir la fecha distinto.
 */
export const fechaCorta = (d: Date): string =>
  fmt({ weekday: 'short', day: 'numeric', month: 'short' })
    .format(d)
    .replace(',', '')
    .replace(/\bsept\b/, 'sep');

/**
 * `19:00`.
 *
 * **`hourCycle: 'h23'` no es opcional:** `es-AR` formatea en 12 horas por
 * defecto y devuelve `07:00 p. m.`, que en una agenda de talleres se lee peor y
 * ocupa el doble. El reloj de 24 horas es además el que usa el resto del
 * proyecto (el panel, la descripción del evento).
 */
export const hora = (d: Date): string =>
  fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

/** `24 de septiembre` — sin día de la semana, para «cierra el …». */
export const diaYMes = (d: Date): string => fmt({ day: 'numeric', month: 'long' }).format(d);

/** `24 de septiembre de 2026` — cuando el año no se da por sentado. */
export const fechaCompleta = (d: Date): string =>
  fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(d);

/**
 * Las partes de una fecha **en la zona del proyecto**, como números.
 *
 * Es la primitiva de la que salen `claveDeMes` y `isoConOffset`: `getMonth()` de
 * `Date` devuelve el mes del reloj de quien mira, así que un encuentro del 1 de
 * septiembre a las 00:30 de Buenos Aires cae en agosto para un navegador en
 * Madrid — y la agrupación por mes del listado lo pondría bajo el separador
 * equivocado.
 */
const partes = (d: Date): Record<string, string> =>
  Object.fromEntries(
    fmt({
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );

/** `2026-09` — la clave con la que el listado agrupa por mes. */
export const claveDeMes = (d: Date): string => {
  const p = partes(d);
  return `${p.year}-${p.month}`;
};

/**
 * `{ mes: 'Septiembre', anio: '2026' }` — el marcador de mes del listado, **en
 * dos piezas** — B-260.
 *
 * El sistema visual pinta el mes en `display-lg`: la display a 72px en versalitas.
 * `nombreDeMes` devuelve «Septiembre de 2026», y esa cadena entera a 72px no
 * entra en un teléfono ni en la mitad de los escritorios — y lo que hay que
 * agrandar es **el mes**, que es lo que estructura la lista; el año es un dato de
 * desambiguación que casi siempre es el corriente.
 *
 * Así que se parte, y se parte **acá y no en el componente**: el corte depende del
 * idioma (`es-AR` mete un «de» en el medio) y partir una cadena formateada con un
 * `split(' de ')` en el markup es exactamente la clase de derivación que se rompe
 * el día que cambie el `Intl`. Acá sale de las partes, no de deshacer el formato.
 */
export const partesDeMes = (clave: string): { mes: string; anio: string } => {
  const [anio, mes] = clave.split('-').map(Number);
  if (!anio || !mes) return { mes: clave, anio: '' };
  const d = new Date(Date.UTC(anio, mes - 1, 15, 12));
  const texto = fmt({ month: 'long' }).format(d);
  return { mes: texto.charAt(0).toUpperCase() + texto.slice(1), anio: String(anio) };
};

/**
 * `{ dia: '4', diaSemana: 'jue', mes: 'sep' }` — las tres piezas del **bloque de
 * fecha**, que es el gesto central del sistema visual (B-260).
 *
 * Va acá y no en el componente por el mismo motivo que todo lo demás de este
 * módulo: **el `timeZone` explícito** (trampa 1). `d.getDate()` devuelve el día
 * del reloj de quien mira, así que un encuentro del 1 de septiembre a las 00:30
 * de Buenos Aires sale «31» en un navegador en Madrid — y el bloque de fecha es
 * justamente el dato más grande de la fila.
 */
export const partesDeFecha = (d: Date): { dia: string; diaSemana: string; mes: string } => {
  const p = Object.fromEntries(
    fmt({ weekday: 'short', day: 'numeric', month: 'short' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return {
    dia: p.day ?? '',
    // `es-AR` devuelve `jue.` con el punto; en versalitas el punto sobra.
    diaSemana: (p.weekday ?? '').replace('.', ''),
    // Y `sept` para septiembre, que es el único de cuatro letras: se recorta acá
    // igual que en `fechaCorta`, para que las dos digan el mes del mismo largo.
    mes: (p.month ?? '').replace('.', '').replace(/\bsept\b/, 'sep'),
  };
};

/** `Septiembre de 2026` — el nombre completo del mes, para textos en prosa. */
export const nombreDeMes = (clave: string): string => {
  const [anio, mes] = clave.split('-').map(Number);
  if (!anio || !mes) return clave;
  // Mediodía UTC: cualquier hora sirve, y el mediodía no se corre de día por el
  // offset de -3 como sí lo haría la medianoche.
  const d = new Date(Date.UTC(anio, mes - 1, 15, 12));
  const texto = fmt({ month: 'long', year: 'numeric' }).format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/**
 * ISO **con el offset de Buenos Aires**, para el JSON-LD (regla 1 del §5.3 del
 * diseño): `2026-09-24T19:00:00-03:00`.
 *
 * `toPublic` serializa a UTC (`toISOString()`), y `2026-09-24T22:00:00.000Z` es
 * el mismo instante — pero un consumidor que lo muestre sin convertir dice
 * «22:00» y la gente llega tarde. Emitir el offset explícito saca la ambigüedad
 * sin depender de que nadie haga nada bien.
 *
 * El offset **se lee de `Intl`, no se hardcodea**: Argentina hoy no tiene horario
 * de verano, pero lo tuvo hasta 2009 y la decisión de volver a tenerlo es
 * política. Un `-03:00` escrito a mano se convierte en una hora de error en
 * silencio el día que eso cambie.
 */
export const isoConOffset = (d: Date): string => {
  const p = partes(d);
  // `longOffset` da `GMT-03:00`; el ISO quiere `-03:00`. `GMT` pelado es UTC.
  const offset = (p.timeZoneName ?? '').replace('GMT', '') || '+00:00';
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
};

/**
 * `3 sep – 22 oct` — el rango de un ciclo, para la línea de la tarjeta.
 *
 * Con una sola fecha devuelve esa fecha sola: un rango `3 sep – 3 sep` se lee
 * como un error de software.
 */
export const rangoCorto = (desde: Date, hasta: Date): string => {
  const a = fmt({ day: 'numeric', month: 'short' }).format(desde).replace(/\bsept\b/, 'sep');
  const b = fmt({ day: 'numeric', month: 'short' }).format(hasta).replace(/\bsept\b/, 'sep');
  return a === b ? a : `${a} – ${b}`;
};
