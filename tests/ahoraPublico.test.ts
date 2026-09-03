import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { TOPE_DEL_PANEL, panelesDeAhora, ventanasDeAhora } from '@/lib/ahoraPublico';
import { CLASES_DEL_TRIPTICO } from '@/components/sitio/estilos';
import { construirIndice, type Indice } from '@/lib/eventsJson';
import { claveDeDia, diaDeSemana, fechaCortaDeDia, hora } from '@/lib/fechasPublicas';
import { etiquetaDe, mapaDeEtiquetas } from '@/lib/listadoPublico';
import { rutaDeDetalle } from '@/lib/rutasPublicas';
import { arancelDeTarjeta, lugarDeTarjeta } from '@/lib/tarjetaPublica';
import { toPublic } from '@/lib/toPublic';
import { actividadDePrueba, type OpcionesDeEntrada } from './fixtures/indice';

/**
 * «¿Qué hay ahora?» — el tríptico de programación inmediata de la home (B-600).
 *
 * ── Qué se puede romper acá, que no es que se rompa ───────────────────────
 * Nada de lo que este módulo hace mal deja el build en rojo, y **todo produce
 * un tríptico que se ve perfecto**:
 *
 * 1. **La resta del tercer panel.** Sin ella, un viernes el sábado sale en
 *    «Mañana» y otra vez en «Este finde», dos columnas pegadas del mismo
 *    tríptico. Se ve bien, y se lee como un error de software.
 * 2. **El rótulo del finde.** Llamar «este finde» a un sábado que falta una
 *    semana es información falsa, y es exactamente lo que pasa un sábado o un
 *    domingo si el rótulo se decide por la distancia en días.
 * 3. **La zona horaria (trampa 1).** Un encuentro a las 00:30 de Buenos Aires
 *    es el día anterior en UTC: con `getDate()`/`getDay()` en vez de las
 *    primitivas de `fechasPublicas`, el encuentro cae en un panel que no es el
 *    suyo y el fin de semana arranca un día antes. Es el modo de falla que
 *    depende de cómo esté configurada la máquina que mira.
 * 4. **«Lo que queda de hoy».** Ofrecer a las nueve de la noche un taller que
 *    empezó a las siete no rompe nada: manda gente a una puerta cerrada.
 * 5. **El pie del tope.** Un «+1 más hoy» sin ningún quinto encuentro es una
 *    promesa que la página no puede cumplir, y el listado de abajo la desmiente.
 *
 * ── El reloj entra como parámetro ─────────────────────────────────────────
 * Todas las funciones reciben el `ahora`, así que ningún caso depende de qué día
 * es hoy. La semana de referencia es la del **lunes 14 de septiembre de 2026**
 * (el `describe` de control positivo lo verifica antes que nada).
 *
 * ── El fixture pasa por las proyecciones de verdad ────────────────────────
 * El índice se arma con `construirIndice({ actividades: [toPublic(...)] })`, así
 * que el **eje plano de encuentros lo calcula el generador de verdad** (B-99) y
 * no un objeto literal: un cambio en cómo se derivan los `{slug, sesionId,
 * inicio}` se ve acá en vez de quedar tapado por un fixture escrito a mano. Es
 * el mismo criterio de `tests/fixtures/indice.ts`.
 */

/** Las etiquetas de taxonomía, como llegan en el propio `events.json` (§4.4). */
const ETIQUETAS = mapaDeEtiquetas({
  tipo: [
    { slug: 'taller', label: 'Taller' },
    { slug: 'club-lectura', label: 'Club de lectura' },
  ],
  barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
  arancel: [
    { slug: 'a-la-gorra', label: 'A la gorra' },
    { slug: 'arancelado', label: 'Arancelado' },
  ],
  plataforma: [{ slug: 'meet', label: 'Google Meet' }],
});

/** Bien antes de cualquier fecha de estos casos: el eje no recorta nada. */
const GENERADO_EN = '2026-09-01T00:00:00.000Z';

/**
 * El índice, pasado por las dos proyecciones reales.
 *
 * `opciones` va vacío a propósito: las etiquetas de estos casos entran por
 * `ETIQUETAS`, que es lo que el módulo recibe. Lo que sí importa que sea real es
 * `encuentros`, y eso lo produce `construirIndice`.
 */
const indiceDePrueba = (
  actividades: readonly OpcionesDeEntrada[],
  generadoEn: string = GENERADO_EN,
): Indice =>
  construirIndice({
    actividades: actividades.map((o, i) =>
      toPublic(actividadDePrueba(o), o.id ?? o.slug ?? `act_${i}`),
    ),
    opciones: {},
    version: '1.8.0+abc1234',
    generadoEn,
  });

/** El mediodía de Buenos Aires de un día, que es el `ahora` neutro de un caso. */
const mediodia = (dia: string): Date => new Date(`${dia}T15:00:00Z`);

/** N encuentros del mismo día, a horas distintas, cada uno en su actividad. */
const nEncuentros = (dia: string, horas: readonly number[]): OpcionesDeEntrada[] =>
  horas.map((h, i) => ({
    id: `act_${i}`,
    slug: `actividad-${i}`,
    titulo: `Actividad ${i + 1}`,
    fechas: [`${dia}T${String(h).padStart(2, '0')}:00:00Z`],
  }));

const panelDe = (
  programacion: ReturnType<typeof panelesDeAhora>,
  clave: 'hoy' | 'manana' | 'finde',
) => {
  expect(programacion, 'la sección no se dibujó y el caso la necesita').not.toBeNull();
  const panel = programacion!.paneles.find((p) => p.clave === clave);
  expect(panel, `no hay panel «${clave}»`).toBeDefined();
  return panel!;
};

// ───────────────────────────────────────────────────────────────────────────
// 0 · Control positivo: la semana de referencia es la que los casos dicen
// ───────────────────────────────────────────────────────────────────────────

describe('la semana de referencia de este archivo', () => {
  it('el 14 de septiembre de 2026 es lunes, y el finde de esa semana es 19 y 20', () => {
    /*
     * Sin esto, un error en las fechas elegidas se lee como un bug del módulo:
     * los siete casos de abajo afirman «un viernes pasa esto», y si el 18 no
     * fuera viernes estarían afirmando otra cosa con el nombre equivocado.
     */
    expect(diaDeSemana('2026-09-14')).toBe(1);
    expect(diaDeSemana('2026-09-18')).toBe(5);
    expect(diaDeSemana('2026-09-19')).toBe(6);
    expect(diaDeSemana('2026-09-20')).toBe(0);
    expect(diaDeSemana('2026-09-21')).toBe(1);
  });

  it('y el fixture produce el eje de encuentros de B-99, no un array vacío', () => {
    // Control positivo del fixture: si `construirIndice` dejara de emitir el
    // eje, todos los casos de resolución pasarían con paneles vacíos.
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [22]));
    expect(indice.encuentros).toHaveLength(1);
    expect(indice.encuentros[0]).toMatchObject({ slug: 'actividad-0' });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · Las tres ventanas, los siete días de la semana
// ───────────────────────────────────────────────────────────────────────────

/**
 * Los siete días dan siete formas distintas del tríptico, y **la forma no es
 * monótona**: el sábado no es «el viernes corrido un día». Por eso la tabla va
 * completa y no con tres casos representativos.
 */
const SEMANA: readonly {
  dia: string;
  hoy: string;
  manana: string;
  rotuloDelFinde: string;
  diasDelFinde: readonly string[];
  porque: string;
}[] = [
  {
    dia: 'lunes',
    hoy: '2026-09-14',
    manana: '2026-09-15',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    porque: 'el finde está a cinco días y sigue siendo el de esta semana',
  },
  {
    dia: 'martes',
    hoy: '2026-09-15',
    manana: '2026-09-16',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    porque: 'nada que restar: ni hoy ni mañana caen en el finde',
  },
  {
    dia: 'miércoles',
    hoy: '2026-09-16',
    manana: '2026-09-17',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    porque: 'idem',
  },
  {
    dia: 'jueves',
    hoy: '2026-09-17',
    manana: '2026-09-18',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    porque: 'mañana es viernes, que no es finde: el panel sigue con los dos días',
  },
  {
    dia: 'viernes',
    hoy: '2026-09-18',
    manana: '2026-09-19',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-20'],
    porque:
      'LA RESTA. Mañana **es** el sábado, así que el finde se queda solo con el domingo. ' +
      'Sin restar, el mismo encuentro saldría en dos columnas pegadas del tríptico. ' +
      'El rótulo NO cambia: el domingo sigue siendo el de esta semana.',
  },
  {
    dia: 'sábado',
    hoy: '2026-09-19',
    manana: '2026-09-20',
    rotuloDelFinde: 'El finde que viene',
    diasDelFinde: ['2026-09-26', '2026-09-27'],
    porque:
      'la resta deja la ventana sin días (hoy es el sábado y mañana el domingo), así que ' +
      'salta al finde siguiente — y el rótulo lo dice: nunca se llama «este finde» a un ' +
      'sábado que falta una semana.',
  },
  {
    dia: 'domingo',
    hoy: '2026-09-20',
    manana: '2026-09-21',
    rotuloDelFinde: 'El finde que viene',
    diasDelFinde: ['2026-09-26', '2026-09-27'],
    porque:
      'MISMO RÓTULO, OTRA RAZÓN: acá no hay salto —el sábado que viene está a seis días y ' +
      'no se solapa con nada—, pero el finde de esta semana se está terminando, así que ' +
      'tampoco es «este finde». Es el caso que falla si el rótulo se decide por el salto ' +
      'y no por el día de la semana.',
  },
];

describe('ventanasDeAhora — los siete días de la semana', () => {
  it('siempre son tres paneles, en el mismo orden', () => {
    for (const { dia, hoy } of SEMANA) {
      const ventanas = ventanasDeAhora(mediodia(hoy));
      expect(
        ventanas.map((v) => v.clave),
        `el ${dia}`,
      ).toEqual(['hoy', 'manana', 'finde']);
    }
  });

  it('«Hoy» es el día de quien mira y «Mañana» el siguiente, siempre uno solo', () => {
    for (const { dia, hoy, manana } of SEMANA) {
      const [h, m] = ventanasDeAhora(mediodia(hoy));
      expect(h!.rotulo, `el ${dia}`).toBe('Hoy');
      expect(h!.dias, `el ${dia}`).toEqual([hoy]);
      expect(m!.rotulo, `el ${dia}`).toBe('Mañana');
      expect(m!.dias, `el ${dia}`).toEqual([manana]);
    }
  });

  it('el tercer panel: qué días agarra y cómo se llama, día por día', () => {
    /*
     * MUTACIÓN PROBADA: sacar la resta (`.filter(...)`) deja el caso del viernes
     * en rojo con `['2026-09-19','2026-09-20']`; decidir el rótulo por el salto
     * (`salta ? … : 'Este finde'`, sin el `dow === 0`) deja el del domingo en
     * rojo.
     */
    for (const { dia, hoy, rotuloDelFinde, diasDelFinde, porque } of SEMANA) {
      const finde = ventanasDeAhora(mediodia(hoy)).find((v) => v.clave === 'finde')!;
      expect(finde.dias, `el ${dia}: ${porque}`).toEqual(diasDelFinde);
      expect(finde.rotulo, `el ${dia}: ${porque}`).toBe(rotuloDelFinde);
    }
  });

  it('ningún día se cuenta dos veces en el tríptico, ningún día de la semana', () => {
    /*
     * La propiedad detrás de la resta, escrita como propiedad y no como el caso
     * del viernes: un encuentro no puede aparecer en dos paneles a la vez. Es lo
     * que se rompe primero si mañana se cambia cómo se elige el sábado.
     */
    for (const { dia, hoy } of SEMANA) {
      const todos = ventanasDeAhora(mediodia(hoy)).flatMap((v) => v.dias);
      expect(new Set(todos).size, `el ${dia}`).toBe(todos.length);
    }
  });

  it('y el salto al finde siguiente cruza el año, no solo el mes', () => {
    /*
     * **Lo pidió el `auditor-trampas`.** La tabla de arriba usa una sola semana de
     * referencia para los siete días, así que el salto de `findeSiguiente` nunca se
     * ejercita cruzando un mes ni un año a nivel de `ventanasDeAhora` — sí a nivel
     * de `diaDesplazado` suelto, que tiene sus propios casos. Acá se cierra el
     * hueco de integración: un domingo 27 de diciembre, el finde que viene es el 2
     * y 3 de **enero del año siguiente**.
     */
    const ventanas = ventanasDeAhora(mediodia('2026-12-27'));
    expect(ventanas.map((v) => v.dias)).toEqual([
      ['2026-12-27'],
      ['2026-12-28'],
      ['2027-01-02', '2027-01-03'],
    ]);
    expect(ventanas[2]!.rotulo).toBe('El finde que viene');
  });

  it('el finde siempre es un sábado y un domingo, en ese orden', () => {
    // Fija que el salto de semana no se hace corriendo el día suelto: los dos
    // días del panel tienen que seguir siendo el finde de alguna semana.
    for (const { dia, hoy } of SEMANA) {
      const finde = ventanasDeAhora(mediodia(hoy)).find((v) => v.clave === 'finde')!;
      expect(finde.dias.map(diaDeSemana), `el ${dia}`).toEqual(
        finde.dias.length === 2 ? [6, 0] : [0],
      );
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · La zona horaria — trampa 1, en su versión más filosa
// ───────────────────────────────────────────────────────────────────────────

describe('la zona del proyecto decide de qué día es cada cosa (trampa 1)', () => {
  it('un encuentro a las 00:30 de Buenos Aires cae en ESE día, no en el anterior', () => {
    /*
     * 03:30 UTC del 15 son las 00:30 del **15** en Buenos Aires. Con
     * `claveDeDia` el encuentro es de hoy; con `getDate()` sobre el `Date` de un
     * navegador en UTC sería del 14, o sea de «Ayer», que es un panel que no
     * existe: el encuentro desaparecería del tríptico.
     *
     * MUTACIÓN PROBADA: reemplazar `claveDeDia(d)` por una clave armada con
     * `d.getUTCDate()` deja este caso en rojo.
     */
    const indice = indiceDePrueba([
      { slug: 'medianoche', titulo: 'Vigilia de poesía', fechas: ['2026-09-15T03:30:00Z'] },
    ]);
    // 00:00 del 15 en Buenos Aires: media hora antes del encuentro.
    const programacion = panelesDeAhora(indice, new Date('2026-09-15T03:00:00Z'), ETIQUETAS);

    expect(panelDe(programacion, 'hoy').encuentros.map((e) => e.titulo)).toEqual([
      'Vigilia de poesía',
    ]);
    // Y no cayó en ningún otro: desde D-320 un panel sin encuentros no se dibuja,
    // así que «no está en mañana» se lee como «mañana no existe».
    expect(programacion!.paneles.map((p) => p.clave)).toEqual(['hoy']);
  });

  it('y el fin de semana se calcula sobre el día de la zona, no sobre el de UTC', () => {
    /*
     * **El caso que separa las dos implementaciones de raíz.** Las 02:00 UTC del
     * sábado 19 son las **23:00 del viernes 18** en Buenos Aires:
     *
     * | | día de hoy | tercer panel |
     * |---|---|---|
     * | con la zona (correcto) | viernes 18 | «Este finde», solo el domingo 20 |
     * | con UTC (`getDay()`) | sábado 19 | «El finde que viene», 26 y 27 |
     *
     * O sea: a las once de la noche de un viernes, el tríptico dejaría de
     * ofrecer el sábado y el domingo que empiezan en una hora, y mandaría a la
     * gente al finde siguiente.
     *
     * MUTACIÓN PROBADA: cambiar `diaDeSemana(clave)` por `ahora.getUTCDay()`
     * deja este caso en rojo y no toca ningún otro de la tabla de arriba (todos
     * usan el mediodía, donde las dos zonas coinciden de día).
     */
    const ventanas = ventanasDeAhora(new Date('2026-09-19T02:00:00Z'));
    expect(ventanas.map((v) => v.dias)).toEqual([
      ['2026-09-18'],
      ['2026-09-19'],
      ['2026-09-20'],
    ]);
    expect(ventanas[2]!.rotulo).toBe('Este finde');
  });

  it('la hora de cada fila también es la de Buenos Aires', () => {
    // La misma trampa un escalón más abajo: 22:00 UTC es 19:00 acá, y el panel
    // dice a qué hora empieza algo a lo que la gente va a ir.
    const indice = indiceDePrueba([{ fechas: ['2026-09-14T22:00:00Z'] }]);
    const [encuentro] = panelDe(
      panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS),
      'hoy',
    ).encuentros;
    expect(encuentro!.hora).toBe('19:00');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · «Hoy» es lo que QUEDA de hoy
// ───────────────────────────────────────────────────────────────────────────

describe('el panel de hoy muestra lo que queda de hoy, no el día entero', () => {
  it('un encuentro de hoy que ya empezó no sale', () => {
    /*
     * El eje de B-99 viene recortado desde el build (`inicio >= generadoEn`),
     * pero el reloj que importa es el de quien mira (§6.4) y entre el build y la
     * visita pasa el tiempo. Sin el `>= ahora`, el panel ofrecería a las nueve
     * de la noche un taller que empezó a las siete.
     *
     * MUTACIÓN PROBADA: sacar `d.getTime() < ahora.getTime()` deja este caso en
     * rojo con las dos actividades.
     */
    const indice = indiceDePrueba([
      { id: 'temprano', slug: 'temprano', titulo: 'Ya empezó', fechas: ['2026-09-14T19:00:00Z'] },
      { id: 'tarde', slug: 'tarde', titulo: 'Todavía no', fechas: ['2026-09-14T23:00:00Z'] },
    ]);
    // 19:00 de Buenos Aires: el primero arrancó a las 16:00, el segundo va a
    // las 20:00.
    const hoy = panelDe(panelesDeAhora(indice, new Date('2026-09-14T22:00:00Z'), ETIQUETAS), 'hoy');
    expect(hoy.encuentros.map((e) => e.titulo)).toEqual(['Todavía no']);
  });

  it('se mira el inicio y no el fin, que es la diferencia con el listado', () => {
    /*
     * Decisión, no descuido: el eje plano de B-99 **no lleva el fin**, así que
     * «lo que queda de hoy» es lo que todavía no arrancó. El costo declarado es
     * éste: una actividad que empezó hace diez minutos desaparece del panel
     * mientras sigue en el listado de abajo (que sí tiene el fin, vía
     * `proximaVentana`).
     *
     * Se fija para que el día que alguien quiera cambiarlo sepa que lo está
     * cambiando, y no para impedirlo.
     */
    const indice = indiceDePrueba([
      { slug: 'en-curso', titulo: 'Arrancó hace diez minutos', fechas: ['2026-09-14T22:00:00Z'] },
    ]);
    // 19:10 de Buenos Aires: el encuentro empezó a las 19:00 y dura dos horas.
    const programacion = panelesDeAhora(indice, new Date('2026-09-14T22:10:00Z'), ETIQUETAS);
    expect(programacion, 'la sección entera se apagó porque no queda nada').toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · El tope y el pie que dice cuántos quedaron afuera
// ───────────────────────────────────────────────────────────────────────────

describe('el tope del panel y el «+N más»', () => {
  it('el tope es cuatro', () => {
    // El número está en la constante y no escrito en el markup: el componente no
    // decide cuántas filas hay. Ver el docblock de `TOPE_DEL_PANEL`.
    expect(TOPE_DEL_PANEL).toBe(4);
  });

  it('con seis encuentros en un día salen cuatro y el pie dice «+2 más hoy»', () => {
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18, 19, 20, 21]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');

    expect(hoy.encuentros).toHaveLength(4);
    // Los cuatro **primeros** por hora, que es el orden en que el eje viene.
    expect(hoy.encuentros.map((e) => e.hora)).toEqual(['13:00', '14:00', '15:00', '16:00']);
    expect(hoy.restantes).toBe(2);
    expect(hoy.resto).toBe('+2 más hoy');
  });

  it('con uno de sobra el texto queda en singular sin decir «1 más» dos veces', () => {
    // «+1 más hoy» se lee bien: el «+1» ya dice la cantidad y «más» no concuerda
    // en número. Es el caso que hay que mirar cuando se cambie la frase.
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18, 19, 20]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.restantes).toBe(1);
    expect(hoy.resto).toBe('+1 más hoy');
  });

  it('con exactamente cuatro no hay pie: no hay nada que anunciar', () => {
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18, 19]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.encuentros).toHaveLength(4);
    expect(hoy.restantes).toBe(0);
    expect(hoy.resto).toBeNull();
  });

  it('cada panel dice el resto con su propia frase, no con una interpolada', () => {
    /*
     * Las tres frases viven juntas en `FRASES` porque son texto de producto. El
     * caso las fija las tres: «+2 más mañana» y «+2 más ese finde» —«ese» y no
     * «este», porque el panel puede estar hablando del finde que viene—.
     */
    const indice = indiceDePrueba([
      ...nEncuentros('2026-09-15', [16, 17, 18, 19, 20, 21]).map((o, i) => ({
        ...o,
        id: `man_${i}`,
        slug: `manana-${i}`,
      })),
      ...nEncuentros('2026-09-19', [16, 17, 18, 19, 20, 21]).map((o, i) => ({
        ...o,
        id: `fin_${i}`,
        slug: `finde-${i}`,
      })),
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);
    expect(panelDe(programacion, 'manana').resto).toBe('+2 más mañana');
    expect(panelDe(programacion, 'finde').resto).toBe('+2 más ese finde');
  });

  it('el tope entra por parámetro, así que el pie no depende de la constante', () => {
    // Es lo que permite verificar el corte sin escribir cinco fixtures de seis
    // encuentros, y de paso fija que el `slice` usa el argumento.
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS, 1), 'hoy');
    expect(hoy.encuentros).toHaveLength(1);
    expect(hoy.resto).toBe('+2 más hoy');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Los paneles vacíos no se dibujan, y la sección entera vacía tampoco
// ───────────────────────────────────────────────────────────────────────────

describe('un panel sin encuentros no se dibuja — D-320, 2026-09-03', () => {
  /*
   * **Esto invierte lo que B-600 había decidido**, y el motivo está en D-320: un
   * panel vacío se dibujaba y decía «Por hoy no queda nada», con el argumento de
   * que «el sábado está libre» es información. El dueño lo vio en pantalla y
   * decidió lo contrario — un panel que dice que no hay nada ocupa un tercio de
   * la banda para no decir nada.
   *
   * Los tres casos de abajo son las tres formas del tríptico que ahora existen, y
   * el tercero es el que se rompe fácil: **la regla separadora se cuenta sobre la
   * lista ya filtrada**, así que el primero de los que quedan no lleva regla a la
   * izquierda aunque no sea «Hoy».
   */
  it('con solo «Hoy» lleno sale un panel, y es el único', () => {
    const indice = indiceDePrueba([{ fechas: ['2026-09-14T22:00:00Z'] }]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(programacion!.paneles.map((p) => p.clave)).toEqual(['hoy']);
    expect(programacion!.paneles[0]!.encuentros).toHaveLength(1);
  });

  it('con «Hoy» vacío y los otros dos llenos salen dos, y el primero es «Mañana»', () => {
    /*
     * El caso que fija el orden: los que sobreviven conservan el orden de las
     * ventanas, así que el primero de la lista filtrada —el que no lleva regla a
     * la izquierda— es «Mañana» y no «Hoy».
     *
     * MUTACIÓN PROBADA: filtrar en el `map` del componente en vez de acá deja
     * este caso en verde y pone una regla a la izquierda del primer panel
     * dibujado, que es un borde suelto contra el margen.
     */
    const indice = indiceDePrueba([
      { fechas: ['2026-09-15T22:00:00Z'] },
      { slug: 'del-finde', fechas: ['2026-09-19T22:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(programacion!.paneles.map((p) => p.clave)).toEqual(['manana', 'finde']);
    for (const panel of programacion!.paneles) {
      expect(panel.encuentros.length, `el panel ${panel.clave} quedó vacío`).toBeGreaterThan(0);
    }
  });

  it('con los tres llenos siguen saliendo los tres, en orden', () => {
    // El control negativo: sin esto, filtrar de más —o devolver siempre uno—
    // pasaría los dos casos de arriba.
    const indice = indiceDePrueba([
      { fechas: ['2026-09-14T22:00:00Z'] },
      { slug: 'de-manana', fechas: ['2026-09-15T22:00:00Z'] },
      { slug: 'del-finde', fechas: ['2026-09-19T22:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);
    expect(programacion!.paneles.map((p) => p.clave)).toEqual(['hoy', 'manana', 'finde']);
  });

  it('ningún panel que salga puede venir vacío — la propiedad, no los casos', () => {
    /*
     * Lo que los tres casos de arriba son tres instancias de. Se barre la semana
     * entera, que es donde el tríptico cambia de forma siete veces.
     */
    const indice = indiceDePrueba([
      { fechas: ['2026-09-14T22:00:00Z'] },
      { slug: 'del-finde', fechas: ['2026-09-19T22:00:00Z'] },
    ]);
    for (const dia of ['14', '15', '16', '17', '18', '19', '20']) {
      const programacion = panelesDeAhora(indice, mediodia(`2026-09-${dia}`), ETIQUETAS);
      for (const panel of programacion?.paneles ?? []) {
        expect(
          panel.encuentros.length,
          `el ${dia} salió el panel ${panel.clave} sin un solo encuentro`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('con las tres ventanas vacías devuelve null y la sección no existe', () => {
    /*
     * El `null` es la decisión de no dibujar la sección, y se toma **acá y no en
     * cada llamador**: la pintan el HTML del build y la island, y dos
     * condiciones escritas por separado son dos maneras de que una se quede
     * vieja (la clase de B-88).
     *
     * Desde D-320 es además la **misma** regla que la de arriba aplicada una vez
     * más: si no sobrevive ningún panel, no hay sección.
     *
     * MUTACIÓN PROBADA: devolver siempre el objeto deja este caso en rojo.
     */
    const indice = indiceDePrueba([{ fechas: ['2026-10-14T22:00:00Z'] }]);
    expect(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS)).toBeNull();
  });

  it('y un índice sin ninguna actividad tampoco rompe', () => {
    expect(panelesDeAhora(indiceDePrueba([]), mediodia('2026-09-14'), ETIQUETAS)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · La resolución del encuentro contra su actividad
// ───────────────────────────────────────────────────────────────────────────

describe('cómo se resuelve un encuentro del eje contra su actividad', () => {
  it('la clave es `slug#sesionId` y la ruta es la página de detalle', () => {
    /*
     * La clave identifica la fila (es la `key` de React) y tiene que sobrevivir a
     * que dos encuentros del mismo ciclo caigan en el mismo panel: con el slug
     * solo, React vería dos filas iguales. El id de sesión es el uuid del cliente
     * (trampa 2), no el índice del array.
     */
    const indice = indiceDePrueba([
      {
        slug: 'club-de-lectura-rulfo',
        esCiclo: true,
        fechas: ['2026-09-14T20:00:00Z', '2026-09-14T23:00:00Z'],
      },
    ]);
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');

    const sesiones = indice.encuentros.map((e) => e.sesionId);
    expect(new Set(sesiones).size, 'los dos encuentros comparten id de sesión').toBe(2);
    expect(hoy.encuentros.map((e) => e.clave)).toEqual(
      sesiones.map((s) => `club-de-lectura-rulfo#${s}`),
    );
    expect(hoy.encuentros[0]!.ruta).toBe(rutaDeDetalle('club-de-lectura-rulfo'));
  });

  it('un encuentro cuyo slug no está en `actividades` se descarta sin romper', () => {
    /*
     * No debería pasar —los dos ejes salen del mismo build— pero el índice lo
     * sirve un CDN y puede ser de un build anterior. Sin actividad no hay título,
     * ni lugar, ni página a la que ir: se descarta en silencio en vez de tirar
     * abajo la home.
     */
    const indice = indiceDePrueba([{ slug: 'existe', fechas: ['2026-09-14T23:00:00Z'] }]);
    indice.encuentros = [
      // Primero por hora, para que caiga adentro de cualquier tope.
      { slug: 'ya-no-existe', sesionId: 'ses_fantasma', inicio: '2026-09-14T20:00:00.000Z' },
      ...indice.encuentros,
    ];

    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.encuentros.map((e) => e.clave)).toEqual([`existe#${indice.encuentros[1]!.sesionId}`]);
  });

  it('y el descartado tampoco infla el «+N más»: se resuelve y después se corta', () => {
    /*
     * **Bug encontrado al escribir estos tests.** El módulo cortaba la ventana a
     * cuatro y **después** resolvía: si un encuentro sin actividad caía entre los
     * primeros cuatro, el panel mostraba tres filas y el pie —contado contra el
     * largo de la ventana— prometía un cuarto que no existía. Un «+1 más hoy» que
     * el listado de abajo desmiente.
     *
     * MUTACIÓN PROBADA: volver a `enLaVentana.slice(0, tope).flatMap(...)` con
     * `restantes = enLaVentana.length - encuentros.length` deja este caso en rojo
     * con `resto: '+1 más hoy'`.
     */
    const indice = indiceDePrueba([{ slug: 'existe', fechas: ['2026-09-14T23:00:00Z'] }]);
    indice.encuentros = [
      { slug: 'ya-no-existe', sesionId: 'ses_fantasma', inicio: '2026-09-14T20:00:00.000Z' },
      ...indice.encuentros,
    ];

    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.encuentros).toHaveLength(1);
    expect(hoy.restantes).toBe(0);
    expect(hoy.resto).toBeNull();
  });

  it('el día de cada fila viaja SOLO en el panel que abarca dos días', () => {
    /*
     * En «Hoy» y en «Mañana» el día ya lo dijo el encabezado del panel, y
     * repetirlo en cada fila es ruido; en el finde son dos días y sin esto no se
     * sabe cuál de los dos.
     *
     * El caso mira los tres paneles del **lunes**, que es el único día en que el
     * finde tiene sus dos días.
     */
    const indice = indiceDePrueba([
      { id: 'h', slug: 'hoy', fechas: ['2026-09-14T23:00:00Z'] },
      { id: 'm', slug: 'manana', fechas: ['2026-09-15T23:00:00Z'] },
      { id: 's', slug: 'sabado', fechas: ['2026-09-19T23:00:00Z'] },
      { id: 'd', slug: 'domingo', fechas: ['2026-09-20T23:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(panelDe(programacion, 'hoy').encuentros.map((e) => e.dia)).toEqual([null]);
    expect(panelDe(programacion, 'manana').encuentros.map((e) => e.dia)).toEqual([null]);
    expect(panelDe(programacion, 'finde').encuentros.map((e) => e.dia)).toEqual([
      'sáb 19',
      'dom 20',
    ]);
  });

  it('y un finde de un solo día tampoco lo lleva: el encabezado ya lo dijo', () => {
    // El viernes, después de la resta, el panel del finde es solo el domingo. Un
    // día por fila ahí sería el ruido que la regla existe para sacar.
    const indice = indiceDePrueba([{ slug: 'domingo', fechas: ['2026-09-20T23:00:00Z'] }]);
    const finde = panelDe(panelesDeAhora(indice, mediodia('2026-09-18'), ETIQUETAS), 'finde');
    expect(finde.encuentros.map((e) => e.dia)).toEqual([null]);
  });

  it('la hora, el lugar, la categoría y el arancel salen de los módulos que ya existen', () => {
    /*
     * **Es la afirmación de que no nació una segunda derivación.** `lugarDeTarjeta`
     * y `arancelDeTarjeta` alimentan el listado, la página de mes, `/pasadas` y
     * los hubs; que el tríptico use los mismos es lo que hace que el mismo
     * encuentro no diga el lugar de dos maneras en la misma página (la clase de
     * B-88, y el hallazgo de B-190 sobre «Online por A confirmar»).
     *
     * Se compara contra la salida de esas funciones —no contra un literal— para
     * que el día que cambien el tríptico las siga.
     */
    const indice = indiceDePrueba([
      {
        slug: 'taller-de-cronica',
        tipo: 'taller',
        arancel: 'a-la-gorra',
        modalidades: ['presencial'],
        fechas: ['2026-09-14T23:00:00Z'],
      },
    ]);
    const entrada = indice.actividades[0]!;
    const [fila] = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy')
      .encuentros;

    expect(fila!.lugar).toBe(lugarDeTarjeta(entrada, ETIQUETAS));
    expect(fila!.arancel).toEqual(arancelDeTarjeta(entrada, ETIQUETAS));
    expect(fila!.tipoEtiqueta).toBe(etiquetaDe(ETIQUETAS, 'tipo', entrada.tipo));
    expect(fila!.hora).toBe(hora(new Date(fila!.iso)));

    // Y los valores, para que el caso no pase con las cuatro funciones rotas.
    expect(fila!.lugar).toBe('Casa Brandon · Villa Crespo, CABA');
    expect(fila!.arancel).toEqual({ texto: 'A la gorra', sinCosto: true });
    expect(fila!.tipoEtiqueta).toBe('Taller');
  });

  it('el slug del tipo viaja aparte de su etiqueta, para el color de D-150', () => {
    // El componente pide el matiz a `estiloDeTipo` con el **slug**: con la
    // etiqueta resuelta no podría, y renombrar «Taller» le cambiaría el color.
    const indice = indiceDePrueba([{ tipo: 'club-lectura', fechas: ['2026-09-14T23:00:00Z'] }]);
    const [fila] = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy')
      .encuentros;
    expect(fila!.tipo).toBe('club-lectura');
    expect(fila!.tipoEtiqueta).toBe('Club de lectura');
  });

  it('la fecha de carga NO sale al tríptico, ni recortada (§5.1, D-138)', () => {
    /*
     * **Lo pidió el `auditor-privacidad`, y es el hueco que el barrido de
     * centinelas no puede ver.** `barrer` detecta un campo nuevo en la fila solo
     * si su valor es un centinela, y `creadoEn` es una fecha: no admite uno, igual
     * que las fechas de `modalidades` (la nota está en el fixture).
     *
     * Y de los campos sin centinela es el que tiene historia: **D-138** lo recortó
     * a `AAAA-MM-DD` justamente porque, con un solo admin, el instante exacto de
     * cada carga es su agenda de trabajo. El tríptico es además la única salida
     * del repo donde **un string de fecha y hora al lado del título es nativo del
     * diseño** (`19:00`, `sáb 16`, el sello), así que agregar `cargado:
     * e.creadoEn` a la fila es una línea que compila y se ve razonable.
     *
     * Se afirma **por valor**, que es el patrón de `tests/modalidades.test.ts`:
     * el fixture le pone un alta con un valor distintivo y se exige que no
     * aparezca en la salida.
     *
     * MUTACIÓN PROBADA: agregar `cargado: entrada.creadoEn` a `EncuentroDePanel`
     * deja este caso en rojo y **no** el barrido de centinelas.
     */
    const indice = indiceDePrueba([
      { fechas: ['2026-09-14T23:00:00Z'], creadoEn: '2025-03-17T04:05:06Z' },
    ]);
    // Control positivo: el índice sí lleva el alta, así que el caso no pasa por
    // preguntarle a un fixture que no tiene el campo.
    expect(indice.actividades[0]!.creadoEn).toContain('2025-03-17');

    const json = JSON.stringify(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS));
    expect(json, 'la fecha de carga es agenda de trabajo del admin (D-138)').not.toContain(
      '2025-03-17',
    );
    expect(json).not.toContain('2025');
  });

  it('el `iso` es el del encuentro, para el `datetime` del `<time>`', () => {
    // Es lo que hace que la hora escrita y la máquina-legible sean el mismo
    // instante: dos fuentes serían dos maneras de que una quede vieja.
    const indice = indiceDePrueba([{ fechas: ['2026-09-14T23:00:00Z'] }]);
    const [fila] = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy')
      .encuentros;
    expect(fila!.iso).toBe(indice.encuentros[0]!.inicio);
    expect(claveDeDia(new Date(fila!.iso))).toBe('2026-09-14');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7 · Los días escritos y el sello de frescura
// ───────────────────────────────────────────────────────────────────────────

describe('cada panel imprime los días que abarca', () => {
  it('un día solo, o los dos del finde unidos con «y»', () => {
    /*
     * **No es decoración.** El HTML lo arma el build y el sitio se rehace cuando
     * cambia un dato (§8): una página servida tres días después diría «Hoy» de un
     * lunes que ya pasó. La fecha escrita es lo que impide que el rótulo mienta
     * sin que se note, y por eso está fijada al carácter.
     */
    // Los tres con algo: desde D-320 un panel vacío no se dibuja, así que para
    // mirar la fecha de los tres hay que darles un encuentro a cada uno.
    const indice = indiceDePrueba([
      { fechas: ['2026-09-14T23:00:00Z'] },
      { slug: 'de-manana', fechas: ['2026-09-15T23:00:00Z'] },
      { slug: 'del-finde', fechas: ['2026-09-19T23:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(panelDe(programacion, 'hoy').fechas).toBe('lun 14 sep');
    expect(panelDe(programacion, 'manana').fechas).toBe('mar 15 sep');
    expect(panelDe(programacion, 'finde').fechas).toBe('sáb 19 sep y dom 20 sep');
  });

  it('y el finde restado imprime el único día que le quedó', () => {
    // El viernes. Es lo que hace que «Este finde · dom 20 sep» no se lea como si
    // el sábado no existiera: dice cuál es el día del que habla.
    // El encuentro va **en el domingo**, que es el único día que le queda a la
    // ventana: sin eso el panel no se dibuja y no hay fecha que mirar (D-320).
    const indice = indiceDePrueba([{ fechas: ['2026-09-20T23:00:00Z'] }]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-18'), ETIQUETAS);
    expect(panelDe(programacion, 'finde').fechas).toBe('dom 20 sep');
  });

  it('las fechas salen de la misma forma corta que la tarjeta', () => {
    // MUTACIÓN PROBADA: formatear acá con un `Intl` propio en vez de
    // `fechaCortaDeDia` haría que el tríptico escriba «sáb, 19 sept» y la
    // tarjeta «sáb 19 sep», en la misma pantalla.
    const indice = indiceDePrueba([{ fechas: ['2026-09-14T23:00:00Z'] }]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);
    expect(panelDe(programacion, 'hoy').fechas).toBe(fechaCortaDeDia('2026-09-14'));
  });
});

describe('el sello de frescura', () => {
  it('dice cuándo se generó lo que se está mirando', () => {
    /*
     * Es el dato que explica por qué una actividad cargada hace diez minutos
     * todavía no está: el sitio es estático y se rehace con unos minutos de
     * latencia (§8). Sin esto, «Hoy» promete ser el estado del mundo.
     */
    const indice = indiceDePrueba(
      [{ fechas: ['2026-09-14T23:00:00Z'] }],
      '2026-09-14T12:30:00.000Z',
    );
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);
    // 12:30 UTC son las 09:30 de Buenos Aires, que es cuando corrió el build.
    expect(programacion!.sello).toBe('Actualizado: lun 14 sep, 09:30');
  });

  it('un `generadoEn` ilegible devuelve cadena vacía y no una excepción', () => {
    /*
     * El sello es una línea de contexto; la home es la página que más se usa. Sin
     * sello se pierde la línea, con una excepción se pierde la página.
     *
     * MUTACIÓN PROBADA: usar `new Date(generadoEn)` sin el `instanteDeIso` deja
     * este caso en rojo con «Actualizado: Invalid Date» impreso arriba del
     * tríptico.
     */
    const indice = indiceDePrueba([{ fechas: ['2026-09-14T23:00:00Z'] }]);
    indice.generadoEn = 'cualquier-cosa';
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(programacion!.sello).toBe('');
    // Y la sección sigue en pie: los paneles no dependen del sello.
    expect(panelDe(programacion, 'hoy').encuentros).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 8 · Lo que el tríptico NO hace
// ───────────────────────────────────────────────────────────────────────────

describe('el tríptico no es un resultado del filtrado', () => {
  it('las canceladas no llegan al panel, porque no llegan al eje', () => {
    /*
     * El recorte lo hace `encuentrosDelIndice` (B-99), que ya deja fuera las
     * sesiones canceladas: el módulo no vuelve a decidirlo. El caso lo fija acá
     * igual, porque es el tríptico el que mandaría a alguien a un encuentro
     * cancelado.
     */
    const indice = indiceDePrueba([
      {
        slug: 'ciclo',
        esCiclo: true,
        fechas: ['2026-09-14T20:00:00Z', '2026-09-14T23:00:00Z'],
        canceladas: [1],
      },
    ]);
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.encuentros).toHaveLength(1);
    expect(hoy.encuentros[0]!.hora).toBe('17:00');
  });

  it('el orden es el del eje —por hora— y no el del listado', () => {
    /*
     * El listado ordena por próxima fecha de la **actividad** y admite otros
     * órdenes (D-138). El panel es un cronograma: la única lectura posible es la
     * hora, y el eje ya viene ordenado por eso desde el build.
     */
    const indice = indiceDePrueba([
      { id: 'c', slug: 'tarde', titulo: 'Tercera', fechas: ['2026-09-14T23:00:00Z'] },
      { id: 'a', slug: 'temprano', titulo: 'Primera', fechas: ['2026-09-14T20:00:00Z'] },
      { id: 'b', slug: 'medio', titulo: 'Segunda', fechas: ['2026-09-14T21:30:00Z'] },
    ]);
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.encuentros.map((e) => e.titulo)).toEqual(['Primera', 'Segunda', 'Tercera']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 9 · La grilla, que tiene que existir en el CSS construido — D-320
// ───────────────────────────────────────────────────────────────────────────

describe('la grilla del tríptico se adapta a cuántos paneles quedaron', () => {
  const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

  it('hay una clase por cada cantidad posible, y ninguna se arma en runtime', () => {
    /*
     * Desde D-320 los paneles son uno, dos o tres. Una `lg:grid-cols-3` fija
     * dejaría columnas fantasma —un solo panel ocupando un tercio del ancho— y
     * una clase compuesta (`lg:grid-cols-${n}`) **no existiría en la hoja**,
     * porque Tailwind genera las utilidades leyendo el fuente.
     */
    for (const n of [1, 2, 3] as const) {
      expect(CLASES_DEL_TRIPTICO[n], `falta la clase para ${n} paneles`).toContain('grid');
    }
    expect(CLASES_DEL_TRIPTICO[1]).not.toContain('lg:grid-cols-');
    expect(CLASES_DEL_TRIPTICO[2]).toContain('lg:grid-cols-2');
    expect(CLASES_DEL_TRIPTICO[3]).toContain('lg:grid-cols-3');

    // Y el componente la pide por índice, no la arma: un template acá sería
    // exactamente la clase que Tailwind no ve.
    const componente = readFileSync(raiz('src/components/publico/PanelesDeAhora.tsx'), 'utf8');
    expect(componente).toContain('CLASES_DEL_TRIPTICO[columnas]');
    expect(componente).not.toMatch(/grid-cols-\$\{/);

    /*
     * **Y que `columnas` salga de cuántos paneles hay**, que es la mitad visual
     * del cambio. Sin esto, un `const columnas = 3` deja todo lo de arriba en
     * verde y devuelve la grilla fija — en un componente que por convención de
     * este repo no tiene test de render, o sea que no lo vería nadie. Lo pidió el
     * `auditor-privacidad`.
     */
    expect(
      componente,
      'las columnas tienen que contarse de `paneles`, no ser un número escrito',
    ).toMatch(/Math\.min\(paneles\.length, 3\)/);
  });

  it('y las tres salen de verdad en el CSS construido', () => {
    /*
     * **El único chequeo que sabe la verdad.** Un mapa de literales que Tailwind
     * igual no ve —por vivir en un archivo fuera de su `content`, o porque la
     * clase se escribió mal— tiene exactamente el mismo aspecto en el fuente y el
     * mismo bug en pantalla: la grilla se queda en una columna y nada falla.
     *
     * Se saltea sin `dist/`, como los otros que miran el build: correr
     * `npm run build` antes. En CI el build siempre corre.
     *
     * MUTACIÓN PROBADA: escribir el mapa con una clase que Tailwind no emite
     * —`lg:grid-cols-[2]` con un valor arbitrario que no resuelve— pone este caso
     * en rojo nombrando la clase que no llegó.
     */
    const dir = raiz('dist/_astro');
    const hojas = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.css'))
          .map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
          .join('\n')
      : '';

    if (hojas === '') return; // sin build no hay nada que mirar

    /*
     * Las clases salen **del mapa**, no escritas otra vez acá: una lista propia
     * se queda vieja el día que el mapa cambie, y este caso pasaría mirando
     * clases que ya nadie usa. Y se busca el **selector** (`.lg\:grid-cols-2`),
     * no la subcadena: `grid-cols-2` a secas lo satisface `CLASES_DE_GALERIA`,
     * que usa la misma utilidad sin el `lg:` — o sea que el chequeo pasaría sin
     * que la del tríptico existiera.
     */
    const selectorDe = (clase: string): string => `.${clase.replace(/:/g, '\\:')}`;

    const utilidades = [...new Set(Object.values(CLASES_DEL_TRIPTICO).flatMap((c) => c.split(' ')))];
    expect(utilidades.length, 'el mapa dejó de tener clases que verificar').toBeGreaterThan(2);

    for (const clase of utilidades) {
      expect(hojas, `\`${clase}\` no llegó al CSS construido`).toContain(selectorDe(clase));
    }

    /*
     * **Y la mitad que hace que lo de arriba signifique algo.** Lo encontró el
     * `auditor-privacidad`: las cuatro utilidades del mapa **también las escriben
     * otros archivos** —`lg:grid-cols-2` está en `EstadisticasPanel.tsx` y
     * `lg:grid-cols-3` en `FiltrosActividades.tsx`—, así que el bucle de arriba
     * pasaría verde aunque `components/sitio/estilos.ts` quedara **fuera del scan
     * de Tailwind**, que es justo el modo de falla que este caso dice cubrir: la
     * grilla se quedaría en una columna y nada fallaría.
     *
     * Lo que prueba que el archivo se escanea es una clase que **solo él
     * escribe**: `sm:columns-2`, de `CLASES_DE_PARED`. Si está en la hoja, el
     * archivo entró; si no, el bucle de arriba no está afirmando nada.
     */
    const MARCADOR = 'sm:columns-2';
    const enElFuente = execFileSync('grep', ['-rl', MARCADOR, raiz('src')], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    expect(
      enElFuente.map((f) => f.replace(/.*\/src\//, 'src/')),
      `\`${MARCADOR}\` dejó de ser exclusivo de estilos.ts: elegir otro marcador`,
    ).toEqual(['src/components/sitio/estilos.ts']);
    expect(
      hojas,
      'ninguna clase exclusiva de `components/sitio/estilos.ts` llegó al CSS: el ' +
        'archivo quedó fuera del scan de Tailwind, así que el mapa de la grilla no ' +
        'existe en la hoja aunque las utilidades sueltas sí (las escriben otros).',
    ).toContain(selectorDe(MARCADOR));
  });
});
