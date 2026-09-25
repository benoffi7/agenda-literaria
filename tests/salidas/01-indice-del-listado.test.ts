/**
 * Salida 1: el índice del listado (§3.1, B-106).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { toPublic } from '@/lib/toPublic';
import { TAXONOMIAS_FUERA_DEL_INDICE, construirIndice, entradaDeIndice } from '@/lib/eventsJson';
import { CAMPOS_TAXONOMIA } from '@/types/actividad';
import { CENTINELA, VOCABULARIO_CERRADO, actividadCentinela, conDosSedes, opcionCentinela } from '../fixtures/centinelas';
import { barrer, type Excepcion } from '../fixtures/barrido';
import { CENTINELA_DEL_INDICE } from '../../scripts/gate-build/semilla.mjs';
import { canastaDelGateCoincide } from '../fixtures/barrido-de-salidas';

/**
 * §3.1 — barrido del índice del listado — B-106.
 *
 * Es la **tercera** proyección en serie sobre el mismo documento: `toPublic`
 * decide qué puede ser público y `entradaDeIndice` decide qué necesita el
 * listado, que es menos. Cada eslabón de una cadena de proyecciones necesita su
 * propio barrido: el de `toPublic` no dice nada sobre lo que el índice agrega o
 * conserva, y el de acá no dice nada sobre privacidad.
 *
 * Se agrega en el mismo cambio que la proyección, y no después, porque las dos
 * vueltas anteriores enseñaron que la salida que nace fuera del barrido se queda
 * afuera (B-212: `ValorOpcion` estuvo en la lista de AJENAS desde que existía).
 *
 * ── Desde B-860 va insensible a mayúsculas, por el mismo motivo que el detalle ─
 * `imagenUrlDe` sanea la portada con `urlSegura`, y `urlSegura` pasa la URL por
 * `new URL()`, que **normaliza el host a minúscula**: el centinela
 * `CENTINELA.imagenes.url` sale del índice como `https://centinela.imagenes.url/`.
 * Comparar sensible daría «dejó de publicar» sobre algo que **sí** se publicó, y
 * la respuesta correcta a ese rojo no es sacar la portada de la lista de
 * permitidos —sigue saliendo, y tiene que salir— sino contestar la celda: lo que
 * cambió es la **forma** del valor, no si viaja.
 *
 * Es exactamente lo que ya hace el barrido de la página de detalle desde B-227 y
 * por la misma línea de código, así que no es una excepción nueva sino la misma
 * consecuencia alcanzando la tercera proyección.
 *
 * **Qué cuesta, dicho con precisión** (lo pidió el `auditor-privacidad`): para la
 * dirección que importa —la **fuga**— insensible es estrictamente **más**
 * estricto, porque una fuga escrita en otra caja también se atrapa; y no hay dos
 * centinelas que difieran solo por mayúsculas, así que no aparecen falsos
 * positivos ni solapamientos. Lo que sí se afloja es la otra dirección, «dejó de
 * publicar», y se afloja para **todos** los centinelas del índice y no solo para
 * la portada: un `toLowerCase()` agregado mañana a `resumenDe` o al título ya no
 * la dispararía. Para `imagenUrl` eso está compensado por los dos asertos por
 * valor de `tests/eventsJson.test.ts` —uno contra el literal saneado y otro
 * contra lo que publica la página de detalle—; para el resto, no.
 */
describe('barrido del índice del listado (§3.1, B-106)', () => {
  const PERMITIDO_EN_EL_INDICE: readonly Excepcion[] = [
    {
      nombre: 'identidad y búsqueda',
      centinelas: ['titulo', 'slug', 'searchText'],
      porque:
        'el título es lo que la tarjeta muestra, el slug es el link al detalle, y el ' +
        'searchText es el índice de la búsqueda en memoria del §6 — es la razón de ser ' +
        'de este archivo.',
    },
    {
      nombre: 'el resumen, que es descripción recortada',
      centinelas: ['descripcion'],
      porque:
        '§3.1 — `resumen` son los primeros ~160 caracteres de `descripcion`, cortados en ' +
        'palabra: es el texto de la tarjeta y la `meta description` del detalle. O sea que ' +
        'el centinela de `descripcion` SÍ aparece, y eso es correcto. Lo que el índice no ' +
        'lleva es la descripción **entera**, que es lo que pesa — y `searchText` ya la ' +
        'contiene normalizada, así que mandar las dos sería mandarla dos veces.',
    },
    {
      nombre: 'la portada, **saneada**',
      centinelas: ['imagenes.url'],
      porque:
        'la tarjeta necesita una imagen, y es la URL que el navegador va a pedir igual. ' +
        'El epígrafe NO está en esta lista: es del detalle, debajo de la foto (D-125). ' +
        'Desde B-860 lo que sale es el valor que devuelve `urlSegura` sobre la primera ' +
        'imagen publicable, o sea el **mismo** que publica la página de detalle: por eso ' +
        'el centinela aparece normalizado (`https://centinela.imagenes.url/`) y este ' +
        'barrido corre insensible a mayúsculas — ver el docblock del describe.',
    },
    {
      nombre: 'quién, solo el nombre',
      centinelas: ['organizador.nombre', 'tallerista.nombre'],
      porque:
        '§3.1 — en el índice son strings y no objetos. El Instagram, la web y la bio ' +
        'quedan en el detalle: servir los handles de terceros en lote es distinto de ' +
        'mostrarlos en una página.',
    },
    {
      nombre: 'dónde, para los filtros de lugar',
      centinelas: ['sede.nombre', 'sede.provincia', 'sede.barrio', 'sede.ciudad'],
      porque:
        'el barrio es el filtro de más valor (§2.1 del diseño) y el nombre de la sede es ' +
        'lo que la tarjeta muestra. La dirección, las indicaciones y las coordenadas NO ' +
        'están: no se filtra por ellas y viven en el detalle. **`sede.provincia` entró con ' +
        'B-950 y no es cosmética**: es el primer nivel de la cascada, y sin ella ' +
        '`provinciaDeSede` caía al respaldo «¿la ciudad es CABA?» — el único chip posible ' +
        'era `caba`, y como el eje `ciudad` se abre solo con una provincia no-CABA ' +
        'elegida, el filtro de ciudad del sitio era inalcanzable. Lo encontró el ' +
        '`auditor-privacidad`.',
    },
    {
      nombre: 'taxonomías, como slug',
      centinelas: ['arancel.tipo', 'online.plataforma', 'tags'],
      porque:
        '§4.4 — el índice lleva el slug y las etiquetas viajan aparte en `opciones`, así ' +
        'que los chips se arman cruzando los dos sin nada cableado.',
    },
    {
      nombre: 'las opciones de taxonomía',
      centinelas: ['opcion.slug', 'opcion.label'],
      porque: '§4.4 — es lo que hace que un chip nuevo aparezca solo. Ver B-212.',
    },
    {
      nombre: 'el eje plano de encuentros (B-99)',
      centinelas: ['sesiones.id'],
      porque:
        'El índice de encuentros de B-99 lleva `{slug, sesionId, inicio}`. El slug y el ' +
        'inicio ya estaban permitidos arriba; lo nuevo es el **id de sesión**, un uuid ' +
        'opaco generado en el cliente (trampa 2), sin PII, que además ya es público en la ' +
        'salida 6 (la página de detalle lo emite en `sesiones`). El barrido obligó a ' +
        'declararlo acá al agregarlo a esta salida, que es exactamente para lo que sirve.',
    },
    /*
     * `modalidades` (B-224) **no está en esta lista y no le falta un centinela**:
     * el índice lleva sus **valores** —`presencial`, `virtual`, `hibrido`—, que son
     * enums del modelo y están en `VOCABULARIO_CERRADO`. Las sedes de cada fila y
     * las fechas de la ventana no entran, y eso lo verifica el `it` de abajo
     * nombrándolas: sin ese caso, el día que alguien mande la fila entera al índice
     * el barrido no diría nada, porque la sede ya está permitida por la sede
     * derivada.
     *
     * ── `zonas` tampoco está acá, y es lo mismo un paso más lejos (B-966) ──
     * El índice lleva los **tres slugs de lugar de todas las filas**, y esta lista
     * no lo nombra porque **no puede**: son exactamente los mismos valores que la
     * sede derivada ya tiene permitidos, así que el barrido no suma ni resta un
     * centinela. O sea que esta clave entró a la salida 1 **sin que la red pudiera
     * pedirlo** — lo cobró el `auditor-privacidad`, y la respuesta correcta no es
     * un centinela nuevo sino escribirlo acá, que es donde alguien va a leer la
     * frontera, y fijar su **forma** aparte (`tests/eventsJson.test.ts`: tres
     * listas de slugs y nada más, que es lo que impide que mañana lleve además el
     * nombre de cada sede).
     */
  ];

  it('la canasta del índice del gate dice lo mismo que ésta (B-1761)', () => {
    canastaDelGateCoincide(CENTINELA_DEL_INDICE, PERMITIDO_EN_EL_INDICE, [
      {
        clave: 'descripcion',
        porque:
          'el índice lleva el resumen, que es la descripción cortada. En este fixture el ' +
          'centinela entra entero en el resumen; en el gate va **pasado el corte** ' +
          '(`descripcionLarga`) a propósito, para que su ausencia pruebe que el resumen recorta.',
      },
    ]);
  });

  it('sobreviven exactamente los centinelas que el listado necesita', () => {
    const indice = construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_centinela')],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    barrer('events.json (índice del listado)', JSON.stringify(indice), PERMITIDO_EN_EL_INDICE, {
      insensible: true,
    });
  });

  it('la etiqueta y el id de la opción NO entran al índice: el detalle los lee de la proyección (B-181)', () => {
    /*
     * **La ausencia estaba afirmada y no estaba decidida**, que es la diferencia
     * que cobró el `auditor-privacidad`: la garantía existía solo como *falta de
     * excepción* en `PERMITIDO_EN_EL_INDICE`, y una ausencia no le dice a nadie
     * que alguien la eligió.
     *
     * Y la eligió: el listado muestra **una tarjeta por actividad** y no agrupa,
     * así que no tiene qué hacer con las comisiones. Proyectarlas «para tener todo
     * a mano» publicaría etiquetas e ids **en lote, en el archivo más barato de
     * cosechar**, que es lo que D-129 evita. La página de detalle no lo necesita:
     * se genera en el build leyendo `toPublic` directo (§2.4).
     *
     * Cuando el listado quiera filtrar por «hay opción los sábados», esto se pone
     * rojo y ahí se decide — que es exactamente para lo que está.
     */
    const indice = construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_centinela')],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    const crudo = JSON.stringify(indice);
    for (const ruta of ['comisiones.id', 'comisiones.etiqueta'] as const) {
      expect(
        crudo.includes(CENTINELA[ruta]),
        `\`${ruta}\` entró al índice del listado. Si es a propósito, decidilo: ` +
          `es una entrada nueva a la salida más barata de cosechar (D-129).`,
      ).toBe(false);
    }
  });

  /**
   * **B-830 — `incluye` sale a la proyección y NO al índice, y es una decisión.**
   *
   * Mismo caso que las comisiones de arriba, y por eso el `it` va al lado: la
   * garantía de que no está no puede ser solo la **falta** de una excepción en
   * `PERMITIDO_EN_EL_INDICE`, porque una ausencia no dice que alguien la eligió.
   *
   * Y se eligió: `incluye` no es eje de filtro ni frase de la tarjeta. Meterlo al
   * índice sería empezar a servir en lote un dato que solo se lee en la ficha —la
   * salida más barata de cosechar, D-129— y, sobre todo, **compromete la forma de
   * una URL** el día que se convierta en chip (`?incluye=`), que es lo que no se
   * mueve una vez indexada (trampa 10). El detalle no lo necesita del índice: se
   * genera en el build leyendo `toPublic` directo (§2.4).
   *
   * El día que el listado quiera filtrar por «con merienda», esto se pone rojo y
   * ahí se decide — que es exactamente para lo que está.
   */
  it('`incluye` NO entra al índice: es dato de ficha, no eje de filtro (B-830)', () => {
    const indice = construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_centinela')],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    const crudo = JSON.stringify(indice);
    expect(
      crudo.includes(CENTINELA.incluye),
      '`incluye` entró al índice del listado. Si es para filtrar por él, la decisión ' +
        'incluye la forma de la URL del chip, que no se mueve una vez indexada (trampa 10).',
    ).toBe(false);
    // Control positivo: el mismo centinela **sí** está en la proyección, así que
    // el `false` de arriba mide una ausencia real y no un centinela que no viaja.
    expect(
      JSON.stringify(toPublic(actividadCentinela(), 'act_centinela')).includes(
        CENTINELA.incluye,
      ),
    ).toBe(true);
  });

  /**
   * **El vocabulario de `incluye-actividad` tampoco viaja en el archivo** — B-830,
   * D-580, y lo encontró el `auditor-privacidad` sobre esta misma tanda.
   *
   * El campo no entra al índice (el caso de arriba) y su **vocabulario** sí
   * entraba, por el otro camino: `opcionesDeTaxonomia()` recorre
   * `CAMPOS_TAXONOMIA` y `construirIndice` no filtraba ninguna clave. O sea que
   * la fila de D-580 era cierta del campo y **falsa del archivo**, y el barrido
   * de centinelas no lo podía ver porque siembra `opciones` con un solo eje.
   *
   * §4.4 define quién lee esas opciones: la island, para armar los chips.
   * `incluye-actividad` no es eje de filtro, así que su vocabulario viajaba sin
   * consumidor — y con todo «Otro» que alguien tipee adentro, que desde B-131
   * nace aprobado y sale en el rebuild siguiente, incluso si se tipeó cargando
   * una actividad en **borrador**.
   *
   * **La lista se ata contra `CAMPOS_TAXONOMIA`** para que la séptima taxonomía
   * obligue a decidir: si entra una nueva y nadie la nombra, este caso la deja
   * pasar al archivo, y el aserto de abajo dice cuáles viajan hoy.
   */
  it('el vocabulario de una taxonomía sin chip no viaja en el archivo (§4.4, D-580)', () => {
    // Se siembran **todas** las taxonomías, que es lo que el barrido de arriba no
    // hace: con un solo eje, el filtro no se ejercita.
    const opciones = Object.fromEntries(
      CAMPOS_TAXONOMIA.map((campo) => [campo, [opcionCentinela()]]),
    );
    const indice = construirIndice({
      actividades: [toPublic(actividadCentinela(), 'act_centinela')],
      opciones,
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });

    const esperadas = CAMPOS_TAXONOMIA.filter((c) => !TAXONOMIAS_FUERA_DEL_INDICE.includes(c));
    expect(Object.keys(indice.opciones).sort()).toEqual([...esperadas].sort());
    // Control positivo: si la lista de exclusión quedara vacía, el aserto de
    // arriba pasaría igual y este diría que ya no se excluye nada.
    expect(TAXONOMIAS_FUERA_DEL_INDICE.length).toBeGreaterThan(0);
    for (const campo of TAXONOMIAS_FUERA_DEL_INDICE) {
      expect(
        Object.prototype.hasOwnProperty.call(indice.opciones, campo),
        `el vocabulario de \`${campo}\` viaja en el events.json y no hay quién lo lea`,
      ).toBe(false);
    }
  });

  it('lleva los valores de las formas de cursar, no las filas (B-224)', () => {
    /*
     * La celda del campo nuevo en la tercera proyección. El filtro necesita saber
     * que la actividad es presencial **y** virtual —si no, con la resultante sola
     * el sitio la escondería de los dos chips que la describen mejor—, y eso son
     * tres strings de enum. La **sede** de cada fila y las **fechas** de la
     * ventana no: la primera es del detalle y las segundas no salen a ninguna
     * salida todavía.
     */
    const dos = toPublic(actividadCentinela(conDosSedes()), 'act_dos');
    const indice = construirIndice({
      actividades: [dos],
      opciones: {},
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    const entrada = indice.actividades[0]!;
    expect(entrada.modalidades).toEqual(['hibrido', 'presencial']);
    // La segunda sede no entra: la del índice es una sola, la derivada.
    const json = JSON.stringify(indice);
    expect(json).not.toContain(CENTINELA['modalidades.2.sede.nombre']);
    expect(json).not.toContain(CENTINELA['modalidades.2.id']);
  });

  it('con `urlPublica: true` el link TAMPOCO entra al índice, a diferencia de las salidas 1 y 2', () => {
    /*
     * La celda que faltaba decidir. Las otras dos salidas que consumen el flag
     * de D-15 tienen su caso `urlPublica: true` en este mismo archivo y ahí el
     * link **sí** sale; el índice era la única de las tres sin el caso, así que
     * se resolvía por omisión hacia el lado seguro y nada lo sostenía.
     *
     * La lista de permitidos va **sin agregarle `online.url`**, y eso es la
     * afirmación: aunque el dueño haya decidido publicar el link, el listado no
     * lo necesita —la tarjeta no tiene botón «Unirse»— y servirlo en lote es lo
     * que hace barato el zoombombing (trampa 5).
     */
    const abierta = actividadCentinela({
      online: {
        plataforma: CENTINELA['online.plataforma'],
        url: CENTINELA['online.url'],
        urlPublica: true,
      },
    });
    const indice = construirIndice({
      actividades: [toPublic(abierta, 'act_abierta')],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });
    barrer(
      'events.json (índice, link de reunión publicado a mano)',
      JSON.stringify(indice),
      PERMITIDO_EN_EL_INDICE,
      { insensible: true },
    );
  });

  it('un `imagenUrl` legacy que `urlSegura` rechaza NO llega al índice (B-860)', () => {
    /*
     * **La tercera respuesta a «cuál es la imagen», y era la única cruda.**
     *
     * El `imagenUrl` del §3.1 (D-125) nunca pasó por `esUrl` ni por el esquema
     * que B-817 le puso a `imagenes[].url`, así que un documento anterior a la
     * galería puede traer cualquier cosa ahí: `javascript:…`, `data:…`,
     * `C:\fotos\flyer.jpg` o «Ver el flyer en instagram». Hasta B-860 el índice
     * lo publicaba tal cual, mientras la página de detalle y el panel ya lo
     * descartaban — la misma pregunta con dos respuestas convergidas por B-854 y
     * una tercera afuera (clase de B-88).
     *
     * Se mide con el centinela **adentro del esquema roto**, así que el `false`
     * de abajo solo puede ser cierto si la URL entera se descartó. Y va con
     * control positivo: el mismo centinela **sí** está en la proyección, que no
     * sanea la galería, o este caso estaría celebrando un centinela que no viaja.
     *
     * El caso vive acá y no solo en `eventsJson.test.ts` porque lo que cambia es
     * **qué sale a una salida pública**, que es lo que este archivo barre.
     */
    const roto = actividadCentinela({
      imagenes: undefined,
      imagenUrl: `javascript:alert('${CENTINELA.imagenUrl}')`,
    });
    const publica = toPublic(roto, 'act_roto');
    const indice = construirIndice({
      actividades: [publica],
      opciones: { arancel: [opcionCentinela()] },
      version: '1.0.0+abc1234',
      generadoEn: '2026-08-27T00:00:00.000Z',
    });

    expect(indice.actividades[0]!.imagenUrl).toBeNull();
    expect(
      JSON.stringify(indice).toLowerCase().includes(CENTINELA.imagenUrl.toLowerCase()),
      'el `imagenUrl` legacy inválido entró al índice del listado. El índice tiene que ' +
        'contestar «cuál es la imagen» con las mismas dos funciones que el detalle ' +
        '(`imagenesPublicables` + `urlSegura`), no con una tercera copia (B-860).',
    ).toBe(false);

    // Control positivo: la proyección NO sanea la galería, así que ahí sí está.
    expect(JSON.stringify(publica)).toContain(CENTINELA.imagenUrl);
  });

  it('CONTROL NEGATIVO: si el índice dejara de recortar, el barrido lo dice', () => {
    /*
     * El atajo que este archivo existe para frenar: volcar la `ActividadPublica`
     * tal cual en vez de recortarla. Es una línea, compila, y publica en lote el
     * mail de inscripción, las indicaciones de la sede y los temas de cada
     * encuentro.
     *
     * Se exige que el barrido falle **nombrando** al menos el mail, que es el
     * campo por el que el §5.1 ya advierte que los bots cosechan.
     */
    let mensaje = '';
    try {
      barrer(
        'events.json (mutación: sin recorte)',
        JSON.stringify([toPublic(actividadCentinela(), 'act_centinela')]),
        PERMITIDO_EN_EL_INDICE,
      );
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }

    expect(mensaje, 'el barrido NO detectó la falta de recorte').not.toBe('');
    expect(mensaje).toContain('FUGA');
    expect(mensaje).toContain('inscripcion.destino');
  });
});
