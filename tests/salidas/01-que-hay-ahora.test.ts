/**
 * Salida 1, séptimo productor: el tríptico de «¿qué hay ahora?» (B-600).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { construirIndice } from '@/lib/eventsJson';
import { panelesDeAhora } from '@/lib/ahoraPublico';
import { coleccionSchema } from '@/lib/hubsPublicos';
import { RUTA_AGENDA } from '@/lib/rutasPublicas';
import { arancelDeTarjeta } from '@/lib/tarjetaPublica';
import { CENTINELA, LABELS_CENTINELA, actividadCentinela, conLinkPublico } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';

/**
 * §5 — barrido del **tríptico de «¿Qué hay ahora?»** — salida 1, **séptimo
 * productor**, B-600.
 *
 * ── Por qué es un productor de la salida 1 y no una salida nueva ──────────
 * Porque **no es una URL nueva**: es una sección del HTML de la home, que ya es
 * la salida 1 («`events.json` y el HTML del listado»). Tiene exactamente la forma
 * de los otros tres productores que esa salida fue sumando: `tarjetaPublica.ts`
 * (el cuarto, qué frases dice la fila), `identidad.ts`/`listadoPublico.ts` (el
 * quinto y sexto, de qué color se escribe la categoría) y `coleccionSchema` de
 * `hubsPublicos.ts` (el sexto del JSON-LD) — un módulo que decide **qué dice** el
 * HTML de la home con los campos que el índice ya trae, sin agregar una ruta
 * indexable.
 *
 * Numerarlo como «salida 13» habría sido, además, sumar una fila a las **tres
 * tablas atadas** por `tests/agentes-y-skills.test.ts` para una salida que no
 * recibe campos del modelo: quien agregue un campo nuevo tendría una celda más
 * que decidir y la respuesta sería siempre la misma que la de la salida 1.
 *
 * Lo que **sí** entra en el mismo cambio es este `describe`, y ese «en el mismo
 * cambio» es la lección de B-212 y de los hubs de la salida 11: el productor que
 * nace fuera del barrido se queda afuera, la suite queda verde igual —el índice
 * de salidas solo se compara consigo mismo— y el hueco no se nota hasta que
 * alguien lo busca.
 *
 * ── Por qué necesita el suyo, teniendo el del índice arriba ────────────────
 * Porque **no publica el índice: publica una derivación del índice**, y las dos
 * cosas que agrega son justo las que un barrido de la salida anterior no ve.
 *
 * 1. `panelesDeAhora` recibe la `EntradaDeIndice` **entera** y decide qué campos
 *    de ella salen a la pantalla. Lo que se emite es un puñado de strings ya
 *    resueltos (`titulo`, `lugar`, `tipoEtiqueta`, `arancel.texto`), pero la
 *    entrada de la que salen tiene `searchText` —la descripción entera,
 *    normalizada— y `resumen`, y nada de tipos impide imprimirlos. Es la misma
 *    forma del riesgo que hizo nacer la lista blanca de `FilaDeActividad`
 *    (`tests/listado-del-sitio.test.ts`), del lado del módulo puro.
 * 2. La `clave` de cada fila interpola el **id de sesión**, que hasta B-99 no
 *    salía por esta puerta.
 *
 * ── Qué se barre ──────────────────────────────────────────────────────────
 * El `JSON.stringify` de lo que el módulo devuelve, que es exactamente lo que el
 * componente recibe: el componente no lee ninguna `EntradaDeIndice` —eso lo
 * verifica `tests/listado-del-sitio.test.ts`—, así que barrer la salida del
 * módulo es barrer la sección entera.
 */
describe('barrido del tríptico de «¿qué hay ahora?» (§5, salida 1 · 7º productor, B-600)', () => {
  /*
   * El `ahora` cae **adentro** de la primera ventana del fixture: la primera
   * sesión centinela es el 3 de septiembre de 2026 a las 22:00 UTC (19:00 acá),
   * así que a las 11:00 de ese jueves el panel de «Hoy» la tiene. Con un `ahora`
   * de otro día los tres paneles saldrían vacíos, `panelesDeAhora` devolvería
   * `null` y el barrido correría sobre la nada — que es la forma en que un
   * barrido pasa sin verificar nada.
   */
  const AHORA = new Date('2026-09-03T14:00:00Z');
  const GENERADO_EN = '2026-09-03T12:00:00.000Z';

  const indice = () =>
    construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_paneles')],
      opciones: {},
      version: '1.8.0+abc1234',
      generadoEn: GENERADO_EN,
    });

  /**
   * Ocho centinelas en cinco grupos. Todo lo que **no** está acá el barrido lo
   * exige ausente, y ahí lo que más importa es lo que el índice sí lleva y esta
   * salida no tiene por qué mostrar: `searchText`, el `resumen` (o sea el
   * centinela de `descripcion`), `organizador.nombre`, `tallerista.nombre`,
   * `tags`, `imagenes.url` y la plataforma.
   */
  const PERMITIDO_EN_LOS_PANELES: readonly Excepcion[] = [
    {
      nombre: 'el título, que es lo que la fila dice',
      centinelas: ['titulo'],
      porque:
        'una fila del panel es «19:00 · Título · lugar»: sin el título no hay nada que ' +
        'leer. La **descripción** no está en esta lista y por eso el barrido la exige ' +
        'ausente: el panel es un cronograma de cuatro líneas, no una tarjeta.',
    },
    {
      nombre: 'el slug, que es el link al detalle',
      centinelas: ['slug'],
      porque:
        'toda la fila es un enlace a la página de la actividad (no hay página por ' +
        'encuentro, §2.3): el slug sale en la `ruta` y otra vez en la `clave`.',
    },
    {
      nombre: 'el id de sesión, adentro de la clave de la fila',
      centinelas: ['sesiones.id'],
      porque:
        'la `clave` es `slug#sesionId` — con el slug solo, dos encuentros del mismo ' +
        'ciclo en el mismo panel serían dos filas iguales para React. Es el uuid opaco ' +
        'del cliente (trampa 2), sin PII, y ya es público en la salida 6 y en el eje de ' +
        'encuentros del índice (B-99).',
    },
    {
      nombre: 'la etiqueta de la categoría',
      centinelas: ['labels.tipo'],
      porque:
        '§4.4 — la cajita de la categoría muestra la **etiqueta** resuelta contra ' +
        '`/opciones`, no el slug crudo, con la misma `etiquetaDe` del listado. El slug ' +
        'viaja aparte para pedirle el color a `estiloDeTipo` (D-150) y es un enum, así ' +
        'que no lleva centinela.',
    },
    {
      nombre: 'el lugar y el arancel, los dos vía `tarjetaPublica`',
      centinelas: [
        'sede.nombre',
        'labels.barrio',
        'labels.ciudad',
        'labels.provincia',
        'labels.arancel',
      ],
      porque:
        'la línea de lugar la arma `lugarDeTarjeta` —la misma del listado, de la página ' +
        'de mes, de /pasadas y de los hubs— y el arancel `arancelDeTarjeta`. ' +
        '**`sede.ciudad` se cambió por `labels.ciudad` en B-950**: la ciudad dejó de ser ' +
        'texto libre, así que este renglón la resuelve a su etiqueta igual que venía ' +
        'haciendo con el barrio. **`labels.provincia` tardó en aparecer acá y eso era el ' +
        'síntoma de un bug**: el primer `porque` decía que `zonaDeSede` no la emitía ' +
        'porque el mapa de etiquetas no la traía — las dos mitades eran falsas, y el ' +
        'motivo real era que `SedeDeIndice` no llevaba `provincia`. Lo encontró el ' +
        '`auditor-privacidad`; ahora la lleva y la pieza sale. La ' +
        '**dirección**, las indicaciones y las coordenadas NO están en esta lista: el ' +
        'índice no las lleva y el panel no las necesita. `labels.plataforma` tampoco ' +
        'está, y su ausencia NO es una prohibición: el fixture es `hibrido`, así que ' +
        'gana la rama de sede y la línea termina en «· y online». En una virtual pura ' +
        '`lugarDeTarjeta` sí imprime «Online por <etiqueta>», que es público (§4.1) — ' +
        'lo que nunca sale es el link, y eso lo afirma el `it` de `urlPublica: true`.',
    },
  ];

  it('sobreviven exactamente los centinelas que una fila del panel necesita', () => {
    const programacion = panelesDeAhora(indice(), AHORA, LABELS_CENTINELA);
    expect(programacion, 'el `ahora` quedó fuera de las tres ventanas').not.toBeNull();
    // Control positivo: el barrido tiene que estar mirando una fila de verdad.
    expect(programacion!.paneles.find((p) => p.clave === 'hoy')!.encuentros).toHaveLength(1);

    barrer(
      'tríptico de «¿qué hay ahora?»',
      JSON.stringify(programacion),
      PERMITIDO_EN_LOS_PANELES,
    );
  });

  it('el pie «+N más» y su ruta tampoco llevan nada de la actividad (B-791)', () => {
    /*
     * **Lo pidió el `auditor-privacidad`, y el hueco era de rama y no de campo.**
     * Los ocho centinelas del fixture son sesiones **semanales**, así que con este
     * `ahora` sobrevive un solo panel con **una** fila: `restantes = 0`, o sea
     * `resto: null` y `rutaDelResto: null`. El barrido de arriba recorre el objeto
     * entero, pero los dos campos que B-791 agregó los ve **solo en su rama
     * nula** — que es una manera de pasar sin verificar nada.
     *
     * Se fuerza la otra rama con el tope en 1: el panel de «Hoy» queda con un
     * encuentro afuera, y entonces el pie y su ruta salen con contenido.
     *
     * Qué frena, concretamente: `rutaDelResto` se arma **interpolando**
     * (`${RUTA_AGENDA}?cuando=${…}`), y el próximo pedido razonable sobre ese pie
     * es «que el listado ya llegue buscando esto» —un `&q=${entrada.titulo}`—.
     * Eso compila, se ve bien, y publica en la query de la portada lo que el pie
     * no tiene por qué llevar. Es el mismo motivo por el que la salida 8 se barre
     * en sus dos ramas: una de sus frases interpola.
     *
     * MUTACIÓN PROBADA: agregarle `&q=${encodeURIComponent(resueltos[0]?.titulo)}`
     * a `rutaDelResto` deja este caso en rojo nombrando `titulo →
     * CENTINELA.titulo`, y **no** deja en rojo al barrido de arriba. El
     * `encodeURIComponent` no lo salva: el centinela no tiene espacios ni acentos,
     * así que sobrevive al escape — que es justo lo que hace útil que los
     * centinelas sean `CENTINELA.<ruta>` y no prosa.
     */
    const dos = construirIndice({
      actividades: [
        toPublic(actividadCentinela(), 'act_paneles'),
        toPublic(actividadCentinela({ slug: 'otra-centinela' }), 'act_paneles_2'),
      ],
      opciones: {},
      version: '1.8.0+abc1234',
      generadoEn: GENERADO_EN,
    });
    const programacion = panelesDeAhora(dos, AHORA, LABELS_CENTINELA, 1);
    const hoy = programacion!.paneles.find((p) => p.clave === 'hoy')!;

    // Control positivo: sin esto el caso barrería otra vez la rama nula.
    expect(hoy.encuentros, 'el tope de 1 no cortó').toHaveLength(1);
    expect(hoy.resto, 'no quedó nada afuera, así que no hay pie que barrer').not.toBeNull();
    expect(hoy.rutaDelResto).not.toBeNull();

    barrer('pie del tríptico', `${hoy.resto} ${hoy.rutaDelResto}`, []);
  });

  it('el sello de frescura no lleva ningún dato del documento', () => {
    /*
     * Sale de `generadoEn`, que es del archivo y no de ninguna actividad. Se
     * afirma aparte porque es la única cadena de la salida que no viene de una
     * fila, y el atajo tentador —«decir de cuándo es el dato más nuevo»— sería
     * interpolar el título de una actividad ahí arriba.
     */
    const programacion = panelesDeAhora(indice(), AHORA, LABELS_CENTINELA);
    // Sin la hora desde B-792: el minuto del build es la agenda de trabajo del
    // admin (D-138). Ver el docblock de `selloDelIndice`.
    expect(programacion!.sello).toBe('Actualizado: jue 3 sep');
    barrer('sello del tríptico', programacion!.sello, []);
  });

  it('con `urlPublica: true` el link de la reunión tampoco entra al tríptico', () => {
    /*
     * La misma celda que la salida 3 (el índice) decidió: aunque el dueño haya
     * elegido publicar el link, el panel no lo necesita —la fila lleva a la
     * página de detalle, que es donde está el botón— y servirlo en la portada de
     * la home es lo que hace barato el zoombombing (trampa 5).
     *
     * La lista de permitidos va **sin agregarle `online.url`**, y eso es la
     * afirmación.
     */
    const abierta = construirIndice({
      actividades: [toPublic(actividadCentinela(conLinkPublico()), 'act_abierta')],
      opciones: {},
      version: '1.8.0+abc1234',
      generadoEn: GENERADO_EN,
    });
    barrer(
      'tríptico (link de reunión publicado a mano)',
      JSON.stringify(panelesDeAhora(abierta, AHORA, LABELS_CENTINELA)),
      PERMITIDO_EN_LOS_PANELES,
    );
  });

  it('CONTROL NEGATIVO: si la fila llevara la entrada entera, el barrido lo dice', () => {
    /*
     * El atajo que este `describe` existe para frenar, y no es hipotético: es
     * **una línea** —pasar `entrada` en vez de los cuatro strings decididos— y
     * compila, porque el componente ya recibe el objeto de la fila. Publicaría en
     * la portada de la home el `searchText` (la descripción entera, normalizada)
     * y el `resumen` de cada una de las doce actividades del tríptico.
     *
     * Se exige que el barrido falle **nombrando** `searchText`, que es el campo
     * más caro de los que el índice lleva y el panel no muestra.
     */
    const programacion = panelesDeAhora(indice(), AHORA, LABELS_CENTINELA)!;
    const entrada = indice().actividades[0]!;
    const conFuga = {
      ...programacion,
      paneles: programacion.paneles.map((p) => ({
        ...p,
        encuentros: p.encuentros.map((e) => ({ ...e, entrada })),
      })),
    };

    let mensaje = '';
    try {
      barrer(
        'tríptico (mutación: la entrada entera en la fila)',
        JSON.stringify(conFuga),
        PERMITIDO_EN_LOS_PANELES,
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó la entrada entera en la fila').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('searchText');
  });
});
