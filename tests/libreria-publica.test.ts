/**
 * **La proyección pública de una librería** — B-901, § 4 y § 8 del PRD 2.
 *
 * Tres cosas, y la primera es la que importa:
 *
 * 1. **El barrido de centinelas**, en las dos direcciones y con el control
 *    negativo codificado (la forma de B-212): ninguno de más —sería una fuga— y
 *    ninguno de menos —o se rompió la proyección, o la excepción sobra—. Y la
 *    fuga que este barrido existe para atrapar tiene nombre:
 *    `contactoDeQuienCargo`, el segundo dato personal de un tercero que guarda el
 *    proyecto, viviendo en el mismo documento que los cuatro contactos que sí son
 *    públicos.
 * 2. **La cobertura del fixture** contra `src/types/libreria.ts`: un campo nuevo
 *    del modelo que no tenga centinela ni declaración deja esto en rojo, así que
 *    no puede entrar al barrido con un valor inocente.
 * 3. El saneo, el índice, la ficha y el JSON-LD.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  coleccionDeLibrerias,
  construirIndiceDeLibrerias,
  datosEstructuradosDeLibreria,
  descripcionDeLibreria,
  descripcionDelDirectorio,
  fichaDeLibreria,
  libreriaPublica,
  migasDeLibreria,
} from '@/lib/libreriaPublica';
import {
  CENTINELA_LIBRERIA,
  RUTAS_LIBRERIA,
  VALORES_NO_TEXTO_LIBRERIA,
  libreriaCentinela,
  type RutaDeLibreria,
} from './fixtures/centinelas-libreria';
import { NOMBRE } from '@/lib/identidad';
import type { Libreria } from '@/types/libreria';

const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

// ───────────────────────────────────────────────────────────────────────────
// Lo que SÍ sale, agrupado y con su motivo.
// La lista **es** el chequeo: una entrada sin justificación es una fuga
// aprobada por cansancio.
// ───────────────────────────────────────────────────────────────────────────

type Excepcion = { nombre: string; centinelas: readonly RutaDeLibreria[]; porque: string };

const PERMITIDO_EN_LA_PROYECCION: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10) y qué tiene ' +
      'la librería. Sin esto no hay página.',
  },
  {
    nombre: 'dónde queda',
    centinelas: ['direccion', 'barrio', 'ciudad'],
    porque:
      'es un **local comercial**, no la casa de nadie (§ 8 del PRD). La dirección es el dato por ' +
      'el que alguien entra a la ficha, y el barrio es el mismo slug que usan las actividades — ' +
      'lo que deja cruzarlas en el hub.',
  },
  {
    nombre: 'los cuatro contactos públicos',
    centinelas: ['instagram', 'whatsapp', 'web', 'mail'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que la gente le escriba a ' +
      'la librería. El §5.1 del `CLAUDE.md` advierte por el WhatsApp personal y acá el número es ' +
      'de trabajo, con el cartel «este número se publica en el sitio» arriba del input (§ 9.4).',
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
      'nuevo: se deriva de nombre, descripción, dirección, barrio y ciudad, los cinco de esta ' +
      'misma lista.',
  },
];

/**
 * Lo que sale a la **ficha** (`FichaDeLibreria`, el view-model de la página).
 *
 * Es la proyección **menos `searchText`**: el índice de búsqueda existe para que
 * el listado filtre en memoria, y la página de una librería no filtra nada.
 * Publicarlo ahí sería repetir el nombre, la descripción y la dirección
 * normalizados, sin ningún consumidor.
 */
const PERMITIDO_EN_LA_FICHA: readonly Excepcion[] = PERMITIDO_EN_LA_PROYECCION.filter(
  (g) => g.nombre !== 'el índice de búsqueda',
);

/**
 * Lo que sale al **marcado estructurado** (`BookStore` + migas + `CollectionPage`).
 *
 * La lista más corta de las tres, y con motivo: esto lo lee una máquina y es lo
 * que Google puede mostrar **fuera** del sitio.
 */
const PERMITIDO_EN_EL_MARCADO: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      '`name`, `description` y el `url` canónico. Es lo que hace que la ficha entre al panel local ' +
      'de Google, que es todo el SEO de esta sección (§ 4 del PRD).',
  },
  {
    nombre: 'la dirección postal',
    centinelas: ['direccion', 'ciudad'],
    porque:
      '`PostalAddress` de un local comercial. El **barrio no entra**: no es un componente de ' +
      '`PostalAddress` y meterlo en `streetAddress` ensuciaría el dato que Google geocodifica.',
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
 * una **actividad** (`RUTAS_CENTINELA`), que es otra colección con otro fixture.
 * Lo que se copia es la mecánica —ocho líneas—; lo que no se copia es el
 * criterio, que es la lista de arriba y se escribe a mano.
 */
const barrerLibreria = (salida: string, texto: string, grupos: readonly Excepcion[]): void => {
  const permitido = new Set(grupos.flatMap((g) => g.centinelas));
  const fugas: string[] = [];
  const faltantes: string[] = [];

  for (const ruta of RUTAS_LIBRERIA) {
    const presente = texto.includes(CENTINELA_LIBRERIA[ruta]);
    if (presente && !permitido.has(ruta)) fugas.push(`${ruta} → ${CENTINELA_LIBRERIA[ruta]}`);
    if (!presente && permitido.has(ruta)) faltantes.push(`${ruta} → ${CENTINELA_LIBRERIA[ruta]}`);
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

describe('barrido de la proyección de una librería (§5.2, whitelist)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    barrerLibreria(
      'libreriaPublica',
      JSON.stringify(libreriaPublica(libreriaCentinela())),
      PERMITIDO_EN_LA_PROYECCION,
    );
  });

  it('y el `contactoDeQuienCargo` no está, dicho por su nombre', () => {
    /*
     * El barrido de arriba ya lo cubre, y este caso existe igual: es **el** campo
     * por el que esta colección necesita una whitelist, y un aserto que lo nombre
     * es lo que hace que un rojo se lea sin tener que reconstruir el razonamiento.
     *
     * MUTACIÓN PROBADA: agregar `contactoDeQuienCargo: l.contactoDeQuienCargo` a
     * `libreriaPublica` pone en rojo este caso **y** el barrido de arriba,
     * nombrando el centinela.
     */
    const salida = JSON.stringify(libreriaPublica(libreriaCentinela()));
    expect(salida).not.toContain(CENTINELA_LIBRERIA['contactoDeQuienCargo.valor']);
    expect(salida).not.toContain('contactoDeQuienCargo');
  });

  it('tampoco la revisión ni el handle interno de Storage', () => {
    /*
     * `revision.porUid` es un uid, `revision.motivo` es por qué un admin descartó
     * una ficha —texto interno sobre un tercero— y `storagePath` es la ruta exacta
     * de un objeto en un bucket cuyo `list` está cerrado a propósito (trampa 13).
     *
     * MUTACIÓN PROBADA: dejar pasar `storagePath` en `imagenesDeLibreria` pone en
     * rojo este caso y el barrido.
     */
    const salida = JSON.stringify(libreriaPublica(libreriaCentinela()));
    expect(salida).not.toContain(CENTINELA_LIBRERIA['revision.porUid']);
    expect(salida).not.toContain(CENTINELA_LIBRERIA['revision.motivo']);
    expect(salida).not.toContain(CENTINELA_LIBRERIA['imagenes.storagePath']);
  });

  it('CONTROL NEGATIVO: con un spread, el barrido falla nombrando el campo', () => {
    /*
     * **La forma de B-212**, y acá no es opcional: sin este caso, el barrido de
     * arriba podría estar verde porque la mecánica no mira nada (un fixture mal
     * armado, una lista de rutas vacía) y nadie se enteraría.
     *
     * Lo que se simula es exactamente el error que el § 1.2 del inventario
     * prohíbe: proyectar con un spread en vez de con la whitelist. La salida
     * resultante lleva el contacto interno, y el barrido tiene que decirlo **por
     * su nombre**.
     */
    const conSpread = { ...libreriaCentinela(), ...libreriaPublica(libreriaCentinela()) };
    let fallo: unknown = null;
    try {
      barrerLibreria('proyección con spread', JSON.stringify(conSpread), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      fallo = e;
    }
    expect(fallo, 'el barrido no detectó la fuga: entonces no verifica nada').not.toBeNull();
    expect(String(fallo)).toContain('contactoDeQuienCargo.valor');
    expect(String(fallo)).toContain('FUGA DE PRIVACIDAD');
  });

  it('CONTROL NEGATIVO: dejar de publicar algo permitido también falla, y no como fuga', () => {
    // La otra dirección. Sin ella, el barrido pasaría con una proyección vacía.
    const sinDireccion = { ...libreriaPublica(libreriaCentinela()), direccion: '' };
    let fallo: unknown = null;
    try {
      barrerLibreria('proyección recortada', JSON.stringify(sinDireccion), PERMITIDO_EN_LA_PROYECCION);
    } catch (e) {
      fallo = e;
    }
    expect(fallo).not.toBeNull();
    expect(String(fallo)).toContain('dejó de publicar');
    expect(String(fallo)).toContain('direccion');
  });
});

describe('el fixture de centinelas no puede envejecer', () => {
  /**
   * Cada campo de `Libreria` tiene que estar cubierto: o lleva centinela, o está
   * declarado en `VALORES_NO_TEXTO_LIBRERIA` con el motivo.
   *
   * Se lee el **fuente** de `src/types/libreria.ts` y no las claves del objeto,
   * por lo mismo que el barrido de la actividad: un campo opcional que el fixture
   * no setea no aparecería en `Object.keys`, que es justo el campo que se olvida.
   *
   * MUTACIÓN PROBADA: agregar `horarios: string | null;` a la interfaz `Libreria`
   * deja este caso en rojo nombrando el campo.
   */
  it('cubre todos los campos de `Libreria`', () => {
    const src = readFileSync(raiz('src/types/libreria.ts'), 'utf8');
    const bloque = /export interface Libreria \{\n([\s\S]*?)\n\}/.exec(src);
    expect(bloque, 'no se encontró `export interface Libreria`').not.toBeNull();

    const campos = [...bloque![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
    expect(campos.length, 'no se leyó ningún campo de la interfaz').toBeGreaterThan(10);

    const conCentinela = new Set(RUTAS_LIBRERIA.map((r) => r.split('.')[0]!));
    const declarados = new Set(Object.keys(VALORES_NO_TEXTO_LIBRERIA).map((k) => k.split('.')[0]!));

    const sinCubrir = campos.filter((c) => !conCentinela.has(c) && !declarados.has(c));
    expect(
      sinCubrir,
      'campos de `Libreria` sin centinela ni declaración: el barrido no los mira, así que ' +
        `pueden publicarse sin que nada se ponga rojo: ${sinCubrir.join(', ')}`,
    ).toEqual([]);
  });

  it('ningún centinela es subcadena de otro: el barrido sería ambiguo', () => {
    const valores = RUTAS_LIBRERIA.map((r) => CENTINELA_LIBRERIA[r]);
    for (const a of valores) {
      const contenidos = valores.filter((b) => b !== a && b.includes(a));
      expect(contenidos, `«${a}» está adentro de otro centinela`).toEqual([]);
    }
  });
});

describe('lo que se publica sale saneado, no crudo', () => {
  const con = (over: Partial<Libreria>): Libreria => ({ ...libreriaCentinela(), ...over });

  it('una web que no es `http(s)` no sale, ni siquiera como texto', () => {
    /*
     * La regla ya exige `^https?://.*`, pero la regla **no itera listas** y el
     * documento pudo entrar antes de que existiera. Acá el default es descartar.
     *
     * MUTACIÓN PROBADA: cambiar `web: urlSegura(l.web)` por `web: l.web` deja
     * este caso en rojo con el `javascript:`.
     */
    expect(libreriaPublica(con({ web: 'javascript:alert(1)' })).web).toBeNull();
    expect(libreriaPublica(con({ web: 'data:text/html,hola' })).web).toBeNull();
    // Sin esquema se asume `https://`, que es lo que `urlSegura` ya decide para
    // los demás campos de texto libre: quien carga escribe «casabrandon.com».
    expect(libreriaPublica(con({ web: 'casabrandon.com' })).web).toBe('https://casabrandon.com/');
  });

  it('un Instagram con una barra adentro no sale: mandaría a otra cuenta', () => {
    expect(libreriaPublica(con({ instagram: 'cuenta/otra' })).instagram).toBeNull();
    expect(libreriaPublica(con({ instagram: '@casabrandon' })).instagram).toBe('casabrandon');
  });

  it('un WhatsApp que no son 8–15 dígitos no sale: de ahí sale un `wa.me`', () => {
    expect(libreriaPublica(con({ whatsapp: '123' })).whatsapp).toBeNull();
    expect(libreriaPublica(con({ whatsapp: '+54 9 11 8765-4321' })).whatsapp).toBe('5491187654321');
  });

  it('un mail que no parece un mail no sale: sería un `mailto:` roto', () => {
    expect(libreriaPublica(con({ mail: 'escribinos por instagram' })).mail).toBeNull();
  });

  it('una imagen con URL inválida se descarta y la portada pasa a ser la siguiente', () => {
    /*
     * El criterio de `imagenesDeDetalle` (B-854): el índice de la portada se busca
     * **después** de filtrar, para que una portada rota no deje la ficha sin
     * imagen habiendo otras sanas.
     *
     * MUTACIÓN PROBADA: buscar la portada antes de filtrar deja este caso en rojo
     * con la lista vacía.
     */
    const base = libreriaCentinela().imagenes[0]!;
    const publica = libreriaPublica(
      con({
        imagenes: [
          { ...base, id: 'img_rota', url: 'javascript:alert(1)', portada: true },
          { ...base, id: 'img_sana', url: 'https://ok.example/sana.jpg', portada: false },
        ],
      }),
    );
    expect(publica.imagenes.map((i) => i.url)).toEqual(['https://ok.example/sana.jpg']);
  });

  it('la portada va primera, aunque esté última en el documento', () => {
    const base = libreriaCentinela().imagenes[0]!;
    const publica = libreriaPublica(
      con({
        imagenes: [
          { ...base, id: 'img_a', url: 'https://ok.example/a.jpg', portada: false },
          { ...base, id: 'img_b', url: 'https://ok.example/b.jpg', portada: true },
        ],
      }),
    );
    expect(publica.imagenes[0]!.url).toBe('https://ok.example/b.jpg');
  });
});

describe('el índice de `/librerias.json`', () => {
  const publica = (over: Partial<Libreria>) =>
    libreriaPublica({ ...libreriaCentinela(), ...over });

  it('ordena por nombre y no por el orden de la query', () => {
    const indice = construirIndiceDeLibrerias({
      librerias: [
        publica({ nombre: 'Zeta', slug: 'zeta' }),
        publica({ nombre: 'Alfa', slug: 'alfa' }),
      ],
      barrios: [],
      version: '1.0.0',
      generadoEn: '2026-09-11T00:00:00.000Z',
    });
    expect(indice.librerias.map((l) => l.nombre)).toEqual(['Alfa', 'Zeta']);
  });

  it('los chips son solo los barrios que alguna librería usa', () => {
    /*
     * `/opciones/barrio` la comparten las actividades, así que la taxonomía tiene
     * barrios sin ninguna librería. Ofrecerlos como chip es prometer cero
     * resultados — el mismo criterio con el que un hub vacío no entra al sitemap.
     *
     * MUTACIÓN PROBADA: sacar el `.filter((b) => usados.has(b.slug))` deja este
     * caso en rojo con «almagro» en la lista.
     */
    const indice = construirIndiceDeLibrerias({
      librerias: [publica({ barrio: 'palermo' })],
      barrios: [
        { slug: 'palermo', label: 'Palermo', orden: 1, fijo: true, usos: 3 },
        { slug: 'almagro', label: 'Almagro', orden: 2, fijo: true, usos: 9 },
      ],
      version: '1.0.0',
      generadoEn: '2026-09-11T00:00:00.000Z',
    });
    expect(indice.barrios.map((b) => b.slug)).toEqual(['palermo']);
  });

  it('y el índice entero pasa el mismo barrido que la proyección', () => {
    // El JSON es lo que baja **todo el mundo**: si la proyección está limpia y el
    // índice la envuelve, el archivo tiene que estarlo también.
    const indice = construirIndiceDeLibrerias({
      librerias: [libreriaPublica(libreriaCentinela())],
      barrios: [],
      version: '1.0.0',
      generadoEn: '2026-09-11T00:00:00.000Z',
    });
    barrerLibreria('/librerias.json', JSON.stringify(indice), PERMITIDO_EN_LA_PROYECCION);
  });
});

describe('la ficha y su marcado estructurado', () => {
  const ficha = () =>
    fichaDeLibreria(libreriaPublica(libreriaCentinela()), {
      etiquetaDeBarrio: 'Villa Crespo',
      rutaDelBarrio: '/barrio/villa-crespo/',
    });

  it('los cuatro contactos llegan como destino, no como texto crudo', () => {
    const f = ficha();
    expect(f.enlaces.whatsapp).toBe('https://wa.me/5491187654321');
    expect(f.enlaces.instagram).toBe('https://instagram.com/CENTINELA.instagram');
    expect(f.enlaces.mail).toBe('mailto:centinela.mail@example.com');
    expect(f.enlaces.web).toBe(CENTINELA_LIBRERIA.web);
  });

  it('la ruta y la URL salen de `rutasPublicas`, con la barra final de B-330', () => {
    const f = ficha();
    expect(f.ruta).toBe('/guia/librerias/centinela-slug/');
    expect(f.url).toBe('https://agendaleh.ar/guia/librerias/centinela-slug/');
  });

  it('el hub del barrio solo se linkea si quien armó la ficha dijo que existe', () => {
    /*
     * `/barrio/{slug}` lo emite el build para los barrios con alguna **actividad**,
     * y este directorio va a estrenar barrios que no tienen ninguna. Linkear a
     * ciegas publicaría un 404 en cada una de esas fichas.
     *
     * MUTACIÓN PROBADA: poner `rutaDeBarrio(l.barrio)` como default en
     * `fichaDeLibreria` deja este caso en rojo.
     */
    const sinHub = fichaDeLibreria(libreriaPublica(libreriaCentinela()));
    expect(sinHub.rutaDelBarrio).toBeNull();
    // Y sin etiqueta resuelta cae al slug, que es lo que el documento tiene.
    expect(sinHub.barrio).toBe('centinela-barrio');
  });

  it('la ficha pasa su propio barrido: el view-model no agrega campos del documento', () => {
    /*
     * **Lista propia y no la de la proyección**, y la diferencia es el chequeo:
     * la ficha **no lleva `searchText`** —es el índice que filtra el listado, y la
     * página de una librería no filtra nada— y eso es una decisión que este caso
     * fija. Con la lista de la proyección, el día que alguien meta el `searchText`
     * en el view-model esto seguiría verde.
     *
     * Se arma **sin resolver el barrio** a propósito: con la etiqueta puesta, el
     * centinela del slug desaparece por el motivo equivocado y el caso dejaría de
     * verificar que el barrio sale.
     */
    barrerLibreria('FichaDeLibreria', JSON.stringify(fichaDeLibreria(libreriaPublica(libreriaCentinela()))), PERMITIDO_EN_LA_FICHA);
  });

  it('el JSON-LD es un `BookStore` con dirección y sin `openingHours`', () => {
    /*
     * `openingHours` **no va** y es una decisión del § 4 del PRD: no se piden
     * horarios (§ 7), y un horario inventado es peor que ninguno — Google lo
     * muestra como un hecho y quien va se encuentra el local cerrado.
     */
    const ld = datosEstructuradosDeLibreria(ficha()) as Record<string, unknown>;
    expect(ld['@type']).toBe('BookStore');
    expect(ld).not.toHaveProperty('openingHours');
    expect(ld.address).toMatchObject({
      '@type': 'PostalAddress',
      streetAddress: CENTINELA_LIBRERIA.direccion,
      addressCountry: 'AR',
    });
    expect(ld.geo).toMatchObject({ '@type': 'GeoCoordinates', latitude: -34.6, longitude: -58.43 });
    expect(ld.url).toBe('https://agendaleh.ar/guia/librerias/centinela-slug/');
  });

  it('sin geo y sin imágenes, las claves no salen en `null`', () => {
    /*
     * Una clave con `null` adentro es un dato mal declarado: el validador de
     * Google lo trata como error, no como ausencia.
     *
     * MUTACIÓN PROBADA: emitir `geo: null` incondicionalmente deja este caso en rojo.
     */
    const pelada = fichaDeLibreria(
      libreriaPublica({ ...libreriaCentinela(), geo: null, imagenes: [] }),
    );
    const ld = datosEstructuradosDeLibreria(pelada);
    expect(ld).not.toHaveProperty('geo');
    expect(ld).not.toHaveProperty('image');
  });

  it('y el marcado tampoco filtra nada, con su propia lista', () => {
    /*
     * La tercera lista, y es la más corta de las tres: el JSON-LD es lo que lee
     * **una máquina** y lo que Google puede mostrar fuera del sitio, así que lo
     * que entra ahí se decide aparte. No lleva el WhatsApp ni el mail —`sameAs`
     * es para perfiles, no para canales de contacto—, no lleva el barrio ni el
     * epígrafe de cada foto, y no lleva `searchText`.
     */
    const sinResolver = fichaDeLibreria(libreriaPublica(libreriaCentinela()));
    const texto = JSON.stringify([
      datosEstructuradosDeLibreria(sinResolver),
      migasDeLibreria(sinResolver),
      coleccionDeLibrerias([libreriaPublica(libreriaCentinela())]),
    ]);
    barrerLibreria('JSON-LD de la librería', texto, PERMITIDO_EN_EL_MARCADO);
  });

  it('las migas van de la agenda a la ficha, pasando por la Guía', () => {
    const migas = migasDeLibreria(ficha()) as { itemListElement: { name: string }[] };
    expect(migas.itemListElement.map((m) => m.name)).toEqual([
      NOMBRE,
      'Guía',
      'Librerías',
      CENTINELA_LIBRERIA.nombre,
    ]);
  });

  it('la colección vacía no emite un `ItemList` sin elementos', () => {
    expect(coleccionDeLibrerias([])).toBeNull();
  });
});

describe('las dos frases del `<head>`, que son texto público — salida 21', () => {
  /*
   * **Están acá y no adentro de los `.astro` porque una frase interpolada en una
   * plantilla no se puede barrer**: vitest no importa `.astro`, así que el
   * productor quedaría fuera de toda red. Lo pidió el `auditor-privacidad`, con
   * el precedente de `descripcionDelMes` (salida 8): «hoy sale el título y el
   * peor caso está a un carácter».
   */
  const ficha = () => fichaDeLibreria(libreriaPublica(libreriaCentinela()));

  it('la de la ficha usa la descripción cargada cuando hay', () => {
    expect(descripcionDeLibreria(ficha())).toBe(CENTINELA_LIBRERIA.descripcion);
  });

  it('y sin descripción arma la ficha mínima: qué es y dónde queda', () => {
    const pelada = fichaDeLibreria(
      libreriaPublica({ ...libreriaCentinela(), descripcion: null }),
    );
    const frase = descripcionDeLibreria(pelada);
    expect(frase).toContain(CENTINELA_LIBRERIA.nombre);
    expect(frase).toContain(CENTINELA_LIBRERIA.direccion);
    // Nunca vacía: una `meta description` en blanco la inventa Google con el
    // primer párrafo que encuentre.
    expect(frase.length).toBeGreaterThan(20);
  });

  it('ninguna de las dos publica un centinela que no esté permitido', () => {
    /*
     * El barrido, con la lista de la ficha **menos el slug**: la frase describe
     * la librería, no su URL.
     *
     * MUTACIÓN PROBADA: agregar `${f.slug}` o cualquier campo interno a
     * `descripcionDeLibreria` deja este caso en rojo nombrando el centinela.
     */
    const sinDescripcion = fichaDeLibreria(
      libreriaPublica({ ...libreriaCentinela(), descripcion: null }),
    );
    barrerLibreria(
      'meta description de la ficha',
      `${descripcionDeLibreria(ficha())} ${descripcionDeLibreria(sinDescripcion)}`,
      [
        {
          nombre: 'la ficha mínima',
          centinelas: ['nombre', 'descripcion', 'direccion', 'barrio', 'ciudad'],
          porque:
            'la frase dice qué es la librería y dónde queda, que es lo que alguien lee en el ' +
            'resultado de Google antes de decidir si entra. Los cinco ya se publican en la página.',
        },
      ],
    );
  });

  it('la del listado no interpola ninguna ficha: solo cuántas hay', () => {
    /*
     * Cuántas librerías hay no es de nadie. Lo que este caso fija es que la frase
     * **no crezca** hacia nombrar alguna: sería publicar el nombre de una ficha
     * en el `<head>` de una página que no es la suya.
     */
    barrerLibreria('meta description del listado', descripcionDelDirectorio(40), []);
    expect(descripcionDelDirectorio(1)).toContain('1 librería ');
    expect(descripcionDelDirectorio(0)).not.toContain('0');
  });
});
