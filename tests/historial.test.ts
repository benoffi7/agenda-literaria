import { describe, expect, it } from 'vitest';
// La Function es JS plano; TS le infiere los tipos con allowJs.
import {
  camposCambiados,
  contenidoEditable,
  huboCambioDeContenido,
  idDeVersion,
  MAX_VERSIONES,
  versionesAborrar,
} from '../functions/historial.js';

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
  slug: 'club-de-lectura',
  descripcion: 'Ocho encuentros para leer a Rulfo con calma y sin apuro.',
  estado: 'publicado',
  modalidad: 'presencial',
  sede: { nombre: 'Casa Brandon', direccion: 'Drago 236', barrio: 'villa-crespo' },
  arancel: { tipo: 'a-la-gorra', notas: '' },
  inscripcion: { requiere: false, via: null, destino: '', cupo: null, cierra: null },
  material: { tiene: false, items: [] },
  difusion: { arrobar: [], notas: '' },
  tags: ['narrativa'],
  esCiclo: true,
  sesiones: [sesion()],
  createdAt: ts('2026-08-01T12:00:00Z'),
  createdBy: 'uid_dueno',
  updatedAt: ts('2026-08-10T12:00:00Z'),
  updatedBy: 'uid_dueno',
  ...over,
});

/** Lo que hace el panel al guardar: pisa el contenido y sella la auditoría. */
const editado = (base: Record<string, unknown>, cambios: Record<string, unknown>) => ({
  ...base,
  ...cambios,
  updatedAt: ts('2026-08-21T18:00:00Z'),
  updatedBy: 'uid_dueno',
});

// ─────────────────────────────────────────────────────────────────
// El caso que rompe todo
// ─────────────────────────────────────────────────────────────────

describe('huboCambioDeContenido — el write-back de syncCalendar (§7.1)', () => {
  it('escribir calendarEventId NO genera una versión', () => {
    const antes = actividad();
    // Exactamente lo que escribe `syncCalendar` al terminar de sincronizar.
    const despues = actividad({ sesiones: [sesion({ calendarEventId: 'evt_1' })] });
    expect(huboCambioDeContenido(antes, despues)).toBe(false);
  });

  it('el write-back de las ocho sesiones de un ciclo tampoco', () => {
    const ocho = Array.from({ length: 8 }, (_, i) => sesion({ id: `ses_${i}` }));
    const conIds = ocho.map((s, i) => ({ ...s, calendarEventId: `evt_${i}` }));
    expect(huboCambioDeContenido(actividad({ sesiones: ocho }), actividad({ sesiones: conIds }))).toBe(
      false,
    );
  });

  it('limpiar el calendarEventId al borrar el evento tampoco', () => {
    const antes = actividad({ sesiones: [sesion({ calendarEventId: 'evt_1' })] });
    const despues = actividad({ sesiones: [sesion({ calendarEventId: null })] });
    expect(huboCambioDeContenido(antes, despues)).toBe(false);
  });

  it('una publicación completa deja UNA versión, no dos', () => {
    // 1. La persona publica: cambia `estado`. Eso sí es una versión.
    const borrador = actividad({ estado: 'borrador' });
    const publicado = editado(borrador, { estado: 'publicado' });
    expect(huboCambioDeContenido(borrador, publicado)).toBe(true);

    // 2. syncCalendar escribe los ids de vuelta. Eso NO es otra versión.
    const conIds = { ...publicado, sesiones: [sesion({ calendarEventId: 'evt_1' })] };
    expect(huboCambioDeContenido(publicado, conIds)).toBe(false);
  });

  it('guardar el formulario sin cambiar nada no deja una versión duplicada', () => {
    // updatedAt/updatedBy cambian en toda escritura del panel: si contaran,
    // cada "guardar" por las dudas dejaría una copia idéntica a la anterior.
    const antes = actividad();
    expect(huboCambioDeContenido(antes, editado(antes, {}))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Lo que sí hay que poder recuperar
// ─────────────────────────────────────────────────────────────────

describe('huboCambioDeContenido — lo que sí guarda versión (§12)', () => {
  it('pisar la descripción larga guarda versión: es EL caso del §12', () => {
    const antes = actividad();
    const despues = editado(antes, { descripcion: 'ups' });
    expect(huboCambioDeContenido(antes, despues)).toBe(true);
  });

  it('vaciar la descripción también', () => {
    const antes = actividad();
    expect(huboCambioDeContenido(antes, editado(antes, { descripcion: '' }))).toBe(true);
  });

  it('cambiar la sede guarda versión', () => {
    const antes = actividad();
    const despues = editado(antes, { sede: { nombre: 'Otra', direccion: 'Corrientes 1234' } });
    expect(huboCambioDeContenido(antes, despues)).toBe(true);
  });

  it('correr la fecha de un encuentro guarda versión', () => {
    const antes = actividad();
    const corrida = [sesion({ inicio: ts('2026-09-17T22:00:00Z') })];
    expect(huboCambioDeContenido(antes, editado(antes, { sesiones: corrida }))).toBe(true);
  });

  it('borrar un encuentro guarda versión', () => {
    const dos = [sesion({ id: 'ses_a' }), sesion({ id: 'ses_b' })];
    const antes = actividad({ sesiones: dos });
    expect(huboCambioDeContenido(antes, editado(antes, { sesiones: [dos[0]!] }))).toBe(true);
  });

  it('cambiar el tema de un encuentro guarda versión', () => {
    const antes = actividad({ sesiones: [sesion({ tema: 'Cap. 1-4' })] });
    const despues = editado(antes, { sesiones: [sesion({ tema: 'Cap. 5-8' })] });
    expect(huboCambioDeContenido(antes, despues)).toBe(true);
  });

  it('editar la difusión interna guarda versión, aunque no salga al calendario', () => {
    // Diferencia deliberada con la guarda del sync (D-07): ahí `difusion` no
    // altera el evento y no dispara nada. Acá es texto que tipeó una persona,
    // así que pisarlo tiene que ser recuperable.
    const antes = actividad();
    const despues = editado(antes, { difusion: { arrobar: [], notas: '' } });
    expect(huboCambioDeContenido(actividad({ difusion: { arrobar: ['@x'], notas: 'prensa' } }), despues)).toBe(
      true,
    );
    expect(huboCambioDeContenido(antes, editado(antes, { difusion: { arrobar: ['@x'], notas: '' } }))).toBe(
      true,
    );
  });

  it('editar el link privado de la reunión guarda versión', () => {
    const antes = actividad({ online: { plataforma: 'zoom', url: 'https://a', urlPublica: false } });
    const despues = editado(antes, { online: { plataforma: 'zoom', url: 'https://b', urlPublica: false } });
    expect(huboCambioDeContenido(antes, despues)).toBe(true);
  });

  it('un campo del modelo que todavía no existe entra solo, sin tocar nada', () => {
    // El criterio NO es una lista blanca de campos recuperables: si lo fuera,
    // agregar `libroPresentado` (DEC-1) y olvidarse de sumarlo a la lista haría
    // que pisarlo no guardara versión, en silencio. Es el error que no se puede
    // cometer acá.
    const antes = actividad({ libroPresentado: { obra: 'Pedro Páramo', autor: 'Rulfo' } });
    const despues = editado(antes, { libroPresentado: { obra: 'Otra', autor: 'Rulfo' } });
    expect(huboCambioDeContenido(antes, despues)).toBe(true);
    expect(camposCambiados(antes, despues)).toEqual(['libroPresentado']);
  });
});

// ─────────────────────────────────────────────────────────────────
// Forma canónica
// ─────────────────────────────────────────────────────────────────

describe('contenidoEditable — comparación estable', () => {
  it('el orden de las claves no cuenta como una edición', () => {
    // JSON.stringify respeta el orden de inserción y nada garantiza que dos
    // lecturas de Firestore entreguen los campos en el mismo orden.
    const a = { titulo: 'x', descripcion: 'y', estado: 'publicado' };
    const b = { estado: 'publicado', titulo: 'x', descripcion: 'y' };
    expect(huboCambioDeContenido(a, b)).toBe(false);
  });

  it('el orden de las sesiones sí cuenta: lo cambió una persona', () => {
    const a = actividad({ sesiones: [sesion({ id: 'ses_a' }), sesion({ id: 'ses_b' })] });
    const b = actividad({ sesiones: [sesion({ id: 'ses_b' }), sesion({ id: 'ses_a' })] });
    expect(huboCambioDeContenido(a, b)).toBe(true);
  });

  it('dos Timestamp del mismo instante son el mismo valor', () => {
    const a = actividad({ sesiones: [sesion({ inicio: ts('2026-09-03T22:00:00Z') })] });
    const b = actividad({ sesiones: [sesion({ inicio: ts('2026-09-03T22:00:00.000Z') })] });
    expect(huboCambioDeContenido(a, b)).toBe(false);
  });

  it('un instante distinto sí es un cambio', () => {
    const a = actividad({ sesiones: [sesion({ inicio: ts('2026-09-03T22:00:00Z') })] });
    const b = actividad({ sesiones: [sesion({ inicio: ts('2026-09-03T22:00:01Z') })] });
    expect(huboCambioDeContenido(a, b)).toBe(true);
  });

  it('saca updatedAt/updatedBy y calendarEventId, y deja el resto', () => {
    const limpio = contenidoEditable(actividad({ sesiones: [sesion({ calendarEventId: 'evt_1' })] }));
    expect(limpio).not.toHaveProperty('updatedAt');
    expect(limpio).not.toHaveProperty('updatedBy');
    expect(limpio.sesiones[0]).not.toHaveProperty('calendarEventId');
    // createdAt/createdBy no molestan: no cambian nunca.
    expect(limpio).toHaveProperty('createdBy');
    expect(limpio.titulo).toBe('Club de lectura');
  });

  it('un campo ausente y un campo en null no se unifican', () => {
    // Unificarlos suprimiría versiones, y de los dos errores posibles ese es el
    // caro: se pierde el dato.
    expect(huboCambioDeContenido({ titulo: 'x' }, { titulo: 'x', imagenUrl: null })).toBe(true);
  });

  it('tolera una actividad sin sesiones', () => {
    expect(huboCambioDeContenido(actividad({ sesiones: undefined }), actividad({ sesiones: undefined }))).toBe(
      false,
    );
  });
});

describe('camposCambiados — para elegir la versión desde la consola', () => {
  it('devuelve solo lo que cambió, ordenado', () => {
    const antes = actividad();
    const despues = editado(antes, { titulo: 'Otro título', descripcion: 'Otra' });
    expect(camposCambiados(antes, despues)).toEqual(['descripcion', 'titulo']);
  });

  it('no incluye los campos que escribe la máquina', () => {
    const antes = actividad();
    const despues = {
      ...editado(antes, { titulo: 'Otro' }),
      sesiones: [sesion({ calendarEventId: 'evt_1' })],
    };
    expect(camposCambiados(antes, despues)).toEqual(['titulo']);
  });

  it('vacío cuando no cambió nada recuperable', () => {
    const antes = actividad();
    expect(camposCambiados(antes, editado(antes, {}))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────
// Id del documento
// ─────────────────────────────────────────────────────────────────

describe('idDeVersion — dos escrituras en el mismo milisegundo', () => {
  it('no se pisan: el id lleva también el id del evento', () => {
    // El §12 propone el timestamp solo. Dos disparos en el mismo milisegundo
    // colisionarían y el segundo pisaría al primero, perdiendo una versión —
    // justo lo que esta feature viene a evitar.
    const a = idDeVersion('2026-08-21T18:00:00.123Z', 'evento-a');
    const b = idDeVersion('2026-08-21T18:00:00.123Z', 'evento-b');
    expect(a).not.toBe(b);
  });

  it('el mismo evento da el mismo id: un reintento no duplica la versión', () => {
    // Cloud Functions v2 entrega al menos una vez.
    const a = idDeVersion('2026-08-21T18:00:00.123Z', 'evento-a');
    const b = idDeVersion('2026-08-21T18:00:00.123Z', 'evento-a');
    expect(a).toBe(b);
  });

  it('los ids ordenan cronológicamente como strings', () => {
    // De esto depende la poda: se ordena por id del documento.
    const ids = [
      idDeVersion('2026-08-21T18:00:00.123Z', 'z'),
      idDeVersion('2026-01-02T03:04:05.006Z', 'a'),
      idDeVersion('2026-08-21T18:00:00.124Z', 'a'),
    ];
    expect([...ids].sort()).toEqual([ids[1], ids[0], ids[2]]);
  });

  it('el id es legible en la consola de Firestore y no lleva caracteres raros', () => {
    // Mientras no haya UI (B-40), la consola es la única forma de leer esto.
    const id = idDeVersion('2026-08-21T18:00:00.123Z', 'abc/def.123');
    expect(id).toMatch(/^2026-08-21T18-00-00-123Z_/);
    expect(id).not.toContain('/');
    expect(id).not.toContain(':');
  });

  it('sin id de evento sigue dando un id válido', () => {
    expect(idDeVersion('2026-08-21T18:00:00.123Z', undefined)).toBe('2026-08-21T18-00-00-123Z');
  });
});

// ─────────────────────────────────────────────────────────────────
// Retención
// ─────────────────────────────────────────────────────────────────

describe('versionesAborrar — retención por cantidad', () => {
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => idDeVersion(Date.UTC(2026, 0, 1, 0, 0, i), `e${i}`));

  it('debajo del tope no borra nada', () => {
    expect(versionesAborrar(ids(MAX_VERSIONES), MAX_VERSIONES)).toEqual([]);
  });

  it('pasado el tope borra las más viejas y deja exactamente el tope', () => {
    const todas = ids(MAX_VERSIONES + 3);
    const aBorrar = versionesAborrar(todas, MAX_VERSIONES);
    expect(aBorrar).toEqual(todas.slice(0, 3));
    expect(todas.length - aBorrar.length).toBe(MAX_VERSIONES);
  });

  it('en régimen borra una sola por edición', () => {
    expect(versionesAborrar(ids(MAX_VERSIONES + 1), MAX_VERSIONES)).toHaveLength(1);
  });

  it('conserva siempre las más nuevas: son las que se piden de vuelta', () => {
    const todas = ids(30);
    const aBorrar = new Set(versionesAborrar(todas, 5));
    expect(todas.slice(-5).some((id) => aBorrar.has(id))).toBe(false);
  });

  it('no depende de que los ids lleguen ordenados', () => {
    const todas = ids(23);
    const desordenadas = [...todas].reverse();
    expect(versionesAborrar(desordenadas, MAX_VERSIONES)).toEqual(todas.slice(0, 3));
  });

  it('bajar el tope recorta de golpe', () => {
    const todas = ids(50);
    expect(versionesAborrar(todas, 10)).toHaveLength(40);
  });

  it('el tope no cambia sin que un test lo diga', () => {
    // La retención es una decisión explícita, no un número que se toca de paso.
    expect(MAX_VERSIONES).toBe(20);
  });
});
