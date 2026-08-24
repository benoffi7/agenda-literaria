import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INFO_PUBLICACION,
  ESTADOS_PUBLICACION,
  agruparPorDia,
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

/** Timestamp mínimo, como el que entrega Firestore. */
const ts = (iso: string) => {
  const d = new Date(iso);
  return { toDate: () => d, toMillis: () => d.getTime(), seconds: 0, nanoseconds: 0 };
};

const sesion = (
  over: Omit<Partial<Sesion>, 'inicio' | 'fin'> & { id: string; inicio: string; fin?: string },
): Sesion =>
  ({
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    ...over,
    inicio: ts(over.inicio),
    fin: ts(over.fin ?? over.inicio),
  }) as unknown as Sesion;

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
