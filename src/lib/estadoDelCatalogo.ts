import { tieneFuturo } from '@/lib/filtrosActividades';
import { faltaElFlyer, imagenesDe } from '@/lib/imagenes';
import { modalidadesQueOfrece } from '@/lib/modalidades';
import { instanteDeTimestamp } from '@/lib/sesiones';
import { ESTADOS, MODALIDADES } from '@/types/actividad';
import type { ActividadConId, Estado, Modalidad } from '@/types/actividad';

/**
 * El estado del catálogo: lo que se sabe **sin medir a nadie** — B-370, D-200.
 *
 * Es el primer tramo de [`docs/16-analitica-del-sitio.md`](../../docs/16-analitica-del-sitio.md),
 * y el único que se podía construir sin una decisión del dueño. El pedido era un
 * tablero de estadísticas del sitio; el hecho que lo reordena es que **el sitio
 * público no mide nada**, así que no hay visitas que mostrar. Lo que sí hay es el
 * catálogo, y agrupado contesta tres de las diez preguntas del documento —qué se
 * ofrece, qué de eso no se puede usar, y qué está incompleto— que son justo las
 * que se convierten en trabajo del día siguiente.
 *
 * **Puro y con el reloj como parámetro**, como `filtrosActividades.ts` y
 * `functions/rebuild.js`: un test no puede depender de qué día es hoy, y todo lo
 * de acá depende de la hora (qué ya pasó, qué inscripción cerró, qué quedó
 * esperando).
 *
 * **No hay ninguna derivación nueva de «¿ya pasó?».** `tieneFuturo` viene de
 * `filtrosActividades.ts`, que a su vez delega en `proximaVentana` de
 * `sesiones.ts`, que es la misma aritmética que usa el sitio público. Si esto la
 * escribiera por su cuenta, el tablero podría decir «ya pasó» de una actividad
 * que el listado sigue mostrando arriba y nada fallaría — la clase de bug de
 * B-88, con la agravante de que el tablero existe justamente para que el dueño
 * le crea.
 *
 * **Las etiquetas no se resuelven acá.** Los repartos devuelven **slugs**; la
 * etiqueta sale de `/opciones/*` y la resuelve quien pinta (§4.1). Es lo mismo
 * que hace `opcionesPresentes` y por el mismo motivo: renombrar un label no
 * puede obligar a tocar este módulo.
 */

// ── Los umbrales, con su motivo ────────────────────────────────────

/**
 * Piso de largo de la descripción de una actividad publicada.
 *
 * **No es `LARGO_RESUMEN` de `eventsJson.ts` y no se importa de ahí**, aunque
 * los dos números hablen de la misma descripción: aquél es un **corte** —hasta
 * dónde se recorta para la `meta description`— y éste es un **piso**. Que el
 * corte útil pase de 160 a 180 no dice nada sobre cuándo una descripción es
 * demasiado corta, así que atarlos sería acoplar dos decisiones que no se mueven
 * juntas.
 *
 * 80 es la mitad de ese corte: por debajo, la descripción entera entra en el
 * resultado de Google y aun así sobra lugar, o sea que el resultado sale flaco
 * justo en la página por la que el proyecto existe (§2.3 del `CLAUDE.md`).
 */
export const MINIMO_DESCRIPCION = 80;

/** Cuántos días sin tocarse convierten un borrador en trabajo abandonado. */
export const DIAS_ESPERANDO = 30;

/** La ventana de «lo que se viene» del tablero. */
export const DIAS_PROXIMOS = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// ── Los avisos ─────────────────────────────────────────────────────

/**
 * Las fricciones detectables **sin medir a ningún visitante** (§4 del documento).
 *
 * El orden de esta lista es el orden en que se muestran, y es por **gravedad**,
 * no por cantidad: arriba está lo que le hace perder algo a alguien de afuera
 * (escribir y que no le contesten), abajo lo que nos hace perder algo a nosotros
 * (trabajo hecho que no rinde).
 */
export const CLASES_DE_AVISO = [
  'inscripcion-cerrada',
  'ya-paso',
  'sin-flyer',
  'sin-etiquetas',
  'descripcion-corta',
  'esperando',
] as const;
export type ClaseDeAviso = (typeof CLASES_DE_AVISO)[number];

/** Una actividad señalada por un aviso. Lo mínimo para nombrarla y abrirla. */
export interface ActividadSenalada {
  id: string;
  titulo: string;
}

export interface Aviso {
  clase: ClaseDeAviso;
  /** Qué pasa, en el idioma de quien organiza. */
  titulo: string;
  /** Qué cuesta que pase. Es la mitad que hace que el aviso se atienda. */
  porque: string;
  actividades: ActividadSenalada[];
}

/**
 * El texto de cada aviso. Vive acá y no en el componente por lo mismo que
 * `ETIQUETA_ESTADO`: es parte de qué significa el aviso, y si lo escribe la
 * pantalla, un aviso nuevo puede quedar sin explicación y nada falla.
 */
const TEXTO: Record<ClaseDeAviso, { titulo: string; porque: string }> = {
  'inscripcion-cerrada': {
    titulo: 'Publicadas con la inscripción ya cerrada y encuentros por venir',
    porque:
      'El sitio las sigue ofreciendo. Alguien va a escribir y no va a poder entrar.',
  },
  'ya-paso': {
    titulo: 'Publicadas a las que no les queda ningún encuentro',
    porque: 'Ya pasaron y siguen figurando como publicadas.',
  },
  'sin-flyer': {
    titulo: 'Publicadas sin imagen',
    porque:
      'No aparecen en la cartelera, y el link compartido sale con la imagen genérica del sitio.',
  },
  'sin-etiquetas': {
    titulo: 'Publicadas sin etiquetas',
    porque: 'Están en el sitio pero no se encuentran filtrando por etiqueta.',
  },
  'descripcion-corta': {
    titulo: 'Publicadas con una descripción muy corta',
    porque:
      `Menos de ${MINIMO_DESCRIPCION} caracteres: el resultado en Google queda flaco y ` +
      'es lo que decide el clic.',
  },
  esperando: {
    titulo: `Sin publicar y sin tocarse hace más de ${DIAS_ESPERANDO} días`,
    porque: 'Es trabajo ya hecho que no está rindiendo. Publicalo o descartalo.',
  },
};

// ── El resultado ───────────────────────────────────────────────────

/** Una tajada de un reparto: el slug y cuántas actividades lo tienen. */
export interface Tajada {
  valor: string;
  cantidad: number;
}

export interface EstadoDelCatalogo {
  total: number;
  /** En el orden de `ESTADOS`, no por cantidad: los estados tienen orden propio. */
  porEstado: Tajada[];
  /** Por cantidad y después alfabético: son taxonomías, no tienen orden natural. */
  porTipo: Tajada[];
  porArancel: Tajada[];
  /**
   * En el orden de `MODALIDADES`. Cada actividad cuenta en **cada** forma que
   * ofrece (B-224), así que estas cantidades pueden sumar más que `total`.
   */
  porModalidad: Tajada[];
  ciclos: number;
  sueltas: number;
  encuentros: {
    total: number;
    porVenir: number;
    enLosProximosDias: number;
  };
  publicadas: {
    total: number;
    conFuturo: number;
    conFlyer: number;
    conEtiquetas: number;
    conDescripcionSuficiente: number;
  };
  /** Solo los que tienen al menos una actividad, en el orden de `CLASES_DE_AVISO`. */
  avisos: Aviso[];
}

// ── Los cálculos ───────────────────────────────────────────────────

const senalar = (a: ActividadConId): ActividadSenalada => ({ id: a.id, titulo: a.titulo });

/** Alfabético por título, para que el mismo catálogo dé siempre la misma lista. */
const porTitulo = (a: ActividadSenalada, b: ActividadSenalada): number =>
  a.titulo.localeCompare(b.titulo, 'es');

/**
 * Reparto por un valor único, ordenado por cantidad y desempatado alfabético.
 *
 * El desempate no es cosmético: sin él, dos tipos con la misma cantidad se
 * ordenan por el orden de llegada de `listarActividades()`, que no está
 * garantizado — así que el tablero se reordenaría solo entre dos recargas. Es la
 * misma razón por la que `opcionesPresentes` no deja que el orden salga de los
 * datos.
 */
const repartir = (valores: string[]): Tajada[] => {
  const cuenta = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([valor, cantidad]) => ({ valor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.valor.localeCompare(b.valor, 'es'));
};

/** Reparto sobre un vocabulario fijo: el orden es el del vocabulario. */
const repartirFijo = <T extends string>(valores: T[], vocabulario: readonly T[]): Tajada[] => {
  const cuenta = new Map<string, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  return vocabulario
    .map((valor) => ({ valor, cantidad: cuenta.get(valor) ?? 0 }))
    .filter((t) => t.cantidad > 0);
};

const descripcionCorta = (a: ActividadConId): boolean =>
  (a.descripcion ?? '').trim().length < MINIMO_DESCRIPCION;

/**
 * ¿La inscripción de esta actividad ya cerró?
 *
 * **`inscripcion.completo` no entra acá a propósito.** Que una actividad esté
 * llena y siga mostrando el canal de inscripción es el comportamiento que B-97
 * decidió, y con motivo escrito: «siempre hay lista de espera y las bajas
 * existen — esconder el canal convierte una baja en un lugar que se pierde». O
 * sea que no es una fricción, y meterlo acá convertiría una decisión tomada en un
 * aviso a resolver.
 */
const inscripcionCerrada = (a: ActividadConId, ahora: Date): boolean => {
  if (!a.inscripcion?.requiere) return false;
  const cierra = instanteDeTimestamp(a.inscripcion.cierra);
  return cierra !== null && cierra.getTime() < ahora.getTime();
};

/** Los encuentros que de verdad pueden pasar: ni cancelados, ni de una cancelada. */
const encuentrosVivos = (actividades: ActividadConId[]): [Date, Date][][] =>
  actividades
    .filter((a) => a.estado !== 'cancelado')
    .map((a) =>
      (a.sesiones ?? [])
        .filter((s) => !s.cancelada)
        .map((s) => ({ inicio: instanteDeTimestamp(s.inicio), fin: instanteDeTimestamp(s.fin) }))
        .filter((v): v is { inicio: Date | null; fin: Date } => v.fin !== null)
        .map((v) => [v.inicio ?? v.fin, v.fin] as [Date, Date]),
    );

/**
 * El estado del catálogo, agrupado desde la misma lista que el listado del panel
 * ya tiene en memoria: **cero lecturas de Firestore de más**.
 */
export const estadoDelCatalogo = (
  actividades: ActividadConId[],
  ahora: Date,
): EstadoDelCatalogo => {
  const publicadas = actividades.filter((a) => a.estado === 'publicado');
  const ventanas = encuentrosVivos(actividades).flat();
  const limite = ahora.getTime() + DIAS_PROXIMOS * MS_POR_DIA;
  const viejo = ahora.getTime() - DIAS_ESPERANDO * MS_POR_DIA;

  const candidatos: Record<ClaseDeAviso, ActividadConId[]> = {
    // El peor de los seis: el sitio ofrece algo a lo que no se puede entrar.
    'inscripcion-cerrada': publicadas.filter(
      (a) => tieneFuturo(a, ahora) && inscripcionCerrada(a, ahora),
    ),
    // Con al menos un encuentro cargado: una publicada sin encuentros todavía no
    // «ya pasó», está a medio cargar — y eso lo dice otro aviso o ninguno.
    'ya-paso': publicadas.filter((a) => (a.sesiones ?? []).length > 0 && !tieneFuturo(a, ahora)),
    'sin-flyer': publicadas.filter((a) => faltaElFlyer(imagenesDe(a))),
    'sin-etiquetas': publicadas.filter((a) => (a.tags ?? []).length === 0),
    'descripcion-corta': publicadas.filter(descripcionCorta),
    esperando: actividades.filter(
      (a) =>
        (a.estado === 'borrador' || a.estado === 'pendiente') &&
        (instanteDeTimestamp(a.updatedAt)?.getTime() ?? Number.POSITIVE_INFINITY) < viejo,
    ),
  };

  return {
    total: actividades.length,
    porEstado: repartirFijo(
      actividades.map((a) => a.estado),
      ESTADOS as readonly Estado[],
    ),
    porTipo: repartir(actividades.map((a) => a.tipo)),
    porArancel: repartir(actividades.map((a) => a.arancel?.tipo ?? '')),
    // B-224 — cada actividad cuenta en **cada forma que ofrece**, con la misma
    // regla que el desplegable del listado (`modalidadesQueOfrece`): una con una
    // fila presencial y otra virtual cuenta en las tres. Contar solo la
    // resultante mentiría acá — «2 híbridas» no dice cuántas se pueden hacer
    // desde casa. La consecuencia, que la pantalla tiene que decir: estas
    // cantidades **suman más que el total**.
    porModalidad: repartirFijo(
      actividades.flatMap((a) =>
        modalidadesQueOfrece(a.modalidades ?? [{ modalidad: a.modalidad }]),
      ),
      MODALIDADES as readonly Modalidad[],
    ),
    ciclos: actividades.filter((a) => a.esCiclo).length,
    sueltas: actividades.filter((a) => !a.esCiclo).length,
    encuentros: {
      total: ventanas.length,
      porVenir: ventanas.filter(([, fin]) => fin.getTime() >= ahora.getTime()).length,
      enLosProximosDias: ventanas.filter(
        ([inicio, fin]) =>
          fin.getTime() >= ahora.getTime() && inicio.getTime() <= limite,
      ).length,
    },
    publicadas: {
      total: publicadas.length,
      conFuturo: publicadas.filter((a) => tieneFuturo(a, ahora)).length,
      conFlyer: publicadas.filter((a) => !faltaElFlyer(imagenesDe(a))).length,
      conEtiquetas: publicadas.filter((a) => (a.tags ?? []).length > 0).length,
      conDescripcionSuficiente: publicadas.filter((a) => !descripcionCorta(a)).length,
    },
    avisos: CLASES_DE_AVISO.filter((clase) => candidatos[clase].length > 0).map((clase) => ({
      clase,
      titulo: TEXTO[clase].titulo,
      porque: TEXTO[clase].porque,
      actividades: candidatos[clase].map(senalar).sort(porTitulo),
    })),
  };
};

/**
 * Porcentaje entero para el ancho de una barra. `0` cuando no hay total, en vez
 * de `NaN`: un catálogo vacío tiene que dibujar barras de cero y no romper la
 * pantalla.
 */
export const porcentaje = (parte: number, total: number): number =>
  total > 0 ? Math.round((parte / total) * 100) : 0;
