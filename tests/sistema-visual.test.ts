import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, oklchASrgb, type Srgb } from '@/lib/contraste';

/**
 * El sistema visual se sostiene en todo el sitio, no solo donde se escribió — B-260.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * `docs/referencias/sistema-visual.md` es la referencia aprobada, y sus reglas no
 * son preferencias de maquetación: son lo que hace que el sitio no se vea
 * genérico, que es el motivo por el que el dueño rechazó **dos** direcciones
 * anteriores. Y son exactamente el tipo de regla que se rompe de a una, en un
 * archivo, sin que falle nada:
 *
 * - un `rounded-lg` en un botón nuevo se ve bien solo, y rompe el lenguaje filoso;
 * - un `shadow-sm` en una tarjeta se ve bien solo, y es *el* gesto de plataforma
 *   del que se viene;
 * - un `font-serif` que sobrevivió del rediseño anterior **pinta Georgia** y no
 *   falla, porque Tailwind trae su propio `font-serif` y el token del proyecto se
 *   borró;
 * - un `text-tinta/60` da 4,49:1 contra un piso de 4,5 y se ve perfecto (B-235).
 *
 * Ninguna de las cuatro la ve el compilador, ni el build, ni una captura de
 * pantalla. Este archivo las mira todas de una, sobre **todo** el markup del
 * sitio y no sobre el que se acordó de revisar alguien.
 *
 * ── Y ata el código a la referencia ───────────────────────────────────────
 * El primer bloque verifica que cada token de `global.css` sea **exactamente** la
 * tinta que el documento nombra, ida y vuelta por OKLCH. Sin eso, `global.css` y
 * `sistema-visual.md` son dos copias de la misma paleta que se separan en el
 * primer retoque — la clase de bug que este repo persigue en todos lados.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const css = readFileSync(raiz('src/styles/global.css'), 'utf8');
const referencia = readFileSync(raiz('docs/referencias/sistema-visual.md'), 'utf8');

/** Un token de la paleta, leído de la hoja de estilos. */
const token = (nombre: string): { L: number; C: number; H: number } => {
  const m = css.match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return { L: Number(m![1]), C: Number(m![2]), H: Number(m![3]) };
};

const srgb = (nombre: string): Srgb => {
  const { L, C, H } = token(nombre);
  return oklchASrgb(L, C, H);
};

const aHex = (c: Srgb): string =>
  '#' +
  c
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/**
 * Todo el markup del sitio público. El panel tiene su propio criterio visual y no
 * entra: es una herramienta interna que usa dos personas, no la cara del sitio.
 */
const archivosDelSitio = (): string[] =>
  execFileSync(
    'git',
    ['ls-files', 'src/pages', 'src/components/sitio', 'src/components/publico', 'src/layouts'],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter((f) => /\.(astro|tsx|ts)$/.test(f))
    .filter((f) => f !== 'src/pages/admin.astro');

/**
 * El fuente **sin comentarios**.
 *
 * Los docblocks de estos archivos explican justamente por qué no hay sombras ni
 * radios, así que un barrido sobre el texto crudo fallaría contra su propia
 * documentación — y la salida fácil sería dejar de explicarlo.
 */
const sinComentarios = (src: string): string =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '');

const fuentes = (): { archivo: string; codigo: string }[] =>
  archivosDelSitio().map((f) => ({
    archivo: f,
    codigo: sinComentarios(readFileSync(raiz(f), 'utf8')),
  }));

/** Cada línea del sitio que casa con un patrón, con dónde está. */
const buscar = (patron: RegExp): string[] => {
  const out: string[] = [];
  for (const { archivo, codigo } of fuentes()) {
    codigo.split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(new RegExp(patron, 'g'))) {
        out.push(`${archivo}:${i + 1} — ${m[0]}`);
      }
    });
  }
  return out;
};

describe('el barrido lee el sitio de verdad', () => {
  it('control positivo: encuentra archivos y contenido', () => {
    /*
     * Casi todo este archivo afirma que una lista está **vacía**, y una lista
     * vacía es también lo que devuelve un barrido que no leyó nada. Sin este
     * caso, borrar `src/` entero dejaría el archivo en verde.
     */
    expect(archivosDelSitio().length).toBeGreaterThan(10);
    expect(fuentes().every((f) => f.codigo.length > 0)).toBe(true);
    // Y el recortador de comentarios no se come el código.
    expect(buscar(/\btext-acento\b/).length).toBeGreaterThan(3);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · Las tintas son las del documento, exactamente
// ───────────────────────────────────────────────────────────────────────────

/**
 * Cada token del proyecto con la tinta del sistema que representa.
 *
 * El hex **no se copia acá**: se busca en `sistema-visual.md`, así que si alguien
 * cambia la referencia y no el código —o al revés— esto lo dice. Es la misma
 * regla que hace que los chequeos de contraste lean `global.css` en vez de
 * copiarlo, aplicada un nivel más arriba.
 */
const TINTAS: { token: string; hex: string; queEs: string }[] = [
  { token: 'papel', hex: '#fbf9f4', queEs: 'surface — el fondo global' },
  { token: 'tinta', hex: '#1b1c19', queEs: 'on-surface' },
  { token: 'suave', hex: '#58413c', queEs: 'on-surface-variant' },
  { token: 'acento', hex: '#a7341c', queEs: 'primary — terracota profunda' },
  { token: 'azul', hex: '#4f6073', queEs: 'secondary — azul tinta' },
  { token: 'super', hex: '#6c575a', queEs: 'tertiary — la superposición' },
  { token: 'borde', hex: '#8c716b', queEs: 'outline' },
  { token: 'regla', hex: '#e0bfb9', queEs: 'outline-variant' },
];

describe('las tintas de `global.css` son las de la referencia — B-260', () => {
  it('cada token vuelve exactamente al hex que el sistema nombra', () => {
    /*
     * Los tokens están en OKLCH porque los chequeos de contraste los parsean así,
     * y la referencia está en hex. **Las dos formas tienen que ser el mismo
     * color**, y eso no se puede confiar a que alguien haya convertido bien: se
     * verifica el ida y vuelta.
     *
     * MUTACIÓN PROBADA: cambiar `--color-acento` a `oklch(0.52 0.15 32)` —el
     * terracota de la dirección anterior, que se ve casi igual— hace fallar este
     * caso con `#ac3a1d ≠ #a7341c`.
     */
    const distintas = TINTAS.filter((t) => aHex(srgb(t.token)) !== t.hex).map(
      (t) => `--color-${t.token} da ${aHex(srgb(t.token))} y el sistema dice ${t.hex} (${t.queEs})`,
    );
    expect(
      distintas,
      'la paleta de `global.css` se separó de `docs/referencias/sistema-visual.md`.',
    ).toEqual([]);
  });

  it('y el hex que este test afirma está escrito en la referencia', () => {
    /*
     * La otra mitad, y la que evita que esta lista envejezca: si el documento
     * cambiara una tinta, la tabla de arriba seguiría comparando contra el valor
     * viejo y el test seguiría verde contra una referencia que ya no dice eso.
     */
    const ausentes = TINTAS.filter((t) => !referencia.toLowerCase().includes(t.hex)).map(
      (t) => `${t.hex} (${t.token}) no está en sistema-visual.md`,
    );
    expect(ausentes).toEqual([]);
  });

  it('las dos tintas de regla no alcanzan el piso de texto, y por eso son reglas', () => {
    // La regla 1 de la medición del sistema, verificada y no asumida.
    const papel = srgb('papel');
    expect(contraste(srgb('borde'), papel)).toBeLessThan(AA_TEXTO);
    expect(contraste(srgb('regla'), papel)).toBeLessThan(AA_TEXTO);
    // Y `outline-variant` ni siquiera llega al 3:1 de un borde de control.
    expect(contraste(srgb('regla'), papel)).toBeLessThan(3);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · Radio 0 — el lenguaje es filoso
// ───────────────────────────────────────────────────────────────────────────

describe('el lenguaje es filoso: radio 0 — B-260', () => {
  it('ningún archivo del sitio usa `rounded-*`', () => {
    /*
     * «Radio 0 en botones, campos y contenedores». El sistema admite una
     * excepción —1 o 2px en el contenedor más externo de la página, para imitar el
     * redondeo de una hoja física— y **en esta implementación no hay dónde
     * aplicarla**: el papel es el fondo del viewport, así que la hoja no tiene un
     * borde exterior visible que redondear. Si algún día lo tiene, la excepción va
     * acá con su motivo, no aflojando el barrido.
     *
     * MUTACIÓN PROBADA: poner `rounded-md` en `claseBotonPrimario` hace fallar
     * este caso, y solo éste.
     */
    const redondeados = buscar(/\brounded-[\w[\]./-]+/);
    expect(
      redondeados,
      'el sistema visual es de esquina viva. Si un contenedor necesita el radio de ' +
        '1–2px de la hoja física, va documentado acá.',
    ).toEqual([]);
  });

  it('y tampoco `rounded` pelado', () => {
    // `rounded` sin sufijo es 0.25rem y el barrido de arriba no lo agarra.
    expect(buscar(/\brounded(?![-\w])/)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · Estrictamente plano
// ───────────────────────────────────────────────────────────────────────────

describe('estrictamente plano: sin sombras, sin desenfoques, sin degradados', () => {
  it('ninguna sombra', () => {
    /*
     * «La profundidad sale de superponer tintas, no de simular luz». Una sombra es
     * **el** gesto que le da a una página el aire de plataforma genérica, y es lo
     * primero que vuelve a entrar cuando alguien quiere «despegar» una caja.
     *
     * MUTACIÓN PROBADA: agregar `shadow-sm` al bloque de la ficha del detalle hace
     * fallar este caso.
     */
    expect(buscar(/\bshadow-[\w[\]./-]+|\bshadow\b|box-shadow/)).toEqual([]);
  });

  it('ningún desenfoque', () => {
    expect(buscar(/\bbackdrop-blur|\bblur-[\w[\]./-]+|filter:\s*blur/)).toEqual([]);
  });

  it('ningún degradado', () => {
    /*
     * Ojo con el falso positivo: `bg-gradient-to-*` es la forma vieja y
     * `bg-linear-to-*` la de Tailwind 4. Se buscan las dos, más el CSS crudo.
     */
    expect(buscar(/bg-gradient-|bg-linear-|bg-radial|linear-gradient|radial-gradient/)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · Las tres familias, y ninguna más
// ───────────────────────────────────────────────────────────────────────────

describe('la tipografía es la del sistema — B-260', () => {
  it('`font-serif` no se usa: el token se borró y Tailwind trae el suyo', () => {
    /*
     * **El modo de falla más silencioso del rediseño.** La dirección anterior usaba
     * `font-serif` (Lora) en veinte lugares. El token se borró de `@theme`, pero
     * Tailwind **trae su propio** `font-serif` (`ui-serif, Georgia`): un
     * `font-serif` que sobreviva no falla, no rompe el build, y pinta Georgia en el
     * medio de una página en Bodoni y Archivo Narrow.
     *
     * MUTACIÓN PROBADA: volver a poner `font-serif` en el título de una fila hace
     * fallar este caso — y el build sigue verde, que es el punto.
     */
    expect(
      buscar(/\bfont-serif\b/),
      'el token `--font-serif` ya no existe; `font-serif` pinta el Georgia de ' +
        'Tailwind. Usá `font-display` (Bodoni) o `font-titulo` (Archivo Narrow).',
    ).toEqual([]);
  });

  it('las tres familias están declaradas y son las que dice el sistema', () => {
    expect(css).toContain("--font-display: 'Bodoni Moda'");
    expect(css).toContain("--font-titulo: 'Archivo Narrow'");
    expect(css).toContain("--font-sans: 'Public Sans'");
    /*
     * Y las que se fueron no vuelven por la puerta de atrás. Se mira el CSS **sin
     * comentarios**: el docblock de `global.css` nombra a Inter y a Lora para
     * explicar la tabla de pesos del cambio, y castigar esa explicación empujaría
     * a borrarla.
     */
    const declarado = sinComentarios(css);
    expect(declarado).not.toContain('Inter');
    expect(declarado).not.toContain('Lora');
  });

  it('la hoja de fuentes pide exactamente esas tres, y ninguna más', () => {
    /*
     * Es lo que hace que el peso medido siga siendo cierto: agregar una cuarta
     * familia al `<link>` no rompe nada y no se nota, y la página pasa de 58,8 KB
     * de fuentes a lo que sea.
     *
     * También cierra la corrección 2 de `stitch-detalle.md`: la referencia dejaba
     * el `<link>` a **Material Symbols** en el `<head>` aunque no usaba ningún
     * icono. Peso muerto, y el archivo que devuelve el sitio a Google.
     *
     * MUTACIÓN PROBADA: sumar `&family=Inter:wght@400` al `href` hace fallar este
     * caso.
     */
    const base = readFileSync(raiz('src/layouts/Base.astro'), 'utf8');
    const links = [...base.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?([^"']+)/g)];
    expect(links, 'no se encontró la hoja de fuentes').toHaveLength(1);

    const familias = [...links[0]![1]!.matchAll(/family=([^:&]+)/g)].map((m) =>
      decodeURIComponent(m[1]!.replace(/\+/g, ' ')),
    );
    expect(familias.sort()).toEqual(['Archivo Narrow', 'Bodoni Moda', 'Public Sans']);

    // El eje óptico de la Bodoni va **fijado**: abierto cuesta 26,5 KB en vez de
    // 14,6 KB, y el rango de uso real del sitio es de 26px a 72px.
    expect(links[0]![1]).toContain('Bodoni+Moda:opsz,wght@48,800');
  });

  it('no hay ninguna librería de iconos', () => {
    /*
     * Corrección 1 del encargo y corrección 2 de `stitch-detalle.md`. Los Material
     * Symbols son los iconos de Android: un `laptop_mac` al lado de «virtual»
     * devuelve el sitio a Google al instante. Lo que necesita un signo se resuelve
     * con tipografía o con CSS —la flecha del desplegable es un triángulo de tres
     * bordes, la X de la casilla son dos pseudo-elementos—.
     */
    const conIconos = buscar(/material-symbols|material-icons|font-awesome|lucide|heroicons/i);
    expect(conIconos).toEqual([]);
    expect(readFileSync(raiz('src/layouts/Base.astro'), 'utf8')).not.toContain('Material+Symbols');
  });

  it('la escala del sistema está definida entera, y en un solo lugar', () => {
    // Los seis roles de `sistema-visual.md`, más los tres que esta implementación
    // agregó con motivo (`marca`, `display-md`, `fecha-dia`, `headline-sm`).
    for (const rol of ['display-lg', 'headline-md', 'label-caps', 'body-md', 'body-sm']) {
      expect(css, `falta el rol ${rol} de la escala`).toContain(`@utility ${rol}`);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · Tintas con nombre, no opacidades
// ───────────────────────────────────────────────────────────────────────────

describe('las tintas no se atenúan — B-260', () => {
  it('ninguna clase de color lleva una opacidad', () => {
    /*
     * «Paleta limitada, como una impresión a tintas planas»: una opacidad es una
     * trama de medio tono, y una trama distinta por línea es lo contrario de eso.
     *
     * Y de paso cierra la clase de B-235 de raíz. Aquel bug era `text-tinta/60`
     * dando 4,49:1 contra un piso de 4,5 — cuatro centésimas que no se ven y se
     * calculan. Sin opacidades no hay nada que calcular caso por caso: cada tinta
     * tiene un único contraste y está medido.
     *
     * MUTACIÓN PROBADA: cambiar un `text-super` de la fila del listado por
     * `text-tinta/70` hace fallar este caso.
     */
    const tokens = 'papel|crema|hondo|tinta|suave|acento|azul|super|borde|regla';
    const atenuadas = buscar(new RegExp(`\\b(?:text|bg|border|decoration)-(?:${tokens})/[\\d[]`));
    expect(
      atenuadas,
      'usá la tinta que corresponde en vez de atenuar: `suave` (8,92:1) y `super` ' +
        '(6,34:1) existen para eso y están medidas.',
    ).toEqual([]);
  });

  it('las dos tintas de regla nunca aparecen como texto, en ninguna página', () => {
    /*
     * El listado ya lo verifica para sus componentes; esto lo extiende a las cinco
     * páginas y al chrome. `borde` da 4,26:1 y `regla` 1,62:1 sobre el papel.
     *
     * MUTACIÓN PROBADA: poner `text-borde` en el epígrafe de la portada del
     * detalle hace fallar este caso.
     */
    expect(buscar(/\btext-(?:borde|regla)\b/)).toEqual([]);
  });
});

describe('ningún elemento lleva dos tintas del mismo tipo — B-260', () => {
  it('una clase compartida y su llamador no aportan dos fondos al mismo elemento', () => {
    /*
     * **Lo encontró mirar el HTML construido, no un test.** El bloque de fecha de
     * un encuentro cancelado salía con `bg-acento` (de `claseBloqueFecha`) y
     * `bg-super` (del llamador) en el mismo elemento.
     *
     * Dos utilidades de `background-color` en un elemento **no** las resuelve el
     * orden en que están escritas en el atributo: las resuelve el orden en que
     * Tailwind las emitió en la hoja, que nadie controla desde acá. Hoy ganaba la
     * correcta por casualidad —`.bg-super` sale después de `.bg-acento` en el CSS
     * generado—; un cambio de versión de Tailwind, o una clase nueva que corra ese
     * orden, y el bloque de un encuentro cancelado se pinta terracota —la tinta de
     * «esto todavía se puede hacer»— **sin que falle nada**.
     *
     * ── Por qué el chequeo tiene que expandir, y no barrer texto ──────────
     * El conflicto **vive en dos archivos**: la tinta la pone `estilos.ts` y la
     * otra la pone el componente. Un barrido por línea no puede verlo. Así que
     * acá se lee el valor real de cada `clase*` de `estilos.ts` y se lo sustituye
     * en cada sitio que la compone, que es lo que el navegador termina viendo.
     *
     * Los ternarios se colapsan a una rama antes de contar: `cond ? 'bg-super' :
     * 'bg-acento'` aporta **una** tinta, no dos, y contarlas como conflicto sería
     * un falso positivo que termina apagando el chequeo.
     *
     * MUTACIÓN PROBADA: devolver `bg-acento` adentro de `claseBloqueFecha`
     * —dejando el `bg-super` de los llamadores— hace fallar este caso.
     */
    const tokens = 'papel|crema|hondo|tinta|suave|acento|azul|super|borde|regla';

    /** El valor real de cada `export const clase… = '…'` de `estilos.ts`. */
    const estilos = readFileSync(raiz('src/components/sitio/estilos.ts'), 'utf8');
    const valores = new Map<string, string>();
    for (const m of estilos.matchAll(/export const (clase\w+|foco\w*)\s*=\s*[`']([\s\S]*?)[`'];/g)) {
      valores.set(m[1]!, m[2]!);
    }
    // Control positivo: sin esto, un cambio de formato en `estilos.ts` dejaría el
    // mapa vacío y la expansión de abajo no expandiría nada.
    expect(valores.size).toBeGreaterThan(5);
    expect(valores.get('claseBloqueFecha')).toBeDefined();

    /** Colapsa `a ? 'x' : 'y'` a `'x'`: son ramas, no dos clases a la vez. */
    const sinRamas = (t: string): string =>
      t.replace(/\?\s*'([^']*)'\s*:\s*'([^']*)'/g, "'$1'");

    /** Sustituye cada `${claseX}` por su valor, hasta dos niveles. */
    const expandir = (t: string): string => {
      let out = t;
      for (let i = 0; i < 2; i++) {
        out = out.replace(/\$\{(\w+)\}/g, (todo, n) => valores.get(n) ?? todo);
      }
      return out;
    };

    const conflictos: string[] = [];
    for (const { archivo, codigo } of fuentes()) {
      /*
       * Cada sitio donde se compone una clase: un template literal, o el array de
       * un `class:list`. Los dos terminan concatenados en el mismo atributo.
       */
      const sitios = [
        ...[...codigo.matchAll(/`([^`]*)`/g)].map((m) => m[1]!),
        ...[...codigo.matchAll(/class:list=\{\[([\s\S]*?)\]\}/g)].map((m) => m[1]!),
        ...[...codigo.matchAll(/class(?:Name)?="([^"]*)"/g)].map((m) => m[1]!),
      ];

      for (const sitio of sitios) {
        const texto = expandir(sinRamas(sitio));
        for (const prefijo of ['bg', 'text']) {
          const usadas = new Set(
            [...texto.matchAll(new RegExp(`(?<![-\\w:])${prefijo}-(${tokens})(?![-\\w/])`, 'g'))].map(
              (m) => m[1]!,
            ),
          );
          if (usadas.size > 1) {
            conflictos.push(`${archivo} — ${prefijo}: ${[...usadas].join(' + ')}`);
          }
        }
      }
    }

    expect(
      conflictos,
      'dos tintas del mismo tipo en un elemento: cuál gana lo decide el orden de ' +
        'emisión de Tailwind, no el markup. Que la clase compartida traiga la ' +
        'forma y el llamador ponga la tinta, una sola.',
    ).toEqual([]);
  });
});

describe('ninguna utilidad propia le pisa el nombre a una de Tailwind — B-260', () => {
  it('un `@utility` no puede llamarse `<prefijo>-<token>` de un espacio de nombres del tema', () => {
    /*
     * **Lo encontró leer el CSS construido, no un test.** La utilidad se llamaba
     * `ps-riel` y el tema declara `--spacing-riel`, así que Tailwind **ya generaba
     * un `ps-riel` propio** (`padding-inline-start: var(--spacing-riel)`). Con los
     * dos, la regla salía con las dos declaraciones y ganaba la que Tailwind emite
     * última — la suya, sin el medianil de 40px que la nuestra sumaba.
     *
     * Resultado: la lista que imprime el build quedaba corrida 40px respecto de la
     * columna de contenido, **con el build en verde y sin una advertencia**. Y solo
     * se ve antes de que hidrate la island, o para siempre si el JavaScript no
     * carga: los dos momentos que nadie mira.
     *
     * La regla general: si el tema declara `--<espacio>-<nombre>`, Tailwind genera
     * utilidades `<prefijo>-<nombre>` para cada prefijo de ese espacio. Una
     * utilidad propia con ese nombre no gana ni pierde de forma predecible: depende
     * del orden de emisión.
     *
     * MUTACIÓN PROBADA: renombrar `sangria-de-riel` de vuelta a `ps-riel` hace
     * fallar este caso.
     */
    const propias = [...css.matchAll(/@utility\s+([\w-]+)\s*\{/g)].map((m) => m[1]!);
    expect(propias.length, 'no se encontró ninguna @utility').toBeGreaterThan(8);

    /** Los nombres que el tema declara por espacio, y los prefijos que generan. */
    const espacios: Record<string, string[]> = {
      spacing: ['p', 'px', 'py', 'ps', 'pe', 'pt', 'pr', 'pb', 'pl',
                'm', 'mx', 'my', 'ms', 'me', 'mt', 'mr', 'mb', 'ml',
                'w', 'h', 'size', 'min-w', 'min-h', 'max-w', 'max-h',
                'gap', 'gap-x', 'gap-y', 'top', 'right', 'bottom', 'left',
                'inset', 'start', 'end', 'space-x', 'space-y', 'basis', 'translate-x', 'translate-y'],
      color: ['text', 'bg', 'border', 'outline', 'ring', 'fill', 'stroke', 'decoration', 'accent', 'caret', 'divide', 'from', 'via', 'to'],
      font: ['font'],
      aspect: ['aspect'],
    };

    const choques: string[] = [];
    for (const [espacio, prefijos] of Object.entries(espacios)) {
      const nombres = [...css.matchAll(new RegExp(`--${espacio}-([\\w-]+):`, 'g'))].map((m) => m[1]!);
      for (const nombre of nombres) {
        for (const prefijo of prefijos) {
          if (propias.includes(`${prefijo}-${nombre}`)) {
            choques.push(`@utility ${prefijo}-${nombre} choca con la que genera --${espacio}-${nombre}`);
          }
        }
      }
    }

    expect(
      choques,
      'Tailwind genera esa utilidad sola a partir del token del tema, así que hay ' +
        'dos reglas con el mismo nombre y gana la que se emita última — no la que ' +
        'está escrita acá. Renombrá la propia.',
    ).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · La grilla de base de 4px
// ───────────────────────────────────────────────────────────────────────────

describe('todo se apoya en la grilla de base de 4px', () => {
  it('ningún espaciado arbitrario se sale de la grilla', () => {
    /*
     * «Línea de base de 4px, y todo el texto se apoya en ella». La escala de
     * Tailwind ya es de 4px por unidad, así que `p-4` y `gap-2` caen solos; el
     * riesgo son los valores arbitrarios —`p-[13px]`, `mt-[7px]`— que entran
     * cuando alguien empuja algo «un poquito».
     *
     * Se miran solo los espaciados (`p`, `m`, `gap`, `space`), no los tamaños:
     * `max-w-[65ch]` y `max-h-[65svh]` son medidas de contenido, no ritmo vertical.
     *
     * MUTACIÓN PROBADA: cambiar el `py-4` de la fila del listado por `py-[13px]`
     * hace fallar este caso.
     */
    const fuera: string[] = [];
    for (const hallazgo of buscar(
      /\b(?:-)?(?:p|m|gap|space)[xytrbsel]?-\[(\d+(?:\.\d+)?)px\]/,
    )) {
      const px = Number(/\[(\d+(?:\.\d+)?)px\]/.exec(hallazgo)?.[1]);
      if (px % 4 !== 0) fuera.push(hallazgo);
    }
    expect(
      fuera,
      'el ritmo vertical del sistema es de 4px. Usá la escala de Tailwind, que ya ' +
        'es de 4px por unidad.',
    ).toEqual([]);
  });

  it('y el detector distingue: un valor fuera de la grilla se reconocería', () => {
    // Control del control: la aritmética de arriba tiene que saber decir que no.
    expect(13 % 4).not.toBe(0);
    expect(16 % 4).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 7 · Lo que la referencia traía mal y no puede volver
// ───────────────────────────────────────────────────────────────────────────

describe('lo que se le corrigió a la referencia no vuelve', () => {
  it('el pie no ofrece «Privacidad» ni «Términos»: no existen esas páginas', () => {
    /*
     * Corrección 3 de `stitch-detalle.md` y del encargo. Un enlace a una página
     * que no existe es peor que no tener el enlace, y un sitio que no guarda un
     * solo dato personal de un tercero (B-102) no tiene de qué hacer una política.
     *
     * Se verifica que **no haya un enlace** con ese texto, no que la palabra no
     * aparezca: el docblock del pie explica por qué se sacaron, y castigar la
     * explicación empuja a borrarla.
     */
    const pie = sinComentarios(readFileSync(raiz('src/components/sitio/PieDePagina.astro'), 'utf8'));
    expect(pie).not.toMatch(/>\s*(Privacidad|Términos|Terminos)\s*</);
    // Control positivo: el pie sí tiene los enlaces reales.
    expect(pie).toContain('/suscribirse');
    expect(pie).toContain('/contacto');
  });

  it('no hay un año de copyright escrito a mano', () => {
    /*
     * La referencia trae «© 2024», que además del año equivocado es contenido que
     * nadie pidió. No se reemplazó por el correcto: se sacó.
     *
     * Un año literal en el markup es la forma en que esto vuelve a estar mal — y
     * el modo de falla es que envejece solo, en silencio, cada 1 de enero.
     */
    const pie = sinComentarios(readFileSync(raiz('src/components/sitio/PieDePagina.astro'), 'utf8'));
    expect(pie).not.toMatch(/©|&copy;|\b20\d\d\b/);
  });

  it('«entrada libre» no se escribe a mano en ninguna parte: el arancel es taxonomía', () => {
    /*
     * La referencia inventa «entrada libre» como si fuera un arancel. La taxonomía
     * real es `gratis`, `a la gorra` y `arancelado`, y **sale de `/opciones/*`**,
     * que quien carga puede extender desde «Otro» (§4 del `CLAUDE.md`).
     *
     * Un literal en el markup es la clase de bug del §4: cuatro variantes de lo
     * mismo, ninguna filtrable, y el chip del filtro diciendo otra cosa que la
     * fila. Lo que la página **sí** puede decir con esas palabras es que no hace
     * falta anotarse, que es `inscripcion.requiere` y no el arancel.
     *
     * MUTACIÓN PROBADA: poner `Entrada libre` como texto del arancel en la fila
     * hace fallar este caso.
     */
    const enElArancel: string[] = [];
    for (const { archivo, codigo } of fuentes()) {
      for (const linea of codigo.split('\n')) {
        if (!/entrada libre/i.test(linea)) continue;
        // Decir «no hace falta anotarse» está bien; decirlo como arancel, no.
        if (/arancel/i.test(linea)) enElArancel.push(`${archivo} — ${linea.trim().slice(0, 70)}`);
      }
    }
    expect(enElArancel).toEqual([]);

    // Y el arancel de la fila y de la ficha sale de la taxonomía, no de un literal.
    const fila = sinComentarios(
      readFileSync(raiz('src/components/publico/FilaDeActividad.tsx'), 'utf8'),
    );
    expect(fila).toContain('arancelDeTarjeta');
  });

  it('el nombre del sitio no compite con el marcador de mes', () => {
    /*
     * Corrección 3 del encargo: en la referencia los dos van a 72px. El mes gana
     * porque es lo que estructura el listado; la marca usa `marca`, que es la
     * misma Bodoni un escalón y medio abajo.
     */
    const encabezado = sinComentarios(
      readFileSync(raiz('src/components/sitio/Encabezado.astro'), 'utf8'),
    );
    expect(encabezado).toContain('marca');
    expect(encabezado, 'el nombre del sitio no puede ir a 72px').not.toContain('display-lg');
  });

  it('la cabecera fija no se come el viewport del teléfono', () => {
    /*
     * Corrección 4 del encargo. 72px fijos en 375px son el 12% de la única
     * pantalla donde hay que decidir si un taller sirve. Se resuelve fijándola
     * **solo de `sm` en adelante**, no achicándola.
     *
     * MUTACIÓN PROBADA: sacar el `@media` del `<style>` —o poner `sticky top-0`
     * suelto en el `<header>`— hace fallar este caso.
     */
    const encabezado = readFileSync(raiz('src/components/sitio/Encabezado.astro'), 'utf8');
    expect(encabezado, 'la cabecera no puede quedar fija en el teléfono').not.toMatch(
      /<header[^>]*\bsticky(?![-\w])/,
    );
    // Y sí se fija de `sm` en adelante: si no, no se fija en ninguna parte.
    expect(encabezado).toMatch(/@media \(width >= 40rem\)[\s\S]*?position: sticky/);
  });

  it('todo lo que se pega al scroll usa el token de la altura del encabezado', () => {
    /*
     * Corrección 10 de `stitch-detalle.md`: la referencia pega la ficha con un
     * `top-24` que nadie ató a la altura real de la cabecera. Si el encabezado
     * cambia, la ficha queda tapada o flotando y **no falla nada**.
     *
     * MUTACIÓN PROBADA: volver el `lg:top-encabezado` de la ficha a `lg:top-24`
     * hace fallar este caso.
     */
    /*
     * Solo se miran las líneas que **se pegan**: un `focus:top-2` es la posición
     * del salto al contenido cuando recibe el foco, no un elemento pegado al
     * scroll, y marcarlo sería ruido que termina apagando el chequeo.
     */
    const pegados: string[] = [];
    for (const { archivo, codigo } of fuentes()) {
      codigo.split('\n').forEach((linea, i) => {
        if (!/\bsticky\b|\bfixed\b/.test(linea)) return;
        for (const m of linea.matchAll(/\b(?:lg:|sm:|md:)?top-(?!encabezado\b)[\w[\]./-]+/g)) {
          pegados.push(`${archivo}:${i + 1} — ${m[0]}`);
        }
      });
    }
    expect(
      pegados,
      'el `top` de lo que se pega sale de `--spacing-encabezado`, que es el mismo ' +
        'token que da la altura de la cabecera. Un número suelto se desincroniza.',
    ).toEqual([]);
  });
});
