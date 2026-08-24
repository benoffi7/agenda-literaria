/**
 * Clase de bug: **un test cuyo fixture no ejercita el caso central del
 * dominio** (B-84, H1, H5). B-135.
 *
 * Un test que verifica una instancia protege esa instancia. Acá los invariantes
 * del §2.2 se afirman sobre una **familia** de fixtures
 * (`tests/fixtures/ciclo.ts`), no sobre una: un invariante que solo vale con una
 * sesión no puede pasar por verdadero, porque el mismo `it` lo evalúa también
 * sobre el ciclo de ocho.
 *
 * Los `it.fails` eran la clase todavía viva. El frente 1B arregló B-84 y
 * pasaron solos → el `it.fails` que pasa **rompe el CI**, que fue la señal
 * para venir a borrarles el `.fails`. Hoy son `it` y son la red de regresión.
 *
 * La segunda mitad del archivo es el **detector**: lo que encuentra la próxima
 * instancia de la clase (el fixture flojo que todavía no existe), en lugar de
 * las tres que ya conocemos.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { construirDescripcion, planificar } from '../functions/calendario.js';
import {
  CICLOS_QUE_NUMERAN,
  DURACION_MINUTOS,
  ENCUENTROS_DEL_CICLO,
  FAMILIA_DE_CICLOS,
  cicloDeOcho,
  sesionesDeCiclo,
  type CasoDeCiclo,
} from './fixtures/ciclo';

const raiz = new URL('..', import.meta.url);
const fuente = (relativo: string) =>
  readFileSync(fileURLToPath(new URL(relativo, raiz)), 'utf8');

type Sesion = { id: string; cancelada: boolean; calendarEventId: string | null };
const sesionesDe = (actividad: Record<string, unknown>) => actividad.sesiones as Sesion[];

/** La misma actividad con un encuentro cancelado, elegido por id. */
const conCancelada = (actividad: Record<string, unknown>, id: string) => ({
  ...actividad,
  sesiones: sesionesDe(actividad).map((s) => (s.id === id ? { ...s, cancelada: true } : s)),
});

/** "Encuentro 3 de 8" → `[3, 8]`. `null` si la descripción no numera. */
const posicionDeclarada = (
  actividad: Record<string, unknown>,
  sesion: unknown,
): [number, number] | null => {
  const m = /Encuentro (\d+) de (\d+)/.exec(construirDescripcion(actividad, sesion));
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/** El encuentro del medio, por tiempo: el que más vecinos tiene para arrastrar. */
const delMedio = (caso: CasoDeCiclo): Sesion => {
  const vivas = sesionesDe(caso.actividad).filter((s) => !s.cancelada);
  return vivas[Math.floor(vivas.length / 2)]!;
};

// ─────────────────────────────────────────────────────────────────────
// El fixture, primero: si se ablanda, todo lo de abajo deja de probar algo
// ─────────────────────────────────────────────────────────────────────

describe('el fixture canónico es el caso del §2.2, y no se puede ablandar', () => {
  it('el ciclo por defecto tiene ocho encuentros, duración real e ids estables', () => {
    const sesiones = sesionesDeCiclo();
    expect(sesiones).toHaveLength(ENCUENTROS_DEL_CICLO);
    expect(ENCUENTROS_DEL_CICLO).toBeGreaterThanOrEqual(2);
    expect(DURACION_MINUTOS).toBeGreaterThan(0);
    for (const s of sesiones) {
      // H1: duración cero hace indetectable cualquier divergencia inicio/fin.
      expect(s.fin.toMillis() - s.inicio.toMillis()).toBe(DURACION_MINUTOS * 60_000);
      // Trampa 2: id del cliente, nunca por índice.
      expect(s.id).toMatch(/^ses_/);
    }
    expect(cicloDeOcho().esCiclo).toBe(true);
    expect(cicloDeOcho().estado).toBe('publicado');
  });

  it('la familia incluye el caso central y el fixture flojo que dejó pasar B-84', () => {
    expect(FAMILIA_DE_CICLOS.length).toBeGreaterThanOrEqual(4);
    expect(CICLOS_QUE_NUMERAN.length).toBeGreaterThanOrEqual(3);
    // El caso de una sola sesión está a propósito: es el contraejemplo.
    expect(FAMILIA_DE_CICLOS.some((c) => c.cantidad === 1)).toBe(true);
    expect(FAMILIA_DE_CICLOS.some((c) => c.cantidad === ENCUENTROS_DEL_CICLO)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Los invariantes, sobre la familia entera
// ─────────────────────────────────────────────────────────────────────

describe('invariantes de un ciclo — sobre la familia, no sobre una instancia', () => {
  /**
   * El costo de cancelar **no escala con el tamaño del ciclo**.
   *
   * Antes de arreglar B-84 este `it` documentaba lo contrario —en un ciclo de
   * ocho, cancelar uno emitía ocho operaciones— y era el testigo de que el bug
   * seguía vivo. 1B lo arregló (D-95), así que ahora afirma la propiedad buena.
   *
   * Se queda como test propio y no se funde con el de abajo: aquel verifica
   * *cuál* es la operación, este verifica *cuántas son* en función del tamaño.
   * Un arreglo que emitiera un `actualizar` idempotente por hermano pasaría el
   * de identidad —el borrado seguiría estando— y volvería a reescribir los
   * siete eventos restantes, que es el daño que costaba caro.
   */
  it('B-84: cancelar cuesta lo mismo en un ciclo de ocho que en uno de dos', () => {
    const medido = CICLOS_QUE_NUMERAN.map((caso) => {
      const objetivo = delMedio(caso);
      const ops = planificar(caso.actividad, conCancelada(caso.actividad, objetivo.id));
      return [caso.cantidad, ops.length];
    });
    expect(medido).toEqual(CICLOS_QUE_NUMERAN.map((c) => [c.cantidad, 1]));
  });

  it('B-84: cancelar un encuentro toca un solo evento, en cualquier ciclo', () => {
    const sobrantes: string[] = [];
    for (const caso of CICLOS_QUE_NUMERAN) {
      const objetivo = delMedio(caso);
      const ops = planificar(caso.actividad, conCancelada(caso.actividad, objetivo.id)) as {
        tipo: string;
        eventId?: string;
      }[];
      const esperado = [{ tipo: 'borrar', eventId: objetivo.calendarEventId }];
      const obtenido = ops.map((o) => ({ tipo: o.tipo, eventId: o.eventId }));
      if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
        sobrantes.push(`${caso.nombre}: ${ops.length} ops en vez de 1`);
      }
    }
    expect(sobrantes).toEqual([]);
  });

  it('B-84: el número de un encuentro no cambia porque otro se cancele', () => {
    const renumerados: string[] = [];
    for (const caso of CICLOS_QUE_NUMERAN) {
      const objetivo = delMedio(caso);
      const despues = conCancelada(caso.actividad, objetivo.id);
      for (const s of sesionesDe(caso.actividad)) {
        if (s.id === objetivo.id || s.cancelada) continue;
        const antes = posicionDeclarada(caso.actividad, s);
        const ahora = posicionDeclarada(despues, s);
        if (JSON.stringify(antes) !== JSON.stringify(ahora)) {
          renumerados.push(`${caso.nombre} · ${s.id}: ${antes?.join('/')} → ${ahora?.join('/')}`);
        }
      }
    }
    expect(renumerados).toEqual([]);
  });

  it('B-84: el total del ciclo es su cantidad de encuentros, cancelados incluidos', () => {
    const mal: string[] = [];
    for (const caso of CICLOS_QUE_NUMERAN) {
      for (const s of sesionesDe(caso.actividad)) {
        if (s.cancelada) continue;
        const posicion = posicionDeclarada(caso.actividad, s);
        if (posicion && posicion[1] !== caso.cantidad) {
          mal.push(`${caso.nombre} · ${s.id}: dice "de ${posicion[1]}" y son ${caso.cantidad}`);
        }
      }
    }
    expect(mal).toEqual([]);
  });

  it('un encuentro cancelado no tiene evento en ningún ciclo (§7.3)', () => {
    // Esta mitad del invariante ya valía con el bug vivo: lo que B-84 rompía
    // era el daño colateral, no el borrado. Se queda igual justamente por eso
    // — es el control que no se movió cuando se movió todo lo demás.
    for (const caso of CICLOS_QUE_NUMERAN) {
      const objetivo = delMedio(caso);
      const ops = planificar(caso.actividad, conCancelada(caso.actividad, objetivo.id)) as {
        tipo: string;
        eventId?: string;
      }[];
      expect(ops).toContainEqual(
        expect.objectContaining({ tipo: 'borrar', eventId: objetivo.calendarEventId }),
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// El detector: la instancia que todavía no existe
// ─────────────────────────────────────────────────────────────────────

const archivosDeTest = (): string[] =>
  execFileSync('git', ['ls-files', '-z', 'tests'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => f.endsWith('.ts'));

/**
 * Pares `inicio:` / `fin:` adyacentes de un fixture, con la expresión de cada
 * uno tal como está escrita. No se parsea TypeScript a propósito: alcanza con
 * el texto, y un parser sería más frágil que el chequeo.
 */
const paresInicioFin = (src: string): { linea: number; inicio: string; fin: string }[] => {
  const pares: { linea: number; inicio: string; fin: string }[] = [];
  const re = /inicio:\s*([^\n]*?),\s*\n\s*fin:\s*([^\n]*?),/g;
  for (const m of src.matchAll(re)) {
    pares.push({
      linea: src.slice(0, m.index).split('\n').length,
      inicio: m[1]!.trim(),
      fin: m[2]!.trim(),
    });
  }
  return pares;
};

/**
 * Ratchet, no amnistía: las instancias que ya existen se nombran una por una
 * con su ítem de backlog, y cualquier instancia **nueva** falla. Sin la lista
 * el chequeo no podría entrar en verde y no protegería nada; con la lista
 * abierta protegería nada tampoco — así que la lista es exacta y cada línea
 * tiene dueño.
 */
const DURACION_CERO_CONOCIDA = [
  // B-136 · el default del helper `sesion()` es duración cero: 16 de sus 17
  // usos no pasan `fin`. Es el fixture de H1, todavía vivo en el archivo que
  // H1 arregló (ahí se arregló el caso puntual, no el default).
  'tests/calendarioPanel.test.ts:44',
];

describe('detector de fixtures flojos — B-135', () => {
  it('ningún fixture nuevo tiene duración cero (el patrón de H1)', () => {
    const sospechosos: string[] = [];

    for (const archivo of archivosDeTest()) {
      const src = readFileSync(fileURLToPath(new URL(archivo, raiz)), 'utf8');
      // Este archivo habla de los patrones, obviamente los contiene.
      if (archivo.endsWith('invariantes-de-ciclo.test.ts')) continue;

      for (const par of paresInicioFin(src)) {
        const ubicacion = `${archivo}:${par.linea}`;
        // (a) la misma expresión en los dos: duración cero fija.
        const identicas = par.inicio === par.fin;
        // (b) `fin` cae por default en `inicio`: duración cero salvo que el
        //     caller se acuerde. Es el caso de H1.
        const porDefault = /\?\?[^\n]*inicio/.test(par.fin);
        if ((identicas || porDefault) && !DURACION_CERO_CONOCIDA.includes(ubicacion)) {
          sospechosos.push(`${ubicacion} — inicio: ${par.inicio} / fin: ${par.fin}`);
        }
      }
    }

    expect(sospechosos).toEqual([]);
  });

  it('la lista de duraciones cero conocidas no tiene entradas muertas', () => {
    // Si alguien arregla una y no borra su línea, la lista se convierte en una
    // amnistía general y el detector deja de detectar.
    const vivas = new Set<string>();
    for (const archivo of archivosDeTest()) {
      if (archivo.endsWith('invariantes-de-ciclo.test.ts')) continue;
      const src = readFileSync(fileURLToPath(new URL(archivo, raiz)), 'utf8');
      for (const par of paresInicioFin(src)) {
        if (par.inicio === par.fin || /\?\?[^\n]*inicio/.test(par.fin)) {
          vivas.add(`${archivo}:${par.linea}`);
        }
      }
    }
    expect(DURACION_CERO_CONOCIDA.filter((c) => !vivas.has(c))).toEqual([]);
  });

  /**
   * El otro lado de la clase: un archivo que razona sobre el diff de sesiones
   * pero nunca lo ejercita en un ciclo. `calendario.test.ts` es el caso: tiene
   * `esCiclo: true` en tres tests de descripción, así que pasa este chequeo
   * aunque su fixture base no sea un ciclo — el que cierra ese hueco es el
   * bloque de invariantes de arriba, no este detector. Acá lo que se frena es
   * el archivo **nuevo** que planifique operaciones sin un solo ciclo.
   */
  it('todo test que planifica operaciones de Calendar ejercita un ciclo (§2.2)', () => {
    const sinCiclo: string[] = [];
    for (const archivo of archivosDeTest()) {
      const src = readFileSync(fileURLToPath(new URL(archivo, raiz)), 'utf8');
      if (!/\bplanificar\(/.test(src)) continue;
      const ejercitaCiclo =
        /esCiclo:\s*true/.test(src) ||
        /fixtures\/ciclo/.test(src) ||
        /cicloDeOcho|CICLOS_QUE_NUMERAN|FAMILIA_DE_CICLOS/.test(src);
      if (!ejercitaCiclo) sinCiclo.push(archivo);
    }
    expect(sinCiclo).toEqual([]);
  });
});
