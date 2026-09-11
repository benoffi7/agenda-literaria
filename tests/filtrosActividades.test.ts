import { describe, expect, it } from 'vitest';
import {
  CUANDOS,
  DESTACADOS,
  ETIQUETA_DESTACADO,
  chipsDeTags,
  conTagAlternada,
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
      arancel: { tipo: 'arancelado', notas: '' },
      sesiones: [sesion('2026-09-10T22:00:00Z')],
    }),
    acto({
      id: 'taller',
      titulo: 'Taller de poesía',
      tipo: 'taller',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('villa-crespo'),
      arancel: { tipo: 'gratis', notas: '' },
      sesiones: [sesion('2026-08-10T22:00:00Z')],
    }),
    acto({
      id: 'charla',
      titulo: 'Charla con la autora',
      tipo: 'charla',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('palermo'),
      arancel: { tipo: 'a-la-gorra', notas: '' },
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

  it('filtra por arancel, que D-74 había descartado y D-152 repone', () => {
    /*
     * B-272 — «¿qué tengo publicado que sea gratis?» es de repaso, no de
     * búsqueda: el buscador de texto no la contesta porque el arancel no está en
     * el `searchText` (§6, que lleva título, descripción, sede, barrio,
     * organizador y tallerista).
     *
     * MUTACIÓN PROBADA: sacar la línea de `arancel` de `filtrar` devuelve las
     * tres y hace fallar este caso.
     */
    expect(ids(filtrar(datos, con({ arancel: 'gratis' }), ahora))).toEqual(['taller']);
    expect(ids(filtrar(datos, con({ arancel: 'a-la-gorra' }), ahora))).toEqual(['charla']);
    expect(ids(filtrar(datos, con({ arancel: 'arancelado' }), ahora))).toEqual(['club']);
  });

  it('una actividad sin arancel cargado no entra en ningún arancel', () => {
    /*
     * El default de lectura: los documentos anteriores al campo no tienen el
     * objeto `arancel`, y el filtro tiene que **dejarlos afuera** de cualquier
     * valor concreto sin romperse. Sin el `?? ''` esto tira sobre `undefined`.
     *
     * MUTACIÓN PROBADA: cambiar `(a.arancel?.tipo ?? '')` por `a.arancel.tipo`
     * hace fallar este caso con un TypeError.
     */
    const sinArancel = [...datos, acto({ id: 'viejo', arancel: undefined })];
    expect(ids(filtrar(sinArancel, con({ arancel: 'gratis' }), ahora))).toEqual(['taller']);
    // Y sigue apareciendo cuando no se filtra por arancel.
    expect(ids(filtrar(sinArancel, FILTROS_VACIOS, ahora))).toContain('viejo');
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
    // B-272 — el arancel cuenta como los otros cinco: un filtro puesto y
    // olvidado detrás del panel colapsado no puede explicar un listado vacío.
    expect(cantidadDeFiltros(con({ arancel: 'gratis' }))).toBe(1);
    expect(cantidadDeFiltros(con({ arancel: 'gratis', tipo: 'taller' }))).toBe(2);
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
    acto({
      id: 'a',
      tipo: 'taller',
      estado: 'borrador',
      modalidad: 'virtual',
      arancel: { tipo: 'arancelado', notas: '' },
    }),
    acto({
      id: 'b',
      tipo: 'taller',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('villa-crespo'),
      arancel: { tipo: 'gratis', notas: '' },
    }),
    acto({
      id: 'c',
      tipo: 'charla',
      estado: 'publicado',
      modalidad: 'presencial',
      sede: sedeEn('almagro'),
      arancel: { tipo: 'a-la-gorra', notas: '' },
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

  it('el arancel ofrece primero lo que no se paga, como los chips del sitio', () => {
    /*
     * B-272 · D-152 — el mismo comparador que el sitio (`primeroSinCosto`), que es
     * lo que fija **qué va arriba**. El desempate adentro de cada grupo sí es
     * distinto y a propósito: el sitio ordena por cantidad de actividades y el
     * panel alfabético, como sus otros cuatro desplegables. Lo que no puede pasar
     * es que «Arancelado» quede arriba de «Gratis» acá y abajo allá, que es lo que
     * daba el alfabético a secas.
     *
     * MUTACIÓN PROBADA: sacar `primeroSinCosto(a, b) ||` deja
     * `['a-la-gorra', 'arancelado', 'gratis']` y hace fallar este caso.
     */
    expect(opcionesPresentes(datos).aranceles).toEqual(['a-la-gorra', 'gratis', 'arancelado']);
  });

  it('no ofrece un arancel que ninguna actividad usa', () => {
    // Misma regla que el barrio: un desplegable con valores que dan cero es un
    // callejón. `/opciones/arancel` puede tener «Con beca parcial» sin que
    // ninguna actividad lo use todavía.
    expect(opcionesPresentes(datos).aranceles).not.toContain('con-beca-parcial');
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
    /*
     * El `toEqual` es exhaustivo a propósito: un eje nuevo que se agregue a
     * `OpcionesPresentes` pone este caso en rojo, y ahí es donde se decide si
     * también hay que ofrecerlo vacío. Lo cobró B-274 con `tags`/`hayDestacadas`.
     */
    expect(opcionesPresentes([])).toEqual({
      estados: [],
      tipos: [],
      aranceles: [],
      modalidades: [],
      barrios: [],
      tags: [],
      hayDestacadas: false,
      // B-888 — el eje «quién la cargó». Entra a esta lista por lo mismo que
      // `tags`/`hayDestacadas`: sin actividades hay que ofrecerlo vacío.
      autores: [],
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

// ─────────────────────────────────────────────────────────────────
// B-274 · los dos descartes de D-74 que el dueño repuso
// ─────────────────────────────────────────────────────────────────

describe('destacada: los tres estados, y el que incluye a los documentos viejos — B-274', () => {
  const puestas = [
    acto({ id: 'destacada', destacado: true }),
    acto({ id: 'comun', destacado: false }),
    // **El caso que importa:** `destacado` es opcional y los documentos
    // anteriores al campo no lo tienen. Sin el default, `undefined` se caía de
    // los dos filtros y no había forma de encontrarla con ninguno.
    acto({ id: 'vieja' }),
  ];

  const ids = (destacado: (typeof DESTACADOS)[number]) =>
    filtrar(puestas, { ...FILTROS_VACIOS, destacado }, ahora).map((a) => a.id);

  it('«cualquiera» no filtra, «solo destacadas» deja una, y «solo no destacadas» deja las otras dos', () => {
    /*
     * MUTACIÓN PROBADA: cambiar el `!a.destacado` por `a.destacado === false`
     * deja «solo no destacadas» sin la vieja y este caso en rojo.
     */
    expect(ids('')).toEqual(['destacada', 'comun', 'vieja']);
    expect(ids('si')).toEqual(['destacada']);
    expect(ids('no')).toEqual(['comun', 'vieja']);
  });

  it('los tres valores se reparten el total: ninguna actividad queda sin filtro que la encuentre', () => {
    /*
     * La propiedad, y no los tres casos de arriba: `si` y `no` tienen que
     * **partir** el universo. Es lo que garantiza que ningún documento —viejo,
     * nuevo, o con el campo puesto en `null` por una restauración— se vuelva
     * invisible para los dos.
     */
    expect(ids('si').length + ids('no').length).toBe(puestas.length);
    expect([...ids('si'), ...ids('no')].sort()).toEqual([...ids('')].sort());
  });

  it('el desplegable solo se ofrece si hay alguna destacada', () => {
    // Mismo criterio que el barrio y el arancel: sin ninguna, los tres valores
    // contestan lo mismo y el control es ruido.
    expect(opcionesPresentes(puestas).hayDestacadas).toBe(true);
    expect(opcionesPresentes([acto({ id: 'sola' })]).hayDestacadas).toBe(false);
  });

  it('cada valor tiene su etiqueta, y las tres son distintas', () => {
    /*
     * El aserto original decía «ninguna etiqueta contiene su valor guardado» y era
     * una mala idea de este test, no del código: «Solo **no** destacadas» contiene
     * el `'no'` porque en castellano se dice así. Lo que hay que exigir es que las
     * tres existan y digan cosas distintas — el modo de falla real es un
     * copy-paste que deje dos opciones con el mismo texto.
     */
    const etiquetas = DESTACADOS.map((d) => ETIQUETA_DESTACADO[d]);
    for (const [i, e] of etiquetas.entries()) {
      expect(e, `falta la etiqueta de «${DESTACADOS[i]}»`).toBeTruthy();
    }
    expect(new Set(etiquetas).size, 'dos opciones dicen lo mismo').toBe(DESTACADOS.length);
  });
});

describe('etiquetas: un eje multivaluado que suma con «o» — B-274', () => {
  const conTags = [
    acto({ id: 'a', tags: ['poesia', 'principiantes'] }),
    acto({ id: 'b', tags: ['poesia'] }),
    acto({ id: 'c', tags: ['narrativa'] }),
    acto({ id: 'sin' }),
  ];

  const ids = (tags: string[]) =>
    filtrar(conTags, { ...FILTROS_VACIOS, tags }, ahora).map((a) => a.id);

  it('sin etiquetas no filtra; con una deja las que la tienen; con dos, la unión', () => {
    /*
     * **La segunda etiqueta ensancha, no recorta**, y ese es el contrato de un
     * eje multivaluado: es lo que hace que el número de cada chip sirva para
     * elegir la siguiente.
     *
     * MUTACIÓN PROBADA: cambiar el `some` por un `every` deja el caso de dos
     * etiquetas con una sola actividad y este aserto en rojo.
     */
    expect(ids([])).toHaveLength(4);
    expect(ids(['poesia'])).toEqual(['a', 'b']);
    expect(ids(['narrativa'])).toEqual(['c']);
    expect(ids(['poesia', 'narrativa'])).toEqual(['a', 'b', 'c']);
  });

  it('una etiqueta que no tiene nadie deja el listado vacío, y no lo rompe', () => {
    expect(ids(['inexistente'])).toEqual([]);
  });

  it('cuenta como UN filtro, no como una por etiqueta', () => {
    /*
     * El número del botón «Filtros» contesta «cuántas cosas están recortando el
     * listado». Adentro del eje las etiquetas se suman con «o», así que contarlas
     * de a una diría que hay **más** recorte cuando hay **menos**.
     */
    expect(cantidadDeFiltros({ ...FILTROS_VACIOS, tags: ['poesia'] })).toBe(1);
    expect(cantidadDeFiltros({ ...FILTROS_VACIOS, tags: ['poesia', 'narrativa'] })).toBe(1);
    // Y el eje de destacada sí es uno más, que es el contraste.
    expect(cantidadDeFiltros({ ...FILTROS_VACIOS, tags: ['poesia'], destacado: 'si' })).toBe(2);
    expect(hayFiltros({ ...FILTROS_VACIOS, tags: ['poesia'] })).toBe(true);
    expect(hayFiltros({ ...FILTROS_VACIOS, destacado: 'no' })).toBe(true);
  });

  it('alternar una etiqueta no muta los filtros que recibió', () => {
    const antes: typeof FILTROS_VACIOS = { ...FILTROS_VACIOS, tags: ['poesia'] };
    const conDos = conTagAlternada(antes, 'narrativa');
    expect(conDos.tags).toEqual(['poesia', 'narrativa']);
    expect(antes.tags).toEqual(['poesia']);
    // Y sacarla es la misma operación.
    expect(conTagAlternada(conDos, 'poesia').tags).toEqual(['narrativa']);
  });

  it('las etiquetas ofrecidas son las que existen en los datos, sin vacías', () => {
    expect(opcionesPresentes(conTags).tags).toEqual(['narrativa', 'poesia', 'principiantes']);
    // Una cadena vacía en el array no puede llegar a ser un chip sin nombre.
    expect(opcionesPresentes([acto({ id: 'x', tags: ['', 'poesia'] })]).tags).toEqual(['poesia']);
  });
});

describe('los chips de etiquetas cuentan como los del sitio — B-274', () => {
  /*
   * Las tres reglas son las de `chipsDe` (`lib/listadoPublico.ts`) y se verifican
   * acá **de nuevo** y no por parecido: son dos módulos, dos tipos de entrada y
   * dos juegos de filtros. Lo que se comparte es la forma del chip y el motivo de
   * cada regla, no el código.
   */
  const datos = [
    acto({ id: 'a', estado: 'publicado', tags: ['poesia'] }),
    acto({ id: 'b', estado: 'publicado', tags: ['poesia'] }),
    acto({ id: 'c', estado: 'borrador', tags: ['narrativa'] }),
  ];

  it('el número se cuenta con los demás filtros puestos y este eje no', () => {
    /*
     * La regla que hace posible sumar la segunda etiqueta: si el conteo se hiciera
     * con el propio eje puesto, elegir «poesía» dejaría «narrativa» en cero y no
     * habría cómo agregarla.
     *
     * MUTACIÓN PROBADA: sacarle el `tags: []` al `filtrar` de `chipsDeTags` deja
     * el segundo aserto en 0 y este caso en rojo.
     */
    const sinNada = chipsDeTags(datos, FILTROS_VACIOS, ahora);
    expect(sinNada.map((c) => [c.valor, c.cantidad])).toEqual([
      ['poesia', 2],
      ['narrativa', 1],
    ]);

    const conPoesia = chipsDeTags(datos, { ...FILTROS_VACIOS, tags: ['poesia'] }, ahora);
    expect(conPoesia.find((c) => c.valor === 'narrativa')?.cantidad).toBe(1);
    expect(conPoesia.find((c) => c.valor === 'poesia')?.elegido).toBe(true);
  });

  it('los demás filtros sí achican el número', () => {
    // Es la otra mitad de la regla 1: «los demás puestos» tiene que significar algo.
    const soloBorradores = chipsDeTags(datos, { ...FILTROS_VACIOS, estado: 'borrador' }, ahora);
    expect(soloBorradores.map((c) => c.valor)).toEqual(['narrativa']);
  });

  it('un chip en cero no se muestra, salvo que esté elegido', () => {
    /*
     * Ofrecer un filtro que devuelve una lista vacía es ofrecer un callejón. El
     * elegido se muestra igual —aunque quede en cero— porque si desapareciera no
     * habría cómo sacarlo, y el listado quedaría vacío sin explicación.
     */
    const cruzado = { ...FILTROS_VACIOS, estado: 'borrador' as const, tags: ['poesia'] };
    const chips = chipsDeTags(datos, cruzado, ahora);
    const poesia = chips.find((c) => c.valor === 'poesia');
    expect(poesia, 'el elegido desapareció y no habría cómo sacarlo').toBeTruthy();
    expect(poesia?.cantidad).toBe(0);
  });

  it('el orden es por cantidad y después alfabético', () => {
    const empatadas = [
      acto({ id: 'a', tags: ['zeta'] }),
      acto({ id: 'b', tags: ['alfa'] }),
      acto({ id: 'c', tags: ['mucha'] }),
      acto({ id: 'd', tags: ['mucha'] }),
    ];
    // Por frecuencia real (§4.3), con el desempate estable para que dos empatadas
    // no se intercambien entre renders.
    expect(chipsDeTags(empatadas, FILTROS_VACIOS, ahora).map((c) => c.valor)).toEqual([
      'mucha',
      'alfa',
      'zeta',
    ]);
  });

  it('cada chip lleva la etiqueta legible y no el slug', () => {
    const chips = chipsDeTags([acto({ id: 'a', tags: ['club-de-poesia'] })], FILTROS_VACIOS, ahora);
    expect(chips[0]?.label).toBe(legible('club-de-poesia'));
    expect(chips[0]?.label).not.toBe('club-de-poesia');
  });

  it('y si la etiqueta está curada en `/opciones/tags`, gana esa', () => {
    /*
     * **El hallazgo del `auditor-trampas`, y por qué importa más de lo que
     * parece.** `desSlug` capitaliza y separa por guiones: no restaura acentos ni
     * la ñ. Una etiqueta cargada como «Poesía» se guarda con el slug `poesia`
     * (§4.2), así que el respaldo dice «Poesia» — y el autocompletado del
     * formulario, la tarjeta y los chips del sitio dicen «Poesía», porque los tres
     * resuelven contra `/opciones/*`. Es el mismo dato con dos nombres en dos
     * pantallas que se miran juntas.
     *
     * El orden también depende de esto: el desempate es por `label`.
     */
    const datos = [acto({ id: 'a', tags: ['poesia'] })];
    expect(chipsDeTags(datos, FILTROS_VACIOS, ahora, { poesia: 'Poesía' })[0]?.label).toBe(
      'Poesía',
    );
    // Y sin las opciones cargadas todavía, el respaldo: el default es «no
    // llegaron», no «no hay».
    expect(chipsDeTags(datos, FILTROS_VACIOS, ahora)[0]?.label).toBe('Poesia');
  });
});

/**
 * **El eje «quién la cargó» — B-888**, el tercer descarte de D-74 que se da
 * vuelta.
 *
 * D-74 lo dejó afuera con un argumento que dejó de ser cierto: «es un uid, y el
 * §5.1 mantiene los identificadores afuera de todo lo que se muestre». Con
 * `/usuarios` (D-650) el panel tiene el **mail**, así que lo que se muestra es un
 * mail y el uid se queda del lado de adentro — que es lo que el §5.1 pedía.
 */
describe('filtrar por quién la cargó — B-888', () => {
  const YO = 'uid_propio';
  const OTRO = 'uid_otra';
  const deQuien = (id: string, createdBy?: string) =>
    ({ ...acto({ id }), createdBy }) as ActividadConId;

  const catalogo = () => [deQuien('a', YO), deQuien('b', OTRO), deQuien('c')];

  it('vacío no filtra nada', () => {
    expect(filtrar(catalogo(), FILTROS_VACIOS, ahora).map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('con un uid deja solo las de esa cuenta', () => {
    /*
     * MUTACIÓN PROBADA: sacarle a `filtrar` la línea de `filtros.autor` deja este
     * caso en rojo.
     */
    expect(
      filtrar(catalogo(), { ...FILTROS_VACIOS, autor: OTRO }, ahora).map((a) => a.id),
    ).toEqual(['b']);
  });

  it('las anteriores a `createdBy` no caen bajo ninguna cuenta', () => {
    /*
     * Con el `?? ''` del filtro, un documento sin autor declarado no pertenece a
     * nadie — que es lo mismo que `autoriaDe` contesta con `desconocida`, y lo
     * mismo que hacen los otros ejes con su default (arancel, barrio).
     */
    for (const uid of [YO, OTRO, '']) {
      const ids = filtrar(catalogo(), { ...FILTROS_VACIOS, autor: uid }, ahora).map((a) => a.id);
      if (uid) expect(ids, `«${uid}» se llevó la actividad sin autor`).not.toContain('c');
    }
  });

  it('cuenta como un filtro puesto, para el número del botón', () => {
    // Sin esto, el `(N)` del botón «Filtros» diría cero con el eje puesto y un
    // listado filtrado parecería vacío sin explicación.
    expect(cantidadDeFiltros({ ...FILTROS_VACIOS, autor: OTRO })).toBe(1);
    expect(hayFiltros({ ...FILTROS_VACIOS, autor: OTRO })).toBe(true);
  });

  it('y «Limpiar filtros» lo apaga: está en FILTROS_VACIOS', () => {
    expect(FILTROS_VACIOS.autor).toBe('');
  });

  it('`opcionesPresentes` ofrece las cuentas que aparecen, y solo esas', () => {
    /*
     * Las que no declaran autor no aportan una opción: aportarían una fila vacía
     * en el desplegable. El orden es estable a propósito — sin él, el desplegable
     * se reordenaría según el orden de llegada de los datos, que es el mismo
     * motivo por el que los otros seis ejes se ordenan en ese módulo y no en el
     * JSX.
     */
    expect(opcionesPresentes(catalogo()).autores).toEqual([OTRO, YO].sort());
  });
});
