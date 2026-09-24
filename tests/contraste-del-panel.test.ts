import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { claseFilaApagada } from '@/components/campos/Campo';
import { AA_TEXTO, contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

/**
 * El contraste del texto atenuado **del panel** — B-1630, B-1750, B-1751.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 * `contraste-del-sitio.test.ts` y `contraste-de-superficies.test.ts` barren solo
 * el sitio público, y lo dicen: «el panel tiene su propio criterio y no entra».
 * Ese criterio nunca se escribió, y el panel atenuaba con `text-tinta/50` y `/55`
 * de forma habitual —el tablero entero, las notas de los repartos, la ayuda de
 * cada campo— sobre tarjetas blancas. Sobre blanco `/55` da 3,85:1 y `/45`
 * 2,86:1, contra un piso de 4,5. Es texto chico y justo el que califica los
 * números. D-1006 lo había arreglado para una sección (`Ritmo.tsx`, medida en su
 * propio test); el resto del panel seguía igual.
 *
 * El panel **no sigue el sistema visual del sitio** (`docs/05-patrones.md` §
 * «Estilo de UI»): puede atenuar con opacidades. Lo que no puede es atenuar por
 * debajo de AA. Éste es su piso.
 *
 * ── El mismo método que el del sitio ──────────────────────────────────────
 * Los colores **se leen de `global.css`**, no se copian; las superficies **se
 * leen del markup del panel**: el blanco de Tailwind, más cada token claro
 * (`papel`, `crema`, `hondo`) que el panel use como fondo pleno. Importa:
 * `text-tinta/60` da 4,51 sobre blanco y **4,43 sobre el papel**, que es el fondo
 * de la página del panel. Medir solo contra el blanco dejaría pasar un `/60` que
 * abajo de la tarjeta no alcanza.
 *
 * ── Los tintes — B-1751 ──────────────────────────────────────────────────
 * El panel también apoya texto sobre tintes: `bg-acento/5` y `/10`,
 * `bg-black/5`, `bg-tinta/8`, `bg-amber-50`/`-100`, `bg-emerald-100`. Salen del
 * markup igual que las superficies plenas, con su variante (`hover:` cuenta: el
 * texto se sigue leyendo con el puntero encima). Los colores que no son tokens
 * del proyecto **se leen de la paleta de Tailwind instalada**
 * (`node_modules/tailwindcss/theme.css`), no se copian. Un tinte translúcido se
 * compone sobre la base opaca más oscura del panel, que es el peor caso de lo
 * que puede haber abajo. Lo que no lleva texto —los puntos de estado, el velo
 * de un diálogo— va en `FONDOS_SIN_TEXTO_ATENUADO` con su porqué.
 *
 * Y además del piso de `text-tinta/NN`, cada par **fondo + tinta con nombre**
 * declarado en el mismo grupo de clases (`bg-amber-200 text-amber-900`,
 * `bg-acento/10 text-acento`) se mide como par.
 *
 * ── Las opacidades — B-1750 ──────────────────────────────────────────────
 * Un `opacity-NN` en un contenedor **multiplica** la atenuación de todo lo de
 * adentro: una fila con `opacity-60` y un `text-tinta/65` adentro pinta ~`/39`
 * (≈2,5:1). Este barrido lee por línea y no por árbol, así que no puede
 * componerlo: por eso no lo intenta y **frena el `opacity-NN`** mismo. Una fila
 * que ya no rige se apaga con `claseFilaApagada` (fondo y tinta, que no se
 * multiplican). Lo que tenga que quedar con `opacity` a propósito va en
 * `OPACIDADES_CON_MOTIVO`. `disabled:` sigue exento (WCAG 1.4.3), igual que
 * `opacity-0` y `-100`, que no atenúan: esconden o muestran.
 *
 * ── Lo que NO puede ver ───────────────────────────────────────────────────
 * - Un texto con tinta de nombre (`text-acento`) sobre un tinte **heredado** de
 *   un ancestro: el par se mide solo si las dos clases van en el mismo grupo.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/**
 * Lo que se lee del disco se lee una vez: cada fondo translúcido se compone
 * sobre la peor base, y recalcularla por fondo relee el panel entero cientos de
 * veces.
 */
const unaVez = <T>(f: () => T): (() => T) => {
  let hecho: { valor: T } | null = null;
  return () => (hecho ??= { valor: f() }).valor;
};

const css = unaVez((): string => readFileSync(raiz('src/styles/global.css'), 'utf8'));

/**
 * La paleta de Tailwind **instalada**, no la de la documentación: es la que
 * compila el build. En la 4 los colores vienen en OKLCH con la luminosidad en
 * porcentaje (`oklch(96.2% 0.059 95.617)`).
 */
const paletaTailwind = unaVez((): string =>
  readFileSync(raiz('node_modules/tailwindcss/theme.css'), 'utf8'),
);

const BLANCO: Srgb = [1, 1, 1];
const NEGRO: Srgb = [0, 0, 0];

/** Un token de color de la paleta, leído de la hoja de estilos y no copiado. */
const token = (nombre: string): Srgb => {
  const m = css().match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
};

/**
 * El color de un nombre de Tailwind: primero los tokens del proyecto, después la
 * paleta instalada. `null` si no es un color (`bg-cover`, `text-xs`).
 */
const colorDe = (nombre: string): Srgb | null => {
  if (nombre === 'white') return BLANCO;
  if (nombre === 'black') return NEGRO;
  const propio = css().match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  if (propio) return oklchASrgb(Number(propio[1]), Number(propio[2]), Number(propio[3]));
  const deTailwind = paletaTailwind().match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  if (deTailwind) {
    return oklchASrgb(Number(deTailwind[1]) / 100, Number(deTailwind[2]), Number(deTailwind[3]));
  }
  return null;
};

/** `/10` → 0,1; `/[0.03]` → 0,03; sin fracción → 1. */
const alfa = (corchete: string | undefined, entero: string | undefined): number =>
  corchete ? Number(corchete) : entero ? Number(entero) / 100 : 1;

/**
 * El markup del panel. `campos/` salió de `components/admin/` en B-827 pero son
 * los campos del panel (`docs/05-patrones.md`), así que entra.
 */
const archivosDelPanel = (): string[] =>
  archivosDelRepo('src/components/admin', 'src/components/campos').filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
  );

const fuentes = unaVez((): { donde: string; src: string }[] =>
  archivosDelPanel().map((f) => ({ donde: f, src: readFileSync(raiz(f), 'utf8') })),
);

/**
 * Las excepciones al piso, **cada una con su porqué**. La clave es
 * `archivo|clase`; una excepción que ya no se usa hace fallar el test, así no
 * sobrevive a su motivo.
 */
const EXCEPCIONES: Record<string, string> = {};

/**
 * Las variantes que no se miden, con su motivo. WCAG 1.4.3 exime el texto de un
 * **componente inactivo**: un botón deshabilitado puede quedar por debajo del
 * piso, y es la señal de que no se puede usar.
 */
const VARIANTES_EXENTAS = /^(?:disabled|group-disabled|peer-disabled|aria-disabled):/;

/** Cada `text-tinta/NN` del panel, con su variante, su línea y su opacidad. */
const atenuaciones = (): { archivo: string; donde: string; clase: string; opacidad: number }[] => {
  const out: { archivo: string; donde: string; clase: string; opacidad: number }[] = [];
  for (const { donde, src } of fuentes()) {
    src.split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(/((?:[a-z-]+:)*)text-tinta\/(\d{1,3})\b/g)) {
        if (VARIANTES_EXENTAS.test(m[1]!)) continue;
        out.push({
          archivo: donde,
          donde: `${donde}:${i + 1}`,
          clase: `text-tinta/${m[2]}`,
          opacidad: Number(m[2]) / 100,
        });
      }
    });
  }
  return out;
};

/**
 * Las superficies opacas del panel: el blanco y los tokens que usa como fondo
 * pleno. El papel entra siempre: es el `background` del `html` en `global.css`,
 * o sea el fondo de todo lo que no está dentro de una tarjeta.
 */
const superficies = (): { nombre: string; color: Srgb }[] => {
  const todo = fuentes()
    .map((f) => f.src)
    .join('\n');
  return [
    { nombre: 'blanco', color: BLANCO },
    ...['papel', 'crema', 'hondo']
      .filter((t) => new RegExp(`\\bbg-${t}(?![\\w/-])`).test(todo) || t === 'papel')
      .map((t) => ({ nombre: t, color: token(t) })),
  ];
};

/** La más oscura de un grupo: la que más contrasta contra el blanco. */
const laMasOscura = <T extends { color: Srgb }>(grupo: T[]): T =>
  [...grupo].sort((a, b) => contraste(b.color, BLANCO) - contraste(a.color, BLANCO))[0]!;

/** La base opaca más oscura: lo peor que puede haber abajo de un tinte. */
const peorBase = unaVez((): { nombre: string; color: Srgb } => laMasOscura(superficies()));

/** Una clase de fondo, en el grupo de clases donde aparece. */
const RE_FONDO = /((?:[a-z-]+:)*)bg-([a-z]+(?:-\d{2,3})?)(?:\/(?:\[(0?\.\d+)\]|(\d{1,3})))?(?![\w[-])/g;
const RE_TINTA = /((?:[a-z-]+:)*)text-([a-z]+(?:-\d{2,3})?)(?:\/(?:\[(0?\.\d+)\]|(\d{1,3})))?(?![\w[-])/g;

interface Fondo {
  archivo: string;
  donde: string;
  /** Sin la variante: `bg-acento/10`. Es la clave de `FONDOS_SIN_TEXTO_ATENUADO`. */
  clase: string;
  /** Ya compuesto sobre la peor base si es translúcido. */
  color: Srgb;
}

/** Un fondo leído del markup, resuelto a color. `null` si no es un color. */
const resolverFondo = (m: RegExpMatchArray, archivo: string, donde: string): Fondo | null => {
  if (VARIANTES_EXENTAS.test(m[1]!)) return null;
  const base = colorDe(m[2]!);
  if (!base) return null;
  const a = alfa(m[3], m[4]);
  const clase = `bg-${m[2]}${m[3] ? `/[${m[3]}]` : m[4] ? `/${m[4]}` : ''}`;
  return { archivo, donde, clase, color: a < 1 ? mezclar(base, peorBase().color, a) : base };
};

/** Cada fondo del panel que resuelve a un color. */
const fondos = (): Fondo[] => {
  const out: Fondo[] = [];
  for (const { donde, src } of fuentes()) {
    src.split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(RE_FONDO)) {
        const f = resolverFondo(m, donde, `${donde}:${i + 1}`);
        if (f) out.push(f);
      }
    });
  }
  return out;
};

/**
 * Oscura quiere decir que el blanco contrasta más que la tinta: encima va
 * `text-white` o `text-papel`, no texto atenuado. Son `bg-tinta`, `bg-acento` y
 * sus `hover:`; los mide el caso de los pares.
 */
const esOscura = (c: Srgb): boolean => contraste(c, BLANCO) > contraste(c, token('tinta'));

/**
 * Los fondos claros **que no llevan texto atenuado encima**, con su porqué. La
 * clave es `archivo|clase`. Una entrada que ya no se usa hace fallar el test.
 */
const FONDOS_SIN_TEXTO_ATENUADO: Record<string, string> = {
  'src/components/admin/CalendarioActividades.tsx|bg-acento/40':
    'punto de estado de publicación (`size-1.5`, `aria-hidden`): no lleva texto',
  'src/components/admin/CalendarioActividades.tsx|bg-tinta/30':
    'punto de estado de publicación y de cierre: no lleva texto',
  'src/components/admin/CalendarioActividades.tsx|bg-amber-300':
    'punto de estado «pendiente»: no lleva texto',
  'src/components/admin/CalendarioActividades.tsx|bg-amber-400':
    'punto de estado «sobra en Calendar»: no lleva texto',
  'src/components/admin/CalendarioActividades.tsx|bg-emerald-500':
    'punto de estado «en Calendar»: no lleva texto',
  'src/components/admin/CalendarioActividades.tsx|bg-sky-500':
    'punto de estado del cierre «por venir»: no lleva texto',
  'src/components/admin/DialogoDuplicar.tsx|bg-tinta/40':
    'velo detrás del diálogo: el texto va en la tarjeta blanca de encima',
  'src/components/admin/ayuda/CentroAyuda.tsx|bg-tinta/40':
    'velo detrás del diálogo: el texto va en la tarjeta blanca de encima',
  'src/components/admin/estadisticas/Ritmo.tsx|bg-acento/40':
    'celda más cargada del mapa de calor: lleva `text-tinta` plena, que mide el caso de los pares y el test de Ritmo (D-1006)',
};

/** Los tintes claros sobre los que puede caer texto atenuado. */
const tintesConTexto = (): Fondo[] =>
  fondos().filter(
    (f) => !esOscura(f.color) && !(`${f.archivo}|${f.clase}` in FONDOS_SIN_TEXTO_ATENUADO),
  );

/** Toda superficie clara sobre la que el panel apoya texto atenuado. */
const superficiesConTexto = (): { nombre: string; color: Srgb }[] => [
  ...superficies(),
  ...tintesConTexto().map((f) => ({ nombre: `${f.clase} (${f.donde})`, color: f.color })),
];

/** La más oscura: si una atenuación pasa acá, pasa en cualquiera. */
const peorSuperficie = (): { nombre: string; color: Srgb } => laMasOscura(superficiesConTexto());

const ratio = (opacidad: number, fondo: Srgb): number =>
  contraste(mezclar(token('tinta'), fondo, opacidad), fondo);

/**
 * Cada par fondo + tinta **del mismo grupo de clases**. Un grupo es lo que va
 * entre comillas, o una rama de un ternario: `activo ? 'bg-tinta text-papel' :
 * 'text-tinta/65 hover:bg-black/5'` son dos grupos y no cuatro pares.
 */
const pares = (): { donde: string; par: string; r: number }[] => {
  const out: { donde: string; par: string; r: number }[] = [];
  for (const { donde, src } of fuentes()) {
    src.split('\n').forEach((linea, i) => {
      for (const grupo of linea.split(/[`'"{}]|\s\?\s|\s:\s/)) {
        const bgs = [...grupo.matchAll(RE_FONDO)]
          .map((m) => resolverFondo(m, donde, `${donde}:${i + 1}`))
          .filter((f): f is Fondo => f !== null);
        for (const t of grupo.matchAll(RE_TINTA)) {
          if (VARIANTES_EXENTAS.test(t[1]!)) continue;
          const color = colorDe(t[2]!);
          if (!color) continue;
          for (const bg of bgs) {
            const texto = mezclar(color, bg.color, alfa(t[3], t[4]));
            out.push({
              donde: `${donde}:${i + 1}`,
              par: `${bg.clase} + ${t[0]}`,
              r: contraste(texto, bg.color),
            });
          }
        }
      }
    });
  }
  return out;
};

/**
 * Los `opacity-NN` que quedan **a propósito**, con su porqué — B-1750. La clave
 * es `archivo|clase`, y una entrada huérfana hace fallar el test.
 */
const OPACIDADES_CON_MOTIVO: Record<string, string> = {
  'src/components/admin/GaleriaEditor.tsx|opacity-60':
    'el `<label>` es el botón de «Subir una imagen», y mientras sube su input está ' +
    '`disabled`: es un control inactivo, que WCAG 1.4.3 exime. No lleva variante ' +
    '`disabled:` porque el `disabled` es del input, no del label.',
};

/**
 * Cada `opacity-NN` del panel que atenúa: sin variante exenta, ni `-0` ni
 * `-100`. Lo que va entre dos acentos graves (`` `opacity-60` ``) es prosa de
 * un comentario, no una clase.
 */
const opacidades = (): { archivo: string; donde: string; clase: string }[] => {
  const out: { archivo: string; donde: string; clase: string }[] = [];
  for (const { donde, src } of fuentes()) {
    src.split('\n').forEach((linea, i) => {
      for (const m of linea.matchAll(/((?:[a-z-]+:)*)opacity-(\d{1,3}|\[[^\]]+\])(?![\w-])/g)) {
        const fin = m.index! + m[0].length;
        if (linea[m.index! - 1] === '`' && linea[fin] === '`') continue;
        if (VARIANTES_EXENTAS.test(m[1]!)) continue;
        if (m[2] === '0' || m[2] === '100') continue;
        out.push({ archivo: donde, donde: `${donde}:${i + 1}`, clase: `opacity-${m[2]}` });
      }
    });
  }
  return out;
};

describe('el contraste del texto atenuado del panel — B-1630', () => {
  it('el barrido encuentra markup, atenuaciones y más de una superficie', () => {
    // Control positivo: los asertos de abajo afirman listas vacías, y una lista
    // vacía es también lo que devuelve un barrido que no leyó nada.
    expect(archivosDelPanel().length).toBeGreaterThan(30);
    expect(atenuaciones().length).toBeGreaterThan(100);
    expect(superficies().length).toBeGreaterThanOrEqual(2);
    expect(peorSuperficie().nombre).not.toBe('blanco');
  });

  it('control negativo: /55 no pasa sobre blanco, y /60 pasa sobre blanco pero no sobre papel', () => {
    // Si la aritmética devolviera siempre un número alto, el caso de abajo daría
    // verde igual. Y el segundo par es por lo que se mide contra la peor
    // superficie y no contra la tarjeta.
    expect(ratio(0.55, BLANCO)).toBeLessThan(AA_TEXTO);
    expect(ratio(0.6, BLANCO)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(ratio(0.6, token('papel'))).toBeLessThan(AA_TEXTO);
  });

  it('ninguna atenuación del panel queda por debajo de AA sobre su superficie más oscura', () => {
    const peor = peorSuperficie();
    const flojas = atenuaciones()
      .filter((a) => !(`${a.archivo}|${a.clase}` in EXCEPCIONES))
      .map((a) => ({ ...a, r: ratio(a.opacidad, peor.color) }))
      .filter((a) => a.r < AA_TEXTO)
      .map((a) => `${a.donde} — ${a.clase} da ${a.r.toFixed(2)}:1`);

    expect(
      flojas,
      `estas atenuaciones no llegan a ${AA_TEXTO}:1 sobre «${peor.nombre}», la superficie ` +
        'más oscura del panel. Subí la opacidad: el piso con esta paleta es /65. Si tiene ' +
        'que quedar abajo a propósito, declarala en EXCEPCIONES con su porqué.',
    ).toEqual([]);
  });

  it('cada excepción tiene motivo, se sigue usando y de verdad está abajo del piso', () => {
    const peor = peorSuperficie();
    const usadas = new Set(atenuaciones().map((a) => `${a.archivo}|${a.clase}`));
    const mal: string[] = [];
    for (const [clave, motivo] of Object.entries(EXCEPCIONES)) {
      if (!motivo.trim()) mal.push(`${clave}: sin motivo`);
      if (!usadas.has(clave)) mal.push(`${clave}: ya no se usa — borrá la excepción`);
      const opacidad = Number(clave.split('/').pop()) / 100;
      if (ratio(opacidad, peor.color) >= AA_TEXTO) mal.push(`${clave}: pasa el piso, no es excepción`);
    }
    expect(mal).toEqual([]);
  });
});

describe('el contraste del panel sobre sus tintes — B-1751', () => {
  it('control positivo: encuentra los tintes que el panel usa, con la paleta de Tailwind', () => {
    // Los seis que nombraba el ítem. Si el parseo de la paleta instalada fallara,
    // los de Tailwind no resolverían a color y se caerían del barrido sin decirlo.
    const clases = new Set(tintesConTexto().map((f) => f.clase));
    for (const c of [
      'bg-acento/5',
      'bg-acento/10',
      'bg-black/5',
      'bg-amber-50',
      'bg-amber-100',
      'bg-emerald-100',
    ]) {
      expect(clases, `no se encontró ${c}`).toContain(c);
    }
    expect(colorDe('amber-100')).not.toBeNull();
    expect(colorDe('no-es-un-color')).toBeNull();
  });

  it('control negativo: con los tintes, la peor superficie es más oscura que la peor base', () => {
    // Si los tintes no entraran al cálculo, la peor superficie seguiría siendo
    // la base y este archivo volvería a medir lo mismo que antes de B-1751.
    expect(contraste(peorSuperficie().color, BLANCO)).toBeGreaterThan(
      contraste(peorBase().color, BLANCO),
    );
    // Y el velo del diálogo, si se colara como superficie, dejaría todo en rojo:
    // es lo que justifica declararlo aparte.
    const velo = mezclar(token('tinta'), peorBase().color, 0.4);
    expect(esOscura(velo)).toBe(false);
    expect(ratio(0.65, velo)).toBeLessThan(AA_TEXTO);
  });

  it('cada fondo sin texto atenuado tiene motivo, se sigue usando y es claro', () => {
    const usados = new Set(fondos().map((f) => `${f.archivo}|${f.clase}`));
    const mal: string[] = [];
    for (const [clave, motivo] of Object.entries(FONDOS_SIN_TEXTO_ATENUADO)) {
      if (!motivo.trim()) mal.push(`${clave}: sin motivo`);
      if (!usados.has(clave)) mal.push(`${clave}: ya no se usa — borrá la entrada`);
    }
    expect(mal).toEqual([]);
  });

  it('cada par fondo + tinta del mismo grupo de clases llega a AA', () => {
    const todos = pares();
    // Control positivo: sin pares, el aserto de abajo daría verde sin mirar nada.
    expect(todos.length).toBeGreaterThan(20);
    const flojos = todos
      .filter((p) => p.r < AA_TEXTO)
      .map((p) => `${p.donde} — ${p.par} da ${p.r.toFixed(2)}:1`);
    expect(
      flojos,
      `estos pares no llegan a ${AA_TEXTO}:1. Oscurecé la tinta o aclarale el fondo.`,
    ).toEqual([]);
  });
});

describe('las filas apagadas no se apagan con opacity — B-1750', () => {
  it('control positivo: el barrido reconoce un opacity-NN, y deja pasar disabled: y la prosa', () => {
    // Las OPACIDADES_CON_MOTIVO existen, así que el barrido las tiene que ver; y
    // los `disabled:opacity-50` de los botones, que son decenas, no.
    expect(opacidades().length).toBeGreaterThan(0);
    const todo = fuentes()
      .map((f) => f.src)
      .join('\n');
    expect(todo).toMatch(/disabled:opacity-50/);
    expect(opacidades().some((o) => o.clase === 'opacity-50')).toBe(false);
  });

  it('ningún opacity-NN atenúa texto del panel sin su motivo', () => {
    const sueltas = opacidades()
      .filter((o) => !(`${o.archivo}|${o.clase}` in OPACIDADES_CON_MOTIVO))
      .map((o) => `${o.donde} — ${o.clase}`);
    expect(
      sueltas,
      'un `opacity-NN` se multiplica con la tinta de lo de adentro (`opacity-60` × ' +
        '`text-tinta/65` ≈ `/39`, 2,5:1). Apagá la fila con `claseFilaApagada` de ' +
        '`campos/Campo.tsx`; si es un control inactivo, usá `disabled:` o declaralo en ' +
        'OPACIDADES_CON_MOTIVO con su porqué.',
    ).toEqual([]);
  });

  it('cada opacidad con motivo tiene motivo y se sigue usando', () => {
    const usadas = new Set(opacidades().map((o) => `${o.archivo}|${o.clase}`));
    const mal: string[] = [];
    for (const [clave, motivo] of Object.entries(OPACIDADES_CON_MOTIVO)) {
      if (!motivo.trim()) mal.push(`${clave}: sin motivo`);
      if (!usadas.has(clave)) mal.push(`${clave}: ya no se usa — borrá la entrada`);
    }
    expect(mal).toEqual([]);
  });

  it('una fila apagada se ve distinta de una viva, y su tinta llega a AA sobre su fondo', () => {
    // «Distinta» dicho en números: el fondo no es el blanco de la fila viva, y la
    // tinta que hereda lo que no dice la suya no es la plena.
    expect(claseFilaApagada).not.toMatch(/opacity-/);
    const fondo = [...claseFilaApagada.matchAll(RE_FONDO)]
      .map((m) => resolverFondo(m, 'Campo.tsx', 'Campo.tsx'))
      .find((f): f is Fondo => f !== null);
    expect(fondo, 'claseFilaApagada no trae fondo').toBeDefined();
    expect(contraste(fondo!.color, BLANCO)).toBeGreaterThan(1.03);
    const tinta = claseFilaApagada.match(/text-tinta\/(\d{1,3})/);
    expect(tinta, 'claseFilaApagada no trae tinta atenuada').not.toBeNull();
    const opacidad = Number(tinta![1]) / 100;
    expect(opacidad).toBeLessThan(1);
    expect(ratio(opacidad, fondo!.color)).toBeGreaterThanOrEqual(AA_TEXTO);
  });
});
