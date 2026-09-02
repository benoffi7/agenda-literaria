/**
 * Lo que dice una **fila** del listado — B-247, recortado en B-260.
 *
 * Todo lo de acá es lógica pura sobre el `events.json`: se testea sin DOM, sin
 * emulador y sin testing-library. Es exactamente el motivo de que estas
 * decisiones no vivan adentro del `.tsx` — los componentes de este repo no tienen
 * tests de render (`docs/05-patrones.md`), así que una frase escrita en el
 * componente no se verifica en ninguna parte.
 *
 * El reloj entra como parámetro en todas las funciones (a través de
 * `EstadoDeEntrada`), así que ningún caso depende de qué día es hoy.
 */
import { describe, expect, it } from 'vitest';
import { estadoDe, mapaDeEtiquetas } from '@/lib/listadoPublico';
import {
  arancelDeTarjeta,
  bloqueDeFecha,
  avisoDeTarjeta,
  cicloDeTarjeta,
  enCursoDeTarjeta,
  esSinCosto,
  formasDeCursar,
  lugarDeTarjeta,
} from '@/lib/tarjetaPublica';
import { MODALIDADES } from '@/types/actividad';
import { entradaDePrueba } from './fixtures/indice';

/** Todo lo de este archivo se mide contra este instante. */
const AHORA = new Date('2026-09-10T15:00:00Z');

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [{ slug: 'taller', label: 'Taller' }],
  barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
  arancel: [
    { slug: 'gratis', label: 'Gratis' },
    { slug: 'a-la-gorra', label: 'A la gorra' },
    { slug: 'arancelado', label: 'Arancelado' },
  ],
  plataforma: [{ slug: 'meet', label: 'Google Meet' }],
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · El arancel — «a la gorra» no es un caso raro
// ───────────────────────────────────────────────────────────────────────────

describe('el arancel de la tarjeta', () => {
  it('«a la gorra» cuenta como sin costo igual que «gratis»', () => {
    /*
     * §4.1 del `CLAUDE.md`: «a la gorra» es la mitad de los casos del circuito
     * literario y no entra en el binario gratis/pago. Si no contara como sin
     * costo, la tarjeta lo pintaría con el gris del resto y quedaría escondido
     * entre los datos secundarios.
     *
     * MUTACIÓN PROBADA: sacar `'a-la-gorra'` de `SIN_COSTO` hace fallar esto.
     */
    expect(esSinCosto('a-la-gorra')).toBe(true);
    expect(esSinCosto('gratis')).toBe(true);
    expect(esSinCosto('arancelado')).toBe(false);
    // Un arancel que alguien cree desde «Otro» no se asume gratis.
    expect(esSinCosto('con-beca-parcial')).toBe(false);
  });

  it('la etiqueta sale de /opciones/arancel y no del slug', () => {
    const e = entradaDePrueba({ arancel: 'a-la-gorra' });
    expect(arancelDeTarjeta(e, ETIQUETAS)).toEqual({ texto: 'A la gorra', sinCosto: true });
  });

  it('un arancel sin cargar no imprime una etiqueta inventada', () => {
    // Con `texto: ''` la tarjeta no pinta la línea. Devolver `desSlug('')` o el
    // slug crudo dejaría un renglón vacío o un `''` visible en el pie.
    const e = { ...entradaDePrueba(), arancel: { tipo: '' } };
    expect(arancelDeTarjeta(e, ETIQUETAS).texto).toBe('');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Cuándo
// ───────────────────────────────────────────────────────────────────────────

describe('las formas de cursar', () => {
  it('salen del array y no del escalar derivado (B-224)', () => {
    /*
     * **El aserto que importa de esta sección.** La entrada se arma con las dos
     * filas y después se le pisa el escalar a `'presencial'`: si la función
     * leyera `modalidad`, diría «Presencial» y la tarjeta escondería que también
     * hay una fila virtual.
     *
     * MUTACIÓN PROBADA: cambiar `entrada.modalidades` por `[entrada.modalidad]`
     * en `formasDeCursar` hace fallar este caso (y solo este).
     */
    const e = { ...entradaDePrueba({ modalidades: ['presencial', 'virtual'] }), modalidad: 'presencial' };
    expect(formasDeCursar(e)).toEqual({
      presencial: true,
      virtual: true,
      texto: 'Presencial y virtual',
    });
  });

  it('una fila híbrida es presencial y virtual a la vez', () => {
    const e = entradaDePrueba({ modalidades: ['hibrido'] });
    const formas = formasDeCursar(e);
    expect([formas.presencial, formas.virtual]).toEqual([true, true]);
  });

  it('se cae al escalar solo si el índice viene sin el array', () => {
    // Es la forma que el modelo tenía antes de B-224, y el fixture del gate de
    // build todavía la produce (B-241).
    const e = { ...entradaDePrueba({ modalidades: ['virtual'] }), modalidades: [] };
    expect(formasDeCursar(e).texto).toBe('Virtual');
  });

  it('clasifica TODA modalidad que el productor puede producir (clase de B-88)', () => {
    /*
     * **El aserto que pidió el `auditor-privacidad`.** `lib/modalidades.ts` es el
     * productor del array y del escalar que el índice lleva; esto es el consumidor.
     * El dominio se recorre desde `MODALIDADES` —la constante del productor— y no
     * desde una lista escrita a mano: un cuarto valor de modalidad entra solo, y si
     * este módulo no lo sabe clasificar, falla acá.
     *
     * Sin esto, un valor nuevo se clasificaría como *ni presencial ni virtual*: el
     * chip desaparece y el lugar cae a «Lugar a confirmar» aunque haya sede
     * cargada, sin que nada falle.
     *
     * MUTACIÓN PROBADA: volver a las tres comparaciones escritas a mano y sacarle
     * `'hibrido'` a una de ellas hace fallar esto.
     */
    for (const m of MODALIDADES) {
      const e = { ...entradaDePrueba(), modalidades: [m] };
      const formas = formasDeCursar(e);
      expect(formas.texto, `«${m}» quedó sin nombre`).not.toBe('');
      expect(formas.presencial || formas.virtual, `«${m}» quedó sin clasificar`).toBe(true);
    }
  });

  it('sin ninguna forma cargada no inventa «Presencial»', () => {
    // El default de un `Record` vacío sería `presencial`, que es una afirmación
    // sobre el mundo que nadie hizo.
    const e = { ...entradaDePrueba(), modalidades: [], modalidad: '' };
    expect(formasDeCursar(e)).toEqual({ presencial: false, virtual: false, texto: '' });
  });
});

describe('la línea de lugar', () => {
  it('presencial: sede, barrio con su etiqueta, y ciudad', () => {
    const e = entradaDePrueba({ modalidades: ['presencial'] });
    expect(lugarDeTarjeta(e, ETIQUETAS)).toBe('Casa Brandon · Villa Crespo, CABA');
  });

  it('virtual: la plataforma con su etiqueta y nunca el link', () => {
    const e = entradaDePrueba({ modalidades: ['virtual'] });
    const linea = lugarDeTarjeta(e, ETIQUETAS);
    expect(linea).toBe('Online por Google Meet');
    // El §5.1 y la trampa 5: el link de la reunión no sale a ninguna salida
    // pública. El índice ya no lo lleva, y esto lo deja afirmado del lado del
    // consumidor.
    expect(linea).not.toContain('http');
  });

  it('las dos cosas: la sede, y que además hay online', () => {
    const e = entradaDePrueba({ modalidades: ['presencial', 'virtual'] });
    expect(lugarDeTarjeta(e, ETIQUETAS)).toBe('Casa Brandon · Villa Crespo, CABA · y online');
  });

  it('una presencial sin sede dice «Lugar a confirmar» (§7.7)', () => {
    const e = { ...entradaDePrueba({ modalidades: ['presencial'] }), sede: null };
    expect(lugarDeTarjeta(e, ETIQUETAS)).toBe('Lugar a confirmar');
  });

  it('sin barrio no queda una coma colgada', () => {
    const e = {
      ...entradaDePrueba({ modalidades: ['presencial'] }),
      sede: { nombre: 'Casa Brandon', barrio: '', ciudad: 'CABA' },
    };
    expect(lugarDeTarjeta(e, ETIQUETAS)).toBe('Casa Brandon · CABA');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · El ciclo — no es una fecha, es una cantidad y un arranque
// ───────────────────────────────────────────────────────────────────────────

describe('la línea del ciclo', () => {
  it('un ciclo por empezar dice cuántos encuentros y cuándo arranca', () => {
    // Es la frase del pedido: «4 encuentros, empieza el 9 de septiembre».
    const e = entradaDePrueba({
      esCiclo: true,
      fechas: [
        '2026-09-17T22:00:00Z',
        '2026-09-24T22:00:00Z',
        '2026-10-01T22:00:00Z',
        '2026-10-08T22:00:00Z',
      ],
    });
    expect(cicloDeTarjeta(e, estadoDe(e, AHORA))).toBe(
      'Ciclo de 4 encuentros · empieza el 17 de septiembre',
    );
  });

  it('un ciclo ya arrancado dice «empezó», no «empieza» (§7.2)', () => {
    /*
     * **El aserto que importa.** Decir «empieza el 3 de septiembre» el 10 de
     * septiembre es información falsa, y es el modo de falla garantizado de un
     * texto armado en el build: el HTML no se rehace hasta el rebuild siguiente.
     *
     * MUTACIÓN PROBADA: devolver siempre la rama «empieza» hace fallar este caso
     * y el de abajo, y ninguno de los otros.
     */
    const e = entradaDePrueba({
      esCiclo: true,
      fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z'],
    });
    expect(cicloDeTarjeta(e, estadoDe(e, AHORA))).toBe(
      'Ciclo de 2 encuentros · empezó el 3 de septiembre',
    );
  });

  it('un ciclo terminado dice cuándo terminó', () => {
    const e = entradaDePrueba({
      esCiclo: true,
      fechas: ['2026-08-03T22:00:00Z', '2026-08-17T22:00:00Z'],
    });
    expect(cicloDeTarjeta(e, estadoDe(e, AHORA))).toBe(
      'Ciclo de 2 encuentros · terminó el 17 de agosto',
    );
  });

  it('varios encuentros sin ser ciclo se cuentan, pero sin llamarlos ciclo', () => {
    // `esCiclo` es lo que quien carga declaró; la cantidad es un hecho de las
    // sesiones. Se dicen los dos, y no se inventa el primero desde el segundo.
    const e = entradaDePrueba({ fechas: ['2026-09-17T22:00:00Z', '2026-09-24T22:00:00Z'] });
    expect(cicloDeTarjeta(e, estadoDe(e, AHORA))).toBe('2 encuentros · empieza el 17 de septiembre');
  });

  it('un encuentro suelto no imprime la línea', () => {
    const e = entradaDePrueba({ fechas: ['2026-09-24T22:00:00Z'] });
    expect(cicloDeTarjeta(e, estadoDe(e, AHORA))).toBeNull();
  });

  it('un ciclo declarado con un solo encuentro sí la imprime, en singular', () => {
    /*
     * El fixture de una sola sesión es el que dejó pasar B-84
     * (`tests/fixtures/ciclo.ts`): un ciclo puede quedar con un encuentro porque
     * se cancelaron los otros, y la tarjeta tiene que seguir diciendo que es un
     * ciclo. «Ciclo de 1 encuentros» se lee como un error de software.
     */
    const e = entradaDePrueba({ esCiclo: true, fechas: ['2026-09-24T22:00:00Z'] });
    expect(cicloDeTarjeta(e, estadoDe(e, AHORA))).toBe(
      'Ciclo de 1 encuentro · empieza el 24 de septiembre',
    );
  });

  it('sin ninguna sesión no hay línea que escribir', () => {
    const e = { ...entradaDePrueba(), sesiones: [], esCiclo: true };
    expect(cicloDeTarjeta(e, estadoDe(e, AHORA))).toBeNull();
  });
});

describe('«ya empezó — se puede entrar»', () => {
  it('aparece con el ciclo en curso y la inscripción abierta', () => {
    const e = entradaDePrueba({
      fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z'],
      cierra: '2026-09-30T22:00:00Z',
    });
    expect(enCursoDeTarjeta(estadoDe(e, AHORA))).toBe('Ya empezó — se puede entrar');
  });

  it('NO aparece si la inscripción ya cerró', () => {
    /*
     * §7.2 — no hay campo «acepta incorporaciones tardías». Con la inscripción
     * cerrada, decir «se puede entrar» es inventarlo.
     *
     * MUTACIÓN PROBADA: sacar `&& !estado.inscripcionCerrada` hace fallar esto.
     */
    const e = entradaDePrueba({
      fechas: ['2026-09-03T22:00:00Z', '2026-09-17T22:00:00Z'],
      cierra: '2026-09-01T22:00:00Z',
    });
    expect(enCursoDeTarjeta(estadoDe(e, AHORA))).toBeNull();
  });

  it('NO aparece si todavía no empezó', () => {
    const e = entradaDePrueba({ fechas: ['2026-09-17T22:00:00Z'] });
    expect(enCursoDeTarjeta(estadoDe(e, AHORA))).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · La inscripción — el orden es la decisión
// ───────────────────────────────────────────────────────────────────────────

describe('el aviso de inscripción', () => {
  const aviso = (o: Parameters<typeof entradaDePrueba>[0]) => {
    const e = entradaDePrueba(o);
    return avisoDeTarjeta(e, estadoDe(e, AHORA));
  };

  it('sin inscripción, no se habla de inscribirse', () => {
    expect(aviso({ requiereInscripcion: false })).toEqual({
      texto: 'Entrada libre, sin inscripción',
      tono: 'apagado',
    });
  });

  it('cerrada frena, y frena antes que el cupo completo', () => {
    /*
     * **El orden es el aserto.** Cuando las dos cosas son ciertas, «consultá por
     * lista de espera» invita a una acción que ya no tiene a dónde ir.
     *
     * MUTACIÓN PROBADA: invertir las dos ramas hace fallar este caso, y ninguno
     * de los otros dos de abajo — que es la prueba de que el test mira el orden
     * y no cada frase por separado.
     */
    expect(
      aviso({ cierra: '2026-09-01T22:00:00Z', completo: true, fechas: ['2026-09-24T22:00:00Z'] }),
    ).toEqual({ texto: 'Las inscripciones cerraron', tono: 'alerta' });
  });

  it('cupo completo, con la inscripción abierta, ofrece la lista de espera', () => {
    expect(aviso({ completo: true, fechas: ['2026-09-24T22:00:00Z'] })).toEqual({
      texto: 'Cupo completo · consultá por lista de espera',
      tono: 'alerta',
    });
  });

  it('con fecha de cierre dice hasta cuándo', () => {
    expect(aviso({ cierra: '2026-09-20T22:00:00Z' })).toEqual({
      texto: 'Anotate antes del 20 de septiembre',
      tono: 'apagado',
    });
  });

  it('el cupo se dice como total, nunca como lugares que quedan', () => {
    // §4.2 — no sabemos cuántas inscripciones hay. «Quedan 3 lugares» sería un
    // dato que el modelo no tiene.
    const r = aviso({ cupo: 12 });
    expect(r!.texto).toBe('Inscripción abierta · cupo 12');
    expect(r!.texto).not.toMatch(/quedan|lugares/i);
  });

  it('sin cupo no se inventa «cupos limitados»', () => {
    expect(aviso({})).toEqual({ texto: 'Inscripción abierta', tono: 'apagado' });
  });

  it('lo que ya pasó NO tiene línea de inscripción — B-290', () => {
    /*
     * **El bug que `/pasadas` puso a la vista.** Un taller que terminó y que no
     * tiene fecha de cierre cargada caía en el default y la fila decía
     * «Inscripción abierta»: es el modo de falla que el §7.1 nombra con estas
     * palabras —«`abierta` solo mira `cierra`: sin fecha de cierre queda
     * `abierta: true` para siempre y mostraría *Anotate* en un taller de hace un
     * año»— y que la página de detalle ya evitaba decidiendo el CTA por fecha.
     *
     * Y no lo trajo `/pasadas`: la fila de una pasada ya se renderizaba en la
     * página de un mes vencido (B-113) y con el filtro «Cuándo» en un mes que
     * pasó. `/pasadas` es una página entera de estas filas, así que lo puso a la
     * vista.
     *
     * MUTACIÓN PROBADA: sacar la rama de `paso` deja los otros seis casos de este
     * `describe` en verde y este en rojo, diciendo «Inscripción abierta».
     */
    expect(aviso({ fechas: ['2026-05-10T22:00:00Z'], cierra: null })).toBeNull();
    // Y tampoco con el cupo completo o la inscripción cerrada: ninguna de las
    // tres frases dice algo cierto de algo que ya terminó.
    expect(aviso({ fechas: ['2026-05-10T22:00:00Z'], completo: true })).toBeNull();
    expect(
      aviso({ fechas: ['2026-05-10T22:00:00Z'], cierra: '2026-05-01T22:00:00Z' }),
    ).toBeNull();
    // Control: la misma actividad con fecha futura sí la tiene.
    expect(aviso({ fechas: ['2026-09-24T22:00:00Z'], cierra: null })).not.toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · El bloque de fecha — B-260
// ───────────────────────────────────────────────────────────────────────────

describe('el bloque de fecha', () => {
  /*
   * Es el gesto central del sistema visual y el dato más grande de la fila, así
   * que lo que se verifica no es el formato sino **la forma**: que las tres piezas
   * lleguen separadas y que el caso «ya pasó» no se pueda leer como si tuviera
   * fecha.
   */
  it('devuelve el día, el día de la semana y el mes por separado', () => {
    const e = entradaDePrueba({ fechas: ['2026-09-24T22:00:00.000Z'] });
    const b = bloqueDeFecha(estadoDe(e, AHORA));
    expect(b.paso).toBe(false);
    if (b.paso) return;
    // 22:00 UTC es el 24 a las 19:00 en Buenos Aires. Si el bloque leyera el
    // reloj de quien mira en vez de la zona del proyecto, en Madrid diría 25.
    expect(b.dia).toBe('24');
    expect(b.diaSemana).toBe('jue');
    expect(b.mes).toBe('sep');
    expect(b.hora).toBe('19:00');
  });

  it('septiembre se abrevia igual que en el resto del sitio', () => {
    /*
     * `es-AR` devuelve `sept` —el único mes de cuatro letras— y en un rectángulo
     * de 56px eso desalinea la única fila del año que lo tenga. `fechaCorta` ya lo
     * recortaba; esto afirma que el bloque no volvió a inventar su propia
     * abreviatura, que es la clase de B-88.
     *
     * MUTACIÓN PROBADA: sacar el `.replace(/\bsept\b/, 'sep')` de `partesDeFecha`
     * hace fallar este caso y solo éste.
     */
    const e = entradaDePrueba({ fechas: ['2026-09-24T22:00:00.000Z'] });
    const b = bloqueDeFecha(estadoDe(e, AHORA));
    if (b.paso) throw new Error('debería tener fecha');
    expect(b.mes).toBe('sep');
    expect(b.mes.length).toBeLessThanOrEqual(3);
  });

  it('el día de la semana viene sin el punto de la abreviatura', () => {
    // `es-AR` devuelve `jue.`; en versalitas el punto es una mancha.
    const e = entradaDePrueba({ fechas: ['2026-10-05T22:00:00.000Z'] });
    const b = bloqueDeFecha(estadoDe(e, AHORA));
    if (b.paso) throw new Error('debería tener fecha');
    expect(b.diaSemana).not.toContain('.');
    expect(b.mes).not.toContain('.');
  });

  it('sin fecha por venir devuelve el caso «pasó», y no un día vacío', () => {
    /*
     * **El aserto que justifica el discriminante.** Con un `dia: string | null`,
     * cada consumidor tiene que acordarse de chequearlo, y el que se olvide pinta
     * un bloque de fecha vacío en producción — un rectángulo de tinta plena sin
     * nada adentro, que es peor que no ponerlo.
     *
     * MUTACIÓN PROBADA: devolver `{ paso: false, dia: '', ... }` en vez del caso
     * `paso` deja de compilar en `FilaDeActividad`, que es el punto.
     */
    const e = entradaDePrueba({ fechas: ['2026-01-05T22:00:00.000Z'] });
    const b = bloqueDeFecha(estadoDe(e, AHORA));
    expect(b.paso).toBe(true);
    if (!b.paso) return;
    expect(b.texto).toBeTruthy();
  });
});
