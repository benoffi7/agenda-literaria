import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { columnasDeCartelera, estiloDeAfiche, proporcionDeAfiche } from '@/lib/afiche';
import { claseAfiche, claseAfichePortada } from '@/components/sitio/estilos';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

/**
 * La forma de una imagen del sitio — B-263, D-147.
 *
 * Dos mitades. La primera es la lógica pura: qué proporción sale de qué medida y
 * qué pasa cuando el dato no sirve. La segunda es el **barrido de clase**, que es
 * el que reemplaza al token `--aspect-portada`: antes la garantía era «todos usan
 * el mismo número», ahora es «nadie recorta», y eso se afirma sobre todas las
 * salidas del sitio a la vez en vez de página por página.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

describe('proporcionDeAfiche — la caja sale de la imagen, o no sale', () => {
  it('con las dos medidas devuelve la razón tal cual', () => {
    // 720 × 826 eran los dos flyers cargados cuando se escribió esto (hoy hay
    // 218): verticales, 0,87.
    expect(proporcionDeAfiche({ ancho: 720, alto: 826 })).toBe('720 / 826');
    expect(proporcionDeAfiche({ ancho: 1080, alto: 1350 })).toBe('1080 / 1350');
  });

  it('no se simplifica la fracción, y da igual', () => {
    // `aspect-ratio: 720 / 826` y `aspect-ratio: 360 / 413` son lo mismo para el
    // navegador. Simplificar sería código que puede tener un bug para no ganar
    // nada; el string va a un atributo `style`, no a la vista de nadie.
    expect(proporcionDeAfiche({ ancho: 360, alto: 413 })).toBe('360 / 413');
  });

  it('sin medida, no hay caja que reservar', () => {
    /*
     * Es el caso de una imagen **externa** cargada antes de B-263, que hoy son
     * casi todas. Devolver `null` es la respuesta correcta y no una falla: sin
     * `aspect-ratio` el navegador usa la forma real al cargar, y el costo es un
     * salto de layout. La alternativa —reservar una proporción inventada— dejaría
     * un flyer vertical encogido entre dos bandas **para siempre**.
     */
    expect(proporcionDeAfiche({})).toBeNull();
    expect(proporcionDeAfiche({ ancho: 720 })).toBeNull();
    expect(proporcionDeAfiche({ alto: 826 })).toBeNull();
    expect(proporcionDeAfiche({ ancho: null, alto: null })).toBeNull();
  });

  it('una medida corrupta se trata como no saber, no como cero', () => {
    /*
     * MUTACIÓN PROBADA: sacar la guarda y devolver la razón igual. Con
     * `alto: 0` el CSS recibe `aspect-ratio: 720 / 0`, que el navegador
     * interpreta como una caja de alto cero: la imagen **desaparece** de la
     * página y el build sigue en verde. Un `ancho: -1` de un documento tocado a
     * mano hace lo mismo.
     */
    expect(proporcionDeAfiche({ ancho: 720, alto: 0 })).toBeNull();
    expect(proporcionDeAfiche({ ancho: 0, alto: 826 })).toBeNull();
    expect(proporcionDeAfiche({ ancho: -720, alto: 826 })).toBeNull();
    expect(proporcionDeAfiche({ ancho: 720, alto: Number.NaN })).toBeNull();
    expect(proporcionDeAfiche({ ancho: 720, alto: Number.POSITIVE_INFINITY })).toBeNull();
    // Y un número absurdo tampoco: 10 millones de px no es una imagen, es basura.
    expect(proporcionDeAfiche({ ancho: 10_000_000, alto: 826 })).toBeNull();
  });

  it('estiloDeAfiche devuelve CSS o nada, nunca un string vacío', () => {
    // Un `style=""` en el markup no rompe, pero un `style="aspect-ratio: "` sí:
    // por eso lo que se devuelve cuando no hay medida es `undefined`, que Astro
    // omite el atributo entero.
    expect(estiloDeAfiche({ ancho: 720, alto: 826 })).toBe('aspect-ratio: 720 / 826');
    expect(estiloDeAfiche({})).toBeUndefined();
  });
});

describe('columnasDeCartelera — la pared con pocos afiches también tiene que verse', () => {
  it('con dos o menos va a una columna: grandes y uno abajo del otro', () => {
    /*
     * Con una grilla fija, CSS reparte el alto y dos afiches quedan del ancho de
     * un cuarto de pantalla, cada uno en su columna y con dos vacías: se ve como
     * una plantilla a medio llenar, que es distinto de verse poco.
     *
     * Era el caso de todos los días cuando se escribió (dos flyers cargados) y
     * al 2026-09-18 hay 218, así que hoy protege la cartelera que se vacía —un
     * mes flojo, o el día después de una tanda de vencimientos— y no el estado
     * normal.
     */
    expect(columnasDeCartelera(0)).toBe(1);
    expect(columnasDeCartelera(1)).toBe(1);
    expect(columnasDeCartelera(2)).toBe(1);
  });

  it('con tres van a dos columnas: sigue habiendo un escalón intermedio', () => {
    expect(columnasDeCartelera(3)).toBe(2);
  });

  /**
   * **B-1133 — la cuarta entra desde cuatro, y antes entraba desde ocho.**
   *
   * B-958 la había puesto en ocho para mantener la proporción de los saltos. El
   * pedido volvió al día siguiente —«cuatro flyers por fila en la cartelera para
   * desktop»— y la medición explica por qué: con **218 flyers cargados** el
   * escalón de ocho no era lo que lo tapaba, era el breakpoint `2xl` de
   * `CLASES_DE_PARED`. Se corrieron los dos, y éste queda en cuatro porque es
   * cuando existe la primera fila de cuatro.
   *
   * Lo que sigue en pie es la contención de los dos primeros escalones: uno y
   * dos van grandes a una columna, tres van a dos. Eso es lo que evita la pared
   * «mal armada» que esta función existe para evitar.
   */
  it('desde cuatro abre la cuarta', () => {
    expect(columnasDeCartelera(4)).toBe(4);
    expect(columnasDeCartelera(8)).toBe(4);
    expect(columnasDeCartelera(218)).toBe(4);
  });

  /**
   * **Y nunca crece más allá de cuatro, con la objeción de B-249 anotada.**
   *
   * Aquel ítem descartó la cuarta columna con un número: en el contenedor de
   * `/cartelera` —`max-w-[90rem]` con `px-10`, ~1360px de contenido— cuatro
   * columnas dan **~320px por afiche**, y «para un flyer con texto adentro es
   * ilegible». Ese número **no cambió**; lo que cambió es que el dueño lo pidió
   * dos veces. `CLASES_DE_PARED` lo acotaba poniendo la cuarta en `2xl`, y eso
   * resultó ser justamente lo que hacía que no se viera nunca: desde B-1133 entra
   * en `xl` (~280px por afiche), con el escalón de `lg:columns-3` intacto para
   * que 1024–1279 no caiga de tres a dos.
   */
  it('nunca crece más allá de cuatro', () => {
    for (const n of [20, 100, 1000]) expect(columnasDeCartelera(n)).toBeLessThanOrEqual(4);
  });
});

/**
 * El barrido de clase — lo que reemplaza al token `--aspect-portada` (B-249).
 *
 * ── Por qué esto es más fuerte que el token ───────────────────────────────
 * El token compartía un **número**. Eso frenaba «dos recortes distintos» y no
 * frenaba «recortar»: nada impedía usarlo con `object-cover` en una página y con
 * `object-contain` en otra, ni impedía que el número fuera malo para la forma de
 * imagen que de verdad se carga — que es lo que pasó, 16/9 contra flyers de 0,87.
 *
 * Este barrido afirma la regla: **ninguna salida pública recorta una imagen**. Se
 * corre sobre todos los `.astro` del sitio a la vez, así que la página que se
 * escriba el mes que viene entra sola.
 */
const paginasDelSitio = (): string[] =>
  archivosDelRepo('src/pages', 'src/components/sitio')
    .filter((f) => f.endsWith('.astro'))
    // El panel no es el sitio: tiene su propio criterio y su propio
    // centralizador (`campos/Campo.tsx`), y su miniatura de vista previa sí
    // recorta a propósito — es una miniatura de 80px, no una salida pública.
    .filter((f) => f !== 'src/pages/admin.astro');

/** El archivo sin comentarios: los docblocks explican justo lo que se prohíbe. */
const sinComentarios = (s: string): string =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

describe('ninguna salida del sitio recorta una imagen — D-147', () => {
  it('el barrido encuentra páginas de verdad', () => {
    // Control positivo: un `git ls-files` vacío haría pasar todo lo de abajo sin
    // haber mirado un solo archivo.
    const paginas = paginasDelSitio();
    expect(paginas.length).toBeGreaterThan(3);
    expect(paginas).toContain('src/pages/actividad/[slug].astro');
    expect(paginas, 'la cartelera es la otra salida con imágenes').toContain(
      'src/pages/cartelera.astro',
    );
  });

  it('ninguna escribe `object-cover` ni una proporción a mano', () => {
    /*
     * MUTACIÓN PROBADA: poner `object-cover` en la cartelera —dejando el detalle
     * como está— deja las dos páginas viéndose «bien» y recorta la mitad de cada
     * flyer de la pared. Es exactamente el modo de falla de B-263, y la versión
     * anterior de este chequeo (atada al token, y solo sobre el detalle) no lo
     * habría visto.
     */
    const culpables = paginasDelSitio().filter((f) => {
      const codigo = sinComentarios(readFileSync(raiz(f), 'utf8'));
      return /object-cover/.test(codigo) || /aspect-\[|aspect-portada/.test(codigo);
    });

    expect(
      culpables,
      'estas páginas recortan una imagen o escriben una proporción a mano. La forma ' +
        'compartida es `claseAfiche` y la proporción sale de cada imagen con ' +
        '`estiloDeAfiche` (D-147): un flyer recortado pierde el título y la fecha, que ' +
        'están tipografiados adentro del JPEG.',
    ).toEqual([]);
  });

  it('toda imagen de actividad usa la clase compartida', () => {
    /*
     * La otra mitad: prohibir `object-cover` no alcanza si alguien escribe las
     * utilidades sueltas. Se exige que cada `<img>` que pinte una imagen cargada
     * por el panel traiga `claseAfiche`.
     *
     * Se reconocen por la clase, no por el nombre de la variable: `portada.url`
     * en el detalle y `afiche.url` en la cartelera son la misma cosa y no tienen
     * por qué llamarse igual.
     */
    for (const f of paginasDelSitio()) {
      const codigo = sinComentarios(readFileSync(raiz(f), 'utf8'));
      const imgs = codigo.match(/<img[\s\S]*?\/>/g) ?? [];
      for (const img of imgs) {
        if (!/\.url\}/.test(img)) continue;
        expect(img, `un <img> de ${f} pinta una imagen del panel sin \`claseAfiche\``).toContain(
          'claseAfiche',
        );
      }
    }
  });

  it('la clase compartida trae la regla entera, y no un pedazo', () => {
    /*
     * Sin esto, alguien podría vaciar `claseAfiche` y las tres afirmaciones de
     * arriba seguirían pasando: la clase estaría puesta en todos lados y no haría
     * nada. Es el mismo cuidado que el aserto de `--aspect-portada:` que este
     * archivo reemplaza.
     *
     * MUTACIÓN PROBADA: sacarle `max-h-` deja la página sin tope de alto y un
     * flyer vertical vuelve a empujar la ficha fuera de la primera pantalla, que
     * es la condición que hace válido el desvío del §4.3 (D-144).
     */
    expect(claseAfiche, 'la red contra el recorte').toContain('object-contain');
    expect(claseAfiche, 'la proporción no puede estar en la clase: es un dato de cada imagen')
      .not.toMatch(/aspect-/);
    // El tope de alto vive en la variante de la portada y no en la base: la
    // pared de la cartelera no lo lleva a propósito (ahí el afiche es el
    // contenido y la página se recorre scrolleando).
    expect(claseAfichePortada, 'el tope de alto es lo que D-144 necesitaba de verdad').toMatch(
      /max-h-/,
    );
    expect(claseAfichePortada, 'el tope se mide en `svh`: `vh` mide de más en un móvil').toContain(
      'svh',
    );
    expect(claseAfichePortada, 'la variante es la base más el tope').toContain(claseAfiche);
    expect(claseAfiche, 'la pared no topea el alto').not.toMatch(/max-h-/);
  });
});
