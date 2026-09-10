/**
 * Búsqueda, filtros y orden del listado público — B-227.
 *
 * Todo lo de acá es lógica pura sobre el `events.json`: se testea sin DOM, sin
 * emulador y sin testing-library, que es justamente por qué vive en `src/lib/` y
 * no adentro del componente (§"Lógica pura separada de la infraestructura").
 *
 * El reloj entra como parámetro en todas las funciones, así que ningún caso
 * depende de qué día es hoy.
 */
import { describe, expect, it } from 'vitest';
import {
  CUANDO_ESTE_MES,
  CUANDO_PROXIMAS,
  CUANDO_TRES_MESES,
  EJES,
  agruparPorMes,
  alternarValor,
  aQuery,
  cantidadDeFiltrosPublicos,
  chipsDe,
  cuandoDeDias,
  desdeQuery,
  rutaCanonicaDeFiltros,
  diasDelCuando,
  etiquetaDeDias,
  ejeQueSobra,
  estadoDe,
  etiquetaDe,
  filtrarPublico,
  filtrosVacios,
  hayFiltrosPublicos,
  listaPublica,
  mapaDeEtiquetas,
  mesesConActividad,
  ordenarPublico,
  valoresDe,
  type Eje,
} from '@/lib/listadoPublico';
import { SIN_COSTO, esSinCosto, primeroSinCosto } from '@/lib/arancel';
import { entradaDePrueba } from './fixtures/indice';

/** Todo lo de este archivo se mide contra este instante. */
const AHORA = new Date('2026-09-10T15:00:00Z');

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [
    { slug: 'taller', label: 'Taller' },
    { slug: 'club-lectura', label: 'Club de lectura' },
  ],
  barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
  arancel: [{ slug: 'gratis', label: 'Gratis' }],
  tags: [{ slug: 'cronica', label: 'Crónica' }],
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · Lo que se deriva de una entrada, con el reloj de quien mira
// ───────────────────────────────────────────────────────────────────────────

describe('estadoDe — la próxima sesión sale del reloj de quien mira', () => {
  it('el próximo encuentro es el primero que no terminó, no el primero del array', () => {
    const e = entradaDePrueba({
      fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
    });
    expect(estadoDe(e, AHORA).proxima?.toISOString()).toBe('2026-09-17T22:00:00.000Z');
  });

  it('un encuentro empezado y sin terminar sigue siendo el próximo', () => {
    /*
     * La decisión sutil de `proximaVentana`: se descarta por el **fin** y se
     * devuelve el **inicio**. A las 19:30 de un taller de 19 a 21 todavía se
     * puede entrar. MUTACIÓN PROBADA: cambiar el descarte a `inicio < ahora`
     * hace que este caso devuelva `null`.
     */
    const e = entradaDePrueba({ fechas: ['2026-09-10T14:00:00Z'] });
    expect(estadoDe(e, AHORA).proxima?.toISOString()).toBe('2026-09-10T14:00:00.000Z');
    expect(estadoDe(e, AHORA).paso).toBe(false);
  });

  it('los encuentros cancelados no cuentan como próximos', () => {
    const e = entradaDePrueba({
      fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'],
      canceladas: [0],
    });
    expect(estadoDe(e, AHORA).proxima?.toISOString()).toBe('2026-09-24T22:00:00.000Z');
    expect(estadoDe(e, AHORA).encuentros).toBe(1);
  });

  it('sin nada por venir, pasó', () => {
    const e = entradaDePrueba({ fechas: ['2026-08-01T22:00:00Z'] });
    const s = estadoDe(e, AHORA);
    expect(s.paso).toBe(true);
    expect(s.proxima).toBeNull();
    expect(s.hasta?.toISOString()).toBe('2026-08-01T22:00:00.000Z');
  });

  it('un ciclo empezado con encuentros por venir está «en curso»', () => {
    const e = entradaDePrueba({
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z'],
    });
    expect(estadoDe(e, AHORA).enCurso).toBe(true);
  });

  it('uno que todavía no arrancó no está «en curso»', () => {
    // Control del caso de arriba: sin esto, `enCurso` podría ser siempre true
    // para cualquier cosa con fechas y nadie lo notaría.
    const e = entradaDePrueba({ fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'] });
    expect(estadoDe(e, AHORA).enCurso).toBe(false);
  });

  it('la inscripción se recalcula con el reloj de quien mira, no con el del build (B-111)', () => {
    /*
     * El punto entero de que el índice mande `cierraEn` y no el booleano
     * `abierta`: el booleano se congela en el build. Acá la misma entrada da
     * abierta o cerrada según el instante contra el que se pregunte.
     */
    const e = entradaDePrueba({ cierra: '2026-09-09T12:00:00Z' });
    expect(estadoDe(e, new Date('2026-09-08T00:00:00Z')).inscripcionCerrada).toBe(false);
    expect(estadoDe(e, AHORA).inscripcionCerrada).toBe(true);
  });

  it('sin fecha de cierre la inscripción nunca figura cerrada', () => {
    const e = entradaDePrueba({ cierra: null });
    expect(estadoDe(e, AHORA).inscripcionCerrada).toBe(false);
  });

  it('y una actividad sin inscripción tampoco, aunque tenga fecha', () => {
    // «Cerró la inscripción» de una entrada libre no significa nada.
    const e = entradaDePrueba({ requiereInscripcion: false, cierra: '2026-01-01T00:00:00Z' });
    expect(estadoDe(e, AHORA).inscripcionCerrada).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Búsqueda
// ───────────────────────────────────────────────────────────────────────────

describe('la búsqueda usa la normalización del §6', () => {
  const cronica = entradaDePrueba({
    slug: 'a',
    titulo: 'Taller de crónica',
    descripcion: 'Escribir la ciudad.',
    barrio: 'boedo',
  });
  const poesia = entradaDePrueba({
    slug: 'b',
    titulo: 'Club de poesía',
    descripcion: 'Leer en voz alta.',
    barrio: 'almagro',
  });
  const todas = [cronica, poesia];

  const buscar = (q: string) => filtrarPublico(todas, { ...filtrosVacios(), q }, AHORA).map((e) => e.slug);

  it('los acentos son irrelevantes en los dos sentidos', () => {
    expect(buscar('cronica')).toEqual(['a']);
    expect(buscar('CRÓNICA')).toEqual(['a']);
  });

  it('dos palabras se exigen las dos (AND), aunque estén separadas en el texto', () => {
    // «cronica boedo» encuentra la crónica de Boedo. MUTACIÓN PROBADA: cambiar
    // el `every` por un `some` hace que esto devuelva las dos.
    expect(buscar('cronica boedo')).toEqual(['a']);
    expect(buscar('cronica almagro')).toEqual([]);
  });

  it('los espacios de más no cambian nada', () => {
    expect(buscar('   cronica   ')).toEqual(['a']);
  });

  it('la descripción entra a la búsqueda, porque entra al searchText', () => {
    const e = entradaDePrueba({ slug: 'c', descripcion: 'Escribir sobre el conurbano' });
    expect(filtrarPublico([e], { ...filtrosVacios(), q: 'conurbano' }, AHORA)).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Filtros
// ───────────────────────────────────────────────────────────────────────────

describe('los ejes cruzan con AND y adentro con OR', () => {
  const taller = entradaDePrueba({ slug: 'taller', tipo: 'taller', barrio: 'boedo', arancel: 'gratis' });
  const club = entradaDePrueba({ slug: 'club', tipo: 'club-lectura', barrio: 'almagro', arancel: 'gratis' });
  const charla = entradaDePrueba({ slug: 'charla', tipo: 'charla', barrio: 'boedo', arancel: 'arancelado' });
  const todas = [taller, club, charla];

  const conFiltros = (v: Partial<Record<string, string[]>>) =>
    filtrarPublico(
      todas,
      { ...filtrosVacios(), valores: { ...filtrosVacios().valores, ...v } as never },
      AHORA,
    ).map((e) => e.slug);

  it('dos valores del mismo eje suman (OR)', () => {
    expect(conFiltros({ tipo: ['taller', 'club-lectura'] }).sort()).toEqual(['club', 'taller']);
  });

  it('dos ejes distintos restringen (AND)', () => {
    expect(conFiltros({ tipo: ['taller', 'club-lectura'], barrio: ['boedo'] })).toEqual(['taller']);
  });

  it('un eje vacío no filtra nada', () => {
    expect(conFiltros({}).sort()).toEqual(['charla', 'club', 'taller']);
  });

  it('una combinación imposible devuelve la lista vacía y no todo', () => {
    // El error clásico del `some` mal puesto: con cero resultados el filtro
    // devuelve todo en vez de nada.
    expect(conFiltros({ tipo: ['taller'], barrio: ['almagro'] })).toEqual([]);
  });
});

describe('el filtro de modalidad mira todas las formas de cursar, no la resultante (B-224)', () => {
  /*
   * Es la celda que el índice hace posible al llevar `modalidades[]` además del
   * escalar: una actividad presencial y virtual tiene que aparecer bajo los tres
   * chips, porque las tres cosas son ciertas de ella.
   *
   * MUTACIÓN PROBADA: hacer que `valoresDe(e,'modalidad')` devuelva
   * `[e.modalidad]` deja pasar solo el tercer caso y rompe los dos primeros.
   */
  const mixta = entradaDePrueba({ slug: 'mixta', modalidades: ['presencial', 'virtual'] });

  it('la derivada es híbrida', () => {
    expect(mixta.modalidad).toBe('hibrido');
    expect(valoresDe(mixta, 'modalidad').sort()).toEqual(['hibrido', 'presencial', 'virtual']);
  });

  it.each(['presencial', 'virtual', 'hibrido'])('aparece bajo «%s»', (valor) => {
    const filtros = { ...filtrosVacios(), valores: { ...filtrosVacios().valores, modalidad: [valor] } };
    expect(filtrarPublico([mixta], filtros, AHORA)).toHaveLength(1);
  });

  it('una presencial pura no aparece bajo «virtual»', () => {
    // Control negativo: sin esto, un `valoresDe` que devolviera las tres siempre
    // haría pasar los casos de arriba.
    const sola = entradaDePrueba({ slug: 'sola', modalidades: ['presencial'] });
    const filtros = { ...filtrosVacios(), valores: { ...filtrosVacios().valores, modalidad: ['virtual'] } };
    expect(filtrarPublico([sola], filtros, AHORA)).toHaveLength(0);
  });
});

describe('el filtro de «Cuándo»', () => {
  const pasada = entradaDePrueba({ slug: 'pasada', fechas: ['2026-08-01T22:00:00Z'] });
  const esteMes = entradaDePrueba({ slug: 'este', fechas: ['2026-09-24T22:00:00Z'] });
  const enTres = entradaDePrueba({ slug: 'tres', fechas: ['2026-11-05T22:00:00Z'] });
  const lejana = entradaDePrueba({ slug: 'lejos', fechas: ['2027-03-05T22:00:00Z'] });
  const todas = [pasada, esteMes, enTres, lejana];

  const con = (cuando: string) =>
    filtrarPublico(todas, { ...filtrosVacios(), cuando }, AHORA).map((e) => e.slug);

  it('«Próximas» es el default y deja afuera lo que ya pasó', () => {
    expect(filtrosVacios().cuando).toBe(CUANDO_PROXIMAS);
    expect(con(CUANDO_PROXIMAS)).toEqual(['este', 'tres', 'lejos']);
  });

  it('«Este mes» es el mes en la zona del proyecto', () => {
    expect(con(CUANDO_ESTE_MES)).toEqual(['este']);
  });

  it('«Próximos 3 meses» incluye el actual y los dos siguientes', () => {
    // Septiembre, octubre y noviembre: la de marzo queda afuera.
    expect(con(CUANDO_TRES_MESES)).toEqual(['este', 'tres']);
  });

  it('un mes puntual también trae lo que ya pasó de ese mes', () => {
    // Es lo que permite mirar «qué hubo en agosto» sin una página aparte.
    expect(con('2026-08')).toEqual(['pasada']);
  });

  it('un ciclo que cruza dos meses aparece en los dos (§7.5)', () => {
    const ciclo = entradaDePrueba({
      slug: 'ciclo',
      esCiclo: true,
      fechas: ['2026-09-24T22:00:00Z', '2026-10-08T22:00:00Z'],
    });
    expect(filtrarPublico([ciclo], { ...filtrosVacios(), cuando: '2026-09' }, AHORA)).toHaveLength(1);
    expect(filtrarPublico([ciclo], { ...filtrosVacios(), cuando: '2026-10' }, AHORA)).toHaveLength(1);
  });

  it('un valor que no reconocemos cae al default en vez de vaciar el listado', () => {
    // Una URL vieja compartida por WhatsApp tiene que seguir mostrando algo.
    expect(con('la-semana-que-viene')).toEqual(['este', 'tres', 'lejos']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// «Cuándo» por día y por rango — el destino del pie del tríptico (B-791)
// ───────────────────────────────────────────────────────────────────────────

describe('«Cuándo» por día: la gramática', () => {
  it('un día suelto se acepta tal cual', () => {
    expect(diasDelCuando('2026-09-18')).toEqual(['2026-09-18']);
  });

  it('un rango se expande a los días que abarca, con los dos extremos adentro', () => {
    expect(diasDelCuando('2026-09-19..2026-09-20')).toEqual(['2026-09-19', '2026-09-20']);
    expect(diasDelCuando('2026-09-15..2026-09-18')).toEqual([
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ]);
  });

  it('y cruzar el mes o el año es el caso normal, no el raro (trampa 1)', () => {
    /*
     * El pie del tríptico arma un rango cualquier día del año, así que
     * `2026-12-31..2027-01-01` es una URL que se va a generar sola. Se camina con
     * `diaDesplazado`, que ancla al mediodía UTC; restando milisegundos, el
     * cambio de mes o de horario de verano corre el día.
     */
    expect(diasDelCuando('2026-12-31..2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
    expect(diasDelCuando('2026-09-30..2026-10-01')).toEqual(['2026-09-30', '2026-10-01']);
  });

  it('lo que no es un día o un rango devuelve null, incluido un mes', () => {
    /*
     * El `null` es lo que hace que `pasaCuando` siga con su cadena y que
     * `desdeQuery` descarte el valor. **El mes tiene que dar `null`**: lo maneja
     * `esMes`, y si `diasDelCuando` se lo quedara, `?cuando=2026-09` dejaría de
     * ser «septiembre» y pasaría a no ser nada.
     */
    for (const valor of [
      '2026-09',
      'proximas',
      '',
      '2026-9-1',
      '2026-09-18..',
      '..2026-09-18',
      '2026-09-18..2026-09-19..2026-09-20',
      'hoy..manana',
    ]) {
      expect(diasDelCuando(valor), `«${valor}» no es un día`).toBeNull();
    }
  });

  it('un rango al revés no se acomoda solo: es un valor inválido', () => {
    // Acomodarlo sería adivinar. Devolver `null` lo manda al default, que es lo
    // que hace este módulo con todo lo que viene de la URL.
    expect(diasDelCuando('2026-09-20..2026-09-19')).toBeNull();
  });

  it('un rango de más de una semana también, para que el rótulo no sea ilegible', () => {
    // Siete es la ventana más larga que arma el tríptico. `2026-01-01..2026-12-31`
    // no es peligroso, es un chip con 365 fechas escritas.
    expect(diasDelCuando('2026-09-14..2026-09-20')).toHaveLength(7);
    expect(diasDelCuando('2026-09-14..2026-09-21')).toBeNull();
  });

  it('cuandoDeDias es la vuelta exacta de diasDelCuando', () => {
    /*
     * **La propiedad, y no los dos casos.** Son la ida y la vuelta de la misma
     * gramática: si una cambia y la otra no, el pie del tríptico arma un link que
     * el listado descarta y el filtro se cae al default sin decir nada.
     */
    for (const dias of [
      ['2026-09-18'],
      ['2026-09-19', '2026-09-20'],
      ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'],
    ]) {
      expect(diasDelCuando(cuandoDeDias(dias)), dias.join(',')).toEqual(dias);
    }
  });

  it('un día solo no se escribe como rango: la URL más corta posible', () => {
    expect(cuandoDeDias(['2026-09-18'])).toBe('2026-09-18');
    expect(cuandoDeDias(['2026-09-19', '2026-09-20'])).toBe('2026-09-19..2026-09-20');
  });

  it('una ventana vacía cae en «Próximas», no en un rango vacío', () => {
    // El caso del panel que no se dibuja: sin días, el link no tiene destino y el
    // default es lo único honesto.
    expect(cuandoDeDias([])).toBe(CUANDO_PROXIMAS);
  });

  it('la etiqueta escribe las fechas, que es lo que impide que el chip mienta', () => {
    expect(etiquetaDeDias(['2026-09-18'])).toBe('vie 18 sep');
    expect(etiquetaDeDias(['2026-09-19', '2026-09-20'])).toBe('sáb 19 sep a dom 20 sep');
    // Un tramo largo se nombra por los extremos: es lo que hace que «Esta semana»
    // quepa en un `<option>`.
    expect(etiquetaDeDias(['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'])).toBe(
      'mar 15 sep a vie 18 sep',
    );
  });
});

describe('«Cuándo» por día: lo que filtra', () => {
  const hoy = entradaDePrueba({ slug: 'hoy', fechas: ['2026-09-18T22:00:00Z'] });
  const manana = entradaDePrueba({ slug: 'manana', fechas: ['2026-09-19T22:00:00Z'] });
  const otro = entradaDePrueba({ slug: 'otro', fechas: ['2026-09-25T22:00:00Z'] });
  const todas = [hoy, manana, otro];

  const con = (cuando: string) =>
    filtrarPublico(todas, { ...filtrosVacios(), cuando }, AHORA).map((e) => e.slug);

  it('un día trae lo de ese día y nada más', () => {
    expect(con('2026-09-18')).toEqual(['hoy']);
  });

  it('un rango trae los días del tramo', () => {
    expect(con('2026-09-18..2026-09-19')).toEqual(['hoy', 'manana']);
  });

  it('trae el día ENTERO, también lo que ya empezó', () => {
    /*
     * **La única diferencia entre el panel del tríptico y su propio link, y es
     * deliberada.** El panel «Hoy» muestra lo que todavía no arrancó (mira
     * `inicio >= ahora`); el filtro muestra el día completo. Alguien que llega a
     * las nueve de la noche por «+3 más hoy» ve también los tres de las siete: el
     * pie promete «lo de hoy», y lo de hoy incluye lo de las siete.
     */
    const yaEmpezo = entradaDePrueba({ slug: 'temprano', fechas: ['2026-09-18T12:00:00Z'] });
    // Las 22:00 UTC del 18 son las 19:00 de Buenos Aires: la de las 09:00 ya pasó.
    const ahora = new Date('2026-09-18T22:00:00Z');
    expect(
      filtrarPublico([yaEmpezo], { ...filtrosVacios(), cuando: '2026-09-18' }, ahora).map(
        (e) => e.slug,
      ),
    ).toEqual(['temprano']);
  });

  it('el día se decide en la zona del proyecto y no en UTC (trampa 1)', () => {
    // 02:00 UTC del 19 son las 23:00 del **18** en Buenos Aires: la actividad es
    // del 18, y el filtro del 19 no la tiene que traer.
    const tarde = entradaDePrueba({ slug: 'tarde', fechas: ['2026-09-19T02:00:00Z'] });
    expect(
      filtrarPublico([tarde], { ...filtrosVacios(), cuando: '2026-09-18' }, AHORA),
    ).toHaveLength(1);
    expect(
      filtrarPublico([tarde], { ...filtrosVacios(), cuando: '2026-09-19' }, AHORA),
    ).toHaveLength(0);
  });

  it('un ciclo aparece en el día en que tiene un encuentro, como con el mes', () => {
    const ciclo = entradaDePrueba({
      slug: 'ciclo',
      esCiclo: true,
      fechas: ['2026-09-18T22:00:00Z', '2026-10-08T22:00:00Z'],
    });
    expect(
      filtrarPublico([ciclo], { ...filtrosVacios(), cuando: '2026-09-18' }, AHORA),
    ).toHaveLength(1);
  });

  it('una sesión cancelada no cuenta, igual que en el filtro por mes', () => {
    const cancelada = entradaDePrueba({
      slug: 'cancelada',
      fechas: ['2026-09-18T22:00:00Z'],
      canceladas: [0],
    });
    expect(
      filtrarPublico([cancelada], { ...filtrosVacios(), cuando: '2026-09-18' }, AHORA),
    ).toHaveLength(0);
  });

  it('cuenta como un filtro puesto, así que el botón «Filtros» lo dice', () => {
    // Si no contara, alguien que llega por el pie del tríptico vería un listado
    // acotado y un panel de filtros que dice que no hay ninguno.
    expect(cantidadDeFiltrosPublicos({ ...filtrosVacios(), cuando: '2026-09-18' })).toBe(1);
  });
});

describe('«Cuándo» por día: la URL', () => {
  it('desdeQuery acepta el día y el rango', () => {
    expect(desdeQuery('cuando=2026-09-18').filtros.cuando).toBe('2026-09-18');
    expect(desdeQuery('cuando=2026-09-19..2026-09-20').filtros.cuando).toBe(
      '2026-09-19..2026-09-20',
    );
  });

  it('y descarta lo que no es una fecha, sin vaciar el listado', () => {
    // Nada de lo que viene de la URL se cree sin chequear: es texto que escribe
    // cualquiera.
    for (const crudo of ['2026-09-18..2026-09-30', '2026-13-01..2026-13-02', 'ayer']) {
      expect(desdeQuery(`cuando=${crudo}`).filtros.cuando, crudo).toBe(CUANDO_PROXIMAS);
    }
  });

  it('el ida y vuelta por la query string no pierde el día', () => {
    const filtros = { ...filtrosVacios(), cuando: '2026-09-19..2026-09-20' };
    expect(desdeQuery(aQuery(filtros, 'proxima')).filtros.cuando).toBe('2026-09-19..2026-09-20');
  });
});

describe('los filtros sueltos', () => {
  it('«solo con inscripción abierta» descarta lo que ya cerró', () => {
    const cerrada = entradaDePrueba({ slug: 'cerrada', cierra: '2026-09-01T00:00:00Z' });
    const abierta = entradaDePrueba({ slug: 'abierta', cierra: '2026-12-01T00:00:00Z' });
    const filtros = { ...filtrosVacios(), soloAbierta: true };
    expect(filtrarPublico([cerrada, abierta], filtros, AHORA).map((e) => e.slug)).toEqual([
      'abierta',
    ]);
  });

  it('«solo ciclos» y «solo únicos» son complementarios', () => {
    const ciclo = entradaDePrueba({ slug: 'ciclo', esCiclo: true });
    const unico = entradaDePrueba({ slug: 'unico', esCiclo: false });
    const dos = [ciclo, unico];
    expect(filtrarPublico(dos, { ...filtrosVacios(), cursada: 'ciclos' }, AHORA).map((e) => e.slug)).toEqual(['ciclo']);
    expect(filtrarPublico(dos, { ...filtrosVacios(), cursada: 'unicos' }, AHORA).map((e) => e.slug)).toEqual(['unico']);
  });

  it('la cuenta de filtros no incluye el texto, que se ve solo', () => {
    const f = { ...filtrosVacios(), q: 'cronica' };
    expect(cantidadDeFiltrosPublicos(f)).toBe(0);
    expect(hayFiltrosPublicos(f)).toBe(true);
    expect(cantidadDeFiltrosPublicos({ ...f, soloAbierta: true })).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Orden
// ───────────────────────────────────────────────────────────────────────────

describe('los tres órdenes', () => {
  const vieja = entradaDePrueba({
    slug: 'vieja',
    titulo: 'Zapatos',
    fechas: ['2026-09-30T22:00:00Z'],
    creadoEn: '2026-01-01T00:00:00Z',
  });
  const nueva = entradaDePrueba({
    slug: 'nueva',
    titulo: 'Anteojos',
    fechas: ['2026-12-30T22:00:00Z'],
    creadoEn: '2026-09-09T00:00:00Z',
  });
  const media = entradaDePrueba({
    slug: 'media',
    titulo: 'Mesa',
    fechas: ['2026-10-30T22:00:00Z'],
    creadoEn: '2026-05-01T00:00:00Z',
  });
  const todas = [nueva, vieja, media];

  it('«próximas primero» ordena por la próxima fecha', () => {
    expect(ordenarPublico(todas, 'proxima', AHORA).map((e) => e.slug)).toEqual([
      'vieja',
      'media',
      'nueva',
    ]);
  });

  it('«recién agregadas» ordena por el alta, que es otra cosa', () => {
    /*
     * El desvío de D-137: una actividad cargada hoy para diciembre queda al fondo
     * del orden cronológico, y es justo la que alguien que vuelve quiere ver. Que
     * el resultado sea **el inverso** del de arriba es lo que muestra que los dos
     * criterios no son el mismo con otro nombre.
     */
    expect(ordenarPublico(todas, 'nuevas', AHORA).map((e) => e.slug)).toEqual([
      'nueva',
      'media',
      'vieja',
    ]);
  });

  it('«título» es alfabético en español', () => {
    expect(ordenarPublico(todas, 'titulo', AHORA).map((e) => e.titulo)).toEqual([
      'Anteojos',
      'Mesa',
      'Zapatos',
    ]);
  });

  it('lo que ya pasó va al final, de lo más reciente a lo más viejo', () => {
    const p1 = entradaDePrueba({ slug: 'p1', fechas: ['2026-07-01T22:00:00Z'] });
    const p2 = entradaDePrueba({ slug: 'p2', fechas: ['2026-08-01T22:00:00Z'] });
    const ordenadas = ordenarPublico([p1, p2, vieja], 'proxima', AHORA).map((e) => e.slug);
    expect(ordenadas).toEqual(['vieja', 'p2', 'p1']);
  });

  it('ordenar no muta el array de entrada', () => {
    // Lo comparten el listado y el conteo de los chips: si `ordenar` mutara, los
    // números cambiarían de significado según en qué orden se pintó la pantalla.
    const original = [...todas];
    ordenarPublico(todas, 'titulo', AHORA);
    expect(todas).toEqual(original);
  });

  it('«recién agregadas» tolera una entrada sin fecha de alta', () => {
    // Default de lectura: un documento sembrado sin `createdAt` publica `''` y
    // ordena al fondo, sin romper nada.
    const sinFecha = { ...vieja, slug: 'sin', creadoEn: '' };
    expect(ordenarPublico([sinFecha, nueva], 'nuevas', AHORA).map((e) => e.slug)).toEqual([
      'nueva',
      'sin',
    ]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Chips y etiquetas
// ───────────────────────────────────────────────────────────────────────────

describe('el eje de arancel: dónde está y en qué orden — B-271, D-151', () => {
  const gratis1 = entradaDePrueba({ slug: 'g1', arancel: 'gratis' });
  const gratis2 = entradaDePrueba({ slug: 'g2', arancel: 'gratis' });
  const gorra = entradaDePrueba({ slug: 'gg', arancel: 'a-la-gorra' });
  const pagos = Array.from({ length: 9 }, (_, i) =>
    entradaDePrueba({ slug: `p${i}`, arancel: 'arancelado' }),
  );
  /*
   * El orden del array importa para el caso del desempate: «A la gorra» entra
   * **antes** que los dos «Gratis», así que si el orden por cantidad se perdiera,
   * el orden de llegada dejaría la gorra primera y el aserto lo vería. Con los
   * gratis primero el bug pasaría desapercibido, que fue lo que pasó al mutarlo.
   */
  const todas = [...pagos, gorra, gratis1, gratis2];

  it('«Gratis» y «A la gorra» van primero aunque sean minoría', () => {
    /*
     * §6.1 del diseño: «`Gratis` y `A la gorra` primero, siempre». Con la regla
     * general —por cantidad— «Arancelado» (9) tapaba a «Gratis» (2), que es el
     * chip que alguien viene a buscar. En producción la desproporción es peor:
     * 33 arancelados contra 8 gratis.
     *
     * MUTACIÓN PROBADA: sacar el bloque de `eje === 'arancel'` de `chipsDe`
     * devuelve `['Arancelado', 'Gratis', 'A la gorra']` y hace fallar este caso.
     */
    const chips = chipsDe('arancel', todas, filtrosVacios(), ETIQUETAS, AHORA);
    expect(chips.map((c) => c.valor)).toEqual(['gratis', 'a-la-gorra', 'arancelado']);
    // Y los números siguen siendo los de verdad: se reordena, no se recuenta.
    expect(chips.map((c) => c.cantidad)).toEqual([2, 1, 9]);
  });

  it('entre los que no se pagan sigue mandando la cantidad', () => {
    /*
     * La regla nueva es un **primer** criterio, no un reemplazo: adentro de cada
     * grupo se mantiene la frecuencia real (§4.3).
     *
     * MUTACIÓN PROBADA: devolver `sa - sb` sin caer al orden por cantidad deja
     * `['a-la-gorra', 'gratis', …]` (el orden de llegada) y hace fallar esto.
     */
    const chips = chipsDe('arancel', todas, filtrosVacios(), ETIQUETAS, AHORA);
    expect(chips.slice(0, 2).map((c) => c.cantidad)).toEqual([2, 1]);
  });

  it('la regla es solo del eje de arancel: los demás ordenan por cantidad', () => {
    /*
     * Control de que la excepción no se derramó. `gratis` no es un valor de
     * `tipo`, así que ahí el orden tiene que seguir siendo el de siempre.
     */
    const chips = chipsDe(
      'tipo',
      [
        entradaDePrueba({ slug: 'a', tipo: 'club-lectura' }),
        entradaDePrueba({ slug: 'b', tipo: 'club-lectura' }),
        entradaDePrueba({ slug: 'c', tipo: 'taller' }),
      ],
      filtrosVacios(),
      ETIQUETAS,
      AHORA,
    );
    expect(chips.map((c) => c.valor)).toEqual(['club-lectura', 'taller']);
  });

  it('lo que no se paga sale de `esSinCosto`, no de una lista escrita al lado', () => {
    /*
     * Dos listas de «lo que no se paga» son dos maneras de que una se olvide de
     * «a la gorra», que es la mitad de los casos del circuito (§4.1). La fila del
     * listado ya pinta el arancel con el acento usando esta misma función.
     */
    expect(SIN_COSTO).toEqual(['gratis', 'a-la-gorra']);
    expect(esSinCosto('gratis')).toBe(true);
    expect(esSinCosto('a-la-gorra')).toBe(true);
    expect(esSinCosto('arancelado')).toBe(false);
    expect(esSinCosto('')).toBe(false);
  });

  it('el arancel es el segundo eje, y el grupo de «dónde» queda entero', () => {
    /*
     * `Buscador` recorre `EJES` para pintar el riel, así que este array **es** el
     * orden de la pantalla. Las dos mitades de la decisión, como dos asertos:
     * el precio arriba (que es lo que se pidió) y las tres de lugar contiguas
     * (que es lo que su lugar anterior rompía).
     *
     * MUTACIÓN PROBADA: volver `arancel` al tercer puesto hace fallar los dos.
     */
    expect(EJES.indexOf('arancel')).toBe(1);
    const lugar = ['modalidad', 'barrio', 'ciudad'].map((e) => EJES.indexOf(e as Eje));
    expect(lugar).toEqual([2, 3, 4]);
  });

  it('y el orden de la pantalla no cambia lo que la URL entiende', () => {
    /*
     * `aQuery` recorre `EJES`, así que reordenarlos reordena los parámetros. Una
     * URL vieja compartida por WhatsApp tiene que seguir dando lo mismo: los
     * parámetros son con nombre, no posicionales, y esto lo fija.
     */
    const { filtros } = desdeQuery('arancel=gratis&tipo=taller&modalidad=virtual');
    expect(filtros.valores.arancel).toEqual(['gratis']);
    expect(filtros.valores.tipo).toEqual(['taller']);
    expect(filtros.valores.modalidad).toEqual(['virtual']);
  });
});

describe('los chips salen de las opciones del JSON, con su número', () => {
  const taller1 = entradaDePrueba({ slug: 't1', tipo: 'taller', barrio: 'villa-crespo' });
  const taller2 = entradaDePrueba({ slug: 't2', tipo: 'taller', barrio: 'boedo' });
  const club = entradaDePrueba({ slug: 'c1', tipo: 'club-lectura', barrio: 'boedo' });
  const todas = [taller1, taller2, club];

  it('cada chip lleva cuántas actividades tiene, y se ordenan por cantidad', () => {
    const chips = chipsDe('tipo', todas, filtrosVacios(), ETIQUETAS, AHORA);
    expect(chips.map((c) => [c.label, c.cantidad])).toEqual([
      ['Taller', 2],
      ['Club de lectura', 1],
    ]);
  });

  it('el número de un eje NO cuenta su propio filtro (si no, no se puede sumar un segundo)', () => {
    /*
     * La regla que hace usable el filtro múltiple. MUTACIÓN PROBADA: sacar el
     * `omitir` de `chipsDe` deja «Club de lectura» en 0 apenas se elige «Taller»,
     * y un chip en 0 no se muestra: el segundo valor del mismo eje se vuelve
     * inalcanzable.
     */
    const conTaller = alternarValor(filtrosVacios(), 'tipo', 'taller');
    const chips = chipsDe('tipo', todas, conTaller, ETIQUETAS, AHORA);
    expect(chips.find((c) => c.valor === 'club-lectura')?.cantidad).toBe(1);
    expect(chips.find((c) => c.valor === 'taller')?.elegido).toBe(true);
  });

  it('pero los otros ejes sí se aplican al contar', () => {
    // El barrio de Boedo tiene un taller y un club; filtrando por taller, el chip
    // de Boedo tiene que decir 1.
    const conTaller = alternarValor(filtrosVacios(), 'tipo', 'taller');
    const chips = chipsDe('barrio', todas, conTaller, ETIQUETAS, AHORA);
    expect(chips.find((c) => c.valor === 'boedo')?.cantidad).toBe(1);
  });

  it('un chip que daría cero no se ofrece', () => {
    const soloClub = alternarValor(filtrosVacios(), 'tipo', 'club-lectura');
    const chips = chipsDe('barrio', todas, soloClub, ETIQUETAS, AHORA);
    expect(chips.map((c) => c.valor)).toEqual(['boedo']);
  });

  it('pero uno elegido se muestra aunque quede en cero, para poder sacarlo', () => {
    const imposible = alternarValor(
      alternarValor(filtrosVacios(), 'tipo', 'club-lectura'),
      'barrio',
      'villa-crespo',
    );
    const chips = chipsDe('barrio', todas, imposible, ETIQUETAS, AHORA);
    const vc = chips.find((c) => c.valor === 'villa-crespo');
    expect(vc).toMatchObject({ cantidad: 0, elegido: true });
  });

  it('la etiqueta sale de /opciones y el slug sin registrar cae a desSlug', () => {
    // §4.4 — nada cableado. Y el respaldo es el mismo que usa el evento público.
    expect(etiquetaDe(ETIQUETAS, 'tipo', 'taller')).toBe('Taller');
    expect(etiquetaDe(ETIQUETAS, 'barrio', 'san-telmo')).toBe('San Telmo');
  });

  it('la modalidad se resuelve con el enum del modelo, que no es taxonomía', () => {
    expect(etiquetaDe(ETIQUETAS, 'modalidad', 'hibrido')).toBe('Presencial y virtual');
  });

  it('el eje `tag` se resuelve contra el campo `tags` de /opciones', () => {
    // El eje se llama en singular porque así se lee en la URL (`?tag=cronica`) y
    // el documento de taxonomía es `tags`: es el punto donde los dos nombres se
    // tienen que cruzar bien.
    expect(etiquetaDe(ETIQUETAS, 'tag', 'cronica')).toBe('Crónica');
  });
});

describe('el estado vacío dice qué filtro sacar', () => {
  const taller = entradaDePrueba({ slug: 't', tipo: 'taller', barrio: 'boedo' });

  it('ofrece un eje que, sacado, de verdad devuelve resultados', () => {
    /*
     * Se **prueba** en vez de adivinar por prioridad: sugerir «sacá el barrio»
     * cuando sacarlo tampoco alcanza es peor que no sugerir nada. Acá el barrio
     * es el que sobra: sacándolo aparece el taller; sacando el tipo, no.
     */
    const filtros = alternarValor(
      alternarValor(filtrosVacios(), 'tipo', 'taller'),
      'barrio',
      'almagro',
    );
    expect(filtrarPublico([taller], filtros, AHORA)).toHaveLength(0);
    expect(ejeQueSobra([taller], filtros, AHORA)).toBe('barrio');
  });

  it('cuando sacar cualquiera de a uno no alcanza, no inventa una sugerencia', () => {
    const filtros = alternarValor(
      alternarValor(filtrosVacios(), 'tipo', 'charla'),
      'barrio',
      'almagro',
    );
    expect(ejeQueSobra([taller], filtros, AHORA)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · Agrupación por mes
// ───────────────────────────────────────────────────────────────────────────

describe('agruparPorMes', () => {
  it('agrupa por el mes de la próxima fecha, en el orden que le llega', () => {
    const sep = entradaDePrueba({ slug: 'sep', fechas: ['2026-09-24T22:00:00Z'] });
    const oct = entradaDePrueba({ slug: 'oct', fechas: ['2026-10-01T22:00:00Z'] });
    const oct2 = entradaDePrueba({ slug: 'oct2', fechas: ['2026-10-15T22:00:00Z'] });
    const grupos = agruparPorMes([sep, oct, oct2], AHORA);
    expect(grupos.map((g) => [g.titulo, g.entradas.length])).toEqual([
      ['Septiembre de 2026', 1],
      ['Octubre de 2026', 2],
    ]);
  });

  it('no reordena: si la lista viene desordenada, el mes se repite', () => {
    /*
     * Es a propósito y hay que saberlo: agrupar **no** ordena, así que el
     * listado tiene que ordenar antes. Si agrupara por su cuenta, con «Título»
     * los separadores dirían un orden que la lista no tiene.
     */
    const sep = entradaDePrueba({ slug: 'sep', fechas: ['2026-09-24T22:00:00Z'] });
    const oct = entradaDePrueba({ slug: 'oct', fechas: ['2026-10-01T22:00:00Z'] });
    const grupos = agruparPorMes([sep, oct, sep], AHORA);
    expect(grupos.map((g) => g.clave)).toEqual(['2026-09', '2026-10', '2026-09']);
  });

  it('lo que ya pasó cae en el mes de su última fecha', () => {
    const vieja = entradaDePrueba({ slug: 'v', fechas: ['2026-07-02T22:00:00Z'] });
    expect(agruparPorMes([vieja], AHORA)[0]!.clave).toBe('2026-07');
  });

  it('los meses del desplegable salen de las fechas que hay, ordenados', () => {
    const a = entradaDePrueba({ slug: 'a', fechas: ['2026-10-01T22:00:00Z'] });
    const b = entradaDePrueba({ slug: 'b', fechas: ['2026-09-01T22:00:00Z', '2026-10-20T22:00:00Z'] });
    expect(mesesConActividad([a, b])).toEqual(['2026-09', '2026-10']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7 · La URL
// ───────────────────────────────────────────────────────────────────────────

describe('los filtros van y vuelven de la query string (§6.2)', () => {
  it('sin filtros la query queda vacía: es la URL que canoniza la home', () => {
    // Si el default se escribiera, cada visita generaría una URL distinta de `/`
    // y Google indexaría combinaciones del mismo contenido.
    expect(aQuery(filtrosVacios(), 'proxima')).toBe('');
  });

  it('ida y vuelta conserva todo', () => {
    const filtros = {
      ...filtrosVacios(),
      q: 'cronica',
      cuando: '2026-09',
      soloAbierta: true,
      cursada: 'ciclos' as const,
      valores: { ...filtrosVacios().valores, tipo: ['taller', 'charla'], barrio: ['boedo'] },
    };
    const query = aQuery(filtros, 'nuevas');
    const vuelta = desdeQuery(query);
    expect(vuelta.filtros).toEqual(filtros);
    expect(vuelta.orden).toBe('nuevas');
  });

  it('la ida y vuelta cubre TODOS los ejes, no los que alguien se acordó de poner', () => {
    /*
     * `EJES` se recorre acá igual que en `aQuery`: un eje nuevo entra solo a este
     * caso, y si `aQuery` o `desdeQuery` se olvidan de él, falla. Es la
     * diferencia entre un test que protege una instancia y uno que protege la
     * clase.
     */
    const filtros = filtrosVacios();
    for (const eje of EJES) filtros.valores[eje] = [`valor-${eje}`];
    expect(desdeQuery(aQuery(filtros, 'proxima')).filtros.valores).toEqual(filtros.valores);
  });

  it('un orden inventado cae al default', () => {
    expect(desdeQuery('orden=por-precio').orden).toBe('proxima');
  });

  it('un «cuando» inventado también', () => {
    expect(desdeQuery('cuando=mañana').filtros.cuando).toBe(CUANDO_PROXIMAS);
    expect(desdeQuery('cuando=2026-09').filtros.cuando).toBe('2026-09');
  });

  it('los valores vacíos de una lista se descartan', () => {
    expect(desdeQuery('tipo=taller,,%20,charla').filtros.valores.tipo).toEqual(['taller', 'charla']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 8 · La composición
// ───────────────────────────────────────────────────────────────────────────

describe('listaPublica filtra y ordena de una vez', () => {
  it('el default muestra lo que viene, por fecha', () => {
    const pasada = entradaDePrueba({ slug: 'pasada', fechas: ['2026-01-01T22:00:00Z'] });
    const proxima = entradaDePrueba({ slug: 'proxima', fechas: ['2026-09-20T22:00:00Z'] });
    const lejana = entradaDePrueba({ slug: 'lejana', fechas: ['2026-11-20T22:00:00Z'] });
    expect(
      listaPublica([lejana, pasada, proxima], filtrosVacios(), 'proxima', AHORA).map((e) => e.slug),
    ).toEqual(['proxima', 'lejana']);
  });
});

describe('la ruta canónica de un listado filtrado — B-848', () => {
  it('deja solo lo que `aQuery` escribiría, y tira lo que vino pegado', () => {
    /*
     * **El caso real y no el hipotético:** el efecto que reescribe la query
     * saltea el primer render, así que en la primera visita lo que hay en la
     * barra es la query **como llegó** — con el `utm_source` de quien la
     * compartió, o con lo que traiga un link de mail. «Guardar esta búsqueda»
     * guarda esa URL, y lo guardado no se puede inspeccionar salvo mirando el
     * `href`. Lo señaló el `auditor-privacidad`.
     *
     * MUTACIÓN PROBADA: devolver `pathname + query` sin el viaje de ida y vuelta
     * hace fallar este caso con el `utm_source` y el mail adentro.
     */
    expect(
      rutaCanonicaDeFiltros('/', '?tag=poesia&utm_source=x&mail=juan@ejemplo.com'),
    ).toBe('/?tag=poesia');
  });

  it('sin ningún filtro reconocible devuelve el `pathname` pelado', () => {
    // Es la misma URL que canoniza el `<link rel="canonical">` de la home.
    expect(rutaCanonicaDeFiltros('/', '?utm_source=x')).toBe('/');
    expect(rutaCanonicaDeFiltros('/tipo/taller/', '')).toBe('/tipo/taller/');
  });

  it('y es idempotente: guardar lo ya canónico no lo cambia', () => {
    const una = rutaCanonicaDeFiltros('/', '?tag=poesia&cuando=este-mes&orden=nuevas');
    expect(rutaCanonicaDeFiltros('/', una.slice(una.indexOf('?')))).toBe(una);
  });
});
