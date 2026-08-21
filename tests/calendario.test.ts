import { describe, expect, it } from 'vitest';
// @ts-expect-error — la Function es JS plano, sin tipos.
import {
  construirDescripcion,
  construirEvento,
  construirLinkMapa,
  construirUbicacion,
  planificar,
  TIMEZONE,
} from '../functions/calendario.js';

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

  it('el id del evento no forma parte del payload que se compara', () => {
    const a = construirEvento(actividad(), sesion());
    const b = construirEvento(actividad(), sesion({ calendarEventId: 'evt_1' }));
    expect(a).toEqual(b);
  });

  it('editar la difusión interna no dispara ningún update', () => {
    const s = sesion({ calendarEventId: 'evt_1' });
    const antes = actividad({ sesiones: [s] });
    const despues = actividad({ sesiones: [s], difusion: { arrobar: ['@x'], notas: 'privado' } });
    expect(planificar(antes, despues)).toEqual([]);
  });

  it('editar el link privado de la reunión no dispara ningún update', () => {
    const s = sesion({ calendarEventId: 'evt_1' });
    const base = { modalidad: 'virtual', sede: null, sesiones: [s] };
    const antes = actividad({ ...base, online: { plataforma: 'zoom', url: 'https://a', urlPublica: false } });
    const despues = actividad({ ...base, online: { plataforma: 'zoom', url: 'https://b', urlPublica: false } });
    expect(planificar(antes, despues)).toEqual([]);
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
    expect(ops[0].evento.summary).toBeTruthy();
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

  it('la ubicación lleva sede, calle y país, no solo la calle', () => {
    // "Drago 236" solo no se puede geolocalizar: Google no tiene con qué
    // desambiguar y el evento queda sin mapa o con el mapa en otra ciudad.
    const loc = construirEvento(actividad(), sesion()).location;
    expect(loc).toContain('Drago 236');
    expect(loc).toContain('Argentina');
  });

  it('una actividad virtual se lee como tal en la vista de agenda', () => {
    const e = construirEvento(actividad({ sede: null, modalidad: 'virtual' }), sesion());
    expect(e.location).toBe('Encuentro virtual');
  });
});

const sedeCompleta = {
  nombre: 'Casa Brandon',
  direccion: 'Luis María Drago 236',
  barrio: 'Villa Crespo',
  ciudad: 'CABA',
  indicaciones: 'Timbre 2',
  geo: null,
};

describe('construirUbicacion', () => {
  it('junta sede, calle, barrio, ciudad y país', () => {
    expect(construirUbicacion(actividad({ sede: sedeCompleta }), LABELS)).toBe(
      'Casa Brandon, Luis María Drago 236, Villa Crespo, CABA, Argentina',
    );
  });

  it('no repite un valor cargado en dos campos', () => {
    const sede = { ...sedeCompleta, barrio: 'Palermo', ciudad: 'Palermo' };
    expect(construirUbicacion(actividad({ sede }))).toBe(
      'Casa Brandon, Luis María Drago 236, Palermo, Argentina',
    );
  });

  it('tolera una sede con solo dirección', () => {
    const sede = { nombre: '', direccion: 'Corrientes 1234', barrio: '', ciudad: '', geo: null };
    expect(construirUbicacion(actividad({ sede }))).toBe('Corrientes 1234, Argentina');
  });

  it('sin sede y presencial no inventa ubicación', () => {
    expect(construirUbicacion(actividad({ sede: null, modalidad: 'presencial' }))).toBeUndefined();
  });
});

describe('construirLinkMapa', () => {
  it('arma una búsqueda de Google Maps con la dirección completa', () => {
    const link = construirLinkMapa(actividad({ sede: sedeCompleta }));
    expect(link).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(decodeURIComponent(link!)).toContain('Luis María Drago 236');
    expect(decodeURIComponent(link!)).toContain('Argentina');
  });

  it('si la sede tiene coordenadas, usa el punto exacto', () => {
    const sede = { ...sedeCompleta, geo: { lat: -34.5989, lng: -58.4392 } };
    const link = construirLinkMapa(actividad({ sede }));
    expect(link).toContain('query=-34.5989%2C-58.4392');
  });

  it('sin sede no hay mapa', () => {
    expect(construirLinkMapa(actividad({ sede: null }))).toBeNull();
  });
});

const LABELS = {
  arancel: { 'a-la-gorra': 'A la gorra', gratis: 'Gratis' },
  tipo: { 'club-lectura': 'Club de lectura', taller: 'Taller' },
  barrio: { 'villa-crespo': 'Villa Crespo' },
  plataforma: { zoom: 'Zoom' },
  tags: { narrativa: 'Narrativa' },
};

const completa = (over: Record<string, unknown> = {}) =>
  actividad({
    tipo: 'club-lectura',
    sede: { ...sedeCompleta, barrio: 'villa-crespo' },
    online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: false },
    modalidad: 'hibrido',
    arancel: { tipo: 'a-la-gorra', notas: 'incluye material' },
    inscripcion: {
      requiere: true,
      via: 'mail',
      destino: 'hola@casabrandon.org',
      cupo: 12,
      cierra: ts('2026-09-01T15:00:00Z'),
    },
    material: {
      tiene: true,
      items: [
        { tipo: 'lectura', titulo: 'Pedro Páramo', url: 'https://drive/publico', entrega: 'previo', publico: true },
        { tipo: 'guia', titulo: 'Guía de lectura', url: 'https://drive/privado', entrega: 'al-inscribirse', publico: false },
      ],
    },
    organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: 'https://casabrandon.org' },
    tallerista: { nombre: 'María Moreno', bio: 'Cronista y ensayista.', instagram: '@mmoreno' },
    tags: ['narrativa'],
    difusion: { arrobar: ['@editorial'], notas: 'coordinar con prensa' },
    ...over,
  });

describe('construirDescripcion — lo que SÍ va al evento', () => {
  const d = () => construirDescripcion(completa(), sesion({ tema: 'Cap. 1-4', lectura: 'Pedro Páramo' }), LABELS);

  it('resuelve los slugs de taxonomía a su etiqueta legible (§4.1)', () => {
    expect(d()).toContain('A la gorra');
    expect(d()).not.toContain('a-la-gorra');
    expect(d()).toContain('Club de lectura');
    expect(d()).toContain('Villa Crespo');
  });

  it('incluye modalidad, sede, cómo llegar y el mapa', () => {
    const texto = d();
    expect(texto).toContain('Presencial y virtual');
    expect(texto).toContain('Casa Brandon');
    expect(texto).toContain('Timbre 2');
    expect(texto).toContain('google.com/maps');
  });

  it('incluye el arancel con sus notas', () => {
    expect(d()).toContain('incluye material');
  });

  it('incluye la inscripción completa', () => {
    const texto = d();
    expect(texto).toContain('hola@casabrandon.org');
    expect(texto).toContain('Cupo: 12');
    expect(texto).toMatch(/Cierra: .*2026/);
  });

  it('incluye organizador y tallerista con su bio', () => {
    const texto = d();
    expect(texto).toContain('Casa Brandon');
    expect(texto).toContain('@casabrandon');
    expect(texto).toContain('María Moreno');
    expect(texto).toContain('Cronista y ensayista.');
  });

  it('llama Invitado al tallerista en una presentación', () => {
    const texto = construirDescripcion(completa({ tipo: 'presentacion' }), sesion(), LABELS);
    expect(texto).toContain('Invitado: María Moreno');
  });

  it('incluye tema y lectura del encuentro', () => {
    const texto = d();
    expect(texto).toContain('Tema: Cap. 1-4');
    expect(texto).toContain('Lectura: Pedro Páramo');
  });

  it('incluye los tags como temas', () => {
    expect(d()).toContain('Narrativa');
  });

  it('numera el encuentro dentro del ciclo', () => {
    const s1 = sesion({ id: 'ses_1', inicio: ts('2026-09-03T22:00:00Z') });
    const s2 = sesion({ id: 'ses_2', inicio: ts('2026-09-10T22:00:00Z') });
    const a = completa({ esCiclo: true, sesiones: [s1, s2] });
    expect(construirDescripcion(a, s2, LABELS)).toContain('Encuentro 2 de 2');
  });

  it('numera por fecha, no por posición en el array', () => {
    const tarde = sesion({ id: 'ses_tarde', inicio: ts('2026-09-10T22:00:00Z') });
    const temprano = sesion({ id: 'ses_temprano', inicio: ts('2026-09-03T22:00:00Z') });
    // Array desordenado a propósito.
    const a = completa({ esCiclo: true, sesiones: [tarde, temprano] });
    expect(construirDescripcion(a, temprano, LABELS)).toContain('Encuentro 1 de 2');
  });

  it('no numera una actividad de un solo encuentro', () => {
    expect(construirDescripcion(completa({ esCiclo: false }), sesion(), LABELS)).not.toContain('Encuentro 1');
  });

  it('avisa cuando no hay inscripción previa', () => {
    const a = completa({ inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null } });
    expect(construirDescripcion(a, sesion(), LABELS)).toContain('Sin inscripción previa');
  });
});

describe('construirDescripcion — lo que NUNCA va al evento (§5.1, §7.4)', () => {
  const d = () => construirDescripcion(completa(), sesion(), LABELS);

  it('no publica el link de la reunión, solo la plataforma (trampa 5)', () => {
    expect(d()).not.toContain('zoom.us/j/secreto');
    expect(d()).toContain('Zoom');
    expect(d()).toContain('se envía a quienes se inscriban');
  });

  it('no publica el link ni siquiera con urlPublica en true', () => {
    // §7.4 es incondicional: el calendario es público.
    const a = completa({ online: { plataforma: 'zoom', url: 'https://zoom.us/j/secreto', urlPublica: true } });
    expect(construirDescripcion(a, sesion(), LABELS)).not.toContain('zoom.us/j/secreto');
  });

  it('no publica la difusión interna', () => {
    expect(d()).not.toContain('coordinar con prensa');
    expect(d()).not.toContain('@editorial');
  });

  it('un material privado conserva título pero pierde la URL', () => {
    const texto = d();
    expect(texto).toContain('Guía de lectura');
    expect(texto).not.toContain('drive/privado');
    expect(texto).toContain('drive/publico');
  });

  it('no publica material si la casilla está destildada', () => {
    const a = completa({ material: { tiene: false, items: [{ tipo: 'lectura', titulo: 'Oculto', url: 'https://x', entrega: 'previo', publico: true }] } });
    expect(construirDescripcion(a, sesion(), LABELS)).not.toContain('Oculto');
  });
});

describe('planificar — el payload propaga los campos nuevos', () => {
  const s = sesion({ calendarEventId: 'evt_1' });

  it('cambiar el arancel actualiza el evento', () => {
    const antes = completa({ sesiones: [s] });
    const despues = completa({ sesiones: [s], arancel: { tipo: 'gratis', notas: '' } });
    expect(planificar(antes, despues, LABELS).map((o: { tipo: string }) => o.tipo)).toEqual(['actualizar']);
  });

  it('cambiar el organizador actualiza el evento', () => {
    const antes = completa({ sesiones: [s] });
    const despues = completa({ sesiones: [s], organizador: { nombre: 'Otro', instagram: '', web: '' } });
    expect(planificar(antes, despues, LABELS)).toHaveLength(1);
  });

  it('cambiar la inscripción actualiza el evento', () => {
    const antes = completa({ sesiones: [s] });
    const despues = completa({
      sesiones: [s],
      inscripcion: { requiere: true, via: 'whatsapp', destino: 'https://wa.me/1', cupo: 5, cierra: null },
    });
    expect(planificar(antes, despues, LABELS)).toHaveLength(1);
  });

  it('agregar material actualiza el evento', () => {
    const antes = completa({ sesiones: [s], material: { tiene: false, items: [] } });
    const despues = completa({ sesiones: [s] });
    expect(planificar(antes, despues, LABELS)).toHaveLength(1);
  });
});

describe('etiquetas — el calendario es público, no puede mostrar slugs crudos', () => {
  it('usa la etiqueta registrada en /opciones cuando existe', () => {
    const a = completa({ sede: { ...sedeCompleta, barrio: 'villa-crespo' } });
    expect(construirDescripcion(a, sesion(), LABELS)).toContain('Villa Crespo');
  });

  it('des-sluguea como último recurso si no está registrada', () => {
    // Sin LABELS: un slug creado con "Otro" que todavía no se leyó de Firestore.
    const a = completa({ sede: { ...sedeCompleta, barrio: 'parque-chas' } });
    const texto = construirDescripcion(a, sesion(), {});
    expect(texto).toContain('Parque Chas');
    expect(texto).not.toContain('parque-chas');
  });

  it('no deja slugs con guiones en los tags', () => {
    const a = completa({ tags: ['no-ficcion'] });
    expect(construirDescripcion(a, sesion(), {})).toContain('No Ficcion');
  });

  it('el tipo de material sale con tilde, no con el valor del enum', () => {
    const texto = construirDescripcion(completa(), sesion(), LABELS);
    expect(texto).toContain('Guía, al inscribirse');
    expect(texto).not.toContain('(guia,');
  });
});
