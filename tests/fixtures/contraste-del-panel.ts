/**
 * La mecánica del contraste del panel — B-1630, B-1750, B-1751, B-1830.
 *
 * Vive acá y no en `tests/contraste-del-panel.test.ts` para que la use también
 * `tests/contraste-del-arbol.render.test.tsx` sin importar un archivo de tests
 * (que haría correr sus tests dos veces). Lo que se comparte es **la mecánica**
 * —los colores leídos de `global.css` y de la paleta de Tailwind instalada, la
 * lectura de una clase de fondo o de tinta, la peor base, la composición— y no
 * el criterio: las listas de excepciones, cada una con su porqué, siguen en el
 * test que las usa. Dos copias de la mezcla serían dos respuestas posibles a la
 * misma pregunta.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

import { contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';
import { archivosDelRepo } from './archivos-del-repo';

/**
 * Una ruta relativa a la raíz del repo. Se arma con `node:path` y no con
 * `new URL(rel, import.meta.url)`: bajo jsdom (los `*.render.test.tsx`) el `URL`
 * global es el de jsdom, y `fileURLToPath` de Node no lo reconoce.
 */
export const raiz = (rel: string): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), '../..', rel);

/**
 * Lo que se lee del disco se lee una vez: cada fondo translúcido se compone
 * sobre la peor base, y recalcularla por fondo relee el panel entero cientos de
 * veces.
 */
export const unaVez = <T>(f: () => T): (() => T) => {
  let hecho: { valor: T } | null = null;
  return () => (hecho ??= { valor: f() }).valor;
};

export const css = unaVez((): string => readFileSync(raiz('src/styles/global.css'), 'utf8'));

/**
 * La paleta de Tailwind **instalada**, no la de la documentación: es la que
 * compila el build. En la 4 los colores vienen en OKLCH con la luminosidad en
 * porcentaje (`oklch(96.2% 0.059 95.617)`).
 */
export const paletaTailwind = unaVez((): string =>
  readFileSync(raiz('node_modules/tailwindcss/theme.css'), 'utf8'),
);

export const BLANCO: Srgb = [1, 1, 1];
export const NEGRO: Srgb = [0, 0, 0];

/** Un token de color de la paleta, leído de la hoja de estilos y no copiado. */
export const token = (nombre: string): Srgb => {
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
export const colorDe = (nombre: string): Srgb | null => {
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
export const alfa = (corchete: string | undefined, entero: string | undefined): number =>
  corchete ? Number(corchete) : entero ? Number(entero) / 100 : 1;

/**
 * El markup del panel. `campos/` salió de `components/admin/` en B-827 pero son
 * los campos del panel (`docs/05-patrones.md`), así que entra.
 */
export const archivosDelPanel = (): string[] =>
  archivosDelRepo('src/components/admin', 'src/components/campos').filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
  );

export const fuentes = unaVez((): { donde: string; src: string }[] =>
  archivosDelPanel().map((f) => ({ donde: f, src: readFileSync(raiz(f), 'utf8') })),
);

/**
 * Las variantes que no se miden, con su motivo. WCAG 1.4.3 exime el texto de un
 * **componente inactivo**: un botón deshabilitado puede quedar por debajo del
 * piso, y es la señal de que no se puede usar.
 */
export const VARIANTES_EXENTAS = /^(?:disabled|group-disabled|peer-disabled|aria-disabled):/;

/**
 * Las superficies opacas del panel: el blanco y los tokens que usa como fondo
 * pleno. El papel entra siempre: es el `background` del `html` en `global.css`,
 * o sea el fondo de todo lo que no está dentro de una tarjeta.
 */
export const superficies = (): { nombre: string; color: Srgb }[] => {
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
export const laMasOscura = <T extends { color: Srgb }>(grupo: T[]): T =>
  [...grupo].sort((a, b) => contraste(b.color, BLANCO) - contraste(a.color, BLANCO))[0]!;

/** La base opaca más oscura: lo peor que puede haber abajo de un tinte. */
export const peorBase = unaVez((): { nombre: string; color: Srgb } => laMasOscura(superficies()));

/** Una clase de fondo, en el grupo de clases donde aparece. */
export const RE_FONDO = /((?:[a-z-]+:)*)bg-([a-z]+(?:-\d{2,3})?)(?:\/(?:\[(0?\.\d+)\]|(\d{1,3})))?(?![\w[-])/g;
export const RE_TINTA = /((?:[a-z-]+:)*)text-([a-z]+(?:-\d{2,3})?)(?:\/(?:\[(0?\.\d+)\]|(\d{1,3})))?(?![\w[-])/g;

export interface Fondo {
  archivo: string;
  donde: string;
  /** Sin la variante: `bg-acento/10`. Es la clave de `FONDOS_SIN_TEXTO_ATENUADO`. */
  clase: string;
  /** Ya compuesto sobre la peor base si es translúcido. */
  color: Srgb;
}

/** Un fondo leído del markup, resuelto a color. `null` si no es un color. */
export const resolverFondo = (m: RegExpMatchArray, archivo: string, donde: string): Fondo | null => {
  if (VARIANTES_EXENTAS.test(m[1]!)) return null;
  const base = colorDe(m[2]!);
  if (!base) return null;
  const a = alfa(m[3], m[4]);
  const clase = `bg-${m[2]}${m[3] ? `/[${m[3]}]` : m[4] ? `/${m[4]}` : ''}`;
  return { archivo, donde, clase, color: a < 1 ? mezclar(base, peorBase().color, a) : base };
};

/**
 * Oscura quiere decir que el blanco contrasta más que la tinta: encima va
 * `text-white` o `text-papel`, no texto atenuado. Son `bg-tinta`, `bg-acento` y
 * sus `hover:`; los mide el caso de los pares.
 */
export const esOscura = (c: Srgb): boolean => contraste(c, BLANCO) > contraste(c, token('tinta'));

export const ratio = (opacidad: number, fondo: Srgb): number =>
  contraste(mezclar(token('tinta'), fondo, opacidad), fondo);
