/**
 * **El archivador del backlog** — `scripts/archivar-backlog.mjs`.
 *
 * ── Por qué esto tiene tests, y más que el tablero ────────────────────────
 * Porque **mueve las 17.000 líneas de prosa de `docs/BACKLOG.md`**, que es donde
 * vive el rastro de todo lo que se rompió en este proyecto y por qué. El tablero
 * reescribe una línea; esto reescribe los dos archivos enteros. El modo de fallar
 * de un script así es silencioso: un `slice` corrido por uno se come una línea
 * suelta en el medio de un diff de diecisiete mil, y nadie la ve nunca más.
 *
 * Por eso lo que se afirma acá no es «el resultado se ve bien» sino **la
 * conservación**: los mismos ítems antes y después, con el mismo cuerpo, el mismo
 * encabezado y la misma sección. Y el control negativo, que es el que hace que
 * esto valga algo: un movimiento que pierde texto **tiene que** dar rojo.
 */
import { describe, expect, it } from 'vitest';

import { archivar, despiezar, verificar } from '../scripts/archivar-backlog.mjs';
import { idsUsados, parsearBacklog, proximoNumero } from '../scripts/tablero/parseo.mjs';

/** Un backlog de juguete con las piezas que el real tiene: cabecera, prosa de
 *  sección, los cuatro estados, y la tabla de «Cerrados» del final. */
const VIVO = [
  '# Backlog',
  '',
  'Ordenado por prioridad. **Todo reporte de posible bug entra acá.**',
  '',
  '> **Hueco de numeración: `B-297` no existe y no se borró nada.**',
  '',
  '## P1 — bloquean el objetivo del proyecto',
  '',
  'La prosa de la sección, que es de la sección y no de ningún ítem.',
  '',
  '### B-900 · Algo que falta · P1',
  '',
  'El cuerpo del que falta, con una tabla adentro:',
  '',
  '| Qué | Dónde |',
  '|---|---|',
  '| una fila | acá |',
  '',
  '### B-901 · Algo que ya se hizo — ✅ hecho (2026-09-11) · P1',
  '',
  'El cuerpo del hecho, con «comillas latinas» y un — guión largo.',
  '',
  '## P2 — mejoras reales',
  '',
  '### B-902 · Algo empezado · P2 — 🟠 empezado (2026-09-12)',
  '',
  'El cuerpo del empezado.',
  '',
  '### B-903 · Algo que no se hace — ❌ descartado (2026-09-02)',
  '',
  'El cuerpo del descartado, con el motivo.',
  '',
  '## Cerrados',
  '',
  'Se dejan para que quede el rastro de qué se rompió.',
  '',
  '| Qué | Causa | Dónde |',
  '|---|---|---|',
  '| **Un bug que se arregló en el momento** | la causa | `archivo.ts` (2026-09-01) |',
  '',
].join('\n');

const de = (texto: string, id: string) => parsearBacklog(texto).items.find((i) => i.id === id);

describe('archivar los cerrados', () => {
  const s = archivar(VIVO, '');

  it('se lleva lo cerrado y deja lo que falta', () => {
    expect(parsearBacklog(s.vivo).items.map((i) => i.id)).toEqual(['B-900', 'B-902']);
    expect(parsearBacklog(s.archivo).items.map((i) => i.id)).toEqual(['B-901', 'B-903']);
    expect(s.movidos.map((m) => m.id)).toContain('B-901');
    expect(s.movidos.map((m) => m.id)).toContain('B-903');
  });

  it('descartado también es una puerta cerrada, y se va igual que hecho', () => {
    // Si solo se mirara `✅`, los ocho `❌ descartado` del archivo real se
    // quedarían en el vivo pareciendo trabajo pendiente.
    expect(de(s.archivo, 'B-903')!.estado).toBe('descartado');
    expect(de(s.vivo, 'B-903')).toBeUndefined();
  });

  it('no altera una coma del cuerpo, del encabezado ni de la sección', () => {
    for (const antes of parsearBacklog(VIVO).items) {
      const despues = de(s.vivo, antes.id) ?? de(s.archivo, antes.id)!;
      expect(despues.cuerpo.trim()).toBe(antes.cuerpo.trim());
      expect(despues.encabezado).toBe(antes.encabezado);
      expect(despues.seccion).toBe(antes.seccion);
    }
  });

  it('la cabecera y la prosa de cada sección se quedan en el vivo', () => {
    // La cabecera es la que explica los huecos de numeración, y se lee **antes**
    // de numerar uno nuevo: mandarla al archivo la esconde justo de quien la
    // necesita.
    expect(s.vivo).toContain('**Todo reporte de posible bug entra acá.**');
    expect(s.vivo).toContain('Hueco de numeración: `B-297`');
    expect(s.vivo).toContain('La prosa de la sección, que es de la sección');
    expect(s.archivo).not.toContain('Hueco de numeración');
  });

  it('la tabla de «Cerrados» se va entera, con sus filas', () => {
    expect(s.archivo).toContain('| **Un bug que se arregló en el momento** |');
    expect(s.vivo).not.toContain('Un bug que se arregló en el momento');
    // Y la tabla que vive **adentro** del cuerpo de un ítem abierto se queda con
    // él: no toda fila de tabla es de la sección «Cerrados».
    expect(s.vivo).toContain('| una fila | acá |');
  });

  it('el archivo nuevo dice de dónde salió y cómo volver', () => {
    expect(s.archivo).toMatch(/^# Backlog — cerrados/u);
    expect(s.archivo).toContain('BACKLOG.md');
  });
});

describe('correrlo de nuevo', () => {
  it('no mueve nada la segunda vez, y deja los dos archivos idénticos', () => {
    const uno = archivar(VIVO, '');
    const dos = archivar(uno.vivo, uno.archivo);
    expect(dos.movidos).toEqual([]);
    expect(dos.devueltos).toEqual([]);
    expect(dos.vivo).toBe(uno.vivo);
    expect(dos.archivo).toBe(uno.archivo);
  });
});

describe('el camino de vuelta', () => {
  it('un archivado que se reabre vuelve al vivo, a su sección', () => {
    /*
     * Sin esto, reabrir un ítem desde el tablero lo dejaría abierto **adentro**
     * del archivo de cerrados: la peor de las dos mentiras posibles, y ninguna
     * corrida futura lo sacaría de ahí.
     */
    const uno = archivar(VIVO, '');
    const reabierto = uno.archivo.replace(' — ✅ hecho (2026-09-11)', '');
    const dos = archivar(uno.vivo, reabierto);

    expect(dos.devueltos.map((d) => d.id)).toEqual(['B-901']);
    expect(de(dos.vivo, 'B-901')!.seccion).toBe('P1 — bloquean el objetivo del proyecto');
    expect(de(dos.archivo, 'B-901')).toBeUndefined();
    expect(de(dos.vivo, 'B-901')!.cuerpo).toContain('«comillas latinas»');
  });
});

describe('la verificación que corre antes de escribir', () => {
  it('no encuentra nada perdido en un movimiento sano', () => {
    expect(verificar(VIVO, archivar(VIVO, ''))).toEqual([]);
  });

  it('**detecta** un movimiento que se comió texto', () => {
    /*
     * El control negativo, y sin él los dos casos de arriba no valen nada: un
     * verificador que compara dos listas queda verde igual porque no encuentra
     * nada que porque no busca nada (B-873). Acá se rompe a propósito lo que
     * dice cuidar —se le saca una línea al cuerpo de un ítem movido— y se exige
     * que lo diga.
     */
    const sano = archivar(VIVO, '');
    const roto = {
      ...sano,
      archivo: sano.archivo.replace('El cuerpo del descartado, con el motivo.', ''),
    };
    expect(verificar(VIVO, roto)).toEqual(['B-903']);
  });
});

describe('la numeración, que es lo que el corte puede romper', () => {
  it('el próximo id sale de los dos archivos, nunca de uno solo', () => {
    /*
     * El peligro concreto: los ids de lo cerrado son la mitad de la defensa
     * contra el choque de numeración (el `B-930` que dos frentes eligieron a la
     * vez el 2026-09-15). Si el tablero mirara solo el archivo vivo, propondría
     * un número que un ítem archivado ya tiene.
     */
    const s = archivar(VIVO, '');
    const losDos = `${s.vivo}\n${s.archivo}`;
    expect(proximoNumero(losDos)).toBe(proximoNumero(VIVO));
    expect(idsUsados(losDos)).toEqual(idsUsados(VIVO));
    expect([...idsUsados(s.vivo)]).not.toContain('B-903');
  });
});

describe('contra el archivo real', () => {
  it('no pierde ni un ítem, ni una coma, ni cambia una sección', async () => {
    /*
     * Control positivo sobre el archivo de verdad, que es el único que tiene las
     * formas raras: encabezados con dos ids, ítems con tablas y bloques de
     * código adentro, secciones sin prosa. El número no se escribe —envejece—:
     * lo que se afirma es la conservación.
     */
    const { readFile } = await import('node:fs/promises');
    const original = await readFile(`${process.cwd()}/docs/BACKLOG.md`, 'utf8');
    const s = archivar(original, '');

    const antes = parsearBacklog(original).items;
    const despues = [...parsearBacklog(s.vivo).items, ...parsearBacklog(s.archivo).items];
    expect(despues.length).toBe(antes.length);
    expect(verificar(original, s)).toEqual([]);

    const porId = new Map(despues.map((i) => [i.id, i]));
    for (const antesIt of antes) {
      const despuesIt = porId.get(antesIt.id);
      expect(despuesIt, `se perdió ${antesIt.id}`).toBeDefined();
      expect(despuesIt!.encabezado).toBe(antesIt.encabezado);
      expect(despuesIt!.cuerpo.trim()).toBe(antesIt.cuerpo.trim());
      expect(despuesIt!.seccion).toBe(antesIt.seccion);
    }

    // Y lo que queda en el vivo es, exactamente, lo que falta hacer.
    expect(parsearBacklog(s.vivo).items.every((i) => i.estado === 'abierto' || i.estado === 'empezado')).toBe(true);
    expect(proximoNumero(`${s.vivo}\n${s.archivo}`)).toBe(proximoNumero(original));
  });

  it('despiezar no se traga ninguna línea del archivo real', () => {
    // La otra mitad de la conservación, sobre el juguete: cada línea del
    // original está en el preámbulo, en la prosa de una sección, o en un ítem.
    const { preambulo, secciones } = despiezar(VIVO);
    const reconstruido = [
      preambulo,
      ...secciones.map((s) =>
        [`## ${s.titulo}`, ...s.prosa, ...s.items.map((i: { texto: string }) => i.texto)].join('\n'),
      ),
    ].join('\n');
    for (const linea of VIVO.split('\n').filter((l) => l.trim())) {
      expect(reconstruido, `se perdió: ${linea}`).toContain(linea);
    }
  });
});
