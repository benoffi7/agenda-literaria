/**
 * B-82: todo trigger con efecto duplicable se blinda.
 *
 * Una clase de bug con red, partida de `tests/clases-de-bug.test.ts` (PRD 6,
 * M-12). Qué es una clase, cómo leer los `it.fails` y lo que comparten todas:
 * `tests/fixtures/clases-de-bug.ts`.
 */
import { describe, expect, it } from 'vitest';
import { fuente, type Trigger, triggers, TRIGGERS, primero, sinComentarios, importesDe, enFunctions, type Traza, trazar, comoDeclaracion, trazaDe, RE_CLAVE_DERIVADA, guardaPorClave, guardaPorReclamo, tieneGuardaDeReentrega, trazaFingida, marcasDe } from '../fixtures/clases-de-bug';

const deDocumento = TRIGGERS.filter((t) => t.clase !== 'onSchedule');


/**
 * Qué cuenta como «hablar con la red» en este archivo: un `fetch`, el cliente de
 * Calendar, y **cualquier cliente de `googleapis`** — B-862.
 *
 * ── Por qué `google\.\w+\(` y no `google\.calendar\(` ──────────────────────
 * El detector reconocía las formas que ya había visto y no la que hay.
 * `traerAnaliticaDelSitio` habla con GA4 y con Search Console por
 * `google.analyticsdata(` y `google.searchconsole(`, así que daba `red: false`:
 * el mismo tipo de ceguera que B-845 cerró del otro lado —allá el verbo estaba
 * en el módulo de al lado, acá el verbo era otro—.
 *
 * **Medido antes de ensancharlo, que es lo que el ítem pedía y no al revés:** de
 * los once triggers, el único que cambia de respuesta es
 * `traerAnaliticaDelSitio`, y entra por su helper `clientes` —el único helper de
 * todo `functions/**` que el regex nuevo suma—. **Ninguno pasa a estar en la
 * clase de B-85**, y de ése el motivo es preciso: no lee estado, así que le
 * falta el primer síntoma y no solo el segundo. Está afirmado abajo
 * (`el detector de red ve los clientes de googleapis`), así que el día que
 * alguien le agregue el `.get()` que el comentario de la lista de triggers
 * anticipa, el chequeo lo ve en vez de dejarlo pasar.
 *
 * Se declara **una sola vez** y la usan los dos lados que la necesitan —los
 * helpers locales de un archivo y los nombres que ese archivo importa—. Eran dos
 * copias literales del mismo criterio, o sea la clase de B-88 esperando a que
 * alguien ensanchara una sola de las dos.
 */
const RE_RED = /\bfetch\(|cal\.events\.|\bgoogle\.\w+\(/;


/**
 * Helpers del módulo que llegan a la red. Se derivan del fuente para que un
 * helper nuevo con `fetch` adentro cuente sin que nadie lo agregue a una lista.
 */
const helpersConRed = (src: string): string[] =>
  [...src.matchAll(/const (\w+) = (?:async )?\(?[^=]*?\)? =>/g)]
    .map((m) => ({ nombre: m[1]!, desde: m.index! }))
    .filter(({ desde }, i, todos) => {
      const hasta = todos[i + 1]?.desde ?? src.length;
      return RE_RED.test(src.slice(desde, hasta));
    })
    .map(({ nombre }) => nombre);


/** Lo mismo, sin seguir ninguna llamada: sirve para saber si seguirla cambió algo. */
const trazaSuperficial = (t: Trigger): Traza => trazar(comoDeclaracion(t), () => null);


/** ¿Este trigger produce un efecto que no se puede deshacer emitiéndolo dos veces? */
const tieneEfectoDuplicable = (t: Trigger): boolean => trazaDe(t).marcas.includes('E');

describe('clase de B-82 · todo trigger con efecto duplicable se blinda', () => {
  it('hay triggers con efecto duplicable y hay al menos dos ya blindados', () => {
    const conEfecto = deDocumento.filter(tieneEfectoDuplicable);
    // Los positivos: sin al menos dos, el detector podría estar midiendo
    // cualquier cosa y el chequeo de abajo daría un verde vacío.
    expect(conEfecto.length).toBeGreaterThanOrEqual(2);
    // Y el negativo, que es la otra mitad: un detector que dijera "todo efecto
    // es duplicable" también daría un verde vacío, con la lista llena.
    expect(deDocumento.length).toBeGreaterThan(conEfecto.length);

    // Se afirma la propiedad y no la lista. Enumerar los blindados obliga a
    // editar este test con cada trigger nuevo, y un test que hay que actualizar
    // para que siga pasando se termina actualizando sin pensar — que es como se
    // apagan los chequeos. B-41 agregó `guardarVersionAlBorrar` y la lista
    // enumerada lo dio por regresión.
    const blindados = conEfecto.filter(tieneGuardaDeReentrega).map((t) => t.nombre);
    expect(blindados.length, `blindados: ${blindados.join(', ')}`).toBeGreaterThanOrEqual(2);

    // Las dos formas de blindaje están vivas. Que exista un ejemplo de cada una
    // es lo que mantiene honestas a las dos ramas del detector: si una se
    // apagara, la otra sola seguiría dando verde.
    expect(conEfecto.filter(guardaPorClave).length).toBeGreaterThanOrEqual(1);
    expect(
      conEfecto.filter((t) => guardaPorReclamo(trazaDe(t).marcas)).length,
    ).toBeGreaterThanOrEqual(1);
  });

  /**
   * La razón por la que este archivo tuvo que rehacerse (B-171): hoy el efecto y
   * la guarda de los triggers blindados **no están en el cuerpo del trigger**.
   * Si algún día volvieran todos al cuerpo, seguir la llamada dejaría de aportar
   * y este test avisa — no para volver atrás, sino para que nadie crea que el
   * seguimiento está cubierto cuando ya no se ejercita.
   */
  it('seguir la llamada es lo que hace visible el efecto y la guarda', () => {
    const efectoSoloEnHelper = deDocumento.filter(
      (t) => !trazaSuperficial(t).marcas.includes('E') && trazaDe(t).marcas.includes('E'),
    );
    expect(efectoSoloEnHelper.map((t) => t.nombre).length).toBeGreaterThanOrEqual(1);

    const guardaSoloEnHelper = deDocumento.filter(
      (t) =>
        guardaPorClave(t) &&
        !RE_CLAVE_DERIVADA.test(sinComentarios(t.cuerpo)) &&
        tieneEfectoDuplicable(t),
    );
    expect(guardaSoloEnHelper.map((t) => t.nombre).length).toBeGreaterThanOrEqual(1);
  });

  /**
   * B-82 cerrado: `syncCalendar` elige el id del evento de Calendar derivándolo
   * del id de sesión (`idDeEvento`), así que un `insert` repetido choca con el
   * que ya existe y devuelve 409 en vez de crear un segundo evento.
   *
   * Era `it.fails` mientras la clase estaba viva. Pasó a `it` con el arreglo —
   * y no antes, porque el detector viejo no veía la guarda nueva: el `it.fails`
   * siguió "pasando" (fallando) un tiempo después de que el bug estaba
   * arreglado. Un detector ciego no solo pierde regresiones: también miente
   * sobre lo que sigue roto.
   *
   * Vale para el trigger que se agregue mañana: un `onDocumentWritten` nuevo con
   * un `fetch` adentro y sin guarda cae acá el día que se escribe, y ahora
   * también si el `fetch` lo hace un helper.
   */
  it('B-82: ningún trigger con efecto duplicable decide solo con el payload', () => {
    const sinGuarda = deDocumento
      .filter(tieneEfectoDuplicable)
      .filter((t) => !tieneGuardaDeReentrega(t))
      .map((t) => `${t.archivo} · ${t.nombre}`);
    expect(sinGuarda).toEqual([]);
  });

  /**
   * Clase prima (B-85): leer estado → llamar a la red → escribir el estado
   * leído. La escritura no compara contra lo que hay, así que se come el cambio
   * que llegó mientras la llamada estaba en vuelo. Pasa cuando el efecto de
   * red no es un evento entregado sino un tick del schedule.
   *
   * **Qué lo haría pasar:** que la escritura del resultado ocurra dentro de una
   * transacción que verifique que el estado sigue siendo el que se leyó.
   */
  /**
   * Los nombres que, llamados desde este archivo, llegan a la red: los helpers
   * locales **y los importados de otro archivo de `functions/`**.
   *
   * Lo segundo lo trajo B-77, y sin eso este chequeo se apagaba en silencio: el
   * cliente HTTP de GitHub dejó de estar inline en el trigger y pasó a
   * `github.js`, así que `helpersConRed` del archivo del trigger devolvía `[]`,
   * la alternativa vacía del regex hacía que `red` cayera en el primer paréntesis
   * del cuerpo, y `lectura < red` daba falso. Verde, sin haber mirado nada — que
   * es el modo de falla exacto que este archivo persigue en el código ajeno.
   */
  const nombresConRed = (archivo: string): string[] => {
    const locales = helpersConRed(fuente(archivo));
    const importados = [...importesDe(archivo).keys()].filter((nombre) => {
      const decl = enFunctions(archivo, nombre);
      return !!decl && RE_RED.test(decl.cuerpo);
    });
    return [...new Set([...locales, ...importados])];
  };

  const reDeRed = (archivo: string) =>
    new RegExp(`\\b(${[...nombresConRed(archivo), 'fetch'].join('|')})\\(`);

  const laRedDe = (t: Trigger) => primero(t.cuerpo, reDeRed(t.archivo));

  it('el detector de red encuentra la llamada aunque viva en otro archivo', () => {
    // El positivo que impide el verde vacío del chequeo de abajo: si ningún
    // schedule tiene una llamada a la red detectable, ese chequeo no está
    // midiendo nada. `dispararRebuild` la tiene, importada de `github.js`.
    const conRed = TRIGGERS.filter((x) => x.clase === 'onSchedule').filter(
      (t) => laRedDe(t) !== Infinity,
    );
    expect(conRed.map((t) => t.nombre)).toContain('dispararRebuild');
  });

  /**
   * ── B-845: el chequeo mira la traza, no el cuerpo del trigger ─────────────
   *
   * Lo mismo que B-171 le hizo al detector de B-82, y por el mismo motivo.
   * Hasta acá los cuatro síntomas se buscaban en `t.cuerpo`, y desde
   * que el repo adoptó el corte puro/pegamento (B-77) los verbos viven en el
   * módulo de al lado: `limpiarImagenesHuerfanas`, `limpiarVersionesHuerfanas` y
   * `borrarPropuestasVencidas` no tienen `.get()`, `.set()` ni `.update()`
   * literales en el trigger, así que **ninguno de los tres pasaba por el
   * chequeo**. Verificado con el control positivo antes de tocar nada: la misma
   * copia mala daba rojo escrita en `retencion-trigger.js` y verde escrita una
   * llamada más allá, en `retencion.js`. Está congelado abajo, en
   * `describe('el detector de B-85 sigue la llamada al módulo')`.
   *
   * Se reusa `trazaDe` —el recorrido que ya existe— y no se escribe un segundo:
   * el texto que se mira es el cuerpo del trigger más el de todo lo que llama,
   * ya sin comentarios (que además arregla de arriba el falso positivo de la
   * prosa: `laRedDe` busca sobre `t.cuerpo` **con** comentarios).
   *
   * ── Y por eso el orden dejó de ser parte de la condición ──────────────────
   * La versión anterior pedía `lectura < red < escritura`. Sobre una traza ese
   * orden **no se puede leer**: `cuerpos` es el cuerpo del trigger entero y
   * después los de los helpers en orden de llamada, no el programa inlineado.
   * Medido sobre `dispararRebuild`, que es la instancia original de B-85: su
   * `fetch` cae en el texto **después** de su `ref.set(fallo)`, o sea que
   * `red < escritura` daría falso y la clase viva se escaparía por un artefacto
   * de la concatenación. Pedir la conjunción y no el orden es más estricto y es
   * lo correcto: el daño es escribir lo leído del otro lado de una llamada
   * larga, y el único blindaje que este repo acepta para eso es la transacción.
   *
   * Más estricto no salió ruidoso, y no es una esperanza: los tres barridos
   * pasan por **no hablar con la red** (`red: false`, afirmado abajo) y
   * `dispararRebuild` pasa por su transacción, con los tres síntomas prendidos
   * (también afirmado abajo, que es el positivo que impide el verde vacío).
   *
   * **Ese primer motivo se corrigió en B-867 y conviene leerlo como cambió:**
   * decía «pasan porque borran (`escritura: false`)», que era la ceguera del
   * detector —el efecto definido como `set|update`— escrita como garantía. Hoy
   * los tres dan `escritura: true` y lo que los deja afuera es la red que no
   * tienen, que es un motivo más débil; la ventana propia de un barrido la cubre
   * (o no) su guarda declarada, abajo.
   *
   * **Y B-879 le sacó también ese segundo motivo.** La red de un barrido no es
   * un `fetch`: es la corrida entera —la query del principio, N borrados de
   * Storage, cada uno con su round-trip— y en esa ventana el estado leído
   * envejece igual que del otro lado de una llamada HTTP. Contar solo el
   * `fetch` era aceptar la guarda **implícita**: la función pasaba por lo que
   * no tenía. Desde B-879 el chequeo principal no mira la red para dejar pasar
   * a nadie; lo que saca a una función programada que escribe lo que leyó es la
   * transacción o su guarda **declarada** en `GUARDAS_DE_BARRIDO`, con las
   * marcas presentes en el fuente. El detector de red sigue, y ahora dice otra
   * cosa: una guarda que **acepta** la ventana intra-corrida la aceptó para una
   * corrida sin llamadas largas, así que con red deja de alcanzar.
   */
  const textoTrazado = (t: Trigger): string => trazaDe(t).cuerpos.join('\n');

  type Sintomas = { lectura: boolean; red: boolean; escritura: boolean; transaccion: boolean };

  const sintomasDeB85 = (texto: string, red: RegExp): Sintomas => ({
    lectura: /\.get\(\)/.test(texto),
    red: red.test(texto),
    /*
     * **`.delete(` cuenta como escritura desde B-867**, y sin eso un barrido que
     * borra lo que leyó era invisible: el efecto estaba definido como
     * `set|update`, así que «leer al principio de la corrida y borrar segundos
     * después sin comparar la versión» —la forma exacta de B-864— salía limpio.
     * Y la ceguera venía **afirmada**: el caso de abajo decía que los tres
     * barridos «pasan porque borran», o sea que congelaba como garantía justo lo
     * que el detector no estaba mirando. Es la misma clase que B-845, del tercer
     * lado: allá el efecto se escapaba por vivir en el módulo de al lado, acá
     * por llamarse de otra manera.
     *
     * **Medido antes de ensancharlo:** suma cuatro triggers y ninguno pasa a
     * estar en la clase —los tres barridos (`limpiarImagenesHuerfanas`,
     * `limpiarVersionesHuerfanas`, `borrarPropuestasVencidas`) y
     * `borrarImagenAlCerrar`, que no lee nada—, porque a los cuatro les falta la
     * red. Por eso el ensanche solo no alcanza y abajo va la otra mitad: la
     * guarda declarada barrido por barrido.
     *
     * El falso positivo posible es el de siempre con un verbo más: un `Map` en
     * memoria tiene `.set(` y también `.delete(`. Los casos de abajo dicen, uno
     * por uno, de dónde sale el borrado de cada barrido.
     */
    escritura: /\.(set|update|delete)\(/.test(texto),
    transaccion: /runTransaction\(/.test(texto),
  });

  /**
   * ¿Se come el cambio que llegó mientras la llamada a la red estaba en vuelo?
   * Es la forma de B-85 con la red explícita, y la usan los cuerpos sintéticos
   * de `el detector de B-85 sigue la llamada al módulo`. El chequeo sobre el
   * repo es más estricto desde B-879 y no pide la red (`cubreLaVentana`, abajo).
   */
  const pierdeElCambio = (s: Sintomas): boolean =>
    s.lectura && s.red && s.escritura && !s.transaccion;

  const sintomasDe = (t: Trigger): Sintomas => sintomasDeB85(textoTrazado(t), reDeRed(t.archivo));

  const programadas = TRIGGERS.filter((x) => x.clase === 'onSchedule');

  /*
   * B-879 — el registro contra el que se decide vive abajo, con la otra mitad
   * de B-867; `cubreLaVentana` se lee recién cuando corre el caso.
   */
  it('B-85: ninguna función programada escribe lo que leyó sin transacción ni guarda declarada — B-879', () => {
    const pierden = programadas
      .filter((t) => !cubreLaVentana(t))
      .map((t) => `${t.archivo} · ${t.nombre}`);
    expect(pierden).toEqual([]);
  });

  /**
   * El positivo del chequeo de arriba: sin un schedule que encienda los cuatro
   * síntomas, ese `toEqual([])` podría estar pasando porque el detector no
   * enciende ninguno. `dispararRebuild` es la instancia original de B-85 y pasa
   * por el único motivo aceptado — la transacción de `registrarExito`.
   */
  it('dispararRebuild pasa por la transacción y no por falta de síntomas', () => {
    const t = programadas.find((x) => x.nombre === 'dispararRebuild')!;
    const { lectura, red, escritura, transaccion } = sintomasDe(t);
    expect({ lectura, red, escritura }).toEqual({ lectura: true, red: true, escritura: true });
    expect(transaccion).toBe(true);
  });

  /**
   * El detector de red, contra el archivo que lo destapó — B-862.
   *
   * Dos mitades que no se implican: que el regex nuevo **vea** los clientes de
   * `googleapis` (el positivo; sin esto el ensanche podría no haber cambiado
   * nada y nadie se enteraría), y que lo que mantiene a ese schedule fuera de la
   * clase sea **la lectura que no tiene** y no la red que el detector no veía.
   * La segunda es la que se pone roja el día que alguien le agregue un `.get()`
   * —un cursor de la última ventana traída, que es el caso que el comentario de
   * la lista de triggers anticipa—, y ese día el chequeo de arriba lo agarra.
   */
  it('el detector de red ve los clientes de googleapis, y la analítica queda afuera por la lectura', () => {
    expect(nombresConRed('functions/analitica-trigger.js')).toContain('clientes');
    const t = programadas.find((x) => x.nombre === 'traerAnaliticaDelSitio')!;
    const { lectura, red, escritura } = sintomasDe(t);
    expect({ red, escritura }).toEqual({ red: true, escritura: true });
    expect(lectura, 'la analítica lee estado: ahora está en la clase de B-85').toBe(false);
  });

  /**
   * Y el otro lado, que es lo que B-845 vino a poder afirmar y **B-867
   * corrigió**: los tres barridos del corte puro/pegamento entran al chequeo, y
   * lo que se afirma de ellos cambió de mitad.
   *
   * La versión anterior de este caso decía «pasan **porque borran**», y eso era
   * la ceguera del detector escrita como garantía: pasaban porque el efecto
   * estaba definido como `set|update`, no porque borrar fuera inocuo. B-864 es
   * el contraejemplo exacto —`borrarPropuestasVencidas` tenía la forma de B-85
   * en su versión `delete`— y este caso la daba por buena.
   *
   * Ahora los tres dan `escritura: true` —el borrado se ve—. Hasta B-879
   * pasaban por la única mitad que les quedaba, **no hablar con la red**, y eso
   * era un motivo más débil que el anterior: la ventana de un barrido no es un
   * `fetch`, es la corrida —hasta 50 documentos, cada uno con su borrado de
   * Storage en el medio—. **Desde B-879 ese motivo no cuenta**: sin su guarda
   * declarada abajo, cada uno de los tres cae en el chequeo principal, y el
   * caso siguiente lo afirma para que el registro no se pueda vaciar en verde.
   *
   * Se enumeran a propósito, contra la doctrina de este archivo de afirmar la
   * propiedad y no la lista: son los tres casos que el chequeo no veía. Un
   * barrido nuevo no tiene que entrar acá — entra solo al chequeo de arriba y a
   * la declaración de guardas de abajo, que es donde importa.
   */
  const BARRIDOS = [
    'limpiarImagenesHuerfanas',
    'limpiarVersionesHuerfanas',
    'borrarPropuestasVencidas',
  ];

  it('los tres barridos entran al chequeo con su borrado a la vista — B-867', () => {
    for (const nombre of BARRIDOS) {
      const t = programadas.find((x) => x.nombre === nombre)!;
      const s = sintomasDe(t);
      expect(s.lectura, `${nombre}: el chequeo no ve su lectura`).toBe(true);
      expect(s.escritura, `${nombre}: el chequeo no ve su borrado`).toBe(true);
    }
  });

  /**
   * **B-879 — el positivo del chequeo principal.** Que los barridos pasen hoy
   * no dice nada si pasarían igual sin declarar nada, que era exactamente el
   * estado de antes: la guarda aceptada por falta de `fetch`. Con el registro
   * vacío, los tres —y todo lo que el registro declara— tienen que caer.
   */
  it('sin su guarda declarada, cada barrido cae en el chequeo principal — B-879', () => {
    for (const nombre of Object.keys(GUARDAS_DE_BARRIDO)) {
      const t = programadas.find((x) => x.nombre === nombre)!;
      expect(cubreLaVentana(t), `${nombre}: no cubre su ventana`).toBe(true);
      expect(cubreLaVentana(t, {}), `${nombre}: pasa sin declarar su guarda`).toBe(false);
    }
    for (const nombre of BARRIDOS) expect(Object.keys(GUARDAS_DE_BARRIDO)).toContain(nombre);
  });

  /**
   * ── La otra mitad de B-867: qué protege a cada barrido ────────────────────
   *
   * Con el borrado a la vista, los tres barridos son funciones programadas que
   * **escriben lo que leyeron** y **no** usan transacción. Lo único que hoy los
   * saca de la clase de B-85 es no tener una llamada a la red en el medio, y eso
   * no dice nada sobre la ventana que sí tienen: entre la query del principio de
   * la corrida y el borrado pasan segundos, y en esos segundos un admin puede
   * tocar lo que se va a borrar. Es B-864 palabra por palabra.
   *
   * Hoy **uno de los tres tiene guarda de versión y los otros dos no**, y hasta
   * acá nada nombraba la diferencia — `MARGEN_DE_GRACIA_MS` parece una guarda de
   * lo mismo y es de otra cosa. Este registro la nombra, con tres formas
   * aceptadas:
   *
   *  - **`precondicion`** — el borrado lleva la versión que la lectura vio
   *    (`delete({ lastUpdateTime })`): si alguien la tocó en el medio, falla en
   *    vez de pisar. Es la única que cubre la ventana intra-corrida.
   *  - **`generacion`** — lo leído lleva un número de versión del almacén que el
   *    efecto compara. **No hay ninguna hoy**, y está en el vocabulario a
   *    propósito: es la forma que le faltaría a la mitad de Storage de B-838, y
   *    tenerla escrita hace que elegir entre las tres sea una decisión y no un
   *    olvido.
   *  - **`margen`** — no se toca nada más nuevo que N. **No cubre la ventana
   *    intra-corrida**: protege contra «esto recién se creó», no contra «esto
   *    cambió mientras yo corría». Por eso la declaración obliga a escribir el
   *    motivo por el que se acepta esa ventana.
   *
   * El conjunto sobre el que se exige la declaración **se deriva del código** —
   * toda función programada que escribe lo que leyó sin transacción—, así que un
   * barrido nuevo se pone rojo hasta que alguien decida cuál es su guarda, y uno
   * que deje de serlo (porque se metió en una transacción) también, para que no
   * quede una fila contando una protección que ya nadie tiene.
   */
  type GuardaDeBarrido = {
    guarda: 'precondicion' | 'generacion' | 'margen';
    donde: string;
    /**
     * **Dos anclas y no una: la declaración y el uso.** Una constante de margen
     * declarada y no aplicada es una guarda que no existe, y con una sola ancla
     * el registro quedaría afirmando una protección que el código ya no hace.
     */
    marcas: RegExp[];
    ventana: 'cubierta' | 'aceptada';
    porque: string;
  };

  const GUARDAS_DE_BARRIDO: Record<string, GuardaDeBarrido> = {
    borrarPropuestasVencidas: {
      guarda: 'precondicion',
      donde: 'functions/retencion.js',
      marcas: [/\.delete\(\{\s*lastUpdateTime/, /ahora\.updateTime\.isEqual\(visto\)/],
      ventana: 'cubierta',
      porque:
        'B-864 — `borrarPropuesta` relee con `getAll(ref, { fieldMask: [] })` y borra el ' +
        'documento con `delete({ lastUpdateTime: visto })`, así que la propuesta que un admin ' +
        'tocó entre la query y el borrado sobrevive y la corrida la cuenta como `rescatadas`. ' +
        'La mitad de Storage no está cubierta —es el final `la-tocaron-tarde`— y eso es lo que ' +
        'una guarda de `generacion` cerraría. Y desde B-1370 el `finally` del mismo trigger ' +
        'corre una segunda mitad, `barrerOriginalesConCopia` (functions/propuestas.js), que borra ' +
        'el original de una aceptada cuya actividad ya tiene copia: esa no se protege con una ' +
        'precondición sino releyendo la propuesta y re-verificando la copia en el documento y ' +
        'en el bucket (`borrarOriginalAlAceptar`, B-863) justo antes del `delete()`. Y desde ' +
        'B-871 corre una tercera, `barrerFlyeresDePropuestas`, que borra con `borrarFlyer` el ' +
        'original de una aceptada vencida y el flyer huérfano: la aceptada se relee y se compara ' +
        'su `updateTime` contra el visto (`la-tocaron`), y el huérfano vuelve a preguntar si ' +
        'algún documento nombra el objeto (`lo-nombran`) antes del `delete()`.',
    },
    borrarFichasVencidas: {
      guarda: 'precondicion',
      donde: 'functions/retencion.js',
      marcas: [
        /borrarFicha = async \(db, coleccion, \{ id, visto \}\)/,
        /await ref\.delete\(\{ lastUpdateTime: visto \}\)/,
      ],
      ventana: 'cubierta',
      porque:
        'B-904/B-912/B-917 — `borrarFicha` relee con `getAll(ref, { fieldMask: [] })` y borra ' +
        'con `delete({ lastUpdateTime: visto })`, así que la ficha que un admin reabre entre la ' +
        'query y el borrado sobrevive y la corrida la cuenta como `rescatadas`. **Y acá la ' +
        'ventana está cubierta entera**, a diferencia de su vecino: este barrido no borra nada ' +
        'de Storage —las fotos de una ficha viven en `imagenes/` y las levanta ' +
        '`limpiarImagenesHuerfanas` desde B-922—, así que no existe la mitad sin precondición ' +
        'que allá obligó a elegir cuál perder.',
    },
    limpiarImagenesHuerfanas: {
      guarda: 'margen',
      donde: 'functions/limpieza-imagenes.js',
      marcas: [
        /export const MARGEN_DE_GRACIA_MS/,
        /ahora - objeto\.creado < MARGEN_DE_GRACIA_MS/,
      ],
      ventana: 'aceptada',
      porque:
        'MARGEN_DE_GRACIA_MS (72 h) cubre el objeto recién subido cuya actividad todavía no se ' +
        'guardó, que es el caso que B-221 nombra. **No cubre la ventana intra-corrida**: un ' +
        'objeto viejo que alguien empieza a referenciar mientras el barrido corre se borra ' +
        'igual. Se acepta porque el daño es una fila de galería que hay que volver a subir, y ' +
        'porque `file().delete()` no admite la precondición que Firestore sí tiene (lo dice ' +
        '`borrarPropuesta` en `retencion.js` para la misma mitad).',
    },
    limpiarVersionesHuerfanas: {
      guarda: 'margen',
      donde: 'functions/limpieza-versiones.js',
      marcas: [/export const MARGEN_DE_RESCATE_MS/, /margenMs = MARGEN_DE_RESCATE_MS/],
      ventana: 'aceptada',
      porque:
        'MARGEN_DE_RESCATE_MS (30 días desde la versión más nueva) es el plazo del «la borré sin ' +
        'querer» de B-89. **No cubre la ventana intra-corrida** —una actividad recreada con el ' +
        'mismo id mientras el barrido corre pierde el historial que acababa de dejar de ser ' +
        'huérfano— y se acepta porque para eso tienen que coincidir 30 días de orfandad con los ' +
        'segundos de una corrida.',
    },
  };

  /** Escribe lo que leyó y no lo hace dentro de una transacción. */
  const escribeLoQueLeyoSinTransaccion = (t: Trigger): boolean => {
    const s = sintomasDe(t);
    return s.lectura && s.escritura && !s.transaccion;
  };

  /**
   * **B-879 — la guarda se exige, no se acepta implícita.** Una función
   * programada que escribe lo que leyó sin transacción cubre su ventana solo si
   * declara la guarda **y** la guarda está en el fuente (las dos marcas). Que no
   * hable con la red ya no la saca: la red de un barrido es la corrida.
   *
   * La red vuelve a importar en un solo lugar, y a propósito: una guarda que
   * **acepta** la ventana intra-corrida (`margen`) la aceptó con un motivo
   * escrito para una corrida **sin** llamadas largas. Si le aparece un `fetch`,
   * la ventana que se aceptó dejó de ser ésa, y hay que volver a decidir. Una
   * que la **cubre** (`precondicion`) no depende de cuánto dure la corrida.
   */
  const cubreLaVentana = (
    t: Trigger,
    guardas: Record<string, GuardaDeBarrido> = GUARDAS_DE_BARRIDO,
  ): boolean => {
    if (!escribeLoQueLeyoSinTransaccion(t)) return true;
    const g = guardas[t.nombre];
    if (!g) return false;
    const src = sinComentarios(fuente(g.donde));
    if (!g.marcas.every((m) => m.test(src))) return false;
    return g.ventana === 'cubierta' || !sintomasDe(t).red;
  };

  it('B-867: todo barrido que borra lo que leyó declara cuál es su guarda', () => {
    const derivados = programadas.filter(escribeLoQueLeyoSinTransaccion).map((t) => t.nombre);
    // Las dos direcciones: uno nuevo entra sin que nadie lo agregue, y una fila
    // que sobra —el barrido que se metió en una transacción, o que se borró— no
    // se queda contando una protección que ya no existe.
    expect(derivados.sort()).toEqual(Object.keys(GUARDAS_DE_BARRIDO).sort());
    // Y los tres de B-845 siguen ahí: si el derivado se vaciara, el `toEqual` de
    // arriba se podría satisfacer vaciando el registro.
    for (const nombre of BARRIDOS) expect(derivados).toContain(nombre);
  });

  it('B-867: la guarda declarada está en el fuente, y un margen no puede decir que cubre la corrida', () => {
    for (const [nombre, g] of Object.entries(GUARDAS_DE_BARRIDO)) {
      const src = sinComentarios(fuente(g.donde));
      // El fuente sin comentarios, como en todo este archivo: la prosa que
      // explica una guarda no puede contar como la guarda.
      for (const marca of g.marcas) {
        expect(marca.test(src), `${nombre}: ${g.donde} ya no tiene ${marca}`).toBe(true);
      }
      // Un margen de gracia protege contra lo recién creado, no contra lo que
      // cambió mientras el barrido corría. Declararlo como `cubierta` sería la
      // confusión que B-867 vino a deshacer, así que el test no la deja escribir.
      if (g.guarda === 'margen') {
        expect(g.ventana, `${nombre}: un margen no cubre la ventana intra-corrida`).toBe(
          'aceptada',
        );
      }
      /*
       * **La ventana que no se cubre se acepta con el motivo escrito**, y eso es
       * la mitad del ítem que no es el regex: la declaración tiene que nombrar
       * la ventana que está dejando abierta —si no, «tiene margen de gracia» se
       * lee como si protegiera de esto, que es exactamente la confusión de
       * partida— y decir por qué se la banca. El largo mínimo no es una métrica
       * de prosa: es lo que impide que el campo se llene con «se acepta».
       */
      if (g.ventana === 'aceptada') {
        expect(g.porque, `${nombre}: acepta la ventana sin nombrarla`).toMatch(/intra-corrida/);
      }
      expect(g.porque.length, `${nombre}: la guarda se declara sin motivo escrito`).toBeGreaterThan(
        120,
      );
    }
    // El positivo: si ninguna fuera `cubierta`, el vocabulario sería decorativo
    // y este registro no distinguiría a B-864 de sus dos vecinos — que es
    // exactamente el estado que B-867 describe como «nada nombra la diferencia».
    expect(
      Object.values(GUARDAS_DE_BARRIDO).filter((g) => g.ventana === 'cubierta').length,
    ).toBeGreaterThanOrEqual(1);
  });

  /**
   * Que seguir la llamada sea lo que aporta, y no un adorno. Es el gemelo del
   * `seguir la llamada es lo que hace visible el efecto y la guarda` de B-82: si
   * algún día todas las lecturas volvieran al cuerpo del trigger, este test
   * avisa — no para volver atrás, sino para que nadie crea que el seguimiento
   * está cubierto cuando ya no se ejercita.
   */
  it('trazar es lo que hace visible la lectura de los barridos', () => {
    const soloEnElModulo = programadas.filter(
      (t) => !/\.get\(\)/.test(sinComentarios(t.cuerpo)) && /\.get\(\)/.test(textoTrazado(t)),
    );
    expect(soloEnElModulo.map((t) => t.nombre).length).toBeGreaterThanOrEqual(2);
  });

  /**
   * El detector de B-85 contra cuerpos inventados — mismo criterio que
   * `marcasDe` para el de B-82 (B-171): lo que decide si el chequeo mira algo se
   * prueba con cuerpos sintéticos, que no envejecen con el refactor de mañana.
   *
   * `LA_COPIA_MALA` es la mutación con la que se verificó el punto ciego antes
   * de ensanchar nada: leer un documento de estado, hablar con la red y escribir
   * de vuelta lo leído, sin transacción.
   */
  describe('el detector de B-85 sigue la llamada al módulo — B-845', () => {
    const LA_COPIA_MALA = `
      const ref = db.doc('sistema/retencion');
      const snap = await ref.get();
      const estado = snap.exists ? snap.data() : {};
      const respuesta = await fetch('https://api.example.com/x');
      await ref.set({ ...estado, ultimaCorrida: Date.now(), codigo: respuesta.status });
    `;

    const pierdeFingido = (cuerpo: string, helpers: Record<string, string> = {}): boolean =>
      pierdeElCambio(sintomasDeB85(trazaFingida(cuerpo, helpers).cuerpos.join('\n'), /\bfetch\(/));

    it('la copia mala cae si está inline en el trigger', () => {
      expect(pierdeFingido(LA_COPIA_MALA)).toBe(true);
    });

    it('y cae también un módulo más allá — el punto ciego de B-845', () => {
      // Sin el helper resuelto, el trigger es una llamada y nada más: es
      // literalmente lo que el chequeo veía de los tres barridos.
      expect(pierdeFingido('await propuestasVencibles(db);')).toBe(false);
      // Con el helper resuelto, la misma copia mala aparece. Antes de B-845
      // esta línea daba `false`, verificado contra `functions/retencion.js`.
      expect(
        pierdeFingido('await propuestasVencibles(db);', { propuestasVencibles: LA_COPIA_MALA }),
      ).toBe(true);
    });

    it('sigue la llamada más de un salto, como el otro detector', () => {
      expect(pierdeFingido('await a();', { a: 'await b();', b: LA_COPIA_MALA })).toBe(true);
    });

    it('borrar lo que se leyó también es la clase — B-867', () => {
      // **El caso que hoy pasaba en verde**, y por el motivo equivocado: leer al
      // principio, hablar con la red y borrar lo leído sin comparar la versión
      // es la forma de B-85 con el verbo cambiado — es B-864 escrito en
      // miniatura. Con el efecto definido como `set|update` esto daba `false` y
      // el caso se llamaba «borrar lo que se leyó no es la clase»: una ceguera
      // del detector afirmada como garantía.
      const barridoQueBorra = `
        const snap = await db.collection('propuestas').select('estado').get();
        await fetch('https://api.example.com/aviso');
        for (const d of snap.docs) await d.ref.delete({ ignoreNotFound: true });
      `;
      expect(pierdeFingido('await barrer(db);', { barrer: barridoQueBorra })).toBe(true);

      // Y la salida sigue siendo la misma que para el `set`: comparar contra lo
      // que hay. Sobre un borrado eso es la precondición de B-864 —el `delete`
      // lleva la versión que la lectura vio—, que acá se escribe con la
      // transacción porque es la forma que el detector reconoce.
      expect(
        pierdeFingido('await barrer(db);', {
          barrer: barridoQueBorra.replace(
            'for (const d of snap.docs)',
            'await db.runTransaction(tx); for (const d of snap.docs)',
          ),
        }),
      ).toBe(false);
    });

    it('sin red no es la clase: el estado no puede envejecer en vuelo', () => {
      expect(
        pierdeFingido('await tocar(db);', {
          tocar: `
            const snap = await ref.get();
            await ref.set({ ...snap.data(), visto: true });
          `,
        }),
      ).toBe(false);
    });

    it('la transacción es la salida, y también cuenta un salto más abajo', () => {
      expect(pierdeFingido('await guardar();', { guardar: LA_COPIA_MALA })).toBe(true);
      expect(
        pierdeFingido('await guardar();', {
          guardar: LA_COPIA_MALA.replace('await ref.set(', 'await db.runTransaction(tx); ref.set('),
        }),
      ).toBe(false);
    });

    it('un comentario que nombra la escritura no cuenta como la escritura', () => {
      // La traza pasa por `sinComentarios`, así que la prosa que explica una
      // guarda no puede encenderla ni apagarla. Este archivo ya se comió esa:
      // los comentarios del repo nombran las llamadas que se buscan.
      expect(
        pierdeFingido('await guardar();', {
          guardar: `
            const snap = await ref.get();
            const r = await fetch(URL);
            // acá iría un ref.set({ ...snap.data() }) si no comparáramos
            return r;
          `,
        }),
      ).toBe(false);
    });
  });
});
