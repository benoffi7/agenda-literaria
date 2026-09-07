import { describe, expect, it } from 'vitest';
import {
  DIAS_DE_LA_SEMANA,
  FRANJAS,
  INFO_FRANJA,
  MINIMO_PARA_ESCALA,
  NIVELES,
  SEMANAS_DEL_MAPA,
  cuentaEnElRitmo,
  encuentrosPorDia,
  franjaDe,
  horaEnZona,
  indiceDeSemana,
  mapaDeCalor,
  nivelDeIntensidad,
  porDiaDeSemana,
  porFranja,
} from '@/lib/ritmoDelCatalogo';
// Se importan a propósito: lo que estos tests atan es que el ritmo **no** tenga
// su propio aplanado de sesiones ni su propia regla de «qué encuentro cuenta».
// Si divergieran, el encabezado del tablero y su mapa de calor contarían
// distinto y ninguna de las dos pantallas se vería rota.
import { encuentrosDe } from '@/lib/calendarioPanel';
import { estadoDelCatalogo } from '@/lib/estadoDelCatalogo';
import type { ActividadConId, Sesion } from '@/types/actividad';
import { ts } from './fixtures/tiempo';

/**
 * El ritmo del catálogo — B-704 (mapa de calor), B-705 (día de la semana),
 * B-706 (franja horaria).
 *
 * Lo que este archivo cuida:
 *
 * 1. **La zona horaria**, que es la trampa 1 aplicada a una grilla: un
 *    encuentro a las 00:30 de Buenos Aires se pinta un día antes si alguien usa
 *    `getDate()`, y salta de franja si alguien usa `getHours()`.
 * 2. **Que la escala no mienta con pocos datos.** Repartir un máximo de 2 en
 *    tres niveles pinta un día de un encuentro del color de «saturado».
 * 3. **Que la grilla sea rectangular.** Los huecos son el dato: un mapa que
 *    saltea los días vacíos no contesta «qué semanas están vacías», que es
 *    para lo que existe.
 * 4. **Que no haya una segunda regla de qué encuentro cuenta.**
 */

const DOS_HORAS = 2 * 60 * 60 * 1000;

/**
 * Un encuentro de **dos horas**, no de cero.
 *
 * El default se calcula aparte y con nombre en vez de `over.fin ?? …inicio…`,
 * que es el patrón que `tests/invariantes-de-ciclo.test.ts` persigue (B-135, el
 * patrón de H1): un `fin` que cae en `inicio` salvo que el caller se acuerde
 * deja fixtures de duración cero, donde los dos criterios de «ya pasó» son
 * indistinguibles y el caso deja de ejercitar lo que dice.
 */
const sesion = (inicioIso: string, over: Partial<Sesion> = {}): Sesion => {
  const arranque = new Date(inicioIso);
  const cierre = new Date(arranque.getTime() + DOS_HORAS);
  return {
    id: `ses_${inicioIso}`,
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    ...over,
    inicio: ts(inicioIso),
    fin: over.fin ?? ts(cierre.toISOString()),
  } as unknown as Sesion;
};

const acto = (id: string, inicios: string[], over: Partial<ActividadConId> = {}): ActividadConId =>
  ({
    id,
    titulo: id,
    tipo: 'taller',
    estado: 'publicado',
    esCiclo: inicios.length > 1,
    modalidad: 'presencial',
    modalidades: [],
    sede: null,
    online: null,
    tags: [],
    imagenes: [],
    descripcion: '',
    arancel: { tipo: 'gratis', notas: '' },
    inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
    material: { tiene: false, items: [] },
    difusion: { arrobar: [], notas: '' },
    // `over.sesiones` gana si viene: es como se arman los casos de sesión
    // cancelada. Sin el `??`, el spread de abajo lo pisaba con la lista vacía y
    // el caso probaba otra cosa que la que dice su nombre.
    sesiones: over.sesiones ?? inicios.map((i) => sesion(i)),
    ...over,
  }) as unknown as ActividadConId;

/** Un lunes, para que el mapa arranque en una fecha que se puede leer a mano. */
const LUNES = new Date('2026-09-07T15:00:00Z');

describe('el índice del día, con el lunes primero', () => {
  it('lunes es 0 y domingo es 6', () => {
    expect(indiceDeSemana('2026-09-07')).toBe(0); // lunes
    expect(indiceDeSemana('2026-09-13')).toBe(6); // domingo
  });

  it('la tabla de nombres tiene los siete, en el mismo orden', () => {
    // Un nombre de más o de menos correría la grilla entera respecto de sus
    // encabezados, y la columna del martes diría «miércoles».
    expect(DIAS_DE_LA_SEMANA).toHaveLength(7);
    expect(DIAS_DE_LA_SEMANA.map((d) => d.indice)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(DIAS_DE_LA_SEMANA[0]!.largo).toBe('lunes');
    expect(DIAS_DE_LA_SEMANA[6]!.largo).toBe('domingo');
  });
});

describe('qué encuentro cuenta', () => {
  it('un encuentro cancelado no ocupa el día', () => {
    const [e] = encuentrosDe([acto('a', [], { sesiones: [sesion('2026-09-08T22:00:00Z', { cancelada: true })] } as Partial<ActividadConId>)]);
    expect(cuentaEnElRitmo(e!)).toBe(false);
  });

  it('los de una actividad cancelada tampoco', () => {
    const [e] = encuentrosDe([acto('a', ['2026-09-08T22:00:00Z'], { estado: 'cancelado' })]);
    expect(cuentaEnElRitmo(e!)).toBe(false);
  });

  it('los de un borrador sí: es trabajo programado que ocupa una fecha', () => {
    // El tablero existe justamente para ver los huecos **antes** de publicar.
    const [e] = encuentrosDe([acto('a', ['2026-09-08T22:00:00Z'], { estado: 'borrador' })]);
    expect(cuentaEnElRitmo(e!)).toBe(true);
  });

  it('y es la MISMA regla que usa el encabezado del tablero', () => {
    /*
     * La atadura que importa. `estadoDelCatalogo` cuenta encuentros con su
     * propio filtro, y este módulo con `cuentaEnElRitmo`: si se separan, el
     * número grande de arriba y la suma del mapa de calor dirían cosas
     * distintas en la misma pantalla, sin que nada falle.
     */
    const actividades = [
      acto('viva', ['2026-09-08T22:00:00Z', '2026-09-15T22:00:00Z']),
      acto('cancelada', ['2026-09-09T22:00:00Z'], { estado: 'cancelado' }),
      acto('borrador', ['2026-09-10T22:00:00Z'], { estado: 'borrador' }),
      acto('con-sesion-cancelada', [], {
        sesiones: [sesion('2026-09-11T22:00:00Z', { cancelada: true })],
      } as Partial<ActividadConId>),
    ];
    const delRitmo = encuentrosDe(actividades).filter(cuentaEnElRitmo).length;
    expect(delRitmo).toBe(estadoDelCatalogo(actividades, LUNES).encuentros.total);
    // Control positivo: el fixture tiene encuentros descartados, así que la
    // igualdad de arriba no es trivialmente cierta sobre listas vacías.
    expect(delRitmo).toBe(3);
    expect(encuentrosDe(actividades).length).toBeGreaterThan(delRitmo);
  });
});

describe('el nivel de intensidad', () => {
  it('cero encuentros es nivel cero', () => {
    expect(nivelDeIntensidad(0, 9)).toBe(0);
  });

  it('el día más cargado siempre llega al tope', () => {
    expect(nivelDeIntensidad(9, 9)).toBe(NIVELES);
    expect(nivelDeIntensidad(3, 3)).toBe(NIVELES);
  });

  it('reparte en tres escalones', () => {
    expect(nivelDeIntensidad(1, 9)).toBe(1);
    expect(nivelDeIntensidad(4, 9)).toBe(2);
    expect(nivelDeIntensidad(7, 9)).toBe(3);
  });

  it('con pocos datos hay un solo nivel: la escala mentiría', () => {
    /*
     * El caso que importa en un catálogo que arranca. Con un máximo de 2,
     * repartir en tres pintaría el día de UN encuentro con el color de «poco» y
     * el de dos con el de «saturado» — una diferencia que no existe. Por debajo
     * del piso el mapa dice «hay o no hay», que es lo único cierto.
     */
    expect(MINIMO_PARA_ESCALA).toBeGreaterThan(1);
    for (const maximo of [1, 2]) {
      for (let n = 1; n <= maximo; n++) {
        expect(nivelDeIntensidad(n, maximo), `${n}/${maximo}`).toBe(1);
      }
    }
    // Y en cuanto hay con qué, la escala vuelve.
    expect(nivelDeIntensidad(1, MINIMO_PARA_ESCALA)).toBe(1);
    expect(nivelDeIntensidad(MINIMO_PARA_ESCALA, MINIMO_PARA_ESCALA)).toBe(NIVELES);
  });

  it('nunca pasa del tope, ni con datos raros', () => {
    expect(nivelDeIntensidad(20, 9)).toBe(NIVELES);
  });
});

describe('el mapa de calor', () => {
  const conEncuentros = (inicios: string[]) => encuentrosDe([acto('a', inicios)]);

  it('es rectangular: los huecos son el dato', () => {
    /*
     * Un mapa que saltea los días vacíos —como hace `agruparPorDia` en la vista
     * de mobile del calendario, y ahí con razón— no puede contestar «qué
     * semanas están vacías», que es para lo que existe éste.
     */
    const mapa = mapaDeCalor([], LUNES);
    expect(mapa.semanas).toHaveLength(SEMANAS_DEL_MAPA);
    for (const semana of mapa.semanas) expect(semana).toHaveLength(7);
    expect(mapa.diasVacios).toBe(SEMANAS_DEL_MAPA * 7);
    expect(mapa.total).toBe(0);
    expect(mapa.maximo).toBe(0);
  });

  it('arranca el lunes de la semana en curso, aunque hoy sea jueves', () => {
    // Si arrancara «hoy», cada fila empezaría un día distinto y la columna del
    // martes dejaría de ser el martes — que es la mitad de lo que el mapa
    // muestra.
    const jueves = new Date('2026-09-10T15:00:00Z');
    const mapa = mapaDeCalor([], jueves);
    expect(mapa.semanas[0]![0]!.clave).toBe('2026-09-07');
    expect(indiceDeSemana(mapa.semanas[0]![0]!.clave)).toBe(0);
  });

  it('los días de esta semana que ya pasaron entran, marcados', () => {
    // Sacarlos dejaría un hueco al principio que se confunde con un día libre.
    const jueves = new Date('2026-09-10T15:00:00Z');
    const [lunes, , , juevesCelda] = mapaDeCalor([], jueves).semanas[0]!;
    expect(lunes!.yaPaso).toBe(true);
    expect(lunes!.esHoy).toBe(false);
    expect(juevesCelda!.yaPaso).toBe(false);
    expect(juevesCelda!.esHoy).toBe(true);
  });

  it('pone cada encuentro en su día calendario de Buenos Aires', () => {
    /*
     * Trampa 1 en una grilla. `2026-09-09T02:30:00Z` son las **23:30 del 8** en
     * Buenos Aires: con `getDate()` sobre el instante caería en la celda del 9,
     * o sea un día corrido, y el mapa se vería perfecto.
     */
    const mapa = mapaDeCalor(conEncuentros(['2026-09-09T02:30:00Z']), LUNES);
    const martes = mapa.semanas[0]!.find((d) => d.clave === '2026-09-08')!;
    const miercoles = mapa.semanas[0]!.find((d) => d.clave === '2026-09-09')!;
    expect(martes.cantidad).toBe(1);
    expect(miercoles.cantidad).toBe(0);
  });

  it('cuenta, escala y suma sobre la ventana', () => {
    const mapa = mapaDeCalor(
      conEncuentros([
        '2026-09-08T22:00:00Z',
        '2026-09-08T23:00:00Z',
        '2026-09-08T23:30:00Z',
        '2026-09-15T22:00:00Z',
      ]),
      LUNES,
    );
    const martes = mapa.semanas[0]!.find((d) => d.clave === '2026-09-08')!;
    expect(martes.cantidad).toBe(3);
    expect(mapa.maximo).toBe(3);
    expect(martes.nivel).toBe(NIVELES);
    expect(mapa.total).toBe(4);
    expect(mapa.diasVacios).toBe(SEMANAS_DEL_MAPA * 7 - 2);
  });

  it('lo que cae fuera de la ventana no se cuenta ni corre la escala', () => {
    // Un ciclo que empieza en marzo no puede hacer que las ocho semanas de
    // adelante se vean vacías por comparación.
    const mapa = mapaDeCalor(conEncuentros(['2027-03-08T22:00:00Z']), LUNES);
    expect(mapa.total).toBe(0);
  });

  it('cruza el fin de mes sin ayuda', () => {
    // `diaDesplazado` corre sobre el ancla de mediodía, así que septiembre 30 →
    // octubre 1 sale solo. Es el caso que rompe cualquier aritmética a mano.
    const mapa = mapaDeCalor([], new Date('2026-09-28T15:00:00Z'));
    expect(mapa.semanas[0]![0]!.clave).toBe('2026-09-28');
    expect(mapa.semanas[0]![3]!.clave).toBe('2026-10-01');
  });
});

describe('el reparto por día (`encuentrosPorDia`)', () => {
  it('agrupa por día calendario y descarta los que no cuentan', () => {
    const encuentros = encuentrosDe([
      acto('a', ['2026-09-08T22:00:00Z', '2026-09-08T23:00:00Z']),
      acto('b', ['2026-09-09T22:00:00Z'], { estado: 'cancelado' }),
    ]);
    expect([...encuentrosPorDia(encuentros)]).toEqual([['2026-09-08', 2]]);
  });
});

describe('el día de la semana (B-705)', () => {
  it('cuenta de lunes a domingo', () => {
    const encuentros = encuentrosDe([
      acto('a', ['2026-09-08T22:00:00Z', '2026-09-15T22:00:00Z']), // dos martes
      acto('b', ['2026-09-13T18:00:00Z']), // un domingo
    ]);
    expect(porDiaDeSemana(encuentros)).toEqual([0, 2, 0, 0, 0, 0, 1]);
  });

  it('devuelve los siete días aunque no haya nada: el cero es el dato', () => {
    // «No hay nada los lunes» es exactamente lo que esta vista vino a contestar,
    // y una fila ausente se confunde con un día que no se miró.
    expect(porDiaDeSemana([])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('un encuentro de la medianoche cuenta el día de Buenos Aires', () => {
    // 23:30 del martes 8, no el miércoles 9 del reloj UTC.
    expect(porDiaDeSemana(encuentrosDe([acto('a', ['2026-09-09T02:30:00Z'])]))).toEqual([
      0, 1, 0, 0, 0, 0, 0,
    ]);
  });
});

describe('la franja horaria (B-706)', () => {
  it('la hora sale en la zona del proyecto, no en la de quien mira', () => {
    /*
     * Trampa 1 otra vez, y el modo de falla es que el mismo taller salte de
     * franja según dónde esté abierta la pantalla: `2026-09-08T22:00:00Z` son
     * las 19 de Buenos Aires y las 00 de Madrid.
     */
    expect(horaEnZona(new Date('2026-09-08T22:00:00Z'))).toBe(19);
    expect(horaEnZona(new Date('2026-09-09T02:30:00Z'))).toBe(23);
    expect(horaEnZona(new Date('2026-09-08T13:00:00Z'))).toBe(10);
  });

  it('las tres franjas cubren las 24 horas y no se pisan', () => {
    // La afirmación que hace que el reparto sume el total: si dos franjas se
    // solaparan un encuentro contaría dos veces, y si quedara un hueco
    // desaparecería.
    const vistas = new Set<string>();
    for (let hora = 0; hora < 24; hora++) {
      const instante = new Date(Date.UTC(2026, 8, 8, hora + 3)); // +3 = UTC de BA
      vistas.add(franjaDe(instante));
    }
    expect([...vistas].sort()).toEqual([...FRANJAS].sort());
  });

  it('los cortes son los del circuito: las 19 es de noche', () => {
    // Un taller de las 19 en Buenos Aires es de noche —se sale del trabajo y se
    // va—; meterlo en «tarde» junto a uno de las 14 mezcla dos públicos.
    expect(franjaDe(new Date('2026-09-08T13:00:00Z'))).toBe('manana'); // 10:00
    expect(franjaDe(new Date('2026-09-08T19:00:00Z'))).toBe('tarde'); // 16:00
    expect(franjaDe(new Date('2026-09-08T22:00:00Z'))).toBe('noche'); // 19:00
  });

  it('la madrugada se pliega sobre la noche en vez de inventar una cuarta franja', () => {
    expect(franjaDe(new Date('2026-09-08T05:00:00Z'))).toBe('noche'); // 02:00
  });

  it('cada franja tiene su etiqueta: ninguna se pinta con su slug', () => {
    for (const f of FRANJAS) expect(INFO_FRANJA[f].etiqueta, f).toBeTruthy();
  });

  it('el reparto suma el total y descarta lo cancelado', () => {
    const encuentros = encuentrosDe([
      acto('a', ['2026-09-08T13:00:00Z', '2026-09-08T22:00:00Z', '2026-09-09T22:00:00Z']),
      acto('b', ['2026-09-10T22:00:00Z'], { estado: 'cancelado' }),
    ]);
    const reparto = porFranja(encuentros);
    expect(reparto).toEqual({ manana: 1, tarde: 0, noche: 2 });
    expect(Object.values(reparto).reduce((s, n) => s + n, 0)).toBe(3);
  });
});
