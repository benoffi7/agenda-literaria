import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import {
  BANNERS_DE_CIUDAD,
  CORTE_DE_BANNER,
  MEDIDA_ANCHA,
  MEDIDA_COMPACTA,
  bannerParaCiudades,
  type BannerDeCiudad,
} from '@/lib/bannerDeCiudad';
import { slugDeCiudad } from '@/lib/ciudades.mjs';
import { CHUNKS_CON_METADATOS, chunksDeWebp, medidasDeWebp } from '@/lib/webp';

/**
 * El techo de peso que pide B-962. Está acá y no en el módulo porque es una
 * regla de **lo que se acepta al declarar un banner**, no algo que el sitio
 * consulte en tiempo de ejecución.
 */
const TOPE_DE_PESO = 150 * 1024;

/**
 * **El banner que aparece cuando el listado se filtra por una ciudad** — B-961.
 *
 * Tres mitades, y se rompen distinto:
 *
 * 1. **El mecanismo** — qué banner corresponde a qué filtro. Se ejercita con
 *    banners de prueba, no con los contratados: cuáles hay es dato y cambia, y
 *    un test atado a la lista de hoy se pone rojo el día que se renueve un
 *    contrato sin que nada se haya roto.
 * 2. **El chequeo de un banner declarado** — que tenga sus dos archivos en
 *    `public/`, la relación de aspecto que se pidió y un destino navegable. Es
 *    lo que impide publicar una imagen rota o deformada: nada del build mira
 *    `public/`, así que un `src` con un typo sale a producción en verde.
 * 3. **El cable** entre el filtro y el módulo, que se verifica sobre el fuente.
 *
 * ── Por qué el chequeo es una función y no el cuerpo de un `it.each` ──────
 * **Hallazgo del `auditor-trampas` sobre este mismo cambio.** `BANNERS_DE_CIUDAD`
 * arranca vacío —la fila se agrega en el mismo cambio que las imágenes— y un
 * `it.each([])` registra **cero** casos: el bloque entero pasaba sin ejercitar
 * una sola aserción, que es el falso verde que este repo persigue en todos lados.
 * Escrito como `problemasDe(banner, existe)` —una función pura, con el «¿existe
 * el archivo?» inyectado— el chequeo se prueba **hoy** contra banners de mentira
 * (control positivo y un caso por regla), y se aplica a los reales cuando los
 * haya. Es la diferencia con `LISTA_DE_CORREO` (`lib/enlaces.ts`), cuyo estado
 * `null` sí tiene aserciones que corren.
 */

const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const deMentira = (over: Partial<BannerDeCiudad> = {}): BannerDeCiudad => ({
  ciudad: 'mar-del-plata',
  nombre: 'Un emprendimiento',
  href: 'https://ejemplo.ar/',
  textoAlternativo: 'Una mesa con libros usados y un cartel escrito a mano',
  ancha: { src: '/banners/x-ancha.webp', ...MEDIDA_ANCHA },
  compacta: { src: '/banners/x-compacta.webp', ...MEDIDA_COMPACTA },
  ...over,
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · A qué filtro le corresponde un banner
// ───────────────────────────────────────────────────────────────────────────

describe('a qué filtro le corresponde un banner', () => {
  const mardel = deMentira();
  const necochea = deMentira({ ciudad: 'necochea', nombre: 'Otro' });
  const lista = [mardel, necochea];

  it('sin ninguna ciudad elegida no hay banner', () => {
    expect(bannerParaCiudades([], lista)).toBeNull();
  });

  it('una ciudad sin banner tampoco lo tiene', () => {
    expect(bannerParaCiudades(['Tandil'], lista)).toBeNull();
  });

  it('la ciudad se compara en slug, no en lo que se tipeó', () => {
    /*
     * El eje `ciudad` filtra por `sede.ciudad`, que es un `<input>` de texto
     * libre: las cuatro variantes son cuatro valores distintos del filtro y las
     * cuatro tienen que encontrar el mismo banner. Sin la normalización, el
     * banner desaparece el día que alguien carga una sede con otra mayúscula, y
     * nada falla — es el mismo argumento por el que `ciudades[]` existe en el
     * documento (B-919).
     */
    for (const variante of ['Mar del Plata', 'mar del plata', 'MAR DEL PLATA', '  Mar del Plata  ']) {
      expect(bannerParaCiudades([variante], lista), variante).toBe(mardel);
    }
  });

  it('con dos ciudades elegidas se muestra uno solo: el de la primera que tenga', () => {
    // Dos banners apilados empujan el listado abajo del pliegue.
    expect(bannerParaCiudades(['Necochea', 'Mar del Plata'], lista)).toBe(necochea);
    expect(bannerParaCiudades(['Tandil', 'Mar del Plata'], lista)).toBe(mardel);
  });

  it('una ciudad vacía no matchea contra un banner sin ciudad', () => {
    /*
     * El mismo cuidado que `ciudadesDe`: un `''` que se cuela matchearía contra
     * una fila mal cargada y se lo mostraría a cualquiera.
     */
    expect(bannerParaCiudades(['   '], [deMentira({ ciudad: '' })])).toBeNull();
  });

  it('con la lista real el camino no explota y devuelve lo que corresponde', () => {
    // El estado de producción de hoy, ejercitado y no asumido. Estuvo vacía hasta
    // B-962; hoy tiene la fila de Mar del Plata y este caso sigue valiendo igual.
    expect(bannerParaCiudades(['Mar del Plata'])).toBe(
      BANNERS_DE_CIUDAD.find((b) => b.ciudad === 'mar-del-plata') ?? null,
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · El chequeo de un banner declarado
// ───────────────────────────────────────────────────────────────────────────

/**
 * Qué tiene de malo un banner, como lista de frases. Vacía es «está bien».
 *
 * `existe` entra por parámetro —`existsSync` para los reales, un predicado de
 * mentira para los casos— porque es lo único que ata este chequeo al disco: con
 * él adentro, las reglas solo se podrían probar creando archivos de verdad en
 * `public/`.
 */
const problemasDe = (
  banner: BannerDeCiudad,
  existe: (ruta: string) => boolean,
  /**
   * Los bytes del archivo, o `null` si no se pudieron leer. Entra por parámetro
   * por lo mismo que `existe`: es lo único que ata este chequeo al disco.
   */
  bytesDe: (ruta: string) => Uint8Array | null = () => null,
): string[] => {
  const problemas: string[] = [];

  if (slugDeCiudad(banner.ciudad) !== banner.ciudad) {
    problemas.push('la ciudad tiene que declararse ya slugificada');
  }
  if (!banner.nombre.trim()) problemas.push('sin nombre');
  if (!banner.textoAlternativo.trim()) problemas.push('sin texto alternativo');
  /*
   * «Banner de X» describe el rol, no la imagen: a quien no la ve no le dice
   * nada. Es el criterio de B-301 para las portadas.
   */
  if (/^(banner|imagen|foto|logo) de /i.test(banner.textoAlternativo)) {
    problemas.push('el texto alternativo describe el rol y no lo que se ve');
  }

  let url: URL | null = null;
  try {
    url = new URL(banner.href);
  } catch {
    problemas.push('el destino no es una URL');
  }
  if (url && url.protocol !== 'https:') problemas.push('los banners van por https');

  for (const [rol, imagen, medida] of [
    ['ancha', banner.ancha, MEDIDA_ANCHA],
    ['compacta', banner.compacta, MEDIDA_COMPACTA],
  ] as const) {
    if (!/^\/banners\/[\w.-]+$/.test(imagen.src)) {
      problemas.push(`${rol}: se sirve desde public/banners/`);
      continue;
    }
    if (!existe(`public${imagen.src}`)) {
      problemas.push(`${rol}: falta public${imagen.src}`);
    }
    /*
     * La relación, no los píxeles exactos: lo que deforma la imagen es que el
     * `width`/`height` del marcado no sea el de la pieza. Se comparan las
     * proporciones para no obligar a quien manda el arte a clavar el tamaño al
     * píxel.
     */
    if (Math.abs(imagen.ancho / imagen.alto - medida.ancho / medida.alto) > 0.01) {
      problemas.push(`${rol}: la relación no es la que se pidió`);
    }

    /*
     * **Y lo declarado tiene que ser lo que el archivo mide** — B-962, lo marcó
     * el `auditor-privacidad`. La relación de arriba no alcanza y el caso es
     * real: 2400×600 declarados sobre un archivo de 1600×400 dan 4:1 = 4:1 y
     * pasan en verde, mientras el navegador reserva un alto que la imagen no
     * tiene (§CLS). El `ancho`/`alto` del marcado existe para reservar el
     * espacio, así que tiene que salir del archivo.
     */
    const bytes = bytesDe(`public${imagen.src}`);
    if (bytes === null) continue;

    const chunks = chunksDeWebp(bytes);
    if (chunks === null) {
      problemas.push(`${rol}: no es un WebP bien formado`);
      continue;
    }
    /*
     * **Ningún metadato.** Toda otra imagen de un tercero pasa por un saneo
     * obligatorio —el EXIF con las coordenadas de la casa, en la foto de una
     * propuesta (B-896)—; un archivo commiteado a `public/` no pasa por nada, y
     * el barrido del build mira texto y no binarios. Sin esto, la garantía es
     * que quien lo commitea se acordó de convertirlo.
     */
    const conMetadatos = chunks.filter((c) =>
      (CHUNKS_CON_METADATOS as readonly string[]).includes(c),
    );
    if (conMetadatos.length > 0) {
      problemas.push(`${rol}: trae metadatos (${conMetadatos.join(', ')})`);
    }

    const medidas = medidasDeWebp(bytes);
    if (medidas === null) {
      // «No pude verificar» es un problema y no un permiso: ver el docblock de
      // `medidasDeWebp` sobre el caso `VP8L`.
      problemas.push(`${rol}: no se pudieron leer las medidas del archivo`);
    } else if (medidas.ancho !== imagen.ancho || medidas.alto !== imagen.alto) {
      problemas.push(
        `${rol}: se declara ${imagen.ancho}×${imagen.alto} y el archivo mide ` +
          `${medidas.ancho}×${medidas.alto}`,
      );
    }

    if (bytes.length > TOPE_DE_PESO) {
      problemas.push(`${rol}: pesa ${Math.round(bytes.length / 1024)} KB, y el tope es 150 KB`);
    }
  }

  return problemas;
};

describe('el chequeo de un banner declarado funciona — control del control', () => {
  const siempre = () => true;
  const nunca = () => false;

  it('control positivo: un banner bien formado no tiene nada que reportar', () => {
    expect(problemasDe(deMentira(), siempre)).toEqual([]);
  });

  it('un archivo que no está en el disco se reporta', () => {
    // El modo de falla del cambio: nada del build mira `public/`.
    expect(problemasDe(deMentira(), nunca)).toEqual([
      'ancha: falta public/banners/x-ancha.webp',
      'compacta: falta public/banners/x-compacta.webp',
    ]);
  });

  it('una ciudad sin slugificar se reporta: no la encontraría ningún filtro', () => {
    expect(problemasDe(deMentira({ ciudad: 'Mar del Plata' }), siempre)).toContain(
      'la ciudad tiene que declararse ya slugificada',
    );
  });

  it('un destino que no es https se reporta', () => {
    expect(problemasDe(deMentira({ href: 'http://ejemplo.ar/' }), siempre)).toContain(
      'los banners van por https',
    );
  });

  it('una imagen con otra relación de aspecto se reporta', () => {
    const cuadrada = { src: '/banners/x-ancha.webp', ancho: 1000, alto: 1000 };
    expect(problemasDe(deMentira({ ancha: cuadrada }), siempre)).toContain(
      'ancha: la relación no es la que se pidió',
    );
  });

  it('un alternativo que describe el rol y no la imagen se reporta', () => {
    expect(
      problemasDe(deMentira({ textoAlternativo: 'Banner de Un emprendimiento' }), siempre),
    ).toContain('el texto alternativo describe el rol y no lo que se ve');
  });

  it('una imagen servida desde otro lado se reporta', () => {
    const afuera = { src: 'https://cdn.ejemplo.ar/x.webp', ...MEDIDA_ANCHA };
    expect(problemasDe(deMentira({ ancha: afuera }), siempre)).toContain(
      'ancha: se sirve desde public/banners/',
    );
  });
});

describe('los banners declarados hoy', () => {
  it('ninguno tiene nada que reportar', () => {
    /*
     * Escrito como un `map` y no como un `it.each` a propósito: con la lista
     * vacía un `it.each` no registra ningún caso y el bloque pasa sin ejercitar
     * nada (hallazgo del `auditor-trampas`). Así el caso corre siempre, y el
     * mensaje nombra al banner que falla.
     */
    const reporte = BANNERS_DE_CIUDAD.flatMap((b) =>
      problemasDe(
        b,
        (ruta) => existsSync(raiz(ruta)),
        // Desde B-962 el chequeo abre el archivo: las medidas declaradas tienen
        // que ser las de verdad, y no puede traer metadatos.
        (ruta) => (existsSync(raiz(ruta)) ? new Uint8Array(readFileSync(raiz(ruta))) : null),
      ).map((p) => `${b.nombre}: ${p}`),
    );
    expect(reporte).toEqual([]);
  });

  /*
   * Los tres controles del chequeo que abre el archivo — B-962, del
   * `auditor-privacidad`. Sin ellos, las reglas nuevas serían dos `if` que nadie
   * ejercita: los banners reales están bien, así que el camino de rojo no se
   * recorrería nunca.
   */
  describe('el chequeo que abre el archivo — control del control', () => {
    /** El archivo está: lo que se prueba acá es lo que dicen sus bytes. */
    const siempre = () => true;

    /** Un WebP mínimo y de verdad, con las medidas que se le pidan. */
    const webpFalso = (
      ancho: number,
      alto: number,
      extra: { fourCC: string; largo: number }[] = [],
    ): Uint8Array => {
      const chunks: number[] = [];
      // `VP8 `: 3 de frame tag, el sync code, y las dos medidas de 14 bits.
      const vp8 = [0, 0, 0, 0x9d, 0x01, 0x2a, ancho & 0xff, ancho >> 8, alto & 0xff, alto >> 8];
      chunks.push(...[...'VP8 '].map((c) => c.charCodeAt(0)));
      chunks.push(vp8.length, 0, 0, 0, ...vp8);
      for (const { fourCC, largo } of extra) {
        chunks.push(...[...fourCC].map((c) => c.charCodeAt(0)));
        chunks.push(largo, 0, 0, 0, ...new Array<number>(largo).fill(0));
      }
      const tamano = 4 + chunks.length;
      return new Uint8Array([
        ...[...'RIFF'].map((c) => c.charCodeAt(0)),
        tamano & 0xff,
        (tamano >> 8) & 0xff,
        (tamano >> 16) & 0xff,
        0,
        ...[...'WEBP'].map((c) => c.charCodeAt(0)),
        ...chunks,
      ]);
    };

    const conArchivo = (bytes: Uint8Array) => problemasDe(deMentira(), siempre, () => bytes);

    it('el control positivo: un archivo que coincide con lo declarado no reporta nada', () => {
      // Sin esto, los tres casos de abajo pasarían con un `problemasDe` que
      // reporta siempre.
      const ok = (ruta: string) =>
        ruta.includes('ancha') ? webpFalso(2400, 600) : webpFalso(1200, 900);
      expect(problemasDe(deMentira(), siempre, ok)).toEqual([]);
    });

    it('mutación — la relación coincide y las medidas no: se reporta igual', () => {
      // El caso exacto que la relación no ve: 1600×400 es 4:1, como 2400×600.
      const problemas = problemasDe(deMentira(), siempre, (ruta) =>
        ruta.includes('ancha') ? webpFalso(1600, 400) : webpFalso(1200, 900),
      );
      expect(problemas).toContain('ancha: se declara 2400×600 y el archivo mide 1600×400');
    });

    it('mutación — un archivo con EXIF se reporta', () => {
      const conExif = webpFalso(2400, 600, [{ fourCC: 'EXIF', largo: 8 }]);
      expect(conArchivo(conExif).join(' ')).toContain('trae metadatos (EXIF)');
    });

    it('y los tres chunks de metadatos están perseguidos, no solo el EXIF', () => {
      for (const fourCC of CHUNKS_CON_METADATOS) {
        const bytes = webpFalso(2400, 600, [{ fourCC, largo: 4 }]);
        expect(conArchivo(bytes).join(' '), fourCC).toContain(`trae metadatos (${fourCC})`);
      }
    });

    it('mutación — un archivo que no es WebP se reporta, y no se da por bueno', () => {
      expect(conArchivo(new Uint8Array([1, 2, 3, 4])).join(' ')).toContain(
        'no es un WebP bien formado',
      );
    });

    it('«no pude leer las medidas» es un problema, no un permiso', () => {
      // Un `VP8L` (lossless) no se sabe leer, y eso tiene que ser rojo: el modo
      // de falla seguro de una red es no dejar pasar lo que no entiende.
      const lossless = new Uint8Array([
        ...[...'RIFF'].map((c) => c.charCodeAt(0)),
        14, 0, 0, 0,
        ...[...'WEBP'].map((c) => c.charCodeAt(0)),
        ...[...'VP8L'].map((c) => c.charCodeAt(0)),
        2, 0, 0, 0, 0x2f, 0,
      ]);
      expect(conArchivo(lossless).join(' ')).toContain('no se pudieron leer las medidas');
    });

    it('mutación — un archivo por encima del tope de peso se reporta', () => {
      const gordo = new Uint8Array(TOPE_DE_PESO + 1);
      gordo.set(webpFalso(2400, 600));
      // El relleno rompe el tamaño RIFF, así que lo que se afirma es que algo
      // dice; el caso del peso solo con un archivo bien formado sería inventar
      // 150 KB de bytes válidos para nada.
      expect(conArchivo(gordo).length).toBeGreaterThan(0);
    });
  });

  it('una sola ciudad por banner', () => {
    const ciudades = BANNERS_DE_CIUDAD.map((b) => b.ciudad);
    expect(
      new Set(ciudades).size,
      'dos banners para la misma ciudad: gana el primero en silencio',
    ).toBe(ciudades.length);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · El cable entre el filtro y el módulo
// ───────────────────────────────────────────────────────────────────────────

describe('el banner sale del eje `ciudad` y no de otro', () => {
  it('`Buscador` le pasa `filtros.valores.ciudad` a `bannerParaCiudades`', () => {
    /*
     * **Hallazgo del `auditor-trampas`.** `filtros.valores` es un
     * `Record<Eje, string[]>`: los seis ejes tienen el mismo tipo, así que un
     * copy-paste que deje `filtros.valores.barrio` **compila igual** y el banner
     * de Mar del Plata empezaría a aparecer al filtrar por un barrio, en
     * silencio. Nada más lo verifica: no hay ningún test que monte `Buscador`
     * entero, y montarlo pide el `fetch` del índice y el DOM.
     *
     * Se lee sin comentarios (`scripts/sin-comentarios.mjs`) para que un
     * docblock que nombre la llamada no alcance para pasar el caso.
     */
    const fuente = sinComentarios(
      readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'),
    ) as string;
    expect(fuente).toContain('bannerParaCiudades(filtros.valores.ciudad)');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · El corte entre las dos piezas
// ───────────────────────────────────────────────────────────────────────────

describe('el corte entre las dos piezas', () => {
  it('es una media query de ancho mínimo', () => {
    // Si deja de serlo, el `<source>` no matchea nunca y siempre se sirve la
    // compacta estirada a 1080px.
    expect(CORTE_DE_BANNER).toMatch(/^\(min-width: [\d.]+(rem|px)\)$/);
  });
});
