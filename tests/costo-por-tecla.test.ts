import { describe, expect, it } from 'vitest';
import { formVacio } from '@/lib/formulario/estadoInicial';
import { faltaParaPublicar } from '@/lib/schema';
import { nuevaSesionId } from '@/lib/sesiones';
import type { ActividadForm } from '@/types/actividad';

/**
 * B-198 — lo que cuesta el aviso de «lo que falta para publicar», por tecla.
 *
 * El aviso (B-183) es un `useMemo` sobre `form`, y `setForm` devuelve un objeto
 * nuevo en cada tecleo, así que **cada tecla dispara un `safeParse` de zod sobre
 * el formulario entero**. El ítem decía que eso era del mismo orden que el
 * `JSON.stringify` que ya corre en cada tecla (`useFormularioSucio` y el
 * autoguardado) y que en un teléfono viejo con un ciclo de 20 encuentros sería
 * lo primero que se notaría. Pedía **medir antes de optimizar**.
 *
 * ── Lo que dio la medición (2026-09-02, M-series) ──────────────────────────
 *
 * | Encuentros | `faltaParaPublicar` | `JSON.stringify` |
 * |---|---|---|
 * | 1  | 0,107 ms | 0,001 ms |
 * | 8  | 0,107 ms | 0,007 ms |
 * | 20 | 0,123 ms | 0,012 ms |
 * | 50 | 0,205 ms | 0,025 ms |
 *
 * Dos cosas, y las dos van contra la intuición del ítem:
 *
 * 1. **No es del mismo orden que el `stringify`: es ~10× más caro.** La premisa
 *    con la que el ítem se tranquilizaba era falsa.
 * 2. **Y no importa, porque el costo casi no depende de los encuentros.** Con un
 *    solo encuentro ya cuesta 0,107 ms: lo que se paga es el costo fijo del
 *    schema, no el ciclo. Cincuenta encuentros lo duplican, no lo multiplican
 *    por cincuenta — que es justo el escenario que el ítem temía.
 *
 * Con 0,2 ms en el peor caso medido, un teléfono diez veces más lento sigue
 * abajo de 2 ms, o sea una octava parte de un frame de 16 ms. **No se
 * debouncea**: un debounce agrega un número mágico y una ventana en la que el
 * aviso miente, a cambio de nada medible.
 *
 * ── Qué protege este test ──────────────────────────────────────────────────
 *
 * Que la medición no envejezca en silencio. El techo es deliberadamente
 * generoso —dos órdenes de magnitud arriba de lo medido— porque lo que tiene que
 * detectar no es un 20 % de variación de máquina: es que alguien meta en el
 * camino del tecleo algo que no debería estar ahí (una lectura de red, un
 * `crypto`, una validación cuadrática en la cantidad de encuentros). Un techo
 * ajustado a lo medido sería un test que falla en una máquina cargada, y un test
 * que falla por su propia plomería enseña a saltearlo.
 *
 * ── B-2060 · la segunda medición, y por qué el test de escala cambió ────────
 *
 * El test de escala comparaba 1 contra 50 encuentros midiendo cada tanda por
 * separado, y con la suite en paralelo (M-1) falló una vez: una tanda caía
 * sobre un momento de CPU ocupada por otro worker y la otra no. Además armaba
 * el formulario **adentro** de lo cronometrado, así que medía también los
 * `crypto.randomUUID()` de `nuevaSesionId`. Ahora compara 8 contra 80 con
 * `proporcion` (abajo): pares intercalados, mediana de los cocientes, y ningún
 * milisegundo en el umbral.
 *
 * Remedido el 2026-09-25, y **la tabla de arriba envejeció**:
 *
 * | Encuentros | `faltaParaPublicar` |
 * |---|---|
 * | 1   | 0,028 ms |
 * | 8   | 0,034 ms |
 * | 20  | 0,052 ms |
 * | 80  | 0,166 ms |
 * | 200 | 0,366 ms |
 *
 * El costo fijo bajó a un cuarto y lo que queda es **lineal**: ~1,7 µs por
 * encuentro, que pasa a dominar arriba de ~16. La conclusión de B-198 no se
 * mueve —20 encuentros cuestan 0,05 ms, menos que antes—, pero «casi no depende
 * de los encuentros» ya no es cierto, y por eso el test de escala no puede
 * pedir «casi constante»: pide **no más que lineal**, que es lo que separa un
 * ciclo largo tolerable del escenario que el ítem temía.
 *
 * **Por qué no se cuenta en vez de cronometrar**, que era lo preferible: lo
 * que el test tiene que ver es código arbitrario en un `superRefine` —un doble
 * `forEach` que compare encuentros—, y zod le pasa a los refinamientos los
 * objetos **ya parseados**, copias nuevas. Un `Proxy` sobre la entrada que
 * cuente lecturas no ve nada de lo que pasa ahí, y un espía sobre los `_parse`
 * de zod cuenta nodos del schema, que siguen siendo lineales con una regla
 * cuadrática adentro. El único instrumento que ve el costo de cualquier código
 * es el reloj; lo que se hizo fue sacarle al reloj la carga de la máquina.
 *
 * La mutación se probó el 2026-09-25: una regla de superposición que compara
 * cada encuentro con todos los demás parseando fechas lleva la proporción de
 * ~6× a ~50× y el test se pone rojo. Una cuadrática **barata** —el
 * `idsRepetidos` de B-816 con un `.some` en vez del `Set`— la deja en ~6,5× y
 * pasa, y está bien que pase: son 3.200 comparaciones de strings, un centésimo
 * de milisegundo, y no es el escenario que el ítem temía.
 */

/** Un ciclo de `n` encuentros, todo cargado, como el peor caso del formulario. */
const conEncuentros = (n: number): ActividadForm => {
  const base = formVacio();
  return {
    ...base,
    esCiclo: true,
    titulo: 'Club de lectura de novela latinoamericana',
    descripcion: 'Ocho encuentros para leer a Rulfo, Onetti y Di Benedetto sin apuro.',
    sesiones: Array.from({ length: n }, (_, i) => ({
      id: nuevaSesionId(),
      inicio: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T19:00`,
      fin: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T21:00`,
      tema: `Ejercicio de voz ${i + 1}`,
      lectura: 'Cap. 1-4',
      cancelada: false,
      calendarEventId: null,
      comisionId: null,
    })),
  };
};

/** Milisegundos por llamada, con una vuelta previa para no medir el warm-up. */
const porLlamada = (f: () => unknown, vueltas = 200): number => {
  f();
  const t0 = performance.now();
  for (let i = 0; i < vueltas; i++) f();
  return (performance.now() - t0) / vueltas;
};

const mediana = (xs: number[]): number => {
  const o = [...xs].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/**
 * B-2060 — cuánto más cuesta `b` que `a`, medido de forma que la carga de la
 * máquina se cancele.
 *
 * La versión anterior medía `a` entera y después `b` entera, y comparaba contra
 * un piso fijo: con la suite en paralelo (M-1), si otro worker se comía la CPU
 * justo durante la segunda tanda, la proporción salía inflada y el test fallaba
 * sin que el código hubiera cambiado. Tres cosas lo arreglan:
 *
 *  - **Intercaladas.** Una muestra de `a`, una de `b`, otra de `a`… La carga
 *    que llega en un momento cae sobre las dos casi por igual.
 *  - **Proporción por par, no por total.** Cada par da su propio cociente, y
 *    como las dos mitades del par corrieron juntas, el ruido se divide.
 *  - **Mediana de los cocientes.** Un par que cayó sobre una pausa de GC o un
 *    cambio de contexto es un valor extremo, y la mediana lo ignora: harían
 *    falta la mitad de los pares contaminados para moverla.
 *
 * No hay ningún umbral en milisegundos: lo que se compara es una proporción, y
 * una máquina lenta o cargada escala las dos mitades a la vez.
 */
const proporcion = (a: () => unknown, b: () => unknown, pares = 21, vueltas = 20): number => {
  // Calentar los dos caminos antes de la primera muestra: sin esto, el primer
  // par mide al JIT y no al código.
  porLlamada(a, 100);
  porLlamada(b, 100);
  const cocientes: number[] = [];
  for (let i = 0; i < pares; i++) {
    const ta = porLlamada(a, vueltas);
    const tb = porLlamada(b, vueltas);
    cocientes.push(tb / Math.max(ta, 1e-4));
  }
  return mediana(cocientes);
};

/**
 * Dos órdenes de magnitud arriba de los 0,2 ms medidos con 50 encuentros. No es
 * un objetivo de performance: es el piso de lo absurdo.
 */
const TECHO_MS = 20;

describe('el aviso de lo que falta para publicar no cuesta un frame (B-198)', () => {
  it('un ciclo de 20 encuentros se valida muy por debajo de un frame', () => {
    const form = conEncuentros(20);
    expect(porLlamada(() => faltaParaPublicar(form))).toBeLessThan(TECHO_MS);
  });

  it('el costo no escala con la cantidad de encuentros', () => {
    // Es el hallazgo que decide el ítem: lo que se paga es el costo fijo del
    // schema. Si un día pasara a escalar —una regla nueva que compare cada
    // encuentro con todos los demás—, el escenario que el ítem temía (un ciclo
    // largo en un teléfono viejo) volvería a ser real y esto lo diría.
    //
    // Diez veces los datos, y la cuenta que decide el techo es de secundario:
    // si el costo es un fijo más algo por encuentro (`a + b·n`, con los dos
    // positivos), multiplicar los encuentros por diez **no puede** multiplicar
    // el costo por más de diez. Pasarse de 10× solo lo logra un término que
    // crezca más rápido que los datos —el O(n²) de «comparar cada encuentro con
    // todos los demás»—, que es exactamente lo que este test tiene que ver.
    //
    // Medido (2026-09-25): ~6×, con y sin la suite en paralelo. El techo no
    // tiene margen de máquina porque no lo necesita: una máquina lenta o
    // cargada estira las dos mitades de cada par por igual, y la proporción no
    // se mueve.
    const form8 = conEncuentros(8);
    const form80 = conEncuentros(80);
    const veces = proporcion(
      () => faltaParaPublicar(form8),
      () => faltaParaPublicar(form80),
    );
    expect(veces).toBeLessThan(10);
  });

  it('control positivo: el que se mide es el camino real del aviso', () => {
    // Sin esto, los dos de arriba pasarían igual si `faltaParaPublicar`
    // devolviera `[]` de entrada por un cambio de firma: rápido y sin mirar
    // nada. Un formulario vacío tiene que tener algo que reclamar.
    expect(faltaParaPublicar(formVacio()).length).toBeGreaterThan(3);
    // Y uno completo con encuentros tiene que reclamar menos que el vacío.
    expect(faltaParaPublicar(conEncuentros(8)).length).toBeLessThan(
      faltaParaPublicar(formVacio()).length,
    );
  });
});
