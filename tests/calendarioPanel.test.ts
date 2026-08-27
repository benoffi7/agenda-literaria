import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_CIERRE,
  INFO_CIERRE,
  INFO_PUBLICACION,
  ESTADOS_PUBLICACION,
  agendaDe,
  agruparPorDia,
  cierresDe,
  cierresDelMes,
  cierresQueUrgen,
  estadoCierre,
  porDiaCierres,
  claveDia,
  claveMes,
  diaLegible,
  encuentrosDe,
  encuentrosDelMes,
  fechaHoraLegible,
  estadoPublicacion,
  filtrarPorGrupo,
  horaLegible,
  mesInicial,
  mesMasCercanoConEncuentros,
  mesRelativo,
  mesesConEncuentros,
  nombreMes,
  porDia,
  problemasDePublicacion,
  resumenPublicacion,
  semanasDelMes,
  yaPaso,
} from '@/lib/calendarioPanel';
import type { ActividadConId, Estado, Sesion } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/** Timestamp mínimo, como el que entrega Firestore. */


/**
 * B-136 — el default de `fin` es **una duración real**, no `inicio`.
 *
 * Con duración cero el encuentro termina en el mismo instante en que empieza, así
 * que `yaPaso` lo da por pasado desde que arranca y cualquier caso de "en curso"
 * queda mudo sin que nada falle. Es el fixture flojo que `tests/invariantes-de-
 * ciclo.test.ts` detecta: los 16 usos del helper que no pasan `fin` heredaban
 * ese cero. Dos horas es lo que dura un encuentro literario de verdad.
 */
const DOS_HORAS_MS = 2 * 60 * 60 * 1000;

const sesion = (
  over: Omit<Partial<Sesion>, 'inicio' | 'fin'> & { id: string; inicio: string; fin?: string },
): Sesion => {
  const termina =
    over.fin ?? new Date(new Date(over.inicio).getTime() + DOS_HORAS_MS).toISOString();
  return {
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    ...over,
    inicio: ts(over.inicio),
    fin: ts(termina),
  } as unknown as Sesion;
};

const actividad = (over: Partial<ActividadConId> = {}): ActividadConId =>
  ({
    id: 'act1',
    titulo: 'Club de lectura',
    tipo: 'club-lectura',
    estado: 'publicado' as Estado,
    esCiclo: true,
    sesiones: [],
    ...over,
  }) as unknown as ActividadConId;

// ─────────────────────────────────────────────────────────────────

describe('agrupar por día en la zona del proyecto (trampa 1)', () => {
  it('un encuentro de las 21:00 cae el mismo día, no el siguiente', () => {
    // 21:00 en Buenos Aires es 00:00 UTC del día siguiente. Agrupado en UTC, el
    // encuentro del jueves aparecería el viernes.
    expect(claveDia(new Date('2026-09-04T00:00:00Z'))).toBe('2026-09-03');
    expect(horaLegible(new Date('2026-09-04T00:00:00Z'))).toBe('21:00');
  });

  it('un encuentro de la mañana cae en su día', () => {
    expect(claveDia(new Date('2026-09-03T13:00:00Z'))).toBe('2026-09-03');
    expect(horaLegible(new Date('2026-09-03T13:00:00Z'))).toBe('10:00');
  });

  it('la medianoche local se lee 00:00 y no 24:00', () => {
    expect(horaLegible(new Date('2026-09-04T03:00:00Z'))).toBe('00:00');
    expect(claveDia(new Date('2026-09-04T03:00:00Z'))).toBe('2026-09-04');
  });

  it('el último día del mes a la noche no se va al mes siguiente', () => {
    expect(claveMes(claveDia(new Date('2026-09-01T00:30:00Z')))).toBe('2026-08');
  });
});

describe('navegación de meses', () => {
  it('avanza y retrocede cruzando el año', () => {
    expect(mesRelativo('2026-12', 1)).toBe('2027-01');
    expect(mesRelativo('2026-01', -1)).toBe('2025-12');
    expect(mesRelativo('2026-08', 0)).toBe('2026-08');
  });

  it('no se cae en el mes de 31 días, que es donde falla `setMonth`', () => {
    // Con Date, "31 de marzo menos un mes" da el 3 de marzo. Acá el día no
    // participa del cálculo.
    expect(mesRelativo('2026-03', -1)).toBe('2026-02');
    expect(mesRelativo('2026-01', 12)).toBe('2027-01');
  });

  it('nombra el mes en castellano', () => {
    expect(nombreMes('2026-08')).toBe('agosto de 2026');
    expect(nombreMes('2026-12')).toBe('diciembre de 2026');
  });

  it('el instante completo se lee de un tirón, en la zona del proyecto', () => {
    expect(fechaHoraLegible(new Date('2026-08-25T00:00:00Z'))).toBe(
      'lunes 24 de agosto · 21:00',
    );
  });

  it('nombra el día con su día de semana', () => {
    // 2026-08-24 es lunes.
    expect(diaLegible('2026-08-24')).toBe('lunes 24 de agosto');
    expect(diaLegible('2026-08-30')).toBe('domingo 30 de agosto');
  });
});

describe('la grilla del mes', () => {
  it('arranca en lunes y completa la semana con celdas vacías', () => {
    // 2026-08-01 es sábado: la primera semana lleva cinco celdas vacías.
    const semanas = semanasDelMes('2026-08');
    expect(semanas[0]!.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(semanas[0]![5]).toBe('2026-08-01');
    expect(semanas[0]![6]).toBe('2026-08-02');
  });

  it('todas las filas tienen siete celdas', () => {
    for (const mes of ['2026-01', '2026-02', '2026-08', '2028-02']) {
      for (const semana of semanasDelMes(mes)) expect(semana).toHaveLength(7);
    }
  });

  it('incluye todos los días del mes, febrero bisiesto incluido', () => {
    const dias = semanasDelMes('2028-02').flat().filter(Boolean);
    expect(dias).toHaveLength(29);
    expect(dias.at(-1)).toBe('2028-02-29');
  });
});

// ─────────────────────────────────────────────────────────────────

describe('estado de publicación: ¿esto ya lo ve la gente?', () => {
  it('publicada con evento: está en el calendario', () => {
    expect(
      estadoPublicacion({ estado: 'publicado' }, { cancelada: false, calendarEventId: 'evt1' }),
    ).toBe('en-calendario');
  });

  it('publicada SIN evento: falta en el calendario — el caso invisible', () => {
    // Debería estar publicado y no está: el sync no corrió o falló. Ninguna
    // otra pantalla lo muestra.
    expect(
      estadoPublicacion({ estado: 'publicado' }, { cancelada: false, calendarEventId: null }),
    ).toBe('falta-en-calendario');
  });

  it('no publicada pero con evento colgado: sobra en el calendario', () => {
    // La Function vuelve `calendarEventId` a null al borrar el evento, así que
    // un id acá significa que el borrado no se completó.
    expect(
      estadoPublicacion({ estado: 'borrador' }, { cancelada: false, calendarEventId: 'evt1' }),
    ).toBe('sobra-en-calendario');
    expect(
      estadoPublicacion({ estado: 'publicado' }, { cancelada: true, calendarEventId: 'evt1' }),
    ).toBe('sobra-en-calendario');
  });

  it('encuentro cancelado de una actividad publicada (§7.3)', () => {
    expect(
      estadoPublicacion({ estado: 'publicado' }, { cancelada: true, calendarEventId: null }),
    ).toBe('encuentro-cancelado');
  });

  it('los tres estados que no publican nada se distinguen entre sí (§7.3)', () => {
    const sinEvento = { cancelada: false, calendarEventId: null };
    expect(estadoPublicacion({ estado: 'borrador' }, sinEvento)).toBe('borrador');
    expect(estadoPublicacion({ estado: 'pendiente' }, sinEvento)).toBe('pendiente');
    expect(estadoPublicacion({ estado: 'cancelado' }, sinEvento)).toBe('cancelado');
  });

  it('cada estado dice qué significa y en qué grupo cae', () => {
    for (const estado of ESTADOS_PUBLICACION) {
      const info = INFO_PUBLICACION[estado];
      expect(info, `falta la info de «${estado}»`).toBeDefined();
      expect(info.etiqueta.length).toBeGreaterThan(5);
      expect(info.significa.length).toBeGreaterThan(30);
    }
    // Los dos problemas son los dos que hay que poder contar de un pantallazo.
    const problemas = ESTADOS_PUBLICACION.filter((e) => INFO_PUBLICACION[e].grupo === 'problema');
    expect(problemas).toEqual(['falta-en-calendario', 'sobra-en-calendario']);
  });
});

// ─────────────────────────────────────────────────────────────────

describe('del eje de actividades al eje de encuentros (§2.2, D-70)', () => {
  const club = actividad({
    id: 'club',
    titulo: 'Club de lectura',
    sesiones: [
      // Desordenadas en el array a propósito: el número sale de la fecha.
      sesion({ id: 'ses_b', inicio: '2026-09-10T22:00:00Z' }),
      sesion({ id: 'ses_a', inicio: '2026-09-03T22:00:00Z' }),
      sesion({ id: 'ses_c', inicio: '2026-09-17T22:00:00Z' }),
    ],
  });

  it('una actividad de tres encuentros da tres encuentros, numerados por fecha', () => {
    const encuentros = encuentrosDe([club]);
    expect(encuentros).toHaveLength(3);
    expect(encuentros.map((e) => e.sesionId)).toEqual(['ses_a', 'ses_b', 'ses_c']);
    expect(encuentros.map((e) => `${e.indice} de ${e.total}`)).toEqual([
      '1 de 3',
      '2 de 3',
      '3 de 3',
    ]);
  });

  it('todos apuntan a la misma actividad: la unidad de edición no cambia', () => {
    expect(new Set(encuentrosDe([club]).map((e) => e.actividadId))).toEqual(new Set(['club']));
  });

  it('los encuentros cancelados también se numeran, como en el formulario', () => {
    const conCancelado = actividad({
      sesiones: [
        sesion({ id: 'ses_1', inicio: '2026-09-03T22:00:00Z' }),
        sesion({ id: 'ses_2', inicio: '2026-09-10T22:00:00Z', cancelada: true }),
        sesion({ id: 'ses_3', inicio: '2026-09-17T22:00:00Z' }),
      ],
    });
    const encuentros = encuentrosDe([conCancelado]);
    expect(encuentros.map((e) => e.indice)).toEqual([1, 2, 3]);
    expect(encuentros[1]!.estado).toBe('encuentro-cancelado');
  });

  it('vienen en orden cronológico aunque las actividades no lo estén', () => {
    const otra = actividad({
      id: 'taller',
      titulo: 'Taller de crónica',
      sesiones: [sesion({ id: 'ses_x', inicio: '2026-09-05T22:00:00Z' })],
    });
    expect(encuentrosDe([club, otra]).map((e) => e.sesionId)).toEqual([
      'ses_a',
      'ses_x',
      'ses_b',
      'ses_c',
    ]);
  });

  it('una sesión con la fecha rota no vacía la vista, se saltea', () => {
    const rota = actividad({
      sesiones: [
        { id: 'ses_rota', inicio: null, fin: null, cancelada: false } as unknown as Sesion,
        sesion({ id: 'ses_ok', inicio: '2026-09-03T22:00:00Z' }),
      ],
    });
    const encuentros = encuentrosDe([rota]);
    expect(encuentros.map((e) => e.sesionId)).toEqual(['ses_ok']);
    expect(encuentros[0]!.total).toBe(1);
  });

  it('una actividad sin encuentros no aporta nada', () => {
    expect(encuentrosDe([actividad({ sesiones: [] })])).toEqual([]);
    expect(encuentrosDe([])).toEqual([]);
  });
});

describe('agrupar y contar', () => {
  const encuentros = encuentrosDe([
    actividad({
      id: 'club',
      sesiones: [
        sesion({ id: 'ses_1', inicio: '2026-09-03T22:00:00Z' }),
        sesion({ id: 'ses_2', inicio: '2026-09-03T23:30:00Z' }),
        sesion({ id: 'ses_3', inicio: '2026-10-01T22:00:00Z' }),
      ],
    }),
    actividad({
      id: 'taller',
      estado: 'borrador',
      sesiones: [sesion({ id: 'ses_4', inicio: '2026-09-03T19:00:00Z' })],
    }),
  ]);

  it('dos encuentros del mismo día quedan juntos y en orden de hora', () => {
    const dias = agruparPorDia(encuentros);
    expect(dias.map((d) => d.dia)).toEqual(['2026-09-03', '2026-10-01']);
    expect(dias[0]!.encuentros.map((e) => e.hora)).toEqual(['16:00', '19:00', '20:30']);
  });

  it('los días sin nada no aparecen', () => {
    expect(agruparPorDia(encuentros).some((d) => d.dia === '2026-09-04')).toBe(false);
    expect(porDia(encuentros).get('2026-09-04')).toBeUndefined();
    expect(porDia(encuentros).get('2026-09-03')).toHaveLength(3);
  });

  it('el mes se filtra por la clave del día, no por el instante', () => {
    expect(encuentrosDelMes(encuentros, '2026-09')).toHaveLength(3);
    expect(encuentrosDelMes(encuentros, '2026-10')).toHaveLength(1);
    expect(encuentrosDelMes(encuentros, '2026-11')).toEqual([]);
    expect(mesesConEncuentros(encuentros)).toEqual(['2026-09', '2026-10']);
  });

  it('desde un mes vacío dice para qué lado hay algo', () => {
    const meses = mesesConEncuentros(encuentros);
    // Primero mira hacia adelante, que es lo que interesa.
    expect(mesMasCercanoConEncuentros(meses, '2026-07')).toBe('2026-09');
    expect(mesMasCercanoConEncuentros(meses, '2026-09')).toBe('2026-10');
    // Y si adelante no hay nada, hacia atrás.
    expect(mesMasCercanoConEncuentros(meses, '2026-12')).toBe('2026-10');
    expect(mesMasCercanoConEncuentros([], '2026-12')).toBeNull();
  });

  it('el resumen cuenta encuentros y actividades, para no leer un ciclo como ocho cosas', () => {
    const resumen = resumenPublicacion(encuentros);
    expect(resumen.total).toBe(4);
    expect(resumen.actividades).toBe(2);
    // Tres del club (publicado, sin evento → problema) y uno del borrador.
    expect(resumen.problema).toBe(3);
    expect(resumen.oculto).toBe(1);
    expect(resumen.visible).toBe(0);
  });

  it('el filtro por grupo deja solo lo pedido', () => {
    expect(filtrarPorGrupo(encuentros, 'oculto').map((e) => e.sesionId)).toEqual(['ses_4']);
    expect(filtrarPorGrupo(encuentros, null)).toHaveLength(4);
  });
});

describe('el problema que hoy nadie ve', () => {
  const ahora = new Date('2026-09-05T12:00:00Z');

  const conProblemas = () =>
    encuentrosDe([
      actividad({
        id: 'club',
        sesiones: [
          // Ya pasó y nunca se publicó: queda el registro, no hay arreglo.
          sesion({ id: 'ses_vieja', inicio: '2026-09-01T22:00:00Z' }),
          // Por venir y sin evento: accionable.
          sesion({ id: 'ses_futura', inicio: '2026-11-05T22:00:00Z' }),
          // Publicado de verdad.
          sesion({
            id: 'ses_ok',
            inicio: '2026-09-10T22:00:00Z',
            calendarEventId: 'evt1',
          }),
        ],
      }),
    ]);

  it('separa lo accionable de lo que ya no tiene arreglo', () => {
    const problemas = problemasDePublicacion(conProblemas(), ahora);
    expect(problemas.porVenir.map((e) => e.sesionId)).toEqual(['ses_futura']);
    expect(problemas.pasados.map((e) => e.sesionId)).toEqual(['ses_vieja']);
  });

  it('dice en qué meses están, para poder llegar hasta ellos', () => {
    // Sin esto, un encuentro sin publicar en noviembre sigue invisible mientras
    // se mira septiembre — que es justo el problema que la vista resuelve.
    expect(problemasDePublicacion(conProblemas(), ahora).meses).toEqual(['2026-11']);
  });

  it('la vista abre en el mes del primer problema, no en el de hoy', () => {
    expect(mesInicial(conProblemas(), ahora)).toBe('2026-11');
  });

  it('sin problemas, abre en el mes de hoy', () => {
    const sano = encuentrosDe([
      actividad({
        sesiones: [sesion({ id: 'ses_1', inicio: '2026-09-10T22:00:00Z', calendarEventId: 'e' })],
      }),
    ]);
    expect(problemasDePublicacion(sano, ahora).porVenir).toEqual([]);
    expect(mesInicial(sano, ahora)).toBe('2026-09');
  });

  it('sin nada cargado, abre en el mes de hoy', () => {
    expect(mesInicial([], ahora)).toBe('2026-09');
  });

  it('un encuentro se considera pasado cuando terminó, no cuando empezó', () => {
    const [enCurso] = encuentrosDe([
      actividad({
        sesiones: [
          sesion({ id: 'ses_1', inicio: '2026-09-05T11:00:00Z', fin: '2026-09-05T13:00:00Z' }),
        ],
      }),
    ]);
    expect(yaPaso(enCurso!, ahora)).toBe(false);
  });
});

describe('B-126 · el cierre de la inscripción, un marcador más en su día', () => {
  const ahora = new Date('2026-09-20T12:00:00Z');

  /** Una actividad publicada con inscripción y fecha de cierre. */
  const conCierre = (
    over: {
      id?: string;
      cierra?: string | null;
      requiere?: boolean;
      completo?: boolean;
      cupo?: number | null;
      estado?: Estado;
      sesiones?: Sesion[];
    } = {},
  ): ActividadConId =>
    actividad({
      id: over.id ?? 'act_cierre',
      estado: over.estado ?? 'publicado',
      sesiones: over.sesiones ?? [],
      inscripcion: {
        requiere: over.requiere ?? true,
        via: 'mail',
        destino: 'hola@ejemplo.com',
        cupo: over.cupo ?? 12,
        cierra: over.cierra === null || over.cierra === undefined ? null : ts(over.cierra),
        ...(over.completo === undefined ? {} : { completo: over.completo }),
      },
    } as unknown as Partial<ActividadConId>);

  it('la fecha de cierre cae en su día civil, en la zona del proyecto (trampa 1)', () => {
    // 23:00 UTC del 24 son las 20:00 del 24 en Buenos Aires, no el 25.
    const [cierre] = cierresDe([conCierre({ cierra: '2026-09-24T23:00:00Z' })]);
    expect(cierre!.dia).toBe('2026-09-24');
    expect(cierre!.hora).toBe('20:00');
    expect(cierre!.titulo).toBe('Club de lectura');
    expect(cierre!.cupo).toBe(12);
  });

  it('una actividad que no está publicada no aporta cierre: no invita a nadie', () => {
    for (const estado of ['borrador', 'pendiente', 'cancelado'] as Estado[]) {
      expect(cierresDe([conCierre({ cierra: '2026-09-24T23:00:00Z', estado })])).toEqual([]);
    }
  });

  it('una fecha colgada de una inscripción que ya no se requiere no aporta cierre', () => {
    // `formADocumento` guarda `cierra` sin preguntar por `requiere`, así que la
    // fecha vieja sobrevive al cambio y sin este filtro pintaría un marcador
    // para algo que no se inscribe.
    expect(
      cierresDe([conCierre({ cierra: '2026-09-24T23:00:00Z', requiere: false })]),
    ).toEqual([]);
  });

  it('sin fecha de cierre, o con una fecha rota, no hay marcador y la vista no se vacía', () => {
    expect(cierresDe([conCierre({ cierra: null })])).toEqual([]);
    const rota = actividad({
      id: 'rota',
      inscripcion: { requiere: true, via: 'mail', destino: 'x', cupo: null, cierra: 'ayer' },
    } as unknown as Partial<ActividadConId>);
    expect(cierresDe([rota, conCierre({ cierra: '2026-09-24T23:00:00Z' })])).toHaveLength(1);
  });

  it('vienen en orden cronológico aunque las actividades no lo estén', () => {
    const cierres = cierresDe([
      conCierre({ id: 'c', cierra: '2026-11-01T15:00:00Z' }),
      conCierre({ id: 'a', cierra: '2026-09-01T15:00:00Z' }),
      conCierre({ id: 'b', cierra: '2026-10-01T15:00:00Z' }),
    ]);
    expect(cierres.map((c) => c.actividadId)).toEqual(['a', 'b', 'c']);
  });

  it('`completo` se lee con default `false` y determinístico (D-127)', () => {
    // Los documentos anteriores a B-97 no tienen el campo.
    const [sinCampo] = cierresDe([conCierre({ cierra: '2026-10-01T15:00:00Z' })]);
    expect(sinCampo!.completo).toBe(false);
    const [prendido] = cierresDe([
      conCierre({ cierra: '2026-10-01T15:00:00Z', completo: true }),
    ]);
    expect(prendido!.completo).toBe(true);
  });

  it('cada estado dice qué significa y si pide algo', () => {
    for (const estado of ESTADOS_CIERRE) {
      expect(INFO_CIERRE[estado].etiqueta.length).toBeGreaterThan(0);
      expect(INFO_CIERRE[estado].significa.length).toBeGreaterThan(20);
    }
    expect(ESTADOS_CIERRE.filter((e) => INFO_CIERRE[e].urge)).toEqual(['vencido']);
  });

  it('antes de la fecha avisa, después pide algo', () => {
    const [futuro] = cierresDe([conCierre({ cierra: '2026-10-01T15:00:00Z' })]);
    const [pasado] = cierresDe([conCierre({ cierra: '2026-09-01T15:00:00Z' })]);
    expect(estadoCierre(futuro!, ahora)).toBe('por-venir');
    expect(estadoCierre(pasado!, ahora)).toBe('vencido');
  });

  it('«se llenó» gana sobre la fecha: un cierre vencido y lleno no pide nada (D-127)', () => {
    // Es el caso más común y sano de todos. Contarlo como problema haría que el
    // aviso se encienda siempre, y un aviso que se enciende siempre se apaga.
    const [llenoYVencido] = cierresDe([
      conCierre({ cierra: '2026-09-01T15:00:00Z', completo: true }),
    ]);
    const [llenoYPorVenir] = cierresDe([
      conCierre({ cierra: '2026-10-01T15:00:00Z', completo: true }),
    ]);
    expect(estadoCierre(llenoYVencido!, ahora)).toBe('cupo-completo');
    expect(estadoCierre(llenoYPorVenir!, ahora)).toBe('cupo-completo');
    expect(INFO_CIERRE['cupo-completo'].urge).toBe(false);
  });

  it('el aviso junta los vencidos de TODOS los meses y dice dónde están', () => {
    const cierres = cierresDe([
      conCierre({ id: 'jul', cierra: '2026-07-01T15:00:00Z' }),
      conCierre({ id: 'ago', cierra: '2026-08-01T15:00:00Z' }),
      // Lleno: vencido pero coherente, no entra al aviso.
      conCierre({ id: 'lleno', cierra: '2026-06-01T15:00:00Z', completo: true }),
      // Por venir: tampoco.
      conCierre({ id: 'futuro', cierra: '2026-12-01T15:00:00Z' }),
    ]);
    const urgen = cierresQueUrgen(cierres, ahora);
    expect(urgen.vencidos.map((c) => c.actividadId)).toEqual(['jul', 'ago']);
    expect(urgen.meses).toEqual(['2026-07', '2026-08']);
  });

  it('los meses del aviso salen ordenados aunque la lista llegue al revés (B-128)', () => {
    // La misma lección que B-128, aplicada a la función nueva: el orden es
    // parte del resultado. Alimentado con `cierresDe` no se nota, porque esa ya
    // ordena; con la lista al revés sí.
    const alReves = [
      ...cierresDe([
        conCierre({ id: 'jul', cierra: '2026-07-01T15:00:00Z' }),
        conCierre({ id: 'ago', cierra: '2026-08-01T15:00:00Z' }),
      ]),
    ].reverse();
    expect(alReves.map((c) => c.actividadId)).toEqual(['ago', 'jul']);
    expect(cierresQueUrgen(alReves, ahora).meses).toEqual(['2026-07', '2026-08']);
  });

  it('sin nada vencido el aviso no tiene qué mostrar', () => {
    const cierres = cierresDe([conCierre({ cierra: '2026-12-01T15:00:00Z' })]);
    expect(cierresQueUrgen(cierres, ahora).vencidos).toEqual([]);
    expect(cierresQueUrgen([], ahora).meses).toEqual([]);
  });

  it('se filtran por mes y se indexan por día, como los encuentros', () => {
    const cierres = cierresDe([
      conCierre({ id: 'a', cierra: '2026-10-01T15:00:00Z' }),
      conCierre({ id: 'b', cierra: '2026-10-01T18:00:00Z' }),
      conCierre({ id: 'c', cierra: '2026-11-01T15:00:00Z' }),
    ]);
    expect(cierresDelMes(cierres, '2026-10')).toHaveLength(2);
    expect(cierresDelMes(cierres, '2026-12')).toEqual([]);
    const indice = porDiaCierres(cierres);
    expect(indice.get('2026-10-01')!.map((c) => c.hora)).toEqual(['12:00', '15:00']);
    expect(indice.get('2026-10-02')).toBeUndefined();
  });

  it('un día con un cierre y ningún encuentro APARECE en la agenda', () => {
    // Es el caso que se perdía con `agruparPorDia` solo: la actividad de un
    // encuentro lejano cuya inscripción cierra la semana que viene.
    const encuentros = encuentrosDe([
      actividad({
        id: 'lejana',
        sesiones: [sesion({ id: 'ses_1', inicio: '2026-11-20T22:00:00Z' })],
      }),
    ]);
    const cierres = cierresDe([conCierre({ id: 'lejana', cierra: '2026-09-25T15:00:00Z' })]);
    const dias = agendaDe(encuentros, cierres);
    expect(dias.map((d) => d.dia)).toEqual(['2026-09-25', '2026-11-20']);
    expect(dias[0]!.encuentros).toEqual([]);
    expect(dias[0]!.cierres.map((c) => c.actividadId)).toEqual(['lejana']);
    expect(dias[1]!.cierres).toEqual([]);
  });

  it('un día con encuentro y cierre a la vez los trae juntos, una sola vez', () => {
    const encuentros = encuentrosDe([
      actividad({
        id: 'taller',
        sesiones: [sesion({ id: 'ses_1', inicio: '2026-09-25T22:00:00Z' })],
      }),
    ]);
    const cierres = cierresDe([conCierre({ id: 'taller', cierra: '2026-09-25T15:00:00Z' })]);
    const dias = agendaDe(encuentros, cierres);
    expect(dias).toHaveLength(1);
    expect(dias[0]!.encuentros).toHaveLength(1);
    expect(dias[0]!.cierres).toHaveLength(1);
  });

  it('sin cierres, la agenda es la de siempre', () => {
    const encuentros = encuentrosDe([
      actividad({ sesiones: [sesion({ id: 'ses_1', inicio: '2026-09-25T22:00:00Z' })] }),
    ]);
    expect(agendaDe(encuentros, []).map((d) => d.dia)).toEqual(
      agruparPorDia(encuentros).map((d) => d.dia),
    );
    expect(agendaDe([], [])).toEqual([]);
  });
});

describe('B-128 · el orden de los meses se produce acá, no se hereda del argumento', () => {
  const ahora = new Date('2026-09-20T12:00:00Z');

  // Tres meses, uno por actividad, y la lista **al revés**: es exactamente lo
  // que devuelve cualquier camino que no pase por `encuentrosDe` —un `Map`
  // recorrido en orden de inserción, dos tramos concatenados, un filtro que
  // reordena—. Antes de B-128 nada acá fallaba: los meses salían al revés y la
  // vista abría en un mes arbitrario.
  const cronologicos = encuentrosDe([
    actividad({ id: 'a', sesiones: [sesion({ id: 'ses_sep', inicio: '2026-09-10T22:00:00Z' })] }),
    actividad({ id: 'b', sesiones: [sesion({ id: 'ses_oct', inicio: '2026-10-10T22:00:00Z' })] }),
    actividad({ id: 'c', sesiones: [sesion({ id: 'ses_nov', inicio: '2026-11-10T22:00:00Z' })] }),
  ]);
  const alReves = [...cronologicos].reverse();

  it('la lista llega al revés y los meses salen igual del más viejo al más nuevo', () => {
    expect(alReves.map((e) => e.dia)).toEqual(['2026-11-10', '2026-10-10', '2026-09-10']);
    expect(mesesConEncuentros(alReves)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(mesesConEncuentros(alReves)).toEqual(mesesConEncuentros(cronologicos));
  });

  it('el mes más cercano tampoco depende del orden de entrada', () => {
    expect(mesMasCercanoConEncuentros(mesesConEncuentros(alReves), '2026-08')).toBe('2026-09');
  });

  it('los meses con problemas salen ordenados, que es de lo que vive `mesInicial`', () => {
    // Los tres están publicados y sin `calendarEventId`, así que los tres son
    // problema; septiembre ya pasó, así que quedan octubre y noviembre.
    expect(problemasDePublicacion(alReves, ahora).meses).toEqual(['2026-10', '2026-11']);
    expect(mesInicial(alReves, ahora)).toBe('2026-10');
  });
});

describe('B-126 · lo que el tipo no puede sostener del marcador de cierre', () => {
  // Los tres `Record<EstadoCierre, string>` del componente los completa el
  // compilador, así que un estado nuevo sin color no compila y no hace falta
  // chequearlo. Estas dos cosas sí se pueden romper con el build en verde.
  const vista = readFileSync('src/components/admin/CalendarioActividades.tsx', 'utf8');

  /** El cuerpo de un componente del archivo, hasta el que le sigue. */
  const cuerpoDe = (nombre: string): string => {
    const desde = vista.indexOf(`function ${nombre}(`);
    expect(desde).toBeGreaterThan(-1);
    const siguiente = vista.indexOf('\nfunction ', desde + 1);
    const hasta = vista.indexOf('\nexport function ', desde + 1);
    const fin = [siguiente, hasta].filter((i) => i > -1).sort((a, b) => a - b)[0] ?? vista.length;
    return vista.slice(desde, fin);
  };

  it('la fila de cierre mantiene el blanco táctil de 44px', () => {
    // Se mira SU cuerpo y no el archivo entero: `min-h-touch` ya está en la fila
    // de encuentro, así que un `toContain` sobre todo el fuente pasaría igual
    // aunque la fila nueva no lo tenga.
    expect(cuerpoDe('FilaCierre')).toContain('min-h-touch');
  });

  it('la leyenda recorre ESTADOS_CIERRE, así que un estado nuevo no queda sin explicar', () => {
    // Enumerarlos a mano en el JSX es lo que deja el estado nuevo sin su línea:
    // el chip aparece pintado y nadie escribe qué significa.
    expect(vista).toMatch(/ESTADOS_CIERRE\.map\(/);
  });
});

describe('la vista no deshace el corte del bundle (B-09, D-51)', () => {
  // Misma guarda que `tests/bundle-panel.test.ts` para las otras vistas, acá
  // para la nueva: la vista calendario lee /actividades, así que un `import`
  // estático devolvería el SDK de Firestore al chunk del login y el build
  // seguiría en verde.
  const fuente = readFileSync('src/components/admin/AdminApp.tsx', 'utf8');

  it('AdminApp la carga con import() diferido', () => {
    expect(fuente).toMatch(/import\('@\/components\/admin\/CalendarioActividades'\)/);
  });

  it('y no la importa de forma estática', () => {
    const estaticos = [...fuente.matchAll(/^import\s+(?!type\s)[^;]*?from\s+'([^']+)'/gm)].map(
      (m) => m[1]!,
    );
    expect(estaticos).not.toContain('@/components/admin/CalendarioActividades');
  });
});
