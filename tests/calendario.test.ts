import { describe, expect, it } from 'vitest';
// La Function es JS plano; TS le infiere los tipos con allowJs.
import {
  construirDescripcion,
  construirEvento,
  construirLinkMapa,
  construirUbicacion,
  planificar,
  TIMEZONE,
} from '../functions/calendario.js';
import { ts } from './fixtures/tiempo';

/** Timestamp mínimo, como el que entrega Firestore a la Function. */


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

/**
 * Un ciclo de verdad: `esCiclo` tildado y N encuentros con fechas distintas.
 *
 * El §2.2 dice que el ciclo es el caso normal —"un club de lectura de 8
 * encuentros es UNA actividad con OCHO sesiones"—, así que los tests del diff
 * corren sobre esto y no sobre una actividad de un solo encuentro. Con
 * `esCiclo` ausente o con todas las sesiones en el mismo instante, la
 * numeración del evento (`posicionEnCiclo`) no entra en juego y el invariante
 * que se quiere proteger no se ejercita: es lo que hacía pasar el test de
 * B-84.
 */
const sesionesSemanales = (
  cuantas: number,
  over: (i: number) => Record<string, unknown> = () => ({}),
) =>
  Array.from({ length: cuantas }, (_, i) =>
    sesion({
      id: `ses_${i}`,
      inicio: ts(new Date(Date.UTC(2026, 8, 3, 22) + i * 7 * 86_400_000).toISOString()),
      fin: ts(new Date(Date.UTC(2026, 8, 4, 0) + i * 7 * 86_400_000).toISOString()),
      calendarEventId: `evt_${i}`,
      ...over(i),
    }),
  );

const ciclo = (over: Record<string, unknown> = {}) =>
  actividad({ esCiclo: true, sesiones: sesionesSemanales(8), ...over });

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
    const a = ciclo({ sesiones: sesionesSemanales(3, () => ({ calendarEventId: null })) });
    const ops = planificar(null, a);
    expect(tipos(ops)).toEqual(['crear', 'crear', 'crear']);
    // Cada evento es el suyo, numerado: nada de RRULE ni de un evento madre.
    expect(ops.map((o) => (o as { evento: { description: string } }).evento.description)).toEqual([
      expect.stringContaining('Encuentro 1 de 3'),
      expect.stringContaining('Encuentro 2 de 3'),
      expect.stringContaining('Encuentro 3 de 3'),
    ]);
  });
});

describe('planificar — guarda anti-loop (§7.1, trampa 3)', () => {
  it('escribir calendarEventId no genera ninguna operación', () => {
    const antes = actividad();
    // Exactamente lo que hace la Function al terminar: guarda el id del evento.
    const despues = actividad({ sesiones: [sesion({ calendarEventId: 'evt_1' })] });
    expect(planificar(antes, despues)).toEqual([]);
  });

  it('escribir los ocho calendarEventId de un ciclo tampoco genera nada', () => {
    // Lo que hace la Function al terminar de crear los ocho eventos. Si la
    // numeración dependiera de algo que el write-back mueve, esto reentraría.
    const antes = ciclo({ sesiones: sesionesSemanales(8, () => ({ calendarEventId: null })) });
    expect(planificar(antes, ciclo())).toEqual([]);
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
  // Un ciclo de tres encuentros semanales, cada uno con su evento ya creado.
  const tres = sesionesSemanales(3);
  const conTres = (over: Record<string, unknown> = {}) =>
    ciclo({ sesiones: tres, ...over });

  /** Lo que el §7.2 no perdona: que un encuentro que no cambió se borre y se recree. */
  const niBorraNiRecrea = (ops: { tipo: string; eventId?: string }[], eventId: string) => {
    expect(ops.filter((o) => o.tipo === 'crear')).toHaveLength(0);
    expect(ops.filter((o) => o.tipo === 'borrar')).toEqual([
      expect.objectContaining({ eventId }),
    ]);
  };

  it('borrar la sesión del medio borra solo su evento', () => {
    const despues = ciclo({ sesiones: [tres[0]!, tres[2]!] });
    const ops = planificar(conTres(), despues);

    niBorraNiRecrea(ops, 'evt_1');
    // Las otras dos se actualizan porque el ciclo pasó a tener dos encuentros:
    // la fila se eliminó, así que el "de 3" dejó de ser cierto. Es texto, no
    // borrar y recrear: el evento que la gente tiene agendado sobrevive.
    expect(tipos(ops)).toEqual(['borrar', 'actualizar', 'actualizar']);
  });

  it('borrar la primera no borra ni recrea a las otras dos', () => {
    const despues = ciclo({ sesiones: [tres[1]!, tres[2]!] });
    const ops = planificar(conTres(), despues);

    niBorraNiRecrea(ops, 'evt_0');
    expect(ops.filter((o) => o.tipo === 'actualizar')).toHaveLength(2);
  });

  it('agregar un encuentro crea solo el nuevo', () => {
    const cuarta = sesion({
      id: 'ses_3',
      inicio: ts('2026-09-24T22:00:00Z'),
      fin: ts('2026-09-25T00:00:00Z'),
    });
    const ops = planificar(conTres(), ciclo({ sesiones: [...tres, cuarta] }));

    expect(ops.filter((o) => o.tipo === 'borrar')).toHaveLength(0);
    // La op de crear trae el evento ya armado: la Function no lo reconstruye.
    expect(ops.find((o) => o.tipo === 'crear')).toMatchObject({
      id: 'ses_3',
      evento: { summary: expect.any(String) },
    });
    // Los tres existentes se actualizan: el ciclo pasó a ser de cuatro.
    expect(ops.filter((o) => o.tipo === 'actualizar')).toHaveLength(3);
  });

  it('correr la fecha de un encuentro actualiza solo ese', () => {
    // Se corre un día, sin pasar al siguiente: la numeración no se mueve. Se
    // corren las dos puntas, que es lo que hace el formulario.
    const corrida = {
      ...tres[1]!,
      inicio: ts('2026-09-11T22:00:00Z'),
      fin: ts('2026-09-12T00:00:00Z'),
    };
    const despues = ciclo({ sesiones: [tres[0]!, corrida, tres[2]!] });

    const ops = planificar(conTres(), despues);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'actualizar', eventId: 'evt_1' });
  });
});

describe('planificar — cambio global (trampa 9)', () => {
  it('un cambio de sede propaga a las ocho sesiones del ciclo', () => {
    const despues = ciclo({ sede: { nombre: 'Otra sede', direccion: 'Corrientes 1234' } });

    const ops = planificar(ciclo(), despues);
    expect(ops).toHaveLength(8);
    expect(tipos(ops).every((t) => t === 'actualizar')).toBe(true);
  });

  /**
   * DEC-1 + trampa 9 — el libro entra al evento por `construirDescripcion`, que
   * es lo que compara la guarda anti-loop (D-07). Por eso corregir el título de
   * la obra en una actividad de ocho encuentros actualiza los ocho eventos, sin
   * ningún caso especial. Armado por fuera de `construirEvento` habría dejado de
   * propagarse **en silencio**, que es exactamente la trampa 9.
   */
  it('DEC-1: corregir el libro presentado propaga a las ocho sesiones (trampa 9)', () => {
    const antes = ciclo({ libro: { titulo: 'Los detectives salvages', autor: '' } });
    const despues = ciclo({ libro: { titulo: 'Los detectives salvajes', autor: '' } });
    const ops = planificar(antes, despues);
    expect(ops).toHaveLength(8);
    expect(ops.every((o) => o.tipo === 'actualizar')).toBe(true);
    for (const op of ops) {
      expect(op.evento?.description).toContain('Los detectives salvajes');
    }
  });

  /**
   * B-97 + trampa 9 — es el riesgo que el ítem marcaba para mirar de verdad:
   * prender «se llenó» cambia la descripción de los N eventos del ciclo.
   *
   * Es lo correcto y es el punto del campo —así se entera quien ya estaba
   * suscripto al calendario, sin que nadie le avise— y la guarda del §7.1 lo
   * maneja sin ningún caso especial porque la línea se arma **adentro** de
   * `construirDescripcion` (D-07). Lo que este test fija es que sean ocho
   * `actualizar` y **cero** `borrar` y cero `crear`: borrar y recrear le
   * perdería a la gente sus recordatorios, y es exactamente lo que pasaría si la
   * línea se armara por fuera y alguien "arreglara" el diff a mano.
   */
  it('B-97: marcar cupo completo actualiza los ocho eventos y no borra ninguno (trampa 9)', () => {
    const conCupo = (completo: boolean) =>
      ciclo({
        inscripcion: {
          requiere: true,
          via: 'mail',
          destino: 'hola@casabrandon.example',
          cupo: 12,
          completo,
        },
      });

    const ops = planificar(conCupo(false), conCupo(true));
    expect(tipos(ops)).toEqual(Array(8).fill('actualizar'));
    for (const op of ops) {
      expect((op as { evento: { description: string } }).evento.description).toContain(
        'Cupo completo',
      );
    }

    // Y apagarlo también propaga a las ocho: si se libera un lugar, el cartel se
    // va del calendario de todos, no solo del sitio.
    const apagado = planificar(conCupo(true), conCupo(false));
    expect(tipos(apagado)).toEqual(Array(8).fill('actualizar'));
    for (const op of apagado) {
      expect((op as { evento: { description: string } }).evento.description).not.toContain(
        'Cupo completo',
      );
    }
  });

  it('un cambio de título también propaga a todas', () => {
    expect(planificar(ciclo(), ciclo({ titulo: 'Título nuevo' }))).toHaveLength(8);
  });

  it('cambiar un campo que no afecta al evento no propaga nada', () => {
    // difusion es interna y no sale al calendario.
    expect(planificar(ciclo(), ciclo({ difusion: { notas: 'nuevo' } }))).toEqual([]);
  });
});

describe('planificar — despublicar y cancelar (§7.3)', () => {
  const ocho = sesionesSemanales(8);

  it('pasar a borrador borra los ocho eventos', () => {
    const ops = planificar(ciclo(), ciclo({ estado: 'borrador' }));
    expect(tipos(ops)).toEqual(Array(8).fill('borrar'));
  });

  it('cancelar la actividad borra los ocho eventos', () => {
    const ops = planificar(ciclo(), ciclo({ estado: 'cancelado' }));
    expect(tipos(ops)).toEqual(Array(8).fill('borrar'));
  });

  /**
   * B-84. El fixture es un ciclo a propósito: con una actividad de dos
   * sesiones y sin `esCiclo` este test pasaba mientras el invariante estaba
   * roto, porque la numeración del evento no entraba en juego (§2.2).
   */
  it('cancelar el tercero de ocho borra solo el suyo (B-84)', () => {
    const despues = ciclo({
      sesiones: sesionesSemanales(8, (i) => (i === 2 ? { cancelada: true } : {})),
    });
    const ops = planificar(ciclo(), despues);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'borrar', eventId: 'evt_2' });
  });

  it('borrar la actividad entera borra los ocho eventos', () => {
    expect(tipos(planificar(ciclo(), null))).toEqual(Array(8).fill('borrar'));
  });

  it('republicar vuelve a crear los eventos', () => {
    const sinIds = ocho.map((s) => ({ ...s, calendarEventId: null }));
    const antes = ciclo({ sesiones: sinIds, estado: 'borrador' });
    const despues = ciclo({ sesiones: sinIds, estado: 'publicado' });
    expect(tipos(planificar(antes, despues))).toEqual(Array(8).fill('crear'));
  });
});

/**
 * B-84 · qué significa el número del encuentro (D-95).
 *
 * Se numera sobre **todas** las sesiones, canceladas incluidas: el número es la
 * identidad del encuentro dentro del ciclo —qué lectura le toca, qué fila del
 * formulario es—, no un recuento en vivo de los que siguen en pie. Numerando
 * sobre las no canceladas, cancelar el tercero de ocho convertía al sexto en
 * "Encuentro 5 de 7" y el diff reescribía los otros siete.
 */
describe('numeración del ciclo — cancelar no renumera (B-84, D-95)', () => {
  const conTercerCancelado = ciclo({
    sesiones: sesionesSemanales(8, (i) => (i === 2 ? { cancelada: true } : {})),
  });

  it('el sexto sigue siendo "Encuentro 6 de 8" después de cancelar el tercero', () => {
    const antes = ciclo();
    expect(construirDescripcion(antes, antes.sesiones[5]!, LABELS)).toContain('Encuentro 6 de 8');
    expect(
      construirDescripcion(conTercerCancelado, conTercerCancelado.sesiones[5]!, LABELS),
    ).toContain('Encuentro 6 de 8');
  });

  it('el cancelado conserva su número, aunque no tenga evento', () => {
    // La vista previa del panel sí lo muestra: ahí se ve cómo quedaría.
    expect(
      construirDescripcion(conTercerCancelado, conTercerCancelado.sesiones[2]!, LABELS),
    ).toContain('Encuentro 3 de 8');
  });

  it('cancelar uno de dos deja "1 de 2", no "1 de 1"', () => {
    const dos = ciclo({ sesiones: sesionesSemanales(2, (i) => (i === 1 ? { cancelada: true } : {})) });
    expect(construirDescripcion(dos, dos.sesiones[0]!, LABELS)).toContain('Encuentro 1 de 2');
  });

  it('el total no cambia por cancelar, así que ningún otro evento se toca', () => {
    const ops = planificar(ciclo(), conTercerCancelado);
    expect(ops.filter((o: { tipo: string }) => o.tipo === 'actualizar')).toHaveLength(0);
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
      destino: 'hola@casabrandon.example',
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
    organizador: { nombre: 'Casa Brandon', instagram: '@casabrandon', web: 'https://casabrandon.example' },
    tallerista: { nombre: 'María Moreno', bio: 'Cronista y ensayista.', instagram: '@mmoreno' },
    // DEC-1 — el libro presentado va con centinelas, y no es decoración: si el
    // fixture no tuviera el campo, **nada** fijaría esta celda de la tabla del
    // paso 0 y sacar la línea de la descripción no rompería ningún test. Es lo
    // que pasó con la galería (B-167).
    libro: { titulo: 'CENTINELA-LIBRO Los detectives salvajes', autor: 'CENTINELA-AUTORLIBRO Bolano' },
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
    expect(texto).toContain('hola@casabrandon.example');
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

  /**
   * DEC-1 — el libro presentado **sí va al evento** (§5.1): «presentación de tal
   * libro» es el dato central del evento, del mismo orden que el título.
   */
  it('incluye el libro presentado con su autor (DEC-1, §5.1)', () => {
    expect(d()).toContain('Libro: CENTINELA-LIBRO Los detectives salvajes');
    expect(d()).toContain('— CENTINELA-AUTORLIBRO Bolano');
  });

  it('sin autor cargado no deja el guion suelto: el autor es el invitado (DEC-1)', () => {
    const a = completa({ libro: { titulo: 'Los siete locos', autor: '' } });
    const texto = construirDescripcion(a, sesion(), LABELS);
    expect(texto).toContain('Libro: Los siete locos');
    expect(texto).not.toContain('Los siete locos —');
  });

  it('sin libro cargado no aparece el rótulo (DEC-1)', () => {
    // Es el caso de todo documento anterior a DEC-1 y de todo taller: el campo
    // ausente no puede pintar «Libro: » vacío en el calendario público.
    for (const libro of [undefined, null, { titulo: '', autor: '' }]) {
      const texto = construirDescripcion(completa({ libro }), sesion(), LABELS);
      expect(texto, `libro=${JSON.stringify(libro)}`).not.toContain('Libro:');
    }
  });

  /**
   * B-97 — «se llenó» **sí va al evento** (§5.1), y es el punto del campo: el
   * calendario es la única salida que le llega sola a quien ya guardó la fecha.
   */
  it('dice que el cupo está completo (B-97, §5.1)', () => {
    const texto = construirDescripcion(completa({
      inscripcion: { ...(completa().inscripcion as object), completo: true },
    }), sesion(), LABELS);
    expect(texto).toContain('Cupo completo');
  });

  /**
   * La segunda decisión del dueño, que es la que se puede perder en una
   * "mejora": el canal de inscripción **no se esconde** cuando está completo.
   * Siempre hay lista de espera y las bajas existen — esconder el canal
   * convierte una baja en un lugar que se pierde.
   */
  it('con el cupo completo el canal de inscripción sigue saliendo (B-97)', () => {
    const texto = construirDescripcion(completa({
      inscripcion: { ...(completa().inscripcion as object), completo: true },
    }), sesion(), LABELS);
    expect(texto).toContain('Inscripción por mail: hola@casabrandon.example');
    // Y el paréntesis que explica por qué el mail sigue ahí: sin él, un cupo
    // completo con un contacto al lado se lee como un error.
    expect(texto).toContain('puede liberarse un lugar');
  });

  it('sin inscripción previa también puede estar completo, y ahí la línea va sola (B-97)', () => {
    const texto = construirDescripcion(
      completa({ inscripcion: { requiere: false, destino: '', completo: true } }),
      sesion(),
      LABELS,
    );
    expect(texto).toContain('Sin inscripción previa');
    expect(texto).toContain('Cupo completo');
    // No hay a quién escribirle, así que tampoco se promete nada.
    expect(texto).not.toContain('puede liberarse un lugar');
  });

  it('sin marcarlo no aparece el rótulo, ni en los documentos que no tienen el campo (B-97)', () => {
    // Es el caso de toda actividad anterior a B-97: el default de lectura es
    // `false` y el calendario público no puede decir «Cupo completo» solo.
    for (const completo of [undefined, false]) {
      const texto = construirDescripcion(
        completa({ inscripcion: { ...(completa().inscripcion as object), completo } }),
        sesion(),
        LABELS,
      );
      expect(texto, `completo=${String(completo)}`).not.toContain('Cupo completo');
      // Y el cupo numérico sigue saliendo como siempre.
      expect(texto).toContain('Cupo: 12');
    }
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

/**
 * Las **instancias**: cada campo privado que existe hoy, con su caso propio.
 *
 * **La propiedad —"de las ~15 interpolaciones no sale nada más que lo
 * permitido"— vive en `tests/barrido-de-salidas-publicas.test.ts`** (B-196): ahí
 * el documento entero es centinelas y la aserción es sobre el evento completo
 * (`summary`, `description`, `location`), en los ocho encuentros del ciclo. Un
 * campo nuevo entra a ese chequeo solo, sin que nadie tenga que acordarse de
 * agregarle un `not.toContain` a este bloque.
 */
describe('construirDescripcion — lo que NUNCA va al evento (§5.1, §7.4)', () => {
  const d = () => construirDescripcion(completa(), sesion(), LABELS);

  /**
   * B-167 — la galería **no va al evento**: la API de Calendar no tiene campo de
   * imagen y el §7.4 arma solo `summary`, `description`, `location` y las fechas.
   *
   * Esta celda de la tabla del paso 0 no la fijaba nada: el fixture `completa()`
   * no tenía imágenes, así que agregar `Foto: ${…}` a la descripción no habría
   * roto ningún test. Los cuatro valores van con centinelas para que el que falle
   * diga **cuál** se escapó.
   */
  it('la galería no llega a la descripción del evento (trampa 5)', () => {
    const conGaleria = completa({
      imagenes: [
        {
          id: 'img_1',
          url: 'https://cdn.example/CENTINELA-URL-IMAGEN.jpg',
          epigrafe: 'CENTINELA-EPIGRAFE el patio',
          origen: 'propia',
          storagePath: 'CENTINELA-STORAGEPATH/act-1/tapa.jpg',
          portada: true,
        },
      ],
    });
    const texto = construirDescripcion(conGaleria, sesion(), LABELS);
    for (const centinela of [
      'CENTINELA-URL-IMAGEN',
      'CENTINELA-EPIGRAFE',
      'CENTINELA-STORAGEPATH',
    ]) {
      expect(texto, `se escapó ${centinela} a la descripción del evento`).not.toContain(
        centinela,
      );
    }
  });

  it('y tampoco al evento entero: ni al summary, ni a la ubicación', () => {
    const conGaleria = completa({
      imagenes: [
        {
          id: 'img_1',
          url: 'https://cdn.example/CENTINELA-URL-IMAGEN.jpg',
          epigrafe: 'CENTINELA-EPIGRAFE',
          origen: 'externa',
          portada: true,
        },
      ],
    });
    const evento = JSON.stringify(construirEvento(conGaleria, sesion(), LABELS));
    expect(evento).not.toContain('CENTINELA-URL-IMAGEN');
    expect(evento).not.toContain('CENTINELA-EPIGRAFE');
  });

  it('no publica el link de la reunión, solo la plataforma (trampa 5)', () => {
    expect(d()).not.toContain('zoom.us/j/secreto');
    expect(d()).toContain('Zoom');
    expect(d()).toContain('se envía a quienes se inscriban');
  });

  it('publica el link SOLO si urlPublica está en true', () => {
    // Desvío consciente del §7.4, decidido por el dueño: el modelo tiene el
    // flag y el formulario su casilla. Ignorarlo prometía algo que no pasaba.
    const a = completa({ online: { plataforma: 'zoom', url: 'https://zoom.us/j/abierto', urlPublica: true } });
    const texto = construirDescripcion(a, sesion(), LABELS);
    expect(texto).toContain('Link: https://zoom.us/j/abierto');
    expect(texto).not.toContain('se envía a quienes se inscriban');
  });

  it('el default es NO publicarlo', () => {
    // urlPublica es false por defecto en el formulario: publicar el link es una
    // acción deliberada por actividad, no el comportamiento por omisión.
    const texto = construirDescripcion(completa(), sesion(), LABELS);
    expect(texto).not.toContain('zoom.us/j/secreto');
    expect(texto).toContain('se envía a quienes se inscriban');
  });

  it('urlPublica en true sin URL cargada no rompe nada', () => {
    const a = completa({ online: { plataforma: 'zoom', url: '', urlPublica: true } });
    const texto = construirDescripcion(a, sesion(), LABELS);
    expect(texto).toContain('se envía a quienes se inscriban');
    expect(texto).not.toContain('Link:');
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

  it('tildar "publicar el link" actualiza los eventos ya creados', () => {
    const base = { plataforma: 'zoom', url: 'https://zoom.us/j/x' };
    const antes = completa({ sesiones: [s], online: { ...base, urlPublica: false } });
    const despues = completa({ sesiones: [s], online: { ...base, urlPublica: true } });
    expect(planificar(antes, despues, LABELS).map((o: { tipo: string }) => o.tipo)).toEqual(['actualizar']);
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

  it('un material de tipo «otro» no dice «Otro», pero sí cuándo llega (B-182)', () => {
    const a = completa({
      material: {
        tiene: true,
        items: [
          { tipo: 'otro', titulo: 'Grupo de Telegram', url: '', entrega: 'previo', publico: true },
        ],
      },
    });
    const texto = construirDescripcion(a, sesion(), LABELS);
    expect(texto).toContain('- Grupo de Telegram (previo al encuentro)');
    expect(texto).not.toContain('Otro,');
  });
});
