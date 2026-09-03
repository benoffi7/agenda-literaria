import { ZONA, claveDeDia, diaDeSemana, diaDesplazado } from '@/lib/fechasPublicas';
import type { Encuentro } from '@/lib/calendarioPanel';

/**
 * El **ritmo** del catálogo: cuándo pasan las cosas — B-704, B-705, B-706.
 *
 * Los repartos del tablero contestan *qué* hay cargado. Este módulo contesta
 * *cuándo*, que es la pregunta que un listado no contesta nunca: qué semanas
 * están vacías, qué día de la semana está saturado, si no hay nada a la mañana.
 *
 * ── Sobre qué encuentros ──────────────────────────────────────────────────
 * **No hay un segundo aplanado de sesiones.** Todo lo de acá trabaja sobre los
 * `Encuentro[]` que produce `encuentrosDe` (`lib/calendarioPanel.ts`), que es el
 * mismo que alimenta la grilla del mes. Si esto aplanara por su cuenta, el mapa
 * de calor podría mostrar un encuentro que el calendario no muestra —o al
 * revés— y nada fallaría: es la clase de B-88, con la agravante de que las dos
 * pantallas viven a un clic una de la otra.
 *
 * Cuentan los que **de verdad pueden pasar**: ni cancelados, ni de una actividad
 * cancelada. Es la misma regla que `estadoDelCatalogo` aplica a su cuenta de
 * encuentros, y `tests/ritmo-del-catalogo.test.ts` ata las dos: si divergen, el
 * encabezado del tablero y su mapa de calor contarían distinto.
 *
 * ── Sobre las fechas ──────────────────────────────────────────────────────
 * **Todo pasa por las primitivas de día calendario de `fechasPublicas.ts`**
 * (`claveDeDia`, `diaDesplazado`, `diaDeSemana`), que llevan `timeZone`
 * explícito. Ni un `getDate()` ni un `getDay()`: un encuentro del 15 a las 00:30
 * de Buenos Aires es el 14 para un navegador en UTC (trampa 1), y en un mapa de
 * calor eso lo pinta en la celda de al lado sin que nada se vea roto.
 */

/** Cuántas semanas mira el mapa de calor hacia adelante. */
export const SEMANAS_DEL_MAPA = 8;

/** Los días de la semana como los pinta la grilla, arrancando el lunes. */
export const DIAS_DE_LA_SEMANA = [
  { indice: 0, corto: 'L', largo: 'lunes' },
  { indice: 1, corto: 'M', largo: 'martes' },
  { indice: 2, corto: 'M', largo: 'miércoles' },
  { indice: 3, corto: 'J', largo: 'jueves' },
  { indice: 4, corto: 'V', largo: 'viernes' },
  { indice: 5, corto: 'S', largo: 'sábado' },
  { indice: 6, corto: 'D', largo: 'domingo' },
] as const;

/**
 * El índice del día con el **lunes primero**.
 *
 * `diaDeSemana` devuelve el convenio de `Date` (0 domingo … 6 sábado) y una
 * agenda argentina arranca el lunes: sin este corrimiento, el fin de semana
 * quedaría partido entre las dos puntas de la grilla y «los martes están
 * saturados» habría que contarlo con el dedo.
 */
export const indiceDeSemana = (clave: string): number => (diaDeSemana(clave) + 6) % 7;

// ── Qué encuentros cuentan ─────────────────────────────────────────

/**
 * ¿Este encuentro cuenta para el ritmo?
 *
 * Los cancelados no, ni los de una actividad cancelada: el mapa de calor
 * contesta «¿qué días tengo ocupados?» y un encuentro cancelado es un día
 * libre. Es la **misma** regla que usa `estadoDelCatalogo` para su cuenta de
 * encuentros, y el test la ata a esa.
 *
 * Los borradores y pendientes **sí** cuentan: son trabajo programado que ocupa
 * una fecha, y el tablero existe justamente para ver los huecos antes de
 * publicar. Lo que está cancelado es lo que no va a pasar.
 */
export const cuentaEnElRitmo = (e: Encuentro): boolean =>
  !e.cancelada && e.estadoActividad !== 'cancelado';

// ── El mapa de calor ───────────────────────────────────────────────

/** Una celda del mapa: un día calendario con lo que pasa ese día. */
export interface DiaDelMapa {
  /** `'AAAA-MM-DD'` en la zona del proyecto. */
  clave: string;
  cantidad: number;
  /** `0` (nada) a `3` (lo más cargado). Ver `nivelDeIntensidad`. */
  nivel: number;
  /** Los días de la semana en curso que ya pasaron. Se pintan apagados. */
  yaPaso: boolean;
  esHoy: boolean;
}

export interface MapaDeCalor {
  /** Una fila por semana, siete celdas cada una, siempre. */
  semanas: DiaDelMapa[][];
  /** El día más cargado de la ventana. Es la escala. */
  maximo: number;
  /** Cuántos encuentros entran en la ventana. */
  total: number;
  /** Cuántos días de la ventana no tienen ninguno. Es lo que el mapa vino a decir. */
  diasVacios: number;
}

/**
 * Cuántos niveles tiene la escala, sin contar el cero.
 *
 * Tres y no diez: con diez, la diferencia entre el nivel 4 y el 5 no la
 * distingue nadie y la escala se vuelve decorativa. Con tres —poco, bastante,
 * mucho— la celda se lee de un golpe, que es lo único que un mapa de calor hace
 * mejor que una tabla.
 */
export const NIVELES = 3;

/**
 * Cuántos encuentros tiene que tener el día más cargado para que la escala
 * signifique algo.
 *
 * **Con un máximo de 1 o 2 no hay concentración que mostrar**, y repartir esos
 * dos valores en tres niveles pinta un día con un encuentro del color de «día
 * saturado». Un mapa de calor sobre datos ralos no dice poco: dice mal. Por
 * debajo de este piso hay un solo nivel —hay o no hay— y la pantalla lo aclara.
 */
export const MINIMO_PARA_ESCALA = 3;

/**
 * El nivel de una celda: `0` si no hay nada, `1..NIVELES` si hay.
 *
 * Ver `MINIMO_PARA_ESCALA` para el caso de pocos datos, que es el que importa
 * en un catálogo que recién arranca.
 */
export const nivelDeIntensidad = (cantidad: number, maximo: number): number => {
  if (cantidad <= 0) return 0;
  if (maximo < MINIMO_PARA_ESCALA) return 1;
  return Math.min(NIVELES, Math.ceil((cantidad / maximo) * NIVELES));
};

/** Cuántos encuentros cae en cada día calendario. */
export const encuentrosPorDia = (encuentros: Encuentro[]): Map<string, number> => {
  const cuenta = new Map<string, number>();
  for (const e of encuentros) {
    if (!cuentaEnElRitmo(e)) continue;
    cuenta.set(e.dia, (cuenta.get(e.dia) ?? 0) + 1);
  }
  return cuenta;
};

/**
 * El mapa de calor: `semanas` filas de siete días, desde el **lunes de la semana
 * en curso**.
 *
 * Arranca el lunes de esta semana y no hoy: una fila que empieza un miércoles
 * rompe la columna del día de la semana, que es la mitad de lo que el mapa
 * muestra («los martes están llenos» se ve leyendo una columna). Los días de
 * esta semana que ya pasaron entran igual, marcados con `yaPaso` — sacarlos
 * dejaría un hueco que se confunde con un día libre.
 *
 * La grilla es siempre rectangular: `semanas × 7` celdas, con los días vacíos
 * adentro. Ese es el punto — **los huecos son el dato**, así que no se saltean
 * como hace `agruparPorDia` en la vista de mobile del calendario.
 */
export const mapaDeCalor = (
  encuentros: Encuentro[],
  ahora: Date,
  semanas: number = SEMANAS_DEL_MAPA,
): MapaDeCalor => {
  const hoy = claveDeDia(ahora);
  const inicio = diaDesplazado(hoy, -indiceDeSemana(hoy));
  const cuenta = encuentrosPorDia(encuentros);

  const claves: string[][] = [];
  for (let semana = 0; semana < semanas; semana++) {
    claves.push(
      Array.from({ length: 7 }, (_, dia) => diaDesplazado(inicio, semana * 7 + dia)),
    );
  }
  const planas = claves.flat();
  const cantidades = planas.map((c) => cuenta.get(c) ?? 0);
  const maximo = cantidades.reduce((m, n) => Math.max(m, n), 0);

  return {
    semanas: claves.map((fila) =>
      fila.map((clave) => {
        const cantidad = cuenta.get(clave) ?? 0;
        return {
          clave,
          cantidad,
          nivel: nivelDeIntensidad(cantidad, maximo),
          yaPaso: clave < hoy,
          esHoy: clave === hoy,
        };
      }),
    ),
    maximo,
    total: cantidades.reduce((s, n) => s + n, 0),
    diasVacios: cantidades.filter((n) => n === 0).length,
  };
};

// ── El día de la semana ────────────────────────────────────────────

/** Cuántos encuentros cae en cada día de la semana, de lunes a domingo. */
export const porDiaDeSemana = (encuentros: Encuentro[]): number[] => {
  const cuenta = new Array<number>(7).fill(0);
  for (const e of encuentros) {
    if (!cuentaEnElRitmo(e)) continue;
    cuenta[indiceDeSemana(e.dia)]! += 1;
  }
  return cuenta;
};

// ── La franja horaria ──────────────────────────────────────────────

export const FRANJAS = ['manana', 'tarde', 'noche'] as const;
export type Franja = (typeof FRANJAS)[number];

/**
 * Cómo se llama cada franja y qué horas abarca.
 *
 * Los cortes son los del circuito, no los del reloj: un taller de las 19 en
 * Buenos Aires es **de noche** —se sale del trabajo y se va—, y ponerlo en
 * «tarde» junto con uno de las 14 mezclaría dos públicos que no se parecen en
 * nada. La madrugada se pliega sobre la noche: un encuentro a las 2 AM es un
 * error de carga, y darle una cuarta franja sería inventarle una categoría.
 */
export const INFO_FRANJA: Record<Franja, { etiqueta: string; desde: number; hasta: number }> = {
  manana: { etiqueta: 'Mañana', desde: 5, hasta: 13 },
  tarde: { etiqueta: 'Tarde', desde: 13, hasta: 19 },
  noche: { etiqueta: 'Noche', desde: 19, hasta: 5 },
};

/**
 * La hora del día **en la zona del proyecto**, como número de 0 a 23.
 *
 * `formatToParts` y no `getHours()`: `getHours()` devuelve la hora del reloj de
 * quien mira, así que un taller de las 19 de Buenos Aires sale a las 23 en
 * Madrid y salta de «tarde» a «noche» según dónde esté abierta la pantalla
 * (trampa 1). Y `formatToParts` y no partir el `'19:00'` de `Encuentro.hora`:
 * deshacer un formato para sacarle un número es la derivación que se rompe el
 * día que el `Intl` cambie de forma.
 */
export const horaEnZona = (instante: Date): number => {
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  return Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
};

/** En qué franja cae un instante. */
export const franjaDe = (instante: Date): Franja => {
  const hora = horaEnZona(instante);
  if (hora >= INFO_FRANJA.manana.desde && hora < INFO_FRANJA.manana.hasta) return 'manana';
  if (hora >= INFO_FRANJA.tarde.desde && hora < INFO_FRANJA.tarde.hasta) return 'tarde';
  return 'noche';
};

/** Cuántos encuentros cae en cada franja, en el orden de `FRANJAS`. */
export const porFranja = (encuentros: Encuentro[]): Record<Franja, number> => {
  const cuenta: Record<Franja, number> = { manana: 0, tarde: 0, noche: 0 };
  for (const e of encuentros) {
    if (!cuentaEnElRitmo(e)) continue;
    cuenta[franjaDe(e.inicio)] += 1;
  }
  return cuenta;
};
