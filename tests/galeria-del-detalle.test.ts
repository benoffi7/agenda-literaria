import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { detalleDeActividad } from '@/lib/detallePublico';
import { mapaDeEtiquetas } from '@/lib/listadoPublico';
import { toPublic } from '@/lib/toPublic';
import { columnasDeGaleria, rotuloDeGaleria } from '@/lib/afiche';
import { CLASES_DE_GALERIA } from '@/components/sitio/estilos';
import { actividadDePrueba, type OpcionesDeEntrada } from './fixtures/indice';
import type { Actividad, Imagen } from '@/types/actividad';

/**
 * La tira de imágenes secundarias de la página de detalle — B-296, D-168.
 *
 * ── Qué se fija acá, y por qué en dos mitades ─────────────────────────────
 * La página hacía `detalle.imagenes[0]` y pintaba **una sola** imagen, así que
 * las actividades con dos o tres cargadas tenían imágenes que no aparecían en
 * ninguna salida del sitio. Lo que este archivo ata es lo que se puede romper sin
 * que nada falle, y son dos cosas de naturaleza distinta:
 *
 * | Mitad | Qué se afirma | Cómo |
 * |---|---|---|
 * | **cuál es la portada y cuáles las demás** | `imagenes[0]` es la marcada, y la tira es «todas menos esa» | sobre el view-model, con las funciones de verdad |
 * | **qué atributos lleva cada `<img>`** | el alt, el `loading`, la caja reservada | leyendo el `.astro`, que vitest no puede renderizar |
 *
 * La segunda mitad es un test de markup y no pereza: el modo de falla de una
 * galería es **silencioso en la pantalla**. Un `loading="eager"` en una
 * secundaria se ve idéntico y cuadruplica lo que se baja; un `alt` heredado del
 * título se ve idéntico y le lee tres veces lo mismo a quien escucha la página.
 * Ninguna de las dos se encuentra mirando una captura.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const DETALLE = 'src/pages/actividad/[slug].astro';
const src = (): string => readFileSync(raiz(DETALLE), 'utf8');

/** El archivo sin comentarios: los docblocks explican justo lo que se prohíbe. */
const sinComentarios = (s: string): string =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

/** Los `<img>` de la plantilla, en el orden en que están escritos. */
const imagenesDelMarkup = (): string[] => sinComentarios(src()).match(/<img[\s\S]*?\/>/g) ?? [];

/** El bloque de la tira: de su `<section>` a su `</section>`. */
const bloqueDeLaTira = (): string => {
  const m = /<section aria-labelledby="mas-imagenes"[\s\S]*?<\/section>/.exec(sinComentarios(src()));
  expect(m, 'no se encontró la sección de las imágenes secundarias en el detalle').not.toBeNull();
  return m![0]!;
};

const AHORA = new Date('2026-09-10T15:00:00Z');

const ETIQUETAS = mapaDeEtiquetas({
  tipo: [{ slug: 'taller', label: 'Taller' }],
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

const detalleDe = (imagenes: Imagen[], o: OpcionesDeEntrada = {}) =>
  detalleDeActividad(
    toPublic({ ...actividadDePrueba(o), imagenes } as Actividad, o.id ?? 'act_1'),
    ETIQUETAS,
    AHORA,
    {},
  );

/**
 * La derivación de la plantilla, escrita una vez acá.
 *
 * `[slug].astro` hace `detalle.imagenes[0]` para la cabecera y
 * `detalle.imagenes.slice(1)` para la tira. Un `.astro` no se importa desde
 * vitest, así que la única forma de afirmar sobre la derivación es reproducirla
 * — y el aserto de más abajo («la plantilla deriva con `slice`, no con un
 * filtro») es el que hace que esta reproducción siga siendo la de verdad.
 */
const comoLaPagina = (imagenes: Imagen[]) => {
  const { imagenes: proyectadas } = detalleDe(imagenes);
  return { portada: proyectadas[0] ?? null, secundarias: proyectadas.slice(1) };
};

describe('cuál es la portada y cuáles las demás — B-268 con una consecuencia nueva', () => {
  it('con una sola imagen no hay tira: es el 87 % de los casos con imagen', () => {
    /*
     * Medido contra producción el 2026-09-02: de 46 publicadas, 30 tienen imagen
     * y **26 de esas 30 tienen exactamente una**. O sea que el caso mayoritario
     * de la galería es no tener galería, y esa página tiene que quedar igual a
     * como estaba — no «parecida»: igual.
     *
     * MUTACIÓN PROBADA: cambiar `slice(1)` por `slice(0)` en la plantilla. La
     * página con una sola imagen pinta la portada **dos veces**, arriba grande y
     * abajo en la tira, con un `<h2>` que dice «Una imagen más» sobre la misma
     * imagen. Nada falla: se ve como una decisión de diseño.
     */
    const { portada, secundarias } = comoLaPagina([imagen()]);
    expect(portada?.url).toBe('https://ejemplo.com/flyer.jpg');
    expect(secundarias).toEqual([]);
  });

  it('la portada es la marcada, y la tira son las otras — no al revés', () => {
    /*
     * B-268 arregló que `detalleDeActividad` respetara el flag `portada` en vez
     * del orden de carga. Con la tira, ese bug gana una segunda cara **peor**: no
     * solo la cabecera muestra la foto del patio en vez del flyer, sino que el
     * flyer baja a la tira, chico y con `alt=""` — o sea que el afiche de la
     * actividad pasa a ser una imagen decorativa de 105px.
     *
     * MUTACIÓN PROBADA: sacar el reordenamiento de `imagenesDeDetalle`
     * (`lib/detallePublico.ts`) y devolver `saneadas` tal cual. Las dos
     * afirmaciones de abajo se invierten a la vez y el build sigue en verde.
     */
    const { portada, secundarias } = comoLaPagina([
      imagen({ id: 'img_1', url: 'https://ejemplo.com/patio.jpg', portada: false }),
      imagen({ id: 'img_2', url: 'https://ejemplo.com/el-flyer.jpg', portada: true }),
    ]);

    expect(portada?.url, 'arriba va el flyer, que es el marcado como portada').toBe(
      'https://ejemplo.com/el-flyer.jpg',
    );
    expect(
      secundarias.map((i) => i.url),
      'y a la tira va la otra, no el flyer',
    ).toEqual(['https://ejemplo.com/patio.jpg']);
  });

  it('las secundarias conservan el orden en que se cargaron', () => {
    // `conPortada` en el panel togglea el booleano y **no mueve la fila** (D-125,
    // B-268): el orden del array es el de carga y es el que la tira respeta.
    const { secundarias } = comoLaPagina([
      imagen({ id: 'img_1', url: 'https://ejemplo.com/1.jpg', portada: false }),
      imagen({ id: 'img_2', url: 'https://ejemplo.com/2.jpg', portada: true }),
      imagen({ id: 'img_3', url: 'https://ejemplo.com/3.jpg', portada: false }),
    ]);
    expect(secundarias.map((i) => i.url)).toEqual([
      'https://ejemplo.com/1.jpg',
      'https://ejemplo.com/3.jpg',
    ]);
  });

  it('una URL que no sirve no deja un hueco en la tira', () => {
    /*
     * `imagenesDeDetalle` filtra las que `urlSegura` rechaza **antes** de buscar
     * la portada. Con la tira eso importa el doble: una fila con la URL en blanco
     * —que existe en el array y no pinta nada— habría dejado una celda vacía con
     * su borde, o sea un rectángulo gris en medio de la fila.
     */
    const { portada, secundarias } = comoLaPagina([
      imagen({ id: 'img_1', url: 'https://ejemplo.com/flyer.jpg', portada: true }),
      imagen({ id: 'img_2', url: '', portada: false }),
      imagen({ id: 'img_3', url: 'javascript:alert(1)', portada: false }),
      imagen({ id: 'img_4', url: 'https://ejemplo.com/patio.jpg', portada: false }),
    ]);
    expect(portada?.url).toBe('https://ejemplo.com/flyer.jpg');
    expect(secundarias.map((i) => i.url)).toEqual(['https://ejemplo.com/patio.jpg']);
  });
});

describe('la plantilla deriva la tira del view-model y no la reinventa', () => {
  it('control positivo: la sección existe y la plantilla la condiciona', () => {
    const codigo = sinComentarios(src());
    expect(codigo).toContain('const secundarias = detalle.imagenes.slice(1)');
    expect(codigo, 'la tira solo se pinta si hay algo que pintar').toContain(
      'secundarias.length > 0',
    );
  });

  it('la portada y la tira salen del mismo array, y la tira con `slice`', () => {
    /*
     * Es lo que hace legítimo el `comoLaPagina` de arriba. Si la plantilla
     * empezara a filtrar por su cuenta —un `filter((i) => !i.portada)`, que sería
     * lo intuitivo— estaría reimplementando «cuál es la portada» en un archivo que
     * ya no tiene el flag (el view-model lo saca al proyectar), y el resultado
     * sería una tira con **todas** las imágenes incluida la de arriba.
     *
     * MUTACIÓN PROBADA: `detalle.imagenes.filter(...)` en vez de `slice(1)`. No
     * typechequea contra el view-model —no hay `portada` en el tipo—, y si alguien
     * lo fuerza con un `as`, esto lo dice.
     */
    const codigo = sinComentarios(src());
    expect(codigo).toContain('detalle.imagenes[0]');
    expect(codigo).toContain('detalle.imagenes.slice(1)');
    expect(codigo, 'la plantilla no decide cuál es la portada: ya viene decidido').not.toMatch(
      /imagenes\.(?:filter|find)\(/,
    );
  });
});

describe('el texto alternativo: la salida de B-296 (D-168)', () => {
  it('la portada conserva el alt del título — DEC-7a sigue en pie donde funciona', () => {
    /*
     * DEC-7a derivó el texto alternativo del título de la actividad, y con **una**
     * imagen eso es exactamente lo correcto: «Imagen de Usted está aquí» describe
     * el afiche mejor que cualquier «foto» que alguien escriba a las apuradas. La
     * tira no reabre esa decisión: la deja donde funciona.
     */
    const portada = imagenesDelMarkup()[0] ?? '';
    expect(portada, 'la primera imagen del markup es la portada').toContain('src={portada.url}');
    expect(portada).toContain('alt={`Imagen de ${detalle.titulo}`}');
  });

  it('ninguna secundaria hereda ese alt: `alt=""` y punto', () => {
    /*
     * **La decisión de B-296, y la que se rompe sin que se note.** Con tres
     * imágenes, el mismo alt tres veces es peor que no tenerlo: un lector de
     * pantalla anuncia «Imagen de Usted está aquí» tres veces seguidas y no
     * distingue ninguna de las tres. En la pantalla no se ve absolutamente nada.
     *
     * MUTACIÓN PROBADA: copiarle a la secundaria el `alt={`Imagen de
     * ${detalle.titulo}`}` de la portada. La página se ve idéntica, el HTML es
     * válido, ningún otro test se mueve — y es el bug que este ítem existe para
     * no cometer.
     */
    const tira = bloqueDeLaTira();
    expect(tira, 'la secundaria va con el alt vacío, que es lo que declara «decorativa»').toContain(
      'alt=""',
    );
    expect(
      tira,
      'una secundaria no puede llevar el título de la actividad como texto alternativo: ' +
        'repetido N veces es peor que no tenerlo (D-168)',
    ).not.toContain('detalle.titulo');
  });

  it('lo que se calla en el alt lo dice el encabezado, una vez y en prosa', () => {
    /*
     * La otra mitad de la decisión, y sin ella `alt=""` sí sería una renuncia:
     * quien escucha la página no se enteraría de que hay más imágenes. El `<h2>`
     * lo dice una sola vez —«Dos imágenes más»— y encima lo dice para todo el
     * mundo, no solo para un lector de pantalla.
     *
     * MUTACIÓN PROBADA: reemplazar `rotuloDeGaleria(...)` por un literal
     * «Imágenes». La sección queda con un encabezado que no informa nada y el
     * grupo entero vuelve a ser un callejón sin salida para quien no ve las
     * imágenes.
     */
    const tira = bloqueDeLaTira();
    expect(tira).toContain('rotuloDeGaleria(secundarias.length)');
    expect(tira, 'el encabezado nombra la sección para un lector de pantalla').toContain(
      'aria-labelledby="mas-imagenes"',
    );
    expect(tira).toContain('id="mas-imagenes"');
  });

  it('el epígrafe es `figcaption` de SU imagen, y no se promueve a alt', () => {
    /*
     * Dos cosas en una. La primera: cada secundaria es su propia `<figure>`, así
     * que el epígrafe queda atado a la imagen que describe y no suelto debajo de
     * la fila. La segunda: el epígrafe **no** se copia al `alt`. Con el mismo
     * texto en los dos lugares, un lector de pantalla lo anuncia dos veces —una
     * como imagen y otra como pie—, que es la misma repetición que este ítem vino
     * a sacar, en chico.
     *
     * Y hay un dato que lo cierra: de las cuatro secundarias que hay en
     * producción, **ninguna tiene epígrafe** (medido el 2026-09-02). «El epígrafe
     * es el alt» no habría descrito ni una sola imagen; el `figcaption` sí las
     * describe el día que alguien escriba uno.
     *
     * MUTACIÓN PROBADA: `alt={imagen.epigrafe}` en la secundaria. Con los datos
     * de hoy queda `alt=""` igual —el epígrafe está vacío— así que la mutación es
     * **invisible en el HTML construido** y solo la ve un aserto sobre el fuente.
     */
    const tira = bloqueDeLaTira();
    expect(tira).toContain('<figure>');
    expect(tira).toContain('<figcaption');
    expect(tira, 'el epígrafe que se muestra es el de esa imagen').toContain('imagen.epigrafe');
    expect(tira, 'el epígrafe no viaja al alt').not.toMatch(/alt=\{/);
    // Y no es el epígrafe de la portada repetido en cada celda.
    expect(tira).not.toContain('portada.epigrafe');
  });
});

describe('el peso: la tira no puede pagarse en la primera pantalla', () => {
  it('una sola `eager`, y es la portada', () => {
    /*
     * **La regla dura de este ítem.** Cada imagen propia se sirve tal cual la
     * subió quien organiza porque la Function de recompresión no existe (B-220,
     * DEC-7d): medido contra producción el 2026-09-02, la mediana es 92,6 KB y la
     * más pesada **1,07 MB**. La actividad con tres imágenes suma **3,15 MB**, y
     * su secundaria más grande sola pesa 1,77 MB.
     *
     * Con la tira al final del contenido y en `lazy`, eso se baja solo si alguien
     * scrollea hasta ahí. Con un `eager` de más, se baja siempre — en la página
     * que recibe el tráfico de Google y de Instagram.
     *
     * MUTACIÓN PROBADA: `loading="eager"` en la secundaria. La página se ve
     * exactamente igual y pasa de 1,07 MB a 3,15 MB en la primera carga. Es
     * invisible en cualquier captura y en cualquier otro test.
     */
    const imgs = imagenesDelMarkup();
    expect(imgs.length, 'la plantilla pinta dos imágenes: la portada y la de la tira').toBe(2);

    const eager = imgs.filter((i) => i.includes('loading="eager"'));
    expect(eager, 'solo la portada se pide temprano').toHaveLength(1);
    expect(eager[0]).toContain('src={portada.url}');

    const secundaria = imgs[1]!;
    expect(secundaria, 'la secundaria se pide cuando se acerca a la pantalla').toContain(
      'loading="lazy"',
    );
    expect(secundaria).not.toContain('loading="eager"');
    expect(
      secundaria,
      '`fetchpriority="high"` es de la portada: en una secundaria compite con ella',
    ).not.toContain('fetchpriority');
  });

  it('la tira va al final del contenido, que es lo que hace que `lazy` sirva', () => {
    /*
     * `loading="lazy"` no es una promesa: es una pista que el navegador atiende
     * **según la distancia al viewport**. Una tira pegada debajo de la portada
     * entra en la primera pantalla de un escritorio y se baja igual, así que la
     * posición es parte de la optimización y no una preferencia de diseño.
     *
     * MUTACIÓN PROBADA: mover la sección justo debajo de la `<figure>` de la
     * portada. Todo sigue verde —el atributo sigue ahí— y las imágenes se piden
     * en la carga inicial de todas formas.
     */
    const codigo = sinComentarios(src());
    const posicion = (aguja: string): number => {
      const n = codigo.indexOf(aguja);
      expect(n, `no se encontró ${aguja}`).toBeGreaterThan(-1);
      return n;
    };
    expect(
      posicion('aria-labelledby="mas-imagenes"'),
      'la tira va después de la descripción, los encuentros y el material',
    ).toBeGreaterThan(posicion('id="material"'));
    expect(
      posicion('aria-labelledby="mas-imagenes"'),
      'y antes del colofón de «Organiza», que cierra la columna',
    ).toBeLessThan(posicion('id="organiza"'));
  });

  it('cada secundaria reserva su caja: `width`, `height` y su propia proporción', () => {
    /*
     * Sin esto, las imágenes diferidas hacen saltar la página cuando llegan —y
     * saltan **mientras se scrollea**, que es el peor momento posible. Las tres
     * piezas son la misma que la portada usa, con la proporción de **esta** imagen
     * y no una escrita a mano (D-147).
     *
     * MUTACIÓN PROBADA: sacar `style={estiloDeAfiche(imagen)}`. La caja no se
     * reserva y la fila entera se reacomoda al cargar cada foto.
     */
    const secundaria = imagenesDelMarkup()[1]!;
    expect(secundaria).toContain('width={imagen.ancho ?? undefined}');
    expect(secundaria).toContain('height={imagen.alto ?? undefined}');
    expect(secundaria).toContain('style={estiloDeAfiche(imagen)}');
    expect(secundaria).toContain('decoding="async"');
  });

  it('y no le cuenta a nadie qué página se está mirando', () => {
    /*
     * `referrerpolicy="no-referrer"`, igual que la portada. Una imagen externa la
     * sirve un tercero, y sin esto ese tercero recibe la URL de la página de
     * detalle en el `Referer` de cada visita — o sea que le contamos a un host
     * cualquiera qué taller está mirando quién.
     *
     * MUTACIÓN PROBADA: borrar el atributo de la secundaria. La imagen se ve
     * igual y la fuga es invisible desde este lado.
     */
    for (const img of imagenesDelMarkup()) expect(img).toContain('referrerpolicy="no-referrer"');
  });
});

describe('la forma de la tira', () => {
  it('ninguna imagen se recorta: la clase compartida, sin el tope de la portada', () => {
    /*
     * `claseAfiche` trae `object-contain` (D-147) y **no** trae el `max-h-[70svh]`
     * de `claseAfichePortada`, a propósito: en una celda que mide la mitad o un
     * tercio de la columna, el ancho ya limita el alto. Poner el tope además
     * dejaría una foto vertical encogida entre dos bandas de papel, que es
     * exactamente el aspecto que B-263 vino a sacar.
     *
     * El barrido de `tests/afiche.test.ts` ya prohíbe `object-cover` y las
     * proporciones a mano en todas las páginas del sitio; esto fija cuál de las
     * dos variantes usa cada una.
     */
    const [portada, secundaria] = imagenesDelMarkup();
    expect(portada).toContain('class={claseAfichePortada}');
    expect(secundaria).toContain('class={claseAfiche}');
    expect(secundaria, 'la variante con tope es la de arriba').not.toContain(
      'claseAfichePortada',
    );
  });

  it('el número de columnas sale de la regla, no de un literal en la plantilla', () => {
    // Mismo motivo que `CLASES_DE_PARED` (D-148): Tailwind genera las utilidades
    // leyendo el fuente, así que las clases tienen que estar escritas literales
    // en el centralizador. Y la regla vive en `lib/`, donde se puede testear.
    const tira = bloqueDeLaTira();
    expect(tira).toContain('CLASES_DE_GALERIA[columnasDeGaleria(secundarias.length)]');
    expect(tira, 'la plantilla no escribe una grilla a mano').not.toMatch(/grid-cols-\d/);
  });

  it('las tres clases posibles existen y traen la grilla entera', () => {
    /*
     * Sin esto, alguien podría vaciar el mapa y el aserto de arriba seguiría
     * pasando: la expresión estaría puesta y no haría nada.
     *
     * MUTACIÓN PROBADA: sacarle `items-start`. Las celdas se estiran al alto de
     * la más alta y el epígrafe de la más baja queda flotando lejos de su imagen
     * — un `figcaption` que no parece de nadie.
     */
    for (const n of [2, 3] as const) {
      expect(CLASES_DE_GALERIA[n]).toContain('grid');
      expect(CLASES_DE_GALERIA[n], 'cada celda hugea su contenido').toContain('items-start');
      expect(CLASES_DE_GALERIA[n], 'el medianil de 16px del sistema visual').toContain('gap-4');
      expect(CLASES_DE_GALERIA[n], 'en el teléfono nunca menos de dos por fila').toContain(
        'grid-cols-2',
      );
    }
    expect(CLASES_DE_GALERIA[3], 'con tres, la tercera columna aparece donde hay ancho').toContain(
      'sm:grid-cols-3',
    );
    expect(CLASES_DE_GALERIA[2], 'con una o dos no se abre una tercera columna').not.toContain(
      'grid-cols-3',
    );
  });

  it('el sistema visual manda: radio 0 y ninguna sombra', () => {
    const tira = bloqueDeLaTira();
    expect(tira).not.toMatch(/\brounded/);
    expect(tira).not.toMatch(/\bshadow/);
  });
});

describe('la tira no agrega una sola parada de tabulación', () => {
  it('sin enlaces, sin `tabindex` y sin island', () => {
    /*
     * La página de detalle tiene un presupuesto de **0 KB de JavaScript** (§4.3),
     * y un lightbox accesible —foco atrapado, cierre con Escape, foco devuelto al
     * disparador— es bastante más de lo que este ítem pide. Sin él, la tira no
     * suma ni un elemento al orden de tabulación: se recorre con el scroll, como
     * el resto de la página.
     *
     * MUTACIÓN PROBADA: envolver cada imagen en un `<a href={imagen.url}>` para
     * «verla grande». Agrega tres paradas de tabulación que no dicen nada —el alt
     * está vacío, así que el enlace se anuncia sin nombre— y saca al lector del
     * sitio a un JPEG suelto.
     */
    const tira = bloqueDeLaTira();
    expect(tira).not.toMatch(/<a[\s>]/);
    expect(tira).not.toContain('href');
    expect(tira).not.toContain('tabindex');
    expect(tira).not.toContain('client:');
  });
});

describe('rotuloDeGaleria — el texto es un dato testeado, no un literal en el markup', () => {
  it('el número va en palabras, y concuerda', () => {
    // Es el mismo criterio que el texto de «Suscribirse» (D-133): si el rótulo
    // vive en la plantilla, no hay forma de probar que diga «Una imagen más» y no
    // «1 imágenes más».
    expect(rotuloDeGaleria(1)).toBe('Una imagen más');
    expect(rotuloDeGaleria(2)).toBe('Dos imágenes más');
    expect(rotuloDeGaleria(3)).toBe('Tres imágenes más');
  });

  it('el singular es el caso frecuente, y no dice «1»', () => {
    /*
     * De las 4 actividades con más de una imagen medidas en producción, **3
     * tienen exactamente dos**, o sea una sola secundaria. El singular no es el
     * borde: es la mitad de los casos de esta función.
     *
     * MUTACIÓN PROBADA: devolver siempre el plural. «Una imágenes más» en un
     * `<h2>`, en la página que recibe el tráfico.
     */
    expect(rotuloDeGaleria(1)).not.toContain('imágenes');
    expect(rotuloDeGaleria(1)).not.toContain('1');
  });

  it('más allá del tope de DEC-7b no devuelve `undefined`', () => {
    /*
     * Con cuatro imágenes por actividad como tope, `n` nunca pasa de 3. El día que
     * el tope suba, el rótulo tiene que seguir siendo una frase y no un
     * `undefined imágenes más` en un encabezado.
     *
     * MUTACIÓN PROBADA: sacar el `?? n` del fallback.
     */
    expect(rotuloDeGaleria(4)).toBe('4 imágenes más');
    expect(rotuloDeGaleria(9)).not.toContain('undefined');
  });
});

describe('columnasDeGaleria — con una secundaria no puede haber dos portadas', () => {
  it('una o dos secundarias van a dos columnas', () => {
    /*
     * El caso que decide la función es **1**, que es el frecuente. A ancho
     * completo, esa única secundaria mediría lo mismo que la portada y la página
     * tendría dos imágenes protagonistas y ninguna portada.
     *
     * MUTACIÓN PROBADA: `() => 1`. Con una secundaria, la página muestra dos
     * imágenes grandes una debajo de la otra y el afiche deja de destacarse; nada
     * falla y el HTML es válido.
     */
    expect(columnasDeGaleria(1)).toBe(2);
    expect(columnasDeGaleria(2)).toBe(2);
  });

  it('tres van a tres, que es la fila completa', () => {
    expect(columnasDeGaleria(3)).toBe(3);
  });

  it('nunca pasa de tres, aunque suba el tope de imágenes', () => {
    /*
     * MUTACIÓN PROBADA: `(n) => n`. Con cuatro secundarias saldría un
     * `grid-cols-4` que Tailwind **no generó** —el mapa solo tiene 2 y 3—, así
     * que la clase no existe en la hoja y la tira se apila en una sola columna.
     * Es el modo de falla silencioso de D-148: una clase armada en tiempo de
     * ejecución no está en el CSS.
     */
    for (const n of [4, 5, 40]) expect(columnasDeGaleria(n)).toBeLessThanOrEqual(3);
    for (const n of [1, 2, 3, 4, 40]) expect(CLASES_DE_GALERIA[columnasDeGaleria(n)]).toBeTruthy();
  });
});
