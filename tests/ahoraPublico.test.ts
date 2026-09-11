import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { correrGate, hojaConLaGrilla } from './fixtures/artefacto';

import {
  TOPE_DEL_PANEL,
  type ClaveDePanel,
  panelesDeAhora,
  ventanasDeAhora,
} from '@/lib/ahoraPublico';
import { CLASES_DE_PARED, CLASES_DEL_TRIPTICO } from '@/components/sitio/estilos';
import { construirIndice, type Indice } from '@/lib/eventsJson';
import { cuandoDeDias, desdeQuery, diasDelCuando } from '@/lib/listadoPublico';
import { RUTA_AGENDA } from '@/lib/rutasPublicas';
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
  // La clave sale del tipo del módulo y no escrita acá: es lo que hizo que el
  // renombre de las ventanas de B-791 apareciera en `tsc` y no en un `undefined`.
  clave: ClaveDePanel,
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
  rotuloDelFinde: string;
  diasDelFinde: readonly string[];
  diasDeLaSemana: readonly string[];
  porque: string;
}[] = [
  {
    dia: 'lunes',
    hoy: '2026-09-14',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    diasDeLaSemana: ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'],
    porque: 'el finde está a cinco días, y «esta semana» son los cuatro que hay antes',
  },
  {
    dia: 'martes',
    hoy: '2026-09-15',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    diasDeLaSemana: ['2026-09-16', '2026-09-17', '2026-09-18'],
    porque: 'la ventana del medio se acorta un día por día que pasa',
  },
  {
    dia: 'miércoles',
    hoy: '2026-09-16',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    diasDeLaSemana: ['2026-09-17', '2026-09-18'],
    porque: 'idem',
  },
  {
    dia: 'jueves',
    hoy: '2026-09-17',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    diasDeLaSemana: ['2026-09-18'],
    porque: 'a «esta semana» le queda un solo día: el viernes',
  },
  {
    dia: 'viernes',
    hoy: '2026-09-18',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-19', '2026-09-20'],
    diasDeLaSemana: [],
    porque:
      'LA RESTA. Los dos días que le quedan a la semana **son** el finde, así que la ' +
      'tercera ventana queda vacía y el panel no se dibuja. Sin restar, el mismo ' +
      'encuentro saldría en dos columnas pegadas del tríptico.',
  },
  {
    dia: 'sábado',
    hoy: '2026-09-19',
    rotuloDelFinde: 'Este finde',
    diasDelFinde: ['2026-09-20'],
    diasDeLaSemana: [],
    porque:
      'el sábado es hoy, así que «Hoy» se lo lleva y al finde le queda el domingo. El ' +
      'rótulo NO cambia: el domingo sigue siendo el de este finde. (Con las ventanas ' +
      'viejas el sábado saltaba al finde siguiente, porque «Mañana» le comía el domingo ' +
      'también; sin ese panel ya no hace falta saltar.)',
  },
  {
    dia: 'domingo',
    hoy: '2026-09-20',
    rotuloDelFinde: 'El finde que viene',
    diasDelFinde: ['2026-09-26', '2026-09-27'],
    diasDeLaSemana: [],
    porque:
      'EL RÓTULO NO SE DECIDE POR EL SALTO: acá no hay nada que restar —el sábado que ' +
      'viene está a seis días—, pero el finde de esta semana se está terminando, así que ' +
      'tampoco es «este finde». Es el caso que falla si el rótulo sale de la resta y no ' +
      'del día de la semana.',
  },
];

describe('ventanasDeAhora — los siete días de la semana', () => {
  it('siempre son tres paneles, en el mismo orden', () => {
    for (const { dia, hoy } of SEMANA) {
      const ventanas = ventanasDeAhora(mediodia(hoy));
      expect(
        ventanas.map((v) => v.clave),
        `el ${dia}`,
      ).toEqual(['hoy', 'finde', 'semana']);
    }
  });

  it('«Hoy» es el día de quien mira, y es siempre un solo día', () => {
    for (const { dia, hoy } of SEMANA) {
      const [h] = ventanasDeAhora(mediodia(hoy));
      expect(h!.rotulo, `el ${dia}`).toBe('Hoy');
      expect(h!.dias, `el ${dia}`).toEqual([hoy]);
    }
  });

  it('«Esta semana» son los días que faltan hasta el domingo, menos los otros dos paneles', () => {
    /*
     * **La ventana que B-791 agregó, y la que puede mentir.** El rótulo dice
     * «Esta semana» y la ventana NO es toda la semana: es lo que queda después de
     * restar hoy y el finde, porque las tres siguen siendo disjuntas (D-320). Lo
     * que hace honesto al rótulo son las fechas escritas, que se verifican en
     * «cada panel imprime los días que abarca».
     *
     * MUTACIÓN PROBADA: sacar el `!findeDelPanel.includes(d)` deja el lunes en
     * rojo (aparecen el 19 y el 20); cambiar `hasta` por siete días fijos deja el
     * domingo en rojo (aparece la semana siguiente entera).
     */
    for (const { dia, hoy, diasDeLaSemana, porque } of SEMANA) {
      const semana = ventanasDeAhora(mediodia(hoy)).find((v) => v.clave === 'semana')!;
      expect(semana.rotulo, `el ${dia}`).toBe('Esta semana');
      expect(semana.dias, `el ${dia}: ${porque}`).toEqual(diasDeLaSemana);
    }
  });

  it('el panel del finde: qué días agarra y cómo se llama, día por día', () => {
    /*
     * MUTACIÓN PROBADA: sacar la resta (`.filter((d) => d !== hoy)`) deja el caso
     * del sábado en rojo con `['2026-09-19','2026-09-20']`; decidir el rótulo por
     * el salto (`salta ? … : 'Este finde'`, sin el `dow === 0`) deja el del
     * domingo en rojo.
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
      ['2027-01-02', '2027-01-03'],
      [],
    ]);
    expect(ventanas[1]!.rotulo).toBe('El finde que viene');
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
     * | | día de hoy | panel del finde |
     * |---|---|---|
     * | con la zona (correcto) | viernes 18 | «Este finde», el 19 y el 20 |
     * | con UTC (`getDay()`) | sábado 19 | «Este finde», solo el domingo 20 |
     *
     * O sea: a las once de la noche de un viernes, el tríptico dejaría de
     * ofrecer el sábado que empieza en una hora.
     *
     * MUTACIÓN PROBADA: cambiar `diaDeSemana(clave)` por `ahora.getUTCDay()`
     * deja este caso en rojo y no toca ningún otro de la tabla de arriba (todos
     * usan el mediodía, donde las dos zonas coinciden de día).
     */
    const ventanas = ventanasDeAhora(new Date('2026-09-19T02:00:00Z'));
    expect(ventanas.map((v) => v.dias)).toEqual([
      ['2026-09-18'],
      ['2026-09-19', '2026-09-20'],
      [],
    ]);
    expect(ventanas[1]!.rotulo).toBe('Este finde');
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

describe('el tope del panel, el sorteo y el «+N más»', () => {
  it('el tope es dos', () => {
    // El número está en la constante y no escrito en el markup: el componente no
    // decide cuántas filas hay. Ver el docblock de `TOPE_DEL_PANEL` — eran cuatro
    // hasta B-791.
    expect(TOPE_DEL_PANEL).toBe(2);
  });

  it('con seis encuentros en un día salen dos y el pie dice «+4 más hoy»', () => {
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18, 19, 20, 21]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');

    expect(hoy.encuentros).toHaveLength(2);
    expect(hoy.restantes).toBe(4);
    expect(hoy.resto).toBe('+4 más hoy');
  });

  it('con uno de sobra el texto queda en singular sin decir «1 más» dos veces', () => {
    // «+1 más hoy» se lee bien: el «+1» ya dice la cantidad y «más» no concuerda
    // en número. Es el caso que hay que mirar cuando se cambie la frase.
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.restantes).toBe(1);
    expect(hoy.resto).toBe('+1 más hoy');
  });

  it('con exactamente dos no hay pie: no hay nada que anunciar', () => {
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.encuentros).toHaveLength(2);
    expect(hoy.restantes).toBe(0);
    expect(hoy.resto).toBeNull();
  });

  it('cada panel dice el resto con su propia frase, no con una interpolada', () => {
    /*
     * Las tres frases viven juntas en `FRASES` porque son texto de producto. El
     * caso las fija las tres: «+4 más esta semana» y «+4 más ese finde» —«ese» y
     * no «este», porque el panel puede estar hablando del finde que viene—.
     */
    const indice = indiceDePrueba([
      ...nEncuentros('2026-09-16', [16, 17, 18, 19, 20, 21]).map((o, i) => ({
        ...o,
        id: `sem_${i}`,
        slug: `semana-${i}`,
      })),
      ...nEncuentros('2026-09-19', [16, 17, 18, 19, 20, 21]).map((o, i) => ({
        ...o,
        id: `fin_${i}`,
        slug: `finde-${i}`,
      })),
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);
    expect(panelDe(programacion, 'semana').resto).toBe('+4 más esta semana');
    expect(panelDe(programacion, 'finde').resto).toBe('+4 más ese finde');
  });

  it('el pie lleva al listado filtrado por los días de la ventana — B-791', () => {
    /*
     * El destino del «+N más». **No es una página por día** —el día sigue sin ser
     * una URL de este sitio, §2.3— sino la home con el filtro puesto: cero URLs
     * indexables nuevas, y el listado que ya estaba abajo acotado a lo que el pie
     * promete.
     *
     * Se afirma contra `cuandoDeDias`, que es la función que decide la gramática
     * de `?cuando=`, y no contra un string escrito a mano: escribirlo acá sería
     * una tercera copia de la gramática (el módulo, el filtro y este caso).
     */
    const indice = indiceDePrueba([
      ...nEncuentros('2026-09-14', [16, 17, 18]),
      ...nEncuentros('2026-09-19', [16, 17, 18]).map((o, i) => ({
        ...o,
        id: `fin_${i}`,
        slug: `finde-${i}`,
      })),
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(panelDe(programacion, 'hoy').rutaDelResto).toBe(
      `${RUTA_AGENDA}?cuando=${cuandoDeDias(['2026-09-14'])}`,
    );
    // El finde son dos días, así que el filtro es un rango.
    expect(panelDe(programacion, 'finde').rutaDelResto).toBe(
      `${RUTA_AGENDA}?cuando=${cuandoDeDias(['2026-09-19', '2026-09-20'])}`,
    );
  });

  it('y ese link es un «Cuándo» que el listado sabe leer — la ida y la vuelta', () => {
    /*
     * **El caso que impide el link roto.** El pie arma la URL y el listado la
     * lee; son dos módulos, y si la gramática cambia en uno el link sigue
     * existiendo y el listado se cae al default **sin decir nada**. Acá se cierra
     * pasando lo que el panel produce por el parser de verdad, `desdeQuery`, y
     * exigiendo que vuelvan los días de la ventana.
     */
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    const { filtros } = desdeQuery(hoy.rutaDelResto!.split('?')[1]!);
    expect(diasDelCuando(filtros.cuando)).toEqual(['2026-09-14']);
  });

  it('sin resto no hay ruta: el pie no existe y no hay a dónde ir', () => {
    // Los dos campos son `null` juntos, siempre. Una ruta con `resto: null` sería
    // un link que el componente no dibuja, o —peor— que dibuja sin texto.
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    expect(hoy.resto).toBeNull();
    expect(hoy.rutaDelResto).toBeNull();
  });

  it('el tope entra por parámetro, así que el pie no depende de la constante', () => {
    // Es lo que permite verificar el corte sin escribir cinco fixtures de seis
    // encuentros, y de paso fija que el `slice` usa el argumento.
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18]));
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS, 1), 'hoy');
    expect(hoy.encuentros).toHaveLength(1);
    expect(hoy.resto).toBe('+2 más hoy');
  });

  /*
   * ── El sorteo — B-791 ───────────────────────────────────────────────────
   *
   * Con dos filas de un día que tiene seis, mostrar siempre las dos primeras por
   * hora condena a las otras cuatro a no aparecer nunca. El dueño pidió que sean
   * aleatorias, y «aleatorio» acá tiene una restricción que no es obvia: el panel
   * se pinta **dos veces** —el build genera el HTML y la island lo reemplaza, el
   * patrón de los dos relojes del §6.4—, así que un `Math.random()` haría que la
   * página cambie sola delante de quien la está leyendo.
   *
   * De ahí que lo que se verifica no sea «es aleatorio» —no se puede— sino las
   * tres propiedades que lo hacen usable: **es estable** dentro del día, **rota**
   * de un día al otro, y **no privilegia la primera hora**.
   */

  it('la misma ventana sorteada dos veces da lo mismo: el HTML y la island coinciden', () => {
    /*
     * La propiedad que hace que no parpadee, y la razón por la que la semilla son
     * los días de la ventana y no el instante.
     *
     * MUTACIÓN PROBADA: cambiar la semilla por `Date.now()` o el orden por
     * `Math.random() - 0.5` deja este caso en rojo.
     */
    const indice = indiceDePrueba(nEncuentros('2026-09-14', [16, 17, 18, 19, 20, 21]));
    // Dos relojes distintos del mismo día: el build a las 13:00 y la visita a las
    // 13:05. Ninguno de los seis encuentros empezó todavía.
    const delBuild = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS), 'hoy');
    const deLaIsland = panelDe(
      panelesDeAhora(indice, new Date('2026-09-14T15:05:00Z'), ETIQUETAS),
      'hoy',
    );
    expect(deLaIsland.encuentros.map((e) => e.clave)).toEqual(
      delBuild.encuentros.map((e) => e.clave),
    );
  });

  it('y de un día al otro sale otra cosa: rota una vez por día, no en cada rebuild', () => {
    /*
     * La contracara. Si la semilla no dependiera del día, el sorteo sería una
     * permutación fija y el panel mostraría las mismas dos actividades para
     * siempre — que es justo el problema que el sorteo viene a resolver.
     *
     * Se compara el orden completo y no las dos primeras: con seis encuentros y
     * dos días, que las dos primeras coincidan por azar es perfectamente posible,
     * y el test no puede depender de eso.
     */
    const conMismosSlugs = (dia: string): OpcionesDeEntrada[] =>
      nEncuentros(dia, [16, 17, 18, 19, 20, 21]).map((o, i) => ({ ...o, slug: `taller-${i}` }));
    const indice = indiceDePrueba([
      ...conMismosSlugs('2026-09-14'),
      ...conMismosSlugs('2026-09-16').map((o, i) => ({ ...o, id: `mie_${i}` })),
    ]);
    // El mismo día, sin tope, para poder mirar el orden entero de las dos ventanas.
    const lunes = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS, 99), 'hoy');
    const miercoles = panelDe(
      panelesDeAhora(indice, mediodia('2026-09-16'), ETIQUETAS, 99),
      'hoy',
    );
    expect(lunes.encuentros).toHaveLength(6);
    expect(miercoles.encuentros).toHaveLength(6);
    expect(miercoles.encuentros.map((e) => e.hora)).not.toEqual(
      lunes.encuentros.map((e) => e.hora),
    );
  });

  it('el sorteo no privilegia la primera hora: sobre veinte días, el último también sale', () => {
    /*
     * La propiedad que separa el sorteo del orden por hora, escrita como
     * propiedad: sobre veinte días distintos, la actividad de las 21:00 tiene que
     * entrar en el panel alguna vez. Con el `slice(0, 2)` del eje ordenado no
     * entra ninguna.
     *
     * No se fija en qué días sale —eso sería fijar el hash— sino que sale.
     */
    const salieron = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const dia = `2026-09-${String(i + 8).padStart(2, '0')}`;
      const indice = indiceDePrueba(
        nEncuentros(dia, [16, 17, 18, 19, 20, 21]).map((o, j) => ({
          ...o,
          id: `d${i}_${j}`,
          slug: `taller-${j}`,
        })),
      );
      const p = panelesDeAhora(indice, mediodia(dia), ETIQUETAS);
      for (const panel of p?.paneles ?? [])
        for (const e of panel.encuentros) salieron.add(e.hora);
    }
    expect(salieron, 'las seis horas del día entraron al panel alguna vez').toEqual(
      new Set(['13:00', '14:00', '15:00', '16:00', '17:00', '18:00']),
    );
  });
});

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

  it('con «Hoy» vacío y los otros dos llenos salen dos, y el primero es «Este finde»', () => {
    /*
     * El caso que fija el orden: los que sobreviven conservan el orden de las
     * ventanas, así que el primero de la lista filtrada —el que no lleva regla a
     * la izquierda— es «Este finde» y no «Hoy».
     *
     * MUTACIÓN PROBADA: filtrar en el `map` del componente en vez de acá deja
     * este caso en verde y pone una regla a la izquierda del primer panel
     * dibujado, que es un borde suelto contra el margen.
     */
    const indice = indiceDePrueba([
      { fechas: ['2026-09-19T22:00:00Z'] },
      { slug: 'de-la-semana', fechas: ['2026-09-16T22:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(programacion!.paneles.map((p) => p.clave)).toEqual(['finde', 'semana']);
    for (const panel of programacion!.paneles) {
      expect(panel.encuentros.length, `el panel ${panel.clave} quedó vacío`).toBeGreaterThan(0);
    }
  });

  it('con los tres llenos siguen saliendo los tres, en orden', () => {
    // El control negativo: sin esto, filtrar de más —o devolver siempre uno—
    // pasaría los dos casos de arriba.
    const indice = indiceDePrueba([
      { fechas: ['2026-09-14T22:00:00Z'] },
      { slug: 'de-la-semana', fechas: ['2026-09-16T22:00:00Z'] },
      { slug: 'del-finde', fechas: ['2026-09-19T22:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);
    expect(programacion!.paneles.map((p) => p.clave)).toEqual(['hoy', 'finde', 'semana']);
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
     * El caso mira los tres paneles del **lunes**: el finde tiene sus dos días y
     * «esta semana» le queda uno solo con algo cargado.
     */
    const indice = indiceDePrueba([
      { id: 'h', slug: 'hoy', fechas: ['2026-09-14T23:00:00Z'] },
      { id: 'm', slug: 'de-la-semana', fechas: ['2026-09-15T23:00:00Z'] },
      { id: 's', slug: 'sabado', fechas: ['2026-09-19T23:00:00Z'] },
      { id: 'd', slug: 'domingo', fechas: ['2026-09-20T23:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(panelDe(programacion, 'hoy').encuentros.map((e) => e.dia)).toEqual([null]);
    expect(panelDe(programacion, 'semana').encuentros.map((e) => e.dia)).toEqual(['mar 15']);
    // El sorteo puede darlos en cualquier orden, así que se comparan como conjunto.
    expect(new Set(panelDe(programacion, 'finde').encuentros.map((e) => e.dia))).toEqual(
      new Set(['sáb 19', 'dom 20']),
    );
  });

  it('y un finde de un solo día tampoco lo lleva: el encabezado ya lo dijo', () => {
    // El **sábado**, después de la resta, el panel del finde es solo el domingo
    // —el sábado se lo llevó «Hoy»—. Un día por fila ahí sería el ruido que la
    // regla existe para sacar. (Era el viernes hasta B-791, cuando la resta
    // dejaba de restar el sábado porque «Mañana» dejó de existir.)
    const indice = indiceDePrueba([{ slug: 'domingo', fechas: ['2026-09-20T23:00:00Z'] }]);
    const finde = panelDe(panelesDeAhora(indice, mediodia('2026-09-19'), ETIQUETAS), 'finde');
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
      { slug: 'de-la-semana', fechas: ['2026-09-15T23:00:00Z'] },
      { slug: 'del-finde', fechas: ['2026-09-19T23:00:00Z'] },
    ]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);

    expect(panelDe(programacion, 'hoy').fechas).toBe('lun 14 sep');
    expect(panelDe(programacion, 'finde').fechas).toBe('sáb 19 sep y dom 20 sep');
    // **La ventana que más necesita esta línea** (B-791): el rótulo dice «Esta
    // semana» y son cuatro días, no siete. La fecha escrita es lo único que
    // impide que el rótulo mienta.
    expect(panelDe(programacion, 'semana').fechas).toBe(
      'mar 15 sep y mié 16 sep y jue 17 sep y vie 18 sep',
    );
  });

  it('y el finde restado imprime el único día que le quedó', () => {
    // El sábado. Es lo que hace que «Este finde · dom 20 sep» no se lea como si
    // el sábado no existiera: dice cuál es el día del que habla.
    // El encuentro va **en el domingo**, que es el único día que le queda a la
    // ventana: sin eso el panel no se dibuja y no hay fecha que mirar (D-320).
    const indice = indiceDePrueba([{ fechas: ['2026-09-20T23:00:00Z'] }]);
    const programacion = panelesDeAhora(indice, mediodia('2026-09-19'), ETIQUETAS);
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
  it('dice de qué DÍA es lo que se está mirando, y no de qué minuto — B-792', () => {
    /*
     * Sin el sello, «Hoy» promete ser el estado del mundo: el sitio es estático y
     * una página servida tres días después de la última carga diría «Hoy» de un
     * viernes que ya pasó.
     *
     * **Decía `Actualizado: lun 14 sep, 09:30` hasta B-792**, con el argumento de
     * que la hora explica por qué una actividad cargada hace diez minutos todavía
     * no está. Lo levantó el `auditor-privacidad`: con el debounce de cinco
     * minutos del rebuild, un sello al minuto publica **cuándo fue la última
     * escritura del panel**, y con un solo admin eso es su agenda de trabajo — la
     * misma cantidad que D-138 decidió no publicar al recortar `creadoEn` a
     * `AAAA-MM-DD`.
     *
     * Lo que la hora explicaba vive en `/ayuda` («un cambio recién hecho tarda
     * unos minutos en verse»), y se verifica ahí abajo para que sacarla de la
     * ayuda deje este razonamiento en rojo.
     *
     * MUTACIÓN PROBADA: reponer `, ${hora(d)}` deja este caso en rojo, y también
     * el `it` del sello en el barrido de centinelas.
     */
    const indice = indiceDePrueba(
      [{ fechas: ['2026-09-14T23:00:00Z'] }],
      '2026-09-14T12:30:00.000Z',
    );
    const programacion = panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS);
    // 12:30 UTC son las 09:30 de Buenos Aires: el día sale, la hora no.
    expect(programacion!.sello).toBe('Actualizado: lun 14 sep');
    expect(programacion!.sello, 'el minuto del build no sale (D-138)').not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('y la latencia que el minuto explicaba está contestada en la ayuda', () => {
    /*
     * La otra mitad de B-792, y la razón por la que recortar el sello no pierde
     * nada: la pregunta «vi una actividad anunciada y acá no está» tiene su
     * respuesta en `/ayuda`. Si esa respuesta se saca, este caso se pone en rojo y
     * hay que redecidir el sello, no borrar el aserto.
     */
    const ayuda = readFileSync(
      fileURLToPath(new URL('../src/lib/ayudaDelSitio.ts', import.meta.url)),
      'utf8',
    );
    expect(ayuda).toContain('tarda unos minutos en verse');
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

  it('el panel no hereda el orden del listado, y desde B-791 tampoco el del eje', () => {
    /*
     * **Este caso cambió de afirmación en B-791, y por eso está escrito el
     * original.** Decía «el orden es el del eje —por hora—», con el argumento de
     * que el panel es un cronograma y la única lectura posible es la hora. Sigue
     * siendo cierto que no hereda el orden del listado (que ordena por próxima
     * fecha de la actividad y admite otros órdenes, D-138), pero el orden por
     * hora se lo llevó el sorteo: con dos filas de seis, mostrar siempre las dos
     * primeras condena a las otras cuatro a no aparecer nunca. Ver `sorteados`.
     *
     * Lo que queda por verificar es que el orden **sea el del sorteo**, o sea el
     * que `sorteados` produce para esa ventana, y no el del eje ni el del
     * listado. Se afirma contra la función y no contra un orden escrito a mano
     * para no fijar el hash: si mañana se cambia `numeroDe`, este caso sigue
     * siendo cierto y el de «la misma ventana sorteada dos veces» sigue siendo el
     * que protege al lector del parpadeo.
     */
    const indice = indiceDePrueba([
      { id: 'c', slug: 'tarde', titulo: 'Tercera', fechas: ['2026-09-14T23:00:00Z'] },
      { id: 'a', slug: 'temprano', titulo: 'Primera', fechas: ['2026-09-14T20:00:00Z'] },
      { id: 'b', slug: 'medio', titulo: 'Segunda', fechas: ['2026-09-14T21:30:00Z'] },
    ]);
    const hoy = panelDe(panelesDeAhora(indice, mediodia('2026-09-14'), ETIQUETAS, 99), 'hoy');
    // Los tres están, ninguno se perdió por el camino.
    expect(new Set(hoy.encuentros.map((e) => e.titulo))).toEqual(
      new Set(['Primera', 'Segunda', 'Tercera']),
    );
    // Y el eje sigue viniendo por hora del build, que es lo que el sorteo mezcla.
    expect(indice.encuentros.map((e) => e.inicio)).toEqual(
      [...indice.encuentros.map((e) => e.inicio)].sort(),
    );
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
    /*
     * **Las clases no se escriben como literales acá, y no es estilo**: Tailwind
     * v4 escanea el proyecto entero menos lo que ignora `.gitignore`, y `tests/`
     * no está ignorado — o sea que un `toContain('lg:grid-cols-2')` **mete esa
     * clase en la hoja por sí mismo**. Está comprobado en este árbol:
     * `lg:grid-cols-[2]` existe solo en un comentario de este archivo y aun así
     * salió al CSS. Lo encontró el `auditor-privacidad`.
     *
     * Así que las afirmaciones se arman con el número, que no es una clase.
     */
    expect(CLASES_DEL_TRIPTICO[1]).not.toContain('lg:');
    for (const n of [2, 3] as const) {
      expect(CLASES_DEL_TRIPTICO[n], `el mapa no pide ${n} columnas en lg`).toContain(
        `lg:grid-${'cols'}-${n}`,
      );
    }

    // Y el componente la pide por índice, no la arma: un template acá sería
    // exactamente la clase que Tailwind no ve.
    // Sin comentarios: el docblock de al lado ya nombra `Math.min`, así que un
    // barrido sobre el texto crudo pasaría contra su propia documentación.
    const componente = readFileSync(raiz('src/components/publico/PanelesDeAhora.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
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

  it('el marcador que prueba el scan sigue siendo exclusivo de `estilos.ts`', () => {
    /*
     * **La mitad de la propiedad que no necesita artefacto, y la que hace que la
     * otra signifique algo.** Lo encontró el `auditor-privacidad`: las cuatro
     * utilidades del mapa **también las escriben otros archivos**
     * —`lg:grid-cols-2` está en `EstadisticasPanel.tsx` y `lg:grid-cols-3` en
     * `FiltrosActividades.tsx`—, así que exigirlas en la hoja pasaría verde
     * aunque `components/sitio/estilos.ts` quedara **fuera del scan de
     * Tailwind**, que es justo el modo de falla que esto cubre: la grilla se
     * quedaría en una columna y nada fallaría.
     *
     * Lo que prueba que el archivo se escanea es una clase que **solo él**
     * escribe: la de dos columnas de `CLASES_DE_PARED` (no se escribe acá — ver
     * el aviso de abajo). Que esa clase llegue a la hoja lo exige el gate
     * (`scripts/verificar-bundle.sh`, §4.2), que es el único lugar del pipeline
     * donde el `dist/` existe; **que siga siendo exclusiva se verifica acá**,
     * porque es sobre el fuente y no necesita build.
     *
     * MUTACIÓN PROBADA: escribir el marcador **literal** en cualquier otro
     * archivo del árbol pone este caso en rojo nombrando el archivo de más. Y no
     * es hipotético: la primera versión de este comentario lo escribía con todas
     * las letras para explicar la mutación, y se auto-rompió — que es la prueba
     * de que el grep mira el repo entero y no `src/`.
     */
    const MARCADOR = CLASES_DE_PARED[2];
    /*
     * **El grep va sobre el repo entero, no sobre `src/`**, porque el scope de
     * Tailwind es el repo entero: el marcador escrito en un test o en un `.md`
     * también lo mete en la hoja, y entonces el chequeo se auto-satisface. Es lo
     * que pasaba con este mismo caso hasta que el `auditor-privacidad` lo vio.
     */
    const buscarEnElRepo = (aguja: string): string[] => {
      try {
        return execFileSync(
          'grep',
          [
            '-rl',
            '--exclude-dir=node_modules',
            '--exclude-dir=dist',
            '--exclude-dir=.git',
            /*
             * **Y los worktrees**, que viven adentro de `.claude/` y son copias
             * enteras del repo: sin esto el grep encuentra el mismo archivo ocho
             * veces —una por frente en paralelo— y el caso falla diciendo que el
             * marcador «dejó de ser exclusivo» cuando lo único que pasó es que hay
             * otra copia del repo en el disco. Falló así al integrar la tanda del
             * 2026-09-03, con ocho worktrees abiertos.
             *
             * No afloja lo que el caso verifica: lo que se está preguntando es si
             * **este** árbol escribe el marcador en un solo lugar, y una copia de
             * trabajo de otro frente no es parte de este árbol.
             */
            '--exclude-dir=worktrees',
            aguja,
            raiz('.'),
          ],
          { encoding: 'utf8' },
        )
          .split('\n')
          .filter(Boolean)
          /*
           * A ruta relativa del árbol. El recorte de `agent-<id>/` solo servía
           * **adentro de un worktree**: en el árbol principal `grep` devuelve la
           * ruta absoluta con el `./` del argumento, así que el caso no podía
           * coincidir nunca y solo pasaba donde nació. Se normaliza contra la raíz
           * de verdad.
           */
          .map((f) => f.replace(raiz('.'), '').replace(/^\.?\//, ''));
      } catch {
        // `grep` sale con 1 cuando no encuentra nada: eso es «el marcador
        // desapareció del fuente», que es un resultado y no un error de plomería.
        return [];
      }
    };
    const enElRepo = buscarEnElRepo(MARCADOR);
    expect(
      enElRepo,
      `\`${MARCADOR}\` dejó de ser exclusivo de estilos.ts: mientras esté escrito ` +
        'en otro archivo escaneado, el chequeo del gate no prueba nada.',
    ).toEqual(['src/components/sitio/estilos.ts']);
  });
});

/**
 * ── Que las clases lleguen de verdad a la hoja, verificado sobre el artefacto ─
 * **Hasta el 2026-09-11 acá había un caso que leía `dist/_astro` y hacía
 * `if (hojas === '') return;`**, con esta frase en el docblock: «en CI el build
 * siempre corre». Era falsa, y es la misma clase que B-873 —de cuyo chequeo
 * salió este ítem, B-880—: en `deploy.yml` los tests son el paso 4 y el build el
 * paso 5, y en `push-main.yml` los tests son un job que no buildea nunca.
 *
 * **Y era peor que un `skipIf`**, que es por lo que B-880 no fue P3: sin `dist/`
 * el caso no se salteaba, **volvía temprano y se reportaba PASSED**. Medido el
 * 2026-09-11 moviendo el `dist/` local: `✓ y las tres salen de verdad en el CSS
 * construido 0ms`, verde, contado como aprobado, habiendo leído **cero bytes**.
 * Un salteado por lo menos aparece en el recuento; éste no dejaba ni esa huella.
 *
 * El chequeo vive ahora en **`scripts/verificar-bundle.sh`**, sección 4.2: el
 * paso que los dos workflows corren inmediatamente **después** del build, sobre
 * el mismo `dist/` que el paso siguiente sube a Hosting. Lo que queda de este
 * lado es manejar ese gate con `dist/` sintéticos, igual que
 * `tests/sin-comentarios-en-el-html.test.ts`. **Ningún caso de este archivo
 * depende de que exista un build**, así que ninguno se saltea ni miente.
 */
describe('el gate exige que la grilla del tríptico llegue a la hoja — B-600, B-880', () => {
  /** Las utilidades del mapa, que es de donde el gate también las saca. */
  const UTILIDADES = [
    ...new Set(Object.values(CLASES_DEL_TRIPTICO).flatMap((c) => c.split(' '))),
  ];
  const selectorDe = (clase: string): string => `.${clase.replace(/:/g, '\\:')}`;

  it('una hoja con las clases pasa, y el gate dice cuántas verificó', () => {
    /*
     * Control positivo. Sin él, los casos de abajo solo afirman ausencias y el
     * día que el gate deje de mirar la hoja pasarían todos igual — que es
     * exactamente la forma de mentir que trajo este ítem hasta acá.
     */
    const { estado, salida } = correrGate();
    expect(UTILIDADES.length, 'el mapa dejó de tener clases que verificar').toBeGreaterThan(2);
    expect(salida).toContain(`las ${UTILIDADES.length} utilidades de la grilla`);
    expect(estado, salida).toBe(0);
  });

  it.each(UTILIDADES)('sin `%s` en la hoja construida, rojo', (clase) => {
    /*
     * MUTACIÓN, una por clase del mapa: escribir el mapa con una clase que
     * Tailwind no emite —`lg:grid-cols-[2]` con un valor arbitrario que no
     * resuelve— produce exactamente esta hoja, y el gate la nombra.
     *
     * Se busca el **selector** (`.lg\:grid-cols-2`) y no la subcadena:
     * `grid-cols-2` a secas lo satisface `CLASES_DE_GALERIA`, que usa la misma
     * utilidad sin el `lg:` — o sea que el chequeo pasaría sin que la del
     * tríptico existiera.
     */
    const { estado, salida } = correrGate({
      '_astro/Base.css': hojaConLaGrilla().replace(`${selectorDe(clase)}{}`, ''),
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('no llegó al CSS construido');
    expect(salida).toContain(selectorDe(clase));
  });

  it('y sin el marcador exclusivo también, aunque estén las cuatro utilidades', () => {
    /*
     * **El caso que distingue este chequeo de uno que no prueba nada.** Las
     * cuatro utilidades del tríptico las escriben también otros archivos, así
     * que una hoja que las tenga todas y **no** tenga el marcador es
     * exactamente el artefacto que produce `components/sitio/estilos.ts` fuera
     * del scan de Tailwind: la grilla rota, el build verde.
     */
    const { estado, salida } = correrGate({
      '_astro/Base.css': hojaConLaGrilla().replace(`${selectorDe(CLASES_DE_PARED[2])}{}`, ''),
    });
    expect(estado).not.toBe(0);
    expect(salida).toContain('ninguna clase exclusiva de src/components/sitio/estilos.ts');
    expect(salida).toContain(selectorDe(CLASES_DE_PARED[2]));
  });
});
