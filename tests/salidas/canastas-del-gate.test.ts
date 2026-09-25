/**
 * Las canastas del gate del build y las de este barrido (B-1761).
 *
 * Un barrido de salidas públicas, partido de
 * `tests/barrido-de-salidas-publicas.test.ts` (PRD 6, M-12). El índice de
 * todos está en ese archivo; lo que comparten, en
 * `tests/fixtures/barrido-de-salidas.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CENTINELA as CENTINELA_DEL_GATE, CENTINELA_DEL_DIRECTORIO, CENTINELA_DE_LUGARES, CENTINELA_DE_SUSCRIPCIONES } from '../../scripts/gate-build/semilla.mjs';
import { RUTA_DEL_CENTINELA_DEL_GATE, RUTA_EN_LA_GUIA, canastaDelGateCoincide } from '../fixtures/barrido-de-salidas';

describe('las canastas del gate del build y las de este barrido — B-1761', () => {
  it('cada centinela del gate dice con qué ruta de acá se compara', () => {
    const tablas = [
      RUTA_DEL_CENTINELA_DEL_GATE,
      ...Object.values(RUTA_EN_LA_GUIA).map((c) => c.rutas),
    ];
    const claves = new Set(tablas.flatMap((t) => Object.keys(t)));
    expect([...claves].sort()).toEqual(Object.keys(CENTINELA_DEL_GATE).sort());
    // Control positivo: sin rutas, la comparación de abajo no compara nada.
    expect(Object.values(RUTA_DEL_CENTINELA_DEL_GATE).filter(Boolean).length).toBeGreaterThan(15);
  });

  /*
   * B-1812 — las cuatro canastas de la Guía, contra la lista de la proyección de
   * su colección. Ninguna difiere a propósito: la canasta del gate nombra lo que
   * la proyección publica y nada más.
   *
   * MUTACIÓN PROBADA: sacar `'suscripcionTematica'` de `CENTINELA_DE_SUSCRIPCIONES`,
   * `'direccion'` del grupo «dónde queda» de las bibliotecas, agregar
   * `'libreriaContacto'` a `CENTINELA_DEL_DIRECTORIO` o `'lugarDireccionDeCasa'` a
   * `CENTINELA_DE_LUGARES` pone en rojo el `it` de esa colección nombrando la clave.
   */
  for (const { salida, canasta, grupos, rutas } of Object.values(RUTA_EN_LA_GUIA)) {
    it(`la canasta de ${salida} del gate dice lo mismo que su barrido (B-1812)`, () => {
      canastaDelGateCoincide(canasta, grupos, [], rutas);
    });
  }
});
