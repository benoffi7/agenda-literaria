/**
 * **La proyección pública de un lugar para eventos** — B-833, § 6 y § 7 del
 * PRD 4.
 *
 * Cinco cosas, y las dos primeras son las que importan:
 *
 * 1. **El barrido de centinelas, corrido DOS veces.** Una con la dirección
 *    publicada y otra sin ella, con listas de permitidos distintas. Ningún otro
 *    fixture del proyecto necesita eso, y acá es todo el punto: lo que hay que
 *    probar no es «la dirección sale» ni «la dirección no sale», es que **sale
 *    exactamente cuando el flag lo dice**. Con el control negativo codificado de
 *    B-212 en las dos direcciones.
 * 2. **El par flag + dato** (`dondeQueSale`), que es la cuarta instancia de la
 *    clase y la que más cara sale: lo que esconde es la dirección de la casa de
 *    una persona, cargada por alguien que puede no vivir ahí.
 * 3. El precio, con las reglas de B-837 —no sale sin su fecha, no sale como
 *    número, no entra al marcado—.
 * 4. La cobertura del fixture contra `src/types/lugar.ts`.
 * 5. El saneo, los filtros, la ficha y el JSON-LD.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import base from '@/lib/opciones-base.json';
import {
  CLASES_DE_COSTO,
  CLASE_DE_COSTO,
  EJES_DE_LUGAR,
  RANGOS_DE_CAPACIDAD,
  TEXTO_DE_COSTO,
  TEXTO_POR_UNIDAD,
  claseDeCosto,
  coleccionDeLugares,
  construirIndiceDeLugares,
  datosEstructuradosDeLugar,
  descripcionDeLugar,
  descripcionDelDirectorioDeLugares,
  dondeQueSale,
  entraEnElRango,
  fichaDeLugar,
  fraseDePrecioDeLugar,
  lugarPublico,
  migasDeLugar,
} from '@/lib/lugarPublico';
import {
  CENTINELA_LUGAR,
  RUTAS_LUGAR,
  VALORES_NO_TEXTO_LUGAR,
  lugarCentinela,
  lugarCentinelaSinDireccion,
  type RutaDeLugar,
} from './fixtures/centinelas-lugar';
import { ts } from './fixtures/tiempo';
import { NOMBRE } from '@/lib/identidad';
import { UNIDADES_DE_PRECIO_LUGAR, type Lugar } from '@/types/lugar';

const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

// ───────────────────────────────────────────────────────────────────────────
// Lo que SÍ sale, agrupado y con su motivo.
// La lista **es** el chequeo: una entrada sin justificación es una fuga
// aprobada por cansancio.
// ───────────────────────────────────────────────────────────────────────────

type Excepcion = { nombre: string; centinelas: readonly RutaDeLugar[]; porque: string };

/**
 * Lo que sale cuando **la dirección se publica** (un local comercial).
 *
 * `direccion` está en su propio grupo y no mezclada con el resto de «dónde
 * queda»: es el único campo del proyecto cuya presencia en esta lista depende de
 * otro campo del mismo documento, y separarlo es lo que deja que el caso de la
 * casa sea una resta de un grupo entero y no una edición de un array.
 */
const PERMITIDO_EN_LA_PROYECCION: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10) y qué tiene ' +
      'el lugar. La descripción es opcional acá, como en una librería: un café con su capacidad ' +
      'ya dice lo que hay que saber.',
  },
  {
    nombre: 'qué es y dónde, sin la calle',
    centinelas: ['tipo', 'barrio', 'ciudad'],
    porque:
      'el barrio y la ciudad salen **siempre**, también para una casa: son el «más o menos por ' +
      'Villa Crespo» que el § 6 del PRD sí deja publicar, y sin ellos la ficha de una casa no ' +
      'diría nada y el filtro de barrio la dejaría fuera de su propio chip. El tipo es el eje de ' +
      'filtro 5 y lo que decide el default del flag.',
  },
  {
    nombre: '⚠️ la calle, y SOLO con el flag prendido',
    centinelas: ['direccion'],
    porque:
      '§ 6 del PRD 4. La dirección de un local comercial es pública por definición; la de una ' +
      'casa es el dato con el que se llega a la puerta de alguien. Lo decide `direccionPublica` y ' +
      'lo aplica `dondeQueSale`, una sola función para la dirección y la `geo`.',
  },
  {
    nombre: 'para cuántos y qué incluye',
    centinelas: ['capacidadNotas', 'incluye', 'incluyeOtro'],
    porque:
      'es lo que el dueño pidió: «Capacidad» y «Qué incluye el lugar». Las notas existen por el ' +
      '§ 9 —la capacidad tiene respuestas distintas si están sentados o de pie— y `incluye` es el ' +
      'eje de filtro 4, el que más ayuda con proyector y accesibilidad.',
  },
  {
    nombre: 'la condición, que no es un precio',
    centinelas: ['condicion', 'condicionNotas'],
    porque:
      '§ 5 del PRD, el hallazgo del pedido: «no sé si todos cobran, o le dicen que tienen que ' +
      'consumir». La condición se muestra **siempre** (criterio 7) y las notas son donde entra ' +
      '«mínimo de consumición $8000 por persona».',
  },
  {
    nombre: 'los cuatro contactos',
    centinelas: ['instagram', 'whatsapp', 'mail', 'web'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que alguien pueda pedir ' +
      'el salón. Para una casa son además el único camino, porque la dirección la pide quien ' +
      'escribe.',
  },
  {
    nombre: 'la galería',
    centinelas: ['imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la ficha muestra **todas** las imágenes (criterio de B-296) y el epígrafe es el texto que ' +
      'alguien escribió para que se lea debajo. La URL sale **saneada**, no cruda.',
  },
];

/**
 * Lo que sale cuando **la dirección NO se publica** (una casa).
 *
 * Es la lista de arriba **menos un grupo entero**. Que sea una resta declarada y
 * no una lista aparte es deliberado: así el día que alguien agregue un campo a la
 * proyección tiene que decidir en cuál de los dos grupos va, y no puede agregarlo
 * «al de la casa» sin que se note.
 */
const PERMITIDO_SIN_DIRECCION: readonly Excepcion[] = PERMITIDO_EN_LA_PROYECCION.filter(
  (g) => !g.nombre.startsWith('⚠️'),
);

/**
 * Lo que sale a la **ficha** (`FichaDeLugar`, el view-model de la página).
 *
 * Es **la misma lista que la proyección**, y eso no siempre fue así: en los otros
 * dos directorios la ficha es la proyección menos `searchText`. Acá ese campo no
 * tiene centinela porque **la proyección lo deriva en vez de copiarlo**, así que
 * no hay nada que restar. Que sea un alias y no una copia es lo que hace que
 * agregar un campo a la proyección obligue a pensar si va también a la ficha.
 */
const PERMITIDO_EN_LA_FICHA: readonly Excepcion[] = PERMITIDO_EN_LA_PROYECCION;

/**
 * Lo que sale al **marcado estructurado** (`Place` + migas + `CollectionPage`).
 *
 * La lista más corta de las tres, y con motivo: esto lo lee una máquina y es lo
 * que Google puede mostrar **fuera** del sitio.
 */
const PERMITIDO_EN_EL_MARCADO: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      '`name`, `description` y el `url` canónico. Es lo que hace que la ficha se entienda como un ' +
      'lugar y no como una página suelta.',
  },
  {
    nombre: '⚠️ la dirección, y SOLO con el flag prendido',
    centinelas: ['direccion', 'ciudad'],
    porque:
      '`address.streetAddress` y `addressLocality`. **Es el criterio 5 del PRD y el camino que ' +
      'más fácil se filtra**: nadie lee el JSON-LD al revisar una ficha. Sin dirección publicada ' +
      'no hay clave `address` **en absoluto**, ni con la localidad sola.',
  },
  {
    nombre: 'qué incluye',
    centinelas: ['incluye'],
    porque:
      '`amenityFeature` como `LocationFeatureSpecification`. Es un dato del lugar, y es el que ' +
      'hace que el marcado diga algo más que el nombre.',
  },
  {
    nombre: 'los perfiles',
    centinelas: ['instagram', 'web'],
    porque:
      '`sameAs` es «las otras direcciones de esta misma entidad». El **WhatsApp y el mail no ' +
      'entran**: son canales de contacto, no perfiles, y publicarlos en el marcado los deja ' +
      'cosechables por cualquier parser sin que nadie abra la página.',
  },
  {
    nombre: 'la imagen',
    centinelas: ['imagenes.url'],
    porque:
      '`image` es una lista de URLs. El **epígrafe no entra**: es texto para leer debajo de la ' +
      'foto, no un dato de la entidad.',
  },
];

/**
 * El barrido, en las dos direcciones.
 *
 * Vive acá y no en `tests/fixtures/barrido.ts` porque aquél recorre las rutas de
 * una **actividad**. Lo que se copia es la mecánica —ocho líneas—; lo que no se
 * copia es el criterio, que son las listas de arriba y se escriben a mano.
 */
const barrerLugar = (salida: string, texto: string, grupos: readonly Excepcion[]): void => {
  const permitido = new Set(grupos.flatMap((g) => g.centinelas));
  const fugas: string[] = [];
  const faltantes: string[] = [];

  for (const ruta of RUTAS_LUGAR) {
    const presente = texto.includes(CENTINELA_LUGAR[ruta]);
    if (presente && !permitido.has(ruta)) fugas.push(`${ruta} → ${CENTINELA_LUGAR[ruta]}`);
    if (!presente && permitido.has(ruta)) faltantes.push(`${ruta} → ${CENTINELA_LUGAR[ruta]}`);
  }

  expect(
    fugas,
    `FUGA DE PRIVACIDAD en «${salida}»: se publicó contenido que el § 6 del PRD no permite. ` +
      `Centinelas que sobrevivieron sin estar en la lista de excepciones: ${fugas.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);

  expect(
    faltantes,
    `«${salida}» dejó de publicar contenido que la lista de excepciones dice que sale. ` +
      `O se rompió la proyección, o la excepción sobra: ${faltantes.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);
};

describe('barrido de la proyección de un lugar (§5.2, whitelist)', () => {
  it('con la dirección publicada sobreviven exactamente los centinelas permitidos', () => {
    barrerLugar(
      'lugarPublico (local comercial)',
      JSON.stringify(lugarPublico(lugarCentinela())),
      PERMITIDO_EN_LA_PROYECCION,
    );
  });

  it('y con el flag apagado sobreviven todos MENOS la dirección — § 6', () => {
    /*
     * **El caso central de esta tajada.** El documento tiene la dirección adentro
     * —se guarda igual, el admin la necesita para poder contestar— y la
     * proyección no la publica.
     *
     * MUTACIÓN PROBADA: proyectar `direccion: l.direccion ?? ''` sin pasar por
     * `dondeQueSale` deja este caso en rojo nombrando el centinela, y el efecto
     * real es la dirección de la casa de una persona publicada en una página
     * indexada.
     */
    barrerLugar(
      'lugarPublico (casa, sin dirección publicada)',
      JSON.stringify(lugarPublico(lugarCentinelaSinDireccion())),
      PERMITIDO_SIN_DIRECCION,
    );
  });

  it('el `contactoDeQuienCargo` no está, dicho por su nombre', () => {
    /*
     * MUTACIÓN PROBADA: agregar `contactoDeQuienCargo: l.contactoDeQuienCargo` a
     * `lugarPublico` pone en rojo este caso **y** el barrido de arriba, nombrando
     * el centinela.
     */
    const salida = JSON.stringify(lugarPublico(lugarCentinela()));
    expect(salida).not.toContain(CENTINELA_LUGAR['contactoDeQuienCargo.valor']);
    expect(salida).not.toContain('contactoDeQuienCargo');
  });

  it('tampoco la revisión, el handle de Storage ni el flag mismo', () => {
    /*
     * `revision.porUid` es un uid, `revision.motivo` es por qué un admin descartó
     * una ficha —texto interno sobre un tercero— y `storagePath` es la ruta exacta
     * de un objeto en un bucket cuyo `list` está cerrado (trampa 13).
     *
     * **Y `direccionPublica` tampoco sale**, que es propio de esta colección:
     * publicarlo sería poner un cartel de «acá hay una dirección que no te estoy
     * dando». Que la dirección salga vacía ya dice todo lo que un consumidor
     * necesita.
     */
    const salida = JSON.stringify(lugarPublico(lugarCentinela()));
    expect(salida).not.toContain(CENTINELA_LUGAR['revision.porUid']);
    expect(salida).not.toContain(CENTINELA_LUGAR['revision.motivo']);
    expect(salida).not.toContain(CENTINELA_LUGAR['imagenes.storagePath']);
    expect(salida).not.toContain('direccionPublica');
  });

  it('CONTROL NEGATIVO: con un spread, el barrido falla nombrando el campo', () => {
    /*
     * **La forma de B-212**, y acá no es opcional: sin este caso, el barrido de
     * arriba podría estar verde porque la mecánica no mira nada (un fixture mal
     * armado, una lista de rutas vacía) y nadie se enteraría.
     */
    const conSpread = { ...lugarCentinela(), ...lugarPublico(lugarCentinela()) };
    let fallo: unknown = null;
    try {
      barrerLugar('proyección con spread', JSON.stringify(conSpread), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      fallo = e;
    }
    expect(fallo, 'el barrido no detectó la fuga: entonces no verifica nada').not.toBeNull();
    expect(String(fallo)).toContain('contactoDeQuienCargo.valor');
    expect(String(fallo)).toContain('FUGA DE PRIVACIDAD');
  });

  it('CONTROL NEGATIVO: con un spread sobre la CASA, la fuga que aparece es la dirección', () => {
    /*
     * El control negativo específico del § 6, y el que prueba que la segunda
     * corrida del barrido mira de verdad: con el documento entero encima, lo que
     * tiene que aparecer nombrado es **la dirección**, no solo el contacto.
     */
    const conSpread = {
      ...lugarCentinelaSinDireccion(),
      ...lugarPublico(lugarCentinelaSinDireccion()),
    };
    let fallo: unknown = null;
    try {
      barrerLugar('casa con spread', JSON.stringify(conSpread), PERMITIDO_SIN_DIRECCION);
    } catch (e) {
      fallo = e;
    }
    expect(fallo).not.toBeNull();
    expect(String(fallo)).toContain(CENTINELA_LUGAR.direccion);
  });

  it('CONTROL NEGATIVO: dejar de publicar algo permitido también falla, y no como fuga', () => {
    // La otra dirección. Sin ella, el barrido pasaría con una proyección vacía.
    const sinNotas = lugarPublico(lugarCentinela());
    sinNotas.condicionNotas = '';
    let fallo: unknown = null;
    try {
      barrerLugar('proyección recortada', JSON.stringify(sinNotas), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      fallo = e;
    }
    expect(fallo).not.toBeNull();
    expect(String(fallo)).toContain('dejó de publicar');
    expect(String(fallo)).toContain('condicionNotas');
  });
});

describe('el fixture de centinelas no puede envejecer', () => {
  /**
   * Cada campo de `Lugar` tiene que estar cubierto: o lleva centinela, o está
   * declarado en `VALORES_NO_TEXTO_LUGAR` con el motivo.
   *
   * Se lee el **fuente** y no las claves del objeto, por lo mismo que los otros
   * tres barridos: un campo opcional que el fixture no setea no aparecería en
   * `Object.keys`, que es justo el campo que se olvida.
   *
   * MUTACIÓN PROBADA: agregar `accesible: boolean;` a la interfaz `Lugar` deja
   * este caso en rojo nombrando el campo.
   */
  it('cubre todos los campos de `Lugar`', () => {
    const src = readFileSync(raiz('src/types/lugar.ts'), 'utf8');
    const bloque = /export interface Lugar \{\n([\s\S]*?)\n\}/.exec(src);
    expect(bloque, 'no se encontró `export interface Lugar`').not.toBeNull();

    const campos = [...bloque![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
    expect(campos.length, 'no se leyó ningún campo de la interfaz').toBeGreaterThan(15);

    const conCentinela = new Set(RUTAS_LUGAR.map((r) => r.split('.')[0]!));
    const declarados = new Set(Object.keys(VALORES_NO_TEXTO_LUGAR).map((k) => k.split('.')[0]!));

    const sinCubrir = campos.filter((c) => !conCentinela.has(c) && !declarados.has(c));
    expect(
      sinCubrir,
      'campos de `Lugar` sin centinela ni declaración: el barrido no los mira, así que pueden ' +
        `publicarse sin que nada se ponga rojo: ${sinCubrir.join(', ')}`,
    ).toEqual([]);
  });

  it('ningún centinela es subcadena de otro: el barrido sería ambiguo', () => {
    const valores = RUTAS_LUGAR.map((r) => CENTINELA_LUGAR[r]);
    for (const a of valores) {
      const contenidos = valores.filter((b) => b !== a && b.includes(a));
      expect(contenidos, `«${a}» está adentro de otro centinela`).toEqual([]);
    }
  });

  it('los dos fixtures se diferencian SOLO en el flag', () => {
    /*
     * Lo que hace útil al par, en las dos mitades:
     *
     * - el documento con el flag apagado **conserva** la dirección y la `geo`. Si
     *   el fixture las borrara, la segunda corrida del barrido pasaría en verde
     *   sin haber probado nada — no habría dirección que publicar;
     * - y **no cambia nada más**, ni siquiera el `tipo`. Con `tipo: 'casa'` el
     *   barrido no podría distinguir «la proyección respetó el flag» de «la
     *   proyección miró el tipo», que son dos implementaciones distintas: la
     *   segunda haría que apagar el flag no alcance para bajar una dirección a
     *   pedido.
     */
    const local = lugarCentinela();
    const casa = lugarCentinelaSinDireccion();
    // Se compara serializado y no con `toEqual` porque el doble de `Timestamp`
    // (`fixtures/tiempo.ts`) lleva closures, y dos llamadas producen dos
    // funciones distintas: `toEqual` las compara por referencia y fallaría «sin
    // diferencia visual», que es el peor mensaje posible.
    expect(JSON.stringify({ ...casa, direccionPublica: true })).toBe(JSON.stringify(local));
    expect(casa.direccionPublica).toBe(false);
    expect(local.direccionPublica).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// § 6 · el par flag + dato
// ───────────────────────────────────────────────────────────────────────────

describe('la dirección sale solo si el flag lo dice — § 6, cuarta instancia del par', () => {
  const con = (over: Partial<Lugar>): Lugar => ({ ...lugarCentinela(), ...over });

  it('con el flag prendido salen la dirección y la `geo`', () => {
    const publico = lugarPublico(lugarCentinela());
    expect(publico.donde.direccion).toBe(CENTINELA_LUGAR.direccion);
    expect(publico.donde.geo).toEqual({ lat: -34.6037, lng: -58.3816 });
  });

  it('con el flag apagado NO sale ninguna de las dos, aunque el documento las tenga', () => {
    /*
     * **Una sola función para los dos campos**, y este caso es por qué: `geo` sin
     * `direccion` sigue poniendo la casa en un mapa (§ 6, el segundo agravante).
     *
     * MUTACIÓN PROBADA: devolver `geo` sin mirar el flag —o gatear solo la
     * dirección— deja este caso en rojo con las coordenadas publicadas.
     */
    const publico = lugarPublico(lugarCentinelaSinDireccion());
    expect(publico.donde.direccion).toBe('');
    expect(publico.donde.geo).toBeNull();
    // Y el barrio y la ciudad **sí** salen: es el «más o menos» que el § 6 deja.
    expect(publico.donde.barrio).toBe(CENTINELA_LUGAR.barrio);
    expect(publico.donde.ciudad).toBe(CENTINELA_LUGAR.ciudad);
  });

  it('falla cerrada: el flag ausente o con cualquier otro valor NO publica', () => {
    /*
     * El default que preserva lo anterior, acá en su versión **restrictiva** y a
     * propósito: un documento anterior al campo, uno restaurado o uno escrito por
     * un script pueden traerlo ausente, y ausente tiene que querer decir «no
     * publicar». Lo que está en juego es la dirección de la casa de alguien.
     *
     * MUTACIÓN PROBADA: cambiar `l.direccionPublica !== true` por
     * `!l.direccionPublica` deja pasar `'si'`, `1` y cualquier truthy, y este caso
     * se pone en rojo.
     */
    for (const valor of [undefined, null, 'true', 1, {}]) {
      const salida = dondeQueSale({
        direccionPublica: valor as never,
        direccion: CENTINELA_LUGAR.direccion,
        geo: { lat: 1, lng: 2 },
      });
      expect(salida, `\`${String(valor)}\` publicó la dirección`).toEqual({
        direccion: '',
        geo: null,
      });
    }
  });

  it('el flag mira el FLAG y no el tipo de lugar: bajar una dirección tiene que ser un click', () => {
    /*
     * Un lugar de `tipo: 'casa'` con el flag **prendido** publica la dirección, y
     * eso es deliberado: quien vive ahí puede haberlo pedido, y un admin la
     * prende. Si la proyección mirara el tipo, apagar el flag no alcanzaría para
     * bajar una dirección a pedido —y el tipo es un vocabulario abierto, así que
     * mirarlo dejaría afuera cualquier tipo nuevo que alguien tipee—.
     *
     * El que **no** puede prenderlo es el formulario público: eso lo fuerza
     * `formALugar` y lo hace cumplir `firestore.rules` (`tests/lugares.test.ts`).
     */
    const casaConPermiso = lugarPublico(con({ tipo: 'casa', direccionPublica: true }));
    expect(casaConPermiso.donde.direccion).toBe(CENTINELA_LUGAR.direccion);
  });

  it('una `geo` rota no sale, ni siquiera con el flag prendido', () => {
    expect(lugarPublico(con({ geo: { lat: NaN, lng: 1 } as never })).donde.geo).toBeNull();
    expect(lugarPublico(con({ geo: null })).donde.geo).toBeNull();
  });
});

describe('el índice de búsqueda se DERIVA, no se copia — § 6, la puerta sin flag', () => {
  /*
   * **El hallazgo del `auditor-privacidad` sobre esta tajada.** `searchText` se
   * publica —viaja en `/lugares.json` para que el listado filtre en memoria—, y
   * en el documento es un campo que escribe el cliente. Que no lleve la dirección
   * lo sostenía `formALugar`, cuyo propio docblock dice que **no es la defensa**:
   * se saltea con un `curl`.
   *
   * Hoy es inalcanzable (el `create` exige `esAdmin()`), y el día que B-872 abra
   * la puerta un alta anónima podría mandar el `searchText` con la dirección
   * adentro: quedaría publicada **con el flag apagado y sin forma de bajarla**,
   * porque el índice se deriva al escribir y apagar la casilla no lo toca.
   *
   * El fixture trae la dirección metida a mano en su `searchText` justamente para
   * que estos casos prueben algo.
   */
  it('el `searchText` del documento NO se publica, ni con el flag prendido', () => {
    /*
     * MUTACIÓN PROBADA: volver a `searchText: l.searchText ?? ''` deja este caso
     * en rojo con la dirección publicada — y el barrido de centinelas **no** lo
     * agarraría, porque el texto derivado va normalizado y el centinela no.
     */
    for (const doc of [lugarCentinela(), lugarCentinelaSinDireccion()]) {
      const publico = lugarPublico(doc);
      expect(doc.searchText, 'el fixture dejó de traer la dirección: el caso no prueba nada')
        .toContain(CENTINELA_LUGAR.direccion);
      expect(publico.searchText).not.toContain(CENTINELA_LUGAR.direccion);
      expect(publico.searchText).not.toContain('centinela.searchtext.lugar');
      expect(JSON.stringify(publico)).not.toContain(doc.searchText);
    }
  });

  it('y el derivado trae lo que tiene que traer — el control positivo', () => {
    /*
     * Sin esto, el caso de arriba pasaría en verde con un `searchText` vacío, que
     * es el otro error: el listado dejaría de encontrar por texto y nadie se
     * enteraría hasta que alguien buscara.
     */
    const publico = lugarPublico(lugarCentinela());
    expect(publico.searchText.length).toBeGreaterThan(20);
    // Normalizado (§6): sin mayúsculas ni acentos.
    expect(publico.searchText).toBe(publico.searchText.toLowerCase());
    expect(publico.searchText).toContain('centinela.nombredellugar');
    expect(publico.searchText).toContain('centinela-barrio');
    expect(publico.searchText).toContain('centinela.capacidadnotas');
    // Y **no** el precio: el buscador es un filtro, y filtrar por precio afirma
    // que los precios son comparables.
    expect(publico.searchText).not.toContain('24681357');
    expect(publico.searchText).not.toContain('24.681.357');
  });

  it('la derivación es UNA sola: el documento y lo publicado se arman igual', () => {
    /*
     * La clase de B-88. Con dos derivaciones, el buscador del panel y el del sitio
     * dirían cosas distintas y nadie lo vería hasta que alguien buscara algo que
     * está en una y no en la otra.
     */
    const contenido = readFileSync(raiz('src/lib/lugar-schema.ts'), 'utf8');
    expect(contenido, '`formALugar` dejó de usar la derivación compartida').toContain(
      'searchTextDeLugar({',
    );
    expect(contenido).toContain("import { searchTextDeLugar } from '@/lib/lugarPublico';");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// B-837 · el precio
// ───────────────────────────────────────────────────────────────────────────

describe('el precio se publica con su fecha o no se publica — B-837, § 5 del PRD', () => {
  const con = (precio: Lugar['precio']): Lugar => ({ ...lugarCentinela(), precio });

  it('la frase lleva el monto, la unidad y la fecha, en un solo string', () => {
    const publico = lugarPublico(lugarCentinela());
    expect(publico.precio).toBe('$24.681.357 por hora · cargado el 1 de septiembre de 2026');
    // Y es **un string**, no un objeto: eso es lo que hace imposible filtrar,
    // ordenar o meterlo en un marcado (D-570).
    expect(typeof publico.precio).toBe('string');
  });

  it('sin fecha usable no sale el número: el dato huérfano desaparece', () => {
    /*
     * MUTACIÓN PROBADA: devolver `$${monto}` sin pasar por `fraseConFecha` deja
     * este caso en rojo con el número publicado solo.
     */
    const sinFecha = { valor: { monto: 24681357, porUnidad: 'hora' }, cargadoEn: null };
    expect(fraseDePrecioDeLugar(sinFecha as never)).toBe('');
    expect(lugarPublico(con(sinFecha as never)).precio).toBe('');
    expect(JSON.stringify(lugarPublico(con(sinFecha as never)))).not.toContain('24.681.357');
  });

  it('una unidad que no está en el vocabulario cerrado tampoco publica el monto', () => {
    /*
     * No puede pasar por el schema ni por la regla —`UNIDADES_DE_PRECIO_LUGAR` es
     * cerrado y `firestore.rules` lo enumera— pero el documento puede venir de un
     * `curl` con cualquier cosa adentro, y publicar «$25.000 · cargado el …» sin
     * decir por cuánto es el dato equivocado con cara de cierto.
     */
    const raro = { valor: { monto: 1000, porUnidad: 'por-luna-llena' }, cargadoEn: ts('2026-09-01T12:00:00Z') };
    expect(fraseDePrecioDeLugar(raro as never)).toBe('');
  });

  it('sin precio, vacío; y un monto absurdo tampoco sale', () => {
    expect(fraseDePrecioDeLugar(null)).toBe('');
    expect(lugarPublico(con(null)).precio).toBe('');
    const cero = { valor: { monto: 0, porUnidad: 'hora' as const }, cargadoEn: ts('2026-09-01T12:00:00Z') };
    expect(fraseDePrecioDeLugar(cero)).toBe('');
  });

  it('el número crudo no sale por ninguna otra puerta de la proyección', () => {
    /*
     * MUTACIÓN PROBADA: agregar `precioMonto: l.precio?.valor.monto ?? null` a
     * `lugarPublico` deja este caso en rojo — y es exactamente la forma que D-570
     * prohíbe: «un par que se proyecta en dos campos se separa».
     */
    const salida = JSON.stringify(lugarPublico(lugarCentinela()));
    expect(salida).toContain('$24.681.357 por hora · cargado el');
    expect(salida, 'el monto salió como número').not.toContain('24681357');
    expect(salida).not.toContain('cargadoEn');
    expect(salida).not.toContain('porUnidad');
  });

  it('`TEXTO_POR_UNIDAD` cubre las cuatro unidades, y no hay una quinta', () => {
    /*
     * La clase de B-88 con la vuelta que un vocabulario cerrado permite: acá el
     * mapa y la lista **pueden** compararse exhaustivamente en las dos
     * direcciones, cosa que con una taxonomía abierta no se puede.
     *
     * MUTACIÓN PROBADA: sacar `jornada` de `TEXTO_POR_UNIDAD` deja este caso en
     * rojo nombrando la unidad — y el efecto real sería un precio por jornada que
     * no se publica nunca, en silencio.
     */
    expect(Object.keys(TEXTO_POR_UNIDAD).sort()).toEqual([...UNIDADES_DE_PRECIO_LUGAR].sort());
  });
});

// ───────────────────────────────────────────────────────────────────────────
// § 5 y § 7 · los filtros que NO son una taxonomía
// ───────────────────────────────────────────────────────────────────────────

describe('el filtro de costo son tres clases y no un rango de precios — § 5', () => {
  it('`CLASE_DE_COSTO` cubre todo el vocabulario base de `/opciones/condicion-de-uso`', () => {
    /*
     * La clase de B-88: el mapa de clases y la taxonomía son dos derivaciones del
     * mismo vocabulario, y la que se quede vieja deja una condición que existe en
     * el desplegable y cuyo lugar **no aparece en ningún chip de costo**, en
     * silencio.
     *
     * MUTACIÓN PROBADA: sacar `canje-por-difusion` de `CLASE_DE_COSTO` deja este
     * caso en rojo nombrando el slug.
     */
    const slugs = (base['condicion-de-uso'] as { slug: string; fijo: boolean }[])
      .filter((v) => v.fijo)
      .map((v) => v.slug);
    expect(slugs.length, 'el vocabulario base de condicion-de-uso está vacío').toBeGreaterThan(5);
    const sinClase = slugs.filter((s) => !CLASE_DE_COSTO[s]);
    expect(
      sinClase,
      `estas condiciones existen en el desplegable y quedan fuera de los tres chips: ${sinClase.join(', ')}`,
    ).toEqual([]);
  });

  it('las tres clases son las del PRD, y el reparto es el que el PRD escribe', () => {
    expect([...CLASES_DE_COSTO]).toEqual(['sin-costo', 'consumiendo', 'pagando']);
    expect(claseDeCosto('gratis')).toBe('sin-costo');
    expect(claseDeCosto('canje-por-difusion')).toBe('sin-costo');
    expect(claseDeCosto('con-consumicion')).toBe('consumiendo');
    expect(claseDeCosto('alquiler-por-hora')).toBe('pagando');
    expect(claseDeCosto('alquiler-por-evento')).toBe('pagando');
    expect(claseDeCosto('porcentaje-de-la-recaudacion')).toBe('pagando');
    expect(claseDeCosto('a-convenir')).toBe('pagando');
    // Las tres tienen texto, así que ningún chip sale sin rótulo.
    for (const c of CLASES_DE_COSTO) expect(TEXTO_DE_COSTO[c]).toBeTruthy();
  });

  it('una condición que no se pudo clasificar queda fuera de los chips, no en el que no es', () => {
    // La ficha la muestra igual —la condición se muestra siempre, criterio 7—
    // pero no se le inventa una clase.
    expect(claseDeCosto('centinela-condicion')).toBe('');
    expect(lugarPublico(lugarCentinela()).costo).toBe('');
    expect(lugarPublico({ ...lugarCentinela(), condicion: 'gratis' }).costo).toBe('sin-costo');
  });
});

describe('el filtro de capacidad son rangos y no un número — § 7 y § 9', () => {
  it('son los cuatro del PRD, y los bordes se solapan a propósito', () => {
    expect(RANGOS_DE_CAPACIDAD.map((r) => r.id)).toEqual([
      'hasta-10',
      '10-25',
      '25-50',
      'mas-de-50',
    ]);
    // Un lugar de 25 entra en los dos vecinos: una capacidad aproximada no tiene
    // un borde exacto, y dejarlo afuera de los dos es peor que mostrarlo en los
    // dos.
    expect(entraEnElRango(25, '10-25')).toBe(true);
    expect(entraEnElRango(25, '25-50')).toBe(true);
    expect(entraEnElRango(9, 'hasta-10')).toBe(true);
    expect(entraEnElRango(200, 'mas-de-50')).toBe(true);
    expect(entraEnElRango(9, 'mas-de-50')).toBe(false);
  });

  it('sin capacidad cargada no entra en ninguno — § 9: «es un dato que quien carga no sabe»', () => {
    /*
     * Meterlo en todos afirmaría que entran 50 personas sin que nadie lo haya
     * dicho; sin filtro de capacidad se sigue viendo en la lista completa.
     *
     * MUTACIÓN PROBADA: devolver `true` cuando `capacidad === null` deja este caso
     * en rojo.
     */
    for (const r of RANGOS_DE_CAPACIDAD) expect(entraEnElRango(null, r.id)).toBe(false);
    expect(entraEnElRango(20, 'rango-inventado')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El saneo
// ───────────────────────────────────────────────────────────────────────────

describe('lo que se publica sale saneado, no crudo', () => {
  const con = (over: Partial<Lugar>): Lugar => ({ ...lugarCentinela(), ...over });

  it('los cuatro contactos se sanean como en los otros dos directorios', () => {
    expect(lugarPublico(con({ instagram: 'cuenta/otra' })).instagram).toBeNull();
    expect(lugarPublico(con({ instagram: '@elsalon' })).instagram).toBe('elsalon');
    expect(lugarPublico(con({ whatsapp: '123' })).whatsapp).toBeNull();
    expect(lugarPublico(con({ whatsapp: '+54 9 11 8765-4321' })).whatsapp).toBe('5491187654321');
    expect(lugarPublico(con({ mail: 'escribinos por instagram' })).mail).toBeNull();
    expect(lugarPublico(con({ web: 'javascript:alert(1)' })).web).toBeNull();
    // La `web` **sí** acepta `http://`, al revés que el link de cobro de una
    // suscripción: es una página institucional, no un destino de pago.
    expect(lugarPublico(con({ web: 'http://elsalon.example' })).web).toBe(
      'http://elsalon.example/',
    );
  });

  it('un slug de vocabulario que no es un slug se descarta, elemento por elemento', () => {
    /*
     * La regla **no itera listas** (B-842), así que un `curl` puede mandar
     * dieciséis strings arbitrarios en `incluye`.
     *
     * MUTACIÓN PROBADA: devolver `l.incluye` tal cual deja este caso en rojo con
     * el `Con Mayúsculas` publicado.
     */
    const publico = lugarPublico(
      con({
        incluye: ['proyector', 'Con Mayúsculas', '', 'proyector'],
        tipo: 'No Es Un Slug',
        barrio: 'barrio con espacios',
        condicion: 'Gratis',
      }),
    );
    expect(publico.incluye).toEqual(['proyector']);
    expect(publico.tipo).toBe('');
    expect(publico.donde.barrio).toBe('');
    expect(publico.condicion).toBe('');
  });

  it('una capacidad absurda no sale', () => {
    expect(lugarPublico(con({ capacidad: 0 })).capacidad).toBeNull();
    expect(lugarPublico(con({ capacidad: -3 })).capacidad).toBeNull();
    expect(lugarPublico(con({ capacidad: 999999 })).capacidad).toBeNull();
    expect(lugarPublico(con({ capacidad: 12.7 })).capacidad).toBe(12);
    expect(lugarPublico(con({ capacidad: null })).capacidad).toBeNull();
  });

  it('una imagen con URL inválida se descarta y la portada pasa a ser la siguiente', () => {
    const base0 = lugarCentinela().imagenes[0]!;
    const publico = lugarPublico(
      con({
        imagenes: [
          { ...base0, id: 'img_rota', url: 'javascript:alert(1)', portada: true },
          { ...base0, id: 'img_sana', url: 'https://ok.example/sana.jpg', portada: false },
        ],
      }),
    );
    expect(publico.imagenes.map((i) => i.url)).toEqual(['https://ok.example/sana.jpg']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El índice
// ───────────────────────────────────────────────────────────────────────────

describe('el índice de `/lugares.json`', () => {
  const publico = (over: Partial<Lugar>) => lugarPublico({ ...lugarCentinela(), ...over });

  const indice = (lugares: ReturnType<typeof publico>[], vocabularios = {}) =>
    construirIndiceDeLugares({
      lugares,
      vocabularios,
      version: '1.0.0',
      generadoEn: '2026-09-11T00:00:00.000Z',
    });

  it('ordena por nombre y no por el orden de la query', () => {
    const i = indice([
      publico({ nombre: 'Zeta', slug: 'zeta' }),
      publico({ nombre: 'Alfa', slug: 'alfa' }),
    ]);
    expect(i.lugares.map((l) => l.nombre)).toEqual(['Alfa', 'Zeta']);
  });

  it('los chips son solo los valores que alguna ficha usa', () => {
    /*
     * MUTACIÓN PROBADA: sacar el `.filter((v) => usados.has(v.slug))` deja este
     * caso en rojo con `almagro` en la lista.
     */
    const i = indice([publico({ barrio: 'chacarita' })], {
      barrio: [
        { slug: 'chacarita', label: 'Chacarita', orden: 1, fijo: false, usos: 3 },
        { slug: 'almagro', label: 'Almagro', orden: 2, fijo: false, usos: 9 },
      ],
    });
    expect(i.filtros.barrio.map((v) => v.slug)).toEqual(['chacarita']);
  });

  it('los tres ejes con vocabulario están, y son los del § 7 del PRD', () => {
    // Un cuarto eje que entre sin chips deja el filtro mudo; uno que se vaya deja
    // la island pidiendo una clave que no existe. **La capacidad y el costo no
    // están** a propósito: no salen de una taxonomía.
    expect([...EJES_DE_LUGAR]).toEqual(['barrio', 'incluye-lugar', 'tipo-lugar']);
    expect(Object.keys(indice([]).filtros).sort()).toEqual([...EJES_DE_LUGAR].sort());
  });

  it('y el índice entero pasa el mismo barrido que la proyección, en los dos casos', () => {
    // El JSON es lo que baja **todo el mundo**: si la proyección está limpia y el
    // índice la envuelve, el archivo tiene que estarlo también. Las dos corridas,
    // porque el índice mezcla locales y casas en la misma lista.
    barrerLugar(
      '/lugares.json (local)',
      JSON.stringify(indice([lugarPublico(lugarCentinela())])),
      PERMITIDO_EN_LA_PROYECCION,
    );
    barrerLugar(
      '/lugares.json (casa)',
      JSON.stringify(indice([lugarPublico(lugarCentinelaSinDireccion())])),
      PERMITIDO_SIN_DIRECCION,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La ficha y su marcado
// ───────────────────────────────────────────────────────────────────────────

describe('la ficha y su marcado estructurado', () => {
  const ficha = (doc: Lugar = lugarCentinela()) =>
    fichaDeLugar(lugarPublico(doc), {
      etiqueta: (campo, slug) => `Etiqueta de ${campo}:${slug}`,
      rutaDelBarrio: '/barrio/centinela-barrio/',
    });

  it('los contactos llegan como destino, no como texto crudo', () => {
    const f = ficha();
    expect(f.enlaces.whatsapp).toBe('https://wa.me/5491177778888');
    expect(f.enlaces.instagram).toBe(`https://instagram.com/${CENTINELA_LUGAR.instagram}`);
    expect(f.enlaces.mail).toBe(`mailto:${CENTINELA_LUGAR.mail}`);
    expect(f.enlaces.web).toBe(CENTINELA_LUGAR.web);
  });

  it('la ruta y la URL salen de `rutasPublicas`, con la barra final de B-330', () => {
    const f = ficha();
    expect(f.ruta).toBe('/guia/lugares/centinela-lugar-slug/');
    expect(f.url).toBe('https://agendaleh.ar/guia/lugares/centinela-lugar-slug/');
  });

  it('el hub del barrio se linkea SOLO si existe', () => {
    /*
     * Mismo criterio que en la ficha de una librería: linkear a ciegas publicaría
     * un 404 en cada lugar de un barrio sin actividades — que son justo los que
     * este directorio va a estrenar.
     */
    expect(ficha().donde.rutaDelBarrio).toBe('/barrio/centinela-barrio/');
    expect(fichaDeLugar(lugarPublico(lugarCentinela())).donde.rutaDelBarrio).toBeNull();
  });

  it('las etiquetas se resuelven, y sin resolver cae al slug', () => {
    expect(ficha().tipo).toBe(`Etiqueta de tipo-lugar:${CENTINELA_LUGAR.tipo}`);
    expect(ficha().condicion).toBe(`Etiqueta de condicion-de-uso:${CENTINELA_LUGAR.condicion}`);
    const crudo = fichaDeLugar(lugarPublico(lugarCentinela()));
    expect(crudo.tipo).toBe(CENTINELA_LUGAR.tipo);
  });

  it('la ficha pasa su propio barrido, en los dos casos', () => {
    /*
     * **Lista propia y no la de la proyección**: la ficha no lleva `searchText`.
     * Se arma **sin resolver las etiquetas** a propósito: con las etiquetas
     * puestas, los centinelas de los slugs desaparecerían por el motivo
     * equivocado.
     */
    barrerLugar(
      'FichaDeLugar (local)',
      JSON.stringify(fichaDeLugar(lugarPublico(lugarCentinela()))),
      PERMITIDO_EN_LA_FICHA,
    );
    barrerLugar(
      'FichaDeLugar (casa)',
      JSON.stringify(fichaDeLugar(lugarPublico(lugarCentinelaSinDireccion()))),
      PERMITIDO_SIN_DIRECCION,
    );
  });

  it('el JSON-LD es un `Place`, y NO un `LocalBusiness` ni un `EventVenue`', () => {
    /*
     * **Por qué no `LocalBusiness`/`BookStore`:** ese tipo exige `address`, y la
     * mitad de este directorio es una casa cuya dirección decidimos no publicar
     * (§ 6). Un `LocalBusiness` sin `address` es un local que no existe. Además
     * declararía como comercio a un lugar que presta el salón sin cobrar.
     *
     * **Por qué no `EventVenue`:** suena más preciso y por eso mismo afirma de
     * más — dice que el lugar **es** un salón de eventos, y un café que presta la
     * mesa del fondo los martes no lo es. Es el contra del § 9 («puede convertirse
     * en una inmobiliaria de salones») escrito para una máquina.
     *
     * **Si estás acá porque este caso se puso rojo:** alguien cambió el tipo. No
     * lo arregles cambiando el aserto; leé el párrafo de arriba y el § 7 del PRD.
     */
    const ld = datosEstructuradosDeLugar(ficha()) as Record<string, unknown>;
    expect(ld['@type']).toBe('Place');
    const texto = JSON.stringify(ld);
    expect(texto).not.toContain('LocalBusiness');
    expect(texto).not.toContain('BookStore');
    expect(texto).not.toContain('EventVenue');
  });

  it('publica la capacidad y lo que incluye, que es lo que hace útil al marcado', () => {
    const ld = datosEstructuradosDeLugar(ficha()) as Record<string, unknown>;
    expect(ld.maximumAttendeeCapacity).toBe(37);
    expect(ld.amenityFeature).toEqual([
      {
        '@type': 'LocationFeatureSpecification',
        name: `Etiqueta de incluye-lugar:${CENTINELA_LUGAR.incluye}`,
        value: true,
      },
    ]);
  });

  it('⚠️ sin dirección publicada NO hay `address` ni `geo` — criterio 5 del PRD', () => {
    /*
     * **El camino que se filtra sin que nadie lo vea**, y el PRD lo dice así:
     * «nadie lee el JSON-LD al revisar una ficha». La ausencia tiene que ser
     * total: ni siquiera un `address` con la localidad sola, porque entonces la
     * clave existiría y el próximo campo entraría por ahí.
     *
     * MUTACIÓN PROBADA: emitir `address` siempre —aunque sea con
     * `addressLocality` solo— deja este caso en rojo; emitir `geo` sin mirar la
     * dirección, también.
     */
    const casa = datosEstructuradosDeLugar(
      fichaDeLugar(lugarPublico(lugarCentinelaSinDireccion())),
    ) as Record<string, unknown>;
    expect(casa).not.toHaveProperty('address');
    expect(casa).not.toHaveProperty('geo');
    expect(JSON.stringify(casa)).not.toContain(CENTINELA_LUGAR.direccion);
    expect(JSON.stringify(casa)).not.toContain('-34.6037');

    // Y el control positivo: con el flag prendido las dos claves están.
    const local = datosEstructuradosDeLugar(ficha()) as Record<string, unknown>;
    expect(local.address).toMatchObject({
      '@type': 'PostalAddress',
      streetAddress: CENTINELA_LUGAR.direccion,
      addressCountry: 'AR',
    });
    expect(local.geo).toMatchObject({ '@type': 'GeoCoordinates', latitude: -34.6037 });
  });

  it('el precio NO está en el marcado, y tampoco un `priceRange` — § 7 del PRD', () => {
    /*
     * Dos decisiones distintas que caen del mismo lado:
     *
     * - **sin `priceRange`**, porque «la condición no es un rango de precios»
     *   (§ 7 con todas las letras): `con-consumicion` no tiene rango;
     * - **sin el precio en ninguna forma**, por lo mismo que el `Offer` de una
     *   suscripción: un número que envejece publicado como dato estructurado es
     *   información equivocada en el lugar de más visibilidad. En la página va,
     *   con su fecha al lado.
     *
     * MUTACIÓN PROBADA: agregar `priceRange: '$$'` o el monto al marcado deja este
     * caso en rojo.
     */
    const texto = JSON.stringify(datosEstructuradosDeLugar(ficha()));
    for (const clave of ['priceRange', 'price', 'priceCurrency', 'offers', 'priceSpecification']) {
      expect(texto, `el marcado publica «${clave}»`).not.toContain(`"${clave}"`);
    }
    expect(texto).not.toContain('24681357');
    expect(texto).not.toContain('24.681.357');
  });

  it('sin imágenes ni perfiles, las claves no salen en `null`', () => {
    const pelado = fichaDeLugar(
      lugarPublico({ ...lugarCentinela(), imagenes: [], instagram: null, web: null, capacidad: null, incluye: [] }),
    );
    const ld = datosEstructuradosDeLugar(pelado);
    expect(ld).not.toHaveProperty('image');
    expect(ld).not.toHaveProperty('sameAs');
    expect(ld).not.toHaveProperty('maximumAttendeeCapacity');
    expect(ld).not.toHaveProperty('amenityFeature');
  });

  it('y el marcado tampoco filtra nada, con su propia lista y en los dos casos', () => {
    const local = fichaDeLugar(lugarPublico(lugarCentinela()));
    barrerLugar(
      'JSON-LD del lugar (local)',
      JSON.stringify([
        datosEstructuradosDeLugar(local),
        migasDeLugar(local),
        coleccionDeLugares([{ slug: CENTINELA_LUGAR.slug, nombre: CENTINELA_LUGAR.nombre }]),
      ]),
      PERMITIDO_EN_EL_MARCADO,
    );

    const casa = fichaDeLugar(lugarPublico(lugarCentinelaSinDireccion()));
    barrerLugar(
      'JSON-LD del lugar (casa)',
      JSON.stringify([datosEstructuradosDeLugar(casa), migasDeLugar(casa)]),
      PERMITIDO_EN_EL_MARCADO.filter((g) => !g.nombre.startsWith('⚠️')),
    );
  });

  it('las migas van de la agenda a la ficha, pasando por la Guía', () => {
    const migas = migasDeLugar(ficha()) as { itemListElement: { name: string }[] };
    expect(migas.itemListElement.map((m) => m.name)).toEqual([
      NOMBRE,
      'Guía',
      'Lugares para eventos',
      CENTINELA_LUGAR.nombre,
    ]);
  });

  it('la colección vacía no emite un `ItemList` sin elementos', () => {
    expect(coleccionDeLugares([])).toBeNull();
  });
});

describe('las dos frases del `<head>`, que son texto público — salida 25', () => {
  /*
   * **Están acá y no adentro de los `.astro` porque una frase interpolada en una
   * plantilla no se puede barrer**: vitest no importa `.astro`, así que el
   * productor quedaría fuera de toda red. Es el precedente de `descripcionDelMes`
   * (salida 8) y de las otras dos fichas de directorio.
   */
  const ficha = (doc: Lugar = lugarCentinela()) => fichaDeLugar(lugarPublico(doc));

  it('la de la ficha usa la descripción cargada cuando hay', () => {
    expect(descripcionDeLugar(ficha())).toBe(CENTINELA_LUGAR.descripcion);
  });

  it('y sin descripción arma la ficha mínima: qué es, en qué barrio y para cuántos', () => {
    const pelado = fichaDeLugar(lugarPublico({ ...lugarCentinela(), descripcion: null }));
    const frase = descripcionDeLugar(pelado);
    expect(frase).toContain(CENTINELA_LUGAR.nombre);
    expect(frase).toContain(CENTINELA_LUGAR.barrio);
    // Nunca vacía: una `meta description` en blanco la inventa Google con el
    // primer párrafo que encuentre.
    expect(frase.length).toBeGreaterThan(20);
  });

  it('⚠️ ninguna de las dos publica la dirección, ni cuando el flag está prendido', () => {
    /*
     * La `meta description` es lo que Google muestra en el resultado, o sea el
     * lugar donde el dato queda cosechable sin que nadie abra la página. Y hay un
     * segundo motivo, que es el que lo vuelve una decisión y no una omisión: si el
     * respaldo interpolara la dirección, la ficha de un café la publicaría y la de
     * una casa no, y esa asimetría se lee como un bug y se «arregla» publicándola
     * siempre.
     *
     * MUTACIÓN PROBADA: agregar `${f.donde.direccion}` al respaldo de
     * `descripcionDeLugar` deja este caso en rojo.
     */
    const pelado = fichaDeLugar(lugarPublico({ ...lugarCentinela(), descripcion: null }));
    for (const frase of [
      descripcionDeLugar(ficha()),
      descripcionDeLugar(pelado),
      descripcionDelDirectorioDeLugares(15),
    ]) {
      expect(frase).not.toContain(CENTINELA_LUGAR.direccion);
      expect(frase).not.toContain('24.681.357');
      expect(frase).not.toContain('cargado el');
    }
  });

  it('ninguna de las dos publica un centinela que no esté permitido', () => {
    const pelado = fichaDeLugar(lugarPublico({ ...lugarCentinela(), descripcion: null }));
    barrerLugar(
      'meta description de la ficha',
      `${descripcionDeLugar(ficha())} ${descripcionDeLugar(pelado)}`,
      [
        {
          nombre: 'la ficha mínima',
          centinelas: ['nombre', 'descripcion', 'tipo', 'barrio'],
          porque:
            'la frase dice qué es el lugar, de qué tipo y en qué barrio, que es lo que alguien ' +
            'lee en el resultado de Google antes de decidir si entra. Los cuatro ya se publican ' +
            'en la página, y la dirección **no está**.',
        },
      ],
    );
  });

  it('la del listado no interpola ninguna ficha: solo cuántos hay', () => {
    barrerLugar('meta description del listado', descripcionDelDirectorioDeLugares(15), []);
    expect(descripcionDelDirectorioDeLugares(1)).toContain('1 lugar ');
    expect(descripcionDelDirectorioDeLugares(0)).not.toContain('0');
  });
});
