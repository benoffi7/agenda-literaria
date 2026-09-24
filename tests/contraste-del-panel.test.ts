import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';
import { archivosDelRepo } from './fixtures/archivos-del-repo';

/**
 * El contraste del texto atenuado **del panel** — B-1630.
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
 * (`papel`, `crema`, `hondo`) que el panel use como fondo pleno. Se mide contra
 * la más oscura. Importa: `text-tinta/60` da 4,51 sobre blanco y **4,43 sobre el
 * papel**, que es el fondo de la página del panel. Medir solo contra el blanco
 * dejaría pasar un `/60` que abajo de la tarjeta no alcanza.
 *
 * ── Lo que NO puede ver ───────────────────────────────────────────────────
 * - Texto sobre los tintes (`bg-acento/5`, `bg-amber-50`, `bg-black/5`): no se
 *   miden acá.
 * - Un `opacity-NN` en un contenedor, que multiplica la atenuación de todo lo de
 *   adentro: una fila con `opacity-60` y un `text-tinta/65` adentro pinta
 *   ~`/39`. Se lee por archivo y no por árbol, así que no lo compone.
 *   Los dos quedan anotados en el BACKLOG.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

const css = (): string => readFileSync(raiz('src/styles/global.css'), 'utf8');

const BLANCO: Srgb = [1, 1, 1];

/** Un token de color de la paleta, leído de la hoja de estilos y no copiado. */
const token = (nombre: string): Srgb => {
  const m = css().match(
    new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
  return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
};

/**
 * El markup del panel. `campos/` salió de `components/admin/` en B-827 pero son
 * los campos del panel (`docs/05-patrones.md`), así que entra.
 */
const archivosDelPanel = (): string[] =>
  archivosDelRepo('src/components/admin', 'src/components/campos').filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f),
  );

const fuentes = (): { donde: string; src: string }[] =>
  archivosDelPanel().map((f) => ({ donde: f, src: readFileSync(raiz(f), 'utf8') }));

/**
 * Las excepciones al piso, **cada una con su porqué**. La clave es
 * `archivo|clase`; una excepción que ya no se usa hace fallar el test, así no
 * sobrevive a su motivo.
 *
 * Las TEMPORALES son los archivos del frente `panel-ux` de la tanda del
 * 2026-09-24, que otro frente estaba tocando en paralelo: se suben ahí y, al
 * subirlas, estas líneas fallan por huérfanas y se borran.
 */
const EXCEPCIONES: Record<string, string> = {
};

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
 * Las superficies claras del panel: el blanco y los tokens que usa como fondo
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

/** La más oscura: la que más contrasta contra el blanco. */
const peorSuperficie = (): { nombre: string; color: Srgb } =>
  [...superficies()].sort((a, b) => contraste(b.color, BLANCO) - contraste(a.color, BLANCO))[0]!;

const ratio = (opacidad: number, fondo: Srgb): number =>
  contraste(mezclar(token('tinta'), fondo, opacidad), fondo);

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
