import { describe, expect, it } from 'vitest';
import {
  CUANDOS,
  ETIQUETA_CUANDO,
  ETIQUETA_ESTADO,
  ETIQUETA_MODALIDAD,
  ETIQUETA_ORDEN,
  FILTROS_VACIOS,
  ORDENES,
  ORDEN_POR_DEFECTO,
  cantidadDeFiltros,
  filtrar,
  hayFiltros,
  legible,
  listaVisible,
  opcionesPresentes,
  ordenar,
  proximoEncuentro,
  tieneFuturo,
} from '@/lib/filtrosActividades';
import { buildSearchText } from '@/lib/normalize';
// Se importa el otro módulo a propósito: el test de abajo ata los dos criterios
// de "¿ya pasó?", que es lo que divergió en el H1.
import { encuentrosDe, yaPaso } from '@/lib/calendarioPanel';
import { ESTADOS, MODALIDADES, type ActividadConId, type Sesion } from '@/types/actividad';
import { ts } from './fixtures/tiempo';



const sesion = (inicio: string, over: Partial<Sesion> = {}): Sesion =>
  ({
    id: `ses_${inicio}`,
    tema: null,
    lectura: null,
    cancelada: false,
    calendarEventId: null,
    ...over,
    inicio: ts(inicio),
    // Dos horas de duración, no cero. Con `fin === inicio` los criterios "ya
    // pasó por el inicio" y "ya pasó por el fin" son idénticos, así que el
    // fixture volvía indetectable la divergencia del H1 — el patrón de B-84:
    // un test que pasa porque su fixture no ejercita el caso real.
    fin: over.fin ?? ts(inicio.replace(/T(\d{2})/, (_, h) => `T${String(Number(h) + 2).padStart(2, '0')}`)),
  }) as unknown as Sesion;

/** Solo el barrio, que es lo único de la sede que mira el filtro. */
const sedeEn = (barrio: string) =>
  ({ nombre: '', direccion: '', barrio, ciudad: '', indicaciones: '', geo: null });

const acto = (over: Partial<ActividadConId> & { id: string }): ActividadConId =>
  ({
    titulo: over.id,
    tipo: 'taller',
    estado: 'publicado',
    modalidad: 'presencial',
    sede: null,
    sesiones: [],
    updatedAt: ts('2026-08-01T12:00:00Z'),
    searchText: buildSearchText({ titulo: over.titulo ?? over.id }),
    ...over,
  }) as unknown as ActividadConId;

const ahora = new Date('2026-09-05T12:00:00Z');

// ─────────────────────────────────────────────────────────────────

describe('el próximo encuentro', () => {
  it('es el primero que todavía no arrancó', () => {
    const a = acto({
      id: 'a',
      sesiones: [
        sesion('2026-09-01T22:00:00Z'),
        sesion('2026-09-20T22:00:00Z'),
        sesion('2026-09-10T22:00:00Z'),
      ],
    });
    expect(proximoEncuentro(a, ahora)?.toISOString()).toBe('2026-09-10T22:00:00.000Z');
  });

  it('los cancelados no cuentan: no van a pasar', () => {
    const a = acto({
      id: 'a',
      sesiones: [
        sesion('2026-09-10T22:00:00Z', { cancelada: true }),
        sesion('2026-09-20T22:00:00Z'),
      ],
    });
    expect(proximoEncuentro(a, ahora)?.toISOString()).toBe('2026-09-20T22:00:00.000Z');
  });

  it('sin nada por venir es null, y eso incluye no tener encuentros', () => {
    expect(proximoEncuentro(acto({ id: 'a', sesiones: [sesion('2026-08-01T22:00:00Z')] }), ahora))
      .toBeNull();
    expect(proximoEncuentro(acto({ id: 'a' }), ahora)).toBeNull();
    expect(tieneFuturo(acto({ id: 'a' }), ahora)).toBe(false);
  });
});

describe('filtrar sobre lo que ya está en memoria', () => {
  const datos = [
    acto({
      id: 'club',
      titulo: 'Club de lectura de Crónica',
      tipo: 'club-lectura',
      estado: 'borrador',
      modalidad: 'virtual',
      sesiones: [sesion('2026-09-10T22:00:00Z')],
    }),
    acto({
      id: 'taller',
      titulo: 'Taller de poesía',
      tipo: 'taller',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('villa-crespo'),
      sesiones: [sesion('2026-08-10T22:00:00Z')],
    }),
    acto({
      id: 'charla',
      titulo: 'Charla con la autora',
      tipo: 'charla',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('palermo'),
      sesiones: [sesion('2026-10-10T22:00:00Z')],
    }),
  ] as ActividadConId[];

  const ids = (as: ActividadConId[]) => as.map((a) => a.id);
  const con = (over: Partial<typeof FILTROS_VACIOS>) => ({ ...FILTROS_VACIOS, ...over });

  it('sin filtros no saca nada', () => {
    expect(ids(filtrar(datos, FILTROS_VACIOS, ahora))).toEqual(['club', 'taller', 'charla']);
  });

  it('el texto ignora acentos y mayúsculas (§6)', () => {
    expect(ids(filtrar(datos, con({ texto: 'CRONICA' }), ahora))).toEqual(['club']);
    expect(ids(filtrar(datos, con({ texto: 'poesia' }), ahora))).toEqual(['taller']);
  });

  it('filtra por estado, tipo y modalidad', () => {
    expect(ids(filtrar(datos, con({ estado: 'borrador' }), ahora))).toEqual(['club']);
    expect(ids(filtrar(datos, con({ tipo: 'charla' }), ahora))).toEqual(['charla']);
    expect(ids(filtrar(datos, con({ modalidad: 'presencial' }), ahora))).toEqual([
      'taller',
      'charla',
    ]);
  });

  it('filtra por barrio, que se guarda como valor de la lista y no como texto', () => {
    expect(ids(filtrar(datos, con({ barrio: 'palermo' }), ahora))).toEqual(['charla']);
    // Una actividad sin sede no entra en ningún barrio.
    expect(ids(filtrar(datos, con({ barrio: 'villa-crespo' }), ahora))).toEqual(['taller']);
  });

  it('«con algo por venir» y su complemento parten el listado en dos', () => {
    expect(ids(filtrar(datos, con({ cuando: 'por-venir' }), ahora))).toEqual(['club', 'charla']);
    expect(ids(filtrar(datos, con({ cuando: 'sin-futuro' }), ahora))).toEqual(['taller']);
  });

  it('los filtros se cruzan entre sí', () => {
    expect(
      ids(filtrar(datos, con({ cuando: 'por-venir', estado: 'publicado' }), ahora)),
    ).toEqual(['charla']);
    expect(ids(filtrar(datos, con({ estado: 'publicado', modalidad: 'virtual' }), ahora))).toEqual(
      [],
    );
  });

  it('cuenta los filtros puestos sin contar el buscador', () => {
    expect(cantidadDeFiltros(FILTROS_VACIOS)).toBe(0);
    expect(cantidadDeFiltros(con({ texto: 'algo' }))).toBe(0);
    expect(cantidadDeFiltros(con({ estado: 'borrador', cuando: 'por-venir' }))).toBe(2);
    // Para el mensaje del listado vacío sí cuenta el texto.
    expect(hayFiltros(con({ texto: 'algo' }))).toBe(true);
    expect(hayFiltros(FILTROS_VACIOS)).toBe(false);
  });
});

describe('ordenar', () => {
  const viejaTocadaAyer = acto({
    id: 'vieja',
    titulo: 'Zeta pasada',
    sesiones: [sesion('2026-08-01T22:00:00Z')],
    updatedAt: ts('2026-09-04T12:00:00Z'),
  });
  const proxima = acto({
    id: 'proxima',
    titulo: 'Mañana',
    sesiones: [sesion('2026-09-06T22:00:00Z')],
    updatedAt: ts('2026-01-01T12:00:00Z'),
  });
  const lejana = acto({
    id: 'lejana',
    titulo: 'En dos meses',
    sesiones: [sesion('2026-11-06T22:00:00Z')],
    updatedAt: ts('2026-02-01T12:00:00Z'),
  });
  const sinFechas = acto({ id: 'sin-fechas', titulo: 'Alfa sin fechas' });

  const datos = [viejaTocadaAyer, proxima, lejana, sinFechas];
  const ids = (as: ActividadConId[]) => as.map((a) => a.id);

  it('por defecto arriba está lo que se viene, no lo que se tocó (B-96)', () => {
    // Un borrador cuyo primer encuentro es en cuatro días tiene que verse; con
    // `updatedAt desc` quedaba al fondo si hacía rato que nadie lo abría.
    expect(ids(ordenar(datos, 'proxima', ahora))).toEqual([
      'proxima',
      'lejana',
      'vieja',
      'sin-fechas',
    ]);
    expect(ORDEN_POR_DEFECTO).toBe('proxima');
  });

  it('lo que no tiene nada por venir va al final por última modificación', () => {
    // Y no intercalado por su fecha vieja: el fondo del listado sería un
    // archivo histórico y lo recién tocado quedaría perdido en el medio.
    const cola = ids(ordenar(datos, 'proxima', ahora)).slice(2);
    expect(cola).toEqual(['vieja', 'sin-fechas']);
  });

  it('«última modificación» conserva el orden de antes', () => {
    expect(ids(ordenar(datos, 'reciente', ahora))).toEqual([
      'vieja',
      'sin-fechas',
      'lejana',
      'proxima',
    ]);
  });

  it('por título ordena en castellano', () => {
    expect(ids(ordenar(datos, 'titulo', ahora))).toEqual([
      'sin-fechas',
      'lejana',
      'proxima',
      'vieja',
    ]);
  });

  it('no muta el array que recibe', () => {
    const original = [...datos];
    ordenar(datos, 'titulo', ahora);
    expect(datos).toEqual(original);
  });

  it('cada orden y cada «cuándo» tienen su etiqueta', () => {
    for (const orden of ORDENES) expect(ETIQUETA_ORDEN[orden].length).toBeGreaterThan(5);
    for (const cuando of CUANDOS) expect(ETIQUETA_CUANDO[cuando].length).toBeGreaterThan(5);
  });

  it('filtrar y ordenar de una vez es lo mismo que hacerlo en dos pasos', () => {
    const filtros = { ...FILTROS_VACIOS, cuando: 'por-venir' as const };
    expect(listaVisible(datos, filtros, 'proxima', ahora)).toEqual(
      ordenar(filtrar(datos, filtros, ahora), 'proxima', ahora),
    );
  });
});

describe('los desplegables muestran etiquetas, nunca el valor guardado (§4.1)', () => {
  it('todos los estados y modalidades tienen su etiqueta', () => {
    for (const estado of ESTADOS) expect(ETIQUETA_ESTADO[estado].length).toBeGreaterThan(5);
    for (const modalidad of MODALIDADES)
      expect(ETIQUETA_MODALIDAD[modalidad].length).toBeGreaterThan(5);
  });

  it('un valor de taxonomía sin etiqueta cargada se legibiliza, no se muestra crudo', () => {
    expect(legible('villa-crespo')).toBe('Villa Crespo');
    expect(legible('club-lectura')).toBe('Club Lectura');
    expect(legible('')).toBe('');
  });
});

describe('los desplegables ofrecen lo que existe en los datos', () => {
  const datos = [
    acto({ id: 'a', tipo: 'taller', estado: 'borrador', modalidad: 'virtual' }),
    acto({
      id: 'b',
      tipo: 'taller',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('villa-crespo'),
    }),
    acto({
      id: 'c',
      tipo: 'charla',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('almagro'),
    }),
  ] as ActividadConId[];

  it('no repite valores y el orden no depende de cómo lleguen los datos', () => {
    // La versión anterior de este test afirmaba el orden de LLEGADA
    // (`['taller','charla']`, `['borrador','publicado']`), y con eso cementaba
    // el problema en vez de frenarlo: `listarActividades()` no garantiza un
    // orden estable, así que el desplegable cambiaba solo entre sesiones.
    //
    // Ahora cada eje tiene el orden que le corresponde: los enums cerrados por
    // su declaración, las taxonomías abiertas alfabéticas.
    const opciones = opcionesPresentes(datos);
    expect(opciones.tipos).toEqual(['charla', 'taller']);
    expect(opciones.estados).toEqual(['borrador', 'publicado']);
    expect(opciones.modalidades).toEqual(['presencial', 'virtual']);
    expect(opciones.barrios).toEqual(['almagro', 'villa-crespo']);
  });

  it('el orden es el mismo aunque los datos lleguen al revés', () => {
    // Es la propiedad que importa, y la que el test viejo no podía ver.
    const alRevés = [...datos].reverse();
    expect(opcionesPresentes(alRevés)).toEqual(opcionesPresentes(datos));
  });

  it('los estados siguen el ciclo de vida, no el alfabeto', () => {
    // «borrador» antes que «publicado» es el orden con el que se piensa el
    // estado; alfabéticamente sería «borrador, cancelado, pendiente, publicado».
    const todos = ESTADOS.map((estado, i) => acto({ id: `a${i}`, estado }));
    expect(opcionesPresentes(todos).estados).toEqual([...ESTADOS]);
  });

  it('no ofrece un barrio que ninguna actividad usa', () => {
    // Ofrecerlo sería ofrecer un filtro que siempre devuelve cero, y la lista de
    // barrios crece sola con el campo «Otro».
    expect(opcionesPresentes(datos).barrios).not.toContain('palermo');
  });

  it('sin actividades no ofrece nada', () => {
    expect(opcionesPresentes([])).toEqual({
      estados: [],
      tipos: [],
      modalidades: [],
      barrios: [],
    });
  });
});

describe('un encuentro en curso todavía cuenta como por venir (H1)', () => {
  /**
   * El bug que esto fija: el listado descartaba por `inicio` y el calendario por
   * `fin`, así que un taller de 19 a 21 desaparecía del listado a las 19:01 —
   * justo durante las dos horas en que alguien podría necesitar abrirlo.
   *
   * El fixture tiene que tener duración real: con `fin === inicio` los dos
   * criterios son el mismo y el test no prueba nada (patrón B-84).
   */
  const enCurso = acto({
    id: 'en-curso',
    sesiones: [sesion('2026-09-03T19:00:00Z', { fin: ts('2026-09-03T21:00:00Z') })],
  });
  const durante = new Date('2026-09-03T19:30:00Z');

  it('lo cuenta como próximo encuentro', () => {
    expect(proximoEncuentro(enCurso, durante)).not.toBeNull();
  });

  it('devuelve el inicio, no el fin — es lo que se muestra en «Próximo»', () => {
    expect(proximoEncuentro(enCurso, durante)?.toISOString()).toBe('2026-09-03T19:00:00.000Z');
  });

  it('tiene futuro, así que el filtro «con algo por venir» lo agarra', () => {
    expect(tieneFuturo(enCurso, durante)).toBe(true);
  });

  it('una vez terminado, ya no', () => {
    expect(tieneFuturo(enCurso, new Date('2026-09-03T21:01:00Z'))).toBe(false);
  });

  it('coincide con el criterio del calendario para el mismo encuentro', () => {
    // La divergencia entre los dos módulos es lo que produjo el bug: este test
    // los ata, así que separarlos otra vez pone algo en rojo.
    const [e] = encuentrosDe([enCurso]);
    expect(yaPaso(e!, durante)).toBe(false);
    expect(tieneFuturo(enCurso, durante)).toBe(true);
  });
});
