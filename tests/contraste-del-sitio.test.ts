import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { AA_TEXTO, contraste, mezclar, oklchASrgb, type Srgb } from '@/lib/contraste';

/**
 * Ninguna página del sitio atenúa texto por debajo de AA — B-235.
 *
 * ── Por qué un test y no criterio ─────────────────────────────────────────
 * `text-tinta/60` da **4,49:1** contra un piso de 4,5. Cuatro centésimas. Se ve
 * bien, pasa cualquier revisión a ojo, y no cumple. Lo encontró un frente en sus
 * propias páginas y **ese mismo día otro frente publicó dos `/45`** (2,86:1) en
 * los marcadores de una lista de pasos numerados, que son contenido: si no se
 * leen, no se sabe cuál es el paso 3.
 *
 * O sea: la regla no se sostiene con atención, ni siquiera con atención el mismo
 * día. Tres frentes en paralelo la rompieron dos veces en una tarde.
 *
 * ── Lo que hace bien ──────────────────────────────────────────────────────
 * **Los colores se leen de `global.css`, no se copian acá.** Un piso escrito a
 * mano —«nunca menos de /65»— sería cierto para esta paleta y mentira para la
 * siguiente, y nadie se enteraría: el test seguiría verde con una tinta más
 * clara. Leyendo los tokens, aclarar la paleta pone en rojo las opacidades que
 * dejaron de alcanzar, que es justo cuando hay que revisarlas.
 *
 * ── Lo que NO puede ver ───────────────────────────────────────────────────
 * Texto sobre un fondo que no sea `papel` (una tarjeta con fondo propio), color
 * puesto por CSS y no por clase, y el tamaño de letra —AA baja el piso a 3:1 en
 * texto grande, y esto no distingue—. Es deliberado: pide de más en un caso raro
 * antes que dejar pasar en el común. Si algún día hace falta la excepción, va en
 * `PERMITIDOS` con su motivo, no aflojando el piso.
 */
const raiz = (rel: string): string => fileURLToPath(new URL(`../${rel}`, import.meta.url));

/** Los dos tokens, leídos de la hoja de estilos y no copiados. */
const paleta = (): { tinta: Srgb; papel: Srgb } => {
  const css = readFileSync(raiz('src/styles/global.css'), 'utf8');
  const token = (nombre: string): Srgb => {
    const m = css.match(
      new RegExp(`--color-${nombre}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
    );
    expect(m, `no se encontró --color-${nombre} en global.css`).not.toBeNull();
    return oklchASrgb(Number(m![1]), Number(m![2]), Number(m![3]));
  };
  return { tinta: token('tinta'), papel: token('papel') };
};

/**
 * Excepciones, cada una con su motivo. Lista explícita y no un patrón: una
 * excepción por carpeta apagaría el chequeo sin que nadie lo decida.
 */
const PERMITIDOS = new Set<string>([
  // (vacía — si alguna atenuación tiene que quedar, va acá con el motivo)
]);

/** El markup del sitio público. El panel tiene su propio criterio y no entra. */
const archivosDelSitio = (): string[] =>
  execFileSync('git', ['ls-files', 'src/pages', 'src/components/sitio'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.astro') && f !== 'src/pages/admin.astro');

/**
 * Cada tinta de texto del markup, con su línea y su opacidad si la tiene.
 *
 * **Desde B-260 la lista de atenuaciones está vacía a propósito** y el chequeo
 * sigue acá igual: el sistema visual es a tintas planas, así que una opacidad no
 * debería aparecer nunca —lo prohíbe `tests/sistema-visual.test.ts`— y si alguna
 * vuelve, ésta la mide en vez de dejarla pasar. Dos redes distintas sobre la
 * misma clase de bug: una dice «no la pongas» y la otra «si la ponés, tiene que
 * dar».
 */
const TOKENS = 'papel|crema|hondo|tinta|suave|acento|azul|super|borde|regla';

const tintasDeTexto = (): { donde: string; clase: string; opacidad: number | null }[] => {
  const out: { donde: string; clase: string; opacidad: number | null }[] = [];
  for (const f of archivosDelSitio()) {
    readFileSync(raiz(f), 'utf8')
      .split('\n')
      .forEach((linea, i) => {
        const re = new RegExp(`((?:marker:)?text-(?:${TOKENS})(?:\\/(\\d{1,3}))?)`, 'g');
        for (const m of linea.matchAll(re)) {
          out.push({
            donde: `${f}:${i + 1}`,
            clase: m[1]!,
            opacidad: m[2] ? Number(m[2]) / 100 : null,
          });
        }
      });
  }
  return out;
};

/** Solo las que llevan una opacidad. Desde B-260 tiene que estar vacía. */
const atenuaciones = (): { donde: string; clase: string; opacidad: number }[] =>
  tintasDeTexto()
    .filter((t) => t.opacidad !== null)
    .map((t) => ({ donde: t.donde, clase: t.clase, opacidad: t.opacidad! }));

describe('el contraste del sitio público — B-235', () => {
  it('el barrido encuentra markup y tintas de verdad', () => {
    /*
     * Control positivo: el test de abajo afirma que una lista está vacía, y una
     * lista vacía es también lo que devuelve un barrido que no leyó nada.
     *
     * **Se cuentan las tintas, no las atenuaciones** — B-260. Hasta el rediseño
     * este control pedía más de cinco `text-tinta/NN`, y era el control correcto
     * mientras el sitio atenuaba. Con el sistema a tintas planas hay **cero**
     * atenuaciones a propósito, así que pedirlas dejaría el archivo en rojo
     * permanente por hacer lo correcto — y la salida fácil sería borrar el
     * chequeo entero, que es el que sigue midiendo si alguna vuelve.
     */
    expect(archivosDelSitio().length).toBeGreaterThan(3);
    expect(tintasDeTexto().length).toBeGreaterThan(10);
  });

  it('y hoy no hay ninguna atenuación, que es lo que el sistema pide', () => {
    /*
     * El estado esperado, escrito como aserto y no como suposición: si mañana
     * aparece una, el mensaje dice dónde — y el caso de más abajo, que la mide,
     * deja de estar midiendo el vacío.
     */
    expect(atenuaciones().map((a) => `${a.donde} — ${a.clase}`)).toEqual([]);
  });

  it('la paleta sale de global.css y el cálculo la reconoce', () => {
    const { tinta, papel } = paleta();
    // Sin esto, dos colores mal parseados (negro sobre negro) darían 1:1 y
    // harían fallar todo con un mensaje que no dice por qué.
    expect(contraste(tinta, papel)).toBeGreaterThan(10);
  });

  it('ninguna atenuación queda por debajo de AA', () => {
    const { tinta, papel } = paleta();

    const flojas = atenuaciones()
      .filter((a) => !PERMITIDOS.has(a.donde))
      .map((a) => ({ ...a, ratio: contraste(mezclar(tinta, papel, a.opacidad), papel) }))
      .filter((a) => a.ratio < AA_TEXTO)
      .map((a) => `${a.donde} — ${a.clase} da ${a.ratio.toFixed(2)}:1`);

    expect(
      flojas,
      `estas atenuaciones no llegan a ${AA_TEXTO}:1 sobre el papel. Subí la ` +
        'opacidad; si alguna tiene que quedar, va en PERMITIDOS con su motivo.',
    ).toEqual([]);
  });

  it('las excepciones declaradas existen', () => {
    // Una excepción para una línea que se movió tapa algo distinto de lo que dice.
    const lugares = new Set(atenuaciones().map((a) => a.donde));
    for (const p of PERMITIDOS) expect(lugares).toContain(p);
  });
});
