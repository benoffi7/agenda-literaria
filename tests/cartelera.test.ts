import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { carteleraDeDetalles } from '@/lib/cartelera';
import { detalleDeActividad } from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { toPublic } from '@/lib/toPublic';
import { CLASES_DE_PARED } from '@/components/sitio/estilos';
import { columnasDeCartelera } from '@/lib/afiche';
import { actividadDePrueba, type OpcionesDeEntrada } from './fixtures/indice';
import { VALORES_CENTINELA } from './fixtures/formulario';
import type { Actividad, Imagen } from '@/types/actividad';

/**
 * La pared de afiches de `/cartelera` — B-265, D-148.
 *
 * Lo que se fija acá es **qué entra a la pared y en qué orden**, que es la única
 * lógica de la página: el resto es markup. Y una mitad de privacidad que no es
 * redundante con el barrido general — la cartelera es una salida pública nueva,
 * y la regla que más fácil se rompe en una página de imágenes es la del §13
 * trampa 13: armarla listando el bucket.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));


/** El `.astro` sin comentarios: los docblocks explican justo lo que se prohíbe. */
const sinComentariosAstro = (s: string): string =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const AHORA = new Date('2026-09-10T15:00:00Z');

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [
    { slug: 'taller', label: 'Taller' },
    { slug: 'club-lectura', label: 'Club de lectura' },
  ],
  barrio: [{ slug: 'villa-crespo', label: 'Villa Crespo' }],
  arancel: [{ slug: 'gratis', label: 'Gratis' }],
});

const imagen = (over: Partial<Imagen> = {}): Imagen => ({
  id: 'img_1',
  url: 'https://ejemplo.com/flyer.jpg',
  epigrafe: '',
  origen: 'externa',
  portada: true,
  ...over,
});

const detalleDe = (o: OpcionesDeEntrada = {}, over: Partial<Actividad> = {}) =>
  detalleDeActividad(
    toPublic({ ...actividadDePrueba(o), ...over }, o.id ?? 'act_1'),
    ETIQUETAS,
    AHORA,
    // Sin matices elegidos: la pared no pinta la categoría (D-153), así que acá
    // el color sale derivado y no cambia nada de lo que este archivo mira.
    {},
  );

/** Una actividad con flyer y con fecha próxima: el caso que sí entra. */
const conFlyer = (o: OpcionesDeEntrada = {}, imagenes: Imagen[] = [imagen()]) =>
  detalleDe({ fechas: ['2026-09-24T22:00:00Z'], ...o }, { imagenes });

describe('qué entra a la pared', () => {
  it('una actividad con flyer y fecha próxima', () => {
    const pared = carteleraDeDetalles([conFlyer({ titulo: 'Taller de crónica' })]);
    expect(pared).toHaveLength(1);
    expect(pared[0]!.titulo).toBe('Taller de crónica');
    expect(pared[0]!.url).toBe('https://ejemplo.com/flyer.jpg');
  });

  it('sin imagen no hay afiche', () => {
    /*
     * Es la mitad que hace verdadera la promesa del panel («sin imagen no entra
     * en la cartelera», B-264). Si esto dejara pasar las actividades sin imagen,
     * la pared tendría huecos y el aviso del formulario estaría mintiendo.
     */
    expect(carteleraDeDetalles([detalleDe({ imagenUrl: null })])).toEqual([]);
  });

  it('una fila con la dirección en blanco tampoco', () => {
    /*
     * `detalleDeActividad` ya descarta las imágenes con URL inválida, así que en
     * el camino normal esto no llega nunca. El guard está igual, y se prueba
     * contra un view-model armado a mano: es la **segunda** red, y la que decide
     * qué pasa el día que la primera cambie de criterio.
     *
     * MUTACIÓN PROBADA: `if (!portada)` en vez de `if (!portada?.url)`. La pared
     * emite un `<img src="">`, que el navegador resuelve contra la página actual
     * — un pedido de más, un rectángulo roto, y un enlace a una actividad que sí
     * existe. Con el fixture normal la mutación **sobrevive**, porque el filtro
     * de arriba la tapa; por eso este caso entra por la puerta de la función.
     */
    const conFilaVacia = {
      ...conFlyer(),
      imagenes: [{ url: '', epigrafe: '', ancho: null, alto: null }],
    };
    expect(carteleraDeDetalles([conFilaVacia])).toEqual([]);
  });

  it('lo que ya pasó no entra', () => {
    /*
     * Una pared de afiches de cosas que ya ocurrieron es un museo, y el clic
     * lleva a una página que arranca con «esta actividad ya pasó». Se decide acá
     * y no en la plantilla justamente para poder afirmarlo.
     */
    const pasada = conFlyer({ fechas: ['2026-08-01T22:00:00Z'] });
    expect(pasada.proxima).toBeNull();
    expect(carteleraDeDetalles([pasada])).toEqual([]);
  });

  it('un ciclo entero cancelado no entra, aunque tenga flyer', () => {
    // Los cancelados no cuentan como próxima fecha en el detalle, y la pared
    // hereda esa definición en vez de tener la suya.
    const cancelada = conFlyer({ fechas: ['2026-09-24T22:00:00Z'], canceladas: [0] });
    expect(carteleraDeDetalles([cancelada])).toEqual([]);
  });

  it('una sola por actividad, y es la portada', () => {
    /*
     * Una actividad puede tener cuatro imágenes, y las otras tres suelen ser
     * fotos del espacio. Con las cuatro, la pared deja de ser una pared de
     * flyers y pasa a ser un álbum.
     */
    const pared = carteleraDeDetalles([
      conFlyer({}, [
        imagen({ id: 'img_1', url: 'https://ejemplo.com/portada.jpg', portada: true }),
        imagen({ id: 'img_2', url: 'https://ejemplo.com/patio.jpg', portada: false }),
      ]),
    ]);
    expect(pared).toHaveLength(1);
    expect(pared[0]!.url).toBe('https://ejemplo.com/portada.jpg');
  });

  it('la portada elegida a mano, y no la primera cargada — B-268', () => {
    /*
     * **El caso al revés, y es el que fallaba.** Lo encontró el
     * `auditor-trampas`: `detalleDeActividad` tiraba el flag `portada` y dejaba
     * el array en el orden de carga, así que quien subía una foto del lugar,
     * después el flyer, y marcaba el flyer con el radio del panel —que existe
     * exactamente para eso— seguía viendo la foto.
     *
     * No fallaba nada y encima fallaba **coherente**: la cabecera de la actividad
     * y la pared mostraban la misma imagen equivocada, así que compararlas no lo
     * delataba. La versión anterior de este archivo tenía solo el caso de arriba
     * —con la portada ya en el índice 0— y por eso pasaba.
     *
     * MUTACIÓN PROBADA: volver a `a.imagenes.map(...)` sin reordenar en
     * `detallePublico.ts`. El `it` de arriba sigue verde y éste se pone rojo.
     */
    const detalle = conFlyer({}, [
      imagen({ id: 'img_1', url: 'https://ejemplo.com/patio.jpg', portada: false }),
      imagen({ id: 'img_2', url: 'https://ejemplo.com/el-flyer.jpg', portada: true }),
    ]);
    expect(detalle.imagenes[0]!.url, 'la cabecera de la actividad muestra la primera').toBe(
      'https://ejemplo.com/el-flyer.jpg',
    );
    expect(carteleraDeDetalles([detalle])[0]!.url).toBe('https://ejemplo.com/el-flyer.jpg');
    // Y las demás no se pierden: la galería del detalle las sigue mostrando.
    expect(detalle.imagenes.map((i) => i.url)).toEqual([
      'https://ejemplo.com/el-flyer.jpg',
      'https://ejemplo.com/patio.jpg',
    ]);
  });

  it('si la portada marcada tiene una URL que no sirve, gana la siguiente válida', () => {
    /*
     * `urlSegura` descarta `javascript:` y compañía. Buscar el flag **antes** de
     * filtrar dejaría la página sin imagen habiendo otras válidas; buscarlo
     * después es lo mismo que hace `portadaDe` con una lista sin ninguna marcada.
     */
    const detalle = conFlyer({}, [
      imagen({ id: 'img_1', url: 'https://ejemplo.com/patio.jpg', portada: false }),
      imagen({ id: 'img_2', url: 'javascript:alert(1)', portada: true }),
    ]);
    expect(carteleraDeDetalles([detalle])[0]!.url).toBe('https://ejemplo.com/patio.jpg');
  });

  it('la que muestra es la misma que la cabecera de la actividad', () => {
    // No es una coincidencia: las dos salen de `DetallePublico.imagenes[0]`. Si
    // se separaran, la pared mostraría una foto y al entrar aparecería otra.
    const detalle = conFlyer({}, [imagen({ url: 'https://ejemplo.com/la-misma.jpg' })]);
    expect(carteleraDeDetalles([detalle])[0]!.url).toBe(detalle.imagenes[0]!.url);
  });
});

describe('el orden de la pared', () => {
  it('la fecha más próxima primero', () => {
    const pared = carteleraDeDetalles([
      conFlyer({ id: 'c', slug: 'c', titulo: 'Diciembre', fechas: ['2026-12-01T22:00:00Z'] }),
      conFlyer({ id: 'a', slug: 'a', titulo: 'Septiembre', fechas: ['2026-09-24T22:00:00Z'] }),
      conFlyer({ id: 'b', slug: 'b', titulo: 'Octubre', fechas: ['2026-10-15T22:00:00Z'] }),
    ]);
    expect(pared.map((a) => a.titulo)).toEqual(['Septiembre', 'Octubre', 'Diciembre']);
  });

  it('el empate se rompe por título, y no por el orden de lectura', () => {
    /*
     * Firestore no garantiza el orden de un `get()` de colección, así que sin
     * desempate dos actividades del mismo día pueden salir en distinto orden en
     * cada build: la página cambia sin que haya cambiado nada, y el diff del
     * sitio construido deja de decir algo.
     *
     * MUTACIÓN PROBADA: sacar el `|| a.titulo.localeCompare(...)`. `Array.sort`
     * es estable, así que el test pasa igual con el fixture en un orden y falla
     * al darlo vuelta — por eso se prueban los dos.
     */
    const mismaFecha = ['2026-09-24T22:00:00Z'];
    const zeta = conFlyer({ id: 'z', slug: 'z', titulo: 'Zeta', fechas: mismaFecha });
    const alfa = conFlyer({ id: 'a', slug: 'a', titulo: 'Alfa', fechas: mismaFecha });
    expect(carteleraDeDetalles([zeta, alfa]).map((a) => a.titulo)).toEqual(['Alfa', 'Zeta']);
    expect(carteleraDeDetalles([alfa, zeta]).map((a) => a.titulo)).toEqual(['Alfa', 'Zeta']);
  });
});

describe('lo que cada afiche lleva, y lo que no', () => {
  it('la ficha mínima para decidir: qué, cuándo y dónde', () => {
    const afiche = carteleraDeDetalles([
      conFlyer({ titulo: 'Taller de crónica', tipo: 'taller', barrio: 'villa-crespo' }),
    ])[0]!;
    expect(afiche.tipoEtiqueta).toBe('Taller');
    expect(afiche.cuando).toBeTruthy();
    expect(afiche.donde).toBeTruthy();
    expect(afiche.ruta).toBe(`/actividad/${afiche.slug}`);
  });

  it('la ruta sale de `rutasPublicas`, no se arma acá', () => {
    // B-227 — un productor y un consumidor derivando el mismo formato por
    // separado es la clase de B-88. El día que las páginas se muevan, la pared
    // tiene que seguirlas sola.
    const fuente = readFileSync(raiz('src/lib/cartelera.ts'), 'utf8');
    expect(fuente).toContain("from '@/lib/rutasPublicas'");
    expect(fuente.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/['`]\/actividad\//);
  });

  it('la medida viaja cuando se conoce, y no se inventa cuando no', () => {
    const conMedida = carteleraDeDetalles([
      conFlyer({}, [imagen({ ancho: 720, alto: 826 })]),
    ])[0]!;
    expect([conMedida.ancho, conMedida.alto]).toEqual([720, 826]);

    const sinMedida = carteleraDeDetalles([conFlyer()])[0]!;
    expect([sinMedida.ancho, sinMedida.alto]).toEqual([null, null]);
  });

  it('no lleva `storagePath` ni ningún campo interno', () => {
    /*
     * La pared se arma desde `DetallePublico`, que ya es la proyección auditada
     * (D-140), así que esta proyección solo puede **sacar** campos. El aserto
     * está igual porque una salida pública nueva es exactamente el momento en
     * que eso deja de ser cierto: alcanza con que alguien agregue un campo «solo
     * para ordenar» que salga del documento y no del view-model.
     */
    const afiche = carteleraDeDetalles([
      conFlyer({}, [imagen({ origen: 'propia', storagePath: 'imagenes/img_1.jpg' })]),
    ])[0]!;
    const serializado = JSON.stringify(afiche);
    expect(serializado).not.toContain('storagePath');
    expect(serializado).not.toContain('imagenes/img_1.jpg');
    for (const centinela of VALORES_CENTINELA) expect(serializado).not.toContain(centinela);
  });
});

describe('la página, y las dos cosas que no se pueden romper', () => {
  const pagina = (): string => readFileSync(raiz('src/pages/cartelera.astro'), 'utf8');

  it('no lista el bucket de Storage — trampa 13', () => {
    /*
     * La pared se arma desde el índice de lo publicado. Un `listAll()` sobre
     * `imagenes/` sería más corto de escribir y traería también los flyers de
     * las actividades **en borrador**, además de estar prohibido por
     * `storage.rules` (`allow list: if esAdmin()`). Falla acá antes que en
     * producción.
     */
    const codigo = pagina();
    expect(codigo).not.toMatch(/listAll|firebase\/storage|getStorage/);
    expect(codigo, 'los afiches salen del lector del build').toContain('carteleraDelSitio');
  });

  it('no lleva JavaScript al cliente', () => {
    // Es la regla de la página de detalle y vale igual acá: no hay island, no
    // hay directiva de cliente, y una pared de afiches no necesita ninguna.
    expect(pagina()).not.toMatch(/client:(load|visible|idle|only|media)/);
  });

  it('nada avanza solo: es una pared, no un carrusel', () => {
    /*
     * «En continuado» quiere decir que no termina, no que se mueva. Un carrusel
     * además esconde: con 30 flyers, 27 quedarían fuera de pantalla esperando
     * que alguien toque una flecha.
     *
     * Y si algo se moviera, tendría que respetar `prefers-reduced-motion`. La
     * forma de no deberle esa deuda a nadie es no tener animación.
     */
    const codigo = pagina();
    expect(codigo).not.toMatch(/animate-|@keyframes|setInterval|scrollBy|snap-/);
  });

  it('todos los afiches menos el primero se piden en diferido', () => {
    /*
     * Es la palanca de peso que se puede tener sin la Function de B-220: con 30
     * flyers de 90 KB, `lazy` hace que la primera pantalla pida tres y no 2,7 MB.
     * El primero va `eager` porque es el LCP de la página.
     *
     * MUTACIÓN PROBADA: cambiar el ternario por `loading="eager"` fijo. La página
     * se ve igual y baja la pared entera al entrar.
     */
    const codigo = pagina();
    expect(codigo).toMatch(/loading=\{n === 0 \? 'eager' : 'lazy'\}/);
    expect(codigo, 'sin la medida reservada, el lazy hace saltar la página').toContain(
      'estiloDeAfiche(afiche)',
    );
    expect(codigo).toContain('decoding="async"');
  });

  it('el caso de cero no dibuja una grilla vacía', () => {
    // Con dos flyers la pared se va a ver pobre y está bien; con cero no se
    // finge que hay algo. Se dice qué es la página y se manda a la agenda.
    expect(pagina()).toContain('cuantos === 0');
  });
});

describe('las clases de la pared existen para los tres tamaños', () => {
  it('hay una clase por cada cantidad de columnas posible', () => {
    /*
     * `columnasDeCartelera` devuelve 1, 2 o 3 y el mapa se indexa con eso. Un
     * valor sin entrada daría `undefined` y el `class:list` quedaría sin
     * columnas — la pared se vería como una sola columna a ancho completo, sin
     * error.
     */
    for (const n of [0, 1, 2, 3, 5, 6, 42]) {
      expect(CLASES_DE_PARED[columnasDeCartelera(n)]).toBeTypeOf('string');
    }
  });

  it('las clases están escritas literales, que es lo que Tailwind puede ver', () => {
    /*
     * Tailwind genera las utilidades **leyendo el fuente**. Un `columns-${n}`
     * armado en tiempo de ejecución no produce ninguna regla y la pared queda en
     * una columna, con el build en verde y sin una sola advertencia.
     */
    const estilos = readFileSync(raiz('src/components/sitio/estilos.ts'), 'utf8');
    expect(estilos).toContain('sm:columns-2');
    expect(estilos).toContain('lg:columns-3');
    // Sin comentarios: el docblock de `CLASES_DE_PARED` explica justamente por
    // qué no se arma en runtime, y un barrido sobre el texto crudo fallaría
    // contra su propia documentación.
    const codigo = estilos.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codigo, 'una clase armada en runtime no existe en la hoja').not.toMatch(
      /columns-\$\{/,
    );
  });

  it('con pocos afiches la pared se angosta en vez de repartirlos', () => {
    // Dos flyers en tres columnas es una plantilla a medio llenar. Con una sola
    // columna y un tope de ancho son dos afiches grandes, uno abajo del otro.
    expect(CLASES_DE_PARED[columnasDeCartelera(2)]).toContain('max-w');
    expect(CLASES_DE_PARED[columnasDeCartelera(2)]).not.toContain('columns-');
  });
});

describe('la plantilla de la cartelera no ve el documento — D-140, salida 7', () => {
  /*
   * **Lo pidió el `auditor-privacidad` sobre B-265, y el hueco era de forma.**
   * La página de detalle tiene estas tres guardas desde B-227
   * (`tests/pagina-de-detalle.test.ts`); la cartelera nació sin ellas, con la
   * doc prometiendo «la plantilla solo acomoda» y nada sosteniéndolo.
   *
   * El camino que quedaba abierto no es hipotético y es **más corto que
   * cualquier nombre prohibido**: `cartelera.astro` ya importa de
   * `@/lib/contenidoDelSitio`, que también exporta `contenidoDelSitio()` →
   * `ActividadPublica[]`, o sea `online.url` con `urlPublica: true`,
   * `sede.indicaciones` y la URL del material privado. Agregar una palabra a esa
   * llave de import y un `{a.online.url}` al pie del afiche compila, se ve bien
   * y lo publica en HTML indexado.
   */
  const cabecera = readFileSync(raiz('src/pages/cartelera.astro'), 'utf8');
  const codigo = sinComentariosAstro(cabecera);

  it('del lector importa SOLO `carteleraDelSitio`', () => {
    /*
     * Lista blanca y no lista negra: lo que no está acá no entra, y agregar algo
     * obliga a venir a este archivo a justificarlo.
     *
     * MUTACIÓN PROBADA: agregar `contenidoDelSitio` a la llave del import —sin
     * usarlo siquiera— pone esto en rojo. Con la lista negra de abajo sola,
     * pasaba.
     */
    const imp = /import \{([^}]*)\} from '@\/lib\/contenidoDelSitio'/.exec(cabecera);
    expect(imp, 'la plantilla tiene que importar del lector con llaves').not.toBeNull();
    expect(
      imp![1]!
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ).toEqual(['carteleraDelSitio']);
  });

  it('no ve el documento ni la proyección completa', () => {
    for (const prohibido of ['firebase-admin', 'adminDb', 'toPublic', 'ActividadPublica']) {
      expect(codigo, `la plantilla no puede nombrar ${prohibido}`).not.toContain(prohibido);
    }
  });

  it('no nombra ninguno de los campos que el §5.1 mantiene privados', () => {
    /*
     * Barrido por **nombre de campo**, que es lo que el de centinelas no puede
     * ver: aquél corre sobre el valor de `carteleraDeDetalles`, y una plantilla
     * que interpolara un dato que hoy no existe en el view-model no aparecería
     * ahí hasta que el campo existiera. Acá se prohíbe el nombre.
     */
    for (const prohibido of [
      'difusion',
      'createdBy',
      'updatedBy',
      'storagePath',
      'calendarEventId',
      'searchText',
      'urlPublica',
    ]) {
      expect(codigo, `la plantilla no puede nombrar ${prohibido}`).not.toContain(prohibido);
    }
  });
});
