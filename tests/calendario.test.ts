import { describe, expect, it } from 'vitest';
// @ts-expect-error — la Function es JS plano, sin tipos.
import { actividadCambio, construirEvento, planificar, sesionCambio, TIMEZONE } from '../functions/calendario.js';

/** Timestamp mínimo, como el que entrega Firestore a la Function. */
const ts = (iso: string) => {
  const d = new Date(iso);
  return { toDate: () => d, toMillis: () => d.getTime() };
};

const sesion = (over: Record<string, unknown> = {}) => ({
  id: 'ses_1',
  inicio: ts('2026-09-03T22:00:00Z'),
  fin: ts('2026-09-04T00:00:00Z'),
  tema: null,
  lectura: null,
  cancelada: false,
  calendarEventId: null,
  ...over,
});

const actividad = (over: Record<string, unknown> = {}) => ({
  titulo: 'Club de lectura',
  descripcion: 'Ocho encuentros',
  estado: 'publicado',
  modalidad: 'presencial',
  sede: { nombre: 'Casa Brandon', direccion: 'Drago 236' },
  inscripcion: { requiere: false, destino: '' },
  sesiones: [sesion()],
  ...over,
});

const tipos = (ops: { tipo: string }[]) => ops.map((o) => o.tipo);

describe('planificar — creación', () => {
  it('crea un evento por sesión de una actividad publicada', () => {
    const ops = planificar(null, actividad());
    expect(tipos(ops)).toEqual(['crear']);
  });

  it('no crea nada si la actividad está en borrador (§7.3)', () => {
    expect(planificar(null, actividad({ estado: 'borrador' }))).toEqual([]);
  });

  it('no crea nada para una sesión cancelada (§7.3)', () => {
    const a = actividad({ sesiones: [sesion({ cancelada: true })] });
    expect(planificar(null, a)).toEqual([]);
  });

  it('crea un evento por cada encuentro del ciclo, no uno recurrente (§2.2)', () => {
    const a = actividad({
      sesiones: [
        sesion({ id: 'ses_1' }),
        sesion({ id: 'ses_2' }),
        sesion({ id: 'ses_3' }),
      ],
    });
    expect(planificar(null, a)).toHaveLength(3);
  });
});

describe('planificar — guarda anti-loop (§7.1, trampa 3)', () => {
  it('escribir calendarEventId no genera ninguna operación', () => {
    const antes = actividad();
    // Exactamente lo que hace la Function al terminar: guarda el id del evento.
    const despues = actividad({ sesiones: [sesion({ calendarEventId: 'evt_1' })] });
    expect(planificar(antes, despues)).toEqual([]);
  });

  it('calendarEventId no cuenta como cambio de la sesión', () => {
    expect(sesionCambio(sesion(), sesion({ calendarEventId: 'evt_1' }))).toBe(false);
  });

  it('el array sesiones no entra en la comparación de la actividad', () => {
    const a = actividad();
    const b = actividad({ sesiones: [sesion({ calendarEventId: 'evt_1' })] });
    expect(actividadCambio(a, b)).toBe(false);
  });
});

describe('planificar — diff por id (§7.2, trampa 2)', () => {
  const tres = [
    sesion({ id: 'ses_a', calendarEventId: 'evt_a' }),
    sesion({ id: 'ses_b', calendarEventId: 'evt_b' }),
    sesion({ id: 'ses_c', calendarEventId: 'evt_c' }),
  ];

  it('borrar la sesión del medio toca solo su evento', () => {
    const antes = actividad({ sesiones: tres });
    const despues = actividad({ sesiones: [tres[0]!, tres[2]!] });

    const ops = planificar(antes, despues);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'borrar', eventId: 'evt_b' });
  });

  it('borrar la primera no renumera ni toca las otras dos', () => {
    const antes = actividad({ sesiones: tres });
    const despues = actividad({ sesiones: [tres[1]!, tres[2]!] });

    const ops = planificar(antes, despues);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'borrar', eventId: 'evt_a' });
  });

  it('agregar un encuentro no toca los existentes', () => {
    const antes = actividad({ sesiones: tres });
    const despues = actividad({ sesiones: [...tres, sesion({ id: 'ses_d' })] });

    const ops = planificar(antes, despues);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'crear', id: 'ses_d' });
  });

  it('correr la fecha de un encuentro actualiza solo ese', () => {
    const antes = actividad({ sesiones: tres });
    const corrida = { ...tres[1]!, inicio: ts('2026-09-17T22:00:00Z') };
    const despues = actividad({ sesiones: [tres[0]!, corrida, tres[2]!] });

    const ops = planificar(antes, despues);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'actualizar', eventId: 'evt_b' });
  });
});

describe('planificar — cambio global (trampa 9)', () => {
  const ocho = Array.from({ length: 8 }, (_, i) =>
    sesion({ id: `ses_${i}`, calendarEventId: `evt_${i}` }),
  );

  it('un cambio de sede propaga a las ocho sesiones del ciclo', () => {
    const antes = actividad({ sesiones: ocho });
    const despues = actividad({
      sesiones: ocho,
      sede: { nombre: 'Otra sede', direccion: 'Corrientes 1234' },
    });

    const ops = planificar(antes, despues);
    expect(ops).toHaveLength(8);
    expect(tipos(ops).every((t) => t === 'actualizar')).toBe(true);
  });

  it('un cambio de título también propaga a todas', () => {
    const antes = actividad({ sesiones: ocho });
    const despues = actividad({ sesiones: ocho, titulo: 'Título nuevo' });
    expect(planificar(antes, despues)).toHaveLength(8);
  });

  it('cambiar un campo que no afecta al evento no propaga nada', () => {
    const antes = actividad({ sesiones: ocho });
    // difusion es interna y no sale al calendario.
    const despues = actividad({ sesiones: ocho, difusion: { notas: 'nuevo' } });
    expect(planificar(antes, despues)).toEqual([]);
  });
});

describe('planificar — despublicar y cancelar (§7.3)', () => {
  const dos = [
    sesion({ id: 'ses_a', calendarEventId: 'evt_a' }),
    sesion({ id: 'ses_b', calendarEventId: 'evt_b' }),
  ];

  it('pasar a borrador borra todos los eventos', () => {
    const ops = planificar(actividad({ sesiones: dos }), actividad({ sesiones: dos, estado: 'borrador' }));
    expect(tipos(ops)).toEqual(['borrar', 'borrar']);
  });

  it('cancelar la actividad borra todos los eventos', () => {
    const ops = planificar(actividad({ sesiones: dos }), actividad({ sesiones: dos, estado: 'cancelado' }));
    expect(tipos(ops)).toEqual(['borrar', 'borrar']);
  });

  it('cancelar un encuentro borra solo el suyo', () => {
    const despues = actividad({
      sesiones: [dos[0]!, { ...dos[1]!, cancelada: true }],
    });
    const ops = planificar(actividad({ sesiones: dos }), despues);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'borrar', eventId: 'evt_b' });
  });

  it('borrar la actividad entera borra todos los eventos', () => {
    const ops = planificar(actividad({ sesiones: dos }), null);
    expect(tipos(ops)).toEqual(['borrar', 'borrar']);
  });

  it('republicar vuelve a crear los eventos', () => {
    const sinIds = dos.map((s) => ({ ...s, calendarEventId: null }));
    const antes = actividad({ sesiones: sinIds, estado: 'borrador' });
    const despues = actividad({ sesiones: sinIds, estado: 'publicado' });
    expect(tipos(planificar(antes, despues))).toEqual(['crear', 'crear']);
  });
});

describe('construirEvento — §7.4', () => {
  it('manda timeZone explícito, siempre (trampa 1)', () => {
    const e = construirEvento(actividad(), sesion());
    expect(e.start.timeZone).toBe(TIMEZONE);
    expect(e.end.timeZone).toBe(TIMEZONE);
    expect(TIMEZONE).toBe('America/Argentina/Buenos_Aires');
  });

  it('no corre la hora al serializar', () => {
    const e = construirEvento(actividad(), sesion());
    expect(e.start.dateTime).toBe('2026-09-03T22:00:00.000Z');
    expect(e.end.dateTime).toBe('2026-09-04T00:00:00.000Z');
  });

  it('suma el tema al título del evento', () => {
    const e = construirEvento(actividad(), sesion({ tema: 'Cap. 1-4' }));
    expect(e.summary).toBe('Club de lectura — Cap. 1-4');
  });

  it('sin tema, el título va limpio', () => {
    expect(construirEvento(actividad(), sesion()).summary).toBe('Club de lectura');
  });

  it('NO publica el link de la reunión en la descripción (trampa 5)', () => {
    const a = actividad({
      modalidad: 'virtual',
      online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
    });
    const e = construirEvento(a, sesion());
    expect(JSON.stringify(e)).not.toContain('zoom.us/j/secreto');
  });

  it('no filtra la difusión interna', () => {
    const a = actividad({ difusion: { arrobar: ['@x'], notas: 'coordinar con prensa' } });
    expect(JSON.stringify(construirEvento(a, sesion()))).not.toContain('coordinar con prensa');
  });

  it('usa la dirección de la sede como ubicación', () => {
    expect(construirEvento(actividad(), sesion()).location).toBe('Drago 236');
  });

  it('sin sede no manda ubicación', () => {
    const e = construirEvento(actividad({ sede: null, modalidad: 'virtual' }), sesion());
    expect(e.location).toBeUndefined();
  });
});
