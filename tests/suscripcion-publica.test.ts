/**
 * **La proyección pública de una suscripción literaria** — B-832, § 5 y § 8 del
 * PRD 3.
 *
 * Cuatro cosas, y las dos primeras son las que importan:
 *
 * 1. **El barrido de centinelas**, en las dos direcciones y con el control
 *    negativo codificado (la forma de B-212): ninguno de más —sería una fuga— y
 *    ninguno de menos —o se rompió la proyección, o la excepción sobra—. La fuga
 *    que existe para atrapar tiene nombre: `contactoDeQuienCargo`, viviendo en el
 *    mismo documento que **cuatro** destinos públicos, uno de ellos un link de
 *    cobro.
 * 2. **El precio, y las tres reglas de DEC-12.** Se verifica por valor y no por
 *    centinela (ver el fixture): que no salga sin su fecha, que no salga sin su
 *    período, que no salga como número, y que **no entre al `Offer`**.
 * 3. La cobertura del fixture contra `src/types/suscripcion-literaria.ts`.
 * 4. El saneo, el índice, la ficha y el JSON-LD.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import base from '@/lib/opciones-base.json';
import {
  EJES_DE_SUSCRIPCION,
  TEXTO_POR_PERIODO,
  coleccionDeSuscripciones,
  construirIndiceDeSuscripciones,
  datosEstructuradosDeSuscripcion,
  descripcionDeSuscripcion,
  descripcionDelDirectorioDeSuscripciones,
  fichaDeSuscripcion,
  fraseDePrecio,
  migasDeSuscripcion,
  suscripcionPublica,
} from '@/lib/suscripcionPublica';
import {
  CENTINELA_SUSCRIPCION,
  RUTAS_SUSCRIPCION,
  VALORES_NO_TEXTO_SUSCRIPCION,
  suscripcionCentinela,
  type RutaDeSuscripcion,
} from './fixtures/centinelas-suscripcion';
import { ts } from './fixtures/tiempo';
import { NOMBRE } from '@/lib/identidad';
import type { SuscripcionLiteraria } from '@/types/suscripcion-literaria';

const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

// ───────────────────────────────────────────────────────────────────────────
// Lo que SÍ sale, agrupado y con su motivo.
// La lista **es** el chequeo: una entrada sin justificación es una fuga
// aprobada por cansancio.
// ───────────────────────────────────────────────────────────────────────────

type Excepcion = { nombre: string; centinelas: readonly RutaDeSuscripcion[]; porque: string };

const PERMITIDO_EN_LA_PROYECCION: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10) y qué es y ' +
      'para quién. La descripción es **obligatoria** acá, al revés que en una librería: una ' +
      'suscripción es una promesa a futuro y sin eso la ficha no dice nada (§ 3.1 del PRD).',
  },
  {
    nombre: 'quién la ofrece',
    centinelas: ['ofrecidaPor.nombre', 'ofrecidaPor.tipo', 'ofrecidaPor.instagram', 'ofrecidaPor.libreriaSlug'],
    porque:
      'es el sujeto de la oferta y lo que la acción de la ficha nombra («Suscribite en la página ' +
      'de …», criterio 9). El `libreriaSlug` sale porque de él cuelga el enlace a la ficha de esa ' +
      'librería (§ 5 del PRD), y sale **solo si es un slug**.',
  },
  {
    nombre: 'las condiciones',
    centinelas: [
      'periodicidad',
      'compromisoMinimo',
      'incluye',
      'incluyeOtro',
      'envio.tematica',
      'envio.editoriales',
      'extras',
      'extrasOtro',
      'alcance',
    ],
    porque:
      'es literalmente lo que el dueño pidió que se pudiera contestar: «Qué incluye? Si envían ' +
      'libros: tiene temática? Son de editoriales independientes? Extras?». Tres de estos son ' +
      'además los ejes de filtro del § 5.',
  },
  {
    nombre: 'los cuatro destinos públicos',
    centinelas: ['linkDeSuscripcion', 'instagram', 'whatsapp', 'mail'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que la gente se pueda ' +
      'suscribir. El link es el riesgo propio de este PRD (§ 7) y por eso sale saneado, solo con ' +
      '`https:`, y en la página con `rel="noopener noreferrer"`.',
  },
  {
    nombre: 'la galería',
    centinelas: ['imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la ficha muestra **todas** las imágenes (criterio de B-296) y el epígrafe es el texto que ' +
      'alguien escribió para que se lea debajo. La URL sale **saneada**, no cruda.',
  },
  {
    nombre: 'el índice de búsqueda',
    centinelas: ['searchText'],
    porque:
      '§6 y §2.5 — el listado filtra en memoria y necesita contra qué comparar. No publica nada ' +
      'nuevo, y **no lleva el precio**: el buscador es un filtro, y filtrar por precio afirma que ' +
      'los precios son comparables (DEC-12).',
  },
];

/**
 * Lo que sale a la **ficha** (`FichaDeSuscripcion`, el view-model de la página).
 *
 * Es la proyección **menos `searchText`** (el índice existe para que el listado
 * filtre, y la página de una suscripción no filtra nada) y **menos
 * `ofrecidaPor.libreriaSlug`**: en la ficha ese slug no viaja como dato, viaja
 * resuelto adentro de una ruta, y solo si esa librería está publicada.
 */
const PERMITIDO_EN_LA_FICHA: readonly Excepcion[] = PERMITIDO_EN_LA_PROYECCION.map((g) =>
  g.nombre === 'quién la ofrece'
    ? { ...g, centinelas: g.centinelas.filter((c) => c !== 'ofrecidaPor.libreriaSlug') }
    : g,
).filter((g) => g.nombre !== 'el índice de búsqueda');

/**
 * Lo que sale al **marcado estructurado** (`Product` + migas + `CollectionPage`).
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
      'producto con una oferta, que es el SEO de esta sección (§ 5 del PRD).',
  },
  {
    nombre: 'quién la ofrece',
    centinelas: ['ofrecidaPor.nombre'],
    porque:
      '`brand` y `offers.seller`: quién vende esto. El **tipo no entra** —es un slug de nuestra ' +
      'taxonomía, no un dato de schema.org— y el `libreriaSlug` tampoco.',
  },
  {
    nombre: 'los perfiles',
    centinelas: ['instagram', 'ofrecidaPor.instagram'],
    porque:
      '`sameAs` es «las otras direcciones de esta misma entidad». El **WhatsApp y el mail no ' +
      'entran**: son canales de contacto, no perfiles, y publicarlos en el marcado los deja ' +
      'cosechables por cualquier parser sin que nadie abra la página.',
  },
  {
    nombre: 'el destino de la oferta',
    centinelas: ['linkDeSuscripcion'],
    porque:
      '`offers.url` es a dónde se compra, que es lo que un `Offer` significa. Va **sin `price`**: ' +
      'ver el caso que lo fija y el § 5 del PRD.',
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
 * copia es el criterio, que es la lista de arriba y se escribe a mano.
 */
const barrerSuscripcion = (
  salida: string,
  texto: string,
  grupos: readonly Excepcion[],
): void => {
  const permitido = new Set(grupos.flatMap((g) => g.centinelas));
  const fugas: string[] = [];
  const faltantes: string[] = [];

  for (const ruta of RUTAS_SUSCRIPCION) {
    const presente = texto.includes(CENTINELA_SUSCRIPCION[ruta]);
    if (presente && !permitido.has(ruta)) fugas.push(`${ruta} → ${CENTINELA_SUSCRIPCION[ruta]}`);
    if (!presente && permitido.has(ruta)) faltantes.push(`${ruta} → ${CENTINELA_SUSCRIPCION[ruta]}`);
  }

  expect(
    fugas,
    `FUGA DE PRIVACIDAD en «${salida}»: se publicó contenido que el § 8 del PRD no permite. ` +
      `Centinelas que sobrevivieron sin estar en la lista de excepciones: ${fugas.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);

  expect(
    faltantes,
    `«${salida}» dejó de publicar contenido que la lista de excepciones dice que sale. ` +
      `O se rompió la proyección, o la excepción sobra: ${faltantes.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);
};

describe('barrido de la proyección de una suscripción (§5.2, whitelist)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    barrerSuscripcion(
      'suscripcionPublica',
      JSON.stringify(suscripcionPublica(suscripcionCentinela())),
      PERMITIDO_EN_LA_PROYECCION,
    );
  });

  it('y el `contactoDeQuienCargo` no está, dicho por su nombre', () => {
    /*
     * MUTACIÓN PROBADA: agregar `contactoDeQuienCargo: s.contactoDeQuienCargo` a
     * `suscripcionPublica` pone en rojo este caso **y** el barrido de arriba,
     * nombrando el centinela.
     */
    const salida = JSON.stringify(suscripcionPublica(suscripcionCentinela()));
    expect(salida).not.toContain(CENTINELA_SUSCRIPCION['contactoDeQuienCargo.valor']);
    expect(salida).not.toContain('contactoDeQuienCargo');
  });

  it('tampoco la revisión ni el handle interno de Storage', () => {
    /*
     * `revision.porUid` es un uid, `revision.motivo` es por qué un admin descartó
     * una ficha —texto interno sobre un tercero— y `storagePath` es la ruta exacta
     * de un objeto en un bucket cuyo `list` está cerrado a propósito (trampa 13).
     */
    const salida = JSON.stringify(suscripcionPublica(suscripcionCentinela()));
    expect(salida).not.toContain(CENTINELA_SUSCRIPCION['revision.porUid']);
    expect(salida).not.toContain(CENTINELA_SUSCRIPCION['revision.motivo']);
    expect(salida).not.toContain(CENTINELA_SUSCRIPCION['imagenes.storagePath']);
  });

  it('CONTROL NEGATIVO: con un spread, el barrido falla nombrando el campo', () => {
    /*
     * **La forma de B-212**, y acá no es opcional: sin este caso, el barrido de
     * arriba podría estar verde porque la mecánica no mira nada (un fixture mal
     * armado, una lista de rutas vacía) y nadie se enteraría.
     */
    const conSpread = { ...suscripcionCentinela(), ...suscripcionPublica(suscripcionCentinela()) };
    let fallo: unknown = null;
    try {
      barrerSuscripcion('proyección con spread', JSON.stringify(conSpread), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      fallo = e;
    }
    expect(fallo, 'el barrido no detectó la fuga: entonces no verifica nada').not.toBeNull();
    expect(String(fallo)).toContain('contactoDeQuienCargo.valor');
    expect(String(fallo)).toContain('FUGA DE PRIVACIDAD');
  });

  it('CONTROL NEGATIVO: dejar de publicar algo permitido también falla, y no como fuga', () => {
    // La otra dirección. Sin ella, el barrido pasaría con una proyección vacía.
    const sinTematica = suscripcionPublica(suscripcionCentinela());
    sinTematica.envio = { ...sinTematica.envio, tematica: '' };
    let fallo: unknown = null;
    try {
      barrerSuscripcion('proyección recortada', JSON.stringify(sinTematica), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      fallo = e;
    }
    expect(fallo).not.toBeNull();
    expect(String(fallo)).toContain('dejó de publicar');
    expect(String(fallo)).toContain('envio.tematica');
  });
});

describe('el fixture de centinelas no puede envejecer', () => {
  /**
   * Cada campo de `SuscripcionLiteraria` tiene que estar cubierto: o lleva
   * centinela, o está declarado en `VALORES_NO_TEXTO_SUSCRIPCION` con el motivo.
   *
   * Se lee el **fuente** y no las claves del objeto, por lo mismo que los otros
   * dos barridos: un campo opcional que el fixture no setea no aparecería en
   * `Object.keys`, que es justo el campo que se olvida.
   *
   * MUTACIÓN PROBADA: agregar `cupo: number | null;` a la interfaz
   * `SuscripcionLiteraria` deja este caso en rojo nombrando el campo.
   */
  it('cubre todos los campos de `SuscripcionLiteraria`', () => {
    const src = readFileSync(raiz('src/types/suscripcion-literaria.ts'), 'utf8');
    const bloque = /export interface SuscripcionLiteraria \{\n([\s\S]*?)\n\}/.exec(src);
    expect(bloque, 'no se encontró `export interface SuscripcionLiteraria`').not.toBeNull();

    const campos = [...bloque![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
    expect(campos.length, 'no se leyó ningún campo de la interfaz').toBeGreaterThan(15);

    const conCentinela = new Set(RUTAS_SUSCRIPCION.map((r) => r.split('.')[0]!));
    const declarados = new Set(
      Object.keys(VALORES_NO_TEXTO_SUSCRIPCION).map((k) => k.split('.')[0]!),
    );

    const sinCubrir = campos.filter((c) => !conCentinela.has(c) && !declarados.has(c));
    expect(
      sinCubrir,
      'campos de `SuscripcionLiteraria` sin centinela ni declaración: el barrido no los mira, ' +
        `así que pueden publicarse sin que nada se ponga rojo: ${sinCubrir.join(', ')}`,
    ).toEqual([]);
  });

  it('ningún centinela es subcadena de otro: el barrido sería ambiguo', () => {
    const valores = RUTAS_SUSCRIPCION.map((r) => CENTINELA_SUSCRIPCION[r]);
    for (const a of valores) {
      const contenidos = valores.filter((b) => b !== a && b.includes(a));
      expect(contenidos, `«${a}» está adentro de otro centinela`).toEqual([]);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DEC-12 · el precio
// ───────────────────────────────────────────────────────────────────────────

describe('el precio se publica con su fecha o no se publica — DEC-12, B-837', () => {
  const con = (precio: SuscripcionLiteraria['precio']): SuscripcionLiteraria => ({
    ...suscripcionCentinela(),
    precio,
  });

  it('la frase lleva el monto, el período y la fecha, en un solo string', () => {
    const publica = suscripcionPublica(suscripcionCentinela());
    expect(publica.precio).toBe('$18.246.813 por mes · cargado el 1 de septiembre de 2026');
    // Y es **un string**, no un objeto: eso es lo que hace imposible filtrar,
    // ordenar o meterlo en un `Offer` (D-570).
    expect(typeof publica.precio).toBe('string');
  });

  it('sin fecha usable no sale el número: el dato huérfano desaparece', () => {
    /*
     * La mitad de B-837 que importa. Un documento restaurado del historial, o
     * escrito por un script, puede traer `cargadoEn` ausente o como string.
     *
     * MUTACIÓN PROBADA: devolver `$${monto}` sin pasar por `fraseConFecha` deja
     * este caso en rojo con el número publicado solo.
     */
    const sinFecha = { valor: { monto: 18246813, porPeriodo: 'mensual' }, cargadoEn: null };
    expect(fraseDePrecio(sinFecha as never)).toBe('');
    expect(suscripcionPublica(con(sinFecha as never)).precio).toBe('');
    expect(JSON.stringify(suscripcionPublica(con(sinFecha as never)))).not.toContain('18.246.813');
  });

  it('sin período nombrable tampoco: «$18.000 · cargado el …» no dice de qué período es', () => {
    /*
     * Un período creado con «Otro» no está en `TEXTO_POR_PERIODO`, y entonces la
     * frase no se puede escribir en castellano. Publicar el monto igual sería el
     * dato equivocado con cara de cierto que DEC-12 evita; el panel lo ve y
     * `pideRevision` lo manda a revisar.
     *
     * MUTACIÓN PROBADA: caer a `por ${slug}` en vez de devolver vacío deja este
     * caso en rojo.
     */
    const raro = { valor: { monto: 1000, porPeriodo: 'cada-luna-llena' }, cargadoEn: ts('2026-09-01T12:00:00Z') };
    expect(fraseDePrecio(raro)).toBe('');
  });

  it('sin precio, vacío; y un monto absurdo tampoco sale', () => {
    expect(fraseDePrecio(null)).toBe('');
    expect(suscripcionPublica(con(null)).precio).toBe('');
    const cero = { valor: { monto: 0, porPeriodo: 'mensual' }, cargadoEn: ts('2026-09-01T12:00:00Z') };
    expect(fraseDePrecio(cero)).toBe('');
  });

  it('el número crudo no sale por ninguna otra puerta de la proyección', () => {
    /*
     * El control que el fixture no puede dar con un centinela: que la proyección
     * publique **la frase** y no además el monto, el período o la fecha sueltos.
     *
     * MUTACIÓN PROBADA: agregar `precioMonto: s.precio?.valor.monto ?? null` a
     * `suscripcionPublica` deja este caso en rojo — y es exactamente la forma que
     * D-570 prohíbe: «un par que se proyecta en dos campos se separa».
     */
    const salida = JSON.stringify(suscripcionPublica(suscripcionCentinela()));
    expect(salida).toContain('$18.246.813 por mes · cargado el');
    expect(salida, 'el monto salió como número').not.toContain('18246813');
    expect(salida).not.toContain('cargadoEn');
    expect(salida).not.toContain('porPeriodo');
  });

  it('`TEXTO_POR_PERIODO` cubre todo el vocabulario base de `/opciones/periodicidad`', () => {
    /*
     * La clase de B-88: el mapa de frases y la taxonomía son dos derivaciones del
     * mismo vocabulario, y la que se quede vieja deja un período que existe en el
     * desplegable y cuyo precio **no se publica nunca**, en silencio.
     *
     * MUTACIÓN PROBADA: sacar `trimestral` de `TEXTO_POR_PERIODO` deja este caso
     * en rojo nombrando el slug.
     */
    const slugs = (base.periodicidad as { slug: string; fijo: boolean }[])
      .filter((v) => v.fijo)
      .map((v) => v.slug);
    expect(slugs.length, 'el vocabulario base de periodicidad está vacío').toBeGreaterThan(3);
    const sinFrase = slugs.filter((s) => !TEXTO_POR_PERIODO[s]);
    expect(
      sinFrase,
      `estos períodos existen en el desplegable y su precio no se podría publicar: ${sinFrase.join(', ')}`,
    ).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El saneo
// ───────────────────────────────────────────────────────────────────────────

describe('lo que se publica sale saneado, no crudo', () => {
  const con = (over: Partial<SuscripcionLiteraria>): SuscripcionLiteraria => ({
    ...suscripcionCentinela(),
    ...over,
  });

  it('el link de cobro admite `https:` y NADA más — criterio 7', () => {
    /*
     * Es la diferencia con la `web` de una librería, que acepta `http://`: acá el
     * link lleva a la página de cobro de un tercero (§ 7 del PRD).
     *
     * MUTACIÓN PROBADA: devolver `urlSegura(s.linkDeSuscripcion)` sin el chequeo
     * de `https://` deja este caso en rojo con el `http://`.
     */
    expect(suscripcionPublica(con({ linkDeSuscripcion: 'javascript:alert(1)' })).linkDeSuscripcion).toBeNull();
    expect(suscripcionPublica(con({ linkDeSuscripcion: 'http://cobro.example/x' })).linkDeSuscripcion).toBeNull();
    expect(suscripcionPublica(con({ linkDeSuscripcion: 'https://cobro.example/x' })).linkDeSuscripcion).toBe(
      'https://cobro.example/x',
    );
  });

  it('los tres contactos se sanean como en una librería', () => {
    expect(suscripcionPublica(con({ instagram: 'cuenta/otra' })).instagram).toBeNull();
    expect(suscripcionPublica(con({ instagram: '@lacaja' })).instagram).toBe('lacaja');
    expect(suscripcionPublica(con({ whatsapp: '123' })).whatsapp).toBeNull();
    expect(suscripcionPublica(con({ whatsapp: '+54 9 11 8765-4321' })).whatsapp).toBe('5491187654321');
    expect(suscripcionPublica(con({ mail: 'escribinos por instagram' })).mail).toBeNull();
  });

  it('un slug de vocabulario que no es un slug se descarta, elemento por elemento', () => {
    /*
     * La regla **no itera listas** (B-842), así que un `curl` puede mandar doce
     * strings arbitrarios en `incluye`. Acá se descarta lo que no pasó por
     * `slugify`: un valor con mayúsculas no resuelve etiqueta y, en los ejes de
     * filtro, deja la ficha fuera de su propio chip.
     *
     * MUTACIÓN PROBADA: devolver `s.incluye` tal cual deja este caso en rojo con
     * el `Con Mayúsculas` publicado.
     */
    const publica = suscripcionPublica(
      con({
        incluye: ['libros', 'Con Mayúsculas', '', 'libros'],
        periodicidad: 'No Es Un Slug',
        ofrecidaPor: { ...suscripcionCentinela().ofrecidaPor, tipo: 'tipo con espacios' },
      }),
    );
    // Sin repetidos y sin basura.
    expect(publica.incluye).toEqual(['libros']);
    expect(publica.periodicidad).toBe('');
    expect(publica.ofrecidaPor.tipo).toBe('');
  });

  it('el `libreriaSlug` sale solo si es un slug: de ahí cuelga una URL del sitio', () => {
    const conBasura = suscripcionPublica(
      con({ ofrecidaPor: { ...suscripcionCentinela().ofrecidaPor, libreriaSlug: '../otra/cosa' } }),
    );
    expect(conBasura.ofrecidaPor.libreriaSlug).toBeNull();
  });

  it('con `manda: false` los cuatro datos del envío salen vacíos aunque el documento tenga algo', () => {
    /*
     * **La tercera instancia del par flag + dato** (`urlPublica`,
     * `material.publico`). Una suscripción que dejó de mandar libros y conservó su
     * temática publicaría «novela negra» de algo que ya no manda nada: el flag
     * dice una cosa y el dato otra.
     *
     * MUTACIÓN PROBADA: proyectar `envio` campo por campo sin mirar `manda` deja
     * este caso en rojo con la temática publicada.
     */
    const publica = suscripcionPublica(
      con({
        envio: {
          manda: false,
          cuantos: 3,
          tematica: CENTINELA_SUSCRIPCION['envio.tematica'],
          editoriales: CENTINELA_SUSCRIPCION['envio.editoriales'],
          sorpresa: true,
        },
      }),
    );
    expect(publica.envio).toEqual({
      manda: false,
      cuantos: null,
      tematica: '',
      editoriales: '',
      sorpresa: null,
    });
    expect(JSON.stringify(publica)).not.toContain(CENTINELA_SUSCRIPCION['envio.tematica']);
  });

  it('una imagen con URL inválida se descarta y la portada pasa a ser la siguiente', () => {
    const base0 = suscripcionCentinela().imagenes[0]!;
    const publica = suscripcionPublica(
      con({
        imagenes: [
          { ...base0, id: 'img_rota', url: 'javascript:alert(1)', portada: true },
          { ...base0, id: 'img_sana', url: 'https://ok.example/sana.jpg', portada: false },
        ],
      }),
    );
    expect(publica.imagenes.map((i) => i.url)).toEqual(['https://ok.example/sana.jpg']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El índice
// ───────────────────────────────────────────────────────────────────────────

describe('el índice de `/suscripciones.json`', () => {
  const publica = (over: Partial<SuscripcionLiteraria>) =>
    suscripcionPublica({ ...suscripcionCentinela(), ...over });

  const indice = (suscripciones: ReturnType<typeof publica>[], vocabularios = {}) =>
    construirIndiceDeSuscripciones({
      suscripciones,
      vocabularios,
      version: '1.0.0',
      generadoEn: '2026-09-11T00:00:00.000Z',
    });

  it('ordena por nombre y no por el orden de la query', () => {
    const i = indice([
      publica({ nombre: 'Zeta', slug: 'zeta' }),
      publica({ nombre: 'Alfa', slug: 'alfa' }),
    ]);
    expect(i.suscripciones.map((s) => s.nombre)).toEqual(['Alfa', 'Zeta']);
  });

  it('los chips son solo los valores que alguna ficha usa', () => {
    /*
     * Mismo criterio que los barrios del directorio de librerías: un chip sin
     * fichas detrás es una promesa de cero resultados.
     *
     * MUTACIÓN PROBADA: sacar el `.filter((v) => usados.has(v.slug))` deja este
     * caso en rojo con `anual` en la lista.
     */
    const i = indice([publica({ periodicidad: 'mensual' })], {
      periodicidad: [
        { slug: 'mensual', label: 'Mensual', orden: 1, fijo: true, usos: 3 },
        { slug: 'anual', label: 'Anual', orden: 2, fijo: true, usos: 9 },
      ],
    });
    expect(i.filtros.periodicidad.map((v) => v.slug)).toEqual(['mensual']);
  });

  it('los tres ejes con vocabulario están, y son los del § 5 del PRD', () => {
    // Un cuarto eje que entre sin chips deja el filtro mudo; uno que se vaya deja
    // la island pidiendo una clave que no existe.
    expect([...EJES_DE_SUSCRIPCION]).toEqual([
      'perfil-editorial',
      'alcance-envio',
      'periodicidad',
    ]);
    expect(Object.keys(indice([]).filtros).sort()).toEqual([...EJES_DE_SUSCRIPCION].sort());
  });

  it('y el índice entero pasa el mismo barrido que la proyección', () => {
    // El JSON es lo que baja **todo el mundo**: si la proyección está limpia y el
    // índice la envuelve, el archivo tiene que estarlo también.
    barrerSuscripcion(
      '/suscripciones.json',
      JSON.stringify(indice([suscripcionPublica(suscripcionCentinela())])),
      PERMITIDO_EN_LA_PROYECCION,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// La ficha y su marcado
// ───────────────────────────────────────────────────────────────────────────

describe('la ficha y su marcado estructurado', () => {
  const ficha = () =>
    fichaDeSuscripcion(suscripcionPublica(suscripcionCentinela()), {
      etiqueta: (campo, slug) => `Etiqueta de ${campo}:${slug}`,
      libreriasPublicadas: new Set([CENTINELA_SUSCRIPCION['ofrecidaPor.libreriaSlug']]),
    });

  it('los contactos llegan como destino, no como texto crudo', () => {
    const f = ficha();
    expect(f.enlaces.whatsapp).toBe('https://wa.me/5491155556666');
    expect(f.enlaces.instagram).toBe(`https://instagram.com/${CENTINELA_SUSCRIPCION.instagram}`);
    expect(f.enlaces.mail).toBe(`mailto:${CENTINELA_SUSCRIPCION.mail}`);
    expect(f.ofrecidaPor.instagram).toBe(
      `https://instagram.com/${CENTINELA_SUSCRIPCION['ofrecidaPor.instagram']}`,
    );
  });

  it('la acción NOMBRA a quién le estás comprando — criterio 9', () => {
    /*
     * § 7 del PRD: «una ficha que dice "Suscribite" con un botón grande es un
     * endoso». La acción tiene que decir a dónde va, y el texto vive en el
     * view-model para que el barrido lo vea.
     *
     * MUTACIÓN PROBADA: cambiar el texto por `'Suscribite'` deja este caso en rojo.
     */
    const f = ficha();
    expect(f.accion?.href).toBe(CENTINELA_SUSCRIPCION.linkDeSuscripcion);
    expect(f.accion?.texto).toContain(CENTINELA_SUSCRIPCION['ofrecidaPor.nombre']);
    expect(f.accion?.texto).not.toBe('Suscribite');
  });

  it('sin link no hay acción, en vez de un botón que no lleva a ningún lado', () => {
    const sinLink = fichaDeSuscripcion(
      suscripcionPublica({ ...suscripcionCentinela(), linkDeSuscripcion: null }),
    );
    expect(sinLink.accion).toBeNull();
  });

  it('la ruta y la URL salen de `rutasPublicas`, con la barra final de B-330', () => {
    const f = ficha();
    expect(f.ruta).toBe('/guia/suscripciones/centinela-suscripcion-slug/');
    expect(f.url).toBe('https://agendaleh.ar/guia/suscripciones/centinela-suscripcion-slug/');
  });

  it('la librería que la ofrece se linkea SOLO si está publicada', () => {
    /*
     * Mismo criterio que el hub de barrio en la ficha de una librería: linkear a
     * ciegas publicaría un 404 en cada suscripción cuya librería espera decisión.
     *
     * MUTACIÓN PROBADA: armar la ruta sin consultar `libreriasPublicadas` deja
     * este caso en rojo.
     */
    expect(ficha().ofrecidaPor.ruta).toBe('/guia/librerias/centinela-libreria-slug/');
    const sinLibreria = fichaDeSuscripcion(suscripcionPublica(suscripcionCentinela()));
    expect(sinLibreria.ofrecidaPor.ruta).toBeNull();
  });

  it('las etiquetas se resuelven, y sin resolver cae al slug', () => {
    expect(ficha().periodicidad).toBe(
      `Etiqueta de periodicidad:${CENTINELA_SUSCRIPCION.periodicidad}`,
    );
    const crudo = fichaDeSuscripcion(suscripcionPublica(suscripcionCentinela()));
    expect(crudo.periodicidad).toBe(CENTINELA_SUSCRIPCION.periodicidad);
  });

  it('la ficha pasa su propio barrido: el view-model no agrega campos del documento', () => {
    /*
     * **Lista propia y no la de la proyección**: la ficha no lleva `searchText`
     * —es el índice que filtra el listado— ni el `libreriaSlug` como dato, y eso
     * es una decisión que este caso fija. Se arma **sin resolver las etiquetas** a
     * propósito: con las etiquetas puestas, los centinelas de los slugs
     * desaparecerían por el motivo equivocado.
     */
    barrerSuscripcion(
      'FichaDeSuscripcion',
      JSON.stringify(fichaDeSuscripcion(suscripcionPublica(suscripcionCentinela()))),
      PERMITIDO_EN_LA_FICHA,
    );
  });

  it('el JSON-LD es un `Product` con una `Offer`, y NO un `BookStore`', () => {
    /*
     * **Por qué no `BookStore`:** ese tipo es un `LocalBusiness` y exige
     * `address`. Una suscripción no tiene dirección, así que declararla así
     * obligaría a inventar un lugar que no existe — y competiría con la ficha de
     * la librería real que a veces la ofrece.
     */
    const ld = datosEstructuradosDeSuscripcion(ficha()) as Record<string, unknown>;
    expect(ld['@type']).toBe('Product');
    expect(JSON.stringify(ld)).not.toContain('BookStore');
    expect(ld).not.toHaveProperty('address');
    expect(ld.offers).toMatchObject({
      '@type': 'Offer',
      url: CENTINELA_SUSCRIPCION.linkDeSuscripcion,
    });
    expect(ld.brand).toMatchObject({ name: CENTINELA_SUSCRIPCION['ofrecidaPor.nombre'] });
  });

  it('el precio NO está en el `Offer`, y este caso dice por qué — criterio 5', () => {
    /*
     * **La excepción deliberada del § 5 del PRD.** Google **muestra** el precio
     * del `Offer` en el resultado de búsqueda, y un precio de tres meses en un
     * país con esta inflación se publica equivocado en el lugar de más
     * visibilidad y con la credibilidad de un dato estructurado. En la página va,
     * con su fecha al lado, donde la persona lo lee en contexto.
     *
     * El costo asumido es que la ficha no es elegible para el resultado
     * enriquecido de precio. El beneficio es no afirmar un número que nadie
     * mantiene — la misma clase de decisión que B-780.
     *
     * **Si estás acá porque este caso se puso rojo:** alguien agregó el precio al
     * marcado. No lo arregles cambiando el aserto; leé el párrafo de arriba y el
     * § 5 del PRD, y si de verdad hay que revisar la decisión, revisala ahí.
     *
     * MUTACIÓN PROBADA: agregar `price: 18246813, priceCurrency: 'ARS'` al
     * `Offer` deja este caso en rojo.
     */
    const texto = JSON.stringify(datosEstructuradosDeSuscripcion(ficha()));
    for (const clave of ['price', 'priceCurrency', 'priceSpecification', 'lowPrice', 'highPrice']) {
      expect(texto, `el marcado publica «${clave}»`).not.toContain(`"${clave}"`);
    }
    // Ni el número, ni la frase: la frase lleva el número adentro.
    expect(texto).not.toContain('18246813');
    expect(texto).not.toContain('18.246.813');
  });

  it('sin imágenes ni perfiles, las claves no salen en `null`', () => {
    /*
     * Una clave con `null` adentro es un dato mal declarado: el validador de
     * Google lo trata como error, no como ausencia.
     */
    const pelada = fichaDeSuscripcion(
      suscripcionPublica({
        ...suscripcionCentinela(),
        imagenes: [],
        instagram: null,
        ofrecidaPor: { ...suscripcionCentinela().ofrecidaPor, instagram: null },
      }),
    );
    const ld = datosEstructuradosDeSuscripcion(pelada);
    expect(ld).not.toHaveProperty('image');
    expect(ld).not.toHaveProperty('sameAs');
  });

  it('y el marcado tampoco filtra nada, con su propia lista', () => {
    const sinResolver = fichaDeSuscripcion(suscripcionPublica(suscripcionCentinela()));
    const texto = JSON.stringify([
      datosEstructuradosDeSuscripcion(sinResolver),
      migasDeSuscripcion(sinResolver),
      coleccionDeSuscripciones([
        { slug: CENTINELA_SUSCRIPCION.slug, nombre: CENTINELA_SUSCRIPCION.nombre },
      ]),
    ]);
    barrerSuscripcion('JSON-LD de la suscripción', texto, PERMITIDO_EN_EL_MARCADO);
  });

  it('las migas van de la agenda a la ficha, pasando por la Guía', () => {
    const migas = migasDeSuscripcion(ficha()) as { itemListElement: { name: string }[] };
    expect(migas.itemListElement.map((m) => m.name)).toEqual([
      NOMBRE,
      'Guía',
      'Suscripciones literarias',
      CENTINELA_SUSCRIPCION.nombre,
    ]);
  });

  it('la colección vacía no emite un `ItemList` sin elementos', () => {
    expect(coleccionDeSuscripciones([])).toBeNull();
  });
});

describe('las dos frases del `<head>`, que son texto público — salida 23', () => {
  /*
   * **Están acá y no adentro de los `.astro` porque una frase interpolada en una
   * plantilla no se puede barrer**: vitest no importa `.astro`, así que el
   * productor quedaría fuera de toda red. Es el precedente de `descripcionDelMes`
   * (salida 8) y de `descripcionDeLibreria` (salida 21).
   */
  const ficha = () => fichaDeSuscripcion(suscripcionPublica(suscripcionCentinela()));

  it('la de la ficha usa la descripción cargada cuando hay', () => {
    expect(descripcionDeSuscripcion(ficha())).toBe(CENTINELA_SUSCRIPCION.descripcion);
  });

  it('y sin descripción arma la ficha mínima: qué es, de quién y cada cuánto', () => {
    const pelada = fichaDeSuscripcion(
      suscripcionPublica({ ...suscripcionCentinela(), descripcion: '' }),
    );
    const frase = descripcionDeSuscripcion(pelada);
    expect(frase).toContain(CENTINELA_SUSCRIPCION.nombre);
    expect(frase).toContain(CENTINELA_SUSCRIPCION['ofrecidaPor.nombre']);
    // Nunca vacía: una `meta description` en blanco la inventa Google con el
    // primer párrafo que encuentre.
    expect(frase.length).toBeGreaterThan(20);
  });

  it('ninguna de las dos publica el precio — DEC-12 hasta el `<head>`', () => {
    /*
     * La `meta description` es lo que Google muestra en el resultado y lo que más
     * tarda en refrescarse: publicar ahí un número que puede tener tres meses es
     * exactamente lo que el § 5 decide no hacer con el `Offer`.
     *
     * MUTACIÓN PROBADA: agregar `${f.precio}` a `descripcionDeSuscripcion` deja
     * este caso en rojo.
     */
    const pelada = fichaDeSuscripcion(
      suscripcionPublica({ ...suscripcionCentinela(), descripcion: '' }),
    );
    for (const frase of [
      descripcionDeSuscripcion(ficha()),
      descripcionDeSuscripcion(pelada),
      descripcionDelDirectorioDeSuscripciones(15),
    ]) {
      expect(frase).not.toContain('18.246.813');
      expect(frase).not.toContain('cargado el');
    }
  });

  it('ninguna de las dos publica un centinela que no esté permitido', () => {
    const pelada = fichaDeSuscripcion(
      suscripcionPublica({ ...suscripcionCentinela(), descripcion: '' }),
    );
    barrerSuscripcion(
      'meta description de la ficha',
      `${descripcionDeSuscripcion(ficha())} ${descripcionDeSuscripcion(pelada)}`,
      [
        {
          nombre: 'la ficha mínima',
          centinelas: ['nombre', 'descripcion', 'ofrecidaPor.nombre', 'periodicidad'],
          porque:
            'la frase dice qué es la suscripción, de quién y cada cuánto llega, que es lo que ' +
            'alguien lee en el resultado de Google antes de decidir si entra. Los cuatro ya se ' +
            'publican en la página.',
        },
      ],
    );
  });

  it('la del listado no interpola ninguna ficha: solo cuántas hay', () => {
    barrerSuscripcion(
      'meta description del listado',
      descripcionDelDirectorioDeSuscripciones(15),
      [],
    );
    expect(descripcionDelDirectorioDeSuscripciones(1)).toContain('1 suscripción literaria ');
    expect(descripcionDelDirectorioDeSuscripciones(0)).not.toContain('0');
  });
});
