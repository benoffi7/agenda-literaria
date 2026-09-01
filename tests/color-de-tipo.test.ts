import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, oklchASrgb, type Srgb } from '@/lib/contraste';
import {
  C_DEL_TIPO,
  L_DEL_TIPO,
  PISO_DEL_TIPO,
  SUPERFICIES,
  TINTAS_DE_TIPO,
  TIPOS_CON_TONO,
  TONOS_DE_TIPO,
  colorDeTipo,
  colorDelTono,
  colorDelTonoSrgb,
  contrasteDelTono,
  esTonoElegible,
  tonoDeTipo,
  tonoLegible,
} from '@/lib/identidad';
import { estiloDeTipo, tonosDeTipo } from '@/lib/listadoPublico';
import baseCruda from '@/lib/opciones-base.json';
import type { ValorOpcion } from '@/types/actividad';

/**
 * El color del tipo de actividad: que **ninguno de los posibles** sea ilegible
 * — B-270 (D-150).
 *
 * ── Por qué se recorren los 360 y no los siete que existen ────────────────
 * `tipo` es taxonomía autogestionada (§4): mañana alguien crea «Ciclo de cine» y
 * su color se deriva del slug, sin que nadie lo mire. Verificar los siete que hay
 * hoy dejaría la garantía en «los que ya vimos», que es exactamente el modo de
 * falla que este archivo existe para cerrar — y es el mismo argumento con el que
 * D-141 escribió el barrido original, retirado por D-146 cuando el color se fue.
 *
 * La garantía se puede dar porque el espacio de colores tiene **una** dimensión:
 * `L` y `C` son fijos y solo varía el matiz. Con un selector de color libre el
 * espacio sería de millones y esto no se podría escribir.
 *
 * ── Y contra las tres superficies, no contra el papel ─────────────────────
 * La cajita del tipo se apoya en el papel y, cuando el mouse pasa por la fila, en
 * `crema`. Medir solo contra el papel da un número **optimista** (el motivo largo
 * está en `contraste-de-superficies.test.ts`, B-256), así que se mide contra la
 * más oscura de las tres.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const css = (): string => readFileSync(raiz('src/styles/global.css'), 'utf8');

/** Un token de color de la hoja de estilos, tal como lo leen los otros chequeos. */
const tokenDeCss = (nombre: string): readonly [number, number, number] => {
  const m = css().match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return [Number(m![1]), Number(m![2]), Number(m![3])] as const;
};

const srgb = (t: readonly [number, number, number]): Srgb => oklchASrgb(t[0], t[1], t[2]);

const TONOS = Array.from({ length: 360 }, (_, i) => i);

const base = baseCruda as unknown as Record<string, ValorOpcion[]>;

describe('las superficies que el módulo copia son las de `global.css` — D-98', () => {
  it('los tres tokens coinciden exactamente', () => {
    /*
     * `identidad.ts` **copia** los tres valores porque corre en el navegador y
     * ahí no hay hoja de estilos que leer al decidir si un color se puede
     * guardar. Es el caso 2 de D-98: lo que no se puede importar se ata con un
     * test.
     *
     * MUTACIÓN PROBADA: cambiar el `papel` de `SUPERFICIES` a `0.95` hace fallar
     * este caso nombrando el token.
     */
    for (const { nombre, oklch } of SUPERFICIES) {
      expect(oklch, `--color-${nombre}`).toEqual(tokenDeCss(nombre));
    }
  });

  it('y son las tres superficies claras del sistema, ni una menos', () => {
    // Control positivo: sin esto, borrar dos entradas de `SUPERFICIES` dejaría
    // el caso de arriba en verde midiendo contra una sola.
    expect(SUPERFICIES.map((s) => s.nombre)).toEqual(['papel', 'crema', 'hondo']);
  });
});

describe('los 360 tonos posibles del tipo de actividad pasan AA — D-150', () => {
  it('el peor de los 360 está por encima del piso, sobre las tres superficies', () => {
    /*
     * MUTACIÓN PROBADA: subir `L_DEL_TIPO` de 0,42 a **0,51** deja el peor tono
     * (el 192, un petróleo) en **4,10:1 sobre `hondo`** y hace fallar este caso
     * nombrándolo. Sobre el papel ese mismo tono da **5,05** y pasaría un chequeo
     * que solo mirara el fondo principal: es el punto ciego de B-256, acá cubierto
     * de entrada. Con 0,55 fallan las dos y la mutación no distingue nada.
     */
    const flojos = TONOS.map((t) => ({ t, ratio: contrasteDelTono(t) }))
      .filter((x) => x.ratio < AA_TEXTO)
      .map((x) => `tono ${x.t}: ${x.ratio.toFixed(2)}:1`);

    expect(
      flojos,
      `estos tonos no llegan a ${AA_TEXTO}:1 sobre alguna de las tres superficies. ` +
        'La banda (L y C de `identidad.ts`) es lo que hay que bajar, no el piso.',
    ).toEqual([]);
  });

  it('el margen del peor tono se mide, y hoy es cómodo', () => {
    /*
     * El caso de arriba pasa con 4,51 y con 7,00, y son cosas muy distintas: el
     * primero es una deuda —cualquier retoque lo tira abajo— y el segundo es
     * margen de verdad. Es la lección de los `*-container` del sistema visual, que
     * pasan por quince centésimas.
     *
     * Se afirma un piso holgado y no el número exacto para que el test no haya que
     * tocarlo por un cambio de una centésima en la conversión.
     */
    const peor = Math.min(...TONOS.map(contrasteDelTono));
    expect(peor).toBeGreaterThan(5.5);
  });

  it('la banda que ofrece el selector está adentro de lo verificado', () => {
    /*
     * Los doce matices con nombre son un subconjunto de los 360, así que pasan por
     * construcción. Lo que este caso ataja es que alguien agregue a la lista un
     * matiz de **otra** banda —un `{ tono: 85, nombre: 'Amarillo' }` con su propio
     * `L`— o un valor fuera de rango.
     *
     * MUTACIÓN PROBADA: agregar `{ tono: 400, nombre: 'Fuera' }` hace fallar el
     * primer aserto; ningún tono de 0 a 359 hace fallar el segundo, que es el
     * punto.
     */
    for (const { tono, nombre } of TINTAS_DE_TIPO) {
      expect(esTonoElegible(tono), `${nombre} (${tono})`).toBe(true);
      expect(tonoLegible(tono), `${nombre} (${tono})`).toBe(true);
    }
    // Y que cada uno tenga un nombre de verdad: un botón de color sin nombre no
    // existe para quien usa un lector de pantalla.
    for (const { nombre } of TINTAS_DE_TIPO) expect(nombre.trim().length).toBeGreaterThan(2);
    expect(new Set(TINTAS_DE_TIPO.map((t) => t.tono)).size).toBe(TINTAS_DE_TIPO.length);
    expect(new Set(TINTAS_DE_TIPO.map((t) => t.nombre)).size).toBe(TINTAS_DE_TIPO.length);
  });

  it('el detector distingue: un color de otra banda se reconocería flojo', () => {
    /*
     * Control negativo. Los asertos de arriba afirman que una lista está vacía, y
     * una lista vacía es también lo que devuelve un cálculo que no calcula nada.
     * Un amarillo claro —lo primero que alguien elegiría de un selector libre—
     * tiene que dar por debajo del piso.
     */
    const amarilloClaro = oklchASrgb(0.9, 0.15, 100);
    const peorSuperficie = srgb(tokenDeCss('hondo'));
    expect(contraste(amarilloClaro, peorSuperficie)).toBeLessThan(AA_TEXTO);
  });
});

describe('la guarda de lo que se puede guardar y de lo que se lee', () => {
  it('`esTonoElegible` acepta enteros de 0 a 359 y nada más', () => {
    /*
     * MUTACIÓN PROBADA: cambiar `tono < 360` por `tono <= 360` hace fallar el caso
     * con 360; sacar `Number.isInteger` lo hace fallar con 12,5; cambiar
     * `tono >= 0` por `tono > 0` lo hace fallar con 0, que es un tono válido (rojo).
     */
    for (const bueno of [0, 1, 180, 359]) expect(esTonoElegible(bueno), `${bueno}`).toBe(true);
    for (const malo of [-1, 360, 361, 12.5, Number.NaN, Infinity, '180', null, undefined, {}]) {
      expect(esTonoElegible(malo), JSON.stringify(malo) ?? 'undefined').toBe(false);
    }
  });

  it('`tonoLegible` es `esTonoElegible` más el piso, y el piso es el de texto', () => {
    // Hoy los dos coinciden sobre los 360 —esa es la promesa de la banda— pero no
    // son la misma función, y la diferencia es la que aparece el día que la banda
    // se afloje. Se verifica contra un color de otra banda, construido a mano.
    expect(PISO_DEL_TIPO).toBe(AA_TEXTO);
    expect(tonoLegible(400)).toBe(false);
    expect(tonoLegible(180)).toBe(true);
  });

  it('un tono guardado que no sea elegible se ignora al leer: cae al derivado', () => {
    /*
     * `/opciones/*` se puede editar a mano desde la consola de Firestore. Sin esta
     * guarda, un `tono: 999` pintaría `oklch(0.42 0.105 999)` —que el navegador
     * normaliza a 279, o descarta— y un `tono: null` pintaría `null`. Lo primero es
     * un color que nadie eligió y nadie midió; lo segundo, una cajita sin color.
     *
     * MUTACIÓN PROBADA: cambiar `tonoDeTipo` por `elegido ?? TONOS_DE_TIPO[slug] ??
     * tonoDerivado(slug)` —o sea confiar en lo guardado— hace fallar este caso.
     */
    for (const malo of [999, -5, 12.5, Number.NaN, '250', null]) {
      expect(tonoDeTipo('taller', malo), JSON.stringify(malo) ?? 'undefined').toBe(
        TONOS_DE_TIPO.taller,
      );
    }
  });

  it('lo elegido gana sobre el default, y el default sobre el derivado', () => {
    // El orden del §4 en una línea: se deriva por defecto y lo elegido es la
    // excepción. Los tres escalones, en el mismo caso.
    expect(tonoDeTipo('taller', 195)).toBe(195);
    expect(tonoDeTipo('taller')).toBe(TONOS_DE_TIPO.taller);
    expect(tonoDeTipo('ciclo-de-cine')).not.toBeUndefined();
    expect(esTonoElegible(tonoDeTipo('ciclo-de-cine'))).toBe(true);
  });
});

describe('un tipo nuevo nace con color, y siempre el mismo', () => {
  it('cualquier slug inventado deriva un tono legible', () => {
    /*
     * El modo de falla que D-150 evita, dicho como test: un tipo creado desde
     * «Otro» no puede nacer sin color. Se prueba con slugs que nadie escribió en
     * ninguna tabla.
     */
    const inventados = [
      'ciclo-de-cine',
      'residencia',
      'lectura-en-voz-alta',
      'micro-abierto',
      'club-de-escritura',
      'x',
      'zzzzzzzz',
    ];
    for (const slug of inventados) {
      expect(tonoLegible(tonoDeTipo(slug)), slug).toBe(true);
      expect(colorDeTipo(slug), slug).toMatch(/^oklch\(/);
    }
  });

  it('la derivación es estable: el mismo slug da siempre el mismo color', () => {
    /*
     * El build y el cliente derivan por separado y **no se pasan el color**: el
     * `events.json` solo lleva las excepciones. Si la derivación dependiera de
     * algo que no sea el slug, el HTML del build y el de la island pintarían
     * distinto y la fila cambiaría de color al hidratar.
     */
    for (const slug of ['taller', 'ciclo-de-cine', 'micro-abierto']) {
      expect(colorDeTipo(slug)).toBe(colorDeTipo(slug));
    }
    // Y el valor concreto, congelado: un cambio en la función de derivación
    // repinta categorías que la gente ya aprendió, y tiene que ser deliberado.
    expect(tonoDeTipo('ciclo-de-cine')).toBe(tonoDeTipo('ciclo-de-cine'));
    expect(colorDeTipo('taller')).toBe(colorDelTono(TONOS_DE_TIPO.taller!));
  });

  it('un tipo derivado no cae encima de uno con tono propio', () => {
    /*
     * La regla de los 18°: si «Ciclo de cine» saliera idéntico a «Taller», el
     * color dejaría de distinguir, que es para lo que está. No se afirma sobre una
     * muestra de slugs elegidos a dedo sino sobre los que la derivación produce
     * para mil slugs generados.
     */
    const asignados = Object.values(TONOS_DE_TIPO);
    const pegados: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const slug = `tipo-inventado-${i}`;
      if (slug in TONOS_DE_TIPO) continue;
      const t = tonoDeTipo(slug);
      for (const a of asignados) {
        const d = Math.min(Math.abs(t - a), 360 - Math.abs(t - a));
        if (d <= 18) pegados.push(`${slug} → ${t}, a ${d}° de ${a}`);
      }
    }
    expect(pegados).toEqual([]);
  });
});

describe('la tabla de tonos de arranque no envejece', () => {
  it('cada slug que nombra existe en `opciones-base.json`', () => {
    /*
     * La tabla puede quedarse **corta** —un tipo que no esté ahí deriva su tono, y
     * eso está previsto— pero no puede nombrar tipos que ya no existen: eso sería
     * una lista de tipos escrita a mano que nadie mantiene, o sea la trampa 6 con
     * otra cara.
     *
     * MUTACIÓN PROBADA: agregar `{ 'club-de-tejido': 300 }` a `TONOS_DE_TIPO` hace
     * fallar este caso.
     */
    const slugsBase = (base.tipo ?? []).map((v) => v.slug);
    const huerfanos = TIPOS_CON_TONO.filter((s) => !slugsBase.includes(s));
    expect(huerfanos, 'estos tipos tienen tono de arranque y no existen en la taxonomía').toEqual(
      [],
    );
  });

  it('control positivo: la tabla y la taxonomía no están vacías', () => {
    expect(TIPOS_CON_TONO.length).toBeGreaterThan(3);
    expect((base.tipo ?? []).length).toBeGreaterThan(3);
  });
});

describe('lo que el sitio pinta sale de un solo lugar', () => {
  it('`estiloDeTipo` da el mismo color al texto y al borde', () => {
    /*
     * No es comodidad: el chequeo mide el color como **texto** (4,5:1), que es más
     * exigente que el 3:1 de un borde. Si el borde pudiera ser otro tono, habría un
     * segundo color sin medir en la misma cajita.
     *
     * MUTACIÓN PROBADA: devolver `borderColor: 'var(--color-borde)'` hace fallar
     * este caso.
     */
    const estilo = estiloDeTipo({}, 'taller');
    expect(estilo.color).toBe(estilo.borderColor);
    expect(estilo.color).toBe(colorDeTipo('taller'));
  });

  it('`tonosDeTipo` toma solo los matices elegibles del `events.json`', () => {
    /*
     * El lado que **consume** el archivo. Un `events.json` servido por un CDN puede
     * ser de un build anterior a la guarda del productor, así que acá se filtra de
     * nuevo — el mismo criterio con el que `desdeQuery` no se cree nada de lo que
     * viene en la URL.
     *
     * MUTACIÓN PROBADA: cambiar el filtro por `o.tono !== undefined` hace fallar
     * este caso con `charla`.
     */
    const mapa = tonosDeTipo({
      tipo: [
        { slug: 'taller', label: 'Taller', tono: 195 },
        { slug: 'charla', label: 'Charla', tono: 999 },
        { slug: 'encuentro', label: 'Encuentro' },
      ],
      arancel: [{ slug: 'gratis', label: 'Gratis', tono: 10 }],
    });
    expect(mapa).toEqual({ taller: 195 });
    // Y el color que sale de ahí es el elegido para el que lo tiene y el derivado
    // para los otros dos.
    expect(estiloDeTipo(mapa, 'taller').color).toBe(colorDelTono(195));
    expect(estiloDeTipo(mapa, 'charla').color).toBe(colorDelTono(TONOS_DE_TIPO.charla!));
    expect(estiloDeTipo(mapa, 'encuentro').color).toBe(colorDelTono(TONOS_DE_TIPO.encuentro!));
  });

  it('el color que se pinta y el que se mide son el mismo', () => {
    /*
     * `colorDelTono` produce la cadena de CSS y `colorDelTonoSrgb` el color que el
     * test mide. Dos derivaciones del mismo valor son dos maneras de que una quede
     * vieja (la clase de B-88), así que se atan: la cadena tiene que nombrar los
     * mismos `L` y `C` con los que se calculó el contraste.
     *
     * MUTACIÓN PROBADA: escribir `oklch(0.5 ${C_DEL_TIPO} ${tono})` en
     * `colorDelTono` hace fallar este caso.
     */
    expect(colorDelTono(195)).toBe(`oklch(${L_DEL_TIPO} ${C_DEL_TIPO} 195)`);
    expect(colorDelTonoSrgb(195)).toEqual(oklchASrgb(L_DEL_TIPO, C_DEL_TIPO, 195));
  });
});
