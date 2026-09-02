import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  AVISO_DEL_MES_VENCIDO,
  DESTINO_DEL_MES_VENCIDO,
  MINIMO_DE_ACTIVIDADES,
  SALIDA_DEL_MES_VENCIDO,
  bajadaDelMes,
  descripcionDelMes,
  entradasDelMes,
  mesesDelSitio,
  mesesEnlazables,
  recorteDelMes,
  tituloDelMes,
} from '@/lib/mesPublico';
import { estadoDe, filtrarPublico, filtrosVacios } from '@/lib/listadoPublico';
import { bloqueDeFecha, cicloDelMes, cicloDeTarjeta } from '@/lib/tarjetaPublica';
import { rutaDeMes } from '@/lib/rutasPublicas';
import { entradaDePrueba } from './fixtures/indice';

/**
 * Las páginas de mes — `/agenda/{aaaa-mm}`, B-113, §2.2 del diseño.
 *
 * ── Qué se puede romper acá, que no es que se rompa ───────────────────────
 * Nada de lo que esta sección hace mal deja el build en rojo, y las cuatro
 * cosas producen páginas que se ven perfectas:
 *
 * 1. **El corte de tres.** Bajarlo a uno publica una página por cada actividad
 *    suelta, cada una compitiendo en Google con la página de detalle de esa
 *    misma actividad. Se ve bien, y resta.
 * 2. **Los meses pasados.** Emitir marzo de 2024 llena el sitio de páginas
 *    muertas; no emitir el mes que acaba de terminar convierte en 404 una URL
 *    que estuvo indexada. Las dos son la misma línea con el signo cambiado.
 * 3. **El ciclo que cruza dos meses.** Si la fila no se recalcula, la página de
 *    octubre muestra un ciclo con la fecha de septiembre y dice «8 encuentros»
 *    en las dos. Es la parte que el §7.5 pide con todas las letras, y es la
 *    única que no se nota mirando una sola página.
 * 4. **Que la selección se separe de la del filtro de la home.** `/agenda/2026-09`
 *    y `/?cuando=2026-09` tienen que mostrar lo mismo; el día que no, las dos
 *    páginas siguen viéndose bien por separado (la clase de B-88).
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * Todo se mide contra `AHORA`, así que ningún caso depende de qué día es hoy.
 */
const AHORA = new Date('2026-09-10T15:00:00Z');

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const fuente = (rel: string): string => readFileSync(raiz(rel), 'utf8');

/** N actividades sueltas de un mes, cada una con su id y su fecha. */
const sueltas = (n: number, mes: string, dia = 5): ReturnType<typeof entradaDePrueba>[] =>
  Array.from({ length: n }, (_, i) =>
    entradaDePrueba({
      id: `${mes}-${i}`,
      slug: `act-${mes}-${i}`,
      titulo: `Actividad ${i + 1} de ${mes}`,
      fechas: [`${mes}-${String(dia + i).padStart(2, '0')}T22:00:00Z`],
    }),
  );

/**
 * El ciclo a caballo: ocho encuentros, cuatro en septiembre y cuatro en octubre.
 * Es el caso del §7.5 y el que da nombre a la mitad difícil de B-113.
 */
const CICLO_A_CABALLO = () =>
  entradaDePrueba({
    id: 'ciclo',
    slug: 'club-de-lectura-rulfo',
    titulo: 'Club de lectura: Rulfo',
    esCiclo: true,
    fechas: [
      '2026-09-03T22:00:00Z',
      '2026-09-10T22:00:00Z',
      '2026-09-17T22:00:00Z',
      '2026-09-24T22:00:00Z',
      '2026-10-01T22:00:00Z',
      '2026-10-08T22:00:00Z',
      '2026-10-15T22:00:00Z',
      '2026-10-22T22:00:00Z',
    ],
  });

// ───────────────────────────────────────────────────────────────────────────
// 0 · Control positivo
// ───────────────────────────────────────────────────────────────────────────

describe('los fixtures son lo que dicen ser', () => {
  it('el ciclo tiene ocho encuentros repartidos en dos meses', () => {
    /*
     * Casi todo lo de abajo cuenta encuentros por mes, y contar sobre un fixture
     * que quedó con todas las fechas en septiembre daría números creíbles y
     * verificaría la mitad de lo que dice verificar.
     */
    const ciclo = CICLO_A_CABALLO();
    expect(ciclo.sesiones).toHaveLength(8);
    expect(recorteDelMes(ciclo, '2026-09').sesiones).toHaveLength(4);
    expect(recorteDelMes(ciclo, '2026-10').sesiones).toHaveLength(4);
  });

  it('y el corte de la sección sigue siendo tres', () => {
    // Si esta constante cambia, los casos de abajo dejan de probar el borde que
    // dicen probar y hay que venir a reescribirlos, no a ajustar el número.
    expect(MINIMO_DE_ACTIVIDADES).toBe(3);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · La regla de las tres (§2.2)
// ───────────────────────────────────────────────────────────────────────────

describe('la regla de las tres — §2.2', () => {
  it('un mes con tres actividades tiene página', () => {
    const paginas = mesesDelSitio(sueltas(3, '2026-10'), AHORA);
    expect(paginas.map((p) => p.clave)).toEqual(['2026-10']);
    expect(paginas[0]!.entradas).toHaveLength(3);
  });

  it('con dos, no', () => {
    /*
     * El corte no es un número redondo: con una o dos actividades la página es un
     * casi-duplicado de la home **compitiendo en Google con la página de detalle
     * de cada una**, así que resta en vez de sumar. El §2.2 manda el link a la
     * home con el mes preaplicado.
     *
     * MUTACIÓN PROBADA: `MINIMO_DE_ACTIVIDADES = 2` hace aparecer esta página, y
     * `>= MINIMO` cambiado por `> 0` también.
     */
    expect(mesesDelSitio(sueltas(2, '2026-10'), AHORA)).toEqual([]);
  });

  it('y el corte cuenta actividades, no encuentros', () => {
    /*
     * Un ciclo de ocho encuentros en un mes es **una** actividad (§2.2 del
     * `CLAUDE.md`: actividad ≠ encuentro). Contar encuentros publicaría una
     * página de mes con una sola tarjeta, que es exactamente lo que el corte
     * existe para evitar.
     *
     * MUTACIÓN PROBADA: contar `sesiones` en vez de entradas hace pasar este mes.
     */
    const ciclo = entradaDePrueba({
      id: 'solo',
      esCiclo: true,
      fechas: ['2026-10-05T22:00:00Z', '2026-10-12T22:00:00Z', '2026-10-19T22:00:00Z'],
    });
    expect(mesesDelSitio([ciclo], AHORA)).toEqual([]);
  });

  it('los encuentros cancelados no suman para el corte', () => {
    // Una actividad cuya única fecha del mes está cancelada no está en ese mes:
    // sumarla publicaría la página por una fila que después no aparece.
    const conCancelada = entradaDePrueba({
      id: 'cancelada',
      fechas: ['2026-10-06T22:00:00Z'],
      canceladas: [0],
    });
    expect(mesesDelSitio([...sueltas(2, '2026-10'), conCancelada], AHORA)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Solo meses vigentes, y el mes vencido una última vez
// ───────────────────────────────────────────────────────────────────────────

describe('qué meses se emiten — §2.2', () => {
  const todos = () => [
    ...sueltas(3, '2026-07'), // dos meses atrás
    ...sueltas(3, '2026-08'), // el mes pasado
    ...sueltas(3, '2026-09'), // el mes en curso
    ...sueltas(3, '2026-11'), // dentro de dos meses
  ];

  it('el mes en curso y los que vienen, sí; los viejos, no', () => {
    /*
     * MUTACIÓN PROBADA: sacar el `.filter((clave) => clave >= primero)` hace
     * aparecer `2026-07`, o sea una página de archivo que el §2.2 no quiere y que
     * `/pasadas` va a cubrir de otra manera.
     */
    expect(mesesDelSitio(todos(), AHORA).map((p) => p.clave)).toEqual([
      '2026-08',
      '2026-09',
      '2026-11',
    ]);
  });

  it('el mes que acaba de terminar se emite una última vez, marcado', () => {
    /*
     * La mitad que evita el 404 sobre una URL indexada: el 1 de octubre, la
     * página de septiembre tiene que seguir respondiendo. El 1 de noviembre ya
     * no.
     *
     * MUTACIÓN PROBADA: cambiar `mesDesplazado(actual, -1)` por `actual` hace
     * desaparecer `2026-08` — y el día 1 de cada mes se rompe una URL que Google
     * tenía indexada, que es de las pocas cosas que no se pueden deshacer.
     */
    const porClave = new Map(mesesDelSitio(todos(), AHORA).map((p) => [p.clave, p]));
    expect(porClave.get('2026-08')!.vencido).toBe(true);
    expect(porClave.get('2026-09')!.vencido).toBe(false);
    expect(porClave.get('2026-11')!.vencido).toBe(false);
  });

  it('el mes vencido no se enlaza desde ningún lado', () => {
    /*
     * Existe para quien tenga la URL o la encuentre en Google, no para mandarle
     * gente. `mesesEnlazables` es lo que usan la tira de la home y la navegación
     * entre meses.
     *
     * MUTACIÓN PROBADA: cambiar el filtro por `p.vencido` deja la home enlazando
     * únicamente meses que ya pasaron.
     */
    expect(mesesEnlazables(todos(), AHORA).map((p) => p.clave)).toEqual(['2026-09', '2026-11']);
  });

  it('un mes vencido sin las tres actividades tampoco se emite', () => {
    // La emisión de más es para que la URL no se rompa, y una URL que nunca
    // existió no se puede romper: el corte se aplica igual.
    expect(mesesDelSitio(sueltas(2, '2026-08'), AHORA)).toEqual([]);
  });

  it('el horizonte sale de los datos y no de un número de meses', () => {
    /*
     * Un ciclo cargado para marzo del año que viene tiene su página. Con un
     * horizonte fijo —«los próximos seis meses»— no la tendría, y el modo de
     * falla es que nadie se entera: la home lo muestra igual.
     */
    expect(mesesDelSitio(sueltas(3, '2027-03'), AHORA).map((p) => p.clave)).toEqual(['2027-03']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · El ciclo a caballo — el caso del §7.5
// ───────────────────────────────────────────────────────────────────────────

describe('un ciclo que cruza dos meses aparece en los dos — §7.5', () => {
  const conCiclo = () => [
    CICLO_A_CABALLO(),
    ...sueltas(2, '2026-09', 12),
    ...sueltas(2, '2026-10', 12),
  ];

  it('está en septiembre y está en octubre', () => {
    const claves = mesesDelSitio(conCiclo(), AHORA)
      .filter((p) => p.entradas.some((e) => e.id === 'ciclo'))
      .map((p) => p.clave);
    expect(claves).toEqual(['2026-09', '2026-10']);
  });

  it('y es una sola fila en cada uno, no una por encuentro', () => {
    // «Una actividad, una tarjeta. Sin excepciones y en todas las vistas» (§7.5).
    const septiembre = entradasDelMes(conCiclo(), '2026-09', AHORA);
    expect(septiembre.filter((e) => e.id === 'ciclo')).toHaveLength(1);
  });

  it('en cada mes muestra las fechas de ese mes, no todas', () => {
    /*
     * **El corazón de B-113.** El recorte es lo que hace que todo lo que deriva de
     * las sesiones hable del mes: acá se mide sobre el estado, que es de donde
     * salen el bloque de fecha, «ya empezó» y la línea del ciclo.
     *
     * MUTACIÓN PROBADA: hacer que `recorteDelMes` devuelva `e` tal cual pone en
     * rojo los tres asertos de octubre — y en la página se vería un ciclo de
     * octubre con la fecha del 17 de septiembre en el bloque.
     */
    const ciclo = CICLO_A_CABALLO();

    const septiembre = estadoDe(recorteDelMes(ciclo, '2026-09'), AHORA);
    expect(septiembre.encuentros).toBe(4);
    expect(septiembre.desde?.toISOString()).toBe('2026-09-03T22:00:00.000Z');
    expect(septiembre.hasta?.toISOString()).toBe('2026-09-24T22:00:00.000Z');

    const octubre = estadoDe(recorteDelMes(ciclo, '2026-10'), AHORA);
    expect(octubre.encuentros).toBe(4);
    expect(octubre.desde?.toISOString()).toBe('2026-10-01T22:00:00.000Z');
    expect(octubre.hasta?.toISOString()).toBe('2026-10-22T22:00:00.000Z');
  });

  it('el bloque de fecha de la página de octubre es una fecha de octubre', () => {
    /*
     * Sin el recorte, el bloque de la fila diría «JUE 17 SEP» en
     * `/agenda/2026-10`, porque la próxima sesión del ciclo entero es la del 17
     * de septiembre. Es el síntoma que se ve, y el que nadie mira si no abre las
     * dos páginas al lado.
     */
    const octubre = bloqueDeFecha(estadoDe(recorteDelMes(CICLO_A_CABALLO(), '2026-10'), AHORA));
    expect(octubre.paso).toBe(false);
    if (octubre.paso) return;
    expect(octubre.dia).toBe('1');
    expect(octubre.mes).toBe('oct');
  });

  it('el subtítulo dice cuántos caen en este mes y cuántos tiene el ciclo', () => {
    /*
     * Las dos mitades importan y por motivos distintos:
     *
     * - «4 en septiembre, del 3 al 24» es lo que el §7.5 pide.
     * - «Ciclo de 8 encuentros» es lo que **no** se puede perder al recortar:
     *   decir «Ciclo de 4 encuentros» en septiembre es información falsa sobre lo
     *   que alguien está por decidir si compra.
     *
     * MUTACIÓN PROBADA: pasarle `estadoDelMes` en los dos parámetros —que es el
     * error natural— produce «Ciclo de 4 encuentros · del 3 al 24» y pone en rojo
     * este caso.
     */
    const ciclo = CICLO_A_CABALLO();
    const total = estadoDe(ciclo, AHORA);

    expect(cicloDelMes(ciclo, estadoDe(recorteDelMes(ciclo, '2026-09'), AHORA), total, '2026-09')).toBe(
      'Ciclo de 8 encuentros · 4 en septiembre, del 3 al 24',
    );
    expect(cicloDelMes(ciclo, estadoDe(recorteDelMes(ciclo, '2026-10'), AHORA), total, '2026-10')).toBe(
      'Ciclo de 8 encuentros · 4 en octubre, del 1 al 22',
    );
  });

  it('y en la home sigue diciendo lo de siempre', () => {
    /*
     * El otro control: la fila de la home **no** cambia. Si `cicloDelMes` se
     * empezara a usar sin `mes`, el listado principal diría «4 en septiembre» en
     * lugar de «empieza el 3 de septiembre», que es la frase con la que alguien
     * decide.
     */
    const ciclo = CICLO_A_CABALLO();
    expect(cicloDeTarjeta(ciclo, estadoDe(ciclo, AHORA))).toBe(
      'Ciclo de 8 encuentros · empezó el 3 de septiembre',
    );
  });

  it('cuando el mes tiene todas las fechas, no repite el número', () => {
    /*
     * «Ciclo de 4 encuentros · 4 en septiembre, del 3 al 24» le hace dudar a quien
     * lee si son cuatro u ocho. Con todas adentro alcanza con el rango.
     */
    const ciclo = entradaDePrueba({
      id: 'corto',
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-10T22:00:00Z', '2026-09-17T22:00:00Z'],
    });
    const estado = estadoDe(recorteDelMes(ciclo, '2026-09'), AHORA);
    expect(cicloDelMes(ciclo, estado, estadoDe(ciclo, AHORA), '2026-09')).toBe(
      'Ciclo de 3 encuentros · del 3 al 17',
    );
  });

  it('un encuentro solo en el mes se dice en singular y con «el»', () => {
    // «del 3 al 3» se lee como un error de software, igual que en `rangoCorto`.
    const suelta = entradaDePrueba({
      id: 'dos-meses',
      fechas: ['2026-09-12T22:00:00Z', '2026-10-03T22:00:00Z'],
    });
    const estado = estadoDe(recorteDelMes(suelta, '2026-09'), AHORA);
    expect(cicloDelMes(suelta, estado, estadoDe(suelta, AHORA), '2026-09')).toBe(
      '2 encuentros · 1 en septiembre, el 12',
    );
  });

  it('una actividad de un solo encuentro no dice nada: ya lo dijo el bloque', () => {
    // La misma regla que en la home, y por el mismo motivo: repetir la fecha que
    // está tres centímetros más arriba no informa nada.
    const suelta = entradaDePrueba({ id: 'unica', fechas: ['2026-09-12T22:00:00Z'] });
    const estado = estadoDe(recorteDelMes(suelta, '2026-09'), AHORA);
    expect(cicloDelMes(suelta, estado, estadoDe(suelta, AHORA), '2026-09')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · La selección y el orden
// ───────────────────────────────────────────────────────────────────────────

describe('la selección del mes es la del filtro de la home', () => {
  it('`/agenda/2026-10` muestra lo mismo que `/?cuando=2026-10`', () => {
    /*
     * La clase de B-88 con nombre: dos derivaciones de «qué cae en este mes».
     * Escritas por separado quedan idénticas hoy y divergen el día que se toque
     * una —los cancelados, la zona horaria, el ciclo a caballo— y las dos páginas
     * se siguen viendo bien.
     *
     * MUTACIÓN PROBADA: filtrar acá por la **primera** fecha de la actividad en
     * vez de por «alguna sesión en el mes» saca el ciclo de octubre y pone este
     * caso en rojo.
     */
    const entradas = [CICLO_A_CABALLO(), ...sueltas(2, '2026-09', 12), ...sueltas(2, '2026-10', 12)];
    const delFiltro = filtrarPublico(entradas, { ...filtrosVacios(), cuando: '2026-10' }, AHORA);

    expect(entradasDelMes(entradas, '2026-10', AHORA).map((e) => e.id).sort()).toEqual(
      delFiltro.map((e) => e.id).sort(),
    );
  });

  it('el orden del mes sale de las fechas de ese mes', () => {
    /*
     * El caso está armado para que las dos formas de ordenar den distinto, que es
     * la única manera de que pruebe algo: el ciclo tiene un encuentro **próximo**
     * el 17 de septiembre y su fecha de octubre es la del 20. En la página de
     * octubre va **después** de la charla del 5; ordenando por la próxima sesión
     * de la actividad entera iría primero de todo, arriba de dos actividades que
     * empiezan antes que él en el mes que la página nombra.
     *
     * MUTACIÓN PROBADA: ordenar sobre las entradas enteras en vez de sobre los
     * recortes pone este caso en rojo. Con un fixture donde las dos fechas caen en
     * el mismo orden, la mutación **sobrevive** — pasó en la primera versión de
     * este archivo.
     */
    const ciclo = entradaDePrueba({
      id: 'ciclo-tardio',
      titulo: 'Ciclo que sigue en octubre',
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z', '2026-10-20T22:00:00Z'],
    });
    const temprana = entradaDePrueba({
      id: 'temprana',
      titulo: 'Charla del 5',
      fechas: ['2026-10-05T22:00:00Z'],
    });
    const tardia = entradaDePrueba({
      id: 'tardia',
      titulo: 'Charla del 28',
      fechas: ['2026-10-28T22:00:00Z'],
    });

    // Control: la próxima sesión del ciclo entero es de septiembre, así que sin
    // el recorte se ordenaría primero.
    expect(estadoDe(ciclo, AHORA).proxima?.toISOString()).toBe('2026-09-17T22:00:00.000Z');

    const orden = entradasDelMes([tardia, ciclo, temprana], '2026-10', AHORA);
    expect(orden.map((e) => e.id)).toEqual(['temprana', 'ciclo-tardio', 'tardia']);
  });

  it('lo que ya pasó del mes en curso queda al final', () => {
    /*
     * La página del mes en curso muestra el mes entero, incluido lo que ya pasó:
     * es «qué hay en septiembre», no «qué queda». Pero lo pasado va al fondo, que
     * es la semántica que `ordenarPublico` ya tiene y la que hace que la primera
     * pantalla sea la útil.
     */
    const paso = entradaDePrueba({ id: 'paso', fechas: ['2026-09-02T22:00:00Z'] });
    const viene = entradaDePrueba({ id: 'viene', fechas: ['2026-09-20T22:00:00Z'] });
    expect(entradasDelMes([paso, viene], '2026-09', AHORA).map((e) => e.id)).toEqual([
      'viene',
      'paso',
    ]);
  });

  it('el mes de una fecha se decide con la zona horaria del proyecto', () => {
    /*
     * Trampa 1, del lado de la selección. `2026-10-01T02:00:00Z` son las 23:00 del
     * **30 de septiembre** en Buenos Aires: la actividad es de septiembre, y un
     * `getMonth()` sobre un servidor en UTC la pondría en octubre — o sea en la
     * página equivocada, y encima cambiando el conteo que decide si las dos
     * páginas existen.
     *
     * MUTACIÓN PROBADA: reemplazar `claveDeMes` por `d.toISOString().slice(0, 7)`
     * pone este caso en rojo.
     */
    const medianoche = entradaDePrueba({ id: 'borde', fechas: ['2026-10-01T02:00:00Z'] });
    expect(recorteDelMes(medianoche, '2026-09').sesiones).toHaveLength(1);
    expect(recorteDelMes(medianoche, '2026-10').sesiones).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Lo que la página dice
// ───────────────────────────────────────────────────────────────────────────

describe('el texto de la página', () => {
  const pagina = (clave: string, entradas = sueltas(3, clave)) =>
    mesesDelSitio(entradas, AHORA).find((p) => p.clave === clave)!;

  it('el título dice «qué hay» cuando el mes viene y «qué hubo» cuando pasó', () => {
    /*
     * El verbo cambia con el reloj, como en `cicloDeTarjeta`. «Qué hay en agosto»
     * leído en septiembre es falso, y es el título que Google se queda mostrando
     * durante semanas.
     *
     * MUTACIÓN PROBADA: fijar el verbo en «Qué hay» pone en rojo el segundo
     * aserto.
     */
    expect(tituloDelMes(pagina('2026-10'))).toBe('Qué hay en octubre de 2026');
    expect(tituloDelMes(pagina('2026-08'))).toBe('Qué hubo en agosto de 2026');
  });

  it('la descripción lleva el conteo y tres títulos, como pide el §5.1', () => {
    const texto = descripcionDelMes(pagina('2026-10', sueltas(4, '2026-10')));
    expect(texto).toContain('4 actividades literarias en octubre de 2026');
    // Tres y no cuatro: el corte útil de una descripción son ~160 caracteres, y
    // el cuarto título lo único que compra es que se corte el tercero.
    expect(texto).toContain('Actividad 1 de 2026-10');
    expect(texto).toContain('Actividad 3 de 2026-10');
    expect(texto).not.toContain('Actividad 4 de 2026-10');
  });

  it('y la bajada avisa cuando el mes ya pasó', () => {
    expect(bajadaDelMes(pagina('2026-08'))).toContain('ya pasó');
    expect(bajadaDelMes(pagina('2026-10'))).not.toContain('ya pasó');
  });

  it('el aviso del mes vencido tiene texto y salida', () => {
    expect(AVISO_DEL_MES_VENCIDO.trim()).not.toBe('');
    expect(SALIDA_DEL_MES_VENCIDO.trim()).not.toBe('');
  });

  it('y la salida apunta a una página que existe', () => {
    /*
     * **Este aserto era el que había que mirar el día que se construyera
     * `/pasadas`, y ese día llegó** (B-109, cierra B-281). El §2.2 manda el aviso
     * del mes vencido a `/pasadas`; mientras esa página no existía el destino era
     * la home, porque enlazar un 404 en la única salida que ofrece la página
     * vencida es peor que el problema que esa página resuelve.
     *
     * El caso no cambió ni una línea: verifica que el destino sea una ruta que el
     * sitio tiene, así que sostuvo el `/` de antes y sostiene el `/pasadas` de
     * ahora — y falla el día que alguien lo apunte a algo que no existe.
     */
    const paginas = execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const rutas = new Set(
      paginas
        .filter((f) => f.endsWith('.astro') && !f.includes('['))
        .map((f) => f.replace(/^src\/pages/, '').replace(/(\/index)?\.astro$/, '') || '/'),
    );
    expect(rutas).toContain(DESTINO_DEL_MES_VENCIDO);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · La página, y la tira que la enlaza
// ───────────────────────────────────────────────────────────────────────────

/**
 * Lo que no se puede verificar sobre un valor, porque vive en un `.astro`: se
 * verifica leyendo el archivo, como hacen `pagina-de-detalle.test.ts` y
 * `suscribirse.test.ts`.
 */
const PAGINA_DE_MES = 'src/pages/agenda/[mes].astro';
const HOME = 'src/pages/index.astro';

const sinComentarios = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

describe('la página `/agenda/[mes]`', () => {
  const src = () => sinComentarios(fuente(PAGINA_DE_MES));

  it('el barrido encuentra la página', () => {
    // Control positivo: sin esto, un archivo renombrado dejaría todo en verde.
    expect(
      execFileSync('git', ['ls-files', 'src/pages'], { encoding: 'utf8' }),
    ).toContain(PAGINA_DE_MES);
    expect(src().length).toBeGreaterThan(200);
  });

  it('declara la sección «agenda»: es la agenda filtrada, no una sección nueva', () => {
    /*
     * `chrome-del-sitio.test.ts` exige que **haya** una sección; cuál es lo sabe
     * esta página. Una página de mes no entra en la barra (§2.2) pero es una vista
     * de la agenda, así que la barra tiene que marcar «Agenda» — igual que en la
     * página de detalle. Inventar una sección propia agregaría un ítem al menú.
     */
    expect(src()).toMatch(/<Base[^>]*\bseccion="agenda"/s);
  });

  it('el mes vencido sale del índice de los buscadores', () => {
    /*
     * §2.2: «sale del sitemap», y desde B-109 eso es literal —el sitemap sale de
     * `mesesEnlazables`, que deja afuera las vencidas (`tests/sitemap.test.ts`)—.
     * El `noindex` de acá es la otra mitad y no sobra: el sitemap dice qué se
     * ofrece, el `noindex` dice qué no se indexa si alguien llega igual, y a una
     * página vencida se llega con el link que ya tenía.
     *
     * MUTACIÓN PROBADA: sacar el `noIndex` deja a Google indexando una página que
     * dice «este mes ya pasó».
     */
    expect(src()).toMatch(/noIndex=\{pagina\.vencido\}/);
  });

  it('`getStaticPaths` va envuelta y no aliasada — B-237', () => {
    /*
     * Astro llama a `getStaticPaths` con un argumento propio (`{ paginate, rss }`),
     * y con el alias ese objeto cae en el primer parámetro de la función. Es el
     * único bug que encontró el build de verdad en B-227, con 1.600 tests en
     * verde: ningún test unitario lo ve porque todos la llaman bien.
     *
     * MUTACIÓN PROBADA: `export const getStaticPaths = caminosDeMes;` pone esto en
     * rojo, y sin el aserto el build sale con cero páginas de mes.
     */
    expect(src()).toMatch(/getStaticPaths = \(\) =>/);
    expect(src()).not.toMatch(/getStaticPaths = caminosDeMes\s*;/);
  });

  it('no arma ninguna URL a mano', () => {
    /*
     * La ruta de un mes la produce `caminosDeMes` y la linkean tres lugares
     * (`rutasPublicas.ts`). Y ninguna URL **absoluta**: con el dominio ya decidido
     * (B-109), el origen se escribe una sola vez en `SITIO` y la canónica la pone
     * `Base.astro` — una absoluta escrita acá sería la copia que queda vieja, que
     * es lo que `tests/canonico.test.ts` barre para todo `src/`.
     */
    expect(src()).not.toMatch(/https?:\/\//);
    expect(src()).not.toMatch(/["'`]\/agenda\//);
  });

  it('recibe su view-model y no importa el lector de Firestore — D-140', () => {
    /*
     * **Lo pidió el `auditor-privacidad`.** La primera versión recibía la página
     * por props y además hacía `const indice = await indiceDelSitio()` acá para
     * sacar las etiquetas, los matices y los otros meses. No filtraba nada, pero
     * dejaba el índice entero —las actividades publicadas con su `searchText` y
     * su `creadoEn`— al alcance de un `{}` en la plantilla, que es exactamente la
     * puerta de al lado que D-140 cerró para la página de detalle: la garantía
     * dejaba de darla el tipo y pasaba a darla un `grep` en un test.
     *
     * Es el mismo aserto que `pagina-de-detalle.test.ts` hace por lista blanca de
     * imports, y se escribe igual: qué importa del lector, no qué nombres prohíbe.
     *
     * MUTACIÓN PROBADA: agregar `indiceDelSitio` al import de
     * `@/lib/contenidoDelSitio` pone esto en rojo.
     */
    const importados = [
      ...src().matchAll(/import\s+\{([^}]*)\}\s+from\s+'@\/lib\/contenidoDelSitio'/g),
    ].flatMap((m) => m[1]!.split(',').map((x) => x.trim().replace(/^type\s+/, '')));
    expect(importados.length, 'la plantilla dejó de importar el lector').toBeGreaterThan(0);
    expect(
      importados.sort(),
      'la plantilla solo puede traer del lector su `getStaticPaths` y el tipo de su ' +
        'view-model: cualquier otra cosa le pone el índice entero al alcance.',
    ).toEqual(['VistaDeMes', 'caminosDeMes']);
  });

  it('y no le abre los campos a la entrada del índice: la lista blanca es cerrada', () => {
    /*
     * `VistaDeMes` no es un recorte campo por campo como `DetallePublico`: lleva
     * `EntradaDeIndice[]` adentro, porque la fila necesita la entrada entera y ya
     * tiene su propia lista blanca (`listado-del-sitio.test.ts`). O sea que acá la
     * garantía **no la da el tipo**, la da esta lista — y una lista negra de tres
     * nombres no es una garantía: `{e.resumen}` o `{e.creadoEn}` la pasan limpios.
     * Lo señaló el `auditor-privacidad`.
     *
     * Se enumera al revés: **qué puede sacar la plantilla del view-model**, con la
     * exigencia de que `entradas` viaje entera a la lista y no se abra acá.
     *
     * MUTACIÓN PROBADA: agregar `{pagina.entradas[0].resumen}` pone en rojo el
     * segundo aserto; `{vista.generadoEn}` de más, el primero.
     */
    const LO_QUE_LA_PLANTILLA_SACA = {
      vista: ['pagina', 'etiquetas', 'tonos', 'otros', 'generadoEn'],
      pagina: ['clave', 'vencido', 'entradas'],
    };

    const leidosDe = (objeto: string): string[] => {
      const puntos = [...src().matchAll(new RegExp(`\\b${objeto}\\.(\\w+)`, 'g'))].map((m) => m[1]!);
      const desestructurados = [
        ...src().matchAll(new RegExp(`\\{([^}]*)\\}\\s*=\\s*${objeto}\\b`, 'g')),
      ].flatMap((m) => m[1]!.split(',').map((x) => x.trim()).filter(Boolean));
      return [...new Set([...puntos, ...desestructurados])];
    };

    for (const [objeto, permitidos] of Object.entries(LO_QUE_LA_PLANTILLA_SACA)) {
      const leidos = leidosDe(objeto);
      // Control positivo: un barrido que no encuentra nada da la misma lista
      // vacía de sobrantes que una plantilla correcta.
      expect(leidos.length, `el barrido no encontró lecturas de \`${objeto}\``).toBeGreaterThan(1);
      expect(
        leidos.filter((c) => !permitidos.includes(c)),
        `la plantilla saca esto de \`${objeto}\` y no está en la lista. Si el dato ` +
          'necesita una decisión, va en `lib/mesPublico.ts` o en `lib/tarjetaPublica.ts`, ' +
          'que se testean; si no, sumalo acá con el motivo.',
      ).toEqual([]);
    }

    /*
     * Y la mitad que la lista no puede dar: `entradas` viaja entera a la lista y
     * **no se abre**. Sin esto, `pagina.entradas` está en la lista blanca y
     * `pagina.entradas.map((e) => e.searchText)` la cumple.
     */
    expect(src()).toContain('entradas={pagina.entradas}');
    expect(
      src(),
      'la plantilla abre `entradas`: indexarla, recorrerla o desestructurarla ' +
        'esquiva la lista blanca de la fila.',
    ).not.toMatch(/entradas\s*(\[|\.\s*(map|slice|filter|at|forEach|find))/);
    expect(src(), 'desestructurar `entradas` esquiva la lista blanca por el mismo camino').not.toMatch(
      /\{[^}]*\}\s*=\s*(pagina\.)?entradas\b/,
    );
  });
});

describe('la tira de meses de la home — §2.2', () => {
  it('la home enlaza los meses, y solo los enlazables', () => {
    /*
     * Es la única entrada a `/agenda/{aaaa-mm}` que hay hoy: sin ella esas
     * páginas quedan huérfanas, y una página estática sin links internos vale
     * casi nada para un buscador aunque esté en el sitemap.
     *
     * MUTACIÓN PROBADA: cambiar `mesesEnlazables` por `mesesDelSitio` en la home
     * pone esto en rojo — y en la página, un enlace a un mes que ya pasó.
     */
    const src = sinComentarios(fuente(HOME));
    expect(src).toContain('mesesEnlazables');
    expect(src).not.toContain('mesesDelSitio');
    expect(src).toContain('rutaDeMes(m.clave)');
  });

  it('y la ruta la arma `rutasPublicas`, no una plantilla', () => {
    // Un productor y dos consumidores derivando el mismo formato por separado es
    // la clase de B-88, y acá el modo de falla es un 404.
    expect(rutaDeMes('2026-09')).toBe('/agenda/2026-09');
    for (const archivo of [HOME, PAGINA_DE_MES]) {
      expect(sinComentarios(fuente(archivo))).toContain("from '@/lib/rutasPublicas'");
    }
  });
});

describe('la fila cablea el recorte, que es lo que no se puede testear sobre un valor', () => {
  /*
   * Todo lo de arriba prueba que `recorteDelMes` y `cicloDelMes` hacen lo
   * correcto. Lo que ningún valor puede probar es que la **fila los use**: los
   * componentes de este repo no tienen tests de render (`docs/05-patrones.md`),
   * así que una fila que ignore `mes` deja los 37 casos de arriba en verde y la
   * página de octubre mostrando fechas de septiembre.
   *
   * MUTACIÓN PROBADA: borrar el ternario del `estadoDe` de la fila —dejando
   * `estadoDe(entrada, ahora)`— pone en rojo el primer caso y **ninguno** de los
   * de arriba.
   */
  const fila = () => sinComentarios(fuente('src/components/publico/FilaDeActividad.tsx'));
  const lista = () => sinComentarios(fuente('src/components/publico/ListaDeActividades.tsx'));

  it('la fila deriva su estado del recorte cuando le pasan un mes', () => {
    expect(fila()).toMatch(/estadoDe\(mes \? recorteDelMes\(entrada, mes\) : entrada, ahora\)/);
  });

  it('y usa la línea de ciclo del mes, con los dos estados en su lugar', () => {
    /*
     * Los **dos** estados, y en ese orden: el del mes decide las fechas, el de la
     * actividad entera decide cuántos encuentros tiene el ciclo. Pasarle el del
     * mes dos veces es el error natural —está ahí, en una variable— y produce
     * «Ciclo de 4 encuentros» en la página de septiembre cuando son 8.
     *
     * MUTACIÓN PROBADA: `cicloDelMes(entrada, estado, estado, mes)` pone en rojo
     * este caso y **ninguno** de los que miden el valor: los de arriba llaman a la
     * función con los argumentos bien.
     */
    expect(fila()).toMatch(/cicloDelMes\(entrada, estado, estadoDe\(entrada, ahora\), mes\)/);
    expect(fila()).toContain('cicloDeTarjeta(entrada, estado)');
  });

  it('la lista le pasa el mes a cada fila, en sus tres formas', () => {
    /*
     * Las tres formas de la lista arman las filas con el mismo helper: escrito
     * tres veces, el día que la fila gane una prop hay dos que se olvidan, y las
     * tres se ven bien por separado.
     */
    expect((lista().match(/<FilaDeActividad/g) ?? []).length).toBe(1);
    expect(lista()).toContain('mes={mes}');
  });

  it('y la página de mes no agrupa por la próxima sesión', () => {
    /*
     * `agruparPorMes` agrupa por el mes de la **próxima** sesión: en la página de
     * octubre, un ciclo que empezó en septiembre caería bajo un marcador
     * «SEPTIEMBRE». Por eso la rama de `mes` sale antes y pone un solo grupo.
     */
    const conMes = lista().indexOf('if (mes)');
    const agrupa = lista().indexOf('agruparPorMes(');
    expect(conMes, 'la rama de la página de mes no está').toBeGreaterThan(-1);
    expect(conMes).toBeLessThan(agrupa);
  });
});
