/**
 * El lector de headers WebP — B-962.
 *
 * Existe porque dos reglas del banner de ciudad se afirmaban en prosa y no las
 * verificaba nadie: que **lo declarado sea lo que el archivo mide** (§CLS) y que
 * una imagen de un tercero **no llegue a una salida pública con sus metadatos**.
 * Las marcó el `auditor-privacidad`; el docblock de `src/lib/webp.ts` tiene el
 * porqué entero.
 *
 * `tests/banner-de-ciudad.test.ts` ejercita el camino de punta a punta con los
 * banners reales; acá se fijan los bordes del formato, que es donde un lector de
 * bytes se rompe: el contenedor extendido, el tamaño mal declarado y el caso que
 * **no se sabe leer** y por eso tiene que devolver `null`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chunksDeWebp, esWebp, medidasDeWebp } from '@/lib/webp';

const raiz = (relativo: string) => fileURLToPath(new URL(`../${relativo}`, import.meta.url));
const bytesDe = (relativo: string) => new Uint8Array(readFileSync(raiz(relativo)));

const cadena = (texto: string) => [...texto].map((c) => c.charCodeAt(0));

/** Un contenedor RIFF/WEBP con los chunks que se le pasen, ya armados. */
const contenedor = (chunks: number[]): Uint8Array => {
  const tamano = 4 + chunks.length;
  return new Uint8Array([
    ...cadena('RIFF'),
    tamano & 0xff,
    (tamano >> 8) & 0xff,
    (tamano >> 16) & 0xff,
    0,
    ...cadena('WEBP'),
    ...chunks,
  ]);
};

const chunk = (fourCC: string, datos: number[]): number[] => [
  ...cadena(fourCC),
  datos.length & 0xff,
  (datos.length >> 8) & 0xff,
  (datos.length >> 16) & 0xff,
  0,
  ...datos,
  // El relleno de alineación a dos bytes, que es donde un recorrido ingenuo se
  // desfasa y empieza a leer basura como si fueran chunks.
  ...(datos.length % 2 ? [0] : []),
];

const vp8 = (ancho: number, alto: number) =>
  chunk('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ancho & 0xff, ancho >> 8, alto & 0xff, alto >> 8]);

const vp8x = (ancho: number, alto: number) =>
  chunk('VP8X', [
    0, 0, 0, 0,
    (ancho - 1) & 0xff, ((ancho - 1) >> 8) & 0xff, ((ancho - 1) >> 16) & 0xff,
    (alto - 1) & 0xff, ((alto - 1) >> 8) & 0xff, ((alto - 1) >> 16) & 0xff,
  ]);

describe('los archivos de verdad, que es lo que este lector tiene que poder leer', () => {
  it('lee las medidas de los dos banners commiteados', () => {
    // Control positivo: sin esto, un lector que devolviera `null` siempre
    // dejaría pasar todos los casos negativos de abajo.
    expect(medidasDeWebp(bytesDe('public/banners/biblioguia-ancha.webp'))).toEqual({
      ancho: 1600,
      alto: 400,
    });
    expect(medidasDeWebp(bytesDe('public/banners/biblioguia-compacta.webp'))).toEqual({
      ancho: 1200,
      alto: 900,
    });
  });

  it('y no traen ningún chunk además del de imagen', () => {
    for (const f of ['ancha', 'compacta']) {
      expect(chunksDeWebp(bytesDe(`public/banners/biblioguia-${f}.webp`)), f).toEqual(['VP8 ']);
    }
  });
});

describe('el contenedor', () => {
  it('reconoce un WebP bien formado', () => {
    expect(esWebp(contenedor(vp8(100, 50)))).toBe(true);
  });

  it('rechaza lo que no lo es, y lo que dice un tamaño que no cierra', () => {
    expect(esWebp(new Uint8Array([1, 2, 3, 4]))).toBe(false);
    expect(esWebp(new Uint8Array(cadena('RIFF0000NOPE')))).toBe(false);

    // El tamaño declarado no coincide con el archivo: el contenedor está
    // truncado o le pegaron algo atrás, y las dos cosas se rechazan.
    const roto = contenedor(vp8(100, 50));
    roto[4] = 99;
    expect(esWebp(roto)).toBe(false);
  });
});

describe('las medidas', () => {
  it('salen del chunk lossy', () => {
    expect(medidasDeWebp(contenedor(vp8(2400, 600)))).toEqual({ ancho: 2400, alto: 600 });
  });

  it('y del contenedor extendido, donde van menos uno', () => {
    // El `VP8X` es el único que puede llevar EXIF, así que es el que más
    // importa poder leer: un archivo sin sanear llega con esta forma.
    expect(medidasDeWebp(contenedor([...vp8x(1600, 400), ...vp8(1600, 400)]))).toEqual({
      ancho: 1600,
      alto: 400,
    });
  });

  it('un lossy sin el sync code no da medidas inventadas: da `null`', () => {
    const mentiroso = contenedor(chunk('VP8 ', [0, 0, 0, 1, 2, 3, 0x60, 0x09, 0x58, 0x02]));
    expect(medidasDeWebp(mentiroso)).toBeNull();
  });

  it('el lossless todavía no se sabe leer, y devuelve `null` en vez de adivinar', () => {
    // «No pude verificar» tiene que ser distinguible de «está bien»: quien
    // llama trata el `null` como un problema.
    expect(medidasDeWebp(contenedor(chunk('VP8L', [0x2f, 0, 0, 0])))).toBeNull();
  });
});

describe('los chunks', () => {
  it('se enumeran en orden, saltando el relleno de alineación', () => {
    // Un chunk de largo impar lleva un byte de relleno: un recorrido que no lo
    // contemple se desfasa y lee basura como si fuera un `fourCC`.
    const bytes = contenedor([...chunk('VP8X', [1, 2, 3]), ...vp8(10, 10), ...chunk('EXIF', [9])]);
    expect(chunksDeWebp(bytes)).toEqual(['VP8X', 'VP8 ', 'EXIF']);
  });

  it('un contenedor roto da `null` y no una lista a medias', () => {
    expect(chunksDeWebp(new Uint8Array([1, 2, 3]))).toBeNull();

    // Un chunk que dice medir más de lo que queda: leer hasta donde se pueda
    // sería devolver una lista incompleta, que es peor que no devolver nada.
    const mentiroso = contenedor([...cadena('EXIF'), 0xff, 0xff, 0, 0, 1, 2]);
    expect(chunksDeWebp(mentiroso)).toBeNull();
  });
});
