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
  contrasteCaladoDelTono,
  contrasteDelTono,
  esTonoElegible,
  revisarTono,
  tonoDeTipo,
  tonoLegible,
} from '@/lib/identidad';
import { detalleDeActividad } from '@/lib/detallePublico';
import { estiloDeTipo, tonosDeTipo, type TonosDeTipo } from '@/lib/listadoPublico';
import baseCruda from '@/lib/opciones-base.json';
import { toPublic } from '@/lib/toPublic';
import { TIPOS_ACTIVIDAD, type TipoActividad, type ValorOpcion } from '@/types/actividad';
import { actividadDePrueba } from './fixtures/indice';

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

/**
 * La **otra** dirección de la misma tinta — B-273 (D-153).
 *
 * En el listado la cajita del tipo es **el color como texto** sobre el papel; en
 * la cabecera del detalle es tinta plena con **el papel calado encima**. Son dos
 * pares de contraste distintos y el sistema visual los tabula por separado
 * (`docs/referencias/sistema-visual.md`), justamente porque un color puede pasar
 * en uno y no en el otro.
 *
 * Lo que el bloque de arriba garantiza es el primero. Éste es el segundo, y se
 * recorre sobre los mismos **360** por el mismo motivo: el matiz de un tipo que
 * todavía no existe lo va a decidir un slug que todavía no existe.
 */
describe('los 360 tonos sostienen el papel calado encima — B-273 (D-153)', () => {
  const PAPEL = srgb(tokenDeCss('papel'));

  it('el papel del cálculo es el token de la hoja, no un blanco cualquiera', () => {
    /*
     * Control de anclaje. El papel del sitio **no es blanco puro** (`#fbf9f4`), y
     * medir contra `#ffffff` daría siempre un número un poco mejor que el real.
     * `contrasteCaladoDelTono` usa la copia de `SUPERFICIES`, que el primer
     * describe de este archivo ata a `global.css`; acá se cierra el círculo
     * comparando el resultado contra el token leído de la hoja.
     *
     * MUTACIÓN PROBADA: hacer que `contrasteCaladoDelTono` mida contra
     * `oklchASrgb(1, 0, 0)` —blanco puro— hace fallar este caso en varios tonos.
     */
    for (const t of [0, 90, 191, 250, 359]) {
      expect(contrasteCaladoDelTono(t), `tono ${t}`).toBeCloseTo(
        contraste(PAPEL, colorDelTonoSrgb(t)),
        10,
      );
    }
  });

  it('ninguno de los 360 deja el texto calado por debajo del piso', () => {
    /*
     * El caso que B-273 necesitaba y no existía: hasta acá la cajita del detalle
     * iba en `azul`, una tinta fija y ya medida (6,14:1 calado, en la tabla del
     * sistema visual). Con el color de la categoría el par pasa a depender del
     * matiz, o sea de algo que se elige desde Opciones y que mañana puede derivar
     * de un slug nuevo.
     *
     * MUTACIÓN PROBADA: subir `L_DEL_TIPO` de 0,42 a **0,55** deja **112 de los
     * 360** por debajo de 4,5 —el peor, el 192, en 4,31:1— y este caso los
     * enumera. Con **0,53** todavía pasan los 360, así que la mutación localiza el
     * borde y no es un «cualquier cambio lo rompe».
     *
     * Lo que este caso **no** hace es fallar solo: la dirección de texto es más
     * estricta (ya se cae en L=0,50), así que una banda aflojada la pone en rojo
     * primero. Su valor propio es otro y está en los dos casos de al lado — que el
     * par medido sea el de la pantalla, y cuánto margen tiene *este* par, que el
     * otro caso no puede decir.
     */
    const flojos = TONOS.map((t) => ({ t, ratio: contrasteCaladoDelTono(t) }))
      .filter((x) => x.ratio < AA_TEXTO)
      .map((x) => `tono ${x.t}: ${x.ratio.toFixed(2)}:1 con el papel encima`);

    expect(
      flojos,
      `estos tonos no llegan a ${AA_TEXTO}:1 con el papel calado encima (la cabecera ` +
        'del detalle). La banda (L y C de `identidad.ts`) es lo que hay que bajar.',
    ).toEqual([]);
  });

  it('el margen del peor se mide, y hoy es más cómodo que el del listado', () => {
    /*
     * El número, escrito: el peor de los 360 calado es el **tono 191** con
     * **7,27:1**. Es mejor que el 5,90:1 de la dirección de texto y mejor que el
     * 6,14:1 que daba el `azul` fijo que había antes, así que el cambio de B-273
     * no gasta contraste: lo gana.
     *
     * Se afirma un piso holgado y no el número exacto, como el caso gemelo de
     * arriba, para no tener que tocar el test por una centésima de la conversión.
     *
     * MUTACIÓN PROBADA: `L_DEL_TIPO = 0,50` deja el peor calado en **5,25:1** —o
     * sea que el caso del piso de arriba sigue en verde, los 360 pasan— y **éste**
     * se pone rojo. Es la mutación que separa «pasa» de «pasa con margen», que es
     * la lección de los `*-container` del sistema visual.
     */
    const peor = Math.min(...TONOS.map(contrasteCaladoDelTono));
    expect(peor).toBeGreaterThan(7);
  });

  it('el calado nunca puede ser el par que falla primero, y por eso `revisarTono` alcanza', () => {
    /*
     * `revisarTono` mide **solo** la dirección de texto, y no es un olvido: no
     * puede existir un tono que pase esa y falle ésta.
     *
     * El motivo es de construcción y no de medición. `contrasteDelTono` es el
     * **mínimo** contra las tres superficies, y `papel` es una de las tres; el
     * calado es el contraste contra `papel` a secas. Un mínimo de un conjunto
     * nunca es mayor que uno de sus elementos, así que `calado ≥ texto` para
     * cualquier color, cualquier `L` y cualquier `C`. Verificarlo con números
     * sería un caso que no puede fallar.
     *
     * Lo que **sí** se puede romper es la premisa: que el papel esté entre las
     * superficies que el mínimo recorre. Eso es lo que este caso fija.
     *
     * MUTACIÓN PROBADA: sacar la entrada `papel` de `SUPERFICIES` deja el archivo
     * entero en rojo antes de correr un caso —`identidad.ts` no llega a cargar,
     * porque busca el papel por nombre y no lo encuentra— con el mensaje apuntando
     * a la línea. Es más ruidoso que un caso rojo y está bien que lo sea: sin
     * papel entre las superficies, `revisarTono` deja de cubrir el calado y no hay
     * un color «casi» correcto que salvar.
     *
     * Este caso queda igual, para las dos mutaciones más silenciosas: renombrar la
     * entrada (`'papel-claro'`) o reordenar la lista y volver a tomar el primero
     * por índice.
     */
    expect(SUPERFICIES.map((s) => s.nombre)).toContain('papel');
    expect(
      SUPERFICIES.map(({ oklch }) => srgb(oklch)),
      'el papel del calado tiene que ser una de las superficies del mínimo',
    ).toContainEqual(PAPEL);
  });

  it('el detector distingue: un color claro no sostiene el papel calado', () => {
    /*
     * Control negativo, el gemelo del que ya tiene la dirección de texto: los
     * asertos de arriba afirman listas vacías, y una lista vacía es también lo que
     * devuelve un cálculo que no calcula. Un ocre claro —el fondo sobre el que
     * nadie calaría texto blanco— tiene que dar por debajo del piso.
     */
    expect(contraste(PAPEL, oklchASrgb(0.85, 0.12, 85))).toBeLessThan(AA_TEXTO);
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

describe('`revisarTono` — la guarda de lo que se guarda', () => {
  it('deja pasar cualquier matiz de la banda, y los doce del selector', () => {
    /*
     * Control positivo. Los casos de abajo afirman que la guarda **rechaza**, y
     * una guarda que rechaza todo también los pasaría.
     */
    for (const t of [0, 25, 180, 359]) expect(revisarTono(t), `tono ${t}`).toBeNull();
    for (const { tono, nombre } of TINTAS_DE_TIPO) expect(revisarTono(tono), nombre).toBeNull();
  });

  it('rechaza lo que no es un matiz, y dice por qué', () => {
    for (const malo of [999, -1, 12.5, Number.NaN, '180', null, undefined, {}]) {
      const motivo = revisarTono(malo);
      expect(motivo, JSON.stringify(malo) ?? 'undefined').not.toBeNull();
      expect(motivo).toContain('entero de 0 a 359');
    }
  });

  it('rechaza un color que no llega al piso, y el mensaje lleva el ratio y el piso', () => {
    /*
     * **El caso que la banda vuelve inalcanzable, y por eso el piso es un
     * parámetro** (ver el docblock de `revisarTono`). Con la banda de hoy ningún
     * matiz elegible baja de 5,90:1, así que sin subir el piso este camino no se
     * puede recorrer y sacarle el `throw` a `pintarOpcion` no rompería nada.
     *
     * Con el piso en 8 —arriba de lo que la banda puede dar— la guarda tiene que
     * disparar sobre el mismo cálculo y el mismo texto que usa en producción. Y
     * el mensaje tiene que **nombrar los dos números**: cuatro centésimas no se
     * ven (B-235), así que «no se puede» sin el ratio no explica nada.
     *
     * MUTACIÓN PROBADA: cambiar `ratio < piso` por `ratio < 0` —o sea, dejar
     * pasar cualquier color— hace fallar este caso; devolver un mensaje sin el
     * `toFixed(2)` hace fallar el aserto del ratio.
     */
    const motivo = revisarTono(195, 8);
    expect(motivo).not.toBeNull();
    expect(motivo).toContain('5.91:1');
    expect(motivo).toContain('8:1');
  });

  it('el piso responde al parámetro, y el de texto es el que la banda tiene que pasar', () => {
    /*
     * Que el piso sea de verdad el que se pasa, y no un número escrito adentro:
     * apenas por encima del peor de la banda rechaza, exactamente en él acepta.
     */
    expect(PISO_DEL_TIPO).toBe(AA_TEXTO);
    const peor = Math.min(...TONOS.map(contrasteDelTono));
    expect(revisarTono(195, peor + 0.01)).not.toBeNull();
    expect(revisarTono(195, peor)).toBeNull();
  });

  it('y el default del parámetro es el piso de texto, afirmado sobre el fuente', () => {
    /*
     * ── Por qué este se afirma leyendo el código y no ejecutándolo ────────
     * Porque **no se puede ejecutar**: los 360 matices de la banda están arriba
     * de 5,90:1, o sea arriba tanto del 4,5 de texto como del 3 de un borde. Bajar
     * el default a 3 no cambia el resultado de ninguna llamada posible, así que
     * un test de comportamiento lo dejaría pasar — y lo dejó: la mutación se
     * escapó, y por eso este caso existe.
     *
     * Lo que está en juego no es hoy sino el día que la banda se afloje: con el
     * piso en 3 la guarda aceptaría un color que no se lee, y la cajita del tipo
     * es texto de 11px, no un borde.
     *
     * MUTACIÓN PROBADA: cambiar el default a `3` hace fallar este caso.
     */
    const src = readFileSync(raiz('src/lib/identidad.ts'), 'utf8');
    expect(src).toContain('revisarTono = (tono: unknown, piso: number = PISO_DEL_TIPO)');
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

  it('un slug que choca con una clave del prototipo deriva, no hereda', () => {
    /*
     * Lo encontró el `auditor-privacidad`. `TONOS_DE_TIPO` es un objeto literal,
     * así que `TONOS_DE_TIPO['constructor']` devuelve la función `Object` heredada
     * del prototipo: **no es nullish**, así que un `??` no la ataja, y el color
     * salía `oklch(0.42 0.105 function Object() { [native code] })`.
     *
     * No es una inyección —React escapa el atributo y el CSS inválido se
     * descarta— pero rompía la garantía que este módulo promete en su encabezado:
     * que lo que no sea elegible se cae al derivado.
     *
     * MUTACIÓN PROBADA: volver a `TONOS_DE_TIPO[slug] ?? tonoDerivado(slug)` hace
     * fallar este caso con `constructor`.
     */
    for (const slug of ['constructor', 'hasownproperty', 'proto', '__proto__']) {
      const tono = tonoDeTipo(slug);
      expect(esTonoElegible(tono), slug).toBe(true);
      expect(colorDeTipo(slug), slug).toMatch(/^oklch\(0\.42 0\.105 \d+\)$/);
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

  it('el detalle y el listado pintan la categoría con el mismo color — B-273', () => {
    /*
     * **El caso que B-273 no tenía.** La cajita del listado y la de la cabecera
     * del detalle son la misma pieza para quien navega, y hasta este cambio eran
     * dos derivaciones distintas: una llamaba a `estiloDeTipo` y la otra escribía
     * `bg-azul` a mano. El síntoma no lo veía ningún test —las dos pantallas se
     * verifican por separado— y sí lo veía cualquiera que tocara una fila.
     *
     * Se comparan los dos valores producidos, no las dos funciones: es lo que
     * sigue siendo cierto el día que alguna de las dos cambie de forma.
     *
     * MUTACIÓN PROBADA: devolverle a `detalleDeActividad` un `tipoColor:
     * 'var(--color-azul)'` fijo hace fallar este caso en los cinco tipos; hacer
     * que ignore `tonos` —`colorDeTipo(a.tipo)` a secas, que es el bug con otra
     * cara— lo hace fallar solo en el bloque del matiz elegido, que es justo el
     * que existe para eso.
     */
    const AHORA = new Date('2026-09-01T12:00:00Z');
    const detalleCon = (tipo: TipoActividad, tonos: TonosDeTipo) =>
      detalleDeActividad(toPublic(actividadDePrueba({ tipo }), 'act_1'), {}, AHORA, tonos);

    // 1 · sin nada elegido: los dos derivan, y derivan igual.
    for (const tipo of TIPOS_ACTIVIDAD) {
      expect(detalleCon(tipo, {}).tipoColor, tipo).toBe(estiloDeTipo({}, tipo).color);
    }

    /*
     * 2 · con un matiz elegido. Es la mitad que importa: sin `tonos`, el detalle
     * derivaría del slug mientras el listado usa lo elegido, y el salto de color
     * volvería **solo para los tipos que alguien pintó a mano** — o sea invisible
     * hasta que se usa la pantalla de Opciones, que es para lo que existe.
     */
    const elegidos: TonosDeTipo = { taller: 195 };
    expect(detalleCon('taller', elegidos).tipoColor).toBe(estiloDeTipo(elegidos, 'taller').color);
    expect(detalleCon('taller', elegidos).tipoColor).toBe(colorDelTono(195));
    // Y un tipo que no está en el mapa sigue derivando, en las dos pantallas.
    expect(detalleCon('charla', elegidos).tipoColor).toBe(estiloDeTipo(elegidos, 'charla').color);

    /*
     * 3 · un tipo creado desde «Otro», que es el modo de falla que D-150 persigue.
     * El cast es deliberado: `TipoActividad` enumera los cinco del día uno, pero
     * `tipo` es taxonomía autogestionada y en `/opciones/tipo` hay más (`feria`,
     * `libreria-a-la-calle`) y mañana habrá otro.
     */
    const inventado = 'ciclo-de-cine' as TipoActividad;
    expect(detalleCon(inventado, {}).tipoColor).toBe(estiloDeTipo({}, inventado).color);
    expect(detalleCon(inventado, {}).tipoColor).toMatch(/^oklch\(/);
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
