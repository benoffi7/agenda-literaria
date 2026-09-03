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
 * 7. **El tríptico de «¿Qué hay ahora?»** (B-600) — que no decida ninguna frase
 *    ni formatee ninguna fecha, y que la island saque del DOM los **dos** bloques
 *    que imprimió el build.
 *
 * Las partes 1 a 5 barren `src/components/publico/*.tsx` **entero**, así que un
 * componente nuevo de esa carpeta cae bajo esas reglas sin agregar una línea acá.
 * Lo que sí hay que escribir es lo propio de la sección nueva, que es la parte 7.
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

  it('la cajita del tipo no lleva ninguna tinta escrita: la pone `estiloDeTipo`', () => {
    /*
     * D-150 — el tipo de actividad **dejo de tener un color fijo**. Hasta B-260
     * era una fila mas de `PARES` (`border border-borde … text-azul`, 6,14:1) y
     * eso se podia medir aca; ahora el color sale de un dato —el matiz derivado
     * del slug, o el elegido desde Opciones— asi que lo que hay que medir son los
     * **360 posibles**, y eso vive en `tests/color-de-tipo.test.ts`.
     *
     * Lo que si corresponde verificar aca es que no vuelva a haber una tinta
     * escrita a mano en esa cajita: una clase `text-azul` sobreviviente ganaria o
     * perderia contra el `style` segun el orden de las hojas, y en cualquiera de
     * los dos casos habria **dos** colores para el mismo elemento — que es la
     * clase de bug de B-260 (`claseBloqueFecha` con dos fondos).
     *
     * MUTACION PROBADA: devolverle `text-azul` a la cajita hace fallar este caso.
     */
    const src = sinComentarios(
      readFileSync(raiz('src/components/publico/FilaDeActividad.tsx'), 'utf8'),
    );
    const cajita = src.match(/<p\s*\n?\s*className="label-caps border[\s\S]*?>/);
    expect(cajita, 'no encontre la cajita del tipo en la fila').not.toBeNull();
    expect(cajita![0]).toContain('estiloDeTipo(tonos, entrada.tipo)');
    expect(cajita![0]).not.toMatch(/text-(?:papel|crema|hondo|tinta|suave|acento|azul|super)/);
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

  it('el panel de filtros del teléfono es una hoja modal de verdad - B-238', () => {
    /*
     * Hasta B-238 esto era un *disclosure* declarado a mano. Desde B-238 es una
     * capa modal -trampa de foco, Escape, cierre por el fondo, pushState- con
     * el cableado compartido de useCapaModal (lib/capaModal.ts, el mismo hook
     * del panel), y aria-expanded/aria-controls siguen porque el boton que la
     * abre sigue siendo un disclosure trigger declarado.
     *
     * No se afirma la forma exacta del cableado -eso es de tests/foco.test.ts,
     * que ya lo prueba una vez para todos los consumidores del hook- sino que
     * este componente lo usa y no tiene una copia propia, el mismo criterio que
     * tests/duplicar-modal.test.ts aplica a las capas del panel.
     *
     * MUTACION PROBADA: quitar la llamada a useCapaModal hace fallar este caso.
     */
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    expect(src).toContain('aria-expanded={abierto}');
    expect(src).toContain('aria-controls=');
    expect(src).toContain("from '@/lib/capaModal'");
    expect(src).toMatch(/useCapaModal\(caja,\s*cerrarPanel,\s*abierto\)/);
    // Y es un dialogo real solo mientras esta abierta, no siempre: en lg el
    // mismo div es un panel de la pagina y anunciarlo como dialogo ahi seria
    // un dato falso para quien usa lector de pantalla.
    expect(src).toContain("role={abierto ? 'dialog' : undefined}");
    expect(src).toContain('aria-modal={abierto ? true : undefined}');
  });

  it('abrir la hoja hace pushState, y cerrarla de cualquier forma lo deshace - B-238', () => {
    /*
     * SS8 del diseno, textual: "el boton atras del telefono tiene que cerrarla,
     * no salir del sitio". Eso exige dos cosas a la vez: un pushState al abrir
     * (para que haya algo que el boton atras deshaga) y que TODO cierre -el
     * boton "Ver N actividades", Escape, el click en el fondo- pase por el
     * mismo camino que el boton atras, o la entrada de historial queda
     * huerfana y un futuro atras cierra el sitio en lugar de un modal que ya
     * estaba cerrado.
     *
     * MUTACION PROBADA: hacer que cerrarPanel llame a setAbierto(false)
     * directo (en vez de pasar por history.back()) deja este caso en rojo
     * nombrando exactamente esa diferencia, aunque el resto de la hoja siga
     * funcionando igual a simple vista.
     */
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    expect(src).toContain('window.history.pushState(');
    expect(src).toContain("window.addEventListener('popstate'");
    // El cierre por UI pasa por el mismo camino que el boton atras: ninguno
    // de los dos llama a setAbierto(false) directo.
    expect(src).toMatch(/const cerrarPanel = \(\) => \{[\s\S]*?window\.history\.back\(\)/);
  });

  it('cerrar la hoja con un filtro elegido adentro no lo pisa - hallazgo del auditor de trampas', () => {
    /*
     * Bug real que el auditor de trampas encontro sobre el primer borrador de
     * B-238, reproducible en el uso normal (no un caso raro): la hoja tiene
     * SU pushState/popstate para el boton atras, pero el componente YA tenia
     * otro popstate -el que sincroniza filtros con la URL (aQuery/desdeQuery,
     * "La URL, en los dos sentidos")- montado desde el principio. Cerrar la
     * hoja hace history.back(), que navega a la entrada de ANTES de abrirla
     * -sin el filtro recien elegido en su URL- y ese otro listener la leia y
     * pisaba la seleccion.
     *
     * La reparacion: una bandera (cerrandoLaHoja) prendida desde que se abre
     * la hoja le dice al sync de URL que el PROXIMO popstate es un cierre y
     * no una navegacion real, asi que en vez de leer la URL vieja vuelve a
     * escribir la de ahora con los filtros vigentes (guardados en un ref para
     * no quedar con los del primer render).
     *
     * MUTACION PROBADA: que la funcion leer() ignore cerrandoLaHoja.current
     * (o que la bandera nunca se ponga en true al abrir) deja este caso en
     * rojo sin tocar el test de arriba, que solo mira que exista el
     * pushState/history.back() y no que la seleccion sobreviva al cierre.
     */
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    expect(src).toContain('const cerrandoLaHoja = useRef(false)');
    // Se prende al abrir (en el mismo efecto que el pushState), no en
    // cerrarPanel: un boton atras REAL -no el que dispara cerrarPanel- tiene
    // que dejar la seleccion igual de intacta.
    expect(src).toMatch(
      /window\.history\.pushState\([\s\S]*?cerrandoLaHoja\.current = true/,
    );
    // Y leer() la consume: si esta prendida, no lee la URL, la vuelve a
    // escribir con los filtros vigentes.
    expect(src).toMatch(
      /const leer = \(\) => \{\s*if \(cerrandoLaHoja\.current\)/,
    );
    expect(src).toContain('window.history.replaceState(null,');
  });

  it('cerrar la hoja dos veces seguidas no retrocede dos entradas de historial - hallazgo del auditor de trampas', () => {
    /*
     * history.back() es asincrono: el popstate que dispara no es sincrono con
     * la llamada, asi que hay una ventana en la que una segunda invocacion de
     * cerrarPanel -Escape mantenido, un doble toque en "Ver N actividades"-
     * podria repetir history.back() y hacer retroceder al navegador una
     * entrada de mas, sacando a la persona del sitio en vez de solo cerrar la
     * hoja. La reparacion es apagar la bandera entradaPropia ANTES de llamar
     * a history.back(), no solo en la limpieza del efecto (que corre recien
     * cuando React re-renderiza tras el popstate real).
     *
     * MUTACION PROBADA: mover `entradaPropia.current = false` a DESPUES de
     * `window.history.back()` (o sacarla de cerrarPanel y dejarla solo en la
     * limpieza del efecto) deja este caso en rojo.
     */
    const src = sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
    const m = /const cerrarPanel = \(\) => \{[\s\S]*?\n  \};/.exec(src);
    expect(m, 'no se encontro la funcion cerrarPanel').not.toBeNull();
    const cuerpo = m![0];
    const posApagado = cuerpo.indexOf('entradaPropia.current = false');
    const posBack = cuerpo.indexOf('window.history.back()');
    expect(posApagado, 'cerrarPanel no apaga entradaPropia').toBeGreaterThan(-1);
    expect(posBack, 'cerrarPanel no llama a history.back()').toBeGreaterThan(-1);
    expect(posApagado, 'entradaPropia se apaga DESPUES de history.back()').toBeLessThan(posBack);
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

  it('y no se puede esquivar la lista desestructurando la entrada', () => {
    /*
     * **Lo pidió el `auditor-privacidad`.** El aserto de arriba busca
     * `entrada.<campo>` sobre el fuente, y eso deja dos puertas abiertas:
     * `const { searchText } = entrada` y `const e = entrada` no matchean el
     * patrón, así que la lista blanca se saltea sin tocarla.
     *
     * Importa más que antes: con D-140 la página de detalle no puede publicar de
     * más porque **recibe un tipo recortado**, pero la fila recibe la
     * `EntradaDeIndice` entera. Acá la garantía no la da el tipo — la da esta
     * lista, y una lista que se puede esquivar no es una garantía.
     *
     * MUTACIÓN PROBADA: agregar `const { searchText } = entrada;` al cuerpo del
     * componente hace fallar este caso, y **no** el de arriba.
     */
    const src = sinComentarios(
      readFileSync(raiz('src/components/publico/FilaDeActividad.tsx'), 'utf8'),
    );
    expect(
      src,
      'desestructurar la entrada esquiva la lista blanca: leé `entrada.<campo>` ' +
        'para que el barrido lo vea, o pasá el dato por `lib/tarjetaPublica.ts`.',
    ).not.toMatch(/\}\s*=\s*entrada\b/);
    expect(
      src,
      'aliasar la entrada esquiva la lista blanca por el mismo motivo.',
    ).not.toMatch(/=\s*entrada\s*[;,)]/);
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
  /*
   * El marcador se extrajo a su propio archivo en B-113: la página de mes
   * (`/agenda/2026-09`) pinta el mismo. Los tres casos de abajo siguen mirando el
   * marcador, que ahora está acá; el de `regla-gruesa-arriba` sigue mirando la
   * lista, porque esa regla es de la lista y no del marcador.
   */
  const marcador = () =>
    sinComentarios(readFileSync(raiz('src/components/publico/MarcadorDeMes.tsx'), 'utf8'));

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
    expect(marcador()).toContain('display-lg');

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
    ).toEqual(['src/components/publico/MarcadorDeMes.tsx']);
  });

  it('el mes cierra con la regla gruesa, que es lo que lo hace un corte', () => {
    // «2pt corta una sección mayor». La regla va en el `h2` y no en un `<hr>`
    // suelto: es el borde de abajo del marcador, así que no puede quedar separada.
    expect(marcador()).toMatch(/regla-gruesa(?!-)/);
  });

  it('el año va aparte del mes, y no partiendo una cadena ya formateada', () => {
    /*
     * `nombreDeMes` devuelve «Septiembre de 2026», y eso a 72px no entra. El corte
     * lo hace `partesDeMes`, que sale de las partes de `Intl`; un `split(' de ')`
     * en el componente se rompe el día que cambie el formato del idioma.
     */
    expect(marcador()).toContain('partesDeMes');
    expect(marcador()).not.toMatch(/\.split\(/);
  });

  it('hay una sola definición de la regla que abre la lista', () => {
    // La lista se usa dos veces —agrupada por mes y corrida— y son la misma
    // lista. Escrita dos veces, cambiar una sola deja las dos vistas del mismo
    // listado con distinto ritmo vertical.
    const veces = (lista().match(/regla-gruesa-arriba/g) ?? []).length;
    expect(veces, 'la regla que abre la lista se escribe una sola vez').toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7 · El tríptico de «¿Qué hay ahora?» — B-600
// ───────────────────────────────────────────────────────────────────────────

/**
 * El tríptico entra en este archivo **por estar donde está**: el barrido de las
 * secciones 1 a 5 recorre `src/components/publico/*.tsx` entero, así que
 * `PanelesDeAhora.tsx` ya cae bajo la regla de tintas, la de las opacidades, la
 * del `onClick`, la del anillo de foco y la de «ningún otro componente abre la
 * entrada» — sin agregar una línea. Lo de abajo es lo **propio** de esta sección,
 * que esas reglas genéricas no dicen.
 *
 * Las dos cosas que puede romper, y ninguna deja el build en rojo:
 *
 * 1. **Que el componente empiece a decidir.** Una fecha formateada o una frase
 *    escrita acá adentro no la verifica nada: los componentes de este repo no
 *    tienen tests de render (`docs/05-patrones.md`). Y acá lo que se decidiría es
 *    aritmética de calendario en una zona con offset, que es la trampa 1.
 * 2. **Que queden dos trípticos en la página.** El build imprime el suyo y la
 *    island monta el suyo: si el efecto del fetch no saca el del build, la home
 *    muestra la misma sección dos veces, una con el reloj de hace tres días.
 */
describe('el tríptico de «¿qué hay ahora?» no decide nada — B-600', () => {
  const paneles = () =>
    sinComentarios(readFileSync(raiz('src/components/publico/PanelesDeAhora.tsx'), 'utf8'));
  const modulo = () => readFileSync(raiz('src/lib/ahoraPublico.ts'), 'utf8');

  it('no formatea una sola fecha: ni `Intl`, ni `toLocale*`, ni `new Date`', () => {
    /*
     * **Es la trampa 1 puesta donde nada la mira.** Todo el sitio formatea con
     * `timeZone` explícito a través de `lib/fechasPublicas.ts`; un `Intl` suelto
     * acá adentro formatearía con la zona de quien mira y diría «00:30» de un
     * encuentro de las 21:30, en la portada de la home.
     *
     * MUTACIÓN PROBADA: agregar `new Intl.DateTimeFormat('es-AR').format(...)` al
     * componente deja este caso en rojo.
     */
    const src = paneles();
    expect(src, 'el formateo de fechas vive en `lib/fechasPublicas.ts`').not.toMatch(/\bIntl\b/);
    expect(src, 'idem: `toLocaleString` no lleva la zona del proyecto').not.toMatch(/toLocale/);
    expect(src, 'el componente recibe strings ya resueltos, no instantes').not.toMatch(
      /new Date\b/,
    );
    // Y nada de aritmética de calendario: es lo que `claveDeDia`/`diaDeSemana`
    // existen para que nadie escriba dos veces.
    expect(src).not.toMatch(/\.get(UTC)?(Date|Day|Month|Hours)\(/);
  });

  it('ni decide una sola frase: los rótulos y los textos vienen del módulo', () => {
    /*
     * `Hoy`, `Mañana`, `Este finde`, «Por hoy no queda nada» y «+2 más hoy» son
     * **texto de producto** y viven juntos en `lib/ahoraPublico.ts`, que es puro y
     * está testeado: es lo que permite verificar que a las once de la noche el
     * panel diga «por hoy no queda nada» y no «hoy no hay nada» — las dos frases
     * describen el mismo panel vacío y solo una es cierta.
     *
     * Lo único escrito en el markup es el rótulo de la **sección**, que no
     * depende de ningún reloj.
     */
    const src = paneles();
    for (const frase of [/['"]Hoy['"]/, /Mañana/, /finde/i, /más hoy/, /queda nada/]) {
      expect(src, `«${frase}» tiene que salir de \`FRASES\` o del rótulo de la ventana`).not.toMatch(
        frase,
      );
    }
    // Control positivo: las frases existen, y están allá.
    expect(modulo()).toContain('Por hoy no queda nada.');
    expect(modulo()).toContain('El finde que viene');
    expect(paneles(), 'el rótulo de la sección sí es del markup').toContain('¿Qué hay ahora?');
  });

  it('el tope de filas es el del módulo, no un número escrito en el markup', () => {
    // Un `slice(0, 4)` acá adentro sería un segundo tope, y el pie «+2 más hoy»
    // —que lo cuenta el módulo— empezaría a no coincidir con las filas dibujadas.
    expect(paneles()).not.toMatch(/\.slice\(/);
    expect(modulo()).toContain('export const TOPE_DEL_PANEL');
  });

  it('el «+N más» no es un enlace: el día no es una URL de este sitio', () => {
    /*
     * §2.3 decide qué es página y qué es filtro, y el día no está en ninguna de
     * las dos listas: no hay «ver el cronograma de hoy» al que mandar. Lo que sí
     * hay es el listado completo, en esta misma página. Ver D-320.
     *
     * MUTACIÓN PROBADA: envolver `{panel.resto}` en un `<a>` deja este caso en
     * rojo, y es el atajo que decide de paso una decena de URLs indexables en el
     * pie de un panel.
     */
    const src = paneles();
    const pie = src.match(/panel\.resto &&[\s\S]*?\)\}/);
    expect(pie, 'no se encontró el pie del panel en el markup').not.toBeNull();
    expect(pie![0], 'el resto es texto, no un link').not.toMatch(/<a\b|href=/);
  });

  it('el único enlace de la fila es la actividad entera, sin botones adentro', () => {
    // §4.2 — en móvil un botón dentro de un link es un blanco ambiguo. Es la
    // misma regla que ya cumple `FilaDeActividad`.
    const src = paneles();
    expect(src).not.toMatch(/<button/);
    expect((src.match(/<a\b/g) ?? []).length, 'una sola ancla: la fila').toBe(1);
  });
});

describe('un solo markup del tríptico, dos relojes — B-600', () => {
  const buscador = () =>
    sinComentarios(readFileSync(raiz('src/components/publico/Buscador.tsx'), 'utf8'));
  const home = () => sinComentarios(readFileSync(raiz('src/pages/index.astro'), 'utf8'));

  it('el build y la island renderizan el MISMO componente', () => {
    /*
     * La regla del §6.3, que acá pesa más que en el listado: el rótulo «Hoy» del
     * build envejece de un día para el otro sin que cambie ningún dato, así que
     * la island lo recalcula con el reloj de quien mira. Dos markups serían dos
     * maneras de que uno quede viejo (la clase de B-88).
     */
    expect(home()).toMatch(/import \{ PanelesDeAhora \}/);
    expect(buscador()).toMatch(/import \{ PanelesDeAhora \}/);
    // Y las dos llaman al mismo módulo puro para armar los paneles.
    expect(home()).toMatch(/panelesDeAhora\(/);
    expect(buscador()).toMatch(/panelesDeAhora\(/);
  });

  it('la island saca del DOM los DOS bloques del build, y recién con el índice', () => {
    /*
     * Si se sacaran antes del `then`, un fetch que falla dejaría la página sin
     * contenido; si no se sacara el del tríptico, la home mostraría la sección dos
     * veces —una con el reloj del build— justo arriba del buscador.
     *
     * MUTACIÓN PROBADA: borrar la línea del tríptico deja este caso en rojo, y es
     * el olvido natural al agregar un segundo bloque estático a un efecto que ya
     * sacaba uno.
     */
    const src = buscador();
    expect(src).toMatch(/document\.getElementById\(idListadoEstatico\)\?\.remove\(\)/);
    expect(src).toMatch(/document\.getElementById\(idPanelesEstaticos\)\?\.remove\(\)/);

    // Los dos `remove` van adentro del `.then(...)` del fetch, después del
    // `setCarga({ estado: 'listo' ... })`.
    const then = src.match(/\.then\(\(indice\) => \{[\s\S]*?\}\)\s*\.catch/);
    expect(then, 'no se encontró el `then` del fetch del índice').not.toBeNull();
    expect(then![0]).toContain('idListadoEstatico');
    expect(then![0]).toContain('idPanelesEstaticos');

    // Y los dos ids están en las dependencias del efecto: sin eso, cambiar el id
    // no volvería a correr la limpieza.
    expect(src).toMatch(/\[version, idListadoEstatico, idPanelesEstaticos\]/);
  });

  it('los ids los pone la plantilla y viajan como prop, no cableados en el .tsx', () => {
    /*
     * Un literal repetido en los dos archivos se desincroniza sin que nada falle:
     * el bloque del build se queda en la página y hay dos trípticos. Es el mismo
     * motivo por el que `idListadoEstatico` ya era una prop.
     */
    const h = home();
    expect(h).toMatch(/const ID_PANELES = '[a-z-]+';/);
    expect(h).toMatch(/id=\{ID_PANELES\}/);
    expect(h).toMatch(/idPanelesEstaticos=\{ID_PANELES\}/);
    // Los dos ids son distintos: con el mismo, el primer `remove` se llevaría el
    // otro bloque y el segundo no encontraría nada.
    const ids = [...h.matchAll(/const ID_(LISTADO|PANELES) = '([a-z-]+)';/g)].map((m) => m[2]!);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size, 'los dos bloques del build comparten `id`').toBe(2);
    // Y el componente no conoce ningún id de la plantilla.
    expect(
      sinComentarios(readFileSync(raiz('src/components/publico/PanelesDeAhora.tsx'), 'utf8')),
    ).not.toMatch(/del-build/);
  });

  it('el tríptico NO mira los filtros: contesta una pregunta fija', () => {
    /*
     * **La decisión de B-600.** Filtrarlo cambiaría la pregunta a «¿qué hay hoy
     * entre lo que filtraste?», que es lo que el listado de abajo ya contesta. Un
     * panel que dice «Hoy» y esconde media programación porque quedó puesto un
     * chip de barrio miente con el rótulo puesto; y con dos filtros combinados el
     * tríptico quedaría vacío justo cuando más orienta.
     *
     * MUTACIÓN PROBADA: pasarle `entradas` filtradas en vez de `indice` —o sumar
     * `filtros` a las dependencias— deja este caso en rojo.
     */
    const memo = buscador().match(/const programacion = useMemo\([\s\S]*?\);/);
    expect(memo, 'no se encontró el memo de la programación').not.toBeNull();
    expect(memo![0], 'el tríptico no se filtra').not.toMatch(/\bfiltros\b|\borden\b|\bvisibles\b/);
    // Sí depende del reloj del cliente, que es lo que hace cierto el rótulo «Hoy».
    expect(memo![0]).toMatch(/\bahora\b/);
    expect(memo![0]).toMatch(/panelesDeAhora\(indice, ahora, etiquetas\)/);
  });

  it('el reloj del build sale del mismo parser que el sello, no de un `new Date()` pelado', () => {
    /*
     * **Lo pidió el `auditor-privacidad` sobre B-600, y es la clase de B-88.** El
     * mismo string —`indice.generadoEn`— se parseaba de dos maneras, con políticas
     * de falla **opuestas**:
     *
     * - `selloDelIndice` usa `instanteDeIso` y se defiende, con el motivo escrito
     *   en su docblock y repetido en `docs/12-sitio-publico.md`: «sin sello se
     *   pierde una línea de contexto, con una excepción se pierde la página».
     * - `index.astro` lo parseaba con `new Date()` pelado y le pasaba el resultado
     *   a `panelesDeAhora`. Con un `generadoEn` ilegible, `ahora` era `Invalid
     *   Date`, y de ahí a `claveDeDia` → `Intl.format(Invalid Date)` → `RangeError`:
     *   **el build de la home se caía antes de que corriera la guarda del sello**.
     *
     * O sea que la garantía documentada valía para el camino de la island —donde
     * `ahora` es el reloj del cliente— y no para el del build, que es justo el que
     * la frase describe.
     *
     * MUTACIÓN PROBADA: volver a `new Date(indice.generadoEn)` deja este caso en
     * rojo.
     */
    const h = home();
    expect(h, 'el reloj del build tiene que pasar por el mismo parser que el sello').toMatch(
      /const ahora = instanteDeIso\(indice\.generadoEn\) \?\? new Date\(\);/,
    );
    expect(h, 'y no quedar un `new Date(generadoEn)` sin guarda en el frontmatter').not.toMatch(
      /new Date\(indice\.generadoEn\)/,
    );
  });

  it('y el bloque del build vive adentro del ancla de «Saltar al listado»', () => {
    /*
     * El `id="listado"` es el destino del link de salto, y la island monta su
     * tríptico como primera hija de su propio árbol: con el bloque del build
     * afuera del ancla, el salto caería en un lugar distinto antes y después de
     * hidratar — un link de accesibilidad que cambia de destino al hidratar, en la
     * página que más se usa.
     */
    const h = home();
    const ancla = h.match(/<div id="listado"[\s\S]*?<Buscador/);
    expect(ancla, 'no se encontró el ancla del listado con el buscador adentro').not.toBeNull();
    expect(ancla![0], 'el tríptico del build va adentro del ancla y arriba del buscador').toContain(
      'ID_PANELES',
    );
  });
});
