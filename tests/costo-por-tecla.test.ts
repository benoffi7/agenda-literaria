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
 * `proporcion` (abajo): tandas intercaladas y ningún milisegundo en el umbral.
 * Hasta B-2120 tomaba la mediana de los cocientes por par; ahora toma el mínimo
 * de cada lado, y el porqué está en `proporcion`.
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

/**
 * Milisegundos por llamada de una sola tanda corta, **sin** vuelta previa: la
 * usa `proporcion`, que calienta aparte y se queda con el mínimo.
 */
const unaTanda = (f: () => unknown, vueltas: number): number => {
  const t0 = performance.now();
  for (let i = 0; i < vueltas; i++) f();
  return (performance.now() - t0) / vueltas;
};

/**
 * B-2060, B-2120 — cuánto más cuesta `b` que `a`, medido de forma que la carga
 * de la máquina no entre en la cuenta.
 *
 * **Intercaladas**, como desde B-2060: una tanda de `a`, una de `b`, otra de
 * `a`… La carga que llega en un momento cae sobre las dos casi por igual.
 *
 * **Y el mínimo de cada lado, no la mediana de los cocientes** — B-2120. La
 * mediana de B-2060 suponía que el ruido cae parejo sobre las dos mitades de un
 * par, y no: `b` corre cinco veces más que `a`, así que con la CPU ocupada es
 * cinco veces más probable que un cambio de contexto le caiga adentro. El sesgo
 * es **sistemático**, no un valor extremo que la mediana ignore: con 24
 * procesos quemando CPU la mediana subió de ~6× a 13,6× (con el techo en 10×),
 * mientras que el mínimo no se movió de 5,4-5,65× en quince repeticiones. La
 * carga **solo puede sumar** tiempo —ningún ruido hace que el código corra más
 * rápido de lo que corre—, así que la tanda más rápida de cada lado es la que
 * tuvo menos interferencia, y esa es la que se compara. Para que haya muchas
 * tandas limpias, cada una es corta (tres llamadas, ~0,5 ms la más larga, por
 * debajo de un quantum del planificador) y hay 101 por lado.
 *
 * No hay ningún umbral en milisegundos: lo que se compara es una proporción, y
 * una máquina lenta escala las dos mitades a la vez.
 */
const proporcion = (a: () => unknown, b: () => unknown, tandas = 101, vueltas = 3): number => {
  // Calentar los dos caminos antes de la primera muestra: sin esto, la primera
  // tanda mide al JIT y no al código (con el mínimo no cambiaría el resultado,
  // pero así ninguna tanda de las que cuentan es de calentamiento).
  porLlamada(a, 100);
  porLlamada(b, 100);
  let minA = Infinity;
  let minB = Infinity;
  for (let i = 0; i < tandas; i++) {
    minA = Math.min(minA, unaTanda(a, vueltas));
    minB = Math.min(minB, unaTanda(b, vueltas));
  }
  return minB / Math.max(minA, 1e-4);
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
    // Medido (2026-09-25, B-2120, con el mínimo): 5,4-5,7× solo, con la
    // suite en paralelo y con 24 procesos quemando CPU al lado. La mutación
    // O(n²) de B-2060 da ~50× en las tres condiciones. El techo no tiene margen
    // de máquina porque no lo necesita: la carga solo suma tiempo, y el mínimo
    // se queda con la tanda que no la sufrió.
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
