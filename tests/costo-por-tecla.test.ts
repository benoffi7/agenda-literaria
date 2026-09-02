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
    const uno = porLlamada(() => faltaParaPublicar(conEncuentros(1)));
    const cincuenta = porLlamada(() => faltaParaPublicar(conEncuentros(50)));
    // Cincuenta veces los datos, y no más de diez veces el costo. Medido: ~2×.
    expect(cincuenta).toBeLessThan(Math.max(uno, 0.02) * 10);
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
