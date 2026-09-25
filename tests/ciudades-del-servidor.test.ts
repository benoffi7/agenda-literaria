/**
 * **`ciudades` recalculado del lado del servidor, la mitad pura** — B-1920.
 *
 * `dentroDeSuCiudad()` (firestore.rules, D-1150) le cree al derivado `ciudades`
 * porque una regla no puede recorrer `modalidades[]`. Quien arme el documento a
 * mano con el SDK puede declarar uno que no es el de sus filas. `syncCalendar` lo
 * recalcula en cada escritura y, si no coincide, lo corrige y avisa con
 * `alerta: 'ciudades-no-coinciden'`.
 *
 * Lo de acá es la decisión (`ciudadesDesalineadas`), la guarda anti-loop en sus
 * dos mitades, y que el panel **nunca** dispare la alerta. La transacción de
 * verdad, contra el emulador, está en `ciudades-del-servidor.integracion.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as fachada from '@/lib/ciudades.mjs';
import * as enFunctions from '../functions/ciudades.js';
import {
  ciudadesDe,
  ciudadesDesalineadas,
  ciudadesParaElLog,
} from '../functions/ciudades.js';
import { sedePrincipal } from '../functions/derivados.js';
import { camposCambiados, huboCambioDeContenido } from '../functions/historial.js';
import { formADocumento } from '@/lib/actividades';
import { modalidadVacia } from '@/lib/formulario/estadoInicial';
import { sinComentarios } from '../scripts/sin-comentarios.mjs';
import { formGuardable } from './fixtures/formulario';
import type { ActividadForm, Sede } from '@/types/actividad';

const sede = (ciudad: string, over: Partial<Sede> = {}): Sede => ({
  nombre: 'Librería del puerto',
  direccion: 'Av. Luro 3000',
  provincia: 'buenos-aires',
  barrio: '',
  ciudad,
  indicaciones: '',
  geo: null,
  ...over,
});

const filaDoc = (ciudad: string | null) => ({
  id: `mod_${ciudad ?? 'virtual'}`,
  modalidad: ciudad ? 'presencial' : 'virtual',
  sede: ciudad ? sede(ciudad) : null,
  online: null,
});

/** Un documento como lo deja el panel: `ciudades` derivado de sus filas. */
const alineado = (ciudades: (string | null)[]) => {
  const modalidades = ciudades.map(filaDoc);
  return {
    titulo: 'Club del puerto',
    estado: 'publicado',
    modalidades,
    sede: sedePrincipal(modalidades),
    ciudades: ciudadesDe(modalidades),
  };
};

describe('`ciudadesDesalineadas` — cuándo el servidor corrige', () => {
  it('un documento que coincide no se toca', () => {
    expect(ciudadesDesalineadas(alineado(['mar-del-plata']))).toBeNull();
    expect(ciudadesDesalineadas(alineado(['mar-del-plata', 'rosario']))).toBeNull();
    // D-1151: la virtual queda con `[]`, y `[]` coincide con `[]`.
    expect(ciudadesDesalineadas(alineado([null]))).toBeNull();
  });

  /**
   * El caso de B-1920, las dos formas que nombra el ítem. MUTACIÓN PROBADA:
   * devolver siempre `null` pone los dos en rojo.
   */
  it('un `ciudades` que no es el de las filas se corrige a la derivación', () => {
    const mentido = { ...alineado(['rosario']), ciudades: ['mar-del-plata'] };
    expect(ciudadesDesalineadas(mentido)).toEqual({
      guardadas: ['mar-del-plata'],
      derivadas: ['rosario'],
    });
  });

  it('una segunda sede de otra ciudad que no se sumó a `ciudades` también', () => {
    const doc = { ...alineado(['mar-del-plata', 'rosario']), ciudades: ['mar-del-plata'] };
    expect(ciudadesDesalineadas(doc)?.derivadas).toEqual(['mar-del-plata', 'rosario']);
  });

  it('el campo ausente cuenta: la regla lo lee como `[]`, o sea como virtual', () => {
    const { ciudades: _, ...sinCampo } = alineado(['rosario']);
    expect(ciudadesDesalineadas(sinCampo)).toEqual({ guardadas: null, derivadas: ['rosario'] });
  });

  it('declarar virtual (`[]`) una actividad con sede se corrige', () => {
    const doc = { ...alineado(['rosario']), ciudades: [] };
    expect(ciudadesDesalineadas(doc)?.derivadas).toEqual(['rosario']);
  });

  it('el orden cuenta, como en el backfill: `ciudadesDe` es determinístico', () => {
    const doc = { ...alineado(['mar-del-plata', 'rosario']), ciudades: ['rosario', 'mar-del-plata'] };
    expect(ciudadesDesalineadas(doc)?.derivadas).toEqual(['mar-del-plata', 'rosario']);
  });

  it('un borrado (`despues` nulo) no tiene nada que corregir', () => {
    expect(ciudadesDesalineadas(null)).toBeNull();
    expect(ciudadesDesalineadas(undefined)).toBeNull();
  });

  /**
   * Corre adentro de `syncCalendar` antes del diff de Calendar: si tirara, un
   * documento escrito a mano con basura en las filas cortaría el sync.
   */
  it('no tira con un documento escrito a mano con basura', () => {
    expect(() =>
      ciudadesDesalineadas({
        modalidades: [null, 5, { sede: { ciudad: 42 } }, { sede: 'x' }],
        ciudades: 'mar-del-plata',
      }),
    ).not.toThrow();
    expect(ciudadesDesalineadas({ modalidades: 'no-es-lista', ciudades: [] })).toBeNull();
    expect(
      ciudadesDesalineadas({ modalidades: [null, { sede: { ciudad: 42 } }], ciudades: [] }),
    ).toBeNull();
  });
});

describe('la guarda anti-loop, en sus dos mitades (trampa 3)', () => {
  const mentido = { ...alineado(['rosario']), ciudades: ['mar-del-plata'] };
  const corregido = { ...mentido, ciudades: ciudadesDesalineadas(mentido)!.derivadas };

  it('la segunda pasada no entra: el documento corregido coincide consigo mismo', () => {
    expect(ciudadesDesalineadas(corregido)).toBeNull();
  });

  /**
   * MUTACIÓN PROBADA: sacar `'ciudades'` de `CAMPOS_DE_MAQUINA` pone este caso en
   * rojo, y el síntoma real sería una versión de historial y un rebuild por cada
   * corrección.
   */
  it('el write-back no es cambio de contenido: ni versión ni rebuild', () => {
    expect(camposCambiados(mentido, corregido)).toEqual([]);
    expect(huboCambioDeContenido(mentido, corregido)).toBe(false);
  });

  it('control positivo: cambiar las filas sí es contenido, con o sin `ciudades`', () => {
    const otraSede = alineado(['cordoba']);
    expect(camposCambiados(mentido, otraSede)).toContain('modalidades');
  });
});

describe('el panel nunca dispara la alerta', () => {
  const filaForm = (ciudad: string): ActividadForm['modalidades'][number] => ({
    ...modalidadVacia('presencial'),
    id: `mod_${ciudad}`,
    sede: sede(ciudad),
  });

  /**
   * Si esto se rompe, cada guardado del panel dispararía un mail: la derivación
   * del panel y la del servidor tienen que ser la misma función.
   */
  it('lo que escribe `formADocumento` coincide con la derivación del servidor', () => {
    for (const ciudades of [['Mar del Plata'], ['mar-del-plata', 'Rosario '], []]) {
      const form = formGuardable({
        titulo: 'Club',
        modalidades: ciudades.length ? ciudades.map(filaForm) : [modalidadVacia('virtual')],
      });
      const doc = formADocumento(form, 'uid_pub', true);
      expect(ciudadesDesalineadas(doc as unknown as Record<string, unknown>), ciudades.join()).toBeNull();
    }
  });

  it('la fachada del panel reexporta la misma función, no una copia', () => {
    expect(fachada.ciudadesDe).toBe(enFunctions.ciudadesDe);
    expect(fachada.slugDeCiudad).toBe(enFunctions.slugDeCiudad);
  });
});

describe('`ciudadesParaElLog` — lo guardado viene de un documento escrito a mano', () => {
  it('una lista de textos pasa, recortada', () => {
    expect(ciudadesParaElLog(['rosario'])).toEqual(['rosario']);
    expect(ciudadesParaElLog(['x'.repeat(500)])).toEqual(['x'.repeat(60)]);
    expect(ciudadesParaElLog(Array.from({ length: 50 }, (_, i) => `c${i}`))).toHaveLength(10);
  });

  it('lo que no es una lista de textos se nombra, no se copia', () => {
    expect(ciudadesParaElLog(null)).toBeNull();
    expect(ciudadesParaElLog('x'.repeat(10_000))).toBe('(no es una lista)');
    expect(ciudadesParaElLog({ a: 1 })).toBe('(no es una lista)');
    expect(ciudadesParaElLog([{ secreto: 'zoom.us/j/1' }])).toEqual(['(no es un texto)']);
  });
});

describe('el cableado en `syncCalendar`', () => {
  const trigger = sinComentarios(readFileSync('functions/calendario-trigger.js', 'utf8'));

  it('loguea con la `alerta` que toma la política de GCP, en `warn`', () => {
    // `severity>=WARNING` es la mitad del filtro (docs/08-operacion.md): un
    // `info` no mandaría el mail.
    expect(trigger).toMatch(/logger\.warn\([^)]*\{\s*alerta: 'ciudades-no-coinciden'/);
  });

  it('el log no lleva el valor crudo de lo guardado ni de lo derivado', () => {
    // Las dos salen del mismo documento escrito a mano: una URL tipeada en
    // `sede.ciudad` llega slugificada pero casi legible a `derivadas`.
    expect(trigger).toContain('guardadas: ciudadesParaElLog(');
    expect(trigger).toContain('derivadas: ciudadesParaElLog(');
  });

  /**
   * La lista cerrada de lo que lleva el log (clase de B-81): sumar `updatedBy`
   * «para saber quién» o el documento entero lo pone en rojo. Quién es lo busca
   * el runbook en la consola, no el mail.
   *
   * Desde B-2050 el fallo de la transacción es uno solo para los cinco derivados
   * y lleva `alerta: 'derivados-no-coinciden'` (`derivados-del-servidor.test.ts`).
   */
  it('el log de la alerta lleva solo `alerta`, `id`, `estado`, `guardadas` y `derivadas`', () => {
    const bloques = [
      ...trigger.matchAll(/logger\.warn\(\s*'[^']*',\s*\{([^}]*)\}/g),
    ]
      .map((m) => m[1]!)
      .filter((b) => b.includes("alerta: 'ciudades-no-coinciden'"));
    expect(bloques).toHaveLength(1);
    const claves = bloques[0]!
      .split(',')
      .map((c) => c.split(':')[0]!.trim())
      .filter(Boolean)
      .sort();
    expect(claves).toEqual(['alerta', 'derivadas', 'estado', 'guardadas', 'id']);
  });

  it('no toca `estado`: corregir no despublica', () => {
    const efecto = sinComentarios(readFileSync('functions/derivados-firestore.js', 'utf8'));
    expect(efecto).toContain('ciudades: d.ciudades');
    // Una sola escritura: `estado` se lee para el mail, nunca se escribe.
    expect([...efecto.matchAll(/tx\.(update|set)\(/g)]).toHaveLength(1);
    expect(efecto).not.toMatch(/estado\s*:\s*['"]/);
    expect(efecto).not.toMatch(/\bestado\s*:\s*d\./);
  });

  it('el runbook tiene la sección que nombra la alerta', () => {
    expect(readFileSync('docs/08-operacion.md', 'utf8')).toContain(
      '### Cuando suena `ciudades-no-coinciden`',
    );
  });
});
