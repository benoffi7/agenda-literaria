/**
 * Lo que dice una tarjeta del listado, y cómo se dibuja su portada — B-247.
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
import { TIPOS_CON_TONO, tonoDeTipo } from '@/lib/identidad';
import {
  RENGLONES_MIN,
  arancelDeTarjeta,
  avisoDeTarjeta,
  cicloDeTarjeta,
  cuandoDeTarjeta,
  enCursoDeTarjeta,
  escalaDePortada,
  esSinCosto,
  formasDeCursar,
  lugarDeTarjeta,
  renglonesDePortada,
} from '@/lib/tarjetaPublica';
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

describe('la línea de fecha', () => {
  it('dice el día y la hora de la próxima sesión, en la zona del proyecto', () => {
    const e = entradaDePrueba({ fechas: ['2026-09-24T22:00:00Z'] });
    const cuando = cuandoDeTarjeta(estadoDe(e, AHORA));
    // 22:00 UTC son las 19:00 en Buenos Aires: la trampa 1 del lado del frontend.
    expect(cuando.texto).toBe('jue 24 sep · 19:00');
    expect(cuando.iso).toBe('2026-09-24T22:00:00.000Z');
    expect(cuando.paso).toBe(false);
  });

  it('sin nada por venir dice «Ya pasó» y no marca ninguna fecha', () => {
    const e = entradaDePrueba({ fechas: ['2026-08-01T22:00:00Z'] });
    const cuando = cuandoDeTarjeta(estadoDe(e, AHORA));
    expect(cuando.texto).toBe('Ya pasó');
    // Sin `iso` el componente no emite un `<time datetime>` con una fecha que ya
    // no es la de la actividad.
    expect(cuando.iso).toBeNull();
    expect(cuando.paso).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Dónde y cómo se cursa — se lee de `modalidades[]`, no del escalar
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
    expect(r.texto).toBe('Inscripción abierta · cupo 12');
    expect(r.texto).not.toMatch(/quedan|lugares/i);
  });

  it('sin cupo no se inventa «cupos limitados»', () => {
    expect(aviso({})).toEqual({ texto: 'Inscripción abierta', tono: 'apagado' });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · La portada generada
// ───────────────────────────────────────────────────────────────────────────

/**
 * Un título de exactamente `n` caracteres, en palabras de tres letras.
 *
 * El último carácter nunca es un espacio: `escalaDePortada` hace `trim()`, así que
 * un título terminado en espacio mediría uno menos y el test estaría comprobando
 * el corte de al lado.
 */
const tituloDe = (n: number): string => {
  const bruto = 'abc '.repeat(40).slice(0, n);
  return bruto.endsWith(' ') ? `${bruto.slice(0, -1)}x` : bruto;
};

describe('la escala del título en la portada generada', () => {
  it('una palabra corta va en cuerpo de sello', () => {
    // Con el cuerpo de un título largo, «Cronopios» queda perdido en el medio del
    // rectángulo y la portada se lee como un error de maquetación.
    expect(escalaDePortada('Cronopios')).toBe('sello');
    expect(escalaDePortada('  Micrófono  ')).toBe('sello');
  });

  it('una sola palabra larga NO va en sello: no entraría', () => {
    // MUTACIÓN PROBADA: sacar la condición de largo de la rama `sello` hace que
    // este caso devuelva 'sello'.
    expect(escalaDePortada('Antropologismos')).toBe('grande');
  });

  it('dos palabras cortas no son un sello aunque midan poco', () => {
    expect(escalaDePortada('Voz alta')).toBe('grande');
  });

  it('los cortes de largo están donde dicen estar', () => {
    /*
     * Se afirman los dos lados de cada corte. Un test de un solo lado pasa igual
     * con el umbral movido en uno, que es la mutación más fácil de dejar sin ver.
     *
     * MUTACIÓN PROBADA: mover `<= 26` a `<= 27` hace fallar el segundo par.
     */
    expect(escalaDePortada(tituloDe(26))).toBe('grande');
    expect(escalaDePortada(tituloDe(27))).toBe('media');
    expect(escalaDePortada(tituloDe(64))).toBe('media');
    expect(escalaDePortada(tituloDe(65))).toBe('chica');
  });

  it('los espacios de más no cambian la escala', () => {
    // Un título tipeado con dos espacios entre palabras mediría más y bajaría de
    // escala por un dato que no se ve en pantalla.
    expect(escalaDePortada('Taller   de    crónica')).toBe(escalaDePortada('Taller de crónica'));
  });

  it('un título vacío no rompe', () => {
    expect(escalaDePortada('')).toBe('sello');
  });
});

describe('el motivo de renglones de la portada', () => {
  const slugs = [...TIPOS_CON_TONO, 'microrrelato-en-voz-alta', 'zzz', 'a', 'club'];

  it('es el mismo siempre para el mismo tipo', () => {
    // Si cambiara entre renders, el HTML del build y el de la island dibujarían
    // portadas distintas para la misma actividad y se vería como un parpadeo.
    for (const s of slugs) expect(renglonesDePortada(s)).toEqual(renglonesDePortada(s));
  });

  it('se siembra con el tono del tipo y no con un hash nuevo', () => {
    /*
     * Dos derivaciones de «qué le toca a este slug» se separan sin que nada falle
     * (clase de B-88). Acá se afirma que hay una sola: dos slugs con el mismo tono
     * tienen el mismo motivo.
     */
    const conMismoTono = slugs.filter((s) => tonoDeTipo(s) === tonoDeTipo('taller'));
    for (const s of conMismoTono) {
      expect(renglonesDePortada(s)).toEqual(renglonesDePortada('taller'));
    }
    // Control positivo del propio aserto: hay al menos un tipo en la lista.
    expect(conMismoTono).toContain('taller');
  });

  it('tiene entre 3 y 5 renglones, y todos con ancho visible', () => {
    for (const s of slugs) {
      const r = renglonesDePortada(s);
      expect(r.length, s).toBeGreaterThanOrEqual(RENGLONES_MIN);
      expect(r.length, s).toBeLessThanOrEqual(RENGLONES_MIN + 2);
      for (const ancho of r) {
        expect(ancho, `${s}: ${ancho}%`).toBeGreaterThan(0);
        expect(ancho, `${s}: ${ancho}%`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('el último renglón es siempre el más corto', () => {
    /*
     * **Es lo que hace que se lea como un párrafo que termina** y no como un
     * gráfico de barras: tres líneas parejas parecen datos.
     *
     * MUTACIÓN PROBADA: sacar el factor del último renglón hace fallar esto para
     * todos los tipos.
     */
    for (const s of slugs) {
      const r = renglonesDePortada(s);
      const ultimo = r[r.length - 1]!;
      for (const otro of r.slice(0, -1)) expect(ultimo, s).toBeLessThan(otro);
    }
  });

  it('un tipo que nadie escribió todavía igual tiene motivo', () => {
    // `tipo` es taxonomía autogestionada (§4): el octavo tipo lo crea quien carga
    // desde «Otro», y su portada no puede salir en blanco.
    expect(renglonesDePortada('feria-de-fanzines-2027').length).toBeGreaterThanOrEqual(
      RENGLONES_MIN,
    );
  });
});
