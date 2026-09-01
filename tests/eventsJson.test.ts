import { describe, expect, it } from 'vitest';
import { LARGO_RESUMEN, construirIndice, entradaDeIndice, resumenDe } from '@/lib/eventsJson';
import { toPublic } from '@/lib/toPublic';
import { CENTINELA, actividadCentinela, opcionCentinela } from './fixtures/centinelas';
import { ts } from './fixtures/tiempo';

/**
 * `/events.json` — el índice del listado — B-106.
 *
 * Acá está el **recorte**: qué necesita el listado, que es menos que lo que
 * `toPublic` permite publicar (§3.1 del diseño). La frontera de privacidad se
 * verifica en `toPublic.test.ts` y en el barrido de centinelas; esto verifica que
 * el índice no lleve de más ni de menos para lo que tiene que hacer.
 */

const publica = () => toPublic(actividadCentinela(), 'act_centinela');

describe('el resumen se corta en palabra, no en carácter', () => {
  it('una descripción corta pasa tal cual, sin puntos suspensivos', () => {
    expect(resumenDe('Ocho encuentros los martes.')).toBe('Ocho encuentros los martes.');
  });

  it('colapsa espacios y saltos de línea', () => {
    // La descripción es un textarea: trae saltos y espacios dobles, y eso en una
    // tarjeta o en un `meta description` se ve como un error de software.
    expect(resumenDe('Ocho\n\nencuentros   los\tmartes')).toBe('Ocho encuentros los martes');
  });

  it('corta en el último espacio y no parte la última palabra', () => {
    const larga = `${'palabra '.repeat(40)}final`;
    const r = resumenDe(larga);
    expect(r.length).toBeLessThanOrEqual(LARGO_RESUMEN + 1);
    expect(r.endsWith('…')).toBe(true);
    // Lo que importa: la última palabra antes de los puntos está completa.
    expect(r.slice(0, -1).trimEnd().endsWith('palabra')).toBe(true);
  });

  it('sin espacios donde cortar, corta duro en vez de devolver todo', () => {
    // Una URL pegada de 300 caracteres: preferimos romper la palabra a romper la
    // promesa del largo, que es lo que después desborda la tarjeta.
    const sinEspacios = 'a'.repeat(300);
    const r = resumenDe(sinEspacios);
    expect(r).toHaveLength(LARGO_RESUMEN + 1);
  });

  it('no deja un signo de puntuación colgado antes de los puntos', () => {
    const r = resumenDe(`${'palabra '.repeat(19)}coma, ${'x'.repeat(200)}`);
    expect(r).not.toContain(',…');
  });
});

describe('la entrada del índice recorta lo que el listado no usa (§3.1)', () => {
  it('no lleva ninguno de los nueve campos que quedan en el detalle', () => {
    /*
     * La lista del §3.1, afirmada como **ausencia de la clave** y no buscando un
     * valor: un `undefined` en la salida se serializa afuera del JSON, así que
     * comparar contra el texto daría verde con la clave presente y vacía.
     */
    const e = entradaDeIndice(publica());
    const json = JSON.stringify(e);

    for (const clave of ['descripcion', 'material', 'destino', 'direccion', 'geo', 'indicaciones']) {
      expect(json, `el índice no lleva \`${clave}\``).not.toContain(`"${clave}"`);
    }
    // Y los tres que viven adentro de un sub-objeto.
    expect(Object.keys(e.sede!).sort()).toEqual(['barrio', 'ciudad', 'nombre']);
    expect(json).not.toContain('"tema"');
    expect(json).not.toContain('"lectura"');
    expect(json).not.toContain('"bio"');
  });

  it('el mail de inscripción no viaja en el índice, aunque sea público en el detalle', () => {
    /*
     * La razón número uno del recorte, y no es privacidad: `inscripcion.destino`
     * **es** público (sale en el HTML del detalle). Lo que cambia es que servirlo
     * en el índice lo entrega **en lote y en un solo GET**, y esa diferencia es la
     * que decide si un bot lo cosecha (§5.1 advierte justo sobre esto).
     */
    const json = JSON.stringify(entradaDeIndice(publica()));
    expect(json).not.toContain(CENTINELA['inscripcion.destino']);
    // Control: el dato sí está del otro lado de la frontera, o este test estaría
    // celebrando que se perdió un campo.
    expect(JSON.stringify(publica())).toContain(CENTINELA['inscripcion.destino']);
  });

  it('organizador y tallerista son strings, no objetos', () => {
    const e = entradaDeIndice(publica());
    expect(typeof e.organizador).toBe('string');
    expect(e.organizador).toBe(CENTINELA['organizador.nombre']);
    expect(e.tallerista).toBe(CENTINELA['tallerista.nombre']);
    // El Instagram y la web son del detalle: si viajaran, el índice serviría en
    // lote los handles de terceros.
    const json = JSON.stringify(e);
    expect(json).not.toContain(CENTINELA['organizador.instagram']);
    expect(json).not.toContain(CENTINELA['tallerista.instagram']);
  });

  it('sin tallerista queda null y no un objeto vacío', () => {
    const sin = toPublic(actividadCentinela({ tallerista: null }), 'act_sin');
    expect(entradaDeIndice(sin).tallerista).toBeNull();
  });

  it('el resumen es un RECORTE, no la descripción entera (§3.1)', () => {
    /*
     * `resumenDe` está probado en aislamiento más arriba, pero eso no dice que el
     * índice la use: cambiar la línea a `resumen: a.descripcion` deja todo lo
     * demás en verde. El test de ausencia busca la **clave** `"descripcion"` —que
     * sigue sin existir, la clave es `resumen`— y el barrido permite el centinela
     * de `descripcion` justamente porque el resumen lo contiene.
     *
     * O sea: la promesa de «~160 caracteres» del §5.1 no estaba fijada donde se
     * produce. Es la que evita mandar la descripción dos veces (una en `resumen`
     * y otra, normalizada, en `searchText`), que es la razón de peso del recorte.
     */
    const larga = `${'palabra '.repeat(40)}final`;
    expect(larga.length).toBeGreaterThan(LARGO_RESUMEN);

    const e = entradaDeIndice(toPublic(actividadCentinela({ descripcion: larga }), 'act_larga'));
    expect(e.resumen).not.toBe(larga);
    expect(e.resumen.length).toBeLessThanOrEqual(LARGO_RESUMEN + 1);
    expect(e.resumen.endsWith('…')).toBe(true);
  });

  it('el link de la reunión no entra al índice NI con urlPublica en true (§5.1, trampa 5)', () => {
    /*
     * D-15 permite publicar el link en las salidas 1 y 2 con el flag prendido, y
     * el índice **es parte** de la salida 1. Pero el listado no lo usa: la tarjeta
     * no tiene botón «Unirse», eso es del detalle.
     *
     * Sin este test la celda quedaba decidida por omisión —`entradaDeIndice` toma
     * `plataforma` y nada más, pero nadie lo había decidido—, y agregarla cuando
     * B-105 pinte la tarjeta iba a ser una línea que no frena nada. Servir los
     * links de reunión **en lote y en un solo GET** es la forma de la trampa 5
     * que más barata le sale a un bot.
     */
    const abierta = toPublic(
      actividadCentinela({
        online: {
          plataforma: CENTINELA['online.plataforma'],
          url: CENTINELA['online.url'],
          urlPublica: true,
        },
      }),
      'act_abierta',
    );
    // Control: del otro lado de la frontera el link SÍ está (D-15), o esto
    // estaría celebrando que se perdió un campo.
    expect(JSON.stringify(abierta)).toContain(CENTINELA['online.url']);
    expect(JSON.stringify(entradaDeIndice(abierta))).not.toContain(CENTINELA['online.url']);
  });
});

describe('lo que el índice sí resuelve, para que no lo resuelva cada consumidor', () => {
  it('ordena las sesiones por inicio', () => {
    /*
     * El array del documento no garantiza orden: el formulario permite agregar
     * filas en cualquier orden. Ordenar una vez en el build es lo que evita que
     * el consumidor que se olvide muestre «Encuentro 3» antes que «Encuentro 1»
     * sin que nada falle.
     */
    const desordenada = actividadCentinela({
      sesiones: [
        { id: 'ses_b', inicio: ts('2026-10-01T22:00:00Z'), fin: ts('2026-10-02T00:00:00Z'), tema: null, lectura: null, cancelada: false, calendarEventId: null },
        { id: 'ses_a', inicio: ts('2026-09-01T22:00:00Z'), fin: ts('2026-09-02T00:00:00Z'), tema: null, lectura: null, cancelada: false, calendarEventId: null },
      ],
    });
    const e = entradaDeIndice(toPublic(desordenada, 'act_orden'));
    expect(e.sesiones.map((s) => s.inicio)).toEqual([
      '2026-09-01T22:00:00.000Z',
      '2026-10-01T22:00:00.000Z',
    ]);
  });

  it('la imagen es la portada de la galería, no la primera de la lista', () => {
    // D-125 — `portada` es un flag explícito y no «la primera»: elegir cuál es
    // una decisión del modelo, no del consumidor.
    const e = entradaDeIndice(publica());
    expect(e.imagenUrl).toBe(CENTINELA['imagenes.url']);
  });

  it('sin imágenes, imagenUrl es null', () => {
    const sin = toPublic(actividadCentinela({ imagenes: [] }), 'act_sin_img');
    expect(entradaDeIndice(sin).imagenUrl).toBeNull();
  });

  it('lleva el ISO del cierre y no el booleano congelado del build — B-111', () => {
    /*
     * `abierta` se calcula con el reloj del build. El índice manda la fecha para
     * que el listado la recalcule con el reloj de quien mira: sin esto, una
     * inscripción que cerró a la mañana sigue diciendo «abierta» hasta el
     * rebuild siguiente.
     */
    const e = entradaDeIndice(publica());
    expect(e.inscripcion.cierraEn).toBe('2026-09-01T12:00:00.000Z');
    expect(JSON.stringify(e)).not.toContain('"abierta"');
  });

  it('lleva la fecha de alta, que es la clave del orden «Recién agregadas» — D-138', () => {
    /*
     * B-227. Es el único campo que el índice ganó con el sitio público, y el
     * barrido de centinelas no lo puede ver (un `Timestamp` no lleva centinela
     * adentro): sin este caso, sacarlo dejaría el orden ordenando por `undefined`
     * —o sea, sin ordenar— y toda la suite en verde.
     */
    // Con precisión de **día**: publicar el instante exacto de cada carga dibuja
    // la agenda de trabajo del dueño, y el orden no lo necesita (D-138).
    expect(entradaDeIndice(publica()).creadoEn).toBe('2026-08-01');
  });

  it('y NO lleva la fecha de la última edición', () => {
    // La otra mitad de D-138: se publica cuándo se cargó, no cuándo se tocó por
    // última vez. El fixture las tiene distintas justamente para poder afirmarlo.
    expect(JSON.stringify(entradaDeIndice(publica()))).not.toContain('2026-08-02');
  });
});

describe('el archivo entero (§4.4)', () => {
  const indice = () =>
    construirIndice({
      actividades: [publica()],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.2.3+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });

  it('lleva las opciones en el mismo archivo, para que los chips no cableen nada', () => {
    // §4.4 — al agregar una etiqueta aparece sola en los filtros. Es también el
    // motivo por el que el rebuild se dispara al cambiar `/opciones/*` (trampa 8).
    expect(indice().opciones.arancel).toEqual([
      // El `tono` sale del fixture, que lo trae desde D-150: el índice no lo
      // agrega ni lo saca, pasa lo que `opcionesPublicas` proyecta.
      { slug: CENTINELA['opcion.slug'], label: CENTINELA['opcion.label'], tono: 195 },
    ]);
  });

  it('las opciones pasan por la whitelist: la huella del creador no viaja', () => {
    // No reimplementa el recorte: usa `opcionesPublicas` (B-212). Si algún día
    // lo hiciera por su cuenta, serían dos decisiones sobre lo mismo.
    expect(JSON.stringify(indice())).not.toContain(CENTINELA['opcion.huellaCreador']);
  });

  it('estampa la versión del build, para saber de qué build salió un archivo', () => {
    expect(indice().version).toBe('1.2.3+abc1234');
    expect(indice().generadoEn).toBe('2026-08-27T00:00:00.000Z');
  });

  it('sin actividades el archivo es válido y no explota', () => {
    // Es el caso del build local sin credenciales (D-123): tiene que producir un
    // archivo bien formado con lista vacía, no un `undefined`.
    const vacio = construirIndice({
      actividades: [],
      opciones: {},
      version: '0.0.0',
      generadoEn: '2026-01-01T00:00:00.000Z',
    });
    expect(vacio.actividades).toEqual([]);
    expect(vacio.opciones).toEqual({});
  });
});
