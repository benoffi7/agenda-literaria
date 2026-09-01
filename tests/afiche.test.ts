import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { columnasDeCartelera, estiloDeAfiche, proporcionDeAfiche } from '@/lib/afiche';
import { claseAfiche } from '@/components/sitio/estilos';

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
    // 720 × 826 son los dos flyers que hay cargados hoy: verticales, 0,87.
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
     * Hoy hay exactamente **dos** flyers cargados. Con `columns-3` fijo, CSS
     * reparte el alto y esos dos quedan del ancho de un tercio de pantalla, cada
     * uno en su columna y con la tercera vacía. Se ve como una plantilla a medio
     * llenar, que es distinto de verse poco.
     */
    expect(columnasDeCartelera(0)).toBe(1);
    expect(columnasDeCartelera(1)).toBe(1);
    expect(columnasDeCartelera(2)).toBe(1);
  });

  it('la pared se densifica sola a medida que se cargan', () => {
    expect(columnasDeCartelera(3)).toBe(2);
    expect(columnasDeCartelera(5)).toBe(2);
    expect(columnasDeCartelera(6)).toBe(3);
    expect(columnasDeCartelera(42)).toBe(3);
  });

  it('nunca crece más allá de tres', () => {
    // Es el tope, no el número de columnas: el CSS igual baja a una en el
    // teléfono. Cuatro columnas de afiche en 1440px dan 320px cada una, que para
    // un flyer con texto adentro es ilegible.
    for (const n of [7, 20, 100, 1000]) expect(columnasDeCartelera(n)).toBeLessThanOrEqual(3);
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
  execFileSync('git', ['ls-files', 'src/pages', 'src/components/sitio'], { encoding: 'utf8' })
    .split('\n')
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
    expect(claseAfiche, 'el tope de alto es lo que D-144 necesitaba de verdad').toMatch(/max-h-/);
    expect(claseAfiche, 'el tope se mide en `svh`: `vh` mide de más en un móvil').toContain('svh');
    expect(claseAfiche, 'la proporción no puede estar en la clase: es un dato de cada imagen')
      .not.toMatch(/aspect-/);
  });
});
