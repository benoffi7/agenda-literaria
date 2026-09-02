/**
 * Lógica de la vista calendario del panel (B-125, D-70, D-71, D-72).
 *
 * El listado muestra **una tarjeta por actividad**: un club de ocho encuentros
 * es una actividad y no ocho (§2.2). Un calendario, en cambio, muestra días, y
 * ese mismo club aparece ocho veces. Las dos formas son correctas porque
 * responden preguntas distintas, y este módulo es la que traduce del eje de
 * actividades al eje de encuentros: toma las `ActividadConId` que el listado ya
 * tiene en memoria y devuelve un `Encuentro` por sesión, cada uno con el número
 * que ocupa dentro de su actividad ("2 de 8") para que nunca se lea como ocho
 * actividades distintas. La unidad de edición sigue siendo la actividad (D-70).
 *
 * **El estado de publicación no es el campo `estado`.** La pregunta que se
 * contesta mirando un calendario es *¿esto ya lo ve la gente?*, y eso depende de
 * tres datos a la vez: el estado de la actividad, si el encuentro está
 * cancelado, y si la sesión tiene `calendarEventId` —o sea si el evento existe
 * de verdad en el calendario público—. La regla de los dos primeros **no se
 * reimplementa acá**: se importa `debeExistir` de `@calendario`, la misma
 * función que usa el sync para decidir (D-20). Si se copiara, el panel diría una
 * cosa y el calendario público tendría otra, que es exactamente la divergencia
 * que el alias existe para evitar.
 *
 * **Zona horaria (trampa 1).** Agrupar por día se hace en la zona del proyecto y
 * nunca en UTC: un encuentro de las 21:00 en Buenos Aires es 00:00 UTC del día
 * siguiente, y agrupado en UTC aparecería un día después. Mismo error que
 * `fechaLegible` de `novedades.ts` evita al no pasar por `new Date`.
 *
 * **El reloj entra como parámetro** (`ahora`), como en `functions/rebuild.js`:
 * así un test puede pararse en cualquier momento sin esperar a que llegue la
 * fecha.
 */
import { TIMEZONE, debeExistir, numeroDeEncuentro } from '@calendario';
import { nombreDeMes } from '@/lib/meses';
import { instanteDeTimestamp as instante } from '@/lib/sesiones';
import type { Actividad, ActividadConId, Estado, Sesion } from '@/types/actividad';

// ─────────────────────────────────────────────────────────────────
// Fechas en la zona del proyecto (trampa 1)
// ─────────────────────────────────────────────────────────────────

/**
 * Las partes de la fecha civil de un instante, en la zona del proyecto.
 *
 * `Intl` con `timeZone` explícito es lo único que traduce bien un instante a la
 * fecha del calendario argentino. Los getters de `Date` responden en la zona de
 * quien mira, que en el teléfono de alguien de viaje no es la del proyecto.
 */
const partesCiviles = (instante: Date): { anio: string; mes: string; dia: string } => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return { anio: parte('year'), mes: parte('month'), dia: parte('day') };
};

/** `'AAAA-MM-DD'` del instante, en la zona del proyecto. Es la clave del día. */
export const claveDia = (instante: Date): string => {
  const { anio, mes, dia } = partesCiviles(instante);
  return `${anio}-${mes}-${dia}`;
};

/** `'AAAA-MM'` — el mes al que pertenece una clave de día (o un instante). */
export const claveMes = (diaOInstante: string | Date): string =>
  typeof diaOInstante === 'string' ? diaOInstante.slice(0, 7) : claveDia(diaOInstante).slice(0, 7);

/** `'19:00'` en la zona del proyecto. `h23` para que la medianoche sea `00:00`. */
export const horaLegible = (instante: Date): string =>
  new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante);

/**
 * `'lunes 24 de agosto · 19:00'` — un instante completo, para el listado.
 *
 * Se compone de las dos funciones de arriba, así que la zona del proyecto la
 * aplica una sola vez y en un solo lugar.
 */
export const fechaHoraLegible = (instante: Date): string =>
  `${diaLegible(claveDia(instante))} · ${horaLegible(instante)}`;



const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Iniciales de la fila de encabezado de la grilla, arrancando en lunes. */
export const INICIALES_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** `'2026-08'` → `'agosto de 2026'`. */
export const nombreMes = (mes: string): string => {
  const [anio, numero] = mes.split('-');
  const nombre = nombreDeMes(numero!);
  return nombre && anio ? `${nombre} de ${anio}` : mes;
};

/**
 * Corre `delta` meses sobre `'AAAA-MM'`, con aritmética de enteros y sin pasar
 * por `Date`: el 31 de marzo menos un mes es una de las trampas clásicas de
 * `setMonth`, y acá el día no participa.
 */
export const mesRelativo = (mes: string, delta: number): string => {
  const [anio, numero] = mes.split('-').map(Number);
  if (!anio || !numero) return mes;
  const total = anio * 12 + (numero - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
};

/**
 * Índice del día de la semana de una clave de día, con el lunes en 0 (que es
 * cómo se lee un calendario acá, no como lo numera `getDay`).
 *
 * Se calcula con `Date.UTC` a propósito: una clave `'AAAA-MM-DD'` es una fecha
 * del calendario, no un instante, así que la cuenta no tiene que involucrar
 * ninguna zona horaria. Usar `new Date('2026-08-01')` sí la involucraría.
 */
const diaSemana = (dia: string): number => {
  const [anio, mes, numero] = dia.split('-').map(Number);
  return (new Date(Date.UTC(anio ?? 1970, (mes ?? 1) - 1, numero ?? 1)).getUTCDay() + 6) % 7;
};

/** `'lunes 24 de agosto'` — el encabezado de un día en la vista agenda. */
export const diaLegible = (dia: string): string => {
  const [, mes, numero] = dia.split('-');
  const nombre = nombreDeMes(mes!);
  if (!nombre || !numero) return dia;
  return `${DIAS_SEMANA[diaSemana(dia)]} ${Number(numero)} de ${nombre}`;
};

/** Cantidad de días del mes, sin depender de zonas. */
const diasDelMes = (mes: string): number => {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio ?? 1970, numero ?? 1, 0)).getUTCDate();
};

/**
 * La grilla de un mes: filas de siete, arrancando en lunes. `null` es una celda
 * que pertenece a otro mes.
 *
 * Se devuelven las claves de día y no objetos: la grilla es el esqueleto y los
 * encuentros se buscan con `porDia`. Así el mismo cálculo sirve para el mes
 * vacío, que es un caso real (un mes sin nada cargado tiene que verse, no
 * desaparecer).
 */
export const semanasDelMes = (mes: string): (string | null)[][] => {
  const total = diasDelMes(mes);
  const celdas: (string | null)[] = Array.from({ length: diaSemana(`${mes}-01`) }, () => null);
  for (let d = 1; d <= total; d += 1) celdas.push(`${mes}-${String(d).padStart(2, '0')}`);
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
};

// ─────────────────────────────────────────────────────────────────
// Estado de publicación (§7.3 + `calendarEventId`)
// ─────────────────────────────────────────────────────────────────

export const ESTADOS_PUBLICACION = [
  'en-calendario',
  'falta-en-calendario',
  'sobra-en-calendario',
  'encuentro-cancelado',
  'borrador',
  'pendiente',
  'cancelado',
] as const;
export type EstadoPublicacion = (typeof ESTADOS_PUBLICACION)[number];

/** Para el resumen: lo único que importa es si la gente lo ve o no. */
export type GrupoPublicacion = 'visible' | 'problema' | 'oculto';

export interface InfoPublicacion {
  /** Lo que se lee en el chip del encuentro. */
  etiqueta: string;
  /** Qué significa, en el idioma de quien carga actividades. */
  significa: string;
  grupo: GrupoPublicacion;
}

/**
 * Qué dice cada estado. Es contenido y no componentes por la misma razón que
 * `ayuda.ts`: se puede testear, y quien agregue un estado nuevo tiene que
 * escribir qué significa en el mismo lugar. Los colores viven en el componente
 * —eso es pintar— y este módulo no sabe de Tailwind.
 */
export const INFO_PUBLICACION: Record<EstadoPublicacion, InfoPublicacion> = {
  'en-calendario': {
    etiqueta: 'En el calendario',
    significa: 'La gente lo ve en el calendario público.',
    grupo: 'visible',
  },
  'falta-en-calendario': {
    etiqueta: 'Falta en el calendario',
    significa:
      'Debería estar publicado y su evento todavía no existe. Si acabás de guardar, esperá ' +
      'unos segundos y refrescá: la publicación tarda un momento. Si sigue así, no llegó a ' +
      'correr o falló, y volver a guardar la actividad lo reintenta.',
    grupo: 'problema',
  },
  'sobra-en-calendario': {
    etiqueta: 'Sobra en el calendario',
    significa:
      'No debería estar publicado y su evento todavía figura: puede seguir viéndose en el ' +
      'calendario público. Si acabás de guardar, esperá unos segundos y refrescá.',
    grupo: 'problema',
  },
  'encuentro-cancelado': {
    etiqueta: 'Encuentro cancelado',
    significa:
      'La actividad está publicada pero este encuentro se canceló, así que su evento se borró ' +
      'del calendario. El encuentro queda acá como registro.',
    grupo: 'oculto',
  },
  borrador: {
    etiqueta: 'Borrador',
    significa: 'La actividad está en borrador: no hay nada de ella en el calendario.',
    grupo: 'oculto',
  },
  pendiente: {
    etiqueta: 'Pendiente',
    significa: 'La actividad está pendiente: todavía no hay nada de ella en el calendario.',
    grupo: 'oculto',
  },
  cancelado: {
    etiqueta: 'Actividad cancelada',
    significa: 'La actividad está cancelada: sus eventos se borraron del calendario.',
    grupo: 'oculto',
  },
};

/** Lo mínimo que hace falta de una actividad para derivar el estado. */
type ActividadParaEstado = Pick<Actividad, 'estado'>;
/** Lo mínimo que hace falta de una sesión. */
type SesionParaEstado = Pick<Sesion, 'cancelada' | 'calendarEventId'>;

/**
 * ¿Esto ya lo ve la gente? — la pregunta de la vista calendario.
 *
 * `debeExistir` (de `@calendario`, la misma que usa el sync) responde si el
 * evento *debería* existir; `calendarEventId` dice si *existe*. Cruzarlas es lo
 * que hace visible el caso que hoy no muestra ninguna pantalla:
 *
 * | debería | existe | qué es |
 * |---|---|---|
 * | sí | sí | `en-calendario` — publicado de verdad |
 * | sí | no | `falta-en-calendario` — **el sync no corrió o falló** |
 * | no | sí | `sobra-en-calendario` — el borrado no se completó |
 * | no | no | coherente: el motivo lo da el estado (abajo) |
 *
 * `calendarEventId` es fiable en las dos direcciones porque la Function lo
 * escribe al crear el evento y lo vuelve a `null` al borrarlo (`functions/
 * index.js`), incluso cuando Calendar responde que el evento ya no estaba.
 */
export const estadoPublicacion = (
  actividad: ActividadParaEstado,
  sesion: SesionParaEstado,
): EstadoPublicacion => {
  const deberiaExistir = debeExistir(actividad, sesion);
  const existe = Boolean(sesion.calendarEventId);

  if (deberiaExistir) return existe ? 'en-calendario' : 'falta-en-calendario';
  if (existe) return 'sobra-en-calendario';

  // Sin evento y no debería tenerlo: queda decir por qué. Si la actividad está
  // publicada, `debeExistir` solo pudo dar `false` por la cancelación del
  // encuentro; si no, el motivo es el estado de la actividad.
  if (actividad.estado === 'publicado') return 'encuentro-cancelado';
  return actividad.estado;
};

// ─────────────────────────────────────────────────────────────────
// Del eje de actividades al eje de encuentros (D-70)
// ─────────────────────────────────────────────────────────────────

export interface Encuentro {
  /** Para editar: la unidad de edición sigue siendo la actividad (§2.2, D-70). */
  actividadId: string;
  titulo: string;
  /** Slug del tipo. La etiqueta la resuelve quien pinta (§4.1). */
  tipo: string;
  estadoActividad: Estado;
  sesionId: string;
  inicio: Date;
  fin: Date;
  /** `'AAAA-MM-DD'` en la zona del proyecto. */
  dia: string;
  /** `'19:00'` en la zona del proyecto. */
  hora: string;
  tema: string | null;
  cancelada: boolean;
  /**
   * Posición cronológica dentro de su actividad, y total de encuentros de esa
   * actividad: "2 de 8". Es lo que evita que un ciclo se lea como ocho
   * actividades distintas.
   *
   * **La cuenta no se hace acá: sale de `numeroDeEncuentro` de `@calendario`**
   * (B-163, D-20), la misma que arma el "Encuentro 2 de 8" del evento público.
   * Antes cada lado ordenaba y contaba por su cuenta y coincidían porque los dos
   * habían llegado al mismo criterio, no porque fuera el mismo código — que es
   * la forma que D-71 y D-20 evitan, y que produjo B-84 (el panel decía "6 de 8"
   * y el evento "5 de 7" para el mismo encuentro).
   *
   * Se numeran **todos** los encuentros, incluidos los cancelados (D-95): el
   * número es la fila del formulario, no un recuento de los que siguen en pie.
   *
   * Lo que **sigue** decidido por separado es *cuándo se muestra*: el evento
   * numera solo si `esCiclo` está tildado (`elEventoNumeraElCiclo`) y esta vista
   * numera cualquier actividad de más de una sesión. Es la mitad abierta de
   * B-163, y es una decisión de producto, no una cuenta duplicada.
   */
  indice: number;
  total: number;
  estado: EstadoPublicacion;
}

/** ¿La sesión tiene fechas usables? Un documento roto no debe vaciar la vista. */

/**
 * Todos los encuentros de todas las actividades, en orden cronológico.
 *
 * Es una función pura sobre lo que el panel ya tiene en memoria
 * (`listarActividades` trae la colección completa): cero lecturas nuevas de
 * Firestore, el mismo principio del §2.5.
 */
export const encuentrosDe = (actividades: ActividadConId[]): Encuentro[] => {
  const encuentros: Encuentro[] = [];

  for (const actividad of actividades) {
    // El orden del array no es necesariamente cronológico (§7.4), así que el
    // "2 de 8" se numera por fecha.
    const ordenadas = (actividad.sesiones ?? [])
      .map((sesion) => ({ sesion, inicio: instante(sesion.inicio) }))
      .filter((s): s is { sesion: Sesion; inicio: Date } => s.inicio !== null)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

    ordenadas.forEach(({ sesion, inicio }) => {
      // B-163 — el número lo da `@calendario`, sobre el array **completo** de la
      // actividad y no sobre `ordenadas`: `ordenadas` descarta las sesiones sin
      // fecha usable para no vaciar la vista, y descontarlas del total le correría
      // el número a todas las demás respecto de lo que dice el evento publicado.
      const numero = numeroDeEncuentro(actividad, sesion);
      encuentros.push({
        actividadId: actividad.id,
        titulo: actividad.titulo,
        tipo: actividad.tipo,
        estadoActividad: actividad.estado,
        sesionId: sesion.id,
        inicio,
        fin: instante(sesion.fin) ?? inicio,
        dia: claveDia(inicio),
        hora: horaLegible(inicio),
        tema: sesion.tema ?? null,
        cancelada: sesion.cancelada,
        indice: numero?.indice ?? 1,
        total: numero?.total ?? ordenadas.length,
        estado: estadoPublicacion(actividad, sesion),
      });
    });
  }

  return encuentros.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
};

/** Los encuentros de un mes (`'AAAA-MM'`), en orden cronológico. */
export const encuentrosDelMes = (encuentros: Encuentro[], mes: string): Encuentro[] =>
  encuentros.filter((e) => claveMes(e.dia) === mes);

export interface DiaConEncuentros {
  dia: string;
  encuentros: Encuentro[];
}

/**
 * Agrupa por día civil de la zona del proyecto. Los días sin nada **no
 * aparecen**: es la vista de mobile, donde una grilla con 20 celdas vacías no
 * se lee (D-72).
 */
export const agruparPorDia = (encuentros: Encuentro[]): DiaConEncuentros[] => {
  const porClave = new Map<string, Encuentro[]>();
  for (const e of encuentros) {
    const existentes = porClave.get(e.dia);
    if (existentes) existentes.push(e);
    else porClave.set(e.dia, [e]);
  }
  return [...porClave.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, lista]) => ({
      dia,
      encuentros: [...lista].sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
    }));
};

/** Índice por día, para que la grilla no recorra la lista en cada celda. */
export const porDia = (encuentros: Encuentro[]): Map<string, Encuentro[]> =>
  new Map(agruparPorDia(encuentros).map(({ dia, encuentros: lista }) => [dia, lista]));

/**
 * Meses que tienen al menos un encuentro, del más viejo al más nuevo.
 *
 * B-128 — **el orden se produce acá, no se recibe.** Hasta acá la función se
 * apoyaba en que `encuentrosDe` ya había ordenado por fecha: es cierto hoy y no
 * lo dice ninguna firma, porque el parámetro es un `Encuentro[]` cualquiera.
 * Cualquier lista armada de otra forma —el resultado de un `Map` recorrido en
 * orden de inserción, dos meses concatenados al revés, un filtro que reordena—
 * devolvía los meses en orden arbitrario, y quien elige `[0]` o `.at(-1)` abría
 * la vista en un mes cualquiera sin que nada falle ni nadie se entere.
 *
 * Las claves son `'AAAA-MM'`, así que el orden lexicográfico **es** el
 * cronológico y no hace falta pasar por `Date`.
 */
export const mesesConEncuentros = (encuentros: Encuentro[]): string[] =>
  [...new Set(encuentros.map((e) => claveMes(e.dia)))].sort();

/**
 * El mes con encuentros más cercano a `mes`, mirando primero hacia adelante.
 *
 * Un mes vacío tiene que decir algo más útil que "no hay nada": sin esto, quien
 * abre el calendario en un mes tranquilo tiene que adivinar para qué lado
 * apretar la flecha.
 */
export const mesMasCercanoConEncuentros = (meses: string[], mes: string): string | null => {
  const ordenados = [...meses].sort();
  return ordenados.find((m) => m > mes) ?? ordenados.filter((m) => m < mes).at(-1) ?? null;
};

export interface ResumenPublicacion {
  visible: number;
  problema: number;
  oculto: number;
  total: number;
  /** Cuántas actividades distintas hay detrás de esos encuentros (§2.2). */
  actividades: number;
}

/**
 * El resumen que encabeza la vista. Cuenta encuentros **y** actividades a
 * propósito: "12 encuentros de 3 actividades" es lo que impide leer un ciclo
 * como doce cosas distintas.
 */
export const resumenPublicacion = (encuentros: Encuentro[]): ResumenPublicacion => {
  const resumen = { visible: 0, problema: 0, oculto: 0 };
  for (const e of encuentros) resumen[INFO_PUBLICACION[e.estado].grupo] += 1;
  return {
    ...resumen,
    total: encuentros.length,
    actividades: new Set(encuentros.map((e) => e.actividadId)).size,
  };
};

/** Los que no coinciden con el grupo elegido se esconden. `null` es "todos". */
export const filtrarPorGrupo = (
  encuentros: Encuentro[],
  grupo: GrupoPublicacion | null,
): Encuentro[] =>
  grupo ? encuentros.filter((e) => INFO_PUBLICACION[e.estado].grupo === grupo) : encuentros;

/** ¿El encuentro ya terminó? Se mira el fin, no el inicio: hoy sigue siendo hoy. */
export const yaPaso = (encuentro: Encuentro, ahora: Date): boolean =>
  encuentro.fin.getTime() < ahora.getTime();

export interface ProblemasDePublicacion {
  /** Accionables: se arreglan volviendo a guardar la actividad. */
  porVenir: Encuentro[];
  /** Ya pasaron: no tienen arreglo, son el registro de que no se publicó. */
  pasados: Encuentro[];
  /** Meses donde hay algo por venir, para poder ir hasta ahí. */
  meses: string[];
}

/**
 * Los encuentros cuyo estado en el calendario no es el que debería ser, en
 * **todos** los meses.
 *
 * Es lo que hace visible el caso invisible: si el aviso solo mirara el mes que
 * se está viendo, un encuentro sin publicar en noviembre seguiría sin que nadie
 * se entere, que es justo el problema que esta vista viene a resolver.
 */
export const problemasDePublicacion = (
  encuentros: Encuentro[],
  ahora: Date,
): ProblemasDePublicacion => {
  const problemas = encuentros.filter((e) => INFO_PUBLICACION[e.estado].grupo === 'problema');
  const porVenir = problemas.filter((e) => !yaPaso(e, ahora));
  return {
    porVenir,
    pasados: problemas.filter((e) => yaPaso(e, ahora)),
    // Ordenado por lo mismo que `mesesConEncuentros` (B-128): `mesInicial` elige
    // `meses[0]` y promete "el mes del primer problema por venir", así que el
    // orden es parte del resultado y no algo que se hereda del argumento.
    meses: [...new Set(porVenir.map((e) => claveMes(e.dia)))].sort(),
  };
};

/**
 * El mes por el que conviene abrir la vista: el del primer problema por venir
 * si hay alguno, y si no el de hoy.
 *
 * Abrir en el mes de hoy y dejar el problema a dos clicks es la forma de que
 * nadie lo vea nunca.
 */
export const mesInicial = (encuentros: Encuentro[], ahora: Date): string => {
  const { meses } = problemasDePublicacion(encuentros, ahora);
  return meses[0] ?? claveMes(ahora);
};

// ─────────────────────────────────────────────────────────────────
// Cierres de inscripción (B-126)
// ─────────────────────────────────────────────────────────────────

/**
 * `inscripcion.cierra` en el eje del calendario: un marcador más, en el día que
 * le toca (B-126).
 *
 * **Por qué está acá y no en el listado.** Es una fecha con la misma urgencia
 * que un encuentro y ninguna pantalla la mostraba: pasada, la actividad sigue
 * publicada invitando a anotarse, con el mail o el WhatsApp a la vista. El
 * listado ordena por *próximo encuentro*, así que un cierre que vence mañana
 * queda enterrado detrás de actividades cuyo primer encuentro es en dos meses.
 * Un calendario es exactamente la forma que le corresponde.
 *
 * **No es un `Encuentro`.** Se le parece —tiene día, hora y actividad— y
 * mezclarlos sería lo cómodo, pero un cierre no tiene `sesionId`, no tiene
 * `calendarEventId`, no sale al calendario público y no participa del "2 de 8".
 * Metido en `Encuentro[]` habría que acordarse de excluirlo en `resumenPublicacion`,
 * en `problemasDePublicacion`, en `estadoPublicacion` y en el filtro por grupo:
 * cuatro lugares donde olvidarse no rompe nada visible y deja las cuentas mal.
 * Tipo aparte, cero olvidos posibles.
 */
export interface Cierre {
  /** Para editar: se abre la actividad, como con un encuentro (D-70). */
  actividadId: string;
  titulo: string;
  /** Slug del tipo. La etiqueta la resuelve quien pinta (§4.1). */
  tipo: string;
  /** El instante exacto del cierre. */
  instante: Date;
  /** `'AAAA-MM-DD'` en la zona del proyecto (trampa 1). */
  dia: string;
  /** `'19:00'` en la zona del proyecto. */
  hora: string;
  cupo: number | null;
  /**
   * D-127 — «se llenó». Se lee con default `false` y determinístico: los
   * documentos anteriores a B-97 no tienen el campo, y derivarlo (comparar el
   * cupo contra algo, mirar la hora) es la trampa que ese ADR cierra.
   */
  completo: boolean;
}

export const ESTADOS_CIERRE = ['por-venir', 'vencido', 'cupo-completo'] as const;
export type EstadoCierre = (typeof ESTADOS_CIERRE)[number];

export interface InfoCierre {
  /** Lo que se lee en el marcador. */
  etiqueta: string;
  /** Qué significa, en el idioma de quien carga actividades. */
  significa: string;
  /** ¿Hay algo que hacer? Es lo que decide si el aviso de arriba lo cuenta. */
  urge: boolean;
}

/**
 * Qué dice cada estado de cierre, con el mismo criterio que `INFO_PUBLICACION`:
 * el texto es contenido testeable y los colores viven en el componente.
 */
export const INFO_CIERRE: Record<EstadoCierre, InfoCierre> = {
  'por-venir': {
    etiqueta: 'Cierra la inscripción',
    significa:
      'Ese día se cierra la inscripción. El sitio deja de mostrarla como abierta, pero la ' +
      'actividad sigue publicada con su canal de contacto: cuando la fecha pase conviene ' +
      'correrla o marcar que se llenó.',
    urge: false,
  },
  vencido: {
    etiqueta: 'Inscripción cerrada',
    significa:
      'La inscripción ya cerró y la actividad sigue publicada invitando a anotarse. Si todavía ' +
      'entra gente, corré la fecha; si no entra nadie más, marcá «se llenó» desde el menú «⋯» ' +
      'del listado y el cartel sale al sitio y a los eventos del calendario.',
    urge: true,
  },
  'cupo-completo': {
    etiqueta: 'Cupo completo',
    significa:
      'La actividad se llenó, así que su fecha de cierre no tiene nada pendiente. El canal de ' +
      'contacto sigue publicado a propósito (D-127): siempre hay bajas y lista de espera.',
    urge: false,
  },
};

/**
 * El estado del cierre. **`completo` gana sobre la fecha**, y ese es el punto de
 * cruzar los dos campos: una actividad que se llenó y cuyo cierre venció no
 * tiene nada que arreglar —está exactamente como debe estar—, y contarla como
 * problema haría que el aviso se dispare en el caso más común y sano de todos.
 * Un aviso que se enciende siempre se apaga en la cabeza de quien lo mira.
 */
export const estadoCierre = (cierre: Cierre, ahora: Date): EstadoCierre => {
  if (cierre.completo) return 'cupo-completo';
  return cierre.instante.getTime() < ahora.getTime() ? 'vencido' : 'por-venir';
};

/**
 * Los cierres de inscripción de las actividades que la gente ve, en orden
 * cronológico.
 *
 * Tres filtros, y los tres son la diferencia entre un marcador y un ruido:
 *
 * - **Solo `estado === 'publicado'`.** La urgencia del ítem es "sigue publicada
 *   invitando a anotarse": el cierre de un borrador no invita a nadie, y pintarlo
 *   llenaría el calendario de fechas que no piden nada.
 * - **Solo con `inscripcion.requiere`.** `formADocumento` guarda `cierra` sin
 *   preguntar si la inscripción hace falta, así que una actividad que dejó de
 *   requerir inscripción puede arrastrar una fecha vieja. Sin este filtro
 *   aparecería un cierre para algo que no se inscribe.
 * - **Solo con una fecha usable**, vía `instanteDeTimestamp`: la misma
 *   conversión de la trampa 1 que usan las sesiones, y un documento roto no
 *   tiene que vaciar la vista.
 */
export const cierresDe = (actividades: ActividadConId[]): Cierre[] => {
  const cierres: Cierre[] = [];

  for (const actividad of actividades) {
    if (actividad.estado !== 'publicado') continue;
    const inscripcion = actividad.inscripcion;
    if (!inscripcion?.requiere) continue;
    const cuando = instante(inscripcion.cierra);
    if (!cuando) continue;

    cierres.push({
      actividadId: actividad.id,
      titulo: actividad.titulo,
      tipo: actividad.tipo,
      instante: cuando,
      dia: claveDia(cuando),
      hora: horaLegible(cuando),
      cupo: inscripcion.cupo ?? null,
      completo: inscripcion.completo === true,
    });
  }

  return cierres.sort((a, b) => a.instante.getTime() - b.instante.getTime());
};

/** Los cierres de un mes (`'AAAA-MM'`), por clave de día y no por el instante. */
export const cierresDelMes = (cierres: Cierre[], mes: string): Cierre[] =>
  cierres.filter((c) => claveMes(c.dia) === mes);

/** Índice por día, para que la grilla no recorra la lista en cada celda. */
export const porDiaCierres = (cierres: Cierre[]): Map<string, Cierre[]> => {
  const porClave = new Map<string, Cierre[]>();
  for (const c of [...cierres].sort((a, b) => a.instante.getTime() - b.instante.getTime())) {
    const existentes = porClave.get(c.dia);
    if (existentes) existentes.push(c);
    else porClave.set(c.dia, [c]);
  }
  return porClave;
};

export interface CierresQueUrgen {
  /** Cerrados y sin marcar como llenos: la actividad sigue invitando. */
  vencidos: Cierre[];
  /** Meses donde hay alguno, para poder ir hasta ahí. */
  meses: string[];
}

/**
 * Los cierres que piden algo, en **todos** los meses.
 *
 * Mismo criterio que `problemasDePublicacion` y por el mismo motivo: si el aviso
 * solo mirara el mes que se está viendo, una inscripción vencida en noviembre
 * seguiría sin que nadie se entere mientras se mira septiembre.
 */
export const cierresQueUrgen = (cierres: Cierre[], ahora: Date): CierresQueUrgen => {
  const vencidos = cierres.filter((c) => INFO_CIERRE[estadoCierre(c, ahora)].urge);
  return {
    vencidos,
    // Ordenado por lo mismo que `mesesConEncuentros` (B-128): el orden es parte
    // del resultado, no algo que se hereda del argumento.
    meses: [...new Set(vencidos.map((c) => claveMes(c.dia)))].sort(),
  };
};

export interface DiaDeAgenda {
  dia: string;
  encuentros: Encuentro[];
  cierres: Cierre[];
}

/**
 * La agenda de mobile: los días que tienen **algo**, encuentros o cierres, uno
 * abajo del otro (D-72).
 *
 * Existe para que un día con un cierre y ningún encuentro **aparezca**. Con
 * `agruparPorDia` solo, el marcador de B-126 se perdía justo en el caso que más
 * importa: la actividad de un solo encuentro lejano cuya inscripción cierra la
 * semana que viene.
 */
export const agendaDe = (encuentros: Encuentro[], cierres: Cierre[]): DiaDeAgenda[] => {
  const porDiaEncuentros = new Map(
    agruparPorDia(encuentros).map(({ dia, encuentros: lista }) => [dia, lista]),
  );
  const indiceCierres = porDiaCierres(cierres);
  const dias = [...new Set([...porDiaEncuentros.keys(), ...indiceCierres.keys()])].sort();

  return dias.map((dia) => ({
    dia,
    encuentros: porDiaEncuentros.get(dia) ?? [],
    cierres: indiceCierres.get(dia) ?? [],
  }));
};
