/**
 * Guarda contra la clase de B-875: un fixture con fecha cableada que compite
 * contra el reloj real, en vez de contra un `ahora` que el test controla.
 *
 * ── El caso que la disparó ─────────────────────────────────────────────────
 * `tests/lista-actividades.render.test.tsx` tenía un encuentro con
 * `inicio: ts('2026-09-10T22:00:00Z')`. `ListaActividades` decide qué fila dice
 * «Próximo:» mirando el reloj real, capturado **adentro** del componente y sin
 * forma de pasarlo desde afuera —`const [ahora] = useState(() => new Date())`
 * en `src/components/admin/ListaActividades.tsx`—, así que el caso pasaba en
 * verde hasta el 10 de septiembre y se puso rojo solo, sin que nadie tocara una
 * línea. Las ocho corridas del rebuild que fallaron en el paso Tests —que corre
 * **antes** del build— dejaron de publicar todo lo que el dueño cargaba.
 *
 * ── Por qué esto no es «prohibir fechas fijas» ─────────────────────────────
 * Hay decenas de tests con fechas del futuro cercano cableadas, y la enorme
 * mayoría son correctos: la lógica pura de `src/lib/*` recibe `ahora` **por
 * parámetro** (`docs/05-patrones.md` §«El reloj también es infraestructura»),
 * así que ahí una fecha fija es justamente lo que el módulo necesita para dar
 * siempre el mismo resultado. Prohibir la fecha fija sería ruido puro — la
 * clase peligrosa no es «hay una fecha», es la combinación de tres cosas:
 *
 *  1. **La fecha todavía no pasó.** Si ya pasó, no puede voltear: una fecha
 *     que quedó atrás se queda atrás para siempre.
 *  2. **Lo que el test monta o importa, sin mockear, lee el reloj real sin que
 *     nadie se lo pueda pasar** — el hook de React que lo captura una sola vez
 *     con `useState(() => new Date())` / `useState(() => Date.now())`, y no un
 *     parámetro con default (`ahora = new Date()`, ese sí lo puede pisar quien
 *     llama, y por eso no cuenta).
 *  3. **El test no fijó el reloj del proceso.** `vi.useFakeTimers()` +
 *     `vi.setSystemTime()` desactivan la bomba a propósito —
 *     `tests/calendario-solo-lectura.render.test.tsx` monta el mismo
 *     componente peligroso con fechas cableadas y hace exactamente eso—, así
 *     que un archivo que fija el reloj queda afuera aunque tenga las otras dos
 *     señales.
 *
 * ── Que hoy no haya ninguno no es que el chequeo no busque nada ────────────
 * El caso de B-875 se arregló con `Date.now() + 7 días` (no con una fecha fija)
 * y el otro componente con el mismo hook (`CalendarioActividades.tsx`, usado en
 * `tests/calendario-solo-lectura.render.test.tsx`) ya fija el reloj. Los
 * controles de abajo prueban que el barrido **sí encuentra** fechas futuras
 * cableadas y **sí encuentra** el hook peligroso — para que la lista vacía sea
 * evidencia de que no hay ninguno vivo, y no la señal de un barrido que no mira
 * nada (B-873).
 *
 * MUTACIÓN PROBADA: volver las dos fechas de `tests/lista-actividades.render.test.tsx`
 * a `ts('2026-09-20T22:00:00Z')` / `ts('2026-09-21T00:00:00Z')` pone este
 * archivo en rojo; con el `Date.now() + 7 días` actual queda en verde.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';

const raiz = new URL('..', import.meta.url);
const fuente = (relativo: string) => readFileSync(fileURLToPath(new URL(relativo, raiz)), 'utf8');
/** El fuente sin comentarios: la prosa de este repo nombra lo que busca, y engancharía. */
const codigo = (relativo: string): string => sinComentarios(fuente(relativo));

const testFiles = (): string[] =>
  execFileSync('git', ['ls-files', '-z', 'tests'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => /\.test\.tsx?$/.test(f));

/** Fechas ISO cableadas en el código (ya sin comentarios), con o sin hora. */
const FECHA_RE = /\b20\d\d-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d)?Z?)?\b/g;

/** «Todavía no pasó»: la única mitad de la bomba que puede seguir viva. */
const todaviaNoPaso = (literal: string): boolean => {
  const iso = literal.length === 10 ? `${literal}T00:00:00Z` : literal;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
};

const IMPORT_RE = /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"](@\/[^'"]+)['"]/g;
const MOCK_RE = /vi\.mock\(\s*['"](@\/[^'"]+)['"]/g;
const FAKE_TIMERS_RE = /vi\.useFakeTimers\(|vi\.setSystemTime\(/;

/**
 * La forma del hook que captura el reloj real **una sola vez y sin
 * parámetro**: `useState(() => new Date())` / `useState(() => Date.now())`. Es
 * la forma, no el nombre de la variable — `ListaActividades.tsx` y
 * `CalendarioActividades.tsx` la escriben igual, las dos como `ahora`, pero lo
 * que delata el peligro es que nada de afuera puede pisar ese valor salvo
 * fijando el reloj del proceso entero.
 */
const RELOJ_SIN_PARAMETRO_RE = /useState\(\s*\(\)\s*=>\s*(?:new Date\(\)|Date\.now\(\))\s*\)/;

/** El fuente del módulo que un import de `@/...` resuelve, o `null` si no existe. */
const resolverModulo = (especificador: string): string | null => {
  const relativo = especificador.replace(/^@\//, 'src/');
  for (const ext of ['.ts', '.tsx']) {
    try {
      return codigo(`${relativo}${ext}`);
    } catch {
      // prueba la próxima extensión
    }
  }
  try {
    return codigo(relativo);
  } catch {
    return null;
  }
};

/**
 * Los archivos con la bomba armada: fecha que todavía no pasó, reloj real sin
 * parámetro en algo que el test monta o importa sin mockear, y sin
 * `vi.useFakeTimers` que lo neutralice.
 */
const conBombaDeFecha = (): string[] => {
  const resultado: string[] = [];
  for (const archivo of testFiles()) {
    const src = codigo(archivo);
    if (FAKE_TIMERS_RE.test(src)) continue;

    const tieneFechaFutura = [...src.matchAll(FECHA_RE)].some((m) => todaviaNoPaso(m[0]));
    if (!tieneFechaFutura) continue;

    const mockeados = new Set([...src.matchAll(MOCK_RE)].map((m) => m[1]!));
    const importados = new Set([...src.matchAll(IMPORT_RE)].map((m) => m[1]!));
    const sujetos = [...importados].filter((i) => !mockeados.has(i));

    const leeElRelojSinParametro = sujetos.some((especificador) => {
      const fuenteDelSujeto = resolverModulo(especificador);
      return fuenteDelSujeto !== null && RELOJ_SIN_PARAMETRO_RE.test(fuenteDelSujeto);
    });

    if (leeElRelojSinParametro) resultado.push(archivo);
  }
  return resultado;
};

describe('clase de B-875 · un fixture con fecha cableada no compite con el reloj real', () => {
  it('control: el barrido encuentra tests con fecha cableada en el futuro cercano', () => {
    // Sin este control, «ningún test tiene la bomba armada» pasaría igual con
    // el regex de fecha roto — la trampa de B-873.
    const conFechaFutura = testFiles().filter((archivo) =>
      [...codigo(archivo).matchAll(FECHA_RE)].some((m) => todaviaNoPaso(m[0])),
    );
    expect(conFechaFutura.length).toBeGreaterThan(10);
  });

  it('control: el barrido encuentra el hook que captura el reloj real sin parámetro', () => {
    // Mismo motivo que el control de arriba: sin esto, un regex roto dejaría
    // pasar cualquier cosa y el `toEqual([])` de abajo sería cobertura falsa.
    for (const componente of [
      'src/components/admin/ListaActividades.tsx',
      'src/components/admin/CalendarioActividades.tsx',
    ]) {
      expect(RELOJ_SIN_PARAMETRO_RE.test(codigo(componente)), componente).toBe(true);
    }
  });

  it('control: fijar el reloj con vi.setSystemTime desarma la bomba', () => {
    // `calendario-solo-lectura.render.test.tsx` monta el mismo componente
    // peligroso, con fechas cableadas, y lo hace a propósito — fijando el
    // reloj del proceso (ver su propio comentario, §«El reloj también es
    // infraestructura»). El barrido tiene que dejarlo afuera.
    expect(conBombaDeFecha()).not.toContain('tests/calendario-solo-lectura.render.test.tsx');
  });

  it('ningún fixture compara una fecha cableada que todavía puede voltear contra el reloj real', () => {
    expect(conBombaDeFecha()).toEqual([]);
  });
});
