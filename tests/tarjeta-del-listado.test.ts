import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';
import { TIPOS_CON_TONO, colorDeTipoSrgb } from '@/lib/identidad';

/**
 * El markup de la grilla del listado: contraste y accesibilidad — B-247.
 *
 * ── Por qué no alcanza con `tests/contraste-del-sitio.test.ts` ────────────
 * Aquél barre `src/pages` y `src/components/sitio`, mide **solo** `text-tinta/NN`
 * y lo mide **solo sobre `papel`**. Su propio docblock lo dice: «lo que NO puede
 * ver: texto sobre un fondo que no sea `papel`». La grilla de B-247 es
 * exactamente eso y por partida triple:
 *
 * 1. vive en `src/components/publico/*.tsx`, que aquel barrido no lee;
 * 2. la tarjeta es `bg-crema` y los chips `bg-hondo`, que son más oscuros que el
 *    papel — `text-tinta/65` da 5,26:1 sobre papel y **5,04:1 sobre `hondo`**, así
 *    que el margen que allá sobraba acá casi no existe;
 * 3. y la portada generada pinta texto **encima del color del tipo**, que no es
 *    ningún token: es un `oklch` que `colorDeTipo` deriva del slug y que para un
 *    tipo que todavía no existe nadie va a mirar nunca.
 *
 * ── Las dos mitades de este archivo ───────────────────────────────────────
 * **Una regla de clase** —qué atenuaciones se permiten y contra qué superficie se
 * miden— y **una lista de los pares que el arte declara**, medidos uno por uno.
 * La lista podría envejecer, así que cada par afirma además que su clase sigue
 * estando en el archivo que dice: un par que se deja de usar rompe el test en vez
 * de quedar dando cobertura de mentira.
 *
 * Los colores salen de `global.css`, no se copian acá: si mañana se aclara la
 * tinta o se oscurece el papel, el chequeo se entera. Es lo mismo que hace B-235
 * y por el mismo motivo.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const css = readFileSync(raiz('src/styles/global.css'), 'utf8');

/** Un token de la paleta, leído de la hoja de estilos. */
const token = (nombre: string): Srgb => {
  const m = css.match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
};

const PAPEL = token('papel');
const CREMA = token('crema');
const HONDO = token('hondo');
const TINTA = token('tinta');
const ACENTO = token('acento');
const ACENTO_HONDO = token('acento-hondo');

/** Los componentes del listado público. */
const archivos = (): string[] =>
  execFileSync('git', ['ls-files', 'src/components/publico'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.tsx'));

/**
 * El fuente **sin comentarios**.
 *
 * Los docblocks de estos componentes explican justamente por qué el chip elegido
 * ya no es `bg-acento/10 text-acento`, así que un barrido sobre el texto crudo
 * fallaría contra su propia documentación — y la salida fácil sería dejar de
 * explicarlo. Es el mismo recorte que hacen `tests/pagina-de-detalle.test.ts` y
 * `tests/autoguardado.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fuentes = (): { archivo: string; codigo: string }[] =>
  archivos().map((f) => ({ archivo: f, codigo: sinComentarios(readFileSync(raiz(f), 'utf8')) }));

// ───────────────────────────────────────────────────────────────────────────
// 1 · La regla de clase: qué se puede atenuar, y contra qué se mide
// ───────────────────────────────────────────────────────────────────────────

/** Cada `text-<token>/<NN>` del markup, con su archivo y su línea. */
const atenuaciones = (): { donde: string; clase: string; token: string; opacidad: number }[] => {
  const out: { donde: string; clase: string; token: string; opacidad: number }[] = [];
  for (const { archivo, codigo } of fuentes()) {
    codigo.split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(/text-([a-z-]+)\/(\d{1,3})/g)) {
        out.push({
          donde: `${archivo}:${i + 1}`,
          clase: m[0]!,
          token: m[1]!,
          opacidad: Number(m[2]) / 100,
        });
      }
    });
  }
  return out;
};

describe('el contraste de la grilla del listado — B-247', () => {
  it('control positivo: el barrido lee los componentes y encuentra atenuaciones', () => {
    // El test de abajo afirma que una lista está vacía, y una lista vacía es
    // también lo que devuelve un barrido que no leyó nada.
    expect(archivos().length).toBeGreaterThanOrEqual(4);
    expect(atenuaciones().length).toBeGreaterThan(5);
  });

  it('la paleta sale de global.css y el cálculo la reconoce', () => {
    expect(contraste(TINTA, PAPEL)).toBeGreaterThan(10);
    // Los tres niveles de superficie son distintos y van de claro a oscuro: si
    // dos se parsearan al mismo valor, medir «contra la más oscura» no mediría
    // nada.
    expect(contraste(TINTA, PAPEL)).toBeGreaterThan(contraste(TINTA, CREMA));
    expect(contraste(TINTA, CREMA)).toBeGreaterThan(contraste(TINTA, HONDO));
  });

  it('la única atenuación permitida es la de la tinta', () => {
    /*
     * El acento y el papel se usan encima de fondos que **no son de la paleta**:
     * el papel va sobre el color del tipo, y el acento sobre el papel de una
     * píldora. La garantía de contraste de los dos está afirmada para el color
     * opaco (`identidad.ts` la prueba sobre los 360 tonos posibles), y una
     * atenuación la rompe para un tono que todavía no existe — sin que nadie
     * pueda mirarlo, porque el tipo que lo va a usar lo crea quien carga desde
     * «Otro» (§4).
     *
     * Así que la regla es de clase y no una medición caso por caso: `tinta` se
     * puede atenuar, todo lo demás va opaco.
     */
    const prohibidas = atenuaciones()
      .filter((a) => a.token !== 'tinta')
      .map((a) => `${a.donde} — ${a.clase}`);

    expect(
      prohibidas,
      'solo `text-tinta/NN` puede atenuarse en el listado. El acento y el papel ' +
        'se usan sobre fondos que no son de la paleta y su contraste está ' +
        'garantizado para el color opaco; atenuarlos rompe esa garantía en silencio.',
    ).toEqual([]);
  });

  it('ninguna atenuación de tinta queda por debajo de AA sobre la superficie más oscura', () => {
    /*
     * Se mide contra `hondo` —la superficie más oscura del sitio— y no contra el
     * fondo real de cada línea. Es a propósito: pide de más en un texto que está
     * sobre `papel`, y a cambio no hay que mantener un mapa de «qué clase vive
     * sobre qué fondo», que es lo que se desactualiza cuando alguien mueve un
     * `<span>` de la tarjeta al chip.
     */
    const flojas = atenuaciones()
      .filter((a) => a.token === 'tinta')
      .map((a) => ({ ...a, ratio: contraste(mezclar(TINTA, HONDO, a.opacidad), HONDO) }))
      .filter((a) => a.ratio < AA_TEXTO)
      .map((a) => `${a.donde} — ${a.clase} da ${a.ratio.toFixed(2)}:1 sobre hondo`);

    expect(
      flojas,
      `estas atenuaciones no llegan a ${AA_TEXTO}:1 sobre la superficie más ` +
        'oscura del sitio. Sobre `papel` el mismo valor da más, pero la tarjeta ' +
        'es `crema` y los chips son `hondo`: subí la opacidad.',
    ).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Los pares que el arte declara, medidos uno por uno
// ───────────────────────────────────────────────────────────────────────────

/**
 * Cada combinación de color sobre color que el listado pinta, con dónde vive.
 *
 * `clase` no es decorativa: se busca en el archivo, así que un par que se dejó de
 * usar **falla** en vez de quedar dando cobertura de una combinación que ya no
 * existe.
 */
const PARES: {
  que: string;
  archivo: string;
  clase: RegExp;
  frente: Srgb;
  fondo: Srgb;
}[] = [
  {
    que: 'la píldora del tipo sobre la portada generada (papel sobre papel-tinta)',
    archivo: 'src/components/publico/PortadaDeTarjeta.tsx',
    clase: /bg-papel text-tinta/,
    frente: TINTA,
    fondo: PAPEL,
  },
  {
    que: 'la píldora «Destacada»',
    archivo: 'src/components/publico/PortadaDeTarjeta.tsx',
    clase: /bg-papel text-acento(?![-\w/])/,
    frente: ACENTO,
    fondo: PAPEL,
  },
  {
    que: 'el chip elegido, lleno con el acento',
    archivo: 'src/components/publico/GrupoDeChips.tsx',
    clase: /bg-acento(?![-\w/]) font-medium text-papel/,
    frente: PAPEL,
    fondo: ACENTO,
  },
  {
    que: 'la fecha y el arancel de la tarjeta, sobre la superficie de la tarjeta',
    archivo: 'src/components/publico/Tarjeta.tsx',
    clase: /text-acento-hondo/,
    frente: ACENTO_HONDO,
    fondo: CREMA,
  },
  {
    que: 'el título de la tarjeta, sobre la superficie de la tarjeta',
    archivo: 'src/components/publico/Tarjeta.tsx',
    clase: /text-tinta(?![-\w/])/,
    frente: TINTA,
    fondo: CREMA,
  },
  {
    que: 'los botones llenos del buscador',
    archivo: 'src/components/publico/Buscador.tsx',
    clase: /bg-acento(?![-\w/]) text-papel/,
    frente: PAPEL,
    fondo: ACENTO,
  },
  {
    que: 'el contador del botón «Filtros», papel sobre el botón lleno',
    archivo: 'src/components/publico/Buscador.tsx',
    clase: /bg-papel px-1\.5 text-xs font-semibold text-acento-hondo/,
    frente: ACENTO_HONDO,
    fondo: PAPEL,
  },
];

describe('los pares de color que el listado pinta encima de algo que no es papel', () => {
  it('todos pasan AA', () => {
    const flojos = PARES.filter((p) => contraste(p.frente, p.fondo) < AA_TEXTO).map(
      (p) => `${p.que} — ${contraste(p.frente, p.fondo).toFixed(2)}:1`,
    );
    expect(flojos).toEqual([]);
  });

  it('y cada par sigue estando en el markup que dice', () => {
    /*
     * Sin esto la lista de arriba envejece sin que nada lo diga: se cambia el
     * chip elegido a otra combinación, el par viejo sigue midiendo 5,59:1 y el
     * test sigue verde midiendo algo que la pantalla ya no muestra.
     */
    const perdidos = PARES.filter(
      (p) => !p.clase.test(sinComentarios(readFileSync(raiz(p.archivo), 'utf8'))),
    ).map((p) => `${p.que} — ya no está en ${p.archivo}`);
    expect(perdidos).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · El texto de la portada generada, sobre CUALQUIER color de tipo
// ───────────────────────────────────────────────────────────────────────────

describe('la portada generada — el texto sobre el color del tipo', () => {
  /**
   * Los slugs con los que se prueba: los tipos de hoy **y** doscientos inventados.
   *
   * Verificar los siete de hoy dejaría la garantía en «los que ya vimos», y el
   * octavo tipo lo crea quien carga desde «Otro» (§4). `identidad.ts` prueba la
   * banda de luminosidad sobre los 360 tonos; acá se prueba **la función que el
   * componente llama de verdad**, con slugs que pasan por la derivación entera.
   */
  const slugs = [
    ...TIPOS_CON_TONO,
    ...Array.from({ length: 200 }, (_, i) => `tipo-inventado-${i}`),
    'microrrelato-en-voz-alta',
    'feria-de-fanzines-2027',
    'a',
    'club',
  ];

  it('el papel opaco pasa AA sobre el color de cualquier tipo, inventado o no', () => {
    const flojos = slugs
      .map((s) => ({ s, ratio: contraste(PAPEL, colorDeTipoSrgb(s)) }))
      .filter((x) => x.ratio < AA_TEXTO)
      .map((x) => `${x.s}: ${x.ratio.toFixed(2)}:1`);

    expect(
      flojos,
      'la portada generada pone el título encima de este color. Como el tono de ' +
        'un tipo nuevo se deriva de su slug, esto no se arregla caso por caso: ' +
        'hay que bajar la luminosidad de la banda entera en `identidad.ts`.',
    ).toEqual([]);
  });

  it('y la portada pinta ese texto con el papel opaco, que es lo que se midió', () => {
    /*
     * **El aserto que une las dos mitades.** El número de arriba vale para el
     * papel opaco; si el componente escribiera `text-papel/80`, el número seguiría
     * siendo cierto y la pantalla, no. La regla de clase de la sección 1 ya
     * prohíbe atenuar el papel; esto afirma la otra mitad: que el texto de la
     * portada es de ese color y ese fondo, y no de otro.
     */
    const src = sinComentarios(
      readFileSync(raiz('src/components/publico/PortadaDeTarjeta.tsx'), 'utf8'),
    );
    expect(src).toMatch(/text-papel(?![-\w/])/);
    expect(src, 'el fondo de la portada tiene que salir de `colorDeTipo`').toContain('colorDeTipo');
    // Y ningún color escrito a mano: una tabla de tonos queda vieja el día que
    // alguien crea el octavo tipo, en silencio (D-141).
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/oklch\(/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Accesibilidad del markup
// ───────────────────────────────────────────────────────────────────────────

describe('la accesibilidad de la grilla', () => {
  it('la portada no aporta nombre accesible: el arte va `aria-hidden` y la foto con alt vacío', () => {
    /*
     * Las dos son decorativas por el mismo motivo: **no dicen nada que el texto
     * de la tarjeta no diga ya**. El nombre accesible del link sale del tipo, la
     * fecha, el título, el lugar y el arancel; un `alt` con el título lo repetiría,
     * y describir una foto que subió otra persona no se puede —no hay campo de
     * texto alternativo en el modelo—.
     */
    const src = sinComentarios(
      readFileSync(raiz('src/components/publico/PortadaDeTarjeta.tsx'), 'utf8'),
    );
    expect(src).toContain('aria-hidden="true"');
    expect(src, 'la foto de portada va con `alt=""`').toMatch(/alt=""/);
    // Y el tipo, que **no** es decorativo, queda fuera del arte: si la píldora se
    // metiera adentro del bloque `aria-hidden`, el tipo desaparecería del nombre
    // accesible de la tarjeta justo en las que no tienen foto.
    const arte = src.indexOf('aria-hidden="true"');
    expect(src.indexOf('{tipoLabel}'), 'la píldora del tipo va después del arte').toBeGreaterThan(
      arte,
    );
  });

  it('los chips son botones de alternancia de verdad, no divs con onClick', () => {
    const src = sinComentarios(
      readFileSync(raiz('src/components/publico/GrupoDeChips.tsx'), 'utf8'),
    );
    expect(src).toContain('aria-pressed={chip.elegido}');
    expect(src).toMatch(/<button/);
  });

  it('ningún div ni span lleva un onClick en todo el listado', () => {
    /*
     * §10 del diseño. Un `div` con `onClick` no recibe foco, no responde a Enter
     * ni a la barra espaciadora y no se anuncia como control. Es la clase, no la
     * instancia: el chequeo mira todos los componentes y no el que ya está bien.
     */
    const malos: string[] = [];
    for (const { archivo, codigo } of fuentes()) {
      for (const m of codigo.matchAll(/<(div|span|li|p)\b[^>]*\sonClick=/g)) {
        malos.push(`${archivo} — <${m[1]}> con onClick`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('nadie apaga el anillo de foco, y todo componente con botones lo declara', () => {
    const sinFoco: string[] = [];
    for (const { archivo, codigo } of fuentes()) {
      if (/outline-none/.test(codigo)) sinFoco.push(`${archivo} — apaga el outline`);
      if (/<button|<input|<select/.test(codigo) && !/focus-visible:outline-acento/.test(codigo)) {
        sinFoco.push(`${archivo} — tiene controles sin foco visible`);
      }
    }
    expect(sinFoco).toEqual([]);
  });

  it('el resultado del filtrado se anuncia en una live region', () => {
    // Quien usa lector de pantalla tiene que enterarse de que la lista cambió sin
    // ir a buscarla. `atomic` para que lea la frase entera y no solo el número.
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-atomic="true"');
  });

  it('el panel de filtros es un disclosure declarado, y devuelve el foco al cerrar', () => {
    /*
     * B-238 sigue abierto: la hoja inferior del §8 es una capa modal y una capa
     * modal mal hecha es peor que no tenerla. Lo que sí tiene que estar es lo que
     * un disclosure debe: `aria-expanded`, `aria-controls`, y —porque el botón de
     * cerrar está al final del panel— devolver el foco al abridor, si no el foco
     * se cae al `body`.
     */
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    expect(src).toContain('aria-expanded={abierto}');
    expect(src).toContain('aria-controls=');
    expect(src).toContain('botonFiltros.current?.focus()');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · La grilla
// ───────────────────────────────────────────────────────────────────────────

describe('la grilla', () => {
  const src = () =>
    sinComentarios(readFileSync(raiz('src/components/publico/ListaDeActividades.tsx'), 'utf8'));

  it('una sola columna en el teléfono, dos en tablet y tres en escritorio', () => {
    /*
     * §8 del diseño: «una columna siempre. Nada de grilla de dos tarjetas en
     * 375px». La mayoría entra desde un link de Instagram en un navegador
     * embebido, y dos tarjetas en 375px dejan la portada del tamaño de un sello.
     *
     * Es una decisión, no una preferencia de maquetación, así que se fija: sin
     * esto, «poné dos columnas que entran» se hace en una línea y nada lo dice.
     */
    const clases = src();
    expect(clases).toContain('grid-cols-1');
    expect(clases).toContain('sm:grid-cols-2');
    expect(clases).toContain('lg:grid-cols-3');
    // Y ninguna variante que meta dos columnas antes de `sm`.
    expect(clases).not.toMatch(/(?<!sm:|md:|lg:|xl:)grid-cols-[2-9]/);
  });

  it('hay una sola definición de las clases de la grilla', () => {
    // La grilla se usa dos veces —agrupada por mes y plana— y son la misma
    // grilla. Con la cadena escrita dos veces, cambiar una sola deja las dos
    // vistas del mismo listado con distinto ancho de tarjeta.
    const veces = (src().match(/grid-cols-1/g) ?? []).length;
    expect(veces, 'las clases de la grilla se escriben una sola vez').toBe(1);
  });
});
