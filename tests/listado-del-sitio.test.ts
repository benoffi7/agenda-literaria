import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';

/**
 * El markup del listado: contraste y accesibilidad — B-247, rehecho en B-260.
 *
 * ── Por qué no alcanza con `tests/contraste-del-sitio.test.ts` ────────────
 * Aquél barre `src/pages` y `src/components/sitio`, y **no lee
 * `src/components/publico/*.tsx`**, que es donde vive el listado entero. Además
 * mide sobre `papel`, y acá hay texto sobre las dos capas tonales y sobre tinta
 * plena.
 *
 * ── Qué cambió con el sistema visual (D-146) ──────────────────────────────
 * La regla de clase de B-247 era «solo `tinta` se puede atenuar». El sistema
 * visual la reemplaza por una **más fuerte y más simple**: no se atenúa nada.
 *
 * «Paleta limitada, como una impresión a tintas planas». Una opacidad es una
 * trama de medio tono: en una impresión a tintas planas no existe, y una trama
 * distinta por línea es exactamente lo contrario de lo que el sistema pide. Y de
 * paso cierra la clase de bug de B-235 de raíz — `text-tinta/60` da 4,49:1 contra
 * un piso de 4,5, cuatro centésimas que no se ven y se calculan. Si no hay
 * opacidades, no hay nada que calcular caso por caso.
 *
 * En su lugar hay **tintas con nombre**, y cada una tiene su contraste medido:
 * `tinta` 16,27 · `suave` 8,92 · `super` 6,34 · `acento` 6,33 · `azul` 6,14 sobre
 * el papel. Donde antes iba `text-tinta/70` ahora va `text-super`.
 *
 * ── Las partes de este archivo ────────────────────────────────────────────
 * 1. **La regla de clase** — qué tintas pueden ser texto, medidas contra la peor
 *    superficie sobre la que pueden caer, y ninguna opacidad.
 * 2. **Los pares que el arte declara** — cada texto calado sobre tinta plena,
 *    medido uno por uno, y con el aserto de que el par sigue existiendo en el
 *    markup que dice.
 * 3. **Que el listado no tenga imágenes**, que es la decisión de forma de D-146.
 * 4. **La accesibilidad del markup**, que el rediseño no puede haber perdido.
 * 5. **Qué campos de la entrada toca la fila.**
 * 6. **La grilla de 12 columnas y el marcador de mes.**
 *
 * Los colores salen de `global.css`, no se copian acá: si mañana se aclara una
 * tinta, el chequeo se entera. Es lo mismo que hace B-235 y por el mismo motivo.
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
const SUAVE = token('suave');
const ACENTO = token('acento');
const AZUL = token('azul');
const SUPER = token('super');

/**
 * Las dos tintas de **regla**. Están medidas y no llegan al piso de texto:
 * `borde` da 4,26:1 sobre el papel y `regla` 1,62:1 — la segunda ni siquiera
 * alcanza el 3:1 de un borde de control. Nunca pueden ser `text-*`.
 */
const TINTAS_DE_REGLA = ['borde', 'regla'];

/** Los componentes del listado público. */
const archivos = (): string[] =>
  execFileSync('git', ['ls-files', 'src/components/publico'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.tsx'));

/**
 * El fuente **sin comentarios**.
 *
 * Los docblocks de estos componentes explican justamente por qué el valor elegido
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
// 1 · La regla de clase: qué tintas pueden ser texto
// ───────────────────────────────────────────────────────────────────────────

/** Cada `text-<token>` del markup, con su archivo, su línea y su opacidad si la tiene. */
const tintasDeTexto = (): {
  donde: string;
  clase: string;
  token: string;
  opacidad: number | null;
}[] => {
  const out: { donde: string; clase: string; token: string; opacidad: number | null }[] = [];
  const tokens = 'papel|crema|hondo|tinta|suave|acento|azul|super|borde|regla';
  for (const { archivo, codigo } of fuentes()) {
    codigo.split('\n').forEach((linea, i) => {
      // Se buscan solo los tokens de color del `@theme`: `text-sm` y `text-end`
      // son tamaño y alineación, y no tienen nada que ver con el contraste.
      for (const m of linea.matchAll(new RegExp(`\\btext-(${tokens})(?:\\/(\\d{1,3}))?\\b`, 'g'))) {
        out.push({
          donde: `${archivo}:${i + 1}`,
          clase: m[0]!,
          token: m[1]!,
          opacidad: m[2] ? Number(m[2]) / 100 : null,
        });
      }
    });
  }
  return out;
};

/** Las tintas que pueden ir sobre una superficie de papel, con su color. */
const SOBRE_SUPERFICIE: Record<string, Srgb> = {
  tinta: TINTA,
  suave: SUAVE,
  acento: ACENTO,
  azul: AZUL,
  super: SUPER,
};

describe('el contraste del listado — B-247, B-260', () => {
  it('control positivo: el barrido lee los componentes y encuentra tintas', () => {
    // Los tests de abajo afirman que unas listas están vacías, y una lista vacía
    // es también lo que devuelve un barrido que no leyó nada.
    expect(archivos().length).toBeGreaterThanOrEqual(3);
    expect(tintasDeTexto().length).toBeGreaterThan(8);
  });

  it('la paleta sale de global.css y el cálculo la reconoce', () => {
    expect(contraste(TINTA, PAPEL)).toBeGreaterThan(10);
    // Las tres superficies son distintas y van de clara a oscura: si dos se
    // parsearan al mismo valor, medir «contra la más oscura» no mediría nada.
    expect(contraste(TINTA, PAPEL)).toBeGreaterThan(contraste(TINTA, CREMA));
    expect(contraste(TINTA, CREMA)).toBeGreaterThan(contraste(TINTA, HONDO));
  });

  it('ninguna tinta se atenúa con una opacidad', () => {
    /*
     * La regla nueva del sistema, y la más barata de sostener: no hay tramas de
     * medio tono. Donde hace falta un texto más liviano hay una **tinta** para
     * eso —`suave` (8,92) y `super` (6,34)—, las dos con su contraste medido y
     * ninguna dependiente de sobre qué fondo cae la línea.
     *
     * MUTACIÓN PROBADA: cambiar un `text-super` de `FilaDeActividad` por
     * `text-tinta/70` hace fallar este caso y solo éste.
     */
    const atenuadas = tintasDeTexto()
      .filter((t) => t.opacidad !== null)
      .map((t) => `${t.donde} — ${t.clase}`);

    expect(
      atenuadas,
      'el sistema visual es a tintas planas: una opacidad es una trama de medio ' +
        'tono. Usá la tinta que corresponde (`suave` o `super`), que ya está medida.',
    ).toEqual([]);
  });

  it('las dos tintas de regla nunca se usan como texto', () => {
    /*
     * La primera de las tres reglas que salieron de la medición: `outline` (4,26)
     * y `outline-variant` (1,62) son para reglas y bordes. La segunda ni siquiera
     * llega al 3:1 de un borde de control, así que como texto es ilegible — y
     * como se ve «suave y elegante», es exactamente la clase de cosa que se cuela.
     *
     * MUTACIÓN PROBADA: cambiar el `text-super` de la línea de metadatos por
     * `text-borde` hace fallar este caso.
     */
    const malas = tintasDeTexto()
      .filter((t) => TINTAS_DE_REGLA.includes(t.token))
      .map((t) => `${t.donde} — ${t.clase}`);

    expect(
      malas,
      '`borde` y `regla` son tintas de regla, no de texto: dan 4,26:1 y 1,62:1 ' +
        'sobre el papel, con el piso en 4,5.',
    ).toEqual([]);
  });

  it('toda tinta de texto pasa AA sobre la superficie más oscura del sitio', () => {
    /*
     * Se mide contra `hondo` —la capa tonal más honda— y no contra el fondo real
     * de cada línea. Es a propósito: pide de más en un texto que está sobre
     * `papel`, y a cambio no hay que mantener un mapa de «qué clase vive sobre qué
     * fondo», que es lo que se desactualiza cuando alguien mueve un `<span>` de
     * una fila al riel.
     *
     * `text-papel` no entra acá: el papel sobre una superficie de papel no es
     * texto, es texto invisible, y solo se usa **calado sobre tinta plena** — eso
     * lo cubre la sección 2, par por par.
     */
    const flojas = tintasDeTexto()
      .filter((t) => t.token in SOBRE_SUPERFICIE)
      .map((t) => ({ ...t, ratio: contraste(SOBRE_SUPERFICIE[t.token]!, HONDO) }))
      .filter((t) => t.ratio < AA_TEXTO)
      .map((t) => `${t.donde} — ${t.clase} da ${t.ratio.toFixed(2)}:1 sobre hondo`);

    expect(flojas).toEqual([]);
  });

  it('y el cálculo sabe fallar: una atenuación que no llega se detectaría', () => {
    /*
     * Control del control. Los casos de arriba afirman que unas listas están
     * vacías; esto verifica que la aritmética con la que se llenarían **sabe
     * fallar**, para que «vacío» signifique «pasó» y no «no midió».
     */
    expect(contraste(mezclar(TINTA, HONDO, 0.6), HONDO)).toBeLessThan(AA_TEXTO);
    expect(contraste(token('borde'), PAPEL)).toBeLessThan(AA_TEXTO);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Los pares que el arte declara: texto calado sobre tinta plena
// ───────────────────────────────────────────────────────────────────────────

/**
 * Cada combinación de tinta sobre tinta que el listado pinta, con dónde vive.
 *
 * `clase` no es decorativa: se busca en el archivo, así que un par que se dejó de
 * usar **falla** en vez de quedar dando cobertura de una combinación que ya no
 * existe.
 */
const PARES: { que: string; archivo: string; clase: RegExp; frente: Srgb; fondo: Srgb }[] = [
  {
    que: 'el bloque de fecha: papel calado sobre la terracota',
    archivo: 'src/components/sitio/estilos.ts',
    clase: /bg-acento(?![-\w/])[\s\S]{0,80}?text-papel/,
    frente: PAPEL,
    fondo: ACENTO,
  },
  {
    que: 'el bloque de fecha de una actividad que ya pasó, en la superposición',
    archivo: 'src/components/publico/FilaDeActividad.tsx',
    clase: /bg-super(?![-\w/])/,
    frente: PAPEL,
    fondo: SUPER,
  },
  {
    que: 'el valor de filtro elegido, con la tinta plena',
    archivo: 'src/components/publico/EjeDeFiltro.tsx',
    clase: /bg-acento(?![-\w/]) text-papel/,
    frente: PAPEL,
    fondo: ACENTO,
  },
  {
    que: 'el botón «Filtros» con filtros puestos',
    archivo: 'src/components/publico/Buscador.tsx',
    clase: /bg-acento(?![-\w/]) text-papel/,
    frente: PAPEL,
    fondo: ACENTO,
  },
  {
    que: 'el título de la fila sobre la capa tonal del hover',
    archivo: 'src/components/publico/FilaDeActividad.tsx',
    clase: /hover:bg-crema/,
    frente: TINTA,
    fondo: CREMA,
  },
  {
    que: 'el tipo de actividad en azul tinta, en su cajita con borde',
    archivo: 'src/components/publico/FilaDeActividad.tsx',
    clase: /border border-borde px-1\.5 py-1 text-azul/,
    frente: AZUL,
    fondo: PAPEL,
  },
];

describe('los pares de tinta sobre tinta que el listado pinta', () => {
  it('todos pasan AA', () => {
    const flojos = PARES.filter((p) => contraste(p.frente, p.fondo) < AA_TEXTO).map(
      (p) => `${p.que} — ${contraste(p.frente, p.fondo).toFixed(2)}:1`,
    );
    expect(flojos).toEqual([]);
  });

  it('y cada par sigue estando en el markup que dice', () => {
    /*
     * Sin esto la lista de arriba envejece sin que nada lo diga: se cambia el
     * valor elegido a otra combinación, el par viejo sigue midiendo 6,33:1 y el
     * test sigue verde midiendo algo que la pantalla ya no muestra.
     *
     * MUTACIÓN PROBADA: volver el valor elegido a `bg-acento/10 text-acento` —la
     * combinación de B-227, que daba 4,38:1 sobre la superficie hundida— hace
     * fallar este caso **y** el de las opacidades.
     */
    const perdidos = PARES.filter(
      (p) => !p.clase.test(sinComentarios(readFileSync(raiz(p.archivo), 'utf8'))),
    ).map((p) => `${p.que} — ya no está en ${p.archivo}`);
    expect(perdidos).toEqual([]);
  });

  it('el bloque de fecha se define una sola vez, y en `estilos.ts`', () => {
    /*
     * Lo pinta la fila del listado y lo pinta la ficha de la página de detalle. Es
     * el gesto central del sistema: dos definiciones son dos bloques de fecha
     * distintos para el mismo dato, que es la clase de B-88.
     */
    const estilos = readFileSync(raiz('src/components/sitio/estilos.ts'), 'utf8');
    expect(estilos).toContain('export const claseBloqueFecha');
    const fila = sinComentarios(
      readFileSync(raiz('src/components/publico/FilaDeActividad.tsx'), 'utf8'),
    );
    expect(fila).toContain('claseBloqueFecha');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · El listado no tiene imágenes — D-146
// ───────────────────────────────────────────────────────────────────────────

describe('el listado es puramente tipográfico', () => {
  it('ningún componente del listado pinta una imagen', () => {
    /*
     * Es **la** decisión de forma del rediseño: filas tipográficas, sin portada,
     * sin miniatura y sin portada generada. No es una omisión que haya que
     * recordar —«no le pusimos imagen todavía»— sino la decisión de D-146, así que
     * se fija: agregar una miniatura de 64px vuelve a la textura de plataforma que
     * el rediseño existe para sacar, y se hace en una línea.
     *
     * MUTACIÓN PROBADA: agregar un `<img src={entrada.imagenUrl} />` a la fila
     * hace fallar este caso **y** el de los campos que la fila lee.
     */
    const conImagen = fuentes()
      .filter((f) => /<img\b|background-image|backgroundImage/.test(f.codigo))
      .map((f) => f.archivo);
    expect(
      conImagen,
      'el listado no lleva imágenes (D-146). La portada solo existe en la página ' +
        'de detalle, y solo cuando la actividad tiene una foto de verdad.',
    ).toEqual([]);
  });

  it('y la portada generada ya no existe en ninguna parte', () => {
    // Se retiró con D-146: sin color por tipo no hay portada generada que pintar.
    const todos = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' });
    expect(todos).not.toContain('PortadaDeTarjeta');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Accesibilidad del markup
// ───────────────────────────────────────────────────────────────────────────

describe('la accesibilidad del listado', () => {
  it('los valores de filtro son botones de alternancia de verdad, no divs con onClick', () => {
    const src = sinComentarios(readFileSync(raiz('src/components/publico/EjeDeFiltro.tsx'), 'utf8'));
    expect(src).toContain('aria-pressed={chip.elegido}');
    expect(src).toMatch(/<button/);
  });

  it('el número de cada faceta no se lee como parte de su nombre', () => {
    /*
     * «Taller 12» suena a un taller número 12. El número va `aria-hidden` y al
     * lado hay un texto propio para lector de pantalla. Es la misma decisión de
     * B-227 y el restilado no puede haberla perdido.
     */
    const src = sinComentarios(readFileSync(raiz('src/components/publico/EjeDeFiltro.tsx'), 'utf8'));
    expect(src).toContain('aria-hidden="true"');
    expect(src).toMatch(/sr-only/);
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

  it('nadie apaga el anillo de foco, y todo componente con controles lo declara', () => {
    /*
     * **Vale el literal, el `foco` de `components/sitio/estilos.ts`, o una clase
     * de ese módulo que ya lo traiga adentro** — B-259. Una versión anterior pedía
     * la clase escrita, y eso ponía en rojo justamente al componente que hace lo
     * correcto: importar el anillo canónico en vez de repetirlo. Un chequeo que
     * castiga la deduplicación empuja a copiar.
     */
    const sinFoco: string[] = [];
    for (const { archivo, codigo } of fuentes()) {
      if (/outline-none/.test(codigo)) sinFoco.push(`${archivo} — apaga el outline`);
      if (!/<button|<input|<select/.test(codigo)) continue;

      const literal = /focus-visible:outline-acento/.test(codigo);
      const importado =
        /import \{[^}]*\bfoco\b[^}]*\} from '@\/components\/sitio\/estilos'/.test(codigo) &&
        /\$\{foco\}/.test(codigo);
      // `claseCampo`, `claseCasilla` y los dos botones ya traen el anillo adentro:
      // exigir además el `${foco}` suelto castigaría usarlas.
      const heredado = /clase(Campo|Casilla|BotonPrimario|BotonSecundario)/.test(codigo);

      if (!literal && !importado && !heredado) {
        sinFoco.push(`${archivo} — tiene controles sin foco visible`);
      }
    }
    expect(sinFoco).toEqual([]);
  });

  it('y ninguna interpolación del anillo quedó en un string que no interpola', () => {
    /*
     * El modo de falla que apareció al centralizar el anillo, y que ningún test
     * veía: `${foco}` adentro de `'…'` o de `className="…"` sale **literal** al
     * HTML. La clase no existe, Tailwind no genera nada, y el control se queda sin
     * foco sin que falle el build ni el typecheck. Se vio mirando el HTML.
     */
    const rotos: string[] = [];
    for (const { archivo, codigo } of fuentes()) {
      for (const linea of codigo.split('\n')) {
        if (!linea.includes('${foco}')) continue;
        if (!linea.includes('`')) rotos.push(`${archivo} — ${linea.trim().slice(0, 60)}`);
      }
    }
    expect(rotos).toEqual([]);
  });

  it('el resultado del filtrado se anuncia en una live region', () => {
    // Quien usa lector de pantalla tiene que enterarse de que la lista cambió sin
    // ir a buscarla. `atomic` para que lea la frase entera y no solo el número.
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-atomic="true"');
  });

  it('el panel de filtros del teléfono sigue siendo un disclosure declarado', () => {
    /*
     * En `lg` el riel muestra los ejes siempre y el disclosure no se usa, pero en
     * el teléfono sigue siendo el mismo de D-143 — y con lo que un disclosure
     * debe: `aria-expanded`, `aria-controls`, y devolver el foco al abridor,
     * porque el botón de cerrar está al final del panel y si no el foco se cae al
     * `body`.
     *
     * MUTACIÓN PROBADA: borrar la línea de `botonFiltros.current?.focus()` hace
     * fallar este caso.
     */
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    expect(src).toContain('aria-expanded={abierto}');
    expect(src).toContain('aria-controls=');
    expect(src).toContain('botonFiltros.current?.focus()');
  });

  it('los filtros son controles con estado, no los `<a href="#">` de la referencia', () => {
    /*
     * La referencia dibuja el índice de filtros con enlaces a `#`, o sea
     * decorativos. Los de verdad tienen multi-selección, conteo por faceta y
     * sincronización con la URL. El rediseño cambió **la piel**: esto fija que no
     * se haya llevado puesta la funcionalidad al hacerlo.
     */
    const eje = sinComentarios(readFileSync(raiz('src/components/publico/EjeDeFiltro.tsx'), 'utf8'));
    expect(eje, 'un filtro no puede ser un enlace a #').not.toMatch(/href=["'`]#/);
    expect(eje).toContain('onAlternar');

    const buscador = sinComentarios(
      readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'),
    );
    expect(buscador, 'los filtros se serializan a la URL').toContain('replaceState');
    expect(buscador, 'y se leen de vuelta').toContain('popstate');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Qué campos de la entrada puede tocar el componente
// ───────────────────────────────────────────────────────────────────────────

/**
 * Los campos de `EntradaDeIndice` que la fila lee **directo**.
 *
 * Todo lo demás lo decide `lib/tarjetaPublica.ts`, que es puro y está testeado.
 * Éstos cuatro quedan afuera porque no hay nada que decidir sobre ellos: un
 * `href`, un slug de taxonomía, un texto y una bandera.
 *
 * **`imagenUrl` salió de la lista con D-146**: el listado ya no tiene imágenes, y
 * dejarlo permitido sería dejar abierta justo la puerta por la que volvería.
 */
const CAMPOS_QUE_LA_FILA_LEE = ['slug', 'tipo', 'titulo', 'destacado'];

describe('la fila no lee de la entrada más de lo que necesita', () => {
  /*
   * Lo pidió el `auditor-privacidad`, y es la forma de D-140 aplicada a la otra
   * mitad de la salida 1. La página de detalle no puede publicar de más porque
   * recibe un view-model; la fila **sí** recibe la `EntradaDeIndice` entera, así
   * que la garantía no la da el tipo: la da esto.
   *
   * El daño está acotado —`EntradaDeIndice` ya es un recorte y no tiene la
   * dirección, ni el link de la reunión— pero sí tiene `searchText` (la
   * descripción entera, normalizada), `resumen` y `creadoEn`, que la fila no
   * muestra y que hoy nada impide imprimir.
   *
   * MUTACIÓN PROBADA: agregar `{entrada.searchText}` a la fila hace fallar esto.
   */
  it('solo toca los campos que no necesitan ninguna decisión', () => {
    const src = sinComentarios(
      readFileSync(raiz('src/components/publico/FilaDeActividad.tsx'), 'utf8'),
    );
    const leidos = [...src.matchAll(/\bentrada\.(\w+)/g)].map((m) => m[1]!);
    // Control positivo: si el regex dejara de encontrar nada, la lista de
    // sobrantes saldría vacía y el test pasaría sin mirar el archivo.
    expect(new Set(leidos).size).toBeGreaterThanOrEqual(3);

    const sobrantes = [...new Set(leidos)].filter((c) => !CAMPOS_QUE_LA_FILA_LEE.includes(c));
    expect(
      sobrantes,
      'estos campos se leen directo del índice en el componente. Si el dato ' +
        'necesita una decisión, va en `lib/tarjetaPublica.ts`, que se testea; si ' +
        'no la necesita, sumalo acá con el motivo.',
    ).toEqual([]);
  });

  it('y ningún otro componente del listado abre la entrada', () => {
    // El resto recibe la entrada y la pasa entera a `FilaDeActividad`, o recibe
    // strings. Que uno empiece a leerle campos es cómo la decisión se escapa del
    // módulo puro sin que nadie lo note.
    const otros = fuentes().filter((f) => !f.archivo.endsWith('FilaDeActividad.tsx'));
    const malos = otros.filter((f) => /\bentrada\.\w/.test(f.codigo)).map((f) => f.archivo);
    expect(malos).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · La grilla de 12 columnas y el marcador de mes
// ───────────────────────────────────────────────────────────────────────────

describe('la estructura del listado — D-146', () => {
  const fila = () =>
    sinComentarios(readFileSync(raiz('src/components/publico/FilaDeActividad.tsx'), 'utf8'));
  const lista = () =>
    sinComentarios(readFileSync(raiz('src/components/publico/ListaDeActividades.tsx'), 'utf8'));

  it('la fila es una grilla de 12 columnas en escritorio', () => {
    /*
     * «Filas cronológicas en lugar de tarjetas», sobre la grilla de 12 columnas
     * del sistema: fecha y tipo en 1-3, título y metadatos en 4-9, arancel en
     * 10-12. Se fija porque volver a una grilla de tarjetas se hace en una línea.
     *
     * MUTACIÓN PROBADA: cambiar `lg:grid-cols-12` por `sm:grid-cols-2` hace
     * fallar este caso.
     */
    expect(fila()).toContain('lg:grid-cols-12');
    expect(fila()).toContain('lg:col-span-3');
    expect(fila()).toContain('lg:col-span-6');
  });

  it('y en el teléfono no hay dos actividades por fila', () => {
    // §8 del diseño: la mayoría entra desde un link de Instagram en un navegador
    // embebido. Dos columnas de contenido en 375px no se leen.
    expect(fila()).not.toMatch(/(?<!lg:|sm:|md:|xl:)grid-cols-[2-9]/);
  });

  it('el marcador de mes va en `display-lg`, y es lo único que lo usa', () => {
    /*
     * Es el gesto más fuerte de la página. En la referencia el nombre del sitio va
     * al mismo cuerpo de 72px y los dos compiten: si dos cosas son la más grande,
     * ninguna lo es. Por eso la marca bajó un escalón, y por eso esto se fija.
     *
     * MUTACIÓN PROBADA: poner `display-lg` en la marca del encabezado hace fallar
     * este caso.
     */
    expect(lista()).toContain('display-lg');

    /*
     * Se mira el fuente **sin comentarios**: los docblocks de `Encabezado` y de
     * `index.astro` explican justamente por qué ellos NO usan `display-lg`, y un
     * barrido sobre el texto crudo los marcaría por documentar la decisión — la
     * salida fácil sería dejar de explicarla.
     */
    const conDisplay = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(tsx?|astro|css)$/.test(f))
      .filter((f) => f !== 'src/styles/global.css')
      .filter((f) => {
        const crudo = readFileSync(raiz(f), 'utf8');
        const limpio = crudo
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
          .replace(/<!--[\s\S]*?-->/g, '');
        return limpio.includes('display-lg');
      });

    expect(
      conDisplay,
      'solo el marcador de mes usa `display-lg`: es el único cuerpo de 72px de la ' +
        'página, y dos cosas al tamaño máximo es ninguna.',
    ).toEqual(['src/components/publico/ListaDeActividades.tsx']);
  });

  it('el mes cierra con la regla gruesa, que es lo que lo hace un corte', () => {
    // «2pt corta una sección mayor». La regla va en el `h2` y no en un `<hr>`
    // suelto: es el borde de abajo del marcador, así que no puede quedar separada.
    expect(lista()).toMatch(/regla-gruesa(?!-)/);
  });

  it('el año va aparte del mes, y no partiendo una cadena ya formateada', () => {
    /*
     * `nombreDeMes` devuelve «Septiembre de 2026», y eso a 72px no entra. El corte
     * lo hace `partesDeMes`, que sale de las partes de `Intl`; un `split(' de ')`
     * en el componente se rompe el día que cambie el formato del idioma.
     */
    expect(lista()).toContain('partesDeMes');
    expect(lista()).not.toMatch(/\.split\(/);
  });

  it('hay una sola definición de la regla que abre la lista', () => {
    // La lista se usa dos veces —agrupada por mes y corrida— y son la misma
    // lista. Escrita dos veces, cambiar una sola deja las dos vistas del mismo
    // listado con distinto ritmo vertical.
    const veces = (lista().match(/regla-gruesa-arriba/g) ?? []).length;
    expect(veces, 'la regla que abre la lista se escribe una sola vez').toBe(1);
  });
});
