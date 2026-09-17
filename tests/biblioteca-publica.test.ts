/**
 * **La proyección pública de una biblioteca** — B-960.
 *
 * Tres cosas, y la primera es la que importa:
 *
 * 1. **El barrido de centinelas**, en las dos direcciones y con el control
 *    negativo codificado (la forma de B-212): ninguno de más —sería una fuga— y
 *    ninguno de menos —o se rompió la proyección, o la excepción sobra—. Y la
 *    fuga que este barrido existe para atrapar tiene nombre:
 *    `contactoDeQuienCargo`, el dato personal de un tercero, viviendo en el
 *    mismo documento que los cuatro contactos que sí son públicos.
 * 2. **La cobertura del fixture** contra `src/types/biblioteca.ts`: un campo
 *    nuevo del modelo que no tenga centinela ni declaración deja esto en rojo,
 *    así que no puede entrar al barrido con un valor inocente.
 * 3. El saneo, el índice, la ficha y el JSON-LD — con lo propio de esta
 *    colección: **el costo de asociarse nunca sale como número suelto**.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bibliotecaPublica,
  coleccionDeBibliotecas,
  construirIndiceDeBibliotecas,
  datosEstructuradosDeBiblioteca,
  descripcionDeBiblioteca,
  descripcionDelDirectorio,
  fichaDeBiblioteca,
  migasDeBiblioteca,
} from '@/lib/bibliotecaPublica';
import {
  CENTINELA_BIBLIOTECA,
  RUTAS_BIBLIOTECA,
  VALORES_NO_TEXTO_BIBLIOTECA,
  bibliotecaCentinela,
  type RutaDeBiblioteca,
} from './fixtures/centinelas-biblioteca';
import { NOMBRE } from '@/lib/identidad';
import type { Biblioteca } from '@/types/biblioteca';

const raiz = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

// ───────────────────────────────────────────────────────────────────────────
// Lo que SÍ sale, agrupado y con su motivo.
// La lista **es** el chequeo: una entrada sin justificación es una fuga
// aprobada por cansancio.
// ───────────────────────────────────────────────────────────────────────────

type Excepcion = { nombre: string; centinelas: readonly RutaDeBiblioteca[]; porque: string };

const PERMITIDO_EN_LA_PROYECCION: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion', 'tipo'],
    porque:
      'son la ficha: el nombre que se busca, la dirección web permanente (trampa 10), qué tiene ' +
      'la biblioteca y de qué tipo es. El `tipo` además es el eje de filtro propio de esta ' +
      'sección, así que sin él no hay chips.',
  },
  {
    nombre: 'dónde queda',
    centinelas: ['direccion', 'provincia', 'barrio', 'ciudad'],
    porque:
      'es una **institución**, no la casa de nadie — la diferencia con `/lugares`, que tiene ' +
      '`direccionPublica` justamente porque ahí puede serlo. La dirección es el dato por el que ' +
      'alguien entra a la ficha, y el barrio es el mismo slug que usan las actividades, que es ' +
      'lo que deja cruzarlas en el hub.',
  },
  {
    nombre: 'cuándo abre',
    centinelas: ['horarios', 'horarioDeSala'],
    porque:
      'son lo que el directorio existe para contestar después de la dirección, y en una ' +
      'biblioteca **son dos**: el mostrador y la sala de lectura pueden tener horarios ' +
      'distintos. Ninguno identifica a nadie. **No entran al JSON-LD**: son texto libre y ' +
      '`schema.org/openingHours` quiere un formato fijo — publicarlo mal formado haría que ' +
      'Google muestre un horario equivocado, que es peor que no mostrarlo.',
  },
  {
    nombre: 'cómo se saca un libro',
    centinelas: ['asociarse.costo.valor', 'catalogo'],
    porque:
      'es la razón de ser de esta sección. El catálogo es el dato que más le sirve a quien lee ' +
      '—mirar desde casa si el libro está— y el costo de asociarse sale **adentro de la frase ' +
      'con su fecha de carga pegada** (`fraseConFecha`, B-837/DEC-12), nunca como número suelto: ' +
      'la forma es la que impide que se pueda filtrar u ordenar por él.',
  },
  {
    nombre: 'los cuatro contactos públicos',
    centinelas: ['instagram', 'whatsapp', 'web', 'mail'],
    porque:
      'salen a propósito y **ése es el punto de la ficha**: existe para que la gente le escriba ' +
      'a la biblioteca. El §5.1 del `CLAUDE.md` advierte por el WhatsApp personal y acá el ' +
      'número es institucional, con el cartel «este número se publica en el sitio» arriba del ' +
      'input.',
  },
  {
    nombre: 'la galería',
    centinelas: ['imagenes.url', 'imagenes.epigrafe'],
    porque:
      'la ficha muestra **todas** las imágenes (criterio de B-296) y el epígrafe es el texto que ' +
      'alguien escribió para que se lea debajo. La URL sale **saneada**, no cruda.',
  },
  /*
   * **`searchText` NO es una excepción, y esta colección nace así.**
   *
   * En librerías y suscripciones estuvo acá mientras la proyección **copiaba**
   * el campo del documento, y el `auditor-privacidad` lo cobró el 2026-09-15 al
   * abrir el `create` anónimo: el campo lo escribe el cliente, y dos mil
   * caracteres elegidos por cualquiera salían al JSON por el único campo
   * publicado que la bandeja **no muestra**.
   *
   * Acá la proyección lo **deriva** con `searchTextDeBiblioteca` de los valores
   * ya proyectados desde el primer commit, así que el centinela del documento no
   * sobrevive y la excepción no existe. Los casos del final lo afirman.
   */
];

/**
 * Lo que sale a la **ficha** (`FichaDeBiblioteca`, el view-model de la página).
 *
 * Es la proyección entera: `searchText` no está en el barrido porque no
 * sobrevive, así que no hay nada que filtrar. La propiedad que la ficha sigue
 * teniendo —no publica el índice de búsqueda— la afirman sus propios casos.
 */
const PERMITIDO_EN_LA_FICHA: readonly Excepcion[] = PERMITIDO_EN_LA_PROYECCION;

/**
 * Lo que sale al **marcado estructurado** (`Library` + migas + `CollectionPage`).
 *
 * La lista más corta de las tres, y con motivo: esto lo lee una máquina y es lo
 * que Google puede mostrar **fuera** del sitio.
 */
const PERMITIDO_EN_EL_MARCADO: readonly Excepcion[] = [
  {
    nombre: 'identidad',
    centinelas: ['nombre', 'slug', 'descripcion'],
    porque:
      '`name`, `description` y el `url` canónico. Es lo que hace que la ficha entre al panel ' +
      'local de Google, que es todo el SEO de esta sección. **El `tipo` no entra**: `Library` ya ' +
      'dice qué es la entidad, y «popular» o «universitaria» no tienen propiedad donde caer sin ' +
      'inventarla.',
  },
  {
    nombre: 'la dirección postal',
    centinelas: ['direccion', 'ciudad', 'provincia'],
    porque:
      '`PostalAddress` de una institución: `streetAddress`, `addressLocality` y `addressRegion`, ' +
      'que es lo que distingue dos ciudades homónimas. El **barrio no entra**: no es un ' +
      'componente de `PostalAddress` y meterlo en `streetAddress` ensuciaría el dato que Google ' +
      'geocodifica.',
  },
  {
    nombre: 'los perfiles',
    centinelas: ['instagram', 'web', 'catalogo'],
    porque:
      '`sameAs` es «las otras direcciones de esta misma entidad», y el catálogo lo es: es la ' +
      'biblioteca en otro dominio. El **WhatsApp y el mail no entran**: son canales de contacto, ' +
      'no perfiles, y publicarlos en el marcado los deja cosechables por cualquier parser sin ' +
      'que nadie abra la página.',
  },
  {
    nombre: 'la imagen',
    centinelas: ['imagenes.url'],
    porque:
      '`image` es una lista de URLs. El **epígrafe no entra**: es texto para leer debajo de la ' +
      'foto, no un dato de la entidad.',
  },
  /*
   * **Ni los horarios ni el costo de asociarse entran al marcado**, y las dos
   * ausencias son decisiones:
   *
   * - los horarios, porque `openingHours` quiere un formato fijo (B-982);
   * - el costo, porque un `priceRange` o un `Offer` con esa frase adentro
   *   deshace la regla 2 de `datoConFecha.ts` (D-570) en la salida que más la
   *   amplifica: Google lo mostraría como un precio comparable, que es
   *   exactamente lo que la frase con fecha existe para impedir.
   */
];

/**
 * El barrido, en las dos direcciones.
 *
 * Vive acá y no en `tests/fixtures/barrido.ts` porque aquél recorre las rutas de
 * una **actividad** (`RUTAS_CENTINELA`), que es otra colección con otro fixture.
 * Lo que se copia es la mecánica —ocho líneas—; lo que no se copia es el
 * criterio, que es la lista de arriba y se escribe a mano.
 */
const barrerBiblioteca = (salida: string, texto: string, grupos: readonly Excepcion[]): void => {
  const permitido = new Set(grupos.flatMap((g) => g.centinelas));
  const fugas: string[] = [];
  const faltantes: string[] = [];

  for (const ruta of RUTAS_BIBLIOTECA) {
    const presente = texto.includes(CENTINELA_BIBLIOTECA[ruta]);
    if (presente && !permitido.has(ruta)) fugas.push(`${ruta} → ${CENTINELA_BIBLIOTECA[ruta]}`);
    if (!presente && permitido.has(ruta)) faltantes.push(`${ruta} → ${CENTINELA_BIBLIOTECA[ruta]}`);
  }

  expect(
    fugas,
    `FUGA DE PRIVACIDAD en «${salida}»: se publicó contenido que la whitelist no permite. ` +
      `Centinelas que sobrevivieron sin estar en la lista de excepciones: ${fugas.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);

  expect(
    faltantes,
    `«${salida}» dejó de publicar contenido que la lista de excepciones dice que sale. ` +
      `O se rompió la proyección, o la excepción sobra: ${faltantes.join(' | ') || '(ninguno)'}`,
  ).toEqual([]);
};

describe('barrido de la proyección de una biblioteca (§5.2, whitelist)', () => {
  it('sobreviven exactamente los centinelas permitidos', () => {
    barrerBiblioteca(
      'bibliotecaPublica',
      JSON.stringify(bibliotecaPublica(bibliotecaCentinela())),
      PERMITIDO_EN_LA_PROYECCION,
    );
  });

  it('y el `contactoDeQuienCargo` no está, dicho por su nombre', () => {
    /*
     * El barrido de arriba ya lo cubre, y este caso existe igual: es **el** campo
     * por el que esta colección necesita una whitelist, y un aserto que lo nombre
     * es lo que hace que un rojo se lea sin tener que reconstruir el razonamiento.
     *
     * MUTACIÓN PROBADA: agregar `contactoDeQuienCargo: b.contactoDeQuienCargo` a
     * `bibliotecaPublica` pone en rojo este caso **y** el barrido de arriba,
     * nombrando el centinela.
     */
    const salida = JSON.stringify(bibliotecaPublica(bibliotecaCentinela()));
    expect(salida).not.toContain(CENTINELA_BIBLIOTECA['contactoDeQuienCargo.valor']);
    expect(salida).not.toContain('contactoDeQuienCargo');
  });

  it('tampoco la revisión ni el handle interno de Storage', () => {
    /*
     * `revision.porUid` es un uid, `revision.motivo` es por qué un admin descartó
     * una ficha —texto interno sobre un tercero— y `storagePath` es la ruta
     * exacta de un objeto en un bucket cuyo `list` está cerrado a propósito
     * (trampa 13).
     */
    const salida = JSON.stringify(bibliotecaPublica(bibliotecaCentinela()));
    expect(salida).not.toContain(CENTINELA_BIBLIOTECA['revision.porUid']);
    expect(salida).not.toContain(CENTINELA_BIBLIOTECA['revision.motivo']);
    expect(salida).not.toContain(CENTINELA_BIBLIOTECA['imagenes.storagePath']);
  });

  it('el `searchText` del documento NO se copia: se deriva', () => {
    /*
     * El hallazgo del `auditor-privacidad` del 2026-09-15, aplicado desde el
     * primer commit de esta colección. El campo del documento lo escribe el
     * cliente —y acá el cliente puede ser un anónimo—, así que si se copiara,
     * dos mil caracteres elegidos por cualquiera saldrían al JSON por el único
     * campo publicado que la bandeja no muestra.
     *
     * MUTACIÓN PROBADA: cambiar la derivación por `searchText: b.searchText` deja
     * este caso en rojo con el centinela del documento adentro.
     */
    const proyectada = bibliotecaPublica(bibliotecaCentinela());
    expect(proyectada.searchText).not.toContain(CENTINELA_BIBLIOTECA.searchText);
    // Y lo que sí lleva: los valores publicados, normalizados.
    expect(proyectada.searchText).toContain(CENTINELA_BIBLIOTECA.nombre.toLowerCase());
    expect(proyectada.searchText).toContain(CENTINELA_BIBLIOTECA.tipo);
  });

  it('CONTROL NEGATIVO: con un spread, el barrido falla nombrando el campo', () => {
    /*
     * **La forma de B-212**, y acá no es opcional: sin este caso, el barrido de
     * arriba podría estar verde porque la mecánica no mira nada (un fixture mal
     * armado, una lista de rutas vacía) y nadie se enteraría.
     *
     * Lo que se simula es exactamente el error que el § 1.2 del inventario
     * prohíbe: proyectar con un spread en vez de con la whitelist.
     */
    const conSpread = { ...bibliotecaCentinela(), ...bibliotecaPublica(bibliotecaCentinela()) };
    let fallo: unknown = null;
    try {
      barrerBiblioteca(
        'proyección con spread',
        JSON.stringify(conSpread),
        PERMITIDO_EN_LA_PROYECCION,
      );
    } catch (e) {
      fallo = e;
    }
    expect(fallo, 'el barrido no detectó la fuga: entonces no verifica nada').not.toBeNull();
    expect(String(fallo)).toContain('contactoDeQuienCargo.valor');
    expect(String(fallo)).toContain('FUGA DE PRIVACIDAD');
  });

  it('CONTROL NEGATIVO: dejar de publicar algo permitido también falla, y no como fuga', () => {
    // La otra dirección. Sin ella, el barrido pasaría con una proyección vacía.
    const sinDireccion = { ...bibliotecaPublica(bibliotecaCentinela()), direccion: '' };
    let fallo: unknown = null;
    try {
      barrerBiblioteca(
        'proyección recortada',
        JSON.stringify(sinDireccion),
        PERMITIDO_EN_LA_PROYECCION,
      );
    } catch (e) {
      fallo = e;
    }
    expect(fallo).not.toBeNull();
    expect(String(fallo)).toContain('dejó de publicar');
    expect(String(fallo)).toContain('direccion');
  });
});

describe('barrido de la ficha y del marcado', () => {
  const ficha = () => fichaDeBiblioteca(bibliotecaPublica(bibliotecaCentinela()));

  it('la ficha publica lo mismo que la proyección', () => {
    barrerBiblioteca('fichaDeBiblioteca', JSON.stringify(ficha()), PERMITIDO_EN_LA_FICHA);
  });

  it('la ficha NO lleva el índice de búsqueda', () => {
    // Existe para que el listado filtre en memoria, y una página no filtra nada:
    // sería repetir el nombre, la descripción y la dirección normalizados sin
    // ningún consumidor.
    expect(JSON.stringify(ficha())).not.toContain('searchText');
  });

  it('el marcado estructurado es más corto que la ficha, y con motivo', () => {
    barrerBiblioteca(
      'datosEstructuradosDeBiblioteca',
      JSON.stringify(datosEstructuradosDeBiblioteca(ficha())),
      PERMITIDO_EN_EL_MARCADO,
    );
  });

  it('ni los horarios ni el costo entran al JSON-LD', () => {
    /*
     * Las dos ausencias son decisiones y no olvidos:
     *
     * - `openingHours` quiere un formato fijo y el horario es texto libre
     *   (B-982): emitirlo mal es peor que no emitirlo, porque Google lo muestra
     *   como un hecho;
     * - un `priceRange`/`Offer` con la frase del costo adentro deshace la regla 2
     *   de `datoConFecha.ts` en la salida que más la amplifica.
     */
    const json = JSON.stringify(datosEstructuradosDeBiblioteca(ficha()));
    expect(json).not.toContain('openingHours');
    expect(json).not.toContain('priceRange');
    expect(json).not.toContain('Offer');
    expect(json).not.toContain(CENTINELA_BIBLIOTECA.horarios);
    expect(json).not.toContain(CENTINELA_BIBLIOTECA['asociarse.costo.valor']);
  });

  it('el tipo del marcado es `Library` y las migas llevan los cuatro escalones', () => {
    expect(datosEstructuradosDeBiblioteca(ficha())['@type']).toBe('Library');
    const migas = migasDeBiblioteca(ficha()) as { itemListElement: { name: string }[] };
    expect(migas.itemListElement.map((i) => i.name)).toEqual([
      NOMBRE,
      'Guía',
      'Bibliotecas',
      CENTINELA_BIBLIOTECA.nombre,
    ]);
  });
});

describe('el fixture de centinelas no puede envejecer', () => {
  /**
   * Cada campo de `Biblioteca` tiene que estar cubierto: o lleva centinela, o
   * está declarado en `VALORES_NO_TEXTO_BIBLIOTECA` con el motivo.
   *
   * Se lee el **fuente** de `src/types/biblioteca.ts` y no las claves del
   * objeto, por lo mismo que el barrido de la actividad: un campo opcional que
   * el fixture no setea no aparecería en `Object.keys`, que es justo el campo
   * que se olvida.
   */
  it('cubre todos los campos de `Biblioteca`', () => {
    const src = readFileSync(raiz('src/types/biblioteca.ts'), 'utf8');
    const bloque = /export interface Biblioteca \{\n([\s\S]*?)\n\}/.exec(src);
    expect(bloque, 'no se encontró `export interface Biblioteca`').not.toBeNull();

    const campos = [...bloque![1]!.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
    expect(campos.length, 'no se leyó ningún campo de la interfaz').toBeGreaterThan(10);

    const conCentinela = new Set(RUTAS_BIBLIOTECA.map((r) => r.split('.')[0]!));
    const declarados = new Set(
      Object.keys(VALORES_NO_TEXTO_BIBLIOTECA).map((k) => k.split('.')[0]!),
    );

    const sinCubrir = campos.filter((c) => !conCentinela.has(c) && !declarados.has(c));
    expect(
      sinCubrir,
      'campos de `Biblioteca` sin centinela ni declaración: el barrido no los mira, así que ' +
        `pueden publicarse sin que nada se ponga rojo: ${sinCubrir.join(', ')}`,
    ).toEqual([]);
  });

  it('ningún centinela es subcadena de otro: el barrido sería ambiguo', () => {
    const valores = RUTAS_BIBLIOTECA.map((r) => CENTINELA_BIBLIOTECA[r]);
    for (const a of valores) {
      const contenidos = valores.filter((b) => b !== a && b.includes(a));
      expect(contenidos, `«${a}» está adentro de otro centinela`).toEqual([]);
    }
  });
});

describe('lo que se publica sale saneado, no crudo', () => {
  const con = (over: Partial<Biblioteca>): Biblioteca => ({ ...bibliotecaCentinela(), ...over });

  it('una web o un catálogo que no son `http(s)` no salen, ni como texto', () => {
    expect(bibliotecaPublica(con({ web: 'javascript:alert(1)' })).web).toBeNull();
    expect(bibliotecaPublica(con({ catalogo: 'javascript:alert(1)' })).catalogo).toBeNull();
    expect(bibliotecaPublica(con({ catalogo: 'data:text/html,hola' })).catalogo).toBeNull();
    // Sin esquema se asume `https://`, que es lo que `urlSegura` decide para los
    // demás campos de texto libre.
    expect(bibliotecaPublica(con({ catalogo: 'catalogo.test' })).catalogo).toBe(
      'https://catalogo.test/',
    );
  });

  it('un Instagram con una barra adentro no sale: mandaría a otra cuenta', () => {
    expect(bibliotecaPublica(con({ instagram: 'cuenta/otra' })).instagram).toBeNull();
    expect(bibliotecaPublica(con({ instagram: '@bpalberdi' })).instagram).toBe('bpalberdi');
  });

  it('un WhatsApp fuera de rango no sale: sería un `wa.me` roto', () => {
    expect(bibliotecaPublica(con({ whatsapp: '123' })).whatsapp).toBeNull();
    expect(bibliotecaPublica(con({ whatsapp: '9'.repeat(20) })).whatsapp).toBeNull();
  });

  it('una imagen con la URL rota se descarta, y las sanas quedan', () => {
    const rota = { ...bibliotecaCentinela().imagenes[0]!, id: 'img_rota', url: 'javascript:x', portada: false };
    const salida = bibliotecaPublica(con({ imagenes: [...bibliotecaCentinela().imagenes, rota] }));
    expect(salida.imagenes).toHaveLength(1);
  });
});

describe('el costo de asociarse — la regla 2 de `datoConFecha.ts` impuesta por la forma', () => {
  const con = (over: Partial<Biblioteca>): Biblioteca => ({ ...bibliotecaCentinela(), ...over });

  it('sale como frase con su fecha pegada, nunca como número suelto', () => {
    const salida = bibliotecaPublica(bibliotecaCentinela());
    expect(salida.asociarse.costo).toContain(CENTINELA_BIBLIOTECA['asociarse.costo.valor']);
    expect(salida.asociarse.costo).toContain('cargado el');
    // Y es un string, no un objeto: no hay forma de pedir el monto solo.
    expect(typeof salida.asociarse.costo).toBe('string');
  });

  it('sin fecha usable el dato desaparece en vez de publicarse solo', () => {
    /*
     * Es la mitad de la regla 1 que importa: un valor sin su fecha es justo lo
     * que no se puede publicar. `cargadoEn` puede llegar roto desde un documento
     * viejo, un script o una restauración del historial.
     */
    const sinFecha = con({
      asociarse: {
        haceFalta: true,
        costo: { valor: 'CENTINELA.asociarse.costo.valor', cargadoEn: null as never },
      },
    });
    expect(bibliotecaPublica(sinFecha).asociarse.costo).toBe('');
  });

  it('un costo colgado de un «no hace falta» no se publica: sería una contradicción', () => {
    /*
     * La regla y el schema lo prohíben, pero un documento anterior o escrito por
     * un script puede tenerlo igual. La proyección descarta lo que no puede
     * verificar, en vez de publicar «no hace falta asociarse · $3.000 por año».
     */
    const contradictorio = con({
      asociarse: {
        haceFalta: false,
        costo: { valor: 'CENTINELA.asociarse.costo.valor', cargadoEn: bibliotecaCentinela().creadoEn },
      },
    });
    const salida = bibliotecaPublica(contradictorio);
    expect(salida.asociarse.haceFalta).toBe(false);
    expect(salida.asociarse.costo).toBe('');
  });

  it('`haceFalta` sí sale: es media ficha', () => {
    expect(bibliotecaPublica(bibliotecaCentinela()).asociarse.haceFalta).toBe(true);
    expect(
      bibliotecaPublica(con({ asociarse: { haceFalta: false, costo: null } })).asociarse.haceFalta,
    ).toBe(false);
  });
});

describe('el índice y las descripciones', () => {
  const publica = () => bibliotecaPublica(bibliotecaCentinela());

  it('los chips se recortan a los valores que alguna ficha usa', () => {
    const indice = construirIndiceDeBibliotecas({
      bibliotecas: [publica()],
      vocabularios: {
        'tipo-biblioteca': [
          { slug: CENTINELA_BIBLIOTECA.tipo, label: 'El tipo', orden: 1, fijo: true, usos: 1 },
          { slug: 'sin-fichas', label: 'Sin fichas', orden: 2, fijo: true, usos: 0 },
        ],
      },
      version: 'v1',
      generadoEn: '2026-09-17T12:00:00Z',
    });
    // Un chip sin ninguna biblioteca detrás es una promesa de cero resultados.
    expect(indice.filtros['tipo-biblioteca'].map((v) => v.slug)).toEqual([
      CENTINELA_BIBLIOTECA.tipo,
    ]);
    expect(indice.bibliotecas).toHaveLength(1);
  });

  it('la descripción del listado no inventa un número', () => {
    expect(descripcionDelDirectorio(0)).not.toMatch(/\d/);
    expect(descripcionDelDirectorio(1)).toContain('1 biblioteca');
    expect(descripcionDelDirectorio(7)).toContain('7 bibliotecas');
  });

  it('la `meta description` de la ficha usa la cargada, y si no la arma', () => {
    const f = fichaDeBiblioteca(publica());
    expect(descripcionDeBiblioteca(f)).toBe(CENTINELA_BIBLIOTECA.descripcion);
    const sinDescripcion = fichaDeBiblioteca({ ...publica(), descripcion: '' });
    expect(descripcionDeBiblioteca(sinDescripcion)).toContain(CENTINELA_BIBLIOTECA.nombre);
    expect(descripcionDeBiblioteca(sinDescripcion)).toContain(CENTINELA_BIBLIOTECA.direccion);
  });

  it('la colección con la lista vacía es `null`', () => {
    expect(coleccionDeBibliotecas([])).toBeNull();
    expect(coleccionDeBibliotecas([publica()])).not.toBeNull();
  });
});
